// Shot plan for "The Girl Who Lit a Lamp Under Water" — lampwater.
// Salted Mine V3 style + v4 ACTION CAMERA + Library v6 body + FULL
// UPGRADE (2026-11-19) + Abid's DYNAMIC CAMERA + DYNAMIC SCENE
// upgrade (2026-11-21): combined push-in + lateral arc moves, a
// crane/drone opening sweep, an underwater-style tracking descent
// that CROSSES THE WATERLINE with the bowl, a declared speed-ramp
// on the flame-survives payoff snapping into the ferryman's
// reaction, foreground parallax (reeds, boat edge, sparkle), and
// a living river (ripples, caustics, bobbing boats, swaying reeds,
// birds, drifting clouds, dancing flame-light). END RULE: the only
// performed line is L13 (mid-film, f1212-1307); the last quarter
// is narration only, all mouths shut.
// Voice stem: voice_final.wav — N1 voice (Muse TTS Confident
// Chime casper_1_25x, single narrator, speed 118, en), EXACTLY
// 60.000 s, 30 fps, TOTAL 1800. Beat map = timing.json (parent-
// supplied phrase boundaries). Scene changes ONLY at phrase
// boundaries. ONE set: a stone ghat on a river — the quay of the
// reference harbour set, the RIVER WEST (x < -3.4), cottages EAST.
// The action centre is the ghat slab at (-2.55, 3.9), at the
// water's edge. GRADES: Sunny Pop day -> Golden Hour evening on
// the L15 clause boundary. Boards and captions are never graded.
import { M, blinkAt, q, clamp, lerp, ramp, kf } from './motion.js';
import { buildRig, pushInCam, keysCam } from './camrig.js';
import { poseWindows, turnTrack, winkTrack, emoTrack, lifeAt, gripAt, gestureAt, stridePh } from './body.js';
import * as SOL from './solid.js';
import * as T from './toon.js';
import * as SPK from './speak.js';
import { SPEAK_DATA } from './speakdata.js';

export const FPS = 30, TOTAL = 1800, DECK = 0;
export const SHOTS = [
  { id: 'open', a: 0, b: 102, light: 'day' },
  { id: 'laugh', a: 103, b: 204, light: 'day' },
  { id: 'smile', a: 205, b: 295, light: 'day' },
  { id: 'insert', a: 296, b: 436, light: 'day' },
  { id: 'light', a: 437, b: 535, light: 'day' },
  { id: 'flame', a: 536, b: 624, light: 'day' },
  { id: 'lift', a: 625, b: 711, light: 'day' },
  { id: 'descend', a: 712, b: 818, light: 'day' },
  { id: 'trapped', a: 819, b: 951, light: 'day' },
  { id: 'payoff', a: 952, b: 1053, light: 'day' },
  { id: 'lean', a: 1054, b: 1158, light: 'day' },
  { id: 'leadin', a: 1159, b: 1211, light: 'day' },
  { id: 'line', a: 1212, b: 1318, light: 'day' },
  { id: 'coins', a: 1319, b: 1395, light: 'day' },
  { id: 'evening', a: 1396, b: 1503, light: 'gold' },
  { id: 'lamps', a: 1504, b: 1603, light: 'gold' },
  { id: 'hookboard', a: 1604, b: 1799, light: 'gold' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- geography ----------
export const BOARD_POS = [0.2, 2.0, -12.8];
export const SIGN_POS = BOARD_POS;
export const TUBE_POS = [-2.55, 0.16, 3.9]; // legacy export name: the ghat slab (lamp home)
export const LAMP_HOME = [-2.55, 0.16, 3.9];
export const MEERA_SPOT = [-1.55, 3.9];
export const gunAt = (f) => ({ k: 0, x: 0, y: 0, z: 0 });

// ---------- lights / mood grades ----------
export const LIGHTS = {
  day: { az: 205, el: 42, sky: '#bcd9e8', ground: '#5c6658', hemi: 0.82, sun: '#fff2d8', sunI: 1.22, fog: '#c3d5dd', fogNear: 55, fogFar: 230,
    skyTop: '#3f7fbc', skyHor: '#bfe0ea', sunDisc: '#fff3cf', sunSize: 0.010, sat: 1.12, vig: 0.27, shadowExt: 26, aurora: 0, gain: '#fdf6e8',
    waterDeep: '#14506e', waterShal: '#3d9db4', glint: '#ffe9b0' },
  evening: { az: 262, el: 13, sky: '#d9b48f', ground: '#5a5148', hemi: 0.55, sun: '#ffb469', sunI: 1.02, fog: '#d9c2a8', fogNear: 45, fogFar: 200,
    skyTop: '#4a6a9e', skyHor: '#ffb36b', sunDisc: '#ffcf8f', sunSize: 0.016, sat: 1.09, vig: 0.3, shadowExt: 26, aurora: 0, gain: '#ffe8c8',
    waterDeep: '#1d4258', waterShal: '#4a7d8c', glint: '#ffc98a' },
  morning: { az: 128, el: 24, sky: '#cfe0d8', ground: '#5f7050', hemi: 0.78, sun: '#ffdf9e', sunI: 1.14, fog: '#d5dfd2', fogNear: 50, fogFar: 220,
    skyTop: '#4f96c8', skyHor: '#ffe3b0', sunDisc: '#fff3cf', sunSize: 0.012, sat: 1.1, vig: 0.27, shadowExt: 26, aurora: 0, gain: '#fff0d0',
    waterDeep: '#175d7a', waterShal: '#3d9db4', glint: '#ffe9b0' },
  noon: { az: 172, el: 66, sky: '#cfe4ee', ground: '#66705c', hemi: 0.86, sun: '#ffffff', sunI: 1.42, fog: '#cfdde6', fogNear: 60, fogFar: 260,
    skyTop: '#2f6fb4', skyHor: '#cfe8f2', sunDisc: '#ffffff', sunSize: 0.009, sat: 1.06, vig: 0.24, shadowExt: 26, aurora: 0, gain: '#ffffff',
    waterDeep: '#12506e', waterShal: '#45a7c4', glint: '#ffffff' },
  after: { az: 215, el: 40, sky: '#c8d8de', ground: '#5f6a58', hemi: 0.72, sun: '#ffedc4', sunI: 1.12, fog: '#ccd8da', fogNear: 55, fogFar: 230,
    skyTop: '#4a84b4', skyHor: '#d8e6e2', sunDisc: '#ffedbe', sunSize: 0.010, sat: 1.05, vig: 0.28, shadowExt: 26, aurora: 0, gain: '#fdf3da',
    waterDeep: '#1a4a5e', waterShal: '#3d8aa0', glint: '#ffe9b0' },
  sunset: { az: 264, el: 7, sky: '#c99a72', ground: '#4c443e', hemi: 0.5, sun: '#ff9a52', sunI: 1.08, fog: '#c7a58c', fogNear: 40, fogFar: 190,
    skyTop: '#3a4a72', skyHor: '#ff8a4a', sunDisc: '#ffb37a', sunSize: 0.02, sat: 1.12, vig: 0.32, shadowExt: 26, aurora: 0, gain: '#ffd9ae',
    waterDeep: '#27354e', waterShal: '#7a5a6a', glint: '#ff9a52' },
  storm: { az: 264, el: 22, sky: '#77828c', ground: '#3c4442', hemi: 0.62, sun: '#8a97a5', sunI: 0.5, fog: '#75808c', fogNear: 22, fogFar: 150,
    skyTop: '#2b333e', skyHor: '#6f6250', sunDisc: '#6a7682', sunSize: 0.006, sat: 0.88, vig: 0.36, shadowExt: 26, aurora: 0, gain: '#e4eaf2',
    waterDeep: '#101c26', waterShal: '#2c4250', glint: '#aebfd8' },
  gold: { az: 235, el: 30, sky: '#d8e4d2', ground: '#5f7050', hemi: 0.8, sun: '#ffd98c', sunI: 1.3, fog: '#e2dcc4', fogNear: 55, fogFar: 240,
    skyTop: '#4f96c8', skyHor: '#ffe9b8', sunDisc: '#fff3cf', sunSize: 0.013, sat: 1.14, vig: 0.26, shadowExt: 26, aurora: 0, gain: '#fff0d0',
    waterDeep: '#175d7a', waterShal: '#3d9db4', glint: '#ffe9b0' },
};
export const wallK = (f) => 0;
export const flashAt = (f) => 0;
export const expoMul = (f) => 1;
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

// ---------- generic keyframe track (smoothed steps between keys) ----------
const track = (keys) => (f) => {
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i][0]) {
      const [f0, v0] = keys[i - 1], [f1, v1] = keys[i];
      return lerp(v0, v1, smooth(clamp((f - f0) / (f1 - f0))));
    }
  }
  return keys[keys.length - 1][1];
};

