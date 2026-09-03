/**
 * Brick faces, drawn on a canvas with the design's own CSS values.
 *
 * ## Why a texture
 *
 * Six rounds of this went into tuning lights, emissive, exposure, tone mapping
 * and a baked vertex ramp, and the wall still did not look like the design. The
 * reason is structural, not numeric: the design differentiates block kinds BY
 * MATERIAL — a crack and two rivets on TOUGH, ribbed plate on ARMORED, a lit
 * ring around SHIELDED, an ember core in FIRE — and an InstancedMesh with one
 * flat colour per instance cannot express any of it. Every brick in the game was
 * a plain slab, so the board read as coloured rectangles no matter how well
 * those rectangles were shaded. The headline of the design sheet is literally
 * "renkle değil malzemeyle ayrışıyor"; only the colour half was ever built.
 *
 * So the face is drawn here, in 2D, with the same gradient stops, the same inset
 * highlight and the same detail geometry as the CSS — then handed to three.js as
 * a texture. Matching the design stops being a tuning problem and becomes a
 * transcription: canvas paints in sRGB exactly like a browser does, so there is
 * no linear-vs-sRGB conversion to get wrong and no specular term to fight.
 *
 * One texture per distinct face (six wall variants plus one per special kind),
 * one InstancedMesh each. A real board shows eight to ten of them, so this costs
 * a handful of draw calls instead of one — worth it for a wall that reads.
 */

import * as THREE from 'three';

/** Face texture size. 1.65:1, matching the brick's own aspect. */
export const FACE_W = 264;
export const FACE_H = 160;

/** Corner radius as a fraction of the brick's shorter side. */
export const RADIUS_FRACTION = 0.11;

export type Detail = 'crack' | 'rivets' | 'ribs' | 'shield' | 'ember' | 'dynamite';

export interface FaceSpec {
  /** Vertical gradient, top → 46% → bottom. The design's own stops. */
  stops: readonly [string, string, string];
  /** Surface detail that identifies the kind by material. */
  details?: readonly Detail[];
}

/**
 * Ordinary bricks: two colour families, three depth steps each.
 *
 * The dominant family used to be warm (#ffb389 → #dc7450) at 70% of the wall.
 * Orange at that saturation turns to mud the moment it is under-lit, which is
 * what the board actually looked like. The design's wall is cool: cyan body,
 * violet accent. Deeper row bands sit darker, so the wall reads as a lit relief.
 */
export const WALL_FACES: readonly FaceSpec[] = [
  { stops: ['#a5e4ff', '#6fcbf5', '#3f9fd0'] },
  { stops: ['#8ed9f7', '#52bdf5', '#3388c0'] },
  { stops: ['#6fbfe0', '#3d9fd4', '#2673a0'] },
  { stops: ['#c3b8ff', '#9c8bff', '#6d5cd8'] },
  { stops: ['#ab9dff', '#7a68f0', '#5343b8'] },
  { stops: ['#9083e0', '#6252d0', '#40329c'] },
];

/** Wall variant for an authored position: family (70/30) and row band. */
export const wallFaceIndex = (column: number, row: number) => {
  const family = (column * 3 + row) % 10 < 7 ? 0 : 1;
  const band = ((row % 9) + 9) % 9;
  return family * 3 + (band < 3 ? 0 : band < 6 ? 1 : 2);
};

/**
 * Special kinds, by material.
 *
 * Colour alone was never enough: TOUGH used to be byte-identical to an ordinary
 * brick tone and EXPLOSIVE was indistinguishable from another. The details are
 * what carry the meaning at phone size, and they survive any palette change.
 */
