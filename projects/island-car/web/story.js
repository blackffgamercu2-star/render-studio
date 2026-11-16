// Shot plan for "The Fastest Man on the Island" (island-car DEMO, EN) —
// built to the enhance-3d-cartoon-short skill: beats of ~1-3 s, cuts on
// word onsets, camera NEVER static (creeping push / tracking / whip /
// smash zoom / POV), action starts 0-3 frames BEFORE its key word,
// impact KICKS at the chicken scatter, the seller dive, the band dive
// and the brake stop; the repeated road-pass gag ESCALATES lap by lap.
// Voice stem: 77.931 s, 30 fps, TOTAL 2338. Timings from faster-whisper
// (small) word alignment on stem_en.wav (256 words, last ends 77.66 s).
// ASR homophones only: Kiri->"Curie", laughed->"loft", Lap->"Lop".
// Clause starts (frames): demand 0 | exactly-one 188 | roof 330
// (button 350, folded 376) | one-road 442 (go-slow 577) | laughed 623 |
// lap-one 706 | fishermen 759 (children 785) | lap-two 844 (chickens
// 886, exploded 894) | seller 938 (dived 959) | lap-three 1007 (band
// 1060, leapt 1074, screamed-past 1147) | cliff 1189 (standing 1288,
// ancient-turtle ~1320, crossing 1351) | brakes 1415 (stopped 1464) |
// honk1 1529 (honked 1541, blink ~1570) | honk2 1604 (honked 1609,
// yawned 1646) | walked 1665 (walked 1768, sea ~1875) | one-hour 1922
// (grinned 1959, on-a-12km 2021) | 90-years 2080 | why 2178 (police
// 2231) | tomorrow 2288.
// World: island ring road = ellipse x=24cos, z=17sin (centre 0,0).
// Zones (deg): harbour 90, fishermen 156, children 195, chickens 215,
// coconut cart 245, wedding 295, Eagle Cliff bend 345 (tightest curve).
// PHYSICS: car wheels ON the road (track y=0), turtle grounded on road
// then on the sand ramp (rampY), characters act in place or travel
// with planted step cycles — no glide.
import { M, camFromKeys, blinkAt, q, clamp, lerp, ramp } from './motion.js';

