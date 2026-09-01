"use server";

import { createClient } from "@/lib/supabase/server";
import { createSessionSchema } from "@/lib/schemas/session";
import { setCardConsensusSchema } from "@/lib/schemas/consensus";
import {
  getSessionSynthesis,
  getSessionSynthesisAsFacilitator,
} from "@/features/synthesis/actions";
import {
  generateAiSynthesis,
  parseStoredAiSynthesis,
  type AiSynthesis,
} from "@/features/synthesis/ai-synthesis";

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function createSession(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();

  if (authError || !authData?.claims) {
    return { success: false, error: "Session admin invalide." };
  }

  const parsed = createSessionSchema.safeParse({
    teamName: formData.get("teamName"),
    durationMinutes: formData.get("durationMinutes"),
    deckId: formData.get("deckId"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Formulaire invalide.",
    };
  }

  const { teamName, durationMinutes, deckId } = parsed.data;

  const { data: deck, error: deckError } = await supabase
    .from("decks")
    .select("id")
    .eq("id", deckId)
    .eq("admin_id", authData.claims.sub)
    .maybeSingle();

  if (deckError || !deck) {
    return { success: false, error: "Deck invalide." };
  }

  // Story 3.9 (FR42): a newly created session has no active card — the
  // admin activates the first one explicitly via `startSession`, once the
  // team is ready. Card navigation (Story 3.4) still only ever moves
  // forward from whatever `startSession` set, so it's unaffected.
  const { data: session, error } = await supabase
    .from("sessions")
    .insert({
      admin_id: authData.claims.sub,
      team_name: teamName,
      duration_minutes: durationMinutes,
      deck_id: deckId,
      status: "EN_COURS",
      current_card_id: null,
    })
    .select("id")
    .single();

  if (error) {
    return { success: false, error: "Impossible de créer la session." };
  }

  // Mirror row for realtime broadcast (Story 3.3) — `session_live_state` is
  // the only thing anon clients can subscribe to live, since `sessions`
  // itself has no public SELECT (Story 2.1). A silent failure here would
  // leave a session with no way to ever notify participants of a reveal,
  // so roll the session back rather than report a false success.
  const { error: liveStateInsertError } = await supabase
    .from("session_live_state")
    .insert({
      session_id: session.id,
      current_card_id: null,
      votes_revealed: false,
    });

  if (liveStateInsertError) {
    await supabase.from("sessions").delete().eq("id", session.id);
    return { success: false, error: "Impossible de créer la session." };
  }

  return { success: true, data: { id: session.id } };
}

export type ActiveSessionSummary = {
  id: string;
  teamName: string;
  createdAt: string;
};

/**
 * Story 1.6 (FR40): lets an admin who left a session without closing it
 * (lost link, different device, another day) find their way back in. Read
 * pattern mirrors `getSessionDetail`/`listParticipants` — data or `[]`, not
 * `ActionResult<T>`, since this isn't a mutation. Never returns `CLOTUREE`
 * sessions — that's archival (FR21/Story 5.4), a separate concern.
 */
export async function listActiveSessionsForAdmin(
  adminId: string,
): Promise<ActiveSessionSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("id, team_name, created_at")
    .eq("admin_id", adminId)
    .eq("status", "EN_COURS")
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((s) => ({
    id: s.id,
    teamName: s.team_name,
    createdAt: s.created_at,
  }));
}

/**
 * Story 5.3/5.4 (FR51): lets an admin browse sessions already ended
 * ("Terminer la session", ex-"Clôturer") — the counterpart list that was
 * missing before this story (a `CLOTUREE` session used to be findable only
 * via a saved link, which read as if it had been deleted). Same read
 * pattern as `listActiveSessionsForAdmin`, reusing `ActiveSessionSummary`
 * as-is: identical shape, no reason for a separate type.
 */
export async function listCompletedSessionsForAdmin(
  adminId: string,
): Promise<ActiveSessionSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("id, team_name, created_at")
    .eq("admin_id", adminId)
    .eq("status", "CLOTUREE")
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((s) => ({
    id: s.id,
    teamName: s.team_name,
    createdAt: s.created_at,
  }));
}

/**
 * Story 5.3/5.4 (FR51): permanent deletion, only ever reachable from the
 * "Sessions terminées" list — never offered on an `EN_COURS` session. A
 * real `DELETE`, not a soft `archived` flag like card deletion (Story
 * 6.6): explicit user decision (2026-08-24), "no value in keeping data in
 * the database I can't see and no longer care about". Safe without any
 * cascade migration: `participants`/`votes`/`session_live_state`/
 * `card_consensus` all already reference `sessions(id)` with `on delete
 * cascade`. The `status = 'CLOTUREE'` filter is a defense-in-depth guard
 * against deleting an active session even if a future UI bug ever exposed
 * this action somewhere it shouldn't be.
 */
