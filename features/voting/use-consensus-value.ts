import { useCallback, useState } from "react";
import type { ActionResult } from "@/features/sessions/actions";

/**
 * Shared consensus-entry state machine — extracted during code review
 * (2026-08-21) after `RevealPanel` (admin) and `FacilitatorControlPanel`
 * (facilitator) had duplicated this near-verbatim, differing only in which
 * Server Action they call. `setError` is passed in rather than owned here
 * so both callers keep showing a single error line shared with their other
 * actions (reveal, next card), instead of a second one just for consensus.
 */
export function useConsensusValue(
  initialValue: number | null,
  submitConsensus: (value: number) => Promise<ActionResult<null>>,
  setError: (error: string | null) => void,
) {
  const [value, setValue] = useState(initialValue);
  const [pendingValue, setPendingValue] = useState<number | null>(null);

  const submit = useCallback(
    async (candidate: number) => {
      setPendingValue(candidate);
      setError(null);

      const result = await submitConsensus(candidate);

      if (!result.success) {
        setError(result.error);
        setPendingValue(null);
        return;
      }

      setValue(candidate);
      setPendingValue(null);
    },
    [submitConsensus, setError],
  );

  return { value, setValue, pendingValue, submit };
}
