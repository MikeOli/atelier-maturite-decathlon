import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getPublicSessionSummary,
  getSessionByFacilitatorToken,
  getSessionCurrentCard,
  getSessionLiveState,
  closeSession,
  revealVotes,
  revealVotesAsFacilitator,
  goToNextCard,
  goToNextCardAsFacilitator,
  hasNextCard,
  listActiveSessionsForAdmin,
  listCompletedSessionsForAdmin,
  deleteSession,
  setCardConsensus,
  setCardConsensusAsFacilitator,
  getCardConsensus,
  startSession,
  startSessionAsFacilitator,
  closeSessionAsFacilitator,
  setTranscriptionEnabled,
  syncTranscriptDraft,
} from "./actions";

type QueryResult = { data?: unknown; error: unknown };
type RpcResult = { data?: unknown; error: { code?: string; message: string } | null };

// Records every `.eq()`/`.gt()` call made during a test — used to assert
// which filters a query actually applied (e.g. `findNextCardId` excluding
// archived cards), since the queued-result stubs below don't otherwise care
// what filters were requested.
let queryCallLog: { method: string; args: unknown[] }[] = [];

function createBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  const loggedChain =
    (method: string) =>
    (...args: unknown[]) => {
      queryCallLog.push({ method, args });
      return builder;
    };
  builder.select = vi.fn(chain);
  builder.eq = vi.fn(loggedChain("eq"));
  builder.gt = vi.fn(loggedChain("gt"));
  builder.order = vi.fn(chain);
  builder.limit = vi.fn(chain);
  builder.single = vi.fn(chain);
  builder.maybeSingle = vi.fn(chain);
  builder.update = vi.fn(loggedChain("update"));
  builder.delete = vi.fn(chain);
  builder.upsert = vi.fn(chain);
  builder.then = (resolve: (value: QueryResult) => void) =>
    Promise.resolve(result).then(resolve);
  return builder;
}

let authResult: { data: { claims: { sub: string } } | null; error: unknown } = {
  data: { claims: { sub: "admin-1" } },
  error: null,
};
// Each `.from(table)` call pops the next queued result for that table —
// revealVotes calls `.from("sessions")` more than once (ownership check,
// update, and a possible rollback), each of which needs to be able to
// resolve differently.
let tableResultQueues: Record<string, QueryResult[]> = {};
let defaultResult: QueryResult = { data: null, error: null };

const fromMock = vi.fn((table: string) => {
  const queue = tableResultQueues[table];
  const result = queue && queue.length > 0 ? queue.shift()! : defaultResult;
  return createBuilder(result);
});

let rpcResult: RpcResult = { error: null };
// `getSessionByFacilitatorToken` chains `.maybeSingle()` off `.rpc(...)`
// (the RPC returns a set), while the facilitator write actions just
// `await supabase.rpc(...)` directly — this stub supports both.
const rpcMock = vi.fn(() => ({
  maybeSingle: () => Promise.resolve(rpcResult),
  then: (resolve: (value: RpcResult) => void) =>
    Promise.resolve(rpcResult).then(resolve),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    from: fromMock,
    rpc: rpcMock,
    auth: { getClaims: () => Promise.resolve(authResult) },
  }),
}));

// closeSession/closeSessionAsFacilitator (Story 5.3) call these to build
// the AI synthesis before closing — mocked directly rather than simulated
// through the `supabase.from` stub above, since getSessionSynthesis has
// its own independent test coverage (features/synthesis/actions.test.ts)
// and re-simulating its queries here would just compete with closeSession's
// own queue consumption on the same mocked `.from()`.
const getSessionSynthesisMock = vi.fn();
const getSessionSynthesisAsFacilitatorMock = vi.fn();
const generateAiSynthesisMock = vi.fn();

vi.mock("@/features/synthesis/actions", () => ({
  getSessionSynthesis: (...args: unknown[]) => getSessionSynthesisMock(...args),
  getSessionSynthesisAsFacilitator: (...args: unknown[]) =>
    getSessionSynthesisAsFacilitatorMock(...args),
}));

vi.mock("@/features/synthesis/ai-synthesis", () => ({
  generateAiSynthesis: (...args: unknown[]) => generateAiSynthesisMock(...args),
}));

beforeEach(() => {
  authResult = { data: { claims: { sub: "admin-1" } }, error: null };
  tableResultQueues = {};
  queryCallLog = [];
  defaultResult = { data: null, error: null };
  rpcResult = { error: null };
  getSessionSynthesisMock.mockReset().mockResolvedValue([]);
  getSessionSynthesisAsFacilitatorMock
    .mockReset()
    .mockResolvedValue({ cards: [], transcriptDraft: null });
  generateAiSynthesisMock.mockReset().mockResolvedValue(null);
});

