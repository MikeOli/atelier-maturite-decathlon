import { describe, expect, it, vi, beforeEach } from "vitest";
import { createDeck } from "./create-deck-action";

type QueryResult = { data: unknown; error: unknown };

let insertSpy: ReturnType<typeof vi.fn>;

function createBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = vi.fn(chain);
  builder.insert = vi.fn(chain);
  builder.single = vi.fn(chain);
  builder.maybeSingle = vi.fn(chain);
  builder.then = (resolve: (value: QueryResult) => void) =>
    Promise.resolve(result).then(resolve);
  insertSpy = builder.insert as ReturnType<typeof vi.fn>;
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

beforeEach(() => {
  vi.clearAllMocks();
  authResult = { data: { claims: { sub: "admin-1" } }, error: null };
  fromResult = { data: null, error: null };
});

describe("createDeck", () => {
  it("inserts the deck with the admin's id, name, and description", async () => {
    fromResult = { data: { id: "deck-1" }, error: null };
    const formData = new FormData();
    formData.set("name", "Agilité");
    formData.set("description", "Un deck pour l'agilité.");

    const result = await createDeck(formData);

    expect(result).toEqual({ success: true, data: { id: "deck-1" } });
    expect(insertSpy).toHaveBeenCalledWith({
      admin_id: "admin-1",
      name: "Agilité",
      description: "Un deck pour l'agilité.",
    });
  });

  it("never includes is_default in the insert payload", async () => {
    fromResult = { data: { id: "deck-1" }, error: null };
    const formData = new FormData();
    formData.set("name", "Agilité");

    await createDeck(formData);

    const insertedPayload = insertSpy.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(insertedPayload).not.toHaveProperty("is_default");
  });

  it("defaults description to an empty string when omitted", async () => {
    fromResult = { data: { id: "deck-1" }, error: null };
    const formData = new FormData();
    formData.set("name", "Agilité");

    await createDeck(formData);

    expect(insertSpy).toHaveBeenCalledWith({
      admin_id: "admin-1",
      name: "Agilité",
      description: "",
    });
  });

  it("rejects an empty name before calling insert", async () => {
    const formData = new FormData();
    formData.set("name", "   ");

    const result = await createDeck(formData);

    expect(result).toEqual({
      success: false,
      error: "Le nom du deck est requis.",
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("rejects when there is no admin session", async () => {
    authResult = { data: null, error: { message: "no session" } };
    const formData = new FormData();
    formData.set("name", "Agilité");

    const result = await createDeck(formData);

    expect(result).toEqual({
      success: false,
      error: "Session admin invalide.",
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns a generic error when the insert fails", async () => {
    fromResult = { data: null, error: { message: "db error" } };
    const formData = new FormData();
    formData.set("name", "Agilité");

    const result = await createDeck(formData);

    expect(result).toEqual({
      success: false,
      error: "Impossible de créer le deck.",
    });
  });
});
