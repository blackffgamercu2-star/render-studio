// Shot plan for "The Inn Where Nobody Ever Paid" — inn (LIBRARY v4: speak.js
// dialogue performance + materials v4, camrig smooth tracking + solid
// colliders). Batch 8 E2. ONE set: a warm roadside inn yard at golden
// hour — timber facade, lit windows, story fire, long guest table, the
// great leather book on its lectern, and the chest of gold at the payoff.
// Voice stem: 55.571 s, 30 fps, TOTAL 1667; timings from faster-whisper
// base.en word alignment (words.json, match 0.975). Scene changes ONLY
// at clause boundaries:
//   S1  0.00- 4.06 drone: On the busiest road...coin.   S7  26.30-29.00 dialogue: "Coins run out..."
//   S2  4.48- 8.48 guests: Guests ate hot stew...       S8  29.64-33.70 merchant: A cheating merchant...
//   S3  8.94-12.12 price: The price of a night...       S9  34.16-39.80 book: The keeper opened his book...
//   S4 12.66-17.24 pay: A soldier paid...               S10 40.46-44.90 writer: Then one spring...
//   S5 17.76-21.50 write: Every night the keeper...     S11 45.50-50.72 chest: He paid a chest of gold...
//   S6 22.06-25.58 purse: A rich guest once offered...  S12 51.24-55.14 hook: But tomorrow...village?
// GRADE (FILTER_VFX_LIGHTING pack): Memory Warm throughout; fireside
// beats blend toward a deeper firelight; the hook blends to dusk. Grade
// changes ONLY on clause boundaries. Signature VFX: fire flames + embers
// (brightest at source), window/lantern glow, gold sheen sweep on the
// chest, dust motes in the warm light.
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

