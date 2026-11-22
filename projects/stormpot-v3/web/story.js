// stormpot-hindi — "मिट्टी के घड़े में तूफ़ान बंद करने वाला लड़का"
// Salted Mine V3 + FULL UPGRADE (real storm system, real sunlight,
// volume characters, speaking = moving, real object physics) PLUS
// Abid's DYNAMIC CAMERA + DYNAMIC SCENE upgrade (2026-11-21):
// combined push-in + lateral arc moves, a drone-dive opening, whip
// pans inside lines, a SPEED RAMP on the lid-pop payoff, foreground
// parallax, no shot > ~3.5 s without a reframe.
// Voice stem: voice_final.wav — N1 (Muse TTS Confident Chime
// casper_1_25x, single narrator, speed 118, hi), EXACTLY 60.000 s,
// 1800 frames @30. Beat map = timing.json (parent-supplied phrase
// boundaries); cuts ONLY on clause boundaries: 17 shots = 17 lines.
// The ONE performed line is L12 (the boy); L11 is its lead-in. L8 is
// the mukhiya's challenge as NARRATED quotation — his mouth stays
// shut (single-narrator stem); he gestures instead. END RULE: the
// last quarter is narration + board only, all mouths closed.
// TWO sets in one world: the VILLAGE street around x=0 (storm day,
// wind from the north -z blowing toward +z) and the FAIR ground at
// x=+80 (next day, Sunny Pop). The storm set's fog swallows the
// fair set and vice versa. The clay pot (ghada) is the hero prop:
// carried -> held to the wind -> set down shaking -> sealed with a
// lid + rope -> carried to the fair -> opened: the lid pops (SPEED
// RAMP f906-918), the trapped gust tears the mukhiya's turban off
// (f940) and it snags in the fair tree (f1012).
import { M, blinkAt, q, clamp, lerp, lerp3, ramp, kf } from './motion.js';
import { buildRig, pushInCam, keysCam } from './camrig.js';
import { emoTrack, lifeAt, gestureAt, stridePh } from './body.js';
import * as SOL from './solid.js';
import * as T from './toon.js';
import * as SPK from './speak.js';
import { SPEAK_DATA } from './speakdata.js';
const { smooth } = M;

export const FPS = 30, TOTAL = 1800;
export const SHOTS = [
  { id: 'storm',     a: 0,    b: 95,   light: 'storm' }, // L1  the storm hits; windows slam; the dive begins
  { id: 'run',       a: 96,   b: 197,  light: 'storm' }, // L2  the boy runs INTO the storm with the pot
  { id: 'shout',     a: 198,  b: 302,  light: 'storm' }, // L3  villagers shout — whip pans boy <-> doorways
  { id: 'fill',      a: 303,  b: 425,  light: 'storm' }, // L4  INSERT: pot mouth to the wind, filling
  { id: 'swirl',     a: 426,  b: 538,  light: 'storm' }, // L5  wind swirls inside; the pot shakes
  { id: 'seal',      a: 539,  b: 632,  light: 'storm' }, // L6  lid SLAM (f560) + rope tied tight
  { id: 'fair',      a: 633,  b: 738,  light: 'day' },   // L7  next day: drone sweep over the fair; the bet
  { id: 'bet',       a: 739,  b: 815,  light: 'day' },   // L8  the mukhiya's challenge (narrated; he gestures)
  { id: 'open',      a: 816,  b: 924,  light: 'day' },   // L9  rope untied; LID POP f906 (speed ramp)
  { id: 'gust',      a: 925,  b: 1058, light: 'day' },   // L10 the gust bursts out; turban flies to the tree
  { id: 'leadin',    a: 1059, b: 1101, light: 'day' },   // L11 "तब लड़का मुस्कुराकर बोला —"
  { id: 'line',      a: 1102, b: 1252, light: 'day' },   // L12 THE LINE (performed, speak.js)
  { id: 'laugh',     a: 1253, b: 1363, light: 'day' },   // L13 papers fly, a hat flies, the crowd rolls
  { id: 'payoff',    a: 1364, b: 1478, light: 'day' },   // L14 the mukhiya pays 100 and fetches his turban
  { id: 'kids',      a: 1479, b: 1593, light: 'day' },   // L15 every kid now runs with a pot
  { id: 'moral',     a: 1594, b: 1702, light: 'day' },   // L16 nobody lets a storm leave empty-handed
  { id: 'hookboard', a: 1703, b: 1799, light: 'day' },   // L17 hook board finale
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
export const BOARD_POS = [78.65, 2.45, -11.2];
export const FC = 80; // fair-centre x offset

// Action beats (frames; anchored to timing.json phrase boundaries
// and the narration's word flow)
export const SLAM_LID = 560;            // L6 "ढक्कन मारा"
export const POP = 906;                 // L9 "ढक्कन उठाया" — the lid pops
export const RAMP_A = 906, RAMP_B = 918; // SPEED RAMP zone (0.5x for 12f)
export const TURB_OFF = 940;            // L10 the turban leaves the mukhiya's head
export const TURB_LAND = 1012;          // L10 it snags in the tree
export const TURB_DOWN0 = 1436, TURB_DOWN1 = 1468; // L14 he fetches it down
// SPEED RAMP time warp: picture time for the lid flight runs at
// 0.5x through f906-918, then snaps back (net -6 frames after).
export const rampWarp = (f) => f < RAMP_A ? f : f <= RAMP_B ? RAMP_A + (f - RAMP_A) * 0.5 : f - (RAMP_B - RAMP_A) / 2;

// ---------- lights: Storm Flash -> Sunny Pop, late gold ----------
export const LIGHTS = {
  storm: { az: 205, el: 34, sky: '#b0a58e', ground: '#5c4a33', hemi: 1.28, sun: '#ecdfc6', sunI: 1.36, fog: '#a79b88', fogNear: 22, fogFar: 125,
    skyTop: '#46688c', skyHor: '#cdbb9c', sunDisc: '#f7ecd4', sunSize: 0.006, sat: 1.10, vig: 0.13, shadowExt: 30, aurora: 0, gain: '#f6ecd6',
    waterDeep: '#274b63', waterShal: '#5d84a0', glint: '#f2e6c8', lift: '#171009' },
  day: { az: 118, el: 38, sky: '#bfe0f2', ground: '#77813f', hemi: 1.15, sun: '#fff2d8', sunI: 1.38, fog: '#bcd9e8', fogNear: 30, fogFar: 165,
    skyTop: '#4ea3dd', skyHor: '#a9d3ec', sunDisc: '#fff6d8', sunSize: 0.012, sat: 1.17, vig: 0.13, shadowExt: 30, aurora: 0, gain: '#fff4e0',
    waterDeep: '#2a6a94', waterShal: '#6db3d6', glint: '#fff3cf', lift: '#171009' },
  gold: { az: 118, el: 38, sky: '#cfe0d8', ground: '#77813f', hemi: 1.05, sun: '#ffd9a0', sunI: 1.3, fog: '#e8dcc4', fogNear: 30, fogFar: 165,
    skyTop: '#4f7fc0', skyHor: '#ffdfae', sunDisc: '#fff3cf', sunSize: 0.013, sat: 1.14, vig: 0.13, shadowExt: 30, aurora: 0, gain: '#ffe9c4',
    waterDeep: '#2e6f8e', waterShal: '#7fc4d8', glint: '#ffe9b0', lift: '#1a120a' },
};
const mixHex = (a, b, u) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(lerp(v, pb[i], u)).toString(16).padStart(2, '0')).join('');
};
export const goldK = (f) => smooth(ramp(f, 1594, 1666));
// exposure choreography: the fair dims a breath before the pop,
// then the gust hits with a lift of light; the storm day pulses
// darker as each gust front passes.
const dipK = (f) => {
  let d = 1;
  if (f >= 878 && f < POP) d = 0.93 + 0.07 * smooth(ramp(f, 896, POP));
  if (f >= POP && f < 950) d = Math.max(d, 1.05 - 0.05 * smooth(ramp(f, 918, 950)));
  return d;
};
export const lightFor = (S, f) => {
  const base = LIGHTS[S.light] || LIGHTS.day, G = LIGHTS.gold, u = goldK(f);
  const out = { ...base };
  if (u > 0.001) {
    for (const k of ['hemi', 'sunI', 'sat', 'vig', 'sunSize']) out[k] = lerp(base[k], G[k], u);
    for (const k of ['sky', 'ground', 'sun', 'fog', 'skyTop', 'skyHor', 'sunDisc', 'gain', 'waterDeep', 'waterShal', 'glint', 'lift']) out[k] = mixHex(base[k], G[k], u);
  }
  const d = dipK(f);
  out.sunI = out.sunI * d; out.hemi = out.hemi * (0.35 + 0.65 * d);
  return out;
};

