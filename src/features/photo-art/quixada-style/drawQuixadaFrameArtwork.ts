import type { PhotoRect } from "../photoArt";

type QuixadaFrameArtworkOptions = {
  width: number;
  height: number;
  frame: PhotoRect;
};

const SAND = "#d48b4e";
const DEEP_SAND = "#8e492d";
const WATER = "#d9f0f3";
const BLUE = "#3a8a9c";
const GOLD = "#ffc400";
const INK = "#171717";

function drawWater(ctx: CanvasRenderingContext2D, frame: PhotoRect, scale: number) {
  const waterTop = frame.y + frame.height * 0.79;
  ctx.fillStyle = "rgba(217,240,243,.88)";
  ctx.beginPath();
  ctx.moveTo(frame.x, waterTop);
  ctx.bezierCurveTo(
    frame.x + frame.width * 0.2,
    waterTop - 24 * scale,
    frame.x + frame.width * 0.36,
    waterTop + 32 * scale,
    frame.x + frame.width * 0.55,
    waterTop,
  );
  ctx.bezierCurveTo(
    frame.x + frame.width * 0.72,
    waterTop - 28 * scale,
    frame.x + frame.width * 0.86,
    waterTop + 18 * scale,
    frame.x + frame.width,
    waterTop - 7 * scale,
  );
  ctx.lineTo(frame.x + frame.width, frame.y + frame.height);
  ctx.lineTo(frame.x, frame.y + frame.height);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = BLUE;
  ctx.lineWidth = 3 * scale;
  ctx.globalAlpha = 0.78;
  for (let line = 0; line < 4; line += 1) {
    const y = waterTop + (35 + line * 29) * scale;
    ctx.beginPath();
    ctx.moveTo(frame.x + 36 * scale, y);
    ctx.bezierCurveTo(
      frame.x + frame.width * 0.3,
      y - 18 * scale,
      frame.x + frame.width * 0.65,
      y + 18 * scale,
      frame.x + frame.width - 34 * scale,
      y,
    );
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const damStartX = frame.x - 16 * scale;
  const damEndX = frame.x + frame.width * 0.37;
  const damY = waterTop + 18 * scale;
  ctx.fillStyle = "rgba(212,139,78,.94)";
  ctx.strokeStyle = DEEP_SAND;
  ctx.lineWidth = 3 * scale;
  ctx.beginPath();
  ctx.moveTo(damStartX, damY + 88 * scale);
  ctx.bezierCurveTo(
    damStartX + 110 * scale,
    damY + 55 * scale,
    damEndX - 92 * scale,
    damY + 20 * scale,
    damEndX,
    damY - 9 * scale,
  );
  ctx.lineTo(damEndX - 5 * scale, damY + 22 * scale);
  ctx.bezierCurveTo(
    damEndX - 105 * scale,
    damY + 55 * scale,
    damStartX + 112 * scale,
    damY + 105 * scale,
    damStartX,
    damY + 130 * scale,
  );
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "#fffdf7";
  ctx.lineWidth = 4 * scale;
  for (let post = 0; post < 9; post += 1) {
    const progress = post / 8;
    const x = damStartX + (damEndX - damStartX) * progress;
    const y = damY + 83 * scale - progress * 91 * scale;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 30 * scale);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(damStartX, damY + 52 * scale);
  ctx.bezierCurveTo(
    damStartX + 105 * scale,
    damY + 29 * scale,
    damEndX - 95 * scale,
    damY - 19 * scale,
    damEndX,
    damY - 39 * scale,
  );
  ctx.stroke();
}

function drawGalinhaChoca(ctx: CanvasRenderingContext2D, frame: PhotoRect, scale: number) {
  const x = frame.x + frame.width * 0.3;
  const y = frame.y + frame.height - 8 * scale;
  ctx.fillStyle = SAND;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 30 * scale, y - 94 * scale);
  ctx.lineTo(x + 4 * scale, y - 113 * scale);
  ctx.lineTo(x + 33 * scale, y - 144 * scale);
  ctx.bezierCurveTo(
    x + 62 * scale,
    y - 184 * scale,
    x + 128 * scale,
    y - 188 * scale,
    x + 164 * scale,
    y - 152 * scale,
  );
  ctx.bezierCurveTo(
    x + 178 * scale,
    y - 131 * scale,
    x + 163 * scale,
    y - 101 * scale,
    x + 154 * scale,
    y - 82 * scale,
  );
  ctx.bezierCurveTo(
    x + 196 * scale,
    y - 72 * scale,
    x + 216 * scale,
    y - 87 * scale,
    x + 242 * scale,
    y - 123 * scale,
  );
  ctx.lineTo(x + 280 * scale, y - 177 * scale);
  ctx.lineTo(x + 314 * scale, y - 145 * scale);
  ctx.lineTo(x + 338 * scale, y - 35 * scale);
  ctx.lineTo(x + 366 * scale, y);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = DEEP_SAND;
  ctx.lineWidth = 5 * scale;
  ctx.lineJoin = "round";
  ctx.stroke();

  ctx.strokeStyle = "rgba(142,73,45,.55)";
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(x + 54 * scale, y - 112 * scale);
  ctx.lineTo(x + 137 * scale, y - 145 * scale);
  ctx.moveTo(x + 178 * scale, y - 54 * scale);
  ctx.lineTo(x + 280 * scale, y - 139 * scale);
  ctx.stroke();
}

