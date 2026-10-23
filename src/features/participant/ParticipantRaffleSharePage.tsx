import { useEffect, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Download, LoaderCircle, Share2, Ticket } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getParticipantRegistration } from "@/lib/participant.functions";

import { hasRafflesToSell, type ParticipantRegistrationView } from "./participant.domain";
import { isValidPixKey } from "./pixBrCode";
import { createRaffleShareImage, type RaffleShareArtInput } from "./raffleShareArt";

type Props = {
  loadRegistration?: () => Promise<ParticipantRegistrationView>;
  renderArt?: (input: RaffleShareArtInput) => Promise<File>;
};

export function ParticipantRaffleSharePage({
  loadRegistration = getParticipantRegistration,
  renderArt = createRaffleShareImage,
}: Props) {
  const [participant, setParticipant] = useState<ParticipantRegistrationView | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [pixKey, setPixKey] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void loadRegistration()
      .then((view) => { if (active) setParticipant(view); })
      .catch(() => { if (active) setError("Não foi possível carregar seu coro. Atualize a página e tente novamente."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadRegistration]);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const canGenerate = Boolean(participant && hasRafflesToSell(participant) && participant.registration.choirName && participant.identity.name.trim() && isValidPixKey(pixKey) && !creating);
  const generate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!participant || !canGenerate) return;
    setCreating(true);
    setError("");
    setFile(null);
    setPreviewUrl("");
    try {
      const result = await renderArt({
        choirName: participant.registration.choirName,
        displayName: participant.identity.name.trim(),
        pixKey: pixKey.trim(),
        city: participant.registration.city?.trim() || "Quixadá",
      });
      setFile(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível gerar a imagem. Tente novamente.");
    } finally {
      setCreating(false);
    }
  };

  const share = async () => {
    if (!file) return;
    try {
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({ files: [file], title: "Rifa beneficente do nosso coro", text: `Ajude o ${participant?.registration.choirName} a participar do encontro de coros!` });
      } else {
        setError("O compartilhamento direto não está disponível neste navegador. Baixe a imagem e envie pelo aplicativo que preferir.");
      }
    } catch (cause) {
      if (cause instanceof Error && cause.name !== "AbortError") setError("Não foi possível compartilhar. Baixe a imagem e envie pelo aplicativo que preferir.");
    }
  };

  if (loading) {
    return <main className="internal-app min-h-screen bg-[#f7f5ef] px-4 py-10 text-zinc-900"><p role="status">Carregando suas rifas…</p></main>;
  }

  if (!participant || !hasRafflesToSell(participant)) {
    return (
      <main className="internal-app min-h-screen bg-[#f7f5ef] px-4 py-10 text-zinc-900">
        <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-white p-6">
          <h1 className="text-xl font-bold">Divulgação de rifas indisponível</h1>
          <p className="mt-2 text-sm text-zinc-700">{error || "Este card está disponível apenas para participantes com rifas para vender."}</p>
          <Link to="/participante" className="mt-5 inline-flex min-h-11 items-center gap-2 font-semibold text-amber-900">
            <ArrowLeft aria-hidden="true" className="size-4" /> Voltar ao portal
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="internal-app min-h-screen bg-[#f7f5ef] text-zinc-900">
      <header className="border-b border-amber-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
          <Link to="/participante" className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-bold text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700">
            <ArrowLeft aria-hidden="true" className="size-4" /> Voltar ao portal
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,430px)] lg:gap-12 lg:py-12">
        <section aria-labelledby="raffle-share-title" className="min-w-0">
          <div className="mb-7 flex size-12 items-center justify-center rounded-xl bg-amber-200 text-amber-900">
            <Ticket aria-hidden="true" className="size-6" />
          </div>
          <h1 id="raffle-share-title" className="max-w-2xl font-display text-3xl font-bold leading-tight text-zinc-950 sm:text-4xl">
            Sua rifa ajuda o coro a chegar ao encontro
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-700">
            Gere um card com o seu QR Code Pix para divulgar a venda das rifas.
          </p>

          {loading ? <p role="status" className="mt-8 text-sm text-zinc-700">Carregando seu coro…</p> : participant ? (
            <p className="mt-8 rounded-xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-950">
              A imagem vai convidar as pessoas a ajudar o {participant.registration.choirName}, em nome de {participant.identity.name}.
            </p>
          ) : null}

          <form className="mt-8 max-w-xl space-y-5" onSubmit={(event) => void generate(event)}>
            <div>
              <label htmlFor="raffle-pix-key" className="mb-2 block text-sm font-bold text-zinc-900">Chave Pix</label>
              <input id="raffle-pix-key" autoComplete="off" value={pixKey} maxLength={77} onChange={(event) => { setPixKey(event.target.value); setFile(null); setPreviewUrl(""); }} placeholder="E-mail, telefone com +55, CPF/CNPJ ou chave aleatória" className="min-h-12 w-full rounded-xl border border-zinc-300 bg-white px-4 text-zinc-950 outline-none placeholder:text-zinc-500 focus:border-amber-700 focus:ring-2 focus:ring-amber-200" aria-describedby="pix-help" />
              <p id="pix-help" className="mt-2 text-xs leading-5 text-zinc-600">
                Confira sua chave antes de compartilhar. O banco mostrará ao comprador o nome do titular cadastrado para confirmar o pagamento.
              </p>
            </div>
            <Button type="submit" disabled={!canGenerate} className="min-h-12 w-full bg-zinc-900 font-bold text-white hover:bg-zinc-700 sm:w-auto sm:px-8">
              {creating ? <LoaderCircle aria-hidden="true" className="mr-2 size-4 animate-spin" /> : null}
              {creating ? "Gerando imagem…" : "Gerar imagem"}
            </Button>
          </form>

          {error ? <p role="alert" className="mt-5 max-w-xl rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</p> : null}
          <p className="mt-6 max-w-xl text-xs leading-5 text-zinc-600">
            O QR Pix fica sem valor fixo para que cada pessoa escolha quantas rifas quer apoiar. Combine os números vendidos e confirme o recebimento do Pix antes de entregar as rifas.
          </p>
        </section>

        <aside className="min-w-0">
          <div className="mx-auto flex max-w-[430px] flex-wrap gap-3">
            {previewUrl && file ? (
              <a href={previewUrl} download={file.name} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 text-sm font-bold text-zinc-950 hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700">
                <Download aria-hidden="true" className="size-4" /> Baixar imagem
              </a>
            ) : (
              <Button type="button" disabled className="min-h-11 flex-1 gap-2 rounded-xl bg-amber-400 font-bold text-zinc-950">
                <Download aria-hidden="true" className="size-4" /> Baixar imagem
              </Button>
            )}
            <Button type="button" onClick={() => void share()} disabled={!file} variant="outline" className="min-h-11 flex-1 gap-2 rounded-xl border-zinc-300">
              <Share2 aria-hidden="true" className="size-4" /> Compartilhar
            </Button>
          </div>
          {!file ? <p className="mx-auto mt-2 max-w-[430px] text-center text-xs text-zinc-600">Informe sua chave Pix e gere a imagem para liberar o download.</p> : null}
          <div className="mx-auto mt-4 max-w-[430px] overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-[0_16px_40px_-18px_rgba(50,32,0,.28)]">
            {previewUrl ? (
              <img src={previewUrl} alt="Arte da rifa beneficente pronta para compartilhar" className="aspect-[9/16] w-full object-contain" />
            ) : (
              <div className="flex aspect-[9/16] flex-col items-center justify-center bg-gradient-to-b from-amber-50 via-[#fff6db] to-amber-200 px-8 text-center">
                <Ticket aria-hidden="true" className="mb-5 size-10 text-amber-800" />
                <p className="font-display text-2xl font-bold text-zinc-900">Sua arte aparece aqui</p>
                <p className="mt-3 text-sm leading-6 text-zinc-700">Informe sua chave Pix para criar a imagem de celular com QR Code.</p>
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