// ---------- helpers ----------
const track = (keys) => (f) => {
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i][0]) {
      const [f0, v0] = keys[i - 1], [f1, v1] = keys[i];
      return lerp(v0, v1, smooth(clamp((f - f0) / (f1 - f0))));
    }
  }
  return keys[keys.length - 1][1];
};
const win = (f, a, b, peak = 1) => smooth(ramp(f, a, a + 12)) * (1 - smooth(ramp(f, b - 12, b))) * peak;

// ---------- THE WIND: one living system ----------
// Gust strength 0..1. Storm day: a high base with slow swells and
// sharp gust fronts (never a uniform wave). The fill beats peak.
// Fair day: a light breeze — until the pot opens and the trapped
// gust spikes through the scene and dies away.
export const windK = (f) => {
  const S = shotAt(f);
  if (S.light === 'storm') {
    let w = 0.52 + 0.16 * Math.sin(f * 0.021) + 0.10 * Math.sin(f * 0.047 + 1.7);
    w += 0.22 * win(f, 300, 430);          // filling: the wind leans in
    w += 0.14 * win(f, 426, 540);          // swirling inside the pot
    w -= 0.18 * win(f, 545, 632);          // sealed: the street breathes out
    return clamp(w, 0.25, 0.97);
  }
  let w = 0.07 + 0.03 * Math.sin(f * 0.03 + 2);
  if (f >= POP) w += 0.93 * Math.exp(-(f - POP) / 55) * (1 - smooth(ramp(f, 1240, 1260)));
  return clamp(w, 0.03, 1);
};
// the local burst along the gust's path (pot -> mukhiya -> tree)
export const gustK = (f) => f < POP ? 0 : Math.exp(-(f - POP) / 48);
// the pot's shake as it fills and strains against the seal
export const potShakeK = (f) => {
  let s = 0;
  s += 0.35 * win(f, 303, 426);
  s += 0.8 * win(f, 426, 545);
  s += 0.45 * win(f, 545, 640);
  s += 0.3 * win(f, 816, POP);
  if (f >= POP && f < POP + 20) s += (1 - (f - POP) / 20) * 0.9;
  return clamp(s, 0, 1);
};
// rope wrap 0..1 (ties f575-625, unties f838-878)
export const ropeK = (f) => {
  if (f < 575) return 0;
  if (f < 838) return smooth(ramp(f, 575, 625));
  if (f < 878) return 1 - smooth(ramp(f, 838, 878));
  return 0;
};
// lightning: two strikes on the storm day (ink-shader flash)
export const flashAt = (f) => {
  let fl = 0;
  for (const t0 of [118, 470]) if (f >= t0 && f <= t0 + 4) fl = Math.max(fl, (t0 === 118 ? 0.34 : 0.27) * (1 - (f - t0) / 5));
  return fl;
};

