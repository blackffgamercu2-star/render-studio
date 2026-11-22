// Shot plan for "The Shepherd Who Counted His Flock and Found One
// Too Many" — built on the charfix-proof painter (Abid's Character
// Fix Round 2: fingered hands drawHand/drawGrip/drawPinch, the new
// walk cycle, limb volume, cinematic grade in the ink pass).
// A young shepherd is mocked by the proud head shepherd: "You can't
// even count your own sheep." One evening he counts his 100 sheep
// through the narrow gate — and finds 101. The village laughs. His
// plan, SHOWN in steps: (1) next dusk he chalks a white stripe on
// every sheep's back at the gate; (2) he counts the striped sheep in
// the pen — exactly 100; (3) he searches for the one WITHOUT a
// stripe. Payoff: the unstriped "sheep" is a wolf in a sheepskin
// that slips in with the flock at dusk. The head shepherd admits it
// before the village. ONE set (hillside + sheep pen + gate),
// DAYLIGHT throughout. Performed dialogue ONLY mid-script: L3 (the
// mock) and L15 (the admission); the final line is narration over
// the hook board "HE COUNTED / ONE TOO MANY", teasing the fisherman
// who sold the same fish twice.
// Exactly 60.000 s / 1800 frames @30 fps. Shots cut ONLY on voice
// lines (stem = voice_final.wav, timing.json; atempo 1.1918 after a
// disclosed 0.22 s pause cap — see STAGING.md):
//   L1 f0-97 · L2 f101-181 · L3 f185-257 (ELDER dialogue) ·
//   L4 f262-403 · L5 f407-509 · L6 f513-607 · L7 f611-732 ·
//   L8 f736-841 · L9 f845-972 · L10 f977-1085 · L11 f1089-1195 ·
//   L12 f1199-1298 · L13 f1302-1394 · L14 f1398-1524 ·
//   L15 f1529-1599 (ELDER dialogue) · L16 f1603-1686 · L17 f1690-1798.
import { M, blinkAt, q, clamp, lerp, ramp, kf, walk } from './motion.js';
import { buildRig, pushInCam, keysCam } from './camrig.js';
import * as SOL from './solid.js';
import * as T from './toon.js';
import * as SPK from './speak.js';
import { SPEAK_DATA } from './speakdata.js';

