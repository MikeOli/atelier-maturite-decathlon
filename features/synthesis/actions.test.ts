import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getSessionSynthesis,
  getSessionSynthesisAsFacilitator,
  type CardSynthesis,
} from "./actions";
import { aggregateByTheme } from "./synthesis-utils";

type QueryResult = { data?: unknown; error: unknown };

function createBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = vi.fn(chain);
  builder.eq = vi.fn(chain);
  builder.order = vi.fn(chain);
  builder.maybeSingle = vi.fn(chain);
  builder.then = (resolve: (value: QueryResult) => void) =>
    Promise.resolve(result).then(resolve);
  return builder;
}

// `votes` is queried once per eligible card, so its queue is consumed in
// card order — same "one queued result per call" pattern as
// features/sessions/actions.test.ts.
let tableResultQueues: Record<string, QueryResult[]> = {};
let defaultResult: QueryResult = { data: null, error: null };

const fromMock = vi.fn((table: string) => {
  const queue = tableResultQueues[table];
  const result = queue && queue.length > 0 ? queue.shift()! : defaultResult;
  return createBuilder(result);
});

let rpcResult: QueryResult = { data: null, error: null };
const rpcMock = vi.fn(() => ({
  then: (resolve: (value: QueryResult) => void) =>
    Promise.resolve(rpcResult).then(resolve),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ from: fromMock, rpc: rpcMock }),
}));

beforeEach(() => {
  tableResultQueues = {};
  defaultResult = { data: null, error: null };
  rpcResult = { data: null, error: null };
});

const cardsFixture = [
  {
    id: "card-1",
    title: "Vision produit",
    theme: "Strategy",
    order_index: 1,
    bullets: ["Vision partagée"],
  },
  {
    id: "card-2",
    title: "Roadmap produit",
    theme: "Strategy",
    order_index: 2,
    bullets: ["Roadmap connue de tous"],
  },
  {
    id: "card-3",
    title: "Discovery continu",
    theme: "Discovery",
    order_index: 3,
    bullets: [],
  },
];

describe("getSessionSynthesis", () => {
  it("returns synthesis for past cards and the current card when revealed", async () => {
    tableResultQueues.sessions = [
      {
        data: {
          deck_id: "deck-1",
          current_card_id: "card-2",
          votes_revealed: true,
        },
        error: null,
      },
    ];
    tableResultQueues.cards = [{ data: cardsFixture, error: null }];
    tableResultQueues.card_consensus = [
      { data: { value: 3 }, error: null },
      { data: { value: 5 }, error: null },
    ];

    const result = await getSessionSynthesis("session-1", "admin-1");

    expect(result).toEqual([
      {
        cardId: "card-1",
        title: "Vision produit",
        theme: "Strategy",
        bullets: ["Vision partagée"],
        consensusValue: 3,
      },
      {
        cardId: "card-2",
        title: "Roadmap produit",
        theme: "Strategy",
        bullets: ["Roadmap connue de tous"],
        consensusValue: 5,
      },
    ]);
  });

  it("excludes the current card when its votes haven't been revealed yet", async () => {
    tableResultQueues.sessions = [
      {
        data: {
          deck_id: "deck-1",
          current_card_id: "card-2",
          votes_revealed: false,
        },
        error: null,
      },
    ];
    tableResultQueues.cards = [{ data: cardsFixture, error: null }];
    tableResultQueues.card_consensus = [{ data: { value: 3 }, error: null }];

    const result = await getSessionSynthesis("session-1", "admin-1");

    expect(result).toHaveLength(1);
    expect(result[0]?.cardId).toBe("card-1");
  });

  it("never includes a card past the current one", async () => {
    tableResultQueues.sessions = [
      {
        data: {
          deck_id: "deck-1",
          current_card_id: "card-1",
          votes_revealed: true,
        },
        error: null,
      },
    ];
    tableResultQueues.cards = [{ data: cardsFixture, error: null }];
    tableResultQueues.card_consensus = [{ data: null, error: null }];

    const result = await getSessionSynthesis("session-1", "admin-1");

    expect(result.map((r) => r.cardId)).toEqual(["card-1"]);
  });

  it("returns an empty array when no card has been reached yet", async () => {
    tableResultQueues.sessions = [
      {
        data: { deck_id: "deck-1", current_card_id: null, votes_revealed: false },
        error: null,
      },
    ];
    tableResultQueues.cards = [{ data: cardsFixture, error: null }];

    const result = await getSessionSynthesis("session-1", "admin-1");

    expect(result).toEqual([]);
  });

  it("returns an empty array when the session doesn't belong to the admin", async () => {
    tableResultQueues.sessions = [{ data: null, error: null }];

    const result = await getSessionSynthesis("session-1", "admin-1");

    expect(result).toEqual([]);
  });

  // AC#2: a reached card with no consensus recorded (debate never
  // concluded, e.g. session interrupted) must still appear in the result —
  // never filtered out — so the caller can flag it distinctly.
  it("includes a reached card with a null consensusValue rather than excluding it", async () => {
    tableResultQueues.sessions = [
      {
        data: {
          deck_id: "deck-1",
          current_card_id: "card-1",
          votes_revealed: true,
        },
        error: null,
      },
    ];
    tableResultQueues.cards = [{ data: cardsFixture, error: null }];
    tableResultQueues.card_consensus = [{ data: null, error: null }];

    const result = await getSessionSynthesis("session-1", "admin-1");

    expect(result).toEqual([
      {
        cardId: "card-1",
        title: "Vision produit",
        theme: "Strategy",
        bullets: ["Vision partagée"],
        consensusValue: null,
      },
    ]);
  });
});

