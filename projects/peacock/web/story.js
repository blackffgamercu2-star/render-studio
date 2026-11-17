// Shot plan for "The Peacock Who Stopped a Train" — peacock (LIBRARY v4:
// speak.js dialogue performance + materials v4, camrig smooth tracking +
// solid colliders). Batch 7 topic 1. ONE set: a tiny jungle railway
// station in morning sun. Every morning the 7:10 express brakes at a
// station where nobody gets on or off — because a peacock fans its tail
// across the track, the driver sees a crowd, brakes, and the braking
// shakes grain loose from the goods wagon. The peacock trained the train.
// Voice stem: 51.57 s, 30 fps, TOTAL 1548; timings from faster-whisper
// word alignment (words.json). Scene changes ONLY at clause boundaries:
//   S1  0.00-5.62  Every morning...got off.      S8  33.40-36.22 Peacock folds...breakfast.
//   S2  6.00-11.50 Driver swore...same spot.     S9  36.96-38.38 Station boy watched...
//   S3  12.06-15.38 Inspector came...eyes.       S10 38.84-42.54 Bird had learned...
//   S4  15.82-20.58 Peacock standing...eyes.      S11 43.16-45.72 Nobody trained...
//   S5  21.22-24.04 "Crowd on the line!" + brake S12 46.24-49.64 Woman + sieve...
//   S6  24.46-26.68 Alone — only feathers.        S13 50.12-51.28 How do you carry...?
//   S7  27.30-32.80 Inspector laughed...track.
// GRADE (FILTER_VFX_LIGHTING pack): Sunny Pop throughout; the twist beat
// (S11) and hook (S12-S13) shift to a warm Golden Hour blend — grade
// changes ONLY on clause boundaries. Signature VFX: brake dust burst at
// the wheels, grain shower from the goods wagon (falling, landing, one
// small bounce), peacock tail fan with eye-spot glints, pollen motes in
// the morning sun, jungle leaves gusting (never a uniform wave).
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
  const p = SPK.applySpeak({ ...T.faceP(baseName), cheek: 0.5 }, s);
  // Outside the speak segment the base 'shock' expression would leave the
  // mouth open (a gasp) — force it firmly closed in pauses (applySpeak
  // only does this while active, so do it here for inactive frames).
  if (!s.active) { p.mOpen = 0; p.teeth = 0; p.tongue = 0; p.wave = 0; }
  return { expr: 'shock', exprP: p, headTilt: q(s.nod || 0, 2), clothShade: true };
};

