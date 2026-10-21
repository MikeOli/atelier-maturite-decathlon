"use server";

import { z } from "zod";
import type { ActionResult } from "@/features/sessions/actions";
import { createClient } from "@/lib/supabase/server";

const POSTGRES_FOREIGN_KEY_VIOLATION = "23503";

const deckIdSchema = z.string().uuid("Deck invalide.");

/**
 * Permanent deletion. `cards` cascade on delete, but `sessions.deck_id`
 * is `on delete restrict` — a deck ever used by a session can't be
 * removed, surfaced here as a friendly error rather than a raw FK failure.
 * The default deck is blocked client-side (DeleteDeckButton hides the
 * button) but also re-checked here since `ensureDefaultDeck` would
 * silently reseed it on the admin's next deck-list load anyway.
 *
 * N'importe quel animateur peut supprimer n'importe quel deck depuis que
 * le catalogue est commun (2026-10-21) : les protections qui comptent
 * sont le deck par défaut et les decks déjà utilisés par une session,
 * pas la propriété.
 */
export async function deleteDeck(deckId: string): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();

  if (authError || !authData?.claims) {
    return { success: false, error: "Session admin invalide." };
  }

  const parsed = deckIdSchema.safeParse(deckId);
  if (!parsed.success) {
    return { success: false, error: "Deck invalide." };
  }

  const { data: deck, error: deckError } = await supabase
    .from("decks")
    .select("is_default")
    .eq("id", parsed.data)
    .maybeSingle();

  // Plus de filtre sur le créateur : le catalogue est commun et se gère
  // collectivement. « Deck invalide » couvrait aussi ce cas, ce qui
  // affichait un message incompréhensible à qui tentait de supprimer le
  // deck d'un collègue.
  if (deckError || !deck) {
    return { success: false, error: "Deck introuvable." };
  }

  if (deck.is_default) {
    return {
      success: false,
      error: "Le deck par défaut ne peut pas être supprimé.",
    };
  }

  const { error } = await supabase
    .from("decks")
    .delete()
    .eq("id", parsed.data);

  if (error) {
    if (error.code === POSTGRES_FOREIGN_KEY_VIOLATION) {
      return {
        success: false,
        // Préciser « y compris clôturées » : l'écran d'accueil ne liste
        // que les sessions en cours, donc un deck refusé pour cause de
        // session passée donnait l'impression d'un bug.
        error:
          "Ce deck est utilisé par des sessions, y compris clôturées, et ne peut pas être supprimé sans effacer leur historique.",
      };
    }
    return { success: false, error: "Impossible de supprimer le deck." };
  }

  return { success: true, data: null };
}
