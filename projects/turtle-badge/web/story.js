// Shot plan for "Why Everyone Stops for the Turtle" — turtle-badge
// (LIBRARY v4: speak.js dialogue performance + materials v4, camrig
// smooth tracking rig + solid colliders + props). The payoff story to
// "The Fastest Man on the Island" (island-car3): why everyone on Kiri —
// even the police — stops for the turtle at Eagle Cliff.
// Structure mirrors island-car3 EXACTLY: same island, same gate exports,
// one QUOTED dialogue line performed with lip-sync (Chief Toma, the
// badge beat); all other narration stays voice-over.
// Voice stem: 64.851 s, 30 fps, TOTAL 1946; timings from faster-whisper
// word alignment (words.json). Scene changes ONLY at clause boundaries:
//   S1 0.00-4.16 Yesterday...overtakes.        S10 36.28-39.92 pinned...shell.
//   S2 4.52-7.86 But why...police?             S11 40.36-44.56 "Whoever...Forever."
//   S3 8.56-12.40 90 years ago...Chief Toma.   S12 45.12-48.66 Cars came...
//   S4 12.68-14.98 one small turtle...plate.   S13 49.00-52.98 still crosses...always.
//   S5 15.38-18.62 boat smashed...Eagle Cliff. S14 53.50-55.60 police stop first, salute.
//   S6 19.06-23.34 tide rising...every shout.  S15 56.06-58.88 horn useless...officer.
//   S7 23.74-26.10 Nobody heard...saw him.     S16 59.36-62.72 But tomorrow...kitchen?
//   S8 26.10-29.42 turtle took the rope...swam.S17 63.30-64.56 Tomorrow's story...
//   S9 29.82-35.80 dragged...pulled free...
// Eras: present (morning/day) f0-256 + f1353-1945; flashback 90 years ago
// (sepia, then storm night) f257-1352. The turtle is ONE character: a
// plate-sized juvenile (scale 0.34) in the flashback, the adult (scale 1)
// today — with the brass badge on its shell from the pinning (f1132) on.
import { M, blinkAt, q, clamp, lerp, ramp } from './motion.js';
import { buildRig, followCam, pushInCam, staticTrackCam, keysCam } from './camrig.js';
import * as SOL from './solid.js';
import * as T from './toon.js';
import * as SPK from './speak.js';
import { SPEAK_DATA } from './speakdata.js';

// ---------- v4 dialogue performance ----------
const SPEAK = SPK.makeSpeakPlayer(SPEAK_DATA);
const speakFace = (baseName, f) => {
  const s = SPEAK.at(f);
  return { expr: 'smile', exprP: SPK.applySpeak({ ...T.faceP(baseName), cheek: 0.55 }, s), headTilt: q(s.nod || 0, 2), clothShade: true };
};

