import type { ThemeSynthesis } from "@/features/synthesis/synthesis-utils";
import { themeVariantMap, type ThemeVariant } from "@/features/synthesis/theme-colors";
import { SegmentedBar } from "@/components/ui/segmented-bar";

// Tailwind's compiler only picks up classes it can see as literal strings —
// a template-built `bg-${variant}` would be silently dropped from the
// build, so every variant's classes are spelled out here instead.
const CARD_BG: Record<ThemeVariant, string> = {
  lav: "bg-lav",
  sky: "bg-sky",
  sand: "bg-sand",
  pink: "bg-pink",
};
const BADGE_BAR_COLOR: Record<ThemeVariant, string> = {
  lav: "bg-lav-foreground",
  sky: "bg-sky-foreground",
  sand: "bg-sand-foreground",
  pink: "bg-pink-foreground",
};

export function ThemeSynthesisTable({ themes }: { themes: ThemeSynthesis[] }) {
  if (themes.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Aucun thème à synthétiser pour l&apos;instant.
      </p>
    );
  }

  const variantByTheme = themeVariantMap(themes.map((t) => t.theme));

  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {themes.map((theme) => {
        const variant: ThemeVariant = variantByTheme.get(theme.theme) ?? "lav";
        return (
          <li key={theme.theme} className={`rounded-lg p-5 ${CARD_BG[variant]}`}>
            <div className="flex items-center justify-between">
              <span className="font-bold">{theme.theme}</span>
              <span className="font-display text-2xl font-bold">
                {theme.average}
                <span className="text-sm font-medium opacity-70"> / 5</span>
              </span>
            </div>
            <SegmentedBar
              total={5}
              filled={Math.round(theme.average)}
              colorClass={BADGE_BAR_COLOR[variant]}
              className="mt-4"
            />
            <p className="text-sm opacity-75 mt-3">
              Écart {theme.spread}
              {theme.missingCount > 0 &&
                ` · ${theme.missingCount} carte${theme.missingCount > 1 ? "s" : ""} sans accord retenu`}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
