/**
 * The Poké Mart's style shelf: the share cards' frames and backgrounds and
 * the Caixa do PC's wallpapers, with their price in ₽. `0` is a default
 * everyone owns; `null` is never sold (a gift only). The looks live in
 * `render/cosmetics.ts`, keyed by the same ids; names in `i18n` (`mart.styles`).
 */
export const STYLE_SHELF = {
  /**
   * The Ambassador frame comes with bringing 3 friends (`game/referral.ts`);
   * the Supporter frame with a donation, its background and wallpaper with
   * the gold tier (`game/supporters.ts`); the pumpkin ones with the Noite
   * das Bruxas candy jar, the spectral frame with its Caça aos Fantasmas
   * (`game/halloween.ts`); the Freguês frame with 14 loyalty stamps and the
   * gold Kecleon frame with the Department Store (`game/loyalty.ts`); Meowth's
   * frame is sold only by its weekend caravan (`game/caravan.ts`); the
   * Lantern frame is the Festival das Lanternas' ₽30M milestone (`data/festivals.ts`).
   */
  frame: { classic: 0, poke: 1000, great: 2000, ultra: 3500, master: 5000, ambassador: null, supporter: null, pumpkin: null, spectral: null, regular: null, kecleon: null, meowth: null, lantern: null },
  background: { night: 0, meadow: 1500, forest: 1500, cave: 1500, snow: 1500, tower: 2000, supporter: null, halloween: null },
  wallpaper: { classic: 0, forest: 1000, cave: 1000, snow: 1000, tower: 1500, supporter: null, haunted: null },
} as const satisfies Record<string, Record<string, number | null>>

export type StyleSlot = keyof typeof STYLE_SHELF

export const STYLE_SLOTS = Object.keys(STYLE_SHELF) as StyleSlot[]

export type StyleId<S extends StyleSlot> = keyof (typeof STYLE_SHELF)[S] & string

export type FrameId = StyleId<'frame'>
export type BackgroundId = StyleId<'background'>
export type WallpaperId = StyleId<'wallpaper'>

/** Ids of a slot, in shelf order. */
export const styleIds = <S extends StyleSlot>(slot: S) => Object.keys(STYLE_SHELF[slot]) as StyleId<S>[]

/** Price of a style: 0 for the defaults, null when it isn't sold. */
export const stylePrice = <S extends StyleSlot>(slot: S, id: StyleId<S>): number | null => (STYLE_SHELF[slot] as Readonly<Record<string, number | null>>)[id] ?? null