// ---------- the lamp + bowl rig: the story in three tracks ----------
// The clay lamp sits on the ghat slab until the bowl covers it
// (f625-711); then lamp and bowl travel as ONE held-down unit —
// west over the edge and down through the waterline (f712-807) —
// and stay submerged, burning, for the rest of the film.
export const bowlX = track([[0, -2.0], [624, -2.0], [668, -2.38], [711, -2.55], [758, -3.28], [807, -3.85], [1799, -3.85]]);
export const bowlY = track([[0, 0.17], [624, 0.17], [668, 0.75], [711, 0.17], [758, -0.35], [807, -0.9], [1799, -0.9]]);
export const bowlZ = track([[0, 4.5], [624, 4.5], [672, 4.05], [711, 3.9], [1799, 3.9]]);
export const bowlK = (f) => (f < 625 ? 0 : f < 712 ? 1 : 2); // 0 aside, 1 over lamp, 2 submerged
export const lampAt = (f) => {
  if (f < 712) return [-2.55, 0.17, 3.9];
  return [bowlX(f), bowlY(f) - 0.02, bowlZ(f)];
};
export const flameK = (f) => (f < 478 ? 0 : f < 512 ? ramp(f, 478, 512) : f < 1396 ? 1 : f < 1604 ? 0.55 : 0.3);
export const bandK = (f) => (f < 730 ? 0 : f < 758 ? ramp(f, 730, 758) : f < 792 ? 1 - ramp(f, 758, 792) : 0);
export const bubbleK = (f) => (f < 786 ? 0 : f < 830 ? ramp(f, 786, 830) : f < 1000 ? 1 : f < 1053 ? 0.45 : 0);
export const boatLampK = (f) => (f < 1396 ? 0 : ramp(f, 1396, 1440));
export const gullK = (f) => (f < 218 || f > 292 ? 0 : clamp((f - 226) / 60));
export const seaAmpAt = (f) => (shotAt(f).light === 'gold' ? 0.17 : 0.14);
export const windK = track([[0, 0.3], [1395, 0.3], [1503, 0.22], [1799, 0.22]]);

// ---------- focus (DOF target per shot) ----------
const FOCUS = {
  open: () => [-1.55, 1.15, 3.9],
  laugh: () => [0.5, 1.35, 3.8],
  smile: () => [-1.55, 0.9, 3.9],
  insert: () => [-2.3, 0.3, 4.1],
  light: () => [-2.3, 0.5, 4.0],
  flame: () => [-2.55, 0.35, 3.9],
  lift: () => [-2.55, 0.6, 3.9],
  descend: (f) => [bowlX(f), bowlY(f), bowlZ(f)],
  trapped: () => [-3.85, -0.95, 3.9],
  payoff: () => [-3.85, -1.05, 3.9],
  lean: () => [0.35, 1.4, 2.9],
  leadin: () => [-1.55, 1.3, 3.9],
  line: () => [-1.55, 1.32, 3.9],
  coins: () => [-0.6, 1.0, 3.9],
  evening: () => [-5.8, 0.2, 1.5],
  lamps: () => [-5.45, 0.05, 1.3],
  hookboard: () => [0.2, 1.95, -12.8],
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id](f);

