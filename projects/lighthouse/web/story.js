// Shot plan for "The Lighthouse Keeper Who Never Climbed the Tower" —
// lighthouse (SALTED MINE V3 style: painted world, round-white-head cards,
// word-by-word captions, body.js actions, speak.js dialogue performance).
// Batch 9 E1 (Mirror Trick Tales). ONE set: a lighthouse on a rocky point —
// EXTERIOR (tower, lamp room, sea, ship, board posts) + INTERIOR (hollow
// shaft, spiral stair, ground-floor lamp room, top floor under the lamp
// chamber). The great lamp hangs on a rope from the top beam, counterweighted
// with stones; the keeper lights/trims it at the ground and hauls it up.
// Voice stem: 56.171 s, 30 fps, TOTAL 1685; timings from faster-whisper
// small full-file decode (words.json / timing.json, match 0.990). Scene
// changes ONLY at clause (script-line) boundaries:
//   L1  haul     For thirty years this keeper lit the lamp... never climbed.
//   L2  blaze    Every evening the lamp blazed at the top, ships past rocks.
//   L3  village  The village swore the old man could fly.
//   L4  climb    One wild evening a sea captain climbed the tower himself.
//   L5  search   He searched every step and room, found no living soul.
//   L6  lampcu   Yet above him the lamp was already burning bright.
//   L7  demand   He stormed back down and demanded to know how.
//   L8  laugh    The old keeper just laughed and gave his answer.
//   L9  dialogue "I never climbed the tower, friends. The lamp did the climbing."
//   L10 reveal   The lamp hung from a thick rope, counterweighted with stones.
//   L11 ritual   He lit it at the ground, trimmed the wick, hauled it up.
//   L12 morning  Every morning he lowered it, cleaned, filled, raised it.
//   L13 hook     But tomorrow… the man who sold the same horse seven times?
// GRADE (FILTER_VFX_LIGHTING pack): Night Lamp throughout — deep blue night,
// warm lamp light motivates everything (cone brightest at source, soft
// falloff, dust only inside the beam); the morning beat warms a touch toward
// dawn INSIDE the same family. Grade changes ONLY on clause boundaries.
import { M, blinkAt, q, clamp, lerp, ramp, kf } from './motion.js';
import { buildRig, keysCam } from './camrig.js';
import { poseWindows, turnTrack, gazeTrack, winkTrack } from './body.js';
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

export const FPS = 30, TOTAL = 1685, DECK = 0;
// Shot boundaries (frames) — snapped to timing.json phrase starts.
export const BND = [0, 175, 323, 448, 605, 742, 862, 1000, 1088, 1177, 1325, 1455, 1591, 1685];
const IDS = ['haul', 'blaze', 'village', 'climb', 'search', 'lampcu', 'demand', 'laugh', 'dialogue', 'reveal', 'ritual', 'morning', 'hook'];
export const SHOTS = IDS.map((id, i) => ({ id, a: BND[i], b: BND[i + 1] - 1, light: 'night' }));
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
const F = (id) => SHOTS.find((s) => s.id === id);
const B = (id) => F(id).a, E = (id) => F(id).b;