describe("getPublicSessionSummary", () => {
  it("returns the session summary when found", async () => {
    defaultResult = {
      data: {
        id: "session-1",
        team_name: "Alpha",
        status: "EN_COURS",
        duration_minutes: 60,
        created_at: "2026-08-20T10:00:00.000Z",
        deck_name: "Maturité Produit",
        deck_description: "16 cartes...",
        transcription_enabled: true,
      },
      error: null,
    };

    const result = await getPublicSessionSummary("session-1");

    expect(result).toEqual({
      id: "session-1",
      teamName: "Alpha",
      status: "EN_COURS",
      durationMinutes: 60,
      createdAt: "2026-08-20T10:00:00.000Z",
      deckName: "Maturité Produit",
      deckDescription: "16 cartes...",
      transcriptionEnabled: true,
    });
  });

  it("defaults deckDescription to an empty string rather than treating it as missing", async () => {
    defaultResult = {
      data: {
        id: "session-1",
        team_name: "Alpha",
        status: "EN_COURS",
        duration_minutes: 60,
        created_at: "2026-08-20T10:00:00.000Z",
        deck_name: "Maturité Produit",
        deck_description: "",
        transcription_enabled: false,
      },
      error: null,
    };

    const result = await getPublicSessionSummary("session-1");

    expect(result).toEqual({
      id: "session-1",
      teamName: "Alpha",
      status: "EN_COURS",
      durationMinutes: 60,
      createdAt: "2026-08-20T10:00:00.000Z",
      deckName: "Maturité Produit",
      deckDescription: "",
      transcriptionEnabled: false,
    });
  });

  it("returns null when the session doesn't exist", async () => {
    defaultResult = { data: null, error: { message: "not found" } };

    const result = await getPublicSessionSummary("missing-id");

    expect(result).toBeNull();
  });

  // FR34 / Story 4.4: nothing computes or overrides `status` based on
  // elapsed time — it is passed through exactly as stored. `createdAt` here
  // is a full year before `durationMinutes` would have elapsed, and the
  // mocked row still says "EN_COURS": no auto-expiration logic exists to
  // second-guess that.
  it("passes status through unchanged even long after duration_minutes has elapsed", async () => {
    defaultResult = {
      data: {
        id: "session-1",
        team_name: "Alpha",
        status: "EN_COURS",
        duration_minutes: 30,
        created_at: "2025-08-20T10:00:00.000Z",
        deck_name: "Maturité Produit",
        deck_description: "16 cartes...",
      },
      error: null,
    };

    const result = await getPublicSessionSummary("session-1");

    expect(result).toEqual({
      id: "session-1",
      teamName: "Alpha",
      status: "EN_COURS",
      durationMinutes: 30,
      createdAt: "2025-08-20T10:00:00.000Z",
      deckName: "Maturité Produit",
      deckDescription: "16 cartes...",
      transcriptionEnabled: false,
    });
  });

  // Same invariant, mirrored on the CLOTUREE side: passthrough must not
  // reinterpret status based on elapsed time in either direction.
  it("passes CLOTUREE status through unchanged long after duration_minutes has elapsed", async () => {
    defaultResult = {
      data: {
        id: "session-2",
        team_name: "Beta",
        status: "CLOTUREE",
        duration_minutes: 30,
        created_at: "2025-08-20T10:00:00.000Z",
        deck_name: "Maturité Produit",
        deck_description: "16 cartes...",
      },
      error: null,
    };

    const result = await getPublicSessionSummary("session-2");

    expect(result).toEqual({
      id: "session-2",
      teamName: "Beta",
      status: "CLOTUREE",
      durationMinutes: 30,
      createdAt: "2025-08-20T10:00:00.000Z",
      deckName: "Maturité Produit",
      deckDescription: "16 cartes...",
      transcriptionEnabled: false,
    });
  });
});

describe("getSessionByFacilitatorToken", () => {
  it("returns the session summary when the token matches", async () => {
    rpcResult = {
      data: {
        id: "session-1",
        team_name: "Alpha",
        status: "EN_COURS",
        duration_minutes: 60,
        created_at: "2026-08-20T10:00:00.000Z",
      },
      error: null,
    };

    const result = await getSessionByFacilitatorToken("token-1");

    expect(result).toEqual({
      id: "session-1",
      teamName: "Alpha",
      status: "EN_COURS",
      durationMinutes: 60,
      createdAt: "2026-08-20T10:00:00.000Z",
      transcriptionEnabled: false,
      transcriptDraft: null,
    });
    expect(rpcMock).toHaveBeenCalledWith("get_session_by_facilitator_token", {
      p_facilitator_token: "token-1",
    });
  });

  it("returns null when no session matches the token", async () => {
    rpcResult = { data: null, error: null };

    const result = await getSessionByFacilitatorToken("bad-token");

    expect(result).toBeNull();
  });
});

describe("getSessionCurrentCard", () => {
  it("returns the current card when found", async () => {
    defaultResult = {
      data: {
        card_id: "card-1",
        title: "Vision produit",
        theme: "Stratégie",
        bullets: ["Point A", "Point B"],
      },
      error: null,
    };

    const result = await getSessionCurrentCard("session-1");

    expect(result).toEqual({
      cardId: "card-1",
      title: "Vision produit",
      theme: "Stratégie",
      bullets: ["Point A", "Point B"],
    });
  });

  it("normalizes a missing/malformed bullets field to an empty array", async () => {
    defaultResult = {
      data: {
        card_id: "card-1",
        title: "Vision produit",
        theme: "Stratégie",
        bullets: null,
      },
      error: null,
    };

    const result = await getSessionCurrentCard("session-1");

    expect(result?.bullets).toEqual([]);
  });

  it("returns null when the title is missing", async () => {
    defaultResult = {
      data: { card_id: "card-1", title: null, theme: "Stratégie", bullets: [] },
      error: null,
    };

    const result = await getSessionCurrentCard("session-1");

    expect(result).toBeNull();
  });

  it("returns null when the card_id is missing", async () => {
    defaultResult = {
      data: { card_id: null, title: "Vision produit", theme: "Stratégie", bullets: [] },
      error: null,
    };

    const result = await getSessionCurrentCard("session-1");

    expect(result).toBeNull();
  });

  it("returns null when the theme is missing", async () => {
    defaultResult = {
      data: { card_id: "card-1", title: "Vision produit", theme: null, bullets: [] },
      error: null,
    };

    const result = await getSessionCurrentCard("session-1");

    expect(result).toBeNull();
  });

  it("returns null on a Supabase error", async () => {
    defaultResult = { data: null, error: { message: "db error" } };

    const result = await getSessionCurrentCard("session-1");

    expect(result).toBeNull();
  });
});

describe("getSessionLiveState", () => {
  it("returns the live state when found", async () => {
    defaultResult = {
      data: { current_card_id: "card-1", votes_revealed: true },
      error: null,
    };

    const result = await getSessionLiveState("session-1");

    expect(result).toEqual({ currentCardId: "card-1", votesRevealed: true });
  });

  it("returns a null currentCardId as-is (session not yet started)", async () => {
    defaultResult = {
      data: { current_card_id: null, votes_revealed: false },
      error: null,
    };

    const result = await getSessionLiveState("session-1");

    expect(result).toEqual({ currentCardId: null, votesRevealed: false });
  });

  it("returns null on a Supabase error", async () => {
    defaultResult = { data: null, error: { message: "db error" } };

    const result = await getSessionLiveState("session-1");

    expect(result).toBeNull();
  });

  it("returns null when no live state row exists", async () => {
    defaultResult = { data: null, error: null };

    const result = await getSessionLiveState("session-1");

    expect(result).toBeNull();
  });
});

