-- Bug found during manual verification of Story 3.1: the votes RLS policies
-- (previous migration) checked `sessions.votes_revealed` /
-- `sessions.current_card_id` via a subquery against the raw `sessions`
-- table. But `anon` has no SELECT grant on `sessions` itself (Story 2.1
-- dropped that broad policy in favor of the `session_public_info` view) —
-- so the subquery always saw zero rows and every vote insert was silently
-- rejected by RLS.
--
-- Fix: extend `session_public_info` (security_invoker = false, so it reads
-- `sessions` with the view owner's privileges regardless of the caller's
-- RLS) with the two columns voting needs, and point the votes policies at
-- the view instead of the table.
create or replace view public.session_public_info
  with (security_invoker = false)
  as
  select id, team_name, status, current_card_id, votes_revealed
  from public.sessions;

drop policy "Votes are readable once revealed" on public.votes;
create policy "Votes are readable once revealed"
  on public.votes
  for select
  using (
    exists (
      select 1 from public.session_public_info s
      where s.id = votes.session_id
        and s.votes_revealed = true
    )
  );

drop policy "Participants can vote on the current card before reveal" on public.votes;
create policy "Participants can vote on the current card before reveal"
  on public.votes
  for insert
  with check (
    exists (
      select 1 from public.session_public_info s
      where s.id = votes.session_id
        and s.votes_revealed = false
        and s.current_card_id = votes.card_id
    )
  );

drop policy "Participants can update their vote on the current card before r" on public.votes;
create policy "Participants can update their vote on the current card before r"
  on public.votes
  for update
  using (
    exists (
      select 1 from public.session_public_info s
      where s.id = votes.session_id
        and s.votes_revealed = false
        and s.current_card_id = votes.card_id
    )
  )
  with check (
    exists (
      select 1 from public.session_public_info s
      where s.id = votes.session_id
        and s.votes_revealed = false
        and s.current_card_id = votes.card_id
    )
  );
