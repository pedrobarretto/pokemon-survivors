-- Friends: mutual follows, found by handle. Only adds, so the previous API keeps working during a rollout.

-- `/players?q=` searches handles by prefix (`handle like 'ab%'`). The unique
-- index on `handle` only serves that under the C collation; this one always does.
create index users_handle_prefix on users (handle text_pattern_ops);
