// Shot plan for "कभी खाली न होने वाली मिठाई की थाली" — sweets-hindi
// v4 UPGRADE (2026-11-19): picture rebuilt to Abid's v4 ACTION CAMERA
// (punch-in key sets, tracking at subject speed, impact kicks, one
// whip into the performed line) + kit body.js v2 animation (lifeAt
// continuous life, gripAt tray lift, gestureAt dialogue gesture,
// stridePh planted feet). Stem/script/beat map/boards/mix untouched.
// R2 REBUILD (Salted Mine V3 / moonrent-R2 standard, approved by Abid):
// painted 3D world, white-head card cast, word-by-word captions,
// hard-cut clause shots with travelling cameras, body actions, ONE
// performed dialogue line with speak.js lip-sync. R2 grammar:
//   OPENING  hero BIG from f0 (head ~40%+ of frame width), low angle,
//            mid-action, push-in — the halwai presenting his thali.
//   INSERT   the hole + channel trough under the counter fills the
//            frame (camera travels through the partition opening into
//            the counter cavity); NO character, NO partial faces.
//   ACTION   the wife's hand pushing a fresh laddu UP the trough and
//            through the hole — tight front three-quarter inside the
//            cavity, hand + laddu fill the centre; payoff = the pop
//            onto the mound in a tight tray-top close-up.
//   REACTION the customer's amazed face (gossip) pushes past 65% of
//            frame width (pushInCam, moonrent 'fear' grammar).
//   DIALOGUE performed close on the halwai, lip-sync, camera holds.
//   FINAL    character beat + hook board TOGETHER: the halwai kneels
//            in the foreground pointing up at the board; the board
//            sits fully inside the frame, text verbatim, full opacity
//            through the literal final frame.
// Voice stem: Puck (AI Studio), 59.691 s, 30 fps, TOTAL 1791; line
// timings from timing.json (char-mapped faster-whisper anchors).
// Scene changes ONLY at line/clause boundaries:
//   L1 0-116 tray sells all day, never empties   L9 949-1053 the hole
//   L2 128-205 morning: 100 laddus loaded        L10 1066-1156 wife rolls
//   L3 217-326 200+ sold by noon, tray full      L11 1165-1294 the refill
//   L4 326-444 "a god-given tray"                L12 1300-1407 tray lifted
//   L5 454-565 full price, Annapurna line        L13 1418-1549 crowd laughs
//   L6 579-686 neighbour tallies every sale      L14 1558-1599 the smile
//   L7 686-826 400 sold vs 100 loaded            L15 1599-1697 DIALOGUE
//   L8 841-938 sneak + peek through the crack    L16 1708-1788 hook board
// GRADE: Golden Hour in the shop, Memory Warm in the back room, warm
// dusk for the hook board. Boards/text are never graded.
import { M, blinkAt, q, clamp, lerp, ramp, kf } from './motion.js';
import { buildRig, keysCam, pushInCam } from './camrig.js';
import { poseWindows, turnTrack, winkTrack, lifeAt, gripAt, gestureAt, stridePh } from './body.js';
import { makeSpeakPlayer, applySpeak } from './speak.js';
import { SPEAK_DATA } from './speakdata.js';
import * as SOL from './solid.js';
import * as T from './toon.js';

