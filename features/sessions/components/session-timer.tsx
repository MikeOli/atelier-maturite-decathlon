"use client";

import { useState, useEffect } from "react";
import { remainingMs, formatRemaining } from "@/lib/timer";
import { cn } from "@/lib/utils";

export function SessionTimer({
  createdAt,
  durationMinutes,
}: {
  createdAt: string;
  durationMinutes: number;
}) {
  // Computing Date.now() during render would produce a different value on
  // the server vs. the client's first render (hydration mismatch) — start
  // at null (identical on both) and compute the real value only after
  // mount, client-side only.
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    setRemaining(remainingMs(createdAt, durationMinutes, Date.now()));

    const interval = setInterval(() => {
      const next = remainingMs(createdAt, durationMinutes, Date.now());
      setRemaining(next);
      // Stop ticking once time's up instead of polling Date.now() forever
      // on a page the user may leave open indefinitely.
      if (next === 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [createdAt, durationMinutes]);

  if (remaining === null) {
    return null;
  }

  // Purely informational (FR34 / Story 4.4): a session never auto-expires,
  // so `expired` must only ever affect this label's styling/text — never
  // wire it to a Server Action that closes the session. Closure is and
  // stays an explicit facilitator action (Story 4.5).
  const expired = remaining === 0;
  const totalMs = durationMinutes * 60 * 1000;
  const pct = totalMs > 0 ? Math.max(0, Math.min(100, (remaining / totalMs) * 100)) : 0;

  return (
    <div className="flex items-center gap-3.5 font-mono text-sm text-foreground-soft">
      <span>
        Temps restant{" "}
        <span
          className={cn(
            "font-semibold",
            expired ? "text-destructive" : "text-foreground",
          )}
        >
          {formatRemaining(remaining)}
          {expired && " (terminé)"}
        </span>
      </span>
      <span className="inline-block h-[3px] w-24 overflow-hidden rounded-full bg-border align-middle">
        <span
          className={cn(
            "block h-full rounded-full transition-[width] duration-1000 ease-linear",
            expired ? "bg-destructive" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </span>
    </div>
  );
}
