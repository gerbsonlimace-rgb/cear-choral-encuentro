export type YoungArtworkFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type YoungFrameArtworkOptions = {
  width: number;
  height: number;
  frame: YoungArtworkFrame;
};

const YOUNG_PALETTE = {
  gold: "#ffc400",
  paleGold: "#fff0b8",
  warmWhite: "#fffdf8",
  charcoal: "#292929",
} as const;

function roundedFramePath(
  ctx: CanvasRenderingContext2D,
  frame: YoungArtworkFrame,
  padding: number,
  radius: number,
) {
  const x = frame.x - padding;
  const y = frame.y - padding;
  const width = frame.width + padding * 2;
  const height = frame.height + padding * 2;
  const corner = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + corner, y);
  ctx.lineTo(x + width - corner, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + corner);
  ctx.lineTo(x + width, y + height - corner);
  ctx.quadraticCurveTo(x + width, y + height, x + width - corner, y + height);
  ctx.lineTo(x + corner, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - corner);
  ctx.lineTo(x, y + corner);
  ctx.quadraticCurveTo(x, y, x + corner, y);
  ctx.closePath();
}

function drawOrganicAccents(
  ctx: CanvasRenderingContext2D,
  frame: YoungArtworkFrame,
  scale: number,
) {
  const right = frame.x + frame.width;
  const bottom = frame.y + frame.height;

  ctx.fillStyle = YOUNG_PALETTE.paleGold;
  ctx.beginPath();
  ctx.moveTo(right - 172 * scale, frame.y - 17 * scale);
  ctx.bezierCurveTo(
    right - 88 * scale,
    frame.y - 70 * scale,
    right + 70 * scale,
    frame.y - 28 * scale,
    right + 48 * scale,
    frame.y + 80 * scale,
  );
  ctx.bezierCurveTo(
    right + 36 * scale,
    frame.y + 137 * scale,
    right - 32 * scale,
    frame.y + 154 * scale,
    right - 74 * scale,
    frame.y + 99 * scale,
  );
  ctx.bezierCurveTo(
    right - 116 * scale,
    frame.y + 45 * scale,
    right - 239 * scale,
    frame.y + 25 * scale,
    right - 172 * scale,
    frame.y - 17 * scale,
  );
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = YOUNG_PALETTE.gold;
  ctx.beginPath();
  ctx.moveTo(frame.x - 47 * scale, bottom - 123 * scale);
  ctx.bezierCurveTo(
    frame.x + 6 * scale,
    bottom - 171 * scale,
    frame.x + 145 * scale,
    bottom - 128 * scale,
    frame.x + 164 * scale,
    bottom - 55 * scale,
  );
  ctx.bezierCurveTo(
    frame.x + 178 * scale,
    bottom,
    frame.x + 108 * scale,
    bottom + 49 * scale,
    frame.x + 33 * scale,
    bottom + 22 * scale,
  );
  ctx.bezierCurveTo(
    frame.x - 37 * scale,
    bottom - 3 * scale,
    frame.x - 104 * scale,
    bottom - 72 * scale,
    frame.x - 47 * scale,
    bottom - 123 * scale,
  );
  ctx.closePath();
  ctx.fill();
}

function drawMusicalDetails(
  ctx: CanvasRenderingContext2D,
  frame: YoungArtworkFrame,
  width: number,
  height: number,
  scale: number,
) {
  const staffX = frame.x + frame.width * 0.5;
  const staffWidth = Math.min(frame.width * 0.58, width - staffX + 34 * scale);
  const staffY = Math.min(frame.y + frame.height + 74 * scale, height - 92 * scale);

  ctx.strokeStyle = YOUNG_PALETTE.charcoal;
  ctx.lineWidth = 3 * scale;
  ctx.lineCap = "round";
  ctx.globalAlpha = 0.28;
  for (let line = 0; line < 5; line += 1) {
    const lineY = staffY + line * 13 * scale;
    ctx.beginPath();
    ctx.moveTo(staffX, lineY);
    ctx.bezierCurveTo(
      staffX + staffWidth * 0.27,
      lineY - 24 * scale,
      staffX + staffWidth * 0.66,
      lineY + 25 * scale,
      staffX + staffWidth,
      lineY - 5 * scale,
    );
    ctx.stroke();
  }

  ctx.globalAlpha = 0.78;
  ctx.fillStyle = YOUNG_PALETTE.charcoal;
  ctx.beginPath();
  for (const [noteX, noteY] of [
    [staffX + staffWidth * 0.22, staffY + 38 * scale],
    [staffX + staffWidth * 0.56, staffY + 7 * scale],
    [staffX + staffWidth * 0.82, staffY + 30 * scale],
  ] as const) {
    ctx.moveTo(noteX + 9 * scale, noteY);
    ctx.lineTo(noteX + 9 * scale, noteY - 47 * scale);
    ctx.ellipse(noteX, noteY, 10 * scale, 7 * scale, -0.35, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.stroke();
}

function drawConfettiDots(ctx: CanvasRenderingContext2D, frame: YoungArtworkFrame, scale: number) {
  const dots = [
    [frame.x - 27 * scale, frame.y + 93 * scale, 7 * scale, YOUNG_PALETTE.gold],
    [frame.x + 14 * scale, frame.y - 35 * scale, 5 * scale, YOUNG_PALETTE.charcoal],
    [
      frame.x + frame.width + 25 * scale,
      frame.y + frame.height * 0.45,
      6 * scale,
      YOUNG_PALETTE.gold,
    ],
    [
      frame.x + frame.width - 38 * scale,
      frame.y + frame.height + 34 * scale,
      4 * scale,
      YOUNG_PALETTE.charcoal,
    ],
  ] as const;

  ctx.globalAlpha = 0.78;
  for (const [x, y, radius, color] of dots) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, radius, radius, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Draws the decoration for the light, youthful photo style.
 * Call it after painting the participant photo and before drawing the official logo and text.
 */
export function drawYoungFrameArtwork(
  ctx: CanvasRenderingContext2D,
  { width, height, frame }: YoungFrameArtworkOptions,
) {
  const scale = Math.max(0.1, Math.min(width / 1080, height / 1350));

  ctx.save();
  ctx.lineJoin = "round";

  drawOrganicAccents(ctx, frame, scale);

  roundedFramePath(ctx, frame, 8 * scale, 43 * scale);
  ctx.strokeStyle = YOUNG_PALETTE.gold;
  ctx.lineWidth = 3 * scale;
  ctx.globalAlpha = 0.92;
  ctx.shadowColor = YOUNG_PALETTE.warmWhite;
  ctx.shadowBlur = 18 * scale;
  ctx.setLineDash([22 * scale, 12 * scale]);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.setLineDash([]);

  drawMusicalDetails(ctx, frame, width, height, scale);
  drawConfettiDots(ctx, frame, scale);
  ctx.restore();
}
