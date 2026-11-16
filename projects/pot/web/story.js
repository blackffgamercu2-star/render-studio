// Shot plan for "The Pot That Cooks Itself" — pot (LIBRARY v4: speak.js
// dialogue performance + materials v4, camrig smooth tracking + solid
// colliders). Batch 6 topic 1. ONE set: a palace courtyard in strong sun.
// A poor woman sells the king a pot that cooks with no fire: the pot is
// black as coal and its lid a polished mirror bending the sun's rays in;
// peeking lets the trapped heat escape.
// Voice stem: 55.971 s, 30 fps, TOTAL 1680; timings from faster-whisper
// word alignment (words.json). Scene changes ONLY at clause boundaries:
//   S1 0.00-4.92 A poor woman...coins.      S7 27.84-30.30 She bowed...spoke.
//   S2 5.34-8.30 She cooked...for it.       S8 30.92-33.72 "This pot cooks..."
//   S3 8.64-13.20 Her rules...never peek.   S9 34.44-41.58 Then she revealed...
//   S4 13.72-18.00 At noon...cooked.        S10 42.20-46.96 Peeking let...fire.
//   S5 18.42-22.86 His men tested...noon.   S11 47.58-50.28 The king kept...
//   S6 23.38-27.38 Then one cloudy...king.  S12 50.72-55.94 But tomorrow...one?
// GRADE (FILTER_VFX_LIGHTING pack): Golden Hour throughout; the cloudy
// beat (S6-S8) shifts to a Monsoon-Grey blend and back — grade changes
// ONLY on clause boundaries. Signature VFX: sun rays converging into the
// pot (reveal), heat shimmer over the sealed pot, steam burst at the
// noon reveal, glints on the mirror lid.
import { M, blinkAt, q, clamp, lerp, ramp } from './motion.js';
import { buildRig, pushInCam, staticTrackCam, keysCam } from './camrig.js';
import * as SOL from './solid.js';
import * as T from './toon.js';
import * as SPK from './speak.js';
import { SPEAK_DATA } from './speakdata.js';

// ---------- v4 dialogue performance ----------
const SPEAK = SPK.makeSpeakPlayer(SPEAK_DATA);
const speakFace = (baseName, f) => {
  const s = SPEAK.at(f);
  return { expr: 'smile', exprP: SPK.applySpeak({ ...T.faceP(baseName), cheek: 0.5 }, s), headTilt: q(s.nod || 0, 2), clothShade: true };
};

