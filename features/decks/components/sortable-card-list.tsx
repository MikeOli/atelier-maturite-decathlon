"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArchiveCardButton } from "@/features/decks/components/archive-card-button";
import { reorderCards } from "@/features/decks/reorder-cards-action";

type Card = {
  id: string;
  theme: string;
  title: string;
  bullets: string[];
};

function SortableCardItem({
  deckId,
  card,
  disabled,
}: {
  deckId: string;
  card: Card;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="border rounded-md p-4 flex flex-col gap-1 bg-background"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            {...attributes}
            {...listeners}
            disabled={disabled}
            className="cursor-grab touch-none text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Réordonner la carte"
          >
            ⠿
          </button>
          <span className="font-medium">{card.title}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{card.theme}</span>
          <Link
            href={`/admin/decks/${deckId}/cards/${card.id}/edit`}
            className="text-sm underline"
          >
            Éditer
          </Link>
          <ArchiveCardButton cardId={card.id} />
        </div>
      </div>
      <ul className="text-sm text-muted-foreground list-disc pl-4">
        {card.bullets.map((bullet, index) => (
          <li key={index}>{bullet}</li>
        ))}
      </ul>
    </li>
  );
}

export function SortableCardList({
  deckId,
  cards: initialCards,
}: {
  deckId: string;
  cards: Card[];
}) {
  const [cards, setCards] = useState(initialCards);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  // Synchronous guard against a second drag starting before isPending's
  // render-committed value catches up — isPending only flips true after a
  // commit, leaving a same-tick window a state check alone can't close.
  const isReorderingRef = useRef(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Re-sync with the server whenever the parent re-renders with a fresh
  // card set (e.g. ArchiveCardButton/NewCardForm's router.refresh()) — a
  // plain useState(initialCards) would otherwise freeze at mount and drag
  // against a stale list. Skipped while our own reorder is in flight so it
  // never clobbers the optimistic state an unrelated refresh races with.
  useEffect(() => {
    if (isReorderingRef.current) return;
    setCards(initialCards);
  }, [initialCards]);

  if (cards.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Ce deck n&apos;a pas encore de carte.
      </p>
    );
  }

  const handleDragEnd = (event: DragEndEvent) => {
    if (isReorderingRef.current) return;

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = cards.findIndex((card) => card.id === active.id);
    const newIndex = cards.findIndex((card) => card.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(cards, oldIndex, newIndex);
    const previous = cards;
    isReorderingRef.current = true;
    setError(null);
    setCards(reordered);

    startTransition(async () => {
      try {
        const result = await reorderCards(
          deckId,
          reordered.map((card) => card.id),
        );
        if (!result.success) {
          setCards(previous);
          setError(result.error);
          // The server's card set may have moved on since our local copy
          // was built (another tab archived/added a card) — refetch rather
          // than leave every future drag failing against the same stale
          // list until an unrelated page action happens to refresh it.
          router.refresh();
        }
      } catch {
        setCards(previous);
        setError("Impossible de réordonner les cartes.");
        router.refresh();
      } finally {
        isReorderingRef.current = false;
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-sm text-red-500">{error}</p>}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={cards.map((card) => card.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="flex flex-col gap-3">
            {cards.map((card) => (
              <SortableCardItem
                key={card.id}
                deckId={deckId}
                card={card}
                disabled={isPending}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}