export const KIND_FACES: Record<string, FaceSpec> = {
  TOUGH: { stops: ['#9a97c4', '#7b78a8', '#514e78'], details: ['rivets', 'crack'] },
  ARMORED: { stops: ['#b6bed4', '#9aa3bd', '#666f88'], details: ['ribs'] },
  EXPLOSIVE: { stops: ['#ff5a4a', '#e5252f', '#a8121c'], details: ['dynamite'] },
  FIRE: { stops: ['#ff9d5e', '#ff7a45', '#c94a22'], details: ['ember'] },
  ICE: { stops: ['#e4f8ff', '#b8ecff', '#7cc4e0'], details: ['crack'] },
  ELECTRIC: { stops: ['#ffe9a3', '#ffd166', '#c99a22'], details: ['ember'] },
  SHIELDED: { stops: ['#8fb6ff', '#6b9dff', '#3f6ed6'], details: ['shield'] },
  MOVING: { stops: ['#8ff0cd', '#4fd6a8', '#2a9e78'] },
  REGENERATING: { stops: ['#a8f5cd', '#7ce8b0', '#45ac7e'], details: ['crack'] },
  PORTAL: { stops: ['#e2a3ff', '#d14dff', '#8e2ab8'], details: ['shield'] },
  SPLITTER: { stops: ['#ffb3e4', '#ff8ad0', '#c4569b'], details: ['crack'] },
  BONUS: { stops: ['#fff0c2', '#ffd166', '#c99a22'], details: ['ember'] },
  // Barrier structure: dark, desaturated, heavily ribbed. A gate the ball can
  // never break must not look like a brick that is merely hard, and must not be
  // confused with ARMORED, which IS breakable.
  DEFLECTOR: { stops: ['#7d8798', '#5a6478', '#333b4a'], details: ['ribs'] },
  ABSORBER: { stops: ['#8a91a8', '#6b7390', '#3d4358'], details: ['ribs'] },
  BOSS_CORE: { stops: ['#ff9ec2', '#ff6b9a', '#c43567'], details: ['shield', 'ember'] },
};

const roundedPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

