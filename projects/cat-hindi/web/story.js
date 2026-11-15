// "वो बिल्ली जिसने मक्खन खाया" — Hindi trick batch 3, topic 4.
// Timed DIRECTLY to the Hindi stem (56.45 s, 30 fps, TOTAL 1694) from the
// faster-whisper word timings (cat-hindi-voice/words.json, 216 words).
// Every shot starts on a clause boundary; every camera key lands on the word
// that names its subject. Camera Law: the camera TRACKS the voice-named
// subject, holds with a slow push-in, never freezes, never drifts aimlessly.
// Clause map (s): L1 hook 0.00 | makhan 0.46 | gayab 1.04 | naukar 2.52 |
// billi 3.12 | subah 4.80 | tarazu 5.74 | toul 6.24 | doshi 7.84 ||
// L2 har-subah 8.72 | makhan 9.90 | bartan 10.32 | naukar 12.34 | malik
// 13.56 | billi 13.94 || L3 bartan 15.18 | bilkul-khali 15.66 | ek-kilo
// 16.88 | makhan-gayab 17.30 | naukar 18.42 | kandhe 18.90 | billi 19.62 |
// bhookh 20.62 || L4 malik 21.18 | uthaya 23.18 | tarazu 24.06 | sui 25.06 |
// dekha 25.50 || L5 bilkul 25.96 | ek-kilo 26.30 || L6 naukar 27.24 |
// muda 27.80 | batao 29.14 | billi 30.12 | makhan-kahan 30.94 || L7 naukar
// 31.64 | munh-khola 32.32 | kuch-bhi 32.68 || L8 makhan-hai 34.32 |
// malik-kaha 35.30 | billi-kahan 36.26 || L9 naukar 37.22 | ghutno 37.54 |
// gir-pada 38.10 | billi 38.74 | neeche-kood 38.98 | panje-chaate 39.98 |
// chali-gayi 40.78 | bekasoor 41.92 || L10 us-din 42.48 | makhan-bartan
// 43.36 | hamesha-bhara 44.00 | naukar 45.16 | phir-kabhi 45.56 |
// ilzaam-nahi 46.34 || L11 lekin 47.42 | chatur-jawab 48.26 | aadmi 49.14 |
// raja 50.16 | ajeeb-sawal 50.76 | kitne-kauwe 52.72 | ek-second 54.10 |
// sahi-tha 55.48 | kaise 56.06.
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1694, DECK = 0;
export const SHOTS = [
  { id: 'hookpot', a: 0, b: 261, light: 'morning' },
  { id: 'empty', a: 262, b: 635, light: 'morning' },
  { id: 'weigh', a: 636, b: 771, light: 'morning' },
  { id: 'reveal', a: 772, b: 812, light: 'morning' },
  { id: 'riddle', a: 813, b: 1107, light: 'morning' },
  { id: 'kneel', a: 1108, b: 1274, light: 'morning' },
  { id: 'fullpot', a: 1275, b: 1422, light: 'morning' },
  { id: 'hookcrow', a: 1423, b: 1693, light: 'day' },
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
  morning: { az: 100, el: 28, sky: '#e8c9a0', ground: '#6a5a40', hemi: 1.18, sun: '#ffd9a0', sunI: 2.3, fog: '#e5cf9e', fogNear: 42, fogFar: 340,
    skyTop: '#7fa0d0', skyHor: '#ffe0b0', sunDisc: '#fff3cf', sunSize: 0.0036, sat: 1.08, vig: 0.22, shadowExt: 18, aurora: 0, gain: '#ffedd6', ...WATER },
};
const hexLerp = (a, b, t) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(lerp(v, pb[i], t)).toString(16).padStart(2, '0')).join('');
};
const blendLight = (A, B, t) => {
  const o = {};
  for (const k of Object.keys(A)) o[k] = typeof A[k] === 'number' ? lerp(A[k], B[k], t) : hexLerp(A[k], B[k], t);
  return o;
};
export const lightFor = (S, f) => {
  if (S.id === 'hookcrow') return blendLight(LIGHTS.morning, LIGHTS.day, smooth(ramp(f, 1423, 1490)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging ----------
// Kitchen: table at origin (z=-1.0), butter pot west end, scales east end.
// Scales: pillar at [0.95, 1.0, -1.0], beam y=1.68, LEFT pan centre [0.43, 1.38, -1.0].
export const TABLE = [0, 0, -1.0];
export const POT = [-0.75, 1.0, -1.0];
export const SCALES = [0.95, 1.0, -1.0];
export const PAN_L = [0.43, 1.38, -1.0];
export const MASTER = [1.7, 0, 0.7];
export const MASTER_W = [-0.9, 0, 1.2]; // master stands WEST of the table while weighing —
// his east-side post [1.7, 0, 0.7] sits exactly on the weigh/reveal camera axis
// and his head filled the frame (f0760/f0790/f0900). He returns east for kneel+.
export const SERVANT = [-1.7, 0, 0.7];
export const CAT_FLOOR = [-1.3, 0, 0.2];
export const WINDOW = [3.6, 0, -3.1];
export const BOARD_BUTTER = [-2.0, 1.5, -2.15];
export const BOARD_SCALE = [2.9, 1.5, -2.0];
export const BOARD_HOOK = [4.8, 1.5, -2.6];

const catJump = (f) => kf3([[1155, PAN_L], [1185, [-0.2, 0.55, -0.4]], [1210, [-0.9, 0, 0.1]]], f);
const catWalk = (f) => kf3([[1215, [-0.9, 0, 0.1]], [1274, [1.6, 0, 0.6]]], f);
const heroPosAtInner = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'hookpot': return [POT[0], 1.3, POT[2]];
    case 'empty': return f < 370 ? [POT[0], 1.3, POT[2]] : f < 470 ? [SERVANT[0], 1.1, SERVANT[2]] : [BOARD_BUTTER[0], BOARD_BUTTER[1], BOARD_BUTTER[2]];
    case 'weigh': return [PAN_L[0], 1.5, PAN_L[2]];
    case 'reveal': return [BOARD_SCALE[0], BOARD_SCALE[1], BOARD_SCALE[2]];
    case 'riddle': return f < 874 ? [SERVANT[0], 1.1, SERVANT[2]] : f < 904 ? [MASTER_W[0], 1.1, MASTER_W[2]] : f < 928 ? [PAN_L[0], 1.5, PAN_L[2]] : f < 970 ? [POT[0], 1.3, POT[2]] : f < 1059 ? [SERVANT[0], 1.1, SERVANT[2]] : f < 1088 ? [MASTER_W[0], 1.1, MASTER_W[2]] : [PAN_L[0], 1.5, PAN_L[2]];
    case 'kneel': { const p = catJump(f); return f < 1162 ? [SERVANT[0], 0.8, SERVANT[2]] : f < 1215 ? [p[0], Math.max(0.4, p[1]) + 0.4, p[2]] : [1.6, 0.4, 0.6]; }
    case 'fullpot': return [POT[0], 1.3, POT[2]];
    case 'hookcrow': return f < 1505 ? [MASTER[0], 1.2, MASTER[2]] : f < 1582 ? [3.4, 1.4, -3.0] : [BOARD_HOOK[0], BOARD_HOOK[1], BOARD_HOOK[2]];
    default: return [0, 1, 0];
  }
};
export const heroPosAt = heroPosAtInner;

// ---------- cameras (keys land on clause words; look = voice-named subject) ----------
// Board windows: boardButter f470-635 (look AT it), boardScale f782-812,
// boardHook f1600-1693 (look AT it, holds to the last frame).
const CAMS = {
  hookpot: [
    { f: 0, pos: [4.6, 2.6, 5.6], look: [0, 1.2, -1.0], fov: 44 },
    { f: 31, pos: [3.8, 2.3, 4.6], look: [-0.6, 1.25, -1.0], fov: 41, ease: 'surge' },
    { f: 94, pos: [2.6, 2.0, 3.6], look: [-1.3, 0.55, 0.2], fov: 39, ease: 'surge' },
    { f: 172, pos: [2.4, 1.9, 2.8], look: [0.7, 1.4, -1.0], fov: 38, ease: 'surge' },
    { f: 235, pos: [2.2, 1.7, 2.2], look: [0.43, 1.42, -1.0], fov: 36, ease: 'surge' },
    { f: 261, pos: [2.1, 1.68, 2.0], look: [0.43, 1.42, -1.0], fov: 36 },
  ],
  empty: [
    { f: 262, pos: [2.1, 1.68, 2.0], look: [0.43, 1.42, -1.0], fov: 36 },
    { f: 297, pos: [2.6, 2.0, 3.4], look: [-0.75, 1.25, -1.0], fov: 40, ease: 'surge' },
    { f: 370, pos: [3.2, 2.0, 4.0], look: [-1.7, 1.1, 0.7], fov: 40, ease: 'surge' },
    { f: 418, pos: [-3.2, 1.9, 3.6], look: [-1.3, 0.55, 0.2], fov: 38, ease: 'surge' },
    { f: 470, pos: [0.6, 2.0, 3.4], look: [-1.7, 1.35, -1.9], fov: 46, ease: 'surge' },
    { f: 553, pos: [0.4, 1.9, 3.0], look: [-1.9, 1.35, -1.9], fov: 44, ease: 'surge' },
    { f: 635, pos: [0.3, 1.88, 2.9], look: [-2.0, 1.4, -2.0], fov: 44 },
  ],
  weigh: [
    { f: 636, pos: [0.3, 1.88, 2.9], look: [-2.0, 1.4, -2.0], fov: 44 },
    { f: 695, pos: [2.8, 2.0, 3.4], look: [0.2, 1.2, -1.0], fov: 40, ease: 'surge' },
    { f: 722, pos: [2.4, 1.8, 2.6], look: [0.6, 1.4, -1.0], fov: 37, ease: 'surge' },
    { f: 752, pos: [2.1, 2.0, 2.5], look: [0.7, 1.35, -1.0], fov: 38, ease: 'surge' },
    { f: 771, pos: [2.1, 2.0, 2.45], look: [0.7, 1.35, -1.0], fov: 38 },
  ],
  reveal: [
    { f: 772, pos: [2.1, 2.0, 2.45], look: [0.7, 1.35, -1.0], fov: 38 },
    { f: 782, pos: [1.2, 1.8, 2.4], look: [2.9, 1.5, -2.0], fov: 47, ease: 'surge' },
    { f: 812, pos: [1.4, 1.75, 2.2], look: [2.9, 1.5, -2.0], fov: 46 },
  ],
  riddle: [
    { f: 813, pos: [1.4, 1.75, 2.2], look: [2.9, 1.5, -2.0], fov: 42 },
    { f: 874, pos: [3.4, 2.0, 3.6], look: [-0.9, 1.2, 1.2], fov: 40, ease: 'surge' },
    { f: 904, pos: [2.4, 1.8, 2.4], look: [0.43, 1.42, -1.0], fov: 37, ease: 'surge' },
    { f: 928, pos: [1.8, 1.8, 2.6], look: [-0.75, 1.3, -1.0], fov: 38, ease: 'surge' },
    { f: 970, pos: [-3.2, 1.9, 3.4], look: [-1.7, 1.15, 0.7], fov: 38, ease: 'surge' },
    { f: 1059, pos: [-3.0, 1.9, 3.2], look: [-0.9, 1.15, 1.2], fov: 38, ease: 'surge' },
    { f: 1088, pos: [2.4, 1.8, 2.4], look: [0.43, 1.42, -1.0], fov: 37, ease: 'surge' },
    { f: 1107, pos: [2.3, 1.78, 2.3], look: [0.43, 1.42, -1.0], fov: 37 },
  ],
  kneel: [
    { f: 1108, pos: [2.3, 1.78, 2.3], look: [0.43, 1.42, -1.0], fov: 37 },
    { f: 1126, pos: [-3.6, 2.3, 5.2], look: [-1.7, 0.9, 0.7], fov: 42, ease: 'surge' },
    { f: 1143, pos: [-3.6, 2.25, 5.0], look: [-1.7, 0.6, 0.7], fov: 42, ease: 'surge' },
    { f: 1169, pos: [0.6, 2.1, 4.6], look: [-0.4, 0.7, -0.3], fov: 42, ease: 'surge' },
    { f: 1199, pos: [0.8, 2.0, 4.6], look: [-0.9, 0.4, 0.1], fov: 42, ease: 'surge' },
    { f: 1223, pos: [1.2, 2.0, 4.8], look: [0.4, 0.4, 0.3], fov: 42, ease: 'surge' },
    { f: 1258, pos: [1.8, 2.0, 4.8], look: [1.6, 0.45, 0.6], fov: 42, ease: 'surge' },
    { f: 1274, pos: [1.85, 1.98, 4.7], look: [1.6, 0.45, 0.6], fov: 42 },
  ],
  fullpot: [
    { f: 1275, pos: [1.85, 1.98, 4.7], look: [1.6, 0.45, 0.6], fov: 42 },
    { f: 1301, pos: [1.8, 1.8, 2.8], look: [-0.75, 1.25, -1.0], fov: 37, ease: 'surge' },
    { f: 1355, pos: [3.2, 2.0, 3.8], look: [-1.7, 1.1, 0.7], fov: 39, ease: 'surge' },
    { f: 1390, pos: [3.0, 1.95, 3.6], look: [-1.7, 1.15, 0.7], fov: 38, ease: 'surge' },
    { f: 1422, pos: [3.6, 2.2, 4.8], look: [-0.5, 1.2, -0.5], fov: 40 },
  ],
  hookcrow: [
    { f: 1423, pos: [3.6, 2.2, 4.8], look: [-0.5, 1.2, -0.5], fov: 40 },
    { f: 1474, pos: [4.4, 2.4, 5.4], look: [1.7, 1.2, 0.7], fov: 42, ease: 'surge' },
    { f: 1505, pos: [3.8, 2.2, 4.0], look: [3.4, 1.4, -3.0], fov: 42, ease: 'surge' },
    { f: 1582, pos: [4.6, 2.0, 1.5], look: [2.9, 1.3, -3.1], fov: 42, ease: 'surge' }, // crow beat: shoot from the RIGHT so the master (at [1.7,0,0.7]) can't fill the frame
    { f: 1600, pos: [2.2, 1.85, 1.6], look: [4.8, 1.45, -2.6], fov: 42, ease: 'surge' },
    { f: 1693, pos: [2.3, 1.8, 1.4], look: [4.8, 1.45, -2.6], fov: 42 },
  ],
};
export const camAt = (f) => camFromKeys(CAMS[shotAt(f).id], f);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), hp = heroPosAtInner(f);
  let cinf = 5;
  if (S.id === 'weigh' || S.id === 'reveal') cinf = 3.6;
  if (S.id === 'hookcrow') cinf = 4;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { boardButter: 0, boardScale: 0, boardHook: 0, butterK: 1, scaleTilt: 0, needleK: 0, lidK: 0, crowK: 1 };
  if (S.id === 'hookpot') W.butterK = 1 - 0.1 * ramp(f, 120, 261);
  if (S.id === 'empty') {
    W.butterK = 0.9 - 0.85 * smooth(ramp(f, 280, 620));
    W.lidK = smooth(ramp(f, 300, 340));
    W.boardButter = smooth(ramp(f, 470, 485)) * (1 - smooth(ramp(f, 615, 635)));
  }
  if (S.id === 'weigh') {
    W.butterK = 0.05; W.lidK = 1;
    W.scaleTilt = 0.14 * smooth(ramp(f, 720, 760)) * (1 - smooth(ramp(f, 770, 771))); // +z rotation drops the cat's (left) pan
    W.needleK = smooth(ramp(f, 740, 771));
  }
  if (S.id === 'reveal') {
    W.butterK = 0.05; W.lidK = 1; W.needleK = 1;
    W.boardScale = smooth(ramp(f, 782, 795)) * (1 - smooth(ramp(f, 805, 812)));
  }
  if (S.id === 'riddle') { W.butterK = 0.05; W.lidK = 1; W.needleK = 1; }
  if (S.id === 'kneel') { W.butterK = 0.05; W.lidK = 1; W.needleK = 1; }
  if (S.id === 'fullpot') { W.butterK = 1; W.lidK = 0; W.needleK = 0; }
  if (S.id === 'hookcrow') {
    W.butterK = 1; W.lidK = 0; W.needleK = 0;
    W.boardHook = smooth(ramp(f, 1600, 1630)); // holds to the last frame — no fade-out
  }
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return { smokeRate: 0.25, dustRate: S.id === 'kneel' ? 0.5 : 0.1 };
};

