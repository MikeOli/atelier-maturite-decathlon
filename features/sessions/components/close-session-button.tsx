"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { closeSession } from "@/features/sessions/actions";
import { Button } from "@/components/ui/button";

export function CloseSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = useCallback(async () => {
    setClosing(true);
    setError(null);

    const result = await closeSession(sessionId);

    if (!result.success) {
      setError(result.error);
      setClosing(false);
      return;
    }

    // Same rationale as RevealPanel's handleNextCard: let the parent Server
    // Component re-fetch session.status and re-render, rather than
    // maintaining a local "closed" flag that could drift from server truth.
    router.refresh();
  }, [sessionId, router]);

  return (
    <div className="flex flex-col gap-2 items-start">
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button
        type="button"
        variant="destructive"
        onClick={handleClose}
        disabled={closing}
      >
        {closing ? "Fin de session en cours…" : "Terminer la session"}
      </Button>
    </div>
  );
}
