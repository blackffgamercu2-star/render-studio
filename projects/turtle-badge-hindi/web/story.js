// Shot plan for "हर कोई उस कछुए के लिए क्यों रुकता है?" — turtle-badge-hindi
// (LIBRARY v4: speak.js dialogue performance + materials v4, camrig smooth
// tracking rig + solid colliders + props — same system as island-car3).
// Hindi payoff to the posted island-car video: WHY everyone stops for the
// turtle. Present-day Eagle Cliff bookends a 90-years-ago flashback: the
// storm rescue, the brass badge, and the ONE performed dialogue line —
// Chief Toma's quoted line (speak segments exclude the narration tag).
// Voice stem: 62.171 s, 30 fps, TOTAL 1865. Beat map from words.json
// clause timings (see timing.json); the 24.16-34.50s ASR gap holds
// sentences S6+S7 — boundary derived at 27.50s (frame 825) from the
// stem's RMS breath dip. Scene changes ONLY at clause boundaries.
// World: same Kiri island as island-car3 (ring road ellipse, Eagle Cliff
// bend at theta ~345, harbour board frame at BOARD_POS).
import { M, blinkAt, q, clamp, lerp, ramp } from './motion.js';
import { buildRig, followCam, chaseCam, pushInCam, staticTrackCam, keysCam } from './camrig.js';
import * as SOL from './solid.js';
import * as T from './toon.js';
import * as SPK from './speak.js';
import { SPEAK_DATA } from './speakdata.js';

// ---------- v4 dialogue performance (Chief Toma only) ----------
const SPEAK = SPK.makeSpeakPlayer(SPEAK_DATA);
const speakFace = (baseName, f) => {
  const s = SPEAK.at(f);
  return { expr: 'smile', exprP: SPK.applySpeak({ ...T.faceP(baseName), cheek: 0.55 }, s), headTilt: q(s.nod || 0, 2), clothShade: true };
};

