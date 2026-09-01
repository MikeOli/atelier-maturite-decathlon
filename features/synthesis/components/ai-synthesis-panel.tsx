import type { AiSynthesis } from "@/features/synthesis/ai-synthesis";
import type { CardSynthesis } from "@/features/synthesis/actions";

/**
 * Story 5.3 (FR20/FR50) — pure presentation, no test needed (same
 * convention as SynthesisTable/ThemeSynthesisTable). Only rendered by the
 * caller when `aiSynthesis` is non-null — the "no AI section on failure or
 * without a transcript" rule is enforced by that caller, not here.
 *
 * Amendement 2026-08-24 : deux blocs seulement, pas de "par thème" — la
 * synthèse restitue ce qui a été dit par carte (résumé + mots-clés), suivie
 * des propositions d'ateliers/actions.
 */
export function AiSynthesisPanel({
  aiSynthesis,
  cards,
}: {
  aiSynthesis: AiSynthesis;
  cards: CardSynthesis[];
}) {
  const titleByCardId = new Map(cards.map((c) => [c.cardId, c.title]));

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold">Synthèse générée par IA</h2>
        <p className="text-xs text-muted-foreground">
          Suggestions générées par IA, à challenger avec l&apos;équipe — pas une
          vérité.
        </p>
      </div>

      {aiSynthesis.cards.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">Par carte</h3>
          <ul className="flex flex-col gap-3">
            {aiSynthesis.cards.map((card) => (
              <li key={card.cardId} className="text-sm">
                <p>
                  <span className="font-medium">
                    {titleByCardId.get(card.cardId) ?? card.cardId}
                  </span>{" "}
                  — {card.synthesis}
                </p>
                {card.keywords.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Mots-clés : {card.keywords.join(", ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {aiSynthesis.workshopProposals.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">
            Propositions d&apos;ateliers/actions
          </h3>
          <ul className="list-disc list-inside text-sm">
            {aiSynthesis.workshopProposals.map((proposal) => (
              <li key={proposal}>{proposal}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
