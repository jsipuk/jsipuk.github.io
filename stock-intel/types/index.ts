export interface Ticker {
  symbol: string;
  name: string;
  exchange: string;
  sector: string;
  industry: string;
}

export interface PriceBar {
  timestamp: number; // Unix ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface KeyStats {
  marketCap: number | null;
  peRatio: number | null;
  week52High: number | null;
  week52Low: number | null;
  avgVolume: number | null;
  shortFloat: number | null;
  beta: number | null;
  nextEarningsDate: string | null;
  currentPrice: number | null;
  previousClose: number | null;
  dayChange: number | null;
  dayChangePercent: number | null;
}

export interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  publishedAt: string;
  source: string;
  url: string;
  tickers: string[];
  sentimentScore: number | null;
}

export interface AnalystRating {
  firm: string;
  action: "upgrade" | "downgrade" | "initiate" | "reiterate" | "maintain";
  fromRating: string | null;
  toRating: string;
  priceTarget: number | null;
  date: string;
}

export type DriverCategory =
  | "earnings"
  | "analyst"
  | "news"
  | "macro"
  | "sector"
  | "volume_anomaly"
  | "filing"
  | "insider";

export type DriverDirection = "bullish" | "bearish" | "neutral";
export type DriverConfidence = "low" | "medium" | "high";

export interface SourceRef {
  label: string;
  url: string;
}

export interface PriceDriver {
  id: string;
  category: DriverCategory;
  title: string;
  description: string;
  confidence: DriverConfidence;
  direction: DriverDirection;
  score: number; // 0–100
  sources: SourceRef[];
  occurredAt: string;
}

export interface PeerMove {
  symbol: string;
  name: string;
  changePercent: number;
}

export interface MacroIndicator {
  label: string;
  value: string;
  changePercent: number | null;
  source: string;
}

export interface TickerAnalysis {
  ticker: Ticker;
  priceHistory: PriceBar[];
  stats: KeyStats;
  news: NewsItem[];
  analystRatings: AnalystRating[];
  drivers: PriceDriver[];
  peers: PeerMove[];
  macro: MacroIndicator[];
  fetchedAt: string;
}
