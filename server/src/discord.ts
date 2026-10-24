import { dailyChallenge, ribbonsDue } from '../../src/game/challenge'
import { brasiliaDay, previousDay } from '../../src/game/day'
import { outbreakOf } from '../../src/game/outbreak'
import { isRecord } from '../../src/game/parse'
import type { Suggestion } from '../../src/game/suggestions'
import { CHANGELOG } from '../../src/site/changelog'
import type { Sql } from './db'
import type { BugReports } from './bugReports'
import { commandOf, STAFF_COMMANDS } from './discordCommands'
import {
  challengeMessage,
  giftRefusalText,
  greetMessage,
  introDecision,
  NOT_ADDED,
  outbreakMessage,
  patchMessage,
  patchPlan,
  podiumMessage,
  emptyMessage,
  reviewDecision,
  reviewedColor,
  reviewedNote,
  reviewMessage,
  staffReply,
  welcomeMessage,
  type OutgoingMessage,
} from './discordMessages'
import { loadKnowledge } from './gameKnowledge'
import { writeIdea, type OpenRouterConfig } from './ideaWriter'
import type { RankingStore } from './ranking'
import { agentPrompt, agentSystem, runAgent } from './staffAgent'
import { parseWho, type StaffDesk } from './staffDesk'
import type { StaffRank } from './staffGifts'
import type { CoopBeta } from './coopBeta'
import { messageLink, readTools, staffActions, staffTools, type Outcome, type Staff, type StaffTurn } from './staffTools'
import type { SuggestionStore } from './suggestions'

/**
 * The community Discord's bot (`scripts/discord/setup.mjs` builds the server):
 * - the introduction gate: a newcomer is pinged in #introductions as they
 *   join, and a real introduction there earns the Trainer role (only
 *   Trainers talk elsewhere), with a welcome;
 * - #patch-notes gets each new changelog update when the API boots;
 * - #daily-challenge and #daily-outbreak get the day's challenge and outbreak
 *   when the Brasília day starts, and the challenge's podium once its day
 *   settled (`ribbonsDue`, with the ribbons);
 * - #idea-review (staff only) gets each idea posted in the game, with ✅ and
 *   ❌ under it: a staff reaction puts it on the board's Backlog or hides it
 *   (`reviewDecision`). Ideas it missed are posted on the next round of
 *   daily posts, and reactions it missed are read when the gateway connects;
 * - staff (Dev, Moderator, the owner) tag it in any channel, often replying
 *   to a player, and an LLM on OpenRouter does what they ask with the tools
 *   in `staffTools.ts` (`staffAgent.ts`): answer about the game or a player,
 *   put an idea on the board's Backlog (credited to the player's linked
 *   game account, or the staff member's), file a bug report, send a gift
 *   within the staff's allowance (`staffGifts.ts`, logged in #mod-chat);
 * - the same as slash commands for staff (`discordCommands.ts`): `/ask`,
 *   `/idea`, `/bug`, `/player` and `/gift`, registered on the server at
 *   boot. Anyone else is refused (tags from them are ignored).
 * Channels and roles are found by name, whatever emoji staff put in front. Every post claims a key in
 * `discord_posts` first, so two instances (a rolling deploy) never post twice.
 */

const API = 'https://discord.com/api/v10'
const GATEWAY = 'wss://gateway.discord.gg/?v=10&encoding=json'

/** GUILDS, GUILD_MEMBERS, GUILD_MESSAGES, GUILD_MESSAGE_REACTIONS and MESSAGE_CONTENT (GUILD_MEMBERS and MESSAGE_CONTENT are privileged: on in the Developer Portal). */
const INTENTS = (1 << 0) | (1 << 1) | (1 << 9) | (1 << 10) | (1 << 15)

/** Close codes that retrying won't fix: a bad token, a bad intent. */
const FATAL_CLOSES = new Set([4004, 4010, 4011, 4012, 4013, 4014])

/** An interaction's type for a slash command, and the flag that shows an answer only to who asked. */
const APPLICATION_COMMAND = 2
const EPHEMERAL = 1 << 6

/** How often the daily posts are looked for. */
const EVERY_MS = 15 * 60_000

