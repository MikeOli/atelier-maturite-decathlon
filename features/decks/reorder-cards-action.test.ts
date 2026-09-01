import { describe, expect, it, vi, beforeEach } from "vitest";
import { reorderCards } from "./reorder-cards-action";

type QueryResult = { data: unknown; error: unknown };
type RpcResult = { data: unknown; error: { code?: string; message: string } | null };

function createDeckBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = vi.fn(chain);
  builder.eq = vi.fn(chain);
  builder.maybeSingle = vi.fn(chain);
  builder.then = (resolve: (value: QueryResult) => void) =>
    Promise.resolve(result).then(resolve);
  return builder;
}

let authResult: { data: { claims: { sub: string } } | null; error: unknown } = {
  data: { claims: { sub: "admin-1" } },
  error: null,
};
let deckResult: QueryResult;
let rpcResult: RpcResult;

const fromMock = vi.fn(() => createDeckBuilder(deckResult));
const rpcMock = vi.fn(() => Promise.resolve(rpcResult));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getClaims: () => Promise.resolve(authResult) },
    from: fromMock,
    rpc: rpcMock,
  }),
}));

const DECK_ID = "11111111-1111-1111-8111-111111111111";
const CARD_1 = "22222222-2222-2222-8222-222222222222";
const CARD_2 = "33333333-3333-3333-8333-333333333333";

beforeEach(() => {
  vi.clearAllMocks();
  authResult = { data: { claims: { sub: "admin-1" } }, error: null };
  deckResult = { data: { id: DECK_ID }, error: null };
  rpcResult = { data: null, error: null };
});

describe("reorderCards", () => {
  it("calls the reorder_cards RPC with the deck id and the ordered card ids", async () => {
    const result = await reorderCards(DECK_ID, [CARD_2, CARD_1]);

    expect(result).toEqual({ success: true, data: null });
    expect(rpcMock).toHaveBeenCalledWith("reorder_cards", {
      p_deck_id: DECK_ID,
      p_card_ids: [CARD_2, CARD_1],
    });
  });

  it("rejects when there is no admin session", async () => {
    authResult = { data: null, error: { message: "no session" } };

    const result = await reorderCards(DECK_ID, [CARD_1]);

    expect(result).toEqual({
      success: false,
      error: "Session admin invalide.",
    });
    expect(fromMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("rejects an empty cardIds array before calling the database", async () => {
    const result = await reorderCards(DECK_ID, []);

    expect(result.success).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("rejects duplicate cardIds before calling the database", async () => {
    const result = await reorderCards(DECK_ID, [CARD_1, CARD_1]);

    expect(result).toEqual({
      success: false,
      error: "Liste de cartes invalide.",
    });
    expect(fromMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("rejects a deckId that doesn't belong to the admin, without calling the RPC", async () => {
    deckResult = { data: null, error: null };

    const result = await reorderCards(DECK_ID, [CARD_1]);

    expect(result).toEqual({ success: false, error: "Deck invalide." });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("returns a generic error when the RPC rejects an incomplete/foreign card set", async () => {
    rpcResult = { data: null, error: { code: "CR001", message: "card set mismatch" } };

    const result = await reorderCards(DECK_ID, [CARD_1, CARD_2]);

    expect(result).toEqual({
      success: false,
      error: "Impossible de réordonner les cartes.",
    });
  });
});
