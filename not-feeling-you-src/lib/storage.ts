"use client"

import { useCallback, useEffect, useState } from "react"

const SAVED_KEY = "nfy:saved"
const EVENT = "nfy:saved-changed"

function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(SAVED_KEY) ?? "[]")
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []
  } catch {
    return []
  }
}

function write(ids: string[]) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(ids))
  } catch {
    // Private mode or storage full. Saving just won't stick.
  }
  window.dispatchEvent(new Event(EVENT))
}

/** Saved activity IDs, newest first. localStorage only; no account. */
export function useSaved() {
  const [ids, setIds] = useState<string[]>([])
  useEffect(() => {
    const sync = () => setIds(read())
    sync()
    window.addEventListener(EVENT, sync)
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [])
  const toggle = useCallback((id: string) => {
    const cur = read()
    write(cur.includes(id) ? cur.filter((x) => x !== id) : [id, ...cur])
  }, [])
  const remove = useCallback((id: string) => write(read().filter((x) => x !== id)), [])
  return { ids, toggle, remove }
}

/** IDs already shown for one set of answers, so "Nah" never repeats itself this session. */
export function readSeen(key: string): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(`nfy:seen:${key}`) ?? "[]")
  } catch {
    return []
  }
}

export function writeSeen(key: string, ids: string[]) {
  try {
    sessionStorage.setItem(`nfy:seen:${key}`, JSON.stringify(ids))
  } catch {
    // Fine: the list still lives in component state.
  }
}
