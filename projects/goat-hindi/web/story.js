// "वो गड़रिया जिसने एक ही बकरी दो बार बेच दी" — Hindi trick batch 5, topic 2.
// Timed to the Hindi stem (63.81 s, 30 fps, TOTAL 1915) from faster-whisper
// word timings (goat-hindi-voice/timing_merged.json — full pass + 36.5-49.5s
// slice re-pass for the dropped river/confront span). Every shot starts on
// a clause boundary; every camera key lands on the word that names its subject.
// Camera Law: the camera TRACKS the voice-named subject, never freezes.
// PHYSICS: the goat's feet stay ON the ground line at all times; the dye pot
// sits ON the ground (set prop) or IN the shepherd's fist (card prop) — it
// rises WITH the hand, never floats; the rope is a 3D cylinder from the post
// top to the goat's collar (ropeAt) and vanishes the frame the goat is untied;
// the dye washes off ONLY while the washing is spoken (dye 1->0, f1221-1269).
// Clause map (s, from ASR words):
// L1 hook 0.00-4.26 | L2 sale1 4.26-13.66 | L3 night+dye 13.66-26.48 |
// L4 sale2 26.48-37.00 | L5 river 37.00-45.18 | L6 confront 45.18-55.56 |
// L7 hook 55.56-63.54.
// Anchors: sale1-coins 9.00 | tied 10.80 | inside 13.20 | untie 16.20 |
// pot-lift 20.20 | dye 21.40-23.00 | sale2-coins 32.40 | river-lead 38.00 |
// water-on 39.80 | wash-off 41.50-42.30 | white 43.00 | blink 44.60 |
// storm-back 46.00 | punchline 54.20 | hook-goonj 60.40.
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1915, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 127, light: 'day' },
  { id: 'sale1', a: 128, b: 409, light: 'day' },
  { id: 'night', a: 410, b: 794, light: 'night' },
  { id: 'sale2', a: 795, b: 1109, light: 'dawn' },
  { id: 'river', a: 1110, b: 1355, light: 'river' },
  { id: 'confront', a: 1356, b: 1666, light: 'day' },
  { id: 'hookout', a: 1667, b: 1914, light: 'day' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
M.linear = (t) => clamp(t);

// ---------- lights ----------
const WATER = { waterDeep: '#14425e', waterShal: '#2e7ea6', glint: '#bfe3f2' };
export const LIGHTS = {
  day: { az: 125, el: 44, sky: '#bcd2e8', ground: '#5f6a52', hemi: 1.22, sun: '#fff3da', sunI: 2.2, fog: '#cfd8c2', fogNear: 46, fogFar: 380,
    skyTop: '#5f97d6', skyHor: '#eef0da', sunDisc: '#fff6da', sunSize: 0.003, sat: 1.05, vig: 0.18, shadowExt: 18, aurora: 0, gain: '#ffffff', ...WATER },
  dawn: { az: 105, el: 32, sky: '#e8c9a0', ground: '#6a5a40', hemi: 1.18, sun: '#ffd9a0', sunI: 2.3, fog: '#e5cf9e', fogNear: 42, fogFar: 340,
    skyTop: '#7fa0d0', skyHor: '#ffe0b0', sunDisc: '#fff3cf', sunSize: 0.0036, sat: 1.08, vig: 0.22, shadowExt: 18, aurora: 0, gain: '#ffedd6', ...WATER },
  night: { az: 200, el: 52, sky: '#1a2438', ground: '#232c3a', hemi: 0.72, sun: '#a0b8e8', sunI: 1.15, fog: '#141c2c', fogNear: 30, fogFar: 260,
    skyTop: '#0e1a33', skyHor: '#2a3a55', sunDisc: '#e8eefc', sunSize: 0.008, sat: 0.9, vig: 0.3, shadowExt: 18, aurora: 0, gain: '#c8d4e8', ...WATER },
  river: { az: 125, el: 50, sky: '#c2d8ea', ground: '#6a7052', hemi: 1.25, sun: '#fff3da', sunI: 2.3, fog: '#d8e0c8', fogNear: 46, fogFar: 380,
    skyTop: '#4f8fd0', skyHor: '#e8f0d8', sunDisc: '#fff6da', sunSize: 0.003, sat: 1.06, vig: 0.16, shadowExt: 18, aurora: 0, gain: '#ffffff', ...WATER },
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

// ---------- staging ----------
// Market square centre [0,0,0]. Inn facade north z=-3.5, door at x=2.2.
// Tying post at [3.05,0,-1.75] beside the inn door. Dye corner west [-4.6,0,1.2].
// River bank south z≈6.9; water z 7.8..14.
export const SHEP_MKT = [-2.2, 0, 0.6];
export const MERCH_MKT = [1.3, 0, 0.4];
export const GOAT_MKT = [-0.6, 0, 0.9];
export const POST = [3.05, 0, -1.75];
export const POST_TOP = [3.05, 1.45, -1.75];
export const GOAT_POST = [2.35, 0, -1.35];
export const INN_DOOR = [2.2, 0, -3.1];
export const DYE = [-4.6, 0, 1.2];
export const SHEP_DYE = [-3.6, 0, 1.2];
export const POT = [-4.3, 0, 0.6];
export const GOAT_RIVER = [0.4, 0, 6.9];
export const MERCH_RIVER = [1.55, 0, 6.55];
export const BOARD_TITLE = [-3.4, 2.2, -1.2];
export const BOARD_PUNCH = [3.2, 1.6, 1.6];
export const BOARD_HOOK = [4.8, 1.55, 5.4];
export const CROWD_A = [-5.6, 0, 2.6];
export const CROWD_B = [5.4, 0, 2.2];
export const CROWD_C = [-3.4, 0, 4.6];

// ---------- dye state (0 white -> 1 black) ----------
// Dyed f629-693 (21.0-23.1s, "रंग दिया"); washed off f1221-1269 (40.7-42.3s,
// "काला रंग बादलों की तरह उतर गया"). Never changes except while spoken.
export const dyeAt = (f) => {
  if (f < 629) return 0;
  if (f < 693) return smooth(ramp(f, 629, 693));
  if (f < 1221) return 1;
  if (f < 1269) return 1 - smooth(ramp(f, 1221, 1269));
  return 0;
};
// head lowered to drink/wash while the water is spoken
export const headDownAt = (f) => {
  if (f < 1180) return 0;
  if (f < 1230) return smooth(ramp(f, 1180, 1230)) * 0.8;
  if (f < 1290) return 0.8 * (1 - smooth(ramp(f, 1260, 1290)));
  return 0;
};

// ---------- goat position ----------
const goatPosAtInner = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'hook': return GOAT_MKT;
    case 'sale1': {
      if (f < 300) return GOAT_MKT;
      if (f < 353) return lerp3(GOAT_MKT, GOAT_POST, smooth(ramp(f, 300, 353)));
      return GOAT_POST;
    }
    case 'night': {
      if (f < 501) return GOAT_POST;
      if (f < 560) return lerp3(GOAT_POST, DYE, smooth(ramp(f, 501, 560)));
      return DYE;
    }
    case 'sale2': return GOAT_MKT;
    case 'river': {
      if (f < 1170) return lerp3(GOAT_MKT, GOAT_RIVER, smooth(ramp(f, 1110, 1170)));
      return GOAT_RIVER;
    }
    case 'confront': return GOAT_MKT;
    case 'hookout': return GOAT_MKT;
    default: return GOAT_MKT;
  }
};
export const goatPosAt = goatPosAtInner;
// goat step phase while it walks (feet planted by the card's step cycle)
const goatStepAt = (f) => {
  const S = shotAt(f);
  if (S.id === 'sale1' && f >= 300 && f < 353) return q(((f - 300) / 27) % 1, 2);
  if (S.id === 'night' && f >= 501 && f < 560) return q(((f - 501) / 27) % 1, 2);
  if (S.id === 'river' && f >= 1110 && f < 1170) return q(((f - 1110) / 27) % 1, 2);
  return 0;
};
// rope: post top -> goat collar, only while the goat is tied (sale1 f353-409,
// night until the untie word "खोला" ends, f486). Vanishes the frame it is untied.
export const ropeAt = (f, cam) => {
  const S = shotAt(f);
  const tied = (S.id === 'sale1' && f >= 353) || (S.id === 'night' && f < 486);
  if (!tied) return null;
  const gp = goatPosAtInner(f), s = 1.0;
  const rotY = Math.atan2(cam[0] - gp[0], cam[2] - gp[2]);
  const neck = [gp[0] + 0.25 * s * Math.cos(rotY), 0.70 * s, gp[2] - 0.25 * s * Math.sin(rotY)];
  return { a: POST_TOP, b: neck };
};