describe("closeSession", () => {
  it("rejects when the admin isn't authenticated", async () => {
    authResult = { data: null, error: { message: "no session" } };

    const result = await closeSession("session-1");

    expect(result).toEqual({ success: false, error: "Session admin invalide." });
  });

  it("rejects when the session doesn't belong to the admin", async () => {
    tableResultQueues.sessions = [{ data: null, error: null }];

    const result = await closeSession("session-1");

    expect(result).toEqual({ success: false, error: "Session invalide." });
  });

  it("closes the session for the owning admin", async () => {
    tableResultQueues.sessions = [
      { data: { id: "session-1", transcript_draft: null }, error: null },
      { data: null, error: null },
    ];

    const result = await closeSession("session-1");

    expect(result).toEqual({ success: true, data: null });
    // ai_synthesis is omitted (not set to null) when generateAiSynthesis
    // returns null — see the dedicated retry-safety test below.
    expect(queryCallLog).toContainEqual({
      method: "update",
      args: [
        {
          status: "CLOTUREE",
          transcript_draft: null,
          transcription_enabled: false,
        },
      ],
    });
  });

  // Adversarial review finding (2026-08-24): closing is idempotent by
  // construction, but a retried/double-submitted close must never let a
  // failed second AI call wipe a result already stored by the first one.
  it("never overwrites an existing ai_synthesis with null on a retry (generateAiSynthesis failing)", async () => {
    tableResultQueues.sessions = [
      { data: { id: "session-1", transcript_draft: null }, error: null },
      { data: null, error: null },
    ];
    generateAiSynthesisMock.mockResolvedValue(null);

    await closeSession("session-1");

    const updateCall = queryCallLog.find((c) => c.method === "update");
    expect(updateCall?.args[0]).not.toHaveProperty("ai_synthesis");
  });

  it("calls getSessionSynthesis/generateAiSynthesis with the session's cards and transcript, and stores the result", async () => {
    tableResultQueues.sessions = [
      { data: { id: "session-1", transcript_draft: "Discussion..." }, error: null },
      { data: null, error: null },
    ];
    const cards = [
      { cardId: "card-1", title: "Vision", theme: "Strategy", bullets: [], consensusValue: 3 },
    ];
    getSessionSynthesisMock.mockResolvedValue(cards);
    const aiResult = {
      generatedAt: "2026-08-24T10:00:00.000Z",
      cards: [{ cardId: "card-1", synthesis: "...", keywords: ["vision"] }],
      workshopProposals: [],
    };
    generateAiSynthesisMock.mockResolvedValue(aiResult);

    const result = await closeSession("session-1");

    expect(result).toEqual({ success: true, data: null });
    expect(getSessionSynthesisMock).toHaveBeenCalledWith("session-1", "admin-1");
    expect(generateAiSynthesisMock).toHaveBeenCalledWith(cards, "Discussion...");
    expect(queryCallLog).toContainEqual({
      method: "update",
      args: [
        {
          status: "CLOTUREE",
          transcript_draft: null,
          transcription_enabled: false,
          ai_synthesis: aiResult,
        },
      ],
    });
  });

  it("rejects when votes are revealed but no consensus was set for the current card", async () => {
    tableResultQueues.sessions = [
      {
        data: { id: "session-1", current_card_id: "card-1", votes_revealed: true },
        error: null,
      },
    ];
    tableResultQueues.card_consensus = [{ data: null, error: null }];

    const result = await closeSession("session-1");

    expect(result).toEqual({
      success: false,
      error: "Saisis la valeur d'accord d'équipe avant de clôturer la session.",
    });
  });

  it("closes successfully when votes are revealed and consensus was set", async () => {
    tableResultQueues.sessions = [
      {
        data: { id: "session-1", current_card_id: "card-1", votes_revealed: true },
        error: null,
      },
      { data: null, error: null },
    ];
    tableResultQueues.card_consensus = [{ data: { value: 4 }, error: null }];

    const result = await closeSession("session-1");

    expect(result).toEqual({ success: true, data: null });
  });

  it("surfaces an error if the status update fails", async () => {
    tableResultQueues.sessions = [
      { data: { id: "session-1" }, error: null },
      { data: null, error: { message: "db error" } },
    ];

    const result = await closeSession("session-1");

    expect(result).toEqual({
      success: false,
      error: "Impossible de clôturer la session.",
    });
  });
});

describe("revealVotes", () => {
  it("rejects when the admin isn't authenticated", async () => {
    authResult = { data: null, error: { message: "no session" } };

    const result = await revealVotes("session-1");

    expect(result).toEqual({ success: false, error: "Session admin invalide." });
  });

  it("rejects when the session doesn't belong to the admin", async () => {
    tableResultQueues.sessions = [{ data: null, error: null }];

    const result = await revealVotes("session-1");

    expect(result).toEqual({ success: false, error: "Session invalide." });
  });

  it("updates both sessions and session_live_state for the owning admin", async () => {
    tableResultQueues.sessions = [
      { data: { id: "session-1" }, error: null }, // ownership check
      { error: null }, // votes_revealed update
    ];
    tableResultQueues.session_live_state = [{ error: null }];

    const result = await revealVotes("session-1");

    expect(result).toEqual({ success: true, data: null });
  });

  it("rejects when the session is already closed", async () => {
    tableResultQueues.sessions = [
      { data: { id: "session-1", status: "CLOTUREE" }, error: null },
    ];

    const result = await revealVotes("session-1");

    expect(result).toEqual({
      success: false,
      error: "Cette session est clôturée.",
    });
  });

  it("fails cleanly when the sessions update itself fails", async () => {
    tableResultQueues.sessions = [
      { data: { id: "session-1" }, error: null }, // ownership check
      { error: { message: "db error" } }, // votes_revealed update fails
    ];

    const result = await revealVotes("session-1");

    expect(result).toEqual({
      success: false,
      error: "Impossible de révéler les votes.",
    });
  });

  it("rolls back sessions.votes_revealed when the live_state update fails", async () => {
    tableResultQueues.sessions = [
      { data: { id: "session-1" }, error: null }, // ownership check
      { error: null }, // votes_revealed update succeeds
      { error: null }, // rollback update
    ];
    tableResultQueues.session_live_state = [
      { error: { message: "db error" } }, // live_state update fails
    ];

    const result = await revealVotes("session-1");

    expect(result).toEqual({
      success: false,
      error: "Impossible de révéler les votes.",
    });
    // All three queued "sessions" results were consumed: ownership check,
    // the votes_revealed update, and the rollback update.
    expect(tableResultQueues.sessions).toHaveLength(0);
  });
});

