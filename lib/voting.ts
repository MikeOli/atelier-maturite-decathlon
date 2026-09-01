// Story 3.11: replaces the original Fibonacci scale (0,1,2,3,5,8,13,21) —
// too spread out at the high end for a maturity assessment (this isn't
// effort estimation). A card's number of affirmations (2-4, varies per
// card) is deliberately unrelated to this scale — the vote is a holistic
// judgment on the card, not a count. Disagreement between participants is
// a desired outcome (it drives debate), not something to reconcile here.
// Colors form a continuous red -> amber -> green gradient — one shade per
// value, not 2-3 shared tiers, so the scale reads at a glance without
// needing the labels. Repalette (2026-08-22): matches the muted/mate tones
// of the "atelier maturité" mobile pilotage mockup, replacing the earlier
// saturated gradient. `text` is chosen per swatch for contrast, not copied
// verbatim from the mockup (which used white throughout) — #cf7c3c/#c7963a/
// #9ba83f/#5fa35c all read under 3.2:1 against white but pass 4.85:1+
// against `--ink` (#1b2340), so those four use dark text instead.
export const MATURITY_SCALE = [
  { value: 0, label: "Néant", bg: "#C1483C", text: "#FFFFFF" },
  { value: 1, label: "Balbutiant", bg: "#CF7C3C", text: "#1B2340" },
  { value: 2, label: "Bancal", bg: "#C7963A", text: "#1B2340" },
  { value: 3, label: "Ça tient", bg: "#9BA83F", text: "#1B2340" },
  { value: 4, label: "Solide", bg: "#5FA35C", text: "#1B2340" },
  { value: 5, label: "Au top", bg: "#3B8F5C", text: "#FFFFFF" },
] as const;

export const MATURITY_VALUES = MATURITY_SCALE.map((s) => s.value);

export type MaturityValue = (typeof MATURITY_VALUES)[number];

/**
 * Looks up the gradient colors for a value already known to be on the
 * scale (votes/consensus are schema-validated on write — Stories 3.1/3.8).
 * Falls back to a neutral gray rather than throwing, in case a stored
 * value ever predates a future scale change.
 */
export function getMaturityColors(value: number): { bg: string; text: string } {
  return (
    MATURITY_SCALE.find((s) => s.value === value) ?? {
      bg: "#C1C7D3",
      text: "#1B2340",
    }
  );
}

/**
 * Min/max among revealed vote values, for highlighting the spread (FR31 —
 * never color-only). Returns `null` when there's nothing to signal: fewer
 * than two votes, or every vote already equal.
 */
export function getVoteExtremes(
  values: number[],
): { max: number; min: number } | null {
  if (values.length < 2) return null;

  const max = Math.max(...values);
  const min = Math.min(...values);

  if (max === min) return null;

  return { max, min };
}
