import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignUpForm } from "./sign-up-form";

const signUpMock = vi.fn();
const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signUp: signUpMock } }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

async function fillAndSubmit(email: string, password = "motdepasse123") {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/adresse e-mail/i), email);
  await user.type(screen.getByLabelText(/^mot de passe$/i), password);
  await user.type(screen.getByLabelText(/confirmer le mot de passe/i), password);
  await user.click(screen.getByRole("button", { name: /créer mon compte/i }));
}

beforeEach(() => {
  signUpMock.mockReset();
  pushMock.mockReset();
  refreshMock.mockReset();
});

describe("SignUpForm", () => {
  it("entre directement dans l'espace animateur quand une session est renvoyée", async () => {
    signUpMock.mockResolvedValue({
      data: { session: { access_token: "jeton" } },
      error: null,
    });
    render(<SignUpForm />);

    await fillAndSubmit("prenom.nom@decathlon.com");

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/admin"));
    expect(refreshMock).toHaveBeenCalled();
  });

  // Repli : si la confirmation par mail était réactivée côté Supabase,
  // signUp ne renvoie pas de session.
  it("affiche l'écran de validation quand aucune session n'est renvoyée", async () => {
    signUpMock.mockResolvedValue({ data: { session: null }, error: null });
    render(<SignUpForm />);

    await fillAndSubmit("prenom.nom@decathlon.com");

    expect(await screen.findByText(/vérifiez vos mails/i)).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("refuse une adresse hors du domaine autorisé sans appeler Supabase", async () => {
    render(<SignUpForm />);

    await fillAndSubmit("quelquun@gmail.com");

    expect(
      await screen.findByText(/seules les adresses @decathlon\.com/i),
    ).toBeInTheDocument();
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("refuse deux mots de passe différents", async () => {
    const user = userEvent.setup();
    render(<SignUpForm />);

    await user.type(screen.getByLabelText(/adresse e-mail/i), "a.b@decathlon.com");
    await user.type(screen.getByLabelText(/^mot de passe$/i), "motdepasse123");
    await user.type(screen.getByLabelText(/confirmer le mot de passe/i), "autrechose123");
    await user.click(screen.getByRole("button", { name: /créer mon compte/i }));

    expect(await screen.findByText(/ne correspondent pas/i)).toBeInTheDocument();
    expect(signUpMock).not.toHaveBeenCalled();
  });
})
