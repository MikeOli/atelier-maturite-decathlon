-- Code review fix (Story 2.1): the previous public RLS policy
-- ("Anyone can view sessions to join", for select using (true)) granted
-- public read on every column of `sessions` — RLS is row-level, not
-- column-level, so restricting the app-layer .select() to a few fields gave
-- no real protection against direct table access with the anon key.
--
-- Replaced with a narrow public view exposing only the fields participants
-- actually need (id, team_name, status). The view is not itself RLS-enabled
-- and is owned by the migration role, so it bypasses the base table's
-- admin-only RLS policy by design — this is the standard Supabase pattern
-- for exposing a safe public subset of a locked-down table.

drop policy if exists "Anyone can view sessions to join" on public.sessions;

create view public.session_public_info
  with (security_invoker = false)
  as
  select id, team_name, status
  from public.sessions;

grant select on public.session_public_info to anon, authenticated;
