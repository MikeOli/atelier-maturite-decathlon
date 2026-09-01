"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  revealVotes,
  goToNextCard,
  setCardConsensus,
} from "@/features/sessions/actions";
import { getRevealedVotes, type RevealedVote } from "@/features/voting/actions";
import { RevealedVotes } from "@/features/voting/components/revealed-votes";
import { ConsensusPicker } from "@/features/voting/components/consensus-picker";
import { useConsensusValue } from "@/features/voting/use-consensus-value";
import { Button } from "@/components/ui/button";

export function RevealPanel({
  sessionId,
  cardId,
  initialVotesRevealed,
  hasNextCard,
  initialConsensusValue,
}: {
  sessionId: string;
  cardId: string | null;
  initialVotesRevealed: boolean;
  hasNextCard: boolean;
  initialConsensusValue: number | null;
}) {
  const router = useRouter();
  const [revealed, setRevealed] = useState(initialVotesRevealed);
  const [votes, setVotes] = useState<RevealedVote[]>([]);
  const [revealing, setRevealing] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  // Server-confirmed `hasNextCard` (Subtask 2.1) hides the button up front;
  // this stays as a fallback in case goToNextCard still reports
  // no-more-cards despite that snapshot (e.g. stale prop).
  const [noMoreCards, setNoMoreCards] = useState(!hasNextCard);
  const [error, setError] = useState<string | null>(null);
  const {
    value: consensusValue,
    pendingValue: pendingConsensusValue,
    submit: handleSetConsensus,
  } = useConsensusValue(
    initialConsensusValue,
    (value) => setCardConsensus({ sessionId, cardId, value }),
    setError,
  );

  useEffect(() => {
    if (!revealed || !cardId) return;
    getRevealedVotes(sessionId, cardId).then(setVotes);
  }, [revealed, sessionId, cardId]);

  const handleReveal = useCallback(async () => {
    setRevealing(true);
    setError(null);

    const result = await revealVotes(sessionId);

    if (!result.success) {
      setError(result.error);
      setRevealing(false);
      return;
    }

    setRevealed(true);
    setRevealing(false);
  }, [sessionId]);

  const handleNextCard = useCallback(async () => {
    setAdvancing(true);
    setError(null);

    const result = await goToNextCard(sessionId);

    if (!result.success) {
      if (result.code === "no-more-cards") {
        setNoMoreCards(true);
      } else {
        setError(result.error);
      }
      setAdvancing(false);
      return;
    }

    // The new card's id becomes this component's `key` (set by the parent
    // Server Component after refresh), so a remount with fresh props is
    // what actually resets `revealed`/`votes` — not local state surgery
    // here, consistent with "state derived from server truth" everywhere
    // else in this codebase.
    router.refresh();
  }, [sessionId, router]);

  if (!cardId) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-5 shadow-sm">
      <p className="font-display font-bold">Votes</p>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {revealed ? (
        <>
          <RevealedVotes votes={votes} />
          <ConsensusPicker
            value={consensusValue}
            pendingValue={pendingConsensusValue}
            onSubmit={handleSetConsensus}
          />
          {noMoreCards ? (
            <p className="text-muted-foreground text-sm">
              C&apos;était la dernière carte du deck.
            </p>
          ) : (
            <>
              <Button
                type="button"
                onClick={handleNextCard}
                disabled={advancing || consensusValue === null}
                className="self-start"
              >
                {advancing ? "Passage à la carte suivante…" : "Carte suivante"}
              </Button>
              {consensusValue === null && (
                <p className="text-muted-foreground text-sm">
                  Saisis la valeur d&apos;accord d&apos;équipe pour continuer.
                </p>
              )}
            </>
          )}
        </>
      ) : (
        <Button
          type="button"
          onClick={handleReveal}
          disabled={revealing}
          className="self-start"
        >
          {revealing ? "Révélation…" : "Révéler les votes"}
        </Button>
      )}
    </div>
  );
}
