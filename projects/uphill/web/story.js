// Shot plan for "The Night the River Flowed Uphill" — uphill (Batch 8 E4,
// Mirror Trick Tales). LIBRARY v4: speak.js dialogue performance +
// materials v4, camrig smooth tracking + solid colliders.
// ONE set: a riverbank at dusk + the canal LOCK climbing the hill west.
// A boat sails into the lock, the chamber fills, the boat rises a full
// house high, and sails out on water that was above its head. The miller
// (whose brother built the lock) tells the frightened crowd the truth.
// Voice stem: 53.171 s, 30 fps, TOTAL 1595; timings from faster-whisper
// small word alignment (words.json / timing.json). Scene changes ONLY at
// clause (script-line) boundaries:
//   L1  drone     fishermen drop their nets and run — the river flows uphill
//   L2  creep     water creeps up the slope, carrying two loaded boats
//   L3  crowd     half the town on the bank, watching the river climb
//   L4  omen      old men call it an omen; somebody runs to fetch the priest
//   L5  miller    the miller stays at his supper, laughing (brother built it)
//   L6  lock      the staircase of stone chambers above the town
//   L7  enter     a boat sails in, great gates close, water let in
//   L8  rise      the chamber fills; the boat rises a full house high
//   L9  exit      top gates open; the boat sails out on higher water
//   L10 truth     the miller comes down, wiping his hands, tells the truth
//   L11 dialogue  "Water never climbs, friends. It only waits to be lifted."
//   L12 hookq/hook  the king who woke up with no voice at all? (hook board)
// GRADE (FILTER_VFX_LIGHTING pack): Monsoon Grey throughout — desaturated
// blue-grey, soft contrast, wet sheen; the miller supper beat warms under
// a lamp pool, the hook beat warms toward dusk. Grade changes ONLY on
// clause boundaries. Signature VFX: the rising chamber water + sluice
// pour, wet sheen on the bank, mist over the river at dusk.
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

export const FPS = 30, TOTAL = 1595, DECK = 0;
// Shot boundaries (frames) — snapped to timing.json phrase starts.
// [drone, creep, crowd, omen, miller, lock, enter, rise, exit, truth, dialogue, hookq, hook]
export const BND = [0, 145, 269, 413, 514, 665, 803, 958, 1096, 1227, 1354, 1451, 1520, 1595];
const IDS = ['drone', 'creep', 'crowd', 'omen', 'miller', 'lock', 'enter', 'rise', 'exit', 'truth', 'dialogue', 'hookq', 'hook'];
export const SHOTS = IDS.map((id, i) => ({ id, a: BND[i], b: BND[i + 1] - 1, light: 'grey' }));
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
const F = (id) => SHOTS.find((s) => s.id === id);

// ---------- lights / mood grades (Monsoon Grey family) ----------
export const LIGHTS = {
  grey: { az: 212, el: 26, sky: '#8fa3ad', ground: '#4a5050', hemi: 1.12, sun: '#e8e4d8', sunI: 1.9, fog: '#9aa8ad', fogNear: 46, fogFar: 330,
    skyTop: '#5a7180', skyHor: '#c3ccd0', sunDisc: '#f2ecdc', sunSize: 0.0038, sat: 0.92, vig: 0.26, shadowExt: 26, aurora: 0, gain: '#dde4e6',
    waterDeep: '#2e4a52', waterShal: '#5d8288', glint: '#d8e8e8' },
  lamp: { az: 218, el: 30, sky: '#a89a80', ground: '#4c463c', hemi: 0.96, sun: '#ffbe78', sunI: 2.1, fog: '#a8a094', fogNear: 44, fogFar: 320,
    skyTop: '#5a6a7a', skyHor: '#d8b98e', sunDisc: '#ffbe78', sunSize: 0.0034, sat: 1.0, vig: 0.26, shadowExt: 26, aurora: 0, gain: '#efe0c0',
    waterDeep: '#2e4a52', waterShal: '#5d8288', glint: '#ffe0b0' },
  dusk: { az: 246, el: 14, sky: '#c9a184', ground: '#4c5648', hemi: 0.94, sun: '#ffab5e', sunI: 2.0, fog: '#cfb49a', fogNear: 44, fogFar: 310,
    skyTop: '#2c4a72', skyHor: '#f0b57e', sunDisc: '#ffbe78', sunSize: 0.003, sat: 1.04, vig: 0.29, shadowExt: 24, aurora: 0, gain: '#f2ddba',
    waterDeep: '#173f57', waterShal: '#2e7ea6', glint: '#ffe9c0' },
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
  if (S.id === 'miller') return { ...LIGHTS.lamp };
  if (S.id === 'hookq') return blendLight(LIGHTS.grey, LIGHTS.dusk, smooth(ramp(f, F('hookq').a, F('hookq').a + 45)));
  if (S.id === 'hook') return { ...LIGHTS.dusk };
  return { ...LIGHTS.grey };
};

