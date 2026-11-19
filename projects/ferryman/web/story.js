// Shot plan for "The Ferryman Who Rowed Without Oars" — ferryman.
// v4 UPGRADE (2026-11-19): picture-only rebuild on the existing stem —
//   * v4 ACTION CAMERA: subject-anchored tracking, fast eased push-ins at
//     action starts, impact kicks, two declared whip reframes (title-board
//     reveal, merchant shock reaction). No slow drift, no static holds,
//     camera never behind the card characters.
//   * ANIMATION UPGRADE v1+v2 (body.js v2 / Library v6): lifeAt continuous
//     life, emoTrack expression morphs, gaze tracks, gripTrack physical
//     grips (coin handover, gold-bag offer, tiller, the rope of the
//     dialogue line), gestureAt dialogue hands, stride-phased walks.
//   * Salted Mine V3 style: WHITE heads (#fbf7ef), no card tint,
//     word-by-word captions (main.js + words.js).
// Stem, beat map, boards, story and mix are UNCHANGED from the v1 build.
// Batch 8 E1 (Mirror Trick Tales). ONE set: a river landing — stone quay
// (near bank), the wide river beyond, a far bank with huts. A ferryman
// crosses forty times a day and never touches an oar: his boat hangs from
// a sunken iron cable and the current pushes it across for free.
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
// END RULE: the one performed dialogue line (L8) sits at 59–64% of the
// stem; everything after it is narration — nobody speaks at the end and
// the final frame's mouths are closed.
import { M, q, clamp, lerp, ramp } from './motion.js';
import { buildRig, keysCam } from './camrig.js';
import * as SOL from './solid.js';
import * as T from './toon.js';
import * as SPK from './speak.js';
import { SPEAK_DATA } from './speakdata.js';
import { lifeAt, emoTrack, gazeTrack, gripTrack, gestureAt, jumpTrack, winkTrack } from './body.js';