// ---------- lights / mood grades (Night Lamp family) ----------
export const LIGHTS = {
  night: { az: 205, el: 42, sky: '#33415e', ground: '#1a2029', hemi: 0.62, sun: '#93a9d6', sunI: 0.75, fog: '#131b29', fogNear: 24, fogFar: 200,
    skyTop: '#081120', skyHor: '#263650', sunDisc: '#e6eeff', sunSize: 0.0028, sat: 1.07, vig: 0.3, shadowExt: 26, aurora: 0, gain: '#ffe3ba',
    waterDeep: '#0a2438', waterShal: '#1d4e5f', glint: '#ffe9c0' },
  dawn: { az: 232, el: 26, sky: '#5d6d88', ground: '#272b31', hemi: 0.8, sun: '#d8bd93', sunI: 1.15, fog: '#202a3c', fogNear: 28, fogFar: 230,
    skyTop: '#14233d', skyHor: '#77644c', sunDisc: '#ffdfae', sunSize: 0.0034, sat: 1.04, vig: 0.28, shadowExt: 26, aurora: 0, gain: '#f4e0bc',
    waterDeep: '#0d2c42', waterShal: '#256b78', glint: '#ffe9c0' },
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
  if (S.id === 'morning') return blendLight(LIGHTS.night, LIGHTS.dawn, smooth(ramp(f, B('morning'), B('morning') + 55)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging (shared by story, main, colliders) ----------
export const BOARD_POS = [0, 3.0, 12.5];
export const KEEPER = { x: 1.35, z: 1.05 };        // ground floor, by the rope
export const CAPTAIN_G = { x: -1.15, z: 1.35 };    // ground floor, facing keeper
export const TABLE = { x: -1.7, z: -1.1 };         // keeper's work table (inside the stair ring's 2D clearance)
export const TOPFLOOR_Y = 11.9;
export const CAPTAIN_T = { x: 0.95, z: 0.5 };      // top floor
export const LAMP_REST = 1.05, LAMP_MID = 7.0, LAMP_TOP = 14.0;
export const STAIR_R = 3.7, STAIR_N = 27;
export const stairPos = (stepFloat) => {
  const th = 0.4 + stepFloat * 0.30;
  return { x: STAIR_R * Math.cos(th), z: STAIR_R * Math.sin(th), y: (stepFloat + 0.5) * 0.44, th };
};

// ---------- the lamp's journey (the plot's engine) ----------
export const lampYAt = (f) => {
  const S = shotAt(f).id;
  if (S === 'haul') return lerp(LAMP_REST, LAMP_TOP, smooth(ramp(f, B('haul') + 12, B('haul') + 158)));
  if (S === 'reveal') return LAMP_MID;
  if (S === 'ritual') {
    if (f < B('ritual') + 66) return LAMP_REST;
    return lerp(LAMP_REST, LAMP_TOP, smooth(ramp(f, B('ritual') + 66, E('ritual') - 4)));
  }
  if (S === 'morning') {
    if (f < B('morning') + 48) return lerp(LAMP_TOP, LAMP_REST, smooth(ramp(f, B('morning') + 4, B('morning') + 48)));
    if (f < B('morning') + 96) return LAMP_REST;
    return lerp(LAMP_REST, LAMP_TOP, smooth(ramp(f, B('morning') + 96, E('morning') - 4)));
  }
  return LAMP_TOP;
};
// the flame: lit from the first frame (L1 opens mid-ritual, the lamp is
// already burning), dipped only while the glass is cleaned in the morning
// beat, and ramped up as the wick catches in the ritual beat.
export const lampKAt = (f) => {
  const S = shotAt(f).id;
  if (S === 'morning' && f >= B('morning') + 50 && f < B('morning') + 88) return 0.12;
  if (S === 'ritual' && f < B('ritual') + 14) return lerp(0.25, 1, smooth(ramp(f, B('ritual'), B('ritual') + 14)));
  return 1;
};
// counterweight stones hang opposite the lamp: lamp down = stones up.
export const cwYAt = (f) => clamp(13.2 - (lampYAt(f) - LAMP_REST) * 1.28, 1.6, 13.2);

// ---------- cast staging ----------
export const captainAt = (f) => {
  const S = shotAt(f).id;
  if (S === 'climb') {
    const u = smooth(ramp(f, B('climb') + 4, E('climb') - 6));
    const p = stairPos(lerp(3, 19, u));
    return { x: p.x, z: p.z, y: p.y, ground: p.y, aboard: 1 };
  }
  if (S === 'search' || S === 'lampcu') return { x: CAPTAIN_T.x, z: CAPTAIN_T.z, y: TOPFLOOR_Y, ground: TOPFLOOR_Y, aboard: 1 };
  return { x: CAPTAIN_G.x, z: CAPTAIN_G.z, y: 0, ground: 0, aboard: 0 };
};
export const captainMode = (f) => {
  if (shotAt(f).id === 'climb') return 'march';
  return 'stand';
};

// ---------- body.js performance tracks ----------
// keeper KNEELS at the lamp to light/trim it (ritual) and to clean/fill it
// (morning); the captain TURNS around searching the top room and turns to
// face the keeper when he storms down; the keeper WINKS after his laugh;
// gazes track the lamp (up while it climbs, down at the wick while working).
const keeperPose = poseWindows([
  { a: 1325, b: 1392, mode: 'kneel', inF: 6, outF: 6 },
  { a: 1505, b: 1552, mode: 'kneel', inF: 6, outF: 6 },
]);
const captainTurn = turnTrack([{ f0: 648, dur: 16, dir: 1 }, { f0: 866, dur: 12, dir: -1 }]);
const keeperWink = winkTrack([{ a: 1062, b: 1073 }]);
const keeperGaze = gazeTrack([
  { f: 0, lookY: 0.5, look: 0.1 },
  { f: 1000, lookY: 0.05, look: -0.3 },
  { f: 1177, lookY: 0.55, look: -0.1 },
  { f: 1325, lookY: -0.35, look: 0 },
  { f: 1400, lookY: 0.5, look: 0.05 },
  { f: 1455, lookY: -0.3, look: 0 },
  { f: 1560, lookY: 0.45, look: 0.05 },
]);
const captainGaze = gazeTrack([
  { f: 605, lookY: 0.1, look: 0.3 },
  { f: 742, lookY: 0.62, look: 0 },
  { f: 862, lookY: 0.05, look: 0.35 },
  { f: 1177, lookY: 0.6, look: -0.2 },
]);
const micro = (f, seed) => 1.1 * Math.sin((f + seed * 5) * 0.037 + 1);
const head = (f, seed, tilt, look, lookY, facing = 0, squash = 0) => ({
  headTilt: q(tilt + micro(f, seed), 1), look: q(look, 2), lookY: q(lookY, 2), facing: q(facing, 2), squash: q(squash, 2),
});

// ---------- hero / focus ----------
const FOCUS = {
  haul: () => [KEEPER.x, 1.6, KEEPER.z],
  blaze: () => [0, 12.5, 0],
  village: () => [0, 11, 4],
  climb: () => { const c = captainAt(520); return [c.x, c.y + 1.2, c.z]; },
  search: () => [CAPTAIN_T.x, TOPFLOOR_Y + 1.4, CAPTAIN_T.z],
  lampcu: () => [0, LAMP_TOP, 0],
  demand: () => [CAPTAIN_G.x, 1.35, CAPTAIN_G.z],
  laugh: () => [KEEPER.x, 1.45, KEEPER.z],
  dialogue: () => [KEEPER.x, 1.45, KEEPER.z],
  reveal: () => [0, LAMP_MID, 0],
  ritual: () => [0, 1.1, 0],
  morning: () => [0.4, 1.2, 0.3],
  hook: () => BOARD_POS,
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id]();

// ---------- cameras: EVERY shot is a camrig track on a subject ----------
// the climb TRACKS the captain: keys are sampled from his own stair path,
// the vantage riding ~140 degrees around the shaft and rising with him.
const climbKeys = () => {
  const frames = [0, 20, 39, 59, 78, 98, 117, 137, 156].map((d) => B('climb') + d);
  return frames.map((f, i) => {
    const c = captainAt(f);
    const ang = Math.atan2(c.z, c.x) + 2.45;
    return { f, pos: [Math.cos(ang) * 2.35, c.y + 0.75, Math.sin(ang) * 2.35], look: [c.x, c.y + 1.15, c.z], fov: 42 - i * 0.75, ...(i === frames.length - 1 ? { ease: 'io' } : {}) };
  });
};
// Interior positions stay inside the shaft (r <= 4.0); every hold creeps.
const RIG_BY_ID = {
  haul: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('haul'), pos: [2.6, 1.25, 3.0], look: [0.5, 2.2, 0.2], fov: 39 },
    { f: B('haul') + 80, pos: [2.4, 1.35, 2.8], look: [0.35, 3.0, 0.1], fov: 35 },
    { f: E('haul'), pos: [2.2, 1.6, 2.6], look: [0.25, 4.1, 0], fov: 32, ease: 'io' }] }) },
  blaze: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('blaze'), pos: [14.5, 6.8, 26], look: [0, 10.2, 0], fov: 43 },
    { f: E('blaze'), pos: [12.6, 5.8, 23.4], look: [0, 11.4, 0], fov: 37, ease: 'io' }] }) },
  village: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('village'), pos: [-4.7, 1.7, 21.0], look: [-0.3, 5.2, 3], fov: 42 },
    { f: E('village'), pos: [-4.3, 1.8, 20.2], look: [-0.2, 5.9, 2.5], fov: 38, ease: 'io' }] }) },
  climb: { cut: 'hard', raw: keysCam({ keys: climbKeys() }) },
  search: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('search'), pos: [2.9, 13.1, 2.9], look: [0.9, 13.2, 0.5], fov: 37 },
    { f: E('search'), pos: [2.55, 13.15, 2.55], look: [0.95, 13.25, 0.5], fov: 32, ease: 'io' }] }) },
  lampcu: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('lampcu'), pos: [1.75, 14.25, 1.95], look: [0, 14.0, 0], fov: 31 },
    { f: B('lampcu') + 52, pos: [1.9, 14.1, 2.1], look: [0.2, 13.9, 0.1], fov: 29 },
    { f: E('lampcu'), pos: [2.35, 13.45, 2.45], look: [0.95, 13.35, 0.5], fov: 29, ease: 'io' }] }) },
  demand: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('demand'), pos: [0.35, 1.72, 3.8], look: [-1.05, 1.38, 1.32], fov: 35 },
    { f: E('demand'), pos: [0.2, 1.68, 3.6], look: [-1.1, 1.4, 1.34], fov: 31, ease: 'io' }] }) },
  laugh: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('laugh'), pos: [2.5, 1.62, 3.1], look: [1.3, 1.42, 1.05], fov: 34 },
    { f: E('laugh'), pos: [2.28, 1.58, 2.82], look: [1.35, 1.45, 1.05], fov: 29, ease: 'io' }] }) },
  dialogue: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('dialogue'), pos: [2.38, 1.6, 2.85], look: [1.33, 1.44, 1.05], fov: 31 },
    { f: E('dialogue'), pos: [2.2, 1.58, 2.62], look: [1.35, 1.45, 1.05], fov: 27, ease: 'io' }] }) },
  reveal: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('reveal'), pos: [3.2, 5.4, 3.2], look: [0, 6.4, 0], fov: 44 },
    { f: E('reveal'), pos: [2.95, 5.25, 2.95], look: [0, 6.5, 0], fov: 41, ease: 'io' }] }) },
  ritual: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('ritual'), pos: [2.35, 1.45, 2.7], look: [0, 1.0, 0], fov: 35 },
    { f: B('ritual') + 62, pos: [2.95, 1.65, 3.45], look: [1.0, 1.15, 0.8], fov: 33 },
    { f: E('ritual'), pos: [2.8, 2.0, 3.25], look: [0.6, 3.4, 0.3], fov: 30, ease: 'io' }] }) },
  morning: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('morning'), pos: [3.0, 2.05, 3.4], look: [0.3, 1.7, 0.2], fov: 41 },
    { f: B('morning') + 70, pos: [2.85, 1.8, 3.25], look: [0.35, 1.15, 0.25], fov: 38 },
    { f: E('morning'), pos: [2.7, 1.85, 3.1], look: [0.5, 2.6, 0.3], fov: 35, ease: 'io' }] }) },
  hook: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('hook'), pos: [5.2, 3.8, 27.5], look: [0.05, 2.9, 12.5], fov: 39 },
    { f: E('hook'), pos: [5.0, 3.75, 27.0], look: [0.02, 2.92, 12.5], fov: 37, ease: 'io' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: B('ritual') + 13, a: 0.03 }],
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
  let cinf = 2.2;
  if (['blaze', 'village', 'reveal', 'climb'].includes(S.id)) cinf = 1.3;
  if (['dialogue', 'laugh', 'lampcu', 'demand'].includes(S.id)) cinf = 3.6;
  if (S.id === 'hook') cinf = 2.6;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = {
    boardHook: 0,
    intK: ['haul', 'climb', 'search', 'lampcu', 'demand', 'laugh', 'dialogue', 'reveal', 'ritual', 'morning'].includes(S.id) ? 1 : 0,
    lampY: lampYAt(f), lampK: lampKAt(f), cwY: cwYAt(f),
    beamK: S.id === 'blaze' || S.id === 'village' || S.id === 'hook' ? 1 : 0,
    shipK: S.id === 'blaze' ? 1 : 0,
    shipX: lerp(-24, -3, smooth(ramp(f, B('blaze'), E('blaze')))),
    dustK: 0.05,
  };
  if (S.id === 'hook') W.boardHook = f < B('hook') + 20 ? smooth(ramp(f, B('hook') + 2, B('hook') + 20)) : 1;  // held at FULL opacity to the literal last frame
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  const int = worldAt(f).intK > 0;
  return {
    moteRate: int ? 0.5 : 0,          // dust motes inside the lamp beam (interior)
    sprayRate: !int && S.id !== 'hook' ? 0.35 : 0.12,  // sea spray on the rocks
    smokeRate: 0.04, dustRate: 0.04,
  };
};
export const fxAt = () => [];