export async function deleteSession(
  sessionId: string,
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();

  if (authError || !authData?.claims) {
    return { success: false, error: "Session admin invalide." };
  }

  const { data, error } = await supabase
    .from("sessions")
    .delete()
    .eq("id", sessionId)
    .eq("admin_id", authData.claims.sub)
    .eq("status", "CLOTUREE")
    .select("id");

  if (error || !data || data.length === 0) {
    return {
      success: false,
      error: "Session invalide, ou pas encore terminée.",
    };
  }

  return { success: true, data: null };
}

export type SessionDetail = {
  id: string;
  teamName: string;
  durationMinutes: number;
  status: "EN_COURS" | "CLOTUREE";
  deckName: string;
  createdAt: string;
  facilitatorToken: string;
  // Story 5.5/5.6 setup moved to the admin session page (2026-08-23): the
  // admin already holds `facilitatorToken` here (used for the mobile
  // pilotage link), so `LiveTranscriptPanel` can be reused as-is on
  // /admin/sessions/[id] without a new SQL function.
  transcriptionEnabled: boolean;
  transcriptDraft: string | null;
  // Story 5.3 (FR20/FR50): `null` covers both "not generated yet" and "the
  // AI call failed" (NFR8/NFR14) — the synthesis screen must treat both
  // the same way, by simply not showing the AI section.
  aiSynthesis: AiSynthesis | null;
};

export async function getSessionDetail(
  sessionId: string,
  adminId: string,
): Promise<SessionDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select(
      "id, team_name, duration_minutes, status, decks(name), created_at, facilitator_token, transcription_enabled, transcript_draft, ai_synthesis",
    )
    .eq("id", sessionId)
    .eq("admin_id", adminId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    teamName: data.team_name,
    durationMinutes: data.duration_minutes,
    status: data.status as "EN_COURS" | "CLOTUREE",
    deckName: data.decks?.name ?? "",
    createdAt: data.created_at,
    facilitatorToken: data.facilitator_token,
    transcriptionEnabled: data.transcription_enabled ?? false,
    transcriptDraft: data.transcript_draft ?? null,
    aiSynthesis: parseStoredAiSynthesis(data.ai_synthesis),
  };
}

export type PublicSessionSummary = {
  id: string;
  teamName: string;
  status: "EN_COURS" | "CLOTUREE";
  durationMinutes: number;
  createdAt: string;
  // `transcriptionEnabled` is populated by both getSessionByFacilitatorToken
  // (Story 5.5, facilitator screen) and getPublicSessionSummary (Story 5.6,
  // participant consent banner) — a plain boolean, not sensitive. `transcriptDraft`
  // stays facilitator-only (FR48): the accumulated, not-yet-anonymized
  // text must never reach a participant-facing query.
  transcriptionEnabled?: boolean;
  transcriptDraft?: string | null;
};

// Story 3.10: only `getPublicSessionSummary` (board + participant screens,
// backed by the `session_public_info` view) carries deck info — kept out
// of the base `PublicSessionSummary` type because `getSessionByFacilitatorToken`
// also returns that type from a different source (the
// `get_session_by_facilitator_token` RPC), which has no deck columns and
// no need for them (the facilitator screen has no lobby).
export type PublicSessionSummaryWithDeck = PublicSessionSummary & {
  deckName: string;
  deckDescription: string;
};

/**
 * Read-only session lookup for participants, who have no Supabase account
 * (FR7) and therefore no admin_id to scope by. Queries the
 * `session_public_info` view (not the `sessions` table directly) — the view
 * exposes only a safe subset of columns and bypasses the table's
 * admin-only RLS by design, so no accidental over-exposure via RLS row
 * visibility. `durationMinutes`/`createdAt` (Story 3.5) let the participant
 * compute the same timer as the admin, purely client-side.
 */
