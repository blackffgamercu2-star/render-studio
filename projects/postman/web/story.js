// Shot plan for "The Postman Who Outran the Train" — postman.
// Built on the REBUILT KIT (~/workspace/kit-rebuild/postman-kit): ball/cylinder
// shaded characters, deformAt liquid motion, true foot-plant walk + run,
// shake-free camrig (NO kicks, NO whips — smooth push-ins only), vivid
// daylight LIGHTS copied wholesale from the kit story.
// Voice stem: voice_tren_final.wav — local GPT-SoVITS tren/mirror fine-tune,
// re-fit at atempo 1.3557 + EQ to 59.979 s, 30 fps, TOTAL 1799. Word timings
// from faster-whisper small char-mapped onto the script (words.json).
// Scene changes ONLY at script-line boundaries (17 lines, 17 shots):
//   L1  l01 hook      Ramu + train BOTH big at the platform, frame 1.
//   L2  l02 bag       The left mailbag on the platform (insert).
//   L3  l03 letter    Letter insert + station-clock pressure.
//   L4  l04 driver    DRIVER dialogue close-up (lip-sync, line 4 ONLY).
//   L5  l05 laugh     Crowd laughs, Ramu smiles, tightens the bag strap.
//   L6  l06 leave     Ramu leaves the road, starts up the hill (WALK).
//   L7  l07 climb     Train loops wide below vs Ramu straight up (wide).
//   L8  l08 run       RUN down the far side, letter satchel on his back.
//   L9  l09 pass      Train thunders past BELOW; driver waves from cab.
//   L10 l10 block     Goods train blocks the crossing; engine waits.
//   L11 l11 fields    Fields, ditch LEAP (landing squash), clock strikes.
//   L12 l12 deliver   Letter into the boy's hands, one minute early.
//   L13 l13 wonder    The boy is the driver's own son — realisation.
//   L14 l14 cap       Driver climbs down, speechless, takes off his cap.
//   L15 l15 ramu      RAMU dialogue (lip-sync, line 15 ONLY).
//   L16 l16 close     Closing beat, town, warm wide.
//   L17 l17 hookboard "But tomorrow... the old woman..." board + Ramu.
// END RULE: line 17 is NARRATION ONLY — no character speaks at the end.
// Dialogue performance ONLY on L4 (driver) and L15 (Ramu); every other
// mouth stays shut (narration voice-over).
import { M, blinkAt, q, clamp, lerp, ramp, kf } from './motion.js';
import { buildRig, keysCam } from './camrig.js';
import { poseWindows, gazeTrack, lifeAt, emoTrack, gripAt, gestureAt, stridePh, jumpTrack, deformAt, walkLandings } from './body.js';
import * as SOL from './solid.js';
import * as T from './toon.js';
import * as SPK from './speak.js';
import { SPEAK_DATA } from './speakdata.js';

const SPEAK = SPK.makeSpeakPlayer(SPEAK_DATA);
const CHEEK = { neutral: 0.45, stern: 0.42, determined: 0.5, smile: 0.55, grin: 0.65, laugh: 0.85, shock: 0.22, wonder: 0.32, angry: 0.72, proud: 0.6, smug: 0.62, wink: 0.6, nervous: 0.3, scared: 0.25, sad: 0.35, thinking: 0.45, confused: 0.4, stubborn: 0.5, squint: 0.45, relief: 0.6 };
const faceP2 = (name) => ({ ...T.faceP(name), cheek: CHEEK[name] ?? 0.45 });

export const FPS = 30, TOTAL = 1799, DECK = 0;
// Shot boundaries — line starts from the NEW words.json (round(s*30)).
export const BND = [0, 100, 207, 329, 438, 543, 632, 749, 838, 958, 1060, 1191, 1283, 1400, 1503, 1604, 1697, 1799];
const IDS = ['l01', 'l02', 'l03', 'l04', 'l05', 'l06', 'l07', 'l08', 'l09', 'l10', 'l11', 'l12', 'l13', 'l14', 'l15', 'l16', 'l17'];
export const SHOTS = IDS.map((id, i) => ({ id, a: BND[i], b: BND[i + 1] - 1, light: 'night' }));
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
const F = (id) => SHOTS.find((s) => s.id === id);
const B = (id) => F(id).a, E = (id) => F(id).b;