// ---------- positions ----------
export const boyPosAt = (f) => {
  const id = shotAt(f).id;
  if (id === 'storm' || id === 'run') {
    const u = clamp(f / 197), dist = 4.9 * u + 0.22;
    return { x: 0, z: lerp(8.4, 3.5, smooth(u)), ph: stridePh(0, dist, 0.8), mode: 'march' };
  }
  if (id === 'shout') return { x: 0, z: 3.4, ph: 0, mode: 'stand' };
  if (id === 'fill') return { x: 0.55, z: 3.05, ph: 0, mode: 'stand' };
  if (id === 'swirl' || id === 'seal') return { x: 0.62, z: 2.85, ph: 0, mode: 'kneel' };
  if (id === 'open') return { x: FC - 0.65, z: 2.45, ph: 0, mode: 'kneel' };
  if (id === 'hookboard') return { x: FC - 0.95, z: -4.5, ph: 0, mode: 'stand' };
  if (id === 'kids') return { x: FC - 1.2, z: 3.3, ph: 0, mode: 'stand' };
  return { x: FC - 0.85, z: 2.75, ph: 0, mode: 'stand' };
};
export const mukhPosAt = (f) => {
  const id = shotAt(f).id;
  if (id === 'payoff') {
    if (f < 1395) return { x: FC + 1.35, z: 2.7, ph: 0, mode: 'stand' };
    if (f < 1445) { const u = smooth(ramp(f, 1395, 1445)), dist = 7.6 * u; return { x: lerp(FC + 1.35, FC + 6.6, u), z: lerp(2.7, -3.2, u) + Math.sin(u * Math.PI) * 1.3, ph: stridePh(0, dist, 0.85), mode: 'stroll' }; }
    return { x: FC + 6.6, z: -3.2, ph: 0, mode: 'stand' };
  }
  if (id === 'moral') return { x: FC + 2.2, z: 3.6, ph: 0, mode: 'stand' };
  if (id === 'hookboard') return { x: FC + 0.7, z: -5.3, ph: 0, mode: 'stand' };
  if (id === 'line') return { x: FC + 1.6, z: 2.2, ph: 0, mode: 'stand' };
  return { x: FC + 1.35, z: 2.7, ph: 0, mode: 'stand' };
};
// the clay pot: carried -> held to the wind -> grounded, shaking
// -> sealed -> at the fair centre -> opened (stays, spent)
export const potStateAt = (f) => {
  const id = shotAt(f).id;
  const b = boyPosAt(f);
  if (id === 'storm' || id === 'run' || id === 'shout') {
    const bob = Math.abs(Math.sin(b.ph * Math.PI * 2)) * 0.05;
    return { mode: 'hands', x: b.x + 0.38, y: 0.9 + bob, z: b.z - 0.58, tilt: 0.18 };
  }
  if (id === 'fill') return { mode: 'held', x: 0, y: 0.98, z: 2.45, tilt: 0.1 };
  if (id === 'swirl' || id === 'seal') return { mode: 'ground', x: 0, y: 0, z: 2.3, tilt: 0 };
  return { mode: 'fair', x: FC, y: 0, z: 1.5, tilt: 0 };
};
// the lid: in the boy's hand -> slammed on (f560) -> sealed ->
// POPS at f906 (speed-ramped flight) -> lands beside the pot
export const lidStateAt = (f) => {
  const pot = potStateAt(f);
  if (f < SLAM_LID) { const b = boyPosAt(f); return { mode: 'hand', x: b.x - 0.48, y: 0.82, z: b.z - 0.25, spin: 0 }; }
  if (f < POP) return { mode: 'on', x: pot.x, y: (pot.mode === 'held' ? pot.y + 0.6 : 0.6), z: pot.z, spin: 0 };
  const w = rampWarp(f);
  if (w < POP + 34) {
    const u = clamp((w - POP) / 34);
    const p = lerp3([FC, 0.62, 1.5], [FC + 0.85, 0.04, 2.35], u);
    p[1] += Math.sin(u * Math.PI) * 1.5;
    return { mode: 'fly', x: p[0], y: p[1], z: p[2], spin: u * 9 };
  }
  return { mode: 'ground', x: FC + 0.85, y: 0.03, z: 2.35, spin: 5.2 };
};
// the mukhiya's turban: on his head -> torn off by the gust ->
// a real arc to the tree -> hanging -> fetched down -> back on
export const turbanStateAt = (f) => {
  const m = mukhPosAt(f);
  const head = [m.x, 1.66, m.z];
  if (f < TURB_OFF) return { mode: 'head', x: head[0], y: head[1], z: head[2], spin: 0, sway: windK(f) * 0.2 };
  if (f < TURB_LAND) {
    const u = clamp((f - TURB_OFF) / (TURB_LAND - TURB_OFF));
    const p = lerp3([FC + 1.35, 1.66, 2.7], [FC + 7.4, 2.78, -4.4], u);
    p[1] += Math.sin(u * Math.PI) * 1.25;
    return { mode: 'fly', x: p[0], y: p[1], z: p[2], spin: u * 11, sway: 0 };
  }
  if (f < TURB_DOWN0) return { mode: 'tree', x: FC + 7.4, y: 2.62, z: -4.4, spin: 2.2, sway: 0.4 + windK(f) * 0.5 };
  if (f < TURB_DOWN1) {
    const u = smooth(ramp(f, TURB_DOWN0, TURB_DOWN1));
    const p = lerp3([FC + 7.4, 2.62, -4.4], [FC + 6.3, 1.18, -2.75], u);
    p[1] += Math.sin(u * Math.PI) * 0.3;
    return { mode: 'down', x: p[0], y: p[1], z: p[2], spin: 2.2 + u * 2, sway: 0 };
  }
  return { mode: 'head', x: head[0], y: head[1], z: head[2], spin: 0, sway: windK(f) * 0.2 };
};
const turbanPosAt = (f) => { const t = turbanStateAt(f); return [t.x, t.y, t.z]; };
// the kids' little pots (L15 run + L16 standing row)
export const KIDS = [
  { seed: 91, z: 4.6, sp: 1.0, x0: FC - 6.5 },
  { seed: 97, z: 5.9, sp: 0.86, x0: FC - 8.0 },
  { seed: 103, z: 1.8, sp: 0.98, x0: FC - 5.2 },
];
export const kidPosAt = (i, f) => {
  const k = KIDS[i], id = shotAt(f).id;
  if (id === 'kids') {
    const u = clamp((f - 1479) / 114), dist = 12.5 * u * k.sp;
    return { x: k.x0 + dist, z: k.z, ph: stridePh(0, dist, 0.55), mode: 'march' };
  }
  if (id === 'moral' || id === 'hookboard') return { x: [FC - 1.6, FC + 1.4, FC - 0.2][i], z: [4.7, 4.9, 5.7][i], ph: 0, mode: 'stand' };
  return null;
};
export const kidPotsAt = (f) => {
  const id = shotAt(f).id;
  if (id !== 'kids' && id !== 'moral' && id !== 'hookboard') return [];
  const out = [];
  for (let i = 0; i < 3; i++) {
    const kp = kidPosAt(i, f); if (!kp) continue;
    out.push({ x: kp.x, y: id === 'kids' ? 0.58 : 0.55, z: kp.z - 0.3, s: 0.55 });
  }
  return out;
};

