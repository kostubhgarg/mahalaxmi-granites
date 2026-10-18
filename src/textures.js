// Procedural granite texture engine.
// Generates photorealistic granite/stone textures on a canvas using seeded
// value noise + mineral speckles + organic veins. No external images needed.

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// Small smooth value-noise field used to give the stone a soft tonal drift.
function makeNoise(size, rand, gridSize) {
  const g = gridSize || 6;
  const grid = new Float32Array((g + 1) * (g + 1));
  for (let i = 0; i < grid.length; i++) grid[i] = rand();
  const smooth = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const gx = (x / size) * g;
    const gy = (y / size) * g;
    const ix = Math.min(Math.floor(gx), g);
    const iy = Math.min(Math.floor(gy), g);
    const fx = gx - ix;
    const fy = gy - iy;
    const sx = smooth(fx);
    const sy = smooth(fy);
    const a = grid[iy * (g + 1) + ix];
    const b = grid[iy * (g + 1) + ix + 1];
    const c = grid[(iy + 1) * (g + 1) + ix];
    const d = grid[(iy + 1) * (g + 1) + ix + 1];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

function drawVeins(ctx, size, veins, rand) {
  for (const v of veins) {
    const count = v.count ?? 2;
    for (let k = 0; k < count; k++) {
      const startY = rand() * size * 0.8 + size * 0.1;
      const pts = [];
      let px = -20;
      let py = startY;
      const segs = 5;
      for (let s = 0; s <= segs; s++) {
        px = (size / segs) * s + (rand() - 0.5) * 46;
        py = startY + (rand() - 0.5) * 130;
        pts.push([px, py]);
      }
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i][0] + pts[i + 1][0]) / 2;
        const my = (pts[i][1] + pts[i + 1][1]) / 2;
        ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
      }
      ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
      ctx.strokeStyle = v.color;
      ctx.globalAlpha = (v.alpha ?? 0.32) * (0.5 + rand() * 0.5);
      ctx.lineWidth = (v.width?.[0] ?? 2) + rand() * ((v.width?.[1] ?? 6) - (v.width?.[0] ?? 2));
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }
}

/**
 * Generate a granite texture canvas.
 * @param {object} opts
 * @param {number}  [opts.size=512]        Texture resolution (square).
 * @param {string}  opts.base              Base colour, hex.
 * @param {string[]} [opts.grains]         Mineral speckle colours, hex.
 * @param {number}  [opts.speckle=0.05]    Density of coarse mineral grains.
 * @param {Array}   [opts.veins]           Vein configs: { color, alpha, count, width:[min,max] }.
 * @param {number}  [opts.seed=1]          Seeded RNG so textures are reproducible.
 * @param {boolean} [opts.gloss=true]      Adds a soft directional sheen.
 */
export function createGraniteTexture(opts) {
  const size = opts.size || 512;
  const baseRgb = hexToRgb(opts.base);
  const grainRgbs = (opts.grains || []).map(hexToRgb);
  const speckle = opts.speckle ?? 0.05;
  const rand = mulberry32(opts.seed ?? 1);
  const noise = makeNoise(size, rand);

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) << 2;
      const n = (noise(x, y) - 0.5) * 2; // -1..1 tonal drift
      let r = baseRgb[0] + n * 24;
      let g = baseRgb[1] + n * 24;
      let b = baseRgb[2] + n * 24;

      const rv = rand();
      if (rv < speckle && grainRgbs.length) {
        // coarse mineral grain — strong mix
        const g2 = grainRgbs[(rand() * grainRgbs.length) | 0];
        const m = 0.55 + rand() * 0.45;
        r += (g2[0] - r) * m;
        g += (g2[1] - g) * m;
        b += (g2[2] - b) * m;
      } else if (rv < speckle * 3.2 && grainRgbs.length) {
        // fine quartz sparkle — subtle mix
        const g2 = grainRgbs[(rand() * grainRgbs.length) | 0];
        const m = 0.1 + rand() * 0.22;
        r += (g2[0] - r) * m;
        g += (g2[1] - g) * m;
        b += (g2[2] - b) * m;
      }

      data[i] = clamp(r, 0, 255);
      data[i + 1] = clamp(g, 0, 255);
      data[i + 2] = clamp(b, 0, 255);
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  if (opts.veins && opts.veins.length) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    drawVeins(ctx, size, opts.veins, rand);
    ctx.restore();
  }

  if (opts.gloss !== false) {
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, 'rgba(255,255,255,0.06)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.015)');
    grad.addColorStop(1, 'rgba(0,0,0,0.10)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  return canvas;
}

/** Helper: turn a texture canvas into a usable CSS background-image data URL. */
export function canvasToDataURL(canvas, quality = 0.88) {
  return canvas.toDataURL('image/jpeg', quality);
}
