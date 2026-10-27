import { formatTime } from '../engine/math'
import { canEvolve, evolutionOf, evolvedFrom } from '../data/evolutions'
import { ENEMIES } from '../data/enemies'
import { ABILITIES } from '../data/abilities'
import { abilityLit, abilityStacks } from '../game/abilities'
import { playerDex } from '../game/game'
import { playerForm } from '../game/branch'
import { innateAbility, isClone } from '../game/legend'
import { MAX_ITEMS, MAX_MOVES } from '../game/leveling'
import { heldMega } from '../game/mega'
import type { Game } from '../game/types'
import { weatherHere } from '../game/weather'
import { formatPokeDollars, t } from '../i18n'
import { coinIcon, curseIcon, itemIcon, moveIcon, pokeballIcon, sparkleIcon } from '../render/art'
import { CURSES } from '../data/curses'
import { legendSignature } from '../data/legends'
import { isDuo, readyDuos } from '../game/duoRules'
import { consumableIcon } from '../render/props'
import { weatherIcon } from '../render/weather'
import { treatIcon } from '../render/halloweenArt'
import { portraitUrl } from '../render/sprites'
import { abilityIcon } from '../render/abilityArt'
import { megaIcon } from '../render/megaFx'
import { h, setStyle, setText } from './dom'
import { createRiftHud } from './riftHud'
import { createPlaceCard } from './placeCard'
import { createRiftTitle } from './riftTitle'
import { phasesOf, pooledShare } from '../game/bossFight'
import { createFieldMissionHud } from './fieldMissionHud'
import { createLungeControls } from './lungeButton'
import { createMegaControls } from './megaButton'
import { moveCard, withMoveCard } from './moveCard'
import { createMovePad } from './movePad'
import { createSpecialControls } from './specialButton'
import { localPlayer } from '../game/players'
import { createMinimap } from './minimap'

const hpClass = (ratio: number) => (ratio > 0.5 ? 'hp-high' : ratio > 0.2 ? 'hp-mid' : 'hp-low')

/**
 * In-run heads-up display. `update` is called every frame and only touches what changed.
 * `onSpecial`, `onMega` and `onLunge` fire when the touch special, Mega and lunge buttons are pressed;
 * `onPause` backs the on-screen pause button (phones have no Esc key; `menu`: co-op's shared pause menu); `isHeld` (the input's)
 * lights the desktop WASD keys. Hovering or holding a move slot opens its card (`withMoveCard`). Labels are
 * read at creation: rebuild the HUD after a language switch.
 */
