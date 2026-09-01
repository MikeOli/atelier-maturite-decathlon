"use server";

import { createClient } from "@/lib/supabase/server";
import { submitVoteSchema, getMyVoteSchema } from "@/lib/schemas/vote";
import type { ActionResult } from "@/features/sessions/actions";

/**
 * Votes are intentionally unreadable via RLS before reveal (AC#2), and
 * PostgreSQL's row security requires SELECT-visibility of a row for ANY
 * write that needs to locate an existing row — not just `.upsert()`'s
 * `ON CONFLICT DO UPDATE`, but a plain `UPDATE ... WHERE` too (see Story
 * 3.1/3.2 Debug Logs for how this was discovered). The `submit_vote`
 * Postgres function is `SECURITY DEFINER`, so it bypasses RLS internally
 * while still enforcing participant ownership (client_token) and the
 * voting-window checks (not revealed, current card) in SQL before writing
 * anything — the single source of truth for those rules, not just an
 * app-layer check.
 */
export async function submitVote(
  input: unknown,
): Promise<ActionResult<null>> {
  const parsed = submitVoteSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Formulaire invalide.",
    };
  }

  const { sessionId, cardId, participantId, clientToken, value } =
    parsed.data;

  const supabase = await createClient();

  const { error } = await supabase.rpc("submit_vote", {
    p_session_id: sessionId,
    p_card_id: cardId,
    p_participant_id: participantId,
    p_client_token: clientToken,
    p_value: value,
  });

  if (error) {
    if (error.code === "VT001") {
      return { success: false, error: "Participant invalide." };
    }
    if (error.code === "VT002") {
      return {
        success: false,
        error: "Le vote n'est plus ouvert pour cette carte.",
      };
    }
    if (error.code === "VT003") {
      return { success: false, error: "Valeur de vote invalide." };
    }
    if (error.code === "VT004") {
      return { success: false, error: "Cette session est clôturée." };
    }
    return { success: false, error: "Impossible d'enregistrer le vote." };
  }

  return { success: true, data: null };
}

/**
 * Restores a participant's own already-submitted vote after a
 * reload/reconnect (Story 4.1). Same RLS problem as `submitVote`: `votes`
 * is unreadable before reveal even to the voter, so this goes through the
 * `get_my_vote` SECURITY DEFINER function rather than a plain `.select()`.
 * Any failure (invalid participant, no vote yet) collapses to `null` —
 * consistent with `getSessionCurrentCard`/`getRevealedVotes`, no exception
 * surfaced to the UI for what is just an empty/absent state.
 */
export async function getMyVote(input: unknown): Promise<number | null> {
  const parsed = getMyVoteSchema.safeParse(input);

  if (!parsed.success) return null;

  const { sessionId, cardId, participantId, clientToken } = parsed.data;

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_my_vote", {
    p_session_id: sessionId,
    p_card_id: cardId,
    p_participant_id: participantId,
    p_client_token: clientToken,
  });

  if (error) return null;

  return data;
}

export type RevealedVote = {
  avatarKey: string;
  avatarLabel: string;
  value: number;
};

/**
 * Reads the revealed votes for a card, each joined to the avatar that cast
 * it (FR13). RLS on `votes` only allows this once
 * `sessions.votes_revealed = true` (Story 3.1) — before that, this simply
 * returns an empty list for anyone, participant or admin alike.
 */
export async function getRevealedVotes(
  sessionId: string,
  cardId: string,
): Promise<RevealedVote[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("votes")
    .select("value, participants(avatar_key, avatar_label)")
    .eq("session_id", sessionId)
    .eq("card_id", cardId);

  if (error || !data) return [];

  return data
    .filter((row) => row.participants !== null)
    .map((row) => ({
      avatarKey: row.participants!.avatar_key,
      avatarLabel: row.participants!.avatar_label,
      value: row.value,
    }));
}

export type VotedParticipant = {
  avatarKey: string;
  avatarLabel: string;
};

/**
 * Who has voted on a card, before reveal — for the "qui a voté" indicator
 * on the projected board (`/board/[code]`). Never returns `value`: unlike
 * `getRevealedVotes`, this goes through the `get_voters_for_card` SECURITY
 * DEFINER function specifically because a plain `.select()` on `votes`
 * would be blocked by RLS before reveal (same reason `submitVote`/
 * `getMyVote` go through RPCs) — and even once accessible, `value` is never
 * part of the query at all, not just filtered out in the app layer.
 */
export async function getVotedParticipants(
  sessionId: string,
  cardId: string,
): Promise<VotedParticipant[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_voters_for_card", {
    p_session_id: sessionId,
    p_card_id: cardId,
  });

  if (error || !data) return [];

  return data.map((row) => ({
    avatarKey: row.avatar_key,
    avatarLabel: row.avatar_label,
  }));
}
