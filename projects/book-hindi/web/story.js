// Shot plan for "खुद पढ़ने वाली किताब" — book-hindi (Salted Mine V3 style
// lock: painted 3D world, flat round-white-head card characters, reference
// camera grammar — every clause a new shot, push-ins, inserts, word-by-word
// captions; body.js actions; speak.js performed dialogue).
// R2 REBUILD (2026-11-17, moonrent R2 standard): same world, cast, timing
// and mix — every camera re-staged: hook opens ON the showman BIG (head
// ~40%+) at a low angle with the giant book towering behind him; 'opens'
// arcs into a pure page INSERT (the open book fills ~90% of frame width,
// no faces); 'listen' pushes into the fair-kid's wonder face (>=65%);
// 'reads' is the front-close ACTION beat (the boy flips a page — pageK —
// and reads, face + page centred); dialogue stays a performed close push;
// the final frame is a character beat — the showman KNEELS large in the
// centre-left foreground pointing up at the hook board (board ~85% of
// frame width, whole panel inside with margins), the boy small under
// its left end, his head below the board's lowest ink line.
// ONE fair set + ONE cutaway: the village fair in warm daylight — the
// giant "book" (a hollow box) centre stage on its platform, stalls,
// bunting, a ferris wheel behind; and the box's INTERIOR dressed as a
// cutaway set at (30,-30): panelled walls, listening holes, the boy's
// reading corner. Voice stem: Google AI Studio Puck (series voice),
// 55.811 s, 30 fps, TOTAL 1674; line timings from timing.json
// (faster-whisper small full-file + output-seek span recovery for L8-9,
// char-mapped onto the script — see ../span_fix.py). Scene changes ONLY
// at line boundaries:
//   L1 the fair book      L7 a jinn inside?    L13 the names trick
//   L2 man-tall, gold     L8 coins for god     L14 the sneeze
//   L3 ask anything       L9 it is a BOX       L15 the back door opens
//   L4 the book speaks    L10 the boy inside   L16 the laugh (tag)
//   L5 mouths open        L11 listening holes  L17 THE LINE (performed)
//   L6 the name answer    L12 he reads answers L18 hook board (clouds)
// GRADE: Sunny Pop / Golden Hour fair day; the interior is warm lamplight
// + sun shafts through the holes. Boards/text never graded.
// V4 UPGRADE (2026-11-19, PICTURE ONLY — stem/script/boards/mix/speakdata
// untouched): every shot re-rigged to the ACTION camera — a fast eased
// PUNCH (subject scale x1.5-2 in 12-18 frames) at each shot's action
// start, then a tracking settle; NO slow full-shot glides, no static
// holds; impact KICKS at the cover landing (f308), the page landing
// (f1084), the sneeze snap (f1336) and the door bang (f1418). Animation
// upgraded to body.js v2: lifeAt breath/weight-shift/sway on every
// figure via head(), gestureAt on the performed line, gripAt driving
// the showman's cover-fling arm in sync with the cover's own swing.
// Hook board font dropped to the ~50px regime (fsMul 0.55 in main.js)
// so लेकिन can never blob-merge at large size again.
import { M, blinkAt, q, clamp, lerp, ramp, kf } from './motion.js';
import { buildRig, keysCam } from './camrig.js';
import { poseWindows, turnTrack, winkTrack, lifeAt, gestureAt, gripAt } from './body.js';
import * as SOL from './solid.js';
import * as T from './toon.js';
import * as SPK from './speak.js';
import { SPEAK_DATA } from './speakdata.js';

