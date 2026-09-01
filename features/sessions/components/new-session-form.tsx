"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSession } from "@/features/sessions/actions";
import type { DeckWithCardCount } from "@/features/decks/actions";

export function NewSessionForm({ decks }: { decks: DeckWithCardCount[] }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (decks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Tu n&apos;as pas encore de deck. Crée-en un depuis{" "}
        <a href="/admin?tab=decks" className="underline">
          Mes decks
        </a>{" "}
        avant de lancer une session.
      </p>
    );
  }

  const handleSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await createSession(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
      router.push(`/admin/sessions/${result.data.id}`);
    });
  };

  return (
    <form action={handleSubmit} className="flex flex-col gap-6 max-w-sm">
      <div className="grid gap-2">
        <Label htmlFor="teamName">Nom d&apos;équipe</Label>
        <Input id="teamName" name="teamName" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="durationMinutes">Durée (minutes)</Label>
        <Input
          id="durationMinutes"
          name="durationMinutes"
          type="number"
          min={1}
          required
          defaultValue={120}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="deckId">Deck</Label>
        <select
          id="deckId"
          name="deckId"
          required
          className="border rounded-md h-9 px-3 text-sm bg-transparent"
        >
          {decks.map((deck) => (
            <option key={deck.id} value={deck.id}>
              {deck.name} ({deck.cardCount} cartes)
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Création..." : "Créer la session"}
      </Button>
    </form>
  );
}
