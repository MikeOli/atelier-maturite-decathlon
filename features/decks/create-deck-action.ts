"use server";

import { createDeckSchema } from "@/lib/schemas/deck";
import type { ActionResult } from "@/features/sessions/actions";
import { createClient } from "@/lib/supabase/server";

export async function createDeck(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();

  if (authError || !authData?.claims) {
    return { success: false, error: "Session admin invalide." };
  }

  const parsed = createDeckSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? undefined,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Formulaire invalide.",
    };
  }

  const { name, description } = parsed.data;

  const { data: deck, error } = await supabase
    .from("decks")
    .insert({
      admin_id: authData.claims.sub,
      name,
      description,
    })
    .select("id")
    .single();

  if (error) {
    return { success: false, error: "Impossible de créer le deck." };
  }

  return { success: true, data: { id: deck.id } };
}