export const FPS = 30, TOTAL = 1674, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 89, light: 'day' },
  { id: 'big', a: 90, b: 172, light: 'day' },
  { id: 'invite', a: 173, b: 259, light: 'day' },
  { id: 'opens', a: 260, b: 347, light: 'day' },
  { id: 'listen', a: 348, b: 424, light: 'day' },
  { id: 'name', a: 425, b: 528, light: 'day' },
  { id: 'jinn', a: 529, b: 626, light: 'day' },
  { id: 'money', a: 627, b: 737, light: 'day' },
  { id: 'reveal', a: 738, b: 848, light: 'day' },
  { id: 'inside', a: 849, b: 960, light: 'box' },
  { id: 'holes', a: 961, b: 1044, light: 'box' },
  { id: 'reads', a: 1045, b: 1148, light: 'box' },
  { id: 'names', a: 1149, b: 1271, light: 'day' },
  { id: 'sneeze', a: 1272, b: 1353, light: 'box' },
  { id: 'door', a: 1354, b: 1450, light: 'day' },
  { id: 'laugh', a: 1451, b: 1490, light: 'day' },
  { id: 'dialogue', a: 1491, b: 1599, light: 'day' },
  { id: 'hookboard', a: 1600, b: 1673, light: 'day' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights / mood grades ----------
export const LIGHTS = {
  day: { az: 128, el: 52, sky: '#cfe4ff', ground: '#9a7a4e', hemi: 1.02, sun: '#ffd9a0', sunI: 1.85, fog: '#e8f0f8', fogNear: 40, fogFar: 240,
    skyTop: '#3f7fd0', skyHor: '#e3eef8', sunDisc: '#fff3c8', sunSize: 0.012, sat: 1.14, vig: 0.22, shadowExt: 30, aurora: 0, gain: '#fff6e6',
    waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
  box: { az: 128, el: 46, sky: '#8a6a4a', ground: '#2a1a0c', hemi: 0.5, sun: '#ffb45e', sunI: 0.55, fog: '#241608', fogNear: 4, fogFar: 30,
    skyTop: '#1c1006', skyHor: '#3a2410', sunDisc: '#000000', sunSize: 0, sat: 1.08, vig: 0.38, shadowExt: 7, aurora: 0, gain: '#ffdcae',
    waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

// ---------- staging ----------
// The hook board stands left of the book, turned slightly toward the
// crowd; transform mirrored in boards.json — keep in sync.
export const BOARD_POS = [-3.4, 1.95, -5.2];
export const BOARD_RY = 0;
export const BOOK_POS = [0, 0, -6];
export const INT_POS = [30, 0, -30];

// cast anchors per shot (single source of truth)
export const heroAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'hook': return { x: 1.7, z: -4.3 };
    case 'big': return { x: 1.9, z: -4.6 };
    case 'invite': return { x: 0.9, z: -3.6 };
    case 'opens': return { x: 2.0, z: -4.4 };
    case 'listen': return { x: 2.6, z: -4.2 };
    case 'name': return { x: 2.2, z: -4.3 };
    case 'jinn': return { x: 2.3, z: -4.7 };
    case 'money': return { x: 1.5, z: -3.9 };
    case 'reveal': return { x: -2.2, z: -6.6 };
    case 'names': return { x: 0.4, z: -2.9 };
    case 'door': return { x: 2.7, z: -7.3 };
    case 'laugh': case 'dialogue': return { x: S.id === 'laugh' ? 1.2 : 0.9, z: S.id === 'laugh' ? -4.6 : -4.2 };
    case 'hookboard': return { x: -3.85, z: -0.62 };   // R2 FINAL (fix 2): centre-left FOREGROUND, kneeling at s=1.05 — head ~21% of frame width, fully in frame, crown below the board's bottom edge so no glyph is ever covered
    default: return { x: 14, z: 8 };
  }
};
export const kidAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'hook': return { x: -1.5, z: -3.2 };
    case 'big': return { x: -1.6, z: -3.4 };
    case 'invite': return { x: -1.3, z: -2.9 };
    case 'opens': return { x: 14, z: 8 };   // parked — the R2 page insert is a pure object shot, no faces
    case 'listen': return { x: -1.2, z: -3.0 };
    case 'name': return { x: -0.7, z: -2.9 };
    case 'jinn': return { x: -1.4, z: -3.3 };
    case 'money': return { x: -0.9, z: -3.1 };
    case 'names': return { x: -0.6, z: -2.6 };
    case 'door': return { x: -0.9, z: -8.0 };
    case 'laugh': return { x: -1.2, z: -3.8 };
    case 'dialogue': return { x: -1.5, z: -3.6 };
    case 'hookboard': return { x: 15, z: 9 };   // parked — the final frame is the hero, the boy and the board
    default: return { x: 15, z: 9 };
  }
};
export const oldAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'invite': return { x: 2.1, z: -3.1 };
    case 'listen': return { x: 1.3, z: -3.4 };
    case 'name': return { x: 1.6, z: -3.5 };
    case 'jinn': return { x: 0.6, z: -3.8 };
    case 'money': return { x: 0.2, z: -3.3 };
    case 'names': return { x: 1.4, z: -2.8 };
    case 'door': return { x: -2.6, z: -7.9 };   // R2: shifted left so the boy's doorway stays centre-frame
    case 'laugh': return { x: 2.3, z: -4.0 };
    case 'dialogue': return { x: 2.0, z: -3.8 };
    default: return { x: 16, z: 10 };
  }
};
export const womanAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'hook': return { x: 17, z: 11 };   // parked — the R2 opening is the showman + the book only
    case 'invite': return { x: -2.2, z: -3.3 };
    case 'opens': return { x: 17, z: 11 };   // parked — pure page insert, no faces
    case 'listen': return { x: -2.9, z: -4.3 };   // back-left: clears the push into the kid's face
    case 'jinn': return { x: -2.5, z: -3.6 };
    case 'names': return { x: -1.8, z: -2.7 };
    case 'door': return { x: 1.9, z: -7.6 };
    case 'dialogue': return { x: -2.2, z: -3.9 };
    default: return { x: 17, z: 11 };
  }
};
export const manAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'hook': return { x: -2.8, z: -4.0 };
    case 'jinn': return { x: 2.9, z: -4.1 };
    case 'money': return { x: 2.8, z: -3.2 };
    case 'door': return { x: 2.9, z: -8.6 };   // R2 fix: right edge — his shock face stays a reactor, the boy's doorway keeps the centre
    case 'dialogue': return { x: 2.9, z: -4.3 };
    case 'hookboard': return { x: 14, z: 8 };   // parked — the final frame is the hero, the boy and the board
    default: return { x: 18, z: 12 };
  }
};
// the hidden boy: inside the cutaway set for the interior shots, inside
// the real box for the door reveal, then standing free by the book.
export const boyAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'inside': case 'holes': case 'reads': case 'sneeze':
      return { x: 29.65, z: -30.55, y: 0.11, ground: 0.11, s: 0.7, mode: 'sit' };
    case 'door': return { x: 0, z: -6.26, y: 0.14, ground: 0.14, s: 0.66, mode: 'kneel', group: 'bookbox' };
    case 'dialogue': return { x: 0.3, z: -4.95, s: 0.7, mode: 'stand' };
    case 'hookboard': return { x: -4.75, z: -2.7, s: 0.7, mode: 'stand' };   // under the board's LEFT end (hero kneels in the centre-left foreground) — head below its lowest ink, fully in frame at the tighter R2 fov
    default: return { x: 40, z: 20, s: 0.7, mode: 'stand' };
  }
};

// ---------- hero / focus ----------
const FOCUS = {
  hook: () => [0.4, 1.4, -5.4],
  big: () => [0, 1.5, -6],
  invite: () => { const h = heroAt(200); return [h.x, 1.5, h.z]; },
  opens: () => [0, 1.15, -5.8],
  listen: () => [-1.2, 1.02, -3.0],
  name: () => { const k = kidAt(470); return [k.x, 1.0, k.z]; },
  jinn: () => [0.2, 1.3, -3.9],
  money: () => [1.3, 0.9, -3.8],
  reveal: () => [-0.2, 1.3, -6.2],
  inside: () => [29.65, 0.8, -30.5],
  holes: () => [30.0, 1.2, -28.9],
  reads: () => [29.65, 0.85, -30.5],
  names: () => [0.1, 1.3, -2.9],
  sneeze: () => [29.65, 0.85, -30.5],
  door: () => [0, 1.1, -6.3],
  laugh: () => { const h = heroAt(1470); return [h.x, 1.5, h.z]; },
  dialogue: () => { const h = heroAt(1540); return [h.x, 1.52, h.z]; },
  hookboard: () => [...BOARD_POS],
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id]();

