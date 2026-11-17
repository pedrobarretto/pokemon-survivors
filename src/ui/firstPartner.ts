import { GUIDE } from '../data/guide'
import { REGIONS, STARTERS, type StarterId } from '../data/starters'
import { playCry, playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { t } from '../i18n'
import { cryUrl, loadSpecies } from '../render/sprites'
import { emotionUrl } from './dialogue'
import { h } from './dom'
import { stepGrid, type Step } from './gridNav'
import { hint, typeBadge, type Screen } from './screens'
import { actionBar, shellScreen, topBar } from './shell'
import { drawIdle, fitPixels } from './welcome'
import './welcome.css'

/** Every starter, region by region (Grass, Fire, Water each): the cards' order, and what the arrows walk. */
const ORDER: readonly StarterId[] = REGIONS.flatMap((r) => r.starters)

/** A card's canvas, in art px. */
const CARD = 40

const firstStage = (id: StarterId) => STARTERS[id].line[0]

/**
 * The first visit's partner pick (arm `tour`, `firstTime.ts`): every starter
 * of every region, each card idling with its types, under Rotom's line
 * (`afterTutorial` picks it). A tap selects (a second one doesn't start: only the bar's button does, as in the partner select) and the button starts the
 * first run with it (`pick`); arrows (keys, pad) walk the cards as laid out,
 * 1-9 jump to a region, Enter starts. No back: the welcome led here, and the
 * lobby waits for after the first run.
 */
export const firstPartnerScreen = (root: HTMLElement, input: Input, opts: { initial: StarterId; afterTutorial: boolean; pick: (id: StarterId) => void }): Screen => {
  const m = t().welcome
  let selected = ORDER.includes(opts.initial) ? opts.initial : 'charmander'
  let picked = false

  const canvases = new Map<StarterId, HTMLCanvasElement>()
  const cards = new Map<StarterId, HTMLButtonElement>()
  const card = (id: StarterId) => {
    const stage = firstStage(id)
    const canvas = h('canvas', { width: CARD, height: CARD, class: 'first-partner-sprite' })
    canvases.set(id, canvas)
    void loadSpecies(stage.dex).catch(() => {})
    const el = h(
      'button',
      { class: 'first-partner-card box', type: 'button', style: `--t:${STARTERS[id].color}`, 'aria-label': stage.name, onclick: () => select(id) },
      canvas,
      h('b', { class: 'first-partner-name' }, stage.name),
      h('span', { class: 'types' }, ...stage.types.map(typeBadge)),
    )
    cards.set(id, el)
    return el
  }
  const regions = REGIONS.map((r) => h('section', { class: 'first-partner-region' }, h('h3', { class: 'first-partner-region-name' }, h('small', {}, `${r.gen}`), r.name), h('div', { class: 'first-partner-row' }, ...r.starters.map(card))))
  const grid = h('div', { class: 'first-partner-grid' }, ...regions)

  const say = h(
    'div',
    { class: 'first-partner-say box pop' },
    h('img', { class: 'first-partner-portrait', src: emotionUrl(GUIDE.dex, opts.afterTutorial ? 'Joyous' : 'Happy'), alt: '', width: 40, height: 40 }),
    h('p', {}, h('b', { style: `color:${GUIDE.color}` }, GUIDE.name), ' ', opts.afterTutorial ? m.pickAfterTutorial : m.pickLine),
  )
  const goButton = h('button', { class: 'btn selected confirm first-partner-go', type: 'button', onclick: () => go() })
  const el = shellScreen({
    class: 'first-partner-screen',
    top: topBar({ title: m.pickTitle }),
    body: [say, grid, hint(m.pickHintKeys, m.pickHintTouch)],
    bottom: actionBar(goButton),
  })
  root.append(el)

  const fit = () => {
    const want = matchMedia('(max-height: 500px)').matches ? 40 : matchMedia('(max-width: 420px)').matches ? 56 : 80
    for (const c of canvases.values()) fitPixels(c, want)
  }
  fit()
  addEventListener('resize', fit)

  /** Shows the selection on its card and the button, keeping the card in sight. */
  const render = (scroll: boolean) => {
    for (const [id, c] of cards) c.classList.toggle('selected', id === selected)
    goButton.textContent = m.go(firstStage(selected).name)
    if (scroll) cards.get(selected)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }
  const select = (id: StarterId, scroll = false) => {
    if (id === selected || picked) return
    selected = id
    playSfx('move')
    playCry(cryUrl(firstStage(id).dex), 0.25)
    render(scroll)
  }
  const go = () => {
    if (picked) return
    picked = true
    playSfx('select')
    opts.pick(selected)
  }

  /** How many regions sit side by side in this layout (1 on a phone held upright, up to 3 on a computer), read from where they landed. */
  const regionsPerRow = () => {
    const top = regions[0]!.offsetTop
    return Math.max(1, regions.filter((r) => r.offsetTop === top).length)
  }
  const step = (dir: Step) => {
    const next = stepGrid(ORDER.indexOf(selected), dir, 3 * regionsPerRow(), ORDER.length)
    if (typeof next === 'number') select(ORDER[next]!, true)
  }
  const off = input.onKey((key) => {
    if (picked) return
    if (key === 'ArrowLeft' || key === 'KeyA') step('left')
    else if (key === 'ArrowRight' || key === 'KeyD') step('right')
    else if (key === 'ArrowUp' || key === 'KeyW') step('up')
    else if (key === 'ArrowDown' || key === 'KeyS') step('down')
    else if (/^Digit[1-9]$/.test(key)) select(ORDER[(Number(key.slice(5)) - 1) * 3 + (ORDER.indexOf(selected) % 3)]!, true)
    else if (key === 'Enter' || key === 'Space') go()
  })

  render(false)
  // A partner saved further down (a reload) starts in sight; Charmander's row is already there, under Rotom's line.
  requestAnimationFrame(() => cards.get(selected)?.scrollIntoView({ block: 'nearest' }))

  return {
    el,
    tick: (time) => {
      // Each card idles a beat apart, so the grid breathes instead of marching in step.
      for (const [i, id] of ORDER.entries()) drawIdle(canvases.get(id)!, firstStage(id).dex, time + i * 0.37)
    },
    dispose: () => {
      off()
      removeEventListener('resize', fit)
      el.remove()
    },
  }
}