export const FPS = 30, TOTAL = 1800, DECK = 0;
const SPEAK = SPK.makeSpeakPlayer(SPEAK_DATA);
export const SHOTS = [
  { id: 's01a', a: 0, b: 48, light: 'day' },
  { id: 's01b', a: 49, b: 97, light: 'day' },
  { id: 's02', a: 98, b: 181, light: 'day' },
  { id: 's03a', a: 182, b: 219, light: 'day' },
  { id: 's03b', a: 220, b: 258, light: 'day' },
  { id: 's04a', a: 259, b: 330, light: 'day' },
  { id: 's04b', a: 331, b: 403, light: 'day' },
  { id: 's05', a: 404, b: 509, light: 'day' },
  { id: 's06', a: 510, b: 607, light: 'day' },
  { id: 's07a', a: 608, b: 668, light: 'day' },
  { id: 's07b', a: 669, b: 732, light: 'day' },
  { id: 's08', a: 733, b: 841, light: 'day' },
  { id: 's09a', a: 842, b: 910, light: 'day' },
  { id: 's09b', a: 911, b: 973, light: 'day' },
  { id: 's10', a: 974, b: 1085, light: 'day' },
  { id: 's11', a: 1086, b: 1195, light: 'day' },
  { id: 's12', a: 1196, b: 1298, light: 'day' },
  { id: 's13a', a: 1299, b: 1345, light: 'day' },
  { id: 's13b', a: 1346, b: 1394, light: 'day' },
  { id: 's14a', a: 1395, b: 1458, light: 'day' },
  { id: 's14b', a: 1459, b: 1525, light: 'day' },
  { id: 's15a', a: 1526, b: 1562, light: 'day' },
  { id: 's15b', a: 1563, b: 1599, light: 'day' },
  { id: 's16', a: 1600, b: 1686, light: 'day' },
  { id: 's17', a: 1687, b: 1799, light: 'day' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights: ONE vivid daylight grade ----------
export const LIGHTS = {
  day: { az: 218, el: 46, sky: '#ffe9bb', ground: '#5d7a3a', hemi: 1.05, sun: '#ffdca3', sunI: 2.55, fog: '#d9e6bd', fogNear: 55, fogFar: 380,
    skyTop: '#2f62b0', skyHor: '#f2d492', sunDisc: '#fff0bc', sunSize: 0.0042, sat: 1.14, vig: 0.24, shadowExt: 34, aurora: 0, gain: '#fff0cd', waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

// ---------- staging ----------
export const BOARD_POS = [4.6, 0.98, 3.8];
export const BOARD_RY = 0.65;
export const GATE = { x: 2.0, z: -2.8 };            // the narrow gate (east fence)
const BOY_GATE = { x: 2.45, z: -2.02 };             // the boy's counting post
const WOLF_SLOT = { x: -5.3, z: -6.25 };           // the pen's far NW corner

// deterministic per-sheep variation
const srand = (seed) => { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

// ---------- the flock model (single source for main.js) ----------
// 100 sheep + 1 wolf. Each sheep: a hillside queue spot, a pen slot,
// and two homecoming streams (evening 1 = the count, evening 2 = the
// chalking). Movement is arc-length along a fixed polyline at a
// constant speed, so feet never slide and the gate crossings land on
// the narration's numbers.
const SHEEP_N = 100;
const SLOTS = [], QUEUE = [], CROSS1 = [], CROSS2 = [], SCALES = [], SLOTRY = [];
{
  const R = srand(7101);
  for (let i = 0; i < SHEEP_N; i++) {
    const col = i % 10, row = (i / 10) | 0;
    SLOTS.push({ x: -5.0 + col * 0.70 + (R() - 0.5) * 0.30, z: -6.3 + row * 0.70 + (R() - 0.5) * 0.30 });
    SLOTRY.push(R() * Math.PI * 2);
    QUEUE.push({ x: 8.3 + (i % 10) * 0.47 + (R() - 0.5) * 0.3, z: -4.95 + ((i / 10) | 0) * 0.46 + (R() - 0.5) * 0.3 });
    SCALES.push(0.9 + R() * 0.22);
    CROSS1.push(14 + i * 3.7);
    CROSS2.push(612 + i * 2.2);
  }
}
const pathFor = (i) => [QUEUE[i], { x: 5.2, z: -2.8 }, { x: GATE.x, z: GATE.z }, { x: 0.55, z: -2.92 }, SLOTS[i]];
const pathLen = (pts) => { const L = [0]; for (let k = 1; k < pts.length; k++) L.push(L[k - 1] + Math.hypot(pts[k].x - pts[k - 1].x, pts[k].z - pts[k - 1].z)); return L; };
const pathAt = (pts, L, s) => {
  if (s <= 0) return { x: pts[0].x, z: pts[0].z, ry: Math.atan2(pts[1].x - pts[0].x, pts[1].z - pts[0].z), mv: 0 };
  const tot = L[L.length - 1];
  if (s >= tot) { const a = pts[pts.length - 2], b = pts[pts.length - 1]; return { x: b.x, z: b.z, ry: Math.atan2(b.x - a.x, b.z - a.z), mv: 0 }; }
  let k = 1; while (L[k] < s) k++;
  const u = (s - L[k - 1]) / (L[k] - L[k - 1]);
  return { x: lerp(pts[k - 1].x, pts[k].x, u), z: lerp(pts[k - 1].z, pts[k].z, u), ry: Math.atan2(pts[k].x - pts[k - 1].x, pts[k].z - pts[k - 1].z), mv: 1 };
};
const PATHS = [], PLENS = [], GATEARC = [];
for (let i = 0; i < SHEEP_N; i++) {
  const p = pathFor(i), L = pathLen(p);
  PATHS.push(p); PLENS.push(L);
  GATEARC.push(L[2]); // arc length at the gate point (path index 2)
}
const streamPos = (i, f, cross, speed) => {
  const start = cross[i] - GATEARC[i] / speed;
  return pathAt(PATHS[i], PLENS[i], (f - start) * speed);
};
// the wolf's own paths: evening 1 it walks in WITH the flock, last of
// all (crossing the gate at f388, on "and one more"); evening 2 it
// never uses the gate — it slinks along the OUTSIDE of the north
// fence and slips through the broken rails into its corner.
const WOLF_QUEUE = { x: 10.6, z: -3.4 };
const WOLF_PATH1 = [WOLF_QUEUE, { x: 5.2, z: -2.8 }, { x: GATE.x, z: GATE.z }, { x: 0.55, z: -2.92 }, WOLF_SLOT];
const WOLF_L1 = pathLen(WOLF_PATH1);
const WOLF_CROSS1 = 388, WOLF_SPEED1 = 0.10;
const WOLF_PATH2 = [{ x: 9.6, z: -8.7 }, { x: 2.0, z: -8.7 }, { x: -5.55, z: -8.55 }, { x: -5.58, z: -7.6 }, WOLF_SLOT];
const WOLF_L2 = pathLen(WOLF_PATH2);
const wolfPosAt = (f) => {
  if (f < 404) { // evening 1: in with the flock, last
    const start = WOLF_CROSS1 - WOLF_L1[2] / WOLF_SPEED1;
    return { ...pathAt(WOLF_PATH1, WOLF_L1, (f - start) * WOLF_SPEED1), wolf: 1 };
  }
  if (f < 608) return { x: WOLF_SLOT.x, z: WOLF_SLOT.z, ry: 0.74, mv: 0, wolf: 1 }; // pen, evening 1 done
  if (f < 690) return { x: 9.6, z: -8.7, ry: -Math.PI / 2, mv: 0, wolf: 1 };        // evening 2: waiting beyond the hill
  if (f < 842) { // the slink along the north fence, f690-825
    const tot = WOLF_L2[WOLF_L2.length - 1];
    return { ...pathAt(WOLF_PATH2, WOLF_L2, (f - 690) * (tot / 135)), wolf: 1 };
  }
  if (f < 1600) { // in its corner; a slow prowl during L14
    const prowl = f >= 1395 && f <= 1525;
    return { x: WOLF_SLOT.x + (prowl ? Math.sin((f - 1395) * 0.021) * 0.55 : 0),
      z: WOLF_SLOT.z + (prowl ? Math.cos((f - 1395) * 0.017) * 0.3 : 0),
      ry: 0.74 + (prowl ? Math.sin((f - 1395) * 0.021 + 1.2) * 0.4 : 0), mv: 0, wolf: 1 };
  }
  // L16: driven out — corner -> gate -> up the lane and away
  const P3 = [WOLF_SLOT, { x: -1.5, z: -3.1 }, { x: GATE.x, z: GATE.z }, { x: 6.0, z: -2.8 }, { x: 11.5, z: -3.3 }, { x: 16.5, z: -4.2 }];
  const L3 = pathLen(P3), tot = L3[L3.length - 1];
  return { ...pathAt(P3, L3, (f - 1606) * (tot / 76)), wolf: 1 };
};
export const flockAt = (f) => {
  const out = [];
  const boy = boyAt(f);
  for (let i = 0; i < SHEEP_N; i++) {
    let p;
    if (f < 404) p = streamPos(i, f, CROSS1, 0.10);
    else if (f < 608) p = { x: SLOTS[i].x, z: SLOTS[i].z, ry: SLOTRY[i], mv: 0 };
    else if (f < 842) p = streamPos(i, f, CROSS2, 0.13);
    else p = { x: SLOTS[i].x, z: SLOTS[i].z, ry: SLOTRY[i], mv: 0 };
    let { x, z, ry } = p;
    // the search (L11): sheep shuffle aside as the boy parts the wool
    if (f >= 1086 && f <= 1195) {
      const dx = x - boy.x, dz = z - boy.z, d = Math.hypot(dx, dz);
      if (d < 1.15 && d > 0.01) { const push = (1.15 - d) * 0.34; x += (dx / d) * push; z += (dz / d) * push; }
    }
    out.push({ x, z, ry, s: SCALES[i], mv: p.mv, stripe: f >= 608 && f >= CROSS2[i] ? 1 : 0, graze: p.mv ? 0.12 : 0.5 + 0.5 * Math.sin(f * 0.021 + i * 1.93), wolf: 0 });
  }
  const w = wolfPosAt(f);
  out.push({ x: w.x, z: w.z, ry: w.ry, s: 1.16, mv: w.mv, stripe: 0, graze: 0.3, wolf: 1 });
  return out;
};

// walk helper: ONE M.walk call drives BOTH the position along a
// segment and the bodyFront march phase — feet can never slide.
const walkAlong = (f, f0, from, to, speed, stride) => {
  const dx = to[0] - from[0], dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  const wk = walk(f, f0, speed, stride);
  const d = Math.min(wk.dist, len);
  const u = len ? d / len : 0;
  return { x: from[0] + dx * u, z: from[1] + dz * u, phase: wk.phase, moving: f >= f0 && wk.dist < len };
};
const walkChain = (f, legs) => {
  for (const [f0, from, to, sp, st] of legs) {
    const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
    if (f < f0 + (len / sp) * 30 + 2) return walkAlong(f, f0, from, to, sp, st);
  }
  const last = legs[legs.length - 1];
  return { x: last[2][0], z: last[2][1], phase: 0, moving: false };
};

// ---------- actor anchors (single source; checked against STATICS) ----------
export function boyAt(f) {
  const S = shotAt(f);
  switch (S.id) {
    case 's02': { const w = walkAlong(f, 100, [5.7, -1.55], [2.75, -1.95], 1.15, 0.72); return { x: w.x, z: w.z, phase: w.phase, moving: w.moving }; }
    case 's05': return { x: 0.2, z: -0.7 };
    case 's06': {
      // routed THROUGH the gate gap along its centre line z=-2.8
      // (the gate posts + fence corners leave a 0.38-wide safe
      // corridor for the boy's centre): post -> south to the lane ->
      // west through the gate -> the stray lamb -> carry it back to
      // just inside the gate -> chalk in hand for the last frames
      if (f < 559) return walkChain(f, [
        [512, [BOY_GATE.x, BOY_GATE.z], [BOY_GATE.x, -2.8], 1.9, 0.8],
        [525, [BOY_GATE.x, -2.8], [1.55, -2.85], 1.9, 0.8],
        [540, [1.55, -2.85], [1.35, -1.7], 1.9, 0.8],
      ]);
      if (f < 567) return { x: 1.35, z: -1.7 };
      if (f < 602) { const w = walkAlong(f, 567, [1.35, -1.7], [1.5, -2.65], 1.05, 0.7); return { x: w.x, z: w.z, phase: w.phase, moving: w.moving }; }
      return { x: 1.5, z: -2.65 };
    }
    case 's10': {
      if (f < 1038) return walkChain(f, [
        [982, [BOY_GATE.x, BOY_GATE.z], [BOY_GATE.x, -2.8], 1.7, 0.78],
        [997, [BOY_GATE.x, -2.8], [0.2, -2.6], 1.7, 0.78],
      ]);
      return { x: 0.2, z: -2.6 };
    }
    case 's11': return walkChain(f, [
      [1090, [0.2, -2.6], [-1.6, -3.4], 1.05, 0.72],
      [1142, [-1.6, -3.4], [-3.2, -4.9], 1.05, 0.72],
      [1192, [-3.2, -4.9], [-4.35, -5.5], 1.05, 0.72],
    ]);
    case 's12': return { x: -4.35, z: -5.5 };
    case 's13a': { const w = walkAlong(f, 1302, [-4.35, -5.5], [-4.62, -5.68], 0.9, 0.66); return { x: w.x, z: w.z, phase: w.phase, moving: w.moving }; }
    case 's13b': { const w = walkAlong(f, 1346, [-4.62, -5.68], [-3.6, -6.3], 1.1, 0.75); return { x: w.x, z: w.z, phase: w.phase, moving: w.moving }; }
    case 's14a': case 's14b': return { x: -4.45, z: -5.35 };
    case 's15a': case 's15b': return { x: -0.95, z: 2.25 };
    case 's16': return { x: 3.05, z: -1.4 };
    case 's17': return { x: 3.85, z: 4.5 };
    default: return { x: BOY_GATE.x, z: BOY_GATE.z };
  }
}
export const elderAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 's01a': case 's01b': return { x: 7.8, z: -1.35 };
    case 's02': { const w = walkAlong(f, 118, [7.8, -1.35], [3.85, -1.62], 1.9, 0.8); return { x: w.x, z: w.z, phase: w.phase, moving: w.moving }; }
    case 's03a': case 's03b': case 's04a': case 's04b': return { x: 3.85, z: -1.62 };
    case 's05': case 's06': case 's10': case 's11': case 's12': case 's13a': case 's13b': case 's14a': case 's14b': return { x: 1.95, z: 1.75 };
    case 's15a': case 's15b': return { x: 0.05, z: 2.95 };
    case 's16': return { x: 3.65, z: -4.25 };
    case 's17': return { x: 3.4, z: 3.5 };
    default: return { x: 3.85, z: -1.62 };
  }
};
export const villagerAAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 's05': return { x: -2.2, z: 2.45 };
    case 's06': case 's10': return { x: -0.65, z: 1.8 };
    case 's15a': case 's15b': return { x: 1.15, z: 3.35 };
    case 's16': return { x: 6.3, z: -0.9 };
    case 's17': return { x: 3.3, z: 5.2 };
    default: return { x: -7.4, z: 5.1 };
  }
};
export const villagerBAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 's05': case 's06': case 's10': return { x: 0.95, z: 1.9 };
    case 's15a': case 's15b': return { x: -1.85, z: 3.05 };
    case 's16': return { x: 4.65, z: -4.65 };
    case 's17': return { x: 6.2, z: 4.3 };
    default: return { x: -6.1, z: 6.1 };
  }
};

