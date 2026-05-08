import type { NewsItem } from "@/types";

const BASE = "https://api.polygon.io";

function key() {
  return process.env.POLYGON_API_KEY ?? "";
}

export async function fetchNews(symbol: string): Promise<NewsItem[]> {
  if (!key()) return [];

  const url = new URL(`${BASE}/v2/reference/news`);
  url.searchParams.set("ticker", symbol);
  url.searchParams.set("limit", "20");
  url.searchParams.set("order", "desc");
  url.searchParams.set("sort", "published_utc");
  url.searchParams.set("apiKey", key());

  const res = await fetch(url.toString(), { next: { revalidate: 900 } });
  if (!res.ok) return [];

  const data = await res.json();
  const results = data.results ?? [];

  return results.map(
    (item: Record<string, unknown>, i: number): NewsItem => ({
      id: (item.id as string) ?? String(i),
      headline: (item.title as string) ?? "",
      summary: (item.description as string) ?? "",
      publishedAt: (item.published_utc as string) ?? new Date().toISOString(),
      source: ((item.publisher as Record<string, unknown>)?.name as string) ?? "Unknown",
      url: (item.article_url as string) ?? "",
      tickers: (item.tickers as string[]) ?? [],
      sentimentScore: extractSentiment(item.insights),
    })
  );
}

function extractSentiment(insights: unknown): number | null {
  if (!Array.isArray(insights) || insights.length === 0) return null;
  const first = insights[0] as Record<string, unknown>;
  const sentiment = first?.sentiment as string;
  if (sentiment === "positive") return 0.6;
  if (sentiment === "negative") return -0.6;
  if (sentiment === "neutral") return 0;
  return null;
}
