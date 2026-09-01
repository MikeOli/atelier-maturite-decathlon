"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { startSessionAsFacilitator } from "@/features/sessions/actions";
import { Button } from "@/components/ui/button";

/**
 * Facilitator-token equivalent of `StartSessionButton`, for the mobile
 * pilotage screen (/facilitate/[code]), which has no Supabase Auth session.
 */
export function StartSessionAsFacilitatorButton({
  sessionId,
  facilitatorToken,
}: {
  sessionId: string;
  facilitatorToken: string;
}) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = useCallback(async () => {
    setStarting(true);
    setError(null);

    const result = await startSessionAsFacilitator(sessionId, facilitatorToken);

    if (!result.success) {
      setError(result.error);
      setStarting(false);
      return;
    }

    router.refresh();
  }, [sessionId, facilitatorToken, router]);

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
