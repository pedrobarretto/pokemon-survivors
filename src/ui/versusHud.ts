import { playCry, playSfx } from '../engine/audio'
import { formatTime } from '../engine/math'
import { ENEMIES } from '../data/enemies'
import { VERSUS, type Team } from '../data/versus'
import { goalOpen } from '../game/versusRules'
import type { VersusState } from '../game/versus'
import { channelShare } from '../render/vale'
import { createCoach } from './versusCoach'
import { formAt } from '../game/branch'
import { localPlayer } from '../game/players'
import type { Game, GameEvent, Player } from '../game/types'
import { timeLeft } from '../game/versus'
import { t } from '../i18n'
import { cryUrl, portraitUrl } from '../render/sprites'
import { energyIcon, teamColor } from './arena'
import { h, rich, setStyle, setText } from './dom'
import { banner, runToast } from './toasts'

/**
 * A Versus match's own HUD, over the run's (`ui/hud.ts`, whose clock and
 * counters it hides): the score bar with the match clock and the stretch's
 * x2 and each team's goals, the coach's line (`versusCoach.ts`), the Energy
 * carried and a channel's progress, the knockout overlay with its countdown,
 * Zapdos's blessing and Drednaw's shield, and the opening "3, 2, 1, Já!".
 * Plus the match's toasts (`versusFeedback`). Reads the draw copy every frame; touches only what changed.
 */

/** The name a seat goes by in a match: a human's, or a bot's Pokémon with "CPU" (a human who left keeps theirs). */
export const versusName = (g: Game, slot: number) => {
  const p = g.players[slot]
  if (!p) return '?'
  const name = g.coop?.names[slot]?.trim()
  if (name) return name
  return `${formAt(p.starter, p.branch, p.stage).name} ${t().versus.cpu}`
}

/** A seat's name for this screen: "Você" for the local player. */
const shownName = (g: Game, me: Player, slot: number) => (slot === me.slot ? t().versus.you : versusName(g, slot))

/** Who knocked the local player out last (the knockout overlay says it); empty for the wild. */
let koBy = ''

/** The opening countdown's first number, and how long "Já!" stays once the clock moves (s). */
const COUNTDOWN = 3
const GO = 0.8

type GoalPos = 'top' | 'base' | 'bottom'

/**
 * A team's goals as the score bar (and the end screen) list them: north
 * lane, base, south lane, each with its index into `VersusState.goals`. A
 * map without a base goal (the Clareira) has just its two lanes'.
 */
export const goalOrder = (s: VersusState, team: Team): { i: number; pos: GoalPos }[] => {
  const mine = s.goals.flatMap((goal, i) => (goal.team === team ? [i] : []))
  const lane = (north: boolean) => mine.find((i) => !s.goals[i]!.base && s.goals[i]!.y < 0 === north)
  const base = mine.find((i) => s.goals[i]!.base)
  return ([['top', lane(true)], ['base', base], ['bottom', lane(false)]] as const).flatMap(([pos, i]) => (i === undefined ? [] : [{ i, pos }]))
}

/**
 * `local`: a match against bots on the in-page relay (no connection to show).
 * `goAt`: when the match's tick 0 goes out (performance.now() s), for the
 * opening countdown; null when this screen joined a match already going.
 */
