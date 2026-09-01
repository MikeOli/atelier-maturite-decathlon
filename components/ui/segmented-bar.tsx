import { cn } from "@/lib/utils";

/**
 * Row of rounded segments — filled solid up to `filled`, dashed-outline
 * empty beyond it. Used for session/vote capacity and theme distribution
 * (dashboard, board projeté, synthèse) per the Sally-approved design system.
 */
export function SegmentedBar({
  total,
  filled,
  colorClass,
  className,
}: {
  total: number;
  filled: number;
  colorClass: string;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-1.5", className)}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={cn(
            "h-8 flex-1 rounded-[9px]",
            i < filled ? colorClass : "border-[1.6px] border-dashed border-foreground/20",
          )}
        />
      ))}
    </div>
  );
}