// ---------- hero / focus ----------
const FOCUS = {
  s01a: () => [2.5, 0.8, -3],
  s01b: () => [BOY_GATE.x, 1.25, BOY_GATE.z],
  s02: () => { const b = boyAt(140); return [b.x, 1.25, b.z]; },
  s03a: () => [4.35, 1.5, -1.5],
  s03b: () => [3.4, 1.35, -1.75],
  s04a: () => [GATE.x, 0.9, GATE.z],
  s04b: () => [BOY_GATE.x, 1.25, BOY_GATE.z],
  s05: () => [0.2, 1.1, 0.6],
  s06: () => { const b = boyAt(555); return [b.x, 1.1, b.z]; },
  s07a: () => [GATE.x + 0.3, 0.85, GATE.z],
  s07b: () => [1.2, 0.8, -2.9],
  s08: () => [GATE.x, 0.9, GATE.z],
  s09a: () => [-2, 0.4, -3.2],
  s09b: () => [-2, 0.4, -3.2],
  s10: () => [0.2, 1.25, -2.6],
  s11: () => { const b = boyAt(1140); return [b.x, 1.2, b.z]; },
  s12: () => [WOLF_SLOT.x, 0.75, WOLF_SLOT.z],
  s13a: () => [WOLF_SLOT.x, 0.8, WOLF_SLOT.z],
  s13b: () => [WOLF_SLOT.x, 0.85, WOLF_SLOT.z],
  s14a: () => [WOLF_SLOT.x, 0.8, WOLF_SLOT.z],
  s14b: () => [-4.9, 0.95, -5.9],
  s15a: () => [0.05, 1.5, 2.95],
  s15b: () => [-0.45, 1.35, 2.6],
  s16: () => [GATE.x + 1, 0.9, GATE.z],
  s17: () => [BOARD_POS[0], 1.0, BOARD_POS[2]],
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id]();

