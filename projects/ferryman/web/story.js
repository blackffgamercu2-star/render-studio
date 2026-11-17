// Shot plan for "The Ferryman Who Rowed Without Oars" — ferryman (LIBRARY v4:
// speak.js dialogue performance + materials v4, camrig smooth tracking +
// solid colliders). Batch 8 E1 (Mirror Trick Tales). ONE set: a river landing
// — stone quay (near bank), the wide river beyond, a far bank with huts.
// A ferryman crosses forty times a day and never touches an oar: his boat
// hangs from a sunken iron cable and the current pushes it across for free.
// Voice stem: 56.731 s, 30 fps, TOTAL 1702; timings from faster-whisper
// base.en word alignment (words.json / timing.json). Scene changes ONLY at
// clause (script-line) boundaries:
//   L1  drone     This ferryman crossed the widest river... forty times a day.
//   L2  secret    His passengers gladly paid double, just to wonder.
//   L3  rowers    Other boatmen rowed until their arms shook (mill-race current).
//   L4  cargo     His boat crossed in four calm minutes, loaded (grain, goats, wedding).
//   L5  rudder    All the way across, the ferryman only stood at the stern, hand on rudder.
//   L6  merchant  A rich merchant offered a bag of gold to reveal the trick.
//   L7  laugh     The ferryman laughed, stamped his foot, pointed down at the dark water.
//   L8  dialogue  "The river does the rowing, sir. I just hold the rope."
//   L9  cable     Under the boat ran a thick iron cable, sunk deep, tied to both banks.
//   L10 kite      The boat hung from that cable, angled like a kite against the wind.
//   L11 push      The rushing water pushed the whole boat sideways across, for free.
//   L12 hookq/hook  But tomorrow… an inn where nobody ever paid. How did it survive?
// GRADE (FILTER_VFX_LIGHTING pack): Sea Glass throughout; the hook beat
// warms toward dusk INSIDE the same sea family — grade changes ONLY on
// clause boundaries. Signature VFX: river current streaks, dipping oars,
// bow spray + wake on the crossing, cable glint in the reveal.
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

export const FPS = 30, TOTAL = 1702, DECK = 0;
// Shot boundaries (frames) — snapped to timing.json phrase starts.
// [drone, secret, rowers, cargo, rudder, merchant, laugh, dialogue, cable, kite, push, hookq, hook]
export const BND = [0, 153, 269, 405, 552, 695, 848, 982, 1083, 1218, 1359, 1511, 1605, 1702];
const IDS = ['drone', 'secret', 'rowers', 'cargo', 'rudder', 'merchant', 'laugh', 'dialogue', 'cable', 'kite', 'push', 'hookq', 'hook'];
export const SHOTS = IDS.map((id, i) => ({ id, a: BND[i], b: BND[i + 1] - 1, light: 'sea' }));
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
const F = (id) => SHOTS.find((s) => s.id === id);

// ---------- lights / mood grades (Sea Glass family) ----------
export const LIGHTS = {
  sea: { az: 218, el: 33, sky: '#bfe0d8', ground: '#4a6a66', hemi: 1.06, sun: '#fff2cf', sunI: 2.35, fog: '#c2e0d6', fogNear: 48, fogFar: 340,
    skyTop: '#2e7ea6', skyHor: '#d2ecd9', sunDisc: '#fff6d8', sunSize: 0.0042, sat: 1.07, vig: 0.24, shadowExt: 24, aurora: 0, gain: '#eafaf2',
    waterDeep: '#14586b', waterShal: '#35a3a5', glint: '#d9fff2' },
  dusk: { az: 246, el: 14, sky: '#c9a184', ground: '#4c5648', hemi: 0.94, sun: '#ffab5e', sunI: 2.0, fog: '#cfb49a', fogNear: 44, fogFar: 310,
    skyTop: '#2c4a72', skyHor: '#f0b57e', sunDisc: '#ffbe78', sunSize: 0.003, sat: 1.04, vig: 0.29, shadowExt: 24, aurora: 0, gain: '#f2ddba',
    waterDeep: '#173f57', waterShal: '#2e7ea6', glint: '#ffe9c0' },
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
  if (S.id === 'hookq') return blendLight(LIGHTS.sea, LIGHTS.dusk, smooth(ramp(f, F('hookq').a, F('hookq').a + 55)));
  if (S.id === 'hook') return { ...LIGHTS.dusk };
  return { ...LIGHTS[S.light] };
};

