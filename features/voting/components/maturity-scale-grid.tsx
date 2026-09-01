"use client";

import { MATURITY_SCALE } from "@/lib/voting";
import { cn } from "@/lib/utils";

/**
 * Shared 0-5 maturity-scale button list — used by both `VoteCard`
 * (participant vote) and `ConsensusPicker` (facilitator's team-consensus
 * entry, Story 3.8). Extracted during code review of Story 3.8
 * (2026-08-21) as `FibonacciValueGrid`, renamed in Story 3.11 once the
 * scale itself stopped being Fibonacci. Repalette (2026-08-22): single-
 * column pill rows (was a 2-column card grid) — matches the mobile
 * pilotage mockup's `.scale-row` layout; colored rank badge unchanged.
 */
export function MaturityScaleGrid({
  selectedValue,
  pendingValue,
  onSelect,
}: {
  selectedValue: number | null;
  pendingValue: number | null;
  onSelect: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {MATURITY_SCALE.map(({ value, label, bg, text }) => (
        <button
          key={value}
          type="button"
          disabled={pendingValue !== null}
          onClick={() => onSelect(value)}
          aria-pressed={value === selectedValue}
          className={cn(
            "flex items-center gap-3 rounded-full border px-4 py-2.5 text-left transition-colors",
            value === selectedValue
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card hover:bg-accent cursor-pointer",
            pendingValue === value && "animate-pulse",
          )}
        >
          <span
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold"
            style={{ backgroundColor: bg, color: text }}
          >
            {value}
          </span>
          <span className="text-sm font-medium">{label}</span>
        </button>
      ))}
    </div>
  );
}
