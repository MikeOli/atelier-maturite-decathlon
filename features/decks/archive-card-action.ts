"use server";

import { z } from "zod";
import type { ActionResult } from "@/features/sessions/actions";
import { createClient } from "@/lib/supabase/server";

const cardIdSchema = z.string().uuid("Carte invalide.");

export async function archiveCard(cardId: string): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();

  if (authError || !authData?.claims) {
    return { success: false, error: "Session admin invalide." };
  }

  const parsed = cardIdSchema.safeParse(cardId);

  if (!parsed.success) {
    return { success: false, error: "Carte invalide." };
  }

  const { data: card, error } = await supabase
    .from("cards")
    .update({ archived: true })
    .eq("id", parsed.data)
    .select("id")
    .single();

  if (error || !card) {
    return { success: false, error: "Carte invalide." };
  }

  return { success: true, data: null };
}
