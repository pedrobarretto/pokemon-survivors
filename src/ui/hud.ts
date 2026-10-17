import { formatTime } from '../engine/math'
import { canEvolve, evolutionOf, evolvedFrom } from '../data/evolutions'
import { ENEMIES } from '../data/enemies'
import { PLAYABLE } from '../data/hatchlings'
import { playerDex } from '../game/game'
import { MAX_ITEMS, MAX_MOVES } from '../game/leveling'
import { heldMega } from '../game/mega'
import type { Game } from '../game/types'
import { weatherHere } from '../game/weather'
import { formatPokeDollars, t } from '../i18n'
import { coinIcon, itemIcon, moveIcon, pokeballIcon, sparkleIcon } from '../render/art'
import { consumableIcon } from '../render/props'
import { weatherIcon } from '../render/weather'
import { portraitUrl } from '../render/sprites'
import { h, setStyle, setText } from './dom'
import { createRiftHud } from './riftHud'
import { createLungeControls } from './lungeButton'
import { createMegaControls } from './megaButton'
import { createMovePad } from './movePad'
import { createSpecialControls } from './specialButton'

const hpClass = (ratio: number) => (ratio > 0.5 ? 'hp-high' : ratio > 0.2 ? 'hp-mid' : 'hp-low')

/**
 * In-run heads-up display. `update` is called every frame and only touches what changed.
 * `onSpecial`, `onMega` and `onLunge` fire when the touch special, Mega and lunge buttons are pressed;
 * `onPause` backs the on-screen pause button (phones have no Esc key); `isHeld` (the input's)
 * lights the desktop WASD keys. Labels are
 * read at creation: rebuild the HUD after a language switch.
 */
