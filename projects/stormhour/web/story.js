// Shot plan for "The Woman Who Knew the Storm's Hour" — stormhour.
// Salted Mine V3 style + "v4" ACTION CAMERA + Library v6 body
// (life/emo/gesture/grip/stride) + FULL UPGRADE (2026-11-19): real
// weather physics (calm -> storm arc, a cloud wall that swallows
// the sun, ONE wind from the sea driving smoke/gulls/cloth/rain),
// one sun per scene with a day -> sunset arc on clause boundaries,
// characters with volume + emotion, speaking = moving, real object
// physics (the barometer's climbing water, chalk marks, boats on
// the swell). END RULE: the only performed line is L12 (mid-film);
// the last quarter is narration only, all mouths shut.
// Voice stem: voice_build.wav — the user's own trained "tren
// voice" (GPT-SoVITS fine-tune), line-by-line gated, speed-fitted,
// 63.576219 s, 30 fps, TOTAL 1907. Line timings from timing.json
// (faster-whisper small char-mapped onto the script — see
// ../align.py). Scene changes ONLY at line boundaries. ONE set: a
// harbour quay running SOUTH (Mara's cottage, z=+9.5) to NORTH
// (harbour office z=-4.6, hook board z=-12.8); the SEA is WEST
// (x < -3.4), so the sun sets over the water and the storm wind
// blows sea -> land (+x) through every system.
// GRADES: Sea Glass calm -> Storm Flash at the break -> warm gold
// payoff. Boards and captions are never graded.
import { M, blinkAt, q, clamp, lerp, ramp, kf } from './motion.js';
import { buildRig, pushInCam, keysCam } from './camrig.js';
import { poseWindows, turnTrack, winkTrack, emoTrack, lifeAt, gripAt, gestureAt, stridePh } from './body.js';
import * as SOL from './solid.js';
import * as T from './toon.js';
import * as SPK from './speak.js';
import { SPEAK_DATA } from './speakdata.js';

export const FPS = 30, TOTAL = 1907, DECK = 0;
export const SHOTS = [
  { id: 'harbour', a: 0, b: 117, light: 'day' },
  { id: 'claim', a: 118, b: 210, light: 'day' },
  { id: 'office', a: 211, b: 335, light: 'day' },
  { id: 'bet', a: 336, b: 444, light: 'day' },
  { id: 'evening', a: 445, b: 559, light: 'evening' },
  { id: 'tube', a: 560, b: 672, light: 'evening' },
  { id: 'climb', a: 673, b: 783, light: 'evening' },
  { id: 'gulls', a: 784, b: 915, light: 'morning' },
  { id: 'chalk', a: 916, b: 1002, light: 'morning' },
  { id: 'smoke', a: 1003, b: 1109, light: 'morning' },
  { id: 'noon', a: 1110, b: 1214, light: 'noon' },
  { id: 'line', a: 1215, b: 1326, light: 'noon' },
  { id: 'order', a: 1327, b: 1408, light: 'noon' },
  { id: 'lostday', a: 1409, b: 1476, light: 'after' },
  { id: 'sunset', a: 1477, b: 1617, light: 'sunset' },
  { id: 'storm', a: 1618, b: 1709, light: 'storm' },
  { id: 'payoff', a: 1710, b: 1832, light: 'gold' },
  { id: 'hookboard', a: 1833, b: 1906, light: 'gold' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- geography ----------
export const BOARD_POS = [0.2, 2.0, -12.8];
export const SIGN_POS = BOARD_POS;
export const TUBE_POS = [4.52, 1.5, 9.5]; // the barometer, in her window
export const MARA_HOME = [3.45, 9.35];
export const gunAt = (f) => ({ k: 0, x: 0, y: 0, z: 0 });

// ---------- lights / mood grades ----------
// ONE sun per scene; its az/el belong to the time of day and change
// only on clause boundaries. Morning sun in the EAST (over the
// cottages), noon high, sunset low in the WEST over the sea — where
// the cloud wall rises to swallow it.
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
const mixHex = (a, b, u) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(lerp(v, pb[i], u)).toString(16).padStart(2, '0')).join('');
};
// the cloud wall: rises off the sea through L15 — first a black
// line at "black" (f1554), then it SWALLOWS the sun (f1582-1606).
export const wallK = (f) => {
  if (f < 1477) return 0;
  if (f < 1554) return 0.04;
  if (f < 1606) return lerp(0.04, 1, smooth(ramp(f, 1554, 1606)));
  if (f < 1710) return 1;
  return 0;
};
// lightning (L16): exposure choreography — the scene DIMS before
// each strike, the flash BUILDS over ~8 frames, recovers over ~10.
// Strikes land on "broke" (f1633) and again at f1680.
const STRIKES = [1633, 1680];
export const flashAt = (f) => {
  let v = 0;
  for (const t0 of STRIKES) {
    if (f >= t0 && f < t0 + 8) v = Math.max(v, (f - t0 + 1) / 8 * (0.82 + 0.18 * Math.sin(f * 9.1)));
    else if (f >= t0 + 8 && f < t0 + 18) v = Math.max(v, 0.85 * (1 - (f - t0 - 8) / 10));
  }
  return v;
};
export const expoMul = (f) => {
  let m = 1;
  for (const t0 of STRIKES) {
    if (f >= t0 - 9 && f < t0) m = Math.min(m, 1 - 0.26 * ramp(f, t0 - 9, t0));
    else if (f >= t0 && f < t0 + 18) m = Math.max(m, 1 + flashAt(f) * 1.1);
  }
  return m;
};
export const lightFor = (S, f) => {
  const base = { ...LIGHTS[S.light] };
  if (S.light === 'sunset') {
    // the wall eats the light as it eats the sun
    const u = wallK(f), W = LIGHTS.storm;
    if (u > 0.001) {
      for (const k of ['hemi', 'sunI', 'sat', 'fogNear', 'fogFar']) base[k] = lerp(base[k], W[k], u * 0.85);
      for (const k of ['sky', 'ground', 'sun', 'fog', 'skyTop', 'skyHor', 'sunDisc', 'gain', 'waterDeep', 'waterShal', 'glint']) base[k] = mixHex(base[k], W[k], u * 0.85);
      base.sunSize = lerp(base.sunSize, 0.004, u);
    }
  }
  if (S.light === 'storm') {
    const m = expoMul(f);
    base.sunI *= m; base.hemi *= (0.3 + 0.7 * m);
  }
  return base;
};

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