describe("goToNextCard", () => {
  it("rejects when the admin isn't authenticated", async () => {
    authResult = { data: null, error: { message: "no session" } };

    const result = await goToNextCard("session-1");

    expect(result).toEqual({ success: false, error: "Session admin invalide." });
  });

  it("rejects when the session doesn't belong to the admin", async () => {
    tableResultQueues.sessions = [{ data: null, error: null }];

    const result = await goToNextCard("session-1");

    expect(result).toEqual({ success: false, error: "Session invalide." });
  });

  it("rejects when votes haven't been revealed yet", async () => {
    tableResultQueues.sessions = [
      {
        data: {
          deck_id: "deck-1",
          current_card_id: "card-1",
          votes_revealed: false,
        },
        error: null,
      },
    ];

    const result = await goToNextCard("session-1");

    expect(result).toEqual({
      success: false,
      error: "Révèle les votes avant de passer à la carte suivante.",
    });
  });

  it("rejects when no consensus value has been set for the current card (Story 3.8)", async () => {
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
    tableResultQueues.card_consensus = [{ data: null, error: null }];

    const result = await goToNextCard("session-1");

    expect(result).toEqual({
      success: false,
      error: "Saisis la valeur d'accord d'équipe avant de passer à la carte suivante.",
    });
  });

  it("rejects when the session is already closed", async () => {
    tableResultQueues.sessions = [
      {
        data: {
          deck_id: "deck-1",
          current_card_id: "card-1",
          votes_revealed: true,
          status: "CLOTUREE",
        },
        error: null,
      },
    ];

    const result = await goToNextCard("session-1");

    expect(result).toEqual({
      success: false,
      error: "Cette session est clôturée.",
    });
  });

  it("reports closure rather than a generic error when a closed session also has no active card", async () => {
    tableResultQueues.sessions = [
      {
        data: {
          deck_id: "deck-1",
          current_card_id: null,
          votes_revealed: false,
          status: "CLOTUREE",
        },
        error: null,
      },
    ];

    const result = await goToNextCard("session-1");

    expect(result).toEqual({
      success: false,
      error: "Cette session est clôturée.",
    });
  });

  it("returns no-more-cards without mutating state on the last card", async () => {
    tableResultQueues.sessions = [
      {
        data: {
          deck_id: "deck-1",
          current_card_id: "card-16",
          votes_revealed: true,
        },
        error: null,
      },
    ];
    tableResultQueues.card_consensus = [{ data: { value: 5 }, error: null }];
    tableResultQueues.cards = [
      { data: { order_index: 16 }, error: null }, // current card lookup
      { data: null, error: null }, // no next card
    ];

    const result = await goToNextCard("session-1");

    expect(result).toEqual({
      success: false,
      error: "C'était la dernière carte du deck.",
      code: "no-more-cards",
    });
    expect(tableResultQueues.sessions).toHaveLength(0);
  });

  it("excludes archived cards from the next-card resolution (Story 6.6)", async () => {
    tableResultQueues.sessions = [
      {
        data: {
          deck_id: "deck-1",
          current_card_id: "card-1",
          votes_revealed: true,
        },
        error: null,
      },
      { error: null }, // sessions update
    ];
    tableResultQueues.card_consensus = [{ data: { value: 4 }, error: null }];
    tableResultQueues.cards = [
      { data: { order_index: 1 }, error: null }, // current card lookup
      { data: { id: "card-2" }, error: null }, // next card lookup
    ];
    tableResultQueues.session_live_state = [{ error: null }];

    await goToNextCard("session-1");

    expect(queryCallLog).toContainEqual({ method: "eq", args: ["archived", false] });
  });

  it("advances to the next card and resets votes_revealed on both tables", async () => {
    tableResultQueues.sessions = [
      {
        data: {
          deck_id: "deck-1",
          current_card_id: "card-1",
          votes_revealed: true,
        },
        error: null,
      },
      { error: null }, // sessions update
    ];
    tableResultQueues.card_consensus = [{ data: { value: 4 }, error: null }];
    tableResultQueues.cards = [
      { data: { order_index: 1 }, error: null }, // current card lookup
      { data: { id: "card-2" }, error: null }, // next card lookup
    ];
    tableResultQueues.session_live_state = [{ error: null }];

    const result = await goToNextCard("session-1");

    expect(result).toEqual({ success: true, data: { cardId: "card-2" } });
  });

  it("fails cleanly when the sessions update itself fails", async () => {
    tableResultQueues.sessions = [
      {
        data: {
          deck_id: "deck-1",
          current_card_id: "card-1",
          votes_revealed: true,
        },
        error: null,
      },
      { error: { message: "db error" } }, // sessions update fails
    ];
    tableResultQueues.card_consensus = [{ data: { value: 3 }, error: null }];
    tableResultQueues.cards = [
      { data: { order_index: 1 }, error: null },
      { data: { id: "card-2" }, error: null },
    ];

    const result = await goToNextCard("session-1");

    expect(result).toEqual({
      success: false,
      error: "Impossible de passer à la carte suivante.",
    });
  });

  it("rolls back sessions when the live_state update fails", async () => {
    tableResultQueues.sessions = [
      {
        data: {
          deck_id: "deck-1",
          current_card_id: "card-1",
          votes_revealed: true,
        },
        error: null,
      },
      { error: null }, // sessions update succeeds
      { error: null }, // rollback update
    ];
    tableResultQueues.card_consensus = [{ data: { value: 4 }, error: null }];
    tableResultQueues.cards = [
      { data: { order_index: 1 }, error: null },
      { data: { id: "card-2" }, error: null },
    ];
    tableResultQueues.session_live_state = [
      { error: { message: "db error" } },
    ];

    const result = await goToNextCard("session-1");

    expect(result).toEqual({
      success: false,
      error: "Impossible de passer à la carte suivante.",
    });
    expect(tableResultQueues.sessions).toHaveLength(0);
  });
});

describe("hasNextCard", () => {
  it("returns true when a next card exists in the deck", async () => {
    tableResultQueues.sessions = [
      { data: { deck_id: "deck-1", current_card_id: "card-1" }, error: null },
    ];
    tableResultQueues.cards = [
      { data: { order_index: 1 }, error: null }, // current card lookup
      { data: { id: "card-2" }, error: null }, // next card lookup
    ];

    const result = await hasNextCard("session-1");

    expect(result).toBe(true);
  });

  it("returns false when the session has no current card", async () => {
    tableResultQueues.sessions = [
      { data: { deck_id: "deck-1", current_card_id: null }, error: null },
    ];

    const result = await hasNextCard("session-1");

    expect(result).toBe(false);
  });

  it("returns false when the current card can't be found", async () => {
    tableResultQueues.sessions = [
      { data: { deck_id: "deck-1", current_card_id: "card-1" }, error: null },
    ];
    tableResultQueues.cards = [{ data: null, error: null }];

    const result = await hasNextCard("session-1");

    expect(result).toBe(false);
  });

  it("returns false on the last card of the deck", async () => {
    tableResultQueues.sessions = [
      { data: { deck_id: "deck-1", current_card_id: "card-16" }, error: null },
    ];
    tableResultQueues.cards = [
      { data: { order_index: 16 }, error: null }, // current card lookup
      { data: null, error: null }, // no next card
    ];

    const result = await hasNextCard("session-1");

    expect(result).toBe(false);
  });
});

