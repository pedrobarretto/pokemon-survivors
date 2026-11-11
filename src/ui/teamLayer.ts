import type { Connection } from '../coop/client'
import type { CoopDriver } from '../coop/driver'
import type { Input } from '../engine/input'
import { awayHold } from '../game/coop'
import { onScreen, type PickScreen } from '../game/lockstep'
import { phaseOf } from '../game/players'
import type { Game, Offer, Phase, Player } from '../game/types'
import { createTeamCamera, cycleWatched, spectating, updateTeamCamera, watched } from '../render/teamCamera'
import { createCoopHud } from './coopHud'
import type { Screen } from './screens'
import { createTeamHud, seatName } from './teamHud'
import { awayWait, pickClock, spectatorBanner, teamEnd, teamWait, type EndActions } from './teamScreens'

/**
 * The co-op layer over a run, everything the shell shows that solo doesn't:
 * the team's cards, the connection pip and the reconnecting veil, the wait
 * while teammates pick or an away one holds the world, the clock on this player's pick screens, the
 * spectator camera and its banner while fainted, and the end (vote and
 * results). It reads the draw copy of the game (`coop/view.ts`) and acts
 * through PR 5's driver (`coop/driver.ts`). The shell makes one per co-op run
 * and calls `frame` every frame before drawing, `decorate` on each pick
 * overlay it opens, `end` for the `victory`/`gameover` overlay, and
 * `pick`/`levelUp` to act on its screens.
 */
export const createTeamLayer = (root: HTMLElement, input: Input, driver: CoopDriver, end: Omit<EndActions, 'vote'>) => {
  const camera = createTeamCamera()
  const hud = createTeamHud(root)
  const net = createCoopHud(root)
  let me: Player | null = null
  let game: Game | null = null
  const cycle = () => game && me && cycleWatched(camera, game, me)
  const banner = spectatorBanner(root, cycle)
  let wait: ReturnType<typeof teamWait> | null = null
  let away: ReturnType<typeof awayWait> | null = null
  let clock: { el: HTMLElement; update: () => void } | null = null
  let ending: Screen | null = null
  /** The round of the screen a pick was sent on: the screen stays closed until the run moves it on. */
  let sent: number | null = null
  // Tab, Q or the special (useless while fainted) switch whom the camera watches.
  const offKey = input.onKey((key) => {
    if (game && me && spectating(game, me) && (key === 'Tab' || key === 'KeyQ' || key === 'Space')) cycle()
  })

  /** Whether this player's pick is on its way: their screen shows as closed meanwhile. */
  const holding = (self: Player) => {
    if (sent !== null && (sent !== self.round || !onScreen(self))) sent = null
    return sent !== null
  }

  /**
   * Every frame, on the draw copy `g` (this player is `self`): the cards, the
   * connection, the banners, and the camera for this client's `view` (world
   * px), written into `g.camera` (the copy's own, never the simulation's).
   */
  const frame = (g: Game, self: Player, dt: number, view: { w: number; h: number }, conn: Connection, joining: boolean) => {
    game = g
    me = self
    hud.update(g, self)
    net.update(conn, joining)
    // Fainted with someone to watch: the banner names them (not over the end screen: an away teammate may still stand at a wipe).
    const over = g.phase === 'gameover' || g.phase === 'victory'
    banner.show(!over && spectating(g, self) ? seatName(g, watched(camera, g, self).slot) : null)
    // Held by teammates' level-ups after this player picked (or while their pick travels): who's still choosing.
    const waiting = g.phase === 'levelup' && !self.gone && (phaseOf(g, self) === 'playing' || holding(self))
    if (waiting && !wait) wait = teamWait(hud.el, g, self)
    if (!waiting && wait) {
      wait.dispose()
      wait = null
    }
    wait?.update()
    // Held for an away teammate: who, and how long until the run goes on without them.
    const held = g.phase === 'playing' && !self.gone && awayHold(g) !== null
    if (held && !away) away = awayWait(hud.el, g)
    if (!held && away) {
      away.dispose()
      away = null
    }
    away?.update()
    if (clock && !clock.el.isConnected) clock = null
    clock?.update()
    ending?.tick?.(0)
    updateTeamCamera(camera, g, self, view.w, view.h, dt)
    g.camera.x = camera.x
    g.camera.y = camera.y
  }

  /** Puts the auto-pick clock on a pick overlay the shell just opened (and, on the team's level-up, who already picked). */
  const decorate = (overlay: Screen, g: Game, self: Player, phase: Phase) => {
    if (phase === 'paused' || phase === 'victory' || phase === 'gameover' || phase === 'evolving' || phase === 'playing') return
    const made = pickClock(g, self, phase === 'levelup')
    // In the screen's box under its title; screens without one (the Ability, a branch) get it as a box of its own on top.
    const host = overlay.el.querySelector('.dialog, .tm-stage')
    const title = host?.querySelector(':scope > .dialog-title')
    if (title) title.after(made.el)
    else if (host) host.prepend(made.el)
    else {
      made.el.classList.add('box', 'floating')
      overlay.el.prepend(made.el)
    }
    clock = made
  }

  /** The overlay for the run's end (victory or game over), ticked by `frame`. */
  const showEnd = (g: Game, self: Player): Screen => {
    const screen = teamEnd(root, input, g, self, { ...end, vote: (endless) => driver.send({ kind: 'endless', vote: endless }) })
    ending = screen
    return { ...screen, dispose: () => ((ending = ending === screen ? null : ending), screen.dispose()) }
  }

  /** A card picked on this player's screen, sent with that screen's round (read now); the screen closes until the round moves. */
  const pick = (self: Player, offer: Offer) => {
    const index = self.offers.indexOf(offer)
    if (index < 0 || !onScreen(self)) return
    driver.send({ kind: 'pick', screen: self.phase as PickScreen, round: self.round, index })
    sent = self.round
  }

  /** The level-up screen's buttons (reroll, skip, Esquecer) as entries; each closes the screen until its new round. */
  const levelUp = (self: Player) => ({
    reroll: () => (driver.send({ kind: 'reroll', round: self.round }), (sent = self.round)),
    skip: () => (driver.send({ kind: 'skip', round: self.round }), (sent = self.round)),
    banish: (index: number) => (driver.send({ kind: 'banish', round: self.round, index }), (sent = self.round)),
  })

  /** Largar item: the held item at `index` goes, from the menu or before a swap card's pick (it doesn't close a screen). */
  const drop = (index: number) => driver.send({ kind: 'drop', index })

  const dispose = () => {
    offKey()
    hud.dispose()
    net.dispose()
    banner.dispose()
    wait?.dispose()
    away?.dispose()
  }

  return { camera, frame, holding, decorate, end: showEnd, pick, levelUp, drop, dispose }
}

export type TeamLayer = ReturnType<typeof createTeamLayer>
