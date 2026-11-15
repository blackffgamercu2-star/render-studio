// Shot plan for "The Rope Made of Sand" (batch-4 topic 5, EN) —
// timed to the ACTUAL voice stem (60.29 s, 30 fps, TOTAL 1809), clause
// timings from faster-whisper alignment (33 phrases):
// P1 0-120 the order (hook line) | P2 133-173 agreed in one breath |
// P3 189-231 king hated being outsmarted | P4 244-295 called his gardener |
// P5 304-312 by sunrise | P6 312-361 a rope woven from sand |
// P7 372-404 fail — head rolls | P8 426-465 court waited for him to beg |
// P9 480-487 instead | P10 493-507 he bowed calmly |
// P11 527-553 it shall be done | P12 568-633 one small thing from the storehouse |
// P13 649-659 Name it! | P14 676-717 last year's rope of sand |
// P15 731-770 grandfather's weavers made | P16 783-808 I'm only a gardener |
// P17 808-893 copy their pattern exactly, or the rope will not hold |
// P18 911-940 the king's smile froze | P19 959-985 there was no such rope |
// P20 995-1019 there never had been | P21 1034-1058 you ask for the impossible |
// P22 1075-1099 the gardener said gently | P23 1112-1169 learn how it was done before |
// P24 1189-1210 the king stared | P25 1225-1286 laughed so hard his crown slipped |
// P26 1301-1319 Old fox! | P27 1333-1398 take a bag of gold, take the order back |
// P28 1411-1462 the impossible order died | P29 1472-1512 one polite question |
// P30 1528-1642 the boy who weighed the elephant, no scale |
// P31 1651-1662 no machine | P32 1672-1717 a boat and a pile of stones |
// P33 1737-1797 how do you weigh an elephant with no scale? (+ hold to 1808)
// QUALITY RULES (owner, batch-4): shots change ONLY at clause boundaries;
// camera TRACKS the voice-named subject every beat (biggest/centred),
// never freezes, never drifts; characters act in place — travel only via
// foot-locked march; costumes by role (king = crown + royal red robe,
// gardener = old man, worn work clothes, grey hair).
// PHYSICS RULES (owner, 2026-11-15 — top priority): props sit flush ON
// their surfaces with contact shadows; the sand pour falls with real
// gravity and STOPS on the pile; the gold bag is lifted, carried and
// handed over with weight (dip on handover); the king's crown SLIPS on
// his head when he laughs — tilted/askew but always seated on the skull.
// World: palace courtyard. Throne against the back wall (x=-16, z=-7.6);
// the gardener works at his sand table east (x=-12.2, z=-2.6) and never
// relocates — the king addresses him across the courtyard.
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1809, DECK = 0;
export const SHOTS = [
  { id: 'order', a: 0, b: 243, light: 'court' },
  { id: 'demand', a: 244, b: 425, light: 'court' },
  { id: 'calm', a: 426, b: 675, light: 'court' },
  { id: 'pattern', a: 676, b: 910, light: 'court' },
  { id: 'freeze', a: 911, b: 1033, light: 'court' },
  { id: 'gentle', a: 1034, b: 1188, light: 'court' },
  { id: 'laugh', a: 1189, b: 1410, light: 'court' },
  { id: 'died', a: 1411, b: 1527, light: 'court' },
  { id: 'hook', a: 1528, b: 1808, light: 'court' },
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
  eve: { az: 96, el: 24, sky: '#9a8a76', ground: '#4a3a2c', hemi: 0.88, sun: '#ffb877', sunI: 1.65, fog: '#b09a80', fogNear: 10000, fogFar: 20000,
    skyTop: '#3d4c74', skyHor: '#e8b98a', sunDisc: '#ffdfae', sunSize: 0.0036, sat: 1.04, vig: 0.26, shadowExt: 150, aurora: 0, gain: '#e9dcff', ...WATER },
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
  if (S.id === 'died') return blendLight(LIGHTS.court, LIGHTS.eve, smooth(ramp(f, 1420, 1500)));
  if (S.id === 'hook') return blendLight(LIGHTS.eve, LIGHTS.court, smooth(ramp(f, 1540, 1640)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging ----------
export const KINGP = [-16, 0, -6.1];          // before the throne
export const GARD = [-12.78, 0, -2.50];       // the gardener at his sand table (west side)
export const TABLE = [-12.2, 0, -2.6];        // sand table; top y = 0.80
export const PILE = [-12.2, 0.80, -2.6];      // sand pile base centre (on the table top)
export const BAGT = [-14.6, 0, -4.6];         // the king's side table; top y = 0.78
export const COURTIER_HOME = [-13.85, 0, -5.35]; // the servant who fetches the gold
// The sand pour (P6, "a rope woven from sand"): the gardener raises a
// handful over the pile and lets it stream through his fingers. SRC is
// the hand point in world space (tuned to his raised 'pour' hand in the
// insert framing); grains fall with g = 9.8 and STOP on the pile cone.
export const SAND = { src: [-12.35, 1.32, -2.83], f0: 318, f1: 394, pileTop: 1.10, pileR: 0.36 };
// The gold bag: rests ON the side table (y = table top) -> lifted by the
// courtier (f1336) -> carried with a march bob -> handed to the gardener
// (arrives f1398, weight dip f1398-1412) -> held at his front after.
export const bagPosAt = (f) => kf3([
  [0, [BAGT[0], 0.78, BAGT[2]]], [1333, [BAGT[0], 0.78, BAGT[2]]],
  [1342, [-14.05, 0.98, -4.95]], [1398, [-12.45, 0.90, -2.12]],
  [1410, [-12.45, 0.90, -2.12]], [1808, [-12.45, 0.90, -2.12]],
], f);
/** Handover weight dip: the bag sags as the gardener takes its weight. */
export const bagDipAt = (f) => kf([[0, 0], [1397, 0], [1403, -0.055], [1412, 0], [1808, 0]], f);
/** Courtier: stands by the side table; marches the bag to the gardener. */
export const courtierPosAt = (f) => kf3([
  [0, COURTIER_HOME], [1333, COURTIER_HOME], [1342, [-14.05, 0, -4.95]],
  [1398, [-13.55, 0, -3.10]], [1430, [-13.75, 0, -3.05]], [1480, COURTIER_HOME], [1808, COURTIER_HOME],
], f);
export const courtierMarchAt = (f) => (f >= 1342 && f < 1398) || (f >= 1430 && f < 1480);

const HERO = {
  order: (f) => (f < 189 ? [-14.5, 1.1, -4.3] : KINGP),
  demand: (f) => (f < 312 ? KINGP : (f < 372 ? [-12.5, 1.3, -2.5] : KINGP)),
  calm: (f) => (f < 649 ? GARD : KINGP),
  pattern: () => GARD,
  freeze: () => KINGP,
  gentle: () => GARD,
  laugh: (f) => (f < 1333 ? KINGP : [-13.3, 0.95, -2.8]),
  died: () => GARD,
  hook: (f) => (f < 1672 ? [-18.9, 1.4, -1.7] : (f < 1737 ? [-16.6, 0.5, -1.3] : [-17.6, 2.75, -3.4])),
};
export const heroPosAt = (f) => HERO[shotAt(f).id](f);

// ---------- cameras ----------
// Every shot's first key repeats the previous shot's last key (continuous
// flight, no cuts); inside a shot the camera surges TO the clause subject
// and settles into a slow push-in on it. Keys land on clause boundaries.
const CAMS = {
  order: [
    { f: 0, pos: [-8.6, 3.0, 4.2], look: [-14.4, 1.15, -4.4], fov: 47 },
    { f: 120, pos: [-9.2, 2.9, 2.8], look: [-14.6, 1.1, -4.5], fov: 44, ease: 'surge' },
    { f: 189, pos: [-11.2, 2.5, 0.6], look: [-15.7, 1.3, -5.8], fov: 42, ease: 'surge' },
    { f: 243, pos: [-11.8, 2.4, 0.2], look: [-15.9, 1.25, -5.9], fov: 41 },
  ],
  demand: [
    { f: 244, pos: [-11.8, 2.4, 0.2], look: [-15.9, 1.25, -5.9], fov: 41 },
    { f: 295, pos: [-12.1, 2.3, -0.2], look: [-15.95, 1.3, -6.0], fov: 40, ease: 'surge' },
    // P6 insert: the gardener at his table — the pour (f318-394)
    { f: 312, pos: [-9.7, 1.9, 0.7], look: [-12.45, 1.05, -2.55], fov: 40, ease: 'surge' },
    { f: 361, pos: [-9.9, 1.85, 0.5], look: [-12.45, 1.0, -2.55], fov: 39 },
    // P7: back to the king for the threat
    { f: 372, pos: [-11.8, 2.3, 0.0], look: [-15.9, 1.3, -5.95], fov: 41, ease: 'surge' },
    { f: 425, pos: [-11.9, 2.3, -0.1], look: [-15.9, 1.28, -5.95], fov: 40 },
  ],
  calm: [
    { f: 426, pos: [-11.9, 2.3, -0.1], look: [-15.9, 1.28, -5.95], fov: 40 },
    { f: 465, pos: [-8.8, 2.7, 2.4], look: [-14.4, 1.1, -4.3], fov: 45, ease: 'surge' },
    { f: 527, pos: [-10.5, 2.1, 0.5], look: [-12.85, 1.05, -2.55], fov: 40, ease: 'surge' },
    { f: 633, pos: [-10.7, 2.05, 0.3], look: [-12.85, 1.02, -2.55], fov: 39 },
    { f: 649, pos: [-12.1, 2.2, -0.5], look: [-15.9, 1.35, -6.0], fov: 38, ease: 'surge' },
    { f: 675, pos: [-12.2, 2.2, -0.6], look: [-15.9, 1.33, -6.0], fov: 38 },
  ],
  pattern: [
    { f: 676, pos: [-12.2, 2.2, -0.6], look: [-15.9, 1.33, -6.0], fov: 38 },
    { f: 717, pos: [-10.4, 2.0, 0.3], look: [-12.82, 1.05, -2.52], fov: 40, ease: 'surge' },
    { f: 808, pos: [-10.5, 2.0, 0.2], look: [-12.82, 1.03, -2.52], fov: 39 },
    { f: 893, pos: [-10.8, 1.95, 0.0], look: [-12.82, 1.05, -2.52], fov: 37, ease: 'surge' },
    { f: 910, pos: [-10.9, 1.95, -0.05], look: [-12.82, 1.05, -2.52], fov: 37 },
  ],
  freeze: [
    { f: 911, pos: [-10.9, 1.95, -0.05], look: [-12.82, 1.05, -2.52], fov: 37 },
    { f: 940, pos: [-13.9, 1.85, -3.4], look: [-15.95, 1.45, -6.05], fov: 36, ease: 'surge' },
    { f: 1019, pos: [-14.05, 1.83, -3.55], look: [-15.95, 1.46, -6.05], fov: 34 },
    { f: 1033, pos: [-14.05, 1.83, -3.55], look: [-15.95, 1.46, -6.05], fov: 34 },
  ],
  gentle: [
    { f: 1034, pos: [-14.05, 1.83, -3.55], look: [-15.95, 1.46, -6.05], fov: 34 },
    { f: 1075, pos: [-10.5, 2.1, 0.4], look: [-12.85, 1.05, -2.55], fov: 40, ease: 'surge' },
    { f: 1169, pos: [-9.7, 2.4, 1.3], look: [-14.2, 1.1, -4.2], fov: 43, ease: 'surge' },
    { f: 1188, pos: [-9.8, 2.4, 1.2], look: [-14.3, 1.1, -4.3], fov: 43 },
  ],
  laugh: [
    { f: 1189, pos: [-9.8, 2.4, 1.2], look: [-14.3, 1.1, -4.3], fov: 43 },
    { f: 1210, pos: [-13.4, 2.0, -2.2], look: [-15.95, 1.38, -6.02], fov: 39, ease: 'surge' },
    { f: 1286, pos: [-13.55, 1.98, -2.35], look: [-15.95, 1.4, -6.02], fov: 38 },
    { f: 1333, pos: [-9.7, 2.5, 1.5], look: [-13.8, 1.0, -3.6], fov: 44, ease: 'surge' },
    { f: 1398, pos: [-10.3, 2.1, 0.7], look: [-12.85, 1.0, -2.6], fov: 40, ease: 'surge' },
    { f: 1410, pos: [-10.4, 2.1, 0.6], look: [-12.85, 1.0, -2.6], fov: 40 },
  ],
  died: [
    { f: 1411, pos: [-10.4, 2.1, 0.6], look: [-12.85, 1.0, -2.6], fov: 40 },
    { f: 1462, pos: [-8.4, 3.0, 3.2], look: [-14.5, 1.1, -4.3], fov: 45, ease: 'surge' },
    { f: 1527, pos: [-8.2, 3.1, 3.5], look: [-14.6, 1.1, -4.4], fov: 45 },
  ],
  hook: [
    { f: 1528, pos: [-8.2, 3.1, 3.5], look: [-14.6, 1.1, -4.4], fov: 45 },
    { f: 1580, pos: [-11.3, 2.6, 2.4], look: [-16.8, 1.25, -2.1], fov: 44, ease: 'surge' },
    { f: 1642, pos: [-11.6, 2.5, 2.1], look: [-17.0, 1.2, -2.1], fov: 43 },
    { f: 1672, pos: [-12.6, 2.0, 1.1], look: [-16.7, 0.7, -1.5], fov: 40, ease: 'surge' },
    { f: 1737, pos: [-9.9, 2.1, 1.6], look: [-17.6, 2.6, -3.4], fov: 37, ease: 'surge' },
    { f: 1808, pos: [-9.8, 2.1, 1.7], look: [-17.6, 2.65, -3.4], fov: 36, ease: 'surge' },
  ],
};
export const camAt = (f) => camFromKeys(CAMS[shotAt(f).id], f);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const hp = heroPosAt(f);
  let cinf = 5;
  if (['freeze', 'demand'].includes(S.id)) cinf = 3.6;
  if (S.id === 'hook') cinf = 3.2;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { boardTitle: 0, boardHook: 0, hookSet: 0, sandPour: 0, crownSlip: 0, crownDx: 0 };
  if (S.id === 'order') W.boardTitle = smooth(ramp(f, 6, 20)) * (1 - smooth(ramp(f, 228, 243)));
  if (S.id === 'demand') W.sandPour = smooth(ramp(f, SAND.f0, SAND.f0 + 10)) * (1 - smooth(ramp(f, SAND.f1, SAND.f1 + 14)));
  if (S.id === 'hook') {
    W.hookSet = 1; // the elephant, the boy's stones — tomorrow's teaser set
    W.boardHook = smooth(ramp(f, 1745, 1758));
  }
  // the crown slips as the laugh bursts (f1225-1286) and STAYS askew
  if (f >= 1225) { const k = smooth(ramp(f, 1240, 1272)); W.crownSlip = q(k * 14, 1); W.crownDx = q(k * 7, 1); }
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return { smokeRate: 0.3, dustRate: 0.12, splashRate: 0 };
};

// ---------- actors ----------
const TINT = { court: '#ffdfb0' };
const tintFor = (S, f) => TINT[S.light] || '#ffffff';
// COSTUMES BY ROLE — king: crown + royal red robe, stout; gardener: OLD
// man, worn work clothes, grey hair + grey moustache; courtiers: palace
// dress; boy (hook): bright tunic + cap.
export const OUTFITS = {
  king: { jacket: '#7a1f2e', pants: '#3a2a4a', boots: '#241a12', hat: 'crown', skin: '#e8b08a', moustache: '#d8d0c0', build: 'stout', dress: '#7a1f2e' },
  gardener: { jacket: '#6e6248', pants: '#4f4433', boots: '#33291c', hat: 'hair', hair: '#cfc8bb', skin: '#c98a5a', moustache: '#cfc8bb' },
  courtier: { jacket: '#2e5a8c', pants: '#22344a', boots: '#2e2118', hat: 'cap', cap: '#3a2a4a', skin: '#e8b08a' },
  courtier2: { jacket: '#5d3a6e', pants: '#33243d', boots: '#241a12', hat: 'hair', hair: '#241a12', skin: '#c98a5a' },
  courtier3: { jacket: '#6e4a3a', pants: '#4a3428', boots: '#2e2118', hat: 'cap', cap: '#8a7a5a', skin: '#e8b08a' },
  boy: { jacket: '#b3543a', pants: '#5d4a33', boots: '#3a2a1a', hat: 'cap', cap: '#d8b93c', skin: '#c98a5a' },
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

export const actorsAt = (f, T) => {
  const S = shotAt(f), tint = tintFor(S, f), out = [];
  const st = stand(T, tint, f);
  const W = worldAt(f);
  const king = (expr, extra = {}) => RW(T, OUTFITS.king, { expr, mode: 'stand', blink: blinkAt(f, 41), seed: 41, crownSlip: W.crownSlip, crownDx: W.crownDx, ...extra }, KINGP, { tint, yaw: 0.15 });
  const gardener = (expr, extra = {}) => st(OUTFITS.gardener, expr, 51, GARD, { yaw: -0.35, ...extra });
  switch (S.id) {
    case 'order': {
      out.push(king('stern'));
      // P2 (f133): the gardener agrees in one breath — a quick calm bow
      const bk = bowK(f, 140, 152, 162, 174);
      out.push(RW(T, OUTFITS.gardener, { expr: 'smile_closed', mode: 'stand', blink: blinkAt(f, 51), seed: 51, ...bowOpts(bk) }, BP(GARD, bk), { tint, yaw: -0.35 }));
      out.push(...crowdAt(T, tint, f, 'neutral'));
      break;
    }
    case 'demand': {
      out.push(king('stern'));
      // P6: while the king names the rope of sand, the gardener lifts a
      // handful from his pile and pours it through his fingers (f304-420)
      const pk = q(smooth(ramp(f, 304, 318)) * (1 - smooth(ramp(f, 398, 420))), 2);
      if (pk > 0.02) out.push(RW(T, OUTFITS.gardener, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 51), seed: 51, prop: ['pour', pk] }, GARD, { tint, yaw: -0.15 }));
      else out.push(gardener('nervous'));
      out.push(...crowdAt(T, tint, f, 'neutral'));
      break;
    }
    case 'calm': {
      out.push(king(f >= 649 ? 'stern' : 'neutral'));
      // P10 (f493): the calm bow; P11-12 he speaks, composed
      const bk = bowK(f, 490, 502, 516, 528);
      out.push(RW(T, OUTFITS.gardener, { expr: 'smile_closed', mode: 'stand', blink: blinkAt(f, 51), seed: 51, ...bowOpts(bk) }, BP(GARD, bk), { tint, yaw: -0.35 }));
      out.push(...crowdAt(T, tint, f, f < 480 ? 'nervous' : 'neutral'));
      break;
    }
    case 'pattern': {
      out.push(king('smile')); // the king is still pleased with his trap
      out.push(gardener('smile_closed'));
      out.push(...crowdAt(T, tint, f, 'neutral'));
      break;
    }
    case 'freeze': {
      // P18-20: the smile freezes on the king's face and will not move
      out.push(king('smile_closed', { headTilt: 2 }));
      out.push(gardener('neutral'));
      out.push(...crowdAt(T, tint, f, f >= 959 ? 'nervous' : 'neutral'));
      break;
    }
    case 'gentle': {
      out.push(king('shock'));
      const bk = bowK(f, 1034, 1050, 1160, 1180);
      out.push(RW(T, OUTFITS.gardener, { expr: 'smile_closed', mode: 'stand', blink: blinkAt(f, 51), seed: 51, ...bowOpts(bk * 0.6) }, BP(GARD, bk * 0.6), { tint, yaw: -0.35 }));
      out.push(...crowdAt(T, tint, f, 'nervous'));
      break;
    }
    case 'laugh': {
      // P24 stare (shock), P25 the laugh bursts — head shakes, crown slips;
      // P26-27 grin, crown still askew, while the gold is fetched
      const laughShake = (f >= 1225 && f < 1300) ? q(Math.sin((f - 1225) * 0.55) * 2.4, 1) : 0;
      const kExpr = f < 1225 ? 'shock' : (f < 1300 ? 'laugh' : 'grin');
      out.push(king(kExpr, { headTilt: laughShake }));
      const gbk = bowK(f, 1398, 1410, 2000, 2001);
      out.push(gardener(f >= 1398 ? 'relief' : 'smile_closed', f >= 1398 ? bowOpts(gbk) : {}));
      // the courtier fetches the gold bag (march = foot-locked travel)
      const cp = courtierPosAt(f);
      if (courtierMarchAt(f)) {
        const back = f >= 1430;
        out.push(RW(T, OUTFITS.courtier, { expr: 'neutral', mode: 'march', phase: q(((f - (back ? 1430 : 1342)) * 2.0 / 30 / 1.6) % 1, 3), blink: blinkAt(f, 61), seed: 61 }, cp, { tint, yaw: back ? -2.6 : 0.9 }));
      } else out.push(st(OUTFITS.courtier, 'neutral', 61, cp, { yaw: f >= 1398 ? -0.9 : 0.4 }));
      out.push(...crowdAt(T, tint, f, f >= 1225 ? 'laugh' : 'neutral'));
      break;
    }
    case 'died': {
      out.push(king('grin'));
      out.push(gardener('relief'));
      const cp = courtierPosAt(f);
      if (courtierMarchAt(f)) out.push(RW(T, OUTFITS.courtier, { expr: 'neutral', mode: 'march', phase: q(((f - 1430) * 2.0 / 30 / 1.6) % 1, 3), blink: blinkAt(f, 61), seed: 61 }, cp, { tint, yaw: -2.6 }));
      else out.push(st(OUTFITS.courtier, 'neutral', 61, cp, { yaw: 0.4 }));
      out.push(...crowdAt(T, tint, f, 'neutral'));
      break;
    }
    case 'hook': {
      // tomorrow's teaser: the boy, the elephant, the pile of stones
      out.push(RW(T, OUTFITS.boy, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 81), seed: 81 }, [-16.95, 0, -2.3], { tint, yaw: 0.3, s: 0.74 }));
      break;
    }
  }
  return out;
};
export const fxAt = (f, T) => [];