// ---------- staging (shared by story, main, colliders) ----------
export const BOARD_POS = [0, 3.1, -6];
export const SHED = { x: -9.5, z: -3 };          // landing shed (west)
export const TABLE = { x: 5.2, z: 4.6 };         // merchant's gold table (east)
export const QUAY_Z = -15;                       // near bank edge; river beyond
export const FARBANK_Z = -48;                    // far bank strip centre
export const CABLE_X = 1.5;                      // iron cable runs along z at this x

// ---------- the river current (the plot's engine) ----------
// The current is always running; the sail only fills once the crossing
// begins (cargo) — before that the ferryman's sail hangs limp.
export const windKAt = (f) => {
  const w = F('cargo');
  if (f < w.a) return 0;
  return smooth(ramp(f, w.a + 8, w.a + 62)) * (shotAt(f).id === 'hook' || shotAt(f).id === 'hookq' ? 0.85 : 1);
};

// ---------- cast walks ----------
const walkKeys = (keys, f) => {
  let x = keys[0][1], z = keys[0][2];
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i][0]) { const a = keys[i - 1], b = keys[i]; const u = smooth(ramp(f, a[0], b[0])); return [lerp(a[1], b[1], u), lerp(a[2], b[2], u)]; }
    x = keys[keys.length - 1][1]; z = keys[keys.length - 1][2];
  }
  return [x, z];
};
const B = (id) => F(id).a, E = (id) => F(id).b;
// B0's path: moored at the landing -> glides mid-river on the cargo crossing
// -> back at the landing for the merchant -> mid-river for the reveal -> far bank
export const boatAt = (f) => {
  const S = shotAt(f).id;
  if (S === 'cargo') { const u = smooth(ramp(f, B('cargo') + 10, E('cargo') - 8)); return { x: lerp(5.2, 2.0, u), z: lerp(-17.5, -30, u), ry: lerp(0.12, 0.05, u) }; }
  if (S === 'rudder') { const u = smooth(ramp(f, B('rudder'), E('rudder'))); return { x: lerp(2.0, 0.5, u), z: lerp(-30, -33, u), ry: lerp(0.05, 0.02, u) }; }
  if (S === 'cable') return { x: 0, z: -26, ry: -0.12 };
  if (S === 'kite') { const u = smooth(ramp(f, B('kite'), E('kite'))); return { x: lerp(0, -1, u), z: lerp(-26, -28, u), ry: lerp(-0.12, -0.25, u) }; }
  if (S === 'push') { const u = smooth(ramp(f, B('push') + 8, E('push') - 6)); return { x: lerp(0, -3, u), z: lerp(-26, -42, u), ry: lerp(-0.25, -0.1, u) }; }
  if (S === 'hookq' || S === 'hook') return { x: -3, z: -42, ry: -0.1 };
  return { x: 5.2, z: -17.5, ry: 0.12 };   // moored at the landing
};
// ferryman: at the landing, aboard B0 for cargo/rudder, back on the quay for
// the merchant's offer, aboard again for laugh/dialogue/cable/kite/push
export const ferryAt = (f) => {
  const S = shotAt(f).id;
  if (S === 'secret') return { x: 0.6, z: 0.8, y: 0, aboard: 0 };   // with the passengers for the payment — NOT at the far quay edge
  if (S === 'cargo' || S === 'rudder') { const bp = boatAt(f); return { x: bp.x - 1.05, z: bp.z + 0.35, y: 0.36, aboard: 1 }; }
  if (S === 'laugh' || S === 'dialogue' || S === 'cable' || S === 'kite' || S === 'push') {
    const bp = boatAt(f); return { x: bp.x - 1.05, z: bp.z + 0.35, y: 0.36, aboard: 1 };
  }
  if (S === 'merchant') return { x: 4.6, z: -12.5, y: 0, aboard: 0 };
  return { x: 4.2, z: -12, y: 0, aboard: 0 };
};
// merchant: at his table, walks to the quay edge to offer the gold
const MERCH_KEYS = [
  [0, 4.3, 3.3], [B('merchant') + 8, 4.3, 3.3], [B('merchant') + 44, 3.2, -8.2], [E('merchant'), 3.2, -8.2],
  [B('laugh') + 10, 3.2, -8.2], [B('laugh') + 40, 4.3, 3.3], [1701, 4.3, 3.3],
];
export const merchantAt = (f) => { const [x, z] = walkKeys(MERCH_KEYS, f); return { x, z }; };
export const merchantMode = (f) => {
  const S = shotAt(f).id;
  if (S === 'merchant' && f >= B('merchant') + 8 && f <= B('merchant') + 44) return 'stroll';
  if (S === 'laugh' && f >= B('laugh') + 10 && f <= B('laugh') + 40) return 'stroll';
  return 'stand';
};
// passengers: at the landing for the secret; two ride the push crossing.
// Once aboard (f >= B('push')+30) they TRACK the boat — fixed world seats
// would strand them mid-river as B0 glides to the far bank (and crowd the
// ferryman at boarding: seats sit 1.4u forward of his stern post).
const PAX1_KEYS = [[0, -1.5, 2.5], [B('push'), -1.5, 2.5], [B('push') + 30, 0.4, -26.8], [1701, 0.4, -26.8]];
const PAX2_KEYS = [[0, 0.2, 3.0], [B('push'), 0.2, 3.0], [B('push') + 30, 0.4, -26.05], [1701, 0.4, -26.05]];
export const pax1At = (f) => {
  if (paxAboard(f)) { const bp = boatAt(f); return { x: bp.x + 0.5, z: bp.z - 0.3 }; }
  const [x, z] = walkKeys(PAX1_KEYS, f); return { x, z };
};
export const pax2At = (f) => {
  if (paxAboard(f)) { const bp = boatAt(f); return { x: bp.x + 0.5, z: bp.z + 0.45 }; }
  const [x, z] = walkKeys(PAX2_KEYS, f); return { x, z };
};
const paxAboard = (f) => shotAt(f).id === 'push' && f >= B('push') + 30;
// wedding party: three seated passengers aboard B0 during the cargo crossing
export const weddingAt = (f) => {
  const bp = boatAt(f);
  return [
    { x: bp.x + 0.75, z: bp.z - 0.40, y: 0.36 },
    { x: bp.x + 0.05, z: bp.z + 0.40, y: 0.36 },
    { x: bp.x + 0.75, z: bp.z + 0.35, y: 0.36 },
  ];
};
// rowers: seated aboard their rowing boats, only in the rowers shot
export const rower1At = () => ({ x: -3.8, z: -20.5, y: 0.36 });
export const rower2At = () => ({ x: -8.8, z: -25.0, y: 0.36 });

