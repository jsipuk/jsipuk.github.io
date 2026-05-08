import YahooFinance from "yahoo-finance2";
import type { PriceBar, KeyStats, AnalystRating, Ticker, PeerMove } from "@/types";
import type { ChartResultArrayQuote } from "yahoo-finance2/modules/chart";
import type { Quote } from "yahoo-finance2/modules/quote";

export type Range = "1d" | "5d" | "1mo" | "3mo" | "1y";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const INTERVAL_MAP: Record<Range, string> = {
  "1d": "5m",
  "5d": "15m",
  "1mo": "1d",
  "3mo": "1d",
  "1y": "1wk",
};

export async function fetchPriceHistory(symbol: string, range: Range): Promise<PriceBar[]> {
  const result = await yf.chart(symbol, {
    period1: rangeToDate(range),
    interval: INTERVAL_MAP[range] as Parameters<typeof yf.chart>[1]["interval"],
    return: "array",
  });

  return (result.quotes ?? [])
    .filter((q: ChartResultArrayQuote) => q.close != null)
    .map((q: ChartResultArrayQuote) => ({
      timestamp: new Date(q.date).getTime(),
      open: q.open ?? 0,
      high: q.high ?? 0,
      low: q.low ?? 0,
      close: q.close ?? 0,
      volume: q.volume ?? 0,
    }));
}

export async function fetchKeyStats(symbol: string): Promise<KeyStats> {
  const [quoteResult, summaryResult] = await Promise.allSettled([
    yf.quote(symbol),
    yf.quoteSummary(symbol, { modules: ["calendarEvents"] }),
  ]);

  const q = quoteResult.status === "fulfilled" ? quoteResult.value : null;
  const s = summaryResult.status === "fulfilled" ? summaryResult.value : null;

  const earningsDates = s?.calendarEvents?.earnings?.earningsDate;
  const nextEarnings =
    Array.isArray(earningsDates) && earningsDates.length > 0
      ? String(earningsDates[0])
      : null;

  return {
    currentPrice: q?.regularMarketPrice ?? null,
    previousClose: q?.regularMarketPreviousClose ?? null,
    dayChange: q?.regularMarketChange ?? null,
    dayChangePercent: q?.regularMarketChangePercent ?? null,
    marketCap: q?.marketCap ?? null,
    peRatio: q?.trailingPE ?? null,
    week52High: q?.fiftyTwoWeekHigh ?? null,
    week52Low: q?.fiftyTwoWeekLow ?? null,
    avgVolume: q?.averageDailyVolume3Month ?? null,
    shortFloat: null,
    beta: q?.beta ?? null,
    nextEarningsDate: nextEarnings,
  };
}

export async function fetchTickerInfo(symbol: string): Promise<Ticker> {
  const q = await yf.quote(symbol);
  return {
    symbol: q.symbol,
    name: q.longName ?? q.shortName ?? symbol,
    exchange: q.exchange ?? "",
    sector: (q as Record<string, unknown>)["sector"] as string ?? "",
    industry: (q as Record<string, unknown>)["industry"] as string ?? "",
  };
}

export async function fetchAnalystRatings(symbol: string): Promise<AnalystRating[]> {
  try {
    const summary = await yf.quoteSummary(symbol, {
      modules: ["upgradeDowngradeHistory"],
    });
    const history = (summary.upgradeDowngradeHistory?.history ?? []) as Array<Record<string, unknown>>;

    return history.slice(0, 10).map((item) => ({
      firm: (item.firm as string) ?? "Unknown",
      action: normaliseAction((item.action as string) ?? ""),
      fromRating: (item.fromGrade as string) || null,
      toRating: (item.toGrade as string) ?? "—",
      // v3 returns currentPriceTarget as a number
      priceTarget: (item.currentPriceTarget as number) || null,
      // v3: epochGradeDate is a Date object
      date: parseDate(item.epochGradeDate),
    }));
  } catch {
    return [];
  }
}

export async function fetchPeers(symbol: string): Promise<PeerMove[]> {
  try {
    const recs = await yf.recommendationsBySymbol(symbol);
    const allPeers = (recs.recommendedSymbols ?? []) as { symbol: string }[];

    // Filter out clearly invalid symbols: too short, contain dots (ADRs/foreign),
    // or look like OTC pink-sheet stubs (lowercase or 5+ chars with no vowels)
    const candidatePeers = allPeers
      .filter((p) => {
        const s = p.symbol;
        // Basic sanity: US exchange symbols are 1–5 uppercase letters
        return s.length >= 1 && s.length <= 5 && !s.includes(".") && !s.includes("-");
      })
      .slice(0, 10); // fetch more, then filter by real price

    const quotes = await Promise.allSettled(
      candidatePeers.map((p: { symbol: string }) => yf.quote(p.symbol))
    );

    return quotes
      .filter((r) => {
        if (r.status !== "fulfilled") return false;
        const q = (r as PromiseFulfilledResult<Quote>).value;
        // Must have a real price and be a regular equity quote type
        return (q.regularMarketPrice ?? 0) > 0 && q.quoteType === "EQUITY";
      })
      .slice(0, 6)
      .map((r) => {
        const q = (r as PromiseFulfilledResult<Quote>).value;
        return {
          symbol: q.symbol,
          name: q.shortName ?? q.symbol,
          changePercent: q.regularMarketChangePercent ?? 0,
        };
      });
  } catch {
    return [];
  }
}

function rangeToDate(range: Range): Date {
  const now = new Date();
  const msMap: Record<Range, number> = {
    "1d": 24 * 60 * 60 * 1000,
    "5d": 5 * 24 * 60 * 60 * 1000,
    "1mo": 30 * 24 * 60 * 60 * 1000,
    "3mo": 90 * 24 * 60 * 60 * 1000,
    "1y": 365 * 24 * 60 * 60 * 1000,
  };
  return new Date(now.getTime() - msMap[range]);
}

function parseDate(raw: unknown): string {
  if (raw instanceof Date) return raw.toISOString();
  if (typeof raw === "string") return new Date(raw).toISOString();
  if (typeof raw === "number") {
    // seconds if < year 2100 in ms threshold, else assume ms
    const ms = raw < 4102444800 ? raw * 1000 : raw;
    return new Date(ms).toISOString();
  }
  return new Date().toISOString();
}

function normaliseAction(action: string): AnalystRating["action"] {
  const a = action.toLowerCase();
  if (a.includes("up")) return "upgrade";
  if (a.includes("down")) return "downgrade";
  if (a.includes("init") || a.includes("start")) return "initiate";
  if (a.includes("reit") || a.includes("reaffirm")) return "reiterate";
  return "maintain";
}
