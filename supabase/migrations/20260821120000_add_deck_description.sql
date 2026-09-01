-- Story 1.7 (FR45): decks gain a description, shown alongside the title on
-- the board's pre-session cover page (Story 3.10). `not null default ''`
-- rather than nullable — only two states matter for display (empty vs
-- filled), consistent with the project's existing style
-- (e.g. `sessions.votes_revealed boolean not null default false`).
alter table public.decks
  add column description text not null default '';