// ---------- cameras: v4 ACTION + DYNAMIC upgrade ----------
// Every move is COMBINED: push-in travels WITH a lateral arc
// (15-25 degrees around the subject), reveals ride a crane, and
// no shot sits still — reframe keys land at least every ~3.5 s.
// Head-width maths (card head ~0.61 m): % = 0.61 / (2*d*tan(fov/2)*0.5625).
const RIG_BY_ID = {
  // open: DYNAMIC OPENING — frame 0 Meera BIG (~42%) kneeling at
  // the slab with the lit lamp; the camera CRANES UP and sweeps
  // out over the river (drone-style, boats + sparkle below), then
  // DIVES back down the arc to the ghat two-shot by the cut.
  open: { cut: 'hard', raw: keysCam({ keys: [
    { f: 0, pos: [0.55, 1.5, 6.9], look: [-1.95, 1.0, 3.9], fov: 38 },
    { f: 34, pos: [-3.4, 2.6, 7.6], look: [-2.2, 0.7, 3.4], fov: 42, ease: 'smooth' },
    { f: 68, pos: [-5.6, 3.1, 4.2], look: [-1.4, 0.9, 3.6], fov: 43, ease: 'smooth' },
    { f: 102, pos: [-0.4, 1.6, 6.4], look: [-0.9, 1.15, 3.9], fov: 40, ease: 'surge' }] }) },
  // laugh: the ferrymen rock with laughter — push-in WITH a
  // 20-degree arc from their left to front three-quarter; the
  // oldest ferryman's face grows 45% -> 68%.
  laugh: { cut: 'hard', raw: keysCam({ keys: [
    { f: 103, pos: [-1.7, 1.55, 5.9], look: [0.45, 1.32, 3.7], fov: 38 },
    { f: 155, pos: [-0.9, 1.5, 5.15], look: [0.42, 1.36, 3.6], fov: 36, ease: 'surge' },
    { f: 204, pos: [-0.15, 1.48, 4.75], look: [0.38, 1.38, 3.45], fov: 35, ease: 'surge' }] }) },
  // smile: Meera lays her things out — a low tracking arc along
  // the slab, reeds parallaxing through the foreground (west edge).
  smile: { cut: 'hard', raw: keysCam({ keys: [
    { f: 205, pos: [-3.3, 1.05, 6.3], look: [-1.7, 0.85, 4.0], fov: 39 },
    { f: 252, pos: [-2.9, 1.0, 5.5], look: [-1.8, 0.82, 3.95], fov: 38, ease: 'smooth' },
    { f: 295, pos: [-2.5, 1.02, 4.9], look: [-1.9, 0.8, 3.9], fov: 37, ease: 'surge' }] }) },
  // insert: THE ITEMS fill 85-95% — a slow arc dolly across the
  // slab: clay lamp, cotton wick, oil spoon, the big glass bowl
  // pass through centre one by one as the line names them.
  insert: { cut: 'hard', raw: keysCam({ keys: [
    { f: 296, pos: [-3.35, 0.78, 5.15], look: [-2.62, 0.22, 4.02], fov: 31 },
    { f: 366, pos: [-3.2, 0.74, 4.95], look: [-2.42, 0.22, 4.12], fov: 31, ease: 'smooth' },
    { f: 436, pos: [-3.05, 0.72, 4.8], look: [-2.2, 0.24, 4.3], fov: 31, ease: 'surge' }] }) },
  // light: she pours the oil and lights the lamp — push-in with
  // arc onto her hands and the newborn flame; the flame's glow
  // takes over the frame's warm side.
  light: { cut: 'hard', raw: keysCam({ keys: [
    { f: 437, pos: [-3.6, 1.15, 5.9], look: [-2.4, 0.45, 4.0], fov: 37 },
    { f: 488, pos: [-3.35, 1.0, 5.3], look: [-2.48, 0.4, 3.95], fov: 35, ease: 'surge' },
    { f: 535, pos: [-3.2, 0.92, 5.0], look: [-2.52, 0.38, 3.92], fov: 34, ease: 'surge' }] }) },
  // flame: the tiny flame stands up straight — macro-feel push
  // THROUGH the arc, flame centre-frame, Meera's lit face soft
  // at frame-right; water sparkle sweeps the foreground.
  flame: { cut: 'hard', raw: keysCam({ keys: [
    { f: 536, pos: [-3.5, 0.85, 5.15], look: [-2.55, 0.34, 3.9], fov: 33 },
    { f: 580, pos: [-3.38, 0.8, 4.9], look: [-2.55, 0.35, 3.9], fov: 32, ease: 'smooth' },
    { f: 624, pos: [-3.28, 0.78, 4.72], look: [-2.55, 0.36, 3.9], fov: 32, ease: 'surge' }] }) },
  // lift: BOTH her hands raise the big bowl over the flame —
  // the camera arcs UNDER the rising bowl (low angle) and tilts
  // up with it; the glass catches the flame as it covers it.
  lift: { cut: 'hard', raw: keysCam({ keys: [
    { f: 625, pos: [-4.65, 1.0, 7.0], look: [-2.45, 0.5, 4.0], fov: 36 },
    { f: 668, pos: [-4.4, 1.1, 6.6], look: [-2.48, 0.6, 3.95], fov: 35, ease: 'smooth' },
    { f: 711, pos: [-4.2, 1.2, 6.3], look: [-2.5, 0.62, 3.92], fov: 34, ease: 'surge' }] }) },
  // descend: THE WATERLINE SHOT — the camera tracks DOWN with
  // the bowl, tilting as it goes, and CROSSES the surface with
  // it (ripple distortion band at the crossing, f730-792): it
  // ends BELOW the waterline, looking up at the trapped air.
  descend: { cut: 'hard', raw: keysCam({ keys: [
    { f: 712, pos: [-3.35, 1.0, 5.0], look: [-2.55, 0.55, 3.9], fov: 35 },
    { f: 758, pos: [-4.3, 0.35, 5.35], look: [-3.28, 0.0, 3.9], fov: 36, ease: 'smooth' },
    { f: 818, pos: [-5.45, -0.25, 5.6], look: [-3.85, -0.8, 3.9], fov: 37, ease: 'surge' }] }) },
  // trapped: UNDERWATER — the camera drifts in the blue-green
  // dark below the surface: water rises OUTSIDE the glass, the
  // air pocket holds INSIDE; bubbles leak from the rim and rise.
  trapped: { cut: 'hard', raw: keysCam({ keys: [
    { f: 819, pos: [-6.1, -0.15, 6.4], look: [-3.85, -0.82, 3.9], fov: 37 },
    { f: 885, pos: [-5.9, -0.22, 6.2], look: [-3.85, -0.88, 3.9], fov: 36, ease: 'smooth' },
    { f: 951, pos: [-5.75, -0.3, 6.0], look: [-3.85, -0.92, 3.9], fov: 35, ease: 'surge' }] }) },
  // payoff: THE FLAME BURNS UNDER WATER — DECLARED SPEED RAMP:
  // the reveal plays SLOW (~0.5x feel: long, barely-moving push
  // f952-1032), golden beneath the ripples; then the last frames
  // tighten fast, snapping into the ferryman's reaction (kick
  // declared at f1054).
  payoff: { cut: 'hard', raw: keysCam({ keys: [
    { f: 952, pos: [-5.95, -0.15, 6.2], look: [-3.85, -0.88, 3.9], fov: 34 },
    { f: 1032, pos: [-5.85, -0.17, 6.1], look: [-3.85, -0.9, 3.9], fov: 33, ease: 'smooth' },
    { f: 1053, pos: [-5.8, -0.18, 6.05], look: [-3.85, -0.92, 3.9], fov: 32, ease: 'surge' }] }) },
  // lean: SNAP REACTION — a 15-frame PUNCH onto the oldest
  // ferryman as he leans so far over his cap nearly falls in:
  // his face 46% -> 72%+, then the arc settles front three-quarter.
  lean: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1054, pos: [-1.6, 1.5, 5.3], look: [0.3, 1.35, 3.0], fov: 38 },
    { f: 1070, pos: [-0.85, 1.42, 4.35], look: [0.33, 1.38, 2.95], fov: 35, ease: 'surge' },
    { f: 1115, pos: [-0.6, 1.4, 4.15], look: [0.35, 1.4, 2.92], fov: 34, ease: 'smooth' },
    { f: 1158, pos: [-0.45, 1.42, 4.0], look: [0.36, 1.4, 2.9], fov: 34, ease: 'surge' }] }) },
  // leadin: "Then Meera laughed and said —" a quick bright
  // push-in + arc onto her laughing face, handing into the line.
  leadin: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1159, pos: [-0.35, 1.5, 6.1], look: [-1.5, 1.28, 3.95], fov: 37 },
    { f: 1211, pos: [-0.15, 1.46, 5.55], look: [-1.53, 1.3, 3.92], fov: 35, ease: 'surge' }] }) },
  // line: THE LINE, performed at the ghat edge — push-in WITH
  // arc on Meera (55% -> 73%) as she answers the oldest ferryman;
  // he listens at frame-right, mouth shut, and his face changes.
  line: { cut: 'hard', raw: pushInCam({ subject: () => [-1.55, 0, 3.9], a: 1212, b: 1318, d0: 3.0, d1: 2.45, h0: 1.5, h1: 1.46, lookOff: [0, 1.5, 0], fov0: 37, fov1: 34,
    dir: () => [0.55, 0.84] }) },
  // coins: the bet is paid — ten coins hand to hand; the camera
  // arcs down to the hands (glint window f1330-1372), then lifts
  // back to the shaking heads.
  coins: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1319, pos: [-0.5, 1.45, 5.6], look: [-0.7, 1.15, 3.9], fov: 37 },
    { f: 1352, pos: [-0.75, 1.25, 5.2], look: [-0.75, 0.95, 3.9], fov: 35, ease: 'smooth' },
    { f: 1395, pos: [-0.6, 1.45, 5.45], look: [-0.65, 1.25, 3.9], fov: 36, ease: 'surge' }] }) },
  // evening: GOLDEN HOUR — a crane sweep over the river: every
  // boat now carries a lamp; the camera rides the sparkle path
  // toward the fleet (foreground boat edge parallax).
  evening: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1396, pos: [1.8, 2.6, 8.6], look: [-4.5, 0.6, 2.0], fov: 43 },
    { f: 1450, pos: [-0.6, 2.3, 7.2], look: [-5.2, 0.45, 1.4], fov: 42, ease: 'smooth' },
    { f: 1503, pos: [-2.2, 2.0, 6.2], look: [-5.6, 0.35, 1.0], fov: 41, ease: 'surge' }] }) },
  // lamps: one boat's strange passenger CLOSE — a little lamp
  // burning inside its bowl of air on the deck, reflections
  // shimmering; a ferryman stands aboard, quiet.
  lamps: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1504, pos: [-3.1, 1.15, 3.4], look: [-5.45, 0.05, 1.3], fov: 38 },
    { f: 1555, pos: [-3.35, 1.0, 3.1], look: [-5.45, 0.02, 1.3], fov: 36, ease: 'smooth' },
    { f: 1603, pos: [-3.5, 0.92, 2.9], look: [-5.45, 0.0, 1.3], fov: 35, ease: 'surge' }] }) },
  // hookboard: the film ends on a CHARACTER BEAT at the quay's
  // north end — Meera kneels in the foreground pointing up at
  // the hook board (80-88% of frame width, whole panel inside
  // with margins, full opacity to the literal last frame), the
  // ferrymen beside her, mouths shut. Slow push + arc reframe.
  hookboard: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1604, pos: [0.6, 2.05, -2.3], look: [0.2, 1.94, -12.8], fov: 44 },
    { f: 1700, pos: [0.52, 2.0, -2.75], look: [0.2, 1.95, -12.8], fov: 43.5, ease: 'smooth' },
    { f: 1799, pos: [0.48, 1.97, -3.15], look: [0.2, 1.95, -12.8], fov: 43, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: 1054, a: 0.22 }],
  sigma: 2.3, fovSigma: 1.6,
});
export const camAt = (f) => ({ ...RIG.camAt(f), flash: 0 });
export const RIG_META = {
  kicks: RIG.declared.kicks, hardCuts: RIG.declared.hardCuts,
  blends: SHOTS.filter((s) => RIG_BY_ID[s.id].cut === 'blend').map((s) => ({ a: s.a - Math.floor(RIG_BY_ID[s.id].blend / 2), b: s.a + Math.ceil(RIG_BY_ID[s.id].blend / 2) })),
  whips: RIG.declared.whips,
  samples: RIG.samples,
};
const CINF = { open: 2.2, laugh: 2.8, smile: 2.6, insert: 3.2, light: 3.0, flame: 3.2, lift: 3.0, descend: 2.6, trapped: 2.8, payoff: 3.0, lean: 3.2, leadin: 3.0, line: 3.2, coins: 2.8, evening: 1.5, lamps: 2.4, hookboard: 1.3 };
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), hp = heroPosAt(f);
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf: CINF[S.id] || 2.2 };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const lampByShot = { open: 0.25, laugh: 0.2, smile: 0.2, insert: 0.2, light: 0.35, flame: 0.4, lift: 0.4, descend: 0.4, trapped: 0.4, payoff: 0.4, lean: 0.3, leadin: 0.25, line: 0.25, coins: 0.3, evening: 0.85, lamps: 0.9, hookboard: 0.4 };
  const lp = lampAt(f);
  return {
    always: 1,
    hookK: S.id === 'hookboard' ? smooth(ramp(f, 1610, 1640)) : 0,
    tubeK: 0.3, chalkK: 0, gullK: gullK(f), sinkK: 0, wallK: 0, rainK: 0,
    seaK: seaAmpAt(f),
    windK: windK(f),
    blueK: 0,
    lampK: lampByShot[S.id] ?? 0.2,
    glintK: (S.id === 'coins' && f >= 1330 && f <= 1372) ? smooth(ramp(f, 1330, 1342)) * (1 - smooth(ramp(f, 1360, 1372))) : 0,
    lampX: lp[0], lampY: lp[1], lampZ: lp[2],
    bowlX: bowlX(f), bowlY: bowlY(f), bowlZ: bowlZ(f), bowlK: bowlK(f),
    flameK: flameK(f), bandK: bandK(f), bubbleK: bubbleK(f), boatLampK: boatLampK(f),
  };
};
export const fxProfileAt = (f) => ({ moteRate: 0.05, blastRate: 0, sparkRate: worldAt(f).glintK, steamRate: 0, shimmerRate: 0 });
export const fxAt = () => [];

