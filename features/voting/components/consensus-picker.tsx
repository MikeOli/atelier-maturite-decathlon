"use client";

import { MaturityScaleGrid } from "@/features/voting/components/maturity-scale-grid";

export function ConsensusPicker({
  value,
  pendingValue,
  onSubmit,
}: {
  value: number | null;
  pendingValue: number | null;
  onSubmit: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-6 shadow-sm">
      <p className="text-sm font-medium">
        {value !== null
          ? `Accord retenu : ${value}`
          : "Valeur d'accord de l'équipe"}
      </p>
      <MaturityScaleGrid
        selectedValue={value}
        pendingValue={pendingValue}
        onSelect={onSubmit}
      />
    </div>
  );
}