// ---------- actors ----------
const TINT = { day: '#ffffff', morning: '#ffd9a3' };
const tintFor = (S, f) => {
  if (S.id === 'hookcrow') return hexLerp('#ffd9a3', '#ffffff', smooth(ramp(f, 1423, 1490)));
  return TINT[S.light] || '#ffffff';
};
export const OUTFITS = {
  // मालिक: rich householder — maroon kurta, cream dhoti, gold cap + belt
  master: { jacket: '#7a2e4a', pants: '#e8dcc0', boots: '#2e2118', hat: 'cap', cap: '#d9a441', skin: '#c98a5a', belt: true },
  // नौकर: plain servant — worn brown kurta, simple clothes, no ornaments
  servant: { jacket: '#8a7a5a', pants: '#5a4a3a', boots: '#3a2e22', hat: 'hair', hair: '#241c14', skin: '#b57a4e' },
};
const drawFigure = (T, o, opts, extra) => (p) => { T.bodyFront(p, o, opts); };
const A = (T, o, opts, pos, extra = {}) => ({
  key: (extra.tag || 'fig') + JSON.stringify(o) + JSON.stringify(opts),
  draw: drawFigure(T, o, opts, extra),
  x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], ...extra.out,
});
// The cat is a card too (T.catCard), drawn at small scale so it reads as a cat.
const CAT = (T, f, opts, pos, extra = {}) => ({
  key: 'cat' + JSON.stringify(opts),
  draw: (p) => T.catCard(p, { ...opts, blink: blinkAt(f, 81) }),
  x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], s: 0.28, ...extra.out,
});
const idleTilt = (f, seed) => q(1.5 * Math.sin(f * 0.037 + seed * 1.3), 1);
const masterAt = (T, tint, f, expr, pos, opts = {}, out = {}) => A(T, OUTFITS.master, { expr, mode: 'stand', blink: blinkAt(f, 71), seed: 71, headTilt: idleTilt(f, 71), ...opts }, pos, { tag: 'mst', out: { tint, ...out } });
const servantAt = (T, tint, f, expr, pos, opts = {}, out = {}) => A(T, OUTFITS.servant, { expr, mode: 'stand', blink: blinkAt(f, 72), seed: 72, headTilt: idleTilt(f, 72), ...opts }, pos, { tag: 'srv', out: { tint, ...out } });

