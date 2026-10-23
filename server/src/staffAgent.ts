import { isRecord } from '../../src/game/parse'
import type { Embed } from './discordMessages'
import { chatCompletion, IDEA_RULES, type OpenRouterConfig } from './ideaWriter'
import { STAFF_GIFTS } from './staffGifts'
import { toolArgs, type StaffTurn, type Tool } from './staffTools'

/**
 * The staff bot's LLM (`discord.ts` hands it a staff message that tagged the
 * bot, or a `/ask`): a tool-calling loop on OpenRouter over the tools in
 * `staffTools.ts`, bounded in rounds and time. The bot's reply is the LLM's
 * answer, then the receipts and embeds the tools gave, as they are.
 */

/** Tool rounds per turn at most, the whole turn's time, and the answer's length (tokens). */
const AGENT = { rounds: 5, deadlineMs: 100_000, maxTokens: 700 } as const

/** The system prompt: what the bot is, its rules and what it knows about the game (`loadKnowledge`). */
export const agentSystem = (knowledge: string) => `You are the Pokémon Survivors bot in the game's community Discord, helping its staff (the moderators, the devs and Pedro, who makes the game). Only staff talk to you.
Pokémon Survivors is a free, browser-based survivors-like (Vampire Survivors style) fan game with Pokémon, at https://www.pokemonsurvivors.com.

Rules:
- Reply in the language the staff member wrote in. Be brief: a few short lines, Discord markdown, no headings. Never ping anyone.
- Act through the tools. Do what staff asked and nothing else. After acting, say in one line what you did; the bot shows the exact result of gifts, ideas and bug reports below your text, so don't repeat their details.
- send_gift only when staff clearly asked to send that gift to that player; never guess the player, the egg or the amount. Staff can send common or rare eggs and up to ₽${STAFF_GIFTS.coinsPerGift.staff} per gift, within a daily allowance of ${STAFF_GIFTS.perDay.eggs} eggs and ₽${STAFF_GIFTS.perDay.coins}; Pedro has no allowance. If a tool refuses, say why.
- add_idea when staff ask to add, include or take a suggestion, written like this:
${IDEA_RULES}
- report_bug when staff ask to report or file a bug: write it in English from what the messages say.
- Questions about the game: answer from the overview below and game_lookup. If neither says it, say you don't know. Never invent mechanics, numbers, dates or plans. Keep Pokémon, move and item names in English.
- Questions about a player: lookup_player.

What you know about the game:
${knowledge}`

const quote = (text: string) => text.split('\n').map((l) => `> ${l}`).join('\n')

/**
 * The turn as the LLM reads it: who wrote, the message they replied to (a
 * player's, with their messages before it, or the bot's own `earlier` answer)
 * and what they said.
 */
export const agentPrompt = (turn: StaffTurn, said: string, earlier: string | null = null) =>
  [
    `Staff member: ${turn.staff.name} (${turn.staff.rank === 'owner' ? 'Pedro, the owner' : 'staff'}; Discord <@${turn.staff.discordId}>; game account ${turn.staff.account ? `@${turn.staff.account.handle}` : 'not linked'}).`,
    turn.player
      ? `They replied to ${turn.player.name} (Discord <@${turn.player.discordId}>; game account ${turn.player.account ? `@${turn.player.account.handle}` : 'not linked'}), who wrote:\n${quote(turn.player.messages.join('\n'))}`
      : '',
    earlier ? `They replied to your earlier answer:\n${quote(earlier)}` : '',
    `Their message: ${said || '(nothing besides the tag)'}`,
  ]
    .filter(Boolean)
    .join('\n\n')

/** A tool call the LLM made. */
type ToolCall = { id: string; name: string; args: string }

/** The LLM's answer: its text and the tools it called, from a chat completion's JSON. */
export const readChoice = (body: unknown): { text: string; calls: ToolCall[]; message: Record<string, unknown> | null } => {
  const choice = isRecord(body) && Array.isArray(body.choices) ? body.choices[0] : null
  const message = isRecord(choice) && isRecord(choice.message) ? choice.message : null
  const calls = (message && Array.isArray(message.tool_calls) ? message.tool_calls : []).flatMap((c): ToolCall[] =>
    isRecord(c) && typeof c.id === 'string' && isRecord(c.function) && typeof c.function.name === 'string'
      ? [{ id: c.id, name: c.function.name, args: typeof c.function.arguments === 'string' ? c.function.arguments : '{}' }]
      : [],
  )
  return { text: message && typeof message.content === 'string' ? message.content.trim() : '', calls, message }
}

/** What a turn came to: the LLM's text, then the receipts and embeds of what the tools did. */
export type AgentReply = { text: string; receipts: string[]; embeds: Embed[] }

/**
 * Runs one turn: the LLM answers or calls tools, the tools run and it reads
 * their results, up to `AGENT.rounds` rounds (the last one offers no tools,
 * so it answers). Throws when OpenRouter fails.
 */
export const runAgent = async (config: OpenRouterConfig, o: { system: string; prompt: string; tools: readonly Tool[] }): Promise<AgentReply> => {
  const deadline = Date.now() + AGENT.deadlineMs
  const messages: unknown[] = [
    { role: 'system', content: o.system },
    { role: 'user', content: o.prompt },
  ]
  const receipts: string[] = []
  const embeds: Embed[] = []
  const defs = o.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }))
  for (let round = 0; ; round++) {
    const last = round >= AGENT.rounds || Date.now() > deadline - 20_000
    const body = await chatCompletion(
      config,
      { messages, max_tokens: AGENT.maxTokens, temperature: 0.2, ...(defs.length && !last ? { tools: defs } : {}) },
      Math.max(5_000, Math.min(30_000, deadline - Date.now())),
    )
    const { text, calls, message } = readChoice(body)
    if (!calls.length || last || !message) return { text, receipts, embeds }
    messages.push({ role: 'assistant', content: message.content ?? null, tool_calls: message.tool_calls })
    for (const call of calls) {
      const tool = o.tools.find((t) => t.name === call.name)
      const out = tool ? await tool.run(toolArgs(call.args)) : { text: `No tool named ${call.name}.` }
      if (out.receipt) receipts.push(out.receipt)
      if (out.embed) embeds.push(out.embed)
      messages.push({ role: 'tool', tool_call_id: call.id, content: out.text })
    }
  }
}
