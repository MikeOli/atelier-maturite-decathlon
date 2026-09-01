import { z } from "zod";

export const createCardSchema = z.object({
  deckId: z.string().uuid("Deck invalide."),
  theme: z.string().trim().min(1, "Le thème est requis."),
  title: z.string().trim().min(1, "Le titre est requis."),
  bullets: z
    .string()
    .transform((raw) =>
      raw
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0),
    )
    .pipe(z.array(z.string()).min(1, "Au moins un critère est requis.")),
});

export type CreateCardInput = z.infer<typeof createCardSchema>;

export const updateCardSchema = z.object({
  cardId: z.string().uuid("Carte invalide."),
  theme: z.string().trim().min(1, "Le thème est requis."),
  title: z.string().trim().min(1, "Le titre est requis."),
  bullets: z
    .string()
    .transform((raw) =>
      raw
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0),
    )
    .pipe(z.array(z.string()).min(1, "Au moins un critère est requis.")),
});

export type UpdateCardInput = z.infer<typeof updateCardSchema>;

export const reorderCardsSchema = z.object({
  deckId: z.string().uuid("Deck invalide."),
  cardIds: z
    .array(z.string().uuid("Carte invalide."))
    .min(1)
    .max(200, "Liste de cartes invalide.")
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "Liste de cartes invalide.",
    }),
});

export type ReorderCardsInput = z.infer<typeof reorderCardsSchema>;
