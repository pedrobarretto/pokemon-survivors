import { brasiliaDay } from '../../src/game/day'
import { isRecord } from '../../src/game/parse'
import { parseSuggestionDraft } from '../../src/game/suggestions'
import type { BugReports } from './bugReports'
import type { CoopBeta } from './coopBeta'
import { BETA_REFUSAL, betaListText, betaLogMessage, betaReceipt, giftLabel, giftLogMessage, giftReceipt, giftRefusalText, ideaEmbed, NOT_ADDED, playerLines, type Embed, type OutgoingMessage } from './discordMessages'
import { gameLookup } from './gameKnowledge'
import { IDEA_RULES } from './ideaWriter'
import { parseWho, type StaffDesk } from './staffDesk'
import { allowanceLeft, parseStaffGift, type StaffRank } from './staffGifts'
import type { SuggestionStore } from './suggestions'

/**
 * What Discord staff can do through the bot, shared by the slash commands
 * (`discord.ts`) and the LLM's tools (`staffAgent.ts`): look a player up, send
 * a gift within the allowance, put an idea on the board, file a bug report and
 * edit the co-op beta's list. Each action gives back the text the LLM reads
 * and, for what changed something, a receipt the bot shows as it is (the LLM never words a gift).
 */

/** A game account with a @handle. */
export type Account = { id: string; handle: string }

/** The staff member acting. */
export type Staff = { discordId: string; name: string; rank: StaffRank; account: Account | null }

/** Where and for whom staff act. `ref`: the message or interaction (keys gifts, so a retry sends nothing twice); `link`: a jump link to it. */
export type StaffTurn = {
  staff: Staff
  ref: string
  link: string | null
  /** The player whose message staff replied to, and their messages (`suggestionBurst`), oldest first. */
  player: { discordId: string; name: string; account: Account | null; messages: readonly string[] } | null
}

export type StaffDeps = {
  desk: StaffDesk
  ideas: Pick<SuggestionStore, 'add'>
  bugs: Pick<BugReports, 'fileFromDiscord'>
  /** The co-op beta's list (`coopBeta.ts`); null without a PostHog personal API key. */
  beta: Pick<CoopBeta, 'list' | 'add' | 'remove'> | null
  /** Posts in the staff log channel (#mod-chat). */
  log: (message: OutgoingMessage) => Promise<void>
}

/** What an action came to: the text for the LLM (or the command's reply), and what the bot adds to its reply as it is. */
export type Outcome = { text: string; receipt?: string; embed?: Embed }

const DISCORD = 'https://discord.com/channels'

/** No account by that handle or Discord account, with the handles that start like it. */
const unknownPlayer = (similar: readonly string[]) =>
  `${giftRefusalText('unknown', null, null)}${similar.length ? ` Similar handles: ${similar.map((h) => `@${h}`).join(', ')}.` : ''}`

/** A jump link to a message. */
export const messageLink = (guildId: string, channelId: string, messageId: string) => `${DISCORD}/${guildId}/${channelId}/${messageId}`

