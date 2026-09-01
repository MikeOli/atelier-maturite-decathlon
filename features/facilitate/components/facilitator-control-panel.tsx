"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  revealVotesAsFacilitator,
  goToNextCardAsFacilitator,
  setCardConsensusAsFacilitator,
  getSessionCurrentCard,
  getCardConsensus,
  type SessionCurrentCard,
} from "@/features/sessions/actions";
import { getRevealedVotes, type RevealedVote } from "@/features/voting/actions";
import { CardDisplay } from "@/features/voting/components/card-display";
import { RevealedVotes } from "@/features/voting/components/revealed-votes";
import { ConsensusPicker } from "@/features/voting/components/consensus-picker";
import { useConsensusValue } from "@/features/voting/use-consensus-value";
import { SessionTimer } from "@/features/sessions/components/session-timer";
import { Button } from "@/components/ui/button";

export function FacilitatorControlPanel({
  sessionId,
  facilitatorToken,
  currentCard,
  initialVotesRevealed,
  initialConsensusValue,
  createdAt,
  durationMinutes,
}: {
  sessionId: string;
  facilitatorToken: string;
  currentCard: SessionCurrentCard | null;
  initialVotesRevealed: boolean;
  initialConsensusValue: number | null;
  createdAt: string;
  durationMinutes: number;
}) {
  const [card, setCard] = useState(currentCard);
  const [revealed, setRevealed] = useState(initialVotesRevealed);
  const [revealedVotes, setRevealedVotes] = useState<RevealedVote[]>([]);
  const [revealing, setRevealing] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [noMoreCards, setNoMoreCards] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    value: consensusValue,
    setValue: setConsensusValue,
    pendingValue: pendingConsensusValue,
    submit: handleSetConsensus,
  } = useConsensusValue(
    initialConsensusValue,
    (value) => {
      // Structurally unreachable: ConsensusPicker only renders when `card`
      // is truthy (see `{card && (revealed ? ...`` below) — this branch
      // exists only to satisfy the type checker.
      if (!card) {
        return Promise.resolve({
          success: false as const,
          error: "Aucune carte active.",
        });
      }
      return setCardConsensusAsFacilitator(
        sessionId,
        facilitatorToken,
        card.cardId,
        value,
      );
    },
    setError,
  );
  const cardIdRef = useRef(currentCard?.cardId ?? null);
  const fetchSeqRef = useRef(0);

  useEffect(() => {
    cardIdRef.current = card?.cardId ?? null;
  }, [card]);

  useEffect(() => {
    if (!revealed || !card) return;
    getRevealedVotes(sessionId, card.cardId).then(setRevealedVotes);
  }, [revealed, sessionId, card]);

  // FR37/FR38 (Story 4.7): pilotage authority is a bearer token
  // (facilitator_token), not tied to a device. Never add presence tracking
  // (.track()) or single-active-device exclusivity here — any number of
  // devices must be able to hold this link and act simultaneously, with no
  // recovery procedure needed if one disconnects.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`session-live-state:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "session_live_state",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const next = payload.new as {
            current_card_id?: string | null;
            votes_revealed?: boolean;
          };

          if (next.current_card_id && next.current_card_id !== cardIdRef.current) {
            const newCardId = next.current_card_id;
            cardIdRef.current = newCardId;
            setNoMoreCards(false);
            setRevealedVotes([]);
            // Story 3.8: unlike `RevealPanel` (remounted via `key` on card
            // change), this component never remounts — its state must be
            // reset by hand here, same treatment as `noMoreCards`/
            // `revealedVotes` above. Skipping this would reproduce the exact
            // bug already flagged for `VoteCard` in Stories 3.1/3.2 (stale
            // per-card state surviving a card change).
            //
            // Code review fix (2026-08-21): don't just assume "no consensus
            // yet" — pilotage is multi-device (FR37/FR38), so another
            // facilitator device may have already recorded a value for this
            // card. Refetch the real value, same sequence-guard pattern as
            // the card fetch below, so a stale response can't clobber a
            // newer one.
            const seq = ++fetchSeqRef.current;
            Promise.all([
              getSessionCurrentCard(sessionId),
              getCardConsensus(sessionId, newCardId),
            ]).then(([fetchedCard, consensus]) => {
              if (seq === fetchSeqRef.current) {
                setCard(fetchedCard);
                setConsensusValue(consensus);
              }
            });
          }

          if (typeof next.votes_revealed === "boolean") {
            setRevealed(next.votes_revealed);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, setConsensusValue]);

  const handleReveal = async () => {
    setRevealing(true);
    setError(null);

    const result = await revealVotesAsFacilitator(sessionId, facilitatorToken);

    if (!result.success) {
      setError(result.error);
      setRevealing(false);
      return;
    }

    setRevealed(true);
    setRevealing(false);
  };

  const handleNextCard = async () => {
    setAdvancing(true);
    setError(null);

    const result = await goToNextCardAsFacilitator(sessionId, facilitatorToken);

    if (!result.success) {
      if (result.code === "no-more-cards") {
        setNoMoreCards(true);
      } else {
        setError(result.error);
      }
      setAdvancing(false);
      return;
    }

    setAdvancing(false);
  };

  return (
    <div className="flex flex-col gap-6 w-full text-left rounded-lg border bg-card p-5 shadow-sm">
      <SessionTimer createdAt={createdAt} durationMinutes={durationMinutes} />

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      {card ? (
        <CardDisplay card={card} />
      ) : (
        <p className="text-muted-foreground text-sm">
          En attente du démarrage du vote…
        </p>
      )}

      {card &&
        (revealed ? (
          <>
            <RevealedVotes votes={revealedVotes} />
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
        ))}
    </div>
  );
}
