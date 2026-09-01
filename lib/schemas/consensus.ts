import { z } from "zod";
import { MATURITY_VALUES } from "@/lib/voting";

export const setCardConsensusSchema = z.object({
  sessionId: z.string().uuid("Session invalide."),
  cardId: z.string().uuid("Carte invalide."),
  value: z
    .number()
    .refine(
      (v): v is (typeof MATURITY_VALUES)[number] =>
        (MATURITY_VALUES as readonly number[]).includes(v),
      "Valeur d'accord invalide.",
    ),
});

export type SetCardConsensusInput = z.infer<typeof setCardConsensusSchema>;
