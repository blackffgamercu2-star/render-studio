// Shot plan for "The Night the River Flowed Uphill" — uphill (Batch 8 E4,
// Mirror Trick Tales). v4 UPGRADE (2026-11-19): ACTION CAMERA + ANIMATION
// UPGRADE v1+v2 (body.js: lifeAt / emoTrack / gazeTrack / gestureAt /
// gripTrack / jumpTrack / carryDip) + Salted Mine V3 style (round WHITE
// heads, word-by-word captions in main.js). Picture-only rebuild on the
// EXISTING stem — beat map, clause timings, boards and mix UNCHANGED.
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
// v4 CAMERA: push-ins land in 12–18f at action starts, tracking keys ride
// at subject speed (the run, the boat, the rising chamber, the miller's
// walk down), impact kicks on the nets drop (f28), the gate slam (f947),
// the sluice surge (f966) and the exit gates (f1100); no slow drift, no
// static holds, camera never behind the cards. R2 framing: opening hero
// BIG mid-action, inserts fill the frame, dialogue face ~70%, final =
// miller + fisherman foreground with the hook board (board ~85%).
// GRADE (FILTER_VFX_LIGHTING pack): Monsoon Grey throughout — desaturated
// blue-grey, soft contrast, wet sheen; the miller supper beat warms under
// a lamp pool, the hook beat warms toward dusk. Grade changes ONLY on
// clause boundaries. Signature VFX: the rising chamber water + sluice
// pour, wet sheen on the bank, mist over the river at dusk.
// NOTE (END RULE): the one performed dialogue line sits at f1354–1450 of
// 1595 (85–91%) — inside the final quarter. That placement is baked into
// the stem's beat map and the stem may not be re-timed; after the line
// ends NOBODY speaks again — hookq/hook are narration + board only, all
// mouths closed, final frame included.
import { M, blinkAt, q, clamp, lerp, ramp } from './motion.js';
import { buildRig, pushInCam, keysCam } from './camrig.js';
import { lifeAt, emoTrack, gazeTrack, gestureAt, jumpTrack, carryDip } from './body.js';
import * as SOL from './solid.js';
import * as T from './toon.js';
import * as SPK from './speak.js';
import { SPEAK_DATA } from './speakdata.js';

// ---------- v4 dialogue performance ----------
const SPEAK = SPK.makeSpeakPlayer(SPEAK_DATA);

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
// travelled-distance stride phase (real planted steps, no glide) — the
// phase advances with the distance the walk keys actually cover.
const distPhase = (raw) => {
  const D = [0];
  for (let f = 1; f < TOTAL; f++) { const a = raw(f - 1), b = raw(f); D[f] = D[f - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]); }
  return { phase: (f) => (D[clamp(Math.round(f), 0, TOTAL - 1)] / 0.82) % 1, moving: (f) => f > 0 && (D[clamp(Math.round(f), 0, TOTAL - 1)] - D[clamp(Math.round(f) - 1, 0, TOTAL - 1)]) > 0.004 };
};
const fish1Move = distPhase((f) => { const p = fish1At(f); return [p.x, p.z]; });
const fish2Move = distPhase((f) => { const p = fish2At(f); return [p.x, p.z]; });
const runnerMove = distPhase((f) => { const p = runnerAt(f); return [p.x, p.z]; });
const priestMove = distPhase((f) => { const p = priestAt(f); return [p.x, p.z]; });
const millerMove = distPhase((f) => { const p = millerAt(f); return [p.x, p.z]; });
// the fishermen's startle as the nets drop (L1): a hop back + lean
const netFlinch = jumpTrack([{ f0: 26, dur: 11, h: 0.1, back: 8 }]);
const netFlinch2 = jumpTrack([{ f0: 29, dur: 11, h: 0.08, back: 6 }]);

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
// the miller's wiping cloth: drawn IN THE CARD OVERLAY between his
// gripping hands on the truth beat (see castAt 'truth'), so hand and
// cloth move in the same frames from every camera angle — the old 3D
// plane sat offset from the card-space hands and read as a stiff card.
// k stays 0 so main.js keeps the 3D cloth hidden.
export const clothAt = (f) => ({ x: 0, y: -5, z: 0, k: 0 });