// ---------- the barometer: its water tells the whole story ----------
// Normalised level in the long arm. Evening base 0.30; it CLIMBS
// through L7 ("climbs" f688); by morning it has RISEN (0.62, the
// overnight jump lands on the clause boundary); Mara chalks that
// mark (f937) and times the climb to 0.72 by the line's end; a slow
// creep to 0.78 by noon.
export const tubeK = track([[0, 0.3], [687, 0.3], [767, 0.46], [783, 0.46], [784, 0.62], [951, 0.62], [998, 0.72], [1214, 0.78], [1906, 0.78]]);
export const chalkK = (f) => (f < 937 ? 0 : f < 990 ? 1 : 2);
// gulls: one inland stream during L8, crossing on "gulls" (f845)
// and gone by "screaming" (f901).
export const gullK = (f) => (f < 792 || f > 912 ? 0 : clamp((f - 800) / 105));
// chimney smoke: rises honestly until L10, then SINKS flat
// ("sank" f1018) and lies on the roofs through the noon beats; the
// storm wind tears it away, the morning after it rises again.
export const sinkK = track([[0, 0], [1017, 0], [1096, 1], [1476, 1], [1560, 0.25], [1709, 0.25], [1710, 0], [1906, 0]]);
// the sea: swell amplitude by beat — glassy calm in L14, the storm
// swell building through L16, a kind sea for the payoff.
export const seaAmpAt = (f) => {
  const S = shotAt(f).id;
  const base = { harbour: 0.16, claim: 0.16, office: 0.16, bet: 0.16, evening: 0.12, tube: 0.12, climb: 0.12, gulls: 0.18, chalk: 0.18, smoke: 0.2, noon: 0.2, line: 0.2, order: 0.2, lostday: 0.07, sunset: 0.3, payoff: 0.28, hookboard: 0.28 }[S];
  if (S === 'storm') return lerp(0.3, 0.95, smooth(ramp(f, 1618, 1662)));
  return base ?? 0.16;
};
// the one wind (sea -> land, +x): strength by beat. It moves the
// smoke, the gulls' drift, the flag, the rain slant and the wall.
export const windK = track([[0, 0.3], [444, 0.3], [559, 0.15], [783, 0.15], [915, 0.35], [1214, 0.4], [1408, 0.4], [1476, 0.25], [1554, 0.55], [1617, 1.0], [1709, 1.8], [1710, 0.35], [1906, 0.35]]);
export const rainK = (f) => (f < 1618 ? 0 : f < 1640 ? ramp(f, 1618, 1640) : f < 1710 ? 1 : 0);

// ---------- Mara's noon walk (L11) ----------
// She does her sum standing at the quay edge (slate in hand), then
// walks STRAIGHT to the harbour office — brisk, storm coming.
export const xMara = track([[0, 3.45], [1110, -1.6], [1155, -1.6], [1180, 0.6], [1209, 2.0], [1214, 2.0]]);
export const zMara = track([[0, 9.35], [1110, 3.2], [1155, 3.2], [1209, -3.9], [1214, -3.9]]);
const movingMara = (f) => Math.abs(zMara(f) - zMara(Math.max(0, f - 1))) > 0.002;
export const maraWalkAt = (f) => {
  const x = xMara(f), z = zMara(f);
  return movingMara(f) ? { x, z, ph: stridePh(3.2, z, 1.15), mode: 'stroll' } : { x, z, ph: 0, mode: 'stand' };
};

// ---------- focus (DOF target per shot) ----------
const FOCUS = {
  harbour: () => [3.45, 1.3, 9.35],
  claim: () => [3.3, 1.5, 9.3],
  office: () => [3.2, 1.5, -3.7],
  bet: () => [3.35, 1.48, 9.25],
  evening: () => [4.5, 1.5, 9.5],
  tube: () => [4.52, 1.48, 9.5],
  climb: () => [4.52, 1.45, 9.5],
  gulls: (f) => (f < 845 ? [3.4, 1.55, 9.3] : f < 904 ? [4.2, 4.6, 6.2] : [3.4, 1.55, 9.3]),
  chalk: () => [4.5, 1.45, 9.45],
  smoke: () => [6.3, 3.2, 1.5],
  noon: (f) => { const m = maraWalkAt(f); return [m.x, 1.4, m.z]; },
  line: () => [1.9, 1.5, -4.2],
  order: (f) => (f < 1361 ? [3.45, 1.5, -4.5] : [-2.3, 1.3, -0.8]),
  lostday: () => [-5.6, 0.4, 0.6],
  sunset: () => [-18, 2.8, -0.5],
  storm: () => [-5.6, 0.4, 0.6],
  payoff: () => [3.3, 1.45, 9.2],
  hookboard: () => [0.2, 1.95, -12.8],
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id](f);

