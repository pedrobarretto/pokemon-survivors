import { API_URL, sessionToken } from './account'
import { timeoutSignal } from './net/timeout'

const TIMEOUT_MS = 10_000

/**
 * A call to the API (`server/`), with the player's token when `auth` asks for
 * it: its status and JSON body. Never throws: offline (or a guest asking for
 * `auth`) is status 0, so callers just say the API is out of reach.
 */
export const apiCall = async (path: string, init: { method?: string; body?: unknown; auth?: boolean } = {}) => {
  try {
    const token = init.auth ? await sessionToken() : null
    if (init.auth && !token) return { status: 0, body: null }
    const res = await fetch(`${API_URL}${path}`, {
      method: init.method ?? 'GET',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: timeoutSignal(TIMEOUT_MS),
    })
    return { status: res.status, body: (await res.json().catch(() => null)) as unknown }
  } catch {
    return { status: 0, body: null }
  }
}
