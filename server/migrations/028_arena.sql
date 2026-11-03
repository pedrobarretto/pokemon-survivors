-- The Arena's competitive layer (src/arena.ts, rules in ../src/game/arenaRank.ts). Only adds, so the previous API keeps working during a rollout.

-- One finished Arena match. `room`, `run`: the relay's room code and the run within it (a room plays
-- again), unique so a report sent twice lands once; a practice match against bots (`kind` 'practice',
-- sent by the client) has `practice:<user>:<key>` when the client gave a key, else null. `season`: the
-- season it ended in (null before the first). `rated`: whether it moved ratings (`countsForRank`).
-- `winner` 0 Blue, 1 Red, null a draw. `result`: the agreed `ArenaResult` as parsed.
create table arena_matches (
  id uuid primary key default gen_random_uuid(),
  room text,
  run integer not null default 0,
  kind text not null check (kind in ('casual', 'ranked', 'room', 'practice')),
  region text not null,
  season integer,
  rated boolean not null default false,
  ended_at timestamptz not null,
  score_blue integer not null,
  score_red integer not null,
  winner smallint check (winner in (0, 1)),
  seconds integer not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  unique (room, run)
);

-- One human's line in a match (bots stay in `arena_matches.result` only). `outcome` from their side,
-- a leaver's always a loss. `kind`, `season`, `at` repeat the match's, for the history and the season's
-- totals. `mmr_change`, `rp_change`: what a rated match moved, null otherwise.
create table arena_lines (
  match_id uuid not null references arena_matches (id) on delete cascade,
  user_id text not null references users (id) on delete cascade,
  slot smallint not null,
  team smallint not null check (team in (0, 1)),
  starter text not null,
  form text not null,
  kos integer not null,
  deaths integer not null,
  scored integer not null,
  damage integer not null,
  "left" boolean not null default false,
  outcome text not null check (outcome in ('win', 'loss', 'draw')),
  kind text not null,
  season integer,
  at timestamptz not null,
  mmr_change integer,
  rp_change integer,
  primary key (match_id, slot)
);

-- A player's history (newest first) and their season's totals and favorites.
create index arena_lines_user_at on arena_lines (user_id, at desc);
create index arena_lines_user_season on arena_lines (user_id, season);

-- A player's rating in a season (`Rating`: hidden `mmr`, visible `rp`, the best `peak`, rated `games`),
-- with the season's record. Created by the first rated match of the season, from the previous season's
-- (`seasonReset`) or fresh. `updated_at`: the last rated match, the board's tie break (earlier first).
create table arena_ratings (
  user_id text not null references users (id) on delete cascade,
  season integer not null,
  mmr integer not null,
  rp integer not null,
  peak integer not null,
  games integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  draws integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, season)
);

-- The season's board: RP, then peak, then who got there first.
create index arena_ratings_board on arena_ratings (season, rp desc, peak desc, updated_at, user_id) where games > 0;

-- Like every table: RLS on and no grants for Supabase's Data API roles (they exist only on Supabase).
alter table arena_matches enable row level security;
alter table arena_lines enable row level security;
alter table arena_ratings enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table arena_matches, arena_lines, arena_ratings from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table arena_matches, arena_lines, arena_ratings from authenticated;
  end if;
end
$$;
