"use server";

import { createCardSchema } from "@/lib/schemas/card";
import type { ActionResult } from "@/features/sessions/actions";
import { createClient } from "@/lib/supabase/server";

export async function createCard(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();

  if (authError || !authData?.claims) {
    return { success: false, error: "Session admin invalide." };
  }

  const parsed = createCardSchema.safeParse({
    deckId: formData.get("deckId"),
    theme: formData.get("theme"),
    title: formData.get("title"),
    bullets: formData.get("bullets"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Formulaire invalide.",
    };
  }

  const { deckId, theme, title, bullets } = parsed.data;

  const { data: deck, error: deckError } = await supabase
    .from("decks")
    .select("id")
    .eq("id", deckId)
    .eq("admin_id", authData.claims.sub)
    .maybeSingle();

  if (deckError || !deck) {
    return { success: false, error: "Deck invalide." };
  }

  const { data: lastCard, error: lastCardError } = await supabase
    .from("cards")
    .select("order_index")
    .eq("deck_id", deckId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastCardError) {
    return { success: false, error: "Impossible de créer la carte." };
  }

  const nextOrderIndex = (lastCard?.order_index ?? 0) + 1;

  const { data: card, error } = await supabase
    .from("cards")
    .insert({
      deck_id: deckId,
      theme,
      title,
      bullets,
      order_index: nextOrderIndex,
    })
    .select("id")
    .single();

  if (error) {
    return { success: false, error: "Impossible de créer la carte." };
  }

  return { success: true, data: { id: card.id } };
}