// ---------- hero / focus ----------
const FOCUS = {
  drone: (f) => { const p = fish1At(f); return [p.x, 1.5, p.z]; },
  creep: (f) => { const bp = boat2At(f); return [bp.x, 0.5, bp.z]; },
  crowd: () => [4, 1.3, -4],
  omen: (f) => { const p = runnerAt(f); return [p.x, 1.3, p.z]; },
  miller: () => [5.6, 1.2, 1.0],
  lock: () => [-10, 2.8, -9],
  enter: (f) => { const bp = boatAt(f); return [bp.x, 0.8, bp.z]; },
  rise: (f) => [-10, 1.2 + waterLevelAt(f), -9],
  exit: (f) => { const bp = boatAt(f); return [bp.x, bp.y + 0.6, bp.z]; },
  truth: (f) => { const m = millerAt(f); return [m.x, 1.4, m.z]; },
  dialogue: (f) => { const m = millerAt(f); return [m.x, 1.45, m.z]; },
  hookq: () => BOARD_POS, hook: () => BOARD_POS,
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id](f);

// ---------- v4 ACTION CAMERA: keysCam grammar, subject-speed tracking ----------
const KC = (keys) => keysCam({ keys: keys.map(([f, pos, look, fov]) => ({ f, pos, look, fov, ease: 'io' })) });
const millerPos = (f) => { const m = millerAt(f); return [m.x, 0, m.z]; };
const RIG_BY_ID = {
  // L1: tight on fisherman 1 at the nets (head ~42%), push-in as the nets
  // drop, then the camera rides the run at the runners' speed and pulls
  // back to the wide board framing for the title (board fully in frame).
  drone: { cut: 'hard', raw: KC([
    [0, [5.05, 1.42, -6.95], [6, 1.5, -10], 40],
    [30, [5.15, 1.42, -6.9], [6, 1.5, -10], 38],
    [62, [6.8, 1.7, -0.6], [4.9, 1.3, -3.6], 40],
    [88, [5.4, 2.2, 3.2], [2.2, 1.9, -2.6], 42],
    [110, [2.6, 3.1, 5.6], [0.8, 2.3, -5.2], 43],
    [144, [1.5, 3.4, 6.5], [0, 2.7, -6], 42]]) },
  // L2: the camera tracks the creeping boat at its own slow surge speed,
  // pushing in as it rides toward the bank.
  creep: { cut: 'hard', raw: KC([
    [145, [3.4, 1.7, -7.6], [-1.6, 0.5, -17.5], 40],
    [200, [3.6, 1.55, -8.6], [-0.6, 0.5, -15.5], 38],
    [268, [3.9, 1.45, -9.6], [0.4, 0.55, -13.6], 36]]) },
  // L3: reaction close-up on fisherman 1 first (face ~70%), then the
  // camera widens across the whole crowd on the bank.
  crowd: { cut: 'hard', raw: KC([
    [269, [5.05, 1.55, -1.55], [4, 1.5, -3.5], 37],
    [318, [5.2, 1.58, -1.35], [4.05, 1.48, -3.52], 37],
    [360, [6.6, 1.85, -0.4], [5.0, 1.4, -3.85], 40],
    [412, [7.6, 2.05, 0.8], [5.0, 1.35, -3.8], 42]]) },
  // L4a: tight on the pointing old man (see OMEN_B for the whip track).
  omen: { cut: 'hard', raw: KC([
    [413, [-0.9, 1.55, -1.0], [-2, 1.5, -3], 37],
    [447, [-0.55, 1.6, -0.65], [-2.1, 1.5, -3], 36]]) },
  // L5: lamp-lit push-in on the laughing miller at his supper.
  miller: { cut: 'hard', raw: pushInCam({ subject: () => [5.6, 0, 1.0], a: B('miller'), b: E('miller'), d0: 3.4, d1: 2.15, h0: 1.62, h1: 1.5, lookOff: [0, 1.15, 0], fov0: 36, fov1: 30,
    dir: () => [-0.55, 0.8] }) },
  // L6: push-in along the staircase of stone chambers.
  lock: { cut: 'hard', raw: KC([
    [665, [-2.2, 3.4, 2.2], [-10, 3.2, -9], 44],
    [730, [-3.4, 3.7, 0.6], [-10.3, 3.0, -9], 41],
    [802, [-4.6, 4.0, -0.6], [-10.5, 2.9, -9], 38]]) },
  // L7: the camera tracks the boat in at its sailing speed, swinging
  // south through the gate gap view as the gates close behind it.
  enter: { cut: 'hard', raw: KC([
    [803, [10.6, 2.1, -5.6], [6.2, 0.7, -14], 41],
    [850, [3.0, 2.5, -4.6], [-3, 0.7, -14], 39],
    [905, [-5.5, 3.4, -1.0], [-9.8, 0.8, -12.5], 37],
    [957, [-7.5, 4.2, -0.5], [-10, 1.0, -10], 36]]) },
  // L8: the camera RISES with the boat, locked to the chamber water.
  rise: { cut: 'hard', raw: KC([
    [958, [-9.2, 2.0, 1.2], [-10, 1.1, -9], 40],
    [1020, [-9.6, 3.6, 0.8], [-10, 2.8, -9], 38],
    [1095, [-10, 5.6, 0.2], [-10, 4.7, -9], 35]]) },
  // L9: the camera tracks west with the boat out onto the higher water.
  exit: { cut: 'hard', raw: KC([
    [1096, [-5.6, 5.8, 1.0], [-11, 4.9, -9], 39],
    [1160, [-9.5, 6.0, 0.2], [-15.5, 5.0, -9], 37],
    [1226, [-13.5, 6.2, -0.6], [-19.5, 5.0, -9], 36]]) },
  // L10: the camera walks down with the miller, pushing in as he stops
  // before the crowd and faces them.
  truth: { cut: 'hard', raw: KC([
    [1227, [8.8, 1.75, 3.2], [5.6, 1.4, 1.0], 38],
    [1271, [8.2, 1.7, 0.6], [5.5, 1.4, -1.0], 37],
    [1311, [5.4, 1.6, -0.9], [2.3, 1.45, -3.6], 35],
    [1353, [4.35, 1.55, -1.7], [1.9, 1.45, -4.2], 33]]) },
  // L11: the performed line — the camera HOLDS on the miller, pushing in
  // slowly; he does the talking.
  dialogue: { cut: 'hard', raw: pushInCam({ subject: millerPos, a: B('dialogue'), b: E('dialogue'), d0: 2.7, d1: 2.05, h0: 1.56, h1: 1.5, lookOff: [0, 1.45, 0], fov0: 31, fov1: 28,
    dir: () => [0.45, 0.85] }) },
  // L12: settle onto the hook framing — board ~85% wide, fully inside;
  // the miller + fisherman stand foreground (see cast), nobody speaks.
  hookq: { cut: 'hard', raw: KC([
    [1451, [3.4, 3.3, 4.6], [0.3, 2.8, -6], 41],
    [1472, [1.7, 3.4, 6.9], [0.05, 2.76, -6], 40],
    [1519, [1.5, 3.4, 7.3], [0, 2.78, -6], 41]]) },
  hook: { cut: 'hard', raw: KC([
    [1520, [1.5, 3.4, 7.3], [0, 2.78, -6], 41],
    [1594, [1.35, 3.45, 7.5], [0, 2.8, -6], 40]]) },
};
// L4b: the whip reframe (6f, declared) off the old man onto the runner,
// then a track east at the runner's sprint speed, settling toward the
// priest's door as he arrives.
const OMEN_B = KC([
  [448, [4.2, 1.85, 2.5], [10.6, 1.25, 2.3], 42],
  [470, [7.5, 1.9, 4.4], [13.5, 1.3, 3.2], 41],
  [491, [11.2, 1.85, 6.6], [14.6, 1.35, 3.8], 40],
  [513, [11.8, 1.8, 7.2], [15.0, 1.4, 5.2], 38]]);
