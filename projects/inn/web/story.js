// Shot plan for "The Inn Where Nobody Ever Paid" — inn (v4 UPGRADE:
// "v4" ACTION CAMERA + ANIMATION UPGRADE v1+v2, Salted Mine V3 style).
// Batch 8 E2, picture-only rebuild on the existing stem — stem, script,
// beat map (TIMING), boards text and mix are UNCHANGED from the v4-line
// build (web_prev4/). ONE set: a warm roadside inn yard at golden hour —
// timber facade, lit windows, story fire, long guest table, the great
// leather book on its lectern, and the chest of gold at the payoff.
// Voice stem: 55.571 s, 30 fps, TOTAL 1667; timings from faster-whisper
// base.en word alignment (words.json, match 0.975). Scene changes ONLY
// at clause boundaries:
//   S1  0.00- 4.06 drone: On the busiest road...coin.   S7  26.30-29.00 dialogue: "Coins run out..."
//   S2  4.48- 8.48 guests: Guests ate hot stew...       S8  29.64-33.70 merchant: A cheating merchant...
//   S3  8.94-12.12 price: The price of a night...       S9  34.16-39.80 book: The keeper opened his book...
//   S4 12.66-17.24 pay: A soldier paid...               S10 40.46-44.90 writer: Then one spring...
//   S5 17.76-21.50 write: Every night the keeper...     S11 45.50-50.72 chest: He paid a chest of gold...
//   S6 22.06-25.58 purse: A rich guest once offered...  S12 51.24-55.14 hook: But tomorrow...village?
// GRADE (FILTER_VFX_LIGHTING pack): Memory Warm throughout; fireside
// beats blend toward a deeper firelight; the hook blends to dusk. Grade
// changes ONLY on clause boundaries. Signature VFX: fire flames + embers
// (brightest at source), window/lantern glow, gold sheen sweep on the
// chest, dust motes in the warm light.
//
// v4 CAMERA: every shot is a keysCam track in the valleyfly/fireless
// grammar — fast eased push-ins land in 12-18f at action starts, tracking
// keys follow walking subjects at their speed, one authored fast swing
// inside S9 lands the sailor's shock reaction, a declared kick hits the
// chest opening (f1430). No slow drift, no static holds, camera never
// behind the cards (front / front three-quarter only, yaws <= 0.55).
// R2 FRAMING: opening = keeper BIG from frame 0 (push-in, then a pull-
// back reveal of the inn + title board); book inserts fill ~85-90% of
// frame width; dialogue face ~65-68%; final = keeper foreground +
// hook board together (board ~81% wide, held at full opacity to the
// literal last frame, keeper's mouth shut — narration + board only).
//
// ANIMATION UPGRADE v1+v2 (body.js v2 / toon armPose): EVERY actor gets
// lifeAt() breathing / weight-shift / head counter-tilt, an emoTrack()
// face that morphs at the beats, gaze that follows the named subject,
// distance-based stride phase on every walk (planted steps, no glide),
// and PHYSICAL GRIPS via gripTrack() -> armPose: the keeper's quill
// hand writes on the page (the quill is drawn from the same track), he
// holds the great book open with both hands to read, the rich guest's
// fingers wrap the purse he offers, the writer's hand lands on the
// chest as it opens, the keeper points up at the hook board at the end.
// The one performed line (S7, f789-870, 47-52% of the film — mid-story,
// END RULE satisfied) is lip-synced via speak.js; after it nobody speaks
// again and the final frames are narration + board only.
import { M, blinkAt, q, clamp, lerp, ramp } from './motion.js';
import { buildRig, keysCam } from './camrig.js';
import { lifeAt, emoTrack, gazeTrack, winkTrack, gripTrack, gestureAt, carryDip } from './body.js';
import * as SOL from './solid.js';
import * as T from './toon.js';
import * as SPK from './speak.js';
import { SPEAK_DATA } from './speakdata.js';

// ---------- v4 dialogue performance ----------
const SPEAK = SPK.makeSpeakPlayer(SPEAK_DATA);

