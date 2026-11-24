// main.js — "He Filled a Warehouse With One Candle" (50s, 1500 frames @30fps)
// ONE CONTINUOUS SHOT: a single camera journey (keyframed spline with
// speed ramps + micro-drift) through one world — road -> warehouse front
// -> doorway pass-through -> candle -> glowing interior -> hook board.
// NO cuts anywhere. Transitions: doorway dark pass (exposure dip),
// smoke drift wipe (L4), match-strike light flare (L8).
// Beat map from the N1 stem's actual line timings (words.js):
//   L1  0.40-3.88   warehouse + bet        L7  24.15-27.22  candle from the bag
//   L2  4.48-7.72   rich man's challenge   L8  27.83-29.77  one strike, one flame
//   L3  8.33-11.47  hay fills a corner     L9  30.37-35.00  light fills everything
//   L4  12.07-16.34 smoke slips out        L10 35.61-38.37  the smile disappears
//   L5  16.95-19.97 crowd laughs           L11 38.97-43.31  hay / smoke / light
//   L6  20.57-23.55 hero walks in          L12 43.92-49.70  keys + hook board
import * as THREE from 'three';
import { loadAssets, applyEnv } from './kit.js';
import { buildWorld } from './world.js';
import { WORDS, LINES } from './words.js';

const W = 1080, H = 1920, FPS = 30, TOTAL = 1500;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(W, H);
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const sstep = (k) => { k = clamp(k); return k * k * (3 - 2 * k); };
const wordStart = (txt, line) => {
  const w = WORDS.find((x) => x.w === txt && (!line || (x.s >= line.s - 0.01 && x.s <= line.e)));
  return w ? w.s : 0;
};
const L = (n) => LINES[n - 1];
const WHAT_T = wordStart('What', L(12));

// ---------- caption chunks (same algorithm as the blame build) ----------
const CHUNKS = [];
{
  const WF = WORDS.filter((w) => w.w !== '—');
  let cur = [];
  const flush = () => { if (cur.length) { CHUNKS.push(cur); cur = []; } };
  WF.forEach((w, i) => {
    cur.push(w);
    const next = WF[i + 1];
    const endSentence = /[.!?]$/.test(w.w.replace(/["”]$/, ''));
    const gap = next ? next.s - w.e : 99;
    if (endSentence || cur.length >= 3 || gap > 0.2 || !next) flush();
  });
  for (const ch of CHUNKS) { ch.text = ch.map((x) => x.w).join(' '); ch.s = ch[0].s; ch.e = 0; }
  CHUNKS.forEach((ch, i) => {
    const next = CHUNKS[i + 1];
    const lineEnd = LINES.find((l) => ch.s >= l.s && ch.s < l.e);
    ch.e = next && next.s < (lineEnd ? lineEnd.e : 99) ? next.s : (lineEnd ? lineEnd.e + 0.15 : ch[ch.length - 1].e + 0.3);
  });
}

// ---------- overlay (captions / match flare / hook board) ----------
const ovCanvas = document.createElement('canvas'); ovCanvas.width = W; ovCanvas.height = H;
const ov = ovCanvas.getContext('2d');
const ovTex = new THREE.CanvasTexture(ovCanvas); ovTex.colorSpace = THREE.SRGBColorSpace;
const ovScene = new THREE.Scene();
const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
ovScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2),
  new THREE.MeshBasicMaterial({ map: ovTex, transparent: true, toneMapped: false })));

