// ============================================================
// MATERIALS v4 — richer, more real coded surfaces (Detail Standard:
// every surface painted in parts, NO flat emissive fills). All
// deterministic seeded canvas painters + three.js material factories.
// Used by props.js (car paint/glass, stone, wood) and project scenes
// (ground detail, asphalt, sand, shore foam). Additive: v3 texture
// functions in fx.js / paint.js are untouched.
// ============================================================
import * as THREE from './lib/three.module.js';
import { rng, tex } from './paint.js';

const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
export const hexRgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
export const mixHex = (hex, hex2, t) => { const a = hexRgb(hex), b = hexRgb(hex2); return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`; };

// ---------- CAR PAINT v4: layered metallic gradient + fine flake +
// brushed streaks + a soft clearcoat sheen band + darker sill shading.
// Pair with MeshPhysicalMaterial clearcoat (props.buildCar) so the
// sheen MOVES with the env reflection as the car turns. ----------
export function carPaintV4(paint = '#caa12e', seed = 5) {
  const [c, g] = cv(512, 512), r = rng(seed);
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, mixHex(paint, '#ffffff', 0.22));
  gr.addColorStop(0.35, mixHex(paint, '#ffffff', 0.05));
  gr.addColorStop(0.72, paint);
  gr.addColorStop(1, mixHex(paint, '#000000', 0.30));
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  // clearcoat sheen band (diagonal, soft)
  g.save(); g.translate(256, 256); g.rotate(-0.42); g.translate(-256, -256);
  const sg = g.createLinearGradient(0, 120, 0, 300);
  sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.13)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sg; g.fillRect(-200, 120, 912, 180); g.restore();
  // brushed-metal streaks
  for (let i = 0; i < 150; i++) {
    g.strokeStyle = `rgba(${r() < 0.5 ? '255,246,220' : '40,26,4'},${0.03 + r() * 0.05})`;
    g.lineWidth = 0.8 + r() * 1.4; const y = r() * 512;
    g.beginPath(); g.moveTo(0, y); g.lineTo(512, y + r() * 8 - 4); g.stroke();
  }
  // metallic flake, two scales
  for (let i = 0; i < 2400; i++) { g.fillStyle = `rgba(255,244,205,${0.04 + r() * 0.13})`; g.fillRect(r() * 512, r() * 512, 1.4, 1.4); }
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(30,20,2,${0.04 + r() * 0.09})`; g.fillRect(r() * 512, r() * 512, 1.6, 1.6); }
  // panel-edge shading (sides fall off)
  const eg = g.createLinearGradient(0, 0, 512, 0);
  eg.addColorStop(0, 'rgba(0,0,0,0.13)'); eg.addColorStop(0.14, 'rgba(0,0,0,0)'); eg.addColorStop(0.86, 'rgba(0,0,0,0)'); eg.addColorStop(1, 'rgba(0,0,0,0.13)');
  g.fillStyle = eg; g.fillRect(0, 0, 512, 512);
  return c;
}

// ---------- GLASS v4: blue-green tint gradient + diagonal reflection
// streak + soft top glare. Use as the map of glassMatV4. ----------
export function glassCanvasV4(seed = 3) {
  const [c, g] = cv(256, 256), r = rng(seed);
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#e6f6fb'); gr.addColorStop(0.45, '#a9d6e0'); gr.addColorStop(1, '#79b3c2');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  g.save(); g.translate(128, 128); g.rotate(-0.6); g.translate(-128, -128);
  const sg = g.createLinearGradient(40, 0, 150, 0);
  sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.5)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sg; g.fillRect(40, -80, 110, 420);
  g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(168, -80, 26, 420);
  g.restore();
  const tg = g.createLinearGradient(0, 0, 0, 60);
  tg.addColorStop(0, 'rgba(255,255,255,0.35)'); tg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = tg; g.fillRect(0, 0, 256, 60);
  for (let i = 0; i < 130; i++) { g.fillStyle = `rgba(255,255,255,${0.03 + r() * 0.06})`; g.fillRect(r() * 256, r() * 256, 1.3, 1.3); }
  return c;
}
export function glassMatV4(envMap = null, opacity = 0.52) {
  return new THREE.MeshPhysicalMaterial({
    map: tex(glassCanvasV4()), transparent: true, opacity, roughness: 0.06, metalness: 0,
    envMap, envMapIntensity: 1.6, depthWrite: false,
  });
}

