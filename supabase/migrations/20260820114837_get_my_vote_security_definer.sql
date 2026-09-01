-- Story 4.1 (reconnexion sans perte de vote): the RLS "Votes are readable
-- once revealed" policy (Story 3.1) blocks SELECT on `votes` for anyone,
-- including the voter themselves, before revelation. Restoring a
-- participant's own already-submitted vote after a reload/reconnect
-- therefore needs the same SECURITY DEFINER escape hatch already used by
-- `submit_vote` (Story 3.2) — a narrow, ownership-checked function, not a
-- new public SELECT policy on `votes`.
create function public.get_my_vote(
  p_session_id uuid,
  p_card_id uuid,
  p_participant_id uuid,
  p_client_token uuid
)
returns integer
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_value integer;
begin
  if not exists (
    select 1 from public.participants
    where id = p_participant_id
      and session_id = p_session_id
      and client_token = p_client_token
  ) then
    raise exception 'invalid participant' using errcode = 'VT001';
  end if;

  select value into v_value
  from public.votes
  where session_id = p_session_id
    and card_id = p_card_id
    and participant_id = p_participant_id;

  return v_value;
end;
$$;

-- Grant to the roles that need it, then revoke the default PUBLIC grant —
-- in that order, in this same migration. Story 3.2 left this as a
-- follow-up review fix (20260819195150_revoke_public_execute_submit_vote.sql)
-- because Postgres grants EXECUTE to PUBLIC by default on function
-- creation; doing it upfront here avoids repeating that gap.
grant execute on function public.get_my_vote(uuid, uuid, uuid, uuid)
  to anon, authenticated;

revoke execute on function public.get_my_vote(uuid, uuid, uuid, uuid)
  from public;