export const FPS = 30, TOTAL = 1791, DECK = 0;
export const SHOTS = [
  { id: 'open', a: 0, b: 127, light: 'shop' },
  { id: 'morning', a: 128, b: 216, light: 'shop' },
  { id: 'crowd', a: 217, b: 325, light: 'shop' },
  { id: 'gossip', a: 326, b: 453, light: 'shop' },
  { id: 'smug', a: 454, b: 578, light: 'shop' },
  { id: 'tally', a: 579, b: 685, light: 'shop' },
  { id: 'count', a: 686, b: 840, light: 'shop' },
  { id: 'sneak', a: 841, b: 894, light: 'street' },
  { id: 'peek', a: 895, b: 948, light: 'street' },
  { id: 'seeback', a: 949, b: 1053, light: 'back' },
  { id: 'wife', a: 1054, b: 1164, light: 'back' },
  { id: 'refillA', a: 1165, b: 1229, light: 'back' },
  { id: 'refillB', a: 1230, b: 1269, light: 'back' },
  { id: 'refillC', a: 1270, b: 1299, light: 'shop' },
  { id: 'revealA', a: 1300, b: 1383, light: 'shop' },
  { id: 'revealB', a: 1384, b: 1417, light: 'shop' },
  { id: 'laugh', a: 1418, b: 1557, light: 'shop' },
  { id: 'leadin', a: 1558, b: 1598, light: 'shop' },
  { id: 'dialogue', a: 1599, b: 1707, light: 'shop' },
  { id: 'hook', a: 1708, b: 1790, light: 'dusk' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
const SPEAK = makeSpeakPlayer(SPEAK_DATA);

// ---------- lights / mood grades ----------
export const LIGHTS = {
  shop: { az: 215, el: 36, sky: '#96754e', ground: '#40301c', hemi: 1.0, sun: '#ffb45e', sunI: 1.32, fog: '#54381c', fogNear: 10, fogFar: 70,
    skyTop: '#2e2010', skyHor: '#6b4423', sunDisc: '#000000', sunSize: 0, sat: 1.07, vig: 0.24, shadowExt: 16, aurora: 0, gain: '#f7e3c0',
    waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
  street: { az: 232, el: 30, sky: '#f6dcae', ground: '#8a6f4a', hemi: 1.02, sun: '#ffd9a0', sunI: 2.4, fog: '#e8d3ac', fogNear: 40, fogFar: 300,
    skyTop: '#3a6ab0', skyHor: '#f2cd8e', sunDisc: '#fff0bc', sunSize: 0.0042, sat: 1.09, vig: 0.26, shadowExt: 22, aurora: 0, gain: '#ffedc8',
    waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
  back: { az: 205, el: 34, sky: '#6e4c2c', ground: '#2a1c10', hemi: 0.88, sun: '#ff9e4e', sunI: 1.05, fog: '#2e1c0a', fogNear: 5, fogFar: 42,
    skyTop: '#1c1208', skyHor: '#463014', sunDisc: '#000000', sunSize: 0, sat: 1.08, vig: 0.3, shadowExt: 14, aurora: 0, gain: '#f2d8ac',
    waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
  dusk: { az: 250, el: 13, sky: '#c99a72', ground: '#5c4632', hemi: 0.94, sun: '#ffab5e', sunI: 2.0, fog: '#d9b28c', fogNear: 42, fogFar: 300,
    skyTop: '#2e3c6e', skyHor: '#f0a668', sunDisc: '#ffbe78', sunSize: 0.0044, sat: 1.06, vig: 0.3, shadowExt: 22, aurora: 0, gain: '#f2ddba',
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
  if (S.id === 'hook') return blendLight(LIGHTS.street, LIGHTS.dusk, smooth(ramp(f, 1708, 1760)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging ----------
export const SIGN_POS = [0, 4.62, 6.48];
export const HOOK_POS = [0, 1.78, 10.8];
export const BOARD_POS = HOOK_POS;
// the tray lift (L12): rises on "थाली उठाकर" (f~1332), held for the
// hole reveal, set back down as the crowd laughs (L13).
export const trayAt = (f) => smooth(ramp(f, 1332, 1364)) * (1 - smooth(ramp(f, 1440, 1474)));
// the wife's hand in the hidden channel (L11): enters as she turns
// (refillA), travels up the trough, pushes the laddu through the hole
// (f~1262), retracts while the camera sits on the tray top (refillC).
export const handAt = (f) => {
  if (f < 1198) return -1;
  if (f < 1230) return smooth(ramp(f, 1198, 1230)) * 0.45;
  if (f < 1264) return 0.45 + smooth(ramp(f, 1230, 1264)) * 0.55;
  if (f < 1272) return 1;
  if (f < 1296) return 1 - smooth(ramp(f, 1272, 1296));
  return -1;
};
export const popAt = (f) => (f < 1262 ? 0 : smooth(ramp(f, 1262, 1274)));
// actor anchors (single source; r=0.30 dynamics in castAt)
export const halwaiAt = (f) => {
  const S = shotAt(f);
  if (S.id === 'leadin') return { x: 0.72, z: 0.5 };
  if (S.id === 'dialogue') return { x: 0.66, z: 0.48 };
  if (S.id === 'hook') return { x: -0.9, z: 19.8 };
  return { x: 0.85, z: 0.46 };
};
export const neighAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'tally': case 'count': return { x: 3.35, z: 3.95 };
    case 'sneak': { const u = smooth(ramp(f, 845, 890)); return { x: lerp(4.3, 1.85, u), z: lerp(-8.3, -7.32, u) }; }
    case 'peek': return { x: 1.8, z: -7.32 };
    case 'revealA': { const u = smooth(ramp(f, 1306, 1332)); return { x: lerp(2.3, 1.15, u), z: lerp(3.7, 2.62, u) }; }
    case 'revealB': return { x: 1.15, z: 2.62 };
    case 'laugh': case 'leadin': case 'dialogue': return { x: 1.55, z: 2.85 };
    case 'hook': return { x: 3.2, z: 9.5 };
    default: return { x: 3.6, z: 4.15 };
  }
};
export const wifeAt = () => ({ x: 0.55, z: -1.5 });
export const custAAt = (f) => (shotAt(f).id === 'revealA' ? { x: -0.7, z: 3.0 } : { x: -0.5, z: 2.9 });
export const custBAt = (f) => {
  const S = shotAt(f);
  if (S.id === 'gossip') return { x: 0.15, z: 3.05 };
  if (S.id === 'revealA') return { x: -1.95, z: 3.25 };
  if (S.id === 'laugh') return { x: 0.35, z: 3.35 };
  return { x: 0.75, z: 3.05 };
};
export const custCAt = () => ({ x: -1.35, z: 3.3 });

// ---------- hero / focus ----------
const FOCUS = {
  open: () => [0.62, 1.58, 0.75],
  morning: () => [0.32, 1.34, 1.4],
  crowd: () => [0.15, 1.25, 1.6],
  gossip: () => [-0.5, 1.6, 2.9],
  smug: () => [0.78, 1.49, 0.5],
  tally: () => [3.24, 1.05, 3.7],
  count: () => [3.34, 1.28, 3.9],
  sneak: () => [3.0, 1.2, -7.8],
  peek: () => [1.3, 1.47, -6.85],
  seeback: () => [0.25, 0.7, 0.8],
  wife: () => [0.62, 1.0, -1.8],
  refillA: () => [0.53, 0.95, -1.6],
  refillB: () => [0.25, 0.92, 1.2],
  refillC: () => [0.25, 1.42, 1.5],
  revealA: () => [0.55, 1.3, 1.95],
  revealB: () => [0.25, 1.18, 1.5],
  laugh: () => [0.0, 1.35, 2.9],
  leadin: () => [0.73, 1.47, 0.52],
  dialogue: () => [0.66, 1.48, 0.5],
  hook: () => [0, 1.78, 10.8],
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id]();

// ---------- cameras: v4 ACTION CAMERA (Abid's standard, upgrade
// 2026-11-19) — a hard CUT per clause (ONE whip into the performed
// line), and inside every shot the fireless/waterrun punch grammar:
// the camera enters WIDE and PUNCHES IN fast — subject scale grows
// ~x1.5-2 inside the first 14-16 frames ('surge' landing key) — then
// keeps tracking/settling at subject speed to the end key. No slow
// drift, no static holds, camera velocity keyed to the subject.
// Impact KICKS land on the story's physical beats: the count shock
// (f748), the laddu pop (f1262), the tray reaching full lift (f1364),
// the crowd's laugh burst (f1418). Sizes keep the R2 coverage rules:
// hero BIG on the opening, inserts fill the frame, action at subject
// level from the FRONT three-quarter (never behind the cards),
// reactions punch past 65% of frame width.
const RIG_BY_ID = {
  // open: LOW angle from the plaza, the halwai BIG behind his counter
  // from frame 0 (head ~40% of frame width), punching to ~53% by f15
  // as he presents the overflowing thali, then a slow tighten.
  open: { cut: 'hard', raw: keysCam({ keys: [
    { f: 0, pos: [1.66, 1.3, 4.35], look: [0.62, 1.5, 1.1], fov: 38 },
    { f: 15, pos: [1.5, 1.36, 3.62], look: [0.62, 1.52, 1.08], fov: 35, ease: 'surge' },
    { f: 70, pos: [1.46, 1.38, 3.58], look: [0.62, 1.52, 1.08], fov: 34.8, ease: 'smooth' },
    { f: 127, pos: [1.44, 1.38, 3.52], look: [0.62, 1.53, 1.08], fov: 34.5, ease: 'surge' }] }) },
  // morning: tight on the tray as he loads the hundred laddus — the
  // mound fills the frame, the halwai working behind it.
  morning: { cut: 'hard', raw: keysCam({ keys: [
    { f: 128, pos: [1.56, 1.74, 4.5], look: [0.6, 1.4, 1.0], fov: 37 },
    { f: 143, pos: [1.42, 1.67, 4.12], look: [0.6, 1.43, 1.0], fov: 34.5, ease: 'surge' },
    { f: 216, pos: [1.36, 1.65, 3.98], look: [0.6, 1.44, 1.0], fov: 33.5, ease: 'surge' }] }) },
  // crowd: the noon rush — counter, tray and three customers; the
  // punch lands by f232, then the push keeps pace with the rush.
  crowd: { cut: 'hard', raw: keysCam({ keys: [
    { f: 217, pos: [-2.7, 2.58, 7.95], look: [0.22, 1.12, 1.6], fov: 46 },
    { f: 232, pos: [-2.38, 2.44, 7.3], look: [0.23, 1.15, 1.61], fov: 43, ease: 'surge' },
    { f: 325, pos: [-2.24, 2.4, 7.05], look: [0.24, 1.16, 1.62], fov: 41.5, ease: 'surge' }] }) },
  // gossip: THE REACTION — a fast PUNCH onto the amazed customer's
  // face: ~48% of frame width at the cut, ~70% by f341, settling ~73%.
  gossip: { cut: 'hard', raw: keysCam({ keys: [
    { f: 326, pos: [0.99, 1.66, 6.13], look: [-0.5, 1.61, 2.9], fov: 36 },
    { f: 341, pos: [0.59, 1.6, 5.27], look: [-0.5, 1.61, 2.9], fov: 32.5, ease: 'surge' },
    { f: 453, pos: [0.51, 1.59, 5.1], look: [-0.5, 1.61, 2.9], fov: 31.5, ease: 'surge' }] }) },
  // smug: the halwai's close — full price, no shame; the punch takes
  // his face from ~55% to ~70% inside 15 frames.
  smug: { cut: 'hard', raw: keysCam({ keys: [
    { f: 454, pos: [1.92, 1.66, 3.32], look: [0.76, 1.47, 0.52], fov: 35 },
    { f: 469, pos: [1.74, 1.61, 3.0], look: [0.75, 1.48, 0.52], fov: 32.5, ease: 'surge' },
    { f: 578, pos: [1.68, 1.59, 2.9], look: [0.75, 1.48, 0.52], fov: 31.5, ease: 'surge' }] }) },
  // tally: the neighbour and his slate — punch in by f594, the chalk
  // groups accumulating in the lower frame as he watches the counter.
  tally: { cut: 'hard', raw: keysCam({ keys: [
    { f: 579, pos: [1.48, 1.55, 6.65], look: [3.22, 1.0, 3.65], fov: 40 },
    { f: 594, pos: [1.64, 1.49, 6.28], look: [3.23, 1.03, 3.63], fov: 36.5, ease: 'surge' },
    { f: 685, pos: [1.72, 1.47, 6.14], look: [3.24, 1.04, 3.62], fov: 35.5, ease: 'surge' }] }) },
  // count: the evening sum — punch onto his face by f701, a second
  // tighten as the shock lands (KICK f748: 400 sold against 100).
  count: { cut: 'hard', raw: keysCam({ keys: [
    { f: 686, pos: [1.88, 1.55, 6.3], look: [3.33, 1.2, 3.88], fov: 38 },
    { f: 701, pos: [2.04, 1.51, 5.98], look: [3.34, 1.25, 3.9], fov: 34.5, ease: 'surge' },
    { f: 748, pos: [2.08, 1.5, 5.9], look: [3.34, 1.26, 3.9], fov: 33.5, ease: 'surge' },
    { f: 840, pos: [2.12, 1.5, 5.84], look: [3.34, 1.26, 3.9], fov: 33, ease: 'surge' }] }) },
  // sneak: TRACKING the neighbour around the back of the shop at HIS
  // speed — the camera keys ride his walk (f845-890), never ahead of
  // him, never behind his pace.
  sneak: { cut: 'hard', raw: keysCam({ keys: [
    { f: 841, pos: [3.6, 2.05, -12.5], look: [4.25, 1.2, -8.35], fov: 40 },
    { f: 862, pos: [3.05, 1.95, -11.9], look: [3.0, 1.24, -7.8], fov: 37.5, ease: 'smooth' },
    { f: 878, pos: [2.8, 1.9, -11.55], look: [2.1, 1.26, -7.45], fov: 36, ease: 'surge' },
    { f: 894, pos: [2.72, 1.88, -11.4], look: [1.95, 1.27, -7.4], fov: 35.5, ease: 'surge' }] }) },
  // peek: over his shoulder at the crack's glow — a fast settle onto
  // the lit slit by f910, his head large at the side of frame.
  peek: { cut: 'hard', raw: keysCam({ keys: [
    { f: 895, pos: [1.1, 1.73, -11.15], look: [1.5, 1.45, -6.9], fov: 41 },
    { f: 910, pos: [1.2, 1.68, -10.62], look: [1.5, 1.46, -6.9], fov: 38.5, ease: 'surge' },
    { f: 948, pos: [1.24, 1.66, -10.45], look: [1.5, 1.46, -6.9], fov: 37.5, ease: 'surge' }] }) },
  // seeback: THE INSERT — a pure object shot (no cast). The camera
  // DOLLIES FAST through the dark back room toward the partition's
  // lit hatch: through it, the diagonal trough runs up to the dark
  // hole under the tray — the secret channel framed by the opening.
  seeback: { cut: 'hard', raw: keysCam({ keys: [
    { f: 949, pos: [0.25, 0.42, -3.55], look: [0.25, 0.6, 1.05], fov: 37 },
    { f: 965, pos: [0.25, 0.5, -2.2], look: [0.25, 0.64, 1.2], fov: 34.5, ease: 'surge' },
    { f: 1053, pos: [0.25, 0.58, -1.15], look: [0.25, 0.68, 1.3], fov: 32.5, ease: 'surge' }] }) },
  // wife: the back-room reveal — she rolls laddus at her low table,
  // front three-quarter; the punch lands her face large by f1069.
  wife: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1054, pos: [2.14, 1.36, -4.45], look: [0.7, 0.95, -2.05], fov: 35 },
    { f: 1069, pos: [1.94, 1.29, -4.0], look: [0.69, 0.99, -2.02], fov: 32.5, ease: 'surge' },
    { f: 1164, pos: [1.87, 1.27, -3.9], look: [0.68, 1.0, -2.0], fov: 31.5, ease: 'surge' }] }) },
  // refillA: she turns toward the channel opening and reaches — the
  // punch follows her turn, close on the wife as the secret moves.
  refillA: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1165, pos: [2.02, 1.31, -4.28], look: [0.52, 0.92, -1.62], fov: 35 },
    { f: 1180, pos: [1.86, 1.25, -3.92], look: [0.51, 0.94, -1.61], fov: 32.5, ease: 'surge' },
    { f: 1229, pos: [1.8, 1.23, -3.8], look: [0.5, 0.95, -1.6], fov: 31.5, ease: 'surge' }] }) },
  // refillB: THE ACTION BEAT — inside the counter cavity, front
  // three-quarter on the hidden channel: her hand rides the trough
  // UP and pushes the fresh laddu through the hole; the camera
  // pushes WITH the hand, rising as it rises (KICK at the pop f1262
  // lands in the next shot's first frames).
  refillB: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1230, pos: [-1.12, 0.62, 1.3], look: [0.25, 0.72, 1.02], fov: 36 },
    { f: 1246, pos: [-1.0, 0.72, 1.38], look: [0.25, 0.84, 1.16], fov: 33.5, ease: 'surge' },
    { f: 1269, pos: [-0.93, 0.8, 1.44], look: [0.25, 0.94, 1.27], fov: 31.5, ease: 'surge' }] }) },
  // refillC: the payoff on top — tight on the mound as the fresh
  // laddu pops on with its glint; a fast settle onto the mound.
  refillC: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1270, pos: [1.36, 2.04, 3.18], look: [0.25, 1.33, 1.5], fov: 33 },
    { f: 1282, pos: [1.2, 1.96, 2.88], look: [0.25, 1.35, 1.5], fov: 30.5, ease: 'surge' },
    { f: 1299, pos: [1.14, 1.93, 2.78], look: [0.25, 1.36, 1.5], fov: 29.5, ease: 'surge' }] }) },
  // revealA: the neighbour strides in and LIFTS the tray — the punch
  // lands as he reaches the counter, a second tighten rides the lift
  // itself, and the KICK lands at full lift (f1364).
  revealA: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1300, pos: [-0.05, 2.04, 7.25], look: [0.62, 1.18, 2.0], fov: 46 },
    { f: 1315, pos: [0.14, 1.95, 6.7], look: [0.65, 1.21, 1.99], fov: 43, ease: 'surge' },
    { f: 1364, pos: [0.2, 1.93, 6.58], look: [0.67, 1.22, 1.98], fov: 42, ease: 'surge' },
    { f: 1383, pos: [0.23, 1.92, 6.5], look: [0.68, 1.22, 1.98], fov: 41.5, ease: 'surge' }] }) },
  // revealB: the hole, exposed — high front close on the counter
  // top: the tilted tray held above, the dark hole open beneath it;
  // a fast punch onto the hole, which owns the shot.
  revealB: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1384, pos: [0.56, 2.1, 4.82], look: [0.12, 0.99, 1.55], fov: 35 },
    { f: 1396, pos: [0.46, 2.0, 4.42], look: [0.11, 1.01, 1.55], fov: 32.5, ease: 'surge' },
    { f: 1417, pos: [0.43, 1.97, 4.3], look: [0.11, 1.02, 1.55], fov: 31.5, ease: 'surge' }] }) },
  // laugh: the crowd lets go (KICK f1418 on the burst) — a fast
  // punch into the laughing group, then the push rides the laugh.
  laugh: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1418, pos: [-2.66, 2.06, 7.6], look: [0.45, 1.23, 2.7], fov: 44 },
    { f: 1433, pos: [-2.38, 1.97, 7.02], look: [0.46, 1.27, 2.69], fov: 41, ease: 'surge' },
    { f: 1557, pos: [-2.26, 1.93, 6.82], look: [0.47, 1.28, 2.68], fov: 39.5, ease: 'surge' }] }) },
  // leadin: "तब हलवाई ने मुस्कुराकर कहा।" — his smile punched close.
  leadin: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1558, pos: [0.92, 1.64, 3.78], look: [0.72, 1.46, 0.5], fov: 34 },
    { f: 1572, pos: [0.85, 1.6, 3.46], look: [0.72, 1.47, 0.5], fov: 31.5, ease: 'surge' },
    { f: 1598, pos: [0.84, 1.6, 3.4], look: [0.72, 1.47, 0.5], fov: 31, ease: 'surge' }] }) },
  // dialogue: THE performed line — entered on a 6-frame WHIP from
  // the lead-in's angle, then a fast settle onto the speaker and a
  // held close while he says it himself (speak.js lip-sync); the
  // camera never leaves him.
  dialogue: { cut: 'whip', blend: 6, raw: keysCam({ keys: [
    { f: 1599, pos: [1.7, 1.61, 3.2], look: [0.66, 1.47, 0.5], fov: 31.5 },
    { f: 1613, pos: [1.64, 1.58, 2.96], look: [0.66, 1.48, 0.5], fov: 30, ease: 'surge' },
    { f: 1707, pos: [1.6, 1.57, 2.86], look: [0.66, 1.48, 0.5], fov: 29, ease: 'surge' }] }) },
  // hook: character beat + board TOGETHER — the halwai kneels in the
  // FOREGROUND (z 19.8, head ~21-26% of frame width) at the board's
  // lower-left, pointing up at the question; the camera enters a
  // touch wide and punches to the proven R2 end framing by f1723 —
  // the board sits fully inside the frame (~74% -> ~84% width) with
  // margins on both sides at every frame, dusk behind.
  hook: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1708, pos: [0, 2.12, 28.3], look: [-0.05, 1.6, 10.8], fov: 36.5 },
    { f: 1723, pos: [0, 2.02, 27.05], look: [-0.05, 1.61, 10.8], fov: 35.2, ease: 'surge' },
    { f: 1790, pos: [0, 2.0, 26.9], look: [-0.05, 1.6, 10.8], fov: 35, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: 748, a: 0.1 }, { f: 1262, a: 0.14 }, { f: 1364, a: 0.16 }, { f: 1418, a: 0.08 }],
  sigma: 2.3, fovSigma: 1.6,
});
export const camAt = (f) => ({ ...RIG.camAt(f), flash: 0 });
export const RIG_META = {
  kicks: RIG.declared.kicks, hardCuts: RIG.declared.hardCuts,
  blends: SHOTS.filter((s) => RIG_BY_ID[s.id].cut === 'blend' || RIG_BY_ID[s.id].cut === 'whip')
    .map((s) => ({ a: s.a - Math.floor((RIG_BY_ID[s.id].blend || 0) / 2), b: s.a + Math.ceil((RIG_BY_ID[s.id].blend || 0) / 2) })),
  whips: RIG.declared.whips, samples: RIG.samples,
};
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), hp = heroPosAt(f);
  let cinf = 2.4;
  if (['crowd', 'revealA', 'hook', 'sneak'].includes(S.id)) cinf = 1.4;
  if (['gossip', 'smug', 'count', 'wife', 'refillA', 'dialogue', 'leadin'].includes(S.id)) cinf = 3.6;
  if (['morning', 'tally', 'peek', 'laugh', 'open'].includes(S.id)) cinf = 3.0;
  if (['seeback', 'refillB', 'refillC', 'revealB'].includes(S.id)) cinf = 2.2;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const ht = handAt(f);
  return {
    always: 1,
    signK: S.id === 'hook' ? 1 : 0,
    hookK: S.id === 'hook' ? smooth(ramp(f, 1708, 1720)) : 0,
    lampK: S.light === 'street' ? 0.4 : 1,
    trayK: trayAt(f),
    trayTilt: 0.1,
    handT: ht,
    handLaddu: ht >= 0 && ht < 0.985 ? 1 : 0,
    popK: popAt(f),
    slateK: S.id === 'tally' || S.id === 'count' ? 1 : 0,
    tallyK: S.id === 'tally' ? 0.55 * smooth(ramp(f, 600, 685))
      : S.id === 'count' ? 0.55 + 0.45 * smooth(ramp(f, 686, 726)) : 0,
    curtainK: 0,
  };
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  const steam = ['open', 'crowd', 'gossip', 'smug', 'revealA', 'revealB', 'laugh'].includes(S.id) ? 0.55 : 0;
  return { moteRate: S.light === 'street' ? 0.02 : 0.15, steamRate: steam, blastRate: 0, sparkRate: 0 };
};
export const fxAt = () => [];

