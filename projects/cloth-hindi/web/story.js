// "वो कपड़ा जो सिर्फ़ मूर्खों को नहीं दिखता" — Hindi trick batch 4, topic 2.
// Timed to the Hindi stem (64.65 s, 30 fps, TOTAL 1940) from faster-whisper
// word timings (cloth-hindi-voice). Every shot starts on a clause boundary;
// every camera key lands on the word that names its subject. Camera Law:
// the camera TRACKS the voice-named subject, never freezes, never drifts.
// PHYSICS: props rest flush on their surfaces (offering-table gold/silk are
// static set geometry with contact discs); the pouch/silk live IN the
// weaver's card hand (prop patch) so they rise WITH the hand; the boy sits
// ON his father's shoulders (seated card, seat at shoulder height).
// Clause map (s, from ASR words — cloth-hindi-voice/timing.json):
// L1 hook 0.00-4.54 | L2 pitch 4.54-10.40 | L3 gold 10.40-15.32 |
// L4 weave 15.32-19.94 | L5 minister1 19.94-29.86 | L6 minister2
// 29.86-32.82 | L7 king 32.82-39.46 | L8 dress+parade 39.46-47.50 |
// L9 shout 47.50-51.90 | L10 laugh 51.90-57.44 | L11 hook 57.44-64.54.
// Anchors: ye-lo 13.38 | sona 13.78 | resham 14.14 | sikka-jeb 18.60 |
// ghoorta 22.50 | muskura 27.90 | shandaar 28.72 | pet-ghoom 35.28 |
// garja 37.24 | pehnaya 39.46 | juloos 42.42 | kandhon 47.50 |
// chillaya 49.62 | dekho 49.96 | hansi 52.98 | bhala 62.58.
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1940, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 135, light: 'court' },
  { id: 'pitch', a: 136, b: 459, light: 'court' },
  { id: 'weave', a: 460, b: 597, light: 'court' },
  { id: 'inspect1', a: 598, b: 895, light: 'court' },
  { id: 'inspect2', a: 896, b: 984, light: 'court' },
  { id: 'kingvisit', a: 985, b: 1183, light: 'court' },
  { id: 'dress', a: 1184, b: 1272, light: 'court' },
  { id: 'parade', a: 1273, b: 1722, light: 'day' },
  { id: 'hookout', a: 1723, b: 1939, light: 'day' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
M.linear = (t) => clamp(t);

// ---------- lights ----------
const WATER = { waterDeep: '#223c4e', waterShal: '#2c4a63', glint: '#ffe9c0' };
export const LIGHTS = {
  day: { az: 125, el: 44, sky: '#bcd2e8', ground: '#5f6a52', hemi: 1.22, sun: '#fff3da', sunI: 2.2, fog: '#cfd8c2', fogNear: 46, fogFar: 380,
    skyTop: '#5f97d6', skyHor: '#eef0da', sunDisc: '#fff6da', sunSize: 0.003, sat: 1.05, vig: 0.18, shadowExt: 18, aurora: 0, gain: '#ffffff', ...WATER },
  court: { az: 100, el: 30, sky: '#e8c9a0', ground: '#6a5a40', hemi: 1.18, sun: '#ffd9a0', sunI: 2.3, fog: '#e5cf9e', fogNear: 42, fogFar: 340,
    skyTop: '#7fa0d0', skyHor: '#ffe0b0', sunDisc: '#fff3cf', sunSize: 0.0036, sat: 1.08, vig: 0.22, shadowExt: 18, aurora: 0, gain: '#ffedd6', ...WATER },
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

// ---------- staging ----------
// Court: throne [0,0,-2.2], offering table top y=0.565 at [0,-0.8].
// Looms (bare frames) west at z=-1.7; weaver benches on the south side at z=-0.92.
// Street: king's route z=6.2, crowd lines z=4.4 (N) and z=8.4 (S).
export const THRONE = [0, 0, -2.2];
export const KING_STAND = [0, 0, 0.35];
export const WV_A_COURT = [-1.4, 0, -0.7];
export const WV_B_COURT = [1.4, 0, -0.7];
export const MIN_OLD = [2.4, 0, -0.5];
export const MIN_2 = [3.15, 0, -1.4];
export const COURT_L = [-2.7, 0, -1.35];
export const GUARD_L = [-4.35, 0, -1.6], GUARD_R = [2.0, 0, -1.95];
export const SEAT_A = [-4.3, 0, -0.92], SEAT_B = [-6.2, 0, -0.92];
export const WV_A_STAND = [-5.2, 0, -0.1], WV_B_STAND = [-7.2, 0, -0.1];
export const MIN_OLD_LOOM = [-3.3, 0, 0.45], MIN_2_LOOM = [-5.3, 0, 0.45];
export const KING_LOOM = [-3.15, 0, 0.5];
export const WV_A_DRESS = [-0.95, 0, 0.3], WV_B_DRESS = [0.95, 0, 0.3];
export const KING_ST = [0, 0, 6.2];
export const FATHER = [3.1, 0, 8.4];
export const BOY = [3.1, 1.58, 8.4];
export const BOARD_TITLE = [-2.7, 2.2, -2.35];
export const BOARD_SHOUT = [1.9, 1.55, 9.6];
export const BOARD_HOOK = [6.6, 1.55, 7.0];
export const CROWD_N = [[-5.2, 0, 4.5], [-3.6, 0, 4.3], [3.8, 0, 4.4], [7.4, 0, 4.8]];
export const CROWD_S = [[-4.4, 0, 8.4], [-2.7, 0, 8.5], [4.6, 0, 8.5]];

const heroPosAtInner = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'hook': return f < 60 ? [0, 1.2, -2.0] : f < 100 ? [-0.7, 1.0, -0.7] : [BOARD_TITLE[0], BOARD_TITLE[1], BOARD_TITLE[2]];
    case 'pitch': return f < 312 ? [-1.4, 1.0, -0.7] : f < 395 ? [0, 1.3, -2.2] : [0, 0.7, -0.8];
    case 'weave': return f < 545 ? [SEAT_A[0], 0.9, SEAT_A[2]] : [SEAT_B[0], 0.9, SEAT_B[2]];
    case 'inspect1': return f < 767 ? [-4.3, 0.9, -0.9] : [MIN_OLD_LOOM[0], 1.1, MIN_OLD_LOOM[2]];
    case 'inspect2': return [MIN_2_LOOM[0], 1.1, MIN_2_LOOM[2]];
    case 'kingvisit': return f < 1058 ? [-4.3, 0.9, -0.9] : [KING_LOOM[0], 1.2, KING_LOOM[2]];
    case 'dress': return [0, 1.2, 0.35];
    case 'parade': return f < 1425 ? [0, 1.2, 6.2] : f < 1589 ? [BOY[0], 2.2, BOY[2]] : [0, 1.2, 6.2];
    case 'hookout': return f < 1860 ? [0, 1.2, 6.2] : [BOARD_HOOK[0], BOARD_HOOK[1], BOARD_HOOK[2]];
    default: return [0, 1, 0];
  }
};
export const heroPosAt = heroPosAtInner;

