import { Trophy } from "lucide-react";

type RafflePrizeHighlightProps = {
  compact?: boolean;
};

export function RafflePrizeHighlight({ compact = false }: RafflePrizeHighlightProps) {
  return (
    <div
      aria-label="Prêmios da rifa"
      className={`mt-3 rounded-xl border border-amber-300 bg-amber-100/70 text-stone-800 ${compact ? "px-3 py-2.5" : "px-4 py-3"}`}
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-amber-900">
            Prêmio da rifa
          </p>
          <p className="mt-0.5 text-xl font-black tracking-tight text-amber-950">R$ 1.000,00</p>
        </div>
        <div className="border-l border-amber-300 pl-3">
          <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-amber-900">
            Maior vendedor
          </p>
          <p className="mt-0.5 text-xl font-black tracking-tight text-amber-950">R$ 500,00</p>
        </div>
      </div>
      <p className="mt-2 flex items-start gap-1.5 text-xs font-semibold leading-relaxed text-amber-950">
        <Trophy className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>Quem vender mais rifas concorre ao prêmio extra de R$ 500,00.</span>
      </p>
    </div>
  );
}
