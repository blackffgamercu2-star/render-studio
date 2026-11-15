// Shot plan for "The Soup Made From a Stone" (batch-4 topic 3, EN) —
// timed to the ACTUAL voice stem (62.21 s, 30 fps, TOTAL 1866), clause
// timings from faster-whisper alignment of stem_en.wav (208 words):
// C1 0-140 feast-from-a-stone hook | C2 141-236 knocked, nobody shared |
// C3 237-415 square, fire, pot of water, stone DROPPED f372-383 |
// C4 416-480 woman: "What are you cooking?" | C5 481-623 "Stone soup…
// needs a little salt" | C6 624-774 salt IN f636-648, farmer, onions IN
// f762-774 | C7 775-906 "with a few carrots… fit for a king" |
// C8 907-1063 carrots IN 911-923, potatoes dip 941-965, beans dip
// 972-996, chicken IN 1003-1017 | C9 1064-1179 village gathers, stirring |
// C10 1180-1282 ladled for everyone | C11 1283-1386 feast "All from a
// stone!" | C12 1387-1474 stone fished OUT f1402-1420, dried, pocketed |
// C13 1475-1565 "works every time… needs good neighbours" |
// C14 1566-1865 hook: one grain of rice doubled on a chessboard.
// QUALITY RULES (locked): shots change ONLY at clause boundaries; camera
// TRACKS the voice-named subject; characters act in place (planted feet);
// costumes by role (traveller = worn simple clothes, villagers = village
// dress, priest = dark robe, king = royal red + gold turban).
// PHYSICS RULES (Abid 2026-11-15, TOP priority): the pot sits ON its
// stones over the fire; every ingredient is carried and lands IN the pot
// (gravity fall, splash, settle — nothing hovers); the ladle dips INTO
// the soup; the stone falls with gravity and is fished out rising WITH
// the traveller's hand. Contact beats are all computed in dynAt below.
// World: village square x=0 (facade z=-4.6 with three doors, pot at
// [0,0,-1.2] on its stone ring over the fire), king's court x=+32.
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1866, DECK = 0;
export const SHOTS = [
  { id: 'open', a: 0, b: 140, light: 'day' },
  { id: 'doors', a: 141, b: 236, light: 'day' },
  { id: 'setup', a: 237, b: 415, light: 'day' },
  { id: 'woman', a: 416, b: 623, light: 'day' },
  { id: 'salt', a: 624, b: 774, light: 'day' },
  { id: 'carrots', a: 775, b: 906, light: 'day' },
  { id: 'parade', a: 907, b: 1063, light: 'day' },
  { id: 'gather', a: 1064, b: 1179, light: 'day' },
  { id: 'serve', a: 1180, b: 1282, light: 'day' },
  { id: 'feast', a: 1283, b: 1386, light: 'day' },
  { id: 'stoneout', a: 1387, b: 1565, light: 'day' },
  { id: 'hook2', a: 1566, b: 1865, light: 'day' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
M.linear = (t) => clamp(t);

// ---------- lights ----------
const WATER = { waterDeep: '#223c4e', waterShal: '#2c4a63', glint: '#ffe9c0' };
export const LIGHTS = {
  day: { az: 125, el: 44, sky: '#bcd2e8', ground: '#5f6a52', hemi: 1.22, sun: '#fff3da', sunI: 2.2, fog: '#cfd8c2', fogNear: 46, fogFar: 380,
    skyTop: '#5f97d6', skyHor: '#eef0da', sunDisc: '#fff6da', sunSize: 0.003, sat: 1.05, vig: 0.18, shadowExt: 18, aurora: 0, gain: '#ffffff', ...WATER },
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

// ---------- staging ----------
export const POTC = [0, 0, -1.2];              // the great pot, on its stones over the fire
export const SURF = 0.88;                      // soup surface height inside the pot
export const TRAV = [-1.35, 0, -0.95];         // traveller, west of the pot
export const WOM = [1.7, 0, -1.9];
export const FARM = [2.05, 0, -1.35];
export const V3P = [-1.75, 0, -1.85];
export const PRIESTP = [2.5, 0, -2.3];
export const V1P = [1.7, 0, 0.7];              // seated villagers (front)
export const V2P = [-1.8, 0, 0.8];
export const DOORA = [-1.6, 0, -4.6];
export const BENCH = [32, 0, -4.6];
export const CHESS = [31.3, 0, -3.3];
export const SIGNP = [28.4, 3.35, -2.0];       // hook board on its signpost

const HERO = {
  open: () => [-0.7, 1.0, -1.1],
  doors: () => [-1.2, 1.1, -3.6],
  setup: () => [0, 0.8, -1.2],
  woman: () => [0.4, 1.15, -1.4],
  salt: () => [0.2, 0.95, -1.2],
  carrots: () => [-0.8, 1.15, -1.2],
  parade: () => [0, 0.95, -1.2],
  gather: () => [0, 1.0, -1.2],
  serve: () => [0, 0.95, -1.2],
  feast: () => [0.4, 1.1, -1.4],
  stoneout: () => [-0.5, 1.0, -1.1],
  hook2: () => [31.3, 0.9, -3.3],
};
export const heroPosAt = (f) => HERO[shotAt(f).id](f);

// ---------- cameras ----------
// Continuous flight: every shot's first key repeats the previous shot's
// last key; inside a shot a key lands on each clause subject.
const CAMS = {
  open: [
    { f: 0, pos: [7.0, 3.4, 10.0], look: [0, 2.0, -3.0], fov: 46 },
    { f: 70, pos: [4.2, 2.3, 6.0], look: [0, 1.9, -3.0], fov: 41, ease: 'surge' },
    { f: 140, pos: [4.0, 2.25, 5.7], look: [0, 1.87, -2.97], fov: 40, ease: 'surge' },
  ],
  doors: [
    { f: 141, pos: [4.0, 2.25, 5.7], look: [0, 1.87, -2.97], fov: 40 },
    { f: 168, pos: [2.4, 2.2, 3.6], look: [-1.25, 1.15, -4.2], fov: 40, ease: 'surge' },
    { f: 205, pos: [2.3, 2.35, 3.4], look: [-1.3, 1.1, -4.15], fov: 39, ease: 'surge' },
    { f: 236, pos: [2.35, 2.3, 3.5], look: [-1.25, 1.08, -4.1], fov: 39, ease: 'surge' },
  ],
  setup: [
    { f: 237, pos: [2.35, 2.3, 3.5], look: [-1.25, 1.08, -4.1], fov: 39 },
    { f: 283, pos: [5.6, 2.9, 7.6], look: [0, 1.0, -1.5], fov: 43, ease: 'surge' },
    { f: 330, pos: [2.9, 1.75, 3.5], look: [0, 0.8, -1.2], fov: 39, ease: 'surge' },
    { f: 372, pos: [1.95, 1.6, 2.2], look: [-0.2, 0.95, -1.2], fov: 36, ease: 'surge' },
    { f: 415, pos: [2.2, 1.7, 2.6], look: [-0.1, 0.95, -1.2], fov: 37, ease: 'surge' },
  ],
  woman: [
    { f: 416, pos: [2.2, 1.7, 2.6], look: [-0.1, 0.95, -1.2], fov: 37 },
    { f: 470, pos: [3.7, 2.05, 4.9], look: [0.4, 1.15, -1.45], fov: 41, ease: 'surge' },
    { f: 520, pos: [3.0, 1.9, 3.7], look: [1.3, 1.2, -1.8], fov: 39, ease: 'surge' },
    { f: 580, pos: [3.9, 2.2, 5.8], look: [0.1, 1.85, -2.9], fov: 41, ease: 'surge' },
    { f: 623, pos: [3.8, 2.15, 5.6], look: [0.1, 1.8, -2.9], fov: 40, ease: 'surge' },
  ],
  salt: [
    { f: 624, pos: [3.8, 2.15, 5.6], look: [0.1, 1.8, -2.9], fov: 40 },
    { f: 660, pos: [3.4, 2.0, 4.6], look: [0.7, 1.1, -1.5], fov: 39, ease: 'surge' },
    { f: 720, pos: [3.9, 2.2, 5.8], look: [0.1, 1.85, -2.9], fov: 41, ease: 'surge' },
    { f: 752, pos: [3.9, 2.2, 5.8], look: [0.1, 1.85, -2.9], fov: 41, ease: 'surge' },
    { f: 774, pos: [2.5, 1.8, 3.1], look: [0.2, 0.95, -1.2], fov: 37, ease: 'surge' },
  ],
  carrots: [
    { f: 775, pos: [2.5, 1.8, 3.1], look: [0.2, 0.95, -1.2], fov: 37 },
    { f: 833, pos: [4.0, 2.2, 5.8], look: [0.1, 1.85, -2.9], fov: 41, ease: 'surge' },
    { f: 906, pos: [4.0, 2.2, 5.8], look: [0.1, 1.85, -2.9], fov: 41, ease: 'surge' },
  ],
  parade: [
    { f: 907, pos: [4.0, 2.2, 5.8], look: [0.1, 1.85, -2.9], fov: 41 },
    { f: 933, pos: [2.4, 1.8, 3.0], look: [-0.9, 1.0, -1.5], fov: 38, ease: 'surge' },
    { f: 962, pos: [2.9, 1.85, 3.2], look: [0.8, 1.0, -1.4], fov: 38, ease: 'surge' },
    { f: 991, pos: [2.8, 1.85, 3.3], look: [0.3, 1.0, -1.5], fov: 38, ease: 'surge' },
    { f: 1034, pos: [3.2, 1.95, 3.8], look: [0.6, 1.0, -1.5], fov: 39, ease: 'surge' },
    { f: 1063, pos: [3.9, 2.15, 5.2], look: [0, 1.05, -1.35], fov: 41, ease: 'surge' },
  ],
  gather: [
    { f: 1064, pos: [3.9, 2.15, 5.2], look: [0, 1.05, -1.35], fov: 41 },
    { f: 1120, pos: [5.1, 2.7, 7.2], look: [0, 1.0, -1.2], fov: 43, ease: 'surge' },
    { f: 1179, pos: [2.7, 1.8, 3.3], look: [0, 0.95, -1.2], fov: 38, ease: 'surge' },
  ],
  serve: [
    { f: 1180, pos: [2.7, 1.8, 3.3], look: [0, 0.95, -1.2], fov: 38 },
    { f: 1212, pos: [3.4, 1.95, 4.6], look: [1.45, 0.95, 0.45], fov: 40, ease: 'surge' },
    { f: 1252, pos: [4.1, 2.0, 5.2], look: [2.2, 1.0, 0.5], fov: 40, ease: 'surge' },
    { f: 1282, pos: [3.8, 1.98, 4.9], look: [1.6, 1.0, 0.3], fov: 39, ease: 'surge' },
  ],
  feast: [
    { f: 1283, pos: [3.8, 1.98, 4.9], look: [1.6, 1.0, 0.3], fov: 39 },
    { f: 1335, pos: [4.2, 2.2, 5.8], look: [0.1, 1.85, -2.9], fov: 41, ease: 'surge' },
    { f: 1386, pos: [4.6, 2.3, 6.2], look: [0.1, 1.8, -2.85], fov: 41, ease: 'surge' },
  ],
  stoneout: [
    { f: 1387, pos: [4.6, 2.3, 6.2], look: [0.1, 1.8, -2.85], fov: 41 },
    { f: 1420, pos: [2.2, 1.7, 2.8], look: [-0.3, 1.0, -1.15], fov: 37, ease: 'surge' },
    { f: 1500, pos: [3.0, 1.9, 4.0], look: [-0.9, 1.15, -1.1], fov: 38, ease: 'surge' },
    { f: 1565, pos: [3.2, 1.95, 4.2], look: [-0.7, 1.12, -1.15], fov: 38, ease: 'surge' },
  ],
  hook2: [
    { f: 1566, pos: [3.2, 1.95, 4.2], look: [-0.7, 1.12, -1.15], fov: 38 },
    { f: 1620, pos: [16, 5.2, 8.5], look: [30, 1.0, -3.0], fov: 42, ease: 'surge' },
    { f: 1690, pos: [27.6, 2.3, 4.6], look: [31.2, 1.2, -3.4], fov: 40, ease: 'surge' },
    { f: 1766, pos: [28.4, 2.1, 3.4], look: [30.6, 1.1, -3.2], fov: 39, ease: 'surge' },
    { f: 1810, pos: [27.6, 2.4, 5.6], look: [28.4, 3.1, -2.0], fov: 40, ease: 'surge' },
    { f: 1865, pos: [27.7, 2.35, 5.4], look: [28.4, 3.15, -2.0], fov: 39, ease: 'surge' },
  ],
};
export const camAt = (f) => camFromKeys(CAMS[shotAt(f).id], f);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const hp = heroPosAt(f);
  let cinf = 5;
  if (['setup', 'salt', 'parade', 'gather', 'serve', 'stoneout'].includes(S.id)) cinf = 3.6;
  if (S.id === 'hook2') cinf = 3.2;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- physics: dynamic props ----------
// A carried item flies from the bringer's hand to above the pot mouth
// (arc), then FALLS with gravity (u^2) into the pot and is gone (it is
// IN the soup). A sack instead dips into the mouth, tilts (pour), and
// returns to the hand empty.
const MOUTH = [0, 1.78, -1.2];
const flight = (f, f0, dur, from, dip = false) => {
  if (f < f0 || f > f0 + dur) return { vis: false, pos: [0, -99, 0], tilt: 0 };
  const u = (f - f0) / dur;
  if (!dip) {
    if (u < 0.55) {
      const v = u / 0.55, p = lerp3(from, MOUTH, v); p[1] += Math.sin(v * Math.PI) * 0.16;
      return { vis: true, pos: p, tilt: 0 };
    }
    const v = (u - 0.55) / 0.45;
    return { vis: v < 1, pos: [MOUTH[0], lerp(MOUTH[1], SURF - 0.1, v * v), MOUTH[2]], tilt: 0 };
  }
  // dip-and-return (sack pour): hand -> mouth -> tilt -> hand
  if (u < 0.35) { const v = u / 0.35, p = lerp3(from, MOUTH, v); p[1] += Math.sin(v * Math.PI) * 0.14; return { vis: true, pos: p, tilt: 0 }; }
  if (u < 0.55) { const v = (u - 0.35) / 0.2; return { vis: true, pos: [MOUTH[0], lerp(MOUTH[1], 1.15, v * v), MOUTH[2]], tilt: v * 1.9 }; }
  if (u < 0.7) { return { vis: true, pos: [MOUTH[0], 1.15, MOUTH[2]], tilt: 1.9 }; }
  const v = (u - 0.7) / 0.3, p = lerp3([MOUTH[0], 1.15, MOUTH[2]], from, v); p[1] += Math.sin(v * Math.PI) * 0.25;
  return { vis: true, pos: p, tilt: 1.9 * (1 - v) };
};
// hand positions (world) the flights start from — matched to the cards
const HAND = {
  trav: [-0.82, 1.42, -1.0], wom: [1.28, 1.05, -1.75], farm: [1.6, 1.05, -1.2],
  v3: [-1.3, 1.05, -1.7], priest: [2.05, 1.1, -2.1],
};
export const dynAt = (f) => {
  const D = {};
  // THE STONE — card-held, then a real gravity drop into the pot (C3),
  // hidden in the soup, then fished out rising to the hand (C12).
  if (f < 372) D.stone = { vis: false, pos: [0, -99, 0] };
  else if (f <= 383) {
    const u = (f - 372) / 11;
    const v = Math.pow(u, 0.6); D.stone = { vis: true, pos: [lerp(HAND.trav[0], 0, v), lerp(HAND.trav[1], SURF, u * u), lerp(HAND.trav[2], -1.2, v)] };
  } else if (f < 1402) D.stone = { vis: false, pos: [0, -99, 0] };
  else if (f <= 1420) {
    const u = (f - 1402) / 18, p = lerp3([0, SURF, -1.2], [-0.88, 1.12, -1.02], u);
    p[1] += Math.sin(u * Math.PI) * 0.12;
    D.stone = { vis: true, pos: p };
  } else D.stone = { vis: false, pos: [0, -99, 0] };
  // INGREDIENTS — each lands IN the pot at its clause
  D.salt = flight(f, 636, 12, HAND.wom);
  D.onions = flight(f, 762, 12, HAND.farm);
  D.carrots = flight(f, 911, 12, HAND.v3);
  D.potSack = flight(f, 941, 24, HAND.farm, true);
  D.beanSack = flight(f, 972, 24, HAND.wom, true);
  D.chicken = flight(f, 1003, 14, HAND.priest);
  // THE LADLE — rests across the rim, stirs IN the soup (C9), then dips
  // and serves bowl 1 and bowl 2 (C10). Cup always enters the pot mouth.
  const ladle = { vis: f >= 1064, pos: [0.3, 1.12, -1.05], rz: -0.6, rx: 0.2 };
  if (f >= 1115 && f <= 1179) {
    const a = (f - 1115) * 0.22;
    ladle.pos = [Math.cos(a) * 0.17, 1.02, -1.2 + Math.sin(a) * 0.17];
    ladle.rz = Math.cos(a) * 0.45; ladle.rx = Math.sin(a) * 0.3 + 0.15;
  }
  const serveCycle = (f0, bowl) => {
    if (f < f0 || f > f0 + 40) return;
    const u = (f - f0) / 40;
    if (u < 0.3) { const v = u / 0.3; ladle.pos = [lerp(0.3, 0, v), lerp(1.12, 0.94, v * v), lerp(-1.05, -1.2, v)]; ladle.rz = lerp(-0.6, 0.1, v); ladle.rx = 0.15; }
    else if (u < 0.62) { const v = (u - 0.3) / 0.32, p = lerp3([0, 0.94, -1.2], bowl, v); p[1] += Math.sin(v * Math.PI) * 0.35; ladle.pos = p; ladle.rz = 0.35; ladle.rx = 0.1; }
    else if (u < 0.8) { ladle.pos = [...bowl]; ladle.rz = 1.85; ladle.rx = 0.1; }   // the pour — cup tips over the bowl
    else { const v = (u - 0.8) / 0.2, p = lerp3(bowl, [0.3, 1.12, -1.05], v); p[1] += Math.sin(v * Math.PI) * 0.3; ladle.pos = p; ladle.rz = lerp(1.85, -0.6, v); ladle.rx = 0.2; }
  };
  serveCycle(1186, [2.2, 1.18, 0.75]);
  serveCycle(1241, [3.0, 1.16, 0.42]);
  D.ladle = ladle;
  // soup richness 0..1 — steps up as each ingredient lands
  let soup = 0;
  for (const [lf, v] of [[648, 0.2], [774, 0.38], [923, 0.55], [965, 0.7], [996, 0.85], [1017, 1]]) {
    if (f >= lf - 6) soup = Math.max(soup, lerp(soup, v, smooth(ramp(f, lf - 6, lf + 14))));
  }
  D.soupK = soup;
  // the door of the middle house — opens for the refusal, then shuts
  D.doorK = smooth(ramp(f, 183, 192)) * (1 - smooth(ramp(f, 212, 221)));
  // the fire is built at "built a fire" (f283)
  D.fireK = smooth(ramp(f, 283, 300));
  return D;
};
// splash bursts (frame, power) — fired by main's deterministic fx stepper
export const SPLASHES = [
  { f: 383, n: 22, power: 3.1 }, { f: 648, n: 12, power: 2.2 }, { f: 774, n: 18, power: 3.2 },
  { f: 923, n: 16, power: 2.8 }, { f: 1017, n: 24, power: 3.4 },
];

// ---------- world state ----------
export const worldAt = (f) => {
  const W = { boardTitle: 0, boardSalt: 0, boardOnion: 0, boardCarrot: 0, boardFeast: 0, boardHook: 0 };
  const win = (a, b, c, d) => smooth(ramp(f, a, b)) * (1 - smooth(ramp(f, c, d)));
  if (f <= 140) W.boardTitle = win(8, 20, 100, 112);
  if (f >= 416 && f <= 623) W.boardSalt = win(560, 572, 606, 618);
  if (f >= 624 && f <= 774) W.boardOnion = win(716, 728, 738, 750);
  if (f >= 775 && f <= 906) W.boardCarrot = win(856, 868, 892, 904);
  if (f >= 1283 && f <= 1386) W.boardFeast = win(1328, 1340, 1370, 1382);
  if (f >= 1566) W.boardHook = smooth(ramp(f, 1802, 1812));   // holds to the last frame — NO fade-out
  return W;
};
export const fxProfileAt = (f) => {
  // steam over the pot: a wisp once the water is on, a full plume once
  // the soup is rich and the village gathers
  let steam = 0;
  if (f >= 330) steam = 0.35;
  if (f >= 907) steam = 0.8;
  if (f >= 1064) steam = 1.15;
  return { smokeRate: 0.3, dustRate: 0.08, splashRate: 0, steamRate: steam };
};

// ---------- actors ----------
const TINT = { day: '#ffffff' };
const tintFor = (S, f) => TINT[S.light] || '#ffffff';
// COSTUMES BY ROLE — traveller: worn simple clothes + old cap; woman:
// village dress; farmer & villagers: simple village clothes (distinct
// colours); priest: dark robe; king: royal red + GOLD turban.
export const OUTFITS = {
  traveller: { jacket: '#8a6a4a', pants: '#5a4632', boots: '#3a2e22', hat: 'cap', cap: '#b39b72', skin: '#e8b08a' },
  woman: { jacket: '#8c3a54', dress: '#8c3a54', pants: '#4a2432', boots: '#33231d', hat: 'hair', hair: '#241a12', skin: '#e8b08a' },
  farmer: { jacket: '#6a7a4a', pants: '#44503a', boots: '#3a2e22', hat: 'cap', cap: '#e8dcc4', skin: '#c98a5a' },
  villager: { jacket: '#5a6a8a', pants: '#3c4456', boots: '#2e2a24', hat: 'cap', cap: '#d9c9a8', skin: '#e8b08a' },
  villager2: { jacket: '#a8895a', pants: '#6e5a41', boots: '#4a3a28', hat: 'hair', hair: '#33241a', skin: '#c98a5a' },
  priest: { jacket: '#3a3230', dress: '#3a3230', pants: '#2a2422', boots: '#1c1a17', hat: 'turban', turban: '#e8e2d2', skin: '#c98a5a' },
  king: { jacket: '#7a1f2b', dress: '#7a1f2b', pants: '#4a1420', boots: '#241014', hat: 'turban', turban: '#e8c45a', skin: '#e8b08a', moustache: true },
  poorfarmer: { jacket: '#9a7a52', pants: '#66523a', boots: '#40342a', hat: 'cap', cap: '#cbb894', skin: '#c98a5a' },
};
const RW = (T, o, opts, pos, extra = {}) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], ...extra });
const stand = (T, tint, f) => (o, expr, seed, pos, extra = {}) => RW(T, o, { expr, mode: 'stand', blink: blinkAt(f, seed), seed }, pos, { tint, ...extra });
const withProp = (T, tint, f, out) => (o, expr, seed, pos, prop, extra = {}) => { const a = RW(T, o, { expr, mode: 'stand', blink: blinkAt(f, seed), seed, prop }, pos, { tint, ...extra }); out.push(a); return a; };

