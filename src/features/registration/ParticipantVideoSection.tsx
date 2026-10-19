// ============= Section de vídeo: como funciona o app do participante =============
import videoPointer from "@/assets/videos/app-participante-reels-v5.mp4.asset.json";

export function ParticipantVideoSection() {
  return (
    <section
      aria-labelledby="participant-video-title"
      className="mx-auto w-full max-w-5xl px-4 pb-12 sm:px-6"
    >
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6 text-center shadow-sm sm:p-8">
        <h2
          id="participant-video-title"
          className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
        >
          Veja como funciona o app do participante
        </h2>
        <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
          Após a inscrição, acompanhe agenda, partituras, áudios dos cantos e
          sua foto do encontro direto do celular.
        </p>
        <video
          className="mt-2 w-full max-w-sm rounded-xl border border-border bg-background shadow-md"
          src={videoPointer.url}
          controls
          playsInline
          preload="metadata"
          aria-label="Vídeo mostrando como usar o app do participante"
        />
        <p className="text-xs text-muted-foreground">
          Duração de cerca de 1 minuto — toque no play para assistir.
        </p>
      </div>
    </section>
  );
}
