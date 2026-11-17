// Shot plan for "The Man Who Won Every Bet" — bets (SALTED MINE V3 style:
// painted world, round-white-head cards, word-by-word captions, body.js
// actions, speak.js dialogue performance). Batch 9 E5 (Mirror Trick Tales).
// R2 REBUILD (approved moonrent-hindi R2 standard): opening hero BIG from
// f0, object INSERT fills the frame (the capsule pigeon in the cote), the
// ACTION beat is a front three-quarter close-up (the dawn landing + the
// capsule untied at the perch — camera never behind the cards), a REACTION
// face ≥65% wide (the bookmaker at the finish post as the no-name horse
// wins), and the FINAL is a character beat + hook board together (the
// gambler kneels in the foreground pointing up at the board).
// Sets: the village SQUARE (bookmaker's stall + champion ring), the distant
// RACECOURSE, the STREET to the gambler's house (porch, roof platform,
// DOVECOTE), and the open SKY for the pigeon's flight home.
// Voice stem: 56.651 s, 30 fps, TOTAL 1700; timings from faster-whisper
// small full-file decode (words.json / timing.json, match 0.977). Scene
// changes ONLY at clause (script-line) boundaries:
//   L1  payout     He never lost a single bet in twenty years.
//   L2  race       He bet on horses nobody had heard of — they won.
//   L3  champion   He bet against champions, and the champions fell.
//   L4  luckiest   The village called him the luckiest man alive.
//   L5  gold       Men offered gold just to stand near him.
//   L6  lastsecond He only ever bet at the very last moment.
//   L7  follow     One evening the bookmaker followed him home.
//   L8  dovecote   On the roof he found a small dovecote + capsules.
//   L9  accuse     The bookmaker burst in, accused him of witchcraft.
//   L10 laugh      The old gambler laughed and gave him the plain truth.
//   L11 dialogue   "I never bet on tomorrow, friends. Yesterday is much safer."
//   L12 son        His son worked at the city racecourse, two days away.
//   L13 flight     A pigeon flew home with the winner's name.
//   L14 sixhours   The pigeon took six hours; the news took two days.
//   L15 hook       But tomorrow… the man who could call the clouds?
// GRADE (FILTER_VFX_LIGHTING pack): Golden Hour family — warm low sun over
// the race day, deepening to dusk on the evening beats (follow → dialogue),
// back to gold at the distant racecourse, dusk again for the landing + hook.
// Grade changes ONLY on clause boundaries; boards never graded.
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

export const FPS = 30, TOTAL = 1700, DECK = 0;
// Shot boundaries (frames) — snapped to timing.json phrase starts.
export const BND = [0, 146, 238, 316, 450, 547, 685, 800, 970, 1065, 1145, 1250, 1348, 1454, 1611, 1700];
const IDS = ['payout', 'race', 'champion', 'luckiest', 'gold', 'lastsecond', 'follow', 'dovecote', 'accuse', 'laugh', 'dialogue', 'son', 'flight', 'sixhours', 'hook'];
const SETS = { payout: 'square', race: 'course', champion: 'square', luckiest: 'square', gold: 'square', lastsecond: 'square', follow: 'street', dovecote: 'street', accuse: 'street', laugh: 'street', dialogue: 'street', son: 'course', flight: 'sky', sixhours: 'street', hook: 'square' };
export const SHOTS = IDS.map((id, i) => ({ id, a: BND[i], b: BND[i + 1] - 1, light: 'gold', set: SETS[id] }));
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
const F = (id) => SHOTS.find((s) => s.id === id);
const B = (id) => F(id).a, E = (id) => F(id).b;

// ---------- lights / mood grades (Golden Hour family) ----------
export const LIGHTS = {
  gold: { az: 246, el: 23, sky: '#ffd9a3', ground: '#6b4a2e', hemi: 0.88, sun: '#ffb45e', sunI: 1.85, fog: '#eec493', fogNear: 34, fogFar: 260,
    skyTop: '#5f8fce', skyHor: '#ffc37e', sunDisc: '#fff3c4', sunSize: 0.004, sat: 1.12, vig: 0.26, shadowExt: 30, aurora: 0, gain: '#ffd9ae',
    waterDeep: '#2a4a5e', waterShal: '#3f7d8c', glint: '#ffe9c0' },
  dusk: { az: 256, el: 12, sky: '#e8a06a', ground: '#4a3220', hemi: 0.66, sun: '#ff9a4e', sunI: 1.5, fog: '#d99a68', fogNear: 28, fogFar: 210,
    skyTop: '#3d4a75', skyHor: '#ff9e5e', sunDisc: '#ffd9a0', sunSize: 0.005, sat: 1.1, vig: 0.3, shadowExt: 30, aurora: 0, gain: '#ffc98f',
    waterDeep: '#24384e', waterShal: '#35606e', glint: '#ffd9a0' },
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
  if (S.id === 'follow') return blendLight(LIGHTS.gold, LIGHTS.dusk, smooth(ramp(f, B('follow'), B('follow') + 70)));
  if (S.id === 'sixhours') return blendLight(LIGHTS.gold, LIGHTS.dusk, smooth(ramp(f, B('sixhours'), B('sixhours') + 80)));
  if (['dovecote', 'accuse', 'laugh', 'dialogue', 'hook'].includes(S.id)) return { ...LIGHTS.dusk };
  return { ...LIGHTS.gold };
};

