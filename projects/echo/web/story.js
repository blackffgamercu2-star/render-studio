// Shot plan for "The Man Who Sold His Echo" (batch-5 topic 3, EN) —
// timed to the ACTUAL voice stem (72.77 s, 30 fps, TOTAL 2183), clause
// timings from faster-whisper alignment of stem_en.wav (224 words):
// C1 0-120 hook: sold his own echo for 100 gold coins |
// C2 131-245 poor man by the valley, every shout comes back twice |
// C3 259-396 merchant passes shouting at servants, valley shouts back |
// C4 411-503 "Who is that, mocking me?" | C5 518-765 "my servant…
// sell him for a hundred gold coins" | C6 778-815 merchant paid at
// once (POUCH: held f778-788, RESTS on rock f788-800, lifted f800-814,
// in poor man's hand f812-830) | C7 830-980 "Will I be rich?" ->
// "Rich... rich..." | C8 994-1114 "Will my ships come home?" ->
// "Home... home..." | C9 1131-1204 "The perfect servant!" |
// C10 1217-1332 "Who stole my gold last winter?" | C11 1345-1401
// "Gold... gold..." | C12 1414-1557 "Tell me the thief's name!" ->
// "Name... name..." | C13 1575-1700 smile died, marched back, demanded
// money | C14 1712-1951 "You paid a hundred coins for your own
// voice." | C15 1964-2182 hook: sailor promised to drink the sea dry.
// QUALITY RULES (locked): shots change ONLY at clause boundaries;
// camera TRACKS the voice-named subject; characters act in place
// (planted feet); costumes by role (poor man = worn simple clothes,
// merchant = rich purple + gold turban, servants = plain village dress,
// sailor = blue + white cap).
// PHYSICS RULES (Abid 2026-11-15, TOP priority): the coin pouch sits ON
// the rock (bottom flush, contact shadow), rises WITH the poor man's
// hand when picked up, lands in his hand and stays; nothing floats;
// echo rings expand from the cliff face and fade; every named object is
// on screen at its clause. Contact beats are all computed in dynAt.
// World: mountain valley x=0 (cliff face z=-6.75, hut at [-3.8,0,-3.6],
// payment rock at [0.15,0,-1.3]), sea x=+28 (sand, water, boat, signpost).
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 2183, DECK = 0;
export const SHOTS = [
  { id: 'open', a: 0, b: 130, light: 'day' },
  { id: 'valley', a: 131, b: 258, light: 'day' },
  { id: 'merchant', a: 259, b: 410, light: 'day' },
  { id: 'confront', a: 411, b: 517, light: 'day' },
  { id: 'pitch', a: 518, b: 777, light: 'day' },
  { id: 'pay', a: 778, b: 829, light: 'day' },
  { id: 'test1', a: 830, b: 993, light: 'day' },
  { id: 'test2', a: 994, b: 1130, light: 'day' },
  { id: 'delight', a: 1131, b: 1216, light: 'day' },
  { id: 'question', a: 1217, b: 1344, light: 'day' },
  { id: 'echogold', a: 1345, b: 1413, light: 'day' },
  { id: 'name', a: 1414, b: 1574, light: 'day' },
  { id: 'rage', a: 1575, b: 1711, light: 'day' },
  { id: 'punch', a: 1712, b: 1963, light: 'day' },
  { id: 'hook2', a: 1964, b: 2182, light: 'day' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
M.linear = (t) => clamp(t);

// ---------- lights ----------
const WATER = { waterDeep: '#14425e', waterShal: '#2e7ea6', glint: '#ffe9c0' };
export const LIGHTS = {
  day: { az: 125, el: 44, sky: '#bcd2e8', ground: '#5f6a52', hemi: 1.22, sun: '#fff3da', sunI: 2.2, fog: '#cfd8c2', fogNear: 46, fogFar: 380,
    skyTop: '#5f97d6', skyHor: '#eef0da', sunDisc: '#fff6da', sunSize: 0.003, sat: 1.05, vig: 0.18, shadowExt: 18, aurora: 0, gain: '#ffffff', ...WATER },
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

// ---------- staging ----------
export const POOR = [-1.5, 0, -2.0];           // poor man, by the valley edge
export const MERCH = [0.9, 0, -2.0];           // merchant, at the valley edge
export const SERV1 = [2.1, 0, -3.0];
export const SERV2 = [2.6, 0, -2.2];
export const ROCKC = [0.15, 0, -1.3];          // payment rock (flat top y=0.32)
export const ROCKTOP = 0.32;
export const HUT = [-3.8, 0, -3.6];
export const SAILOR = [26.8, 0.16, -0.8];
export const SIGNP = [28.4, 3.35, -2.0];       // hook board on its signpost
export const CLIFF = [0, 3.6, -6.68];           // echo boards, flush on cliff face

const HERO = {
  open: () => [0, 2.2, -4.0],
  valley: () => [-1.5, 1.1, -2.0],
  merchant: () => [0.9, 1.2, -2.0],
  confront: () => [0.2, 1.2, -2.0],
  pitch: () => [-1.0, 1.2, -2.0],
  pay: () => [0.15, 0.6, -1.3],
  test1: () => [0, 2.4, -5.5],
  test2: () => [0, 2.4, -5.5],
  delight: () => [0.9, 1.2, -2.0],
  question: () => [0.9, 1.3, -2.0],
  echogold: () => [0, 2.4, -5.5],
  name: () => [0, 2.4, -5.5],
  rage: () => [-0.3, 1.2, -2.0],
  punch: () => [-0.5, 1.6, -2.5],
  hook2: () => [28.4, 2.6, -2.0],
};
export const heroPosAt = (f) => HERO[shotAt(f).id](f);

// ---------- cameras ----------
// Continuous flight: every shot's first key repeats the previous shot's
// last key; inside a shot a key lands on each clause subject. During
// echo-answer windows the camera looks UP at the cliff/board.
const CAMS = {
  open: [
    { f: 0, pos: [4.5, 3.0, 10.5], look: [-1.0, 2.2, -4.5], fov: 44 },
    { f: 70, pos: [2.0, 2.6, 8.5], look: [-0.8, 1.9, -4.0], fov: 42, ease: 'surge' },
    { f: 130, pos: [2.2, 2.5, 7.6], look: [-0.9, 1.95, -4.2], fov: 41, ease: 'surge' },
  ],
  valley: [
    { f: 131, pos: [2.2, 2.5, 7.6], look: [-0.9, 1.95, -4.2], fov: 41 },
    { f: 170, pos: [3.2, 2.1, 4.2], look: [-2.2, 1.2, -3.2], fov: 40, ease: 'surge' },
    { f: 215, pos: [2.6, 1.9, 3.6], look: [-1.8, 1.15, -2.6], fov: 39, ease: 'surge' },
    { f: 245, pos: [2.7, 1.95, 3.8], look: [-1.7, 1.15, -2.5], fov: 39, ease: 'surge' },
  ],
  merchant: [
    { f: 259, pos: [2.7, 1.95, 3.8], look: [-1.7, 1.15, -2.5], fov: 39 },
    { f: 300, pos: [4.4, 2.2, 5.6], look: [1.2, 1.3, -2.4], fov: 41, ease: 'surge' },
    { f: 350, pos: [3.0, 1.9, 3.8], look: [1.0, 1.35, -2.3], fov: 38, ease: 'surge' },
    { f: 396, pos: [2.9, 1.9, 3.7], look: [0.9, 1.3, -2.4], fov: 38, ease: 'surge' },
  ],
  confront: [
    { f: 411, pos: [2.9, 1.9, 3.7], look: [0.9, 1.3, -2.4], fov: 38 },
    { f: 450, pos: [2.6, 1.85, 3.4], look: [0.9, 1.45, -2.2], fov: 37, ease: 'surge' },
    { f: 503, pos: [2.7, 1.9, 3.6], look: [0.7, 1.4, -2.3], fov: 37, ease: 'surge' },
  ],
  pitch: [
    { f: 518, pos: [2.7, 1.9, 3.6], look: [0.7, 1.4, -2.3], fov: 37 },
    { f: 560, pos: [3.4, 2.0, 4.8], look: [-1.0, 1.2, -2.2], fov: 39, ease: 'surge' },
    { f: 640, pos: [2.8, 1.9, 3.8], look: [-0.8, 1.25, -2.2], fov: 38, ease: 'surge' },
    { f: 720, pos: [3.0, 1.95, 4.2], look: [-0.5, 1.3, -2.4], fov: 39, ease: 'surge' },
    { f: 765, pos: [3.1, 1.95, 4.3], look: [-0.4, 1.3, -2.4], fov: 39, ease: 'surge' },
  ],
  pay: [
    { f: 778, pos: [3.1, 1.95, 4.3], look: [-0.4, 1.3, -2.4], fov: 39 },
    { f: 800, pos: [2.2, 1.7, 2.9], look: [0.1, 0.9, -1.5], fov: 36, ease: 'surge' },
    { f: 815, pos: [2.3, 1.75, 3.0], look: [0.0, 0.95, -1.6], fov: 36, ease: 'surge' },
  ],
  test1: [
    { f: 830, pos: [2.3, 1.75, 3.0], look: [0.0, 0.95, -1.6], fov: 36 },
    { f: 880, pos: [2.6, 1.9, 3.6], look: [0.9, 1.5, -2.4], fov: 38, ease: 'surge' },
    { f: 940, pos: [3.2, 2.2, 4.6], look: [0, 2.6, -5.8], fov: 40, ease: 'surge' },
    { f: 980, pos: [3.1, 2.15, 4.5], look: [0, 2.5, -5.7], fov: 40, ease: 'surge' },
  ],
  test2: [
    { f: 994, pos: [3.1, 2.15, 4.5], look: [0, 2.5, -5.7], fov: 40 },
    { f: 1030, pos: [2.6, 1.9, 3.6], look: [0.9, 1.5, -2.4], fov: 38, ease: 'surge' },
    { f: 1080, pos: [3.2, 2.2, 4.6], look: [0, 2.6, -5.8], fov: 40, ease: 'surge' },
    { f: 1114, pos: [3.1, 2.15, 4.5], look: [0, 2.5, -5.7], fov: 40, ease: 'surge' },
  ],
  delight: [
    { f: 1131, pos: [3.1, 2.15, 4.5], look: [0, 2.5, -5.7], fov: 40 },
    { f: 1170, pos: [3.4, 2.1, 5.0], look: [0.9, 1.3, -2.3], fov: 40, ease: 'surge' },
    { f: 1204, pos: [3.3, 2.05, 4.9], look: [0.8, 1.3, -2.3], fov: 40, ease: 'surge' },
  ],
  question: [
    { f: 1217, pos: [3.3, 2.05, 4.9], look: [0.8, 1.3, -2.3], fov: 40 },
    { f: 1260, pos: [2.8, 1.9, 3.8], look: [0.9, 1.5, -2.4], fov: 38, ease: 'surge' },
    { f: 1300, pos: [2.5, 1.85, 3.4], look: [0.9, 1.45, -2.4], fov: 37, ease: 'surge' },
    { f: 1332, pos: [2.6, 1.9, 3.6], look: [0.9, 1.4, -2.4], fov: 37, ease: 'surge' },
  ],
  echogold: [
    { f: 1345, pos: [2.6, 1.9, 3.6], look: [0.9, 1.4, -2.4], fov: 37 },
    { f: 1375, pos: [3.2, 2.2, 4.6], look: [0, 2.6, -5.8], fov: 40, ease: 'surge' },
    { f: 1401, pos: [3.1, 2.15, 4.5], look: [0, 2.5, -5.7], fov: 40, ease: 'surge' },
  ],
  name: [
    { f: 1414, pos: [3.1, 2.15, 4.5], look: [0, 2.5, -5.7], fov: 40 },
    { f: 1460, pos: [2.6, 1.9, 3.6], look: [0.9, 1.55, -2.4], fov: 38, ease: 'surge' },
    { f: 1520, pos: [3.2, 2.2, 4.6], look: [0, 2.6, -5.8], fov: 40, ease: 'surge' },
    { f: 1557, pos: [3.1, 2.15, 4.5], look: [0, 2.5, -5.7], fov: 40, ease: 'surge' },
  ],
  rage: [
    { f: 1575, pos: [3.1, 2.15, 4.5], look: [0, 2.5, -5.7], fov: 40 },
    { f: 1620, pos: [3.6, 2.1, 5.2], look: [0.2, 1.3, -2.2], fov: 40, ease: 'surge' },
    { f: 1670, pos: [2.9, 1.9, 3.9], look: [-0.3, 1.35, -2.2], fov: 38, ease: 'surge' },
    { f: 1700, pos: [3.0, 1.95, 4.0], look: [-0.2, 1.3, -2.2], fov: 38, ease: 'surge' },
  ],
  punch: [
    { f: 1712, pos: [3.0, 1.95, 4.0], look: [-0.2, 1.3, -2.2], fov: 38 },
    { f: 1780, pos: [3.4, 2.0, 4.8], look: [-0.9, 1.4, -2.2], fov: 39, ease: 'surge' },
    { f: 1860, pos: [1.6, 2.1, 4.6], look: [-0.2, 2.2, -5.0], fov: 39, ease: 'surge' },
    { f: 1900, pos: [0.9, 2.1, 4.6], look: [0, 2.6, -6.0], fov: 39, ease: 'surge' },
    { f: 1951, pos: [0.9, 2.1, 4.6], look: [0, 2.6, -6.0], fov: 39, ease: 'surge' },
  ],
  hook2: [
    { f: 1964, pos: [0.9, 2.1, 4.6], look: [0, 2.6, -6.0], fov: 39 },
    { f: 2010, pos: [14, 4.5, 8.0], look: [26, 1.2, -2.0], fov: 42, ease: 'surge' },
    { f: 2070, pos: [25.5, 2.6, 5.2], look: [28.2, 1.2, -2.0], fov: 40, ease: 'surge' },
    { f: 2120, pos: [27.6, 2.4, 5.6], look: [28.4, 3.1, -2.0], fov: 40, ease: 'surge' },
    { f: 2182, pos: [27.7, 2.35, 5.4], look: [28.4, 3.15, -2.0], fov: 39, ease: 'surge' },
  ],
};
export const camAt = (f) => camFromKeys(CAMS[shotAt(f).id], f);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const hp = heroPosAt(f);
  let cinf = 5;
  if (['pay', 'test1', 'test2', 'question', 'echogold', 'name', 'rage', 'punch'].includes(S.id)) cinf = 3.6;
  if (S.id === 'hook2') cinf = 3.2;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- physics: dynamic props ----------
// THE COIN POUCH — merchant holds it (card prop, f778-788), sets it down
// so it RESTS on the rock (f788-800, bottom flush at ROCKTOP, contact
// shadow under it), then it rises WITH the poor man's reaching hand
// (f800-814, smooth arc to his hand) and is in his hand (card prop,
// f812-830), then pocketed (hidden).
const POUCH_REST = [ROCKC[0], ROCKTOP + 0.13, ROCKC[2]];
const POUCH_HAND = [-1.05, 1.25, -2.05];
export const dynAt = (f) => {
  const D = {};
  if (f < 788 || f > 814) D.pouch = { vis: false, pos: [0, -99, 0], mode: 'hide' };
  else if (f <= 800) D.pouch = { vis: true, pos: [...POUCH_REST], mode: 'rest' };
  else {
    const u = (f - 800) / 14, p = lerp3(POUCH_REST, POUCH_HAND, smooth(u));
    p[1] += Math.sin(u * Math.PI) * 0.22;
    D.pouch = { vis: true, pos: p, mode: 'lift' };
  }
  // ECHO RINGS — one pulse per echo answer: expand from the cliff face
  // and fade. Events start at the first echoed word.
  let echoU = -1;
  for (const f0 of [949, 1081, 1366, 1525]) {
    if (f >= f0 && f <= f0 + 36) echoU = Math.max(echoU, (f - f0) / 36);
  }
  D.echoU = echoU;
  return D;
};
export const SPLASHES = [];

// ---------- world state ----------
export const worldAt = (f) => {
  const W = { boardTitle: 0, boardRich: 0, boardHome: 0, boardGold: 0, boardName: 0, boardPunch: 0, boardHook: 0 };
  const win = (a, b, c, d) => smooth(ramp(f, a, b)) * (1 - smooth(ramp(f, c, d)));
  if (f <= 130) W.boardTitle = win(8, 20, 100, 112);
  if (f >= 830 && f <= 980) W.boardRich = win(952, 962, 982, 992);
  if (f >= 994 && f <= 1114) W.boardHome = win(1088, 1098, 1110, 1120);
  if (f >= 1345 && f <= 1401) W.boardGold = win(1375, 1385, 1398, 1408);
  if (f >= 1414 && f <= 1557) W.boardName = win(1532, 1542, 1552, 1562);
  if (f >= 1712 && f <= 1951) W.boardPunch = win(1886, 1898, 1938, 1950);
  if (f >= 1964) W.boardHook = smooth(ramp(f, 2115, 2125));   // holds to the last frame — NO fade-out
  return W;
};
export const fxProfileAt = (f) => {
  // valley haze + sea mist; no fire, no steam in this story
  return { smokeRate: 0.25, dustRate: 0.08, splashRate: 0, steamRate: 0 };
};

// ---------- actors ----------
const TINT = { day: '#ffffff' };
const tintFor = (S, f) => TINT[S.light] || '#ffffff';
// COSTUMES BY ROLE — poor man: worn simple clothes + old cap; merchant:
// rich purple + GOLD turban + gold sash + moustache; servants: plain
// village dress; sailor: blue jacket + white cap.
export const OUTFITS = {
  poor: { jacket: '#7a6a4a', pants: '#4a3a28', boots: '#3a2e22', hat: 'cap', cap: '#8a7a5a', skin: '#d9a06a' },
  merchant: { jacket: '#6a2a7a', pants: '#2e1a3a', boots: '#241014', hat: 'turban', turban: '#e8c45a', skin: '#e8b08a', moustache: true, sash: '#e8c45a' },
  servant: { jacket: '#5a6a8a', pants: '#3c4456', boots: '#2e2a24', hat: 'cap', cap: '#d9c9a8', skin: '#e8b08a' },
  servant2: { jacket: '#a8895a', pants: '#6e5a41', boots: '#4a3a28', hat: 'hair', hair: '#33241a', skin: '#c98a5a' },
  sailor: { jacket: '#3a5a8a', pants: '#2e3a4a', boots: '#241a12', hat: 'cap', cap: '#e8e2d2', skin: '#c98a5a' },
};
const RW = (T, o, opts, pos, extra = {}) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], ...extra });
const stand = (T, tint, f) => (o, expr, seed, pos, extra = {}) => RW(T, o, { expr, mode: 'stand', blink: blinkAt(f, seed), seed }, pos, { tint, ...extra });
const withProp = (T, tint, f, out) => (o, expr, seed, pos, prop, extra = {}) => { const a = RW(T, o, { expr, mode: 'stand', blink: blinkAt(f, seed), seed, prop }, pos, { tint, ...extra }); out.push(a); return a; };

