import { accountHandle, accountState } from '../account'
import { track } from '../analytics'
import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { formatTime } from '../engine/math'
import { ACHIEVEMENTS, MEDALS, type Medal, type TitleId } from '../data/achievements'
import { ENEMIES } from '../data/enemies'
import { isHatchling, PLAYABLE, type PlayableId } from '../data/hatchlings'
import { TYPE_COLORS } from '../data/types'
import { dexCounts, dexNews, type Pokedex } from '../game/dex'
import type { ChallengePlace } from '../game/ranking'
import { ribbonCounts } from '../game/ribbons'
import type { DamageSource, Game } from '../game/types'
import { CARD, cardBlob, drawRunCard, drawTrainerCard, type CardMon, type CardTrainer, type RunCardData, type TrainerCardData } from '../render/card'
import type { CardStyle } from '../render/cosmetics'
import { logoScale } from '../render/logo'
import { gameUrl } from '../ranking'
import { pokedex } from '../site/pokedex'
import { t } from '../i18n'
import { h, later } from './dom'
import { boxSpecies, caughtShinies } from './pcBox'
import { loadSave } from './save'
import { damageSource, hint, menu, type Screen } from './screens'

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
  return { handle, title: title ? t().achievements.titles[title] : null, link: url.replace(/^https?:\/\/(www\.)?/, ''), url }
}

/** How long the card waits for the challenge's place before it's drawn without it (offline, a slow API). */
const PLACE_WAIT_MS = 4000

/** The place an official challenge attempt got, when the API tells it in time; null otherwise (practice, offline). */
const officialPlace = async (place: Promise<ChallengePlace | null>): Promise<RunCardData['challenge']> => {
  const got = await Promise.race([place, new Promise<null>((resolve) => setTimeout(() => resolve(null), PLACE_WAIT_MS))])
  return got?.official && got.rank !== null ? { day: got.day, rank: got.rank, total: got.total } : null
}

/**
 * The run's card, from the run as it ended and the Pokédex it started from.
 * `place`: a Desafio do dia run's place, as the API answers it at the end of the run.
 */
