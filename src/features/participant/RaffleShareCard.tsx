import { useState } from "react";
import { Download, MessageCircle, Share2 } from "lucide-react";

import { deliverFile } from "@/lib/file-download";

const cardPath = "/raffle-share-card.svg";
const cardFileName = "rifa-encontro-de-coros.png";
const whatsappMessage =
  "Oi! Estou vendendo rifas para apoiar o II Encontro de Coros Diocesanos e Litúrgicos do Ceará. Cada rifa custa R$ 10,00 e o prêmio é de R$ 1.000,00. Quer participar? Me responda por aqui! 🎶";

export const raffleWhatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`;

async function createCardPng(): Promise<Blob> {
  const response = await fetch(cardPath);
  if (!response.ok) throw new Error("Não foi possível carregar o card.");
  const svg = await response.blob();
  const url = URL.createObjectURL(svg);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar o card.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Não foi possível criar a imagem.")), "image/png");
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function RaffleShareCard() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shareCard = async () => {
    setBusy(true);
    setError(null);
    try {
      await deliverFile(await createCardPng(), cardFileName);
    } catch {
      setError("Não foi possível preparar o card agora. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Compartilhe a rifa" className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
      <div className="grid gap-0 sm:grid-cols-[minmax(0,220px)_1fr]">
        <div className="bg-zinc-950 p-3 sm:p-4">
          <img src={cardPath} alt="Card da rifa: concorra a R$ 1.000,00 por R$ 10,00 cada rifa" className="mx-auto max-h-64 w-auto rounded-lg sm:max-h-none sm:w-full" loading="lazy" />
        </div>
        <div className="flex flex-col justify-center p-4 sm:p-6">
          <span className="text-xs font-bold uppercase tracking-widest text-amber-800">Espalhe essa ideia</span>
          <h2 className="mt-1 text-xl font-bold text-zinc-950">Compartilhe a rifa e convide seus amigos</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-700">
            Cada rifa custa <strong>R$ 10,00</strong> e concorre a <strong>R$ 1.000,00</strong>. Envie o card ou uma mensagem para quem queira ajudar nosso encontro.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => void shareCard()} disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60">
              <Share2 aria-hidden="true" className="size-4" />{busy ? "Preparando card…" : "Compartilhar card"}
            </button>
            <a href={raffleWhatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 text-sm font-semibold text-emerald-900 hover:bg-emerald-100">
              <MessageCircle aria-hidden="true" className="size-4" />Mensagem no WhatsApp
            </a>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-zinc-600"><Download aria-hidden="true" className="size-3.5" />No celular, escolha o WhatsApp para enviar o card. No computador, ele será baixado.</p>
          {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
        </div>
      </div>
    </section>
  );
}