const RIG_SHOTS = [];
for (const s of SHOTS) {
  if (s.id === 'omen') {
    RIG_SHOTS.push({ a: s.a, b: 447, ...RIG_BY_ID.omen });
    RIG_SHOTS.push({ a: 448, b: s.b, cut: 'whip', blend: 6, raw: OMEN_B });
  } else RIG_SHOTS.push({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] });
}
const RIG = buildRig({
  total: TOTAL,
  shots: RIG_SHOTS,
  kicks: [{ f: 28, a: 0.22 }, { f: 947, a: 0.26 }, { f: 966, a: 0.22 }, { f: 1100, a: 0.2 }],
  sigma: 1.7, smoothRadius: 5, fovSigma: 1.1,
});
export const camAt = (f) => RIG.camAt(f);
export const RIG_META = {
  kicks: RIG.declared.kicks, hardCuts: RIG.declared.hardCuts,
  blends: [],
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
  // the title board fades in only once the drone pull-back has settled
  // into the wide framing that holds the whole board (f110+).
  if (S.id === 'drone') W.boardTitle = smooth(ramp(f, 114, 128));
  if (S.id === 'hookq') W.boardHook = smooth(ramp(f, B('hookq') + 44, B('hookq') + 68));
  if (S.id === 'hook') W.boardHook = 1;   // held at FULL opacity to the literal last frame
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return { smokeRate: 0.06, dustRate: 0.05, splashRate: S.id === 'rise' ? 0.7 : (S.id === 'enter' ? 0.4 : 0), steamRate: 0, shimmerRate: 0, windK: 0.1 };
};
export const fxAt = () => [];