export const FPS = 30, TOTAL = 1946, DECK = 0;
export const SHOTS = [
  { id: 'drone', a: 0, b: 135, light: 'morning' },
  { id: 'queue', a: 136, b: 256, light: 'morning' },
  { id: 'flash1', a: 257, b: 379, light: 'sepia' },
  { id: 'flash2', a: 380, b: 460, light: 'sepia' },
  { id: 'storm1', a: 461, b: 570, light: 'storm' },
  { id: 'storm2', a: 571, b: 711, light: 'storm' },
  { id: 'storm3', a: 712, b: 782, light: 'storm' },
  { id: 'swim1', a: 783, b: 893, light: 'storm' },
  { id: 'swim2', a: 894, b: 1087, light: 'storm' },
  { id: 'badge1', a: 1088, b: 1209, light: 'dawn' },
  { id: 'badge2', a: 1210, b: 1352, light: 'dawn' },
  { id: 'years', a: 1353, b: 1469, light: 'day' },
  { id: 'cross', a: 1470, b: 1604, light: 'day' },
  { id: 'salute', a: 1605, b: 1680, light: 'daywarm' },
  { id: 'horn', a: 1681, b: 1779, light: 'daywarm' },
  { id: 'hookq', a: 1780, b: 1898, light: 'dusk' },
  { id: 'hook', a: 1899, b: 1945, light: 'dusk' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights / mood grades ----------
const WATER = { waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' };
export const LIGHTS = {
  morning: { az: 118, el: 36, sky: '#a8d4e8', ground: '#7a8a5a', hemi: 1.05, sun: '#fff2d0', sunI: 2.3, fog: '#cfe4ea', fogNear: 45, fogFar: 340,
    skyTop: '#3f7ec2', skyHor: '#cfe8f2', sunDisc: '#fff6da', sunSize: 0.0038, sat: 1.05, vig: 0.22, shadowExt: 20, aurora: 0, gain: '#fff4e0', ...WATER },
  day: { az: 155, el: 55, sky: '#a5d8f0', ground: '#7f9455', hemi: 1.12, sun: '#fff6dc', sunI: 2.5, fog: '#d4ecf4', fogNear: 50, fogFar: 360,
    skyTop: '#2f6fd0', skyHor: '#d8f0f8', sunDisc: '#fff8e2', sunSize: 0.0034, sat: 1.1, vig: 0.2, shadowExt: 20, aurora: 0, gain: '#fff6e4', ...WATER },
  daywarm: { az: 195, el: 42, sky: '#a8d2e8', ground: '#7f8a52', hemi: 1.08, sun: '#ffe9bb', sunI: 2.4, fog: '#e6e2c8', fogNear: 48, fogFar: 350,
    skyTop: '#3570b8', skyHor: '#e8e4c0', sunDisc: '#fff3cf', sunSize: 0.0036, sat: 1.1, vig: 0.22, shadowExt: 20, aurora: 0, gain: '#ffedca', ...WATER },
  dusk: { az: 262, el: 10, sky: '#8a7a9e', ground: '#4c4438', hemi: 0.94, sun: '#ff9e57', sunI: 1.9, fog: '#c9a98e', fogNear: 42, fogFar: 320,
    skyTop: '#2c3a6e', skyHor: '#f2a56b', sunDisc: '#ffb37a', sunSize: 0.0042, sat: 1.04, vig: 0.3, shadowExt: 20, aurora: 0, gain: '#f2ddc4', ...WATER },
  sepia: { az: 128, el: 29, sky: '#c9b18a', ground: '#6a5a3c', hemi: 1.0, sun: '#ffd9a0', sunI: 2.05, fog: '#d9c49c', fogNear: 42, fogFar: 300,
    skyTop: '#8a7a5c', skyHor: '#e8d3a8', sunDisc: '#ffedb8', sunSize: 0.004, sat: 0.52, vig: 0.3, shadowExt: 20, aurora: 0, gain: '#f2ddba',
    waterDeep: '#2a4a44', waterShal: '#4a7a6a', glint: '#ffe9c0' },
  storm: { az: 205, el: 16, sky: '#5c6c7a', ground: '#3c4442', hemi: 0.52, sun: '#b8c8d8', sunI: 1.05, fog: '#5a6874', fogNear: 26, fogFar: 210,
    skyTop: '#232f3c', skyHor: '#6a7885', sunDisc: '#000000', sunSize: 0, sat: 0.68, vig: 0.36, shadowExt: 22, aurora: 0, gain: '#c8d4e2',
    waterDeep: '#14242e', waterShal: '#2a4452', glint: '#b8d4e8' },
  dawn: { az: 105, el: 24, sky: '#b8c8d8', ground: '#6a6248', hemi: 1.0, sun: '#ffd9a8', sunI: 2.2, fog: '#d8cbb2', fogNear: 44, fogFar: 320,
    skyTop: '#4a6a9c', skyHor: '#f2d8ae', sunDisc: '#fff0c8', sunSize: 0.004, sat: 1.02, vig: 0.24, shadowExt: 20, aurora: 0, gain: '#ffeecf', ...WATER },
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
// lightning (fx choreography): the scene DIMS ~30% in the 9 frames BEFORE
// each strike; the ink flash builds over ~8f and recovers over ~12f.
const STRIKES = [502, 668];
const dipFor = (f) => {
  let k = 1;
  for (const s of STRIKES) {
    const u = f - s;
    if (u >= -9 && u < 0) k = Math.min(k, 1 - 0.3 * smooth((u + 9) / 9));
    else if (u >= 0 && u < 10) k = Math.min(k, 0.7 + 0.3 * smooth(u / 10));
  }
  return k;
};
const flashFor = (f) => {
  let v = 0;
  for (const s of STRIKES) {
    const u = f - s;
    if (u >= 0 && u < 8) v = Math.max(v, 0.55 * smooth(u / 8));
    else if (u >= 8 && u < 20) v = Math.max(v, 0.55 * (1 - (u - 8) / 12));
  }
  return v;
};
export const lightFor = (S, f) => {
  let L;
  if (S.id === 'flash1') L = blendLight(LIGHTS.morning, LIGHTS.sepia, smooth(ramp(f, 257, 300)));
  else if (S.id === 'badge1') L = blendLight(LIGHTS.storm, LIGHTS.dawn, smooth(ramp(f, 1088, 1150)));
  else L = { ...LIGHTS[S.light] };
  if (S.light === 'storm') { const d = dipFor(f); L.hemi *= d; L.sunI *= d; }
  return L;
};

// ---------- island geometry helpers (identical to island-car3) ----------
const D2R = Math.PI / 180;
export const E = (thDeg) => [24 * Math.cos(thDeg * D2R), 17 * Math.sin(thDeg * D2R)];
export const ET = (thDeg) => { const t = [-24 * Math.sin(thDeg * D2R), 17 * Math.cos(thDeg * D2R)]; const l = Math.hypot(t[0], t[1]); return [t[0] / l, t[1] / l]; };
export const EOUT = (thDeg) => { const p = E(thDeg); const l = Math.hypot(p[0], p[1]); return [p[0] / l, p[1] / l]; };
export const yawOf = (hx, hz) => Math.atan2(-hz, hx);
export const rot2 = (lx, lz, yaw) => [lx * Math.cos(yaw) + lz * Math.sin(yaw), -lx * Math.sin(yaw) + lz * Math.cos(yaw)];
export const rampY = (x) => x <= 31 ? 0 : x <= 32.8 ? -0.05 : x >= 35.2 ? -1.15 : lerp(-0.05, -1.15, smooth(ramp(x, 32.8, 35.2)));
export const thOfPos = (x, z) => { const t = Math.atan2(z, x) / D2R; return t < 0 ? t + 360 : t; };

// ---------- staging points (shared by story, main, colliders) ----------
export const BOARD_POS = [4.2, 3.15, 10.6];
export const CLIFF_SIGN = [16.3, -9.0];
export const FISH = [E(156)[0] * 0.865, E(156)[1] * 0.865];
export const CARTP = [E(245)[0] * 0.855, E(245)[1] * 0.855];
export const BANDP = [E(295)[0] * 0.865, E(295)[1] * 0.865];
export const DITCHP = (() => { const e = E(295), t = ET(295); return [e[0] * 0.72 + t[0] * 2.2, e[1] * 0.72 + t[1] * 2.2]; })();
export const CHICKP = E(215);
export const CHICKC = [CHICKP[0] + EOUT(215)[0] * 1.5, CHICKP[1] + EOUT(215)[1] * 1.5];
const CHICK_HOME_AL = [[0, 0.15], [0.95, 0.35], [-0.85, 0.3], [0.5, 0.55], [-1.35, 0.2]];
const CHICK_DIR_AL = [[0, 1.35], [0.88, 1.74], [-0.77, 1.68], [0.5, 1.19], [-1.1, 1.24]];
export const chickPosAt = (i, k) => {
  const t = ET(215), o = EOUT(215), h = CHICK_HOME_AL[i], d = CHICK_DIR_AL[i];
  const al = h[0] + d[0] * k * 1.5, la = h[1] + d[1] * k * 1.5;
  return [CHICKC[0] + t[0] * al + o[0] * la, CHICKC[1] + t[1] * al + o[1] * la];
};
export const PALMS = [[9.5, 7.5, 1], [-11.1, 18.6, 1.1], [12.3, 17.4, 0.9], [-23.5, 11.5, 1], [-24.6, -12.9, 1.05], [-11.5, 17.5, 0.9], [-4.5, -13.5, 1], [-13, -12, 0.95], [6.4, -19.8, 1], [13, -11, 0.9], [18, -13, 0.9], [15.2, 9.2, 1], [21, 14.5, 1.05], [13.4, 17.6, 0.9], [-26, 4.5, 1.1], [24.5, 6, 0.9]];
export const HUTS = [
  { x: -5, z: 11.5, ry: 0.5, s: 1.25, wall: 'plaster' },
  { x: -3.5, z: -11.5, ry: 0.3, s: 1, wall: 'plaster' },
  { x: -11.5, z: -8.5, ry: -0.4, s: 0.9, wall: 'stone' },
  { x: 2.5, z: -13.5, ry: 2.6, s: 0.95, wall: 'plaster' },
];
export const ROCKS = [
  { x: 28.5, z: -7.5, s: 1.6 }, { x: 30, z: -5, s: 1.9 }, { x: 31, z: -8.5, s: 1.4 },
  { x: 29.2, z: -6.2, s: 1.2 }, { x: 28.0, z: -4.2, s: 1.1 }, { x: 27.0, z: 0.9, s: 0.9 },
  { x: 25.9, z: -6.9, s: 0.55 },
];
export const WALL = { x: 16.5, z: -4.8, ry: -0.7, len: 6, h: 1.2 };
// the wreck: the chief's boat, smashed against the cove skirt/rocks —
// its long axis lies along the shore so the rescue pocket (chief east,
// turtle's swim lane south, beach north-east) stays clear of its hull
export const WRECK = { x: 32.9, z: -5.3, ry: -0.5 };
// the chief's trapped spot: a submerged rock shelf at the waterline
export const TRAP = { x: 35.35, z: -3.5, y: -1.13 };
// the beach where the fishermen haul him free (ramp shallows)
export const BEACH = { fx1: 33.3, fz1: -1.15, fx2: 33.7, fz2: -3.5, hands: [33.5, -2.3] };

// ---------- the golden car (present day) ----------
// Stopped at the crossing (theta 344.3, nose ~0.4 short of the turtle's
// pause point — the island-car3 stop) for the queue; in 'years' it
// drives the ring road in and stops at the same point again.
const STOP_TH = 344.3;
export const CAR = [];
{
  let wheel = 0, prev = null;
  const raw = [];
  for (let f = 0; f < TOTAL; f++) {
    let th = STOP_TH, moving = 0;
    if (f >= 1353 && f <= 1445) { const u = M.easeOut(ramp(f, 1353, 1445)); th = lerp(296, STOP_TH, u); moving = 1; }
    else if (f > 1445) th = STOP_TH;
    const p = E(th), t = ET(th);
    raw.push({ x: p[0], z: p[1], yaw: yawOf(t[0], t[1]), moving });
  }
  for (let f = 0; f < TOTAL; f++) {
    const c = raw[f];
    let speed = 0;
    if (prev) { const d = Math.hypot(c.x - prev.x, c.z - prev.z); speed = d * 30; if (c.moving || prev.moving) wheel += d / 0.36; }
    const accel = prev ? (speed - prev.speed) / 30 : 0;
    c.speed = speed; c.wheelRot = wheel;
    c.pitch = clamp(-accel * 0.012, -0.055, 0.03);
    CAR.push(c); prev = c;
  }
  for (let f = 0; f < TOTAL; f++) {
    let s = 0, n = 0;
    for (let k = -4; k <= 4; k++) { const j = f + k; if (j >= 0 && j < TOTAL) { s += CAR[j].pitch; n++; } }
    CAR[f].pitchS = s / n;
  }
  const yr = [0];
  for (let f = 1; f < TOTAL; f++) {
    let d = CAR[f].yaw - CAR[f - 1].yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    yr.push(d);
  }
  for (let f = 0; f < TOTAL; f++) {
    let s = 0, n = 0;
    for (let k = -5; k <= 5; k++) { const j = f + k; if (j >= 0 && j < TOTAL) { s += yr[j]; n++; } }
    CAR[f].steer = clamp((s / n) * 14, -0.42, 0.42);
  }
}
export const carAt = (f) => CAR[clamp(Math.round(f), 0, TOTAL - 1)];
// the second queued car (present day), stopped behind at theta 328
export const CAR2 = (() => { const p = E(328), t = ET(328); return { x: p[0], z: p[1], yaw: yawOf(t[0], t[1]) }; })();
export const car2OnAt = (f) => (f <= 256 || f >= 1470) ? 1 : 0;

// ---------- the turtle (one character, two eras) ----------
// path walker over [frame, x, z] keys with smooth ramps (island-car3 style)
const walkPath = (keys, f) => {
  let x = keys[0][1], z = keys[0][2];
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i][0]) { const a = keys[i - 1], b = keys[i]; const u = smooth(ramp(f, a[0], b[0])); return [lerp(a[1], b[1], u), lerp(a[2], b[2], u)]; }
    x = keys[keys.length - 1][1]; z = keys[keys.length - 1][2];
  }
  return [x, z];
};
// adult, today: mid-crossing in the drone/queue, crosses again in years,
// keeps crossing through cross/salute/horn (a turtle never hurries)
const P_KEYS = [
  [0, 23.95, -1.56], [150, 24.32, -1.52], [1352, 24.32, -1.52],
  [1353, 22.3, -1.59], [1469, 23.95, -1.53], [1604, 25.35, -1.6],
  [1680, 26.15, -1.67], [1779, 26.95, -1.73], [1945, 26.95, -1.73],
];
// juvenile, 90 years ago (plate-sized): cliff-top sand, the water's edge,
// the swim out to the wreck, the long drag back to the beach
const J_KEYS = [
  [380, 31.6, -3.1], [460, 32.3, -2.9], [570, 34.55, -2.35], [711, 34.55, -2.35],
  [782, 36.0, -2.85], [806, 36.3, -4.9], [855, 34.4, -6.2], [893, 34.4, -6.2],
  [950, 35.6, -4.6], [980, 36.15, -3.3], [1010, 35.9, -1.9], [1352, 35.9, -1.9],
];
export const TURT = [];
{
  let dist = 0, prev = null;
  for (let f = 0; f < TOTAL; f++) {
    const juv = f >= 257 && f <= 1352;
    let x, z, y, yaw, on, swim = 0;
    if (juv) {
      [x, z] = walkPath(J_KEYS, f);
      on = f >= 380 ? 1 : 0;
      if (f < 745) { y = rampY(x); swim = 0; }
      else if (f < 1010) { swim = 1; y = lerp(rampY(x), -1.14, smooth(ramp(f, 745, 775))); if (f >= 960) y = lerp(-1.14, rampY(x), smooth(ramp(f, 960, 1010))); }
      else { y = rampY(x); swim = 0; }
      // heading from the path direction; at the beach it turns to face the chief
      const a = walkPath(J_KEYS, Math.max(380, f - 6)), b = walkPath(J_KEYS, Math.min(1352, f + 6));
      yaw = (Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]) > 0.001) ? yawOf(b[0] - a[0], b[1] - a[1]) : yawOf(-1.0, 0.2);
      if (f >= 1010) yaw = lerp(yaw, yawOf(-1.0, 0.2), smooth(ramp(f, 1010, 1060)));
    } else {
      [x, z] = walkPath(P_KEYS, f);
      y = rampY(x);
      on = (f <= 256 || (f >= 1353 && f <= 1779)) ? 1 : 0;
      const a = walkPath(P_KEYS, Math.max(0, f - 6)), b = walkPath(P_KEYS, Math.min(1945, f + 6));
      yaw = (Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]) > 0.001) ? yawOf(b[0] - a[0], b[1] - a[1]) : yawOf(0.99, -0.04);
    }
    if (prev && on) dist += Math.hypot(x - prev.x, z - prev.z);
    TURT.push({ x, z, y, yaw, step: dist / 0.14 * Math.PI, on, swim, scale: juv ? 0.34 : 1, yawn: 0 });
    prev = { x, z };
  }
}
export const turtAt = (f) => TURT[clamp(Math.round(f), 0, TOTAL - 1)];
export const turtleHeadAt = (f) => {
  const t = turtAt(f), hd = [Math.cos(t.yaw), -Math.sin(t.yaw)];
  return [t.x + hd[0] * 0.87 * t.scale, t.y + 0.42 * t.scale, t.z + hd[1] * 0.87 * t.scale];
};
export const turtleMouthAt = (f) => {
  const t = turtAt(f), hd = [Math.cos(t.yaw), -Math.sin(t.yaw)];
  return [t.x + hd[0] * 1.0 * t.scale, t.y + 0.34 * t.scale, t.z + hd[1] * 1.0 * t.scale];
};