// ---------- carried props (contact beats live here) ----------
// coin pouch: passenger1 pays the ferryman double in the secret shot
export const coinAt = (f) => {
  const sc = F('secret');
  if (f < sc.a + 20 || f > sc.b) return { x: 0, y: -5, z: 0, k: 0, glint: 0 };
  const p1 = pax1At(f), fm = ferryAt(f);
  const hand = (w) => ({ x: w.x + 0.15, y: 1.0, z: w.z + 0.3, k: 1, glint: 0.4 });
  if (f < sc.a + 70) return hand(p1);
  if (f <= sc.a + 84) {
    const u = smooth(ramp(f, sc.a + 70, sc.a + 84));
    return { x: lerp(hand(p1).x, hand(fm).x, u), y: lerp(1.0, 1.0, u) + Math.sin(u * Math.PI) * 0.1, z: lerp(hand(p1).z, hand(fm).z, u), k: 1, glint: Math.sin(u * Math.PI) };
  }
  const h = hand(fm); h.k = 1 - ramp(f, sc.b - 8, sc.b); return h;
};
// gold bag: in the merchant's hand for the offer, then set on his table
export const goldAt = (f) => {
  const S = shotAt(f).id;
  if (S === 'merchant') {
    const m = merchantAt(f);
    if (f < B('merchant') + 44) return { x: m.x + 0.15, y: 1.0, z: m.z + 0.3, k: 1, glint: 0.5 };
    return { x: m.x + 0.15, y: 1.0, z: m.z + 0.3, k: 1, glint: 0.7 };  // held out, glinting
  }
  if (S === 'laugh' || S === 'dialogue' || S === 'cable') {
    // set down on the merchant's table
    return { x: TABLE.x + 0.35, y: 0.86, z: TABLE.z - 0.18, k: 1, glint: 0.25 };
  }
  return { x: 0, y: -5, z: 0, k: 0, glint: 0 };
};

