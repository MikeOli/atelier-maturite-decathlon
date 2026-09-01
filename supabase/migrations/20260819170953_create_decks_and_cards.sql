-- Decks and cards, scoped per admin (owner). Versioning (card_versions,
-- session-time locking) is intentionally out of scope here — see Epic 6.

create table if not exists public.decks (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks(id) on delete cascade,
  theme text not null,
  title text not null,
  bullets jsonb not null default '[]'::jsonb,
  order_index integer not null,
  created_at timestamptz not null default now()
);

create index if not exists cards_deck_id_idx on public.cards(deck_id);

alter table public.decks enable row level security;
alter table public.cards enable row level security;

create policy "Admins manage their own decks"
  on public.decks
  for all
  using (admin_id = (select auth.uid()))
  with check (admin_id = (select auth.uid()));

create policy "Admins manage cards of their own decks"
  on public.cards
  for all
  using (
    exists (
      select 1 from public.decks
      where decks.id = cards.deck_id
        and decks.admin_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.decks
      where decks.id = cards.deck_id
        and decks.admin_id = (select auth.uid())
    )
  );
