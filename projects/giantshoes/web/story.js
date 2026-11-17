// Shot plan for "The Giant's Shoes" — giantshoes (LIBRARY v4: speak.js
// dialogue performance + materials v4, camrig smooth tracking + solid
// colliders). Batch 8 English topic 3. ONE set: a village square by a
// river. Giant footprints appear overnight; the old shoemaker stitches
// giant shoes WITH BELLS and leaves them at the riverbank; at midnight
// the bells ring — and the "giant" is the miller's son on stilts.
// Voice stem: 60.611 s, 30 fps, TOTAL 1818; timings from faster-whisper
// word alignment (words.json). Scene changes ONLY at clause boundaries:
//   S1  0.00-4.02  One morning...river.        S8  32.18-34.96  "A giant I..."
//   S2  4.44-9.04  By nightfall...return.     S9  35.50-39.90  That evening...
//   S3  9.74-13.58 Only the old...leather.    S10 40.54-44.32  At midnight...
//   S4  14.10-17.30 For three days...seen.    S11 44.98-50.16  Doors flew open...
//   S5  17.76-21.30 The village laughed...    S12 50.70-55.26  His stilt-feet...
//   S6  21.74-26.26 Then he sewed...bells.    S13 55.76-60.32  But tomorrow...
//   S7  26.78-31.64 The mayor demanded...
// GRADE (FILTER_VFX_LIGHTING pack): Sunny Pop throughout; the night beats
// (watch, midnight, payoff, soles) are a night light — grade changes ONLY
// on clause boundaries. Signature VFX: brass-bell glints, footprint trail,
// chimney smoke, river shimmer, lamp glow at night.
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

