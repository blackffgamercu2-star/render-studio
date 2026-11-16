// Shot plan for "The Salted Mine" — salted-mine (LIBRARY v4: materials v4,
// camrig smooth tracking + solid colliders). ONE set: a gold mine — tunnel
// interior (rails, timbers, lanterns) + entrance yard with the LUCKY STAR
// MINE sign. A broke miner "salts" his worthless mine by firing gold dust
// into its walls, sells it to a rich banker after a dynamite blast "reveals"
// a gold vein — and the banker's own expert quietly exposes the trick.
// Voice stem: Abid's own voice (GPT-SoVITS zero-shot tren, x1.25 + EQ),
// 51.449 s, 30 fps, TOTAL 1544; phrase timings from the assembled stem
// (timing.json), word beats from faster-whisper (words.json). Scene changes
// ONLY at phrase boundaries:
//   P1 0.00-4.12 fired into his own wall   P7 26.31-30.44 the blast / vein
//   P2 4.38-8.47 again... glittered        P8 30.70-34.56 paid double
//   P3 8.73-12.24 partner ran to town      P9 34.81-38.95 expert chipped
//   P4 12.49-15.88 banker offered          P10 39.20-44.01 skin deep
//   P5 16.14-20.81 walls sparkled          P11 44.26-47.84 tricksters gone
//   P6 21.07-26.05 one last test           P12 48.10-51.44 never told a soul
// GRADE (FILTER_VFX_LIGHTING pack): Royal Gold inside the mine (warm amber,
// gold the accent), Golden Hour in the yard. Grade changes ONLY on clause
// boundaries. Signature VFX: shotgun gold-dust bursts + wall salt glitter,
// lantern dust motes, dynamite blast (exposure choreography: dim -> flash
// -> recover) + dust, the crack-open gold vein with glints and glow.
import { M, blinkAt, q, clamp, lerp, ramp } from './motion.js';
import { buildRig, pushInCam, staticTrackCam, keysCam } from './camrig.js';
import * as SOL from './solid.js';
import * as T from './toon.js';

