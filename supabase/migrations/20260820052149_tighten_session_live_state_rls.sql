-- Code review fix (Story 3.3): the admin policy on `session_live_state` was
-- `for all` (select/insert/update/delete), but the app only ever inserts
-- (createSession) and updates (revealVotes) this table.
--   - `delete` was unnecessary attack surface: an admin token could delete
--     the live-state row and permanently break realtime for that session.
--   - Its `select` branch was dead code: the separate public
--     "Anyone can view live session state" policy (using (true)) already
--     permits every read, and permissive policies are OR-combined — so the
--     admin-scoped select never actually restricted anything, which could
--     mislead a future reader into thinking reads were ownership-scoped.
drop policy "Admins manage the live state of their own sessions" on public.session_live_state;

create policy "Admins insert the live state of their own sessions"
  on public.session_live_state
  for insert
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = session_live_state.session_id
        and s.admin_id = (select auth.uid())
    )
  );

create policy "Admins update the live state of their own sessions"
  on public.session_live_state
  for update
  using (
    exists (
      select 1 from public.sessions s
      where s.id = session_live_state.session_id
        and s.admin_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = session_live_state.session_id
        and s.admin_id = (select auth.uid())
    )
  );
