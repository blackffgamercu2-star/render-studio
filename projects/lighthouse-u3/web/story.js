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
// R2 REBUILD (2026-11-17, the approved moonrent R2 standard): opening =
// keeper BIG from f0 hauling beside the lamp, low angle + push-in; reveal =
// pure INSERT on the pulley wheel / ropes / lamp hook (no cast, no faces);
// ritual = ACTION close-up, keeper's hauling hands + rope + glowing lamp
// centre-frame from the FRONT; lampcu ends on the captain's amazed face
// (>=65% frame width) after opening on the burning lamp; hook = character
// beat + board together (keeper in frame pointing at the board).
// V4 UPGRADE (2026-11-19, PICTURE ONLY — stem/script/timing/boards/mix/
// speakdata untouched): camera rebuilt to the ACTION style of valleyfly/
// fireless — every shot opens with a fast eased punch-in (subject scale
// x1.6-2 in ~11-18 frames, 'io' keys), then tracks its subject at subject
// speed; reframes inside a clause are declared whips (search turn) or
// fast key dives (lampcu lamp->face); landings get declared kicks; the
// rig smoothing tightens to sigma 1.7 / radius 5 / fovSigma 1.1 so the
// authored speed survives. Animation: kit body.js v2 — lifeAt breath +
// weight-shift injected per actor in std(), emoTrack expression morphs
// at beats, gestureAt dialogue hand, gripAt haul strain, stridePh march
// phase from distance climbed (no glide). Shot/clause boundaries, focus
// targets, staging, grades and cast are the R2 build's, unchanged.
import { M, blinkAt, q, clamp, lerp, ramp, kf } from './motion.js';
import { buildRig, keysCam } from './camrig.js';
import { poseWindows, turnTrack, gazeTrack, winkTrack, lifeAt, emoTrack, gripAt, gestureAt, stridePh, jumpTrack } from './body.js';
import * as SOL from './solid.js';
import * as T from './toon.js';
import * as SPK from './speak.js';
import { SPEAK_DATA } from './speakdata.js';