export const FPS = 30, TOTAL = 1548, DECK = 0;
export const SHOTS = [
  { id: 'drone', a: 0, b: 179, light: 'sunny' },
  { id: 'driver', a: 180, b: 361, light: 'sunny' },
  { id: 'inspector', a: 362, b: 474, light: 'sunny' },
  { id: 'peacock', a: 475, b: 636, light: 'sunny' },
  { id: 'dialogue', a: 637, b: 733, light: 'sunny' },
  { id: 'feathers', a: 734, b: 818, light: 'sunny' },
  { id: 'grain', a: 819, b: 1001, light: 'sunny' },
  { id: 'eat', a: 1002, b: 1108, light: 'sunny' },
  { id: 'boy', a: 1109, b: 1164, light: 'sunny' },
  { id: 'learned', a: 1165, b: 1294, light: 'sunny' },
  { id: 'twist', a: 1295, b: 1386, light: 'gold' },
  { id: 'hookq', a: 1387, b: 1503, light: 'gold' },
  { id: 'hook', a: 1504, b: 1547, light: 'gold' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights / mood grades ----------
export const LIGHTS = {
  sunny: { az: 210, el: 35, sky: '#f0cf9e', ground: '#7a6a42', hemi: 1.05, sun: '#ffd9a0', sunI: 2.6, fog: '#ead9ae', fogNear: 46, fogFar: 330,
    skyTop: '#2e6fc0', skyHor: '#ffe6a8', sunDisc: '#fff0bc', sunSize: 0.0042, sat: 1.12, vig: 0.24, shadowExt: 26, aurora: 0, gain: '#ffedc8',
    waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
  gold: { az: 232, el: 22, sky: '#e8bd85', ground: '#6b5232', hemi: 0.95, sun: '#ffbe78', sunI: 2.2, fog: '#e0b98a', fogNear: 42, fogFar: 300,
    skyTop: '#2e3c6e', skyHor: '#f0a668', sunDisc: '#ffbe78', sunSize: 0.0044, sat: 1.08, vig: 0.28, shadowExt: 26, aurora: 0, gain: '#f2ddba',
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
  if (S.id === 'twist') return blendLight(LIGHTS.sunny, LIGHTS.gold, smooth(ramp(f, 1295, 1340)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging (shared by story, main, colliders) ----------
// Track runs along X at z=0 (rails z=+-0.75). Platform (top 0.55) on the
// south side, z 2.2..5.4, x -12..12. Jungle north (z<-6) and south (z>8).
export const BOARD_POS = [0, 3.1, -5.5];
export const PLATFORM = { x: 0, z: 3.8, top: 0.55 };
export const SHELTER = { x: 10.5, z: 4.3, ry: 0 };   // east end: the driver
// camera sweeps the platform edge at z~5.2, so the shelter must not sit
// over that path (its roof at y 2.5 occluded the driver at f345).
export const BENCH = { x: 6.5, z: 4.6 };
export const TRAIN_STOP = -3.2;   // loco front x when stopped
const GRAIN_PILE = [-6.7, 1.1];   // grain lands here (forward scatter, south of the track)

// ---------- the train: approaches at constant speed, then brakes with a
// quadratic ease-out so speed is continuous at the brake point (f=168) and
// zero at the stop (f=345). Wheel radius 0.45 m.
export const trainXAt = (f) => {
  if (f <= 168) return -34 + 0.12 * f;
  if (f >= 345) return TRAIN_STOP;
  const u = (f - 168) / (345 - 168);
  return -13.84 + 10.64 * (1 - (1 - u) * (1 - u));
};
export const trainDistAt = (f) => {
  if (f <= 168) return 0.12 * f;
  if (f >= 345) return 0.12 * 168 + 10.64;
  const u = (f - 168) / (345 - 168);
  return 0.12 * 168 + 10.64 * (1 - (1 - u) * (1 - u));
};
export const brakeAt = (f) => {
  let s = 0;
  const seg = (a, b, c, d, peak) => { if (f >= a && f <= d) s = Math.max(s, peak * (f < b ? smooth(ramp(f, a, b)) : f <= c ? 1 : 1 - smooth(ramp(f, c, d)))); };
  seg(300, 320, 345, 385, 1);   // brake dust burst at the wheels
  return s;
};

// ---------- the peacock: stands on the track, fans, folds, walks to the
// grain pile and eats. Tail fan 0 = folded train trailing, 1 = full fan.
export const peacockXAt = (f) => {
  if (f < 1002) return 0;
  if (f > 1085) return GRAIN_PILE[0];
  return lerp(0, GRAIN_PILE[0], smooth(ramp(f, 1002, 1085)));
};
export const peacockZAt = (f) => {
  if (f < 1002) return 0;
  if (f > 1085) return GRAIN_PILE[1];
  return lerp(0, GRAIN_PILE[1], smooth(ramp(f, 1002, 1085)));
};
export const fanAt = (f) => {
  let s = 0;
  const seg = (a, b, c, d, peak) => { if (f >= a && f <= d) s = Math.max(s, peak * (f < b ? smooth(ramp(f, a, b)) : f <= c ? 1 : 1 - smooth(ramp(f, c, d)))); };
  seg(475, 520, 800, 860, 1);      // fanned for the inspector + driver
  seg(860, 880, 1001, 1001, 0.15); // folded while it eats
  seg(1165, 1210, 1294, 1294, 0.85); // fans again: "a fanned tail stops the train"
  seg(1295, 1320, 1386, 1386, 0.5);  // proud half-fan for the twist
  seg(1387, 1400, 1547, 1547, 0.2);  // low fan behind the hook board
  return s;
};
export const peckAt = (f) => {
  // head-bob while eating at the pile (eat shot + boy shot, light pecks)
  if (f >= 1085 && f <= 1108) return 1;
  if (f >= 1109 && f <= 1164) return 0.45;
  return 0;
};
const segMax = (f, segs) => {
  let s = 0;
  for (const [a, b, c, d, peak] of segs) if (f >= a && f <= d) s = Math.max(s, peak * (f < b ? smooth(ramp(f, a, b)) : f <= c ? 1 : 1 - smooth(ramp(f, c, d))));
  return s;
};
export const grainShowerAt = (f) => segMax(f, [[860, 880, 960, 985, 1]]);
export const pileAt = (f) => smooth(ramp(f, 940, 1001));
export const glintAt = (f) => {
  let s = 0;
  const pulse = (a, b, peak) => { if (f >= a && f <= b) s = Math.max(s, peak * Math.sin(ramp(f, a, b) * Math.PI)); };
  pulse(475, 560, 0.9); pulse(1180, 1260, 1); pulse(1300, 1386, 0.7);
  return s;
};

// ---------- people positions ----------
// Driver leans from the loco cab door (footplate top y 0.90, south side,
// OUTSIDE the cab wall so the platform-side camera sees him).
export const driverAt = (f) => ({ x: trainXAt(f) - 5.2, y: 0.9, z: 1.3 });
export const INSPECTOR = { x: 2.2, z: 3.2 };
export const BOY = { x: -1.5, z: 3.6 };   // platform, clear of the eat/twist
// camera sightlines (they run from x≈-4, z≈5 to the pile at (-6.7, 1.1);
// the boy used to stand at (-4.5, 3.6), right on that line).

// ---------- hero / focus ----------
const FOCUS = {
  drone: () => [0, 1.0, 0],
  driver: () => { const d = driverAt(250); return [d.x, 1.4, d.z]; },
  inspector: () => [INSPECTOR.x, 1.3, INSPECTOR.z],
  peacock: () => [0, 0.9, 0],
  dialogue: () => { const d = driverAt(680); return [d.x, 1.5, d.z]; },
  feathers: () => [0, 0.9, 0],
  grain: () => [-6, 1.2, 0],
  eat: () => [peacockXAt(1050), 0.7, peacockZAt(1050)],
  boy: () => [BOY.x, 1.2, BOY.z],
  learned: () => [-2.5, 0.9, 0],
  twist: () => [peacockXAt(1330), 0.9, peacockZAt(1330)],
  hookq: () => BOARD_POS, hook: () => BOARD_POS,
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id]();
export const peacockPosAt = (f) => [peacockXAt(f), 0, peacockZAt(f)];

// ---------- cameras: EVERY shot is a camrig track on a subject ----------
const driverPos = (f) => { const d = driverAt(f); return [d.x, d.y, d.z]; };
const inspectorPos = () => [INSPECTOR.x, PLATFORM.top, INSPECTOR.z];
const boyPos = () => [BOY.x, PLATFORM.top, BOY.z];
const bezierCam = (P, L, a, b, fov0, fov1) => (f) => {
  const u = M.smooth(ramp(f, a, b));
  const w0 = (1 - u) ** 3, w1 = 3 * (1 - u) ** 2 * u, w2 = 3 * (1 - u) * u * u, w3 = u ** 3;
  const mix = (Q) => [0, 1, 2].map((j) => w0 * Q[0][j] + w1 * Q[1][j] + w2 * Q[2][j] + w3 * Q[3][j]);
  return { pos: mix(P), look: mix(L), fov: lerp(fov0, fov1, u), roll: 0 };
};
const RIG_BY_ID = {
  drone: { cut: 'hard', raw: bezierCam(
    [[20, 16, 26], [12, 9, 19], [8, 5, 14], [7, 3.6, 12]],
    [[-2, 2.2, -4], [-1, 1.6, -3], [0, 1.2, -2], [0, 1.0, -1]], 0, 179, 44, 38) },
  driver: { cut: 'hard', raw: pushInCam({ subject: driverPos, a: 180, b: 361, d0: 7.0, d1: 5.2, h0: 1.6, h1: 1.5, lookOff: [0, 1.1, 0], fov0: 40, fov1: 34,
    dir: () => [0.6, 0.75] }) },
  inspector: { cut: 'hard', raw: pushInCam({ subject: inspectorPos, a: 362, b: 474, d0: 5.6, d1: 4.6, h0: 1.6, h1: 1.5, lookOff: [0, 1.15, 0], fov0: 38, fov1: 33,
    dir: () => [0.55, 0.8] }) },
  peacock: { cut: 'hard', raw: keysCam({ keys: [
    { f: 475, pos: [-7.5, 2.2, 9.5], look: [0, 0.8, 0], fov: 40 },
    { f: 636, pos: [-5.2, 1.8, 7.2], look: [0, 0.9, 0], fov: 34, ease: 'surge' }] }) },
  dialogue: { cut: 'hard', raw: pushInCam({ subject: driverPos, a: 637, b: 733, d0: 4.6, d1: 4.0, h0: 1.7, h1: 1.6, lookOff: [0, 1.35, 0], fov0: 32, fov1: 28,
    dir: () => [0.5, 0.85] }) },
  feathers: { cut: 'hard', raw: staticTrackCam({ pos: [-4.2, 1.9, 7.8], subject: peacockPosAt, lookOff: [0, 0.7, 0], fov: 36 }) },
  grain: { cut: 'hard', raw: keysCam({ keys: [
    { f: 819, pos: [6, 2.6, 9.5], look: [2.2, 1.9, 3.2], fov: 40 },
    { f: 1001, pos: [1, 2.8, 9], look: [-8.5, 1.2, 0], fov: 38, ease: 'surge' }] }) },
  eat: { cut: 'hard', raw: pushInCam({ subject: peacockPosAt, a: 1002, b: 1108, d0: 7.5, d1: 6.5, h0: 2.4, h1: 2.2, lookOff: [-0.4, 0.9, 0], fov0: 42, fov1: 38,
    dir: () => [0.55, 0.8] }) },
  boy: { cut: 'hard', raw: pushInCam({ subject: boyPos, a: 1109, b: 1164, d0: 4.8, d1: 4.2, h0: 1.55, h1: 1.45, lookOff: [0, 1.15, 0], fov0: 38, fov1: 33,
    dir: () => [0.5, 0.8] }) },
  learned: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1165, pos: [7, 2.8, 10], look: [-2, 0.9, 0], fov: 38 },
    { f: 1294, pos: [5, 2.2, 8], look: [-3, 0.9, 0], fov: 33, ease: 'surge' }] }) },
  twist: { cut: 'hard', raw: pushInCam({ subject: peacockPosAt, a: 1295, b: 1386, d0: 6.0, d1: 5.5, h0: 2.2, h1: 2.0, lookOff: [0, 1.0, 0], fov0: 36, fov1: 32,
    dir: () => [0.55, 0.8] }) },
  hookq: { cut: 'blend', blend: 10, raw: keysCam({ keys: [
    { f: 1387, pos: [5.6, 3.1, 7.8], look: [0, 2.9, -5.4], fov: 40 },
    { f: 1503, pos: [5.1, 3.2, 7.3], look: [0, 3.0, -5.45], fov: 37, ease: 'surge' }] }) },
  hook: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1504, pos: [5.1, 3.2, 7.3], look: [0, 3.0, -5.45], fov: 37 },
    { f: 1547, pos: [4.9, 3.25, 7.1], look: [0, 3.05, -5.47], fov: 36, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: 345, a: 0.03 }],
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
  if (['peacock', 'dialogue', 'eat', 'twist'].includes(S.id)) cinf = 3.6;
  if (S.id === 'hook') cinf = 3.0;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f), d = driverAt(f);
  const W = {
    boardTitle: 0, boardHook: 0,
    trainX: trainXAt(f), trainDist: trainDistAt(f), brakeK: brakeAt(f),
    peaX: peacockXAt(f), peaZ: peacockZAt(f), fanK: fanAt(f), peckK: peckAt(f),
    grainK: grainShowerAt(f), pileK: pileAt(f), glintK: glintAt(f),
    driverX: d.x, driverY: d.y, driverZ: d.z,
  };
  if (S.id === 'drone') W.boardTitle = smooth(ramp(f, 24, 38)) * (1 - smooth(ramp(f, 54, 68)));
  if (S.id === 'hookq') W.boardHook = smooth(ramp(f, 1420, 1445));
  if (S.id === 'hook') W.boardHook = 1;   // held at FULL opacity to the literal last frame
  return W;
};
export const fxProfileAt = (f) => {
  return { smokeRate: 0.05, dustRate: 0.05, splashRate: 0, steamRate: brakeAt(f), shimmerRate: 0, grey: 0, grainRate: grainShowerAt(f) };
};
export const fxAt = () => [];

