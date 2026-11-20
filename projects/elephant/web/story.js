// Shot plan for "The Boy Who Weighed an Elephant" — project: elephant.
// Built on the REBUILT KIT (postman-kit) with Abid's three corrections:
//  (1) props are real-part builds in main.js (elephant/boat/balances/ghat),
//  (2) heads genuinely round (headBlob b=0.96a in toon.js/toonbase.js),
//  (3) speaking motion NATURAL — deformAt neutralised, jaw <=0.22,
//      cheek <=+0.06, head nod <=1.4deg on stressed words only.
// Voice: tren stem (voice worker) — TOTAL/BND below are regenerated from
// words.json once the stem lands; 17 shots, one per script line.
// Dialogue (lip-sync) ONLY on L4 (head strongman), L6 (boy), L15 (king).
import { M, blinkAt, q, clamp, lerp, ramp, kf } from './motion.js';
import { buildRig, keysCam } from './camrig.js';
import { poseWindows, gazeTrack, lifeAt, emoTrack, gripAt, gestureAt, stridePh } from './body.js';
import * as SOL from './solid.js';
import * as T from './toon.js';
import * as SPK from './speak.js';
import { SPEAK_DATA } from './speakdata.js';

const SPEAK = SPK.makeSpeakPlayer(SPEAK_DATA);
const CHEEK = { neutral: 0.45, stern: 0.42, determined: 0.5, smile: 0.55, grin: 0.65, laugh: 0.85, shock: 0.22, wonder: 0.32, angry: 0.72, proud: 0.6, smug: 0.62, wink: 0.6, nervous: 0.3, scared: 0.25, sad: 0.35, thinking: 0.45, confused: 0.4, stubborn: 0.5, squint: 0.45, relief: 0.6 };
const faceP2 = (name) => ({ ...T.faceP(name), cheek: CHEEK[name] ?? 0.45 });

export const FPS = 30, TOTAL = 1799, DECK = 0;
export const BND = [0, 97, 183, 290, 421, 524, 639, 736, 823, 947, 1083, 1189, 1279, 1373, 1478, 1583, 1696, 1799];
const IDS = ['l01','l02','l03','l04','l05','l06','l07','l08','l09','l10','l11','l12','l13','l14','l15','l16','l17'];
export const SHOTS = IDS.map((id, i) => ({ id, a: BND[i], b: BND[i + 1] - 1, light: 'night' }));
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
const F = (id) => SHOTS.find((s) => s.id === id);
const B = (id) => F(id).a, E = (id) => F(id).b;

// ---------- lights: kit vivid daylight, copied wholesale ----------
export const LIGHTS = {
  night: { az: 148, el: 57, sky: '#9fd0f7', ground: '#7d8cc9', hemi: 1.12, sun: '#ffdf9e', sunI: 2.65, fog: '#cfe9f9', fogNear: 55, fogFar: 430,
    skyTop: '#1463d8', skyHor: '#bfe6fb', sunDisc: '#fff3c4', sunSize: 0.0055, sat: 1.24, vig: 0.13, shadowExt: 26, aurora: 0, gain: '#fff0cd',
    waterDeep: '#0d4a68', waterShal: '#2fb3c9', glint: '#ffffff' },
  dawn: { az: 128, el: 41, sky: '#a5d6f5', ground: '#8492c9', hemi: 1.06, sun: '#ffd488', sunI: 2.5, fog: '#dff0e2', fogNear: 50, fogFar: 400,
    skyTop: '#1d74dc', skyHor: '#f2eecb', sunDisc: '#ffedb8', sunSize: 0.006, sat: 1.26, vig: 0.14, shadowExt: 26, aurora: 0, gain: '#ffecc4',
    waterDeep: '#12506e', waterShal: '#35b0bd', glint: '#ffffff' },
};
LIGHTS.blaze = { ...LIGHTS.night, sunI: 2.8, sat: 1.30, vig: 0.15, gain: '#ffe9bd', skyHor: '#cdf2f4' };
export const lightFor = (S, f) => {
  if (S.id === 'l16' || S.id === 'l17') { const L = { ...LIGHTS.night }; L.sun = '#ffd9a0'; return L; }
  if (S.id === 'l01' || S.id === 'l11') return { ...LIGHTS.blaze };
  return { ...LIGHTS[S.light] };
};

