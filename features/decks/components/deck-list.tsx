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
        <li key={deck.id}>
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
          </Link>
        </li>
      ))}
    </ul>
  );
}