export const FPS = 30, TOTAL = 1818, DECK = 0;
export const SHOTS = [
  { id: 'drone', a: 0, b: 132, light: 'sun' },
  { id: 'watch', a: 133, b: 291, light: 'night' },
  { id: 'measure', a: 292, b: 422, light: 'sun' },
  { id: 'stitch', a: 423, b: 531, light: 'sun' },
  { id: 'laugh', a: 532, b: 651, light: 'sun' },
  { id: 'bells', a: 652, b: 802, light: 'sun' },
  { id: 'mayor', a: 803, b: 964, light: 'sun' },
  { id: 'dialogue', a: 965, b: 1064, light: 'sun' },
  { id: 'riverbank', a: 1065, b: 1215, light: 'dusk' },
  { id: 'midnight', a: 1216, b: 1348, light: 'night' },
  { id: 'payoff', a: 1349, b: 1520, light: 'night' },
  { id: 'soles', a: 1521, b: 1671, light: 'night' },
  { id: 'hookq', a: 1672, b: 1755, light: 'dusk' },
  { id: 'hook', a: 1756, b: 1817, light: 'dusk' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights / mood grades ----------
export const LIGHTS = {
  sun: { az: 232, el: 27, sky: '#f0cf9e', ground: '#8a6f4a', hemi: 1.02, sun: '#ffd9a0', sunI: 2.45, fog: '#e8d3ac', fogNear: 46, fogFar: 330,
    skyTop: '#3a6ab0', skyHor: '#f2cd8e', sunDisc: '#fff0bc', sunSize: 0.0042, sat: 1.09, vig: 0.26, shadowExt: 22, aurora: 0, gain: '#ffedc8',
    waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
  night: { az: 250, el: 32, sky: '#4a5a7a', ground: '#2c2a3a', hemi: 0.62, sun: '#8aa4cc', sunI: 0.55, fog: '#3a4460', fogNear: 30, fogFar: 240,
    skyTop: '#0c1428', skyHor: '#2a3a5c', sunDisc: '#e8ecf4', sunSize: 0.0032, sat: 0.85, vig: 0.34, shadowExt: 22, aurora: 0, gain: '#c8d2e8',
    waterDeep: '#0a1e2e', waterShal: '#14344a', glint: '#a8c8e8' },
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
  if (S.id === 'watch') return blendLight(LIGHTS.sun, LIGHTS.night, smooth(ramp(f, 133, 178)));
  if (S.id === 'measure') return blendLight(LIGHTS.night, LIGHTS.sun, smooth(ramp(f, 292, 337)));
  if (S.id === 'riverbank') return blendLight(LIGHTS.sun, LIGHTS.dusk, smooth(ramp(f, 1065, 1130)));
  if (S.id === 'midnight') return blendLight(LIGHTS.dusk, LIGHTS.night, smooth(ramp(f, 1216, 1260)));
  if (S.id === 'hookq') return blendLight(LIGHTS.night, LIGHTS.dusk, smooth(ramp(f, 1672, 1727)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging (shared by story, main, colliders) ----------
export const BOARD_POS = [0, 3.1, -6];
export const STALL = { x: -8, z: 4.5, ry: 0.35 };
export const TABLE = { x: -7.6, z: 4.6 };
export const BANK = { x: -6, z: 10.3 };
export const PRINTS = [[-6, 10.3], [-4, 8], [-2, 5.5], [0, 4], [2, 2.5]];
export const HOUSES = [
  { x: -12, z: -8, ry: 0.3, w: 5, d: 4.5 },
  { x: 12, z: -8, ry: -0.3, w: 5, d: 4.5 },
  { x: -13, z: 6, ry: 1.2, w: 4.5, d: 4 },
  { x: 13, z: 6, ry: -1.2, w: 4.5, d: 4 },
];

const walkKeys = (keys, f) => {
  let x = keys[0][1], z = keys[0][2];
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i][0]) { const a = keys[i - 1], b = keys[i]; const u = smooth(ramp(f, a[0], b[0])); return [lerp(a[1], b[1], u), lerp(a[2], b[2], u)]; }
    x = keys[keys.length - 1][1]; z = keys[keys.length - 1][2];
  }
  return [x, z];
};
// shoemaker: stall -> measures the biggest print -> back to stall ->
// carries the shoes to the riverbank -> returns home
const SHOE_KEYS = [
  [0, -6.0, 5.0], [292, -6.0, 5.0], [330, -1.4, 4.6], [422, -1.4, 4.6],
  [460, -6.0, 5.0], [1065, -6.0, 5.0], [1100, -5.6, 8.6], [1197, -5.6, 8.6],
  [1230, -6.0, 5.0], [1817, -6.0, 5.0],
];
const MAYOR_KEYS = [
  [0, 3.6, 5.4], [803, 3.6, 5.4], [850, 1.2, 5.0], [964, 1.2, 5.0],
  [1065, 3.6, 5.4], [1817, 3.6, 5.4],
];
export const shoeAt = (f) => { const [x, z] = walkKeys(SHOE_KEYS, f); return { x, z }; };
export const mayorAt = (f) => { const [x, z] = walkKeys(MAYOR_KEYS, f); return { x, z }; };
const strolling = (f, spans) => spans.some(([a, b]) => f >= a && f <= b) ? 1 : 0;
export const shoeMode = (f) => strolling(f, [[292, 330], [422, 460], [1065, 1100], [1197, 1230]]) ? 'stroll' : 'stand';
// THE GIANT SHOES (hero prop): on the stall table -> carried to the
// riverbank -> set down -> at midnight they RISE onto the stilts and
// walk the bank (the son steps in off-camera at the hard cut).
export const shoesAt = (f) => {
  if (f < 1065) return { x: TABLE.x, y: 0.78, z: TABLE.z, carried: 0, resting: 1, walk: 0, scale: f < 423 ? 0.55 : 0.55 + 0.45 * smooth(ramp(f, 423, 531)) };
  if (f <= 1100) {
    const u = smooth(ramp(f, 1065, 1100));
    return { x: lerp(TABLE.x, -5.6, u), y: lerp(0.78, 0.9, u) + Math.sin(u * Math.PI) * 0.12, z: lerp(TABLE.z, 8.6, u), carried: 1, resting: 0, walk: 0, scale: 1 };
  }
  if (f <= 1130) {
    const u = smooth(ramp(f, 1100, 1130));
    return { x: lerp(-5.6, BANK.x, u), y: lerp(0.9, 0, u), z: lerp(8.6, BANK.z, u), carried: 1, resting: 0, walk: 0, scale: 1 };
  }
  if (f < 1216) return { x: BANK.x, y: 0, z: BANK.z, carried: 0, resting: 1, walk: 0, scale: 1 };
  if (f <= 1240) { // the shoes lift onto the stilts as the bells begin
    const u = smooth(ramp(f, 1216, 1240));
    return { x: BANK.x, y: u * 0.95, z: BANK.z, carried: 0, resting: 0, walk: 0, scale: 1 };
  }
  // midnight walk: two slow steps along the bank, bells swinging
  const step = f < 1280 ? smooth(ramp(f, 1240, 1280)) : 1 + smooth(ramp(f, 1290, 1330));
  const bob = Math.abs(Math.sin((f - 1240) * Math.PI / 40)) * 0.1;
  return { x: lerp(BANK.x, -4.2, Math.min(step / 2, 1)), y: 0.95 + bob, z: lerp(BANK.z, 9.8, Math.min(step / 2, 1)), carried: 0, resting: 0, walk: 1, scale: 1 };
};
// the miller's son: hidden until the payoff — he rides the stilts above
// the shoes from f1349 on.
export const sonAt = (f) => {
  if (f < 1349) return null;
  const s = shoesAt(f);
  return { x: s.x, y: 0.9, z: s.z };
};
// bells: sewn on one by one during the bells shot; swinging at midnight
export const bellsK = (f) => f < 652 ? 0 : f <= 787 ? smooth(ramp(f, 652, 787)) : 1;
export const bellSwing = (f) => {
  if (f >= 1216 && f <= 1348) return Math.sin((f - 1216) * 0.5) * 0.5;
  if (f >= 1349) return Math.sin(f * 0.12) * 0.12;
  return 0;
};
const segMax = (f, segs) => {
  let s = 0;
  for (const [a, b, c, d, peak] of segs) if (f >= a && f <= d) s = Math.max(s, peak * (f < b ? smooth(ramp(f, a, b)) : f <= c ? 1 : 1 - smooth(ramp(f, c, d))));
  return s;
};
export const glintAt = (f) => {
  let s = 0;
  const pulse = (a, b, peak) => { if (f >= a && f <= b) s = Math.max(s, peak * Math.sin(ramp(f, a, b) * Math.PI)); };
  pulse(652, 787, 0.8); pulse(1216, 1348, 1); pulse(1349, 1520, 0.9); pulse(1521, 1671, 0.7);
  return s;
};
export const lampK = (f) => {
  const S = shotAt(f);
  if (S.light === 'night') return 1;
  if (S.id === 'riverbank') return smooth(ramp(f, 1130, 1215));
  return 0;
};

// ---------- hero / focus ----------
const FOCUS = {
  drone: () => [0, 1.0, 4],
  watch: () => [0, 1.2, 6],
  measure: () => [0, 0.6, 4],
  stitch: () => [TABLE.x, 0.9, TABLE.z],
  laugh: () => [2, 1.2, 3],
  bells: () => [TABLE.x, 0.9, TABLE.z],
  mayor: () => { const m = mayorAt(880); return [m.x, 1.3, m.z]; },
  dialogue: () => { const s = shoeAt(1010); return [s.x, 1.45, s.z]; },
  riverbank: () => [BANK.x, 0.8, BANK.z],
  midnight: () => [-5, 0.9, 10],
  payoff: () => { const s = sonAt(1420) || { x: -4.2, z: 9.8 }; return [s.x, 1.6, s.z]; },
  soles: () => [-4.2, 0.3, 9.8],
  hookq: () => BOARD_POS, hook: () => BOARD_POS,
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id]();

// ---------- cameras: EVERY shot is a camrig track on a subject ----------
const shoePos = (f) => { const s = shoeAt(f); return [s.x, 0, s.z]; };
const bezierCam = (P, L, a, b, fov0, fov1) => (f) => {
  const u = M.smooth(ramp(f, a, b));
  const w0 = (1 - u) ** 3, w1 = 3 * (1 - u) ** 2 * u, w2 = 3 * (1 - u) * u * u, w3 = u ** 3;
  const mix = (Q) => [0, 1, 2].map((j) => w0 * Q[0][j] + w1 * Q[1][j] + w2 * Q[2][j] + w3 * Q[3][j]);
  return { pos: mix(P), look: mix(L), fov: lerp(fov0, fov1, u), roll: 0 };
};
const RIG_BY_ID = {
  drone: { cut: 'hard', raw: bezierCam(
    [[20, 12, 26], [12, 7, 19], [8, 4.5, 15], [6.5, 3.0, 12.5]],
    [[0, 2.5, -6], [0, 1.5, 2], [0, 0.8, 4], [-1, 0.6, 6]], 0, 132, 44, 40) },
  watch: { cut: 'hard', raw: keysCam({ keys: [
    { f: 133, pos: [7.5, 3.2, 13.5], look: [0, 1.1, 5.5], fov: 42 },
    { f: 291, pos: [7.0, 3.0, 12.8], look: [0, 1.1, 5.5], fov: 40, ease: 'surge' }] }) },
  measure: { cut: 'hard', raw: pushInCam({ subject: () => [0, 0, 4], a: 292, b: 422, d0: 5.6, d1: 4.2, h0: 1.7, h1: 1.5, lookOff: [0, 0.5, 0], fov0: 40, fov1: 34,
    dir: () => [0.55, 0.8] }) },
  stitch: { cut: 'hard', raw: pushInCam({ subject: () => [TABLE.x, 0.9, TABLE.z], a: 423, b: 531, d0: 5.0, d1: 4.0, h0: 1.6, h1: 1.4, lookOff: [0, 0.4, 0], fov0: 38, fov1: 33,
    dir: () => [0.6, 0.75] }) },
  laugh: { cut: 'hard', raw: keysCam({ keys: [
    { f: 532, pos: [7.8, 3.0, 12.0], look: [2, 1.2, 3], fov: 42 },
    { f: 651, pos: [7.3, 2.8, 11.4], look: [2, 1.2, 3], fov: 40, ease: 'surge' }] }) },
  bells: { cut: 'hard', raw: pushInCam({ subject: () => [TABLE.x, 0.9, TABLE.z], a: 652, b: 802, d0: 4.6, d1: 3.6, h0: 1.55, h1: 1.4, lookOff: [0, 0.4, 0], fov0: 36, fov1: 31,
    dir: () => [0.6, 0.75] }) },
  mayor: { cut: 'hard', raw: pushInCam({ subject: () => { const m = mayorAt(880); return [m.x, 0, m.z]; }, a: 803, b: 964, d0: 5.2, d1: 4.2, h0: 1.6, h1: 1.45, lookOff: [0, 1.35, 0], fov0: 38, fov1: 33,
    dir: () => [0.5, 0.8] }) },
  dialogue: { cut: 'hard', raw: pushInCam({ subject: shoePos, a: 965, b: 1064, d0: 3.4, d1: 2.75, h0: 1.58, h1: 1.5, lookOff: [0, 1.45, 0], fov0: 32, fov1: 28,
    dir: () => [0.45, 0.85] }) },
  riverbank: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1065, pos: [3.5, 3.0, 16.5], look: [BANK.x, 0.9, BANK.z], fov: 42 },
    { f: 1215, pos: [2.8, 2.6, 15.2], look: [BANK.x, 0.9, BANK.z], fov: 38, ease: 'surge' }] }) },
  midnight: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1216, pos: [-1.2, 1.6, 15.8], look: [-5, 0.9, 10], fov: 40 },
    { f: 1348, pos: [-1.6, 1.5, 15.0], look: [-4.6, 0.9, 10], fov: 37, ease: 'surge' }] }) },
  payoff: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1349, pos: [1.5, 2.2, 15.5], look: [-4.2, 1.5, 9.8], fov: 40 },
    { f: 1520, pos: [1.0, 2.0, 14.6], look: [-4.2, 1.5, 9.8], fov: 36, ease: 'surge' }] }) },
  soles: { cut: 'hard', raw: pushInCam({ subject: () => [-4.2, 0, 9.8], a: 1521, b: 1671, d0: 4.6, d1: 3.4, h0: 1.1, h1: 0.8, lookOff: [0, 0.25, 0], fov0: 38, fov1: 32,
    dir: () => [0.55, 0.8] }) },
  hookq: { cut: 'blend', blend: 10, raw: keysCam({ keys: [
    { f: 1672, pos: [5.4, 3.9, 7.6], look: [0.1, 2.75, -5.9], fov: 40 },
    { f: 1755, pos: [5.2, 3.9, 7.4], look: [0.05, 2.78, -5.95], fov: 37, ease: 'surge' }] }) },
  hook: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1756, pos: [5.2, 3.9, 7.4], look: [0.05, 2.78, -5.95], fov: 37 },
    { f: 1817, pos: [5.0, 3.95, 7.2], look: [0.02, 2.8, -5.97], fov: 36, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: 1100, a: 0.03 }, { f: 1240, a: 0.03 }, { f: 1349, a: 0.03 }],
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
  if (['dialogue', 'payoff', 'soles', 'bells'].includes(S.id)) cinf = 3.6;
  if (S.id === 'hook') cinf = 3.0;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f), sh = shoesAt(f), sn = sonAt(f);
  const W = {
    boardTitle: 0, boardHook: 0,
    shoeX: sh.x, shoeY: sh.y, shoeZ: sh.z, shoeCarried: sh.carried, shoeScale: sh.scale, shoeWalk: sh.walk,
    bellsK: bellsK(f), bellSwing: bellSwing(f), bellGlint: glintAt(f),
    lampK: lampK(f),
    sonK: sn ? 1 : 0, sonX: sn ? sn.x : 0, sonY: sn ? sn.y : 0, sonZ: sn ? sn.z : 0,
    dustK: 0.05,
  };
  if (S.id === 'drone') W.boardTitle = smooth(ramp(f, 2, 14)) * (1 - smooth(ramp(f, 44, 56)));
  if (S.id === 'hookq') W.boardHook = smooth(ramp(f, 1716, 1740));
  if (S.id === 'hook') W.boardHook = 1;   // held at FULL opacity to the literal last frame
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return { smokeRate: 0.05, dustRate: 0.05, splashRate: 0, steamRate: 0, shimmerRate: 0, grey: S.light === 'night' ? 1 : 0 };
};
export const fxAt = () => [];

