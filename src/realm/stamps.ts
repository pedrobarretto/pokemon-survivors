import { STAMP_IDS, STAMP_MILESTONES, STAMPS, type Deed, type StampCondition, type StampId } from '../data/realmStamps'

/** An account's count per deed, as the API keeps them. */
export type DeedCounts = Readonly<Partial<Record<Deed, number>>>

const meets = (when: StampCondition, counts: DeedCounts) => ('all' in when ? when.all.every((d) => (counts[d] ?? 0) >= 1) : (counts[when.deed] ?? 0) >= (when.at ?? 1))

/** The stamps `counts` has reached and `owned` doesn't hold yet, in the book's order. */
export const newStamps = (counts: DeedCounts, owned: ReadonlySet<string>): StampId[] => STAMP_IDS.filter((id) => !owned.has(id) && meets(STAMPS[id].when, counts))

/** A stamp's progress towards its condition, for the book: how far along and out of how many. */
export const stampProgress = (id: StampId, counts: DeedCounts): { done: number; of: number } => {
  const when: StampCondition = STAMPS[id].when
  if ('all' in when) return { done: when.all.filter((d) => (counts[d] ?? 0) >= 1).length, of: when.all.length }
  const of = when.at ?? 1
  return { done: Math.min(of, counts[when.deed] ?? 0), of }
}

/** The milestones a number of stamps has reached. */
export const milestonesReached = (stamps: number) => STAMP_MILESTONES.filter((m) => stamps >= m.at)
