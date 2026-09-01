"use server";

import { reorderCardsSchema } from "@/lib/schemas/card";
import type { ActionResult } from "@/features/sessions/actions";
import { createClient } from "@/lib/supabase/server";

export async function reorderCards(
  deckId: string,
  cardIds: string[],
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();

  if (authError || !authData?.claims) {
    return { success: false, error: "Session admin invalide." };
  }

  const parsed = reorderCardsSchema.safeParse({ deckId, cardIds });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Formulaire invalide.",
    };
  }

  const { data: deck, error: deckError } = await supabase
    .from("decks")
    .select("id")
    .eq("id", parsed.data.deckId)
    .eq("admin_id", authData.claims.sub)
    .maybeSingle();

  if (deckError || !deck) {
    return { success: false, error: "Deck invalide." };
  }

  const { error } = await supabase.rpc("reorder_cards", {
    p_deck_id: parsed.data.deckId,
    p_card_ids: parsed.data.cardIds,
  });

  if (error) {
    return { success: false, error: "Impossible de réordonner les cartes." };
  }

  return { success: true, data: null };
}