// ---------- cast: outfits (Salted Mine V3 — round WHITE heads, detailed
// costumes per role; NO card tint in any light) ----------
export const OUTFITS = {
  miller: { jacket: '#e8e0cc', pants: '#4a3a28', boots: '#241a12', hat: 'cap', cap: '#6d4c2e', skin: '#fbf7ef', moustache: '#8a6a4a' },
  fish1: { jacket: '#2c4a6e', pants: '#2a3242', boots: '#1c1712', hat: 'cap', cap: '#a34a3a', skin: '#fbf7ef' },
  fish2: { jacket: '#4a6a3a', pants: '#33302c', boots: '#241a12', hat: 'cap', cap: '#3a5a6a', skin: '#fbf7ef', moustache: '#241a12' },
  old1: { jacket: '#7a6a4a', pants: '#3a3230', boots: '#201812', hat: 'hair', hair: '#e8e4da', skin: '#fbf7ef', moustache: '#e8e4da' },
  old2: { jacket: '#6a5a3a', pants: '#33302c', boots: '#201812', hat: 'hair', hair: '#d8d2c2', skin: '#fbf7ef' },
  priest: { jacket: '#f2ead8', pants: '#e8e0cc', boots: '#3a2c1c', hat: 'cap', cap: '#f2ead8', skin: '#fbf7ef', moustache: '#e8e4da' },
  crowd1: { jacket: '#8a6f42', pants: '#3a3230', boots: '#201812', hat: 'hair', hair: '#2c1a10', skin: '#fbf7ef' },
  crowd2: { jacket: '#5d6a8a', pants: '#2a3242', boots: '#1c1712', hat: 'cap', cap: '#4a3a28', skin: '#fbf7ef' },
};
// ---------- expression morph tracks (the face matches the beat) ----------
const millerEmo = emoTrack([[0, 'smile'], [514, 'laugh'], [665, 'smile'], [1227, 'smile'], [1354, 'proud'], [1451, 'smile']], 41);
const fish1Emo = emoTrack([[0, 'shock'], [413, 'nervous'], [665, 'wonder'], [1227, 'nervous'], [1354, 'relief'], [1451, 'smile']], 31);
const fish2Emo = emoTrack([[0, 'shock'], [413, 'nervous'], [1227, 'nervous'], [1354, 'relief']], 51);
const old1Emo = emoTrack([[0, 'stern'], [269, 'shock'], [413, 'stern'], [665, 'wonder'], [1227, 'nervous']], 52);
const old2Emo = emoTrack([[0, 'nervous'], [413, 'nervous']], 53);
const priestEmo = emoTrack([[0, 'neutral'], [413, 'stern'], [665, 'wonder'], [1227, 'smile'], [1354, 'smile']], 61);
const crowd1Emo = emoTrack([[0, 'shock'], [1227, 'nervous'], [1354, 'relief']], 55);
const crowd2Emo = emoTrack([[0, 'shock'], [1227, 'nervous'], [1354, 'relief']], 56);
const runnerEmo = emoTrack([[0, 'nervous'], [413, 'nervous']], 54);
// gaze: the miller's eyes follow the story (crowd -> board at the end)
const millerGaze = gazeTrack([{ f: 0, look: 0.1, lookY: 0.05 }, { f: 1227, look: 0.15 }, { f: 1354, look: 0.05, lookY: 0.05 }, { f: 1451, look: 0.3, lookY: 0.35 }]);
const AP = (L, R) => {
  const o = {};
  if (L) o.L = { hand: [Math.round(L.x), Math.round(L.y)], grip: q(L.grip, 2), front: true };
  if (R) o.R = { hand: [Math.round(R.x), Math.round(R.y)], grip: q(R.grip, 2), front: true };
  return Object.keys(o).length ? o : undefined;
};