// ---------- cast (single source for actors AND colliders) ----------
const TINT = { sun: '#ffffff', night: '#c3ccd4', dusk: '#f2ddc4' };
const tintFor = (S) => TINT[S.light] || '#ffffff';
export const OUTFITS = {
  shoemaker: { jacket: '#6a4a2e', pants: '#4a3826', boots: '#2c1c10', hat: 'hair', hair: '#e8e8e8', skin: '#c98a5a', moustache: '#e8e8e8' },
  mayor: { jacket: '#8a2432', pants: '#3a2a4a', boots: '#241a12', hat: 'cap', cap: '#c8a03a', skin: '#c98a5a' },
  son: { jacket: '#2c6a3a', pants: '#3a3226', boots: '#4a2e18', hat: 'cap', cap: '#c8a03a', skin: '#d8a06a' },
  villager1: { jacket: '#2c4a6e', pants: '#2a3242', boots: '#1c1712', hat: 'cap', cap: '#7a5a2e', skin: '#c98a5a' },
  villager2: { jacket: '#4a6a3a', pants: '#33302c', boots: '#241a12', hat: 'hair', hair: '#1c1410', skin: '#8a5a34', moustache: '#241a12' },
  villager3: { jacket: '#9a5a3a', pants: '#6a4a3a', boots: '#3a2a1c', hat: 'hair', hair: '#2c1a10', skin: '#a06a3c' },
  watchman: { jacket: '#5a2a3a', pants: '#2c2226', boots: '#1c1712', hat: 'shako', skin: '#a06a3c' },
};
export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, z, extra = {}) => out.push({ id, x, y: 0, z, r: 0.32, ground: 0,
    actor: (T) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x, y: 0, z, ground: 0, tint, ...extra }) });
  const s = shoeAt(f), m = mayorAt(f), sn = sonAt(f);
  const sBase = { expr: 'smile', mode: 'stand', blink: blinkAt(f, 31), seed: 31 };
  switch (S.id) {
    case 'drone': {
      std('shoemaker', OUTFITS.shoemaker, { ...sBase }, s.x, s.z, { yaw: 0.5 });
      std('mayor', OUTFITS.mayor, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, m.x, m.z, { yaw: -0.5 });
      std('villager1', OUTFITS.villager1, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, 5.2, 2.0, { yaw: -0.3 });
      std('villager2', OUTFITS.villager2, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 52), seed: 52 }, -3.2, 7.2, { yaw: 0.4 });
      break;
    }
    case 'watch': {
      // night watch: three men with pitchforks (props drawn in main.js),
      // the shoemaker calm at his stall doorway.
      std('watch1', OUTFITS.watchman, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 61), seed: 61 }, -2.0, 6.5, { yaw: 0.2 });
      std('watch2', OUTFITS.watchman, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 62), seed: 62 }, 2.0, 6.5, { yaw: -0.2 });
      std('watch3', OUTFITS.watchman, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 63), seed: 63 }, 5.0, 4.0, { yaw: -0.6 });
      std('shoemaker', OUTFITS.shoemaker, { ...sBase, expr: 'neutral' }, s.x, s.z, { yaw: 0.4 });
      break;
    }
    case 'measure': {
      std('shoemaker', OUTFITS.shoemaker, { ...sBase, mode: shoeMode(f), phase: q((f * 0.011) % 1, 2), headTilt: 0.18, prop: ['point', 0.7] }, s.x, s.z, { yaw: 0.55 });
      std('mayor', OUTFITS.mayor, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, m.x, m.z, { yaw: -0.55 });
      std('villager1', OUTFITS.villager1, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, 5.2, 2.0, { yaw: -0.3 });
      break;
    }
    case 'stitch': {
      std('shoemaker', OUTFITS.shoemaker, { ...sBase, prop: ['point', 0.6] }, s.x, s.z, { yaw: 0.5 });
      std('villager2', OUTFITS.villager2, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 52), seed: 52 }, -3.2, 7.2, { yaw: 0.4 });
      break;
    }
    case 'laugh': {
      std('shoemaker', OUTFITS.shoemaker, { ...sBase, expr: 'neutral' }, s.x, s.z, { yaw: 0.5 });
      std('villager1', OUTFITS.villager1, { expr: 'laugh', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, 5.2, 2.0, { yaw: -0.3 });
      std('villager2', OUTFITS.villager2, { expr: 'laugh', mode: 'stand', blink: blinkAt(f, 52), seed: 52 }, -3.2, 7.2, { yaw: 0.4 });
      std('villager3', OUTFITS.villager3, { expr: 'laugh', mode: 'stand', blink: blinkAt(f, 53), seed: 53 }, 6.0, 8.0, { yaw: -0.5 });
      std('mayor', OUTFITS.mayor, { expr: 'laugh', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, m.x, m.z, { yaw: -0.5 });
      break;
    }
    case 'bells': {
      std('shoemaker', OUTFITS.shoemaker, { ...sBase, prop: ['point', 0.6] }, s.x, s.z, { yaw: 0.5 });
      std('villager1', OUTFITS.villager1, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, 5.2, 2.0, { yaw: -0.3 });
      break;
    }
    case 'mayor': {
      std('mayor', OUTFITS.mayor, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, m.x, m.z, { yaw: -0.5 });
      std('shoemaker', OUTFITS.shoemaker, { ...sBase, expr: 'smile' }, s.x, s.z, { yaw: 0.5 });
      break;
    }
    case 'dialogue': {
      // THE dialogue beat: the shoemaker PERFORMS his line — mouth driven
      // by the stem inside the speak segment, closed outside it; the mayor
      // only listens (his mouth never opens: narration stays voice-over).
      std('shoemaker', OUTFITS.shoemaker, { mode: 'stand', blink: blinkAt(f, 31), seed: 31, look: 0.15, ...speakFace('smile', f) }, s.x, s.z, { yaw: 0.5 });
      std('mayor', OUTFITS.mayor, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, m.x, m.z, { yaw: -0.5 });
      break;
    }
    case 'riverbank': {
      std('shoemaker', OUTFITS.shoemaker, { ...sBase, mode: shoeMode(f), phase: q((f * 0.011) % 1, 2) }, s.x, s.z, { yaw: 0.55 });
      std('mayor', OUTFITS.mayor, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, m.x, m.z, { yaw: -0.55 });
      std('villager1', OUTFITS.villager1, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, 5.2, 2.0, { yaw: -0.3 });
      break;
    }
    case 'midnight': {
      // the shoes walk alone in the dark; one villager silhouette at a door
      std('villager2', OUTFITS.villager2, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 52), seed: 52 }, -3.2, 7.2, { yaw: 0.4 });
      break;
    }
    case 'payoff': {
      // the reveal: the miller's son high on stilts inside the giant shoes,
      // laughing too hard to run. His card rides at stilt height (y=0.9);
      // the stilt poles + carved soles are 3D props in main.js.
      out.push({ id: 'son', x: sn.x, y: 0.9, z: sn.z, r: 0.32, ground: 0,
        actor: (T) => ({ key: 'pax' + JSON.stringify(OUTFITS.son) + JSON.stringify({ expr: 'laugh', mode: 'stand', blink: blinkAt(f, 71), seed: 71 }),
          draw: (p) => T.bodyFront(p, OUTFITS.son, { expr: 'laugh', mode: 'stand', blink: blinkAt(f, 71), seed: 71 }), x: sn.x, y: 0.9, z: sn.z, ground: 0, tint, yaw: 0.3 }) });
      std('shoemaker', OUTFITS.shoemaker, { ...sBase, expr: 'smile' }, s.x, s.z, { yaw: 0.5 });
      std('mayor', OUTFITS.mayor, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, m.x, m.z, { yaw: -0.5 });
      std('villager1', OUTFITS.villager1, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, 5.2, 2.0, { yaw: -0.3 });
      break;
    }
    case 'soles': {
      out.push({ id: 'son', x: sn.x, y: 0.9, z: sn.z, r: 0.32, ground: 0,
        actor: (T) => ({ key: 'pax' + JSON.stringify(OUTFITS.son) + JSON.stringify({ expr: 'smile', mode: 'stand', blink: blinkAt(f, 71), seed: 71 }),
          draw: (p) => T.bodyFront(p, OUTFITS.son, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 71), seed: 71 }), x: sn.x, y: 0.9, z: sn.z, ground: 0, tint, yaw: 0.3 }) });
      std('shoemaker', OUTFITS.shoemaker, { ...sBase, prop: ['point', 0.7] }, s.x, s.z, { yaw: 0.55 });
      std('mayor', OUTFITS.mayor, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, m.x, m.z, { yaw: -0.5 });
      break;
    }
    case 'hookq': case 'hook': break;
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity: statics, dynamics, ground (LIBRARY v3 gate data) ----------
export const STATICS = [
  SOL.aabb(-18, 18, -15.5, -13.8, { h: 5, id: 'facade' }),
  SOL.aabb(-17.5, -16, -14, 12, { h: 2.6, id: 'wallW' }),
  SOL.aabb(16, 17.5, -14, 12, { h: 2.6, id: 'wallE' }),
  ...HOUSES.map((h, i) => SOL.obb(h.x, h.z, h.ry, h.w / 2, h.d / 2, { h: 3.2, id: 'house' + i })),
  SOL.obb(STALL.x, STALL.z, STALL.ry, 1.3, 0.8, { h: 2.2, id: 'stall' }),
  SOL.obb(TABLE.x, TABLE.z, 0, 0.85, 0.5, { h: 0.78, id: 'table' }),
  SOL.circle(BOARD_POS[0] - 2.1, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  SOL.circle(BOARD_POS[0] + 2.1, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
];
export const WORLD = SOL.makeWorld(STATICS);
export const dynamicsAt = (f) => {
  const out = [];
  for (const a of castAt(f)) out.push(SOL.circle(a.x, a.z, a.r, { kind: 'dynamic', id: a.id }));
  return out;
};
export const groundItemsAt = (f) => {
  const items = [];
  const sh = shoesAt(f);
  // the giant shoes: ground-checked whenever they REST (stall table top
  // 0.78 / riverbank ground 0); while carried or walking on stilts they
  // are transitional and unchecked, like a fall.
  if (sh.resting) items.push({ id: 'shoes', y: sh.y, ground: f < 1065 ? 0.78 : 0, maxHover: 0.03 });
  for (const a of castAt(f)) items.push({ id: a.id, y: a.y, ground: a.id === 'son' ? 0.9 : 0, maxHover: 0.06 });
  return items;
};
