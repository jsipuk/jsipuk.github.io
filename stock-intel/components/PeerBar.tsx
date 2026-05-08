"use client";

import type { PeerMove, MacroIndicator } from "@/types";

interface Props {
  peers: PeerMove[];
  macro: MacroIndicator[];
}

export default function PeerBar({ peers, macro }: Props) {
  const hasPeers = peers.length > 0;
  const hasMacro = macro.length > 0;

  if (!hasPeers && !hasMacro) return null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      {hasMacro && (
        <div className="mb-3">
          <div className="text-gray-500 text-xs uppercase tracking-wide mb-2">Macro</div>
          <div className="flex gap-4 flex-wrap">
            {macro.map((m, i) => (
              <a
                key={i}
                href={m.source}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col hover:opacity-80"
              >
                <span className="text-gray-500 text-xs">{m.label}</span>
                <span className="text-gray-200 text-sm font-medium">{m.value}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {hasPeers && (
        <div>
          <div className="text-gray-500 text-xs uppercase tracking-wide mb-2 flex items-center gap-1">
            Related Stocks
            <span title="Suggested by Yahoo Finance — may reflect recent IPO cohort or algorithm-based association, not necessarily direct competitors." className="cursor-help text-gray-600 normal-case">ⓘ</span>
          </div>
          <div className="flex gap-3 flex-wrap">
            {peers.map((p) => {
              const isPositive = p.changePercent >= 0;
              return (
                <a
                  key={p.symbol}
                  href={`https://finance.yahoo.com/quote/${p.symbol}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-start px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
                >
                  <span className="text-gray-200 text-xs font-semibold">{p.symbol}</span>
                  <span
                    className={`text-xs font-medium ${
                      isPositive ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {isPositive ? "+" : ""}
                    {p.changePercent.toFixed(2)}%
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
