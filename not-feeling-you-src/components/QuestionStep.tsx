"use client"

import { useEffect, useRef, type ReactNode } from "react"

type Props = {
  question: string
  hint?: string
  children: ReactNode
  footer?: ReactNode
}

/** One question and its answers. Focus moves to the question so screen readers hear it. */
export default function QuestionStep({ question, hint, children, footer }: Props) {
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    ref.current?.focus({ preventScroll: true })
  }, [question])
  return (
    <section className="step" aria-labelledby="q">
      <h2 id="q" ref={ref} tabIndex={-1} className="question">
        {question}
      </h2>
      {hint ? <p className="hint">{hint}</p> : null}
      <div className="choices">{children}</div>
      {footer}
    </section>
  )
}
