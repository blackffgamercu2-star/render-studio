// Shot plan for "The Fisherman Who Caught Fish Without a Net" — fisherman
// (LIBRARY v4: speak.js dialogue performance + materials v4, camrig smooth
// tracking + solid colliders). Batch 7 topic 3 (EN). ONE set: a harbour quay
// at night + the dark sea beyond it. An old fisherman bets the harbour he
// can fill his basket with no net, no hook, no line: he rows to dark water,
// hangs his lantern low, and the fish leap at the light into his basket.
// Voice stem: 50.411 s, 30 fps, TOTAL 1512; timings from faster-whisper
// word alignment (words.json). Scene changes ONLY at clause boundaries:
//   S1 0.00-6.22 The harbour's fishermen...lantern.   S7 29.46-34.76 Then another...them.
//   S2 6.66-11.48 "Tonight I will fill..." (dialogue) S8 35.20-39.06 The old man never cast...
//   S3 11.92-16.28 They followed him out...seen.    S9 39.46-44.84 "You don't need..." (dialogue)
//   S4 16.72-21.90 He rowed...in his lap.           S10 45.30-48.56 But one baker baked...
//   S5 22.40-26.00 The light trembled...moths.       S11 48.90-50.18 How do you bake bread...?
//   S6 26.00-29.10 One leapt...in the boat.
// GRADE (FILTER_VFX_LIGHTING pack): Night Lamp throughout — deep blue
// ambient, warm pools only around the lantern (the one practical light).
// Signature VFX: lantern glow + shimmer on the waves, fish splashes +
// ripple rings, moon glints on the water, mist over the sea.
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

