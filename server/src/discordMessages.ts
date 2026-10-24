import { ENEMIES, type EnemyId } from '../../src/data/enemies'
import { HATCHLINGS, PLAYABLE } from '../../src/data/hatchlings'
import { formatTime } from '../../src/engine/math'
import { dailyChallenge, type Challenge } from '../../src/game/challenge'
import type { DayKey } from '../../src/game/day'
import { DISCORD_GIFT } from '../../src/game/gifts'
import type { Difficulty } from '../../src/game/difficulty'
import { isHalloweenDay } from '../../src/game/halloween'
import type { Suggestion } from '../../src/game/suggestions'
import { en } from '../../src/i18n/en'
import type { ChangelogUpdate } from '../../src/site/changelog'
import type { PlayerProfile } from './staffDesk'
import { STAFF_GIFTS, type GiftRefusal, type SentToday, type StaffGift } from './staffGifts'
import type { Review } from './suggestions'

/**
 * What the Discord bot says, as pure functions: the community server's
 * introduction gate, its patch notes, its daily posts and the ideas it
 * hands staff to review. The server speaks
 * English, so every text here is English. `discord.ts` sends them.
 */

/** The site (`SITE_URL` in `src/site/routes.ts`, which can't be imported here: it pulls the game's i18n in). */
const SITE = 'https://www.pokemonsurvivors.com'
export const PLAY_URL = `${SITE}/en/`
const CHANGELOG_URL = `${SITE}/en/changelog/`

const YELLOW = 0xf8d030
const GOLD = 0xf0b000
const PURPLE = 0xa040a0

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

/** The day's outbreak, posted when the day starts; a haunted one on a Halloween Night day (`game/halloween.ts`). */
export const outbreakMessage = (day: DayKey, id: EnemyId): OutgoingMessage => {
  const { name, dex } = ENEMIES[id]
  const haunted = isHalloweenDay(day)
  return {
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: haunted ? `🎃 Haunted outbreak: ${name}` : `🌊 Today's outbreak: ${name}`,
        url: PLAY_URL,
        description: haunted
          ? `It's Halloween Night! ${name} haunts every run today, and so do its shinies 👻 Ghosts drop candies and jack-o'-lanterns hide treats (or tricks). Fill the candy jar for the prizes!`
          : `${name} is everywhere in every run today, and so are its shinies ✨ Good hunting!`,
        color: PURPLE,
        thumbnail: { url: portraitUrl(dex) },
        footer: { text: day },
      },
    ],
  }
}

/* ---------------- Idea review ---------------- */

const GREEN = 0x30a050

/** The reactions that approve an idea (into the Backlog) or hide it, without their variation selector or skin tone. */
const APPROVE = new Set(['✅', '✔', '☑', '👍', '👌', '💯', '🆗'])
const REJECT = new Set(['❌', '✖', '👎', '🚫', '🗑'])

/** What a staff reaction in #idea-review decides: the Backlog (`open`), off the board (`hidden`) or nothing. */
export const reviewDecision = (emoji: string): Review | null => {
  const bare = emoji.replace(/[\u{FE0F}\u{1F3FB}-\u{1F3FF}]/gu, '')
  return APPROVE.has(bare) ? 'open' : REJECT.has(bare) ? 'hidden' : null
}

/** A new idea from the game, for staff to approve (the bot reacts ✅ and ❌ under it, so a tap does it). */
export const reviewMessage = (idea: Pick<Suggestion, 'title' | 'body' | 'handle'>): OutgoingMessage => ({
  allowed_mentions: { parse: [] },
  embeds: [
    {
      title: `💡 ${idea.title}`.slice(0, 256),
      description: [idea.body && escape(idea.body).split('\n').map((l) => `> ${l}`).join('\n'), `Suggested by @${escape(idea.handle)} in the game`].filter(Boolean).join('\n\n'),
      color: YELLOW,
      footer: { text: 'React ✅ to put it on the board (Backlog), ❌ to hide it.' },
    },
  ],
})

