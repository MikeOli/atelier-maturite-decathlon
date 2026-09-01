import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCardDetail } from "@/features/decks/actions";
import { EditCardForm } from "@/features/decks/components/edit-card-form";

async function EditCardContent({
  params,
}: {
  params: Promise<{ id: string; cardId: string }>;
}) {
  const { id: deckId, cardId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/admin/login");
  }

  const card = await getCardDetail(cardId);
  if (!card || card.deckId !== deckId) notFound();

  return (
    <>
      <Link
        href={`/admin/decks/${deckId}`}
        className="self-start text-sm text-foreground-soft hover:text-foreground"
      >
        ← Retour au deck
      </Link>
      <h1 className="font-display text-2xl font-bold">Éditer la carte</h1>
      <EditCardForm card={card} deckId={deckId} />
    </>
  );
}

export default function EditCardPage({
  params,
}: {
  params: Promise<{ id: string; cardId: string }>;
}) {
  return (
    <div className="flex-1 w-full flex flex-col gap-6 p-6 max-w-2xl mx-auto">
      <Suspense fallback={null}>
        <EditCardContent params={params} />
      </Suspense>
    </div>
  );
}
