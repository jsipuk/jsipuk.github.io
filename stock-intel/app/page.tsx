"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import type { TickerAnalysis } from "@/types";
import type { Range } from "@/lib/yahoo";
import PriceChart from "@/components/PriceChart";
import PriceStrip from "@/components/PriceStrip";
import DriversPanel from "@/components/DriversPanel";
import NewsPanel from "@/components/NewsPanel";
import AnalystTable from "@/components/AnalystTable";
import ContextSidebar from "@/components/ContextSidebar";
import TickerSearch from "@/components/TickerSearch";
import LoadingSkeleton from "@/components/LoadingSkeleton";

async function fetchAnalysis(symbol: string, range: Range): Promise<TickerAnalysis> {
  const res = await fetch(`/api/analysis?symbol=${encodeURIComponent(symbol)}&range=${range}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to fetch data");
  }
  return res.json();
}

export default function Home() {
  const [primarySymbol, setPrimarySymbol] = useState("NTSK");
  const [secondarySymbol, setSecondarySymbol] = useState("");
  const [primaryInput, setPrimaryInput] = useState("NTSK");
  const [secondaryInput, setSecondaryInput] = useState("");
  const [range, setRange] = useState<Range>("1mo");
  const [showSecondary, setShowSecondary] = useState(false);

  const primary = useQuery({
    queryKey: ["analysis", primarySymbol, range],
    queryFn: () => fetchAnalysis(primarySymbol, range),
    enabled: !!primarySymbol,
    staleTime: 5 * 60 * 1000,
  });

  const secondary = useQuery({
    queryKey: ["analysis", secondarySymbol, range],
    queryFn: () => fetchAnalysis(secondarySymbol, range),
    enabled: showSecondary && !!secondarySymbol,
    staleTime: 5 * 60 * 1000,
  });

  const handlePrimarySubmit = useCallback((val: string) => setPrimarySymbol(val), []);
  const handleSecondarySubmit = useCallback((val: string) => setSecondarySymbol(val), []);

  const addSecondTicker = () => {
    setShowSecondary(true);
    setSecondarySymbol(secondaryInput || "");
  };

  const removeSecondTicker = () => {
    setShowSecondary(false);
    setSecondarySymbol("");
    setSecondaryInput("");
  };

  const data = primary.data;
  const secData = secondary.data;
  const isLoading = primary.isLoading;
  const error = primary.error;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">

      {/* ── Header ── */}
      <header className="border-b border-gray-800 bg-gray-950 sticky top-0 z-20">
        <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <span className="text-indigo-400 font-bold text-base mr-1">Stock Intel</span>

          <TickerSearch
            value={primaryInput}
            onChange={setPrimaryInput}
            onSubmit={handlePrimarySubmit}
            placeholder="Ticker (e.g. NTSK)"
          />

          {showSecondary ? (
            <TickerSearch
              value={secondaryInput}
              onChange={setSecondaryInput}
              onSubmit={handleSecondarySubmit}
              placeholder="Compare ticker"
              onRemove={removeSecondTicker}
            />
          ) : (
            <button
              onClick={addSecondTicker}
              className="text-gray-500 hover:text-gray-300 text-sm border border-gray-700 hover:border-gray-600 rounded-lg px-3 py-1.5 transition-colors"
            >
              + Compare
            </button>
          )}

          {data && (
            <div className="ml-auto flex items-center gap-3 text-xs text-gray-600">
              <span>
                {new Date(data.fetchedAt).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <button
                onClick={() => primary.refetch()}
                className="text-indigo-500 hover:text-indigo-400 transition-colors"
              >
                Refresh ↺
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 py-5">

        {error && !isLoading && (
          <div className="bg-red-950 border border-red-800 rounded-xl p-4 text-red-400 text-sm mb-4">
            <strong>Error:</strong> {error.message}
          </div>
        )}

        {isLoading && <LoadingSkeleton />}

        {data && !isLoading && (
          <div className="space-y-4">

            {/* 1. Price strip — who is this and where is it today */}
            <PriceStrip
              ticker={data.ticker}
              stats={data.stats}
              secondary={secData ? { ticker: secData.ticker, stats: secData.stats } : undefined}
            />

            {/* 2. Chart — full width hero */}
            <PriceChart
              primary={data.priceHistory}
              primarySymbol={primarySymbol}
              secondary={secData?.priceHistory}
              secondarySymbol={secondarySymbol || undefined}
              range={range}
              onRangeChange={setRange}
            />

            {/* 3. Drivers — the whole point of the app */}
            <DriversPanel drivers={data.drivers} />

            {/* 4. News full width */}
            <NewsPanel news={data.news} />

            {/* 5. Analyst ratings + market context side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <AnalystTable ratings={data.analystRatings} />
              <ContextSidebar peers={data.peers} macro={data.macro} />
            </div>

            {/* 6. Secondary ticker drivers when comparing */}
            {secData && secData.drivers.length > 0 && (
              <DriversPanel
                drivers={secData.drivers}
                title={`${secondarySymbol} — Possible Drivers`}
              />
            )}

          </div>
        )}

        {!data && !isLoading && !error && (
          <div className="flex flex-col items-center justify-center py-32 text-gray-600">
            <div className="text-5xl mb-5">📈</div>
            <div className="text-xl font-medium text-gray-400 mb-2">Enter a ticker to get started</div>
            <div className="text-sm text-gray-600">Try NTSK, AAPL, CRWD, or any US-listed stock</div>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-800 py-3 px-4 mt-4">
        <p className="text-gray-700 text-xs text-center max-w-2xl mx-auto">
          Stock Intel identifies events correlated with price movements — not confirmed causes.
          Nothing here is investment advice. Data may be delayed or incomplete.
        </p>
      </footer>
    </div>
  );
}
