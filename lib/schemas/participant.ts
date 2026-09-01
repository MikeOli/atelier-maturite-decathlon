import { z } from "zod";

export const joinSessionSchema = z.object({
  sessionId: z.string().uuid("Session invalide."),
  avatarKey: z.string().min(1, "Avatar invalide."),
  clientToken: z.string().uuid("Identifiant client invalide."),
});

export type JoinSessionInput = z.infer<typeof joinSessionSchema>;
