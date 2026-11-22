// Shot plan for "The Girl Who Carried Water in a Sieve" — built on
// the charfix-proof painter (Abid's Character Fix Round 2: fingered
// hands drawHand/drawGrip/drawPinch, the new walk cycle, limb
// volume, cinematic ACES + split-tone grade in the ink pass) +
// painter additions 'sieve' (two-handed rim carry: both palms cupped
// under the rim, fingertip caps over its front edge; states plain /
// leaking / clay+leaf lined / brim-full), 'clay', 'leaf' and
// 'potleak' (the potter's cracked prize pot).
// A poor girl's family pot has cracked; her only vessel is a woven
// sieve. The proud POTTER mocks her at his stall (performed dialogue,
// L3): "carry the whole river home in that sieve!" She dips it —
// every drop pours through, and the village women howl. Her plan,
// SHOWN in steps: (1) dig wet clay from the riverbank and smear the
// slip across the sieve's inside, sealing every hole; (2) press big
// green leaves into the wet clay; (3) set it in the sun till the
// clay skins over. Payoff: she dips gently and lifts — the water
// STAYS; she walks past the stall brim-full, not one drop lost. The
// potter snatches up his prize pot to show a real vessel — and its
// hidden crack pours over his own feet. He admits it (performed
// dialogue, L15). The final line is narration over the hook board
// "A SIEVE / THAT HELD WATER", teasing the tailor who sewed a coat
// for the wind. ONE set (village square + river bank + potter's
// stall), DAYLIGHT throughout. Performed dialogue ONLY mid-script:
// L3 (the mock) and L15 (the admission).
// Exactly 60.000 s / 1800 frames @30 fps. Shots cut ONLY on voice
// lines (stem = voice_final.wav, timing.json; pause-cap 0.22 s +
// disclosed atempo 1.1198 — see STAGING.md):
//   L1 f0-114 · L2 f118-230 · L3 f235-332 (POTTER dialogue) ·
//   L4 f336-443 · L5 f447-546 · L6 f550-652 · L7 f656-738 ·
//   L8 f742-832 · L9 f836-944 · L10 f948-1051 · L11 f1055-1150 ·
//   L12 f1154-1246 · L13 f1250-1368 · L14 f1372-1498 ·
//   L15 f1503-1580 (POTTER dialogue) · L16 f1584-1680 ·
//   L17 f1684-1798.
import { M, blinkAt, q, clamp, lerp, ramp, kf, walk } from './motion.js';
import { buildRig, pushInCam, keysCam } from './camrig.js';
import * as SOL from './solid.js';
import * as T from './toon.js';
import * as SPK from './speak.js';
import { SPEAK_DATA } from './speakdata.js';

