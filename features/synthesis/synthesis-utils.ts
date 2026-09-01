import type { CardSynthesis } from "@/features/synthesis/actions";

export type ThemeSynthesis = {
  theme: string;
  consensusValues: number[];
  average: number;
  spread: number;
  cardCount: number;
  missingCount: number;
};

/**
 * Theme-level rollup (Story 5.2, FR19). Pools the non-null consensus value
 * of every card of a theme into a single set before computing
 * average/spread — a card with no consensus recorded (reached but never
 * concluded, Story 5.1 AC#2) is excluded from that set rather than counted
 * as a phantom zero, but still counted in `cardCount`/`missingCount` so the
 * caller can flag a theme with an incomplete accord (AC#2).
 *
 * Not in actions.ts: a "use server" file requires every export to be an
 * async Server Action — this is a synchronous pure function, so it lives
 * in its own plain module instead.
 */
export function aggregateByTheme(cards: CardSynthesis[]): ThemeSynthesis[] {
  // Map preserves insertion order natively — no separate `order` array or
  // non-null assertions needed to track "first appearance" order.
  const cardsByTheme = new Map<string, CardSynthesis[]>();

  for (const card of cards) {
    const themeCards = cardsByTheme.get(card.theme) ?? [];
    themeCards.push(card);
    cardsByTheme.set(card.theme, themeCards);
  }

  return Array.from(cardsByTheme.entries()).map(([theme, themeCards]) => {
    const consensusValues = themeCards
      .map((c) => c.consensusValue)
      .filter((v): v is number => v !== null);
    const average =
      consensusValues.length > 0
        ? Math.round(
            (consensusValues.reduce((sum, v) => sum + v, 0) / consensusValues.length) * 10,
          ) / 10
        : 0;
    const spread =
      consensusValues.length > 0
        ? Math.max(...consensusValues) - Math.min(...consensusValues)
        : 0;

    return {
      theme,
      consensusValues,
      average,
      spread,
      cardCount: themeCards.length,
      missingCount: themeCards.length - consensusValues.length,
    };
  });
}