// ---------- Chief Toma (flashback) ----------
// harbour intro -> trapped on the ledge (storm..swim1) -> hauled across
// the shallows to the beach (swim2) -> the badge morning (badge1/2)
export const chiefAt = (f) => {
  if (f < 257 || f > 1352) return null;
  if (f <= 379) return { x: 1.8, z: 13.8, y: 0, ground: 0, mode: 'stand', phase: 'intro' };
  if (f <= 460) return null;   // the turtle's beat — the chief is off-screen
  if (f <= 974) return { x: TRAP.x, z: TRAP.z, y: TRAP.y, ground: TRAP.y, mode: 'stand', phase: 'trapped' };
  if (f <= 1068) {
    const u = M.easeInOut(ramp(f, 975, 1068));
    const px = lerp(TRAP.x, 33.6, u), pz = lerp(TRAP.z, -2.0, u);
    const py = lerp(TRAP.y, rampY(px), smooth(ramp(px, 34.2, 35.3)));
    return { x: px, z: pz, y: py, ground: null, mode: 'fall', phase: 'drag' };
  }
  if (f <= 1087) return { x: 33.6, z: -2.0, y: rampY(33.6), ground: rampY(33.6), mode: 'stand', phase: 'free' };
  if (f <= 1120) {
    const u = smooth(ramp(f, 1088, 1120));
    const px = lerp(33.6, 34.9, u), pz = lerp(-2.0, -1.7, u);
    return { x: px, z: pz, y: rampY(px), ground: rampY(px), mode: 'stroll', phase: 'walk' };
  }
  return { x: 34.9, z: -1.7, y: rampY(34.9), ground: rampY(34.9), mode: 'stand', phase: 'badge' };
};

