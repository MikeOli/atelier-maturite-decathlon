"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createDeck } from "@/features/decks/create-deck-action";

export function NewDeckForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await createDeck(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
      router.push("/admin?tab=decks");
    });
  };

  return (
    <form action={handleSubmit} className="flex flex-col gap-6 max-w-sm">
      <div className="grid gap-2">
        <Label htmlFor="name">Nom du deck</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="description">Description (optionnel)</Label>
        <textarea
          id="description"
          name="description"
          className="border rounded-md px-3 py-2 text-sm bg-transparent"
          rows={4}
        />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Création..." : "Créer le deck"}
      </Button>
    </form>
  );
}
