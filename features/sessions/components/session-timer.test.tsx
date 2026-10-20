import { render, screen, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionTimer } from "./session-timer";

// A session that started now and runs for 2 minutes.
const createdAt = "2026-01-01T10:00:00.000Z";
const startedAt = new Date(createdAt).getTime();

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
  vi.setSystemTime(startedAt);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("SessionTimer", () => {
  it("affiche le temps restant une fois monté, puis décompte", () => {
    render(<SessionTimer createdAt={createdAt} durationMinutes={2} />);

    expect(screen.getByText("2:00")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(screen.getByText("1:30")).toBeInTheDocument();
  });

  it("signale la fin et cesse de décompter une fois le temps écoulé", () => {
    render(<SessionTimer createdAt={createdAt} durationMinutes={1} />);

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByText(/0:00/)).toBeInTheDocument();
    expect(screen.getByText(/terminé/)).toBeInTheDocument();

    // L'intervalle doit s'être arrêté : plus aucun minuteur en attente.
    expect(vi.getTimerCount()).toBe(0);
  });
});
