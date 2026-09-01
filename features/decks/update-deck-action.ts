"use server";

import { updateDeckSchema } from "@/lib/schemas/deck";
import type { ActionResult } from "@/features/sessions/actions";
import { createClient } from "@/lib/supabase/server";

export async function updateDeck(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();

  if (authError || !authData?.claims) {
    return { success: false, error: "Session admin invalide." };
  }

  const parsed = updateDeckSchema.safeParse({
    deckId: formData.get("deckId"),
    name: formData.get("name"),
    description: formData.get("description") ?? undefined,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Formulaire invalide.",
    };
  }

  const { deckId, name, description } = parsed.data;

  const { data: deck, error } = await supabase
    .from("decks")
    .update({ name, description })
    .eq("id", deckId)
    .select("id")
    .single();

  if (error || !deck) {
    return { success: false, error: "Deck invalide." };
  }

  return { success: true, data: { id: deck.id } };
}