// ---------- cast ----------
const TINT = { shop: '#ffffff', street: '#ffffff', back: '#ffffff', dusk: '#ffffff' };
const tintFor = (S) => TINT[S.light] || '#ffffff';
export const OUTFITS = {
  halwai: { jacket: '#e8b64c', pants: '#f0e6d2', boots: '#4a2c14', hat: 'turban', turban: '#f6a83c', moustache: '#2a201a', build: 'stout', skin: '#fbf7ef' },
  neighbour: { jacket: '#7a4a8c', pants: '#3a3a42', boots: '#241a12', hat: 'turban', turban: '#e8e0cc', moustache: '#2a201a', skin: '#fbf7ef' },
  wife: { jacket: '#c2456e', dress: '#c2456e', pants: '#8c2f4e', boots: '#3a2418', hat: 'hair', hair: '#241a14', skin: '#fbf7ef' },
  custA: { jacket: '#3f6a8f', pants: '#33302c', boots: '#241a12', hat: 'cap', cap: '#c23b2a', skin: '#fbf7ef' },
  custB: { jacket: '#5d8a3a', pants: '#3a3230', boots: '#241a12', hat: 'hair', hair: '#2b211c', skin: '#fbf7ef' },
  custC: { jacket: '#b8641f', pants: '#33302c', boots: '#241a12', hat: 'cap', cap: '#2a5a8c', skin: '#fbf7ef' },
};
// expression timelines (pure folder, same pattern as the reference build)
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
const emoHalwai = emoTrack('smile', [
  [454, 'smug', 8], [579, 'smile', 8], [1300, 'smile', 6], [1332, 'nervous', 7],
  [1418, 'relief', 9], [1470, 'smile', 8], [1558, 'smug', 8], [1708, 'grin', 8],
]);
const emoNeigh = emoTrack('thinking', [
  [686, 'determined', 7], [742, 'shock', 6], [841, 'determined', 7], [949, 'wonder', 8],
  [1300, 'determined', 7], [1364, 'proud', 8], [1418, 'laugh', 8], [1558, 'smile', 8], [1708, 'grin', 8],
]);
const emoWife = emoTrack('smile', [[1165, 'grin', 8], [1270, 'smile', 8]]);
const emoCustA = emoTrack('grin', [[326, 'wonder', 8], [454, 'smile', 8], [1300, 'shock', 6], [1418, 'laugh', 8]]);
const emoCustB = emoTrack('smile', [[326, 'wonder', 8], [1300, 'shock', 6], [1418, 'laugh', 8], [1558, 'smile', 8]]);
// body actions: the neighbour's tray-lift lean is a pose window of
// effort (squash), the wife turns toward the channel opening for the
// refill, the halwai winks as he delivers the trick's logic.
const wifeTurn = turnTrack([{ f0: 1172, dur: 14, dir: 1 }]);
const halwaiWink = winkTrack([{ a: 1652, b: 1662 }]);
// ANIMATION UPGRADE (kit body.js v2, 2026-11-18 order): continuous
// life for every figure — lifeAt's slow weight-shift tilt is folded
// into EVERY head() call below (keyed by the actor's seed), and its
// breath phase offsets each actor's breathing inside std(). Nobody
// stands like a robot, not even while speaking.
const LIFE = {
  31: lifeAt({ seed: 31 }), 41: lifeAt({ seed: 41 }), 43: lifeAt({ seed: 43 }),
  47: lifeAt({ seed: 47 }), 61: lifeAt({ seed: 61 }), 71: lifeAt({ seed: 71 }),
};
// PHYSICAL GRIP: the neighbour's tray lift (f1332-1364) — gripAt's k
// drives his raised-arm prop and its squash is the strain/settle of
// taking the tray's weight; the tray's own world track (trayAt) rides
// the same window, so hand and object move in the same frames.
const trayGrip = gripAt([{ f0: 1332, dur: 32, type: 'lift', settle: 8 }]);
// DIALOGUE GESTURE: while the halwai performs his line (f1599-1697),
// his free hand talks with the voice — beats land on कभी (1621),
// नहीं (1643), दोस्तों (1649), नीचे (1672), जुड़ी (1685).
const gestHalwai = gestureAt([{ a: 1599, b: 1697, beats: [1621, 1643, 1649, 1672, 1685], base: 0.35, amp: 0.2 }]);
const micro = (f, seed) => 1.1 * Math.sin((f + seed * 5) * 0.037 + 1);
const nodAt = (f, f0, n = 9, depth = 0.34) => (f >= f0 && f <= f0 + n ? Math.sin((f - f0) / n * Math.PI) * depth : 0);
const head = (f, seed, tilt, look, lookY, facing = 0, squash = 0) => ({
  headTilt: q(tilt + micro(f, seed) + (LIFE[seed] ? LIFE[seed](f).tilt : 0), 1), look: q(look, 2), lookY: q(lookY, 2), facing: q(facing, 2), squash: q(squash, 2),
});

