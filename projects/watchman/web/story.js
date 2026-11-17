// Shot plan for "The Night Watchman Who Slept All Night" — watchman
// (SALTED MINE V3 style: painted world, round-white-head cards, word-by-word
// captions, body.js actions, speak.js dialogue performance).
// R2 REBUILD (2026-11-17, moonrent R2 standard): opening settles BIG onto
// the cot under a low push-in; the bells beat is a floor-level front close
// (foot + wire + bell centre-frame) that rises into the thief's shocked
// face; wirecu is a pure tripwire-rig insert at ~0.8 m; the hook ends on
// the watchman IN frame pointing at his board. Timings/captions/mix are
// the v1 build's, untouched.
// Batch 9 E3 (Mirror Trick Tales). ONE set: a treasure warehouse at night —
// shelf rows of silk bales, spice sacks and silver chests, a web of
// knee-high tripwires each tied to a hidden bell, the watchman's bedroll in
// the very centre, a roof window on the west wall. Voice stem: 64.331 s,
// 30 fps, TOTAL 1930; timings from faster-whisper small full-file decode
// (words.json / timing.json, match 0.967). Scene changes ONLY at clause
// (script-line) boundaries:
//   L1  sleep    The watchman slept through every night, yet caught most.
//   L2  treasure Silk, spices and silver worth a king's ransom.
//   L3  memory   Robbed eleven times under wide-awake guards (flashback).
//   L4  hire     The owner hired an old man with a blanket + ball of string.
//   L5  tying    Every evening he walked the aisles tying his string.
//   L6  lie      He lay down in the very centre of the warehouse and snored.
//   L7  thieves  Three thieves slipped through the roof window.
//   L8  bells    Three steps — the whole warehouse exploded into bells.
//   L9  bellrow  Bells over doors, under shelves, along every aisle.
//   L10 wake     The old man sat up, rubbing his eyes, lantern in hand.
//   L11 yawn     He yawned and gave the terrified men his explanation.
//   L12 dialogue "I sleep, friends. The wires stay awake."
//   L13 wirecu   A web of tripwires, knee-high, each tied to a hidden bell.
//   L14 catrat   A cat could pass, a rat could pass — a man never could.
//   L15 hook     But tomorrow… the shepherd who counted a thousand sheep…
// GRADE (FILTER_VFX_LIGHTING pack): Night Lamp throughout — deep blue
// night, warm lantern practicals motivate everything (brightest at source,
// soft falloff, dust only inside the light); L3 warms into a memory tint;
// the bell beats lift exposure through bellK. Boards/text NEVER graded.
import { M, blinkAt, q, clamp, lerp, ramp, kf } from './motion.js';
import { buildRig, keysCam } from './camrig.js';
import { poseWindows, turnTrack, gazeTrack, winkTrack } from './body.js';
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

export const FPS = 30, TOTAL = 1930, DECK = 0;
// Shot boundaries (frames) — snapped to timing.json phrase starts.
export const BND = [0, 164, 286, 421, 535, 683, 792, 933, 1062, 1193, 1315, 1412, 1501, 1652, 1800, 1930];
const IDS = ['sleep', 'treasure', 'memory', 'hire', 'tying', 'lie', 'thieves', 'bells', 'bellrow', 'wake', 'yawn', 'dialogue', 'wirecu', 'catrat', 'hook'];
export const SHOTS = IDS.map((id, i) => ({ id, a: BND[i], b: BND[i + 1] - 1, light: id === 'memory' ? 'memory' : 'night' }));
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
const F = (id) => SHOTS.find((s) => s.id === id);
const B = (id) => F(id).a, E = (id) => F(id).b;

// ---------- staging (shared by story, main, colliders) ----------
export const BED = { x: 1.6, z: 0.9 };            // watchman's feet at the bedroll
export const HOOK_POS = { x: 5.9, z: -0.3 };       // R2 fix: watchman pulled toward camera (head ≥20% frame width) for the hook board shot
export const WIRE_Y = 0.45;                        // every tripwire rides knee-high
export const BOARD_POS = [12.3, 2.85, 0.5];
export const BOARD_RY = -Math.PI / 2;
export const DOOR = { x: 12.3, z: -4.5 };
export const WINDOW = { x: -12.35, z: -2.0, y: 5.3 };
export const WIRES = [
  { x: -6.0, z0: -5.5, z1: 4.3, hero: true },
  { x: -1.5, z0: 0.2, z1: 5.4 },
  { x: 3.5, z0: 0.2, z1: 5.4 },
  { x: 8.2, z0: -4.3, z1: 4.3 },
  { along: 'z', z: -4.95, x0: -9.0, x1: 9.0 },
];
export const HIT = B('bells') + 80;                // f1013: the third step brushes the hero wire
export const HIT2 = B('catrat') + 88;              // f1740: the silk carrier's shin finds the wire

