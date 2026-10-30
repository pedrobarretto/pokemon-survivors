import { accountHandle, accountsEnabled, sessionToken } from './account'
import { track, type RunPerf } from './analytics'
import { bank, bankKey, paysAnything, type BankDelta, type Store } from './coop/bank'
import { createBot, botPick, type Bot } from './coop/bot'
import { COSMETIC_IDS, slotOf, type CosmeticSlot } from './data/cosmetics'
import { coopGuestId, createCoopClient, webSocket, type CoopClient, type CoopDeps } from './coop/client'
import { measureRelay, type VpsUrls } from './coop/relays'
import type { QueueDeps } from './arena/queue'
import type { PingKind, QuickChat } from './game/versusSocial'
import { createLocalRelay, LOCAL_RELAY_URL, type LocalRelay } from './coop/localRelay'
import { buildAdvice } from './coop/lobby'
import { netSummary, type NetStats } from './coop/netStats'
import type { Runner } from './coop/runner'
import { EGGS } from './game/eggs'
import { coopPayout, playerDexLog } from './game/coop'
import { mergeDex, recordRun, type Pokedex } from './game/dex'
import { localPlayer } from './game/players'
import type { Game, GameEvent } from './game/types'
import { ROOM_PARAM, VPS_HOMES, parseRoomCode, type VpsHome, type WireLook } from './net/protocol'
import { timeoutSignal } from './net/timeout'
import { REF_PARAM } from './game/referral'
import { ROUTES } from './site/routes'
import { locale } from './i18n'
import { bankEggs, depositPokeDollars, recordRunProgress, updateSave } from './ui/save'

/**
 * The browser's side of co-op that isn't drawing: the one client of this tab
 * (relay URL, Clerk token or guest id, localStorage), joining by link, the
 * banking of a run (exactly once, `coop/bank.ts`), which events of the
 * simulation are this player's, and the dev console's bots.
 */

/** The dev relay on workers.dev: dev builds use it unless `VITE_COOP_URL` (or `ps.coop('url', …)`) says otherwise. */
export const DEV_RELAY = 'https://ps-coop-dev.pedrobarretto.workers.dev'

const URL_KEY = 'ps:coopUrl'
const NAME_KEY = 'ps:coopName'

const local: Store = {
  get: (k) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, v)
    } catch {
      // Storage blocked: the seat lasts this page.
    }
  },
  remove: (k) => {
    try {
      localStorage.removeItem(k)
    } catch {
      // Nothing kept.
    }
  },
  keys: () => {
    try {
      return Object.keys(localStorage)
    } catch {
      return []
    }
  },
}

/**
 * Where the relay is: the build's, a dev override, or the dev relay in dev
 * builds. Null: co-op is off in this build, as in any build without accounts
 * (co-op is for signed-in players); dev builds keep it, as guests on the dev relay.
 */
export const coopUrl = (): string | null => {
  if (!accountsEnabled && !import.meta.env.DEV) return null
  return (import.meta.env.DEV ? local.get(URL_KEY) : null) ?? import.meta.env.VITE_COOP_URL ?? (import.meta.env.DEV ? DEV_RELAY : null)
}

export const setCoopUrl = (url: string | null) => (url ? local.set(URL_KEY, url) : local.remove(URL_KEY))

/**
 * The VPS relays (`relay/node`) this build has, by the home their room codes
 * name (`RELAY_HOMES`): one entry and one `VITE_COOP_URL_*` per relay. An
 * unset one is off, and its rooms' codes go to Cloudflare.
 */
const RELAY_URLS = { sa: import.meta.env.VITE_COOP_URL_SA } as const satisfies Record<VpsHome, string | undefined>

/** The VPS relays' URLs, with a dev build's overrides (`ps.coop('relay', home, url)`). */
export const coopVpsUrls = (): VpsUrls =>
  Object.fromEntries(
    Object.entries(RELAY_URLS).flatMap(([home, url]) => {
      const chosen = (import.meta.env.DEV ? local.get(`${URL_KEY}:${home}`) : null) ?? url
      return chosen ? [[home, chosen]] : []
    }),
  )

export const setCoopVpsUrl = (home: VpsHome, url: string | null) => (url ? local.set(`${URL_KEY}:${home}`, url) : local.remove(`${URL_KEY}:${home}`))

/**
 * The name teammates see: the account's @handle (unique, the one the boards
 * show; co-op is for signed-in players). Only dev builds, whose relay seats
 * guests, fall back to a name kept on the device; bots bring their own.
 */
