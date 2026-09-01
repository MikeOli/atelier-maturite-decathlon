-- Code review fix (Story 1.3): prevent concurrent first-access requests from
-- seeding two "default" decks for the same admin (race condition in
-- ensureDefaultDeck's check-then-insert). A DB-level constraint is the only
-- reliable guard against a race between two concurrent requests.

alter table public.decks
  add column if not exists is_default boolean not null default false;

create unique index if not exists decks_one_default_per_admin_idx
  on public.decks (admin_id)
  where is_default;
