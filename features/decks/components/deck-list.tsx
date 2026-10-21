import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureDefaultDeck, listDecksWithCardCounts } from "@/features/decks/actions";

export async function DeckList() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/admin/login");
  }

  await ensureDefaultDeck(supabase, data.claims.sub);
  const decks = await listDecksWithCardCounts(supabase);

  return (
    <ul className="flex flex-col gap-3">
      {decks.map((deck) => (
        <li key={deck.id} className="flex flex-col gap-1">
          <Link
            href={`/admin/decks/${deck.id}`}
            className="border rounded-md p-4 flex flex-col gap-1 hover:bg-lav hover:border-transparent transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{deck.name}</span>
              <span className="text-sm text-muted-foreground">
                {deck.cardCount} carte{deck.cardCount > 1 ? "s" : ""}
              </span>
            </div>
            {deck.description && (
              <p className="text-sm text-muted-foreground">{deck.description}</p>
            )}
            {deck.createdByEmail && (
              <p className="text-sm text-muted-foreground">
                Créé par {deck.createdByEmail}
              </p>
            )}
          </Link>
          <DeckLastChange
            updatedAt={deck.updatedAt}
            updatedByEmail={deck.updatedByEmail}
          />
        </li>
      ))}
    </ul>
  );
}

/**
 * Sous la cartouche, en retrait : l'information est utile pour savoir à qui
 * parler d'un deck partagé, mais ne doit pas concurrencer le nom.
 *
 * Rien n'est affiché tant que personne n'a modifié le deck : la migration
 * laisse updated_by à null dans ce cas, et « modifié par personne » serait
 * un bruit inutile.
 */
function DeckLastChange({
  updatedAt,
  updatedByEmail,
}: {
  updatedAt: string;
  updatedByEmail: string | null;
}) {
  if (!updatedByEmail) return null;

  const date = new Date(updatedAt).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <p className="px-4 text-xs text-foreground-mute">
      Modifié le {date} par {updatedByEmail}
    </p>
  );
}
