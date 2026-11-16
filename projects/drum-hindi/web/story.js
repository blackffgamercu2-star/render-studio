// Shot plan for "The Drum That Played Itself" — drum (LIBRARY v4:
// speak.js dialogue performance + materials v4, camrig smooth tracking +
// solid colliders). Built on the island-car3 reference implementation.
// GRADE (FILTER_VFX_LIGHTING pack): Night Lamp — deep blue night ambient,
// warm pools ONLY around the guard's lamp; silhouettes read against glow.
// The morning clause changes grade to a pre-dawn blend ON the clause
// boundary (pack rule: grades change only at clause boundaries).
// Signature VFX: lamp glow flicker on faces/walls, dust motes + falling
// beam-dust in the lamp light, moonlit ramparts in the drone opening,
// drumhead vibration ripple on every boom.
// Voice stem: 50.171 s, 30 fps, TOTAL 1505 (timings: faster-whisper word
// alignment, see timing.json). Scene changes ONLY at clause boundaries.
// World: a hill fort. Courtyard z<3.5; drum hall z 3.5..10.3 (open front,
// back wall z=10.45); drum centre (0, 6.8) axis along X, +X leather head
// faces the goat's path; curtain (2.55, 9.2); salt home (1.75, 9.7);
// side door in the +X hall wall at z=4.6; board in the courtyard.
import { M, blinkAt, q, clamp, lerp, ramp } from './motion.js';
import { buildRig, pushInCam, staticTrackCam, keysCam } from './camrig.js';
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

export const FPS = 30, TOTAL = 1505, DECK = 0;
const SHOTS_EN = [
  { id: 'drone', a: 0, b: 130, light: 'night' },
  { id: 'walls', a: 131, b: 261, light: 'night' },
  { id: 'young', a: 262, b: 349, light: 'night' },
  { id: 'hide', a: 350, b: 445, light: 'night' },
  { id: 'boom1', a: 446, b: 487, light: 'night' },
  { id: 'boom2', a: 488, b: 527, light: 'night' },
  { id: 'raise', a: 528, b: 587, light: 'night' },
  { id: 'goatdoor', a: 588, b: 688, light: 'night' },
  { id: 'curtain', a: 689, b: 785, light: 'night' },
  { id: 'butt', a: 786, b: 931, light: 'night' },
  { id: 'lick', a: 932, b: 991, light: 'night' },
  { id: 'move', a: 992, b: 1074, light: 'night' },
  { id: 'silence', a: 1075, b: 1144, light: 'night' },
  { id: 'morning', a: 1145, b: 1289, light: 'dawn' },
  { id: 'kept', a: 1290, b: 1363, light: 'dawn' },
  { id: 'hook', a: 1364, b: 1504, light: 'dawn' },
];
const TIMING_EN = SHOTS_EN.map((s) => [s.id, s.a, s.b]);
const shotAt_en = (f) => SHOTS_EN.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS_EN[0] : SHOTS_EN[SHOTS_EN.length - 1]);
const smooth = M.smooth;

