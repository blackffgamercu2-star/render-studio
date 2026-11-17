// Shot plan for "The Boy Who Counted All the Stars" — stars (LIBRARY v4:
// speak.js dialogue performance + materials v4, camrig smooth tracking +
// solid colliders). Batch 7 topic 5 (EN). ONE set: a palace courtyard at
// night + the palace pond. A barefoot boy bets the king he can count every
// star before dawn; he does not look up — he counts the stars reflected in
// the palace pond, marking each with a pebble. Twist: the sky was too big
// to count, so he counted it where it was small enough to hold — in the
// water. Voice stem: 50.811 s, 30 fps, TOTAL 1524; timings from
// faster-whisper word alignment (words.json, match 0.995). Scene changes
// ONLY at clause boundaries:
//   S1 0.00-4.18  A barefoot boy walked into the court...   S6 31.06-36.84 He counted them one by one...
//   S2 4.64-8.14  "I will count every star..." (dialogue)   S7 37.54-43.50 "The sky was too big..." (dialogue)
//   S3 8.74-16.76 The king laughed... gold coins.           S8 44.18-50.42 But tomorrow, the man who bought the wind...
//   S4 17.22-24.04 The boy did not look up... pond.        (hook board holds to the literal last frame)
//   S5 24.72-30.56 There they were — every star, reflected.
// GRADE (FILTER_VFX_LIGHTING pack): Night Lamp throughout (deep blue
// ambient, warm pools around the court lanterns, moonlight key); the sky
// pales to a dawn blend on "the sky began to pale" (f1076-1105) and holds
// through the payoff, then returns to night for the hook board. Grade
// changes ONLY on clause boundaries. Signature VFX: star reflections
// shimmering on the pond water, soft glints on the water, moving sheen +
// glints on the gold, fireflies/dust drifting in the lamplight.
import { M, blinkAt, q, clamp, lerp, ramp } from './motion.js';
import { buildRig, pushInCam, staticTrackCam, keysCam } from './camrig.js';
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