// ---------- cameras: EVERY shot is a camrig track on a subject ----------
const heroPos = (f) => { const h = heroAt(f); return [h.x, h.y || 0, h.z]; };
const RIG_BY_ID = {
  // hook: R2 OPENING — ON the showman BIG from frame 0, low angle, mid-
  // action (one arm flinging the cover open, the other presenting); the
  // giant book towers behind his shoulder; the push-in runs from f0.
  hook: { cut: 'hard', raw: keysCam({ keys: [
    { f: 0, pos: [2.6, 1.15, -1.2], look: [1.35, 1.55, -4.65], fov: 44 },
    { f: 14, pos: [2.08, 1.0, -2.28], look: [1.32, 1.58, -4.68], fov: 37, ease: 'surge' },
    { f: 89, pos: [1.98, 1.04, -2.5], look: [1.34, 1.56, -4.66], fov: 36, ease: 'surge' }] }) },
  // big: low angle — the book towers a full man's height, the showman
  // himself standing FULLY in frame beside it for scale, pages glinting
  big: { cut: 'hard', raw: keysCam({ keys: [
    { f: 90, pos: [3.9, 1.25, 1.3], look: [0.6, 1.5, -5.9], fov: 45 },
    { f: 106, pos: [3.3, 1.02, -0.1], look: [0.62, 1.42, -5.9], fov: 41, ease: 'surge' },
    { f: 172, pos: [3.1, 1.06, -0.4], look: [0.64, 1.42, -5.9], fov: 39, ease: 'surge' }] }) },
  // invite: v4 — a 16-frame PUNCH onto the showman as he calls the
  // crowd in, then a continued tracking push (was a full-shot glide).
  invite: { cut: 'hard', raw: keysCam({ keys: [
    { f: 173, pos: [2.9, 1.7, 0.6], look: [0.9, 1.5, -3.6], fov: 40 },
    { f: 189, pos: [2.0, 1.6, -0.9], look: [0.92, 1.52, -3.62], fov: 34, ease: 'surge' },
    { f: 259, pos: [1.8, 1.57, -1.25], look: [0.9, 1.5, -3.6], fov: 32, ease: 'surge' }] }) },
  // opens: the cover swings wide — the camera ARCS from the left across
  // the front as it opens, landing in a pure page INSERT: the open book
  // (golden page face + swung cover) fills ~90% of the frame width.
  // No faces anywhere in this shot (kid + woman parked).
  opens: { cut: 'hard', raw: keysCam({ keys: [
    { f: 260, pos: [-2.6, 1.6, -0.9], look: [0, 1.3, -5.8], fov: 42 },
    { f: 284, pos: [-0.6, 1.42, -2.2], look: [0, 1.2, -5.8], fov: 44, ease: 'smooth' },
    { f: 312, pos: [1.35, 1.33, -3.25], look: [-0.1, 1.16, -5.78], fov: 45, ease: 'surge' },
    { f: 347, pos: [1.45, 1.31, -3.38], look: [-0.12, 1.15, -5.78], fov: 45, ease: 'surge' }] }) },
  // listen: a drift across the crowd's faces that PUSHES IN on the
  // fair-kid — the REACTION beat: his wonder face passes 65% of frame
  // width as the book talks (V3 buyer-close-up grammar).
  listen: { cut: 'hard', raw: keysCam({ keys: [
    { f: 348, pos: [0.6, 1.4, 1.1], look: [-0.55, 1.2, -3.3], fov: 39 },
    { f: 366, pos: [-0.35, 1.24, -0.6], look: [-1.05, 1.08, -3.1], fov: 33, ease: 'surge' },
    { f: 424, pos: [-1.04, 1.14, -1.6], look: [-1.2, 1.03, -3.0], fov: 31, ease: 'surge' }] }) },
  // name: ON the boy who asked — a push into his face as the book
  // answers with his own name; the book looms soft behind him
  name: { cut: 'hard', raw: keysCam({ keys: [
    { f: 425, pos: [0.4, 1.3, 0.9], look: [-0.5, 1.05, -3.0], fov: 38 },
    { f: 443, pos: [-0.35, 1.16, -0.9], look: [-0.68, 1.02, -2.92], fov: 31, ease: 'surge' },
    { f: 528, pos: [-0.55, 1.13, -1.15], look: [-0.7, 1.0, -2.9], fov: 30, ease: 'surge' }] }) },
  jinn: { cut: 'hard', raw: keysCam({ keys: [
    { f: 529, pos: [2.9, 1.65, 1.2], look: [0.1, 1.32, -3.95], fov: 40 },
    { f: 545, pos: [2.35, 1.52, 0.1], look: [0.13, 1.31, -3.95], fov: 35, ease: 'surge' },
    { f: 626, pos: [2.18, 1.48, -0.15], look: [0.12, 1.31, -3.95], fov: 34, ease: 'surge' }] }) },
  // money: down at the bowl — coin after coin, his blessing hand over them
  money: { cut: 'hard', raw: keysCam({ keys: [
    { f: 627, pos: [2.6, 1.45, -0.6], look: [1.3, 0.95, -3.8], fov: 38 },
    { f: 643, pos: [2.28, 1.26, -1.35], look: [1.27, 0.91, -3.8], fov: 33, ease: 'surge' },
    { f: 737, pos: [2.08, 1.19, -1.8], look: [1.26, 0.9, -3.8], fov: 32, ease: 'surge' }] }) },
  // reveal: the camera slips AROUND the book — seams, boards, a door:
  // it was never a book at all
  reveal: { cut: 'hard', raw: keysCam({ keys: [
    { f: 738, pos: [-3.8, 1.8, -1.6], look: [-0.2, 1.3, -6.25], fov: 40 },
    { f: 762, pos: [-3.15, 1.6, -3.1], look: [-0.16, 1.25, -6.3], fov: 35, ease: 'smooth' },
    { f: 848, pos: [-2.93, 1.55, -3.65], look: [-0.15, 1.24, -6.3], fov: 34, ease: 'surge' }] }) },
  // inside: the payoff — a small boy among little books, reading;
  // closer than v1, his corner centred
  inside: { cut: 'hard', raw: keysCam({ keys: [
    { f: 849, pos: [31.0, 1.35, -28.5], look: [29.62, 0.8, -30.48], fov: 38 },
    { f: 865, pos: [30.5, 1.2, -29.15], look: [29.62, 0.81, -30.48], fov: 33, ease: 'surge' },
    { f: 960, pos: [30.44, 1.18, -29.24], look: [29.62, 0.81, -30.48], fov: 32, ease: 'surge' }] }) },
  // holes: over the boy's shoulder — the glowing listening holes ahead,
  // his head tipped toward them in the lower frame
  holes: { cut: 'hard', raw: keysCam({ keys: [
    { f: 961, pos: [29.15, 1.05, -31.75], look: [30.02, 1.22, -28.82], fov: 38 },
    { f: 977, pos: [29.38, 0.97, -31.2], look: [30.0, 1.23, -28.83], fov: 33, ease: 'surge' },
    { f: 1044, pos: [29.43, 0.96, -31.08], look: [30.0, 1.24, -28.84], fov: 32, ease: 'surge' }] }) },
  // reads: the ACTION beat — front close on the boy inside the box: he
  // FLIPS a page of the stand book (pageK, f1068-1084), finds the
  // answer, points and reads it out; face + page centred together.
  reads: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1045, pos: [28.7, 1.2, -28.6], look: [29.67, 0.84, -30.43], fov: 38 },
    { f: 1061, pos: [28.98, 1.11, -29.2], look: [29.67, 0.84, -30.43], fov: 33, ease: 'surge' },
    { f: 1148, pos: [29.06, 1.09, -29.32], look: [29.67, 0.84, -30.43], fov: 32, ease: 'surge' }] }) },
  // names: before the show — the showman works the crowd, collecting
  // names with a smile and a pointing finger
  names: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1149, pos: [2.2, 1.6, 1.1], look: [0.05, 1.28, -2.92], fov: 39 },
    { f: 1165, pos: [1.68, 1.45, -0.05], look: [0.07, 1.28, -2.93], fov: 34, ease: 'surge' },
    { f: 1271, pos: [1.48, 1.4, -0.25], look: [0.06, 1.28, -2.94], fov: 33, ease: 'surge' }] }) },
  // sneeze: inside again — the boy's head snaps, the little books jump
  sneeze: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1272, pos: [30.95, 1.38, -28.5], look: [29.68, 0.86, -30.42], fov: 39 },
    { f: 1288, pos: [30.5, 1.26, -29.05], look: [29.68, 0.87, -30.42], fov: 35, ease: 'surge' },
    { f: 1353, pos: [30.42, 1.24, -29.16], look: [29.68, 0.87, -30.42], fov: 34, ease: 'surge' }] }) },
  // door: behind the book — the crowd hauls the back door open and the
  // whole fair sees the boy blinking inside; pushed closer than v1 so
  // the boy in the doorway reads big, the old man off to the left edge
  door: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1354, pos: [3.8, 1.85, -12.2], look: [-0.2, 1.12, -6.38], fov: 41 },
    { f: 1372, pos: [3.05, 1.65, -10.9], look: [-0.16, 1.11, -6.4], fov: 36, ease: 'surge' },
    { f: 1450, pos: [2.84, 1.6, -10.53], look: [-0.15, 1.11, -6.4], fov: 35, ease: 'surge' }] }) },
  laugh: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1451, pos: [2.6, 1.6, -1.4], look: [1.18, 1.47, -4.57], fov: 37 },
    { f: 1463, pos: [2.18, 1.5, -2.1], look: [1.18, 1.46, -4.58], fov: 33, ease: 'surge' },
    { f: 1490, pos: [2.04, 1.48, -2.32], look: [1.18, 1.46, -4.58], fov: 32, ease: 'surge' }] }) },
  // dialogue: the performed line — a slow push into the showman's face,
  // the boy standing free beside the open book behind him
  dialogue: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1491, pos: [2.75, 1.66, -1.55], look: [0.92, 1.52, -4.2], fov: 36 },
    { f: 1507, pos: [2.0, 1.59, -2.55], look: [0.9, 1.51, -4.2], fov: 30, ease: 'surge' },
    { f: 1599, pos: [1.85, 1.56, -2.75], look: [0.9, 1.5, -4.2], fov: 29, ease: 'surge' }] }) },
  // hookboard: R2 FINAL (fix 2) — a character beat at the moonrent R2
  // framing: the tighter fov (49->47) puts the board at ~85% of frame
  // width, whole panel inside with margins on all sides (boardverify
  // PARTIAL=0); the showman kneels in the centre-left foreground
  // pointing up at it; the boy waits under its left end.
  hookboard: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1600, pos: [-3.0, 2.35, 6.6], look: [-3.42, 1.95, -5.2], fov: 50 },
    { f: 1616, pos: [-3.28, 2.17, 4.35], look: [-3.42, 1.93, -5.2], fov: 47.2, ease: 'surge' },
    { f: 1673, pos: [-3.3, 2.16, 4.2], look: [-3.42, 1.93, -5.2], fov: 47, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  // v4 impact kicks (7-frame jolts, declared for the jerk meter):
  // f308 the great cover lands open · f1084 the flipped page lands ·
  // f1336 the sneeze snap judders the box · f1418 the back door bangs open.
  kicks: [{ f: 308, a: 0.18 }, { f: 1084, a: 0.13 }, { f: 1336, a: 0.3 }, { f: 1418, a: 0.2 }],
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
  if (['hook', 'big', 'jinn', 'reveal', 'door', 'hookboard'].includes(S.id)) cinf = 1.3;
  if (['inside', 'holes', 'reads', 'sneeze', 'name', 'dialogue', 'listen'].includes(S.id)) cinf = 3.4;
  if (['invite', 'opens', 'money', 'names', 'laugh'].includes(S.id)) cinf = 2.6;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  // the great cover: ajar at the hook, swinging wide on 'opens', then
  // resting open for the rest of the fair
  let coverK = 0.2;
  if (S.id === 'big') coverK = 0.35;
  else if (S.id === 'invite') coverK = 0.3;
  else if (S.id === 'opens') coverK = 0.3 + 0.7 * smooth(ramp(f, 268, 308));
  else if (f > 347) coverK = 0.92;
  // the back door: hauled open during 'door', left open afterwards
  const doorK = f < 1382 ? 0 : f <= 1418 ? smooth(ramp(f, 1382, 1418)) : 1;
  // the sneeze shake: builds inside at the sneeze, judders the whole
  // book through the first half of the door shot, then settles
  let shakeK = 0;
  if (f >= 1336 && f <= 1353) shakeK = smooth(ramp(f, 1336, 1344));
  else if (f > 1353 && f <= 1390) shakeK = 1 - smooth(ramp(f, 1354, 1390));
  // the page flip: inside the box the boy turns a page of his stand
  // book while hunting the answer (reads, f1068-1084), then it rests
  // turned for the rest of the film (main.js pageHinge).
  const pageK = f < 1068 ? 0 : smooth(ramp(f, 1068, 1084));
  return {
    always: 1,
    hookK: S.id === 'hookboard' ? smooth(ramp(f, 1608, 1632)) : 0,
    coverK, doorK, shakeK, pageK,
    boxK: ['inside', 'holes', 'reads', 'sneeze'].includes(S.id) ? 1 : 0,
    wheelA: f * 0.0035,
    blastX: 0, blastY: 1.35, blastZ: -5.55,
  };
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  const spark = S.id === 'big' ? 0.32 : S.id === 'opens' ? 0.5 : S.id === 'name' ? 0.3 * Math.pow(Math.abs(Math.sin(f * 0.4)), 4) : 0.05;
  return { moteRate: 0.12, blastRate: 0, sparkRate: spark, steamRate: 0, shimmerRate: 0,
    boxDustRate: ['inside', 'holes', 'reads', 'sneeze'].includes(S.id) ? 0.5 : 0 };
};
export const fxAt = () => [];

