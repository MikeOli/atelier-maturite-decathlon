"use client";

import { useMemo, useSyncExternalStore } from "react";
import { remainingMs, formatRemaining } from "@/lib/timer";
import { cn } from "@/lib/utils";

/**
 * The clock is an external, mutable source, so it is read through a store
 * instead of being mirrored into state from an effect. The snapshot is
 * only ever recomputed on a tick — never during render — which keeps the
 * render pure (react-hooks/purity) and leaves the server and the first
 * client render with null, so nothing can mismatch during hydration.
 */
function createClockStore(createdAt: string, durationMinutes: number) {
  let snapshot: number | null = null;
  let interval: ReturnType<typeof setInterval> | null = null;
  const listeners = new Set<() => void>();

  const stop = () => {
    if (interval !== null) {
      clearInterval(interval);
      interval = null;
    }
  };

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);

      if (interval === null) {
        snapshot = remainingMs(createdAt, durationMinutes, Date.now());
        interval = setInterval(() => {
          snapshot = remainingMs(createdAt, durationMinutes, Date.now());
          listeners.forEach((l) => l());
          // Stop ticking once time's up instead of polling Date.now()
          // forever on a page the user may leave open indefinitely.
          if (snapshot === 0) stop();
        }, 1000);
      }

      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) stop();
      };
    },
    getSnapshot: () => snapshot,
    getServerSnapshot: (): number | null => null,
  };
}

export function SessionTimer({
  createdAt,
  durationMinutes,
}: {
  createdAt: string;
  durationMinutes: number;
}) {
  const store = useMemo(
    () => createClockStore(createdAt, durationMinutes),
    [createdAt, durationMinutes],
  );
  const remaining = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );

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