export const FPS = 30, TOTAL = 1800, DECK = 0;
const SPEAK = SPK.makeSpeakPlayer(SPEAK_DATA);
export const SHOTS = [
  { id: 's01a', a: 0, b: 56, light: 'day' },
  { id: 's01b', a: 57, b: 117, light: 'day' },
  { id: 's02', a: 118, b: 233, light: 'day' },
  { id: 's03a', a: 234, b: 282, light: 'day' },
  { id: 's03b', a: 283, b: 335, light: 'day' },
  { id: 's04', a: 336, b: 446, light: 'day' },
  { id: 's05a', a: 447, b: 495, light: 'day' },
  { id: 's05b', a: 496, b: 549, light: 'day' },
  { id: 's06', a: 550, b: 655, light: 'day' },
  { id: 's07', a: 656, b: 741, light: 'day' },
  { id: 's08', a: 742, b: 835, light: 'day' },
  { id: 's09', a: 836, b: 947, light: 'day' },
  { id: 's10', a: 948, b: 1054, light: 'day' },
  { id: 's11', a: 1055, b: 1153, light: 'day' },
  { id: 's12a', a: 1154, b: 1199, light: 'day' },
  { id: 's12b', a: 1200, b: 1249, light: 'day' },
  { id: 's13', a: 1250, b: 1371, light: 'day' },
  { id: 's14a', a: 1372, b: 1432, light: 'day' },
  { id: 's14b', a: 1433, b: 1502, light: 'day' },
  { id: 's15a', a: 1503, b: 1541, light: 'day' },
  { id: 's15b', a: 1542, b: 1583, light: 'day' },
  { id: 's16', a: 1584, b: 1683, light: 'day' },
  { id: 's17', a: 1684, b: 1799, light: 'day' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights: ONE vivid daylight grade ----------
export const LIGHTS = {
  day: { az: 218, el: 46, sky: '#dcebf2', ground: '#5d7a3a', hemi: 1.05, sun: '#ffdca3', sunI: 2.55, fog: '#d8e6cf', fogNear: 55, fogFar: 380,
    skyTop: '#1a4f96', skyHor: '#8fb8dc', sunDisc: '#fff0bc', sunSize: 0.0042, sat: 1.30, vig: 0.24, shadowExt: 40, aurora: 0, gain: '#fff0cd', waterDeep: '#14424f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

// ---------- staging ----------
export const BOARD_POS = [5.8, 0.98, 6.4];
export const BOARD_RY = 0.65;
export const STONE_POS = { x: -2.8, z: -3.2, topY: 0.52 };  // the flat work stone
export const DIP_POS = { x: 0.6, z: -5.7 };                  // the dipping stone in the shallows
export const CLAY_POS = { x: 1.9, z: -5.2 };                 // the wet clay patch on the bank
export const STOOL_POS = { x: -4.75, z: 0.1 };               // the prize pot's stool by the stall

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
export function girlAt(f) {
  const S = shotAt(f);
  switch (S.id) {
    case 's01a': return walkChain(f, [[2, [5.4, -0.9], [3.2, -1.35], 1.9, 0.8]]);
    case 's01b': {
      if (f < 100) { const w = walkAlong(f, 57, [3.2, -1.35], [0.6, -1.5], 1.35, 0.78); return { x: w.x, z: w.z, phase: w.phase, moving: w.moving }; }
      return { x: 0.6, z: -1.5 };
    }
    case 's02': case 's03a': case 's03b': return { x: -5.6, z: -1.0 };
    case 's04': return walkChain(f, [
      [338, [-5.6, -1.0], [-1.7, -2.05], 2.4, 0.85],
      [398, [-1.7, -2.05], [0.2, -3.6], 2.4, 0.85],
    ]);
    case 's05a': return { x: 0.6, z: -4.8 };
    case 's05b': case 's06': return { x: 0.6, z: -4.35 };
    case 's07': return { x: 0.6, z: -4.55 };
    case 's08': return { x: 1.7, z: -4.75 };
    case 's09': case 's10': return { x: -1.35, z: -3.3 };
    case 's11': return { x: -1.15, z: -2.1 };
    case 's12a': {
      if (f < 1186) { const w = walkAlong(f, 1156, [-1.35, -3.3], [0.6, -4.55], 2.4, 0.82); return { x: w.x, z: w.z, phase: w.phase, moving: w.moving }; }
      return { x: 0.6, z: -4.55 };
    }
    case 's12b': return { x: 0.6, z: -4.35 };
    case 's13': return walkChain(f, [
      [1254, [0.6, -4.3], [-1.5, -2.7], 2.0, 0.82],
      [1312, [-1.5, -2.7], [-1.45, -1.85], 2.0, 0.82],
      [1332, [-1.45, -1.85], [-3.4, -1.3], 2.0, 0.82],
    ]);
    case 's14a': case 's14b': case 's15a': case 's15b': return { x: -3.2, z: -1.7 };
    case 's16': return { x: 0.2, z: -2.2 };
    case 's17': return { x: 4.2, z: 4.4 };
    default: return { x: 0.6, z: -1.5 };
  }
}
export const potterAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 's02': case 's03a': case 's03b': return { x: -6.2, z: 2.35 };
    case 's06': return { x: -4.0, z: -0.7 };
    case 's13': case 's14a': case 's14b': case 's15a': case 's15b': return { x: -4.9, z: -0.6 };
    case 's16': return { x: -3.6, z: -1.2 };
    case 's17': return { x: 6.8, z: 4.6 };
    default: return { x: -6.2, z: 2.35 };
  }
};
export const womanAAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 's02': case 's03a': case 's03b': return { x: -3.6, z: 0.2 };
    case 's04': return walkChain(f, [
      [344, [-2.5, 0.8], [-0.2, -1.0], 2.2, 0.82],
      [400, [-0.2, -1.0], [1.6, -2.4], 2.2, 0.82],
    ]);
    case 's05a': return { x: -0.9, z: -3.2 };
    case 's05b': case 's06': case 's12a': return { x: 1.9, z: -2.6 };
    case 's07': return { x: -0.9, z: -3.2 };
    case 's12b': return { x: 2.7, z: -3.0 };
    case 's08': case 's09': case 's10': return { x: 0.1, z: -2.7 };
    case 's11': return { x: 0.4, z: -1.8 };
    case 's13': return { x: 1.5, z: -2.9 };
    case 's14a': case 's14b': case 's15a': case 's15b': return { x: -1.55, z: -2.05 };
    case 's16': return { x: 1.7, z: -2.4 };
    case 's17': return { x: 3.9, z: 5.6 };
    default: return { x: 13.5, z: 7.5 };
  }
};
export const womanBAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 's02': case 's03a': case 's03b': return { x: -2.6, z: 1.2 };
    case 's04': return walkChain(f, [
      [366, [-1.2, 1.4], [-0.9, -0.3], 2.2, 0.82],
      [398, [-0.9, -0.3], [-1.4, -2.0], 2.2, 0.82],
    ]);
    case 's05a': case 's05b': case 's07': case 's12a': case 's12b': return { x: -1.5, z: -2.2 };
    case 's06': return { x: -0.5, z: -2.6 };
    case 's08': case 's09': case 's10': return { x: -2.3, z: -2.05 };
    case 's11': return { x: -3.9, z: -1.7 };
    case 's13': return { x: 1.6, z: -3.6 };
    case 's14a': case 's14b': case 's15a': case 's15b': return { x: -0.7, z: -2.9 };
    case 's16': return { x: -1.6, z: -2.3 };
    case 's17': return { x: 7.6, z: 5.5 };
    default: return { x: -13.5, z: 7.5 };
  }
};