export const FPS = 30, TOTAL = 1680, DECK = 0;
export const SHOTS = [
  { id: 'drone', a: 0, b: 159, light: 'gold' },
  { id: 'seller', a: 160, b: 258, light: 'gold' },
  { id: 'rules', a: 259, b: 411, light: 'gold' },
  { id: 'noon', a: 412, b: 551, light: 'gold' },
  { id: 'tests', a: 552, b: 697, light: 'gold' },
  { id: 'cloudy', a: 698, b: 833, light: 'grey' },
  { id: 'bow', a: 834, b: 926, light: 'grey' },
  { id: 'dialogue', a: 927, b: 1033, light: 'grey' },
  { id: 'reveal', a: 1034, b: 1256, light: 'gold' },
  { id: 'peek', a: 1257, b: 1417, light: 'gold' },
  { id: 'paid', a: 1418, b: 1521, light: 'gold' },
  { id: 'hookq', a: 1522, b: 1619, light: 'dusk' },
  { id: 'hook', a: 1620, b: 1679, light: 'dusk' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights / mood grades ----------
export const LIGHTS = {
  gold: { az: 232, el: 27, sky: '#f0cf9e', ground: '#8a6f4a', hemi: 1.02, sun: '#ffd9a0', sunI: 2.45, fog: '#e8d3ac', fogNear: 46, fogFar: 330,
    skyTop: '#3a6ab0', skyHor: '#f2cd8e', sunDisc: '#fff0bc', sunSize: 0.0042, sat: 1.09, vig: 0.26, shadowExt: 22, aurora: 0, gain: '#ffedc8',
    waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
  grey: { az: 232, el: 34, sky: '#bcc3c6', ground: '#6b6e66', hemi: 1.15, sun: '#d4d9dc', sunI: 1.25, fog: '#b4bab4', fogNear: 34, fogFar: 260,
    skyTop: '#5d6d7c', skyHor: '#c3c8c2', sunDisc: '#000000', sunSize: 0, sat: 0.6, vig: 0.26, shadowExt: 22, aurora: 0, gain: '#ccd2d4',
    waterDeep: '#24343c', waterShal: '#3c545e', glint: '#cfd8dc' },
  dusk: { az: 250, el: 13, sky: '#c99a72', ground: '#5c4632', hemi: 0.92, sun: '#ffab5e', sunI: 2.0, fog: '#d9b28c', fogNear: 42, fogFar: 300,
    skyTop: '#2e3c6e', skyHor: '#f0a668', sunDisc: '#ffbe78', sunSize: 0.0044, sat: 1.05, vig: 0.3, shadowExt: 22, aurora: 0, gain: '#f2ddba',
    waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
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
  if (S.id === 'cloudy') return blendLight(LIGHTS.gold, LIGHTS.grey, smooth(ramp(f, 698, 740)));
  if (S.id === 'reveal') return blendLight(LIGHTS.grey, LIGHTS.gold, smooth(ramp(f, 1034, 1100)));
  if (S.id === 'hookq') return blendLight(LIGHTS.gold, LIGHTS.dusk, smooth(ramp(f, 1522, 1580)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging (shared by story, main, colliders) ----------
export const BOARD_POS = [0, 3.1, -6];
export const PLATFORM = { x: 0, z: 2, r: 1.35, top: 0.18 };
export const STALL = { x: -7.3, z: 6.1, ry: 0.2 };
export const TABLE = { x: 4.4, z: 7.2 };
const POT_STALL = [-6.9, 0.78, 6.0];
const POT_HOME = [PLATFORM.x, PLATFORM.top, PLATFORM.z];

const walkKeys = (keys, f) => {
  let x = keys[0][1], z = keys[0][2];
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i][0]) { const a = keys[i - 1], b = keys[i]; const u = smooth(ramp(f, a[0], b[0])); return [lerp(a[1], b[1], u), lerp(a[2], b[2], u)]; }
    x = keys[keys.length - 1][1]; z = keys[keys.length - 1][2];
  }
  return [x, z];
};
const WOMAN_KEYS = [
  [0, -5.3, 6.6], [299, -5.3, 6.6], [345, -1.7, 4.4], [1256, -1.7, 4.4],
  [1290, -0.95, 3.5], [1335, -0.95, 3.5], [1380, -1.7, 4.4], [1679, -1.7, 4.4],
];
const KING_KEYS = [
  [0, 3.1, 5.6], [411, 3.1, 5.6], [432, 2.2, 4.4], [697, 2.2, 4.4],
  [720, 2.6, 5.2], [1417, 2.6, 5.2], [1460, 1.9, 4.7], [1679, 1.9, 4.7],
];
const C1_KEYS = [
  [0, 4.8, 3.2], [1256, 4.8, 3.2], [1290, 1.55, 3.3], [1335, 1.55, 3.3], [1380, 4.8, 3.2], [1679, 4.8, 3.2],
];
export const womanAt = (f) => { const [x, z] = walkKeys(WOMAN_KEYS, f); return { x, z }; };
export const kingAt = (f) => { const [x, z] = walkKeys(KING_KEYS, f); return { x, z }; };
export const c1At = (f) => { const [x, z] = walkKeys(C1_KEYS, f); return { x, z }; };
const strolling = (f, spans) => spans.some(([a, b]) => f >= a && f <= b) ? 1 : 0;
export const womanMode = (f) => strolling(f, [[300, 345], [1257, 1290], [1335, 1380]]) ? 'stroll' : 'stand';
export const potAt = (f) => {
  if (f < 300) return { x: POT_STALL[0], y: POT_STALL[1], z: POT_STALL[2], carried: 0, resting: 1 };
  if (f <= 345) {
    const u = smooth(ramp(f, 300, 345));
    return { x: lerp(POT_STALL[0], POT_HOME[0], u), y: lerp(POT_STALL[1], POT_HOME[1], u) + Math.sin(u * Math.PI) * 0.22, z: lerp(POT_STALL[2], POT_HOME[2], u), carried: 1, resting: 0 };
  }
  return { x: POT_HOME[0], y: POT_HOME[1], z: POT_HOME[2], carried: 0, resting: 1 };
};
// lid: lift 0..1 (height + tilt of the mirror lid)
export const lidAt = (f) => {
  let lift = 0;
  const seg = (a, b, c, d, peak) => { if (f >= a && f <= d) lift = Math.max(lift, peak * (f < b ? smooth(ramp(f, a, b)) : f <= c ? 1 : 1 - smooth(ramp(f, c, d)))); };
  seg(468, 492, 522, 548, 1);      // noon: the king lifts it himself
  seg(608, 626, 648, 672, 0.9);    // tests: a courtier lifts it again
  seg(1296, 1308, 1322, 1342, 0.28); // peek: one crack — and she seals it
  return lift;
};
const segMax = (f, segs) => {
  let s = 0;
  for (const [a, b, c, d, peak] of segs) if (f >= a && f <= d) s = Math.max(s, peak * (f < b ? smooth(ramp(f, a, b)) : f <= c ? 1 : 1 - smooth(ramp(f, c, d))));
  return s;
};
export const steamAt = (f) => segMax(f, [
  [468, 486, 540, 551, 1],       // the noon reveal BURST
  [608, 622, 660, 690, 0.55],    // tests: a smaller, proven plume
  [1298, 1310, 1330, 1352, 0.8], // peek: trapped heat escaping
]);
export const shimmerAt = (f) => segMax(f, [
  [360, 390, 411, 412, 0.45], [412, 440, 460, 468, 0.8],
  [552, 580, 680, 697, 0.7], [1090, 1120, 1230, 1256, 1], [1257, 1270, 1290, 1298, 0.6],
]);
export const raysAt = (f) => segMax(f, [
  [1058, 1100, 1210, 1256, 1],   // the reveal: rays bend into the food
  [1360, 1385, 1405, 1417, 0.6], // "the sun was the fire"
]);
export const glintAt = (f) => {
  let s = 0;
  const pulse = (a, b, peak) => { if (f >= a && f <= b) s = Math.max(s, peak * Math.sin(ramp(f, a, b) * Math.PI)); };
  pulse(300, 345, 0.5); pulse(468, 540, 0.9); pulse(608, 660, 0.6);
  pulse(1100, 1210, 1); pulse(1360, 1417, 0.7); pulse(1450, 1521, 0.55);
  return s;
};
export const coinAt = (f) => {
  const u = smooth(ramp(f, 1440, 1492));
  return { x: lerp(TABLE.x, -1.15, u), y: lerp(0.78, 1.02, u) + Math.sin(u * Math.PI) * 0.15, z: lerp(TABLE.z, 4.75, u), k: ramp(f, 1436, 1444) * (1 - ramp(f, 1506, 1520)) };
};

// ---------- hero / focus ----------
const FOCUS = {
  drone: () => [0, 1.2, 2],
  seller: () => { const w = womanAt(200); return [w.x, 1.2, w.z]; },
  rules: () => { const p = potAt(340); return [p.x, 0.7, p.z]; },
  noon: () => [0, 0.75, 2],
  tests: () => [0, 0.75, 2],
  cloudy: () => [0.6, 1.1, 3.2],
  bow: () => { const w = womanAt(880); return [w.x, 1.3, w.z]; },
  dialogue: () => { const w = womanAt(980); return [w.x, 1.45, w.z]; },
  reveal: () => [0, 0.8, 2],
  peek: () => [0, 0.8, 2],
  paid: () => [0.3, 1.1, 5],
  hookq: () => BOARD_POS, hook: () => BOARD_POS,
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id]();

// ---------- cameras: EVERY shot is a camrig track on a subject ----------
const potPos = (f) => { const p = potAt(f); return [p.x, p.y, p.z]; };
const womanPos = (f) => { const w = womanAt(f); return [w.x, 0, w.z]; };
const bezierCam = (P, L, a, b, fov0, fov1) => (f) => {
  const u = M.smooth(ramp(f, a, b));
  const w0 = (1 - u) ** 3, w1 = 3 * (1 - u) ** 2 * u, w2 = 3 * (1 - u) * u * u, w3 = u ** 3;
  const mix = (Q) => [0, 1, 2].map((j) => w0 * Q[0][j] + w1 * Q[1][j] + w2 * Q[2][j] + w3 * Q[3][j]);
  return { pos: mix(P), look: mix(L), fov: lerp(fov0, fov1, u), roll: 0 };
};
const RIG_BY_ID = {
  drone: { cut: 'hard', raw: bezierCam(
    [[22, 13, 27], [13, 7.5, 19], [9, 4.5, 15.5], [7.4, 3.1, 13.4]],
    [[0, 3.0, -6], [0, 2.2, -2], [0, 1.2, 1.6], [0, 1.0, 2.2]], 0, 159, 44, 40) },
  seller: { cut: 'hard', raw: pushInCam({ subject: womanPos, a: 160, b: 258, d0: 5.6, d1: 4.3, h0: 1.55, h1: 1.45, lookOff: [0, 1.35, 0], fov0: 40, fov1: 34,
    dir: () => [0.62, 0.72] }) },
  rules: { cut: 'hard', raw: staticTrackCam({ pos: [-4.8, 2.1, 10.8], subject: potPos, lookOff: [0, 0.3, 0], fov: 38 }) },
  noon: { cut: 'hard', raw: pushInCam({ subject: potPos, a: 412, b: 551, d0: 5.2, d1: 4.3, h0: 1.7, h1: 1.5, lookOff: [0, 0.5, 0], fov0: 36, fov1: 32,
    dir: () => [0.55, 0.8] }) },
  tests: { cut: 'hard', raw: keysCam({ keys: [
    { f: 552, pos: [6.4, 2.5, 9.8], look: [0, 0.6, 2.1], fov: 40 },
    { f: 697, pos: [5.7, 2.3, 9.2], look: [0, 0.6, 2.05], fov: 37, ease: 'surge' }] }) },
  cloudy: { cut: 'hard', raw: keysCam({ keys: [
    { f: 698, pos: [8.6, 3.5, 13.2], look: [0.4, 1.0, 2.8], fov: 44 },
    { f: 833, pos: [8.1, 3.3, 12.6], look: [0.4, 1.0, 2.8], fov: 42, ease: 'surge' }] }) },
  bow: { cut: 'hard', raw: pushInCam({ subject: womanPos, a: 834, b: 926, d0: 4.4, d1: 3.3, h0: 1.55, h1: 1.45, lookOff: [0, 1.4, 0], fov0: 38, fov1: 33,
    dir: () => [0.5, 0.8] }) },
  dialogue: { cut: 'hard', raw: pushInCam({ subject: womanPos, a: 927, b: 1033, d0: 3.4, d1: 2.75, h0: 1.58, h1: 1.5, lookOff: [0, 1.45, 0], fov0: 32, fov1: 28,
    dir: () => [0.45, 0.85] }) },
  reveal: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1034, pos: [7.5, 3.4, 13.8], look: [-0.6, 0.8, 2.8], fov: 44 },
    { f: 1256, pos: [5.4, 2.6, 9.8], look: [0, 0.75, 2], fov: 34, ease: 'surge' }] }) },
  peek: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1257, pos: [4.5, 1.95, 8.9], look: [0, 0.65, 2.05], fov: 36 },
    { f: 1417, pos: [4.1, 1.85, 8.5], look: [0, 0.65, 2.05], fov: 34, ease: 'surge' }] }) },
  paid: { cut: 'hard', raw: staticTrackCam({ pos: [3.9, 2.2, 11.6], subject: () => [0.3, 0, 5.0], lookOff: [0, 1.05, 0], fov: 38 }) },
  hookq: { cut: 'blend', blend: 10, raw: keysCam({ keys: [
    { f: 1522, pos: [5.6, 3.1, 7.8], look: [0.1, 2.9, -5.9], fov: 40 },
    { f: 1619, pos: [5.1, 3.2, 7.3], look: [0.05, 3.0, -5.95], fov: 37, ease: 'surge' }] }) },
  hook: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1620, pos: [5.1, 3.2, 7.3], look: [0.05, 3.0, -5.95], fov: 37 },
    { f: 1679, pos: [4.9, 3.25, 7.1], look: [0.02, 3.05, -5.97], fov: 36, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: 345, a: 0.03 }, { f: 492, a: 0.03 }],
  sigma: 2.3, fovSigma: 1.6,
});
export const camAt = (f) => RIG.camAt(f);
export const RIG_META = {
  kicks: RIG.declared.kicks, hardCuts: RIG.declared.hardCuts,
  blends: SHOTS.filter((s) => RIG_BY_ID[s.id].cut === 'blend').map((s) => ({ a: s.a - Math.floor(RIG_BY_ID[s.id].blend / 2), b: s.a + Math.ceil(RIG_BY_ID[s.id].blend / 2) })),
  whips: RIG.declared.whips,
  samples: RIG.samples,
};
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), hp = heroPosAt(f);
  let cinf = 2.4;
  if (['drone', 'hookq'].includes(S.id)) cinf = 1.4;
  if (['noon', 'dialogue', 'reveal', 'peek'].includes(S.id)) cinf = 3.6;
  if (S.id === 'hook') cinf = 3.0;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f), p = potAt(f), lid = lidAt(f), cn = coinAt(f);
  const W = {
    boardTitle: 0, boardHook: 0,
    potX: p.x, potY: p.y, potZ: p.z, potCarried: p.carried,
    lidLift: lid, foodK: lid > 0.45 ? 1 : lid * 2,
    steamK: steamAt(f), shimmerK: shimmerAt(f), raysK: raysAt(f), lidGlint: glintAt(f),
    coinX: cn.x, coinY: cn.y, coinZ: cn.z, coinK: cn.k,
    dustK: 0.05,
  };
  if (S.id === 'drone') W.boardTitle = smooth(ramp(f, 24, 38)) * (1 - smooth(ramp(f, 54, 68)));
  if (S.id === 'hookq') W.boardHook = smooth(ramp(f, 1568, 1592));
  if (S.id === 'hook') W.boardHook = 1;   // held at FULL opacity to the literal last frame
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return { smokeRate: 0.05, dustRate: 0.05, splashRate: 0, steamRate: steamAt(f), shimmerRate: shimmerAt(f), grey: S.light === 'grey' ? 1 : 0 };
};
export const fxAt = () => [];

