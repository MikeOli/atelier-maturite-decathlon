-- Bug found during manual verification of Story 3.2 (change vote before
-- reveal): PostgreSQL RLS requires SELECT-visibility of a row for ANY
-- UPDATE to touch it — not just for ON CONFLICT DO UPDATE as previously
-- diagnosed in Story 3.1's Debug Log. A plain `UPDATE ... WHERE ...`
-- appeared to succeed in manual SQL testing (no error was raised), but the
-- value never actually changed: RLS silently matched zero rows because the
-- restrictive SELECT policy ("Votes are readable once revealed") also
-- gates plain UPDATE visibility, not only SELECT. The "votes_update_before_reveal"
-- policy is consequently unusable by anon and is dropped.
--
-- Fix: a SECURITY DEFINER function is the standard way to allow a narrow,
-- validated write path when the same row must stay unreadable to the
-- writer's own role. It runs with the function owner's privileges,
-- bypassing RLS internally, while still enforcing the exact same rules
-- (participant ownership via client_token, current-card/not-revealed) in
-- plain SQL before writing anything.
drop policy "votes_update_before_reveal" on public.votes;

create function public.submit_vote(
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

grant execute on function public.submit_vote(uuid, uuid, uuid, uuid, integer)
  to anon, authenticated;

-- The INSERT policy stays as-is and keeps working standalone: unlike
-- UPDATE, a plain first-time INSERT (no ON CONFLICT) never needs to see an
-- existing row, so it never hit the SELECT-visibility problem described
-- above — confirmed in Story 3.1's manual testing. `submit_vote()` uses it
-- too (running as the function owner bypasses it anyway), but a direct
-- first vote via the anon key alone would still work fine without the
-- function. Only the conflict/update path needed this fix.
