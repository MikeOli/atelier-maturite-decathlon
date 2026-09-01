import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDeckDetail } from "@/features/decks/actions";
import { AddCardDisclosure } from "@/features/decks/components/add-card-disclosure";
import { SortableCardList } from "@/features/decks/components/sortable-card-list";
import { EditDeckHeader } from "@/features/decks/components/edit-deck-header";
import { DeleteDeckButton } from "@/features/decks/components/delete-deck-button";

async function DeckDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: deckId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/admin/login");
  }

  const deck = await getDeckDetail(deckId, data.claims.sub);
  if (!deck) notFound();

  return (
    <>
      <EditDeckHeader deck={deck} />

      <SortableCardList deckId={deck.id} cards={deck.cards} />

      <AddCardDisclosure deckId={deck.id} />

      {!deck.isDefault && (
        <div className="border-t pt-6">
          <DeleteDeckButton deckId={deck.id} />
        </div>
      )}
    </>
  );
}

export default function DeckDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="flex-1 w-full flex flex-col gap-6 p-6 max-w-2xl mx-auto">
      <Link
        href="/admin?tab=decks"
        className="self-start text-sm text-foreground-soft hover:text-foreground"
      >
        ← Retour à mes decks
      </Link>
      <Suspense fallback={null}>
        <DeckDetailContent params={params} />
      </Suspense>
    </div>
  );
}
