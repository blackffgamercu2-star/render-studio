// Shot plan for "अपनी परछाई बेचने वाला आदमी" — shadowplay-hindi (Salted
// Mine V3 style lock: painted 3D world, flat round-white-head card
// characters, reference camera grammar — every clause a new shot,
// push-ins, inserts, word-by-word captions; body.js actions; speak.js
// performed dialogue).
// ONE set: an open-air shadow-theatre ground at night — a big cotton
// screen (z=-9) lit from behind by a great oil lamp, the puppeteer's
// corner, audience dari mats in front. The hero's giant shadow ON the
// screen is the visual heart: a custom-drawn demon-king silhouette
// whose arms wave and head turns while the real hero hides behind.
// Voice stem: Google AI Studio Puck (series voice), 60.531 s, 30 fps,
// TOTAL 1816; line timings from timing.json (faster-whisper small,
// char-mapped onto the script). Scene changes ONLY at line boundaries:
//   L1 hook (shadow)   L7 housefull      L13 the reveal
//   L2 the tall lazy   L8 monthly rent   L14 tickets still sell
//   L3 puppeteer comes L9 wooden demon   L15 the tag
//   L4 the deal        L10 the flop      L16 THE LINE (performed)
//   L5 the lamp insert L11 double pay    L17 hook board (candle)
//   L6 the performance L12 the wind
// GRADE: Night Lamp — the screen lamp is the key practical, warm
// against deep-blue night; boards/text never graded.
import { M, blinkAt, q, clamp, lerp, ramp, kf } from './motion.js';
import { buildRig, pushInCam, keysCam } from './camrig.js';
import { poseWindows, turnTrack, winkTrack } from './body.js';
import * as SOL from './solid.js';
import * as T from './toon.js';
import * as SPK from './speak.js';
import { SPEAK_DATA } from './speakdata.js';

export const FPS = 30, TOTAL = 1816, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 108, light: 'stage' },
  { id: 'tall', a: 109, b: 209, light: 'night' },
  { id: 'arrival', a: 210, b: 372, light: 'night' },
  { id: 'deal', a: 373, b: 492, light: 'night' },
  { id: 'lamp', a: 493, b: 611, light: 'stage' },
  { id: 'perform', a: 612, b: 718, light: 'stage' },
  { id: 'housefull', a: 719, b: 805, light: 'stage' },
  { id: 'rent', a: 806, b: 934, light: 'night' },
  { id: 'puppet', a: 935, b: 1038, light: 'night' },
  { id: 'flop', a: 1039, b: 1130, light: 'stage' },
  { id: 'recall', a: 1131, b: 1232, light: 'night' },
  { id: 'wind', a: 1233, b: 1325, light: 'stage' },
  { id: 'reveal', a: 1326, b: 1411, light: 'stage' },
  { id: 'tickets', a: 1412, b: 1538, light: 'night' },
  { id: 'tag', a: 1539, b: 1586, light: 'night' },
  { id: 'dialogue', a: 1587, b: 1690, light: 'night' },
  { id: 'hookboard', a: 1691, b: 1815, light: 'night' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights / mood grades ----------
export const LIGHTS = {
  night: { az: 208, el: 36, sky: '#33477a', ground: '#131a28', hemi: 0.58, sun: '#b9cdf5', sunI: 0.85, fog: '#141e33', fogNear: 14, fogFar: 110,
    skyTop: '#0a1226', skyHor: '#2c4066', sunDisc: '#000000', sunSize: 0, sat: 1.08, vig: 0.32, shadowExt: 20, aurora: 0, gain: '#ffd9ae',
    waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
  stage: { az: 208, el: 36, sky: '#33477a', ground: '#131a28', hemi: 0.52, sun: '#b9cdf5', sunI: 0.8, fog: '#141e33', fogNear: 14, fogFar: 110,
    skyTop: '#0a1226', skyHor: '#2c4066', sunDisc: '#000000', sunSize: 0, sat: 1.09, vig: 0.34, shadowExt: 20, aurora: 0, gain: '#ffcf96',
    waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

// ---------- staging ----------
// The hook board stands by the entrance path, left of the mats; its
// transform is mirrored in boards.json — keep in sync.
export const BOARD_POS = [-3.3, 1.95, -5.9];
export const SIGN_POS = BOARD_POS;
export const LAMP_POS = [0, 1.7, -10.8];
export const gunAt = (f) => ({ k: 0, x: 0, y: 0, z: 0 });

// cast anchors per shot (single source of truth)
export const heroAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'perform': case 'wind': return { x: 0, z: -9.95, y: 0.55, ground: 0.55 };
    // R2 opening: the hero stands IN FRONT of the screen (audience
    // side), big in frame, his demon shadow looming on the cloth
    // directly behind him — he is no longer hidden for the first line.
    case 'hook': return { x: -0.9, z: -7.7 };
    case 'tall': return { x: -3.85, z: -8.15 };
    case 'arrival': return { x: -3.85, z: -8.15 };
    case 'deal': return { x: 2.1, z: -9.75, y: 0.55, ground: 0.55 };
    // R2 lamp insert: he kneels on the platform LEFT of the lamp —
    // inside the wide start of the insert shot, fully OUT of the
    // tight end framing (checked against the end key's cone), so
    // no face is ever cropped at an edge.
    case 'lamp': return { x: -1.7, z: -9.9, y: 0.55, ground: 0.55 };
    case 'housefull': case 'flop': return { x: 0, z: -9.95, y: 0.55, ground: 0.55 };
    case 'rent': return { x: 2.55, z: -7.65 };
    case 'recall': return { x: -4.9, z: -6.4, y: 0.42, ground: 0.42 };
    case 'reveal': return { x: 0, z: -9.7, y: 0.55, ground: 0.55 };
    case 'tickets': case 'tag': case 'dialogue': return { x: 0.9, z: -7.55 };
    // R2 final: the hero kneels in the FOREGROUND between camera and
    // board (v1 had him half-cropped at the frame's left edge).
    case 'hookboard': return { x: -2.95, z: 0.5 };
    default: return { x: 0, z: -3 };
  }
};
export const puppAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'arrival': { const u = smooth(ramp(f, 210, 291)); return { x: lerp(6.4, 4.35, u), z: lerp(-4.6, -6.9, u) }; }
    case 'deal': return { x: 3.25, z: -9.6, y: 0.55, ground: 0.55 };
    case 'lamp': return { x: 4.85, z: -6.8 };
    case 'perform': case 'hook': return { x: 3.1, z: -7.45 };
    case 'rent': return { x: 3.1, z: -7.3 };
    case 'puppet': return { x: 3.05, z: -7.5 };
    case 'flop': return { x: 5.3, z: -7.9 };
    case 'recall': return { x: -4.05, z: -5.45 };
    case 'reveal': return { x: 3.3, z: -7.45 };
    case 'tickets': return { x: 2.15, z: -7.45 };
    case 'dialogue': return { x: 2.6, z: -7.78 };
    case 'hookboard': return { x: -1.15, z: -6.9 };
    default: return { x: 14, z: 8 };
  }
};
// audience rows on the mats (fronts for reaction shots, backs for
// screen shots) — fixed seats, the flop shot simply seats fewer.
const SEATS1 = [[-2.6, -4.7], [-1.3, -4.7], [0.2, -4.7], [1.5, -4.7], [2.8, -4.7]];
const SEATS2 = [[-3.1, -6.0], [-1.8, -6.0], [-0.5, -6.0], [1.0, -6.0], [2.3, -6.0], [3.4, -6.0]];
const SEATS3 = [[-2.2, -7.25], [-0.9, -7.25], [0.6, -7.25], [1.9, -7.25]];
export const seatsAt = (f) => {
  const S = shotAt(f);
  if (S.id === 'flop') return [...SEATS1.slice(0, 3), ...SEATS2.slice(1, 4)];
  return [...SEATS1, ...SEATS2, ...SEATS3];
};

