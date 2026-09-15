import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  ImagePlus,
  LoaderCircle,
  Move,
  RotateCcw,
  Share2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent } from "react";

import { Button } from "@/components/ui/button";

import {
  DEFAULT_ADJUSTMENT,
  canvasToPhotoFile,
  detectFaceAdjustment,
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
  overlay: HTMLImageElement;
};

type WizardStep = 1 | 2 | 3;
type FramingStatus = "idle" | "detecting" | "face" | "manual";

const STEP_LABELS = ["Arte", "Foto e ajuste", "Publicar"] as const;

const STEP_CONTENT: Record<WizardStep, { title: string; description: string }> = {
  1: {
    title: "Escolha uma arte",
    description: "A moldura, a frase e o formato de Story já estão prontos.",
  },
  2: {
    title: "Foto e ajuste",
    description: "Insira, aumente e arraste sua foto na própria moldura.",
  },
  3: {
    title: "Sua arte está pronta",
    description: "Baixe ou publique seu Story pelo menu de compartilhamento do celular.",
  },
};

function clamp(value: number) {
  return Math.max(-1, Math.min(1, value));
}

export function PhotoArtEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [step, setStep] = useState<WizardStep>(1);
  const [artId, setArtId] = useState<ReadyArtId>("eu-vou");
  const [assets, setAssets] = useState<TemplateAssets | null>(null);
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [adjustment, setAdjustment] = useState<PhotoAdjustment>(DEFAULT_ADJUSTMENT);
  const [autoAdjustment, setAutoAdjustment] = useState<PhotoAdjustment | null>(null);
  const [framingStatus, setFramingStatus] = useState<FramingStatus>("idle");
  const [outputFile, setOutputFile] = useState<File | null>(null);
  const [loadingArt, setLoadingArt] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const selectedArt = useMemo(() => getReadyArt(artId), [artId]);
  const stepContent = STEP_CONTENT[step];
  const previewVisible = step > 1;

  useEffect(() => {
    let cancelled = false;
    setLoadingArt(true);
    setError(null);
    loadImage(selectedArt.overlayUrl)
      .then((overlay) => {
        if (!cancelled) setAssets({ overlay });
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
    if (!photo) return;
    let cancelled = false;
    void detectFaceAdjustment(photo, selectedArt.photoFrame).then((faceAdjustment) => {
      if (cancelled) return;
      setAutoAdjustment(faceAdjustment);
      setAdjustment(faceAdjustment ?? DEFAULT_ADJUSTMENT);
      setFramingStatus(faceAdjustment ? "face" : "manual");
    });
    return () => {
      cancelled = true;
    };
  }, [photo, selectedArt]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !assets || !previewVisible) return;
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
  }, [photo, assets, selectedArt, adjustment, previewVisible]);

  async function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    setNotice(null);
    setOutputFile(null);
    setPreparing(true);
    try {
      const loadedPhoto = await loadPhoto(file);
      setAutoAdjustment(null);
      setFramingStatus("detecting");
      setAdjustment(DEFAULT_ADJUSTMENT);
      setPhoto(loadedPhoto);
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
    setAutoAdjustment(null);
    if (photo) setFramingStatus("detecting");
    setOutputFile(null);
    setNotice(null);
  }

  function startDrag(event: PointerEvent<HTMLCanvasElement>) {
    if (!photo || step !== 2 || framingStatus === "detecting") return;
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

  function goBack() {
    setError(null);
    setNotice(null);
    setStep((current) => Math.max(1, current - 1) as WizardStep);
  }

  function goForward() {
    setError(null);
    setNotice(null);
    setStep((current) => Math.min(3, current + 1) as WizardStep);
  }

  function download() {
    if (!outputFile) return;
    downloadPhotoFile(outputFile);
    setNotice("Imagem baixada. Publique nos Stories e marque @corodiocesanoqxd.");
  }

  async function share() {
    if (!outputFile) return;
    setError(null);
    setNotice(null);
    try {
      const result = await sharePhotoFile(outputFile);
      if (result === "shared") {
        setNotice("Escolha o Instagram e marque @corodiocesanoqxd.");
      }
      if (result === "unsupported") {
        setNotice("Baixe a imagem, abra o Instagram e marque @corodiocesanoqxd.");
      }
    } catch {
      setError("Não foi possível compartilhar. Baixe a imagem e publique pelo Instagram.");
    }
  }

  const outputPending =
    !photo || !outputFile || preparing || loadingArt || framingStatus === "detecting";

  return (
    <section className="photo-art-editor mx-auto w-full max-w-6xl px-3 pb-28 pt-3 sm:px-5 lg:pb-10 lg:pt-6">
      <div className="photo-art-intro mx-auto max-w-3xl">
        <header>
          <p className="text-xs font-extrabold tracking-[0.15em] text-[#9b7900] uppercase">
            Minha foto do encontro
          </p>
          <p className="mt-2 text-xs font-extrabold text-zinc-500">Etapa {step} de 3</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-zinc-950 sm:text-3xl">
            {stepContent.title}
          </h1>
          <p
            className={`mt-1.5 text-sm leading-5 text-zinc-600 ${step > 1 ? "hidden sm:block" : ""}`}
          >
            {stepContent.description}
          </p>
        </header>

        <ol aria-label="Progresso da criação" className="mt-3 grid grid-cols-3 gap-1.5">
          {STEP_LABELS.map((label, index) => {
            const itemStep = (index + 1) as WizardStep;
            const complete = itemStep < step;
            const active = itemStep === step;
            return (
              <li key={label} aria-current={active ? "step" : undefined}>
                <span
                  className={`block h-1.5 rounded-full ${itemStep <= step ? "bg-[#ffc400]" : "bg-zinc-200"}`}
                />
                <span
                  className={`mt-1 block text-center text-[10px] font-bold ${active ? "text-zinc-950" : "text-zinc-500"}`}
                >
                  {complete && <span className="sr-only">Concluída: </span>}
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {step === 1 ? (
        <div className="photo-art-options mx-auto mt-5 max-w-3xl">
          <fieldset>
            <legend className="sr-only">Arte pronta</legend>
            <div
              role="radiogroup"
              aria-label="Arte pronta"
              className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3"
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
                    className={`relative min-w-0 rounded-xl border bg-white p-1 text-left transition ${selected ? "border-black ring-2 ring-black ring-offset-1" : "border-zinc-200"}`}
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
        </div>
      ) : (
        <div className="photo-art-workspace mt-2 lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-9">
          <div className="photo-art-preview mx-auto w-full max-w-[28rem] lg:sticky lg:top-20">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold tracking-[0.15em] text-zinc-500 uppercase">
                  Story 9:16
                </p>
                <p className="text-xs text-zinc-600">
                  {step === 2 && (photo ? "Arraste para reposicionar" : "Insira sua foto")}
                  {step === 3 && "Pronta para publicar"}
                </p>
              </div>
            </div>

            <div className="photo-art-stage relative flex items-center justify-center overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.12)] lg:p-2">
              <canvas
                ref={canvasRef}
                aria-label="Prévia da arte pronta com sua foto"
                className={`block max-h-full max-w-full rounded-xl bg-white object-contain [aspect-ratio:9/16] ${step === 2 && photo ? "cursor-move touch-none" : ""}`}
                onPointerDown={startDrag}
                onPointerMove={movePhoto}
                onPointerUp={stopDrag}
                onPointerCancel={stopDrag}
              />
              {loadingArt && (
                <div className="absolute inset-1.5 z-30 grid place-items-center rounded-xl bg-white/85">
                  <LoaderCircle aria-hidden="true" className="size-7 animate-spin text-[#b88e00]" />
                  <span className="sr-only">Carregando arte</span>
                </div>
              )}

              {step === 2 && (
                <div className="pointer-events-none absolute inset-2 z-20 flex flex-col justify-between">
                  <div className="flex items-start justify-between gap-2">
                    <label className="pointer-events-auto inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-[#ffc400] px-4 py-2 text-xs font-extrabold text-black shadow-lg focus-within:ring-2 focus-within:ring-black focus-within:ring-offset-2">
                      <ImagePlus aria-hidden="true" className="size-4" />
                      {photo ? "Trocar foto" : "Inserir foto"}
                      <input
                        type="file"
                        aria-label="Inserir minha foto"
                        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                        className="sr-only"
                        onChange={handlePhoto}
                      />
                    </label>
                    {photo && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="pointer-events-auto min-h-11 rounded-full bg-white/95 px-3 font-extrabold shadow-lg"
                        disabled={framingStatus === "detecting"}
                        onClick={() => setAdjustment(autoAdjustment ?? DEFAULT_ADJUSTMENT)}
                      >
                        <RotateCcw aria-hidden="true" className="size-4" />
                        Centralizar
                      </Button>
                    )}
                  </div>

                  <div className="pointer-events-auto rounded-xl bg-black/80 px-3 py-2.5 text-white shadow-xl backdrop-blur">
                    <div className="flex items-center justify-between gap-3">
                      <label
                        className="flex items-center gap-1.5 text-xs font-extrabold"
                        htmlFor="photo-zoom"
                      >
                        <Move aria-hidden="true" className="size-4" />
                        Tamanho da foto
                      </label>
                      <span className="text-[10px] text-white/75">
                        {framingStatus === "detecting" && "Localizando rosto…"}
                        {framingStatus === "face" && "Rosto centralizado • arraste para mover"}
                        {framingStatus === "manual" && "Arraste para mover"}
                        {framingStatus === "idle" && "Insira a foto para ajustar"}
                      </span>
                    </div>
                    <input
                      id="photo-zoom"
                      type="range"
                      min="1"
                      max="2.5"
                      step="0.05"
                      value={adjustment.zoom}
                      disabled={!photo || framingStatus === "detecting"}
                      className="mt-1 h-7 w-full accent-[#ffc400] disabled:opacity-40"
                      onChange={(event) =>
                        setAdjustment((current) => ({
                          ...current,
                          zoom: Number(event.target.value),
                        }))
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="photo-art-options mt-4 min-w-0 space-y-4 lg:mt-0">
            {step === 3 && (
              <div className="rounded-2xl bg-[#fff4bf] p-4 ring-1 ring-[#e2bd23]">
                <p className="font-display text-lg font-extrabold text-zinc-950">
                  Compartilhe nos Stories
                </p>
                <p className="mt-1 text-sm leading-5 text-zinc-700">
                  Escolha o Instagram no menu de compartilhamento e marque{" "}
                  <strong>@corodiocesanoqxd</strong>.
                </p>
                <button
                  type="button"
                  className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-extrabold text-zinc-700 underline underline-offset-4"
                  onClick={goBack}
                >
                  <ArrowLeft aria-hidden="true" className="size-4" />
                  Voltar e ajustar
                </button>
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
        </div>
      )}

      <div className="photo-art-actions fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur lg:static lg:mx-auto lg:mt-6 lg:max-w-3xl lg:border-0 lg:bg-transparent lg:p-0">
        {step === 1 && (
          <Button
            type="button"
            aria-label="Continuar para foto"
            className="mx-auto min-h-12 w-full max-w-md rounded-xl bg-[#ffc400] font-extrabold text-black hover:bg-[#f2ba00]"
            onClick={goForward}
          >
            Continuar
            <ArrowRight aria-hidden="true" className="size-4" />
          </Button>
        )}

        {step === 2 && (
          <div className="mx-auto grid max-w-md grid-cols-[auto_1fr] gap-2">
            <Button
              type="button"
              variant="outline"
              aria-label="Voltar"
              className="min-h-12 rounded-xl border-2 border-zinc-950 px-4 font-extrabold"
              onClick={goBack}
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              <span className="sr-only sm:not-sr-only">Voltar</span>
            </Button>
            <Button
              type="button"
              aria-label="Continuar para compartilhar"
              className="min-h-12 rounded-xl bg-[#ffc400] font-extrabold text-black hover:bg-[#f2ba00]"
              disabled={outputPending}
              onClick={goForward}
            >
              Ver resultado
              <ArrowRight aria-hidden="true" className="size-4" />
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="mx-auto grid max-w-md grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              aria-label="Baixar imagem"
              className="min-h-12 rounded-xl border-2 border-zinc-950 font-extrabold"
              disabled={outputPending}
              onClick={download}
            >
              <Download aria-hidden="true" className="size-4" />
              Baixar
            </Button>
            <Button
              type="button"
              aria-label="Compartilhar no Instagram"
              className="min-h-12 rounded-xl bg-[#ffc400] px-2 font-extrabold text-black hover:bg-[#f2ba00]"
              disabled={outputPending}
              onClick={() => void share()}
            >
              <Share2 aria-hidden="true" className="size-4" />
              Instagram
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