/** The line the review message gets once an idea was decided (a mention in it never pings: the edit sends `allowed_mentions: { parse: [] }`). `by` is null when the bot was away. */
export const reviewedNote = (review: Review, by: string | null) =>
  `${review === 'open' ? '✅ On the board, in the Backlog' : '❌ Hidden'}${by ? ` · <@${by}>` : ''}`

/** The review message's color once decided. */
export const reviewedColor = (review: Review) => (review === 'open' ? GREEN : 0x707890)

/* ---------------- Ideas from the Discord ---------------- */

/** Where the board opens (`?ideias` in `main.ts`). */
const BOARD_URL = `${PLAY_URL}?ideias`

/** An idea staff put on the board from the Discord, as the bot's reply shows it. */
export const ideaEmbed = (idea: Pick<Suggestion, 'title' | 'body' | 'handle'>): Embed => ({
  title: `💡 ${idea.title}`.slice(0, 256),
  url: BOARD_URL,
  description: [idea.body && escape(idea.body), `Added to the suggestion board's Backlog for @${escape(idea.handle)}. Vote for it in the game!`].filter(Boolean).join('\n\n'),
  color: GREEN,
})

/** Why an idea didn't go on the board: no linked game account to credit, or no suggestion in the messages. */
export type NotAdded = 'unlinked' | 'none'

export const NOT_ADDED = {
  unlinked: 'I can’t credit this one: neither of you has a game account with a @handle linked to Discord. Link Discord in the game (its Discord screen) and try again.',
  none: 'I couldn’t find a suggestion there. Reply to the message with the idea, or tell me what to add.',
} as const satisfies Record<NotAdded, string>

/* ---------------- The staff's bot ---------------- */

/** A staff gift in words: `a Rare Egg`, `₽1,500`. */
export const giftLabel = (gift: StaffGift) => (gift.kind === 'egg' ? `a ${en.eggs.tiers[gift.tier]}` : `₽${gift.amount.toLocaleString('en-US')}`)

/** Who a player is in a staff message: their @handle, and their Discord account when linked. */
export const playerName = (p: Pick<PlayerProfile, 'handle' | 'name' | 'discordId'>) =>
  `${p.handle ? `@${escape(p.handle)}` : escape(p.name ?? 'a player without a handle')}${p.discordId ? ` (<@${p.discordId}>)` : ''}`

/** What the bot says it sent: always the exact gift and player, whatever the LLM wrote. */
export const giftReceipt = (gift: StaffGift, to: PlayerProfile, sent: boolean) =>
  sent ? `🎁 Sent ${giftLabel(gift)} to ${playerName(to)}: it waits in their gift box in the game.` : `🎁 ${giftLabel(gift)} for ${playerName(to)} went out from this message already.`

/** Why a staff gift didn't go (`left`: what's left of today's allowance, null for the owner). */
export const giftRefusalText = (why: GiftRefusal | 'unknown' | 'who' | 'kind', gift: StaffGift | null, left: SentToday | null) => {
  const allowance = left ? ` Left for you today: ${left.eggs} egg${left.eggs === 1 ? '' : 's'} and ₽${left.coins.toLocaleString('en-US')}.` : ''
  switch (why) {
    case 'who':
      return 'Tell me who: a Discord mention or a game @handle.'
    case 'unknown':
      return 'I found no game account for that player (by @handle, or linked to that Discord account).'
    case 'kind':
      return 'I can send a common, rare or ultra egg, or ₽ with an amount.'
    case 'tier':
      return `${gift ? giftLabel(gift) : 'That egg'} is past what staff can send (${STAFF_GIFTS.tiers.staff.map((t) => en.eggs.tiers[t]).join(' or ')}).`
    case 'amount':
      return `One gift carries ₽1 to ₽${STAFF_GIFTS.coinsPerGift.staff.toLocaleString('en-US')}.`
    case 'eggs':
    case 'coins':
      return `That's past your daily allowance (it resets at midnight, Brasília time).${allowance}`
  }
}

