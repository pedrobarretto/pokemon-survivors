import { PostHog } from 'posthog-node'
import { revenueCapture, type Revenue } from './revenue'

/** Where an error happened: the player it happened to (when known) and anything that helps find it. */
export type ErrorContext = { userId?: string | null } & Record<string, string | number | boolean | null>

/** Reports an error that the API caught and answered for (a 500). */
export type Report = (err: unknown, context: ErrorContext) => void

/** Tells PostHog of a payment the API just confirmed (`revenue.ts`). */
export type TellRevenue = (r: Revenue) => void

/**
 * The API's error reports, to the game's PostHog project (error tracking), next
 * to the client's, and the payments it confirms (`revenue`, for revenue
 * analytics: the client never sees a payment land). With a key it also catches
 * uncaught exceptions and rejections itself; `flush` sends what's queued before
 * the process exits. Without a key, errors only go to the log and payments nowhere.
 */
export const errorReports = (key: string | undefined): { report: Report; revenue: TellRevenue; flush: () => Promise<void> } => {
  if (!key) return { report: () => {}, revenue: () => {}, flush: async () => {} }
  const posthog = new PostHog(key, { host: 'https://us.i.posthog.com', enableExceptionAutocapture: true })
  return {
    // The player's id ties the error to their events from the game; without one PostHog makes up an anonymous id.
    report: (err, { userId, ...context }) => posthog.captureException(err, userId ?? undefined, { ...context, service: 'api' }),
    revenue: (r) => posthog.capture(revenueCapture(r)),
    flush: () => posthog.shutdown(5000),
  }
}
