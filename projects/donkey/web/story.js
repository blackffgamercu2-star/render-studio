// Shot plan for "The Man Who Promised to Teach a Donkey to Talk" (batch-3 topic 1, EN) —
// timed to the ACTUAL voice stem (62.37 s, 30 fps, TOTAL 1872), clause
// timings from faster-whisper small.en alignment (220 words, 25 clauses):
// C1 0-112 hook: poor man promised | C2 119-178 king agreed, went home celebrating |
// C3 194-238 stepped forward in court | C4 248-335 "give me one year — donkey will talk" |
// C5 348-376 court went silent | C6 386-413 king leaned forward |
// C7 425-515 "if donkey speaks, house full of gold" | C8 521-625 "if it doesn't... lose your head" |
// C9 637-718 bowed, took gold, walked home whistling | C10 730-757 wife turned white |
// C11 765-827 "are you mad? donkey cannot talk!" | C12 838-851 he laughed |
// C13 852-913 "in one year, anything can happen" | C14 923-997 king may die / donkey may die / I may die |
// C15 1006-1070 "a year is long" | C16 1079-1130 "maybe donkey will learn one word" |
// C17 1144-1193 a year passed, soldiers came | C18 1203-1220 the man bowed |
// C19 1232-1332 "listen — donkey can already say its first sound" |
// C20 1342-1385 donkey brayed — hee-haw | C21 1391-1439 whole court burst out laughing |
// C22 1452-1554 king laughed till he cried, forgave, one more year |
// C23 1565-1700 next village: borrowed pot, baby pot inside |
// C24 1710-1798 "pot had given birth", neighbour believed him |
// C25 1807-1868 "until he borrowed gold. What happened then?"
// QUALITY RULES (owner, batch-2/3): shots change ONLY at clause boundaries;
// camera TRACKS the voice-named subject every beat (biggest/centred),
// never freezes (camFromKeys creep + always a key move), never drifts;
// characters act in place — travel only via foot-locked march;
// costumes by role; king = romanFront crown + red robe; wife = dress (sari).
// World: royal court x=0 (palace facade z=-3.2, throne z=-2.2), poor man's
// hut x=+16, village square x=+32 (house facade z=-7.4, pots z=-0.2).
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1872, DECK = 0;
export const SHOTS = [
  { id: 'hookQ', a: 0, b: 178, light: 'dusk' },
  { id: 'court1', a: 179, b: 335, light: 'dusk' },
  { id: 'silent', a: 336, b: 413, light: 'dusk' },
  { id: 'deal', a: 414, b: 625, light: 'dusk' },
  { id: 'home', a: 626, b: 718, light: 'dusk' },
  { id: 'wife', a: 719, b: 827, light: 'lamp' },
  { id: 'laugh', a: 828, b: 997, light: 'lamp' },
  { id: 'yearlong', a: 998, b: 1130, light: 'lamp' },
  { id: 'return', a: 1131, b: 1332, light: 'dusk' },
  { id: 'bray', a: 1333, b: 1439, light: 'dusk' },
  { id: 'forgive', a: 1440, b: 1554, light: 'dusk' },
  { id: 'hook', a: 1555, b: 1871, light: 'day' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
M.linear = (t) => clamp(t);

// ---------- lights (same proven set as thief) ----------
const WATER = { waterDeep: '#223c4e', waterShal: '#2c4a63', glint: '#ffe9c0' };
export const LIGHTS = {
  dusk: { az: 100, el: 19, sky: '#caa27a', ground: '#5c4a34', hemi: 1.06, sun: '#ffb763', sunI: 2.3, fog: '#e0c9a0', fogNear: 40, fogFar: 320,
    skyTop: '#54689c', skyHor: '#ffd9a0', sunDisc: '#fff3cf', sunSize: 0.0036, sat: 1.07, vig: 0.24, shadowExt: 18, aurora: 0, gain: '#ffe9d2', ...WATER },
  lamp: { az: 70, el: 34, sky: '#8a6a4c', ground: '#3c2c1e', hemi: 0.88, sun: '#ffc37a', sunI: 1.9, fog: '#caa27a', fogNear: 30, fogFar: 210,
    skyTop: '#3c3a55', skyHor: '#caa27a', sunDisc: '#ffe9c0', sunSize: 0.0026, sat: 1.05, vig: 0.3, shadowExt: 14, aurora: 0, gain: '#ffe2b8', ...WATER },
  day: { az: 125, el: 44, sky: '#bcd2e8', ground: '#5f6a52', hemi: 1.22, sun: '#fff3da', sunI: 2.2, fog: '#cfd8c2', fogNear: 46, fogFar: 380,
    skyTop: '#5f97d6', skyHor: '#eef0da', sunDisc: '#fff6da', sunSize: 0.003, sat: 1.05, vig: 0.18, shadowExt: 18, aurora: 0, gain: '#ffffff', ...WATER },
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
export const lightFor = (S, f) => {
  if (S.id === 'hook') return blendLight(LIGHTS.dusk, LIGHTS.day, smooth(ramp(f, 1570, 1660)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging ----------
export const COURT = [0, 0, -3.2];
export const THRONE = [0, 0, -2.2];
export const HUT = [16, 0, -1.6];
export const VILLAGE = [32, 0, -2];
export const RINGP = [-15.2, 0.86, -4.6];   // (kept for main.js import parity)
export const COINP = [30.82, 1.12, -0.95];  // (kept for main.js import parity)
export const POTP = [32, 0, -0.2];          // the neighbour's borrowed copper pot
export const BABYPOTP = [32.62, 0, 0.28];   // the baby pot returned inside it
export const DONKEYP = [1.6, 0, -0.2];       // donkey's court station (close to the man)
export const CART0 = [6.5, 0, 3.8];         // cart parked east of the courtyard

/** Cart travel distance (m) — the cart never moves in this story. */
export const cartDAt = (f) => 0;
export const cartPosAt = (f) => [...CART0];

// ---------- the poor man's walk home (foot-locked march, f652-718) ----------
const WALK0 = [12.8, 0, 1.6], WALK1 = [16.2, 0, -1.0];
const walkTotal = Math.hypot(WALK1[0] - WALK0[0], WALK1[2] - WALK0[2]);
export const manWalkAt = (f) => {
  const d = smooth(ramp(f, 652, 718)) * walkTotal;
  return { pos: kf3([[652, WALK0], [718, WALK1]], f), dist: d, phase: (d / 1.6) % 1 };
};
// ---------- soldiers' arrival at the hut (foot-locked march, f1144-1193) ----------
const SOL0 = [[10.5, 0, 2.5], [11.5, 0, 3.0]], SOL1 = [[14.2, 0, -0.2], [15.0, 0, 0.4]];
export const soldierMarchAt = (i, f) => {
  const total = Math.hypot(SOL1[i][0] - SOL0[i][0], SOL1[i][2] - SOL0[i][2]);
  const d = smooth(ramp(f, 1144, 1193)) * total;
  return { pos: kf3([[1144, SOL0[i]], [1193, SOL1[i]]], f), dist: d, phase: (d / 1.6) % 1 };
};

const HERO = {
  hookQ: (f) => lerp3([1.6, 1.0, -0.2], [0, 1.1, 0.6], smooth(ramp(f, 119, 150))),
  court1: (f) => lerp3([0, 1.1, 0.6], [0, 1.35, -2.2], smooth(ramp(f, 248, 290))),
  silent: () => [0, 1.35, -2.2],
  deal: () => [0, 1.35, -2.2],
  home: (f) => { const w = manWalkAt(f); return [w.pos[0], 1.05, w.pos[2]]; },
  wife: () => [15.0, 1.1, -1.4],
  laugh: () => [16.6, 1.05, -1.0],
  yearlong: () => [16.6, 1.05, -1.0],
  return: (f) => (f < 1203 ? [0, 1.1, -1.9] : f < 1232 ? [0, 1.1, 0.6] : [1.6, 1.0, -0.2]),
  bray: () => [1.6, 1.0, -0.2],
  forgive: () => [0, 1.35, -2.2],
  hook: (f) => (f < 1710 ? [32, 0.9, -0.2] : [32, 3.6, -6.85]),
};
export const heroPosAt = (f) => HERO[shotAt(f).id](f);

// ---------- cameras ----------
// Every shot's first key repeats the previous shot's last key (continuous
// flight, no cuts); inside a shot the camera surges TO the clause subject
// and settles into a slow push-in on it. Between clauses inside one shot
// a key lands exactly on the clause boundary frame.
const CAMS = {
  hookQ: [
    { f: 0, pos: [8.6, 3.8, 12.6], look: [0, 1.9, -3.0], fov: 46 },
    { f: 55, pos: [5.0, 2.6, 8.5], look: [1.5, 1.3, 0.5], fov: 44, ease: 'surge' },
    { f: 115, pos: [3.0, 2.0, 5.0], look: [0.6, 1.15, 0.6], fov: 40, ease: 'surge' },
    { f: 178, pos: [0.8, 2.0, 6.5], look: [0, 1.15, 0.2], fov: 40, ease: 'surge' },
  ],
  court1: [
    { f: 179, pos: [0.8, 2.0, 6.5], look: [0, 1.15, 0.2], fov: 40 },
    { f: 220, pos: [0.7, 1.95, 6.0], look: [0, 1.15, 0.6], fov: 39, ease: 'surge' },
    { f: 248, pos: [1.0, 1.9, 5.2], look: [0, 1.25, -1.8], fov: 38, ease: 'surge' },
    { f: 335, pos: [1.2, 1.85, 4.6], look: [0, 1.3, -2.2], fov: 36, ease: 'surge' },
  ],
  silent: [
    { f: 336, pos: [1.2, 1.85, 4.6], look: [0, 1.3, -2.2], fov: 36 },
    { f: 370, pos: [1.1, 1.85, 4.2], look: [0, 1.35, -2.2], fov: 35, ease: 'surge' },
    { f: 413, pos: [1.0, 1.8, 3.9], look: [0, 1.35, -2.2], fov: 34, ease: 'surge' },
  ],
  deal: [
    { f: 414, pos: [1.0, 1.8, 3.9], look: [0, 1.35, -2.2], fov: 34 },
    { f: 470, pos: [1.6, 1.95, 5.0], look: [0, 1.25, -1.5], fov: 38, ease: 'surge' },
    { f: 515, pos: [1.4, 1.9, 4.6], look: [0, 1.3, -2.2], fov: 37, ease: 'surge' },
    { f: 560, pos: [1.1, 1.85, 4.0], look: [0, 1.4, -2.2], fov: 35, ease: 'surge' },
    { f: 625, pos: [1.0, 1.8, 3.7], look: [0, 1.4, -2.2], fov: 34, ease: 'surge' },
  ],
  home: [
    { f: 626, pos: [1.0, 1.8, 3.7], look: [0, 1.4, -2.2], fov: 34 },
    { f: 670, pos: [8.0, 2.4, 6.0], look: [13.5, 1.2, 0.5], fov: 42, ease: 'surge' },
    { f: 700, pos: [13.0, 1.9, 3.2], look: [15.8, 1.05, -0.4], fov: 38, ease: 'surge' },
    { f: 718, pos: [14.2, 1.8, 2.4], look: [16.4, 1.0, -1.2], fov: 37, ease: 'surge' },
  ],
  wife: [
    { f: 719, pos: [14.2, 1.8, 2.4], look: [16.4, 1.0, -1.2], fov: 37 },
    { f: 750, pos: [13.6, 1.9, 2.2], look: [15.2, 1.1, -1.4], fov: 37, ease: 'surge' },
    { f: 765, pos: [13.2, 1.85, 1.8], look: [15.1, 1.15, -1.4], fov: 36, ease: 'surge' },
    { f: 827, pos: [13.0, 1.8, 1.6], look: [15.1, 1.15, -1.4], fov: 35, ease: 'surge' },
  ],
  laugh: [
    { f: 828, pos: [13.0, 1.8, 1.6], look: [15.1, 1.15, -1.4], fov: 35 },
    { f: 870, pos: [14.6, 1.9, 2.6], look: [16.6, 1.05, -1.0], fov: 38, ease: 'surge' },
    { f: 913, pos: [14.8, 1.85, 2.4], look: [16.6, 1.05, -1.0], fov: 37, ease: 'surge' },
    { f: 950, pos: [14.4, 1.9, 2.2], look: [16.4, 1.1, -1.0], fov: 37, ease: 'surge' },
    { f: 997, pos: [14.2, 1.85, 2.0], look: [16.5, 1.05, -1.0], fov: 36, ease: 'surge' },
  ],
  yearlong: [
    { f: 998, pos: [14.2, 1.85, 2.0], look: [16.5, 1.05, -1.0], fov: 36 },
    { f: 1040, pos: [15.0, 1.9, 2.6], look: [16.6, 1.05, -1.0], fov: 38, ease: 'surge' },
    { f: 1079, pos: [15.4, 1.8, 2.4], look: [16.6, 1.1, -1.0], fov: 36, ease: 'surge' },
    { f: 1130, pos: [15.6, 1.75, 2.2], look: [16.6, 1.1, -1.0], fov: 35, ease: 'surge' },
  ],
  return: [
    { f: 1131, pos: [15.6, 1.75, 2.2], look: [16.6, 1.1, -1.0], fov: 35 },
    { f: 1180, pos: [8.0, 2.4, 6.0], look: [0, 1.3, -2.0], fov: 42, ease: 'surge' },
    { f: 1203, pos: [0.5, 2.2, 6.5], look: [0, 1.15, -1.9], fov: 42, ease: 'surge' },
    { f: 1232, pos: [1.6, 1.95, 5.2], look: [0.4, 1.15, 0.4], fov: 39, ease: 'surge' },
    { f: 1280, pos: [0.8, 2.0, 6.0], look: [0.8, 1.1, 0.0], fov: 40, ease: 'surge' },
    { f: 1332, pos: [0.9, 1.95, 5.6], look: [0.8, 1.1, 0.1], fov: 39, ease: 'surge' },
  ],
  bray: [
    { f: 1333, pos: [0.9, 1.95, 5.6], look: [0.8, 1.1, 0.1], fov: 39 },
    { f: 1360, pos: [4.6, 2.0, 4.2], look: [1.6, 1.45, -0.2], fov: 40, ease: 'surge' },
    { f: 1385, pos: [4.9, 1.9, 3.6], look: [1.6, 1.5, -0.2], fov: 38, ease: 'surge' },
    { f: 1410, pos: [4.7, 1.95, 3.9], look: [1.6, 1.45, -0.2], fov: 38, ease: 'surge' },
    { f: 1439, pos: [2.2, 1.9, 3.8], look: [0.6, 1.3, -1.6], fov: 38, ease: 'surge' },
  ],
  forgive: [
    { f: 1440, pos: [2.2, 1.9, 3.8], look: [0.6, 1.3, -1.6], fov: 38 },
    { f: 1480, pos: [1.4, 1.9, 3.4], look: [0, 1.35, -2.2], fov: 36, ease: 'surge' },
    { f: 1520, pos: [1.8, 1.9, 4.2], look: [0, 1.2, -1.0], fov: 38, ease: 'surge' },
    { f: 1554, pos: [2.0, 1.85, 4.4], look: [0.4, 1.15, -1.0], fov: 37, ease: 'surge' },
  ],
  hook: [
    { f: 1555, pos: [2.0, 1.85, 4.4], look: [0.4, 1.15, -1.0], fov: 37 },
    { f: 1585, pos: [22.0, 2.4, 6.5], look: [30.5, 1.4, -1.5], fov: 42, ease: 'surge' },
    { f: 1620, pos: [26.0, 2.1, 4.2], look: [31.8, 1.0, -0.4], fov: 40, ease: 'surge' },
    { f: 1680, pos: [27.0, 2.0, 3.6], look: [31.6, 1.0, -0.6], fov: 40, ease: 'surge' },
    { f: 1710, pos: [29.0, 2.6, 3.5], look: [32, 3.0, -6.85], fov: 42, ease: 'surge' },
    { f: 1798, pos: [29.2, 2.55, 3.2], look: [32, 3.05, -6.85], fov: 42, ease: 'surge' },
    { f: 1871, pos: [29.4, 2.5, 2.9], look: [32, 3.1, -6.85], fov: 42, ease: 'surge' },
  ],
};
export const camAt = (f) => camFromKeys(CAMS[shotAt(f).id], f);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const hp = heroPosAt(f);
  let cinf = 5;
  if (['silent', 'deal', 'bray'].includes(S.id)) cinf = 3.6;
  if (S.id === 'hook' && f >= 1710) cinf = 3.6;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { boardTalk: 0, boardBray: 0, boardPot: 0, gateOpen: 0, keyTurn: 0, lockOpen: 0, bagK: 0, cartD: 0, goldK: 0, potK: 0 };
  if (S.id === 'hookQ') W.boardTalk = 1 - smooth(ramp(f, 36, 48));
  if (S.id === 'court1') {
    W.gateOpen = smooth(ramp(f, 194, 240));
    W.keyTurn = smooth(ramp(f, 200, 230)) * (1 - smooth(ramp(f, 300, 330)));
    W.lockOpen = smooth(ramp(f, 210, 240));
  }
  if (S.id === 'deal') {
    W.gateOpen = 1;
    W.goldK = 0.45 + 0.35 * Math.sin(f * 0.22);
  }
  if (S.id === 'return') {
    W.gateOpen = smooth(ramp(f, 1144, 1200));
    W.lockOpen = smooth(ramp(f, 1150, 1190));
    W.goldK = 0.3;
  }
  if (S.id === 'bray') {
    W.boardBray = smooth(ramp(f, 1356, 1368)) * (1 - smooth(ramp(f, 1396, 1410)));
    W.goldK = 0.3;
  }
  if (S.id === 'forgive') W.goldK = 0.4 + 0.2 * Math.sin(f * 0.18);
  if (S.id === 'hook') {
    W.potK = smooth(ramp(f, 1660, 1690));
    if (f >= 1710) W.boardPot = smooth(ramp(f, 1710, 1724));
  }
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return { smokeRate: (S.light === 'lamp' ? 0.22 : 0.35), dustRate: 0.1, splashRate: 0 };
};

// ---------- actors ----------
const TINT = { dusk: '#ffd9a3', lamp: '#ffcf96', day: '#ffffff' };
const tintFor = (S, f) => (S.id === 'hook' && f < 1660 ? TINT.dusk : TINT[S.light] || '#ffffff');
// COSTUMES BY ROLE — king: romanFront crown + red robe (toon.js OUTFITS.king);
// poor man: worn simple brown clothes; wife: rose dress (sari); soldiers:
// red uniform + shako (same as thief's guards); villagers: plain clothes.
export const OUTFITS = {
  man: { jacket: '#8a6f4d', pants: '#5a4a38', boots: '#3a2c1c', hat: 'hair', hair: '#2b211c', skin: '#c98a5a' },
  wife: { jacket: '#a85a6e', pants: '#6e3a4a', boots: '#4a2c28', hat: 'hair', hair: '#1e1714', skin: '#e8b08a', dress: '#b85a72' },
  guardL: { jacket: '#8c2f39', pants: '#2a2e3d', boots: '#1c1a17', hat: 'shako', belt: '#e8c45a', skin: '#e8b08a' },
  guardR: { jacket: '#8c2f39', pants: '#2a2e3d', boots: '#1c1a17', hat: 'shako', belt: '#e8c45a', skin: '#c98a5a' },
  borrower: { jacket: '#7a6a4a', pants: '#4a3e2c', boots: '#3a2c1c', hat: 'hair', hair: '#241a12', skin: '#c98a5a' },
  neighbour: { jacket: '#5a6a7a', pants: '#3a3e46', boots: '#2c2620', hat: 'cap', cap: '#d8c9a6', skin: '#e8b08a' },
};
const RW = (T, o, opts, pos, extra = {}) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], ...extra });
const KING = (T, f, expr, seed, pos, extra = {}, opts = {}) => ({
  key: 'king' + JSON.stringify({ expr, ...opts, f: Math.floor(f / 6) }),
  draw: (p) => T.romanFront(p, 'king', { expr, blink: blinkAt(f, seed), seed, ...opts }),
  x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], ...extra,
});
const DONK = (T, f, o, pos, extra = {}) => ({
  key: 'donkey' + JSON.stringify({ b: q(o.bray || 0, 1), s: q(o.step || 0, 2), e: q(o.ear || 0, 1) }),
  draw: (p) => T.donkeyCard(p, { ...o, blink: blinkAt(f, 77) }),
  x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], s: 1.4, ...extra,
});
const stand = (T, tint, f) => (o, expr, seed, pos, extra = {}) => RW(T, o, { expr, mode: 'stand', blink: blinkAt(f, seed), seed }, pos, { tint, ...extra });
const GLP = [-1.8, 0, -1.9], GRP = [1.8, 0, -1.9];   // soldier posts in court
const bowK = (f, a, b, c, d) => smooth(ramp(f, a, b)) * (1 - smooth(ramp(f, c, d)));
const bowOpts = (k) => ({ headTilt: q(k * 17, 1) });
const BP = (pos, k) => [pos[0], q(-0.07 * k, 3), pos[2]];
const brayK = (f) => smooth(ramp(f, 1342, 1356)) * (1 - smooth(ramp(f, 1396, 1410)));

