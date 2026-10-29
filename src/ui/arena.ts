import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { ENEMIES } from '../data/enemies'
import { STARTERS } from '../data/starters'
import { isVersusPick, ROLES, VERSUS_PICKS, VERSUS_ROSTER, type Role, type VersusPick } from '../data/versus'
import { t } from '../i18n'
import type { QueueKind } from '../data/arenaRanked'
import { ARENA_FORMAT_IDS, ARENA_FORMATS, parseArenaFormat, type ArenaFormat } from '../data/arenaFormats'
import { arenaIcon, coopIcon } from '../render/art'
import { arenaIconUrl, loadValeArt, ROLE_ICONS, tierBallUrl } from '../render/arenaArt'
import { portraitUrl } from '../render/sprites'
import { h, later } from './dom'
import { stepGrid } from './gridNav'
import { hint, type Screen } from './screens'

/**
 * Arena (Versus) outside a match: the screen the lobby's tile opens and, from
 * an Arena room, the same picker to change the room's Pokémon (`choose`).
 * The selected Pokémon stands in a hero panel (its role, what the role does,
 * the role's numbers as bars, its evolution line) beside the roster of the
 * 27 starters, which role chips filter; below, the Como jogar strip, the
 * format (4v4 Padrão on the Vale, 3v3 Rápida on the Clareira) and the four
 * ways to play it, each saying what it is (Treino against bots, the public
 * queue's Casual and Ranqueada, Com amigos), and the way to the Arena's hub
 * (Ranking). The pick and the format are kept on the device (`ps:arenaPick`,
 * `ps:arenaFormat`).
 */

/** Each team's color, the world's (`render/vale.ts`): the HUD, the room and the end screen use the same. */
export { teamColor } from '../render/vale'

/** Unite's role colors, for the chips. */
export const ROLE_COLORS = {
  attacker: '#f08030',
  speedster: '#3898f8',
  allRounder: '#a060e0',
  defender: '#48b040',
  supporter: '#e0a818',
} as const satisfies Record<Role, string>

const ROLE_IDS = Object.keys(ROLE_COLORS) as Role[]

/** A role's icon, for an `<img>` beside its name. */
export const roleIcon = (role: Role, cls = 'arena-role-icon') => h('img', { class: cls, src: arenaIconUrl(ROLE_ICONS[role]), alt: '' })

/** A role as a colored chip: its icon and its name in this language. */
export const roleChip = (role: Role) => h('span', { class: 'arena-role', style: `--role:${ROLE_COLORS[role]}` }, roleIcon(role), t().versus.roles[role])

const PICK_KEY = 'ps:arenaPick'

/** The Pokémon this device last took into the Arena; `fallback` (the lobby's partner, when it's a starter) the first time. */
export const arenaPick = (fallback: string): VersusPick => {
  try {
    const kept = localStorage.getItem(PICK_KEY)
    if (kept && isVersusPick(kept)) return kept
  } catch {
    // Storage blocked: the fallback.
  }
  return isVersusPick(fallback) ? fallback : 'charmander'
}

export const keepArenaPick = (id: VersusPick) => {
  try {
    localStorage.setItem(PICK_KEY, id)
  } catch {
    // Storage blocked: the pick lasts this page.
  }
}

const FORMAT_KEY = 'ps:arenaFormat'

/** The format this device last picked on the Arena screen (the standard 4v4 the first time). */
export const arenaFormat = (): ArenaFormat => {
  try {
    return parseArenaFormat(localStorage.getItem(FORMAT_KEY))
  } catch {
    return 'standard'
  }
}

const keepArenaFormat = (format: ArenaFormat) => {
  try {
    localStorage.setItem(FORMAT_KEY, format)
  } catch {
    // Storage blocked: the format lasts this page.
  }
}

/** A starter's first form: its portrait's dex and its name. */
export const firstForm = (id: VersusPick) => STARTERS[id].line[0]!