function drawSanctuary(ctx: CanvasRenderingContext2D, frame: PhotoRect, scale: number) {
  const baseX = frame.x + frame.width - 322 * scale;
  const baseY = frame.y + frame.height - 8 * scale;
  const buildingX = baseX + 84 * scale;
  const buildingWidth = 244 * scale;
  const buildingHeight = 94 * scale;

  ctx.fillStyle = "rgba(255,253,247,.96)";
  ctx.strokeStyle = "#6f7377";
  ctx.lineWidth = 3 * scale;
  ctx.fillRect(buildingX, baseY - buildingHeight, buildingWidth, buildingHeight);
  ctx.strokeRect(buildingX, baseY - buildingHeight, buildingWidth, buildingHeight);
  ctx.fillStyle = "#d6d4cb";
  ctx.fillRect(
    buildingX - 10 * scale,
    baseY - buildingHeight - 16 * scale,
    buildingWidth + 20 * scale,
    20 * scale,
  );

  for (let panel = 0; panel < 4; panel += 1) {
    ctx.fillStyle = panel % 2 === 0 ? GOLD : BLUE;
    ctx.fillRect(buildingX + (18 + panel * 42) * scale, baseY - 70 * scale, 27 * scale, 54 * scale);
  }

  const apexX = baseX + 69 * scale;
  const apexY = baseY - 274 * scale;
  const leftFoot = baseX + 3 * scale;
  const rightFoot = baseX + 137 * scale;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3 * scale;
  for (let beam = 0; beam < 9; beam += 1) {
    const footX = leftFoot + ((rightFoot - leftFoot) * beam) / 8;
    ctx.beginPath();
    ctx.moveTo(apexX, apexY);
    ctx.lineTo(footX, baseY);
    ctx.stroke();
  }
  for (const progress of [0.37, 0.58, 0.76]) {
    const halfWidth = ((rightFoot - leftFoot) / 2) * progress;
    const y = apexY + (baseY - apexY) * progress;
    ctx.beginPath();
    ctx.moveTo(apexX - halfWidth, y);
    ctx.lineTo(apexX + halfWidth, y);
    ctx.stroke();
  }
}

/** Adds a stylized Quixadá landscape around the participant photo. */
export function drawQuixadaFrameArtwork(
  ctx: CanvasRenderingContext2D,
  { width, height, frame }: QuixadaFrameArtworkOptions,
) {
  const scale = Math.max(0.1, Math.min(width / 1080, height / 1350));
  ctx.save();
  drawWater(ctx, frame, scale);
  drawGalinhaChoca(ctx, frame, scale);
  drawSanctuary(ctx, frame, scale);

  ctx.fillStyle = INK;
  ctx.font = `bold ${18 * scale}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.letterSpacing = `${2.2 * scale}px`;
  ctx.fillText(
    "AÇUDE CEDRO · GALINHA CHOCA · RAINHA DO SERTÃO",
    frame.x + frame.width / 2,
    frame.y + frame.height - 25 * scale,
  );
  ctx.restore();
}