// ---------- cast (single source for actors AND colliders) ----------
const TINT = { gold: '#ffffff', grey: '#c3ccd4', dusk: '#f2ddc4' };
const tintFor = (S) => TINT[S.light] || '#ffffff';
export const OUTFITS = {
  woman: { jacket: '#9a5a3a', pants: '#6a4a3a', boots: '#3a2a1c', hat: 'hair', hair: '#2c1a10', skin: '#a06a3c' },
  king: { jacket: '#8a2432', pants: '#3a2a4a', boots: '#241a12', hat: 'crown', skin: '#c98a5a' },
  court1: { jacket: '#2c4a6e', pants: '#2a3242', boots: '#1c1712', hat: 'cap', cap: '#c8a03a', skin: '#c98a5a' },
  court2: { jacket: '#4a6a3a', pants: '#33302c', boots: '#241a12', hat: 'hair', hair: '#1c1410', skin: '#8a5a34', moustache: '#241a12' },
  guard: { jacket: '#5a2a3a', pants: '#2c2226', boots: '#1c1712', hat: 'shako', skin: '#a06a3c' },
};
export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, z, extra = {}) => out.push({ id, x, y: 0, z, r: 0.32, ground: 0,
    actor: (T) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x, y: 0, z, ground: 0, tint, ...extra }) });
  const w = womanAt(f), k = kingAt(f), c1 = c1At(f);
  const wBase = { expr: 'smile', mode: 'stand', blink: blinkAt(f, 31), seed: 31 };
  switch (S.id) {
    case 'drone': {
      std('woman', OUTFITS.woman, { ...wBase }, w.x, w.z, { yaw: 0.5 });
      std('king', OUTFITS.king, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, k.x, k.z, { yaw: -0.5 });
      std('court1', OUTFITS.court1, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, c1.x, c1.z, { yaw: -0.3 });
      std('court2', OUTFITS.court2, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 52), seed: 52 }, -4.6, 0.8, { yaw: 0.4 });
      std('guard1', OUTFITS.guard, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 61), seed: 61 }, -3, -11.5, {});
      std('guard2', OUTFITS.guard, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 62), seed: 62 }, 3, -11.5, {});
      break;
    }
    case 'seller': {
      std('woman', OUTFITS.woman, { ...wBase, prop: ['point', 0.55] }, w.x, w.z, { yaw: 0.6 });
      std('king', OUTFITS.king, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, k.x, k.z, { yaw: -0.6 });
      break;
    }
    case 'rules': {
      const carrying = f >= 300 && f <= 345;
      std('woman', OUTFITS.woman, { ...wBase, mode: womanMode(f), phase: q((f * 0.011) % 1, 2), prop: !carrying && f >= 352 ? ['point', 0.7] : null }, w.x, w.z, { yaw: 0.55 });
      std('king', OUTFITS.king, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, k.x, k.z, { yaw: -0.55 });
      std('court1', OUTFITS.court1, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, c1.x, c1.z, { yaw: -0.3 });
      break;
    }
    case 'noon': {
      std('woman', OUTFITS.woman, { ...wBase }, w.x, w.z, { yaw: 0.55 });
      std('king', OUTFITS.king, { expr: f >= 478 && f < 512 ? 'shock' : 'smile', mode: 'stand', blink: blinkAt(f, 41), seed: 41, headTilt: f >= 460 && f < 540 ? -0.07 : 0 }, k.x, k.z, { yaw: -0.55 });
      std('court1', OUTFITS.court1, { expr: f >= 478 ? 'shock' : 'neutral', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, c1.x, c1.z, { yaw: -0.3 });
      std('court2', OUTFITS.court2, { expr: f >= 478 ? 'shock' : 'neutral', mode: 'stand', blink: blinkAt(f, 52), seed: 52 }, -4.6, 0.8, { yaw: 0.4 });
      break;
    }
    case 'tests': {
      std('woman', OUTFITS.woman, { ...wBase }, w.x, w.z, { yaw: 0.55 });
      std('king', OUTFITS.king, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, k.x, k.z, { yaw: -0.55 });
      std('court1', OUTFITS.court1, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, c1.x, c1.z, { yaw: -0.3 });
      std('court2', OUTFITS.court2, { expr: 'smile_closed', mode: 'stand', blink: blinkAt(f, 52), seed: 52 }, -4.6, 0.8, { yaw: 0.4 });
      break;
    }
    case 'cloudy': {
      std('woman', OUTFITS.woman, { ...wBase, expr: 'neutral', headTilt: 0.12 }, w.x, w.z, { yaw: 0.55 });
      std('king', OUTFITS.king, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, k.x, k.z, { yaw: -0.55 });
      std('court1', OUTFITS.court1, { expr: 'laugh', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, c1.x, c1.z, { yaw: -0.3 });
      std('court2', OUTFITS.court2, { expr: 'laugh', mode: 'stand', blink: blinkAt(f, 52), seed: 52 }, -4.6, 0.8, { yaw: 0.4 });
      std('guard1', OUTFITS.guard, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 61), seed: 61 }, -3, -11.5, {});
      std('guard2', OUTFITS.guard, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 62), seed: 62 }, 3, -11.5, {});
      break;
    }
    case 'bow': {
      const bowK = smooth(ramp(f, 848, 872)) * (1 - smooth(ramp(f, 884, 904)));
      std('woman', OUTFITS.woman, { ...wBase, headTilt: q(bowK * 0.38, 2), prop: f >= 884 ? ['point', 0.85] : null }, w.x, w.z, { yaw: 0.55 });
      std('king', OUTFITS.king, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, k.x, k.z, { yaw: -0.55 });
      break;
    }
    case 'dialogue': {
      // THE dialogue beat: the woman PERFORMS her line — mouth driven by
      // the stem inside the speak segment, closed outside it; the king
      // only listens (his mouth never opens: narration stays voice-over).
      std('woman', OUTFITS.woman, { mode: 'stand', blink: blinkAt(f, 31), seed: 31, look: 0.15, ...speakFace('smile', f) }, w.x, w.z, { yaw: 0.5 });
      std('king', OUTFITS.king, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, k.x, k.z, { yaw: -0.5 });
      break;
    }
    case 'reveal': {
      std('woman', OUTFITS.woman, { ...wBase, prop: ['point', 0.75] }, w.x, w.z, { yaw: 0.55 });
      std('king', OUTFITS.king, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, k.x, k.z, { yaw: -0.55 });
      std('court1', OUTFITS.court1, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, c1.x, c1.z, { yaw: -0.3 });
      break;
    }
    case 'peek': {
      std('woman', OUTFITS.woman, { ...wBase, expr: f >= 1330 ? 'stern' : 'smile', mode: womanMode(f), phase: q((f * 0.011) % 1, 2) }, w.x, w.z, { yaw: 0.55 });
      std('king', OUTFITS.king, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, k.x, k.z, { yaw: -0.55 });
      std('court1', OUTFITS.court1, { expr: f >= 1296 && f < 1345 ? 'nervous' : 'smile', mode: strolling(f, [[1257, 1290], [1335, 1380]]) ? 'stroll' : 'stand', phase: q((f * 0.011) % 1, 2), blink: blinkAt(f, 51), seed: 51 }, c1.x, c1.z, { yaw: -0.85 });
      break;
    }
    case 'paid': {
      std('woman', OUTFITS.woman, { ...wBase }, w.x, w.z, { yaw: 0.55 });
      std('king', OUTFITS.king, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 41), seed: 41, prop: f >= 1436 && f <= 1500 ? ['point', 0.5] : null }, k.x, k.z, { yaw: -0.55 });
      std('court1', OUTFITS.court1, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, c1.x, c1.z, { yaw: -0.3 });
      break;
    }
    case 'hookq': case 'hook': break;
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity: statics, dynamics, ground (LIBRARY v3 gate data) ----------
export const STATICS = [
  SOL.circle(PLATFORM.x, PLATFORM.z, PLATFORM.r, { h: PLATFORM.top, id: 'platform' }),
  SOL.aabb(-18, 18, -15.5, -13.8, { h: 5, id: 'facade' }),
  SOL.aabb(-17.5, -16, -14, 12, { h: 2.6, id: 'wallW' }),
  SOL.aabb(16, 17.5, -14, 12, { h: 2.6, id: 'wallE' }),
  SOL.obb(STALL.x, STALL.z, STALL.ry, 1.3, 0.8, { h: 2.2, id: 'stall' }),
  SOL.obb(TABLE.x, TABLE.z, 0, 0.85, 0.5, { h: 0.78, id: 'table' }),
  SOL.circle(BOARD_POS[0] - 2.1, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  SOL.circle(BOARD_POS[0] + 2.1, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  ...[-12, -8, -4, 0, 4, 8, 12].map((x) => SOL.circle(x, -13.2, 0.35, { h: 4.4, id: 'column' })),
];
export const WORLD = SOL.makeWorld(STATICS);
export const dynamicsAt = (f) => {
  const out = [];
  for (const a of castAt(f)) out.push(SOL.circle(a.x, a.z, a.r, { kind: 'dynamic', id: a.id }));
  return out;
};
export const groundItemsAt = (f) => {
  const items = [];
  const p = potAt(f);
  // the pot is a carried/resting prop: ground-checked whenever it RESTS
  // (stall table top 0.78 / platform top 0.18); while carried it is
  // transitional (in the woman's hands) and unchecked, like a fall.
  if (p.resting) items.push({ id: 'pot', y: p.y, ground: f < 300 ? 0.78 : PLATFORM.top, maxHover: 0.03 });
  for (const a of castAt(f)) items.push({ id: a.id, y: a.y, ground: 0, maxHover: 0.06 });
  return items;
};
