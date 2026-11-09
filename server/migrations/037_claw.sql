-- The Máquina de Pelúcias (src/realm/games/claw.rules.ts, server/src/claw.ts).
-- Only adds, so the previous API keeps working during a rollout.

-- Every credit put in the machine: charged here, `seed` for its shake, `result` once dropped (a repeated drop reads it back).
create table claw_plays (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users (id) on delete cascade,
  day date not null,
  week date not null,
  seed integer not null check (seed > 0),
  price integer not null default 0 check (price >= 0),
  result jsonb,
  dropped_at timestamptz,
  created_at timestamptz not null default now()
);
create index claw_plays_day on claw_plays (user_id, day);
-- One credit in play per account: a credit paid for and never dropped waits for its owner.
create unique index claw_plays_open on claw_plays (user_id) where dropped_at is null;

-- Each account's misses per plush (each moves that plush toward the chute); a win starts it over. Kept across weeks.
create table claw_progress (
  user_id text not null references users (id) on delete cascade,
  family text not null,
  misses integer not null default 0 check (misses >= 0),
  wins integer not null default 0 check (wins >= 0),
  primary key (user_id, family)
);

-- A plush is furniture of a source of its own.
alter table furniture_owned drop constraint furniture_owned_source_check;
alter table furniture_owned add constraint furniture_owned_source_check check (source in ('buy', 'gift', 'game', 'claw'));

-- Like every table: RLS on and no grants for Supabase's Data API roles (they exist only on Supabase).
alter table claw_plays enable row level security;
alter table claw_progress enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table claw_plays, claw_progress from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table claw_plays, claw_progress from authenticated;
  end if;
end
$$;
