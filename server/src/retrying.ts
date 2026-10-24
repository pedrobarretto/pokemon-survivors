/**
 * Runs `task` up to `attempts` times, `delayMs` apart, logging each failure: a
 * boot step that hits a passing database error (the pooler handing over a
 * backend whose statement timer a dead client left running) tries again
 * instead of crashing the instance, which would cut its own connections and
 * leave more such backends behind.
 */
export const retrying = async <T>(what: string, task: () => Promise<T>, attempts = 5, delayMs = 3000): Promise<T> => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await task()
    } catch (err) {
      if (attempt >= attempts) throw err
      console.error(`${what} failed (attempt ${attempt} of ${attempts}), trying again`, err)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
}
