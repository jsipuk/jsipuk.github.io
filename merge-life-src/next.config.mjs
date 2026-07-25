/**
 * Merge Life ships as a fully static site: no backend, no server actions.
 * `output: 'export'` therefore works on Vercel, Netlify, GitHub Pages or any
 * plain static host. Set NEXT_PUBLIC_BASE_PATH when hosting under a subfolder
 * (e.g. "/merge-life" on GitHub Pages).
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  reactStrictMode: true,
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
