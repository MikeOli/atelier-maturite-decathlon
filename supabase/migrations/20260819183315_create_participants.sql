-- Participants are anonymous (FR7/FR8) and their avatar list must update in
-- real time for everyone in the session (FR9). Realtime subscriptions
-- authorize against the base table's RLS, not a view — unlike `sessions`
-- (Story 2.1 fix), so this table gets a direct public RLS policy rather than
-- a narrow view. Tradeoff accepted deliberately: the only non-public column
-- is `client_token`, a low-stakes per-participant identity secret (not PII,
-- doesn't unlock anything beyond "act as this participant" in an internal
-- team exercise). Revisit if the tool ever goes multi-tenant/public.

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  avatar_key text not null,
  avatar_label text not null,
  client_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  unique (session_id, avatar_key)
);

create index if not exists participants_session_id_idx on public.participants(session_id);

alter table public.participants enable row level security;

create policy "Anyone can view participants of a session"
  on public.participants
  for select
  using (true);

create policy "Anyone can join a session as a participant"
  on public.participants
  for insert
  with check (true);

alter publication supabase_realtime add table public.participants;