// ---------- staging (shared by story, main, colliders) ----------
export const BOARD_POS = [0, 3.1, -6];
// the hero lock chamber: x -14..-6, z -11..-5, floor y=-0.5, tall north
// wall (h 6) + low south parapet (h 2.0) so the camera sees in.
export const LOCK = { x0: -14, x1: -6, z0: -12, z1: -6, floorY: -0.5, wallH: 6, parapetH: 1.0, cx: -10, cz: -9 };
export const LOCK_RISE = 4.4;   // the boat rises a full house high
export const MILL = { x: 10, z: 6 };
export const TABLE = { x: 5, z: 2 };
export const PRIEST_HOUSE = { x: 16, z: 6 };
export const HUT1 = { x: 12, z: 11.5 };
export const HUT2 = { x: -2, z: 10 };
export const BANK_Z = -12;   // river edge (water beyond)

// ---------- the chamber water (the plot's engine) ----------
export const waterLevelAt = (f) => {
  const r = F('rise');
  if (f < r.a) return 0;
  if (f > r.b) return LOCK_RISE;
  return smooth(ramp(f, r.a + 6, r.b - 4)) * LOCK_RISE;
};
export const sluiceAt = (f) => {
  const r = F('rise');
  if (f < r.a + 4 || f > r.b) return 0;
  return smooth(ramp(f, r.a + 4, r.a + 24)) * (1 - smooth(ramp(f, r.b - 20, r.b)));
};
// lock gates: 1 = open, 0 = closed.
// the north (entrance) gate stands open until the boat is inside, then
// closes behind it; the west (exit) gate stays closed until the boat
// sails out on the higher water.
export const gateNorthAt = (f) => {
  const e = F('enter');
  if (f < e.b - 8) return 1;
  return 1 - smooth(ramp(f, e.b - 8, e.b + 12));
};
export const gateWestAt = (f) => {
  const e = F('exit');
  if (f < e.a) return 0;
  return smooth(ramp(f, e.a, e.a + 30));
};