export const actorsAt = (f, T) => {
  const S = shotAt(f), tint = tintFor(S, f), out = [];
  switch (S.id) {
    case 'hookpot': {
      out.push(masterAt(T, tint, f, 'neutral', MASTER, {}, { yaw: -0.3 }));
      out.push(servantAt(T, tint, f, 'neutral', SERVANT, {}, { yaw: 0.3 }));
      out.push(CAT(T, f, { sit: true, tail: f / 30 }, CAT_FLOOR, { out: { tint, yaw: 0.4 } }));
      break;
    }
    case 'empty': {
      out.push(masterAt(T, tint, f, f < 430 ? 'neutral' : 'stern', MASTER, f >= 430 ? { headTilt: q(6, 1) } : {}, { yaw: -0.3 }));
      // servant shrugs and blames the cat — a small wave as he speaks
      const shrug = f >= 430 && f < 560 ? q(0.5 + 0.3 * Math.sin(f * 0.3), 2) : 0;
      out.push(servantAt(T, tint, f, f < 430 ? 'neutral' : 'nervous', SERVANT, { wave: shrug }, { yaw: 0.3 }));
      // the cat sits innocently by the table, licking its paw while blamed
      out.push(CAT(T, f, { sit: true, lick: f >= 480 && f < 620 ? 1 : 0, tail: f / 30 }, CAT_FLOOR, { out: { tint, yaw: 0.4 } }));
      break;
    }
    case 'weigh': {
      // master lifts the cat onto the scales — the cat rides the pan from here.
      // Master stands WEST of the table (MASTER_W) so he never blocks the scales.
      const lift = smooth(ramp(f, 695, 745));
      const cp = lerp3(CAT_FLOOR, PAN_L, lift);
      out.push(masterAt(T, tint, f, 'stern', MASTER_W, { wave: lift < 1 ? q(0.4 + 0.4 * Math.sin(f * 0.2), 2) : 0 }, { yaw: 0.3 }));
      out.push(servantAt(T, tint, f, 'nervous', SERVANT, {}, { yaw: 0.3 }));
      out.push(CAT(T, f, { sit: true, tail: f / 30 }, cp, { out: { tint, yaw: 0.4 } }));
      break;
    }
    case 'reveal': {
      out.push(masterAt(T, tint, f, 'grin', MASTER_W, { headTilt: q(4, 1) }, { yaw: 0.3 }));
      out.push(servantAt(T, tint, f, 'shock', SERVANT, {}, { yaw: 0.3 }));
      out.push(CAT(T, f, { sit: true, tail: f / 30 }, PAN_L, { out: { tint, yaw: 0.4 } }));
      break;
    }
    case 'riddle': {
      // master turns to the servant, calm — the servant opens his mouth, nothing comes out
      const turn = smooth(ramp(f, 830, 870));
      out.push(masterAt(T, tint, f, 'stern', MASTER_W, { wave: f >= 1059 && f < 1088 ? 0.55 : 0 }, { yaw: lerp(0.3, -0.5, turn) }));
      out.push(servantAt(T, tint, f, f < 970 ? 'nervous' : 'shock', SERVANT, { headTilt: q(4, 1) }, { yaw: 0.3 }));
      out.push(CAT(T, f, { sit: true, tail: f / 30 }, PAN_L, { out: { tint, yaw: 0.4 } }));
      break;
    }
    case 'kneel': {
      // servant falls to his knees; the cat jumps down, licks its paws, walks away
      const fell = f >= 1143;
      if (!fell) {
        out.push(masterAt(T, tint, f, 'stern', MASTER, {}, { yaw: 0.5 }));
        out.push(servantAt(T, tint, f, 'shock', SERVANT, {}, { yaw: 0.3 }));
        out.push(CAT(T, f, { sit: true, tail: f / 30 }, PAN_L, { out: { tint, yaw: 0.4 } }));
      } else {
        out.push(masterAt(T, tint, f, 'neutral', MASTER, {}, { yaw: 0.5 }));
        out.push(A(T, OUTFITS.servant, { expr: 'dazed', mode: 'fall', blink: blinkAt(f, 72), seed: 72 }, SERVANT, { tag: 'srv', out: { tint, yaw: 0.3 } }));
        const cp = catJump(f);
        if (f < 1215) out.push(CAT(T, f, { sit: false, tail: f / 30 }, cp, { out: { tint, yaw: 0.4 } }));
        else {
          const wp = catWalk(f);
          const ph = q(((f - 1215) / 30 * 1.27 / 1.6) % 1, 2);
          if (f < 1274) out.push(CAT(T, f, { sit: false, step: ph, tail: f / 30 }, wp, { out: { tint, yaw: 0.4 } }));
          else out.push(CAT(T, f, { sit: true, lick: 1, tail: f / 30 }, [1.6, 0, 0.6], { out: { tint, yaw: 0.9 } }));
        }
      }
      break;
    }
    case 'fullpot': {
      out.push(masterAt(T, tint, f, 'grin', MASTER, {}, { yaw: -0.3 }));
      out.push(servantAt(T, tint, f, 'relief', SERVANT, { headTilt: q(10, 1) }, { yaw: 0.3 }));
      out.push(CAT(T, f, { sit: true, lick: 1, tail: f / 30 }, [1.6, 0, 0.6], { out: { tint, yaw: 0.9 } }));
      break;
    }
    case 'hookcrow': {
      // both men look up at the window — the crow, and the hook board, hold the frame
      out.push(masterAt(T, tint, f, 'neutral', MASTER, { headTilt: q(-6, 1) }, { yaw: -0.6 }));
      out.push(servantAt(T, tint, f, 'neutral', SERVANT, { headTilt: q(-6, 1) }, { yaw: 0.6 }));
      out.push(CAT(T, f, { sit: true, tail: f / 30 }, [1.6, 0, 0.6], { out: { tint, yaw: 0.9 } }));
      break;
    }
  }
  return out;
};
export const fxAt = (f, T) => {
  const out = [];
  const burst = (key, x, y, z, t) => out.push({ key, draw: (p) => T.fxBurst(p, t, '#ffe066', 9, 26, 140), x, y, z, blob: false, shadow: false });
  if (f >= 782 && f <= 798) burst('needle_' + q((f - 782) / 16, 2), SCALES[0], 1.5, SCALES[2], q((f - 782) / 16, 2));
  // NOTE: no fxDust card here — at kneel range the puff card fills the frame (f1150 defect).
  return out;
};
