import { Check, Download, ImagePlus, LoaderCircle, Move, RotateCcw, Share2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent } from "react";

import { Button } from "@/components/ui/button";

import {
  DEFAULT_ADJUSTMENT,
  canvasToPhotoFile,
  downloadPhotoFile,
  loadImage,
  loadPhoto,
  sharePhotoFile,
  type PhotoAdjustment,
} from "./photoArt";
import { getReadyArt, READY_ARTS, type ReadyArtId } from "./readyArts";
import { renderReadyArt } from "./renderReadyArt";

type DragState = {
  pointerId: number;
  clientX: number;
  clientY: number;
  adjustment: PhotoAdjustment;
};

type TemplateAssets = {
  example: HTMLImageElement;
  overlay: HTMLImageElement;
};

function clamp(value: number) {
  return Math.max(-1, Math.min(1, value));
}

export function PhotoArtEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [artId, setArtId] = useState<ReadyArtId>("eu-vou");
  const [assets, setAssets] = useState<TemplateAssets | null>(null);
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [adjustment, setAdjustment] = useState<PhotoAdjustment>(DEFAULT_ADJUSTMENT);
  const [outputFile, setOutputFile] = useState<File | null>(null);
  const [loadingArt, setLoadingArt] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const selectedArt = useMemo(() => getReadyArt(artId), [artId]);

  useEffect(() => {
    let cancelled = false;
    setLoadingArt(true);
    setError(null);
    Promise.all([loadImage(selectedArt.exampleUrl), loadImage(selectedArt.overlayUrl)])
      .then(([example, overlay]) => {
        if (!cancelled) setAssets({ example, overlay });
      })
      .catch(() => {
        if (!cancelled) setError("Não foi possível carregar esta arte. Tente novamente.");
      })
      .finally(() => {
        if (!cancelled) setLoadingArt(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedArt]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !assets) return;
    renderReadyArt(canvas, { art: selectedArt, ...assets, photo, adjustment });
    setOutputFile(null);
    if (!photo) return;

    let cancelled = false;
    setPreparing(true);
    canvasToPhotoFile(canvas, selectedArt.id, "story")
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
  }, [photo, assets, selectedArt, adjustment]);

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

  function chooseArt(id: ReadyArtId) {
    setArtId(id);
    setAssets(null);
    setAdjustment(DEFAULT_ADJUSTMENT);
    setNotice(null);
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

  const actionsDisabled = !photo || !outputFile || preparing || loadingArt;

  return (
    <section className="photo-art-editor mx-auto w-full max-w-6xl px-3 pb-28 pt-3 sm:px-5 lg:grid lg:grid-cols-[minmax(0,1fr)_25rem] lg:items-start lg:gap-9 lg:pb-10 lg:pt-6">
      <div className="photo-art-intro">
        <header>
          <p className="text-xs font-extrabold tracking-[0.15em] text-[#9b7900] uppercase">
            Minha foto do encontro
          </p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-zinc-950 sm:text-3xl">
            Escolha uma arte pronta
          </h1>
          <p className="mt-1.5 text-sm leading-5 text-zinc-600">
            A moldura e a frase já estão prontas. Você só precisa inserir e ajustar sua foto.
          </p>
        </header>

      </div>

      <div className="photo-art-preview mx-auto w-full max-w-[28rem] lg:sticky lg:top-20">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold tracking-[0.15em] text-zinc-500 uppercase">
              Story 9:16
            </p>
            <p className="text-xs text-zinc-600">
              {photo ? "Arraste para reposicionar" : "Exemplo pronto da arte"}
            </p>
          </div>
          {photo && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-10 rounded-full"
              onClick={() => setAdjustment(DEFAULT_ADJUSTMENT)}
            >
              <RotateCcw aria-hidden="true" className="size-4" />
              Centralizar
            </Button>
          )}
        </div>

        <div className="relative flex h-auto min-h-0 max-h-[27rem] items-center justify-center overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.12)] lg:h-auto lg:max-h-[72vh] lg:min-h-0 lg:p-2">
          <canvas
            ref={canvasRef}
            aria-label="Prévia da arte pronta com sua foto"
            className={`block max-h-full max-w-full rounded-xl bg-white object-contain [aspect-ratio:9/16] ${photo ? "cursor-move touch-none" : ""}`}
            onPointerDown={startDrag}
            onPointerMove={movePhoto}
            onPointerUp={stopDrag}
            onPointerCancel={stopDrag}
          />
          {loadingArt && (
            <div className="absolute inset-1.5 grid place-items-center rounded-xl bg-white/85">
              <LoaderCircle aria-hidden="true" className="size-7 animate-spin text-[#b88e00]" />
              <span className="sr-only">Carregando arte</span>
            </div>
          )}
        </div>
      </div>

      <div className="photo-art-options mt-4 min-w-0 space-y-5 lg:mt-0">
        <fieldset>
          <legend className="text-sm font-extrabold text-zinc-950">1. Arte do encontro</legend>
          <div
            role="radiogroup"
            aria-label="Arte pronta"
            className="-mx-3 mt-2.5 flex snap-x gap-2.5 overflow-x-auto px-3 pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:px-0 lg:grid-cols-3"
          >
            {READY_ARTS.map((item) => {
              const selected = item.id === selectedArt.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`${item.name}: ${item.phrase}`}
                  className={`relative w-24 shrink-0 snap-start rounded-xl border bg-white p-1 text-left transition sm:w-auto ${selected ? "border-black ring-2 ring-black ring-offset-1" : "border-zinc-200"}`}
                  onClick={() => chooseArt(item.id)}
                >
                  {selected && (
                    <span className="absolute right-1.5 top-1.5 z-10 grid size-6 place-items-center rounded-full bg-black shadow">
                      <Check aria-hidden="true" className="size-3.5 text-[#ffc400]" />
                    </span>
                  )}
                  <img
                    src={item.thumbnailUrl}
                    alt={`Exemplo da arte ${item.name} com ${item.modelLabel}`}
                    className="aspect-[9/16] w-full rounded-lg object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                  <span className="block truncate px-1 pb-1 pt-1.5 text-[11px] font-extrabold">
                    {item.name}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div>
          <p className="text-sm font-extrabold text-zinc-950">2. Sua foto</p>
          <label className="mt-2.5 flex min-h-13 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#ffc400] px-5 py-3 text-sm font-extrabold text-black shadow-sm transition hover:bg-[#f2ba00] focus-within:ring-2 focus-within:ring-black focus-within:ring-offset-2">
            <ImagePlus aria-hidden="true" className="size-5" />
            {photo ? "Trocar foto" : "Inserir minha foto"}
            <input
              type="file"
              aria-label="Inserir minha foto"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              className="sr-only"
              onChange={handlePhoto}
            />
          </label>
          <p className="mt-1.5 text-center text-[11px] text-zinc-500">
            Sua foto permanece neste dispositivo.
          </p>
        </div>

        {photo && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-3.5">
            <div className="flex items-center gap-2 text-sm font-extrabold text-zinc-950">
              <Move aria-hidden="true" className="size-4" />
              3. Ajuste o enquadramento
            </div>
            <label className="mt-3 block text-xs font-bold text-zinc-600" htmlFor="photo-zoom">
              Tamanho da foto
            </label>
            <input
              id="photo-zoom"
              type="range"
              min="1"
              max="2.5"
              step="0.05"
              value={adjustment.zoom}
              className="mt-2 w-full accent-black"
              onChange={(event) =>
                setAdjustment((current) => ({ ...current, zoom: Number(event.target.value) }))
              }
            />
            <p className="mt-1 text-[11px] text-zinc-500">
              Arraste a foto na prévia para mover para os lados ou para cima e para baixo.
            </p>
          </div>
        )}

        <div aria-live="polite" className="min-h-5 text-sm">
          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 font-semibold text-red-700">{error}</p>
          )}
          {notice && !error && (
            <p className="rounded-xl bg-emerald-50 px-3 py-2 font-semibold text-emerald-800">
              {notice}
            </p>
          )}
          {preparing && !error && (
            <p className="flex items-center gap-2 text-zinc-600">
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
              Preparando imagem…
            </p>
          )}
        </div>
      </div>

      <div className="photo-art-actions fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur lg:static lg:col-start-2 lg:mt-5 lg:border-0 lg:bg-transparent lg:p-0">
        <div className="mx-auto grid max-w-md grid-cols-2 gap-2 lg:max-w-none">
          <Button
            type="button"
            variant="outline"
            aria-label="Baixar imagem"
            className="min-h-12 rounded-xl border-2 border-zinc-950 font-extrabold"
            disabled={actionsDisabled}
            onClick={download}
          >
            <Download aria-hidden="true" className="size-4" />
            Baixar
          </Button>
          <Button
            type="button"
            aria-label="Compartilhar imagem"
            className="min-h-12 rounded-xl bg-[#ffc400] font-extrabold text-black hover:bg-[#f2ba00]"
            disabled={actionsDisabled}
            onClick={() => void share()}
          >
            <Share2 aria-hidden="true" className="size-4" />
            Compartilhar
          </Button>
        </div>
      </div>
    </section>
  );
}