// ---------- staging (shared by story, main, colliders) ----------
export const BOARD_POS = [0, 3.0, 12.5];
export const STALL = { x: -2.6, z: -2.2 };
export const RING = { x: 3.4, z: 2.6 };
export const SON = { x: 6.3, z: 5.6 };
export const HOUSE = { x: -3.4, z: 17.8 };
export const PLATFORM_Y = 3.68;
export const COTE = { x: -1.55, y: 4.72, z: 16.6 };
export const PERCH = [COTE.x - 0.15, COTE.y + 0.01, COTE.z - 1.15];   // R2: the iron perch bar in FRONT of the cote — clear of the cote's own perched pigeons, in front of the gambler
const GAMBLER_STALL = { x: -2.2, z: -0.7 };        // in front of the counter
const BOOK_STALL = { x: -2.9, z: -2.78 };          // behind the counter
const PORCH_G = { x: HOUSE.x - 0.45, z: 14.8 };   // gambler at his door
const PORCH_B = { x: HOUSE.x - 1.9, z: 13.55 };   // bookmaker below the porch
const PLAT_G = { x: COTE.x - 0.03, z: COTE.z - 0.85 };   // R2: gambler on the platform just behind the perch bar — kneels facing the landed pigeon, card clear of the perch ledge
const PLAT_B = { x: COTE.x + 0.95, z: COTE.z - 0.35 };  // R2: bookmaker at the platform's east edge (by the ladder) — clear of the capsule insert framing

// ---------- walking paths (luckiest / follow) ----------
const walk = (f, a, b, p0, p1) => {
  const u = smooth(ramp(f, a, b));
  return { x: lerp(p0[0], p1[0], u), z: lerp(p0[1], p1[1], u), u };
};
export const gamblerWalk = (f) => walk(f, B('luckiest') + 6, E('luckiest') - 8, [-5.6, 2.6], [3.4, 3.3]);
export const bookieFlee1 = (f) => walk(f, B('luckiest') + 26, B('luckiest') + 78, [0.4, 2.0], [-3.8, -0.6]);
export const bookieFlee2 = (f) => walk(f, B('luckiest') + 20, B('luckiest') + 84, [1.9, 5.4], [5.8, 7.4]);
export const followG = (f) => walk(f, B('follow') + 4, E('follow') - 4, [0.2, 3.2], [0.0, 11.6]);
export const followB = (f) => walk(f, B('follow') + 4, E('follow') - 4, [1.25, 0.4], [1.05, 8.8]);

// ---------- the pigeon's journeys ----------
const pathYaw = (P, f) => {
  const a = P(f), b = P(Math.min(f + 2, TOTAL - 1));
  return Math.atan2(b[0] - a[0], b[2] - a[2]);
};
const sonPigPos = (f) => {
  const a = B('son'), e = E('son');
  const xs = kf([[a, SON.x - 0.32], [a + 52, SON.x - 0.32], [a + 68, 3.6], [a + 82, 0.5], [e, -13]], f);
  const ys = kf([[a, 1.04], [a + 52, 1.04], [a + 68, 3.2], [a + 82, 6.2], [e, 9.5]], f);
  const zs = kf([[a, SON.z + 0.38], [a + 52, SON.z + 0.38], [a + 68, 3.4], [a + 82, 0.5], [e, -5]], f);
  return [xs, ys, zs];
};
const flightPigPos = (f) => {
  // one smooth arc across the whole shot (smootherstep glide + a sine
  // bulge) — no key joints, so the tracking camera stays jerk-clean.
  const a = B('flight'), e = E('flight');
  const u = ramp(f, a, e), s = smooth(u), bulge = Math.sin(u * Math.PI);
  return [
    lerp(-16, 14, s),
    lerp(5.2, 3.4, s) + bulge * 1.5 + Math.sin((f - a) * 0.11) * 0.3,
    lerp(-5, 4, s) + bulge * 1.2,
  ];
};
const landPigPos = (f) => {
  const a = B('sixhours');
  const xs = kf([[a, 7], [a + 30, 2], [a + 52, -0.6], [a + 72, PERCH[0]], [E('sixhours'), PERCH[0]]], f);
  const ys = kf([[a, 8.5], [a + 30, 7.2], [a + 52, 5.9], [a + 72, PERCH[1]], [E('sixhours'), PERCH[1]]], f);
  const zs = kf([[a, 4], [a + 30, 10], [a + 52, 14.2], [a + 72, PERCH[2]], [E('sixhours'), PERCH[2]]], f);
  return [xs, ys, zs];
};
export const pigAt = (f) => {
  const S = shotAt(f).id;
  if (S === 'son') {
    const held = f < B('son') + 52;
    return { mode: 'fly', pos: sonPigPos(f), yaw: held ? 2.6 : pathYaw(sonPigPos, f), bank: 0, flap: held ? 0 : smooth(ramp(f, B('son') + 52, B('son') + 60)) };
  }
  if (S === 'flight') return { mode: 'fly', pos: flightPigPos(f), yaw: pathYaw(flightPigPos, f), bank: Math.sin((f - B('flight')) * 0.05) * 0.14, flap: 1 };
  if (S === 'sixhours') {
    const landed = f >= B('sixhours') + 72;
    return { mode: 'fly', pos: landPigPos(f), yaw: landed ? Math.PI + 0.2 : pathYaw(landPigPos, f), bank: 0, flap: landed ? 0 : (f > B('sixhours') + 62 ? 1 - smooth(ramp(f, B('sixhours') + 62, B('sixhours') + 74)) : 1) };
  }
  return { mode: 'off', pos: [0, -10, 0], yaw: 0, bank: 0, flap: 0 };
};