// ---------- cast (single source for actors AND colliders) ----------
const TINT = { sunny: '#ffffff', gold: '#f2ddc4' };
const tintFor = (S) => TINT[S.light] || '#ffffff';
export const OUTFITS = {
  driver: { jacket: '#1e3a5f', pants: '#23283a', boots: '#1c1712', hat: 'cap', cap: '#1e3a5f', skin: '#a06a3c' },
  inspector: { jacket: '#2c3a5e', pants: '#2a3242', boots: '#1c1712', hat: 'cap', cap: '#1a2440', skin: '#c98a5a', moustache: '#241a12' },
  boy: { jacket: '#e8dcc0', pants: '#7a5a3a', boots: '#3a2a1c', hat: 'hair', hair: '#1c1410', skin: '#a06a3c' },
};
export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, y, z, extra = {}) => out.push({ id, x, y, z, r: 0.32, ground: y,
    actor: (T) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x, y, z, ground: y, tint, ...extra }) });
  const d = driverAt(f);
  const dBase = { expr: 'stern', mode: 'stand', blink: blinkAt(f, 31), seed: 31 };
  switch (S.id) {
    case 'drone': {
      std('driver', OUTFITS.driver, { ...dBase }, d.x, d.y, d.z, { yaw: 0.5 });
      std('inspector', OUTFITS.inspector, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, INSPECTOR.x, PLATFORM.top, INSPECTOR.z, { yaw: -0.4 });
      std('boy', OUTFITS.boy, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, BOY.x, PLATFORM.top, BOY.z, { yaw: 0.3 });
      break;
    }
    case 'driver': {
      std('driver', OUTFITS.driver, { ...dBase, prop: f >= 330 ? ['point', 0.5] : null }, d.x, d.y, d.z, { yaw: 0.6 });
      std('inspector', OUTFITS.inspector, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, INSPECTOR.x, PLATFORM.top, INSPECTOR.z, { yaw: -0.4 });
      break;
    }
    case 'inspector': {
      std('inspector', OUTFITS.inspector, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 41), seed: 41, headTilt: 0.08 }, INSPECTOR.x, PLATFORM.top, INSPECTOR.z, { yaw: -0.3 });
      std('boy', OUTFITS.boy, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, BOY.x, PLATFORM.top, BOY.z, { yaw: 0.3 });
      break;
    }
    case 'peacock': {
      std('driver', OUTFITS.driver, { ...dBase, expr: 'shock' }, d.x, d.y, d.z, { yaw: 0.5 });
      std('inspector', OUTFITS.inspector, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, INSPECTOR.x, PLATFORM.top, INSPECTOR.z, { yaw: -0.4 });
      std('boy', OUTFITS.boy, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, BOY.x, PLATFORM.top, BOY.z, { yaw: 0.4 });
      break;
    }
    case 'dialogue': {
      // THE dialogue beat: the driver PERFORMS his line — mouth driven by
      // the stem inside the speak segment (f637-689), closed outside it;
      // the inspector only listens (his mouth never opens).
      std('driver', OUTFITS.driver, { mode: 'stand', blink: blinkAt(f, 31), seed: 31, look: 0.15, ...speakFace('shock', f) }, d.x, d.y, d.z, { yaw: 0.5 });
      std('inspector', OUTFITS.inspector, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, INSPECTOR.x, PLATFORM.top, INSPECTOR.z, { yaw: -0.4 });
      break;
    }
    case 'feathers': {
      std('inspector', OUTFITS.inspector, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, INSPECTOR.x, PLATFORM.top, INSPECTOR.z, { yaw: -0.4 });
      break;
    }
    case 'grain': {
      std('inspector', OUTFITS.inspector, { expr: 'laugh', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, INSPECTOR.x, PLATFORM.top, INSPECTOR.z, { yaw: -0.4 });
      std('boy', OUTFITS.boy, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, BOY.x, PLATFORM.top, BOY.z, { yaw: 0.4 });
      break;
    }
    case 'eat': {
      std('boy', OUTFITS.boy, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, BOY.x, PLATFORM.top, BOY.z, { yaw: 0.4 });
      std('inspector', OUTFITS.inspector, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, INSPECTOR.x, PLATFORM.top, INSPECTOR.z, { yaw: -0.4 });
      break;
    }
    case 'boy': {
      std('boy', OUTFITS.boy, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 51), seed: 51, prop: ['point', 0.7] }, BOY.x, PLATFORM.top, BOY.z, { yaw: 0.4 });
      std('inspector', OUTFITS.inspector, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, INSPECTOR.x, PLATFORM.top, INSPECTOR.z, { yaw: -0.4 });
      break;
    }
    case 'learned': {
      std('boy', OUTFITS.boy, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, BOY.x, PLATFORM.top, BOY.z, { yaw: 0.4 });
      std('inspector', OUTFITS.inspector, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, INSPECTOR.x, PLATFORM.top, INSPECTOR.z, { yaw: -0.4 });
      std('driver', OUTFITS.driver, { ...dBase }, d.x, d.y, d.z, { yaw: 0.5 });
      break;
    }
    case 'twist': {
      std('inspector', OUTFITS.inspector, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, INSPECTOR.x, PLATFORM.top, INSPECTOR.z, { yaw: -0.4 });
      std('boy', OUTFITS.boy, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, BOY.x, PLATFORM.top, BOY.z, { yaw: 0.4 });
      break;
    }
    case 'hookq': case 'hook': break;
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity: statics, dynamics, ground (LIBRARY v3 gate data) ----------
// NOTE: the platform is the actors' GROUND (ground check), not a collider —
// the inspector and boy stand ON it, so it must not appear in STATICS.
// The train runs on its rails and is never in dynamics (its path is clear
// by construction); its wheels-on-rails contact is verified in stills.
export const STATICS = [
  SOL.obb(SHELTER.x, SHELTER.z, SHELTER.ry, 1.6, 0.9, { h: 2.4, id: 'shelter' }),
  SOL.obb(BENCH.x, BENCH.z, 0, 0.9, 0.35, { h: 0.5, id: 'bench' }),
  SOL.circle(BOARD_POS[0] - 2.1, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  SOL.circle(BOARD_POS[0] + 2.1, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  ...[[-11, -9], [-6, -11], [3, -10], [9, -9], [13, -11], [-13, 11.5], [-7, 12.5], [12, 14], [14, 11]].map(([x, z]) => SOL.circle(x, z, 0.55, { h: 6, id: 'tree' })),
  ...[[-6, -4.5], [6, -4.8], [-11, -5], [11, -5.2]].map(([x, z]) => SOL.circle(x, z, 0.6, { h: 0.9, id: 'bush' })),
];
export const WORLD = SOL.makeWorld(STATICS);
export const dynamicsAt = (f) => {
  const out = [];
  for (const a of castAt(f)) out.push(SOL.circle(a.x, a.z, a.r, { kind: 'dynamic', id: a.id }));
  // the peacock is a 3D hero prop with its own collider
  out.push(SOL.circle(peacockXAt(f), peacockZAt(f), 0.4, { kind: 'dynamic', id: 'peacock' }));
  return out;
};
export const groundItemsAt = (f) => {
  const items = [{ id: 'peacock', y: 0, ground: 0, maxHover: 0.03 }];
  for (const a of castAt(f)) items.push({ id: a.id, y: a.y, ground: a.ground, maxHover: 0.06 });
  return items;
};
