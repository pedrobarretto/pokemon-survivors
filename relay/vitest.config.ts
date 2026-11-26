import { cloudflareTest } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: './wrangler.jsonc' } })],
  // node/ is the VPS relays' shell, tested in Node by its own config.
  test: { testTimeout: 30_000, exclude: ['**/node_modules/**', 'node/**'] },
})
