import { describe, expect, it, vi, beforeEach } from "vitest";
import { updateCard } from "./update-card-action";

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
  formData.set("cardId", overrides.cardId ?? "11111111-1111-1111-8111-111111111111");
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
  authResult = { data: { claims: { sub: "admin-1" } }, error: null };
  fromResult = { data: null, error: null };
});

describe("updateCard", () => {
  it("updates the card with the parsed bullets array", async () => {
    fromResult = { data: { id: "card-1" }, error: null };

    const result = await updateCard(baseFormData());

    expect(result).toEqual({ success: true, data: { id: "card-1" } });
    expect(updateSpy).toHaveBeenCalledWith({
      theme: "Strategy",
      title: "Vision produit",
      bullets: ["Premier critère.", "Deuxième critère."],
    });
  });

  it("rejects an empty theme before calling update", async () => {
    const result = await updateCard(baseFormData({ theme: "   " }));

    expect(result).toEqual({ success: false, error: "Le thème est requis." });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("rejects an empty title before calling update", async () => {
    const result = await updateCard(baseFormData({ title: "  " }));

    expect(result).toEqual({ success: false, error: "Le titre est requis." });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("rejects when bullets is empty or only blank lines", async () => {
    const result = await updateCard(baseFormData({ bullets: "   \n   " }));

    expect(result).toEqual({
      success: false,
      error: "Au moins un critère est requis.",
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("rejects when there is no admin session", async () => {
    authResult = { data: null, error: { message: "no session" } };

    const result = await updateCard(baseFormData());

    expect(result).toEqual({
      success: false,
      error: "Session admin invalide.",
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns a generic error when no row is affected (foreign or nonexistent card)", async () => {
    fromResult = { data: null, error: { message: "no rows" } };

    const result = await updateCard(baseFormData());

    expect(result).toEqual({ success: false, error: "Carte invalide." });
  });
});
