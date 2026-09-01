"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { closeSessionAsFacilitator } from "@/features/sessions/actions";
import { Button } from "@/components/ui/button";

/**
 * Facilitator-token equivalent of `CloseSessionButton`, for the mobile
 * pilotage screen (/facilitate/[code]), which has no Supabase Auth session.
 */
export function CloseSessionAsFacilitatorButton({
  sessionId,
  facilitatorToken,
}: {
  sessionId: string;
  facilitatorToken: string;
}) {
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = useCallback(async () => {
    setClosing(true);
    setError(null);

    const result = await closeSessionAsFacilitator(sessionId, facilitatorToken);

    if (!result.success) {
      setError(result.error);
      setClosing(false);
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
