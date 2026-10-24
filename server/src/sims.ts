// `scripts/freeze-rules.mjs` bundles the frozen simulator with these imports in this order (src/game's import cycles resolve by load order): keep the two in step.
import type { EnemyId } from '../../src/data/enemies'
import { halloweenFits } from '../../src/game/halloween'
import { outbreakFits } from '../../src/game/outbreak'
import { isRecord } from '../../src/game/parse'
import { parseReplay, resimulate, RULES_VERSION, type Replay, type Resimulated } from '../../src/game/replay'

/**
 * A simulator the checks judge replays with: this build's, or the previous
 * rules' frozen one (`server/sims/rules-<N-1>.mjs`, `npm run rules:freeze`),
 * kept so a run that straddled a rules deploy is verified under the rules it
 * was played by (`rulesGrace.ts`).
 */
export type Sim = {
  RULES_VERSION: number
  parseReplay: (raw: unknown) => Replay | null
  resimulate: (replay: Replay) => Resimulated
  outbreakFits: (outbreak: EnemyId | null, startedAt: Date) => boolean
  halloweenFits: (haunted: boolean, startedAt: Date) => boolean
}

const CURRENT: Sim = { RULES_VERSION, parseReplay, resimulate, outbreakFits, halloweenFits }

/** The rules of the frozen simulator the API ships, always the ones before its own. */
export const FROZEN_RULES = RULES_VERSION - 1

/** Next to `dist/` in the image, next to `src/` in the repo. */
export const FROZEN_URL = new URL(`../sims/rules-${FROZEN_RULES}.mjs`, import.meta.url)

const SIM_FUNCTIONS = ['parseReplay', 'resimulate', 'outbreakFits', 'halloweenFits'] as const

/** Whether a loaded module is a simulator of `rules`. */
export const isSim = (mod: unknown, rules: number): mod is Sim =>
  isRecord(mod) && mod.RULES_VERSION === rules && SIM_FUNCTIONS.every((name) => typeof mod[name] === 'function')

let frozen: Promise<Sim> | null = null

/** The frozen simulator, imported on first use (only the checks' worker needs it, and only for a straddling run). A failed import is tried again next time. */
const frozenSim = () =>
  (frozen ??= import(FROZEN_URL.href).then(
    (mod: unknown) => {
      if (!isSim(mod, FROZEN_RULES)) throw new Error(`${FROZEN_URL.pathname} isn't a rules ${FROZEN_RULES} simulator: run \`npm run rules:freeze\``)
      return mod
    },
    (err: unknown) => {
      frozen = null
      throw err
    },
  ))

/** The simulator for a replay of `rules`, or null when the API keeps none (too old, or newer than this build). */
export const simFor = async (rules: number): Promise<Sim | null> => (rules === RULES_VERSION ? CURRENT : rules === FROZEN_RULES ? frozenSim() : null)

/**
 * What a check found: the run `played` again to where it ended; `unfit`, a
 * replay that played another day's outbreak (`outbreakFits`) or a haunted run
 * outside the Noite das Bruxas (`halloweenFits`); or `unjudged`, a replay no
 * simulator the API keeps can read.
 */
export type Judged = { kind: 'played'; result: Resimulated } | { kind: 'unfit'; why: 'outbreak' | 'halloween' } | { kind: 'unjudged' }

/** A replay to judge (`checks.ts` to its worker): its raw form, the rules it says, and when its run started (ms). */
export type Job = { id: string; replay: unknown; rules: number; startedAt: number }

/** Judges a replay with the simulator of its rules: the day it started must fit, then it's played again from its seed. */
export const judge = async ({ replay, rules, startedAt }: Job): Promise<{ judged: Judged; ms: number }> => {
  const sim = await simFor(rules)
  const t0 = performance.now()
  const parsed = sim?.parseReplay(replay) ?? null
  const at = new Date(startedAt)
  const judged: Judged =
    !sim || !parsed
      ? { kind: 'unjudged' }
      : !sim.outbreakFits(parsed.start.outbreak, at)
        ? { kind: 'unfit', why: 'outbreak' }
        : !sim.halloweenFits(parsed.start.halloween, at)
          ? { kind: 'unfit', why: 'halloween' }
          : { kind: 'played', result: sim.resimulate(parsed) }
  return { judged, ms: Math.round(performance.now() - t0) }
}