export const createVersusHud = (root: HTMLElement, local: boolean, goAt: number | null) => {
  const m = t().versus
  const blue = h('b', { class: 'vs-points' })
  const red = h('b', { class: 'vs-points' })
  const clock = h('span', { class: 'vs-clock' })
  const double = h('em', { class: 'vs-double hidden' }, m.hud.double)
  /** Each team's goals under its score, one pip per goal of the map (`goalOrder`, made at the first update): open with their points left, locked, or broken. */
  const pips: [HTMLElement[], HTMLElement[]] = [[], []]
  const rows = ([0, 1] as const).map((team) => h('span', { class: `vs-goals ${team === 0 ? 'blue' : 'red'}`, style: `--team:${teamColor(team)}` }))
  const goalRow = (team: Team) => rows[team]!
  const bar = h(
    'div',
    { class: 'vs-score' },
    h('span', { class: 'vs-side blue', style: `--team:${teamColor(0)}` }, h('small', {}, m.hud.blue), blue),
    h('span', { class: 'vs-mid' }, clock, double),
    h('span', { class: 'vs-side red', style: `--team:${teamColor(1)}` }, red, h('small', {}, m.hud.red)),
    goalRow(0),
    h('span', { class: 'vs-goals-mid' }),
    goalRow(1),
  )
  const coach = createCoach()
  const blessing = h('div', { class: 'vs-pill vs-blessing hidden' })
  const shield = h('div', { class: 'vs-pill vs-shield hidden' }, m.hud.shield)
  const energyText = h('b', { class: 'vs-energy-text' })
  const energyFill = h('i', { class: 'vs-energy-fill' })
  const energy = h(
    'div',
    { class: 'vs-energy box', title: m.hud.energy },
    h('img', { class: 'vs-orb', src: energyIcon(), alt: '' }),
    energyText,
    h('span', { class: 'vs-energy-bar' }, energyFill),
    h('em', { class: 'vs-energy-cue' }, m.hud.full),
  )
  /** Scoring: the channel's progress in the team's color, or "interrupted" while a rival's hit holds it. */
  const channelText = h('b', { class: 'vs-channel-text' })
  const channelFill = h('i', { class: 'vs-channel-fill' })
  const channel = h('div', { class: 'vs-channel hidden' }, channelText, h('span', { class: 'vs-channel-bar' }, channelFill))
  /** Knocked out: the field dims, the countdown in the middle (the menu stays reachable). */
  const downBy = h('span', { class: 'vs-down-by' })
  const downBack = h('b', { class: 'vs-down-back' })
  const downNote = h('small', { class: 'vs-down-note hidden' }, m.hud.downNote)
  const respawn = h('div', { class: 'vs-down hidden' }, h('div', { class: 'vs-down-card' }, h('span', { class: 'vs-down-title' }, m.hud.down), downBy, downBack, downNote))
  const count = h('div', { class: 'vs-count hidden' })
  const el = h('div', { class: 'versus-hud' }, respawn, bar, coach.el, h('div', { class: 'vs-pills' }, blessing, shield), channel, energy, count)
  root.append(el)
  // The page knows a match is up (`style.css`): the co-op pip moves under the score, or goes against bots.
  document.documentElement.dataset.versus = local ? 'local' : 'room'
  // The run's HUD keeps its bars and buttons; its clock and counters make room for the score.
  const hud = () => root.querySelector<HTMLElement>('.hud')

  let shown = ''
  let goalsShown = ''
  /** The Energy carried while on the field, to say what a knockout dropped. */
  let carried = 0
  let wasDown = false
  const update = (g: Game, me: Player) => {
    const s = g.versus
    const v = me.versus
    if (!s || !v) return
    const run = hud()
    run?.classList.add('versus')
    const left = Math.ceil(timeLeft(g))
    const key = `${s.score[0]}|${s.score[1]}|${left}|${s.stretch}|${v.team}`
    if (key !== shown) {
      shown = key
      setText(blue, String(s.score[0]))
      setText(red, String(s.score[1]))
      setText(clock, formatTime(left))
      double.classList.toggle('hidden', !s.stretch)
      el.classList.toggle('stretch', s.stretch)
      el.classList.toggle('red-side', v.team === 1)
      bar.classList.toggle('last', left <= 10)
    }
    const goalsKey = s.goals.map((goal) => `${Math.round(goal.left)}${goal.broken ? 'x' : goalOpen(s, goal) ? 'o' : 'l'}`).join()
    if (goalsKey !== goalsShown) {
      goalsShown = goalsKey
      for (const team of [0, 1] as const) {
        const order = goalOrder(s, team)
        if (pips[team].length !== order.length) {
          pips[team] = order.map(({ pos }) => h('i', { class: `vs-goal ${pos}`, title: m.hud.goals[pos] }))
          rows[team]!.replaceChildren(...pips[team])
        }
        order.forEach(({ i, pos }, k) => {
          const goal = s.goals[i]!
          const pip = pips[team][k]
          if (!pip) return
          const state = goal.broken ? 'broken' : goalOpen(s, goal) ? 'open' : 'locked'
          pip.className = `vs-goal ${pos} ${state}`
          setText(pip, goal.broken ? '' : String(Math.max(0, Math.round(goal.left))))
        })
      }
    }
    coach.update(g, me)
    const full = v.energy >= VERSUS.energy.cap
    setText(energyText, `${v.energy}/${VERSUS.energy.cap}`)
    setStyle(energyFill, 'width', `${Math.round((v.energy / VERSUS.energy.cap) * 100)}%`)
    energy.classList.toggle('full', full)
    energy.classList.toggle('some', v.energy > 0)
    energy.classList.toggle('hidden', g.phase === 'gameover')
    const k = channelShare(s, g, me)
    const blocked = k !== null && g.now - v.hurtAt < VERSUS.score.hurtLock
    channel.classList.toggle('hidden', k === null || g.phase !== 'playing')
    if (k !== null) {
      channel.classList.toggle('blocked', blocked)
      setText(channelText, blocked ? m.hud.blocked : m.hud.scoring)
      setStyle(channelFill, 'width', `${Math.round(k * 100)}%`)
    }
    const bless = s.blessing[v.team]
    blessing.classList.toggle('hidden', bless <= 0)
    if (bless > 0) setText(blessing, m.hud.blessing(Math.ceil(bless)))
    shield.classList.toggle('hidden', v.shield <= 0 || me.hp <= 0)
    const down = me.hp <= 0 && v.respawn > 0 && g.phase !== 'gameover'
    if (down && !wasDown) {
      setText(downBy, koBy ? m.hud.downBy(koBy) : '')
      downNote.classList.toggle('hidden', carried < 2)
      respawn.classList.remove('in')
      void respawn.offsetWidth
      respawn.classList.add('in')
    }
    if (!down) carried = v.energy
    wasDown = down
    respawn.classList.toggle('hidden', !down)
    if (down) setText(downBack, m.hud.respawn(Math.ceil(v.respawn)))
    // The relay starts tick 0 a few seconds after the start (the splash takes part of it): the seconds left to it, "Já!" as the clock moves.
    const opening = g.phase === 'playing' && (g.time === 0 || g.time < GO)
    count.classList.toggle('hidden', !opening)
    if (opening) {
      const left = goAt === null ? 1 : goAt - performance.now() / 1000
      const n = g.time > 0 ? 0 : Math.max(1, Math.min(COUNTDOWN, Math.ceil(left)))
      const text = n > 0 ? String(n) : m.hud.go
      if (count.textContent !== text) {
        count.textContent = text
        count.classList.remove('beat')
        void count.offsetWidth
        count.classList.add('beat')
        playSfx(n > 0 ? 'select' : 'levelUp', 0)
      }
    }
  }

  const dispose = () => {
    delete document.documentElement.dataset.versus
    hud()?.classList.remove('versus')
    koBy = ''
    el.remove()
  }
  return { el, update, dispose }
}

