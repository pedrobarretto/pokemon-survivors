/**
 * The game's 7 modes, in the order the lobby's bar and the Modos de jogo screen show them. A mode is known by its
 * `color` everywhere it appears (the kit's `--mode`, `ui/style.css`); `plate` is that color deep enough for white text, the nameplate of its card.
 * `needs: 'account'` is a mode a guest can see but only a signed-in player can play; `fresh` wears the NOVO tag.
 */
export const GAME_MODES = {
  survivors: { color: '#e8402f', plate: '#b3261c', needs: null, fresh: false },
  legends: { color: '#7b55e0', plate: '#5a3bb8', needs: null, fresh: false },
  challenge: { color: '#f2b417', plate: '#b97a00', needs: null, fresh: false },
  coop: { color: '#16a596', plate: '#0e7a6f', needs: 'account', fresh: false },
  arena: { color: '#2f6fe0', plate: '#2152b0', needs: null, fresh: false },
  dojo: { color: '#ef7d22', plate: '#bb5a10', needs: null, fresh: false },
  realm: { color: '#1aa9e0', plate: '#0f7cab', needs: 'account', fresh: true },
} as const satisfies Record<string, { color: `#${string}`; plate: `#${string}`; needs: 'account' | null; fresh: boolean }>

export type GameModeId = keyof typeof GAME_MODES

export const GAME_MODE_IDS = Object.keys(GAME_MODES) as GameModeId[]

/** The mode a device starts on, and falls back to. */
export const DEFAULT_GAME_MODE: GameModeId = 'survivors'
