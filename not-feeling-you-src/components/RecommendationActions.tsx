type Props = {
  title: string
  saved: boolean
  onNah: () => void
  onSave: () => void
  onDo: () => void
}

export default function RecommendationActions({ title, saved, onNah, onSave, onDo }: Props) {
  return (
    <div className="card-actions">
      <button type="button" className="btn btn-quiet" onClick={onNah} aria-label={`Nah, swap out ${title}`}>
        Nah
      </button>
      <button type="button" className="btn btn-line" onClick={onSave} aria-pressed={saved}>
        {saved ? "Saved ✓" : "Save this"}
      </button>
      <button type="button" className="btn btn-go" onClick={onDo}>
        Let’s do it
      </button>
    </div>
  )
}
