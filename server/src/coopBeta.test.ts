import { describe, expect, it } from 'vitest'
import { betaHandles, withBetaHandle } from './coopBeta'

/** The flag's `filters` as PostHog gives them: a rollout group with the handle list. */
const flag = (handles: unknown[]) => ({
  groups: [
    { properties: [{ key: 'handle', type: 'person', value: handles, operator: 'exact' }], rollout_percentage: 100, aggregation_group_type_index: null },
  ],
  early_exit: false,
  aggregation_group_type_index: null,
})

describe('the co-op beta flag', () => {
  it('reads the handle list', () => {
    expect(betaHandles(flag(['pedrobarretto', 'laukhaos']))).toEqual(['pedrobarretto', 'laukhaos'])
  })

  it('adds a handle once and keeps the rest of the flag', () => {
    const added = withBetaHandle(flag(['pedrobarretto']), 'laukhaos', true)
    expect(added).toEqual(flag(['pedrobarretto', 'laukhaos']))
    expect(betaHandles(withBetaHandle(added, 'laukhaos', true))).toEqual(['pedrobarretto', 'laukhaos'])
  })

  it('removes a handle', () => {
    expect(withBetaHandle(flag(['pedrobarretto', 'laukhaos']), 'laukhaos', false)).toEqual(flag(['pedrobarretto']))
  })

  it('finds the list beside other conditions and groups', () => {
    const filters = {
      groups: [
        { properties: [{ key: 'email', type: 'person', value: ['a@b.c'], operator: 'exact' }], rollout_percentage: 100 },
        { properties: [{ key: '$host', type: 'person', value: 'x', operator: 'icontains' }, { key: 'handle', type: 'person', value: ['ash'], operator: 'exact' }], rollout_percentage: 100 },
      ],
    }
    const added = withBetaHandle(filters, 'misty', true)
    expect(betaHandles(added)).toEqual(['ash', 'misty'])
    expect(added?.groups[0]).toBe(filters.groups[0])
  })

  it('leaves a flag without a handle list alone', () => {
    const rollout = { groups: [{ properties: [], rollout_percentage: 100 }] }
    expect(betaHandles(rollout)).toBeNull()
    expect(withBetaHandle(rollout, 'ash', true)).toBeNull()
    expect(withBetaHandle(flag(['ash', 3]), 'misty', true)).toBeNull()
    expect(withBetaHandle(null, 'ash', true)).toBeNull()
  })
})
