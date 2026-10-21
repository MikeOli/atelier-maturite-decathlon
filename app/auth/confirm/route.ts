import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

function failed(message: string): never {
  redirect(`/auth/error?error=${encodeURIComponent(message)}`);
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

  failed("Lien de confirmation incomplet ou expiré.");
}
