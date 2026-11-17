import { describe, expect, it } from 'vitest'

/** Every shipped source under `src` as text, by its path (tests run in Node, never in a player's browser). */
const SOURCES: Record<string, string> = import.meta.glob(['/src/**/*.ts', '!/src/**/*.test.ts'], { query: '?raw', import: 'default', eager: true })

/**
 * ES2023's copying array methods: the type checker's `lib` (ES2023, for
 * `findLast`) allows them, but Chrome only has them from 110 and Safari from
 * 16, and Windows 7/8 stay on Chrome 109 for good. On 2026-11-16 one
 * `toSorted` in the HUD's ruins card threw as every run launched there, so
 * no run could start. Copy, then sort: `[...xs].sort(...)`.
 */
const BANNED = /\.(toSorted|toReversed|toSpliced|with)\(/

/** Code without its comments, so the doc blocks may name what they avoid. */
const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, '')).replace(/(^|[^:'"`])\/\/.*$/gm, '$1')

describe('shipped code runs on the older browsers players still have', () => {
  it('calls none of the array methods Chrome 109 lacks', () => {
    const found = Object.entries(SOURCES).flatMap(([path, text]) =>
      code(text)
        .split('\n')
        .flatMap((line, i) => (BANNED.test(line) ? [`${path}:${i + 1}: ${line.trim()}`] : [])),
    )
    expect(found).toEqual([])
  })
})
