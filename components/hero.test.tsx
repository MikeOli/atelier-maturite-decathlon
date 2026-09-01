import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Hero } from "./hero";

describe("Hero", () => {
  it("renders the starter tagline", () => {
    render(<Hero />);
    expect(
      screen.getByRole("heading", {
        name: /Supabase and Next\.js Starter Template/i,
      }),
    ).toBeInTheDocument();
  });
});