export const createHud = (root: HTMLElement, onSpecial: () => void, onMega: () => void, onLunge: () => void, onPause: () => void, isHeld: (code: string) => boolean) => {
  const movePad = createMovePad(isHeld)
  const special = createSpecialControls(onSpecial)
  const mega = createMegaControls(onMega)
  const lunge = createLungeControls(onLunge)
  const rift = createRiftHud()
  const xpFill = h('div', { class: 'xp-fill' })
  const xpLabel = h('div', { class: 'xp-label' })
  const clock = h('span')
  const weather = h('img', { class: 'weather-icon hidden', alt: '' })
  const timer = h('div', { class: 'timer' }, weather, clock)
  const kills = h('span')
  const coins = h('span')
  const moveSlots = h('div', { class: 'slots' })
  const itemSlots = h('div', { class: 'slots' })
  const buffs = h('div', { class: 'buffs' })
  const bossName = h('div', { class: 'boss-name' })
  const bossFill = h('div', { class: 'boss-fill' })
  const boss = h('div', { class: 'boss hidden' }, bossName, h('div', { class: 'boss-bar' }, bossFill))
  const portrait = h('img', { class: 'status-portrait', alt: '' })
  const shinyBadge = h('img', { class: 'shiny-badge hidden', src: sparkleIcon(), alt: 'Shiny' })
  const name = h('div', { class: 'status-name' })
  const level = h('div', { class: 'status-level' })
  const hpFill = h('div', { class: 'hp-fill' })
  const hpText = h('div', { class: 'status-hp-text' })
  // pointerdown (not click) feels instant on touch and never steals keyboard focus.
  const pause = h('button', { class: 'pause-btn box', 'aria-label': t().hud.pause }, h('span'), h('span'))
  pause.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    onPause()
  })

  const el = h(
    'div',
    { class: 'hud' },
    h('div', { class: 'xp' }, xpFill, xpLabel),
    h(
      'div',
      { class: 'hud-row' },
      h('div', { class: 'hud-left' }, h('div', { class: 'loadout' }, moveSlots, itemSlots, buffs), special.badge, lunge.badge, mega.badge),
      timer,
      h(
        'div',
        { class: 'hud-right' },
        h(
          'div',
          { class: 'counters' },
          h('div', { class: 'kills' }, h('img', { src: pokeballIcon(), alt: '' }), kills),
          h('div', { class: 'kills coins' }, h('img', { src: coinIcon(0), alt: '' }), coins),
        ),
        pause,
      ),
    ),
    boss,
    rift.el,
    h(
      'div',
      { class: 'status box' },
      h('div', { class: 'portrait-wrap' }, portrait, shinyBadge),
      h(
        'div',
        { class: 'status-body' },
        h('div', { class: 'status-head' }, name, level),
        h('div', { class: 'status-hp' }, h('span', { class: 'hp-tag' }, 'HP'), h('div', { class: 'hp-bar' }, hpFill)),
        hpText,
      ),
    ),
    movePad.el,
    special.button,
    mega.button,
    lunge.button,
  )
  // First child, so a HUD rebuilt mid-run still sits under open menus and toasts.
  root.prepend(el)

  let loadoutKey = ''
  let portraitKey = ''
  let buffKey = ''
  let buffFills: HTMLElement[] = []
  let weatherKey = ''

  /** Timed buffs (icon + draining bar) and a held Revive. Rebuilt only when the set changes. */
  const renderBuffs = (g: Game) => {
    buffFills = []
    buffs.replaceChildren(
      ...g.buffs.map((b) => {
        const fill = h('div', { class: 'buff-fill' })
        buffFills.push(fill)
        return h('div', { class: 'buff' }, h('img', { src: consumableIcon(b.id), alt: '' }), h('div', { class: 'buff-bar' }, fill))
      }),
      ...(g.revives > 0 ? [h('div', { class: 'buff revive', title: 'Revive' }, h('img', { src: consumableIcon('revive'), alt: '' }))] : []),
    )
  }

  const renderSlots = (g: Game) => {
    const p = g.player
    moveSlots.replaceChildren(
      ...Array.from({ length: MAX_MOVES }, (_, i) => {
        const m = p.moves[i]
        const evo = m && evolutionOf(m.id)
        const ready = evo !== undefined && canEvolve(evo, p)
        return h(
          'div',
          { class: ready ? 'slot evo-ready' : 'slot' },
          m && h('img', { src: moveIcon(m.id), alt: '' }),
          m && h('span', { class: 'slot-level' }, evolvedFrom(m.id) ? '★' : m.level),
        )
      }),
    )
    itemSlots.replaceChildren(
      ...Array.from({ length: MAX_ITEMS }, (_, i) => {
        const it = p.items[i]
        return h('div', { class: 'slot item' }, it && h('img', { src: itemIcon(it.id), alt: '' }), it && h('span', { class: 'slot-level' }, it.level))
      }),
    )
  }

  const update = (g: Game) => {
    const p = g.player
    setStyle(xpFill, 'width', `${Math.min(100, (p.xp / p.xpNext) * 100).toFixed(1)}%`)
    setText(xpLabel, t().level(p.level))
    setText(clock, formatTime(g.time))
    if (weatherHere(g) !== weatherKey) {
      const id = weatherHere(g)
      weatherKey = id
      weather.classList.toggle('hidden', id === 'clear')
      if (id !== 'clear') weather.setAttribute('src', weatherIcon(id))
      weather.setAttribute('alt', t().world.weather[id])
      weather.setAttribute('title', t().world.weather[id])
    }
    setText(kills, String(g.kills))
    setText(coins, formatPokeDollars(g.coins))
    movePad.update()
    special.update(g)
    mega.update(g)
    lunge.update(g)
    rift.update(g)

    const key = [...p.moves.map((m) => `${m.id}${m.level}`), ...p.items.map((i) => `${i.id}${i.level}`)].join()
    if (key !== loadoutKey) {
      loadoutKey = key
      renderSlots(g)
    }

    const bkey = `${g.buffs.map((b) => b.id).join()}|${g.revives}`
    if (bkey !== buffKey) {
      buffKey = bkey
      renderBuffs(g)
    }
    g.buffs.forEach((b, i) => {
      const fill = buffFills[i]
      if (!fill) return
      setStyle(fill, 'width', `${((b.left / b.total) * 100).toFixed(1)}%`)
      fill.parentElement!.parentElement!.classList.toggle('ending', b.left < 3)
    })

    const dex = playerDex(g)
    const megaName = g.mega.active > 0 ? heldMega(g)?.name : undefined
    if (`${dex}${p.shiny}${megaName}` !== portraitKey) {
      portraitKey = `${dex}${p.shiny}${megaName}`
      portrait.setAttribute('src', portraitUrl(dex, p.shiny))
      shinyBadge.classList.toggle('hidden', !p.shiny)
      name.classList.toggle('shiny-name', p.shiny)
      name.classList.toggle('mega-name', megaName !== undefined)
      setText(name, megaName ?? PLAYABLE[g.starter].line[p.stage]!.name)
    }
    setText(level, t().levelShort(p.level))
    const ratio = Math.max(0, p.hp / p.stats.maxHp)
    setStyle(hpFill, 'width', `${(ratio * 100).toFixed(1)}%`)
    const fillClass = `hp-fill ${hpClass(ratio)}`
    if (hpFill.className !== fillClass) hpFill.className = fillClass
    setText(hpText, `${Math.ceil(p.hp)}/${Math.round(p.stats.maxHp)}`)

    const b = g.bossId !== null ? g.enemies.find((e) => e.id === g.bossId) : undefined
    boss.classList.toggle('hidden', !b)
    if (b) {
      setText(bossName, ENEMIES[b.kind].name)
      setStyle(bossFill, 'width', `${((b.hp / b.maxHp) * 100).toFixed(1)}%`)
    }
  }

  /** Hides the touch buttons (special, Mega, lunge) while a menu or the results screen is up, so they never cover its buttons. */
  const setMenuOpen = (open: boolean) => el.classList.toggle('menu-open', open)

  return { update, setMenuOpen, dispose: () => el.remove() }
}

export type Hud = ReturnType<typeof createHud>
