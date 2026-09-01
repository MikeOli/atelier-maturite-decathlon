import { describe, expect, it } from "vitest";
import { remainingMs, formatRemaining } from "./timer";

describe("remainingMs", () => {
  it("returns the full duration when now equals createdAt", () => {
    const createdAt = "2026-08-20T10:00:00.000Z";
    const now = new Date(createdAt).getTime();

    expect(remainingMs(createdAt, 60, now)).toBe(60 * 60_000);
  });

  it("decreases as time elapses", () => {
    const createdAt = "2026-08-20T10:00:00.000Z";
    const now = new Date(createdAt).getTime() + 5 * 60_000;

    expect(remainingMs(createdAt, 60, now)).toBe(55 * 60_000);
  });

  it("clamps to zero once the duration has elapsed", () => {
    const createdAt = "2026-08-20T10:00:00.000Z";
    const now = new Date(createdAt).getTime() + 90 * 60_000;

    expect(remainingMs(createdAt, 60, now)).toBe(0);
  });

  it("clamps to zero well past the deadline, never negative", () => {
    const createdAt = "2026-08-20T10:00:00.000Z";
    const now = new Date(createdAt).getTime() + 24 * 60 * 60_000;

    expect(remainingMs(createdAt, 60, now)).toBe(0);
  });

  // FR34 / Story 4.4: a session never auto-expires, so nothing downstream
  // may treat "very negative" elapsed time as a closure signal. Confirms
  // the clamp holds arbitrarily far past the deadline (months, not hours).
  it("clamps to zero months past the deadline, never negative", () => {
    const createdAt = "2026-08-20T10:00:00.000Z";
    const now = new Date(createdAt).getTime() + 90 * 24 * 60 * 60_000;

    expect(remainingMs(createdAt, 60, now)).toBe(0);
  });
});

describe("formatRemaining", () => {
  it("formats zero as 0:00", () => {
    expect(formatRemaining(0)).toBe("0:00");
  });

  it("formats sub-minute durations", () => {
    expect(formatRemaining(59_000)).toBe("0:59");
  });

  it("formats exactly one minute", () => {
    expect(formatRemaining(60_000)).toBe("1:00");
  });

  it("formats durations under an hour", () => {
    expect(formatRemaining(3599_000)).toBe("59:59");
  });

  it("rounds down to the nearest second", () => {
    expect(formatRemaining(1_999)).toBe("0:01");
  });

  it("formats exactly one hour", () => {
    expect(formatRemaining(3600_000)).toBe("1:00:00");
  });

  it("formats durations over an hour with zero-padded minutes/seconds", () => {
    expect(formatRemaining((90 * 60 + 5) * 1000)).toBe("1:30:05");
  });

  it("formats multi-hour durations", () => {
    expect(formatRemaining((125 * 60) * 1000)).toBe("2:05:00");
  });
});
