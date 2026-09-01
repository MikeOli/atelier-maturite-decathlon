import { describe, expect, it, vi } from "vitest";
import {
  submitVote,
  getMyVote,
  getRevealedVotes,
  getVotedParticipants,
} from "./actions";

type RpcResult = {
  data?: unknown;
  error: { code?: string; message: string } | null;
};
type QueryResult = { data: unknown; error: unknown };

let rpcResult: RpcResult = { error: null };
const rpcMock = vi.fn(() => Promise.resolve(rpcResult));

let votesQueryResult: QueryResult = { data: [], error: null };
function createBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = vi.fn(chain);
  builder.eq = vi.fn(chain);
  builder.then = (resolve: (value: QueryResult) => void) =>
    Promise.resolve(result).then(resolve);
  return builder;
}
const fromMock = vi.fn(() => createBuilder(votesQueryResult));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ rpc: rpcMock, from: fromMock }),
}));

const validInput = {
  sessionId: "5b6c1e3e-8f2a-4b3e-9f0a-1234567890ab",
  cardId: "6b6c1e3e-8f2a-4b3e-9f0a-1234567890ab",
  participantId: "7c6c1e3e-8f2a-4b3e-9f0a-1234567890ab",
  clientToken: "1a046690-3930-41f2-b5ec-2c65ff365135",
  value: 4,
};

describe("submitVote", () => {
  it("records the vote when the RPC succeeds", async () => {
    rpcResult = { error: null };

    const result = await submitVote(validInput);

    expect(result).toEqual({ success: true, data: null });
    expect(rpcMock).toHaveBeenCalledWith("submit_vote", {
      p_session_id: validInput.sessionId,
      p_card_id: validInput.cardId,
      p_participant_id: validInput.participantId,
      p_client_token: validInput.clientToken,
      p_value: validInput.value,
    });
  });

  it("rejects when the participant/client_token pair doesn't match (VT001)", async () => {
    rpcResult = { error: { code: "VT001", message: "invalid participant" } };

    const result = await submitVote(validInput);

    expect(result).toEqual({ success: false, error: "Participant invalide." });
  });

  it("returns a clear error when voting is closed for this card (VT002)", async () => {
    rpcResult = {
      error: { code: "VT002", message: "voting closed for this card" },
    };

    const result = await submitVote(validInput);

    expect(result).toEqual({
      success: false,
      error: "Le vote n'est plus ouvert pour cette carte.",
    });
  });

  it("returns a clear error when the RPC itself rejects the value (VT003)", async () => {
    rpcResult = { error: { code: "VT003", message: "invalid vote value" } };

    const result = await submitVote(validInput);

    expect(result).toEqual({ success: false, error: "Valeur de vote invalide." });
  });

  it("returns a clear error when the session is closed (VT004)", async () => {
    rpcResult = { error: { code: "VT004", message: "session is closed" } };

    const result = await submitVote(validInput);

    expect(result).toEqual({
      success: false,
      error: "Cette session est clôturée.",
    });
  });

  it("rejects a value outside the Fibonacci scale before calling the RPC", async () => {
    const result = await submitVote({ ...validInput, value: 4 });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid payload", async () => {
    const result = await submitVote({ sessionId: "not-a-uuid" });

    expect(result.success).toBe(false);
  });

  it("returns a generic error for any other RPC failure", async () => {
    rpcResult = { error: { code: "42501", message: "unexpected" } };

    const result = await submitVote(validInput);

    expect(result).toEqual({
      success: false,
      error: "Impossible d'enregistrer le vote.",
    });
  });
});

describe("getMyVote", () => {
  const myVoteInput = {
    sessionId: validInput.sessionId,
    cardId: validInput.cardId,
    participantId: validInput.participantId,
    clientToken: validInput.clientToken,
  };

  it("returns the vote value when the RPC succeeds", async () => {
    rpcResult = { data: 8, error: null };

    const result = await getMyVote(myVoteInput);

    expect(result).toBe(8);
    expect(rpcMock).toHaveBeenCalledWith("get_my_vote", {
      p_session_id: myVoteInput.sessionId,
      p_card_id: myVoteInput.cardId,
      p_participant_id: myVoteInput.participantId,
      p_client_token: myVoteInput.clientToken,
    });
  });

  it("returns null when no vote has been submitted yet", async () => {
    rpcResult = { data: null, error: null };

    const result = await getMyVote(myVoteInput);

    expect(result).toBeNull();
  });

  it("returns null when the RPC fails", async () => {
    rpcResult = { error: { code: "VT001", message: "invalid participant" } };

    const result = await getMyVote(myVoteInput);

    expect(result).toBeNull();
  });

  it("returns null for an invalid payload without calling the RPC", async () => {
    rpcMock.mockClear();

    const result = await getMyVote({ sessionId: "not-a-uuid" });

    expect(result).toBeNull();
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe("getRevealedVotes", () => {
  it("maps joined participant/avatar data to the revealed vote list", async () => {
    votesQueryResult = {
      data: [
        {
          value: 4,
          participants: { avatar_key: "licorne-fluo", avatar_label: "Licorne Fluo" },
        },
        {
          value: 3,
          participants: { avatar_key: "poulpe-disco", avatar_label: "Poulpe Disco" },
        },
      ],
      error: null,
    };

    const result = await getRevealedVotes("session-1", "card-1");

    expect(result).toEqual([
      { avatarKey: "licorne-fluo", avatarLabel: "Licorne Fluo", value: 4 },
      { avatarKey: "poulpe-disco", avatarLabel: "Poulpe Disco", value: 3 },
    ]);
  });

  it("skips rows with no joined participant", async () => {
    votesQueryResult = {
      data: [{ value: 5, participants: null }],
      error: null,
    };

    const result = await getRevealedVotes("session-1", "card-1");

    expect(result).toEqual([]);
  });

  it("returns an empty list before reveal (RLS blocks the read)", async () => {
    votesQueryResult = { data: null, error: { message: "permission denied" } };

    const result = await getRevealedVotes("session-1", "card-1");

    expect(result).toEqual([]);
  });
});

describe("getVotedParticipants", () => {
  it("returns avatar-only entries for participants who voted", async () => {
    rpcResult = {
      data: [
        { avatar_key: "licorne-fluo", avatar_label: "Licorne Fluo" },
        { avatar_key: "poulpe-disco", avatar_label: "Poulpe Disco" },
      ],
      error: null,
    };

    const result = await getVotedParticipants("session-1", "card-1");

    expect(result).toEqual([
      { avatarKey: "licorne-fluo", avatarLabel: "Licorne Fluo" },
      { avatarKey: "poulpe-disco", avatarLabel: "Poulpe Disco" },
    ]);
    expect(rpcMock).toHaveBeenCalledWith("get_voters_for_card", {
      p_session_id: "session-1",
      p_card_id: "card-1",
    });
  });

  it("never includes a vote value, even if the RPC somehow returned one", async () => {
    rpcResult = {
      data: [
        {
          avatar_key: "licorne-fluo",
          avatar_label: "Licorne Fluo",
          value: 4,
        },
      ],
      error: null,
    };

    const result = await getVotedParticipants("session-1", "card-1");

    expect(result).toEqual([
      { avatarKey: "licorne-fluo", avatarLabel: "Licorne Fluo" },
    ]);
    expect(result[0]).not.toHaveProperty("value");
  });

  it("returns an empty list on any RPC error", async () => {
    rpcResult = { error: { message: "unexpected" } };

    const result = await getVotedParticipants("session-1", "card-1");

    expect(result).toEqual([]);
  });
});
