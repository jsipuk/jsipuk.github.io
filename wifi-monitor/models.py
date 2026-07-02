"""Data model for readings and correlated connection-quality events."""

from dataclasses import dataclass, field, asdict
from typing import Optional


@dataclass
class Reading:
    """A single point-in-time snapshot of connection health."""

    timestamp: str
    ssid: Optional[str] = None
    bssid: Optional[str] = None
    signal_percent: Optional[float] = None
    signal_dbm: Optional[float] = None
    router_ping_ms: Optional[float] = None
    public_ping_ms: Optional[float] = None
    dns_lookup_ms: Optional[float] = None
    download_mbps: Optional[float] = None

    def to_dict(self):
        return asdict(self)


@dataclass
class RecoveryPattern:
    resolved: bool
    duration_seconds: float
    recovery_style: str  # "sudden" | "gradual"

    def to_dict(self):
        return asdict(self)


@dataclass
class Event:
    """A correlated connection-quality event: what happened, why it likely
    happened, and what to do about it. This is the main output of the tool
    -- raw readings are just the evidence that feeds it."""

    event_id: str
    start_time: str
    end_time: str
    duration_seconds: float
    trigger_metrics: list
    raw_metrics: dict
    timeline: dict  # {"before": [...], "during": [...], "after": [...]}
    likely_cause: str
    confidence: str  # "high" | "medium" | "low"
    supporting_evidence: list
    recovery_pattern: dict
    suggested_next_action: str
    human_summary: str

    def to_dict(self):
        d = asdict(self)
        return d