export async function getPublicSessionSummary(
  sessionId: string,
): Promise<PublicSessionSummaryWithDeck | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("session_public_info")
    .select(
      "id, team_name, status, duration_minutes, created_at, deck_name, deck_description, transcription_enabled",
    )
    .eq("id", sessionId)
    .single();

  if (
    error ||
    !data ||
    !data.id ||
    !data.team_name ||
    !data.status ||
    !data.duration_minutes ||
    !data.created_at ||
    !data.deck_name
  ) {
    return null;
  }

  return {
    id: data.id,
    teamName: data.team_name,
    status: data.status as "EN_COURS" | "CLOTUREE",
    durationMinutes: data.duration_minutes,
    createdAt: data.created_at,
    deckName: data.deck_name,
    // Not checked above like the other fields: an empty description ('',
    // the column's own default — Story 1.7) is a valid, non-error state,
    // not a sign of a broken join. Falsy-but-valid, same trap as a
    // Fibonacci vote of 0 — never treat empty-string as absence here.
    deckDescription: data.deck_description ?? "",
    transcriptionEnabled: data.transcription_enabled ?? false,
  };
}

/**
 * Read-only session lookup for the mobile facilitator screen (Story 4.3),
 * keyed by `facilitator_token` rather than `id` — that token is the URL
 * segment for `/facilitate/[code]`, a secret distinct from the session id
 * shared with participants. Deliberately NOT a `.from("session_public_info")`
 * read: that view is granted `select` to `anon` on the whole view, not
 * per-column, so adding `facilitator_token` as a selectable column there
 * would let anyone read any session's token directly via PostgREST. Goes
 * through `get_session_by_facilitator_token` instead — a SECURITY DEFINER
 * function that takes the token as input and returns only the safe public
 * fields; the token itself is never selectable, only usable as a lookup key.
 *
 * FR37/FR38 (Story 4.7): `token` is the only credential this function
 * checks — never bind pilotage authority to a cookie, a Supabase Auth
 * session, or any other device-specific identifier. This is the entry point
 * a facilitator hits when picking the link back up on any device.
 */
export async function getSessionByFacilitatorToken(
  token: string,
): Promise<PublicSessionSummary | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_session_by_facilitator_token", {
      p_facilitator_token: token,
    })
    .maybeSingle();

  if (
    error ||
    !data ||
    !data.id ||
    !data.team_name ||
    !data.status ||
    !data.duration_minutes ||
    !data.created_at
  ) {
    return null;
  }

  return {
    id: data.id,
    teamName: data.team_name,
    status: data.status as "EN_COURS" | "CLOTUREE",
    durationMinutes: data.duration_minutes,
    createdAt: data.created_at,
    transcriptionEnabled: data.transcription_enabled ?? false,
    transcriptDraft: data.transcript_draft ?? null,
  };
}

export type SessionCurrentCard = {
  cardId: string;
  title: string;
  theme: string;
  bullets: string[];
};

/**
 * Reads the session's currently active card via the `session_current_card`
 * view — never the `cards` table directly, which stays admin-only. The view
 * joins on `sessions.current_card_id`, so it only ever exposes the one card
 * a participant is meant to see right now, not the whole deck.
 */
export async function getSessionCurrentCard(
  sessionId: string,
): Promise<SessionCurrentCard | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("session_current_card")
    .select("card_id, title, theme, bullets")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error || !data || !data.card_id || !data.title || !data.theme) {
    return null;
  }

  return {
    cardId: data.card_id,
    title: data.title,
    theme: data.theme,
    bullets: Array.isArray(data.bullets) ? (data.bullets as string[]) : [],
  };
}

export type SessionLiveState = {
  currentCardId: string | null;
  votesRevealed: boolean;
};

/**
 * Public read of the live-broadcast mirror (Story 3.3) — used both for the
 * initial SSR value and to know what shape to expect from the realtime
 * subscription on the same table.
 */
export async function getSessionLiveState(
  sessionId: string,
): Promise<SessionLiveState | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("session_live_state")
    .select("current_card_id, votes_revealed")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    currentCardId: data.current_card_id,
    votesRevealed: data.votes_revealed,
  };
}

/**
 * Reveals the votes for the session's current card. Runs under the admin's
 * own authenticated Supabase session (not the anon/client_token model used
 * by participants), so RLS ownership checks apply naturally — no
 * SECURITY DEFINER function needed here, unlike `submit_vote`.
 */
