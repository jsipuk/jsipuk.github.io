import { NextRequest, NextResponse } from "next/server";
import { withCache } from "@/lib/cache";
import {
  fetchPriceHistory,
  fetchKeyStats,
  fetchTickerInfo,
  fetchAnalystRatings,
  fetchPeers,
  type Range,
} from "@/lib/yahoo";
import { fetchNews as fetchPolygonNews } from "@/lib/polygon";
import { fetchAvNews } from "@/lib/alphavantage";
import { fetchMacroIndicators } from "@/lib/fred";
import { fetchRecentFilings } from "@/lib/edgar";
import { scoreDrivers } from "@/lib/drivers";
import type { NewsItem, TickerAnalysis } from "@/types";

function mergeNews(a: NewsItem[], b: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  const combined = [...a, ...b].filter((item) => {
    // Deduplicate by URL normalised to path (strips tracking params)
    const key = item.url.split("?")[0].toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  // Sort newest first
  return combined.sort(
    (x, y) => new Date(y.publishedAt).getTime() - new Date(x.publishedAt).getTime()
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const symbol = (searchParams.get("symbol") ?? "").toUpperCase().trim();
  const range = (searchParams.get("range") ?? "1mo") as Range;

  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }

  const cacheKey = `analysis:${symbol}:${range}`;
  const ttl = range === "1d" ? 300 : 900;

  try {
    const data = await withCache<TickerAnalysis>(cacheKey, ttl, async () => {
      const [
        ticker, priceHistory, stats,
        polygonNews, avNews,
        analystRatings, peers, macro, filings,
      ] = await Promise.allSettled([
        fetchTickerInfo(symbol),
        fetchPriceHistory(symbol, range),
        fetchKeyStats(symbol),
        fetchPolygonNews(symbol),
        fetchAvNews(symbol),
        fetchAnalystRatings(symbol),
        fetchPeers(symbol),
        fetchMacroIndicators(),
        fetchRecentFilings(symbol),
      ]);

      const resolvedTicker =
        ticker.status === "fulfilled"
          ? ticker.value
          : { symbol, name: symbol, exchange: "", sector: "", industry: "" };

      const resolvedHistory =
        priceHistory.status === "fulfilled" ? priceHistory.value : [];

      const resolvedStats =
        stats.status === "fulfilled"
          ? stats.value
          : {
              currentPrice: null, previousClose: null,
              dayChange: null, dayChangePercent: null,
              marketCap: null, peRatio: null,
              week52High: null, week52Low: null,
              avgVolume: null, shortFloat: null,
              beta: null, nextEarningsDate: null,
            };

      const resolvedNews = mergeNews(
        polygonNews.status === "fulfilled" ? polygonNews.value : [],
        avNews.status === "fulfilled" ? avNews.value : []
      );

      const resolvedRatings =
        analystRatings.status === "fulfilled" ? analystRatings.value : [];
      const resolvedPeers = peers.status === "fulfilled" ? peers.value : [];
      const resolvedMacro = macro.status === "fulfilled" ? macro.value : [];
      const resolvedFilings = filings.status === "fulfilled" ? filings.value : [];

      const drivers = scoreDrivers({
        symbol,
        priceHistory: resolvedHistory,
        stats: resolvedStats,
        news: resolvedNews,
        analystRatings: resolvedRatings,
        filings: resolvedFilings,
      });

      return {
        ticker: resolvedTicker,
        priceHistory: resolvedHistory,
        stats: resolvedStats,
        news: resolvedNews,
        analystRatings: resolvedRatings,
        drivers,
        peers: resolvedPeers,
        macro: resolvedMacro,
        fetchedAt: new Date().toISOString(),
      };
    });

    return NextResponse.json(data);
  } catch (err) {
    console.error(`[analysis] ${symbol}`, err);
    return NextResponse.json(
      { error: "Failed to fetch data. The ticker may be invalid or the data source is unavailable." },
      { status: 500 }
    );
  }
}