// ---------- lights: the kit's vivid daylight palette, copied wholesale ----------
export const LIGHTS = {
  night: { az: 148, el: 57, sky: '#9fd0f7', ground: '#7d8cc9', hemi: 1.12, sun: '#ffdf9e', sunI: 2.65, fog: '#cfe9f9', fogNear: 55, fogFar: 430,
    skyTop: '#1463d8', skyHor: '#bfe6fb', sunDisc: '#fff3c4', sunSize: 0.0055, sat: 1.24, vig: 0.13, shadowExt: 26, aurora: 0, gain: '#fff0cd',
    waterDeep: '#0d4a68', waterShal: '#2fb3c9', glint: '#ffffff' },
  dawn: { az: 128, el: 41, sky: '#a5d6f5', ground: '#8492c9', hemi: 1.06, sun: '#ffd488', sunI: 2.5, fog: '#dff0e2', fogNear: 50, fogFar: 400,
    skyTop: '#1d74dc', skyHor: '#f2eecb', sunDisc: '#ffedb8', sunSize: 0.006, sat: 1.26, vig: 0.14, shadowExt: 26, aurora: 0, gain: '#ffecc4',
    waterDeep: '#12506e', waterShal: '#35b0bd', glint: '#ffffff' },
};
LIGHTS.blaze = { ...LIGHTS.night, sunI: 2.8, sat: 1.30, vig: 0.15, gain: '#ffe9bd', skyHor: '#cdf2f4' };
export const lightFor = (S, f) => {
  if (S.id === 'l16' || S.id === 'l17') { const L = { ...LIGHTS.night }; L.sun = '#ffd9a0'; return L; }
  if (S.id === 'l01' || S.id === 'l09') return { ...LIGHTS.blaze };
  return { ...LIGHTS[S.light] };
};

// ---------- geography (shared with main.js world building) ----------
export const BOARD_POS = [0, 3.0, 52.5];
export const TABLE = { x: 0.6, z: 46.5 };
export const STAIR_N = 0;
export const stairPos = () => ({ x: 0, z: 0, y: 0, th: 0 });
export const PLATFORM = { x0: -10, x1: 10, z0: 1.8, z1: 5.4, top: 0.12 };
export const TRACK_A_Z = 0, TRACK_B_Z = 32;
export const hillY = (z) => {
  if (z <= 8 || z >= 30) return 0;
  return 6.5 * Math.pow(0.5 + 0.5 * Math.cos(Math.PI * (z - 19) / 11), 1.5);
};
export const groundAt = (x, z) => {
  if (x >= PLATFORM.x0 && x <= PLATFORM.x1 && z >= PLATFORM.z0 && z <= PLATFORM.z1) return PLATFORM.top;
  return hillY(z);
};

// ---------- Ramu's journey ----------
const LEAP_F0 = 1109;
const leapTrack = jumpTrack([{ f0: LEAP_F0, dur: 20, h: 0.6, back: 4 }]);
export const LEAP_LAND_F = LEAP_F0 + 20;
export const ramuAt = (f) => {
  const S = shotAt(f).id;
  const seg = (id, x0, z0, x1, z1, ease = true) => {
    const u0 = ease ? smooth(ramp(f, B(id), E(id))) : ramp(f, B(id), E(id));
    const x = lerp(x0, x1, u0), z = lerp(z0, z1, u0);
    return { x, z, y: groundAt(x, z), ground: groundAt(x, z), u: u0 };
  };
  switch (S) {
    case 'l01': case 'l02': case 'l03': case 'l04': case 'l05': return { x: 1.6, z: 3.6, y: PLATFORM.top, ground: PLATFORM.top, u: 0 };
    case 'l06': return seg('l06', 3.5, 6.2, 2.2, 10.8);
    case 'l07': return seg('l07', 2.2, 10.8, 0.6, 17.6);
    case 'l08': return seg('l08', 0.6, 19.6, -0.8, 28.6, false);
    case 'l09': return seg('l09', -0.8, 28.6, -1.2, 30.6, false);
    case 'l10': return { x: -1.2, z: 34.5, y: 0, ground: 0, u: 1 };
    case 'l11': { const r = seg('l11', -0.8, 34.5, 0.2, 43.5, false); const J = leapTrack(f); return { ...r, y: r.ground + J.y, jump: J }; }
    default: return { x: 0.6, z: 46.5, y: 0, ground: 0, u: 1 };
  }
};

// ---------- trains (world tracks; main.js reads the same functions) ----------
export const trainZAt = (f) => shotAt(f).a >= B('l08') ? TRACK_B_Z : TRACK_A_Z;
export const trainXAt = (f) => {
  const S = shotAt(f).id;
  if (S === 'l01') return -1.7;
  if (S === 'l06') return lerp(-7.5, 26, smooth(ramp(f, B('l06'), E('l06'))));
  if (S === 'l07') return lerp(26, 62, smooth(ramp(f, B('l07'), E('l07'))));
  if (S === 'l08') return lerp(-48, -27, ramp(f, B('l08'), E('l08')));
  if (S === 'l09') return lerp(-27, 31, ramp(f, B('l09'), E('l09')));
  if (S === 'l10' || S === 'l11' || S === 'l12') return 7.5;
  if (S === 'l13') return lerp(7.5, 10.5, smooth(ramp(f, B('l13'), E('l13'))));
  if (f >= B('l14')) return 10.5;
  return -7.5;
};
export const goodsKAt = (f) => (f >= B('l10') && f < B('l15')) ? 1 : 0;
export const clockKAt = (f) => clamp(0.45 + 0.55 * ramp(f, 0, B('l12')), 0, 1);
export const bellKAt = (f) => {
  if (f < B('l11')) return 0;
  const d = f - B('l11');
  return Math.exp(-d / 55) * Math.abs(Math.sin(d * 0.30));
};