// ---------- cast ----------
// NO card tint in any light — faces stay pure white, costume colours flat
// and saturated even in the box's lamplight (the reference's rule).
const tintFor = () => '#ffffff';
export const OUTFITS = {
  hero: { jacket: '#d97c26', pants: '#efe6d0', boots: '#3a2410', hat: 'turban', turban: '#c72c6e', skin: '#fbf7ef', moustache: '#2a201a' },
  kid: { jacket: '#1f7a6a', pants: '#33424a', boots: '#1c1712', hat: 'cap', cap: '#274b63', skin: '#fbf7ef' },
  old: { jacket: '#cfc8b8', pants: '#5a5348', boots: '#241a12', hat: 'hair', hair: '#e9e7e1', skin: '#fbf7ef', moustache: '#e9e7e1', bigMoustache: true },
  woman: { jacket: '#c25e8e', pants: '#5e2c44', boots: '#241a12', hat: 'hair', hair: '#2a1a12', skin: '#fbf7ef' },
  man: { jacket: '#7a4a2a', pants: '#3c3a40', boots: '#241a12', hat: 'hair', hair: '#1c1712', skin: '#fbf7ef' },
  boy: { jacket: '#5a7a3a', pants: '#4a4034', boots: '#241a12', hat: 'hair', hair: '#14100c', skin: '#fbf7ef' },
};
// the old man's round glasses, drawn over the face card
const drawGlasses = (p) => {
  const hc = T.headCenter(71);
  p.ell(300 - 47, hc - 6, 31, 31, null, 3.2, 0, 360);
  p.ell(300 + 47, hc - 6, 31, 31, null, 3.2, 0, 360);
  p.band([[300 - 16, hc - 8], [300 + 16, hc - 8]], '#2a2018', 3.2, 1);
};

