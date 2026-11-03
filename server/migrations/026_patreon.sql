-- Patreon as a donation source (src/patreon.ts, `patreonCharge` in src/webhooks.ts). Only adds, so the previous API keeps working during a rollout.

-- `users.patreon_id`: the Patreon user id the player linked in the game (one game account per Patreon account).
alter table users add column patreon_id text;

create unique index users_patreon on users (patreon_id);

-- `donations.patreon_id`: the patron a Patreon charge came from (`provider` `patreon`, `ref` `patreon:<member id>:<charge date>`).
-- A charge of a patron who hasn't linked yet waits with no `user_id` and is credited when they link.
alter table donations add column patreon_id text;

create index donations_patreon_pending on donations (patreon_id) where user_id is null;
