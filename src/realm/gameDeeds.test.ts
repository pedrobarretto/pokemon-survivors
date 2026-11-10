import { describe, expect, it } from 'vitest'
import { clawDeeds, digDeeds, safariDeeds } from './gameDeeds'

describe("the API's own games' deeds", () => {
  it('counts a claw win, not a credit, and a first try only on a plush with no misses', () => {
    expect(clawDeeds(false, 0)).toEqual(new Map())
    expect(clawDeeds(true, 4)).toEqual(new Map([['claw:plush', 1]]))
    expect(clawDeeds(true, 0)).toEqual(new Map([['claw:plush', 1], ['claw:firstTry', 1]]))
  })

  it('counts a Safári catch, and a shiny only when it was caught', () => {
    expect(safariDeeds(false, true)).toEqual(new Map())
    expect(safariDeeds(true, false)).toEqual(new Map([['safari:catch', 1]]))
    expect(safariDeeds(true, true)).toEqual(new Map([['safari:catch', 1], ['safari:shiny', 1]]))
  })

  it('counts each treasure dug out, the fossils among them, and a golden wall only when it gave one up', () => {
    expect(digDeeds(true, [])).toEqual(new Map())
    expect(digDeeds(false, ['nugget', 'skullFossil', 'jawFossil'])).toEqual(new Map([['dig:find', 3], ['dig:fossil', 2]]))
    expect(digDeeds(true, ['lure'])).toEqual(new Map([['dig:find', 1], ['dig:golden', 1]]))
  })
})
