"use client"

import { useRef } from "react"

// Static export: files in public/ need the base path added by hand.
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? ""

/**
 * A quiet "How it works" link that opens the 30-second welcome video in a
 * modal. Nothing downloads until it's opened.
 */
export default function DemoVideo() {
  const dialog = useRef<HTMLDialogElement>(null)
  const video = useRef<HTMLVideoElement>(null)

  const open = () => {
    dialog.current?.showModal()
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (!reduced) video.current?.play().catch(() => {})
  }
  const close = () => dialog.current?.close()

  return (
    <>
      <button type="button" className="text-link demo-link" onClick={open}>
        How it works <span className="demo-length">(30s)</span>
      </button>
      <dialog
        ref={dialog}
        className="demo-dialog"
        aria-label="How it works: a 30-second video"
        onClose={() => video.current?.pause()}
        // A click on the backdrop lands on the dialog itself.
        onClick={(e) => e.target === dialog.current && close()}
      >
        <div className="demo-frame">
          <video
            ref={video}
            src={`${BASE}/demo/welcome.mp4`}
            poster={`${BASE}/demo/welcome-poster.jpg`}
            preload="none"
            controls
            muted
            playsInline
            width={1920}
            height={1080}
          >
            A short silent video showing the questions, the three ideas, and the Nah, Save and Let’s do it buttons.
          </video>
        </div>
        <button type="button" className="demo-close" onClick={close}>
          Close
        </button>
      </dialog>
    </>
  )
}