// ---------- hero / focus ----------
const FOCUS = {
  hook: () => [-0.85, 1.62, -7.7],
  tall: () => { const h = heroAt(160); return [h.x, 1.6, h.z]; },
  arrival: () => [0.4, 1.5, -7],
  deal: () => [2.7, 1.6, -9.6],
  lamp: () => [...LAMP_POS],
  perform: () => [0, 2.2, -9],
  housefull: () => [0.2, 0.8, -4.7],
  rent: () => [2.7, 1.2, -7.5],
  puppet: () => [3.95, 0.95, -8.35],
  flop: () => [0, 2.0, -9],
  recall: () => [-4.5, 1.1, -6.0],
  wind: () => [0, 2.2, -9],
  reveal: () => [0, 1.9, -9.7],
  tickets: () => [1.5, 1.3, -7.55],
  tag: () => { const h = heroAt(1560); return [h.x, 1.55, h.z]; },
  dialogue: () => { const h = heroAt(1640); return [h.x, 1.52, h.z]; },
  hookboard: () => [...BOARD_POS],
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id]();

// ---------- cameras: EVERY shot is a camrig track on a subject ----------
const heroPos = (f) => { const h = heroAt(f); return [h.x, h.y || 0, h.z]; };
const RIG_BY_ID = {
  // hook (R2 OPENING): the hero himself fills frame 0 — LOW camera
  // over the mats, the tall man BIG in front of the glowing screen,
  // arm raised at the demon shadow looming on the cloth behind him;
  // the push-in runs from the first frame (V3 grammar).
  hook: { cut: 'hard', raw: keysCam({ keys: [
    { f: 0, pos: [0.52, 0.92, -4.65], look: [-0.7, 1.62, -7.7], fov: 39 },
    { f: 108, pos: [0.38, 1.0, -4.95], look: [-0.72, 1.66, -7.7], fov: 36, ease: 'surge' }] }) },
  // tall: the laziest man in the village, leaning on the screen pole,
  // half asleep while everyone else works — push-in on the yawn, his
  // face growing past half the frame width (R2 scale).
  tall: { cut: 'hard', raw: pushInCam({ subject: heroPos, a: 109, b: 209, d0: 4.4, d1: 3.05, h0: 1.62, h1: 1.55, lookOff: [0, 1.58, 0], fov0: 38, fov1: 33,
    dir: () => [0.5, 0.87] }) },
  // arrival: the puppeteer enters with his basket, measuring the tall
  // man's shadow against the screen — camera tracks his walk-in at
  // medium-close (R2 tightening).
  arrival: { cut: 'hard', raw: keysCam({ keys: [
    { f: 210, pos: [3.2, 1.55, 0.4], look: [5.0, 1.42, -5.4], fov: 39 },
    { f: 372, pos: [2.4, 1.5, -1.2], look: [3.9, 1.48, -6.85], fov: 35, ease: 'surge' }] }) },
  // deal: behind the screen's edge — a handshake and the first coin in
  // warm lamp light, pushed closer than v1.
  deal: { cut: 'hard', raw: keysCam({ keys: [
    { f: 373, pos: [5.45, 1.7, -13.9], look: [2.68, 1.33, -9.68], fov: 38 },
    { f: 492, pos: [5.21, 1.65, -13.52], look: [2.66, 1.31, -9.68], fov: 37, ease: 'surge' }] }) },
  // lamp INSERT (R2): behind the screen — starts on the hero kneeling
  // to light the great lamp, then pushes PAST him until the lamp alone
  // fills the frame. No face survives at any edge: the hero stands
  // left of the lamp and exits frame-left as the push tightens (the
  // v1 half-crop at f560 is fixed by geometry, not by hope).
  lamp: { cut: 'hard', raw: keysCam({ keys: [
    { f: 493, pos: [2.9, 1.7, -13.6], look: [-0.45, 1.35, -10.3], fov: 39 },
    { f: 611, pos: [1.15, 1.6, -13.3], look: [0.05, 1.6, -10.8], fov: 31, ease: 'surge' }] }) },
  // perform (R2 ACTION): FRONT close on the cloth — the demon shadow
  // huge as it waves, turns, roars; audience backs ride as a dark
  // strip along the bottom of the frame.
  perform: { cut: 'hard', raw: keysCam({ keys: [
    { f: 612, pos: [-0.5, 1.78, -1.5], look: [0.08, 2.32, -9], fov: 40 },
    { f: 718, pos: [-0.32, 1.7, -2.95], look: [0.03, 2.38, -9], fov: 34.5, ease: 'surge' }] }) },
  // housefull (R2 REACTION): the push-in lives on kid1's face ALONE —
  // shock melting into laughter, the face growing past 65% of frame
  // width. The rest of the crowd is seated out of the tight cone
  // (v1 framed a giant cropped head at the right edge).
  housefull: { cut: 'hard', raw: keysCam({ keys: [
    { f: 719, pos: [1.45, 0.95, -7.1], look: [0.24, 0.8, -4.72], fov: 37 },
    { f: 805, pos: [0.78, 0.88, -6.38], look: [0.21, 0.79, -4.7], fov: 31, ease: 'surge' }] }) },
  // rent: the month's shadow-rent counted coin by coin into his palm —
  // a tighter two-shot than v1.
  rent: { cut: 'hard', raw: keysCam({ keys: [
    { f: 806, pos: [0.7, 1.52, -3.85], look: [2.8, 1.14, -7.55], fov: 37 },
    { f: 934, pos: [0.85, 1.5, -4.1], look: [2.82, 1.12, -7.55], fov: 35, ease: 'surge' }] }) },
  // puppet INSERT (R2): the wooden demon ALONE on its crate — built
  // screen-size (s 0.72), painted, jointed, utterly stiff. A pure
  // object insert like V3's dynamite frame: no character in frame
  // (v1 had the puppeteer's cropped torso slab down the left edge).
  puppet: { cut: 'hard', raw: keysCam({ keys: [
    { f: 935, pos: [2.45, 1.42, -5.15], look: [3.95, 1.28, -8.33], fov: 32 },
    { f: 1038, pos: [2.62, 1.34, -5.6], look: [3.95, 1.3, -8.33], fov: 30, ease: 'surge' }] }) },
  // flop: a TINY stiff shadow stands frozen mid-screen; bored backs,
  // empty mats — the camera drifts like the crowd's attention. The
  // wide emptiness is the joke; kept near v1, a touch tighter.
  flop: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1039, pos: [-0.7, 1.6, -1.6], look: [0.1, 2.08, -9], fov: 39 },
    { f: 1130, pos: [-0.2, 1.54, -2.2], look: [0.05, 2.05, -9], fov: 36, ease: 'surge' }] }) },
  // recall: the puppeteer on his knees at the bench, TWO coin stacks —
  // the lazy man sits up, interested at last. Tighter than v1.
  recall: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1131, pos: [-2.35, 1.48, -3.35], look: [-4.5, 1.0, -6.1], fov: 38 },
    { f: 1232, pos: [-2.7, 1.42, -3.9], look: [-4.52, 1.02, -6.08], fov: 34, ease: 'surge' }] }) },
  // wind: the show again — then the gust. The camera holds the screen
  // as the cloth billows, tears free and sails out of frame.
  wind: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1233, pos: [0.45, 1.72, -1.1], look: [0, 2.28, -9], fov: 40 },
    { f: 1325, pos: [0.28, 1.64, -2.2], look: [0, 2.3, -9], fov: 36, ease: 'surge' }] }) },
  // reveal (R2): no cloth, no demon — just the lazy man himself, BIG
  // between the bare poles (he fills ~85% of frame height by the end),
  // the crowd's backs turning up at him along the bottom.
  reveal: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1326, pos: [-0.45, 1.68, -2.1], look: [0, 1.9, -9.66], fov: 38 },
    { f: 1411, pos: [-0.3, 1.6, -3.55], look: [0, 1.86, -9.68], fov: 30, ease: 'surge' }] }) },
  // tickets: the secret is out and the bowl still fills — the hero
  // takes a bow, the puppeteer counts, everyone laughs. Tighter.
  tickets: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1412, pos: [1.55, 1.55, -2.35], look: [1.55, 1.29, -7.55], fov: 38 },
    { f: 1538, pos: [1.55, 1.52, -2.7], look: [1.55, 1.28, -7.55], fov: 38, ease: 'surge' }] }) },
  tag: { cut: 'hard', raw: pushInCam({ subject: heroPos, a: 1539, b: 1586, d0: 3.3, d1: 2.5, h0: 1.6, h1: 1.56, lookOff: [0, 1.52, 0], fov0: 34, fov1: 30,
    dir: () => [0.4, 0.92] }) },
  // dialogue: the performed line — a slow push into the hero's face
  // (ends ~70% of frame width); the camera HOLDS on the speaker.
  dialogue: { cut: 'hard', raw: pushInCam({ subject: heroPos, a: 1587, b: 1690, d0: 3.2, d1: 2.45, h0: 1.6, h1: 1.55, lookOff: [0, 1.52, 0], fov0: 33, fov1: 30,
    dir: () => [0.38, 0.93] }) },
  // hookboard (R2): the camera is v1's — its board framing is proven
  // (whole panel + margins, PARTIAL=0). The R2 change is the CAST:
  // the hero kneels in the foreground pointing up at the board, and
  // the two figures v1 cropped at the frame edges are gone.
  hookboard: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1691, pos: [-1.8, 2.0, 6.1], look: [-3.32, 1.92, -5.95], fov: 46 },
    { f: 1815, pos: [-1.98, 1.95, 4.9], look: [-3.3, 1.95, -5.92], fov: 44, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [],
  sigma: 2.3, fovSigma: 1.6,
});
export const camAt = (f) => ({ ...RIG.camAt(f), flash: 0 });
export const RIG_META = {
  kicks: RIG.declared.kicks, hardCuts: RIG.declared.hardCuts,
  blends: SHOTS.filter((s) => RIG_BY_ID[s.id].cut === 'blend').map((s) => ({ a: s.a - Math.floor(RIG_BY_ID[s.id].blend / 2), b: s.a + Math.ceil(RIG_BY_ID[s.id].blend / 2) })),
  whips: RIG.declared.whips,
  samples: RIG.samples,
};
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), hp = heroPosAt(f);
  let cinf = 2.2;
  if (['hook', 'perform', 'wind', 'reveal', 'flop', 'hookboard'].includes(S.id)) cinf = 1.3;
  if (['lamp', 'puppet', 'dialogue', 'tag', 'deal'].includes(S.id)) cinf = 3.4;
  if (['tall', 'arrival', 'housefull', 'rent', 'recall', 'tickets'].includes(S.id)) cinf = 2.6;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
