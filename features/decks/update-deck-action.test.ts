import { describe, expect, it, vi, beforeEach } from "vitest";
import { updateDeck } from "./update-deck-action";

type QueryResult = { data: unknown; error: unknown };

let updateSpy: ReturnType<typeof vi.fn>;

function createBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = vi.fn(chain);
  builder.eq = vi.fn(chain);
  builder.single = vi.fn(chain);
  builder.update = vi.fn(chain);
  builder.then = (resolve: (value: QueryResult) => void) =>
    Promise.resolve(result).then(resolve);
  updateSpy = builder.update as ReturnType<typeof vi.fn>;
  return builder;
}

let authResult: { data: { claims: { sub: string } } | null; error: unknown } = {
  data: { claims: { sub: "admin-1" } },
  error: null,
};
let fromResult: QueryResult = { data: null, error: null };

const fromMock = vi.fn(() => createBuilder(fromResult));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getClaims: () => Promise.resolve(authResult) },
    from: fromMock,
  }),
}));

function baseFormData(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("deckId", overrides.deckId ?? "11111111-1111-1111-8111-111111111111");
  formData.set("name", overrides.name ?? "Agilité");
  formData.set("description", overrides.description ?? "Un deck pour l'agilité.");
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  authResult = { data: { claims: { sub: "admin-1" } }, error: null };
  fromResult = { data: null, error: null };
});

describe("updateDeck", () => {
  it("updates the deck's name and description", async () => {
    fromResult = { data: { id: "deck-1" }, error: null };

    const result = await updateDeck(baseFormData());

    expect(result).toEqual({ success: true, data: { id: "deck-1" } });
    expect(updateSpy).toHaveBeenCalledWith({
      name: "Agilité",
      description: "Un deck pour l'agilité.",
    });
  });

  it("defaults description to an empty string when omitted", async () => {
    fromResult = { data: { id: "deck-1" }, error: null };
    const formData = new FormData();
    formData.set("deckId", "11111111-1111-1111-8111-111111111111");
    formData.set("name", "Agilité");

    await updateDeck(formData);

    expect(updateSpy).toHaveBeenCalledWith({
      name: "Agilité",
      description: "",
    });
  });

  it("rejects an empty name before calling update", async () => {
    const result = await updateDeck(baseFormData({ name: "   " }));

    expect(result).toEqual({
      success: false,
      error: "Le nom du deck est requis.",
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("rejects when there is no admin session", async () => {
    authResult = { data: null, error: { message: "no session" } };

    const result = await updateDeck(baseFormData());

    expect(result).toEqual({
      success: false,
      error: "Session admin invalide.",
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns a generic error when no row is affected (foreign or nonexistent deck)", async () => {
    fromResult = { data: null, error: { message: "no rows" } };

    const result = await updateDeck(baseFormData());

    expect(result).toEqual({ success: false, error: "Deck invalide." });
  });
});