// ---------- lights / mood grades (FILTER pack: Night Lamp -> dawn) ----------
export const LIGHTS = {
  night: { az: 302, el: 26, sky: '#546a96', ground: '#232c44', hemi: 0.62, sun: '#b9ccf2', sunI: 0.95, fog: '#16233f', fogNear: 26, fogFar: 240,
    skyTop: '#0a1730', skyHor: '#2c4a75', sunDisc: '#e9f1ff', sunSize: 0.0026, sat: 0.94, vig: 0.36, shadowExt: 30, aurora: 0, gain: '#e6ecff',
    waterDeep: '#16283f', waterShal: '#24466a', glint: '#cfe0ff' },
  dawn: { az: 252, el: 8, sky: '#7787ad', ground: '#33354a', hemi: 0.78, sun: '#ffb37a', sunI: 1.25, fog: '#3d4a68', fogNear: 30, fogFar: 260,
    skyTop: '#1d2c52', skyHor: '#c97e4a', sunDisc: '#ffcf9a', sunSize: 0.0034, sat: 1.0, vig: 0.3, shadowExt: 30, aurora: 0, gain: '#ffe7c9',
    waterDeep: '#1a2c46', waterShal: '#2a507a', glint: '#ffd9a8' },
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
const lightFor_en = (S, f) => {
  if (S.light === 'dawn') return blendLight(LIGHTS.night, LIGHTS.dawn, smooth(ramp(f, 1150, 1215)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging points (shared by story, main, colliders) ----------
export const BOARD_POS = [0, 2.6, 1.4];
export const DRUM_POS = [0, 6.8];            // drum centre (x,z); axis along X
export const CURTAIN = { x: 2.55, z: 9.2 };  // cloth, spans x 1.5..3.6
export const SALT_HOME = [1.75, 9.7];
export const SALT_OUT = [3.35, 1.95];
export const HIDE_POS = [-3.3, 4.62];        // young guard's pillar hide
export const STOOL_POS = [-2.62, 4.95];
export const yawOf = (hx, hz) => Math.atan2(-hz, hx);

// ---------- goat track (precomputed per frame) ----------
const GOAT_KEYS = [
  [0, 5.6, 4.5], [587, 5.6, 4.5],
  [588, 4.5, 4.6], [640, 3.3, 5.0], [688, 2.9, 5.3],
  [740, 2.2, 5.5], [785, 1.62, 5.62],
  [830, 1.52, 6.3], [897, 1.47, 6.85], [931, 1.5, 7.9],
  [960, 0.75, 8.9], [975, 0.98, 9.66], [1004, 0.98, 9.66],
  [1018, 0.7, 9.0], [1032, 2.4, 7.4], [1046, 3.55, 5.3], [1052, 4.3, 4.62], [1058, 5.35, 4.5],
  [1074, 5.35, 4.5],
  [1075, 2.6, 2.28], [1289, 2.6, 2.28],
  [1290, 1.35, 0.5], [1504, 1.35, 0.5],
];
export const GOAT = [];
{
  let dist = 0, prev = null, lastYaw = 0.5;
  for (let f = 0; f < TOTAL; f++) {
    let x = GOAT_KEYS[0][1], z = GOAT_KEYS[0][2];
    for (let i = 1; i < GOAT_KEYS.length; i++) {
      if (f <= GOAT_KEYS[i][0]) { const a = GOAT_KEYS[i - 1], b = GOAT_KEYS[i]; const u = smooth(ramp(f, a[0], b[0])); x = lerp(a[1], b[1], u); z = lerp(a[2], b[2], u); break; }
      x = GOAT_KEYS[GOAT_KEYS.length - 1][1]; z = GOAT_KEYS[GOAT_KEYS.length - 1][2];
    }
    if (prev) dist += Math.hypot(x - prev.x, z - prev.z);
    let yaw = lastYaw;
    if (prev) { const dx = x - prev.x, dz = z - prev.z; if (Math.hypot(dx, dz) > 0.0005) yaw = yawOf(dx, dz); }
    if (f >= 968 && f <= 1010) yaw = -0.05;                    // licking the salt (faces +X)
    if (f >= 1075 && f <= 1289) yaw = 0.37;                    // courtyard: faces the salt block
    if (f >= 1290) yaw = 0.55;
    lastYaw = yaw;
    let on = 0;
    if (f >= 588 && f < 1058) on = 1; else if (f >= 1058 && f < 1066) on = 1 - ramp(f, 1058, 1066);
    else if (f >= 1075) on = 1;
    if (f >= 588 && f < 596) on = ramp(f, 588, 596);
    GOAT.push({ x, z, yaw, step: dist / 0.16 * Math.PI, on });
    prev = { x, z };
  }
}
export const goatAt = (f) => GOAT[clamp(Math.round(f), 0, TOTAL - 1)];

// butt pulses: [frame, amp] — pushes at the "struck the drumhead" words,
// then the three spoken BOOMs. drumHit pulses add the first midnight booms.
const BUTT_PULSES = [[866, 0.55], [878, 0.55], [898, 1], [906, 1], [914, 1]];
const HIT_PULSES = [[478, 1], [497, 0.9], [513, 0.9], [866, 0.5], [878, 0.5], [898, 1], [906, 1], [914, 1]];
export const buttKAt = (f) => {
  let k = 0;
  for (const [p, a] of BUTT_PULSES) { const u = f - p; if (u >= 0 && u <= 12) k = Math.max(k, a * (u <= 3 ? u / 3 : 1 - (u - 3) / 9)); }
  return k;
};
export const drumHitAt = (f) => {
  let h = 0;
  for (const [p, a] of HIT_PULSES) { const u = f - p; if (u >= 0 && u <= 26) h += a * Math.exp(-u / 7) * (1 + 0.25 * Math.sin(u * 2.4)); }
  return clamp(h, 0, 1.15);
};
const lickKAt = (f) => {
  let g = 0;
  if (f >= 968 && f <= 1010) g = ramp(f, 968, 980) * (1 - ramp(f, 1000, 1010));
  if (f >= 1090 && f <= 1289) g = 0.65 * ramp(f, 1090, 1110);
  if (f >= 1300 && f <= 1360) g = 0.5 * ramp(f, 1300, 1312);
  return g * (0.5 - 0.5 * Math.cos(f * 0.33));
};

// ---------- young guard track (entry + the salt errand) ----------
const YOUNG_KEYS = [
  [0, -0.8, -1.2], [349, -0.8, -1.2],
  [350, -2.2, 2.4], [364, -2.35, 3.3], [378, -2.7, 4.35], [392, HIDE_POS[0], HIDE_POS[1]], [991, HIDE_POS[0], HIDE_POS[1]],
  [1004, -3.45, 5.95], [1016, -2.0, 6.8], [1027, -0.6, 8.8], [1034, 0.75, 9.3], [1038, 1.08, 9.5], [1044, 1.08, 9.5],
  [1048, 0.8, 9.15], [1056, 2.9, 2.2], [1064, 2.9, 2.2], [1069, 1.95, 1.95], [1074, 1.6, 0.95], [1504, 1.6, 0.95],
];
export const YOUNG = [];
{
  let dist = 0, prev = null, lastYaw = 0.3;
  for (let f = 0; f < TOTAL; f++) {
    let x = YOUNG_KEYS[0][1], z = YOUNG_KEYS[0][2];
    for (let i = 1; i < YOUNG_KEYS.length; i++) {
      if (f <= YOUNG_KEYS[i][0]) { const a = YOUNG_KEYS[i - 1], b = YOUNG_KEYS[i]; const u = smooth(ramp(f, a[0], b[0])); x = lerp(a[1], b[1], u); z = lerp(a[2], b[2], u); break; }
      x = YOUNG_KEYS[YOUNG_KEYS.length - 1][1]; z = YOUNG_KEYS[YOUNG_KEYS.length - 1][2];
    }
    let speed = 0;
    if (prev) { const d = Math.hypot(x - prev.x, z - prev.z); dist += d; speed = d * 30; }
    let yaw = lastYaw;
    if (prev) { const dx = x - prev.x, dz = z - prev.z; if (Math.hypot(dx, dz) > 0.0005) yaw = yawOf(dx, dz); }
    lastYaw = yaw;
    YOUNG.push({ x, z, yaw, speed, phase: (dist / 0.55) % 1 });
    prev = { x, z };
  }
}
export const youngAt = (f) => YOUNG[clamp(Math.round(f), 0, TOTAL - 1)];

// ---------- salt state ----------
export const saltAt = (f) => {
  if (f < 1044) return { x: SALT_HOME[0], z: SALT_HOME[1], y: 0, carried: 0, on: 1 };
  if (f < 1064) { const y = youngAt(f); return { x: y.x, z: y.z, y: 0.72, carried: 1, on: 1 }; }   // in the guard's hands (his pos; group-skipped)
  const u = ramp(f, 1064, 1072);
  // still "carried" (hands lowering it) until it rests at f1072 — the
  // ground gate only judges the resting frames.
  return { x: lerp(2.9, SALT_OUT[0], u), z: lerp(2.2, SALT_OUT[1], u), y: 0.72 * (1 - u) * (1 - u), carried: f < 1072 ? 1 : 0, on: 1 };
};

// ---------- hero / focus ----------
const FOCUS = {
  drone: () => [0, 1.6, 5.0], walls: () => [0, 3.2, -6.2], young: () => [-0.8, 1.25, -1.2],
  hide: () => [HIDE_POS[0], 1.1, HIDE_POS[1]], boom1: () => [0, 1.0, 6.8], boom2: () => [0, 1.1, 6.8],
  raise: () => [HIDE_POS[0], 1.25, HIDE_POS[1]], goatdoor: () => { const g = goatAt(640); return [g.x, 0.5, g.z]; },
  curtain: () => [2.1, 0.7, 9.3], butt: () => [0.85, 0.95, 6.8], lick: () => [1.3, 0.5, 9.6],
  move: () => { const y = youngAt(1030); return [y.x, 1.0, y.z]; }, silence: () => [0, 1.1, 6.8],
  morning: () => [0.6, 1.3, -0.6], kept: () => [1.35, 0.6, 0.5], hook: () => BOARD_POS,
};
const heroPosAt_en = (f) => FOCUS[shotAt_en(f).id]();

// ---------- cameras: EVERY shot is a camrig track on a subject ----------
const goatPos = (f) => { const g = goatAt(f); return [g.x, 0, g.z]; };
const RIG_BY_ID = {
  drone: { cut: 'hard', raw: keysCam({ keys: [
    { f: 0, pos: [16, 30, -36], look: [0, 2, 4], fov: 47 },
    { f: 70, pos: [8, 12, -16], look: [0, 2.2, 2.5], fov: 43, ease: 'surge' },
    { f: 130, pos: [3.4, 3.4, -3.4], look: [0, 2.0, 3.4], fov: 40, ease: 'surge' }] }) },
  walls: { cut: 'hard', raw: keysCam({ keys: [
    { f: 131, pos: [-6.8, 4.8, -11.8], look: [-0.5, 3.3, -6], fov: 40 },
    { f: 261, pos: [-5.6, 4.4, -10.6], look: [0.2, 3.2, -6], fov: 36, ease: 'surge' }] }) },
  young: { cut: 'hard', raw: pushInCam({ subject: () => [-0.8, 0, -1.2], dir: () => [0.3, 0.95], d0: 4.6, d1: 3.2, h0: 1.7, h1: 1.55, a: 262, b: 349, lookOff: [0, 1.3, 0], fov0: 38, fov1: 33 }) },
  hide: { cut: 'hard', raw: keysCam({ keys: [
    { f: 350, pos: [-1.6, 1.7, 0.8], look: [-3.1, 1.1, 4.4], fov: 40 },
    { f: 445, pos: [-2.0, 1.6, 1.6], look: [-3.15, 1.05, 4.5], fov: 37, ease: 'surge' }] }) },
  boom1: { cut: 'hard', raw: keysCam({ keys: [
    { f: 446, pos: [2.9, 1.7, 2.9], look: [0, 0.98, 6.8], fov: 40 },
    { f: 487, pos: [2.6, 1.6, 3.4], look: [0, 0.98, 6.8], fov: 36, ease: 'surge' }] }) },
  boom2: { cut: 'hard', raw: keysCam({ keys: [
    { f: 488, pos: [-2.9, 1.7, 3.1], look: [0, 0.98, 6.8], fov: 38 },
    { f: 527, pos: [-2.6, 1.62, 3.5], look: [0, 0.98, 6.8], fov: 36, ease: 'surge' }] }) },
  raise: { cut: 'hard', raw: keysCam({ keys: [
    { f: 528, pos: [-0.9, 1.5, 1.4], look: [-3.15, 1.25, 4.5], fov: 36 },
    { f: 587, pos: [-1.3, 1.55, 2.2], look: [-3.15, 1.28, 4.5], fov: 33, ease: 'surge' }] }) },
  goatdoor: { cut: 'hard', raw: staticTrackCam({ pos: [0.6, 1.5, 1.8], subject: goatPos, lookOff: [0, 0.45, 0], fov: 36 }) },
  curtain: { cut: 'hard', raw: keysCam({ keys: [
    { f: 689, pos: [0.2, 1.5, 5.6], look: [2.3, 0.8, 9.4], fov: 38 },
    { f: 785, pos: [0.45, 1.45, 6.0], look: [2.25, 0.78, 9.4], fov: 36, ease: 'surge' }] }) },
  butt: { cut: 'hard', raw: keysCam({ keys: [
    { f: 786, pos: [3.3, 1.4, 8.6], look: [1.05, 0.85, 6.9], fov: 36 },
    { f: 931, pos: [3.15, 1.35, 8.75], look: [1.05, 0.85, 6.9], fov: 34, ease: 'surge' }] }) },
  lick: { cut: 'hard', raw: keysCam({ keys: [
    { f: 932, pos: [-0.6, 1.3, 6.9], look: [1.3, 0.55, 9.6], fov: 36 },
    { f: 991, pos: [-0.4, 1.28, 7.2], look: [1.3, 0.55, 9.6], fov: 34, ease: 'surge' }] }) },
  move: { cut: 'hard', raw: keysCam({ keys: [
    { f: 992, pos: [2.2, 1.9, 0.4], look: [-2.2, 1.0, 6.0], fov: 40 },
    { f: 1038, pos: [1.4, 1.7, 4.6], look: [1.0, 0.8, 9.4], fov: 37, ease: 'surge' },
    { f: 1056, pos: [2.4, 1.8, -1.8], look: [2.9, 0.8, 2.4], fov: 37, ease: 'surge' },
    { f: 1074, pos: [2.0, 1.7, -1.2], look: [3.0, 0.7, 2.1], fov: 36, ease: 'surge' }] }) },
  silence: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1075, pos: [-2.8, 1.6, 0.2], look: [0.3, 1.1, 6.8], fov: 38 },
    { f: 1144, pos: [-2.5, 1.58, 0.7], look: [0.3, 1.08, 6.8], fov: 36, ease: 'surge' }] }) },
  morning: { cut: 'hard', raw: pushInCam({ subject: () => [0.6, 0, -0.6], dir: () => [0.25, 0.97], d0: 5.2, d1: 3.1, h0: 1.7, h1: 1.58, a: 1145, b: 1289, lookOff: [0, 1.32, 0], fov0: 36, fov1: 30 }) },
  kept: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1290, pos: [6.8, 2.6, -6.5], look: [0.8, 0.9, 0.8], fov: 42 },
    { f: 1363, pos: [6.4, 2.5, -6.0], look: [0.8, 0.9, 0.8], fov: 40, ease: 'surge' }] }) },
  hook: { cut: 'blend', blend: 8, raw: keysCam({ keys: [
    { f: 1364, pos: [0.9, 5.5, -11.8], look: [0, 2.55, 1.4], fov: 42 },
    { f: 1504, pos: [0.7, 5.2, -10.8], look: [0, 2.55, 1.4], fov: 38, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS_EN.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: 478, a: 0.03 }, { f: 898, a: 0.035 }, { f: 906, a: 0.03 }, { f: 914, a: 0.035 }],
  sigma: 2.3, fovSigma: 1.6,
});
const camAt_en = (f) => RIG.camAt(f);
export const RIG_META = {
  kicks: RIG.declared.kicks, hardCuts: RIG.declared.hardCuts,
  blends: SHOTS_EN.filter((s) => RIG_BY_ID[s.id].cut === 'blend').map((s) => ({ a: s.a - Math.floor(RIG_BY_ID[s.id].blend / 2), b: s.a + Math.ceil(RIG_BY_ID[s.id].blend / 2) })),
  whips: [...RIG.declared.whips, { a: 1038, b: 1056 }],
  samples: RIG.samples,
};
const dofAt_en = (f) => {
  const S = shotAt_en(f), C = camAt_en(f), hp = heroPosAt_en(f);
  let cinf = 2.4;
  if (['drone', 'walls', 'kept'].includes(S.id)) cinf = 1.4;
  if (['boom1', 'raise', 'butt', 'lick', 'morning', 'young'].includes(S.id)) cinf = 3.6;
  if (S.id === 'hook') cinf = 3.0;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
const worldAt_en = (f) => {
  const S = shotAt_en(f), g = goatAt(f), st = saltAt(f);
  const W = {
    boardTitle: 0, boardHook: 0,
    goatX: g.x, goatZ: g.z, goatYaw: g.yaw, goatOn: g.on, goatStep: g.step,
    goatButt: buttKAt(f), goatLick: lickKAt(f),
    drumHit: drumHitAt(f), dustFall: 0,
    lampX: STOOL_POS[0], lampY: 0.62, lampZ: STOOL_POS[1], lampK: 0,
    saltX: st.x, saltZ: st.z, saltY: st.y, saltOn: st.on,
    curtainK: 0.5 + 0.5 * Math.sin(f * 0.021),
  };
  if (S.id === 'drone') W.boardTitle = smooth(ramp(f, 40, 58)) * (1 - smooth(ramp(f, 84, 100)));
  if (S.id === 'hook') W.boardHook = f < 1392 ? smooth(ramp(f, 1370, 1392)) : 1;   // held at FULL opacity to the literal last frame
  // lamp: on the stool while he waits; raised in his hand from 'raise'
  // through 'lick'; back on the stool for the errand; a low glow beside
  // him on the silence night; out by morning.
  if (['hide', 'boom1', 'boom2'].includes(S.id)) { W.lampK = 0.55; }
  if (['raise', 'goatdoor', 'curtain', 'butt', 'lick'].includes(S.id)) {
    const u = S.id === 'raise' ? smooth(ramp(f, 532, 548)) : 1;
    W.lampX = lerp(STOOL_POS[0], HIDE_POS[0] + 0.3, u); W.lampZ = lerp(STOOL_POS[1], HIDE_POS[1] + 0.05, u);
    W.lampY = lerp(0.62, 1.12, u); W.lampK = lerp(0.55, 1.0, u);
  }
  if (S.id === 'move') { W.lampK = 0.3; }
  if (S.id === 'silence') { W.lampX = -1.3; W.lampY = 0.24; W.lampZ = 3.15; W.lampK = 0.5; }
  if (S.id === 'young' || S.id === 'drone' || S.id === 'walls') { W.lampK = 0.35; }   // the hall lamp burns far behind him
  W.dustFall = W.drumHit * (['boom1', 'boom2', 'butt'].includes(S.id) ? 1 : 0);
  return W;
};
const fxProfileAt_en = (f) => {
  const S = shotAt_en(f);
  const hall = ['hide', 'boom1', 'boom2', 'raise', 'goatdoor', 'curtain', 'butt', 'lick', 'move'].includes(S.id);
  return { smokeRate: hall ? 0.02 : 0.05, dustRate: hall ? 0.3 : 0.05, splashRate: 0 };
};

// ---------- cast (single source for actors AND colliders) ----------
const TINT = { night: '#dfe6ff', dawn: '#ffe7c9' };
const tintFor = (S) => TINT[S.light] || '#ffffff';
export const OUTFITS = {
  young: { jacket: '#2e4a6b', pants: '#2c3440', boots: '#1f1710', hat: 'cap', cap: '#22344d', skin: '#c98a5a' },
  guard2: { jacket: '#2e4a6b', pants: '#2c3440', boots: '#1f1710', hat: 'cap', cap: '#22344d', skin: '#a06a3c', moustache: '#2c1e12' },
  guard3: { jacket: '#2e4a6b', pants: '#2c3440', boots: '#1f1710', hat: 'cap', cap: '#22344d', skin: '#e8b08a' },
  commander: { jacket: '#6e2434', pants: '#33302c', boots: '#241a12', hat: 'cap', cap: '#5d1a28', skin: '#e0aa7e', moustache: '#2c1e12' },
};
export const castAt = (f) => {
  const S = shotAt_en(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, y, z, ground, extra = {}) => out.push({ id, x, y, z, r: 0.32, ground,
    actor: (T) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x, y, z, ground: ground ?? y, tint, ...extra }) });
  const youngStatic = (expr, x, z, extra = {}) => std('young', OUTFITS.young, { expr, mode: 'stand', blink: blinkAt(f, 31), seed: 31 }, x, 0, z, 0, extra);
  const youngTrack = (expr) => {
    const y = youngAt(f);
    const moving = y.speed > 0.35;
    const opts = { expr, mode: moving ? (S.id === 'move' ? 'march' : 'stroll') : 'stand', phase: q(y.phase, 2), blink: blinkAt(f, 31), seed: 31 };
    out.push({ id: 'young', x: y.x, y: 0, z: y.z, r: 0.34, ground: 0,
      actor: (T) => ({ key: 'youngT' + JSON.stringify(opts), draw: (p) => T.bodyFront(p, OUTFITS.young, opts), x: y.x, y: 0, z: y.z, ground: 0, tint, yaw: 0 }) });
  };
  switch (S.id) {
    case 'drone': youngStatic('stern', -0.8, -1.2); break;
    case 'walls': {
      std('guard2', OUTFITS.guard2, { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 32), seed: 32 }, -2.2, 3.1, -6.2, 3.1);
      std('guard3', OUTFITS.guard3, { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 33), seed: 33, prop: ['point', 0.8] }, 1.8, 3.1, -6.2, 3.1);
      break;
    }
    case 'young': youngStatic('stern', -0.8, -1.2); break;
    case 'hide': youngTrack('nervous'); break;
    case 'boom1': case 'boom2': youngStatic('shock', HIDE_POS[0], HIDE_POS[1]); break;
    case 'raise': youngStatic('shock', HIDE_POS[0], HIDE_POS[1]); break;
    case 'goatdoor': case 'curtain': case 'butt': youngStatic('shock', HIDE_POS[0], HIDE_POS[1]); break;
    case 'lick': youngStatic('relief', HIDE_POS[0], HIDE_POS[1]); break;
    case 'move': youngTrack('smile'); break;
    case 'silence': youngStatic('nervous', -1.6, 3.3); break;
    case 'morning': {
      if (f < 1198) std('commander', OUTFITS.commander, { expr: 'laugh', mode: 'stand', blink: blinkAt(f, 77), seed: 77 }, 0.6, 0, -0.6, 0, { yaw: 0.15 });
      else if (f <= 1273) std('commander', OUTFITS.commander, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 77), seed: 77, look: -0.15, ...speakFace('grin', f) }, 0.6, 0, -0.6, 0, { yaw: 0.15 });
      else std('commander', OUTFITS.commander, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 77), seed: 77 }, 0.6, 0, -0.6, 0, { yaw: 0.15 });
      youngStatic('smile', -1.1, -0.9);
      break;
    }
    case 'kept': case 'hook': {
      std('guard2', OUTFITS.guard2, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 32), seed: 32 }, 3.1, 0, 0.9, 0);
      break;
    }
  }
  return out;
};
const actorsAt_en = (f, T) => castAt(f).map((c) => c.actor(T));
const fxAt_en = () => [];

