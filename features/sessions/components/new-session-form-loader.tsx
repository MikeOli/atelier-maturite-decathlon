import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureDefaultDeck, listDecksWithCardCounts } from "@/features/decks/actions";
import { NewSessionForm } from "@/features/sessions/components/new-session-form";

export async function NewSessionFormLoader() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/admin/login");
  }

  await ensureDefaultDeck(supabase, data.claims.sub);
  const decks = await listDecksWithCardCounts(supabase);

  return <NewSessionForm decks={decks} />;
}