// ---------- cameras ----------
const CAMS = {
  hook: [
    { f: 0, pos: [5.4, 2.9, 6.2], look: [0, 1.3, -2.0], fov: 45 },
    { f: 40, pos: [4.2, 2.4, 4.4], look: [-0.4, 1.2, -1.4], fov: 42, ease: 'surge' },
    { f: 80, pos: [2.6, 2.0, 3.0], look: [-1.2, 1.0, -0.8], fov: 40, ease: 'surge' },
    { f: 105, pos: [0.4, 2.0, 3.2], look: [-3.0, 1.5, -2.2], fov: 44, ease: 'surge' },
    { f: 135, pos: [0.2, 1.95, 3.0], look: [-3.1, 1.5, -2.25], fov: 44 },
  ],
  pitch: [
    { f: 136, pos: [0.2, 1.95, 3.0], look: [-3.1, 1.5, -2.25], fov: 44 },
    { f: 175, pos: [2.8, 2.1, 3.6], look: [-0.7, 1.0, -0.7], fov: 41, ease: 'surge' },
    { f: 312, pos: [3.0, 2.2, 3.4], look: [0, 1.35, -2.2], fov: 40, ease: 'surge' },
    { f: 400, pos: [2.2, 1.9, 2.6], look: [0, 0.75, -0.8], fov: 38, ease: 'surge' },
    { f: 432, pos: [1.9, 1.8, 2.2], look: [-0.9, 0.9, -0.7], fov: 37, ease: 'surge' },
    { f: 459, pos: [1.85, 1.78, 2.1], look: [-1.1, 0.9, -0.7], fov: 37 },
  ],
  weave: [
    { f: 460, pos: [1.85, 1.78, 2.1], look: [-1.1, 0.9, -0.7], fov: 37 },
    { f: 495, pos: [-1.6, 1.9, 2.9], look: [-4.3, 0.85, -1.0], fov: 41, ease: 'surge' },
    { f: 545, pos: [-2.0, 1.8, 2.5], look: [-4.6, 0.75, -0.9], fov: 40, ease: 'surge' },
    { f: 572, pos: [-3.4, 1.85, 2.7], look: [-6.2, 0.85, -1.0], fov: 41, ease: 'surge' },
    { f: 597, pos: [-3.5, 1.82, 2.6], look: [-6.2, 0.85, -1.0], fov: 41 },
  ],
  inspect1: [
    { f: 598, pos: [-3.5, 1.82, 2.6], look: [-6.2, 0.85, -1.0], fov: 41 },
    { f: 640, pos: [-1.7, 1.9, 3.0], look: [-3.9, 0.9, -0.6], fov: 41, ease: 'surge' },
    { f: 740, pos: [-1.9, 1.85, 2.7], look: [-4.3, 0.95, -0.8], fov: 39, ease: 'surge' },
    { f: 837, pos: [-1.6, 1.9, 2.9], look: [-3.3, 1.1, 0.45], fov: 40, ease: 'surge' },
    { f: 895, pos: [-1.7, 1.88, 2.8], look: [-3.3, 1.1, 0.45], fov: 40 },
  ],
  inspect2: [
    { f: 896, pos: [-1.7, 1.88, 2.8], look: [-3.3, 1.1, 0.45], fov: 40 },
    { f: 925, pos: [-3.6, 1.9, 3.0], look: [-5.9, 0.9, -0.6], fov: 41, ease: 'surge' },
    { f: 955, pos: [-3.7, 1.88, 2.8], look: [-5.3, 1.1, 0.45], fov: 40, ease: 'surge' },
    { f: 984, pos: [-3.8, 1.86, 2.7], look: [-5.3, 1.1, 0.45], fov: 40 },
  ],
  kingvisit: [
    { f: 985, pos: [-3.8, 1.86, 2.7], look: [-5.3, 1.1, 0.45], fov: 40 },
    { f: 1020, pos: [-1.5, 2.0, 3.2], look: [-3.6, 1.1, 0.2], fov: 41, ease: 'surge' },
    { f: 1085, pos: [-1.2, 1.95, 2.9], look: [-3.3, 1.2, 0.4], fov: 39, ease: 'surge' },
    { f: 1140, pos: [-1.0, 1.9, 2.7], look: [-3.15, 1.25, 0.5], fov: 38, ease: 'surge' },
    { f: 1183, pos: [-0.9, 1.88, 2.6], look: [-3.15, 1.25, 0.5], fov: 38 },
  ],
  dress: [
    { f: 1184, pos: [-0.9, 1.88, 2.6], look: [-3.15, 1.25, 0.5], fov: 38 },
    { f: 1215, pos: [2.6, 2.1, 3.4], look: [0, 1.25, 0.3], fov: 41, ease: 'surge' },
    { f: 1245, pos: [2.2, 1.95, 2.8], look: [0, 1.3, 0.3], fov: 39, ease: 'surge' },
    { f: 1272, pos: [2.1, 1.92, 2.7], look: [0, 1.3, 0.3], fov: 39 },
  ],
  parade: [
    { f: 1273, pos: [2.1, 1.92, 2.7], look: [0, 1.3, 0.3], fov: 39 },
    { f: 1305, pos: [4.6, 2.4, 1.8], look: [0, 1.25, 6.2], fov: 43, ease: 'surge' },
    { f: 1380, pos: [4.0, 2.3, 1.6], look: [0.2, 1.2, 6.2], fov: 41, ease: 'surge' },
    { f: 1425, pos: [3.4, 2.2, 2.2], look: [3.05, 1.9, 8.3], fov: 40, ease: 'surge' },
    { f: 1500, pos: [3.3, 2.15, 2.3], look: [2.45, 1.9, 8.7], fov: 40, ease: 'surge' },
    { f: 1545, pos: [3.3, 2.15, 2.3], look: [2.45, 1.9, 8.7], fov: 40 },
    { f: 1557, pos: [4.6, 2.5, 1.6], look: [1.0, 1.3, 7.4], fov: 44, ease: 'surge' },
    { f: 1660, pos: [4.1, 2.35, 1.7], look: [0.2, 1.25, 6.3], fov: 41, ease: 'surge' },
    { f: 1722, pos: [4.0, 2.3, 1.6], look: [0.2, 1.25, 6.3], fov: 41 },
  ],
  hookout: [
    { f: 1723, pos: [4.0, 2.3, 1.6], look: [0.2, 1.25, 6.3], fov: 41 },
    { f: 1790, pos: [4.6, 2.3, 2.6], look: [3.4, 1.3, 7.0], fov: 42, ease: 'surge' },
    { f: 1860, pos: [3.5, 2.15, 2.6], look: [6.5, 1.5, 7.0], fov: 43, ease: 'surge' },
    { f: 1939, pos: [3.3, 2.1, 2.3], look: [6.6, 1.5, 7.0], fov: 43 },
  ],
};
export const camAt = (f) => camFromKeys(CAMS[shotAt(f).id], f);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), hp = heroPosAtInner(f);
  let cinf = 5;
  if (S.id === 'pitch' || S.id === 'dress') cinf = 3.6;
  if (S.id === 'hookout') cinf = 4;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { boardTitle: 0, boardShout: 0, boardHook: 0, goldK: 0 };
  if (S.id === 'hook') W.boardTitle = smooth(ramp(f, 100, 118));
  if (S.id === 'pitch') W.goldK = 1;
  if (S.id === 'parade') W.boardShout = smooth(ramp(f, 1501, 1525)) * (1 - smooth(ramp(f, 1532, 1544)));
  if (S.id === 'hookout') W.boardHook = smooth(ramp(f, 1870, 1905)); // holds to the last frame — no fade-out
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return { smokeRate: 0.22, dustRate: S.id === 'parade' || S.id === 'hookout' ? 0.4 : 0.08 };
};

