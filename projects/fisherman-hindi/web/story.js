// Shot plan for "वो मछुआरा जिसने बिना जाल के मछली पकड़ी" — fisherman-hindi
// (LIBRARY v4: speak.js dialogue performance + materials v4, camrig smooth
// tracking + solid colliders). Batch 7 topic 3, HINDI. ONE set: a harbour
// quay at night + the dark water beyond it. An old fisherman bets the
// harbour he can fill his basket with no net, no hook, no line: at night he
// hangs his lantern low over the boat and the fish leap at the light and
// land in the boat themselves. "You don't need to catch a fish. You only
// need to be where the fish wants to go."
// Voice stem: 51.611 s, 30 fps, TOTAL 1548; timings from faster-whisper
// small word alignment (words.json; tail re-aligned with output-side -ss
// after input-side -ss was found to emit EMPTY segment WAVs for this stem).
// Scene changes ONLY at clause boundaries:
//   S1 0-127    drone: harbour aerial, title board (L1 head: "बंदरगाह के...")
//   S2 128-210  mock: fishermen laugh at the old man (L1 tail)
//   S3 211-347  dialogue1: "आज रात मैं यह टोकरी भर दूँगा..." (L2)
//   S4 348-478  follow: they follow him out to laugh (L3)
//   S5 479-669  row: dark water, lantern hung low, basket in lap (L4)
//   S6 670-802  light: light trembles, fish drawn like moths (L5)
//   S7 803-881  leap1: one fish leaps at the lantern's reflection (L6)
//   S8 882-1033 leapmany: second, third, fish jump into the basket (L7)
//   S9 1034-1172 neverline: he never cast a line (L8)
//   S10 1173-1347 dialogue2: "मछली पकड़ने की ज़रूरत ही नहीं..." + basket lift (L9)
//   S11 1348-1445 hookq: baker narration begins, camera finds the board (L10 head)
//   S12 1446-1547 hook: hook board held at FULL readability to the last frame
// GRADE (FILTER_VFX_LIGHTING pack): Night Lamp throughout — deep blue
// ambient, warm pools only around the lantern + quay lamps. Signature VFX:
// lantern glow on the waves + faces, water shimmer, splash rings where fish
// leave the water, gulls circling the harbour, drifting night mist.
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