export const FPS = 30, TOTAL = 2338, DECK = 0;
export const SHOTS = [
  { id: 'title', a: 0, b: 99, light: 'morning' },
  { id: 'demand', a: 100, b: 187, light: 'morning' },
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

// ---------- lights / mood grades ----------
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
// ground height along the turtle's eastward walk: grass 0, sand rim
// -0.05, then the shore slope down to the sea (-1.15 at the waterline)
export const rampY = (x) => x <= 31 ? 0 : x <= 32.8 ? -0.05 : x >= 35.2 ? -1.15 : lerp(-0.05, -1.15, smooth(ramp(x, 32.8, 35.2)));

// ---------- the car track (precomputed per frame) ----------
export const PARK = { x: 4.2, z: 12.8, yaw: yawOf(0.55, 0.83) };
export const PARK2 = { x: 6.8, z: 12.2, yaw: yawOf(0.35, 0.94) };
// theta segments [f0, f1, th0, th1, ease]
const THSEG = [
  [759, 784, 148, 160, 'linear'], [785, 843, 184, 204, 'linear'],
  [844, 893, 206, 221, 'linear'], [894, 937, 221, 233, 'linear'],
  [938, 1006, 234, 253, 'linear'], [1007, 1073, 264, 284, 'linear'],
  [1074, 1188, 285, 313, 'linear'], [1189, 1287, 313, 329, 'linear'],
  [1288, 1319, 330, 335, 'easeOut'], [1320, 1414, 335, 341.5, 'easeOut'],
  [1415, 1461, 341.5, 344.9, 'easeOut'],
];
const thetaAt = (f) => {
  if (f < 706 || f >= 1922) return null;
  if (f <= 758) { // pull-out blend first, then the first cruise
    if (f < 735) return null;
    return lerp(100, 124, (f - 735) / 23);
  }
  for (const [a, b, t0, t1, ez] of THSEG) if (f >= a && f <= b) { const u = (f - a) / (b - a); return lerp(t0, t1, ez === 'easeOut' ? M.easeOut(u) : u); }
  if (f > 1461 && f < 1922) return 344.9;
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
      if (th === null && f >= 706 && f < 735) { // pull-out blend park -> ellipse(100)
        const u = smooth(ramp(f, 706, 735)), ep = E(100), et = ET(100);
        x = lerp(PARK.x, ep[0], u); z = lerp(PARK.z, ep[1], u);
        yaw = lerp(PARK.yaw, yawOf(et[0], et[1]), u); moving = u > 0.02 && u < 0.99 ? 0.5 : 0;
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
  // smooth the pitch (accel is noisy frame to frame)
  for (let f = 0; f < TOTAL; f++) {
    let s = 0, n = 0;
    for (let k = -4; k <= 4; k++) { const j = f + k; if (j >= 0 && j < TOTAL) { s += CAR[j].pitch; n++; } }
    CAR[f].pitchS = s / n;
  }
}
export const carAt = (f) => CAR[clamp(f, 0, TOTAL - 1)];

// ---------- the turtle track (precomputed per frame) ----------
// keyframed path [frame, x, z]; y from rampY once past the road edge.
const TPATH = [
  [0, 21.3, -1.6], [1189, 21.3, -1.6], [1330, 22.6, -1.85], [1500, 24.07, -2.18],
  [1664, 24.5, -2.25], [1768, 25.8, -2.3], [1850, 30.5, -2.15], [1900, 33.8, -2.0], [1921, 35.0, -1.9],
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
    if (f >= 1922 && f <= 2079) { x = 35.2; z = -1.8; y = -1.3; }        // not present at the harbour payoff
    if (f > 2079) { y = -1.24 + 0.03 * Math.sin(f * 0.05); }              // floating in the shallows (years shot)
    const on = (f >= 1189 && f <= 1921) || f > 2079 ? 1 : 0;
    // during the honks the old fellow turns his BODY to face the car and stares it down
    let faceCar = 0;
    if (f > 1500 && f < 1665) faceCar = smooth(ramp(f, 1505, 1560)) * (1 - smooth(ramp(f, 1620, 1664)));
    const yaw = lerp(yawOf(0.97, -0.06), yawOf(-0.99, 0.12), faceCar);
    const yawn = f >= 1640 && f <= 1662 ? Math.sin(ramp(f, 1640, 1662) * Math.PI) : 0;   // the yawn (word 1646, opens 6f early)
    TURT.push({ x, z, y, yaw, step: dist / 0.14 * Math.PI, on, yawn, dist });
    prev = { x, z };
  }
}
export const turtAt = (f) => TURT[clamp(f, 0, TOTAL - 1)];

// ---------- staging points ----------
export const BOARD_POS = [4.2, 3.15, 10.6];
export const CLIFF_SIGN = [16.3, -9.0];
export const FISH = [E(156)[0] * 0.865, E(156)[1] * 0.865];
export const CARTP = [E(245)[0] * 0.855, E(245)[1] * 0.855];
export const BANDP = [E(295)[0] * 0.865, E(295)[1] * 0.865];
export const DITCHP = [E(295)[0] * 0.72, E(295)[1] * 0.72];   // ditch on the band's own (inside) verge
export const CHICKP = E(215);

// ---------- hero / focus ----------
const FOCUS = {
  title: () => BOARD_POS, demand: () => [5.6, 1.3, 11.6], reveal: () => [4.2, 1.0, 12.8], secondsun: () => [4.2, 0.9, 12.8],
  roof: () => [4.4, 1.2, 12.7], oneroad: () => [0, 1, 8], goslow: () => [CLIFF_SIGN[0], 1.3, CLIFF_SIGN[1]], laugh: () => [5.6, 1.45, 11.6],
  walk1: () => { const t = turtAt(1700); return [t.x, 0.6, t.z]; },
  payoff1: () => [4.7, 1.25, 12.7], payoff2: () => [2.5, 1, 12.5], years: () => [35.0, -0.7, -1.8],
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

// ---------- cameras ----------
const trackKeys = (f, S, fn, step = 13) => {
  const ks = [];
  for (let kf = S.a; kf <= S.b; kf += step) ks.push(fn(kf, kf));
  if (ks[ks.length - 1].f !== S.b) ks.push(fn(S.b, S.b));
  return camFromKeys(ks, f);
};
const thOf = (c) => { const t = Math.atan2(c.z, c.x) / D2R; return t < 0 ? t + 360 : t; };
const sideCam = (side, dist, h, lookUp = 0.9, ahead = 1.2) => (kf) => {
  const c = carAt(kf), out = EOUT(thOf(c));
  return { f: kf, pos: [c.x + out[0] * dist * side, h, c.z + out[1] * dist * side],
    look: [c.x + Math.cos(c.yaw) * ahead, lookUp, c.z - Math.sin(c.yaw) * ahead], fov: 40 };
};
export const camAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'title': return camFromKeys([
      { f: 0, pos: [9.8, 2.1, 23.8], look: [4.35, 2.25, 11.2], fov: 44 },
      { f: 50, pos: [8.4, 3.4, 20.6], look: [4.3, 2.45, 11.0], fov: 41, ease: 'surge' },
      { f: 99, pos: [6.6, 4.4, 17.8], look: [4.25, 2.6, 10.8], fov: 40, ease: 'surge' }], f);
    case 'demand': return camFromKeys([
      { f: 100, pos: [7.7, 1.7, 15.9], look: [5.4, 1.25, 11.7], fov: 38 },
      { f: 187, pos: [7.0, 1.6, 14.5], look: [5.5, 1.28, 11.65], fov: 35, ease: 'surge' }], f);
    case 'reveal': return camFromKeys([ // whip from the hut to the car, then tilt-up
      { f: 188, pos: [0.2, 1.9, 18.2], look: [-4.5, 1.6, 11.8], fov: 44 },
      { f: 206, pos: [2.6, 2.0, 23.5], look: [4.2, 1.0, 12.9], fov: 43, ease: 'easeInOut' },
      { f: 232, pos: [7.6, 1.0, 21.5], look: [4.2, 1.3, 12.8], fov: 41, ease: 'surge' },
      { f: 259, pos: [8.6, 2.4, 20.6], look: [4.2, 1.1, 12.8], fov: 40, ease: 'surge' }], f);
    case 'secondsun': return camFromKeys([ // slow orbit around the shining car
      { f: 260, pos: [10.8, 1.3, 17.6], look: [4.2, 0.9, 12.8], fov: 37 },
      { f: 295, pos: [10.2, 1.5, 9.6], look: [4.2, 0.95, 12.8], fov: 37, ease: 'surge' },
      { f: 329, pos: [7.6, 1.8, 8.2], look: [4.2, 1.0, 12.8], fov: 36, ease: 'surge' }], f);
    case 'roof': return camFromKeys([
      { f: 330, pos: [11.5, 1.7, 9.5], look: [4.9, 1.2, 12.4], fov: 36 },
      { f: 441, pos: [10.8, 1.75, 10.4], look: [4.9, 1.25, 12.4], fov: 35, ease: 'surge' }], f);
    case 'oneroad': return camFromKeys([ // crane up: the whole ring road
      { f: 442, pos: [6.9, 1.8, 15.4], look: [2.7, 1.3, 12.2], fov: 38 },
      { f: 500, pos: [10.5, 4.6, 20.5], look: [0, 0.8, 7], fov: 44, ease: 'surge' },
      { f: 560, pos: [13.5, 7.6, 24.5], look: [-2, 0.4, 1], fov: 46, ease: 'surge' }], f);
    case 'goslow': return camFromKeys([ // the warning sign, clean and centred, BEFORE it matters
      { f: 561, pos: [11.2, 1.75, -13.7], look: [16.3, 1.5, -9.0], fov: 34 },
      { f: 622, pos: [10.9, 1.9, -13.4], look: [16.3, 1.5, -9.0], fov: 33, ease: 'surge' }], f);
    case 'laugh': return camFromKeys([ // punch-in on "Slow is for other people"
      { f: 623, pos: [7.4, 1.6, 15.0], look: [5.6, 1.42, 11.6], fov: 34 },
      { f: 660, pos: [7.0, 1.58, 14.2], look: [5.6, 1.44, 11.6], fov: 31, ease: 'surge' },
      { f: 705, pos: [6.4, 1.52, 13.4], look: [5.6, 1.45, 11.6], fov: 28, ease: 'surge' }], f);
    case 'lap1a': return trackKeys(f, S, sideCam(1, 5.2, 1.5));
    case 'lap1b': return trackKeys(f, S, (kf) => { const c = carAt(kf), out = EOUT(thOf(c));
      return { f: kf, pos: [c.x + out[0] * 9.5, 2.0, c.z + out[1] * 9.5], look: [FISH[0], 1.0, FISH[1]], fov: 42 }; });
    case 'lap1c': return trackKeys(f, S, (kf) => { const c = carAt(kf), out = EOUT(thOf(c)), hd = [Math.cos(c.yaw), -Math.sin(c.yaw)];
      return { f: kf, pos: [c.x + out[0] * 10 + hd[0] * 0.8, 1.9, c.z + out[1] * 10 + hd[1] * 0.8], look: [c.x + out[0] * 1.45 - hd[0] * 0.75, 1.0, c.z + out[1] * 1.45 - hd[1] * 0.75], fov: 42 }; });
    case 'lap2a': return trackKeys(f, S, (kf) => { const c = carAt(kf), hd = [Math.cos(c.yaw), -Math.sin(c.yaw)];
      return { f: kf, pos: [c.x - hd[0] * 5.8, 1.75, c.z - hd[1] * 5.8], look: [c.x + hd[0] * 4, 0.8, c.z + hd[1] * 4], fov: 42 }; }); // rear chase
    case 'lap2b': { // static roadside cam inside the bend, aimed at the chicken spot
      const p1 = E(228), p2 = E(230);
      return camFromKeys([{ f: S.a, pos: [p1[0] * 0.8, 1.35, p1[1] * 0.8], look: [CHICKP[0], 0.35, CHICKP[1]], fov: 41 },
        { f: S.b, pos: [p2[0] * 0.8, 1.3, p2[1] * 0.8], look: [CHICKP[0], 0.35, CHICKP[1]], fov: 40 }], f, { kicks: [{ f: 894, a: 0.04 }] }); }
    case 'lap2c': return trackKeys(f, S, (kf) => { const c = carAt(kf), out = EOUT(thOf(c));
      return { f: kf, pos: [c.x - out[0] * 8.8, 1.7, c.z - out[1] * 8.8], look: [lerp(c.x, CARTP[0], 0.55), 0.95, lerp(c.z, CARTP[1], 0.55)], fov: 41 }; });
    case 'lap3a': return trackKeys(f, S, (kf) => { const c = carAt(kf), hd = [Math.cos(c.yaw), -Math.sin(c.yaw)];
      return { f: kf, pos: [c.x + hd[0] * 5.4, 1.1, c.z + hd[1] * 5.4], look: [c.x, 0.95, c.z], fov: 41 }; }); // low front chase (car bears down on camera)
    case 'lap3b': { // sea-side cam looking in: car crosses frame, band leaps into the ditch behind
      const t = ET(295), tl = Math.hypot(t[0], t[1]), tu = [t[0] / tl, t[1] / tl], out = EOUT(295);
      const rp = E(295), lx = (BANDP[0] + rp[0]) / 2, lz = (BANDP[1] + rp[1]) / 2;
      const px = BANDP[0] + out[0] * 7.5 + tu[0] * 1.5, pz = BANDP[1] + out[1] * 7.5 + tu[1] * 1.5;
      return camFromKeys([{ f: S.a, pos: [px, 1.8, pz], look: [lx, 0.8, lz], fov: 44 },
        { f: S.b, pos: [px + tu[0] * 0.4, 1.75, pz + tu[1] * 0.4], look: [lx, 0.8, lz], fov: 43 }], f, { kicks: [{ f: 1095, a: 0.045 }] }); }
    case 'cliffpov': return trackKeys(f, S, (kf) => { const c = carAt(kf), hd = [Math.cos(c.yaw), -Math.sin(c.yaw)];
      const ahead = E(Math.min(352, thOf(c) + 12));
      return { f: kf, pos: [c.x + hd[0] * 0.75, 1.42, c.z + hd[1] * 0.75], look: [ahead[0], 0.9, ahead[1]], fov: 46, roll: -2.5 }; }, 10); // bonnet-cam POV (ahead of the glass, over the hood)
    case 'cliffbend': return camFromKeys([
      { f: 1288, pos: [16.6, 2.6, -10.8], look: [23.0, 0.7, -3.4], fov: 40 },
      { f: 1319, pos: [17.3, 2.4, -10.0], look: [23.2, 0.65, -3.2], fov: 39, ease: 'surge' }], f);
    case 'turtle': return trackKeys(f, S, (kf) => { const t = turtAt(kf), bp = E(338);
      return { f: kf, pos: [bp[0] * 0.78, lerp(2.6, 2.45, ramp(kf, 1320, 1414)), bp[1] * 0.78], look: [t.x, 0.4, t.z], fov: lerp(44, 30, ramp(kf, 1320, 1414)) }; }, 16); // high inside view of the bend: turtle mid-road, car bearing down — FOV push-in
    case 'brakes': return camFromKeys([
      { f: 1415, pos: [27.6, 0.85, -0.9], look: [23.9, 0.6, -2.9], fov: 34 },
      { f: 1489, pos: [27.0, 0.82, -1.3], look: [23.95, 0.58, -2.75], fov: 32, ease: 'surge' }], f, { kicks: [{ f: 1461, a: 0.055 }] });
    case 'nose': return camFromKeys([
      { f: 1490, pos: [26.1, 0.78, -0.5], look: [24.2, 0.55, -2.3], fov: 30 },
      { f: 1528, pos: [25.4, 0.74, -1.05], look: [24.25, 0.55, -2.3], fov: 27, ease: 'surge' }], f);
    case 'honk1': { // driver honks, whip to the turtle's unblinking face
      if (f < 1559) return camFromKeys([
        { f: 1529, pos: [20.4, 1.35, -1.4], look: [23.1, 1.2, -4.35], fov: 32 },
        { f: 1559, pos: [20.7, 1.33, -1.5], look: [23.1, 1.2, -4.35], fov: 31, ease: 'surge' }], f);
      return camFromKeys([
        { f: 1559, pos: [20.7, 1.33, -1.5], look: [23.1, 1.2, -4.35], fov: 31 },
        { f: 1572, pos: [22.05, 1.47, -1.55], look: [23.4, 0.4, -2.1], fov: 25, ease: 'easeInOut' },
        { f: 1603, pos: [22.12, 1.44, -1.58], look: [23.4, 0.4, -2.1], fov: 24, ease: 'surge' }], f);
    }
    case 'honk2': { // second honk, smash to the shocked face, back for the yawn
      if (f < 1620) return camFromKeys([
        { f: 1604, pos: [22.12, 1.44, -1.58], look: [23.4, 0.4, -2.1], fov: 24 },
        { f: 1620, pos: [22.16, 1.43, -1.6], look: [23.4, 0.4, -2.1], fov: 24, ease: 'surge' }], f);
      if (f < 1638) return camFromKeys([
        { f: 1620, pos: [22.16, 1.43, -1.6], look: [23.4, 0.4, -2.1], fov: 24 },
        { f: 1632, pos: [21.0, 1.3, -1.1], look: [23.15, 1.22, -4.35], fov: 23, ease: 'easeInOut' },
        { f: 1638, pos: [21.1, 1.3, -1.15], look: [23.15, 1.22, -4.35], fov: 23, ease: 'surge' }], f);
      return camFromKeys([
        { f: 1638, pos: [21.1, 1.3, -1.15], look: [23.15, 1.22, -4.35], fov: 23 },
        { f: 1650, pos: [27.15, 1.2, -1.75], look: [25.3, 0.4, -2.05], fov: 24, ease: 'easeInOut' },
        { f: 1664, pos: [27.1, 1.2, -1.78], look: [25.35, 0.4, -2.1], fov: 24, ease: 'surge' }], f);
    }
    case 'walk1': return camFromKeys([
      { f: 1665, pos: [19.6, 1.7, -0.1], look: [22.7, 1.0, -4.1], fov: 38 },
      { f: 1712, pos: [21.4, 1.6, -0.3], look: [24.0, 1.05, -3.35], fov: 37, ease: 'surge' },
      { f: 1767, pos: [23.2, 1.6, -0.8], look: [24.7, 0.6, -2.35], fov: 36, ease: 'surge' }], f);
    case 'walk2': return trackKeys(f, S, (kf) => { const t = turtAt(kf);
      return { f: kf, pos: [t.x - 2.3, 1.45 + Math.max(0, -t.y), t.z - 4.5], look: [t.x + 0.5, 0.55 + t.y, t.z], fov: 37 }; }, 12);
    case 'walk3': return trackKeys(f, S, (kf) => { const t = turtAt(kf), u = ramp(kf, 1851, 1921);
      return { f: kf, pos: [t.x - 2.6 - 1.8 * u, 1.2 + 1.1 * u - t.y * 0.4, t.z - 4.3 - 1.2 * u], look: [t.x + 0.7, 0.4 + t.y, t.z], fov: 37 }; }, 12);
    case 'payoff1': return camFromKeys([
      { f: 1922, pos: [9.4, 1.7, 18.6], look: [4.7, 1.25, 12.7], fov: 36 },
      { f: 2020, pos: [8.8, 1.65, 17.6], look: [4.8, 1.27, 12.7], fov: 34, ease: 'surge' }], f);
    case 'payoff2': return camFromKeys([
      { f: 2021, pos: [11.6, 2.6, 21.6], look: [2.6, 1.0, 12.6], fov: 44 },
      { f: 2079, pos: [11.0, 2.9, 20.8], look: [2.8, 1.05, 12.6], fov: 42, ease: 'surge' }], f);
    case 'years': return camFromKeys([
      { f: 2080, pos: [36.5, 2.6, 2.8], look: [35.2, -1.05, -1.8], fov: 30 },
      { f: 2177, pos: [36.3, 2.55, 2.5], look: [35.2, -1.05, -1.8], fov: 28, ease: 'surge' }], f);
    case 'hookq': return camFromKeys([
      { f: 2178, pos: [12.8, 3.0, 23.2], look: [4.4, 2.3, 11.2], fov: 43 },
      { f: 2240, pos: [10.9, 3.3, 22.2], look: [4.25, 2.95, 10.75], fov: 40, ease: 'surge' },
      { f: 2287, pos: [10.1, 3.35, 21.6], look: [4.22, 3.0, 10.65], fov: 38, ease: 'surge' }], f);
    case 'hook': return camFromKeys([
      { f: 2288, pos: [10.1, 3.35, 21.6], look: [4.22, 3.0, 10.65], fov: 38 },
      { f: 2337, pos: [9.8, 3.4, 21.3], look: [4.2, 3.02, 10.62], fov: 37, ease: 'surge' }], f);
  }
  return camFromKeys([{ f: S.a, pos: [8, 2, 16], look: [0, 1, 0], fov: 40 }, { f: S.b, pos: [8.5, 2.1, 15], look: [0, 1, 0], fov: 39 }], f);
};
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), hp = heroPosAt(f);
  let cinf = 2.4;
  if (['title', 'oneroad', 'payoff2', 'lap3b'].includes(S.id)) cinf = 1.4;
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
    carX: c.x, carZ: c.z, carYaw: c.yaw, carPitch: c.pitchS || 0, wheelRot: c.wheelRot, carSpeed: c.speed,
    roofK: 0, glintK: 0, glowK: 0,
    turtleX: t.x, turtleZ: t.z, turtleY: t.y, turtleYaw: t.yaw, turtleStep: t.step, turtleOn: t.on, turtleYawn: t.yawn,
    chickenK: 0, featherK: 0, dustChicken: 0, dustSeller: 0, dustBand: 0, dustBrake: 0,
  };
  if (S.id === 'title') W.boardTitle = 1 - smooth(ramp(f, 66, 82));
  if (S.id === 'hookq') W.boardHook = smooth(ramp(f, 2232, 2252));
  if (S.id === 'hook') W.boardHook = 1;   // held at FULL opacity to the literal last frame
  W.roofK = smooth(ramp(f, 373, 428));                       // "folded" (word 376) — starts 3f early
  if (S.id === 'secondsun') W.glintK = Math.sin(ramp(f, 262, 327) * Math.PI);   // the second-sun glint sweep
  if (S.id === 'payoff2' || S.id === 'hookq' || S.id === 'hook') W.glowK = 0.85; // headlights at dusk
  if (S.id === 'brakes') W.glowK = 0.3 * ramp(f, 1415, 1461);
  // chickens scatter at "exploded" (894) — motion starts 3f before the word
  W.chickenK = smooth(ramp(f, 891, 916));
  W.featherK = ramp(f, 892, 918) * (1 - ramp(f, 924, 937));
  W.dustChicken = ramp(f, 892, 912);
  W.dustSeller = ramp(f, 972, 992);                          // seller lands behind his cart
  W.dustBand = ramp(f, 1092, 1114);                          // the band lands in the ditch
  W.dustBrake = ramp(f, 1459, 1480);                         // brake-stop dust at the front wheels
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  const harbour = ['title', 'demand', 'reveal', 'secondsun', 'roof', 'oneroad', 'goslow', 'laugh', 'payoff1', 'payoff2', 'hookq', 'hook'].includes(S.id);
  return { smokeRate: harbour ? 0.14 : 0.05, dustRate: 0.07, splashRate: 0 };
};