// ---------- lights / mood grades (Night Lamp family) ----------
export const LIGHTS = {
  night: { az: 262, el: 34, sky: '#2e3d5c', ground: '#171208', hemi: 0.52, sun: '#a9c2e8', sunI: 0.7, fog: '#0b0d14', fogNear: 24, fogFar: 180,
    skyTop: '#05080f', skyHor: '#1c2637', sunDisc: '#e3ecff', sunSize: 0.003, sat: 1.06, vig: 0.32, shadowExt: 30, aurora: 0, gain: '#ffd9ae',
    waterDeep: '#0a2438', waterShal: '#1d4e5f', glint: '#ffe9c0' },
  memory: { az: 240, el: 30, sky: '#4a3d2c', ground: '#1d150c', hemi: 0.58, sun: '#e8c9a0', sunI: 0.8, fog: '#14100a', fogNear: 15, fogFar: 110,
    skyTop: '#0d0a06', skyHor: '#33291a', sunDisc: '#ffdfae', sunSize: 0.0028, sat: 0.95, vig: 0.36, shadowExt: 30, aurora: 0, gain: '#ffcf96',
    waterDeep: '#0a2438', waterShal: '#1d4e5f', glint: '#ffe9c0' },
  alarm: { az: 262, el: 34, sky: '#2e3d5c', ground: '#171208', hemi: 0.8, sun: '#a9c2e8', sunI: 0.85, fog: '#0b0d14', fogNear: 24, fogFar: 180,
    skyTop: '#05080f', skyHor: '#1c2637', sunDisc: '#e3ecff', sunSize: 0.003, sat: 1.1, vig: 0.28, shadowExt: 30, aurora: 0, gain: '#ffe4ba',
    waterDeep: '#0a2438', waterShal: '#1d4e5f', glint: '#ffe9c0' },
};
const hexLerp = (a, b, t) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(lerp(v, pb[i], t)).toString(16).padStart(2, '0')).join('');
};
const blendLight = (A, B2, t) => {
  const o = {};
  for (const k of Object.keys(A)) o[k] = typeof A[k] === 'number' ? lerp(A[k], B2[k], t) : hexLerp(A[k], B2[k], t);
  return o;
};
// the ringing envelope: 0 in the quiet beats, violent at the two wire hits,
// sustained through the bell tour, dying as the watchman sits up.
export const bellKAt = (f) => {
  const S = shotAt(f).id;
  if (S === 'bells') return f < HIT ? 0 : Math.max(0, 1.25 - (f - HIT) / 110) * (0.72 + 0.28 * Math.sin(f * 0.85));
  if (S === 'bellrow') return (0.82 - 0.27 * ramp(f, B('bellrow'), E('bellrow'))) * (0.75 + 0.25 * Math.sin(f * 0.85));
  if (S === 'wake') return 0.16 * (1 - ramp(f, B('wake'), B('wake') + 60));
  if (S === 'catrat') return f < HIT2 ? 0 : Math.max(0, 1.1 - (f - HIT2) / 45) * (0.7 + 0.3 * Math.sin(f * 0.9));
  return 0;
};
export const lightFor = (S, f) => {
  const base = { ...LIGHTS[S.light] };
  const bk = bellKAt(f);
  if (bk > 0.02 && S.light === 'night') return blendLight(base, LIGHTS.alarm, clamp(bk * 0.7));
  return base;
};