function drawCaptionText(text, cx, cy, size, fill = '#ffffff', maxW = 990) {
  ov.font = `900 ${size}px Arial, Helvetica, sans-serif`;
  let s = size;
  while (ov.measureText(text).width > maxW && s > 40) { s -= 4; ov.font = `900 ${s}px Arial, Helvetica, sans-serif`; }
  ov.textAlign = 'center'; ov.textBaseline = 'middle'; ov.lineJoin = 'round';
  ov.lineWidth = Math.round(s * 0.21); ov.strokeStyle = '#000000';
  ov.strokeText(text, cx, cy);
  ov.fillStyle = fill; ov.fillText(text, cx, cy);
}
const L12 = L(12);
function drawOverlay(t) {
  ov.clearRect(0, 0, W, H);
  // match-strike flare (transition, L8): warm flash blooming from centre
  if (t > 28.55 && t < 30.1) {
    const dt = t - 28.62;
    const a = dt < 0.07 ? (dt / 0.07) * 0.85 : 0.85 * Math.exp(-(dt - 0.07) * 5.2);
    if (a > 0.01) {
      const g = ov.createRadialGradient(W / 2, H * 0.44, 30, W / 2, H * 0.44, 760);
      g.addColorStop(0, `rgba(255,244,214,${a})`);
      g.addColorStop(0.4, `rgba(255,205,120,${a * 0.55})`);
      g.addColorStop(1, 'rgba(255,180,80,0)');
      ov.fillStyle = g; ov.fillRect(0, 0, W, H);
    }
  }
  if (t >= L12.s) {
    // hook board over the dimmed interior — narration only, no captions
    const dim = clamp((t - L12.s) / 0.6);
    ov.fillStyle = `rgba(4,10,20,${0.55 * dim})`; ov.fillRect(0, 0, W, H);
    const bx = 100, by = 560, bw = W - 200, bh = 720;
    ov.globalAlpha = dim;
    ov.fillStyle = '#0d1b2e';
    ov.strokeStyle = '#f0b400'; ov.lineWidth = 10;
    ov.beginPath(); ov.roundRect(bx, by, bw, bh, 36); ov.fill(); ov.stroke();
    ov.textAlign = 'center'; ov.textBaseline = 'middle';
    const fit = (text, size, maxW) => {
      let s = size;
      ov.font = `900 ${s}px Arial, Helvetica, sans-serif`;
      while (ov.measureText(text).width > maxW && s > 30) { s -= 3; ov.font = `900 ${s}px Arial, Helvetica, sans-serif`; }
      return s;
    };
    const a1 = clamp((t - L12.s - 0.1) / 0.5);
    ov.globalAlpha = a1 * dim;
    ov.fillStyle = '#ffffff';
    fit('He won a warehouse', 74, bw - 70);
    ov.fillText('He won a warehouse', W / 2, by + 130);
    fit('for two rupees.', 74, bw - 70);
    ov.fillText('for two rupees.', W / 2, by + 225);
    const a2 = clamp((t - 45.9) / 0.5);
    if (a2 > 0) {
      ov.globalAlpha = a2 * dim;
      drawCaptionText('HE FILLED IT', W / 2, by + 410, 124, '#f0b400', 820);
      drawCaptionText('WITH LIGHT', W / 2, by + 540, 124, '#f0b400', 820);
    }
    const a3 = clamp((t - WHAT_T - 0.05) / 0.5);
    if (a3 > 0) {
      ov.globalAlpha = a3 * dim;
      ov.fillStyle = '#ffffff';
      fit("What was the rich man's whispered bet?", 52, bw - 60);
      ov.fillText("What was the rich man's whispered bet?", W / 2, by + 655);
    }
    ov.globalAlpha = 1;
    ovTex.needsUpdate = true;
    return;
  }
  const ch = CHUNKS.find((c) => t >= c.s && t < c.e);
  if (ch) drawCaptionText(ch.text, W / 2, Math.round(H * 0.713), 88);
  ovTex.needsUpdate = true;
}

// ---------- build the one world ----------
let S = null;
init();
async function init() {
  try {
    const A = await loadAssets('assets/');
    const w = buildWorld(A);
    applyEnv(w.scene, renderer, A.env, { fog: '#a9cdec', near: w.fog.near, far: w.fog.far, intensity: w.fog.intensity });
    S = w;
    window.renderFrame(0);
    window.ready = true;
  } catch (e) {
    window.err = String(e && e.message ? e.message : e);
    console.log('ERR ' + window.err);
  }
}

