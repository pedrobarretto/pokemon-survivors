import { COOP } from '../data/coop'
import { VERSUS } from '../data/versus'
import { CURSES } from '../data/curses'
import { evolvedFrom } from '../data/evolutions'
import { ITEMS } from '../data/items'
import { formAt } from '../game/branch'
import { fainted } from '../game/coop'
import { isDuo } from '../game/duoRules'
import { MOVES, maxMoveLevel, type MoveId } from '../game/moves'
import type { Game, Player } from '../game/types'
import { t } from '../i18n'
import { curseIcon, itemIcon, moveIcon, teamAwayIcon, teamBallIcon, sparkleIcon } from '../render/art'
import { shownLook } from '../render/looks'
import { portraitUrl } from '../render/sprites'
import { busyWith, slotColor } from '../render/team'
import { TEAM_COLORS } from '../render/vale'
import { titleChip } from './arenaTitle'
import { h, setStyle, setText } from './dom'
import { moveCard, withMoveCard } from './moveCard'
import { versusName } from './versusHud'

/** The name the team sees for a seat: the one it joined with, or "Jogador 2" (in Versus, a bot's Pokémon with "CPU"). */
export const seatName = (g: Game, slot: number) => (g.versus ? versusName(g, slot) : g.coop?.names[slot]?.trim() || t().team.player(slot + 1))

/** What a teammate's card says they're up to, or null while they just play. */
type CardState = 'fainted' | 'away' | 'choosing' | 'evolving' | 'left' | null

const stateOf = (p: Player): CardState => {
  if (p.gone) return 'left'
  if (fainted(p)) return 'fainted'
  if (p.away) return 'away'
  const busy = busyWith(p)
  if (busy === 'evolve' || busy === 'mega') return 'evolving'
  return busy ? 'choosing' : null
}

/** What a player's build looks like now: redraw their icons when it changes. */
const buildKey = (p: Player) => [...p.moves.map((m) => `${m.id}${m.level}`), '|', ...p.items.map((i) => `${i.id}${i.level}`), '|', ...p.curses.held].join()

/** A move's level as the HUD's slots write it: ★ evolved, ✦ duo. */
const moveLevel = (id: MoveId, level: number) => (evolvedFrom(id) ? `★${level}` : isDuo(id) ? `✦${level}` : String(level))

/**
 * `p`'s build as icons with their levels: the moves (each opens its card with
 * `p`'s stats on hover or a held finger), then the items and cursed items.
 * `big`: the menu's size, the HUD's cards use the small one.
 */
const buildIcons = (g: Game, p: Player, big = false) => {
  const cls = big ? 'team-build big' : 'team-build'
  const moves = p.moves.map((m) => {
    const icon = h('span', { class: m.level >= maxMoveLevel(m.id) ? 'build-icon max' : 'build-icon' }, h('img', { src: moveIcon(m.id), alt: MOVES[m.id].name }), h('i', {}, moveLevel(m.id, m.level)))
    withMoveCard(icon, () => moveCard(g, m.id, { level: m.level, path: m.path, describe: true, owner: p }))
    return icon
  })
  const items = [
    ...p.items.map((i) => h('span', { class: 'build-icon item', title: ITEMS[i.id].name }, h('img', { src: itemIcon(i.id), alt: ITEMS[i.id].name }), h('i', {}, String(i.level)))),
    ...p.curses.held.map((id) => h('span', { class: 'build-icon item cursed', title: `${CURSES[id].name}: ${t().curses[id].downside}` }, h('img', { src: curseIcon(id), alt: CURSES[id].name }))),
  ]
  return h('div', { class: cls }, h('div', { class: 'build-row' }, ...moves), items.length > 0 && h('div', { class: 'build-row' }, ...items))
}

/**
 * The co-op menu's look at the team: each teammate's face, name (and the
 * title their look wears) and level over their build (moves and items with
 * their levels), so a player can read what the others run and coordinate
 * theirs. Null solo or alone.
 */
export const teamBuilds = (g: Game, me: Player) => {
  // Versus: your team's builds only.
  const mates = g.players.filter((p) => p !== me && !p.gone && (!p.versus || p.versus.team === me.versus?.team))
  if (g.coop === null || mates.length === 0) return null
  return h(
    'div',
    { class: 'team-builds' },
    ...mates.map((p) =>
      h(
        'div',
        { class: 'team-build-card', style: `--slot:${slotColor(p.slot)}` },
        h(
          'div',
          { class: 'team-build-head' },
          h('img', { class: 'team-portrait', src: portraitUrl(formAt(p.starter, p.branch, p.stage).dex, p.shiny), alt: '' }),
          h('b', { class: 'team-name' }, seatName(g, p.slot), titleChip(shownLook(g, p.slot).title)),
          h('span', { class: 'team-level' }, t().levelShort(p.level)),
        ),
        buildIcons(g, p, true),
      ),
    ),
  )
}

type Card = { el: HTMLElement; portrait: HTMLImageElement; badge: HTMLImageElement; level: HTMLElement; fill: HTMLElement; state: HTMLElement; clock: HTMLElement; build: HTMLElement; energy: HTMLElement; key: string; mode: string; loadout: string; shown: string }

/**
 * Co-op HUD: one compact card per teammate (not the client's own player, whose
 * status box is the HUD's), in seat order: their Pokémon's portrait framed in
 * their seat color, name, level and HP, or what keeps them out (fainted,
 * away, choosing, evolving, left) with a pick screen's clock, and under it
 * their build (moves and items, a move's card on hover or hold). Three cards fit
 * a phone held upright in one row under the top bar; landscape stacks them on
 * the left (`style.css`). `update` runs every frame and only touches what changed.
 * In an Arena match the cards are slimmer (`vs`): no build, the Energy the
 * teammate carries instead, and their respawn countdown while they're down.
 */
