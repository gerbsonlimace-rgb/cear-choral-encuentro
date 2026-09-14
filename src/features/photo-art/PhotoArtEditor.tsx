import { Check, Download, ImagePlus, LoaderCircle, Move, RotateCcw, Share2 } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent } from "react";

import darkLogoUrl from "@/assets/logo-coros-preto.png";
import lightLogoUrl from "@/assets/logo-coros-branco.png";
import { Button } from "@/components/ui/button";

import {
  ART_FORMATS,
  ART_PHRASES,
  ART_STYLES,
  DEFAULT_ADJUSTMENT,
  canvasToPhotoFile,
  downloadPhotoFile,
  loadImage,
  loadPhoto,
  sharePhotoFile,
  type ArtFormat,
  type ArtPhrase,
  type ArtStyle,
  type PhotoAdjustment,
} from "./photoArt";
import { renderPhotoArt, type ArtAssets } from "./renderPhotoArt";

type DragState = {
  pointerId: number;
  clientX: number;
  clientY: number;
  adjustment: PhotoAdjustment;
};

const SAMPLE_MODELS = [
  { src: "/photo-art-samples/homem.webp", label: "homem" },
  { src: "/photo-art-samples/mulher.webp", label: "mulher" },
  { src: "/photo-art-samples/homem-pardo.webp", label: "homem pardo" },
  { src: "/photo-art-samples/mulher-parda.webp", label: "mulher parda" },
] as const;

