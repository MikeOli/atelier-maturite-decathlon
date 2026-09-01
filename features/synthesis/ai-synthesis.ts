import { GoogleGenAI, Type } from "@google/genai";
import { MATURITY_SCALE } from "@/lib/voting";

export type AiSynthesisInputCard = {
  cardId: string;
  title: string;
  theme: string;
  bullets: string[];
  consensusValue: number | null;
};

export type AiSynthesis = {
  generatedAt: string;
  cards: { cardId: string; synthesis: string; keywords: string[] }[];
  workshopProposals: string[];
};

// Amendement 2026-08-24 (retour utilisateur post-premier-test-réel) : sans
// transcript, l'IA n'a ni verbatim ni contexte réel à résumer — une
// "synthèse" serait fabriquée à partir de rien. Le persona est donc recentré
// sur "restitue ce qui a été dit", pas "coach qui commente des chiffres".
const SYSTEM_INSTRUCTION =
  "Tu résumes une discussion d'atelier de maturité produit à partir de sa " +
  "transcription. Pour chaque carte débattue, restitue en une ou deux " +
  "phrases ce que l'équipe a exprimé (pas ton avis, pas une recommandation " +
  "générique), avec quelques mots-clés qui capturent les points marquants. " +
  "Termine par des propositions concrètes d'ateliers ou d'actions à mener " +
  "avec l'équipe, déduites de la discussion. Le texte peut contenir des " +
  "prénoms prononcés à voix haute : retire-les systématiquement et " +
  "remplace-les par 'un participant'. Réponds uniquement dans le format " +
  "JSON demandé.";

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    cards: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          cardId: { type: Type.STRING },
          synthesis: { type: Type.STRING },
          keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["cardId", "synthesis", "keywords"],
      },
    },
    workshopProposals: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["cards", "workshopProposals"],
};

function maturityLabel(value: number | null): string {
  if (value === null) return "aucune valeur retenue";
  const scale = MATURITY_SCALE.find((s) => s.value === value);
  return scale ? `${value} (${scale.label})` : String(value);
}

function buildPrompt(cards: AiSynthesisInputCard[], transcript: string): string {
  const cardLines = cards.map((card) => {
    const bullets = card.bullets.length > 0 ? card.bullets.join(" ; ") : "aucune affirmation";
    return `- [${card.theme}] ${card.title} — affirmations : ${bullets} — accord retenu : ${maturityLabel(card.consensusValue)}`;
  });

  return (
    `Cartes débattues durant l'atelier :\n${cardLines.join("\n")}` +
    `\n\nTranscript de la discussion (peut contenir des prénoms à anonymiser) :\n${transcript}`
  );
}

function isValidAiSynthesisShape(value: unknown): value is Omit<AiSynthesis, "generatedAt"> {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;

  if (!Array.isArray(candidate.cards) || !Array.isArray(candidate.workshopProposals)) {
    return false;
  }

  const cardsValid = candidate.cards.every(
    (c) =>
      typeof c === "object" &&
      c !== null &&
      typeof (c as { cardId?: unknown }).cardId === "string" &&
      typeof (c as { synthesis?: unknown }).synthesis === "string" &&
      Array.isArray((c as { keywords?: unknown }).keywords) &&
      (c as { keywords: unknown[] }).keywords.every((kw) => typeof kw === "string"),
  );
  const proposalsValid = candidate.workshopProposals.every((p) => typeof p === "string");

  return cardsValid && proposalsValid;
}

/**
 * Guards `sessions.ai_synthesis` on the way *out* of the database, not just
 * Gemini's response on the way in. Real-world lesson (2026-08-24): the very
 * first stored value used the previous shape (`cards[].recommendation`,
 * `themes`, `qualitative`) before this file dropped per-theme
 * recommendations — reusing `isValidAiSynthesisShape` here means an old,
 * now-incompatible row degrades to "no AI section" instead of crashing
 * `AiSynthesisPanel` on render, the same protection schema drift from
 * Gemini itself already gets.
 */
export function parseStoredAiSynthesis(value: unknown): AiSynthesis | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Record<string, unknown>;
  const generatedAt = candidate.generatedAt;

  if (typeof generatedAt !== "string" || !isValidAiSynthesisShape(candidate)) {
    return null;
  }

  return {
    generatedAt,
    cards: candidate.cards,
    workshopProposals: candidate.workshopProposals,
  };
}

/**
 * Story 5.3 (FR20/FR50) — best-effort AI call, never throws. `null` covers
 * every failure mode uniformly (missing transcript, missing API key,
 * network/quota error, malformed response) so the caller
 * (closeSession/closeSessionAsFacilitator) never needs to distinguish them:
 * the quantitative synthesis must remain available regardless (NFR8/NFR14).
 *
 * Amendement 2026-08-24 : no longer called at all without a transcript —
 * without real verbatim/context there is nothing meaningful for the AI to
 * summarize, only the existing per-card score (Stories 5.1/5.2, untouched).
 *
 * `console.error` on every failure branch is a deliberate departure from
 * this project's usual "no server logging" convention — added after the
 * very first real-world close silently produced no synthesis, with
 * genuinely no way to tell why (Google retired "gemini-2.5-flash" days
 * after this was written, a class of failure that will recur as Google
 * rotates model names again). Worth the exception specifically here:
 * failures of an external, unversioned-by-us API are exactly the kind a
 * developer can't reason about from the code alone.
 */
export async function generateAiSynthesis(
  cards: AiSynthesisInputCard[],
  transcript: string | null,
): Promise<AiSynthesis | null> {
  if (!transcript || transcript.trim().length === 0) return null;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("generateAiSynthesis: GEMINI_API_KEY is not set");
    return null;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      // "gemini-2.5-flash" was retired by Google shortly after this was
      // written ("no longer available to new users") — confirmed via a
      // real production 404 on 2026-08-24, caught by the console.error
      // below. Pin exact model names loosely; Google rotates them.
      model: "gemini-3.6-flash",
      contents: buildPrompt(cards, transcript),
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        // Both callers `await` this before writing the close — a hung
        // request with no bound would otherwise stall (or, on a serverless
        // duration limit, hard-fail) the close action itself, defeating
        // the "never blocks" guarantee (NFR8/NFR14). An abort throws,
        // which the catch below turns into the same `null` as any other
        // failure.
        abortSignal: AbortSignal.timeout(15_000),
      },
    });

    const text = response.text;
    if (!text) {
      console.error("generateAiSynthesis: empty response.text", { response });
      return null;
    }

    const parsed: unknown = JSON.parse(text);
    if (!isValidAiSynthesisShape(parsed)) {
      console.error("generateAiSynthesis: response failed shape validation", { text });
      return null;
    }

    return {
      generatedAt: new Date().toISOString(),
      cards: parsed.cards,
      workshopProposals: parsed.workshopProposals,
    };
  } catch (error) {
    console.error("generateAiSynthesis: threw", error);
    return null;
  }
}
