// Shot plan for "कभी न बुझने वाली मोमबत्ती" — candle-hindi (Salted Mine
// V3 style lock: painted 3D world, flat round-white-head card characters,
// reference camera grammar — every clause a new shot, push-ins, inserts,
// word-by-word captions; body.js actions; speak.js performed dialogue).
// R2 REBUILD (the approved moonrent R2 standard): opening hero BIG from
// frame 0 (head ~40%+ of frame width, low angle, mid-action); the tube
// REVEAL is a pure object INSERT (pot -> tube -> wick fills the frame, no
// cast, no partial faces); the table-move is a front three-quarter ACTION
// close-up (both men's hands on the table, tube tearing, flame dying at
// centre); the moneylender's horror REACTION pushes to >=65% face width;
// the FINAL is a character beat + hook board together (board ~84% of
// frame width high in frame, hero BIG in the foreground below it,
// pointing up at it, text fully readable).
// ONE set: the moneylender's room — the tall candle table with its rope
// barrier, the oil pot hidden underneath, charpai, shelf, crates.
// Voice stem: Google AI Studio Puck (series voice), 55.051 s, 30 fps,
// TOTAL 1652; line timings from timing.json (faster-whisper small,
// char-mapped onto the script — see ../align.py). Scene changes ONLY at
// line boundaries:
//   L1 the eternal candle   L7 the servant doubts    L13 the table moves
//   L2 god's own flame      L8 he crawls under       L14 the secret is out
//   L3 a coin a darshan     L9 THE TUBE (reveal)     L15 "he admitted..."
//   L4 none may approach    L10 the oil climbs       L16 THE LINE (performed)
//   L5 wax never melts      L11 a hollow show        L17 hook board (book)
//   L6 the blow test        L12 moving day
// Beats pinned to ASR words: the blow bends the flame f592-605, recovers
// by f628; the table shifts f1228-1258, the tube SNAPS f1256-1266, the
// flame dies f1262-1280 (smooth exposure drop, never a pop).
// GRADE: Night Lamp (candle key) / Royal Gold (moving day). Boards never
// graded.
import { M, blinkAt, q, clamp, lerp, ramp, kf } from './motion.js';
import { buildRig, pushInCam, keysCam } from './camrig.js';
import { poseWindows, turnTrack, winkTrack, emoTrack as kitEmoTrack, lifeAt, gripAt, gestureAt, stridePh, jumpTrack, carryDip } from './body.js';
import * as SOL from './solid.js';
import * as T from './toon.js';
import * as SPK from './speak.js';
import { SPEAK_DATA } from './speakdata.js';

