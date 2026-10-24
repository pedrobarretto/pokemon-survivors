import { isRecord } from '../../src/game/parse'
import { parseSuggestionDraft, SUGGESTION, type SuggestionDraft } from '../../src/game/suggestions'

/**
 * Turns a Discord conversation into an idea for the board: staff mention the
 * bot in a reply to a player's suggestion (`discord.ts`), and an LLM on
 * OpenRouter writes its title and description from the player's messages and
 * staff's note. The prompt and the reading of the answer are pure; `writeIdea`
 * makes the call.
 */

export type OpenRouterConfig = { key: string; model: string }

/** What the LLM reads: the player's messages, oldest first (empty when staff wrote the idea themselves), and what staff said when tagging the bot. */
export type IdeaSource = { suggestion: readonly string[]; note: string }

/** How an idea is written for the board: shared with the staff bot's `add_idea` tool (`staffAgent.ts`). */
export const IDEA_RULES = `- "title": the suggestion as a short, clear request in English, ${SUGGESTION.title.min} to ${SUGGESTION.title.max} characters, no ending period (like "Show the timer on the pause menu").
- "body": one to three plain sentences in English (at most ${SUGGESTION.body.max} characters) explaining the problem and the idea, in the player's voice, without names, mentions or markdown. Only say what the messages say: never invent how the game works.`

const SYSTEM = `You turn Discord messages into an entry for the suggestion board of Pokémon Survivors, a browser survivors-like (Vampire Survivors style) with Pokémon.
Players' words for the game: level-up cards offer moves and items; "Forget" (Esquecer) banishes a card from the offers; a "duo" is a golden card fusing two maxed moves into a duo move; "rifts" are legendary domains; "Mega" is Mega Evolution; the Kecleon shop sells items between runs.
A staff member tagged you, usually replying to a player's suggestion. Read the player's messages and the staff note (the note may add or narrow what to suggest) and write:
${IDEA_RULES}
Answer only with JSON: {"title": "...", "body": "..."}. If there's no suggestion to take from the messages, answer {"title": null}.`

/** The chat messages sent to the LLM. */
export const ideaPrompt = (source: IdeaSource) => [
  { role: 'system', content: SYSTEM },
  {
    role: 'user',
    content: [
      source.suggestion.length ? `Player's messages:\n${source.suggestion.map((m) => `> ${m}`).join('\n')}` : 'No player messages: the staff note is the suggestion.',
      `Staff note: ${source.note || '(none)'}`,
    ].join('\n\n'),
  },
]

/** The draft in the LLM's answer (tolerating a code fence around the JSON), or null when it found no suggestion or broke the board's limits. */
export const readIdea = (answer: string): SuggestionDraft | null => {
  const json = answer.slice(answer.indexOf('{'), answer.lastIndexOf('}') + 1)
  try {
    const parsed: unknown = JSON.parse(json)
    return isRecord(parsed) && typeof parsed.title === 'string' ? parseSuggestionDraft(parsed) : null
  } catch {
    return null
  }
}

/** A chat completion on OpenRouter with `config`'s model (`body` adds the messages and the rest); the response's JSON. Throws when it fails. */
export const chatCompletion = async (config: OpenRouterConfig, body: Record<string, unknown>, timeoutMs = 30_000): Promise<unknown> => {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://www.pokemonsurvivors.com',
      'X-Title': 'Pokémon Survivors',
    },
    body: JSON.stringify({ model: config.model, ...body }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) throw new Error(`openrouter: ${res.status} ${await res.text()}`)
  return res.json()
}

/** Asks the LLM for the idea in `source`. Null when it found none; throws when OpenRouter fails. */
export const writeIdea = async (config: OpenRouterConfig, source: IdeaSource): Promise<SuggestionDraft | null> => {
  const body = await chatCompletion(config, { messages: ideaPrompt(source), response_format: { type: 'json_object' }, temperature: 0.3 })
  const choice = isRecord(body) && Array.isArray(body.choices) ? body.choices[0] : null
  const content = isRecord(choice) && isRecord(choice.message) ? choice.message.content : null
  if (typeof content !== 'string') throw new Error('openrouter: no answer')
  return readIdea(content)
}
