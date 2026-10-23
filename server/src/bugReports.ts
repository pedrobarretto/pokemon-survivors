import { BUG_REPORT, clip, type BugError, type BugPerf, type BugReport, type BugRun, type BugTech } from '../../src/game/bugReport'
import { isRecord } from '../../src/game/parse'
import type { Sql } from './db'
import { bareName, idsByName, restClient } from './discord'
import { rateLimiter } from './rateLimit'

/**
 * Bug reports from the game (`POST /bug-reports`): each one is stored, then
 * posted as a thread in the community Discord's #bug-reports forum by the bot
 * (when the API has one). Guests may report too, so the only brake is a rate
 * limit per IP and per account, kept in memory (each instance its own).
 */

/** `BUG_REPORT.perHour` hits per key in the last hour. */
const WINDOW_MS = 60 * 60_000

const OS: readonly (readonly [RegExp, string])[] = [
  [/Android/, 'Android'],
  [/iPhone|iPod/, 'iPhone'],
  [/iPad/, 'iPad'],
  [/Windows/, 'Windows'],
  [/CrOS/, 'ChromeOS'],
  [/Macintosh|Mac OS X/, 'Mac'],
  [/Linux/, 'Linux'],
]

const BROWSERS: readonly (readonly [RegExp, string])[] = [
  [/SamsungBrowser/, 'Samsung Internet'],
  [/EdgA?\/|EdgiOS/, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/Firefox|FxiOS/, 'Firefox'],
  [/CriOS|Chrome\//, 'Chrome'],
  [/Safari\//, 'Safari'],
]

/** `Android · Chrome`, from a user agent: what a thread's title says about the device. */
export const deviceHint = (ua: string) =>
  [OS.find(([re]) => re.test(ua))?.[1], BROWSERS.find(([re]) => re.test(ua))?.[1]].filter(Boolean).join(' · ') || 'unknown device'

/** The forum's tags a report gets (by name, as `scripts/discord/setup.mjs` makes them). */
export type BugTag = 'Open' | 'Mobile' | 'Desktop' | 'Crash'

/** A thread for the forum: its title, its messages (the first opens it, each under Discord's 2000 characters) and tags. */
export type BugThread = { name: string; messages: string[]; tags: BugTag[] }

/** Discord's limits (a thread's title, a message), with room to spare: it counts characters a little differently. */
const NAME_MAX = 100
const MESSAGE_MAX = 1900

/** Text that goes inside a code block can't close it: no two backticks in a row. */
const fenced = (s: string) => s.replace(/`(?=`)/g, '`​')

/** A code block of at most `max` characters, its fences kept. */
const codeBlock = (text: string, max: number) => `\`\`\`\n${clip(fenced(text), max - 8)}\n\`\`\``

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

const runLine = (r: BugRun) =>
  [
    `${r.partner} (${r.form}) Lv ${r.level} · ${r.difficulty} · ${clock(r.time)} · ${r.phase} · ${r.biome}`,
    `${r.enemies} enemies · ${r.projectiles} projectiles`,
    r.wave && `wave ${r.wave}`,
    r.boss && `boss ${r.boss}`,
    r.place && `in ${r.place}`,
  ]
    .filter(Boolean)
    .join(' · ')

/** Canvas memory and frame pace: `canvas: 412 (38.5 MB, peak 51.2 MB / 530) · frame 17.1 ms`. */
const perfLine = (p: BugPerf) => `canvas: ${p.canvases} (${p.canvasMb} MB, peak ${p.peakCanvasMb} MB / ${p.peakCanvases}) · frame ${p.frameMs ?? '?'} ms`

const errorMessage = (e: BugError, title: string) => {
  const head = `**${title}** (${e.kind}, ${e.at})\n`
  return head + codeBlock([e.message, e.source && `at ${e.source}`, e.stack].filter(Boolean).join('\n'), MESSAGE_MAX - head.length)
}

/** The technical info as short `key: value` lines (the errors go in messages of their own). */
const techLines = (tech: BugTech) =>
  [
    `version: ${tech.version}`,
    `device: ${deviceHint(tech.userAgent)}${tech.standalone ? ' (installed app)' : ''}`,
    `ua: ${tech.userAgent}`,
    `screen: ${tech.screen} @${tech.dpr}x · viewport ${tech.viewport}${tech.touch ? ' · touch' : ''}`,
    `memory: ${tech.memory ?? '?'} GB · cores: ${tech.cores ?? '?'} · heap: ${tech.heapMb ?? '?'} MB`,
    `locale: ${tech.locale} · up ${clock(tech.uptime)} · on ${tech.view || '?'}`,
    tech.perf && perfLine(tech.perf),
    tech.run && `run: ${runLine(tech.run)}`,
    tech.crash && `closed mid-run (${tech.crash.at}, ${tech.crash.version}): ${tech.crash.run ? runLine(tech.crash.run) : '?'} · heap ${tech.crash.heapMb ?? '?'} MB`,
    tech.crash?.perf && `  then ${perfLine(tech.crash.perf)}`,
  ].filter((l): l is string => Boolean(l))

/**
 * The thread a report becomes: titled by its first line and the device,
 * opened by who sent it, their words quoted and the technical info in a code
 * block (in a message of its own when both don't fit in one), then one message per error (the closed session's first, then the
 * newest). Mentions in the text never ping: the post sends
 * `allowed_mentions: { parse: [] }`.
 */
export const bugThread = (report: BugReport, from: string): BugThread => {
  const { tech } = report
  const crashed = tech?.crash != null
  const suffix = ` · ${tech ? deviceHint(tech.userAgent) : 'no tech info'}`
  const first = report.text.split('\n')[0]!
  const name = clip(`${crashed ? '💥 ' : ''}${clip(first, NAME_MAX - 30)}${suffix}`, NAME_MAX)
  const info = tech ? codeBlock(techLines(tech).join('\n'), 1400) : '_(sent without technical info)_'
  const quote = fenced(report.text).split('\n').map((l) => `> ${l}`).join('\n')
  const head = clip(`Report from ${from}${crashed ? ' after the game closed mid-run' : ''}:\n${quote}`, MESSAGE_MAX)
  const opening = `${head}\n${info}`
  const errors = [
    ...(tech?.crash?.error ? [errorMessage(tech.crash.error, 'Last error before the game closed')] : []),
    ...[...(tech?.errors ?? [])].reverse().map((e) => errorMessage(e, 'Error')),
  ]
  const device: BugTag[] = tech ? [/Android|iPhone|iPad|iPod|Mobi/.test(tech.userAgent) ? 'Mobile' : 'Desktop'] : []
  return { name, messages: [...(opening.length <= MESSAGE_MAX ? [opening] : [head, info]), ...errors], tags: ['Open', ...device, ...(crashed ? (['Crash'] as const) : [])] }
}

/** Where reports are kept, so none is lost when Discord is down or not set up. */
export const bugReportStore = (sql: Sql) => ({
  /** Stores a report; its id. */
  save: async (report: BugReport, userId: string | null) => {
    const [row] = await sql<{ id: string }[]>`
      insert into bug_reports (user_id, text, tech) values (${userId}, ${report.text}, ${report.tech ? sql.json(report.tech) : null}) returning id`
    return row!.id
  },
  /** The forum thread a report became. */
  posted: async (id: string, threadId: string) => {
    await sql`update bug_reports set thread_id = ${threadId} where id = ${id}`
  },
})

export type BugReportStore = ReturnType<typeof bugReportStore>

/** Posts a thread in the forum; its id (the thread's channel id). */
export type BugForum = { post: (thread: BugThread) => Promise<string> }

/** Discord's forum channel type. */
const FORUM = 15

/**
 * The #bug-reports forum through the bot: by `forumId` (`DISCORD_BUG_FORUM_ID`)
 * or else found by name among the server's channels, with its tags looked up
 * once. A lookup that fails is tried again on the next report.
 */
export const discordBugForum = (config: { token: string; guildId: string; forumId: string | null }): BugForum => {
  const call = restClient(config.token)
  const forumByName = async () => {
    const channels = await call('GET', `/guilds/${config.guildId}/channels`)
    const forum = (Array.isArray(channels) ? channels : []).find((c) => isRecord(c) && typeof c.name === 'string' && bareName(c.name) === 'bug-reports' && c.type === FORUM)
    if (!isRecord(forum) || typeof forum.id !== 'string') throw new Error('discord: no #bug-reports forum')
    return forum.id
  }
  const find = async () => {
    const id = config.forumId ?? (await forumByName())
    const channel = await call('GET', `/channels/${id}`)
    return { id, tags: idsByName(isRecord(channel) ? channel.available_tags : null) }
  }
  let found: ReturnType<typeof find> | null = null
  return {
    post: async (thread) => {
      found ??= find().catch((err: unknown) => {
        found = null
        throw err
      })
      const forum = await found
      const [opening, ...rest] = thread.messages
      const created = await call('POST', `/channels/${forum.id}/threads`, {
        name: thread.name,
        message: { content: opening, allowed_mentions: { parse: [] } },
        applied_tags: thread.tags.flatMap((t) => forum.tags.get(t) ?? []).slice(0, 5),
      })
      const threadId = isRecord(created) && typeof created.id === 'string' ? created.id : null
      if (!threadId) throw new Error('discord: the forum post came back without an id')
      for (const content of rest) await call('POST', `/channels/${threadId}/messages`, { content, allowed_mentions: { parse: [] } })
      return threadId
    },
  }
}

/** What sending a report came to: stored (and on its way to Discord), or past the rate limit. */
export type Submitted = { ok: true; id: string } | { ok: false; error: 'limit' }

/**
 * The route's side: the rate limit, then the store, then the forum in the
 * background (a slow or failing Discord never holds the player's answer;
 * the report is kept either way). `handleOf` names a signed-in sender.
 */
export const createBugReports = (deps: {
  store: BugReportStore
  forum: BugForum | null
  handleOf: (userId: string) => Promise<string | null>
  now?: () => number
}) => {
  const limiter = rateLimiter(BUG_REPORT.perHour, WINDOW_MS)
  const now = deps.now ?? Date.now
  return {
    submit: async (report: BugReport, from: { userId: string | null; ip: string }): Promise<Submitted> => {
      if (!limiter.take([`ip:${from.ip}`, ...(from.userId ? [`user:${from.userId}`] : [])], now())) return { ok: false, error: 'limit' }
      const id = await deps.store.save(report, from.userId)
      console.log(`bug report ${id} from ${from.userId ?? 'a guest'}`)
      const forum = deps.forum
      if (forum) {
        void (async () => {
          const handle = from.userId ? await deps.handleOf(from.userId) : null
          const who = handle ? `@${handle}` : from.userId ? 'a player without a handle' : 'a guest'
          await deps.store.posted(id, await forum.post(bugThread(report, who)))
        })().catch((err: unknown) => console.error(`bug report ${id} didn't reach Discord`, err))
      }
      return { ok: true, id }
    },

    /**
     * A report staff filed from the Discord (`staffAgent.ts`, `/bug`): no
     * rate limit and no technical info, credited to `userId` (the staff's
     * linked account, if any), signed `from`. Waits for the forum so the bot
     * can link the thread: its id, or null without a forum.
     */
    fileFromDiscord: async (text: string, from: string, userId: string | null) => {
      const report: BugReport = { text: clip(text, BUG_REPORT.text.max), tech: null }
      const id = await deps.store.save(report, userId)
      console.log(`bug report ${id} filed from discord by ${from}`)
      if (!deps.forum) return { id, threadId: null }
      const threadId = await deps.forum.post(bugThread(report, from))
      await deps.store.posted(id, threadId)
      return { id, threadId }
    },
  }
}

export type BugReports = ReturnType<typeof createBugReports>
