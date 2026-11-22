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
import { smoothSeries } from './camrig.js';
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
export const WATER_Y = -0.85;
export const gunAt = (f) => ({ k: 0, x: 0, y: 0, z: 0 });

// ---------- lights / mood grades ----------
export const LIGHTS = {
  day: { az: 205, el: 42, sky: '#aed6f2', ground: '#7a6a42', hemi: 1.05, sun: '#fff2d8', sunI: 1.58, fog: '#8fc3e6', fogNear: 55, fogFar: 230,
    skyTop: '#2a68cc', skyHor: '#8ec9ee', sunDisc: '#fff3cf', sunSize: 0.010, sat: 1.34, vig: 0.18, shadowExt: 26, aurora: 0, gain: '#fdf6e8', lift: '#171009',
    waterDeep: '#256a8e', waterShal: '#5db1dc', glint: '#ffe9b0' },
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
  gold: { az: 235, el: 30, sky: '#e8c9a0', ground: '#7a5c38', hemi: 0.95, sun: '#ffd98c', sunI: 1.45, fog: '#eecfa0', fogNear: 55, fogFar: 240,
    skyTop: '#2f63ac', skyHor: '#ffc987', sunDisc: '#ffdf9e', sunSize: 0.013, sat: 1.36, vig: 0.2, shadowExt: 26, aurora: 0, gain: '#fff0d0', lift: '#171009',
    waterDeep: '#1f5066', waterShal: '#3f8fc4', glint: '#ffc98a' },
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

// ---------- cameras: PROOF compound camera, ported to all 17 shots ----------
// lampwater-v2 (2026-11-22): the lampwater-proof camrig approach —
// every shot layers >=2 simultaneous moves on a flow() ease whose
// velocity NEVER reaches zero (v = 1 - a*cos(2*pi*u) in [1-a, 1+a]),
// plus handheld micro-motion and a breathing roll, so the camera
// is still mid-move on every shot's last frame. Endpoints are the
// original build's proven R2 framings; descend/trapped/payoff/lean
// keep the proof's exact analytic moves (waterline dive, underwater
// drift, declared payoff speed-ramp, snap reaction + declared
// kick). A light Gaussian finish (sigma 1.8, breaks at the cuts)
// irons key-joint jerk without touching the framings.
const flow = (u, a = 0.5) => u - a * Math.sin(2 * Math.PI * u) / (2 * Math.PI);
const clamp01 = (v) => clamp(v, 0, 1);
const hh = (f, amp = 0.016) => [
  amp * Math.sin(f * 0.113 + 1.3) + amp * 0.6 * Math.sin(f * 0.041 + 0.7),
  amp * 0.7 * Math.sin(f * 0.097 + 4.1) + amp * 0.5 * Math.sin(f * 0.053 + 2.9),
  amp * 0.8 * Math.sin(f * 0.089 + 2.2),
];
const hhLook = (f, amp = 0.02) => [
  amp * Math.sin(f * 0.101 + 5.2), amp * 0.8 * Math.sin(f * 0.087 + 0.4), amp * 0.6 * Math.sin(f * 0.073 + 3.3),
];
const rampWarp = (u) => (u < 0.55 ? 0.28 * (u / 0.55) : 0.28 + 0.72 * Math.pow((u - 0.55) / 0.45, 1.25));
// keyed compound move: x rides a faster flow phase than y/z, so
// arc, height and dolly never peak together.
const keyCam = (keys) => (f) => {
  let i = 0;
  while (i < keys.length - 2 && f > keys[i + 1][0]) i++;
  const [f0, p0, l0, v0] = keys[i], [f1, p1, l1, v1] = keys[i + 1];
  const u = clamp01((f - f0) / Math.max(1, f1 - f0)), e = flow(u, 0.45), e2 = flow(u, 0.62);
  return {
    pos: [lerp(p0[0], p1[0], e2), lerp(p0[1], p1[1], e), lerp(p0[2], p1[2], e)],
    look: [lerp(l0[0], l1[0], e), lerp(l0[1], l1[1], e2), lerp(l0[2], l1[2], e)],
    fov: lerp(v0, v1, e),
  };
};
const CAM_BY_ID = {
  open: keyCam([[0, [0.55, 1.5, 6.9], [-1.95, 1.0, 3.9], 38], [34, [-3.4, 2.6, 7.6], [-2.2, 0.7, 3.4], 42], [68, [-5.6, 3.1, 4.2], [-1.4, 0.9, 3.6], 43], [102, [-0.4, 1.6, 6.4], [-0.9, 1.15, 3.9], 40]]),
  laugh: keyCam([[103, [-1.7, 1.55, 5.9], [0.45, 1.32, 3.7], 38], [155, [-0.9, 1.5, 5.15], [0.42, 1.36, 3.6], 36], [204, [-0.15, 1.48, 4.75], [0.38, 1.38, 3.45], 35]]),
  smile: keyCam([[205, [-3.3, 1.05, 6.3], [-1.7, 0.85, 4.0], 39], [252, [-2.9, 1.0, 5.5], [-1.8, 0.82, 3.95], 38], [295, [-2.5, 1.02, 4.9], [-1.9, 0.8, 3.9], 37]]),
  insert: keyCam([[296, [-3.35, 0.78, 5.15], [-2.62, 0.22, 4.02], 31], [366, [-3.2, 0.74, 4.95], [-2.42, 0.22, 4.12], 31], [436, [-3.05, 0.72, 4.8], [-2.2, 0.24, 4.3], 31]]),
  light: keyCam([[437, [-3.6, 1.15, 5.9], [-2.4, 0.45, 4.0], 37], [488, [-3.35, 1.0, 5.3], [-2.48, 0.4, 3.95], 35], [535, [-3.2, 0.92, 5.0], [-2.52, 0.38, 3.92], 34]]),
  flame: keyCam([[536, [-3.5, 0.85, 5.15], [-2.55, 0.34, 3.9], 33], [580, [-3.38, 0.8, 4.9], [-2.55, 0.35, 3.9], 32], [624, [-3.28, 0.78, 4.72], [-2.55, 0.36, 3.9], 32]]),
  lift: keyCam([[625, [-4.65, 1.0, 7.0], [-2.45, 0.5, 4.0], 36], [668, [-4.4, 1.1, 6.6], [-2.48, 0.6, 3.95], 35], [711, [-4.2, 1.2, 6.3], [-2.5, 0.62, 3.92], 34]]),
  leadin: keyCam([[1159, [-0.35, 1.5, 6.1], [-1.5, 1.28, 3.95], 37], [1211, [-0.15, 1.46, 5.55], [-1.53, 1.3, 3.92], 35]]),
  line: keyCam([[1212, [-0.13, 1.5, 6.08], [-1.55, 1.5, 3.9], 37], [1318, [-0.43, 1.46, 5.62], [-1.55, 1.5, 3.9], 34]]),
  coins: keyCam([[1319, [-0.5, 1.45, 5.6], [-0.7, 1.15, 3.9], 37], [1352, [-0.75, 1.25, 5.2], [-0.75, 0.95, 3.9], 35], [1395, [-0.6, 1.45, 5.45], [-0.65, 1.25, 3.9], 36]]),
  evening: keyCam([[1396, [1.8, 2.6, 8.6], [-4.5, 0.6, 2.0], 43], [1450, [-0.6, 2.3, 7.2], [-5.2, 0.45, 1.4], 42], [1503, [-2.2, 2.0, 6.2], [-5.6, 0.35, 1.0], 41]]),
  lamps: keyCam([[1504, [-3.1, 1.15, 3.4], [-5.45, 0.05, 1.3], 38], [1555, [-3.35, 1.0, 3.1], [-5.45, 0.02, 1.3], 36], [1603, [-3.5, 0.92, 2.9], [-5.45, 0.0, 1.3], 35]]),
  hookboard: keyCam([[1604, [0.6, 2.05, -2.3], [0.2, 1.94, -12.8], 44], [1700, [0.52, 2.0, -2.75], [0.2, 1.95, -12.8], 43.5], [1799, [0.48, 1.97, -3.15], [0.2, 1.95, -12.8], 43]]),
};
const bowlAim = (f) => [bowlX(f), bowlY(f) + 0.16, bowlZ(f)];
const rawCamAt = (f) => {
  const S = shotAt(f), h = hh(f), hl = hhLook(f);
  let pos, look, fov, roll = 0.35 * Math.sin(f * 0.05 + 1.0);
  if (S.id === 'descend') {
    // DIVE-ARC (proof, verbatim shape): dolly + ~65-degree arc +
    // sinking height; the arc LEADS, the height LAGS, crossing
    // the waterline just after the bowl's rim.
    const u = clamp01((f - 712) / 106), e = flow(u, 0.5);
    const lead = clamp01(flow(u * 1.18, 0.45));
    const lag = Math.pow(flow(u, 0.35), 1.3);
    pos = [lerp(-0.7, -5.3, lead), lerp(1.5, -1.05, lag), lerp(6.7, 5.9, e)];
    const b = bowlAim(f);
    look = [b[0] + hl[0], b[1] + 0.05 + hl[1], b[2] + hl[2]];
    fov = lerp(36, 33, e);
    roll += -2.0 * Math.sin(Math.PI * u);
  } else if (S.id === 'trapped') {
    // UNDERWATER DRIFT (proof): just under the surface, push-in +
    // continuing arc + a breath of rise, all frame long.
    const u = clamp01((f - 819) / 132), e = flow(u, 0.45), e2 = flow(u, 0.62);
    pos = [lerp(-5.8, -5.15, e2), lerp(-0.95, -0.91, e), lerp(5.85, 5.15, e)];
    look = [-3.85 + hl[0], -0.75 + hl[1], 3.9 + hl[2]];
    fov = lerp(35, 32.5, e);
    roll += 0.8 * Math.sin(u * Math.PI * 2 + 0.6);
  } else if (S.id === 'payoff') {
    // THE REVEAL (proof): declared speed-ramp warp rides dolly +
    // arc + rise + fov together; aim is the flame itself.
    const u = clamp01((f - 952) / 101), w = rampWarp(u);
    pos = [lerp(-5.45, -4.9, w), lerp(-0.93, -0.90, w), lerp(5.55, 4.95, w)];
    look = [-3.85 + hl[0], -0.75 + hl[1], 3.9 + hl[2]];
    fov = lerp(33, 29, w);
    roll += 0.5 * Math.sin(u * Math.PI + 0.3);
  } else if (S.id === 'lean') {
    // SNAP REACTION (proof): punch-in blended with flow so the
    // move is STILL travelling on the shot's last frame; declared
    // kick at the cut. Aim = his drawn head, not his chest.
    const u = clamp01((f - 1054) / 104);
    const uu = 0.5 * (1 - Math.pow(1 - u, 2.2)) + 0.5 * flow(u, 0.4);
    const kick = -0.18 * Math.exp(-Math.pow((f - 1056) / 2.5, 2));
    pos = [lerp(-1.8, -0.42, uu), lerp(1.62, 1.48, flow(u, 0.5)), lerp(5.9, 4.45, uu) + kick];
    look = [0.31 - 0.07 * uu + hl[0], 1.44 - 0.1 * uu + hl[1], 2.9 + hl[2]];
    fov = lerp(37, 33, uu);
    roll += -1.2 * Math.sin(Math.PI * Math.min(1, u * 1.15));
  } else {
    const c = CAM_BY_ID[S.id](f);
    pos = c.pos; fov = c.fov;
    look = [c.look[0] + hl[0], c.look[1] + hl[1], c.look[2] + hl[2]];
  }
  pos = [pos[0] + h[0], pos[1] + h[1], pos[2] + h[2]];
  return { pos, look, fov, roll, flash: 0 };
};
// Gaussian finish within shots (breaks at the hard cuts)
const CAM_BREAKS = new Set(SHOTS.slice(1).map((s) => s.a));
const _rawCams = [];
for (let f = 0; f < TOTAL; f++) _rawCams.push(rawCamAt(f));
const _posS = smoothSeries(_rawCams.map((c) => c.pos), 1.8, CAM_BREAKS);
const _lookS = smoothSeries(_rawCams.map((c) => c.look), 1.8, CAM_BREAKS);
const _fovS = smoothSeries(_rawCams.map((c) => [c.fov]), 1.2, CAM_BREAKS);
export const camAt = (f) => {
  const i = Math.max(0, Math.min(TOTAL - 1, Math.round(f)));
  return { pos: _posS[i], look: _lookS[i], fov: _fovS[i][0], roll: _rawCams[i].roll, flash: 0 };
};
export const RIG_META = {
  kicks: [{ f: 1054, a: 0.22 }], hardCuts: [...CAM_BREAKS],
  blends: [], whips: [],
  samples: { pos: _posS, look: _lookS },
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
    camY: camAt(f).pos[1],
  };
};
export const fxProfileAt = (f) => ({ moteRate: 0.05, blastRate: 0, sparkRate: worldAt(f).glintK, steamRate: 0, shimmerRate: 0 });
export const fxAt = () => [];

// ---------- cast ----------
// NO card tint in any light — faces stay pure white, costume
// colours flat and saturated (the reference's rule).
const tintFor = () => '#ffffff';
export const OUTFITS = {
  meera: { jacket: '#bc5a3c', dress: '#bc5a3c', pants: '#7a3b2e', boots: '#2a1c12', hat: 'hair', hair: '#1c1410', skin: '#f8eee3' },
  old: { jacket: '#2f5d8a', pants: '#2e4a66', boots: '#14100c', hat: 'cap', cap: '#a87c2a', skin: '#f8eee3', moustache: '#d8d2c4', bigMoustache: true },
  ferryA: { jacket: '#b3543a', pants: '#4a3626', boots: '#241a12', hat: 'cap', cap: '#7a2c1e', skin: '#f8eee3' },
  ferryB: { jacket: '#d9a441', pants: '#3c3a40', boots: '#241a12', hat: 'hair', hair: '#14100c', skin: '#f8eee3', moustache: '#2a201a' },
  ferryC: { jacket: '#2e7d4f', pants: '#5a4632', boots: '#3a2410', hat: 'cap', cap: '#2f5d8a', skin: '#f8eee3' },
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