// ---------- hero / focus ----------
const FOCUS = {
  drone: () => { const t = turtAt(60); return [t.x, 0.55, t.z]; },
  queue: () => { const t = turtAt(200); return [t.x, 0.55, t.z]; },
  flash1: () => [3.2, 1.8, 12.4],
  flash2: () => { const t = turtAt(420); return [t.x, 0.3, t.z]; },
  storm1: () => [WRECK.x, -0.2, WRECK.z],
  storm2: () => [TRAP.x, 0.6, TRAP.z],
  storm3: () => turtleHeadAt(750),
  swim1: () => { const t = turtAt(840); return [t.x, -0.6, t.z]; },
  swim2: () => [34.3, -0.3, -3.6],
  badge1: () => [35.4, -0.1, -1.8],
  badge2: () => [34.9, 0.7, -1.7],
  years: () => { const c = carAt(1410); return [c.x, 0.9, c.z]; },
  cross: () => { const t = turtAt(1540); return [t.x, 0.55, t.z]; },
  salute: () => { const t = turtAt(1640); return [t.x, 0.55, t.z]; },
  horn: () => { const t = turtAt(1740); return [t.x, 0.55, t.z]; },
  hookq: () => BOARD_POS, hook: () => BOARD_POS,
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id]();

// ---------- cameras: EVERY shot is a camrig track on a subject ----------
const carPos = (f) => { const c = carAt(f); return [c.x, 0, c.z]; };
const carFrame = (f) => { const c = carAt(f); return { fwd: [Math.cos(c.yaw), -Math.sin(c.yaw)], side: EOUT(thOfPos(c.x, c.z)) }; };
const turtPos = (f) => { const t = turtAt(f); return [t.x, t.y, t.z]; };
const chiefPos = (f) => { const c = chiefAt(f) || { x: TRAP.x, z: TRAP.z }; return [c.x, 0, c.z]; };
const lerpCam = (A, B, u) => ({
  pos: A.pos.map((v, i) => lerp(v, B.pos[i], u)),
  look: A.look.map((v, i) => lerp(v, B.look[i], u)),
  fov: lerp(A.fov, B.fov, u), roll: lerp(A.roll || 0, B.roll || 0, u),
});
// the horn gag whips from the driver (leaning on the horn) to the turtle
// (unimpressed) INSIDE one shot id; the crossfade is DECLARED as a whip.
const hornRaw = (() => {
  const drv = staticTrackCam({ pos: [24.9, 1.35, -1.9], subject: () => [23.5, 0, -4.2], lookOff: [0, 1.2, 0], fov: 30 });
  const tur = staticTrackCam({ pos: [29.5, 1.3, 1.8], subject: turtleHeadAt, lookOff: [0, 0.02, 0], fov: 26 });
  return (f) => f < 1713 ? drv(f) : f > 1727 ? tur(f) : lerpCam(drv(f), tur(f), M.easeInOut((f - 1713) / 14));
})();
const bezierCam = (P, L, a, b, fov0, fov1) => (f) => {
  const u = M.smooth(ramp(f, a, b));
  const w0 = (1 - u) ** 3, w1 = 3 * (1 - u) ** 2 * u, w2 = 3 * (1 - u) * u * u, w3 = u ** 3;
  const mix = (Q) => [0, 1, 2].map((j) => w0 * Q[0][j] + w1 * Q[1][j] + w2 * Q[2][j] + w3 * Q[3][j]);
  return { pos: mix(P), look: mix(L), fov: lerp(fov0, fov1, u), roll: 0 };
};
const RIG_BY_ID = {
  // drone: harbour reveal (title board) swinging out to the Eagle Cliff
  // bend, landing on the crossing: turtle mid-road, golden car stopped
  drone: { cut: 'hard', raw: bezierCam(
    [[62, 30, 88], [34, 14, 50], [22, 7, 16], [15.8, 3.8, -11.8]],
    [[4.2, 2.6, 10.6], [4.6, 2.4, 11.0], [11, 1.2, 4.5], [24.2, 0.9, -2.2]], 0, 135, 47, 41) },
  queue: { cut: 'hard', raw: keysCam({ keys: [
    { f: 136, pos: [28.6, 2.7, -6.8], look: [23.6, 0.4, -2.1], fov: 44 },
    { f: 256, pos: [27.8, 2.5, -6.2], look: [23.8, 0.4, -2.0], fov: 42, ease: 'surge' }] }) },
  flash1: { cut: 'hard', raw: keysCam({ keys: [
    { f: 257, pos: [10.6, 2.7, 21.4], look: [4.25, 2.95, 10.7], fov: 40 },
    { f: 318, pos: [10.2, 2.6, 21.2], look: [4.22, 2.9, 10.68], fov: 39, ease: 'surge' },
    { f: 379, pos: [7.0, 1.7, 21.2], look: [2.6, 1.45, 13.2], fov: 39, ease: 'surge' }] }) },
  flash2: { cut: 'hard', raw: pushInCam({ subject: turtPos, a: 380, b: 460, d0: 3.6, d1: 2.4, h0: 0.9, h1: 0.75, lookOff: [0, 0.28, 0], fov0: 40, fov1: 32,
    dir: () => [0.14, -1.0] }) },
  storm1: { cut: 'hard', raw: pushInCam({ subject: () => [34.1, -0.4, -4.4], a: 461, b: 570, d0: 6.5, d1: 5.2, h0: 2.2, h1: 1.9, lookOff: [0, 0.3, 0], fov0: 40, fov1: 36,
    dir: () => [0.81, 0.59] }) },
  storm2: { cut: 'hard', raw: pushInCam({ subject: chiefPos, a: 571, b: 711, d0: 5.5, d1: 4.3, h0: 1.7, h1: 1.55, lookOff: [0, 1.25, 0], fov0: 38, fov1: 34,
    dir: () => [-0.85, -0.35] }) },
  storm3: { cut: 'hard', raw: pushInCam({ subject: turtPos, a: 712, b: 782, d0: 3.2, d1: 2.2, h0: 0.8, h1: 0.65, lookOff: [0, 0.22, 0], fov0: 36, fov1: 30,
    dir: () => [0.5, -0.85] }) },
  swim1: { cut: 'hard', raw: staticTrackCam({ pos: [33.5, 1.6, -10.8], subject: turtPos, lookOff: [0, 0.1, 0], fov: 37 }) },
  swim2: { cut: 'hard', raw: keysCam({ keys: [
    { f: 894, pos: [37.5, 2.6, -0.5], look: [34.6, -0.4, -4.0], fov: 43 },
    { f: 1087, pos: [36.8, 2.4, -0.2], look: [34.2, -0.2, -2.8], fov: 40, ease: 'surge' }] }) },
  badge1: { cut: 'hard', raw: pushInCam({ subject: () => [35.4, -0.35, -1.8], a: 1088, b: 1209, d0: 5.2, d1: 4.2, h0: 1.3, h1: 1.15, lookOff: [0, 0.8, 0], fov0: 40, fov1: 36,
    dir: () => [0.3, -0.95] }) },
  badge2: { cut: 'hard', raw: pushInCam({ subject: (f) => { const c = chiefAt(f) || { x: 34.9, y: -1.13, z: -1.7 }; return [c.x, c.y, c.z]; }, a: 1210, b: 1352, d0: 3.6, d1: 2.7, h0: 1.62, h1: 1.55, lookOff: [0, 1.5, 0], fov0: 34, fov1: 30,
    dir: () => [0.92, -0.25] }) },
  years: { cut: 'blend', blend: 10, raw: keysCam({ keys: [
    { f: 1353, pos: [30.5, 3.4, -13.5], look: [24.5, 0.2, -3.0], fov: 44 },
    { f: 1469, pos: [29.6, 3.1, -12.6], look: [24.2, 0.2, -2.6], fov: 42, ease: 'surge' }] }) },
  cross: { cut: 'hard', raw: pushInCam({ subject: turtPos, a: 1470, b: 1604, d0: 5.2, d1: 3.4, h0: 2.2, h1: 1.9, lookOff: [0, 0.45, 0], fov0: 42, fov1: 30,
    dir: (f) => { const t = turtAt(f), bp = E(338), dx = bp[0] * 0.78 - t.x, dz = bp[1] * 0.78 - t.z, l = Math.hypot(dx, dz); return [dx / l, dz / l]; } }) },
  salute: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1605, pos: [23.3, 3.0, -15.2], look: [23.3, 0.5, -1.5], fov: 44 },
    { f: 1680, pos: [23.3, 2.9, -14.4], look: [23.3, 0.5, -1.5], fov: 42, ease: 'surge' }] }) },
  horn: { cut: 'hard', raw: hornRaw },
  hookq: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1780, pos: [12.8, 3.0, 23.2], look: [4.4, 2.3, 11.2], fov: 43 },
    { f: 1845, pos: [10.9, 3.3, 22.2], look: [4.25, 2.95, 10.75], fov: 40, ease: 'surge' },
    { f: 1898, pos: [10.1, 3.35, 21.6], look: [4.22, 3.0, 10.65], fov: 38, ease: 'surge' }] }) },
  hook: { cut: 'blend', blend: 8, raw: keysCam({ keys: [
    { f: 1899, pos: [10.1, 3.35, 21.6], look: [4.22, 3.0, 10.65], fov: 38 },
    { f: 1945, pos: [9.8, 3.4, 21.3], look: [4.2, 3.02, 10.62], fov: 37, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: 1068, a: 0.04 }],
  sigma: 2.3, fovSigma: 1.6,
});
export const camAt = (f) => { const c = RIG.camAt(f); c.flash = flashFor(f); return c; };
export const RIG_META = {
  kicks: RIG.declared.kicks, hardCuts: RIG.declared.hardCuts,
  blends: SHOTS.filter((s) => RIG_BY_ID[s.id].cut === 'blend').map((s) => ({ a: s.a - Math.floor(RIG_BY_ID[s.id].blend / 2), b: s.a + Math.ceil(RIG_BY_ID[s.id].blend / 2) })),
  whips: [...RIG.declared.whips, { a: 1713, b: 1727 }],
  samples: RIG.samples,
};
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), hp = heroPosAt(f);
  let cinf = 2.4;
  if (['drone', 'hookq'].includes(S.id)) cinf = 1.4;
  if (['flash2', 'storm3', 'swim1', 'badge1', 'badge2', 'cross', 'horn'].includes(S.id)) cinf = 3.6;
  if (['hook'].includes(S.id)) cinf = 3.0;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f), c = carAt(f), t = turtAt(f);
  const present = f < 257 || f > 1352;
  const W = {
    boardTitle: 0, boardEra: 0, boardHook: 0,
    carOn: present ? 1 : 0,
    carX: c.x, carZ: c.z, carYaw: c.yaw, carPitch: c.pitchS || 0, wheelRot: c.wheelRot, carSpeed: c.speed, carSteer: c.steer || 0,
    roofK: 0, glintK: 0, glowK: 0, carShake: 0,
    car2On: car2OnAt(f), car2X: CAR2.x, car2Z: CAR2.z, car2Yaw: CAR2.yaw,
    turtleX: t.x, turtleZ: t.z, turtleY: t.y, turtleYaw: t.yaw, turtleStep: t.step, turtleOn: t.on, turtleYawn: 0,
    turtleSwim: t.swim, turtleScale: t.scale,
    ropeOn: 0, ropeA: [0, -9, 0], ropeM: [0, -9, 0], ropeB: [0, -9, 0], ropeSag: 0.1,
    trapOn: 0, trapA: [0, -9, 0], trapB: [0, -9, 0],
    rainK: 0, foamBoost: 0, badgeOn: f >= 1132 ? 1 : 0, badgeGlint: 0,
    chickenK: 0, featherK: 0, dustChicken: 0, dustSeller: 0, dustBand: 0, dustBrake: 0,
  };
  if (S.id === 'drone') W.boardTitle = smooth(ramp(f, 26, 40)) * (1 - smooth(ramp(f, 52, 66)));
  if (S.id === 'flash1') W.boardEra = smooth(ramp(f, 264, 278)) * (1 - smooth(ramp(f, 300, 314)));
  if (S.id === 'hookq') W.boardHook = smooth(ramp(f, 1838, 1862));
  if (S.id === 'hook') W.boardHook = 1;   // held at FULL opacity to the literal last frame
  if (S.id === 'years') W.glintK = Math.sin(ramp(f, 1353, 1469) * Math.PI) * 0.8;
  if (S.id === 'salute' || S.id === 'horn') W.glowK = 0.3;
  // the rescue rope: wreck cleat -> turtle's mouth -> trailing end, then
  // the fishermen's hands once the turtle reaches the beach (f950-975)
  if (f >= 783 && f <= 1090) {
    W.ropeOn = 1;
    W.ropeA = [33.6, -0.55, -5.8];
    W.ropeM = turtleMouthAt(f);
    const hd = [Math.cos(t.yaw), -Math.sin(t.yaw)];
    const trail = [t.x - hd[0] * 1.3, -1.08, t.z - hd[1] * 1.3];
    const hands = [BEACH.hands[0], 0.25 + (f >= 975 ? 0.04 * Math.sin(f * 0.3) : 0), BEACH.hands[1]];
    const g = smooth(ramp(f, 950, 975));
    W.ropeB = [lerp(trail[0], hands[0], g), lerp(trail[1], hands[1], g), lerp(trail[2], hands[2], g)];
    W.ropeSag = f >= 975 ? 0.05 : 0.12;
  }
  // the trap rope: wreck -> the chief's trapped leg, until he is free
  if (f >= 461 && f <= 1068) {
    const ch = chiefAt(f);
    W.trapOn = 1;
    W.trapA = [33.75, -0.6, -5.0];
    if (ch) W.trapB = [ch.x + 0.1, ch.y + 0.28, ch.z + 0.05];
  }
  if (S.light === 'storm') W.foamBoost = 0.3;
  if (S.id === 'storm1' || S.id === 'storm2' || S.id === 'storm3' || S.id === 'swim1') W.rainK = 1;
  if (S.id === 'swim2') W.rainK = 1 - ramp(f, 1000, 1087);
  if (S.id === 'cross') W.badgeGlint = Math.sin(ramp(f, 1528, 1562) * Math.PI);
  if (S.id === 'badge1') W.badgeGlint = 0.7 * Math.sin(ramp(f, 1132, 1152) * Math.PI);
  if (S.id === 'salute') W.badgeGlint = 0.45 * Math.sin(ramp(f, 1646, 1670) * Math.PI);
  if (f >= 1692 && f <= 1722) W.carShake = 1;
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  const harbour = ['drone', 'queue', 'flash1', 'badge1', 'badge2', 'hookq', 'hook'].includes(S.id);
  const storm = S.light === 'storm';
  return { smokeRate: storm ? 0.34 : harbour ? 0.14 : 0.06, dustRate: 0.05, splashRate: 0 };
};
// deterministic splash/wake events consumed by main's fx stepper
export const fxBurstsAt = (f) => {
  const S = shotAt(f), t = turtAt(f), out = { splash: [], wake: null };
  if (S.light === 'storm' && f <= 893) {
    if (f % 45 === 0) out.splash.push([33.2, -0.85, -5.0, 3]);
    if (f % 67 === 0) out.splash.push([TRAP.x, -0.7, TRAP.z, 2]);
  }
  if (t.on && t.swim) out.wake = [t.x, t.z, t.scale];
  if (f >= 975 && f <= 1068 && f % 6 === 0) { const ch = chiefAt(f); if (ch) out.splash.push([ch.x, -0.8, ch.z, 2.2]); }
  if (f >= 1000 && f <= 1030 && f % 5 === 0 && t.on) out.splash.push([t.x, -0.8, t.z, 1.6]);
  return out;
};

