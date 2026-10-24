import { isRecord } from '../../src/game/parse'

/**
 * The co-op beta's list, as Discord staff edit it through the bot
 * (`/coop-beta`, the `coop_beta` tool): the game asks the PostHog flag
 * `coop-beta` (`COOP_FLAG` in `src/coopShell.ts`), which lets in the @handles
 * listed in one of its conditions. Editing a flag takes a personal API key
 * (`feature_flag:write`), not the project's public token.
 */

const POSTHOG = { api: 'https://us.posthog.com', projectId: 674834, flag: 'coop-beta' } as const

/** Where the list sits in a flag's `filters`: the condition on the person's `handle`, exactly one of a list. */
const handleList = (filters: unknown) => {
  if (!isRecord(filters) || !Array.isArray(filters.groups)) return null
  for (const [g, group] of filters.groups.entries()) {
    if (!isRecord(group) || !Array.isArray(group.properties)) continue
    for (const [p, prop] of group.properties.entries()) {
      if (!isRecord(prop) || prop.key !== 'handle' || prop.type !== 'person' || prop.operator !== 'exact' || !Array.isArray(prop.value)) continue
      const handles = prop.value.filter((v): v is string => typeof v === 'string')
      if (handles.length === prop.value.length) return { filters, groups: filters.groups, g, group, properties: group.properties, p, prop, handles }
    }
  }
  return null
}

/** The handles the flag lets in, or null when its conditions hold no handle list. */
export const betaHandles = (filters: unknown) => handleList(filters)?.handles ?? null

/** The flag's `filters` with `handle` let in (`on`) or left out, or null when they hold no handle list. Everything else stays as it was. */
export const withBetaHandle = (filters: unknown, handle: string, on: boolean) => {
  const at = handleList(filters)
  if (!at) return null
  const handles = on ? [...new Set([...at.handles, handle])] : at.handles.filter((h) => h !== handle)
  const groups = at.groups.map((group, g) => (g === at.g ? { ...at.group, properties: at.properties.map((prop, p) => (p === at.p ? { ...at.prop, value: handles } : prop)) } : group))
  return { ...at.filters, groups }
}

/** What a change came to: done (or nothing to do, `changed: false`) with the list's size after it, or a flag whose conditions hold no handle list. */
export type BetaChange = { ok: true; changed: boolean; count: number } | { ok: false; error: 'shape' }

/** Tries a change takes at most: PostHog answers 409 when the flag changed since it was read (someone else, the dashboard). */
const TRIES = 3

export const coopBeta = (personalKey: string) => {
  const call = async (method: 'GET' | 'PATCH', path: string, body?: unknown) => {
    const res = await fetch(`${POSTHOG.api}/api/projects/${POSTHOG.projectId}${path}`, {
      method,
      headers: { Authorization: `Bearer ${personalKey}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    })
    const json: unknown = await res.json().catch(() => null)
    return { status: res.status, json }
  }

  /** The flag as it is now: its id, version (PostHog refuses a write over a newer one) and conditions. */
  const read = async () => {
    const { status, json } = await call('GET', `/feature_flags/?search=${POSTHOG.flag}&limit=50`)
    const flag = isRecord(json) && Array.isArray(json.results) ? json.results.find((f) => isRecord(f) && f.key === POSTHOG.flag) : null
    if (!isRecord(flag) || typeof flag.id !== 'number') throw new Error(`posthog: no ${POSTHOG.flag} flag (${status})`)
    return { id: flag.id, version: flag.version, filters: flag.filters }
  }

  const change = async (handle: string, on: boolean, tries = TRIES): Promise<BetaChange> => {
    const flag = await read()
    const handles = betaHandles(flag.filters)
    const filters = withBetaHandle(flag.filters, handle, on)
    if (!handles || !filters) return { ok: false, error: 'shape' }
    const count = betaHandles(filters)?.length ?? 0
    if (handles.includes(handle) === on) return { ok: true, changed: false, count }
    const { status } = await call('PATCH', `/feature_flags/${flag.id}/`, { filters, version: flag.version })
    if (status === 409 && tries > 1) return change(handle, on, tries - 1)
    if (status < 200 || status >= 300) throw new Error(`posthog: ${POSTHOG.flag} update failed (${status})`)
    console.log(`coop beta: ${on ? 'added' : 'removed'} ${handle}`)
    return { ok: true, changed: true, count }
  }

  return {
    /** The handles in the beta now, or null when the flag holds no handle list. */
    list: async () => betaHandles((await read()).filters),
    add: (handle: string) => change(handle, true),
    remove: (handle: string) => change(handle, false),
  }
}

export type CoopBeta = ReturnType<typeof coopBeta>
