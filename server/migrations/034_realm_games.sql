-- The Poké Realm's mini games (src/data/minigames.ts, POST /realm/game/claim, server/README.md "Poké Realm").
-- Only adds, so the previous API keeps working during a rollout.

-- What each account's mini games paid on a Brasília day, per game: the daily caps (each game's `pay.daily` and
-- `MINIGAME_DAILY` across all) read it. Rows older than a few days can go (only today's are read).
create table realm_game_days (
  user_id text not null references users (id) on delete cascade,
  day date not null,
  game text not null,
  paid integer not null default 0 check (paid >= 0),
  plays integer not null default 0 check (plays >= 0),
  primary key (user_id, day, game)
);

-- Each account's running stats per game (`GameStats`): finished games, wins at a table, the best solo score and the
-- feats it ever hit (ids of the game's `feats`). The trophies (`trophiesEarned`) count from them.
create table realm_game_stats (
  user_id text not null references users (id) on delete cascade,
  game text not null,
  plays integer not null default 0 check (plays >= 0),
  wins integer not null default 0 check (wins >= 0),
  best integer not null default 0 check (best >= 0),
  feats text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, game)
);

-- The mini games' trophies are furniture the API grants from those stats: a new source, `game` (once each).
alter table furniture_owned drop constraint furniture_owned_source_check;
alter table furniture_owned add constraint furniture_owned_source_check check (source in ('buy', 'gift', 'game'));

-- Like every table: RLS on and no grants for Supabase's Data API roles (they exist only on Supabase).
alter table realm_game_days enable row level security;
alter table realm_game_stats enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table realm_game_days, realm_game_stats from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table realm_game_days, realm_game_stats from authenticated;
  end if;
end
$$;
