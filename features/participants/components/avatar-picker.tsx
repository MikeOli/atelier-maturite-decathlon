"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { AVATARS } from "@/lib/avatars";
import { AvatarGlyph } from "@/components/avatar-glyph";
import { Button } from "@/components/ui/button";
import {
  joinSession,
  findParticipantByClientToken,
  type Participant,
} from "@/features/participants/actions";
import { VoteCard } from "@/features/voting/components/vote-card";
import { cn } from "@/lib/utils";
import type { SessionCurrentCard } from "@/features/sessions/actions";

function storageKey(sessionId: string) {
  return `atelier:participant:${sessionId}`;
}

export function AvatarPicker({
  sessionId,
  initialTakenKeys,
  currentCard,
  initialVotesRevealed,
  transcriptionEnabled,
}: {
  sessionId: string;
  initialTakenKeys: string[];
  currentCard: SessionCurrentCard | null;
  initialVotesRevealed: boolean;
  transcriptionEnabled: boolean;
}) {
  const [takenKeys, setTakenKeys] = useState<Set<string>>(
    new Set(initialTakenKeys),
  );
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [clientToken, setClientToken] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Story 5.6 (FR49): purely local, never persisted — consent is about the
  // attempt to join happening right now, not a record to keep. Resets on
  // reload, same as the rest of this component's un-restored state; only
  // an already-restored participant (below) skips this gate entirely.
  const [consentDecision, setConsentDecision] = useState<
    "pending" | "accepted" | "declined"
  >("pending");

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(storageKey(sessionId));
    } catch {
      setRestoring(false);
      return;
    }
    if (!stored) {
      setRestoring(false);
      return;
    }
    findParticipantByClientToken(sessionId, stored)
      .then((found) => {
        if (found) {
          setParticipant(found);
          setClientToken(stored);
        } else {
          localStorage.removeItem(storageKey(sessionId));
        }
      })
      .catch(() => {})
      .finally(() => setRestoring(false));
  }, [sessionId]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`participants:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "participants",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const avatarKey = (payload.new as { avatar_key?: string })
            .avatar_key;
          if (avatarKey) {
            setTakenKeys((prev) => new Set(prev).add(avatarKey));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  useEffect(() => {
    if (!participant) return;

    const supabase = createClient();
    const channel = supabase.channel(`presence:${sessionId}`, {
      config: { presence: { key: participant.id } },
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ participantId: participant.id });
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, participant]);

  const handleSelect = useCallback(
    async (avatarKey: string) => {
      if (joining || takenKeys.has(avatarKey)) return;
      setJoining(avatarKey);
      setError(null);

      const clientToken = crypto.randomUUID();
      const result = await joinSession({ sessionId, avatarKey, clientToken });

      if (!result.success) {
        setError(result.error);
        if (result.code === "avatar_taken") {
          setTakenKeys((prev) => new Set(prev).add(avatarKey));
        }
        setJoining(null);
        return;
      }

      try {
        localStorage.setItem(storageKey(sessionId), clientToken);
      } catch {
        // Identity won't survive a reload, but the join itself succeeded.
      }
      setParticipant(result.data);
      setClientToken(clientToken);
      setJoining(null);
    },
    [joining, takenKeys, sessionId],
  );

  if (restoring) {
    return null;
  }

  if (participant && clientToken) {
    const avatar = AVATARS.find((a) => a.key === participant.avatarKey);
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex flex-col items-center gap-2">
          <AvatarGlyph avatar={avatar} size={64} className="h-16 w-16 text-5xl" />
          <p className="text-lg font-semibold">
            Tu es {participant.avatarLabel}
          </p>
        </div>
        <VoteCard
          sessionId={sessionId}
          participantId={participant.id}
          clientToken={clientToken}
          avatarKey={participant.avatarKey}
          currentCard={currentCard}
          initialVotesRevealed={initialVotesRevealed}
        />
      </div>
    );
  }

  if (transcriptionEnabled && consentDecision === "pending") {
    return (
      <div className="flex flex-col gap-4 w-full max-w-md rounded-[18px] border bg-card px-[18px] py-5 text-center shadow-sm">
        <p className="text-sm">
          Cette session est transcrite. La discussion est retranscrite en
          texte (aucun audio n&apos;est enregistré), puis anonymisée à des
          fins de synthèse.
        </p>
        <div className="flex justify-center gap-3">
          <Button
            type="button"
            onClick={() => setConsentDecision("accepted")}
          >
            J&apos;accepte
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setConsentDecision("declined")}
          >
            Je refuse
          </Button>
        </div>
      </div>
    );
  }

  if (transcriptionEnabled && consentDecision === "declined") {
    return (
      <p className="text-muted-foreground text-center text-sm max-w-md">
        Tu as refusé la transcription — tu ne peux pas rejoindre cette
        session.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full max-w-2xl">
      <p className="text-muted-foreground text-center text-sm">
        Choisis ton avatar pour rejoindre la session.
      </p>
      {error && (
        <p role="alert" className="text-destructive text-center text-sm">
          {error}
        </p>
      )}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {AVATARS.map((avatar) => {
          const taken = takenKeys.has(avatar.key);
          return (
            <button
              key={avatar.key}
              type="button"
              disabled={taken || joining !== null}
              onClick={() => handleSelect(avatar.key)}
              aria-disabled={taken}
              className={cn(
                "flex flex-col items-center gap-2 rounded-[18px] border bg-card px-3 py-4 text-center shadow-sm transition-colors",
                taken
                  ? "opacity-40 cursor-not-allowed"
                  : "hover:bg-accent cursor-pointer",
                joining === avatar.key && "animate-pulse bg-lav border-lav-foreground/30",
              )}
            >
              <AvatarGlyph avatar={avatar} size={56} className="h-14 w-14 text-4xl" />
              <span className="text-xs font-medium">{avatar.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
