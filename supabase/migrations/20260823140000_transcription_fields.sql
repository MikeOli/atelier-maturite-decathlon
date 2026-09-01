-- Story 5.5 (transcription live de la discussion par le facilitateur):
-- pivot acté après revue de faisabilité — pas d'audio (Vercel plafonne tout
-- payload de Server Action à 4,5 Mo, non contournable, largement
-- insuffisant pour 1-2h d'audio), une transcription texte produite
-- entièrement côté navigateur du facilitateur (Web Speech API). Le texte
-- accumulé est synchronisé périodiquement pour la résilience (page
-- rechargée en cours de session), puis effacé à la clôture — jamais
-- conservé au-delà de la session (NFR15).

alter table public.sessions
  add column transcription_enabled boolean not null default false;

alter table public.sessions
  add column transcript_draft text;

-- No new RLS policy needed for the admin: the existing `for all` policy on
-- `sessions` (scoped by admin_id = auth.uid()) already covers UPDATE of
-- these two new columns like any other.

-- Re-expressed with transcription_enabled/transcript_draft added to the
-- returned columns. Postgres won't let `create or replace function` change
-- a function's return type (adding output columns counts as a change), so
-- the old signature must be dropped first — grants are re-applied below
-- since dropping a function drops its grants too. Body otherwise identical
-- to 20260820122306_facilitator_token_security_definer.sql.
drop function public.get_session_by_facilitator_token(uuid);

create function public.get_session_by_facilitator_token(
  p_facilitator_token uuid
)
returns table (
  id uuid,
  team_name text,
  status text,
  duration_minutes integer,
  created_at timestamptz,
  transcription_enabled boolean,
  transcript_draft text
)
language sql
security definer
set search_path = public
stable
as $$
  select s.id, s.team_name, s.status, s.duration_minutes, s.created_at,
    s.transcription_enabled, s.transcript_draft
  from public.sessions s
  where s.facilitator_token = p_facilitator_token;
$$;

-- Only allowed before the workshop starts (current_card_id is null) — AC#1.
-- Also rejects a closed session (FT004, same code start_session_as_facilitator
-- already uses for this) — a session can be closed before ever starting
-- (current_card_id stays null), and without this check the toggle would
-- keep accepting writes on a permanently-closed session. FT010 is a new
-- error code; FT001-FT009 are already taken by the other facilitator-token
-- functions in this project (see start/close/reveal/go-to-next-card/
-- set-card-consensus as-facilitator).
create function public.set_transcription_enabled_as_facilitator(
  p_session_id uuid,
  p_facilitator_token uuid,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_card_id uuid;
  v_status text;
begin
  select current_card_id, status into v_current_card_id, v_status
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
    raise exception 'cannot change transcription after session started' using errcode = 'FT010';
  end if;

  update public.sessions
    set transcription_enabled = p_enabled
    where id = p_session_id;
end;
$$;

-- Defense in depth: never write a transcript draft for a session that
-- hasn't opted in, even if this were ever called with a forged payload.
-- Also rejects a closed session (FT004) — closing clears transcript_draft
-- to null (AC#6, NFR15) specifically so no transcript outlives the
-- session; a sync call racing in after close (e.g. the periodic interval
-- firing just as the facilitator taps "clôturer") must never resurrect it.
create function public.sync_transcript_draft_as_facilitator(
  p_session_id uuid,
  p_facilitator_token uuid,
  p_text text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transcription_enabled boolean;
  v_status text;
begin
  select transcription_enabled, status into v_transcription_enabled, v_status
  from public.sessions
  where id = p_session_id
    and facilitator_token = p_facilitator_token;

  if not found then
    raise exception 'invalid facilitator token' using errcode = 'FT001';
  end if;

  if v_status = 'CLOTUREE' then
    raise exception 'session is closed' using errcode = 'FT004';
  end if;

  if not v_transcription_enabled then
    raise exception 'invalid facilitator token' using errcode = 'FT001';
  end if;

  update public.sessions
    set transcript_draft = p_text
    where id = p_session_id;
end;
$$;

-- Re-expressed with `transcript_draft = null` added to the closing update
-- (AC#6 — never retained past the session). Body otherwise identical to
-- 20260822074014_start_session_as_facilitator.sql.
create or replace function public.close_session_as_facilitator(
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
    set status = 'CLOTUREE',
      transcript_draft = null,
      transcription_enabled = false
    where id = p_session_id;
end;
$$;

grant execute on function public.get_session_by_facilitator_token(uuid)
  to anon, authenticated;
revoke execute on function public.get_session_by_facilitator_token(uuid)
  from public;

grant execute on function public.set_transcription_enabled_as_facilitator(uuid, uuid, boolean)
  to anon, authenticated;
grant execute on function public.sync_transcript_draft_as_facilitator(uuid, uuid, text)
  to anon, authenticated;

revoke execute on function public.set_transcription_enabled_as_facilitator(uuid, uuid, boolean)
  from public;
revoke execute on function public.sync_transcript_draft_as_facilitator(uuid, uuid, text)
  from public;
