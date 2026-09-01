import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AvatarPicker } from "./avatar-picker";

const findParticipantByClientTokenMock = vi.fn();
const joinSessionMock = vi.fn();

vi.mock("@/features/participants/actions", () => ({
  findParticipantByClientToken: (...args: unknown[]) =>
    findParticipantByClientTokenMock(...args),
  joinSession: (...args: unknown[]) => joinSessionMock(...args),
}));

vi.mock("@/features/voting/components/vote-card", () => ({
  VoteCard: () => <div>vote-card</div>,
}));

const channelMock = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
  track: vi.fn(),
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: vi.fn(() => channelMock),
    removeChannel: vi.fn(),
  }),
}));

const sessionId = "11111111-1111-1111-1111-111111111111";

// jsdom in this project's vitest setup doesn't polyfill localStorage —
// AvatarPicker only needs getItem/setItem/removeItem, so a plain in-memory
// stub is enough for these tests.
function installLocalStorageStub() {
  let store: Record<string, string> = {};
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
    },
  });
}

describe("AvatarPicker — consentement à la transcription (Story 5.6)", () => {
  beforeEach(() => {
    findParticipantByClientTokenMock.mockReset();
    joinSessionMock.mockReset();
    installLocalStorageStub();
  });

  it("skips the consent banner and shows the avatar grid when transcription is disabled (AC#3)", async () => {
    findParticipantByClientTokenMock.mockResolvedValue(null);
    render(
      <AvatarPicker
        sessionId={sessionId}
        initialTakenKeys={[]}
        currentCard={null}
        initialVotesRevealed={false}
        transcriptionEnabled={false}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByText(/choisis ton avatar pour rejoindre la session/i),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText(/cette session est transcrite/i)).toBeNull();
  });

  it("shows the consent banner before the avatar grid when transcription is enabled (AC#1)", async () => {
    findParticipantByClientTokenMock.mockResolvedValue(null);
    render(
      <AvatarPicker
        sessionId={sessionId}
        initialTakenKeys={[]}
        currentCard={null}
        initialVotesRevealed={false}
        transcriptionEnabled={true}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByText(/cette session est transcrite/i),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByText(/choisis ton avatar pour rejoindre la session/i),
    ).toBeNull();
  });

  it("reveals the avatar grid after accepting the consent banner", async () => {
    findParticipantByClientTokenMock.mockResolvedValue(null);
    const user = userEvent.setup();
    render(
      <AvatarPicker
        sessionId={sessionId}
        initialTakenKeys={[]}
        currentCard={null}
        initialVotesRevealed={false}
        transcriptionEnabled={true}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /j'accepte/i }),
      ).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /j'accepte/i }));

    expect(
      screen.getByText(/choisis ton avatar pour rejoindre la session/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/cette session est transcrite/i)).toBeNull();
  });

  it("blocks joining and never shows the avatar grid after declining (AC#2)", async () => {
    findParticipantByClientTokenMock.mockResolvedValue(null);
    const user = userEvent.setup();
    render(
      <AvatarPicker
        sessionId={sessionId}
        initialTakenKeys={[]}
        currentCard={null}
        initialVotesRevealed={false}
        transcriptionEnabled={true}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /je refuse/i }),
      ).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /je refuse/i }));

    expect(screen.getByText(/tu as refusé la transcription/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/choisis ton avatar pour rejoindre la session/i),
    ).toBeNull();
    expect(joinSessionMock).not.toHaveBeenCalled();
  });

  it("never re-shows the banner to an already-restored participant, even with transcription enabled (AC#4)", async () => {
    localStorage.setItem(`atelier:participant:${sessionId}`, "stored-token");
    findParticipantByClientTokenMock.mockResolvedValue({
      id: "participant-1",
      avatarKey: "renard",
      avatarLabel: "Renard",
    });

    render(
      <AvatarPicker
        sessionId={sessionId}
        initialTakenKeys={[]}
        currentCard={null}
        initialVotesRevealed={false}
        transcriptionEnabled={true}
      />,
    );

    await waitFor(() => expect(screen.getByText("vote-card")).toBeInTheDocument());
    expect(screen.queryByText(/cette session est transcrite/i)).toBeNull();
  });
});
