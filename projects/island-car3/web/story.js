// Shot plan for "The Fastest Man on the Island" — island-car3 REBUILD
// (LIBRARY v4: speak.js dialogue performance + materials v4, on the v3
// camrig smooth tracking rig + solid colliders + props).
// v4 changes: (0) The three QUOTED dialogue lines are PERFORMED by the
// speaker — mouth driven by the stem envelope (speakgen.mjs bakes
// speakdata.js from the stem + words.json via kit/speak.js), nods on
// stressed words, brows live; narration stays voice-over and every
// non-speaker's mouth stays closed. The camera HOLDS on the speaker for
// each line: oneroad/goslow are re-aimed at the rental man (v2 flew to
// the island vista / cliff sign mid-line), payoff1 re-centred on him.
// Changes from v1: (1) OPENING IS A DRONE SHOT (f0-149: aerial over the
// sea, island reveal, descending arc to the harbour, landing on the car;
// the title board fades in during the descent). (2) ALL cameras run
// through camrig.buildRig — Gaussian-smoothed subject tracks, no
// keyframe-lerp jerk; whip/blend zones and impact kicks are DECLARED
// and the jerk meter gates everything else. (3) The car's stop and the
// turtle's crossing were re-timed so the brake stop is collision-free
// with the turtle squarely in front (shell gap ~0.25, head at the
// bumper during the honks). (4) Chickens peck on the road SHOULDER
// (lateral 1.5) and scatter outward — the car never touches them.
// Voice stem: 77.931 s, 30 fps, TOTAL 2338 (same stem as v1; timings
// from faster-whisper word alignment, see timing.json).
// World: island ring road = ellipse x=24cos, z=17sin (centre 0,0).
// Zones (deg): harbour 90, fishermen 156, children 195, chickens 215,
// coconut cart 245, wedding 295, Eagle Cliff bend 345 (tightest curve).
import { M, blinkAt, q, clamp, lerp, ramp } from './motion.js';
import { buildRig, followCam, chaseCam, frontCam, pushInCam, povCam, staticTrackCam, keysCam } from './camrig.js';
import * as SOL from './solid.js';
import * as T from './toon.js';
import * as SPK from './speak.js';
import { SPEAK_DATA } from './speakdata.js';

// ---------- v4 dialogue performance ----------
const SPEAK = SPK.makeSpeakPlayer(SPEAK_DATA);
// speakFace(baseExprName, f): the actor's expression params with the voice
// folded in (mouth sync + brow life via kit/speak.js applySpeak) + the nod
// as headTilt + v4 cloth shading. The string expr stays 'smile' (a valid
// v1 name for the sweep gate); exprP carries the real performed face.
const speakFace = (baseName, f) => {
  const s = SPEAK.at(f);
  return { expr: 'smile', exprP: SPK.applySpeak({ ...T.faceP(baseName), cheek: 0.55 }, s), headTilt: q(s.nod || 0, 2), clothShade: true };
};

