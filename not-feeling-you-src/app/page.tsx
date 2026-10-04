"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import ChoiceChip from "@/components/ChoiceChip"
import DemoVideo from "@/components/DemoVideo"
import ProgressLine from "@/components/ProgressLine"
import QuestionStep from "@/components/QuestionStep"
import { toQuery } from "@/lib/query"
import type { Action, Company, Energy, Feeling, SettingChoice } from "@/lib/types"

const BUDGETS = [
  { label: "Nothing", value: 0 },
  { label: "Up to £10", value: 10 },
  { label: "Up to £25", value: 25 },
  { label: "Up to £50", value: 50 },
]
const TIMES = [
  { label: "15 mins", value: 15 },
  { label: "About an hour", value: 60 },
  { label: "A couple of hours", value: 120 },
  { label: "Half a day", value: 240 },
  { label: "All day", value: 480 },
]
const COMPANY: Array<{ label: string; value: Company }> = [
  { label: "Just me", value: "solo" },
  { label: "Me + partner", value: "partner" },
  { label: "Friend(s)", value: "friends" },
  { label: "Family", value: "family" },
]
const ENERGY: Array<{ label: string; value: Energy }> = [
  { label: "Basically none", value: "very-low" },
  { label: "Not much", value: "low" },
  { label: "I’m alright", value: "medium" },
  { label: "I need to move", value: "high" },
]
const FEELINGS: Array<{ label: string; value: Feeling | "surprise" }> = [
  { label: "Comfort me", value: "comfort" },
  { label: "Distract me", value: "distraction" },
  { label: "Make me laugh", value: "laughter" },
  { label: "Get me outside", value: "outside" },
  { label: "Give me something to do", value: "play" },
  { label: "Help me feel accomplished", value: "achievement" },
  { label: "Get me around people", value: "connection" },
  { label: "Show me something new", value: "novelty" },
  { label: "Surprise me", value: "surprise" },
]
const SETTINGS: Array<{ label: string; value: SettingChoice }> = [
  { label: "Stay home", value: "home" },
  { label: "Get me out", value: "out" },
  { label: "Either", value: "either" },
]
const LEANS: Array<{ label: string; value: Action | null }> = [
  { label: "Buy something", value: "buy" },
  { label: "Go somewhere", value: "go" },
  { label: "Make something", value: "make" },
  { label: "Do something", value: "do" },
  { label: "Learn something", value: "learn" },
  { label: "No preference", value: null },
]

const TOTAL = 6
const ADVANCE_MS = 180