// ---------- geography (shared with main.js) ----------
export const BOARD_POS = [0, 2.9, 24];
export const WATER_Y = -0.18;
export const BOAT = { x: 1.2, z: 11.5, len: 7.2, wid: 2.6, deckY: 0.42 };
export const BIG_BAL = { x: -4.8, z: 0.2 };
export const SMALL_BAL = { x: 4.8, z: 2.2, tableY: 0.55 };
export const STEP_TOP_Y = 0; // bank level
export const stepYAtZ = (z) => { // ghat steps: z 3.2 (y0) -> 7.5 (y-0.75), 5 steps
  if (z <= 3.2) return 0; if (z >= 7.5) return -0.75;
  return -0.15 * Math.floor((z - 3.2) / 0.86) - 0.075;
};
export const groundAt = (x, z) => z >= 3.2 && z < 7.6 && x > -7 && x < 7 ? stepYAtZ(z) : (z >= 18 && x > 1.2 && x < 4.2 ? 0.15 : 0);

// ---------- boat sink / rock / loads ----------
export const boatSinkAt = (f) => {
  const S = shotAt(f).id;
  const rock = (S === 'l09' || S === 'l10') ? 0.012 * Math.sin(f * 0.22) * Math.exp(-Math.max(0, f - B('l09')) / 160) : 0;
  let sink = 0;
  if (S === 'l07') sink = 0.52 * smooth(ramp(f, B('l07') + 20, E('l07')));
  else if (S === 'l08') sink = 0.52;
  else if (S === 'l09') sink = 0.52 * (1 - smooth(ramp(f, B('l09'), B('l09') + (E('l09') - B('l09')) * 0.75)));
  else if (S === 'l10') sink = 0.52 * smooth(ramp(f, B('l10'), E('l10')));
  else if (['l11','l12','l13','l14','l15'].includes(S)) sink = 0.52;
  else if (S === 'l16') sink = lerp(0.52, 0.16, smooth(ramp(f, B('l16'), E('l16'))));
  else if (S === 'l17') sink = 0.16;
  return sink + rock;
};
export const boatYAt = (f) => -boatSinkAt(f);
export const deckYAt = (f) => BOAT.deckY + boatYAt(f);
export const stoneKAt = (f) => { // stones inside the boat 0..1
  const S = shotAt(f).id;
  if (S === 'l10') return smooth(ramp(f, B('l10'), E('l10')));
  if (['l11','l12','l13','l14','l15'].includes(S)) return 1;
  if (S === 'l16') return 1 - 0.7 * smooth(ramp(f, B('l16'), E('l16')));
  if (S === 'l17') return 0.3;
  return 0;
};
export const markKAt = (f) => f >= B('l08') + Math.round((E('l08') - B('l08')) * 0.45) ? 1 : 0; // painted mid-L8
export const snapKAt = (f) => { const t0 = B('l03') + Math.round((E('l03') - B('l03')) * 0.55); return f < t0 ? 0 : Math.min(1, (f - t0) / 6); };
export const pileKAt = (f) => { // stone pile beside the small balance grows as loads are weighed
  const S = shotAt(f).id;
  if (S === 'l12') return 0.35 * smooth(ramp(f, B('l12'), E('l12')));
  if (S === 'l13') return 0.35 + 0.5 * smooth(ramp(f, B('l13'), E('l13')));
  if (['l14','l15','l16','l17'].includes(S)) return 0.85;
  return 0;
};
export const numIdxAt = (f) => { // counting slate: 0 none, 1/2/3 in L13, 3 after
  const S = shotAt(f).id;
  if (S === 'l13') { const u = ramp(f, B('l13'), E('l13')); return u < 0.36 ? 1 : u < 0.7 ? 2 : 3; }
  if (['l14','l15','l16'].includes(S)) return 3;
  return 0;
};
export const smallTiltAt = (f) => {
  const S = shotAt(f).id;
  if (S === 'l12') return 0.16 * Math.sin(ramp(f, B('l12'), E('l12')) * Math.PI * 3) * (1 - ramp(f, B('l12'), E('l12')) * 0.6) - 0.05;
  if (S === 'l13') return -0.05 + 0.03 * Math.sin(f * 0.1);
  return 0;
};

