// Shot plan for "कभी खाली न होने वाली मिठाई की थाली" — sweets-hindi
// (Salted Mine V3 style lock: painted 3D world, white-head card cast,
// word-by-word captions, hard-cut clause shots with slow pushes, body
// actions, ONE performed dialogue line with speak.js lip-sync).
// Voice stem: Puck (AI Studio), 59.691 s, 30 fps, TOTAL 1791; line
// timings from timing.json (char-mapped faster-whisper anchors).
// Scene changes ONLY at line/clause boundaries:
//   L1 0-116 tray sells all day, never empties   L9 949-1053 the hole
//   L2 128-205 morning: 100 laddus loaded        L10 1066-1156 wife rolls
//   L3 217-326 200+ sold by noon, tray full      L11 1165-1294 the refill
//   L4 326-444 "a god-given tray"                L12 1300-1407 tray lifted
//   L5 454-565 full price, Annapurna line        L13 1418-1549 crowd laughs
//   L6 579-686 neighbour tallies every sale      L14 1558-1599 the smile
//   L7 686-826 400 sold vs 100 loaded            L15 1599-1697 DIALOGUE
//   L8 841-938 sneak + peek through the crack    L16 1708-1788 hook board
// GRADE: Golden Hour in the shop, Memory Warm in the back room, warm
// dusk for the hook board. Boards/text are never graded.
import { M, blinkAt, q, clamp, lerp, ramp, kf } from './motion.js';
import { buildRig, keysCam } from './camrig.js';
import { poseWindows, turnTrack, winkTrack } from './body.js';
import { makeSpeakPlayer, applySpeak } from './speak.js';
import { SPEAK_DATA } from './speakdata.js';
import * as SOL from './solid.js';
import * as T from './toon.js';

