#!/usr/bin/env python3
"""
wifi_monitor.py - Local WiFi/connection quality monitor with root-cause
correlation.

Polls WiFi signal, router-hop latency, public-hop latency, and DNS lookup
time at regular intervals (plus occasional throughput checks), logs every
raw reading to a CSV, and whenever a metric breaches its threshold, tracks
the surrounding timeline and runs it through a heuristic classifier
(see correlate.py) to explain *why* it likely happened -- weak signal,
router problem, ISP/upstream, DNS, roaming, or congestion -- rather than
just recording that it happened. Classified events are appended to a JSON
Lines file with full supporting evidence and a suggested next action.

Nothing leaves this machine except the ping/DNS/download requests used to
take the measurements themselves.
"""

import argparse
import csv
import json
import os
import time
import uuid
from collections import deque
from datetime import datetime

import collectors
import correlate
from models import Event, Reading, RecoveryPattern

DEFAULT_CONFIG = {
    "check_interval_seconds": 30,
    "speed_test_interval_seconds": 1800,
    "signal_threshold_percent": 40,
    "router_ping_threshold_ms": 30,
    "public_ping_threshold_ms": 100,
    "dns_lookup_threshold_ms": 150,
    "download_threshold_mbps": 5,
    "public_ping_host": "8.8.8.8",
    "router_ping_host": None,  # null = auto-detect the default gateway
    "dns_test_host": "www.google.com",
    "speedtest_url": "https://speed.hetzner.de/100MB.bin",
    "speedtest_max_bytes": 5_000_000,
    "recovery_confirm_readings": 2,  # good readings in a row before an event is considered over
    "history_before_readings": 6,  # readings to keep as pre-event context
    "congestion_lookback_days": 7,
    "congestion_time_window_minutes": 30,
    "congestion_min_occurrences": 2,
    "readings_log_file": "readings_log.csv",
    "events_log_file": "events.jsonl",
}

READING_CSV_HEADER = [
    "timestamp", "ssid", "bssid", "signal_percent", "signal_dbm",
    "router_ping_ms", "public_ping_ms", "dns_lookup_ms", "download_mbps",
]


def load_config(path):
    config = dict(DEFAULT_CONFIG)
    if path and os.path.exists(path):
        with open(path, "r") as f:
            config.update(json.load(f))
    return config


def ensure_readings_log(path):
    if not os.path.exists(path):
        with open(path, "w", newline="") as f:
            csv.writer(f).writerow(READING_CSV_HEADER)


def append_reading_csv(path, reading):
    with open(path, "a", newline="") as f:
        csv.writer(f).writerow([
            reading.timestamp, reading.ssid, reading.bssid,
            reading.signal_percent, reading.signal_dbm,
            reading.router_ping_ms, reading.public_ping_ms,
            reading.dns_lookup_ms, reading.download_mbps,
        ])


def take_reading(config, router_host, do_speed_test):
    wifi = collectors.get_wifi_info()
    return Reading(
        timestamp=datetime.now().isoformat(timespec="seconds"),
        ssid=wifi["ssid"],
        bssid=wifi["bssid"],
        signal_percent=wifi["signal_percent"],
        signal_dbm=wifi["signal_dbm"],
        router_ping_ms=collectors.ping_ms(router_host) if router_host else None,
        public_ping_ms=collectors.ping_ms(config["public_ping_host"]),
        dns_lookup_ms=collectors.dns_lookup_ms(config["dns_test_host"]),
        download_mbps=(
            collectors.download_mbps(config["speedtest_url"], config["speedtest_max_bytes"])
            if do_speed_test else None
        ),
    )


def print_reading(reading):
    bits = [
        f"signal={reading.signal_percent}%" if reading.signal_percent is not None else "signal=?",
        f"router={reading.router_ping_ms:.0f}ms" if reading.router_ping_ms is not None else "router=fail",
        f"public={reading.public_ping_ms:.0f}ms" if reading.public_ping_ms is not None else "public=fail",
        f"dns={reading.dns_lookup_ms:.0f}ms" if reading.dns_lookup_ms is not None else "dns=fail",
    ]
    if reading.download_mbps is not None:
        bits.append(f"down={reading.download_mbps:.1f}Mbps")
    print(f"[{reading.timestamp}] " + " ".join(bits))


