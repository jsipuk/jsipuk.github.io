# WiFi Quality Monitor

A local, privacy-preserving tool that watches your WiFi signal and internet
quality, and -- this is the point of it -- **explains why** performance
dropped instead of just logging that it did.

## Product principle

Raw metrics aren't the deliverable. A log line saying "latency: 340ms" tells
you almost nothing about what to do next. This tool's job is to correlate
signals nearby in time (WiFi RSSI, router-hop ping, public-hop ping, DNS
lookup time, BSSID changes, time-of-day recurrence) and produce a
human-readable explanation with a likely cause, a confidence level, the
evidence behind it, and a suggested next action -- e.g.:

> At 19:42, internet latency rose to 340 ms for 2m 12s. WiFi signal stayed
> strong at -52 dBm and router ping remained normal, so this looks more
> like an ISP or upstream internet issue than a WiFi coverage problem.

Dashboards and visualization are explicitly out of scope for v1. The
correlation engine is the product.

## Causes it distinguishes

| Cause | Signature |
|---|---|
| `weak_wifi_signal` | RSSI drops at/before latency or speed problems |
| `router_local_issue` | Router ping fails/spikes while WiFi signal stays stable |
| `isp_upstream_issue` | Router ping is fine, but public ping/speed degrades |
| `dns_issue` | Raw IP ping is fine, but DNS lookup time/failures rise |
| `roaming` | Same SSID, BSSID changes shortly before a drop |
| `network_congestion` | Signal stays strong, but latency/speed worsens at recurring times of day (same pattern seen on other recent days) |
| `full_disconnect` | WiFi, router ping, and public ping all fail together |
| `unclassified` | Metrics degraded but no pattern matched confidently |

## How correlation works

Every check interval, the tool takes a `Reading` (signal, router ping,
public ping, DNS lookup time, occasionally throughput) and appends it to a
rolling in-memory history and to `readings_log.csv`. When any metric
breaches its threshold, it opens an **event**: it snapshots the preceding
readings (`before`), keeps collecting readings while the problem persists
(`during`), and once a few consecutive good readings confirm recovery
(`after`), it closes the event and runs it through `correlate.classify()`
-- an ordered set of heuristics (see `correlate.py`) that checks, in
priority order: full disconnect, roaming (BSSID change), weak signal
leading the drop, router-local failure, DNS-specific failure, then
ISP/congestion (using recent event history to tell a one-off outage from a
recurring pattern at the same time of day). The result is appended as one
JSON object per line to `events.jsonl`.

### Event data model

```json
{
  "event_id": "...",
  "start_time": "2026-07-02T19:42:03",
  "end_time": "2026-07-02T19:44:15",
  "duration_seconds": 132,
  "trigger_metrics": ["public_ping_ms"],
  "raw_metrics": { "...snapshot of the triggering reading..." },
  "timeline": {
    "before": [ "...readings preceding the event..." ],
    "during": [ "...readings while the problem persisted..." ],
    "after":  [ "...readings confirming recovery..." ]
  },
  "likely_cause": "isp_upstream_issue",
  "confidence": "medium",
  "supporting_evidence": [
    "Router ping stayed normal (4 ms) while public ping/speed degraded."
  ],
  "recovery_pattern": {
    "resolved": true,
    "duration_seconds": 132,
    "recovery_style": "gradual"
  },
  "suggested_next_action": "This looks upstream of your home network -- check your ISP's status page or contact support.",
  "human_summary": "At 19:42, internet latency rose to 340 ms for 2m 12s. WiFi signal stayed strong at -52 dBm and router ping remained normal, so this looks more like an ISP or upstream internet issue than a WiFi coverage problem."
}
```

## Architecture

```
wifi_monitor.py   main loop: takes readings, runs the event state machine,
                  writes readings_log.csv and events.jsonl
collectors.py     OS-specific measurement: WiFi signal/SSID/BSSID, default
                  gateway, ping, DNS lookup timing, throughput
correlate.py      the classifier: breach detection + cause heuristics +
                  human-readable summaries + suggested actions
models.py         Reading / Event / RecoveryPattern data classes
config.json       thresholds, intervals, hosts
```

## Requirements

- Python 3.8+ (standard library only, no pip installs)
- **macOS** (primary target): `system_profiler` and `route` (both built in)
- **Windows** (planned support, implemented but less tested): `netsh` and `ipconfig` (both built in)
- **Linux**: `nmcli` (or `iwconfig` fallback) and `ip route` (both built in on most distros)
- `ping` on your PATH (built in on all three)

### Why not iOS

Not supported, and not realistically feasible as this kind of background
tool. iOS gives third-party apps no RSSI access at all, and even SSID/BSSID
(`NEHotspotNetwork`) requires a special Apple-granted entitlement mostly
reserved for enterprise MDM/hotspot vendors. iOS also doesn't allow
arbitrary background processes to poll on an interval the way this tool
does -- a native app could show current-network info while in the
foreground, but not passive continuous monitoring like this.

## Setup

