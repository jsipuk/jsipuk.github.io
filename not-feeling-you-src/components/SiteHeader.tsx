"use client"

import Link from "next/link"
import { useSaved } from "@/lib/storage"

export default function SiteHeader() {
  const { ids } = useSaved()
  return (
    <header className="site-header">
      <Link href="/" className="wordmark">
        not feeling{" "}<em>you</em>
      </Link>
      <Link href="/saved/" className="header-link">
        Saved{ids.length ? <span className="count"> ({ids.length})</span> : null}
      </Link>
    </header>
  )
}