// ---------- HEAD PERFORMANCE ----------
// Expressions MORPH on the narration's emphasis beats; heads nod, tilt,
// snap and turn toward whoever/whatever the voice names, plus a continuous
// idle sway so no head is ever frozen. Pure track folder (deterministic).
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
const emoHero = emoTrack('grin', [
  [173, 'grin', 8], [260, 'smug', 8], [627, 'smug', 8], [738, 'thinking', 9],
  [1149, 'grin', 8], [1354, 'nervous', 8], [1451, 'laugh', 7], [1491, 'smile', 8], [1560, 'smug', 9], [1600, 'grin', 8],
]);
const emoKid = emoTrack('smile', [
  [348, 'wonder', 8], [425, 'nervous', 8], [492, 'relief', 8], [529, 'nervous', 8],
  [1149, 'smile', 8], [1354, 'shock', 8], [1491, 'smile', 8],
]);
const emoOld = emoTrack('neutral', [
  [348, 'wonder', 8], [529, 'nervous', 8], [627, 'smile', 8], [1354, 'shock', 8], [1451, 'relief', 9], [1491, 'relief', 8],
]);
const emoWoman = emoTrack('smile', [
  [348, 'wonder', 8], [529, 'nervous', 8], [1354, 'shock', 8], [1491, 'smile', 8],
]);
const emoMan = emoTrack('grin', [
  [529, 'nervous', 8], [627, 'smile', 8], [1354, 'shock', 8], [1491, 'smile', 8],
]);
const emoBoy = emoTrack('smile', [
  [961, 'neutral', 8], [1045, 'thinking', 9], [1272, 'smile', 8], [1330, 'shock', 6],
  [1354, 'nervous', 8], [1491, 'smile_closed', 8], [1600, 'smile', 8],
]);
// ---------- BODY ACTIONS (library body.js) ----------
// the showman TURNS from the book to the crowd on the laugh beat and
// WINKS over the coin bowl and the name-collecting — the smug tells.
const heroTurn = turnTrack([{ f0: 1458, dur: 12, dir: -1 }]);
const heroWink = winkTrack([{ a: 700, b: 710 }, { a: 1180, b: 1190 }]);
// v4: dialogue gesture — while the showman performs THE LINE his free
// hand talks with the voice (stresses on बोलती / दोस्तों / अंदर / बच्चा).
const gestHero = gestureAt([{ a: 1491, b: 1599, beats: [1518, 1534, 1556, 1578], base: 0.42, amp: 0.17 }]);
// v4: physical grip — his flinging hand rides the great cover's own
// swing (coverK ramps f268-308): the arm strains up WITH the cover and
// settles as it lands (gripAt lift + settle pulse in the squash).
const coverGrip = gripAt([{ f0: 268, dur: 40, type: 'lift', settle: 8 }]);
const SPEAK = SPK.makeSpeakPlayer(SPEAK_DATA);
const micro = (f, seed) => 1.1 * Math.sin((f + seed * 5) * 0.037 + 1);
const nodAt = (f, f0, n = 9, depth = 0.34) => (f >= f0 && f <= f0 + n ? Math.sin((f - f0) / n * Math.PI) * depth : 0);
// v4 ANIMATION (body.js v2, 2026-11-19): continuous life per character
// — breath phase, weight-shift body tilt and micro sway ride on EVERY
// head() call, so no figure ever stands like a post, even mid-scene.
const LIFE = { 31: lifeAt({ seed: 31 }), 41: lifeAt({ seed: 41 }), 61: lifeAt({ seed: 61 }), 71: lifeAt({ seed: 71 }), 81: lifeAt({ seed: 81 }), 91: lifeAt({ seed: 91 }) };
const head = (f, seed, tilt, look, lookY, facing = 0, squash = 0) => {
  const L = (LIFE[seed] || LIFE[31])(f);
  return {
    headTilt: q(tilt + micro(f, seed) + L.sway, 1), look: q(look, 2), lookY: q(lookY, 2), facing: q(facing, 2),
    squash: q(squash, 2), tilt: q(L.tilt, 1), breath: Math.round(L.breath / 6) * 6,
  };
};
const noBlush = (P) => { P.blush = 0; P.openL = Math.min(1, (P.openL ?? 0.85) * 1.45); P.openR = Math.min(1, (P.openR ?? 0.85) * 1.45); return P; };