// ---------- STONE v4: wider per-stone hue/value variation than the v3
// wall texture, light+dark speckle, a lit bevel arc on every stone,
// deep mortar with an inner shadow under each stone, moss low down. ----------
export function stoneV4(seed = 8, o = {}) {
  const { courses = 6, hue = 36, sat = 13, lig = 56, moss = 0.5 } = o;
  const [c, g] = cv(512, 512), r = rng(seed * 613 + 3);
  const mg = g.createLinearGradient(0, 0, 0, 512);
  mg.addColorStop(0, '#453e34'); mg.addColorStop(1, '#2e2a23');
  g.fillStyle = mg; g.fillRect(0, 0, 512, 512); // mortar
  let y = 0;
  for (let row = 0; row < courses; row++) {
    const bh = 512 / courses * (0.85 + r() * 0.3), off = (row % 2) * 70;
    for (let x = -70 + off; x < 512; x += 90 + r() * 60) {
      const bw = 84 + r() * 56, H = hue + r() * 14 - 7, S = sat + r() * 8 - 4, L = lig - 11 + r() * 22;
      g.fillStyle = hsl(H, S, L); g.beginPath(); g.roundRect(x + 3, y + 3, bw - 6, bh - 6, 6); g.fill();
      // bevel: lit top arc + inner bottom shadow (mortar depth)
      g.fillStyle = hsl(H, S, L + 13, 0.7); g.fillRect(x + 7, y + 5, bw - 16, 4);
      g.fillStyle = hsl(H, S, L + 8, 0.35); g.fillRect(x + 5, y + 7, 4, bh - 14);
      const sh = g.createLinearGradient(0, y + bh - 14, 0, y + bh - 4);
      sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.34)');
      g.fillStyle = sh; g.fillRect(x + 5, y + bh - 14, bw - 10, 10);
      // speckle, light and dark
      for (let k = 0; k < 15; k++) { g.fillStyle = hsl(H, S, L + (r() < 0.5 ? -1 : 1) * (8 + r() * 10), 0.5); g.beginPath(); g.ellipse(x + 6 + r() * (bw - 12), y + 5 + r() * (bh - 10), 1 + r() * 3.4, 0.8 + r() * 2, 0, 0, 7); g.fill(); }
      if (r() < 0.14) { g.strokeStyle = hsl(H, S, L - 22, 0.7); g.lineWidth = 1.3; g.beginPath(); let cx = x + 12 + r() * (bw - 24), cy = y + 4; g.moveTo(cx, cy); while (cy < y + bh - 4) { cx += r() * 10 - 5; cy += 8 + r() * 8; g.lineTo(cx, cy); } g.stroke(); }
      if (moss > 0 && row >= courses - 2 && r() < moss) { g.fillStyle = `hsla(${95 + r() * 20},38%,${30 + r() * 8}%,0.20)`; g.beginPath(); g.ellipse(x + r() * bw, y + bh - 8 - r() * 8, 8 + r() * 16, 3 + r() * 5, 0, 0, 7); g.fill(); }
    }
    y += 512 / courses;
  }
  return c;
}