// ---------- camera: v4 ACTION + DYNAMIC upgrades ----------
// Combined moves everywhere: push-in WITH a 15-25 deg lateral arc,
// crane rises on reveals, whip pans inside the shout line, the gust
// shot whips from the pot to the mukhiya then TRACKS the turban.
function blendPose(f, phases) {
  let cur = phases[0];
  for (let i = 1; i < phases.length; i++) {
    const [fe, pos, look, fov] = phases[i];
    if (f <= fe) {
      const u = smooth(ramp(f, fe - 10, fe));
      return { pos: lerp3(cur[1], pos, u), look: lerp3(cur[2], look, u), fov: lerp(cur[3], fov, u), roll: 0 };
    }
    cur = phases[i];
  }
  return { pos: cur[1], look: cur[2], fov: cur[3], roll: 0 };
}
const BOY_V = (f) => { const b = boyPosAt(f); return [b.x, 1.32, b.z]; };
const MUKH = [FC + 1.35, 1.42, 2.7];
const RIG_BY_ID = {
  // DRONE DIVE opening: starts high over the storm street, dives
  // toward the running boy and levels into a low tracking shot —
  // he is BIG from frame 0 (camera starts close above him) and
  // grows as the dive lands. Combined dive + arc + push-in.
  storm: { raw: keysCam({ keys: [
    { f: 0, pos: [-1.75, 0.95, 6.15], look: [0.05, 1.38, 8.3], fov: 40 },
    { f: 42, pos: [-1.45, 1.15, 4.95], look: [0, 1.32, 7.35], fov: 38, ease: 'surge' },
    { f: 95, pos: [-1.0, 1.28, 3.2], look: [0, 1.3, 5.5], fov: 35, ease: 'surge' }] }) },
  // side tracking WITH a 20-degree arc and a push-in; the cart
  // edge sweeps the foreground (parallax) mid-shot.
  run: { raw: keysCam({ keys: [
    { f: 96, pos: [2.7, 1.5, 1.6], look: [0, 1.3, 5.8], fov: 37 },
    { f: 148, pos: [3.15, 1.62, 0.1], look: [0, 1.3, 4.7], fov: 36, ease: 'surge' },
    { f: 197, pos: [2.2, 1.42, 0.85], look: [0, 1.31, 3.8], fov: 35, ease: 'surge' }] }) },
  // WHIP PANS inside the line: boy -> villagers -> boy
  shout: { raw: (f) => blendPose(f, [
    [232, [1.35, 1.52, 0.85], [0, 1.34, 3.4], 35],
    [244, [-2.3, 1.62, 1.1], [-4.45, 1.35, 4.9], 36],
    [270, [-2.3, 1.62, 1.1], [-4.45, 1.35, 4.9], 36],
    [282, [1.3, 1.5, 0.95], [0, 1.34, 3.4], 35],
    [302, [1.3, 1.5, 0.95], [0, 1.34, 3.4], 35]]) },
  // INSERT: the pot mouth fills the frame; arc 20 deg + push-in,
  // then a tilt up to the boy's determined face at the clause end.
  fill: { raw: keysCam({ keys: [
    { f: 303, pos: [1.35, 1.62, 0.35], look: [0, 1.32, 2.45], fov: 34 },
    { f: 368, pos: [0.9, 1.52, 0.45], look: [0, 1.34, 2.45], fov: 33, ease: 'surge' },
    { f: 425, pos: [1.0, 1.66, 1.0], look: [0.5, 1.36, 2.98], fov: 35, ease: 'surge' }] }) },
  // ORBIT: a 50-degree arc around the shaking pot, pushing in.
  swirl: { raw: keysCam({ keys: [
    { f: 426, pos: [1.75, 1.28, 0.65], look: [0, 0.45, 2.3], fov: 36 },
    { f: 482, pos: [0.35, 1.02, 0.3], look: [0, 0.45, 2.3], fov: 35, ease: 'surge' },
    { f: 538, pos: [-1.55, 1.22, 0.75], look: [0.1, 0.5, 2.3], fov: 35, ease: 'surge' }] }) },
  seal: { raw: keysCam({ keys: [
    { f: 539, pos: [1.3, 1.32, 0.85], look: [0.1, 0.6, 2.35], fov: 36 },
    { f: 588, pos: [0.85, 1.08, 1.15], look: [0.05, 0.62, 2.32], fov: 35, ease: 'surge' },
    { f: 632, pos: [1.18, 1.46, 1.35], look: [0.5, 1.3, 2.8], fov: 35, ease: 'surge' }] }) },
  // DRONE SWEEP: high wide over the fair, sweeping down in an arc
  // to the plaza — the crane reveal of the second day.
  fair: { raw: keysCam({ keys: [
    { f: 633, pos: [FC + 9.5, 6.6, 15.5], look: [FC, 0.8, 2], fov: 44 },
    { f: 688, pos: [FC + 6.4, 3.3, 11.3], look: [FC + 0.2, 1.0, 2.4], fov: 42, ease: 'surge' },
    { f: 738, pos: [FC + 4.2, 2.15, 8.8], look: [FC + 0.4, 1.1, 2.6], fov: 40, ease: 'surge' }] }) },
  bet: { raw: keysCam({ keys: [
    { f: 739, pos: [FC + 3.6, 1.82, 6.4], look: MUKH, fov: 37 },
    { f: 778, pos: [FC + 2.9, 1.66, 5.2], look: MUKH, fov: 36, ease: 'surge' },
    { f: 815, pos: [FC + 2.35, 1.58, 4.55], look: [FC + 1.32, 1.44, 2.7], fov: 35, ease: 'surge' }] }) },
  // slow orbit + push-in on the kneeling boy and the sealed pot;
  // the light dips, the lid POPS at f906 (kick + speed ramp).
  open: { raw: keysCam({ keys: [
    { f: 816, pos: [FC + 1.85, 1.52, 5.6], look: [FC, 0.5, 1.5], fov: 37 },
    { f: 868, pos: [FC + 0.9, 1.14, 4.3], look: [FC, 0.55, 1.5], fov: 36, ease: 'surge' },
    { f: 924, pos: [FC + 1.55, 1.36, 3.6], look: [FC - 0.1, 0.85, 1.9], fov: 36, ease: 'surge' }] }) },
  // WHIP entry (rig-declared) from the pot to the mukhiya's face,
  // then the camera TRACKS the turban's flight to the tree and
  // settles wide on the stunned fair.
  gust: { cut: 'whip', blend: 10, raw: (f) => {
    if (f < TURB_OFF) return { pos: [FC + 2.6, 1.7, 5.3], look: [FC + 1.35, 1.5, 2.7], fov: 36, roll: 0 };
    if (f < TURB_LAND) { const tp = turbanPosAt(f); return { pos: [tp[0] - 2.4, tp[1] + 0.55, tp[2] + 3.1], look: tp, fov: 36, roll: 0 }; }
    const u = smooth(ramp(f, TURB_LAND, TURB_LAND + 26));
    return { pos: lerp3([FC + 9.1, 3.55, -1.7], [FC + 6.6, 2.5, 3.6], u), look: lerp3([FC + 7.4, 2.7, -4.4], [FC + 3.2, 1.2, -0.5], u), fov: lerp(36, 40, u), roll: 0 };
  } },
  leadin: { raw: keysCam({ keys: [
    { f: 1059, pos: [FC + 1.15, 1.52, 0.15], look: [FC - 0.85, 1.38, 2.75], fov: 35 },
    { f: 1101, pos: [FC + 0.8, 1.46, 0.72], look: [FC - 0.85, 1.39, 2.75], fov: 34, ease: 'surge' }] }) },
  // THE LINE: push-in WITH a 15-degree arc on the speaker.
  line: { raw: keysCam({ keys: [
    { f: 1102, pos: [FC + 1.0, 1.52, 0.3], look: [FC - 0.85, 1.39, 2.75], fov: 35 },
    { f: 1178, pos: [FC + 0.62, 1.46, 0.68], look: [FC - 0.85, 1.4, 2.75], fov: 34, ease: 'surge' },
    { f: 1252, pos: [FC + 0.38, 1.44, 1.02], look: [FC - 0.85, 1.4, 2.75], fov: 33, ease: 'surge' }] }) },
  // the laugh: an arc across the crowd's faces, papers flying
  // through the foreground, landing on the boy's grin.
  laugh: { raw: keysCam({ keys: [
    { f: 1253, pos: [FC + 3.8, 1.92, 6.8], look: [FC + 0.6, 1.25, 2.2], fov: 38 },
    { f: 1308, pos: [FC + 2.6, 1.7, 5.2], look: [FC - 0.2, 1.3, 2.6], fov: 37, ease: 'surge' },
    { f: 1363, pos: [FC + 1.8, 1.74, 4.4], look: [FC - 0.85, 1.35, 2.75], fov: 37, ease: 'surge' }] }) },
  // the payoff: track the mukhiya's walk to the tree, push in as
  // he reaches the turban down.
  payoff: { raw: (f) => {
    const m = mukhPosAt(f);
    if (f < 1395) return { pos: [FC + 3.3, 1.82, 5.9], look: [m.x, 1.4, m.z], fov: 37, roll: 0 };
    const u = smooth(ramp(f, 1395, 1445));
    return { pos: lerp3([FC + 3.3, 1.82, 5.9], [FC + 8.6, 1.85, -0.4], u), look: [m.x, 1.42, m.z], fov: lerp(37, 36, u), roll: 0 };
  } },
  // the kids: side tracking WITH an arc, banners in parallax.
  kids: { raw: keysCam({ keys: [
    { f: 1479, pos: [FC - 3.5, 1.62, 8.8], look: [FC - 3.2, 0.9, 5.6], fov: 38 },
    { f: 1538, pos: [FC + 0.6, 1.5, 9.4], look: [FC + 0.6, 0.9, 5.2], fov: 38, ease: 'surge' },
    { f: 1593, pos: [FC + 4.6, 1.72, 8.9], look: [FC + 4.2, 0.95, 4.8], fov: 38, ease: 'surge' }] }) },
  // the moral: a slow crane UP reveal of the whole fair.
  moral: { raw: keysCam({ keys: [
    { f: 1594, pos: [FC + 3.9, 1.9, 8.7], look: [FC + 0.2, 1.1, 3.4], fov: 40 },
    { f: 1702, pos: [FC + 5.3, 3.7, 11.6], look: [FC + 0.2, 1.0, 3.2], fov: 42, ease: 'surge' }] }) },
  hookboard: { raw: keysCam({ keys: [
    { f: 1703, pos: [FC + 0.4, 2.1, -0.6], look: [FC - 1.28, 2.32, -11.2], fov: 42 },
    { f: 1799, pos: [FC + 0.3, 2.12, -0.35], look: [FC - 1.28, 2.32, -11.2], fov: 42, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: SLAM_LID, a: 0.16 }, { f: 625, a: 0.08 }, { f: POP, a: 0.22 }, { f: TURB_LAND, a: 0.18 }],
  sigma: 2.3, fovSigma: 1.6,
});
export const camAt = (f) => ({ ...RIG.camAt(f), flash: flashAt(f) });
export const RIG_META = {
  kicks: RIG.declared.kicks, hardCuts: RIG.declared.hardCuts,
  blends: SHOTS.filter((s) => RIG_BY_ID[s.id].cut === 'blend').map((s) => ({ a: s.a - Math.floor((RIG_BY_ID[s.id].blend || 0) / 2), b: s.a + Math.ceil((RIG_BY_ID[s.id].blend || 0) / 2) })),
  // AUTHORED DYNAMIC ZONES (declared openly, never flattened):
  // - shout whip pans inside L3 (boy <-> villagers, f232-282)
  // - gust turban-tracking segment (camera rides the flight)
  // - the SPEED RAMP f906-918 (lid flight at 0.5x, then snap-back)
  whips: [...RIG.declared.whips, { a: 230, b: 284 }, { a: 938, b: 1014 }],
  ramps: [{ a: RAMP_A, b: RAMP_B, rate: 0.5 }],
  samples: RIG.samples,
};
const FOCUS = {
  storm: (f) => BOY_V(f), run: (f) => BOY_V(f), shout: () => [0, 1.3, 3.4],
  fill: () => [0, 1.0, 2.45], swirl: () => [0, 0.45, 2.3], seal: () => [0, 0.6, 2.32],
  fair: () => [FC, 1.0, 2], bet: () => [FC + 1.35, 1.4, 2.7], open: () => [FC, 0.55, 1.5],
  gust: (f) => turbanPosAt(f), leadin: () => [FC - 0.85, 1.35, 2.75], line: () => [FC - 0.85, 1.35, 2.75],
  laugh: () => [FC, 1.25, 2.4],
  payoff: (f) => { const m = mukhPosAt(f); return [m.x, 1.35, m.z]; },
  kids: () => [FC + 0.6, 0.9, 5.2], moral: () => [FC + 0.2, 1.05, 3.3], hookboard: () => [FC - 1.35, 2.45, -11.2],
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id](f);
const CINF = { storm: 2.8, run: 2.6, shout: 2.2, fill: 1.5, swirl: 1.8, seal: 1.8, fair: 5.0, bet: 2.4, open: 1.9, gust: 1.6, leadin: 1.8, line: 1.7, laugh: 2.6, payoff: 2.4, kids: 2.8, moral: 5.0, hookboard: 3.2 };
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), hp = heroPosAt(f);
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf: CINF[S.id] || 2.2 };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  return {
    always: 1,
    hookK: S.id === 'hookboard' ? smooth(ramp(f, 1708, 1734)) : 0,
    windK: windK(f),
    gustK: gustK(f),
    stormK: S.light === 'storm' ? 1 : 0,
    shutK: S.light === 'storm' ? 1 : 0,
    potShake: potShakeK(f),
    goldK: goldK(f),
  };
};
export const fxProfileAt = (f) => ({
  moteRate: shotAt(f).light === 'storm' ? 0.3 : 0.08,
  blastRate: 0,
  sparkRate: (f >= POP && f <= POP + 26) ? 0.6 : 0,
  steamRate: 0, shimmerRate: 0,
});
export const fxAt = () => [];