// ---------- cameras: v4 ACTION LEVEL — every shot travels ----------
// Head-width maths (card head ~0.61 m): % = 0.61 / (2*d*tan(fov/2)*0.5625).
const RIG_BY_ID = {
  // harbour: Mara BIG from frame 0 (~42%), seated mending nets at
  // her porch; the camera pulls back and rises so the line can
  // name the harbour — sailors, boats, the whole working quay.
  harbour: { cut: 'hard', raw: keysCam({ keys: [
    { f: 0, pos: [0.8, 1.47, 11.8], look: [3.38, 1.27, 9.35], fov: 38 },
    { f: 60, pos: [-0.5, 1.9, 13.6], look: [2.2, 1.1, 8.2], fov: 40, ease: 'smooth' },
    { f: 117, pos: [-1.1, 2.4, 14.6], look: [1.2, 1.0, 6.4], fov: 41, ease: 'surge' }] }) },
  // claim: she stands and names the hour — push-in 45% -> 66% on
  // her determined face.
  claim: { cut: 'hard', raw: keysCam({ keys: [
    { f: 118, pos: [0.55, 1.5, 11.7], look: [3.35, 1.48, 9.3], fov: 37 },
    { f: 168, pos: [1.15, 1.52, 11.15], look: [3.32, 1.5, 9.3], fov: 35, ease: 'surge' },
    { f: 210, pos: [1.5, 1.52, 10.85], look: [3.3, 1.5, 9.3], fov: 34, ease: 'surge' }] }) },
  // office: a 15-frame PUNCH onto the harbour master's laughing
  // face (46% -> 72%) as he waves the almanac at her claim.
  office: { cut: 'hard', raw: keysCam({ keys: [
    { f: 211, pos: [0.65, 1.62, -1.1], look: [3.2, 1.45, -3.65], fov: 38 },
    { f: 228, pos: [1.35, 1.57, -2.05], look: [3.2, 1.48, -3.68], fov: 36, ease: 'surge' },
    { f: 290, pos: [1.45, 1.56, -2.15], look: [3.2, 1.48, -3.7], fov: 35, ease: 'smooth' },
    { f: 335, pos: [1.2, 1.58, -1.9], look: [3.15, 1.46, -3.7], fov: 36, ease: 'surge' }] }) },
  // bet: two-shot at her cottage — she lays her home on the line,
  // hand flat on the cottage post; the push tightens on HER at
  // "sunset" (f385).
  bet: { cut: 'hard', raw: keysCam({ keys: [
    { f: 336, pos: [0.1, 1.62, 11.6], look: [2.9, 1.38, 9.0], fov: 39 },
    { f: 385, pos: [0.75, 1.58, 11.15], look: [3.1, 1.44, 9.2], fov: 37, ease: 'surge' },
    { f: 444, pos: [1.05, 1.56, 10.9], look: [3.25, 1.46, 9.25], fov: 36, ease: 'surge' }] }) },
  // evening: the calm before — high over the water, the quay in
  // golden light, two sailors mocking toward her lit window; a
  // slow push carries us to that window.
  evening: { cut: 'hard', raw: keysCam({ keys: [
    { f: 445, pos: [-7.6, 3.4, 13.6], look: [3.2, 1.25, 8.6], fov: 42 },
    { f: 520, pos: [-5.6, 2.9, 12.8], look: [3.6, 1.35, 9.0], fov: 41, ease: 'smooth' },
    { f: 559, pos: [-4.2, 2.55, 12.2], look: [3.9, 1.42, 9.25], fov: 40, ease: 'surge' }] }) },
  // tube: THE INSERT — her bent tube of water fills the frame,
  // sealed coloured water in curved glass, lamplight behind it.
  tube: { cut: 'hard', raw: keysCam({ keys: [
    { f: 560, pos: [2.62, 1.47, 9.92], look: [4.5, 1.42, 9.48], fov: 30 },
    { f: 620, pos: [2.72, 1.46, 9.88], look: [4.5, 1.42, 9.48], fov: 30, ease: 'surge' },
    { f: 672, pos: [2.78, 1.45, 9.86], look: [4.5, 1.42, 9.48], fov: 30, ease: 'surge' }] }) },
  // climb: the same insert, a breath wider — and through the line
  // the water CLIMBS the glass. Nothing else moves but the level
  // and the light.
  climb: { cut: 'hard', raw: keysCam({ keys: [
    { f: 673, pos: [2.42, 1.46, 10.02], look: [4.5, 1.43, 9.48], fov: 31 },
    { f: 730, pos: [2.6, 1.45, 9.95], look: [4.5, 1.43, 9.48], fov: 31, ease: 'smooth' },
    { f: 783, pos: [2.7, 1.44, 9.9], look: [4.5, 1.43, 9.48], fov: 31, ease: 'surge' }] }) },
  // gulls: Mara watches the water (risen!) — then the camera tilts
  // up WITH her gaze as the gulls stream inland over the quay, and
  // WHIPS back to her wondering face (65%) on "screaming".
  gulls: { cut: 'hard', raw: keysCam({ keys: [
    { f: 784, pos: [1.25, 1.52, 11.05], look: [3.4, 1.5, 9.3], fov: 37 },
    { f: 845, pos: [0.9, 1.7, 11.3], look: [3.2, 1.6, 9.2], fov: 37, ease: 'smooth' },
    { f: 876, pos: [0.2, 2.3, 11.8], look: [4.2, 4.6, 6.2], fov: 40, ease: 'smooth' },
    { f: 904, pos: [1.15, 1.6, 10.9], look: [3.35, 1.53, 9.3], fov: 35, ease: 'smooth' },
    { f: 915, pos: [1.55, 1.56, 10.6], look: [3.38, 1.53, 9.3], fov: 34, ease: 'surge' }] }) },
  // chalk: INSERT with Mara in frame — her hand chalks the mark
  // beside the tube (f926-950), then she times the climb, eyes
  // moving between the mark and the rising water.
  chalk: { cut: 'hard', raw: keysCam({ keys: [
    { f: 916, pos: [2.3, 1.52, 6.9], look: [4.35, 1.43, 9.35], fov: 36 },
    { f: 962, pos: [2.5, 1.51, 7.15], look: [4.4, 1.44, 9.4], fov: 35, ease: 'surge' },
    { f: 1002, pos: [2.62, 1.5, 7.3], look: [4.42, 1.44, 9.42], fov: 35, ease: 'surge' }] }) },
  // smoke: rooftops and chimneys from over the water — the smoke
  // rises a little, then SINKS flat and spreads, heavy air
  // pressing it down. Mara watches from the quay edge, small.
  smoke: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1003, pos: [-7.1, 3.0, 7.1], look: [6.2, 2.5, 1.6], fov: 45 },
    { f: 1056, pos: [-6.1, 2.9, 6.6], look: [6.3, 2.42, 1.3], fov: 44, ease: 'smooth' },
    { f: 1109, pos: [-5.2, 2.8, 6.2], look: [6.4, 2.35, 1.0], fov: 44, ease: 'surge' }] }) },
  // noon: front three-quarter TRACKING — she finishes her sum on
  // the slate, then walks straight to the office; the camera
  // retreats north-west at exactly her pace.
  noon: { cut: 'hard', raw: (f) => {
    const m = maraWalkAt(f), push = 1 - 0.16 * smooth(ramp(f, 1110, 1155));
    return { pos: [m.x - 2.3 * push, 1.52, m.z - 2.6 * push], look: [m.x + 0.15, 1.36, m.z - 0.2], fov: 37, roll: 0 };
  } },
  // line: THE LINE, performed at the office door — push-in on
  // Mara (55% -> 73%) as she answers the Captain; he listens at
  // frame-right, mouth shut, and his face changes.
  line: { cut: 'hard', raw: pushInCam({ subject: () => [1.9, 0, -4.2], a: 1215, b: 1326, d0: 3.05, d1: 2.5, h0: 1.56, h1: 1.52, lookOff: [0, 1.52, 0], fov0: 37, fov1: 34,
    dir: () => [-0.42, 0.91] }) },
  // order: his hesitation in close-up — then, as the order is
  // given, the camera swings west to the mooring ropes, where
  // the crew takes hold and leans in.
  order: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1327, pos: [1.65, 1.56, -2.55], look: [3.45, 1.49, -4.5], fov: 36 },
    { f: 1361, pos: [1.55, 1.55, -2.7], look: [3.45, 1.5, -4.5], fov: 35, ease: 'smooth' },
    { f: 1388, pos: [0.9, 1.7, -0.2], look: [-1.8, 1.0, -0.7], fov: 40, ease: 'smooth' },
    { f: 1408, pos: [0.7, 1.75, -0.1], look: [-2.1, 0.95, -0.75], fov: 41, ease: 'surge' }] }) },
  // lostday: the fleet at rest on a glassy sea — a lost day,
  // priced against lost ships. Slow drift over the boats.
  lostday: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1409, pos: [-8.7, 2.6, 2.9], look: [0.2, 0.85, -1.4], fov: 42 },
    { f: 1476, pos: [-7.3, 2.3, 2.2], look: [0.4, 0.9, -1.6], fov: 41, ease: 'surge' }] }) },
  // sunset: the hour she named. Sun low over the sea; the black
  // wall rises out of the horizon and swallows it while Mara and
  // the Captain watch from the quay. Slow push toward the wall.
  sunset: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1477, pos: [5.2, 2.1, 2.6], look: [-16, 2.4, -0.8], fov: 44 },
    { f: 1554, pos: [4.85, 2.05, 2.45], look: [-16.5, 2.35, -0.85], fov: 43, ease: 'smooth' },
    { f: 1617, pos: [4.5, 2.0, 2.35], look: [-17, 2.3, -0.9], fov: 43, ease: 'surge' }] }) },
  // storm: it breaks over an EMPTY sea — boats pitching safe at
  // their moorings, rain slashing with the wind, lightning at the
  // break; Mara and the Captain under the office awning.
  storm: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1618, pos: [-11.0, 3.7, 2.6], look: [2.6, 1.05, -3.3], fov: 44 },
    { f: 1665, pos: [-9.8, 3.5, 2.1], look: [2.7, 1.08, -3.3], fov: 43, ease: 'smooth' },
    { f: 1709, pos: [-8.6, 3.3, 1.6], look: [2.8, 1.1, -3.3], fov: 43, ease: 'surge' }] }) },
  // payoff: gold changes hands at her porch; behind them the
  // cottage is BLUE, and a sailor is still touching up the paint.
  payoff: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1710, pos: [0.35, 1.6, 11.35], look: [2.95, 1.4, 9.0], fov: 38 },
    { f: 1752, pos: [0.85, 1.57, 11.0], look: [3.05, 1.43, 9.12], fov: 36, ease: 'surge' },
    { f: 1832, pos: [1.15, 1.56, 10.85], look: [3.1, 1.44, 9.15], fov: 36, ease: 'surge' }] }) },
  // hookboard: the film ends on a CHARACTER BEAT — Mara kneels in
  // the foreground pointing up at the hook board (86% of frame
  // width, whole panel inside with margins, full opacity to the
  // literal last frame), the Captain and a sailor beside her,
  // mouths shut.
  hookboard: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1833, pos: [0.55, 2.02, -2.5], look: [0.2, 1.94, -12.8], fov: 44 },
    { f: 1906, pos: [0.5, 1.98, -3.1], look: [0.2, 1.95, -12.8], fov: 43, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: 1633, a: 0.22 }],
  sigma: 2.3, fovSigma: 1.6,
});
export const camAt = (f) => ({ ...RIG.camAt(f), flash: shotAt(f).id === 'storm' ? flashAt(f) : 0 });
export const RIG_META = {
  kicks: RIG.declared.kicks, hardCuts: RIG.declared.hardCuts,
  blends: SHOTS.filter((s) => RIG_BY_ID[s.id].cut === 'blend').map((s) => ({ a: s.a - Math.floor(RIG_BY_ID[s.id].blend / 2), b: s.a + Math.ceil(RIG_BY_ID[s.id].blend / 2) })),
  whips: RIG.declared.whips,
  samples: RIG.samples,
};
const CINF = { harbour: 2.2, claim: 3.0, office: 2.8, bet: 2.6, evening: 1.6, tube: 3.2, climb: 3.2, gulls: 2.6, chalk: 3.0, smoke: 1.6, noon: 2.8, line: 3.2, order: 2.4, lostday: 1.8, sunset: 1.4, storm: 1.6, payoff: 2.8, hookboard: 1.3 };
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), hp = heroPosAt(f);
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf: CINF[S.id] || 2.2 };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const lampByShot = { harbour: 0.2, claim: 0.2, office: 0.15, bet: 0.2, evening: 0.95, tube: 0.95, climb: 0.95, gulls: 0.3, chalk: 0.3, smoke: 0.2, noon: 0.15, line: 0.15, order: 0.15, lostday: 0.3, sunset: 0.7, storm: 0.95, payoff: 0.35, hookboard: 0.35 };
  return {
    always: 1,
    hookK: S.id === 'hookboard' ? smooth(ramp(f, 1838, 1862)) : 0,
    tubeK: tubeK(f),
    chalkK: chalkK(f),
    gullK: gullK(f),
    sinkK: sinkK(f),
    wallK: wallK(f),
    rainK: rainK(f),
    seaK: seaAmpAt(f),
    windK: windK(f),
    blueK: f >= 1710 ? 1 : 0,
    lampK: lampByShot[S.id] ?? 0.2,
    glintK: (S.id === 'payoff' && f >= 1737 && f <= 1772) ? smooth(ramp(f, 1737, 1748)) * (1 - smooth(ramp(f, 1760, 1772))) : 0,
  };
};
export const fxProfileAt = (f) => ({ moteRate: 0.05, blastRate: 0, sparkRate: worldAt(f).glintK, steamRate: 0, shimmerRate: 0 });
export const fxAt = () => [];

