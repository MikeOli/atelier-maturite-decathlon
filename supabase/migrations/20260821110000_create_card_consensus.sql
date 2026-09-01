-- Story 3.8 (FR41): the facilitator enters the team's agreed value for the
-- current card after debate — not a re-vote/unanimity mechanism, the
-- facilitator decides. This must be a separate table, not a column on
-- `session_live_state`: that table only mirrors the *current* card, and
-- goToNextCard overwrites it — Epic 5's synthesis needs the consensus value
-- for every past card, same historical-persistence need as `votes`
-- (scoped by card_id, never overwritten when advancing).

create table public.card_consensus (
  session_id uuid not null references public.sessions(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  value integer not null check (value in (0, 1, 2, 3, 5, 8, 13, 21)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (session_id, card_id)
);

alter table public.card_consensus enable row level security;

-- Not sensitive like hidden individual votes (Story 3.1) — it's the team's
-- own final, assumed-public result for the card, not something requiring
-- anonymity. Same "narrow but public" posture as `session_current_card`/
-- `session_public_info`.
create policy "Card consensus is publicly readable"
  on public.card_consensus
  for select
  using (true);

-- Admin write path (authenticated Supabase session, RLS-scoped) — same
-- pattern as the admin-scoped policy added on `votes` for Story 5.1
-- (20260820210437_admin_votes_select_policy.sql).
create policy "Admins can set consensus on their own sessions"
  on public.card_consensus
  for insert
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = card_consensus.session_id
        and s.admin_id = (select auth.uid())
    )
  );

create policy "Admins can update consensus on their own sessions"
  on public.card_consensus
  for update
  using (
    exists (
      select 1 from public.sessions s
      where s.id = card_consensus.session_id
        and s.admin_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = card_consensus.session_id
        and s.admin_id = (select auth.uid())
    )
  );

-- Facilitator write path (anonymous, bearer `facilitator_token`) — same
-- SECURITY DEFINER pattern as `reveal_votes_as_facilitator`/
-- `go_to_next_card_as_facilitator` (20260820122306). Upserts on the table's
-- own primary key rather than a separate unique constraint.
--
-- Code review fix (2026-08-21): the first version of this function didn't
-- check `status`, unlike every sibling write path (`goToNextCard`,
-- `revealVotes`, `reveal_votes_as_facilitator`) — a lingering facilitator
-- tab could silently overwrite consensus on a session the admin already
-- closed. Added the same FT004 guard, same ordering as
-- `reveal_votes_as_facilitator`. Also added: a check that `p_card_id`
-- actually matches the session's current card, mirroring `submit_vote`'s
-- own check for votes (VT002) — without it a stale client could record an
-- "accord" against a card no longer being discussed. FT006 is the next
-- available code in the facilitator error family.
create or replace function public.set_card_consensus_as_facilitator(
  p_session_id uuid,
  p_facilitator_token uuid,
  p_card_id uuid,
  p_value integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_current_card_id uuid;
begin
  select status, current_card_id into v_status, v_current_card_id
  from public.sessions
  where id = p_session_id
    and facilitator_token = p_facilitator_token;

  if not found then
    raise exception 'invalid facilitator token' using errcode = 'FT001';
  end if;

  if v_status = 'CLOTUREE' then
    raise exception 'session is closed' using errcode = 'FT004';
  end if;

  if v_current_card_id is distinct from p_card_id then
    raise exception 'card is not the current card' using errcode = 'FT006';
  end if;

  insert into public.card_consensus (session_id, card_id, value)
    values (p_session_id, p_card_id, p_value)
  on conflict (session_id, card_id)
    do update set value = excluded.value, updated_at = now();
end;
$$;

grant execute on function public.set_card_consensus_as_facilitator(uuid, uuid, uuid, integer)
  to anon, authenticated;

revoke execute on function public.set_card_consensus_as_facilitator(uuid, uuid, uuid, integer)
  from public;

-- Extend go_to_next_card_as_facilitator (originally defined in
-- 20260819191449_add_votes_and_current_card_view.sql, then given a status
-- guard in 20260820163000_facilitator_functions_reject_closed_session.sql)
-- with the same gate Story 3.8 adds to the TS-side goToNextCard: block
-- advancing past a card with no consensus value recorded yet. FT005 is the
-- next available code in the facilitator error family (FT001 bad token,
-- FT002 votes not revealed, FT003 no active card, FT004 session closed).
--
-- Code review fix (2026-08-21): the first version of this migration rebuilt
-- this function from the 20260819191449 body and dropped the FT004/status
-- check that 20260820163000 had added — `create or replace function`
-- replaces the ENTIRE body, so omitting a check here silently regresses it.
-- Restored below (v_status/CLOTUREE check), placed right after the token
-- check, matching 20260820163000's ordering.
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

  if not exists (
    select 1 from public.card_consensus
    where session_id = p_session_id
      and card_id = v_current_card_id
  ) then
    raise exception 'card consensus value not set' using errcode = 'FT005';
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
