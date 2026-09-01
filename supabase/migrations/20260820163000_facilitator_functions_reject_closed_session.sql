-- Story 4.5 (clôture manuelle de session): once `closeSession` can set
-- `sessions.status = 'CLOTUREE'`, the facilitator-token functions (Story 4.3)
-- must reject action on a closed session — same guard added in TypeScript to
-- `revealVotes`/`goToNextCard` (Story 4.5). Recreating both functions with
-- their existing bodies plus a new status check; grants are unaffected by
-- `create or replace function` and don't need to be re-issued.

create or replace function public.reveal_votes_as_facilitator(
  p_session_id uuid,
  p_facilitator_token uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status
  from public.sessions
  where id = p_session_id
    and facilitator_token = p_facilitator_token;

  if not found then
    raise exception 'invalid facilitator token' using errcode = 'FT001';
  end if;

  if v_status = 'CLOTUREE' then
    raise exception 'session is closed' using errcode = 'FT004';
  end if;

  update public.sessions
    set votes_revealed = true
    where id = p_session_id;

  update public.session_live_state
    set votes_revealed = true, updated_at = now()
    where session_id = p_session_id;
end;
$$;

create or replace function public.go_to_next_card_as_facilitator(
  p_session_id uuid,
  p_facilitator_token uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deck_id uuid;
  v_current_card_id uuid;
  v_votes_revealed boolean;
  v_status text;
  v_current_order integer;
  v_next_card_id uuid;
begin
  select deck_id, current_card_id, votes_revealed, status
    into v_deck_id, v_current_card_id, v_votes_revealed, v_status
  from public.sessions
  where id = p_session_id
    and facilitator_token = p_facilitator_token;

  if not found then
    raise exception 'invalid facilitator token' using errcode = 'FT001';
  end if;

  if v_status = 'CLOTUREE' then
    raise exception 'session is closed' using errcode = 'FT004';
  end if;

  if v_current_card_id is null then
    raise exception 'no active card for this session' using errcode = 'FT003';
  end if;

  if not v_votes_revealed then
    raise exception 'votes not revealed for current card' using errcode = 'FT002';
  end if;

  select order_index into v_current_order
  from public.cards
  where id = v_current_card_id;

  if not found then
    raise exception 'current card not found' using errcode = 'FT003';
  end if;

  select id into v_next_card_id
  from public.cards
  where deck_id = v_deck_id
    and order_index > v_current_order
  order by order_index asc
  limit 1;

  if v_next_card_id is null then
    return null;
  end if;

  update public.sessions
    set current_card_id = v_next_card_id, votes_revealed = false
    where id = p_session_id;

  update public.session_live_state
    set current_card_id = v_next_card_id, votes_revealed = false, updated_at = now()
    where session_id = p_session_id;

  return v_next_card_id;
end;
$$;
