"use server";

import { updateCardSchema } from "@/lib/schemas/card";
import type { ActionResult } from "@/features/sessions/actions";
import { createClient } from "@/lib/supabase/server";

export async function updateCard(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();

  if (authError || !authData?.claims) {
    return { success: false, error: "Session admin invalide." };
  }

  const parsed = updateCardSchema.safeParse({
    cardId: formData.get("cardId"),
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

  const { cardId, theme, title, bullets } = parsed.data;

  const { data: card, error } = await supabase
    .from("cards")
    .update({ theme, title, bullets })
    .eq("id", cardId)
    .select("id")
    .single();

  if (error || !card) {
    return { success: false, error: "Carte invalide." };
  }

  return { success: true, data: { id: card.id } };
}
