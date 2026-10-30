-- Gems: the Arena shop's currency (src/gems.ts, rules in ../src/game/gems.ts). Only adds, so the previous API keeps working during a rollout.

-- Every move of an account's gems, append-only. `ref` is unique across the whole ledger, so a webhook, a
-- report or a click that comes twice lands once: `pack:<purchase ref>`, `patreon-gems:<member>:<YYYY-MM>` (Brasília),
-- `play:<room>:<run>:<user>`, `buy:<user>:<cosmetic>`, `refund:stripe:<charge>:<refunded cents>`, `refund:abacatepay:<checkout>`,
-- `dispute:<provider>:<id>`, `dispute-won:<provider>:<id>`. `day`: the Brasília day of a play credit (the
-- daily cap counts by it). `user_id` goes null when the account is deleted: the payments' trail stays.
create table gem_ledger (
  id bigserial primary key,
  user_id text references users (id) on delete set null,
  amount integer not null check (amount <> 0),
  reason text not null check (reason in ('pack', 'patreon', 'play', 'buy', 'refund', 'dispute', 'disputeWon', 'grant')),
  ref text not null unique,
  day date,
  at timestamptz not null default now()
);

create index gem_ledger_user on gem_ledger (user_id, id desc);

create index gem_ledger_play on gem_ledger (user_id, day) where reason = 'play';

-- The balance, kept in step with the ledger in the same transaction (it may go negative after a refund of spent gems).
alter table users add column gems integer not null default 0;

-- The equipped Arena look (`Look`), as the account last set it; read back through what it owns.
alter table users add column arena_look jsonb not null default '{}';

-- Gem packs bought with money: opened at checkout (`ref`, the game's `?gems=<ref>`), paid by the webhook.
-- `payment`: what refunds and disputes name (Stripe's PaymentIntent, AbacatePay's checkout `bill_…`).
-- `taken_back`: gems refunds and disputes took from this pack so far. `state`: `open` until paid, `paid` (credited),
-- `mismatch` (the provider charged another amount or currency than `amount`/`currency`: held, never credited, for
-- support), `refunded`, `disputed`; `paid_amount`/`paid_currency`: what the provider said it charged. `user_id` goes
-- null when the account is deleted: the payment's record stays.
create table gem_purchases (
  ref uuid primary key,
  user_id text references users (id) on delete set null,
  pack text not null,
  gems integer not null check (gems > 0),
  provider text not null check (provider in ('stripe', 'abacatepay')),
  currency text not null,
  amount integer not null check (amount > 0),
  session text unique,
  payment text unique,
  taken_back integer not null default 0,
  state text not null default 'open' check (state in ('open', 'paid', 'mismatch', 'refunded', 'disputed')),
  paid_amount integer,
  paid_currency text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index gem_purchases_user on gem_purchases (user_id, created_at desc);

-- Cosmetics an account owns, one row each (`source` `buy`, or `gift` for one granted by hand or an event).
create table cosmetics_owned (
  user_id text not null references users (id) on delete cascade,
  cosmetic text not null,
  source text not null check (source in ('buy', 'gift')),
  at timestamptz not null default now(),
  primary key (user_id, cosmetic)
);

-- The gems a Patreon charge brings (`GEM_PATREON` by the pledge's tier), credited when the charge has an account.
alter table donations add column gems integer;

-- Like every table: RLS on and no grants for Supabase's Data API roles (they exist only on Supabase).
alter table gem_ledger enable row level security;
alter table gem_purchases enable row level security;
alter table cosmetics_owned enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table gem_ledger, gem_purchases, cosmetics_owned from anon;
    revoke all on sequence gem_ledger_id_seq from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table gem_ledger, gem_purchases, cosmetics_owned from authenticated;
    revoke all on sequence gem_ledger_id_seq from authenticated;
  end if;
end
$$;