export const FPS = 30, TOTAL = 2338, DECK = 0;
export const SHOTS = [
  { id: 'drone', a: 0, b: 149, light: 'morning' },
  { id: 'demand', a: 150, b: 187, light: 'morning' },
  { id: 'reveal', a: 188, b: 259, light: 'morning' },
  { id: 'secondsun', a: 260, b: 329, light: 'morning' },
  { id: 'roof', a: 330, b: 441, light: 'morning' },
  { id: 'oneroad', a: 442, b: 560, light: 'morning' },
  { id: 'goslow', a: 561, b: 622, light: 'morning' },
  { id: 'laugh', a: 623, b: 705, light: 'morning' },
  { id: 'lap1a', a: 706, b: 758, light: 'day' },
  { id: 'lap1b', a: 759, b: 784, light: 'day' },
  { id: 'lap1c', a: 785, b: 843, light: 'day' },
  { id: 'lap2a', a: 844, b: 893, light: 'day' },
  { id: 'lap2b', a: 894, b: 937, light: 'day' },
  { id: 'lap2c', a: 938, b: 1006, light: 'day' },
  { id: 'lap3a', a: 1007, b: 1073, light: 'daywarm' },
  { id: 'lap3b', a: 1074, b: 1188, light: 'daywarm' },
  { id: 'cliffpov', a: 1189, b: 1287, light: 'daywarm' },
  { id: 'cliffbend', a: 1288, b: 1319, light: 'daywarm' },
  { id: 'turtle', a: 1320, b: 1414, light: 'daywarm' },
  { id: 'brakes', a: 1415, b: 1489, light: 'daywarm' },
  { id: 'nose', a: 1490, b: 1528, light: 'daywarm' },
  { id: 'honk1', a: 1529, b: 1603, light: 'daywarm' },
  { id: 'honk2', a: 1604, b: 1664, light: 'daywarm' },
  { id: 'walk1', a: 1665, b: 1767, light: 'golden' },
  { id: 'walk2', a: 1768, b: 1850, light: 'golden' },
  { id: 'walk3', a: 1851, b: 1921, light: 'golden' },
  { id: 'payoff1', a: 1922, b: 2020, light: 'dusk' },
  { id: 'payoff2', a: 2021, b: 2079, light: 'dusk' },
  { id: 'years', a: 2080, b: 2177, light: 'dusk' },
  { id: 'hookq', a: 2178, b: 2287, light: 'dusk' },
  { id: 'hook', a: 2288, b: 2337, light: 'dusk' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights / mood grades (same grades as v1) ----------
const WATER = { waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' };
export const LIGHTS = {
  morning: { az: 118, el: 36, sky: '#a8d4e8', ground: '#7a8a5a', hemi: 1.05, sun: '#fff2d0', sunI: 2.3, fog: '#cfe4ea', fogNear: 45, fogFar: 340,
    skyTop: '#3f7ec2', skyHor: '#cfe8f2', sunDisc: '#fff6da', sunSize: 0.0038, sat: 1.05, vig: 0.22, shadowExt: 20, aurora: 0, gain: '#fff4e0', ...WATER },
  day: { az: 155, el: 55, sky: '#a5d8f0', ground: '#7f9455', hemi: 1.12, sun: '#fff6dc', sunI: 2.5, fog: '#d4ecf4', fogNear: 50, fogFar: 360,
    skyTop: '#2f6fd0', skyHor: '#d8f0f8', sunDisc: '#fff8e2', sunSize: 0.0034, sat: 1.1, vig: 0.2, shadowExt: 20, aurora: 0, gain: '#fff6e4', ...WATER },
  daywarm: { az: 195, el: 42, sky: '#a8d2e8', ground: '#7f8a52', hemi: 1.08, sun: '#ffe9bb', sunI: 2.4, fog: '#e6e2c8', fogNear: 48, fogFar: 350,
    skyTop: '#3570b8', skyHor: '#e8e4c0', sunDisc: '#fff3cf', sunSize: 0.0036, sat: 1.1, vig: 0.22, shadowExt: 20, aurora: 0, gain: '#ffedca', ...WATER },
  golden: { az: 248, el: 20, sky: '#d9a06a', ground: '#5c4a34', hemi: 1.02, sun: '#ffb763', sunI: 2.3, fog: '#e8cba0', fogNear: 45, fogFar: 340,
    skyTop: '#54689c', skyHor: '#ffd9a0', sunDisc: '#fff3cf', sunSize: 0.0038, sat: 1.08, vig: 0.26, shadowExt: 20, aurora: 0, gain: '#ffe9d2', ...WATER },
  dusk: { az: 262, el: 10, sky: '#8a7a9e', ground: '#4c4438', hemi: 0.94, sun: '#ff9e57', sunI: 1.9, fog: '#c9a98e', fogNear: 42, fogFar: 320,
    skyTop: '#2c3a6e', skyHor: '#f2a56b', sunDisc: '#ffb37a', sunSize: 0.0042, sat: 1.04, vig: 0.3, shadowExt: 20, aurora: 0, gain: '#f2ddc4', ...WATER },
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
  if (S.id === 'walk1') return blendLight(LIGHTS.daywarm, LIGHTS.golden, smooth(ramp(f, 1680, 1760)));
  if (S.id === 'years') return blendLight(LIGHTS.golden, LIGHTS.dusk, smooth(ramp(f, 2090, 2150)));
  return { ...LIGHTS[S.light] };
};

// ---------- island geometry helpers ----------
const D2R = Math.PI / 180;
export const E = (thDeg) => [24 * Math.cos(thDeg * D2R), 17 * Math.sin(thDeg * D2R)];       // road centre [x,z]
export const ET = (thDeg) => { const t = [-24 * Math.sin(thDeg * D2R), 17 * Math.cos(thDeg * D2R)]; const l = Math.hypot(t[0], t[1]); return [t[0] / l, t[1] / l]; }; // unit heading
export const EOUT = (thDeg) => { const p = E(thDeg); const l = Math.hypot(p[0], p[1]); return [p[0] / l, p[1] / l]; }; // radial out
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
// chickens live on the OUTER shoulder (lateral +1.5 from the centreline):
// the car's OBB reaches 0.99 laterally, a chicken is r=0.2 — 0.31 clear.
export const CHICKC = [CHICKP[0] + EOUT(215)[0] * 1.5, CHICKP[1] + EOUT(215)[1] * 1.5];
// chicken homes/scatter in road frame (along, lateral) rel CHICKC
const CHICK_HOME_AL = [[0, 0.15], [0.95, 0.35], [-0.85, 0.3], [0.5, 0.55], [-1.35, 0.2]];
const CHICK_DIR_AL = [[0, 1.35], [0.88, 1.74], [-0.77, 1.68], [0.5, 1.19], [-1.1, 1.24]];
export const chickPosAt = (i, k) => {
  const t = ET(215), o = EOUT(215), h = CHICK_HOME_AL[i], d = CHICK_DIR_AL[i];
  const al = h[0] + d[0] * k * 1.5, la = h[1] + d[1] * k * 1.5;
  return [CHICKC[0] + t[0] * al + o[0] * la, CHICKC[1] + t[1] * al + o[1] * la];
};
// palms [x, z, s] — two moved off the asphalt vs v1: (17,11)->(15.2,9.2)
// sat ON the road ring (0.86 from the centreline); (-24,2)->(-26,4.5).
export const PALMS = [[9.5, 7.5, 1], [-11.1, 18.6, 1.1], [12.3, 17.4, 0.9], [-23.5, 11.5, 1], [-24.6, -12.9, 1.05], [-11.5, 17.5, 0.9], [-4.5, -13.5, 1], [-13, -12, 0.95], [6.4, -19.8, 1], [13, -11, 0.9], [18, -13, 0.9], [15.2, 9.2, 1], [21, 14.5, 1.05], [13.4, 17.6, 0.9], [-26, 4.5, 1.1], [24.5, 6, 0.9]];
export const HUTS = [
  { x: -5, z: 11.5, ry: 0.5, s: 1.25, wall: 'plaster' },     // rental hut
  { x: -3.5, z: -11.5, ry: 0.3, s: 1, wall: 'plaster' },
  { x: -11.5, z: -8.5, ry: -0.4, s: 0.9, wall: 'stone' },
  { x: 2.5, z: -13.5, ry: 2.6, s: 0.95, wall: 'plaster' },
];
// cliff rocks — placed to leave the turtle's walk corridor (z ~ -0.8..-3.2,
// x 24..35) completely clear; every rock is a collider in STATICS.
export const ROCKS = [
  { x: 28.5, z: -7.5, s: 1.6 }, { x: 30, z: -5, s: 1.9 }, { x: 31, z: -8.5, s: 1.4 },
  { x: 29.2, z: -6.2, s: 1.2 }, { x: 28.0, z: -4.2, s: 1.1 }, { x: 27.0, z: 0.9, s: 0.9 },
  { x: 25.9, z: -6.9, s: 0.55 },
];
export const WALL = { x: 16.5, z: -4.8, ry: -0.7, len: 6, h: 1.2 };

// ---------- the car track (precomputed per frame) ----------
export const PARK = { x: 4.2, z: 12.8, yaw: yawOf(0.55, -0.83) };
export const PARK2 = { x: 7.6, z: 13.4, yaw: yawOf(0.35, 0.94) };
// theta segments [f0, f1, th0, th1, ease] — v2: the car stops at 344.3
// (not v1's 344.9) so its nose halts ~0.25 short of the turtle's shell.
const THSEG = [
  [759, 784, 148, 160, 'linear'], [785, 843, 184, 204, 'linear'],
  [844, 893, 206, 221, 'linear'], [894, 937, 221, 233, 'linear'],
  [938, 1006, 234, 253, 'linear'], [1007, 1073, 264, 284, 'linear'],
  [1074, 1188, 285, 313, 'linear'], [1189, 1287, 313, 329, 'linear'],
  [1288, 1319, 330, 335, 'easeOut'], [1320, 1414, 335, 341.2, 'easeOut'],
  [1415, 1461, 341.2, 344.3, 'easeOut'],
];
const thetaAt = (f) => {
  if (f < 706 || f >= 1922) return null;
  if (f <= 758) return null;   // pull-out is a bezier in carAt (706-758)
  for (const [a, b, t0, t1, ez] of THSEG) if (f >= a && f <= b) { const u = (f - a) / (b - a); return lerp(t0, t1, ez === 'easeOut' ? M.easeOut(u) : u); }
  if (f > 1461 && f < 1922) return 344.3;
  return null;
};
export const CAR = [];
{
  let wheel = 0, prev = null;
  const raw = [];
  for (let f = 0; f < TOTAL; f++) {
    let x, z, yaw, moving = 0;
    if (f >= 1922) { x = PARK2.x; z = PARK2.z; yaw = PARK2.yaw; }
    else {
      const th = thetaAt(f);
      if (th === null && f >= 706 && f < 759) {
        // one C2 pull-out: cubic bezier from the parking bay onto the ring
        const u = smooth(ramp(f, 706, 758));
        const P0 = [PARK.x, PARK.z], P3 = E(124), e100 = E(100);
        const dl = Math.hypot(e100[0] - P0[0], e100[1] - P0[1]);
        const P1 = [P0[0] + (e100[0] - P0[0]) / dl * 5, P0[1] + (e100[1] - P0[1]) / dl * 5];
        const t124 = ET(124), P2 = [P3[0] - t124[0] * 5, P3[1] - t124[1] * 5];
        const w0 = (1 - u) ** 3, w1 = 3 * (1 - u) ** 2 * u, w2 = 3 * (1 - u) * u * u, w3 = u ** 3;
        x = w0 * P0[0] + w1 * P1[0] + w2 * P2[0] + w3 * P3[0];
        z = w0 * P0[1] + w1 * P1[1] + w2 * P2[1] + w3 * P3[1];
        const d1 = [3 * (1 - u) ** 2 * (P1[0] - P0[0]) + 6 * (1 - u) * u * (P2[0] - P1[0]) + 3 * u * u * (P3[0] - P2[0]),
                    3 * (1 - u) ** 2 * (P1[1] - P0[1]) + 6 * (1 - u) * u * (P2[1] - P1[1]) + 3 * u * u * (P3[1] - P2[1])];
        yaw = yawOf(d1[0], d1[1]); moving = u > 0.02 && u < 0.99 ? 0.5 : 0;
      } else if (th === null) { x = PARK.x; z = PARK.z; yaw = PARK.yaw; }
      else { const p = E(th), t = ET(th); x = p[0]; z = p[1]; yaw = yawOf(t[0], t[1]); moving = 1; }
    }
    raw.push({ x, z, yaw, moving });
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
  // front-wheel steer from smoothed yaw rate (visual, clamped)
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

// ---------- the turtle track (precomputed per frame) ----------
// v2: the pause point (24.32,-1.52) sits squarely in front of the car
// stopped at theta 344.3 — shell gap ~0.25, and when the turtle turns
// to face the car for the honks its head lands ~0.05 from the bumper.
const TPATH = [
  [0, 21.3, -1.6], [1189, 21.3, -1.6], [1330, 22.9, -1.62], [1465, 24.32, -1.52],
  [1664, 24.32, -1.52], [1768, 25.6, -1.75], [1850, 30.5, -2.15], [1900, 33.8, -2.0], [1921, 35.0, -1.9],
  [2079, 35.2, -1.8], [2337, 35.2, -1.8],
];
export const TURT = [];
{
  let dist = 0, prev = null;
  for (let f = 0; f < TOTAL; f++) {
    let x = TPATH[0][1], z = TPATH[0][2];
    for (let i = 1; i < TPATH.length; i++) {
      if (f <= TPATH[i][0]) { const a = TPATH[i - 1], b = TPATH[i]; const u = smooth(ramp(f, a[0], b[0])); x = lerp(a[1], b[1], u); z = lerp(a[2], b[2], u); break; }
      x = TPATH[TPATH.length - 1][1]; z = TPATH[TPATH.length - 1][2];
    }
    let y = rampY(x);
    if (prev) dist += Math.hypot(x - prev.x, z - prev.z);
    if (f >= 1922 && f <= 2079) { x = 35.2; z = -1.8; y = -1.3; }
    if (f > 2079) { y = -1.24 + 0.03 * Math.sin(f * 0.05); }
    const on = (f >= 1189 && f <= 1921) || f > 2079 ? 1 : 0;
    let faceCar = 0;
    if (f > 1500 && f < 1665) faceCar = smooth(ramp(f, 1505, 1560)) * (1 - smooth(ramp(f, 1620, 1664)));
    const yaw = lerp(yawOf(0.97, -0.06), yawOf(-0.365, -0.931), faceCar);
    const yawn = f >= 1640 && f <= 1662 ? Math.sin(ramp(f, 1640, 1662) * Math.PI) : 0;
    TURT.push({ x, z, y, yaw, step: dist / 0.14 * Math.PI, on, yawn, dist });
    prev = { x, z };
  }
}
export const turtAt = (f) => TURT[clamp(Math.round(f), 0, TOTAL - 1)];
export const turtleHeadAt = (f) => {
  const t = turtAt(f), hd = [Math.cos(t.yaw), -Math.sin(t.yaw)];
  return [t.x + hd[0] * 0.87, 0.42, t.z + hd[1] * 0.87];
};

// ---------- hero / focus ----------
const FOCUS = {
  drone: () => [4.2, 0.9, 12.8], demand: () => [6.45, 1.3, 11.0], reveal: () => [4.2, 1.0, 12.8], secondsun: () => [4.2, 0.9, 12.8],
  roof: () => [4.4, 1.2, 12.7], oneroad: () => [2.1, 1.35, 13.1], goslow: () => [2.1, 1.3, 13.1], laugh: () => [6.45, 1.45, 11.0],
  walk1: () => { const t = turtAt(1700); return [t.x, 0.6, t.z]; },
  payoff1: () => [5.2, 1.25, 13.9], payoff2: () => [4.2, 1, 13.2], years: () => [35.0, -0.7, -1.8],
  hookq: () => BOARD_POS, hook: () => BOARD_POS,
};
export const heroPosAt = (f) => {
  const S = shotAt(f);
  if (FOCUS[S.id]) return FOCUS[S.id]();
  const c = carAt(f), t = turtAt(f);
  if (['turtle', 'nose', 'honk1', 'honk2', 'walk2', 'walk3'].includes(S.id)) return [t.x, 0.55, t.z];
  if (S.id === 'brakes') return [c.x + 1, 0.6, c.z + 1];
  return [c.x, 0.9, c.z];
};

// ---------- cameras: EVERY shot is a camrig track on a subject ----------
const carPos = (f) => { const c = carAt(f); return [c.x, 0, c.z]; };
const carFrame = (f) => { const c = carAt(f); return { fwd: [Math.cos(c.yaw), -Math.sin(c.yaw)], side: EOUT(thOfPos(c.x, c.z)) }; };
const turtPos = (f) => { const t = turtAt(f); return [t.x, t.y, t.z]; };
const lerpCam = (A, B, u) => ({
  pos: A.pos.map((v, i) => lerp(v, B.pos[i], u)),
  look: A.look.map((v, i) => lerp(v, B.look[i], u)),
  fov: lerp(A.fov, B.fov, u), roll: lerp(A.roll || 0, B.roll || 0, u),
});
// honk shots whip between the driver and the turtle INSIDE one shot id;
// the crossfades are baked into the raw track and DECLARED as whips below.
const honk1Raw = (() => {
  const drv = staticTrackCam({ pos: [20.4, 1.35, -1.4], subject: () => [23.1, 0, -4.35], lookOff: [0, 1.2, 0], fov: 32 });
  const tur = staticTrackCam({ pos: [22.08, 1.46, -1.56], subject: turtleHeadAt, lookOff: [0, 0.02, 0], fov: 25 });
  return (f) => f < 1552 ? drv(f) : f > 1566 ? tur(f) : lerpCam(drv(f), tur(f), M.easeInOut((f - 1552) / 14));
})();
const honk2Raw = (() => {
  const tur = staticTrackCam({ pos: [22.12, 1.44, -1.58], subject: turtleHeadAt, lookOff: [0, 0.02, 0], fov: 24 });
  const drv = staticTrackCam({ pos: [21.05, 1.3, -1.12], subject: () => [23.15, 0, -4.35], lookOff: [0, 1.22, 0], fov: 23 });
  const yawn = staticTrackCam({ pos: [27.12, 1.2, -1.76], subject: turtleHeadAt, lookOff: [0, 0.02, 0], fov: 24 });
  return (f) => {
    if (f < 1618) return tur(f);
    if (f < 1632) return lerpCam(tur(f), drv(f), M.easeInOut((f - 1618) / 14));
    if (f < 1636) return drv(f);
    if (f < 1650) return lerpCam(drv(f), yawn(f), M.easeInOut((f - 1636) / 14));
    return yawn(f);
  };
})();
const bezierCam = (P, L, a, b, fov0, fov1) => (f) => {
  const u = M.smooth(ramp(f, a, b));
  const w0 = (1 - u) ** 3, w1 = 3 * (1 - u) ** 2 * u, w2 = 3 * (1 - u) * u * u, w3 = u ** 3;
  const mix = (Q) => [0, 1, 2].map((j) => w0 * Q[0][j] + w1 * Q[1][j] + w2 * Q[2][j] + w3 * Q[3][j]);
  return { pos: mix(P), look: mix(L), fov: lerp(fov0, fov1, u), roll: 0 };
};
const RIG_BY_ID = {
  drone: { cut: 'hard', raw: bezierCam(
    [[74, 33, 98], [48, 20, 63], [20, 8, 33], [9.6, 3.1, 21.6]],
    [[0, 0, 8], [0.8, 0.4, 9.6], [3.0, 1.3, 11.2], [4.3, 2.2, 11.0]], 0, 149, 47, 41) },
  demand: { cut: 'blend', blend: 12, raw: pushInCam({ subject: () => [6.45, 0, 11.0], dir: () => [0.44, 0.90], d0: 5.6, d1: 4.7, h0: 1.75, h1: 1.62, a: 150, b: 187, lookOff: [-0.2, 1.27, 0.1], fov0: 38, fov1: 35 }) },
  reveal: { cut: 'whip', blend: 21, raw: keysCam({ keys: [
    { f: 188, pos: [0.2, 1.9, 18.2], look: [-4.5, 1.6, 11.8], fov: 44 },
    { f: 206, pos: [2.6, 2.0, 23.5], look: [0.5, 1.2, 12.5], fov: 43, ease: 'easeInOut' },
    { f: 232, pos: [7.6, 1.0, 21.5], look: [4.2, 1.3, 12.8], fov: 41, ease: 'surge' },
    { f: 259, pos: [8.6, 2.4, 20.6], look: [4.2, 1.1, 12.8], fov: 40, ease: 'surge' }] }) },
  secondsun: { cut: 'hard', raw: keysCam({ keys: [
    { f: 260, pos: [10.8, 1.3, 17.6], look: [4.2, 0.9, 12.8], fov: 37 },
    { f: 295, pos: [10.2, 1.5, 9.6], look: [4.2, 0.95, 12.8], fov: 37, ease: 'surge' },
    { f: 329, pos: [7.6, 1.8, 8.2], look: [4.2, 1.0, 12.8], fov: 36, ease: 'surge' }] }) },
  roof: { cut: 'hard', raw: keysCam({ keys: [
    { f: 330, pos: [11.5, 1.7, 9.5], look: [4.9, 1.2, 12.4], fov: 36 },
    { f: 441, pos: [10.8, 1.75, 10.4], look: [4.9, 1.25, 12.4], fov: 35, ease: 'surge' }] }) },
  oneroad: { cut: 'hard', raw: keysCam({ keys: [
    { f: 442, pos: [0.2, 1.7, 17.5], look: [2.3, 1.3, 12.9], fov: 40 },
    { f: 560, pos: [1.2, 1.6, 16.2], look: [2.2, 1.32, 13.0], fov: 36, ease: 'surge' }] }) },
  goslow: { cut: 'hard', raw: keysCam({ keys: [
    { f: 561, pos: [1.0, 1.65, 16.6], look: [2.2, 1.33, 13.0], fov: 35 },
    { f: 622, pos: [1.5, 1.6, 15.9], look: [2.15, 1.33, 13.05], fov: 33, ease: 'surge' }] }) },
  laugh: { cut: 'hard', raw: pushInCam({ subject: () => [6.45, 0, 11.0], dir: () => [0.47, 0.88], d0: 3.9, d1: 2.05, h0: 1.6, h1: 1.52, a: 623, b: 705, lookOff: [0, 1.44, 0], fov0: 34, fov1: 28 }) },
  lap1a: { cut: 'blend', blend: 10, raw: followCam({ subject: carPos, dist: 9.8, side: 1, h: 1.6, lookAhead: 0.8, lookH: 0.9, fov: 44,
    frame: (f) => { const fr = carFrame(f); return { fwd: fr.fwd, side: [fr.fwd[1], -fr.fwd[0]] }; } }) },
  lap1b: { cut: 'hard', raw: (f) => { const c = carAt(f), out = EOUT(thOfPos(c.x, c.z));
    return { pos: [c.x + out[0] * 9.5, 2.0, c.z + out[1] * 9.5], look: [FISH[0], 1.0, FISH[1]], fov: 42, roll: 0 }; } },
  lap1c: { cut: 'hard', raw: (f) => { const c = carAt(f), out = EOUT(thOfPos(c.x, c.z)), hd = [Math.cos(c.yaw), -Math.sin(c.yaw)];
    return { pos: [c.x + out[0] * 10 + hd[0] * 0.8, 1.9, c.z + out[1] * 10 + hd[1] * 0.8], look: [c.x + out[0] * 1.45 - hd[0] * 0.75, 1.0, c.z + out[1] * 1.45 - hd[1] * 0.75], fov: 42, roll: 0 }; } },
  lap2a: { cut: 'whip', blend: 12, raw: chaseCam({ subject: carPos, frame: carFrame, back: 5.8, h: 1.75, lookAhead: 4, lookH: 0.8, fov: 42 }) },
  lap2b: { cut: 'hard', raw: keysCam({ keys: [
    { f: 894, pos: [-29.25, 1.6, -12.6], look: [CHICKC[0], 0.35, CHICKC[1]], fov: 41 },
    { f: 937, pos: [-28.4, 1.5, -11.9], look: [CHICKC[0], 0.35, CHICKC[1]], fov: 40, ease: 'surge' }] }) },
  lap2c: { cut: 'hard', raw: (f) => { const c = carAt(f), out = EOUT(thOfPos(c.x, c.z));
    return { pos: [c.x - out[0] * 8.8, 1.7, c.z - out[1] * 8.8], look: [lerp(c.x, CARTP[0], 0.55), 0.95, lerp(c.z, CARTP[1], 0.55)], fov: 41, roll: 0 }; } },
  lap3a: { cut: 'whip', blend: 12, raw: frontCam({ subject: carPos, frame: carFrame, ahead: 5.4, h: 1.1, lookH: 0.95, fov: 41 }) },
  lap3b: { cut: 'hard', raw: (() => { const t = ET(295), out = EOUT(295), rp = E(295);
      const lx = (BANDP[0] + rp[0]) / 2, lz = (BANDP[1] + rp[1]) / 2;
      const px = BANDP[0] + out[0] * 7.5 + t[0] * 1.5, pz = BANDP[1] + out[1] * 7.5 + t[1] * 1.5;
      return keysCam({ keys: [
        { f: 1074, pos: [px, 1.8, pz], look: [lx, 0.8, lz], fov: 44 },
        { f: 1188, pos: [px + t[0] * 0.4, 1.75, pz + t[1] * 0.4], look: [lx, 0.8, lz], fov: 43, ease: 'surge' }] }); })() },
  cliffpov: { cut: 'hard', raw: povCam({ subject: carPos, frame: carFrame, local: [0.75, 1.42, 0], fov: 46, roll: -2.5,
    lookFn: (f) => { const c = carAt(f), a = E(Math.min(352, thOfPos(c.x, c.z) + 12)); return [a[0], 0.9, a[1]]; } }) },
  cliffbend: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1288, pos: [16.6, 2.6, -10.8], look: [23.0, 0.7, -3.4], fov: 40 },
    { f: 1319, pos: [17.3, 2.4, -10.0], look: [23.2, 0.65, -3.2], fov: 39, ease: 'surge' }] }) },
  turtle: { cut: 'hard', raw: pushInCam({ subject: turtPos, a: 1320, b: 1414, d0: 5.0, d1: 3.6, h0: 2.6, h1: 2.45, lookOff: [0, 0.4, 0], fov0: 44, fov1: 30,
    dir: (f) => { const t = turtAt(f), bp = E(338), dx = bp[0] * 0.78 - t.x, dz = bp[1] * 0.78 - t.z, l = Math.hypot(dx, dz); return [dx / l, dz / l]; } }) },
  brakes: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1415, pos: [29.8, 1.5, 0.6], look: [24.3, 0.5, -2.2], fov: 34 },
    { f: 1489, pos: [29.2, 1.45, 0.2], look: [24.3, 0.5, -2.2], fov: 32, ease: 'surge' }] }) },
  nose: { cut: 'hard', raw: pushInCam({ subject: () => [24.13, 0, -2.0], dir: () => [0.80, 0.61], d0: 2.45, d1: 1.95, h0: 0.78, h1: 0.74, a: 1490, b: 1528, lookOff: [0, 0.55, 0], fov0: 30, fov1: 27 }) },
  honk1: { cut: 'hard', raw: honk1Raw },
  honk2: { cut: 'hard', raw: honk2Raw },
  walk1: { cut: 'whip', blend: 16, raw: keysCam({ keys: [
    { f: 1665, pos: [16.4, 1.9, -0.9], look: [23.2, 0.8, -2.1], fov: 44 },
    { f: 1712, pos: [17.6, 1.85, 0.5], look: [24.4, 0.7, -0.7], fov: 43, ease: 'surge' },
    { f: 1767, pos: [19.8, 1.8, -0.8], look: [26.6, 0.6, -2.0], fov: 42, ease: 'surge' }] }) },
  walk2: { cut: 'hard', raw: (f) => { const t = turtAt(f);
    return { pos: [t.x - 2.3, 1.45 + Math.max(0, -t.y), t.z + 4.8], look: [t.x + 0.5, 0.55 + t.y, t.z], fov: 37, roll: 0 }; } },
  walk3: { cut: 'hard', raw: (f) => { const t = turtAt(f), u = ramp(f, 1851, 1921);
    return { pos: [t.x - 2.6 - 1.8 * u, 1.2 + 1.1 * u - t.y * 0.4, t.z + 4.3 + 1.2 * u], look: [t.x + 0.7, 0.4 + t.y, t.z], fov: 37, roll: 0 }; } },
  payoff1: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1922, pos: [8.4, 1.6, 18.2], look: [4.6, 1.22, 13.3], fov: 35 },
    { f: 2020, pos: [6.9, 1.5, 16.4], look: [4.1, 1.25, 13.1], fov: 33, ease: 'surge' }] }) },
  payoff2: { cut: 'hard', raw: keysCam({ keys: [
    { f: 2021, pos: [11.6, 2.6, 21.6], look: [5.6, 1.0, 13.6], fov: 44 },
    { f: 2079, pos: [11.0, 2.9, 20.8], look: [5.6, 1.05, 13.6], fov: 42, ease: 'surge' }] }) },
  years: { cut: 'hard', raw: keysCam({ keys: [
    { f: 2080, pos: [36.5, 2.6, 2.8], look: [35.2, -1.05, -1.8], fov: 30 },
    { f: 2177, pos: [36.3, 2.55, 2.5], look: [35.2, -1.05, -1.8], fov: 28, ease: 'surge' }] }) },
  hookq: { cut: 'hard', raw: keysCam({ keys: [
    { f: 2178, pos: [12.8, 3.0, 23.2], look: [4.4, 2.3, 11.2], fov: 43 },
    { f: 2240, pos: [10.9, 3.3, 22.2], look: [4.25, 2.95, 10.75], fov: 40, ease: 'surge' },
    { f: 2287, pos: [10.1, 3.35, 21.6], look: [4.22, 3.0, 10.65], fov: 38, ease: 'surge' }] }) },
  hook: { cut: 'blend', blend: 8, raw: keysCam({ keys: [
    { f: 2288, pos: [10.1, 3.35, 21.6], look: [4.22, 3.0, 10.65], fov: 38 },
    { f: 2337, pos: [9.8, 3.4, 21.3], look: [4.2, 3.02, 10.62], fov: 37, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: 894, a: 0.04 }, { f: 1095, a: 0.045 }, { f: 1461, a: 0.055 }],
  sigma: 2.3, fovSigma: 1.6,
});
export const camAt = (f) => RIG.camAt(f);
export const RIG_META = {
  kicks: RIG.declared.kicks, hardCuts: RIG.declared.hardCuts,
  blends: SHOTS.filter((s) => RIG_BY_ID[s.id].cut === 'blend').map((s) => ({ a: s.a - Math.floor(RIG_BY_ID[s.id].blend / 2), b: s.a + Math.ceil(RIG_BY_ID[s.id].blend / 2) })),
  whips: [...RIG.declared.whips, { a: 1552, b: 1566 }, { a: 1618, b: 1632 }, { a: 1636, b: 1650 }],
  samples: RIG.samples,
};
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), hp = heroPosAt(f);
  let cinf = 2.4;
  if (['drone', 'oneroad', 'payoff2', 'lap3b'].includes(S.id)) cinf = 1.4;
  if (['turtle', 'nose', 'honk1', 'honk2', 'demand', 'laugh', 'goslow'].includes(S.id)) cinf = 3.6;
  if (['hook', 'hookq'].includes(S.id)) cinf = 3.0;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f), c = carAt(f), t = turtAt(f);
  const W = {
    boardTitle: 0, boardHook: 0,
    carX: c.x, carZ: c.z, carYaw: c.yaw, carPitch: c.pitchS || 0, wheelRot: c.wheelRot, carSpeed: c.speed, carSteer: c.steer || 0,
    roofK: 0, glintK: 0, glowK: 0,
    turtleX: t.x, turtleZ: t.z, turtleY: t.y, turtleYaw: t.yaw, turtleStep: t.step, turtleOn: t.on, turtleYawn: t.yawn,
    chickenK: 0, featherK: 0, dustChicken: 0, dustSeller: 0, dustBand: 0, dustBrake: 0,
  };
  if (S.id === 'drone') W.boardTitle = smooth(ramp(f, 62, 78)) * (1 - smooth(ramp(f, 130, 146)));
  if (S.id === 'hookq') W.boardHook = smooth(ramp(f, 2232, 2252));
  if (S.id === 'hook') W.boardHook = 1;   // held at FULL opacity to the literal last frame
  W.roofK = smooth(ramp(f, 373, 428));                       // "folded" (word 376) — starts 3f early
  if (S.id === 'secondsun') W.glintK = Math.sin(ramp(f, 262, 327) * Math.PI);
  if (S.id === 'payoff2' || S.id === 'hookq' || S.id === 'hook') W.glowK = 0.85;
  if (S.id === 'brakes') W.glowK = 0.3 * ramp(f, 1415, 1461);
  W.chickenK = smooth(ramp(f, 866, 902));
  W.featherK = ramp(f, 868, 900) * (1 - ramp(f, 908, 924));
  W.dustChicken = ramp(f, 868, 894);
  W.dustSeller = ramp(f, 972, 992);
  W.dustBand = ramp(f, 1092, 1114);
  W.dustBrake = ramp(f, 1459, 1480);
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  const harbour = ['drone', 'demand', 'reveal', 'secondsun', 'roof', 'oneroad', 'goslow', 'laugh', 'payoff1', 'payoff2', 'hookq', 'hook'].includes(S.id);
  return { smokeRate: harbour ? 0.14 : 0.05, dustRate: 0.07, splashRate: 0 };
};

