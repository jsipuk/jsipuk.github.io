"use client";

import type { AnalystRating } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { GlossaryTip } from "./Glossary";

interface Props {
  ratings: AnalystRating[];
}

const ACTION_STYLES: Record<string, { text: string; bg: string }> = {
  upgrade:   { text: "text-emerald-400", bg: "bg-emerald-950" },
  initiate:  { text: "text-indigo-400",  bg: "bg-indigo-950" },
  downgrade: { text: "text-red-400",     bg: "bg-red-950" },
  reiterate: { text: "text-gray-400",    bg: "bg-gray-800" },
  maintain:  { text: "text-gray-400",    bg: "bg-gray-800" },
};

export default function AnalystTable({ ratings }: Props) {
  const visible = ratings.slice(0, 8);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h2 className="text-white font-semibold text-base mb-4">Analyst Ratings</h2>

      {visible.length === 0 ? (
        <div className="text-gray-500 text-sm py-6 text-center">No recent analyst ratings available.</div>
      ) : (
        <div className="space-y-2">
          {visible.map((r, i) => <RatingRow key={i} r={r} />)}
        </div>
      )}
    </div>
  );
}

function RatingRow({ r }: { r: AnalystRating }) {
  const style = ACTION_STYLES[r.action] ?? ACTION_STYLES.maintain;

  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-800 last:border-0">

      {/* Action badge */}
      <span className={`text-xs font-semibold px-2 py-0.5 rounded shrink-0 ${style.text} ${style.bg}`}>
        <GlossaryTip term={r.action.charAt(0).toUpperCase() + r.action.slice(1)}>
          {r.action.toUpperCase()}
        </GlossaryTip>
      </span>

      {/* Firm + rating */}
      <div className="flex-1 min-w-0">
        <span className="text-gray-200 text-sm font-medium">{r.firm}</span>
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
          {r.fromRating && r.fromRating !== r.toRating && (
            <>
              <GlossaryTip term={r.fromRating}>{r.fromRating}</GlossaryTip>
              <span>→</span>
            </>
          )}
          <span className="text-gray-300 font-medium">
            <GlossaryTip term={r.toRating}>{r.toRating}</GlossaryTip>
          </span>
        </div>
      </div>

      {/* Price target */}
      {r.priceTarget && (
        <div className="text-right shrink-0">
          <GlossaryTip term="Price Target">
            <span className="text-sm font-semibold text-white">${r.priceTarget}</span>
          </GlossaryTip>
          <div className="text-xs text-gray-600">PT</div>
        </div>
      )}

      {/* Date */}
      <span className="text-gray-600 text-xs shrink-0 w-16 text-right">
        {formatDistanceToNow(new Date(r.date), { addSuffix: true })
          .replace("about ", "")
          .replace(" ago", "")
        }
      </span>
    </div>
  );
}