export const FPS = 30, TOTAL = 1667, DECK = 0;
export const SHOTS = [
  { id: 'drone', a: 0, b: 133, light: 'warm' },
  { id: 'guests', a: 134, b: 267, light: 'warm' },
  { id: 'price', a: 268, b: 379, light: 'fire' },
  { id: 'pay', a: 380, b: 532, light: 'fire' },
  { id: 'write', a: 533, b: 661, light: 'fire' },
  { id: 'purse', a: 662, b: 788, light: 'warm' },
  { id: 'dialogue', a: 789, b: 888, light: 'fire' },
  { id: 'merchant', a: 889, b: 1024, light: 'fire' },
  { id: 'book', a: 1025, b: 1213, light: 'fire' },
  { id: 'writer', a: 1214, b: 1364, light: 'fire' },
  { id: 'chest', a: 1365, b: 1536, light: 'warm' },
  { id: 'hookq', a: 1537, b: 1610, light: 'dusk' },
  { id: 'hook', a: 1611, b: 1666, light: 'dusk' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights / mood grades ----------
export const LIGHTS = {
  warm: { az: 232, el: 27, sky: '#f0cf9e', ground: '#8a6f4a', hemi: 1.02, sun: '#ffd9a0', sunI: 2.45, fog: '#e8d3ac', fogNear: 46, fogFar: 330,
    skyTop: '#3a6ab0', skyHor: '#f2cd8e', sunDisc: '#fff0bc', sunSize: 0.0042, sat: 1.12, vig: 0.26, shadowExt: 22, aurora: 0, gain: '#ffe8c0',
    waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
  fire: { az: 250, el: 20, sky: '#e8b878', ground: '#7a5a3a', hemi: 1.12, sun: '#ff9a4a', sunI: 1.9, fog: '#d9a878', fogNear: 40, fogFar: 300,
    skyTop: '#4a3a6e', skyHor: '#f0a668', sunDisc: '#ffbe78', sunSize: 0.004, sat: 1.12, vig: 0.28, shadowExt: 22, aurora: 0, gain: '#f2d8b0',
    waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
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
  if (S.id === 'price') return blendLight(LIGHTS.warm, LIGHTS.fire, smooth(ramp(f, 268, 320)));
  if (S.id === 'purse') return blendLight(LIGHTS.fire, LIGHTS.warm, smooth(ramp(f, 662, 720)));
  if (S.id === 'chest') return blendLight(LIGHTS.fire, LIGHTS.warm, smooth(ramp(f, 1365, 1420)));
  if (S.id === 'hookq') return blendLight(LIGHTS.warm, LIGHTS.dusk, smooth(ramp(f, 1537, 1590)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging (shared by story, main, colliders) ----------
export const BOARD_POS = [0, 3.1, -6];
export const FIRE = { x: 0, z: 3.5 };
export const LECTERN = { x: -1.6, z: 2.2, top: 1.06, ry: 0.35 };
export const TABLE = { x: 6.5, z: 4.5, ry: -0.15 };
export const CHEST = { x: 2.2, z: 6.2, ry: -0.3 };
export const ROAD = { z: 11.5 };

const walkKeys = (keys, f) => {
  let x = keys[0][1], z = keys[0][2];
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i][0]) { const a = keys[i - 1], b = keys[i]; const u = smooth(ramp(f, a[0], b[0])); return [lerp(a[1], b[1], u), lerp(a[2], b[2], u)]; }
    x = keys[keys.length - 1][1]; z = keys[keys.length - 1][2];
  }
  return [x, z];
};
const KEEPER_KEYS = [
  [0, -1.6, 1.0], [1213, -1.6, 1.0], [1226, 0.8, 1.2], [1242, 2.6, 4.6], [1260, 1.2, 4.8], [1364, 1.2, 4.8],
  [1410, 1.0, 4.6], [1666, 1.0, 4.6],
];
const MERCHANT_KEYS = [
  [889, -9, 11.5], [950, -3.2, 5.0], [1213, -3.2, 5.0],
];
const SAILOR_KEYS = [
  [0, 3.4, 3.6], [1024, 3.4, 3.6], [1075, 2.4, 2.0], [1260, 2.4, 2.0], [1310, 3.4, 3.6], [1666, 3.4, 3.6],
];
const WRITER_KEYS = [
  [1214, 12, 11.5], [1280, 4.5, 7.5], [1364, 4.5, 7.5], [1410, 2.6, 7.6], [1666, 2.6, 7.6],
];
export const keeperAt = (f) => { const [x, z] = walkKeys(KEEPER_KEYS, f); return { x, z }; };
export const merchantAt = (f) => { const [x, z] = walkKeys(MERCHANT_KEYS, f); return { x, z }; };
export const sailorAt = (f) => { const [x, z] = walkKeys(SAILOR_KEYS, f); return { x, z }; };
export const writerAt = (f) => { const [x, z] = walkKeys(WRITER_KEYS, f); return { x, z }; };
const strolling = (f, spans) => spans.some(([a, b]) => f >= a && f <= b) ? 1 : 0;
export const keeperMode = (f) => strolling(f, [[1214, 1260], [1365, 1410]]) ? 'stroll' : 'stand';
export const merchantMode = (f) => strolling(f, [[889, 950]]) ? 'stroll' : 'stand';
export const sailorMode = (f) => strolling(f, [[1025, 1075], [1261, 1310]]) ? 'stroll' : 'stand';
export const writerMode = (f) => strolling(f, [[1214, 1280], [1365, 1410]]) ? 'stroll' : 'stand';
// the book opens when the keeper reads the sailor's story back (L9)
export const bookOpenAt = (f) => {
  if (f < 1030) return 0;
  if (f <= 1060) return smooth(ramp(f, 1030, 1060));
  if (f <= 1180) return 1;
  if (f <= 1210) return 1 - smooth(ramp(f, 1180, 1210));
  return 0;
};
// the chest lid opens at the payoff (L11) and stays open
export const chestOpenAt = (f) => {
  if (f < 1400) return 0;
  if (f <= 1430) return smooth(ramp(f, 1400, 1430));
  return 1;
};
// the rich guest's purse: offered in L6, refused, pocketed
export const purseAt = (f) => {
  const k = f < 670 ? 0 : f <= 700 ? smooth(ramp(f, 670, 700)) : f <= 750 ? 1 : f <= 780 ? 1 - smooth(ramp(f, 750, 780)) : 0;
  return { k, x: 2.6, y: 1.05, z: 3.6 };
};

// ---------- hero / focus ----------
const FOCUS = {
  drone: () => [0, 1.2, 2],
  guests: () => [6.5, 0.9, 4.5],
  price: () => [-1.6, 1.3, 2.2],
  pay: () => [-2.6, 1.2, 2.6],
  write: () => [-1.6, 1.3, 2.2],
  purse: () => [2.9, 1.2, 3.9],
  dialogue: () => { const k = keeperAt(830); return [k.x, 1.45, k.z]; },
  merchant: () => { const m = merchantAt(960); return [m.x, 1.3, m.z]; },
  book: () => [-1.6, 1.2, 2.2],
  writer: () => { const w = writerAt(1300); return [w.x, 1.2, w.z]; },
  chest: () => [CHEST.x, 0.8, CHEST.z],
  hookq: () => BOARD_POS, hook: () => BOARD_POS,
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id]();

// ---------- cameras: EVERY shot is a camrig track on a subject ----------
const keeperPos = (f) => { const k = keeperAt(f); return [k.x, 0, k.z]; };
const merchantPos = (f) => { const m = merchantAt(f); return [m.x, 0, m.z]; };
const bookPos = () => [LECTERN.x, LECTERN.top, LECTERN.z];
const chestPos = () => [CHEST.x, 0.7, CHEST.z];
const bezierCam = (P, L, a, b, fov0, fov1) => (f) => {
  const u = M.smooth(ramp(f, a, b));
  const w0 = (1 - u) ** 3, w1 = 3 * (1 - u) ** 2 * u, w2 = 3 * (1 - u) * u * u, w3 = u ** 3;
  const mix = (Q) => [0, 1, 2].map((j) => w0 * Q[0][j] + w1 * Q[1][j] + w2 * Q[2][j] + w3 * Q[3][j]);
  return { pos: mix(P), look: mix(L), fov: lerp(fov0, fov1, u), roll: 0 };
};
const RIG_BY_ID = {
  drone: { cut: 'hard', raw: bezierCam(
    [[24, 14, 30], [14, 8, 21], [9, 4.5, 15.5], [7.2, 3.1, 13.2]],
    [[0, 3.0, -6], [0, 2.2, -2], [0, 1.2, 1.6], [0, 1.0, 2.4]], 0, 133, 44, 40) },
  guests: { cut: 'hard', raw: pushInCam({ subject: () => [6.5, 0, 4.5], a: 134, b: 267, d0: 6.4, d1: 4.9, h0: 1.7, h1: 1.5, lookOff: [0, 0.9, 0], fov0: 40, fov1: 35,
    dir: () => [0.55, 0.8] }) },
  price: { cut: 'hard', raw: keysCam({ keys: [
    { f: 268, pos: [4.6, 3.0, 10.4], look: [-1.2, 1.1, 2.6], fov: 42 },
    { f: 379, pos: [3.6, 2.5, 8.6], look: [-1.5, 1.2, 2.3], fov: 36, ease: 'surge' }] }) },
  pay: { cut: 'hard', raw: pushInCam({ subject: () => [-2.6, 0, 2.6], a: 380, b: 532, d0: 5.4, d1: 4.2, h0: 1.6, h1: 1.5, lookOff: [0, 1.25, 0], fov0: 38, fov1: 33,
    dir: () => [-0.5, 0.85] }) },
  write: { cut: 'hard', raw: pushInCam({ subject: bookPos, a: 533, b: 661, d0: 4.6, d1: 3.4, h0: 1.7, h1: 1.5, lookOff: [0, 0.4, 0], fov0: 36, fov1: 31,
    dir: () => [0.45, 0.85] }) },
  purse: { cut: 'hard', raw: staticTrackCam({ pos: [5.6, 2.3, 9.6], subject: () => [2.9, 0, 3.9], lookOff: [0, 1.1, 0], fov: 38 }) },
  dialogue: { cut: 'hard', raw: pushInCam({ subject: keeperPos, a: 789, b: 888, d0: 3.4, d1: 2.75, h0: 1.58, h1: 1.5, lookOff: [0, 1.45, 0], fov0: 32, fov1: 28,
    dir: () => [0.45, 0.85] }) },
  merchant: { cut: 'hard', raw: keysCam({ keys: [
    { f: 889, pos: [3.4, 2.6, 11.4], look: [-2.4, 1.1, 4.6], fov: 40 },
    { f: 1024, pos: [2.2, 2.2, 9.2], look: [-3.0, 1.25, 5.0], fov: 34, ease: 'surge' }] }) },
  book: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1025, pos: [2.0, 3.1, 15.6], look: [0.4, 1.2, 2.1], fov: 48 },
    { f: 1213, pos: [1.7, 2.9, 14.4], look: [0.4, 1.15, 2.1], fov: 44, ease: 'surge' }] }) },
  writer: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1214, pos: [7.8, 3.2, 12.4], look: [2.2, 1.1, 5.4], fov: 42 },
    { f: 1364, pos: [6.2, 2.6, 10.4], look: [1.6, 1.15, 4.9], fov: 36, ease: 'surge' }] }) },
  chest: { cut: 'hard', raw: pushInCam({ subject: chestPos, a: 1365, b: 1536, d0: 6.0, d1: 4.9, h0: 1.7, h1: 1.5, lookOff: [0, 0.6, 0], fov0: 36, fov1: 32,
    dir: () => [0.45, 0.85] }) },
  hookq: { cut: 'blend', blend: 10, raw: keysCam({ keys: [
    { f: 1537, pos: [5.6, 3.1, 7.8], look: [0.1, 2.9, -5.9], fov: 40 },
    { f: 1610, pos: [5.1, 3.2, 7.3], look: [0.05, 3.0, -5.95], fov: 37, ease: 'surge' }] }) },
  hook: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1611, pos: [5.1, 3.2, 7.3], look: [0.05, 3.0, -5.95], fov: 37 },
    { f: 1666, pos: [4.9, 3.25, 7.1], look: [0.02, 3.05, -5.97], fov: 36, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: 1430, a: 0.03 }],
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
  if (['dialogue', 'write', 'book', 'chest'].includes(S.id)) cinf = 3.6;
  if (S.id === 'hook') cinf = 3.0;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f), ps = purseAt(f);
  const W = {
    boardTitle: 0, boardHook: 0,
    bookOpen: bookOpenAt(f), chestOpen: chestOpenAt(f),
    purseK: ps.k, purseX: ps.x, purseY: ps.y, purseZ: ps.z,
    dustK: 0.05,
  };
  if (S.id === 'drone') W.boardTitle = smooth(ramp(f, 24, 38)) * (1 - smooth(ramp(f, 54, 68)));
  if (S.id === 'hookq') W.boardHook = smooth(ramp(f, 1583, 1607));
  if (S.id === 'hook') W.boardHook = 1;   // held at FULL opacity to the literal last frame
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return { smokeRate: 0.05, dustRate: 0.05, splashRate: 0, steamRate: 0, shimmerRate: 0, emberRate: ['price', 'pay', 'write', 'dialogue', 'merchant', 'book', 'writer'].includes(S.id) ? 1 : 0.6, grey: 0 };
};
export const fxAt = () => [];

