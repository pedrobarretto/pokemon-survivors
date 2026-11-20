import { Worker } from 'node:worker_threads'
import { unbackedLoadout } from '../../src/game/loadoutBacking'
import { EMPTY_SAVE } from '../../src/game/meta'
import { parseReplay, RULES_VERSION, rulesStanding } from '../../src/game/replay'
import type { SaveStore } from './db'
import { sameTime, type RankingStore } from './ranking'
import { FROZEN_RULES, judge, type Job, type Judged } from './sims'

type Answer = { judged: Judged; ms: number }

/** Judges one replay; null when the machinery failed (not the run). */
type Runner = (job: Job) => Promise<Answer | null>

/**
 * The bundled worker (`dist/verify.js`, next to `index.js`): a long run's
 * seconds of simulation never hold up the verifier's event loop (its
 * `/health`, its queries), and the frozen simulator of the previous rules only
 * ever loads there. A crash (a replay that blows the heap) fails only that
 * check; the next one gets a fresh worker.
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
 * The verifier's pace. A claim (`claimCheck`) holds a run for `leaseSeconds`,
 * longer than any re-simulation, so only a verifier that died (or a rollout's
 * second one) ever sees one run out; a run whose check couldn't finish (the
 * machinery failed) is tried again once it does, up to `attempts` times, and
 * then loses its replay unchecked. A replay of newer rules than the
 * verifier's gives its attempt back: it waits for the updated verifier
 * however long its deploy takes, and so does a run whose stored save doesn't back its
 * loadout yet, for `loadoutWaitSeconds` after it last reported (the device pushes the save
 * after the run, unless it went offline). With nothing
 * pending the loop asks again after `idleMs`, after a database error after `errorMs`.
 */
export const CHECK_LOOP = { leaseSeconds: 30 * 60, attempts: 3, loadoutWaitSeconds: 6 * 3600, idleMs: 5000, errorMs: 15_000 } as const

type Claimed = NonNullable<Awaited<ReturnType<RankingStore['claimCheck']>>>

/**
 * Re-simulation of ranked runs, one at a time, in the verifier's own process
 * (`ROLE=checks`, `verifier.ts`), pulled from the database: a restart loses
 * nothing, and the API never spends CPU on it. Only runs on show (or drawn for
 * the determinism sample) keep their replay when they report (`checkRank`), so
 * only those wait; the loop claims them in check order (`claimCheck`, by
 * `check_rank`), and one that fell off the boards since (past `CHECKED.top`)
 * loses its replay unchecked, unless it's a sample. A run is verified when its
 * replay ends on the same time, faints and level it reported, even if it ends
 * on an open level-up (the log notes it), and then shows the branch its replay
 * took, whatever the game said; otherwise it's marked failed and leaves the
 * boards. A replay that played another day's outbreak (`outbreakFits`), or a
 * haunted run outside the Noite das Bruxas (`halloweenFits`), fails without
 * re-simulating. Before its re-simulation, a regular run's loadout (its
 * Pokémon, ranks, Bottle Caps, TMs, evolution items, Shadow and path forms)
 * must be backed by the account's stored save (`unbackedLoadout`): one that
 * isn't waits for the save to catch up (`CHECK_LOOP.loadoutWaitSeconds`, its
 * claim running out every `leaseSeconds`, its attempts given back), still on
 * the boards meanwhile; past that it's unlisted for good (`setUnbacked`: it
 * stays the player's) and re-simulated all the same. When the machinery fails instead, the run stays pending and
 * is tried again once its claim runs out, `CHECK_LOOP.attempts` times at most
 * (a replay that crashes the worker would cost a crash every time): then its
 * replay is dropped and it stays unverified.
 * Replays of this build's rules (`RULES_VERSION`) are judged with this
 * build's simulation, and those of the previous rules (a run that straddled
 * a rules deploy, `rulesGrace.ts`, or one still pending from before it) with
 * the frozen one (`sims.ts`). An older one loses its replay and stays
 * unverified, like a run from a game that sent none (so does a replay its
 * simulator can't read); a newer one waits for this verifier to be updated,
 * without spending its attempts.
 * `paused` (`CHECKS=off`) claims nothing: runs stay pending, replays kept,
 * until a start without it. `stop` ends the loop after the check in hand.
 */