export const FPS = 30, TOTAL = 1512, DECK = 0;
export const SHOTS = [
  { id: 'drone', a: 0, b: 199, light: 'night' },
  { id: 'dialogue1', a: 200, b: 357, light: 'night' },
  { id: 'follow', a: 358, b: 501, light: 'night' },
  { id: 'row', a: 502, b: 671, light: 'night' },
  { id: 'glow', a: 672, b: 779, light: 'night' },
  { id: 'leap1', a: 780, b: 883, light: 'night' },
  { id: 'leapmany', a: 884, b: 1055, light: 'night' },
  { id: 'hold', a: 1056, b: 1183, light: 'night' },
  { id: 'dialogue2', a: 1184, b: 1358, light: 'night' },
  { id: 'hookq', a: 1359, b: 1466, light: 'night' },
  { id: 'hook', a: 1467, b: 1511, light: 'night' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights / mood grade: Night Lamp, one light all through ----------
export const LIGHTS = {
  night: { az: 200, el: 38, sky: '#2a3a5e', ground: '#1c2436', hemi: 0.72, sun: '#9fb4d8', sunI: 1.0, fog: '#16203a', fogNear: 40, fogFar: 300,
    skyTop: '#0a1226', skyHor: '#24365e', sunDisc: '#e8eefc', sunSize: 0.006, sat: 0.95, vig: 0.3, shadowExt: 22, aurora: 0, gain: '#aebfe0',
    waterDeep: '#0a1a2e', waterShal: '#14324a', glint: '#ffd9a0' },
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

// ---------- staging (shared by story, main, colliders) ----------
export const BOARD_POS = [0, 3.1, 11];
export const QUAY = { x0: -16, x1: 16, z0: 3.5, z1: 14 };
export const LAMP1 = { x: -8, z: 5.5 };
export const LAMP2 = { x: 8, z: 5.5 };
export const CRATE1 = { x: -6, z: 9 };
export const CRATE2 = { x: 6.5, z: 10 };
export const HOUSES = { x0: -14, x1: 14, z0: 11.8, z1: 14 };

// Boat: moored just off the quay edge (z=2.2) until the rowing clause,
// then rows out to dark water (z=-8) during f520-660. Deck y = 0.15.
export const boatAt = (f) => {
  const z = f < 520 ? 2.2 : f <= 660 ? lerp(2.2, -8, smooth(ramp(f, 520, 660))) : -8;
  // deck y=-0.3: hull bottom (-0.28) sits just under the -0.25 waterline,
  // gunwale (~0.2) stays above it. The old man sits on the thwart (y=0).
  return { x: 0, y: -0.3, z, rowing: f >= 520 && f <= 660 ? 1 : 0 };
};
const boatPos = (f) => { const b = boatAt(f); return [b.x, b.y, b.z]; };
// Lantern: hangs from the boat's stern pole. High + unlit on the quay beats;
// lowered "low over the side" f546-575 and lit from then on, swaying gently.
export const lanternAt = (f) => {
  const b = boatAt(f);
  const low = smooth(ramp(f, 546, 575));
  const sway = f >= 575 ? Math.sin(f * 0.045) * 0.05 : 0;
  const y = lerp(0.7, 0.12, low) + (f >= 575 ? Math.sin(f * 0.09) * 0.012 : 0);
  return { x: b.x + 0.95 + sway, y, z: b.z + 0.3, lit: smooth(ramp(f, 546, 570)), low };
};
export const lanternGlowAt = (f) => {
  const L = lanternAt(f);
  const flick = 0.94 + 0.06 * Math.sin(f * 0.37) * Math.sin(f * 0.13 + 1.7);
  return L.lit * flick;
};
// Basket: rests on the quay beside the old man (f<502); in his lap in the
// boat after the cut; lifted with effort at "lifting the full basket"
// (f1247-1270), held up through the pause, lowered back to his lap
// f1285-1315 so it never covers the speaker's mouth in the second line.
export const basketAt = (f) => {
  const b = boatAt(f);
  if (f < 502) return { x: -0.9, y: 0, z: 7.2, resting: 1, carried: 0 };
  const lift = smooth(ramp(f, 1247, 1270)) * (1 - smooth(ramp(f, 1285, 1315)));
  let y = 0.1 + lift * 0.4;
  if (f >= 1270 && f <= 1282) y -= 0.04 * Math.sin(Math.PI * (f - 1270) / 12); // small settle
  return { x: b.x - 0.15, y, z: b.z + 0.15, resting: 0, carried: lift > 0.02 ? 1 : 0 };
};
// Fish: ballistic leaps (parabola, natural acceleration, land + STOP).
// F1 lands IN THE BOAT (script); F2-F5 land IN THE BASKET and stay there.
const FISH = [
  { a: 790, b: 850, from: [1.2, -0.25, -0.8], to: [-0.1, -0.15, -0.2], h: 0.95, target: 'boat' },
  { a: 898, b: 938, from: [1.1, -0.25, -0.7], to: [-0.05, 0.44, 0.05], h: 1.05, target: 'basket' },
  { a: 928, b: 966, from: [1.0, -0.25, 0.7], to: [-0.05, 0.47, 0.1], h: 1.0, target: 'basket' },
  { a: 956, b: 994, from: [1.2, -0.25, 0.6], to: [-0.08, 0.5, 0.08], h: 1.1, target: 'basket' },
  { a: 986, b: 1024, from: [1.0, -0.25, -1.0], to: [-0.02, 0.53, 0.0], h: 1.0, target: 'basket' },
];
export const fishAt = (f) => {
  const b = boatAt(f), bk = basketAt(f);
  return FISH.map((F, i) => {
    if (f < F.a - 6) return { visible: 0, x: 0, y: -1, z: 0, rot: 0 };
    const to = F.target === 'basket'
      ? [b.x + F.to[0], bk.y + 0.38 + i * 0.015, b.z + F.to[2]]
      : [b.x + F.to[0], F.to[1], b.z + F.to[2]];
    if (f <= F.b) {
      const u = smooth(ramp(f, F.a, F.b));
      const x = lerp(b.x + F.from[0], to[0], u), z = lerp(b.z + F.from[2], to[2], u);
      const y = lerp(F.from[1], to[1], u) + 4 * F.h * u * (1 - u);
      return { visible: 1, x, y, z, rot: lerp(-0.9, 0.5, u) };
    }
    // landed: STOPS (one small settle bounce in the first 8 frames)
    const s = f - F.b;
    const y = to[1] + (s <= 8 ? 0.05 * (1 - s / 8) * Math.sin(Math.PI * s / 8) : 0);
    return { visible: 1, x: to[0], y, z: to[2], rot: 0.4 };
  });
};
// Splash / ripple rings: takeoff ring at each leap start, landing ring at each end.
export const splashAt = (f) => {
  const b = boatAt(f), out = [];
  for (const F of FISH) {
    const tk = f >= F.a && f <= F.a + 24 ? 1 - (f - F.a) / 24 : 0;
    if (tk > 0) out.push({ x: b.x + F.from[0], z: b.z + F.from[2], k: tk });
    const lk = f >= F.b && f <= F.b + 30 ? 1 - (f - F.b) / 30 : 0;
    if (lk > 0) out.push({ x: b.x + F.to[0], z: b.z + F.to[2], k: lk });
  }
  return out;
};

// ---------- hero / focus ----------
const FOCUS = {
  drone: () => [0, 1.2, 7],
  dialogue1: () => [-1.6, 1.3, 7],
  follow: () => [0, 1.1, 6.5],
  row: () => [0, 0.2, -2],
  glow: () => [0.95, 0.25, -7.7],
  leap1: () => [0, 0.2, -8],
  leapmany: () => [0, 0.2, -8],
  hold: () => [0, 0.3, -8],
  dialogue2: () => [-0.15, 1.0, -7.85],
  hookq: () => BOARD_POS, hook: () => BOARD_POS,
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id]();

// ---------- cameras: EVERY shot is a camrig track on a subject ----------
const oldManPos = (f) => {
  if (f < 502) return [-1.6, 0, 7];
  const b = boatAt(f); return [b.x - 0.35, 0, b.z + 0.1]; // seated on the thwart (y=0)
};
const lanternPos = (f) => { const L = lanternAt(f); return [L.x, L.y, L.z]; };
const bezierCam = (P, L, a, b, fov0, fov1) => (f) => {
  const u = M.smooth(ramp(f, a, b));
  const w0 = (1 - u) ** 3, w1 = 3 * (1 - u) ** 2 * u, w2 = 3 * (1 - u) * u * u, w3 = u ** 3;
  const mix = (Q) => [0, 1, 2].map((j) => w0 * Q[0][j] + w1 * Q[1][j] + w2 * Q[2][j] + w3 * Q[3][j]);
  return { pos: mix(P), look: mix(L), fov: lerp(fov0, fov1, u), roll: 0 };
};
const RIG_BY_ID = {
  drone: { cut: 'hard', raw: bezierCam(
    [[18, 13, -22], [12, 8, -15], [8.5, 4.5, -9], [6.8, 3.2, -5.5]],
    [[0, 3.2, 11], [0, 2.4, 9], [-0.5, 1.4, 7.2], [-0.8, 1.2, 6.8]], 0, 199, 44, 40) },
  dialogue1: { cut: 'hard', raw: pushInCam({ subject: oldManPos, a: 200, b: 357, d0: 5.4, d1: 4.1, h0: 1.55, h1: 1.45, lookOff: [0, 1.35, 0], fov0: 40, fov1: 34,
    dir: () => [0.55, -0.83] }) },
  follow: { cut: 'hard', raw: keysCam({ keys: [
    { f: 358, pos: [6.6, 2.7, -1.5], look: [0, 1.1, 6.5], fov: 42 },
    { f: 501, pos: [5.9, 2.5, -0.6], look: [0, 1.1, 6.4], fov: 39, ease: 'surge' }] }) },
  row: { cut: 'hard', raw: pushInCam({ subject: boatPos, a: 502, b: 671, d0: 6.2, d1: 4.6, h0: 1.8, h1: 1.55, lookOff: [0, 0.5, 0], fov0: 38, fov1: 33,
    dir: () => [0.62, 0.78] }) },
  glow: { cut: 'hard', raw: staticTrackCam({ pos: [-3.2, 1.5, -4.2], subject: lanternPos, lookOff: [0, 0.1, 0], fov: 44 }) },
  leap1: { cut: 'hard', raw: pushInCam({ subject: boatPos, a: 780, b: 883, d0: 7.0, d1: 6.0, h0: 1.8, h1: 1.6, lookOff: [-0.3, 0.35, 0], fov0: 46, fov1: 42,
    dir: () => [0.6, 0.8] }) },
  leapmany: { cut: 'hard', raw: keysCam({ keys: [
    { f: 884, pos: [7.0, 2.9, -5.0], look: [-0.2, 0.3, -8], fov: 48 },
    { f: 1055, pos: [6.4, 2.7, -4.4], look: [-0.2, 0.3, -8], fov: 44, ease: 'surge' }] }) },
  hold: { cut: 'hard', raw: staticTrackCam({ pos: [-3.8, 2.0, -3.4], subject: boatPos, lookOff: [0, 0.55, 0], fov: 38 }) },
  dialogue2: { cut: 'hard', raw: pushInCam({ subject: oldManPos, a: 1184, b: 1358, d0: 4.4, d1: 3.7, h0: 1.6, h1: 1.5, lookOff: [0, 1.35, 0], fov0: 36, fov1: 32,
    dir: () => [0.5, 0.86] }) },
  hookq: { cut: 'blend', blend: 10, raw: keysCam({ keys: [
    { f: 1359, pos: [4.4, 2.9, -4.2], look: [0, 2.9, 10.9], fov: 40 },
    { f: 1466, pos: [4.7, 3.1, -1.2], look: [0, 3.0, 10.95], fov: 37, ease: 'surge' }] }) },
  hook: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1467, pos: [4.7, 3.1, -1.2], look: [0, 3.0, 10.95], fov: 37 },
    { f: 1511, pos: [4.5, 3.15, -1.4], look: [0, 3.05, 10.95], fov: 36, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: 850, a: 0.03 }, { f: 938, a: 0.03 }, { f: 1024, a: 0.03 }],
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
  if (['leap1', 'leapmany', 'dialogue1', 'dialogue2', 'glow'].includes(S.id)) cinf = 3.6;
  if (S.id === 'hook') cinf = 3.0;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f), b = boatAt(f), bk = basketAt(f), L = lanternAt(f);
  const W = {
    boardTitle: 0, boardHook: 0,
    boatX: b.x, boatY: b.y, boatZ: b.z, boatRow: b.rowing,
    lanternX: L.x, lanternY: L.y, lanternZ: L.z, lanternGlow: lanternGlowAt(f),
    basketX: bk.x, basketY: bk.y, basketZ: bk.z, basketLift: bk.y - 0.1,
    dustK: 0.05,
  };
  if (S.id === 'drone') W.boardTitle = smooth(ramp(f, 24, 38)) * (1 - smooth(ramp(f, 54, 68)));
  if (S.id === 'hookq') W.boardHook = smooth(ramp(f, 1400, 1424));
  if (S.id === 'hook') W.boardHook = 1;   // held at FULL opacity to the literal last frame
  return W;
};
export const fxProfileAt = (f) => {
  const splash = splashAt(f).reduce((a, s) => a + s.k, 0);
  return { smokeRate: 0.05, dustRate: 0.05, splashRate: Math.min(1, splash), steamRate: 0, shimmerRate: lanternGlowAt(f), grey: 0 };
};
export const fxAt = () => [];

