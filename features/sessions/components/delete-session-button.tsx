"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { deleteSession } from "@/features/sessions/actions";
import { Button } from "@/components/ui/button";

/**
 * Story 5.3/5.4 (FR51) — permanent, irreversible deletion, only ever
 * rendered from the "Sessions terminées" list. `window.confirm` chosen
 * deliberately (over a styled dialog) to stay simple, per explicit user
 * decision (2026-08-24) — this is the first use of it in this project.
 */
export function DeleteSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = useCallback(async () => {
    const confirmed = window.confirm(
      "Supprimer définitivement cette session ? Cette action est irréversible.",
    );
    if (!confirmed) return;

    setDeleting(true);
    setError(null);

    const result = await deleteSession(sessionId);

    if (!result.success) {
      setError(result.error);
      setDeleting(false);
      return;
    }

    router.refresh();
  }, [sessionId, router]);

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
        onClick={handleDelete}
        disabled={deleting}
      >
        {deleting ? "Suppression…" : "Supprimer"}
      </Button>
    </div>
  );
}