// ---------- boats' sails (the current made visible) ----------
export const boatsAt = (f) => {
  const S = shotAt(f).id, wind = windKAt(f);
  return [
    { k: 1, limp: S === 'cargo' || S === 'rudder' || S === 'kite' || S === 'push' ? Math.min(1 - wind, 0.25) : 1, kind: 'plain', heel: wind * 0.03 }, // B0 ferryman
    { k: 0, limp: 1, kind: 'plain', heel: 0 },   // B1 rowing boat (no sail — oars)
    { k: 0, limp: 1, kind: 'plain', heel: 0 },   // B2 rowing boat
    { k: 0, limp: 1, kind: 'plain', heel: 0 },   // B3 far-bank mooring
  ];
};

// ---------- hero / focus ----------
const FOCUS = {
  drone: () => [0, 1.4, -8],
  secret: () => [-0.2, 1.2, 2.1],
  rowers: () => [-5, 1.0, -23],
  cargo: () => { const bp = boatAt(480); return [bp.x, 1.2, bp.z]; },
  rudder: () => { const bp = boatAt(620); return [bp.x - 1.05, 1.3, bp.z + 0.35]; },
  merchant: () => { const m = merchantAt(780); return [m.x, 1.35, m.z]; },
  laugh: () => { const fm = ferryAt(920); return [fm.x, 1.4, fm.z]; },
  dialogue: () => { const fm = ferryAt(1040); return [fm.x, 1.45, fm.z]; },
  cable: () => { const bp = boatAt(1150); return [bp.x, 0.6, bp.z]; },
  kite: () => { const bp = boatAt(1290); return [bp.x, 1.0, bp.z]; },
  push: () => { const bp = boatAt(1440); return [bp.x, 1.2, bp.z]; },
  hookq: () => BOARD_POS, hook: () => BOARD_POS,
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id]();