export const FPS = 30, TOTAL = 1652, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 123, light: 'night' },
  { id: 'claim', a: 124, b: 248, light: 'night' },
  { id: 'coins', a: 249, b: 313, light: 'night' },
  { id: 'forbidden', a: 314, b: 421, light: 'night' },
  { id: 'steady', a: 422, b: 527, light: 'night' },
  { id: 'blow', a: 528, b: 639, light: 'night' },
  { id: 'suspect', a: 640, b: 743, light: 'night' },
  { id: 'crawl', a: 744, b: 822, light: 'under' },
  { id: 'reveal', a: 823, b: 941, light: 'under' },
  { id: 'oilflow', a: 942, b: 1029, light: 'under' },
  { id: 'truth', a: 1030, b: 1122, light: 'night' },
  { id: 'moving', a: 1123, b: 1224, light: 'day' },
  { id: 'snap', a: 1225, b: 1313, light: 'day' },
  { id: 'exposed', a: 1314, b: 1403, light: 'day' },
  { id: 'tag', a: 1404, b: 1466, light: 'eve' },
  { id: 'dialogue', a: 1467, b: 1574, light: 'eve' },
  { id: 'hookboard', a: 1575, b: 1651, light: 'night' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights / mood grades ----------
export const LIGHTS = {
  night: { az: 150, el: 30, sky: '#5a4632', ground: '#1c1108', hemi: 0.56, sun: '#cbb59a', sunI: 0.5, fog: '#160d06', fogNear: 9, fogFar: 46,
    skyTop: '#0d0906', skyHor: '#2e1f10', sunDisc: '#000000', sunSize: 0, sat: 1.08, vig: 0.32, shadowExt: 14, aurora: 0, gain: '#ffd9ae',
    waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
  under: { az: 150, el: 24, sky: '#4a3620', ground: '#140b04', hemi: 0.52, sun: '#bfae94', sunI: 0.44, fog: '#100a05', fogNear: 5, fogFar: 30,
    skyTop: '#0a0603', skyHor: '#241708', sunDisc: '#000000', sunSize: 0, sat: 1.06, vig: 0.36, shadowExt: 10, aurora: 0, gain: '#eecfa4',
    waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
  day: { az: 105, el: 48, sky: '#ffe0b0', ground: '#4a3418', hemi: 1.12, sun: '#ffd9a0', sunI: 1.85, fog: '#2a1a0c', fogNear: 12, fogFar: 60,
    skyTop: '#7a5a30', skyHor: '#c99a58', sunDisc: '#000000', sunSize: 0, sat: 1.1, vig: 0.26, shadowExt: 16, aurora: 0, gain: '#fff0d0',
    waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
  eve: { az: 140, el: 32, sky: '#6a4a2c', ground: '#20140a', hemi: 0.58, sun: '#ffb45e', sunI: 0.7, fog: '#1e1206', fogNear: 8, fogFar: 44,
    skyTop: '#140b04', skyHor: '#402a12', sunDisc: '#000000', sunSize: 0, sat: 1.09, vig: 0.3, shadowExt: 13, aurora: 0, gain: '#ffd2a2',
    waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
};
const DAY_DEAD = { ...LIGHTS.day, hemi: 0.74, sunI: 1.1, gain: '#c9b294', fog: '#1c1108', skyHor: '#8a6a42' };
const blendLight = (A, B, u) => {
  const o = {};
  for (const k in A) {
    if (typeof A[k] === 'number') o[k] = lerp(A[k], B[k], u);
    else if (typeof A[k] === 'string' && A[k][0] === '#') {
      const pa = [1, 3, 5].map((i) => parseInt(A[k].slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(B[k].slice(i, i + 2), 16));
      o[k] = '#' + pa.map((v, i) => Math.round(lerp(v, pb[i], u)).toString(16).padStart(2, '0')).join('');
    } else o[k] = A[k];
  }
  return o;
};
// ---------- the trick's mechanics (single source of truth) ----------
export const flameOutAt = (f) => smooth(ramp(f, 1262, 1280)); // the flame dies
export const snapAt = (f) => smooth(ramp(f, 1256, 1266));      // the tube snaps
export const tableXAt = (f) => 0.55 * smooth(ramp(f, 1228, 1258)); // the table shifts
export const blowAt = (f) => {
  if (f < 545 || f > 628) return 0;
  if (f < 597) return smooth(ramp(f, 545, 597));
  if (f <= 608) return 1;
  return 1 - smooth(ramp(f, 608, 628));
};
// the oil glint's path: pot mouth -> joint -> under the top -> wick
const OIL_PATH = [[1.32, 0.52, -3.4], [1.12, 0.58, -3.4], [1.14, 1.0, -3.4], [1.3, 1.14, -3.4], [1.3, 1.5, -3.4]];
export const oilPtAt = (f) => {
  const S = shotAt(f);
  if (S.id === 'reveal') return [...OIL_PATH[1]];
  if (S.id !== 'oilflow') return [...OIL_PATH[0]];
  const u = clamp((f - 950) / 62) * (OIL_PATH.length - 1);
  const i = Math.min(OIL_PATH.length - 2, Math.floor(u)), v = u - i;
  return OIL_PATH[i].map((c, k) => lerp(c, OIL_PATH[i + 1][k], v));
};
export const lightFor = (S, f) => {
  if (S.light === 'day') { const d = flameOutAt(f); return d > 0 ? blendLight(LIGHTS.day, DAY_DEAD, d) : { ...LIGHTS.day }; }
  return { ...LIGHTS[S.light] };
};

// ---------- staging ----------
// The hook board stands before the back wall; transform mirrored in
// boards.json — keep in sync.
export const BOARD_POS = [0, 2.0, -8.2];
export const TABLE_POS = [1.3, -3.4];
export const gunAt = (f) => ({ k: 0, x: 0, y: 0, z: 0 });

// cast anchors per shot (single source of truth)
export const heroAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'hook': return { x: 0.15, z: -2.5 };
    case 'claim': return { x: 0.15, z: -2.8 };
    case 'coins': return { x: 1.6, z: -2.75 };
    case 'forbidden': { const u = smooth(ramp(f, 330, 372)); return { x: lerp(0.15, 0.95, u), z: lerp(-2.75, -2.5, u) }; }
    case 'blow': return { x: 2.65, z: -2.95 };
    case 'truth': return { x: 1.55, z: -4.45 };
    case 'moving': return { x: 0.3, z: -2.5 };
    case 'snap': return { x: 2.1 + tableXAt(f), z: -2.55 };
    case 'exposed': return { x: 2.7, z: -2.55 };
    case 'tag': case 'dialogue': return { x: 1.15, z: -2.35 };
    case 'hookboard': return { x: -0.6, z: -3.3 };
    default: return { x: 12, z: 6 };
  }
};
export const srvAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'suspect': return { x: -2.2, z: -2.2 };
    case 'crawl': {
      if (f < 772) { const u = smooth(ramp(f, 748, 772)); return { x: lerp(-0.55, 0.1, u), z: lerp(-2.3, -3.4, u) }; }
      const u = smooth(ramp(f, 772, 800)); return { x: lerp(0.1, 1.02, u), z: -3.4 };
    }
    case 'reveal': case 'oilflow': case 'truth': return { x: 1.02, z: -3.4 };
    case 'moving': {
      if (f < 1180) { const u = smooth(ramp(f, 1127, 1180)); return { x: lerp(-4.7, -3.1, u), z: lerp(-6.6, -5.9, u) }; }
      return { x: -3.1, z: -5.9 };
    }
    case 'snap': case 'exposed': return { x: -1.0, z: -2.1 };
    case 'tag': return { x: -1.5, z: -2.7 };
    case 'dialogue': return { x: -1.6, z: -2.8 };
    case 'hookboard': return { x: 2.3, z: -7.9 };
    default: return { x: 13, z: 7 };
  }
};
export const vilAAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'hook': return { x: -1.35, z: -1.7 };
    case 'claim': return { x: -1.25, z: -1.95 };
    case 'coins': return { x: 2.45, z: -2.6 };
    case 'forbidden': return { x: -0.9, z: -1.8 };
    case 'blow': return { x: 0.0, z: -2.6 };
    case 'moving': {
      if (f < 1200) { const u = smooth(ramp(f, 1140, 1200)); return { x: lerp(5.2, 4.2, u), z: lerp(-6.0, -5.6, u) }; }
      return { x: 4.2, z: -5.6 };
    }
    case 'snap': return { x: 0.72 + tableXAt(f), z: -2.45 };
    case 'exposed': return { x: 0.2, z: -2.6 };
    case 'tag': return { x: -0.7, z: -1.6 };
    case 'dialogue': return { x: -0.8, z: -1.7 };
    default: return { x: 14, z: 8 };
  }
};
export const vilBAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'claim': return { x: 2.95, z: -1.75 };
    case 'coins': return { x: 3.35, z: -1.45 };
    case 'forbidden': { const u = smooth(ramp(f, 318, 362)); return { x: lerp(2.9, 2.25, u), z: lerp(-1.9, -2.45, u) }; }
    case 'moving': return { x: -4.6, z: -5.6 };
    case 'snap': return { x: 1.4 + tableXAt(f), z: -4.5 };
    case 'exposed': return { x: 3.6, z: -1.9 };
    case 'tag': return { x: 3.0, z: -1.7 };
    case 'dialogue': return { x: 3.1, z: -1.8 };
    default: return { x: 15, z: 9 };
  }
};
export const vilCAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'snap': return { x: -1.9, z: -1.3 };
    case 'exposed': return { x: -2.2, z: -1.5 };
    case 'tag': return { x: 0.3, z: -1.15 };
    case 'dialogue': return { x: 0.25, z: -1.3 };
    default: return { x: 16, z: 10 };
  }
};

