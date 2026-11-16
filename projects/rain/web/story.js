// Shot plan for "The Farmer Who Sold the Rain" (batch-5 topic 5, EN) —
// timed to the ACTUAL voice stem (62.53 s, 30 fps, TOTAL 1876), clause
// timings from faster-whisper alignment (39 phrases):
// P1 0-25 rains failed | P2 32-79 fields cracking, king desperate |
// P3 93-185 farmer came to palace with an offer | P4 201-247 sell tomorrow's rain |
// P5 259-283 one hundred gold coins | P6 294-345 no rain by sunset tomorrow |
// P7 354-385 pay double back | P8 400-429 ministers scoffed |
// P9 431-457 king narrowed his eyes | P10 470-499 you cannot sell the rain |
// P11 506-535 rain belongs to the sky | P12 555-609 sky will have to agree |
// P13 618-662 king paid | P14 677-720 evening, farmer did not pray |
// P15 729-736 he watched | P16 748-809 ants marching uphill |
// P17 809-874 wind turn, air heavy | P18 886-942 clouds gather dark over hills |
// P19 951-964 he smiled | P20 978-1012 sky had already promised |
// P21 1032-1076 rain came down in sheets | P22 1090-1107 fields drank |
// P23 1113-1129 rivers rose | P24 1137-1165 kingdom cheered |
// P25 1182-1237 king demanded his secret | P26 1254-1269 farmer bowed |
// P27 1285-1319 I didn't sell you the rain | P28 1335-1368 I sold you the sky's promise |
// P29 1382-1403 ants told me | P30 1406-1427 wind told me |
// P31 1431-1471 rain was never mine to sell | P32 1485-1563 king laughed, paid double |
// P33 1579-1606 then tomorrow | P34 1612-1629 sell me the sunshine |
// P35 1629-1752 woman who sold a pot that cooks all by itself |
// P36 1765-1780 no fire | P37 1788-1795 no cook | P38 1804-1807 nothing |
// P39 1824-1873 how does a pot cook with no fire at all? (+ hold to 1875)
// QUALITY RULES (owner, batch-5): shots change ONLY at clause boundaries;
// camera TRACKS the voice-named subject every beat (biggest/centred),
// never freezes, never drifts; characters act in place — travel only via
// foot-locked march; costumes by role (king = crown + royal red robe,
// farmer = poor man, worn work clothes; ministers = rich dress;
// woman = sari dress, hair).
// PHYSICS RULES (owner, 2026-11-15 — top priority): props sit flush ON
// their surfaces with contact shadows; the gold pouch rests ON the side
// table, is lifted and handed over with weight (dip on handover); the
// rain falls with real gravity and STOPS on the ground; the ants march
// uphill in a line on the mound; the king's crown SLIPS when he laughs —
// tilted/askew but always seated on the skull.
// World: drought fields (cracked dry ground, hills behind) + palace court.
// Throne against the back wall (x=-16, z=-7.6); the farmer stands in the
// court east of the throne; the evening watch happens in the field.
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1876, DECK = 0;
export const SHOTS = [
  { id: 'drought', a: 0, b: 92, light: 'drought' },
  { id: 'offer', a: 93, b: 200, light: 'court' },
  { id: 'deal', a: 201, b: 399, light: 'court' },
  { id: 'scoff', a: 400, b: 554, light: 'court' },
  { id: 'paid', a: 555, b: 676, light: 'court' },
  { id: 'watch', a: 677, b: 1012, light: 'eve' },
  { id: 'rain', a: 1013, b: 1181, light: 'storm' },
  { id: 'secret', a: 1182, b: 1484, light: 'court' },
  { id: 'laugh', a: 1485, b: 1628, light: 'court' },
  { id: 'hook', a: 1629, b: 1875, light: 'court' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
M.linear = (t) => clamp(t);

// ---------- lights ----------
const WATER = { waterDeep: '#223c4e', waterShal: '#2c4a63', glint: '#ffe9c0' };
export const LIGHTS = {
  court: { az: 100, el: 35, sky: '#c8b490', ground: '#5c4a34', hemi: 1.1, sun: '#ffd9a0', sunI: 2.1, fog: '#d8c8a0', fogNear: 10000, fogFar: 20000,
    skyTop: '#5a6a94', skyHor: '#ffe0b0', sunDisc: '#fff3cf', sunSize: 0.0032, sat: 1.06, vig: 0.22, shadowExt: 150, aurora: 0, gain: '#ffedd2', ...WATER },
  drought: { az: 100, el: 38, sky: '#c8b490', ground: '#8a6a42', hemi: 1.25, sun: '#ffd9a0', sunI: 2.5, fog: '#d8c8a0', fogNear: 10000, fogFar: 20000,
    skyTop: '#6a7a9e', skyHor: '#ffe0a0', sunDisc: '#fff3cf', sunSize: 0.0032, sat: 1.08, vig: 0.2, shadowExt: 150, aurora: 0, gain: '#ffedd2', ...WATER },
  eve: { az: 96, el: 24, sky: '#9a8a76', ground: '#4a3a2c', hemi: 0.88, sun: '#ffb877', sunI: 1.65, fog: '#b09a80', fogNear: 10000, fogFar: 20000,
    skyTop: '#3d4c74', skyHor: '#e8b98a', sunDisc: '#ffdfae', sunSize: 0.0036, sat: 1.04, vig: 0.26, shadowExt: 150, aurora: 0, gain: '#e9dcff', ...WATER },
  storm: { az: 100, el: 32, sky: '#7a7a88', ground: '#4a4238', hemi: 0.95, sun: '#c8ccd8', sunI: 1.3, fog: '#8a8a98', fogNear: 10000, fogFar: 20000,
    skyTop: '#333a48', skyHor: '#7a7a88', sunDisc: '#d8d8e0', sunSize: 0.002, sat: 0.92, vig: 0.3, shadowExt: 150, aurora: 0, gain: '#d8dce8', ...WATER },
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
  if (S.id === 'watch') return blendLight(LIGHTS.court, LIGHTS.eve, smooth(ramp(f, 677, 720)));
  if (S.id === 'rain') {
    if (f < 1032) return blendLight(LIGHTS.eve, LIGHTS.storm, smooth(ramp(f, 1013, 1032)));
    if (f >= 1165) return blendLight(LIGHTS.storm, LIGHTS.court, smooth(ramp(f, 1165, 1182)));
    return { ...LIGHTS.storm };
  }
  return { ...LIGHTS[S.light] };
};

// ---------- staging ----------
export const KINGP = [-16, 0, -6.1];          // before the throne
export const FARM = [-13.4, 0, -3.4];         // the farmer in the court
export const PAID_FARM = [-17.8, 0, -4.6];    // the farmer stepped up by the throne to be paid
export const WATCH = [-1.5, 0, 1.5];          // the farmer in the field (evening watch)
export const BAGT = [-14.6, 0, -4.6];         // the king's side table; top y = 0.78
export const MOUND = [-0.3, 0, 0.6];          // the ants' hillock in the field
export const RIVERP = [2, 0, 5];              // the river strip in the field
export const WOMANP = [-16.9, 0, -2.8];       // the woman with the pot (hook, under the board)
export const POTP = [-16.2, 0, -2.6];         // the self-cooking pot on its stool; top y = 0.50
export const TITLEP = [-2, 0, -6];            // title signpost in the field
// The ants (P16, "ants marching uphill in long lines"): two lines of dark
// dots march UP the mound along a fixed path, f748-809. Path points are
// [x, y, z] on the mound slope; y is the mound surface height at that point.
export const ANTS = { f0: 748, f1: 809, count: 48, path: [[-0.95, 0.03, 1.05], [-0.6, 0.15, 0.85], [-0.3, 0.50, 0.6]] };
// The rain (P21, "rain came down in sheets"): drops spawn at cloud height
// and fall with g = 9.8, accelerating, and STOP on the ground (y = 0.02
// for a 3-frame splash, then respawn at the top). Visible f1032-1165.
export const RAIN = { f0: 1032, f1: 1165, count: 1400 };
// The gold pouch: rests ON the side table (y = table top) -> lifted by the
// farmer's hand (f662) -> carried to his front (arrives f690, weight dip
// f690-706) -> SET DOWN on the ground at his feet in the field (f720-1182,
// y = 0, base flush with its contact shadow — fix 2026-11-16: at chest
// height beside him it read as floating with no hand holding it) -> carried
// back in the court after the rain.
export const bagPosAt = (f) => kf3([
  [0, [BAGT[0], 0.78, BAGT[2]]], [662, [BAGT[0], 0.78, BAGT[2]]],
  [672, [-14.05, 1.05, -4.0]], [690, [-13.55, 0.95, -2.9]],
  [720, [-1.65, 0, 1.9]], [1182, [-1.65, 0, 1.9]],
  [1210, [-13.55, 0.95, -2.9]], [1875, [-13.55, 0.95, -2.9]],
], f);
/** Handover weight dip: the pouch sags as the farmer takes its weight. */
export const bagDipAt = (f) => kf([[0, 0], [689, 0], [696, -0.05], [706, 0], [1875, 0]], f);

const HERO = {
  drought: (f) => (f < 32 ? [-2, 1.9, -6] : KINGP),
  offer: () => FARM,
  deal: (f) => (f >= 259 && f < 294 ? [-14.6, 0.9, -4.6] : FARM),
  scoff: (f) => (f < 457 ? [-16.5, 1.2, -5.0] : KINGP),
  paid: (f) => (f < 618 ? [-17.8, 1.0, -4.6] : [-14.6, 0.9, -4.6]),
  watch: (f) => (f >= 748 && f < 809 ? [-0.35, 0.35, 0.65] : (f >= 886 && f < 942 ? [-3, 9, -24] : WATCH)),
  rain: (f) => (f >= 1113 && f < 1137 ? [2, 0.3, 5] : (f >= 1137 ? [-2, 1.2, 2.5] : [-3, 1, -1])),
  secret: (f) => (f >= 1431 ? KINGP : FARM),
  laugh: () => KINGP,
  hook: (f) => (f < 1807 ? [-16.6, 1.0, -2.6] : [-17.6, 2.65, -3.4]),
};
export const heroPosAt = (f) => HERO[shotAt(f).id](f);

// ---------- cameras ----------
// Every shot's first key repeats the previous shot's last key (continuous
// flight, no cuts); inside a shot the camera surges TO the clause subject
// and settles into a slow push-in on it. Keys land on clause boundaries.
const CAMS = {
  drought: [
    { f: 0, pos: [1.5, 3.0, 4.5], look: [-2.0, 1.9, -5.5], fov: 46 },
    { f: 21, pos: [1.5, 3.0, 4.5], look: [-2.0, 1.9, -5.5], fov: 46 },
    { f: 32, pos: [-11.5, 2.6, 0.8], look: [-15.9, 1.3, -5.9], fov: 42, ease: 'surge' },
    { f: 79, pos: [-11.7, 2.5, 0.6], look: [-15.9, 1.28, -5.9], fov: 41 },
    { f: 92, pos: [-11.7, 2.5, 0.6], look: [-15.9, 1.28, -5.9], fov: 41 },
  ],
  offer: [
    { f: 93, pos: [-11.7, 2.5, 0.6], look: [-15.9, 1.28, -5.9], fov: 41 },
    { f: 120, pos: [-9.8, 2.2, 1.2], look: [-13.4, 1.1, -3.4], fov: 42, ease: 'surge' },
    { f: 185, pos: [-10.2, 2.1, 0.8], look: [-13.4, 1.05, -3.4], fov: 40 },
    { f: 200, pos: [-10.2, 2.1, 0.8], look: [-13.4, 1.05, -3.4], fov: 40 },
  ],
  deal: [
    { f: 201, pos: [-10.2, 2.1, 0.8], look: [-13.4, 1.05, -3.4], fov: 40 },
    { f: 247, pos: [-10.4, 2.05, 0.6], look: [-13.4, 1.0, -3.4], fov: 39 },
    { f: 259, pos: [-16.4, 1.9, -2.0], look: [-14.8, 0.85, -4.5], fov: 40, ease: 'surge' },
    { f: 294, pos: [-9.9, 2.4, 1.4], look: [-14.6, 1.1, -4.4], fov: 44, ease: 'surge' },
    { f: 345, pos: [-10.0, 2.35, 1.3], look: [-14.6, 1.08, -4.4], fov: 43 },
    { f: 354, pos: [-10.4, 2.05, 0.6], look: [-13.4, 1.0, -3.4], fov: 39, ease: 'surge' },
    { f: 399, pos: [-10.4, 2.05, 0.6], look: [-13.4, 1.0, -3.4], fov: 39 },
  ],
  scoff: [
    { f: 400, pos: [-10.4, 2.05, 0.6], look: [-13.4, 1.0, -3.4], fov: 39 },
    { f: 429, pos: [-12.5, 2.6, 0.5], look: [-16.5, 1.2, -5.0], fov: 44, ease: 'surge' },
    { f: 457, pos: [-13.6, 1.9, -2.6], look: [-15.95, 1.4, -6.05], fov: 36, ease: 'surge' },
    { f: 499, pos: [-13.65, 1.88, -2.65], look: [-15.95, 1.4, -6.05], fov: 35 },
    { f: 506, pos: [-13.6, 1.9, -2.6], look: [-15.8, 2.6, -6.2], fov: 38, ease: 'surge' },
    { f: 554, pos: [-13.6, 1.9, -2.6], look: [-15.8, 2.55, -6.2], fov: 38 },
  ],
  paid: [
    { f: 555, pos: [-13.6, 1.9, -2.6], look: [-15.8, 2.55, -6.2], fov: 38 },
    { f: 609, pos: [-14.5, 2.0, -1.0], look: [-17.8, 1.1, -4.6], fov: 40, ease: 'surge' },
    { f: 618, pos: [-12.6, 2.2, -0.6], look: [-15.2, 1.0, -5.2], fov: 44, ease: 'surge' },
    { f: 662, pos: [-12.7, 2.15, -0.7], look: [-15.2, 1.0, -5.2], fov: 43 },
    { f: 676, pos: [-12.7, 2.15, -0.7], look: [-15.2, 1.0, -5.2], fov: 43 },
  ],
  watch: [
    { f: 677, pos: [-12.7, 2.15, -0.7], look: [-15.2, 1.0, -5.2], fov: 43 },
    { f: 720, pos: [2.2, 2.6, 6.8], look: [-1.5, 1.1, 1.5], fov: 44, ease: 'surge' },
    { f: 736, pos: [1.6, 2.3, 5.6], look: [-1.5, 1.05, 1.5], fov: 42, ease: 'surge' },
    { f: 748, pos: [1.3, 1.1, 2.6], look: [-0.35, 0.35, 0.65], fov: 40, ease: 'surge' },
    { f: 809, pos: [2.6, 3.2, 7.2], look: [-3.0, 2.2, -4.0], fov: 46, ease: 'surge' },
    { f: 874, pos: [2.5, 3.15, 7.1], look: [-3.0, 2.2, -4.0], fov: 46 },
    { f: 886, pos: [1.5, 3.0, 6.0], look: [-3.0, 9.0, -24.0], fov: 46, ease: 'surge' },
    { f: 942, pos: [1.45, 2.95, 5.9], look: [-3.0, 9.0, -24.0], fov: 46 },
    { f: 955, pos: [0.6, 1.9, 4.2], look: [-1.5, 1.1, 1.5], fov: 40, ease: 'surge' },
    { f: 964, pos: [0.6, 1.9, 4.2], look: [-1.5, 1.1, 1.5], fov: 40 },
    { f: 978, pos: [0.8, 2.2, 4.6], look: [-1.5, 2.6, 1.0], fov: 40, ease: 'surge' },
    { f: 1012, pos: [0.8, 2.2, 4.6], look: [-1.5, 2.55, 1.0], fov: 40 },
  ],
  rain: [
    { f: 1013, pos: [0.8, 2.2, 4.6], look: [-1.5, 2.55, 1.0], fov: 40 },
    { f: 1032, pos: [3.5, 3.0, 8.0], look: [-2.5, 1.0, 0.5], fov: 46, ease: 'surge' },
    { f: 1076, pos: [3.2, 2.9, 7.6], look: [-2.5, 1.0, 0.5], fov: 45 },
    { f: 1090, pos: [3.0, 1.8, 7.5], look: [-2.0, 0.4, 0.0], fov: 46, ease: 'surge' },
    { f: 1113, pos: [5.5, 3.0, 10.5], look: [2.0, 0.3, 5.0], fov: 46, ease: 'surge' },
    { f: 1137, pos: [3.5, 3.0, 9.0], look: [-2.0, 1.2, 2.5], fov: 46, ease: 'surge' },
    { f: 1165, pos: [3.4, 2.95, 8.9], look: [-2.0, 1.2, 2.5], fov: 46 },
    { f: 1181, pos: [3.4, 2.95, 8.9], look: [-2.0, 1.2, 2.5], fov: 46 },
  ],
  secret: [
    { f: 1182, pos: [3.4, 2.95, 8.9], look: [-2.0, 1.2, 2.5], fov: 46 },
    { f: 1237, pos: [-11.0, 2.4, 0.8], look: [-14.8, 1.2, -4.8], fov: 43, ease: 'surge' },
    { f: 1254, pos: [-10.4, 2.05, 0.6], look: [-13.4, 1.0, -3.4], fov: 39, ease: 'surge' },
    { f: 1285, pos: [-10.4, 2.05, 0.6], look: [-13.4, 1.0, -3.4], fov: 39 },
    { f: 1335, pos: [-10.6, 2.2, 0.9], look: [-13.4, 2.2, -3.4], fov: 40, ease: 'surge' },
    { f: 1368, pos: [-10.6, 2.2, 0.9], look: [-13.4, 2.15, -3.4], fov: 40 },
    { f: 1382, pos: [-10.4, 2.05, 0.6], look: [-13.4, 1.0, -3.4], fov: 39, ease: 'surge' },
    { f: 1431, pos: [-13.6, 1.9, -2.6], look: [-15.95, 1.4, -6.05], fov: 36, ease: 'surge' },
    { f: 1484, pos: [-13.65, 1.88, -2.65], look: [-15.95, 1.4, -6.05], fov: 36 },
  ],
  laugh: [
    { f: 1485, pos: [-13.65, 1.88, -2.65], look: [-15.95, 1.4, -6.05], fov: 36 },
    { f: 1563, pos: [-13.8, 1.85, -2.8], look: [-15.95, 1.38, -6.02], fov: 36 },
    { f: 1579, pos: [-13.8, 1.85, -2.8], look: [-15.95, 1.38, -6.02], fov: 36 },
    { f: 1612, pos: [-13.4, 2.0, -2.2], look: [-15.8, 2.4, -6.0], fov: 38, ease: 'surge' },
    { f: 1628, pos: [-13.4, 2.0, -2.2], look: [-15.8, 2.4, -6.0], fov: 38 },
  ],
  hook: [
    { f: 1629, pos: [-13.4, 2.0, -2.2], look: [-15.8, 2.4, -6.0], fov: 38 },
    { f: 1700, pos: [-12.4, 2.2, 1.8], look: [-16.6, 1.0, -2.6], fov: 42, ease: 'surge' },
    { f: 1752, pos: [-12.5, 2.15, 1.7], look: [-16.6, 1.0, -2.6], fov: 42 },
    { f: 1765, pos: [-13.6, 1.8, 1.0], look: [-16.2, 0.9, -2.6], fov: 38, ease: 'surge' },
    { f: 1807, pos: [-11.5, 2.3, 1.8], look: [-17.6, 2.5, -3.4], fov: 38, ease: 'surge' },
    { f: 1824, pos: [-10.2, 2.2, 1.6], look: [-17.6, 2.65, -3.4], fov: 36, ease: 'surge' },
    { f: 1875, pos: [-10.2, 2.2, 1.6], look: [-17.6, 2.65, -3.4], fov: 36 },
  ],
};
export const camAt = (f) => camFromKeys(CAMS[shotAt(f).id], f);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const hp = heroPosAt(f);
  let cinf = 5;
  if (['scoff', 'paid', 'secret'].includes(S.id)) cinf = 3.6;
  if (S.id === 'hook') cinf = 3.2;
  if (S.id === 'watch' && f >= 748 && f < 809) cinf = 3.4;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { boardTitle: 0, boardHook: 0, hookSet: 0, rainAmt: 0, antsAmt: 0, cloudAmt: 0, riverAmt: 0, steamAmt: 0, crownSlip: 0, crownDx: 0, bag2: 0 };
  if (S.id === 'drought') W.boardTitle = 1 - smooth(ramp(f, 17, 21));
  if (S.id === 'watch') {
    W.antsAmt = smooth(ramp(f, 748, 756)) * (1 - smooth(ramp(f, 809, 820)));
    W.cloudAmt = smooth(ramp(f, 886, 910));
  }
  if (S.id === 'rain') {
    W.cloudAmt = 1;
    W.rainAmt = smooth(ramp(f, 1032, 1048)) * (1 - smooth(ramp(f, 1165, 1182)));
    W.riverAmt = smooth(ramp(f, 1113, 1129));
  }
  if (S.id === 'hook') {
    W.hookSet = smooth(ramp(f, 1629, 1645));
    W.steamAmt = smooth(ramp(f, 1640, 1660));
    W.boardHook = smooth(ramp(f, 1824, 1838));
  }
  // the crown slips as the laugh bursts (f1500-1530) and STAYS askew
  if (f >= 1500) { const k = smooth(ramp(f, 1500, 1530)); W.crownSlip = q(k * 14, 1); W.crownDx = q(k * 7, 1); }
  // the king pays DOUBLE anyway — a second pouch is set on the side table
  if (f >= 1555) W.bag2 = smooth(ramp(f, 1555, 1575));
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  if (S.id === 'drought') return { smokeRate: 0.25, dustRate: 0.25, splashRate: 0 };
  if (S.id === 'watch') return { smokeRate: 0.2, dustRate: (f >= 809 && f < 874) ? 1.2 : 0.12, splashRate: 0 };
  if (S.id === 'rain') return { smokeRate: 0.2, dustRate: 0.05, splashRate: 0 };
  return { smokeRate: 0.3, dustRate: 0.12, splashRate: 0 };
};

// ---------- actors ----------
const TINT = { court: '#ffdfb0', drought: '#ffe0b0', eve: '#ffd9a8', storm: '#c8ccd8' };
const tintFor = (S, f) => TINT[S.light] || '#ffffff';
// COSTUMES BY ROLE — king: crown + royal red robe, stout; farmer: POOR man,
// worn work clothes, brown cap, dark moustache; ministers: rich palace
// dress; villagers: simple clothes; woman (hook): sari dress, long hair.
export const OUTFITS = {
  king: { jacket: '#7a1f2e', pants: '#3a2a4a', boots: '#241a12', hat: 'crown', skin: '#e8b08a', moustache: '#d8d0c0', build: 'stout', dress: '#7a1f2e' },
  farmer: { jacket: '#7a6a4a', pants: '#5a4a38', boots: '#33291c', hat: 'cap', cap: '#8a6a3a', skin: '#c98a5a', moustache: '#2a201a' },
  courtier: { jacket: '#2e5a8c', pants: '#22344a', boots: '#2e2118', hat: 'cap', cap: '#3a2a4a', skin: '#e8b08a' },
  courtier2: { jacket: '#5d3a6e', pants: '#33243d', boots: '#241a12', hat: 'hair', hair: '#241a12', skin: '#c98a5a' },
  courtier3: { jacket: '#6e4a3a', pants: '#4a3428', boots: '#2e2118', hat: 'cap', cap: '#8a7a5a', skin: '#e8b08a' },
  villager: { jacket: '#6e6248', pants: '#4f4433', boots: '#33291c', hat: 'cap', cap: '#5a4a38', skin: '#c98a5a' },
  villager2: { jacket: '#4a6a5a', pants: '#3a4438', boots: '#2e2118', hat: 'hair', hair: '#3a2a1a', skin: '#e8b08a' },
  woman: { jacket: '#a03a5a', pants: '#5a2a3a', boots: '#241a12', hat: 'hair', hair: '#241a12', skin: '#c98a5a', dress: '#a03a5a' },
};
const RW = (T, o, opts, pos, extra = {}) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], ...extra });
const stand = (T, tint, f) => (o, expr, seed, pos, extra = {}) => RW(T, o, { expr, mode: 'stand', blink: blinkAt(f, seed), seed }, pos, { tint, ...extra });
const bowK = (f, a, b, c, d) => smooth(ramp(f, a, b)) * (1 - smooth(ramp(f, c, d)));
const bowOpts = (k) => ({ headTilt: q(k * 17, 1) });
const BP = (pos, k) => [pos[0], q(-0.07 * k, 3), pos[2]];