describe("revealVotesAsFacilitator", () => {
  it("succeeds when the RPC succeeds", async () => {
    rpcResult = { error: null };

    const result = await revealVotesAsFacilitator("session-1", "token-1");

    expect(result).toEqual({ success: true, data: null });
    expect(rpcMock).toHaveBeenCalledWith("reveal_votes_as_facilitator", {
      p_session_id: "session-1",
      p_facilitator_token: "token-1",
    });
  });

  it("rejects an invalid facilitator token (FT001)", async () => {
    rpcResult = { error: { code: "FT001", message: "invalid facilitator token" } };

    const result = await revealVotesAsFacilitator("session-1", "bad-token");

    expect(result).toEqual({
      success: false,
      error: "Lien de pilotage invalide.",
    });
  });

  it("returns a generic error for any other RPC failure", async () => {
    rpcResult = { error: { code: "42501", message: "unexpected" } };

    const result = await revealVotesAsFacilitator("session-1", "token-1");

    expect(result).toEqual({
      success: false,
      error: "Impossible de révéler les votes.",
    });
  });

  it("rejects when the session is already closed (FT004)", async () => {
    rpcResult = { error: { code: "FT004", message: "session is closed" } };

    const result = await revealVotesAsFacilitator("session-1", "token-1");

    expect(result).toEqual({
      success: false,
      error: "Cette session est clôturée.",
    });
  });
});

describe("goToNextCardAsFacilitator", () => {
  it("returns the next card id when the RPC succeeds", async () => {
    rpcResult = { data: "card-2", error: null };

    const result = await goToNextCardAsFacilitator("session-1", "token-1");

    expect(result).toEqual({ success: true, data: { cardId: "card-2" } });
    expect(rpcMock).toHaveBeenCalledWith("go_to_next_card_as_facilitator", {
      p_session_id: "session-1",
      p_facilitator_token: "token-1",
    });
  });

  it("returns no-more-cards when the RPC returns null", async () => {
    rpcResult = { data: null, error: null };

    const result = await goToNextCardAsFacilitator("session-1", "token-1");

    expect(result).toEqual({
      success: false,
      error: "C'était la dernière carte du deck.",
      code: "no-more-cards",
    });
  });

  it("rejects an invalid facilitator token (FT001)", async () => {
    rpcResult = { error: { code: "FT001", message: "invalid facilitator token" } };

    const result = await goToNextCardAsFacilitator("session-1", "bad-token");

    expect(result).toEqual({
      success: false,
      error: "Lien de pilotage invalide.",
    });
  });

  it("rejects when votes haven't been revealed yet (FT002)", async () => {
    rpcResult = { error: { code: "FT002", message: "votes not revealed" } };

    const result = await goToNextCardAsFacilitator("session-1", "token-1");

    expect(result).toEqual({
      success: false,
      error: "Révèle les votes avant de passer à la carte suivante.",
    });
  });

  it("rejects when the session has no active card (FT003)", async () => {
    rpcResult = { error: { code: "FT003", message: "no active card" } };

    const result = await goToNextCardAsFacilitator("session-1", "token-1");

    expect(result).toEqual({
      success: false,
      error: "Aucune carte active pour cette session.",
    });
  });

  it("rejects when the session is already closed (FT004)", async () => {
    rpcResult = { error: { code: "FT004", message: "session is closed" } };

    const result = await goToNextCardAsFacilitator("session-1", "token-1");

    expect(result).toEqual({
      success: false,
      error: "Cette session est clôturée.",
    });
  });

  it("rejects when no consensus value has been set for the current card (FT005)", async () => {
    rpcResult = { error: { code: "FT005", message: "card consensus value not set" } };

    const result = await goToNextCardAsFacilitator("session-1", "token-1");

    expect(result).toEqual({
      success: false,
      error: "Saisis la valeur d'accord d'équipe avant de passer à la carte suivante.",
    });
  });

  it("returns a generic error for any other RPC failure", async () => {
    rpcResult = { error: { code: "42501", message: "unexpected" } };

    const result = await goToNextCardAsFacilitator("session-1", "token-1");

    expect(result).toEqual({
      success: false,
      error: "Impossible de passer à la carte suivante.",
    });
  });
});

describe("startSessionAsFacilitator", () => {
  it("returns the first card id when the RPC succeeds", async () => {
    rpcResult = { data: "card-1", error: null };

    const result = await startSessionAsFacilitator("session-1", "token-1");

    expect(result).toEqual({ success: true, data: { cardId: "card-1" } });
    expect(rpcMock).toHaveBeenCalledWith("start_session_as_facilitator", {
      p_session_id: "session-1",
      p_facilitator_token: "token-1",
    });
  });

  it("rejects an invalid facilitator token (FT001)", async () => {
    rpcResult = { error: { code: "FT001", message: "invalid facilitator token" } };

    const result = await startSessionAsFacilitator("session-1", "bad-token");

    expect(result).toEqual({
      success: false,
      error: "Lien de pilotage invalide.",
    });
  });

  it("rejects when the session is already closed (FT004)", async () => {
    rpcResult = { error: { code: "FT004", message: "session is closed" } };

    const result = await startSessionAsFacilitator("session-1", "token-1");

    expect(result).toEqual({
      success: false,
      error: "Cette session est clôturée.",
    });
  });

  it("rejects when the session has already started (FT007)", async () => {
    rpcResult = { error: { code: "FT007", message: "session already started" } };

    const result = await startSessionAsFacilitator("session-1", "token-1");

    expect(result).toEqual({
      success: false,
      error: "L'atelier a déjà démarré.",
    });
  });

  it("rejects when the deck has no cards (FT008)", async () => {
    rpcResult = { error: { code: "FT008", message: "deck has no cards" } };

    const result = await startSessionAsFacilitator("session-1", "token-1");

    expect(result).toEqual({
      success: false,
      error: "Ce deck n'a aucune carte.",
    });
  });

  it("returns a generic error for any other RPC failure", async () => {
    rpcResult = { error: { code: "42501", message: "unexpected" } };

    const result = await startSessionAsFacilitator("session-1", "token-1");

    expect(result).toEqual({
      success: false,
      error: "Impossible de démarrer l'atelier.",
    });
  });
});

