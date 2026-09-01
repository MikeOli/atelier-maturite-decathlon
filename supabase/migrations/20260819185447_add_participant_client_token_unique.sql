-- AC#3 requires the "one avatar per participant" guarantee at the DB level,
-- not just the UI. The existing unique(session_id, avatar_key) constraint
-- stops two participants sharing an avatar, but nothing stopped the same
-- client_token from inserting a second row (a second avatar) in the same
-- session.
alter table public.participants
  add constraint participants_session_id_client_token_key
  unique (session_id, client_token);
