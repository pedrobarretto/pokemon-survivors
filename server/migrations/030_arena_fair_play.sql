-- The Arena's Fair Play and protection meter (src/arena.ts, rules in ../src/game/arenaRank.ts). Only adds, so the previous API keeps working during a rollout.

-- A player's Fair Play score (`ARENA_RANKED.fairPlay`), account-wide: 0 to 100. No row: a full score.
-- Moved only by the relay's reports, never by a client.
create table arena_fair_play (
  user_id text primary key references users (id) on delete cascade,
  score smallint not null check (score between 0 and 100),
  updated_at timestamptz not null default now()
);

-- What each matchmade match (with another human in it) did to a player's Fair Play: `conduct` played it
-- out (`finished`), left before the end (`left`) or idled through it (`afk`), the `change` and the score
-- after. One per (room, run, player), so a retried report lands once, a match everyone abandoned (no
-- `arena_matches` row) too. The hub reads a player's latest penalties from it.
create table arena_conduct (
  room text not null,
  run integer not null,
  user_id text not null references users (id) on delete cascade,
  kind text not null check (kind in ('casual', 'ranked')),
  conduct text not null check (conduct in ('finished', 'left', 'afk')),
  change smallint not null,
  score smallint not null,
  at timestamptz not null,
  primary key (room, run, user_id)
);

-- A player's latest penalties.
create index arena_conduct_user_penalties on arena_conduct (user_id, at desc) where conduct <> 'finished';

-- The protection meter (`ARENA_RANKED.protection`), per season like the rest of the rating: 0 to 100.
alter table arena_ratings add column protection smallint not null default 0;

-- A rated loss the full meter took (its `rp_change` is 0).
alter table arena_lines add column protected boolean not null default false;

-- Like every table: RLS on and no grants for Supabase's Data API roles (they exist only on Supabase).
alter table arena_fair_play enable row level security;
alter table arena_conduct enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table arena_fair_play, arena_conduct from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table arena_fair_play, arena_conduct from authenticated;
  end if;
end
$$;
