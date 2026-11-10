-- The Poké Realm's Estampas and Recados (src/data/realmStamps.ts, src/realm/errands.ts, server/src/realmDeeds.ts).
-- Only adds, so the previous API keeps working during a rollout.

-- Each account's count per deed: what stamps are conditions over.
create table realm_deeds (
  user_id text not null references users (id) on delete cascade,
  deed text not null,
  count integer not null default 0 check (count >= 0),
  primary key (user_id, deed)
);

-- The stamps each account earned, and when.
create table realm_stamps (
  user_id text not null references users (id) on delete cascade,
  stamp text not null,
  at timestamptz not null default now(),
  primary key (user_id, stamp)
);

-- The day's Recados per account and Brasília day: how far along and when collected (null: not yet). Rows older than a
-- few days can go (only today's are read).
create table realm_errand_days (
  user_id text not null references users (id) on delete cascade,
  day date not null,
  errand text not null,
  progress integer not null default 0 check (progress >= 0),
  claimed_at timestamptz,
  primary key (user_id, day, errand)
);

-- The stamp milestones already rewarded: each is paid once.
create table realm_stamp_milestones (
  user_id text not null references users (id) on delete cascade,
  at integer not null,
  paid_at timestamptz not null default now(),
  primary key (user_id, at)
);

-- Like every table: RLS on and no grants for Supabase's Data API roles (they exist only on Supabase).
alter table realm_deeds enable row level security;
alter table realm_stamps enable row level security;
alter table realm_errand_days enable row level security;
alter table realm_stamp_milestones enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table realm_deeds, realm_stamps, realm_errand_days, realm_stamp_milestones from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table realm_deeds, realm_stamps, realm_errand_days, realm_stamp_milestones from authenticated;
  end if;
end
$$;
