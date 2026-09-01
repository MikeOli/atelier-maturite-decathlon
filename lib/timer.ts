/**
 * Time remaining until `createdAt + durationMinutes`, clamped to zero —
 * never negative once the session's time budget has elapsed.
 */
export function remainingMs(
  createdAt: string,
  durationMinutes: number,
  now: number,
): number {
  const endsAt = new Date(createdAt).getTime() + durationMinutes * 60_000;
  return Math.max(0, endsAt - now);
}

/**
 * Formats a millisecond duration as `m:ss`, or `h:mm:ss` once it reaches an
 * hour — sessions have no upper bound on duration, so anything over 59
 * minutes must not collapse into a misleading `90:00`.
 */
export function formatRemaining(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
