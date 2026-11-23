import { describe, expect, it } from 'vitest'
import { ingestTarget } from './worker'

const at = (path: string) => ingestTarget(new URL(path, 'https://www.pokemonsurvivors.com'))

describe('ingestTarget', () => {
  it("sends PostHog's scripts and remote config to its assets host", () => {
    expect(at('/ingest/static/recorder.js?v=1.2')).toBe('https://us-assets.i.posthog.com/static/recorder.js?v=1.2')
    expect(at('/ingest/array/phc_x/config.js')).toBe('https://us-assets.i.posthog.com/array/phc_x/config.js')
  })

  it('sends the rest to its API, query kept', () => {
    expect(at('/ingest/e/?ip=0&_=1')).toBe('https://us.i.posthog.com/e/?ip=0&_=1')
    expect(at('/ingest/flags/?v=2')).toBe('https://us.i.posthog.com/flags/?v=2')
  })

  it("leaves what isn't the proxy alone", () => {
    expect(at('/assets/main-x.js')).toBeNull()
    expect(at('/ingestion')).toBeNull()
  })
})