// ---------- v4 dialogue performance ----------
const SPEAK = SPK.makeSpeakPlayer(SPEAK_DATA);

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
const B = (id) => F(id).a, E = (id) => F(id).b;

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
const blendLight = (A, Bb, t) => {
  const o = {};
  for (const k of Object.keys(A)) o[k] = typeof A[k] === 'number' ? lerp(A[k], Bb[k], t) : hexLerp(A[k], Bb[k], t);
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
// cumulative distance the merchant has walked by frame f (stride phase source)
const MERCH_DIST = (() => {
  const arr = [0]; let px = merchantAt(0).x, pz = merchantAt(0).z, acc = 0;
  for (let f = 1; f < TOTAL; f++) { const m = merchantAt(f); acc += Math.hypot(m.x - px, m.z - pz); px = m.x; pz = m.z; arr.push(acc); }
  return arr;
})();
// passengers: at the landing for the secret; two ride the push crossing.
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

// ---------- v4 ACTION CAMERA ----------
// trackCam: ANALYTIC subject track — the subject is sampled every frame
// (never interpolated, so the camera inherits the subject's own smooth
// motion exactly, like pushInCam) while distance / height / fov / look
// offsets glide between spec keys on smootherstep ramps. dir is a unit
// plan vector from the subject toward the camera (front / front
// three-quarter ONLY). The key distances author the push-ins.
const ferryPos = (f) => { const w = ferryAt(f); return [w.x, w.y || 0, w.z]; };
const boatPos = (f) => { const bp = boatAt(f); return [bp.x, 0, bp.z]; };
const trackCam = (subject, dir, spec) => (f) => {
  const seg = (idx, dflt = 0) => {
    if (f <= spec[0][0]) return spec[0][idx] ?? dflt;
    for (let i = 1; i < spec.length; i++) {
      if (f <= spec[i][0]) { const u = M.smooth(ramp(f, spec[i - 1][0], spec[i][0])); return lerp(spec[i - 1][idx] ?? dflt, spec[i][idx] ?? dflt, u); }
    }
    return spec[spec.length - 1][idx] ?? dflt;
  };
  const s = subject(f);
  const d = seg(1), h = seg(2), fov = seg(3, 40), lookDy = seg(4, 1.4), lookDx = seg(5, 0);
  return { pos: [s[0] + dir[0] * d, s[1] + h, s[2] + dir[1] * d], look: [s[0] + lookDx, s[1] + lookDy, s[2]], fov, roll: 0 };
};
// L1a — OPENING: ferryman BIG from frame 0 (head ~40%), low, mid-action at
// his moored boat; fast push-in over the first 16 frames, then the arc
// keeps travelling. Whip at f70 hands over to the title-board wide.
const droneACam = trackCam(ferryPos, [0.52, 0.85], [
  [0, 4.35, 1.52, 38, 1.52], [16, 3.35, 1.47, 35, 1.5], [69, 3.75, 1.52, 36, 1.5],
]);
const droneBCam = keysCam({ keys: [
  { f: 70, pos: [8.6, 4.0, 11.5], look: [0, 2.9, -6], fov: 41 },
  { f: 152, pos: [7.9, 3.85, 10.6], look: [0, 2.88, -6], fov: 38, ease: 'io' },
] });
// L2 — the payment: NW-side two-shot arc -> push onto the coin handover.
// (The pair spans x -1.5..0.6 on the quay; from the +x side the payer
// fell out of frame and the pouch floated ownerless — from -x both men
// and the coin stay framed, front three-quarter on both.)
const secretCam = keysCam({ keys: [
  { f: B('secret'), pos: [-4.6, 1.75, 6.6], look: [-0.38, 1.1, 2.0], fov: 38 },
  { f: B('secret') + 32, pos: [-3.9, 1.6, 5.9], look: [-0.28, 1.05, 1.85], fov: 36 },
  { f: B('secret') + 67, pos: [-3.4, 1.5, 5.4], look: [-0.18, 1.02, 1.7], fov: 34 },
  { f: B('secret') + 91, pos: [-3.25, 1.48, 5.25], look: [-0.13, 1.02, 1.75], fov: 33 },
  { f: E('secret'), pos: [-3.8, 1.6, 5.8], look: [-0.28, 1.05, 1.85], fov: 35, ease: 'io' },
] });
// L3 — the rowers: wide on both boats -> punch onto rower1's straining
// face (reaction close-up) as the line lands on "their arms shook".
const rowersCam = keysCam({ keys: [
  { f: B('rowers'), pos: [3.6, 2.5, -12.2], look: [-5.2, 0.95, -22.8], fov: 44 },
  { f: B('rowers') + 46, pos: [0.6, 2.0, -16.2], look: [-4.4, 1.05, -21.3], fov: 38 },
  { f: B('rowers') + 73, pos: [-2.2, 1.52, -18.7], look: [-3.8, 1.35, -20.5], fov: 33 },
  { f: E('rowers'), pos: [-2.0, 1.5, -18.9], look: [-3.85, 1.33, -20.55], fov: 32, ease: 'io' },
] });
// L4 — the crossing: tracking AT BOAT SPEED, push-in as the sail fills,
// closest pass over the deck cargo (grain, goats, wedding party).
const cargoCam = trackCam(boatPos, [0.55, 0.83], [
  [B('cargo'), 11.5, 3.1, 44, 1.15, -0.1], [B('cargo') + 18, 8.2, 2.6, 39, 1.1, 0],
  [B('cargo') + 73, 7.4, 2.4, 37, 1.05, 0.15], [B('cargo') + 107, 6.7, 2.5, 35, 1.0, 0.38],
  [E('cargo'), 7.2, 2.3, 38, 1.05, 0.15],
]);
// L5 — the rudder: close stern track, fast push-in, his hand on the tiller.
const rudderCam = trackCam(ferryPos, [-0.6, 0.8], [
  [B('rudder'), 3.9, 1.66, 37, 1.52], [B('rudder') + 18, 2.95, 1.58, 33, 1.52], [E('rudder'), 2.6, 1.55, 31, 1.5],
]);
// L6 — the offer: analytic track of the merchant's walk to the quay
// edge, then a push onto the merchant + the glinting gold bag. (The
// anchor eases from the merchant to the offer point at the quay edge.)
const merchAnchor = (f) => {
  const m = merchantAt(f);
  if (f < B('merchant') + 44) return [m.x, 0, m.z];
  const u = smooth(ramp(f, B('merchant') + 44, B('merchant') + 62));
  return [lerp(m.x, 3.3, u), 0, lerp(m.z, -8.45, u)];
};
const merchantCam = trackCam(merchAnchor, [0.62, 0.78], [
  [B('merchant'), 4.9, 1.8, 38, 1.3], [B('merchant') + 20, 4.62, 1.7, 36, 1.3],
  [B('merchant') + 44, 4.38, 1.63, 34, 1.3], [B('merchant') + 67, 4.08, 1.6, 32, 1.31],
  [E('merchant'), 3.8, 1.58, 31, 1.32],
]);
// L7a — the laugh: push-in on the ferryman as he laughs, stamps (rig kick
// at +42), points down at the dark water. Whip at f906 to…
const laughACam = trackCam(ferryPos, [0.66, 0.75], [
  [B('laugh'), 4.9, 1.7, 38, 1.72], [B('laugh') + 18, 3.6, 1.62, 33, 1.7], [B('laugh') + 57, 3.3, 1.6, 31, 1.7],
]);
// L7b — …the merchant's SHOCK, face ~65-70% of frame, the gold bag on the
// table beside him forgotten.
const laughBCam = keysCam({ keys: [
  { f: B('laugh') + 58, pos: [5.85, 1.6, 5.5], look: [4.3, 1.48, 3.3], fov: 31 },
  { f: E('laugh'), pos: [5.7, 1.58, 5.3], look: [4.3, 1.47, 3.3], fov: 30, ease: 'io' },
] });
// L8 — THE dialogue: camera holds on the performer, fast push to a big
// close-up; he grips the rope with one hand and talks with the other.
const dialogueCam = trackCam(ferryPos, [0.5, 0.86], [
  [B('dialogue'), 3.45, 1.66, 34, 1.72], [B('dialogue') + 18, 2.75, 1.6, 30, 1.7], [E('dialogue'), 2.55, 1.58, 29, 1.7],
]);
// L9 — the reveal: start on the pointing ferryman, DIVE to the waterline
// insert — hull, hanging rope and the iron cable fill the frame.
const cableCam = keysCam({ keys: [
  { f: B('cable'), pos: [2.3, 2.05, -21.6], look: [-1.05, 1.95, -25.65], fov: 38 },
  { f: B('cable') + 18, pos: [3.3, 1.05, -21.4], look: [0.4, 0.15, -25.6], fov: 36 },
  { f: B('cable') + 49, pos: [3.95, 0.62, -22.2], look: [0.9, -0.02, -26.1], fov: 34 },
  { f: E('cable'), pos: [4.35, 0.72, -23.6], look: [1.15, 0.02, -27.6], fov: 35, ease: 'io' },
] });
// L10 — the kite: the boat hangs angled against the current; track it.
const kiteCam = keysCam({ keys: [
  { f: B('kite'), pos: [7.0, 2.3, -19.2], look: [0, 1.15, -26], fov: 42 },
  { f: B('kite') + 18, pos: [6.1, 2.05, -20.3], look: [-0.1, 1.1, -26.3], fov: 38 },
  { f: E('kite'), pos: [5.3, 2.15, -22.2], look: [-1, 1.05, -28], fov: 36, ease: 'io' },
] });
// L11 — the push: tracking at boat speed all the way to the far bank.
const pushCam = keysCam({ keys: [
  { f: B('push'), pos: [7.6, 2.7, -19.6], look: [0, 1.1, -26], fov: 42 },
  { f: B('push') + 18, pos: [6.7, 2.35, -21.3], look: [-0.2, 1.05, -27.6], fov: 38 },
  { f: B('push') + 81, pos: [4.7, 2.25, -30.3], look: [-1.6, 1.0, -34.6], fov: 37 },
  { f: E('push'), pos: [3.5, 2.35, -36.3], look: [-3, 0.95, -41.6], fov: 36, ease: 'io' },
] });
// L12 — the hook: ferryman + merchant in the foreground, the board
// together with them at ~82% width; a slow push that never stops.
const hookqCam = keysCam({ keys: [
  { f: B('hookq'), pos: [4.4, 2.78, 9.4], look: [0, 2.5, -6], fov: 35 },
  { f: E('hookq'), pos: [4.24, 2.72, 9.05], look: [0, 2.5, -6], fov: 34.5, ease: 'io' },
] });
const hookCam = keysCam({ keys: [
  { f: B('hook'), pos: [4.24, 2.72, 9.05], look: [0, 2.5, -6], fov: 34.5 },
  { f: E('hook'), pos: [4.08, 2.68, 8.72], look: [0, 2.5, -6], fov: 34, ease: 'io' },
] });
const RIG_SHOTS = [
  { a: 0, b: 69, raw: droneACam },
  { a: 70, b: 152, raw: droneBCam, cut: 'whip', blend: 6 },
  { a: 153, b: 268, raw: secretCam },
  { a: 269, b: 404, raw: rowersCam },
  { a: 405, b: 551, raw: cargoCam },
  { a: 552, b: 694, raw: rudderCam },
  { a: 695, b: 847, raw: merchantCam },
  { a: 848, b: 905, raw: laughACam },
  { a: 906, b: 981, raw: laughBCam, cut: 'whip', blend: 6 },
  { a: 982, b: 1082, raw: dialogueCam },
  { a: 1083, b: 1217, raw: cableCam },
  { a: 1218, b: 1358, raw: kiteCam },
  { a: 1359, b: 1510, raw: pushCam },
  { a: 1511, b: 1604, raw: hookqCam },
  { a: 1605, b: 1701, raw: hookCam },
];
const RIG = buildRig({
  total: TOTAL,
  shots: RIG_SHOTS,
  kicks: [{ f: B('laugh') + 42, a: 0.035 }, { f: B('cable') + 18, a: 0.04 }, { f: B('push') + 10, a: 0.05 }],
  sigma: 2.3, fovSigma: 1.6,
});
export const camAt = (f) => RIG.camAt(f);
export const RIG_META = {
  kicks: RIG.declared.kicks, hardCuts: RIG.declared.hardCuts,
  blends: [],
  whips: RIG.declared.whips,
  samples: RIG.samples,
};
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), hp = heroPosAt(f);
  let cinf = 2.4;
  if (['drone', 'hookq', 'rowers', 'cable'].includes(S.id)) cinf = 1.4;
  if (['merchant', 'dialogue', 'laugh', 'rudder'].includes(S.id)) cinf = 3.6;
  if (S.id === 'secret') cinf = 3.0;
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
  // the title board appears only once the whip has settled on the wide
  // (f84-100 in, f132-148 out) — boardverify sees it fully in or fully out.
  if (S.id === 'drone') W.boardTitle = smooth(ramp(f, 84, 100)) * (1 - smooth(ramp(f, 132, 148)));
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