export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, z, extra = {}) => {
    // lifeAt breath phase: each actor breathes on his own cycle.
    if (opts.seed != null) opts.breath = f + opts.seed * 41;
    out.push({ id, x, y: extra.y || 0, z, r: 0.30, ground: 0,
    actor: (T) => ({ key: 'smx' + JSON.stringify(o) + JSON.stringify(opts) + (extra.y || 0),
      draw: (p) => { T.bodyFront(p, o, opts); if (extra.overlay) extra.overlay(p); },
      x, y: extra.y || 0, z, ground: 0, tint, ...extra }) });
  };
  const h = halwaiAt(f), n = neighAt(f), w = wifeAt(f);
  const aA = custAAt(f), aB = custBAt(f), aC = custCAt();
  let HP = emoHalwai.at(f);
  const NP = emoNeigh.at(f), WP = emoWife.at(f), AP = emoCustA.at(f), BP = emoCustB.at(f);
  HP.blush = 0; NP.blush = 0; WP.blush = 0; AP.blush = 0; BP.blush = 0;
  const inShop = !['sneak', 'peek', 'seeback', 'wife', 'refillA', 'refillB'].includes(S.id);
  const inBack = ['seeback', 'wife', 'refillA', 'refillB'].includes(S.id);
  switch (S.id) {
    case 'open': {
      // R2 OPENING: the halwai alone and BIG, mid-action — arm raised
      // presenting the thali, a proud little nod as the line lands.
      // (No customer at the frame edge: no partial faces, hero first.)
      std('halwai', OUTFITS.halwai, { expr: 'smile', exprP: HP, mode: 'stand', breath: f, blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.82],
        ...head(f, 31, -2.5, 0.25, 0.18 + nodAt(f, 40, 10, -1.1), 0.25) }, h.x, h.z, { yaw: 0.28 });
      break;
    }
    case 'morning': {
      std('halwai', OUTFITS.halwai, { expr: 'smile', exprP: HP, mode: 'stand', breath: f, blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.4],
        ...head(f, 31, -3.5, 0.15, 0.5, 0.2) }, h.x, h.z, { yaw: 0.25 });
      break;
    }
    case 'crowd': {
      std('halwai', OUTFITS.halwai, { expr: 'smile', exprP: HP, mode: 'stand', breath: f, blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.65],
        ...head(f, 31, -2, 0.2, 0.2, 0.25) }, h.x, h.z, { yaw: 0.3 });
      std('custA', OUTFITS.custA, { expr: 'grin', exprP: AP, mode: 'stand', breath: f, blink: blinkAt(f, 41), seed: 41, prop: ['coin', 0.6],
        ...head(f, 41, -1.5, -0.3, 0.2, -0.3) }, aA.x, aA.z, { yaw: -0.25 });
      std('custB', OUTFITS.custB, { expr: 'smile', exprP: BP, mode: 'stand', breath: f, blink: blinkAt(f, 43), seed: 43,
        ...head(f, 43, -1, -0.4, 0.15, -0.4) }, aB.x, aB.z, { yaw: -0.3 });
      std('custC', OUTFITS.custC, { expr: 'smile', exprP: BP, mode: 'stand', breath: f, blink: blinkAt(f, 47), seed: 47,
        ...head(f, 47, 0, -0.2, 0.1, -0.2) }, aC.x, aC.z, { yaw: -0.2 });
      break;
    }
    case 'gossip': {
      std('custA', OUTFITS.custA, { expr: 'grin', exprP: AP, mode: 'stand', breath: f, blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, kf([[326, -1], [380, -3.5], [453, -3]], f), 0.55, -0.1, 0.5) }, aA.x, aA.z, { yaw: 0.35 });
      std('halwai', OUTFITS.halwai, { expr: 'smile', exprP: HP, mode: 'stand', breath: f, blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, -1.5, 0.4, 0.1, 0.35) }, h.x, h.z, { yaw: 0.4 });
      break;
    }
    case 'smug': {
      std('halwai', OUTFITS.halwai, { expr: 'smile', exprP: HP, mode: 'stand', breath: f, blink: blinkAt(f, 31), seed: 31, prop: ['coin', 0.6],
        ...head(f, 31, kf([[454, -2], [520, -3.5], [578, -3.5]], f), 0.1, -0.1 + nodAt(f, 528, 9, -1.4), 0.1) }, h.x, h.z, { yaw: 0.15 });
      std('custA', OUTFITS.custA, { expr: 'grin', exprP: AP, mode: 'stand', breath: f, blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -1, -0.3, 0.15, -0.3) }, aA.x, aA.z, { yaw: -0.3 });
      break;
    }
    case 'tally': {
      std('neighbour', OUTFITS.neighbour, { expr: 'neutral', exprP: NP, mode: 'stand', breath: f, blink: blinkAt(f, 61), seed: 61, prop: ['point', 0.25],
        ...head(f, 61, kf([[579, -2], [620, -5], [685, -4]], f), -0.2, 0.55, -0.2) }, n.x, n.z, { yaw: -0.35 });
      break;
    }
    case 'count': {
      std('neighbour', OUTFITS.neighbour, { expr: 'neutral', exprP: NP, mode: 'stand', breath: f, blink: blinkAt(f, 61), seed: 61,
        ...head(f, 61, kf([[686, -4], [742, -4], [748, -7.5], [770, -6], [840, -5]], f),
          kf([[686, -0.2], [748, 0.1], [840, 0.1]], f), kf([[686, 0.5], [742, 0.45], [748, -0.2], [840, -0.1]], f),
          kf([[686, -0.2], [748, 0.35], [840, 0.3]], f),
          f >= 746 && f <= 758 ? 0.1 : 0) }, n.x, n.z, { yaw: -0.3 });
      break;
    }
    case 'sneak': {
      const walking = f >= 845 && f < 890;
      // stride phase from DISTANCE travelled (stridePh): the path
      // (4.3,-8.3)->(1.85,-7.32) is ~2.64 long; feet plant with the
      // ground instead of gliding on a fixed-rate cycle.
      const walkU = smooth(ramp(f, 845, 890));
      std('neighbour', OUTFITS.neighbour, { expr: 'neutral', exprP: NP, mode: walking ? 'march' : 'stand', phase: q(stridePh(0, walkU * 2.64, 0.95), 2), breath: f, blink: blinkAt(f, 61), seed: 61,
        ...head(f, 61, walking ? 1.6 * Math.sin(f * 0.3) : -2, -0.3, 0.15, -0.3) }, n.x, n.z, { yaw: -0.3 });
      break;
    }
    case 'peek': {
      std('neighbour', OUTFITS.neighbour, { expr: 'neutral', exprP: NP, mode: 'stand', breath: f, blink: blinkAt(f, 61), seed: 61,
        ...head(f, 61, -3.5, 0.15, 0.3, 0.15) }, n.x, n.z, { yaw: 0.1 });
      break;
    }
    case 'seeback': {
      // R2 INSERT: a pure object shot — the camera travels through
      // the partition opening into the counter cavity (trough + the
      // hole under the tray). No cast in frame at all.
      break;
    }
    case 'wife': {
      std('wife', OUTFITS.wife, { expr: 'smile', exprP: WP, mode: 'sit', breath: f, blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, -3.5 + 1.4 * Math.sin(f * 0.22), 0.15, 0.5, 0.15) }, w.x, w.z, { yaw: -0.2 });
      break;
    }
    case 'refillA': {
      const Tn = wifeTurn(f);
      std('wife', OUTFITS.wife, { expr: 'smile', exprP: WP, mode: 'sit', squash: Tn.squash, breath: f, blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, kf([[1165, -3.5], [1190, -2], [1229, -2]], f), kf([[1165, 0.15], [1198, 0.5], [1229, 0.5]], f), kf([[1165, 0.5], [1198, 0.3], [1229, 0.3]], f), 0.15) },
        w.x, w.z, { yaw: -0.2 + Tn.yaw, y: Tn.hop });
      break;
    }
    case 'refillB': {
      std('wife', OUTFITS.wife, { expr: 'smile', exprP: WP, mode: 'sit', breath: f, blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, -2, 0.5, 0.3, 0.2) }, w.x, w.z, { yaw: 0.55 });
      break;
    }
    case 'refillC': {
      std('halwai', OUTFITS.halwai, { expr: 'smile', exprP: HP, mode: 'stand', breath: f, blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, -2, 0.2, 0.2, 0.25) }, h.x, h.z, { yaw: 0.3 });
      break;
    }
    case 'revealA': {
      const lifting = f >= 1332 && f <= 1417;
      std('neighbour', OUTFITS.neighbour, { expr: 'neutral', exprP: NP, mode: 'stand', breath: f, blink: blinkAt(f, 61), seed: 61, prop: f >= 1332 ? ['point', q(0.92 * trayGrip(f).k, 2)] : null,
        ...head(f, 61, kf([[1300, -1], [1332, -2], [1364, -4], [1417, -3.5]], f), 0.1,
          kf([[1300, 0.1], [1364, 0.5], [1417, 0.45]], f), 0.1, q(trayGrip(f).squash, 2)) }, n.x, n.z, { yaw: -0.15 });
      std('halwai', OUTFITS.halwai, { expr: 'smile', exprP: HP, mode: 'stand', breath: f, blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, kf([[1300, -1.5], [1332, -2.5], [1364, -3], [1417, -2]], f), -0.4, 0.1, -0.4) }, h.x, h.z, { yaw: -0.35 });
      std('custA', OUTFITS.custA, { expr: 'grin', exprP: AP, mode: 'stand', breath: f, blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, kf([[1300, -1], [1364, -4], [1417, -3]], f), -0.2, -0.1, -0.2) }, aA.x, aA.z, { yaw: -0.2 });
      std('custB', OUTFITS.custB, { expr: 'smile', exprP: BP, mode: 'stand', breath: f, blink: blinkAt(f, 43), seed: 43,
        ...head(f, 43, -1.5, -0.3, 0, -0.3) }, aB.x, aB.z, { yaw: -0.25 });
      break;
    }
    case 'revealB': {
      // the hole insert: the neighbour holds the tray up, the halwai
      // stares at the dark hole in the counter top.
      std('neighbour', OUTFITS.neighbour, { expr: 'neutral', exprP: NP, mode: 'stand', breath: f, blink: blinkAt(f, 61), seed: 61, prop: ['point', q(0.92 * trayGrip(f).k, 2)],
        ...head(f, 61, kf([[1384, -4], [1417, -3.5]], f), 0.1, kf([[1384, 0.5], [1417, 0.45]], f), 0.1, q(trayGrip(f).squash, 2)) }, n.x, n.z, { yaw: -0.15 });
      std('halwai', OUTFITS.halwai, { expr: 'smile', exprP: HP, mode: 'stand', breath: f, blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, kf([[1384, -3], [1417, -2]], f), -0.4, 0.1, -0.4) }, h.x, h.z, { yaw: -0.35 });
      break;
    }
    case 'laugh': {
      std('custA', OUTFITS.custA, { expr: 'grin', exprP: AP, mode: 'stand', breath: f, blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -3 + 2.4 * Math.sin(f * 0.33), -0.2, -0.15, -0.2, 0.03 + 0.03 * Math.sin(f * 0.33)) }, aA.x, aA.z, { yaw: -0.2, y: Math.abs(Math.sin(f * 0.3)) * 0.05 });
      std('custB', OUTFITS.custB, { expr: 'smile', exprP: BP, mode: 'stand', breath: f, blink: blinkAt(f, 43), seed: 43,
        ...head(f, 43, -2.6 + 2.2 * Math.sin(f * 0.33 + 1.2), -0.35, -0.1, -0.35, 0.03 + 0.03 * Math.sin(f * 0.33 + 1.2)) }, aB.x, aB.z, { yaw: -0.3, y: Math.abs(Math.sin(f * 0.3 + 0.5)) * 0.05 });
      std('custC', OUTFITS.custC, { expr: 'smile', exprP: BP, mode: 'stand', breath: f, blink: blinkAt(f, 47), seed: 47,
        ...head(f, 47, -2 + 2 * Math.sin(f * 0.3 + 2.1), -0.25, -0.05, -0.25) }, aC.x, aC.z, { yaw: -0.25 });
      std('halwai', OUTFITS.halwai, { expr: 'smile', exprP: HP, mode: 'stand', breath: f, blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, -2.5, 0.35, 0.05, 0.3) }, h.x, h.z, { yaw: 0.3 });
      std('neighbour', OUTFITS.neighbour, { expr: 'neutral', exprP: NP, mode: 'stand', breath: f, blink: blinkAt(f, 61), seed: 61,
        ...head(f, 61, -2.5 + 1.8 * Math.sin(f * 0.33 + 0.6), 0.2, -0.1, 0.2) }, n.x, n.z, { yaw: 0.2 });
      break;
    }
    case 'leadin': {
      std('halwai', OUTFITS.halwai, { expr: 'smile', exprP: HP, mode: 'stand', breath: f, blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, -3, 0.1, -0.05, 0.1) }, h.x, h.z, { yaw: 0.12 });
      std('neighbour', OUTFITS.neighbour, { expr: 'neutral', exprP: NP, mode: 'stand', breath: f, blink: blinkAt(f, 61), seed: 61,
        ...head(f, 61, -1.5, -0.4, 0.05, -0.4) }, n.x, n.z, { yaw: -0.4 });
      break;
    }
    case 'dialogue': {
      // THE performed line: the halwai speaks it himself — mouth driven
      // by the stem via SPEAK (open/mw/brow/nod), everyone else silent.
      const sp = SPEAK.at(f);
      let DP = applySpeak(HP, sp);
      const winkK = halwaiWink(f);
      if (winkK > 0) DP = T.blendFaceP(DP, T.faceP('wink', 31), winkK * (sp.active ? 0.5 : 1));
      std('halwai', OUTFITS.halwai, { expr: 'smile', exprP: DP, mode: 'stand', breath: f, blink: blinkAt(f, 31), seed: 31, prop: ['point', q(gestHalwai(f).k, 2)],
        ...head(f, 31, -2.5 + q(sp.nod * 40, 1), 0.05, -0.02, 0.05) }, h.x, h.z, { yaw: 0.08 });
      break;
    }
    case 'hook': {
      // R2 FINAL: character beat + board together — the halwai kneels
      // in the foreground at the board's lower-left, grinning and
      // pointing up at the question he is leaving behind.
      std('halwai', OUTFITS.halwai, { expr: 'smile', exprP: HP, mode: 'kneel', breath: f, blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.92],
        ...head(f, 31, -4, 0.3, -0.3, 0.3) }, h.x, h.z, { yaw: 0.25 });
      break;
    }
    default: {
      if (inShop) std('halwai', OUTFITS.halwai, { expr: 'smile', exprP: HP, mode: 'stand', breath: f, blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, -2, 0.2, 0.2, 0.25) }, h.x, h.z, { yaw: 0.3 });
      if (inBack) std('wife', OUTFITS.wife, { expr: 'smile', exprP: WP, mode: 'sit', breath: f, blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, -3, 0.2, 0.45, 0.2) }, w.x, w.z, { yaw: -0.25 });
    }
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity ----------
export const STATICS = [
  SOL.aabb(-2.5, 2.5, 0.8, 2.2, { h: 1.1, id: 'counter' }),
  SOL.aabb(-4.6, -3.3, -0.22, 0.02, { h: 3.4, id: 'partL' }),
  SOL.aabb(-2.3, 0.02, -0.22, 0.02, { h: 3.4, id: 'partM' }),
  SOL.aabb(0.48, 4.6, -0.22, 0.02, { h: 3.4, id: 'partR' }),
  SOL.aabb(0.02, 0.48, -0.22, 0.02, { h: 0.17, id: 'partSill' }),
  SOL.aabb(-4.8, -4.5, -6.6, 6.3, { h: 3.9, id: 'wallL' }),
  SOL.aabb(4.5, 4.8, -6.6, 6.3, { h: 3.9, id: 'wallR' }),
  SOL.aabb(-4.8, 4.8, -6.85, -6.45, { h: 3.9, id: 'backwall' }),
  SOL.circle(-3.3, 6.2, 0.27, { h: 4.8, id: 'pillarL' }),
  SOL.circle(3.3, 6.2, 0.27, { h: 4.8, id: 'pillarR' }),
  SOL.circle(-3.55, 3.6, 0.55, { h: 0.9, id: 'kadhai' }),
  SOL.circle(1.05, -2.5, 0.62, { h: 0.5, id: 'wifetable' }),
  SOL.circle(0.15, -3.3, 0.37, { h: 0.35, id: 'basket' }),
  SOL.circle(3.05, 3.3, 0.3, { h: 0.7, id: 'slate' }),
  SOL.aabb(-2.55, 2.55, 10.55, 11.05, { h: 2.9, id: 'hookboard' }),
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