// ---------- horses ----------
export const horsesAt = (f) => {
  const S = shotAt(f).id;
  if (S === 'race') {
    const u = smooth(ramp(f, B('race') + 4, E('race') - 4));
    return { mode: 'race', xs: [lerp(-17, 8.5, u), lerp(-16.2, 9.4, u), lerp(-18.6, 10.8, u)] };
  }
  if (S === 'son') {
    const u = ramp(f, B('son'), E('son'));
    return { mode: 'walk', xs: [lerp(0.5, 6.5, u), lerp(-2.5, 3.5, u), lerp(-5.5, 0.5, u)] };
  }
  return { mode: 'off', xs: [0, 0, 0] };
};
// the horseman: still crawling along the road while the pigeon is home
export const riderAt = (f) => {
  if (shotAt(f).id !== 'sixhours') return null;
  const u = ramp(f, B('sixhours'), E('sixhours'));
  return { x: lerp(7.5, 4.5, u), z: lerp(17.4, 16.0, u) };
};

// ---------- body.js performance tracks ----------
const gamblerWink = winkTrack([{ a: 1118, b: 1130 }]);                 // end of the laugh, into the answer
const sonPose = poseWindows([{ a: 1250, b: 1302, mode: 'kneel1', inF: 6, outF: 7 }]);   // ties the capsule on
const gamblerPlatPose = poseWindows([{ a: 1540, b: 1588, mode: 'kneel1', inF: 6, outF: 7 }]); // takes the capsule off
const gamblerHookPose = poseWindows([{ a: 1608, b: 1699, mode: 'kneel1', inF: 6, outF: 1 }]); // R2 final: kneels before the hook board, pointing up at it
const bookTurn = turnTrack([{ f0: 838, dur: 16, dir: 1 }, { f0: 918, dur: 14, dir: -1 }]);     // searching the cote
const gamblerGaze = gazeTrack([
  { f: 0, look: -0.2, lookY: 0.05 },
  { f: 1454, look: 0.3, lookY: 0.62 },      // watching the sky for his pigeon
  { f: 1530, look: 0.1, lookY: 0.1 },
  { f: 1560, look: 0, lookY: -0.3 },        // down at the capsule in his hands
]);
const sonGaze = gazeTrack([
  { f: 1250, look: 0, lookY: -0.35 },       // down at the capsule
  { f: 1310, look: -0.2, lookY: 0.6 },      // up, following the pigeon away
]);
const micro = (f, seed) => 1.1 * Math.sin((f + seed * 5) * 0.037 + 1);
const head = (f, seed, tilt, look, lookY, facing = 0, squash = 0) => ({
  headTilt: q(tilt + micro(f, seed), 1), look: q(look, 2), lookY: q(lookY, 2), facing: q(facing, 2), squash: q(squash, 2),
});

// ---------- hero / focus ----------
const FOCUS = {
  payout: () => [GAMBLER_STALL.x, 1.3, GAMBLER_STALL.z],
  race: () => { const h = horsesAt(200); return [h.xs[2], 1.2, 0]; },
  champion: () => [RING.x, 1.1, RING.z],
  luckiest: () => { const w = gamblerWalk(380); return [w.x, 1.3, w.z]; },
  gold: () => [0.2, 1.3, 1.9],
  lastsecond: () => [STALL.x + 0.1, 1.05, STALL.z + 0.4],
  follow: () => { const w = followG(740); return [w.x, 1.3, w.z]; },
  dovecote: () => [COTE.x - 0.34, COTE.y - 0.06, COTE.z - 0.72],   // R2: the capsule pigeon on the perch (the insert subject)
  accuse: () => [PORCH_G.x, 1.35, PORCH_G.z],
  laugh: () => [PORCH_G.x, 1.45, PORCH_G.z],
  dialogue: () => [PORCH_G.x, 1.45, PORCH_G.z],
  son: () => [SON.x, 1.2, SON.z],
  flight: () => flightPigPos(1400),
  sixhours: () => [-1.65, 4.7, 15.55],   // R2: the perch-bar exchange point — pigeon, hands, capsule
  hook: () => BOARD_POS,
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id]();

