import { z } from "zod";

export const createSessionSchema = z.object({
  teamName: z.string().trim().min(1, "Le nom d'équipe est requis."),
  durationMinutes: z.coerce
    .number()
    .int()
    .positive("La durée doit être un nombre de minutes positif."),
  deckId: z.string().uuid("Deck invalide."),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
