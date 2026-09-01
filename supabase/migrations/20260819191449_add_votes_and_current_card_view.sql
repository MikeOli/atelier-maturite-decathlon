-- Story 3.1: individual hidden voting.

-- Tracks whether the votes for the session's current card have been
-- revealed by the admin (Story 3.3). Drives the votes RLS below.
alter table public.sessions
  add column votes_revealed boolean not null default false;

-- Participants have no account and `cards` stays admin-only (scoped to the
-- owning admin's decks). This narrow view exposes only the ONE currently
-- active card per session — never the whole deck — so a participant can't
-- browse ahead to cards not yet reached. Same "narrow view" pattern as
-- `session_public_info` (Story 2.1).
create view public.session_current_card
  with (security_invoker = false)
  as
  select
    s.id as session_id,
    c.id as card_id,
    c.title,
    c.theme,
    c.bullets
  from public.sessions s
  join public.cards c on c.id = s.current_card_id;

grant select on public.session_current_card to anon, authenticated;

create table public.votes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  value integer not null check (value in (0, 1, 2, 3, 5, 8, 13, 21)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, card_id, participant_id)
);

create index votes_session_id_card_id_idx on public.votes(session_id, card_id);

alter table public.votes enable row level security;

-- AC#2 ("no participant sees another's vote before reveal") is guaranteed
-- here at the DB level, not just by the app's queries: nobody — not even a
-- direct REST call with the anon key — can read a row until the session's
-- votes_revealed flag flips to true (Story 3.3).
create policy "Votes are readable once revealed"
  on public.votes
  for select
  using (
    exists (
      select 1 from public.sessions s
      where s.id = votes.session_id
        and s.votes_revealed = true
    )
  );

-- Voting is only allowed on the session's current card, and only before
-- reveal — enforced at the DB level so a stale/forged request can't insert
-- a vote out of turn or after the admin has already revealed.
create policy "Participants can vote on the current card before reveal"
  on public.votes
  for insert
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = votes.session_id
        and s.votes_revealed = false
        and s.current_card_id = votes.card_id
    )
  );

-- `submitVote` inserts, then falls back to a plain UPDATE on a unique-key
-- conflict (NOT an upsert/ON CONFLICT DO UPDATE — that needs SELECT
-- visibility of the conflicting row to detect the conflict at all, which
-- the restrictive select policy above deliberately blocks before reveal).
-- This UPDATE policy is what that fallback path needs; Story 3.2 (change
-- vote before reveal) reuses it as-is, no separate migration required.
create policy "Participants can update their vote on the current card before reveal"
  on public.votes
  for update
  using (
    exists (
      select 1 from public.sessions s
      where s.id = votes.session_id
        and s.votes_revealed = false
        and s.current_card_id = votes.card_id
    )
  )
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = votes.session_id
        and s.votes_revealed = false
        and s.current_card_id = votes.card_id
    )
  );
