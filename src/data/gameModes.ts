/**
 * The game's 7 modes, in the order the lobby's bar and the Modos de jogo screen show them. A mode is known by its
 * `color` everywhere it appears (the kit's `--mode`, `ui/style.css`), with a pastel `wash` behind its art (`--wash`).
 * `needs: 'account'` is a mode a guest can see but only a signed-in player can play; `fresh` wears the NOVO tag.
 */
export const GAME_MODES = {
  survivors: { color: '#e8402f', wash: '#ffb4a8', needs: null, fresh: false },
  legends: { color: '#7b55e0', wash: '#cbb8ff', needs: null, fresh: false },
  challenge: { color: '#f2b417', wash: '#ffe28a', needs: null, fresh: false },
  coop: { color: '#16a596', wash: '#9fe3d8', needs: 'account', fresh: false },
  arena: { color: '#2f6fe0', wash: '#a9c6ff', needs: null, fresh: false },
  dojo: { color: '#ef7d22', wash: '#ffc89a', needs: null, fresh: false },
  realm: { color: '#1aa9e0', wash: '#a8e0ff', needs: 'account', fresh: true },
} as const satisfies Record<string, { color: `#${string}`; wash: `#${string}`; needs: 'account' | null; fresh: boolean }>

export type GameModeId = keyof typeof GAME_MODES

export const GAME_MODE_IDS = Object.keys(GAME_MODES) as GameModeId[]

/** The mode a device starts on, and falls back to. */
export const DEFAULT_GAME_MODE: GameModeId = 'survivors'
