"use server";

import { createClient } from "@/lib/supabase/server";

export type CardSynthesis = {
  cardId: string;
  title: string;
  theme: string;
  bullets: string[];
  consensusValue: number | null;
};

/**
 * Per-card recap (Story 5.1, FR18) — redefined 2026-08-21: shows the
 * team's consensus value (Story 3.8) for every card that has been reached,
 * not the individual votes/avatars behind it (decision actioned with Mary:
 * a discussed consensus, not a raw average of votes). A card counts as
 * "reached" if it's before the session's current card (goToNextCard
 * already enforces a reveal before advancing, Story 3.4) or if it IS the
 * current card and votes_revealed is true — never a card past the current
 * one, which could never have been debated. `consensusValue` is `null`
 * when a reached card was never concluded with a value (e.g. session
 * interrupted mid-debate) — the caller must display this distinctly, not
 * omit the row (AC#2).
 */
export async function getSessionSynthesis(
  sessionId: string,
  adminId: string,
): Promise<CardSynthesis[]> {
  const supabase = await createClient();

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("deck_id, current_card_id, votes_revealed")
    .eq("id", sessionId)
    .eq("admin_id", adminId)
    .maybeSingle();

  if (sessionError || !session) return [];

  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .select("id, title, theme, bullets, order_index")
    .eq("deck_id", session.deck_id)
    .order("order_index", { ascending: true });

  if (cardsError || !cards) return [];

  const currentCard = cards.find((c) => c.id === session.current_card_id);
  // Number.NEGATIVE_INFINITY, not -1: cards.order_index has no CHECK
  // constraint preventing a negative/zero value, so a sentinel of -1 could
  // wrongly collide with a real card when no card is current yet.
  const currentOrderIndex = currentCard?.order_index ?? Number.NEGATIVE_INFINITY;

  const eligibleCards = cards.filter((card) => {
    if (card.order_index < currentOrderIndex) return true;
    if (card.id === session.current_card_id) return session.votes_revealed;
    return false;
  });

  const synthesis = await Promise.all(
    eligibleCards.map(async (card) => {
      const { data: consensusRow } = await supabase
        .from("card_consensus")
        .select("value")
        .eq("session_id", sessionId)
        .eq("card_id", card.id)
        .maybeSingle();

      return {
        cardId: card.id,
        title: card.title,
        theme: card.theme,
        bullets: Array.isArray(card.bullets) ? (card.bullets as string[]) : [],
        consensusValue: consensusRow?.value ?? null,
      };
    }),
  );

  return synthesis;
}

/**
 * Facilitator-token-scoped equivalent of `getSessionSynthesis`, used by
 * `closeSessionAsFacilitator` (Story 5.3) to build the AI synthesis when a
 * session is ended from the mobile pilotage screen rather than the admin
 * desktop. Also returns `transcriptDraft` in the same call — folded in
 * here (not read via `getSessionByFacilitatorToken`) so this whole read
 * can be mocked as one module from `closeSessionAsFacilitator`'s tests,
 * which live in the same file as `getSessionByFacilitatorToken` and can't
 * mock it independently.
 */
export async function getSessionSynthesisAsFacilitator(
  sessionId: string,
  facilitatorToken: string,
): Promise<{ cards: CardSynthesis[]; transcriptDraft: string | null }> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_session_synthesis_as_facilitator", {
    p_session_id: sessionId,
    p_facilitator_token: facilitatorToken,
  });

  if (error || !data) return { cards: [], transcriptDraft: null };

  const transcriptDraft = data[0]?.transcript_draft ?? null;
  // The SQL function returns a single all-null fallback row (card_id
  // null) when no card is eligible yet, purely to carry transcriptDraft
  // through — never a real card, must be filtered out here.
  const cards = data
    .filter((row): row is typeof row & { card_id: string } => row.card_id !== null)
    .map((row) => ({
      cardId: row.card_id,
      title: row.title ?? "",
      theme: row.theme ?? "",
      bullets: Array.isArray(row.bullets) ? (row.bullets as string[]) : [],
      consensusValue: row.consensus_value ?? null,
    }));

  return { cards, transcriptDraft };
}
