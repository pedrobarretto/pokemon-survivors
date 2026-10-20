import { creatorOf, creatorUrl, PLATFORMS, type CreatorId } from '../../src/data/creators'
import { ENEMIES, type EnemyId } from '../../src/data/enemies'
import { HATCHLINGS, PLAYABLE } from '../../src/data/hatchlings'
import { formatTime } from '../../src/engine/math'
import { dailyChallenge, type Challenge } from '../../src/game/challenge'
import type { DayKey } from '../../src/game/day'
import { DISCORD_GIFT } from '../../src/game/gifts'
import type { Difficulty } from '../../src/game/difficulty'
import type { ChangelogUpdate } from '../../src/site/changelog'

/**
 * What the Discord bot says, as pure functions: the community server's
 * introduction gate, its patch notes and its daily posts. The server speaks
 * English, so every text here is English. `discord.ts` sends them.
 */

/** The site (`SITE_URL` in `src/site/routes.ts`, which can't be imported here: it pulls the game's i18n in). */
const SITE = 'https://www.pokemonsurvivors.com'
export const PLAY_URL = `${SITE}/en/`
const CHANGELOG_URL = `${SITE}/en/changelog/`

const YELLOW = 0xf8d030
const GOLD = 0xf0b000
const PURPLE = 0xa040a0
const LIVE_RED = 0xe8306a

export type Embed = {
  title?: string
  url?: string
  description?: string
  color?: number
  thumbnail?: { url: string }
  footer?: { text: string }
}

/** A message to send. Mentions only ping what `allowed_mentions` names, so a player's name can't ping anyone. */
export type OutgoingMessage = {
  content?: string
  embeds?: Embed[]
  allowed_mentions: { parse: []; roles?: string[]; users?: string[] }
  message_reference?: { message_id: string; fail_if_not_exists: false }
}

/** A species' portrait on the site (every species has one: `npm run assets`). */
const portraitUrl = (dex: number) => `${SITE}/assets/pokemon/${dex}/portrait.png`

/** Backslashes Discord's markdown out of player-chosen text. */
const escape = (text: string) => text.replace(/[\\*_~`|>[\]()]/g, '\\$&')

/** A ping for `roleId`, or nothing when the role isn't there. */
const ping = (roleId: string | null, text: string): Pick<OutgoingMessage, 'content' | 'allowed_mentions'> =>
  roleId ? { content: `<@&${roleId}> ${text}`, allowed_mentions: { parse: [], roles: [roleId] } } : { content: text, allowed_mentions: { parse: [] } }

const DIFFICULTY_NAMES = { normal: 'Normal', hard: 'Hard', nightmare: 'Nightmare' } as const satisfies Record<Difficulty, string>

/* ---------------- Introduction gate ---------------- */

/** Whether `content` has any words: mentions, custom emojis and links alone don't count. */
export const hasWords = (content: string) =>
  /[\p{L}\p{N}]/u.test(content.replace(/<a?:\w+:\d+>|<(?:@[!&]?|#)\d+>|https?:\/\/\S+/g, ''))

/**
 * What the gate does with a message in #introductions: nothing for bots and
 * members who are Trainers already, a welcome (and the Trainer role) for
 * anything written, however short, and a nudge for a lone emoji, sticker or link.
 * The gate proves a person read the channel, not that they wrote enough.
 */
export const introDecision = (m: { bot: boolean; trainer: boolean; content: string }): 'ignore' | 'welcome' | 'empty' =>
  m.bot || m.trainer ? 'ignore' : hasWords(m.content) ? 'welcome' : 'empty'

const replyTo = (messageId: string) => ({ message_id: messageId, fail_if_not_exists: false }) as const

/** Pings a newcomer in #introductions as they join: only Trainers talk elsewhere, and the ping takes them where they can. */
export const greetMessage = (userId: string): OutgoingMessage => ({
  content: `Welcome to the server, <@${userId}>! 👋 Say something about yourself right here to unlock chatting in every channel. Anything works: your nick, where you're from, your favorite Pokémon...`,
  allowed_mentions: { parse: [], users: [userId] },
})

export const welcomeMessage = (userId: string, messageId: string): OutgoingMessage => ({
  content: `Welcome, <@${userId}>! 🎉 You're a **Trainer** now and the whole server is open. Say hi in the other channels, and play anytime at ${PLAY_URL}\n🎁 Link your game account to Discord (the Discord button in the game's lobby) and a **shiny ${HATCHLINGS[DISCORD_GIFT.family].name}** is yours!`,
  allowed_mentions: { parse: [], users: [userId] },
  message_reference: replyTo(messageId),
})

export const emptyMessage = (userId: string, messageId: string): OutgoingMessage => ({
  content: `Hey <@${userId}>, write a few words 🙂 Anything works, even just your favorite Pokémon, and the server unlocks!`,
  allowed_mentions: { parse: [], users: [userId] },
  message_reference: replyTo(messageId),
})

