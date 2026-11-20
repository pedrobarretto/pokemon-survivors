-- The loadout fields (`LoadoutField` in src/game/loadoutBacking.ts) a ranked run brought that the account's stored
-- save didn't back when the verifier checked it (`unbackedLoadout`, `checks.ts`), once the save had had time to catch
-- up. Such a run is also `unlisted`: it stays the player's, off the public boards. Null for every other run. Only adds,
-- so the previous API and verifier keep working during a rollout.
alter table runs add column if not exists unbacked text[];
