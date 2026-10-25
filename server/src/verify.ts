import { parentPort } from 'node:worker_threads'
import { judge, type Job } from './sims'

/**
 * Worker thread that judges replays (the verifier's `checks.ts` starts it), so
 * a long run's seconds of simulation never hold up its event loop. Takes a `Job`,
 * answers `{ id, judged, ms }`, or `{ id, judged: null }` when the machinery
 * failed (the frozen simulator wouldn't load, a crash), not the run.
 */
parentPort?.on('message', (job: Job) => {
  judge(job).then(
    (answer) => parentPort?.postMessage({ id: job.id, ...answer }),
    (err: unknown) => {
      console.error('check worker', job.id, err)
      parentPort?.postMessage({ id: job.id, judged: null })
    },
  )
})