// ---------- the continuous camera journey ----------
// [time, camPos, lookTarget, fov] — interpolated with smoothstep ramps
// between keys (V4 push-in/settle feel), plus permanent micro-drift.
const KEYS = [
  [0.00, [13.0, 8.5, 30.0], [0, 2.5, -10], 55],
  [3.88, [9.5, 5.2, 20.5], [0, 2.5, -10], 52],
  [7.72, [7.4, 2.1, 1.0], [5.6, 1.55, -5.6], 48],
  [11.47, [-6.8, 2.6, 3.5], [-2.5, 1.0, -12.5], 50],
  [16.34, [2.6, 2.3, -3.0], [1.8, 1.1, -12.2], 50],
  [19.97, [-8.5, 3.6, 11.0], [0, 1.3, -3], 54],
  [23.55, [-3.4, 2.0, -1.2], [-0.2, 1.1, -8.6], 50],
  [27.22, [2.3, 1.5, -12.4], [-0.45, 0.85, -15.8], 46],
  [29.77, [1.7, 1.3, -13.6], [-0.45, 0.88, -15.9], 44],
  [35.00, [6.4, 4.4, -10.8], [-3, 1.4, -18.5], 56],
  [38.37, [0.2, 1.7, -14.8], [2.9, 1.5, -9.2], 50],
  [43.31, [-5.2, 2.3, -12.6], [0.5, 1.2, -13.5], 52],
  [50.00, [-2.6, 1.9, -12.4], [0.6, 1.2, -10.6], 50],
];
const cam = new THREE.PerspectiveCamera(55, W / H, 0.1, 420);
function camAt(t) {
  let i = 0;
  while (i < KEYS.length - 2 && t > KEYS[i + 1][0]) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const u = sstep((t - a[0]) / (b[0] - a[0]));
  const pos = a[1].map((v, k) => lerp(v, b[1][k], u));
  const tgt = a[2].map((v, k) => lerp(v, b[2][k], u));
  const fov = lerp(a[3], b[3], u);
  // V4 micro-drift: the camera never sits still
  pos[0] += Math.sin(t * 0.9) * 0.05 + Math.sin(t * 2.3 + 1.2) * 0.018;
  pos[1] += Math.sin(t * 1.15 + 0.6) * 0.04;
  pos[2] += Math.sin(t * 0.7 + 2.1) * 0.05;
  cam.position.set(pos[0], pos[1], pos[2]);
  cam.fov = fov;
  cam.lookAt(tgt[0], tgt[1], tgt[2]);
  cam.updateProjectionMatrix();
}

window.renderFrame = (f) => {
  if (!S) return false;
  const t = f / FPS;
  // ---- choreography state (pure functions of t) ----
  const lightK = sstep((t - 30.5) / 4.1);
  const state = {
    t,
    suvK: clamp((t - 0.4) / 3.0),
    richWalkK: clamp((t - 30.6) / 4.2),
    richFace: t >= 36.6 ? 1 : 0,
    yellowK: clamp((t - 8.5) / 7.5),
    yellowBale: t < 15.9,
    hayK: clamp((t - 11.5) / 4.5),
    cartK: 1 - 0.75 * clamp((t - 8.5) / 4.5),
    smokeT: (t >= L(4).s && t < 19.6) ? t - L(4).s : -1,
    smokeVent: clamp((t - 14.4) / 3.8),
    crowdLaugh: clamp((t - 16.6) / 1.0) * (1 - clamp((t - 20.2) / 1.0)),
    heroK: clamp((t - L(6).s) / (25.75 - L(6).s)),
    heroK2: clamp((t - 39.2) / 3.6),
    heroBend: sstep((t - 25.9) / 0.7) * (1 - sstep((t - 30.0) / 0.9)),
    heroFace: t >= 32.5 ? 1 : 0,
    bagK: clamp((t - 26.2) / 0.8),
    candleK: t >= 26.45 ? 1 : 0,
    flameK: sstep((t - 28.7) / 0.25),
    lightK,
    keysK: clamp((t - 46.0) / 0.95),
  };
  S.api.setState(state);
  camAt(t);
  // exposure: doorway dark pass-through dip (~25.4s) + glow lift at L9
  const dip = Math.exp(-Math.pow((t - 25.4) / 0.55, 2));
  renderer.toneMappingExposure = S.exposure * (1 - 0.38 * dip) * (1 + 0.05 * lightK);
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, W, H);
  renderer.render(S.scene, cam);
  drawOverlay(t);
  renderer.autoClear = false;
  renderer.render(ovScene, fsCam);
  renderer.autoClear = true;
  return true;
};
window.TOTAL = TOTAL;
