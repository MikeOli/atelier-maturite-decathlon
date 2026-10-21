-- Les ateliers deviennent communs (demande utilisateur du 2026-10-21).
--
-- Les decks avaient été partagés, pas les sessions : un animateur
-- nouvellement inscrit voyait le catalogue mais aucun atelier, et ses
-- collègues ne pouvaient ni reprendre ni consulter une session qu'ils
-- n'avaient pas créée. Les ateliers passés semblaient perdus alors qu'ils
-- étaient simplement rattachés à un autre compte.
--
-- Tout compte authentifié accède désormais à toutes les sessions et aux
-- données qui en dépendent. admin_id reste renseigné à la création : il
-- dit qui a animé, il n'autorise plus.
--
-- Ce que cette migration NE change PAS, volontairement :
--   * les participants anonymes gardent exactement les mêmes accès, via
--     session_public_info et les fonctions security definer ;
--   * la politique publique de lecture des votes reste conditionnée à
--     votes_revealed — un participant ne voit toujours pas les votes des
--     autres avant la révélation.

-- Sessions ---------------------------------------------------------------
drop policy if exists "Admins manage their own sessions" on public.sessions;

create policy "Admins read every session"
  on public.sessions
  for select
  to authenticated
  using (true);

create policy "Admins create sessions under their own name"
  on public.sessions
  for insert
  to authenticated
  with check (admin_id = (select auth.uid()));

create policy "Admins update every session"
  on public.sessions
  for update
  to authenticated
  using (true)
  with check (true);

create policy "Admins delete every session"
  on public.sessions
  for delete
  to authenticated
  using (true);

-- Votes ------------------------------------------------------------------
-- Remplace la lecture limitée à ses propres sessions. La politique
-- publique « Votes are readable once revealed » n'est pas touchée.
drop policy if exists "Admins can view votes of their own sessions" on public.votes;

create policy "Admins read votes of every session"
  on public.votes
  for select
  to authenticated
  using (true);

-- Accord d'équipe --------------------------------------------------------
drop policy if exists "Admins can set consensus on their own sessions" on public.card_consensus;
drop policy if exists "Admins can update consensus on their own sessions" on public.card_consensus;

create policy "Admins set consensus on every session"
  on public.card_consensus
  for insert
  to authenticated
  with check (true);

create policy "Admins update consensus on every session"
  on public.card_consensus
  for update
  to authenticated
  using (true)
  with check (true);

-- État live --------------------------------------------------------------
drop policy if exists "Admins insert the live state of their own sessions" on public.session_live_state;
drop policy if exists "Admins update the live state of their own sessions" on public.session_live_state;
drop policy if exists "Admins manage the live state of their own sessions" on public.session_live_state;

create policy "Admins insert the live state of every session"
  on public.session_live_state
  for insert
  to authenticated
  with check (true);

create policy "Admins update the live state of every session"
  on public.session_live_state
  for update
  to authenticated
  using (true)
  with check (true);