// ---------- cast walks ----------
const walkKeys = (keys, f) => {
  let x = keys[0][1], z = keys[0][2];
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i][0]) { const a = keys[i - 1], b = keys[i]; const u = smooth(ramp(f, a[0], b[0])); return [lerp(a[1], b[1], u), lerp(a[2], b[2], u)]; }
    x = keys[keys.length - 1][1]; z = keys[keys.length - 1][2];
  }
  return [x, z];
};
const B = (id) => F(id).a, E = (id) => F(id).b;
const strolling = (f, spans) => spans.some(([a, b]) => f >= a && f <= b) ? 1 : 0;
// fisherman 1: at the nets on the river edge -> runs to town in L1
const F1_KEYS = [
  [0, 6, -10], [B('drone') + 30, 6, -10], [B('drone') + 78, 5, -2], [B('drone') + 110, 2.8, 1.0], [E('creep'), 2.8, 1.0],
  [B('crowd'), 4, -3.5], [E('crowd'), 4, -3.5], [B('truth'), 4, -3.5], [1594, 4, -3.5],
];
const F2_KEYS = [
  [0, -1, -10], [B('drone') + 26, -1, -10], [B('drone') + 70, 0.5, -1], [B('drone') + 104, 1, 3], [E('creep'), 1, 3],
  [B('crowd'), 0.2, -4.5], [E('crowd'), 0.2, -4.5], [B('truth'), 0.2, -4.5], [1594, 0.2, -4.5],
];
// the runner: a townsman sprints from the crowd to the priest's door (L4)
const RUN_KEYS = [
  [0, 7, -2], [B('omen') + 8, 7, -2], [B('omen') + 52, 12, 3], [B('omen') + 78, 14.8, 3.6], [E('omen'), 14.8, 3.6],
  [B('crowd') + 40, 14.8, 3.6], [1594, 14.8, 3.6],
];
// the priest: at his door, then walks around the house's west side to the bank
const PRIEST_KEYS = [
  [0, 15.2, 8.4], [B('omen') + 70, 15.2, 8.4], [B('omen') + 88, 13.0, 8.6], [B('omen') + 118, 13.0, -2.5],
  [E('omen'), 13.0, -2.5], [B('crowd'), 13.0, -2.5], [1594, 13.0, -2.5],
];
// the miller: at his supper table until L10; walks down to the bank;
// stands before the crowd for truth + dialogue
const MILLER_KEYS = [
  [0, 5.6, 1.0], [B('truth') - 10, 5.6, 1.0], [B('truth') + 44, 5.5, -1], [B('truth') + 84, 2.2, -3.6],
  [E('truth'), 1.8, -4.2], [1594, 1.8, -4.2],
];
export const fish1At = (f) => { const [x, z] = walkKeys(F1_KEYS, f); return { x, z }; };
export const fish2At = (f) => { const [x, z] = walkKeys(F2_KEYS, f); return { x, z }; };
export const runnerAt = (f) => { const [x, z] = walkKeys(RUN_KEYS, f); return { x, z }; };
export const priestAt = (f) => { const [x, z] = walkKeys(PRIEST_KEYS, f); return { x, z }; };
export const millerAt = (f) => { const [x, z] = walkKeys(MILLER_KEYS, f); return { x, z }; };
export const fish1Mode = (f) => strolling(f, [[B('drone') + 30, B('drone') + 110], [B('crowd') - 20, B('crowd')]]) ? 'stroll' : 'stand';
export const fish2Mode = (f) => strolling(f, [[B('drone') + 26, B('drone') + 104], [B('crowd') - 20, B('crowd')]]) ? 'stroll' : 'stand';
export const runnerMode = (f) => strolling(f, [[B('omen') + 8, B('omen') + 78]]) ? 'stroll' : 'stand';
export const priestMode = (f) => strolling(f, [[B('omen') + 70, E('omen')]]) ? 'stroll' : 'stand';
export const millerMode = (f) => strolling(f, [[B('truth') - 10, B('truth') + 84]]) ? 'stroll' : (f < B('truth') - 10 ? 'sit' : 'stand');

// ---------- the hero boat ----------
export const boatAt = (f) => {
  const S = shotAt(f);
  if (f < B('enter')) return { x: 8, y: -0.3, z: -16, ry: 0.1 };
  if (S.id === 'enter') {
    // west along the river, then a turn south through the north gate
    // (gap x -12..-8) into the chamber — never sails over the bank
    const u1 = smooth(ramp(f, B('enter') + 6, B('enter') + 62));
    const u2 = smooth(ramp(f, B('enter') + 62, E('enter') - 4));
    const x = lerp(lerp(6, -10, u1), -10, u2), z = lerp(lerp(-14, -14, u1), -9, u2);
    return { x, y: lerp(-0.3, 0, u2), z, ry: lerp(0.1, 0, u1 + u2) };
  }
  if (S.id === 'rise') return { x: -10, y: waterLevelAt(f) + 0.32, z: -9, ry: 0 };
  if (S.id === 'exit') {
    const u = smooth(ramp(f, B('exit') + 8, E('exit') - 4));
    return { x: lerp(-10, -20, u), y: LOCK_RISE + 0.32, z: -9, ry: -0.06 * u };
  }
  return { x: -20, y: LOCK_RISE + 0.32, z: -9, ry: -0.06 };
};
// the second loaded boat: rides the creeping water toward the bank (L2).
// It stays ON the water (y -0.3): letting it rise above the flat river
// made it float in mid-air (caught on the f0200 still).
export const boat2At = (f) => {
  if (f < B('creep')) return { x: -2, y: -0.3, z: -18, ry: -0.08 };
  if (shotAt(f).id === 'creep') {
    const u = smooth(ramp(f, B('creep') + 10, E('creep') - 6));
    return { x: lerp(-2, 0.5, u), y: -0.3, z: lerp(-18, -13.5, u), ry: -0.08 };
  }
  return { x: 0.5, y: -0.3, z: -13.5, ry: -0.08 };
};
// the miller's wiping cloth: in his hands while he comes down (L10)
export const clothAt = (f) => {
  if (shotAt(f).id !== 'truth') return { x: 0, y: -5, z: 0, k: 0 };
  const m = millerAt(f);
  return { x: m.x + 0.18, y: 1.05, z: m.z + 0.3, k: 1 };
};

