-- The game build that last pushed each save (`Stored.build` in ../src/game/sync.ts: its commit's time in Unix
-- seconds, `__GAME_BUILT__`), so a push from an older build, which can't read everything a newer one stored, is
-- merged instead of replacing the save. Null until a build that sends it pushes. Only adds, so the previous API
-- keeps working during a rollout.
alter table saves add column if not exists build bigint;
