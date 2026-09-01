const THEME_VARIANTS = ["lav", "sky", "sand", "pink"] as const;

export type ThemeVariant = (typeof THEME_VARIANTS)[number];

/**
 * Assigns pastel variants to theme names in first-appearance order (true
 * rotation, not a hash) so a theme keeps the same color whether it's read
 * off the per-card list or the aggregated theme table — both are built
 * from the same underlying card order, so this produces an identical
 * mapping independently in each component without a shared prop.
 */
export function themeVariantMap(
  orderedThemeNames: string[],
): Map<string, ThemeVariant> {
  const map = new Map<string, ThemeVariant>();
  let i = 0;
  for (const name of orderedThemeNames) {
    if (!map.has(name)) {
      map.set(name, THEME_VARIANTS[i % THEME_VARIANTS.length]);
      i++;
    }
  }
  return map;
}
