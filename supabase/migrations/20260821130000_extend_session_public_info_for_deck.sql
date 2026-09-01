-- Story 3.10 (page de garde du board, FR44): the pre-session lobby needs
-- the deck's name and description (Story 1.7). Extends the existing public
-- view (pattern established in 20260819192108/20260820060720) with a join
-- on `decks` rather than opening any new RLS policy — `security_invoker =
-- false` already bypasses `decks`' admin-scoped RLS the same way it
-- bypasses `sessions`', so this is safe. Not sensitive data: same content
-- an admin already sees publicly-to-themselves on /admin/decks.
--
-- Security note (see 20260821110000_create_card_consensus.sql / Story 3.8
-- incident, 2026-08-21): never add `facilitator_token` or any other
-- sensitive column to this view. `deck_name`/`deck_description` are not
-- sensitive — this comment exists only to keep that lesson visible at the
-- next edit site.
create or replace view public.session_public_info
  with (security_invoker = false)
  as
  select
    s.id,
    s.team_name,
    s.status,
    s.current_card_id,
    s.votes_revealed,
    s.duration_minutes,
    s.created_at,
    d.name as deck_name,
    d.description as deck_description
  from public.sessions s
  join public.decks d on d.id = s.deck_id;