function StyleSample({ style, index, name }: { style: ArtStyle; index: number; name: string }) {
  const model = SAMPLE_MODELS[index % SAMPLE_MODELS.length];

  return (
    <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-[#f3efe5]">
      <img
        src={model.src}
        alt={["Modelo de exemplo", model.label, "na moldura", name].join(" ")}
        className="size-full object-cover"
        loading="lazy"
        decoding="async"
      />

      {style === "classica" && (
        <>
          <div className="absolute inset-2 rounded-lg border-[3px] border-[#ffc400] shadow-[0_0_0_5px_rgba(9,9,11,0.92)]" />
          <div className="absolute inset-x-0 bottom-0 h-[22%] bg-zinc-950" />
          <div className="absolute bottom-[15%] left-[14%] h-1.5 w-[48%] bg-[#ffc400]" />
        </>
      )}
      {style === "leve" && (
        <>
          <div className="absolute -right-7 -top-5 size-20 rounded-full bg-[#ffc400]/90" />
          <div className="absolute inset-x-0 bottom-0 h-[25%] rounded-t-[70%] bg-sky-100/95" />
          <div className="absolute inset-3 rounded-[1.25rem] border-2 border-white/90" />
        </>
      )}
      {style === "criativa" && (
        <>
          <div className="absolute -left-8 top-[12%] size-20 rounded-full bg-[#ffc400]" />
          <div className="absolute right-3 top-3 size-7 rotate-12 bg-zinc-950" />
          <div className="absolute inset-x-3 bottom-3 h-8 rounded-full border-2 border-dashed border-zinc-950 bg-white/85" />
        </>
      )}
      {style === "amarela" && (
        <>
          <div className="absolute inset-0 border-[10px] border-[#ffc400]" />
          <div className="absolute inset-x-2 bottom-2 h-[22%] bg-[#ffc400]" />
          <div className="absolute bottom-[14%] left-[18%] h-1.5 w-[58%] bg-zinc-950" />
        </>
      )}
      {style === "melodia" && (
        <>
          <div className="absolute -right-9 top-[9%] size-24 rounded-full border-[10px] border-[#ffc400]/80" />
          <div className="absolute inset-x-0 bottom-0 h-[27%] bg-white/90" />
          <div className="absolute bottom-[13%] left-[15%] right-[15%] space-y-1">
            <div className="h-px bg-zinc-700/60" />
            <div className="h-px bg-zinc-700/60" />
            <div className="h-px bg-zinc-700/60" />
          </div>
          <span className="absolute bottom-[12%] right-[24%] text-xl font-black text-zinc-950">
            ♪
          </span>
        </>
      )}
      {style === "quixada" && (
        <>
          <div className="absolute inset-2 rounded-[1.25rem] border-2 border-[#ffc400]" />
          <div className="absolute inset-x-0 bottom-0 h-[27%] bg-sky-100/95" />
          <div className="absolute -bottom-2 left-[17%] h-14 w-20 rounded-t-[70%] bg-[#ad7043]" />
          <div className="absolute bottom-1 right-[15%] h-16 w-9 border-x-2 border-t-2 border-zinc-900 [clip-path:polygon(50%_0,100%_100%,0_100%)]" />
          <div className="absolute bottom-[20%] left-0 h-1.5 w-[58%] -rotate-6 bg-white shadow-[0_2px_0_#b96f3d]" />
        </>
      )}
    </div>
  );
}

function clamp(value: number) {
  return Math.max(-1, Math.min(1, value));
}

export function PhotoArtEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [assets, setAssets] = useState<ArtAssets | null>(null);
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [style, setStyle] = useState<ArtStyle>("classica");
  const [phrase, setPhrase] = useState<ArtPhrase>("eu-vou");
  const [format, setFormat] = useState<ArtFormat>("feed");
  const [adjustment, setAdjustment] = useState<PhotoAdjustment>(DEFAULT_ADJUSTMENT);
  const [outputFile, setOutputFile] = useState<File | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadImage(darkLogoUrl), loadImage(lightLogoUrl)])
      .then(([darkLogo, lightLogo]) => {
        if (!cancelled) setAssets({ darkLogo, lightLogo });
      })
      .catch(() => {
        if (!cancelled)
          setError("Não foi possível carregar o logo do encontro. Recarregue a página.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !assets) return;
    renderPhotoArt(canvas, { photo, assets, style, phrase, format, adjustment });
    setOutputFile(null);
    if (!photo) return;

    let cancelled = false;
    setPreparing(true);
    canvasToPhotoFile(canvas, style, format)
      .then((file) => {
        if (!cancelled) setOutputFile(file);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Não foi possível gerar a imagem.");
        }
      })
      .finally(() => {
        if (!cancelled) setPreparing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [photo, assets, style, phrase, format, adjustment]);

  async function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    setNotice(null);
    setPreparing(true);
    try {
      setPhoto(await loadPhoto(file));
      setAdjustment(DEFAULT_ADJUSTMENT);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível abrir essa foto.");
    } finally {
      setPreparing(false);
    }
  }

  function startDrag(event: PointerEvent<HTMLCanvasElement>) {
    if (!photo) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      adjustment,
    };
  }

  function movePhoto(event: PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setAdjustment((current) => ({
      ...current,
      x: clamp(drag.adjustment.x + ((event.clientX - drag.clientX) / bounds.width) * 2),
      y: clamp(drag.adjustment.y + ((event.clientY - drag.clientY) / bounds.height) * 2),
    }));
  }

  function stopDrag(event: PointerEvent<HTMLCanvasElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }

  function download() {
    if (!outputFile) return;
    downloadPhotoFile(outputFile);
    setNotice("Imagem baixada. Ela está pronta para publicar.");
  }

  async function share() {
    if (!outputFile) return;
    setError(null);
    setNotice(null);
    try {
      const result = await sharePhotoFile(outputFile);
      if (result === "shared") setNotice("Menu de compartilhamento aberto.");
      if (result === "unsupported") {
        setNotice("Seu navegador não oferece o compartilhamento direto. Use Baixar imagem.");
      }
    } catch {
      setError("Não foi possível compartilhar. Você ainda pode baixar a imagem.");
    }
  }

  const actionsDisabled = !photo || !outputFile || preparing;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-32 pt-5 sm:px-6 sm:pt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start lg:gap-10 lg:pb-12">
      <div className="mx-auto w-full max-w-[31rem] lg:sticky lg:top-24">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold tracking-[0.15em] text-zinc-500 uppercase">
              Prévia
            </p>
            <p className="mt-0.5 text-sm text-zinc-600">Arraste a foto para enquadrar</p>
          </div>
          {photo && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-full"
              onClick={() => setAdjustment(DEFAULT_ADJUSTMENT)}
            >
              <RotateCcw aria-hidden="true" className="size-4" />
              Recomeçar
            </Button>
          )}
        </div>
        <div className="overflow-hidden rounded-[1.75rem] border border-zinc-200 bg-zinc-100 p-2 shadow-[0_18px_50px_rgba(0,0,0,0.14)]">
          <canvas
            ref={canvasRef}
            aria-label="Prévia da arte com sua foto"
            className={`block h-auto w-full rounded-[1.25rem] touch-none bg-black ${photo ? "cursor-move" : ""}`}
            onPointerDown={startDrag}
            onPointerMove={movePhoto}
            onPointerUp={stopDrag}
            onPointerCancel={stopDrag}
          />
        </div>
        {photo && (
          <div className="mt-3 rounded-2xl border border-zinc-200 bg-white p-3">
            <label className="flex items-center gap-3 text-sm font-semibold text-zinc-800">
              <Move aria-hidden="true" className="size-4 text-zinc-500" />
              Tamanho da foto
              <input
                type="range"
                min="1"
                max="2"
                step="0.02"
                value={adjustment.zoom}
                className="h-10 min-w-0 flex-1 accent-[#d8a900]"
                onChange={(event) =>
                  setAdjustment((current) => ({ ...current, zoom: Number(event.target.value) }))
                }
              />
            </label>
          </div>
        )}
      </div>

      <div className="mt-7 min-w-0 space-y-7 lg:mt-0">
        <header>
          <p className="text-xs font-extrabold tracking-[0.15em] text-[#9b7900] uppercase">
            Minha foto
          </p>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-zinc-950 sm:text-4xl">
            Crie sua foto do encontro
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Escolha uma foto, ajuste com o dedo e compartilhe sua arte. Sua foto permanece neste
            dispositivo.
          </p>
        </header>

        <div>
          <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#ffc400] px-5 py-3 text-base font-extrabold text-black shadow-sm transition hover:bg-[#f2ba00] focus-within:ring-2 focus-within:ring-black focus-within:ring-offset-2">
            <ImagePlus aria-hidden="true" className="size-5" />
            {photo ? "Trocar minha foto" : "Escolher uma foto"}
            <input
              type="file"
              aria-label="Escolher uma foto"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              className="sr-only"
              onChange={handlePhoto}
            />
          </label>
          <p className="mt-2 text-center text-xs text-zinc-500">
            JPG, PNG, WebP ou HEIC · até 20 MB
          </p>
        </div>

        <fieldset>
          <legend className="text-sm font-extrabold text-zinc-950">1. Escolha a moldura</legend>
          <p className="mt-1 text-xs text-zinc-500">
            Veja cada arte aplicada em um modelo de exemplo.
          </p>
          <div
            role="radiogroup"
            aria-label="Moldura"
            className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0"
          >
            {ART_STYLES.map((item, index) => {
              const selected = item.id === style;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={[item.name, item.description].join(": ")}
                  className={[
                    "relative w-36 shrink-0 snap-start overflow-hidden rounded-2xl border bg-white p-1.5 text-left text-zinc-900 transition sm:w-auto",
                    selected ? "border-black ring-2 ring-black ring-offset-2" : "border-zinc-200",
                  ].join(" ")}
                  onClick={() => setStyle(item.id)}
                >
                  {selected && (
                    <span className="absolute right-2.5 top-2.5 z-20 grid size-7 place-items-center rounded-full bg-zinc-950 shadow-md">
                      <Check aria-hidden="true" className="size-4 text-[#ffc400]" />
                    </span>
                  )}
                  <StyleSample style={item.id} index={index} name={item.name} />
                  <span className="block px-2 pt-2 text-sm font-extrabold">{item.name}</span>
                  <span className="block min-h-9 px-2 pb-1 pt-0.5 text-[11px] leading-4 text-zinc-500">
                    {item.description}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-extrabold text-zinc-950">2. Escolha a frase</legend>
          <div
            role="radiogroup"
            aria-label="Frase"
            className="mt-3 -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0"
          >
            {ART_PHRASES.map((item) => {
              const selected = item.id === phrase;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={item.text}
                  className={`min-h-16 w-[72vw] max-w-64 shrink-0 snap-start rounded-2xl border px-4 py-3 text-left text-sm font-bold leading-5 transition sm:w-auto ${selected ? "border-[#d3a500] bg-[#fff7d6] text-black ring-1 ring-[#d3a500]" : "border-zinc-200 bg-white text-zinc-700"}`}
                  onClick={() => setPhrase(item.id)}
                >
                  {item.text}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-extrabold text-zinc-950">3. Escolha o formato</legend>
          <div role="radiogroup" aria-label="Formato" className="mt-3 grid grid-cols-2 gap-2">
            {(Object.entries(ART_FORMATS) as [ArtFormat, (typeof ART_FORMATS)[ArtFormat]][]).map(
              ([id, item]) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={format === id}
                  aria-label={`${item.label}, formato ${item.ratio}`}
                  className={`min-h-12 rounded-xl border px-4 text-sm font-extrabold ${format === id ? "border-black bg-zinc-950 text-white" : "border-zinc-200 bg-white text-zinc-700"}`}
                  onClick={() => setFormat(id)}
                >
                  {item.label} <span className="font-normal opacity-70">{item.ratio}</span>
                </button>
              ),
            )}
          </div>
        </fieldset>

        <div aria-live="polite" className="min-h-6 text-sm">
          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 font-semibold text-red-700">{error}</p>
          )}
          {!error && notice && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-amber-900">{notice}</p>
          )}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(0,0,0,0.1)] backdrop-blur lg:static lg:col-start-2 lg:mt-7 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
        <div className="mx-auto grid max-w-md grid-cols-2 gap-2 lg:max-w-none">
          <Button
            type="button"
            aria-label="Baixar imagem"
            variant="outline"
            className="min-h-13 rounded-xl border-2 border-zinc-950 font-extrabold"
            disabled={actionsDisabled}
            onClick={download}
          >
            {preparing ? (
              <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
            ) : (
              <Download aria-hidden="true" className="size-5" />
            )}
            <span className="sm:hidden">Baixar</span>
            <span className="hidden sm:inline">Baixar imagem</span>
          </Button>
          <Button
            type="button"
            aria-label="Compartilhar imagem"
            className="min-h-13 rounded-xl bg-[#ffc400] font-extrabold text-black hover:bg-[#f2ba00]"
            disabled={actionsDisabled}
            onClick={share}
          >
            <Share2 aria-hidden="true" className="size-5" />
            <span className="sm:hidden">Compartilhar</span>
            <span className="hidden sm:inline">Compartilhar imagem</span>
          </Button>
        </div>
      </div>
    </section>
  );
}
