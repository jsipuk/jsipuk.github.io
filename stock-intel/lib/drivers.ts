import type {
  PriceDriver,
  PriceBar,
  KeyStats,
  NewsItem,
  AnalystRating,
  DriverDirection,
  DriverConfidence,
} from "@/types";
import type { EdgarFiling } from "./edgar";

interface DriverInput {
  symbol: string;
  priceHistory: PriceBar[];
  stats: KeyStats;
  news: NewsItem[];
  analystRatings: AnalystRating[];
  filings: EdgarFiling[];
}

export function scoreDrivers(input: DriverInput): PriceDriver[] {
  const drivers: PriceDriver[] = [];
  let idCounter = 0;
  const nextId = () => String(++idCounter);

  // --- Volume anomaly ---
  const volumeDriver = detectVolumeAnomaly(input.priceHistory, input.stats, nextId());
  if (volumeDriver) drivers.push(volumeDriver);

  // --- Analyst rating changes (last 30 days) ---
  const recentRatings = input.analystRatings.filter((r) => {
    const date = new Date(r.date);
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return date >= cutoff;
  });
  for (const rating of recentRatings) {
    drivers.push(analystDriver(rating, nextId()));
  }

  // --- Recent SEC filings (last 48h) ---
  const recentFilings = input.filings.filter((f) => {
    const date = new Date(f.filedAt);
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    return date >= cutoff;
  });
  for (const filing of recentFilings) {
    drivers.push(filingDriver(filing, nextId()));
  }

  // --- News: 30-day editorial window, 60-day insider window ---
  const cutoff30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const cutoff60 = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

  const insiderKeywords = /\b(rsu|insider|class [ab]|vesting|rsu-linked|form.?4|shares? (withheld|exercised|converted|sold|purchased))\b/i;

  const allSymbolNews = input.news.filter((n) => n.tickers.includes(input.symbol));
  const insiderNews = allSymbolNews.filter(
    (n) => insiderKeywords.test(n.headline) && new Date(n.publishedAt) >= cutoff60
  );
  const editorialNews = allSymbolNews.filter(
    (n) => !insiderKeywords.test(n.headline) && new Date(n.publishedAt) >= cutoff30
  );

  if (insiderNews.length > 0) {
    drivers.push(insiderDriver(insiderNews, nextId()));
  }
  if (editorialNews.length > 0) {
    const newsDriver = summariseNewsDrivers(editorialNews, nextId());
    if (newsDriver) drivers.push(newsDriver);
  }

  // Sort by score descending
  return drivers.sort((a, b) => b.score - a.score);
}

function detectVolumeAnomaly(
  history: PriceBar[],
  stats: KeyStats,
  id: string
): PriceDriver | null {
  if (history.length < 2 || !stats.avgVolume) return null;

  const latest = history[history.length - 1];
  if (!latest || latest.volume === 0) return null;

  const ratio = latest.volume / stats.avgVolume;
  if (ratio < 1.5) return null;

  const multiplier = ratio.toFixed(1);
  const score = ratio >= 3 ? 20 : ratio >= 2 ? 15 : 10;

  // Determine direction from price move
  const prev = history[history.length - 2];
  const direction: DriverDirection =
    prev && latest.close > prev.close
      ? "bullish"
      : prev && latest.close < prev.close
      ? "bearish"
      : "neutral";

  return {
    id,
    category: "volume_anomaly",
    title: `Unusually high volume — ${multiplier}× 20-day average`,
    description: `Trading volume is ${multiplier}× the 20-day average, which often accompanies significant price moves. This may reflect institutional activity, a news catalyst, or options hedging. Volume spikes alone are correlated with, but do not confirm, a directional move.`,
    confidence: ratio >= 2 ? "medium" : "low",
    direction,
    score,
    sources: [
      {
        label: "Yahoo Finance",
        url: `https://finance.yahoo.com/quote/${stats.currentPrice ? "" : ""}`,
      },
    ],
    occurredAt: new Date(latest.timestamp).toISOString(),
  };
}