// ---------- the sieve: world state (single source for main.js) ----------
// mode 'girl' = the card draws it in her hands (3D hidden).
// 'ground' = resting on the bank while she digs. 'stone' = on the
// flat work stone while she lines it and it dries.
export const sieveAt = (f) => {
  let mode = 'girl', x = 0, z = 0;
  if (f >= 656 && f < 836) { mode = 'ground'; x = 0.9; z = -4.0; }
  else if (f >= 836 && f < 1154) { mode = 'stone'; x = STONE_POS.x; z = STONE_POS.z; }
  const clayK = smooth(ramp(f, 850, 935));                    // the smear goes on (L9)
  const leafStage = clamp((f - 958) / 26, 0, 1) + clamp((f - 998) / 26, 0, 1) + clamp((f - 1032) / 26, 0, 1); // 3 leaves (L10)
  const dryK = smooth(ramp(f, 1065, 1145));                   // the sun skins it over (L11)
  const pulse = (a, b) => { const m = (a + b) / 2; return f >= a && f <= b ? Math.sin((f - a) / (b - a) * Math.PI) : 0; };
  const splashK = Math.max(pulse(455, 492), pulse(1172, 1198)); // the two dips
  const puddleK = smooth(ramp(f, 1440, 1495));                // the prize pot's leak pools (L14)
  return { mode, x, z, clayK, leafStage, dryK, splashK, puddleK, potK: f < 1372 ? 1 : 0 };
};

// ---------- hero / focus ----------
const FOCUS = {
  s01a: () => [5.2, 1.0, -1.0],
  s01b: () => { const b = girlAt(85); return [b.x, 1.1, b.z]; },
  s02: () => [-5.9, 1.1, 0.4],
  s03a: () => [-6.2, 1.5, 2.35],
  s03b: () => [-5.8, 1.3, 0.6],
  s04: () => [-1.8, 1.0, -2.4],
  s05a: () => [0.6, 0.7, -5.0],
  s05b: () => [0.6, 0.95, -4.4],
  s06: () => [0.2, 1.05, -2.4],
  s07: () => [0.6, 1.05, -4.5],
  s08: () => [1.6, 0.75, -4.9],
  s09: () => [-2.4, 0.75, -3.2],
  s10: () => [-2.5, 0.8, -3.2],
  s11: () => [-2.7, 0.7, -3.2],
  s12a: () => { const b = girlAt(1175); return [b.x, 1.05, b.z]; },
  s12b: () => [0.6, 1.0, -4.4],
  s13: () => [-1.6, 1.05, -2.6],
  s14a: () => [-4.9, 1.35, -0.6],
  s14b: () => [-4.85, 0.9, -0.6],
  s15a: () => [-4.9, 1.5, -0.6],
  s15b: () => [-4.2, 1.25, -0.9],
  s16: () => [0.1, 1.0, -2.25],
  s17: () => [BOARD_POS[0], 1.0, BOARD_POS[2]],
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id]();

