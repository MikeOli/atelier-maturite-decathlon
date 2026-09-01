import { z } from "zod";

export const createDeckSchema = z.object({
  name: z.string().trim().min(1, "Le nom du deck est requis."),
  description: z
    .string()
    .trim()
    .max(500, "La description est trop longue.")
    .optional()
    .default(""),
});

export type CreateDeckInput = z.infer<typeof createDeckSchema>;

export const updateDeckSchema = z.object({
  deckId: z.string().uuid("Deck invalide."),
  name: z.string().trim().min(1, "Le nom du deck est requis."),
  description: z
    .string()
    .trim()
    .max(500, "La description est trop longue.")
    .optional()
    .default(""),
});

export type UpdateDeckInput = z.infer<typeof updateDeckSchema>;
