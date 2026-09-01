"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { deleteDeck } from "@/features/decks/delete-deck-action";
import { Button } from "@/components/ui/button";

/**
 * Same window.confirm pattern as DeleteSessionButton (2026-08-24 decision).
 * Not rendered at all for the default deck — see DeckDetailContent.
 */
export function DeleteDeckButton({ deckId }: { deckId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = useCallback(async () => {
    const confirmed = window.confirm(
      "Supprimer définitivement ce deck et toutes ses cartes ? Cette action est irréversible.",
    );
    if (!confirmed) return;

    setDeleting(true);
    setError(null);

    const result = await deleteDeck(deckId);

    if (!result.success) {
      setError(result.error);
      setDeleting(false);
      return;
    }

    router.push("/admin?tab=decks");
    router.refresh();
  }, [deckId, router]);

  return (
    <div className="flex flex-col gap-1 items-start">
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button
        type="button"
        variant="destructive"
        onClick={handleDelete}
        disabled={deleting}
      >
        {deleting ? "Suppression…" : "Supprimer le deck"}
      </Button>
    </div>
  );
}
