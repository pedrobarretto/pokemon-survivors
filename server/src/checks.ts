import { Worker } from 'node:worker_threads'
import { BOARD_SIZE } from '../../src/game/ranking'
import { parseReplay, RULES_VERSION, rulesStanding } from '../../src/game/replay'
import { sameTime, type RankingStore } from './ranking'
import { FROZEN_RULES, judge, type Job, type Judged } from './sims'

type Answer = { judged: Judged; ms: number }

/** Judges one replay; null when the machinery failed (not the run). */
type Runner = (job: Job) => Promise<Answer | null>

/**
 * The bundled worker (`dist/verify.js`, next to `index.js`): a long run's
 * seconds of simulation never hold up the API's requests, and the frozen
 * simulator of the previous rules only ever loads there. A crash (a replay
 * that blows the heap) fails only that check; the next one gets a fresh worker.
 */
const workerRunner = (): Runner => {
  let worker: Worker | null = null
  let waiting: ((answer: Answer | null) => void) | null = null
  const settle = (answer: Answer | null) => {
    waiting?.(answer)
    waiting = null
  }
  const start = () => {
    const w = new Worker(new URL('./verify.js', import.meta.url))
    w.on('message', ({ judged, ms }: { judged: Judged | null; ms: number }) => settle(judged ? { judged, ms } : null))
    w.on('error', (err) => {
      console.error('check worker', err)
      worker = null
      settle(null)
    })
    w.unref()
    return w
  }
  return (job) =>
    new Promise((resolve) => {
      worker ??= start()
      waiting = resolve
      worker.postMessage(job)
    })
}

/** `npm run dev` runs the source under tsx, where a worker can't load it: judge in place (it blocks, fine in dev). */
const inlineRunner = (): Runner => (job) =>
  judge(job).catch((err: unknown) => {
    console.error('check', job.id, err)
    return null
  })

/**
 * Which runs get re-simulated. Runs are trusted: one counts on the boards as
 * soon as it's reported, and only a failed check takes it off. So only the
 * runs on show are checked (`RankingStore.shown`: a challenge's official
 * attempt, a line in the top `top.global` of a difficulty's board or the
 * top `top.starter` of a Pokémon's), plus a `sample` of the rest, which
 * keeps an eye on the simulation's determinism. Every other run's replay is
 * dropped unchecked.
 */
export const CHECKED = { top: { global: BOARD_SIZE, starter: 3 }, sample: 0.05 } as const

/**
 * Re-simulation of ranked runs, one at a time, after the API has answered,
 * for the runs worth it (`CHECKED`). A run is verified when its replay ends
 * on the same time, faints and level it reported, even if it ends on an open
 * level-up (the log notes it), and then shows the branch its replay took,
 * whatever the game said; otherwise it's marked failed and
 * leaves the boards. A replay that played another day's outbreak
 * (`outbreakFits`), or a haunted run outside the Noite das Bruxas
 * (`halloweenFits`), fails without re-simulating. When the machinery fails
 * instead, the run stays pending for the next start.
 * Replays of this build's rules (`RULES_VERSION`) are judged with this
 * build's simulation, and those of the previous rules (a run that straddled
 * a rules deploy, `rulesGrace.ts`, or one still pending from before it) with
 * the frozen one (`sims.ts`). An older one loses its replay and stays
 * unverified, like a run from a game that sent none (so does a replay its
 * simulator can't read); a newer one waits for this server to be updated
 * (a deploy restarts it, and `resume` picks it up).
 * `schedule` queues a run (again, if it grew in endless mode); `resume`
 * queues whatever was pending when the server last stopped. `paused`
 * (`CHECKS=off`) queues nothing: runs stay pending, replays kept, for the
 * next start without it.
 */
export const createChecks = (ranking: RankingStore, { paused = false } = {}) => {
  const run: Runner = import.meta.url.endsWith('.ts') ? inlineRunner() : workerRunner()
  const queue: string[] = []
  let busy = false

  const drain = async () => {
    if (busy) return
    busy = true
    while (queue.length > 0) {
      const id = queue.shift()!
      try {
        const reported = await ranking.runToCheck(id)
        if (!reported) continue
        // Whether it's on show is judged when its turn comes, against the boards as they are then.
        if (Math.random() >= CHECKED.sample && !(await ranking.shown(id, CHECKED.top))) {
          await ranking.dropReplay(id)
          continue
        }
        const rules = parseReplay(reported.replay)?.rules ?? RULES_VERSION
        const standing = rulesStanding(rules)
        if (standing === 'newer' || (standing === 'older' && rules !== FROZEN_RULES)) {
          if (standing === 'older') await ranking.dropReplay(id)
          console.log(`check ${id}: replay under ${standing} rules (${rules}), left unverified`)
          continue
        }
        const answer = await run({ id, replay: reported.replay, rules, startedAt: reported.startedAt.getTime() })
        if (!answer) continue
        const { judged, ms } = answer
        const under = rules === RULES_VERSION ? '' : ` under the frozen rules ${rules}`
        if (judged.kind === 'unjudged') {
          await ranking.dropReplay(id)
          console.log(`check ${id}: a replay its rules' simulator can't read${under}, left unverified`)
          continue
        }
        // The outbreak and the Noite das Bruxas are run inputs: they must fit the day the run started (or the day before).
        if (judged.kind === 'unfit') {
          await ranking.setVerified(id, reported.time, { ok: false }, null)
          console.log(`check ${id}: failed, ${judged.why === 'outbreak' ? 'another day\'s outbreak' : 'haunted outside the event'} (${reported.startedAt.toISOString()})${under}`)
          continue
        }
        const r = judged.result
        // A replay that ends on an open level-up (`stuck`) still played the run it reported, when the numbers match.
        const ok = sameTime(r.time, reported.time) && r.kills === reported.kills && r.level === reported.level
        // The branch isn't judged: the replay's own replaces the reported one.
        await ranking.setVerified(id, reported.time, ok ? { ok, branch: r.branch } : { ok }, ms)
        console.log(`check ${id}: ${ok ? 'verified' : 'failed'} in ${ms} ms${under}${r.stuck ? ', ending on an open level-up' : ''}`)
      } catch (err) {
        console.error('check failed', id, err)
      }
    }
    busy = false
  }

  return {
    schedule: (id: string) => {
      if (paused) return
      if (!queue.includes(id)) queue.push(id)
      void drain()
    },
    resume: async () => {
      if (paused) return
      queue.push(...(await ranking.uncheckedRuns()).filter((id) => !queue.includes(id)))
      void drain()
    },
  }
}

export type Checks = ReturnType<typeof createChecks>