const drawDetail = (ctx: CanvasRenderingContext2D, detail: Detail) => {
  switch (detail) {
    case 'rivets': {
      // Two pins, one per end, at mid height — the design's `4px` dots.
      for (const cx of [26, FACE_W - 26]) {
        ctx.fillStyle = 'rgba(232,229,255,0.85)';
        ctx.beginPath();
        ctx.arc(cx, FACE_H / 2, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.arc(cx, FACE_H / 2 + 3, 9, 0.15, Math.PI - 0.15);
        ctx.fill();
      }
      break;
    }
    case 'crack': {
      // A hairline fracture: this brick takes more than one hit.
      ctx.strokeStyle = 'rgba(0,0,0,0.42)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(FACE_W * 0.42, 18);
      ctx.lineTo(FACE_W * 0.47, FACE_H * 0.44);
      ctx.lineTo(FACE_W * 0.41, FACE_H * 0.62);
      ctx.lineTo(FACE_W * 0.46, FACE_H - 18);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(FACE_W * 0.47, FACE_H * 0.44);
      ctx.lineTo(FACE_W * 0.58, FACE_H * 0.3);
      ctx.stroke();
      break;
    }
    case 'ribs': {
      // Repeating vertical plate, the design's 2px/5px stripe.
      for (let x = 12; x < FACE_W - 12; x += 16) {
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(x, 12, 6, FACE_H - 24);
        ctx.fillStyle = 'rgba(0,0,0,0.16)';
        ctx.fillRect(x + 6, 12, 10, FACE_H - 24);
      }
      // Inner frame: bolted plate rather than a moulded brick.
      ctx.strokeStyle = 'rgba(20,26,40,0.5)';
      ctx.lineWidth = 5;
      roundedPath(ctx, 12, 12, FACE_W - 24, FACE_H - 24, 8);
      ctx.stroke();
      break;
    }
    case 'shield': {
      // Lit inner ring. The design puts a glowing frame around the block; drawn
      // just inside the face so it needs no second, larger quad.
      ctx.strokeStyle = 'rgba(200,240,255,0.95)';
      ctx.lineWidth = 6;
      ctx.shadowColor = 'rgba(168,240,255,0.9)';
      ctx.shadowBlur = 22;
      roundedPath(ctx, 10, 10, FACE_W - 20, FACE_H - 20, 12);
      ctx.stroke();
      ctx.shadowBlur = 0;
      break;
    }
    case 'ember': {
      // Hot core, low and central: the design's
      // `radial-gradient(closest-side at 50% 68%, rgba(255,240,190,.9), …)`.
      const glow = ctx.createRadialGradient(
        FACE_W / 2,
        FACE_H * 0.68,
        0,
        FACE_W / 2,
        FACE_H * 0.68,
        FACE_H * 0.62,
      );
      glow.addColorStop(0, 'rgba(255,244,206,0.92)');
      glow.addColorStop(0.55, 'rgba(255,214,140,0.35)');
      glow.addColorStop(1, 'rgba(255,214,140,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, FACE_W, FACE_H);
      break;
    }
    case 'dynamite': {
      // Cream end caps hard against both ends, two dark bands inboard. The fuse
      // rises above the brick, so it stays a real mesh in GameRenderer.
      const capW = 26;
      const cream = ctx.createLinearGradient(0, 0, 0, FACE_H);
      cream.addColorStop(0, '#fff6e8');
      cream.addColorStop(1, '#dcc09a');
      for (const x of [10, FACE_W - 10 - capW]) {
        ctx.fillStyle = cream;
        ctx.fillRect(x, 10, capW, FACE_H - 20);
      }
      ctx.fillStyle = 'rgba(110,8,16,0.78)';
      for (const x of [capW + 26, FACE_W - capW - 44]) {
        ctx.fillRect(x, 10, 18, FACE_H - 20);
      }
      // Stencilled label, the way a real stick is marked.
      ctx.fillStyle = 'rgba(255,234,210,0.9)';
      ctx.font = `700 ${Math.round(FACE_H * 0.2)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('TNT', FACE_W / 2, FACE_H / 2 + 1);
      break;
    }
  }
};

/** Paints one brick face. Exported so a test can render it off-screen. */
export const paintBrickFace = (ctx: CanvasRenderingContext2D, spec: FaceSpec) => {
  const radius = FACE_H * RADIUS_FRACTION;
  ctx.clearRect(0, 0, FACE_W, FACE_H);

  // Body: the design's three-stop vertical gradient, in sRGB, exactly as the
  // browser would paint it.
  const body = ctx.createLinearGradient(0, 0, 0, FACE_H);
  body.addColorStop(0, spec.stops[0]);
  body.addColorStop(0.46, spec.stops[1]);
  body.addColorStop(1, spec.stops[2]);
  ctx.fillStyle = body;
  ctx.fillRect(0, 0, FACE_W, FACE_H);

  // Diagonal sheen: `linear-gradient(155deg, rgba(255,255,255,.22), … 46%)`.
  const sheen = ctx.createLinearGradient(0, 0, FACE_W * 0.5, FACE_H);
  sheen.addColorStop(0, 'rgba(255,255,255,0.22)');
  sheen.addColorStop(0.46, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, FACE_W, FACE_H);

  ctx.save();
  roundedPath(ctx, 0, 0, FACE_W, FACE_H, radius);
  ctx.clip();
  for (const detail of spec.details ?? []) drawDetail(ctx, detail);
  ctx.restore();

  // Lit top edge and seated shadow: `inset 0 1px 0 rgba(255,255,255,.5)` and
  // `inset 0 -2px 0 rgba(0,0,0,.3)`, scaled to this resolution. Painted last so
  // no detail crosses them — they are what give the brick its light direction.
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(0, 0, FACE_W, 7);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillRect(0, 7, FACE_W, 4);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, FACE_H - 10, FACE_W, 10);
};

/**
 * Builds a face texture, or null where there is no canvas (SSR, unit tests).
 * The renderer falls back to a flat colour in that case, so a missing 2D context
 * degrades instead of throwing.
 */
export const createBrickFaceTexture = (spec: FaceSpec): THREE.Texture | null => {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = FACE_W;
  canvas.height = FACE_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  paintBrickFace(ctx, spec);

  const texture = new THREE.CanvasTexture(canvas);
  // The canvas is already sRGB, so three.js must not treat it as linear data.
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
};

/** Which face a block draws. Ordinary bricks vary by authored position. */
export const faceKeyFor = (kind: string, column: number, row: number) =>
  KIND_FACES[kind] ? `k:${kind}` : `w:${wallFaceIndex(column, row)}`;

export const faceSpecFor = (key: string): FaceSpec => {
  if (key.startsWith('k:')) return KIND_FACES[key.slice(2)]!;
  return WALL_FACES[Number(key.slice(2))]!;
};