// ---------- deform / performance tracks (kit deformAt API) ----------
const driverDeform = deformAt({ speak: [{ a: B('l04'), b: E('l04') }], impulses: [{ f: B('l04') + 16, a: 0.09 }, { f: B('l04') + 38, a: 0.07 }, { f: B('l04') + 62, a: 0.08 }] });
const ramuSpeakDeform = deformAt({ speak: [{ a: B('l15'), b: E('l15') }] });
const laughDeform = deformAt({ impulses: [{ f: B('l05') + 8, a: 0.09 }, { f: B('l05') + 20, a: 0.07 }, { f: B('l05') + 33, a: 0.08 }, { f: B('l05') + 47, a: 0.06 }] });
const ramuRunDeform = deformAt({ landings: walkLandings(B('l08'), E('l08'), 13) });
const ramuFieldDeform = deformAt({ landings: walkLandings(B('l11'), E('l11'), 13), impulses: [{ f: LEAP_LAND_F, a: 0.14 }] });
const strapGrip = gripAt([{ f0: B('l05') + 52, dur: 18, type: 'lift', settle: 8 }]);
const ramuGesture = gestureAt([{ a: B('l15'), b: E('l15'), beats: [B('l15') + 12, B('l15') + 34, B('l15') + 58, B('l15') + 76], base: 0.48, amp: 0.2 }]);
const driverEmo14 = emoTrack(faceP2, 'sad', [[B('l14'), 'sad', 1], [B('l14') + 48, 'neutral', 22], [B('l14') + 78, 'relief', 20]]);
const boyEmo = emoTrack(faceP2, 'wonder', [[B('l13'), 'wonder', 1], [B('l13') + 55, 'smile', 24]]);
const ramuKneel = poseWindows([{ a: B('l02') + 10, b: E('l02'), mode: 'kneel', inF: 8, outF: 6 }]);

// ---------- hero / focus ----------
const FOCUS = {
  l01: () => [1.55, 1.4, 3.5], l02: () => [-4.2, 0.7, 3.8], l03: () => [1.2, 1.5, 3.4],
  l04: () => [-1.2, 1.55, 3.4], l05: () => [0.4, 1.5, 3.7],
  l06: (f) => { const r = ramuAt(f); return [r.x, r.y + 1.2, r.z]; },
  l07: (f) => { const r = ramuAt(f); return [r.x, r.y + 1.4, r.z]; },
  l08: (f) => { const r = ramuAt(f); return [r.x, r.y + 1.2, r.z]; },
  l09: (f) => { const r = ramuAt(f); return [r.x, r.y + 1.2, r.z]; },
  l10: () => [8.5, 1.9, TRACK_B_Z], l11: (f) => { const r = ramuAt(f); return [r.x, r.y + 1.2, r.z]; },
  l12: () => [1.3, 1.3, 46.6], l13: () => [1.9, 1.25, 46.8], l14: () => [3.4, 1.45, 45.8],
  l15: () => [0.8, 1.5, 46.2], l16: () => [1.6, 1.4, 46.6], l17: () => [0.6, 2.6, 53.5],
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id](f);

