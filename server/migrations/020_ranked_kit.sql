-- The ranked kit (src/game/rankedKit.ts): a ranked run's start kit (Poké Mart ranks and Bag items, in ₽) against what
-- its account backs. Numbered 020 so it doesn't take 019, which the Kecleon Shop's PR holds. Only adds, so the previous
-- API keeps working during a rollout.

alter table users
  -- ₽ of kit the account brought in as earned: null until decided, once, by `scripts/kitAmnesty.ts` (the accounts with
  -- a save at this deploy) or by the account's first save push (`importAmnesty`). A reset or an exclusion sets 0.
  add column kit_amnesty integer,
  add column kit_amnesty_at timestamptz;

alter table runs
  -- The run's kit and what its account backed when it reported (`kitCost`, `kitBacking`), null before this deploy.
  -- `kit_cost > kit_backing` is an unbacked run: logged always, off the public boards (`unlisted`) only with KIT_ENFORCE.
  add column kit_cost integer,
  add column kit_backing bigint;
