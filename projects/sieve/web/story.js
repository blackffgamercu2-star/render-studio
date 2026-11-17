// Shot plan for "The Woman Who Carried Water in a Sieve" — sieve (LIBRARY v4:
// speak.js dialogue performance + materials v4, camrig smooth tracking + solid
// colliders). Batch 7 topic 2. ONE set: a dry village square with a river at
// the north edge (bank strip z -11.6..-8.2, water z -20.95..-10.85). A woman
// bets she can carry river water home in a sieve; she seals every hole with
// golden beeswax, dips the sieve, and the water sits in it like in a bowl.
// Voice stem: 48.491 s, 30 fps, TOTAL 1455; timings from faster-whisper
// word alignment (words.json). Scene changes ONLY at clause boundaries:
//   S1  0.00-5.64   In a dry village...heard.        S6  25.70-29.28 Then she dipped...bowl.
//   S2  6.04-9.58   "I will carry..." (dialogue 1)   S7  29.28-35.12 She carried it home...there.
//   S3  10.00-14.32 The village laughed...it.       S8  35.56-41.50 "The sieve never held..." (dialogue 2)
//   S4  14.72-19.54 At sunrise...patience.          S9  42.06-45.92 But one old fisherman...no line.
//   S5  20.00-25.32 She warmed the wax...skin.      S10 46.30-48.22 How do you catch a fish...?
// GRADE (FILTER_VFX_LIGHTING pack): Golden Hour throughout; hook shot blends
// to dusk on the clause boundary. Signature VFX: golden wax glints on the
// sieve, splash crown + ripples + foam at the dip, moving sheen on the brass,
// dust motes + drifting clouds + palm sway in every shot (no plain frames).
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

