"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  getSessionCurrentCard,
  type SessionCurrentCard,
} from "@/features/sessions/actions";
import {
  getRevealedVotes,
  getVotedParticipants,
  type RevealedVote,
} from "@/features/voting/actions";
import { CardDisplay } from "@/features/voting/components/card-display";
import { RevealedVotes } from "@/features/voting/components/revealed-votes";
import { VoteStatusPanel } from "@/features/board/components/vote-status-panel";
import { SessionTimer } from "@/features/sessions/components/session-timer";
import { ParticipantsPanel } from "@/features/participants/components/participants-panel";
import type { Participant } from "@/features/participants/actions";

export function SessionBoard({
  sessionId,
  currentCard,
  initialVotesRevealed,
  createdAt,
  durationMinutes,
  joinUrl,
  qrCodeSvg,
  deckName,
  deckDescription,
  initialParticipants,
}: {
  sessionId: string;
  currentCard: SessionCurrentCard | null;
  initialVotesRevealed: boolean;
  createdAt: string;
  durationMinutes: number;
  joinUrl: string;
  qrCodeSvg: string;
  deckName: string;
  deckDescription: string;
  initialParticipants: Participant[];
}) {
  const [card, setCard] = useState(currentCard);
  const [revealed, setRevealed] = useState(initialVotesRevealed);
  const [revealedVotes, setRevealedVotes] = useState<RevealedVote[]>([]);
  const [votedAvatarKeys, setVotedAvatarKeys] = useState<string[]>([]);
  // Own live copy, not just the initial snapshot — VoteStatusPanel needs to
  // know about a participant who joins after this page loaded (the normal
  // flow: the board is opened first, then people scan the QR code), same
  // pattern as ParticipantsPanel's own INSERT subscription below.
  const [participants, setParticipants] = useState<Participant[]>(
    initialParticipants,
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

  useEffect(() => {
    if (revealed || !card) {
      setVotedAvatarKeys([]);
      return;
    }
    // Same rationale as VoteCard's getMyVote effect: if the facilitator
    // advances cards twice before this resolves, a stale answer for the
    // now-superseded card must never clobber the current one.
    let cancelled = false;
    getVotedParticipants(sessionId, card.cardId).then((voters) => {
      if (!cancelled) setVotedAvatarKeys(voters.map((v) => v.avatarKey));
    });
    return () => {
      cancelled = true;
    };
  }, [revealed, sessionId, card]);

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
            cardIdRef.current = next.current_card_id;
            setRevealedVotes([]);
            const seq = ++fetchSeqRef.current;
            getSessionCurrentCard(sessionId).then((fetchedCard) => {
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

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`board-participants:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "participants",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as {
            id?: string;
            avatar_key?: string;
            avatar_label?: string;
          };
          const { id, avatar_key: avatarKey, avatar_label: avatarLabel } = row;
          if (!id || !avatarKey || !avatarLabel) return;
          setParticipants((prev) =>
            prev.some((p) => p.id === id)
              ? prev
              : [...prev, { id, avatarKey, avatarLabel }],
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  return (
    <div className="flex flex-col gap-8 w-full max-w-2xl text-left">
      <div className="border-b pb-4">
        <SessionTimer createdAt={createdAt} durationMinutes={durationMinutes} />
      </div>

      {card ? (
        <CardDisplay card={card} />
      ) : (
        <div className="flex flex-col gap-6 items-center">
          <div className="flex flex-col gap-1 text-center">
            <h2 className="text-xl font-semibold">{deckName}</h2>
            {deckDescription && (
              <p className="text-muted-foreground text-base">
                {deckDescription}
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <div
                role="img"
                aria-label={`QR code pour rejoindre la session via ${joinUrl}`}
                className="w-48 h-48"
                dangerouslySetInnerHTML={{ __html: qrCodeSvg }}
              />
            </div>
            <code className="text-sm font-bold text-foreground-soft">
              {joinUrl}
            </code>
          </div>
          <ParticipantsPanel
            sessionId={sessionId}
            initialParticipants={participants}
          />
        </div>
      )}

      {card &&
        (revealed ? (
          <RevealedVotes votes={revealedVotes} />
        ) : (
          <VoteStatusPanel
            key={card.cardId}
            sessionId={sessionId}
            cardId={card.cardId}
            participants={participants}
            initialVotedAvatarKeys={votedAvatarKeys}
          />
        ))}
    </div>
  );
}
