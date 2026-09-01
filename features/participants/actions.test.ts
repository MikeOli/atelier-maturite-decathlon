import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  joinSession,
  listParticipants,
  findParticipantByClientToken,
} from "./actions";
import { AVATARS } from "@/lib/avatars";

type QueryResult = { data: unknown; error: unknown };

function createBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = vi.fn(chain);
  builder.eq = vi.fn(chain);
  builder.insert = vi.fn(chain);
  builder.single = vi.fn(chain);
  builder.maybeSingle = vi.fn(chain);
  builder.then = (
    resolve: (value: QueryResult) => void,
  ) => Promise.resolve(result).then(resolve);
  return builder;
}

// `joinSession` now queries two tables in sequence (session_public_info,
// then participants) — each `.from(table)` call pops the next queued
// result for that table, same pattern as features/sessions/actions.test.ts.
let tableResultQueues: Record<string, QueryResult[]> = {};
let defaultResult: QueryResult = { data: null, error: null };

const fromMock = vi.fn((table: string) => {
  const queue = tableResultQueues[table];
  const result = queue && queue.length > 0 ? queue.shift()! : defaultResult;
  return createBuilder(result);
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ from: fromMock }),
}));

beforeEach(() => {
  tableResultQueues = {};
  defaultResult = { data: null, error: null };
});

const validInput = {
  sessionId: "5b6c1e3e-8f2a-4b3e-9f0a-1234567890ab",
  avatarKey: AVATARS[0].key,
  clientToken: "1a046690-3930-41f2-b5ec-2c65ff365135",
};

describe("joinSession", () => {
  it("inserts the participant and returns it on success", async () => {
    tableResultQueues.session_public_info = [
      { data: { status: "EN_COURS" }, error: null },
    ];
    tableResultQueues.participants = [
      {
        data: {
          id: "participant-1",
          avatar_key: AVATARS[0].key,
          avatar_label: AVATARS[0].label,
        },
        error: null,
      },
    ];

    const result = await joinSession(validInput);

    expect(result).toEqual({
      success: true,
      data: {
        id: "participant-1",
        avatarKey: AVATARS[0].key,
        avatarLabel: AVATARS[0].label,
      },
    });
  });

  it("rejects joining when the session is closed", async () => {
    tableResultQueues.session_public_info = [
      { data: { status: "CLOTUREE" }, error: null },
    ];

    const result = await joinSession(validInput);

    expect(result).toEqual({
      success: false,
      error: "Cette session est clôturée.",
    });
  });

  it("returns a generic error when the session status lookup fails", async () => {
    tableResultQueues.session_public_info = [
      { data: null, error: { message: "boom" } },
    ];

    const result = await joinSession(validInput);

    expect(result).toEqual({
      success: false,
      error: "Impossible de rejoindre la session.",
    });
  });

  it("returns a clear error with an avatar_taken code when the avatar was already claimed", async () => {
    tableResultQueues.session_public_info = [
      { data: { status: "EN_COURS" }, error: null },
    ];
    tableResultQueues.participants = [
      { data: null, error: { code: "23505", message: "duplicate key" } },
    ];

    const result = await joinSession(validInput);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("avatar_taken");
      expect(result.error).toMatch(/pris/);
    }
  });

  it("returns a generic error without a code for other database failures", async () => {
    tableResultQueues.session_public_info = [
      { data: { status: "EN_COURS" }, error: null },
    ];
    tableResultQueues.participants = [
      { data: null, error: { code: "500", message: "boom" } },
    ];

    const result = await joinSession(validInput);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBeUndefined();
    }
  });

  it("rejects an unknown avatar key before hitting the database", async () => {
    const result = await joinSession({ ...validInput, avatarKey: "not-a-real-avatar" });

    expect(result).toEqual({ success: false, error: "Avatar inconnu." });
  });

  it("rejects an invalid payload", async () => {
    const result = await joinSession({ sessionId: "not-a-uuid" });

    expect(result.success).toBe(false);
  });
});

describe("listParticipants", () => {
  it("returns the mapped participant list", async () => {
    defaultResult = {
      data: [
        { id: "p1", avatar_key: "licorne-fluo", avatar_label: "Licorne Fluo" },
        { id: "p2", avatar_key: "poulpe-disco", avatar_label: "Poulpe Disco" },
      ],
      error: null,
    };

    const result = await listParticipants("session-1");

    expect(result).toEqual([
      { id: "p1", avatarKey: "licorne-fluo", avatarLabel: "Licorne Fluo" },
      { id: "p2", avatarKey: "poulpe-disco", avatarLabel: "Poulpe Disco" },
    ]);
  });

  it("returns an empty list on a database error", async () => {
    defaultResult = { data: null, error: { message: "boom" } };

    const result = await listParticipants("session-1");

    expect(result).toEqual([]);
  });
});

describe("findParticipantByClientToken", () => {
  it("returns the matching participant", async () => {
    defaultResult = {
      data: { id: "p1", avatar_key: "licorne-fluo", avatar_label: "Licorne Fluo" },
      error: null,
    };

    const result = await findParticipantByClientToken("session-1", "token-1");

    expect(result).toEqual({
      id: "p1",
      avatarKey: "licorne-fluo",
      avatarLabel: "Licorne Fluo",
    });
  });

  it("returns null when no participant matches the token", async () => {
    defaultResult = { data: null, error: null };

    const result = await findParticipantByClientToken("session-1", "unknown-token");

    expect(result).toBeNull();
  });
});
