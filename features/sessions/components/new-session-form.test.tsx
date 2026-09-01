import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NewSessionForm } from "./new-session-form";

const pushMock = vi.fn();
const refreshMock = vi.fn();
const createSessionMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

vi.mock("@/features/sessions/actions", () => ({
  createSession: (formData: FormData) => createSessionMock(formData),
}));

const decks = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Maturité Produit",
    description: "",
    cardCount: 16,
    createdAt: "",
  },
];

describe("NewSessionForm", () => {
  beforeEach(() => {
    pushMock.mockClear();
    refreshMock.mockClear();
    createSessionMock.mockReset();
  });

  it("requires team name and duration before submitting", () => {
    render(<NewSessionForm decks={decks} />);
    expect(screen.getByLabelText(/nom d'équipe/i)).toBeRequired();
    expect(screen.getByLabelText(/durée/i)).toBeRequired();
  });

  it("submits the form and redirects to the created session on success", async () => {
    createSessionMock.mockResolvedValue({
      success: true,
      data: { id: "session-123" },
    });
    const user = userEvent.setup();
    render(<NewSessionForm decks={decks} />);

    await user.type(screen.getByLabelText(/nom d'équipe/i), "Équipe Alpha");
    await user.click(screen.getByRole("button", { name: /créer la session/i }));

    expect(createSessionMock).toHaveBeenCalled();
    expect(pushMock).toHaveBeenCalledWith("/admin/sessions/session-123");
  });

  it("shows the error returned by the server action without redirecting", async () => {
    createSessionMock.mockResolvedValue({
      success: false,
      error: "Impossible de créer la session.",
    });
    const user = userEvent.setup();
    render(<NewSessionForm decks={decks} />);

    await user.type(screen.getByLabelText(/nom d'équipe/i), "Équipe Alpha");
    await user.click(screen.getByRole("button", { name: /créer la session/i }));

    expect(
      await screen.findByText("Impossible de créer la session."),
    ).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