// ---------- WOOD v4: grain streaks in two tones, ringed knots with a
// dark core, plank-END shading, seam shadow + top light, nail heads. ----------
export function woodV4(seed = 4, o = {}) {
  const { base = '#8a6844', dark = '#5f4630', planks = 5, nails = true } = o;
  const [c, g] = cv(512, 512), r = rng(seed * 457 + 9);
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  const ph = 512 / planks;
  for (let p = 0; p < planks; p++) {
    const y0 = p * ph, L = (r() - 0.5) * 12;
    g.fillStyle = `rgba(${L > 0 ? '255,235,200' : '20,10,4'},${Math.abs(L) / 80})`; g.fillRect(0, y0, 512, ph);
    for (let i = 0; i < 34; i++) {
      const y = y0 + 4 + r() * (ph - 8);
      g.strokeStyle = `rgba(${r() < 0.72 ? '52,34,16' : '226,196,150'},${0.09 + r() * 0.15})`; g.lineWidth = 0.8 + r() * 1.7;
      g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(150, y + r() * 6 - 3, 340, y - r() * 6 + 3, 512, y + r() * 4 - 2); g.stroke();
    }
    if (r() < 0.8) { // knot: dark core + rings
      const kx = 40 + r() * 430, ky = y0 + ph * (0.3 + r() * 0.4);
      for (let k = 6; k > 0; k--) { g.strokeStyle = `rgba(46,28,12,${0.15 + (6 - k) * 0.07})`; g.lineWidth = 1.7; g.beginPath(); g.ellipse(kx, ky, k * 3.6, k * 2.2, 0.3, 0, 7); g.stroke(); }
      g.fillStyle = 'rgba(30,17,7,0.85)'; g.beginPath(); g.ellipse(kx, ky, 3.4, 2.2, 0.3, 0, 7); g.fill();
    }
    // plank-end shading: both ends darker (worn, handled wood)
    for (const [x0, dir] of [[0, 1], [512, -1]]) {
      const eg = g.createLinearGradient(x0, 0, x0 + dir * 46, 0);
      eg.addColorStop(0, 'rgba(24,14,5,0.30)'); eg.addColorStop(1, 'rgba(24,14,5,0)');
      g.fillStyle = eg; g.fillRect(Math.min(x0, x0 + dir * 46), y0, 46, ph);
    }
    g.fillStyle = dark; g.fillRect(0, y0 + ph - 3, 512, 3);
    g.fillStyle = 'rgba(255,240,210,0.22)'; g.fillRect(0, y0, 512, 2);
    if (nails) for (const nx of [14, 498]) { g.fillStyle = '#26221e'; g.beginPath(); g.arc(nx, y0 + ph / 2, 4.4, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(nx - 1.4, y0 + ph / 2 - 1.4, 1.5, 0, 7); g.fill(); }
  }
  return c;
}

// ---------- ASPHALT v4 (road): aggregate speckle, centre wear band,
// dusty worn edges, faint cracks, patch repairs. ----------
export function asphaltV4(seed = 12) {
  const [c, g] = cv(512, 512), r = rng(seed);
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#55524e'); gr.addColorStop(0.5, '#4b4844'); gr.addColorStop(1, '#423f3b');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4200; i++) { const L = 22 + r() * 46; g.fillStyle = `hsla(36,6%,${L}%,${0.25 + r() * 0.4})`; g.fillRect(r() * 512, r() * 512, 1.5, 1.5); }
  const wg = g.createLinearGradient(0, 150, 0, 362); // centre wear (traffic-polished)
  wg.addColorStop(0, 'rgba(210,200,180,0)'); wg.addColorStop(0.5, 'rgba(210,200,180,0.10)'); wg.addColorStop(1, 'rgba(210,200,180,0)');
  g.fillStyle = wg; g.fillRect(0, 150, 512, 212);
  for (const [y0, flip] of [[0, 0], [512, 1]]) { // dusty edges
    const eg = g.createLinearGradient(0, y0, 0, y0 + (flip ? -64 : 64));
    eg.addColorStop(0, 'rgba(196,172,128,0.30)'); eg.addColorStop(1, 'rgba(196,172,128,0)');
    g.fillStyle = eg; g.fillRect(0, Math.min(y0, y0 + (flip ? -64 : 64)), 512, 64);
  }
  for (let i = 0; i < 4; i++) { g.fillStyle = `rgba(20,18,16,${0.05 + r() * 0.05})`; g.fillRect(r() * 380, r() * 512, 60 + r() * 90, 40 + r() * 70); } // patches
  for (let i = 0; i < 3; i++) { g.strokeStyle = 'rgba(18,16,14,0.5)'; g.lineWidth = 1.4; g.beginPath(); let x = r() * 512, y = r() * 200; g.moveTo(x, y); while (y < 512 && x > 0 && x < 512) { x += r() * 26 - 13; y += 22 + r() * 26; g.lineTo(x, y); } g.stroke(); }
  return c;
}

// ---------- SAND v4: fine grain, ripple bands, shell specks, patches. ----------
export function sandV4(seed = 15) {
  const [c, g] = cv(512, 512), r = rng(seed);
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#e0c28a'); gr.addColorStop(1, '#cda96e');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 34; i++) { g.fillStyle = `hsla(38,42%,${52 + r() * 16}%,0.10)`; g.beginPath(); g.ellipse(r() * 512, r() * 512, 24 + r() * 60, 12 + r() * 26, r() * 3, 0, 7); g.fill(); }
  for (let y = 8; y < 512; y += 15 + r() * 9) { g.strokeStyle = `rgba(146,112,58,${0.05 + r() * 0.05})`; g.lineWidth = 2.4; g.beginPath(); for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + Math.sin(x * 0.05 + y) * 2.4); g.stroke(); }
  for (let i = 0; i < 5200; i++) { const L = 48 + r() * 34; g.fillStyle = `hsla(40,44%,${L}%,${0.3 + r() * 0.4})`; g.fillRect(r() * 512, r() * 512, 1.4, 1.4); }
  for (let i = 0; i < 26; i++) { g.strokeStyle = `rgba(250,244,228,${0.5 + r() * 0.4})`; g.lineWidth = 1.6; g.beginPath(); g.arc(r() * 512, r() * 512, 2 + r() * 2.6, 0.3, 2.6); g.stroke(); }
  return c;
}