export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, z, extra = {}) => out.push({ id, x, y: extra.y || 0, z, r: extra.r || 0.32, ground: extra.ground || 0, group: extra.group || '',
    actor: (T) => ({ key: 'smx' + JSON.stringify(o) + JSON.stringify(opts) + (extra.y || 0) + (extra.s || 1),
      draw: (p) => { T.bodyFront(p, o, opts); if (extra.overlay) extra.overlay(p); },
      x, y: extra.y || 0, z, ground: extra.ground || 0, tint, ...extra }) });
  const h = heroAt(f), kd = kidAt(f), o = oldAt(f), w = womanAt(f), mn = manAt(f), by = boyAt(f);
  let HP = noBlush(emoHero.at(f));
  const KP = noBlush(emoKid.at(f)), OP = noBlush(emoOld.at(f)), WP = noBlush(emoWoman.at(f)), MP = noBlush(emoMan.at(f)), BP = noBlush(emoBoy.at(f));
  const winkK = heroWink(f);
  if (winkK > 0) HP = T.blendFaceP(HP, T.faceP('wink', 31), winkK);
  const hero = (opts, extra = {}) => std('hero', OUTFITS.hero, { expr: 'grin', exprP: HP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, ...opts }, h.x, h.z, extra);
  const kid = (opts, extra = {}) => std('kid', OUTFITS.kid, { expr: 'smile', exprP: KP, mode: 'stand', blink: blinkAt(f, 41), seed: 41, ...opts }, kd.x, kd.z, { s: 0.74, r: 0.24, ...extra });
  const old = (opts, extra = {}) => std('old', OUTFITS.old, { expr: 'neutral', exprP: OP, mode: 'stand', blink: blinkAt(f, 71), seed: 71, ...opts }, o.x, o.z, { overlay: drawGlasses, ...extra });
  const woman = (opts, extra = {}) => std('woman', OUTFITS.woman, { expr: 'smile', exprP: WP, mode: 'stand', blink: blinkAt(f, 61), seed: 61, ...opts }, w.x, w.z, extra);
  const man = (opts, extra = {}) => std('man', OUTFITS.man, { expr: 'grin', exprP: MP, mode: 'stand', blink: blinkAt(f, 81), seed: 81, ...opts }, mn.x, mn.z, extra);
  const boy = (opts, extra = {}) => std('boy', OUTFITS.boy, { expr: 'smile', exprP: BP, mode: by.mode, blink: blinkAt(f, 91), seed: 91, ...opts }, by.x, by.z,
    { s: by.s, r: 0.24, y: by.y || 0, ground: by.ground || 0, group: by.group || '', ...extra });
  switch (S.id) {
    case 'hook': {
      // mid-action: one arm flinging the cover open, the other presenting
      hero({ prop: ['point', 0.9], ...head(f, 31, kf([[0, -3], [45, -4.5], [89, -4]], f), 0.3, -0.3, 0.3) }, { yaw: 0.3 });
      kid({ ...head(f, 41, -3.5, -0.3, -0.5, -0.3) }, { yaw: -0.25 });
      woman({ ...head(f, 61, -3, 0.35, -0.45, 0.35) }, { yaw: 0.3 });
      man({ ...head(f, 81, -3, 0.3, -0.45, 0.3) }, { yaw: 0.28 });
      break;
    }
    case 'big': {
      // the book towers a full man's height — he stands beside it, proud
      hero({ prop: ['point', 0.85], ...head(f, 31, kf([[90, -5], [130, -5.5], [172, -5]], f), 0.2, -0.6, 0.2) }, { yaw: 0.2 });
      kid({ ...head(f, 41, -4.5, 0.3, -0.6, 0.3) }, { yaw: 0.28 });
      break;
    }
    case 'invite': {
      hero({ prop: ['point', 0.7], ...head(f, 31, kf([[173, -2], [215, -3], [259, -2.5]], f), 0, -0.05 + nodAt(f, 228, 9, -0.7), 0) }, { yaw: 0.05 });
      kid({ ...head(f, 41, -2, 0.4, -0.2, 0.4) }, { yaw: 0.35 });
      old({ ...head(f, 71, -1.5, -0.4, -0.15, -0.4) }, { yaw: -0.35 });
      woman({ ...head(f, 61, -1.5, 0.45, -0.15, 0.45) }, { yaw: 0.4 });
      break;
    }
    case 'opens': {
      const cg = coverGrip(f);
      hero({ prop: ['point', q(0.25 + 0.65 * cg.k, 2)], ...head(f, 31, -3.5, -0.45, -0.25, -0.45, cg.squash) }, { yaw: -0.4 });
      kid({ ...head(f, 41, -4, 0.4, -0.4, 0.4) }, { yaw: 0.35 });
      woman({ ...head(f, 61, -3.5, -0.4, -0.35, -0.4) }, { yaw: -0.35 });
      break;
    }
    case 'listen': {
      // mouths open, eyes wide — the book is TALKING
      kid({ ...head(f, 41, kf([[348, -3], [390, -3.5], [424, -3]], f), -0.35, -0.3, -0.35) }, { yaw: -0.3 });
      old({ ...head(f, 71, -3, 0.35, -0.3, 0.35) }, { yaw: 0.3 });
      woman({ ...head(f, 61, -3, 0.4, -0.3, 0.4) }, { yaw: 0.35 });
      hero({ ...head(f, 31, -1.5, -0.5, -0.1, -0.5) }, { yaw: -0.45 });
      break;
    }
    case 'name': {
      // the boy asks; at the answer his face lights up — relief track
      kid({ prop: f < 470 ? ['point', 0.55] : null, ...head(f, 41, kf([[425, -1], [470, -2], [528, -2.5]], f),
        kf([[425, 0.3], [470, 0.1], [528, -0.2]], f), kf([[425, 0.1], [470, -0.25], [528, -0.3]], f),
        kf([[425, 0.3], [470, 0.1], [528, -0.2]], f)) }, { yaw: 0.15 });
      old({ ...head(f, 71, -2.5, -0.4, -0.3, -0.4) }, { yaw: -0.35 });
      hero({ ...head(f, 31, -2, -0.5, -0.15, -0.5) }, { yaw: -0.45 });
      break;
    }
    case 'jinn': {
      kid({ ...head(f, 41, -2.5, 0.4, -0.35, 0.4) }, { yaw: 0.35 });
      woman({ ...head(f, 61, -2.5, -0.4, -0.3, -0.4) }, { yaw: -0.35 });
      old({ ...head(f, 71, -2.5, 0.3, -0.35, 0.3) }, { yaw: 0.3 });
      man({ ...head(f, 81, -2, -0.4, -0.3, -0.4) }, { yaw: -0.35 });
      hero({ ...head(f, 31, -1, 0.5, 0, 0.5) }, { yaw: 0.45 });
      break;
    }
    case 'money': {
      hero({ prop: ['point', 0.4], ...head(f, 31, kf([[627, -1], [680, 1.5], [737, 0.5]], f), 0.1, 0.45 + nodAt(f, 690), 0.1) }, { yaw: -0.15 });
      man({ prop: ['coin', 0.55], ...head(f, 81, -1, -0.45, 0.3, -0.45) }, { yaw: -0.4 });
      old({ prop: ['coin', 0.5], ...head(f, 71, -1, 0.4, 0.3, 0.4) }, { yaw: 0.35 });
      kid({ ...head(f, 41, -1.5, 0.45, 0.15, 0.45) }, { yaw: 0.4 });
      break;
    }
    case 'reveal': {
      // only the showman, slipping around the back — and the box itself
      hero({ ...head(f, 31, kf([[738, 0], [790, -2], [848, -2.5]], f), -0.5, 0.2, -0.5) }, { yaw: -0.5 });
      break;
    }
    case 'inside': {
      // the payoff: a small boy SITS among his little books, reading —
      // mouth shut (the "book's voice" is narration), head bobbing soft
      boy({ ...head(f, 91, kf([[849, 1], [905, 2.5], [960, 1.5]], f), 0.15, 0.42 + nodAt(f, 890, 10, 0.4) + nodAt(f, 930, 10, 0.4), 0.1) }, { yaw: 0.12 });
      break;
    }
    case 'holes': {
      // his ear tips toward the glowing holes; he listens hard
      boy({ ...head(f, 91, -4, kf([[961, 0.5], [1005, 0.75], [1044, 0.7]], f), -0.15, kf([[961, 0.5], [1005, 0.72], [1044, 0.7]], f)) }, { yaw: 0.55 });
      break;
    }
    case 'reads': {
      // he flips a page of the stand book (pageK, f1068-1084 — his head
      // dips with the turn), finds the answer, reads it out big
      boy({ prop: f >= 1090 ? ['point', 0.3] : null, ...head(f, 91, kf([[1045, 2.5], [1090, 1], [1148, 0.5]], f), 0.1, 0.3 + nodAt(f, 1072, 9, 0.4) + nodAt(f, 1105, 9, 0.45) + nodAt(f, 1130, 9, 0.45), 0.05) }, { yaw: 0.08 });
      break;
    }
    case 'names': {
      // before the show: he works the crowd, pointing, memorising names
      hero({ prop: ['point', 0.65], ...head(f, 31, kf([[1149, -1.5], [1205, -2], [1271, -1.5]], f),
        kf([[1149, -0.4], [1205, 0.3], [1271, -0.1]], f), 0.05 + nodAt(f, 1212), kf([[1149, -0.4], [1205, 0.3], [1271, -0.1]], f)) }, { yaw: -0.2 });
      kid({ ...head(f, 41, -1, 0.45, 0.1, 0.45) }, { yaw: 0.4 });
      old({ ...head(f, 71, -1, -0.4, 0.05, -0.4) }, { yaw: -0.35 });
      woman({ ...head(f, 61, -1, -0.45, 0.05, -0.45) }, { yaw: -0.4 });
      break;
    }
    case 'sneeze': {
      // the sneeze builds — head back — then SNAPS forward at f1336
      boy({ ...head(f, 91, kf([[1272, 0], [1328, -7], [1336, 8], [1344, -1], [1353, 0]], f), 0.1,
        kf([[1272, 0.3], [1328, -0.2], [1336, 0.55], [1353, 0.35]], f), 0.05) }, { yaw: 0.1 });
      break;
    }
    case 'door': {
      // caught: the boy kneels blinking in the open doorway; the crowd
      // crowds the back of the box, the showman caught mid-grin
      boy({ ...head(f, 91, -2, 0.2, -0.1, 0.2) }, { yaw: 0.15 });
      old({ prop: f < 1418 ? ['point', 0.6] : null, ...head(f, 71, -1.5, 0.4, 0, 0.4) }, { yaw: 0.35 });
      man({ ...head(f, 81, -2, -0.35, -0.05, -0.35) }, { yaw: -0.3 });
      woman({ ...head(f, 61, -2, -0.4, -0.05, -0.4) }, { yaw: -0.35 });
      kid({ ...head(f, 41, -2, 0.45, -0.05, 0.45) }, { yaw: 0.4 });
      hero({ ...head(f, 31, -1, -0.5, 0.05, -0.5) }, { yaw: -0.45 });
      break;
    }
    case 'laugh': {
      const Tn = heroTurn(f);
      hero({ squash: Tn.squash, ...head(f, 31, -3 + 2.2 * Math.sin(f * 0.33), kf([[1451, 0.5], [1458, 0.5], [1470, -0.1], [1490, 0]], f), -0.1, kf([[1451, 0.45], [1470, 0.05], [1490, 0]], f)) }, { yaw: Tn.yaw, y: Tn.hop });
      old({ prop: ['point', 0.7], ...head(f, 71, -1.5, -0.45, 0.1, -0.45) }, { yaw: -0.4 });
      kid({ ...head(f, 41, -2, 0.4, 0, 0.4) }, { yaw: 0.35 });
      break;
    }
    case 'dialogue': {
      // THE LINE, performed: the showman's mouth is driven by the stem
      // itself (speak.js); every other mouth stays shut. The boy stands
      // free beside the open book behind him.
      const sp = SPEAK.at(f);
      const speakP = SPK.applySpeak({ ...T.faceP('smile'), cheek: 0 }, sp);
      speakP.blush = 0; speakP.openL = Math.min(1, (speakP.openL ?? 0.85) * 1.45); speakP.openR = Math.min(1, (speakP.openR ?? 0.85) * 1.45);
      std('hero', OUTFITS.hero, { expr: 'smile', exprP: speakP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        prop: ['point', q(gestHero(f).k, 2)],
        headTilt: q((sp.nod || 0) + micro(f, 31) - 1.5 + LIFE[31](f).sway, 1), look: q(0.08, 2), lookY: q(0.02, 2), facing: q(0.1, 2), squash: 0,
        tilt: q(LIFE[31](f).tilt + LIFE[31](f).sway, 1), breath: Math.round(LIFE[31](f).breath / 6) * 6 }, h.x, h.z, { yaw: 0.1 });
      boy({ ...head(f, 91, -1.5, -0.3, 0.05, -0.3) }, { yaw: -0.25 });
      old({ ...head(f, 71, -1.5, -0.4, 0.05, -0.4) }, { yaw: -0.35 });
      kid({ ...head(f, 41, -1.5, 0.4, 0.05, 0.4) }, { yaw: 0.35 });
      woman({ ...head(f, 61, -1, -0.45, 0.05, -0.45) }, { yaw: -0.4 });
      man({ ...head(f, 81, -1, 0.45, 0.05, 0.45) }, { yaw: 0.4 });
      break;
    }
    case 'hookboard': {
      // R2 FINAL (fix 2): the film ends on a CHARACTER BEAT (V3's
      // final-frame grammar, moonrent R2 staging) — the showman KNEELS
      // in the centre-left foreground, grinning up and pointing at the
      // hook board behind him; kneeling keeps his crown below the
      // board's bottom edge, so the board stays fully readable at full
      // opacity to the last frame. Gaze/lean/yaw turn him up-left
      // toward the board (mirrors moonrent's kneeling hero).
      hero({ mode: 'kneel', prop: ['point', 0.35], ...head(f, 31, -2.5, 0.45, -0.35, 0.45) }, { yaw: 0.45, s: 1.05 });
      boy({ ...head(f, 91, -1.5, 0.45, -0.05, 0.45) }, { yaw: 0.4 });
      kid({ ...head(f, 41, -1, -0.4, 0, -0.4) }, { yaw: -0.35 });
      man({ ...head(f, 81, -1, -0.45, 0, -0.45) }, { yaw: -0.4 });
      break;
    }
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity ----------
export const STATICS = [
  SOL.aabb(-1.15, 1.15, -6.7, -5.3, { h: 2.3, id: 'book', group: 'bookbox' }),
  SOL.aabb(-6.9, -4.3, -11.2, -9.8, { h: 2.6, id: 'stallL' }),
  SOL.aabb(4.6, 7.2, -10.7, -9.3, { h: 2.6, id: 'stallR' }),
  SOL.aabb(-11.9, -9.1, -5.2, -3.8, { h: 2.6, id: 'stallFL' }),
  SOL.aabb(9.4, 12.2, -4.2, -2.8, { h: 2.6, id: 'stallFR' }),
  SOL.circle(-6.8, -8.6, 0.09, { h: 4.6, id: 'poleBL' }),
  SOL.circle(6.8, -8.6, 0.09, { h: 4.6, id: 'poleBR' }),
  SOL.circle(-6.8, 0.5, 0.09, { h: 4.6, id: 'poleFL' }),
  SOL.circle(6.8, 0.5, 0.09, { h: 4.6, id: 'poleFR' }),
  SOL.circle(8.2, -15, 0.55, { h: 3.8, id: 'treeR' }),
  SOL.circle(-8.6, -17, 0.45, { h: 3.2, id: 'treeL' }),
  SOL.circle(-13, -20, 2.1, { h: 3.6, id: 'tentL' }),
  SOL.circle(13.5, -19, 2.1, { h: 3.6, id: 'tentR' }),
  SOL.circle(4, -24, 2.1, { h: 3.6, id: 'tentB' }),
  SOL.circle(BOARD_POS[0] - 2.08, BOARD_POS[2] - 0.08, 0.07, { h: 2.0, id: 'postL' }),
  SOL.circle(BOARD_POS[0] + 2.08, BOARD_POS[2] - 0.08, 0.07, { h: 2.0, id: 'postR' }),
];
export const WORLD = SOL.makeWorld(STATICS);
export const dynamicsAt = (f) => {
  const out = [];
  for (const a of castAt(f)) out.push(SOL.circle(a.x, a.z, a.r, { kind: 'dynamic', id: a.id, group: a.group || '' }));
  return out;
};
export const groundItemsAt = (f) => {
  const items = [];
  for (const a of castAt(f)) items.push({ id: a.id, y: a.y, ground: a.ground || 0, maxHover: 0.06 });
  return items;
};