export const FPS = 30, TOTAL = 1455, DECK = 0;
export const SHOTS = [
  { id: 'drone', a: 0, b: 169, light: 'gold' },
  { id: 'bet', a: 170, b: 287, light: 'gold' },
  { id: 'laugh', a: 288, b: 429, light: 'gold' },
  { id: 'walk', a: 430, b: 586, light: 'gold' },
  { id: 'wax', a: 587, b: 759, light: 'gold' },
  { id: 'dip', a: 760, b: 878, light: 'gold' },
  { id: 'carry', a: 879, b: 1053, light: 'gold' },
  { id: 'twist', a: 1054, b: 1244, light: 'gold' },
  { id: 'hookq', a: 1245, b: 1377, light: 'gold' },
  { id: 'hook', a: 1378, b: 1454, light: 'dusk' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights / mood grades ----------
export const LIGHTS = {
  gold: { az: 232, el: 27, sky: '#f0cf9e', ground: '#8a6f4a', hemi: 1.02, sun: '#ffd9a0', sunI: 2.45, fog: '#e8d3ac', fogNear: 46, fogFar: 330,
    skyTop: '#3a6ab0', skyHor: '#f2cd8e', sunDisc: '#fff0bc', sunSize: 0.0042, sat: 1.09, vig: 0.26, shadowExt: 22, aurora: 0, gain: '#ffedc8',
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
  if (S.id === 'hookq') return blendLight(LIGHTS.gold, LIGHTS.dusk, smooth(ramp(f, 1245, 1320)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging (shared by story, main, colliders) ----------
export const BOARD_POS = [0, 3.1, -6];
export const PLATFORM = { x: 0, z: 2, r: 1.35, top: 0.18 };
export const WAX_TABLE = { x: -5.5, z: 5.5 };
export const RIVER = { y: 0.15, z0: -11, z1: -20.95, cz: -15.9 }; // 0.15: 0.08 still z-fought (river won only in the east); 15cm clears the plaza's depth precision at drone distance
export const BANK = { x0: -16, x1: 16, z0: -11.6, z1: -8.2, top: 0.03 };
const SIEVE_TABLE = [-5.9, 0.78, 5.3];   // sieve resting on the wax table
const WAXPOT_POS = [-5.1, 0.78, 5.8];    // small wax pot, same table
const SIEVE_HOME = [-1.1, PLATFORM.top, 1.75]; // near-west edge of the drum: within her reach, ON the platform, in frame for the set-down
const DIP_SIEVE = [0.5, -11.9];          // sieve over open water at the dip

const walkKeys = (keys, f) => {
  let x = keys[0][1], z = keys[0][2];
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i][0]) { const a = keys[i - 1], b = keys[i]; const u = smooth(ramp(f, a[0], b[0])); return [lerp(a[1], b[1], u), lerp(a[2], b[2], u)]; }
    x = keys[keys.length - 1][1]; z = keys[keys.length - 1][2];
  }
  return [x, z];
};
// Woman: village (-3.5, 5.0) -> riverbank (0.5, -10.9) -> home (-1.9, 1.4),
// standing beside (never on) the platform where the sieve is set down.
const WOMAN_KEYS = [
  [0, -3.5, 5.0], [429, -3.5, 5.0], [470, -3.0, 1.0], [520, -1.0, -4.5], [586, 0.5, -10.9],
  [878, 0.5, -10.9], [920, 0.0, -5.0], [970, -1.2, 0.0], [1010, -1.9, 1.4], [1454, -1.9, 1.4],
];
const V1_KEYS = [
  [0, 4.6, 4.2], [878, 4.6, 4.2], [940, 2.6, 2.2], [1010, 1.0, -0.3], [1454, 1.0, -0.3],
];
const V2_KEYS = [
  [0, -5.8, 3.0], [878, -5.8, 3.0], [1010, -2.6, -0.6], [1454, -2.6, -0.6],
];
const V3_KEYS = [
  [0, 5.6, 0.5], [878, 5.6, 0.5], [940, 3.4, 0.9], [1010, 1.9, 0.6], [1454, 1.9, 0.6],
];
export const womanAt = (f) => { const [x, z] = walkKeys(WOMAN_KEYS, f); return { x, z }; };
export const v1At = (f) => { const [x, z] = walkKeys(V1_KEYS, f); return { x, z }; };
export const v2At = (f) => { const [x, z] = walkKeys(V2_KEYS, f); return { x, z }; };
export const v3At = (f) => { const [x, z] = walkKeys(V3_KEYS, f); return { x, z }; };
const strolling = (f, spans) => spans.some(([a, b]) => f >= a && f <= b) ? 1 : 0;
export const womanMode = (f) => strolling(f, [[430, 586], [879, 1010]]) ? 'stroll' : 'stand';
export const villagerMode = (f) => strolling(f, [[879, 1010]]) ? 'stroll' : 'stand';
// The sieve: rests on the wax table -> picked up WITH her hand as she walks
// (f430-480) -> held at her hands -> dipped in the river -> lifted full ->
// carried home -> set down on the platform (f1125-1150, small settle) -> rests.
export const sieveAt = (f) => {
  const w = womanAt(f);
  if (f < 430) return { x: SIEVE_TABLE[0], y: SIEVE_TABLE[1], z: SIEVE_TABLE[2], carried: 0, resting: 1 };
  if (f < 500) {
    const u = smooth(ramp(f, 430, 480));
    return { x: lerp(SIEVE_TABLE[0], w.x, u), y: lerp(SIEVE_TABLE[1], 1.02, u), z: lerp(SIEVE_TABLE[2], w.z, u), carried: 1, resting: 0 };
  }
  if (f < 775) return { x: w.x, y: 1.02, z: w.z, carried: 1, resting: 0 };
  if (f <= 855) {
    // dip: lower into the water (f775-805), hold, lift full (f825-855)
    const down = smooth(ramp(f, 775, 805)), up = smooth(ramp(f, 825, 855));
    const u = down * (1 - up);
    return { x: w.x, y: lerp(1.02, 0.02, u), z: lerp(w.z, DIP_SIEVE[1], u), carried: 1, resting: 0 };
  }
  if (f < 1125) return { x: w.x, y: 1.02, z: w.z, carried: 1, resting: 0 };
  if (f <= 1150) {
    const u = smooth(ramp(f, 1125, 1150));
    return { x: lerp(w.x, SIEVE_HOME[0], u), y: lerp(1.02, SIEVE_HOME[1], u), z: lerp(w.z, SIEVE_HOME[2], u), carried: 1, resting: 0 };
  }
  // set-down settle: one small dip, then still
  const settle = (f <= 1158) ? -0.02 * Math.sin(Math.PI * (f - 1150) / 8) : 0;
  return { x: SIEVE_HOME[0], y: SIEVE_HOME[1] + settle, z: SIEVE_HOME[2], carried: 0, resting: 1 };
};
export const waxpotAt = () => ({ x: WAXPOT_POS[0], y: WAXPOT_POS[1], z: WAXPOT_POS[2] });
// wax seal: golden skin grows over the sieve hole by hole (wax shot)
export const waxAt = (f) => smooth(ramp(f, 600, 750));
// water held: appears as the sieve lifts out of the river, stays to the end
export const waterAt = (f) => smooth(ramp(f, 830, 855));
export const glintAt = (f) => {
  let s = 0;
  const pulse = (a, b, peak) => { if (f >= a && f <= b) s = Math.max(s, peak * Math.sin(ramp(f, a, b) * Math.PI)); };
  pulse(650, 750, 0.8);   // waxing: warm glints on the golden skin
  pulse(840, 870, 1.0);   // the lift: water sits like a bowl
  pulse(950, 1000, 0.6);  // carried home through the village
  pulse(1150, 1244, 0.9); // "The wax did." — payoff glow
  return s;
};

// ---------- hero / focus ----------
const FOCUS = {
  drone: () => [0, 1.2, 2],
  bet: () => { const w = womanAt(200); return [w.x, 1.2, w.z]; },
  laugh: () => [0.5, 1.2, 3.5],
  walk: () => { const w = womanAt(500); return [w.x, 1.2, w.z]; },
  wax: () => { const s = sieveAt(680); return [s.x, 1.0, s.z]; },
  dip: () => [0.5, 0.6, -11.0],
  carry: () => { const w = womanAt(950); return [w.x, 1.2, w.z]; },
  twist: () => { const w = womanAt(1150); return [w.x, 1.45, w.z]; },
  hookq: () => BOARD_POS, hook: () => BOARD_POS,
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id]();

// ---------- cameras: EVERY shot is a camrig track on a subject ----------
const sievePos = (f) => { const s = sieveAt(f); return [s.x, s.y, s.z]; };
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
    [[0, 3.0, -6], [0, 2.2, -2], [0, 1.2, 1.6], [0, 1.0, 2.2]], 0, 169, 44, 40) },
  bet: { cut: 'hard', raw: pushInCam({ subject: womanPos, a: 170, b: 287, d0: 5.6, d1: 4.3, h0: 1.55, h1: 1.45, lookOff: [0, 1.35, 0], fov0: 40, fov1: 34,
    dir: () => [0.62, 0.72] }) },
  laugh: { cut: 'hard', raw: keysCam({ keys: [
    { f: 288, pos: [7.5, 3.2, 12.5], look: [0.3, 1.1, 3.5], fov: 44 },
    { f: 429, pos: [6.8, 3.0, 11.8], look: [0.2, 1.1, 3.2], fov: 42, ease: 'surge' }] }) },
  walk: { cut: 'hard', raw: pushInCam({ subject: womanPos, a: 430, b: 586, d0: 7.5, d1: 5.2, h0: 1.7, h1: 1.6, lookOff: [0, 1.2, 0], fov0: 40, fov1: 36,
    dir: () => [0.8, 0.55] }) },
  wax: { cut: 'hard', raw: pushInCam({ subject: sievePos, a: 587, b: 759, d0: 3.4, d1: 2.6, h0: 2.1, h1: 1.95, lookOff: [0, 0.05, 0], fov0: 34, fov1: 30,
    dir: () => [0.5, 0.8] }) },
  dip: { cut: 'hard', raw: keysCam({ keys: [
    { f: 760, pos: [4.6, 3.4, -6.5], look: [0.4, 0.7, -10.8], fov: 42 },
    { f: 878, pos: [3.8, 3.2, -7.6], look: [0.4, 0.7, -10.9], fov: 38, ease: 'surge' }] }) },
  carry: { cut: 'hard', raw: pushInCam({ subject: womanPos, a: 879, b: 1053, d0: 6.0, d1: 4.6, h0: 1.6, h1: 1.5, lookOff: [0, 1.25, 0], fov0: 40, fov1: 35,
    dir: () => [0.7, 0.65] }) },
  twist: { cut: 'hard', raw: pushInCam({ subject: womanPos, a: 1054, b: 1244, d0: 3.8, d1: 3.6, h0: 1.7, h1: 1.6, lookOff: [0, 1.0, 0], fov0: 34, fov1: 32,
    dir: () => [0.45, 0.85] }) },
  hookq: { cut: 'blend', blend: 10, raw: keysCam({ keys: [
    { f: 1245, pos: [5.6, 3.1, 7.8], look: [0.1, 2.9, -5.9], fov: 40 },
    { f: 1377, pos: [5.1, 3.2, 7.3], look: [0.05, 3.0, -5.95], fov: 37, ease: 'surge' }] }) },
  hook: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1378, pos: [5.1, 3.2, 7.3], look: [0.05, 3.0, -5.95], fov: 37 },
    { f: 1454, pos: [4.9, 3.25, 7.1], look: [0.02, 3.05, -5.97], fov: 36, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: 805, a: 0.03 }, { f: 1150, a: 0.02 }],
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
  if (['wax', 'dip', 'twist'].includes(S.id)) cinf = 3.6;
  if (S.id === 'hook') cinf = 3.0;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f), s = sieveAt(f);
  const W = {
    boardTitle: 0, boardHook: 0,
    sieveX: s.x, sieveY: s.y, sieveZ: s.z, sieveCarried: s.carried,
    waxK: waxAt(f), waterK: waterAt(f), sieveGlint: glintAt(f),
    dustK: 0.05,
  };
  if (S.id === 'drone') W.boardTitle = smooth(ramp(f, 24, 38)) * (1 - smooth(ramp(f, 54, 68)));
  if (S.id === 'hookq') W.boardHook = smooth(ramp(f, 1340, 1365));
  if (S.id === 'hook') W.boardHook = 1;   // held at FULL opacity to the literal last frame
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return { smokeRate: 0.05, dustRate: 0.05, splashRate: 0, steamRate: 0, shimmerRate: waxAt(f) * 0.2, grey: S.light === 'grey' ? 1 : 0 };
};
export const fxAt = () => [];

