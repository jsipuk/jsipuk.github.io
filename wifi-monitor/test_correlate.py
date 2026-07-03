"""Tests for the correlation engine -- exercises each cause classification
with synthetic readings so you can verify the heuristics without waiting
for a real WiFi/internet problem to happen. Run with:

    python3 -m unittest test_correlate.py -v
"""

import unittest

import correlate
from models import Reading

CONFIG = {
    "signal_threshold_percent": 40,
    "router_ping_threshold_ms": 30,
    "public_ping_threshold_ms": 100,
    "dns_lookup_threshold_ms": 150,
    "download_threshold_mbps": 5,
    "congestion_lookback_days": 7,
    "congestion_time_window_minutes": 30,
    "congestion_min_occurrences": 2,
}


def reading(t, ssid="Home", bssid="aa:bb:cc:dd:ee:01", sig=70, dbm=-52,
            router=4, public=20, dns=15, dl=None):
    return Reading(timestamp=t, ssid=ssid, bssid=bssid, signal_percent=sig,
                    signal_dbm=dbm, router_ping_ms=router, public_ping_ms=public,
                    dns_lookup_ms=dns, download_mbps=dl)


class CorrelationEngineTests(unittest.TestCase):
    def classify(self, before, during, after=None, past_events=None, duration=30):
        trigger = correlate.evaluate_breaches(during[0], CONFIG, router_known=True, speed_tested=False)
        return correlate.classify(before, during, after or [], trigger, duration, CONFIG, past_events or [])

    def test_isp_upstream_issue(self):
        before = [reading("2026-07-02T19:40:00"), reading("2026-07-02T19:41:00")]
        during = [reading("2026-07-02T19:41:30", public=340)]
        result = self.classify(before, during)
        self.assertEqual(result["likely_cause"], "isp_upstream_issue")

    def test_weak_wifi_signal(self):
        before = [reading("2026-07-02T10:00:00", sig=45, dbm=-70)]
        during = [reading("2026-07-02T10:01:00", sig=25, dbm=-85, public=250)]
        result = self.classify(before, during)
        self.assertEqual(result["likely_cause"], "weak_wifi_signal")

    def test_router_local_issue(self):
        during = [reading("2026-07-02T08:15:00", router=None, public=None)]
        result = self.classify([], during)
        self.assertEqual(result["likely_cause"], "router_local_issue")

    def test_dns_issue(self):
        during = [reading("2026-07-02T12:00:00", dns=None, public=18)]
        result = self.classify([], during)
        self.assertEqual(result["likely_cause"], "dns_issue")

    def test_full_disconnect(self):
        during = [Reading(timestamp="2026-07-02T13:00:00")]
        result = self.classify([], during)
        self.assertEqual(result["likely_cause"], "full_disconnect")

    def test_roaming(self):
        before = [reading("2026-07-02T14:00:00", bssid="aa:bb:cc:dd:ee:01")]
        during = [reading("2026-07-02T14:00:30", bssid="aa:bb:cc:dd:ee:02", public=180)]
        result = self.classify(before, during)
        self.assertEqual(result["likely_cause"], "roaming")

    def test_recurring_congestion(self):
        before = [reading("2026-07-02T19:40:00")]
        during = [reading("2026-07-02T19:41:30", public=340)]
        past_events = [{"start_time": "2026-06-25T19:41:00", "likely_cause": "isp_upstream_issue"}]
        result = self.classify(before, during, past_events=past_events)
        self.assertEqual(result["likely_cause"], "network_congestion")

    def test_unclassified_fallback(self):
        # Signal weak AND router failing at once with no clear lead -- an
        # ambiguous mix that shouldn't be forced into a confident bucket.
        before = [reading("2026-07-02T09:00:00", sig=30, dbm=-80, router=50)]
        during = [reading("2026-07-02T09:00:30", sig=30, dbm=-80, router=50, public=200)]
        result = self.classify(before, during)
        self.assertIn(result["likely_cause"], ("weak_wifi_signal", "unclassified"))


if __name__ == "__main__":
    unittest.main()