// ---------- cast (single source for actors AND colliders) ----------
const TINT = { night: '#fff1dc', dawn: '#f4e6c8' };
const tintFor = (S) => S.id === 'morning' ? TINT.dawn : TINT.night;
export const OUTFITS = {
  keeper: { jacket: '#2e4059', pants: '#232a33', boots: '#17120d', hat: 'cap', cap: '#22303f', skin: '#fbf7ef', moustache: '#cfd4d8' },
  captain: { jacket: '#5d2432', pants: '#2a2f3a', boots: '#17120d', hat: 'cap', cap: '#8c2f3a', skin: '#fbf7ef', moustache: '#3a2418' },
  villager1: { jacket: '#6b543a', pants: '#33302c', boots: '#201812', hat: 'hair', hair: '#241a12', skin: '#fbf7ef' },
  villager2: { jacket: '#44586b', pants: '#2c3038', boots: '#1c1712', hat: 'cap', cap: '#5d6a2e', skin: '#fbf7ef' },
};
export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, z, extra = {}) => out.push({ id, x, y: extra.y ?? 0, z, r: 0.32, ground: extra.ground ?? 0,
    actor: (T) => ({ key: 'lhx' + JSON.stringify(o) + JSON.stringify(opts) + (extra.y ?? 0), draw: (p) => T.bodyFront(p, o, opts), x, y: extra.y ?? 0, z, ground: extra.ground ?? 0, tint, ...extra }) });
  const cap = captainAt(f);
  const KG = keeperGaze(f), CG = captainGaze(f);
  const KP = keeperPose(f);
  const keeperStd = (opts, extra = {}) => std('keeper', OUTFITS.keeper, opts, KEEPER.x, KEEPER.z, extra);
  const captainStd = (opts, extra = {}) => std('captain', OUTFITS.captain, opts, cap.x, cap.z, { y: cap.y, ground: cap.ground, blob: cap.aboard ? false : undefined, ...extra });
  switch (S.id) {
    case 'haul': {
      // OPENS mid-action: the keeper hauls the rope hand over hand, gaze up
      // at the rising lamp, body leaning with the effort.
      keeperStd({ expr: 'stern', mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.5],
        ...head(f, 31, -2.5, KG.look, KG.lookY, 0.2) }, { yaw: 0.3 });
      break;
    }
    case 'blaze': break;   // exterior: tower, lamp, ship — no cast
    case 'village': {
      std('villager1', OUTFITS.villager1, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 51), seed: 51, prop: ['point', 0.8],
        ...head(f, 51, -3, 0.2, 0.62, 0.15) }, -3.2, 11.8, { yaw: -0.25 });
      std('villager2', OUTFITS.villager2, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 52), seed: 52,
        ...head(f, 52, -2, -0.25, 0.58, -0.1) }, -2.0, 13.8, { yaw: 0.2 });
      break;
    }
    case 'climb': {
      const Tn = captainTurn(f);
      captainStd({ expr: 'stern', mode: captainMode(f), phase: q((f * 0.013) % 1, 2), blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, 1.5, CG.look, 0.3, 0) }, { yaw: -0.5 + Tn.yaw });
      break;
    }
    case 'search': {
      const Tn = captainTurn(f);
      captainStd({ expr: 'shock', mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, 0, kf([[605, -0.5], [648, -0.5], [664, 0.55], [733, 0.55]], f), 0.15, 0) }, { yaw: -0.3 + Tn.yaw, squash: Tn.squash });
      break;
    }
    case 'lampcu': {
      captainStd({ expr: 'shock', mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -2, CG.look, CG.lookY, 0) }, { yaw: -0.2 });
      break;
    }
    case 'demand': {
      const Tn = captainTurn(f);
      captainStd({ expr: 'stern', mode: 'stand', blink: blinkAt(f, 41), seed: 41, prop: ['point', 0.85],
        ...head(f, 41, 0, 0.4, 0.05, 0.3) }, { yaw: 0.55 + Tn.yaw });
      keeperStd({ expr: 'neutral', mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, 0, -0.4, 0.05, -0.3) }, { yaw: -0.5 });
      break;
    }
    case 'laugh': {
      let KP2 = T.faceP('laugh', 31); KP2.blush = 0;
      const winkK = keeperWink(f);
      if (winkK > 0) KP2 = T.blendFaceP(KP2, T.faceP('wink', 31), winkK);
      keeperStd({ expr: 'laugh', exprP: KP2, mode: 'stand', blink: blinkAt(f, 31), seed: 31, headTilt: q(-4 + micro(f, 31), 1), look: q(-0.3, 2), lookY: q(0.05, 2) }, { yaw: -0.35 });
      captainStd({ expr: 'shock', mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, 0, 0.35, 0.05, 0.25) }, { yaw: 0.5 });
      break;
    }
    case 'dialogue': {
      // THE dialogue beat: the keeper PERFORMS his line — mouth driven by
      // the stem inside the speak segment, closed outside it; the captain
      // only listens (his mouth never opens).
      keeperStd({ mode: 'stand', blink: blinkAt(f, 31), seed: 31, look: -0.25, ...speakFace('smile', f) }, { yaw: -0.3 });
      captainStd({ expr: 'neutral', mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, 0, 0.3, 0.05, 0.25) }, { yaw: 0.5 });
      break;
    }
    case 'reveal': {
      keeperStd({ expr: 'smile', mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.45],
        ...head(f, 31, -2, KG.look, KG.lookY, 0.1) }, { yaw: 0.25 });
      captainStd({ expr: 'shock', mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -2, CG.look, CG.lookY, -0.1) }, { yaw: -0.3 });
      break;
    }
    case 'ritual': {
      keeperStd({ expr: f < B('ritual') + 66 ? 'neutral' : 'smile', mode: KP.mode, squash: KP.squash, blink: blinkAt(f, 31), seed: 31,
        prop: f >= B('ritual') + 66 ? ['point', 0.5] : null,
        ...head(f, 31, f < B('ritual') + 66 ? -4 : -2, KG.look, KG.lookY, 0.15) }, { yaw: 0.3 });
      break;
    }
    case 'morning': {
      keeperStd({ expr: 'neutral', mode: KP.mode, squash: KP.squash, blink: blinkAt(f, 31), seed: 31,
        prop: f >= B('morning') + 96 ? ['point', 0.5] : null,
        ...head(f, 31, -2, KG.look, KG.lookY, 0.15) }, { yaw: 0.3 });
      break;
    }
    case 'hook': break;   // the board shot — no cast
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity: statics, dynamics, ground (LIBRARY v3 gate data) ----------
export const STATICS = [
  SOL.obb(TABLE.x, TABLE.z, 0, 0.85, 0.5, { h: 0.78, id: 'table' }),
  SOL.circle(0, 0, 0.55, { h: 0.55, id: 'cradle' }),
  SOL.circle(BOARD_POS[0] - 2.1, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  SOL.circle(BOARD_POS[0] + 2.1, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  SOL.circle(-1.9, -0.35, 0.42, { h: 0.95, id: 'oildrum' }),
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
