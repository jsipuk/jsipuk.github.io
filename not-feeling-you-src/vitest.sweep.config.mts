import { defineConfig } from "vitest/config"

// Slow or human-read checks that stay out of `npm test`.
export default defineConfig({
  test: { include: ["scripts/*.test.ts"] },
})
