export default function ProgressLine({ step, total }: { step: number; total: number }) {
  return (
    <div className="progress">
      <div
        className="progress-track"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={step}
        aria-label={`Question ${step} of ${total}`}
      >
        <div className="progress-fill" style={{ width: `${(step / total) * 100}%` }} />
      </div>
      <span className="progress-label" aria-hidden="true">
        {step} of {total}
      </span>
    </div>
  )
}