// ---------- solidity: statics, dynamics, ground (LIBRARY v3 gate data) ----------
export const STATICS = [
  SOL.obb(-4.65, 6.9, 0, 0.15, 3.4, { h: 3.6, id: 'hallwallL' }),          // hall left wall (z 3.5..10.3)
  SOL.obb(4.65, 3.775, 0, 0.15, 0.275, { h: 3.6, id: 'hallwallR1' }),      // right wall, front of the side door
  SOL.obb(4.65, 7.725, 0, 0.15, 2.575, { h: 3.6, id: 'hallwallR2' }),      // right wall, behind the side door (gap z 4.05..5.15)
  SOL.obb(0, 10.45, 0, 4.8, 0.15, { h: 3.6, id: 'backwall' }),
  SOL.circle(-3.2, 3.7, 0.26, { h: 3.4, id: 'pillar' }),
  SOL.circle(3.2, 3.7, 0.26, { h: 3.4, id: 'pillar' }),
  SOL.obb(DRUM_POS[0], DRUM_POS[1], 0, 0.85, 0.97, { h: 1.9, id: 'drum' }),
  SOL.obb(CURTAIN.x, CURTAIN.z, 0, 1.05, 0.08, { h: 2.6, id: 'curtain' }),
  SOL.circle(STOOL_POS[0], STOOL_POS[1], 0.18, { h: 0.55, id: 'stool' }),
  SOL.circle(BOARD_POS[0] - 2.35, BOARD_POS[2], 0.09, { h: 3.6, id: 'boardpost' }),
  SOL.circle(BOARD_POS[0] + 2.35, BOARD_POS[2], 0.09, { h: 3.6, id: 'boardpost' }),
];
export const WORLD = SOL.makeWorld(STATICS);
const dynamicsAt_en = (f) => {
  const out = [];
  for (const a of castAt(f)) out.push(SOL.circle(a.x, a.z, a.r, { kind: 'dynamic', id: a.id }));
  const g = goatAt(f);
  if (g.on > 0.01) out.push(SOL.circle(g.x, g.z, 0.42, { kind: 'dynamic', id: 'goat' }));
  const st = saltAt(f);
  if (st.on) out.push(st.carried
    ? SOL.circle(st.x, st.z, 0.3, { kind: 'dynamic', id: 'salt', group: 'younggrp' })
    : SOL.circle(st.x, st.z, 0.3, { kind: 'dynamic', id: 'salt' }));
  // the young guard carries the salt: same group so the pair is skipped
  return out.map((d) => (d.id === 'young' && st.carried ? { ...d, group: 'younggrp' } : d));
};
const groundItemsAt_en = (f) => {
  const items = [];
  for (const a of castAt(f)) if (a.ground !== null && a.ground !== undefined) items.push({ id: a.id, y: a.y, ground: a.ground, maxHover: 0.06 });
  const g = goatAt(f);
  if (g.on > 0.01) items.push({ id: 'goat', y: 0, ground: 0, maxHover: 0.05 });
  const st = saltAt(f);
  if (st.on && !st.carried) items.push({ id: 'salt', y: st.y, ground: 0, maxHover: 0.05 });
  return items;
};