const LAMP_RAMP = (f) => smooth(ramp(f, 523, 559)); // the lamp is lit inside L5
export const worldAt = (f) => {
  const S = shotAt(f);
  const showOn = ['hook', 'perform', 'housefull', 'flop', 'wind', 'reveal'].includes(S.id) ? 1
    : S.id === 'lamp' ? LAMP_RAMP(f) : 0;
  const gust = S.id === 'wind' ? smooth(ramp(f, 1251, 1287)) * (1 - smooth(ramp(f, 1310, 1325))) : 0;
  const fly = S.id === 'wind' ? smooth(ramp(f, 1291, 1313)) : (f > 1325 ? 1 : 0);
  return {
    always: 1,
    hookK: S.id === 'hookboard' ? smooth(ramp(f, 1699, 1725)) : 0,
    lampK: 1,
    screenK: 0.14 + 0.86 * Math.max(showOn, S.id === 'lamp' ? LAMP_RAMP(f) : 0),
    gustK: gust,
    flapK: S.id === 'wind' ? 0.25 + 0.75 * gust : 0,
    flyK: fly,
    starK: 0.35,
    blastX: S.id === 'wind' ? 0 : LAMP_POS[0], blastY: S.id === 'wind' ? 0.9 : 1.95, blastZ: S.id === 'wind' ? -8.4 : LAMP_POS[2],
  };
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  const gustDust = S.id === 'wind' ? 0.8 * smooth(ramp(f, 1255, 1287)) * (1 - smooth(ramp(f, 1305, 1325))) : 0;
  const lampSpark = S.id === 'lamp' ? 0.7 * Math.pow(Math.abs(Math.sin(f * 0.35)), 3) * (1 - LAMP_RAMP(f)) + 0.25 * LAMP_RAMP(f) : 0;
  return { moteRate: 0.12, blastRate: gustDust, sparkRate: lampSpark, steamRate: 0, shimmerRate: 0 };
};
export const fxAt = () => [];

