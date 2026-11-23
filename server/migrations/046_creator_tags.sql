-- The verified content creator's tag (CREATOR, src/net/creatorTag.ts, server/src/creators.ts): one request per
-- account, sent from the Trainer Card with the channel links (normalized `{ platform, url }[]`), reviewed by the admin.
-- A new request after a rejection or a revocation replaces the row. An approved row is what the Realm's identity,
-- the public profile and the Trainer Card show. Only adds, so the previous API keeps working during a rollout.
create table if not exists creator_requests (
  user_id text primary key references users (id) on delete cascade,
  links jsonb not null,
  status text not null check (status in ('pending', 'approved', 'rejected', 'revoked')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text references users (id) on delete set null
);

-- The desk's queue, oldest first.
create index if not exists creator_requests_pending on creator_requests (requested_at) where status = 'pending';

-- Like every table: RLS on and no grants for Supabase's Data API roles (they exist only on Supabase).
alter table creator_requests enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table creator_requests from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table creator_requests from authenticated;
  end if;
end
$$;