export const staffActions = (deps: StaffDeps, turn: StaffTurn) => ({
  lookupPlayer: async (who: string): Promise<Outcome> => {
    const parsed = parseWho(who)
    if (!parsed) return { text: giftRefusalText('who', null, null) }
    const found = await deps.desk.find(parsed)
    return { text: found.ok ? playerLines(found.player).join('\n') : unknownPlayer(found.similar) }
  },

  sendGift: async (who: string, kind: string, amount: number | null, n = 0): Promise<Outcome> => {
    const parsed = parseWho(who)
    if (!parsed) return { text: giftRefusalText('who', null, null) }
    const gift = parseStaffGift(kind, amount)
    if (!gift) return { text: giftRefusalText('kind', null, null) }
    const day = brasiliaDay(new Date())
    const sent = await deps.desk.send(turn.staff, parsed, gift, day, `${turn.ref}:${n}`)
    if (!sent.ok) {
      const left = sent.error === 'eggs' || sent.error === 'coins' ? allowanceLeft(turn.staff.rank, await deps.desk.sentToday(turn.staff.discordId, day)) : null
      return { text: giftRefusalText(sent.error, gift, left) }
    }
    const receipt = giftReceipt(gift, sent.to, sent.sent)
    if (sent.sent) await deps.log(giftLogMessage({ staffId: turn.staff.discordId, gift, to: sent.to, link: turn.link })).catch((err) => console.error('discord gift log failed', err))
    return { text: sent.sent ? `Sent ${giftLabel(gift)}.` : 'Already sent from this message.', receipt }
  },

  /** Puts an idea on the board, credited to the player staff replied to (their linked account), else to the staff member. */
  addIdea: async (draft: unknown): Promise<Outcome> => {
    const parsed = parseSuggestionDraft(draft)
    if (!parsed) return { text: `That title or body breaks the board's limits. Rules:\n${IDEA_RULES}` }
    const credit = turn.player?.account ?? turn.staff.account
    if (!credit) return { text: NOT_ADDED.unlinked, receipt: NOT_ADDED.unlinked }
    const idea = await deps.ideas.add(credit.id, parsed)
    return { text: `Added "${idea.title}" to the Backlog for @${idea.handle}.`, embed: ideaEmbed(idea) }
  },

  reportBug: async (text: string): Promise<Outcome> => {
    const body = text.trim()
    if (body.length < 5) return { text: 'Write what goes wrong, where and on which device, if known.' }
    const about = turn.player ? `, about ${turn.player.name}'s report` : ''
    const filed = await deps.bugs.fileFromDiscord(turn.link ? `${body}\n\nFrom Discord: ${turn.link}` : body, `${turn.staff.name} (staff, from Discord${about})`, turn.staff.account?.id ?? null)
    const where = filed.threadId ? ` <#${filed.threadId}>` : ' (stored; #bug-reports is off)'
    return { text: `Filed the bug report.${where}`, receipt: `🐞 Filed in #bug-reports:${where}` }
  },

  /** Lets a player into the co-op beta (`add`), takes one out (`remove`) or lists who's in it (`list`): the `coop-beta` flag's handles (`coopBeta.ts`). */
  coopBeta: async (action: string, who: string): Promise<Outcome> => {
    if (!deps.beta) return { text: BETA_REFUSAL.off }
    if (action === 'list') {
      const handles = await deps.beta.list()
      return { text: handles ? betaListText(handles) : BETA_REFUSAL.shape }
    }
    if (action !== 'add' && action !== 'remove') return { text: BETA_REFUSAL.action }
    const on = action === 'add'
    const parsed = parseWho(who)
    if (!parsed) return { text: giftRefusalText('who', null, null) }
    // Letting in needs an account with that handle (a typo lets nobody in); taking out goes by the handle as listed.
    const found = parsed.by === 'handle' && !on ? null : await deps.desk.find(parsed)
    if (found && !found.ok) return { text: unknownPlayer(found.similar) }
    const handle = found ? found.player.handle : parsed.by === 'handle' ? parsed.handle : null
    if (!handle) return { text: BETA_REFUSAL.noHandle }
    const changed = on ? await deps.beta.add(handle) : await deps.beta.remove(handle)
    if (!changed.ok) return { text: BETA_REFUSAL.shape }
    const receipt = betaReceipt(handle, on, changed.changed, changed.count)
    if (changed.changed) await deps.log(betaLogMessage({ staffId: turn.staff.discordId, handle, on, link: turn.link })).catch((err) => console.error('discord beta log failed', err))
    return { text: receipt, receipt }
  },

  gameLookup: (query: string): Outcome => {
    const facts = gameLookup(query)
    return { text: facts.length ? facts.join('\n') : `The game's data has nothing named "${query}".` }
  },
})

export type StaffActions = ReturnType<typeof staffActions>

