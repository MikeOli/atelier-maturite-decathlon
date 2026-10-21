/**
 * Domaines autorisés à créer un compte animateur.
 *
 * Cette liste n'est qu'un confort d'affichage : elle permet de refuser une
 * adresse dans le formulaire, avec un message clair, avant tout aller-retour
 * réseau. La garantie réelle est le déclencheur `enforce_admin_email_domain`
 * posé sur auth.users (migration 20261021090100), car l'inscription part du
 * navigateur avec la clé publique et peut donc être rejouée hors formulaire.
 *
 * Les deux listes doivent rester synchronisées.
 */
export const ALLOWED_EMAIL_DOMAINS = ["decathlon.com"] as const;

export function isAllowedEmailDomain(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase().trim();
  if (!domain) return false;
  return (ALLOWED_EMAIL_DOMAINS as readonly string[]).includes(domain);
}