const CROWD = [[-18.6, 0, -6.2], [-12.9, 0, -6.4], [-18.9, 0, -3.3]];
const crowdAt = (T, tint, f, expr) => {
  const outs = [OUTFITS.courtier2, OUTFITS.courtier3, OUTFITS.courtier2];
  return CROWD.map((p, i) => RW(T, outs[i], { expr, mode: 'stand', blink: blinkAt(f, 71 + i), seed: 71 + i }, p, { tint, yaw: i % 2 ? 0.3 : -0.3 }));
};
const CHEER = [[-4.5, 0, 3.5], [-3.2, 0, 4.6], [0.5, 0, 3.8], [-0.8, 0, 5.2]];
const cheerAt = (T, tint, f) => {
  const outs = [OUTFITS.villager, OUTFITS.villager2, OUTFITS.villager, OUTFITS.villager2];
  return CHEER.map((p, i) => RW(T, outs[i], { expr: i % 2 ? 'laugh' : 'grin', mode: 'stand', blink: blinkAt(f, 91 + i), seed: 91 + i }, p, { tint, yaw: i % 2 ? 0.4 : -0.4 }));
};

export const actorsAt = (f, T) => {
  const S = shotAt(f), tint = tintFor(S, f), out = [];
  const st = stand(T, tint, f);
  const W = worldAt(f);
  const king = (expr, extra = {}) => RW(T, OUTFITS.king, { expr, mode: 'stand', blink: blinkAt(f, 41), seed: 41, crownSlip: W.crownSlip, crownDx: W.crownDx, ...extra }, KINGP, { tint, yaw: 0.15 });
  const farmer = (expr, extra = {}) => st(OUTFITS.farmer, expr, 51, FARM, { yaw: -0.35, ...extra });
  const farmerField = (expr, extra = {}) => st(OUTFITS.farmer, expr, 51, WATCH, { yaw: 0.35, ...extra });
  switch (S.id) {
    case 'drought': {
      // P1: empty cracked field + title board; P2 (f32): the desperate king
      if (f >= 32) {
        out.push(king('nervous'));
        out.push(...crowdAt(T, tint, f, 'nervous'));
      }
      break;
    }
    case 'offer': {
      out.push(king('stern'));
      // P3 (f93): the farmer comes to the palace — a respectful bow
      const bk = bowK(f, 100, 112, 130, 145);
      out.push(RW(T, OUTFITS.farmer, { expr: 'smile_closed', mode: 'stand', blink: blinkAt(f, 51), seed: 51, ...bowOpts(bk) }, BP(FARM, bk), { tint, yaw: -0.35 }));
      out.push(...crowdAt(T, tint, f, 'neutral'));
      break;
    }
    case 'deal': {
      out.push(king(f >= 294 ? 'nervous' : 'stern'));
      out.push(farmer('smile_closed'));
      out.push(...crowdAt(T, tint, f, 'neutral'));
      break;
    }
    case 'scoff': {
      // P8: the ministers scoff (laugh); P9: the king narrows his eyes
      out.push(king(f < 431 ? 'stern' : 'stern', { headTilt: f >= 431 ? 2 : 0 }));
      out.push(farmer(f < 431 ? 'neutral' : 'nervous'));
      out.push(...crowdAt(T, tint, f, f < 431 ? 'laugh' : 'neutral'));
      break;
    }
    case 'paid': {
      out.push(king('neutral'));
      // the farmer has stepped up by the throne to be paid
      out.push(RW(T, OUTFITS.farmer, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, PAID_FARM, { tint, yaw: 0.4 }));
      out.push(...crowdAt(T, tint, f, 'neutral'));
      break;
    }
    case 'watch': {
      // P14: he did not pray — head bowed a little; P16-18: he watches the
      // ants, the wind, the clouds; P19: he smiles; P20: the sky promised
      const expr = f < 729 ? 'neutral' : (f < 951 ? 'neutral' : (f < 978 ? 'smile' : 'smile_closed'));
      const headTilt = f < 729 ? 5 : (f >= 748 && f < 809 ? 4 : 0);
      out.push(RW(T, OUTFITS.farmer, { expr, mode: 'stand', blink: blinkAt(f, 51), seed: 51, headTilt }, WATCH, { tint, yaw: f >= 748 && f < 809 ? -0.6 : 0.35 }));
      break;
    }
    case 'rain': {
      // P21-24: the farmer stands in the pouring rain, grinning; the
      // villagers cheer around him
      out.push(farmerField('grin'));
      out.push(...cheerAt(T, tint, f));
      break;
    }
    case 'secret': {
      out.push(king('stern'));
      // P26 (f1254): the farmer bows; P27-31: he explains, composed
      const bk = bowK(f, 1254, 1264, 1310, 1325);
      const fexpr = f < 1285 ? 'neutral' : 'smile_closed';
      out.push(RW(T, OUTFITS.farmer, { expr: fexpr, mode: 'stand', blink: blinkAt(f, 51), seed: 51, ...bowOpts(bk) }, BP(FARM, bk), { tint, yaw: -0.35 }));
      out.push(...crowdAt(T, tint, f, 'neutral'));
      break;
    }
    case 'laugh': {
      // P32: the laugh bursts — head shakes, crown slips; P33-34: grin
      const laughShake = (f >= 1500 && f < 1563) ? q(Math.sin((f - 1500) * 0.55) * 2.4, 1) : 0;
      const kExpr = f < 1500 ? 'shock' : (f < 1563 ? 'laugh' : 'grin');
      out.push(king(kExpr, { headTilt: laughShake }));
      out.push(farmer('grin'));
      out.push(...crowdAt(T, tint, f, f >= 1500 ? 'laugh' : 'neutral'));
      break;
    }
    case 'hook': {
      // tomorrow's teaser: the woman and her self-cooking pot — and the
      // hook board for the final question. The king watches the teaser
      // (f<1700) then the camera leaves him behind, naturally out of frame.
      out.push(RW(T, OUTFITS.woman, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 81), seed: 81 }, WOMANP, { tint, yaw: 0.35 }));
      if (f < 1700) out.push(RW(T, OUTFITS.king, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 41), seed: 41, crownSlip: W.crownSlip, crownDx: W.crownDx }, KINGP, { tint, yaw: 0.15 }));
      break;
    }
  }
  return out;
};
export const fxAt = (f, T) => [];