// ---------- cameras: shake-free rig, smooth push-ins only, NO kicks ----------
const trackKeys = (id, dist, h, fov0, fov1, lookDy = 1.18) => {
  const a = B(id), b = E(id), mid = Math.round((a + b) / 2);
  return [a, mid, b].map((f, i) => {
    const r = ramuAt(f);
    return { f, pos: [r.x - dist, r.y + h, r.z + 0.7], look: [r.x, r.y + lookDy, r.z], fov: lerp(fov0, fov1, i / 2), ...(i > 0 ? { ease: 'io' } : {}) };
  });
};
const RIG_SHOTS = [
  { id: 'l01', a: B('l01'), b: E('l01'), cut: 'hard', raw: keysCam({ keys: [
    { f: B('l01'), pos: [2.3, 2.05, 8.4], look: [1.55, 1.32, 3.4], fov: 40 },
    { f: B('l01') + 14, pos: [2.12, 1.98, 8.1], look: [1.52, 1.36, 3.42], fov: 37, ease: 'io' },
    { f: E('l01'), pos: [2.05, 1.95, 8.0], look: [1.5, 1.38, 3.45], fov: 36, ease: 'io' }] }) },
  { id: 'l02', a: B('l02'), b: E('l02'), cut: 'hard', raw: keysCam({ keys: [
    { f: B('l02'), pos: [-3.1, 1.2, -0.6], look: [-4.3, 0.62, 3.8], fov: 38 },
    { f: B('l02') + 13, pos: [-3.3, 1.1, 0.05], look: [-4.35, 0.6, 3.8], fov: 34, ease: 'io' },
    { f: E('l02'), pos: [-3.35, 1.08, 0.2], look: [-4.35, 0.6, 3.8], fov: 33, ease: 'io' }] }) },
  { id: 'l03', a: B('l03'), b: E('l03'), cut: 'hard', raw: keysCam({ keys: [
    { f: B('l03'), pos: [2.1, 1.66, -1.3], look: [1.35, 1.3, 3.5], fov: 38 },
    { f: B('l03') + 13, pos: [2.02, 1.62, -0.85], look: [1.38, 1.33, 3.5], fov: 34, ease: 'io' },
    { f: E('l03'), pos: [2.0, 1.6, -0.7], look: [1.4, 1.35, 3.5], fov: 33, ease: 'io' }] }) },
  { id: 'l04', a: B('l04'), b: E('l04'), cut: 'hard', raw: keysCam({ keys: [
    { f: B('l04'), pos: [-0.72, 1.68, -0.7], look: [-1.25, 1.5, 3.4], fov: 34 },
    { f: B('l04') + 11, pos: [-0.86, 1.64, -0.25], look: [-1.22, 1.52, 3.4], fov: 29, ease: 'io' },
    { f: E('l04'), pos: [-0.88, 1.63, -0.15], look: [-1.2, 1.53, 3.4], fov: 28, ease: 'io' }] }) },
  { id: 'l05', a: B('l05'), b: E('l05'), cut: 'hard', raw: keysCam({ keys: [
    { f: B('l05'), pos: [0.5, 1.85, -7.2], look: [0.1, 1.35, 3.6], fov: 42 },
    { f: B('l05') + 14, pos: [0.5, 1.8, -6.7], look: [0.2, 1.38, 3.6], fov: 39, ease: 'io' },
    { f: E('l05'), pos: [0.5, 1.78, -6.45], look: [0.25, 1.4, 3.6], fov: 38, ease: 'io' }] }) },
  { id: 'l06', a: B('l06'), b: E('l06'), cut: 'hard', raw: keysCam({ keys: trackKeys('l06', 5.4, 1.45, 38, 35) }) },
  { id: 'l07', a: B('l07'), b: E('l07'), cut: 'hard', raw: keysCam({ keys: [
    { f: B('l07'), pos: [17.5, 10.5, 30.5], look: [0, 3.2, 9.5], fov: 44 },
    { f: B('l07') + 16, pos: [16.6, 10.1, 29.6], look: [0.1, 3.5, 10], fov: 41, ease: 'io' },
    { f: E('l07'), pos: [15.9, 9.8, 29.0], look: [0.2, 3.8, 10.5], fov: 40, ease: 'io' }] }) },
  { id: 'l08', a: B('l08'), b: E('l08'), cut: 'hard', raw: keysCam({ keys: trackKeys('l08', 5.8, 1.35, 39, 36) }) },
  { id: 'l09', a: B('l09'), b: E('l09'), cut: 'hard', raw: keysCam({ keys: trackKeys('l09', 10.5, 1.7, 42, 39, 1.25) }) },
  { id: 'l10', a: B('l10'), b: E('l10'), cut: 'hard', raw: keysCam({ keys: [
    { f: B('l10'), pos: [-1.5, 2.5, 24.5], look: [9.5, 1.8, 32.5], fov: 42 },
    { f: B('l10') + 15, pos: [-0.9, 2.35, 25.3], look: [9.8, 1.85, 32.4], fov: 38, ease: 'io' },
    { f: E('l10'), pos: [-0.6, 2.3, 25.7], look: [10, 1.9, 32.4], fov: 37, ease: 'io' }] }) },
  { id: 'l11', a: B('l11'), b: E('l11'), cut: 'hard', raw: keysCam({ keys: trackKeys('l11', 6.2, 1.5, 39, 36) }) },
  { id: 'l12', a: B('l12'), b: E('l12'), cut: 'hard', raw: keysCam({ keys: [
    { f: B('l12'), pos: [1.2, 1.68, 39.4], look: [1.3, 1.25, 46.6], fov: 38 },
    { f: B('l12') + 12, pos: [1.24, 1.63, 40.0], look: [1.3, 1.28, 46.6], fov: 35, ease: 'io' },
    { f: E('l12'), pos: [1.26, 1.61, 40.25], look: [1.3, 1.3, 46.6], fov: 34, ease: 'io' }] }) },
  { id: 'l13', a: B('l13'), b: E('l13'), cut: 'hard', raw: keysCam({ keys: [
    { f: B('l13'), pos: [1.72, 1.6, 41.9], look: [1.85, 1.22, 46.7], fov: 37 },
    { f: B('l13') + 13, pos: [1.8, 1.55, 42.5], look: [1.88, 1.25, 46.7], fov: 32, ease: 'io' },
    { f: E('l13'), pos: [1.82, 1.54, 42.7], look: [1.9, 1.26, 46.7], fov: 31, ease: 'io' }] }) },
  { id: 'l14', a: B('l14'), b: E('l14'), cut: 'hard', raw: keysCam({ keys: [
    { f: B('l14'), pos: [3.1, 1.68, 41.9], look: [3.35, 1.4, 45.8], fov: 35 },
    { f: B('l14') + 14, pos: [3.18, 1.63, 42.5], look: [3.38, 1.43, 45.8], fov: 31, ease: 'io' },
    { f: E('l14'), pos: [3.2, 1.61, 42.7], look: [3.4, 1.44, 45.8], fov: 30, ease: 'io' }] }) },
  { id: 'l15', a: B('l15'), b: E('l15'), cut: 'hard', raw: keysCam({ keys: [
    { f: B('l15'), pos: [1.15, 1.7, 42.6], look: [0.85, 1.45, 46.2], fov: 33 },
    { f: B('l15') + 11, pos: [1.05, 1.65, 43.1], look: [0.82, 1.47, 46.2], fov: 28, ease: 'io' },
    { f: E('l15'), pos: [1.02, 1.64, 43.2], look: [0.8, 1.48, 46.2], fov: 27, ease: 'io' }] }) },
  { id: 'l16', a: B('l16'), b: E('l16'), cut: 'hard', raw: keysCam({ keys: [
    { f: B('l16'), pos: [10.5, 4.4, 35.5], look: [1.6, 1.5, 46.8], fov: 42 },
    { f: B('l16') + 15, pos: [10.0, 4.2, 36.2], look: [1.6, 1.55, 46.8], fov: 39, ease: 'io' },
    { f: E('l16'), pos: [9.7, 4.1, 36.6], look: [1.6, 1.6, 46.8], fov: 38, ease: 'io' }] }) },
  { id: 'l17', a: B('l17'), b: E('l17'), cut: 'hard', raw: keysCam({ keys: [
    { f: B('l17'), pos: [4.1, 2.6, 67.2], look: [0.05, 2.98, 52.5], fov: 40 },
    { f: B('l17') + 14, pos: [3.85, 2.45, 66.6], look: [0.02, 3.0, 52.5], fov: 38, ease: 'io' },
    { f: E('l17'), pos: [3.7, 2.35, 66.2], look: [0, 3.0, 52.5], fov: 36, ease: 'io' }] }) },
];
const RIG = buildRig({ total: TOTAL, shots: RIG_SHOTS, kicks: [], sigma: 3.2, smoothRadius: 10, fovSigma: 1.7 });
export const camAt = (f) => RIG.camAt(f);
export const RIG_META = {
  kicks: RIG.declared.kicks, hardCuts: RIG.declared.hardCuts,
  blends: [], whips: RIG.declared.whips, samples: RIG.samples,
};
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), hp = heroPosAt(f);
  let cinf = 2.0;
  if (['l07', 'l10', 'l16'].includes(S.id)) cinf = 1.3;
  if (['l04', 'l15'].includes(S.id)) cinf = 4.3;
  if (['l12', 'l13', 'l14'].includes(S.id)) cinf = 3.6;
  if (S.id === 'l17') cinf = 1.8;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = {
    boardHook: 0, intK: 0,
    trainX: trainXAt(f), trainZ: trainZAt(f), trainK: 1,
    goodsK: goodsKAt(f), clockK: clockKAt(f), bellK: bellKAt(f),
    dustK: ['l06', 'l08', 'l11'].includes(S.id) ? 0.5 : 0.08,
  };
  if (S.id === 'l17') W.boardHook = f < B('l17') + 20 ? smooth(ramp(f, B('l17') + 2, B('l17') + 20)) : 1;
  return W;
};
export const fxProfileAt = (f) => ({ moteRate: worldAt(f).dustK, sprayRate: 0, smokeRate: 0.02, dustRate: worldAt(f).dustK });
export const fxAt = () => [];