export const SHOTS = [
  { id: 'drone', a: 0, b: 133, light: 'night' },
  { id: 'walls', a: 134, b: 300, light: 'night' },
  { id: 'young', a: 301, b: 388, light: 'night' },
  { id: 'hide', a: 389, b: 482, light: 'night' },
  { id: 'boom1', a: 483, b: 525, light: 'night' },
  { id: 'boom2', a: 526, b: 567, light: 'night' },
  { id: 'raise', a: 568, b: 618, light: 'night' },
  { id: 'goatdoor', a: 619, b: 704, light: 'night' },
  { id: 'curtain', a: 705, b: 824, light: 'night' },
  { id: 'butt', a: 825, b: 989, light: 'night' },
  { id: 'lick', a: 990, b: 1047, light: 'night' },
  { id: 'move', a: 1048, b: 1127, light: 'night' },
  { id: 'silence', a: 1128, b: 1186, light: 'night' },
  { id: 'morning', a: 1187, b: 1320, light: 'dawn' },
  { id: 'kept', a: 1321, b: 1409, light: 'dawn' },
  { id: 'hook', a: 1410, b: 1504, light: 'dawn' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
// ---------- HINDI retime wrapper (generated by retime.py) ----------
// Piecewise-linear EN->HI frame warp on phrase anchors; EN logic verbatim.
const WARP = [[0,0], [121,132], [131,134], [248,298], [262,301], [334,387], [350,389], [430,480], [446,483], [485,523], [488,526], [517,564], [528,568], [569,616], [588,619], [675,702], [689,705], [770,821], [786,825], [920,987], [932,990], [976,1044], [992,1048], [1061,1126], [1075,1128], [1130,1185], [1145,1187], [1274,1320], [1290,1321], [1351,1408], [1364,1410], [1490,1499], [1505,1505]];
export const enFrame = (f) => {
  if (f <= 0) return 0;
  for (let i = 1; i < WARP.length; i++) {
    if (f <= WARP[i][0]) {
      const [x0, y0] = WARP[i - 1], [x1, y1] = WARP[i];
      return y0 + (y1 - y0) * (f - x0) / Math.max(1, x1 - x0);
    }
  }
  return WARP[WARP.length - 1][1];
};
const hiFrame = (e) => {
  if (e <= 0) return 0;
  for (let i = 1; i < WARP.length; i++) {
    if (e <= WARP[i][1]) {
      const [x0, y0] = WARP[i - 1], [x1, y1] = WARP[i];
      return x0 + (x1 - x0) * (e - y0) / Math.max(1, y1 - y0);
    }
  }
  return WARP[WARP.length - 1][0];
};
export const shotAt = (f) => shotAt_en(hiFrame(f));
export const camAt = (f) => camAt_en(hiFrame(f));
export const dofAt = (f) => dofAt_en(hiFrame(f));
export const worldAt = (f) => worldAt_en(hiFrame(f));
export const fxProfileAt = (f) => fxProfileAt_en(hiFrame(f));
export const heroPosAt = (f) => heroPosAt_en(hiFrame(f));
export const lightFor = (S, f) => lightFor_en(S, hiFrame(f));
export const actorsAt = (f, T) => actorsAt_en(hiFrame(f), T);
export const fxAt = (f, T) => fxAt_en(hiFrame(f), T);
export const dynamicsAt = (f) => dynamicsAt_en(hiFrame(f));
export const groundItemsAt = (f) => groundItemsAt_en(hiFrame(f));