```bash
cd wifi-monitor
# no dependencies to install -- stdlib only
```

Edit `config.json`:

```json
{
  "check_interval_seconds": 30,
  "speed_test_interval_seconds": 1800,
  "signal_threshold_percent": 40,
  "router_ping_threshold_ms": 30,
  "public_ping_threshold_ms": 100,
  "dns_lookup_threshold_ms": 150,
  "download_threshold_mbps": 5,
  "public_ping_host": "8.8.8.8",
  "router_ping_host": null,
  "dns_test_host": "www.google.com",
  "speedtest_url": "https://speed.hetzner.de/100MB.bin",
  "speedtest_max_bytes": 5000000,
  "recovery_confirm_readings": 2,
  "history_before_readings": 6,
  "congestion_lookback_days": 7,
  "congestion_time_window_minutes": 30,
  "congestion_min_occurrences": 2,
  "readings_log_file": "readings_log.csv",
  "events_log_file": "events.jsonl"
}
```

| Key | Meaning |
|---|---|
| `check_interval_seconds` | How often to take a reading |
| `speed_test_interval_seconds` | How often to run a throughput check (kept infrequent -- it downloads real data) |
| `signal_threshold_percent` | WiFi signal quality floor (0-100%) |
| `router_ping_threshold_ms` | Latency ceiling for the router/gateway hop |
| `public_ping_threshold_ms` | Latency ceiling for the public IP hop |
| `dns_lookup_threshold_ms` | DNS resolution time ceiling |
| `download_threshold_mbps` | Throughput floor |
| `public_ping_host` | Public IP to ping (default: Google DNS, deliberately an IP so this test doesn't depend on DNS) |
| `router_ping_host` | Router IP to ping; `null` auto-detects your default gateway |
| `dns_test_host` | Hostname resolved to measure DNS timing |
| `recovery_confirm_readings` | Consecutive good readings required before an event is considered resolved |
| `history_before_readings` | How many prior readings to snapshot as `before` context when an event starts |
| `congestion_lookback_days` / `congestion_time_window_minutes` / `congestion_min_occurrences` | How the tool decides an ISP-looking issue is actually recurring congestion: N or more past events at roughly the same time of day within the lookback window |

## Run

```bash
python3 wifi_monitor.py
```

```bash
python3 wifi_monitor.py --config /path/to/other_config.json
```

Every reading prints live to the console. Raw readings are appended to
`readings_log.csv` (also the data source for congestion recurrence
detection across restarts/days). When a threshold breach resolves, a
classified event prints a summary and is appended to `events.jsonl`. Stop
with `Ctrl+C`.

## Example output

Console:
```
[2026-07-02T19:42:03] signal=82% router=4ms public=340ms dns=15ms

======================================================================
At 19:42, internet latency rose to 340 ms for 2m 12s. WiFi signal stayed
strong at -52 dBm and router ping remained normal, so this looks more like
an ISP or upstream internet issue than a WiFi coverage problem.
Likely cause: isp_upstream_issue  (confidence: medium)
Suggested next action: This looks upstream of your home network -- check
your ISP's status page or contact support.
======================================================================
```

`events.jsonl` gets one JSON object per line matching the schema above.
`readings_log.csv` gets one row per check:

```csv
timestamp,ssid,bssid,signal_percent,signal_dbm,router_ping_ms,public_ping_ms,dns_lookup_ms,download_mbps
2026-07-02T19:41:30,Home,aa:bb:cc:dd:ee:01,82,-52,4,340,15.2,
```

## Limitations

- **BSSID (roaming detection) is often unavailable on macOS.** Recent
  macOS versions withhold BSSID from processes without Location Services
  authorization, which an unsigned script doesn't have. The roaming rule
  will simply not fire in that case rather than guessing.
- **Throughput tests consume real bandwidth** (capped at `speedtest_max_bytes`,
  default 5MB per test, run infrequently by default).
- **Signal reading is OS- and driver-dependent.** The regexes in
  `collectors.py` target the common case; corporate-managed machines or
  unusual drivers may format output differently, in which case signal
  reads as unavailable rather than crashing.
- **Congestion detection needs history.** The first time a recurring
  slowdown happens, it's classified as `isp_upstream_issue` (not enough
  evidence yet); it only gets reclassified as `network_congestion` once
  the same time-of-day pattern shows up on `congestion_min_occurrences`
  separate days.
- **Single ping per interval**, not packet-loss/jitter statistics. Fine
  for classification, not for precise network diagnostics.
- **Runs in the foreground** in one terminal. For always-on monitoring,
  run under `tmux`/`screen`, `nohup`, a `launchd` agent (macOS), or Task
  Scheduler (Windows).
- **No iOS support** -- see "Why not iOS" above.

## Possible next steps

- `launchd`/Task Scheduler service files for background running on macOS/Windows.
- Multi-packet ping for packet loss/jitter.
- A small script to summarize `events.jsonl` (counts by cause, worst days) --
  still not a full dashboard, just a text report.
- Track per-SSID stats once on multiple networks (e.g. home vs. office).
