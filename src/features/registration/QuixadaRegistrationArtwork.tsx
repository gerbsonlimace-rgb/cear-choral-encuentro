import { useEffect, useRef } from "react";

import { drawQuixadaFrameArtwork } from "@/features/photo-art/quixada-style/drawQuixadaFrameArtwork";

/** Uses the photo frame's original drawing, with its complete landscape in view. */
export function QuixadaRegistrationArtwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(0, -630);
    drawQuixadaFrameArtwork(ctx, {
      width: 1080,
      height: 1350,
      frame: { x: 105, y: 228, width: 870, height: 735 },
    });
    ctx.restore();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={1080}
      height={360}
      aria-hidden="true"
      className="pointer-events-none mx-auto mt-4 block h-auto w-full max-w-6xl"
    />
  );
}
