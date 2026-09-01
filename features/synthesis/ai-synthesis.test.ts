import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const generateContentMock = vi.fn();

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(function (this: {
    models: { generateContent: typeof generateContentMock };
  }) {
    this.models = { generateContent: generateContentMock };
  }),
  Type: {
    OBJECT: "OBJECT",
    ARRAY: "ARRAY",
    STRING: "STRING",
  },
}));

import { generateAiSynthesis, parseStoredAiSynthesis } from "./ai-synthesis";

const cards = [
  {
    cardId: "card-1",
    title: "Vision produit",
    theme: "Strategy",
    bullets: ["Vision partagée", "Objectifs clairs"],
    consensusValue: 3,
  },
];

const validResponse = {
  cards: [
    {
      cardId: "card-1",
      synthesis: "L'équipe estime que la vision n'est pas partagée par tous.",
      keywords: ["vision", "alignement"],
    },
  ],
  workshopProposals: ["Atelier de clarification de la vision"],
};

describe("generateAiSynthesis", () => {
  const originalKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    generateContentMock.mockReset();
    process.env.GEMINI_API_KEY = "test-key";
  });

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalKey;
  });

  it("returns null without calling the SDK when there is no transcript", async () => {
    const result = await generateAiSynthesis(cards, null);

    expect(result).toBeNull();
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it("returns null without calling the SDK when the transcript is empty/blank", async () => {
    const result = await generateAiSynthesis(cards, "   ");

    expect(result).toBeNull();
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it("returns the per-card synthesis/keywords and workshop proposals when a transcript is provided", async () => {
    generateContentMock.mockResolvedValue({ text: JSON.stringify(validResponse) });

    const result = await generateAiSynthesis(cards, "Discussion retranscrite ici.");

    expect(result).not.toBeNull();
    expect(result?.cards).toEqual(validResponse.cards);
    expect(result?.workshopProposals).toEqual(validResponse.workshopProposals);
    expect(result?.generatedAt).toEqual(expect.any(String));
    // The transcript must actually reach the model.
    const [[call]] = generateContentMock.mock.calls;
    expect(JSON.stringify(call)).toContain("Discussion retranscrite ici.");
  });

  it("returns null when the SDK call throws", async () => {
    generateContentMock.mockRejectedValue(new Error("network error"));

    const result = await generateAiSynthesis(cards, "Discussion...");

    expect(result).toBeNull();
  });

  it("returns null when the response is not valid JSON", async () => {
    generateContentMock.mockResolvedValue({ text: "not json at all" });

    const result = await generateAiSynthesis(cards, "Discussion...");

    expect(result).toBeNull();
  });

  it("returns null when the response JSON doesn't match the expected shape", async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({ unexpected: "shape" }),
    });

    const result = await generateAiSynthesis(cards, "Discussion...");

    expect(result).toBeNull();
  });

  it("returns null when a card's keywords are not strings", async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({
        cards: [{ cardId: "card-1", synthesis: "...", keywords: [42] }],
        workshopProposals: ["Atelier"],
      }),
    });

    const result = await generateAiSynthesis(cards, "Discussion...");

    expect(result).toBeNull();
  });

  it("returns null when GEMINI_API_KEY is missing, even with a transcript", async () => {
    delete process.env.GEMINI_API_KEY;

    const result = await generateAiSynthesis(cards, "Discussion...");

    expect(result).toBeNull();
    expect(generateContentMock).not.toHaveBeenCalled();
  });
});

describe("parseStoredAiSynthesis", () => {
  it("returns a well-formed stored value as-is", () => {
    const stored = {
      generatedAt: "2026-08-24T10:00:00.000Z",
      cards: [{ cardId: "card-1", synthesis: "...", keywords: ["vision"] }],
      workshopProposals: ["Atelier"],
    };

    expect(parseStoredAiSynthesis(stored)).toEqual(stored);
  });

  it("returns null for a value stored under the previous schema (themes/qualitative)", () => {
    const staleShape = {
      generatedAt: "2026-08-24T10:00:00.000Z",
      cards: [{ cardId: "card-1", recommendation: "..." }],
      themes: [],
      qualitative: null,
    };

    expect(parseStoredAiSynthesis(staleShape)).toBeNull();
  });

  it("returns null for null/non-object values", () => {
    expect(parseStoredAiSynthesis(null)).toBeNull();
    expect(parseStoredAiSynthesis("not an object")).toBeNull();
  });
});