export async function revealVotes(
  sessionId: string,
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();

  if (authError || !authData?.claims) {
    return { success: false, error: "Session admin invalide." };
  }

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, status")
    .eq("id", sessionId)
    .eq("admin_id", authData.claims.sub)
    .maybeSingle();

  if (sessionError || !session) {
    return { success: false, error: "Session invalide." };
  }

  if (session.status === "CLOTUREE") {
    return { success: false, error: "Cette session est clôturée." };
  }

  const { error: sessionUpdateError } = await supabase
    .from("sessions")
    .update({ votes_revealed: true })
    .eq("id", sessionId);

  if (sessionUpdateError) {
    return { success: false, error: "Impossible de révéler les votes." };
  }

  const { error: liveStateError } = await supabase
    .from("session_live_state")
    .update({ votes_revealed: true, updated_at: new Date().toISOString() })
    .eq("session_id", sessionId);

  if (liveStateError) {
    // Don't leave votes readable (sessions.votes_revealed = true) while the
    // realtime mirror still says otherwise — that combination would let
    // getRevealedVotes return real data while no participant is ever
    // notified. Roll the first write back so a retry starts from a
    // consistent, all-or-nothing state.
    await supabase
      .from("sessions")
      .update({ votes_revealed: false })
      .eq("id", sessionId);
    return { success: false, error: "Impossible de révéler les votes." };
  }

  return { success: true, data: null };
}

/**
 * Explicitly closes a session (FR35, admin-only — same ownership pattern as
 * `revealVotes`). A single write on `sessions.status`; `session_live_state`
 * carries no `status` column (it only mirrors `current_card_id`/
 * `votes_revealed` for realtime voting, Story 3.3), so there is nothing to
 * keep in sync there. Idempotent by construction: closing an already
 * `CLOTUREE` session is a no-op UPDATE, no special-case needed.
 */
export async function closeSession(
  sessionId: string,
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();

  if (authError || !authData?.claims) {
    return { success: false, error: "Session admin invalide." };
  }

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, current_card_id, votes_revealed, transcript_draft")
    .eq("id", sessionId)
    .eq("admin_id", authData.claims.sub)
    .maybeSingle();

  if (sessionError || !session) {
    return { success: false, error: "Session invalide." };
  }

  // Story 3.8 code review fix (FR41): closing bypassed the "consensus
  // required" rule on the last card, since there's no "Carte suivante" to
  // gate there. Only enforced when votes are already revealed for the
  // current card — closing before that point (abandoning a session
  // mid-debate) is a legitimate, unrelated use of this action (Story 4.5).
  if (session.votes_revealed && session.current_card_id) {
    const { data: consensus } = await supabase
      .from("card_consensus")
      .select("value")
      .eq("session_id", sessionId)
      .eq("card_id", session.current_card_id)
      .maybeSingle();

    if (!consensus) {
      return {
        success: false,
        error: "Saisis la valeur d'accord d'équipe avant de clôturer la session.",
      };
    }
  }

  // Story 5.3 (FR20/FR50): best-effort AI synthesis, computed before the
  // close write so its result (or `null` on failure — generateAiSynthesis
  // never throws) can be stored in the same update. Must be awaited here,
  // never run in parallel with the update below, since the update needs
  // its result.
  const cards = await getSessionSynthesis(sessionId, authData.claims.sub);
  const aiSynthesis = await generateAiSynthesis(cards, session.transcript_draft ?? null);

  // Adversarial review finding (2026-08-24): closing is idempotent by
  // construction (re-closing an already-CLOTUREE session is a supported
  // no-op UPDATE, per this function's own doc comment above), but a second
  // call always re-runs the AI call too — whose result can be `null` (a
  // transient failure, or `transcript_draft` already wiped by the first
  // close). `ai_synthesis` is only included in the update when non-null, so
  // a retry can never stomp a result already stored by an earlier
  // successful close — same protection `close_session_as_facilitator`
  // already has via `coalesce(p_ai_synthesis, ai_synthesis)`.
  const { error: updateError } = await supabase
    .from("sessions")
    .update({
      status: "CLOTUREE",
      transcript_draft: null,
      transcription_enabled: false,
      ...(aiSynthesis !== null && { ai_synthesis: aiSynthesis }),
    })
    .eq("id", sessionId);

  if (updateError) {
    return { success: false, error: "Impossible de clôturer la session." };
  }

  return { success: true, data: null };
}

/**
 * Shared next-card resolution (order_index, same deck) used by both
 * `goToNextCard` and `hasNextCard` — kept as the single source of "what is
 * the next card" so the two never drift out of sync.
 */
async function findNextCardId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  deckId: string,
  afterOrderIndex: number,
): Promise<{ id: string | null; error: boolean }> {
  const { data: nextCard, error } = await supabase
    .from("cards")
    .select("id")
    .eq("deck_id", deckId)
    .gt("order_index", afterOrderIndex)
    .eq("archived", false)
    .order("order_index", { ascending: true })
    .limit(1)
    .maybeSingle();

  return { id: nextCard?.id ?? null, error: Boolean(error) };
}

export type GoToNextCardResult =
  | { success: true; data: { cardId: string } }
  | { success: false; error: string; code?: "no-more-cards" };

