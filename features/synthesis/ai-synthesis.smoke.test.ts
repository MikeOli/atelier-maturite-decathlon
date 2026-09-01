import { describe, it, expect } from "vitest";
import { generateAiSynthesis } from "./ai-synthesis";

/**
 * Manual smoke test — hits the real Gemini API (a real network call, a
 * real cost). Never runs as part of the normal suite (gated on
 * RUN_AI_SMOKE_TEST, not just GEMINI_API_KEY, so it doesn't silently fire
 * on every `npx vitest run` on a machine that has the key configured for
 * local dev). Run it explicitly:
 *
 *   npm run test:ai-smoke
 *
 * ...whenever the AI synthesis feature goes quiet in production, or after
 * touching the prompt/schema/model name — a 10-second check instead of
 * running a full workshop end-to-end. This exact test would have caught
 * the "gemini-2.5-flash retired" failure from 2026-08-24 in seconds
 * instead of requiring a live user-facing workshop to surface it.
 */
describe.skipIf(!process.env.RUN_AI_SMOKE_TEST || !process.env.GEMINI_API_KEY)(
  "generateAiSynthesis (real Gemini call)",
  () => {
    it(
      "returns a well-formed synthesis for a minimal real prompt",
      async () => {
        const result = await generateAiSynthesis(
          [
            {
              cardId: "test-card",
              title: "Vision produit",
              theme: "Strategy",
              bullets: ["Vision partagée par l'équipe", "Objectifs clairs"],
              consensusValue: 3,
            },
          ],
          "Le facilitateur demande si tout le monde partage la même vision. " +
            "Un participant répond que la vision est floue et que personne " +
            "ne sait vraiment où l'équipe va. Un autre participant confirme " +
            "ce ressenti.",
        );

        expect(result).not.toBeNull();
        expect(result?.cards.length).toBeGreaterThan(0);
        expect(result?.cards[0]?.synthesis.length).toBeGreaterThan(0);
        expect(Array.isArray(result?.cards[0]?.keywords)).toBe(true);
        expect(Array.isArray(result?.workshopProposals)).toBe(true);
      },
      20_000,
    );
  },
);