export const coopName = () => {
  const handle = accountHandle()
  if (handle) return `@${handle}`
  // No handle yet (the shell asks for one before co-op): never shown in practice.
  if (!import.meta.env.DEV) return '?'
  const kept = local.get(NAME_KEY)
  if (kept) return kept
  const name = `Dev ${Math.floor(1000 + Math.random() * 9000)}`
  local.set(NAME_KEY, name)
  return name
}

/**
 * The token co-op joins with: Clerk's when signed in. A dev build's stand-in
 * (`ps:devToken`, for a local API) isn't a Clerk token and the relay would
 * refuse it, so co-op plays as a guest there.
 */
const coopToken = async () => (import.meta.env.DEV && local.get('ps:devToken') ? null : sessionToken())

const browserDeps = (url: string, store: Store, token: () => Promise<string | null>, name: () => string): CoopDeps => ({
  url,
  vps: coopVpsUrls(),
  build: __SIM_BUILD__,
  socket: webSocket,
  fetch: (u, init) => fetch(u, init),
  store,
  token,
  name,
  now: () => performance.now(),
  random: Math.random,
})

let client: CoopClient | null = null

/**
 * What the Arena's public queue (`arena/queue.ts`) needs from the browser:
 * the relay's origin, co-op's token, the WebSocket, and the round trips to
 * each relay home (Cloudflare's and the VPS relays'), measured as the ticket
 * opens. Null without a relay.
 */
export const arenaQueueDeps = (): QueueDeps | null => {
  const url = coopUrl()
  if (!url) return null
  const get = (u: string) => fetch(u, { signal: timeoutSignal(3000) }).then((r) => r.json() as Promise<unknown>)
  const homes = [['cf', url] as const, ...Object.entries(coopVpsUrls())]
  return {
    relay: url,
    build: __SIM_BUILD__,
    auth: async () => {
      const token = await coopToken().catch(() => null)
      return token ? { kind: 'clerk', token } : { kind: 'guest', id: coopGuestId(local, Math.random) }
    },
    socket: webSocket,
    rtts: async () => {
      const probes = await Promise.all(homes.map(async ([home, u]) => [home, await measureRelay(u.replace(/\/+$/, ''), get, () => performance.now(), 3)] as const))
      return Object.fromEntries(probes.flatMap(([home, p]) => (p ? [[home, Math.round(p.rtt)]] : [])))
    },
  }
}

/** This tab's co-op client (made on first use), or null without a relay. */
export const coopClient = (): CoopClient | null => {
  const url = coopUrl()
  if (!url) return null
  client ??= createCoopClient(browserDeps(url, local, coopToken, coopName))
  return client
}

/** Arena against bots: a client on an in-page relay (`coop/localRelay.ts`), no network and no account. Null while none runs. */
let arena: { relay: LocalRelay; client: CoopClient } | null = null

/** The Arena's in-page client, while a match against bots is up. */
export const arenaClient = (): CoopClient | null => arena?.client ?? null

/** A fresh in-page relay with a guest client on it named `name` (one at a time: the last one closes). */
export const openArenaClient = (name: string): CoopClient => {
  closeArenaClient()
  const relay = createLocalRelay({ now: () => Date.now(), random: Math.random })
  const client = createCoopClient({
    url: LOCAL_RELAY_URL,
    build: __SIM_BUILD__,
    socket: relay.socket,
    fetch: relay.fetch,
    store: memoryStore(),
    token: async () => null,
    name: () => name,
    now: () => performance.now(),
    random: Math.random,
  })
  arena = { relay, client }
  return client
}

/** Leaves the Arena's match and drops its relay (its timers and sockets with it). */
export const closeArenaClient = () => {
  if (!arena) return
  const { relay, client } = arena
  arena = null
  client.leave()
  relay.dispose()
}

/** The client the shell steps and shows: the Arena's in-page one while it runs, else this tab's co-op client. */
export const activeCoopClient = (): CoopClient | null => arenaClient() ?? coopClient()

/** The room code in the page's link (`?sala=K7QF2`), if any. */
export const linkedRoom = () => parseRoomCode(new URLSearchParams(location.search).get(ROOM_PARAM))

/**
 * The room's link to share: the game's page with `?sala=CODE` (this site, so
 * a dev or preview build shares itself) and who sends it (`&ref=`, this
 * player's handle), so the invited player sees who asked and the referral counts.
 */