export const FPS = 30, TOTAL = 1865, DECK = 0;
export const SHOTS = [
  { id: 'drone', a: 0, b: 141, light: 'morning' },
  { id: 'queue', a: 142, b: 253, light: 'day' },
  { id: 'era', a: 254, b: 356, light: 'sepia' },
  { id: 'small', a: 357, b: 412, light: 'sepia' },
  { id: 'storm1', a: 413, b: 513, light: 'storm' },
  { id: 'storm2', a: 514, b: 594, light: 'storm' },
  { id: 'storm3', a: 595, b: 654, light: 'storm' },
  { id: 'seen', a: 655, b: 724, light: 'storm' },
  { id: 'swim', a: 725, b: 824, light: 'storm' },
  { id: 'haul', a: 825, b: 1034, light: 'storm' },
  { id: 'morning', a: 1035, b: 1140, light: 'dawn' },
  { id: 'speak', a: 1141, b: 1265, light: 'dawn' },
  { id: 'years', a: 1266, b: 1365, light: 'day' },
  { id: 'crossing', a: 1366, b: 1511, light: 'day' },
  { id: 'salute', a: 1512, b: 1588, light: 'day' },
  { id: 'horn', a: 1589, b: 1687, light: 'day' },
  { id: 'hookq', a: 1688, b: 1815, light: 'dusk' },
  { id: 'hook', a: 1816, b: 1864, light: 'dusk' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights / mood grades ----------
const WATER = { waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' };
const WATER_STORM = { waterDeep: '#14242e', waterShal: '#24404e', glint: '#9fb6c2' };
export const LIGHTS = {
  morning: { az: 118, el: 36, sky: '#a8d4e8', ground: '#7a8a5a', hemi: 1.05, sun: '#fff2d0', sunI: 2.3, fog: '#cfe4ea', fogNear: 45, fogFar: 340,
    skyTop: '#3f7ec2', skyHor: '#cfe8f2', sunDisc: '#fff6da', sunSize: 0.0038, sat: 1.05, vig: 0.22, shadowExt: 20, aurora: 0, gain: '#fff4e0', ...WATER },
  day: { az: 155, el: 55, sky: '#a5d8f0', ground: '#7f9455', hemi: 1.12, sun: '#fff6dc', sunI: 2.5, fog: '#d4ecf4', fogNear: 50, fogFar: 360,
    skyTop: '#2f6fd0', skyHor: '#d8f0f8', sunDisc: '#fff8e2', sunSize: 0.0034, sat: 1.1, vig: 0.2, shadowExt: 20, aurora: 0, gain: '#fff6e4', ...WATER },
  sepia: { az: 205, el: 30, sky: '#d9bd8f', ground: '#6b5636', hemi: 0.98, sun: '#ffdf9e', sunI: 2.1, fog: '#e3cda3', fogNear: 42, fogFar: 300,
    skyTop: '#7a6a4a', skyHor: '#ecd9ae', sunDisc: '#ffedb8', sunSize: 0.0042, sat: 0.78, vig: 0.3, shadowExt: 20, aurora: 0, gain: '#ffe9c0', ...WATER },
  storm: { az: 225, el: 16, sky: '#5d6d7c', ground: '#2c363c', hemi: 0.52, sun: '#a9bfd2', sunI: 0.65, fog: '#47565f', fogNear: 26, fogFar: 210,
    skyTop: '#232f3c', skyHor: '#67798a', sunDisc: '#c8d4de', sunSize: 0.002, sat: 0.72, vig: 0.36, shadowExt: 20, aurora: 0, gain: '#c9d4dc', ...WATER_STORM },
  dawn: { az: 128, el: 24, sky: '#c4b49a', ground: '#5f5138', hemi: 0.95, sun: '#ffc98a', sunI: 2.1, fog: '#e0cdb0', fogNear: 44, fogFar: 320,
    skyTop: '#4a5f8c', skyHor: '#f4cf9e', sunDisc: '#fff0cd', sunSize: 0.004, sat: 1.0, vig: 0.27, shadowExt: 20, aurora: 0, gain: '#ffeeda', ...WATER },
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
  if (S.id === 'haul') return blendLight(LIGHTS.storm, LIGHTS.dawn, smooth(ramp(f, 900, 1034)));
  return { ...LIGHTS[S.light] };
};

// ---------- island geometry helpers (same island as island-car3) ----------
const D2R = Math.PI / 180;
export const E = (thDeg) => [24 * Math.cos(thDeg * D2R), 17 * Math.sin(thDeg * D2R)];
export const ET = (thDeg) => { const t = [-24 * Math.sin(thDeg * D2R), 17 * Math.cos(thDeg * D2R)]; const l = Math.hypot(t[0], t[1]); return [t[0] / l, t[1] / l]; };
export const EOUT = (thDeg) => { const p = E(thDeg); const l = Math.hypot(p[0], p[1]); return [p[0] / l, p[1] / l]; };
export const yawOf = (hx, hz) => Math.atan2(-hz, hx);
export const rot2 = (lx, lz, yaw) => [lx * Math.cos(yaw) + lz * Math.sin(yaw), -lx * Math.sin(yaw) + lz * Math.cos(yaw)];
export const rampY = (x) => x <= 31 ? 0 : x <= 32.8 ? -0.05 : x >= 35.2 ? -1.15 : lerp(-0.05, -1.15, smooth(ramp(x, 32.8, 35.2)));
export const thOfPos = (x, z) => { const t = Math.atan2(z, x) / D2R; return t < 0 ? t + 360 : t; };

// ---------- staging points ----------
export const BOARD_POS = [4.2, 3.15, 10.6];
export const ERA_POS = [26.2, 2.2, 3.8];
export const CLIFF_SIGN = [16.3, -9.0];
export const FISH = [E(156)[0] * 0.865, E(156)[1] * 0.865];
export const CARTP = [E(245)[0] * 0.855, E(245)[1] * 0.855];
export const BANDP = [E(295)[0] * 0.865, E(295)[1] * 0.865];
export const DITCHP = (() => { const e = E(295), t = ET(295); return [e[0] * 0.72 + t[0] * 2.2, e[1] * 0.72 + t[1] * 2.2]; })();
export const CHICKP = E(215);
export const CHICKC = [CHICKP[0] + EOUT(215)[0] * 1.5, CHICKP[1] + EOUT(215)[1] * 1.5];
export const chickPosAt = (i, k) => [CHICKC[0], CHICKC[1]];   // no chickens in this story (kept for main.js imports)
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
export const BASKETS = [[-20.25, 5.45], [-17.53, 6.33]];
export const FISHBOAT_YAW = 2.42;
export const FISHBOAT = [-16.51, 9.47];
export const WRECK = { x: 30.5, z: -4.6, ry: 2.9 };
export const OFFICER_POS = [25.9, 2.6];

// ---------- car tracks ----------
// Golden car: stopped at the Eagle Cliff bend (theta 344.3 — the exact
// stop pose island-car3 proved, nose ~0.25 short of the turtle's pause).
const poseAtTheta = (th) => { const p = E(th), t = ET(th); return { x: p[0], z: p[1], yaw: yawOf(t[0], t[1]) }; };
export const GOLD_POSE = poseAtTheta(344.3);
export const CAR = [];
for (let f = 0; f < TOTAL; f++) CAR.push({ ...GOLD_POSE, speed: 0, wheelRot: 0, pitchS: 0, steer: 0.14 });
export const carAt = (f) => CAR[clamp(Math.round(f), 0, TOTAL - 1)];
// Teal car: queued at theta 329 in the present bookends; in the YEARS
// montage it drives the ring 250 -> 329 and stops behind the golden car.
const TH2 = (f) => {
  if (f < 1266) return 329;
  if (f <= 1300) return lerp(250, 275, smooth(ramp(f, 1266, 1300)));
  if (f <= 1340) return lerp(275, 322, smooth(ramp(f, 1300, 1340)));
  if (f <= 1365) return lerp(322, 329, smooth(ramp(f, 1340, 1365)));
  return 329;
};
export const CAR2 = [];
{
  let wheel = 0, prev = null;
  for (let f = 0; f < TOTAL; f++) {
    const p = poseAtTheta(TH2(f));
    let speed = 0;
    if (prev) { const d = Math.hypot(p.x - prev.x, p.z - prev.z); speed = d * 30; if (f >= 1266 && f <= 1365) wheel += d / 0.36; }
    CAR2.push({ ...p, speed, wheelRot: wheel, pitchS: 0, steer: 0 });
    prev = p;
  }
}
export const car2At = (f) => CAR2[clamp(Math.round(f), 0, TOTAL - 1)];
const CAR_ON = (f) => ['drone', 'queue', 'years', 'crossing', 'salute', 'horn', 'hookq', 'hook'].includes(shotAt(f).id);
const CAR2_ON = (f) => ['queue', 'years', 'crossing', 'salute', 'horn'].includes(shotAt(f).id);

// ---------- the turtle track (one turtle per era; scale marks the era) ----------
// Waypoints [f, x, z, y, scale, swim] — smooth-lerped between keys.
const TWAY = [
  [0, 22.3, -0.6, 0, 1, 0], [141, 24.32, -1.52, 0, 1, 0], [253, 26.6, -1.68, 0, 1, 0],
  [254, 24.6, -1.3, 0, 0.45, 0], [356, 24.6, -1.3, 0, 0.45, 0], [412, 25.3, -1.5, 0, 0.45, 0],
  [413, 34.6, -2.1, -1.02, 0.45, 1], [654, 34.6, -2.1, -1.02, 0.45, 1], [724, 34.6, -2.1, -1.02, 0.45, 1],
  [724, 34.6, -2.1, -1.02, 0.45, 1], [762, 36.3, -4.9, -1.04, 0.45, 1], [790, 34.0, -6.2, -1.04, 0.45, 1],
  [814, 32.6, -6.3, -1.03, 0.45, 1], [834, 32.6, -6.3, -1.03, 0.45, 1], [870, 34.2, -6.1, -1.04, 0.45, 1],
  [905, 35.7, -3.6, -1.0, 0.45, 1], [1034, 35.7, -3.6, -1.0, 0.45, 0],
  [1035, 34.3, -2.45, -0.8, 0.45, 0], [1265, 34.3, -2.45, -0.8, 0.45, 0],
  [1266, 22.3, -0.6, 0, 1, 0], [1365, 22.3, -0.6, 0, 1, 0], [1430, 24.32, -1.52, 0, 1, 0], [1511, 27.6, -1.85, 0, 1, 0],
  [1588, 30.6, -2.05, 0, 1, 0], [1687, 32.8, -2.1, 0, 1, 0], [1688, 32.8, -2.1, 0, 1, 0],
];
const TURT_ON = (f) => !['hookq', 'hook'].includes(shotAt(f).id);
export const TURT = [];
{
  let dist = 0, prev = null;
  for (let f = 0; f < TOTAL; f++) {
    let x = TWAY[0][1], z = TWAY[0][2], y = TWAY[0][3], sc = TWAY[0][4], swim = TWAY[0][5];
    for (let i = 1; i < TWAY.length; i++) {
      if (f <= TWAY[i][0]) {
        const a = TWAY[i - 1], b = TWAY[i], u = smooth(ramp(f, a[0], b[0]));
        x = lerp(a[1], b[1], u); z = lerp(a[2], b[2], u); y = lerp(a[3], b[3], u); sc = lerp(a[4], b[4], u); swim = u < 0.5 ? a[5] : b[5];
        break;
      }
      x = TWAY[TWAY.length - 1][1]; z = TWAY[TWAY.length - 1][2]; y = TWAY[TWAY.length - 1][3]; sc = TWAY[TWAY.length - 1][4]; swim = TWAY[TWAY.length - 1][5];
    }
    if (prev) dist += Math.hypot(x - prev.x, z - prev.z);
    let yaw = prev && (Math.abs(x - prev.x) > 1e-5 || Math.abs(z - prev.z) > 1e-5) ? yawOf(x - prev.x, z - prev.z) : (prev ? prev.yaw : 0.4);
    if (f >= 655 && f <= 724) yaw = lerp(yawOf(1, 0.1), yawOf(-2.7, -1.2), smooth(ramp(f, 672, 700)));
    if (f >= 413 && f <= 654) yaw = yawOf(-2.7, -1.2);           // watching the wreck from the shallows
    if (f >= 815 && f <= 905) { // the turn-around at the wreck, blended over the grab pause so the follow frame never flips
      const target = yawOf(2.2, 1.1);
      let d = target - yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      yaw = yaw + d * smooth(ramp(f, 808, 848));
    }
    if (f >= 1035 && f <= 1265) yaw = -0.5;                       // beside the chief on the sand
    const yawn = f >= 1648 && f <= 1670 ? Math.sin(ramp(f, 1648, 1670) * Math.PI) : 0;
    TURT.push({ x, z, y, yaw, step: dist / (0.14 * Math.max(sc, 0.3)) * Math.PI, on: TURT_ON(f) ? 1 : 0, yawn, dist, scale: sc, swim });
    prev = { x, z, yaw };
  }
}
export const turtAt = (f) => TURT[clamp(Math.round(f), 0, TOTAL - 1)];
export const turtleHeadAt = (f) => {
  const t = turtAt(f), hd = [Math.cos(t.yaw), -Math.sin(t.yaw)], s = t.scale;
  return [t.x + hd[0] * 0.87 * s, t.y + 0.42 * s, t.z + hd[1] * 0.87 * s];
};

// ---------- Chief Toma track (flashback) ----------
const CWAY = [
  [254, 23.5, -0.5, 0], [356, 23.5, -0.5, 0], [357, 23.9, -0.9, 0], [412, 23.9, -0.9, 0],
  [413, 32.15, -3.15, -0.85], [919, 32.15, -3.15, -0.85],
  [1000, 33.9, -2.5, -0.35], [1034, 33.9, -2.5, -0.35],
  [1035, 33.6, -3.2, -0.34], [1265, 33.6, -3.2, -0.34],
];
export const CHIEF = [];
for (let f = 0; f < TOTAL; f++) {
  let x = CWAY[0][1], z = CWAY[0][2], y = CWAY[0][3];
  for (let i = 1; i < CWAY.length; i++) {
    if (f <= CWAY[i][0]) {
      const a = CWAY[i - 1], b = CWAY[i];
      const u = (a[0] >= 919 && f >= 920) ? 1 - (1 - ramp(f, a[0], b[0])) ** 2 : smooth(ramp(f, a[0], b[0]));
      x = lerp(a[1], b[1], u); z = lerp(a[2], b[2], u); y = lerp(a[3], b[3], u);
      break;
    }
    x = CWAY[CWAY.length - 1][1]; z = CWAY[CWAY.length - 1][2]; y = CWAY[CWAY.length - 1][3];
  }
  CHIEF.push({ x, z, y });
}
export const chiefAt = (f) => CHIEF[clamp(Math.round(f), 0, TOTAL - 1)];

// ---------- the rope (story-computed polyline; main.js draws struts) ----------
export const ropeAt = (f) => {
  const S = shotAt(f).id;
  if (!['storm1', 'storm2', 'storm3', 'seen', 'swim', 'haul'].includes(S)) return null;
  const ch = chiefAt(f), leg = [ch.x, ch.y + 0.12, ch.z];
  const cleat = [30.9, -0.1, -4.35];
  if (f < 815) {
    const mid = [(cleat[0] + leg[0]) / 2, -1.0, (cleat[2] + leg[2]) / 2];
    return [cleat, mid, leg];
  }
  const mouth = turtleHeadAt(f);
  if (f <= 905) {
    const mid = [(leg[0] + mouth[0]) / 2, -0.92, (leg[2] + mouth[2]) / 2];
    return [leg, mid, mouth];
  }
  if (f <= 1000) {
    const hands = [34.35, 0.05, -2.55];
    const mid = [(leg[0] + hands[0]) / 2, lerp(-0.9, -0.45, ramp(f, 905, 1000)), (leg[2] + hands[2]) / 2];
    return [leg, mid, hands];
  }
  return [[ch.x, ch.y + 0.1, ch.z], [34.3, -0.75, -2.6], [34.75, -0.5, -2.2]];
};

// ---------- hero / focus ----------
const FOCUS = {
  drone: () => [24.3, 0.4, -1.6], queue: () => { const t = turtAt(200); return [t.x, 0.5, t.z]; },
  era: () => [23.5, 1.2, -0.5], small: () => [24.9, 0.3, -1.4],
  storm1: () => [30.5, -0.2, -4.6], storm2: () => [32.15, 0.1, -3.15], storm3: () => [32.15, 0.2, -3.15],
  seen: () => [34.6, -0.6, -2.1], swim: () => { const t = turtAt(770); return [t.x, -0.6, t.z]; },
  haul: () => [33.4, -0.3, -2.8], morning: () => [33.95, -0.3, -2.85], speak: () => [33.7, 0.4, -3.15],
  years: () => { const c = car2At(1320); return [c.x, 0.9, c.z]; },
  crossing: () => { const t = turtAt(1440); return [t.x, 0.4, t.z]; },
  salute: () => [26.6, 1.0, 0.6], horn: () => [31.8, 0.3, -2.05],
  hookq: () => BOARD_POS, hook: () => BOARD_POS,
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id]();

// ---------- cameras: EVERY shot is a camrig track on a subject ----------
const turtPos = (f) => { const t = turtAt(f); return [t.x, t.y, t.z]; };
const chiefPos = (f) => { const c = chiefAt(f); return [c.x, c.y, c.z]; };
const car2Pos = (f) => { const c = car2At(f); return [c.x, 0, c.z]; };
const car2Frame = (f) => { const c = car2At(f); return { fwd: [Math.cos(c.yaw), -Math.sin(c.yaw)], side: EOUT(thOfPos(c.x, c.z)) }; };
const turtFrame = (f) => { const t = turtAt(f); const fw = [Math.cos(t.yaw), -Math.sin(t.yaw)]; return { fwd: fw, side: [fw[1], -fw[0]] }; };
const bezierCam = (P, L, a, b, fov0, fov1) => (f) => {
  const u = M.smooth(ramp(f, a, b));
  const w0 = (1 - u) ** 3, w1 = 3 * (1 - u) ** 2 * u, w2 = 3 * (1 - u) * u * u, w3 = u ** 3;
  const mix = (Q) => [0, 1, 2].map((j) => w0 * Q[0][j] + w1 * Q[1][j] + w2 * Q[2][j] + w3 * Q[3][j]);
  return { pos: mix(P), look: mix(L), fov: lerp(fov0, fov1, u), roll: 0 };
};
const RIG_BY_ID = {
  drone: { cut: 'hard', raw: bezierCam(
    [[20, 26, 86], [4, 15, 46], [9, 6.5, 25], [19.0, 3.2, 7.0]],
    [[2, 1, 4], [4.2, 2.75, 10.6], [7.5, 2.2, 9.0], [24.3, 0.4, -1.6]], 0, 141, 47, 39) },
  queue: { cut: 'blend', blend: 10, raw: staticTrackCam({ pos: [33.6, 3.4, 9.4], subject: turtPos, lookOff: [0, 0.45, 0], fov: 47 }) },
  era: { cut: 'hard', raw: keysCam({ keys: [
    { f: 254, pos: [26.2, 2.5, 10.6], look: [26.2, 2.1, 3.8], fov: 38 },
    { f: 304, pos: [26.2, 2.5, 10.6], look: [26.2, 2.1, 3.8], fov: 38, ease: 'easeInOut' },
    { f: 356, pos: [27.9, 1.85, 3.3], look: [23.5, 1.15, -0.5], fov: 34, ease: 'surge' }] }) },
  small: { cut: 'hard', raw: staticTrackCam({ pos: [31.6, 0.7, -0.1], subject: turtPos, lookOff: [0, 0.22, 0], fov: 30 }) },
  storm1: { cut: 'hard', raw: keysCam({ keys: [
    { f: 413, pos: [38.2, 1.3, -7.8], look: [30.5, -0.3, -4.6], fov: 34 },
    { f: 513, pos: [37.5, 1.2, -7.5], look: [30.7, -0.3, -4.55], fov: 31, ease: 'surge' }] }) },
  storm2: { cut: 'hard', raw: keysCam({ keys: [
    { f: 514, pos: [36.9, 1.05, -6.4], look: [32.15, 0.32, -3.15], fov: 32 },
    { f: 594, pos: [36.4, 0.98, -6.05], look: [32.15, 0.32, -3.15], fov: 29, ease: 'surge' }] }) },
  storm3: { cut: 'hard', raw: keysCam({ keys: [
    { f: 595, pos: [36.6, 1.0, -6.2], look: [32.15, 0.35, -3.15], fov: 30 },
    { f: 654, pos: [36.1, 0.95, -5.9], look: [32.15, 0.35, -3.15], fov: 28, ease: 'surge' }] }) },
  seen: { cut: 'hard', raw: keysCam({ keys: [
    { f: 655, pos: [37.6, 0.9, -0.4], look: [33.35, -0.55, -2.62], fov: 33 },
    { f: 724, pos: [37.1, 0.85, -0.6], look: [33.35, -0.55, -2.62], fov: 30, ease: 'surge' }] }) },
  swim: { cut: 'hard', raw: staticTrackCam({ pos: [38.6, 0.5, -8.2], subject: turtPos, lookOff: [0, 0.25, 0], fov: 33 }) },
  haul: { cut: 'hard', raw: keysCam({ keys: [
    { f: 825, pos: [38.6, 2.2, -8.6], look: [33.55, -0.25, -2.8], fov: 37 },
    { f: 1034, pos: [37.4, 1.9, -7.6], look: [34.6, -0.15, -2.7], fov: 33, ease: 'surge' }] }) },
  morning: { cut: 'blend', blend: 12, raw: keysCam({ keys: [
    { f: 1035, pos: [38.6, 1.2, -6.4], look: [33.95, -0.1, -2.85], fov: 34 },
    { f: 1140, pos: [37.9, 1.05, -6.0], look: [33.95, -0.1, -2.85], fov: 31, ease: 'surge' }] }) },
  speak: { cut: 'hard', raw: pushInCam({ subject: () => [33.95, 0, -2.85], dir: () => [0.83, 0.55], d0: 5.4, d1: 4.4, h0: 0.75, h1: 0.65, a: 1141, b: 1265, lookOff: [0, 0.45, 0], fov0: 34, fov1: 30 }) },
  years: { cut: 'hard', raw: chaseCam({ subject: car2Pos, frame: car2Frame, back: 6.2, h: 2.0, lookAhead: 4, lookH: 0.85, fov: 42 }) },
  crossing: { cut: 'hard', raw: pushInCam({ subject: turtPos, dir: () => [-0.75, 0.45], d0: 5.2, d1: 3.0, h0: 1.3, h1: 0.8, a: 1366, b: 1511, lookOff: [0, 0.30, 0], fov0: 36, fov1: 27 }) },
  salute: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1512, pos: [33.5, 1.6, -5.6], look: [25.9, 1.05, 2.6], fov: 34 },
    { f: 1588, pos: [32.9, 1.5, -5.2], look: [26.3, 1.0, 2.2], fov: 32, ease: 'surge' }] }) },
  horn: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1589, pos: [28.8, 1.5, 3.6], look: [23.8, 1.05, -4.5], fov: 34 },
    { f: 1628, pos: [28.8, 1.5, 3.6], look: [23.8, 1.05, -4.5], fov: 34, ease: 'easeInOut' },
    { f: 1660, pos: [29.4, 1.35, 3.0], look: [31.8, 0.25, -2.05], fov: 32, ease: 'surge' },
    { f: 1687, pos: [29.4, 1.35, 3.0], look: [31.8, 0.25, -2.05], fov: 31, ease: 'surge' }] }) },
  hookq: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1688, pos: [12.8, 3.0, 23.2], look: [4.4, 2.3, 11.2], fov: 43 },
    { f: 1750, pos: [10.9, 3.3, 22.2], look: [4.25, 2.95, 10.75], fov: 40, ease: 'surge' },
    { f: 1815, pos: [10.1, 3.35, 21.6], look: [4.22, 3.0, 10.65], fov: 38, ease: 'surge' }] }) },
  hook: { cut: 'blend', blend: 8, raw: keysCam({ keys: [
    { f: 1816, pos: [10.1, 3.35, 21.6], look: [4.22, 3.0, 10.65], fov: 38 },
    { f: 1864, pos: [9.8, 3.4, 21.3], look: [4.2, 3.02, 10.62], fov: 37, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: 985, a: 0.04 }, { f: 1092, a: 0.03 }],
  sigma: 2.3, fovSigma: 1.6,
});
// lightning (lighthouse choreography): dim ~30% over 9f, build over 8f,
// recover over 12f — carried on the camera flash channel into the ink pass.
const STRIKES = [470, 622, 690];
const flashAt = (f) => {
  let v = 0;
  for (const F of STRIKES) {
    if (f >= F - 9 && f < F) v -= 0.30 * smooth(ramp(f, F - 9, F));
    else if (f >= F && f < F + 8) v += 0.55 * smooth(ramp(f, F, F + 8));
    else if (f >= F + 8 && f < F + 16) v += 0.55 * (1 - smooth(ramp(f, F + 8, F + 16)));
  }
  return clamp(v * 0.22, -0.08, 0.13);
};
export const camAt = (f) => { const c = RIG.camAt(f); return { ...c, flash: flashAt(f) }; };
export const RIG_META = {
  kicks: RIG.declared.kicks, hardCuts: RIG.declared.hardCuts,
  blends: SHOTS.filter((s) => RIG_BY_ID[s.id].cut === 'blend').map((s) => ({ a: s.a - Math.floor(RIG_BY_ID[s.id].blend / 2), b: s.a + Math.ceil(RIG_BY_ID[s.id].blend / 2) })),
  whips: [...RIG.declared.whips],
  samples: RIG.samples,
};
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), hp = heroPosAt(f);
  let cinf = 2.4;
  if (['drone', 'storm1', 'haul'].includes(S.id)) cinf = 1.4;
  if (['small', 'seen', 'swim', 'storm3', 'speak', 'crossing'].includes(S.id)) cinf = 3.6;
  if (['hook', 'hookq', 'era'].includes(S.id)) cinf = 3.0;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f), c = carAt(f), c2 = car2At(f), t = turtAt(f);
  const W = {
    boardTitle: 0, boardEra: 0, boardHook: 0,
    carOn: CAR_ON(f) ? 1 : 0, carX: c.x, carZ: c.z, carYaw: c.yaw, carPitch: c.pitchS || 0, wheelRot: c.wheelRot, carSpeed: 0, carSteer: c.steer || 0,
    car2On: CAR2_ON(f) ? 1 : 0, car2X: c2.x, car2Z: c2.z, car2Yaw: c2.yaw, car2Wheel: c2.wheelRot,
    roofK: 1, glintK: 0, glowK: 0,
    turtleX: t.x, turtleZ: t.z, turtleY: t.y, turtleYaw: t.yaw, turtleStep: t.step, turtleOn: t.on, turtleYawn: t.yawn,
    turtleScale: t.scale, turtleSwim: t.swim,
    badgeK: 0, badgeGlint: 0, rainK: 0, splashK: 0,
    ropePts: ropeAt(f),
    chickenK: 0, featherK: 0, dustChicken: 0, dustSeller: 0, dustBand: 0, dustBrake: 0,
  };
  if (S.id === 'drone') W.boardTitle = smooth(ramp(f, 44, 56)) * (1 - smooth(ramp(f, 58, 69)));
  if (S.id === 'era') W.boardEra = smooth(ramp(f, 260, 274)) * (1 - smooth(ramp(f, 292, 304)));
  if (S.id === 'hookq') W.boardHook = smooth(ramp(f, 1745, 1765));
  if (S.id === 'hook') W.boardHook = 1;   // held at FULL opacity to the literal last frame
  if (S.id === 'drone') W.glintK = Math.sin(ramp(f, 100, 141) * Math.PI) * 0.8;
  if (f >= 1096) W.badgeK = 1; else if (f >= 1088) W.badgeK = ramp(f, 1088, 1096);
  if (f >= 1088 && f <= 1114) W.badgeGlint = Math.sin(ramp(f, 1088, 1114) * Math.PI);
  if (f >= 1438 && f <= 1474) W.badgeGlint = Math.sin(ramp(f, 1438, 1474) * Math.PI);
  if (f >= 1540 && f <= 1558) W.badgeGlint = 0.7 * Math.sin(ramp(f, 1540, 1558) * Math.PI);
  if (['storm1', 'storm2', 'storm3', 'seen', 'swim', 'haul'].includes(S.id)) {
    W.rainK = S.id === 'haul' ? 1 - 0.85 * ramp(f, 825, 1000) : S.id === 'swim' ? 0.7 : S.id === 'seen' ? 0.9 : 1;
    if (S.id === 'storm1') W.rainK = ramp(f, 413, 440);
    W.splashK = 1;
  }
  if (S.id === 'horn' && f >= 1610 && f <= 1642) W.carPitch = 0.012 * Math.sin((f - 1610) * 0.9) * (1 - ramp(f, 1630, 1642)); // horn-press shudder
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  const storm = ['storm1', 'storm2', 'storm3', 'seen', 'swim', 'haul'].includes(S.id);
  const harbour = ['drone', 'hookq', 'hook'].includes(S.id);
  return { smokeRate: storm ? 0.3 : harbour ? 0.14 : 0.05, dustRate: 0.04, splashRate: 0 };
};