// ---------- cameras: EVERY shot is a camrig track on a subject ----------
const raceKeys = () => {
  const a = B('race');
  // R2: track the no-name grey (xs[2]) past the finish post, then swing off
  // the track onto the bookmaker at the post — his stunned face ends the
  // shot at reaction scale (≥65% of frame width).
  const track = [0, 11, 22, 34, 45].map((d, i) => {
    const h = horsesAt(a + d);
    return { f: a + d, pos: [h.xs[2] - 3.2, 1.7, 7.6], look: [h.xs[2] + 0.8, 1.25, 0], fov: 40 - i * 0.6, ease: 'linear' };
  });
  const h52 = horsesAt(a + 52);
  return [...track,
    { f: a + 52, pos: [h52.xs[2] - 3.0, 1.68, 7.5], look: [h52.xs[2] + 1.4, 1.3, 1.2], fov: 37, ease: 'linear' },
    { f: a + 61, pos: [2.6, 1.64, 7.1], look: [4.6, 1.42, 3.2], fov: 34.5, ease: 'linear' },
    { f: a + 71, pos: [4.3, 1.55, 6.15], look: [5.45, 1.48, 3.65], fov: 32, ease: 'linear' },
    { f: a + 82, pos: [4.5, 1.52, 5.75], look: [5.58, 1.5, 3.62], fov: 30, ease: 'linear' },
    { f: a + 91, pos: [4.42, 1.51, 5.6], look: [5.6, 1.51, 3.6], fov: 29, ease: 'io' }];
};
const flightKeys = () => {
  const a = B('flight');
  return [0, 13, 26, 39, 52, 65, 78, 91, 104].map((d, i) => {
    const p = flightPigPos(a + d);
    return { f: a + d, pos: [p[0] - 2.9, p[1] + 1.15, p[2] + 3.5], look: [p[0], p[1], p[2]], fov: 36 - i * 0.4, ...(i === 8 ? { ease: 'io' } : { ease: 'linear' }) };
  });
};
const luckKeys = () => {
  const a = B('luckiest');
  return [0, 42, 84, 126].map((d, i) => {
    const w = gamblerWalk(a + d);
    return { f: a + d, pos: [w.x + 2.7, 1.7, w.z + 3.6], look: [w.x, 1.3, w.z], fov: 37 - i * 1.8, ...(i === 3 ? { ease: 'io' } : { ease: 'linear' }) };
  });
};
const followKeys = () => {
  const a = B('follow');
  return [0, 36, 72, 110].map((d, i) => {
    const g = followG(a + d), b = followB(a + d);
    const mx = (g.x + b.x) / 2, mz = (g.z + b.z) / 2;
    // behind-and-beside tracking: the pair walks NORTH up the lane
    // (x ~ 0..1.25, z increasing) — camera trails 3.55 behind + 0.85 east,
    // looking past them up the lane so both stack in depth in the 9:16 frame
    return { f: a + d, pos: [mx + 0.85, 1.82, mz - 3.55], look: [mx - 0.1, 1.3, mz + 1.2], fov: 38 - i * 1.8, ...(i === 3 ? { ease: 'io' } : { ease: 'linear' }) };
  });
};
const RIG_BY_ID = {
  payout: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('payout'), pos: [-0.35, 1.32, 2.05], look: [-2.22, 1.42, -0.85], fov: 36 },
    { f: B('payout') + 70, pos: [-0.55, 1.36, 1.8], look: [-2.24, 1.44, -0.9], fov: 34 },
    { f: E('payout'), pos: [-0.72, 1.4, 1.6], look: [-2.26, 1.46, -0.95], fov: 32, ease: 'io' }] }) },
  race: { cut: 'hard', raw: keysCam({ keys: raceKeys() }) },
  champion: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('champion'), pos: [1.3, 2.0, 7.2], look: [3.38, 0.98, 2.6], fov: 36 },
    { f: E('champion'), pos: [1.8, 1.8, 6.5], look: [3.4, 1.0, 2.6], fov: 32, ease: 'io' }] }) },
  luckiest: { cut: 'hard', raw: keysCam({ keys: luckKeys() }) },
  gold: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('gold'), pos: [1.0, 1.6, 5.6], look: [0.62, 1.25, 2.05], fov: 34 },
    { f: E('gold'), pos: [0.9, 1.55, 5.0], look: [0.6, 1.27, 2.05], fov: 30, ease: 'io' }] }) },
  lastsecond: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('lastsecond'), pos: [0.55, 1.72, 1.6], look: [-2.7, 1.08, -1.85], fov: 34 },
    { f: B('lastsecond') + 80, pos: [0.38, 1.66, 1.38], look: [-2.73, 1.06, -1.88], fov: 32 },
    { f: E('lastsecond'), pos: [0.22, 1.62, 1.2], look: [-2.75, 1.05, -1.9], fov: 30, ease: 'io' }] }) },
  follow: { cut: 'hard', raw: keysCam({ keys: followKeys() }) },
  dovecote: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('dovecote'), pos: [2.7, 3.3, 8.6], look: [-1.7, 4.35, 16.3], fov: 41 },
    { f: B('dovecote') + 80, pos: [0.4, 4.3, 11.8], look: [-1.8, 4.55, 16.0], fov: 35 },
    { f: B('dovecote') + 125, pos: [-2.15, 4.5, 13.95], look: [-1.87, 4.6, 15.9], fov: 31 },
    { f: E('dovecote'), pos: [-2.75, 4.22, 14.35], look: [-1.88, 4.62, 15.9], fov: 29, ease: 'io' }] }) },
  accuse: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('accuse'), pos: [-7.15, 1.66, 11.15], look: [-4.72, 1.36, 14.35], fov: 34 },
    { f: E('accuse'), pos: [-6.9, 1.62, 11.5], look: [-4.72, 1.36, 14.35], fov: 30, ease: 'io' }] }) },
  laugh: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('laugh'), pos: [-5.75, 1.72, 11.15], look: [PORCH_G.x - 0.05, 1.5, PORCH_G.z], fov: 31 },
    { f: E('laugh'), pos: [-5.6, 1.7, 11.45], look: [PORCH_G.x - 0.05, 1.5, PORCH_G.z], fov: 27, ease: 'io' }] }) },
  dialogue: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('dialogue'), pos: [-5.5, 1.74, 11.5], look: [PORCH_G.x, 1.47, PORCH_G.z], fov: 29 },
    { f: E('dialogue'), pos: [-5.35, 1.71, 11.8], look: [PORCH_G.x, 1.47, PORCH_G.z], fov: 25, ease: 'io' }] }) },
  son: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('son'), pos: [8.7, 1.45, 10.9], look: [SON.x, 1.1, SON.z], fov: 35 },
    { f: B('son') + 50, pos: [7.9, 1.35, 9.3], look: [SON.x - 0.25, 1.1, SON.z + 0.3], fov: 32 },
    { f: E('son'), pos: [7.5, 1.8, 8.8], look: [SON.x - 1.1, 2.4, SON.z - 0.6], fov: 28, ease: 'io' }] }) },
  flight: { cut: 'hard', raw: keysCam({ keys: flightKeys() }) },
  sixhours: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('sixhours'), pos: [1.6, 6.0, 11.0], look: [-1.2, 4.9, 15.9], fov: 37 },
    { f: B('sixhours') + 52, pos: [0.3, 5.5, 12.3], look: [-1.65, 5.0, 15.6], fov: 34 },
    { f: B('sixhours') + 78, pos: [-0.4, 5.25, 13.3], look: [-1.64, 4.64, 15.55], fov: 32 },
    { f: B('sixhours') + 110, pos: [-0.55, 5.15, 13.1], look: [-1.66, 4.6, 15.55], fov: 31 },
    { f: E('sixhours'), pos: [-0.7, 5.2, 12.95], look: [-1.63, 4.58, 15.6], fov: 31, ease: 'io' }] }) },
  hook: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('hook'), pos: [1.45, 2.45, 25.45], look: [0.02, 2.82, 12.55], fov: 44 },
    { f: E('hook'), pos: [1.25, 2.3, 24.65], look: [0.02, 2.84, 12.55], fov: 42.5, ease: 'io' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: B('lastsecond') + 82, a: 0.03 }, { f: B('champion') + 44, a: 0.025 }],
  sigma: 3.6, smoothRadius: 14, fovSigma: 1.6,
});
export const camAt = (f) => RIG.camAt(f);
export const RIG_META = {
  kicks: RIG.declared.kicks, hardCuts: RIG.declared.hardCuts,
  blends: SHOTS.filter((s) => RIG_BY_ID[s.id].cut === 'blend').map((s) => ({ a: s.a - Math.floor(RIG_BY_ID[s.id].blend / 2), b: s.a + Math.ceil(RIG_BY_ID[s.id].blend / 2) })),
  whips: RIG.declared.whips,
  samples: RIG.samples,
};
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  let hp = heroPosAt(f), cinf = 2.2;
  if (['flight', 'champion', 'luckiest', 'follow'].includes(S.id)) cinf = 1.3;
  if (['dialogue', 'laugh', 'lastsecond', 'dovecote', 'accuse'].includes(S.id)) cinf = 3.6;
  if (S.id === 'hook') cinf = 2.6;
  // R2 race: focus rides the winning grey, then snaps to the bookmaker's
  // face for the reaction push-in.
  if (S.id === 'race') { cinf = 1.3; hp = f < B('race') + 58 ? [horsesAt(f).xs[2], 1.2, 0.9] : [5.6, 1.5, 3.6]; }
  // R2 sixhours: focus locked on the perch exchange point; the close phase
  // gets a stronger blur so the untying reads against a soft roof.
  if (S.id === 'sixhours') { cinf = f > B('sixhours') + 70 ? 3.0 : 1.6; hp = [-1.65, 4.7, 15.55]; }
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = {
    set: S.set,
    boardHook: 0,
    pig: pigAt(f),
    horses: horsesAt(f),
    rider: riderAt(f),
  };
  if (S.id === 'hook') W.boardHook = f < B('hook') + 20 ? smooth(ramp(f, B('hook') + 2, B('hook') + 20)) : 1;  // held at FULL opacity to the literal last frame
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return { dustRate: S.set === 'sky' ? 0.12 : (S.id === 'hook' ? 0.3 : 0.5) };
};
export const fxAt = () => [];