/**
 * Advances the session to the next card in the deck (FR15, admin-only —
 * ownership check below plus RLS on `sessions`/`session_live_state` make
 * this unreachable for a participant, satisfying AC#2 without any
 * dedicated guard elsewhere). Requires the current card's votes to already
 * be revealed (AC#1's Given) so the facilitator can't skip a debate.
 *
 * `votes_revealed` is reset to `false` on both `sessions` and
 * `session_live_state` — Story 3.3 deliberately deferred this (a
 * session-level flag, not a per-card one) until this story existed to
 * drive it. `votes` itself needs no reset: it's already scoped by
 * `card_id` (Story 3.1), so the new card simply has no rows yet.
 */
export async function goToNextCard(
  sessionId: string,
): Promise<GoToNextCardResult> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();

  if (authError || !authData?.claims) {
    return { success: false, error: "Session admin invalide." };
  }

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("deck_id, current_card_id, votes_revealed, status")
    .eq("id", sessionId)
    .eq("admin_id", authData.claims.sub)
    .maybeSingle();

  if (sessionError || !session) {
    return { success: false, error: "Session invalide." };
  }

  // Checked before `current_card_id` to match the order used by
  // `go_to_next_card_as_facilitator` (FT004 before FT003) — otherwise a
  // closed session with no active card would report "Session invalide."
  // instead of the closure-specific message.
  if (session.status === "CLOTUREE") {
    return { success: false, error: "Cette session est clôturée." };
  }

  if (!session.current_card_id) {
    return { success: false, error: "Session invalide." };
  }

  if (!session.votes_revealed) {
    return {
      success: false,
      error: "Révèle les votes avant de passer à la carte suivante.",
    };
  }

  // Story 3.8 (FR41): the facilitator must record the team's agreed value
  // for this card before advancing — mirrors the same gate enforced in SQL
  // by `go_to_next_card_as_facilitator` (FT005) for the facilitator path.
  const { data: consensus } = await supabase
    .from("card_consensus")
    .select("value")
    .eq("session_id", sessionId)
    .eq("card_id", session.current_card_id)
    .maybeSingle();

  if (!consensus) {
    return {
      success: false,
      error: "Saisis la valeur d'accord d'équipe avant de passer à la carte suivante.",
    };
  }

  const { data: currentCard, error: currentCardError } = await supabase
    .from("cards")
    .select("order_index")
    .eq("id", session.current_card_id)
    .maybeSingle();

  if (currentCardError || !currentCard) {
    return { success: false, error: "Carte active introuvable." };
  }

  const nextCard = await findNextCardId(
    supabase,
    session.deck_id,
    currentCard.order_index,
  );

  if (nextCard.error) {
    return { success: false, error: "Impossible de passer à la carte suivante." };
  }

  if (!nextCard.id) {
    return {
      success: false,
      error: "C'était la dernière carte du deck.",
      code: "no-more-cards",
    };
  }

  const { error: sessionUpdateError } = await supabase
    .from("sessions")
    .update({ current_card_id: nextCard.id, votes_revealed: false })
    .eq("id", sessionId);

  if (sessionUpdateError) {
    return { success: false, error: "Impossible de passer à la carte suivante." };
  }

  const { error: liveStateError } = await supabase
    .from("session_live_state")
    .update({
      current_card_id: nextCard.id,
      votes_revealed: false,
      updated_at: new Date().toISOString(),
    })
    .eq("session_id", sessionId);

  if (liveStateError) {
    // Same all-or-nothing rationale as revealVotes: don't leave `sessions`
    // pointing at the new card while the realtime mirror still broadcasts
    // the old one — no participant would ever be told to move on.
    await supabase
      .from("sessions")
      .update({
        current_card_id: session.current_card_id,
        votes_revealed: true,
      })
      .eq("id", sessionId);
    return { success: false, error: "Impossible de passer à la carte suivante." };
  }

  return { success: true, data: { cardId: nextCard.id } };
}

/**
 * Story 3.9 (FR42/FR43): activates the first card of the deck for a
 * session created without one (`createSession`, above). Admin-auth,
 * ownership-scoped, same pattern as `revealVotes`/`goToNextCard`. Reuses
 * `findNextCardId` with `afterOrderIndex = 0` — the first card is just
 * "the next card after order_index 0", no separate query needed.
 */
