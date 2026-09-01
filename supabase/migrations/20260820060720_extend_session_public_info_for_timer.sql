-- Story 3.5 (timer de time-boxing): the timer is a pure client-side
-- computation from `created_at` + `duration_minutes`, needed by both the
-- admin (already has direct table access) and participants (public,
-- RLS-restricted). Extend the existing public view (pattern established in
-- 20260819192108_extend_session_public_info_for_voting.sql) rather than
-- opening any new RLS policy on `sessions` itself.
create or replace view public.session_public_info
  with (security_invoker = false)
  as
  select id, team_name, status, current_card_id, votes_revealed, duration_minutes, created_at
  from public.sessions;