export const FPS = 30, TOTAL = 1791, DECK = 0;
export const SHOTS = [
  { id: 'open', a: 0, b: 127, light: 'shop' },
  { id: 'morning', a: 128, b: 216, light: 'shop' },
  { id: 'crowd', a: 217, b: 325, light: 'shop' },
  { id: 'gossip', a: 326, b: 453, light: 'shop' },
  { id: 'smug', a: 454, b: 578, light: 'shop' },
  { id: 'tally', a: 579, b: 685, light: 'shop' },
  { id: 'count', a: 686, b: 840, light: 'shop' },
  { id: 'sneak', a: 841, b: 894, light: 'street' },
  { id: 'peek', a: 895, b: 948, light: 'street' },
  { id: 'seeback', a: 949, b: 1053, light: 'back' },
  { id: 'wife', a: 1054, b: 1164, light: 'back' },
  { id: 'refillA', a: 1165, b: 1229, light: 'back' },
  { id: 'refillB', a: 1230, b: 1269, light: 'back' },
  { id: 'refillC', a: 1270, b: 1299, light: 'shop' },
  { id: 'revealA', a: 1300, b: 1383, light: 'shop' },
  { id: 'revealB', a: 1384, b: 1417, light: 'shop' },
  { id: 'laugh', a: 1418, b: 1557, light: 'shop' },
  { id: 'leadin', a: 1558, b: 1598, light: 'shop' },
  { id: 'dialogue', a: 1599, b: 1707, light: 'shop' },
  { id: 'hook', a: 1708, b: 1790, light: 'dusk' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
const SPEAK = makeSpeakPlayer(SPEAK_DATA);

// ---------- lights / mood grades ----------
export const LIGHTS = {
  shop: { az: 215, el: 36, sky: '#96754e', ground: '#40301c', hemi: 1.0, sun: '#ffb45e', sunI: 1.32, fog: '#54381c', fogNear: 10, fogFar: 70,
    skyTop: '#2e2010', skyHor: '#6b4423', sunDisc: '#000000', sunSize: 0, sat: 1.07, vig: 0.24, shadowExt: 16, aurora: 0, gain: '#f7e3c0',
    waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
  street: { az: 232, el: 30, sky: '#f6dcae', ground: '#8a6f4a', hemi: 1.02, sun: '#ffd9a0', sunI: 2.4, fog: '#e8d3ac', fogNear: 40, fogFar: 300,
    skyTop: '#3a6ab0', skyHor: '#f2cd8e', sunDisc: '#fff0bc', sunSize: 0.0042, sat: 1.09, vig: 0.26, shadowExt: 22, aurora: 0, gain: '#ffedc8',
    waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
  back: { az: 205, el: 34, sky: '#6e4c2c', ground: '#2a1c10', hemi: 0.88, sun: '#ff9e4e', sunI: 1.05, fog: '#2e1c0a', fogNear: 5, fogFar: 42,
    skyTop: '#1c1208', skyHor: '#463014', sunDisc: '#000000', sunSize: 0, sat: 1.08, vig: 0.3, shadowExt: 14, aurora: 0, gain: '#f2d8ac',
    waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
  dusk: { az: 250, el: 13, sky: '#c99a72', ground: '#5c4632', hemi: 0.94, sun: '#ffab5e', sunI: 2.0, fog: '#d9b28c', fogNear: 42, fogFar: 300,
    skyTop: '#2e3c6e', skyHor: '#f0a668', sunDisc: '#ffbe78', sunSize: 0.0044, sat: 1.06, vig: 0.3, shadowExt: 22, aurora: 0, gain: '#f2ddba',
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
  if (S.id === 'hook') return blendLight(LIGHTS.street, LIGHTS.dusk, smooth(ramp(f, 1708, 1760)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging ----------
export const SIGN_POS = [0, 4.62, 6.48];
export const HOOK_POS = [0, 1.78, 10.8];
export const BOARD_POS = HOOK_POS;
// the tray lift (L12): rises on "थाली उठाकर" (f~1332), held for the
// hole reveal, set back down as the crowd laughs (L13).
export const trayAt = (f) => smooth(ramp(f, 1332, 1364)) * (1 - smooth(ramp(f, 1440, 1474)));
// the wife's hand in the hidden channel (L11): enters as she turns
// (refillA), travels up the trough, pushes the laddu through the hole
// (f~1262), retracts while the camera sits on the tray top (refillC).
export const handAt = (f) => {
  if (f < 1198) return -1;
  if (f < 1230) return smooth(ramp(f, 1198, 1230)) * 0.45;
  if (f < 1264) return 0.45 + smooth(ramp(f, 1230, 1264)) * 0.55;
  if (f < 1272) return 1;
  if (f < 1296) return 1 - smooth(ramp(f, 1272, 1296));
  return -1;
};
export const popAt = (f) => (f < 1262 ? 0 : smooth(ramp(f, 1262, 1274)));
// actor anchors (single source; r=0.30 dynamics in castAt)
export const halwaiAt = (f) => {
  const S = shotAt(f);
  if (S.id === 'leadin') return { x: 0.72, z: 0.5 };
  if (S.id === 'dialogue') return { x: 0.66, z: 0.48 };
  if (S.id === 'hook') return { x: -3.2, z: 9.5 };
  return { x: 0.85, z: 0.46 };
};
export const neighAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'tally': case 'count': return { x: 3.35, z: 3.95 };
    case 'sneak': { const u = smooth(ramp(f, 845, 890)); return { x: lerp(4.3, 1.85, u), z: lerp(-8.3, -7.32, u) }; }
    case 'peek': return { x: 1.8, z: -7.32 };
    case 'revealA': { const u = smooth(ramp(f, 1306, 1332)); return { x: lerp(2.3, 1.15, u), z: lerp(3.7, 2.62, u) }; }
    case 'revealB': return { x: 1.15, z: 2.62 };
    case 'laugh': case 'leadin': case 'dialogue': return { x: 1.55, z: 2.85 };
    case 'hook': return { x: 3.2, z: 9.5 };
    default: return { x: 3.6, z: 4.15 };
  }
};
export const wifeAt = () => ({ x: 0.55, z: -1.5 });
export const custAAt = (f) => (shotAt(f).id === 'revealA' ? { x: -0.7, z: 3.0 } : { x: -0.5, z: 2.9 });
export const custBAt = (f) => {
  const S = shotAt(f);
  if (S.id === 'gossip') return { x: 0.15, z: 3.05 };
  if (S.id === 'revealA') return { x: -1.95, z: 3.25 };
  if (S.id === 'laugh') return { x: 0.35, z: 3.35 };
  return { x: 0.75, z: 3.05 };
};
export const custCAt = () => ({ x: -1.75, z: 3.35 });

// ---------- hero / focus ----------
const FOCUS = {
  open: () => [0.25, 1.35, 1.5],
  morning: () => [0.25, 1.32, 1.5],
  crowd: () => [0.1, 1.2, 1.7],
  gossip: () => [-0.5, 1.45, 2.9],
  smug: () => [0.78, 1.48, 0.5],
  tally: () => [3.2, 0.95, 3.6],
  count: () => [3.35, 1.1, 3.9],
  sneak: () => [3.0, 1.2, -7.8],
  peek: () => [1.15, 1.5, -6.5],
  seeback: () => [0.25, 0.62, -0.1],
  wife: () => [0.62, 1.05, -1.7],
  refillA: () => [0.3, 0.6, -0.2],
  refillB: () => [0.25, 0.5, -0.1],
  refillC: () => [0.25, 1.35, 1.5],
  revealA: () => [0.6, 1.3, 1.9],
  revealB: () => [0.25, 1.25, 1.5],
  laugh: () => [0.0, 1.35, 2.9],
  leadin: () => [0.74, 1.48, 0.52],
  dialogue: () => [0.67, 1.5, 0.5],
  hook: () => [0, 1.78, 10.8],
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id]();

// ---------- cameras: reference grammar — a hard CUT per clause, every
// shot a slow push (keysCam), no static holds, no whip flights through
// walls. Sizes follow COVERAGE: inserts tight, reactions >50% width.
const RIG_BY_ID = {
  open: { cut: 'hard', raw: keysCam({ keys: [
    { f: 0, pos: [2.6, 2.05, 7.3], look: [-0.1, 1.18, 1.4], fov: 43 },
    { f: 127, pos: [2.3, 1.95, 6.8], look: [0.0, 1.2, 1.42], fov: 40, ease: 'surge' }] }) },
  morning: { cut: 'hard', raw: keysCam({ keys: [
    { f: 128, pos: [1.7, 1.62, 4.3], look: [0.3, 1.25, 1.5], fov: 36 },
    { f: 216, pos: [1.45, 1.52, 3.8], look: [0.28, 1.3, 1.5], fov: 33, ease: 'surge' }] }) },
  crowd: { cut: 'hard', raw: keysCam({ keys: [
    { f: 217, pos: [-2.9, 2.6, 7.8], look: [0.2, 1.1, 1.6], fov: 46 },
    { f: 325, pos: [-2.6, 2.45, 7.3], look: [0.25, 1.12, 1.65], fov: 43, ease: 'surge' }] }) },
  gossip: { cut: 'hard', raw: keysCam({ keys: [
    { f: 326, pos: [0.75, 1.6, 5.3], look: [-0.45, 1.4, 2.9], fov: 34 },
    { f: 453, pos: [0.6, 1.56, 5.0], look: [-0.45, 1.42, 2.9], fov: 31, ease: 'surge' }] }) },
  smug: { cut: 'hard', raw: keysCam({ keys: [
    { f: 454, pos: [1.9, 1.66, 3.4], look: [0.74, 1.42, 0.55], fov: 35 },
    { f: 578, pos: [1.65, 1.6, 3.0], look: [0.72, 1.45, 0.52], fov: 32, ease: 'surge' }] }) },
  tally: { cut: 'hard', raw: keysCam({ keys: [
    { f: 579, pos: [0.9, 1.6, 7.6], look: [3.2, 1.0, 3.6], fov: 42 },
    { f: 685, pos: [1.05, 1.55, 7.25], look: [3.2, 1.02, 3.6], fov: 39, ease: 'surge' }] }) },
  count: { cut: 'hard', raw: keysCam({ keys: [
    { f: 686, pos: [1.6, 1.55, 6.1], look: [3.35, 1.05, 3.6], fov: 40 },
    { f: 840, pos: [1.8, 1.5, 5.8], look: [3.35, 1.08, 3.6], fov: 37, ease: 'surge' }] }) },
  sneak: { cut: 'hard', raw: keysCam({ keys: [
    { f: 841, pos: [3.4, 2.2, -12.6], look: [4.3, 1.2, -8.3], fov: 40 },
    { f: 894, pos: [2.9, 2.05, -11.9], look: [1.9, 1.25, -7.35], fov: 37, ease: 'surge' }] }) },
  peek: { cut: 'hard', raw: keysCam({ keys: [
    { f: 895, pos: [0.2, 1.7, -10.6], look: [1.5, 1.45, -6.9], fov: 40 },
    { f: 948, pos: [0.35, 1.66, -10.3], look: [1.48, 1.46, -6.9], fov: 37, ease: 'surge' }] }) },
  seeback: { cut: 'hard', raw: keysCam({ keys: [
    { f: 949, pos: [2.9, 1.7, -5.6], look: [0.3, 0.8, -0.1], fov: 38 },
    { f: 1053, pos: [2.45, 1.55, -4.9], look: [0.28, 0.75, 0.0], fov: 34, ease: 'surge' }] }) },
  wife: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1054, pos: [2.15, 1.35, -4.35], look: [0.8, 0.95, -2.1], fov: 35 },
    { f: 1164, pos: [1.95, 1.3, -4.0], look: [0.78, 0.98, -2.05], fov: 32, ease: 'surge' }] }) },
  refillA: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1165, pos: [3.1, 1.45, -4.6], look: [0.3, 0.62, -0.3], fov: 36 },
    { f: 1229, pos: [2.85, 1.38, -4.25], look: [0.28, 0.6, -0.2], fov: 33, ease: 'surge' }] }) },
  refillB: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1230, pos: [1.95, 1.2, -3.15], look: [0.3, 0.52, -0.12], fov: 36 },
    { f: 1269, pos: [1.8, 1.14, -2.95], look: [0.28, 0.55, -0.05], fov: 33, ease: 'surge' }] }) },
  refillC: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1270, pos: [1.35, 2.05, 3.15], look: [0.25, 1.3, 1.5], fov: 33 },
    { f: 1299, pos: [1.2, 1.95, 2.9], look: [0.25, 1.32, 1.5], fov: 30, ease: 'surge' }] }) },
  revealA: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1300, pos: [0.2, 2.0, 7.1], look: [0.72, 1.18, 2.1], fov: 46 },
    { f: 1383, pos: [0.35, 1.95, 6.7], look: [0.75, 1.2, 2.05], fov: 43, ease: 'surge' }] }) },
  revealB: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1384, pos: [1.05, 1.75, 3.7], look: [0.25, 1.3, 1.5], fov: 36 },
    { f: 1417, pos: [0.95, 1.7, 3.5], look: [0.25, 1.28, 1.5], fov: 33, ease: 'surge' }] }) },
  laugh: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1418, pos: [-2.4, 2.0, 6.9], look: [0.2, 1.25, 2.7], fov: 42 },
    { f: 1557, pos: [-2.2, 1.92, 6.5], look: [0.22, 1.28, 2.65], fov: 39, ease: 'surge' }] }) },
  leadin: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1558, pos: [1.75, 1.62, 3.3], look: [0.72, 1.4, 0.55], fov: 34 },
    { f: 1598, pos: [1.6, 1.58, 3.0], look: [0.7, 1.42, 0.52], fov: 31, ease: 'surge' }] }) },
  dialogue: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1599, pos: [1.62, 1.58, 2.85], look: [0.67, 1.44, 0.5], fov: 32 },
    { f: 1707, pos: [1.45, 1.55, 2.5], look: [0.66, 1.46, 0.5], fov: 29, ease: 'surge' }] }) },
  hook: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1708, pos: [0, 2.1, 26.2], look: [0, 1.75, 10.8], fov: 38 },
    { f: 1790, pos: [0, 2.05, 25.4], look: [0, 1.75, 10.8], fov: 36, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: 1364, a: 0.04 }],
  sigma: 2.3, fovSigma: 1.6,
});
export const camAt = (f) => ({ ...RIG.camAt(f), flash: 0 });
export const RIG_META = {
  kicks: RIG.declared.kicks, hardCuts: RIG.declared.hardCuts,
  blends: [], whips: RIG.declared.whips, samples: RIG.samples,
};
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), hp = heroPosAt(f);
  let cinf = 2.4;
  if (['open', 'crowd', 'revealA', 'revealB', 'hook', 'sneak'].includes(S.id)) cinf = 1.4;
  if (['gossip', 'smug', 'count', 'wife', 'refillB', 'refillC', 'dialogue', 'leadin'].includes(S.id)) cinf = 3.6;
  if (['morning', 'tally', 'peek', 'seeback', 'refillA', 'laugh'].includes(S.id)) cinf = 3.0;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const ht = handAt(f);
  return {
    always: 1,
    signK: S.id === 'hook' ? 1 : 0,
    hookK: S.id === 'hook' ? smooth(ramp(f, 1708, 1720)) : 0,
    lampK: S.light === 'street' ? 0.4 : 1,
    trayK: trayAt(f),
    trayTilt: 0.1,
    handT: ht,
    handLaddu: ht >= 0 && ht < 0.985 ? 1 : 0,
    popK: popAt(f),
    slateK: S.id === 'tally' || S.id === 'count' ? 1 : 0,
    tallyK: S.id === 'tally' ? 0.55 * smooth(ramp(f, 600, 685))
      : S.id === 'count' ? 0.55 + 0.45 * smooth(ramp(f, 686, 726)) : 0,
    curtainK: 0,
  };
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  const steam = ['open', 'crowd', 'gossip', 'smug', 'revealA', 'revealB', 'laugh'].includes(S.id) ? 0.55 : 0;
  return { moteRate: S.light === 'street' ? 0.02 : 0.15, steamRate: steam, blastRate: 0, sparkRate: 0 };
};
export const fxAt = () => [];