// ---------- actors ----------
const TINT = { day: '#ffffff', court: '#ffd9a3' };
const tintFor = (S, f) => TINT[S.light] || '#ffffff';
export const OUTFITS = {
  // राजा: royal red robe + gold crown, stout
  king: { jacket: '#7a1f2e', pants: '#3a2a4a', boots: '#241a12', hat: 'crown', skin: '#e8b08a', moustache: '#d8d0c0', build: 'stout', dress: '#7a1f2e' },
  // राजा (जुलूस): crown + dhoti only — bare chest (jacket = skin tone)
  kingBare: { jacket: '#e8b08a', pants: '#f0e6d2', boots: '#241a12', hat: 'crown', skin: '#e8b08a', moustache: '#d8d0c0', build: 'stout', buttons: '#e8b08a' },
  // जुलाहे: craftsmen — earthy work clothes
  weaverA: { jacket: '#7a5c38', pants: '#4a3a28', boots: '#3a2a1a', hat: 'hair', hair: '#2a2018', skin: '#c98a5a', moustache: '#3a2c1c' },
  weaverB: { jacket: '#5d6e46', pants: '#3e4a34', boots: '#2e2418', hat: 'cap', cap: '#8a6d3b', skin: '#b57a4e' },
  // मंत्री: court dress + turbans (old minister: grey turban + white moustache)
  ministerOld: { jacket: '#4a4a6e', pants: '#33334a', boots: '#241a12', hat: 'turban', turban: '#d9d4c8', skin: '#d9a878', moustache: '#e8e8e8', dress: '#4a4a6e' },
  minister2: { jacket: '#2e5a8c', pants: '#22344a', boots: '#2e2118', hat: 'turban', turban: '#f3e3bb', skin: '#c98a5a', dress: '#2e5a8c' },
  courtier: { jacket: '#5d3a6e', pants: '#33243d', boots: '#241a12', hat: 'cap', cap: '#3a2a4a', skin: '#e8b08a' },
  guard: { jacket: '#8c2f39', pants: '#2a2e3d', boots: '#1c1a17', hat: 'shako', belt: '#e8c45a', skin: '#e8b08a' },
  father: { jacket: '#6a5138', pants: '#4a3a2c', boots: '#33261a', hat: 'hair', hair: '#241c14', skin: '#b57a4e' },
  boy: { jacket: '#c96a2c', pants: '#3b5b9a', boots: '#5a3b2a', hat: 'hair', hair: '#1e160f', skin: '#e0aa72', build: 'kid' },
  crowd1: { jacket: '#7a6a4a', pants: '#4c4234', boots: '#33261a', hat: 'hair', hair: '#2a2018', skin: '#c98a5a' },
  crowd2: { jacket: '#54683e', pants: '#3c4630', boots: '#2e2418', hat: 'cap', cap: '#6e4a3a', skin: '#b57a4e' },
  crowd3: { jacket: '#8a5a30', pants: '#54432c', boots: '#33261a', hat: 'hair', hair: '#1e160f', skin: '#d9a878' },
  crowd4: { jacket: '#4a5a74', pants: '#323c4c', boots: '#241c14', hat: 'cap', cap: '#37455c', skin: '#c98a5a' },
};
const drawFigure = (T, o, opts) => (p) => { T.bodyFront(p, o, opts); };
const A = (T, o, opts, pos, extra = {}) => ({
  key: (extra.tag || 'fig') + JSON.stringify(o) + JSON.stringify(opts),
  draw: drawFigure(T, o, opts),
  x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], ...extra.out,
});
const idleTilt = (f, seed) => q(1.5 * Math.sin(f * 0.037 + seed * 1.3), 1);
const fig = (T, tint, f) => (o, expr, seed, pos, opts = {}, out = {}) => A(T, o, { expr, mode: 'stand', blink: blinkAt(f, seed), seed, headTilt: idleTilt(f, seed), ...opts }, pos, { tag: 'f' + seed, out: { tint, ...out } });
const bowK = (f, a, b, c, d) => smooth(ramp(f, a, b)) * (1 - smooth(ramp(f, c, d)));
const bowOpts = (k) => ({ headTilt: q(k * 17, 1) });
const BP = (pos, k) => [pos[0], q(-0.07 * k, 3), pos[2]];
const marchPhase = (f, f0) => q(((f - f0) / 27) % 1, 2);
const weavePhase = (f) => q(((f * 0.85 / 30) % 1), 2);

