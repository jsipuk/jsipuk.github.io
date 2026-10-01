import type { NextConfig } from "next"

/**
 * Fully static: no server, no API routes. Works on Vercel as-is, or on any
 * static host. Set NEXT_PUBLIC_BASE_PATH when hosting under a subfolder
 * (e.g. "/not-feeling-you" on jsip.uk).
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ""

const nextConfig: NextConfig = {
  output: "export",
  reactStrictMode: true,
  basePath: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
}

export default nextConfig