// ---------- cameras (the raised bar: EVERY sub-shot travels) ----------
// Pen x[-6,2] z[-7,0.5]; gate in the east fence at z=-2.8; the lane
// runs east to the hillside queue; the village huts sit south-west;
// the hook board stands south-east of the pen.
const boyPos = (f) => { const a = boyAt(f); return [a.x, 0, a.z]; };
const elderPos = (f) => { const a = elderAt(f); return [a.x, 0, a.z]; };
const RIG_BY_ID = {
  s01a: { cut: 'hard', raw: keysCam({ keys: [
    { f: 0, pos: [10.5, 6.5, 7.5], look: [0, 0.8, -3], fov: 42 },
    { f: 48, pos: [7.5, 4.2, 4.2], look: [0.4, 0.85, -3], fov: 38, ease: 'surge' }] }) },
  s01b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 49, pos: [6.4, 2.6, 2.6], look: [2.45, 1.2, -2.02], fov: 37 },
    { f: 97, pos: [5.2, 2.1, 1.2], look: [2.45, 1.22, -2.02], fov: 33, ease: 'surge' }] }) },
  s02: { cut: 'hard', raw: pushInCam({ subject: boyPos, a: 98, b: 181, d0: 3.6, d1: 3.0, h0: 1.72, h1: 1.62, lookOff: [0, 1.28, 0], fov0: 36, fov1: 33, dir: [0.55, 0.83] }) },
  s03a: { cut: 'hard', raw: pushInCam({ subject: elderPos, a: 182, b: 219, d0: 3.2, d1: 2.6, h0: 1.66, h1: 1.6, lookOff: [0, 1.48, 0], fov0: 35, fov1: 31, dir: [0.3, 0.95] }) },
  s03b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 220, pos: [0.2, 2.05, 3.4], look: [3.15, 1.32, -1.85], fov: 40 },
    { f: 258, pos: [0.5, 1.95, 2.8], look: [3.15, 1.32, -1.85], fov: 38, ease: 'surge' }] }) },
  s04a: { cut: 'hard', raw: keysCam({ keys: [
    { f: 259, pos: [4.7, 1.62, 1.0], look: [2.05, 1.08, -2.8], fov: 38 },
    { f: 330, pos: [3.95, 1.66, -0.1], look: [2.05, 1.1, -2.8], fov: 35, ease: 'surge' }] }) },
  s04b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 331, pos: [4.6, 1.82, 0.6], look: [2.2, 1.15, -2.75], fov: 37 },
    { f: 403, pos: [4.0, 1.75, 0.0], look: [2.1, 1.12, -2.8], fov: 34, ease: 'surge' }] }) },
  s05: { cut: 'hard', raw: keysCam({ keys: [
    { f: 404, pos: [-5.5, 3.4, 6.8], look: [0, 0.9, -0.8], fov: 40 },
    { f: 509, pos: [5.0, 3.0, 6.2], look: [0.2, 0.9, -0.8], fov: 38, ease: 'smooth' }] }) },
  s06: { cut: 'hard', raw: pushInCam({ subject: boyPos, a: 510, b: 607, d0: 3.3, d1: 2.9, h0: 1.78, h1: 1.7, lookOff: [0, 1.22, 0], fov0: 37, fov1: 34, dir: [-0.8, 0.55] }) },
  s07a: { cut: 'hard', raw: keysCam({ keys: [
    { f: 608, pos: [4.6, 1.75, 1.1], look: [2.3, 1.12, -2.62], fov: 36 },
    { f: 668, pos: [4.2, 1.68, 0.6], look: [2.3, 1.12, -2.62], fov: 33, ease: 'surge' }] }) },
  s07b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 669, pos: [4.3, 1.7, 0.6], look: [0.8, 0.75, -2.9], fov: 37 },
    { f: 732, pos: [2.6, 1.6, -0.9], look: [0.8, 0.75, -2.9], fov: 34, ease: 'surge' }] }) },
  s08: { cut: 'hard', raw: keysCam({ keys: [
    { f: 733, pos: [6.8, 2.6, 2.2], look: [0.5, 0.8, -3.4], fov: 40 },
    { f: 841, pos: [5.6, 2.3, 1.2], look: [0.5, 0.8, -3.4], fov: 38, ease: 'surge' }] }) },
  // s09a: the DRONE count view — straight down the pen: 100 striped
  // backs in their rows, one dark corner with none.
  s09a: { cut: 'hard', raw: keysCam({ keys: [
    { f: 842, pos: [-1.2, 16.5, -1.4], look: [-2, 0, -3.4], fov: 33 },
    { f: 910, pos: [-2.6, 16.5, -2.2], look: [-2, 0, -3.4], fov: 33, ease: 'smooth' }] }) },
  // DOLLY ZOOM A — the drone dives 16.5 -> 10 while the lens opens
  // 33 -> 48: the flock holds its size, the pen warps around it.
  s09b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 911, pos: [-2.6, 16.5, -2.2], look: [-2, 0.3, -3.2], fov: 33 },
    { f: 973, pos: [-2.2, 10.0, -2.9], look: [-2, 0.3, -3.2], fov: 48, ease: 'smooth' }] }) },
  s10: { cut: 'hard', raw: keysCam({ keys: [
    { f: 974, pos: [4.9, 2.0, 1.5], look: [2.62, 1.25, -2.1], fov: 37 },
    { f: 1016, pos: [3.9, 1.95, 0.7], look: [1.82, 1.22, -2.62], fov: 35, ease: 'smooth' },
    { f: 1038, pos: [3.3, 1.9, 0.3], look: [0.2, 1.22, -2.6], fov: 34 },
    { f: 1085, pos: [3.0, 1.85, 0.1], look: [0.2, 1.22, -2.6], fov: 33 }] }) },
  s11: { cut: 'hard', raw: pushInCam({ subject: boyPos, a: 1086, b: 1195, d0: 3.1, d1: 2.8, h0: 1.82, h1: 1.72, lookOff: [0, 1.2, 0], fov0: 37, fov1: 34, dir: [0.72, 0.69] }) },
  s12: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1196, pos: [-1.5, 2.3, -2.2], look: [-4.95, 0.95, -6.25], fov: 38 },
    { f: 1298, pos: [-1.7, 2.15, -2.5], look: [-4.95, 0.95, -6.25], fov: 33, ease: 'surge' }] }) },
  s13a: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1299, pos: [-2.55, 1.9, -3.4], look: [-5.0, 1.02, -6.3], fov: 38 },
    { f: 1345, pos: [-2.7, 1.85, -3.55], look: [-5.0, 1.02, -6.3], fov: 34, ease: 'surge' }] }) },
  // DOLLY ZOOM B — the fleece comes away: dolly IN on the wolf while
  // the lens opens 31 -> 47; boy + wolf hold their size, the pen
  // stretches behind them.
  s13b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1346, pos: [-2.9, 1.6, -3.3], look: [-5.25, 0.9, -6.2], fov: 34 },
    { f: 1394, pos: [-3.35, 1.5, -3.65], look: [-5.25, 0.9, -6.2], fov: 48, ease: 'smooth' }] }) },
  s14a: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1395, pos: [-1.9, 1.9, -3.1], look: [-5.3, 0.98, -6.4], fov: 36 },
    { f: 1458, pos: [-2.3, 1.85, -3.45], look: [-5.3, 0.98, -6.4], fov: 33, ease: 'surge' }] }) },
  s14b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1459, pos: [-2.5, 1.8, -3.3], look: [-4.95, 1.05, -6.0], fov: 35 },
    { f: 1525, pos: [-2.8, 1.75, -3.55], look: [-4.95, 1.05, -6.0], fov: 32, ease: 'surge' }] }) },
  s15a: { cut: 'hard', raw: pushInCam({ subject: elderPos, a: 1526, b: 1562, d0: 3.0, d1: 2.5, h0: 1.66, h1: 1.6, lookOff: [0, 1.45, 0], fov0: 34, fov1: 30, dir: [-0.75, 0.66] }) },
  s15b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1563, pos: [-3.6, 2.0, -0.6], look: [-0.5, 1.3, 2.65], fov: 36 },
    { f: 1599, pos: [-3.3, 1.95, -0.2], look: [-0.5, 1.3, 2.65], fov: 33, ease: 'surge' }] }) },
  s16: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1600, pos: [7.6, 2.4, 1.8], look: [2.3, 0.95, -2.7], fov: 39 },
    { f: 1686, pos: [6.9, 2.3, 1.15], look: [2.3, 0.95, -2.7], fov: 36, ease: 'surge' }] }) },
  s17: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1687, pos: [8.3, 2.4, 8.3], look: [4.6, 1.0, 3.8], fov: 47 },
    { f: 1799, pos: [8.55, 2.5, 8.55], look: [4.6, 1.0, 3.8], fov: 45, ease: 'surge' }] }) },
};
const RIG_SEGMENTS = SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] }));
const RIG = buildRig({ total: TOTAL, shots: RIG_SEGMENTS, kicks: [], sigma: 2.8, fovSigma: 1.6 });
export const camAt = (f) => ({ ...RIG.camAt(f), flash: 0 });
export const RIG_META = {
  kicks: RIG.declared.kicks, hardCuts: RIG.declared.hardCuts,
  blends: [], whips: RIG.declared.whips, samples: RIG.samples,
};
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), hp = heroPosAt(f);
  let cinf = 2.8;
  if (['s01a', 's05', 's08', 's16', 's17'].includes(S.id)) cinf = 1.3;
  if (['s07a', 's13a'].includes(S.id)) cinf = 3.8;
  if (['s09a', 's09b'].includes(S.id)) cinf = 0.8;
  if (['s09b', 's13b'].includes(S.id)) cinf = 2.4;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world dynamics ----------