// ---------- cast (single source for actors AND colliders) ----------
const TINT = { morning: '#ffffff', day: '#ffffff', daywarm: '#ffedca', golden: '#ffe0b0', dusk: '#e8d4f2' };
const tintFor = (S) => TINT[S.light] || '#ffffff';
export const OUTFITS = {
  rich: { jacket: '#ff7847', pants: '#f2ede2', boots: '#7a4a26', hat: 'cap', cap: '#f7f3e6', skin: '#e8b08a' },
  rental: { jacket: '#2e6f6a', pants: '#37474f', boots: '#241a12', hat: 'cap', cap: '#173f3a', skin: '#c98a5a', moustache: '#3a2a1c' },
  fisher1: { jacket: '#5d7a8a', pants: '#4a4238', boots: '#2c2118', hat: 'cap', cap: '#8a2f2a', skin: '#c98a5a' },
  fisher2: { jacket: '#8a7a4a', pants: '#3d4a42', boots: '#2c2118', hat: 'hair', hair: '#241a12', skin: '#a06a3c', moustache: '#2c1e12' },
  kid1: { build: 'kid', jacket: '#e2453c', pants: '#2a4a7a', boots: '#33302c', hat: 'cap', cap: '#f2c230', skin: '#e8b08a' },
  kid2: { build: 'kid', jacket: '#2a7ac2', pants: '#37474f', boots: '#33302c', hat: 'hair', hair: '#171008', skin: '#a06a3c' },
  kid3: { build: 'kid', jacket: '#39a05a', pants: '#7a4a26', boots: '#33302c', hat: 'cap', cap: '#f7f3e6', skin: '#c98a5a' },
  seller: { jacket: '#e8b93c', pants: '#7a4a26', boots: '#3a2c1c', hat: 'turban', skin: '#a06a3c', moustache: '#2c1e12' },
  drum1: { jacket: '#b3392e', pants: '#f2ede2', boots: '#3a2c1c', hat: 'cap', cap: '#f2c230', skin: '#e8b08a' },
  drum2: { jacket: '#b3392e', pants: '#f2ede2', boots: '#3a2c1c', hat: 'cap', cap: '#f2c230', skin: '#c98a5a' },
  drum3: { jacket: '#b3392e', pants: '#f2ede2', boots: '#3a2c1c', hat: 'cap', cap: '#f2c230', skin: '#a06a3c', moustache: '#2c1e12' },
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
const drumDraw = (T, o, opts, dy = 0) => (p) => {
  T.bodyFront(p, o, opts);
  p.ell(300, 716 + dy, 96, 30, '#f2e3c2', 3);
  p.poly([[204, 716 + dy], [396, 716 + dy], [388, 792 + dy], [212, 792 + dy]], '#b3392e', 3);
  p.ell(300, 792 + dy, 88, 16, '#8c2432', 3);
  p.band([[238, 690 + dy], [282, 716 + dy]], '#7a4a26', 5, 2);
  p.band([[362, 690 + dy], [318, 716 + dy]], '#7a4a26', 5, 2);
};
const arcY = (f, f0, dur, h) => { const u = ramp(f, f0, f0 + dur); return u <= 0 || u >= 1 ? 0 : Math.sin(u * Math.PI) * h; };
// cast entry: {id, x, y, z, r, ground (number|null = airborne/rider), actor(T)}
export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, y, z, ground, extra = {}) => out.push({ id, x, y, z, r: 0.32, ground,
    actor: (T) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x, y, z, ground: ground ?? y, tint, ...extra }) });
  const richStand = (expr, x, z, yaw, opts2 = {}) => {
    const opts = { expr, mode: 'stand', blink: blinkAt(f, 41), seed: 41, ...opts2 };
    out.push({ id: 'rich', x, y: 0, z, r: 0.34, ground: 0,
      actor: (T) => ({ key: 'rich' + JSON.stringify(opts) + yaw, draw: (p) => { T.bodyFront(p, OUTFITS.rich, opts); shades(T, 41, 'stand')(p); }, x, y: 0, z, ground: 0, tint, yaw }) });
  };
  const richWalk = (x, y, z, ground, yaw, phase) => {
    const opts = { expr: 'smile_closed', mode: 'stroll', phase, blink: blinkAt(f, 41), seed: 41, prop: ['point', 0.14] };
    out.push({ id: 'rich', x, y, z, r: 0.34, ground,
      actor: (T) => ({ key: 'richW' + JSON.stringify(opts), draw: (p) => { T.bodyFront(p, OUTFITS.rich, opts); shades(T, 41, 'stand')(p); }, x, y, z, ground: ground ?? y, tint, yaw }) });
  };
  const driver = (expr) => {
    const c = carAt(f), off = rot2(-0.15, -0.42, c.yaw);
    const opts = { expr, mode: 'sit', blink: blinkAt(f, 41), seed: 41 };
    const x = c.x + off[0], z = c.z + off[1];
    out.push({ id: 'driver', x, y: 0.43, z, r: 0.3, ground: null,
      actor: (T) => ({ key: 'driver' + JSON.stringify(opts), draw: (p) => { T.bodyFront(p, OUTFITS.rich, opts); shades(T, 41, 'sit')(p); }, x, y: 0.43, z, ground: 0, tint, s: 0.85, blob: false }) });
  };
  switch (S.id) {
    case 'drone': case 'demand': {
      richStand('grin', 6.45, 11.0, 0.3);
      std('rental', OUTFITS.rental, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 52), seed: 52 }, 2.1, 0, 13.1, 0, { yaw: -0.3 });
      break;
    }
    case 'reveal': case 'secondsun': {
      richStand('grin', 6.6, 10.9, 0.5);
      std('rental', OUTFITS.rental, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 52), seed: 52 }, 2.1, 0, 13.1, 0, { yaw: -0.3 });
      break;
    }
    case 'roof': {
      const k = q(smooth(ramp(f, 344, 352)) * (1 - smooth(ramp(f, 352, 362))), 2);
      const opts = { expr: 'grin', mode: 'stand', blink: blinkAt(f, 41), seed: 41, prop: ['point', k] };
      out.push({ id: 'rich', x: 6.8, y: 0, z: 11.0, r: 0.34, ground: 0,
        actor: (T) => ({ key: 'richBtn' + JSON.stringify(opts), draw: (p) => { T.bodyFront(p, OUTFITS.rich, opts); shades(T, 41, 'stand')(p); }, x: 6.8, y: 0, z: 11.0, ground: 0, tint, yaw: 0.55 }) });
      std('rental', OUTFITS.rental, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 52), seed: 52 }, 2.1, 0, 13.1, 0, { yaw: -0.3 });
      break;
    }
    case 'oneroad': {
      const k = q(0.25 + 0.2 * Math.sin(f * 0.05), 2);
      std('rental', OUTFITS.rental, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 52), seed: 52, prop: ['point', k], look: 0.3, ...speakFace('smile', f) }, 2.1, 0, 13.1, 0, { yaw: -0.3 });
      richStand('grin', 6.6, 11.1, 0.4);
      break;
    }
    case 'goslow': {
      // v4: the camera now holds on the rental man at the harbour while he
      // finishes the line ("...go slow at Eagle Cliff") — he is IN this
      // shot, pointing toward the cliff; the rich man listens (mouth shut).
      std('rental', OUTFITS.rental, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 52), seed: 52, prop: ['point', 1], look: 0.3, ...speakFace('smile', f) }, 2.1, 0, 13.1, 0, { yaw: -0.3 });
      richStand('grin', 6.45, 11.0, 0.35);
      break;
    }
    case 'laugh': {
      // v4: he laughs (narration), settles into smug, then PERFORMS the
      // line "Slow is for other people." (f656-689) — mouth on the voice.
      if (f < 650) richStand('laugh', 6.45, 11.0, 0.25);
      else if (f < 656) { const t = (f - 650) / 6, ts = t * t * (3 - 2 * t); richStand('smile', 6.45, 11.0, 0.25, { exprP: { ...T.blendFaceP(T.faceP('laugh'), T.faceP('smug'), ts), cheek: 0.55 }, clothShade: true }); }
      else if (f <= 695) richStand('smile', 6.45, 11.0, 0.25, { look: -0.2, ...speakFace('smug', f) });
      else richStand('grin', 6.45, 11.0, 0.25);
      std('rental', OUTFITS.rental, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 52), seed: 52 }, 2.1, 0, 13.1, 0, { yaw: -0.3 });
      break;
    }
    case 'lap1a': case 'lap2a': case 'lap2b': case 'lap3a': case 'cliffpov': case 'cliffbend': case 'turtle': {
      driver(S.id === 'lap3a' || S.id === 'cliffpov' ? 'grin' : 'smile_closed');
      break;
    }
    case 'lap1b': {
      driver('smile_closed');
      const wv = q(Math.sin(f * 0.32), 2);
      std('fisher1', OUTFITS.fisher1, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 61), seed: 61, wave: wv }, FISH[0] - 0.7, 0, FISH[1] + 0.4, 0, { yaw: 0.4 });
      std('fisher2', OUTFITS.fisher2, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 62), seed: 62 }, FISH[0] + 0.9, 0, FISH[1] - 0.5, 0, { yaw: -0.3 });
      break;
    }
    case 'lap1c': {
      driver('grin');
      const c = carAt(f);
      [[OUTFITS.kid1, 71, -0.4, 'kid1'], [OUTFITS.kid2, 72, -1.7, 'kid2'], [OUTFITS.kid3, 73, -2.9, 'kid3']].forEach(([o, seed, back, id]) => {
        const out_ = EOUT(thOfPos(c.x, c.z)), hd = [Math.cos(c.yaw), -Math.sin(c.yaw)];
        const kx = c.x + out_[0] * 2.9 - hd[0] * -back, kz = c.z + out_[1] * 2.9 - hd[1] * -back;
        const ph = q(((f - 785) * Math.max(0.5, c.speed) / 30) % 1, 2);
        std(id, o, { expr: 'laugh', mode: 'march', phase: ph, blink: blinkAt(f, seed), seed, lift: 52 }, kx, 0, kz, 0, { yaw: 0.2 });
      });
      break;
    }
    case 'lap2c': {
      driver('grin');
      // the seller dives BEHIND his cart on a wide bezier around its end —
      // the path never crosses the cart's collider (checked by the gate)
      const S0 = [CARTP[0] - 1.3, CARTP[1] + 0.8], C0 = [CARTP[0] - 0.6, CARTP[1] + 2.6], E0 = [CARTP[0] + 0.7, CARTP[1] + 2.3];
      if (f < 956) std('seller', OUTFITS.seller, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 81), seed: 81 }, S0[0], 0, S0[1], 0, { yaw: 0.5 });
      else {
        const u = ramp(f, 956, 984);
        const px = (1 - u) * (1 - u) * S0[0] + 2 * (1 - u) * u * C0[0] + u * u * E0[0];
        const pz = (1 - u) * (1 - u) * S0[1] + 2 * (1 - u) * u * C0[1] + u * u * E0[1];
        const ay = arcY(f, 956, 24, 0.55);
        const opts = { expr: u < 1 ? 'shock' : 'nervous', mode: u < 1 && u > 0.15 ? 'fall' : 'stand', blink: blinkAt(f, 81), seed: 81 };
        out.push({ id: 'seller', x: px, y: ay, z: pz, r: 0.32, ground: u >= 1 ? 0 : null,
          actor: (T) => ({ key: 'pax' + JSON.stringify(OUTFITS.seller) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, OUTFITS.seller, opts), x: px, y: ay, z: pz, ground: 0, tint, yaw: 0.5, roll: u < 1 ? -0.35 * Math.sin(u * Math.PI) : 0 }) });
      }
      break;
    }
    case 'lap3b': {
      driver('grin');
      [[OUTFITS.drum1, 91, 0, 'drum1'], [OUTFITS.drum2, 92, 1.5, 'drum2'], [OUTFITS.drum3, 93, 3.0, 'drum3']].forEach(([o, seed, off, id]) => {
        const bx = BANDP[0] + off * 0.55, bz = BANDP[1] + off * 0.95;
        if (f < 1071) {
          out.push({ id, x: bx, y: 0, z: bz, r: 0.32, ground: 0,
            actor: (T) => ({ key: 'drum' + seed + 'stand', draw: drumDraw(T, o, { expr: 'smile', mode: 'stand', blink: blinkAt(f, seed), seed }), x: bx, y: 0, z: bz, ground: 0, tint, yaw: -0.4 }) });
        } else {
          const u = ramp(f, 1071, 1101);
          const px = lerp(bx, DITCHP[0] + off * 0.5, u), pz = lerp(bz, DITCHP[1] + off * 0.85, u);
          const ay = arcY(f, 1071, 26, 0.6) - 0.45 * smooth(ramp(f, 1092, 1101));
          const opts = { expr: u < 1 ? 'shock' : 'dazed', mode: u < 1 && u > 0.15 ? 'fall' : 'stand', blink: blinkAt(f, seed), seed };
          out.push({ id, x: px, y: ay, z: pz, r: 0.32, ground: u >= 1 ? -0.45 : null,
            actor: (T) => ({ key: 'drum' + seed + JSON.stringify(opts) + q(u, 2), draw: drumDraw(T, o, opts, u >= 1 ? 14 : 0), x: px, y: ay, z: pz, ground: -0.45, tint, yaw: -0.4, roll: u < 1 ? 0.3 * Math.sin(u * Math.PI) : 0 }) });
        }
      });
      break;
    }
    case 'brakes': case 'nose': { driver('shock'); break; }
    case 'honk1': { driver(f >= 1538 && f <= 1552 ? 'stern' : 'shock'); break; }
    case 'honk2': { driver('shock'); break; }
    case 'walk1': {
      if (f < 1669) driver('dazed');
      else {
        // he walks AROUND the car and the turtle: a path planned in the
        // stopped car's local frame (flank -> nose -> around the turtle),
        // verified collision-free by the gate on every frame
        const cc = carAt(1700), Hx = [Math.cos(cc.yaw), -Math.sin(cc.yaw)], Zx = [Math.sin(cc.yaw), Math.cos(cc.yaw)];
        const LP = [[1.354, 1.674], [2.9, 1.45], [5.1, 0.75]], LB = [0, 0.18, 0.5];
        const u = ramp(f, 1669, 1767), tt = turtAt(f);
        const loc = (lx, lz) => [cc.x + lx * Hx[0] + lz * Zx[0], cc.z + lx * Hx[1] + lz * Zx[1]];
        const PTS = [...LP.map(([lx, lz]) => loc(lx, lz)), [tt.x + 2.6, tt.z + 0.9], [tt.x + 2.1, tt.z - 0.5]];
        const BR = [0, 0.18, 0.5, 0.78, 1];
        let px = PTS[4][0], pz = PTS[4][1];
        for (let i = 0; i < 4; i++) if (u <= BR[i + 1]) { const w = M.smooth((u - BR[i]) / (BR[i + 1] - BR[i])); px = lerp(PTS[i][0], PTS[i + 1][0], w); pz = lerp(PTS[i][1], PTS[i + 1][1], w); break; }
        richWalk(px, 0, pz, 0, 0.6, q((f * 0.011) % 1, 2));
      }
      break;
    }
    case 'walk2': {
      const t = turtAt(f), gy = rampY(t.x + 2.1);
      richWalk(t.x + 2.1, gy, t.z - 0.5, gy, 0.7, q((t.dist * 1.4) % 1, 2));
      break;
    }
    case 'walk3': {
      // he stops at the shoreline (33.6,-3.4) and waves the turtle off —
      // following the turtle to its shallows spot would put him over open sea
      const t = turtAt(f), u2 = smooth(ramp(f, 1851, 1905));
      const px = lerp(t.x + 2.1, 33.6, u2), pz = lerp(t.z - 0.5, -3.4, u2), gy = rampY(px);
      richWalk(px, gy, pz, gy, 0.7, q((t.dist * 1.4) % 1, 2));
      break;
    }
    case 'payoff1': case 'payoff2': {
      // v4: the rental man PERFORMS the payoff line, grinning — during the
      // narration tag ("grinned the rental man") speakFace leaves the grin
      // untouched; on the quoted words the mouth rides the voice.
      std('rental', OUTFITS.rental, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 52), seed: 52, look: 0.3, ...speakFace('grin', f) }, 3.0, 0, 12.4, 0, { yaw: -0.25 });
      richStand('smile_closed', 5.2, 13.9, 0.35);
      break;
    }
    case 'years': case 'hookq': case 'hook': break;
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
export const FISHBOAT = [-16.51, 9.47];   // beached at 0.885 scale, tangent-aligned: clear of car AND fishermen
export const STATICS = [
  ...PALMS.map(([x, z]) => SOL.circle(x, z, 0.22, { h: 4.5, id: 'palm' })),
  ...HUTS.map((h) => SOL.obb(h.x, h.z, h.ry, 1.45 * h.s, 1.2 * h.s, { h: 3.2, id: 'hut' })),
  SOL.obb(CARTP[0], CARTP[1], 0.7, 0.95, 0.62, { h: 1.1, id: 'cart' }),
  SOL.circle(ARCHC[0] + ARCH_OFF[0], ARCHC[1] + ARCH_OFF[1], 0.1, { h: 2.6, id: 'archpost' }),
  SOL.circle(ARCHC[0] - ARCH_OFF[0], ARCHC[1] - ARCH_OFF[1], 0.1, { h: 2.6, id: 'archpost' }),
  SOL.circle(CLIFF_SIGN[0] - 0.553, CLIFF_SIGN[1] + 0.606, 0.08, { h: 1.9, id: 'signpost' }),
  SOL.circle(CLIFF_SIGN[0] + 0.553, CLIFF_SIGN[1] - 0.606, 0.08, { h: 1.9, id: 'signpost' }),
  ...ROCKS.map((r) => SOL.circle(r.x, r.z, r.s * 0.95, { h: r.s * 1.1, id: 'rock' })),
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
];
export const WORLD = SOL.makeWorld(STATICS);
export const dynamicsAt = (f) => {
  const c = carAt(f), t = turtAt(f), out = [];
  out.push(SOL.obb(c.x, c.z, c.yaw, 2.24, 0.99, { kind: 'dynamic', id: 'car' }));
  if (t.on) out.push(SOL.circle(t.x, t.z, 0.78, { kind: 'dynamic', id: 'turtle' }));
  for (const a of castAt(f)) {
    if (a.id === 'driver') continue;   // the driver rides INSIDE the car
    out.push(SOL.circle(a.x, a.z, a.r, { kind: 'dynamic', id: a.id }));
  }
  if (f >= 830 && f <= 948) {
    const k = smooth(ramp(f, 866, 902));
    for (let i = 0; i < 5; i++) { const p = chickPosAt(i, k); out.push(SOL.circle(p[0], p[1], 0.2, { kind: 'dynamic', id: 'chick' + i })); }
  }
  return out;
};
export const groundItemsAt = (f) => {
  const t = turtAt(f), items = [{ id: 'car', y: 0, ground: 0, maxHover: 0.04 }];
  if (t.on && f <= 1921) items.push({ id: 'turtle', y: t.y, ground: rampY(t.x), maxHover: 0.05 });
  if (t.on && f > 2079) items.push({ id: 'turtle', y: t.y, ground: -1.27, maxHover: 0.09 });
  for (const a of castAt(f)) if (a.ground !== null && a.ground !== undefined) items.push({ id: a.id, y: a.y, ground: a.ground, maxHover: 0.06 });
  return items;
};
