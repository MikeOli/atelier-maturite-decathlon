-- L'inscription devient libre, mais réservée aux adresses Décathlon.
--
-- Posé en base plutôt que dans le formulaire : la page d'inscription
-- appelle supabase.auth.signUp depuis le navigateur avec la clé publique,
-- donc n'importe qui peut rejouer cet appel avec l'adresse de son choix.
-- Un contrôle côté client n'est qu'un confort d'affichage ; seul ce
-- déclencheur est une garantie.
--
-- Les comptes existants ne sont pas affectés : le déclencheur ne se
-- déclenche qu'à l'insertion.
--
-- Pour ouvrir un domaine supplémentaire (filiale, prestataire), ajoutez-le
-- au tableau ci-dessous et rejouez cette migration.

create or replace function public.enforce_admin_email_domain()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed_domains text[] := array['decathlon.com'];
  email_domain text;
begin
  email_domain := lower(split_part(new.email, '@', 2));

  if email_domain is null or email_domain = '' or not (email_domain = any (allowed_domains)) then
    raise exception 'email domain not allowed'
      using errcode = 'DK001',
            hint = 'Seules les adresses Décathlon peuvent créer un compte animateur.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_admin_email_domain_trigger on auth.users;

create trigger enforce_admin_email_domain_trigger
  before insert on auth.users
  for each row
  execute function public.enforce_admin_email_domain();