export const roomLink = (code: string) => {
  const handle = accountHandle()
  return `${location.origin}${ROUTES.play[locale()]}?${ROOM_PARAM}=${code}${handle ? `&${REF_PARAM}=${encodeURIComponent(handle)}` : ''}`
}

/** The tab's own storage, for what must outlive a reload but not the tab. */
const session = {
  get: (k: string) => {
    try {
      return sessionStorage.getItem(k)
    } catch {
      return null
    }
  },
  set: (k: string, v: string) => {
    try {
      sessionStorage.setItem(k, v)
    } catch {
      // Storage blocked: the guard lasts this page.
    }
  },
}

/** The room build this tab last reloaded for (a `build` refusal's "update"). */
const RELOADED_KEY = 'ps:coopReloadedFor'

/** The simulation build the site serves now (`/sim-build.json`, written by the build), or null when it can't tell. */
const latestSimBuild = (): Promise<string | null> =>
  fetch('/sim-build.json', { cache: 'no-store', signal: timeoutSignal(4000) })
    .then((res) => (res.ok ? res.json() : null))
    .then((v: unknown) => (typeof v === 'object' && v !== null && 'build' in v && typeof v.build === 'string' ? v.build : null))
    .catch(() => null)

let advice: { room: string | null; answer: Promise<'reload' | 'oldRoom'> } | null = null

/**
 * What the client's `build` refusal means (`buildAdvice`): a reload reaches
 * the room, or the room is older than the site (ask the host for a new one).
 * Asked once per room build.
 */
export const buildRefusal = () => {
  const room = coopClient()?.state().roomBuild ?? null
  if (advice?.room !== room) {
    const answer = latestSimBuild().then((latest) => buildAdvice({ own: __SIM_BUILD__, room, latest, reloaded: session.get(RELOADED_KEY) === (room ?? '?') }))
    advice = { room, answer }
  }
  return advice.answer
}

/** This tab reloads for the refusing room's build: the same refusal won't offer it again. */
export const markBuildReload = () => session.set(RELOADED_KEY, coopClient()?.state().roomBuild ?? '?')

/** Puts the room in the page's link, so a reload or the shared link comes back to it. */
export const linkRoom = (code: string | null) => {
  const u = new URL(location.href)
  if (code) u.searchParams.set(ROOM_PARAM, code)
  else u.searchParams.delete(ROOM_PARAM)
  history.replaceState(null, '', u)
}

/**
 * Banks this player's share of the run now (a victory, the end, leaving):
 * what wasn't paid yet, never twice, even across reloads. `dexBase` is the
 * Pokédex as the run found it.
 */
export const bankCoopRun = (g: Game, room: string, run: number, slot: number, withBonus: boolean, dexBase: Pokedex): BankDelta =>
  bank(local, bankKey(room, run), coopPayout(g, slot), withBonus, (d) => {
    if (d.coins > 0) depositPokeDollars(d.coins)
    if (d.steps > 0 || d.eggs.length > 0) bankEggs(d.steps, d.eggs.slice(0, EGGS.perRun))
    if (paysAnything(d) || d.before === null) recordRunProgress(d.summary, d.before, Math.max(0, EGGS.perRun - g.eggs.found.length))
    // Their own Pokémon's forms only count as caught (`playerDexLog`), not the teammates'.
    updateSave((save) => ({ ...save, dex: mergeDex(save.dex, recordRun(dexBase, playerDexLog(g, slot))) }))
  })

/** Reports a heal to PostHog: when, where and how long it took. */
export const reportHeal = (room: string, tick: number, ms: number) => track('coop_heal', { room, tick, ms: Math.round(ms) })

type NavigatorExtras = Navigator & { connection?: { effectiveType?: string }; userAgentData?: { platform?: string; mobile?: boolean } }

/** The network type (`4g`, `3g`… where the browser says) and the platform, for `coop_net`. */
const device = () => {
  const nav: NavigatorExtras = navigator
  const ua = nav.userAgentData
  return {
    effectiveType: nav.connection?.effectiveType ?? null,
    platform: (ua?.platform || nav.platform || null)?.slice(0, 24) ?? null,
    mobile: (ua?.mobile ?? /Mobi|Android|iPhone|iPad/.test(nav.userAgent)) ? (1 as const) : (0 as const),
  }
}

/** The runs whose `coop_net` went out (`room:run`), and whether it was the final one. */
const netSent = new Map<string, 'partial' | 'final'>()

