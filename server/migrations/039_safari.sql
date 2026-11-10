-- The Zona Safári (src/realm/games/safari.rules.ts, server/src/safari.ts).
-- Only adds, so the previous API keeps working during a rollout.

-- Every session entered: charged here, `state` holds who's in the bushes (never sent whole) and each turn's answer (a repeated action reads it back).
create table safari_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users (id) on delete cascade,
  day date not null,
  week date not null,
  habitat text not null,
  price integer not null default 0 check (price >= 0),
  state jsonb not null,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
create index safari_sessions_day on safari_sessions (user_id, day);
-- One session at a time per account: one paid for and never played waits for its owner.
create unique index safari_sessions_open on safari_sessions (user_id) where finished_at is null;

-- Each account's sessions in a row without a new family, across weeks (the guarantee).
create table safari_progress (
  user_id text primary key references users (id) on delete cascade,
  dry integer not null default 0 check (dry >= 0)
);

-- Like every table: RLS on and no grants for Supabase's Data API roles (they exist only on Supabase).
alter table safari_sessions enable row level security;
alter table safari_progress enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table safari_sessions, safari_progress from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table safari_sessions, safari_progress from authenticated;
  end if;
end
$$;
