"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AVATARS } from "@/lib/avatars";
import { AvatarGlyph } from "@/components/avatar-glyph";
import { cn } from "@/lib/utils";
import type { Participant } from "@/features/participants/actions";

export function ParticipantsPanel({
  sessionId,
  initialParticipants,
}: {
  sessionId: string;
  initialParticipants: Participant[];
}) {
  const [participants, setParticipants] = useState<Participant[]>(
    initialParticipants,
  );
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`presence:${sessionId}`);

    channel
      .on("presence", { event: "sync" }, () => {
        setOnlineIds(new Set(Object.keys(channel.presenceState())));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`admin-participants:${sessionId}`)
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
    <div className="flex flex-col gap-3">
      <p className="font-medium">
        Participants ({participants.length})
      </p>
      {participants.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          En attente des premiers participants…
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {participants.map((participant) => {
            const avatar = AVATARS.find(
              (a) => a.key === participant.avatarKey,
            );
            const online = onlineIds.has(participant.id);
            return (
              <li
                key={participant.id}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm",
                  online && "bg-sky border-transparent",
                )}
              >
                <AvatarGlyph avatar={avatar} size={16} />
                <span>{participant.avatarLabel}</span>
                <span
                  className={cn(
                    "flex items-center gap-1 text-xs",
                    online ? "text-sky-foreground" : "text-muted-foreground",
                  )}
                >
                  <span aria-hidden="true">{online ? "●" : "○"}</span>
                  {online ? "Connecté" : "Déconnecté"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
