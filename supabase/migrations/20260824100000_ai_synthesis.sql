-- Story 5.3 (FR20/FR50/FR51): AI-generated synthesis, produced when a
-- session ends ("Terminer la session", the renamed close action). Stored
-- as jsonb on `sessions` — 1:1 with the session, unlike `card_consensus`
-- which is 1:N per card, so a column is the right shape here, not a table.
-- null means "not generated yet or the AI call failed" (NFR8/NFR14): the
-- quantitative synthesis (Stories 5.1/5.2) never depends on this column.
alter table public.sessions
  add column ai_synthesis jsonb;

-- Facilitator-token-scoped equivalent of getSessionSynthesis (TS,
-- features/synthesis/actions.ts) — needed because the AI call must read
-- the same per-card consensus data whether the session is ended from the
-- admin desktop or the mobile pilotage screen (close_session_as_facilitator
-- below), and the facilitator screen has no admin-authenticated session to
-- query `sessions`/`cards`/`card_consensus` directly.
--
-- Replicates the exact eligibility rule from getSessionSynthesis: a card is
-- eligible if it comes before the current card (order_index), or IS the
-- current card and votes have been revealed. Never omits an eligible card
-- without a consensus value (left join, not inner join) — same
-- transparency requirement as Story 5.1 AC#2.
--
-- Also returns `transcript_draft` (repeated on every row, or as the sole
-- row's value when there are no eligible cards yet) — deliberately folded
-- into this same call rather than a second read via
-- get_session_by_facilitator_token: that function lives in the same TS
-- module as closeSessionAsFacilitator (features/sessions/actions.ts) and
-- can't be mocked independently of it in tests, whereas this function's TS
-- wrapper lives in features/synthesis/actions.ts and can be mocked as a
-- whole for closeSessionAsFacilitator's tests, same as the admin path's
-- getSessionSynthesis. One extra repeated text column is a trivial cost
-- for a handful of card rows.
create function public.get_session_synthesis_as_facilitator(
  p_session_id uuid,
  p_facilitator_token uuid
)
returns table (
  card_id uuid,
  title text,
  theme text,
  bullets jsonb,
  consensus_value integer,
  transcript_draft text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deck_id uuid;
  v_current_card_id uuid;
  v_votes_revealed boolean;
  v_current_order_index integer;
  v_transcript_draft text;
begin
  select deck_id, current_card_id, votes_revealed, sessions.transcript_draft
    into v_deck_id, v_current_card_id, v_votes_revealed, v_transcript_draft
  from public.sessions
  where id = p_session_id
    and facilitator_token = p_facilitator_token;

  if not found then
    raise exception 'invalid facilitator token' using errcode = 'FT001';
  end if;

  select c.order_index into v_current_order_index
  from public.cards c
  where c.id = v_current_card_id;

  -- Sentinel matches the TS side's Number.NEGATIVE_INFINITY reasoning: a
  -- very negative constant, not -1, so a real order_index of 0 or a
  -- negative value (no CHECK constraint prevents one) can never collide
  -- with "no current card yet".
  --
  -- The `union all` fallback row guarantees `transcript_draft` still comes
  -- through even when zero cards are eligible (e.g. transcription started
  -- before the first card, then closed immediately) — without it, `return
  -- query` on the plain `select` below would produce zero rows and the
  -- caller would silently lose the transcript along with the empty card
  -- list, even though a real transcript exists.
  return query
  select * from (
    select c.id, c.title, c.theme, c.bullets, cc.value, v_transcript_draft
    from public.cards c
    left join public.card_consensus cc
      on cc.session_id = p_session_id and cc.card_id = c.id
    where c.deck_id = v_deck_id
      and (
        c.order_index < coalesce(v_current_order_index, -2147483648)
        or (c.id = v_current_card_id and v_votes_revealed)
      )
    order by c.order_index
  ) eligible_cards
  union all
  select null, null, null, null, null, v_transcript_draft
  where not exists (
    select 1
    from public.cards c
    where c.deck_id = v_deck_id
      and (
        c.order_index < coalesce(v_current_order_index, -2147483648)
        or (c.id = v_current_card_id and v_votes_revealed)
      )
  );
end;
$$;

grant execute on function public.get_session_synthesis_as_facilitator(uuid, uuid) to anon, authenticated;

-- Adds an optional ai_synthesis parameter to the existing close action.
-- `create or replace` is enough here (unlike get_session_by_facilitator_token
-- in the transcription migration): adding a parameter with a default value
-- doesn't change the function's return type, only a `returns table` shape
-- change forces a `drop`+`create`.
--
-- coalesce(p_ai_synthesis, ai_synthesis) protects an already-stored result
-- from being wiped by null on a hypothetical retry after a failed AI call —
-- closing is otherwise idempotent (see closeSession's own doc comment) and
-- this keeps that property for the new column too.
create or replace function public.close_session_as_facilitator(
  p_session_id uuid,
  p_facilitator_token uuid,
  p_ai_synthesis jsonb default null
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
    set status = 'CLOTUREE',
      transcript_draft = null,
      transcription_enabled = false,
      ai_synthesis = coalesce(p_ai_synthesis, ai_synthesis)
    where id = p_session_id;
end;
$$;
