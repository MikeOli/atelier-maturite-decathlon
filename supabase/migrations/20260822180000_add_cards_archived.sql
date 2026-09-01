-- Story 6.6 (suppression d'une carte, FR47): "suppression" = archivage, pas
-- un DELETE physique. votes.card_id/card_consensus.card_id sont en
-- `on delete cascade` vers cards — un vrai DELETE effacerait l'historique de
-- synthèse des sessions passées. L'archivage exclut la carte des futurs
-- tirages sans jamais toucher aux lignes déjà écrites.
--
-- Décision actée avec l'utilisateur (2026-08-22): archiver une carte qui est
-- current_card_id d'une session EN_COURS est toujours autorisé, sans
-- blocage ni vérification préalable — la session en cours garde sa
-- référence et continue d'afficher normalement cette carte jusqu'à la
-- prochaine navigation. Seuls les futurs tirages l'excluent.

alter table public.cards
  add column archived boolean not null default false;

-- No new RLS policy needed: "Admins manage cards of their own decks" is
-- `for all`, already covering UPDATE of this new column like any other.

-- Re-expressed with `and archived = false` added to the next-card query.
-- Body otherwise identical to
-- 20260820122306_facilitator_token_security_definer.sql — keep in sync with
-- findNextCardId (features/sessions/actions.ts) and
-- start_session_as_facilitator below; all three resolve "next/first card by
-- order_index within the deck" and must never drift apart.
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
  v_current_order integer;
  v_next_card_id uuid;
begin
  select deck_id, current_card_id, votes_revealed
    into v_deck_id, v_current_card_id, v_votes_revealed
  from public.sessions
  where id = p_session_id
    and facilitator_token = p_facilitator_token;

  if not found then
    raise exception 'invalid facilitator token' using errcode = 'FT001';
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
    and archived = false
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

-- Re-expressed with `and archived = false` added to the first-card query.
-- Body otherwise identical to 20260822074014_start_session_as_facilitator.sql.
create or replace function public.start_session_as_facilitator(
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
    and archived = false
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
