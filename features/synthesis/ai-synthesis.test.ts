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

  // Ajouté le 2026-10-20 : Google renvoie des 503 "high demand" par
  // à-coups, une tentative unique rendait la synthèse quasi aléatoire.
  it("retries a transient 503 and succeeds on the next attempt", async () => {
    generateContentMock
      .mockRejectedValueOnce(
        Object.assign(new Error('{"error":{"code":503,"status":"UNAVAILABLE"}}'), {
          status: 503,
        }),
      )
      .mockResolvedValueOnce({ text: JSON.stringify(validResponse) });

    const result = await generateAiSynthesis(cards, "Discussion retranscrite ici.");

    expect(generateContentMock).toHaveBeenCalledTimes(2);
    expect(result?.cards[0]?.cardId).toBe("card-1");
  });

  // Le quota du palier gratuit est journalier : Google répond par un
  // RetryInfo de plusieurs heures. Réessayer ne peut pas aboutir et
  // consommerait le quota restant.
  it("does not retry a quota error", async () => {
    generateContentMock.mockRejectedValue(
      Object.assign(
        new Error(
          '{"error":{"code":429,"status":"RESOURCE_EXHAUSTED","message":"Quota exceeded, limit: 20"}}',
        ),
        { status: 429 },
      ),
    );

    const result = await generateAiSynthesis(cards, "Discussion retranscrite ici.");

    expect(result).toBeNull();
    expect(generateContentMock).toHaveBeenCalledTimes(1);
  });

  it("gives up after exhausting its retries on repeated transient failures", async () => {
    generateContentMock.mockRejectedValue(
      Object.assign(new Error('{"error":{"code":503,"status":"UNAVAILABLE"}}'), {
        status: 503,
      }),
    );

    const result = await generateAiSynthesis(cards, "Discussion retranscrite ici.");

    expect(result).toBeNull();
    expect(generateContentMock).toHaveBeenCalledTimes(3);
  });

  it("logs the token usage of a successful call", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    generateContentMock.mockResolvedValue({
      text: JSON.stringify(validResponse),
      usageMetadata: {
        promptTokenCount: 4888,
        candidatesTokenCount: 312,
        totalTokenCount: 5200,
      },
    });

    await generateAiSynthesis(cards, "Discussion retranscrite ici.");

    const logged = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).toContain("4888");
    expect(logged).toContain("5200");
    logSpy.mockRestore();
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
