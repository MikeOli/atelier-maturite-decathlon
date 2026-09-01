"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { archiveCard } from "@/features/decks/archive-card-action";
import { Button } from "@/components/ui/button";

export function ArchiveCardButton({ cardId }: { cardId: string }) {
  const router = useRouter();
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleArchive = useCallback(async () => {
    setArchiving(true);
    setError(null);

    const result = await archiveCard(cardId);

    if (!result.success) {
      setError(result.error);
      setArchiving(false);
      return;
    }

    router.refresh();
  }, [cardId, router]);

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
        size="sm"
        onClick={handleArchive}
        disabled={archiving}
      >
        {archiving ? "Suppression…" : "Supprimer"}
      </Button>
    </div>
  );
}