export const createHud = (root: HTMLElement, onSpecial: () => void, onMega: () => void, onLunge: () => void, onPause: () => void, isHeld: (code: string) => boolean, menu = false) => {
  const movePad = createMovePad(isHeld)
  const special = createSpecialControls(onSpecial)
  const mega = createMegaControls(onMega)
  const lunge = createLungeControls(onLunge)
  const rift = createRiftHud()
  const card = createPlaceCard()
  const title = createRiftTitle()
  const mission = createFieldMissionHud()
  const xpFill = h('div', { class: 'xp-fill' })
  const xpLabel = h('div', { class: 'xp-label' })
  const clock = h('span')
  const weather = h('img', { class: 'weather-icon hidden', alt: '' })
  const timer = h('div', { class: 'timer' }, weather, clock)
  const kills = h('span')
  const coins = h('span')
  const candies = h('span')
  // Noite das Bruxas: the candies of a haunted run, beside the ₽.
  const candyCounter = h('div', { class: 'kills treats hidden' }, h('img', { src: treatIcon(), alt: t().halloween.candies }), candies)
  const moveSlots = h('div', { class: 'slots' })
  const itemSlots = h('div', { class: 'slots' })
  const buffs = h('div', { class: 'buffs' })
  const bossName = h('div', { class: 'boss-name' })
  const bossFill = h('div', { class: 'boss-fill' })
  const bossBar = h('div', { class: 'boss-bar' }, bossFill)
  // A linked pair (Latias and Latios) shares the bar; under it, each one's own HP in its color.
  const pairFills = [h('i', { class: 'boss-pair-fill' }), h('i', { class: 'boss-pair-fill' })] as const
  const pairBars = h('div', { class: 'boss-pair hidden' }, h('span', { class: 'boss-pair-bar' }, pairFills[0]), h('span', { class: 'boss-pair-bar' }, pairFills[1]))
  const boss = h('div', { class: 'boss hidden' }, bossName, bossBar, pairBars)
  /** The boss whose phase ticks the bar shows (`BOSS_PHASES`), so they're laid once per boss. */
  let ticked: string | null = null
  const portrait = h('img', { class: 'status-portrait', alt: '' })
  const shinyBadge = h('img', { class: 'shiny-badge hidden', src: sparkleIcon(), alt: 'Shiny' })
  const name = h('div', { class: 'status-name' })
  const level = h('div', { class: 'status-level' })
  const hpFill = h('div', { class: 'hp-fill' })
  const hpText = h('div', { class: 'status-hp-text' })
  // The ability picked at the first evolution (the Mega's while it lasts), lit while it's doing something.
  const abilityImg = h('img', { alt: '' })
  const abilityName = h('span', { class: 'ability-tag-name' })
  const abilityCount = h('span', { class: 'ability-tag-count' })
  const ability = h('span', { class: 'ability-tag hidden' }, abilityImg, abilityName, abilityCount)
  // pointerdown (not click) feels instant on touch and never steals keyboard focus.
  // Co-op (`menu`) opens its shared pause menu, with three bars instead of two.
  const pause = menu
    ? h('button', { class: 'pause-btn menu-btn box', 'aria-label': t().team.menu.title }, h('span'), h('span'), h('span'))
    : h('button', { class: 'pause-btn box', 'aria-label': t().hud.pause }, h('span'), h('span'))
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
          candyCounter,
        ),
        pause,
      ),
    ),
    boss,
    rift.el,
    card.el,
    title.el,
    mission.el,
    h(
      'div',
      { class: 'status box' },
      h('div', { class: 'portrait-wrap' }, portrait, shinyBadge),
      h(
        'div',
        { class: 'status-body' },
        h('div', { class: 'status-head' }, name, level),
        h('div', { class: 'status-hp' }, h('span', { class: 'hp-tag' }, 'HP'), h('div', { class: 'hp-bar' }, hpFill)),
        h('div', { class: 'status-foot' }, ability, hpText),
      ),
    ),
    movePad.el,
    special.button,
    mega.button,
    lunge.button,
  )
  const minimap = createMinimap(el)
  el.append(minimap.el)
  // First child, so a HUD rebuilt mid-run still sits under open menus and toasts.
  root.prepend(el)

  let loadoutKey = ''
  let portraitKey = ''
  let buffKey = ''
  let buffFills: HTMLElement[] = []
  let weatherKey = ''
  let abilityKey = ''

  /** Timed buffs (icon + draining bar) and a held Revive. Rebuilt only when the set changes. */
  const renderBuffs = (g: Game) => {
    buffFills = []
    buffs.replaceChildren(
      ...localPlayer(g).buffs.map((b) => {
        const fill = h('div', { class: 'buff-fill' })
        buffFills.push(fill)
        return h('div', { class: 'buff' }, h('img', { src: consumableIcon(b.id), alt: '' }), h('div', { class: 'buff-bar' }, fill))
      }),
      ...(localPlayer(g).revives > 0 ? [h('div', { class: 'buff revive', title: 'Revive' }, h('img', { src: consumableIcon('revive'), alt: '' }))] : []),
      // Cursed items stay for the run, in their purple frame.
      ...localPlayer(g).curses.held.map((id) => h('div', { class: 'buff cursed', title: `${CURSES[id].name}: ${t().curses[id].downside}` }, h('img', { src: curseIcon(id), alt: '' }))),
    )
  }

  const renderSlots = (g: Game) => {
    const p = localPlayer(g)
    // Moves a fusion on the table would use blink in the duo's colors.
    const fusing = new Set(readyDuos(p.moves, legendSignature(p.starter), p.banished).flatMap((d) => d.from))
    moveSlots.replaceChildren(
      ...Array.from({ length: MAX_MOVES }, (_, i) => {
        const m = p.moves[i]
        const evo = m && evolutionOf(m.id)
        const ready = evo !== undefined && canEvolve(evo, p)
        const duo = m !== undefined && isDuo(m.id)
        const cls = ['slot', ready && 'evo-ready', m && fusing.has(m.id) && 'duo-ready', duo && 'duo'].filter(Boolean).join(' ')
        const slot = h(
          'div',
          { class: cls },
          m && h('img', { src: moveIcon(m.id), alt: '' }),
          m && h('span', { class: 'slot-level' }, evolvedFrom(m.id) ? `★${m.level}` : duo ? `✦${m.level}` : m.level),
        )
        if (m) withMoveCard(slot, () => moveCard(g, m.id, { level: m.level, path: m.path, describe: true }))
        return slot
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
    const p = localPlayer(g)
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
    if (g.halloween) {
      candyCounter.classList.remove('hidden')
      setText(candies, String(g.candies))
    }
    movePad.update()
    special.update(g)
    mega.update(g)
    lunge.update(g)
    rift.update(g)
    card.update(g)
    title.update(g)
    mission.update(g, !rift.el.classList.contains('hidden'))
    minimap.update(g)

    const key = [...p.moves.map((m) => `${m.id}${m.level}`), ...p.items.map((i) => `${i.id}${i.level}`)].join()
    if (key !== loadoutKey) {
      loadoutKey = key
      renderSlots(g)
    }

    const bkey = `${localPlayer(g).buffs.map((b) => b.id).join()}|${localPlayer(g).revives}|${localPlayer(g).curses.held.join()}`
    if (bkey !== buffKey) {
      buffKey = bkey
      renderBuffs(g)
    }
    localPlayer(g).buffs.forEach((b, i) => {
      const fill = buffFills[i]
      if (!fill) return
      setStyle(fill, 'width', `${((b.left / b.total) * 100).toFixed(1)}%`)
      fill.parentElement!.parentElement!.classList.toggle('ending', b.left < 3)
    })

    const dex = playerDex(g)
    const megaName = localPlayer(g).mega.active > 0 ? heldMega(g)?.name : undefined
    // A legend's awakened form (Primal Kyogre) renames it on the same dex.
    const formName = playerForm(g).name
    if (`${dex}${p.shiny}${megaName}${formName}` !== portraitKey) {
      portraitKey = `${dex}${p.shiny}${megaName}${formName}`
      portrait.setAttribute('src', portraitUrl(dex, p.shiny))
      shinyBadge.classList.toggle('hidden', !p.shiny)
      name.classList.toggle('shiny-name', p.shiny)
      name.classList.toggle('mega-name', megaName !== undefined)
      setText(name, megaName ?? formName)
    }
    setText(level, t().levelShort(p.level))
    const ratio = Math.max(0, p.hp / p.stats.maxHp)
    setStyle(hpFill, 'width', `${(ratio * 100).toFixed(1)}%`)
    const fillClass = `hp-fill ${hpClass(ratio)}`
    if (hpFill.className !== fillClass) hpFill.className = fillClass
    setText(hpText, `${Math.ceil(p.hp)}/${Math.round(p.stats.maxHp)}`)

    const megaDef = localPlayer(g).mega.active > 0 ? heldMega(g) : null
    // A legend shows its innate until it picks an Ability at its first awakening.
    const id = localPlayer(g).ability.id ?? innateAbility(localPlayer(g).starter)
    const stacks = megaDef || !id ? 0 : abilityStacks(g)
    const lit = !megaDef && id !== null && abilityLit(g)
    const akey = `${id}|${megaDef?.ability}|${lit}|${stacks}`
    if (akey !== abilityKey) {
      abilityKey = akey
      ability.classList.toggle('hidden', !id && !megaDef)
      ability.classList.toggle('lit', lit)
      ability.classList.toggle('mega', megaDef !== null)
      if (megaDef) abilityImg.setAttribute('src', megaIcon())
      else if (id) abilityImg.setAttribute('src', abilityIcon(id))
      setText(abilityName, megaDef ? megaDef.ability : id ? ABILITIES[id].name : '')
      setText(abilityCount, stacks > 0 ? t().hud.jumps(stacks) : '')
      ability.setAttribute('title', megaDef ? t().ability.megaNote : id ? t().abilities[id] : '')
    }

    const b = g.bossId !== null ? g.enemies.find((e) => e.id === g.bossId) : undefined
    boss.classList.toggle('hidden', !b)
    const mate = b?.fight && b.fight.link >= 0 ? g.enemies.find((e) => e.id === b.fight!.link) : undefined
    pairBars.classList.toggle('hidden', !mate)
    if (b && mate) {
      setText(bossName, t().rifts.pairName(ENEMIES[b.kind].name, ENEMIES[mate.kind].name))
      setStyle(bossFill, 'width', `${(pooledShare(b, mate) * 100).toFixed(1)}%`)
      setStyle(pairFills[0], 'width', `${((Math.max(0, b.hp) / b.maxHp) * 100).toFixed(1)}%`)
      setStyle(pairFills[1], 'width', `${((Math.max(0, mate.hp) / mate.maxHp) * 100).toFixed(1)}%`)
      pairFills[0].classList.toggle('down', b.fight?.down === true)
      pairFills[1].classList.toggle('down', mate.fight?.down === true)
      pairFills[0].dataset.kind = b.kind
      pairFills[1].dataset.kind = mate.kind
    } else if (b) {
      setText(bossName, isClone(g, b) ? t().legend.clone(ENEMIES[b.kind].name) : ENEMIES[b.kind].name)
      setStyle(bossFill, 'width', `${((b.hp / b.maxHp) * 100).toFixed(1)}%`)
    }
    if (b) {
      if (ticked !== b.kind) {
        ticked = b.kind
        bossBar.replaceChildren(bossFill, ...(phasesOf(b.kind) ?? []).slice(1).filter((ph) => ph.rebirth === undefined).map((ph) => h('i', { class: 'boss-tick', style: `left:${(ph.below * 100).toFixed(1)}%` })))
      }
    }
  }

  /** Hides the touch buttons (special, Mega, lunge) while a menu or the results screen is up, so they never cover its buttons. */
  const setMenuOpen = (open: boolean) => el.classList.toggle('menu-open', open)

  const dispose = () => {
    minimap.dispose()
    el.remove()
  }

  return { update, setMenuOpen, dispose }
}

export type Hud = ReturnType<typeof createHud>