export const actorsAt = (f, T) => {
  const S = shotAt(f), tint = tintFor(S, f), out = [];
  const st = stand(T, tint, f);
  const soldiers = (glExpr = 'stern', grExpr = 'stern', glX = {}, grX = {}) => {
    out.push(st(OUTFITS.guardL, glExpr, 61, GLP, { yaw: 0.15, ...glX }));
    out.push(st(OUTFITS.guardR, grExpr, 62, GRP, { yaw: -0.15, ...grX }));
  };
  const donkeyAt = (pos, extra = {}) => {
    const b = S.id === 'bray' ? brayK(f) : 0;
    const ear = q(0.5 + 0.5 * Math.sin(f * 0.11 + 2), 2);
    out.push(DONK(T, f, { bray: b, step: 0, ear }, pos, { tint, yaw: -0.35, ...extra }));
  };
  switch (S.id) {
    case 'hookQ': {
      const manExpr = f < 119 ? 'nervous' : 'grin';
      out.push(st(OUTFITS.man, manExpr, 43, [0, 0, 0.6], { yaw: 0 }));
      donkeyAt([...DONKEYP]);
      break;
    }
    case 'court1': {
      // the man steps forward (foot-locked march, f194-238), then stands and speaks
      const d = smooth(ramp(f, 194, 238)) * 1.6;
      const mp = kf3([[194, [0, 0, 2.2]], [238, [0, 0, 0.6]]], f);
      const moving = f > 194 && f < 238;
      out.push(RW(T, OUTFITS.man, { expr: 'nervous', mode: moving ? 'march' : 'stand', phase: q((d / 1.6) % 1, 3), blink: blinkAt(f, 43), seed: 43 }, mp, { tint, yaw: 0 }));
      out.push(KING(T, f, 'neutral', 21, [0, 0, -2.2], { tint, yaw: 0 }));
      soldiers();
      donkeyAt([1.6, 0, -0.2]);
      break;
    }
    case 'silent': {
      out.push(st(OUTFITS.man, 'nervous', 43, [0, 0, 0.6], { yaw: 0 }));
      const lean = smooth(ramp(f, 386, 413));
      out.push(KING(T, f, 'stern', 21, [0, 0, -2.2], { tint, yaw: 0 }, { headTilt: q(lean * 10, 1) }));
      soldiers();
      donkeyAt([1.6, 0, -0.2]);
      break;
    }
    case 'deal': {
      const threat = f >= 521;
      const kExpr = threat ? 'stern' : (f < 470 ? 'stern' : 'grin');
      out.push(KING(T, f, kExpr, 21, [0, 0, -2.2], { tint, yaw: 0 }, threat ? { R: 'cheek', headTilt: 8 } : {}));
      const bk = threat ? bowK(f, 521, 545, 600, 625) : 0;
      out.push(RW(T, OUTFITS.man, { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 43), seed: 43, ...bowOpts(bk) }, BP([0, 0, 0.6], bk), { tint, yaw: 0 }));
      soldiers(threat ? 'stern' : 'stern');
      donkeyAt([1.6, 0, -0.2]);
      break;
    }
    case 'home': {
      // the king's court stays populated while the camera leaves it (f<660)
      if (f < 660) {
        out.push(KING(T, f, 'grin', 21, [0, 0, -2.2], { tint, yaw: 0 }));
        soldiers();
        donkeyAt([1.6, 0, -0.2]);
      }
      const w = manWalkAt(f);
      const moving = f > 652 && f < 718;
      out.push(RW(T, OUTFITS.man, { expr: 'whistle', mode: moving ? 'march' : 'stand', phase: q(w.phase, 3), blink: blinkAt(f, 43), seed: 43 }, w.pos, { tint, yaw: 0.6 }));
      break;
    }
    case 'wife': {
      const pale = smooth(ramp(f, 730, 757));
      const wt = pale > 0.5 ? '#eef2f6' : tint;
      out.push(st(OUTFITS.wife, f < 765 ? 'shock' : 'stern', 51, [15.0, 0, -1.4], { yaw: -0.3, tint: wt }));
      out.push(st(OUTFITS.man, f < 765 ? 'nervous' : 'grin', 43, [16.6, 0, -1.0], { yaw: -0.5 }));
      break;
    }
    case 'laugh': {
      out.push(st(OUTFITS.man, f < 913 ? 'laugh' : 'grin', 43, [16.6, 0, -1.0], { yaw: -0.2 }));
      out.push(st(OUTFITS.wife, f < 923 ? 'stern' : 'neutral', 51, [15.0, 0, -1.4], { yaw: 0.3 }));
      break;
    }
    case 'yearlong': {
      out.push(st(OUTFITS.man, f < 1079 ? 'neutral' : 'grin', 43, [16.6, 0, -1.0], { yaw: -0.2 }));
      break;
    }
    case 'return': {
      if (f < 1203) {
        // the king + donkey wait at court while the soldiers fetch the man
        out.push(KING(T, f, 'stern', 21, [0, 0, -2.2], { tint, yaw: 0 }));
        donkeyAt([1.6, 0, -0.2]);
        // soldiers march to the hut door, foot-locked
        for (let i = 0; i < 2; i++) {
          const m = soldierMarchAt(i, f);
          const moving = f > 1144 && f < 1193;
          const outfit = i === 0 ? OUTFITS.guardL : OUTFITS.guardR;
          out.push(RW(T, outfit, { expr: 'stern', mode: moving ? 'march' : 'stand', phase: q(m.phase, 3), blink: blinkAt(f, 61 + i), seed: 61 + i }, m.pos, { tint, yaw: -0.4 }));
        }
        if (f >= 1180) out.push(st(OUTFITS.man, 'nervous', 43, [16.6, 0, -1.0], { yaw: 0.5 }));
      } else {
        // back in court: the man bows, then speaks to the king
        const bk = bowK(f, 1203, 1216, 1224, 1232);
        out.push(RW(T, OUTFITS.man, { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 43), seed: 43, ...bowOpts(bk) }, BP([0, 0, 0.6], bk), { tint, yaw: 0 }));
        out.push(KING(T, f, 'neutral', 21, [0, 0, -2.2], { tint, yaw: 0 }));
        soldiers();
        donkeyAt([1.6, 0, -0.2]);
      }
      break;
    }
    case 'bray': {
      donkeyAt([1.6, 0, -0.2]);
      out.push(st(OUTFITS.man, 'relief', 43, [0, 0, 0.6], { yaw: 0.2 }));
      const laughK = smooth(ramp(f, 1391, 1410));
      out.push(KING(T, f, 'laugh', 21, [0, 0, -2.2], { tint, yaw: 0 }, { headTilt: q(laughK * 6, 1) }));
      soldiers('laugh', 'laugh');
      break;
    }
    case 'forgive': {
      out.push(KING(T, f, f < 1500 ? 'laugh' : 'grin', 21, [0, 0, -2.2], { tint, yaw: 0 }));
      out.push(st(OUTFITS.man, 'relief', 43, [0, 0, 0.6], { yaw: 0 }));
      soldiers('grin', 'grin');
      donkeyAt([1.6, 0, -0.2]);
      break;
    }
    case 'hook': {
      // the court stays populated while the camera leaves it (f<1600)
      if (f < 1600) {
        out.push(KING(T, f, 'grin', 21, [0, 0, -2.2], { tint, yaw: 0 }));
        soldiers('grin', 'grin');
        donkeyAt([1.6, 0, -0.2]);
      }
      const nbExpr = f < 1710 ? 'neutral' : (f < 1807 ? 'grin' : 'shock');
      out.push(st(OUTFITS.borrower, f < 1710 ? 'nervous' : 'grin', 71, [31.2, 0, -3.0], { yaw: 0.3 }));
      out.push(st(OUTFITS.neighbour, nbExpr, 72, [34.2, 0, -3.0], { yaw: -0.3 }));
      break;
    }
  }
  return out;
};
export const fxAt = (f, T) => [];