// ---------- elephant track ----------
export const elephantAt = (f) => {
  const S = shotAt(f).id;
  const idle = { x: -2.0, z: 1.2, y: 0, yaw: 0.5, phase: 0, moving: 0, trunk: 0.25 + 0.08 * Math.sin(f * 0.03) };
  const path = (id, pts) => { // pts: [[x,z,y],...] lerped by shot progress
    const u = ramp(f, B(id), E(id)) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(u)), t = smooth(u - i);
    const x = lerp(pts[i][0], pts[i + 1][0], t), z = lerp(pts[i][1], pts[i + 1][1], t), y = lerp(pts[i][2], pts[i + 1][2], t);
    const dx = pts[i + 1][0] - pts[i][0], dz = pts[i + 1][1] - pts[i][1];
    return { x, z, y, yaw: Math.atan2(dz, dx) - 0, phase: (f - B(id)) / 22, moving: 1, trunk: 0.35 };
  };
  switch (S) {
    case 'l04': case 'l05': case 'l06': return { x: -6.4, z: 0.9, y: 0, yaw: 0.9, phase: 0, moving: 0, trunk: 0.3 + 0.08 * Math.sin(f * 0.03) };
    case 'l07': return path('l07', [[-3.4, 3.4, 0], [-1.2, 5.6, -0.5], [0.4, 8.6, deckYAt(f)], [1.2, 11.3, deckYAt(f)]]);
    case 'l08': return { x: 2.1, z: 12.1, y: deckYAt(f), yaw: -0.9, phase: 0, moving: 0, trunk: 0.55 + 0.1 * Math.sin(f * 0.04) };
    case 'l09': return path('l09', [[1.2, 11.3, deckYAt(f)], [0.4, 8.6, deckYAt(f)], [-1.2, 5.6, -0.5], [-3.2, 3.6, 0]]);
    case 'l10': case 'l11': case 'l12': case 'l13': return { x: -4.6, z: 3.4, y: 0, yaw: 0.9, phase: 0, moving: 0, trunk: 0.3 + 0.08 * Math.sin(f * 0.03) };
    case 'l14': case 'l15': case 'l16': return { x: -3.4, z: 2.4, y: 0, yaw: 0.7, phase: 0, moving: 0, trunk: 0.3 };
    default: return idle;
  }
};
// yaw convention: model forward is +x when yaw=0; group.rotation.y = -yaw in main (three y-up, z toward camera south)
// (main.js converts: rotY = -yaw + PI/2 adjustment documented there)

// ---------- hero / focus ----------
const FOCUS = {
  l01: () => [-0.6, 1.5, 2.2], l02: () => [-0.6, 1.4, 1.6], l03: () => [BIG_BAL.x, 1.7, BIG_BAL.z],
  l04: () => [-0.9, 1.35, 3.3], l05: () => [0.6, 1.3, 4.0], l06: () => [2.8, 0.9, 5.6],
  l07: (f) => { const e = elephantAt(f); return [e.x, 1.4, e.z]; },
  l08: () => [0.9, 0.5, 10.9], l09: (f) => { const e = elephantAt(f); return [e.x, 1.4, e.z]; },
  l10: () => [-0.6, 1.1, 6.4], l11: () => [0.8, WATER_Y + 0.05, 10.2],
  l12: () => [SMALL_BAL.x, 1.1, SMALL_BAL.z], l13: () => [3.9, 1.2, 1.6], l14: () => [0.2, 1.4, 3.6],
  l15: () => [1.7, 1.45, 4.3], l16: () => [0.8, 1.1, 5.2], l17: () => [0.4, 2.7, 24.6],
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id](f);

