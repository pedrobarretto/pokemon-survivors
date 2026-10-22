-- Festival da Praça (src/festival.ts, src/game/festival.ts): the community ₽ pot. Only adds, so the previous API keeps working during a rollout.

-- One ₽ donation to a festival (`festival`: its id in src/data/festivals.ts), on the Brasília `day` it was made
-- (the daily cap counts per day). `held`: from a save with a wallet above FESTIVAL.heldWallet, it counts in the pot
-- only once an admin approves it. `voided`: an admin cancelled it (it never counts, and its ₽ stays spent).
create table festival_donations (
  id uuid primary key default gen_random_uuid(),
  festival text not null,
  user_id text not null references users (id) on delete cascade,
  amount integer not null check (amount > 0),
  day date not null,
  held boolean not null default false,
  voided boolean not null default false,
  created_at timestamptz not null default now()
);

-- The pot and the plaque (sums per festival), a player's day for the cap, and the admin's held list.
create index festival_donations_festival on festival_donations (festival, user_id) where not held and not voided;
create index festival_donations_user_day on festival_donations (user_id, day);
create index festival_donations_held on festival_donations (created_at) where held and not voided;

-- The plaque shows the player's @handle (the player's choice, like `supporter_public`).
alter table users add column donor_public boolean not null default true;

-- Like every table: RLS on and no grants for Supabase's Data API roles (they exist only on Supabase).
alter table festival_donations enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table festival_donations from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table festival_donations from authenticated;
  end if;
end
$$;