// ---------- cast (single source for actors AND colliders) ----------
const TINT = { gold: '#ffedd6', dusk: '#ffd9b0' };
const tintFor = (S) => ['dovecote', 'accuse', 'laugh', 'dialogue', 'hook', 'follow'].includes(S.id) ? TINT.dusk : TINT.gold;
export const OUTFITS = {
  gambler: { jacket: '#3f5a3a', pants: '#2e2a24', boots: '#1d140c', hat: 'tophat', skin: '#fbf7ef', moustache: '#cfd4d8' },
  bookmaker: { jacket: '#7a4a22', pants: '#33302c', boots: '#201812', hat: 'cap', cap: '#4a3220', skin: '#fbf7ef', moustache: '#3a2418' },
  bookie2: { jacket: '#5d2432', pants: '#2a2f3a', boots: '#17120d', hat: 'cap', cap: '#8c2f3a', skin: '#fbf7ef', moustache: '#2a1a10' },
  bookie3: { jacket: '#44586b', pants: '#2c3038', boots: '#1c1712', hat: 'cap', cap: '#5d6a2e', skin: '#fbf7ef' },
  son: { jacket: '#31597f', pants: '#2c3038', boots: '#1c1712', hat: 'cap', cap: '#274b6e', skin: '#fbf7ef' },
  champion: { jacket: '#8c2f2f', pants: '#3a2c20', boots: '#201812', hat: 'hair', hair: '#241a12', skin: '#fbf7ef', build: 'stout' },
  villager1: { jacket: '#6b543a', pants: '#33302c', boots: '#201812', hat: 'hair', hair: '#241a12', skin: '#fbf7ef' },
  villager2: { jacket: '#54683c', pants: '#2c3038', boots: '#1c1712', hat: 'cap', cap: '#71563a', skin: '#fbf7ef', moustache: '#4a3426' },
  villager3: { jacket: '#71563a', pants: '#33302c', boots: '#201812', hat: 'bonnet', skin: '#fbf7ef' },
};
export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, z, extra = {}) => out.push({ id, x, y: extra.y ?? 0, z, r: extra.r ?? 0.32, ground: extra.ground ?? 0,
    actor: (T) => ({ key: 'lhx' + JSON.stringify(o) + JSON.stringify(opts) + (extra.y ?? 0), draw: (p) => T.bodyFront(p, o, opts), x, y: extra.y ?? 0, z, ground: extra.ground ?? 0, tint, ...extra }) });
  const GG = gamblerGaze(f);
  switch (S.id) {
    case 'payout': {
      // OPENS mid-action: the bookmaker counts out a heavy pouch across the
      // counter; the gambler takes it with a smug little nod.
      std('gambler', OUTFITS.gambler, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 11), seed: 11, prop: ['point', 0.35],
        ...head(f, 11, -1.5, -0.25, 0.0, -0.2) }, GAMBLER_STALL.x, GAMBLER_STALL.z, { yaw: -0.35 });
      std('bookmaker', OUTFITS.bookmaker, { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 12), seed: 12, prop: ['point', -0.4],
        ...head(f, 12, 1, 0.3, -0.05, 0.2) }, BOOK_STALL.x, BOOK_STALL.z, { yaw: 0.3 });
      std('villager1', OUTFITS.villager1, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 13), seed: 13,
        ...head(f, 13, -2, -0.3, 0.25, 0) }, -4.75, 0.5, { yaw: -0.5 });
      std('villager2', OUTFITS.villager2, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 14), seed: 14,
        ...head(f, 14, -2, 0.35, 0.2, 0) }, -4.3, 1.9, { yaw: 0.55 });
      break;
    }
    case 'race': {
      // R2 REACTION: the bookmaker waits at the finish post — the camera
      // leaves the horses and lands on his stunned face as the no-name
      // grey wins by lengths.
      std('bookmaker', OUTFITS.bookmaker, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 12), seed: 12,
        ...head(f, 12, -2.5, -0.35, 0.15, -0.2) }, 5.6, 3.6, { yaw: -0.35 });
      break;
    }
    case 'champion': {
      const fallU = smooth(ramp(f, B('champion') + 34, B('champion') + 56));
      std('champion', OUTFITS.champion, { expr: fallU > 0.5 ? 'dazed' : 'stern', mode: fallU > 0.04 ? 'fall' : 'stand', phase: q(fallU, 2),
        blink: blinkAt(f, 21), seed: 21, ...head(f, 21, 0, 0.1, 0.05, 0) }, RING.x, RING.z, { yaw: -0.4, s: 1.22, r: 0.4 });
      std('gambler', OUTFITS.gambler, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 11), seed: 11, prop: ['point', -0.3],
        ...head(f, 11, -1, 0.3, 0.05, 0.25) }, 1.15, 5.6, { yaw: -0.5 });
      std('villager1', OUTFITS.villager1, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 13), seed: 13,
        ...head(f, 13, -2, -0.2, 0.3, 0) }, 5.9, 5.5, { yaw: 0.6 });
      std('villager3', OUTFITS.villager3, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 15), seed: 15,
        ...head(f, 15, -1.5, 0.25, 0.25, 0) }, -0.6, 4.6, { yaw: 0.4 });
      break;
    }
    case 'luckiest': {
      const w = gamblerWalk(f), f1 = bookieFlee1(f), f2 = bookieFlee2(f);
      std('gambler', OUTFITS.gambler, { expr: 'smile', mode: 'stroll', phase: q((f * 0.014) % 1, 2), blink: blinkAt(f, 11), seed: 11,
        ...head(f, 11, -1, 0.15, 0.1, 0.1) }, w.x, w.z, { yaw: 0.5 });
      std('bookie2', OUTFITS.bookie2, { expr: 'nervous', mode: 'stroll', phase: q((f * 0.02) % 1, 2), blink: blinkAt(f, 16), seed: 16,
        ...head(f, 16, 1, -0.4, 0, -0.3) }, f1.x, f1.z, { yaw: -0.9 });
      std('bookie3', OUTFITS.bookie3, { expr: 'nervous', mode: 'stroll', phase: q((f * 0.021) % 1, 2), blink: blinkAt(f, 17), seed: 17,
        ...head(f, 17, 1, 0.4, 0, 0.3) }, f2.x, f2.z, { yaw: 0.9 });
      std('villager2', OUTFITS.villager2, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 14), seed: 14,
        ...head(f, 14, -1.5, -0.3, 0.2, 0) }, -1.8, 6.6, { yaw: 0.3 });
      break;
    }
    case 'gold': {
      // R2 exchange framing (mirrors the approved moonrent pair-3): the two
      // men stand close, faces big at the frame edges, hands + gold meeting
      // at centre as the camera pushes in.
      std('gambler', OUTFITS.gambler, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 11), seed: 11, prop: ['point', 0.55],
        ...head(f, 11, -1.5, 0.3, 0.0, 0.3) }, 0.2, 1.8, { yaw: 0.4 });
      std('villager1', OUTFITS.villager1, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 13), seed: 13, prop: ['point', 0.75],
        ...head(f, 13, -1, -0.45, 0.05, -0.35) }, 1.05, 2.35, { yaw: -0.55 });
      std('villager2', OUTFITS.villager2, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 14), seed: 14,
        ...head(f, 14, -1, -0.2, 0.15, 0) }, -1.15, 3.1, { yaw: 0.5 });
      std('villager3', OUTFITS.villager3, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 15), seed: 15,
        ...head(f, 15, -1, 0.3, 0.15, 0) }, 2.6, 3.3, { yaw: -0.2 });
      break;
    }
    case 'lastsecond': {
      // the INSERT beat: his hand slaps the slip + coins down a breath
      // before the bell — the bookmaker freezes, caught mid-close.
      const slam = f >= B('lastsecond') + 82;
      std('gambler', OUTFITS.gambler, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 11), seed: 11, prop: ['point', slam ? 0.95 : 0.45],
        ...head(f, 11, slam ? 2 : 0.5, -0.2, slam ? -0.25 : -0.1, -0.15), squash: slam && f < B('lastsecond') + 90 ? 0.1 : 0 }, GAMBLER_STALL.x, GAMBLER_STALL.z, { yaw: -0.3 });
      std('bookmaker', OUTFITS.bookmaker, { expr: slam ? 'shock' : 'stern', mode: 'stand', blink: blinkAt(f, 12), seed: 12, prop: ['point', -0.55],
        ...head(f, 12, slam ? -2 : 0, 0.3, slam ? 0.15 : -0.05, 0.2) }, BOOK_STALL.x, BOOK_STALL.z, { yaw: 0.3 });
      break;
    }
    case 'follow': {
      const wg = followG(f), wb = followB(f);
      std('gambler', OUTFITS.gambler, { expr: 'neutral', mode: 'stroll', phase: q((f * 0.014) % 1, 2), blink: blinkAt(f, 11), seed: 11,
        ...head(f, 11, 0, 0.1, 0.05, 0) }, wg.x, wg.z, { yaw: 0.12 });
      std('bookmaker', OUTFITS.bookmaker, { expr: 'stern', mode: 'stroll', phase: q((f * 0.015 + 0.4) % 1, 2), blink: blinkAt(f, 12), seed: 12,
        ...head(f, 12, 2.5, -0.15, -0.05, -0.1) }, wb.x, wb.z, { yaw: -0.1 });
      break;
    }
    case 'dovecote': {
      const Tn = bookTurn(f);
      std('bookmaker', OUTFITS.bookmaker, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 12), seed: 12, prop: ['point', 0.5],
        ...head(f, 12, -2.5, kf([[800, 0.3], [838, 0.3], [854, -0.35], [918, -0.35], [932, 0.2], [970, 0.2]], f), 0.3, 0), squash: Tn.squash },
        PLAT_B.x, PLAT_B.z, { y: PLATFORM_Y, ground: PLATFORM_Y, blob: false, yaw: -0.4 + Tn.yaw });
      break;
    }
    case 'accuse': {
      std('bookmaker', OUTFITS.bookmaker, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 12), seed: 12, prop: ['point', 0.9],
        ...head(f, 12, 0, -0.45, 0.1, -0.35) }, PORCH_B.x, PORCH_B.z, { yaw: -0.55 });
      std('gambler', OUTFITS.gambler, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 11), seed: 11,
        ...head(f, 11, 0, 0.45, 0.05, 0.35) }, PORCH_G.x, PORCH_G.z, { yaw: 0.55 });
      break;
    }
    case 'laugh': {
      let GP = T.faceP('laugh', 11); GP.blush = 0;
      const winkK = gamblerWink(f);
      if (winkK > 0) GP = T.blendFaceP(GP, T.faceP('wink', 11), winkK);
      std('gambler', OUTFITS.gambler, { expr: 'laugh', exprP: GP, mode: 'stand', blink: blinkAt(f, 11), seed: 11, headTilt: q(-3 + micro(f, 11), 1), look: q(0.4, 2), lookY: q(0.05, 2) }, PORCH_G.x, PORCH_G.z, { yaw: 0.5 });
      std('bookmaker', OUTFITS.bookmaker, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 12), seed: 12,
        ...head(f, 12, 0, -0.4, 0.05, -0.3) }, PORCH_B.x, PORCH_B.z, { yaw: -0.5 });
      break;
    }
    case 'dialogue': {
      // THE dialogue beat: the gambler PERFORMS his line — mouth driven by
      // the stem inside the speak segment, closed outside it; the bookmaker
      // only listens (his mouth never opens).
      std('gambler', OUTFITS.gambler, { mode: 'stand', blink: blinkAt(f, 11), seed: 11, look: 0.35, ...speakFace('smile', f) }, PORCH_G.x, PORCH_G.z, { yaw: 0.45 });
      std('bookmaker', OUTFITS.bookmaker, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 12), seed: 12,
        ...head(f, 12, 0, -0.35, 0.05, -0.3) }, PORCH_B.x, PORCH_B.z, { yaw: -0.5 });
      break;
    }
    case 'son': {
      const SP = sonPose(f), SG = sonGaze(f);
      const released = f >= B('son') + 52;
      std('son', OUTFITS.son, { expr: released ? 'smile' : 'neutral', mode: SP.mode, squash: SP.squash, blink: blinkAt(f, 31), seed: 31,
        prop: released ? ['point', 0.85] : null,
        ...head(f, 31, released ? -2 : 2, SG.look, SG.lookY, -0.15) }, SON.x, SON.z, { yaw: -0.35 });
      break;
    }
    case 'flight': break;   // the pigeon alone against the sky
    case 'sixhours': {
      const KP = gamblerPlatPose(f);
      std('gambler', OUTFITS.gambler, { expr: f > B('sixhours') + 96 ? 'grin' : 'smile', mode: KP.mode, squash: KP.squash, blink: blinkAt(f, 11), seed: 11,
        prop: f >= B('sixhours') + 96 && KP.mode === 'stand' ? ['point', -0.4] : null,
        ...head(f, 11, -1.5, GG.look, GG.lookY, -0.2) }, PLAT_G.x, PLAT_G.z, { y: PLATFORM_Y, ground: PLATFORM_Y, blob: false, yaw: -0.5 });
      break;
    }
    case 'hook': {
      // R2 FINAL: character beat + hook board together — the gambler kneels
      // in the foreground pointing up at the board as it fades in behind
      // him; his head stays below the panel, the text fully readable.
      const HP = gamblerHookPose(f);
      std('gambler', OUTFITS.gambler, { expr: 'grin', mode: HP.mode, squash: HP.squash, blink: blinkAt(f, 11), seed: 11, prop: ['point', 0.12],
        ...head(f, 11, -2, 0.1, 0.5, 0) }, 0.45, 19.3, { yaw: 0.1 });
      break;
    }
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity: statics, dynamics, ground (LIBRARY v3 gate data) ----------
export const STATICS = [
  SOL.obb(STALL.x, STALL.z + 0.35, 0, 1.6, 0.5, { h: 1.02, id: 'counter' }),
  ...[[-1.5, -0.5], [1.5, -0.5], [-1.5, 0.7], [1.5, 0.7]].map(([px, pz]) => SOL.circle(STALL.x + px, STALL.z + pz, 0.09, { h: 2.9, id: 'stallpost' })),
  ...[[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]].map(([px, pz]) => SOL.circle(RING.x + px, RING.z + pz, 0.08, { h: 1.05, id: 'ringpost' })),
  SOL.obb(-4.6, 4.6, 0, 1.35, 0.28, { h: 0.5, id: 'bench' }),
  SOL.obb(4.8, 4.6, 0, 1.35, 0.28, { h: 0.5, id: 'bench' }),
  SOL.circle(BOARD_POS[0] - 2.55, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  SOL.circle(BOARD_POS[0] + 2.55, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  SOL.circle(COTE.x, COTE.z, 0.1, { h: 5.2, id: 'cotepost' }),
  SOL.circle(4, -2.9, 0.11, { h: 3.1, id: 'finishpost' }),
  SOL.circle(4, 2.9, 0.11, { h: 3.1, id: 'finishpost' }),
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