// ---------- cast (single source for actors AND colliders) ----------
const TINT = { morning: '#ffffff', day: '#ffffff', daywarm: '#ffedca', dusk: '#e8d4f2', sepia: '#e8d0a8', storm: '#aebfd2', dawn: '#ffe9c9' };
const tintFor = (S) => TINT[S.light] || '#ffffff';
export const OUTFITS = {
  chief: { jacket: '#2c3a6e', pants: '#222c4c', boots: '#1c1712', hat: 'shako', skin: '#c98a5a', moustache: '#2c1e12' },
  officer: { jacket: '#2c3a6e', pants: '#222c4c', boots: '#1c1712', hat: 'shako', skin: '#a06a3c' },
  fisher1: { jacket: '#5d7a8a', pants: '#4a4238', boots: '#2c2118', hat: 'cap', cap: '#8a2f2a', skin: '#c98a5a' },
  fisher2: { jacket: '#8a7a4a', pants: '#3d4a42', boots: '#2c2118', hat: 'hair', hair: '#241a12', skin: '#a06a3c', moustache: '#2c1e12' },
  rich: { jacket: '#ff7847', pants: '#f2ede2', boots: '#7a4a26', hat: 'cap', cap: '#f7f3e6', skin: '#e8b08a' },
  driver2: { jacket: '#687a72', pants: '#37474f', boots: '#241a12', hat: 'cap', cap: '#5a2a2a', skin: '#e8b08a' },
};
const shades = (T, seed, mode) => (p) => {
  const b = T.headBlob(seed, 118, 0).b, HH = 2 * b;
  const torsoBot = mode === 'sit' ? 975 - 0.2 * HH : 975 - 1.4 * HH;
  const hc = torsoBot - 1.1 * HH - b, u = 2.36;
  p.ell(300 - 13 * u, hc, 17.5 * u, 11.5 * u, '#20242c', 2.4 * u);
  p.ell(300 + 13 * u, hc, 17.5 * u, 11.5 * u, '#20242c', 2.4 * u);
  p.band([[300 - 4 * u, hc - 2 * u], [300 + 4 * u, hc - 2 * u]], '#20242c', 3.4 * u, 1.2 * u);
  p.band([[300 - 29 * u, hc - 3 * u], [300 - 44 * u, hc - 6 * u]], '#20242c', 3 * u, 1.2 * u);
  p.band([[300 + 29 * u, hc - 3 * u], [300 + 44 * u, hc - 6 * u]], '#20242c', 3 * u, 1.2 * u);
  p.ell(300 - 19 * u, hc - 4 * u, 5 * u, 3 * u, 'rgba(255,255,255,0.35)', 0);
  p.ell(300 + 7 * u, hc - 4 * u, 5 * u, 3 * u, 'rgba(255,255,255,0.35)', 0);
};
// the small brass chest badge every Kiri policeman wears (drawn disc)
const chestBadge = (p) => {
  p.ell(338, 468, 13, 13, '#d9a441', 2);
  p.ell(338, 468, 6, 6, '#8a5a14', 0);
};
// the salute: sleeved arm snapped up, hand flat at the brow
const saluteArm = (o) => (p) => {
  p.band([[388, 408], [448, 318]], o.jacket, 17, 3);
  p.band([[448, 318], [384, 226]], o.jacket, 15, 3);
  p.ell(376, 214, 15, 19, o.skin, 2);
};
const saluteKAt = (f) => smooth(ramp(f, 1646, 1658));
export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, y, z, ground, extra = {}) => out.push({ id, x, y, z, r: 0.32, ground,
    actor: (T) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x, y, z, ground: ground ?? y, tint, ...extra }) });
  const driverIn = (carObj, o, seed, expr, id) => {
    const off = rot2(-0.15, -0.42, carObj.yaw);
    const opts = { expr, mode: 'sit', blink: blinkAt(f, seed), seed };
    const x = carObj.x + off[0], z = carObj.z + off[1];
    out.push({ id, x, y: 0.43, z, r: 0.3, ground: null,
      actor: (T) => ({ key: id + JSON.stringify(opts), draw: (p) => { T.bodyFront(p, o, opts); if (id === 'driver') shades(T, seed, 'sit')(p); }, x, y: 0.43, z, ground: 0, tint, s: 0.85, blob: false }) });
  };
  const chief = (opts, extra = {}) => {
    const ch = chiefAt(f); if (!ch) return;
    out.push({ id: 'chief', x: ch.x, y: ch.y, z: ch.z, r: 0.32, ground: ch.ground,
      actor: (T) => ({ key: 'chief' + JSON.stringify(opts), draw: (p) => { T.bodyFront(p, OUTFITS.chief, opts); chestBadge(p); }, x: ch.x, y: ch.y, z: ch.z, ground: ch.ground ?? ch.y, tint, ...extra }) });
  };
  const fishermen = (haul) => {
    const lean = haul ? q(0.06 * Math.sin(f * 0.35), 2) : 0;
    const p1 = haul ? [BEACH.fx1, BEACH.fz1] : [32.4, -0.3];
    const p2 = haul ? [BEACH.fx2, BEACH.fz2] : [32.5, -3.5];
    std('fisher1', OUTFITS.fisher1, { expr: haul ? 'stern' : 'smile', mode: 'stand', blink: blinkAt(f, 61), seed: 61 }, p1[0], rampY(p1[0]), p1[1], rampY(p1[0]), { yaw: 0.4, roll: lean });
    std('fisher2', OUTFITS.fisher2, { expr: haul ? 'stern' : 'smile', mode: 'stand', blink: blinkAt(f, 62), seed: 62 }, p2[0], rampY(p2[0]), p2[1], rampY(p2[0]), { yaw: -0.3, roll: -lean });
  };
  const officer = (salute) => {
    const k = salute ? saluteKAt(f) : 0;
    const opts = { expr: 'stern', mode: 'stand', blink: blinkAt(f, 77), seed: 77 };
    out.push({ id: 'officer', x: 21.15, y: 0, z: -1.05, r: 0.32, ground: 0,
      actor: (T) => ({ key: 'officer' + JSON.stringify(opts) + q(k, 2), draw: (p) => { T.bodyFront(p, OUTFITS.officer, opts); chestBadge(p); if (k > 0.02) saluteArm(OUTFITS.officer)(p); }, x: 21.15, y: 0, z: -1.05, ground: 0, tint, yaw: 0.3 }) });
  };
  switch (S.id) {
    case 'drone': case 'queue': {
      driverIn(carAt(f), OUTFITS.rich, 41, 'smile_closed', 'driver');
      if (car2OnAt(f)) driverIn(CAR2, OUTFITS.driver2, 63, 'smile_closed', 'driver2');
      officer(false);
      break;
    }
    case 'flash1': {
      chief({ expr: 'stern', mode: 'stand', blink: blinkAt(f, 31), seed: 31 }, { yaw: -0.3 });
      break;
    }
    case 'flash2': break;
    case 'storm1': {
      chief({ expr: 'nervous', mode: 'stand', blink: blinkAt(f, 31), seed: 31, headTilt: -0.1 });
      break;
    }
    case 'storm2': {
      // shouting into the storm — an expression, NOT a performed line
      chief({ expr: 'shock', mode: 'stand', blink: blinkAt(f, 31), seed: 31, headTilt: -0.16 });
      break;
    }
    case 'storm3': {
      chief({ expr: 'nervous', mode: 'stand', blink: blinkAt(f, 31), seed: 31, headTilt: -0.06 });
      break;
    }
    case 'swim1': {
      chief({ expr: 'pained', mode: 'stand', blink: blinkAt(f, 31), seed: 31 });
      break;
    }
    case 'swim2': {
      const ch = chiefAt(f);
      if (ch && ch.phase === 'drag') chief({ expr: 'pained', mode: 'fall', blink: blinkAt(f, 31), seed: 31 });
      else if (ch) chief({ expr: 'relief', mode: 'stand', blink: blinkAt(f, 31), seed: 31 });
      fishermen(f >= 975 && f <= 1068);
      break;
    }
    case 'badge1': {
      const ch = chiefAt(f);
      if (ch && ch.phase === 'walk') chief({ expr: 'smile', mode: 'stroll', phase: q((f * 0.011) % 1, 2), blink: blinkAt(f, 31), seed: 31 });
      else chief({ expr: 'smile', mode: 'stand', blink: blinkAt(f, 31), seed: 31, headTilt: f >= 1118 && f <= 1165 ? 0.2 : 0.05, prop: f >= 1118 && f <= 1165 ? ['point', 0.7] : null });
      fishermen(false);
      break;
    }
    case 'badge2': {
      // THE dialogue beat: Chief Toma PERFORMS the law — mouth on the
      // voice inside the speak segments, firmly closed in the pauses
      // (incl. the beat before "Forever"); everyone else stays silent.
      chief({ expr: 'smile', mode: 'stand', blink: blinkAt(f, 31), seed: 31, look: 0.2, ...speakFace('stern', f) });
      fishermen(false);
      break;
    }
    case 'years': {
      driverIn(carAt(f), OUTFITS.rich, 41, 'grin', 'driver');
      break;
    }
    case 'cross': {
      driverIn(carAt(f), OUTFITS.rich, 41, 'smile_closed', 'driver');
      if (car2OnAt(f)) driverIn(CAR2, OUTFITS.driver2, 63, 'smile_closed', 'driver2');
      break;
    }
    case 'salute': {
      driverIn(carAt(f), OUTFITS.rich, 41, 'smile_closed', 'driver');
      if (car2OnAt(f)) driverIn(CAR2, OUTFITS.driver2, 63, 'smile_closed', 'driver2');
      officer(true);
      break;
    }
    case 'horn': {
      driverIn(carAt(f), OUTFITS.rich, 41, f >= 1690 && f <= 1730 ? 'stern' : 'smile_closed', 'driver');
      if (car2OnAt(f)) driverIn(CAR2, OUTFITS.driver2, 63, 'smile_closed', 'driver2');
      officer(false);
      break;
    }
    case 'hookq': case 'hook': break;
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));
export const fxAt = () => [];

