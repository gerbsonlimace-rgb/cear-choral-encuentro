import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type InstallmentOption = {
  count: number;
  amountCents: number;
};

const installmentTables: Record<number, readonly InstallmentOption[]> = {
  8_000: [
    { count: 12, amountCents: 800 },
    { count: 11, amountCents: 865 },
    { count: 10, amountCents: 942 },
    { count: 9, amountCents: 1_037 },
    { count: 8, amountCents: 1_156 },
    { count: 7, amountCents: 1_308 },
    { count: 6, amountCents: 1_477 },
    { count: 5, amountCents: 1_755 },
    { count: 4, amountCents: 2_172 },
    { count: 3, amountCents: 2_868 },
    { count: 2, amountCents: 4_260 },
    { count: 1, amountCents: 8_351 },
  ],
  10_000: [
    { count: 12, amountCents: 1_000 },
    { count: 11, amountCents: 1_081 },
    { count: 10, amountCents: 1_178 },
    { count: 9, amountCents: 1_296 },
    { count: 8, amountCents: 1_444 },
    { count: 7, amountCents: 1_635 },
    { count: 6, amountCents: 1_846 },
    { count: 5, amountCents: 2_193 },
    { count: 4, amountCents: 2_715 },
    { count: 3, amountCents: 3_585 },
    { count: 2, amountCents: 5_325 },
    { count: 1, amountCents: 10_439 },
  ],
  30_000: [
    { count: 12, amountCents: 3_000 },
    { count: 11, amountCents: 3_242 },
    { count: 10, amountCents: 3_532 },
    { count: 9, amountCents: 3_888 },
    { count: 8, amountCents: 4_332 },
    { count: 7, amountCents: 4_904 },
    { count: 6, amountCents: 5_536 },
    { count: 5, amountCents: 6_579 },
    { count: 4, amountCents: 8_145 },
    { count: 3, amountCents: 10_754 },
    { count: 2, amountCents: 15_973 },
    { count: 1, amountCents: 31_316 },
  ],
};

export function formatInstallmentCurrency(valueInCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valueInCents / 100);
}

export function getInstallmentOptions(amountCents: number): readonly InstallmentOption[] {
  return installmentTables[amountCents] ?? [];
}

type RegistrationInstallmentsProps = {
  amountCents: number;
};

export function RegistrationInstallments({ amountCents }: RegistrationInstallmentsProps) {
  const options = getInstallmentOptions(amountCents);
  const [isOpen, setIsOpen] = useState(false);
  const contentId = useId();

  if (options.length === 0) return null;

  return (
    <div className="mt-2" data-testid="installment-schedule">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-stone-600">No cartão em até 12x</span>
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={isOpen ? "Ocultar parcelas" : "Ver parcelas"}
              className="inline-flex min-h-8 min-w-28 items-center justify-center gap-1 rounded-md border border-amber-300 px-2.5 py-1 text-xs font-bold text-amber-800 transition-colors hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/50"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsOpen((open) => !open);
              }}
            >
              Ver parcelas
              <ChevronDown className={`size-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            id={contentId}
            role="dialog"
            align="end"
            sideOffset={8}
            data-testid="installment-popup"
            aria-label={`Parcelas para ${formatInstallmentCurrency(amountCents)}`}
            className="w-72 rounded-xl border-amber-200 bg-white p-3 text-stone-900 shadow-xl"
          >
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-amber-800">
              Parcelamento no cartão
            </p>
            <p className="mb-2 text-xs text-stone-600">
              Valores para {formatInstallmentCurrency(amountCents)}
            </p>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-stone-700 sm:grid-cols-3">
              {options.slice().reverse().map(({ count, amountCents: installmentAmountCents }) => (
                <li key={count} className="whitespace-nowrap">
                  {count}x de {formatInstallmentCurrency(installmentAmountCents)}
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
