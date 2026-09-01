-- Story 4.8 (session clôturée consultable en lecture seule, FR39): audit
-- found that submit_vote never checked sessions.status — only
-- votes_revealed/current_card_id. A vote could still be recorded on a
-- CLOTUREE session as long as the active card hadn't been revealed before
-- closure. Recreating the function with the same body plus one extra
-- condition and a distinct error code (VT004, kept separate from VT002 so
-- the client-facing message is specific to "session closed" rather than
-- the generic "voting closed for this card").

create or replace function public.submit_vote(
  p_session_id uuid,
  p_card_id uuid,
  p_participant_id uuid,
  p_client_token uuid,
  p_value integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.participants
    where id = p_participant_id
      and session_id = p_session_id
      and client_token = p_client_token
  ) then
    raise exception 'invalid participant' using errcode = 'VT001';
  end if;

  if exists (
    select 1 from public.sessions
    where id = p_session_id
      and status = 'CLOTUREE'
  ) then
    raise exception 'session is closed' using errcode = 'VT004';
  end if;

  if not exists (
    select 1 from public.sessions
    where id = p_session_id
      and votes_revealed = false
      and current_card_id = p_card_id
  ) then
    raise exception 'voting closed for this card' using errcode = 'VT002';
  end if;

  if p_value not in (0, 1, 2, 3, 5, 8, 13, 21) then
    raise exception 'invalid vote value' using errcode = 'VT003';
  end if;

  insert into public.votes (session_id, card_id, participant_id, value)
  values (p_session_id, p_card_id, p_participant_id, p_value)
  on conflict (session_id, card_id, participant_id)
  do update set value = excluded.value, updated_at = now();
end;
$$;

-- Code review finding: submit_vote() is NOT the only write path to `votes`.
-- The table's own INSERT policy ("Participants can vote on the current
-- card before reveal", 20260819192108_extend_session_public_info_for_voting.sql)
-- independently allows a direct INSERT via the anon key — completely
-- bypassing submit_vote() and the VT004 check above — and it never checked
-- `status` either. Extending it with the same condition; `status` is
-- already exposed by `session_public_info`, no new column/view needed.
drop policy "Participants can vote on the current card before reveal" on public.votes;
create policy "Participants can vote on the current card before reveal"
  on public.votes
  for insert
  with check (
    exists (
      select 1 from public.session_public_info s
      where s.id = votes.session_id
        and s.status = 'EN_COURS'
        and s.votes_revealed = false
        and s.current_card_id = votes.card_id
    )
  );
