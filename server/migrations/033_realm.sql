-- The Poké Realm (src/realm.ts, server/README.md "Poké Realm"): furniture, secret bases, realm bans and reports.
-- Only adds, so the previous API keeps working during a rollout.

-- Furniture an account owns, a count per piece and source: `buy` (Bibarel's carpentry, ₽ or gems) or `gift`
-- (an event's, the admin's). Trophies (a captured legend's doll) are never stored: the API counts them from the save.
create table furniture_owned (
  user_id text not null references users (id) on delete cascade,
  furniture text not null,
  source text not null check (source in ('buy', 'gift')),
  count integer not null check (count > 0),
  primary key (user_id, furniture, source)
);

-- Every piece bought, for the trail: `pay` `gems` (its ledger line is `furniture:<id>`) or `coins` (₽ out of the
-- stored save, moved to `spent`). `user_id` goes null when the account is deleted.
create table furniture_buys (
  id uuid primary key default gen_random_uuid(),
  user_id text references users (id) on delete set null,
  furniture text not null,
  pay text not null check (pay in ('gems', 'coins')),
  price integer not null check (price > 0),
  at timestamptz not null default now()
);

create index furniture_buys_user on furniture_buys (user_id, at desc);

-- The gem ledger's new reason: a piece of furniture bought with gems (ref `furniture:<furniture_buys.id>`).
alter table gem_ledger drop constraint gem_ledger_reason_check;
alter table gem_ledger add constraint gem_ledger_reason_check
  check (reason in ('pack', 'patreon', 'play', 'run', 'week', 'buy', 'refund', 'dispute', 'disputeWon', 'grant', 'furniture'));

-- An account's secret base, once first saved (`PUT /realm/base`): the layout (`BaseLayout`, checked by `checkLayout`
-- against what the account owns), who may come in, its exterior and item count (the board's cards read them without the
-- layout), and the counters: `visits` (one per visitor per Brasília day, `base_visits`) and `likes` (`base_likes`).
create table bases (
  user_id text primary key references users (id) on delete cascade,
  layout jsonb not null,
  visibility text not null check (visibility in ('public', 'friends', 'private')),
  exterior text not null,
  items integer not null default 0,
  visits integer not null default 0,
  likes integer not null default 0,
  updated_at timestamptz not null default now()
);

-- The board's sorts: top (likes, then visits) and new, public bases with something in them.
create index bases_top on bases (likes desc, visits desc) where visibility = 'public' and items > 0;
create index bases_new on bases (updated_at desc) where visibility = 'public' and items > 0;

-- Who likes which base, once each (a second like takes it back).
create table base_likes (
  base_id text not null references bases (user_id) on delete cascade,
  user_id text not null references users (id) on delete cascade,
  at timestamptz not null default now(),
  primary key (base_id, user_id)
);

-- A visit counts once per visitor per Brasília day; rows older than a few days can go (only today's dedupe the counter).
create table base_visits (
  base_id text not null references bases (user_id) on delete cascade,
  visitor_id text not null references users (id) on delete cascade,
  day date not null,
  primary key (base_id, visitor_id, day)
);

-- Kept out of the Poké Realm (the relay refuses `banned`): `until` null is for good. `by`: the admin.
create table realm_bans (
  user_id text primary key references users (id) on delete cascade,
  until timestamptz,
  reason text not null check (char_length(reason) <= 200),
  by text references users (id) on delete set null,
  at timestamptz not null default now()
);

-- A trainer reported from the realm (`POST /realm/report`): one open report per reporter and target. Posted to the
-- staff's Discord channel; the admin's Realm tab resolves them (`ban`, `unban`, `dismiss`).
create table realm_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id text not null references users (id) on delete cascade,
  target_id text not null references users (id) on delete cascade,
  reason text not null check (reason in ('spam', 'name', 'base', 'harassment', 'other')),
  city text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text references users (id) on delete set null,
  resolution text check (resolution in ('ban', 'unban', 'dismiss')),
  check (reporter_id <> target_id)
);

create unique index realm_reports_once on realm_reports (reporter_id, target_id) where resolved_at is null;
create index realm_reports_open on realm_reports (target_id, created_at) where resolved_at is null;
create index realm_reports_reporter on realm_reports (reporter_id, created_at desc);

-- Like every table: RLS on and no grants for Supabase's Data API roles (they exist only on Supabase).
alter table furniture_owned enable row level security;
alter table furniture_buys enable row level security;
alter table bases enable row level security;
alter table base_likes enable row level security;
alter table base_visits enable row level security;
alter table realm_bans enable row level security;
alter table realm_reports enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table furniture_owned, furniture_buys, bases, base_likes, base_visits, realm_bans, realm_reports from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table furniture_owned, furniture_buys, bases, base_likes, base_visits, realm_bans, realm_reports from authenticated;
  end if;
end
$$;
