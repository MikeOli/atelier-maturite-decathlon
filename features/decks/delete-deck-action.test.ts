import { describe, expect, it, vi, beforeEach } from "vitest";
import { deleteDeck } from "./delete-deck-action";

type QueryResult = { data: unknown; error: unknown };

/**
 * `deleteDeck` enchaîne deux requêtes sur la même table : la lecture de
 * is_default, puis la suppression. Le builder renvoie donc un résultat
 * différent selon qu'on termine par maybeSingle() ou par delete().
 */
function createBuilder() {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  let deleting = false;
  builder.select = vi.fn(chain);
  builder.eq = vi.fn(chain);
  builder.delete = vi.fn(() => {
    deleting = true;
    return builder;
  });
  builder.maybeSingle = vi.fn(() => Promise.resolve(lookupResult));
  builder.then = (resolve: (value: QueryResult) => void) =>
    Promise.resolve(deleting ? deleteResult : lookupResult).then(resolve);
  return builder;
}

let authResult: { data: { claims: { sub: string } } | null; error: unknown };
let lookupResult: QueryResult;
let deleteResult: QueryResult;

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getClaims: () => Promise.resolve(authResult) },
    from: () => createBuilder(),
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const DECK_ID = "11111111-1111-1111-8111-111111111111";

beforeEach(() => {
  authResult = { data: { claims: { sub: "admin-1" } }, error: null };
  lookupResult = { data: { is_default: false }, error: null };
  deleteResult = { data: null, error: null };
});

describe("deleteDeck", () => {
  // Le point de la bascule du 2026-10-21 : le catalogue est commun, donc
  // un animateur supprime un deck qu'il n'a pas créé. Avant, la requête
  // filtrait sur admin_id et renvoyait « Deck invalide ».
  it("supprime un deck créé par quelqu'un d'autre", async () => {
    const result = await deleteDeck(DECK_ID);

    expect(result).toEqual({ success: true, data: null });
  });

  it("refuse le deck par défaut", async () => {
    lookupResult = { data: { is_default: true }, error: null };

    const result = await deleteDeck(DECK_ID);

    expect(result).toEqual({
      success: false,
      error: "Le deck par défaut ne peut pas être supprimé.",
    });
  });

  it("explique qu'un deck utilisé par une session ne peut pas partir", async () => {
    deleteResult = { data: null, error: { code: "23503" } };

    const result = await deleteDeck(DECK_ID);

    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toContain("y compris clôturées");
  });

  it("distingue un identifiant malformé d'un deck absent", async () => {
    expect(await deleteDeck("pas-un-uuid")).toEqual({
      success: false,
      error: "Deck invalide.",
    });

    lookupResult = { data: null, error: null };
    expect(await deleteDeck(DECK_ID)).toEqual({
      success: false,
      error: "Deck introuvable.",
    });
  });

  it("refuse sans session admin", async () => {
    authResult = { data: null, error: { message: "no session" } };

    const result = await deleteDeck(DECK_ID);

    expect(result).toEqual({ success: false, error: "Session admin invalide." });
  });
});