export const FPS = 30, TOTAL = 1524, DECK = 0;
export const SHOTS = [
  { id: 'drone', a: 0, b: 138, light: 'night' },
  { id: 'bet', a: 139, b: 261, light: 'night' },
  { id: 'gold', a: 262, b: 516, light: 'night' },
  { id: 'pond', a: 517, b: 741, light: 'night' },
  { id: 'stars', a: 742, b: 931, light: 'night' },
  { id: 'count', a: 932, b: 1125, light: 'night' },
  { id: 'payoff', a: 1126, b: 1324, light: 'dawn' },
  { id: 'hookq', a: 1325, b: 1459, light: 'night' },
  { id: 'hook', a: 1460, b: 1523, light: 'night' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights / mood grades ----------
export const LIGHTS = {
  night: { az: 232, el: 38, sky: '#8fa3d8', ground: '#2a3350', hemi: 0.9, sun: '#dfe8ff', sunI: 1.45, fog: '#101736', fogNear: 42, fogFar: 320,
    skyTop: '#070d24', skyHor: '#16224e', sunDisc: '#f6efdc', sunSize: 0.0038, sat: 0.92, vig: 0.32, shadowExt: 22, aurora: 0, gain: '#c9d4f2',
    waterDeep: '#060a18', waterShal: '#0e1a3a', glint: '#dfe9ff' },
  dawn: { az: 250, el: 16, sky: '#e8c9a0', ground: '#6b5a44', hemi: 1.05, sun: '#ffcf96', sunI: 2.1, fog: '#d9a87e', fogNear: 40, fogFar: 300,
    skyTop: '#46588c', skyHor: '#f2b27a', sunDisc: '#ffd9a0', sunSize: 0.0042, sat: 1.02, vig: 0.28, shadowExt: 22, aurora: 0, gain: '#f2ddba',
    waterDeep: '#1d3248', waterShal: '#3a5a74', glint: '#ffe9c0' },
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
// The sky pales on "the sky began to pale" (f1076-1105, end of L6), holds
// through the payoff, and returns to night on the hook clause boundary.
export const paleAt = (f) => {
  if (f < 1076) return 0;
  if (f <= 1105) return smooth(ramp(f, 1076, 1105));
  if (f < 1325) return 1;
  return 1 - smooth(ramp(f, 1325, 1400));
};
export const lightFor = (S, f) => blendLight(LIGHTS.night, LIGHTS.dawn, paleAt(f));

// ---------- staging (shared by story, main, colliders) ----------
export const BOARD_POS = [0, 3.1, -6];
export const PLATFORM = { x: 0, z: 2, r: 1.35, top: 0.18 };   // king's dais: the gold is set out here
export const POND = { x: 0, z: 7.4, rx: 3.0, rz: 1.8 };       // palace pond (water y = 0.06)
export const PEBBLES = [[1.2, 9.13], [1.45, 9.05], [1.7, 8.95], [1.95, 8.83], [2.2, 8.68], [2.45, 8.5],
  [1.35, 9.28], [1.6, 9.18], [1.85, 9.07], [2.1, 8.95], [2.35, 8.8], [1.1, 9.3]];
export const BANK_TOP = 0.08;
const BOY_COURT = [-2.6, 4.8];
const BOY_POND = [0, 9.7];   // stands at the pond's south bank, feet planted, facing the water
const KING_POS = [2.4, 3.6];
const ASTRO1_POS = [4.4, 2.6];
const ASTRO2_POS = [-4.8, 1.2];

// The boy never walks on screen (no walk-glide): he is at court for S1-S3
// and already standing at the pond when S4 cuts in — the walk happens
// between the clause-boundary cuts.
export const boyAt = (f) => (f < 517 ? { x: BOY_COURT[0], z: BOY_COURT[1] } : { x: BOY_POND[0], z: BOY_POND[1] });
export const boyMode = () => 'stand';

// Stars appear in the pond as the boy waits: "first stars to appear"
// (f692-721) — reflections ramp in f692-760 and hold.
export const starAt = (f) => {
  if (f < 692) return 0;
  if (f <= 760) return smooth(ramp(f, 692, 760));
  return 1;
};
export const shimmerAt = (f) => {
  const s = starAt(f);
  return s * (0.55 + 0.45 * Math.sin(f * 0.11));
};
export const glintAt = (f) => {
  let s = 0;
  const pulse = (a, b, peak) => { if (f >= a && f <= b) s = Math.max(s, peak * Math.sin(ramp(f, a, b) * Math.PI)); };
  pulse(692, 800, 0.7); pulse(800, 931, 0.9); pulse(980, 1105, 0.8); pulse(1192, 1324, 0.9);
  return s;
};
// Pebbles: one appears per ~10 frames from f980 ("marking each with a
// pebble", f977-1015) through the count, 12 in a neat row on the bank.
export const pebbleCountAt = (f) => {
  if (f < 980) return 0;
  if (f >= 1105) return 12;
  return Math.min(12, Math.floor((f - 980) / 10) + 1);
};
// Gold: the king sets out a hundred coins on the dais ("set out", f282-290);
// they land with a small settle by f300. The sack travels dais -> boy's
// hands on "taking the gold" (f1192-1240), then rests in his hands.
export const goldPileK = (f) => {
  if (f < 282) return 0;
  if (f <= 300) return smooth(ramp(f, 282, 300));
  if (f >= 1192) return 0;
  return 1;
};
export const sackAt = (f) => {
  const u = smooth(ramp(f, 1192, 1240));
  return {
    x: lerp(0, BOY_POND[0], u), y: lerp(0.5, 1.05, u) + Math.sin(u * Math.PI) * 0.18,
    z: lerp(PLATFORM.z, BOY_POND[1] - 0.35, u), k: ramp(f, 1192, 1200),
  };
};

// ---------- hero / focus ----------
const FOCUS = {
  drone: () => [0, 1.2, 2],
  bet: () => [BOY_COURT[0], 1.3, BOY_COURT[1]],
  gold: () => [0.6, 0.9, 2.4],
  pond: () => [0, 0.6, POND.z],
  stars: () => [0, 0.4, POND.z],
  count: () => [1.8, 0.3, 8.95],
  payoff: () => [BOY_POND[0], 1.4, BOY_POND[1]],
  hookq: () => BOARD_POS, hook: () => BOARD_POS,
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id]();

// ---------- cameras: EVERY shot is a camrig track on a subject ----------
const boyCourtPos = () => [BOY_COURT[0], 0, BOY_COURT[1]];
const boyPondPos = () => [BOY_POND[0], 0, BOY_POND[1]];
const pondPos = () => [POND.x, 0.06, POND.z];
const pebblePos = () => [1.8, 0, 8.95];
const bezierCam = (P, L, a, b, fov0, fov1) => (f) => {
  const u = M.smooth(ramp(f, a, b));
  const w0 = (1 - u) ** 3, w1 = 3 * (1 - u) ** 2 * u, w2 = 3 * (1 - u) * u * u, w3 = u ** 3;
  const mix = (Q) => [0, 1, 2].map((j) => w0 * Q[0][j] + w1 * Q[1][j] + w2 * Q[2][j] + w3 * Q[3][j]);
  return { pos: mix(P), look: mix(L), fov: lerp(fov0, fov1, u), roll: 0 };
};
const RIG_BY_ID = {
  drone: { cut: 'hard', raw: bezierCam(
    [[20, 12, 26], [12, 7, 18], [8, 4.2, 14.5], [6.8, 2.9, 12.8]],
    [[0, 3.0, -6], [0, 2.2, -2], [0, 1.2, 2.5], [0, 1.0, 3.5]], 0, 138, 44, 40) },
  bet: { cut: 'hard', raw: pushInCam({ subject: boyCourtPos, a: 139, b: 261, d0: 5.4, d1: 4.0, h0: 1.55, h1: 1.45, lookOff: [0, 1.35, 0], fov0: 40, fov1: 33,
    dir: () => [0.6, 0.75] }) },
  gold: { cut: 'hard', raw: keysCam({ keys: [
    { f: 262, pos: [6.8, 2.6, 10.4], look: [0.6, 1.0, 2.6], fov: 40 },
    { f: 516, pos: [5.6, 2.2, 9.2], look: [0.4, 0.9, 2.4], fov: 36, ease: 'surge' }] }) },
  pond: { cut: 'hard', raw: pushInCam({ subject: pondPos, a: 517, b: 741, d0: 9.5, d1: 8.0, h0: 2.4, h1: 2.0, lookOff: [0, 0.35, 0], fov0: 44, fov1: 40,
    dir: () => [0.15, 0.98] }) },
  stars: { cut: 'hard', raw: pushInCam({ subject: pondPos, a: 742, b: 931, d0: 7.2, d1: 5.8, h0: 1.9, h1: 1.55, lookOff: [0, 0.5, 0], fov0: 40, fov1: 36,
    dir: () => [0.05, 1.0] }) },
  count: { cut: 'hard', raw: staticTrackCam({ pos: [-3.6, 1.9, 12.4], subject: pebblePos, lookOff: [0, 0.15, 0], fov: 36 }) },
  payoff: { cut: 'hard', raw: pushInCam({ subject: boyPondPos, a: 1126, b: 1324, d0: 4.6, d1: 3.4, h0: 1.55, h1: 1.45, lookOff: [0, 1.4, 0], fov0: 36, fov1: 30,
    dir: () => [0.35, 0.9] }) },
  hookq: { cut: 'blend', blend: 10, raw: keysCam({ keys: [
    { f: 1325, pos: [5.6, 3.1, 7.8], look: [0.1, 2.9, -5.9], fov: 40 },
    { f: 1459, pos: [5.1, 3.2, 7.3], look: [0.05, 3.0, -5.95], fov: 37, ease: 'surge' }] }) },
  hook: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1460, pos: [5.1, 3.2, 7.3], look: [0.05, 3.0, -5.95], fov: 37 },
    { f: 1523, pos: [4.9, 3.25, 7.1], look: [0.02, 3.05, -5.97], fov: 36, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: 760, a: 0.02 }, { f: 1240, a: 0.03 }],
  sigma: 2.3, fovSigma: 1.6,
});
export const camAt = (f) => RIG.camAt(f);
export const RIG_META = {
  kicks: RIG.declared.kicks, hardCuts: RIG.declared.hardCuts,
  blends: SHOTS.filter((s) => RIG_BY_ID[s.id].cut === 'blend').map((s) => ({ a: s.a - Math.floor(RIG_BY_ID[s.id].blend / 2), b: s.a + Math.ceil(RIG_BY_ID[s.id].blend / 2) })),
  whips: RIG.declared.whips,
  samples: RIG.samples,
};
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), hp = heroPosAt(f);
  let cinf = 2.4;
  if (['drone', 'hookq'].includes(S.id)) cinf = 1.4;
  if (['bet', 'payoff', 'stars', 'count'].includes(S.id)) cinf = 3.6;
  if (S.id === 'hook') cinf = 3.0;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f), sk = sackAt(f);
  const W = {
    boardTitle: 0, boardHook: 0,
    starK: starAt(f), shimmerK: shimmerAt(f), glintK: glintAt(f),
    pebbleK: pebbleCountAt(f), goldK: goldPileK(f),
    sackX: sk.x, sackY: sk.y, sackZ: sk.z, sackK: sk.k,
    paleK: paleAt(f), dustK: 0.05,
  };
  if (S.id === 'drone') W.boardTitle = smooth(ramp(f, 24, 38)) * (1 - smooth(ramp(f, 54, 68)));
  if (S.id === 'hookq') W.boardHook = smooth(ramp(f, 1400, 1424));
  if (S.id === 'hook') W.boardHook = 1;   // held at FULL opacity to the literal last frame
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return { smokeRate: 0.05, dustRate: 0.05, splashRate: 0, steamRate: 0, shimmerRate: shimmerAt(f), grey: 0 };
};
export const fxAt = () => [];