// ---------- actors ----------
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
const RW = (T, o, opts, pos, extra = {}) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], ...extra });
// sunglasses overlay for the rich tourist, drawn over bodyFront's face.
// Eyes sit at card (300 +/- 13u, hc); u = 2*headA/100 = 2.36 (adult).
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
  p.ell(300, 716 + dy, 96, 30, '#f2e3c2', 3);                    // drum skin (top)
  p.poly([[204, 716 + dy], [396, 716 + dy], [388, 792 + dy], [212, 792 + dy]], '#b3392e', 3); // shell
  p.ell(300, 792 + dy, 88, 16, '#8c2432', 3);
  p.band([[238, 690 + dy], [282, 716 + dy]], '#7a4a26', 5, 2);   // straps
  p.band([[362, 690 + dy], [318, 716 + dy]], '#7a4a26', 5, 2);
};
const stand = (T, tint, f) => (o, expr, seed, pos, extra = {}) => RW(T, o, { expr, mode: 'stand', blink: blinkAt(f, seed), seed }, pos, { tint, ...extra });
const arcY = (f, f0, dur, h) => { const u = ramp(f, f0, f0 + dur); return u <= 0 || u >= 1 ? 0 : Math.sin(u * Math.PI) * h; };

export const actorsAt = (f, T) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const st = stand(T, tint, f);
  const richStand = (expr, pos, extra = {}) => {
    const opts = { expr, mode: 'stand', blink: blinkAt(f, 41), seed: 41, ...(extra.opts || {}) };
    return { key: 'rich' + JSON.stringify(opts) + (extra.yaw || 0), draw: (p) => { T.bodyFront(p, OUTFITS.rich, opts); shades(T, 41, 'stand')(p); }, x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], tint, yaw: extra.yaw || 0, flip: !!extra.flip, s: extra.s || 1 };
  };
  const richWalk = (pos, extra = {}) => {
    const opts = { expr: 'smile_closed', mode: 'stroll', phase: extra.phase ?? 0, blink: blinkAt(f, 41), seed: 41, prop: ['point', 0.14] };
    return { key: 'richW' + JSON.stringify(opts), draw: (p) => { T.bodyFront(p, OUTFITS.rich, opts); shades(T, 41, 'stand')(p); }, x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], tint, yaw: extra.yaw || 0, s: 1 };
  };
  const driver = (expr) => {
    // driver sits on the OUTSIDE seat (local z -0.42): with the lap
    // direction, local +z always faces the island centre, so the outside
    // seat is the one the tracking cameras see
    const c = carAt(f), off = rot2(-0.15, -0.42, c.yaw);
    const opts = { expr, mode: 'sit', blink: blinkAt(f, 41), seed: 41 };
    // card origin raised so the seated figure sits ON the seat: head and
    // shoulders clear the door line, legs hidden inside the body (a y=0.02
    // origin buried his head behind the seat backs — stills review)
    return { key: 'driver' + JSON.stringify(opts), draw: (p) => { T.bodyFront(p, OUTFITS.rich, opts); shades(T, 41, 'sit')(p); }, x: c.x + off[0], y: 0.43, z: c.z + off[1], ground: 0, tint, s: 0.85, blob: false };
  };
  const rental = (expr, pos, extra = {}) => st(OUTFITS.rental, expr, 52, pos, extra);
  switch (S.id) {
    case 'title': case 'demand': {
      out.push(richStand('grin', [5.6, 0, 11.6], { yaw: 0.3 }));
      out.push(rental('smile', [2.7, 0, 12.3], { yaw: -0.3 }));
      break;
    }
    case 'reveal': case 'secondsun': {
      out.push(richStand('grin', [6.1, 0, 11.2], { yaw: 0.5 }));
      out.push(rental('smile', [2.7, 0, 12.3], { yaw: -0.3 }));
      break;
    }
    case 'roof': {
      const k = q(smooth(ramp(f, 344, 352)) * (1 - smooth(ramp(f, 352, 362))), 2);   // the button press (word 350)
      const opts = { expr: 'grin', mode: 'stand', blink: blinkAt(f, 41), seed: 41, prop: ['point', k] };
      out.push({ key: 'richBtn' + JSON.stringify(opts), draw: (p) => { T.bodyFront(p, OUTFITS.rich, opts); shades(T, 41, 'stand')(p); }, x: 5.9, y: 0, z: 11.9, ground: 0, tint, yaw: 0.55 });
      out.push(rental('smile', [2.7, 0, 12.3], { yaw: -0.3 }));
      break;
    }
    case 'oneroad': {
      const k = q(0.25 + 0.2 * Math.sin(f * 0.05), 2);   // pointing out the road, the whole way round
      out.push(RW(T, OUTFITS.rental, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 52), seed: 52, prop: ['point', k] }, [2.7, 0, 12.3], { tint, yaw: -0.3 }));
      out.push(richStand('grin', [5.9, 0, 11.9], { yaw: 0.4 }));
      break;
    }
    case 'goslow': break;   // the sign speaks for itself
    case 'laugh': {
      out.push(richStand(f < 656 ? 'laugh' : 'grin', [5.6, 0, 11.6], { yaw: 0.25 }));
      out.push(rental('stern', [2.7, 0, 12.3], { yaw: -0.3 }));
      break;
    }
    case 'lap1a': case 'lap2a': case 'lap2b': case 'lap3a': case 'cliffpov': case 'cliffbend': case 'turtle': {
      out.push(driver(S.id === 'lap3a' || S.id === 'cliffpov' ? 'grin' : 'smile_closed'));
      break;
    }
    case 'lap1b': {
      out.push(driver('smile_closed'));
      const wv = q(Math.sin(f * 0.32), 2);
      out.push(RW(T, OUTFITS.fisher1, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 61), seed: 61, wave: wv }, [FISH[0] - 0.7, 0, FISH[1] + 0.4], { tint, yaw: 0.4 }));
      out.push(st(OUTFITS.fisher2, 'smile', 62, [FISH[0] + 0.9, 0, FISH[1] - 0.5], { yaw: -0.3 }));
      break;
    }
    case 'lap1c': {
      out.push(driver('grin'));
      const c = carAt(f);
      [[OUTFITS.kid1, 71, -0.4], [OUTFITS.kid2, 72, -1.7], [OUTFITS.kid3, 73, -2.9]].forEach(([o, seed, back]) => {
        const out_ = EOUT(thOf(c)), hd = [Math.cos(c.yaw), -Math.sin(c.yaw)];
        // kids run on the SEA side, between the tracking camera and the car
        // (inside, the car body hid them completely — stills review)
        const kx = c.x + out_[0] * 2.9 - hd[0] * -back, kz = c.z + out_[1] * 2.9 - hd[1] * -back;
        const ph = q(((f - 785) * Math.max(0.5, c.speed) / 30) % 1, 2);
        out.push(RW(T, o, { expr: 'laugh', mode: 'march', phase: ph, blink: blinkAt(f, seed), seed, lift: 52 }, [kx, 0, kz], { tint, yaw: 0.2 }));
      });
      break;
    }
    case 'lap2c': {
      out.push(driver('grin'));
      if (f < 956) out.push(st(OUTFITS.seller, 'smile', 81, [CARTP[0] - 1.3, 0, CARTP[1] + 0.8], { yaw: 0.5 }));
      else {
        const u = ramp(f, 956, 984), px = lerp(CARTP[0] - 1.3, CARTP[0] + 0.4, u), pz = lerp(CARTP[1] + 0.8, CARTP[1] - 1.15, u);
        const ay = arcY(f, 956, 24, 0.55);
        const opts = { expr: u < 1 ? 'shock' : 'nervous', mode: u < 1 && u > 0.15 ? 'fall' : 'stand', blink: blinkAt(f, 81), seed: 81 };
        out.push(RW(T, OUTFITS.seller, opts, [px, ay, pz], { tint, yaw: 0.5, roll: u < 1 ? -0.35 * Math.sin(u * Math.PI) : 0, ground: 0 }));
      }
      break;
    }
    case 'lap3b': {
      out.push(driver('grin'));
      [[OUTFITS.drum1, 91, 0], [OUTFITS.drum2, 92, 1.5], [OUTFITS.drum3, 93, 3.0]].forEach(([o, seed, off]) => {
        const bx = BANDP[0] + off * 0.55, bz = BANDP[1] + off * 0.95;
        if (f < 1071) {
          out.push({ key: 'drum' + seed + 'stand', draw: drumDraw(T, o, { expr: 'smile', mode: 'stand', blink: blinkAt(f, seed), seed }), x: bx, y: 0, z: bz, ground: 0, tint, yaw: -0.4 });
        } else {
          const u = ramp(f, 1071, 1101);   // "leapt" (1074) — they move 3f before the word
          const px = lerp(bx, DITCHP[0] + off * 0.5, u), pz = lerp(bz, DITCHP[1] + off * 0.85, u);
          const ay = arcY(f, 1071, 26, 0.6) - 0.45 * smooth(ramp(f, 1092, 1101));
          const opts = { expr: u < 1 ? 'shock' : 'dazed', mode: u < 1 && u > 0.15 ? 'fall' : 'stand', blink: blinkAt(f, seed), seed };
          out.push({ key: 'drum' + seed + JSON.stringify(opts) + q(u, 2), draw: drumDraw(T, o, opts, u >= 1 ? 14 : 0), x: px, y: ay, z: pz, ground: -0.45, tint, yaw: -0.4, roll: u < 1 ? 0.3 * Math.sin(u * Math.PI) : 0 });
        }
      });
      break;
    }
    case 'brakes': case 'nose': {
      out.push(driver('shock'));
      break;
    }
    case 'honk1': {
      // the turtle never blinks (its stare is 3D, in main.js); the driver slams the horn
      out.push(driver(f >= 1538 && f <= 1552 ? 'stern' : 'shock'));
      break;
    }
    case 'honk2': {
      out.push(driver('shock'));
      break;
    }
    case 'walk1': {
      if (f < 1669) out.push(driver('dazed'));
      else {
        const u = ramp(f, 1669, 1767);
        const px = lerp(22.3, 23.55, u), pz = lerp(-3.1, -3.4, u);
        out.push(richWalk([px, 0, pz], { yaw: 0.6, phase: q((f * 0.011) % 1, 2) }));
      }
      break;
    }
    case 'walk2': case 'walk3': {
      const t = turtAt(f), gy = rampY(t.x - 0.6);   // he wades the last steps into the shallows with it
      out.push(richWalk([t.x - 0.6, gy, t.z - 1.25], { yaw: 0.7, phase: q((t.dist * 1.4) % 1, 2) }));
      break;
    }
    case 'payoff1': case 'payoff2': {
      out.push(rental('grin', [3.0, 0, 12.4], { yaw: -0.25 }));
      out.push(richStand('smile_closed', [8.4, 0, 13.7], { yaw: 0.35 }));
      break;
    }
    case 'years': case 'hookq': case 'hook': break;
  }
  return out;
};
export const fxAt = () => [];