// ---------- cast ----------
const tintFor = () => '#ffffff';
export const OUTFITS = {
  boy: { jacket: '#c2452d', pants: '#4a3626', boots: '#241a12', hat: 'hair', hair: '#14100c', skin: '#f8eee3' },
  mukhiya: { jacket: '#5d7031', pants: '#e6dcc4', boots: '#2a1a10', hat: 'hair', hair: '#cfc8bd', skin: '#f8eee3', moustache: '#b8b3a4', bigMoustache: true },
  villager0: { jacket: '#7a4a2b', pants: '#3c4653', boots: '#241a12', hat: 'hair', hair: '#241a12', skin: '#f8eee3' },
  villager1: { jacket: '#31577f', pants: '#54443a', boots: '#241a12', hat: 'hair', hair: '#171310', skin: '#f8eee3', moustache: '#2a201a' },
  villager2: { jacket: '#74455e', pants: '#333f4d', boots: '#241a12', hat: 'cap', cap: '#8a3b2a', skin: '#f8eee3' },
  crowd0: { jacket: '#7a4a2b', pants: '#3c4653', boots: '#241a12', hat: 'hair', hair: '#241a12', skin: '#f8eee3' },
  crowd1: { jacket: '#31577f', pants: '#54443a', boots: '#241a12', hat: 'hair', hair: '#171310', skin: '#f8eee3' },
  crowd2: { jacket: '#5d7031', pants: '#4a3626', boots: '#241a12', hat: 'cap', cap: '#8a3b2a', skin: '#f8eee3' },
  crowd3: { jacket: '#8a5a24', pants: '#39424e', boots: '#241a12', hat: 'hair', hair: '#100c0a', skin: '#f8eee3', moustache: '#2a201a' },
  crowd4: { jacket: '#8a6a34', pants: '#46392c', boots: '#241a12', hat: 'hair', hair: '#cfc8bd', skin: '#f8eee3', moustache: '#b8b3a4', bigMoustache: true },
  crowd5: { jacket: '#74455e', pants: '#333f4d', boots: '#241a12', hat: 'hair', hair: '#1d1410', skin: '#f8eee3' },
  kid0: { jacket: '#2f5d8a', pants: '#4a3626', boots: '#241a12', hat: 'hair', hair: '#14100c', skin: '#f8eee3' },
  kid1: { jacket: '#3d7a44', pants: '#54443a', boots: '#241a12', hat: 'hair', hair: '#1d1410', skin: '#f8eee3' },
  kid2: { jacket: '#d9a441', pants: '#3c4653', boots: '#241a12', hat: 'cap', cap: '#b3392e', skin: '#f8eee3' },
};
const CROWD = [
  { seed: 61, x: FC - 3.4, z: 3.2 }, { seed: 67, x: FC + 3.4, z: 3.4 }, { seed: 71, x: FC - 3.4, z: 0.2 },
  { seed: 79, x: FC + 3.4, z: 0.4 }, { seed: 83, x: FC - 3.3, z: -2.6 }, { seed: 89, x: FC + 3.3, z: -2.4 },
];
const VILLAGERS = [
  { seed: 41, x: -4.15, z: 5.2 }, { seed: 43, x: 4.45, z: 4.0 }, { seed: 47, x: -4.15, z: 1.6 },
];
// Emotion morphs at story beats (body.js emoTrack).
const emoBoy = emoTrack(T.faceP, 'determined', [
  [198, 'nervous', 8], [303, 'determined', 8], [539, 'proud', 8], [633, 'smile', 8], [816, 'determined', 8],
  [925, 'proud', 8], [1059, 'smile', 8], [1102, 'smile', 8], [1253, 'laugh', 8], [1364, 'proud', 8],
  [1479, 'laugh', 8], [1594, 'proud', 8], [1703, 'smile', 8],
]);
const emoMukh = emoTrack(T.faceP, 'smug', [
  [816, 'smug', 8], [906, 'shock', 5], [1059, 'nervous', 8], [1102, 'nervous', 8], [1253, 'sad', 9],
  [1364, 'relief', 9], [1479, 'relief', 8], [1594, 'smile', 8], [1703, 'smile', 8],
]);
const emoCrowd = emoTrack(T.faceP, 'smile', [
  [906, 'shock', 6], [1059, 'smile', 8], [1253, 'laugh', 8], [1479, 'smile', 8], [1594, 'smile', 8],
]);
const emoVill = emoTrack(T.faceP, 'nervous', [
  [198, 'shock', 6], [303, 'nervous', 8], [426, 'smile', 8],
]);
const lifeBoy = lifeAt({ seed: 31 }), lifeMukh = lifeAt({ seed: 51 });
const lifeCrowd = CROWD.map((c) => lifeAt({ seed: c.seed }));
const lifeVill = VILLAGERS.map((v) => lifeAt({ seed: v.seed }));
const lifeKids = KIDS.map((k) => lifeAt({ seed: k.seed }));
const micro = (f, seed) => 1.1 * Math.sin((f + seed * 5) * 0.037 + 1);
const nodAt = (f, f0, n = 9, depth = 0.34) => (f >= f0 && f <= f0 + n ? Math.sin((f - f0) / n * Math.PI) * depth : 0);
const H2 = (life, f, seed, o = {}) => ({
  headTilt: q((o.ht || 0) + micro(f, seed) + life(f).sway, 1),
  look: q(o.look || 0, 2), lookY: q(o.lookY || 0, 2), facing: q(o.facing || 0, 2),
  squash: q(o.squash || 0, 2), tilt: q((o.tilt || 0) + life(f).tilt, 1),
  breath: Math.round(life(f).breath / 6) * 6,
});
const noBlush = (P) => { const P2 = { ...P, cheek: Math.max(P.cheek ?? 0, 0.55) }; P2.blush = 0; P2.openL = Math.min(1, (P2.openL ?? 0.85) * 1.45); P2.openR = Math.min(1, (P2.openR ?? 0.85) * 1.45); return P2; };
const SPEAK = SPK.makeSpeakPlayer(SPEAK_DATA);
// dialogue gesture: the boy's free hand talks with the voice —
// stresses on the REAL word onsets from speakgen (ASR-aligned):
// तूफ़ान f1113, दोस्तों। f1152, बंद f1217.
const gestBoy = gestureAt([{ a: 1102, b: 1252, beats: [1113, 1152, 1217], base: 0.14, amp: 0.5 }]);
// wind flap for card bodies on the storm day: a small fast tilt
// oscillation in the ONE wind direction, scaled by windK.
const flap = (f, seed) => q(Math.sin(f * 0.55 + seed) * 0.05 * windK(f), 2);

