# WiFi Quality Monitor

A small, local, single-file Python tool that watches WiFi signal strength and
internet latency (with occasional throughput checks), and logs a row to a
CSV file whenever a measurement drops below a threshold you configure.

Nothing leaves your machine except the ping/download requests used to take
the measurements themselves — no telemetry, no external logging.

## Requirements

- Python 3.8+ (standard library only, no pip installs needed)
- One of these OS-native networking tools available on your PATH:
  - **Linux**: `nmcli` (NetworkManager, most distros have this) or `iwconfig` as a fallback
  - **macOS**: `system_profiler` (built in)
  - **Windows**: `netsh` (built in)
- The `ping` command available on your PATH (built in on all three OSes)

## Setup

```bash
cd wifi-monitor
# no dependencies to install — stdlib only
```

Edit `config.json` to set your thresholds:

```json
{
  "check_interval_seconds": 30,
  "speed_test_interval_seconds": 1800,
  "signal_threshold_percent": 40,
  "latency_threshold_ms": 100,
  "download_threshold_mbps": 5,
  "ping_host": "8.8.8.8",
  "speedtest_url": "https://speed.hetzner.de/100MB.bin",
  "speedtest_max_bytes": 5000000,
  "log_file": "wifi_quality_log.csv"
}
```

| Key | Meaning |
|---|---|
| `check_interval_seconds` | How often to check signal + latency |
| `speed_test_interval_seconds` | How often to run a throughput check (kept infrequent — it downloads real data) |
| `signal_threshold_percent` | Log a drop if WiFi quality falls below this (0-100%) |
| `latency_threshold_ms` | Log a drop if ping RTT exceeds this |
| `download_threshold_mbps` | Log a drop if measured download speed falls below this |
| `ping_host` | Host to ping for latency (default: Google DNS) |
| `speedtest_url` | URL to download from for throughput checks |
| `speedtest_max_bytes` | Cap on bytes downloaded per speed test, to limit bandwidth use |
| `log_file` | CSV file drop events are appended to |

## Run

```bash
python3 wifi_monitor.py
```

Or point it at a different config file:

```bash
python3 wifi_monitor.py --config /path/to/other_config.json
```

Live readings print to the console every interval. Only readings that
breach a threshold get written to `wifi_quality_log.csv`. Stop it any time
with `Ctrl+C`.

## Example log output

```csv
timestamp,metric,value,threshold,unit
2026-07-02T14:03:12,wifi_signal_percent,32,40,%
2026-07-02T14:05:42,latency_ms,143.2,100,ms
2026-07-02T14:05:42,latency_ms,-1,100,ms
2026-07-02T15:10:00,download_mbps,3.4,5,Mbps
```

(A `value` of `-1` for `latency_ms` means the ping host was unreachable
entirely, e.g. WiFi dropped or the network is down.)

## Limitations

- **Throughput tests consume real bandwidth.** Each speed test downloads up
  to `speedtest_max_bytes` (5MB by default). Keep `speed_test_interval_seconds`
  large if you're on a metered or slow connection, or remove the URL to
  disable speed testing (it will just log a failed test each interval).
- **Signal reading is OS- and driver-dependent.** `nmcli`, `system_profiler`,
  and `netsh` are the most common tools on each OS, but corporate-managed
  machines, VPN-heavy setups, or unusual WiFi drivers may not expose these
  commands or may format their output differently. If signal reads as
  "unavailable," the regex parsing in `_get_signal_*()` is the first place
  to adjust for your machine's actual output.
- **dBm-to-percent conversion is a rough approximation** (`2*(dBm+100)`,
  clamped to 0-100), used to normalize Linux/macOS's raw dBm readings
  against Windows's native percentage. Treat the signal number as a trend
  indicator, not a precise measurement.
- **No historical analysis or dashboard yet.** This version only logs drop
  events to CSV; you'd open it in a spreadsheet or a small script to look
  for patterns.
- **Single ping per interval** for latency — not packet loss statistics.
  If you want jitter/loss tracking, swap in a multi-packet ping (`-c 5`)
  and parse the summary stats.
- **Runs in the foreground** in one terminal. For always-on monitoring,
  run it under `tmux`/`screen`, `nohup`, a `systemd` user service (Linux),
  `launchd` (macOS), or Task Scheduler (Windows).

## Possible next steps

- Add a `--daemon` mode or OS service files for background running.
- Track packet loss (parse multi-ping summary stats).
- Log every reading (not just drops) to a second CSV for full historical
  charts, and add a small script to plot signal/latency over time.
- Auto-detect the active SSID and include it in log rows, to separate
  quality issues by network (e.g. home vs. office).