// ============================================================
// CAST + PERFORMANCE — the animation upgrade lives here: every actor
// gets lifeAt() breathing/sway, an emoTrack() face, gaze that follows
// the action, gripTrack() hands for every hold, and gestureAt() hands
// while speaking. Nobody is a statue in any frame. Skins are the
// Salted Mine V3 WHITE (#fbf7ef); cards carry NO tint.
// ============================================================
export const OUTFITS = {
  ferryman: { jacket: '#3f5a6e', pants: '#2a3242', boots: '#1c1712', hat: 'cap', cap: '#5d6a2e', skin: '#fbf7ef', moustache: '#8a8a80' },
  merchant: { jacket: '#6e2a3a', pants: '#2c2226', boots: '#1c1712', hat: 'cap', cap: '#c8a03a', skin: '#fbf7ef', moustache: '#241a12' },
  pax1: { jacket: '#8a6f42', pants: '#3a3230', boots: '#201812', hat: 'hair', hair: '#1c1410', skin: '#fbf7ef' },
  pax2: { jacket: '#7a4a6e', pants: '#33302c', boots: '#241a12', hat: 'hair', hair: '#2c1a10', skin: '#fbf7ef' },
  rower1: { jacket: '#a34a3a', pants: '#2a3242', boots: '#1c1712', hat: 'hair', hair: '#241a12', skin: '#fbf7ef' },
  rower2: { jacket: '#2c4a6e', pants: '#33302c', boots: '#241a12', hat: 'hair', hair: '#1c1410', skin: '#fbf7ef' },
  bride: { jacket: '#c23b5e', pants: '#3a3230', boots: '#201812', hat: 'hair', hair: '#1c1410', skin: '#fbf7ef' },
  groom: { jacket: '#2c4a6e', pants: '#2a3242', boots: '#1c1712', hat: 'cap', cap: '#c8a03a', skin: '#fbf7ef' },
  guest: { jacket: '#4a6a3a', pants: '#33302c', boots: '#241a12', hat: 'hair', hair: '#2c1a10', skin: '#fbf7ef' },
};
// ---- expression morph tracks (the face matches the beat) ----
const ferryEmo = emoTrack([[0, 'smile'], [405, 'proud'], [552, 'smile'], [695, 'stern'], [848, 'laugh'], [982, 'proud'], [1083, 'smile'], [1218, 'proud'], [1359, 'smile'], [1605, 'grin']], 31);
const merchEmo = emoTrack([[0, 'stern'], [695, 'smile'], [848, 'shock'], [982, 'neutral'], [1083, 'shock'], [1218, 'wonder'], [1511, 'smile']], 41);
const pax1Emo = emoTrack([[0, 'neutral'], [153, 'smile'], [1359, 'smile'], [1511, 'grin']], 51);
const pax2Emo = emoTrack([[0, 'smile'], [1359, 'grin']], 52);
const rower1Emo = emoTrack([[0, 'pained'], [350, 'dazed'], [385, 'pained']], 53);
const rower2Emo = emoTrack([[0, 'pained']], 54);
const brideEmo = emoTrack([[0, 'smile'], [470, 'grin']], 55);
const groomEmo = emoTrack([[0, 'smile']], 56);
const guestEmo = emoTrack([[0, 'smile'], [500, 'laugh']], 57);
// ---- gaze tracks (eyes follow the named subject) ----
const ferryGaze = gazeTrack([
  { f: 0, look: 0.15, lookY: 0.05 }, { f: 153, look: -0.3 }, { f: 405, look: 0.2, lookY: -0.05 },
  { f: 695, look: -0.35, lookY: 0 }, { f: 848, look: 0.1, lookY: -0.3 }, { f: 982, look: 0.05, lookY: 0 },
  { f: 1083, look: 0.2, lookY: -0.35 }, { f: 1218, look: 0.25, lookY: -0.05 }, { f: 1359, look: 0.15 },
  { f: 1511, look: 0, lookY: 0.15 },
]);
const merchGaze = gazeTrack([
  { f: 0, look: 0.2 }, { f: 695, look: 0.3, lookY: -0.1 }, { f: 848, look: 0.35, lookY: 0 },
  { f: 1083, look: 0.2, lookY: -0.3 }, { f: 1511, look: -0.1, lookY: 0.2 },
]);
// ---- GRIP TRACKS (card units; hang ≈ L(190,730) R(410,730)) ----
const GT = (ks) => gripTrack(ks.map(([f, x, y, g]) => ({ f, x, y, grip: g })));
const AP = (SL, SR) => {
  const o = {};
  if (SL) o.L = { hand: [Math.round(SL.x), Math.round(SL.y)], grip: q(SL.grip, 2), front: true };
  if (SR) o.R = { hand: [Math.round(SR.x), Math.round(SR.y)], grip: q(SR.grip, 2), front: true };
  return Object.keys(o).length ? o : undefined;
};
// ferryman screen-RIGHT hand: tiller grip (rudder) -> point down (laugh)
// -> THE ROPE grip (dialogue) -> point at the cable (reveal)
const fmSR = GT([
  [0, 410, 730, 0], [540, 410, 730, 0], [556, 398, 648, 0.85], [690, 398, 648, 0.85],
  [702, 410, 730, 0], [860, 410, 730, 0], [874, 428, 652, 0.05], [972, 428, 652, 0.05],
  [984, 410, 730, 0], [998, 428, 478, 0.92], [1070, 428, 478, 0.92], [1081, 410, 706, 0.25],
  [1092, 430, 520, 0.05], [1208, 430, 520, 0.05], [1220, 410, 730, 0],
]);
// ferryman screen-LEFT hand: reaches forward-down to RECEIVE the coin
// pouch (secret) — extended toward the other man, not onto his own torso
const fmSL = GT([
  [0, 190, 730, 0], [215, 190, 730, 0], [226, 320, 660, 0.8], [252, 320, 660, 0.9], [264, 190, 730, 0.1],
]);
// passenger1 screen-RIGHT hand: holds the coin pouch out, lets it go
const paxSR = GT([
  [0, 410, 730, 0], [160, 410, 730, 0], [173, 330, 650, 0.85], [220, 330, 650, 0.85], [234, 408, 690, 0.15], [268, 410, 730, 0],
]);
// merchant screen-RIGHT hand: the gold bag, carried and held out glinting
const merchSR = GT([
  [0, 410, 730, 0], [700, 410, 730, 0], [712, 396, 556, 0.9], [847, 396, 556, 0.9], [860, 410, 730, 0],
]);
// the foot-stamp hop (laugh, synced with the rig kick at +42)
const stampJump = jumpTrack([{ f0: B('laugh') + 36, dur: 13, h: 0.05, back: 2 }]);
const ferryWink = winkTrack([{ a: 1652, b: 1676 }]);
// redraw a gripping hand OVER its object (fingertips + palm dot)
const gripHand = (p, hx, hy, skin) => {
  p.ell(hx, hy, 9.5, 9.5, skin, 2.2);
  for (const [dx, dy] of [[-8, -5], [0, -8], [8, -5]]) p.ell(hx + dx, hy + dy, 4.2, 4.2, skin, 1.6);
};
const LAP = { L: { x: 248, y: 648, grip: 0.25 }, R: { x: 352, y: 648, grip: 0.25 } };