export const FPS = 30, TOTAL = 1544, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 130, light: 'mine' },
  { id: 'again', a: 131, b: 261, light: 'mine' },
  { id: 'town', a: 262, b: 374, light: 'day' },
  { id: 'offer', a: 375, b: 483, light: 'day' },
  { id: 'sparkle', a: 484, b: 631, light: 'mine' },
  { id: 'test', a: 632, b: 788, light: 'deep' },
  { id: 'blast', a: 789, b: 920, light: 'deep' },
  { id: 'paid', a: 921, b: 1043, light: 'day' },
  { id: 'chip', a: 1044, b: 1175, light: 'mine' },
  { id: 'skindeep', a: 1176, b: 1327, light: 'mine' },
  { id: 'gone', a: 1328, b: 1442, light: 'day' },
  { id: 'silent', a: 1443, b: 1543, light: 'dusk' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights / mood grades ----------
export const LIGHTS = {
  mine: { az: 205, el: 38, sky: '#7a5636', ground: '#33241a', hemi: 0.78, sun: '#ffb45e', sunI: 1.15, fog: '#2e1d0f', fogNear: 7, fogFar: 62,
    skyTop: '#241a10', skyHor: '#5a3d1e', sunDisc: '#000000', sunSize: 0, sat: 1.07, vig: 0.3, shadowExt: 16, aurora: 0, gain: '#ffd9ae',
    waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
  deep: { az: 205, el: 38, sky: '#5f422a', ground: '#241a10', hemi: 0.68, sun: '#ff9e4e', sunI: 1.1, fog: '#201307', fogNear: 5, fogFar: 44,
    skyTop: '#180f08', skyHor: '#402a14', sunDisc: '#000000', sunSize: 0, sat: 1.05, vig: 0.37, shadowExt: 16, aurora: 0, gain: '#ffc98e',
    waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
  day: { az: 232, el: 30, sky: '#f6dcae', ground: '#8a6f4a', hemi: 1.02, sun: '#ffd9a0', sunI: 2.45, fog: '#e8d3ac', fogNear: 46, fogFar: 330,
    skyTop: '#3a6ab0', skyHor: '#f2cd8e', sunDisc: '#fff0bc', sunSize: 0.0042, sat: 1.09, vig: 0.26, shadowExt: 22, aurora: 0, gain: '#ffedc8',
    waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
  dusk: { az: 250, el: 13, sky: '#c99a72', ground: '#5c4632', hemi: 0.92, sun: '#ffab5e', sunI: 2.0, fog: '#d9b28c', fogNear: 42, fogFar: 300,
    skyTop: '#2e3c6e', skyHor: '#f0a668', sunDisc: '#ffbe78', sunSize: 0.0044, sat: 1.05, vig: 0.3, shadowExt: 22, aurora: 0, gain: '#f2ddba',
    waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
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
  if (S.id === 'blast') {
    // exposure choreography: the scene DIMS as the fuse burns, the blast
    // flashes (camAt flash), then the gold vein light takes over warm.
    const dim = { ...LIGHTS.deep, hemi: 0.34, sunI: 0.4, gain: '#8a6a4a' };
    if (f < 796) return blendLight(LIGHTS.deep, dim, smooth(ramp(f, 786, 796)));
    const gold = { ...LIGHTS.deep, hemi: 0.85, sunI: 1.0, gain: '#ffd9a0', fog: '#33200c' };
    return blendLight(dim, gold, smooth(ramp(f, 800, 836)));
  }
  if (S.id === 'silent') return blendLight(LIGHTS.day, LIGHTS.dusk, smooth(ramp(f, 1443, 1500)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging ----------
export const SIGN_POS = [0, 6.35, 10.45];
export const BOARD_POS = SIGN_POS;
const TABLE = { x: 3.6, z: 13.2 };
const segMax = (f, segs) => {
  let s = 0;
  for (const [a, b, c, d, peak] of segs) if (f >= a && f <= d) s = Math.max(s, peak * (f < b ? smooth(ramp(f, a, b)) : f <= c ? 1 : 1 - smooth(ramp(f, c, d))));
  return s;
};
// gunfire frames (word "fired" f77; "again" f122/f157 land in shot 2)
export const FIRE = [77, 140, 168];
export const BLAST_F = 796;
export const saltAt = (f) => {
  let s = 0;
  const up = (a, b, v) => { if (f >= a) s = Math.max(s, v * smooth(ramp(f, a, b))); };
  up(77, 112, 0.35); up(140, 175, 0.7); up(168, 235, 1);
  return s;
};
export const veinAt = (f) => smooth(ramp(f, BLAST_F + 4, BLAST_F + 58));
export const muzzleAt = (f) => Math.max(...FIRE.map((ff) => (f >= ff && f <= ff + 3 ? 1 - (f - ff) / 4 : 0)), 0);
export const fuseAt = (f) => (f >= 762 && f < BLAST_F ? 1 : 0);
export const sackAt = (f) => {
  // the sacks sit on the yard table during the offer, then travel from the
  // banker's side to the miner's hands on "paid double" (f932)
  const u = smooth(ramp(f, 936, 992));
  return { x: lerp(TABLE.x, 1.35, u), y: lerp(0.98, 1.05, u) + Math.sin(u * Math.PI) * 0.18, z: lerp(TABLE.z, 12.1, u), k: ramp(f, 424, 432) * (1 - ramp(f, 1030, 1042)) };
};
// miner / buddy / banker / expert anchor points per shot (single source)
export const minerAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'hook': return { x: 0.9, z: 1.6 };
    case 'again': return { x: -1.6, z: -1.5 };
    case 'town': return { x: -1.6, z: 9.6 };
    case 'offer': return { x: -1.7, z: 11.6 };
    case 'sparkle': return { x: -1.9, z: -1.2 };
    case 'test': return { x: -1.2, z: -26.4 };
    case 'blast': return { x: -2.1, z: -26.2 };
    case 'paid': return { x: 0.2, z: 11.9 };
    case 'chip': case 'skindeep': return { x: -2.4, z: -28.6 };
    case 'gone': { const u = ramp(f, 1328, 1442); return { x: lerp(-6, -17, u), z: lerp(13, 19, u) }; }
    default: return { x: -3.5, z: 12 };
  }
};
export const buddyAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'hook': return { x: -1.8, z: 2.6 };
    case 'again': return { x: -2.4, z: -6.5 };
    case 'town': { const u = smooth(ramp(f, 268, 330)); return { x: lerp(-0.8, 1.3, u), z: lerp(9.8, 15.6, u) }; }
    case 'offer': return { x: -2.9, z: 12.4 };
    case 'sparkle': return { x: 2.1, z: -2.6 };
    case 'test': return { x: 2.4, z: -24.8 };
    case 'blast': return { x: 2.6, z: -24.6 };
    case 'paid': return { x: 1.6, z: 12.6 };
    case 'gone': { const u = ramp(f, 1328, 1442); return { x: lerp(-4.8, -15.6, u), z: lerp(13.8, 19.8, u) }; }
    default: return { x: 3.4, z: 12 };
  }
};
export const bankerAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'offer': { const u = smooth(ramp(f, 380, 440)); return { x: lerp(2.6, 1.8, u), z: lerp(19.5, 13.8, u) }; }
    case 'sparkle': return { x: 0.2, z: -0.6 };
    case 'test': return { x: 0.4, z: -25.4 };
    case 'blast': return { x: 0.6, z: -27.6 };
    case 'paid': return { x: 2.2, z: 12.9 };
    case 'chip': case 'skindeep': return { x: 2.3, z: -28.2 };
    case 'silent': return { x: 0.4, z: 11.8 };
    default: return { x: 8, z: 20 };
  }
};
export const expertAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'offer': return { x: 3.4, z: 14.6 };
    case 'test': case 'blast': return { x: -0.9, z: -24.6 };
    case 'chip': case 'skindeep': return { x: 0.85, z: -29.6 };
    default: return { x: 9, z: 21 };
  }
};
// the shotgun: in the miner's hands for the salting shots only
export const gunAt = (f) => {
  const S = shotAt(f);
  if (S.id !== 'hook' && S.id !== 'again') return { k: 0, x: 0, y: 0, z: 0 };
  const m = minerAt(f);
  const recoil = Math.max(...FIRE.map((ff) => (f >= ff && f <= ff + 5 ? Math.sin((f - ff) / 5 * Math.PI) * 0.14 : 0)), 0);
  // aimed at the right-hand wall (hook) / alternating walls (again)
  const aim = S.id === 'hook' || f < 154 ? 1.05 : -1.05;
  return { k: 1, x: m.x + 0.28, y: 1.12, z: m.z + 0.3, ry: aim, rx: -0.06, rz: recoil * (aim > 0 ? -1 : 1) };
};