// ---------- hero / focus ----------
const FOCUS = {
  drone: () => [-4, 1.6, -6],
  creep: () => [0, 0.4, -12],
  crowd: () => [4, 1.2, -4],
  omen: () => [-2, 1.3, -3],
  miller: () => [TABLE.x, 1.1, TABLE.z],
  lock: () => [-10, 2.6, -9],
  enter: () => { const bp = boatAt(950); return [bp.x, 0.8, bp.z]; },
  rise: () => [-10, 2.6, -9],
  exit: () => [-16, 5.2, -9],
  truth: () => { const m = millerAt(1250); return [m.x, 1.4, m.z]; },
  dialogue: () => { const m = millerAt(1400); return [m.x, 1.45, m.z]; },
  hookq: () => BOARD_POS, hook: () => BOARD_POS,
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id]();

// ---------- cameras: EVERY shot is a camrig track on a subject ----------
const bezierCam = (P, L, a, b, fov0, fov1) => (f) => {
  const u = M.smooth(ramp(f, a, b));
  const w0 = (1 - u) ** 3, w1 = 3 * (1 - u) ** 2 * u, w2 = 3 * (1 - u) * u * u, w3 = u ** 3;
  const mix = (Q) => [0, 1, 2].map((j) => w0 * Q[0][j] + w1 * Q[1][j] + w2 * Q[2][j] + w3 * Q[3][j]);
  return { pos: mix(P), look: mix(L), fov: lerp(fov0, fov1, u), roll: 0 };
};
const millerPos = (f) => { const m = millerAt(f); return [m.x, 0, m.z]; };
const fish1Pos = (f) => { const w = fish1At(f); return [w.x, 0, w.z]; };
const boatPos = (f) => { const bp = boatAt(f); return [bp.x, bp.y, bp.z]; };
const RIG_BY_ID = {
  drone: { cut: 'hard', raw: bezierCam(
    [[16, 10, 16], [11.5, 6.8, 14], [8.5, 4.4, 13], [7.2, 3.0, 12.4]],
    [[-5.5, 2.6, -8], [-4.5, 2.2, -7], [-2.5, 2.4, -6.2], [-1.0, 2.6, -6.0]], B('drone'), E('drone'), 46, 41) },
  creep: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('creep'), pos: [6.5, 2.2, 4], look: [0, 0.3, -12], fov: 42 },
    { f: E('creep'), pos: [5.6, 1.9, 2.6], look: [0.2, 0.4, -12.5], fov: 37, ease: 'surge' }] }) },
  crowd: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('crowd'), pos: [8, 2.4, 3], look: [3.5, 1.2, -4.5], fov: 44 },
    { f: E('crowd'), pos: [7.2, 2.2, 2.2], look: [3.8, 1.2, -4.5], fov: 39, ease: 'surge' }] }) },
  omen: { cut: 'hard', raw: pushInCam({ subject: () => [-2, 0, -3], a: B('omen'), b: E('omen'), d0: 6.0, d1: 4.6, h0: 1.7, h1: 1.55, lookOff: [0, 1.3, 0], fov0: 40, fov1: 34,
    dir: () => [0.55, 0.8] }) },
  miller: { cut: 'hard', raw: pushInCam({ subject: () => [TABLE.x, 0, TABLE.z], a: B('miller'), b: E('miller'), d0: 4.6, d1: 3.5, h0: 1.6, h1: 1.45, lookOff: [0, 1.1, 0], fov0: 38, fov1: 32,
    dir: () => [-0.5, 0.82] }) },
  lock: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('lock'), pos: [2, 6.0, 12], look: [-10, 2.4, -8], fov: 48 },
    { f: E('lock'), pos: [0, 5.0, 10], look: [-10.5, 2.6, -8], fov: 42, ease: 'surge' }] }) },
  enter: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('enter'), pos: [8, 2.6, 2.5], look: [6, 0.6, -14], fov: 42 },
    { f: B('enter') + 40, pos: [-2, 3.5, 1.5], look: [-5, 0.6, -14], fov: 38 },
    { f: B('enter') + 97, pos: [-8, 5.0, 1.5], look: [-10, 0.6, -12.5], fov: 37 },
    { f: E('enter'), pos: [-10, 5.0, 1.5], look: [-10, 0.8, -9], fov: 36, ease: 'io' }] }) },
  rise: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('rise'), pos: [-10, 4.5, 5.5], look: [-10, 1.2, -9], fov: 40 },
    { f: E('rise'), pos: [-10, 7.0, 4.0], look: [-10, 4.6, -9], fov: 34, ease: 'io' }] }) },
  exit: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('exit'), pos: [-8, 7.0, 4.0], look: [-11, 4.6, -9], fov: 40 },
    { f: E('exit'), pos: [-14, 7.5, 2.0], look: [-19, 4.8, -9], fov: 36, ease: 'io' }] }) },
  truth: { cut: 'hard', raw: pushInCam({ subject: millerPos, a: B('truth'), b: E('truth'), d0: 5.2, d1: 4.0, h0: 1.7, h1: 1.55, lookOff: [0, 1.4, 0], fov0: 38, fov1: 33,
    dir: () => [0.5, 0.82] }) },
  dialogue: { cut: 'hard', raw: pushInCam({ subject: millerPos, a: B('dialogue'), b: E('dialogue'), d0: 3.3, d1: 2.7, h0: 1.58, h1: 1.5, lookOff: [0, 1.45, 0], fov0: 32, fov1: 28,
    dir: () => [0.45, 0.85] }) },
  hookq: { cut: 'blend', blend: 10, raw: keysCam({ keys: [
    { f: B('hookq'), pos: [5.4, 3.9, 7.6], look: [0.1, 2.75, -5.9], fov: 40 },
    { f: E('hookq'), pos: [5.2, 3.9, 7.4], look: [0.05, 2.78, -5.95], fov: 37, ease: 'surge' }] }) },
  hook: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('hook'), pos: [5.2, 3.9, 7.4], look: [0.05, 2.78, -5.95], fov: 37 },
    { f: E('hook'), pos: [5.0, 3.95, 7.2], look: [0.02, 2.8, -5.97], fov: 36, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: B('rise') + 10, a: 0.03 }, { f: B('enter') + 60, a: 0.03 }],
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
  if (['drone', 'hookq', 'lock', 'creep'].includes(S.id)) cinf = 1.4;
  if (['dialogue', 'miller', 'truth', 'omen'].includes(S.id)) cinf = 3.6;
  if (S.id === 'hook') cinf = 3.0;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = {
    boardTitle: 0, boardHook: 0,
    waterLevel: waterLevelAt(f), sluiceK: sluiceAt(f),
    boatX: boatAt(f).x, boatY: boatAt(f).y, boatZ: boatAt(f).z, boatRy: boatAt(f).ry,
    boat2X: boat2At(f).x, boat2Y: boat2At(f).y, boat2Z: boat2At(f).z, boat2Ry: boat2At(f).ry,
    clothX: clothAt(f).x, clothY: clothAt(f).y, clothZ: clothAt(f).z, clothK: clothAt(f).k,
    dustK: 0.05,
  };
  if (S.id === 'drone') W.boardTitle = smooth(ramp(f, 34, 48)) * (1 - smooth(ramp(f, 60, 74)));
  if (S.id === 'hookq') W.boardHook = smooth(ramp(f, B('hookq') + 44, B('hookq') + 68));
  if (S.id === 'hook') W.boardHook = 1;   // held at FULL opacity to the literal last frame
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return { smokeRate: 0.06, dustRate: 0.05, splashRate: S.id === 'rise' ? 0.7 : (S.id === 'enter' ? 0.4 : 0), steamRate: 0, shimmerRate: 0, windK: 0.1 };
};
export const fxAt = () => [];

