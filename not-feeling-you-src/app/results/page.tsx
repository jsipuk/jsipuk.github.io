"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense, useEffect, useMemo, useState } from "react"
import RecommendationCard from "@/components/RecommendationCard"
import { describeInput } from "@/lib/format"
import { fromQuery, toQuery } from "@/lib/query"
import { recommend, replace } from "@/lib/recommend"
import { readSeen, useSaved, writeSeen } from "@/lib/storage"
import type { Pick, Slot } from "@/lib/types"

const SLOTS: Array<{ slot: Slot; label: string }> = [
  { slot: "best", label: "The obvious one" },
  { slot: "different", label: "Something different" },
  { slot: "wildcard", label: "Wildcard" },
]

function Results() {
  const params = useSearchParams()
  const surprise = params.get("surprise") !== null
  const input = useMemo(() => fromQuery(new URLSearchParams(params.toString())), [params])
  const key = useMemo(() => toQuery(input), [input])

  const [picks, setPicks] = useState<Array<Pick | null> | null>(null)
  const [seen, setSeen] = useState<string[]>([])
  const [committed, setCommitted] = useState<Slot | null>(null)
  const [announce, setAnnounce] = useState("")
  const saved = useSaved()

  useEffect(() => {
    const rejected = readSeen(key)
    const first = recommend(input, { exclude: rejected })
    setPicks(SLOTS.map(({ slot }) => first.find((p) => p.slot === slot) ?? null))
    setSeen([...rejected, ...first.map((p) => p.activity.id)])
    setCommitted(null)
  }, [input, key])

  if (!picks) return <p className="loading">Having a think…</p>

  const nah = (slot: Slot) => {
    const current = picks.filter((p): p is Pick => p !== null)
    const out = current.find((p) => p.slot === slot)
    const next = replace(input, current, slot, seen)
    const rejected = [...readSeen(key), ...(out ? [out.activity.id] : [])]
    writeSeen(key, rejected)
    setSeen((s) => (next ? [...s, next.activity.id] : s))
    setPicks(picks.map((p, i) => (SLOTS[i].slot === slot ? next : p)))
    setAnnounce(next ? `Swapped for: ${next.activity.title}` : "Nothing else fits there.")
  }

  const shown = picks.filter(Boolean).length

  return (
    <div className="results">
      <header className="results-head">
        <h1 className="results-title">{shown ? (shown === 3 ? "Right. Here are three." : "Right. Here’s what fits.") : "Hmm."}</h1>
        <p className="results-context">
          {surprise ? "Assumed: " : ""}
          {describeInput(input)}.{" "}
          <Link href="/" className="text-link">
            Change answers
          </Link>
        </p>
      </header>

      {shown === 0 ? (
        <p className="empty">
          Nothing fits all of that. Try a bit more time or budget, or say “Either” for where.
        </p>
      ) : (
        <div className="rec-list">
          {SLOTS.map(({ slot, label }, i) => {
            const p = picks[i]
            if (committed && committed !== slot) return null
            return (
              <RecommendationCard
                key={slot}
                index={i + 1}
                label={label}
                activity={p?.activity ?? null}
                budget={input.budget}
                saved={!!p && saved.ids.includes(p.activity.id)}
                committed={committed === slot}
                onNah={() => nah(slot)}
                onSave={() => p && saved.toggle(p.activity.id)}
                onDo={() => {
                  setCommitted(slot)
                  setAnnounce(`Chosen: ${p?.activity.title}`)
                  window.scrollTo({ top: 0, behavior: "smooth" })
                }}
                onUndo={() => setCommitted(null)}
              />
            )
          })}
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      <footer className="small-print">
        <p>
          Feeling a lot worse than “a bit off”? Samaritans are free, any time, on{" "}
          <a href="tel:116123">116&nbsp;123</a>.
        </p>
      </footer>
    </div>
  )
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<p className="loading">Having a think…</p>}>
      <Results />
    </Suspense>
  )
}
