import { accountHandle, accountState } from '../account'
import { track } from '../analytics'
import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { formatTime } from '../engine/math'
import { ACHIEVEMENTS, MEDALS, type Medal, type TitleId } from '../data/achievements'
import { PLAYABLE, type PlayableId } from '../data/hatchlings'
import { playerForm } from '../game/branch'
import { dexCounts, type Pokedex } from '../game/dex'
import type { ChallengePlace } from '../game/ranking'
import { ribbonCounts } from '../game/ribbons'
import { playsShiny } from '../game/shinyPicks'
import type { Save } from '../game/meta'
import type { Game } from '../game/types'
import { boardPlace, CARD, cardBlob, drawRunCard, drawTrainerCard, type CardMon, type CardTrainer, type RunCardData, type TrainerCardData } from '../render/card'
import { localLook, shownLook } from '../render/looks'
import { skinFor } from '../data/cosmetics'
import type { RankOutcome } from '../ranking'
import { titleMark, type CardStyle } from '../render/cosmetics'
import { sparkleIcon } from '../render/art'
import { gameUrl } from '../ranking'
import { gameDex, pokedex } from '../site/pokedex'
import { t } from '../i18n'
import { h, later } from './dom'
import { boxSpecies, caughtShinies } from './pcBox'
import { loadSave } from './save'
import { hint, menu, type Screen } from './screens'
import { uiDpr, uiViewport } from './uiScale'
import { localPlayer } from '../game/players'

/**
 * Sharing a card: the data each card shows (built from the run or the save),
 * a preview with its buttons, and the way out of the game. On a phone the
 * share sheet takes the PNG and its text; on a computer the image goes to the
 * clipboard; anywhere else it downloads. Each share is counted (`share`).
 */

type ShareKind = 'run' | 'trainer'

type ShareMethod = 'share' | 'copy' | 'download'

/** A card ready to share: how to draw it, the text that goes along and the file name. */
export type ShareCard = { kind: ShareKind; draw: () => Promise<HTMLCanvasElement>; text: string; file: string }

/* ---------------- Card data ---------------- */

let names: Map<number, string> | null = null

/** Every species' name by dex number (the Pokédex model knows them all). */
const nameOf = (dex: number) => (names ??= new Map(pokedex().map((e) => [e.dex, e.name]))).get(dex) ?? `#${dex}`

const mon = (dex: number, shiny: boolean): CardMon => ({ dex, name: nameOf(dex), shiny })

/** The frame and background the player wears (bought on the Poké Mart's style shelf), read when the card is drawn. */
const wornStyle = (): CardStyle => {
  const { frame, background } = loadSave().style.equipped
  return { frame, background }
}

/** Who shares: the handle and title, and the game's link crediting the handle (shown without the scheme). */
const trainerLine = (title: TitleId | null): CardTrainer & { url: string } => {
  const handle = accountHandle()
  const url = gameUrl(handle)
  return { handle, title: title ? t().achievements.titles[title] : null, mark: titleMark(title), link: url.replace(/^https?:\/\/(www\.)?/, ''), url }
}

/** How long the card waits for the API's answer (the challenge's place, the boards') before it's drawn without it (offline, a slow API). */
const API_WAIT_MS = 4000

/** What `promise` brings within `API_WAIT_MS`, else null. */
const inTime = <T>(promise: Promise<T> | null | undefined): Promise<T | null> =>
  promise ? Promise.race([promise.catch(() => null), new Promise<null>((resolve) => setTimeout(() => resolve(null), API_WAIT_MS))]) : Promise.resolve(null)

/** The place an official challenge attempt got, when the API tells it in time; null otherwise (practice, offline). */
const officialPlace = async (place: Promise<ChallengePlace | null> | null): Promise<RunCardData['challenge']> => {
  const got = await inTime(place)
  return got?.official && got.rank !== null ? { rank: got.rank, total: got.total } : null
}

/** The run's best place on its boards (`boardPlace`), when the API ranked it in time. */
const boardOf = async (rank: Promise<RankOutcome> | null | undefined): Promise<RunCardData['board']> => {
  const got = await inTime(rank)
  return got?.kind === 'ranked' ? boardPlace(got.ranks) : null
}

/** What else the results know that the run's card can brag about: the best time before the run and its report to the boards. */
export type RunShareExtras = { bestBefore?: number; rank?: Promise<RankOutcome> | null }

/**
 * The run's card, from the run as it ended. `place`: a Desafio do dia run's
 * place, as the API answers it at the end of the run. The Pokédex the run
 * started from (`dexBase`) is no longer drawn, kept for the callers.
 */
