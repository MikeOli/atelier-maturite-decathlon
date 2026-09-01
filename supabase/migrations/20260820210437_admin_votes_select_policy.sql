-- Story 5.1 (tableau de synthèse par carte): the only existing SELECT
-- policy on `votes` ("Votes are readable once revealed") gates on the
-- session's *current* votes_revealed flag — not a per-card historical
-- flag. Once the admin advances past a card (goToNextCard resets
-- votes_revealed to false, Story 3.4), that card's already-revealed votes
-- become unreadable again by that policy, even though they're legitimate
-- to show in a synthesis table. No admin-scoped SELECT policy exists on
-- `votes` today, unlike `sessions`/`decks`/`cards`, which all have one.
--
-- Additive: RLS policies OR together, so the existing anon policy is
-- untouched and keeps gating participant/board/facilitator reads on
-- votes_revealed. This only adds an independent admin-scoped path.
create policy "Admins can view votes of their own sessions"
  on public.votes
  for select
  using (
    exists (
      select 1 from public.sessions s
      where s.id = votes.session_id
        and s.admin_id = (select auth.uid())
    )
  );