// ---------- cameras: smooth rig, push-ins only, NO kicks/whips ----------
const K = (id, keys) => ({ id, a: B(id), b: E(id), cut: 'hard', raw: keysCam({ keys: keys.map(([dt, pos, look, fov]) => ({ f: B(id) + dt, pos, look, fov, ...(dt ? { ease: 'io' } : {}) })) }) });
const push = (id, pos0, pos1, look, fov0, fov1) => K(id, [[0, pos0, look, fov0], [13, pos1, look, fov1], [E(id) - B(id), pos1, look, fov1 - 1]]);
const trackEle = (id, dx, dy, dz, fov) => ({ id, a: B(id), b: E(id), cut: 'hard', raw: (f) => { const e = elephantAt(f); return { pos: [e.x + dx, e.y + dy, e.z + dz], look: [e.x, e.y + 1.35, e.z], fov, roll: 0 }; } });
const RIG_SHOTS = [
  push('l01', [-8.6, 3.2, 19.8], [-8.0, 3.0, 18.6], [-0.2, 1.3, 2.4], 46, 42),
  push('l02', [-8.2, 3.6, 18.5], [-7.7, 3.4, 17.6], [0.2, 1.2, 2.0], 45, 42),
  push('l03', [-4.7, 2.3, 14.5], [-4.7, 2.15, 13.8], [BIG_BAL.x, 1.6, 0.4], 44, 40),
  push('l04', [-0.6, 1.6, 12.2], [-0.7, 1.52, 11.5], [-0.75, 1.3, 3.55], 37, 33),
  push('l05', [0, 1.9, -4.6], [0, 1.8, -4.0], [0, 1.15, 4.5], 48, 44),
  push('l06', [1.8, 2.3, 11.8], [1.85, 2.2, 11.4], [1.8, 0.9, 5.2], 40, 36),
  trackEle('l07', -10.0, 2.8, 8.5, 48),
  push('l08', [-3.4, 1.5, 3.6], [-3.1, 1.42, 4.2], [0.5, 0.55, 10.9], 40, 36),
  trackEle('l09', -10.0, 2.8, 8.5, 48),
  { id: 'l10', a: B('l10'), b: E('l10'), cut: 'hard', raw: (f) => { const u = ramp(f, B('l10'), E('l10')); const cx = lerp(-3.4, 1.8, u); return { pos: [cx - 1.2, 1.75, -1.8], look: [cx + 0.6, 1.05, 6.2], fov: 39, roll: 0 }; } },
  push('l11', [4.3, 0.3, 9.2], [4.15, 0.29, 9.35], [0.6, -0.14, 10.2], 38, 35),
  push('l12', [4.8, 1.6, 12.8], [4.8, 1.55, 12.1], [4.75, 1.05, 2.3], 38, 34),
  push('l13', [3.9, 1.7, 10.8], [3.9, 1.62, 10.1], [3.9, 1.12, 1.7], 38, 34),
  push('l14', [10.5, 3.2, 18.5], [9.9, 3.0, 17.7], [0.1, 1.3, 3.4], 43, 39),
  push('l15', [1.9, 1.72, 13.2], [1.8, 1.65, 12.5], [1.5, 1.38, 4.6], 34, 30),
  { id: 'l16', a: B('l16'), b: E('l16'), cut: 'hard', raw: (f) => { const u = ramp(f, B('l16'), E('l16')); const cx = lerp(-2.6, 2.4, u); return { pos: [cx - 0.8, 1.7, -2.0], look: [cx + 0.4, 1.05, 5.4], fov: 39, roll: 0 }; } },
  push('l17', [5.0, 2.9, 40.5], [4.75, 2.75, 39.6], [0.1, 2.8, 24.5], 40, 36),
];
const RIG = buildRig({ total: TOTAL, shots: RIG_SHOTS, kicks: [], sigma: 3.2, smoothRadius: 10, fovSigma: 1.7 });
export const camAt = (f) => RIG.camAt(f);
export const RIG_META = { kicks: RIG.declared.kicks, hardCuts: RIG.declared.hardCuts, blends: [], whips: RIG.declared.whips, samples: RIG.samples };
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), hp = heroPosAt(f);
  let cinf = 2.0;
  if (['l02','l14'].includes(S.id)) cinf = 1.3;
  if (['l04','l06','l15'].includes(S.id)) cinf = 4.3;
  if (['l11','l12','l13'].includes(S.id)) cinf = 3.4;
  if (S.id === 'l17') cinf = 1.8;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = {
    boardHook: 0, intK: 0,
    sink: boatSinkAt(f), stoneK: stoneKAt(f), markK: markKAt(f), snapK: snapKAt(f),
    pileK: pileKAt(f), numIdx: numIdxAt(f), smallTilt: smallTiltAt(f),
    eleX: elephantAt(f).x, eleZ: elephantAt(f).z, eleY: elephantAt(f).y, eleYaw: elephantAt(f).yaw,
    elePhase: elephantAt(f).phase, eleMoving: elephantAt(f).moving, trunk: elephantAt(f).trunk,
    dustK: ['l07','l09','l10','l16'].includes(S.id) ? 0.5 : 0.08,
  };
  if (S.id === 'l17') W.boardHook = f < B('l17') + 20 ? smooth(ramp(f, B('l17') + 2, B('l17') + 20)) : 1;
  return W;
};
export const fxProfileAt = (f) => ({ moteRate: worldAt(f).dustK, sprayRate: 0, smokeRate: 0.02, dustRate: worldAt(f).dustK });
export const fxAt = () => [];

