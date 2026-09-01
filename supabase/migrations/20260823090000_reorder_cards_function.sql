-- Drag-and-drop card reordering: N independent .update() calls from the
-- app (one per card) share no transaction — a partial failure leaves
-- order_index scrambled with no way for the client to detect or undo it.
-- A single UPDATE statement is atomic by construction. This function also
-- validates that p_card_ids is exactly the deck's current set of active
-- cards (no subset, no duplicate, no foreign card) before writing anything
-- — a stale client-side list (card added/archived without resync) must
-- never be allowed to silently produce duplicate or missing order_index
-- values.
--
-- Deliberately NOT security definer: this runs as the calling admin, so
-- the existing RLS policy ("Admins manage cards of their own decks")
-- still scopes every read and write here to the admin's own decks —
-- same trust model as the plain .update() calls it replaces.
create function public.reorder_cards(
  p_deck_id uuid,
  p_card_ids uuid[]
)
returns void
language plpgsql
as $$
declare
  v_expected_count integer;
  v_provided_count integer;
  v_distinct_count integer;
  v_missing_count integer;
begin
  select count(*) into v_expected_count
  from public.cards
  where deck_id = p_deck_id
    and archived = false;

  v_provided_count := coalesce(array_length(p_card_ids, 1), 0);

  select count(distinct id) into v_distinct_count
  from unnest(p_card_ids) as id;

  if v_provided_count = 0
    or v_provided_count != v_expected_count
    or v_distinct_count != v_provided_count
  then
    raise exception 'card set does not match the deck''s active cards' using errcode = 'CR001';
  end if;

  select count(*) into v_missing_count
  from unnest(p_card_ids) as provided(id)
  where not exists (
    select 1 from public.cards
    where cards.id = provided.id
      and cards.deck_id = p_deck_id
      and cards.archived = false
  );

  if v_missing_count > 0 then
    raise exception 'card set does not match the deck''s active cards' using errcode = 'CR001';
  end if;

  -- Re-checks archived = false here too, not just in the validation above:
  -- under READ COMMITTED, a concurrent transaction could archive one of
  -- these cards between the validation queries and this statement. Without
  -- this filter that card would still get a fresh order_index written to
  -- it despite having just been excluded from the deck.
  update public.cards c
  set order_index = t.pos
  from unnest(p_card_ids) with ordinality as t(id, pos)
  where c.id = t.id
    and c.deck_id = p_deck_id
    and c.archived = false;
end;
$$;

grant execute on function public.reorder_cards(uuid, uuid[])
  to authenticated;

revoke execute on function public.reorder_cards(uuid, uuid[])
  from public;