export async function startSession(
  sessionId: string,
): Promise<ActionResult<{ cardId: string }>> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();

  if (authError || !authData?.claims) {
    return { success: false, error: "Session admin invalide." };
  }

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("deck_id, current_card_id, status")
    .eq("id", sessionId)
    .eq("admin_id", authData.claims.sub)
    .maybeSingle();

  if (sessionError || !session) {
    return { success: false, error: "Session invalide." };
  }

  if (session.status === "CLOTUREE") {
    return { success: false, error: "Cette session est clôturée." };
  }

  if (session.current_card_id) {
    return { success: false, error: "L'atelier a déjà démarré." };
  }

  const firstCard = await findNextCardId(supabase, session.deck_id, 0);

  if (firstCard.error) {
    return { success: false, error: "Impossible de démarrer l'atelier." };
  }

  if (!firstCard.id) {
    return { success: false, error: "Ce deck n'a aucune carte." };
  }

  const { error: sessionUpdateError } = await supabase
    .from("sessions")
    .update({ current_card_id: firstCard.id })
    .eq("id", sessionId);

  if (sessionUpdateError) {
    return { success: false, error: "Impossible de démarrer l'atelier." };
  }

  const { error: liveStateError } = await supabase
    .from("session_live_state")
    .update({
      current_card_id: firstCard.id,
      votes_revealed: false,
      updated_at: new Date().toISOString(),
    })
    .eq("session_id", sessionId);

  if (liveStateError) {
    return { success: false, error: "Impossible de démarrer l'atelier." };
  }

  return { success: true, data: { cardId: firstCard.id } };
}

/**
 * Facilitator-token equivalent of `startSession` — for the public
 * `/facilitate/[code]` screen, which has no Supabase Auth session to check
 * ownership with. Bug found in production (2026-08-22): the mobile pilotage
 * screen was reusing `StartSessionButton`, which calls `startSession`
 * (admin-auth only) and always failed there with "Session admin invalide.".
 * Same pattern as `revealVotesAsFacilitator`/`goToNextCardAsFacilitator` —
 * `start_session_as_facilitator` is SECURITY DEFINER and verifies the token
 * itself in SQL.
 */
export async function startSessionAsFacilitator(
  sessionId: string,
  facilitatorToken: string,
): Promise<ActionResult<{ cardId: string }>> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc(
    "start_session_as_facilitator",
    {
      p_session_id: sessionId,
      p_facilitator_token: facilitatorToken,
    },
  );

  if (error) {
    if (error.code === "FT001") {
      return { success: false, error: "Lien de pilotage invalide." };
    }
    if (error.code === "FT004") {
      return { success: false, error: "Cette session est clôturée." };
    }
    if (error.code === "FT007") {
      return { success: false, error: "L'atelier a déjà démarré." };
    }
    if (error.code === "FT008") {
      return { success: false, error: "Ce deck n'a aucune carte." };
    }
    return { success: false, error: "Impossible de démarrer l'atelier." };
  }

  return { success: true, data: { cardId: data } };
}

/**
 * Facilitator-token equivalent of `closeSession` — same bug/fix as
 * `startSessionAsFacilitator` above: `CloseSessionButton` on the mobile
 * pilotage screen was calling the admin-auth-only `closeSession`. Mirrors
 * `closeSession`'s TS logic exactly, including the "consensus required
 * before closing" guard.
 */
export async function closeSessionAsFacilitator(
  sessionId: string,
  facilitatorToken: string,
): Promise<ActionResult<null>> {
  const supabase = await createClient();

  // Story 5.3 (FR20/FR50): same best-effort AI synthesis as `closeSession`,
  // read via the facilitator-token-scoped equivalent (this screen has no
  // admin-authenticated session to call `getSessionSynthesis` directly).
  const { cards, transcriptDraft } = await getSessionSynthesisAsFacilitator(
    sessionId,
    facilitatorToken,
  );
  const aiSynthesis = await generateAiSynthesis(cards, transcriptDraft);

  const { error } = await supabase.rpc("close_session_as_facilitator", {
    p_session_id: sessionId,
    p_facilitator_token: facilitatorToken,
    p_ai_synthesis: aiSynthesis,
  });

  if (error) {
    if (error.code === "FT001") {
      return { success: false, error: "Lien de pilotage invalide." };
    }
    if (error.code === "FT009") {
      return {
        success: false,
        error: "Saisis la valeur d'accord d'équipe avant de clôturer la session.",
      };
    }
    return { success: false, error: "Impossible de clôturer la session." };
  }

  return { success: true, data: null };
}

/**
 * Story 5.5 (FR48): only allowed before the workshop starts (enforced in
 * SQL via `current_card_id is null`, FT010 otherwise) — activating or
 * deactivating transcription mid-session would leave the client and server
 * disagreeing about whether `SpeechRecognition` should be running.
 */
