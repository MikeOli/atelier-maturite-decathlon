import { describe, expect, it } from "vitest";
import { DEFAULT_DECK_CARDS, DEFAULT_DECK_DESCRIPTION } from "./default-deck-seed";

describe("DEFAULT_DECK_DESCRIPTION", () => {
  it("is a non-empty string", () => {
    expect(typeof DEFAULT_DECK_DESCRIPTION).toBe("string");
    expect(DEFAULT_DECK_DESCRIPTION.length).toBeGreaterThan(0);
  });
});

describe("DEFAULT_DECK_CARDS", () => {
  it("has exactly 16 cards", () => {
    expect(DEFAULT_DECK_CARDS).toHaveLength(16);
  });

  it("has contiguous order_index values from 1 to 16 with no duplicates", () => {
    const indices = DEFAULT_DECK_CARDS.map((c) => c.orderIndex).sort(
      (a, b) => a - b,
    );
    expect(indices).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
  });

  it("distributes cards across themes as Strategy(3) / Discovery(6) / Delivery(7)", () => {
    const counts = DEFAULT_DECK_CARDS.reduce<Record<string, number>>(
      (acc, card) => {
        acc[card.theme] = (acc[card.theme] ?? 0) + 1;
        return acc;
      },
      {},
    );
    expect(counts).toEqual({ Strategy: 3, Discovery: 6, Delivery: 7 });
  });

  it("gives every card a non-empty title and at least one bullet", () => {
    for (const card of DEFAULT_DECK_CARDS) {
      expect(card.title.length).toBeGreaterThan(0);
      expect(card.bullets.length).toBeGreaterThan(0);
    }
  });
});