export const startChecks = (ranking: RankingStore, saves: Pick<SaveStore, 'read'>, { paused = false } = {}) => {
  const run: Runner = import.meta.url.endsWith('.ts') ? inlineRunner() : workerRunner()
  let stopped = paused
  let wake = () => {}
  const rest = (ms: number) =>
    new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, ms)
      wake = () => {
        clearTimeout(timer)
        resolve()
      }
    })

  const check = async (claimed: Claimed) => {
    const { id } = claimed
    const replay = parseReplay(claimed.replay)
    const rules = replay?.rules ?? RULES_VERSION
    const standing = rulesStanding(rules)
    // Rules bump almost daily: a verifier whose deploy lags behind the API's mustn't wear out the top runs' attempts.
    if (standing === 'newer') {
      await ranking.giveBackAttempt(id)
      console.log(`check ${id}: replay under newer rules (${rules}), waiting for a verifier of them`)
      return
    }
    if (claimed.attempt > CHECK_LOOP.attempts) {
      await ranking.dropReplay(id)
      console.log(`check ${id}: gave up after ${CHECK_LOOP.attempts} attempts, left unverified`)
      return
    }
    // Whether it's still on show is judged when its turn comes, against the boards as they are then.
    if (!claimed.sample && !(await ranking.shown(id))) {
      await ranking.dropReplay(id)
      return
    }
    if (standing === 'older' && rules !== FROZEN_RULES) {
      await ranking.dropReplay(id)
      console.log(`check ${id}: replay under older rules (${rules}), left unverified`)
      return
    }
    // A Desafio do dia plays the day's own loadout; any other run plays what the account's save holds.
    if (replay && !claimed.challenge) {
      const gap = unbackedLoadout(replay.start, (await saves.read(claimed.userId))?.save ?? EMPTY_SAVE)
      if (gap.length > 0 && claimed.age < CHECK_LOOP.loadoutWaitSeconds) {
        await ranking.giveBackAttempt(id)
        console.log(`check ${id}: the stored save doesn't back its ${gap.join(', ')} yet, waiting for it`)
        return
      }
      if (gap.length > 0) {
        await ranking.setUnbacked(id, claimed.time, gap)
        console.log(`check ${id}: unlisted, the stored save doesn't back its ${gap.join(', ')} (${replay.start.starter})`)
      }
    }
    const answer = await run({ id, replay: claimed.replay, rules, startedAt: claimed.startedAt.getTime() })
    if (!answer) return
    const { judged, ms } = answer
    const under = rules === RULES_VERSION ? '' : ` under the frozen rules ${rules}`
    if (judged.kind === 'unjudged') {
      await ranking.dropReplay(id)
      console.log(`check ${id}: a replay its rules' simulator can't read${under}, left unverified`)
      return
    }
    // The outbreak, the Noite das Bruxas and the raid of the day are run inputs: they must fit the day the run started (or the day before).
    if (judged.kind === 'unfit') {
      await ranking.setVerified(id, claimed.time, { ok: false }, null)
      const why = judged.why === 'outbreak' ? 'another day\'s outbreak' : judged.why === 'raid' ? 'another day\'s Tera Raid' : judged.why === 'ultra' ? 'another week\'s Ultra Beast' : 'haunted outside the event'
      console.log(`check ${id}: failed, ${why} (${claimed.startedAt.toISOString()})${under}`)
      return
    }
    const r = judged.result
    // A replay that ends on an open level-up (`stuck`) still played the run it reported, when the numbers match.
    const ok = sameTime(r.time, claimed.time) && r.kills === claimed.kills && r.level === claimed.level
    // The branch isn't judged: the replay's own replaces the reported one.
    await ranking.setVerified(id, claimed.time, ok ? { ok, branch: r.branch } : { ok }, ms)
    console.log(`check ${id}: ${ok ? 'verified' : 'failed'} in ${ms} ms${under}${r.stuck ? ', ending on an open level-up' : ''}`)
  }

  const loop = async () => {
    while (!stopped) {
      const claimed = await ranking.claimCheck(CHECK_LOOP.leaseSeconds).catch((err: unknown) => {
        console.error('check claim failed', err)
        return 'error' as const
      })
      if (claimed === 'error' || claimed === null) {
        await rest(claimed === 'error' ? CHECK_LOOP.errorMs : CHECK_LOOP.idleMs)
        continue
      }
      await check(claimed).catch((err: unknown) => console.error('check failed', claimed.id, err))
    }
  }
  const done = loop()

  return {
    /** Ends the loop: at once when it's waiting, else after the check in hand. */
    stop: () => {
      stopped = true
      wake()
      return done
    },
  }
}

export type Checks = ReturnType<typeof startChecks>