// ---------- v4 dialogue performance ----------
const SPEAK = SPK.makeSpeakPlayer(SPEAK_DATA);
// U2 SKIN TARIKA: cheek/jaw contour shading now rides the EXPRESSION —
// the emoTrack morphs `cheek` together with the face (shock runs pale,
// laughter flushes, anger heats), so the skin reacts with the emotion
// instead of sitting at one flat value. std() also gives every actor
// a cheek-shaded v2 face by default (string-expr beats included).
const CHEEK = { neutral: 0.45, stern: 0.42, determined: 0.5, smile: 0.55, grin: 0.65, laugh: 0.85, shock: 0.22, wonder: 0.32, angry: 0.72, proud: 0.6, smug: 0.62, wink: 0.6, nervous: 0.3, scared: 0.25, sad: 0.35, thinking: 0.45, confused: 0.4, stubborn: 0.5, squint: 0.45, relief: 0.6 };
const faceP2 = (name) => ({ ...T.faceP(name), cheek: CHEEK[name] ?? 0.45 });
const speakFace = (baseName, f) => {
  const s = SPEAK.at(f);
  return { expr: 'smile', exprP: SPK.applySpeak({ ...faceP2(baseName), cheek: 0.5 + 0.3 * Math.abs(s.nod || 0) }, s), headTilt: q(s.nod || 0, 2), clothShade: true };
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
// U3 GRADES (FILTER_VFX_LIGHTING pack): the exterior beats get their
// own members of the Night Lamp family, the hook sits in a pre-dawn
// glow, and the lampcu reveal runs EXPOSURE CHOREOGRAPHY — the world
// dims ~18% while the captain stares up at the burning lamp, then the
// light builds past neutral as the dive lands on his face. All ramps
// are 12+ frames: no one-frame pops.
LIGHTS.blaze = { ...LIGHTS.night, sun: '#c8a06a', sunI: 0.85, hemi: 0.58, skyHor: '#2c4258', sat: 1.13, vig: 0.34, gain: '#ffd9a8', waterDeep: '#081c30', waterShal: '#276b78', glint: '#ffd9a0' };
LIGHTS.moon = { ...LIGHTS.night, sky: '#2c3c58', sun: '#a9c2e8', sunI: 0.85, fogFar: 240, sat: 1.03, vig: 0.26 };
export const lightFor = (S, f) => {
  if (S.id === 'morning') return blendLight(LIGHTS.night, LIGHTS.dawn, smooth(ramp(f, B('morning'), B('morning') + 55)));
  if (S.id === 'blaze') return { ...LIGHTS.blaze };
  if (S.id === 'village') return { ...LIGHTS.moon };
  if (S.id === 'hook') return blendLight(LIGHTS.night, LIGHTS.dawn, 0.38);
  const L = { ...LIGHTS[S.light] };
  if (S.id === 'lampcu') {
    const dip = 1 - 0.18 * smooth(ramp(f, B('lampcu') + 34, B('lampcu') + 48)) + 0.24 * smooth(ramp(f, B('lampcu') + 56, B('lampcu') + 70));
    L.hemi *= dip; L.sunI *= dip;
  }
  return L;
};

// ---------- staging (shared by story, main, colliders) ----------
export const BOARD_POS = [0, 3.0, 12.5];
export const KEEPER = { x: 1.35, z: 1.05 };        // ground floor, by the rope
export const KEEPER_NEAR = { x: 0.95, z: 0.62 };   // haul/ritual: right at the lamp, so keeper + lamp + rope share one tight frame
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
  if (S === 'demand') {
    // U2 BODY LANGUAGE: he STORMS IN — marching from the stair foot to
    // his spot over the first ~30 frames (feet planted by stridePh in
    // castAt) instead of standing planted for the whole demand. The
    // demand camera's look keys track the walk, so he is framed from
    // the first step (eye-checked: a fixed look lost him behind the
    // oil drum for the opening frames).
    const u = smooth(ramp(f, B('demand') + 2, B('demand') + 32));
    return { x: lerp(-2.5, CAPTAIN_G.x, u), z: lerp(2.1, CAPTAIN_G.z, u), y: 0, ground: 0, aboard: 0 };
  }
  return { x: CAPTAIN_G.x, z: CAPTAIN_G.z, y: 0, ground: 0, aboard: 0 };
};
export const captainMode = (f) => {
  if (shotAt(f).id === 'climb') return 'march';
  if (shotAt(f).id === 'demand' && f < B('demand') + 32) return 'march';
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
// ---------- v4 animation tracks (kit body.js v2) ----------
// CONTINUOUS LIFE (breath + weight-shift tilt) is injected per actor
// inside std() below, seeded by each actor's own seed. EXPRESSION
// MORPHS at beats: the captain arrives at the top room determined and
// the shock builds as he finds it empty; storms down stern; is shocked
// again by the laugh; settles to neutral listening for the dialogue.
// The keeper's dialogue face morphs out of his laugh into the smile he
// delivers the line with (speak.js still drives the mouth itself).
const captainEmo = emoTrack(faceP2, 'stern', [[448, 'determined', 16], [605, 'shock', 18], [742, 'wonder', 20], [862, 'angry', 10], [1000, 'shock', 8], [1088, 'neutral', 12]]);
const v1Emo = emoTrack(faceP2, 'wonder', [[323, 'shock', 12], [392, 'wonder', 16]]);
const v2Emo = emoTrack(faceP2, 'neutral', [[352, 'shock', 10], [408, 'wonder', 14]]);
const keeperEmo = emoTrack(faceP2, 'smile', [[1000, 'laugh', 1], [1062, 'smug', 10], [1088, 'smile', 14], [1150, 'proud', 10]]);
const haulEmo = emoTrack(faceP2, 'stern', [[0, 'stern', 1], [58, 'determined', 22], [138, 'proud', 18]]);
const ritualEmo = emoTrack(faceP2, 'neutral', [[1325, 'neutral', 1], [1362, 'determined', 12], [1442, 'smile', 14]]);
const morningEmo = emoTrack(faceP2, 'neutral', [[1455, 'neutral', 1], [1522, 'smile', 16]]);
// DIALOGUE GESTURE: while the keeper performs his line, his free hand
// talks with the voice — beats on the stressed words (never / tower /
// lamp / climbing, from words.json).
const keeperGesture = gestureAt([{ a: 1088, b: 1162, beats: [1091, 1111, 1138, 1155], base: 0.48, amp: 0.22 }]);
// HAUL GRIP: the first heave of the ritual haul strains (squash swell
// as the body takes the lamp's weight), then a settle pulse at the top.
const haulGrip = gripAt([{ f0: 1391, dur: 20, type: 'lift', settle: 10 }]);
const morningGrip = gripAt([{ f0: 1551, dur: 18, type: 'lift', settle: 8 }]);
const lampStartle = jumpTrack([{ f0: 806, dur: 11, h: 0.09, back: 3 }]);   // U3: the captain flinches as the reveal dive lands on him
const micro = (f, seed) => 1.1 * Math.sin((f + seed * 5) * 0.037 + 1);
const head = (f, seed, tilt, look, lookY, facing = 0, squash = 0) => ({
  headTilt: q(tilt + micro(f, seed), 1), look: q(look, 2), lookY: q(lookY, 2), facing: q(facing, 2), squash: q(squash, 2),
});

// ---------- hero / focus ----------
const FOCUS = {
  haul: () => [0.5, 1.4, 0.3],
  blaze: () => [0, 12.5, 0],
  village: () => [0, 11, 4],
  climb: () => { const c = captainAt(520); return [c.x, c.y + 1.2, c.z]; },
  search: () => [CAPTAIN_T.x, TOPFLOOR_Y + 1.4, CAPTAIN_T.z],
  // focus racks from the burning lamp to the captain's upturned face
  lampcu: (f) => { const u = smooth(ramp(f, B('lampcu') + 45, B('lampcu') + 95)); return [lerp(0, 1.6, u), lerp(LAMP_TOP, TOPFLOOR_Y + 1.45, u), lerp(0, 0.2, u)]; },
  demand: () => [CAPTAIN_G.x, 1.35, CAPTAIN_G.z],
  laugh: () => [KEEPER.x, 1.45, KEEPER.z],
  dialogue: () => [KEEPER.x, 1.45, KEEPER.z],
  reveal: () => [0, 14.4, 0],
  ritual: () => [0.5, 1.2, 0.3],
  morning: () => [0.4, 1.2, 0.3],
  // R2 fix: focus sits between the near keeper (~6 m) and the board
  // (~13 m) so BOTH stay readable with cinf 1.8 (keeper coc ~1.1, board <0.6).
  hook: () => [0.4, 2.8, 16.2],
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id](f);

// ---------- cameras: V4 ACTION RIG — every move keyed to the subject ----------
// Grammar (valleyfly/fireless): each shot OPENS with a fast eased punch-in
// (an 'io' key landing ~11-18 frames in, subject scale x1.6-2), then TRACKS
// its subject at subject speed for the rest of the clause; reframes inside
// a clause are a declared whip (the search turn) or a fast key dive (the
// lampcu lamp->face rack); physical landings get declared kicks. The rig
// smoothing tightens to sigma 1.7 / radius 5 / fovSigma 1.1 (the R2 build
// ran 3.2 / 10 / 1.6) so the authored speed survives to the screen.
// the climb TRACKS the captain: keys are sampled from his own stair path,
// the vantage riding ~140 degrees around the shaft and rising with him —
// v4: it starts wide (r 3.05) and DIVES to r 2.3 by the second key, then
// keeps closing (r -> 1.87, fov 44 -> 34.5) as he nears the top.
const climbKeys = () => {
  const offs = [0, 20, 39, 59, 78, 98, 117, 137, 156];
  const rad = [3.05, 2.3, 2.22, 2.15, 2.09, 2.03, 1.97, 1.92, 1.87];
  const fovs = [44, 38, 37.5, 37, 36.5, 36, 35.5, 35, 34.5];
  return offs.map((d, i) => {
    const f = B('climb') + d;
    const c = captainAt(f);
    const ang = Math.atan2(c.z, c.x) + 2.45;
    return { f, pos: [Math.cos(ang) * rad[i], c.y + 0.78, Math.sin(ang) * rad[i]], look: [c.x, c.y + 1.15, c.z], fov: fovs[i], ...(i === 1 || i === offs.length - 1 ? { ease: 'io' } : {}) };
  });
};
// Interior positions stay inside the shaft (r <= 4.0); nothing ever holds
// still — every shot is still travelling on its last frame.
const RIG_SHOTS = [
  // OPENING: low angle, front three-quarter — the keeper BIG from f0
  // (head ~40%) hauling beside the lamp; a 15-frame DIVE takes him to
  // ~65% as the lamp lifts off its cradle, then the camera rises and
  // tilts up WITH the climb, the keeper held in frame throughout.
  { id: 'haul', a: B('haul'), b: E('haul'), cut: 'hard', raw: keysCam({ keys: [
    { f: B('haul'), pos: [3.54, 1.0, -1.79], look: [0.7, 1.42, 0.55], fov: 44 },
    { f: B('haul') + 12, pos: [2.75, 1.12, -1.05], look: [0.8, 1.5, 0.55], fov: 39, ease: 'io' },
    { f: B('haul') + 80, pos: [2.7, 1.4, -1.0], look: [0.7, 2.0, 0.5], fov: 37 },
    { f: E('haul'), pos: [2.6, 1.75, -0.95], look: [0.62, 2.7, 0.45], fov: 35, ease: 'io' }] }) },
  // EXTERIOR: the dive drives at the blazing lamp room while the ship
  // crosses below; the look settles a touch toward the ship's side.
  { id: 'blaze', a: B('blaze'), b: E('blaze'), cut: 'hard', raw: keysCam({ keys: [
    { f: B('blaze'), pos: [16.5, 7.6, 29.5], look: [0, 10.0, 0], fov: 45 },
    { f: B('blaze') + 18, pos: [13.8, 6.4, 24.8], look: [0, 11.0, 0], fov: 38, ease: 'io' },
    { f: E('blaze'), pos: [11.6, 5.2, 21.8], look: [-1.8, 11.4, 0], fov: 35, ease: 'io' }] }) },
  // VILLAGE A: wide on both villagers + the tower top they stare at.
  { id: 'villageA', a: B('village'), b: B('village') + 6, cut: 'hard', raw: keysCam({ keys: [
    { f: B('village'), pos: [-4.9, 1.75, 20.6], look: [-0.4, 4.4, 3], fov: 42 },
    { f: B('village') + 6, pos: [-4.85, 1.76, 20.4], look: [-0.4, 4.4, 3], fov: 42 }] }) },
  // VILLAGE B: WHIP reframe (8-frame blend) off the tower and down onto
  // the shocked villager's upturned face, then a settling push under
  // their gaze line.
  { id: 'villageB', a: B('village') + 7, b: E('village'), cut: 'whip', blend: 8, raw: keysCam({ keys: [
    { f: B('village') + 7, pos: [-4.05, 1.75, 17.6], look: [-3.1, 1.7, 13.0], fov: 36 },
    { f: E('village'), pos: [-3.95, 1.8, 17.3], look: [-3.2, 1.9, 13.2], fov: 34, ease: 'io' }] }) },
  { id: 'climb', a: B('climb'), b: B('climb') + 29, cut: 'hard', raw: keysCam({ keys: climbKeys().filter((k) => k.f <= B('climb') + 29) }) },
  // U2 POV INSERT (Zack D grammar): early in the climb, for ~24 frames
  // we ARE the captain — the camera sits at his head low in the shaft
  // and looks UP past the spiralling stairs and the rope to the
  // burning lamp, then cuts back to the tracking rig.
  { id: 'climbPOV', a: B('climb') + 30, b: B('climb') + 53, cut: 'hard', raw: keysCam({ keys: (() => {
      const ks = [];
      for (const d of [30, 41, 53]) {
        const c = captainAt(B('climb') + d);
        ks.push({ f: B('climb') + d, pos: [c.x * 0.92, c.y + 1.42, c.z * 0.92], look: [0, 13.6, 0], fov: 44 });
      }
      return ks;
    })() }) },
  { id: 'climb', a: B('climb') + 54, b: E('climb'), cut: 'hard', raw: keysCam({ keys: climbKeys().filter((k) => k.f >= B('climb') + 54) }) },
  // SEARCH A: punch-in as he bursts into the top room (14 frames).
  { id: 'searchA', a: B('search'), b: B('search') + 42, cut: 'hard', raw: keysCam({ keys: [
    { f: B('search'), pos: [3.1, 13.3, 3.1], look: [0.9, 13.25, 0.5], fov: 38 },
    { f: B('search') + 11, pos: [2.55, 13.2, 2.55], look: [0.92, 13.3, 0.5], fov: 31, ease: 'io' },
    { f: B('search') + 42, pos: [2.45, 13.2, 2.45], look: [0.93, 13.3, 0.5], fov: 30 }] }) },
  // SEARCH B: WHIP reframe (6-frame blend) — the camera swings around
  // him as he turns (turnTrack f648), landing on his other side.
  { id: 'searchB', a: B('search') + 43, b: E('search'), cut: 'whip', blend: 6, raw: keysCam({ keys: [
    { f: B('search') + 43, pos: [1.85, 13.28, 3.35], look: [0.95, 13.3, 0.5], fov: 31 },
    { f: E('search'), pos: [1.7, 13.2, 3.0], look: [0.95, 13.32, 0.5], fov: 29, ease: 'io' }] }) },
  // LAMPCU: open ON the burning lamp (fills the frame, micro-push),
  // then a FAST 18-frame dive down-right onto the captain's upturned
  // face (~70% width) as the realisation lands — kick on the landing.
  { id: 'lampcu', a: B('lampcu'), b: E('lampcu'), cut: 'hard', raw: keysCam({ keys: [
    { f: B('lampcu'), pos: [2.05, 14.35, 2.35], look: [0, 13.95, 0], fov: 30 },
    { f: B('lampcu') + 50, pos: [2.12, 14.28, 2.42], look: [0, 13.95, 0], fov: 30 },
    { f: B('lampcu') + 68, pos: [2.3, 13.6, 2.55], look: [1.55, 13.4, 0.2], fov: 27, ease: 'io' },
    { f: E('lampcu'), pos: [2.35, 13.5, 2.6], look: [1.6, 13.38, 0.2], fov: 26, ease: 'io' }] }) },
  // DEMAND: he storms in — 13-frame punch to his pointing face, kick
  // on the plant/turn at f866.
  { id: 'demand', a: B('demand'), b: E('demand'), cut: 'hard', raw: keysCam({ keys: [
    { f: B('demand'), pos: [0.55, 1.8, 3.9], look: [-2.5, 1.35, 2.1], fov: 36 },
    { f: B('demand') + 10, pos: [0.2, 1.68, 3.3], look: [-2.23, 1.37, 1.94], fov: 29, ease: 'io' },
    { f: B('demand') + 32, pos: [0.14, 1.66, 3.22], look: [-1.17, 1.38, 1.33], fov: 27.5, ease: 'io' },
    { f: E('demand'), pos: [0.1, 1.64, 3.15], look: [-1.1, 1.4, 1.34], fov: 27, ease: 'io' }] }) },
  // LAUGH: 12-frame punch-in on the keeper's laughing face.
  { id: 'laugh', a: B('laugh'), b: E('laugh'), cut: 'hard', raw: keysCam({ keys: [
    { f: B('laugh'), pos: [2.5, 1.65, 3.05], look: [1.3, 1.42, 1.05], fov: 34 },
    { f: B('laugh') + 10, pos: [2.2, 1.58, 2.7], look: [1.33, 1.44, 1.05], fov: 28, ease: 'io' },
    { f: E('laugh'), pos: [2.12, 1.56, 2.6], look: [1.35, 1.45, 1.05], fov: 26, ease: 'io' }] }) },
  // DIALOGUE: fast punch-in (11 frames) to the speaking face, then the
  // camera HOLDS on the speaker (micro-push only) for the performance.
  { id: 'dialogue', a: B('dialogue'), b: E('dialogue'), cut: 'hard', raw: keysCam({ keys: [
    { f: B('dialogue'), pos: [2.42, 1.62, 2.9], look: [1.33, 1.44, 1.05], fov: 31 },
    { f: B('dialogue') + 9, pos: [2.24, 1.59, 2.66], look: [1.35, 1.45, 1.05], fov: 27, ease: 'io' },
    { f: E('dialogue'), pos: [2.2, 1.58, 2.62], look: [1.35, 1.45, 1.05], fov: 26, ease: 'io' }] }) },
  // REVEAL INSERT: no cast — the camera rides the mechanism: a 16-frame
  // dive onto the pulley wheel (spans ~85% of width), then a push + tilt
  // down the main rope toward the lamp hanging at mid-shaft.
  { id: 'reveal', a: B('reveal'), b: E('reveal'), cut: 'hard', raw: keysCam({ keys: [
    { f: B('reveal'), pos: [1.75, 14.0, 2.3], look: [0, 14.5, 0], fov: 36 },
    { f: B('reveal') + 16, pos: [1.5, 13.7, 2.0], look: [0.02, 13.9, -0.02], fov: 31, ease: 'io' },
    { f: E('reveal'), pos: [1.38, 13.25, 1.88], look: [0.1, 12.4, -0.1], fov: 29, ease: 'io' }] }) },
  // RITUAL ACTION: front close on the work — a 14-frame dive onto the
  // kneeling keeper's hands + the lit lamp; when the haul begins
  // (f+66) the camera tilts up fast WITH the rising lamp, hands + rope
  // + glowing lamp held centre-frame.
  { id: 'ritual', a: B('ritual'), b: E('ritual'), cut: 'hard', raw: keysCam({ keys: [
    { f: B('ritual'), pos: [3.7, 1.1, -1.9], look: [0.93, 1.0, 0.5], fov: 42 },
    { f: B('ritual') + 11, pos: [3.3, 1.25, -1.62], look: [0.91, 1.1, 0.48], fov: 37, ease: 'io' },
    { f: B('ritual') + 66, pos: [3.28, 1.35, -1.6], look: [0.9, 1.3, 0.47], fov: 36 },
    { f: B('ritual') + 80, pos: [3.2, 1.45, -1.55], look: [0.89, 1.5, 0.46], fov: 35, ease: 'io' },
    { f: E('ritual'), pos: [3.1, 1.55, -1.5], look: [0.88, 1.7, 0.45], fov: 34, ease: 'io' }] }) },
  // MORNING: 14-frame punch-in on the lowering lamp + keeper, tracking
  // down to the cradle (kick as it lands), then tilting up with the
  // morning raise to the last frame.
  { id: 'morning', a: B('morning'), b: E('morning'), cut: 'hard', raw: keysCam({ keys: [
    { f: B('morning'), pos: [3.15, 2.1, 3.55], look: [0.45, 1.7, 0.2], fov: 40 },
    { f: B('morning') + 11, pos: [2.9, 1.85, 3.28], look: [0.48, 1.2, 0.23], fov: 35, ease: 'io' },
    { f: B('morning') + 70, pos: [2.82, 1.75, 3.2], look: [0.51, 1.12, 0.25], fov: 34 },
    { f: E('morning'), pos: [2.7, 1.7, 3.1], look: [0.6, 1.75, 0.3], fov: 32, ease: 'io' }] }) },
  // FINAL: character beat + board together — a definite 18-frame
  // push-in as the board fades up, then a slow settle that is still
  // travelling on the literal last frame; the end keys match the R2
  // build's approved framing (board ~85% wide, fully inside, keeper's
  // head ~22% in the near foreground).
  { id: 'hook', a: B('hook'), b: E('hook'), cut: 'hard', raw: keysCam({ keys: [
    { f: B('hook'), pos: [4.5, 2.45, 26.6], look: [0, 3.02, 12.5], fov: 42 },
    { f: B('hook') + 14, pos: [4.15, 2.28, 25.4], look: [-0.01, 3.02, 12.5], fov: 39, ease: 'io' },
    { f: E('hook'), pos: [3.85, 2.05, 24.2], look: [-0.02, 3.02, 12.5], fov: 36, ease: 'io' }] }) },
];
const RIG = buildRig({
  total: TOTAL,
  shots: RIG_SHOTS,
  kicks: [
    { f: B('haul') + 12, a: 0.06 },     // the lamp strains off its cradle
    { f: B('climb') + 4, a: 0.05 },     // U2: the captain's first planted step
    { f: B('village') + 7, a: 0.05 },   // U2: the whip lands on the villager's face
    { f: E('climb') - 6, a: 0.06 },     // the captain plants on the top floor
    { f: B('lampcu') + 68, a: 0.05 },   // the reveal dive lands on his face
    { f: B('demand') + 4, a: 0.07 },    // storm-in plant + turn
    { f: B('ritual') + 66, a: 0.06 },   // the first heave of the haul
    { f: E('ritual') - 4, a: 0.05 },    // the lamp seats at the top
    { f: B('morning') + 48, a: 0.06 },  // the lamp lands back in its cradle
  ],
  sigma: 1.45, smoothRadius: 4, fovSigma: 0.9,
});
export const camAt = (f) => RIG.camAt(f);
export const RIG_META = {
  kicks: RIG.declared.kicks, hardCuts: RIG.declared.hardCuts,
  blends: RIG_SHOTS.filter((s) => s.cut === 'blend' || s.cut === 'whip').map((s) => ({ a: s.a - Math.floor((s.blend || 0) / 2), b: s.a + Math.ceil((s.blend || 0) / 2) })),
  whips: RIG.declared.whips,
  samples: RIG.samples,
};
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), hp = heroPosAt(f);
  let cinf = 2.2;
  if (['blaze', 'village', 'climb'].includes(S.id)) cinf = 1.3;
  if (['dialogue', 'lampcu'].includes(S.id)) cinf = 4.3;
  if (['laugh', 'demand'].includes(S.id)) cinf = 3.6;
  if (S.id === 'reveal') cinf = 2.4;   // the mechanism stays crisp, shaft softens
  if (S.id === 'ritual') cinf = 3.4;
  if (S.id === 'hook') cinf = 1.8;     // keeper (near) + board (far) both readable
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
    moteRate: int ? 0.55 : (S.id === 'blaze' ? 0.4 : 0),   // U3: beam dust OUTSIDE too — the rotating beam reads through the sea mist
    sprayRate: !int && S.id !== 'hook' ? (S.id === 'blaze' ? 0.65 : 0.4) : 0.14,  // U3: a wilder sea on the wild evening
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
  // v4 CONTINUOUS LIFE: every actor breathes and shifts weight foot to
  // foot (lifeAt, seeded per character) — breath feeds bodyFront's idle
  // head settle, the weight-shift tilt folds into the head track. Nobody
  // stands like a robot, not even while speaking.
  const std = (id, o, opts, x, z, extra = {}) => {
    const L = lifeAt({ seed: opts.seed || 1, shift: 1.1, swayAmp: 0.5 })(f);
    // U2: a SPEAKER sways with the voice (lifeAt.sway folded in at
    // 2.2x on top of the weight-shift tilt); every actor without an
    // explicit exprP gets the cheek-shaded v2 face for its named
    // expression, so the skin shading upgrade covers every beat.
    const o2 = { ...opts, breath: opts.breath ?? L.breath, headTilt: q((opts.headTilt || 0) + L.tilt + (opts.speaker ? L.sway * 2.2 : 0), 1) };
    if (!o2.exprP && o2.expr) o2.exprP = faceP2(o2.expr);
    out.push({ id, x, y: extra.y ?? 0, z, r: 0.32, ground: extra.ground ?? 0,
      actor: (T) => ({ key: 'lhx' + JSON.stringify(o) + JSON.stringify(o2) + (extra.y ?? 0), draw: (p) => T.bodyFront(p, o, o2), x, y: extra.y ?? 0, z, ground: extra.ground ?? 0, tint, ...extra }) });
  };
  const cap = captainAt(f);
  const KG = keeperGaze(f), CG = captainGaze(f);
  const KP = keeperPose(f);
  const keeperStd = (opts, extra = {}) => std('keeper', OUTFITS.keeper, opts, KEEPER.x, KEEPER.z, extra);
  const keeperNearStd = (opts, extra = {}) => std('keeper', OUTFITS.keeper, opts, KEEPER_NEAR.x, KEEPER_NEAR.z, extra);
  const captainStd = (opts, extra = {}) => std('captain', OUTFITS.captain, opts, cap.x, cap.z, { y: cap.y, ground: cap.ground, blob: cap.aboard ? false : undefined, ...extra });
  switch (S.id) {
    case 'haul': {
      // OPENS mid-action: the keeper hauls the rope hand over hand (the
      // prop arm pumps k 0.2..0.8, body squashing with the pull), gaze up
      // at the rising lamp, body leaning with the effort.
      keeperNearStd({ expr: 'stern', exprP: haulEmo.at(f), mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', q(0.5 + 0.3 * Math.sin(f * 0.21), 2)],
        ...head(f, 31, -2.5, KG.look, KG.lookY, 0.2, q(0.03 * Math.sin(f * 0.21 + 1), 2)) }, { yaw: 0.3 });
      break;
    }
    case 'blaze': break;   // exterior: tower, lamp, ship — no cast
    case 'village': {
      std('villager1', OUTFITS.villager1, { expr: 'shock', exprP: v1Emo.at(f), mode: 'stand', blink: blinkAt(f, 51), seed: 51, prop: ['point', 0.8],
        ...head(f, 51, -3, 0.2, 0.62, 0.15) }, -3.4, 14.2, { yaw: -0.25 });
      std('villager2', OUTFITS.villager2, { expr: 'neutral', exprP: v2Emo.at(f), mode: 'stand', blink: blinkAt(f, 52), seed: 52, prop: f >= B('village') + 40 ? ['point', -0.7] : null,
        ...head(f, 52, -2, -0.25, 0.58, -0.1) }, -1.85, 15.9, { yaw: 0.2 });
      break;
    }
    case 'climb': {
      const Tn = captainTurn(f);
      // v4: march phase from DISTANCE climbed (stridePh) — 16 steps of
      // ~1.19 units at a 2.38 stride = ~8 full cycles; feet plant with
      // the stairs, no glide (the old frame-count phase crept at ~1.9).
      const cu = smooth(ramp(f, B('climb') + 4, E('climb') - 6));
      const cph = stridePh(0, (lerp(3, 19, cu) - 3) * 1.19, 2.38);
      captainStd({ expr: 'stern', mode: captainMode(f), phase: q(cph, 2), blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, 1.5, CG.look, 0.3, 0) }, { yaw: -0.5 + Tn.yaw });
      break;
    }
    case 'search': {
      const Tn = captainTurn(f);
      captainStd({ expr: 'shock', exprP: captainEmo.at(f), mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, 0, kf([[605, -0.5], [648, -0.5], [664, 0.55], [733, 0.55]], f), 0.15, 0) }, { yaw: -0.3 + Tn.yaw, squash: Tn.squash });
      break;
    }
    case 'lampcu': {
      // R2: the captain stands clear of the lamp framing at (1.6, 0.2) —
      // out of frame while the camera is on the lamp, then centred for
      // the closing reaction close-up.
      const ST = lampStartle(f);
      std('captain', OUTFITS.captain, { expr: 'shock', exprP: captainEmo.at(f), mode: 'stand', squash: q(ST.squash, 2), blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -2 - ST.lean, CG.look, CG.lookY, 0) }, 1.6, 0.2, { y: TOPFLOOR_Y + ST.y, ground: TOPFLOOR_Y, yaw: -0.2 });
      break;
    }
    case 'demand': {
      const Tn = captainTurn(f);
      const du = smooth(ramp(f, B('demand') + 2, B('demand') + 32));
      captainStd({ expr: 'stern', exprP: captainEmo.at(f), mode: captainMode(f), phase: q(stridePh(0, du * 1.55, 0.99), 2), blink: blinkAt(f, 41), seed: 41, prop: f >= B('demand') + 30 ? ['point', 0.85] : null,
        ...head(f, 41, 0, 0.4, 0.05, 0.3) }, { yaw: 0.55 + Tn.yaw });
      keeperStd({ expr: 'neutral', mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, 0, -0.4, 0.05, -0.3) }, { yaw: -0.5 });
      break;
    }
    case 'laugh': {
      let KP2 = T.faceP('laugh', 31); KP2.blush = 0; KP2.cheek = 0.85;
      const winkK = keeperWink(f);
      if (winkK > 0) KP2 = T.blendFaceP(KP2, T.faceP('wink', 31), winkK);
      keeperStd({ expr: 'laugh', exprP: KP2, mode: 'stand', squash: q(0.045 + 0.04 * Math.sin(f * 0.55), 2), blink: blinkAt(f, 31), seed: 31, headTilt: q(-4 + micro(f, 31) + 1.6 * Math.sin(f * 0.55 + 0.6), 1), look: q(-0.3, 2), lookY: q(0.05, 2) }, { yaw: -0.35 });
      captainStd({ expr: 'shock', exprP: captainEmo.at(f), mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, 0, 0.35, 0.05, 0.25) }, { yaw: 0.5 });
      break;
    }
    case 'dialogue': {
      // THE dialogue beat: the keeper PERFORMS his line — mouth driven by
      // the stem inside the speak segment, closed outside it; the captain
      // only listens (his mouth never opens). v4: the face under the
      // mouth morphs laugh -> smile into the line (keeperEmo), and his
      // free hand GESTURES with the voice (keeperGesture) — he does not
      // stand like a robot while he speaks.
      const DG = keeperGesture(f);
      const DS = SPEAK.at(f);
      keeperStd({ mode: 'stand', speaker: 1, blink: blinkAt(f, 31), seed: 31, look: -0.25,
        prop: DG.on ? ['point', q(DG.k, 2)] : null,
        expr: 'smile', exprP: SPK.applySpeak({ ...keeperEmo.at(f), cheek: 0.5 + 0.3 * Math.abs(DS.nod || 0) }, DS), headTilt: q(DS.nod || 0, 2), clothShade: true }, { yaw: -0.3 });
      captainStd({ expr: 'neutral', exprP: captainEmo.at(f), mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, 0, 0.3, 0.05, 0.25) }, { yaw: 0.5 });
      break;
    }
    case 'reveal': break;   // R2: pure mechanism insert — no cast, no faces
    case 'ritual': {
      keeperNearStd({ expr: f < B('ritual') + 66 ? 'neutral' : 'smile', exprP: ritualEmo.at(f), mode: KP.mode, squash: q(KP.squash + haulGrip(f).squash, 2), blink: blinkAt(f, 31), seed: 31,
        prop: f >= B('ritual') + 66 ? ['point', q(0.5 + 0.3 * Math.sin((f - B('ritual')) * 0.21), 2)] : null,
        ...head(f, 31, f < B('ritual') + 66 ? -4 : -2, KG.look, KG.lookY, 0.15) }, { yaw: 0.3 });
      break;
    }
    case 'morning': {
      keeperStd({ expr: 'neutral', exprP: morningEmo.at(f), mode: KP.mode, squash: q(KP.squash + morningGrip(f).squash, 2), blink: blinkAt(f, 31), seed: 31,
        prop: f >= B('morning') + 96 ? ['point', q(0.35 + 0.3 * morningGrip(f).k, 2)] : null,
        ...head(f, 31, -2, KG.look, KG.lookY, 0.15) }, { yaw: 0.3 });
      break;
    }
    case 'hook': {
      // R2 FINAL: the keeper himself delivers the tease — standing in the
      // near foreground left of the board, grinning and pointing up at it.
      // R2 fix: moved closer to camera along the view ray (17.8 -> 19.3)
      // so his head reads ~22% of frame width (was ~17%); paired with the
      // lowered hook camera so he stays framed as a foreground figure.
      std('keeper', OUTFITS.keeper, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.78],
        ...head(f, 31, -2, -0.25, 0.4, 0.1) }, 1.85, 19.3, { yaw: -0.1 });
      break;
    }
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