// ---------- cast staging ----------
// the watchman's body roll: 1.38 = lying flat on the bedroll (head toward
// -x, resting on the pillow), 0 = standing. The card rotates about its
// feet, so lying down / sitting up read as one continuous body move.
export const rollAt = (f) => {
  const S = shotAt(f).id;
  if (S === 'sleep') return 1.38 * smooth(ramp(f, B('sleep') + 6, B('sleep') + 68));   // R2: he SETTLES onto the cot in the opening
  if (S === 'lie') return 1.38 * smooth(ramp(f, B('lie') + 51, B('lie') + 81));
  if (S === 'thieves' || S === 'bells' || S === 'bellrow') return 1.38;
  if (S === 'wake') return 1.38 * (1 - smooth(ramp(f, B('wake') + 8, B('wake') + 46)));
  return 0;
};
// tying beat: he walks the z=2.6 lane, kneels at two wires to tie them.
const tyingPose = poseWindows([
  { a: 574, b: 602, mode: 'kneel1', inF: 6, outF: 6 },
  { a: 637, b: 672, mode: 'kneel1', inF: 6, outF: 6 },
]);
export const tyingXAt = (f) => {
  if (f < 574) return lerp(7.5, 4.1, smooth(ramp(f, 535, 574)));
  if (f < 602) return 4.1;
  if (f < 637) return lerp(4.1, -1.1, smooth(ramp(f, 602, 637)));
  return -1.1;
};
// the watchman's ground position per beat.
export const watchmanAt = (f) => {
  const S = shotAt(f).id;
  if (S === 'hire') return { x: 10.05, z: -3.25 };
  if (S === 'tying') return { x: tyingXAt(f), z: 2.6 };
  if (S === 'lie') {
    const u = smooth(ramp(f, B('lie'), B('lie') + 41));
    return { x: lerp(-1.1, BED.x, u), z: lerp(2.6, BED.z, u) };
  }
  return { x: BED.x, z: BED.z };
};
// thieves: descent at the rope, the tiptoe creep, the three fatal steps.
const STEP_LANDS = [
  [[955, -9.35], [983, -8.2], [1013, -6.2]],
  [[961, -10.2], [989, -9.05], [1019, -7.9]],
  [[967, -11.0], [995, -9.85], [1025, -8.7]],
];
const THIEF_HOME = [
  { x: -10.55, z: -2.0 }, { x: -11.35, z: -1.45 }, { x: -12.15, z: -2.55 },
];
const stepX = (i, f) => {
  // staircase: each landing contributes its delta over the 11f before it
  let prev = THIEF_HOME[i].x, x = THIEF_HOME[i].x;
  for (const [lf, lx] of STEP_LANDS[i]) { x += (lx - prev) * smooth(ramp(f, lf - 11, lf)); prev = lx; }
  return x;
};
// descent choreography: ONE rope at (-12.12, -2.0), used strictly in turn;
// the next man waits crouched at a window corner (clear in plan view), and
// each landed man scurries off along a side lane before the next descends.
const DESCENT = [
  { s: 792, l: 838, wait: null, creeps: [[838, 848, -11.2, -2.9], [848, 932, -10.55, -2.0]] },
  { s: 844, l: 890, wait: [-12.6, 5.6, -3.1], creeps: [[890, 902, -11.45, -0.7], [902, 932, -11.35, -1.45]] },
  { s: 896, l: 932, wait: [-12.6, 5.6, -0.9], creeps: [] },
];
export const thiefAt = (i, f) => {
  const S = shotAt(f).id;
  if (S === 'thieves') {
    const D = DESCENT[i];
    if (f < D.s) return { x: D.wait[0], z: D.wait[2], y: D.wait[1], ground: D.wait[1], aboard: 1 };
    if (f < D.l) { const y = lerp(4.9, 0, smooth(ramp(f, D.s, D.l))); return { x: -12.12, z: -2.0, y, ground: y, aboard: 1 }; }
    let px = -12.12, pz = -2.0;
    for (const [a, b, tx, tz] of D.creeps) {
      if (f >= b) { px = tx; pz = tz; continue; }
      if (f >= a) { const u = smooth(ramp(f, a, b)); return { x: lerp(px, tx, u), z: lerp(pz, tz, u), y: 0, ground: 0, aboard: 0 }; }
      break;
    }
    return { x: px, z: pz, y: 0, ground: 0, aboard: 0 };
  }
  if (S === 'bells') {
    const fe = Math.min(f, HIT);
    return { x: stepX(i, fe), z: THIEF_HOME[i].z, y: 0, ground: 0, aboard: 0 };
  }
  if (S === 'catrat' && i === 0) {
    if (f < HIT2) return { x: lerp(-8.7, -6.2, smooth(ramp(f, B('catrat'), HIT2))), z: -2.3, y: 0, ground: 0, aboard: 0 };
    return { x: lerp(-6.2, -6.7, smooth(ramp(f, HIT2, HIT2 + 12))), z: -2.3, y: 0, ground: 0, aboard: 0 };
  }
  // frozen where the bells caught them (wake / yawn / wirecu)
  return { x: stepX(i, HIT), z: THIEF_HOME[i].z, y: 0, ground: 0, aboard: 0 };
};
// the silk bale the lead thief carries in L14 — and drops at the wire.
export const baleAt = (f) => {
  if (shotAt(f).id !== 'catrat') return { x: 0, y: -5, z: 0, k: 0 };
  const t1 = thiefAt(0, f);
  if (f < HIT2) return { x: t1.x + 0.42, y: 1.52, z: t1.z + 0.12, k: 1 };
  const u = ramp(f, HIT2, HIT2 + 16);
  let y = 1.52 - (1.52 - 0.27) * u * u;
  if (f >= HIT2 + 16 && f < HIT2 + 22) y = 0.27 + 0.05 * Math.sin((f - HIT2 - 16) * 1.1) * (1 - (f - HIT2 - 16) / 6);
  return { x: lerp(-6.2 + 0.42, -5.6, u), y, z: t1.z + 0.12, k: 1 };
};
// the memory thief's loot sack (L3 flashback).
export const sackAt = (f) => {
  if (shotAt(f).id !== 'memory') return { x: 0, y: -5, z: 0, k: 0 };
  const x = lerp(8.5, 2.0, smooth(ramp(f, B('memory') + 6, E('memory') - 4)));
  return { x: x - 0.34, y: 1.12, z: -4.72, k: 1 };
};
export const GUARDS = [{ x: 2.5, z: -3.4 }, { x: 5.5, z: -3.4 }];