// ---------- solidity: statics, dynamics, ground (LIBRARY v3 gate data) ----------
const ARCHC = [E(295)[0] * 0.82, E(295)[1] * 0.82];
const ARCH_OFF = [Math.cos(0.9) * 1.3, -Math.sin(0.9) * 1.3];
export const BASKETS = [[-20.25, 5.45], [-17.53, 6.33]];
export const FISHBOAT_YAW = 2.42;
export const FISHBOAT = [-16.51, 9.47];
// wreck-zone rocks get TIGHT colliders: the rescue action (chief, boat,
// turtle) plays out in the pocket between the rock meshes themselves
const rockCol = (r) => SOL.circle(r.x, r.z, r.s * ((r.x >= 27.5 && r.z <= -4) ? 0.42 : 0.95), { h: r.s * 1.1, id: 'rock' });
export const STATICS = [
  ...PALMS.map(([x, z]) => SOL.circle(x, z, 0.22, { h: 4.5, id: 'palm' })),
  ...HUTS.map((h) => SOL.obb(h.x, h.z, h.ry, 1.45 * h.s, 1.2 * h.s, { h: 3.2, id: 'hut' })),
  SOL.obb(CARTP[0], CARTP[1], 0.7, 0.95, 0.62, { h: 1.1, id: 'cart' }),
  SOL.circle(ARCHC[0] + ARCH_OFF[0], ARCHC[1] + ARCH_OFF[1], 0.1, { h: 2.6, id: 'archpost' }),
  SOL.circle(ARCHC[0] - ARCH_OFF[0], ARCHC[1] - ARCH_OFF[1], 0.1, { h: 2.6, id: 'archpost' }),
  SOL.circle(CLIFF_SIGN[0] - 0.553, CLIFF_SIGN[1] + 0.606, 0.08, { h: 1.9, id: 'signpost' }),
  SOL.circle(CLIFF_SIGN[0] + 0.553, CLIFF_SIGN[1] - 0.606, 0.08, { h: 1.9, id: 'signpost' }),
  ...ROCKS.map(rockCol),
  SOL.circle(BOARD_POS[0] - 1.8, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  SOL.circle(BOARD_POS[0] + 1.8, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  SOL.aabb(-1.15, 1.15, 20.65, 30.15, { h: 0.3, id: 'jetty' }),
  SOL.circle(-7.6, 13.6, 0.52, { h: 1.3, id: 'crates' }),
  SOL.circle(-8.4, 12.6, 0.4, { h: 0.9, id: 'barrel' }),
  SOL.obb(WALL.x, WALL.z, WALL.ry, WALL.len / 2, 0.35, { h: WALL.h, id: 'wall' }),
  SOL.circle(FISH[0] + 1.6, FISH[1] - 1.2, 0.6, { h: 0.5, id: 'net' }),
  SOL.circle(BASKETS[0][0], BASKETS[0][1], 0.32, { h: 0.45, id: 'basket' }),
  SOL.circle(BASKETS[1][0], BASKETS[1][1], 0.32, { h: 0.45, id: 'basket2' }),
  SOL.obb(FISHBOAT[0], FISHBOAT[1], 2.42, 1.75, 0.62, { h: 1.2, id: 'boat' }),
  SOL.obb(WRECK.x, WRECK.z, WRECK.ry, 1.3, 0.55, { h: 1.2, id: 'wreck' }),
];
export const WORLD = SOL.makeWorld(STATICS);
export const dynamicsAt = (f) => {
  const c = carAt(f), t = turtAt(f), out = [];
  if (f < 257 || f > 1352) out.push(SOL.obb(c.x, c.z, c.yaw, 2.24, 0.99, { kind: 'dynamic', id: 'car' }));
  if (car2OnAt(f)) out.push(SOL.obb(CAR2.x, CAR2.z, CAR2.yaw, 2.24, 0.99, { kind: 'dynamic', id: 'car2' }));
  if (t.on) out.push(SOL.circle(t.x, t.z, 0.78 * t.scale, { kind: 'dynamic', id: 'turtle' }));
  for (const a of castAt(f)) {
    if (a.id === 'driver' || a.id === 'driver2') continue;   // drivers ride INSIDE their cars
    out.push(SOL.circle(a.x, a.z, a.r, { kind: 'dynamic', id: a.id }));
  }
  return out;
};
export const groundItemsAt = (f) => {
  const t = turtAt(f), items = [];
  if (f < 257 || f > 1352) items.push({ id: 'car', y: 0, ground: 0, maxHover: 0.04 });
  if (car2OnAt(f)) items.push({ id: 'car2', y: 0, ground: 0, maxHover: 0.04 });
  if (t.on && t.swim && f < 783) { /* sliding off the shore into the water: transitional, unchecked (like a fall) */ }
  else if (t.on && t.swim && f >= 960) { /* climbing out onto the beach: transitional, unchecked */ }
  else if (t.on && t.swim) items.push({ id: 'turtle', y: t.y, ground: -1.24, maxHover: 0.12 });
  else if (t.on) items.push({ id: 'turtle', y: t.y, ground: rampY(t.x), maxHover: 0.05 });
  for (const a of castAt(f)) if (a.ground !== null && a.ground !== undefined) items.push({ id: a.id, y: a.y, ground: a.ground, maxHover: 0.06 });
  return items;
};