// ---------- cast (single source for actors AND colliders) ----------
const TINT = { morning: '#ffffff', day: '#ffffff', sepia: '#ffe2b0', storm: '#b9c8d4', dawn: '#ffe9d2', dusk: '#e8d4f2' };
const tintFor = (S) => TINT[S.light] || '#ffffff';
export const OUTFITS = {
  chief: { jacket: '#1f3a6e', pants: '#16294d', boots: '#1c1710', hat: 'cap', cap: '#16294d', skin: '#c98a5a', moustache: '#2c1e12' },
  officer: { jacket: '#1f3a6e', pants: '#16294d', boots: '#1c1710', hat: 'cap', cap: '#1b2f52', skin: '#a06a3c' },
  rich: { jacket: '#ff7847', pants: '#f2ede2', boots: '#7a4a26', hat: 'cap', cap: '#f7f3e6', skin: '#e8b08a' },
  driver2: { jacket: '#37474f', pants: '#263238', boots: '#241a12', hat: 'cap', cap: '#10151c', skin: '#8a5f36' },
  fisher1: { jacket: '#5d7a8a', pants: '#4a4238', boots: '#2c2118', hat: 'cap', cap: '#8a2f2a', skin: '#c98a5a' },
  fisher2: { jacket: '#8a7a4a', pants: '#3d4a42', boots: '#2c2118', hat: 'hair', hair: '#241a12', skin: '#a06a3c', moustache: '#2c1e12' },
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
// fishermen shore spots: storm watch -> haul grab (lerped 890-905)
const fisherPos = (f) => {
  const u = smooth(ramp(f, 890, 905));
  return {
    f1: [lerp(32.9, 34.55, u), lerp(-0.3, -0.95, u), lerp(-3.75, -3.05, u)],
    f2: [lerp(34.0, 34.3, u), lerp(-0.5, -0.87, u), lerp(-1.5, -1.35, u)],
  };
};
export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, y, z, ground, extra = {}) => out.push({ id, x, y, z, r: 0.32, ground,
    actor: (T) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x, y, z, ground: ground ?? y, tint, ...extra }) });
  const driverIn = (id, o, expr, car, seed) => {
    const off = rot2(-0.15, -0.42, car.yaw);
    const opts = { expr, mode: 'sit', blink: blinkAt(f, seed), seed };
    const x = car.x + off[0], z = car.z + off[1];
    out.push({ id, x, y: 0.43, z, r: 0.3, ground: null,
      actor: (T) => ({ key: id + JSON.stringify(opts), draw: (p) => { T.bodyFront(p, o, opts); if (id === 'driver') shades(T, seed, 'sit')(p); }, x, y: 0.43, z, ground: 0, tint, s: 0.85, blob: false }) });
  };
  const officerAt = (saluting) => {
    const opts = saluting
      ? { expr: 'stern', mode: 'stand', blink: blinkAt(f, 63), seed: 63, wave: 0.1 }
      : { expr: 'smile', mode: 'stand', blink: blinkAt(f, 63), seed: 63 };
    std('officer', OUTFITS.officer, opts, OFFICER_POS[0], 0, OFFICER_POS[1], 0, { yaw: -0.5 });
  };
  const chiefStand = (opts, x, y, z, ground) => std('chief', OUTFITS.chief, opts, x, y, z, ground, { yaw: 0.9 });
  const fishermen = (hauling) => {
    const { f1, f2 } = fisherPos(f);
    const hk = hauling ? q(0.45 + 0.3 * Math.sin(f * 0.35), 2) : 0;
    std('fisher1', OUTFITS.fisher1, hauling ? { expr: 'stern', mode: 'stand', blink: blinkAt(f, 61), seed: 61, prop: ['point', hk] } : { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 61), seed: 61 }, f1[0], f1[1], f1[2], f1[1], { yaw: -1.2 });
    std('fisher2', OUTFITS.fisher2, hauling ? { expr: 'stern', mode: 'stand', blink: blinkAt(f, 62), seed: 62, prop: ['point', q(1 - hk, 2)] } : { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 62), seed: 62 }, f2[0], f2[1], f2[2], f2[1], { yaw: -1.0 });
  };
  switch (S.id) {
    case 'drone': {
      driverIn('driver', OUTFITS.rich, 'smile_closed', carAt(f), 41);
      officerAt(false);
      break;
    }
    case 'queue': {
      driverIn('driver', OUTFITS.rich, 'smile_closed', carAt(f), 41);
      driverIn('driver2', OUTFITS.driver2, 'smile_closed', car2At(f), 43);
      officerAt(false);
      break;
    }
    case 'era': {
      chiefStand({ expr: 'smile', mode: 'stand', blink: blinkAt(f, 52), seed: 52 }, 23.5, 0, -0.5, 0);
      break;
    }
    case 'small': {
      chiefStand({ expr: 'smile', mode: 'stand', blink: blinkAt(f, 52), seed: 52 }, 23.9, 0, -0.9, 0);
      break;
    }
    case 'storm1': case 'storm2': case 'storm3': {
      const ch = chiefAt(f), bob = Math.sin(f * 0.11) * 0.03;
      const expr = S.id === 'storm1' ? 'nervous' : S.id === 'storm2' ? 'pained' : 'shock';
      out.push({ id: 'chief', x: ch.x, y: ch.y + bob, z: ch.z, r: 0.32, ground: null,
        actor: (T) => ({ key: 'chiefStorm' + expr + blinkAt(f, 52), draw: (p) => T.bodyFront(p, OUTFITS.chief, { expr, mode: 'sit', blink: blinkAt(f, 52), seed: 52 }), x: ch.x, y: ch.y + bob, z: ch.z, ground: 0, tint, blob: false }) });
      fishermen(false);
      break;
    }
    case 'seen': {
      const ch = chiefAt(f);
      out.push({ id: 'chief', x: ch.x, y: ch.y, z: ch.z, r: 0.32, ground: null,
        actor: (T) => ({ key: 'chiefSeen' + blinkAt(f, 52), draw: (p) => T.bodyFront(p, OUTFITS.chief, { expr: 'nervous', mode: 'sit', blink: blinkAt(f, 52), seed: 52 }), x: ch.x, y: ch.y, z: ch.z, ground: 0, tint, blob: false }) });
      fishermen(false);
      break;
    }
    case 'swim': {
      const ch = chiefAt(f);
      out.push({ id: 'chief', x: ch.x, y: ch.y, z: ch.z, r: 0.32, ground: null,
        actor: (T) => ({ key: 'chiefSwim' + blinkAt(f, 52), draw: (p) => T.bodyFront(p, OUTFITS.chief, { expr: 'nervous', mode: 'sit', blink: blinkAt(f, 52), seed: 52 }), x: ch.x, y: ch.y, z: ch.z, ground: 0, tint, blob: false }) });
      fishermen(false);
      break;
    }
    case 'haul': {
      const ch = chiefAt(f);
      const expr = f >= 1001 ? 'relief' : 'pained';
      out.push({ id: 'chief', x: ch.x, y: ch.y, z: ch.z, r: 0.32, ground: f >= 1001 ? -0.35 : null,
        actor: (T) => ({ key: 'chiefHaul' + expr + blinkAt(f, 52), draw: (p) => T.bodyFront(p, OUTFITS.chief, { expr, mode: 'sit', blink: blinkAt(f, 52), seed: 52 }), x: ch.x, y: ch.y, z: ch.z, ground: -0.35, tint, blob: false }) });
      fishermen(f >= 905);
      break;
    }
    case 'morning': {
      const pin = f >= 1075 && f <= 1105 ? q(Math.sin(ramp(f, 1075, 1105) * Math.PI), 2) : 0;
      const opts = { expr: 'smile', mode: 'stand', blink: blinkAt(f, 52), seed: 52, ...(pin > 0.02 ? { prop: ['point', pin] } : {}) };
      chiefStand(opts, 33.6, -0.34, -3.2, -0.34);
      break;
    }
    case 'speak': {
      // THE dialogue beat: Chief Toma PERFORMS the quoted line — mouth on
      // the voice (speakFace), camera holds on him + the turtle.
      chiefStand({ expr: 'smile', mode: 'stand', blink: blinkAt(f, 52), seed: 52, look: 0.2, ...speakFace('stern', f) }, 33.6, -0.34, -3.2, -0.34);
      break;
    }
    case 'years': {
      driverIn('driver2', OUTFITS.driver2, 'smile_closed', car2At(f), 43);
      break;
    }
    case 'crossing': {
      driverIn('driver', OUTFITS.rich, 'smile_closed', carAt(f), 41);
      officerAt(false);
      break;
    }
    case 'salute': {
      driverIn('driver', OUTFITS.rich, 'smile_closed', carAt(f), 41);
      officerAt(true);
      break;
    }
    case 'horn': {
      driverIn('driver', OUTFITS.rich, 'stern', carAt(f), 41);
      officerAt(false);
      break;
    }
    case 'hookq': case 'hook': break;
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));
export const fxAt = () => [];

