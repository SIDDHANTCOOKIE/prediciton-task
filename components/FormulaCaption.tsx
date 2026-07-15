import type { SortKey } from "@/lib/types";

const FORMULAS: Partial<Record<SortKey, string>> = {
  score: "Score = 25% Consistency (R²) + 25% Returns (Sortino) + 20% Win Rate + 15% Max Loss + 15% Profit Factor",
  returnOnCapital: "Efficiency = P&L ÷ Volume — profit per dollar traded",
};

export function FormulaCaption({ sortKey }: { sortKey: SortKey }) {
  const formula = FORMULAS[sortKey];
  if (!formula) return null;
  return (
    <div className="border-b border-border-soft bg-accent-soft px-4 py-2 font-mono text-[11px] text-accent sm:px-6">
      {formula}
    </div>
  );
}
