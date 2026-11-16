// Shot plan for "The Boy Who Weighed the Elephant" (batch-5 topic 1, EN) —
// timed to the ACTUAL voice stem (64.77 s, 30 fps, TOTAL 1943), clause
// timings from faster-whisper word alignment on stem_en.wav (227 words,
// last word ends 64.22 s; boundaries = ASR word-start frames; ASR heard
// "chalk mark" as "chocolate arc" at 40.6 s — timing unaffected):
// C1 0 hook "couldn't be done" | C2 57 elephant heavier than 10 horses |
// C3 228 wise men / blacksmiths | C4 332 barefoot boy steps forward |
// C5 488 court laughed | C6 571 led elephant to river | C7 689 walked it
// onto the boat | C8 739 boat sank low | C9 783 chalk waterline |
// C10 899 led elephant off, boat floated up | C11 981 "bring the stones" |
// C12 1045 soldiers loaded stones | C13 1124 sank until water touched
// the chalk mark | C14 1241 boy smiled, stones = elephant |
// C15 1443 king stared, ordered weighed | C16 1580 weighed the unweighable |
// C17 1697 next trick stranger | C18 1758 shepherd sold goat twice |
// C19 1871 hook question, held to 1942.
// QUALITY RULES: shots change ONLY at clause boundaries; camera TRACKS the
// voice-named subject every beat (biggest/centred), never freezes, never
// drifts; characters act in place — no walk-glide; costumes by role
// (king = crown + royal robe, boy = worn poor clothes, barefoot,
// soldiers = uniform, wise men = grey robes, shepherd = work clothes).
// PHYSICS (Abid 2026-11-15, top priority): props sit flush on their
// surface with contact shadow; stones rest ON the boat deck / bank pile
// and stay; the chalk mark appears ON the boat side exactly as the marking
// is spoken; the boat sinks ONLY as weight boards it (elephant, then
// stones) and floats back up when the elephant steps off; the elephant
// boards / leaves at clause boundaries with a settle, never gliding.
// World: palace court x=0 (facade z=-3.2, throne z=-2.2), river x=+16
// (boat at [16,0,-4.6] in the water strip z -8..-3.6, dry bank to the south).
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1943, DECK = 0;
export const SHOTS = [
  { id: 'title', a: 0, b: 56, light: 'day' },
  { id: 'heavy', a: 57, b: 227, light: 'day' },
  { id: 'wise', a: 228, b: 331, light: 'day' },
  { id: 'boy', a: 332, b: 487, light: 'day' },
  { id: 'laugh', a: 488, b: 570, light: 'day' },
  { id: 'lead', a: 571, b: 688, light: 'day' },
  { id: 'onboard', a: 689, b: 738, light: 'day' },
  { id: 'sank', a: 739, b: 782, light: 'day' },
  { id: 'chalk', a: 783, b: 898, light: 'day' },
  { id: 'off', a: 899, b: 980, light: 'day' },
  { id: 'bring', a: 981, b: 1044, light: 'day' },
  { id: 'load', a: 1045, b: 1123, light: 'day' },
  { id: 'mark', a: 1124, b: 1240, light: 'day' },
  { id: 'smile', a: 1241, b: 1442, light: 'day' },
  { id: 'king', a: 1443, b: 1579, light: 'day' },
  { id: 'weighed', a: 1580, b: 1696, light: 'day' },
  { id: 'stranger', a: 1697, b: 1757, light: 'dusk' },
  { id: 'goat', a: 1758, b: 1870, light: 'dusk' },
  { id: 'hook', a: 1871, b: 1942, light: 'dusk' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
M.linear = (t) => clamp(t);

// ---------- lights ----------
const WATER = { waterDeep: '#1d4a66', waterShal: '#2e6a8c', glint: '#ffe9c0' };
export const LIGHTS = {
  day: { az: 120, el: 45, sky: '#8fb8d8', ground: '#6a5a44', hemi: 1.12, sun: '#fff2cf', sunI: 2.4, fog: '#cfe0ea', fogNear: 40, fogFar: 320,
    skyTop: '#3a6ab0', skyHor: '#cfe8f2', sunDisc: '#fffbe0', sunSize: 0.004, sat: 1.05, vig: 0.22, shadowExt: 18, aurora: 0, gain: '#ffffff', ...WATER },
  dusk: { az: 100, el: 19, sky: '#caa27a', ground: '#5c4a34', hemi: 1.06, sun: '#ffb763', sunI: 2.3, fog: '#e0c9a0', fogNear: 40, fogFar: 320,
    skyTop: '#54689c', skyHor: '#ffd9a0', sunDisc: '#fff3cf', sunSize: 0.0036, sat: 1.07, vig: 0.24, shadowExt: 18, aurora: 0, gain: '#ffe9d2', ...WATER },
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
  if (S.id === 'stranger') return blendLight(LIGHTS.day, LIGHTS.dusk, smooth(ramp(f, 1697, 1740)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging ----------
export const THRONE = [0, 0, -2.2];
export const WELL = [16, 0, -4.6];            // boat anchor (river, in the water strip)
export const BOAT = [16, 0, -4.6];
export const GOLDBAG = [16.35, 0, -0.35];
export const BOY = [16.8, 0, -0.3];           // boy EAST of the elephant head — clear of its bulk from the SW camera
export const BOY_COURT = [0.8, 0, -0.8];
export const KING_R = [18.6, 0, -0.8];        // king on the dry bank
export const KING_C = [1.9, 0, -0.9];         // king standing in court
export const WISE_L = [-1.5, 0, -0.9];
export const WISE_R = [1.7, 0, -1.0];
export const SMITH = [-2.6, 0, -0.9];
export const SOLD_L = [14.0, 0, -0.6];
export const SOLD_R = [18.0, 0, -0.6];
export const SHEPHERD = [-0.6, 0, -0.9];
export const MERCHANT = [1.4, 0, -0.9];
export const GLP = [-2.0, 0, -1.7], GRP = [2.0, 0, -1.7];
export const ELEPH_BANK = [14.0, 0, -1.2];   // elephant waiting on the dry bank
export const ELEPH_BOAT = [16, 0, -1.6];     // elephant standing on the boat

const HERO = {
  title: () => [16, 1.8, -3.0],
  heavy: () => [15.5, 1.5, -2.0],
  wise: () => [0, 1.2, -1.2],
  boy: () => [0.8, 1.1, -0.8],
  laugh: () => [0, 1.3, -2.2],
  lead: () => [13.8, 1.3, -1.4],
  onboard: () => [16, 1.4, -4.6],
  sank: () => [16, 0.9, -4.6],
  chalk: () => [15.2, 0.7, -4.0],
  off: () => [14.2, 1.2, -2.0],
  bring: () => [16.0, 1.1, -0.5],
  load: () => [16, 1.0, -4.2],
  mark: () => [16, 0.7, -4.6],
  smile: () => [16.8, 1.1, -0.3],
  king: () => [18.6, 1.25, -0.8],
  weighed: () => [16, 1.1, -3.8],
  stranger: () => [0, 1.2, -1.2],
  goat: () => [-0.6, 1.1, -0.9],
  hook: () => [0, 2.5, -2.95],
};
export const heroPosAt = (f) => HERO[shotAt(f).id](f);

// ---------- cameras ----------
// Continuous flight: every shot's first key repeats the previous shot's
// last key; inside a shot the camera surges TO the clause subject.
const CAMS = {
  title: [
    { f: 0, pos: [12.5, 3.2, 9.5], look: [15.0, 1.9, -2.8], fov: 44 },
    { f: 30, pos: [13.0, 3.0, 8.8], look: [15.2, 1.9, -2.8], fov: 42, ease: 'surge' },
    { f: 56, pos: [13.0, 2.8, 8.2], look: [15.4, 1.8, -2.8], fov: 41, ease: 'surge' },
  ],
  heavy: [
    { f: 57, pos: [13.0, 2.8, 8.2], look: [15.4, 1.8, -2.8], fov: 41 },
    { f: 140, pos: [13.5, 2.4, 8.0], look: [15.5, 1.5, -2.0], fov: 41, ease: 'surge' },
    { f: 227, pos: [14.0, 2.3, 7.6], look: [15.8, 1.4, -2.0], fov: 40 },
  ],
  wise: [
    { f: 228, pos: [14.0, 2.3, 7.6], look: [15.8, 1.4, -2.0], fov: 40 },
    { f: 280, pos: [7.5, 3.0, 8.5], look: [0, 1.8, -2.6], fov: 43, ease: 'surge' },
    { f: 331, pos: [0.4, 2.3, 7.4], look: [0, 1.2, -1.2], fov: 43, ease: 'surge' },
  ],
  boy: [
    { f: 332, pos: [0.4, 2.3, 7.4], look: [0, 1.2, -1.2], fov: 43 },
    { f: 410, pos: [0.2, 2.0, 5.6], look: [0.8, 1.1, -0.8], fov: 40, ease: 'surge' },
    { f: 487, pos: [0.3, 1.95, 5.4], look: [0.8, 1.1, -0.8], fov: 39 },
  ],
  laugh: [
    { f: 488, pos: [0.3, 1.95, 5.4], look: [0.8, 1.1, -0.8], fov: 39 },
    { f: 530, pos: [0.6, 2.2, 5.8], look: [0, 1.3, -2.2], fov: 41, ease: 'surge' },
    { f: 570, pos: [0.5, 2.2, 6.0], look: [0, 1.3, -2.2], fov: 40 },
  ],
  lead: [
    { f: 571, pos: [0.5, 2.2, 6.0], look: [0, 1.3, -2.2], fov: 40 },
    { f: 630, pos: [7.0, 3.0, 9.5], look: [14, 1.2, -1.2], fov: 43, ease: 'surge' },
    { f: 688, pos: [12.8, 2.6, 8.0], look: [14.2, 1.3, -1.2], fov: 41, ease: 'surge' },
  ],
  onboard: [
    { f: 689, pos: [12.8, 2.6, 8.0], look: [14.2, 1.3, -1.2], fov: 41 },
    { f: 710, pos: [13.0, 1.8, 8.0], look: [16, 0.6, -4.4], fov: 44, ease: 'surge' },
    { f: 738, pos: [13.2, 1.7, 7.8], look: [16, 0.6, -4.4], fov: 43 },
  ],
  sank: [
    { f: 739, pos: [13.2, 1.7, 7.8], look: [16, 0.6, -4.4], fov: 43 },
    { f: 760, pos: [14.5, 1.8, 7.0], look: [16, 0.5, -4.6], fov: 41, ease: 'surge' },
    { f: 782, pos: [14.6, 1.7, 6.8], look: [16, 0.5, -4.6], fov: 40 },
  ],
  chalk: [
    { f: 783, pos: [14.6, 1.7, 6.8], look: [16, 0.5, -4.6], fov: 40 },
    { f: 830, pos: [15.0, 1.8, 6.5], look: [16.2, 0.6, -4.0], fov: 39, ease: 'surge' },
    { f: 898, pos: [15.1, 1.75, 6.3], look: [16.2, 0.6, -4.0], fov: 38 },
  ],
  off: [
    { f: 899, pos: [15.1, 1.75, 6.3], look: [16.2, 0.6, -4.0], fov: 38 },
    { f: 940, pos: [13.6, 2.4, 7.6], look: [15.0, 1.2, -2.5], fov: 40, ease: 'surge' },
    { f: 980, pos: [13.8, 2.3, 7.4], look: [15.0, 1.1, -2.5], fov: 39 },
  ],
  bring: [
    { f: 981, pos: [13.8, 2.3, 7.4], look: [15.0, 1.1, -2.5], fov: 39 },
    { f: 1010, pos: [14.2, 2.2, 7.2], look: [15.0, 1.1, -0.7], fov: 39, ease: 'surge' },
    { f: 1044, pos: [14.4, 2.15, 7.0], look: [15.0, 1.1, -0.7], fov: 38 },
  ],
  load: [
    { f: 1045, pos: [14.4, 2.15, 7.0], look: [15.0, 1.1, -0.7], fov: 38 },
    { f: 1080, pos: [17.5, 4.5, 6.5], look: [16, 0.7, -4.2], fov: 40, ease: 'surge' },
    { f: 1123, pos: [17.3, 4.4, 6.3], look: [16, 0.7, -4.2], fov: 39 },
  ],
  mark: [
    { f: 1124, pos: [17.3, 4.4, 6.3], look: [16, 0.7, -4.2], fov: 39 },
    { f: 1180, pos: [15.0, 2.6, 7.5], look: [15.2, 0.5, -4.2], fov: 40, ease: 'surge' },
    { f: 1240, pos: [15.1, 2.5, 7.3], look: [15.2, 0.5, -4.2], fov: 39, ease: 'surge' },
  ],
  smile: [
    { f: 1241, pos: [15.1, 2.5, 7.3], look: [15.2, 0.5, -4.2], fov: 39 },
    { f: 1300, pos: [14.2, 2.2, 7.4], look: [14.0, 1.1, -0.5], fov: 39, ease: 'surge' },
    { f: 1442, pos: [14.4, 2.15, 7.2], look: [14.0, 1.1, -0.5], fov: 38 },
  ],
  king: [
    { f: 1443, pos: [14.4, 2.15, 7.2], look: [14.0, 1.1, -0.5], fov: 38 },
    { f: 1500, pos: [15.6, 2.2, 6.8], look: [17.5, 1.25, -1.2], fov: 38, ease: 'surge' },
    { f: 1579, pos: [15.7, 2.15, 6.6], look: [17.5, 1.25, -1.2], fov: 37 },
  ],
  weighed: [
    { f: 1580, pos: [15.7, 2.15, 6.6], look: [17.5, 1.25, -1.2], fov: 37 },
    { f: 1620, pos: [14.5, 2.6, 8.5], look: [15.5, 1.5, -3.8], fov: 44, ease: 'surge' },
    { f: 1696, pos: [14.5, 2.7, 8.8], look: [15.5, 1.5, -3.8], fov: 44 },
  ],
  stranger: [
    { f: 1697, pos: [14.5, 2.7, 8.8], look: [15.5, 1.5, -3.8], fov: 44 },
    { f: 1730, pos: [7.5, 3.0, 8.5], look: [0, 1.8, -2.6], fov: 43, ease: 'surge' },
    { f: 1757, pos: [0.4, 2.3, 7.4], look: [0, 1.2, -1.2], fov: 43 },
  ],
  goat: [
    { f: 1758, pos: [0.4, 2.3, 7.4], look: [0, 1.2, -1.2], fov: 43 },
    { f: 1810, pos: [0.2, 2.0, 5.6], look: [-0.6, 1.1, -0.9], fov: 40, ease: 'surge' },
    { f: 1870, pos: [0.3, 1.95, 5.4], look: [-0.6, 1.1, -0.9], fov: 39 },
  ],
  hook: [
    { f: 1871, pos: [0.3, 1.95, 5.4], look: [-0.6, 1.1, -0.9], fov: 39 },
    { f: 1900, pos: [2.6, 2.5, 5.8], look: [0, 2.45, -2.95], fov: 40, ease: 'surge' },
    { f: 1942, pos: [2.4, 2.55, 6.2], look: [0, 2.5, -2.95], fov: 39, ease: 'surge' },
  ],
};
export const camAt = (f) => camFromKeys(CAMS[shotAt(f).id], f);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const hp = heroPosAt(f);
  let cinf = 2.5;
  if (['chalk', 'mark', 'hook'].includes(S.id)) cinf = 2.2;
  if (S.id === 'king') cinf = 2.2;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
// Boat ride: floats at +0.25, sinks to -0.05 under the elephant (689-738),
// floats back up as the elephant steps off (900-960), sinks again as the
// stones load (1045-1240) to the SAME -0.05 — the chalk mark's level.
const BOATY_KEYS = [[0, 0.25], [688, 0.25], [738, -0.05], [899, -0.05], [960, 0.25], [1044, 0.25], [1240, -0.05], [1942, -0.05]];
// Elephant: bank -> boat (689-730, steps on with a settle) -> bank (900-950).
const ELEPH_X_KEYS = [[0, 14.0], [688, 14.0], [730, 16], [899, 16], [950, 12.5], [1942, 12.5]];
const ELEPH_Z_KEYS = [[0, -1.2], [688, -1.2], [730, -4.6], [899, -4.6], [950, -1.2], [1942, -1.2]];
export const worldAt = (f) => {
  const S = shotAt(f);
  const boatY = kf(BOATY_KEYS, f);
  const onBoat = smooth(ramp(f, 689, 730)) * (1 - smooth(ramp(f, 900, 950)));
  const moving = (f > 688 && f < 732) || (f > 899 && f < 952);
  const bob = moving ? Math.abs(Math.sin(f * 0.55)) * 0.05 : 0;   // stepping bob while boarding
  const W = {
    boardTitle: 0, boardPayoff: 0, boardHook: 0,
    boatY, elephX: kf(ELEPH_X_KEYS, f), elephZ: kf(ELEPH_Z_KEYS, f),
    elephY: onBoat * (boatY + 0.355) + (onBoat > 0 && onBoat < 1 ? bob : 0),
    elephK: 1, chalkK: 0, pileK: 0, rippleK: 0, splashP: 0,
    stone0: 0, stone1: 0, stone2: 0, stone3: 0, stone4: 0, stone5: 0,
    payK: 0, goldK: 0,
  };
  if (S.id === 'title') W.boardTitle = 1 - smooth(ramp(f, 44, 56));
  if (S.id === 'weighed') W.boardPayoff = smooth(ramp(f, 1625, 1637)) * (1 - smooth(ramp(f, 1680, 1696)));
  if (S.id === 'hook') W.boardHook = smooth(ramp(f, 1900, 1912));   // NO fade-out: holds 1.0 to the last frame
  // chalk mark draws across the boat side exactly as the marking is spoken
  W.chalkK = smooth(ramp(f, 800, 860));
  // stone pile appears on the bank when the boy calls for stones
  W.pileK = smooth(ramp(f, 981, 1000)) * (1 - 0.5 * smooth(ramp(f, 1045, 1240)));
  // one stone boards per ~28 frames as the soldiers load (1045-1240)
  for (let i = 0; i < 6; i++) W['stone' + i] = smooth(ramp(f, 1055 + i * 28, 1075 + i * 28));
  // ripples when the elephant steps on / off the boat
  W.rippleK = Math.max(smooth(ramp(f, 700, 730)) * (1 - smooth(ramp(f, 760, 820))), smooth(ramp(f, 905, 930)) * (1 - smooth(ramp(f, 950, 1000))));
  W.splashP = ramp(f, 700, 726);
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return { smokeRate: (S.light === 'day' ? 0.3 : 0.24), dustRate: 0.08, splashRate: 0 };
};

// ---------- crows in the sky (set dressing; deterministic) ----------
const CROW_N = 7;
const circleAt = (f, i, cx, cz, r = 5, h = 9) => {
  const a = f * 0.008 + i * 0.9;
  return { p: [cx + r * Math.cos(a), h + Math.sin(f * 0.05 + i) * 0.8, cz + r * Math.sin(a)], yaw: a + Math.PI / 2, flap: f * 0.9 + i * 1.7, s: 1 };
};
export const flyCrowsAt = (f) => {
  const S = shotAt(f);
  const out = [];
  const court = (S.id === 'wise' || S.id === 'boy' || S.id === 'laugh' || S.id === 'stranger' || S.id === 'goat' || S.id === 'hook');
  for (let i = 0; i < CROW_N; i++) out.push(circleAt(f, i, court ? 0 : 16, -2, court ? 6 : 4, court ? 9.5 : 8.5));
  return out;
};

// ---------- actors ----------
// COSTUMES BY ROLE — king: crimson royal robe + gold crown + grey
// moustache, stout. Boy: worn poor tunic, barefoot (skin-tone feet),
// dark hair. Soldiers: red uniform + shako + gold belt. Wise men: grey
// robes + white beards. Shepherd: straw cap + work clothes. Merchant:
// rich blue jacket.
const TINT = { day: '#ffffff', dusk: '#ffd9a3' };
const tintFor = (S, f) => TINT[S.light] || '#ffffff';
export const OUTFITS = {
  king: { jacket: '#7a1f2e', pants: '#3a2a4a', boots: '#241a12', hat: 'crown', skin: '#e8b08a', moustache: '#d8d0c0', build: 'stout', dress: '#7a1f2e' },
  boy: { jacket: '#7a6a4a', pants: '#5d4a30', boots: '#c98a5a', hat: 'hair', hair: '#1f160e', skin: '#c98a5a' },
  soldier: { jacket: '#8c2f39', pants: '#2a2e3d', boots: '#1c1a17', hat: 'shako', belt: '#e8c45a', skin: '#e8b08a' },
  soldier2: { jacket: '#8c2f39', pants: '#2a2e3d', boots: '#1c1a17', hat: 'shako', belt: '#e8c45a', skin: '#c98a5a' },
  wiseA: { jacket: '#5a5a62', pants: '#3d3d44', boots: '#241a12', hat: 'cap', cap: '#4a4a52', skin: '#e8b08a', moustache: '#e8e8e8' },
  wiseB: { jacket: '#6a5a52', pants: '#44403a', boots: '#241a12', hat: 'cap', cap: '#524a42', skin: '#c98a5a', moustache: '#f0f0f0' },
  smith: { jacket: '#3d3d3d', pants: '#2e2a26', boots: '#1c1a17', hat: 'cap', cap: '#2a2a2a', skin: '#c98a5a' },
  shepherd: { jacket: '#6a5a3a', pants: '#4a3d28', boots: '#3a2c1c', hat: 'cap', cap: '#c9a24d', skin: '#c98a5a' },
  merchant: { jacket: '#2e4a6a', pants: '#2a2e3d', boots: '#1c1a17', hat: 'cap', cap: '#1f3247', skin: '#e8b08a' },
  guardL: { jacket: '#8c2f39', pants: '#2a2e3d', boots: '#1c1a17', hat: 'shako', belt: '#e8c45a', skin: '#e8b08a' },
  guardR: { jacket: '#8c2f39', pants: '#2a2e3d', boots: '#1c1a17', hat: 'shako', belt: '#e8c45a', skin: '#c98a5a' },
};
const RW = (T, o, opts, pos, extra = {}) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], ...extra });
const stand = (T, tint, f) => (o, expr, seed, pos, extra = {}) => RW(T, o, { expr, mode: 'stand', blink: blinkAt(f, seed), seed }, pos, { tint, ...extra });
const bowK = (f, a, b, c, d) => smooth(ramp(f, a, b)) * (1 - smooth(ramp(f, c, d)));
const bowOpts = (k) => ({ headTilt: q(k * 24, 1) });
const BP = (pos, k) => [pos[0], q(-0.12 * k, 3), pos[2]];

export const actorsAt = (f, T) => {
  const S = shotAt(f), tint = tintFor(S, f), out = [];
  const st = stand(T, tint, f);
  const kingR = (expr, extra = {}) => st(OUTFITS.king, expr, 31, KING_R, { yaw: -0.5, ...extra });
  const kingC = (expr, extra = {}) => st(OUTFITS.king, expr, 31, KING_C, { yaw: -0.5, ...extra });
  const boyR = (expr, extra = {}) => st(OUTFITS.boy, expr, 91, BOY, { yaw: 0.5, ...extra });
  const boyC = (expr, extra = {}) => st(OUTFITS.boy, expr, 92, BOY_COURT, { yaw: 0.5, ...extra });
  const pointAt = (o, seed, pos, yaw, a, b, c, d) => {
    const k = q(smooth(ramp(f, a, b)) * (1 - smooth(ramp(f, c, d))), 2);
    return RW(T, o, { expr: 'grin', mode: 'stand', blink: blinkAt(f, seed), seed, prop: ['point', k] }, pos, { tint, yaw, flip: true });
  };
  switch (S.id) {
    case 'title': {
      out.push(boyR('grin'));
      out.push(kingR('neutral'));
      break;
    }
    case 'heavy': {
      out.push(kingR('neutral'));
      out.push(boyR('neutral'));
      break;
    }
    case 'wise': {
      out.push(RW(T, OUTFITS.king, { expr: 'stern', mode: 'sit', blink: blinkAt(f, 31), seed: 31 }, [...THRONE], { tint, yaw: 0 }));
      out.push(st(OUTFITS.wiseA, 'dazed', 81, WISE_L, { yaw: 0.25 }));
      out.push(st(OUTFITS.wiseB, 'dazed', 82, WISE_R, { yaw: -0.25 }));
      out.push(st(OUTFITS.smith, 'neutral', 83, SMITH, { yaw: 0.2 }));
      out.push(st(OUTFITS.guardL, 'stern', 61, GLP, { yaw: 0.15 }));
      out.push(st(OUTFITS.guardR, 'stern', 62, GRP, { yaw: -0.15 }));
      break;
    }
    case 'boy': {
      const k = q(smooth(ramp(f, 405, 415)) * (1 - smooth(ramp(f, 470, 487))), 2);
      out.push(RW(T, OUTFITS.boy, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 92), seed: 92, prop: ['point', k] }, BOY_COURT, { tint, yaw: 0.5, flip: true }));
      out.push(kingC('neutral'));
      out.push(st(OUTFITS.wiseA, 'neutral', 81, WISE_L, { yaw: 0.25 }));
      break;
    }
    case 'laugh': {
      out.push(RW(T, OUTFITS.king, { expr: 'laugh', mode: 'sit', blink: blinkAt(f, 31), seed: 31 }, [...THRONE], { tint, yaw: 0 }));
      out.push(boyC('neutral'));
      out.push(st(OUTFITS.wiseA, 'laugh', 81, WISE_L, { yaw: 0.25 }));
      out.push(st(OUTFITS.wiseB, 'laugh', 82, WISE_R, { yaw: -0.25 }));
      break;
    }
    case 'lead': {
      out.push(pointAt(OUTFITS.boy, 91, BOY, 0.5, 600, 615, 670, 688));
      out.push(kingR('neutral'));
      break;
    }
    case 'onboard': {
      out.push(boyR('grin'));
      out.push(kingR('shock'));
      break;
    }
    case 'sank': {
      const k = 0.3;   // the king leans over the boat, watching it sink
      out.push(RW(T, OUTFITS.king, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 31), seed: 31, ...bowOpts(k) }, BP(KING_R, k), { tint, yaw: -0.5 }));
      out.push(boyR('neutral'));
      break;
    }
    case 'chalk': {
      // the boy's arm reaches to the boat's side, marking the waterline
      const k = q(smooth(ramp(f, 800, 815)) * (1 - smooth(ramp(f, 870, 898))), 2);
      out.push(RW(T, OUTFITS.boy, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 91), seed: 91, prop: ['point', k] }, BOY, { tint, yaw: 0.5, flip: true }));
      out.push(kingR('neutral'));
      break;
    }
    case 'off': {
      out.push(boyR('grin'));
      out.push(kingR('neutral'));
      break;
    }
    case 'bring': {
      out.push(pointAt(OUTFITS.boy, 91, BOY, 0.5, 990, 1000, 1030, 1044));
      out.push(st(OUTFITS.soldier, 'stern', 61, SOLD_L, { yaw: 0.4 }));
      out.push(st(OUTFITS.soldier2, 'stern', 62, SOLD_R, { yaw: -0.4 }));
      out.push(kingR('neutral'));
      break;
    }
    case 'load': {
      // soldiers load stones one by one — arm rises with each stone
      const k1 = q(0.4 + 0.5 * Math.abs(Math.sin((f - 1045) * 0.09)), 2);
      const k2 = q(0.4 + 0.5 * Math.abs(Math.cos((f - 1045) * 0.09)), 2);
      out.push(RW(T, OUTFITS.soldier, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 61), seed: 61, prop: ['point', k1] }, SOLD_L, { tint, yaw: 0.4 }));
      out.push(RW(T, OUTFITS.soldier2, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 62), seed: 62, prop: ['point', k2] }, SOLD_R, { tint, yaw: -0.4, flip: true }));
      out.push(boyR('grin'));
      break;
    }
    case 'mark': {
      const k = 0.35;   // the king leans over the boat, watching the waterline
      out.push(RW(T, OUTFITS.king, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 31), seed: 31, ...bowOpts(k) }, BP(KING_R, k), { tint, yaw: -0.5 }));
      out.push(boyR('grin'));
      out.push(st(OUTFITS.soldier, 'neutral', 61, SOLD_L, { yaw: 0.4 }));
      break;
    }
    case 'smile': {
      const k = q(smooth(ramp(f, 1260, 1275)) * (1 - smooth(ramp(f, 1400, 1442))), 2);
      out.push(RW(T, OUTFITS.boy, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 91), seed: 91, prop: ['point', k] }, BOY, { tint, yaw: 0.5, flip: true }));
      out.push(kingR('dazed'));
      break;
    }
    case 'king': {
      out.push(kingR('stern'));
      out.push(boyR('grin'));
      break;
    }
    case 'weighed': {
      out.push(kingR('smile_closed'));
      out.push(boyR('grin'));
      out.push(st(OUTFITS.soldier, 'neutral', 61, SOLD_L, { yaw: 0.4 }));
      break;
    }
    case 'stranger': {
      out.push(RW(T, OUTFITS.king, { expr: 'dazed', mode: 'sit', blink: blinkAt(f, 31), seed: 31 }, [...THRONE], { tint, yaw: 0 }));
      out.push(st(OUTFITS.shepherd, 'neutral', 71, SHEPHERD, { yaw: 0.25 }));
      break;
    }
    case 'goat': {
      out.push(st(OUTFITS.shepherd, 'grin', 71, SHEPHERD, { yaw: 0.25 }));
      out.push(st(OUTFITS.merchant, 'stern', 72, MERCHANT, { yaw: -0.25 }));
      out.push(kingC('neutral'));
      break;
    }
    case 'hook': {
      out.push(RW(T, OUTFITS.king, { expr: 'dazed', mode: 'sit', blink: blinkAt(f, 31), seed: 31 }, [...THRONE], { tint, yaw: 0 }));
      out.push(st(OUTFITS.shepherd, 'grin', 71, SHEPHERD, { yaw: 0.25 }));
      out.push(st(OUTFITS.merchant, 'neutral', 72, MERCHANT, { yaw: -0.25 }));
      break;
    }
  }
  return out;
};
export const fxAt = (f, T) => [];