export const dynAt = (f) => {
  const streaming = (f < 404) || (f >= 608 && f < 842);
  let gateOpen = streaming ? 1 : 0;
  if (f >= 1628 && f <= 1652) gateOpen = 1; // the wolf bursts out
  return {
    gateOpen,
    wolfFleece: smooth(ramp(f, 1332, 1364)), // 0 = sheepskin ON, 1 = slipped away
  };
};
export const worldAt = (f) => {
  const S = shotAt(f);
  return {
    always: 1,
    boardK: S.id === 's17' ? smooth(ramp(f, 1720, 1745)) : 0,
    ...dynAt(f),
  };
};
export const fxProfileAt = (f) => ({ moteRate: 0.05, blastRate: 0, sparkRate: 0, steamRate: 0, shimmerRate: 0 });
export const fxAt = () => [];

// ---------- cast ----------
const SKIN = '#ffe2c2'; // warmed so ballFill shading reads
export const OUTFITS = {
  boy: { build: 'kid', jacket: '#5d7a35', pants: '#4a3a2c', boots: '#241a12', hat: 'hair', hair: '#2c1c10', shirtFront: '#a9805a', skin: SKIN },
  elder: { build: 'stout', jacket: '#8a3324', pants: '#3a3230', boots: '#1c1410', hat: 'turban', shirtFront: '#e8dcc2', skin: SKIN, moustache: '#3a2a1a', bigMoustache: true },
  villagerA: { jacket: '#2e6e5e', pants: '#33413a', boots: '#1c1712', hat: 'cap', cap: '#f2c230', skin: SKIN },
  villagerB: { jacket: '#4a5d8a', pants: '#2e3242', boots: '#1c1712', hat: 'hair', hair: '#1c1410', skin: SKIN },
};
const TINT = { day: '#ffffff' };
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
const emoBoy = emoTrack('neutral', [[185, 'sad', 15], [331, 'determined', 12], [386, 'shock', 12], [407, 'sad', 12], [513, 'determined', 12], [608, 'smile', 12], [736, 'determined', 12], [1086, 'determined', 12], [1199, 'shock', 12], [1302, 'determined', 12], [1526, 'nervous', 12], [1603, 'grin', 12], [1687, 'smile', 12]]);
const emoElder = emoTrack('proud', [[182, 'smug', 12], [220, 'laugh', 15], [404, 'laugh', 15], [510, 'smug', 12], [974, 'stern', 12], [1196, 'nervous', 12], [1302, 'shock', 12], [1526, 'nervous', 12], [1558, 'pained', 15], [1600, 'stern', 12], [1687, 'smile_closed', 15]]);
const emoVill = emoTrack('smile', [[404, 'laugh', 15], [974, 'neutral', 12], [1302, 'shock', 12], [1526, 'smile', 12]]);
const micro = (f, seed) => 1.1 * Math.sin((f + seed * 5) * 0.037 + 1);
const head = (f, seed, tilt, look, lookY, facing = 0, squash = 0) => ({
  headTilt: q(tilt + micro(f, seed), 1), look: q(look, 2), lookY: q(lookY, 2), facing: q(facing, 2), squash: q(squash, 2),
});
const spk = (baseP, f) => {
  const s = SPEAK.at(f);
  if (!s.active) return { exprP: baseP, nod: 0 };
  return { exprP: SPK.applySpeak({ ...baseP }, s), nod: q(s.nod || 0, 2) };
};
const mv = (a) => (a && a.moving ? { mode: 'march', phase: q(a.phase || 0, 2) } : { mode: 'stand' });

