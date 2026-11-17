// Shot plan for "The Shepherd Who Counted a Thousand Sheep Without
// Counting" — shepherd (SALTED MINE V3 style: painted world, round-white-
// head cards, word-by-word captions, body.js actions, speak.js dialogue
// performance). Batch 9 E4 (Mirror Trick Tales). ONE set: a hillside
// pasture — a dirt path runs down through a narrow pass (two boulders +
// a split wooden gate), the shepherd's sitting-rock beside the gate, a
// hiding bush, a fenced pen on the lower pasture, the hook board beyond.
// The gate lets exactly FOUR sheep through per swing; the shepherd taps
// his notched stick once per swing and multiplies (250 x 4 = 1000).
// Voice stem: 61.891 s, 30 fps, TOTAL 1857; timings from faster-whisper
// small full-file decode (words.json / timing.json, match 0.965). Scene
// changes ONLY at clause (script-line) boundaries:
//   L1  open      Every spring... a thousand sheep, never counted one.
//   L2  announce  At the bottom he announced the exact number.
//   L3  merchants The merchants swore a spirit in his crook whispered.
//   L4  rivals    Rival shepherds followed him for years — never came.
//   L5  sit       He sat on a rock, chewing grass, tapping his stick.
//   L6  hide      One autumn a young merchant hid in the bushes.
//   L7  drone     He saw the flock pour through the narrow gap.
//   L8  gate      The stick tapped once for every swing of the gate.
//   L9  gold      That night the merchant offered gold; he laughed.
//   L10 stick     He held up his notched stick and gave the answer.
//   L11 dialogue  "I never count sheep, friends. I count gates."
//   L12 split     The gate was split so exactly four sheep squeeze.
//   L13 tally     250 gate-swings meant 1000 sheep — multiplication.
//   L14 last      The last swing carried only two; he adjusted.
//   L15 hook      But tomorrow… the man who won every bet he ever made?
// GRADE (FILTER_VFX_LIGHTING pack): Sunny Pop — bright hill daylight, one
// sun direction, contact shadows; the gold/stick/dialogue beats warm into
// a golden dusk of the same family. Boards/text NEVER graded. Grade
// changes ONLY on clause boundaries.
import { M, blinkAt, q, clamp, lerp, ramp, kf } from './motion.js';
import { buildRig, keysCam } from './camrig.js';
import { poseWindows, winkTrack } from './body.js';
import * as SOL from './solid.js';
import * as T from './toon.js';
import * as SPK from './speak.js';
import { SPEAK_DATA } from './speakdata.js';

// ---------- v4 dialogue performance ----------
const SPEAK = SPK.makeSpeakPlayer(SPEAK_DATA);
const speakFace = (baseName, f) => {
  const s = SPEAK.at(f);
  return { expr: 'smile', exprP: SPK.applySpeak({ ...T.faceP(baseName), cheek: 0.5 }, s), headTilt: q(s.nod || 0, 2), clothShade: true };
};

export const FPS = 30, TOTAL = 1857, DECK = 0;
// Shot boundaries (frames) — snapped to timing.json phrase starts.
export const BND = [0, 145, 282, 405, 553, 663, 773, 904, 1054, 1183, 1265, 1354, 1525, 1645, 1763, 1857];
const IDS = ['open', 'announce', 'merchants', 'rivals', 'sit', 'hide', 'drone', 'gate', 'gold', 'stick', 'dialogue', 'split', 'tally', 'last', 'hook'];
export const SHOTS = IDS.map((id, i) => ({ id, a: BND[i], b: BND[i + 1] - 1, light: 'day' }));
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
const F = (id) => SHOTS.find((s) => s.id === id);
const B = (id) => F(id).a, E = (id) => F(id).b;