// ---------- cast ----------
export const OUTFITS = {
  ramu: { jacket: '#b3392e', pants: '#3a3230', boots: '#241a12', hat: 'cap', cap: '#8f2b22', skin: '#ffe2c2' },
  driver: { jacket: '#2c4a6e', pants: '#2a2f3a', boots: '#17120d', hat: 'cap', cap: '#22344e', skin: '#ffe2c2', moustache: '#3a2418' },
  driverBare: { jacket: '#2c4a6e', pants: '#2a2f3a', boots: '#17120d', hat: 'hair', hair: '#2a201a', skin: '#ffe2c2', moustache: '#3a2418' },
  boy: { jacket: '#e8a13c', pants: '#3b5b9a', boots: '#5a3b2a', hat: 'hair', hair: '#241a12', skin: '#ffe2c2', build: 'kid' },
  villager1: { jacket: '#3f7d4e', pants: '#33302c', boots: '#201812', hat: 'hair', hair: '#1e1714', skin: '#ffe2c2' },
  villager2: { jacket: '#7b5ac9', pants: '#2c3038', boots: '#1c1712', hat: 'cap', cap: '#54682c', skin: '#f5c9a0' },
  villager3: { jacket: '#2f7d8c', pants: '#33302c', boots: '#201812', hat: 'hair', hair: '#2b211c', skin: '#f5c9a0' },
};
const satchel = (p) => {
  p.poly([[228, 505], [300, 490], [306, 592], [234, 606]], '#7a4a26', 5);
  p.poly([[228, 505], [300, 490], [302, 528], [230, 540]], '#8f5a30', 4);
  p.poly([[252, 462], [292, 452], [298, 494], [258, 502]], '#f3e3bb', 3);
};
export const castAt = (f) => {
  const S = shotAt(f), out = [];
  const std = (id, o, opts, x, z, extra = {}) => {
    const L = lifeAt({ seed: opts.seed || 1, shift: 1.1, swayAmp: 0.5 })(f);
    const o2 = { ...opts, breath: opts.breath ?? L.breath, headTilt: q((opts.headTilt || 0) + L.tilt + (opts.speaker ? L.sway * 2.2 : 0), 1) };
    if (!o2.exprP && o2.expr) o2.exprP = faceP2(o2.expr);
    const side = extra.side;
    // bodySide paints faces from the old string FACE table (no FACEP):
    // map v2 expression names onto FACE-safe ones for side views.
    if (side && o2.expr) o2.expr = ({ determined: 'stern', smug: 'smile', wonder: 'shock', angry: 'stern', sad: 'pained', proud: 'smile', confused: 'nervous', scared: 'nervous', thinking: 'stern', stubborn: 'stern', squint: 'stern', wink: 'smile', relief: 'relief' })[o2.expr] || o2.expr;
    out.push({ id, x, y: extra.y ?? 0, z, r: 0.32, ground: extra.ground ?? 0,
      actor: (T) => ({ key: 'pm' + id + JSON.stringify(o) + JSON.stringify(o2) + (extra.y ?? 0), draw: (p) => { if (side) { T.bodySide(p, o, o2); if (extra.satchel) satchel(p); } else T.bodyFront(p, o, o2); }, x, y: extra.y ?? 0, z, ground: extra.ground ?? 0, tint: '#ffffff', ...extra }) });
  };
  const head = (seed, tilt, look, lookY, facing = 0) => ({ headTilt: q(tilt + 1.1 * Math.sin((f + seed * 5) * 0.037 + 1), 1), look: q(look, 2), lookY: q(lookY, 2), facing: q(facing, 2) });
  const R = ramuAt(f);
  const ramuFront = (opts, extra = {}) => std('ramu', OUTFITS.ramu, opts, R.x, R.z, { y: R.y, ground: R.ground, ...extra });
  const ramuSide = (opts, extra = {}) => std('ramu', OUTFITS.ramu, opts, R.x, R.z, { y: R.y, ground: R.ground, side: true, satchel: true, ...extra });
  const sidePhase = (strideLen) => q(stridePh(0, R.u * strideLen, strideLen / 8), 2);
  switch (S.id) {
    case 'l01': {
      ramuFront({ expr: 'determined', mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['letter', 0.45], ...head(31, -1, 0.15, 0.05) }, { yaw: 0.15 });
      std('driver', OUTFITS.driver, { expr: 'smug', mode: 'stand', blink: blinkAt(f, 41), seed: 41, ...head(41, 1, -0.3, 0, -0.15) }, 0.85, 3.5, { y: PLATFORM.top, ground: PLATFORM.top, yaw: -0.3 });
      break;
    }
    case 'l02': {
      const KP = ramuKneel(f);
      std('ramu', OUTFITS.ramu, { expr: 'determined', mode: KP.mode, squash: q(KP.squash, 2), blink: blinkAt(f, 31), seed: 31, ...head(31, -3, 0.3, -0.3) }, -3.3, 3.9, { y: PLATFORM.top, ground: PLATFORM.top, yaw: 0.35 });
      break;
    }
    case 'l03': {
      ramuFront({ expr: 'determined', mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['letter', 0.6], ...head(31, -1, -0.35, 0.3) }, { yaw: 0.1 });
      std('driver', OUTFITS.driver, { expr: 'smug', mode: 'stand', blink: blinkAt(f, 41), seed: 41, ...head(41, 1, 0.3, 0.05) }, -2.6, 4.1, { y: PLATFORM.top, ground: PLATFORM.top, yaw: -0.2 });
      break;
    }
    case 'l04': {
      const DS = SPEAK.at(f);
      std('driver', OUTFITS.driver, { mode: 'stand', speaker: 1, deform: driverDeform(f), blink: blinkAt(f, 41), seed: 41, look: 0.25,
        expr: 'smug', exprP: SPK.applySpeak({ ...faceP2('smug'), cheek: 0.55 + 0.3 * Math.abs(DS.nod || 0) }, DS), headTilt: q(DS.nod || 0, 2), clothShade: true }, -1.2, 3.4, { y: PLATFORM.top, ground: PLATFORM.top, yaw: 0.3 });
      std('ramu', OUTFITS.ramu, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 31), seed: 31, ...head(31, 0, -0.4, 0.02) }, R.x, R.z, { y: R.y, ground: R.ground, yaw: -0.45 });
      break;
    }
    case 'l05': {
      const G = strapGrip(f);
      ramuFront({ expr: 'smile', mode: 'stand', squash: q(G.squash, 2), blink: blinkAt(f, 31), seed: 31, prop: f >= B('l05') + 52 ? ['point', q(0.3 + 0.5 * G.k, 2)] : ['letter', 0.35], ...head(31, -1, 0.1, 0.05) }, { yaw: 0.1 });
      std('driver', OUTFITS.driver, { expr: 'laugh', exprP: (() => { const P2 = T.faceP('laugh', 41); P2.cheek = 0.85; return P2; })(), mode: 'stand', deform: laughDeform(f), blink: blinkAt(f, 41), seed: 41, headTilt: q(-3 + 1.6 * Math.sin(f * 0.55), 1), look: q(0.3, 2), lookY: q(0.05, 2) }, -1.5, 3.4, { y: PLATFORM.top, ground: PLATFORM.top, yaw: 0.3 });
      std('villager1', OUTFITS.villager1, { expr: 'laugh', mode: 'stand', deform: laughDeform(f), blink: blinkAt(f, 51), seed: 51, ...head(51, -2, 0.2, 0.05) }, -2.05, 4.6, { y: PLATFORM.top, ground: PLATFORM.top, yaw: -0.2 });
      std('villager2', OUTFITS.villager2, { expr: 'laugh', mode: 'stand', deform: laughDeform(f), blink: blinkAt(f, 52), seed: 52, ...head(52, -2, -0.2, 0.05) }, 2.35, 4.7, { y: PLATFORM.top, ground: PLATFORM.top, yaw: 0.25 });
      break;
    }
    case 'l06': ramuSide({ expr: 'determined', mode: 'march', phase: sidePhase(5.9), blink: blinkAt(f, 31), seed: 31 }); break;
    case 'l07': ramuSide({ expr: 'determined', mode: 'march', phase: sidePhase(7.6), blink: blinkAt(f, 31), seed: 31 }); break;
    case 'l08': ramuSide({ expr: 'determined', mode: 'run', phase: sidePhase(9.0), deform: ramuRunDeform(f), blink: blinkAt(f, 31), seed: 31 }); break;
    case 'l09': {
      ramuSide({ expr: 'determined', mode: 'run', phase: sidePhase(2.1), deform: ramuRunDeform(f), blink: blinkAt(f, 31), seed: 31 });
      std('driver', OUTFITS.driver, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 41), seed: 41, wave: q(0.6 + 0.4 * Math.sin(f * 0.45), 2), ...head(41, 0, 0, 0.05) }, trainXAt(f) - 1.95, TRACK_B_Z - 1.5, { y: 0.95, ground: 0, blob: false, yaw: 0 });
      break;
    }
    case 'l10': {
      std('driver', OUTFITS.driver, { expr: 'angry', mode: 'stand', blink: blinkAt(f, 41), seed: 41, ...head(41, 1, 0.2, -0.1) }, trainXAt(f) - 1.95, TRACK_B_Z - 1.5, { y: 0.95, ground: 0, blob: false, yaw: 0 });
      break;
    }
    case 'l11': ramuSide({ expr: 'determined', mode: 'run', phase: sidePhase(9.0), deform: ramuFieldDeform(f), squash: q((R.jump ? R.jump.squash : 0), 2), blink: blinkAt(f, 31), seed: 31 }); break;
    case 'l12': {
      const handOff = f >= B('l12') + 42;
      ramuFront({ expr: 'smile', mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: handOff ? null : ['letter', 0.72], ...head(31, -1, 0.3, -0.05) }, { yaw: 0.25 });
      std('boy', OUTFITS.boy, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 61), seed: 61, prop: handOff ? ['letter', 0.5] : null, ...head(61, -1, -0.3, 0.1) }, 1.95, 46.8, { yaw: -0.25 });
      break;
    }
    case 'l13': {
      std('boy', OUTFITS.boy, { expr: 'wonder', exprP: boyEmo.at(f), mode: 'stand', blink: blinkAt(f, 61), seed: 61, prop: ['letter', 0.5], ...head(61, -1, 0, 0.08) }, 1.9, 46.8, { yaw: -0.1 });
      ramuFront({ expr: 'smile', mode: 'stand', blink: blinkAt(f, 31), seed: 31, ...head(31, -1, -0.3, 0.05) }, { yaw: -0.3 });
      std('driver', OUTFITS.driver, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 41), seed: 41, ...head(41, 0, -0.2, 0.05) }, 5.6, 44.6, { yaw: 0.3 });
      break;
    }
    case 'l14': {
      const capOff = f >= B('l14') + 52;
      std('driver', capOff ? OUTFITS.driverBare : OUTFITS.driver, { expr: 'sad', exprP: driverEmo14.at(f), mode: 'stand', blink: blinkAt(f, 41), seed: 41, prop: capOff ? 'shako' : null, ...head(41, 2, -0.25, -0.15) }, 3.4, 45.8, { yaw: 0.25 });
      ramuFront({ expr: 'neutral', mode: 'stand', blink: blinkAt(f, 31), seed: 31, ...head(31, 0, 0.35, 0.02) }, { yaw: 0.4 });
      std('boy', OUTFITS.boy, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 61), seed: 61, prop: ['letter', 0.5], ...head(61, 0, -0.2, 0.05) }, 1.95, 46.9, { yaw: -0.2 });
      break;
    }
    case 'l15': {
      const DS = SPEAK.at(f), DG = ramuGesture(f);
      ramuFront({ mode: 'stand', speaker: 1, deform: ramuSpeakDeform(f), blink: blinkAt(f, 31), seed: 31, look: 0.25,
        prop: DG.on ? ['point', q(DG.k, 2)] : null,
        expr: 'smile', exprP: SPK.applySpeak({ ...faceP2('smile'), cheek: 0.55 + 0.3 * Math.abs(DS.nod || 0) }, DS), headTilt: q(DS.nod || 0, 2), clothShade: true }, { yaw: 0.3 });
      std('driver', OUTFITS.driverBare, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 41), seed: 41, ...head(41, 0, -0.3, 0.02) }, 3.3, 46.3, { yaw: -0.35 });
      std('boy', OUTFITS.boy, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 61), seed: 61, prop: ['letter', 0.5], ...head(61, 0, -0.15, 0.05) }, 2.0, 47.4, { yaw: -0.15 });
      break;
    }
    case 'l16': {
      ramuFront({ expr: 'smile', mode: 'stand', blink: blinkAt(f, 31), seed: 31, ...head(31, -1, 0.1, 0.1) }, { yaw: 0.1 });
      std('boy', OUTFITS.boy, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 61), seed: 61, prop: ['letter', 0.5], ...head(61, 0, -0.2, 0.08) }, 1.95, 46.9, { yaw: -0.2 });
      std('driver', OUTFITS.driverBare, { expr: 'relief', mode: 'stand', blink: blinkAt(f, 41), seed: 41, ...head(41, 0, -0.25, 0.05) }, 3.4, 46.4, { yaw: -0.3 });
      std('villager3', OUTFITS.villager3, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 53), seed: 53, ...head(53, -1, 0.2, 0.05) }, -1.6, 47.2, { yaw: 0.2 });
      break;
    }
    case 'l17': {
      std('ramu', OUTFITS.ramu, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.78], ...head(31, -2, -0.25, 0.4) }, 2.3, 56.8, { yaw: -0.1 });
      break;
    }
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity ----------
export const STATICS = [
  SOL.obb(BOARD_POS[0] - 2.1, BOARD_POS[2], 0, 0.09, 0.09, { h: 3.3, id: 'boardpost' }),
  SOL.obb(BOARD_POS[0] + 2.1, BOARD_POS[2], 0, 0.09, 0.09, { h: 3.3, id: 'boardpost' }),
  SOL.circle(7, 50, 1.6, { h: 13, id: 'clocktower' }),
];
export const WORLD = SOL.makeWorld(STATICS);
export const dynamicsAt = (f) => castAt(f).map((a) => SOL.circle(a.x, a.z, a.r, { kind: 'dynamic', id: a.id }));
export const groundItemsAt = (f) => castAt(f).map((a) => ({ id: a.id, y: a.y, ground: a.ground ?? 0, maxHover: 0.06 }));
