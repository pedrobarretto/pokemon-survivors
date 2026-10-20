import { dailyChallenge, ribbonsDue } from '../../src/game/challenge'
import { brasiliaDay, previousDay } from '../../src/game/day'
import { outbreakOf } from '../../src/game/outbreak'
import { isRecord } from '../../src/game/parse'
import { CHANGELOG } from '../../src/site/changelog'
import type { Sql } from './db'
import type { CreatorId } from '../../src/data/creators'
import {
  challengeMessage,
  greetMessage,
  introDecision,
  liveMessage,
  outbreakMessage,
  patchMessage,
  patchPlan,
  podiumMessage,
  emptyMessage,
  welcomeMessage,
  type OutgoingMessage,
} from './discordMessages'
import type { RankingStore } from './ranking'

/**
 * The community Discord's bot (`scripts/discord/setup.mjs` builds the server):
 * - the introduction gate: a newcomer is pinged in #introductions as they
 *   join, and a real introduction there earns the Trainer role (only
 *   Trainers talk elsewhere), with a welcome;
 * - #patch-notes gets each new changelog update when the API boots;
 * - #daily-challenge and #daily-outbreak get the day's challenge and outbreak
 *   when the Brasília day starts, and the challenge's podium once its day
 *   settled (`ribbonsDue`, with the ribbons);
 * - #creators hears when a content creator goes live (`live`).
 * Channels and roles are found by name. Every post claims a key in
 * `discord_posts` first, so two instances (a rolling deploy) never post twice.
 */

const API = 'https://discord.com/api/v10'
const GATEWAY = 'wss://gateway.discord.gg/?v=10&encoding=json'

/** GUILDS, GUILD_MEMBERS, GUILD_MESSAGES and MESSAGE_CONTENT (both privileged: on in the Developer Portal). */
const INTENTS = (1 << 0) | (1 << 1) | (1 << 9) | (1 << 15)

/** Close codes that retrying won't fix: a bad token, a bad intent. */
const FATAL_CLOSES = new Set([4004, 4010, 4011, 4012, 4013, 4014])

/** How often the daily posts are looked for. */
const EVERY_MS = 15 * 60_000

const NAMES = {
  introductions: 'introductions',
  patchNotes: 'patch-notes',
  challenge: 'daily-challenge',
  outbreak: 'daily-outbreak',
  creators: 'creators',
  trainer: 'Trainer',
  patchPing: 'Patch Notes Ping',
  challengePing: 'Daily Challenge Ping',
} as const

export type DiscordConfig = { token: string; guildId: string }

/** What the bot already did, by key. */
export const discordStore = (sql: Sql) => ({
  /** Takes `key`; false when it was taken already (by this or another instance). */
  claim: async (key: string) => (await sql`insert into discord_posts (key) values (${key}) on conflict (key) do nothing returning key`).length > 0,
  /** Takes every key at once, the ones already taken left as they are. */
  claimAll: async (keys: readonly string[]) => {
    if (keys.length) await sql`insert into discord_posts (key) select unnest(${sql.array([...keys])}::text[]) on conflict (key) do nothing`
  },
  /** Gives `key` back after a post that failed, so the next try posts it. */
  release: async (key: string) => {
    await sql`delete from discord_posts where key = ${key}`
  },
  setMessage: async (key: string, messageId: string) => {
    await sql`update discord_posts set message_id = ${messageId} where key = ${key}`
  },
  messageOf: async (key: string) => (await sql<{ message_id: string | null }[]>`select message_id from discord_posts where key = ${key}`)[0]?.message_id ?? null,
  /** The keys taken that start with `prefix`, without it. */
  taken: async (prefix: string) => (await sql<{ key: string }[]>`select key from discord_posts where starts_with(key, ${prefix})`).map((r) => r.key.slice(prefix.length)),
})

export type DiscordStore = ReturnType<typeof discordStore>

