-- Sessions, scoped per admin (owner). Real-time voting fields (votes,
-- participants, current_card_id usage) land in later epics — this story only
-- needs a session to exist with a name, duration, deck, and status.

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  deck_id uuid not null references public.decks(id) on delete restrict,
  team_name text not null,
  duration_minutes integer not null check (duration_minutes > 0),
  status text not null default 'EN_COURS' check (status in ('EN_COURS', 'CLOTUREE')),
  current_card_id uuid references public.cards(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists sessions_admin_id_idx on public.sessions(admin_id);

alter table public.sessions enable row level security;

create policy "Admins manage their own sessions"
  on public.sessions
  for all
  using (admin_id = (select auth.uid()))
  with check (admin_id = (select auth.uid()));