// ---------- hero / focus ----------
const FOCUS = {
  hook: () => { const m = minerAt(60); return [m.x, 1.25, m.z]; },
  again: () => [0.4, 1.4, -1],
  town: () => { const b = buddyAt(320); return [b.x, 1.2, b.z]; },
  offer: () => { const b = bankerAt(430); return [b.x, 1.25, b.z]; },
  sparkle: () => { const b = bankerAt(550); return [b.x, 1.3, b.z]; },
  test: () => [1.2, 0.9, -27],
  blast: () => [0, 2.2, -31],
  paid: () => [1.2, 1.1, 12.3],
  chip: () => { const e = expertAt(1100); return [e.x, 1.35, e.z]; },
  skindeep: () => [0.3, 2.0, -30.8],
  gone: () => [0, 2.6, 10.4],
  silent: () => { const b = bankerAt(1490); return [b.x, 1.35, b.z]; },
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id]();

// ---------- cameras: EVERY shot is a camrig track on a subject ----------
const minerPos = (f) => { const m = minerAt(f); return [m.x, 0, m.z]; };
const buddyPos = (f) => { const b = buddyAt(f); return [b.x, 0, b.z]; };
const bankerPos = (f) => { const b = bankerAt(f); return [b.x, 0, b.z]; };
const expertPos = (f) => { const e = expertAt(f); return [e.x, 0, e.z]; };
const RIG_BY_ID = {
  // hook: low on the tracks under the ceiling lamp, pushing in on the miner
  hook: { cut: 'hard', raw: pushInCam({ subject: minerPos, a: 0, b: 130, d0: 5.4, d1: 4.2, h0: 1.15, h1: 1.3, lookOff: [0, 1.3, 0], fov0: 42, fov1: 36,
    dir: () => [0.25, 0.97] }) },
  // again: POV ride down the tracks into the glittering tunnel
  again: { cut: 'hard', raw: keysCam({ keys: [
    { f: 131, pos: [1.9, 1.75, 5.8], look: [-1.8, 1.35, -2.5], fov: 44 },
    { f: 261, pos: [1.4, 1.6, 0.8], look: [-1.6, 1.4, -6], fov: 40, ease: 'surge' }] }) },
  town: { cut: 'hard', raw: pushInCam({ subject: buddyPos, a: 262, b: 374, d0: 6.4, d1: 4.6, h0: 1.7, h1: 1.5, lookOff: [0, 1.3, 0], fov0: 40, fov1: 35,
    dir: () => [-0.3, 0.95] }) },
  offer: { cut: 'hard', raw: pushInCam({ subject: bankerPos, a: 375, b: 483, d0: 7.2, d1: 4.9, h0: 1.8, h1: 1.55, lookOff: [0, 1.85, 0], fov0: 44, fov1: 36,
    dir: () => [0.25, 0.97] }) },
  sparkle: { cut: 'hard', raw: pushInCam({ subject: bankerPos, a: 484, b: 631, d0: 4.6, d1: 3.4, h0: 1.5, h1: 1.45, lookOff: [0, 1.35, 0], fov0: 38, fov1: 32,
    dir: () => [0.5, 0.86] }) },
  test: { cut: 'hard', raw: keysCam({ keys: [
    { f: 632, pos: [2.4, 1.85, -21.2], look: [-0.6, 1.15, -26.6], fov: 42 },
    { f: 788, pos: [2.0, 1.7, -22.6], look: [-0.5, 1.1, -27.0], fov: 38, ease: 'surge' }] }) },
  blast: { cut: 'hard', raw: keysCam({ keys: [
    { f: 789, pos: [1.2, 1.75, -23.4], look: [0.2, 1.8, -31], fov: 42 },
    { f: 850, pos: [1.1, 1.7, -24.6], look: [0.15, 2.0, -31.4], fov: 39, ease: 'surge' },
    { f: 920, pos: [1.0, 1.65, -25.4], look: [0.2, 1.7, -30.2], fov: 37, ease: 'surge' }] }) },
  paid: { cut: 'hard', raw: staticTrackCam({ pos: [4.6, 2.1, 17.6], subject: () => [1.2, 0, 12.3], lookOff: [0, 1.1, 0], fov: 38 }) },
  chip: { cut: 'hard', raw: pushInCam({ subject: expertPos, a: 1044, b: 1175, d0: 3.9, d1: 2.9, h0: 1.55, h1: 1.5, lookOff: [0, 1.4, 0], fov0: 36, fov1: 30,
    dir: () => [0.55, 0.83] }) },
  skindeep: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1176, pos: [2.8, 1.85, -24.5], look: [1.55, 1.6, -28.9], fov: 37 },
    { f: 1327, pos: [2.55, 1.75, -25.3], look: [1.95, 1.55, -28.8], fov: 33, ease: 'surge' }] }) },
  gone: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1328, pos: [7.6, 3.2, 22.0], look: [0, 3.05, 10.4], fov: 46 },
    { f: 1442, pos: [7.1, 3.15, 21.2], look: [-0.3, 3.0, 10.4], fov: 44, ease: 'surge' }] }) },
  silent: { cut: 'hard', raw: pushInCam({ subject: bankerPos, a: 1443, b: 1543, d0: 5.2, d1: 3.6, h0: 1.7, h1: 1.55, lookOff: [0, 1.35, 0], fov0: 38, fov1: 33,
    dir: () => [0.3, 0.95] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: 77, a: 0.05 }, { f: 140, a: 0.05 }, { f: 168, a: 0.05 }, { f: BLAST_F, a: 0.09 }],
  sigma: 2.3, fovSigma: 1.6,
});
// exposure flash: muzzle pops + the blast (builds ~6f, recovers ~10f)
const flashAt = (f) => {
  let v = 0;
  for (const ff of FIRE) if (f >= ff && f <= ff + 2) v = Math.max(v, 0.22);
  if (f >= BLAST_F - 6 && f < BLAST_F) v = Math.max(v, 0);           // the dim is in lightFor
  if (f >= BLAST_F && f <= BLAST_F + 3) v = Math.max(v, 0.92);
  if (f > BLAST_F + 3 && f <= BLAST_F + 14) v = Math.max(v, 0.92 * (1 - (f - BLAST_F - 3) / 11));
  return v;
};
export const camAt = (f) => ({ ...RIG.camAt(f), flash: flashAt(f) });
export const RIG_META = {
  kicks: RIG.declared.kicks, hardCuts: RIG.declared.hardCuts,
  blends: SHOTS.filter((s) => RIG_BY_ID[s.id].cut === 'blend').map((s) => ({ a: s.a - Math.floor(RIG_BY_ID[s.id].blend / 2), b: s.a + Math.ceil(RIG_BY_ID[s.id].blend / 2) })),
  whips: RIG.declared.whips,
  samples: RIG.samples,
};
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), hp = heroPosAt(f);
  let cinf = 2.4;
  if (['again', 'gone'].includes(S.id)) cinf = 1.4;
  if (['sparkle', 'chip', 'skindeep', 'blast'].includes(S.id)) cinf = 3.6;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f), sk = sackAt(f);
  // blast / spark emitter anchor: gun wall hits, then the deep wall
  let bx = 3.3, by = 1.8, bz = 0.6;
  if (f >= 131 && f < 154) { bx = -3.3; by = 2.0; bz = -3; }
  else if (f >= 154 && f < 632) { bx = 3.3; by = 1.6; bz = -6; }
  if (S.id === 'blast' || S.id === 'test') { bx = 0; by = 2.1; bz = -31; }
  return {
    always: 1,
    signK: S.id === 'offer' ? 1 - smooth(ramp(f, 400, 408)) : 1,
    lampK: S.light === 'day' || S.light === 'dusk' ? 0.25 : 1,
    coneK: S.id === 'hook' ? 1 : S.id === 'again' ? 0.55 : 0,
    veinK: veinAt(f), saltK: saltAt(f), muzzleK: muzzleAt(f), fuseK: fuseAt(f),
    sackX: sk.x, sackY: sk.y, sackZ: sk.z, sackK: sk.k,
    blastX: bx, blastY: by, blastZ: bz,
  };
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  let blast = 0, spark = 0;
  for (const ff of FIRE) if (f >= ff && f <= ff + 16) { blast = Math.max(blast, 0.8); spark = Math.max(spark, 1.4); }
  if (f >= BLAST_F && f <= BLAST_F + 30) { blast = Math.max(blast, 2.6); spark = Math.max(spark, 1.2); }
  return { moteRate: S.light === 'day' || S.light === 'dusk' ? 0.02 : 0.16, blastRate: blast, sparkRate: spark, steamRate: 0, shimmerRate: 0 };
};
export const fxAt = () => [];

