import { CARAVAN, STALLS, TAILOR, type StallId } from '../data/visitors'
import { caravanHere, isCaravanDay } from '../game/caravan'
import { addDays, brasiliaDay, type DayKey } from '../game/day'
import { hasStatue } from '../game/loyalty'
import type { Save } from '../game/meta'
import { stallGoods, stallOn } from '../game/stalls'
import { LANTURN, type PlazaVisitors } from '../render/plaza'
import { emotionUrl, type Speaker } from './dialogue'
import { h } from './dom'
import { today } from './save'
import { SENSEI } from '../render/dojo'
import { JUDGE } from '../render/stadium'

/**
 * Who comes by the Kecleon plaza today, for the shell (the plaza's pieces)
 * and the shop (the Caravana tab): Meowth's weekend caravan, the seasonal
 * stall and the golden statue, from the save and the Brasília day on the
 * missions' clock, unless the dev console forces them (`ps.caravan`, `ps.stall`).
 */

/** Dev: the caravan forced in (true) or away (false), or the calendar's (null). */
let devCaravan: boolean | null = null
/** Dev: a stall forced in (or none, null), or the calendar's (undefined). */
let devStall: StallId | null | undefined

export const setDevCaravan = (on: boolean | null) => (devCaravan = on)
export const setDevStall = (id: StallId | null | undefined) => (devStall = id)

/**
 * The day the caravan's stock and prices follow: today, or, while the dev
 * console forces it in on a weekday, the next weekend day (the rules stay the
 * calendar's, only the day moves).
 */
export const caravanDay = (): DayKey => {
  const day = brasiliaDay(today())
  if (devCaravan !== true) return day
  let d = day
  while (!isCaravanDay(d)) d = addDays(d, 1)
  return d
}

/** Whether Meowth's caravan is at this save's plaza now. */
export const caravanOpen = (save: Save) => devCaravan !== false && caravanHere(save, caravanDay())

/** The seasonal stall on the plaza today, or null. */
export const stallToday = (): StallId | null => (devStall !== undefined ? devStall : stallOn(brasiliaDay(today())))

/**
 * The day a stall's sales follow: today, or, while the dev console forces a
 * stall in outside its dates, its first day (the rules stay the calendar's, only the day moves).
 */
export const stallDay = (): DayKey => {
  const day = brasiliaDay(today())
  const id = stallToday()
  return devStall !== undefined && id !== null && stallOn(day) !== id ? STALLS[id].from : day
}

/** The stall on the plaza today, when it sells something (its shelf opens in the shop). */
export const stallSelling = (): StallId | null => {
  const id = stallToday()
  return id !== null && stallGoods(id).length > 0 ? id : null
}

/** Everyone who comes by the plaza for this save today. */
export const plazaVisitors = (save: Save): PlazaVisitors => ({ caravan: caravanOpen(save), stall: stallToday(), statue: hasStatue(save) })

/** Portrait sizes: SpriteCollab's are 40×40. */
const PORTRAIT = 40

/** A visitor as a dialogue speaker: its name in its color and its emotion portraits. */
const visitorSpeaker = (dex: number, name: string, color: string): Speaker => ({
  name,
  color,
  portrait: (emotion) => h('img', { src: emotionUrl(dex, emotion), alt: '', width: PORTRAIT, height: PORTRAIT }),
})

/** Meowth, at his caravan. */
export const meowthSpeaker = () => visitorSpeaker(CARAVAN.dex, CARAVAN.name, '#b07818')

/** A seasonal stall's keeper. */
export const stallSpeaker = (id: StallId) => visitorSpeaker(STALLS[id].dex, STALLS[id].name, id === 'halloween' ? '#7048a8' : '#c83030')

/** Lanturn, at the festival's Lantern Market. */
export const lanturnSpeaker = () => visitorSpeaker(LANTURN.dex, LANTURN.name, '#2f78b8')

/** Machoke, the Dojo's sensei (`render/dojo.ts`). */
export const senseiSpeaker = () => visitorSpeaker(SENSEI.dex, SENSEI.name, '#c04830')

/** Leavanny, the Boutique's tailor (`ui/boutique.ts`). */
export const tailorSpeaker = () => visitorSpeaker(TAILOR.dex, TAILOR.name, '#3f8f3a')

/** Ninjask, the Estádio's judge (`render/stadium.ts`). */
export const judgeSpeaker = () => visitorSpeaker(JUDGE.dex, JUDGE.name, '#b08818')
