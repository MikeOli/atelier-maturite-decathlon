import type { CardSynthesis } from "@/features/synthesis/actions";
import { Badge } from "@/components/ui/badge";
import { themeVariantMap } from "@/features/synthesis/theme-colors";

export function SynthesisTable({ cards }: { cards: CardSynthesis[] }) {
  if (cards.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Aucune carte votée pour l&apos;instant.
      </p>
    );
  }

  const variantByTheme = themeVariantMap(cards.map((c) => c.theme));

  return (
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="border-b">
          <th className="py-2 pr-4 font-medium">Thème</th>
          <th className="py-2 pr-4 font-medium">Carte</th>
          <th className="py-2 font-medium">Accord retenu</th>
        </tr>
      </thead>
      <tbody>
        {cards.map((card) => (
          <tr key={card.cardId} className="border-b">
            <td className="py-2 pr-4">
              <Badge variant={variantByTheme.get(card.theme)}>
                {card.theme}
              </Badge>
            </td>
            <td className="py-2 pr-4">{card.title}</td>
            <td className="py-2">
              {card.consensusValue === null ? (
                <span className="text-muted-foreground">
                  Pas encore d&apos;accord retenu
                </span>
              ) : (
                <span className="font-bold">{card.consensusValue}</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