function analystDriver(rating: AnalystRating, id: string): PriceDriver {
  const isUpgrade =
    rating.action === "upgrade" || rating.action === "initiate";
  const isDowngrade = rating.action === "downgrade";

  const direction: DriverDirection = isUpgrade
    ? "bullish"
    : isDowngrade
    ? "bearish"
    : "neutral";

  const score = isUpgrade ? 30 : isDowngrade ? 30 : 15;

  const ptText = rating.priceTarget ? ` Price target: $${rating.priceTarget}.` : "";
  const fromText = rating.fromRating ? ` from ${rating.fromRating}` : "";

  return {
    id,
    category: "analyst",
    title: `${rating.firm} — ${capitalise(rating.action)} to ${rating.toRating}`,
    description: `${rating.firm} changed their rating${fromText} to ${rating.toRating}.${ptText} Analyst rating changes are often correlated with short-term price moves, particularly when accompanied by a revised price target or following earnings surprises.`,
    confidence: "high",
    direction,
    score,
    sources: [
      {
        label: `${rating.firm} via Yahoo Finance`,
        url: "https://finance.yahoo.com",
      },
    ],
    occurredAt: rating.date,
  };
}

function filingDriver(filing: EdgarFiling, id: string): PriceDriver {
  const is8K = filing.form === "8-K";
  return {
    id,
    category: "filing",
    title: `SEC ${filing.form} filed — ${filing.description}`,
    description: `A ${filing.form} was filed with the SEC${is8K ? ", which typically signals a material event such as a partnership, acquisition, leadership change, or other significant development" : ""}. Material filings are frequently correlated with near-term price volatility.`,
    confidence: "medium",
    direction: "neutral",
    score: is8K ? 20 : 10,
    sources: [filing.source],
    occurredAt: filing.filedAt,
  };
}

function summariseNewsDrivers(news: NewsItem[], id: string): PriceDriver | null {
  if (news.length === 0) return null;

  const avgSentiment = news
    .filter((n) => n.sentimentScore != null)
    .reduce((sum, n) => sum + (n.sentimentScore ?? 0), 0) / Math.max(news.length, 1);

  const direction: DriverDirection =
    avgSentiment > 0.2 ? "bullish" : avgSentiment < -0.2 ? "bearish" : "neutral";

  const confidence: DriverConfidence = news.length >= 3 ? "medium" : "low";

  return {
    id,
    category: "news",
    title: `${news.length} company-specific news item${news.length > 1 ? "s" : ""} in the last 24 hours`,
    description: `${news.length} editorial article${news.length > 1 ? "s were" : " was"} published mentioning this ticker in the past 30 days. News coverage — especially from major outlets — is often correlated with short-term price movement. Sentiment analysis suggests a ${direction} tone, though automated sentiment scoring may be inaccurate.`,
    confidence,
    direction,
    score: Math.min(10 + news.length * 3, 25),
    sources: news.slice(0, 3).map((n) => ({ label: n.source, url: n.url })),
    occurredAt: news[0].publishedAt,
  };
}

function insiderDriver(news: NewsItem[], id: string): PriceDriver {
  return {
    id,
    category: "insider",
    title: `${news.length} insider activity report${news.length > 1 ? "s" : ""} in the last 30 days`,
    description: `Form 4 filings and insider transaction reports detected. These include RSU vesting events, share class conversions, and executive share activity. Large insider sales may signal caution; meaningful open-market purchases can indicate insider confidence. Context matters — RSU vesting-related sales are routine and not necessarily bearish.`,
    confidence: "low",
    direction: "neutral",
    score: 12,
    sources: news.slice(0, 3).map((n) => ({ label: n.source, url: n.url })),
    occurredAt: news[0].publishedAt,
  };
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
