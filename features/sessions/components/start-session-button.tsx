"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { startSession } from "@/features/sessions/actions";
import { Button } from "@/components/ui/button";

export function StartSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = useCallback(async () => {
    setStarting(true);
    setError(null);

    const result = await startSession(sessionId);

    if (!result.success) {
      setError(result.error);
      setStarting(false);
      return;
    }

    // Same rationale as CloseSessionButton/RevealPanel.handleNextCard: let
    // the parent Server Component re-fetch currentCard and re-render,
    // rather than maintaining a local flag that could drift from server
    // truth.
    router.refresh();
  }, [sessionId, router]);

  return (
    <div className="flex flex-col gap-2 items-start">
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button type="button" onClick={handleStart} disabled={starting}>
        {starting ? "Démarrage…" : "Démarrer l'atelier"}
      </Button>
    </div>
  );
}