// ---------- cast ----------
// NO card tint in any light — faces stay pure white, costume
// colours flat and saturated (the reference's rule).
const tintFor = () => '#ffffff';
export const OUTFITS = {
  meera: { jacket: '#c8543c', dress: '#c8543c', pants: '#7a3b2e', boots: '#2a1c12', hat: 'hair', hair: '#1c1410', skin: '#fbf7ef' },
  old: { jacket: '#4a5d7a', pants: '#33404f', boots: '#14100c', hat: 'cap', cap: '#5d4a2f', skin: '#fbf7ef', moustache: '#d8d2c4', bigMoustache: true },
  ferryA: { jacket: '#b3543a', pants: '#4a3626', boots: '#241a12', hat: 'cap', cap: '#7a2c1e', skin: '#fbf7ef' },
  ferryB: { jacket: '#c8a03c', pants: '#3c3a40', boots: '#241a12', hat: 'hair', hair: '#14100c', skin: '#fbf7ef', moustache: '#2a201a' },
  ferryC: { jacket: '#38604a', pants: '#5a4632', boots: '#3a2410', hat: 'cap', cap: '#2f5d8a', skin: '#fbf7ef' },
};
// Emotion morphs at story beats (body.js emoTrack).
const emoMeera = emoTrack(T.faceP, 'smile', [
  [103, 'smile', 8], [205, 'smile', 8], [437, 'determined', 8], [536, 'wonder', 8], [625, 'determined', 8],
  [819, 'wonder', 8], [1054, 'smile', 8], [1159, 'laugh', 8], [1212, 'smile', 8], [1319, 'proud', 8], [1604, 'grin', 8],
]);
const emoOld = emoTrack(T.faceP, 'stern', [
  [103, 'laugh', 8], [205, 'grin', 8], [1054, 'shock', 6], [1159, 'thinking', 8], [1212, 'stern', 6], [1272, 'thinking', 8],
  [1319, 'smile', 8], [1604, 'smile', 8],
]);
const emoFA = emoTrack(T.faceP, 'neutral', [
  [103, 'laugh', 8], [1054, 'shock', 6], [1319, 'smile', 8], [1604, 'smile', 8],
]);
const emoFB = emoTrack(T.faceP, 'neutral', [
  [103, 'grin', 8], [1054, 'wonder', 8], [1504, 'smile', 8],
]);
const emoFC = emoTrack(T.faceP, 'smile', []);
// Continuous life per character (body.js lifeAt).
const lifeMeera = lifeAt({ seed: 21 }), lifeOld = lifeAt({ seed: 51 }), lifeFA = lifeAt({ seed: 31 }),
  lifeFB = lifeAt({ seed: 41 }), lifeFC = lifeAt({ seed: 61 });