export const runShare = (g: Game, dexBase: Pokedex, place: Promise<ChallengePlace | null> | null = null): ShareCard => {
  const form = PLAYABLE[g.player.starter].line[g.player.stage]!
  const trainer = trainerLine(loadSave().title)
  const outcome = g.endless ? 'endless' : g.phase === 'victory' ? 'victory' : 'fainted'
  const moves = (Object.entries(g.player.damageByMove) as Array<[DamageSource, number]>)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, damage]) => {
      const src = damageSource(g, id)
      return { name: src.name, icon: src.icon, damage, color: TYPE_COLORS[src.type] }
    })
  const shinies = [...g.dexLog.shinies]
  const card: RunCardData = {
    date: new Date(),
    mon: { dex: form.dex, name: form.name, shiny: g.player.shiny },
    outcome,
    difficulty: g.difficulty,
    time: g.time,
    level: g.player.level,
    kills: g.kills,
    shinies: shinies.map((dex) => mon(dex, true)),
    newShinies: dexNews(dexBase, g.dexLog).shinies,
    newSpecies: [...g.dexLog.seen].filter((dex) => !dexBase[dex]).map((dex) => mon(dex, false)),
    moves,
    legends: g.rift.cleared.map((id) => ENEMIES[id].dex),
    challenge: null,
    trainer,
  }
  return {
    kind: 'run',
    draw: async () => drawRunCard({ ...card, challenge: place ? await officialPlace(place) : null }, wornStyle()),
    text: t().share.runText({ name: form.name, shiny: g.player.shiny, time: formatTime(g.time), outcome, shinies: shinies.length, link: trainer.url }),
    file: `pokemon-survivors-${form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`,
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
  const species = pokedex()
  const counts = dexCounts(save.dex, species.map((e) => e.dex))
  const shinies = caughtShinies(save.dex, boxSpecies())
  const medals = Object.fromEntries(MEDALS.map((medal) => [medal, save.achievements.unlocked.filter((id) => ACHIEVEMENTS[id].medal === medal).length])) as Record<Medal, number>
  const showcase = shinies
    .map((e) => ({ dex: e.dex, legendary: e.role === 'legendary' }))
    .sort(showcaseOrder)
    .map((e) => mon(e.dex, true))
  const first = PLAYABLE[partner].line[0]
  const partnerShiny = save.shinyStarters[partner] === true || (isHatchling(partner) && save.hatched[partner]?.shiny === true)
  const card: TrainerCardData = {
    date: new Date(),
    name: s.kind === 'signedIn' && s.name ? s.name : null,
    partner: { dex: first.dex, name: first.name, shiny: partnerShiny },
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

/** Whole device px per card px that fit `maxW`×`maxH` CSS px, as the CSS width: the preview stays pixel-sharp. */
const previewWidth = (maxW: number, maxH: number) => {
  const dpr = window.devicePixelRatio || 1
  const k = logoScale(CARD.w, CARD.h, maxW, maxH, dpr)
  return Math.min((CARD.w * k) / dpr, maxW)
}

/**
 * The card before it leaves: the image as it will look, the main button
 * (Share on phones, Copy image on computers), Download and Back. It draws the
 * card first, so the share sheet and the clipboard get it right in the tap.
 * Esc or Backspace close it; `onClose` runs after the key dispatch.
 */
export const sharePreview = (root: HTMLElement, input: Input, card: ShareCard, onClose: () => void): Screen => {
  const m = t().share
  const img = h('img', { class: 'share-image hidden', alt: '' })
  const status = h('p', { class: 'share-status blink' }, m.rendering)
  const figure = h('div', { class: 'share-figure' }, img)
  const primary = h('button', { class: 'btn confirm', disabled: true }, touchFirst() ? m.share : m.copy)
  const save = h('button', { class: 'btn', disabled: true }, m.download)
  const back = h('button', { class: 'btn' }, m.back)
  let ready: { blob: Blob; file: File; url: string } | null = null
  let closed = false

  const say = (text: string, error = false) => {
    status.textContent = text
    status.classList.remove('blink')
    status.classList.toggle('error', error)
  }

  const fitImage = () => {
    const vw = window.visualViewport?.width ?? window.innerWidth
    const vh = window.visualViewport?.height ?? window.innerHeight
    const sideBySide = vh <= 500 && vw > vh
    const width = sideBySide ? previewWidth(vw * 0.5, vh - 32) : previewWidth(Math.min(vw - 72, 520), vh - 250)
    img.style.width = `${width}px`
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
  const offKeys = input.onKey((key) => (key === 'Escape' || key === 'Backspace') && close())
  window.addEventListener('resize', fitImage)

  const el = h(
    'div',
    { class: 'screen dim share-screen' },
    h(
      'div',
      { class: 'dialog box pop share' },
      h('div', { class: 'dialog-title' }, card.kind === 'run' ? m.title : m.trainerTitle),
      h('div', { class: 'share-body' }, figure, h('div', { class: 'share-side' }, status, h('div', { class: 'buttons' }, primary, save, back), hint(m.hintKeys, m.hintTouch))),
    ),
  )
  root.append(el)
  fitImage()

  void card
    .draw()
    .then(async (canvas) => {
      const blob = await cardBlob(canvas)
      if (closed) return
      const url = URL.createObjectURL(blob)
      ready = { blob, file: new File([blob], card.file, { type: 'image/png' }), url }
      img.src = url
      img.classList.remove('hidden')
      status.textContent = ''
      status.classList.remove('blink')
      primary.disabled = false
      save.disabled = false
      nav.focus(0, false)
    })
    .catch(() => say(m.failed, true))

  const dispose = () => {
    closed = true
    nav.off()
    offKeys()
    window.removeEventListener('resize', fitImage)
    if (ready) URL.revokeObjectURL(ready.url)
    el.remove()
  }

  function close() {
    if (closed) return
    playSfx('select')
    dispose()
    later(onClose)
  }

  return { el, dispose, dim: 0.5 }
}