// ---------- cameras (the raised bar: EVERY sub-shot travels) ----------
// The village: river z<-6.2, bank strip to z-4.4, dipping stone
// (0.6,-5.7), clay patch (1.9,-5.2), work stone (-2.8,-3.2),
// potter's stall west (counter x -8.1..-4.3, z 0.2..1.5), the girl's
// hut east (x 6.0..9.2), the hook board south-east (5.8,6.4).
const girlPos = (f) => { const a = girlAt(f); return [a.x, 0, a.z]; };
const potterPos = (f) => { const a = potterAt(f); return [a.x, 0, a.z]; };
const RIG_BY_ID = {
  s01a: { cut: 'hard', raw: keysCam({ keys: [
    { f: 0, pos: [2.2, 2.2, 3.4], look: [5.2, 1.0, -1.0], fov: 40 },
    { f: 56, pos: [2.9, 2.05, 2.9], look: [4.4, 1.0, -1.2], fov: 37, ease: 'surge' }] }) },
  s01b: { cut: 'hard', raw: pushInCam({ subject: girlPos, a: 57, b: 117, d0: 3.6, d1: 3.0, h0: 1.7, h1: 1.6, lookOff: [0, 1.2, 0], fov0: 36, fov1: 33, dir: [0.55, 0.83] }) },
  s02: { cut: 'hard', raw: keysCam({ keys: [
    { f: 118, pos: [-2.2, 1.9, -3.4], look: [-5.6, 1.05, -1.0], fov: 38 },
    { f: 233, pos: [-2.5, 1.8, -3.0], look: [-5.6, 1.05, -1.0], fov: 35, ease: 'surge' }] }) },
  s03a: { cut: 'hard', raw: pushInCam({ subject: potterPos, a: 234, b: 282, d0: 3.0, d1: 2.5, h0: 1.66, h1: 1.6, lookOff: [0, 1.48, 0], fov0: 35, fov1: 31, dir: [0.25, -0.97] }) },
  s03b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 283, pos: [-3.2, 2.1, 3.2], look: [-5.7, 1.25, 0.6], fov: 40 },
    { f: 335, pos: [-3.5, 2.0, 2.6], look: [-5.7, 1.25, 0.6], fov: 37, ease: 'surge' }] }) },
  s04: { cut: 'hard', raw: keysCam({ keys: [
    { f: 336, pos: [-6.6, 2.8, 4.8], look: [-4.6, 1.0, -1.3], fov: 40 },
    { f: 392, pos: [-2.4, 2.6, 4.2], look: [-1.9, 1.0, -2.3], fov: 39, ease: 'smooth' },
    { f: 446, pos: [3.2, 2.6, 3.2], look: [0.1, 1.0, -3.5], fov: 38, ease: 'smooth' }] }) },
  s05a: { cut: 'hard', raw: keysCam({ keys: [
    { f: 447, pos: [3.1, 1.7, 0.6], look: [0.6, 0.72, -5.0], fov: 37 },
    { f: 495, pos: [2.7, 1.55, 0.0], look: [0.6, 0.72, -5.0], fov: 34, ease: 'surge' }] }) },
  s05b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 496, pos: [2.9, 1.9, 0.9], look: [0.6, 0.95, -4.5], fov: 36 },
    { f: 549, pos: [2.5, 1.8, 0.3], look: [0.6, 0.95, -4.5], fov: 33, ease: 'surge' }] }) },
  s06: { cut: 'hard', raw: keysCam({ keys: [
    { f: 550, pos: [-7.5, 2.7, 3.8], look: [-3.6, 1.1, -0.9], fov: 41 },
    { f: 655, pos: [4.6, 2.5, 3.6], look: [1.2, 1.05, -2.3], fov: 40, ease: 'smooth' }] }) },
  // DOLLY ZOOM A — the idea lands: dolly IN on the smiling girl as
  // she looks at the riverbank clay, lens opens 32 -> 50; she holds
  // her size, the bank and the river stretch behind her.
  s07: { cut: 'hard', raw: keysCam({ keys: [
    { f: 656, pos: [3.3, 1.8, 0.8], look: [0.6, 1.05, -4.45], fov: 32 },
    { f: 741, pos: [2.2, 1.6, -0.6], look: [0.6, 1.05, -4.45], fov: 50, ease: 'smooth' }] }) },
  s08: { cut: 'hard', raw: keysCam({ keys: [
    { f: 742, pos: [4.6, 1.9, 0.2], look: [1.55, 0.78, -4.85], fov: 37 },
    { f: 835, pos: [4.0, 1.75, -0.5], look: [1.55, 0.78, -4.85], fov: 34, ease: 'surge' }] }) },
  s09: { cut: 'hard', raw: keysCam({ keys: [
    { f: 836, pos: [1.2, 1.85, 0.8], look: [-1.8, 0.8, -3.22], fov: 37 },
    { f: 947, pos: [0.8, 1.75, 0.3], look: [-1.8, 0.8, -3.22], fov: 34, ease: 'surge' }] }) },
  s10: { cut: 'hard', raw: keysCam({ keys: [
    { f: 948, pos: [1.3, 1.85, 0.9], look: [-1.8, 0.8, -3.22], fov: 37 },
    { f: 1054, pos: [0.9, 1.75, 0.4], look: [-1.8, 0.8, -3.22], fov: 34, ease: 'surge' }] }) },
  s11: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1055, pos: [-5.6, 2.4, 1.4], look: [-2.7, 0.7, -3.2], fov: 39 },
    { f: 1153, pos: [0.8, 2.3, 0.6], look: [-2.7, 0.7, -3.2], fov: 37, ease: 'smooth' }] }) },
  s12a: { cut: 'hard', raw: pushInCam({ subject: girlPos, a: 1154, b: 1199, d0: 3.2, d1: 2.8, h0: 1.66, h1: 1.58, lookOff: [0, 1.08, 0], fov0: 36, fov1: 34, dir: [0.6, 0.8] }) },
  // DOLLY ZOOM B — the lift: dolly IN on the girl raising the
  // brim-full sieve, lens opens 33 -> 49; the water holds, the
  // river warps behind her.
  s12b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1200, pos: [3.2, 1.9, 0.7], look: [0.6, 1.0, -4.4], fov: 33 },
    { f: 1249, pos: [2.3, 1.75, -0.3], look: [0.6, 1.0, -4.4], fov: 49, ease: 'smooth' }] }) },
  s13: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1250, pos: [5.6, 2.5, 3.6], look: [0.6, 1.05, -4.3], fov: 38 },
    { f: 1310, pos: [1.4, 2.4, 3.0], look: [-1.48, 1.05, -2.3], fov: 37, ease: 'smooth' },
    { f: 1338, pos: [-1.2, 2.4, 3.0], look: [-1.45, 1.05, -1.85], fov: 36, ease: 'smooth' },
    { f: 1355, pos: [-2.4, 2.4, 3.1], look: [-2.9, 1.05, -1.42], fov: 35.5, ease: 'smooth' },
    { f: 1371, pos: [-3.6, 2.4, 3.2], look: [-3.3, 1.05, -1.3], fov: 35, ease: 'surge' }] }) },
  s14a: { cut: 'hard', raw: pushInCam({ subject: potterPos, a: 1372, b: 1432, d0: 3.1, d1: 2.6, h0: 1.68, h1: 1.6, lookOff: [0, 1.38, 0], fov0: 35, fov1: 32, dir: [0.3, -0.95] }) },
  s14b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1433, pos: [-1.9, 1.9, 2.4], look: [-4.85, 1.15, -0.6], fov: 36 },
    { f: 1502, pos: [-2.3, 1.8, 1.8], look: [-4.85, 1.15, -0.6], fov: 33, ease: 'surge' }] }) },
  s15a: { cut: 'hard', raw: pushInCam({ subject: potterPos, a: 1503, b: 1541, d0: 2.9, d1: 2.45, h0: 1.66, h1: 1.6, lookOff: [0, 1.48, 0], fov0: 34, fov1: 30, dir: [0.3, -0.95] }) },
  s15b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1542, pos: [-1.2, 2.0, 3.0], look: [-4.45, 1.2, -0.75], fov: 40 },
    { f: 1583, pos: [-1.5, 1.95, 2.5], look: [-4.45, 1.2, -0.75], fov: 37, ease: 'surge' }] }) },
  s16: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1584, pos: [3.4, 2.2, 3.4], look: [0.1, 1.0, -2.25], fov: 38 },
    { f: 1683, pos: [3.9, 2.1, 2.8], look: [0.1, 1.0, -2.25], fov: 35, ease: 'surge' }] }) },
  s17: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1684, pos: [9.9, 2.5, 10.2], look: [5.8, 1.0, 6.4], fov: 47 },
    { f: 1799, pos: [10.15, 2.6, 10.45], look: [5.8, 1.0, 6.4], fov: 45, ease: 'surge' }] }) },
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
  if (['s01a', 's04', 's06', 's11', 's17'].includes(S.id)) cinf = 1.3;
  if (['s07', 's12b'].includes(S.id)) cinf = 2.4;
  if (['s09', 's10'].includes(S.id)) cinf = 3.8;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world dynamics ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  return {
    always: 1,
    boardK: S.id === 's17' ? smooth(ramp(f, 1720, 1745)) : 0,
    ...sieveAt(f),
  };
};
export const fxProfileAt = (f) => ({ moteRate: 0.05, blastRate: 0, sparkRate: 0, steamRate: 0, shimmerRate: 0 });
export const fxAt = () => [];