// ---------- cast ----------
// NO card tint in any light — faces stay pure white, costume colours
// flat and saturated even in lamplight (the reference's rule).
const tintFor = () => '#ffffff';
export const OUTFITS = {
  hero: { jacket: '#e3d3ac', pants: '#6b4a2f', boots: '#2a1c10', hat: 'hair', hair: '#191008', skin: '#fbf7ef', moustache: '#2a201a' },
  pupp: { jacket: '#8e2350', pants: '#33424a', boots: '#1c1712', hat: 'turban', turban: '#e07b2a', skin: '#fbf7ef', moustache: '#1c1410' },
  kid1: { jacket: '#2a7a9c', pants: '#3c3a40', boots: '#241a12', hat: 'hair', hair: '#14100c', skin: '#fbf7ef' },
  kid2: { jacket: '#c9542e', pants: '#33424a', boots: '#241a12', hat: 'hair', hair: '#100c0a', skin: '#fbf7ef' },
  vilA: { jacket: '#7a3a6e', dress: '#7a3a6e', pants: '#3c3a40', boots: '#241a12', hat: 'hair', hair: '#100c0a', skin: '#fbf7ef' },
  vilB: { jacket: '#476b35', pants: '#4a3626', boots: '#241a12', hat: 'hair', hair: '#1c1712', skin: '#fbf7ef' },
  vilC: { jacket: '#31517a', pants: '#3c3a40', boots: '#241a12', hat: 'cap', cap: '#8e2323', skin: '#fbf7ef' },
  old: { jacket: '#cfc8b8', pants: '#5a5348', boots: '#241a12', hat: 'hair', hair: '#e9e7e1', skin: '#fbf7ef', moustache: '#e9e7e1', bigMoustache: true },
};

// ---------- THE SHADOW (custom-drawn demon-king silhouette) ----------
// Drawn in card space (600x1000, sole y=975) like every card, but pure
// silhouette: horned head, clawed arms on two-bone FK, tattered skirt,
// a sweeping tail. When it ROARS, cloth-coloured eye slits and a mouth
// wedge open in the black — the holes read as light through the demon.
const SIL = '#150e08', CLOTH = '#f3e7cd';
const armFK = (S, m, a1, a2) => {
  const L1 = 148, L2 = 138;
  const el = [S[0] + m * Math.sin(a1) * L1, S[1] + Math.cos(a1) * L1];
  const ha = [el[0] + m * Math.sin(a1 + a2) * L2, el[1] + Math.cos(a1 + a2) * L2];
  return { el, ha };
};
const bump = (f, c, w) => Math.exp(-(((f - c) / w) ** 2));
export const perfPose = (f) => {
  const S = shotAt(f);
  let aL = 2.5 + 0.55 * Math.sin(f * 0.11), aR = 2.7 + 0.5 * Math.sin(f * 0.09 + 2.2);
  let bL = 0.5 + 0.4 * Math.sin(f * 0.17 + 1), bR = 0.4 + 0.45 * Math.sin(f * 0.15);
  let roar = 0;
  if (S.id === 'hook') roar = Math.min(1, bump(f, 40, 12) + bump(f, 88, 12));
  if (S.id === 'perform') roar = Math.min(1, bump(f, 648, 11) + bump(f, 690, 11));
  if (S.id === 'wind') roar = Math.min(1, bump(f, 1258, 10));
  if (S.id === 'flop') { aL = 0.55; aR = 0.5; bL = 0.25; bR = 0.3; } // the wooden flop: stiff, drooping
  const headDx = S.id === 'flop' ? 4 : 26 * Math.sin(f * 0.05);
  const sway = S.id === 'flop' ? 0 : 10 * Math.sin(f * 0.045);
  return { aL, aR, bL, bR, roar, headDx, sway };
};
const drawDemon = (pose) => (p) => {
  const cx = 300 + pose.sway, shY = 408, hipY = 692;
  const shL = [cx - 88, shY], shR = [cx + 88, shY];
  const L = armFK(shL, -1, pose.aL, pose.bL), R = armFK(shR, 1, pose.aR, pose.bR);
  const hipL = [cx - 42, hipY], hipR = [cx + 42, hipY];
  // tail (behind): sweeps out from the right hip, arrow tip
  p.band([[hipR[0], hipY - 6], [cx + 138, 762], [cx + 188, 872]], SIL, 17, 0, 'round');
  p.poly([[cx + 188, 872], [cx + 158, 852], [cx + 172, 830], [cx + 196, 838], [cx + 214, 856]], SIL, 0);
  // legs
  p.stroke([hipL, [cx - 52, 975]], 36, SIL); p.stroke([hipR, [cx + 52, 975]], 36, SIL);
  // torso with a tattered bottom edge
  const jag = []; for (let x = -98; x <= 98; x += 24.5) jag.push([cx + x, hipY + 8 + ((Math.round((x + 98) / 24.5) % 2) ? 34 : 4)]);
  p.poly([[shL[0] - 14, shY], [shR[0] + 14, shY], [cx + 100, hipY], ...jag.reverse()], SIL, 0);
  // arms + claws
  for (const [A, m] of [[L, -1], [R, 1]]) {
    p.stroke([A === L ? shL : shR, A.el, A.ha], 27, SIL);
    const dx = A.ha[0] - A.el[0], dy = A.ha[1] - A.el[1], dl = Math.hypot(dx, dy) || 1;
    const ux = dx / dl, uy = dy / dl;
    for (const da of [-0.45, 0, 0.45]) {
      const ca = Math.cos(da), sa = Math.sin(da);
      const vx = ux * ca - uy * sa, vy = ux * sa + uy * ca;
      p.stroke([A.ha, [A.ha[0] + vx * 30, A.ha[1] + vy * 30]], 7, SIL);
    }
  }
  // head + horns + crown
  const hx = cx + pose.headDx, hy = 272 - pose.roar * 10, hr = 92 + pose.roar * 7;
  p.poly([[hx - 62, hy - 48], [hx - 128, hy - 122], [hx - 98, hy - 30], [hx - 48, hy - 62]], SIL, 0);
  p.poly([[hx + 62, hy - 48], [hx + 128, hy - 122], [hx + 98, hy - 30], [hx + 48, hy - 62]], SIL, 0);
  for (const dx of [-30, 0, 30]) p.poly([[hx + dx - 11, hy - hr + 16], [hx + dx, hy - hr - 26], [hx + dx + 11, hy - hr + 16]], SIL, 0);
  p.ell(hx, hy, hr, hr * 1.02, SIL, 0);
  if (pose.roar > 0.25) { // light-holes: eyes + the roaring mouth
    p.ell(hx - 33, hy - 4, 10, 4.6, CLOTH, 0); p.ell(hx + 33, hy - 4, 10, 4.6, CLOTH, 0);
    p.ell(hx, hy + 44, 8 + 24 * pose.roar, 4 + 15 * pose.roar, CLOTH, 0);
  }
};
// ---------- the wooden demon puppet (custom-drawn, painted + jointed) ----------
const drawPuppet = (p) => {
  const cx = 300;
  // control bar + strings first (behind the figure)
  p.band([[168, 66], [432, 66]], '#6e4525', 13, 3, 'round');
  p.band([[cx, 66], [cx, 168]], 'rgba(232,222,198,0.65)', 2.4, 0);
  p.band([[196, 66], [168, 560]], 'rgba(232,222,198,0.65)', 2.4, 0);
  p.band([[404, 66], [432, 560]], 'rgba(232,222,198,0.65)', 2.4, 0);
  // stiff legs
  p.stroke([[cx - 34, 700], [cx - 40, 962]], 25, '#5e3d22'); p.stroke([[cx + 34, 700], [cx + 40, 962]], 25, '#5e3d22');
  p.stroke([[cx - 56, 968], [cx - 16, 968]], 15, '#3a2412'); p.stroke([[cx + 16, 968], [cx + 56, 968]], 15, '#3a2412');
  // torso: painted wood, gold belt, red chest jewel
  p.poly([[cx - 78, 428], [cx + 78, 428], [cx + 62, 712], [cx - 62, 712]], '#8a5a34', 5);
  p.band([[cx - 66, 640], [cx + 66, 640]], '#c9962e', 17, 2, 'round');
  p.ell(cx, 520, 17, 22, '#a33327', 3);
  // arms: rigid sticks, one stuck UP, one stuck DOWN, brass joint pins
  p.stroke([[cx - 74, 452], [cx - 138, 372], [cx - 128, 268]], 21, '#7a4a2a');
  p.stroke([[cx + 74, 452], [cx + 132, 540], [cx + 122, 660]], 21, '#7a4a2a');
  for (const [jx, jy] of [[cx - 74, 452], [cx + 74, 452], [cx - 138, 372], [cx + 132, 540]]) p.ell(jx, jy, 10, 10, '#c9962e', 2);
  p.ell(cx - 128, 268, 13, 13, '#96683c', 3); p.ell(cx + 122, 660, 13, 13, '#96683c', 3);
  // head: horns, painted face, gold crown band
  p.poly([[cx - 52, 218], [cx - 104, 138], [cx - 80, 238], [cx - 38, 246]], '#6e4525', 3);
  p.poly([[cx + 52, 218], [cx + 104, 138], [cx + 80, 238], [cx + 38, 246]], '#6e4525', 3);
  p.ell(cx, 268, 86, 94, '#96683c', 5);
  p.band([[cx - 80, 196], [cx + 80, 196]], '#c9962e', 15, 2, 'round');
  p.ell(cx - 31, 262, 13, 16, '#ffffff', 3); p.ell(cx + 31, 262, 13, 16, '#ffffff', 3);
  p.ell(cx - 31, 266, 6, 8, '#14100c', 0); p.ell(cx + 31, 266, 6, 8, '#14100c', 0);
  p.arc(cx, 306, 34, 22, 15, 165, 6, '#a33327');
  for (const dx of [-20, 0, 20]) p.poly([[cx + dx - 5, 330], [cx + dx, 348], [cx + dx + 5, 330]], '#ffffff', 1);
};
// ---------- audience backs (custom-drawn seated silhouettes) ----------
const BACK_TONES = ['#0d0f16', '#10131c', '#0f1013', '#131009'];
const drawBack = (seed) => (p) => {
  const tone = BACK_TONES[seed % BACK_TONES.length], cx = 300;
  const v = seed % 4;
  // seated shoulders + torso (bottom of the card = the mat)
  p.poly([[cx - 138, 978], [cx + 138, 978], [cx + 106, 726], [cx - 106, 726]], tone, 0);
  p.ell(cx, 700, 118, 42, tone, 0);
  // head + hair variant
  p.ell(cx, 606, 73, 83, tone, 0);
  if (v === 0) p.ell(cx, 508, 25, 21, tone, 0); // bun
  else if (v === 1) p.ell(cx, 540, 88, 38, tone, 0); // turban wrap
  else if (v === 2) p.poly([[cx - 78, 566], [cx + 78, 566], [cx + 62, 522], [cx - 62, 522]], tone, 0); // cap
  else p.ell(cx - 52, 540, 20, 30, tone, 0); // side knot
  // a shawl band on some, and the lamp's warm rim on the screen side
  if (seed % 3 === 0) p.band([[cx - 112, 762], [cx + 112, 762]], '#2c1a20', 15, 0, 'round');
  p.arc(cx, 606, 79, 89, -58, 52, 5, 'rgba(255,176,102,0.30)');
};

