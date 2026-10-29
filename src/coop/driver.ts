import type { Vec } from '../engine/math'
import type { TickEntry } from '../game/lockstep'
import type { Cast } from '../game/versusKit'
import { TICK } from '../game/replay'
import type { Game } from '../game/types'
import type { CoopClient } from './client'

/**
 * What the shell (`main.ts`, and its team layer, `src/ui/teamLayer.ts`) drives a co-op run
 * with: `advance` once per display frame with the stick and the buttons
 * pressed; `send` for anything the player picks (a tick entry of their own,
 * without the slot: the session knows its seat); `playAgain` after a run
 * ("Jogar de novo": the host starts the next one, everyone else gets ready);
 * `lobby` back to the room. Thin: the client does the work.
 */

/** A tick entry of this player's, without the slot (the session adds it). */
export type SeatEntry = TickEntry extends infer E ? (E extends { slot: number } ? Omit<E, 'slot'> : never) : never

/** The controls of one display frame; `casts` are the Arena kit's, aimed on this client (`ui/arenaControls.ts`). */
export type DriverInput = { move: Vec; special?: boolean; mega?: boolean; lunge?: boolean; casts?: readonly Cast[] }

export type CoopDriver = {
  /** One display frame of `dt` seconds: samples the stick (60 a second), sends the presses, runs the lockstep. Returns the ticks simulated. */
  advance: (g: Game, dt: number, input: DriverInput) => number
  send: (entry: SeatEntry) => void
  playAgain: () => void
  lobby: () => void
  /** How far real time is into the next stick sample (0..1), for drawing between samples. */
  frac: () => number
}

export const coopDriver = (client: CoopClient, onLobby: () => void = () => {}): CoopDriver => {
  let acc = 0
  return {
    advance: (_g, dt, input) => {
      acc += dt
      while (acc >= TICK) {
        acc -= TICK
        client.stick(input.move)
      }
      // A press carries the latest stick sample: prediction knows when it went out, and when the run took it.
      if (input.special) client.input({ k: 'special', sample: client.state().sample })
      if (input.mega) client.input({ k: 'mega' })
      if (input.lunge) client.input({ k: 'lunge' })
      for (const c of input.casts ?? []) client.input({ k: 'cast', ...c, sample: client.state().sample })
      return client.frame(dt)
    },
    send: (e) => {
      switch (e.kind) {
        case 'move':
          // The stick goes through `advance`; a move sent here is a one-off nudge.
          return void client.input({ k: 'move', code: e.code, sample: client.state().sample })
        case 'special':
          return void client.input({ k: 'special', sample: client.state().sample })
        case 'mega':
        case 'lunge':
        case 'emote':
          return void client.input({ k: e.kind })
        case 'pick':
          return void client.input({ k: 'pick', screen: e.screen, round: e.round, index: e.index })
        case 'reroll':
        case 'skip':
          return void client.input({ k: e.kind, round: e.round })
        case 'banish':
          return void client.input({ k: 'banish', round: e.round, index: e.index })
        case 'stone':
          return void client.input({ k: 'stone', mega: e.mega })
        case 'endless':
        case 'surrender':
          return void client.input({ k: e.kind, vote: e.vote })
        case 'chat':
          return void client.input({ k: 'chat', msg: e.msg })
        case 'ping':
          return void client.input({ k: 'ping', ping: e.ping, x: e.x, y: e.y })
        case 'cast':
          return void client.input({ k: 'cast', skill: e.skill, dir: e.dir, reach: e.reach, target: e.target, sample: client.state().sample })
        case 'lock':
          return void client.input({ k: 'lock', target: e.target })
        case 'prio':
          return void client.input({ k: 'prio', prio: e.prio })
        case 'leave':
          return client.leave()
        case 'away':
        case 'back':
          // The relay stamps these from the socket's silence; the tab's visibility goes through `setHidden`.
          return
      }
    },
    playAgain: () => {
      const st = client.state()
      const me = st.room?.members.find((m) => m.seat === st.seat)
      if (me?.host) client.start()
      else client.setReady(true)
    },
    lobby: onLobby,
    frac: () => acc / TICK,
  }
}