const NAMES = {
  introductions: 'introductions',
  patchNotes: 'patch-notes',
  challenge: 'daily-challenge',
  outbreak: 'daily-outbreak',
  ideaReview: 'idea-review',
  staffLog: 'mod-chat',
  trainer: 'Trainer',
  staff: ['Dev', 'Moderator'],
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
  /** The key whose post became `messageId`. */
  keyOf: async (messageId: string) => (await sql<{ key: string }[]>`select key from discord_posts where message_id = ${messageId}`)[0]?.key ?? null,
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

/** A name without the emojis and separators staff put in front (`🪪》introductions` → `introductions`). */
export const bareName = (name: string) => name.replace(/^[^\p{L}\p{N}]+/u, '')

/** `name → id` of a list of channels, roles or forum tags, by their bare names (`bareName`). */
export const idsByName = (list: unknown) =>
  new Map(
    (Array.isArray(list) ? list : []).flatMap((x) => {
      const raw = isRecord(x) ? str(x.name) : null
      const name = raw && bareName(raw)
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

/** A message as the idea intake reads it. */
export type ChatMessage = { id: string; userId: string; bot: boolean; content: string; at: number }

export const chatMessage = (m: unknown): ChatMessage | null => {
  if (!isRecord(m) || !isRecord(m.author)) return null
  const id = str(m.id)
  const userId = str(m.author.id)
  const at = Date.parse(str(m.timestamp) ?? '')
  if (!id || !userId || Number.isNaN(at)) return null
  return { id, userId, bot: m.author.bot === true, content: str(m.content) ?? '', at }
}

/** How close a player's messages follow each other to read as one suggestion, and how many at most. */
const BURST = { gapMs: 5 * 60_000, max: 6 } as const

/**
 * The player's suggestion, oldest first: the message staff replied to and
 * the ones its author sent right before it (`before`, newest first, as
 * Discord lists history), each within `BURST.gapMs` of the next.
 */
export const suggestionBurst = (replied: ChatMessage, before: readonly ChatMessage[]) => {
  const burst = [replied]
  for (const m of before) {
    if (burst.length >= BURST.max || m.userId !== replied.userId || burst[0]!.at - m.at > BURST.gapMs) break
    burst.unshift(m)
  }
  return burst.map((m) => m.content.trim()).filter(Boolean)
}

/** How a message's author shows on the server: their nickname there, else their Discord display name. */
export const displayName = (m: unknown) => {
  const member = isRecord(m) && isRecord(m.member) ? m.member : null
  const user = isRecord(m) && isRecord(m.author) ? m.author : member && isRecord(member.user) ? member.user : null
  return (member && str(member.nick)) ?? (user && (str(user.global_name) ?? str(user.username))) ?? 'someone'
}

/** A reaction from the gateway or a message's reactions: the emoji's name (a custom emoji's name never matches `reviewDecision`). */
const emojiName = (v: unknown) => (isRecord(v) && isRecord(v.emoji) ? (str(v.emoji.name) ?? '') : '')

/**
 * Starts the bot: patch notes now, the daily posts every `EVERY_MS` and the
 * gateway for the gate and the idea review. Never throws. `reviewIdea` hands
 * it an idea just posted in the game (dropped while the bot is starting: the
 * daily round posts it).
 */
export const startDiscord = (
  config: DiscordConfig,
  deps: {
    store: DiscordStore
    ranking: Pick<RankingStore, 'podium'>
    ideas: Pick<SuggestionStore, 'pending' | 'review' | 'accountOf' | 'add'>
    /** The staff's desk: players and gifts (`staffDesk.ts`). */
    desk: StaffDesk
    bugs: Pick<BugReports, 'fileFromDiscord'>
    /** The co-op beta's list on PostHog (`coopBeta.ts`); null without a personal API key, and `/coop-beta` says so. */
    beta: CoopBeta | null
    /** The staff's LLM; null, the bot ignores tags and `/ask` and `/idea` say so. */
    openRouter: OpenRouterConfig | null
  },
) => {
  const call = restClient(config.token)
  const { store, ranking, ideas, desk, bugs, beta, openRouter } = deps
  const guild = `/guilds/${config.guildId}`
  let reviewIdea: ((idea: Suggestion) => Promise<void>) | null = null

  /** Posts `message` in `channelId` once per `key`; the message's id, or null when the key was taken. A failure gives the key back for the next try. */
  const post = async (key: string, channelId: string, message: OutgoingMessage | null) => {
    if (!(await store.claim(key)) || !message) return null
    try {
      const sent = await call('POST', `/channels/${channelId}/messages`, message)
      const id = isRecord(sent) ? str(sent.id) : null
      if (id) await store.setMessage(key, id)
      return id
    } catch (err) {
      await store.release(key)
      throw err
    }
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
    const review = channel(NAMES.ideaReview)
    const staffLog = channel(NAMES.staffLog)
    const trainer = role(NAMES.trainer)
    const staffRoles = new Set(NAMES.staff.map(role).filter((id) => id !== null))
    const guildInfo = await call('GET', guild)
    const ownerId = isRecord(guildInfo) ? str(guildInfo.owner_id) : null
    let botId: string | null = null

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

    /** Posts an idea for review once, with ✅ and ❌ already under it so staff decide with a tap. */
    const postIdea = async (idea: Suggestion) => {
      if (!review) return
      const id = await post(`idea:${idea.id}`, review, reviewMessage(idea))
      if (!id) return
      for (const emoji of ['✅', '❌']) await call('PUT', `/channels/${review}/messages/${id}/reactions/${encodeURIComponent(emoji)}/@me`)
    }
    reviewIdea = postIdea

    /** A reaction on a review message: moves its idea when it decides something and the idea still waits, then marks the message. `by` is null when read from the history. */
    const decide = async (messageId: string, emoji: string, by: string | null) => {
      const decision = reviewDecision(emoji)
      const key = decision && review ? await store.keyOf(messageId) : null
      if (!decision || !review || !key?.startsWith('idea:')) return
      const ideaId = key.slice('idea:'.length)
      if (!(await ideas.review(ideaId, decision))) return
      console.log(`suggestion ${ideaId} reviewed in discord: ${decision}${by ? ` by ${by}` : ''}`)
      const message = await call('GET', `/channels/${review}/messages/${messageId}`)
      const embeds = isRecord(message) && Array.isArray(message.embeds) ? message.embeds.filter(isRecord).map((e) => ({ ...e, color: reviewedColor(decision) })) : []
      await call('PATCH', `/channels/${review}/messages/${messageId}`, { content: reviewedNote(decision, by), embeds, allowed_mentions: { parse: [] } })
    }

    /** Reactions added while the bot was away: a message staff reacted to one way only (besides the bot's own ✅ and ❌). */
    const sweepReviews = async () => {
      if (!review) return
      const history = await call('GET', `/channels/${review}/messages?limit=100`)
      for (const m of Array.isArray(history) ? history : []) {
        const id = isRecord(m) ? str(m.id) : null
        if (!id || !isRecord(m) || !Array.isArray(m.reactions)) continue
        const picked = m.reactions.filter((r) => isRecord(r) && typeof r.count === 'number' && r.count > (r.me === true ? 1 : 0)).map(emojiName)
        const decisions = new Set(picked.map(reviewDecision).filter((d) => d !== null))
        const only = picked.find((e) => reviewDecision(e) !== null)
        if (decisions.size === 1 && only) await decide(id, only, null)
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
      // Ideas posted while the bot was starting, or whose post failed.
      if (review) for (const idea of await ideas.pending()) await postIdea(idea)
    }
    const tick = () => void daily().catch((err) => console.error('discord daily posts failed', err))
    tick()
    setInterval(tick, EVERY_MS).unref()

    const gateOn = intro !== null && trainer !== null
    if (!gateOn) console.warn('discord: the introduction gate is off (no #introductions or Trainer role)')

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
      if (m.bot || !intro || !trainer) return
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
      if (!intro) return
      const history = await call('GET', `/channels/${intro}/messages?limit=50`)
      const messages = (Array.isArray(history) ? history : []).map(introMessage).filter((m): m is IntroMessage => m !== null)
      // Each author's latest introduction with words; the gate checks whether they're a Trainer already.
      const latest = new Map<string, IntroMessage>()
      for (const m of messages) {
        if (!latest.has(m.userId) && introDecision({ bot: m.bot, trainer: false, content: m.content }) === 'welcome') latest.set(m.userId, m)
      }
      for (const m of latest.values()) await gate(m, false)
    }

    /** The owner (Pedro), staff (Dev, Moderator), or null for anyone else. */
    const rankOf = (userId: string, roles: readonly string[]): StaffRank | null =>
      userId === ownerId ? 'owner' : roles.some((r) => staffRoles.has(r)) ? 'staff' : null

    const staffOf = async (userId: string, name: string, rank: StaffRank): Promise<Staff> => ({ discordId: userId, name, rank, account: await ideas.accountOf(userId) })

    const actionsFor = (turn: StaffTurn) =>
      staffActions(
        {
          desk,
          ideas,
          bugs,
          beta,
          log: async (message) => {
            if (staffLog) await call('POST', `/channels/${staffLog}/messages`, message)
          },
        },
        turn,
      )

    /**
     * A staff message tagging the bot, in any channel: the LLM answers with
     * every tool (`staffAgent.ts`), reading the message it replies to and
     * that player's messages just before it. Once per message.
     */
    const answerMention = async (data: Record<string, unknown>, writer: OpenRouterConfig) => {
      const tag = chatMessage(data)
      const channelId = str(data.channel_id)
      const roles = isRecord(data.member) ? (strings(data.member.roles) ?? []) : []
      if (!tag || tag.bot || !channelId || !botId || !tag.content.match(new RegExp(`<@!?${botId}>`))) return
      const rank = rankOf(tag.userId, roles)
      if (!rank || !(await store.claim(`take:${tag.id}`))) return
      try {
        await call('POST', `/channels/${channelId}/typing`)
        const replied = chatMessage(data.referenced_message)
        const player = replied && !replied.bot && replied.userId !== tag.userId ? replied : null
        const history = player ? await call('GET', `/channels/${channelId}/messages?before=${player.id}&limit=10`) : []
        const before = (Array.isArray(history) ? history : []).map(chatMessage).filter((m): m is ChatMessage => m !== null)
        const turn: StaffTurn = {
          staff: await staffOf(tag.userId, displayName(data), rank),
          ref: tag.id,
          link: messageLink(config.guildId, channelId, tag.id),
          player: player && {
            discordId: player.userId,
            name: displayName(data.referenced_message),
            account: await ideas.accountOf(player.userId),
            messages: suggestionBurst(player, before),
          },
        }
        const said = tag.content.replace(new RegExp(`<@!?${botId}>`, 'g'), '').trim()
        const earlier = replied?.userId === botId ? replied.content : null
        const out = await runAgent(writer, { system: agentSystem(knowledge), prompt: agentPrompt(turn, said, earlier), tools: staffTools(actionsFor(turn)) })
        const text = [out.text, ...out.receipts].filter(Boolean).join('\n\n')
        await call('POST', `/channels/${channelId}/messages`, staffReply(text || (out.embeds.length ? '' : 'Done.'), { replyTo: tag.id, embeds: out.embeds }))
      } catch (err) {
        await call('PUT', `/channels/${channelId}/messages/${tag.id}/reactions/${encodeURIComponent('⚠️')}/@me`).catch(() => undefined)
        throw err
      }
    }

    /** What a command or an action came to, as its reply: an idea's embed, a receipt as it is, or the text. */
    const outcomeReply = (out: Outcome) => staffReply(out.embed ? '' : (out.receipt ?? out.text), { embeds: out.embed ? [out.embed] : [] })

    /** A slash command's answer (`STAFF_COMMANDS`). */
    const runCommand = async (name: string, options: Map<string, string | number>, staff: Staff, ref: string, writer: OpenRouterConfig | null) => {
      const opt = (key: string) => {
        const v = options.get(key)
        return typeof v === 'string' ? v : v === undefined ? '' : String(v)
      }
      const turn: StaffTurn = { staff, ref, link: null, player: null }
      const noLlm = staffReply('The bot has no OpenRouter key yet, so it can’t write or answer. Ask Pedro to set `OPENROUTER_API_KEY`.')
      switch (name) {
        case 'ask': {
          if (!writer) return noLlm
          const out = await runAgent(writer, { system: agentSystem(knowledge), prompt: agentPrompt(turn, opt('question')), tools: readTools(actionsFor(turn)) })
          return staffReply(`> ${opt('question').slice(0, 300)}\n\n${out.text || 'I have no answer.'}`)
        }
        case 'idea': {
          if (!writer) return noLlm
          const who = opt('player') ? parseWho(opt('player')) : null
          const found = who ? await desk.find(who) : null
          if (found && !found.ok) return staffReply(giftRefusalText('unknown', null, null))
          // Credited to the player named (with a handle), else to the staff member.
          const player = found?.ok ? found.player : null
          const forTurn: StaffTurn = player?.handle
            ? { ...turn, player: { discordId: player.discordId ?? '', name: `@${player.handle}`, account: { id: player.id, handle: player.handle }, messages: [] } }
            : turn
          const draft = await writeIdea(writer, { suggestion: [], note: opt('text') })
          return draft ? outcomeReply(await actionsFor(forTurn).addIdea(draft)) : staffReply(NOT_ADDED.none)
        }
        case 'bug':
          return outcomeReply(await actionsFor(turn).reportBug(opt('text')))
        case 'player':
          return outcomeReply(await actionsFor(turn).lookupPlayer(opt('who')))
        case 'gift': {
          const amount = options.get('amount')
          return outcomeReply(await actionsFor(turn).sendGift(opt('player'), opt('kind'), typeof amount === 'number' ? amount : null))
        }
        case 'coop-beta':
          return outcomeReply(await actionsFor(turn).coopBeta(opt('subcommand'), opt('player')))
        default:
          return staffReply('I don’t know that command.')
      }
    }

    /** Answers a slash command: refuses anyone but staff (only they see it), defers (the LLM is slow), then edits the answer in. Once per interaction. */
    const answerCommand = async (data: Record<string, unknown>, writer: OpenRouterConfig | null) => {
      const id = str(data.id)
      const token = str(data.token)
      const appId = str(data.application_id)
      const command = commandOf(data.data)
      const member = isRecord(data.member) ? data.member : null
      const userId = member && isRecord(member.user) ? str(member.user.id) : null
      if (!id || !token || !appId || !command || !userId || !member) return
      if (!(await store.claim(`slash:${id}`))) return
      const callback = (body: unknown) => call('POST', `/interactions/${id}/${token}/callback`, body)
      const rank = rankOf(userId, strings(member.roles) ?? [])
      if (!rank) return void (await callback({ type: 4, data: { content: 'Only staff can use this.', flags: EPHEMERAL } }))
      await callback({ type: 5, data: { flags: command.name === 'player' ? EPHEMERAL : 0 } })
      const edit = (message: OutgoingMessage) => call('PATCH', `/webhooks/${appId}/${token}/messages/@original`, message)
      try {
        await edit(await runCommand(command.name, command.options, await staffOf(userId, displayName(data), rank), id, writer))
      } catch (err) {
        await edit(staffReply('⚠️ Something went wrong; the details are in the API log.')).catch(() => undefined)
        throw err
      }
    }

    const knowledge = loadKnowledge()
    let commandsSet = false

    connectGateway(config.token, (type, data) => {
      if (type === 'READY') {
        botId = isRecord(data) && isRecord(data.user) ? str(data.user.id) : null
        const appId = isRecord(data) && isRecord(data.application) ? str(data.application.id) : null
        if (gateOn) void sweep().catch((err) => console.error('discord sweep failed', err))
        void sweepReviews().catch((err) => console.error('discord review sweep failed', err))
        if (appId && !commandsSet) {
          commandsSet = true
          void call('PUT', `/applications/${appId}/guilds/${config.guildId}/commands`, STAFF_COMMANDS).catch((err) => {
            commandsSet = false
            console.error('discord commands failed', err)
          })
        }
      }
      if (type === 'INTERACTION_CREATE' && isRecord(data) && data.guild_id === config.guildId && data.type === APPLICATION_COMMAND) {
        void answerCommand(data, openRouter).catch((err) => console.error('discord command failed', err))
      }
      if (type === 'MESSAGE_REACTION_ADD' && isRecord(data) && data.channel_id === review && data.guild_id === config.guildId) {
        const messageId = str(data.message_id)
        const userId = str(data.user_id)
        if (messageId && userId && userId !== botId) void decide(messageId, emojiName(data), userId).catch((err) => console.error('discord review failed', err))
      }
      if (gateOn && type === 'GUILD_MEMBER_ADD' && isRecord(data) && data.guild_id === config.guildId && isRecord(data.user) && data.user.bot !== true) {
        const userId = str(data.user.id)
        if (userId) void post(`greet:${userId}`, intro, greetMessage(userId)).catch((err) => console.error('discord greet failed', err))
      }
      if (openRouter && type === 'MESSAGE_CREATE' && isRecord(data) && data.guild_id === config.guildId && data.channel_id !== intro) {
        void answerMention(data, openRouter).catch((err) => console.error('discord staff mention failed', err))
      }
      if (!gateOn || type !== 'MESSAGE_CREATE' || !isRecord(data) || data.channel_id !== intro || data.guild_id !== config.guildId) return
      const m = introMessage(data)
      if (m) void gate(m, true).catch((err) => console.error('discord gate failed', err))
    })
    if (!openRouter) console.warn('discord: no OPENROUTER_API_KEY, so tagging the bot does nothing and /ask and /idea say so')
    console.log('discord bot on')
  }

  void run().catch((err) => console.error('discord failed to start', err))
  return { reviewIdea: (idea: Suggestion) => void reviewIdea?.(idea).catch((err) => console.error(`suggestion ${idea.id} didn't reach #idea-review`, err)) }
}