// ---------- cameras: EVERY shot is a camrig track on a subject ----------
const ferryPos = (f) => { const w = ferryAt(f); return [w.x, w.y || 0, w.z]; };
const bezierCam = (P, L, a, b, fov0, fov1) => (f) => {
  const u = M.smooth(ramp(f, a, b));
  const w0 = (1 - u) ** 3, w1 = 3 * (1 - u) ** 2 * u, w2 = 3 * (1 - u) * u * u, w3 = u ** 3;
  const mix = (Q) => [0, 1, 2].map((j) => w0 * Q[0][j] + w1 * Q[1][j] + w2 * Q[2][j] + w3 * Q[3][j]);
  return { pos: mix(P), look: mix(L), fov: lerp(fov0, fov1, u), roll: 0 };
};
const RIG_BY_ID = {
  drone: { cut: 'hard', raw: bezierCam(
    [[17, 11, 18], [12, 7, 15], [8.5, 4.4, 13.5], [7.0, 3.0, 12.4]],
    [[0, 2.8, -10], [-0.5, 2.0, -8], [-0.8, 1.4, -5], [-0.8, 1.2, -3.5]], B('drone'), E('drone'), 44, 40) },
  secret: { cut: 'hard', raw: pushInCam({ subject: (f) => [-0.2, 0, 2.1], a: B('secret'), b: E('secret'), d0: 10.0, d1: 8.5, h0: 1.7, h1: 1.55, lookOff: [0, 1.25, 0], fov0: 40, fov1: 35,
    dir: () => [0.66, 0.75] }) },
  rowers: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('rowers'), pos: [2.0, 2.6, -11.0], look: [-5.0, 1.0, -23.0], fov: 44 },
    { f: E('rowers'), pos: [1.6, 2.5, -11.8], look: [-5.5, 1.0, -24.0], fov: 40, ease: 'surge' }] }) },
  cargo: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('cargo'), pos: [11.5, 3.2, -7.5], look: [5.0, 1.0, -18], fov: 42 },
    { f: B('cargo') + 60, pos: [10.6, 3.0, -10], look: [3.4, 1.0, -25], fov: 39 },
    { f: E('cargo'), pos: [9.2, 3.1, -13], look: [1.2, 1.0, -31], fov: 36, ease: 'io' }] }) },
  rudder: { cut: 'hard', raw: pushInCam({ subject: ferryPos, a: B('rudder'), b: E('rudder'), d0: 5.0, d1: 3.8, h0: 1.6, h1: 1.45, lookOff: [0, 1.35, 0], fov0: 38, fov1: 32,
    dir: () => [-0.8, 0.6] }) },
  merchant: { cut: 'hard', raw: pushInCam({ subject: (f) => { const m = merchantAt(f); return [m.x, 0, m.z]; }, a: B('merchant'), b: E('merchant'), d0: 4.8, d1: 3.6, h0: 1.6, h1: 1.5, lookOff: [0, 1.4, 0], fov0: 36, fov1: 30,
    dir: () => [0.55, 0.8] }) },
  laugh: { cut: 'hard', raw: pushInCam({ subject: ferryPos, a: B('laugh'), b: E('laugh'), d0: 4.4, d1: 3.4, h0: 1.6, h1: 1.5, lookOff: [0, 1.4, 0], fov0: 36, fov1: 31,
    dir: () => [-0.75, 0.65] }) },
  dialogue: { cut: 'hard', raw: pushInCam({ subject: ferryPos, a: B('dialogue'), b: E('dialogue'), d0: 3.3, d1: 2.7, h0: 1.58, h1: 1.5, lookOff: [0, 1.45, 0], fov0: 32, fov1: 28,
    dir: () => [0.45, 0.85] }) },
  cable: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('cable'), pos: [6.8, 1.6, -16.5], look: [0.5, 0.2, -25], fov: 44 },
    { f: E('cable'), pos: [5.6, 1.3, -18.5], look: [0, 0.1, -27], fov: 38, ease: 'surge' }] }) },
  kite: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('kite'), pos: [9.8, 2.6, -14.5], look: [-0.5, 0.8, -27], fov: 42 },
    { f: E('kite'), pos: [8.6, 2.4, -16.5], look: [-1, 0.8, -28.5], fov: 38, ease: 'surge' }] }) },
  push: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('push'), pos: [10.5, 3.0, -13.5], look: [0, 1.0, -27], fov: 42 },
    { f: B('push') + 60, pos: [9.4, 2.9, -17], look: [-1.5, 1.0, -34], fov: 39 },
    { f: E('push'), pos: [8.2, 3.0, -21], look: [-3, 1.0, -41], fov: 36, ease: 'io' }] }) },
  hookq: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('hookq'), pos: [5.4, 3.9, 7.6], look: [0.1, 2.75, -5.9], fov: 40 },
    { f: E('hookq'), pos: [5.2, 3.9, 7.4], look: [0.05, 2.78, -5.95], fov: 37, ease: 'surge' }] }) },
  hook: { cut: 'hard', raw: keysCam({ keys: [
    { f: B('hook'), pos: [5.2, 3.9, 7.4], look: [0.05, 2.78, -5.95], fov: 37 },
    { f: E('hook'), pos: [5.0, 3.95, 7.2], look: [0.02, 2.8, -5.97], fov: 36, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: B('laugh') + 42, a: 0.03 }, { f: B('push') + 10, a: 0.03 }],
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
  if (['drone', 'hookq', 'rowers', 'cable'].includes(S.id)) cinf = 1.4;
  if (['merchant', 'dialogue', 'laugh', 'rudder'].includes(S.id)) cinf = 3.6;
  if (S.id === 'hook') cinf = 3.0;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f), cn = coinAt(f), gd = goldAt(f);
  const W = {
    boardTitle: 0, boardHook: 0,
    windK: windKAt(f), boats: boatsAt(f),
    coinX: cn.x, coinY: cn.y, coinZ: cn.z, coinK: cn.k, coinGlint: cn.glint || 0,
    goldX: gd.x, goldY: gd.y, goldZ: gd.z, goldK: gd.k, goldGlint: gd.glint || 0,
    cableK: ['cable', 'kite', 'push'].includes(S.id) ? 1 : 0,
    oarK: S.id === 'rowers' ? 1 : 0,
    goatK: S.id === 'cargo' || S.id === 'rudder' ? 1 : 0,
    sackK: S.id === 'cargo' || S.id === 'rudder' ? 1 : 0,
    dustK: 0.05,
  };
  if (S.id === 'drone') W.boardTitle = smooth(ramp(f, 28, 45)) * (1 - smooth(ramp(f, 66, 84)));
  if (S.id === 'hookq') W.boardHook = smooth(ramp(f, B('hookq') + 44, B('hookq') + 68));
  if (S.id === 'hook') W.boardHook = 1;   // held at FULL opacity to the literal last frame
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  const moving = ['cargo', 'rudder', 'push'].includes(S.id);
  return { smokeRate: 0.05, dustRate: 0.05, splashRate: 0, steamRate: moving ? 0.85 : (S.id === 'kite' ? 0.4 : 0), shimmerRate: 0, windK: windKAt(f) };
};
export const fxAt = () => [];

// ---------- cast (single source for actors AND colliders) ----------
const TINT = { sea: '#ffffff', dusk: '#f2ddc4' };
const tintFor = (S) => S.id === 'hook' || S.id === 'hookq' ? TINT.dusk : TINT.sea;
export const OUTFITS = {
  ferryman: { jacket: '#3f5a6e', pants: '#2a3242', boots: '#1c1712', hat: 'cap', cap: '#5d6a2e', skin: '#b98a5e', moustache: '#8a8a80' },
  merchant: { jacket: '#6e2a3a', pants: '#2c2226', boots: '#1c1712', hat: 'cap', cap: '#c8a03a', skin: '#c98a5a', moustache: '#241a12' },
  pax1: { jacket: '#8a6f42', pants: '#3a3230', boots: '#201812', hat: 'hair', hair: '#1c1410', skin: '#a06a3c' },
  pax2: { jacket: '#7a4a6e', pants: '#33302c', boots: '#241a12', hat: 'hair', hair: '#2c1a10', skin: '#c98a5a' },
  rower1: { jacket: '#a34a3a', pants: '#2a3242', boots: '#1c1712', hat: 'hair', hair: '#241a12', skin: '#8a5a34' },
  rower2: { jacket: '#2c4a6e', pants: '#33302c', boots: '#241a12', hat: 'hair', hair: '#1c1410', skin: '#c98a5a' },
  bride: { jacket: '#c23b5e', pants: '#3a3230', boots: '#201812', hat: 'hair', hair: '#1c1410', skin: '#d9b48f' },
  groom: { jacket: '#2c4a6e', pants: '#2a3242', boots: '#1c1712', hat: 'cap', cap: '#c8a03a', skin: '#a06a3c' },
  guest: { jacket: '#4a6a3a', pants: '#33302c', boots: '#241a12', hat: 'hair', hair: '#2c1a10', skin: '#c98a5a' },
};
export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, z, extra = {}) => out.push({ id, x, y: extra.y ?? 0, z, r: 0.32, ground: extra.ground ?? 0,
    actor: (T) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x, y: extra.y ?? 0, z, ground: extra.ground ?? 0, tint, ...extra }) });
  const fm = ferryAt(f), m = merchantAt(f), p1 = pax1At(f), p2 = pax2At(f);
  const FM_ = { expr: 'neutral', mode: 'stand', phase: q((f * 0.011) % 1, 2), blink: blinkAt(f, 31), seed: 31 };
  const M_ = { expr: 'stern', mode: merchantMode(f), phase: q((f * 0.011) % 1, 2), blink: blinkAt(f, 41), seed: 41 };
  const P1_ = { expr: 'neutral', mode: 'stand', phase: q((f * 0.011) % 1, 2), blink: blinkAt(f, 51), seed: 51 };
  const P2_ = { expr: 'neutral', mode: 'stand', phase: q((f * 0.011) % 1, 2), blink: blinkAt(f, 52), seed: 52 };
  switch (S.id) {
    case 'drone': {
      std('ferryman', OUTFITS.ferryman, { ...FM_ }, fm.x, fm.z, { yaw: 0.4 });
      std('merchant', OUTFITS.merchant, { ...M_ }, m.x, m.z, { yaw: -0.5 });
      std('pax1', OUTFITS.pax1, { ...P1_ }, p1.x, p1.z, { yaw: 0.3 });
      break;
    }
    case 'secret': {
      std('pax1', OUTFITS.pax1, { ...P1_, expr: f > B('secret') + 84 ? 'smile' : 'neutral', prop: f < B('secret') + 70 ? ['coin', 0.7] : null }, p1.x, p1.z, { yaw: 0.55 });
      std('pax2', OUTFITS.pax2, { ...P2_, expr: 'smile' }, p2.x, p2.z, { yaw: 0.4 });
      std('ferryman', OUTFITS.ferryman, { ...FM_, expr: 'smile' }, fm.x, fm.z, { yaw: -0.55 });
      break;
    }
    case 'rowers': {
      const r1 = rower1At(), r2 = rower2At();
      std('rower1', OUTFITS.rower1, { expr: 'pained', mode: 'sit', phase: q((f * 0.03) % 1, 2), blink: blinkAt(f, 53), seed: 53 }, r1.x, r1.z, { y: r1.y, ground: r1.y, blob: false, yaw: 0.3 });
      std('rower2', OUTFITS.rower2, { expr: 'pained', mode: 'sit', phase: q(((f + 15) * 0.03) % 1, 2), blink: blinkAt(f, 54), seed: 54 }, r2.x, r2.z, { y: r2.y, ground: r2.y, blob: false, yaw: -0.2 });
      std('ferryman', OUTFITS.ferryman, { ...FM_, expr: 'smile' }, fm.x, fm.z, { yaw: 0.5 });
      break;
    }
    case 'cargo': {
      const w = weddingAt(f);
      std('ferryman', OUTFITS.ferryman, { ...FM_, mode: 'stand' }, fm.x, fm.z, { y: fm.y, ground: fm.y, blob: false, yaw: 0.3 });
      std('bride', OUTFITS.bride, { expr: 'smile', mode: 'sit', blink: blinkAt(f, 55), seed: 55 }, w[0].x, w[0].z, { y: w[0].y, ground: w[0].y, blob: false, yaw: 0.2 });
      std('groom', OUTFITS.groom, { expr: 'smile', mode: 'sit', blink: blinkAt(f, 56), seed: 56 }, w[1].x, w[1].z, { y: w[1].y, ground: w[1].y, blob: false, yaw: -0.2 });
      std('guest', OUTFITS.guest, { expr: 'smile', mode: 'sit', blink: blinkAt(f, 57), seed: 57 }, w[2].x, w[2].z, { y: w[2].y, ground: w[2].y, blob: false, yaw: 0.4 });
      break;
    }
    case 'rudder': {
      std('ferryman', OUTFITS.ferryman, { ...FM_, expr: 'neutral', prop: ['point', 0.3] }, fm.x, fm.z, { y: fm.y, ground: fm.y, blob: false, yaw: 0.25 });
      break;
    }
    case 'merchant': {
      std('merchant', OUTFITS.merchant, { ...M_, expr: 'smile', prop: ['coin', 0.9] }, m.x, m.z, { yaw: -0.6 });
      std('ferryman', OUTFITS.ferryman, { ...FM_, expr: 'neutral' }, fm.x, fm.z, { y: fm.y, ground: fm.y, blob: false, yaw: 0.45 });
      break;
    }
    case 'laugh': {
      // he laughs, stamps his foot (rig kick at +42), points down at the water
      std('ferryman', OUTFITS.ferryman, { ...FM_, expr: 'laugh', headTilt: -0.08, prop: ['point', 0.85] }, fm.x, fm.z, { y: fm.y, ground: fm.y, blob: false, yaw: 0.3 });
      std('merchant', OUTFITS.merchant, { ...M_, expr: 'shock' }, m.x, m.z, { yaw: -0.6 });
      break;
    }
    case 'dialogue': {
      // THE dialogue beat: the ferryman PERFORMS his line — mouth driven by
      // the stem inside the speak segment, closed outside it; the merchant
      // only listens (his mouth never opens).
      std('ferryman', OUTFITS.ferryman, { mode: 'stand', blink: blinkAt(f, 31), seed: 31, look: 0.12, ...speakFace('smile', f) }, fm.x, fm.z, { y: fm.y, ground: fm.y, blob: false, yaw: 0.3 });
      std('merchant', OUTFITS.merchant, { ...M_, mode: 'stand', expr: 'neutral' }, m.x, m.z, { yaw: -0.5 });
      break;
    }
    case 'cable': {
      std('ferryman', OUTFITS.ferryman, { ...FM_, expr: 'smile', prop: ['point', 0.9], headTilt: 0.12 }, fm.x, fm.z, { y: fm.y, ground: fm.y, blob: false, yaw: 0.3 });
      std('merchant', OUTFITS.merchant, { ...M_, expr: 'shock' }, m.x, m.z, { yaw: -0.5 });
      break;
    }
    case 'kite': {
      std('ferryman', OUTFITS.ferryman, { ...FM_, expr: 'smile' }, fm.x, fm.z, { y: fm.y, ground: fm.y, blob: false, yaw: 0.3 });
      break;
    }
    case 'push': {
      std('ferryman', OUTFITS.ferryman, { ...FM_, expr: 'smile' }, fm.x, fm.z, { y: fm.y, ground: fm.y, blob: false, yaw: 0.3 });
      if (paxAboard(f)) {
        std('pax1', OUTFITS.pax1, { ...P1_, expr: 'smile', mode: 'sit' }, p1.x, p1.z, { y: 0.36, ground: 0.36, blob: false, yaw: 0.2 });
        std('pax2', OUTFITS.pax2, { ...P2_, expr: 'smile', mode: 'sit' }, p2.x, p2.z, { y: 0.36, ground: 0.36, blob: false, yaw: -0.2 });
      }
      break;
    }
    case 'hookq': case 'hook': break;
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity: statics, dynamics, ground (LIBRARY v3 gate data) ----------
export const STATICS = [
  SOL.aabb(SHED.x - 2.4, SHED.x + 2.4, SHED.z - 1.9, SHED.z + 1.9, { h: 3.9, id: 'shed' }),
  SOL.obb(TABLE.x, TABLE.z, 0, 0.85, 0.5, { h: 0.78, id: 'table' }),
  SOL.circle(BOARD_POS[0] - 2.1, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  SOL.circle(BOARD_POS[0] + 2.1, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  SOL.aabb(-14, -10, FARBANK_Z - 4, FARBANK_Z + 4, { h: 3.9, id: 'farhut1' }),
  SOL.aabb(8, 12, FARBANK_Z - 4, FARBANK_Z + 4, { h: 3.9, id: 'farhut2' }),
];
export const WORLD = SOL.makeWorld(STATICS);
export const dynamicsAt = (f) => {
  const out = [];
  for (const a of castAt(f)) out.push(SOL.circle(a.x, a.z, a.r, { kind: 'dynamic', id: a.id }));
  return out;
};
export const groundItemsAt = (f) => {
  const items = [];
  for (const a of castAt(f)) items.push({ id: a.id, y: a.y, ground: a.ground ?? 0, maxHover: 0.06 });
  return items;
};
