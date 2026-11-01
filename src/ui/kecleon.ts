import { t } from '../i18n'
import type { PokeType } from '../data/types'
import { context2d, createCanvas } from '../engine/pixelart'
import { KECLEON_DEX, KECLEON_NAME, purpleize } from '../render/plaza'
import { emotionUrl, type DialogueLine, type Emotion, type Speaker } from './dialogue'
import { h } from './dom'

/** Portrait sizes: SpriteCollab's are 40×40. */
const PORTRAIT = 40

/** The purple brother's portrait: the green one's, recolored like his sprites once it loads. */
const purplePortrait = (emotion: Emotion) => {
  const canvas = createCanvas(PORTRAIT, PORTRAIT)
  const img = new Image()
  img.onload = () => context2d(canvas).drawImage(purpleize(img) ?? img, 0, 0)
  img.src = emotionUrl(KECLEON_DEX, emotion)
  return canvas
}

/** The shop's two Kecleon as dialogue speakers: the green one runs the shop, the purple brother arrives with the Tent (Lv 2) and tends its own shelves. */
export const kecleonSpeaker = (purple = false): Speaker => ({
  name: KECLEON_NAME,
  color: purple ? '#7048a8' : '#3e8a3a',
  portrait: (emotion) => (purple ? purplePortrait(emotion) : h('img', { src: emotionUrl(KECLEON_DEX, emotion), alt: '', width: PORTRAIT, height: PORTRAIT })),
})

/** Nobody behind the counter (the camouflage easter egg): an empty green card where the portrait goes. */
export const emptyCounter = (): Speaker => ({ name: '…', color: '#8890a8', portrait: () => h('span', { class: 'dialogue-empty', style: `width:${PORTRAIT}px;height:${PORTRAIT}px` }) })

/** The time of day a greeting follows, from the local hour. */
export const partOfDay = (hour: number) => (hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 18 ? 'afternoon' : hour >= 18 ? 'evening' : 'night')

const GREETING_EMOTION = { morning: 'Happy', afternoon: 'Joyous', evening: 'Normal', night: 'Surprised' } as const satisfies Record<ReturnType<typeof partOfDay>, Emotion>

/** Kecleon's hello by the time of day: what it says when nothing else comes to mind. */
export const greeting = (now = new Date()): DialogueLine => {
  const part = partOfDay(now.getHours())
  return { text: t().plaza.greetings[part], emotion: GREETING_EMOTION[part] }
}

/* ---------------- What Kecleon says when you arrive ---------------- */

/** Partner types Kecleon has a word about. */
export const TYPE_REMARKS = ['fire', 'water', 'electric', 'grass', 'ghost'] as const satisfies readonly PokeType[]
type RemarkType = (typeof TYPE_REMARKS)[number]

const remarks = (type: PokeType): type is RemarkType => TYPE_REMARKS.some((r) => r === type)

/** What Kecleon knows as the partner walks up (the shell gathers it from the save and the last run). */
export type VisitContext = {
  /** The player never came to the shop before. */
  firstEver: boolean
  /** The first visit of this Brasília day. */
  firstToday: boolean
  /** Days in a row with a visit, today included. */
  streak: number
  /** The run just before beat Mewtwo. */
  wonLastRun: boolean
  wallet: number
  /** ₽ the shop's next level costs, null at the top. */
  nextLevel: number | null
  /** The cheapest card the save could still buy today, null when there's none left. */
  cheapest: number | null
  /** The free gift is still waiting today. */
  giftWaiting: boolean
  /** The wishlist's card: its name, whether it's in today's Vitrine and the next day it comes back (null: not within two weeks). */
  wish: { name: string; today: boolean; back: string | null } | null
  partner: { name: string; shiny: boolean; type: PokeType }
  /** A die in [0, 1): the flavor lines (a wallet hint, a shiny or a type remark) don't come every time. */
  roll: number
}

/** Why Kecleon says what it says, in priority order (`pickTrigger`). */
export type Trigger = 'first' | 'wishToday' | 'mewtwo' | 'loyal' | 'invest' | 'wishLater' | 'broke' | 'shiny' | 'type' | 'greeting'

/** A wallet this heavy (₽) gets the hint to invest in the shop. */
export const HEAVY_WALLET = 100_000
/** Days in a row that make a regular. */
export const LOYAL_STREAK = 5

/**
 * The one thing Kecleon says on a visit, the first that applies of: a first
 * visit ever, the wishlist's card in today's Vitrine, a win against Mewtwo
 * just before, a regular's fifth day in a row (or more, once a day), a heavy
 * wallet that could grow the shop, when the wishlist's card is back, an empty
 * wallet, a shiny partner, the partner's type; else the time of day's hello.
 */
export const pickTrigger = (c: VisitContext): Trigger => {
  if (c.firstEver) return 'first'
  if (c.wish?.today) return 'wishToday'
  if (c.wonLastRun) return 'mewtwo'
  if (c.firstToday && c.streak >= LOYAL_STREAK) return 'loyal'
  if (c.wallet >= HEAVY_WALLET && c.nextLevel !== null && c.wallet >= c.nextLevel && (c.firstToday || c.roll < 0.35)) return 'invest'
  if (c.wish && c.wish.back && c.roll < 0.5) return 'wishLater'
  if (c.cheapest !== null && c.wallet < c.cheapest && !c.giftWaiting) return 'broke'
  if (c.partner.shiny && c.roll < 0.6) return 'shiny'
  if (remarks(c.partner.type) && c.roll < 0.5) return 'type'
  return 'greeting'
}

/** A Brasília day's weekday (0 Sunday … 6 Saturday). */
export const weekdayOf = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay()

/** What Kecleon says for `trigger`, with its face. */
export const visitLine = (trigger: Trigger, c: VisitContext, now = new Date()): DialogueLine => {
  const l = t().plaza.lines
  switch (trigger) {
    case 'first':
      return { text: l.first, emotion: 'Joyous' }
    case 'wishToday':
      return { text: l.wishToday(c.wish?.name ?? ''), emotion: 'Inspired' }
    case 'mewtwo':
      return { text: l.mewtwo, emotion: 'Surprised' }
    case 'loyal':
      return { text: l.loyal(c.streak), emotion: 'Joyous' }
    case 'invest':
      return { text: l.invest, emotion: 'Inspired' }
    case 'wishLater':
      return c.wish?.back ? { text: l.wishLater(c.wish.name, t().plaza.weekdays[weekdayOf(c.wish.back)]!), emotion: 'Happy' } : greeting(now)
    case 'broke':
      return { text: l.broke, emotion: 'Sigh' }
    case 'shiny':
      return { text: l.shiny, emotion: 'Surprised' }
    case 'type':
      return remarks(c.partner.type) ? { text: l.types[c.partner.type](c.partner.name), emotion: 'Happy' } : greeting(now)
    case 'greeting':
      return greeting(now)
  }
}

/** A short thanks after a purchase, a different one each time (`n`: purchases so far this visit); the purple brother has his own. */
export const thanks = (n: number, purple = false): DialogueLine => {
  const lines = purple ? t().plaza.thanksPurple : t().plaza.thanks
  return { text: lines[n % lines.length]!, emotion: n % 2 ? 'Joyous' : 'Happy' }
}

/** Kecleon cheering the shop's new level. */
export const levelUpLine = (name: string): DialogueLine => ({ text: t().plaza.lines.levelUp(name), emotion: 'Joyous' })
