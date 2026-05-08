"use client";

import type { PeerMove, MacroIndicator } from "@/types";
import { GlossaryTip } from "./Glossary";

interface Props {
  peers: PeerMove[];
  macro: MacroIndicator[];
}

export default function ContextSidebar({ peers, macro }: Props) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-5">

      {macro.length > 0 && (
        <section>
          <h3 className="text-gray-500 text-xs uppercase tracking-wide mb-3">Market Context</h3>
          <div className="grid grid-cols-2 gap-3">
            {macro.map((m, i) => (
              <a
                key={i}
                href={m.source}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col gap-0.5 hover:opacity-80 transition-opacity"
              >
                <span className="text-gray-500 text-xs">
                  <GlossaryTip term={m.label}>{m.label}</GlossaryTip>
                </span>
                <span className="text-gray-100 text-base font-semibold">{m.value}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {macro.length > 0 && peers.length > 0 && (
        <div className="border-t border-gray-800" />
      )}

      {peers.length > 0 && (
        <section>
          <h3 className="text-gray-500 text-xs uppercase tracking-wide mb-3 flex items-center gap-1">
            Related Stocks
            <span
              title="Suggested by Yahoo Finance — may reflect IPO cohort or algorithm-based association, not necessarily direct competitors."
              className="cursor-help text-gray-700 normal-case"
            >
              ⓘ
            </span>
          </h3>
          <div className="space-y-2">
            {peers.map((p) => {
              const isUp = p.changePercent >= 0;
              return (
                <a
                  key={p.symbol}
                  href={`https://finance.yahoo.com/quote/${p.symbol}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between hover:bg-gray-800 rounded-lg px-2 py-1.5 -mx-2 transition-colors"
                >
                  <div>
                    <span className="text-gray-200 text-sm font-semibold">{p.symbol}</span>
                    <span className="text-gray-500 text-xs ml-2 truncate max-w-[120px] inline-block align-bottom">{p.name}</span>
                  </div>
                  <span className={`text-sm font-semibold shrink-0 ${isUp ? "text-emerald-400" : "text-red-400"}`}>
                    {isUp ? "+" : ""}{p.changePercent.toFixed(2)}%
                  </span>
                </a>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
