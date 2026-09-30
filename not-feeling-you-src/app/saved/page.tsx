"use client"

import Link from "next/link"
import { formatMeta } from "@/lib/format"
import { ACTIVITIES } from "@/lib/recommend"
import { useSaved } from "@/lib/storage"

export default function SavedPage() {
  const { ids, remove } = useSaved()
  const items = ids.map((id) => ACTIVITIES.find((a) => a.id === id)).filter((a) => a !== undefined)

  return (
    <div className="saved">
      <h1 className="results-title">Saved</h1>
      {items.length === 0 ? (
        <p className="empty">
          Nothing saved yet. Probably for the best.{" "}
          <Link href="/" className="text-link">
            Find something
          </Link>
        </p>
      ) : (
        <ul className="saved-list">
          {items.map((a) => (
            <li key={a.id} className="saved-item">
              <div>
                <h2 className="saved-title">{a.title}</h2>
                <p className="rec-meta">{formatMeta(a)}</p>
                <p className="saved-summary">{a.summary}</p>
              </div>
              <button type="button" className="btn btn-quiet" onClick={() => remove(a.id)} aria-label={`Remove ${a.title}`}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