// ---------- cast (single source for actors AND colliders) ----------
const TINT = { night: '#c9d4f2', dawn: '#f2ddc4' };
const tintFor = (f) => (paleAt(f) > 0.5 ? TINT.dawn : TINT.night);
export const OUTFITS = {
  boy: { jacket: '#8a7a5e', pants: '#6a5a44', boots: '#b98a5a', hat: 'hair', hair: '#241a10', skin: '#b98a5a' },
  king: { jacket: '#8a2432', pants: '#3a2a4a', boots: '#241a12', hat: 'crown', skin: '#c98a5a' },
  astro1: { jacket: '#3a3a5e', pants: '#2a2a3a', boots: '#1c1712', hat: 'cap', cap: '#d8c08a', skin: '#c98a5a' },
  astro2: { jacket: '#4a3a6e', pants: '#2a2438', boots: '#1c1712', hat: 'hair', hair: '#1c1410', skin: '#8a5a34', moustache: '#241a12' },
  guard: { jacket: '#2c3a4a', pants: '#2c2226', boots: '#1c1712', hat: 'shako', skin: '#a06a3c' },
};
export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(f), out = [];
  const std = (id, o, opts, x, z, extra = {}) => out.push({ id, x, y: 0, z, r: 0.32, ground: 0,
    actor: (T) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x, y: 0, z, ground: 0, tint, ...extra }) });
  const b = boyAt(f);
  const boyBase = { expr: 'smile', mode: 'stand', blink: blinkAt(f, 31), seed: 31 };
  switch (S.id) {
    case 'drone': {
      std('boy', OUTFITS.boy, { ...boyBase, expr: 'neutral' }, b.x, b.z, { yaw: 0.5 });
      std('king', OUTFITS.king, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, KING_POS[0], KING_POS[1], { yaw: -0.5 });
      std('astro1', OUTFITS.astro1, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 51), seed: 51 }, ASTRO1_POS[0], ASTRO1_POS[1], { yaw: -0.3 });
      std('astro2', OUTFITS.astro2, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 52), seed: 52 }, ASTRO2_POS[0], ASTRO2_POS[1], { yaw: 0.4 });
      std('guard1', OUTFITS.guard, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 61), seed: 61 }, -3, -11.5, {});
      std('guard2', OUTFITS.guard, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 62), seed: 62 }, 3, -11.5, {});
      break;
    }
    case 'bet': {
      // Dialogue 1: the boy PERFORMS his line — mouth driven by the stem
      // inside the speak segments, firmly closed in the "he said" pause
      // (f187-204); the king only listens, his mouth never opens.
      std('boy', OUTFITS.boy, { mode: 'stand', blink: blinkAt(f, 31), seed: 31, look: 0.15, ...speakFace('smile', f) }, b.x, b.z, { yaw: 0.5 });
      std('king', OUTFITS.king, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, KING_POS[0], KING_POS[1], { yaw: -0.5 });
      break;
    }
    case 'gold': {
      const laughing = f >= 282 && f < 360;
      std('boy', OUTFITS.boy, { ...boyBase, expr: 'smile' }, b.x, b.z, { yaw: 0.5 });
      std('king', OUTFITS.king, { expr: laughing ? 'laugh' : 'smile', mode: 'stand', blink: blinkAt(f, 41), seed: 41,
        prop: f >= 282 ? ['point', 0.5] : null }, KING_POS[0], KING_POS[1], { yaw: -0.5 });
      // The astronomers shake their heads (f340-460): slow head-tilt sway.
      const shake = (f >= 340 && f <= 460) ? Math.sin(f * 0.22) * 0.09 : 0;
      std('astro1', OUTFITS.astro1, { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 51), seed: 51, headTilt: q(shake, 2) }, ASTRO1_POS[0], ASTRO1_POS[1], { yaw: -0.3 });
      std('astro2', OUTFITS.astro2, { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 52), seed: 52, headTilt: q(-shake, 2) }, ASTRO2_POS[0], ASTRO2_POS[1], { yaw: 0.4 });
      break;
    }
    case 'pond': {
      std('boy', OUTFITS.boy, { ...boyBase, expr: 'neutral', headTilt: 0.1 }, b.x, b.z, { yaw: 0 });
      break;
    }
    case 'stars': {
      std('boy', OUTFITS.boy, { ...boyBase, expr: 'shock', prop: ['point', 0.7] }, b.x, b.z, { yaw: 0 });
      break;
    }
    case 'count': {
      std('boy', OUTFITS.boy, { ...boyBase, expr: 'smile', prop: ['point', 0.8] }, b.x, b.z, { yaw: 0.15 });
      break;
    }
    case 'payoff': {
      // Dialogue 2: the boy performs both quoted halves; his mouth stays
      // closed through "he said, taking the gold" (f1166-1218).
      std('boy', OUTFITS.boy, { mode: 'stand', blink: blinkAt(f, 31), seed: 31, look: 0.15, ...speakFace('smile', f) }, b.x, b.z, { yaw: 0.35 });
      std('king', OUTFITS.king, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, KING_POS[0], KING_POS[1], { yaw: -0.5 });
      break;
    }
    case 'hookq': case 'hook': break;
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity: statics, dynamics, ground (LIBRARY v3 gate data) ----------
export const STATICS = [
  SOL.circle(PLATFORM.x, PLATFORM.z, PLATFORM.r, { h: PLATFORM.top, id: 'platform' }),
  SOL.aabb(-18, 18, -15.5, -13.8, { h: 5, id: 'facade' }),
  SOL.aabb(-17.5, -16, -14, 12, { h: 2.6, id: 'wallW' }),
  SOL.aabb(16, 17.5, -14, 12, { h: 2.6, id: 'wallE' }),
  SOL.obb(POND.x, POND.z, 0, POND.rx, POND.rz, { h: 0.1, id: 'pond' }),
  SOL.circle(BOARD_POS[0] - 2.1, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  SOL.circle(BOARD_POS[0] + 2.1, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  ...[-12, -8, -4, 0, 4, 8, 12].map((x) => SOL.circle(x, -13.2, 0.35, { h: 4.4, id: 'column' })),
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
  // Gold pile rests ON the dais top (0.18) while it is set out.
  if (goldPileK(f) > 0) items.push({ id: 'goldpile', y: PLATFORM.top, ground: PLATFORM.top, maxHover: 0.03 });
  // Every counted pebble rests ON the bank top (0.08) — never floating.
  for (let i = 0; i < pebbleCountAt(f); i++) items.push({ id: `pebble${i}`, y: BANK_TOP, ground: BANK_TOP, maxHover: 0.03 });
  return items;
};
