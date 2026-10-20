-- Creators live now (src/creators.ts; who they are lives in the game's src/data/creators.ts). Only adds, so the previous API keeps working during a rollout.

-- One row per creator who went live; it reads as live while `until` is ahead.
-- `started_at`: when this stream began (going live again while live keeps it, for the Discord post's key).
create table creator_live (
  creator text primary key,
  started_at timestamptz not null default now(),
  until timestamptz not null
);