// ---------- cast ----------
export const OUTFITS = {
  king: { jacket: '#7c2233', pants: '#3a2a3a', boots: '#241a12', hat: 'crown', skin: '#ffe2c2' },
  boy: { jacket: '#2f7d8c', pants: '#5a4632', boots: '#4a3220', hat: 'hair', hair: '#241a12', skin: '#ffe2c2', build: 'kid' },
  strong: { jacket: '#b3543a', pants: '#33302c', boots: '#201812', hat: 'turban', turban: '#f3e3bb', skin: '#f5c9a0', build: 'stout', moustache: '#2a201a' },
  strong2: { jacket: '#8c5a2e', pants: '#2c3038', boots: '#1c1712', hat: 'turban', turban: '#e8dcc0', skin: '#ffe2c2', build: 'stout', moustache: '#2a201a' },
  court1: { jacket: '#3f7d4e', pants: '#33302c', boots: '#201812', hat: 'hair', hair: '#1e1714', skin: '#ffe2c2' },
  court2: { jacket: '#7b5ac9', pants: '#2c3038', boots: '#1c1712', hat: 'cap', cap: '#54682c', skin: '#f5c9a0' },
  court3: { jacket: '#c99635', pants: '#33302c', boots: '#201812', hat: 'turban', turban: '#f3e3bb', skin: '#f5c9a0' },
  court4: { jacket: '#4a6a9e', pants: '#2c3038', boots: '#201812', hat: 'hair', hair: '#2b211c', skin: '#ffe2c2' },
};
const basket = (p, withStones = true) => { // woven basket + stones, drawn in card space at the side hand
  p.poly([[352, 596], [452, 596], [438, 692], [366, 692]], '#a07a3e', 4);
  for (let i = 0; i < 4; i++) p.stroke([[356, 620 + i * 18], [448, 616 + i * 18]], 3, '#7a5a28');
  for (let i = 0; i < 3; i++) p.stroke([[378 + i * 24, 598], [382 + i * 22, 690]], 3, '#8a682f');
  if (withStones) { p.ell(382, 592, 26, 15, '#8d8578', 3); p.ell(420, 590, 24, 14, '#7d766a', 3); p.ell(402, 578, 22, 13, '#9a927f', 3); }
};
const sweetPlate = (p) => {
  p.ell(300, 700, 62, 16, '#e8e2d2', 3);
  for (const [x, y, c] of [[272, 688, '#e8a13c'], [300, 682, '#c95a7a'], [328, 688, '#f3e3bb'], [286, 694, '#7db35a'], [314, 695, '#e8a13c']]) p.ell(x, y, 13, 11, c, 2);
};
export const castAt = (f) => {
  const S = shotAt(f), out = [];
  const std = (id, o, opts, x, z, extra = {}) => {
    const L = lifeAt({ seed: opts.seed || 1, shift: 1.1, swayAmp: 0.5 })(f);
    const o2 = { ...opts, breath: opts.breath ?? L.breath, headTilt: q((opts.headTilt || 0) + L.tilt + (opts.speaker ? L.sway * 0.8 : 0), 1) };
    if (!o2.exprP && o2.expr) o2.exprP = faceP2(o2.expr);
    const side = extra.side;
    if (side && o2.expr) o2.expr = ({ determined: 'stern', smug: 'smile', wonder: 'shock', angry: 'stern', sad: 'pained', proud: 'smile', confused: 'nervous', scared: 'nervous', thinking: 'stern', stubborn: 'stern', squint: 'stern', wink: 'smile', relief: 'relief' })[o2.expr] || o2.expr;
    out.push({ id, x, y: extra.y ?? groundAt(x, z), z, r: 0.32, ground: extra.ground ?? groundAt(x, z),
      actor: (T) => ({ key: 'el' + id + JSON.stringify(o) + JSON.stringify(o2) + (extra.y ?? 0), draw: (p) => { if (side) { T.bodySide(p, o, o2); if (extra.basket) basket(p); } else { T.bodyFront(p, o, o2); if (extra.sweets) sweetPlate(p); } }, x, y: extra.y ?? groundAt(x, z), z, ground: extra.ground ?? groundAt(x, z), tint: '#ffffff', s: extra.s ?? 1, ...extra }) });
  };
  const head = (seed, tilt, look, lookY, facing = 0) => ({ headTilt: q(tilt, 1), look: q(look, 2), lookY: q(lookY, 2), facing: q(facing, 2) });
  const speakOpts = (baseExpr, seed) => { const DS = SPEAK.at(f); return { mode: 'stand', speaker: 1, blink: blinkAt(f, seed), seed, look: 0.2, expr: baseExpr, exprP: SPK.applySpeak(faceP2(baseExpr), DS), headTilt: q(DS.nod || 0, 2), clothShade: true }; };
  switch (S.id) {
    case 'l01': {
      std('king', OUTFITS.king, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 41), seed: 41, ...head(41, 1, -0.3, 0) }, 1.9, 3.9, { yaw: -0.25, s: 1.05 });
      std('boy', OUTFITS.boy, { expr: 'wonder', mode: 'stand', blink: blinkAt(f, 61), seed: 61, ...head(61, -1, -0.4, 0.3) }, 2.7, 4.2, { yaw: -0.35, s: 0.72 });
      std('strong', OUTFITS.strong, { expr: 'smug', mode: 'stand', blink: blinkAt(f, 51), seed: 51, ...head(51, 0, 0.3, 0) }, -4.9, 4.9, { yaw: 0.3, s: 1.02 });
      break;
    }
    case 'l02': {
      std('king', OUTFITS.king, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 41), seed: 41, ...head(41, 0, 0.2, 0) }, 2.6, 2.6, { yaw: -0.2, s: 1.05 });
      std('boy', OUTFITS.boy, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 61), seed: 61, ...head(61, 0, -0.3, 0.1) }, 3.8, 3.6, { yaw: -0.3, s: 0.72 });
      std('court1', OUTFITS.court1, { expr: 'wonder', mode: 'stand', blink: blinkAt(f, 52), seed: 52, ...head(52, -1, 0.2, 0.2) }, -0.6, 4.4, { yaw: 0.15 });
      std('court2', OUTFITS.court2, { expr: 'wonder', mode: 'stand', blink: blinkAt(f, 53), seed: 53, ...head(53, -1, -0.2, 0.2) }, 0.6, 4.8, { yaw: -0.1 });
      std('court3', OUTFITS.court3, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 54), seed: 54, ...head(54, 0, 0.3, 0) }, 4.9, 4.2, { yaw: -0.4 });
      std('strong2', OUTFITS.strong2, { expr: 'smug', mode: 'stand', blink: blinkAt(f, 55), seed: 55, ...head(55, 0, -0.3, 0) }, -5.9, 4.0, { yaw: 0.35, s: 1.02 });
      break;
    }
    case 'l03': {
      std('strong', OUTFITS.strong, { expr: 'determined', mode: 'stand', blink: blinkAt(f, 51), seed: 51, prop: ['point', 0.4], ...head(51, 0, -0.3, 0.2) }, -3.1, 2.9, { yaw: 0.3, s: 1.02 });
      std('strong2', OUTFITS.strong2, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 55), seed: 55, ...head(55, -1, 0.3, 0.1) }, -6.4, 2.7, { yaw: -0.3, s: 1.02 });
      std('court1', OUTFITS.court1, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 52), seed: 52, ...head(52, -1, 0, 0.2) }, -3.4, 4.8, { yaw: 0.2 });
      break;
    }
    case 'l04': {
      std('strong', OUTFITS.strong, { ...speakOpts('smug', 51), prop: ['point', 0.55] }, -1.6, 3.3, { yaw: 0.3, s: 1.04 });
      std('boy', OUTFITS.boy, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 61), seed: 61, ...head(61, 0, -0.45, 0) }, 0.2, 3.9, { yaw: -0.5, s: 0.72 });
      break;
    }
    case 'l05': {
      const laughTilt = (seed) => q(-2 + 1.2 * Math.sin(f * 0.5 + seed), 1);
      std('court1', OUTFITS.court1, { expr: 'laugh', mode: 'stand', blink: blinkAt(f, 52), seed: 52, headTilt: laughTilt(52), look: q(0.2, 2), lookY: q(0.05, 2) }, -0.85, 4.5, { yaw: 0.2 });
      std('court2', OUTFITS.court2, { expr: 'laugh', mode: 'stand', blink: blinkAt(f, 53), seed: 53, headTilt: laughTilt(53), look: q(-0.2, 2), lookY: q(0.05, 2) }, 0.05, 4.05, { yaw: -0.15 });
      std('strong', OUTFITS.strong, { expr: 'laugh', mode: 'stand', blink: blinkAt(f, 51), seed: 51, headTilt: laughTilt(51), look: q(0.3, 2), lookY: q(0.05, 2) }, -1.7, 4.2, { yaw: 0.3, s: 1.02 });
      const u5 = ramp(f, B('l05'), E('l05'));
      const bx = lerp(1.2, 2.0, smooth(u5)), bz = lerp(4.0, 5.9, smooth(u5));
      std('boy', OUTFITS.boy, { expr: 'thinking', mode: 'march', phase: q(u5 * 2.2, 2), blink: blinkAt(f, 61), seed: 61, ...head(61, -1, 0.3, -0.2) }, bx, bz, { yaw: 0.5, s: 0.72 });
      break;
    }
    case 'l06': {
      std('boy', OUTFITS.boy, { ...speakOpts('determined', 61) }, 2.4, 5.6, { yaw: -0.15, s: 0.78, y: stepYAtZ(5.6), ground: stepYAtZ(5.6) });
      std('strong', OUTFITS.strong, { expr: 'smug', mode: 'stand', blink: blinkAt(f, 51), seed: 51, ...head(51, 0, 0.4, 0) }, 0.9, 4.5, { yaw: 0.55, s: 1.02 });
      break;
    }
    case 'l07': case 'l09': {
      std('court1', OUTFITS.court1, { expr: 'wonder', mode: 'stand', blink: blinkAt(f, 52), seed: 52, ...head(52, -1, 0, 0.3) }, -4.4, 5.2, { yaw: 0.4 });
      std('boy', OUTFITS.boy, { expr: 'determined', mode: 'stand', blink: blinkAt(f, 61), seed: 61, ...head(61, 0, 0.3, 0.2) }, -3.4, 6.0, { yaw: 0.3, s: 0.72 });
      break;
    }
    case 'l08': {
      std('boy', OUTFITS.boy, { expr: 'determined', mode: 'kneel1', blink: blinkAt(f, 61), seed: 61, prop: ['carve', 0.5], ...head(61, 2, 0, -0.3) }, 0.55, 10.55, { yaw: -0.2, s: 0.72, y: deckYAt(f), ground: deckYAt(f) });
      break;
    }
    case 'l10': {
      for (const [id, off, seed] of [['strong', 0, 51], ['strong2', 0.5, 55]]) {
        const u = (ramp(f, B('l10'), E('l10')) + off) % 1;
        const x = lerp(-3.6, 2.0, u), z = lerp(4.6, 7.6, u);
        std(id, OUTFITS[id], { expr: 'determined', mode: 'march', phase: q(stridePh(0, u * 6.4, 0.8), 2), blink: blinkAt(f, seed), seed, ...head(seed, 1, 0, -0.1) }, x, z, { side: true, basket: true, yaw: 0, s: 1.02, y: z > 3.2 && z < 7.6 ? stepYAtZ(z) : 0, ground: z > 3.2 && z < 7.6 ? stepYAtZ(z) : 0 });
      }
      std('boy', OUTFITS.boy, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 61), seed: 61, prop: ['count', 0.5], ...head(61, -1, 0.2, 0.1) }, 3.4, 6.6, { yaw: -0.3, s: 0.72 });
      break;
    }
    case 'l11': break; // POV insert at the hull — no characters, the mark is the actor
    case 'l12': {
      std('strong', OUTFITS.strong, { expr: 'determined', mode: 'stand', blink: blinkAt(f, 51), seed: 51, prop: ['point', 0.35], ...head(51, 1, -0.3, -0.1) }, 3.6, 3.4, { yaw: 0.35, s: 1.02 });
      std('boy', OUTFITS.boy, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 61), seed: 61, ...head(61, -1, 0.35, 0) }, 5.9, 3.8, { yaw: -0.3, s: 0.72 });
      break;
    }
    case 'l13': {
      std('court3', OUTFITS.court3, { expr: 'wonder', mode: 'stand', blink: blinkAt(f, 54), seed: 54, prop: ['count', 0.6], ...head(54, -1, 0, 0.2) }, 2.9, 3.1, { yaw: 0.25 });
      std('court4', OUTFITS.court4, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 56), seed: 56, ...head(56, -1, -0.3, 0.2) }, 5.2, 3.3, { yaw: -0.25 });
      std('boy', OUTFITS.boy, { expr: 'proud', mode: 'stand', blink: blinkAt(f, 61), seed: 61, ...head(61, -1, 0.2, 0.1) }, 4.0, 4.6, { yaw: 0, s: 0.72 });
      break;
    }
    case 'l14': {
      std('king', OUTFITS.king, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 41), seed: 41, ...head(41, -1, -0.2, 0.05) }, 1.7, 3.9, { yaw: -0.2, s: 1.05 });
      std('boy', OUTFITS.boy, { expr: 'proud', mode: 'stand', blink: blinkAt(f, 61), seed: 61, ...head(61, -1, 0.3, 0.1) }, 3.2, 4.6, { yaw: -0.35, s: 0.72 });
      std('court1', OUTFITS.court1, { expr: 'wonder', mode: 'stand', blink: blinkAt(f, 52), seed: 52, ...head(52, -1, 0, 0.2) }, -0.6, 4.6, { yaw: 0.2 });
      break;
    }
    case 'l15': {
      std('king', OUTFITS.king, { ...speakOpts('smile', 41) }, 1.7, 4.3, { yaw: -0.15, s: 1.06 });
      std('boy', OUTFITS.boy, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 61), seed: 61, ...head(61, 0, -0.35, 0.05) }, 3.1, 5.0, { yaw: -0.4, s: 0.72 });
      std('strong', OUTFITS.strong, { expr: 'sad', mode: 'stand', blink: blinkAt(f, 51), seed: 51, ...head(51, 2, 0.3, -0.1) }, -0.4, 4.8, { yaw: 0.35, s: 1.02 });
      break;
    }
    case 'l16': {
      for (const [id, off, seed] of [['strong', 0, 51], ['strong2', 0.45, 55]]) {
        const u = (ramp(f, B('l16'), E('l16')) + off) % 1;
        const x = lerp(-3.2, 2.6, u), z = lerp(6.8, 4.8, u);
        std(id, OUTFITS[id], { expr: 'sad', mode: 'march', phase: q(stridePh(0, u * 6.4, 0.8), 2), blink: blinkAt(f, seed), seed, ...head(seed, 2, 0, -0.1) }, x, z, { side: true, basket: true, s: 1.02, y: stepYAtZ(z), ground: stepYAtZ(z) });
      }
      std('boy', OUTFITS.boy, { expr: 'smile', mode: 'sit', blink: blinkAt(f, 61), seed: 61, ...head(61, -1, 0.1, 0.05) }, 3.6, 5.4, { yaw: -0.2, s: 0.72, sweets: true, y: stepYAtZ(5.4), ground: stepYAtZ(5.4) });
      break;
    }
    case 'l17': {
      std('boy', OUTFITS.boy, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 61), seed: 61, prop: ['point', 0.78], ...head(61, -2, -0.25, 0.4) }, 2.7, 28.0, { yaw: -0.1, s: 0.72, y: 0.15, ground: 0.15 });
      break;
    }
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity ----------
export const STATICS = [
  SOL.obb(BOARD_POS[0] - 2.1, BOARD_POS[2], 0, 0.09, 0.09, { h: 3.3, id: 'boardpost' }),
  SOL.obb(BOARD_POS[0] + 2.1, BOARD_POS[2], 0, 0.09, 0.09, { h: 3.3, id: 'boardpost' }),
  SOL.circle(BOAT.x, BOAT.z, 3.4, { h: 1.2, id: 'boat' }),
];
export const WORLD = SOL.makeWorld(STATICS);
export const dynamicsAt = (f) => castAt(f).map((a) => SOL.circle(a.x, a.z, a.r, { kind: 'dynamic', id: a.id }));
export const groundItemsAt = (f) => castAt(f).map((a) => ({ id: a.id, y: a.y, ground: a.ground ?? 0, maxHover: 0.06 }));
