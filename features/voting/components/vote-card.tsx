"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  submitVote,
  getMyVote,
  getRevealedVotes,
  type RevealedVote,
} from "@/features/voting/actions";
import { RevealedVotes } from "@/features/voting/components/revealed-votes";
import { CardDisplay } from "@/features/voting/components/card-display";
import { MaturityScaleGrid } from "@/features/voting/components/maturity-scale-grid";
import {
  getSessionCurrentCard,
  type SessionCurrentCard,
} from "@/features/sessions/actions";

export function VoteCard({
  sessionId,
  participantId,
  clientToken,
  avatarKey,
  currentCard,
  initialVotesRevealed,
}: {
  sessionId: string;
  participantId: string;
  clientToken: string;
  avatarKey: string;
  currentCard: SessionCurrentCard | null;
  initialVotesRevealed: boolean;
}) {
  const [card, setCard] = useState(currentCard);
  const [submittedValue, setSubmittedValue] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(initialVotesRevealed);
  const [revealedVotes, setRevealedVotes] = useState<RevealedVote[]>([]);
  const cardIdRef = useRef(currentCard?.cardId ?? null);
  const fetchSeqRef = useRef(0);
  const votesChannelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    cardIdRef.current = card?.cardId ?? null;
  }, [card]);

  useEffect(() => {
    if (!revealed || !card) return;
    getRevealedVotes(sessionId, card.cardId).then(setRevealedVotes);
  }, [revealed, sessionId, card]);

  useEffect(() => {
    if (!card) return;
    // Restores an already-submitted vote for this card — covers both a
    // cold reconnect (page reload after losing connection, Story 4.1) and
    // a live card change (correctly resolves to null for a card this
    // participant hasn't voted on yet, same as the explicit reset above).
    // `cancelled` discards the response if `card` changes again before
    // this resolves — a stale answer for a superseded card must never
    // clobber the current one (same rationale as `fetchSeqRef` above).
    let cancelled = false;
    getMyVote({ sessionId, cardId: card.cardId, participantId, clientToken }).then(
      (value) => {
        if (!cancelled) setSubmittedValue(value);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [card, sessionId, participantId, clientToken]);

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
            // Admin advanced to the next card (Story 3.4): this
            // participant's previous vote/reveal state no longer applies —
            // fetch the new card and re-open voting.
            cardIdRef.current = next.current_card_id;
            setSubmittedValue(null);
            setRevealedVotes([]);
            const seq = ++fetchSeqRef.current;
            getSessionCurrentCard(sessionId).then((fetchedCard) => {
              // Discard if a newer card change fired and resolved first —
              // an in-flight fetch for an already-superseded card must
              // never clobber the current one.
              if (seq === fetchSeqRef.current) {
                setCard(fetchedCard);
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
  }, [sessionId]);

  // Broadcast-only channel — never a `postgres_changes` subscription on
  // `votes`, which stays RLS-blocked before reveal (see
  // getVotedParticipants). Tells the projected board "someone voted",
  // never what they voted; the board resolves the real state on its own
  // via `getVotedParticipants` on mount/card change, this is purely the
  // live nudge in between — cosmetic and best-effort by design, never the
  // source of truth (unlike the vote itself, which is never taken from a
  // broadcast). Assigning the ref only on "SUBSCRIBED" (not right after
  // calling .subscribe()) avoids a real race: sending before the channel
  // is actually subscribed can silently drop the message.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`card-votes:${sessionId}`);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        votesChannelRef.current = channel;
      }
    });

    return () => {
      supabase.removeChannel(channel);
      votesChannelRef.current = null;
    };
  }, [sessionId]);

  const handleVote = useCallback(
    async (value: number) => {
      if (!card || submitting !== null || value === submittedValue) {
        return;
      }
      setSubmitting(value);
      setError(null);

      const result = await submitVote({
        sessionId,
        cardId: card.cardId,
        participantId,
        clientToken,
        value,
      });

      if (!result.success) {
        // Keep the last confirmed value displayed — a failed change
        // attempt (e.g. reveal happened server-side in the meantime)
        // shouldn't erase what was actually recorded.
        setError(result.error);
        setSubmitting(null);
        return;
      }

      setSubmittedValue(value);
      setSubmitting(null);

      // Best-effort — never blocks on this, never retried. A dropped
      // broadcast just means the board catches up on its next
      // getVotedParticipants fetch (card change) instead of live.
      votesChannelRef.current?.send({
        type: "broadcast",
        event: "voted",
        payload: { cardId: card.cardId, avatarKey },
      });
    },
    [
      card,
      submitting,
      submittedValue,
      sessionId,
      participantId,
      clientToken,
      avatarKey,
    ],
  );

  if (!card) {
    return (
      <p className="text-muted-foreground text-sm">
        En attente du démarrage du vote…
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full max-w-2xl text-left rounded-lg border bg-card p-6 shadow-sm">
      <CardDisplay card={card} />

      {revealed ? (
        <RevealedVotes votes={revealedVotes} />
      ) : (
        <>
          {error && (
            <p role="alert" className="text-destructive text-center text-sm">
              {error}
            </p>
          )}

          {submittedValue !== null && (
            <p className="text-center text-sm text-muted-foreground">
              Vote enregistré : {submittedValue} — tu peux encore changer
              avant la révélation.
            </p>
          )}
          <MaturityScaleGrid
            selectedValue={submittedValue}
            pendingValue={submitting}
            onSelect={handleVote}
          />
        </>
      )}
    </div>
  );
}
