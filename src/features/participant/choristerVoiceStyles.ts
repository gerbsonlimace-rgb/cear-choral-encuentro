import { cn } from "@/lib/utils";

export type ChoristerVoicePart =
  | "principal"
  | "soprano"
  | "contralto"
  | "tenor"
  | "baixo"
  | "todos";

type VoiceStyle = {
  label: string;
  border: string;
  text: string;
  bg: string;
  bgSolid: string;
  hoverBg: string;
  ring: string;
  badgeClass: string;
  filterClass: string;
};

// Keep these tokens in sync with CoroApp src/utils/eventAudioListLayout.ts.
export const voiceStyles: Record<ChoristerVoicePart, VoiceStyle> = {
  principal: {
    label: "Principal",
    border: "border-primary/45",
    text: "text-primary",
    bg: "bg-primary/10",
    bgSolid: "bg-primary",
    hoverBg: "hover:bg-primary/20",
    ring: "ring-primary/25",
    badgeClass: "border-primary/45 text-primary bg-primary/10",
    filterClass: "bg-primary text-primary-foreground",
  },
  soprano: {
    label: "Soprano",
    border: "border-pink-500/40",
    text: "text-pink-700",
    bg: "bg-pink-500/10",
    bgSolid: "bg-pink-500",
    hoverBg: "hover:bg-pink-500/20",
    ring: "ring-pink-500/20",
    badgeClass: "border-pink-500/40 text-pink-700 bg-pink-500/5",
    filterClass: "bg-pink-500 text-white",
  },
  contralto: {
    label: "Contralto",
    border: "border-yellow-500/40",
    text: "text-yellow-800",
    bg: "bg-yellow-500/10",
    bgSolid: "bg-yellow-500",
    hoverBg: "hover:bg-yellow-500/20",
    ring: "ring-yellow-500/20",
    badgeClass: "border-yellow-500/40 text-yellow-800 bg-yellow-500/5",
    filterClass: "bg-yellow-500 text-black",
  },
  tenor: {
    label: "Tenor",
    border: "border-emerald-500/40",
    text: "text-emerald-700",
    bg: "bg-emerald-500/10",
    bgSolid: "bg-emerald-500",
    hoverBg: "hover:bg-emerald-500/20",
    ring: "ring-emerald-500/20",
    badgeClass: "border-emerald-500/40 text-emerald-700 bg-emerald-500/5",
    filterClass: "bg-emerald-500 text-white",
  },
  baixo: {
    label: "Baixo",
    border: "border-blue-500/40",
    text: "text-blue-600",
    bg: "bg-blue-500/10",
    bgSolid: "bg-blue-500",
    hoverBg: "hover:bg-blue-500/20",
    ring: "ring-blue-500/20",
    badgeClass: "border-blue-500/40 text-blue-600 bg-blue-500/5",
    filterClass: "bg-blue-500 text-white",
  },
  todos: {
    label: "todos",
    border: "border-zinc-300",
    text: "text-zinc-700",
    bg: "bg-zinc-100",
    bgSolid: "bg-zinc-200",
    hoverBg: "hover:bg-zinc-200",
    ring: "ring-zinc-300",
    badgeClass: "border-zinc-300 text-zinc-700 bg-zinc-100",
    filterClass: "bg-zinc-200 text-zinc-950",
  },
};

export function getChoristerVoiceStyle(voice: ChoristerVoicePart, selected: boolean) {
  const style = voiceStyles[voice];
  return {
    ...style,
    selected,
    filterButtonClass: cn(
      "border transition-colors",
      selected ? style.filterClass : `${style.border} ${style.text} ${style.bg} ${style.hoverBg}`,
      selected && `ring-2 ring-offset-2 ${style.ring}`,
    ),
  };
}
