"""OS-specific and network measurement helpers.

Every function here degrades to None on failure rather than raising, so the
main loop never has to special-case "this OS doesn't support X."
"""

import platform
import re
import socket
import subprocess
import time
import urllib.error
import urllib.request


def dbm_to_percent(dbm):
    """Rough conversion of dBm signal strength to a 0-100% quality figure."""
    percent = 2 * (dbm + 100)
    return max(0, min(100, percent))


# ---------------------------------------------------------------------------
# WiFi signal / SSID / BSSID
# ---------------------------------------------------------------------------

def get_wifi_info():
    """Return {ssid, bssid, signal_percent, signal_dbm}, any of which may be
    None if unavailable on this OS/driver/permission level."""
    system = platform.system()
    try:
        if system == "Darwin":
            return _wifi_info_macos()
        elif system == "Linux":
            return _wifi_info_linux()
        elif system == "Windows":
            return _wifi_info_windows()
    except (subprocess.SubprocessError, FileNotFoundError, OSError):
        pass
    return {"ssid": None, "bssid": None, "signal_percent": None, "signal_dbm": None}


def _wifi_info_macos():
    # system_profiler works without sudo. Note: recent macOS versions
    # withhold BSSID from processes without Location Services authorization
    # -- bssid will often be None here, which disables roaming detection.
    out = subprocess.run(
        ["system_profiler", "SPAirPortDataType"], capture_output=True, text=True, timeout=10
    ).stdout

    ssid = None
    ssid_match = re.search(r"Current Network Information:\s*\n\s*(.+?):\s*\n", out)
    if ssid_match:
        ssid = ssid_match.group(1).strip()

    dbm = None
    signal_match = re.search(r"Signal / Noise:\s*(-?\d+) dBm", out)
    if signal_match:
        dbm = int(signal_match.group(1))

    bssid = None
    bssid_match = re.search(r"BSSID:\s*([0-9a-fA-F:]{17})", out)
    if bssid_match:
        bssid = bssid_match.group(1).lower()

    return {
        "ssid": ssid,
        "bssid": bssid,
        "signal_percent": dbm_to_percent(dbm) if dbm is not None else None,
        "signal_dbm": dbm,
    }


def _nmcli_unescape(field):
    return field.replace("\\:", ":")


def _wifi_info_linux():
    try:
        out = subprocess.run(
            ["nmcli", "-t", "-f", "ACTIVE,SSID,BSSID,SIGNAL", "dev", "wifi"],
            capture_output=True, text=True, timeout=5,
        ).stdout
        for line in out.splitlines():
            # nmcli terse output escapes literal ':' inside field values with
            # '\:', so split on unescaped colons only.
            parts = re.split(r"(?<!\\):", line)
            if len(parts) >= 4 and parts[0] == "yes":
                ssid = _nmcli_unescape(parts[1])
                bssid = _nmcli_unescape(parts[2]).lower() or None
                signal_percent = int(parts[3]) if parts[3] else None
                return {
                    "ssid": ssid or None,
                    "bssid": bssid,
                    "signal_percent": signal_percent,
                    "signal_dbm": None,
                }
    except FileNotFoundError:
        pass

    # Fallback: iwconfig gives dBm and (usually) the AP MAC, no reliable SSID
    # parsing across driver versions, so we leave ssid as None.
    out = subprocess.run(["iwconfig"], capture_output=True, text=True, timeout=5).stdout
    dbm_match = re.search(r"Signal level=(-?\d+) dBm", out)
    bssid_match = re.search(r"Access Point:\s*([0-9A-Fa-f:]{17})", out)
    dbm = int(dbm_match.group(1)) if dbm_match else None
    return {
        "ssid": None,
        "bssid": bssid_match.group(1).lower() if bssid_match else None,
        "signal_percent": dbm_to_percent(dbm) if dbm is not None else None,
        "signal_dbm": dbm,
    }


def _wifi_info_windows():
    out = subprocess.run(
        ["netsh", "wlan", "show", "interfaces"], capture_output=True, text=True, timeout=5
    ).stdout
    ssid_match = re.search(r"^\s*SSID\s*:\s*(.+)$", out, re.MULTILINE)
    bssid_match = re.search(r"^\s*BSSID\s*:\s*([0-9A-Fa-f:]{17})", out, re.MULTILINE)
    signal_match = re.search(r"^\s*Signal\s*:\s*(\d+)%", out, re.MULTILINE)
    return {
        "ssid": ssid_match.group(1).strip() if ssid_match else None,
        "bssid": bssid_match.group(1).lower() if bssid_match else None,
        "signal_percent": int(signal_match.group(1)) if signal_match else None,
        "signal_dbm": None,
    }


# ---------------------------------------------------------------------------
# Default gateway (the "router" hop for local-network vs upstream checks)
# ---------------------------------------------------------------------------

def get_default_gateway():
    system = platform.system()
    try:
        if system == "Darwin":
            out = subprocess.run(
                ["route", "-n", "get", "default"], capture_output=True, text=True, timeout=5
            ).stdout
            match = re.search(r"gateway:\s*(\S+)", out)
            return match.group(1) if match else None
        elif system == "Linux":
            out = subprocess.run(
                ["ip", "route", "show", "default"], capture_output=True, text=True, timeout=5
            ).stdout
            match = re.search(r"default via (\S+)", out)
            return match.group(1) if match else None
        elif system == "Windows":
            out = subprocess.run(["ipconfig"], capture_output=True, text=True, timeout=5).stdout
            for match in re.finditer(r"Default Gateway[ .]*:\s*(\S+)", out):
                if match.group(1):
                    return match.group(1)
    except (subprocess.SubprocessError, FileNotFoundError, OSError):
        pass
    return None


# ---------------------------------------------------------------------------
# Latency, DNS, throughput
# ---------------------------------------------------------------------------

def ping_ms(host, timeout_s=2):
    """Send a single ping and return round-trip time in ms, or None if the
    host didn't reply (this is itself meaningful -- it means that hop is
    down, not just slow)."""
    if not host:
        return None
    system = platform.system()
    cmd = (
        ["ping", "-n", "1", "-w", str(timeout_s * 1000), host]
        if system == "Windows"
        else ["ping", "-c", "1", "-W", str(timeout_s), host]
    )
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout_s + 3)
    except (subprocess.SubprocessError, FileNotFoundError):
        return None
    match = re.search(r"time[=<]\s*([\d.]+)\s*ms", out.stdout, re.IGNORECASE)
    return float(match.group(1)) if match else None


def dns_lookup_ms(hostname, timeout_s=3):
    """Time a DNS resolution. Returns None on failure/timeout, which is
    itself the signal we care about (DNS not resolving)."""
    old_timeout = socket.getdefaulttimeout()
    socket.setdefaulttimeout(timeout_s)
    start = time.monotonic()
    try:
        socket.getaddrinfo(hostname, None)
    except (socket.gaierror, socket.timeout, OSError):
        return None
    finally:
        socket.setdefaulttimeout(old_timeout)
    return (time.monotonic() - start) * 1000


def download_mbps(url, max_bytes, timeout_s=10):
    """Download up to max_bytes from url and estimate throughput in Mbps."""
    try:
        start = time.monotonic()
        total = 0
        with urllib.request.urlopen(url, timeout=timeout_s) as resp:
            while total < max_bytes:
                chunk = resp.read(65536)
                if not chunk:
                    break
                total += len(chunk)
        elapsed = time.monotonic() - start
        if elapsed <= 0 or total == 0:
            return None
        return (total * 8) / (elapsed * 1_000_000)
    except (urllib.error.URLError, OSError, TimeoutError):
        return None