/** The Energy orb the world drops, as a DOM icon. */
export const energyIcon = () => arenaIconUrl('energy')

/* ---------------- The roles' numbers ---------------- */

type Stat = keyof ReturnType<typeof t>['versus']['lobby']['stats']

/** What each bar reads from a role (`ROLES`): toughness is the damage it doesn't take. */
const STAT_OF = {
  damage: (r) => r.dealt,
  toughness: (r) => 1 / r.taken,
  speed: (r) => r.pace,
  healing: (r) => r.aura,
} as const satisfies Record<Stat, (r: (typeof ROLES)[Role]) => number>

const STATS = Object.keys(STAT_OF) as Stat[]
const PIPS = 5

/**
 * A role's stat as 0..`PIPS` pips, relative to the other roles: the lowest
 * role gets 1 and the highest `PIPS`; healing starts from none (0 pips).
 */
export const statPips = (role: Role, stat: Stat) => {
  const of = STAT_OF[stat]
  const all = Object.values(ROLES).map(of)
  const max = Math.max(...all)
  const min = stat === 'healing' ? 0 : Math.min(...all)
  if (max === min) return Math.ceil(PIPS / 2)
  const k = (of(ROLES[role]) - min) / (max - min)
  return stat === 'healing' ? Math.round(k * PIPS) : 1 + Math.round(k * (PIPS - 1))
}

/* ---------------- The screen ---------------- */

export type ArenaActions = {
  /** Treino: a match of the picked format against bots on the in-page relay. */
  bots?: (id: VersusPick, format: ArenaFormat) => void
  /** Casual and Ranqueada: the public queue (null: no relay in this build). Ranqueada only in a ranked format (`ARENA_FORMATS`). */
  queue?: ((id: VersusPick, kind: QueueKind, format: ArenaFormat) => void) | null
  /** Com amigos: an Arena room of the picked format (null: no relay in this build). */
  friends?: ((id: VersusPick, format: ArenaFormat) => void) | null
  /** The queue and Com amigos need an account with a @handle this player doesn't have yet: the cards say so (a tap leads to sign in). */
  needsAccount?: boolean
  /** The Arena's hub: profile, season, ranking, history and rules. */
  hub?: () => void
  /** From a room: the pick goes back to it. */
  choose?: (id: VersusPick) => void
  back: () => void
}

/** The Como jogar strip: four steps, each with its picture. */
const howToPlay = () => {
  const m = t().versus.lobby
  const icons = [portraitUrl(ENEMIES.bunnelby.dex), energyIcon(), arenaIcon(), portraitUrl(ENEMIES.zapdos.dex)]
  return h(
    'section',
    { class: 'arena-how', 'aria-label': m.how },
    h('span', { class: 'field-label' }, m.how),
    h(
      'ol',
      { class: 'arena-steps' },
      ...m.steps.map((step, i) =>
        h(
          'li',
          { class: `arena-step step${i + 1}` },
          h('span', { class: 'arena-step-n' }, String(i + 1)),
          h('img', { src: icons[i]!, alt: '' }),
          h('span', { class: 'arena-step-text' }, h('b', {}, step.title), h('small', {}, step.text)),
        ),
      ),
    ),
  )
}

/**
 * The Arena screen. `pick` is the Pokémon selected first. The arrows walk
 * the roster and, past its last row, the format and the buttons below; Enter
 * plays the Treino from the roster (or chooses, from a room) and presses a
 * button; Esc goes back.
 */
