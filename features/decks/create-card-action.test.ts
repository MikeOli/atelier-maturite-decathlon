import { describe, expect, it, vi, beforeEach } from "vitest";
import { createCard } from "./create-card-action";

type QueryResult = { data: unknown; error: unknown };

let insertCalls: unknown[];

function createBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = vi.fn(chain);
  builder.eq = vi.fn(chain);
  builder.order = vi.fn(chain);
  builder.limit = vi.fn(chain);
  builder.single = vi.fn(chain);
  builder.maybeSingle = vi.fn(chain);
  builder.insert = vi.fn((payload: unknown) => {
    insertCalls.push(payload);
    return builder;
  });
  builder.then = (resolve: (value: QueryResult) => void) =>
    Promise.resolve(result).then(resolve);
  return builder;
}

let authResult: { data: { claims: { sub: string } } | null; error: unknown } = {
  data: { claims: { sub: "admin-1" } },
  error: null,
};

const queues: Record<string, QueryResult[]> = {};

function queueResult(table: string, result: QueryResult) {
  queues[table] = queues[table] ?? [];
  queues[table].push(result);
}

const fromMock = vi.fn((table: string) => {
  const queue = queues[table] ?? [];
  const result = queue.shift() ?? { data: null, error: null };
  return createBuilder(result);
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getClaims: () => Promise.resolve(authResult) },
    from: fromMock,
  }),
}));

function baseFormData(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("deckId", overrides.deckId ?? "11111111-1111-1111-8111-111111111111");
  formData.set("theme", overrides.theme ?? "Strategy");
  formData.set("title", overrides.title ?? "Vision produit");
  formData.set(
    "bullets",
    overrides.bullets ?? "Premier critère.\nDeuxième critère.",
  );
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  insertCalls = [];
  queues.decks = [];
  queues.cards = [];
  authResult = { data: { claims: { sub: "admin-1" } }, error: null };
});

describe("createCard", () => {
  it("inserts the card with the parsed bullets array and the next order_index", async () => {
    queueResult("decks", { data: { id: "deck-1" }, error: null });
    queueResult("cards", { data: { order_index: 3 }, error: null });
    queueResult("cards", { data: { id: "card-1" }, error: null });

    const result = await createCard(baseFormData());

    expect(result).toEqual({ success: true, data: { id: "card-1" } });
    expect(insertCalls).toEqual([
      {
        deck_id: "11111111-1111-1111-8111-111111111111",
        theme: "Strategy",
        title: "Vision produit",
        bullets: ["Premier critère.", "Deuxième critère."],
        order_index: 4,
      },
    ]);
  });

  it("uses order_index 1 when the deck has no cards yet", async () => {
    queueResult("decks", { data: { id: "deck-1" }, error: null });
    queueResult("cards", { data: null, error: null });
    queueResult("cards", { data: { id: "card-1" }, error: null });

    await createCard(baseFormData());

    const payload = insertCalls[0] as Record<string, unknown>;
    expect(payload.order_index).toBe(1);
  });

  it("rejects an empty theme before calling insert", async () => {
    const result = await createCard(baseFormData({ theme: "   " }));

    expect(result).toEqual({ success: false, error: "Le thème est requis." });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("rejects an empty title before calling insert", async () => {
    const result = await createCard(baseFormData({ title: "  " }));

    expect(result).toEqual({ success: false, error: "Le titre est requis." });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("rejects when bullets is empty or only blank lines", async () => {
    const result = await createCard(baseFormData({ bullets: "   \n   " }));

    expect(result).toEqual({
      success: false,
      error: "Au moins un critère est requis.",
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("rejects when there is no admin session", async () => {
    authResult = { data: null, error: { message: "no session" } };

    const result = await createCard(baseFormData());

    expect(result).toEqual({
      success: false,
      error: "Session admin invalide.",
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("rejects a deckId that doesn't belong to the admin, without inserting a card", async () => {
    queueResult("decks", { data: null, error: null });

    const result = await createCard(baseFormData());

    expect(result).toEqual({ success: false, error: "Deck invalide." });
    expect(insertCalls).toEqual([]);
  });

  it("returns a generic error when the insert fails", async () => {
    queueResult("decks", { data: { id: "deck-1" }, error: null });
    queueResult("cards", { data: null, error: null });
    queueResult("cards", { data: null, error: { message: "db error" } });

    const result = await createCard(baseFormData());

    expect(result).toEqual({
      success: false,
      error: "Impossible de créer la carte.",
    });
  });
});