export const actorsAt = (f, T) => {
  const S = shotAt(f), tint = tintFor(S, f), out = [];
  const st = fig(T, tint, f);
  const kingSit = (expr, opts = {}) => A(T, OUTFITS.king, { expr, mode: 'sit', blink: blinkAt(f, 31), seed: 31, ...opts }, THRONE, { tag: 'king', out: { tint } });
  const court = () => {
    out.push(st(OUTFITS.courtier, 'neutral', 71, COURT_L, {}, { yaw: 0.2 }));
    out.push(st(OUTFITS.guard, 'stern', 61, GUARD_L, {}, { yaw: 0.15 }));
    out.push(st(OUTFITS.guard, 'stern', 62, GUARD_R, {}, { yaw: -0.15 }));
    out.push(st(OUTFITS.ministerOld, 'neutral', 41, MIN_OLD, {}, { yaw: -0.2 }));
    out.push(st(OUTFITS.minister2, 'neutral', 42, MIN_2, {}, { yaw: -0.25 }));
  };
  const weaverSit = (o, seed, pos, extraOpts = {}) => A(T, o, { expr: 'neutral', mode: 'sit', blink: blinkAt(f, seed), seed, weave: weavePhase(f + seed * 40), ...extraOpts }, pos, { tag: 'wv' + seed, out: { tint } });
  switch (S.id) {
    case 'hook': {
      out.push(kingSit('stern'));
      court();
      const k = bowK(f, 25, 50, 105, 130);
      out.push(A(T, OUTFITS.weaverA, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 11), seed: 11, ...bowOpts(k) }, BP(WV_A_COURT, k), { tag: 'wvA', out: { tint, yaw: 0.25 } }));
      out.push(A(T, OUTFITS.weaverB, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 12), seed: 12, ...bowOpts(k) }, BP(WV_B_COURT, k), { tag: 'wvB', out: { tint, yaw: -0.25 } }));
      break;
    }
    case 'pitch': {
      // weavers bow deep, then pitch with a flourish; at "ये लो" the king
      // waves the gold over — weaver A takes the pouch (IN his hand, prop
      // patch), weaver B the silk bundle: hand-to-hand over the table.
      const k = bowK(f, 140, 168, 225, 250);
      const pitchWave = f >= 200 && f < 300 ? q(0.45 + 0.25 * Math.sin(f * 0.25), 2) : 0;
      if (f >= 395 && f < 450) {
        out.push(A(T, OUTFITS.king, { expr: 'grin', mode: 'sit', blink: blinkAt(f, 31), seed: 31, wave: q(0.5 + 0.3 * Math.sin(f * 0.22), 2) }, THRONE, { tag: 'kingW', out: { tint } }));
      } else {
        out.push(kingSit(f < 312 ? 'neutral' : 'grin', f >= 312 ? { headTilt: q(-3, 1) } : {}));
      }
      court();
      out.push(A(T, OUTFITS.weaverA, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 11), seed: 11, ...(f < 395 ? bowOpts(k) : {}), wave: pitchWave || undefined, prop: f >= 413 ? ['pouch', q(clamp((f - 413) / 22), 2)] : undefined }, BP(WV_A_COURT, k), { tag: 'wvA', out: { tint, yaw: 0.25 } }));
      out.push(A(T, OUTFITS.weaverB, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 12), seed: 12, ...(f < 395 ? bowOpts(k) : {}), prop: f >= 424 ? ['silk', q(clamp((f - 424) / 22), 2)] : undefined }, BP(WV_B_COURT, k), { tag: 'wvB', out: { tint, yaw: -0.25 } }));
      break;
    }
    case 'weave': {
      // both weavers at their bare looms, hands tracking the empty frames
      out.push(weaverSit(OUTFITS.weaverA, 11, SEAT_A));
      out.push(weaverSit(OUTFITS.weaverB, 12, SEAT_B));
      break;
    }
    case 'inspect1': {
      // old minister stares at the bare loom (head down), panic, then praises
      const praise = f >= 837;
      out.push(weaverSit(OUTFITS.weaverA, 11, SEAT_A, { expr: 'grin' }));
      out.push(st(OUTFITS.weaverB, 'grin', 12, WV_B_STAND, {}, { yaw: 0.3 }));
      out.push(A(T, OUTFITS.ministerOld, { expr: praise ? 'smile' : f < 767 ? 'neutral' : 'nervous', mode: 'stand', blink: blinkAt(f, 41), seed: 41, headTilt: q(praise ? -2 : 9, 1), wave: praise ? q(0.45 + 0.25 * Math.sin(f * 0.25), 2) : undefined }, MIN_OLD_LOOM, { tag: 'minO', out: { tint, yaw: -0.45 } }));
      break;
    }
    case 'inspect2': {
      const praise = f >= 955;
      out.push(weaverSit(OUTFITS.weaverB, 12, SEAT_B, { expr: 'grin' }));
      out.push(st(OUTFITS.weaverA, 'grin', 11, WV_A_STAND, {}, { yaw: -0.3 }));
      out.push(A(T, OUTFITS.minister2, { expr: praise ? 'smile' : 'nervous', mode: 'stand', blink: blinkAt(f, 42), seed: 42, headTilt: q(praise ? -2 : 9, 1), wave: praise ? q(0.45 + 0.25 * Math.sin(f * 0.25), 2) : undefined }, MIN_2_LOOM, { tag: 'min2', out: { tint, yaw: -0.45 } }));
      break;
    }
    case 'kingvisit': {
      // the king himself at loom A: stares, stomach turns (shock), then roars praise
      const roar = f >= 1117;
      out.push(weaverSit(OUTFITS.weaverA, 11, SEAT_A, { expr: 'grin' }));
      out.push(st(OUTFITS.weaverB, 'grin', 12, WV_B_STAND, {}, { yaw: 0.3 }));
      out.push(A(T, OUTFITS.king, { expr: roar ? 'grin' : f < 1058 ? 'neutral' : 'shock', mode: 'stand', blink: blinkAt(f, 31), seed: 31, headTilt: q(roar ? -4 : 8, 1), wave: roar ? q(0.55 + 0.25 * Math.sin(f * 0.25), 2) : undefined }, KING_LOOM, { tag: 'king', out: { tint, yaw: -0.35 } }));
      break;
    }
    case 'dress': {
      // the mime: weavers "dress" the king — hands smoothing the invisible
      // cloth ON his shoulders; the king already wears nothing but dhoti+crown
      const mime = q(0.5 + 0.35 * Math.sin(f * 0.3), 2);
      out.push(A(T, OUTFITS.kingBare, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 31), seed: 31, headTilt: q(-5, 1) }, KING_STAND, { tag: 'king', out: { tint } }));
      out.push(A(T, OUTFITS.weaverA, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 11), seed: 11, wave: mime }, WV_A_DRESS, { tag: 'wvA', out: { tint, yaw: 0.55 } }));
      out.push(A(T, OUTFITS.weaverB, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 12), seed: 12, wave: q(0.5 + 0.35 * Math.sin(f * 0.3 + 2.1), 2) }, WV_B_DRESS, { tag: 'wvB', out: { tint, yaw: -0.55 } }));
      out.push(st(OUTFITS.courtier, 'neutral', 71, COURT_L, {}, { yaw: 0.2 }));
      out.push(st(OUTFITS.ministerOld, 'smile', 41, MIN_OLD, {}, { yaw: -0.2 }));
      break;
    }
    case 'parade': {
      // the king marches (march cycle, feet planted by the cycle) down the
      // street; the crowd praises — until the boy shouts the truth.
      const shouted = f >= 1489, laughing = f >= 1589;
      out.push(A(T, OUTFITS.kingBare, { expr: laughing ? 'stern' : 'grin', mode: 'march', phase: marchPhase(f, 1273), blink: blinkAt(f, 31), seed: 31, headTilt: q(-6, 1) }, KING_ST, { tag: 'king', out: { tint } }));
      const crowdExpr = laughing ? 'laugh' : shouted ? 'shock' : 'smile';
      const cheer = (seed) => laughing ? {} : { wave: q(0.4 + 0.3 * Math.sin(f * 0.24 + seed), 2) };
      CROWD_N.forEach((pos, i) => out.push(st([OUTFITS.crowd1, OUTFITS.crowd2, OUTFITS.crowd3, OUTFITS.crowd4][i], crowdExpr, 81 + i, pos, cheer(81 + i), { yaw: i < 2 ? 0.3 : -0.3 })));
      CROWD_S.forEach((pos, i) => out.push(st([OUTFITS.crowd2, OUTFITS.crowd4, OUTFITS.crowd1][i], crowdExpr, 91 + i, pos, cheer(91 + i), { yaw: i < 2 ? -0.25 : 0.25 })));
      out.push(st(OUTFITS.father, shouted && !laughing ? 'shock' : laughing ? 'laugh' : 'smile', 95, FATHER, {}, { yaw: -0.2 }));
      // the boy SEATED on his father's shoulders (seat at shoulder height)
      out.push(A(T, OUTFITS.boy, { expr: shouted ? 'shock' : 'smile', mode: 'sit', blink: blinkAt(f, 96), seed: 96, wave: shouted && !laughing ? q(0.55 + 0.2 * Math.sin(f * 0.3), 2) : undefined }, BOY, { tag: 'boy', out: { tint, yaw: -0.15, s: 0.62 } }));
      break;
    }
    case 'hookout': {
      out.push(A(T, OUTFITS.kingBare, { expr: 'stern', mode: 'march', phase: marchPhase(f, 1273), blink: blinkAt(f, 31), seed: 31, headTilt: q(-6, 1) }, KING_ST, { tag: 'king', out: { tint } }));
      CROWD_N.forEach((pos, i) => out.push(st([OUTFITS.crowd1, OUTFITS.crowd2, OUTFITS.crowd3, OUTFITS.crowd4][i], 'laugh', 81 + i, pos, {}, { yaw: i < 2 ? 0.3 : -0.3 })));
      out.push(st(OUTFITS.father, 'laugh', 95, FATHER, {}, { yaw: -0.2 }));
      out.push(A(T, OUTFITS.boy, { expr: 'laugh', mode: 'sit', blink: blinkAt(f, 96), seed: 96 }, BOY, { tag: 'boy', out: { tint, yaw: -0.15, s: 0.62 } }));
      break;
    }
  }
  return out;
};
export const fxAt = (f, T) => {
  const out = [];
  const burst = (key, x, y, z, t) => out.push({ key, draw: (p) => T.fxBurst(p, t, '#ffe066', 9, 26, 140), x, y, z, blob: false, shadow: false });
  // coin glint at the yarn basket as the weavers pocket the gold (L4)
  if (f >= 556 && f <= 572) burst('coins_' + q((f - 556) / 16, 2), -3.3, 0.6, -0.9, q((f - 556) / 16, 2));
  // sparkle where the "cloth" is praised over the bare looms
  if (f >= 858 && f <= 874) burst('praise1_' + q((f - 858) / 16, 2), -4.3, 1.5, -0.6, q((f - 858) / 16, 2));
  if (f >= 960 && f <= 976) burst('praise2_' + q((f - 960) / 16, 2), -6.3, 1.5, -0.6, q((f - 960) / 16, 2));
  if (f >= 1120 && f <= 1136) burst('roar_' + q((f - 1120) / 16, 2), -3.15, 1.9, 0.5, q((f - 1120) / 16, 2));
  // the boy's shout
  if (f >= 1489 && f <= 1505) burst('shout_' + q((f - 1489) / 16, 2), BOY[0], 2.6, BOY[2], q((f - 1489) / 16, 2));
  return out;
};