export const castAt = (f) => {
  const S = shotAt(f), tint = '#ffffff', out = [];
  const push = (id, o, opts, x, z, extra = {}) => out.push({
    id, x, y: extra.y ?? 0, z, r: extra.r ?? 0.32, ground: extra.ground ?? (extra.y ?? 0),
    actor: (TT) => ({
      key: id + JSON.stringify(o) + JSON.stringify(opts) + (extra.ov || ''),
      draw: (p) => { TT.bodyFront(p, o, opts); if (extra.drawOv) extra.drawOv(p); },
      x, y: extra.y ?? 0, z, ground: extra.ground ?? (extra.y ?? 0), tint, s: extra.s, yaw: extra.yaw, blob: extra.blob,
    }),
  });
  const base = (seed, amp = 1) => {
    const L = lifeAt(f, seed);
    return { seed, blink: new T.Blink(seed).at(f), breath: L.breath, tilt: q(L.tilt * amp, 2), headTilt: q(L.headTilt, 2), squashL: L.squash };
  };
  const std = (B0, G, exprP, over = {}) => ({
    mode: over.mode || 'stand', phase: over.phase ?? 0, exprP, blink: B0.blink, seed: B0.seed,
    breath: B0.breath, tilt: q(B0.tilt + (over.tilt || 0), 2), headTilt: q(B0.headTilt + (G ? G.tilt : 0) + (over.headTilt || 0), 2),
    look: q(G ? G.look : 0, 2), lookY: q(G ? G.lookY : 0, 2), facing: q(G ? G.facing : 0, 2),
    squash: q(Math.max(B0.squashL, over.squash || 0), 3), armPose: over.armPose,
  });
  const fm = ferryAt(f), m = merchantAt(f), p1 = pax1At(f), p2 = pax2At(f);

  // ---------- FERRYMAN ----------
  const addFerryman = (extra = {}) => {
    const B0 = base(31), G = ferryGaze(f);
    let exprP = ferryEmo(f);
    let SL = fmSL(f), SR = fmSR(f), squash = 0, y = fm.y, tilt = 0;
    if (S.id === 'dialogue') {
      exprP = SPK.applySpeak(exprP, SPEAK.at(f));   // he PERFORMS the line
      const g = gestureAt(f, 31, SPEAK.at(f).nod || 0);
      SL = { x: 208 + g.dx, y: 596 + g.dy, grip: 0.15 };
      tilt = g.sway;
    }
    if ((S.id === 'hook' || S.id === 'hookq')) {
      const wk = ferryWink(f);
      if (wk > 0) exprP = T.blendFaceP(exprP, T.faceP('wink', 31), wk);
      SR = { x: 432, y: 470, grip: 0.1 };        // hand raised toward the board
      SL = { x: 190, y: 730, grip: 0 };
    }
    if (S.id === 'laugh') { const J = stampJump(f); y = fm.y + J.y; squash = Math.max(squash, J.squash); tilt += J.lean; }
    const ov = (S.id === 'secret' && SL && SL.grip > 0.5) ? `coin${q(SL.x, 1)}:${q(SL.y, 1)}` : '';
    const drawOv = ov ? (p) => gripHand(p, SL.x, SL.y, OUTFITS.ferryman.skin) : null;
    push('ferryman', OUTFITS.ferryman, std(B0, G, exprP, { armPose: AP(SL, SR), squash, tilt }),
      fm.x, fm.z, { ...extra, y, ground: y, ov, drawOv });
  };
  // ---------- MERCHANT ----------
  const addMerchant = (x, z, extra = {}) => {
    const B0 = base(41), G = merchGaze(f), SR = merchSR(f);
    const mode = merchantMode(f);
    const phase = mode === 'stroll' ? q(((MERCH_DIST[f] / 1.05) % 1), 2) : 0;
    const ov = (S.id === 'merchant' && SR && SR.grip > 0.5) ? `gold${q(SR.x, 1)}:${q(SR.y, 1)}` : '';
    const drawOv = ov ? (p) => gripHand(p, SR.x, SR.y, OUTFITS.merchant.skin) : null;
    push('merchant', OUTFITS.merchant, std(B0, G, merchEmo(f), { armPose: AP(null, SR), mode, phase }),
      x, z, { ...extra, ov, drawOv });
  };
  // ---------- PASSENGERS ----------
  const addPax1 = (x, z, extra = {}) => {
    const B0 = base(51);
    if (S.id === 'secret') {
      const SR = paxSR(f);
      const ov = SR.grip > 0.5 ? `coin${q(SR.x, 1)}:${q(SR.y, 1)}` : '';
      const drawOv = ov ? (p) => gripHand(p, SR.x, SR.y, OUTFITS.pax1.skin) : null;
      push('pax1', OUTFITS.pax1, std(B0, null, pax1Emo(f), { armPose: AP(null, SR) }), x, z, { ...extra, ov, drawOv });
    } else if (S.id === 'push') {
      push('pax1', OUTFITS.pax1, std(B0, null, pax1Emo(f), { armPose: AP(LAP.L, LAP.R), mode: 'sit' }), x, z, extra);
    } else {
      push('pax1', OUTFITS.pax1, std(B0, null, pax1Emo(f), {}), x, z, extra);
    }
  };
  const addPax2 = (x, z, extra = {}) => {
    const B0 = base(52);
    const seated = S.id === 'push';
    push('pax2', OUTFITS.pax2, std(B0, null, pax2Emo(f), seated ? { armPose: AP(LAP.L, LAP.R), mode: 'sit' } : {}), x, z, extra);
  };
  // ---------- ROWERS (hands ride the oar cycle) ----------
  const addRower = (id, outfit, emo, seed, pos, oarPh) => {
    const B0 = base(seed);
    const cyc = f / 30 * 2.4 + oarPh;
    const dx = Math.sin(cyc) * 15, dy = Math.cos(cyc) * 10;
    const HL = { x: 252 + dx, y: 596 + dy, grip: 0.9 }, HR = { x: 348 + dx, y: 596 + dy, grip: 0.9 };
    push(id, outfit, std(B0, null, emo(f), { armPose: AP(HL, HR), mode: 'sit', phase: q(((cyc / (Math.PI * 2)) % 1), 2) }),
      pos.x, pos.z, { y: pos.y, ground: pos.y, blob: false, yaw: id === 'rower1' ? 0.3 : -0.2 });
  };

  switch (S.id) {
    case 'drone': {
      addFerryman({ yaw: 0.4 });
      addMerchant(m.x, m.z, { yaw: -0.5 });
      addPax1(p1.x, p1.z, { yaw: 0.3 });
      break;
    }
    case 'secret': {
      addPax1(p1.x, p1.z, { yaw: 0.55 });
      addPax2(p2.x, p2.z, { yaw: 0.4 });
      addFerryman({ yaw: -0.55 });
      break;
    }
    case 'rowers': {
      addRower('rower1', OUTFITS.rower1, rower1Emo, 53, rower1At(), 1.65);
      addRower('rower2', OUTFITS.rower2, rower2Emo, 54, rower2At(), 2.95);
      addFerryman({ yaw: 0.5 });
      break;
    }
    case 'cargo': {
      const w = weddingAt(f);
      addFerryman({ yaw: 0.3, blob: false });
      const wed = [
        ['bride', OUTFITS.bride, brideEmo, 55, 0.2], ['groom', OUTFITS.groom, groomEmo, 56, -0.2], ['guest', OUTFITS.guest, guestEmo, 57, 0.4],
      ];
      wed.forEach(([id, outfit, emo, seed, yaw], i) => {
        push(id, outfit, std(base(seed), null, emo(f), { armPose: AP(LAP.L, LAP.R), mode: 'sit' }),
          w[i].x, w[i].z, { y: w[i].y, ground: w[i].y, blob: false, yaw });
      });
      break;
    }
    case 'rudder': {
      addFerryman({ yaw: 0.25, blob: false });
      break;
    }
    case 'merchant': {
      addMerchant(m.x, m.z, { yaw: -0.6 });
      addFerryman({ yaw: 0.45 });
      break;
    }
    case 'laugh': {
      addFerryman({ yaw: 0.3, blob: false });
      addMerchant(m.x, m.z, { yaw: -0.6 });
      break;
    }
    case 'dialogue': {
      addFerryman({ yaw: 0.3, blob: false });
      addMerchant(m.x, m.z, { yaw: -0.5 });
      break;
    }
    case 'cable': {
      addFerryman({ yaw: 0.3, blob: false });
      addMerchant(m.x, m.z, { yaw: -0.5 });
      break;
    }
    case 'kite': {
      addFerryman({ yaw: 0.3, blob: false });
      break;
    }
    case 'push': {
      addFerryman({ yaw: 0.3, blob: false });
      if (paxAboard(f)) {
        addPax1(p1.x, p1.z, { y: 0.36, ground: 0.36, blob: false, yaw: 0.2 });
        addPax2(p2.x, p2.z, { y: 0.36, ground: 0.36, blob: false, yaw: -0.2 });
      }
      break;
    }
    case 'hookq': case 'hook': {
      // the hook beat: both men in the foreground with the board —
      // narration only, mouths closed (END RULE).
      push('ferryman', OUTFITS.ferryman, (() => {
        const B0 = base(31), G = ferryGaze(f);
        let exprP = ferryEmo(f);
        const wk = ferryWink(f);
        if (wk > 0) exprP = T.blendFaceP(exprP, T.faceP('wink', 31), wk);
        return std(B0, G, exprP, { armPose: AP({ x: 190, y: 730, grip: 0 }, { x: 432, y: 470, grip: 0.1 }) });
      })(), 2.15, 2.2, { yaw: -0.25 });
      addMerchant(3.1, 2.9, { yaw: 0.3 });
      break;
    }
  }
  return out;
};
export const actorsAt = (f, TT) => castAt(f).map((c) => c.actor(TT));

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