// ---------- cast ----------
const SKIN = '#ffe2c2'; // warmed so ballFill shading reads
export const OUTFITS = {
  girl: { build: 'kid', dress: '#c25a7a', jacket: '#c25a7a', pants: '#7a4a3a', boots: '#4a2c1c', hat: 'hair', hair: '#3a2415', shirtFront: '#e8b7c4', skin: SKIN },
  potter: { build: 'stout', jacket: '#8a5a34', pants: '#3a3230', boots: '#1c1410', hat: 'turban', shirtFront: '#d9c9a3', skin: SKIN, moustache: '#2c1c10', bigMoustache: true },
  womanA: { jacket: '#2e6e5e', pants: '#33413a', boots: '#1c1712', hat: 'hair', hair: '#1c1410', shirtFront: '#efe3c8', skin: SKIN },
  womanB: { jacket: '#7a4a7e', pants: '#2e3242', boots: '#1c1712', hat: 'cap', cap: '#e8b93c', shirtFront: '#efe3c8', skin: SKIN },
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
const emoGirl = emoTrack('determined', [[118, 'sad', 12], [336, 'determined', 12], [496, 'shock', 10], [522, 'sad', 12], [656, 'smile', 12], [742, 'determined', 12], [948, 'smile', 12], [1154, 'determined', 12], [1200, 'wonder', 12], [1250, 'proud', 12], [1372, 'smile', 12], [1503, 'grin', 12], [1584, 'laugh', 15], [1684, 'smile', 12]]);
const emoPotter = emoTrack('proud', [[234, 'smug', 12], [283, 'laugh', 15], [550, 'laugh', 15], [656, 'smug', 12], [1250, 'stern', 12], [1372, 'smug', 12], [1433, 'shock', 12], [1503, 'nervous', 12], [1532, 'pained', 15], [1584, 'smile_closed', 15], [1684, 'smile_closed', 15]]);
const emoWomen = emoTrack('smile', [[336, 'smile', 12], [550, 'laugh', 15], [742, 'confused', 12], [1055, 'confused', 12], [1200, 'shock', 12], [1250, 'smile', 12], [1433, 'laugh', 15], [1503, 'smile', 12], [1584, 'laugh', 15], [1684, 'smile', 12]]);
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
  const gi = girlAt(f), po = potterAt(f), wa = womanAAt(f), wb = womanBAt(f);
  const GP = emoGirl.at(f), PP = emoPotter.at(f), WP = emoWomen.at(f);
  GP.blush = 0; PP.blush = 0; WP.blush = 0;
  const girl = (opts = {}, extra = {}) => std('girl', OUTFITS.girl, { expr: 'neutral', exprP: GP, blink: blinkAt(f, 31), seed: 31, ...mv(gi), ...opts }, gi.x, gi.z, extra);
  const potter = (opts = {}, extra = {}) => std('potter', OUTFITS.potter, { expr: 'proud', exprP: PP, blink: blinkAt(f, 51), seed: 51, ...mv(po), ...opts }, po.x, po.z, extra);
  const womanA = (opts = {}, extra = {}) => std('womanA', OUTFITS.womanA, { expr: 'smile', exprP: WP, blink: blinkAt(f, 41), seed: 41, ...mv(wa), ...opts }, wa.x, wa.z, extra);
  const womanB = (opts = {}, extra = {}) => std('womanB', OUTFITS.womanB, { expr: 'smile', exprP: WP, blink: blinkAt(f, 61), seed: 61, ...mv(wb), ...opts }, wb.x, wb.z, extra);
  const sieve = (state) => ['sieve', 0.55, state, state === 1 ? q((f % 16) / 16, 2) : 0];
  const leakPot = ['potleak', 0.62, q((f % 20) / 20, 2)];
  const cheerWave = { wave: q(Math.sin(f * 0.32) * 0.85, 2) };
  switch (S.id) {
    case 's01a': case 's01b':
      girl({ expr: 'determined', prop: sieve(0), ...head(f, 31, 0.9, 0.1, 0.25) }, { yaw: 0.15 });
      break;
    case 's02':
      girl({ expr: 'sad', prop: sieve(0), ...head(f, 31, 1.5, -0.2, 0.3, -0.2) }, { yaw: -0.25 });
      potter({ expr: 'stern', ...head(f, 51, -0.8, 0.1, 0) }, { yaw: 0.1 });
      womanA({ ...head(f, 41, 0.5, 0, 0) }, { yaw: -0.2 });
      womanB({ ...head(f, 61, 0.5, 0, 0) }, { yaw: 0.2 });
      break;
    case 's03a': case 's03b': {
      // the potter's MOCK — performed dialogue (speak track, L3)
      const SM = spk(PP, f);
      potter({ expr: 'smug', exprP: SM.exprP, prop: ['point', 0.8], ...head(f, 51, -2.0 + SM.nod, 0.25, 0.05, 0.2) }, { yaw: 0.2 });
      girl({ expr: 'sad', prop: sieve(0), ...head(f, 31, 1.8, -0.25, 0.2, -0.25) }, { yaw: -0.25 });
      womanA({ expr: 'smile', ...head(f, 41, 0.5, -0.2, 0) }, { yaw: -0.2 });
      womanB({ expr: 'smile', ...head(f, 61, 0.5, 0.2, 0) }, { yaw: 0.2 });
      break;
    }
    case 's04':
      girl({ expr: 'determined', prop: sieve(0), ...head(f, 31, 0.8, 0.15, 0.2) }, { yaw: 0.2 });
      womanA({ expr: 'smile', ...head(f, 41, 0.6, -0.2, 0.05) }, { yaw: -0.2 });
      womanB({ expr: 'smile', ...head(f, 61, 0.6, 0.2, 0.05) }, { yaw: 0.2 });
      break;
    case 's05a':
      girl({ expr: 'determined', prop: sieve(0), mode: 'kneel1', ...head(f, 31, 1.7, 0.1, 0.4) }, { yaw: 0.1 });
      womanA({ ...head(f, 41, 0.6, -0.2, 0.1) }, { yaw: -0.25 });
      womanB({ ...head(f, 61, 0.6, 0.2, 0.1) }, { yaw: 0.25 });
      break;
    case 's05b':
      girl({ expr: f < 522 ? 'shock' : 'sad', prop: sieve(1), ...head(f, 31, 1.6, 0.1, 0.35) }, { yaw: 0.1 });
      womanA({ expr: 'smile', ...head(f, 41, 0.5, -0.2, 0) }, { yaw: -0.25 });
      womanB({ expr: 'smile', ...head(f, 61, 0.5, 0.2, 0) }, { yaw: 0.25 });
      break;
    case 's06':
      girl({ expr: 'sad', prop: sieve(0), ...head(f, 31, 1.5, 0.1, 0.3) }, { yaw: 0.1 });
      potter({ expr: 'laugh', prop: ['point', 0.8], ...head(f, 51, Math.sin(f * 0.3) * 1.8, 0, -0.05) }, { yaw: -0.15 });
      womanA({ expr: 'laugh', prop: ['clap', 0.8], ...head(f, 41, Math.sin(f * 0.34 + 1) * 1.6, 0, 0) }, { yaw: -0.2 });
      womanB({ expr: 'laugh', prop: ['wave', 0.85], ...head(f, 61, Math.sin(f * 0.28 + 2) * 1.6, 0, 0) }, { yaw: 0.2 });
      break;
    case 's07':
      girl({ expr: 'smile', mode: 'kneel1', ...head(f, 31, 1.5, 0.35, 0.35, 0.3) }, { yaw: 0.3 });
      womanA({ ...head(f, 41, 0.5, -0.2, 0) }, { yaw: -0.25 });
      womanB({ ...head(f, 61, 0.5, 0.2, 0) }, { yaw: 0.25 });
      break;
    case 's08':
      girl({ expr: 'determined', prop: ['clay', 0.55], mode: 'kneel1', ...head(f, 31, 1.8, 0.15, 0.4) }, { yaw: 0.15 });
      womanA({ expr: 'confused', ...head(f, 41, 0.7, -0.2, 0.1) }, { yaw: -0.25 });
      womanB({ expr: 'confused', ...head(f, 61, 0.7, 0.2, 0.1) }, { yaw: 0.25 });
      break;
    case 's09':
      girl({ expr: 'determined', prop: ['clay', 0.5], mode: 'kneel1', ...head(f, 31, 1.8, -0.2, 0.4, -0.25) }, { yaw: -0.3 });
      womanA({ expr: 'confused', ...head(f, 41, 0.6, -0.2, 0) }, { yaw: -0.25 });
      womanB({ expr: 'confused', ...head(f, 61, 0.6, 0.2, 0) }, { yaw: 0.25 });
      break;
    case 's10':
      girl({ expr: 'smile', prop: ['leaf', 0.5], mode: 'kneel1', ...head(f, 31, 1.7, -0.2, 0.38, -0.25) }, { yaw: -0.3 });
      womanA({ expr: 'confused', ...head(f, 41, 0.6, -0.2, 0) }, { yaw: -0.25 });
      womanB({ expr: 'confused', ...head(f, 61, 0.6, 0.2, 0) }, { yaw: 0.25 });
      break;
    case 's11':
      girl({ expr: 'smile', ...head(f, 31, 0.6, -0.25, 0.1, -0.3) }, { yaw: -0.3 });
      womanA({ expr: 'confused', ...head(f, 41, 0.7, -0.2, 0.05) }, { yaw: -0.25 });
      womanB({ expr: 'confused', ...head(f, 61, 0.7, 0.2, 0.05) }, { yaw: 0.25 });
      break;
    case 's12a':
      if (f < 1186) girl({ expr: 'determined', prop: sieve(2), ...head(f, 31, 0.9, 0.1, 0.25) }, { yaw: 0.15 });
      else girl({ expr: 'determined', prop: sieve(2), mode: 'kneel1', ...head(f, 31, 1.7, 0.1, 0.4) }, { yaw: 0.1 });
      womanA({ expr: 'smile', ...head(f, 41, 0.5, -0.2, 0) }, { yaw: -0.25 });
      womanB({ expr: 'smile', ...head(f, 61, 0.5, 0.2, 0) }, { yaw: 0.25 });
      break;
    case 's12b':
      girl({ expr: 'wonder', prop: sieve(3), ...head(f, 31, 1.2, 0.1, 0.3) }, { yaw: 0.1 });
      womanA({ expr: 'shock', ...head(f, 41, 0.4, -0.2, -0.05) }, { yaw: -0.25 });
      womanB({ expr: 'shock', ...head(f, 61, 0.4, 0.2, -0.05) }, { yaw: 0.25 });
      break;
    case 's13':
      girl({ expr: 'proud', prop: sieve(3), ...head(f, 31, 0.7, 0.15, 0.15) }, { yaw: 0.2 });
      potter({ expr: 'stern', ...head(f, 51, -0.7, 0.2, 0) }, { yaw: 0.2 });
      womanA({ expr: 'smile', ...head(f, 41, 0.5, -0.2, 0) }, { yaw: -0.2 });
      womanB({ expr: 'smile', ...head(f, 61, 0.5, 0.2, 0) }, { yaw: 0.2 });
      break;
    case 's14a':
      potter({ expr: 'smug', prop: ['pot', 0.62], ...head(f, 51, -0.9, 0.2, 0.1) }, { yaw: 0.2 });
      girl({ expr: 'smile', prop: sieve(3), ...head(f, 31, 0.7, 0.25, 0.1) }, { yaw: 0.3 });
      womanA({ ...head(f, 41, 0.5, -0.2, 0) }, { yaw: -0.2 });
      womanB({ ...head(f, 61, 0.5, 0.2, 0) }, { yaw: 0.2 });
      break;
    case 's14b':
      potter({ expr: 'shock', prop: leakPot, ...head(f, 51, 0.5, 0.1, 0.3, 0.1) }, { yaw: 0.15 });
      girl({ expr: 'smile', prop: sieve(3), ...head(f, 31, 0.7, 0.25, 0.1) }, { yaw: 0.3 });
      womanA({ expr: 'laugh', prop: ['clap', 0.8], ...head(f, 41, Math.sin(f * 0.34) * 1.6, 0, 0) }, { yaw: -0.2 });
      womanB({ expr: 'laugh', ...head(f, 61, Math.sin(f * 0.3 + 1) * 1.6, 0, 0) }, { yaw: 0.2 });
      break;
    case 's15a': case 's15b': {
      // the potter's ADMISSION — performed dialogue (speak track, L15)
      const SM = spk(PP, f);
      potter({ expr: 'nervous', exprP: SM.exprP, prop: leakPot, ...head(f, 51, 1.9 + SM.nod, -0.1, 0.12, -0.15) }, { yaw: -0.15 });
      girl({ expr: 'grin', prop: sieve(3), ...head(f, 31, 0.7, 0.25, 0) }, { yaw: 0.25 });
      womanA({ expr: 'smile', ...head(f, 41, 0.5, -0.2, 0) }, { yaw: -0.25 });
      womanB({ expr: 'smile', ...head(f, 61, 0.5, 0.2, 0) }, { yaw: 0.25 });
      break;
    }
    case 's16':
      girl({ expr: 'laugh', prop: sieve(3), ...head(f, 31, 0.5, 0, 0) }, { yaw: 0 });
      womanA({ expr: 'laugh', prop: ['cup', 0.55], ...head(f, 41, Math.sin(f * 0.3 + 1) * 1.4, -0.2, -0.05) }, { yaw: -0.2 });
      womanB({ expr: 'laugh', prop: ['clap', 0.8], ...head(f, 61, Math.sin(f * 0.34) * 1.6, 0, 0) }, { yaw: 0.2 });
      potter({ expr: 'smile_closed', prop: ['clap', 0.8], ...head(f, 51, 0.6, 0, 0) }, { yaw: -0.25 });
      break;
    case 's17':
      girl({ expr: 'smile', prop: sieve(3), ...head(f, 31, 0.5, 0, 0) }, { yaw: -0.15 });
      potter({ expr: 'smile_closed', ...head(f, 51, 0.8, 0, 0) }, { yaw: -0.25 });
      womanA({ expr: 'smile', prop: ['clap', 0.8], ...head(f, 41, 0.5, 0, 0) }, { yaw: -0.3 });
      womanB({ expr: 'smile', ...head(f, 61, 0.5, 0, 0) }, { yaw: 0.2 });
      break;
    default:
      girl({}); potter({});
  }
  return out;
};
export const actorsAt = (f, T2) => castAt(f).map((c) => c.actor(T2));

