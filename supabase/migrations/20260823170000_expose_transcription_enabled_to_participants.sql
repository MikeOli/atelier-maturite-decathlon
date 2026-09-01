-- Story 5.6 (consentement des participants à la transcription, FR49):
-- participants need to know whether a session has live transcription
-- enabled (Story 5.5) before joining, so the consent banner in
-- AvatarPicker can decide whether to show. `transcription_enabled` is a
-- plain boolean, not sensitive — safe to expose on this public view.
--
-- Security note (see 20260821110000_create_card_consensus.sql / Story 3.8
-- incident, 2026-08-21, and 20260821130000_extend_session_public_info_for_deck.sql):
-- never add `facilitator_token` or any other sensitive column to this
-- view. `transcript_draft` (the accumulated, not-yet-anonymized text) is
-- exactly that kind of column — it must NEVER be added here, only
-- `transcription_enabled` is safe. `create or replace view` can add a
-- column freely (unlike a function's `returns table`, which Postgres
-- refuses to change without a `drop` — see the previous migration for
-- that exact issue on `get_session_by_facilitator_token`).
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
    d.description as deck_description,
    s.transcription_enabled
  from public.sessions s
  join public.decks d on d.id = s.deck_id;
