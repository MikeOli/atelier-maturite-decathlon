-- Les decks deviennent communs : tout admin connecté voit et utilise le
-- même catalogue, au lieu d'en posséder une copie privée. Demande
-- utilisateur du 2026-10-21, en préalable à l'inscription libre.
--
-- La lecture s'ouvre à tous les comptes authentifiés ; l'écriture reste
-- réservée au créateur du deck (admin_id). Sans cette asymétrie, un
-- collègue pourrait supprimer ou réécrire un deck pendant qu'un autre
-- anime une session avec. La suppression d'un deck déjà utilisé était
-- déjà bloquée par sessions.deck_id ... on delete restrict ; cette
-- politique ajoute la protection pour la modification des cartes.
--
-- Les participants anonymes ne sont pas concernés : ils ne lisent jamais
-- decks ni cards directement, mais via les fonctions security definer et
-- la vue session_public_info.

drop policy if exists "Admins manage their own decks" on public.decks;

create policy "Decks are readable by every admin"
  on public.decks
  for select
  to authenticated
  using (true);

create policy "Admins create decks under their own name"
  on public.decks
  for insert
  to authenticated
  with check (admin_id = (select auth.uid()));

create policy "Admins update the decks they created"
  on public.decks
  for update
  to authenticated
  using (admin_id = (select auth.uid()))
  with check (admin_id = (select auth.uid()));

create policy "Admins delete the decks they created"
  on public.decks
  for delete
  to authenticated
  using (admin_id = (select auth.uid()));

drop policy if exists "Admins manage cards of their own decks" on public.cards;

create policy "Cards are readable by every admin"
  on public.cards
  for select
  to authenticated
  using (true);

create policy "Admins write cards of the decks they created"
  on public.cards
  for all
  to authenticated
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

-- Un seul deck par défaut pour tout le monde, au lieu d'un par admin :
-- le catalogue étant commun, provisionner une copie de « Maturité
-- Produit » à chaque inscription créerait autant de doublons que de
-- comptes.
drop index if exists decks_one_default_per_admin_idx;

-- Le modèle privé a laissé un deck par défaut PAR admin : l'index global
-- ci-dessous les refuserait tous sauf un (échec 23505 constaté au premier
-- passage). On garde le plus ancien — le deck d'origine — et on retire le
-- drapeau aux autres.
--
-- Rien n'est supprimé : ces decks restent dans le catalogue commun, leurs
-- cartes aussi, et les sessions qui les référencent ne bougent pas. Seule
-- la notion de « deck par défaut » est recentrée sur un seul. Le drapeau
-- ne sert qu'à deux choses : empêcher sa suppression, et savoir si le
-- catalogue a déjà été amorcé.
update public.decks
  set is_default = false
  where is_default
    and id is distinct from (
      select id
      from public.decks
      where is_default
      order by created_at asc, id asc
      limit 1
    );

create unique index if not exists decks_one_default_idx
  on public.decks (is_default)
  where is_default;
