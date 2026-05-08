"use client";

import type { PriceDriver } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { GlossaryText } from "./Glossary";

const CATEGORY_LABEL: Record<string, string> = {
  earnings: "Earnings",
  analyst: "Analyst",
  news: "News",
  macro: "Macro",
  sector: "Sector",
  volume_anomaly: "Volume",
  filing: "Filing",
  insider: "Insider",
};

const DIRECTION_CONFIG = {
  bullish: { label: "Bullish", color: "text-emerald-400", dot: "bg-emerald-400" },
  bearish: { label: "Bearish", color: "text-red-400", dot: "bg-red-400" },
  neutral: { label: "Neutral", color: "text-gray-400", dot: "bg-gray-500" },
};

const CONFIDENCE_CONFIG = {
  high:   { label: "High signal",   bar: "bg-emerald-500", width: "w-full" },
  medium: { label: "Medium signal", bar: "bg-amber-500",   width: "w-2/3" },
  low:    { label: "Low signal",    bar: "bg-gray-600",    width: "w-1/3" },
};

interface Props {
  drivers: PriceDriver[];
  title?: string;
}

export default function DriversPanel({ drivers, title = "Possible Price Drivers" }: Props) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-white font-semibold text-base">{title}</h2>
          <p className="text-gray-500 text-xs mt-0.5">
            Correlated events — not confirmed causes
          </p>
        </div>
        <span
          title="These are correlated events, not investment advice."
          className="text-xs text-gray-600 border border-gray-700 rounded px-2 py-0.5 cursor-help shrink-0"
        >
          Not financial advice
        </span>
      </div>

      {drivers.length === 0 ? (
        <div className="text-gray-500 text-sm py-8 text-center">
          No significant signals detected in the current data window.
          <br />
          <span className="text-gray-600 text-xs mt-1 block">
            Try a wider date range, or signals may appear as more data arrives.
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {drivers.map((driver) => (
            <DriverCard key={driver.id} driver={driver} />
          ))}
        </div>
      )}
    </div>
  );
}

function DriverCard({ driver }: { driver: PriceDriver }) {
  const dir = DIRECTION_CONFIG[driver.direction];
  const conf = CONFIDENCE_CONFIG[driver.confidence];
  const categoryLabel = CATEGORY_LABEL[driver.category] ?? driver.category;

  return (
    <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 flex flex-col gap-3 hover:border-gray-700 transition-colors">

      {/* Top row: category pill + direction + age */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-800 text-gray-300">
            {categoryLabel}
          </span>
          <span className={`flex items-center gap-1 text-xs font-medium ${dir.color}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${dir.dot}`} />
            {dir.label}
          </span>
        </div>
        <span className="text-gray-600 text-xs shrink-0">
          {formatDistanceToNow(new Date(driver.occurredAt), { addSuffix: true })}
        </span>
      </div>

      {/* Title */}
      <p className="text-gray-100 text-sm font-medium leading-snug">{driver.title}</p>

      {/* Description */}
      <p className="text-gray-400 text-xs leading-relaxed">
        <GlossaryText text={driver.description} />
      </p>

      {/* Signal strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${conf.bar} ${conf.width}`} />
        </div>
        <span className="text-gray-600 text-xs shrink-0">{conf.label}</span>
      </div>

      {/* Sources */}
      {driver.sources.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {driver.sources.map((src, i) => (
            <a
              key={i}
              href={src.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300 text-xs"
            >
              {src.label} ↗
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