// ---------- cast ----------
const TINT = { mine: '#ffe2bc', deep: '#ffd6a3', day: '#ffffff', dusk: '#f2ddc4' };
const tintFor = (S) => TINT[S.light] || '#ffffff';
export const OUTFITS = {
  miner: { jacket: '#b3372a', pants: '#3a3230', boots: '#2a1c10', hat: 'miner', hatCol: '#7a5a30', suspenders: '#c9a15a', skin: '#fbf7ef' },
  buddy: { jacket: '#1f7a6a', pants: '#3a3a42', boots: '#241a12', hat: 'cap', cap: '#f2c230', skin: '#fbf7ef' },
  banker: { jacket: '#c9ccd2', pants: '#3c3a40', boots: '#1c1712', hat: 'tophat', hatCol: '#eceae4', hatBand: '#232028', shirtFront: '#f7f3e8', doubleButtons: true, buttons: '#26221f', bowtie: '#26221f', watch: true, skin: '#fbf7ef', moustache: '#2a201a', bigMoustache: true },
  expert: { jacket: '#5e2a4a', pants: '#33302c', boots: '#1c1712', hat: 'bowler', hatCol: '#211e24', knife: true, skin: '#fbf7ef', moustache: '#2a201a' },
};
// the expert's round glasses, drawn over the face card (card space 600x1000;
// head centre from T.headCenter(seed), eyes ~ +/-46 around cx=300)
const withGlasses = (drawFn) => (p) => {
  drawFn(p);
  const hc = T.headCenter(71);
  p.ell(300 - 47, hc - 6, 31, 31, null, 3.2, 0, 360);
  p.ell(300 + 47, hc - 6, 31, 31, null, 3.2, 0, 360);
  p.band([[300 - 16, hc - 8], [300 + 16, hc - 8]], '#2a2018', 3.2, 1);
};
export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, z, extra = {}) => out.push({ id, x, y: extra.y || 0, z, r: 0.32, ground: 0,
    actor: (T) => ({ key: 'smx' + JSON.stringify(o) + JSON.stringify(opts) + (extra.y || 0), draw: extra.draw || ((p) => T.bodyFront(p, o, opts)), x, y: extra.y || 0, z, ground: 0, tint, ...extra }) });
  const m = minerAt(f), b = buddyAt(f), bk = bankerAt(f), ex = expertAt(f);
  const dance = S.id === 'sparkle' ? Math.abs(Math.sin(f * 0.22)) * 0.05 : 0;
  switch (S.id) {
    case 'hook': {
      std('miner', OUTFITS.miner, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.8] }, m.x, m.z, { yaw: 0.3 });
      std('buddy', OUTFITS.buddy, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, b.x, b.z, { yaw: -0.3 });
      break;
    }
    case 'again': {
      std('miner', OUTFITS.miner, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.8] }, m.x, m.z, { yaw: 0.3 });
      std('buddy', OUTFITS.buddy, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, b.x, b.z, { yaw: -0.3 });
      break;
    }
    case 'town': {
      const running = f >= 268 && f <= 330;
      std('buddy', OUTFITS.buddy, { expr: 'grin', mode: running ? 'march' : 'stand', phase: q((f * 0.014) % 1, 2), blink: blinkAt(f, 41), seed: 41, prop: f > 330 ? ['point', 0.85] : null }, b.x, b.z, { yaw: 0.2 });
      std('miner', OUTFITS.miner, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 31), seed: 31 }, m.x, m.z, { yaw: -0.4 });
      break;
    }
    case 'offer': {
      const walking = f >= 380 && f <= 440;
      std('banker', OUTFITS.banker, { expr: 'smile', mode: walking ? 'march' : 'stand', phase: q((f * 0.011) % 1, 2), blink: blinkAt(f, 51), seed: 51, prop: f >= 445 ? ['coin', 0.6] : null }, bk.x, bk.z, { yaw: -0.25 });
      std('expert', OUTFITS.expert, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 71), seed: 71 }, ex.x, ex.z, { yaw: 0.3, draw: withGlasses((p) => T.bodyFront(p, OUTFITS.expert, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 71), seed: 71 })) });
      std('miner', OUTFITS.miner, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 31), seed: 31 }, m.x, m.z, { yaw: 0.45 });
      std('buddy', OUTFITS.buddy, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, b.x, b.z, { yaw: 0.3 });
      break;
    }
    case 'sparkle': {
      std('banker', OUTFITS.banker, { expr: f < 571 ? 'laugh' : 'grin', mode: 'stand', blink: blinkAt(f, 51), seed: 51, squash: q(Math.sin(f * 0.22) * 0.04, 2) }, bk.x, bk.z, { yaw: 0.15, y: dance });
      std('miner', OUTFITS.miner, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 31), seed: 31 }, m.x, m.z, { yaw: -0.5 });
      std('buddy', OUTFITS.buddy, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, b.x, b.z, { yaw: 0.5 });
      break;
    }
    case 'test': {
      std('miner', OUTFITS.miner, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.7] }, m.x, m.z, { yaw: -0.4 });
      std('banker', OUTFITS.banker, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, bk.x, bk.z, { yaw: 0.35 });
      std('expert', OUTFITS.expert, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 71), seed: 71 }, ex.x, ex.z, { yaw: -0.3, draw: withGlasses((p) => T.bodyFront(p, OUTFITS.expert, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 71), seed: 71 })) });
      std('buddy', OUTFITS.buddy, { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, b.x, b.z, { yaw: 0.4 });
      break;
    }
    case 'blast': {
      const after = f >= BLAST_F;
      std('banker', OUTFITS.banker, { expr: !after ? 'smile' : f < 880 ? 'shock' : 'grin', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, bk.x, bk.z, { yaw: 0.3 });
      std('miner', OUTFITS.miner, { expr: after ? 'smile' : 'stern', mode: 'stand', blink: blinkAt(f, 31), seed: 31 }, m.x, m.z, { yaw: -0.4 });
      std('expert', OUTFITS.expert, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 71), seed: 71 }, ex.x, ex.z, { yaw: -0.3, draw: withGlasses((p) => T.bodyFront(p, OUTFITS.expert, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 71), seed: 71 })) });
      std('buddy', OUTFITS.buddy, { expr: after ? 'grin' : 'nervous', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, b.x, b.z, { yaw: 0.4 });
      break;
    }
    case 'paid': {
      std('banker', OUTFITS.banker, { expr: 'smile_closed', mode: 'stand', blink: blinkAt(f, 51), seed: 51, prop: f >= 930 && f <= 990 ? ['coin', 0.55] : null }, bk.x, bk.z, { yaw: 0.3 });
      std('miner', OUTFITS.miner, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 31), seed: 31 }, m.x, m.z, { yaw: -0.35 });
      std('buddy', OUTFITS.buddy, { expr: 'laugh', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, b.x, b.z, { yaw: -0.2 });
      break;
    }
    case 'chip': {
      const tapping = f >= 1090 && f <= 1145;
      std('expert', OUTFITS.expert, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 71), seed: 71, prop: tapping ? ['carve', q(0.4 + 0.4 * Math.abs(Math.sin(f * 0.5)), 2)] : null, headTilt: f >= 1150 ? 0.1 : 0 }, ex.x, ex.z, { yaw: 0.25, draw: withGlasses((p) => T.bodyFront(p, OUTFITS.expert, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 71), seed: 71, prop: tapping ? ['carve', q(0.4 + 0.4 * Math.abs(Math.sin(f * 0.5)), 2)] : null, headTilt: f >= 1150 ? 0.1 : 0 })) });
      std('banker', OUTFITS.banker, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, bk.x, bk.z, { yaw: 0.4 });
      std('miner', OUTFITS.miner, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 31), seed: 31 }, m.x, m.z, { yaw: -0.4 });
      break;
    }
    case 'skindeep': {
      std('expert', OUTFITS.expert, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 71), seed: 71, prop: ['coin', 0.5] }, ex.x, ex.z, { yaw: 0.25, draw: withGlasses((p) => T.bodyFront(p, OUTFITS.expert, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 71), seed: 71, prop: ['coin', 0.5] })) });
      std('banker', OUTFITS.banker, { expr: f >= 1295 ? 'shock' : 'smile', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, bk.x, bk.z, { yaw: 0.4 });
      std('miner', OUTFITS.miner, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 31), seed: 31 }, m.x, m.z, { yaw: -0.4 });
      break;
    }
    case 'gone': {
      std('miner', OUTFITS.miner, { expr: 'grin', mode: 'march', phase: q((f * 0.012) % 1, 2), blink: blinkAt(f, 31), seed: 31 }, m.x, m.z, { yaw: 0.3, s: 0.92 });
      std('buddy', OUTFITS.buddy, { expr: 'laugh', mode: 'march', phase: q((f * 0.012 + 0.4) % 1, 2), blink: blinkAt(f, 41), seed: 41 }, b.x, b.z, { yaw: 0.3, s: 0.92 });
      break;
    }
    case 'silent': {
      std('banker', OUTFITS.banker, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 51), seed: 51, headTilt: 0.08 }, bk.x, bk.z, { yaw: 0.1 });
      break;
    }
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity ----------
export const STATICS = [
  SOL.aabb(-5.2, -3.4, -32.5, 10, { h: 5.4, id: 'wallL' }),
  SOL.aabb(3.4, 5.2, -32.5, 10, { h: 5.4, id: 'wallR' }),
  SOL.aabb(-5.2, 5.2, -34.2, -32.4, { h: 6, id: 'endwall' }),
  SOL.aabb(-14.8, -3.6, 6.8, 10.6, { h: 12, id: 'faceL' }),
  SOL.aabb(3.6, 14.8, 6.8, 10.6, { h: 12, id: 'faceR' }),
  SOL.circle(0, -5, 1.05, { h: 1.2, id: 'cart' }),
  SOL.circle(2.95, -30.6, 0.55, { h: 0.6, id: 'crate' }),
  SOL.obb(TABLE.x, TABLE.z, 0, 0.85, 0.5, { h: 0.78, id: 'table' }),
  SOL.circle(-4.6, 11.5, 0.5, { h: 1.8, id: 'crates' }),
  SOL.circle(4.8, 11.8, 0.36, { h: 0.95, id: 'barrel' }),
  ...[5, -1, -7, -13, -19, -25].flatMap((fz) => [SOL.circle(-3.2, fz, 0.17, { h: 4.6, id: 'post' }), SOL.circle(3.2, fz, 0.17, { h: 4.6, id: 'post' })]),
];
export const WORLD = SOL.makeWorld(STATICS);
export const dynamicsAt = (f) => {
  const out = [];
  for (const a of castAt(f)) out.push(SOL.circle(a.x, a.z, a.r, { kind: 'dynamic', id: a.id }));
  return out;
};
export const groundItemsAt = (f) => {
  const items = [];
  for (const a of castAt(f)) items.push({ id: a.id, y: a.y, ground: 0, maxHover: 0.06 });
  const sk = sackAt(f);
  if (sk.k > 0.01 && f < 936) items.push({ id: 'sacks', y: sk.y - 0.196, ground: 0.78, maxHover: 0.05 });
  return items;
};