// ---------- body.js performance tracks ----------
const watchmanGaze = gazeTrack([
  { f: 0, lookY: 0.1, look: 0 },
  { f: 535, lookY: -0.25, look: -0.2 },
  { f: 1062, lookY: 0.05, look: 0.2 },
  { f: 1315, lookY: 0.05, look: -0.45 },
  { f: 1412, lookY: 0.02, look: -0.3 },
]);
const guardGaze = gazeTrack([
  { f: 286, look: -0.5, lookY: 0.05 },
  { f: 340, look: 0.55, lookY: 0.05 },
  { f: 395, look: -0.2, lookY: 0.1 },
]);
const watchmanWink = winkTrack([{ a: 1470, b: 1481 }]);
const micro = (f, seed) => 1.1 * Math.sin((f + seed * 5) * 0.037 + 1);
const head = (f, seed, tilt, look, lookY, facing = 0, squash = 0) => ({
  headTilt: q(tilt + micro(f, seed), 1), look: q(look, 2), lookY: q(lookY, 2), facing: q(facing, 2), squash: q(squash, 2),
});

// ---------- hero / focus ----------
const FOCUS = {
  sleep: (f) => { const u = smooth(ramp(f, B('sleep') + 6, B('sleep') + 68)); return [lerp(1.6, -0.35, u), lerp(1.5, 0.42, u), 0.95]; },
  treasure: () => [0, 1.4, -6.4],
  memory: () => [4.0, 1.2, -3.9],
  hire: () => [10.7, 1.3, -3.85],
  tying: (f) => [tyingXAt(f), 0.9, 2.6],
  lie: () => [0.3, 0.7, 1.1],
  thieves: () => [-11.7, 2.4, -2.0],
  bells: (f) => { const t1 = thiefAt(0, Math.min(f, HIT)); return [t1.x, lerp(0.5, 1.8, ramp(f, HIT, HIT + 42)), t1.z]; },
  bellrow: () => [2.0, 1.1, -3.0],
  wake: () => [1.3, 1.0, 0.95],
  yawn: () => [1.55, 1.4, 0.9],
  dialogue: () => [BED.x, 1.45, BED.z],
  wirecu: () => [-6.02, 0.55, -2.6],
  catrat: () => [-6.3, 0.5, -2.0],
  hook: () => BOARD_POS,
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id](f);

// ---------- cameras: EVERY shot is a camrig track on a subject ----------
const tyingKeys = () => {
  const frames = [535, 574, 602, 637, 664];
  return frames.map((f, i) => {
    const wx = tyingXAt(f);
    return { f, pos: [wx + 3.1, 1.5, 5.0], look: [wx - 0.3, 0.85, 2.5], fov: 38 - i * 0.8, ...(i === frames.length - 1 ? { ease: 'io' } : {}) };
  });
};
const RIG_BY_ID = {
  sleep: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('sleep'), pos: [3.9, 1.28, 3.55], look: [1.05, 1.1, 0.92], fov: 38 },
    { f: B('sleep') + 50, pos: [3.05, 0.98, 3.25], look: [0.0, 0.65, 0.95], fov: 35 },
    { f: E('sleep'), pos: [1.15, 0.72, 2.95], look: [-0.42, 0.38, 0.98], fov: 33, ease: 'io' }] }) },
  treasure: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('treasure'), pos: [-7.5, 1.7, -2.2], look: [-6.2, 1.3, -6.4], fov: 40 },
    { f: E('treasure'), pos: [6.5, 1.8, -2.4], look: [7.5, 1.2, -6.4], fov: 37, ease: 'io' }] }) },
  memory: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('memory'), pos: [4.2, 1.6, 1.9], look: [4.0, 1.2, -3.8], fov: 39 },
    { f: E('memory'), pos: [3.9, 1.5, 1.2], look: [4.05, 1.25, -3.85], fov: 35, ease: 'io' }] }) },
  hire: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('hire'), pos: [7.6, 1.75, -0.4], look: [10.7, 1.25, -3.85], fov: 37 },
    { f: E('hire'), pos: [7.2, 1.65, -0.7], look: [10.75, 1.28, -3.85], fov: 33, ease: 'io' }] }) },
  tying: { cut: 'hard', raw: keysCam({ keys: tyingKeys() }) },
  lie: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('lie'), pos: [4.55, 2.35, 5.1], look: [0.2, 0.7, 1.1], fov: 42 },
    { f: E('lie'), pos: [4.0, 2.0, 4.55], look: [0.25, 0.65, 1.1], fov: 37, ease: 'io' }] }) },
  thieves: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('thieves'), pos: [-4.6, 1.0, 1.4], look: [-11.9, 2.9, -2.0], fov: 43 },
    { f: E('thieves'), pos: [-5.4, 1.05, 0.9], look: [-11.6, 2.0, -2.0], fov: 40, ease: 'io' }] }) },
  bells: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('bells'), pos: [-3.0, 0.6, 0.9], look: [-9.6, 0.5, -2.0], fov: 41 },
    { f: B('bells') + 52, pos: [-3.95, 0.44, -0.3], look: [-8.3, 0.42, -2.05], fov: 37 },
    { f: B('bells') + 65, pos: [-4.2, 0.4, -0.6], look: [-7.4, 0.42, -2.12], fov: 36.5 },
    { f: HIT, pos: [-4.05, 0.38, -0.9], look: [-6.12, 0.44, -2.32], fov: 44 },
    { f: HIT + 19, pos: [-4.55, 0.95, -0.45], look: [-6.3, 1.0, -2.1], fov: 33 },
    { f: E('bells'), pos: [-4.75, 1.55, -0.55], look: [-6.22, 1.82, -2.02], fov: 31, ease: 'io' }] }) },
  bellrow: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('bellrow'), pos: [-8.8, 1.35, 3.6], look: [-3.0, 1.1, -3.2], fov: 42 },
    { f: B('bellrow') + 58, pos: [-1.5, 1.3, 3.4], look: [3.5, 1.2, -3.6], fov: 40 },
    { f: E('bellrow'), pos: [5.8, 1.35, 3.2], look: [11.8, 1.7, -4.3], fov: 38, ease: 'io' }] }) },
  wake: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('wake'), pos: [3.55, 1.45, 4.8], look: [1.2, 0.9, 1.0], fov: 35 },
    { f: E('wake'), pos: [2.75, 1.3, 3.35], look: [1.5, 1.15, 0.95], fov: 30, ease: 'io' }] }) },
  yawn: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('yawn'), pos: [-2.2, 1.5, 3.6], look: [1.3, 1.28, 0.88], fov: 36 },
    { f: E('yawn'), pos: [-2.5, 1.45, 3.3], look: [1.38, 1.3, 0.88], fov: 33, ease: 'io' }] }) },
  dialogue: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('dialogue'), pos: [2.8, 1.52, 3.15], look: [1.58, 1.43, 0.92], fov: 30 },
    { f: E('dialogue'), pos: [2.5, 1.47, 2.8], look: [1.6, 1.44, 0.92], fov: 26, ease: 'io' }] }) },
  wirecu: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('wirecu'), pos: [-4.35, 0.72, -0.95], look: [-6.02, 0.52, -2.58], fov: 36 },
    { f: B('wirecu') + 74, pos: [-4.95, 0.62, -1.55], look: [-6.03, 0.55, -2.6], fov: 33 },
    { f: E('wirecu'), pos: [-5.45, 0.56, -2.05], look: [-6.04, 0.57, -2.6], fov: 31, ease: 'io' }] }) },
  catrat: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('catrat'), pos: [-3.1, 0.9, 2.2], look: [-6.3, 0.55, -2.0], fov: 39 },
    { f: E('catrat'), pos: [-3.5, 0.85, 1.9], look: [-6.3, 0.55, -2.0], fov: 36, ease: 'io' }] }) },
  hook: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('hook'), pos: [-1.6, 2.36, 0.55], look: [12.3, 2.62, 0.5], fov: 39 },
    { f: E('hook'), pos: [-0.7, 2.3, 0.55], look: [12.3, 2.62, 0.5], fov: 37.5, ease: 'io' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: HIT, a: 0.035 }, { f: HIT2, a: 0.03 }],
  sigma: 3.2, smoothRadius: 10, fovSigma: 1.6,
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
  const CIN = { sleep: 3.2, treasure: 1.5, memory: 2.0, hire: 3.0, tying: 2.2, lie: 1.8, thieves: 2.0, bells: 2.6, bellrow: 1.6, wake: 3.2, yawn: 2.6, dialogue: 3.8, wirecu: 3.4, catrat: 3.0, hook: 1.6 };
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf: CIN[S.id] || 2.2 };
};