export async function setTranscriptionEnabled(
  sessionId: string,
  facilitatorToken: string,
  enabled: boolean,
): Promise<ActionResult<null>> {
  const supabase = await createClient();

  const { error } = await supabase.rpc(
    "set_transcription_enabled_as_facilitator",
    {
      p_session_id: sessionId,
      p_facilitator_token: facilitatorToken,
      p_enabled: enabled,
    },
  );

  if (error) {
    if (error.code === "FT001") {
      return { success: false, error: "Lien de pilotage invalide." };
    }
    if (error.code === "FT004") {
      return { success: false, error: "Cette session est clôturée." };
    }
    if (error.code === "FT010") {
      return { success: false, error: "L'atelier a déjà démarré." };
    }
    return {
      success: false,
      error: "Impossible de modifier l'option de transcription.",
    };
  }

  return { success: true, data: null };
}

/**
 * Story 5.5 (FR48): periodic sync of the browser's accumulated
 * `SpeechRecognition` text — resilience against a reloaded page (AC#3), not
 * a real-time broadcast. No Zod schema: this is free-form recognized
 * speech, not a user-submitted form field.
 */
export async function syncTranscriptDraft(
  sessionId: string,
  facilitatorToken: string,
  text: string,
): Promise<ActionResult<null>> {
  const supabase = await createClient();

  const { error } = await supabase.rpc(
    "sync_transcript_draft_as_facilitator",
    {
      p_session_id: sessionId,
      p_facilitator_token: facilitatorToken,
      p_text: text,
    },
  );

  if (error) {
    if (error.code === "FT001") {
      return { success: false, error: "Lien de pilotage invalide." };
    }
    if (error.code === "FT004") {
      return { success: false, error: "Cette session est clôturée." };
    }
    return {
      success: false,
      error: "Impossible de synchroniser la transcription.",
    };
  }

  return { success: true, data: null };
}

/**
 * Whether the session's current card has a next card in the deck — used to
 * eagerly hide/disable the "Carte suivante" button (Subtask 2.1) instead of
 * only discovering `no-more-cards` reactively after a click. Any read
 * failure or missing card is treated as "no" (fail closed): a hidden
 * button that could have advanced is a minor inconvenience, a shown button
 * that can't is a confusing dead click.
 */
export async function hasNextCard(sessionId: string): Promise<boolean> {
  const supabase = await createClient();

  const { data: session } = await supabase
    .from("sessions")
    .select("deck_id, current_card_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session?.current_card_id) return false;

  const { data: currentCard } = await supabase
    .from("cards")
    .select("order_index")
    .eq("id", session.current_card_id)
    .maybeSingle();

  if (!currentCard) return false;

  const nextCard = await findNextCardId(
    supabase,
    session.deck_id,
    currentCard.order_index,
  );

  return nextCard.id !== null;
}

/**
 * Facilitator-token equivalent of `revealVotes` (Story 4.3) — for the
 * public `/facilitate/[code]` screen, which has no Supabase Auth session to
 * check ownership with. `reveal_votes_as_facilitator` is SECURITY DEFINER
 * and verifies the token itself in SQL; both writes happen in that single
 * function call, so unlike `revealVotes` there's no manual rollback path
 * here — the database transaction is the all-or-nothing guarantee.
 *
 * FR37/FR38 (Story 4.7): `facilitatorToken` is the only credential this
 * function checks — never bind pilotage authority to a cookie, a Supabase
 * Auth session, or any other device-specific identifier. Any device holding
 * this token must be able to call this successfully, indefinitely, with no
 * pairing/recovery step.
 */
export async function revealVotesAsFacilitator(
  sessionId: string,
  facilitatorToken: string,
): Promise<ActionResult<null>> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("reveal_votes_as_facilitator", {
    p_session_id: sessionId,
    p_facilitator_token: facilitatorToken,
  });

  if (error) {
    if (error.code === "FT001") {
      return { success: false, error: "Lien de pilotage invalide." };
    }
    if (error.code === "FT004") {
      return { success: false, error: "Cette session est clôturée." };
    }
    return { success: false, error: "Impossible de révéler les votes." };
  }

  return { success: true, data: null };
}

/**
 * Facilitator-token equivalent of `goToNextCard` (Story 4.3) — same
 * business rules (votes must already be revealed, next card by
 * `order_index`), enforced inside `go_to_next_card_as_facilitator` since
 * the caller has no admin session for RLS to check.
 *
 * FR37/FR38 (Story 4.7): same guard as `revealVotesAsFacilitator` above —
 * `facilitatorToken` is the only credential checked, never a cookie/session/
 * device identifier.
 */