// ---------- hero / focus ----------
const FOCUS = {
  hook: () => [0.85, 1.45, -2.95],
  claim: () => { const h = heroAt(190); return [h.x, 1.55, h.z]; },
  coins: () => [2.0, 1.2, -2.7],
  forbidden: () => [1.3, 1.5, -3.4],
  steady: () => [1.3, 1.45, -3.4],
  blow: () => [0.9, 1.35, -3.1],
  suspect: () => [-2.2, 1.5, -2.2],
  crawl: () => [0.9, 0.5, -3.2],
  reveal: () => [1.27, 0.9, -3.4],
  oilflow: (f) => oilPtAt(f),
  truth: () => [1.15, 0.95, -3.55],
  moving: () => [-1.2, 1.0, -5.6],
  snap: () => [1.4, 1.12, -3.35],
  exposed: () => { const h = heroAt(1360); return [h.x, 1.52, h.z]; },
  tag: () => { const h = heroAt(1430); return [h.x, 1.52, h.z]; },
  dialogue: () => { const h = heroAt(1520); return [h.x, 1.52, h.z]; },
  hookboard: () => [0, 1.95, -8.2],
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id](f);

// ---------- cameras: EVERY shot is a camrig track on a subject ----------
const heroPos = (f) => { const h = heroAt(f); return [h.x, h.y || 0, h.z]; };
const srvPos = (f) => { const h = srvAt(f); return [h.x, h.y || 0, h.z]; };
// ---------- v4 ACTION CAMERA (Abid's 'v4' standard) ----------
// Every shot PUNCHES in fast at its action start — the distance move is
// concentrated in the first ~15 frames — then TRACKS its subject
// analytically or holds locked on it: no slow drift, no static holds,
// no whole-shot glides. Impact KICKS are declared to the rig at the
// coin handoff (f285), the blow landing (f597), the tube snap (f1256)
// and the flame's death puff (f1264).
const v4PushCam = ({ subject, dir, a, b, d0, d1, h0, h1, lookOff = [0, 0, 0], fov0 = 40, fov1 = 36, n = 15 }) => (f) => {
  const s = subject(f), d = dir(f);
  const u = smooth(ramp(f, a, a + n));            // the punch
  const v = smooth(ramp(f, a + n, b));            // a small settle creep
  const dist = lerp(lerp(d0, d1, u), d1 * 0.95, v);
  const hh = lerp(h0, h1, Math.max(u, v));
  return { pos: [s[0] + d[0] * dist, s[1] + hh, s[2] + d[1] * dist],
    look: [s[0] + lookOff[0], s[1] + lookOff[1], s[2] + lookOff[2]], fov: lerp(fov0, fov1, u), roll: 0 };
};
const RIG_BY_ID = {
  // hook (R2): opens ON the moneylender BIG from frame 0 — low angle,
  // head ~40%+ of frame width, one hand raised to the eternal flame at
  // his right; the candle glows in frame beside him. Solo hero, like
  // the Salted Mine opening (the devotee handoff gets its own close-up
  // in 'coins').
  hook: { cut: 'hard', raw: v4PushCam({ subject: heroPos, a: 0, b: 123, d0: 3.55, d1: 2.45, h0: 1.3, h1: 1.38, lookOff: [0.32, 1.5, 0], fov0: 39, fov1: 34,
    dir: () => [-0.5, 0.86] }) },
  claim: { cut: 'hard', raw: v4PushCam({ subject: heroPos, a: 124, b: 248, d0: 5.2, d1: 2.85, h0: 1.72, h1: 1.64, lookOff: [0, 1.55, 0], fov0: 40, fov1: 33, n: 16,
    dir: () => [-0.3, 0.95] }) },
  // coins (R2): front close-up of the handoff itself — the devotee's
  // coin hand and the moneylender's receiving palm meet at frame
  // centre, both faces big above.
  coins: { cut: 'hard', raw: keysCam({ keys: [
    { f: 249, pos: [2.12, 1.32, 0.85], look: [1.97, 1.18, -2.7], fov: 37 },
    { f: 264, pos: [2.1, 1.29, 0.52], look: [1.98, 1.19, -2.71], fov: 34.5, ease: 'surge' },
    { f: 313, pos: [2.1, 1.28, 0.5], look: [1.99, 1.2, -2.72], fov: 34, ease: 'surge' }] }) },
  // forbidden: low angle UP at the candle on its tall table — the
  // moneylender steps into frame and bars the way.
  forbidden: { cut: 'hard', raw: keysCam({ keys: [
    { f: 314, pos: [0.2, 0.95, 0.9], look: [1.3, 1.5, -3.4], fov: 41 },
    { f: 330, pos: [0.32, 0.97, 0.55], look: [1.29, 1.51, -3.4], fov: 39, ease: 'surge' },
    { f: 374, pos: [0.44, 1.0, 0.32], look: [1.28, 1.52, -3.4], fov: 37, ease: 'surge' },
    { f: 421, pos: [0.45, 1.0, 0.3], look: [1.28, 1.52, -3.4], fov: 37, ease: 'surge' }] }) },
  // steady INSERT: the flame fills the frame — no drip, no shrink.
  steady: { cut: 'hard', raw: keysCam({ keys: [
    { f: 422, pos: [0.5, 1.62, -1.5], look: [1.3, 1.42, -3.4], fov: 30 },
    { f: 437, pos: [0.68, 1.59, -1.72], look: [1.3, 1.43, -3.4], fov: 28.5, ease: 'surge' },
    { f: 527, pos: [0.72, 1.58, -1.75], look: [1.3, 1.43, -3.4], fov: 28, ease: 'surge' }] }) },
  blow: { cut: 'hard', raw: keysCam({ keys: [
    { f: 528, pos: [-1.7, 1.5, 0.7], look: [0.9, 1.3, -3.1], fov: 39 },
    { f: 544, pos: [-1.38, 1.46, 0.24], look: [0.94, 1.31, -3.14], fov: 36.5, ease: 'surge' },
    { f: 639, pos: [-1.3, 1.45, 0.2], look: [0.95, 1.32, -3.15], fov: 36, ease: 'surge' }] }) },
  suspect: { cut: 'hard', raw: v4PushCam({ subject: srvPos, a: 640, b: 743, d0: 4.6, d1: 3.1, h0: 1.58, h1: 1.5, lookOff: [0, 1.5, 0], fov0: 39, fov1: 33,
    dir: () => [-0.25, 0.97] }) },
  // crawl: floor-level POV as the servant slips under the table
  // crawl (v4): floor-level TRACKING — the camera slips under the
  // table WITH the servant at his own speed, punching in over the
  // first 15 frames, its look riding ahead of his crawl.
  crawl: { cut: 'hard', raw: (f) => {
    const s = srvAt(f), u = smooth(ramp(f, 744, 759));
    const back = lerp(3.9, 3.35, u);
    return { pos: [s.x - back * 0.52, 0.66, s.z + back * 0.86], look: [s.x + 0.35, 0.48, s.z - 0.15], fov: lerp(42, 39, u), roll: 0 };
  } },
  // reveal INSERT (R2): PURE object insert, no cast — low three-
  // quarter from the front-left, sliding UNDER the cloth drape's
  // bottom edge (the drape hides the tube's top run — that is its
  // job): the oil pot fills the lower frame and the tube climbs
  // out of its mouth toward the tabletop. Candlelight rakes down
  // (brightest at the source above).
  reveal: { cut: 'hard', raw: keysCam({ keys: [
    { f: 823, pos: [-0.95, 0.5, -3.04], look: [1.28, 0.55, -3.4], fov: 33 },
    { f: 838, pos: [-0.9, 0.55, -3.05], look: [1.285, 0.59, -3.4], fov: 30.5, ease: 'surge' },
    { f: 941, pos: [-0.88, 0.56, -3.06], look: [1.29, 0.6, -3.4], fov: 30, ease: 'surge' }] }) },
  // oilflow (R2): SIDE PROFILE from the table's left end — the one
  // angle where the tube's whole run is honestly visible — rising
  // with the glint's climb, pot -> wick, assembly filling the frame.
  // oilflow (v4): the camera RISES WITH the oil glint itself — locked
  // onto oilPtAt every frame, pot -> wick, at the glint's own speed.
  oilflow: { cut: 'hard', raw: (f) => {
    const o = oilPtAt(f), u = smooth(ramp(f, 942, 957));
    return { pos: [lerp(-1.3, -1.08, u), o[1] + 0.12, -3.04], look: [o[0], o[1] + 0.05, o[2]], fov: lerp(36, 32, u), roll: 0 };
  } },
  truth: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1030, pos: [0.0, 1.1, 1.0], look: [1.2, 0.95, -3.6], fov: 40 },
    { f: 1045, pos: [0.22, 1.03, 0.54], look: [1.2, 0.97, -3.58], fov: 37.5, ease: 'surge' },
    { f: 1122, pos: [0.25, 1.02, 0.5], look: [1.2, 0.98, -3.58], fov: 37, ease: 'surge' }] }) },
  // moving (v4): the camera travels WITH the movers — anchored to
  // their live midpoint every frame, punching in as the walk starts.
  moving: { cut: 'hard', raw: (f) => {
    const sv = srvAt(f), va = vilAAt(f);
    const u = smooth(ramp(f, 1123, 1138)), v = smooth(ramp(f, 1138, 1224));
    const mx = (sv.x + va.x) / 2, mz = (sv.z + va.z) / 2;
    const d = lerp(lerp(8.9, 8.35, u), 7.75, v);
    return { pos: [mx - 0.65, lerp(1.7, 1.6, Math.max(u, v)), mz + d], look: [mx - 1.45, 1.0, mz + 0.7], fov: lerp(42, 39, u), roll: 0 };
  } },
  // snap (R2 ACTION BEAT): front three-quarter CLOSE-UP on the table —
  // both men stand at its front corners with their hands ON the front
  // edge and drag WITH it (their anchors ride tableXAt); the candle
  // fills the centre above, the tube joint tears below the top, and
  // the flame sputters and dies in front of everyone. Camera is LOW
  // and in FRONT — never behind the cards.
  // snap (v4 ACTION BEAT): the camera RIDES the drag — its x follows
  // tableXAt as the table slides, punching in over the first 14
  // frames; the declared KICKS land at the snap (f1256) and the
  // flame's death (f1264).
  snap: { cut: 'hard', raw: (f) => {
    const tx = tableXAt(f), u = smooth(ramp(f, 1225, 1239));
    const d = lerp(5.6, 5.05, u);
    return { pos: [0.95 + tx * 0.85 - d * 0.10, lerp(1.3, 1.27, u), -3.35 + d], look: [1.45 + tx * 0.75, 1.07, -3.3], fov: lerp(45, 43, u), roll: 0 };
  } },
  // exposed (R2 REACTION): the push-in now lands at >=65% face width —
  // the moneylender's horror as the secret hangs in the air.
  exposed: { cut: 'hard', raw: v4PushCam({ subject: heroPos, a: 1314, b: 1403, d0: 3.6, d1: 2.42, h0: 1.6, h1: 1.55, lookOff: [0, 1.52, 0], fov0: 36, fov1: 29.5, n: 14,
    dir: () => [0.3, 0.95] }) },
  tag: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1404, pos: [1.1, 1.6, 1.9], look: [1.1, 1.35, -2.5], fov: 39 },
    { f: 1419, pos: [1.08, 1.56, 1.36], look: [1.12, 1.37, -2.46], fov: 36.5, ease: 'surge' },
    { f: 1466, pos: [1.08, 1.55, 1.3], look: [1.12, 1.38, -2.45], fov: 36, ease: 'surge' }] }) },
  // dialogue: the performed line — a slow push into the moneylender's
  // face; the camera HOLDS on the speaker.
  dialogue: { cut: 'hard', raw: v4PushCam({ subject: heroPos, a: 1467, b: 1574, d0: 3.1, d1: 2.42, h0: 1.6, h1: 1.56, lookOff: [0, 1.52, 0], fov0: 33, fov1: 30, n: 12,
    dir: () => [0.35, 0.94] }) },
  // hookboard (R2 FINAL, fixed): character beat + board together,
  // moonrent composition — the board rides high and wide (~84% of
  // frame width, centred margins) while the moneylender stands in
  // the FOREGROUND below it (head ~21% of frame width), pointing up
  // at the hook text; his head stays fully below the board's bottom
  // edge so no glyph is ever overlapped. Full opacity to the last
  // frame.
  hookboard: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1575, pos: [0.0, 2.3, 2.9], look: [-0.05, 1.5, -8.3], fov: 49 },
    { f: 1590, pos: [0.0, 2.47, 1.42], look: [0.0, 1.37, -8.3], fov: 47.3, ease: 'surge' },
    { f: 1651, pos: [0.0, 2.5, 1.3], look: [0.0, 1.35, -8.3], fov: 47, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: 285, a: 0.12 }, { f: 597, a: 0.22 }, { f: 1256, a: 0.35 }, { f: 1264, a: 0.26 }],
  sigma: 2.3, fovSigma: 1.6,
});
export const camAt = (f) => ({ ...RIG.camAt(f), flash: 0 });
export const RIG_META = {
  kicks: RIG.declared.kicks, hardCuts: RIG.declared.hardCuts,
  blends: SHOTS.filter((s) => RIG_BY_ID[s.id].cut === 'blend').map((s) => ({ a: s.a - Math.floor(RIG_BY_ID[s.id].blend / 2), b: s.a + Math.ceil(RIG_BY_ID[s.id].blend / 2) })),
  whips: RIG.declared.whips,
  samples: RIG.samples,
};
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), hp = heroPosAt(f);
  let cinf = 2.2;
  if (['hookboard'].includes(S.id)) cinf = 1.3;
  if (['steady', 'reveal', 'oilflow'].includes(S.id)) cinf = 3.4;
  if (['dialogue', 'tag', 'exposed', 'crawl'].includes(S.id)) cinf = 3.0;
  if (['coins', 'blow', 'suspect', 'truth', 'snap', 'moving', 'forbidden', 'hook'].includes(S.id)) cinf = 2.6;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const oil = oilPtAt(f), tx = tableXAt(f);
  return {
    always: 1,
    hookK: S.id === 'hookboard' ? smooth(ramp(f, 1583, 1609)) : 0,
    lampK: 1,
    flameK: 1 - flameOutAt(f),
    blowK: blowAt(f),
    snapK: snapAt(f),
    tableX: tx,
    winCol: S.light === 'day' ? '#bcd6f5' : '#27354f',
    oilX: oil[0], oilY: oil[1], oilZ: oil[2],
    blastX: 1.3 + tx, blastY: 1.66, blastZ: -3.4,
  };
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  const puff = f >= 1264 && f <= 1284 ? 0.7 : 0; // the flame's last breath
  const spark = S.id === 'oilflow' ? 0.85 : S.id === 'reveal' ? 0.3 : 0;
  return { moteRate: S.light === 'day' ? 0.04 : 0.09, blastRate: puff, sparkRate: spark, steamRate: 0, shimmerRate: 0 };
};
export const fxAt = () => [];

