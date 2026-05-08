"use client";

import type { KeyStats, Ticker } from "@/types";

function fmt(n: number | null, decimals = 2): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtLarge(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

interface Props {
  ticker: Ticker;
  stats: KeyStats;
  secondary?: { ticker: Ticker; stats: KeyStats };
}

export default function PriceStrip({ ticker, stats, secondary }: Props) {
  const isUp = (stats.dayChange ?? 0) >= 0;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
      <div className="flex flex-wrap items-start gap-x-8 gap-y-3">

        {/* Primary ticker identity + price */}
        <div className="flex items-baseline gap-3 flex-wrap">
          <div>
            <span className="text-2xl font-bold text-white tracking-tight">
              ${fmt(stats.currentPrice)}
            </span>
            <span
              className={`ml-2 text-sm font-semibold px-2 py-0.5 rounded ${
                isUp ? "text-emerald-400 bg-emerald-950" : "text-red-400 bg-red-950"
              }`}
            >
              {isUp ? "+" : ""}${fmt(stats.dayChange)} ({isUp ? "+" : ""}{fmt(stats.dayChangePercent)}%)
            </span>
          </div>
          <div className="text-sm text-gray-400">
            <span className="font-semibold text-gray-200">{ticker.symbol}</span>
            <span className="mx-1.5 text-gray-600">·</span>
            {ticker.name}
            {ticker.exchange && (
              <span className="ml-1.5 text-gray-600 text-xs">{ticker.exchange}</span>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="hidden lg:block w-px self-stretch bg-gray-800" />

        {/* Key stats in a row */}
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Stat label="Mkt Cap" value={fmtLarge(stats.marketCap)} />
          <Stat
            label="52W Range"
            value={
              stats.week52Low != null && stats.week52High != null
                ? `$${fmt(stats.week52Low)} – $${fmt(stats.week52High)}`
                : "—"
            }
          />
          <Stat label="P/E" value={stats.peRatio != null ? fmt(stats.peRatio, 1) : "—"} />
          <Stat label="Beta" value={stats.beta != null ? fmt(stats.beta, 2) : "—"} />
          <Stat
            label="Next Earnings"
            value={
              stats.nextEarningsDate
                ? new Date(stats.nextEarningsDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                : "—"
            }
            highlight={!!stats.nextEarningsDate}
          />
          {ticker.sector && (
            <Stat label="Sector" value={ticker.sector} />
          )}
        </div>

        {/* Secondary ticker comparison strip */}
        {secondary && (
          <>
            <div className="hidden lg:block w-px self-stretch bg-gray-800" />
            <SecondaryStrip ticker={secondary.ticker} stats={secondary.stats} />
          </>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-gray-500 text-xs">{label}</span>
      <span className={`text-sm font-medium ${highlight ? "text-amber-400" : "text-gray-100"}`}>
        {value}
      </span>
    </div>
  );
}

function SecondaryStrip({ ticker, stats }: { ticker: Ticker; stats: KeyStats }) {
  const isUp = (stats.dayChange ?? 0) >= 0;
  return (
    <div className="flex items-baseline gap-3 flex-wrap">
      <div>
        <span className="text-lg font-bold text-amber-300 tracking-tight">
          vs ${fmt(stats.currentPrice)}
        </span>
        <span
          className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded ${
            isUp ? "text-emerald-400 bg-emerald-950" : "text-red-400 bg-red-950"
          }`}
        >
          {isUp ? "+" : ""}{fmt(stats.dayChangePercent)}%
        </span>
      </div>
      <div className="text-sm text-gray-400">
        <span className="font-semibold text-gray-200">{ticker.symbol}</span>
        <span className="mx-1.5 text-gray-600">·</span>
        {ticker.name}
      </div>
    </div>
  );
}
