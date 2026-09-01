"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateCard } from "@/features/decks/update-card-action";

export function EditCardForm({
  card,
  deckId,
}: {
  card: { id: string; theme: string; title: string; bullets: string[] };
  deckId: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await updateCard(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push(`/admin/decks/${deckId}`);
    });
  };

  return (
    <form action={handleSubmit} className="flex flex-col gap-6 max-w-sm">
      <input type="hidden" name="cardId" value={card.id} />
      <div className="grid gap-2">
        <Label htmlFor="theme">Thème</Label>
        <Input id="theme" name="theme" defaultValue={card.theme} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="title">Titre</Label>
        <Input id="title" name="title" defaultValue={card.title} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="bullets">Critères (un par ligne)</Label>
        <textarea
          id="bullets"
          name="bullets"
          defaultValue={card.bullets.join("\n")}
          className="border rounded-md px-3 py-2 text-sm bg-transparent"
          rows={5}
          required
        />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Enregistrement..." : "Enregistrer"}
      </Button>
    </form>
  );
}
