import type { PlayableId } from './data/hatchlings'
import type { Difficulty } from './game/difficulty'

/** Custom events sent to Umami, with their payloads. Keep this list short: every event counts. */
type AnalyticsEvents = {
  /** `team`: players in the run (1 solo, 2 to 4 in co-op). */
  run_start: { starter: PlayableId; difficulty: Difficulty; team: number }
  run_end: { starter: PlayableId; difficulty: Difficulty; outcome: 'victory' | 'gameover' | 'endless' | 'quit'; minute: number; level: number; kills: number; team: number }
  /** A share card left the game: the run's or the Trainer Card, through the share sheet, the clipboard or a download. */
  share: { kind: 'run' | 'trainer'; method: 'share' | 'copy' | 'download' }
  /** The game opened from a link carrying someone's handle (`?ref=` or a profile's `?u=`); `first`: the device had no inviter yet. */
  ref_land: { ref: string; via: 'ref' | 'profile'; first: 0 | 1 }
  /** A new account signed up with an invite and the API counted it (`POST /referral`). */
  ref_signup: { ref: string }
}

declare global {
  interface Window {
    /** Umami's tracker, set by the script in the page head. Missing in dev, offline or behind an ad blocker. */
    umami?: { track: (event: string, data?: Record<string, string | number>) => void }
  }
}

/** Sends a custom event to Umami. Silently does nothing when the tracker isn't loaded. */
export const track = <E extends keyof AnalyticsEvents>(event: E, data: AnalyticsEvents[E]) => window.umami?.track(event, data)
