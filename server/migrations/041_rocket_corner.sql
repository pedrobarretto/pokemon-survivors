-- The Rocket Game Corner (src/realm/games/corner.rules.ts, src/data/rocketCorner.ts, server/src/corner.ts).
-- Only adds, so the previous API keeps working during a rollout.

-- Each account's tokens, and today's counts (reset when `day` moves on): tokens bought, tokens won, spins and Koffing Sweep boards.
-- `level` is the next Koffing Sweep board's; `last_nonce`/`last_spin` answer a repeated spin.
create table corner_wallets (
  user_id text primary key references users (id) on delete cascade,
  tokens integer not null default 0 check (tokens >= 0),
  day date not null default current_date,
  bought integer not null default 0 check (bought >= 0),
  won integer not null default 0 check (won >= 0),
  spins integer not null default 0 check (spins >= 0),
  rounds integer not null default 0 check (rounds >= 0),
  level integer not null default 1 check (level between 1 and 5),
  last_nonce uuid,
  last_spin jsonb
);

-- Every Koffing Sweep board dealt: its tiles (never sent face down), the ones flipped, and how it ended.
create table corner_sweeps (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users (id) on delete cascade,
  day date not null,
  level integer not null check (level between 1 and 5),
  board jsonb not null,
  flipped jsonb not null default '[]',
  outcome text check (outcome in ('clear', 'koffing', 'bank')),
  paid integer not null default 0 check (paid >= 0),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
-- One board in play per account.
create unique index corner_sweeps_open on corner_sweeps (user_id) where finished_at is null;

-- Prizes taken at the counter (the once-only ones are refused a second time), and every redemption, for the record.
create table corner_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users (id) on delete cascade,
  prize text not null,
  price integer not null check (price >= 0),
  created_at timestamptz not null default now()
);
create index corner_redemptions_user on corner_redemptions (user_id, prize);

-- Like every table: RLS on and no grants for Supabase's Data API roles (they exist only on Supabase).
alter table corner_wallets enable row level security;
alter table corner_sweeps enable row level security;
alter table corner_redemptions enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table corner_wallets, corner_sweeps, corner_redemptions from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table corner_wallets, corner_sweeps, corner_redemptions from authenticated;
  end if;
end
$$;