export const createTeamHud = (root: HTMLElement) => {
  const el = h('div', { class: 'team-hud' })
  const cards = new Map<number, Card>()

  const cardFor = (g: Game, p: Player) => {
    const known = cards.get(p.slot)
    if (known) return known
    const portrait = h('img', { class: 'team-portrait', alt: '' })
    const badge = h('img', { class: 'team-badge hidden', alt: '' })
    const level = h('span', { class: 'team-level' })
    const fill = h('div', { class: 'hp-fill hp-high' })
    const state = h('span', { class: 'team-state hidden' })
    const clock = h('div', { class: 'team-clock hidden' })
    const build = h('div', { class: 'team-build' })
    const energy = h('span', { class: 'team-energy hidden' })
    const card = h(
      'div',
      { class: 'team-card', style: `--slot:${p.versus ? TEAM_COLORS[p.versus.team] : slotColor(p.slot)}` },
      h('div', { class: 'team-face' }, portrait, badge),
      h(
        'div',
        { class: 'team-body' },
        h('div', { class: 'team-head' }, h('b', { class: 'team-name' }, seatName(g, p.slot)), energy, level),
        h('div', { class: 'team-hp' }, fill),
        state,
      ),
      build,
      clock,
    )
    const made: Card = { el: card, portrait, badge, level, fill, state, clock, build, energy, key: '', mode: '', loadout: '', shown: '' }
    cards.set(p.slot, made)
    el.append(card)
    return made
  }

  /** The HUD's top bar the cards sit under (null until the HUD exists: it's made after the team layer, and again on a language switch). */
  let under: Element | null = null
  /**
   * Where the cards end, as `--team-bottom` on the HUD (`with-team`): on a
   * phone held upright the boss bar and the pills move below the row
   * (`style.css`). Measured when the bar or the cards change size.
   */
  const sizes = new ResizeObserver(() => {
    const hud = el.parentElement
    if (hud) hud.style.setProperty('--team-bottom', `${el.offsetTop + el.offsetHeight}px`)
  })
  /** In the HUD's flow right under its top bar, so it follows the bar's height on every screen. */
  const place = () => {
    under = root.querySelector('.hud .hud-row')
    if (under) {
      under.after(el)
      under.parentElement?.classList.add('with-team')
      sizes.disconnect()
      sizes.observe(under)
      sizes.observe(el)
    } else if (!el.isConnected) root.append(el)
  }

  const update = (g: Game, me: Player) => {
    if (!under?.isConnected) place()
    for (const p of g.players) {
      // Versus: the cards are your team's (the rivals show on the field and the minimap).
      if (p === me || (p.versus && p.versus.team !== me.versus?.team)) continue
      const card = cardFor(g, p)
      const dex = formAt(p.starter, p.branch, p.stage).dex
      const key = `${dex}${p.shiny}`
      if (key !== card.key) {
        card.key = key
        card.portrait.src = portraitUrl(dex, p.shiny)
      }
      const state = stateOf(p)
      const mode = state ?? ''
      if (mode !== card.mode) {
        card.mode = mode
        card.shown = ''
        card.el.className = `team-card${p.versus ? ' vs' : ''}${state ? ` ${state}` : ''}`
        card.state.classList.toggle('hidden', !state)
        setText(card.state, state ? t().team.state[state] : '')
        const icon = state === 'fainted' ? teamBallIcon() : state === 'away' ? teamAwayIcon() : state === 'evolving' ? sparkleIcon() : null
        card.badge.classList.toggle('hidden', !icon)
        if (icon) card.badge.src = icon
      }
      if (p.versus) {
        // Arena: what they carry, and when they're back while down.
        const carried = Math.floor(p.versus.energy)
        const down = p.hp <= 0 && p.versus.respawn > 0 ? Math.ceil(p.versus.respawn) : 0
        const shown = `${carried}|${down}`
        if (shown !== card.shown) {
          card.shown = shown
          card.energy.classList.toggle('hidden', carried <= 0)
          card.energy.classList.toggle('full', carried >= VERSUS.energy.cap)
          setText(card.energy, String(carried))
          if (down) setText(card.state, t().versus.hud.respawn(down))
        }
      }
      const loadout = buildKey(p)
      if (!p.versus && loadout !== card.loadout) {
        card.loadout = loadout
        const next = buildIcons(g, p)
        card.build.replaceWith(next)
        card.build = next
      }
      setText(card.level, t().levelShort(p.level))
      const ratio = Math.max(0, Math.min(1, p.hp / p.stats.maxHp))
      setStyle(card.fill, 'width', `${Math.round(ratio * 100)}%`)
      const cls = `hp-fill ${ratio > 0.5 ? 'hp-high' : ratio > 0.2 ? 'hp-mid' : 'hp-low'}`
      if (card.fill.className !== cls) card.fill.className = cls
      // A pick screen's clock drains under the card while they choose.
      const choosing = state === 'choosing'
      card.clock.classList.toggle('hidden', !choosing)
      if (choosing) setStyle(card.clock, '--left', `${Math.max(0, Math.min(1, p.pickLeft / (p.versus ? VERSUS.pickTime : COOP.pick.time))).toFixed(2)}`)
    }
  }

  place()
  return { el, update, dispose: () => (sizes.disconnect(), el.remove()) }
}

export type TeamHud = ReturnType<typeof createTeamHud>