// ---------- cast ----------
// NO card tint in any light — faces stay pure white, costume colours flat
// and saturated even in candlelight (the reference's rule).
const tintFor = () => '#ffffff';
export const OUTFITS = {
  hero: { jacket: '#7a1f2b', pants: '#efe6d0', boots: '#3a2410', hat: 'turban', turban: '#c9962e', skin: '#fbf7ef', moustache: '#2a201a', bigMoustache: true },
  srv: { jacket: '#6b5a44', pants: '#4a4038', boots: '#241a12', hat: 'hair', hair: '#1c1712', skin: '#fbf7ef' },
  vilA: { jacket: '#1f7a6a', pants: '#33424a', boots: '#1c1712', hat: 'cap', cap: '#274b63', skin: '#fbf7ef' },
  vilB: { jacket: '#7a4a2a', pants: '#3c3a40', boots: '#241a12', hat: 'hair', hair: '#14100c', skin: '#fbf7ef' },
  vilC: { jacket: '#a03a5e', pants: '#4a2436', boots: '#241a12', hat: 'hair', hair: '#241a12', skin: '#fbf7ef' },
};

// ---------- HEAD PERFORMANCE ----------
// emoTrack comes from kit body.js v2 (the same smootherstep morph
// algorithm, now the shared implementation); this wrapper keeps the
// local (initial, events) call shape.
const emoTrack = (initial, events) => kitEmoTrack(T.faceP, initial, events);
const emoHero = emoTrack('smile', [
  [124, 'grin', 8], [314, 'smug', 8], [528, 'smug', 8], [1030, 'grin', 8], [1123, 'stern', 8],
  [1225, 'smug', 8], [1282, 'shock', 6], [1340, 'nervous', 9], [1404, 'pained', 9], [1467, 'smile', 8], [1575, 'grin', 8],
]);
const emoSrv = emoTrack('neutral', [
  [640, 'thinking', 9], [744, 'nervous', 8], [823, 'wonder', 9], [1030, 'relief', 9],
  [1123, 'neutral', 8], [1225, 'shock', 8], [1404, 'relief', 8], [1467, 'smile', 8],
]);
const emoVilA = emoTrack('grin', [
  [1225, 'shock', 8], [1314, 'shock', 8], [1404, 'relief', 8],
]);
const emoVilB = emoTrack('smile', [
  [314, 'nervous', 8], [1225, 'shock', 8], [1314, 'shock', 8], [1404, 'relief', 8],
]);
const emoVilC = emoTrack('neutral', [
  [1225, 'shock', 8], [1314, 'shock', 8], [1404, 'relief', 8],
]);
// ---------- BODY ACTIONS (library body.js) ----------
// the servant KNEELS low and crawls under the table (L8-L11); the hero
// TURNS to the crowd as he admits the trick and WINKS on his smug claim.
const srvPose = poseWindows([{ a: 744, b: 1122, mode: 'kneel1', inF: 8, outF: 6 }]);
const heroTurn = turnTrack([{ f0: 1418, dur: 12, dir: 1 }]);
const heroWink = winkTrack([{ a: 208, b: 218 }]);
// v2 systems: the moneylender's free hand TALKS through his performed
// line (gesture pulses on the stressed word onsets — अकेली f1489, नहीं
// f1512, नीचे f1536, घड़ा f1545); both men GRIP the table edge and take
// its weight through the drag (gripAt + carryDip strain); the flame's
// death lands as a physical STARTLE hop (jumpTrack, f1280).
const gestHero = gestureAt([{ a: 1467, b: 1570, beats: [1489, 1512, 1536, 1545], base: 0.42, amp: 0.15 }]);
const snapGrip = gripAt([{ f0: 1222, dur: 12, type: 'lift' }]);
const startle = jumpTrack([{ f0: 1280, dur: 10, h: 0.045, back: 5 }]);
const SPEAK = SPK.makeSpeakPlayer(SPEAK_DATA);
const micro = (f, seed) => 1.1 * Math.sin((f + seed * 5) * 0.037 + 1);
const nodAt = (f, f0, n = 9, depth = 0.34) => (f >= f0 && f <= f0 + n ? Math.sin((f - f0) / n * Math.PI) * depth : 0);
// ANIMATION UPGRADE v2 (kit body.js lifeAt): continuous life for EVERY
// figure — breathing phase + weight-shift lean + micro sway, keyed by
// the same per-character seeds the head system already uses. Nobody
// stands like a post any more, not even while listening.
const LIFE = { 31: lifeAt({ seed: 31 }), 41: lifeAt({ seed: 41 }), 61: lifeAt({ seed: 61 }), 81: lifeAt({ seed: 81 }), 91: lifeAt({ seed: 91 }) };
const head = (f, seed, tilt, look, lookY, facing = 0, squash = 0) => {
  const L = (LIFE[seed] || LIFE[31])(f);
  return {
    headTilt: q(tilt + micro(f, seed) + L.sway, 1), tilt: q(L.tilt, 1), breath: Math.round(L.breath / 6) * 6,
    look: q(look, 2), lookY: q(lookY, 2), facing: q(facing, 2), squash: q(squash, 2),
  };
};
const noBlush = (P) => { P.blush = 0; P.openL = Math.min(1, (P.openL ?? 0.85) * 1.45); P.openR = Math.min(1, (P.openR ?? 0.85) * 1.45); return P; };

