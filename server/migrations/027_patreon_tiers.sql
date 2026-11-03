-- Patreon tiers (src/supporters.ts, `effectiveTier` in ../src/game/supporters.ts). Only adds, so the previous API keeps working during a rollout.

-- `users.og_tier`: the OG supporters, everyone who supported before Patreon tiers, and the tier they had then
-- ('gold' at `SUPPORTER.gold`, 5000 points, R$ 50 or US$ 10 in all; else 'supporter'). Permanent: they stay on the
-- Hall and keep their badge and role. Nobody gets it after this migration.
alter table users add column og_tier text;

update users set og_tier = case when supporter_points >= 5000 then 'gold' else 'supporter' end where supporter_points > 0;

-- `users.patreon_tier`: the tier of the linked patron's active pledge (null without one); `patreon_best`: the highest
-- one Patreon ever gave the account (Gold or Diamond once keeps it on the Hall for good).
alter table users add column patreon_tier text;

alter table users add column patreon_best text;

-- `patreon_members`: each patron's tier as the campaign's webhook last told it, linked or not, so linking later
-- takes the tier at once (`linkPatreon`).
create table patreon_members (
  patreon_id text primary key,
  tier text,
  updated_at timestamptz not null default now()
);
