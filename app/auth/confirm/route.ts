import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

function failed(message: string): never {
  redirect(`/auth/error?error=${encodeURIComponent(message)}`);
}

/**
 * Traduit les refus les plus courants en quelque chose d'actionnable.
 * `otp_expired` est le cas fréquent et trompeur : le lien d'un mail de
 * validation est à usage unique, et certains clients de messagerie ou
 * antivirus le pré-chargent, donc le consomment avant même le clic.
 */
function explainAuthError(code: string | null, description: string | null): string {
  if (code === "otp_expired") {
    return "Ce lien de validation a expiré ou a déjà été utilisé. Refaites une demande pour en recevoir un nouveau.";
  }
  if (code === "access_denied") {
    return "Lien de validation refusé. Il a probablement déjà servi : demandez-en un nouveau.";
  }
  return description ?? code ?? "Lien de validation refusé.";
}

/**
 * Point d'arrivée des liens de validation envoyés par mail.
 *
 * Gère les deux formes possibles, parce que la forme reçue dépend d'un
 * réglage Supabase que ce projet ne peut pas changer :
 *
 * - `code` — le modèle de mail PAR DÉFAUT. Supabase vérifie le jeton de son
 *   côté puis redirige ici avec un code d'autorisation (PKCE) à échanger
 *   contre une session. C'est ce que reçoit ce projet aujourd'hui.
 * - `token_hash` + `type` — ce que produit un modèle personnalisé, la forme
 *   documentée par Supabase pour Next.js. L'édition des modèles exige un
 *   SMTP personnalisé, dont le projet ne dispose pas encore ; le jour où il
 *   en aura un, ce chemin fonctionnera sans rien changer ici.
 *
 * Ne gérer que la seconde, comme c'était le cas, laissait l'utilisateur
 * arriver sur la page d'erreur alors que son adresse venait d'être validée.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const next = searchParams.get("next") ?? "/";
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // Quand le jeton est refusé, Supabase ne redirige pas sans rien : il
  // place la raison dans l'URL. Les ignorer, comme c'était le cas,
  // transformait un « lien déjà utilisé » parfaitement explicite en un
  // « lien incomplet ou expiré » qui n'aide personne.
  const errorCode = searchParams.get("error_code");
  const errorDescription = searchParams.get("error_description");
  if (errorCode || searchParams.get("error")) {
    console.error(
      `auth/confirm: refus de Supabase ${JSON.stringify({
        error: searchParams.get("error"),
        errorCode,
        errorDescription,
      })}`,
    );
    failed(explainAuthError(errorCode, errorDescription));
  }

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) failed(error.message);
    redirect(next);
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) failed(error.message);
    redirect(next);
  }

  console.error(
    `auth/confirm: aucun jeton exploitable, parametres recus = ${JSON.stringify(
      Object.fromEntries(searchParams),
    )}`,
  );
  failed(
    "Lien de validation incomplet. S'il a été ouvert depuis un autre navigateur que celui de l'inscription, recommencez depuis le même.",
  );
}
