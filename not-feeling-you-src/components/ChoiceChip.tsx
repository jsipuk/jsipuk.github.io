type Props = {
  label: string
  selected: boolean
  onClick: () => void
  disabled?: boolean
}

/** A single answer. Selection is shown by fill and a tick, never colour alone. */
export default function ChoiceChip({ label, selected, onClick, disabled }: Props) {
  return (
    <button type="button" className="chip" aria-pressed={selected} onClick={onClick} disabled={disabled}>
      <span className="chip-tick" aria-hidden="true">
        {selected ? "✓" : ""}
      </span>
      {label}
    </button>
  )
}
