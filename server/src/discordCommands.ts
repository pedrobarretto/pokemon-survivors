import { isRecord } from '../../src/game/parse'
import { BUG_REPORT } from '../../src/game/bugReport'
import { STAFF_GIFTS } from './staffGifts'

/**
 * The staff's slash commands (`discord.ts` registers them on the server at
 * boot and answers them): only members with Manage Messages see them (staff
 * roles have it), and the bot checks the roles again on every use.
 */

/** Manage Messages: who sees the commands in the picker. */
const STAFF_PERMISSION = String(1 << 13)

const STRING = 3
const INTEGER = 4

const option = (type: number, name: string, description: string, extra: Record<string, unknown> = {}) => ({ type, name, description, ...extra })

const WHO = 'A Discord mention (@someone) or a game @handle'

/** The commands, as `PUT /applications/{id}/guilds/{guild}/commands` takes them. */
export const STAFF_COMMANDS = [
  {
    name: 'ask',
    description: 'Ask the bot about the game (or a player)',
    options: [option(STRING, 'question', 'What you want to know', { required: true, max_length: 1000 })],
  },
  {
    name: 'idea',
    description: 'Put a suggestion on the game’s board (Backlog)',
    options: [
      option(STRING, 'text', 'The suggestion, in any language', { required: true, max_length: 1000 }),
      option(STRING, 'player', `Who gets the credit (default: you). ${WHO}`),
    ],
  },
  {
    name: 'bug',
    description: 'File a bug report in #bug-reports',
    options: [option(STRING, 'text', 'First line: a short title. Then what happens, where, the device', { required: true, min_length: BUG_REPORT.text.min, max_length: BUG_REPORT.text.max })],
  },
  {
    name: 'player',
    description: 'Look a player up (only you see the answer)',
    options: [option(STRING, 'who', WHO, { required: true })],
  },
  {
    name: 'gift',
    description: 'Send a player an egg or ₽ (within your daily allowance)',
    options: [
      option(STRING, 'player', WHO, { required: true }),
      option(STRING, 'kind', 'What to send', {
        required: true,
        choices: [
          { name: 'Common Egg', value: 'common' },
          { name: 'Rare Egg', value: 'rare' },
          { name: 'Ultra Rare Egg (Pedro only)', value: 'ultra' },
          { name: '₽ (set the amount)', value: 'coins' },
        ],
      }),
      option(INTEGER, 'amount', `₽ to send, for ₽ only (staff: up to ${STAFF_GIFTS.coinsPerGift.staff})`, { min_value: 1 }),
    ],
  },
].map((c) => ({ ...c, type: 1, default_member_permissions: STAFF_PERMISSION, contexts: [0] }))

/** A slash command's name and options (`name → value`) from an interaction, or null for anything else. */
export const commandOf = (data: unknown): { name: string; options: Map<string, string | number> } | null => {
  if (!isRecord(data) || typeof data.name !== 'string') return null
  const options = new Map<string, string | number>()
  for (const o of Array.isArray(data.options) ? data.options : []) {
    if (isRecord(o) && typeof o.name === 'string' && (typeof o.value === 'string' || typeof o.value === 'number')) options.set(o.name, o.value)
  }
  return { name: data.name, options }
}
