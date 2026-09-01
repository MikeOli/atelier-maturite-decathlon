"use server";

import { createClient } from "@/lib/supabase/server";
import { joinSessionSchema } from "@/lib/schemas/participant";
import { AVATARS } from "@/lib/avatars";

export type Participant = {
  id: string;
  avatarKey: string;
  avatarLabel: string;
};

/**
 * Public listing — deliberately selects only id/avatar_key/avatar_label,
 * never client_token, even though the table's RLS `select using (true)`
 * policy would technically allow it (see migration comment on
 * `create_participants.sql` for the accepted tradeoff on that column).
 */
export async function listParticipants(
  sessionId: string,
): Promise<Participant[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("participants")
    .select("id, avatar_key, avatar_label")
    .eq("session_id", sessionId);

  if (error || !data) return [];

  return data.map((p) => ({
    id: p.id,
    avatarKey: p.avatar_key,
    avatarLabel: p.avatar_label,
  }));
}

/**
 * Restores an existing participant's identity from their client_token
 * (Story 2.2 AC#4). The token is only ever matched against the caller's own
 * localStorage value, never listed or broadcast to others.
 */
export async function findParticipantByClientToken(
  sessionId: string,
  clientToken: string,
): Promise<Participant | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("participants")
    .select("id, avatar_key, avatar_label")
    .eq("session_id", sessionId)
    .eq("client_token", clientToken)
    .maybeSingle();

  if (error || !data) return null;

  return { id: data.id, avatarKey: data.avatar_key, avatarLabel: data.avatar_label };
}

export type JoinSessionResult =
  | { success: true; data: Participant }
  | { success: false; error: string; code?: "avatar_taken" };

export async function joinSession(
  input: unknown,
): Promise<JoinSessionResult> {
  const parsed = joinSessionSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Formulaire invalide.",
    };
  }

  const { sessionId, avatarKey, clientToken } = parsed.data;

  const avatar = AVATARS.find((a) => a.key === avatarKey);
  if (!avatar) {
    return { success: false, error: "Avatar inconnu." };
  }

  const supabase = await createClient();

  // Story 4.8 (FR39): joining a closed session is nonsensical (voting
  // itself is independently blocked in submit_vote, VT004) — checked here
  // too so a participant gets a clear message instead of a pointless
  // "joined" state on a dead session. Plain read via the already-public
  // session_public_info view, no SECURITY DEFINER needed.
  const { data: session, error: sessionError } = await supabase
    .from("session_public_info")
    .select("status")
    .eq("id", sessionId)
    .maybeSingle();

  // A lookup failure must not fail open — an unreadable status is treated
  // the same as "can't confirm this session is joinable", not "it's fine".
  if (sessionError) {
    return { success: false, error: "Impossible de rejoindre la session." };
  }

  if (session?.status === "CLOTUREE") {
    return { success: false, error: "Cette session est clôturée." };
  }

  const { data, error } = await supabase
    .from("participants")
    .insert({
      session_id: sessionId,
      avatar_key: avatar.key,
      avatar_label: avatar.label,
      client_token: clientToken,
    })
    .select("id, avatar_key, avatar_label")
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        success: false,
        code: "avatar_taken",
        error: "Cet avatar vient d'être pris par quelqu'un d'autre. Choisis-en un autre.",
      };
    }
    return { success: false, error: "Impossible de rejoindre la session." };
  }

  return {
    success: true,
    data: { id: data.id, avatarKey: data.avatar_key, avatarLabel: data.avatar_label },
  };
}
