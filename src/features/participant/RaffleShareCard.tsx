import { useEffect, useState, type FormEvent } from "react";
import { Download, LoaderCircle, Share2 } from "lucide-react";

import { isValidPixKey } from "./pixBrCode";
import { createRaffleShareImage, createRaffleSharePreviewImage, type RaffleShareArtInput } from "./raffleShareArt";
import type { ParticipantRegistrationView } from "./participant.domain";

type Props = {
  participant: ParticipantRegistrationView;
  renderArt?: (input: RaffleShareArtInput) => Promise<File>;
};

export function RaffleShareCard({ participant, renderArt = createRaffleShareImage }: Props) {
  const [pixKey, setPixKey] = useState("");
  const [creating, setCreating] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [illustrationUrl, setIllustrationUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void createRaffleSharePreviewImage(participant.registration.choirName)
      .then((url) => { if (active) setIllustrationUrl(url); })
      .catch(() => { if (active) setIllustrationUrl(""); });
    return () => { active = false; };
  }, [participant.registration.choirName]);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const canGenerate = Boolean(
    !creating &&
    participant.registration.choirName &&
    participant.identity.name.trim() &&
    isValidPixKey(pixKey),
  );

  const generate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canGenerate) return;
    setCreating(true);
    setError("");
    setFile(null);
    setPreviewUrl("");
    try {
      const image = await renderArt({
        choirName: participant.registration.choirName,
        displayName: participant.identity.name.trim(),
        pixKey: pixKey.trim(),
        city: participant.registration.city?.trim() || "Quixadá",
      });
      setFile(image);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível gerar o card. Tente novamente.");
    } finally {
      setCreating(false);
    }
  };

  const share = async () => {
    if (!file) return;
    try {
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({ files: [file], title: "Rifa beneficente do nosso coro", text: `Ajude o ${participant.registration.choirName} a participar do encontro de coros!` });
      } else {
        setError("Seu navegador não permite compartilhar diretamente. Baixe a imagem e envie pelo aplicativo que preferir.");
      }
    } catch (cause) {
      if (cause instanceof Error && cause.name !== "AbortError") setError("Não foi possível compartilhar. Baixe a imagem e tente novamente.");
    }
  };

  return (
    <section aria-label="Compartilhe a rifa" className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
      <div className="grid gap-0 sm:grid-cols-[minmax(0,300px)_1fr]">
        <div className="mx-auto w-full max-w-[340px] bg-[#fff8e6] p-3 sm:max-w-none sm:p-4">
          {previewUrl ? (
            <img src={previewUrl} alt="Seu card da rifa com QR Code Pix" className="w-full rounded-lg" />
          ) : (
            <div className="overflow-hidden rounded-lg border border-amber-300 bg-white">
              <div aria-label={`Prévia da rifa do ${participant.registration.choirName}`} className="aspect-[9/13] overflow-hidden bg-amber-50">
                {illustrationUrl ? (
                  <img src={illustrationUrl} alt={`Card da rifa do ${participant.registration.choirName}`} className="w-full" />
                ) : (
                  <div className="flex size-full items-center justify-center p-5 text-center text-sm font-semibold text-amber-950">
                    Preparando o card do {participant.registration.choirName}…
                  </div>
                )}
              </div>
              <form onSubmit={(event) => void generate(event)} className="space-y-2 p-3">
                <label htmlFor="home-raffle-pix-key" className="block text-sm font-bold text-zinc-900">Sua chave Pix</label>
                <input
                  id="home-raffle-pix-key"
                  autoComplete="off"
                  value={pixKey}
                  maxLength={77}
                  onChange={(event) => setPixKey(event.target.value)}
                  placeholder="E-mail, CPF ou chave Pix"
                  className="min-h-11 w-full rounded-lg border border-zinc-400 bg-white px-3 text-sm text-zinc-950 outline-none placeholder:text-zinc-600 focus-visible:border-amber-700 focus-visible:ring-2 focus-visible:ring-amber-300"
                />
                <button type="submit" disabled={!canGenerate} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 text-sm font-bold text-white hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                  {creating ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}
                  {creating ? "Gerando…" : "Gerar card"}
                </button>
              </form>
            </div>
          )}
        </div>
        <div className="flex flex-col justify-center p-4 sm:p-6">
          <h2 className="text-xl font-bold text-zinc-950">Divulgue suas rifas com seu QR Code Pix</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-700">Basta informar sua chave Pix e gerar o card. Depois, é só compartilhar com seus grupos e amigos!</p>
          {error ? <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
          {previewUrl && file ? (
            <div className="mt-5 flex flex-wrap gap-2">
              <a href={previewUrl} download={file.name} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 text-sm font-bold text-zinc-950 hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700">
                <Download aria-hidden="true" className="size-4" /> Baixar imagem
              </a>
              <button type="button" onClick={() => void share()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-zinc-300 px-4 text-sm font-bold text-zinc-900 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700">
                <Share2 aria-hidden="true" className="size-4" /> Compartilhar
              </button>
              <button type="button" onClick={() => { setFile(null); setPreviewUrl(""); }} className="inline-flex min-h-11 items-center justify-center px-3 text-sm font-semibold text-zinc-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700">
                Alterar chave Pix
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
