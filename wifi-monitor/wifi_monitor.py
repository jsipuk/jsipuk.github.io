#!/usr/bin/env python3
"""
wifi_monitor.py - Lightweight local WiFi/connection quality monitor.

Polls WiFi signal strength and internet latency (plus occasional throughput
checks) at regular intervals, prints live status, and appends a row to a
local CSV log whenever a measurement drops below a configured threshold.

Everything stays on this machine: no metrics are sent anywhere except the
outbound ping/download requests used to measure latency and speed.
"""

import argparse
import csv
import json
import os
import platform
import re
import subprocess
import time
import urllib.request
from datetime import datetime

DEFAULT_CONFIG = {
    # How often to check WiFi signal + latency.
    "check_interval_seconds": 30,
    # Throughput tests are much heavier (they pull real data), so they run
    # far less often than signal/latency checks.
    "speed_test_interval_seconds": 1800,
    # Drop thresholds.
    "signal_threshold_percent": 40,
    "latency_threshold_ms": 100,
    "download_threshold_mbps": 5,
    # What to test against.
    "ping_host": "8.8.8.8",
    "speedtest_url": "https://speed.hetzner.de/100MB.bin",
    "speedtest_max_bytes": 5_000_000,  # cap download to ~5MB per test
    # Where to write drop events.
    "log_file": "wifi_quality_log.csv",
}

LOG_HEADER = ["timestamp", "metric", "value", "threshold", "unit"]


def load_config(path):
    config = dict(DEFAULT_CONFIG)
    if path and os.path.exists(path):
        with open(path, "r") as f:
            user_config = json.load(f)
        config.update(user_config)
    return config


def ensure_log_file(path):
    if not os.path.exists(path):
        with open(path, "w", newline="") as f:
            csv.writer(f).writerow(LOG_HEADER)


def log_drop(path, metric, value, threshold, unit):
    with open(path, "a", newline="") as f:
        csv.writer(f).writerow(
            [datetime.now().isoformat(timespec="seconds"), metric, round(value, 2), threshold, unit]
        )


def dbm_to_percent(dbm):
    """Rough conversion of dBm signal strength to a 0-100% quality figure."""
    percent = 2 * (dbm + 100)
    return max(0, min(100, percent))


def get_wifi_signal_percent():
    """Return WiFi signal quality as 0-100%, or None if it can't be read."""
    system = platform.system()
    try:
        if system == "Linux":
            return _get_signal_linux()
        elif system == "Darwin":
            return _get_signal_macos()
        elif system == "Windows":
            return _get_signal_windows()
    except (subprocess.SubprocessError, FileNotFoundError, OSError):
        return None
    return None


def _get_signal_linux():
    # Preferred: nmcli (NetworkManager), reports percent directly.
    try:
        out = subprocess.run(
            ["nmcli", "-t", "-f", "active,signal", "dev", "wifi"],
            capture_output=True, text=True, timeout=5,
        )
        for line in out.stdout.splitlines():
            if line.startswith("yes:"):
                return int(line.split(":")[1])
    except FileNotFoundError:
        pass

    # Fallback: iwconfig, reports dBm.
    out = subprocess.run(["iwconfig"], capture_output=True, text=True, timeout=5)
    match = re.search(r"Signal level=(-?\d+) dBm", out.stdout)
    if match:
        return dbm_to_percent(int(match.group(1)))
    return None


def _get_signal_macos():
    # system_profiler works without sudo and survived the deprecation of
    # the old `airport` CLI in recent macOS versions.
    out = subprocess.run(
        ["system_profiler", "SPAirPortDataType"], capture_output=True, text=True, timeout=10
    )
    match = re.search(r"Signal / Noise:\s*(-?\d+) dBm", out.stdout)
    if match:
        return dbm_to_percent(int(match.group(1)))
    return None


def _get_signal_windows():
    out = subprocess.run(
        ["netsh", "wlan", "show", "interfaces"], capture_output=True, text=True, timeout=5
    )
    match = re.search(r"Signal\s*:\s*(\d+)%", out.stdout)
    if match:
        return int(match.group(1))
    return None


def measure_latency_ms(host):
    """Send a single ping and return round-trip time in ms, or None."""
    system = platform.system()
    cmd = ["ping", "-n", "1", "-w", "2000", host] if system == "Windows" else ["ping", "-c", "1", "-W", "2", host]
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
    except (subprocess.SubprocessError, FileNotFoundError):
        return None
    match = re.search(r"time[=<]\s*([\d.]+)\s*ms", out.stdout, re.IGNORECASE)
    if match:
        return float(match.group(1))
    return None


def measure_download_mbps(url, max_bytes, timeout=10):
    """Download up to max_bytes from url and estimate throughput in Mbps."""
    try:
        start = time.monotonic()
        total = 0
        with urllib.request.urlopen(url, timeout=timeout) as resp:
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


def run(config):
    log_path = config["log_file"]
    ensure_log_file(log_path)
    print(f"Logging drops to {os.path.abspath(log_path)}")
    print("Press Ctrl+C to stop.\n")

    last_speed_test = 0.0

    while True:
        signal = get_wifi_signal_percent()
        if signal is not None:
            flag = " <-- DROP" if signal < config["signal_threshold_percent"] else ""
            print(f"[{datetime.now().strftime('%H:%M:%S')}] signal: {signal}%{flag}")
            if signal < config["signal_threshold_percent"]:
                log_drop(log_path, "wifi_signal_percent", signal, config["signal_threshold_percent"], "%")
        else:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] signal: unavailable on this OS/adapter")

        latency = measure_latency_ms(config["ping_host"])
        if latency is not None:
            flag = " <-- DROP" if latency > config["latency_threshold_ms"] else ""
            print(f"[{datetime.now().strftime('%H:%M:%S')}] latency: {latency:.1f} ms{flag}")
            if latency > config["latency_threshold_ms"]:
                log_drop(log_path, "latency_ms", latency, config["latency_threshold_ms"], "ms")
        else:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] latency: no reply (host unreachable)")
            log_drop(log_path, "latency_ms", -1, config["latency_threshold_ms"], "ms")

        now = time.monotonic()
        if now - last_speed_test >= config["speed_test_interval_seconds"]:
            last_speed_test = now
            mbps = measure_download_mbps(config["speedtest_url"], config["speedtest_max_bytes"])
            if mbps is not None:
                flag = " <-- DROP" if mbps < config["download_threshold_mbps"] else ""
                print(f"[{datetime.now().strftime('%H:%M:%S')}] download: {mbps:.2f} Mbps{flag}")
                if mbps < config["download_threshold_mbps"]:
                    log_drop(log_path, "download_mbps", mbps, config["download_threshold_mbps"], "Mbps")
            else:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] download: speed test failed")

        time.sleep(config["check_interval_seconds"])


def main():
    parser = argparse.ArgumentParser(description="Monitor WiFi signal and internet quality locally.")
    parser.add_argument("--config", default="config.json", help="Path to a JSON config file (optional).")
    args = parser.parse_args()

    config = load_config(args.config)
    try:
        run(config)
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