export default function Home() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [budget, setBudget] = useState<number | null>(null)
  const [customOpen, setCustomOpen] = useState(false)
  const [custom, setCustom] = useState("")
  const [time, setTime] = useState<number | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [energy, setEnergy] = useState<Energy | null>(null)
  const [feelings, setFeelings] = useState<Array<Feeling | "surprise">>([])
  const [setting, setSetting] = useState<SettingChoice | null>(null)
  const [lean, setLean] = useState<Action | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const advance = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setStep((s) => s + 1), ADVANCE_MS)
  }

  const toggleFeeling = (f: Feeling | "surprise") => {
    setFeelings((cur) => {
      if (cur.includes(f)) return cur.filter((x) => x !== f)
      if (f === "surprise") return ["surprise"]
      const rest = cur.filter((x) => x !== "surprise")
      return rest.length >= 2 ? [rest[1], f] : [...rest, f]
    })
  }

  const finish = () => {
    if (budget === null || time === null || !company || !energy || !setting) return
    const q = toQuery({
      budget,
      timeMinutes: time,
      company,
      energy,
      feelings: feelings.length ? feelings : ["surprise"],
      setting,
      actionPreference: lean,
    })
    router.push(`/results/?${q}`)
  }

  if (step === 0) {
    return (
      <div className="landing">
        <h1 className="title">
          What to do when you’re not feeling <em>you</em>
        </h1>
        <p className="lede">A few questions. Three ideas. No life coaching.</p>
        <div className="landing-actions">
          <button type="button" className="btn btn-go btn-big" onClick={() => setStep(1)}>
            Find me something
          </button>
          <Link href="/results/?surprise=1" className="text-link">
            Just surprise me
          </Link>
          <DemoVideo />
        </div>
        <p className="aside">You feel a bit rubbish. That’s enough information. Let’s find something to do.</p>
      </div>
    )
  }

  return (
    <div className="flow">
      <div className="flow-top">
        <button type="button" className="text-btn back" onClick={() => setStep((s) => s - 1)}>
          ← Back
        </button>
        <ProgressLine step={step} total={TOTAL} />
      </div>

      <div className="step-wrap" key={step}>
        {step === 1 && (
          <QuestionStep
            question="How much are you happy to spend?"
            footer={
              customOpen ? (
                <form
                  className="custom"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const n = Math.round(Number(custom))
                    if (!Number.isFinite(n) || n < 0) return
                    setBudget(Math.min(n, 1000))
                    setStep(2)
                  }}
                >
                  <label htmlFor="custom-budget" className="custom-label">
                    Up to
                  </label>
                  <span className="custom-field">
                    <span aria-hidden="true">£</span>
                    <input
                      id="custom-budget"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoFocus
                      value={custom}
                      onChange={(e) => setCustom(e.target.value.replace(/[^0-9]/g, ""))}
                      aria-describedby="custom-hint"
                    />
                  </span>
                  <button type="submit" className="btn btn-go" disabled={custom === ""}>
                    Next
                  </button>
                  <span id="custom-hint" className="sr-only">
                    Whole pounds
                  </span>
                </form>
              ) : null
            }
          >
            {BUDGETS.map((b) => (
              <ChoiceChip
                key={b.label}
                label={b.label}
                selected={!customOpen && budget === b.value}
                onClick={() => {
                  setCustomOpen(false)
                  setBudget(b.value)
                  advance()
                }}
              />
            ))}
            <ChoiceChip label="Custom" selected={customOpen} onClick={() => setCustomOpen(true)} />
          </QuestionStep>
        )}

        {step === 2 && (
          <QuestionStep question="How much time have you got?">
            {TIMES.map((t) => (
              <ChoiceChip
                key={t.label}
                label={t.label}
                selected={time === t.value}
                onClick={() => {
                  setTime(t.value)
                  advance()
                }}
              />
            ))}
          </QuestionStep>
        )}

        {step === 3 && (
          <QuestionStep question="Who’s involved?">
            {COMPANY.map((c) => (
              <ChoiceChip
                key={c.value}
                label={c.label}
                selected={company === c.value}
                onClick={() => {
                  setCompany(c.value)
                  advance()
                }}
              />
            ))}
          </QuestionStep>
        )}

        {step === 4 && (
          <QuestionStep question="How much effort have you got in you?">
            {ENERGY.map((e) => (
              <ChoiceChip
                key={e.value}
                label={e.label}
                selected={energy === e.value}
                onClick={() => {
                  setEnergy(e.value)
                  advance()
                }}
              />
            ))}
          </QuestionStep>
        )}

        {step === 5 && (
          <QuestionStep
            question="What would help most?"
            hint="Pick one or two."
            footer={
              <div className="step-next">
                <button type="button" className="btn btn-go" disabled={!feelings.length} onClick={() => setStep(6)}>
                  Next
                </button>
              </div>
            }
          >
            {FEELINGS.map((f) => (
              <ChoiceChip
                key={f.value}
                label={f.label}
                selected={feelings.includes(f.value)}
                onClick={() => toggleFeeling(f.value)}
              />
            ))}
          </QuestionStep>
        )}

        {step === 6 && (
          <QuestionStep
            question="Where are we doing this?"
            footer={
              <>
                <h3 className="subquestion" id="lean">
                  Anything you’re leaning towards? <span className="optional">Optional</span>
                </h3>
                <div className="choices choices-small" role="group" aria-labelledby="lean">
                  {LEANS.map((l) => (
                    <ChoiceChip key={l.label} label={l.label} selected={lean === l.value} onClick={() => setLean(l.value)} />
                  ))}
                </div>
                <div className="step-next">
                  <button type="button" className="btn btn-go btn-big" disabled={!setting} onClick={finish}>
                    Show me three
                  </button>
                </div>
              </>
            }
          >
            {SETTINGS.map((s) => (
              <ChoiceChip key={s.value} label={s.label} selected={setting === s.value} onClick={() => setSetting(s.value)} />
            ))}
          </QuestionStep>
        )}
      </div>
    </div>
  )
}
