-- The Escavação (src/realm/games/dig.rules.ts, server/src/dig.ts). 038 and 039 are left for the Safari and whatever lands first.
-- Only adds, so the previous API keeps working during a rollout.

-- Every wall dug: charged here, `built` holds its layout (`DigWall` plus the partner's powers and the fossils lacked at the start)
-- and never leaves the API, `left` the layers still over each cell, `crack` and `seq` where the dig stands, `result` once ended
-- (a repeated stop reads it back).
create table dig_walls (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users (id) on delete cascade,
  day date not null,
  week date not null,
  seed integer not null check (seed > 0),
  price integer not null default 0 check (price >= 0),
  built jsonb not null,
  left_layers jsonb not null,
  crack integer not null default 0 check (crack >= 0),
  seq integer not null default 0 check (seq >= 0),
  outcome text check (outcome in ('collapse', 'stopped')),
  result jsonb,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);
create index dig_walls_day on dig_walls (user_id, day);
-- One wall in play per account: a wall paid for and never finished waits for its owner.
create unique index dig_walls_open on dig_walls (user_id) where ended_at is null;

-- Every hit's answer, so a repeated hit gets the same one back.
create table dig_hits (
  wall_id uuid not null references dig_walls (id) on delete cascade,
  seq integer not null,
  answer jsonb not null,
  primary key (wall_id, seq)
);

-- The account's walls in a row without a fossil it lacks: at 10 the next wall holds one. Kept across weeks.
create table dig_progress (
  user_id text primary key references users (id) on delete cascade,
  dry integer not null default 0 check (dry >= 0)
);

-- Furniture dug up at the mine is furniture of a source of its own.
alter table furniture_owned drop constraint furniture_owned_source_check;
alter table furniture_owned add constraint furniture_owned_source_check check (source in ('buy', 'gift', 'game', 'claw', 'dig'));

-- Like every table: RLS on and no grants for Supabase's Data API roles (they exist only on Supabase).
alter table dig_walls enable row level security;
alter table dig_hits enable row level security;
alter table dig_progress enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table dig_walls, dig_hits, dig_progress from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table dig_walls, dig_hits, dig_progress from authenticated;
  end if;
end
$$;
