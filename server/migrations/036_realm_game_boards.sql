-- The mini games' boards (src/realm/boards.ts, GET /realm/boards/:game, server/README.md "Poké Realm").
-- Only adds, so the previous API keeps working during a rollout.

-- Each account's line on a game's board for a period: `day` (the Brasília day `start`) or `week` (the Monday `start`).
-- `score` is a solo game's best score of the period, or a table game's wins against a person (`boardPoints`), and
-- `at` when it got there (ties go to who got there first). Written by the claim (`POST /realm/game/claim`), one row
-- per account, game and period. Rows of past periods are only read for no board: they can go after a few weeks.
create table realm_game_boards (
  game text not null,
  period text not null check (period in ('day', 'week')),
  start date not null,
  user_id text not null references users (id) on delete cascade,
  score integer not null check (score >= 0),
  at timestamptz not null default now(),
  primary key (game, period, start, user_id)
);

-- A board's ranking: one period of one game, best first, the earlier first on a tie.
create index realm_game_boards_rank on realm_game_boards (game, period, start, score desc, at);

-- Like every table: RLS on and no grants for Supabase's Data API roles (they exist only on Supabase).
alter table realm_game_boards enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table realm_game_boards from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table realm_game_boards from authenticated;
  end if;
end
$$;
