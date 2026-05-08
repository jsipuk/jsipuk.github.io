import type { NewsItem } from "@/types";

const BASE = "https://www.alphavantage.co/query";

function key() {
  return process.env.ALPHA_VANTAGE_KEY ?? "";
}

// AV time format: "20260502T023906" → ISO string
function parseAvTime(t: string): string {
  try {
    const y = t.slice(0, 4);
    const mo = t.slice(4, 6);
    const d = t.slice(6, 8);
    const h = t.slice(9, 11);
    const mi = t.slice(11, 13);
    const s = t.slice(13, 15);
    return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function parseSentiment(label: string): number | null {
  switch (label) {
    case "Bullish":          return 0.8;
    case "Somewhat-Bullish": return 0.4;
    case "Neutral":          return 0;
    case "Somewhat-Bearish": return -0.4;
    case "Bearish":          return -0.8;
    default:                 return null;
  }
}

export async function fetchAvNews(symbol: string): Promise<NewsItem[]> {
  if (!key()) return [];

  const url = new URL(BASE);
  url.searchParams.set("function", "NEWS_SENTIMENT");
  url.searchParams.set("tickers", symbol);
  url.searchParams.set("limit", "50");
  url.searchParams.set("sort", "LATEST");
  url.searchParams.set("apikey", key());

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 900 } });
    if (!res.ok) return [];
    const data = await res.json();

    if (data.Note || data.Information) {
      // Rate limit hit
      console.warn("[alphavantage] rate limited:", data.Note ?? data.Information);
      return [];
    }

    const feed: Record<string, unknown>[] = data.feed ?? [];

    return feed.map((item, i): NewsItem => {
      const tickerSentiments = (item.ticker_sentiment as Record<string, unknown>[]) ?? [];
      const match = tickerSentiments.find(
        (t) => (t.ticker as string)?.toUpperCase() === symbol.toUpperCase()
      );
      const sentimentLabel = (match?.ticker_sentiment_label ?? item.overall_sentiment_label) as string;

      return {
        id: `av-${i}-${String(item.url).slice(-20)}`,
        headline: (item.title as string) ?? "",
        summary: (item.summary as string) ?? "",
        publishedAt: parseAvTime(String(item.time_published)),
        source: (item.source as string) ?? "Unknown",
        url: (item.url as string) ?? "",
        tickers: tickerSentiments.map((t) => (t.ticker as string)?.toUpperCase()),
        sentimentScore: parseSentiment(sentimentLabel),
      };
    });
  } catch {
    return [];
  }
}
