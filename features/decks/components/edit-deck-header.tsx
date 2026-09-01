"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateDeck } from "@/features/decks/update-deck-action";

export function EditDeckHeader({
  deck,
}: {
  deck: { id: string; name: string; description: string };
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (!editing) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-bold">{deck.name}</h1>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setEditing(true)}
          >
            Éditer
          </Button>
        </div>
        {deck.description && (
          <p className="text-sm text-muted-foreground">{deck.description}</p>
        )}
      </div>
    );
  }

  const handleSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await updateDeck(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  };

  return (
    <form action={handleSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="deckId" value={deck.id} />
      <div className="grid gap-2">
        <Label htmlFor="name">Nom du deck</Label>
        <Input id="name" name="name" defaultValue={deck.name} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          name="description"
          defaultValue={deck.description}
          className="border rounded-md px-3 py-2 text-sm bg-transparent"
          rows={3}
        />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Enregistrement..." : "Enregistrer"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setEditing(false)}
          disabled={isPending}
        >
          Annuler
        </Button>
      </div>
    </form>
  );
}
