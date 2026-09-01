"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCard } from "@/features/decks/create-card-action";

export function NewCardForm({
  deckId,
  onCreated,
}: {
  deckId: string;
  onCreated?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await createCard(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      formRef.current?.reset();
      router.refresh();
      onCreated?.();
    });
  };

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="flex flex-col gap-6 max-w-sm"
    >
      <input type="hidden" name="deckId" value={deckId} />
      <div className="grid gap-2">
        <Label htmlFor="theme">Thème</Label>
        <Input id="theme" name="theme" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="title">Titre</Label>
        <Input id="title" name="title" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="bullets">Critères (un par ligne)</Label>
        <textarea
          id="bullets"
          name="bullets"
          className="border rounded-md px-3 py-2 text-sm bg-transparent"
          rows={5}
          required
        />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Création..." : "Ajouter la carte"}
      </Button>
    </form>
  );
}