export const runShare = (g: Game, _dexBase: Pokedex, place: Promise<ChallengePlace | null> | null = null, extras: RunShareExtras = {}): ShareCard => {
  const form = playerForm(g)
  const me = localPlayer(g)
  const trainer = trainerLine(loadSave().title)
  const outcome = g.endless ? 'endless' : g.phase === 'victory' ? 'victory' : 'fainted'
  // The look the run wore, read now: the game's looks go with it.
  const look = shownLook(g, me.slot)
  const best = extras.bestBefore ?? 0
  const card: Omit<RunCardData, 'challenge' | 'board'> = {
    mon: { dex: form.dex, name: form.name, shiny: me.shiny, skin: skinFor(look, form.dex), look },
    outcome,
    difficulty: g.difficulty,
    time: g.time,
    level: me.level,
    kills: g.kills,
    shinies: g.dexLog.shinies.size,
    legends: g.rift.cleared.length,
    record: best > 0 && g.time > best,
    trainer,
  }
  return {
    kind: 'run',
    draw: async () => {
      const [challenge, board] = await Promise.all([officialPlace(place), boardOf(extras.rank)])
      return drawRunCard({ ...card, challenge, board }, wornStyle())
    },
    text: t().share.runText({ name: form.name, shiny: me.shiny, time: formatTime(g.time), outcome, shinies: card.shinies, link: trainer.url }),
    file: `pokemon-survivors-${form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`,
  }
}

/** What a Trainer Card counts, from a save: the Pokédex (caught and seen of every species), the shinies caught and the medals per tier. */
export const trainerTotals = (save: Save) => {
  const species = gameDex()
  return {
    species,
    counts: dexCounts(save.dex, species.map((e) => e.dex)),
    shinies: caughtShinies(save.dex, boxSpecies()),
    medals: Object.fromEntries(MEDALS.map((medal) => [medal, save.achievements.unlocked.filter((id) => ACHIEVEMENTS[id].medal === medal).length])) as Record<Medal, number>,
  }
}

/** Shinies worth showing first on a Trainer Card: legendaries, then the newest species. */
const showcaseOrder = (a: { dex: number; legendary: boolean }, b: { dex: number; legendary: boolean }) => Number(b.legendary) - Number(a.legendary) || b.dex - a.dex

/**
 * The Trainer Card, from the save on this device: medals, the Pokédex, the
 * best time and up to six shinies. `partner` stands beside the trainer
 * (shiny when the save plays it shiny).
 */
export const trainerShare = (partner: PlayableId): ShareCard => {
  const save = loadSave()
  const s = accountState()
  const trainer = trainerLine(save.title)
  const { species, counts, shinies, medals } = trainerTotals(save)
  const showcase = shinies
    .map((e) => ({ dex: e.dex, legendary: e.role === 'legendary' }))
    .sort(showcaseOrder)
    .map((e) => mon(e.dex, true))
  const first = PLAYABLE[partner].line[0]
  const look = localLook()
  const card: TrainerCardData = {
    date: new Date(),
    name: s.kind === 'signedIn' && s.name ? s.name : null,
    partner: { dex: first.dex, name: first.name, shiny: playsShiny(save, partner), skin: skinFor(look, first.dex), look },
    medals,
    shinies: shinies.length,
    ribbons: ribbonCounts(save.ribbons),
    dex: { caught: counts.caught, seen: counts.seen, total: species.length },
    bestTime: save.achievements.lifetime.bestTime,
    showcase,
    trainer,
  }
  return {
    kind: 'trainer',
    draw: () => drawTrainerCard(card, wornStyle()),
    text: t().share.trainerText(shinies.length, counts.caught, trainer.url),
    file: 'pokemon-survivors-trainer-card.png',
  }
}

/* ---------------- Getting it out ---------------- */

/** Phones and tablets share through the system sheet; computers copy. */
const touchFirst = () => matchMedia('(pointer: coarse)').matches

const download = (blob: Blob, file: string) => {
  const url = URL.createObjectURL(blob)
  const a = h('a', { href: url, download: file })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** The image (and its text, where the clipboard takes both) on the clipboard. */
const copy = async (blob: Blob, text: string) => {
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob, 'text/plain': new Blob([text], { type: 'text/plain' }) })])
  } catch {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
  }
}

const canCopy = () => typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard?.write === 'function'

/** What the main button does here: the share sheet (phones that take files), the clipboard, or a download. */
const primaryMethod = (file: File): ShareMethod => {
  if (touchFirst() && navigator.canShare?.({ files: [file] })) return 'share'
  return canCopy() ? 'copy' : 'download'
}

/* ---------------- Preview ---------------- */

/** Room the actions take beside the card on a wide screen (their column and the gap), in CSS px. */
const SIDE_W = 236

/**
 * The card's CSS width inside `maxW`×`maxH`: whole device px per card px,
 * so the pixels stay square, unless that leaves it much smaller than the
 * room; then it fills the room (`image-rendering: pixelated` keeps it crisp).
 */
const previewWidth = (maxW: number, maxH: number) => {
  const room = Math.max(120, Math.min(maxW, (maxH * CARD.w) / CARD.h))
  const dpr = uiDpr()
  const sharp = (CARD.w * Math.floor((room * dpr) / CARD.w)) / dpr
  return sharp >= room * 0.85 ? sharp : Math.floor(room)
}

