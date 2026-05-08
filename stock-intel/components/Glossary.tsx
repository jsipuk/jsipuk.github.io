"use client";

import { useState } from "react";

const TERMS: Record<string, string> = {
  // Analyst actions
  Upgrade: "Analyst moved their recommendation to a more positive rating, e.g. from Neutral to Buy.",
  Downgrade: "Analyst moved their recommendation to a more negative rating, e.g. from Buy to Neutral.",
  Initiate: "Analyst started coverage of this stock for the first time.",
  Reiterate: "Analyst confirmed an existing rating without changing it.",
  Maintain: "Analyst kept their existing rating unchanged.",

  // Rating levels
  Buy: "Analyst expects the stock to outperform the market. Also called Outperform or Overweight.",
  Sell: "Analyst expects the stock to underperform. Also called Underperform or Underweight.",
  Hold: "Analyst expects the stock to perform in line with the market. Also called Neutral or Equal Weight.",
  Overweight:
    "Analyst recommends holding more of this stock than its weight in a benchmark index. Effectively a Buy rating.",
  Underweight:
    "Analyst recommends holding less of this stock than its benchmark weight. Effectively a Sell rating.",
  Outperform:
    "Analyst expects the stock to do better than the market or sector average. Similar to Buy.",
  Underperform:
    "Analyst expects the stock to do worse than the market or sector average. Similar to Sell.",
  Neutral: "Analyst expects the stock to perform in line with the market. Similar to Hold.",
  "Market Outperform":
    "Analyst expects the stock to beat the broader market. Similar to Buy.",
  "Market Perform":
    "Analyst expects the stock to track the broader market. Similar to Hold.",
  "Equal Weight": "Analyst expects the stock to match the market. Similar to Hold.",
  "Strong Buy":
    "Analyst has high conviction that the stock will significantly outperform.",

  // Price target
  "Price Target":
    "The analyst's estimate of where the stock price should be in 12 months, based on their financial model.",

  // Driver terms
  "Volume Spike":
    "Trading volume significantly above the recent average. Often signals that institutions or large traders are active, but direction is not guaranteed.",
  "8-K":
    "A report filed with the SEC to announce a material event — such as a merger, leadership change, or significant agreement — that investors should know about.",
  "10-K": "A company's annual financial report filed with the SEC.",
  VIX: "The CBOE Volatility Index, sometimes called the 'fear gauge'. A high VIX suggests the market expects turbulent price swings ahead.",
  "10Y Yield":
    "The interest rate on 10-year US Treasury bonds. Rising yields can pressure growth stock valuations; falling yields often support them.",
  Beta: "A measure of a stock's volatility relative to the market. Beta > 1 means the stock tends to move more than the market; Beta < 1 means less.",
};

interface Props {
  term: string;
  children?: React.ReactNode;
}

export function GlossaryTip({ term, children }: Props) {
  const [visible, setVisible] = useState(false);
  const definition = TERMS[term];
  if (!definition) return <>{children ?? term}</>;

  return (
    <span className="relative inline-block">
      <span
        className="border-b border-dotted border-gray-500 cursor-help"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        tabIndex={0}
      >
        {children ?? term}
      </span>
      {visible && (
        <span className="absolute z-50 bottom-full left-0 mb-2 w-64 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-xs text-gray-300 shadow-xl leading-relaxed pointer-events-none">
          <span className="font-semibold text-white block mb-1">{term}</span>
          {definition}
        </span>
      )}
    </span>
  );
}

// Wraps any text and auto-detects known terms, rendering tooltips inline
export function GlossaryText({ text }: { text: string }) {
  const knownTerms = Object.keys(TERMS).sort((a, b) => b.length - a.length); // longest first
  const pattern = new RegExp(`\\b(${knownTerms.map(escapeRegex).join("|")})\\b`, "gi");
  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, i) => {
        const matched = knownTerms.find(
          (t) => t.toLowerCase() === part.toLowerCase()
        );
        if (matched) {
          return (
            <GlossaryTip key={i} term={matched}>
              {part}
            </GlossaryTip>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