export const castAt = (f) => {
  const S = shotAt(f), tint = TINT.day, out = [];
  const std = (id, o, opts, x, z, extra = {}) => out.push({ id, x, y: extra.y || 0, z, r: 0.32, ground: extra.ground || 0,
    actor: (T2) => ({ key: 'smx' + JSON.stringify(o) + JSON.stringify(opts) + (extra.y || 0),
      draw: (p) => { T2.bodyFront(p, o, opts); },
      x, y: extra.y || 0, z, ground: extra.ground || 0, tint, ...extra }) });
  const b = boyAt(f), e = elderAt(f), vA = villagerAAt(f), vB = villagerBAt(f);
  const BP = emoBoy.at(f), EP = emoElder.at(f), VP = emoVill.at(f);
  BP.blush = 0; EP.blush = 0; VP.blush = 0;
  const boy = (opts = {}, extra = {}) => std('boy', OUTFITS.boy, { expr: 'neutral', exprP: BP, blink: blinkAt(f, 31), seed: 31, ...mv(b), ...opts }, b.x, b.z, extra);
  const elder = (opts = {}, extra = {}) => std('elder', OUTFITS.elder, { expr: 'proud', exprP: EP, blink: blinkAt(f, 51), seed: 51, ...mv(e), ...opts }, e.x, e.z, extra);
  const villA = (opts = {}, extra = {}) => std('villagerA', OUTFITS.villagerA, { expr: 'smile', exprP: VP, blink: blinkAt(f, 41), seed: 41, ...opts }, vA.x, vA.z, extra);
  const villB = (opts = {}, extra = {}) => std('villagerB', OUTFITS.villagerB, { expr: 'smile', exprP: VP, blink: blinkAt(f, 61), seed: 61, ...opts }, vB.x, vB.z, extra);
  const countTap = ['count', q(0.5 + 0.3 * Math.sin(f * 0.21), 2)];
  const chalkStroke = ['chalk', q(0.45 + 0.35 * Math.sin(f * 0.5), 2)];
  switch (S.id) {
    case 's01a': case 's01b':
      boy({ prop: countTap, ...head(f, 31, 0.8, 0.3, 0.15) }, { yaw: 0.3 });
      elder({ prop: ['staff', 0.6], ...head(f, 51, -0.8, 0, 0) });
      break;
    case 's02':
      boy({ ...head(f, 31, 0.5, 0.2, 0.05) }, { yaw: 0.25 });
      elder({ prop: ['staff', 0.6], ...head(f, 51, -1.0, 0.2, 0) }, { yaw: 0.2 });
      break;
    case 's03a': case 's03b': {
      // the head shepherd's MOCK — performed dialogue (speak track, L3)
      const SM = spk(EP, f);
      elder({ expr: 'smug', exprP: SM.exprP, prop: ['staff', 0.75], ...head(f, 51, -2.0 + SM.nod, 0.25, 0.05, 0.25) }, { yaw: 0.25 });
      boy({ expr: 'sad', ...head(f, 31, 1.8, -0.3, 0.2, -0.3) }, { yaw: -0.3 });
      break;
    }
    case 's04a':
      boy({ prop: countTap, ...head(f, 31, 1.0, 0.35, 0.25) }, { yaw: 0.35 });
      elder({ prop: ['staff', 0.6], ...head(f, 51, -1.2, 0, 0) }, { yaw: 0.2 });
      break;
    case 's04b':
      boy({ expr: f >= 386 ? 'shock' : 'determined', prop: countTap, ...head(f, 31, f >= 386 ? 0.2 : 1.1, 0.3, 0.2) }, { yaw: 0.3 });
      elder({ prop: ['staff', 0.6], ...head(f, 51, -1.2, 0, 0) }, { yaw: 0.2 });
      break;
    case 's05':
      boy({ expr: 'sad', ...head(f, 31, 1.4, 0, 0.1) }, { yaw: 0.1 });
      elder({ expr: 'laugh', prop: ['point', 0.8], ...head(f, 51, Math.sin(f * 0.3) * 1.8, 0, -0.05) }, { yaw: -0.2 });
      villA({ expr: 'laugh', prop: ['clap', 0.8], ...head(f, 41, Math.sin(f * 0.34 + 1) * 1.6, 0, 0) }, { yaw: -0.15 });
      villB({ expr: 'laugh', prop: ['wave', 0.85], ...head(f, 61, Math.sin(f * 0.28 + 2) * 1.6, 0, 0) }, { yaw: 0.15 });
      break;
    case 's06':
      if (f < 559) boy({ ...head(f, 31, 0.7, 0.2, 0.1) }, { yaw: 0.2 });
      else if (f < 567) boy({ expr: 'determined', ...head(f, 31, 1.6, 0.1, 0.35) }, { yaw: 0.1 });
      else if (f < 602) boy({ expr: 'determined', prop: ['lamb', 0.6], ...head(f, 31, 0.9, 0.15, 0.2) }, { yaw: 0.15 });
      else boy({ expr: 'smile', prop: ['chalk', 0.6], ...head(f, 31, 0.8, 0.2, 0.1) }, { yaw: 0.2 });
      elder({ prop: ['staff', 0.6], ...head(f, 51, -0.8, 0, 0) }, { yaw: -0.2 });
      villA({ ...head(f, 41, 0.5, 0, 0) }, { yaw: -0.15 });
      villB({ ...head(f, 61, 0.5, 0, 0) }, { yaw: 0.15 });
      break;
    case 's07a':
      boy({ expr: 'smile', prop: chalkStroke, ...head(f, 31, 1.5, 0.3, 0.35) }, { yaw: 0.35 });
      break;
    case 's07b': case 's08':
      boy({ expr: 'determined', prop: chalkStroke, ...head(f, 31, 1.2, 0.3, 0.3) }, { yaw: 0.3 });
      elder({ prop: ['staff', 0.6], ...head(f, 51, -0.8, 0, 0) }, { yaw: -0.2 });
      break;
    case 's09a': case 's09b':
      boy({ prop: countTap, ...head(f, 31, 0.9, 0.3, 0.2) }, { yaw: 0.3 });
      break;
    case 's10':
      boy({ expr: 'determined', prop: ['point', 0.8], ...head(f, 31, 0.7, 0.2, 0.05) }, { yaw: 0.2 });
      elder({ expr: 'stern', prop: ['staff', 0.6], ...head(f, 51, -0.6, 0, 0) }, { yaw: -0.2 });
      villA({ ...head(f, 41, 0.5, 0, 0) }, { yaw: -0.15 });
      villB({ ...head(f, 61, 0.5, 0, 0) }, { yaw: 0.15 });
      break;
    case 's11':
      boy({ expr: 'determined', prop: ['staff', 0.55], ...head(f, 31, 1.1, 0.25, 0.25) }, { yaw: 0.25 });
      break;
    case 's12':
      boy({ expr: 'shock', prop: ['staff', 0.5], ...head(f, 31, 0.6, -0.3, 0.1, -0.35) }, { yaw: -0.35 });
      break;
    case 's13a':
      boy({ expr: 'determined', prop: ['staff', 0.5], ...head(f, 31, 1.0, -0.2, 0.2, -0.3) }, { yaw: -0.3 });
      break;
    case 's13b':
      boy({ expr: 'determined', prop: ['point', 0.85], ...head(f, 31, 1.2, -0.2, 0.3, -0.3) }, { yaw: -0.3 });
      break;
    case 's14a': case 's14b':
      boy({ expr: 'determined', prop: ['staff', 0.85], ...head(f, 31, 0.5, -0.25, 0.05, -0.3) }, { yaw: -0.3 });
      break;
    case 's15a': case 's15b': {
      // the head shepherd's ADMISSION — performed dialogue (speak track, L15)
      const SM = spk(EP, f);
      elder({ expr: 'nervous', exprP: SM.exprP, ...head(f, 51, 1.9 + SM.nod, -0.1, 0.12, -0.2) }, { yaw: -0.2 });
      boy({ expr: 'nervous', ...head(f, 31, 0.9, 0.25, 0.05) }, { yaw: 0.25 });
      villA({ ...head(f, 41, 0.6, 0, 0) }, { yaw: -0.2 });
      villB({ ...head(f, 61, 0.6, 0, 0) }, { yaw: 0.2 });
      break;
    }
    case 's16':
      boy({ expr: 'grin', prop: ['staff', 0.8], ...head(f, 31, 0.4, 0.3, 0) }, { yaw: 0.3 });
      elder({ expr: 'stern', prop: ['staff', 0.85], ...head(f, 51, -0.5, 0.3, 0) }, { yaw: 0.3 });
      villA({ expr: 'determined', prop: ['wave', 0.9], ...head(f, 41, Math.sin(f * 0.4) * 1.8, 0.2, 0) }, { yaw: 0.25 });
      villB({ expr: 'determined', prop: ['staff', 0.85], ...head(f, 61, -0.5, 0.3, 0) }, { yaw: 0.3 });
      break;
    case 's17':
      boy({ expr: 'smile', prop: ['wave', 0.8], ...head(f, 31, 0.5, 0, 0) }, { yaw: -0.15 });
      elder({ expr: 'smile_closed', ...head(f, 51, 0.8, 0, 0) }, { yaw: -0.25 });
      villA({ expr: 'smile', prop: ['clap', 0.8], ...head(f, 41, 0.5, 0, 0) }, { yaw: -0.3 });
      villB({ expr: 'smile', ...head(f, 61, 0.5, 0, 0) }, { yaw: 0.2 });
      break;
    default:
      boy({}); elder({});
  }
  return out;
};
export const actorsAt = (f, T2) => castAt(f).map((c) => c.actor(T2));