/** The last `coop_net` built on this page, for `ps.coop('net')`. */
let lastNet: unknown = null
export const lastCoopNet = () => lastNet

export type CoopNetOutcome = 'victory' | 'wipe' | 'endless' | 'left' | 'hidden' | 'unload'

/**
 * Builds this player's `coop_net` for a run (`net`: its stats, kept by the
 * shell from the run's start) without sending it, for the dev console too.
 */
export const coopNetPayload = (client: CoopClient, runner: Runner, net: NetStats, outcome: CoopNetOutcome, perf: RunPerf) => {
  const g = runner.game
  const where = client.state().where
  return {
    room: runner.room,
    run: runner.start.id,
    seat: runner.seat,
    seats: g.players.length,
    outcome,
    final: outcome === 'hidden' ? (0 as const) : (1 as const),
    minute: Math.floor(g.time / 60),
    difficulty: g.difficulty,
    ...netSummary(net, performance.now(), { underruns: runner.stats.underruns, heals: runner.stats.heals.length, syncs: runner.stats.syncs.length }, where),
    ...device(),
    ...perf,
  }
}

/**
 * Sends this player's `coop_net` for a run: the final one once (the end, or
 * the page unloading), and before it at most one partial (the page hidden
 * mid-run, by beacon, in case it never comes back). Logged instead in dev.
 */
export const reportCoopNet = (client: CoopClient, runner: Runner, net: NetStats, outcome: CoopNetOutcome, perf: RunPerf) => {
  const key = `${runner.room}:${runner.start.id}`
  const sent = netSent.get(key)
  const final = outcome !== 'hidden'
  if (sent === 'final' || (sent === 'partial' && !final)) return
  netSent.set(key, final ? 'final' : 'partial')
  const payload = coopNetPayload(client, runner, net, outcome, perf)
  lastNet = payload
  if (import.meta.env.DEV) console.info('coop_net', payload)
  track('coop_net', payload, { beacon: outcome === 'hidden' || outcome === 'unload' })
}

/** Events that are one player's own: only their client shows and plays them (the runner notes who pushed each). */
const PERSONAL: ReadonlySet<GameEvent['kind']> = new Set<GameEvent['kind']>([
  'cast', 'moveSound', 'heal', 'hurt', 'special', 'stance', 'megaChoice', 'megaStone', 'megaStart', 'mega', 'megaEnd', 'megaReady',
  'shinyPlayer', 'evolve', 'branchChoice', 'ability', 'evolved', 'moveEvolved', 'duoFused', 'curse', 'pokeball', 'shinyOffer',
  'tm', 'tmLearned', 'tmMastered', 'banish', 'consumable', 'revive', 'riftFall', 'guard',
  'evoItem', 'evoHeld', 'maxRevive', 'stolen', 'awaken', 'awakened',
])

/**
 * Events tied to solo's progression that co-op never shows (`COOP_LOCKS`): a
 * legendary's defeat counting toward its capture, a night boss ticking the
 * Caça aos Fantasmas off (the Noite das Bruxas is off in co-op anyway).
 */
const SOLO_ONLY: ReadonlySet<GameEvent['kind']> = new Set<GameEvent['kind']>(['legendBeaten', 'nightBoss'])

/**
 * Whether an event of the simulation is this client's to see and hear: the
 * world's (a boss, the biome, the level-up the team shares) are everyone's;
 * a player's own (`PERSONAL`) only theirs, by `actor`, the slot acting when
 * the game pushed it.
 */
export const coopEventFor = (g: Game, e: GameEvent, actor: number) => !SOLO_ONLY.has(e.kind) && (!PERSONAL.has(e.kind) || actor === localPlayer(g).slot)

/** Dev: bots in this tab, each a full client of its own (its own socket, game and guest id). */
const bots: Bot[] = []
let botLoop: number | null = null

const memoryStore = (): Store => {
  const data = new Map<string, string>()
  return { get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v), remove: (k) => void data.delete(k), keys: () => [...data.keys()] }
}

/** Dev: the relays the tab's bots reach instead of this tab's (a latency lab puts them elsewhere), or null. */
let botRelays: { url: string | null; vps: VpsUrls } | null = null

/** Dev: the bots' relays as `cf=URL&sa=URL&us=URL` (any of them; the rest are this tab's), or null for this tab's. */
export const setBotRelays = (spec: string | null) => {
  const q = spec ? new URLSearchParams(spec) : null
  botRelays = q ? { url: q.get('cf'), vps: { ...coopVpsUrls(), ...Object.fromEntries(VPS_HOMES.flatMap((h) => (q.get(h) ? [[h, q.get(h)]] : []))) } } : null
  return botRelays
}

