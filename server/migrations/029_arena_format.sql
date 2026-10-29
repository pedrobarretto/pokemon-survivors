-- The Arena's match formats (../src/data/arenaFormats.ts): 4v4 on the Vale ('standard', every match
-- before formats) and 3v3 on the Clareira ('quick', casual only). Kept beside `result` (where it rides
-- as `format` when it isn't the standard) for the history and for counting matches by format. Only
-- adds, with a default, so the previous API keeps working during a rollout.
alter table arena_matches add column format text not null default 'standard' check (format in ('standard', 'quick'));