describe("closeSessionAsFacilitator", () => {
  it("succeeds when the RPC succeeds", async () => {
    rpcResult = { error: null };

    const result = await closeSessionAsFacilitator("session-1", "token-1");

    expect(result).toEqual({ success: true, data: null });
    expect(rpcMock).toHaveBeenCalledWith("close_session_as_facilitator", {
      p_session_id: "session-1",
      p_facilitator_token: "token-1",
      p_ai_synthesis: null,
    });
  });

  it("calls getSessionSynthesisAsFacilitator/generateAiSynthesis and passes the result to the RPC call", async () => {
    rpcResult = { error: null };
    const cards = [
      { cardId: "card-1", title: "Vision", theme: "Strategy", bullets: [], consensusValue: 3 },
    ];
    getSessionSynthesisAsFacilitatorMock.mockResolvedValue({
      cards,
      transcriptDraft: "Discussion...",
    });
    const aiResult = {
      generatedAt: "2026-08-24T10:00:00.000Z",
      cards: [{ cardId: "card-1", synthesis: "...", keywords: ["vision"] }],
      workshopProposals: [],
    };
    generateAiSynthesisMock.mockResolvedValue(aiResult);

    const result = await closeSessionAsFacilitator("session-1", "token-1");

    expect(result).toEqual({ success: true, data: null });
    expect(getSessionSynthesisAsFacilitatorMock).toHaveBeenCalledWith(
      "session-1",
      "token-1",
    );
    expect(generateAiSynthesisMock).toHaveBeenCalledWith(cards, "Discussion...");
    expect(rpcMock).toHaveBeenCalledWith("close_session_as_facilitator", {
      p_session_id: "session-1",
      p_facilitator_token: "token-1",
      p_ai_synthesis: aiResult,
    });
  });

  it("rejects an invalid facilitator token (FT001)", async () => {
    rpcResult = { error: { code: "FT001", message: "invalid facilitator token" } };

    const result = await closeSessionAsFacilitator("session-1", "bad-token");

    expect(result).toEqual({
      success: false,
      error: "Lien de pilotage invalide.",
    });
  });

  it("rejects when consensus is required before closing (FT009)", async () => {
    rpcResult = { error: { code: "FT009", message: "consensus required" } };

    const result = await closeSessionAsFacilitator("session-1", "token-1");

    expect(result).toEqual({
      success: false,
      error: "Saisis la valeur d'accord d'équipe avant de clôturer la session.",
    });
  });

  it("returns a generic error for any other RPC failure", async () => {
    rpcResult = { error: { code: "42501", message: "unexpected" } };

    const result = await closeSessionAsFacilitator("session-1", "token-1");

    expect(result).toEqual({
      success: false,
      error: "Impossible de clôturer la session.",
    });
  });
});

describe("setTranscriptionEnabled", () => {
  it("succeeds when the RPC succeeds", async () => {
    rpcResult = { error: null };

    const result = await setTranscriptionEnabled("session-1", "token-1", true);

    expect(result).toEqual({ success: true, data: null });
    expect(rpcMock).toHaveBeenCalledWith("set_transcription_enabled_as_facilitator", {
      p_session_id: "session-1",
      p_facilitator_token: "token-1",
      p_enabled: true,
    });
  });

  it("rejects an invalid facilitator token (FT001)", async () => {
    rpcResult = { error: { code: "FT001", message: "invalid facilitator token" } };

    const result = await setTranscriptionEnabled("session-1", "bad-token", true);

    expect(result).toEqual({
      success: false,
      error: "Lien de pilotage invalide.",
    });
  });

  it("rejects when the session has already started (FT010)", async () => {
    rpcResult = { error: { code: "FT010", message: "cannot change transcription after session started" } };

    const result = await setTranscriptionEnabled("session-1", "token-1", true);

    expect(result).toEqual({
      success: false,
      error: "L'atelier a déjà démarré.",
    });
  });

  it("rejects when the session is already closed (FT004)", async () => {
    rpcResult = { error: { code: "FT004", message: "session is closed" } };

    const result = await setTranscriptionEnabled("session-1", "token-1", true);

    expect(result).toEqual({
      success: false,
      error: "Cette session est clôturée.",
    });
  });

  it("returns a generic error for any other RPC failure", async () => {
    rpcResult = { error: { code: "42501", message: "unexpected" } };

    const result = await setTranscriptionEnabled("session-1", "token-1", true);

    expect(result).toEqual({
      success: false,
      error: "Impossible de modifier l'option de transcription.",
    });
  });
});

describe("syncTranscriptDraft", () => {
  it("succeeds when the RPC succeeds", async () => {
    rpcResult = { error: null };

    const result = await syncTranscriptDraft("session-1", "token-1", "Bonjour tout le monde.");

    expect(result).toEqual({ success: true, data: null });
    expect(rpcMock).toHaveBeenCalledWith("sync_transcript_draft_as_facilitator", {
      p_session_id: "session-1",
      p_facilitator_token: "token-1",
      p_text: "Bonjour tout le monde.",
    });
  });

  it("rejects an invalid facilitator token (FT001)", async () => {
    rpcResult = { error: { code: "FT001", message: "invalid facilitator token" } };

    const result = await syncTranscriptDraft("session-1", "bad-token", "texte");

    expect(result).toEqual({
      success: false,
      error: "Lien de pilotage invalide.",
    });
  });

  it("rejects when the session is already closed (FT004)", async () => {
    rpcResult = { error: { code: "FT004", message: "session is closed" } };

    const result = await syncTranscriptDraft("session-1", "token-1", "texte");

    expect(result).toEqual({
      success: false,
      error: "Cette session est clôturée.",
    });
  });

  it("returns a generic error for any other RPC failure", async () => {
    rpcResult = { error: { code: "42501", message: "unexpected" } };

    const result = await syncTranscriptDraft("session-1", "token-1", "texte");

    expect(result).toEqual({
      success: false,
      error: "Impossible de synchroniser la transcription.",
    });
  });
});

const CONSENSUS_SESSION_ID = "5b6c1e3e-8f2a-4b3e-9f0a-1234567890ab";
const CONSENSUS_CARD_ID = "6c7d2f4f-9a3b-4c4f-a01b-234567890abc";