const micro = (f, seed) => 1.1 * Math.sin((f + seed * 5) * 0.037 + 1);
const H2 = (life, f, seed, o = {}) => ({
  headTilt: q((o.ht || 0) + micro(f, seed) + life(f).sway, 1),
  look: q(o.look || 0, 2), lookY: q(o.lookY || 0, 2), facing: q(o.facing || 0, 2),
  squash: q(o.squash || 0, 2), tilt: q((o.tilt || 0) + life(f).tilt, 1),
  breath: Math.round(life(f).breath / 6) * 6,
});
const noBlush = (P) => { const P2 = { ...P, cheek: Math.max(P.cheek ?? 0, 0.55) }; P2.blush = 0; P2.openL = Math.min(1, (P2.openL ?? 0.85) * 1.45); P2.openR = Math.min(1, (P2.openR ?? 0.85) * 1.45); return P2; };
const SPEAK = SPK.makeSpeakPlayer(SPEAK_DATA);
// dialogue gesture: Meera's free (right) hand talks with the
// voice — stresses on "never" (f1231), "air" (f1280) and
// "breathes" (f1301).
const gestMeera = gestureAt([{ a: 1212, b: 1307, beats: [1231, 1280, 1301], base: 0.42, amp: 0.18 }]);

export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, z, extra = {}) => {
    out.push({ id, x, y: extra.y ?? 0, z, r: extra.r || 0.32, ground: extra.ground ?? 0,
      actor: (T) => ({ key: 'smx' + JSON.stringify(o) + JSON.stringify(opts) + (extra.y ?? 0),
        draw: (p) => { T.bodyFront(p, o, opts); if (extra.overlay) extra.overlay(p); },
        x, y: extra.y ?? 0, z, ground: extra.ground ?? 0, tint, ...extra }) });
  };
  const MP = noBlush(emoMeera.at(f)), OP = noBlush(emoOld.at(f)), FAP = noBlush(emoFA.at(f)),
    FBP = noBlush(emoFB.at(f)), FCP = noBlush(emoFC.at(f));
  const meeraStd = (opts, x, z, extra = {}) => std('meera', OUTFITS.meera, { expr: 'smile', exprP: MP, blink: blinkAt(f, 20), seed: 21, ...opts }, x, z, { yaw: -0.15, ...extra });
  const oldStd = (opts, x, z, extra = {}) => std('old', OUTFITS.old, { expr: 'smile', exprP: OP, blink: blinkAt(f, 51), seed: 51, ...opts }, x, z, { yaw: 0.15, ...extra });
  const faStd = (opts, x, z, extra = {}) => std('ferryA', OUTFITS.ferryA, { expr: 'smile', exprP: FAP, blink: blinkAt(f, 31), seed: 31, ...opts }, x, z, { yaw: 0, ...extra });
  const fbStd = (opts, x, z, extra = {}) => std('ferryB', OUTFITS.ferryB, { expr: 'smile', exprP: FBP, blink: blinkAt(f, 41), seed: 41, ...opts }, x, z, { yaw: 0, ...extra });

  switch (S.id) {
    case 'open': {
      // frame 0: BIG, mid-action — kneeling at the slab, both
      // hands cupped round the lit lamp she has just set down;
      // the ferrymen watch from the arc behind her.
      meeraStd({ mode: 'kneel', prop: ['point', 0.72], propL: ['point', 0.72],
        ...H2(lifeMeera, f, 21, { ht: 2.5, look: -0.3, lookY: 0.32, facing: -0.3 }) }, -1.55, 3.9, { yaw: -0.3 });
      oldStd({ mode: 'stand', ...H2(lifeOld, f, 51, { ht: -1.5, look: -0.4, lookY: 0.05, facing: -0.4 }) }, 0.35, 2.9, { yaw: -0.35 });
      faStd({ mode: 'stand', ...H2(lifeFA, f, 31, { ht: -1, look: -0.45, lookY: 0, facing: -0.45 }) }, 1.05, 4.6, { yaw: -0.4 });
      fbStd({ mode: 'stand', ...H2(lifeFB, f, 41, { ht: -1, look: 0.3, lookY: 0, facing: 0.3 }) }, 0.1, 5.35, { yaw: 0.25 });
      break;
    }
    case 'laugh': {
      // the ferrymen rock with laughter — bellies, pointing,
      // the oldest slapping his knee; Meera small at frame-left,
      // smiling, saying nothing.
      oldStd({ mode: 'stand', prop: ['point', q(0.55 + 0.2 * Math.sin(f * 0.14), 2)],
        ...H2(lifeOld, f, 51, { ht: q(kf([[103, -4], [130, -1], [160, -4.5], [204, -2]], f), 1), look: -0.4, lookY: -0.05, facing: -0.35,
          squash: q(kf([[103, 0], [122, 0.09], [140, 0.02], [158, 0.09], [204, 0.03]], f), 2) }) }, 0.35, 2.9, { yaw: -0.3 });
      faStd({ mode: 'stand', propL: ['point', 0.65],
        ...H2(lifeFA, f, 31, { ht: -3.5, look: -0.35, lookY: 0, facing: -0.3, squash: q(kf([[103, 0.02], [135, 0.1], [170, 0.02], [204, 0.05]], f), 2) }) }, 1.05, 4.6, { yaw: -0.25 });
      fbStd({ mode: 'stand', ...H2(lifeFB, f, 41, { ht: -3, look: -0.3, lookY: 0, facing: -0.25 }) }, 0.1, 5.35, { yaw: -0.2 });
      meeraStd({ mode: 'kneel', ...H2(lifeMeera, f, 21, { ht: -1.5, look: 0.45, lookY: -0.1, facing: 0.4 }) }, -1.55, 3.9, { yaw: 0.35 });
      break;
    }
    case 'smile': {
      // she just smiles and lays her things out on the stone
      // ghat — hands moving item to item along the slab.
      meeraStd({ mode: 'kneel', prop: ['point', q(kf([[205, 0.5], [240, 0.78], [270, 0.6], [295, 0.72]], f), 2)], propL: ['point', 0.62],
        ...H2(lifeMeera, f, 21, { ht: 3, look: -0.15, lookY: 0.42, facing: -0.15 }) }, -1.55, 3.9, { yaw: -0.2 });
      oldStd({ mode: 'stand', ...H2(lifeOld, f, 51, { ht: -1, look: -0.45, lookY: 0.1, facing: -0.42 }) }, 0.35, 2.9, { yaw: -0.38 });
      faStd({ mode: 'stand', ...H2(lifeFA, f, 31, { ht: -1, look: -0.4, lookY: 0.05, facing: -0.4 }) }, 1.05, 4.6, { yaw: -0.35 });
      break;
    }
    case 'insert': break; // the things on the slab are the actors here
    case 'light': {
      // she pours the oil (right hand tips), sets the wick, and
      // at "lit" (f478) both hands cup the newborn flame.
      meeraStd({ mode: 'kneel', prop: ['point', q(kf([[437, 0.82], [470, 0.7], [500, 0.74], [535, 0.72]], f), 2)], propL: ['point', q(kf([[437, 0.4], [478, 0.62], [535, 0.7]], f), 2)],
        ...H2(lifeMeera, f, 21, { ht: 3.2, look: -0.25, lookY: 0.45, facing: -0.25 }) }, -1.55, 3.9, { yaw: -0.28 });
      oldStd({ mode: 'stand', ...H2(lifeOld, f, 51, { ht: -1, look: -0.5, lookY: 0.15, facing: -0.45 }) }, 0.35, 2.9, { yaw: -0.4 });
      break;
    }
    case 'flame': {
      // the flame stands up straight — Meera behind it, wonder
      // on her face, hands still cupped round the lamp.
      meeraStd({ mode: 'kneel', prop: ['point', 0.7], propL: ['point', 0.7],
        ...H2(lifeMeera, f, 21, { ht: 1.5, look: -0.2, lookY: 0.3, facing: -0.2 }) }, -1.55, 3.9, { yaw: -0.22 });
      break;
    }
    case 'lift': {
      // BOTH hands on the big bowl, lifting it over the flame —
      // arms rise with the bowl track; her body leans into the
      // weight (tilt + dip as it comes up).
      meeraStd({ mode: 'kneel', prop: ['point', q(kf([[625, 0.55], [668, 0.8], [711, 0.86]], f), 2)], propL: ['point', q(kf([[625, 0.55], [668, 0.8], [711, 0.86]], f), 2)],
        ...H2(lifeMeera, f, 21, { ht: 2, look: -0.3, lookY: q(kf([[625, 0.35], [711, 0.05]], f), 2), facing: -0.3,
          tilt: q(kf([[625, 0], [668, 2.5], [711, 1.2]], f), 1) }) }, -1.55, 3.9, { yaw: -0.3 });
      oldStd({ mode: 'stand', ...H2(lifeOld, f, 51, { ht: -2, look: -0.5, lookY: 0.1, facing: -0.45 }) }, 0.35, 2.9, { yaw: -0.4 });
      faStd({ mode: 'stand', ...H2(lifeFA, f, 31, { ht: -1.5, look: -0.45, lookY: 0.05, facing: -0.42 }) }, 1.05, 4.6, { yaw: -0.38 });
      break;
    }
    case 'descend': {
      // she pushes the bowl down into the river — kneeling at
      // the very edge, both arms reaching down with it, body
      // leaning out over the water (honest weight, held pose).
      meeraStd({ mode: 'kneel', prop: ['point', 0.88], propL: ['point', 0.88],
        ...H2(lifeMeera, f, 21, { ht: 4, look: -0.35, lookY: 0.5, facing: -0.35, tilt: 3 }) }, -1.98, 3.9, { yaw: -0.35 });
      oldStd({ mode: 'stand', ...H2(lifeOld, f, 51, { ht: -2.5, look: -0.55, lookY: 0.25, facing: -0.5 }) }, 0.0, 2.95, { yaw: -0.45 });
      faStd({ mode: 'stand', ...H2(lifeFA, f, 31, { ht: -2, look: -0.5, lookY: 0.2, facing: -0.48 }) }, 0.75, 4.55, { yaw: -0.42 });
      break;
    }
    case 'trapped': {
      // above the surface she watches, hands still on the bowl
      // under the water; the camera is below with the flame.
      meeraStd({ mode: 'kneel', prop: ['point', 0.86], propL: ['point', 0.86],
        ...H2(lifeMeera, f, 21, { ht: 3.5, look: -0.3, lookY: 0.48, facing: -0.3, tilt: 2.5 }) }, -1.98, 3.9, { yaw: -0.32 });
      oldStd({ mode: 'stand', ...H2(lifeOld, f, 51, { ht: -2, look: -0.55, lookY: 0.3, facing: -0.5 }) }, 0.0, 2.95, { yaw: -0.45 });
      break;
    }
    case 'payoff': break; // the flame under water is the actor here
    case 'lean': {
      // he leans SO far over the water his cap nearly falls in —
      // head plunges forward and down through the shot; Meera
      // watches him, delighted and quiet.
      oldStd({ mode: 'stand', prop: ['point', 0.45], propL: ['point', 0.45],
        ...H2(lifeOld, f, 51, { ht: q(kf([[1054, -2], [1090, 3.5], [1120, 6.5], [1158, 5]], f), 1), look: -0.5, lookY: q(kf([[1054, 0], [1120, 0.55], [1158, 0.45]], f), 2), facing: -0.45,
          tilt: q(kf([[1054, 0], [1120, 7], [1158, 5.5]], f), 1) }) }, 0.35, 2.9, { yaw: -0.42 });
      meeraStd({ mode: 'kneel', ...H2(lifeMeera, f, 21, { ht: -2, look: 0.5, lookY: -0.05, facing: 0.45 }) }, -1.55, 3.9, { yaw: 0.4 });
      faStd({ mode: 'stand', ...H2(lifeFA, f, 31, { ht: -2.5, look: -0.4, lookY: 0.2, facing: -0.4 }) }, 1.05, 4.6, { yaw: -0.35 });
      break;
    }
    case 'leadin': {
      meeraStd({ mode: 'kneel', ...H2(lifeMeera, f, 21, { ht: -2.5, look: 0.4, lookY: -0.1, facing: 0.35,
        squash: q(kf([[1159, 0], [1180, 0.07], [1211, 0.02]], f), 2) }) }, -1.55, 3.9, { yaw: 0.3 });
      oldStd({ mode: 'stand', ...H2(lifeOld, f, 51, { ht: -1, look: -0.45, lookY: 0, facing: -0.42 }) }, 0.35, 2.9, { yaw: -0.38 });
      break;
    }
    case 'line': {
      // THE LINE, performed at the ghat edge: her mouth is the
      // stem's (speak.js); her right hand gestures on the stress
      // words; the oldest ferryman listens — mouth shut — and at
      // "air" his certainty cracks into thought.
      const sp = SPEAK.at(f);
      const speakP = SPK.applySpeak({ ...MP, cheek: Math.max(MP.cheek ?? 0, 0.55) }, sp);
      speakP.blush = 0; speakP.openL = Math.min(1, (speakP.openL ?? 0.85) * 1.45); speakP.openR = Math.min(1, (speakP.openR ?? 0.85) * 1.45);
      std('meera', OUTFITS.meera, { expr: 'smile', exprP: speakP, blink: blinkAt(f, 20), seed: 21,
        prop: ['point', q(gestMeera(f).k, 2)],
        headTilt: q((sp.nod || 0) + micro(f, 21) - 1.5, 1), look: q(0.35, 2), lookY: q(-0.02, 2), facing: q(0.3, 2),
        squash: 0, tilt: q(lifeMeera(f).tilt + lifeMeera(f).sway, 1), breath: Math.round(lifeMeera(f).breath / 6) * 6 },
        -1.55, 3.9, { yaw: 0.28 });
      oldStd({ mode: 'stand', ...H2(lifeOld, f, 51, { ht: q(kf([[1212, -1.5], [1272, -0.5], [1318, -1]], f), 1), look: -0.5, lookY: 0, facing: -0.45 }) }, 0.35, 2.9, { yaw: -0.4 });
      break;
    }
    case 'coins': {
      // ten coins, hand to hand: his arm comes out with the
      // coins (f1330), she receives with both hands; heads shake.
      oldStd({ mode: 'stand', prop: ['point', q(kf([[1319, 0.3], [1340, 0.78], [1370, 0.6], [1395, 0.4]], f), 2)],
        ...H2(lifeOld, f, 51, { ht: q(kf([[1319, -1.5], [1352, 1], [1378, -2.5], [1395, -1.5]], f), 1), look: -0.45, lookY: 0.15, facing: -0.42 }) }, 0.35, 2.9, { yaw: -0.38 });
      meeraStd({ mode: 'kneel', prop: ['point', q(kf([[1319, 0.35], [1352, 0.6], [1395, 0.5]], f), 2)], propL: ['point', q(kf([[1319, 0.35], [1352, 0.6], [1395, 0.5]], f), 2)],
        ...H2(lifeMeera, f, 21, { ht: -1.5, look: 0.45, lookY: 0.1, facing: 0.4 }) }, -1.55, 3.9, { yaw: 0.35 });
      faStd({ mode: 'stand', ...H2(lifeFA, f, 31, { ht: q(kf([[1319, -1], [1360, -3], [1395, -1.5]], f), 1), look: -0.4, lookY: 0, facing: -0.38 }) }, 1.05, 4.6, { yaw: -0.35 });
      break;
    }
    case 'evening': {
      // the whole ghat in golden light, small in the wide: the
      // three of them watch the fleet take its lamps aboard.
      meeraStd({ mode: 'stand', ...H2(lifeMeera, f, 21, { ht: -2, look: -0.55, lookY: -0.1, facing: -0.5 }) }, -1.55, 3.9, { yaw: -0.45 });
      oldStd({ mode: 'stand', ...H2(lifeOld, f, 51, { ht: -2, look: -0.58, lookY: -0.08, facing: -0.52 }) }, -0.6, 3.1, { yaw: -0.48 });
      faStd({ mode: 'stand', ...H2(lifeFA, f, 31, { ht: -1.5, look: -0.5, lookY: -0.05, facing: -0.48 }) }, 0.15, 4.7, { yaw: -0.42 });
      break;
    }
    case 'lamps': {
      // aboard the blue boat: a ferryman stands quiet beside
      // the lamp-in-its-bowl on the deck (boat deck ~y-0.5).
      std('ferryB', OUTFITS.ferryB, { expr: 'smile', exprP: FBP, blink: blinkAt(f, 41), seed: 41, mode: 'stand',
        ...H2(lifeFB, f, 41, { ht: -2, look: -0.2, lookY: 0.25, facing: -0.2 }) }, -5.15, 1.15, { yaw: -0.2, y: -0.52, ground: -0.52 });
      break;
    }
    case 'hookboard': {
      // the film ends on a CHARACTER BEAT — Meera kneels in the
      // foreground pointing up at the hook board as it rises
      // behind her; her head stays below the board's text band.
      meeraStd({ mode: 'kneel', prop: ['point', 0.32],
        ...H2(lifeMeera, f, 21, { ht: -2.5, look: 0.45, lookY: -0.35, facing: 0.45 }) }, -0.55, -9.95, { yaw: 0.5 });
      oldStd({ mode: 'stand', ...H2(lifeOld, f, 51, { ht: -2.5, look: -0.4, lookY: -0.4, facing: -0.4 }) }, 1.3, -10.75, { yaw: -0.35 });
      faStd({ mode: 'stand', ...H2(lifeFA, f, 31, { ht: -2.5, look: -0.45, lookY: -0.35, facing: -0.45 }) }, 0.95, -10.15, { yaw: -0.4, s: 0.85 });
      break;
    }
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity ----------
export const STATICS = [
  SOL.aabb(4.6, 12.4, 5.6, 12.4, { h: 3.2, id: 'maraCottage' }),
  SOL.aabb(5.4, 13.4, 1.9, 6.5, { h: 3, id: 'villageA' }),
  SOL.aabb(5.6, 13.6, -3.4, 1.8, { h: 3, id: 'villageB' }),
  SOL.aabb(4.6, 12.4, -7.6, -1.6, { h: 3.4, id: 'office' }),
  SOL.circle(4.35, 10.55, 0.09, { h: 2.4, id: 'cottagePost' }),
  SOL.circle(-2.95, 6, 0.11, { h: 0.6, id: 'bollard1' }),
  SOL.circle(-2.95, -0.5, 0.11, { h: 0.6, id: 'bollard2' }),
  SOL.circle(-2.95, -7, 0.11, { h: 0.6, id: 'bollard3' }),
  SOL.circle(2.55, -3.3, 0.3, { h: 1.1, id: 'lectern' }),
  SOL.circle(-0.75, -12.9, 0.07, { h: 2, id: 'boardPostL' }),
  SOL.circle(1.15, -12.9, 0.07, { h: 2, id: 'boardPostR' }),
  SOL.circle(-2.8, -4.2, 0.08, { h: 2.6, id: 'lampPost' }),
  SOL.circle(-2.62, 3.9, 0.26, { h: 0.18, id: 'ghatSlab' }),
];
export const WORLD = SOL.makeWorld(STATICS);
export const dynamicsAt = (f) => {
  const out = [];
  for (const a of castAt(f)) out.push(SOL.circle(a.x, a.z, a.r, { kind: 'dynamic', id: a.id, group: '' }));
  return out;
};
export const groundItemsAt = (f) => {
  const items = [];
  for (const a of castAt(f)) items.push({ id: a.id, y: a.y, ground: a.ground ?? 0, maxHover: 0.06 });
  return items;
};