export const actorsAt = (f, T) => {
  const S = shotAt(f), tint = tintFor(S, f), out = [];
  const st = stand(T, tint, f), wp = withProp(T, tint, f, out);
  switch (S.id) {
    case 'open': {
      wp(OUTFITS.traveller, 'grin', 51, TRAV, ['stone', 0.62], { yaw: 0.3 });
      out.push(st(OUTFITS.woman, 'neutral', 52, WOM, { yaw: -0.3 }));
      out.push(st(OUTFITS.farmer, 'neutral', 53, FARM, { yaw: -0.5 }));
      break;
    }
    case 'doors': {
      const knock = f >= 148 && f <= 182 ? 0.62 + 0.3 * Math.abs(Math.sin(f * 0.55)) : 0.7;
      wp(OUTFITS.traveller, f < 200 ? 'nervous' : 'pained', 51, [-0.55, 0, -3.35], ['push', q(knock)], { yaw: 0.12 });
      if (f >= 186 && f <= 214) out.push(st(OUTFITS.woman, 'stern', 52, [-1.6, 0, -4.28], { yaw: 0 }));
      break;
    }
    case 'setup': {
      if (f < 283) out.push(RW(T, OUTFITS.traveller, { expr: 'neutral', mode: 'sit', blink: blinkAt(f, 51), seed: 51 }, [-0.85, 0, -0.35], { tint, yaw: 0.5 }));
      else if (f < 372) wp(OUTFITS.traveller, 'grin', 51, TRAV, ['stone', 0.85], { yaw: 0.3 });
      else out.push(st(OUTFITS.traveller, 'grin', 51, TRAV, { yaw: 0.3 }));
      break;
    }
    case 'woman': {
      if (f >= 481 && f <= 565) wp(OUTFITS.traveller, 'grin', 51, TRAV, ['point', 1], { yaw: 0.3 });
      else out.push(st(OUTFITS.traveller, 'grin', 51, TRAV, { yaw: 0.3 }));
      out.push(st(OUTFITS.woman, f < 455 ? 'shock' : (f < 565 ? 'neutral' : 'smile'), 52, WOM, { yaw: -0.3 }));
      break;
    }
    case 'salt': {
      if (f < 636) wp(OUTFITS.woman, 'smile', 52, WOM, ['saltbowl', 0.55], { yaw: -0.3 });
      else out.push(st(OUTFITS.woman, 'smile', 52, WOM, { yaw: -0.3 }));
      if (f >= 690 && f < 762) wp(OUTFITS.farmer, 'grin', 53, FARM, ['onions', 0.5], { yaw: -0.5 });
      else out.push(st(OUTFITS.farmer, f < 690 ? 'neutral' : 'grin', 53, FARM, { yaw: -0.5 }));
      out.push(st(OUTFITS.traveller, 'grin', 51, TRAV, { yaw: 0.3 }));
      break;
    }
    case 'carrots': {
      if (f >= 833) wp(OUTFITS.traveller, 'grin', 51, TRAV, ['point', 1], { yaw: 0.3 });
      else out.push(st(OUTFITS.traveller, 'grin', 51, TRAV, { yaw: 0.3 }));
      if (f >= 845) wp(OUTFITS.villager2, 'smile', 54, V3P, ['carrots', 0.5], { yaw: 0.45 });
      else out.push(st(OUTFITS.villager2, 'neutral', 54, V3P, { yaw: 0.45 }));
      out.push(st(OUTFITS.woman, 'smile', 52, WOM, { yaw: -0.3 }));
      out.push(st(OUTFITS.farmer, 'grin', 53, FARM, { yaw: -0.5 }));
      break;
    }
    case 'parade': {
      out.push(st(OUTFITS.traveller, 'grin', 51, TRAV, { yaw: 0.3 }));
      if (f < 911) wp(OUTFITS.villager2, 'smile', 54, V3P, ['carrots', 0.5], { yaw: 0.45 });
      else out.push(st(OUTFITS.villager2, 'smile', 54, V3P, { yaw: 0.45 }));
      if (f >= 933 && f < 941) wp(OUTFITS.farmer, 'grin', 53, FARM, ['sack', 0.5], { yaw: -0.5 });
      else if (f >= 966) wp(OUTFITS.farmer, 'grin', 53, FARM, ['sack', 0.35], { yaw: -0.5 });
      else out.push(st(OUTFITS.farmer, 'grin', 53, FARM, { yaw: -0.5 }));
      if (f >= 964 && f < 972) wp(OUTFITS.woman, 'smile', 52, WOM, ['sack', 0.5], { yaw: -0.3 });
      else if (f >= 997) wp(OUTFITS.woman, 'smile', 52, WOM, ['sack', 0.35], { yaw: -0.3 });
      else out.push(st(OUTFITS.woman, 'smile', 52, WOM, { yaw: -0.3 }));
      if (f >= 995 && f < 1003) wp(OUTFITS.priest, 'neutral', 55, PRIESTP, ['chicken', 0.5], { yaw: -0.6 });
      else out.push(st(OUTFITS.priest, 'neutral', 55, PRIESTP, { yaw: -0.6 }));
      break;
    }
    case 'gather': {
      out.push(st(OUTFITS.traveller, 'grin', 51, TRAV, { yaw: 0.3 }));
      wp(OUTFITS.woman, 'smile', 52, WOM, ['bowl', 0.45], { yaw: -0.3 });
      wp(OUTFITS.farmer, 'grin', 53, FARM, ['bowl', 0.45], { yaw: -0.5 });
      out.push(RW(T, OUTFITS.villager, { expr: 'smile', mode: 'sit', blink: blinkAt(f, 56), seed: 56, prop: ['bowl', 0.45] }, V1P, { tint, yaw: -0.2 }));
      out.push(RW(T, OUTFITS.villager2, { expr: 'smile', mode: 'sit', blink: blinkAt(f, 57), seed: 57, prop: ['bowl', 0.45] }, V2P, { tint, yaw: 0.2 }));
      out.push(st(OUTFITS.priest, 'smile', 55, PRIESTP, { yaw: -0.6 }));
      break;
    }
    case 'serve': {
      out.push(st(OUTFITS.traveller, 'grin', 51, TRAV, { yaw: 0.3 }));
      out.push(RW(T, OUTFITS.villager, { expr: f >= 1219 ? 'smile' : 'neutral', mode: 'stand', blink: blinkAt(f, 56), seed: 56, prop: ['bowl', 0.45] }, V1P, { tint, yaw: -0.2 }));
      out.push(RW(T, OUTFITS.villager2, { expr: f >= 1271 ? 'smile' : 'neutral', mode: 'stand', blink: blinkAt(f, 57), seed: 57, prop: ['bowl', 0.45] }, [2.5, 0, 0.35], { tint, yaw: 0.2 }));
      wp(OUTFITS.woman, 'smile', 52, WOM, ['bowl', 0.45], { yaw: -0.3 });
      wp(OUTFITS.farmer, 'grin', 53, FARM, ['bowl', 0.45], { yaw: -0.5 });
      break;
    }
    case 'feast': {
      out.push(st(OUTFITS.traveller, 'laugh', 51, TRAV, { yaw: 0.3 }));
      wp(OUTFITS.woman, 'laugh', 52, WOM, ['bowl', 0.5], { yaw: -0.3 });
      wp(OUTFITS.farmer, 'laugh', 53, FARM, ['bowl', 0.5], { yaw: -0.5 });
      out.push(RW(T, OUTFITS.villager, { expr: 'laugh', mode: 'sit', blink: blinkAt(f, 56), seed: 56, prop: ['bowl', 0.5] }, V1P, { tint, yaw: -0.2 }));
      out.push(RW(T, OUTFITS.villager2, { expr: 'smile', mode: 'sit', blink: blinkAt(f, 57), seed: 57, prop: ['bowl', 0.5] }, V2P, { tint, yaw: 0.2 }));
      out.push(st(OUTFITS.priest, 'laugh', 55, PRIESTP, { yaw: -0.6 }));
      break;
    }
    case 'stoneout': {
      if (f >= 1421 && f <= 1452) wp(OUTFITS.traveller, 'grin', 51, TRAV, ['stone', 0.4], { yaw: 0.3 });
      else out.push(st(OUTFITS.traveller, 'grin', 51, TRAV, { yaw: 0.3 }));
      out.push(st(OUTFITS.woman, 'smile', 52, WOM, { yaw: -0.3 }));
      out.push(st(OUTFITS.farmer, 'smile', 53, FARM, { yaw: -0.5 }));
      break;
    }
    case 'hook2': {
      out.push(st(OUTFITS.king, f < 1808 ? 'neutral' : 'shock', 71, BENCH, { yaw: 0 }));
      if (f >= 1690 && f <= 1762) wp(OUTFITS.poorfarmer, 'nervous', 81, [30.6, 0, -2.1], ['point', 1], { yaw: 0.35 });
      else out.push(st(OUTFITS.poorfarmer, 'nervous', 81, [30.6, 0, -2.1], { yaw: 0.35 }));
      break;
    }
  }
  return out;
};
export const fxAt = (f, T) => [];