export const FPS = 30, TOTAL = 1667, DECK = 0;
export const SHOTS = [
  { id: 'drone', a: 0, b: 133, light: 'warm' },
  { id: 'guests', a: 134, b: 267, light: 'warm' },
  { id: 'price', a: 268, b: 379, light: 'fire' },
  { id: 'pay', a: 380, b: 532, light: 'fire' },
  { id: 'write', a: 533, b: 661, light: 'fire' },
  { id: 'purse', a: 662, b: 788, light: 'warm' },
  { id: 'dialogue', a: 789, b: 888, light: 'fire' },
  { id: 'merchant', a: 889, b: 1024, light: 'fire' },
  { id: 'book', a: 1025, b: 1213, light: 'fire' },
  { id: 'writer', a: 1214, b: 1364, light: 'fire' },
  { id: 'chest', a: 1365, b: 1536, light: 'warm' },
  { id: 'hookq', a: 1537, b: 1610, light: 'dusk' },
  { id: 'hook', a: 1611, b: 1666, light: 'dusk' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights / mood grades ----------
export const LIGHTS = {
  warm: { az: 232, el: 27, sky: '#f0cf9e', ground: '#8a6f4a', hemi: 1.02, sun: '#ffd9a0', sunI: 2.45, fog: '#e8d3ac', fogNear: 46, fogFar: 330,
    skyTop: '#3a6ab0', skyHor: '#f2cd8e', sunDisc: '#fff0bc', sunSize: 0.0042, sat: 1.12, vig: 0.26, shadowExt: 22, aurora: 0, gain: '#ffe8c0',
    waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
  fire: { az: 250, el: 20, sky: '#e8b878', ground: '#7a5a3a', hemi: 1.12, sun: '#ff9a4a', sunI: 1.9, fog: '#d9a878', fogNear: 40, fogFar: 300,
    skyTop: '#4a3a6e', skyHor: '#f0a668', sunDisc: '#ffbe78', sunSize: 0.004, sat: 1.12, vig: 0.28, shadowExt: 22, aurora: 0, gain: '#f2d8b0',
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
  if (S.id === 'price') return blendLight(LIGHTS.warm, LIGHTS.fire, smooth(ramp(f, 268, 320)));
  if (S.id === 'purse') return blendLight(LIGHTS.fire, LIGHTS.warm, smooth(ramp(f, 662, 720)));
  if (S.id === 'chest') return blendLight(LIGHTS.fire, LIGHTS.warm, smooth(ramp(f, 1365, 1420)));
  if (S.id === 'hookq') return blendLight(LIGHTS.warm, LIGHTS.dusk, smooth(ramp(f, 1537, 1590)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging (shared by story, main, colliders) ----------
export const BOARD_POS = [0, 3.1, -6];
export const FIRE = { x: 0, z: 3.5 };
export const LECTERN = { x: -1.6, z: 2.2, top: 1.06, ry: 0.35 };
export const TABLE = { x: 6.5, z: 4.5, ry: -0.15 };
export const CHEST = { x: 2.2, z: 6.2, ry: -0.3 };
export const ROAD = { z: 11.5 };

const walkKeys = (keys, f) => {
  let x = keys[0][1], z = keys[0][2];
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i][0]) { const a = keys[i - 1], b = keys[i]; const u = smooth(ramp(f, a[0], b[0])); return [lerp(a[1], b[1], u), lerp(a[2], b[2], u)]; }
    x = keys[keys.length - 1][1]; z = keys[keys.length - 1][2];
  }
  return [x, z];
};
const KEEPER_KEYS = [
  [0, -1.6, 1.0], [1213, -1.6, 1.0], [1226, 0.8, 1.2], [1242, 2.6, 4.6], [1260, 1.2, 4.8], [1364, 1.2, 4.8],
  [1410, 1.0, 4.6], [1536, 1.0, 4.6], [1562, 0.8, 5.0], [1592, 0.65, 5.3], [1666, 0.65, 5.3],
];
const MERCHANT_KEYS = [
  [889, -9, 11.5], [950, -3.2, 5.0], [1213, -3.2, 5.0],
];
const SAILOR_KEYS = [
  [0, 3.4, 3.6], [1024, 3.4, 3.6], [1075, 2.4, 2.0], [1260, 2.4, 2.0], [1310, 3.4, 3.6], [1666, 3.4, 3.6],
];
const WRITER_KEYS = [
  [1214, 12, 11.5], [1280, 4.5, 7.5], [1364, 4.5, 7.5], [1410, 2.6, 7.6], [1666, 2.6, 7.6],
];
export const keeperAt = (f) => { const [x, z] = walkKeys(KEEPER_KEYS, f); return { x, z }; };
export const merchantAt = (f) => { const [x, z] = walkKeys(MERCHANT_KEYS, f); return { x, z }; };
export const sailorAt = (f) => { const [x, z] = walkKeys(SAILOR_KEYS, f); return { x, z }; };
export const writerAt = (f) => { const [x, z] = walkKeys(WRITER_KEYS, f); return { x, z }; };
// travelled-distance stride phase (real planted steps, no glide)
const distPhase = (raw) => {
  const D = [0];
  for (let f = 1; f < TOTAL; f++) { const a = raw(f - 1), b = raw(f); D[f] = D[f - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]); }
  return { phase: (f) => (D[clamp(f, 0, TOTAL - 1)] / 0.82) % 1, moving: (f) => f > 0 && (D[clamp(f, 0, TOTAL - 1)] - D[clamp(f - 1, 0, TOTAL - 1)]) > 0.004 };
};
const keeperMove = distPhase((f) => { const k = keeperAt(f); return [k.x, k.z]; });
const merchantMove = distPhase((f) => { const m = merchantAt(f); return [m.x, m.z]; });
const sailorMove = distPhase((f) => { const s = sailorAt(f); return [s.x, s.z]; });
const writerMove = distPhase((f) => { const w = writerAt(f); return [w.x, w.z]; });
// the book opens when the keeper reads the sailor's story back (L9)
export const bookOpenAt = (f) => {
  if (f < 1030) return 0;
  if (f <= 1060) return smooth(ramp(f, 1030, 1060));
  if (f <= 1180) return 1;
  if (f <= 1210) return 1 - smooth(ramp(f, 1180, 1210));
  return 0;
};
// the chest lid opens at the payoff (L11) and stays open
export const chestOpenAt = (f) => {
  if (f < 1400) return 0;
  if (f <= 1430) return smooth(ramp(f, 1400, 1430));
  return 1;
};
// the rich guest's purse: offered in L6, refused, pocketed. Staged at
// his left hand (v4 grip staging — his fingers wrap it, see castAt).
export const purseAt = (f) => {
  const k = f < 670 ? 0 : f <= 700 ? smooth(ramp(f, 670, 700)) : f <= 750 ? 1 : f <= 780 ? 1 - smooth(ramp(f, 750, 780)) : 0;
  return { k, x: 2.88, y: 0.92, z: 4.08 };
};

// ---------- hero / focus ----------
const FOCUS = {
  drone: () => [0, 1.2, 2],
  guests: () => [6.5, 0.9, 4.5],
  price: () => [-1.6, 1.3, 2.2],
  pay: () => [-2.6, 1.2, 2.6],
  write: () => [-1.6, 1.3, 2.2],
  purse: () => [2.9, 1.05, 4.08],
  dialogue: () => { const k = keeperAt(830); return [k.x, 1.45, k.z]; },
  merchant: () => { const m = merchantAt(960); return [m.x, 1.3, m.z]; },
  book: () => [-1.6, 1.2, 2.2],
  writer: () => { const w = writerAt(1300); return [w.x, 1.2, w.z]; },
  chest: () => [CHEST.x, 0.8, CHEST.z],
  hookq: () => BOARD_POS, hook: () => BOARD_POS,
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id]();

// ---------- v4 ACTION CAMERA: keysCam tracks on every shot ----------
const KC = (keys) => keysCam({ keys: keys.map(([f, pos, look, fov]) => ({ f, pos, look, fov, ease: 'io' })) });
const RIG_BY_ID = {
  // OPENING (R2): keeper BIG from frame 0 mid-greeting, snap push-in
  // f0-16, then a fast pull-back reveal of the inn + title board, and a
  // travelling wide to the clause end. Never static.
  drone: { cut: 'hard', raw: KC([
    [0, [0.0, 1.75, 4.5], [-1.6, 1.3, 1.0], 40],
    [16, [-0.15, 1.7, 4.05], [-1.6, 1.33, 1.0], 38],
    [54, [2.0, 2.9, 11.6], [-0.4, 2.35, -3.2], 42],
    [133, [2.8, 3.1, 12.6], [-0.3, 2.0, -1.6], 40],
  ]) },
  guests: { cut: 'hard', raw: KC([
    [134, [9.3, 1.95, 12.6], [6.4, 0.95, 4.9], 40],
    [200, [8.2, 1.75, 11.0], [6.5, 1.0, 4.7], 37],
    [267, [7.5, 1.65, 10.3], [6.6, 1.02, 4.6], 35],
  ]) },
  price: { cut: 'hard', raw: KC([
    [268, [1.9, 1.8, 7.4], [-1.45, 1.25, 2.1], 40],
    [290, [-0.2, 1.62, 4.9], [-1.6, 1.35, 2.0], 36],
    [379, [-0.5, 1.6, 4.7], [-1.62, 1.33, 2.05], 35],
  ]) },
  pay: { cut: 'hard', raw: KC([
    [380, [1.3, 1.85, 9.3], [-2.6, 1.2, 2.7], 40],
    [440, [0.2, 1.7, 7.9], [-2.7, 1.22, 2.6], 37],
    [532, [-0.9, 1.62, 7.0], [-2.65, 1.18, 2.9], 35],
  ]) },
  // the writing INSERT: the great book fills ~85-90% of the frame width
  write: { cut: 'hard', raw: KC([
    [533, [-0.9, 2.2, 6.4], [-1.6, 1.25, 2.0], 38],
    [558, [-1.6, 2.55, 5.3], [-1.6, 1.12, 2.2], 34],
    [661, [-1.6, 2.5, 5.15], [-1.6, 1.13, 2.2], 33],
  ]) },
  // push-in on the rich guest + purse, then a fast swing (f728-745) to
  // the keeper for the head-shake that refuses it
  purse: { cut: 'hard', raw: KC([
    [662, [3.2, 1.9, 11.2], [2.9, 1.1, 4.1], 40],
    [700, [4.9, 1.68, 8.9], [3.0, 1.08, 4.05], 37],
    [728, [4.75, 1.66, 8.7], [3.05, 1.08, 4.05], 37],
    [745, [0.9, 1.66, 5.6], [-1.6, 1.3, 1.05], 36],
    [788, [0.7, 1.64, 5.4], [-1.6, 1.3, 1.05], 35],
  ]) },
  // THE dialogue beat: camera holds on the keeper, face ~65-69%
  dialogue: { cut: 'hard', raw: KC([
    [789, [0.2, 1.64, 4.7], [-1.58, 1.4, 1.05], 32],
    [807, [-0.75, 1.56, 3.3], [-1.6, 1.44, 1.0], 29],
    [888, [-0.85, 1.55, 3.2], [-1.6, 1.44, 1.0], 29],
  ]) },
  // tracking at the merchant's own speed as he strides in from the road
  merchant: { cut: 'hard', raw: KC([
    [889, [-4.6, 1.9, 15.9], [-8.7, 1.25, 11.4], 42],
    [950, [-0.4, 1.75, 9.9], [-3.2, 1.28, 5.0], 38],
    [978, [-1.0, 1.66, 8.9], [-3.2, 1.3, 5.0], 36],
    [1024, [-1.3, 1.63, 8.6], [-3.2, 1.3, 5.0], 35],
  ]) },
  // book insert, then an authored fast swing (f1088-1100) onto the
  // sailor's SHOCK reaction face (~66%), hold, swing back to the keeper
  book: { cut: 'hard', raw: KC([
    [1025, [-1.0, 2.3, 5.6], [-1.6, 1.18, 2.2], 35],
    [1060, [-1.6, 2.5, 5.2], [-1.6, 1.13, 2.2], 34],
    [1088, [-1.6, 2.5, 5.2], [-1.6, 1.13, 2.2], 34],
    [1100, [3.0, 1.5, 4.3], [2.42, 1.32, 2.02], 34],
    [1150, [2.95, 1.48, 4.2], [2.42, 1.3, 2.02], 34],
    [1162, [1.4, 1.8, 6.4], [-1.2, 1.2, 2.2], 36],
    [1213, [1.1, 1.78, 6.1], [-1.3, 1.2, 2.2], 36],
  ]) },
  writer: { cut: 'hard', raw: KC([
    [1214, [8.6, 2.1, 16.2], [11.5, 1.2, 11.4], 42],
    [1280, [6.6, 1.85, 12.4], [4.5, 1.22, 7.5], 38],
    [1302, [5.9, 1.75, 11.5], [4.45, 1.25, 7.5], 36],
    [1364, [5.6, 1.7, 11.1], [4.4, 1.25, 7.5], 35],
  ]) },
  // payoff: fast push-in on the chest as the lid opens (kick f1430),
  // the chest fills ~85%+; slight pull-back to land both grinning faces
  chest: { cut: 'hard', raw: KC([
    [1365, [5.6, 1.95, 12.8], [1.9, 1.0, 6.1], 40],
    [1412, [4.35, 1.62, 10.7], [2.2, 0.85, 6.2], 36],
    [1536, [4.9, 1.8, 11.7], [2.0, 1.0, 6.2], 37],
  ]) },
  // FINAL (R2): keeper walks into the foreground and points up; the
  // hook board rises behind him — character + board TOGETHER
  hookq: { cut: 'blend', blend: 10, raw: KC([
    [1537, [2.6, 2.35, 13.6], [0.1, 2.75, -5.5], 41],
    [1610, [1.2, 2.05, 10.4], [0.05, 2.8, -5.7], 39],
  ]) },
  hook: { cut: 'hard', raw: KC([
    [1611, [1.15, 2.05, 10.3], [0.05, 2.8, -5.7], 39],
    [1666, [0.55, 1.9, 8.6], [0.02, 2.75, -5.9], 38],
  ]) },
};
const RIG = buildRig({
  total: TOTAL,
  // TIMING stays the single beat map; the RIG splits 'book' into three
  // entries only to DECLARE its two authored in-shot whip reframes
  // (f1100 onto the sailor, f1157 back to the keeper) — all three share
  // the same raw track, so the picture is identical (fireless pattern).
  shots: SHOTS.flatMap((s) => s.id === 'book' ? [
    { a: 1025, b: 1099, cut: 'hard', raw: RIG_BY_ID.book.raw },
    { a: 1100, b: 1156, cut: 'whip', blend: 6, raw: RIG_BY_ID.book.raw },
    { a: 1157, b: 1213, cut: 'whip', blend: 6, raw: RIG_BY_ID.book.raw },
  ] : [{ a: s.a, b: s.b, ...RIG_BY_ID[s.id] }]),
  kicks: [{ f: 1430, a: 0.04 }],
  sigma: 1.7, smoothRadius: 5, fovSigma: 1.1,
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
  if (['dialogue', 'write', 'book', 'chest'].includes(S.id)) cinf = 3.6;
  if (S.id === 'hook') cinf = 3.0;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f), ps = purseAt(f);
  const W = {
    boardTitle: 0, boardHook: 0,
    bookOpen: bookOpenAt(f), chestOpen: chestOpenAt(f),
    purseK: ps.k, purseX: ps.x, purseY: ps.y, purseZ: ps.z,
    dustK: 0.05,
  };
  if (S.id === 'drone') W.boardTitle = smooth(ramp(f, 40, 52)) * (1 - smooth(ramp(f, 60, 74)));
  if (S.id === 'hookq') W.boardHook = smooth(ramp(f, 1583, 1607));
  if (S.id === 'hook') W.boardHook = 1;   // held at FULL opacity to the literal last frame
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return { smokeRate: 0.05, dustRate: 0.05, splashRate: 0, steamRate: 0, shimmerRate: 0, emberRate: ['price', 'pay', 'write', 'dialogue', 'merchant', 'book', 'writer'].includes(S.id) ? 1 : 0.6, grey: 0 };
};
export const fxAt = () => [];

// ============================================================
// CAST + PERFORMANCE — the animation upgrade: every actor gets
// lifeAt() life, an emoTrack() face, gaze on the named subject,
// distance stride, and gripTrack() hands for every hold. Nobody is
// a statue in any frame. Skins are Salted Mine V3 WHITE (#fbf7ef)
// and cards take NO light tint, so faces stay bright and readable.
// ============================================================
export const OUTFITS = {
  keeper: { jacket: '#8a6a3a', pants: '#4a3a2c', boots: '#2a1c12', hat: 'cap', cap: '#c8a03a', skin: '#fbf7ef', moustache: '#3a2a1c' },
  soldier: { jacket: '#5a3a2e', pants: '#3a2a2a', boots: '#241a12', hat: 'shako', skin: '#fbf7ef' },
  widow: { jacket: '#4a3a5a', pants: '#3a2a4a', boots: '#241a12', hat: 'hair', hair: '#c8c8c8', skin: '#fbf7ef', dress: '#4a3a5a' },
  merchant: { jacket: '#6a2a4a', pants: '#2a2432', boots: '#1c1410', hat: 'cap', cap: '#2a1a3a', skin: '#fbf7ef', moustache: '#241a12' },
  sailor: { jacket: '#2c4a6e', pants: '#2a3242', boots: '#1c1712', hat: 'cap', cap: '#e8e0c8', skin: '#fbf7ef' },
  writer: { jacket: '#3a4a3a', pants: '#2c2c26', boots: '#1c1712', hat: 'cap', cap: '#3a2a1a', skin: '#fbf7ef' },
  guest1: { jacket: '#4a6a3a', pants: '#33302c', boots: '#241a12', hat: 'hair', hair: '#1c1410', skin: '#fbf7ef' },
  guest2: { jacket: '#2c4a6e', pants: '#2a3242', boots: '#1c1712', hat: 'hair', hair: '#5a3a1a', skin: '#fbf7ef' },
  rich: { jacket: '#7a5a1a', pants: '#3a2a1a', boots: '#1c1410', hat: 'cap', cap: '#e8c84a', skin: '#fbf7ef' },
};
// ---- expression morph tracks (the face matches the beat) ----
const keeperEmo = emoTrack([[0, 'smile'], [268, 'proud'], [533, 'smile'], [662, 'smile'], [692, 'stern'], [762, 'smile'], [789, 'proud'], [889, 'neutral'], [1025, 'proud'], [1214, 'smile'], [1365, 'grin'], [1537, 'smile']], 31);
const soldierEmo = emoTrack([[0, 'neutral'], [380, 'grin'], [470, 'determined'], [533, 'smile']], 41);
const widowEmo = emoTrack([[0, 'smile'], [400, 'smile'], [462, 'sad'], [524, 'smile']], 42);
const sailorEmo = emoTrack([[0, 'smile'], [889, 'neutral'], [1025, 'neutral'], [1088, 'shock'], [1170, 'relief'], [1214, 'smile'], [1365, 'grin']], 43);
const merchantEmo = emoTrack([[0, 'grin'], [1025, 'nervous'], [1214, 'grin']], 71);
const richEmo = emoTrack([[0, 'grin'], [745, 'nervous'], [789, 'neutral']], 61);
const writerEmo = emoTrack([[0, 'wonder'], [1300, 'smile'], [1365, 'grin'], [1537, 'smile']], 81);
const guestEmo = (seed) => emoTrack([[0, 'smile'], [150, seed === 52 ? 'laugh' : 'smile'], [240, 'smile'], [380, 'wonder'], [470, 'smile']], seed);
// ---- gaze tracks (eyes follow the named subject) ----
const keeperGaze = gazeTrack([{ f: 0, look: 0.2, lookY: 0.05 }, { f: 268, look: 0.3 }, { f: 533, look: 0.1, lookY: -0.35 }, { f: 662, look: 0.45 }, { f: 789, look: 0.35 }, { f: 1025, look: 0.1, lookY: -0.3 }, { f: 1214, look: 0.4 }, { f: 1365, look: 0.3, lookY: -0.2 }, { f: 1537, look: 0.1, lookY: 0.35 }]);
const sailorGaze = gazeTrack([{ f: 0, look: -0.3 }, { f: 1025, look: -0.35, lookY: -0.2 }, { f: 1090, look: -0.4, lookY: 0.1 }, { f: 1214, look: 0.2 }]);
const writerGaze = gazeTrack([{ f: 1214, look: -0.3 }, { f: 1365, look: -0.35, lookY: -0.25 }, { f: 1537, look: -0.2 }]);
// ---- GRIP TRACKS (card units; hang = L(190,730) R(410,730)) ----
const GT = (ks) => gripTrack(ks.map(([f, x, y, g]) => ({ f, x, y, grip: g })));
// the keeper's quill hand: lands on the page and SCRIBBLES (micro keys)
const quillR = GT([[533, 410, 730, 0], [546, 396, 478, 0.85], [560, 390, 470, 0.85], [575, 398, 476, 0.85], [590, 389, 469, 0.85], [605, 397, 475, 0.85], [620, 390, 471, 0.85], [640, 396, 477, 0.8], [655, 410, 730, 0]]);
// the rich guest's left hand wraps the purse while he offers it (L6)
const purseL = GT([[662, 190, 730, 0], [678, 172, 612, 0.85], [745, 172, 612, 0.85], [764, 190, 730, 0]]);
// the writer's right hand lands on the chest as the lid opens (L11)
const chestR = GT([[1365, 410, 730, 0], [1398, 398, 602, 0.6], [1432, 398, 602, 0.6], [1452, 410, 730, 0]]);
const keeperWink = winkTrack([{ a: 1458, b: 1480 }]);

const AP = (L, R) => {
  const o = {};
  if (L) o.L = { hand: [Math.round(L.x), Math.round(L.y)], grip: q(L.grip, 2), front: true };
  if (R) o.R = { hand: [Math.round(R.x), Math.round(R.y)], grip: q(R.grip, 2), front: true };
  return Object.keys(o).length ? o : undefined;
};
// redraw a gripping hand OVER its object (fingertips + palm dot)
const gripHand = (p, hx, hy, skin) => {
  p.ell(hx, hy, 9.5, 9.5, skin, 2.2);
  for (const [dx, dy] of [[-8, -5], [0, -8], [8, -5]]) p.ell(hx + dx, hy + dy, 4.2, 4.2, skin, 1.6);
};

export const castAt = (f) => {
  const S = shotAt(f), out = [];
  const add = (id, outfit, o, extra = {}) => out.push({
    id, x: o.x, y: o.y || 0, z: o.z, r: 0.32, ground: 0,
    actor: (TT) => ({
      key: id + JSON.stringify(outfit) + JSON.stringify(o.opts) + (extra.ov || ''),
      draw: (p) => { TT.bodyFront(p, outfit, o.opts); if (extra.drawOv) extra.drawOv(p); },
      x: o.x, y: o.y || 0, z: o.z, ground: 0, tint: '#ffffff', yaw: extra.yaw || 0, s: extra.s,
    }),
  });
  const base = (seed, lifeAmp = 1) => {
    const L = lifeAt(f, seed);
    return { seed, blink: blinkAt(f, seed), breath: L.breath, tilt: q(L.tilt * lifeAmp, 2), headTilt: q(L.headTilt, 2), squashL: L.squash };
  };
  const std = (B, exprP, G, extra = {}) => ({
    phase: extra.phase || 0, mode: extra.mode || 'stand', expr: extra.expr || 'smile', exprP, blink: B.blink, seed: B.seed,
    breath: B.breath, tilt: q(B.tilt + (extra.tiltAdd || 0), 2), headTilt: q(B.headTilt + (G ? G.tilt : 0) + (extra.headTiltAdd || 0), 2),
    look: q(G ? G.look : (extra.look || 0), 2), lookY: q(G ? G.lookY : (extra.lookY || 0), 2), facing: q(G ? G.facing : 0, 2),
    squash: q(Math.max(B.squashL, extra.dip || 0), 3), armPose: extra.armPose, clothShade: true,
  });
  const k = keeperAt(f), m = merchantAt(f), sl = sailorAt(f), w = writerAt(f);

  // ---------- KEEPER (appears in every shot but 'merchant'-only beats) ----------
  const keeper = (mode, hands = {}) => {
    const B = base(31), G = keeperGaze(f);
    let exprP = keeperEmo(f);
    let headTiltAdd = 0;
    if (S.id === 'dialogue') {
      const s = SPEAK.at(f);
      exprP = SPK.applySpeak({ ...exprP, cheek: 0.5 }, s);
      headTiltAdd = q(s.nod || 0, 2);
    }
    const wk = keeperWink(f);
    if (wk > 0) exprP = T.blendFaceP(exprP, T.faceP('wink'), wk);
    let hL = hands.L || null, hR = hands.R || null, drawOv = hands.drawOv || null, ov = hands.ov || '', dip = hands.dip || 0;
    if (S.id === 'dialogue' && !hL) { const g = gestureAt(f, 5, SPEAK.at(f).nod); hL = { x: 206 + g.dx, y: 600 + g.dy, grip: 0.15 }; }
    add('keeper', OUTFITS.keeper, {
      x: k.x, z: k.z, opts: std(B, exprP, G, {
        mode, phase: keeperMove.phase(f), expr: 'smile', headTiltAdd,
        armPose: AP(hL, hR), dip, tiltAdd: S.id === 'dialogue' ? gestureAt(f, 5, SPEAK.at(f).nod).sway : 0,
      }),
    }, { yaw: 0.5, ov, drawOv });
  };
  // ---------- SAILOR ----------
  const sailor = (mode) => {
    const B = base(43), G = sailorGaze(f);
    add('sailor', OUTFITS.sailor, {
      x: sl.x, z: sl.z, opts: std(B, sailorEmo(f), G, { mode, phase: sailorMove.phase(f), expr: 'smile' }),
    }, { yaw: -0.55 });
  };
  // ---------- WIDOW ----------
  const widow = () => {
    const B = base(42);
    add('widow', OUTFITS.widow, {
      x: -2.6, z: 3.5, opts: std(B, widowEmo(f), null, { mode: 'sit', expr: 'smile', look: 0.3 }),
    }, { yaw: 0.55 });
  };
  // ---------- SOLDIER ----------
  const soldier = (id, x, z, yaw) => {
    const B = base(41);
    add(id, OUTFITS.soldier, {
      x, z, opts: std(B, soldierEmo(f), null, { mode: 'stand', expr: 'neutral', look: -0.2 }),
    }, { yaw });
  };
  // ---------- GUESTS at the table ----------
  const guest = (id, outfit, seed, x, z, hands = {}) => {
    const B = base(seed);
    let hL = hands.L || null, hR = hands.R || null;
    add(id, outfit, {
      x, z, opts: std(B, guestEmo(seed)(f), null, { mode: 'sit', expr: 'smile', look: 0.15, armPose: AP(hL, hR) }),
    }, { yaw: 0 });
  };
  // ---------- RICH GUEST ----------
  const rich = () => {
    const B = base(61);
    const inPurse = S.id === 'purse';
    const hL = inPurse ? purseL(f) : null;
    add('rich', OUTFITS.rich, {
      x: 3.2, z: 4.2, opts: std(B, richEmo(f), null, {
        mode: 'stand', expr: 'grin', look: -0.3, armPose: AP(hL, null),
        dip: inPurse && hL && hL.grip > 0.3 ? carryDip(f, 0.25) : 0,
      }),
    }, { yaw: -0.5 });
  };
  // ---------- MERCHANT ----------
  const merchant = () => {
    const B = base(71);
    const moving = merchantMove.moving(f);
    let hR = null;
    if (S.id === 'merchant' && !moving) { const g = gestureAt(f, 7, 0.35); hR = { x: 428 + g.dx, y: 516 + g.dy, grip: 0.1 }; }
    add('merchant', OUTFITS.merchant, {
      x: m.x, z: m.z, opts: std(B, merchantEmo(f), null, {
        mode: moving ? 'march' : 'stand', phase: merchantMove.phase(f), expr: 'grin', look: -0.25, armPose: AP(null, hR),
      }),
    }, { yaw: -0.5 });
  };
  // ---------- WRITER ----------
  const writer = () => {
    const B = base(81), G = writerGaze(f);
    const moving = writerMove.moving(f);
    const hR = S.id === 'chest' ? chestR(f) : null;
    add('writer', OUTFITS.writer, {
      x: w.x, z: w.z, opts: std(B, writerEmo(f), G, {
        mode: moving ? 'march' : 'stand', phase: writerMove.phase(f), expr: 'smile', armPose: AP(null, hR),
        dip: S.id === 'chest' && hR && hR.grip > 0.3 ? carryDip(f, 0.3) : 0,
      }),
    }, { yaw: -0.5 });
  };

  switch (S.id) {
    case 'drone': {
      keeper(keeperMove.moving(f) ? 'march' : 'stand');
      soldier('soldier', -2.8, 1.6, -0.4);
      widow();
      sailor('sit');
      guest('guest1', OUTFITS.guest1, 51, 5.4, 5.7);
      guest('guest2', OUTFITS.guest2, 52, 7.6, 5.7);
      break;
    }
    case 'guests': {
      keeper('stand');
      guest('guest1', OUTFITS.guest1, 51, 5.4, 5.7, { R: { x: 392, y: 636, grip: 0.5 } });   // hand wraps his bowl
      guest('guest2', OUTFITS.guest2, 52, 7.6, 5.7);
      soldier('guest3', 8.8, 3.6, -0.55);
      break;
    }
    case 'price': {
      keeper('stand', { R: { x: 430, y: 520, grip: 0.1 } });   // open-palm gesture: "the price is a story"
      guest('guest1', OUTFITS.guest1, 51, 5.4, 5.7);
      guest('guest2', OUTFITS.guest2, 52, 7.6, 5.7);
      break;
    }
    case 'pay': {
      soldier('soldier', -2.8, 1.6, -0.4);
      widow();
      keeper('stand');
      break;
    }
    case 'write': {
      // quill grip: the hand + the quill move in the same frames
      const hR = quillR(f);
      keeper('stand', {
        L: { x: 218, y: 520, grip: 0.45 }, R: hR,
        ov: hR && hR.grip > 0.25 ? `quill${q(hR.x, 1)}:${q(hR.y, 1)}` : '',
        drawOv: hR && hR.grip > 0.25 ? (p) => {
          p.band([[hR.x - 5, hR.y + 15], [hR.x + 3, hR.y - 12]], '#e8e0c8', 3, 0);
          p.ell(hR.x + 9, hR.y - 20, 9, 15, '#f4f1e8', 0);
          gripHand(p, hR.x, hR.y, OUTFITS.keeper.skin);
        } : null,
      });
      sailor('sit');
      break;
    }
    case 'purse': {
      rich();
      keeper('stand');
      break;
    }
    case 'dialogue': {
      keeper('stand');
      rich();
      break;
    }
    case 'merchant': {
      merchant();
      keeper('stand');
      sailor('sit');
      break;
    }
    case 'book': {
      // both hands hold the great book open while he reads it back
      keeper('stand', { L: { x: 218, y: 505, grip: 0.7 }, R: { x: 382, y: 505, grip: 0.7 } });
      sailor(sailorMove.moving(f) ? 'march' : 'stand');
      merchant();
      break;
    }
    case 'writer': {
      writer();
      keeper(keeperMove.moving(f) ? 'march' : 'stand');
      sailor('sit');
      widow();
      break;
    }
    case 'chest': {
      writer();
      keeper('stand', { L: { x: 224, y: 610, grip: 0.5 } });   // keeper's hand rests on the chest edge
      break;
    }
    case 'hookq': case 'hook': {
      // END RULE: narration + board only — the keeper walks into the
      // foreground, stops, and POINTS up at the board; his mouth is shut.
      const moving = keeperMove.moving(f);
      keeper(moving ? 'march' : 'stand', !moving && f >= 1596 ? { R: { x: 448, y: 330, grip: 0.15 } } : {});
      break;
    }
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity: statics, dynamics, ground (LIBRARY v3 gate data) ----------
export const STATICS = [
  SOL.aabb(-15, 15, -15.5, -13.8, { h: 6.4, id: 'facade' }),
  SOL.aabb(-16.2, -14.8, -14, 10, { h: 2.4, id: 'wallW' }),
  SOL.aabb(14.8, 16.2, -14, 10, { h: 2.4, id: 'wallE' }),
  SOL.circle(FIRE.x, FIRE.z, 1.15, { h: 0.5, id: 'firering' }),
  SOL.obb(LECTERN.x, LECTERN.z, LECTERN.ry, 0.65, 0.5, { h: 1.1, id: 'lectern' }),
  SOL.obb(TABLE.x, TABLE.z, TABLE.ry, 1.85, 0.7, { h: 0.8, id: 'table' }),
  SOL.obb(CHEST.x, CHEST.z, CHEST.ry, 0.8, 0.5, { h: 0.7, id: 'chest' }),
  SOL.circle(BOARD_POS[0] - 2.1, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  SOL.circle(BOARD_POS[0] + 2.1, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  SOL.circle(-12.5, 9.5, 0.3, { h: 3.4, id: 'treeW' }),
  SOL.circle(12.5, 10, 0.3, { h: 3.4, id: 'treeE' }),
  SOL.circle(-4.2, 8.2, 0.09, { h: 2.6, id: 'lanternW' }),
  SOL.circle(4.2, 8.2, 0.09, { h: 2.6, id: 'lanternE' }),
  SOL.circle(-9, 10.6, 0.09, { h: 3.0, id: 'signpost' }),
];
export const WORLD = SOL.makeWorld(STATICS);
export const dynamicsAt = (f) => {
  const out = [];
  for (const a of castAt(f)) out.push(SOL.circle(a.x, a.z, a.r, { kind: 'dynamic', id: a.id }));
  return out;
};
export const groundItemsAt = (f) => {
  const items = [];
  for (const a of castAt(f)) items.push({ id: a.id, y: a.y, ground: 0, maxHover: 0.06 });
  return items;
};