const heroPosAtInner = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'hook': return f < 105 ? goatPosAtInner(f) : [BOARD_TITLE[0], BOARD_TITLE[1], BOARD_TITLE[2]];
    case 'sale1': return f < 270 ? goatPosAtInner(f) : f < 300 ? [0.2, 0.7, -0.4] : f < 360 ? GOAT_POST : INN_DOOR;
    case 'night': return f < 560 ? GOAT_POST : f < 630 ? DYE : [-4.3, 0.5, 0.6];
    case 'sale2': return f < 990 ? goatPosAtInner(f) : f < 1050 ? [0.2, 0.7, -0.4] : MERCH_MKT;
    case 'river': return GOAT_RIVER;
    case 'confront': return f < 1500 ? MERCH_MKT : f < 1610 ? SHEP_MKT : [BOARD_PUNCH[0], BOARD_PUNCH[1], BOARD_PUNCH[2]];
    case 'hookout': return f < 1830 ? SHEP_MKT : [BOARD_HOOK[0], BOARD_HOOK[1], BOARD_HOOK[2]];
    default: return [0, 1, 0];
  }
};
export const heroPosAt = heroPosAtInner;

// ---------- cameras ----------
const CAMS = {
  hook: [
    { f: 0, pos: [3.4, 2.3, 5.6], look: [-1.7, 1.0, 0.8], fov: 45 },
    { f: 40, pos: [2.6, 2.1, 4.8], look: [-1.7, 1.0, 0.8], fov: 42, ease: 'surge' },
    { f: 80, pos: [2.0, 2.0, 4.0], look: [-2.2, 1.2, 0.2], fov: 40, ease: 'surge' },
    { f: 105, pos: [2.4, 2.3, 4.6], look: [-2.8, 1.5, -0.6], fov: 46, ease: 'surge' },
    { f: 127, pos: [2.4, 2.3, 4.6], look: [-2.8, 1.5, -0.6], fov: 46 },
  ],
  sale1: [
    { f: 128, pos: [2.4, 2.3, 4.6], look: [-2.8, 1.5, -0.6], fov: 46 },
    { f: 175, pos: [2.6, 2.1, 3.4], look: [-0.6, 1.0, 0.9], fov: 41, ease: 'surge' },
    { f: 270, pos: [3.4, 2.2, 4.4], look: [0.0, 0.9, -0.2], fov: 40, ease: 'surge' },
    { f: 300, pos: [2.4, 2.0, 2.2], look: [2.6, 1.0, -1.6], fov: 40, ease: 'surge' },
    { f: 360, pos: [4.0, 2.3, 2.6], look: [2.5, 1.0, -1.8], fov: 42, ease: 'surge' },
    { f: 409, pos: [3.9, 2.25, 2.5], look: [2.5, 1.0, -1.8], fov: 42 },
  ],
  night: [
    { f: 410, pos: [3.9, 2.25, 2.5], look: [2.5, 1.0, -1.8], fov: 42 },
    { f: 470, pos: [5.4, 2.4, 3.6], look: [2.6, 0.9, -1.3], fov: 42, ease: 'surge' },
    { f: 560, pos: [-1.8, 2.2, 4.6], look: [-4.1, 1.0, 1.2], fov: 42, ease: 'surge' },
    { f: 630, pos: [-1.6, 2.1, 4.6], look: [-4.0, 0.9, 1.2], fov: 38, ease: 'surge' },
    { f: 700, pos: [-1.4, 2.15, 4.7], look: [-4.0, 1.0, 1.2], fov: 39, ease: 'surge' },
    { f: 794, pos: [-1.4, 2.15, 4.7], look: [-4.0, 1.0, 1.2], fov: 39 },
  ],
  sale2: [
    { f: 795, pos: [4.8, 2.6, 5.6], look: [-1.0, 1.1, 0.6], fov: 44 },
    { f: 850, pos: [3.2, 2.2, 3.8], look: [-1.3, 1.0, 0.9], fov: 41, ease: 'surge' },
    { f: 900, pos: [4.4, 2.6, 5.6], look: [0.0, 1.0, 0.65], fov: 43, ease: 'surge' },
    { f: 990, pos: [2.6, 2.1, 3.6], look: [0.8, 1.0, 0.0], fov: 39, ease: 'surge' },
    { f: 1050, pos: [2.8, 2.1, 3.2], look: [1.2, 1.1, 0.4], fov: 40, ease: 'surge' },
    { f: 1109, pos: [2.7, 2.05, 3.1], look: [1.2, 1.1, 0.4], fov: 40 },
  ],
  river: [
    { f: 1110, pos: [5.6, 2.9, 7.6], look: [-0.4, 1.0, 1.2], fov: 46 },
    { f: 1140, pos: [4.2, 2.4, 8.6], look: [0.1, 1.0, 4.6], fov: 42, ease: 'surge' },
    { f: 1170, pos: [0.6, 2.6, 1.6], look: [0.9, 1.0, 7.0], fov: 44, ease: 'surge' },
    { f: 1230, pos: [0.9, 2.2, 2.2], look: [0.8, 0.9, 7.0], fov: 41, ease: 'surge' },
    { f: 1300, pos: [0.7, 2.2, 2.4], look: [0.8, 0.9, 7.0], fov: 41, ease: 'surge' },
    { f: 1355, pos: [0.8, 2.15, 2.3], look: [0.8, 0.9, 7.0], fov: 41 },
  ],
  confront: [
    { f: 1356, pos: [4.4, 2.4, 5.2], look: [0.0, 1.1, 0.6], fov: 43 },
    { f: 1420, pos: [3.4, 2.1, 3.6], look: [1.0, 1.1, 0.5], fov: 40, ease: 'surge' },
    { f: 1500, pos: [2.6, 2.0, 3.0], look: [-2.0, 1.0, 0.7], fov: 39, ease: 'surge' },
    { f: 1610, pos: [3.6, 2.5, 8.3], look: [3.0, 1.4, 1.6], fov: 48, ease: 'surge' },
    { f: 1666, pos: [3.8, 2.55, 8.5], look: [3.0, 1.4, 1.6], fov: 48 },
  ],
  hookout: [
    { f: 1667, pos: [3.6, 2.4, 7.0], look: [2.55, 1.4, 1.6], fov: 44 },
    { f: 1750, pos: [4.2, 2.3, 7.6], look: [1.0, 1.1, 0.8], fov: 42, ease: 'surge' },
    { f: 1830, pos: [4.6, 2.3, 12.8], look: [4.8, 1.5, 5.4], fov: 48, ease: 'surge' },
    { f: 1914, pos: [4.7, 2.3, 13.2], look: [4.8, 1.5, 5.4], fov: 48 },
  ],
};
export const camAt = (f) => camFromKeys(CAMS[shotAt(f).id], f);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), hp = heroPosAtInner(f);
  let cinf = 5;
  if (S.id === 'river' || S.id === 'night') cinf = 4;
  if (S.id === 'hookout') cinf = 4;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { boardTitle: 0, boardPunch: 0, boardHook: 0, goldK: 0, dyePot: 0 };
  if (S.id === 'hook') W.boardTitle = smooth(ramp(f, 90, 115));
  // the dye pot rests ON the ground at the dye corner until the shepherd
  // lifts it (f580) and again after he sets it back down (f720)
  if (S.id === 'night') W.dyePot = f < 580 ? 1 : f < 720 ? 0 : 1;
  if (S.id === 'sale1' && f >= 270 && f <= 330) W.goldK = 1;
  if (S.id === 'sale2' && f >= 990 && f <= 1050) W.goldK = 1;
  if (S.id === 'confront') W.boardPunch = smooth(ramp(f, 1610, 1640)); // holds to the last frame of the shot
  if (S.id === 'hookout') W.boardHook = smooth(ramp(f, 1820, 1860)); // holds to the FINAL frame — no fade-out
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return { smokeRate: S.id === 'night' ? 0.1 : 0.22, dustRate: S.id === 'river' ? 0.3 : S.id === 'hook' || S.id === 'sale1' || S.id === 'sale2' ? 0.25 : 0.08 };
};