export const castAt = (f) => {
  const S = shotAt(f), out = [];
  const std = (id, o, opts, x, z, extra = {}) => {
    out.push({ id, x, y: 0, z, r: extra.r || 0.32, ground: 0,
      actor: (Tm) => ({ key: 'smx' + JSON.stringify(o) + JSON.stringify(opts) + '0',
        draw: (p) => { Tm.bodyFront(p, o, opts); if (extra.overlay) extra.overlay(p); },
        x, y: 0, z, ground: 0, tint: tintFor(), ...extra }) });
  };
  const BP = noBlush(emoBoy.at(f)), MP = noBlush(emoMukh.at(f)), CP = noBlush(emoCrowd.at(f)), VP = noBlush(emoVill.at(f));
  const b = boyPosAt(f), mk = mukhPosAt(f);
  const boyStd = (opts, extra = {}) => std('boy', OUTFITS.boy, { expr: 'smile', exprP: BP, blink: blinkAt(f, 31), seed: 31, mode: b.mode, phase: q(b.ph, 2), ...opts }, b.x, b.z,
    { yaw: 0.1, s: 0.84, r: 0.3, ...extra });
  const mukhStd = (opts, extra = {}) => std('mukhiya', OUTFITS.mukhiya, { expr: 'smile', exprP: MP, blink: blinkAt(f, 51), seed: 51, mode: mk.mode, phase: q(mk.ph, 2), ...opts }, mk.x, mk.z,
    { yaw: -0.15, s: 1.02, ...extra });
  const crowdStd = (i, opts = {}, extra = {}) => {
    const c = CROWD[i], side = c.x < FC ? 1 : -1;
    const ch = win(f, 1262, 1355), cl = win(f, 1272, 1350);
    let arms = {};
    if (cl > 0.03) { const k = q((0.5 + 0.22 * Math.sin(f * 0.85 + c.seed)) * cl, 2); arms = { prop: ['point', q(0.45 + k * 0.4, 2)], propL: ['point', q(0.45 + k * 0.4, 2)] }; }
    else if (ch > 0.03) arms = { prop: ['point', q(0.85 * ch, 2)], propL: ['point', q(0.8 * ch, 2)] };
    // the gust tears through the crowd: bodies lean, clothes flap
    const lean = f >= POP && f < 1120 ? q(Math.sin((f - POP) * 0.3 + c.seed) * 0.06 * gustK(f), 2) : 0;
    std('crowd' + c.seed, OUTFITS['crowd' + i], { expr: 'smile', exprP: CP, blink: blinkAt(f, c.seed), seed: c.seed, mode: 'stand',
      ...arms, ...H2(lifeCrowd[i], f, c.seed, { look: side * -0.2, tilt: lean }), ...opts }, extra.x ?? c.x, extra.z ?? c.z, { yaw: side * 0.3, s: 0.97, ...extra });
  };
  const crowdSet = (ids) => ids.forEach((i) => crowdStd(i));
  const villStd = (i, opts = {}, extra = {}) => {
    const v = VILLAGERS[i], side = v.x < 0 ? 1 : -1;
    std('villager' + v.seed, OUTFITS['villager' + i], { expr: 'smile', exprP: VP, blink: blinkAt(f, v.seed), seed: v.seed, mode: 'stand',
      ...H2(lifeVill[i], f, v.seed, { look: side * -0.25, tilt: flap(f, v.seed) }), ...opts }, v.x, v.z, { yaw: side * 0.35, s: 0.97, ...extra });
  };
  const kidStd = (i, opts = {}, extra = {}) => {
    const kp = kidPosAt(i, f); if (!kp) return;
    std('kid' + KIDS[i].seed, OUTFITS['kid' + i], { expr: 'smile', exprP: CP, blink: blinkAt(f, KIDS[i].seed), seed: KIDS[i].seed, mode: kp.mode, phase: q(kp.ph, 2),
      ...H2(lifeKids[i], f, KIDS[i].seed, {}), ...opts }, kp.x, kp.z, { yaw: 0.1, s: 0.6, r: 0.22, ...extra });
  };
  // the boy's arms while he carries / holds / works the pot
  const carryArms = { prop: ['point', 0.42], propL: ['point', 0.42] };

  switch (S.id) {
    case 'storm': {
      villStd(0); villStd(1);
      // frame 0: BIG, mid-stride, pot hugged to his chest, chin
      // into the wind — the dive lands on HIM.
      boyStd({ ...carryArms, ...H2(lifeBoy, f, 31, { ht: -2, look: -0.15, tilt: flap(f, 31) }) }, { yaw: 0.12 });
      break;
    }
    case 'run': {
      villStd(0); villStd(2);
      boyStd({ ...carryArms, ...H2(lifeBoy, f, 31, { ht: -2.5, look: -0.1, tilt: flap(f, 31) }) }, { yaw: 0.1 });
      break;
    }
    case 'shout': {
      // the villagers shout from their doorways (narration — their
      // mouths stay shut; arms and bodies do the shouting)
      villStd(0, { prop: ['point', q(0.7 * win(f, 205, 295), 2)], propL: ['point', q(0.5 * win(f, 205, 295), 2)] });
      villStd(1, { prop: ['point', q(0.6 * win(f, 210, 295), 2)] });
      villStd(2, { propL: ['point', q(0.65 * win(f, 215, 295), 2)] });
      boyStd({ ...carryArms, ...H2(lifeBoy, f, 31, { ht: -1, look: -0.3, tilt: flap(f, 31) }) }, { yaw: -0.1 });
      break;
    }
    case 'fill': {
      // both hands on the pot, holding its mouth to the wind
      boyStd({ ...carryArms, ...H2(lifeBoy, f, 31, { ht: -3, look: -0.2, lookY: 0.15, tilt: flap(f, 31) }) }, { yaw: 0.05 });
      break;
    }
    case 'swirl': {
      boyStd({ prop: ['point', 0.5], propL: ['point', 0.46], ...H2(lifeBoy, f, 31, { ht: -2, look: -0.1, lookY: 0.2, tilt: flap(f, 31) }) }, { yaw: 0.05 });
      break;
    }
    case 'seal': {
      // hands work the lid (slam at f560) then the rope (f575-625)
      const work = Math.max(win(f, 548, 575), win(f, 575, 628));
      boyStd({ prop: ['point', q(0.55 + 0.25 * work, 2)], propL: ['point', q(0.5 + 0.25 * work, 2)], ...H2(lifeBoy, f, 31, { ht: -1.5, look: 0, lookY: 0.2 }) }, { yaw: 0.08 });
      break;
    }
    case 'fair': {
      crowdSet([0, 1, 2, 3, 4, 5]);
      mukhStd({ ...H2(lifeMukh, f, 51, { ht: -1, look: -0.25 }) }, { yaw: -0.2 });
      boyStd({ ...H2(lifeBoy, f, 31, { ht: -1, look: 0.25 }) }, { yaw: 0.15 });
      break;
    }
    case 'bet': {
      // the mukhiya lays the challenge: finger jabbing at the pot,
      // shoulders shaking with a laugh he keeps behind his teeth
      const jab = q(0.55 + 0.3 * Math.abs(Math.sin(f * 0.22)) * win(f, 745, 810), 2);
      mukhStd({ prop: ['point', jab], ...H2(lifeMukh, f, 51, { ht: -2, look: -0.3, squash: q(Math.sin(f * 0.5) * 0.02 * win(f, 745, 810), 2) }) }, { yaw: -0.25 });
      boyStd({ ...H2(lifeBoy, f, 31, { ht: -0.5, look: 0.3 }) }, { yaw: 0.2 });
      break;
    }
    case 'open': {
      crowdSet([1, 3]);
      // kneeling at the pot: untie (f838-878), grip the lid, lift
      const un = Math.max(win(f, 838, 880), win(f, 884, POP));
      boyStd({ prop: ['point', q(0.5 + 0.28 * un, 2)], propL: ['point', q(0.46 + 0.24 * un, 2)], ...H2(lifeBoy, f, 31, { ht: -2, look: 0.1, lookY: 0.2 }) }, { yaw: 0.15 });
      mukhStd({ ...H2(lifeMukh, f, 51, { ht: -1, look: -0.3 }) }, { yaw: -0.25 });
      break;
    }
    case 'gust': {
      crowdSet([0, 1, 2, 3, 4, 5]);
      // the gust slams the mukhiya: he staggers a half-step back
      const stag = f >= TURB_OFF - 6 && f < TURB_OFF + 30 ? q(Math.sin((f - TURB_OFF + 6) * 0.35) * 0.05, 2) : 0;
      mukhStd({ prop: ['point', q(0.5 * win(f, TURB_OFF - 4, TURB_OFF + 26), 2)], propL: ['point', q(0.45 * win(f, TURB_OFF - 4, TURB_OFF + 26), 2)], ...H2(lifeMukh, f, 51, { ht: 2, look: -0.2, tilt: stag }) }, { yaw: -0.2 });
      boyStd({ ...H2(lifeBoy, f, 31, { ht: -2, look: 0.3 }) }, { yaw: 0.2 });
      break;
    }
    case 'leadin': {
      crowdSet([0, 2, 4]);
      boyStd({ ...H2(lifeBoy, f, 31, { ht: -2.5, look: 0.2 }) }, { yaw: 0.2 });
      mukhStd({ ...H2(lifeMukh, f, 51, { ht: 1.5, look: -0.3 }) }, { yaw: -0.25 });
      break;
    }
    case 'line': {
      // THE LINE, performed: mouth driven by the stem (speak.js),
      // free hand gesturing on the stress words; the mukhiya
      // listens — mouth shut, a small nod as it lands.
      const sp = SPEAK.at(f);
      const speakP = SPK.applySpeak({ ...BP, cheek: Math.max(BP.cheek ?? 0, 0.55) }, sp);
      speakP.blush = 0; speakP.openL = Math.min(1, (speakP.openL ?? 0.85) * 1.45); speakP.openR = Math.min(1, (speakP.openR ?? 0.85) * 1.45);
      boyStd({ exprP: speakP, prop: ['point', q(gestBoy(f).k, 2)], propL: ['point', 0.3],
        headTilt: q((sp.nod || 0) + micro(f, 31) - 1, 1), look: q(0.2, 2), lookY: q(0, 2), facing: q(0.15, 2),
        squash: 0, tilt: q(lifeBoy(f).tilt + lifeBoy(f).sway, 1), breath: Math.round(lifeBoy(f).breath / 6) * 6 }, { yaw: 0.25 });
      mukhStd({ ...H2(lifeMukh, f, 51, { ht: 1.5 + nodAt(f, 1217, 10, 0.4), look: -0.35, facing: -0.2 }) }, { yaw: -0.3 });
      break;
    }
    case 'laugh': {
      crowdSet([0, 1, 2, 3, 4, 5]);
      // the mukhiya stands bare-headed in the wreckage of his bet
      mukhStd({ ...H2(lifeMukh, f, 51, { ht: 3, look: -0.1, lookY: 0.25 }) }, { yaw: -0.2 });
      boyStd({ ...H2(lifeBoy, f, 31, { ht: -2, look: 0.25 }) }, { yaw: 0.2 });
      break;
    }
    case 'payoff': {
      crowdSet([0, 3]);
      // coins counted out at the start, then the walk to the tree
      // and the long reach up for his turban
      const pay = f < 1395 ? { prop: ['coin', q(0.7 * win(f, 1380, 1440) + 0.1, 2)], propL: ['point', 0.3] } : {};
      const reach = f >= 1445 ? { prop: ['point', q(0.85 * win(f, 1445, 1478), 2)], propL: ['point', 0.25] } : {};
      mukhStd({ ...pay, ...reach, ...H2(lifeMukh, f, 51, { ht: f >= 1445 ? -3 : 2.5, look: -0.15, lookY: f >= 1445 ? -0.2 : 0.25 }) }, { yaw: -0.2 });
      boyStd({ ...H2(lifeBoy, f, 31, { ht: -1.5, look: 0.3 }) }, { yaw: 0.2 });
      break;
    }
    case 'kids': {
      kidStd(0); kidStd(1); kidStd(2);
      boyStd({ prop: ['point', q(0.6 * win(f, 1490, 1560), 2)], ...H2(lifeBoy, f, 31, { ht: -2, look: 0.3 }) }, { yaw: 0.25 });
      crowdSet([1, 4]);
      break;
    }
    case 'moral': {
      crowdSet([0, 1, 2, 3, 4, 5]);
      kidStd(0); kidStd(1); kidStd(2);
      mukhStd({ ...H2(lifeMukh, f, 51, { ht: -1, look: -0.2 }) }, { yaw: -0.2 });
      boyStd({ ...H2(lifeBoy, f, 31, { ht: -1.5, look: 0.15 }) }, { yaw: 0.15 });
      break;
    }
    case 'hookboard': {
      // finale: the boy points up at the hook board; the mukhiya
      // and the elder look up with him. Nobody speaks (END RULE).
      boyStd({ prop: ['point', 0.88], propL: ['point', 0.3], ...H2(lifeBoy, f, 31, { ht: -4, look: -0.1, lookY: -0.25, facing: 0.1 }) }, { yaw: 0.35 });
      mukhStd({ ...H2(lifeMukh, f, 51, { ht: -3, look: 0.1, lookY: -0.25 }) }, { yaw: 0.3 });
      crowdStd(4, { ...H2(lifeCrowd[4], f, 83, { look: 0.15, lookY: -0.25 }) }, { x: FC - 1.35, z: -5.6, yaw: 0.3 });
      break;
    }
  }
  return out;
};
export const actorsAt = (f, Tm) => castAt(f).map((c) => c.actor(Tm));

