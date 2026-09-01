import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./login-form";

const pushMock = vi.fn();
const refreshMock = vi.fn();
const signInWithPasswordMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signInWithPassword: signInWithPasswordMock },
  }),
}));

describe("LoginForm", () => {
  beforeEach(() => {
    pushMock.mockClear();
    refreshMock.mockClear();
    signInWithPasswordMock.mockReset();
  });

  it("redirects to /admin on successful login", async () => {
    signInWithPasswordMock.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), "admin@example.com");
    await user.type(screen.getByLabelText(/password/i), "correct-password");
    await user.click(screen.getByRole("button", { name: /login/i }));

    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: "admin@example.com",
      password: "correct-password",
    });
    expect(pushMock).toHaveBeenCalledWith("/admin");
  });

  it("shows a generic error on invalid credentials without naming the field", async () => {
    signInWithPasswordMock.mockResolvedValue({
      error: new Error("Invalid login credentials"),
    });
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), "admin@example.com");
    await user.type(screen.getByLabelText(/password/i), "wrong-password");
    await user.click(screen.getByRole("button", { name: /login/i }));

    const message = await screen.findByText(/invalid login credentials/i);
    expect(message).toBeInTheDocument();
    expect(message.textContent?.toLowerCase()).not.toMatch(/email|password/);
    expect(pushMock).not.toHaveBeenCalled();
  });
});