/** A tool the LLM may call: its JSON schema and what running it does. */
export type Tool = {
  name: string
  description: string
  parameters: Record<string, unknown>
  run: (args: Record<string, unknown>) => Promise<Outcome>
}

const text = (v: unknown) => (typeof v === 'string' ? v : '')
const int = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) ? v : null)
const object = (properties: Record<string, unknown>, required: readonly string[]) => ({ type: 'object', properties, required, additionalProperties: false })

/** The tools that only read: answering questions (`/ask`). */
export const readTools = (actions: StaffActions): Tool[] => [
  {
    name: 'game_lookup',
    description: "The game's own data on a Pokémon (playable or wild), move, held item, Ability or Mega, by its English name: how to get it, types, evolutions, stats, learnset, move levels and evolutions.",
    parameters: object({ query: { type: 'string', description: 'An English name, like "Charizard", "Fire Spin", "Leftovers" or "Mega Gengar".' } }, ['query']),
    run: async (args) => actions.gameLookup(text(args.query)),
  },
  {
    name: 'lookup_player',
    description: "A player's game account: @handle, when they joined and last played, whether Discord is linked, supporter tier, bans and finished runs per difficulty.",
    parameters: object({ who: { type: 'string', description: 'A Discord mention like <@123>, a Discord user id, or a game @handle.' } }, ['who']),
    run: async (args) => actions.lookupPlayer(text(args.who)),
  },
]

/** Every tool, for a staff member who tagged the bot. */
export const staffTools = (actions: StaffActions): Tool[] => {
  let gifts = 0
  return [
    ...readTools(actions),
    {
      name: 'add_idea',
      description: "Puts a suggestion straight on the game's suggestion board (Backlog), credited to the player staff replied to, or to the staff member. Use it when staff ask to add, include or take a suggestion.",
      parameters: object({ title: { type: 'string' }, body: { type: 'string' } }, ['title', 'body']),
      run: async (args) => actions.addIdea({ title: text(args.title), body: text(args.body) }),
    },
    {
      name: 'report_bug',
      description: "Files a bug report in the Discord's #bug-reports forum. Use it when staff ask to report or file a bug.",
      parameters: object(
        { text: { type: 'string', description: 'In English: the first line a short title, then what happens, where in the game, the device and how to make it happen, only as far as the messages say: never guess the missing parts.' } },
        ['text'],
      ),
      run: async (args) => actions.reportBug(text(args.text)),
    },
    {
      name: 'send_gift',
      description: "Sends a player a Mystery Gift from staff (it waits in their gift box in the game): an egg or ₽. Only when staff clearly asked to send that gift to that player; never guess the player, the egg or the amount. Staff have a daily allowance; the bot tells them the exact result.",
      parameters: object(
        {
          who: { type: 'string', description: 'A Discord mention like <@123>, a Discord user id, or a game @handle.' },
          kind: { type: 'string', enum: ['common', 'rare', 'ultra', 'coins'], description: 'An egg tier, or coins for ₽.' },
          amount: { type: 'integer', description: 'The ₽ to send, for coins only.' },
        },
        ['who', 'kind'],
      ),
      run: async (args) => actions.sendGift(text(args.who), text(args.kind), int(args.amount), gifts++),
    },
    {
      name: 'coop_beta',
      description: "The co-op beta (co-op is a Discord-only beta for now): lets a player in (their lobby shows Co-op once they reload the game), takes one out, or lists who's in it. Only when staff clearly asked; never guess the player.",
      parameters: object(
        {
          action: { type: 'string', enum: ['add', 'remove', 'list'] },
          who: { type: 'string', description: 'For add and remove: a Discord mention like <@123>, a Discord user id, or a game @handle.' },
        },
        ['action'],
      ),
      run: async (args) => actions.coopBeta(text(args.action), text(args.who)),
    },
  ]
}

/** A tool call's arguments (a JSON object in a string); `{}` when they don't parse. */
export const toolArgs = (raw: unknown): Record<string, unknown> => {
  if (typeof raw !== 'string') return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}