// ---------- cast ----------
// NO card tint in any light — faces stay pure white, costume
// colours flat and saturated (the reference's rule).
const tintFor = () => '#ffffff';
export const OUTFITS = {
  mara: { jacket: '#2e6f6a', dress: '#2e6f6a', pants: '#274b4a', boots: '#2a1c12', hat: 'hair', hair: '#2c1a10', skin: '#fbf7ef' },
  captain: { jacket: '#26355e', pants: '#1f2a44', boots: '#14100c', hat: 'cap', cap: '#1d2a4a', skin: '#fbf7ef', moustache: '#c9c2b2', bigMoustache: true },
  sailorA: { jacket: '#b3543a', pants: '#4a3626', boots: '#241a12', hat: 'cap', cap: '#7a2c1e', skin: '#fbf7ef' },
  sailorB: { jacket: '#c8a03c', pants: '#3c3a40', boots: '#241a12', hat: 'hair', hair: '#14100c', skin: '#fbf7ef', moustache: '#2a201a' },
  sailorC: { jacket: '#e3ded2', pants: '#5a4632', boots: '#3a2410', hat: 'cap', cap: '#2f5d8a', skin: '#fbf7ef' },
};
// Emotion morphs at story beats (body.js emoTrack).
const emoMara = emoTrack(T.faceP, 'thinking', [
  [118, 'determined', 8], [336, 'proud', 8], [445, 'sad', 8], [560, 'neutral', 8], [673, 'thinking', 8],
  [784, 'wonder', 8], [916, 'determined', 8], [1003, 'thinking', 8], [1110, 'determined', 8], [1215, 'smile', 8],
  [1327, 'proud', 8], [1477, 'nervous', 8], [1618, 'scared', 6], [1685, 'relief', 8], [1710, 'proud', 8], [1833, 'grin', 8],
]);
const emoCaptain = emoTrack(T.faceP, 'stern', [
  [211, 'grin', 8], [336, 'stern', 8], [1215, 'stern', 6], [1269, 'thinking', 8], [1327, 'thinking', 8],
  [1361, 'determined', 6], [1409, 'neutral', 8], [1477, 'nervous', 8], [1618, 'scared', 6], [1685, 'relief', 8],
  [1710, 'smile', 8], [1833, 'smile', 8],
]);
const emoSailorA = emoTrack(T.faceP, 'neutral', [
  [445, 'grin', 8], [1327, 'nervous', 6], [1367, 'determined', 8], [1618, 'scared', 6], [1685, 'relief', 8], [1710, 'smile', 8],
]);
const emoSailorB = emoTrack(T.faceP, 'neutral', [
  [445, 'grin', 8], [1409, 'sleepy', 8], [1618, 'nervous', 8], [1833, 'smile', 8],
]);
const emoSailorC = emoTrack(T.faceP, 'smile', []);
// Continuous life per character (body.js lifeAt).
const lifeMara = lifeAt({ seed: 21 }), lifeCaptain = lifeAt({ seed: 51 }), lifeSA = lifeAt({ seed: 31 }),
  lifeSB = lifeAt({ seed: 41 }), lifeSC = lifeAt({ seed: 61 });