// ---------- lights / mood grades (Sunny Pop family) ----------
export const LIGHTS = {
  day: { az: 128, el: 52, sky: '#bfe0f2', ground: '#6f9450', hemi: 0.95, sun: '#fff1d6', sunI: 1.55, fog: '#d7ecf7', fogNear: 55, fogFar: 300,
    skyTop: '#2f7fd0', skyHor: '#cfeaf8', sunDisc: '#fff6da', sunSize: 0.0045, sat: 1.12, vig: 0.16, shadowExt: 34, aurora: 0, gain: '#ffffff',
    waterDeep: '#1d4e5f', waterShal: '#3f88a0', glint: '#fff3c8' },
  dusk: { az: 115, el: 24, sky: '#f2c184', ground: '#5d5a3a', hemi: 0.8, sun: '#ffb45e', sunI: 1.35, fog: '#f0cf9e', fogNear: 50, fogFar: 280,
    skyTop: '#4a6aa8', skyHor: '#f7c98a', sunDisc: '#ffdfae', sunSize: 0.006, sat: 1.1, vig: 0.22, shadowExt: 34, aurora: 0, gain: '#ffe9c4',
    waterDeep: '#274b5c', waterShal: '#4a7d8c', glint: '#ffe9c0' },
};
const hexLerp = (a, b, t) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(lerp(v, pb[i], t)).toString(16).padStart(2, '0')).join('');
};
const blendLight = (A, B2, t) => {
  const o = {};
  for (const k of Object.keys(A)) o[k] = typeof A[k] === 'number' ? lerp(A[k], B2[k], t) : hexLerp(A[k], B2[k], t);
  return o;
};
export const lightFor = (S, f) => {
  if (S.id === 'gold') return blendLight(LIGHTS.day, LIGHTS.dusk, smooth(ramp(f, B('gold'), B('gold') + 55)));
  if (S.id === 'stick' || S.id === 'dialogue') return { ...LIGHTS.dusk };
  if (S.id === 'split') return blendLight(LIGHTS.dusk, LIGHTS.day, smooth(ramp(f, B('split'), B('split') + 55)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging (shared by story, main, colliders) ----------
export const BOARD_POS = [0, 3.0, 16];
export const ROCK = { x: 2.9, z: 1.7, h: 0.45 };          // the shepherd's sitting rock
export const BUSH = { x: -3.3, z: 4.3 };                  // the merchant's hiding bush
export const STICK3D = { x: 2.32, z: 2.18 };              // the notched tally stick (insert)
export const LANES = [-0.75, -0.25, 0.25, 0.75];          // exactly four sheep abreast

// ---------- the gate + the count (the plot's engine) ----------
// Crossing times (seconds from each shot's start) when a group of four
// passes z=0. The gate swings for each crossing; the stick taps with it.
export const CROSS = { open: [1.3, 3.7], drone: [0.7, 2.7, 4.7], gate: [1.1, 3.5], split: [1.3, 3.9], tally: [0.6, 2.3], last: [2.0] };
export const gateAt = (f) => {
  const S = shotAt(f), cs = CROSS[S.id] || [];
  let open = 0, tap = 0;
  for (const tc of cs) {
    const Fc = S.a + tc * 30;
    open = Math.max(open, smooth(ramp(f, Fc - 16, Fc - 2)) * (1 - smooth(ramp(f, Fc + 5, Fc + 19))));
    const d = (f - (Fc - 2)) / 5;
    tap = Math.max(tap, Math.exp(-d * d));
  }
  return { open, tap };
};
// the shepherd's tap pulse: synced to the gate in flow shots, a lazy
// rhythm while he sits chewing grass in the 'sit' beat.
export const tapAt = (f) => {
  const S = shotAt(f);
  if (S.id === 'sit') {
    const ph = (f - S.a) % 27;
    const d = (ph - 5) / 3.5;
    return Math.exp(-d * d);
  }
  return gateAt(f).tap;
};

// ---------- the flock ----------
const SPEED = 1.5, STRIDE = 0.55;
const dipK = (f, seed) => clamp(Math.sin(f * 0.017 + seed * 2.9) * 2.4 - 1.2, 0, 1);
const sheepScale = (seed) => 0.85 + ((seed * 31) % 13) / 100;
function flowSheep(f, a, crossings, { lanes = LANES, size = 4 } = {}) {
  const t = f / 30, out = [];
  crossings.forEach((tc, g) => {
    const crossT = a / 30 + tc;
    for (let li = 0; li < size; li++) {
      const lane = lanes[li % lanes.length];
      const seed = g * 7 + li * 3 + 1;
      const qz = -(3.2 + g * 3.6) - li * 0.18;
      const walkStart = crossT + qz / SPEED;
      const scatterX = lane * (1.6 + 0.35 * ((seed * 37) % 3)) + ((seed * 53) % 5 - 2) * 0.22;
      const zEnd = 8.5 + ((seed * 29) % 40) / 10;
      let x = lane, z, walk = 0, phase = 0;
      if (t < walkStart) z = qz;
      else {
        const d = SPEED * (t - walkStart);
        z = qz + d; phase = d / STRIDE;
        if (z > 5.5) x = lerp(lane, scatterX, clamp((z - 5.5) / 3));
        if (z >= zEnd) { z = zEnd; x = scatterX; phase = Math.round(phase * 2) / 2; }  // stop on a neutral stride point — no leg snap
        else walk = 1;
      }
      out.push({ x, z, yaw: 0, walk, phase, seed, dip: walk ? 0 : dipK(f, seed), s: sheepScale(seed) });
    }
  });
  return out;
}
function grazers(f, list) {
  return list.map(([x, z, seed]) => ({
    x: x + 0.22 * Math.sin(f * 0.009 + seed * 3.1), z: z + 0.18 * Math.cos(f * 0.007 + seed * 2.3),
    yaw: 0.5 * Math.sin(f * 0.005 + seed * 4.0), walk: 0, phase: 0, seed,
    dip: dipK(f, seed), s: sheepScale(seed),
  }));
}
// the 5th sheep in the 'split' beat: hurries to the gate beside the second
// group, finds no room, shakes its head and steps back — never five.
function extraSheep(f) {
  const a = B('split'), t = (f - a) / 30, seed = 41;
  let z, walk = 0, phase = 0, yaw = 0;
  if (t < 2.2) z = -4.6;
  else if (t < 3.1) { const d = SPEED * (t - 2.2); z = -4.6 + d; phase = d / STRIDE; walk = 1; }
  else if (t < 4.3) { z = -3.25; yaw = 0.35 * Math.sin((f - a - 93) * 0.55) * Math.exp(-Math.max(0, f - a - 93) / 40); }
  else if (t < 5.0) { const d = SPEED * 0.7 * (t - 4.3); z = -3.25 - d; phase = d / STRIDE; walk = 1; yaw = 0.5; }
  else z = -4.2;
  return { x: -1.62, z, yaw, walk, phase, seed, dip: 0, s: sheepScale(seed) };
}
export const sheepAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'open': return [...flowSheep(f, S.a, CROSS.open),
      ...grazers(f, [[-4.5, -15, 11], [-2, -18, 12], [1.5, -16, 13], [4.5, -19, 14], [-5.5, -21, 15], [3, -22, 16]]),
      ...grazers(f, [[-3.5, 10, 17], [4.2, 11.5, 18], [-5, 13, 19]])];
    case 'announce': return grazers(f, [[-4.5, 11, 21], [-2.5, 13, 22], [0, 12, 23], [2.8, 13.5, 24], [4.8, 11.5, 25], [-5.2, 15, 26], [-1.5, 16.5, 27], [1.8, 17, 28], [4, 15.5, 29], [-3.8, 18.5, 30], [0.5, 19.5, 31], [5.4, 18, 32]]);
    case 'merchants': return [...grazers(f, [[-4, 10, 33], [3.5, 12, 34], [-1, 14, 35], [5, 15, 36], [-5, 16.5, 37], [1.5, 17.5, 38]]),
      ...grazers(f, [[-3, -12, 39], [2, -14, 40], [-4.5, -17, 41], [4, -18, 42]])];
    case 'rivals': return grazers(f, [[-2, -12, 43], [1, -13.5, 44], [-4.5, -15, 45], [3.5, -16, 46], [0, -18, 47], [-3, -19.5, 48], [5, -20, 49], [-5.5, -22, 50], [2, -23, 51], [-1, -25, 52], [4.5, -26, 53], [-4, -27, 54]]);
    case 'sit': return [...grazers(f, [[-3, -7, 55], [2.5, -9, 56], [-4.5, -11, 57], [0.5, -13, 58]]),
      ...grazers(f, [[-3.5, 8.5, 59], [4.5, 9.5, 60]])];
    case 'hide': return grazers(f, [[-2, -9, 61], [1.5, -11, 62], [-4, -13, 63], [3.5, -15, 64], [0, -17, 65]]);
    case 'drone': return [...flowSheep(f, S.a, CROSS.drone),
      ...grazers(f, [[-4, 9, 66], [4.5, 10, 67], [-5.5, 12, 68], [2, 13.5, 69], [-2.5, 15, 70], [5.5, 16, 71]])];
    case 'gate': return [...flowSheep(f, S.a, CROSS.gate),
      ...grazers(f, [[-4, 9.5, 72], [4.5, 11, 73]])];
    case 'gold': return grazers(f, [[-4.5, 11, 74], [3.8, 12.5, 75], [0.5, 15, 76]]);
    case 'stick': return grazers(f, [[-3, -8, 77], [3.5, -10, 78]]);
    case 'dialogue': return grazers(f, [[-4, 10, 79], [4.2, 11.5, 80]]);
    case 'split': return [...flowSheep(f, S.a, CROSS.split), extraSheep(f),
      ...grazers(f, [[-0.75, -6.8, 81], [-0.25, -7.1, 82], [0.25, -6.9, 83], [0.75, -7.2, 84]])];
    case 'tally': return [...flowSheep(f, S.a, CROSS.tally),
      ...grazers(f, [[-4.5, 9, 85], [-2, 10.5, 86], [1, 9.5, 87], [4, 11, 88], [-5.5, 13, 89], [-1, 14.5, 90], [2.5, 15.5, 91], [5.2, 14, 92], [-3.5, 17, 93], [0.5, 18, 94]]),
      ...grazers(f, [[-0.75, -6.8, 95], [-0.25, -7.1, 96], [0.25, -6.9, 97], [0.75, -7.2, 98]])];
    case 'last': return [...flowSheep(f, S.a, CROSS.last, { lanes: [LANES[1], LANES[2]], size: 2 }),
      ...grazers(f, [[-4.5, 9.5, 99], [-2, 11, 100], [1.5, 10, 101], [4.2, 12, 102], [-5.2, 14, 103], [-0.5, 15.5, 104], [3, 16.5, 105], [5.4, 18, 106]])];
    case 'hook': return grazers(f, [[-5.6, 12.5, 107], [5.8, 13.5, 108], [-6.2, 19, 109]]);
    default: return [];
  }
};

// ---------- body.js performance tracks ----------
const merchantPose = poseWindows([{ a: 663 + 10, b: 772, mode: 'kneel', inF: 10, outF: 4 }]);
const shepherdWink = winkTrack([{ a: 1645 + 88, b: 1645 + 103 }]);
const micro = (f, seed) => 1.1 * Math.sin((f + seed * 5) * 0.037 + 1);
const head = (f, seed, tilt, look, lookY, facing = 0, squash = 0) => ({
  headTilt: q(tilt + micro(f, seed), 1), look: q(look, 2), lookY: q(lookY, 2), facing: q(facing, 2), squash: q(squash, 2),
});

// ---------- hero / focus ----------
const FOCUS = {
  open: () => [ROCK.x, 1.9, ROCK.z],
  announce: () => [0.8, 1.4, 8.2],
  merchants: () => [-1.35, 1.3, 4.6],
  rivals: () => [-2.05, 1.2, -7.4],
  sit: () => [ROCK.x, 1.25, ROCK.z],
  hide: () => [-2.0, 1.0, 4.7],
  drone: () => [0, 0.5, -4],
  gate: () => [0, 0.8, 0],
  gold: () => [0.3, 1.4, 7.7],
  stick: () => [STICK3D.x, 1.15, STICK3D.z],
  dialogue: () => [1.3, 1.5, 3.0],
  split: () => [0, 0.7, 0],
  tally: () => [0, 0.5, -3],
  last: () => [1.4, 1.0, 0.9],
  hook: () => BOARD_POS,
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id]();

// ---------- cameras: EVERY shot is a camrig track on a subject ----------
const RIG_BY_ID = {
  open: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('open'), pos: [4.55, 1.75, 6.6], look: [0.75, 1.05, -1.0], fov: 42 },
    { f: E('open'), pos: [4.3, 1.68, 6.2], look: [0.8, 1.08, -0.9], fov: 38, ease: 'io' }] }) },
  announce: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('announce'), pos: [2.6, 1.7, 14.5], look: [0.6, 1.25, 8.6], fov: 38 },
    { f: E('announce'), pos: [2.4, 1.65, 14.0], look: [0.65, 1.28, 8.5], fov: 34, ease: 'io' }] }) },
  merchants: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('merchants'), pos: [-2.9, 1.6, 10.2], look: [-0.35, 1.2, 4.2], fov: 40 },
    { f: E('merchants'), pos: [-2.75, 1.58, 9.9], look: [-0.32, 1.22, 4.15], fov: 36, ease: 'io' }] }) },
  rivals: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('rivals'), pos: [0.3, 1.7, 3.4], look: [-0.2, 1.05, -7.6], fov: 44 },
    { f: E('rivals'), pos: [0.22, 1.68, 3.1], look: [-0.18, 1.07, -7.5], fov: 40, ease: 'io' }] }) },
  sit: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('sit'), pos: [4.7, 1.45, 5.4], look: [2.85, 1.35, 1.7], fov: 36 },
    { f: E('sit'), pos: [4.5, 1.42, 5.15], look: [2.87, 1.36, 1.7], fov: 33, ease: 'io' }] }) },
  hide: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('hide'), pos: [-5.4, 1.5, 9.8], look: [-2.5, 0.95, 4.5], fov: 38 },
    { f: E('hide'), pos: [-5.2, 1.48, 9.5], look: [-2.45, 0.97, 4.45], fov: 34, ease: 'io' }] }) },
  drone: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('drone'), pos: [8.5, 14.5, 12.5], look: [0, 0, -6.5], fov: 46 },
    { f: E('drone'), pos: [8.1, 14.1, 12.1], look: [0.1, 0.05, -6.3], fov: 43, ease: 'io' }] }) },
  gate: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('gate'), pos: [5.2, 1.55, 8.2], look: [1.3, 0.95, 0.4], fov: 40 },
    { f: E('gate'), pos: [5.0, 1.52, 7.9], look: [1.32, 0.97, 0.4], fov: 37, ease: 'io' }] }) },
  gold: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('gold'), pos: [2.2, 1.6, 13.6], look: [-0.3, 1.25, 8.0], fov: 38 },
    { f: E('gold'), pos: [2.05, 1.58, 13.2], look: [-0.27, 1.27, 7.95], fov: 34, ease: 'io' }] }) },
  stick: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('stick'), pos: [5.1, 1.6, 6.3], look: [2.55, 1.02, 2.0], fov: 34 },
    { f: E('stick'), pos: [4.85, 1.56, 6.0], look: [2.52, 1.05, 2.02], fov: 30, ease: 'io' }] }) },
  dialogue: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('dialogue'), pos: [2.5, 1.62, 6.6], look: [1.32, 1.45, 3.02], fov: 30 },
    { f: E('dialogue'), pos: [2.38, 1.6, 6.35], look: [1.33, 1.46, 3.01], fov: 27, ease: 'io' }] }) },
  split: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('split'), pos: [0.3, 1.0, 6.4], look: [0, 0.8, -0.5], fov: 40 },
    { f: E('split'), pos: [0.28, 0.97, 6.1], look: [0, 0.82, -0.45], fov: 37, ease: 'io' }] }) },
  tally: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('tally'), pos: [-9.2, 14.8, 14.3], look: [0.4, 0, -4.2], fov: 49 },
    { f: E('tally'), pos: [-8.8, 14.4, 13.9], look: [0.45, 0.05, -4.0], fov: 46, ease: 'io' }] }) },
  last: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('last'), pos: [5.2, 1.55, 8.2], look: [1.3, 0.95, 0.4], fov: 40 },
    { f: E('last'), pos: [5.0, 1.52, 7.9], look: [1.32, 0.97, 0.4], fov: 37, ease: 'io' }] }) },
  hook: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('hook'), pos: [4.8, 3.7, 29.8], look: [0, 2.95, 16], fov: 39 },
    { f: E('hook'), pos: [4.6, 3.66, 29.3], look: [0.02, 2.96, 16], fov: 37, ease: 'io' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: B('gold') + 62, a: 0.03 }],
  sigma: 3.2, smoothRadius: 10, fovSigma: 1.6,
});
export const camAt = (f) => RIG.camAt(f);
export const RIG_META = {
  kicks: RIG.declared.kicks, hardCuts: RIG.declared.hardCuts,
  blends: SHOTS.filter((s) => RIG_BY_ID[s.id].cut === 'blend').map((s) => ({ a: s.a - Math.floor(RIG_BY_ID[s.id].blend / 2), b: s.a + Math.ceil(RIG_BY_ID[s.id].blend / 2) })),
  whips: RIG.declared.whips,
  samples: RIG.samples,
};
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), hp = heroPosAt(f);
  let cinf = 2.0;
  if (['drone', 'tally', 'rivals', 'announce'].includes(S.id)) cinf = 1.2;
  if (['sit', 'dialogue', 'stick', 'gate'].includes(S.id)) cinf = 3.4;
  if (S.id === 'hook') cinf = 2.6;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { boardHook: 0, dustK: 0.05 };
  if (S.id === 'hook') W.boardHook = f < B('hook') + 20 ? smooth(ramp(f, B('hook') + 2, B('hook') + 20)) : 1;  // held at FULL opacity to the literal last frame
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  const dusk = ['gold', 'stick', 'dialogue'].includes(S.id);
  return {
    moteRate: dusk ? 0.3 : 0.55,       // pollen / dust drifting in the sunlight
    sprayRate: 0,
    smokeRate: 0.03, dustRate: 0.05,
  };
};
export const fxAt = () => [];