/** The staff log's line for a gift sent from the Discord. */
export const giftLogMessage = (o: { staffId: string; gift: StaffGift; to: PlayerProfile; link: string | null }): OutgoingMessage => ({
  allowed_mentions: { parse: [] },
  content: `🎁 <@${o.staffId}> sent ${giftLabel(o.gift)} to ${playerName(o.to)}${o.link ? ` · ${o.link}` : ''}`,
})

/** What the bot says a co-op beta change came to (`changed` false: the list already said so). */
export const betaReceipt = (handle: string, on: boolean, changed: boolean, count: number) => {
  const who = `@${escape(handle)}`
  if (!changed) return on ? `🧪 ${who} is in the co-op beta already.` : `🧪 ${who} isn't in the co-op beta.`
  return on
    ? `🧪 Added ${who} to the co-op beta (${count} players). Co-op shows in their lobby once they reload the game, signed in.`
    : `🧪 Took ${who} out of the co-op beta (${count} players). Links to a room still let them join.`
}

/** Why a co-op beta change didn't go. */
export const BETA_REFUSAL = {
  off: 'Editing the co-op beta needs a PostHog personal API key. Ask Pedro to set `POSTHOG_PERSONAL_API_KEY`.',
  shape: 'The `coop-beta` flag on PostHog no longer holds a list of handles, so I won’t touch it. Ask Pedro.',
  noHandle: 'That player has no @handle yet, and co-op needs one: they pick it in the game first.',
  action: 'I can add a player to the co-op beta, take one out, or list who’s in it.',
} as const

/** The co-op beta's players, for `/coop-beta list`. */
export const betaListText = (handles: readonly string[]) => {
  const all = handles.map((h) => `@${escape(h)}`).join(', ')
  return `🧪 Co-op beta: ${handles.length} players\n${all.length > 1800 ? `${all.slice(0, 1800)}…` : all}`
}

/** The staff log's line for a co-op beta change from the Discord. */
export const betaLogMessage = (o: { staffId: string; handle: string; on: boolean; link: string | null }): OutgoingMessage => ({
  allowed_mentions: { parse: [] },
  content: `🧪 <@${o.staffId}> ${o.on ? 'added' : 'took'} @${escape(o.handle)} ${o.on ? 'to' : 'out of'} the co-op beta${o.link ? ` · ${o.link}` : ''}`,
})

const daysAgo = (iso: string, now: number) => {
  const days = Math.floor((now - Date.parse(iso)) / 86_400_000)
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`
}

const difficultyName = (d: string) => {
  const names: Partial<Record<string, string>> = DIFFICULTY_NAMES
  return names[d] ?? d
}

/** A player's profile, for staff (`/player`, and what the LLM reads). */
export const playerLines = (p: PlayerProfile, now = Date.now()) =>
  [
    `**${playerName(p)}**${p.name && p.handle ? ` · ${escape(p.name)}` : ''}`,
    `Joined ${p.joined.slice(0, 10)} · last seen ${daysAgo(p.seen, now)}${p.discordId ? '' : ' · Discord not linked'}`,
    p.supporter ? (p.supporter === 'gold' ? 'Gold Supporter' : 'Supporter') : 'Not a supporter',
    p.banned ? `⛔ Banned ${p.banned.at.slice(0, 10)}${p.banned.reason ? `: ${escape(p.banned.reason)}` : ''}` : '',
    p.runs.length ? `Runs: ${p.runs.map((r) => `${difficultyName(r.difficulty)} ${r.runs} (${r.wins} won, best ${formatTime(r.best)})`).join(' · ')}` : 'No finished runs',
    p.handle ? `${PLAY_URL}?u=${p.handle}` : '',
  ].filter(Boolean)

/** A reply to staff: the text (clipped to Discord's limit) and embeds, never pinging anyone. */
export const staffReply = (text: string, opts: { replyTo?: string; embeds?: readonly Embed[] } = {}): OutgoingMessage => ({
  allowed_mentions: { parse: [] },
  content: text.length > 1990 ? `${text.slice(0, 1989)}…` : text,
  ...(opts.embeds?.length ? { embeds: opts.embeds.slice(0, 10) } : {}),
  ...(opts.replyTo ? { message_reference: replyTo(opts.replyTo) } : {}),
})