// ---------- solidity: statics, dynamics, ground ----------
const ARCHC = [E(295)[0] * 0.82, E(295)[1] * 0.82];
const ARCH_OFF = [Math.cos(0.9) * 1.3, -Math.sin(0.9) * 1.3];
export const STATICS = [
  ...PALMS.map(([x, z]) => SOL.circle(x, z, 0.22, { h: 4.5, id: 'palm' })),
  ...HUTS.map((h) => SOL.obb(h.x, h.z, h.ry, 1.45 * h.s, 1.2 * h.s, { h: 3.2, id: 'hut' })),
  SOL.obb(CARTP[0], CARTP[1], 0.7, 0.95, 0.62, { h: 1.1, id: 'cart' }),
  SOL.circle(ARCHC[0] + ARCH_OFF[0], ARCHC[1] + ARCH_OFF[1], 0.1, { h: 2.6, id: 'archpost' }),
  SOL.circle(ARCHC[0] - ARCH_OFF[0], ARCHC[1] - ARCH_OFF[1], 0.1, { h: 2.6, id: 'archpost' }),
  SOL.circle(CLIFF_SIGN[0] - 0.553, CLIFF_SIGN[1] + 0.606, 0.08, { h: 1.9, id: 'signpost' }),
  SOL.circle(CLIFF_SIGN[0] + 0.553, CLIFF_SIGN[1] - 0.606, 0.08, { h: 1.9, id: 'signpost' }),
  ...ROCKS.map((r) => SOL.circle(r.x, r.z, r.s * 0.95, { h: r.s * 1.1, id: 'rock' })),
  SOL.circle(BOARD_POS[0] - 2.05, BOARD_POS[2], 0.09, { h: 4.0, id: 'boardpost' }),
  SOL.circle(BOARD_POS[0] + 2.05, BOARD_POS[2], 0.09, { h: 4.0, id: 'boardpost' }),
  SOL.circle(ERA_POS[0] - 1.05, ERA_POS[2], 0.07, { h: 2.6, id: 'erapost' }),
  SOL.circle(ERA_POS[0] + 1.05, ERA_POS[2], 0.07, { h: 2.6, id: 'erapost' }),
  SOL.aabb(-1.15, 1.15, 20.65, 30.15, { h: 0.3, id: 'jetty' }),
  SOL.circle(-7.6, 13.6, 0.52, { h: 1.3, id: 'crates' }),
  SOL.circle(-8.4, 12.6, 0.4, { h: 0.9, id: 'barrel' }),
  SOL.obb(WALL.x, WALL.z, WALL.ry, WALL.len / 2, 0.35, { h: WALL.h, id: 'wall' }),
  SOL.circle(FISH[0] + 1.6, FISH[1] - 1.2, 0.6, { h: 0.5, id: 'net' }),
  SOL.circle(BASKETS[0][0], BASKETS[0][1], 0.32, { h: 0.45, id: 'basket' }),
  SOL.circle(BASKETS[1][0], BASKETS[1][1], 0.32, { h: 0.45, id: 'basket2' }),
  SOL.obb(FISHBOAT[0], FISHBOAT[1], 2.42, 1.75, 0.62, { h: 1.2, id: 'boat' }),
  SOL.obb(WRECK.x, WRECK.z, WRECK.ry, 1.75, 0.62, { h: 1.2, id: 'wreck' }),
];
export const WORLD = SOL.makeWorld(STATICS);
export const dynamicsAt = (f) => {
  const out = [];
  if (CAR_ON(f)) { const c = carAt(f); out.push(SOL.obb(c.x, c.z, c.yaw, 2.24, 0.99, { kind: 'dynamic', id: 'car' })); }
  if (CAR2_ON(f)) { const c = car2At(f); out.push(SOL.obb(c.x, c.z, c.yaw, 2.24, 0.99, { kind: 'dynamic', id: 'car2' })); }
  const t = turtAt(f);
  if (t.on) out.push(SOL.circle(t.x, t.z, 0.78 * t.scale, { kind: 'dynamic', id: 'turtle' }));
  for (const a of castAt(f)) {
    if (a.id === 'driver' || a.id === 'driver2') continue;   // drivers ride INSIDE the cars
    out.push(SOL.circle(a.x, a.z, a.r, { kind: 'dynamic', id: a.id }));
  }
  return out;
};
export const groundItemsAt = (f) => {
  const items = [];
  if (CAR_ON(f)) items.push({ id: 'car', y: 0, ground: 0, maxHover: 0.04 });
  if (CAR2_ON(f)) items.push({ id: 'car2', y: 0, ground: 0, maxHover: 0.04 });
  const t = turtAt(f);
  if (t.on) {
    if (t.swim) items.push({ id: 'turtle', y: t.y, ground: -1.27, maxHover: 0.32 });
    else if (f >= 906 && f <= 1034) items.push({ id: 'turtle', y: t.y, ground: -1.06, maxHover: 0.08 });   // resting in the shallows after the tow
    else if (t.x > 31) items.push({ id: 'turtle', y: t.y, ground: rampY(t.x), maxHover: 0.06 });
    else items.push({ id: 'turtle', y: t.y, ground: 0, maxHover: 0.05 });
  }
  for (const a of castAt(f)) if (a.ground !== null && a.ground !== undefined) items.push({ id: a.id, y: a.y, ground: a.ground, maxHover: 0.06 });
  return items;
};