// ---------- GROUND DETAIL v4: post-process any painted ground canvas
// with fine noise + soft patch variation (kills the flat tiled look). ----------
export function groundDetail(baseCanvas, seed = 31, o = {}) {
  const { dots = 2800, patches = 26 } = o;
  const [c, g] = cv(baseCanvas.width, baseCanvas.height), r = rng(seed);
  g.drawImage(baseCanvas, 0, 0);
  const W = c.width, H = c.height;
  for (let i = 0; i < patches; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '30,24,10' : '255,250,230'},${0.05 + r() * 0.06})`; g.beginPath(); g.ellipse(r() * W, r() * H, 18 + r() * 54, 10 + r() * 30, r() * 3, 0, 7); g.fill(); }
  for (let i = 0; i < dots; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '24,18,8' : '255,252,238'},${0.10 + r() * 0.20})`; g.fillRect(r() * W, r() * H, 1.4, 1.4); }
  return c;
}

// ---------- CINEMATIC PALETTE + WATER (charfix round 2, 2026-11-22) ----------
// Locked cinematic colours: water is DEEP TEAL with a warm sky tint
// and gold sun glints — never the old grey-blue wash (the lampwater
// rejection: paani grey-blue tha, banding thi). The grade that sits
// on top lives in main.js's ink pass (ACES fit + split tone).
export const CINE = {
  water: { deep: '#07303c', shallow: '#14616e', sky: '#cfe8dd', glint: '#fff3cf' },
  shadowTeal: [-0.014, 0.010, 0.018],   // split-tone lift added to shadows
  highlightWarm: [1.07, 1.0, 0.90],     // split-tone gain on highlights
};
/** 2D water surface for vessels / pots / card-space water: vertical
 *  teal depth gradient, soft ripple streaks, a warm glint column.
 *  (3D open water: fx.makeWaterCine.) */
export function waterCineCanvas(seed = 17, w = 256, h = 256) {
  const [c, g] = cv(w, h), r = rng(seed);
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, CINE.water.shallow); gr.addColorStop(0.55, '#0d4a56'); gr.addColorStop(1, CINE.water.deep);
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 46; i++) { // ripple streaks, lighter toward the top
    const y = r() * h, len = 14 + r() * 46;
    g.strokeStyle = `rgba(207,232,221,${0.05 + r() * 0.10 * (1 - y / h)})`; g.lineWidth = 1 + r() * 1.6;
    g.beginPath(); g.moveTo(r() * w, y); g.lineTo(r() * w + len, y + r() * 2 - 1); g.stroke();
  }
  const gx = w * (0.3 + r() * 0.4); // sun-glint column
  for (let i = 0; i < 130; i++) {
    const y = r() * h, x = gx + (r() - 0.5) * w * 0.3 * (0.4 + y / h);
    g.fillStyle = `rgba(255,243,207,${0.10 + r() * 0.30})`;
    g.fillRect(x, y, 2 + r() * 5, 1.1 + r() * 1.2);
  }
  return c;
}

// ---------- SHORE FOAM v4: alpha foam blobs for a shoreline band mesh.
// Tile horizontally; animate the map offset for a living foam edge. ----------
export function foamCanvas(seed = 21) {
  const [c, g] = cv(256, 64), r = rng(seed);
  g.clearRect(0, 0, 256, 64);
  for (let i = 0; i < 210; i++) {
    const x = r() * 256, y = 32 + (r() - 0.5) * 30 * (0.4 + r() * 0.6), rad = 2 + r() * 7 * (1 - Math.abs(y - 32) / 34);
    g.fillStyle = `rgba(244,252,255,${0.16 + r() * 0.4})`;
    g.beginPath(); g.ellipse(x, y, Math.max(0.6, rad), Math.max(0.5, rad * 0.55), 0, 0, 7); g.fill();
  }
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(244,252,255,${0.3 + r() * 0.5})`; g.beginPath(); g.arc(r() * 256, 26 + r() * 12, 0.8 + r() * 1.6, 0, 7); g.fill(); }
  return c;
}