export const FPS = 30, TOTAL = 1548, DECK = 0;
export const SHOTS = [
  { id: 'drone', a: 0, b: 127, light: 'night' },
  { id: 'mock', a: 128, b: 210, light: 'night' },
  { id: 'dialogue1', a: 211, b: 347, light: 'night' },
  { id: 'follow', a: 348, b: 478, light: 'night' },
  { id: 'row', a: 479, b: 669, light: 'night' },
  { id: 'light', a: 670, b: 802, light: 'night' },
  { id: 'leap1', a: 803, b: 881, light: 'night' },
  { id: 'leapmany', a: 882, b: 1033, light: 'night' },
  { id: 'neverline', a: 1034, b: 1172, light: 'night' },
  { id: 'dialogue2', a: 1173, b: 1347, light: 'night' },
  { id: 'hookq', a: 1348, b: 1445, light: 'night' },
  { id: 'hook', a: 1446, b: 1547, light: 'night' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights / mood grades (Night Lamp, one grade all through) ----------
export const LIGHTS = {
  night: { az: 250, el: 38, sky: '#0e1a2e', ground: '#1a2233', hemi: 0.85, sun: '#a8c4e0', sunI: 1.1, fog: '#0d1626', fogNear: 40, fogFar: 320,
    skyTop: '#060d1f', skyHor: '#1c3355', sunDisc: '#e8f0f8', sunSize: 0.006, sat: 0.95, vig: 0.3, shadowExt: 24, aurora: 0, gain: '#c8d8ea',
    waterDeep: '#081826', waterShal: '#123a52', glint: '#ffd9a0' },
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
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

// ---------- staging ----------
// Quay: stone slab x -14..14, z 5..16, top y=0. Sea: everything z<5, water y=-1.2.
// Board frame stands on the quay at z=12 (hook cameras look back at it from the sea).
export const BOARD_POS = [0, 3.1, 12];
export const WATER_Y = -1.2;
export const BOAT_Y = -1.15;          // hull waterline; deck top = BOAT_Y + 0.42 = -0.73
export const DECK_Y = BOAT_Y + 0.42;
export const QUAY = { minX: -14, maxX: 14, minZ: 5, maxZ: 16 };
export const BASKET_QUAY = [-1.9, 8.1];
const OLD_QUAY = [-2.6, 7.6];
const FISH_QUAY = [[-4.6, 8.2], [-0.6, 8.6], [1.2, 7.8]];
// Boat 1 (old man): moored in the slipway gap, rows out to the dark water.
const BOAT1_KEYS = [
  [0, -2, 4.2, 0.25], [348, -2, 4.2, 0.25], [478, -1, -6, 0.1], [1547, -1, -6, 0.1],
];
// Boat 2 (fishermen): follows a little later, stops short of the old man.
const BOAT2_KEYS = [
  [0, 3.0, 4.2, -0.2], [360, 3.0, 4.2, -0.2], [478, 2.5, -3.2, 0.05], [1547, 2.5, -3.2, 0.05],
];
const boatKeys = (keys, f) => {
  let cur = keys[0];
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i][0]) {
      const a = keys[i - 1], b = keys[i], u = smooth(ramp(f, a[0], b[0]));
      return { x: lerp(a[1], b[1], u), z: lerp(a[2], b[2], u), yaw: lerp(a[3], b[3], u) };
    }
    cur = keys[i];
  }
  return { x: cur[1], z: cur[2], yaw: cur[3] };
};
export const boat1At = (f) => {
  const b = boatKeys(BOAT1_KEYS, f);
  const bob = f >= 478 ? Math.sin(f * 0.021) * 0.035 : 0;
  return { ...b, y: BOAT_Y + bob };
};
export const boat2At = (f) => {
  const b = boatKeys(BOAT2_KEYS, f);
  const bob = f >= 478 ? Math.sin(f * 0.019 + 1.7) * 0.035 : 0;
  return { ...b, y: BOAT_Y + bob };
};
// rotate a boat-local (lx,lz) offset into world space (boat yaw convention:
// local +x -> world [cos, -sin], local +z -> world [sin, cos])
const rotOff = (yaw, lx, lz) => {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return [lx * c + lz * s, -lx * s + lz * c];
};
export const boat1Local = (f, lx, lz) => {
  const b = boat1At(f), [dx, dz] = rotOff(b.yaw, lx, lz);
  return [b.x + dx, b.z + dz];
};
export const boat2Local = (f, lx, lz) => {
  const b = boat2At(f), [dx, dz] = rotOff(b.yaw, lx, lz);
  return [b.x + dx, b.z + dz];
};
// Old man: stands on the quay, boards his boat f348-380, sits and rows/watches.
const OLD_SEAT = [-0.55, 0];   // boat-local seat offset
export const oldAt = (f) => {
  if (f < 348) return { x: OLD_QUAY[0], z: OLD_QUAY[1], y: 0, mode: 'stand' };
  if (f <= 380) {
    const u = smooth(ramp(f, 348, 380));
    const [sx, sz] = boat1Local(380, OLD_SEAT[0], OLD_SEAT[1]);
    return { x: lerp(OLD_QUAY[0], sx, u), z: lerp(OLD_QUAY[1], sz, u), y: lerp(0, DECK_Y, u), mode: 'stroll' };
  }
  const [sx, sz] = boat1Local(f, OLD_SEAT[0], OLD_SEAT[1]);
  return { x: sx, z: sz, y: DECK_Y, mode: 'sit' };
};
export const oldMode = (f) => oldAt(f).mode;
// Fishermen: stand on the quay, board their boat f360-390, sit and watch.
const FISH_SEATS = [[-0.9, 0], [0, 0.3], [0.9, -0.25]];
export const fishAt = (f, i) => {
  if (f < 360) return { x: FISH_QUAY[i][0], z: FISH_QUAY[i][1], y: 0, mode: 'stand' };
  if (f <= 390) {
    const u = smooth(ramp(f, 360, 390));
    const [sx, sz] = boat2Local(390, FISH_SEATS[i][0], FISH_SEATS[i][1]);
    return { x: lerp(FISH_QUAY[i][0], sx, u), z: lerp(FISH_QUAY[i][1], sz, u), y: lerp(0, DECK_Y, u), mode: 'stroll' };
  }
  const [sx, sz] = boat2Local(f, FISH_SEATS[i][0], FISH_SEATS[i][1]);
  return { x: sx, z: sz, y: DECK_Y, mode: 'sit' };
};
// The lantern: hangs from the stern pole of boat 1. High (tucked in) until
// the hang-low beat f540-595 ("लालटेन को नाव के किनारे नीचे लटकाया"), then
// low over the water side, swinging gently on its line.
export const lanternAt = (f) => {
  const b = boat1At(f);
  const u = smooth(ramp(f, 540, 595));
  const lx = -1.0, lz = lerp(0.55, 0.85, u);
  const [dx, dz] = rotOff(b.yaw, lx, lz);
  const swing = u > 0.5 ? Math.sin(f * 0.05) * 0.05 : 0;
  return {
    x: b.x + dx, z: b.z + dz,
    y: lerp(0.1, -0.55, u),
    swing, lowered: u,
    glow: 0.55 + 0.45 * u,
  };
};
// The basket: rests on the quay, is carried aboard f348-380, rests in the
// boat (in front of the old man), and is LIFTED with effort f1242-1273
// ("भरी टोकरी उठाते हुए") and held up through the payoff line.
const BASKET_LOCAL = [0.35, 0.1];
export const basketAt = (f) => {
  if (f < 348) return { x: BASKET_QUAY[0], z: BASKET_QUAY[1], y: 0, carried: 0, resting: 1 };
  if (f <= 380) {
    const u = smooth(ramp(f, 348, 380));
    const [bx, bz] = boat1Local(380, BASKET_LOCAL[0], BASKET_LOCAL[1]);
    return { x: lerp(BASKET_QUAY[0], bx, u), y: lerp(0, DECK_Y, u) + Math.sin(u * Math.PI) * 0.25, z: lerp(BASKET_QUAY[1], bz, u), carried: 1, resting: 0 };
  }
  if (f < 1242) {
    const [bx, bz] = boat1Local(f, BASKET_LOCAL[0], BASKET_LOCAL[1]);
    return { x: bx, z: bz, y: DECK_Y, carried: 0, resting: 1 };
  }
  // lift: rises with his hands, with a small settle at the top — it rises
  // mostly IN PLACE (only a quarter of the way toward him) and to chest
  // height, so the full basket and its fish never cover his face while he
  // speaks the payoff line.
  const u = smooth(ramp(f, 1242, 1273));
  const settle = f > 1273 ? Math.sin((f - 1273) * 0.35) * 0.02 * Math.exp(-(f - 1273) / 14) : 0;
  const [bx, bz] = boat1Local(f, BASKET_LOCAL[0], BASKET_LOCAL[1]);
  const [ox, oz] = boat1Local(f, OLD_SEAT[0], OLD_SEAT[1]);
  return {
    x: lerp(bx, ox, u * 0.25), z: lerp(bz, oz, u * 0.25),
    y: lerp(DECK_Y, DECK_Y + 0.55, u) + settle, carried: 1, resting: 0,
  };
};
// ---------- the fish: six ballistic leaps, each lands and STAYS ----------
// take = water point the fish leaves; land = 'boat' (deck) or 'basket'.
const FISH = [
  { take: [-3.2, -8.2], land: 'boat', a: 820, b: 867 },
  { take: [0.8, -8.5], land: 'boat', a: 885, b: 920 },
  { take: [-2.8, -8.8], land: 'basket', a: 930, b: 965 },
  { take: [1.2, -8.0], land: 'basket', a: 975, b: 1000 },
  { take: [-0.5, -9.2], land: 'basket', a: 995, b: 1020 },
  { take: [2.0, -8.6], land: 'basket', a: 1015, b: 1033 },
];
export const FISH_TAKE = FISH.map((d) => d.take);
const BASKET_FISH_OFF = [[-0.08, 0.05], [0.09, -0.03], [0.0, 0.1], [0.1, 0.08]];
export const fishStatesAt = (f) => {
  const out = [];
  for (let i = 0; i < FISH.length; i++) {
    const d = FISH[i];
    if (f < d.a - 6) { out.push({ vis: 0 }); continue; }
    if (f >= d.a && f <= d.b) {
      const u = (f - d.a) / (d.b - d.a);
      let lx, lz, ly;
      if (d.land === 'boat') {
        const [wx, wz] = boat1Local(f, i === 0 ? -0.15 : 0.55, i === 0 ? -0.2 : 0.25);
        lx = wx; lz = wz; ly = DECK_Y;
      } else {
        const bk = basketAt(f);
        lx = bk.x; lz = bk.z; ly = DECK_Y;
      }
      const x = lerp(d.take[0], lx, u), z = lerp(d.take[1], lz, u);
      const y = lerp(WATER_Y, ly, u) + 4 * u * (1 - u) * 1.7;
      const yaw = Math.atan2(lx - d.take[0], lz - d.take[1]);
      out.push({ vis: 1, x, y, z, yaw, pitch: (1 - 2 * u) * 0.9, landed: 0 });
      continue;
    }
    // landed: rests where it fell and stays
    if (d.land === 'boat') {
      const [wx, wz] = boat1Local(f, i === 0 ? -0.15 : 0.55, i === 0 ? -0.2 : 0.25);
      out.push({ vis: 1, x: wx, y: DECK_Y + 0.09, z: wz, yaw: boat1At(f).yaw + (i === 0 ? 0.4 : -0.3), pitch: 0, landed: 1 });
    } else {
      const bk = basketAt(f), off = BASKET_FISH_OFF[i - 2] || [0, 0];
      const wig = Math.max(0, 1 - (f - d.b) / 40) * 0.05;
      out.push({
        vis: 1, x: bk.x + off[0] + Math.sin(f * 0.5 + i) * wig, y: bk.y + 0.16, z: bk.z + off[1],
        yaw: 0.3 * i, pitch: 0, landed: 1,
      });
    }
  }
  return out;
};
const segMax = (f, segs) => {
  let s = 0;
  for (const [a, b, c, d, peak] of segs) if (f >= a && f <= d) s = Math.max(s, peak * (f < b ? smooth(ramp(f, a, b)) : f <= c ? 1 : 1 - smooth(ramp(f, c, d))));
  return s;
};
// splash rings where each fish LEAVES the water; droplet burst where it lands
export const splashAt = (f) => {
  const rings = FISH.map((d) => segMax(f, [[d.a, d.a + 2, d.a + 8, d.a + 16, 1]]));
  const lands = FISH.map((d) => segMax(f, [[d.b - 2, d.b, d.b + 4, d.b + 14, 1]]));
  return { rings, lands };
};
export const basketFishCount = (f) => FISH.filter((d) => d.land === 'basket' && f > d.b).length;

