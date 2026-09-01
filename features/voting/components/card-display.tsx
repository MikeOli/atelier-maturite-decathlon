import type { SessionCurrentCard } from "@/features/sessions/actions";

export function CardDisplay({ card }: { card: SessionCurrentCard }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-mono font-medium uppercase tracking-[0.12em] text-sand-foreground">
        {card.theme}
      </p>
      <h2 className="font-display text-[26px] font-bold tracking-tight">
        {card.title}
      </h2>
      <ul className="list-disc pl-5 flex flex-col gap-3 text-[15.5px] leading-[1.55] text-foreground-soft">
        {card.bullets.map((bullet, index) => (
          <li key={index}>{bullet}</li>
        ))}
      </ul>
    </div>
  );
}