// ---------- solidity ----------
export const STATICS = [
  SOL.aabb(-6.2, 2.2, -7.08, -6.92, { h: 1.05, id: 'fenceN' }),
  SOL.aabb(-6.2, 2.2, 0.42, 0.58, { h: 1.05, id: 'fenceS' }),
  SOL.aabb(-6.08, -5.92, -7, 0.5, { h: 1.05, id: 'fenceW' }),
  SOL.aabb(1.92, 2.08, -7, -3.4, { h: 1.05, id: 'fenceE1' }),
  SOL.aabb(1.92, 2.08, -2.2, 0.5, { h: 1.05, id: 'fenceE2' }),
  SOL.circle(GATE.x, -3.4, 0.09, { h: 1.25, id: 'gatepost' }),
  SOL.circle(GATE.x, -2.2, 0.09, { h: 1.25, id: 'gatepost' }),
  SOL.aabb(-9.3, -7.7, 4.2, 6.0, { h: 2.2, id: 'hutA' }),
  SOL.aabb(-7.0, -5.4, 6.6, 8.2, { h: 2.2, id: 'hutB' }),
  SOL.circle(BOARD_POS[0], BOARD_POS[2], 0.3, { h: 1.9, id: 'boardstand' }),
  ...[[-7.6, -8.2], [9.8, -6.4], [11.5, 1.5]].map(([x, z]) => SOL.circle(x, z, 0.4, { h: 5, id: 'tree' })),
];
export const WORLD = SOL.makeWorld(STATICS);
export const dynamicsAt = (f) => castAt(f).map((a) => SOL.circle(a.x, a.z, a.r, { kind: 'dynamic', id: a.id }));
export const groundItemsAt = (f) => {
  const items = [];
  for (const a of castAt(f)) items.push({ id: a.id, y: a.y, ground: a.ground || 0, maxHover: 0.06 });
  return items;
};