/** Dev: the look each of the tab's bots wears (`botLook`). */
const botLooks = new Map<Bot, WireLook>()

/** The slots a dev bot dresses: worn, a follower, a trail and a plate, so a room or a run shows every kind arriving. */
const BOT_SLOTS = ['head', 'face', 'neck', 'back', 'follower', 'trail', 'plate'] as const satisfies readonly CosmeticSlot[]

/** Dev: bot `k`'s look, a different item of each slot per bot, every slot but one in turn (the Arena's moments too, its emote and effects). */
const botLook = (k: number): WireLook => {
  const look: Record<string, string> = {}
  BOT_SLOTS.forEach((slot, i) => {
    const ids = COSMETIC_IDS.filter((id) => slotOf(id) === slot)
    if (ids.length > 0 && (k + i) % BOT_SLOTS.length !== 0) look[slot] = ids[(k * 7 + i * 3) % ids.length]!
  })
  const arena = COSMETIC_IDS.filter((id) => !(BOT_SLOTS as readonly string[]).includes(slotOf(id)))
  const extra = arena[k % arena.length]
  if (extra) look[slotOf(extra)] = extra
  return look
}

/**
 * Dev: the look the tab's bot in `seat` wears, or null for another client.
 * The relay keeps only the looks the API vouches for, and a bot is a guest,
 * so this tab dresses its bots' seats itself (`main.ts`, as a run starts).
 */
export const tabBotLook = (seat: number): WireLook | null => {
  for (const [bot, look] of botLooks) if (bot.client.state().seat === seat) return look
  return null
}

/** Dev: `n` bots join room `code` (they set a loadout and get ready; the soak's bots in a tab). */
export const addBots = async (code: string, n: number) => {
  const url = coopUrl()
  if (!url) return []
  const joined: number[] = []
  for (let i = 0; i < n; i++) {
    const k = bots.length
    const deps = browserDeps(botRelays?.url ?? url, memoryStore(), async () => null, () => `Bot ${k + 1}`)
    const bot = createBot(botRelays ? { ...deps, vps: botRelays.vps } : deps, { seed: 7 + k * 31, vote: false })
    bots.push(bot)
    const res = await bot.client.join(code)
    if (!res.ok) continue
    // Each bot wears a look of its own (`botLook`), so a room shows every seat's look arriving.
    const look = botLook(k)
    botLooks.set(bot, look)
    bot.client.setLoadout({ ...botPick(k + 1), look })
    setTimeout(() => bot.client.setReady(true), 300)
    // After a run the relay clears everyone's ready: a bot is ready for "Jogar de novo" a moment later.
    bot.client.on((e) => {
      const seat = bot.client.state().seat
      if (e.kind === 'room' && e.room.phase === 'ended' && e.room.members.some((m) => m.seat === seat && !m.ready)) setTimeout(() => bot.client.setReady(true), 800)
    })
    joined.push(res.seat)
  }
  if (botLoop === null) {
    let last = performance.now()
    botLoop = window.setInterval(() => {
      const now = performance.now()
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      for (const b of bots) b.frame(dt)
    }, 16)
  }
  return joined
}

/** Dev: in an Arena match, each of the tab's bots says quick chat line `msg` and pings `ping` where it stands, to see both from a teammate's screen. */
export const botsTalk = (msg: QuickChat, ping: PingKind) => {
  for (const b of bots) {
    const r = b.client.state().runner
    const me = r?.game.players[r.slot]
    b.client.input({ k: 'chat', msg })
    if (me) b.client.input({ k: 'ping', ping, x: Math.round(me.x), y: Math.round(me.y) })
  }
  return bots.length
}

export const removeBots = () => {
  for (const b of bots.splice(0)) b.client.leave()
  botLooks.clear()
  if (botLoop !== null) clearInterval(botLoop)
  botLoop = null
}

/** Dev: where each of the tab's bots is (its room, status and round trip), for `ps.coop()`. */
export const botStates = () =>
  bots.map((b) => {
    const st = b.client.state()
    return { code: st.code, status: st.status.kind, seat: st.seat, rtt: Math.round(st.rtt) }
  })

/** Dev: the tab's bots stop kiting and walk into the horde (staging a faint, a revive, the team's wipe). */
export const surrenderBots = () => {
  for (const b of bots) b.surrender()
  return bots.length
}