def finalize_event(active_event, config):
    before, during, after = active_event["before"], active_event["during"], active_event.get("after", [])
    trigger_metrics = active_event["trigger_metrics"]

    start_dt = datetime.fromisoformat(during[0].timestamp)
    end_dt = datetime.fromisoformat(during[-1].timestamp)
    duration_seconds = (end_dt - start_dt).total_seconds() or config["check_interval_seconds"]

    past_events = correlate.load_recent_events(config["events_log_file"], config["congestion_lookback_days"])
    result = correlate.classify(before, during, after, trigger_metrics, duration_seconds, config, past_events)

    recovery = RecoveryPattern(
        resolved=True,
        duration_seconds=duration_seconds,
        recovery_style="sudden" if len(during) <= 1 else "gradual",
    )

    event = Event(
        event_id=str(uuid.uuid4()),
        start_time=during[0].timestamp,
        end_time=during[-1].timestamp,
        duration_seconds=duration_seconds,
        trigger_metrics=trigger_metrics,
        raw_metrics=during[0].to_dict(),
        timeline={
            "before": [r.to_dict() for r in before],
            "during": [r.to_dict() for r in during],
            "after": [r.to_dict() for r in after],
        },
        likely_cause=result["likely_cause"],
        confidence=result["confidence"],
        supporting_evidence=result["supporting_evidence"],
        recovery_pattern=recovery.to_dict(),
        suggested_next_action=result["suggested_next_action"],
        human_summary=result["human_summary"],
    )

    with open(config["events_log_file"], "a") as f:
        f.write(json.dumps(event.to_dict()) + "\n")

    print("\n" + "=" * 70)
    print(event.human_summary)
    print(f"Likely cause: {event.likely_cause}  (confidence: {event.confidence})")
    print(f"Suggested next action: {event.suggested_next_action}")
    print("=" * 70 + "\n")


def run(config):
    ensure_readings_log(config["readings_log_file"])
    print(f"Raw readings:      {os.path.abspath(config['readings_log_file'])}")
    print(f"Correlated events: {os.path.abspath(config['events_log_file'])}")

    router_host = config["router_ping_host"] or collectors.get_default_gateway()
    if router_host:
        print(f"Router/gateway hop: {router_host}")
    else:
        print("Could not detect a default gateway -- router-hop checks will be skipped.")
    print("Press Ctrl+C to stop.\n")

    history = deque(maxlen=config["history_before_readings"] + 2)
    active_event = None
    recovery_streak = 0
    last_speed_test = 0.0

    while True:
        do_speed_test = (time.monotonic() - last_speed_test) >= config["speed_test_interval_seconds"]
        if do_speed_test:
            last_speed_test = time.monotonic()

        reading = take_reading(config, router_host, do_speed_test)
        append_reading_csv(config["readings_log_file"], reading)
        print_reading(reading)

        breaches = correlate.evaluate_breaches(
            reading, config, router_known=bool(router_host), speed_tested=do_speed_test
        )
        is_bad = bool(breaches)

        if active_event is None and is_bad:
            before_window = list(history)[-config["history_before_readings"]:]
            active_event = {"before": before_window, "during": [reading], "trigger_metrics": breaches}
            recovery_streak = 0
        elif active_event is not None:
            if is_bad:
                active_event["during"].append(reading)
                recovery_streak = 0
            else:
                recovery_streak += 1
                active_event.setdefault("after", []).append(reading)
                if recovery_streak >= config["recovery_confirm_readings"]:
                    finalize_event(active_event, config)
                    active_event = None
                    recovery_streak = 0

        history.append(reading)
        time.sleep(config["check_interval_seconds"])


def main():
    parser = argparse.ArgumentParser(description="Monitor WiFi/internet quality locally and explain drops.")
    parser.add_argument("--config", default="config.json", help="Path to a JSON config file (optional).")
    args = parser.parse_args()

    config = load_config(args.config)
    try:
        run(config)
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