export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, z, extra = {}) => out.push({ id, x, y: extra.y || 0, z, r: 0.32, ground: extra.ground || 0,
    actor: (T) => ({ key: 'smx' + JSON.stringify(o) + JSON.stringify(opts) + (extra.y || 0),
      draw: (p) => { T.bodyFront(p, o, opts); if (extra.overlay) extra.overlay(p); },
      x, y: extra.y || 0, z, ground: extra.ground || 0, tint, ...extra }) });
  const h = heroAt(f), sv = srvAt(f), va = vilAAt(f), vb = vilBAt(f), vc = vilCAt(f);
  let HP = noBlush(emoHero.at(f));
  const SP = noBlush(emoSrv.at(f)), AP = noBlush(emoVilA.at(f)), BP = noBlush(emoVilB.at(f)), CP = noBlush(emoVilC.at(f));
  const winkK = heroWink(f);
  if (winkK > 0) HP = T.blendFaceP(HP, T.faceP('wink', 31), winkK);
  const P = srvPose(f);
  const srvKneel = ['crawl', 'reveal', 'oilflow', 'truth'].includes(S.id);
  const srvOpts = (o) => srvKneel ? { ...o, mode: P.mode, squash: P.squash } : o;
  switch (S.id) {
    case 'hook': {
      // R2 opening: the moneylender SOLO and BIG, mid-action — one arm
      // UP at the flame he "owns", the candle glowing beside him.
      std('hero', OUTFITS.hero, { expr: 'smile', exprP: HP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.8],
        ...head(f, 31, -3, 0.35, -0.4, 0.35) }, h.x, h.z, { yaw: 0.35 });
      break;
    }
    case 'claim': {
      std('hero', OUTFITS.hero, { expr: 'grin', exprP: HP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.7],
        ...head(f, 31, -2, 0, -0.15 + nodAt(f, 190, 9, -0.7), 0) }, h.x, h.z, { yaw: 0.1 });
      std('vilA', OUTFITS.vilA, { expr: 'grin', exprP: AP, mode: 'stand', blink: blinkAt(f, 61), seed: 61,
        ...head(f, 61, -1.5, 0.45, -0.2, 0.45) }, va.x, va.z, { yaw: 0.4 });
      std('vilB', OUTFITS.vilB, { expr: 'smile', exprP: BP, mode: 'stand', blink: blinkAt(f, 81), seed: 81,
        ...head(f, 81, -1.5, -0.45, -0.2, -0.45) }, vb.x, vb.z, { yaw: -0.4 });
      break;
    }
    case 'coins': {
      // R2 handoff close-up: the devotee's coin hand reaches in from
      // the right; the moneylender's palm opens to receive at centre.
      std('vilA', OUTFITS.vilA, { expr: 'grin', exprP: AP, mode: 'stand', blink: blinkAt(f, 61), seed: 61, prop: ['coin', 0.8],
        ...head(f, 61, -1, -0.5, 0.3 + nodAt(f, 285), -0.5) }, va.x, va.z, { yaw: -0.3, flip: true });
      std('hero', OUTFITS.hero, { expr: 'smile', exprP: HP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.92],
        ...head(f, 31, -1.5, 0.5, 0.25, 0.5) }, h.x, h.z, { yaw: 0.45 });
      break;
    }
    case 'forbidden': {
      // vilB creeps toward the table; the hero steps in and bars him
      std('vilB', OUTFITS.vilB, { expr: 'smile', exprP: BP, mode: (f >= 318 && f <= 362) ? 'march' : 'stand', phase: q(stridePh(2.9, vb.x), 2), blink: blinkAt(f, 81), seed: 81,
        ...head(f, 81, -3.5, -0.3, -0.5, -0.3) }, vb.x, vb.z, { yaw: -0.3 });
      std('hero', OUTFITS.hero, { expr: 'smile', exprP: HP, mode: (f >= 330 && f <= 372) ? 'march' : 'stand', phase: q(stridePh(0.15, h.x), 2), blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.55],
        ...head(f, 31, -2, -0.5, -0.3, -0.5) }, h.x, h.z, { yaw: -0.5 });
      std('vilA', OUTFITS.vilA, { expr: 'grin', exprP: AP, mode: 'stand', blink: blinkAt(f, 61), seed: 61,
        ...head(f, 61, -3, 0.4, -0.45, 0.4) }, va.x, va.z, { yaw: 0.35 });
      break;
    }
    case 'steady': {
      // pure INSERT on the flame — no cast in frame
      break;
    }
    case 'blow': {
      // vilA leans in and blows; the flame bends and stands back up
      const blowP = T.blendFaceP(AP, T.faceP('whistle', 61), blowAt(f));
      std('vilA', OUTFITS.vilA, { expr: 'grin', exprP: blowP, mode: 'stand', blink: blinkAt(f, 61), seed: 61,
        ...head(f, 61, kf([[528, -2], [560, 3.5], [610, 4], [639, 1]], f), 0.55, kf([[528, -0.2], [560, 0.35], [639, 0.1]], f), 0.55) }, va.x, va.z, { yaw: 0.5 });
      std('hero', OUTFITS.hero, { expr: 'smile', exprP: HP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, -2.5, -0.45, -0.35, -0.45) }, h.x, h.z, { yaw: -0.4 });
      break;
    }
    case 'suspect': {
      // the servant stops sweeping and stares at the candle: it should
      // have melted long ago
      std('srv', OUTFITS.srv, { expr: 'neutral', exprP: SP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, kf([[640, 0], [690, -3], [743, -3.5]], f), 0.6, -0.25, 0.6) }, sv.x, sv.z, { yaw: 0.55 });
      break;
    }
    case 'crawl': {
      // on his knees, slipping under the table in the dark
      std('srv', OUTFITS.srv, srvOpts({ expr: 'neutral', exprP: SP, blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, 2.5, 0.3, -0.3, 0.3) }), sv.x, sv.z, { yaw: 0.3 });
      break;
    }
    case 'reveal': case 'oilflow': {
      // R2: PURE object inserts — the pot, the tube, the climbing
      // glint. No cast in frame at all (the servant's discovery is
      // told by the crawl before and the truth shot after).
      break;
    }
    case 'truth': {
      std('srv', OUTFITS.srv, srvOpts({ expr: 'neutral', exprP: SP, blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -4.5, 0.25, -0.5, 0.25) }), sv.x, sv.z, { yaw: 0.25 });
      // above the table the moneylender counts coins, suspecting nothing
      std('hero', OUTFITS.hero, { expr: 'grin', exprP: HP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['coin', 0.6],
        ...head(f, 31, 1.5, -0.3, 0.5 + nodAt(f, 1080), -0.3) }, h.x, h.z, { yaw: -0.3 });
      break;
    }
    case 'moving': {
      const mv = (a, b) => f >= a && f <= b;
      std('srv', OUTFITS.srv, { expr: 'neutral', exprP: SP, mode: mv(1127, 1180) ? 'march' : 'stand', phase: q(stridePh(-4.7, lerp(-4.7, -3.1, smooth(ramp(f, 1127, 1180)))), 2), blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, 1, 0.3, 0.3, 0.3) }, sv.x, sv.z, { yaw: 0.3 });
      std('vilA', OUTFITS.vilA, { expr: 'grin', exprP: AP, mode: mv(1140, 1200) ? 'march' : 'stand', phase: q(stridePh(5.2, lerp(5.2, 4.2, smooth(ramp(f, 1140, 1200)))), 2), blink: blinkAt(f, 61), seed: 61,
        ...head(f, 61, 1, -0.3, 0.3, -0.3) }, va.x, va.z, { yaw: -0.3 });
      std('vilB', OUTFITS.vilB, { expr: 'smile', exprP: BP, mode: 'stand', blink: blinkAt(f, 81), seed: 81,
        ...head(f, 81, 0.5, 0.4, 0.2, 0.4) }, vb.x, vb.z, { yaw: 0.35 });
      std('hero', OUTFITS.hero, { expr: 'smile', exprP: HP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.6],
        ...head(f, 31, -1, -0.4, 0.15, -0.4) }, h.x, h.z, { yaw: -0.35 });
      break;
    }
    case 'snap': {
      // R2 ACTION: vilA and the moneylender grip the table's front
      // edge side by side (hands forward-down on the edge, bodies
      // leaning in, the candle rising between them) and drag WITH
      // it as it slides. Every head snaps UP to the candle the
      // moment the flame dies (f1285).
      const dead = flameOutAt(f);
      const G = snapGrip(f), J = startle(f);
      const strain = Math.max(G.squash, (f >= 1228 && f <= 1266) ? carryDip(f, 0.55) : 0, J.squash);
      std('vilA', OUTFITS.vilA, { expr: 'grin', exprP: AP, mode: 'stand', blink: blinkAt(f, 61), seed: 61, prop: ['point', q(0.72 + 0.24 * G.k, 2)],
        ...head(f, 61, kf([[1225, 3], [1258, 3.5], [1285, -3.5], [1313, -3.5]], f) - 0.6 * J.lean, -0.4, 0.35 - 0.75 * dead, -0.4, strain) }, va.x, va.z, { yaw: -0.4, y: J.y });
      std('hero', OUTFITS.hero, { expr: 'smile', exprP: HP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', q(0.72 + 0.24 * G.k, 2)],
        ...head(f, 31, kf([[1225, 3], [1258, 3.5], [1285, -3], [1313, -3]], f) - 0.6 * J.lean, 0.4, 0.35 - 0.75 * dead, 0.4, strain) }, h.x, h.z, { yaw: 0.4, flip: true, y: J.y });
      break;
    }
    case 'exposed': {
      // the secret is out; the crowd stares at the moneylender, who has
      // no answer — mouth shut, eyes down
      std('hero', OUTFITS.hero, { expr: 'smile', exprP: HP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, kf([[1314, 2], [1360, 4], [1403, 3.5]], f), 0.1, 0.55, 0.1) }, h.x, h.z, { yaw: 0.1 });
      std('vilA', OUTFITS.vilA, { expr: 'grin', exprP: AP, mode: 'stand', blink: blinkAt(f, 61), seed: 61, prop: ['point', 0.7],
        ...head(f, 61, -1.5, 0.55, 0, 0.55) }, va.x, va.z, { yaw: 0.5 });
      std('vilB', OUTFITS.vilB, { expr: 'smile', exprP: BP, mode: 'stand', blink: blinkAt(f, 81), seed: 81,
        ...head(f, 81, -1.5, -0.55, 0, -0.55) }, vb.x, vb.z, { yaw: -0.5 });
      std('srv', OUTFITS.srv, { expr: 'neutral', exprP: SP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -1.5, 0.55, 0, 0.55) }, sv.x, sv.z, { yaw: 0.5 });
      std('vilC', OUTFITS.vilC, { expr: 'neutral', exprP: CP, mode: 'stand', blink: blinkAt(f, 91), seed: 91,
        ...head(f, 91, -1.5, 0.5, 0, 0.5) }, vc.x, vc.z, { yaw: 0.45 });
      break;
    }
    case 'tag': {
      // he raises a hand and admits it — the narration tag; his mouth
      // stays shut until the performed line
      const Tn = heroTurn(f);
      std('hero', OUTFITS.hero, { expr: 'smile', exprP: HP, mode: 'stand', squash: Tn.squash, blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.45],
        ...head(f, 31, -1.5, kf([[1404, -0.4], [1418, -0.4], [1430, 0], [1466, 0]], f), 0.1, kf([[1404, -0.35], [1430, 0], [1466, 0]], f)) }, h.x, h.z, { yaw: Tn.yaw, y: Tn.hop });
      std('vilA', OUTFITS.vilA, { expr: 'grin', exprP: AP, mode: 'stand', blink: blinkAt(f, 61), seed: 61,
        ...head(f, 61, -1.5, 0.5, 0, 0.5) }, va.x, va.z, { yaw: 0.45 });
      std('vilB', OUTFITS.vilB, { expr: 'smile', exprP: BP, mode: 'stand', blink: blinkAt(f, 81), seed: 81,
        ...head(f, 81, -1.5, -0.5, 0, -0.5) }, vb.x, vb.z, { yaw: -0.45 });
      std('srv', OUTFITS.srv, { expr: 'neutral', exprP: SP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -1.5, 0.45, 0, 0.45) }, sv.x, sv.z, { yaw: 0.4 });
      std('vilC', OUTFITS.vilC, { expr: 'neutral', exprP: CP, mode: 'stand', blink: blinkAt(f, 91), seed: 91,
        ...head(f, 91, -1.5, -0.45, 0, -0.45) }, vc.x, vc.z, { yaw: -0.4 });
      break;
    }
    case 'dialogue': {
      // THE LINE, performed: the moneylender's mouth is driven by the
      // stem itself (speak.js); every other mouth stays shut.
      const sp = SPEAK.at(f);
      const speakP = SPK.applySpeak({ ...T.faceP('smile'), cheek: 0 }, sp);
      speakP.blush = 0; speakP.openL = Math.min(1, (speakP.openL ?? 0.85) * 1.45); speakP.openR = Math.min(1, (speakP.openR ?? 0.85) * 1.45);
      const LH = LIFE[31](f);
      std('hero', OUTFITS.hero, { expr: 'smile', exprP: speakP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', q(gestHero(f).k, 2)],
        headTilt: q((sp.nod || 0) + micro(f, 31) + LH.sway - 1.5, 1), tilt: q(LH.tilt, 1), breath: Math.round(LH.breath / 6) * 6,
        look: q(0.08, 2), lookY: q(0.02, 2), facing: q(0.1, 2), squash: 0 }, h.x, h.z, { yaw: 0.1 });
      std('vilA', OUTFITS.vilA, { expr: 'grin', exprP: AP, mode: 'stand', blink: blinkAt(f, 61), seed: 61,
        ...head(f, 61, -1.5, 0.45, 0.05, 0.45) }, va.x, va.z, { yaw: 0.4 });
      std('vilB', OUTFITS.vilB, { expr: 'smile', exprP: BP, mode: 'stand', blink: blinkAt(f, 81), seed: 81,
        ...head(f, 81, -1.5, -0.45, 0.05, -0.45) }, vb.x, vb.z, { yaw: -0.4 });
      std('srv', OUTFITS.srv, { expr: 'neutral', exprP: SP, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -1.5, 0.4, 0.05, 0.4) }, sv.x, sv.z, { yaw: 0.35 });
      std('vilC', OUTFITS.vilC, { expr: 'neutral', exprP: CP, mode: 'stand', blink: blinkAt(f, 91), seed: 91,
        ...head(f, 91, -1, -0.4, 0.05, -0.4) }, vc.x, vc.z, { yaw: -0.35 });
      break;
    }
    case 'hookboard': {
      // R2 final: the moneylender alone in the foreground below the
      // board, grinning and pointing UP at the hook text — character
      // beat and board in one frame, his silhouette fully below the
      // board's bottom edge so the text stays clear.
      std('hero', OUTFITS.hero, { expr: 'grin', exprP: HP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.85],
        ...head(f, 31, -2, 0.5, -0.05, 0.5) }, h.x, h.z, { yaw: 0.45 });
      break;
    }
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity ----------
export const STATICS = [
  SOL.aabb(-7.5, -4.4, -8.65, -8.35, { h: 3.6, id: 'backwallL' }),
  SOL.aabb(-2.6, 7.5, -8.65, -8.35, { h: 3.6, id: 'backwallR' }),
  SOL.aabb(-7.65, -7.35, -8.5, 3.5, { h: 3.6, id: 'wallL' }),
  SOL.aabb(7.35, 7.65, -8.5, 3.5, { h: 3.6, id: 'wallR' }),
  SOL.circle(0.6, -3.8, 0.05, { h: 1.03, id: 'legFL' }),
  SOL.circle(2.0, -3.8, 0.05, { h: 1.03, id: 'legFR' }),
  SOL.circle(0.6, -3.0, 0.05, { h: 1.03, id: 'legBL' }),
  SOL.circle(2.0, -3.0, 0.05, { h: 1.03, id: 'legBR' }),
  SOL.aabb(-6.05, -5.15, -7.95, -7.25, { h: 1.15, id: 'crates' }),
  SOL.circle(-6.35, -6.7, 0.34, { h: 0.85, id: 'barrel' }),
  SOL.circle(-1.9, -6.9, 0.34, { h: 0.55, id: 'sack1' }),
  SOL.circle(5.9, -6.6, 0.31, { h: 0.5, id: 'sack2' }),
  SOL.circle(-2.08, -8.28, 0.06, { h: 2.0, id: 'boardpostL' }),
  SOL.circle(2.08, -8.28, 0.06, { h: 2.0, id: 'boardpostR' }),
];
export const WORLD = SOL.makeWorld(STATICS);
export const dynamicsAt = (f) => {
  const out = [];
  for (const a of castAt(f)) out.push(SOL.circle(a.x, a.z, a.r, { kind: 'dynamic', id: a.id, group: '' }));
  return out;
};
export const groundItemsAt = (f) => {
  const items = [];
  for (const a of castAt(f)) items.push({ id: a.id, y: a.y, ground: a.ground || 0, maxHover: 0.06 });
  return items;
};
