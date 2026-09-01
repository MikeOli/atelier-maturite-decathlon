-- Story 4.3 (pilotage mobile du facilitateur): `/facilitate/[code]` must stay
-- public (see lib/supabase/proxy.ts comment, predating this migration) — the
-- facilitator does not log into Supabase Auth on their phone. `revealVotes`/
-- `goToNextCard` (Stories 3.3/3.4) require an authenticated admin session and
-- rely on the `admin_id = auth.uid()` RLS policy, so they're unusable from an
-- anonymous page. This introduces a second, narrowly-scoped authority model:
-- a per-session bearer secret (`facilitator_token`, same trust family as
-- participants' `client_token`), verified inside SECURITY DEFINER functions —
-- same pattern as `submit_vote`/`get_my_vote`, not a new public RLS policy.

alter table public.sessions
  add column facilitator_token uuid not null default gen_random_uuid();

create unique index sessions_facilitator_token_idx
  on public.sessions(facilitator_token);

-- `session_public_info` is granted `select` to `anon`/`authenticated` on the
-- WHOLE view by default (Story 2.1's
-- `grant select on public.session_public_info to anon, authenticated`), and
-- Postgres views can't drop a column via `create or replace view` once
-- added — so `facilitator_token` must never be added as a plain column on
-- this view: it would let any anonymous caller read every session's token
-- directly via PostgREST (`?select=facilitator_token`), regardless of what
-- the app's own `.select()` calls choose to request. That's the exact class
-- of bug Story 2.1 already fixed once for this same view (see
-- 20260819182714_restrict_public_session_read_to_view.sql: "restricting the
-- app-layer .select() ... gave no real protection against direct table
-- access with the anon key"). Token lookup instead goes through a
-- SECURITY DEFINER function below that takes the token as input and returns
-- only the safe public fields — the token itself is only ever a lookup key,
-- never a selectable/returned column anywhere anon/authenticated can reach.
create function public.get_session_by_facilitator_token(
  p_facilitator_token uuid
)
returns table (
  id uuid,
  team_name text,
  status text,
  duration_minutes integer,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select s.id, s.team_name, s.status, s.duration_minutes, s.created_at
  from public.sessions s
  where s.facilitator_token = p_facilitator_token;
$$;

grant execute on function public.get_session_by_facilitator_token(uuid)
  to anon, authenticated;

revoke execute on function public.get_session_by_facilitator_token(uuid)
  from public;

create function public.reveal_votes_as_facilitator(
  p_session_id uuid,
  p_facilitator_token uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.sessions
    where id = p_session_id
      and facilitator_token = p_facilitator_token
  ) then
    raise exception 'invalid facilitator token' using errcode = 'FT001';
  end if;

  update public.sessions
    set votes_revealed = true
    where id = p_session_id;

  update public.session_live_state
    set votes_revealed = true, updated_at = now()
    where session_id = p_session_id;
end;
$$;

-- Same business rules as goToNextCard (Story 3.4), re-expressed in SQL:
-- reject if votes aren't revealed yet for the current card, resolve the next
-- card by order_index within the same deck, update both sessions and
-- session_live_state. Returns null (not an exception) when there's no next
-- card — end of deck is a normal state, not an error. FT001 (bad token) and
-- FT003 (no active/current card) are kept as distinct checks rather than
-- one combined branch — a valid facilitator on a not-yet-started session
-- would otherwise see "lien de pilotage invalide" for a link that's fine.
create function public.go_to_next_card_as_facilitator(
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

  -- If the current card row itself is gone (shouldn't happen — cards are
  -- never deleted — but current_card_id has no cascade/restrict guarantee
  -- against it), NULL > NULL is never true, so the next query would
  -- silently look like "no next card" instead of surfacing the real
  -- problem.
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

grant execute on function public.reveal_votes_as_facilitator(uuid, uuid)
  to anon, authenticated;
grant execute on function public.go_to_next_card_as_facilitator(uuid, uuid)
  to anon, authenticated;

revoke execute on function public.reveal_votes_as_facilitator(uuid, uuid)
  from public;
revoke execute on function public.go_to_next_card_as_facilitator(uuid, uuid)
  from public;
