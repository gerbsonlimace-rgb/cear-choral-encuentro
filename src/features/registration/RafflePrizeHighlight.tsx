import { Trophy } from "lucide-react";

type RafflePrizeHighlightProps = {
  compact?: boolean;
};

export function RafflePrizeHighlight({ compact = false }: RafflePrizeHighlightProps) {
  return (
    <div
      aria-label="Prêmios da rifa"
      className={`mt-3 rounded-lg border border-amber-200 bg-amber-50/80 text-stone-700 ${compact ? "px-3 py-2" : "px-3.5 py-2.5"}`}
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-amber-800">
            Prêmio da rifa
          </p>
          <p className="mt-0.5 text-base font-extrabold tracking-tight text-stone-900">R$ 1.000,00</p>
        </div>
        <div className="border-l border-amber-200 pl-3">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-amber-800">
            Maior vendedor
          </p>
          <p className="mt-0.5 text-base font-extrabold tracking-tight text-stone-900">R$ 500,00</p>
        </div>
      </div>
      <p className="mt-1.5 flex items-start gap-1.5 text-[0.7rem] font-medium leading-relaxed text-stone-700">
        <Trophy className="mt-0.5 size-3.5 shrink-0 text-amber-700" aria-hidden="true" />
        <span>Quem vender mais rifas concorre ao prêmio extra de R$ 500,00.</span>
      </p>
    </div>
  );
}