// ---------- cast (single source for actors AND colliders) ----------
const TINT = { gold: '#ffffff', grey: '#c3ccd4', dusk: '#f2ddc4' };
const tintFor = (S) => TINT[S.light] || '#ffffff';
export const OUTFITS = {
  woman: { jacket: '#8a6a4a', pants: '#6a4a3a', boots: '#3a2a1c', hat: 'hair', hair: '#2c1a10', skin: '#a06a3c' },
  v1: { jacket: '#5a6a4a', pants: '#3a3630', boots: '#241a12', hat: 'cap', cap: '#c8a03a', skin: '#b98a5a' },
  v2: { jacket: '#7a6a5a', pants: '#4a4038', boots: '#241a12', hat: 'hair', hair: '#d8d0c0', skin: '#a08050', moustache: '#d8d0c0' },
  v3: { jacket: '#4a5a6a', pants: '#33302c', boots: '#241a12', hat: 'hair', hair: '#1c1410', skin: '#8a5a34' },
};
export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, z, extra = {}) => out.push({ id, x, y: 0, z, r: 0.32, ground: 0,
    actor: (T) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x, y: 0, z, ground: 0, tint, ...extra }) });
  const w = womanAt(f), a1 = v1At(f), a2 = v2At(f), a3 = v3At(f);
  const wBase = { expr: 'smile', mode: 'stand', blink: blinkAt(f, 31), seed: 31 };
  const vMode = villagerMode(f), vPhase = q((f * 0.011) % 1, 2);
  switch (S.id) {
    case 'drone': {
      std('woman', OUTFITS.woman, { ...wBase }, w.x, w.z, { yaw: 0.5 });
      std('v1', OUTFITS.v1, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, a1.x, a1.z, { yaw: -0.4 });
      std('v2', OUTFITS.v2, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 42), seed: 42 }, a2.x, a2.z, { yaw: 0.4 });
      std('v3', OUTFITS.v3, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 43), seed: 43 }, a3.x, a3.z, { yaw: -0.3 });
      break;
    }
    case 'bet': {
      // THE bet: the woman PERFORMS her line — mouth driven by the stem
      // inside the speak segments, closed in the "she said" tag; the crowd
      // only listens (their mouths never open: narration stays voice-over).
      std('woman', OUTFITS.woman, { mode: 'stand', blink: blinkAt(f, 31), seed: 31, look: 0.15, prop: ['point', 0.85], ...speakFace('smile', f) }, w.x, w.z, { yaw: 0.5 });
      std('v1', OUTFITS.v1, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, a1.x, a1.z, { yaw: -0.4 });
      std('v2', OUTFITS.v2, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 42), seed: 42 }, a2.x, a2.z, { yaw: 0.4 });
      break;
    }
    case 'laugh': {
      std('woman', OUTFITS.woman, { ...wBase, expr: 'smile', headTilt: 0.08 }, w.x, w.z, { yaw: 0.5 });
      std('v1', OUTFITS.v1, { expr: 'laugh', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, a1.x, a1.z, { yaw: -0.4 });
      std('v2', OUTFITS.v2, { expr: 'laugh', mode: 'stand', blink: blinkAt(f, 42), seed: 42 }, a2.x, a2.z, { yaw: 0.4 });
      std('v3', OUTFITS.v3, { expr: 'laugh', mode: 'stand', blink: blinkAt(f, 43), seed: 43 }, a3.x, a3.z, { yaw: -0.3 });
      break;
    }
    case 'walk': {
      std('woman', OUTFITS.woman, { ...wBase, mode: womanMode(f), phase: q((f * 0.011) % 1, 2) }, w.x, w.z, { yaw: 0.5 });
      break;
    }
    case 'wax': {
      // Close-up: her hands rub the wax in, hole by hole. The golden skin
      // (waxK) grows on the sieve in the same frames the voice names it.
      std('woman', OUTFITS.woman, { ...wBase, prop: ['point', 0.85] }, w.x, w.z, { yaw: 0.45 });
      break;
    }
    case 'dip': {
      std('woman', OUTFITS.woman, { ...wBase, expr: f >= 830 ? 'shock' : 'smile', prop: ['point', 0.7] }, w.x, w.z, { yaw: 0.45 });
      break;
    }
    case 'carry': {
      std('woman', OUTFITS.woman, { ...wBase, mode: womanMode(f), phase: q((f * 0.011) % 1, 2) }, w.x, w.z, { yaw: 0.5 });
      std('v1', OUTFITS.v1, { expr: 'neutral', mode: vMode, phase: vPhase, blink: blinkAt(f, 41), seed: 41 }, a1.x, a1.z, { yaw: -0.4 });
      std('v2', OUTFITS.v2, { expr: 'neutral', mode: vMode, phase: vPhase, blink: blinkAt(f, 42), seed: 42 }, a2.x, a2.z, { yaw: 0.4 });
      std('v3', OUTFITS.v3, { expr: 'neutral', mode: vMode, phase: vPhase, blink: blinkAt(f, 43), seed: 43 }, a3.x, a3.z, { yaw: -0.3 });
      break;
    }
    case 'twist': {
      // THE twist: she sets the sieve down full (f1125-1150, narration tag —
      // mouth closed) and PERFORMS "The wax did..." — mouth driven by the
      // stem; the crowd watches in silence, then amazement.
      const shock = f >= 1151;
      std('woman', OUTFITS.woman, { mode: 'stand', blink: blinkAt(f, 31), seed: 31, look: 0.15, ...speakFace('smile', f) }, w.x, w.z, { yaw: 0.5 });
      std('v1', OUTFITS.v1, { expr: shock ? 'shock' : 'neutral', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, a1.x, a1.z, { yaw: -0.4 });
      std('v2', OUTFITS.v2, { expr: shock ? 'shock' : 'neutral', mode: 'stand', blink: blinkAt(f, 42), seed: 42 }, a2.x, a2.z, { yaw: 0.4 });
      std('v3', OUTFITS.v3, { expr: shock ? 'shock' : 'neutral', mode: 'stand', blink: blinkAt(f, 43), seed: 43 }, a3.x, a3.z, { yaw: -0.3 });
      break;
    }
    case 'hookq': {
      std('woman', OUTFITS.woman, { ...wBase }, w.x, w.z, { yaw: 0.5 });
      std('v1', OUTFITS.v1, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, a1.x, a1.z, { yaw: -0.4 });
      break;
    }
    case 'hook': break;
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity: statics, dynamics, ground (LIBRARY v3 gate data) ----------
export const STATICS = [
  SOL.circle(PLATFORM.x, PLATFORM.z, PLATFORM.r, { h: PLATFORM.top, id: 'platform' }),
  SOL.obb(WAX_TABLE.x, WAX_TABLE.z, 0, 0.85, 0.5, { h: 0.78, id: 'waxtable' }),
  SOL.aabb(-17.5, -16, -8, 12, { h: 2.6, id: 'wallW' }),
  SOL.aabb(16, 17.5, -8, 12, { h: 2.6, id: 'wallE' }),
  SOL.aabb(-12.45, -9.55, 1.8, 4.2, { h: 3.0, id: 'hut1' }),
  SOL.aabb(10.05, 12.95, 2.8, 5.2, { h: 3.0, id: 'hut2' }),
  SOL.aabb(9.05, 11.95, -7.7, -5.3, { h: 3.0, id: 'hut3' }),
  SOL.circle(-12, -6, 0.22, { h: 4.1, id: 'palm1' }),
  SOL.circle(12, -7, 0.22, { h: 4.1, id: 'palm2' }),
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
  const s = sieveAt(f);
  // the sieve is a carried/resting prop: ground-checked whenever it RESTS
  // (wax-table top 0.78 / platform top 0.18); while carried it is
  // transitional (in the woman's hands) and unchecked, like a fall.
  if (s.resting) items.push({ id: 'sieve', y: s.y, ground: f < 430 ? 0.78 : PLATFORM.top, maxHover: 0.03 });
  // the wax pot never leaves the table
  items.push({ id: 'waxpot', y: WAXPOT_POS[1], ground: 0.78, maxHover: 0.03 });
  for (const a of castAt(f)) items.push({ id: a.id, y: a.y, ground: 0, maxHover: 0.06 });
  return items;
};