const micro = (f, seed) => 1.1 * Math.sin((f + seed * 5) * 0.037 + 1);
const nodAt = (f, f0, n = 9, depth = 0.34) => (f >= f0 && f <= f0 + n ? Math.sin((f - f0) / n * Math.PI) * depth : 0);
const H2 = (life, f, seed, o = {}) => ({
  headTilt: q((o.ht || 0) + micro(f, seed) + life(f).sway, 1),
  look: q(o.look || 0, 2), lookY: q(o.lookY || 0, 2), facing: q(o.facing || 0, 2),
  squash: q(o.squash || 0, 2), tilt: q((o.tilt || 0) + life(f).tilt, 1),
  breath: Math.round(life(f).breath / 6) * 6,
});
const noBlush = (P) => { const P2 = { ...P, cheek: Math.max(P.cheek ?? 0, 0.55) }; P2.blush = 0; P2.openL = Math.min(1, (P2.openL ?? 0.85) * 1.45); P2.openR = Math.min(1, (P2.openR ?? 0.85) * 1.45); return P2; };
const SPEAK = SPK.makeSpeakPlayer(SPEAK_DATA);
// dialogue gesture: Mara's free (right) hand talks with the voice —
// stresses on "sky" (f1233), "air" (f1283), "air" again (f1297)
// and "lies" (f1309).
const gestMara = gestureAt([{ a: 1215, b: 1313, beats: [1233, 1283, 1297, 1309], base: 0.42, amp: 0.18 }]);
// the chalking hand: reaches to the board as "chalked" lands.
const reachK = (f, a, b) => (f < a || f > b ? null : q(0.55 + 0.33 * Math.min(smooth(ramp(f, a, a + 9)), 1 - smooth(ramp(f, b - 6, b))), 2));

