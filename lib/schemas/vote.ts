import { z } from "zod";
import { MATURITY_VALUES } from "@/lib/voting";

export const submitVoteSchema = z.object({
  sessionId: z.string().uuid("Session invalide."),
  cardId: z.string().uuid("Carte invalide."),
  participantId: z.string().uuid("Participant invalide."),
  clientToken: z.string().uuid("Identifiant client invalide."),
  value: z
    .number()
    .refine(
      (v): v is (typeof MATURITY_VALUES)[number] =>
        (MATURITY_VALUES as readonly number[]).includes(v),
      "Valeur de vote invalide.",
    ),
});

export type SubmitVoteInput = z.infer<typeof submitVoteSchema>;

export const getMyVoteSchema = z.object({
  sessionId: z.string().uuid("Session invalide."),
  cardId: z.string().uuid("Carte invalide."),
  participantId: z.string().uuid("Participant invalide."),
  clientToken: z.string().uuid("Identifiant client invalide."),
});

export type GetMyVoteInput = z.infer<typeof getMyVoteSchema>;
