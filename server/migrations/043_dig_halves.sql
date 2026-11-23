-- The Escavação's Galar fossils come in halves (src/data/digTreasures.ts, `GALAR_PAIRS`): a half dug out waits in
-- the account's lab until its other half turns up, and the two restore one Pokémon. Only adds, so the previous API
-- keeps working during a rollout.
alter table dig_progress add column if not exists halves text[] not null default '{}';
