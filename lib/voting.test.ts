import { describe, expect, it } from "vitest";
import { getVoteExtremes } from "./voting";

describe("getVoteExtremes", () => {
  it("returns null for an empty list", () => {
    expect(getVoteExtremes([])).toBeNull();
  });

  it("returns null for a single value", () => {
    expect(getVoteExtremes([5])).toBeNull();
  });

  it("returns null when every value is identical", () => {
    expect(getVoteExtremes([8, 8, 8])).toBeNull();
  });

  it("returns the min/max when values differ", () => {
    expect(getVoteExtremes([3, 8, 5])).toEqual({ max: 8, min: 3 });
  });

  it("handles multiple participants tied on the max and/or min", () => {
    expect(getVoteExtremes([2, 2, 13, 13, 5])).toEqual({ max: 13, min: 2 });
  });
});