/**
 * The card before it leaves: the image as big as the screen takes it, the
 * main button (Share on phones, Copy image on computers), then Download and
 * Close. Beside the card on a wide screen, under it on a tall one. It draws
 * the card first, so the share sheet and the clipboard get it right in the
 * tap. Esc or Backspace close it; `onClose` runs after the key dispatch.
 */
export const sharePreview = (root: HTMLElement, input: Input, card: ShareCard, onClose: () => void): Screen => {
  const m = t().share
  const img = h('img', { class: 'share-image hidden', alt: '' })
  const drawing = h('p', { class: 'share-drawing blink' }, m.rendering)
  const status = h('p', { class: 'share-status', role: 'status' })
  const figure = h('div', { class: 'share-figure' }, img, drawing, status)
  const primary = h('button', { class: 'btn confirm share-primary', disabled: true }, h('img', { src: sparkleIcon(), alt: '' }), touchFirst() ? m.share : m.copy)
  const save = h('button', { class: 'btn', disabled: true }, m.download)
  const back = h('button', { class: 'btn' }, m.back)
  let ready: { blob: Blob; file: File; url: string } | null = null
  let closed = false

  let quiet = 0
  /** A line over the card's foot for a few seconds. */
  const say = (text: string, error = false) => {
    status.textContent = text
    status.classList.toggle('error', error)
    clearTimeout(quiet)
    quiet = window.setTimeout(() => (status.textContent = ''), 2600)
  }

  const send = async (method: ShareMethod) => {
    if (!ready || closed) return
    try {
      if (method === 'share') await navigator.share({ files: [ready.file], text: card.text })
      else if (method === 'copy') {
        await copy(ready.blob, card.text)
        say(m.copied)
      } else {
        download(ready.blob, card.file)
        say(m.saved)
      }
      playSfx('unlock')
      track('share', { kind: card.kind, method })
    } catch (err) {
      // The share sheet closed without sharing: nothing to say.
      if (err instanceof DOMException && err.name === 'AbortError') return
      if (method !== 'download') return send('download')
      say(m.failed, true)
    }
  }

  const actions = [() => ready && void send(primaryMethod(ready.file)), () => void send('download'), () => close()]
  const nav = menu(input, [primary, save, back], (i) => actions[i]?.(), { horizontal: true, initial: 2 })
  const offKeys = input.onKey((key) => {
    if (key === 'Escape' || key === 'Backspace') close()
    // The buttons stack too: up and down walk them as left and right do.
    else if (key === 'ArrowUp' || key === 'KeyW') nav.focus(nav.index - 1)
    else if (key === 'ArrowDown' || key === 'KeyS') nav.focus(nav.index + 1)
  })

  const side = h(
    'div',
    { class: 'share-side' },
    h('div', { class: 'dialog-title' }, card.kind === 'run' ? m.title : m.trainerTitle),
    primary,
    h('div', { class: 'share-more' }, save, back),
    hint(m.hintKeys, ''),
  )
  const sheet = h('div', { class: 'box pop share' }, figure, side)
  const el = h('div', { class: 'screen dim share-screen' }, sheet)

  /** Lays the sheet out for the screen: the card beside the actions when the screen is wide, above them when it's tall. */
  const fit = () => {
    const { w: vw, h: vh } = uiViewport()
    const wide = vw >= 560 && vw >= vh * 1.15
    sheet.classList.toggle('wide', wide)
    // The screen's and the sheet's padding, both sides.
    const pad = (vw <= 520 || vh <= 500 ? 8 : 16) * 2 + 24
    // Under the card, the actions take what they measure (the hint shows only with keys or a pad) and the gap.
    const width = wide ? previewWidth(vw - pad - SIDE_W, vh - pad) : previewWidth(Math.min(vw - pad, 560), vh - pad - side.offsetHeight - 12)
    figure.style.width = `${width}px`
    figure.style.height = `${Math.round((width * CARD.h) / CARD.w)}px`
  }
  window.addEventListener('resize', fit)
  root.append(el)
  fit()

  void card
    .draw()
    .then(async (canvas) => {
      const blob = await cardBlob(canvas)
      // The PNG is all that's shown and shared: free the card's 4× canvas (6 MB) now.
      canvas.width = canvas.height = 0
      if (closed) return
      const url = URL.createObjectURL(blob)
      ready = { blob, file: new File([blob], card.file, { type: 'image/png' }), url }
      img.src = url
      img.classList.remove('hidden')
      drawing.remove()
      primary.disabled = false
      save.disabled = false
      nav.focus(0, false)
    })
    .catch(() => {
      drawing.textContent = m.failed
      drawing.classList.remove('blink')
      drawing.classList.add('error')
    })

  const dispose = () => {
    closed = true
    clearTimeout(quiet)
    nav.off()
    offKeys()
    window.removeEventListener('resize', fit)
    if (ready) URL.revokeObjectURL(ready.url)
    el.remove()
  }

  function close() {
    if (closed) return
    playSfx('select')
    dispose()
    later(onClose)
  }

  return { el, dispose, dim: 0.7 }
}