export type VersusHud = ReturnType<typeof createVersusHud>

/** A face for a toast: the seat's Pokémon now. */
const face = (p: Player | undefined) => p && h('img', { class: 'vs-toast-face', src: portraitUrl(formAt(p.starter, p.branch, p.stage).dex), alt: '' })

/** A toast's text in a team's color. */
const teamToast = (team: Team, ...children: (HTMLElement | false | undefined | null)[]) => h('span', { class: 'item-toast vs-toast', style: `--team:${teamColor(team)}` }, ...children)

/**
 * The match's moments as sounds and toasts, from this player's side: a score
 * (big, in the scorer's team color), a goal breaking, knockouts this player's
 * team took part in, the objectives arriving and falling, the stretch and the end.
 */
export const versusFeedback = (root: HTMLElement, g: Game, e: GameEvent) => {
  const me = localPlayer(g)
  const mine = me.versus?.team ?? 0
  const m = t().versus.toast
  switch (e.kind) {
    case 'versusScore': {
      const ours = e.team === mine
      playSfx(ours ? 'coin' : 'denied', 0)
      if (ours) playSfx('unlock', 0)
      const who = shownName(g, me, e.slot)
      const line = ours ? m.weScored(who) : m.theyScored(who)
      return runToast(root, 'important', teamToast(e.team, face(g.players[e.slot]), h('b', { class: 'vs-toast-points' }, `+${e.points}`), rich(line)), 3000)
    }
    case 'versusGoal': {
      const ours = e.team === mine
      playSfx('break', 0)
      return runToast(root, 'important', teamToast(e.team, h('span', {}, ours ? m.ourGoalBroke : m.theirGoalBroke)), 3200, 'versusGoal')
    }
    case 'versusKo': {
      const victim = g.players[e.slot]
      if (!victim) return
      if (e.slot === me.slot) {
        koBy = e.by >= 0 ? versusName(g, e.by) : ''
        playSfx('hurt', 0)
        return runToast(root, 'important', teamToast(victim.versus?.team ?? 0, face(e.by >= 0 ? g.players[e.by] : undefined), rich(e.by >= 0 ? m.koYou(versusName(g, e.by)) : m.wildKoYou)), 2800, 'versusKoMe')
      }
      if (e.by === me.slot) {
        playSfx('kill', 0)
        playSfx('shiny', 0)
        return runToast(root, 'important', teamToast(mine, face(victim), rich(m.youKo(versusName(g, e.slot)))), 2600)
      }
      if (e.by < 0) return
      const killer = g.players[e.by]
      return runToast(root, 'minor', teamToast(killer?.versus?.team ?? 0, face(killer), rich(m.allyKo(versusName(g, e.by), versusName(g, e.slot)))), 2400)
    }
    case 'versusBack':
      if (e.slot !== me.slot) return
      playSfx('heal', 0)
      return runToast(root, 'minor', m.back, 1600, 'versusBack')
    case 'versusStretch':
      playSfx('thunder', 0)
      return banner(root, h('span', { class: 'vs-banner' }, h('b', {}, t().versus.hud.double), m.stretch), 3200)
    case 'versusObjective': {
      const def = ENEMIES[e.enemy]
      if (e.team === -1) {
        playSfx('boss', 0)
        playCry(cryUrl(def.dex), 0.6)
        return runToast(root, 'important', h('span', { class: 'item-toast' }, h('img', { src: portraitUrl(def.dex), alt: '' }), rich(e.enemy === 'zapdos' ? m.zapdos : m.drednaw)), 3600, 'versusObjective')
      }
      const ours = e.team === mine
      playSfx(ours ? 'evolve' : 'denied', 0)
      return runToast(root, 'important', teamToast(e.team, h('img', { class: 'vs-toast-face', src: portraitUrl(def.dex), alt: '' }), rich(ours ? m.fellUs(def.name) : m.fellThem(def.name))), 3600, 'versusObjective')
    }
    case 'versusEnd': {
      const won = e.winner === mine
      playSfx(e.winner === null ? 'item' : won ? 'evolve' : 'gameOver', 0)
      return
    }
  }
}

/** The events `versusFeedback` speaks for. */
export const isVersusEvent = (e: GameEvent): e is Extract<GameEvent, { kind: `versus${string}` }> => e.kind.startsWith('versus')