export const actorsAt = (f, T) => {
  const S = shotAt(f), tint = tintFor(S, f), out = [];
  const st = stand(T, tint, f), wp = withProp(T, tint, f, out);
  switch (S.id) {
    case 'open': {
      out.push(st(OUTFITS.poor, 'neutral', 51, [-1.6, 0, -1.6], { yaw: 0.4 }));
      break;
    }
    case 'valley': {
      if (f >= 191) wp(OUTFITS.poor, 'grin', 51, POOR, ['point', 1], { yaw: 0.35 });
      else out.push(st(OUTFITS.poor, 'neutral', 51, POOR, { yaw: 0.35 }));
      break;
    }
    case 'merchant': {
      if (f >= 322) wp(OUTFITS.merchant, 'shock', 61, MERCH, ['point', 1], { yaw: -0.25 });
      else out.push(st(OUTFITS.merchant, 'shock', 61, MERCH, { yaw: -0.25 }));
      out.push(st(OUTFITS.servant, 'nervous', 62, SERV1, { yaw: -0.4 }));
      out.push(st(OUTFITS.servant2, 'nervous', 63, SERV2, { yaw: -0.4 }));
      out.push(st(OUTFITS.poor, 'neutral', 51, POOR, { yaw: 0.35 }));
      break;
    }
    case 'confront': {
      out.push(st(OUTFITS.merchant, f < 464 ? 'shock' : 'stern', 61, MERCH, { yaw: -0.5 }));
      out.push(st(OUTFITS.poor, 'neutral', 51, POOR, { yaw: 0.35 }));
      out.push(st(OUTFITS.servant, 'nervous', 62, SERV1, { yaw: -0.4 }));
      break;
    }
    case 'pitch': {
      if (f >= 558 && f < 640) wp(OUTFITS.poor, 'smile', 51, POOR, ['point', 1], { yaw: 0.35 });
      else if (f >= 700) wp(OUTFITS.poor, 'grin', 51, POOR, ['coin', 0.5], { yaw: 0.35 });
      else out.push(st(OUTFITS.poor, 'smile', 51, POOR, { yaw: 0.35 }));
      out.push(st(OUTFITS.merchant, f < 700 ? 'neutral' : 'grin', 61, MERCH, { yaw: -0.5 }));
      out.push(st(OUTFITS.servant, 'neutral', 62, SERV1, { yaw: -0.4 }));
      break;
    }
    case 'pay': {
      if (f < 788) wp(OUTFITS.merchant, 'grin', 61, MERCH, ['sack', 0.55], { yaw: -0.5 });
      else out.push(st(OUTFITS.merchant, 'grin', 61, MERCH, { yaw: -0.5 }));
      if (f >= 812) wp(OUTFITS.poor, 'grin', 51, POOR, ['sack', 0.5], { yaw: 0.35 });
      else out.push(st(OUTFITS.poor, f < 800 ? 'neutral' : 'grin', 51, POOR, { yaw: 0.35 }));
      break;
    }
    case 'test1': {
      if (f >= 870 && f < 949) wp(OUTFITS.merchant, 'shock', 61, MERCH, ['point', 1], { yaw: -0.15 });
      else out.push(st(OUTFITS.merchant, f >= 949 ? 'grin' : 'shock', 61, MERCH, { yaw: -0.15 }));
      out.push(st(OUTFITS.poor, f >= 949 ? 'smile' : 'neutral', 51, POOR, { yaw: 0.35 }));
      break;
    }
    case 'test2': {
      if (f >= 1021 && f < 1090) wp(OUTFITS.merchant, 'shock', 61, MERCH, ['point', 1], { yaw: -0.15 });
      else out.push(st(OUTFITS.merchant, f >= 1090 ? 'grin' : 'shock', 61, MERCH, { yaw: -0.15 }));
      out.push(st(OUTFITS.poor, f >= 1090 ? 'smile' : 'neutral', 51, POOR, { yaw: 0.35 }));
      break;
    }
    case 'delight': {
      out.push(st(OUTFITS.merchant, 'laugh', 61, MERCH, { yaw: -0.15 }));
      out.push(st(OUTFITS.poor, 'grin', 51, POOR, { yaw: 0.35 }));
      out.push(st(OUTFITS.servant, 'smile', 62, SERV1, { yaw: -0.4 }));
      out.push(st(OUTFITS.servant2, 'smile', 63, SERV2, { yaw: -0.4 }));
      break;
    }
    case 'question': {
      if (f >= 1286) wp(OUTFITS.merchant, 'shock', 61, MERCH, ['point', 1], { yaw: -0.15 });
      else out.push(st(OUTFITS.merchant, 'stern', 61, MERCH, { yaw: -0.15 }));
      out.push(st(OUTFITS.poor, 'neutral', 51, POOR, { yaw: 0.35 }));
      break;
    }
    case 'echogold': {
      out.push(st(OUTFITS.merchant, 'nervous', 61, MERCH, { yaw: -0.15 }));
      out.push(st(OUTFITS.poor, 'neutral', 51, POOR, { yaw: 0.35 }));
      break;
    }
    case 'name': {
      if (f >= 1429 && f < 1497) wp(OUTFITS.merchant, 'shock', 61, MERCH, ['point', 1], { yaw: -0.15 });
      else out.push(st(OUTFITS.merchant, f >= 1497 ? 'pained' : 'shock', 61, MERCH, { yaw: -0.15 }));
      out.push(st(OUTFITS.poor, 'neutral', 51, POOR, { yaw: 0.35 }));
      break;
    }
    case 'rage': {
      // merchant has marched back to the poor man (shot change covers the move)
      out.push(st(OUTFITS.merchant, 'stern', 61, [0.1, 0, -2.0], { yaw: -0.5 }));
      if (f >= 1630) wp(OUTFITS.poor, 'nervous', 51, POOR, ['point', 0.6], { yaw: 0.35 });
      else out.push(st(OUTFITS.poor, 'nervous', 51, POOR, { yaw: 0.35 }));
      break;
    }
    case 'punch': {
      out.push(st(OUTFITS.poor, 'grin', 51, POOR, { yaw: 0.35 }));
      out.push(st(OUTFITS.merchant, 'dazed', 61, [0.1, 0, -2.0], { yaw: -0.5 }));
      break;
    }
    case 'hook2': {
      wp(OUTFITS.sailor, 'grin', 71, SAILOR, ['bowl', 0.5], { yaw: 0.3 });
      break;
    }
  }
  return out;
};
export const fxAt = (f, T) => [];
