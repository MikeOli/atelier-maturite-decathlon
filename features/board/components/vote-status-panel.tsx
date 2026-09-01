"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { AVATARS } from "@/lib/avatars";
import { AvatarGlyph } from "@/components/avatar-glyph";
import { cn } from "@/lib/utils";
import type { Participant } from "@/features/participants/actions";

/**
 * "Qui a voté" on the projected board, before reveal — never shows a
 * value, only presence. Mounted with `key={cardId}` by the parent so a
 * card change gets a clean remount (fresh `votedKeys` from the new
 * `initialVotedAvatarKeys`) rather than hand-rolled reset logic here.
 * Live updates ride the `card-votes:{sessionId}` broadcast channel
 * `vote-card.tsx` sends to on submit — a `postgres_changes` subscription
 * on `votes` would stay RLS-blocked before reveal (same reason
 * `getVotedParticipants` goes through a SECURITY DEFINER RPC instead of a
 * plain `.select()`).
 */
export function VoteStatusPanel({
  sessionId,
  cardId,
  participants,
  initialVotedAvatarKeys,
}: {
  sessionId: string;
  cardId: string;
  participants: Participant[];
  initialVotedAvatarKeys: string[];
}) {
  const [votedKeys, setVotedKeys] = useState<Set<string>>(
    () => new Set(initialVotedAvatarKeys),
  );

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`card-votes:${sessionId}`)
      .on("broadcast", { event: "voted" }, ({ payload }) => {
        const { cardId: votedCardId, avatarKey } = payload as {
          cardId?: string;
          avatarKey?: string;
        };
        if (votedCardId !== cardId || !avatarKey) return;
        // Broadcasts are unauthenticated (anyone holding the join link can
        // publish on this channel) — this is a cosmetic live nudge, never
        // the source of truth for whether someone actually voted, so
        // spoofing it only misleads this indicator, not the real vote
        // data. Still worth rejecting keys that aren't even a participant
        // of this session, so the counter can never exceed the roster.
        if (!participants.some((p) => p.avatarKey === avatarKey)) return;
        setVotedKeys((prev) => new Set(prev).add(avatarKey));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, cardId, participants]);

  if (participants.length === 0) {
    return (
      <p className="text-muted-foreground text-sm text-center">
        Personne n&apos;a encore rejoint la session.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p
        role="status"
        aria-live="polite"
        className="text-muted-foreground text-sm text-center"
      >
        {votedKeys.size} / {participants.length} ont voté
      </p>
      <ul className="flex flex-wrap justify-center gap-4">
        {participants.map((participant) => {
          const avatar = AVATARS.find((a) => a.key === participant.avatarKey);
          const voted = votedKeys.has(participant.avatarKey);
          return (
            <li
              key={participant.id}
              className={cn(
                "flex flex-col items-center rounded-[18px] border bg-card px-[18px] py-5 w-[150px] text-center shadow-sm transition-opacity",
                voted ? "opacity-100" : "opacity-40",
              )}
            >
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-sky text-lg">
                <AvatarGlyph avatar={avatar} size={40} className="h-full w-full" />
              </span>
              <span className="mb-3.5 text-[13.5px] font-medium leading-tight whitespace-nowrap">
                {participant.avatarLabel}
              </span>
              {voted && (
                <span className="whitespace-nowrap rounded-[14px] bg-primary px-2.5 py-2 text-xs font-medium text-primary-foreground">
                  A voté
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