// ---------- hero / focus ----------
const FOCUS = {
  drone: () => [0, 1.2, 6],
  mock: () => { const o = oldAt(170); return [o.x, 1.2, o.z]; },
  dialogue1: () => { const o = oldAt(280); return [o.x, 1.3, o.z]; },
  follow: () => { const b = boat1At(413); return [b.x, -0.4, b.z]; },
  row: () => { const b = boat1At(574); return [b.x, -0.4, b.z]; },
  light: () => { const l = lanternAt(736); return [l.x, -0.5, l.z]; },
  leap1: () => { const b = boat1At(842); return [b.x, -0.4, b.z]; },
  leapmany: () => { const bk = basketAt(957); return [bk.x, -0.4, bk.z]; },
  neverline: () => { const o = oldAt(1103); return [o.x, 0.6, o.z]; },
  dialogue2: () => { const o = oldAt(1260); return [o.x, 0.7, o.z]; },
  hookq: () => BOARD_POS, hook: () => BOARD_POS,
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id]();

// ---------- cameras: EVERY shot is a camrig track on a subject ----------
const boat1Pos = (f) => { const b = boat1At(f); return [b.x, b.y, b.z]; };
const oldPos = (f) => { const o = oldAt(f); return [o.x, o.y, o.z]; };
const lanternPos = (f) => { const l = lanternAt(f); return [l.x, l.y, l.z]; };
const basketPos = (f) => { const bk = basketAt(f); return [bk.x, bk.y, bk.z]; };
const bezierCam = (P, L, a, b, fov0, fov1) => (f) => {
  const u = M.smooth(ramp(f, a, b));
  const w0 = (1 - u) ** 3, w1 = 3 * (1 - u) ** 2 * u, w2 = 3 * (1 - u) * u * u, w3 = u ** 3;
  const mix = (Q) => [0, 1, 2].map((j) => w0 * Q[0][j] + w1 * Q[1][j] + w2 * Q[2][j] + w3 * Q[3][j]);
  return { pos: mix(P), look: mix(L), fov: lerp(fov0, fov1, u), roll: 0 };
};
const RIG_BY_ID = {
  drone: { cut: 'hard', raw: bezierCam(
    [[19, 12, 25], [14, 8.5, 22], [8, 5, 14], [5, 5, 0]],
    [[0, 2.5, 2], [0, 2, 0], [0, 2.6, 9], [0, 2.9, 11.5]], 0, 127, 44, 44) },
  mock: { cut: 'hard', raw: pushInCam({ subject: oldPos, a: 128, b: 210, d0: 5.6, d1: 4.3, h0: 1.55, h1: 1.45, lookOff: [0, 1.35, 0], fov0: 40, fov1: 34,
    dir: () => [0.6, 0.7] }) },
  dialogue1: { cut: 'hard', raw: pushInCam({ subject: oldPos, a: 211, b: 347, d0: 3.4, d1: 2.75, h0: 1.58, h1: 1.5, lookOff: [0, 1.45, 0], fov0: 32, fov1: 28,
    dir: () => [0.5, 0.85] }) },
  follow: { cut: 'hard', raw: keysCam({ keys: [
    { f: 348, pos: [-6, 3.5, 14], look: [-1, 0.5, 6], fov: 44 },
    { f: 478, pos: [-6, 3, 8], look: [-1, -0.5, -2], fov: 40, ease: 'surge' }] }) },
  // SEA SHOTS: all cameras sit SOUTH-WEST of the hero boat (dir x < 0) —
  // the fishermen's boat (NE of it) can then never stand between the
  // camera and the hero, which filled the frame with a giant face at f842.
  row: { cut: 'hard', raw: pushInCam({ subject: boat1Pos, a: 479, b: 669, d0: 6.0, d1: 4.6, h0: 1.4, h1: 1.0, lookOff: [0, 0.1, 0], fov0: 38, fov1: 33,
    dir: () => [-0.7, 0.7] }) },
  light: { cut: 'hard', raw: keysCam({ keys: [
    { f: 670, pos: [-4.5, 2.2, -0.5], look: [-1, -0.6, -6], fov: 40 },
    { f: 802, pos: [-3.6, 1.8, -0.5], look: [-1, -0.7, -6.5], fov: 36, ease: 'surge' }] }) },
  // LEAP SHOTS: cameras sit SOUTH of the hero boat, looking north — the
  // fish arcs run from the dark water (north) toward the boat, so the leaps
  // cross the frame toward the camera instead of sliding out the side.
  leap1: { cut: 'hard', raw: staticTrackCam({ pos: [-1.2, 1.5, 2.0], subject: boat1Pos, lookOff: [-0.7, 0.4, -0.6], fov: 38 }) },
  leapmany: { cut: 'hard', raw: keysCam({ keys: [
    { f: 882, pos: [-1.0, 2.0, 0.8], look: [-1, -0.4, -6], fov: 40 },
    { f: 1033, pos: [-0.8, 1.8, 0.4], look: [-1, -0.4, -6], fov: 37, ease: 'surge' }] }) },
  neverline: { cut: 'hard', raw: pushInCam({ subject: oldPos, a: 1034, b: 1172, d0: 4.2, d1: 3.4, h0: 1.3, h1: 1.1, lookOff: [0, 1.5, 0], fov0: 36, fov1: 32,
    dir: () => [0.3, 0.85] }) },
  dialogue2: { cut: 'hard', raw: pushInCam({ subject: oldPos, a: 1173, b: 1347, d0: 3.6, d1: 3.3, h0: 1.2, h1: 1.0, lookOff: [0, 1.5, 0], fov0: 34, fov1: 31,
    dir: () => [0, 1] }) },
  hookq: { cut: 'blend', blend: 10, raw: keysCam({ keys: [
    { f: 1348, pos: [5.5, 2.6, -1], look: [-0.5, 0.5, -4], fov: 40 },
    { f: 1445, pos: [6.5, 3.4, -1.5], look: [0, 3.05, 12], fov: 40, ease: 'surge' }] }) },
  hook: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1446, pos: [6.5, 3.4, -1.5], look: [0, 3.05, 12], fov: 40 },
    { f: 1547, pos: [6.3, 3.45, -1.3], look: [0, 3.05, 12], fov: 39, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: 867, a: 0.03 }, { f: 965, a: 0.03 }, { f: 1273, a: 0.03 }],
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
  if (['dialogue1', 'dialogue2', 'leap1', 'leapmany', 'neverline'].includes(S.id)) cinf = 3.6;
  if (S.id === 'hook') cinf = 3.0;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f), ln = lanternAt(f), sp = splashAt(f);
  const W = {
    boardTitle: 0, boardHook: 0,
    boat1X: boat1At(f).x, boat1Z: boat1At(f).z, boat1Y: boat1At(f).y, boat1Yaw: boat1At(f).yaw,
    boat2X: boat2At(f).x, boat2Z: boat2At(f).z, boat2Y: boat2At(f).y, boat2Yaw: boat2At(f).yaw,
    lanternX: ln.x, lanternY: ln.y, lanternZ: ln.z, lanternGlow: ln.glow, lanternSwing: ln.swing,
    basketX: basketAt(f).x, basketY: basketAt(f).y, basketZ: basketAt(f).z,
    basketFish: basketFishCount(f),
    splashRings: sp.rings, splashLands: sp.lands,
    shimmerK: S.id === 'light' || S.id === 'leap1' || S.id === 'leapmany' ? 1 : 0.5,
    mistK: 0.4,
  };
  // Title board: shown only at the END of the drone descent (f100-126),
  // once the camera has swung onto the quay — earlier in the descent the
  // board is off-frame (boardverify: textOUT) and a fade there wastes it.
  if (S.id === 'drone') W.boardTitle = smooth(ramp(f, 100, 109)) * (1 - smooth(ramp(f, 119, 126)));
  // Hook board: fade in only once the hookq camera has nearly settled on
  // the board frame (f1422-1440) — ramping during the pan reads PARTIAL.
  if (S.id === 'hookq') W.boardHook = smooth(ramp(f, 1422, 1440));
  if (S.id === 'hook') W.boardHook = 1;   // held at FULL opacity to the literal last frame
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  const sp = splashAt(f);
  const splashRate = Math.max(...sp.lands, 0) + Math.max(...sp.rings, 0);
  return { smokeRate: 0.12, dustRate: 0.02, splashRate, steamRate: 0, shimmerRate: S.id === 'light' ? 0.8 : 0.35, grey: 0 };
};
export const fxAt = () => [];

