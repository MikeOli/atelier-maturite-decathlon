import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  DEFAULT_DECK_CARDS,
  DEFAULT_DECK_DESCRIPTION,
  DEFAULT_DECK_NAME,
} from "@/lib/decks/default-deck-seed";
import { createClient } from "@/lib/supabase/server";

export type DeckWithCardCount = {
  id: string;
  name: string;
  description: string;
  cardCount: number;
  createdAt: string;
  /** Adresse de l'animateur qui a créé le deck, null si le compte a été supprimé. */
  createdByEmail: string | null;
  updatedAt: string;
  /** Null tant que le deck n'a jamais été modifié depuis sa création. */
  updatedByEmail: string | null;
};

export type DeckDetail = {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  cards: {
    id: string;
    theme: string;
    title: string;
    bullets: string[];
    orderIndex: number;
  }[];
};

export type CardDetail = {
  id: string;
  deckId: string;
  theme: string;
  title: string;
  bullets: string[];
  orderIndex: number;
};

/**
 * Les erreurs Supabase ne sont pas des Error : relayées telles quelles,
 * Next n'en affiche qu'un digest et un corps vide ("Error: {\"message\":\"\"}"),
 * ce qui a rendu un 500 de /admin indiagnosticable le 2026-10-21. On trace
 * les champs utiles avant de relancer.
 */
function describeSupabaseError(context: string, error: unknown): void {
  const e = error as { code?: string; message?: string; details?: string; hint?: string };
  console.error(
    `${context}: ${JSON.stringify({
      code: e?.code,
      message: e?.message,
      details: e?.details,
      hint: e?.hint,
    })}`,
  );
}

const POSTGRES_UNIQUE_VIOLATION = "23505";

/**
 * Ensures the *shared* catalogue holds at least the default "Maturité
 * Produit" deck. Idempotent: does nothing as soon as any deck exists.
 * Called on first access to the decks list rather than via a signup
 * trigger, so it also covers accounts that predate this feature.
 *
 * Depuis que les decks sont communs (2026-10-21), le compte à vérifier est
 * global et non plus celui de l'admin : sinon chaque nouvelle inscription
 * ajouterait sa propre copie de « Maturité Produit » au catalogue partagé.
 * L'admin qui déclenche l'amorçage en reste le créateur, donc le seul à
 * pouvoir le modifier.
 *
 * A DB-level unique index (decks_one_default_idx, on is_default) is the
 * actual race-condition guard: two concurrent first requests can both pass
 * the count check below, but only one insert with is_default=true will
 * succeed — the loser's unique-violation is treated as "already seeded by
 * the other request" rather than an error.
 */
export async function ensureDefaultDeck(
  supabase: SupabaseClient<Database>,
  adminId: string,
): Promise<void> {
  const { count, error: countError } = await supabase
    .from("decks")
    .select("id", { count: "exact", head: true });

  if (countError) {
    describeSupabaseError("ensureDefaultDeck: count", countError);
    return;
  }
  if (count && count > 0) return;

  const { data: deck, error: deckError } = await supabase
    .from("decks")
    .insert({
      admin_id: adminId,
      name: DEFAULT_DECK_NAME,
      description: DEFAULT_DECK_DESCRIPTION,
      is_default: true,
    })
    .select("id")
    .single();

  if (deckError) {
    if (deckError.code === POSTGRES_UNIQUE_VIOLATION) return;
    // Amorcer le catalogue est un confort, pas une condition d'accès :
    // échouer ici ne doit pas priver l'animateur de tout son espace.
    describeSupabaseError("ensureDefaultDeck: insert deck", deckError);
    return;
  }

  const { error: cardsError } = await supabase.from("cards").insert(
    DEFAULT_DECK_CARDS.map((card) => ({
      deck_id: deck.id,
      theme: card.theme,
      title: card.title,
      bullets: card.bullets,
      order_index: card.orderIndex,
    })),
  );

  if (cardsError) {
    // Roll back the orphaned deck rather than leaving a cardless deck behind
    // that future loads would silently treat as "already seeded".
    await supabase.from("decks").delete().eq("id", deck.id);
    describeSupabaseError("ensureDefaultDeck: insert cards", cardsError);
    return;
  }
}

