-- The co-op boards (Duplas, Trios, Squads) and the Desafio co-op do dia (src/coopBoards.ts, rules in
-- ../src/game/coopBoard.ts). Only adds, so the previous API keeps working during a rollout.

-- One finished co-op run the relay reported. `room`, `run`, `ended_at`: the relay's room code, the run
-- within it and when it ended, unique so a report sent twice lands once (room codes come back once a
-- room expires, so the end time is part of it). `size`: the players who started it (2 to 4).
-- `challenge`: the Desafio co-op do dia's Brasília day, null for any other run (those boards only).
-- `team`: the members' user ids, sorted and joined by commas: the boards keep a team's best run.
-- `votes`: how many clients sent the agreed result. `result`: the `CoopResult` as parsed.
create table coop_runs (
  id uuid primary key default gen_random_uuid(),
  room text not null,
  run integer not null,
  region text not null,
  size smallint not null check (size between 2 and 4),
  difficulty text not null,
  challenge date,
  survived float8 not null,
  outcome text not null check (outcome in ('victory', 'wipe')),
  kills integer not null,
  votes smallint not null,
  team text not null,
  ended_at timestamptz not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  unique (room, run, ended_at)
);

-- The boards: a size and difficulty's runs by period (day and week by when they ended), each team's best
-- first; and a day's challenge board per size.
create index coop_runs_board on coop_runs (size, difficulty, team, survived desc, ended_at) where challenge is null;
create index coop_runs_board_recent on coop_runs (size, difficulty, ended_at) where challenge is null;
create index coop_runs_challenge on coop_runs (challenge, size, team, survived desc, ended_at) where challenge is not null;

-- Each seat of a run, by slot: the account and the Pokémon it played (as it ended, or as it left).
create table coop_run_members (
  run_id uuid not null references coop_runs (id) on delete cascade,
  slot smallint not null,
  user_id text not null references users (id) on delete cascade,
  starter text not null,
  stage smallint not null,
  branch text,
  shiny boolean not null default false,
  level integer not null,
  kills integer not null,
  "left" boolean not null default false,
  primary key (run_id, slot)
);

-- A player's runs (their own line on a board, the friends' boards).
create index coop_run_members_user on coop_run_members (user_id, run_id);

-- Like every table: RLS on and no grants for Supabase's Data API roles (they exist only on Supabase).
alter table coop_runs enable row level security;
alter table coop_run_members enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table coop_runs, coop_run_members from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table coop_runs, coop_run_members from authenticated;
  end if;
end
$$;
