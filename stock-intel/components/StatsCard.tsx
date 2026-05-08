"use client";

import type { KeyStats, Ticker } from "@/types";

function fmt(n: number | null, prefix = "", decimals = 2): string {
  if (n == null) return "—";
  return `${prefix}${n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function fmtLarge(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

function fmtVol(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

interface Props {
  ticker: Ticker;
  stats: KeyStats;
}

export default function StatsCard({ ticker, stats }: Props) {
  const isPositive = (stats.dayChange ?? 0) >= 0;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="mb-4">
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-bold text-white">
            {fmt(stats.currentPrice, "$")}
          </span>
          <span
            className={`text-sm font-semibold px-2 py-0.5 rounded ${
              isPositive
                ? "text-emerald-400 bg-emerald-950"
                : "text-red-400 bg-red-950"
            }`}
          >
            {isPositive ? "+" : ""}
            {fmt(stats.dayChange, "$")} ({isPositive ? "+" : ""}
            {fmt(stats.dayChangePercent, "", 2)}%)
          </span>
        </div>
        <div className="text-gray-400 text-sm mt-1">
          {ticker.name} · {ticker.exchange}
        </div>
        {ticker.sector && (
          <div className="text-gray-500 text-xs mt-0.5">{ticker.sector} · {ticker.industry}</div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <StatRow label="Market Cap" value={fmtLarge(stats.marketCap)} />
        <StatRow label="P/E Ratio" value={fmt(stats.peRatio)} />
        <StatRow label="52W High" value={fmt(stats.week52High, "$")} />
        <StatRow label="52W Low" value={fmt(stats.week52Low, "$")} />
        <StatRow label="Avg Volume" value={fmtVol(stats.avgVolume)} />
        <StatRow label="Beta" value={fmt(stats.beta)} />
        <StatRow
          label="Next Earnings"
          value={
            stats.nextEarningsDate
              ? new Date(stats.nextEarningsDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "—"
          }
        />
        <StatRow label="Prev Close" value={fmt(stats.previousClose, "$")} />
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-gray-500 text-xs uppercase tracking-wide">{label}</span>
      <span className="text-gray-100 font-medium">{value}</span>
    </div>
  );
}
