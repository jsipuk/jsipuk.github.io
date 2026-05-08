"use client";

import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import type { PriceBar } from "@/types";
import type { Range } from "@/lib/yahoo";
import { format } from "date-fns";

interface ChartData {
  time: string;
  close: number;
  volume: number;
  close2?: number;
}

interface Props {
  primary: PriceBar[];
  primarySymbol: string;
  secondary?: PriceBar[];
  secondarySymbol?: string;
  range: Range;
  onRangeChange: (r: Range) => void;
}

const RANGES: Range[] = ["1d", "5d", "1mo", "3mo", "1y"];
const RANGE_LABELS: Record<Range, string> = {
  "1d": "1D",
  "5d": "5D",
  "1mo": "1M",
  "3mo": "3M",
  "1y": "1Y",
};

function formatTime(timestamp: number, range: Range): string {
  const d = new Date(timestamp);
  if (range === "1d") return format(d, "HH:mm");
  if (range === "5d") return format(d, "EEE HH:mm");
  if (range === "1mo" || range === "3mo") return format(d, "MMM d");
  return format(d, "MMM yy");
}

function normalise(bars: PriceBar[]): number[] {
  if (bars.length === 0) return [];
  // Use first bar with a non-zero close as the base to avoid division by near-zero
  const base = bars.find((b) => b.close > 0)?.close ?? bars[0].close;
  if (!base) return bars.map(() => 0);
  return bars.map((b) => (b.close > 0 ? +((b.close / base - 1) * 100).toFixed(4) : 0));
}

function buildChartData(
  primary: PriceBar[],
  secondary: PriceBar[] | undefined,
  range: Range
): ChartData[] {
  const isComparison = secondary && secondary.length > 0;

  if (isComparison) {
    const normPrimary = normalise(primary);
    const normSecondary = normalise(secondary);
    return primary.map((bar, i) => ({
      time: formatTime(bar.timestamp, range),
      close: normPrimary[i] ?? 0,
      volume: bar.volume,
      close2: normSecondary[i] ?? undefined,
    }));
  }

  return primary.map((bar) => ({
    time: formatTime(bar.timestamp, range),
    close: bar.close,
    volume: bar.volume,
  }));
}

const CustomTooltip = ({
  active,
  payload,
  label,
  isComparison,
  primarySymbol,
  secondarySymbol,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string }>;
  label?: string;
  isComparison: boolean;
  primarySymbol: string;
  secondarySymbol?: string;
}) => {
  if (!active || !payload || payload.length === 0) return null;
  // Exclude the volume bar — only show price series
  const priceEntries = payload.filter((p) => p.dataKey === "close" || p.dataKey === "close2");
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm shadow-xl">
      <div className="text-gray-400 mb-1">{label}</div>
      {priceEntries.map((p) => (
        <div key={p.dataKey} className="flex gap-2">
          <span className="text-gray-300">
            {p.dataKey === "close" ? primarySymbol : secondarySymbol}:
          </span>
          <span className="text-white font-medium">
            {isComparison
              ? `${p.value >= 0 ? "+" : ""}${p.value.toFixed(2)}%`
              : `$${p.value.toFixed(2)}`}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function PriceChart({
  primary,
  primarySymbol,
  secondary,
  secondarySymbol,
  range,
  onRangeChange,
}: Props) {
  const isComparison = !!secondary && secondary.length > 0;
  const data = buildChartData(primary, secondary, range);

  if (data.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center justify-center h-64 text-gray-500">
        No price data available for this ticker and range.
      </div>
    );
  }

  const firstClose = primary[0]?.close ?? 0;
  const lastClose = primary[primary.length - 1]?.close ?? 0;
  const isUp = lastClose >= firstClose;
  const chartColor = isComparison ? "#6366f1" : isUp ? "#10b981" : "#ef4444";

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1">
          {isComparison && (
            <div className="flex gap-3 text-xs mr-4 items-center">
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-0.5 bg-indigo-400"></span>
                {primarySymbol}
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-0.5 bg-amber-400"></span>
                {secondarySymbol}
              </span>
              <span className="text-gray-500">% return</span>
            </div>
          )}
        </div>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => onRangeChange(r)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                range === r
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={chartColor} stopOpacity={0.25} />
              <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="price2Grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
          <XAxis
            dataKey="time"
            tick={{ fill: "#6b7280", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="price"
            orientation="right"
            tick={{ fill: "#6b7280", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => isComparison ? `${v.toFixed(1)}%` : `$${v.toFixed(0)}`}
            width={60}
          />
          <YAxis
            yAxisId="volume"
            orientation="left"
            tick={{ fill: "#374151", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => v >= 1e6 ? `${(v / 1e6).toFixed(0)}M` : `${(v / 1e3).toFixed(0)}K`}
            width={40}
          />
          <Tooltip
            content={
              <CustomTooltip
                isComparison={isComparison}
                primarySymbol={primarySymbol}
                secondarySymbol={secondarySymbol}
              />
            }
          />
          {isComparison && <ReferenceLine yAxisId="price" y={0} stroke="#374151" strokeDasharray="4 4" />}
          <Bar yAxisId="volume" dataKey="volume" fill="#1f2937" radius={[2, 2, 0, 0]} maxBarSize={8} />
          <Area
            yAxisId="price"
            type="monotone"
            dataKey="close"
            stroke={chartColor}
            strokeWidth={2}
            fill="url(#priceGrad)"
            dot={false}
            activeDot={{ r: 4, fill: chartColor }}
          />
          {isComparison && (
            <Area
              yAxisId="price"
              type="monotone"
              dataKey="close2"
              stroke="#f59e0b"
              strokeWidth={2}
              fill="url(#price2Grad)"
              dot={false}
              activeDot={{ r: 4, fill: "#f59e0b" }}
            />
          )}
          {isComparison && <Legend />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