/* ---------------- Patch notes ---------------- */

/**
 * Which updates of the changelog (newest first) go to #patch-notes, given the
 * dates already posted: every update newer than the newest posted one, oldest
 * first, and the newest posted one again as an edit (an update keeps growing
 * through its day). The first time, only the newest update is posted and the
 * older ones are marked as done (`skip`), so the channel doesn't get the
 * whole history at once.
 */
export const patchPlan = (updates: readonly ChangelogUpdate[], posted: ReadonlySet<string>) => {
  if (posted.size === 0) {
    const [newest, ...older] = updates
    return { post: newest ? [newest] : [], skip: older, refresh: null }
  }
  const last = [...posted].reduce((a, b) => (b > a ? b : a))
  return { post: updates.filter((u) => u.date > last).reverse(), skip: [], refresh: updates.find((u) => u.date === last) ?? null }
}

export const patchMessage = (update: ChangelogUpdate, roleId: string | null): OutgoingMessage => {
  const url = `${CHANGELOG_URL}#${update.date}`
  return {
    ...ping(roleId, 'a new update is out!'),
    embeds: [
      {
        title: `🆕 ${update.title.en}`,
        url,
        description: [...update.highlights.map((h) => `• ${h.en}`), '', `[Every change in this update](${url}) · [Play](${PLAY_URL})`].join('\n'),
        color: YELLOW,
        footer: { text: update.date },
      },
    ],
  }
}

/* ---------------- Daily posts ---------------- */

/** The day's Desafio do dia, posted when the day starts. */
export const challengeMessage = (c: Challenge, roleId: string | null): OutgoingMessage => {
  const pokemon = PLAYABLE[c.starter]
  return {
    ...ping(roleId, "today's Daily Challenge is live!"),
    embeds: [
      {
        title: `🏆 Daily Challenge · ${c.day}`,
        url: PLAY_URL,
        description: [
          `**${pokemon.name}** on **${DIFFICULTY_NAMES[c.difficulty]}**, with the ${ENEMIES[c.outbreak].name} outbreak.`,
          'Same map for everyone and one official try. Post your time here!',
        ].join('\n'),
        color: GOLD,
        thumbnail: { url: portraitUrl(pokemon.line[0].dex) },
      },
    ],
  }
}

/** A place on a closed day's podium. `survived` in seconds. */
export type PodiumPlace = { rank: number; handle: string; name: string; survived: number }

const MEDALS = ['🥇', '🥈', '🥉']

/** A closed day's top 3 (null when nobody made an official attempt). `total`: everyone who took part. */
export const podiumMessage = (day: DayKey, places: readonly PodiumPlace[], total: number, roleId: string | null): OutgoingMessage | null => {
  if (places.length === 0) return null
  const pokemon = PLAYABLE[dailyChallenge(day).starter]
  const lines = places.map((p) => `${MEDALS[p.rank - 1] ?? `#${p.rank}`} **${escape(p.name)}** (@${escape(p.handle)}) · ${formatTime(p.survived)}`)
  return {
    ...ping(roleId, `the podium of ${day} is in!`),
    embeds: [
      {
        title: `🏆 Daily Challenge podium · ${day}`,
        url: PLAY_URL,
        description: [...lines, '', `${total === 1 ? '1 trainer' : `${total} trainers`} took part. Congrats! Their ribbons are in their Mystery Gifts.`].join('\n'),
        color: GOLD,
        thumbnail: { url: portraitUrl(pokemon.line[0].dex) },
      },
    ],
  }
}

/** The day's outbreak, posted when the day starts. */
/** A content creator just went live (`data/creators.ts`): their live page, with their partner Pokémon's portrait. */
export const liveMessage = (id: CreatorId): OutgoingMessage => {
  const c = creatorOf(id)
  return {
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: `🔴 ${c.name} is live on ${PLATFORMS[c.platform].name}!`,
        url: creatorUrl(id, true),
        description: `${c.name} is streaming Pokémon Survivors right now. Drop by, say hi and tell them the server sent you 💛`,
        color: LIVE_RED,
        thumbnail: { url: portraitUrl(c.partner.dex) },
        footer: { text: `@${c.handle}` },
      },
    ],
  }
}

export const outbreakMessage = (day: DayKey, id: EnemyId): OutgoingMessage => {
  const { name, dex } = ENEMIES[id]
  return {
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: `🌊 Today's outbreak: ${name}`,
        url: PLAY_URL,
        description: `${name} is everywhere in every run today, and so are its shinies ✨ Good hunting!`,
        color: PURPLE,
        thumbnail: { url: portraitUrl(dex) },
        footer: { text: day },
      },
    ],
  }
}