// ---------- cast (single source for actors AND colliders) ----------
const TINT = { grey: '#ffffff', lamp: '#f2ddc4', dusk: '#f2ddc4' };
const tintFor = (S) => S.id === 'miller' ? TINT.lamp : (S.id === 'hook' || S.id === 'hookq' ? TINT.dusk : TINT.grey);
export const OUTFITS = {
  miller: { jacket: '#e8e0cc', pants: '#4a3a28', boots: '#241a12', hat: 'cap', cap: '#6d4c2e', skin: '#c98a5a', moustache: '#8a6a4a' },
  fish1: { jacket: '#2c4a6e', pants: '#2a3242', boots: '#1c1712', hat: 'cap', cap: '#a34a3a', skin: '#a06a3c' },
  fish2: { jacket: '#4a6a3a', pants: '#33302c', boots: '#241a12', hat: 'cap', cap: '#3a5a6a', skin: '#8a5a34', moustache: '#241a12' },
  old1: { jacket: '#7a6a4a', pants: '#3a3230', boots: '#201812', hat: 'hair', hair: '#e8e4da', skin: '#d9b48f', moustache: '#e8e4da' },
  old2: { jacket: '#6a5a3a', pants: '#33302c', boots: '#201812', hat: 'hair', hair: '#d8d2c2', skin: '#c9a06a' },
  priest: { jacket: '#f2ead8', pants: '#e8e0cc', boots: '#3a2c1c', hat: 'cap', cap: '#f2ead8', skin: '#b98a5a', moustache: '#e8e4da' },
  crowd1: { jacket: '#8a6f42', pants: '#3a3230', boots: '#201812', hat: 'hair', hair: '#2c1a10', skin: '#c98a5a' },
  crowd2: { jacket: '#5d6a8a', pants: '#2a3242', boots: '#1c1712', hat: 'cap', cap: '#4a3a28', skin: '#a06a3c' },
};
export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, z, extra = {}) => out.push({ id, x, y: extra.y ?? 0, z, r: 0.32, ground: extra.ground ?? 0,
    actor: (T) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x, y: extra.y ?? 0, z, ground: extra.ground ?? 0, tint, ...extra }) });
  const f1 = fish1At(f), f2 = fish2At(f), rn = runnerAt(f), pr = priestAt(f), ml = millerAt(f);
  const M_ = { expr: 'smile', mode: millerMode(f), phase: q((f * 0.011) % 1, 2), blink: blinkAt(f, 41), seed: 41 };
  const F1_ = { expr: 'shock', mode: fish1Mode(f), phase: q((f * 0.011) % 1, 2), blink: blinkAt(f, 31), seed: 31 };
  const F2_ = { expr: 'shock', mode: fish2Mode(f), phase: q((f * 0.011) % 1, 2), blink: blinkAt(f, 51), seed: 51 };
  const O1_ = { expr: 'stern', mode: 'stand', blink: blinkAt(f, 52), seed: 52 };
  const O2_ = { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 53), seed: 53 };
  const P_ = { expr: 'neutral', mode: priestMode(f), blink: blinkAt(f, 61), seed: 61 };
  const R_ = { expr: 'nervous', mode: runnerMode(f), phase: q((f * 0.013) % 1, 2), blink: blinkAt(f, 54), seed: 54 };
  const C1_ = { expr: 'shock', mode: 'stand', blink: blinkAt(f, 55), seed: 55 };
  const C2_ = { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 56), seed: 56 };
  switch (S.id) {
    case 'drone': {
      std('fish1', OUTFITS.fish1, { ...F1_, expr: 'shock' }, f1.x, f1.z, { yaw: 0.5 });
      std('fish2', OUTFITS.fish2, { ...F2_, expr: 'shock' }, f2.x, f2.z, { yaw: 0.4 });
      std('miller', OUTFITS.miller, { ...M_, expr: 'smile', mode: 'sit' }, ml.x, ml.z, { yaw: -0.5 });
      std('crowd1', OUTFITS.crowd1, { ...C1_, expr: 'neutral' }, 7, -3, { yaw: -0.3 });
      break;
    }
    case 'creep': {
      std('fish1', OUTFITS.fish1, { ...F1_, expr: 'shock', headTilt: 0.08 }, f1.x, f1.z, { yaw: 0.6 });
      std('fish2', OUTFITS.fish2, { ...F2_, expr: 'shock' }, f2.x, f2.z, { yaw: 0.45 });
      std('crowd1', OUTFITS.crowd1, { ...C1_ }, 7, -3, { yaw: -0.3 });
      break;
    }
    case 'crowd': {
      std('fish1', OUTFITS.fish1, { ...F1_, expr: 'shock' }, f1.x, f1.z, { yaw: 0.6 });
      std('fish2', OUTFITS.fish2, { ...F2_, expr: 'shock' }, f2.x, f2.z, { yaw: 0.45 });
      std('crowd1', OUTFITS.crowd1, { ...C1_, expr: 'shock' }, 7, -3, { yaw: -0.4 });
      std('crowd2', OUTFITS.crowd2, { ...C2_, expr: 'shock' }, 9.5, -4, { yaw: -0.5 });
      std('old1', OUTFITS.old1, { ...O1_ }, -2, -3, { yaw: 0.5 });
      std('priest', OUTFITS.priest, { ...P_ }, pr.x, pr.z, { yaw: -0.4 });
      break;
    }
    case 'omen': {
      std('old1', OUTFITS.old1, { ...O1_, expr: 'stern', prop: ['point', 0.8] }, -2, -3, { yaw: 0.5 });
      std('old2', OUTFITS.old2, { ...O2_, expr: 'nervous' }, -4, -2, { yaw: 0.4 });
      std('runner', OUTFITS.crowd2, { ...R_ }, rn.x, rn.z, { yaw: 0.7 });
      std('priest', OUTFITS.priest, { ...P_ }, pr.x, pr.z, { yaw: -0.4 });
      std('fish1', OUTFITS.fish1, { ...F1_, expr: 'nervous' }, f1.x, f1.z, { yaw: 0.6 });
      break;
    }
    case 'miller': {
      // the miller at his supper, laughing — lamp-lit, flour-dusted apron
      std('miller', OUTFITS.miller, { expr: 'laugh', mode: 'sit', blink: blinkAt(f, 41), seed: 41, headTilt: -0.06 }, ml.x, ml.z, { yaw: -0.5 });
      break;
    }
    case 'lock': {
      std('fish1', OUTFITS.fish1, { ...F1_, expr: 'neutral' }, f1.x, f1.z, { yaw: 0.6 });
      std('crowd1', OUTFITS.crowd1, { ...C1_, expr: 'neutral' }, 7, -3, { yaw: -0.4 });
      std('old1', OUTFITS.old1, { ...O1_, expr: 'neutral' }, -2, -3, { yaw: 0.5 });
      break;
    }
    case 'enter': case 'rise': case 'exit': break;   // the boat + water carry these beats
    case 'truth': {
      // the miller comes down wiping his hands (cloth prop in his hands),
      // faces the frightened crowd
      std('miller', OUTFITS.miller, { expr: 'smile', mode: millerMode(f), blink: blinkAt(f, 41), seed: 41 }, ml.x, ml.z, { yaw: 0.5 });
      std('fish1', OUTFITS.fish1, { ...F1_, expr: 'nervous' }, f1.x, f1.z, { yaw: 0.6 });
      std('fish2', OUTFITS.fish2, { ...F2_, expr: 'nervous' }, f2.x, f2.z, { yaw: 0.45 });
      std('crowd1', OUTFITS.crowd1, { ...C1_, expr: 'nervous' }, 7, -3, { yaw: -0.4 });
      std('priest', OUTFITS.priest, { ...P_, expr: 'neutral' }, pr.x, pr.z, { yaw: -0.4 });
      break;
    }
    case 'dialogue': {
      // THE dialogue beat: the miller PERFORMS his line — mouth driven by
      // the stem inside the speak segment, closed outside it; the crowd
      // only listens (their mouths never open).
      std('miller', OUTFITS.miller, { mode: 'stand', blink: blinkAt(f, 41), seed: 41, look: 0.12, ...speakFace('smile', f) }, ml.x, ml.z, { y: 0, ground: 0, yaw: 0.5 });
      std('fish1', OUTFITS.fish1, { ...F1_, mode: 'stand', expr: 'relief' }, f1.x, f1.z, { yaw: -0.4 });
      std('fish2', OUTFITS.fish2, { ...F2_, mode: 'stand', expr: 'relief' }, f2.x, f2.z, { yaw: -0.3 });
      std('priest', OUTFITS.priest, { ...P_, mode: 'stand', expr: 'smile' }, pr.x, pr.z, { yaw: -0.4 });
      break;
    }
    case 'hookq': case 'hook': break;
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity: statics, dynamics, ground (LIBRARY v3 gate data) ----------
export const STATICS = [
  // lock walls: north wall has the entrance gap (x -12..-8), west wall
  // has the exit gap (z -10.5..-7.5); south parapet is low (h 1.0) so
  // the camera sees the rising boat over it
  SOL.aabb(LOCK.x0 - 0.4, LOCK.x0 + 0.4, LOCK.z0 - 0.4, -10.5, { h: 6, id: 'lockwestN' }),
  SOL.aabb(LOCK.x0 - 0.4, LOCK.x0 + 0.4, -7.5, LOCK.z1 + 0.4, { h: 6, id: 'lockwestS' }),
  SOL.aabb(LOCK.x1 - 0.4, LOCK.x1 + 0.4, LOCK.z0 - 0.4, LOCK.z1 + 0.4, { h: 6, id: 'lockeast' }),
  SOL.aabb(LOCK.x0, -12, LOCK.z0 - 0.4, LOCK.z0 + 0.4, { h: 6, id: 'locknorthW' }),
  SOL.aabb(-8, LOCK.x1, LOCK.z0 - 0.4, LOCK.z0 + 0.4, { h: 6, id: 'locknorthE' }),
  SOL.aabb(LOCK.x0, LOCK.x1, LOCK.z1 - 0.4, LOCK.z1 + 0.4, { h: 1.0, id: 'lockparapet' }),
  SOL.aabb(MILL.x - 2.4, MILL.x + 2.4, MILL.z - 1.9, MILL.z + 1.9, { h: 3.2, id: 'millhouse' }),
  SOL.aabb(PRIEST_HOUSE.x - 2.4, PRIEST_HOUSE.x + 2.4, PRIEST_HOUSE.z - 1.9, PRIEST_HOUSE.z + 1.9, { h: 3.2, id: 'priesthouse' }),
  SOL.aabb(HUT1.x - 2.2, HUT1.x + 2.2, HUT1.z - 1.8, HUT1.z + 1.8, { h: 3.0, id: 'hut1' }),
  SOL.aabb(HUT2.x - 2.2, HUT2.x + 2.2, HUT2.z - 1.8, HUT2.z + 1.8, { h: 3.0, id: 'hut2' }),
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
  for (const a of castAt(f)) items.push({ id: a.id, y: a.y, ground: a.ground ?? 0, maxHover: 0.06 });
  return items;
};