// ---------- HEAD PERFORMANCE ----------
const emoTrack = (initial, events) => ({
  at(f) {
    let from = T.faceP(initial), to = from, t0 = 0, dur = 0;
    const seg = (g) => {
      if (dur <= 0 || g >= t0 + dur) return { ...to };
      if (g <= t0) return { ...from };
      const u = (g - t0) / dur, s = u * u * u * (u * (u * 6 - 15) + 10), o = {};
      for (const k in to) o[k] = from[k] + (to[k] - from[k]) * s;
      return o;
    };
    for (const [ef, name, ed] of events) {
      if (ef > f) break;
      from = seg(ef); to = T.faceP(name); t0 = ef; dur = Math.max(1, ed);
    }
    return seg(f);
  },
});
const emoHero = emoTrack('grin', [
  [109, 'dazed', 10], [210, 'smile', 8], [373, 'grin', 8], [612, 'smug', 9], [806, 'smug', 8],
  [1131, 'smile', 8], [1196, 'grin', 7], [1326, 'nervous', 9], [1386, 'smile', 9], [1412, 'laugh', 8],
  [1539, 'smile', 8], [1587, 'smile', 8], [1622, 'smug', 9], [1691, 'grin', 8],
]);
const emoPupp = emoTrack('grin', [
  [373, 'grin', 8], [612, 'grin', 8], [806, 'laugh', 8], [935, 'thinking', 9], [1039, 'pained', 10],
  [1131, 'nervous', 9], [1326, 'laugh', 8], [1412, 'laugh', 8], [1587, 'smile', 8],
]);
const emoKid1 = emoTrack('grin', [
  [719, 'shock', 7], [758, 'laugh', 8], [1039, 'pained', 10], [1326, 'shock', 8], [1412, 'laugh', 8],
]);
const emoKid2 = emoTrack('smile', [
  [719, 'shock', 7], [764, 'grin', 8], [1326, 'wonder', 8], [1412, 'laugh', 8],
]);
const emoVilA = emoTrack('smile', [
  [719, 'shock', 8], [1039, 'pained', 10], [1326, 'shock', 8], [1412, 'laugh', 8], [1587, 'smile', 8],
]);
const emoOld = emoTrack('neutral', [
  [719, 'nervous', 8], [1326, 'shock', 8], [1412, 'laugh', 9],
]);
// ---------- BODY ACTIONS (library body.js) ----------
const puppKneel = poseWindows([{ a: 1131, b: 1232, mode: 'kneel', inF: 8, outF: 6 }]);
const heroKneelLamp = poseWindows([{ a: 493, b: 611, mode: 'kneel1', inF: 7, outF: 6 }]);
const heroKneelBoard = poseWindows([{ a: 1691, b: 1815, mode: 'kneel', inF: 8, outF: 6 }]);
const heroTurn = turnTrack([{ f0: 1549, dur: 12, dir: 1 }]);
const heroWink = winkTrack([{ a: 876, b: 886 }, { a: 1216, b: 1226 }]);
const SPEAK = SPK.makeSpeakPlayer(SPEAK_DATA);
const micro = (f, seed) => 1.1 * Math.sin((f + seed * 5) * 0.037 + 1);
const nodAt = (f, f0, n = 9, depth = 0.34) => (f >= f0 && f <= f0 + n ? Math.sin((f - f0) / n * Math.PI) * depth : 0);
const head = (f, seed, tilt, look, lookY, facing = 0, squash = 0) => ({
  headTilt: q(tilt + micro(f, seed), 1), look: q(look, 2), lookY: q(lookY, 2), facing: q(facing, 2), squash: q(squash, 2),
});
const noBlush = (P) => { P.blush = 0; P.openL = Math.min(1, (P.openL ?? 0.85) * 1.45); P.openR = Math.min(1, (P.openR ?? 0.85) * 1.45); return P; };

