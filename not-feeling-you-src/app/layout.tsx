import type { Metadata, Viewport } from "next"
import { Fraunces, IBM_Plex_Sans } from "next/font/google"
import SiteHeader from "@/components/SiteHeader"
import "./globals.css"

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  axes: ["SOFT", "opsz"],
  style: ["normal", "italic"],
  display: "swap",
})

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
})

export const metadata: Metadata = {
  title: "What to do when you’re not feeling you",
  description: "Tell us how much time, money and energy you have, and we’ll give you three things you could actually do.",
}

export const viewport: Viewport = {
  themeColor: "#F4F0E8",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${fraunces.variable} ${plex.variable}`}>
      <body>
        <a href="#main" className="skip">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
      </body>
    </html>
  )
}