// ---------- world state ----------
export const lampKAt = (f) => {
  const S = shotAt(f).id;
  if (S === 'sleep') return lerp(0.85, 0.38, smooth(ramp(f, B('sleep'), B('sleep') + 100)));   // R2: the lamps dim as he settles
  if (S === 'wake') return lerp(0.4, 1, smooth(ramp(f, B('wake') + 52, B('wake') + 72)));
  if (S === 'yawn' || S === 'dialogue' || S === 'wirecu' || S === 'catrat') return 1;
  if (S === 'hook') return 0.7;
  return 0.4;
};
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = {
    boardHook: 0,
    bellK: bellKAt(f),
    lampK: lampKAt(f),
    shaftK: S.id === 'thieves' ? 1 : S.id === 'bells' ? 0.7 : 0.3,
    lampWireK: S.id === 'bells' ? 1 : 0,
    wireK: S.id === 'wirecu' ? 0.4 : bellKAt(f),
    dustK: 0.05,
  };
  if (S.id === 'hook') W.boardHook = f < B('hook') + 20 ? smooth(ramp(f, B('hook') + 2, B('hook') + 20)) : 1;  // held at FULL opacity to the literal last frame
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return {
    moteRate: 0.5,                                   // dust motes inside the lantern light
    shaftRate: S.id === 'thieves' ? 0.9 : S.id === 'bells' ? 0.5 : 0.15,  // dust in the moon shaft
    smokeRate: 0.0, dustRate: 0.03,
  };
};
// the Zzz of a man who snores like a drum — over the bedroll while he lies.
export const fxAt = (f, T) => {
  const S = shotAt(f);
  const lying = (S.id === 'sleep' && f >= B('sleep') + 75) || (S.id === 'lie' && f >= B('lie') + 75) || S.id === 'thieves' || S.id === 'bells';
  if (!lying) return [];
  const t = (f % 48) / 48;
  return [{ key: 'zzz' + Math.floor(f / 2), draw: (p) => T.fxZ(p, t), x: BED.x - 2.0, y: 0.5, z: BED.z + 0.2, s: 0.85, blob: false, shadow: false }];
};

