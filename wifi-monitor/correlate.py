"""Root-cause correlation engine.

The tool's main value isn't the raw metrics -- it's turning "latency spiked
at 19:42" into "this looks like an ISP issue, not a WiFi problem, because
the router hop was fine and the public hop wasn't." This module holds the
heuristics that make that call, in priority order: a disconnect explains
everything else, so it's checked first; a plausible-but-unconfirmed guess
(unclassified) is the last resort.
"""

import json
import os
from datetime import datetime, timedelta

ACTIONS = {
    "full_disconnect": "Check that WiFi is turned on and connected. If this keeps happening, check your adapter/driver or your distance from the router.",
    "weak_wifi_signal": "Move closer to the router, clear physical obstructions, or add a WiFi extender/mesh node for this area.",
    "router_local_issue": "Restart your router/modem and check how many devices are on the local network. A firmware update may also help.",
    "dns_issue": "Try switching to a different DNS server (e.g. 1.1.1.1 or 8.8.8.8) in your network settings.",
    "isp_upstream_issue": "This looks upstream of your home network -- check your ISP's status page or contact support.",
    "network_congestion": "This keeps recurring around the same time of day -- likely local or ISP congestion at peak hours. Consider QoS settings, a different WiFi channel, or shifting heavy usage outside this window.",
    "roaming": "Your device is switching access points/mesh nodes around this time. Check mesh node placement, or try disabling band-steering if it keeps causing drops.",
    "unclassified": "Not enough corroborating evidence to pin down a cause -- review the raw readings for this window manually.",
}


def evaluate_breaches(reading, config, router_known, speed_tested):
    """Return the list of metric names that are in breach for this reading.

    A None value for router/public ping or DNS means that hop failed
    outright (timeout/no reply), which is itself a breach -- not a missing
    measurement -- except for router ping when we never found a gateway to
    test against in the first place.
    """
    if (
        reading.ssid is None
        and reading.bssid is None
        and reading.signal_percent is None
        and reading.router_ping_ms is None
        and reading.public_ping_ms is None
    ):
        return ["full_disconnect"]

    breaches = []
    if reading.signal_percent is not None and reading.signal_percent < config["signal_threshold_percent"]:
        breaches.append("signal_percent")
    if router_known and (reading.router_ping_ms is None or reading.router_ping_ms > config["router_ping_threshold_ms"]):
        breaches.append("router_ping_ms")
    if reading.public_ping_ms is None or reading.public_ping_ms > config["public_ping_threshold_ms"]:
        breaches.append("public_ping_ms")
    if reading.dns_lookup_ms is None or reading.dns_lookup_ms > config["dns_lookup_threshold_ms"]:
        breaches.append("dns_lookup_ms")
    if speed_tested and reading.download_mbps is not None and reading.download_mbps < config["download_threshold_mbps"]:
        breaches.append("download_mbps")
    return breaches


def load_recent_events(path, lookback_days):
    if not os.path.exists(path):
        return []
    cutoff = datetime.now() - timedelta(days=lookback_days)
    events = []
    with open(path, "r") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                event = json.loads(line)
                start = datetime.fromisoformat(event["start_time"])
            except (json.JSONDecodeError, KeyError, ValueError):
                continue
            if start >= cutoff:
                events.append(event)
    return events


def _fmt_duration(seconds):
    seconds = max(0, int(seconds))
    minutes, secs = divmod(seconds, 60)
    if minutes:
        return f"{minutes}m {secs}s"
    return f"{secs}s"


def _fmt_time(iso_timestamp):
    return datetime.fromisoformat(iso_timestamp).strftime("%H:%M")


def _signal_desc(reading):
    if reading.signal_dbm is not None:
        return f"{reading.signal_dbm} dBm"
    if reading.signal_percent is not None:
        return f"{reading.signal_percent}%"
    return "unknown"


def _signal_breached_first(before, during, config):
    """True if the earliest signal-threshold breach in the timeline happened
    at or before the earliest router/public-ping breach -- i.e. weak signal
    led the problem rather than following it."""
    combined = before + during
    signal_idx = next(
        (i for i, r in enumerate(combined) if r.signal_percent is not None and r.signal_percent < config["signal_threshold_percent"]),
        None,
    )
    if signal_idx is None:
        return False
    other_idx = next(
        (
            i for i, r in enumerate(combined)
            if (r.public_ping_ms is not None and r.public_ping_ms > config["public_ping_threshold_ms"])
            or (r.router_ping_ms is not None and r.router_ping_ms > config["router_ping_threshold_ms"])
        ),
        None,
    )
    return other_idx is None or signal_idx <= other_idx


def _signal_held_steady(reading, config):
    return reading.signal_percent is not None and reading.signal_percent >= config["signal_threshold_percent"]


def _check_recurrence(start_time_iso, past_events, config):
    """Has this same kind of upstream problem shown up around this time of
    day on other days recently? If so, it's congestion, not a one-off."""
    start = datetime.fromisoformat(start_time_iso)
    window = timedelta(minutes=config["congestion_time_window_minutes"])
    same_time_count = 0
    for event in past_events:
        if event.get("likely_cause") not in ("isp_upstream_issue", "network_congestion"):
            continue
        try:
            other_start = datetime.fromisoformat(event["start_time"])
        except (KeyError, ValueError):
            continue
        if other_start.date() == start.date():
            continue  # only count occurrences on *other* days
        other_time_today = other_start.replace(year=start.year, month=start.month, day=start.day)
        if abs(other_time_today - start) <= window:
            same_time_count += 1
    return same_time_count >= (config["congestion_min_occurrences"] - 1)


