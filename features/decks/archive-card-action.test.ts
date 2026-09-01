import { describe, expect, it, vi, beforeEach } from "vitest";
import { archiveCard } from "./archive-card-action";

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

beforeEach(() => {
  vi.clearAllMocks();
  authResult = { data: { claims: { sub: "admin-1" } }, error: null };
  fromResult = { data: null, error: null };
});

describe("archiveCard", () => {
  it("archives the card", async () => {
    fromResult = { data: { id: "card-1" }, error: null };

    const result = await archiveCard("11111111-1111-1111-8111-111111111111");

    expect(result).toEqual({ success: true, data: null });
    expect(updateSpy).toHaveBeenCalledWith({ archived: true });
  });

  it("rejects a cardId that isn't a valid uuid, without calling the database", async () => {
    const result = await archiveCard("not-a-uuid");

    expect(result).toEqual({ success: false, error: "Carte invalide." });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("rejects when there is no admin session", async () => {
    authResult = { data: null, error: { message: "no session" } };

    const result = await archiveCard("11111111-1111-1111-8111-111111111111");

    expect(result).toEqual({
      success: false,
      error: "Session admin invalide.",
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns a generic error when no row is affected (foreign or nonexistent card)", async () => {
    fromResult = { data: null, error: { message: "no rows" } };

    const result = await archiveCard("11111111-1111-1111-8111-111111111111");

    expect(result).toEqual({ success: false, error: "Carte invalide." });
  });
});