describe("aggregateByTheme", () => {
  it("pools consensus values from two cards of the same theme into one entry", () => {
    const cards: CardSynthesis[] = [
      { cardId: "card-1", title: "Vision produit", theme: "Strategy", consensusValue: 3, bullets: [] },
      { cardId: "card-2", title: "Roadmap produit", theme: "Strategy", consensusValue: 8, bullets: [] },
    ];

    const result = aggregateByTheme(cards);

    expect(result).toEqual([
      {
        theme: "Strategy",
        consensusValues: [3, 8],
        average: 5.5,
        spread: 5,
        cardCount: 2,
        missingCount: 0,
      },
    ]);
  });

  it("keeps two distinct themes as separate entries, in first-appearance order", () => {
    const cards: CardSynthesis[] = [
      { cardId: "card-1", title: "Vision produit", theme: "Strategy", consensusValue: 3, bullets: [] },
      { cardId: "card-3", title: "Discovery continu", theme: "Discovery", consensusValue: 8, bullets: [] },
    ];

    const result = aggregateByTheme(cards);

    expect(result.map((r) => r.theme)).toEqual(["Strategy", "Discovery"]);
  });

  it("ignores a card with no consensus value in average/spread but counts it as missing", () => {
    const cards: CardSynthesis[] = [
      { cardId: "card-1", title: "Vision produit", theme: "Strategy", consensusValue: 8, bullets: [] },
      { cardId: "card-2", title: "Roadmap produit", theme: "Strategy", consensusValue: null, bullets: [] },
    ];

    const result = aggregateByTheme(cards);

    expect(result).toEqual([
      {
        theme: "Strategy",
        consensusValues: [8],
        average: 8,
        spread: 0,
        cardCount: 2,
        missingCount: 1,
      },
    ]);
  });

  it("returns an empty array for no cards", () => {
    expect(aggregateByTheme([])).toEqual([]);
  });

  it("rounds the average to one decimal place", () => {
    const cards: CardSynthesis[] = [
      { cardId: "card-1", title: "Vision produit", theme: "Strategy", consensusValue: 3, bullets: [] },
      { cardId: "card-2", title: "Roadmap produit", theme: "Strategy", consensusValue: 5, bullets: [] },
      { cardId: "card-3", title: "Discovery continu", theme: "Strategy", consensusValue: 8, bullets: [] },
    ];

    const result = aggregateByTheme(cards);

    expect(result[0]?.average).toBe(5.3);
  });

  it("returns a zero average/spread and full missingCount for a theme with only unset cards", () => {
    const cards: CardSynthesis[] = [
      { cardId: "card-1", title: "Vision produit", theme: "Strategy", consensusValue: null, bullets: [] },
    ];

    const result = aggregateByTheme(cards);

    expect(result).toEqual([
      {
        theme: "Strategy",
        consensusValues: [],
        average: 0,
        spread: 0,
        cardCount: 1,
        missingCount: 1,
      },
    ]);
  });
});

describe("getSessionSynthesisAsFacilitator", () => {
  it("returns the cards and the transcript draft", async () => {
    rpcResult = {
      data: [
        {
          card_id: "card-1",
          title: "Vision produit",
          theme: "Strategy",
          bullets: ["Vision partagée"],
          consensus_value: 3,
          transcript_draft: "Discussion...",
        },
      ],
      error: null,
    };

    const result = await getSessionSynthesisAsFacilitator("session-1", "token-1");

    expect(result).toEqual({
      cards: [
        {
          cardId: "card-1",
          title: "Vision produit",
          theme: "Strategy",
          bullets: ["Vision partagée"],
          consensusValue: 3,
        },
      ],
      transcriptDraft: "Discussion...",
    });
    expect(rpcMock).toHaveBeenCalledWith("get_session_synthesis_as_facilitator", {
      p_session_id: "session-1",
      p_facilitator_token: "token-1",
    });
  });

  it("returns an empty card list but keeps the transcript when no card is eligible yet", async () => {
    rpcResult = {
      data: [
        {
          card_id: null,
          title: null,
          theme: null,
          bullets: null,
          consensus_value: null,
          transcript_draft: "Discussion sans carte encore atteinte.",
        },
      ],
      error: null,
    };

    const result = await getSessionSynthesisAsFacilitator("session-1", "token-1");

    expect(result).toEqual({
      cards: [],
      transcriptDraft: "Discussion sans carte encore atteinte.",
    });
  });

  it("returns empty cards and a null transcript on an invalid facilitator token", async () => {
    rpcResult = { data: null, error: { code: "FT001", message: "invalid" } };

    const result = await getSessionSynthesisAsFacilitator("session-1", "bad-token");

    expect(result).toEqual({ cards: [], transcriptDraft: null });
  });
});
