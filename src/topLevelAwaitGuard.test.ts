import { describe, expect, it } from 'vitest'

/** The game's sources as text, by path. Top-level statements start at column 0 in this codebase. */
const SOURCES: Record<string, string> = import.meta.glob(['/src/**/*.ts', '!/src/**/*.test.ts'], { query: '?raw', import: 'default', eager: true })

const TOP_LEVEL_AWAIT = /^(?:export\s+)?(?:(?:const|let|var)\s[^=]*=\s*)?await\s/m

// Safari 26 ran a module's importers while it was suspended on one, with its exports undefined: a black screen on load.
describe('modules load on Safari 26', () => {
  it('has no top-level await', () => {
    expect(Object.keys(SOURCES).filter((path) => TOP_LEVEL_AWAIT.test(SOURCES[path] ?? ''))).toEqual([])
  })
})
