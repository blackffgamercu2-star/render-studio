// Shot plan for "The Man Who Sold the Moon" (batch-4 topic 1, EN) —
// timed to the ACTUAL voice stem (54.651 s, 30 fps, TOTAL 1640), clause
// timings from faster-whisper word alignment on stem_en.wav (215 words,
// last word ends 54.34 s; boundaries = ASR word-start frames; ASR heard
// "and sign" as "inside" at 17.24 s — timing unaffected):
// C1 0 hook title | C2 101 no refund | C3 167 led to well (point 230) |
// C4 261 the pitch | C5 347 tonight it goes | C6 404 king stared |
// C7 466 how much | C8 493 fifty coins (paper 517) | C9 596 paid (slept 620) |
// C10 656 dawn, empty | C11 731 dragged by collar | C12 781 where is my moon |
// C13 812 bowed (speech 837) | C14 902 only visits after dark |
// C15 961 disc shone again | C16 1006 grabbed a bucket |
// C17 1066 water shook (shattered 1088) | C18 1162 you broke it yourself |
// C19 1216 no refunds | C20 1265 mouth opened (closed 1303) |
// C21 1329 punishing meant telling | C22 1433 two weavers (1481) |
// C23 1581 hook question, held to 1639.
// QUALITY RULES (owner, batch-2/3/4): shots change ONLY at clause
// boundaries; camera TRACKS the voice-named subject every beat
// (biggest/centred), never freezes, never drifts; characters act in
// place — no walk-glide; costumes by role (king = crown + royal robe,
// trickster = clever commoner in worn brown, weavers = work clothes).
// PHYSICS (Abid 2026-11-15, top priority): props sit flush on their
// surface with contact shadow; the payment pouch lands on the ground and
// stays; the bucket lowers on its rope until its bottom MEETS the water
// (splash + ripples at contact), is lifted out full of water; the moon
// disc breaks into silver fragments that stay in the water.
// World: palace court x=0 (facade z=-3.2, throne z=-2.2), the well x=+16.
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1640, DECK = 0;
export const SHOTS = [
  { id: 'title', a: 0, b: 100, light: 'moonlit' },
  { id: 'refund', a: 101, b: 166, light: 'moonlit' },
  { id: 'led', a: 167, b: 260, light: 'moonlit' },
  { id: 'pitch', a: 261, b: 346, light: 'moonlit' },
  { id: 'tonight', a: 347, b: 403, light: 'moonlit' },
  { id: 'stare', a: 404, b: 465, light: 'moonlit' },
  { id: 'howmuch', a: 466, b: 492, light: 'moonlit' },
  { id: 'price', a: 493, b: 595, light: 'moonlit' },
  { id: 'paid', a: 596, b: 655, light: 'moonlit' },
  { id: 'dawn', a: 656, b: 730, light: 'dawn' },
  { id: 'dragged', a: 731, b: 780, light: 'dawn' },
  { id: 'where', a: 781, b: 811, light: 'dawn' },
  { id: 'bow', a: 812, b: 901, light: 'dawn' },
  { id: 'visits', a: 902, b: 960, light: 'dawn' },
  { id: 'shone', a: 961, b: 1005, light: 'moonlit' },
  { id: 'bucket', a: 1006, b: 1065, light: 'moonlit' },
  { id: 'shatter', a: 1066, b: 1161, light: 'moonlit' },
  { id: 'broke', a: 1162, b: 1215, light: 'moonlit' },
  { id: 'norefund', a: 1216, b: 1264, light: 'moonlit' },
  { id: 'mouth', a: 1265, b: 1328, light: 'moonlit' },
  { id: 'punishing', a: 1329, b: 1432, light: 'moonlit' },
  { id: 'weavers', a: 1433, b: 1580, light: 'dusk' },
  { id: 'hook', a: 1581, b: 1639, light: 'dusk' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
M.linear = (t) => clamp(t);

// ---------- lights ----------
const WATER = { waterDeep: '#223c4e', waterShal: '#2c4a63', glint: '#ffe9c0' };
export const LIGHTS = {
  moonlit: { az: 200, el: 32, sky: '#8a7a9e', ground: '#3a3444', hemi: 0.92, sun: '#cdd8ff', sunI: 1.7, fog: '#9a8aa8', fogNear: 40, fogFar: 320,
    skyTop: '#2a2a55', skyHor: '#c9a0c0', sunDisc: '#f4f0ff', sunSize: 0.004, sat: 1.0, vig: 0.3, shadowExt: 18, aurora: 0, gain: '#e8e2f2', ...WATER },
  dawn: { az: 62, el: 15, sky: '#d9a06a', ground: '#4c4034', hemi: 1.04, sun: '#ffb763', sunI: 2.2, fog: '#e0c9a0', fogNear: 40, fogFar: 320,
    skyTop: '#7a86b8', skyHor: '#ffd9a0', sunDisc: '#fff3cf', sunSize: 0.0038, sat: 1.06, vig: 0.24, shadowExt: 18, aurora: 0, gain: '#ffe9d2', ...WATER },
  dusk: { az: 100, el: 19, sky: '#caa27a', ground: '#5c4a34', hemi: 1.06, sun: '#ffb763', sunI: 2.3, fog: '#e0c9a0', fogNear: 40, fogFar: 320,
    skyTop: '#54689c', skyHor: '#ffd9a0', sunDisc: '#fff3cf', sunSize: 0.0036, sat: 1.07, vig: 0.24, shadowExt: 18, aurora: 0, gain: '#ffe9d2', ...WATER },
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
  if (S.id === 'dawn') return blendLight(LIGHTS.moonlit, LIGHTS.dawn, smooth(ramp(f, 656, 705)));
  if (S.id === 'shone') return blendLight(LIGHTS.dawn, LIGHTS.moonlit, smooth(ramp(f, 961, 1000)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging ----------
export const THRONE = [0, 0, -2.2];
export const WELL = [16, 0, -1.6];
export const TRICK = [15.3, 0, -0.7];       // the trickster, west of the well
export const KINGW = [16.9, 0, -0.75];      // the king, east of the well
export const TRICK_D = [15.55, 0, -0.1];   // dragged in: stands in FRONT of the rim, south-west of the well (behind the rim he read as inside the well)
export const WEAV_L = [-1.55, 0, -0.85];
export const WEAV_R = [1.7, 0, -1.0];
export const GOLDBAG = [16.35, 0, -0.35];    // payment pouch on the ground by the king's feet
export const GLP = [-2.0, 0, -1.7], GRP = [2.0, 0, -1.7];

const HERO = {
  title: () => [16, 1.8, -2.8],
  refund: () => [15.3, 1.1, -0.7],
  led: () => [15.9, 1.1, -1.1],
  pitch: () => [16, 0.7, -1.6],
  tonight: () => [15.3, 1.1, -0.7],
  stare: () => [16, 0.6, -1.6],
  howmuch: () => [16.9, 1.2, -0.75],
  price: () => [15.3, 1.1, -0.7],
  paid: () => [16.1, 1.0, -1.0],
  dawn: () => [16, 0.8, -1.6],
  dragged: () => [16.2, 1.15, -0.72],
  where: () => [16.9, 1.25, -0.75],
  bow: () => [15.95, 1.1, -0.72],
  visits: () => [15.9, 1.2, -1.0],
  shone: () => [16, 0.7, -1.6],
  bucket: () => [16.1, 1.0, -1.4],
  shatter: () => [16, 0.65, -1.6],
  broke: () => [15.3, 1.1, -0.7],
  norefund: () => [16, 2.4, -3.2],
  mouth: () => [16.9, 1.22, -0.75],
  punishing: () => [16.0, 1.25, -1.2],
  weavers: () => [-0.6, 1.15, -1.1],
  hook: () => [0, 2.4, -3.0],
};
export const heroPosAt = (f) => HERO[shotAt(f).id](f);

// ---------- cameras ----------
// Continuous flight: every shot's first key repeats the previous shot's
// last key; inside a shot the camera surges TO the clause subject.
const CAMS = {
  title: [
    { f: 0, pos: [11.0, 3.6, 8.2], look: [15.9, 2.1, -2.5], fov: 44 },
    { f: 50, pos: [12.6, 3.1, 6.4], look: [15.85, 2.0, -2.35], fov: 41, ease: 'surge' },
    { f: 100, pos: [13.6, 2.7, 5.2], look: [15.8, 1.8, -2.0], fov: 39, ease: 'surge' },
  ],
  refund: [
    { f: 101, pos: [13.6, 2.7, 5.2], look: [15.8, 1.8, -2.0], fov: 39 },
    { f: 135, pos: [15.2, 1.9, 3.4], look: [15.3, 1.15, -0.7], fov: 37, ease: 'surge' },
    { f: 166, pos: [15.0, 1.85, 3.1], look: [15.3, 1.15, -0.7], fov: 36 },
  ],
  led: [
    { f: 167, pos: [15.0, 1.85, 3.1], look: [15.3, 1.15, -0.7], fov: 36 },
    { f: 205, pos: [14.2, 2.3, 4.6], look: [15.9, 1.2, -1.2], fov: 40, ease: 'surge' },
    { f: 260, pos: [14.8, 2.5, 4.4], look: [16, 1.0, -1.6], fov: 39, ease: 'surge' },
  ],
  pitch: [
    { f: 261, pos: [14.8, 2.5, 4.4], look: [16, 1.0, -1.6], fov: 39 },
    { f: 300, pos: [15.2, 4.6, 3.6], look: [16.1, 0.8, -1.7], fov: 38, ease: 'surge' },
    { f: 346, pos: [15.4, 4.9, 4.2], look: [16.1, 0.7, -1.7], fov: 37 },
  ],
  tonight: [
    { f: 347, pos: [15.4, 4.9, 4.2], look: [16.1, 0.7, -1.7], fov: 37 },
    { f: 375, pos: [14.6, 2.2, 4.0], look: [15.3, 1.15, -0.7], fov: 38, ease: 'surge' },
    { f: 403, pos: [14.8, 2.1, 3.8], look: [15.3, 1.15, -0.7], fov: 37 },
  ],
  stare: [
    { f: 404, pos: [14.8, 2.1, 3.8], look: [15.3, 1.15, -0.7], fov: 37 },
    { f: 435, pos: [15.3, 5.4, 3.4], look: [16.1, 0.6, -1.7], fov: 36, ease: 'surge' },
    { f: 465, pos: [15.5, 5.0, 4.0], look: [16.1, 0.7, -1.7], fov: 36 },
  ],
  howmuch: [
    { f: 466, pos: [15.5, 5.0, 4.0], look: [16.1, 0.7, -1.7], fov: 36 },
    { f: 480, pos: [15.6, 2.0, 3.2], look: [16.9, 1.2, -0.75], fov: 37, ease: 'surge' },
    { f: 492, pos: [15.8, 1.95, 3.0], look: [16.9, 1.2, -0.75], fov: 36 },
  ],
  price: [
    { f: 493, pos: [15.8, 1.95, 3.0], look: [16.9, 1.2, -0.75], fov: 36 },
    { f: 508, pos: [14.4, 2.0, 3.6], look: [15.3, 1.15, -0.7], fov: 37, ease: 'surge' },
    { f: 595, pos: [14.6, 1.95, 3.4], look: [15.5, 1.1, -0.72], fov: 36, ease: 'surge' },
  ],
  paid: [
    { f: 596, pos: [14.6, 1.95, 3.4], look: [15.5, 1.1, -0.72], fov: 36 },
    { f: 608, pos: [14.8, 2.0, 4.2], look: [16.45, 1.0, -0.85], fov: 40, ease: 'easeOut' },
    { f: 655, pos: [15.0, 1.95, 4.0], look: [16.4, 1.0, -0.9], fov: 39 },
  ],
  dawn: [
    { f: 656, pos: [15.0, 1.95, 4.0], look: [16.4, 1.0, -0.9], fov: 39 },
    { f: 690, pos: [13.8, 2.6, 5.4], look: [16.2, 1.0, -1.6], fov: 40, ease: 'surge' },
    { f: 730, pos: [14.6, 2.8, 4.6], look: [16.2, 0.8, -1.7], fov: 38, ease: 'surge' },
  ],
  dragged: [
    { f: 731, pos: [14.6, 2.8, 4.6], look: [16.2, 0.8, -1.7], fov: 38 },
    { f: 755, pos: [15.2, 1.9, 3.2], look: [16.2, 1.15, -0.72], fov: 37, ease: 'surge' },
    { f: 780, pos: [15.3, 1.85, 3.0], look: [16.2, 1.15, -0.72], fov: 36 },
  ],
  where: [
    { f: 781, pos: [15.3, 1.85, 3.0], look: [16.2, 1.15, -0.72], fov: 36 },
    { f: 800, pos: [15.9, 1.9, 2.6], look: [16.9, 1.25, -0.75], fov: 36, ease: 'surge' },
    { f: 811, pos: [16.0, 1.88, 2.5], look: [16.9, 1.25, -0.75], fov: 36 },
  ],
  bow: [
    { f: 812, pos: [16.0, 1.88, 2.5], look: [16.9, 1.25, -0.75], fov: 36 },
    { f: 838, pos: [14.8, 2.0, 3.6], look: [15.6, 1.1, -0.15], fov: 37, ease: 'surge' },
    { f: 901, pos: [15.0, 1.95, 3.4], look: [15.6, 1.12, -0.15], fov: 36 },
  ],
  visits: [
    { f: 902, pos: [15.0, 1.95, 3.4], look: [15.6, 1.12, -0.15], fov: 36 },
    { f: 930, pos: [14.4, 2.4, 4.4], look: [15.6, 1.25, -0.3], fov: 39, ease: 'surge' },
    { f: 960, pos: [14.6, 2.3, 4.2], look: [15.6, 1.15, -0.4], fov: 38 },
  ],
  shone: [
    { f: 961, pos: [14.6, 2.3, 4.2], look: [15.9, 1.2, -1.2], fov: 38 },
    { f: 985, pos: [15.2, 4.8, 3.8], look: [16.1, 0.7, -1.7], fov: 37, ease: 'surge' },
    { f: 1005, pos: [15.4, 4.6, 4.2], look: [16.1, 0.7, -1.7], fov: 36 },
  ],
  bucket: [
    { f: 1006, pos: [15.4, 4.6, 4.2], look: [16.1, 0.7, -1.7], fov: 36 },
    { f: 1030, pos: [14.8, 2.4, 4.4], look: [16.2, 1.1, -1.3], fov: 38, ease: 'surge' },
    { f: 1065, pos: [15.0, 2.6, 4.2], look: [16.1, 0.9, -1.5], fov: 37, ease: 'surge' },
  ],
  shatter: [
    { f: 1066, pos: [15.0, 2.6, 4.2], look: [16.1, 0.9, -1.5], fov: 37 },
    { f: 1100, pos: [15.2, 4.4, 3.6], look: [16.1, 0.65, -1.65], fov: 36, ease: 'surge' },
    { f: 1161, pos: [15.4, 3.6, 4.4], look: [16.1, 0.9, -1.6], fov: 37, ease: 'surge' },
  ],
  broke: [
    { f: 1162, pos: [15.4, 3.6, 4.4], look: [16.1, 0.9, -1.6], fov: 37 },
    { f: 1190, pos: [14.6, 2.1, 3.8], look: [15.3, 1.15, -0.7], fov: 37, ease: 'surge' },
    { f: 1215, pos: [14.8, 2.05, 3.6], look: [15.3, 1.15, -0.7], fov: 36 },
  ],
  norefund: [
    { f: 1216, pos: [14.8, 2.05, 3.6], look: [15.3, 1.15, -0.7], fov: 36 },
    { f: 1226, pos: [15.2, 2.6, 5.2], look: [15.9, 2.2, -2.6], fov: 40, ease: 'surge' },
    { f: 1264, pos: [15.4, 2.7, 5.6], look: [15.9, 2.3, -2.7], fov: 39 },
  ],
  mouth: [
    { f: 1265, pos: [15.4, 2.7, 5.6], look: [15.9, 2.3, -2.7], fov: 39 },
    { f: 1290, pos: [15.7, 1.95, 2.9], look: [16.9, 1.22, -0.75], fov: 36, ease: 'surge' },
    { f: 1328, pos: [15.8, 1.9, 2.8], look: [16.9, 1.22, -0.75], fov: 36 },
  ],
  punishing: [
    { f: 1329, pos: [15.8, 1.9, 2.8], look: [16.9, 1.22, -0.75], fov: 36 },
    { f: 1380, pos: [13.6, 2.8, 6.2], look: [16.0, 1.3, -1.2], fov: 41, ease: 'surge' },
    { f: 1432, pos: [13.9, 2.7, 5.9], look: [16.0, 1.25, -1.2], fov: 40 },
  ],
  weavers: [
    { f: 1433, pos: [13.9, 2.7, 5.9], look: [16.0, 1.25, -1.2], fov: 40 },
    { f: 1470, pos: [7.5, 3.0, 8.5], look: [0, 1.8, -2.6], fov: 43, ease: 'surge' },
    { f: 1520, pos: [0.3, 2.3, 7.6], look: [0.1, 1.2, -1.2], fov: 44, ease: 'surge' },
    { f: 1580, pos: [0.2, 2.25, 7.3], look: [0.1, 1.2, -1.2], fov: 43 },
  ],
  hook: [
    { f: 1581, pos: [0.2, 2.25, 7.3], look: [0.1, 1.2, -1.2], fov: 43 },
    { f: 1600, pos: [2.6, 2.5, 5.8], look: [0, 2.45, -2.95], fov: 40, ease: 'surge' },
    { f: 1639, pos: [2.4, 2.55, 6.2], look: [0, 2.5, -2.95], fov: 39, ease: 'surge' },
  ],
};
export const camAt = (f) => camFromKeys(CAMS[shotAt(f).id], f);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const hp = heroPosAt(f);
  let cinf = 5;
  if (['pitch', 'stare', 'shone', 'shatter', 'norefund', 'hook'].includes(S.id)) cinf = 3.6;
  if (S.id === 'paid') cinf = 3.2;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
// Bucket ride (centre height of the bucket box): hangs at rest 1.55,
// lowers toward the water during 'bucket', dips until its bottom MEETS
// the water surface (0.62) at f~1074 (centre 0.74), rides the shake in
// the water, then lifts out full by f1155 and hangs there.
const BUCKET_KEYS = [[0, 1.55], [1017, 1.55], [1062, 0.98], [1066, 0.98], [1078, 0.74], [1118, 0.74], [1155, 1.5], [1639, 1.5]];
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = {
    boardTitle: 0, boardRefund: 0, boardHook: 0,
    moonK: 0, shatterK: 0, rippleK: 0, ripple2K: 0, splashP: 0, shakeK: 0,
    bucketY: kf(BUCKET_KEYS, f), bucketWater: 0, payK: 0, goldK: 0,
  };
  if (S.id === 'title') W.boardTitle = 1 - smooth(ramp(f, 58, 72));
  if (S.id === 'norefund') W.boardRefund = smooth(ramp(f, 1228, 1240)) * (1 - smooth(ramp(f, 1250, 1263)));
  if (S.id === 'hook') W.boardHook = smooth(ramp(f, 1600, 1612));   // NO fade-out: holds 1.0 to the last frame
  // the moon in the water: present at night, gone at dawn, back after dark
  if (f < 648) W.moonK = 1;
  else if (f < 668) W.moonK = 1 - smooth(ramp(f, 648, 668));
  else if (f < 975) W.moonK = 0;
  else if (f < 1002) W.moonK = smooth(ramp(f, 975, 1002));
  else W.moonK = 1;
  // payment pouch: set down at the pay beat, taken away as the king sleeps
  W.payK = smooth(ramp(f, 614, 628)) * (1 - smooth(ramp(f, 644, 655)));
  // the shattering: bucket meets water f~1074, disc breaks f1090-1112
  W.splashP = ramp(f, 1074, 1100);
  W.rippleK = ramp(f, 1074, 1124);
  W.ripple2K = ramp(f, 1090, 1144);
  W.shakeK = smooth(ramp(f, 1066, 1074)) * (1 - smooth(ramp(f, 1100, 1114)));
  W.shatterK = smooth(ramp(f, 1090, 1112));
  W.bucketWater = smooth(ramp(f, 1120, 1138));
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return { smokeRate: (S.light === 'moonlit' ? 0.16 : 0.3), dustRate: 0.08, splashRate: 0 };
};

// ---------- crows in the sky (set dressing; deterministic) ----------
const CROW_N = 7;
const circleAt = (f, i, cx, cz, r = 5, h = 9) => {
  const a = f * 0.008 + i * 0.9;
  return { p: [cx + r * Math.cos(a), h + Math.sin(f * 0.05 + i) * 0.8, cz + r * Math.sin(a)], yaw: a + Math.PI / 2, flap: f * 0.9 + i * 1.7, s: 1 };
};
export const flyCrowsAt = (f) => {
  const S = shotAt(f);
  const out = [];
  const court = (S.id === 'weavers' || S.id === 'hook');
  for (let i = 0; i < CROW_N; i++) out.push(circleAt(f, i, court ? 0 : 16, -2, court ? 6 : 4, court ? 9.5 : 8.5));
  return out;
};

// ---------- actors ----------
// COSTUMES BY ROLE — king: crimson royal robe + gold crown + grey
// moustache, stout. Trickster: clever commoner — worn brown jacket,
// dark hair, quick grin. Weavers: work clothes + caps (teal / rust).
const TINT = { moonlit: '#d8dcff', dawn: '#ffd9a3', dusk: '#ffd9a3' };
const tintFor = (S, f) => TINT[S.light] || '#ffffff';
export const OUTFITS = {
  king: { jacket: '#7a1f2e', pants: '#3a2a4a', boots: '#241a12', hat: 'crown', skin: '#e8b08a', moustache: '#d8d0c0', build: 'stout', dress: '#7a1f2e' },
  trickster: { jacket: '#8a6a3a', pants: '#5d4a30', boots: '#3a2c1c', hat: 'hair', hair: '#1f160e', skin: '#c98a5a' },
  weaverA: { jacket: '#3f6a6a', pants: '#2e3d3d', boots: '#241a12', hat: 'cap', cap: '#2c4a4a', skin: '#e8b08a' },
  weaverB: { jacket: '#7a4a3a', pants: '#3d2e26', boots: '#241a12', hat: 'cap', cap: '#4a3226', skin: '#c98a5a' },
  guardL: { jacket: '#8c2f39', pants: '#2a2e3d', boots: '#1c1a17', hat: 'shako', belt: '#e8c45a', skin: '#e8b08a' },
  guardR: { jacket: '#8c2f39', pants: '#2a2e3d', boots: '#1c1a17', hat: 'shako', belt: '#e8c45a', skin: '#c98a5a' },
};
const RW = (T, o, opts, pos, extra = {}) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], ...extra });
const stand = (T, tint, f) => (o, expr, seed, pos, extra = {}) => RW(T, o, { expr, mode: 'stand', blink: blinkAt(f, seed), seed }, pos, { tint, ...extra });
const bowK = (f, a, b, c, d) => smooth(ramp(f, a, b)) * (1 - smooth(ramp(f, c, d)));
const bowOpts = (k) => ({ headTilt: q(k * 24, 1) });
const BP = (pos, k) => [pos[0], q(-0.12 * k, 3), pos[2]];

export const actorsAt = (f, T) => {
  const S = shotAt(f), tint = tintFor(S, f), out = [];
  const st = stand(T, tint, f);
  const kingW = (expr, extra = {}) => st(OUTFITS.king, expr, 31, KINGW, { yaw: -0.5, ...extra });
  const trick = (expr, extra = {}) => st(OUTFITS.trickster, expr, 91, TRICK, { yaw: 0.5, ...extra });
  switch (S.id) {
    case 'title': {
      out.push(trick('grin'));
      out.push(kingW('neutral'));
      break;
    }
    case 'refund': {
      out.push(trick('grin'));
      out.push(kingW('dazed'));
      break;
    }
    case 'led': {
      const pk = q(smooth(ramp(f, 224, 234)) * (1 - smooth(ramp(f, 248, 260))), 2);
      out.push(RW(T, OUTFITS.trickster, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 91), seed: 91, prop: ['point', pk] }, TRICK, { tint, yaw: 0.5, flip: true }));
      out.push(kingW('neutral'));
      break;
    }
    case 'pitch': {
      const pk = q(1 - smooth(ramp(f, 300, 315)), 2);
      out.push(RW(T, OUTFITS.trickster, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 91), seed: 91, prop: ['point', pk] }, TRICK, { tint, yaw: 0.5, flip: true }));
      const k = 0.3;   // the king leans over the rim, looking down
      out.push(RW(T, OUTFITS.king, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 31), seed: 31, ...bowOpts(k) }, BP(KINGW, k), { tint, yaw: -0.5 }));
      break;
    }
    case 'tonight': {
      out.push(trick('grin'));
      out.push(kingW('neutral'));
      break;
    }
    case 'stare': {
      const k = 0.45;   // head down, staring at the disc
      out.push(RW(T, OUTFITS.king, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 31), seed: 31, ...bowOpts(k) }, BP(KINGW, k), { tint, yaw: -0.5 }));
      out.push(trick('neutral'));
      break;
    }
    case 'howmuch': {
      out.push(kingW('neutral'));
      out.push(trick('grin'));
      break;
    }
    case 'price': {
      // flip: the prop hand goes on the WEST side, clear of the well rim
      if (f < 517) {
        const k = q(smooth(ramp(f, 493, 500)) * (1 - smooth(ramp(f, 512, 520))), 2);
        out.push(RW(T, OUTFITS.trickster, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 91), seed: 91, prop: ['coin', k] }, TRICK, { tint, yaw: 0.5, flip: true }));
      } else {
        const k = q(smooth(ramp(f, 517, 526)) * (1 - smooth(ramp(f, 586, 595))), 2);
        out.push(RW(T, OUTFITS.trickster, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 91), seed: 91, prop: ['letter', k] }, TRICK, { tint, yaw: 0.5, flip: true }));
      }
      out.push(kingW('neutral'));
      break;
    }
    case 'paid': {
      if (f < 620) {
        const k = q(smooth(ramp(f, 596, 601)) * (1 - smooth(ramp(f, 610, 618))), 2);
        out.push(RW(T, OUTFITS.king, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['coin', k] }, KINGW, { tint, yaw: -0.5 }));
      } else out.push(kingW(f < 620 ? 'neutral' : 'smile_closed'));
      if (f >= 614) {
        const k = q(0.5 + 0.3 * Math.sin(f * 0.3), 2);   // counting the coins
        out.push(RW(T, OUTFITS.trickster, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 91), seed: 91, prop: ['coin', k] }, TRICK, { tint, yaw: f < 644 ? 0.5 : 1.4, flip: true }));
      } else out.push(trick('grin'));
      break;
    }
    case 'dawn': {
      out.push(kingW('shock'));
      break;
    }
    case 'dragged': {
      out.push(RW(T, OUTFITS.king, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.8] }, KINGW, { tint, yaw: -0.5 }));
      out.push(st(OUTFITS.trickster, 'nervous', 91, TRICK_D, { yaw: 0.5 }));
      break;
    }
    case 'where': {
      out.push(kingW('stern'));
      out.push(st(OUTFITS.trickster, 'nervous', 91, TRICK_D, { yaw: 0.5 }));
      break;
    }
    case 'bow': {
      const bk = bowK(f, 816, 838, 878, 900);
      out.push(RW(T, OUTFITS.trickster, { expr: f < 845 ? 'nervous' : 'grin', mode: 'stand', blink: blinkAt(f, 91), seed: 91, ...bowOpts(bk) }, BP(TRICK_D, bk), { tint, yaw: 0.5 }));
      out.push(kingW('stern'));
      break;
    }
    case 'visits': {
      const pk = q(smooth(ramp(f, 905, 915)) * (1 - smooth(ramp(f, 945, 958))), 2);
      out.push(RW(T, OUTFITS.trickster, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 91), seed: 91, prop: ['point', pk] }, TRICK_D, { tint, yaw: 0.5 }));
      out.push(kingW('neutral'));
      break;
    }
    case 'shone': {
      out.push(trick('grin'));
      out.push(kingW('neutral'));
      break;
    }
    case 'bucket': {
      const k = 0.3;   // the king leans over his moon, working the rope
      out.push(RW(T, OUTFITS.king, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 31), seed: 31, ...bowOpts(k) }, BP(KINGW, k), { tint, yaw: -0.5 }));
      out.push(trick('grin'));
      break;
    }
    case 'shatter': {
      out.push(kingW(f < 1131 ? 'shock' : 'dazed'));
      out.push(trick('grin'));
      break;
    }
    case 'broke': case 'norefund': {
      out.push(trick('grin'));
      out.push(kingW('dazed'));
      break;
    }
    case 'mouth': {
      out.push(kingW(f < 1303 ? 'shock' : 'dazed'));
      out.push(trick('grin'));
      break;
    }
    case 'punishing': {
      out.push(kingW('dazed'));
      out.push(st(OUTFITS.trickster, 'grin', 91, TRICK, { yaw: 1.3 }));
      break;
    }
    case 'weavers': {
      out.push(RW(T, OUTFITS.king, { expr: 'stern', mode: 'sit', blink: blinkAt(f, 31), seed: 31 }, [...THRONE], { tint, yaw: 0 }));
      out.push(RW(T, OUTFITS.weaverA, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 81), seed: 81, prop: ['point', 0.55] }, WEAV_L, { tint, yaw: 0.25 }));
      out.push(RW(T, OUTFITS.weaverB, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 82), seed: 82, prop: ['point', 0.55] }, WEAV_R, { tint, yaw: -0.25, flip: true }));
      out.push(st(OUTFITS.guardL, 'stern', 61, GLP, { yaw: 0.15 }));
      out.push(st(OUTFITS.guardR, 'stern', 62, GRP, { yaw: -0.15 }));
      break;
    }
    case 'hook': {
      out.push(RW(T, OUTFITS.king, { expr: 'dazed', mode: 'sit', blink: blinkAt(f, 31), seed: 31 }, [...THRONE], { tint, yaw: 0 }));
      out.push(st(OUTFITS.weaverA, 'grin', 81, WEAV_L, { yaw: 0.25 }));
      out.push(st(OUTFITS.weaverB, 'grin', 82, WEAV_R, { yaw: -0.25 }));
      break;
    }
  }
  return out;
};
export const fxAt = (f, T) => [];
