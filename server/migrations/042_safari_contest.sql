-- The Zona Safári grows (src/realm/games/safari.rules.ts, server/src/safari.ts): the Concurso de Insetos,
-- day and night, and each habitat's Pokédex. Only adds, so the previous API keeps working during a rollout.

-- A session is a regular one or a contest entry (its own free entry a contest day, never one of the day's sessions),
-- and was played at a time of day taken from the player's clock (who's about, never the odds).
alter table safari_sessions add column if not exists mode text not null default 'safari';
alter table safari_sessions add column if not exists daypart text not null default 'day';
create index if not exists safari_sessions_mode_day on safari_sessions (user_id, mode, day);

-- Each habitat's Pokédex: the families an account caught there, with when it first did.
create table if not exists safari_dex (
  user_id text not null references users (id) on delete cascade,
  habitat text not null,
  family text not null,
  at timestamptz not null default now(),
  primary key (user_id, habitat, family)
);

-- The catches made before this table count.
insert into safari_dex (user_id, habitat, family)
select s.user_id, s.habitat, c->>'family'
from safari_sessions s, jsonb_array_elements(coalesce(s.state->'run'->'catches', '[]'::jsonb)) c
where c->>'family' is not null
on conflict do nothing;

-- The weeks whose contest prizes went out (once each; the gifts are keyed besides).
create table if not exists safari_contest_settled (
  week date primary key,
  at timestamptz not null default now()
);

-- Like every table: RLS on and no grants for Supabase's Data API roles (they exist only on Supabase).
alter table safari_dex enable row level security;
alter table safari_contest_settled enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table safari_dex, safari_contest_settled from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table safari_dex, safari_contest_settled from authenticated;
  end if;
end
$$;