export const arenaScreen = (root: HTMLElement, input: Input, pick: VersusPick, actions: ArenaActions): Screen => {
  const m = t().versus
  const l = m.lobby
  let selected = Math.max(0, VERSUS_PICKS.indexOf(pick))
  const chosen = () => VERSUS_PICKS[selected]!
  let filter: Role | null = null

  // The hero: the one picked, what its role does and its numbers.
  const face = h('img', { class: 'arena-hero-face', alt: '' })
  const name = h('b', { class: 'arena-hero-name' })
  const role = h('span', { class: 'arena-hero-role' })
  const info = h('p', { class: 'arena-hero-info' })
  const bars = STATS.map((stat) => {
    const pips = Array.from({ length: PIPS }, () => h('i', {}))
    return { stat, pips, el: h('div', { class: 'arena-stat' }, h('span', {}, l.stats[stat]), h('span', { class: 'arena-pips' }, ...pips)) }
  })
  const line = h('div', { class: 'arena-line', title: l.line })
  const hero = h(
    'div',
    { class: 'arena-hero' },
    h('div', { class: 'arena-hero-top' }, face, h('div', { class: 'arena-hero-id' }, name, role)),
    info,
    h('div', { class: 'arena-stats' }, ...bars.map((b) => b.el)),
    line,
  )

  const tiles = VERSUS_PICKS.map((id, i) => {
    const form = firstForm(id)
    const tile = h(
      'button',
      { class: 'arena-tile', type: 'button', 'aria-label': form.name, style: `--role:${ROLE_COLORS[VERSUS_ROSTER[id]]}` },
      h('img', { src: portraitUrl(form.dex), alt: '' }),
      h('span', { class: 'arena-tile-name' }, form.name),
    )
    tile.addEventListener('click', () => {
      if (selected === i) return
      playSfx('move')
      select(i)
    })
    // A second tap on the picked one plays (or chooses), as Enter would.
    tile.addEventListener('dblclick', () => primary())
    return tile
  })

  /** The tiles the filter shows, by roster index. */
  const shown = () => VERSUS_PICKS.flatMap((id, i) => (filter === null || VERSUS_ROSTER[id] === filter ? [i] : []))

  /** Where the arrows are: the roster, or one of the buttons below it (its index). */
  let focus: 'grid' | number = 'grid'

  const select = (i: number, scroll = true) => {
    selected = i
    focus = 'grid'
    paint()
    const id = chosen()
    const r = VERSUS_ROSTER[id]
    face.src = portraitUrl(firstForm(id).dex)
    name.textContent = firstForm(id).name
    role.replaceChildren(roleChip(r))
    info.textContent = l.roleInfo[r]
    hero.style.setProperty('--role', ROLE_COLORS[r])
    for (const b of bars) {
      const n = statPips(r, b.stat)
      b.pips.forEach((pip, k) => pip.classList.toggle('on', k < n))
    }
    line.replaceChildren(
      h('small', {}, l.line),
      ...STARTERS[id].line.flatMap((form, k) => [...(k > 0 ? [h('span', { class: 'arena-line-arrow' }, '›')] : []), h('img', { src: portraitUrl(form.dex), alt: form.name, title: form.name })]),
    )
    // The face pops on every change.
    face.classList.remove('pop')
    void face.offsetWidth
    face.classList.add('pop')
    if (scroll) tiles[i]!.scrollIntoView({ block: 'nearest' })
  }

  let format = arenaFormat()
  let busy = false
  const go = (run: ((id: VersusPick, format: ArenaFormat) => void) | undefined | null) => () => {
    if (!run || busy) return
    busy = true
    playSfx('select')
    keepArenaPick(chosen())
    keepArenaFormat(format)
    later(() => run(chosen(), format))
  }
  const choose = actions.choose
  const primary = go(choose ?? actions.bots)
  const back = () => (playSfx('select'), later(actions.back))

  /** A way to play as a card: its picture, name and what it is. */
  const modeCard = (cls: string, icon: string, title: string, text: string, note: string | null, run: (() => void) | null) =>
    h(
      'button',
      { class: `arena-mode ${cls}`, type: 'button', disabled: run === null, onclick: () => run?.() },
      h('img', { src: icon, alt: '' }),
      h('span', { class: 'arena-mode-text' }, h('b', {}, title), h('small', {}, text), note ? h('em', {}, note) : null),
    )

  /** What an account-only card says under its line: unavailable in this build, or the account it needs. */
  const lockNote = (open: boolean) => (!open ? l.offline : actions.needsAccount ? l.room.account : null)
  const queue = actions.queue
  const queueCard = (kind: QueueKind) =>
    modeCard(kind, arenaIconUrl(kind === 'ranked' ? 'queueRanked' : 'queueCasual'), l[kind].title, l[kind].text, lockNote(Boolean(queue)), queue ? go((id, f) => queue(id, kind, f)) : null)
  const ranked = choose ? null : queueCard('ranked')
  const buttons: HTMLButtonElement[] = choose
    ? [h('button', { class: 'btn confirm', type: 'button', onclick: primary }, m.room.pick)]
    : [
        modeCard('quick', arenaIcon(), l.quick.title, l.quick.text, null, primary),
        queueCard('casual'),
        ranked!,
        modeCard('friends', coopIcon(), l.room.title, l.room.text, lockNote(Boolean(actions.friends)), actions.friends ? go(actions.friends) : null),
      ]

  /**
   * The format the ways below play: 4v4 Padrão or 3v3 Rápida, each with its
   * clock and map. Ranqueada is only in a ranked format: off in the other,
   * saying so where its note goes.
   */
  const formatButtons = choose
    ? []
    : ARENA_FORMAT_IDS.map((id) => {
        const f = m.formats[id]
        return h(
          'button',
          { class: `arena-format ${id}`, type: 'button', 'aria-pressed': 'false', onclick: () => setFormat(id) },
          h('b', { class: 'arena-format-size' }, f.size),
          h('span', { class: 'arena-format-text' }, h('b', {}, f.name), h('small', {}, `${f.clock} · ${f.text}`)),
        )
      })
  const rankedNote = ranked?.querySelector('em') ?? null
  const rankedText = rankedNote?.textContent ?? null
  const paintFormat = () => {
    formatButtons.forEach((b, k) => {
      const on = ARENA_FORMAT_IDS[k] === format
      b.classList.toggle('on', on)
      b.setAttribute('aria-pressed', String(on))
    })
    if (!ranked) return
    const open = ARENA_FORMATS[format].ranked && Boolean(queue)
    ranked.disabled = !open
    const note = !ARENA_FORMATS[format].ranked ? l.rankedOnly : rankedText
    let em = ranked.querySelector('em')
    if (note && !em) ranked.querySelector('.arena-mode-text')?.append((em = h('em', {}, note)))
    if (em) em.textContent = note ?? ''
    em?.classList.toggle('hidden', !note)
  }
  const setFormat = (id: ArenaFormat) => {
    if (id === format) return
    playSfx('move')
    format = id
    keepArenaFormat(id)
    paintFormat()
  }
  const formatRow = choose
    ? null
    : h('div', { class: 'arena-formats', role: 'radiogroup', 'aria-label': l.format }, h('span', { class: 'field-label' }, l.format), h('div', { class: 'arena-format-options' }, ...formatButtons))
  const hub = actions.hub
  const hubButton = hub && !choose ? h('button', { class: 'btn small arena-hub-open', type: 'button', onclick: () => (playSfx('select'), later(hub)) }, h('img', { src: tierBallUrl('ultra'), alt: '' }), l.hub) : null
  const backButton = h('button', { class: 'btn small arena-back', type: 'button', onclick: back }, m.back)
  const below = [...formatButtons, ...buttons, ...(hubButton ? [hubButton] : []), backButton]

  const paint = () => {
    const visible = new Set(shown())
    tiles.forEach((tile, k) => {
      tile.classList.toggle('selected', k === selected)
      tile.classList.toggle('hidden', !visible.has(k))
    })
    below.forEach((b, k) => b.classList.toggle('selected', focus === k))
  }

  const chips = h(
    'div',
    { class: 'arena-filters', role: 'radiogroup' },
    ...[null, ...ROLE_IDS].map((r) => {
      const chip = h(
        'button',
        { class: `arena-filter${r === filter ? ' on' : ''}`, type: 'button', style: r ? `--role:${ROLE_COLORS[r]}` : '', 'aria-pressed': String(r === filter) },
        ...(r ? [roleIcon(r), m.roles[r]] : [l.all]),
      )
      chip.addEventListener('click', () => {
        playSfx('move')
        filter = r
        for (const c of chips.children) c.classList.toggle('on', c === chip)
        const visible = shown()
        // The selection stays when the filter shows it; otherwise the filter's first.
        if (!visible.includes(selected)) select(visible[0]!)
        else paint()
      })
      return chip
    }),
  )

  const grid = h('div', { class: 'arena-grid' }, ...tiles)
  const el = h(
    'div',
    { class: `screen dim arena-screen${choose ? ' choosing' : ''}` },
    h(
      'div',
      { class: 'dialog box pop arena' },
      h(
        'div',
        { class: 'dialog-title arena-title' },
        h('img', { src: arenaIcon(), alt: '' }),
        h('span', {}, m.title),
        h('em', { class: 'arena-tagline' }, m.tagline),
        choose ? null : h('small', { class: 'arena-sub' }, m.intro),
      ),
      h(
        'div',
        { class: 'arena-main' },
        hero,
        h('div', { class: 'arena-roster' }, h('div', { class: 'arena-pick-head' }, h('span', { class: 'field-label' }, m.pick), h('small', {}, m.free)), chips, grid),
      ),
      choose ? null : howToPlay(),
      formatRow,
      h('div', { class: `arena-modes${choose ? ' choose' : ''}` }, ...buttons),
      h('div', { class: 'arena-foot' }, h('div', { class: 'arena-foot-buttons' }, backButton, hubButton), hint(m.hintKeys, m.hintTouch)),
    ),
  )

  /** How many tiles fit a row now (the grid wraps with the screen). */
  const cols = () => {
    const visible = shown().map((i) => tiles[i]!)
    const top = visible[0]?.offsetTop ?? 0
    const n = visible.findIndex((tile) => tile.offsetTop !== top)
    return n > 0 ? n : visible.length
  }
  const off = input.onKey((key) => {
    const step = key === 'ArrowLeft' ? 'left' : key === 'ArrowRight' ? 'right' : key === 'ArrowUp' ? 'up' : key === 'ArrowDown' ? 'down' : null
    if (step && focus !== 'grid') {
      // The buttons below: left and right along them, up back to the roster.
      const at = focus
      const next = step === 'up' ? 'grid' : step === 'left' ? Math.max(0, at - 1) : step === 'right' ? Math.min(below.length - 1, at + 1) : at
      if (next === at) return
      playSfx('move')
      focus = next
      paint()
      return
    }
    if (step) {
      const visible = shown()
      const at = visible.indexOf(selected)
      const next = stepGrid(at, step, cols(), visible.length)
      if (next === 'below') {
        playSfx('move')
        focus = 0
        paint()
        below[0]!.scrollIntoView({ block: 'nearest' })
        return
      }
      if (typeof next === 'number' && visible[next] !== selected) {
        playSfx('move')
        select(visible[next]!)
      }
      return
    }
    if (key === 'Enter') {
      if (focus === 'grid') primary()
      else below[focus]?.click()
    } else if (key === 'Escape' || key === 'Backspace') back()
  })
  root.append(el)
  // The maps' pictures start loading here, so a match opens with them.
  loadValeArt()
  paintFormat()
  select(selected, false)
  later(() => tiles[selected]?.scrollIntoView({ block: 'nearest' }))
  return { el, dim: 0.5, dispose: () => (off(), el.remove()) }
}