// ---------- cast ----------
const TINT = { shop: '#ffffff', street: '#ffffff', back: '#ffffff', dusk: '#ffffff' };
const tintFor = (S) => TINT[S.light] || '#ffffff';
export const OUTFITS = {
  halwai: { jacket: '#e8b64c', pants: '#f0e6d2', boots: '#4a2c14', hat: 'turban', turban: '#f6a83c', moustache: '#2a201a', build: 'stout', skin: '#fbf7ef' },
  neighbour: { jacket: '#7a4a8c', pants: '#3a3a42', boots: '#241a12', hat: 'turban', turban: '#e8e0cc', moustache: '#2a201a', skin: '#fbf7ef' },
  wife: { jacket: '#c2456e', dress: '#c2456e', pants: '#8c2f4e', boots: '#3a2418', hat: 'hair', hair: '#241a14', skin: '#fbf7ef' },
  custA: { jacket: '#3f6a8f', pants: '#33302c', boots: '#241a12', hat: 'cap', cap: '#c23b2a', skin: '#fbf7ef' },
  custB: { jacket: '#5d8a3a', pants: '#3a3230', boots: '#241a12', hat: 'hair', hair: '#2b211c', skin: '#fbf7ef' },
  custC: { jacket: '#b8641f', pants: '#33302c', boots: '#241a12', hat: 'cap', cap: '#2a5a8c', skin: '#fbf7ef' },
};
// expression timelines (pure folder, same pattern as the reference build)
const emoTrack = (initial, events) => ({
  at(f) {
    let from = T.faceP(initial), to = from, t0 = 0, dur = 0;
    const seg = (g) => {
      if (dur <= 0 || g >= t0 + dur) return { ...to };
      if (g <= t0) return { ...from };
      const u = (g - t0) / dur, s = u * u * u * (u * (u * 6 - 15) + 10), o = {};
      for (const k in to) o[k] = from[k] + (to[k] - from[k]) * s;
      return o;
    };
    for (const [ef, name, ed] of events) {
      if (ef > f) break;
      from = seg(ef); to = T.faceP(name); t0 = ef; dur = Math.max(1, ed);
    }
    return seg(f);
  },
});
const emoHalwai = emoTrack('smile', [
  [454, 'smug', 8], [579, 'smile', 8], [1300, 'smile', 6], [1332, 'nervous', 7],
  [1418, 'relief', 9], [1470, 'smile', 8], [1558, 'smug', 8], [1708, 'grin', 8],
]);
const emoNeigh = emoTrack('thinking', [
  [686, 'determined', 7], [742, 'shock', 6], [841, 'determined', 7], [949, 'wonder', 8],
  [1300, 'determined', 7], [1364, 'proud', 8], [1418, 'laugh', 8], [1558, 'smile', 8], [1708, 'grin', 8],
]);
const emoWife = emoTrack('smile', [[1165, 'grin', 8], [1270, 'smile', 8]]);
const emoCustA = emoTrack('grin', [[326, 'wonder', 8], [454, 'smile', 8], [1300, 'shock', 6], [1418, 'laugh', 8]]);
const emoCustB = emoTrack('smile', [[326, 'wonder', 8], [1300, 'shock', 6], [1418, 'laugh', 8], [1558, 'smile', 8]]);
// body actions: the neighbour's tray-lift lean is a pose window of
// effort (squash), the wife turns toward the channel opening for the
// refill, the halwai winks as he delivers the trick's logic.
const wifeTurn = turnTrack([{ f0: 1172, dur: 14, dir: 1 }]);
const halwaiWink = winkTrack([{ a: 1652, b: 1662 }]);
const micro = (f, seed) => 1.1 * Math.sin((f + seed * 5) * 0.037 + 1);
const nodAt = (f, f0, n = 9, depth = 0.34) => (f >= f0 && f <= f0 + n ? Math.sin((f - f0) / n * Math.PI) * depth : 0);
const head = (f, seed, tilt, look, lookY, facing = 0, squash = 0) => ({
  headTilt: q(tilt + micro(f, seed), 1), look: q(look, 2), lookY: q(lookY, 2), facing: q(facing, 2), squash: q(squash, 2),
});

