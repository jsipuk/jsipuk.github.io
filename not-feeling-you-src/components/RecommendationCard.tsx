import { formatMeta } from "@/lib/format"
import type { Activity } from "@/lib/types"
import RecommendationActions from "./RecommendationActions"

type Props = {
  index: number
  label: string
  activity: Activity | null
  budget: number
  saved: boolean
  committed: boolean
  onNah: () => void
  onSave: () => void
  onDo: () => void
  onUndo: () => void
}

export default function RecommendationCard(p: Props) {
  const a = p.activity
  return (
    <article className={`rec rec-${p.index}`} aria-labelledby={a ? `t-${a.id}` : undefined}>
      <p className="rec-label">
        <span className="rec-num">0{p.index}</span> {p.label}
      </p>
      {a ? (
        <div className="rec-body" key={a.id}>
          <h2 id={`t-${a.id}`} className="rec-title">
            {a.title}
          </h2>
          <p className="rec-meta">{formatMeta(a, p.budget)}</p>
          <p className="rec-summary">{a.summary}</p>
          <dl className="rec-notes">
            <div>
              <dt>Why this fits</dt>
              <dd>{a.whyItWorks}</dd>
            </div>
            {a.makeItBetter ? (
              <div>
                <dt>Make it better</dt>
                <dd>{a.makeItBetter}</dd>
              </div>
            ) : null}
          </dl>
          {p.committed ? (
            <div className="committed" role="status">
              <p className="committed-head">Go on then.</p>
              <p>Close this tab and go. Tell someone you’re doing it; it’s harder to back out.</p>
              <button type="button" className="text-btn" onClick={p.onUndo}>
                Actually, back to the three
              </button>
            </div>
          ) : (
            <RecommendationActions title={a.title} saved={p.saved} onNah={p.onNah} onSave={p.onSave} onDo={p.onDo} />
          )}
        </div>
      ) : (
        <div className="rec-body rec-empty">
          <p>That’s everything that fits here. Try changing your answers, or give one of the others a go.</p>
        </div>
      )}
    </article>
  )
}