export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, z, extra = {}) => out.push({ id, x, y: extra.y || 0, z, r: 0.32, ground: extra.ground || 0, grp: extra.grp || '',
    actor: (T) => ({ key: 'smx' + JSON.stringify(o) + JSON.stringify(opts) + (extra.y || 0),
      draw: (p) => { T.bodyFront(p, o, opts); if (extra.overlay) extra.overlay(p); },
      x, y: extra.y || 0, z, ground: extra.ground || 0, tint, ...extra }) });
  const custom = (id, key, drawFn, x, z, extra = {}) => out.push({ id, x, y: extra.y || 0, z, r: extra.r ?? 0.32, ground: extra.ground || 0, grp: extra.grp || '', dyn: extra.dyn,
    actor: (T) => ({ key, draw: drawFn, x, y: extra.y || 0, z, ground: extra.ground || 0, tint, ...extra }) });
  const h = heroAt(f), pp = puppAt(f);
  let HP = noBlush(emoHero.at(f));
  const PP = noBlush(emoPupp.at(f)), K1 = noBlush(emoKid1.at(f)), K2 = noBlush(emoKid2.at(f)), VA = noBlush(emoVilA.at(f)), OP = noBlush(emoOld.at(f));
  const winkK = heroWink(f);
  if (winkK > 0) HP = T.blendFaceP(HP, T.faceP('wink', 31), winkK);
  const backs = (seats, baseSeed) => seats.forEach(([sx, sz], i) => {
    custom('back' + baseSeed + '_' + i, 'back' + (baseSeed + i), drawBack(baseSeed + i), sx, sz,
      { flat: true, blob: false, shadow: false, s: 0.98, r: 0.3 });
  });
  // The shadow lives ON the cloth: glue the card to the cloth surface
  // every frame (the cloth tilts on its beam pivot and flaps/flies in
  // the wind) — a fixed flat card sinks behind the tilted cloth.
  const clothPoint = (lx, ly, lz) => {
    const Ws = worldAt(f), fly = Ws.flyK, flap = Ws.flapK;
    const rx = -0.03 - flap - fly * 0.7, ry = fly * 0.5, rz = fly * 1.85 + flap * 0.4;
    let x = lx, y = ly, z = lz, c, s;
    c = Math.cos(rz); s = Math.sin(rz); [x, y] = [x * c - y * s, x * s + y * c];
    c = Math.cos(ry); s = Math.sin(ry); [x, z] = [x * c + z * s, -x * s + z * c];
    c = Math.cos(rx); s = Math.sin(rx); [y, z] = [y * c - z * s, y * s + z * c];
    return { x: x + fly * 8.5, y: y + 4.02 + fly * 2.6 - fly * fly * 2.2, z: z - 9 + fly * 2.4, pitch: rx, yaw: ry, roll: rz };
  };
  const shadowActor = (big = true) => {
    const pose = perfPose(f);
    const key = 'demon' + [pose.aL, pose.aR, pose.bL, pose.bR, pose.roar, pose.headDx, pose.sway].map((v) => Math.round(v * 18)).join(',');
    // R2: the shadow's cloth-x is explicit per shot — in the opening
    // it looms behind the foreground hero at a REDUCED scale (the
    // full 1.45 giant crops at the top/right from the low close
    // camera — eye-checked), centred just right of his head; in the
    // show shots it is centred (0) at full size; the flop's wooden
    // shadow stays small (0.3).
    const isHook = S.id === 'hook';
    const sx = isHook ? -1.25 : (big ? 0 : 0.3);
    const cp = clothPoint(sx, -3.34, 0.10);
    custom('shadow', key, drawDemon(pose), cp.x, cp.z,
      { y: cp.y, ground: cp.y, flat: true, blob: false, shadow: false, s: isHook ? 1.18 : (big ? 1.45 : 0.55), r: 0.01, dyn: false, order: 3, pitch: cp.pitch, yaw: cp.yaw, roll: cp.roll });
  };
  const heroHidden = () => std('hero', OUTFITS.hero, { expr: 'smile', exprP: HP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
    ...head(f, 31, -2, 0.2, -0.2, 0.2) }, h.x, h.z, { y: h.y || 0, ground: h.ground || 0, grp: 'stage' });
  switch (S.id) {
    case 'hook': {
      // R2 OPENING: the demon looms on the cloth AND the hero stands
      // in front of the screen selling it — grin, arm raised at his
      // own giant shadow. No audience backs: the low camera sits over
      // the empty mats and the two figures fill the frame.
      shadowActor(true);
      std('hero', OUTFITS.hero, { expr: 'grin', exprP: HP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.55],
        ...head(f, 31, -2.5, 0.3, -0.1, 0.25) }, h.x, h.z, { yaw: 0.2 });
      std('pupp', OUTFITS.pupp, { expr: 'grin', exprP: PP, mode: 'stand', blink: blinkAt(f, 51), seed: 51, prop: ['point', 0.35],
        ...head(f, 51, -2, -0.5, -0.15, -0.5) }, pp.x, pp.z, { yaw: -0.45 });
      break;
    }
    case 'tall': {
      // leaning on the screen pole, half asleep — the village idler
      std('hero', OUTFITS.hero, { expr: 'smile', exprP: HP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, kf([[109, 3], [160, 5.5], [209, 4.5]], f), 0.1, 0.55, 0.1) }, h.x, h.z, { yaw: 0.35 });
      std('old', OUTFITS.old, { expr: 'neutral', exprP: OP, mode: 'sit', blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, -1, 0.3, 0.1, 0.3) }, -5.35, -6.35, { yaw: 0.3, y: 0.42, ground: 0.42, grp: 'bench' });
      break;
    }
    case 'arrival': {
      std('hero', OUTFITS.hero, { expr: 'smile', exprP: HP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, 3.5, -0.4, 0.3, -0.4) }, h.x, h.z, { yaw: -0.4 });
      const walking = f < 291;
      std('pupp', OUTFITS.pupp, { expr: 'grin', exprP: PP, mode: walking ? 'stroll' : 'stand', phase: q((f * 0.016) % 1, 2), blink: blinkAt(f, 51), seed: 51, prop: walking ? null : ['point', 0.3],
        ...head(f, 51, -1.5, 0.45, -0.1, 0.45) }, pp.x, pp.z, { yaw: 0.4 });
      std('old', OUTFITS.old, { expr: 'neutral', exprP: OP, mode: 'sit', blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, -1.5, -0.3, 0, -0.3) }, -5.35, -6.35, { yaw: -0.3, y: 0.42, ground: 0.42, grp: 'bench' });
      break;
    }
    case 'deal': {
      std('hero', OUTFITS.hero, { expr: 'smile', exprP: HP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.5],
        ...head(f, 31, -1.5, 0.5, 0.1 + nodAt(f, 445), 0.5) }, h.x, h.z, { yaw: 0.5, y: h.y, ground: h.ground, grp: 'stage' });
      std('pupp', OUTFITS.pupp, { expr: 'grin', exprP: PP, mode: 'stand', blink: blinkAt(f, 51), seed: 51, prop: ['coin', 0.5],
        ...head(f, 51, -1, -0.5, 0.15, -0.5) }, pp.x, pp.z, { yaw: -0.5, y: pp.y, ground: pp.ground, grp: 'stage' });
      break;
    }
    case 'lamp': {
      // R2: a PURE object insert — the great lamp alone, flaring to
      // life as the push-in tightens. The kneeling hero is NOT in
      // this cast: from the behind-screen camera his off-axis place
      // beside the lamp sweeps him across the frame edge mid-push
      // (the v1 half-crop defect, eye-checked at f560) — no camera
      // path keeps him fully in AND fully out. His place-taking is
      // told by the perform shot that follows.
      std('pupp', OUTFITS.pupp, { expr: 'grin', exprP: PP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, -2, 0.4, -0.2, 0.4) }, pp.x, pp.z, { yaw: 0.35 });
      break;
    }
    case 'perform': {
      shadowActor(true);
      backs(seatsAt(f), 21);
      std('pupp', OUTFITS.pupp, { expr: 'grin', exprP: PP, mode: 'stand', blink: blinkAt(f, 51), seed: 51, prop: ['point', 0.4],
        ...head(f, 51, -2.5, -0.5, -0.3, -0.5) }, pp.x, pp.z, { yaw: -0.45 });
      heroHidden();
      break;
    }
    case 'housefull': {
      // R2 REACTION: the camera lives on kid1's face alone, so the
      // rest of the crowd is seated OUT of its tight cone — kid2,
      // vilB and vilC leave this shot (v1 put vilB's giant cropped
      // head at the right edge). vilA and the old man stay, seated
      // wide of the cone on either side.
      std('kid1', OUTFITS.kid1, { expr: 'grin', exprP: K1, mode: 'sit', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -3.5, 0.2, -0.4, 0.2) }, 0.2, -4.7, { yaw: 0.15, s: 0.74 });
      std('vilA', OUTFITS.vilA, { expr: 'smile', exprP: VA, mode: 'sit', blink: blinkAt(f, 61), seed: 61,
        ...head(f, 61, -2.5, 0.3, -0.35, 0.3) }, 1.5, -4.7, { yaw: 0.25 });
      std('old', OUTFITS.old, { expr: 'neutral', exprP: OP, mode: 'sit', blink: blinkAt(f, 71), seed: 71,
        ...head(f, 71, -3, -0.3, -0.4, -0.3) }, -0.5, -6.0, { yaw: -0.25 });
      heroHidden();
      break;
    }
    case 'rent': {
      std('hero', OUTFITS.hero, { expr: 'smile', exprP: HP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.8],
        ...head(f, 31, -1, 0.45, 0.3 + nodAt(f, 865), 0.45) }, h.x, h.z, { yaw: 0.45 });
      std('pupp', OUTFITS.pupp, { expr: 'grin', exprP: PP, mode: 'stand', blink: blinkAt(f, 51), seed: 51, prop: ['coin', 0.5],
        ...head(f, 51, -1, -0.5, 0.3, -0.5) }, pp.x, pp.z, { yaw: -0.45 });
      break;
    }
    case 'puppet': {
      // R2 INSERT: the wooden demon ALONE on the crate, built
      // screen-size (s 0.72) — it will not wave, it will not bow.
      // No puppeteer in frame: v1's cropped torso slab down the left
      // edge is exactly the defect the R2 insert rule bans.
      custom('puppet', 'woodpuppet', drawPuppet, 3.95, -8.3, { y: 0.62, ground: 0.62, s: 0.72, blob: false, r: 0.01, dyn: false });
      break;
    }
    case 'flop': {
      shadowActor(false);
      backs(seatsAt(f), 31);
      std('kid2', OUTFITS.kid2, { expr: 'smile', exprP: K2, mode: 'sit', blink: blinkAt(f, 43), seed: 43,
        ...head(f, 43, kf([[1039, 1], [1085, 4.5], [1130, 4]], f), 0.1, 0.45, 0.1) }, 3.4, -6.0, { yaw: 0.2, s: 0.7 });
      std('pupp', OUTFITS.pupp, { expr: 'grin', exprP: PP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, 3, 0.3, 0.4, 0.3) }, pp.x, pp.z, { yaw: 0.3 });
      heroHidden();
      break;
    }
    case 'recall': {
      std('hero', OUTFITS.hero, { expr: 'smile', exprP: HP, mode: 'sit', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, kf([[1131, 3.5], [1196, -1], [1232, -1.5]], f), 0.4, 0.3, 0.4) }, h.x, h.z, { yaw: 0.4, y: h.y, ground: h.ground, grp: 'bench' });
      const P = puppKneel(f);
      std('pupp', OUTFITS.pupp, { expr: 'grin', exprP: PP, mode: P.mode, squash: P.squash, blink: blinkAt(f, 51), seed: 51, prop: ['coin', 0.45],
        ...head(f, 51, -2.5, -0.45, -0.15, -0.45) }, pp.x, pp.z, { yaw: -0.45 });
      break;
    }
    case 'wind': {
      if (worldAt(f).flyK < 0.45) shadowActor(true);
      backs(seatsAt(f), 41);
      std('pupp', OUTFITS.pupp, { expr: 'grin', exprP: PP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, -3.5, -0.4, -0.4, -0.4) }, pp.x, pp.z, { yaw: -0.4 });
      heroHidden();
      break;
    }
    case 'reveal': {
      // no cloth, no demon: the lazy man himself, blinking in the
      // lamplight, caught — then grinning at the crowd
      std('hero', OUTFITS.hero, { expr: 'smile', exprP: HP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: f >= 1386 ? ['point', 0.55] : null,
        ...head(f, 31, kf([[1326, 0.5], [1386, -1.5], [1411, -2]], f), 0.1, 0.05, 0.1) }, h.x, h.z, { yaw: 0.1, y: h.y, ground: h.ground, grp: 'stage' });
      backs(seatsAt(f), 51);
      std('pupp', OUTFITS.pupp, { expr: 'grin', exprP: PP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, -3 + 2 * Math.sin(f * 0.3), -0.4, -0.1, -0.4) }, pp.x, pp.z, { yaw: -0.4 });
      break;
    }
    case 'tickets': {
      // the bow: head dips twice as the bowl fills behind him
      std('hero', OUTFITS.hero, { expr: 'smile', exprP: HP, mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.5],
        ...head(f, 31, 1.5 + nodAt(f, 1432, 12, 2.6) + nodAt(f, 1492, 12, 2.6), 0.15, 0.25, 0.15) }, h.x, h.z, { yaw: 0.15 });
      std('pupp', OUTFITS.pupp, { expr: 'grin', exprP: PP, mode: 'stand', blink: blinkAt(f, 51), seed: 51, prop: ['coin', 0.5],
        ...head(f, 51, -1, -0.5, 0.3, -0.5) }, pp.x, pp.z, { yaw: -0.45 });
      // R2: the crowd is BACKS here — the camera sits behind the
      // mats looking at the stage; v1's facing audience cards put
      // giant cropped heads in the frame's corners. The two back-row
      // seats the pair stands in are left empty (collision gate).
      backs(seatsAt(f).filter((s) => Math.hypot(s[0] - h.x, s[1] - h.z) > 0.85 && Math.hypot(s[0] - pp.x, s[1] - pp.z) > 0.85), 12);
      break;
    }
    case 'tag': {
      const Tn = heroTurn(f);
      std('hero', OUTFITS.hero, { expr: 'smile', exprP: HP, mode: 'stand', squash: Tn.squash, blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, -2, kf([[1539, 0.5], [1551, 0.5], [1563, 0.05], [1586, 0]], f), 0, kf([[1539, 0.45], [1563, 0.05], [1586, 0]], f)) }, h.x, h.z, { yaw: Tn.yaw, y: Tn.hop });
      std('pupp', OUTFITS.pupp, { expr: 'grin', exprP: PP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, -1.5, -0.45, 0.05, -0.45) }, 2.45, -7.78, { yaw: -0.4 });
      break;
    }
    case 'dialogue': {
      // THE LINE, performed: the hero's mouth is driven by the stem
      // itself (speak.js); every other mouth stays shut.
      const sp = SPEAK.at(f);
      const speakP = SPK.applySpeak({ ...T.faceP('smile'), cheek: 0 }, sp);
      speakP.blush = 0; speakP.openL = Math.min(1, (speakP.openL ?? 0.85) * 1.45); speakP.openR = Math.min(1, (speakP.openR ?? 0.85) * 1.45);
      std('hero', OUTFITS.hero, { expr: 'smile', exprP: speakP, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        headTilt: q((sp.nod || 0) + micro(f, 31) - 1.5, 1), look: q(0.08, 2), lookY: q(0.02, 2), facing: q(0.1, 2), squash: 0 }, h.x, h.z, { yaw: 0.1 });
      std('pupp', OUTFITS.pupp, { expr: 'grin', exprP: PP, mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, -1.5, -0.4, 0.05, -0.4) }, pp.x, pp.z, { yaw: -0.35 });
      std('vilA', OUTFITS.vilA, { expr: 'smile', exprP: VA, mode: 'stand', blink: blinkAt(f, 61), seed: 61,
        ...head(f, 61, -1, 0.45, 0.05, 0.45) }, -1.8, -7.85, { yaw: 0.4 });
      std('kid1', OUTFITS.kid1, { expr: 'grin', exprP: K1, mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        ...head(f, 41, -1, -0.45, 0.05, -0.45) }, -2.65, -7.75, { yaw: -0.4, s: 0.74 });
      break;
    }
    case 'hookboard': {
      // R2 FINAL: character beat + hook board together — the hero
      // KNEELS in the foreground (a kneeling figure's head stays
      // below the board's text band from this camera) and points up
      // at the board, grinning. He is the only figure: v1 cropped
      // the hero at the left edge and the puppeteer at the right.
      const P = heroKneelBoard(f);
      std('hero', OUTFITS.hero, { expr: 'grin', exprP: HP, mode: P.mode, squash: P.squash, blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.4],
        ...head(f, 31, -2, 0.5, -0.05, 0.5) }, h.x, h.z, { yaw: 0.45 });
      break;
    }
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity ----------
export const STATICS = [
  SOL.aabb(-3.4, 3.4, -10.1, -8.2, { h: 0.55, id: 'platform', group: 'stage' }),
  SOL.circle(-2.95, -9, 0.09, { h: 4.7, id: 'poleL' }),
  SOL.circle(2.95, -9, 0.09, { h: 4.7, id: 'poleR' }),
  SOL.circle(0, -10.8, 0.34, { h: 1.5, id: 'lampstand' }),
  SOL.obb(3.95, -8.35, 0, 0.475, 0.35, { h: 0.62, id: 'crate' }),
  SOL.circle(4.65, -7.6, 0.3, { h: 0.42, id: 'basket' }),
  SOL.circle(4.7, -8.8, 0.05, { h: 2.5, id: 'puppetpole' }),
  SOL.circle(-4.6, -3.4, 0.07, { h: 2.3, id: 'ticketpost' }),
  SOL.obb(-4.9, -6.4, 0.5, 0.9, 0.3, { h: 0.42, id: 'bench', group: 'bench' }),
  SOL.circle(-8.6, -10.5, 0.5, { h: 3.2, id: 'tree1' }),
  SOL.circle(9.2, -11.5, 0.55, { h: 3.2, id: 'tree2' }),
  SOL.circle(-3.1, -11.8, 0.09, { h: 2.6, id: 'postB' }),
  SOL.circle(7.3, -3.2, 0.09, { h: 2.6, id: 'postC' }),
];
export const WORLD = SOL.makeWorld(STATICS);
export const dynamicsAt = (f) => {
  const out = [];
  for (const a of castAt(f)) {
    if (a.dyn === false) continue;
    out.push(SOL.circle(a.x, a.z, a.r, { kind: 'dynamic', id: a.id, group: a.grp || '' }));
  }
  return out;
};
export const groundItemsAt = (f) => {
  const items = [];
  for (const a of castAt(f)) {
    if (a.dyn === false) continue;
    items.push({ id: a.id, y: a.y, ground: a.ground || 0, maxHover: 0.06 });
  }
  return items;
};
