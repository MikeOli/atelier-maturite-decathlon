-- Gestion collective du catalogue (demande utilisateur du 2026-10-21).
--
-- La migration 20261021090000 avait ouvert la lecture à tous les admins
-- mais réservé l'écriture au créateur du deck. À l'usage, ça rendait le
-- catalogue ingérable : un compte nouvellement créé ne possède aucun deck,
-- donc ne pouvait ni corriger ni supprimer quoi que ce soit — y compris
-- les doublons de « Maturité Produit » hérités du modèle privé.
--
-- Les decks sont communs : tout compte authentifié peut désormais les
-- créer, modifier et supprimer. Les deux garde-fous qui comptent restent
-- en place et ne dépendent pas de ces politiques :
--   * le deck par défaut est protégé par deleteDeck et l'index unique ;
--   * un deck utilisé par une session est protégé par
--     sessions.deck_id ... on delete restrict.
--
-- admin_id continue d'enregistrer qui a créé le deck : l'insertion exige
-- toujours que ce soit l'utilisateur courant, pour que cette information
-- reste exacte.

drop policy if exists "Admins update the decks they created" on public.decks;
drop policy if exists "Admins delete the decks they created" on public.decks;

create policy "Admins update any shared deck"
  on public.decks
  for update
  to authenticated
  using (true)
  with check (true);

create policy "Admins delete any shared deck"
  on public.decks
  for delete
  to authenticated
  using (true);

drop policy if exists "Admins write cards of the decks they created" on public.cards;

create policy "Admins write cards of any shared deck"
  on public.cards
  for all
  to authenticated
  using (true)
  with check (true);