/** A Discord REST call as the bot, waiting out rate limits. Throws on any other error. */
export const restClient =
  (token: string) =>
  async (method: string, path: string, body?: unknown): Promise<unknown> => {
    for (;;) {
      const res = await fetch(`${API}${path}`, {
        method,
        headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'DiscordBot (https://www.pokemonsurvivors.com, 1)' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      if (res.status === 429) {
        const wait: unknown = await res.json().then((b: unknown) => (isRecord(b) ? b.retry_after : 1), () => 1)
        await new Promise((ok) => setTimeout(ok, (typeof wait === 'number' ? wait : 1) * 1000 + 100))
        continue
      }
      if (!res.ok) throw new Error(`discord ${method} ${path}: ${res.status} ${await res.text()}`)
      return res.status === 204 ? null : res.json()
    }
  }

const str = (v: unknown) => (typeof v === 'string' ? v : null)
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : null)

/** `name → id` of a list of channels or roles. */
export const idsByName = (list: unknown) =>
  new Map(
    (Array.isArray(list) ? list : []).flatMap((x) => {
      const name = isRecord(x) ? str(x.name) : null
      const id = isRecord(x) ? str(x.id) : null
      return name && id ? [[name, id] as const] : []
    }),
  )

/** A message in #introductions, from the gateway or the REST history. `roles` is null when the event didn't carry the member. */
type IntroMessage = { id: string; userId: string; bot: boolean; content: string; roles: readonly string[] | null }

const introMessage = (m: unknown): IntroMessage | null => {
  if (!isRecord(m) || !isRecord(m.author)) return null
  const id = str(m.id)
  const userId = str(m.author.id)
  if (!id || !userId) return null
  return { id, userId, bot: m.author.bot === true, content: str(m.content) ?? '', roles: isRecord(m.member) ? strings(m.member.roles) : null }
}

/**
 * A gateway connection that hands every dispatch to `onEvent`. It heartbeats,
 * and on any close (or a missed heartbeat ack) connects again from scratch
 * after a backoff: whatever it missed meanwhile, `READY` lets `onEvent` catch up.
 */
const connectGateway = (token: string, onEvent: (type: string, data: unknown) => void) => {
  let backoff = 5_000
  const open = () => {
    const ws = new WebSocket(GATEWAY)
    let beat: ReturnType<typeof setInterval> | undefined
    let seq: number | null = null
    let acked = true
    const send = (op: number, d: unknown) => ws.send(JSON.stringify({ op, d }))
    ws.addEventListener('message', (ev) => {
      let msg: unknown
      try {
        msg = JSON.parse(String(ev.data))
      } catch {
        return
      }
      if (!isRecord(msg)) return
      if (typeof msg.s === 'number') seq = msg.s
      switch (msg.op) {
        case 10: {
          const interval = isRecord(msg.d) && typeof msg.d.heartbeat_interval === 'number' ? msg.d.heartbeat_interval : 41_250
          beat = setInterval(() => {
            if (!acked) return ws.close(4000, 'missed heartbeat ack')
            acked = false
            send(1, seq)
          }, interval)
          send(2, { token, intents: INTENTS, properties: { os: 'linux', browser: 'pokemon-survivors', device: 'pokemon-survivors' } })
          break
        }
        case 11:
          acked = true
          break
        case 1:
          send(1, seq)
          break
        case 7: // Reconnect
        case 9: // Invalid session
          ws.close(4000, 'reconnect')
          break
        case 0:
          if (msg.t === 'READY') backoff = 5_000
          onEvent(String(msg.t), msg.d)
      }
    })
    ws.addEventListener('close', (ev) => {
      clearInterval(beat)
      if (FATAL_CLOSES.has(ev.code)) return console.error(`discord gateway closed for good: ${ev.code} ${ev.reason}`)
      setTimeout(open, backoff)
      backoff = Math.min(backoff * 2, 5 * 60_000)
    })
  }
  open()
}

/**
 * Starts the bot: patch notes now, the daily posts every `EVERY_MS` and the
 * gateway for the gate. Never throws. `live` posts a creator's stream in
 * #creators (once per stream, keyed by its start), once the bot found the channel.
 */
export const startDiscord = (config: DiscordConfig, deps: { store: DiscordStore; ranking: Pick<RankingStore, 'podium'> }) => {
  const call = restClient(config.token)
  const { store, ranking } = deps
  const guild = `/guilds/${config.guildId}`

  /** Posts `message` in `channelId` once per `key`; a failure gives the key back for the next try. */
  const post = async (key: string, channelId: string, message: OutgoingMessage | null) => {
    if (!(await store.claim(key)) || !message) return
    try {
      const sent = await call('POST', `/channels/${channelId}/messages`, message)
      const id = isRecord(sent) ? str(sent.id) : null
      if (id) await store.setMessage(key, id)
    } catch (err) {
      await store.release(key)
      throw err
    }
  }

  /** #creators, once `run` found it. */
  let creators: string | null = null

  const live = (id: CreatorId, startedAt: Date) => {
    if (creators) void post(`live:${id}:${startedAt.toISOString()}`, creators, liveMessage(id)).catch((err) => console.error('discord live post failed', err))
  }

  const run = async () => {
    const channels = idsByName(await call('GET', `${guild}/channels`))
    const roles = idsByName(await call('GET', `${guild}/roles`))
    const channel = (name: string) => {
      const id = channels.get(name) ?? null
      if (!id) console.warn(`discord: no #${name}`)
      return id
    }
    const role = (name: string) => roles.get(name) ?? null
    const intro = channel(NAMES.introductions)
    const patchNotes = channel(NAMES.patchNotes)
    const challenge = channel(NAMES.challenge)
    const outbreak = channel(NAMES.outbreak)
    creators = channel(NAMES.creators)
    const trainer = role(NAMES.trainer)

    // Patch notes: what the changelog gained since the last boot.
    if (patchNotes) {
      const plan = patchPlan(CHANGELOG, new Set(await store.taken('patch:')))
      await store.claimAll(plan.skip.map((u) => `patch:${u.date}`))
      for (const update of plan.post) await post(`patch:${update.date}`, patchNotes, patchMessage(update, role(NAMES.patchPing)))
      const refreshId = plan.refresh && (await store.messageOf(`patch:${plan.refresh.date}`))
      if (plan.refresh && refreshId) {
        const { embeds } = patchMessage(plan.refresh, null)
        await call('PATCH', `/channels/${patchNotes}/messages/${refreshId}`, { embeds })
      }
    }

    const daily = async (now = new Date()) => {
      const today = brasiliaDay(now)
      const yesterday = previousDay(today)
      if (challenge) await post(`challenge:${today}`, challenge, challengeMessage(dailyChallenge(today), role(NAMES.challengePing)))
      if (outbreak) await post(`outbreak:${today}`, outbreak, outbreakMessage(today, outbreakOf(today)))
      if (challenge && ribbonsDue(yesterday, now)) {
        const { places, total } = await ranking.podium(yesterday)
        await post(`podium:${yesterday}`, challenge, podiumMessage(yesterday, places, total, role(NAMES.challengePing)))
      }
    }
    const tick = () => void daily().catch((err) => console.error('discord daily posts failed', err))
    tick()
    setInterval(tick, EVERY_MS).unref()

    if (!intro || !trainer) return console.warn('discord: the introduction gate is off (no #introductions or Trainer role)')

    /** The member's roles, or null when they left the server. */
    const rolesOf = async (userId: string) => {
      try {
        const member = await call('GET', `${guild}/members/${userId}`)
        return isRecord(member) ? strings(member.roles) : null
      } catch {
        return null
      }
    }

    /** The gate's answer to one message. `nudge`: whether an empty one gets a reply (not when sweeping old ones). */
    const gate = async (m: IntroMessage, nudge: boolean) => {
      if (m.bot) return
      const roles = m.roles ?? (await rolesOf(m.userId))
      if (!roles) return
      const decision = introDecision({ bot: m.bot, trainer: roles.includes(trainer), content: m.content })
      if (decision === 'welcome') {
        // The role every time (someone who left and came back gets it again), the welcome once per player.
        await call('PUT', `${guild}/members/${m.userId}/roles/${trainer}`)
        if (await store.claim(`welcome:${m.userId}`)) {
          await call('PUT', `/channels/${intro}/messages/${m.id}/reactions/${encodeURIComponent('👋')}/@me`)
          await call('POST', `/channels/${intro}/messages`, welcomeMessage(m.userId, m.id))
        }
      } else if (decision === 'empty' && nudge) {
        await post(`empty:${m.id}`, intro, emptyMessage(m.userId, m.id))
      }
    }

    /** Introductions posted while the bot was away (a deploy, a reconnect). */
    const sweep = async () => {
      const history = await call('GET', `/channels/${intro}/messages?limit=50`)
      const messages = (Array.isArray(history) ? history : []).map(introMessage).filter((m): m is IntroMessage => m !== null)
      // Each author's latest introduction with words; the gate checks whether they're a Trainer already.
      const latest = new Map<string, IntroMessage>()
      for (const m of messages) {
        if (!latest.has(m.userId) && introDecision({ bot: m.bot, trainer: false, content: m.content }) === 'welcome') latest.set(m.userId, m)
      }
      for (const m of latest.values()) await gate(m, false)
    }

    connectGateway(config.token, (type, data) => {
      if (type === 'READY') void sweep().catch((err) => console.error('discord sweep failed', err))
      if (type === 'GUILD_MEMBER_ADD' && isRecord(data) && data.guild_id === config.guildId && isRecord(data.user) && data.user.bot !== true) {
        const userId = str(data.user.id)
        if (userId) void post(`greet:${userId}`, intro, greetMessage(userId)).catch((err) => console.error('discord greet failed', err))
      }
      if (type !== 'MESSAGE_CREATE' || !isRecord(data) || data.channel_id !== intro || data.guild_id !== config.guildId) return
      const m = introMessage(data)
      if (m) void gate(m, true).catch((err) => console.error('discord gate failed', err))
    })
    console.log('discord bot on')
  }

  void run().catch((err) => console.error('discord failed to start', err))
  return { live }
}