describe("setCardConsensus", () => {
  it("rejects when the admin isn't authenticated", async () => {
    authResult = { data: null, error: { message: "no session" } };

    const result = await setCardConsensus({
      sessionId: CONSENSUS_SESSION_ID,
      cardId: CONSENSUS_CARD_ID,
      value: 5,
    });

    expect(result).toEqual({ success: false, error: "Session admin invalide." });
  });

  it("rejects an invalid value", async () => {
    const result = await setCardConsensus({
      sessionId: CONSENSUS_SESSION_ID,
      cardId: CONSENSUS_CARD_ID,
      value: 6,
    });

    expect(result).toEqual({ success: false, error: "Valeur d'accord invalide." });
  });

  it("rejects when the session doesn't belong to the admin", async () => {
    tableResultQueues.sessions = [{ data: null, error: null }];

    const result = await setCardConsensus({
      sessionId: CONSENSUS_SESSION_ID,
      cardId: CONSENSUS_CARD_ID,
      value: 5,
    });

    expect(result).toEqual({ success: false, error: "Session invalide." });
  });

  it("rejects when the session is closed", async () => {
    tableResultQueues.sessions = [
      { data: { id: CONSENSUS_SESSION_ID, status: "CLOTUREE" }, error: null },
    ];

    const result = await setCardConsensus({
      sessionId: CONSENSUS_SESSION_ID,
      cardId: CONSENSUS_CARD_ID,
      value: 5,
    });

    expect(result).toEqual({
      success: false,
      error: "Cette session est clôturée.",
    });
  });

  it("rejects when the card is no longer the session's current card", async () => {
    tableResultQueues.sessions = [
      {
        data: {
          id: CONSENSUS_SESSION_ID,
          status: "EN_COURS",
          current_card_id: "9c9c9c9c-9c9c-4c9c-9c9c-9c9c9c9c9c9c",
        },
        error: null,
      },
    ];

    const result = await setCardConsensus({
      sessionId: CONSENSUS_SESSION_ID,
      cardId: CONSENSUS_CARD_ID,
      value: 5,
    });

    expect(result).toEqual({
      success: false,
      error: "Cette carte n'est plus la carte active.",
    });
  });

  it("upserts the consensus value for the owning admin", async () => {
    tableResultQueues.sessions = [
      {
        data: {
          id: CONSENSUS_SESSION_ID,
          status: "EN_COURS",
          current_card_id: CONSENSUS_CARD_ID,
        },
        error: null,
      },
    ];
    tableResultQueues.card_consensus = [{ error: null }];

    const result = await setCardConsensus({
      sessionId: CONSENSUS_SESSION_ID,
      cardId: CONSENSUS_CARD_ID,
      value: 5,
    });

    expect(result).toEqual({ success: true, data: null });
  });

  it("surfaces an error if the upsert fails", async () => {
    tableResultQueues.sessions = [
      {
        data: {
          id: CONSENSUS_SESSION_ID,
          status: "EN_COURS",
          current_card_id: CONSENSUS_CARD_ID,
        },
        error: null,
      },
    ];
    tableResultQueues.card_consensus = [{ error: { message: "db error" } }];

    const result = await setCardConsensus({
      sessionId: CONSENSUS_SESSION_ID,
      cardId: CONSENSUS_CARD_ID,
      value: 5,
    });

    expect(result).toEqual({
      success: false,
      error: "Impossible d'enregistrer la valeur d'accord.",
    });
  });
});

describe("setCardConsensusAsFacilitator", () => {
  it("succeeds when the RPC succeeds", async () => {
    rpcResult = { error: null };

    const result = await setCardConsensusAsFacilitator(
      CONSENSUS_SESSION_ID,
      "token-1",
      CONSENSUS_CARD_ID,
      5,
    );

    expect(result).toEqual({ success: true, data: null });
    expect(rpcMock).toHaveBeenCalledWith("set_card_consensus_as_facilitator", {
      p_session_id: CONSENSUS_SESSION_ID,
      p_facilitator_token: "token-1",
      p_card_id: CONSENSUS_CARD_ID,
      p_value: 5,
    });
  });

  it("rejects an invalid value before calling the RPC", async () => {
    const result = await setCardConsensusAsFacilitator(
      CONSENSUS_SESSION_ID,
      "token-1",
      CONSENSUS_CARD_ID,
      6,
    );

    expect(result).toEqual({ success: false, error: "Valeur d'accord invalide." });
  });

  it("rejects an invalid facilitator token (FT001)", async () => {
    rpcResult = { error: { code: "FT001", message: "invalid facilitator token" } };

    const result = await setCardConsensusAsFacilitator(
      CONSENSUS_SESSION_ID,
      "bad-token",
      CONSENSUS_CARD_ID,
      5,
    );

    expect(result).toEqual({
      success: false,
      error: "Lien de pilotage invalide.",
    });
  });

  it("rejects when the session is already closed (FT004)", async () => {
    rpcResult = { error: { code: "FT004", message: "session is closed" } };

    const result = await setCardConsensusAsFacilitator(
      CONSENSUS_SESSION_ID,
      "token-1",
      CONSENSUS_CARD_ID,
      5,
    );

    expect(result).toEqual({
      success: false,
      error: "Cette session est clôturée.",
    });
  });

  it("rejects when the card is no longer the current card (FT006)", async () => {
    rpcResult = { error: { code: "FT006", message: "card is not the current card" } };

    const result = await setCardConsensusAsFacilitator(
      CONSENSUS_SESSION_ID,
      "token-1",
      CONSENSUS_CARD_ID,
      5,
    );

    expect(result).toEqual({
      success: false,
      error: "Cette carte n'est plus la carte active.",
    });
  });

  it("returns a generic error for any other RPC failure", async () => {
    rpcResult = { error: { code: "42501", message: "unexpected" } };

    const result = await setCardConsensusAsFacilitator(
      CONSENSUS_SESSION_ID,
      "token-1",
      CONSENSUS_CARD_ID,
      5,
    );

    expect(result).toEqual({
      success: false,
      error: "Impossible d'enregistrer la valeur d'accord.",
    });
  });
});

describe("getCardConsensus", () => {
  it("returns the consensus value when found", async () => {
    defaultResult = { data: { value: 4 }, error: null };

    const result = await getCardConsensus("session-1", "card-1");

    expect(result).toBe(4);
  });

  it("returns null when no consensus has been set", async () => {
    defaultResult = { data: null, error: null };

    const result = await getCardConsensus("session-1", "card-1");

    expect(result).toBeNull();
  });

  it("returns null on a Supabase error", async () => {
    defaultResult = { data: null, error: { message: "boom" } };

    const result = await getCardConsensus("session-1", "card-1");

    expect(result).toBeNull();
  });
});