// ---------- solidity ----------
export const STATICS = [
  // village huts (storm day)
  SOL.aabb(-7.2, -4.6, -2.2, 2.8, { h: 2.6, id: 'hutW1' }), SOL.aabb(4.6, 7.2, -2.2, 2.8, { h: 2.6, id: 'hutE1' }),
  SOL.aabb(-7.2, -4.6, 5.2, 10.2, { h: 2.6, id: 'hutW2' }), SOL.aabb(4.6, 7.2, 5.2, 10.2, { h: 2.6, id: 'hutE2' }),
  SOL.circle(-8.5, -6, 0.5, { h: 4.5, id: 'treeVW' }), SOL.circle(8.5, -7, 0.55, { h: 4.5, id: 'treeVE' }),
  SOL.circle(-9.5, 12, 0.5, { h: 4, id: 'treeVW2' }), SOL.circle(9.5, 13, 0.5, { h: 4, id: 'treeVE2' }),
  SOL.circle(-1.6, 10.8, 0.5, { h: 4.5, id: 'treeVN' }), SOL.circle(2.8, 12.6, 0.45, { h: 4, id: 'treeVN2' }),
  // fair ground (archer layout, +80)
  SOL.aabb(FC - 10.3, FC - 6.9, 9.2, 11.8, { h: 3, id: 'stallW' }), SOL.aabb(FC + 6.9, FC + 10.3, 9.2, 11.8, { h: 3, id: 'stallE' }),
  SOL.aabb(FC - 2.1, FC + 2.1, 12.1, 14.9, { h: 3, id: 'stallB' }),
  SOL.aabb(FC - 12.2, FC - 8.6, 0.4, 3.6, { h: 2.6, id: 'tentW' }), SOL.aabb(FC + 8.6, FC + 12.2, 0.4, 3.6, { h: 2.6, id: 'tentE' }),
  SOL.circle(FC - 3.8, 7.5, 0.09, { h: 2.6, id: 'poleSW' }), SOL.circle(FC + 3.8, 7.5, 0.09, { h: 2.6, id: 'poleSE' }),
  SOL.circle(FC - 3.8, -13.4, 0.09, { h: 2.6, id: 'poleNW' }), SOL.circle(FC + 3.8, -13.4, 0.09, { h: 2.6, id: 'poleNE' }),
  SOL.circle(FC - 9, -6, 0.5, { h: 4.5, id: 'treeW' }), SOL.circle(FC + 9.5, -7, 0.55, { h: 4.5, id: 'treeE' }),
  SOL.circle(FC + 8.5, -5.5, 0.6, { h: 5, id: 'treeFair' }),
  SOL.circle(FC - 10, 4, 0.5, { h: 4, id: 'treeW2' }), SOL.circle(FC + 10.5, 5, 0.5, { h: 4, id: 'treeE2' }),
  SOL.circle(FC - 2.25, -11.3, 0.07, { h: 2.8, id: 'boardPostL' }), SOL.circle(FC - 0.45, -11.3, 0.07, { h: 2.8, id: 'boardPostR' }),
];
export const WORLD = SOL.makeWorld(STATICS);
export const dynamicsAt = (f) => {
  const out = [];
  for (const a of castAt(f)) out.push(SOL.circle(a.x, a.z, a.r, { kind: 'dynamic', id: a.id, group: '' }));
  return out;
};
export const groundItemsAt = (f) => {
  const items = [];
  for (const a of castAt(f)) items.push({ id: a.id, y: a.y, ground: a.ground ?? 0, maxHover: 0.06 });
  const pot = potStateAt(f);
  if (pot.mode === 'ground' || pot.mode === 'fair') items.push({ id: 'pot', y: 0, ground: 0, maxHover: 0.06 });
  const lid = lidStateAt(f);
  if (lid.mode === 'ground') items.push({ id: 'lid', y: lid.y, ground: lid.y, maxHover: 0.06 });
  const tb = turbanStateAt(f);
  if (tb.mode === 'tree') items.push({ id: 'turban', y: tb.y, ground: tb.y, maxHover: 0.06 });
  return items;
};
