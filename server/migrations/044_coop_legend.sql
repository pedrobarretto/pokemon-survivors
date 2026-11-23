-- Co-op Legend runs (src/coopBoards.ts, rules in ../src/game/coopBoard.ts): a run room played in the Legend mode, every
-- seat a captured legend the API vouched for, goes on the boards' Lendário side (`GET /coop/boards/:difficulty?mode=legend`),
-- each team's best run apart from its regular ones; never on a Desafio co-op do dia's board. Only adds, so the previous
-- API keeps working during a rollout (its runs land as regular ones, which they are).
alter table coop_runs add column if not exists legend boolean not null default false;

-- The Lendário side's boards, as `coop_runs_board` serves the regular side's.
create index if not exists coop_runs_legend_board on coop_runs (size, difficulty, team, survived desc, ended_at) where challenge is null and legend;