describe("listActiveSessionsForAdmin", () => {
  it("returns EN_COURS sessions for the admin, most recent first", async () => {
    tableResultQueues.sessions = [
      {
        data: [
          {
            id: "session-2",
            team_name: "Beta",
            created_at: "2026-08-21T09:00:00.000Z",
          },
          {
            id: "session-1",
            team_name: "Alpha",
            created_at: "2026-08-20T10:00:00.000Z",
          },
        ],
        error: null,
      },
    ];

    const result = await listActiveSessionsForAdmin("admin-1");

    expect(result).toEqual([
      { id: "session-2", teamName: "Beta", createdAt: "2026-08-21T09:00:00.000Z" },
      { id: "session-1", teamName: "Alpha", createdAt: "2026-08-20T10:00:00.000Z" },
    ]);
  });

  it("returns an empty array when the admin has no EN_COURS session", async () => {
    tableResultQueues.sessions = [{ data: [], error: null }];

    const result = await listActiveSessionsForAdmin("admin-1");

    expect(result).toEqual([]);
  });

  it("returns an empty array on a Supabase error", async () => {
    tableResultQueues.sessions = [
      { data: null, error: { message: "boom" } },
    ];

    const result = await listActiveSessionsForAdmin("admin-1");

    expect(result).toEqual([]);
  });
});

describe("listCompletedSessionsForAdmin", () => {
  it("returns CLOTUREE sessions for the admin, most recent first", async () => {
    tableResultQueues.sessions = [
      {
        data: [
          {
            id: "session-2",
            team_name: "Beta",
            created_at: "2026-08-21T09:00:00.000Z",
          },
          {
            id: "session-1",
            team_name: "Alpha",
            created_at: "2026-08-20T10:00:00.000Z",
          },
        ],
        error: null,
      },
    ];

    const result = await listCompletedSessionsForAdmin("admin-1");

    expect(result).toEqual([
      { id: "session-2", teamName: "Beta", createdAt: "2026-08-21T09:00:00.000Z" },
      { id: "session-1", teamName: "Alpha", createdAt: "2026-08-20T10:00:00.000Z" },
    ]);
  });

  it("returns an empty array when the admin has no CLOTUREE session", async () => {
    tableResultQueues.sessions = [{ data: [], error: null }];

    const result = await listCompletedSessionsForAdmin("admin-1");

    expect(result).toEqual([]);
  });

  it("returns an empty array on a Supabase error", async () => {
    tableResultQueues.sessions = [{ data: null, error: { message: "boom" } }];

    const result = await listCompletedSessionsForAdmin("admin-1");

    expect(result).toEqual([]);
  });
});

describe("deleteSession", () => {
  it("rejects when the admin isn't authenticated", async () => {
    authResult = { data: null, error: { message: "no session" } };

    const result = await deleteSession("session-1");

    expect(result).toEqual({ success: false, error: "Session admin invalide." });
  });

  it("deletes a CLOTUREE session owned by the admin", async () => {
    tableResultQueues.sessions = [{ data: [{ id: "session-1" }], error: null }];

    const result = await deleteSession("session-1");

    expect(result).toEqual({ success: true, data: null });
    expect(queryCallLog).toContainEqual({ method: "eq", args: ["status", "CLOTUREE"] });
  });

  it("refuses when nothing matched (wrong admin, or still EN_COURS)", async () => {
    tableResultQueues.sessions = [{ data: [], error: null }];

    const result = await deleteSession("session-1");

    expect(result.success).toBe(false);
  });

  it("refuses on a Supabase error", async () => {
    tableResultQueues.sessions = [{ data: null, error: { message: "boom" } }];

    const result = await deleteSession("session-1");

    expect(result.success).toBe(false);
  });
});

describe("startSession", () => {
  it("rejects when the admin isn't authenticated", async () => {
    authResult = { data: null, error: { message: "no session" } };

    const result = await startSession("session-1");

    expect(result).toEqual({ success: false, error: "Session admin invalide." });
  });

  it("rejects when the session doesn't belong to the admin", async () => {
    tableResultQueues.sessions = [{ data: null, error: null }];

    const result = await startSession("session-1");

    expect(result).toEqual({ success: false, error: "Session invalide." });
  });

  it("rejects when the session is closed", async () => {
    tableResultQueues.sessions = [
      {
        data: { deck_id: "deck-1", current_card_id: null, status: "CLOTUREE" },
        error: null,
      },
    ];

    const result = await startSession("session-1");

    expect(result).toEqual({
      success: false,
      error: "Cette session est clôturée.",
    });
  });

  it("rejects when the workshop has already started", async () => {
    tableResultQueues.sessions = [
      {
        data: { deck_id: "deck-1", current_card_id: "card-1", status: "EN_COURS" },
        error: null,
      },
    ];

    const result = await startSession("session-1");

    expect(result).toEqual({
      success: false,
      error: "L'atelier a déjà démarré.",
    });
  });

  it("rejects when the deck has no cards", async () => {
    tableResultQueues.sessions = [
      {
        data: { deck_id: "deck-1", current_card_id: null, status: "EN_COURS" },
        error: null,
      },
    ];
    tableResultQueues.cards = [{ data: null, error: null }];

    const result = await startSession("session-1");

    expect(result).toEqual({
      success: false,
      error: "Ce deck n'a aucune carte.",
    });
  });

  it("activates the first card of the deck on both tables", async () => {
    tableResultQueues.sessions = [
      {
        data: { deck_id: "deck-1", current_card_id: null, status: "EN_COURS" },
        error: null,
      },
      { error: null }, // sessions update
    ];
    tableResultQueues.cards = [{ data: { id: "card-1" }, error: null }];
    tableResultQueues.session_live_state = [{ error: null }];

    const result = await startSession("session-1");

    expect(result).toEqual({ success: true, data: { cardId: "card-1" } });
  });

  it("fails cleanly when the sessions update fails", async () => {
    tableResultQueues.sessions = [
      {
        data: { deck_id: "deck-1", current_card_id: null, status: "EN_COURS" },
        error: null,
      },
      { error: { message: "db error" } },
    ];
    tableResultQueues.cards = [{ data: { id: "card-1" }, error: null }];

    const result = await startSession("session-1");

    expect(result).toEqual({
      success: false,
      error: "Impossible de démarrer l'atelier.",
    });
  });

  it("fails cleanly when the live_state update fails", async () => {
    tableResultQueues.sessions = [
      {
        data: { deck_id: "deck-1", current_card_id: null, status: "EN_COURS" },
        error: null,
      },
      { error: null },
    ];
    tableResultQueues.cards = [{ data: { id: "card-1" }, error: null }];
    tableResultQueues.session_live_state = [{ error: { message: "db error" } }];

    const result = await startSession("session-1");

    expect(result).toEqual({
      success: false,
      error: "Impossible de démarrer l'atelier.",
    });
  });
});
