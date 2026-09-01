"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewCardForm } from "@/features/decks/components/new-card-form";

export function AddCardDisclosure({ deckId }: { deckId: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <Button
        type="button"
        variant="outline"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="self-start"
      >
        {isOpen ? <X /> : <Plus />}
        Ajouter une carte
      </Button>

      {isOpen && (
        <NewCardForm deckId={deckId} onCreated={() => setIsOpen(false)} />
      )}
    </div>
  );
}
