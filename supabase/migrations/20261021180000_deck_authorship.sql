-- Afficher qui a créé un deck et qui l'a modifié en dernier.
--
-- Deux manques : la table ne gardait aucune trace des modifications, et
-- admin_id ne donne qu'un uuid, illisible pour un humain.

-- 1. Traçabilité -----------------------------------------------------------
alter table public.decks
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

-- Les decks existants n'ont jamais été modifiés depuis leur création :
-- faire croire à une modification au moment de cette migration serait faux.
update public.decks set updated_at = created_at where updated_at > created_at;

create or replace function public.touch_deck()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists touch_deck_trigger on public.decks;

create trigger touch_deck_trigger
  before update on public.decks
  for each row
  execute function public.touch_deck();

-- Une « modification de deck » est le plus souvent une modification de ses
-- cartes : sans ça, renommer une carte ne changerait jamais la date affichée.
create or replace function public.touch_deck_from_card()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deck_id uuid := coalesce(new.deck_id, old.deck_id);
begin
  update public.decks
    set updated_at = now(), updated_by = auth.uid()
    where id = v_deck_id;
  return coalesce(new, old);
end;
$$;

drop trigger if exists touch_deck_from_card_trigger on public.cards;

create trigger touch_deck_from_card_trigger
  after insert or update or delete on public.cards
  for each row
  execute function public.touch_deck_from_card();

-- 2. Lisibilité des auteurs ------------------------------------------------
-- auth.users n'est pas interrogeable depuis l'API : cette vue en expose le
-- strict minimum — identifiant et adresse — et uniquement aux comptes
-- connectés, c'est-à-dire aux animateurs Décathlon. Les participants
-- anonymes n'y ont aucun accès.
create or replace view public.admin_emails as
  select id, email from auth.users;

revoke all on public.admin_emails from anon;
grant select on public.admin_emails to authenticated;
