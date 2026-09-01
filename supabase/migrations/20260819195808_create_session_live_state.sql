-- Story 3.3: participants need to know live when the admin reveals votes
-- (and, in future stories, when the current card changes). Supabase
-- Realtime only authorizes postgres_changes against a base table's RLS,
-- never a view — so `sessions` itself (locked down to admin-only SELECT
-- since Story 2.1's fix) can't be the realtime source without reopening
-- that exposure. This mirror table carries only the two fields that are
-- genuinely public and live-relevant, nothing sensitive (no admin_id, no
-- deck_id), so it can be fully public + realtime without regressing
-- Story 2.1's decision.
--
-- `sessions.votes_revealed`/`current_card_id` remain the source of truth
-- used internally by `submit_vote()` and the `votes` RLS policies
-- (unchanged since Story 3.1/3.2) — this table is a broadcast mirror only.
create table public.session_live_state (
  session_id uuid primary key references public.sessions(id) on delete cascade,
  current_card_id uuid references public.cards(id),
  votes_revealed boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.session_live_state enable row level security;

create policy "Anyone can view live session state"
  on public.session_live_state
  for select
  using (true);

create policy "Admins manage the live state of their own sessions"
  on public.session_live_state
  for all
  using (
    exists (
      select 1 from public.sessions s
      where s.id = session_live_state.session_id
        and s.admin_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = session_live_state.session_id
        and s.admin_id = (select auth.uid())
    )
  );

alter publication supabase_realtime add table public.session_live_state;