// ---------- cast (single source for actors AND colliders) ----------
const TINT = { night: '#ffe9d2', memory: '#ffe3c0' };
const tintFor = (S) => TINT[S.light] || TINT.night;
export const OUTFITS = {
  watchman: { jacket: '#3d4a3a', pants: '#2c2620', boots: '#17120d', hat: 'cap', cap: '#4a3b28', skin: '#fbf7ef', moustache: '#cfd4d8' },
  owner: { jacket: '#4a2c50', pants: '#241d2e', boots: '#17120d', hat: 'bowler', skin: '#fbf7ef', moustache: '#2a1c12' },
  guard: { jacket: '#2e4059', pants: '#232a33', boots: '#17120d', hat: 'cap', cap: '#1f2c3f', skin: '#fbf7ef' },
  thief1: { jacket: '#23242a', pants: '#1b1b20', boots: '#100d0a', hat: 'cap', cap: '#131316', skin: '#fbf7ef' },
  thief2: { jacket: '#2a2326', pants: '#1e1a1c', boots: '#100d0a', hat: 'cap', cap: '#1c1512', skin: '#fbf7ef' },
  thief3: { jacket: '#1f2a24', pants: '#18211c', boots: '#100d0a', hat: 'hair', hair: '#0f0d0b', skin: '#fbf7ef' },
  memthief: { jacket: '#26221f', pants: '#1c1a18', boots: '#100d0a', hat: 'cap', cap: '#17130f', skin: '#fbf7ef' },
};
const THIEF_OUTFITS = [OUTFITS.thief1, OUTFITS.thief2, OUTFITS.thief3];
// a small front-facing cat and rat, drawn in the card's lower band so their
// backs stay UNDER the knee-high wire they slip beneath.
const drawCat = (p) => {
  const col = '#454c59';
  p.stroke([[392, 905], [452, 838], [470, 762]], 15, col);
  p.ell(300, 884, 98, 60, col, 10);
  p.ell(300, 776, 63, 56, col, 10);
  p.poly([[248, 742], [262, 668], [292, 726]], col, 9);
  p.poly([[352, 742], [338, 668], [308, 726]], col, 9);
  p.ell(276, 770, 10, 12, '#ffd76a', 3);
  p.ell(324, 770, 10, 12, '#ffd76a', 3);
  p.dot(300, 792, 5);
  p.ell(222, 946, 27, 15, col, 8);
  p.ell(378, 946, 27, 15, col, 8);
};
const drawRat = (p) => {
  const col = '#6d727c';
  p.stroke([[228, 918], [150, 900], [104, 862]], 8, '#9a8a76');
  p.ell(308, 906, 82, 33, col, 8);
  p.ell(382, 890, 35, 25, col, 8);
  p.ell(362, 862, 12, 12, '#979da6', 6);
  p.dot(392, 886, 4.5);
  p.ell(262, 940, 20, 10, col, 6);
  p.ell(352, 940, 20, 10, col, 6);
};
export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, z, extra = {}) => out.push({ id, x, y: extra.y ?? 0, z, r: 0.32, ground: extra.ground ?? 0,
    actor: (T) => ({ key: 'whx' + JSON.stringify(o) + JSON.stringify(opts) + (extra.y ?? 0), draw: (p) => T.bodyFront(p, o, opts), x, y: extra.y ?? 0, z, ground: extra.ground ?? 0, tint, ...extra }) });
  const WG = watchmanGaze(f);
  const wm = watchmanAt(f);
  const watchmanLying = (opts, extra = {}) => std('watchman', OUTFITS.watchman, opts, BED.x, BED.z, { roll: rollAt(f), blob: false, ...extra });
  const watchmanStd = (opts, extra = {}) => std('watchman', OUTFITS.watchman, opts, wm.x, wm.z, extra);
  const thiefStd = (i, opts, extra = {}) => { const tp = thiefAt(i, f); return std('thief' + (i + 1), THIEF_OUTFITS[i], opts, tp.x, tp.z, { y: tp.y, ground: tp.ground, blob: tp.aboard ? false : undefined, ...extra }); };
  switch (S.id) {
    case 'sleep': {
      // R2 OPENING: the hero BIG beside his bedroll — he settles onto the
      // cot over the first ~2 s (rollAt), then snores like a drum while
      // the lamps dim around him.
      if (f < B('sleep') + 70) {
        watchmanLying({ expr: 'neutral', exprP: T.faceP('sleepy'), mode: 'stand', blink: blinkAt(f, 31), seed: 31,
          ...head(f, 31, 2, 0, -0.15, 0) });
      } else {
        watchmanLying({ expr: 'neutral', exprP: T.faceP('snore'), mode: 'stand', blink: 0, seed: 31,
          ...head(f, 31, 2, 0, 0.1, 0) });
      }
      break;
    }
    case 'treasure': break;   // the goods speak for themselves
    case 'memory': {
      // wide-awake guards with lanterns, stern and searching — while a
      // thief slips along the shelves BEHIND them with a full sack.
      const GG = guardGaze(f);
      std('guard1', OUTFITS.guard, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 71), seed: 71, prop: ['point', 0.7],
        ...head(f, 71, 0, GG.look, GG.lookY, 0.1) }, GUARDS[0].x, GUARDS[0].z, { yaw: 0.1 });
      std('guard2', OUTFITS.guard, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 72), seed: 72,
        ...head(f, 72, 0, -GG.look, GG.lookY, -0.1) }, GUARDS[1].x, GUARDS[1].z, { yaw: -0.1 });
      const mx = lerp(8.5, 2.0, smooth(ramp(f, B('memory') + 6, E('memory') - 4)));
      std('memthief', OUTFITS.memthief, { expr: 'nervous', mode: 'stroll', phase: q(((8.5 - mx) / 1.55) % 1, 2), blink: blinkAt(f, 73), seed: 73,
        ...head(f, 73, 4, -0.3, -0.15, -0.2) }, mx, -4.6, { yaw: -0.4 });
      break;
    }
    case 'hire': {
      std('owner', OUTFITS.owner, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 61), seed: 61, prop: ['coin', 0.55],
        ...head(f, 61, 0, -0.4, 0.02, -0.25) }, 11.35, -4.35, { yaw: -0.55 });
      watchmanStd({ expr: 'smile', mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, 1, 0.35, 0.05, 0.2) }, { yaw: 0.5 });
      break;
    }
    case 'tying': {
      const P = tyingPose(f);
      const walking = P.mode === 'stand';
      const dist = Math.abs(tyingXAt(f) - 7.5) + (f > 602 ? Math.abs(tyingXAt(f) - 4.1) : 0);
      watchmanStd({ expr: 'neutral', mode: walking ? 'march' : P.mode, squash: P.squash, phase: q((dist / 1.55) % 1, 2),
        blink: blinkAt(f, 31), seed: 31, prop: walking ? null : ['sew', 0.5],
        ...head(f, 31, walking ? 0 : -4, WG.look, walking ? 0 : -0.3, -0.15) }, { yaw: walking ? -0.45 : -0.7 });
      break;
    }
    case 'lie': {
      const walking = f < B('lie') + 41;
      const rolling = f >= B('lie') + 51;
      if (!rolling) {
        const dist = Math.hypot(wm.x - -1.1, wm.z - 2.6);
        watchmanStd({ expr: 'neutral', exprP: T.faceP('sleepy'), mode: walking ? 'march' : 'stand',
          phase: q((dist / 1.55) % 1, 2), blink: blinkAt(f, 31), seed: 31,
          ...head(f, 31, 2, 0.15, -0.1, 0.1) }, { yaw: 0.35 });
      } else {
        watchmanLying({ expr: 'neutral', exprP: T.faceP('snore'), mode: 'stand', blink: 0, seed: 31,
          ...head(f, 31, 2, 0, 0.1, 0) });
      }
      break;
    }
    case 'thieves': {
      for (let i = 0; i < 3; i++) {
        const tp = thiefAt(i, f);
        const onRope = tp.aboard && tp.y > 0.05;
        thiefStd(i, { expr: 'nervous', mode: onRope ? 'stand' : 'stroll', phase: q((f * 0.008 + i * 0.3) % 1, 2), blink: blinkAt(f, 81 + i), seed: 81 + i,
          ...head(f, 81 + i, 5, 0.2, -0.3, 0) }, { yaw: 0.15 });
      }
      watchmanLying({ expr: 'neutral', exprP: T.faceP('snore'), mode: 'stand', blink: 0, seed: 31,
        ...head(f, 31, 2, 0, 0.1, 0) });
      break;
    }
    case 'bells': {
      for (let i = 0; i < 3; i++) {
        const hit = f >= HIT;
        const tp = thiefAt(i, f);
        thiefStd(i, { expr: hit ? 'shock' : 'nervous', mode: 'march', phase: q((Math.abs(tp.x - THIEF_HOME[i].x) / 1.55) % 1, 2),
          blink: blinkAt(f, 81 + i), seed: 81 + i,
          ...head(f, 81 + i, hit ? -2 : 5, 0.15, hit ? 0.1 : -0.3, 0) }, { yaw: 0.2 });
      }
      break;
    }
    case 'bellrow': break;   // the bells themselves are the cast here
    case 'wake': {
      const sitting = f < B('wake') + 46;
      if (sitting) {
        watchmanLying({ expr: 'neutral', exprP: T.faceP('sleepy'), mode: 'stand', blink: blinkAt(f, 31), seed: 31,
          ...head(f, 31, 2, 0, 0.05, 0) });
      } else {
        watchmanStd({ expr: 'neutral', exprP: T.faceP('sleepy'), mode: 'stand', blink: blinkAt(f, 31), seed: 31,
          ...head(f, 31, 2, -0.2, 0.05, 0) }, { yaw: 0.3 });
      }
      for (let i = 0; i < 3; i++)
        thiefStd(i, { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 81 + i), seed: 81 + i,
          ...head(f, 81 + i, 1, -0.2, 0, 0) }, { yaw: -0.2 });
      break;
    }
    case 'yawn': {
      // a huge yawn first — mouth wide on a sleepy face — then the smile
      // of a man about to explain. The thieves only tremble.
      const yawning = f < B('yawn') + 38;
      const yawnP = { ...T.faceP('sleepy'), mOpen: 0.85, curve: 0.1 };
      if (yawning) watchmanStd({ expr: 'neutral', exprP: yawnP, mode: 'stand', blink: 0, seed: 31,
        ...head(f, 31, -3, -0.4, 0.1, -0.15) }, { yaw: -0.35 });
      else watchmanStd({ expr: 'smile', mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, 0, WG.look, 0.05, -0.1) }, { yaw: -0.35 });
      for (let i = 0; i < 3; i++) {
        const tp = thiefAt(i, f);
        std('thief' + (i + 1), THIEF_OUTFITS[i], { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 81 + i), seed: 81 + i,
          ...head(f, 81 + i, 1, 0.25, 0, 0) }, tp.x + 0.012 * Math.sin(f * 2.7 + i * 2.1), tp.z, { yaw: 0.25 });
      }
      break;
    }
    case 'dialogue': {
      // THE dialogue beat: the watchman PERFORMS his line — mouth driven
      // by the stem inside the speak segment, closed outside it, with a
      // wink on "awake". Nobody else is in frame; nobody else speaks.
      let KP = speakFace('smile', f);
      const wk = watchmanWink(f);
      if (wk > 0) KP = { ...KP, exprP: T.blendFaceP(KP.exprP, T.faceP('wink'), wk) };
      watchmanStd({ mode: 'stand', blink: blinkAt(f, 31), seed: 31, look: -0.25, ...KP }, { yaw: -0.3 });
      break;
    }
    case 'wirecu': break;   // R2: a PURE rig insert — wire, stake and bell only, no faces at the edges
    case 'catrat': {
      const catX = lerp(-8.8, -3.4, smooth(ramp(f, B('catrat') + 4, B('catrat') + 78)));
      const ratX = lerp(-9.4, -3.0, smooth(ramp(f, B('catrat') + 44, B('catrat') + 100)));
      out.push({ id: 'cat', x: catX, y: Math.abs(Math.sin(f * 0.55)) * 0.025, z: -0.9, r: 0.2, ground: 0,
        actor: (T) => ({ key: 'cat1', draw: drawCat, x: catX, y: Math.abs(Math.sin(f * 0.55)) * 0.025, z: -0.9, ground: 0, tint, s: 0.3 }) });
      if (f >= B('catrat') + 40) out.push({ id: 'rat', x: ratX, y: Math.abs(Math.sin(f * 0.8)) * 0.015, z: -1.6, r: 0.14, ground: 0,
        actor: (T) => ({ key: 'rat1', draw: drawRat, x: ratX, y: Math.abs(Math.sin(f * 0.8)) * 0.015, z: -1.6, ground: 0, tint, s: 0.5 }) });
      const hit = f >= HIT2;
      thiefStd(0, { expr: hit ? 'shock' : 'nervous', mode: 'march', phase: q((Math.abs(thiefAt(0, f).x + 8.7) / 1.55) % 1, 2),
        blink: blinkAt(f, 81), seed: 81, ...head(f, 81, hit ? -2 : 4, 0.1, hit ? 0.1 : -0.2, 0) }, { yaw: 0.2 });
      break;
    }
    case 'hook': {
      // R2 FINAL: character beat + board together — the watchman stands
      // in the foreground, lantern-side, grinning and pointing up at his
      // board while it holds at full opacity behind him.
      std('watchman', OUTFITS.watchman, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.55],
        ...head(f, 31, 0, 0.45, 0.15, 0.1) }, HOOK_POS.x, HOOK_POS.z, { yaw: 0.15 });
      break;
    }
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity: statics, dynamics, ground (LIBRARY v3 gate data) ----------
export const STATICS = [
  SOL.obb(0, -6.6, 0, 11.6, 0.8, { h: 3.2, id: 'shelfB' }),
  SOL.obb(0, 6.6, 0, 11.6, 0.8, { h: 3.2, id: 'shelfF' }),
  SOL.circle(BOARD_POS[0], BOARD_POS[2] - 2.35, 0.09, { h: 3.8, id: 'boardpost' }),
  SOL.circle(BOARD_POS[0], BOARD_POS[2] + 2.35, 0.09, { h: 3.8, id: 'boardpost' }),
  SOL.circle(2.35, 1.95, 0.16, { h: 0.42, id: 'lantern' }),
];
export const WORLD = SOL.makeWorld(STATICS);
export const dynamicsAt = (f) => {
  const out = [];
  for (const a of castAt(f)) out.push(SOL.circle(a.x, a.z, a.r, { kind: 'dynamic', id: a.id }));
  return out;
};
export const groundItemsAt = (f) => {
  const items = [];
  for (const a of castAt(f)) items.push({ id: a.id, y: a.y, ground: a.ground ?? 0, maxHover: 0.06 });
  return items;
};
