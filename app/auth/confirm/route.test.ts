import { describe, expect, it, vi, beforeEach } from "vitest";

const exchangeCodeForSessionMock = vi.fn();
const verifyOtpMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      exchangeCodeForSession: exchangeCodeForSessionMock,
      verifyOtp: verifyOtpMock,
    },
  }),
}));

// redirect() interrompt l'exécution en levant : on reproduit ce contrat
// pour pouvoir affirmer la destination.
class RedirectError extends Error {
  constructor(readonly target: string) {
    super(`redirect:${target}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: (target: string) => {
    throw new RedirectError(target);
  },
}));

import { GET } from "./route";

function call(query: string) {
  return GET(new Request(`https://exemple.test/auth/confirm${query}`) as never);
}

async function redirectTargetOf(query: string): Promise<string> {
  try {
    await call(query);
  } catch (error) {
    if (error instanceof RedirectError) return error.target;
    throw error;
  }
  throw new Error("aucune redirection");
}

beforeEach(() => {
  exchangeCodeForSessionMock.mockReset();
  verifyOtpMock.mockReset();
});

describe("GET /auth/confirm", () => {
  // Forme produite par le modèle de mail PAR DÉFAUT, la seule que le projet
  // puisse recevoir tant qu'il n'a pas de SMTP personnalisé.
  it("échange le code d'autorisation puis redirige vers next", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ error: null });

    const target = await redirectTargetOf("?code=abc123&next=/admin");

    expect(exchangeCodeForSessionMock).toHaveBeenCalledWith("abc123");
    expect(verifyOtpMock).not.toHaveBeenCalled();
    expect(target).toBe("/admin");
  });

  // Forme produite par un modèle personnalisé : doit continuer de marcher.
  it("vérifie le token_hash puis redirige vers next", async () => {
    verifyOtpMock.mockResolvedValue({ error: null });

    const target = await redirectTargetOf("?token_hash=xyz&type=email&next=/admin");

    expect(verifyOtpMock).toHaveBeenCalledWith({ type: "email", token_hash: "xyz" });
    expect(exchangeCodeForSessionMock).not.toHaveBeenCalled();
    expect(target).toBe("/admin");
  });

  it("renvoie vers la page d'erreur quand l'échange échoue", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({
      error: { message: "Code expiré" },
    });

    const target = await redirectTargetOf("?code=abc123&next=/admin");

    expect(target).toBe("/auth/error?error=Code%20expir%C3%A9");
  });

  // Cas réellement rencontré le 2026-10-21 : l'utilisateur voyait
  // « lien incomplet ou expiré » alors que Supabase disait précisément
  // pourquoi, dans l'URL.
  it("affiche la raison quand Supabase refuse le lien", async () => {
    const target = await redirectTargetOf(
      "?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&next=/admin",
    );

    expect(decodeURIComponent(target)).toContain("expiré ou a déjà été utilisé");
    expect(exchangeCodeForSessionMock).not.toHaveBeenCalled();
  });

  it("reprend la description de Supabase pour un refus non répertorié", async () => {
    const target = await redirectTargetOf(
      "?error=server_error&error_code=inattendu&error_description=Quelque+chose+a+casse",
    );

    expect(decodeURIComponent(target)).toContain("Quelque chose a casse");
  });

  it("renvoie vers la page d'erreur quand le lien ne porte aucun jeton", async () => {
    const target = await redirectTargetOf("?next=/admin");

    expect(target).toContain("/auth/error?error=");
    expect(exchangeCodeForSessionMock).not.toHaveBeenCalled();
    expect(verifyOtpMock).not.toHaveBeenCalled();
  });

  it("retombe sur la racine quand next est absent", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ error: null });

    expect(await redirectTargetOf("?code=abc123")).toBe("/");
  });
});