// ---------- cast (single source for actors AND colliders) ----------
export const castAt = (f) => {
  const S = shotAt(f), out = [];
  const std = (id, o, opts, x, z, extra = {}) => out.push({ id, x, y: extra.y ?? 0, z, r: 0.32, ground: extra.ground ?? 0,
    actor: (TT) => ({ key: id + JSON.stringify(o) + JSON.stringify(opts) + (extra.ov || ''), draw: (p) => { TT.bodyFront(p, o, opts); if (extra.drawOv) extra.drawOv(p); }, x, y: extra.y ?? 0, z, ground: extra.ground ?? 0, tint: '#ffffff', ...extra }) });
  const base = (seed, amp = 1) => {
    const L = lifeAt(f, seed);
    return { seed, blink: new T.Blink(seed).at(f), breath: L.breath, tilt: q(L.tilt * amp, 2), headTilt: q(L.headTilt, 2), squashL: L.squash };
  };
  const f1 = fish1At(f), f2 = fish2At(f), rn = runnerAt(f), pr = priestAt(f), ml = millerAt(f);
  const stdOpts = (B_, emo, move, extra = {}) => ({
    phase: move.phase(f), mode: move.moving(f) ? 'march' : (extra.mode ?? 'stand'),
    exprP: emo(f), blink: B_.blink, seed: B_.seed, breath: B_.breath,
    tilt: q(B_.tilt + (extra.tilt ?? 0), 2), headTilt: q(B_.headTilt + (extra.headTilt ?? 0), 2),
    look: q(extra.look ?? 0.1, 2), lookY: q(extra.lookY ?? 0, 2),
    squash: q(Math.max(B_.squashL, extra.dip ?? 0), 3), armPose: extra.armPose,
  });
  switch (S.id) {
    case 'drone': {
      // fishermen at the nets: startle (jumpTrack) as the nets drop, arms
      // thrown up mid-gesture, then they RUN — real distance stride.
      const j1 = netFlinch(f), j2 = netFlinch2(f);
      const g1 = gestureAt(f, 31, 0.6), g2 = gestureAt(f, 51, 0.5);
      const arms1 = f < 70 ? AP({ x: 168 - g1.dx, y: 500 + g1.dy, grip: 0.05 }, { x: 432 + g1.dx, y: 500 + g1.dy, grip: 0.05 }) : undefined;
      const arms2 = f < 70 ? AP({ x: 172 - g2.dx, y: 512 + g2.dy, grip: 0.05 }, { x: 428 + g2.dx, y: 512 + g2.dy, grip: 0.05 }) : undefined;
      std('fish1', OUTFITS.fish1, stdOpts(base(31), fish1Emo, fish1Move, { armPose: arms1, tilt: j1.lean, look: 0.2 }), f1.x, f1.z, { yaw: 0.5, y: j1.y });
      std('fish2', OUTFITS.fish2, stdOpts(base(51), fish2Emo, fish2Move, { armPose: arms2, tilt: j2.lean, look: 0.15 }), f2.x, f2.z, { yaw: 0.4, y: j2.y });
      std('miller', OUTFITS.miller, { ...stdOpts(base(41), millerEmo, millerMove, {}), mode: 'sit' }, ml.x, ml.z, { yaw: -0.5 });
      std('crowd1', OUTFITS.crowd1, stdOpts(base(55), crowd1Emo, { phase: () => 0, moving: () => false }, { look: -0.2 }), 7, -3, { yaw: -0.3 });
      break;
    }
    case 'creep': {
      std('fish1', OUTFITS.fish1, stdOpts(base(31), fish1Emo, fish1Move, { headTilt: 2, look: 0.25 }), f1.x, f1.z, { yaw: 0.6 });
      std('fish2', OUTFITS.fish2, stdOpts(base(51), fish2Emo, fish2Move, { look: 0.2 }), f2.x, f2.z, { yaw: 0.45 });
      std('crowd1', OUTFITS.crowd1, stdOpts(base(55), crowd1Emo, { phase: () => 0, moving: () => false }, {}), 7, -3, { yaw: -0.3 });
      break;
    }
    case 'crowd': {
      // fisherman 1 points up the slope at the climbing river
      const pt = AP(null, { x: 446, y: 306, grip: 0.1 });
      std('fish1', OUTFITS.fish1, stdOpts(base(31), fish1Emo, fish1Move, { armPose: pt, look: 0.3, lookY: 0.2 }), f1.x, f1.z, { yaw: 0.6 });
      std('fish2', OUTFITS.fish2, stdOpts(base(51), fish2Emo, fish2Move, { look: 0.25 }), f2.x, f2.z, { yaw: 0.45 });
      std('crowd1', OUTFITS.crowd1, stdOpts(base(55), crowd1Emo, { phase: () => 0, moving: () => false }, { look: 0.2 }), 7, -3, { yaw: -0.4 });
      std('crowd2', OUTFITS.crowd2, stdOpts(base(56), crowd2Emo, { phase: () => 0, moving: () => false }, { look: 0.2 }), 9.5, -4, { yaw: -0.5 });
      std('old1', OUTFITS.old1, stdOpts(base(52), old1Emo, { phase: () => 0, moving: () => false }, { look: 0.25 }), -2, -3, { yaw: 0.5 });
      std('priest', OUTFITS.priest, stdOpts(base(61), priestEmo, priestMove, { look: -0.2 }), pr.x, pr.z, { yaw: -0.4 });
      break;
    }
    case 'omen': {
      // old man 1 POINTS at the river (the omen); old man 2 clasps his
      // hands; the runner sprints past them to the priest's door.
      const pt = AP(null, { x: 452, y: 330, grip: 0.1 });
      const clasp = AP({ x: 262, y: 640, grip: 0.5 }, { x: 338, y: 640, grip: 0.5 });
      std('old1', OUTFITS.old1, stdOpts(base(52), old1Emo, { phase: () => 0, moving: () => false }, { armPose: pt, look: 0.3, lookY: 0.15 }), -2, -3, { yaw: 0.5 });
      std('old2', OUTFITS.old2, stdOpts(base(53), old2Emo, { phase: () => 0, moving: () => false }, { armPose: clasp, look: 0.2 }), -4, -2, { yaw: 0.4 });
      std('runner', OUTFITS.crowd2, stdOpts(base(54), runnerEmo, runnerMove, { look: 0.3 }), rn.x, rn.z, { yaw: 0.7 });
      std('priest', OUTFITS.priest, stdOpts(base(61), priestEmo, priestMove, { look: -0.25 }), pr.x, pr.z, { yaw: -0.4 });
      std('fish1', OUTFITS.fish1, stdOpts(base(31), fish1Emo, fish1Move, { look: 0.2 }), f1.x, f1.z, { yaw: 0.6 });
      break;
    }
    case 'miller': {
      // the miller at his supper, laughing — lamp-lit; both hands grip
      // the table edge / bowl as he rocks with laughter.
      const tableHands = AP({ x: 222, y: 690, grip: 0.55 }, { x: 378, y: 690, grip: 0.55 });
      const Bm = base(41);
      std('miller', OUTFITS.miller, { ...stdOpts(Bm, millerEmo, millerMove, { armPose: tableHands, headTilt: -3.5, look: 0 }), mode: 'sit' }, ml.x, ml.z, { yaw: -0.5 });
      break;
    }
    case 'lock': {
      std('fish1', OUTFITS.fish1, stdOpts(base(31), fish1Emo, fish1Move, { look: -0.3, lookY: 0.15 }), f1.x, f1.z, { yaw: 0.6 });
      std('crowd1', OUTFITS.crowd1, stdOpts(base(55), crowd1Emo, { phase: () => 0, moving: () => false }, { look: -0.3 }), 7, -3, { yaw: -0.4 });
      std('old1', OUTFITS.old1, stdOpts(base(52), old1Emo, { phase: () => 0, moving: () => false }, { look: -0.25, lookY: 0.15 }), -2, -3, { yaw: 0.5 });
      break;
    }
    case 'enter': case 'rise': case 'exit': break;   // the boat + water carry these beats
    case 'truth': {
      // the miller comes down WIPING HIS HANDS — both hands grip the
      // cloth (the 3D cloth prop rides at clothAt) and rub against each
      // other as he walks; a light carryDip sells the motion's weight.
      const rub = Math.sin(f * 0.45) * 13, rubY = Math.cos(f * 0.45) * 7;
      const clothGrip = AP({ x: 300 - 38 + rub, y: 636 + rubY, grip: 0.85 }, { x: 300 + 38 - rub, y: 636 - rubY, grip: 0.85 });
      const dip = millerMove.moving(f) ? carryDip(f, 0.18) : 0;
      const G = millerGaze(f);
      // the cloth itself, drawn in the overlay BETWEEN the gripping
      // hands (same rub phase) — hand and cloth in the same frames;
      // sized to read as a draped cloth, wavy hem, vertical folds
      const clothOv = (p) => {
        const cx = 300 + rub * 0.4, cy = 636 + rubY * 0.4;
        p.poly([[cx - 58, cy - 14], [cx + 58, cy - 18], [cx + 64, cy + 52], [cx + 30, cy + 66], [cx, cy + 54], [cx - 30, cy + 66], [cx - 64, cy + 52]], '#efe6cf', 2.5);
        p.band([[cx - 34, cy - 12], [cx - 30, cy + 52]], '#cbbd97', 3, 0);
        p.band([[cx + 6, cy - 14], [cx + 10, cy + 50]], '#cbbd97', 3, 0);
        p.band([[cx + 40, cy - 14], [cx + 42, cy + 44]], '#cbbd97', 3, 0);
      };
      std('miller', OUTFITS.miller, stdOpts(base(41), millerEmo, millerMove, { armPose: clothGrip, dip, look: G.look, lookY: G.lookY, headTilt: G.tilt }), ml.x, ml.z, { yaw: 0.5, ov: `cloth${q(rub, 1)}`, drawOv: clothOv });
      std('fish1', OUTFITS.fish1, stdOpts(base(31), fish1Emo, fish1Move, { look: 0.2 }), f1.x, f1.z, { yaw: 0.6 });
      std('fish2', OUTFITS.fish2, stdOpts(base(51), fish2Emo, fish2Move, { look: 0.15 }), f2.x, f2.z, { yaw: 0.45 });
      std('crowd1', OUTFITS.crowd1, stdOpts(base(55), crowd1Emo, { phase: () => 0, moving: () => false }, { look: 0.15 }), 7, -3, { yaw: -0.4 });
      std('priest', OUTFITS.priest, stdOpts(base(61), priestEmo, priestMove, { look: -0.15 }), pr.x, pr.z, { yaw: -0.4 });
      break;
    }
    case 'dialogue': {
      // THE dialogue beat: the miller PERFORMS his line — mouth driven by
      // the stem inside the speak segment, closed outside it; he gestures
      // with his free hand on the nod pulses while the other keeps the
      // cloth; the crowd only listens (their mouths never open).
      const s = SPEAK.at(f);
      let exprP = millerEmo(f);
      exprP = SPK.applySpeak(exprP, s);
      const g = gestureAt(f, 41, s.nod || 0);
      const gest = AP({ x: 215, y: 690, grip: 0.6 }, { x: 428 + g.dx, y: 520 + g.dy, grip: 0.12 });
      const Bm = base(41), G = millerGaze(f);
      std('miller', OUTFITS.miller, {
        phase: 0, mode: 'stand', exprP, blink: Bm.blink, seed: 41, breath: Bm.breath,
        tilt: Bm.tilt, headTilt: q(Bm.headTilt + G.tilt + q(s.nod || 0, 2), 2),
        look: q(G.look, 2), lookY: q(G.lookY, 2), squash: q(Bm.squashL, 3), armPose: gest,
      }, ml.x, ml.z, { yaw: 0.5 });
      std('fish1', OUTFITS.fish1, stdOpts(base(31), fish1Emo, fish1Move, { look: -0.2 }), f1.x, f1.z, { yaw: -0.4 });
      std('fish2', OUTFITS.fish2, stdOpts(base(51), fish2Emo, fish2Move, { look: -0.15 }), f2.x, f2.z, { yaw: -0.3 });
      std('priest', OUTFITS.priest, stdOpts(base(61), priestEmo, priestMove, { look: -0.2 }), pr.x, pr.z, { yaw: -0.4 });
      break;
    }
    case 'hookq': case 'hook': {
      // FINAL BEAT (END RULE): narration + hook board only — the miller
      // points up at the board, the fisherman looks up beside him; both
      // mouths CLOSED (plain emo faces, no speak track applied).
      const pt = AP({ x: 204, y: 700, grip: 0.3 }, { x: 448, y: 318, grip: 0.15 });
      const G = millerGaze(f);
      std('miller', OUTFITS.miller, stdOpts(base(41), millerEmo, { phase: () => 0, moving: () => false }, { armPose: pt, look: G.look, lookY: G.lookY, headTilt: G.tilt }), 1.25, -2.0, { yaw: 0.15, s: 1.5 });
      std('fish1', OUTFITS.fish1, stdOpts(base(31), fish1Emo, { phase: () => 0, moving: () => false }, { look: -0.25, lookY: 0.35 }), -0.85, -2.85, { yaw: -0.15, s: 1.25 });
      break;
    }
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
  for (const a of castAt(f)) items.push({ id: a.id, y: a.y, ground: a.ground ?? 0, maxHover: a.y > 0.01 ? 0.16 : 0.06 });
  return items;
};