export async function goToNextCardAsFacilitator(
  sessionId: string,
  facilitatorToken: string,
): Promise<GoToNextCardResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc(
    "go_to_next_card_as_facilitator",
    {
      p_session_id: sessionId,
      p_facilitator_token: facilitatorToken,
    },
  );

  if (error) {
    if (error.code === "FT001") {
      return { success: false, error: "Lien de pilotage invalide." };
    }
    if (error.code === "FT002") {
      return {
        success: false,
        error: "Révèle les votes avant de passer à la carte suivante.",
      };
    }
    if (error.code === "FT003") {
      return { success: false, error: "Aucune carte active pour cette session." };
    }
    if (error.code === "FT004") {
      return { success: false, error: "Cette session est clôturée." };
    }
    if (error.code === "FT005") {
      return {
        success: false,
        error: "Saisis la valeur d'accord d'équipe avant de passer à la carte suivante.",
      };
    }
    return { success: false, error: "Impossible de passer à la carte suivante." };
  }

  if (!data) {
    return {
      success: false,
      error: "C'était la dernière carte du deck.",
      code: "no-more-cards",
    };
  }

  return { success: true, data: { cardId: data } };
}

/**
 * Story 3.8 (FR41): the facilitator's decision, not a re-vote — records the
 * team's agreed value for a card. Admin-auth path (own Supabase session,
 * RLS-scoped to `admin_id`, same ownership pattern as `revealVotes`).
 * Upserts on the table's primary key (`session_id, card_id`), so calling
 * this again for the same card just overwrites the value.
 */
export async function setCardConsensus(
  input: unknown,
): Promise<ActionResult<null>> {
  const parsed = setCardConsensusSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Formulaire invalide.",
    };
  }

  const { sessionId, cardId, value } = parsed.data;

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();

  if (authError || !authData?.claims) {
    return { success: false, error: "Session admin invalide." };
  }

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, status, current_card_id")
    .eq("id", sessionId)
    .eq("admin_id", authData.claims.sub)
    .maybeSingle();

  if (sessionError || !session) {
    return { success: false, error: "Session invalide." };
  }

  if (session.status === "CLOTUREE") {
    return { success: false, error: "Cette session est clôturée." };
  }

  // Code review fix (2026-08-21): mirrors submit_vote's own check for votes
  // (VT002) — without it, a stale client could record an "accord" against
  // a card that's no longer the one being discussed.
  if (session.current_card_id !== cardId) {
    return { success: false, error: "Cette carte n'est plus la carte active." };
  }

  const { error: upsertError } = await supabase
    .from("card_consensus")
    .upsert(
      { session_id: sessionId, card_id: cardId, value },
      { onConflict: "session_id,card_id" },
    );

  if (upsertError) {
    return { success: false, error: "Impossible d'enregistrer la valeur d'accord." };
  }

  return { success: true, data: null };
}

/**
 * Facilitator-token equivalent of `setCardConsensus` (same FT001 mapping as
 * `revealVotesAsFacilitator`/`goToNextCardAsFacilitator` — the only
 * credential checked is the bearer token, never a device/session).
 */
export async function setCardConsensusAsFacilitator(
  sessionId: string,
  facilitatorToken: string,
  cardId: string,
  value: number,
): Promise<ActionResult<null>> {
  const parsed = setCardConsensusSchema.safeParse({ sessionId, cardId, value });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Formulaire invalide.",
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("set_card_consensus_as_facilitator", {
    p_session_id: sessionId,
    p_facilitator_token: facilitatorToken,
    p_card_id: cardId,
    p_value: value,
  });

  if (error) {
    if (error.code === "FT001") {
      return { success: false, error: "Lien de pilotage invalide." };
    }
    if (error.code === "FT004") {
      return { success: false, error: "Cette session est clôturée." };
    }
    if (error.code === "FT006") {
      return { success: false, error: "Cette carte n'est plus la carte active." };
    }
    return { success: false, error: "Impossible d'enregistrer la valeur d'accord." };
  }

  return { success: true, data: null };
}

/**
 * Public read (RLS `select using (true)` — not sensitive like hidden
 * individual votes, it's the team's own final result for the card).
 * `null` on absence/error, same shape as `getSessionLiveState`.
 */
export async function getCardConsensus(
  sessionId: string,
  cardId: string,
): Promise<number | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("card_consensus")
    .select("value")
    .eq("session_id", sessionId)
    .eq("card_id", cardId)
    .maybeSingle();

  if (error || !data) return null;

  return data.value;
}