// ---------- actors ----------
const TINT = { day: '#ffffff', dawn: '#ffd9a3', night: '#b8c8e8', river: '#ffffff' };
const tintFor = (S, f) => TINT[S.light] || '#ffffff';
export const OUTFITS = {
  // गड़रिया: simple worn clothes, turban, moustache
  shepherd: { jacket: '#7a6a42', pants: '#4a3a26', boots: '#33261a', hat: 'turban', turban: '#8a6d3b', skin: '#b57a4e', moustache: '#3a2c1c' },
  // व्यापारी: rich crimson + gold turban
  merchant: { jacket: '#7a2a3a', pants: '#3a2a4a', boots: '#241a12', hat: 'turban', turban: '#e8b93c', skin: '#e8b08a', moustache: '#2a2018', dress: '#7a2a3a' },
  crowd1: { jacket: '#7a6a4a', pants: '#4c4234', boots: '#33261a', hat: 'hair', hair: '#2a2018', skin: '#c98a5a' },
  crowd2: { jacket: '#54683e', pants: '#3c4630', boots: '#2e2418', hat: 'cap', cap: '#6e4a3a', skin: '#b57a4e' },
  crowd3: { jacket: '#8a5a30', pants: '#54432c', boots: '#33261a', hat: 'hair', hair: '#1e160f', skin: '#d9a878' },
};
const drawFigure = (T, o, opts) => (p) => { T.bodyFront(p, o, opts); };
const A = (T, o, opts, pos, extra = {}) => ({
  key: (extra.tag || 'fig') + JSON.stringify(o) + JSON.stringify(opts),
  draw: drawFigure(T, o, opts),
  x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], ...extra.out,
});
const idleTilt = (f, seed) => q(1.5 * Math.sin(f * 0.037 + seed * 1.3), 1);
const fig = (T, tint, f) => (o, expr, seed, pos, opts = {}, out = {}) => A(T, o, { expr, mode: 'stand', blink: blinkAt(f, seed), seed, headTilt: idleTilt(f, seed), ...opts }, pos, { tag: 'f' + seed, out: { tint, ...out } });
const marchPhase = (f, f0) => q(((f - f0) / 27) % 1, 2);
// the goat: a card drawn by T.goatCard, feet ON the ground line (y=0)
const goatA = (T, tint, f, extra = {}) => {
  const gp = goatPosAtInner(f);
  const opts = { dye: q(dyeAt(f), 2), blink: blinkAt(f, 77), headDown: q(headDownAt(f), 2), step: goatStepAt(f), tail: q((f / 30) % 1, 2) };
  return {
    key: 'goat' + JSON.stringify(opts),
    draw: (p) => T.goatCard(p, opts),
    x: gp[0], y: 0, z: gp[2], ground: 0, s: 1.0, ...extra.out,
  };
};
export const actorsAt = (f, T) => {
  const S = shotAt(f), tint = tintFor(S, f), out = [];
  const st = fig(T, tint, f);
  const crowd = () => {
    out.push(st(OUTFITS.crowd1, 'smile', 81, CROWD_A, {}, { yaw: 0.3 }));
    out.push(st(OUTFITS.crowd2, 'smile', 82, CROWD_B, {}, { yaw: -0.3 }));
    out.push(st(OUTFITS.crowd3, 'neutral', 83, CROWD_C, {}, { yaw: 0.2 }));
  };
  switch (S.id) {
    case 'hook': {
      // shepherd presents his white goat in the market; title board rises
      out.push(st(OUTFITS.shepherd, 'smile', 11, SHEP_MKT, { wave: f >= 60 && f < 100 ? q(0.45 + 0.25 * Math.sin(f * 0.25), 2) : undefined }, { yaw: 0.3 }));
      out.push(goatA(T, tint, f));
      crowd();
      break;
    }
    case 'sale1': {
      // merchant examines the goat, pays 50 coins (pouch into the
      // shepherd's hand at f275), leads the goat to the post, ties it,
      // then walks inside the inn, proud of his bargain.
      const paying = f >= 275 && f <= 330;
      const leading = f >= 300 && f < 353;
      const merchPos = leading ? lerp3(MERCH_MKT, [2.9, 0, -1.2], smooth(ramp(f, 300, 353)))
        : f >= 353 ? (f < 395 ? lerp3([2.9, 0, -1.2], INN_DOOR, smooth(ramp(f, 360, 395))) : INN_DOOR) : MERCH_MKT;
      const merchMode = leading || (f >= 353 && f < 395) ? 'march' : 'stand';
      out.push(A(T, OUTFITS.merchant, { expr: f >= 353 ? 'grin' : f < 270 ? 'neutral' : 'smile', mode: merchMode, phase: merchMode === 'march' ? marchPhase(f, leading ? 300 : 360) : undefined, blink: blinkAt(f, 21), seed: 21, headTilt: f >= 175 && f < 270 ? q(4, 1) : idleTilt(f, 21), wave: paying ? q(0.5 + 0.25 * Math.sin(f * 0.25), 2) : undefined }, merchPos, { tag: 'merch', out: { tint, yaw: leading || f >= 353 ? -0.5 : -0.2 } }));
      out.push(A(T, OUTFITS.shepherd, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 11), seed: 11, headTilt: idleTilt(f, 11), prop: paying ? ['pouch', q(clamp((f - 275) / 22), 2)] : undefined }, SHEP_MKT, { tag: 'shep', out: { tint, yaw: 0.3 } }));
      out.push(goatA(T, tint, f));
      crowd();
      break;
    }
    case 'night': {
      // the shepherd creeps in from the east, unties the goat (rope gone
      // at f486), leads it to the dye corner, lifts the pot (f580-610),
      // pours the dye (f629-693) — the white goat turns black.
      const sneaking = f >= 410 && f < 470;
      const leading = f >= 501 && f < 560;
      const shepPos = sneaking ? lerp3([4.6, 0, 1.8], [2.7, 0, -2.3], smooth(ramp(f, 410, 470)))
        : leading ? lerp3([2.7, 0, -2.3], SHEP_DYE, smooth(ramp(f, 501, 560)))
        : f < 410 ? [4.6, 0, 1.8] : f < 501 ? [2.7, 0, -2.3] : SHEP_DYE;
      const shepMode = sneaking || leading ? 'march' : 'stand';
      const potLift = f >= 580 && f < 720;
      const pouring = f >= 629 && f < 693;
      out.push(A(T, OUTFITS.shepherd, { expr: pouring ? 'grin' : 'neutral', mode: shepMode, phase: shepMode === 'march' ? marchPhase(f, sneaking ? 410 : 501) : undefined, blink: blinkAt(f, 11), seed: 11, headTilt: pouring ? q(-4, 1) : idleTilt(f, 11), wave: pouring ? q(0.5 + 0.3 * Math.sin(f * 0.3), 2) : undefined, prop: potLift ? ['dyepot', q(clamp((f - 580) / 25), 2)] : undefined }, shepPos, { tag: 'shep', out: { tint, yaw: leading || potLift ? 0.5 : -0.4 } }));
      out.push(goatA(T, tint, f));
      break;
    }
    case 'sale2': {
      // morning market: the SAME merchant sees the "black goat", loves it,
      // pays 50 coins again.
      const paying = f >= 995 && f <= 1050;
      out.push(A(T, OUTFITS.merchant, { expr: f >= 1050 ? 'grin' : f < 990 ? 'neutral' : 'smile', mode: 'stand', blink: blinkAt(f, 21), seed: 21, headTilt: f >= 850 && f < 990 ? q(4, 1) : idleTilt(f, 21), wave: paying ? q(0.5 + 0.25 * Math.sin(f * 0.25), 2) : undefined }, MERCH_MKT, { tag: 'merch', out: { tint, yaw: -0.2 } }));
      out.push(A(T, OUTFITS.shepherd, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 11), seed: 11, headTilt: idleTilt(f, 11), prop: paying ? ['pouch', q(clamp((f - 995) / 22), 2)] : undefined }, SHEP_MKT, { tag: 'shep', out: { tint, yaw: 0.3 } }));
      out.push(goatA(T, tint, f));
      crowd();
      break;
    }
    case 'river': {
      // the merchant leads the goat down to the river and washes it; the
      // black comes off in clouds exactly while the washing is spoken.
      const leading = f < 1170;
      const merchPos = leading ? lerp3(MERCH_MKT, MERCH_RIVER, smooth(ramp(f, 1110, 1170))) : MERCH_RIVER;
      const washing = f >= 1180 && f < 1290;
      out.push(A(T, OUTFITS.merchant, { expr: washing ? 'neutral' : 'smile', mode: leading ? 'march' : 'stand', phase: leading ? marchPhase(f, 1110) : undefined, blink: blinkAt(f, 21), seed: 21, headTilt: washing ? q(9, 1) : idleTilt(f, 21), wave: washing ? q(0.5 + 0.3 * Math.sin(f * 0.28), 2) : undefined }, merchPos, { tag: 'merch', out: { tint, yaw: -0.5 } }));
      // river goat faces the merchant (east): from the north cameras the
      // billboard alone would point its head west, off-frame — flip it.
      out.push(goatA(T, tint, f, { out: { yaw: Math.PI } }));
      break;
    }
    case 'confront': {
      // the merchant storms back, shouting for his money; the shepherd
      // only smiles — punchline board rises at f1610.
      const angry = f >= 1356 && f < 1500;
      out.push(A(T, OUTFITS.merchant, { expr: angry ? 'stern' : 'shock', mode: 'stand', blink: blinkAt(f, 21), seed: 21, headTilt: angry ? q(-5, 1) : q(3, 1), wave: angry ? q(0.55 + 0.3 * Math.sin(f * 0.3), 2) : undefined }, MERCH_MKT, { tag: 'merch', out: { tint, yaw: 0.35 } }));
      out.push(A(T, OUTFITS.shepherd, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 11), seed: 11, headTilt: q(-3, 1) }, SHEP_MKT, { tag: 'shep', out: { tint, yaw: -0.3 } }));
      out.push(goatA(T, tint, f));
      crowd();
      break;
    }
    case 'hookout': {
      // the shepherd and his (white again) goat; the hook board holds to
      // the final frame.
      out.push(st(OUTFITS.shepherd, 'smile', 11, SHEP_MKT, { wave: f >= 1700 && f < 1780 ? q(0.45 + 0.25 * Math.sin(f * 0.25), 2) : undefined }, { yaw: 0.3 }));
      out.push(goatA(T, tint, f));
      crowd();
      break;
    }
  }
  return out;
};
export const fxAt = (f, T) => {
  const out = [];
  const burst = (key, x, y, z, t, col = '#ffe066', sc = 1) => out.push({ key, draw: (p) => T.fxBurst(p, t, col, 9, 26, 140), x, y, z, blob: false, shadow: false, s: sc });
  const splash = (key, x, y, z, t, sc = 1) => out.push({ key, draw: (p) => T.fxSplash(p, t), x, y, z, blob: false, shadow: false, s: sc });
  // coin glint at the payment table
  if (f >= 270 && f <= 286) burst('coins1_' + q((f - 270) / 16, 2), 0.2, 0.85, -0.4, q((f - 270) / 16, 2));
  if (f >= 995 && f <= 1011) burst('coins2_' + q((f - 995) / 16, 2), 0.2, 0.85, -0.4, q((f - 995) / 16, 2));
  // black dye drips while the shepherd pours (f629-693)
  if (f >= 629 && f <= 693) burst('dye_' + q((f - 629) / 16, 2), -4.6, -0.8, 1.2, q((f - 629) / 16, 2), '#1e1a16', 0.6);
  // river wash: white splash + black clouds coming off (f1180-1280)
  if (f >= 1180 && f <= 1212) burst('wash1_' + q((f - 1180) / 16, 2), 0.4, -1.1, 6.9, q((f - 1180) / 16, 2), '#6cc0f0', 0.4);
  if (f >= 1221 && f <= 1269) burst('washoff_' + q((f - 1221) / 16, 2), 0.4, -1.05, 6.9, q((f - 1221) / 16, 2), '#2a2521', 0.45);
  if (f >= 1240 && f <= 1272) burst('wash2_' + q((f - 1240) / 16, 2), 0.4, -1.1, 6.9, q((f - 1240) / 16, 2), '#6cc0f0', 0.4);
  // the merchant's angry shout
  if (f >= 1360 && f <= 1376) burst('shout_' + q((f - 1360) / 16, 2), 1.3, 0.6, 0.4, q((f - 1360) / 16, 2), '#ffe066', 0.7);
  return out;
};