// ---------- cast (single source for actors AND colliders) ----------
const TINT = { night: '#c8d8ea' };
const tintFor = (S) => TINT[S.light] || '#ffffff';
export const OUTFITS = {
  oldman: { jacket: '#7a6a52', pants: '#4a4238', boots: '#2c2118', hat: 'hair', hair: '#c8c0b0', skin: '#c98a5a', moustache: '#e8e0d0' },
  fisher1: { jacket: '#5d7a8a', pants: '#4a4238', boots: '#2c2118', hat: 'cap', cap: '#8a2f2a', skin: '#c98a5a' },
  fisher2: { jacket: '#8a7a4a', pants: '#3d4a42', boots: '#2c2118', hat: 'hair', hair: '#241a12', skin: '#a06a3c', moustache: '#2c1e12' },
  fisher3: { jacket: '#6a5a3a', pants: '#3d3a30', boots: '#2c2118', hat: 'cap', cap: '#3a5a6a', skin: '#a06a3c' },
};
export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, y, z, extra = {}) => out.push({ id, x, y, z, r: 0.32, ground: y,
    actor: (T) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x, y, z, ground: y, tint, ...extra }) });
  const old = oldAt(f), oBase = { expr: 'smile', mode: old.mode, blink: blinkAt(f, 31), seed: 31 };
  const fishers = [0, 1, 2].map((i) => fishAt(f, i));
  const FOUT = [OUTFITS.fisher1, OUTFITS.fisher2, OUTFITS.fisher3];
  const fBase = (i) => ({ expr: 'smile', mode: fishers[i].mode, blink: blinkAt(f, 51 + i), seed: 51 + i });
  switch (S.id) {
    case 'drone': {
      std('oldman', OUTFITS.oldman, { ...oBase }, old.x, old.y, old.z, { yaw: 0.5 });
      fishers.forEach((fs, i) => std('fisher' + (i + 1), FOUT[i], { ...fBase(i) }, fs.x, fs.y, fs.z, { yaw: -0.3 + i * 0.2 }));
      break;
    }
    case 'mock': {
      std('oldman', OUTFITS.oldman, { ...oBase, expr: 'smile' }, old.x, old.y, old.z, { yaw: 0.6 });
      fishers.forEach((fs, i) => std('fisher' + (i + 1), FOUT[i], { ...fBase(i), expr: 'laugh', prop: i === 0 ? ['point', 0.55] : null }, fs.x, fs.y, fs.z, { yaw: -0.6 + i * 0.25 }));
      break;
    }
    case 'dialogue1': {
      // THE bet line: the old man PERFORMS it — mouth driven by the stem
      // inside the two speak segments; the tag "बूढ़े ने कहा" sits OUTSIDE
      // both segments, so his mouth is firmly closed there; the fishermen
      // only listen (mouths never open).
      std('oldman', OUTFITS.oldman, { mode: 'stand', blink: blinkAt(f, 31), seed: 31, look: 0.15, ...speakFace('smile', f) }, old.x, old.y, old.z, { yaw: 0.5 });
      fishers.forEach((fs, i) => std('fisher' + (i + 1), FOUT[i], { ...fBase(i), expr: 'neutral' }, fs.x, fs.y, fs.z, { yaw: -0.5 }));
      break;
    }
    case 'follow': {
      std('oldman', OUTFITS.oldman, { ...oBase, mode: old.mode }, old.x, old.y, old.z, { yaw: 0.3, blob: false });
      fishers.forEach((fs, i) => std('fisher' + (i + 1), FOUT[i], { ...fBase(i), expr: i === 0 ? 'laugh' : 'smile' }, fs.x, fs.y, fs.z, { yaw: -0.3, blob: false }));
      break;
    }
    case 'row': {
      std('oldman', OUTFITS.oldman, { ...oBase, mode: 'sit', headTilt: 0.05 }, old.x, old.y, old.z, { yaw: 0.3, blob: false });
      fishers.forEach((fs, i) => std('fisher' + (i + 1), FOUT[i], { ...fBase(i), expr: 'neutral' }, fs.x, fs.y, fs.z, { yaw: -0.3, blob: false }));
      break;
    }
    case 'light': {
      std('oldman', OUTFITS.oldman, { ...oBase, mode: 'sit', expr: 'smile' }, old.x, old.y, old.z, { yaw: 0.3, blob: false });
      fishers.forEach((fs, i) => std('fisher' + (i + 1), FOUT[i], { ...fBase(i), expr: 'neutral' }, fs.x, fs.y, fs.z, { yaw: -0.3, blob: false }));
      break;
    }
    case 'leap1': {
      std('oldman', OUTFITS.oldman, { ...oBase, mode: 'sit', expr: f >= 850 ? 'shock' : 'smile' }, old.x, old.y, old.z, { yaw: 0.3, blob: false });
      fishers.forEach((fs, i) => std('fisher' + (i + 1), FOUT[i], { ...fBase(i), expr: 'shock' }, fs.x, fs.y, fs.z, { yaw: -0.3, blob: false }));
      break;
    }
    case 'leapmany': {
      std('oldman', OUTFITS.oldman, { ...oBase, mode: 'sit', expr: 'grin' }, old.x, old.y, old.z, { yaw: 0.3, blob: false });
      fishers.forEach((fs, i) => std('fisher' + (i + 1), FOUT[i], { ...fBase(i), expr: 'shock' }, fs.x, fs.y, fs.z, { yaw: -0.3, blob: false }));
      break;
    }
    case 'neverline': {
      std('oldman', OUTFITS.oldman, { ...oBase, mode: 'sit', expr: 'smile' }, old.x, old.y, old.z, { yaw: 0.3, blob: false });
      fishers.forEach((fs, i) => std('fisher' + (i + 1), FOUT[i], { ...fBase(i), expr: 'smile' }, fs.x, fs.y, fs.z, { yaw: -0.3, blob: false }));
      break;
    }
    case 'dialogue2': {
      // THE payoff line: performed with the basket lift — mouth driven by
      // the stem inside the two speak segments; the tag ("उसने भरी टोकरी
      // उठाते हुए कहा") sits OUTSIDE both segments, mouth closed there.
      std('oldman', OUTFITS.oldman, { mode: 'sit', blink: blinkAt(f, 31), seed: 31, look: 0.15, ...speakFace('smile', f) }, old.x, old.y, old.z, { yaw: 0.3, blob: false });
      fishers.forEach((fs, i) => std('fisher' + (i + 1), FOUT[i], { ...fBase(i), expr: 'shock' }, fs.x, fs.y, fs.z, { yaw: -0.3, blob: false }));
      break;
    }
    case 'hookq': case 'hook': break;
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity: statics, dynamics, ground (LIBRARY v3 gate data) ----------
// Boats are DYNAMIC obbs (they move); occupants share the boat's group so
// rider-vs-boat never reports. Quay, walls, buildings, posts are statics.
export const STATICS = [
  // NOTE: the quay slab itself is NOT a collider — the cast stands ON it
  // (a ground plane is not an obstacle); only raised edges/objects are.
  SOL.aabb(-14, -4, 4.4, 5.2, { h: 0.9, id: 'seawallW' }),
  SOL.aabb(5, 14, 4.4, 5.2, { h: 0.9, id: 'seawallE' }),
  SOL.aabb(-14, 14, 14.5, 16.5, { h: 6, id: 'harbour-buildings' }),
  SOL.circle(BOARD_POS[0] - 2.1, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  SOL.circle(BOARD_POS[0] + 2.1, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  SOL.circle(-8.5, 13.5, 0.42, { h: 0.9, id: 'barrel1' }),
  SOL.circle(-7.6, 13.2, 0.42, { h: 0.9, id: 'barrel2' }),
  SOL.obb(8.5, 13.8, 0.2, 0.45, 0.45, { h: 0.7, id: 'crate1' }),
  SOL.circle(-11, 7.5, 0.12, { h: 3.4, id: 'lamppostW' }),
  SOL.circle(11, 7.5, 0.12, { h: 3.4, id: 'lamppostE' }),
  SOL.circle(-12.5, 11, 0.5, { h: 1.2, id: 'mooringpost' }),
];
export const WORLD = SOL.makeWorld(STATICS);
export const dynamicsAt = (f) => {
  const out = [];
  const b1 = boat1At(f), b2 = boat2At(f);
  out.push(SOL.obb(b1.x, b1.z, b1.yaw, 1.3, 0.6, { kind: 'dynamic', id: 'boat1', group: 'boat1' }));
  out.push(SOL.obb(b2.x, b2.z, b2.yaw, 1.6, 0.65, { kind: 'dynamic', id: 'boat2', group: 'boat2' }));
  for (const a of castAt(f)) {
    // occupants ride their boat: same group as the boat they board — the
    // group applies from the FIRST boarding step (f348 / f360), because
    // the step down into the hull already overlaps the boat's plan-view
    // obb for 2 frames before the actor's y drops below deck level.
    let group = '';
    if (a.id === 'oldman' && f >= 348) group = 'boat1';
    else if (a.id.startsWith('fisher') && f >= 360) group = 'boat2';
    out.push(SOL.circle(a.x, a.z, a.r, { kind: 'dynamic', id: a.id, group }));
  }
  return out;
};
export const groundItemsAt = (f) => {
  const items = [];
  const bk = basketAt(f);
  if (bk.resting) items.push({ id: 'basket', y: bk.y, ground: bk.y < -0.5 ? DECK_Y : 0, maxHover: 0.03 });
  for (const a of castAt(f)) items.push({ id: a.id, y: a.y, ground: a.ground, maxHover: 0.06 });
  return items;
};
