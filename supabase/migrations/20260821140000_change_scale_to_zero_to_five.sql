-- Story 3.11 (FR46): replaces the Fibonacci scale (0,1,2,3,5,8,13,21) with
-- a 0-5 maturity scale — decided with Mary (2026-08-21): Fibonacci was too
-- spread out at the high end for a maturity assessment (this isn't effort
-- estimation), and 0-5 gives an intuitive "out of 5" theme average.
--
-- Existing votes/card_consensus rows use the old scale and would violate
-- the new constraint — user-confirmed decision (2026-08-21): delete them
-- rather than remap, since the tool has no real usage yet (test sessions
-- only, per the product brief).
delete from public.votes;
delete from public.card_consensus;

alter table public.votes
  drop constraint votes_value_check,
  add constraint votes_value_check check (value in (0, 1, 2, 3, 4, 5));

alter table public.card_consensus
  drop constraint card_consensus_value_check,
  add constraint card_consensus_value_check check (value in (0, 1, 2, 3, 4, 5));

-- Recreated from the last live version (20260820202517_submit_vote_reject_closed_session.sql)
-- — VT001/VT004/VT002 unchanged, only the VT003 value list changes.
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

  if p_value not in (0, 1, 2, 3, 4, 5) then
    raise exception 'invalid vote value' using errcode = 'VT003';
  end if;

  insert into public.votes (session_id, card_id, participant_id, value)
  values (p_session_id, p_card_id, p_participant_id, p_value)
  on conflict (session_id, card_id, participant_id)
  do update set value = excluded.value, updated_at = now();
end;
$$;