// ---------- cast (single source for actors AND colliders) ----------
const TINT = { warm: '#ffffff', fire: '#ffd9b0', dusk: '#f2ddc4' };
const tintFor = (S) => TINT[S.light] || '#ffffff';
export const OUTFITS = {
  keeper: { jacket: '#8a6a3a', pants: '#4a3a2c', boots: '#2a1c12', hat: 'cap', cap: '#c8a03a', skin: '#c98a5a', moustache: '#3a2a1c' },
  soldier: { jacket: '#5a3a2e', pants: '#3a2a2a', boots: '#241a12', hat: 'shako', skin: '#a06a3c' },
  widow: { jacket: '#4a3a5a', pants: '#3a2a4a', boots: '#241a12', hat: 'hair', hair: '#c8c8c8', skin: '#d8a878', dress: true },
  merchant: { jacket: '#6a2a4a', pants: '#2a2432', boots: '#1c1410', hat: 'cap', cap: '#2a1a3a', skin: '#c98a5a', moustache: '#241a12' },
  sailor: { jacket: '#2c4a6e', pants: '#2a3242', boots: '#1c1712', hat: 'cap', cap: '#e8e0c8', skin: '#b07848' },
  writer: { jacket: '#3a4a3a', pants: '#2c2c26', boots: '#1c1712', hat: 'cap', cap: '#3a2a1a', skin: '#c98a5a' },
  guest1: { jacket: '#4a6a3a', pants: '#33302c', boots: '#241a12', hat: 'hair', hair: '#1c1410', skin: '#8a5a34' },
  guest2: { jacket: '#2c4a6e', pants: '#2a3242', boots: '#1c1712', hat: 'hair', hair: '#5a3a1a', skin: '#c98a5a' },
  rich: { jacket: '#7a5a1a', pants: '#3a2a1a', boots: '#1c1410', hat: 'cap', cap: '#e8c84a', skin: '#d8a878' },
};
export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, z, extra = {}) => out.push({ id, x, y: 0, z, r: 0.32, ground: 0,
    actor: (T) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x, y: 0, z, ground: 0, tint, ...extra }) });
  const k = keeperAt(f), m = merchantAt(f), sl = sailorAt(f), w = writerAt(f);
  const kBase = { expr: 'smile', mode: 'stand', blink: blinkAt(f, 31), seed: 31 };
  switch (S.id) {
    case 'drone': {
      std('keeper', OUTFITS.keeper, { ...kBase }, k.x, k.z, { yaw: 0.5 });
      std('soldier', OUTFITS.soldier, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, -2.8, 1.6, { yaw: -0.4 });
      std('widow', OUTFITS.widow, { expr: 'smile', mode: 'sit', blink: blinkAt(f, 42), seed: 42 }, -2.6, 3.5, { yaw: 0.9 });
      std('sailor', OUTFITS.sailor, { expr: 'smile', mode: 'sit', blink: blinkAt(f, 43), seed: 43 }, sl.x, sl.z, { yaw: -0.9 });
      std('guest1', OUTFITS.guest1, { expr: 'smile', mode: 'sit', blink: blinkAt(f, 51), seed: 51 }, 5.4, 5.7, { yaw: 0 });
      std('guest2', OUTFITS.guest2, { expr: 'smile', mode: 'sit', blink: blinkAt(f, 52), seed: 52 }, 7.6, 5.7, { yaw: 0 });
      break;
    }
    case 'guests': {
      std('keeper', OUTFITS.keeper, { ...kBase }, k.x, k.z, { yaw: 0.5 });
      std('guest1', OUTFITS.guest1, { expr: 'smile', mode: 'sit', blink: blinkAt(f, 51), seed: 51, prop: ['point', 0.4] }, 5.4, 5.7, { yaw: 0 });
      std('guest2', OUTFITS.guest2, { expr: 'laugh', mode: 'sit', blink: blinkAt(f, 52), seed: 52 }, 7.6, 5.7, { yaw: 0 });
      std('guest3', OUTFITS.soldier, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 53), seed: 53 }, 8.8, 3.6, { yaw: -0.7 });
      break;
    }
    case 'price': {
      std('keeper', OUTFITS.keeper, { ...kBase, prop: ['point', 0.7] }, k.x, k.z, { yaw: 0.5 });
      std('guest1', OUTFITS.guest1, { expr: 'smile', mode: 'sit', blink: blinkAt(f, 51), seed: 51 }, 5.4, 5.7, { yaw: 0 });
      std('guest2', OUTFITS.guest2, { expr: 'smile', mode: 'sit', blink: blinkAt(f, 52), seed: 52 }, 7.6, 5.7, { yaw: 0 });
      break;
    }
    case 'pay': {
      std('soldier', OUTFITS.soldier, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 41), seed: 41, prop: ['point', 0.8] }, -2.8, 1.6, { yaw: -0.4 });
      std('widow', OUTFITS.widow, { expr: 'smile', mode: 'sit', blink: blinkAt(f, 42), seed: 42 }, -2.6, 3.5, { yaw: 0.9 });
      std('keeper', OUTFITS.keeper, { ...kBase }, k.x, k.z, { yaw: 0.5 });
      break;
    }
    case 'write': {
      std('keeper', OUTFITS.keeper, { ...kBase, headTilt: 0.16, prop: ['point', 0.3] }, k.x, k.z, { yaw: 0.5 });
      std('sailor', OUTFITS.sailor, { expr: 'smile', mode: 'sit', blink: blinkAt(f, 43), seed: 43 }, sl.x, sl.z, { yaw: -0.9 });
      break;
    }
    case 'purse': {
      std('rich', OUTFITS.rich, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 61), seed: 61, prop: ['point', 0.75] }, 3.2, 4.2, { yaw: -0.6 });
      std('keeper', OUTFITS.keeper, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 31), seed: 31, headTilt: 0.08 }, k.x, k.z, { yaw: 0.5 });
      break;
    }
    case 'dialogue': {
      // THE dialogue beat: the keeper PERFORMS his line — mouth driven by
      // the stem inside the speak segment, closed outside it; the rich
      // guest only listens (his mouth never opens: narration is voice-over).
      std('keeper', OUTFITS.keeper, { mode: 'stand', blink: blinkAt(f, 31), seed: 31, look: 0.15, ...speakFace('smile', f) }, k.x, k.z, { yaw: 0.5 });
      std('rich', OUTFITS.rich, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 61), seed: 61 }, 3.2, 4.2, { yaw: -0.5 });
      break;
    }
    case 'merchant': {
      std('merchant', OUTFITS.merchant, { expr: 'grin', mode: merchantMode(f), phase: q((f * 0.011) % 1, 2), blink: blinkAt(f, 71), seed: 71, prop: ['point', 0.85] }, m.x, m.z, { yaw: -0.5 });
      std('keeper', OUTFITS.keeper, { ...kBase, expr: 'neutral' }, k.x, k.z, { yaw: 0.5 });
      std('sailor', OUTFITS.sailor, { expr: 'neutral', mode: 'sit', blink: blinkAt(f, 43), seed: 43 }, sl.x, sl.z, { yaw: -0.9 });
      break;
    }
    case 'book': {
      std('keeper', OUTFITS.keeper, { ...kBase, headTilt: 0.14, prop: ['point', 0.5] }, k.x, k.z, { yaw: 0.5 });
      std('sailor', OUTFITS.sailor, { expr: f >= 1090 ? 'shock' : 'neutral', mode: sailorMode(f), phase: q((f * 0.011) % 1, 2), blink: blinkAt(f, 43), seed: 43 }, sl.x, sl.z, { yaw: -0.6 });
      std('merchant', OUTFITS.merchant, { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 71), seed: 71 }, m.x, m.z, { yaw: 0.4 });
      break;
    }
    case 'writer': {
      std('writer', OUTFITS.writer, { expr: 'smile', mode: writerMode(f), phase: q((f * 0.011) % 1, 2), blink: blinkAt(f, 81), seed: 81 }, w.x, w.z, { yaw: -0.5 });
      std('keeper', OUTFITS.keeper, { ...kBase }, k.x, k.z, { yaw: 0.5 });
      std('sailor', OUTFITS.sailor, { expr: 'smile', mode: 'sit', blink: blinkAt(f, 43), seed: 43 }, sl.x, sl.z, { yaw: -0.9 });
      std('widow', OUTFITS.widow, { expr: 'smile', mode: 'sit', blink: blinkAt(f, 42), seed: 42 }, -2.6, 3.5, { yaw: 0.9 });
      break;
    }
    case 'chest': {
      std('writer', OUTFITS.writer, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 81), seed: 81, prop: ['point', 0.7] }, w.x, w.z, { yaw: -0.4 });
      std('keeper', OUTFITS.keeper, { ...kBase, expr: 'grin' }, k.x, k.z, { yaw: 0.5 });
      break;
    }
    case 'hookq': case 'hook': break;
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity: statics, dynamics, ground (LIBRARY v3 gate data) ----------
export const STATICS = [
  SOL.aabb(-15, 15, -15.5, -13.8, { h: 6.4, id: 'facade' }),
  SOL.aabb(-16.2, -14.8, -14, 10, { h: 2.4, id: 'wallW' }),
  SOL.aabb(14.8, 16.2, -14, 10, { h: 2.4, id: 'wallE' }),
  SOL.circle(FIRE.x, FIRE.z, 1.15, { h: 0.5, id: 'firering' }),
  SOL.obb(LECTERN.x, LECTERN.z, LECTERN.ry, 0.65, 0.5, { h: 1.1, id: 'lectern' }),
  SOL.obb(TABLE.x, TABLE.z, TABLE.ry, 1.85, 0.7, { h: 0.8, id: 'table' }),
  SOL.obb(CHEST.x, CHEST.z, CHEST.ry, 0.8, 0.5, { h: 0.7, id: 'chest' }),
  SOL.circle(BOARD_POS[0] - 2.1, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  SOL.circle(BOARD_POS[0] + 2.1, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  SOL.circle(-12.5, 9.5, 0.3, { h: 3.4, id: 'treeW' }),
  SOL.circle(12.5, 10, 0.3, { h: 3.4, id: 'treeE' }),
  SOL.circle(-4.2, 8.2, 0.09, { h: 2.6, id: 'lanternW' }),
  SOL.circle(4.2, 8.2, 0.09, { h: 2.6, id: 'lanternE' }),
  SOL.circle(-9, 10.6, 0.09, { h: 3.0, id: 'signpost' }),
];
export const WORLD = SOL.makeWorld(STATICS);
export const dynamicsAt = (f) => {
  const out = [];
  for (const a of castAt(f)) out.push(SOL.circle(a.x, a.z, a.r, { kind: 'dynamic', id: a.id }));
  return out;
};
export const groundItemsAt = (f) => {
  const items = [];
  for (const a of castAt(f)) items.push({ id: a.id, y: a.y, ground: 0, maxHover: 0.06 });
  return items;
};