export async function listDecksWithCardCounts(
  supabase: SupabaseClient<Database>,
): Promise<DeckWithCardCount[]> {
  const { data, error } = await supabase
    .from("decks")
    .select(
      "id, name, description, created_at, updated_at, admin_id, updated_by, cards(count)",
    )
    .eq("cards.archived", false)
    .order("created_at", { ascending: true });

  if (error) {
    describeSupabaseError("listDecksWithCardCounts", error);
    throw error;
  }

  const decks = data ?? [];

  // Les adresses vivent dans auth.users, hors de portée de PostgREST : on
  // les résout via la vue admin_emails, en une requête pour tout le lot
  // plutôt qu'une par deck. Un échec ici n'empêche pas d'afficher les
  // decks — on perd les noms, pas le catalogue.
  const ids = [
    ...new Set(
      decks.flatMap((d) => [d.admin_id, d.updated_by].filter(Boolean)),
    ),
  ] as string[];

  const emails = new Map<string, string>();
  if (ids.length > 0) {
    const { data: rows, error: emailError } = await supabase
      .from("admin_emails")
      .select("id, email")
      .in("id", ids);
    if (emailError) {
      describeSupabaseError("listDecksWithCardCounts: admin_emails", emailError);
    }
    // La vue expose des colonnes nullables : un compte supprimé ne doit
    // pas faire tomber le listing.
    for (const row of rows ?? []) {
      if (row.id && row.email) emails.set(row.id, row.email);
    }
  }

  return decks.map((deck) => ({
    id: deck.id,
    name: deck.name,
    description: deck.description,
    createdAt: deck.created_at,
    createdByEmail: emails.get(deck.admin_id) ?? null,
    updatedAt: deck.updated_at,
    updatedByEmail: deck.updated_by ? (emails.get(deck.updated_by) ?? null) : null,
    cardCount: deck.cards?.[0]?.count ?? 0,
  }));
}

/**
 * Plus de filtre sur admin_id depuis que le catalogue est commun : tout
 * admin connecté peut ouvrir n'importe quel deck. La lecture est cadrée
 * par la politique « Decks are readable by every admin », et l'écriture
 * reste réservée au créateur par les politiques d'update/delete — un
 * filtre ici ne protégerait rien de plus et masquerait les decks partagés.
 */
export async function getDeckDetail(deckId: string): Promise<DeckDetail | null> {
  const supabase = await createClient();
  const { data: deck, error: deckError } = await supabase
    .from("decks")
    .select("id, name, description, is_default")
    .eq("id", deckId)
    .maybeSingle();

  if (deckError || !deck) return null;

  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .select("id, theme, title, bullets, order_index")
    .eq("deck_id", deckId)
    .eq("archived", false)
    .order("order_index", { ascending: true });

  if (cardsError) return null;

  return {
    id: deck.id,
    name: deck.name,
    description: deck.description,
    isDefault: deck.is_default,
    cards: (cards ?? []).map((card) => ({
      id: card.id,
      theme: card.theme,
      title: card.title,
      bullets: card.bullets as string[],
      orderIndex: card.order_index,
    })),
  };
}

/**
 * No adminId parameter — unlike getDeckDetail, ownership is enforced purely
 * by RLS here ("Admins manage cards of their own decks" already scopes this
 * select via deck_id → decks.admin_id), so a manual filter would be dead
 * weight duplicating a check the DB already makes. A non-owned or
 * nonexistent cardId simply comes back as no row, same as getDeckDetail's
 * null-safe contract.
 */
export async function getCardDetail(cardId: string): Promise<CardDetail | null> {
  const supabase = await createClient();
  const { data: card, error } = await supabase
    .from("cards")
    .select("id, deck_id, theme, title, bullets, order_index")
    .eq("id", cardId)
    .maybeSingle();

  if (error || !card) return null;

  return {
    id: card.id,
    deckId: card.deck_id,
    theme: card.theme,
    title: card.title,
    bullets: card.bullets as string[],
    orderIndex: card.order_index,
  };
}
