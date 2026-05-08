"use client";

import type { NewsItem } from "@/types";
import { formatDistanceToNow } from "date-fns";

interface Props {
  news: NewsItem[];
}

export default function NewsPanel({ news }: Props) {
  const visible = news.slice(0, 8);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col">
      <h2 className="text-white font-semibold text-base mb-4">Latest News</h2>

      {visible.length === 0 ? (
        <div className="text-gray-500 text-sm py-6 text-center flex-1 flex items-center justify-center flex-col gap-1">
          <span>No news in the current window.</span>
          <span className="text-gray-600 text-xs">Add a Polygon.io API key to enable news.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          {visible.map((item) => (
            <NewsRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function NewsRow({ item }: { item: NewsItem }) {
  const sentiment = item.sentimentScore;
  const sentimentLabel =
    sentiment == null ? null :
    sentiment > 0.2 ? { label: "positive", cls: "text-emerald-500 bg-emerald-950" } :
    sentiment < -0.2 ? { label: "negative", cls: "text-red-500 bg-red-950" } :
    { label: "neutral", cls: "text-gray-500 bg-gray-800" };

  return (
    <div className="flex gap-3">
      {/* Sentiment bar */}
      <div className={`w-0.5 shrink-0 rounded-full mt-1 self-stretch ${
        sentiment == null ? "bg-gray-800" :
        sentiment > 0.2 ? "bg-emerald-600" :
        sentiment < -0.2 ? "bg-red-600" : "bg-gray-700"
      }`} />

      <div className="min-w-0">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-100 text-sm hover:text-white leading-snug block mb-1 font-medium"
        >
          {item.headline}
        </a>
        <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
          <span className="font-medium text-gray-400">{item.source}</span>
          <span>·</span>
          <span>{formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true })}</span>
          {sentimentLabel && (
            <>
              <span>·</span>
              <span className={`px-1.5 py-0.5 rounded text-xs ${sentimentLabel.cls}`}>
                {sentimentLabel.label}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