def classify(before, during, after, trigger_metrics, duration_seconds, config, past_events):
    """Return {likely_cause, confidence, supporting_evidence, suggested_next_action, human_summary}."""
    first, last = during[0], during[-1]
    time_str = _fmt_time(first.timestamp)
    duration_str = _fmt_duration(duration_seconds)
    evidence = []

    if trigger_metrics == ["full_disconnect"]:
        cause, confidence = "full_disconnect", "high"
        evidence.append("WiFi signal, router ping, and public ping were all unavailable at the same time.")
        summary = f"At {time_str}, the connection dropped entirely for {duration_str} -- WiFi, router, and internet checks all failed together, pointing to a full disconnect rather than a partial slowdown."

    elif (
        before and first.bssid and before[-1].bssid
        and before[-1].bssid != first.bssid
        and before[-1].ssid == first.ssid
        and before[-1].ssid
    ):
        cause, confidence = "roaming", "medium"
        evidence.append(
            f"Access point changed from {before[-1].bssid} to {first.bssid} while staying on SSID '{first.ssid}', "
            f"shortly before the drop at {time_str}."
        )
        summary = (
            f"At {time_str}, performance dipped for {duration_str} right after the device switched access points "
            f"(same SSID '{first.ssid}', different BSSID) -- this looks like a roaming handoff, not a coverage problem."
        )

    elif "signal_percent" in trigger_metrics and _signal_breached_first(before, during, config):
        confidence = "high" if len(trigger_metrics) == 1 or ("public_ping_ms" not in trigger_metrics and "router_ping_ms" not in trigger_metrics) else "medium"
        cause = "weak_wifi_signal"
        evidence.append(
            f"WiFi signal fell to {_signal_desc(first)} (threshold {config['signal_threshold_percent']}%) "
            f"at or before other metrics degraded."
        )
        summary = (
            f"At {time_str}, WiFi signal dropped to {_signal_desc(first)} for {duration_str}, ahead of any "
            f"latency or speed problems -- this looks like a WiFi coverage issue rather than an upstream one."
        )

    elif "router_ping_ms" in trigger_metrics and _signal_held_steady(first, config):
        cause, confidence = "router_local_issue", "high"
        router_desc = "did not respond" if first.router_ping_ms is None else f"rose to {first.router_ping_ms:.0f} ms"
        evidence.append(f"Router ping {router_desc} while WiFi signal held steady at {_signal_desc(first)}.")
        summary = (
            f"At {time_str}, ping to the router {router_desc} for {duration_str} while WiFi signal stayed strong "
            f"at {_signal_desc(first)}, so this looks like a local router/network issue rather than a WiFi or ISP problem."
        )

    elif "dns_lookup_ms" in trigger_metrics and "public_ping_ms" not in trigger_metrics:
        cause, confidence = "dns_issue", "high"
        dns_desc = "failed to resolve" if first.dns_lookup_ms is None else f"took {first.dns_lookup_ms:.0f} ms"
        evidence.append(f"DNS lookup {dns_desc} while raw ping to a public IP stayed within normal range.")
        summary = (
            f"At {time_str}, DNS lookups {dns_desc} for {duration_str} even though raw ping to a public IP "
            f"({first.public_ping_ms:.0f} ms) was fine, so this looks like a DNS issue rather than a general connectivity problem."
        )

    elif (
        ("public_ping_ms" in trigger_metrics or "download_mbps" in trigger_metrics)
        and "router_ping_ms" not in trigger_metrics
        and _signal_held_steady(first, config)
    ):
        recurring = _check_recurrence(first.timestamp, past_events, config)
        if recurring:
            cause, confidence = "network_congestion", "medium"
            evidence.append("This same pattern (router fine, public/speed degraded) has occurred around this time of day on other recent days.")
            summary = (
                f"At {time_str}, internet latency/speed degraded for {duration_str} while WiFi signal and router "
                f"ping stayed normal. This has happened around the same time of day before, so it looks like recurring congestion "
                f"rather than a one-off ISP outage."
            )
        else:
            cause, confidence = "isp_upstream_issue", "medium"
            router_desc = f"{first.router_ping_ms:.0f} ms" if first.router_ping_ms is not None else "normal"
            evidence.append(f"Router ping stayed normal ({router_desc}) while public ping/speed degraded.")
            summary = (
                f"At {time_str}, internet latency rose to {first.public_ping_ms:.0f} ms for {duration_str}. "
                f"WiFi signal stayed strong at {_signal_desc(first)} and router ping remained normal, so this looks more "
                f"like an ISP or upstream internet issue than a WiFi coverage problem."
            )

    else:
        cause, confidence = "unclassified", "low"
        evidence.append(f"Breached metrics: {', '.join(trigger_metrics)}. No single-cause pattern matched confidently.")
        summary = (
            f"At {time_str}, {', '.join(trigger_metrics)} degraded for {duration_str}, but the pattern doesn't "
            f"clearly match a known cause -- check the raw readings for this window."
        )

    return {
        "likely_cause": cause,
        "confidence": confidence,
        "supporting_evidence": evidence,
        "suggested_next_action": ACTIONS[cause],
        "human_summary": summary,
    }