// ---------- cast (single source for actors AND colliders) ----------
const TINT = { day: '#ffffff', dusk: '#ffe9c9' };
const tintFor = (S) => ['gold', 'stick', 'dialogue'].includes(S.id) ? TINT.dusk : TINT.day;
export const OUTFITS = {
  shepherd: { jacket: '#5d6a35', pants: '#4a3a28', boots: '#2e2015', hat: 'cap', cap: '#7a4a26', skin: '#fbf7ef' },
  merchant: { jacket: '#7a3a4a', pants: '#33302c', boots: '#201812', hat: 'hair', hair: '#241a12', skin: '#fbf7ef' },
  merchantA: { jacket: '#4a3b63', pants: '#2c3038', boots: '#1c1712', hat: 'bowler', hatCol: '#2e2a26', skin: '#fbf7ef' },
  merchantB: { jacket: '#6b543a', pants: '#33302c', boots: '#201812', hat: 'cap', cap: '#44586b', skin: '#fbf7ef' },
  rival1: { jacket: '#55604f', pants: '#3a3428', boots: '#2a1e12', hat: 'cap', cap: '#5a4632', skin: '#fbf7ef' },
  rival2: { jacket: '#4f5a66', pants: '#33302c', boots: '#1c1712', hat: 'cap', cap: '#3d3d3d', skin: '#fbf7ef' },
};
// the tally stick overlay for the SEATED shepherd (sit mode draws no
// prop): a short notched stick in card space, its tip tapping his boot.
const drawTapStick = (p, tapK) => {
  const bx = 428 - tapK * 15, by = 962 - tapK * 7;
  p.band([[458, 898], [444, 928], [bx, by]], '#8a5a34', 7, 2, 'round');
  p.band([[452, 912], [446, 920]], '#5d3c1e', 7.5, 0, 'round');
  p.dot(458, 896, 6);
};
export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, z, extra = {}) => out.push({ id, x, y: extra.y ?? 0, z, r: 0.32, ground: extra.ground ?? 0,
    actor: (T) => {
      const { stk, ...actorExtra } = extra;
      return { key: 'shx' + JSON.stringify(o) + JSON.stringify(opts) + (extra.y ?? 0) + (stk !== undefined ? '|stk' + stk : ''),
        draw: (p) => { T.bodyFront(p, o, opts); if (stk !== undefined) drawTapStick(p, stk); },
        x, y: extra.y ?? 0, z, ground: extra.ground ?? 0, tint, ...actorExtra };
    } });
  const tapK = tapAt(f);
  const shepherdSeated = (opts, extra = {}) => std('shepherd', OUTFITS.shepherd, { mode: 'sit', ...opts }, ROCK.x, ROCK.z, { y: ROCK.h, ground: ROCK.h, stk: q(tapK, 1), ...extra });
  switch (S.id) {
    case 'open': {
      // OPENS mid-action: seated on his rock, stick tapping with the gate
      // swings, gaze following the flock pouring through the pass.
      shepherdSeated({ expr: 'smile', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, -1.5 - 1.2 * tapK, -0.3, 0.12, 0.1) }, { yaw: -0.3 });
      break;
    }
    case 'announce': {
      std('shepherd', OUTFITS.shepherd, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.7],
        ...head(f, 31, -1, 0.1, 0.05, 0.1) }, 0.8, 8.2, { yaw: 0.15 });
      break;
    }
    case 'merchants': {
      std('merchantA', OUTFITS.merchantA, { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 61), seed: 61, prop: ['point', 0.55],
        ...head(f, 61, 0, 0.4, 0.05, 0.3) }, -1.35, 4.6, { yaw: 0.4 });
      std('merchantB', OUTFITS.merchantB, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 62), seed: 62,
        ...head(f, 62, -1, 0.35, 0.1, 0.25) }, -0.35, 5.15, { yaw: 0.35 });
      std('shepherd', OUTFITS.shepherd, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, -1, -0.3, 0.05, -0.2) }, 1.35, 2.5, { yaw: -0.35 });
      break;
    }
    case 'rivals': {
      std('rival1', OUTFITS.rival1, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, -2, kf([[405, 0.1], [470, 0.45], [552, 0.2]], f), 0.18, 0.1) }, -2.05, -7.4, { yaw: 0.25 });
      std('rival2', OUTFITS.rival2, { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 72), seed: 72,
        ...head(f, 72, -1.5, kf([[405, -0.2], [490, 0.15], [552, -0.1]], f), 0.15, -0.05) }, 1.9, -8.3, { yaw: -0.2 });
      break;
    }
    case 'sit': {
      // THE sit beat: close on the rock — chewing grass, stick tapping
      // his boot in a lazy rhythm, eyes half on the flock.
      shepherdSeated({ expr: 'smile_closed', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, 1.5 - 1.4 * tapK, -0.15, 0.28, 0.05) }, { yaw: -0.2 });
      break;
    }
    case 'hide': {
      const MP = merchantPose(f);
      std('merchant', OUTFITS.merchant, { expr: 'stern', mode: MP.mode, squash: MP.squash, blink: blinkAt(f, 81), seed: 81,
        ...head(f, 81, 0.5, kf([[663, 0.05], [715, 0.42], [772, 0.42]], f), 0.12, 0.15) }, -2.0, 4.7, { yaw: 0.3 });
      break;
    }
    case 'drone': {
      shepherdSeated({ expr: 'smile', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, -1 - 1.2 * tapK, -0.3, 0.1, 0.1) }, { yaw: -0.3 });
      break;
    }
    case 'gate': {
      // the tap and the swing are ONE event: stick falls as each group
      // of four squeezes through.
      shepherdSeated({ expr: 'smile', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, -1 - 1.4 * tapK, -0.35, 0.08, 0.1) }, { yaw: -0.35 });
      break;
    }
    case 'gold': {
      std('merchant', OUTFITS.merchant, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 81), seed: 81, prop: ['coin', 0.6],
        ...head(f, 81, -0.5, 0.3, 0.05, 0.25) }, -0.9, 8.35, { yaw: 0.45 });
      std('shepherd', OUTFITS.shepherd, { expr: 'laugh', mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, -3, -0.3, 0.05, -0.2) }, 0.3, 7.7, { yaw: -0.45 });
      break;
    }
    case 'stick': {
      // the insert beat: the shepherd rests by his rock, gaze on the
      // notched stick (3D insert in the foreground of the shot). No
      // overlay stick here — the 3D stick IS his tally stick.
      std('shepherd', OUTFITS.shepherd, { expr: 'smile', mode: 'sit', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, -1, -0.42, 0.18, -0.1) }, ROCK.x, ROCK.z, { y: ROCK.h, ground: ROCK.h, yaw: -0.25 });
      break;
    }
    case 'dialogue': {
      // THE dialogue beat: a full speaker close-up (V3 grammar — the
      // camera holds on the man talking). The shepherd PERFORMS his
      // line: mouth driven by the stem inside the speak segment, firmly
      // closed outside it. The merchant listens off-camera (heard the
      // offer in 'gold', sees the proof in 'tally').
      std('shepherd', OUTFITS.shepherd, { mode: 'stand', blink: blinkAt(f, 31), seed: 31, look: 0.3, ...speakFace('smile', f) }, 1.3, 3.0, { yaw: 0.3 });
      break;
    }
    case 'split': break;   // the gate and the flock carry this beat
    case 'tally': {
      shepherdSeated({ expr: 'smile', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, -1 - 1.2 * tapK, -0.3, 0.1, 0.1) }, { yaw: -0.3 });
      std('merchant', OUTFITS.merchant, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 81), seed: 81,
        ...head(f, 81, -2, 0.3, 0.2, 0.2) }, 1.1, 3.6, { yaw: 0.35 });
      break;
    }
    case 'last': {
      // the last swing carries only two — he sees it, adjusts, and winks.
      let FP = T.faceP('smile', 31);
      const wk = shepherdWink(f);
      if (wk > 0) FP = T.blendFaceP(FP, T.faceP('wink', 31), wk);
      shepherdSeated({ expr: 'smile', exprP: { ...FP, blush: 0 }, blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, -1 - 1.2 * tapK, -0.25, 0.1, 0.08) }, { yaw: -0.3 });
      break;
    }
    case 'hook': break;   // the board shot — no cast
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity: statics, dynamics, ground (LIBRARY v3 gate data) ----------
export const STATICS = [
  SOL.circle(-1.06, 0, 0.1, { h: 1.25, id: 'gatepost' }),
  SOL.circle(1.06, 0, 0.1, { h: 1.25, id: 'gatepost' }),
  SOL.circle(-2.2, 0, 1.3, { h: 1.6, id: 'boulder' }),
  SOL.circle(2.2, 0, 1.3, { h: 1.6, id: 'boulder' }),
  SOL.circle(BUSH.x, BUSH.z, 0.85, { h: 1.1, id: 'bush' }),
  SOL.circle(BOARD_POS[0] - 2.55, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  SOL.circle(BOARD_POS[0] + 2.55, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
];
export const WORLD = SOL.makeWorld(STATICS);
export const dynamicsAt = (f) => {
  const out = [];
  for (const a of castAt(f)) out.push(SOL.circle(a.x, a.z, a.r, { kind: 'dynamic', id: a.id }));
  return out;
};
export const groundItemsAt = (f) => {
  const items = [];
  for (const a of castAt(f)) items.push({ id: a.id, y: a.y, ground: a.ground ?? 0, maxHover: 0.06 });
  return items;
};