// ---------- cast (single source for actors AND colliders) ----------
const TINT = { night: '#c9d4ea' };
const tintFor = (S) => TINT[S.light] || '#ffffff';
export const OUTFITS = {
  oldman: { jacket: '#6a5a48', pants: '#4a4038', boots: '#2c241c', hat: 'cap', cap: '#5a4a38', hair: '#c8c0b0', skin: '#c98a5a', moustache: '#d8d0c0' },
  fish1: { jacket: '#3a5a6e', pants: '#2c3242', boots: '#1c1712', hat: 'cap', cap: '#2c4a3a', skin: '#a06a3c' },
  fish2: { jacket: '#5a4a3a', pants: '#33302c', boots: '#241a12', hat: 'cap', cap: '#6e3a2c', skin: '#c98a5a' },
  fish3: { jacket: '#4a5a3a', pants: '#2a3242', boots: '#1c1712', hat: 'cap', cap: '#3a3a4a', skin: '#8a5a34', moustache: '#241a12' },
};
const FISHERMEN = [
  { id: 'fish1', o: 'fish1', x: 2.8, z: 6.2, yaw: -0.9, seed: 71 },
  { id: 'fish2', o: 'fish2', x: 4.6, z: 7.2, yaw: -0.7, seed: 72 },
  { id: 'fish3', o: 'fish3', x: -4.2, z: 6.6, yaw: 0.9, seed: 73 },
];
export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, y, z, extra = {}) => out.push({ id, x, y, z, r: 0.32, ground: y,
    actor: (T) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x, y, z, ground: y, tint, ...extra }) });
  const om = oldManPos(f), inBoat = f >= 502;
  const omBase = { expr: 'smile', mode: inBoat ? 'sit' : 'stand', blink: blinkAt(f, 31), seed: 31 };
  switch (S.id) {
    case 'drone': {
      std('oldman', OUTFITS.oldman, { ...omBase }, om[0], om[1], om[2], { yaw: 0.6 });
      for (const fm of FISHERMEN) std(fm.id, OUTFITS[fm.o], { expr: 'laugh', mode: 'stand', blink: blinkAt(f, fm.seed), seed: fm.seed }, fm.x, 0, fm.z, { yaw: fm.yaw });
      break;
    }
    case 'dialogue1': {
      // THE dialogue beat: the old man PERFORMS his bet — mouth driven by
      // the stem inside the speak segments, closed outside them.
      std('oldman', OUTFITS.oldman, { mode: 'stand', blink: blinkAt(f, 31), seed: 31, look: 0.15, ...speakFace('smile', f) }, om[0], om[1], om[2], { yaw: 0.55 });
      break;
    }
    case 'follow': {
      std('oldman', OUTFITS.oldman, { ...omBase }, om[0], om[1], om[2], { yaw: 0.6 });
      for (const fm of FISHERMEN) std(fm.id, OUTFITS[fm.o], { expr: 'laugh', mode: 'stand', blink: blinkAt(f, fm.seed), seed: fm.seed, prop: ['point', 0.55] }, fm.x, 0, fm.z, { yaw: fm.yaw });
      break;
    }
    case 'row': {
      std('oldman', OUTFITS.oldman, { ...omBase, expr: 'neutral' }, om[0], om[1], om[2], { yaw: 0.4 });
      break;
    }
    case 'glow': {
      std('oldman', OUTFITS.oldman, { ...omBase, expr: 'neutral' }, om[0], om[1], om[2], { yaw: 0.4 });
      break;
    }
    case 'leap1': case 'leapmany': {
      std('oldman', OUTFITS.oldman, { ...omBase, expr: 'smile' }, om[0], om[1], om[2], { yaw: 0.4 });
      break;
    }
    case 'hold': {
      std('oldman', OUTFITS.oldman, { ...omBase, expr: 'smile' }, om[0], om[1], om[2], { yaw: 0.4 });
      for (const fm of FISHERMEN) std(fm.id, OUTFITS[fm.o], { expr: 'shock', mode: 'stand', blink: blinkAt(f, fm.seed), seed: fm.seed }, fm.x, 0, fm.z, { yaw: fm.yaw });
      break;
    }
    case 'dialogue2': {
      // THE payoff line, performed: mouth driven by the stem; the basket
      // lifts in his hands as he says it (basketAt handles the prop).
      std('oldman', OUTFITS.oldman, { mode: 'sit', blink: blinkAt(f, 31), seed: 31, look: 0.15, ...speakFace('smile', f) }, om[0], om[1], om[2], { yaw: 0.45 });
      break;
    }
    case 'hookq': case 'hook': break;
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity: statics, dynamics, ground (LIBRARY v3 gate data) ----------
export const STATICS = [
  SOL.aabb(QUAY.x0, QUAY.x1, 3.5, 4.0, { h: 0.35, id: 'quayedge' }),
  SOL.aabb(HOUSES.x0, HOUSES.x1, HOUSES.z0, HOUSES.z1, { h: 6, id: 'houses' }),
  SOL.circle(LAMP1.x, LAMP1.z, 0.12, { h: 3, id: 'lamp1' }),
  SOL.circle(LAMP2.x, LAMP2.z, 0.12, { h: 3, id: 'lamp2' }),
  SOL.circle(CRATE1.x, CRATE1.z, 0.5, { h: 0.8, id: 'crate1' }),
  SOL.circle(CRATE2.x, CRATE2.z, 0.5, { h: 0.8, id: 'crate2' }),
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
  const bk = basketAt(f);
  // the basket is ground-checked only while it RESTS on the quay; in the
  // boat it is held (lap / lifted) and transitional, like a carried prop.
  if (bk.resting) items.push({ id: 'basket', y: bk.y, ground: 0, maxHover: 0.03 });
  for (const a of castAt(f)) items.push({ id: a.id, y: a.y, ground: a.ground, maxHover: 0.06 });
  return items;
};