// ---------- solidity ----------
export const STATICS = [
  SOL.aabb(-8.1, -4.3, 0.2, 1.5, { h: 2.3, id: 'stall' }),
  SOL.aabb(6.0, 9.2, -0.6, 2.2, { h: 2.2, id: 'hut' }),
  SOL.aabb(-3.75, -1.85, -3.9, -2.5, { h: 0.52, id: 'workstone' }),
  SOL.circle(DIP_POS.x, DIP_POS.z, 0.5, { h: 0.3, id: 'dipstone' }),
  SOL.circle(-3.9, 1.35, 0.34, { h: 0.95, id: 'barrel' }),
  SOL.circle(STOOL_POS.x, STOOL_POS.z, 0.28, { h: 0.55, id: 'stool' }),
  SOL.circle(BOARD_POS[0], BOARD_POS[2], 0.3, { h: 1.9, id: 'boardstand' }),
  ...[[-11.5, -3.5], [12.5, 4.5], [-13.5, 5.5]].map(([x, z]) => SOL.circle(x, z, 0.4, { h: 5, id: 'tree' })),
];
export const WORLD = SOL.makeWorld(STATICS);
export const dynamicsAt = (f) => castAt(f).map((a) => SOL.circle(a.x, a.z, a.r, { kind: 'dynamic', id: a.id }));
export const groundItemsAt = (f) => {
  const items = [];
  for (const a of castAt(f)) items.push({ id: a.id, y: a.y, ground: a.ground || 0, maxHover: 0.06 });
  return items;
};