export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, z, extra = {}) => out.push({ id, x, y: extra.y || 0, z, r: 0.30, ground: 0,
    actor: (T) => ({ key: 'smx' + JSON.stringify(o) + JSON.stringify(opts) + (extra.y || 0),
      draw: (p) => { T.bodyFront(p, o, opts); if (extra.overlay) extra.overlay(p); },
      x, y: extra.y || 0, z, ground: 0, tint, ...extra }) });
  const h = halwaiAt(f), n = neighAt(f), w = wifeAt(f);
  const aA = custAAt(f), aB = custBAt(f), aC = custCAt();
  let HP = emoHalwai.at(f);
  const NP = emoNeigh.at(f), WP = emoWife.at(f), AP = emoCustA.at(f), BP = emoCustB.at(f);
  HP.blush = 0; NP.blush = 0; WP.blush = 0; AP.blush = 0; BP.blush = 0;
  const inShop = !['sneak', 'peek', 'seeback', 'wife', 'refillA', 'refillB'].includes(S.id);
  const inBack = ['seeback', 'wife', 'refillA', 'refillB'].includes(S.id);
  switch (S.id) {
    case 'open': {
      std('halwai', OUTFITS.halwai, { expr: 'smile', exprP: HP, mode: 'stand', breath: f, blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.6],
        ...head(f, 31, -2, 0.3, 0.25, 0.3) }, h.x, h.z, { yaw: 0.3 });
      std('custA', OUTFITS.custA, { expr: 'grin', exprP: AP, mode: 'stand', breath: f, blink: blinkAt(f, 41), seed: 41, prop: ['coin', 0.55],
        ...head(f, 41, -1.5, -0.3, 0.2, -0.3) }, aA.x, aA.z, { yaw: -0.25 });
      break;
    }
    case 'morning': {
      std('halwai', OUTFITS.halwai, { expr: 'smile', exprP: HP, mode: 'stand', breath: f, blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.4],
        ...head(f, 31, -3.5, 0.15, 0.5, 0.2) }, h.x, h.z, { yaw: 0.25 });
      break;
    }
    case 'crowd': {
      std('halwai', OUTFITS.halwai, { expr: 'smile', exprP: HP, mode: 'stand', breath: f, blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.65],
        ...head(f, 31, -2, 0.2, 0.2, 0.25) }, h.x, h.z, { yaw: 0.3 });
      std('custA', OUTFITS.custA, { expr: 'grin', exprP: AP, mode: 'stand', breath: f, blink: blinkAt(f, 41), seed: 41, prop: ['coin', 0.6],
        ...head(f, 41, -1.5, -0.3, 0.2, -0.3) }, aA.x, aA.z, { yaw: -0.25 });
      std('custB', OUTFITS.custB, { expr: 'smile', exprP: BP, mode: 'stand', breath: f, blink: blinkAt(f, 43), seed: 43,
        ...head(f, 43, -1, -0.4, 0.15, -0.4) }, aB.x, aB.z, { yaw: -0.3 });
      std('custC', OUTFITS.custC, { expr: 'smile', exprP: BP, mode: 'stand', breath: f, blink: blinkAt(f, 47), seed: 47,
        ...head(f, 47, 0, -0.2, 0.1, -0.2) }, aC.x, aC.z, { yaw: -0.2 });
      break;
    }
    case 'gossip': {
      std('custA', OUTFITS.custA, { expr: 'grin', exprP: AP, mode: 'stand', breath: f, blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, kf([[326, -1], [380, -3.5], [453, -3]], f), 0.55, -0.1, 0.5) }, aA.x, aA.z, { yaw: 0.35 });
      std('halwai', OUTFITS.halwai, { expr: 'smile', exprP: HP, mode: 'stand', breath: f, blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, -1.5, 0.4, 0.1, 0.35) }, h.x, h.z, { yaw: 0.4 });
      break;
    }
    case 'smug': {
      std('halwai', OUTFITS.halwai, { expr: 'smile', exprP: HP, mode: 'stand', breath: f, blink: blinkAt(f, 31), seed: 31, prop: ['coin', 0.6],
        ...head(f, 31, kf([[454, -2], [520, -3.5], [578, -3.5]], f), 0.1, -0.1 + nodAt(f, 528, 9, -1.4), 0.1) }, h.x, h.z, { yaw: 0.15 });
      std('custA', OUTFITS.custA, { expr: 'grin', exprP: AP, mode: 'stand', breath: f, blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -1, -0.3, 0.15, -0.3) }, aA.x, aA.z, { yaw: -0.3 });
      break;
    }
    case 'tally': {
      std('neighbour', OUTFITS.neighbour, { expr: 'neutral', exprP: NP, mode: 'stand', breath: f, blink: blinkAt(f, 61), seed: 61, prop: ['point', 0.25],
        ...head(f, 61, kf([[579, -2], [620, -5], [685, -4]], f), -0.2, 0.55, -0.2) }, n.x, n.z, { yaw: -0.35 });
      break;
    }
    case 'count': {
      std('neighbour', OUTFITS.neighbour, { expr: 'neutral', exprP: NP, mode: 'stand', breath: f, blink: blinkAt(f, 61), seed: 61,
        ...head(f, 61, kf([[686, -4], [742, -4], [748, -7.5], [770, -6], [840, -5]], f),
          kf([[686, -0.2], [748, 0.1], [840, 0.1]], f), kf([[686, 0.5], [742, 0.45], [748, -0.2], [840, -0.1]], f),
          kf([[686, -0.2], [748, 0.35], [840, 0.3]], f),
          f >= 746 && f <= 758 ? 0.1 : 0) }, n.x, n.z, { yaw: -0.3 });
      break;
    }
    case 'sneak': {
      const walking = f >= 845 && f < 890;
      std('neighbour', OUTFITS.neighbour, { expr: 'neutral', exprP: NP, mode: walking ? 'march' : 'stand', phase: q((f * 0.013) % 1, 2), breath: f, blink: blinkAt(f, 61), seed: 61,
        ...head(f, 61, walking ? 1.6 * Math.sin(f * 0.3) : -2, -0.3, 0.15, -0.3) }, n.x, n.z, { yaw: -0.3 });
      break;
    }
    case 'peek': {
      std('neighbour', OUTFITS.neighbour, { expr: 'neutral', exprP: NP, mode: 'stand', breath: f, blink: blinkAt(f, 61), seed: 61,
        ...head(f, 61, -3.5, 0.15, 0.3, 0.15) }, n.x, n.z, { yaw: 0.1 });
      break;
    }
    case 'seeback': {
      std('wife', OUTFITS.wife, { expr: 'smile', exprP: WP, mode: 'sit', breath: f, blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, -3, 0.2, 0.45, 0.2) }, w.x, w.z, { yaw: -0.25 });
      break;
    }
    case 'wife': {
      std('wife', OUTFITS.wife, { expr: 'smile', exprP: WP, mode: 'sit', breath: f, blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, -3.5 + 1.4 * Math.sin(f * 0.22), 0.15, 0.5, 0.15) }, w.x, w.z, { yaw: -0.2 });
      break;
    }
    case 'refillA': {
      const Tn = wifeTurn(f);
      std('wife', OUTFITS.wife, { expr: 'smile', exprP: WP, mode: 'sit', squash: Tn.squash, breath: f, blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, kf([[1165, -3.5], [1190, -2], [1229, -2]], f), kf([[1165, 0.15], [1198, 0.5], [1229, 0.5]], f), kf([[1165, 0.5], [1198, 0.3], [1229, 0.3]], f), 0.15) },
        w.x, w.z, { yaw: -0.2 + Tn.yaw, y: Tn.hop });
      break;
    }
    case 'refillB': {
      std('wife', OUTFITS.wife, { expr: 'smile', exprP: WP, mode: 'sit', breath: f, blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, -2, 0.5, 0.3, 0.2) }, w.x, w.z, { yaw: 0.55 });
      break;
    }
    case 'refillC': {
      std('halwai', OUTFITS.halwai, { expr: 'smile', exprP: HP, mode: 'stand', breath: f, blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, -2, 0.2, 0.2, 0.25) }, h.x, h.z, { yaw: 0.3 });
      break;
    }
    case 'revealA': {
      const lifting = f >= 1332 && f <= 1417;
      std('neighbour', OUTFITS.neighbour, { expr: 'neutral', exprP: NP, mode: 'stand', breath: f, blink: blinkAt(f, 61), seed: 61, prop: lifting ? ['point', 0.92] : null,
        ...head(f, 61, kf([[1300, -1], [1332, -2], [1364, -4], [1417, -3.5]], f), 0.1,
          kf([[1300, 0.1], [1364, 0.5], [1417, 0.45]], f), 0.1, lifting && f < 1370 ? 0.05 : 0) }, n.x, n.z, { yaw: -0.15 });
      std('halwai', OUTFITS.halwai, { expr: 'smile', exprP: HP, mode: 'stand', breath: f, blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, kf([[1300, -1.5], [1332, -2.5], [1364, -3], [1417, -2]], f), -0.4, 0.1, -0.4) }, h.x, h.z, { yaw: -0.35 });
      std('custA', OUTFITS.custA, { expr: 'grin', exprP: AP, mode: 'stand', breath: f, blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, kf([[1300, -1], [1364, -4], [1417, -3]], f), -0.2, -0.1, -0.2) }, aA.x, aA.z, { yaw: -0.2 });
      std('custB', OUTFITS.custB, { expr: 'smile', exprP: BP, mode: 'stand', breath: f, blink: blinkAt(f, 43), seed: 43,
        ...head(f, 43, -1.5, -0.3, 0, -0.3) }, aB.x, aB.z, { yaw: -0.25 });
      break;
    }
    case 'revealB': {
      // the hole insert: the neighbour holds the tray up, the halwai
      // stares at the dark hole in the counter top.
      std('neighbour', OUTFITS.neighbour, { expr: 'neutral', exprP: NP, mode: 'stand', breath: f, blink: blinkAt(f, 61), seed: 61, prop: ['point', 0.92],
        ...head(f, 61, kf([[1384, -4], [1417, -3.5]], f), 0.1, kf([[1384, 0.5], [1417, 0.45]], f), 0.1, 0) }, n.x, n.z, { yaw: -0.15 });
      std('halwai', OUTFITS.halwai, { expr: 'smile', exprP: HP, mode: 'stand', breath: f, blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, kf([[1384, -3], [1417, -2]], f), -0.4, 0.1, -0.4) }, h.x, h.z, { yaw: -0.35 });
      break;
    }
    case 'laugh': {
      std('custA', OUTFITS.custA, { expr: 'grin', exprP: AP, mode: 'stand', breath: f, blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -3 + 2.4 * Math.sin(f * 0.33), -0.2, -0.15, -0.2, 0.03 + 0.03 * Math.sin(f * 0.33)) }, aA.x, aA.z, { yaw: -0.2, y: Math.abs(Math.sin(f * 0.3)) * 0.05 });
      std('custB', OUTFITS.custB, { expr: 'smile', exprP: BP, mode: 'stand', breath: f, blink: blinkAt(f, 43), seed: 43,
        ...head(f, 43, -2.6 + 2.2 * Math.sin(f * 0.33 + 1.2), -0.35, -0.1, -0.35, 0.03 + 0.03 * Math.sin(f * 0.33 + 1.2)) }, aB.x, aB.z, { yaw: -0.3, y: Math.abs(Math.sin(f * 0.3 + 0.5)) * 0.05 });
      std('custC', OUTFITS.custC, { expr: 'smile', exprP: BP, mode: 'stand', breath: f, blink: blinkAt(f, 47), seed: 47,
        ...head(f, 47, -2 + 2 * Math.sin(f * 0.3 + 2.1), -0.25, -0.05, -0.25) }, aC.x, aC.z, { yaw: -0.25 });
      std('halwai', OUTFITS.halwai, { expr: 'smile', exprP: HP, mode: 'stand', breath: f, blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, -2.5, 0.35, 0.05, 0.3) }, h.x, h.z, { yaw: 0.3 });
      std('neighbour', OUTFITS.neighbour, { expr: 'neutral', exprP: NP, mode: 'stand', breath: f, blink: blinkAt(f, 61), seed: 61,
        ...head(f, 61, -2.5 + 1.8 * Math.sin(f * 0.33 + 0.6), 0.2, -0.1, 0.2) }, n.x, n.z, { yaw: 0.2 });
      break;
    }
    case 'leadin': {
      std('halwai', OUTFITS.halwai, { expr: 'smile', exprP: HP, mode: 'stand', breath: f, blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, -3, 0.1, -0.05, 0.1) }, h.x, h.z, { yaw: 0.12 });
      std('neighbour', OUTFITS.neighbour, { expr: 'neutral', exprP: NP, mode: 'stand', breath: f, blink: blinkAt(f, 61), seed: 61,
        ...head(f, 61, -1.5, -0.4, 0.05, -0.4) }, n.x, n.z, { yaw: -0.4 });
      break;
    }
    case 'dialogue': {
      // THE performed line: the halwai speaks it himself — mouth driven
      // by the stem via SPEAK (open/mw/brow/nod), everyone else silent.
      const sp = SPEAK.at(f);
      let DP = applySpeak(HP, sp);
      const winkK = halwaiWink(f);
      if (winkK > 0) DP = T.blendFaceP(DP, T.faceP('wink', 31), winkK * (sp.active ? 0.5 : 1));
      std('halwai', OUTFITS.halwai, { expr: 'smile', exprP: DP, mode: 'stand', breath: f, blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, -2.5 + q(sp.nod * 40, 1), 0.05, -0.02, 0.05) }, h.x, h.z, { yaw: 0.08 });
      break;
    }
    case 'hook': {
      // the board alone closes the video (question over the empty plaza,
      // the shop glowing behind it) — no cast in frame.
      break;
    }
    default: {
      if (inShop) std('halwai', OUTFITS.halwai, { expr: 'smile', exprP: HP, mode: 'stand', breath: f, blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, -2, 0.2, 0.2, 0.25) }, h.x, h.z, { yaw: 0.3 });
      if (inBack) std('wife', OUTFITS.wife, { expr: 'smile', exprP: WP, mode: 'sit', breath: f, blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, -3, 0.2, 0.45, 0.2) }, w.x, w.z, { yaw: -0.25 });
    }
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity ----------
export const STATICS = [
  SOL.aabb(-2.5, 2.5, 0.8, 2.2, { h: 1.1, id: 'counter' }),
  SOL.aabb(-4.6, -3.3, -0.22, 0.02, { h: 3.4, id: 'partL' }),
  SOL.aabb(-2.3, 0.02, -0.22, 0.02, { h: 3.4, id: 'partM' }),
  SOL.aabb(0.48, 4.6, -0.22, 0.02, { h: 3.4, id: 'partR' }),
  SOL.aabb(0.02, 0.48, -0.22, 0.02, { h: 0.17, id: 'partSill' }),
  SOL.aabb(-4.8, -4.5, -6.6, 6.3, { h: 3.9, id: 'wallL' }),
  SOL.aabb(4.5, 4.8, -6.6, 6.3, { h: 3.9, id: 'wallR' }),
  SOL.aabb(-4.8, 4.8, -6.85, -6.45, { h: 3.9, id: 'backwall' }),
  SOL.circle(-3.3, 6.2, 0.27, { h: 4.8, id: 'pillarL' }),
  SOL.circle(3.3, 6.2, 0.27, { h: 4.8, id: 'pillarR' }),
  SOL.circle(-3.55, 3.6, 0.55, { h: 0.9, id: 'kadhai' }),
  SOL.circle(1.05, -2.5, 0.62, { h: 0.5, id: 'wifetable' }),
  SOL.circle(0.15, -3.3, 0.37, { h: 0.35, id: 'basket' }),
  SOL.circle(3.05, 3.3, 0.3, { h: 0.7, id: 'slate' }),
  SOL.aabb(-2.55, 2.55, 10.55, 11.05, { h: 2.9, id: 'hookboard' }),
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
