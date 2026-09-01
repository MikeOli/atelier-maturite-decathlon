-- Bug found in production: "Démarrer l'atelier" on the mobile pilotage
-- screen (/facilitate/[code]) reused `StartSessionButton`, which calls
-- `startSession` — an admin-auth action (`supabase.auth.getClaims()`). The
-- facilitator-token page has no Supabase Auth session, so it always failed
-- with "Session admin invalide.". Same gap `reveal_votes_as_facilitator`/
-- `go_to_next_card_as_facilitator`/`set_card_consensus_as_facilitator`
-- (Stories 4.3/4.7) already closed for reveal/next-card/consensus — this
-- closes it for start (and, further down, for close — same bug, same
-- reused-admin-only-button root cause). Same pattern: SECURITY DEFINER
-- function verifying `facilitator_token` itself, mirroring `startSession`'s
-- TS logic (features/sessions/actions.ts) exactly — first card = lowest
-- order_index for the deck, same as `go_to_next_card_as_facilitator`'s
-- "next card" query with `v_current_order = 0`.

create function public.start_session_as_facilitator(
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
  v_status text;
  v_first_card_id uuid;
begin
  select deck_id, current_card_id, status
    into v_deck_id, v_current_card_id, v_status
  from public.sessions
  where id = p_session_id
    and facilitator_token = p_facilitator_token;

  if not found then
    raise exception 'invalid facilitator token' using errcode = 'FT001';
  end if;

  if v_status = 'CLOTUREE' then
    raise exception 'session is closed' using errcode = 'FT004';
  end if;

  if v_current_card_id is not null then
    raise exception 'session already started' using errcode = 'FT007';
  end if;

  select id into v_first_card_id
  from public.cards
  where deck_id = v_deck_id
    and order_index > 0
  order by order_index asc
  limit 1;

  if v_first_card_id is null then
    raise exception 'deck has no cards' using errcode = 'FT008';
  end if;

  update public.sessions
    set current_card_id = v_first_card_id
    where id = p_session_id;

  update public.session_live_state
    set current_card_id = v_first_card_id, votes_revealed = false, updated_at = now()
    where session_id = p_session_id;

  return v_first_card_id;
end;
$$;

grant execute on function public.start_session_as_facilitator(uuid, uuid)
  to anon, authenticated;

revoke execute on function public.start_session_as_facilitator(uuid, uuid)
  from public;

-- Same bug, same fix, for "Clôturer l'atelier": `CloseSessionButton` on the
-- mobile pilotage screen calls `closeSession` (admin-auth only) — never
-- worked from `/facilitate/[code]` either. Mirrors `closeSession`'s TS
-- logic exactly, including the "consensus required before closing" guard
-- (Story 3.8 code review fix) — only enforced when votes are already
-- revealed for the current card. Idempotent by construction, same as the
-- TS version: closing an already-CLOTUREE session is a no-op update, not
-- an error.
create function public.close_session_as_facilitator(
  p_session_id uuid,
  p_facilitator_token uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_card_id uuid;
  v_votes_revealed boolean;
  v_has_consensus boolean;
begin
  select current_card_id, votes_revealed
    into v_current_card_id, v_votes_revealed
  from public.sessions
  where id = p_session_id
    and facilitator_token = p_facilitator_token;

  if not found then
    raise exception 'invalid facilitator token' using errcode = 'FT001';
  end if;

  if v_votes_revealed and v_current_card_id is not null then
    select exists (
      select 1 from public.card_consensus
      where session_id = p_session_id
        and card_id = v_current_card_id
    ) into v_has_consensus;

    if not v_has_consensus then
      raise exception 'consensus required before closing' using errcode = 'FT009';
    end if;
  end if;

  update public.sessions
    set status = 'CLOTUREE'
    where id = p_session_id;
end;
$$;

grant execute on function public.close_session_as_facilitator(uuid, uuid)
  to anon, authenticated;

revoke execute on function public.close_session_as_facilitator(uuid, uuid)
  from public;