export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, z, extra = {}) => {
    out.push({ id, x, y: extra.y ?? 0, z, r: extra.r || 0.32, ground: extra.ground ?? 0,
      actor: (T) => ({ key: 'smx' + JSON.stringify(o) + JSON.stringify(opts) + (extra.y ?? 0),
        draw: (p) => { T.bodyFront(p, o, opts); if (extra.overlay) extra.overlay(p); },
        x, y: extra.y ?? 0, z, ground: extra.ground ?? 0, tint, ...extra }) });
  };
  const MP = noBlush(emoMara.at(f)), CP = noBlush(emoCaptain.at(f)), SAP = noBlush(emoSailorA.at(f)),
    SBP = noBlush(emoSailorB.at(f)), SCP = noBlush(emoSailorC.at(f));
  const maraStd = (opts, x, z, extra = {}) => std('mara', OUTFITS.mara, { expr: 'smile', exprP: MP, blink: blinkAt(f, 20), seed: 21, ...opts }, x, z, { yaw: 0.1, ...extra });
  const captainStd = (opts, x, z, extra = {}) => std('captain', OUTFITS.captain, { expr: 'smile', exprP: CP, blink: blinkAt(f, 51), seed: 51, ...opts }, x, z, { yaw: -0.1, ...extra });
  const sailorAStd = (opts, x, z, extra = {}) => std('sailorA', OUTFITS.sailorA, { expr: 'smile', exprP: SAP, blink: blinkAt(f, 31), seed: 31, ...opts }, x, z, { yaw: 0, ...extra });
  const sailorBStd = (opts, x, z, extra = {}) => std('sailorB', OUTFITS.sailorB, { expr: 'smile', exprP: SBP, blink: blinkAt(f, 41), seed: 41, ...opts }, x, z, { yaw: 0, ...extra });

  switch (S.id) {
    case 'harbour': {
      // frame 0: BIG, mid-action — seated at her porch mending a
      // net, both hands working the twine; two sailors pass the
      // time of day behind her on the quay.
      maraStd({ mode: 'sit', prop: ['point', 0.78], propL: ['point', 0.74],
        ...H2(lifeMara, f, 21, { ht: 2.5, look: -0.25, lookY: 0.3, facing: -0.2 }) }, 3.45, 9.35, { yaw: -0.15 });
      sailorAStd({ mode: 'stand', ...H2(lifeSA, f, 31, { ht: -1.5, look: 0.3, lookY: 0, facing: 0.25 }) }, 0.2, 5.2, { yaw: 0.2 });
      sailorBStd({ mode: 'stand', prop: ['point', 0.35], ...H2(lifeSB, f, 41, { ht: -1, look: -0.35, lookY: 0, facing: -0.3 }) }, -0.75, 3.3, { yaw: -0.25 });
      break;
    }
    case 'claim': {
      // she stands to make the claim — chin up, one hand pressed
      // to her chest, then pointing out to sea at "storm".
      maraStd({ mode: 'stand', prop: f >= 168 ? ['point', q(kf([[168, 0.3], [182, 0.72], [210, 0.6]], f), 2)] : ['point', 0.3],
        ...H2(lifeMara, f, 21, { ht: -2.5, look: -0.3, lookY: -0.12, facing: -0.25 }) }, 3.3, 9.3, { yaw: -0.2 });
      break;
    }
    case 'office': {
      // the harbour master, laughing, his hand resting on the big
      // almanac — the book that is never wrong. Two sailors grin
      // along behind him.
      captainStd({ mode: 'stand', prop: ['point', 0.52],
        ...H2(lifeCaptain, f, 51, { ht: q(kf([[211, -2], [228, -5], [246, -3.5], [335, -2]], f), 1), look: -0.35, lookY: -0.05, facing: -0.3,
          squash: q(kf([[211, 0], [228, 0.05], [240, 0.1], [252, 0.04], [335, 0]], f), 2) }) }, 3.2, -3.7, { yaw: -0.25 });
      sailorAStd({ mode: 'stand', ...H2(lifeSA, f, 31, { ht: -2, look: -0.3, lookY: 0, facing: -0.25 }) }, 2.15, -2.55, { yaw: -0.2 });
      sailorBStd({ mode: 'stand', ...H2(lifeSB, f, 41, { ht: -1.5, look: 0.35, lookY: 0, facing: 0.3 }) }, 1.35, -4.7, { yaw: 0.25 });
      break;
    }
    case 'bet': {
      // her home on the line: her right hand flat on the cottage
      // post, the Captain facing her, arms heavy, unbelieving.
      maraStd({ mode: 'stand', prop: ['point', q(kf([[336, 0.4], [352, 0.66], [444, 0.62]], f), 2)],
        ...H2(lifeMara, f, 21, { ht: -2, look: -0.45, lookY: -0.08, facing: -0.4 }) }, 3.35, 9.25, { yaw: -0.35 });
      captainStd({ mode: 'stand', propL: ['point', 0.28],
        ...H2(lifeCaptain, f, 51, { ht: -1, look: 0.5, lookY: 0, facing: 0.45 }) }, 1.55, 10.15, { yaw: 0.4 });
      break;
    }
    case 'evening': {
      // the mockery: two sailors on the quay point at her window
      // and laugh; far behind them Mara sits in her doorway,
      // mending on, saying nothing.
      sailorAStd({ mode: 'stand', prop: f >= 508 ? ['point', q(0.6 + 0.25 * Math.sin(f * 0.11), 2)] : null,
        ...H2(lifeSA, f, 31, { ht: -3, look: 0.55, lookY: -0.1, facing: 0.5 }) }, 0.2, 9.6, { yaw: 0.45 });
      sailorBStd({ mode: 'stand', propL: f >= 516 ? ['point', 0.7] : null,
        ...H2(lifeSB, f, 41, { ht: -2.5, look: 0.5, lookY: -0.05, facing: 0.45 }) }, -0.5, 9.0, { yaw: 0.4 });
      maraStd({ mode: 'sit', prop: ['point', 0.78], propL: ['point', 0.74],
        ...H2(lifeMara, f, 21, { ht: 3, look: -0.2, lookY: 0.35, facing: -0.15 }) }, 3.45, 9.35, { yaw: -0.15 });
      break;
    }
    case 'tube': case 'climb': break; // the barometer is the actor here
    case 'gulls': {
      // she looks UP — hand half-raised to shade her eyes — as
      // the gulls stream inland over her roof.
      maraStd({ mode: 'stand', prop: f >= 845 ? ['point', q(kf([[845, 0.2], [858, 0.42], [915, 0.38]], f), 2)] : null,
        ...H2(lifeMara, f, 21, { ht: -3.5, look: q(kf([[784, -0.2], [845, -0.5], [884, -0.35], [915, -0.3]], f), 2), lookY: q(kf([[784, 0.05], [845, -0.5], [884, -0.25], [915, -0.15]], f), 2), facing: -0.3 }) }, 3.4, 9.3, { yaw: -0.25 });
      break;
    }
    case 'chalk': {
      // beside the window: the chalk hand rises to the board on
      // "chalked" (f926), draws the mark, then she stands back
      // and TIMES the climb, gaze ticking between mark and water.
      const rk = reachK(f, 926, 956);
      maraStd({ mode: 'stand', prop: rk !== null ? ['point', rk] : ['point', 0.5],
        ...H2(lifeMara, f, 21, { ht: 1.5, look: q(kf([[916, 0.3], [952, 0.42], [975, 0.3], [1002, 0.38]], f), 2), lookY: q(kf([[916, 0.1], [952, -0.05], [975, 0.22], [1002, 0.05]], f), 2), facing: 0.35 }) }, 3.98, 8.3, { yaw: 0.3 });
      break;
    }
    case 'smoke': {
      // small in the foreground, watching the smoke lie down on
      // the roofs — she has seen the third sign.
      maraStd({ mode: 'stand', propL: ['point', 0.3],
        ...H2(lifeMara, f, 21, { ht: -2.5, look: 0.5, lookY: -0.3, facing: 0.45 }) }, -2.0, 3.5, { yaw: 0.4 });
      break;
    }
    case 'noon': {
      const m = maraWalkAt(f);
      if (m.mode === 'stroll') {
        // the walk: slate tucked under her left arm, stride
        // brisk and even, eyes on the office ahead.
        maraStd({ mode: 'stroll', phase: q(m.ph, 2), propL: ['point', 0.24],
          ...H2(lifeMara, f, 21, { ht: -1.5, look: -0.15, lookY: -0.05, facing: -0.1 }) }, m.x, m.z, { yaw: -0.1 });
      } else if (f < 1110) {
        maraStd({ mode: 'stand', ...H2(lifeMara, f, 21, { ht: -1.5, look: 0.2, lookY: 0, facing: 0.15 }) }, m.x, m.z, { yaw: 0.1 });
      } else if (f <= 1155) {
        // the sum: head down over the slate, right hand counting
        // off the hours on her fingers.
        maraStd({ mode: 'stand', prop: ['point', q(0.5 + 0.12 * Math.sin(f * 0.55), 2)], propL: ['point', 0.62],
          ...H2(lifeMara, f, 21, { ht: 3.5, look: 0.05, lookY: 0.48, facing: 0.05 }) }, m.x, m.z, { yaw: 0.05 });
      } else {
        // arrived: she looks up at the office door, decided.
        maraStd({ mode: 'stand', propL: ['point', 0.24],
          ...H2(lifeMara, f, 21, { ht: -2.5, look: 0.3, lookY: -0.15, facing: 0.25 }) }, m.x, m.z, { yaw: 0.2 });
      }
      break;
    }
    case 'line': {
      // THE LINE, performed at the office door: her mouth is the
      // stem's (speak.js); her right hand gestures on the stress
      // words; the Captain listens — mouth shut — and at "air"
      // (f1283) his certainty cracks into thought.
      const sp = SPEAK.at(f);
      const speakP = SPK.applySpeak({ ...MP, cheek: Math.max(MP.cheek ?? 0, 0.55) }, sp);
      speakP.blush = 0; speakP.openL = Math.min(1, (speakP.openL ?? 0.85) * 1.45); speakP.openR = Math.min(1, (speakP.openR ?? 0.85) * 1.45);
      std('mara', OUTFITS.mara, { expr: 'smile', exprP: speakP, blink: blinkAt(f, 20), seed: 21,
        prop: ['point', q(gestMara(f).k, 2)],
        headTilt: q((sp.nod || 0) + micro(f, 21) - 1.5, 1), look: q(-0.3, 2), lookY: q(-0.02, 2), facing: q(-0.28, 2),
        squash: 0, tilt: q(lifeMara(f).tilt + lifeMara(f).sway, 1), breath: Math.round(lifeMara(f).breath / 6) * 6 },
        1.9, -4.2, { yaw: -0.25 });
      captainStd({ mode: 'stand', ...H2(lifeCaptain, f, 51, { ht: q(kf([[1215, -1.5], [1269, -0.5], [1326, -1]], f), 1), look: -0.5, lookY: 0, facing: -0.45 }) }, 3.3, -5.7, { yaw: -0.4 });
      break;
    }
    case 'order': {
      // hesitation first (a long look at the calm sea), then the
      // arm goes UP and the order is law; Mara watches, vindicated
      // and quiet; the rope crews take hold.
      captainStd({ mode: 'stand', prop: f >= 1361 ? ['point', q(kf([[1361, 0.3], [1372, 0.92], [1408, 0.85]], f), 2)] : null,
        ...H2(lifeCaptain, f, 51, { ht: q(kf([[1327, 1.5], [1353, 2.5], [1361, -2], [1408, -2]], f), 1), look: q(kf([[1327, -0.6], [1353, -0.65], [1361, -0.2], [1408, -0.2]], f), 2), lookY: q(kf([[1327, 0.1], [1353, 0.15], [1361, -0.1], [1408, -0.1]], f), 2), facing: -0.3 }) }, 3.45, -4.5, { yaw: -0.25 });
      maraStd({ mode: 'stand', ...H2(lifeMara, f, 21, { ht: -2, look: 0.45, lookY: -0.05, facing: 0.4 }) }, 2.0, -3.85, { yaw: 0.35 });
      sailorAStd({ mode: 'stand', prop: f >= 1367 ? ['point', 0.82] : ['point', 0.4], propL: f >= 1367 ? ['point', 0.82] : null,
        ...H2(lifeSA, f, 31, { ht: f >= 1367 ? 3.5 : -1, look: -0.15, lookY: f >= 1367 ? 0.35 : 0, facing: -0.1, tilt: f >= 1367 ? 4 : 0 }) }, -2.3, -0.8, { yaw: -0.1 });
      sailorBStd({ mode: 'stand', prop: f >= 1372 ? ['point', 0.82] : ['point', 0.4], propL: f >= 1372 ? ['point', 0.82] : null,
        ...H2(lifeSB, f, 41, { ht: f >= 1372 ? 3.5 : -1, look: 0.15, lookY: f >= 1372 ? 0.35 : 0, facing: 0.1, tilt: f >= 1372 ? 4 : 0 }) }, -2.3, -6.8, { yaw: 0.1 });
      break;
    }
    case 'lostday': {
      // the price of safety, paid in idleness: the master sits on
      // a crate and stares at the kind sea; a sailor drowses on
      // the quay edge; another leans, arms folded, unconvinced.
      captainStd({ mode: 'sit', ...H2(lifeCaptain, f, 51, { ht: 1, look: -0.55, lookY: -0.05, facing: -0.5 }) }, -1.6, -2.6, { yaw: -0.45 });
      sailorAStd({ mode: 'sit', ...H2(lifeSA, f, 31, { ht: 3.5, look: -0.3, lookY: 0.1, facing: -0.25 }) }, -2.45, 0.9, { yaw: -0.2 });
      sailorBStd({ mode: 'stand', ...H2(lifeSB, f, 41, { ht: q(kf([[1409, -1], [1445, 1.5], [1476, -1]], f), 1), look: -0.5, lookY: -0.1, facing: -0.45 }) }, 0.6, -0.7, { yaw: -0.4 });
      break;
    }
    case 'sunset': {
      // both of them on the quay, watching the wall come in —
      // she was right about the hour; neither says it yet.
      maraStd({ mode: 'stand', propL: ['point', 0.35],
        ...H2(lifeMara, f, 21, { ht: -2.5, look: -0.6, lookY: -0.2, facing: -0.55 }) }, -1.2, 0.7, { yaw: -0.5 });
      captainStd({ mode: 'stand', ...H2(lifeCaptain, f, 51, { ht: -2, look: -0.62, lookY: -0.18, facing: -0.58 }) }, -2.45, 0.2, { yaw: -0.55 });
      break;
    }
    case 'storm': {
      // under the office awning, out of the rain they watch the
      // fleet ride it out — fear first, then, on "safe", relief.
      maraStd({ mode: 'stand', propL: ['point', 0.55],
        ...H2(lifeMara, f, 21, { ht: -2.5, look: -0.55, lookY: -0.15, facing: -0.5 }) }, 3.35, -2.6, { yaw: -0.45 });
      captainStd({ mode: 'stand', prop: ['point', 0.5],
        ...H2(lifeCaptain, f, 51, { ht: -2, look: -0.58, lookY: -0.12, facing: -0.52 }) }, 3.95, -4.15, { yaw: -0.5 });
      sailorAStd({ mode: 'stand', prop: ['point', 0.85], propL: ['point', 0.85],
        ...H2(lifeSA, f, 31, { ht: 3.5, look: -0.15, lookY: 0.3, facing: -0.1, tilt: q(4 + Math.sin(f * 0.3) * 1.2, 1) }) }, -2.3, -0.8, { yaw: -0.1 });
      break;
    }
    case 'payoff': {
      // gold, hand to hand, at her blue door: his arm comes out
      // on "gold" (f1737) with the coins; she receives with both
      // hands; the painter touches up the blue behind them.
      captainStd({ mode: 'stand', prop: ['point', q(kf([[1710, 0.3], [1737, 0.38], [1752, 0.8], [1772, 0.62], [1832, 0.45]], f), 2)],
        ...H2(lifeCaptain, f, 51, { ht: -1.5, look: -0.45, lookY: 0.05, facing: -0.4 }) }, 2.5, 8.75, { yaw: -0.35 });
      maraStd({ mode: 'stand', prop: ['point', q(kf([[1710, 0.35], [1752, 0.55], [1832, 0.5]], f), 2)], propL: ['point', q(kf([[1710, 0.35], [1752, 0.55], [1832, 0.5]], f), 2)],
        ...H2(lifeMara, f, 21, { ht: q(kf([[1710, -2], [1752, 1], [1790, -2], [1832, -2]], f), 1), look: 0.45, lookY: q(kf([[1710, 0], [1752, 0.3], [1790, 0], [1832, 0]], f), 2), facing: 0.4 }) }, 3.3, 9.2, { yaw: 0.35 });
      std('sailorC', OUTFITS.sailorC, { expr: 'smile', exprP: SCP, blink: blinkAt(f, 61), seed: 61, mode: 'stand',
        prop: ['point', q(0.85 + 0.08 * Math.sin(f * 0.45), 2)], ...H2(lifeSC, f, 61, { ht: -3, look: 0.3, lookY: -0.3, facing: 0.25 }) }, 4.15, 7.3, { yaw: 0.2 });
      sailorAStd({ mode: 'stand', ...H2(lifeSA, f, 31, { ht: -2, look: 0.4, lookY: -0.05, facing: 0.35 }) }, 1.05, 10.45, { yaw: 0.3 });
      break;
    }
    case 'hookboard': {
      // the film ends on a CHARACTER BEAT — Mara kneels in the
      // foreground pointing up at the hook board as it rises
      // behind her; her head stays below the board's text band.
      maraStd({ mode: 'kneel', prop: ['point', 0.32],
        ...H2(lifeMara, f, 21, { ht: -2.5, look: 0.45, lookY: -0.35, facing: 0.45 }) }, -0.55, -9.95, { yaw: 0.5 });
      captainStd({ mode: 'stand', ...H2(lifeCaptain, f, 51, { ht: -2.5, look: -0.4, lookY: -0.4, facing: -0.4 }) }, 1.3, -10.75, { yaw: -0.35 });
      sailorBStd({ mode: 'stand', ...H2(lifeSB, f, 41, { ht: -2.5, look: -0.45, lookY: -0.35, facing: -0.45 }) }, 0.95, -10.15, { yaw: -0.4, s: 0.85 });
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
