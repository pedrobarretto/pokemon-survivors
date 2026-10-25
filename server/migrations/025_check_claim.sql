-- The verifier (`ROLE=checks`, server/src/checks.ts) pulls the runs to check from this table instead of an in-memory queue:
-- it claims the next pending run (`check_claimed_at`, in `check_rank` order, `for update skip locked`), so two verifiers side by
-- side in a rollout never take the same run, and a claim left by a verifier that died runs out after a while (`CHECK_LOOP.leaseSeconds`).
-- `check_attempts` counts the claims: a run whose check never finishes (a replay that crashes the worker) loses its replay after
-- `CHECK_LOOP.attempts` instead of costing a crash every lease. A new report of the run (endless mode) clears both. Only adds,
-- so the previous API keeps working during a rollout; new columns of `runs` keep the table's RLS, and `anon`/`authenticated`
-- still have no grants on them.
alter table runs add column check_claimed_at timestamptz;
alter table runs add column check_attempts smallint not null default 0;
