// Shot plan for "वो मोर जिसने ट्रेन रोक दी" — peacock-hindi (LIBRARY v4:
// speak.js dialogue performance + materials v4, camrig smooth tracking +
// solid colliders). Batch 7 topic 1, HINDI. The 7:10 express brakes every
// morning at a tiny jungle station: a peacock fans its tail across the
// track, the driver thinks a crowd is on the line and brakes; the braking
// shakes grain loose from the goods wagon; the peacock eats. Twist: the
// peacock trained the train.
// Voice stem: 52.131 s, 30 fps, TOTAL 1564; timings from faster-whisper
// small word alignment (words.json; tail seg01 re-cut with output-seek —
// input -ss produced an empty file — and 14 tail words appended, so the
// hook question 48.52-52.0 s is covered). Scene changes ONLY at clause
// boundaries (phrase starts/ends from timing.json):
//   S1  0.00- 7.62  हर सुबह सात बजकर दस मिनट पर...       (drone)
//   S2  7.62-13.04  ड्राइवर कहता था ब्रेक ठीक हैं...    (cab)
//   S3 13.04-21.04  रेलवे इंस्पेक्टर...सौ आँखों वाली दीवार। (inspector)
//   S4 21.30-24.54  "पटरी पर भीड़ खड़ी है!" ... ब्रेक खींच लिया। (dialogue)
//   S5 24.80-26.88  पर मोर अकेला था, और भीड़ सिर्फ़ पंख थे। (feathers)
//   S6 26.88-32.20  इंस्पेक्टर हँसा — तभी ट्रेन रुकी...बिखर गई। (brake)
//   S7 32.44-35.92  मोर ने पूँछ समेटी...नाश्ता खा लिया।  (eat)
//   S8 36.24-43.06  स्टेशन के एक लड़के ने हफ़्तों से देखा था... (boy)
//   S9 43.36-46.58  किसी ने मोर को नहीं सिखाया था।...    (twist)
//   S10 46.58-49.70 पर एक औरत छलनी में पानी घर ले आई... (hookq)
//   S11 49.94-52.00 भला छलनी में पानी कैसे ले जाया जाता है? (hook)
// Dialogue beat (speak.js): the driver's quoted line "पटरी पर भीड़
// खड़ी है!" 21.30-22.42 s = f639-673. The tag "ड्राइवर चिल्लाया, और उसने
// ब्रेक खींच लिया" is narration — his mouth stays closed there.
// Key action frames: brake pull f716 ("ब्रेक" 23.86 s), train stops f865
// ("रुकी" 28.82 s), grain shower from f914 ("अनाज" 30.46 s), peacock
// walks f1026-1055 ("चलकर आया" 34.20 s), eats f1055-1078.
// GRADE (FILTER_VFX_LIGHTING pack): Sunny Pop throughout (one grade, no
// changes). Signature VFX: chimney smoke puffs trailing the moving train,
// brake dust burst + ground ring at the wheels, golden grain shower with
// gravity + a settled pile, eye-spot glints on the fanned tail, drifting
// clouds + gust-swayed trees/leaves in every shot.
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
  const P = SPK.applySpeak({ ...T.faceP(baseName), cheek: 0.5 }, s);
  if (!s.active) { P.mOpen = 0; P.teeth = 0; P.tongue = 0; P.wave = 0; P.curve = Math.max(-0.1, Math.min(P.curve, 0.15)); } // pause: alarmed eyes, mouth firmly shut
  return { expr: 'shock', exprP: P, headTilt: q(s.nod || 0, 2), clothShade: true };
};

export const FPS = 30, TOTAL = 1564, DECK = 0;
export const SHOTS = [
  { id: 'drone', a: 0, b: 228, light: 'sunny' },
  { id: 'cab', a: 229, b: 390, light: 'sunny' },
  { id: 'inspector', a: 391, b: 638, light: 'sunny' },
  { id: 'dialogue', a: 639, b: 743, light: 'sunny' },
  { id: 'feathers', a: 744, b: 805, light: 'sunny' },
  { id: 'brake', a: 806, b: 972, light: 'sunny' },
  { id: 'eat', a: 973, b: 1086, light: 'sunny' },
  { id: 'boy', a: 1087, b: 1300, light: 'sunny' },
  { id: 'twist', a: 1301, b: 1396, light: 'sunny' },
  { id: 'hookq', a: 1397, b: 1497, light: 'sunny' },
  { id: 'hook', a: 1498, b: 1563, light: 'sunny' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights / mood grades ----------
// Sunny Pop: warm highlights, saturated greens/blues, contrast up. One
// grade for the whole video; one consistent sun direction (az 235).
export const LIGHTS = {
  sunny: { az: 235, el: 38, sky: '#e8f0c8', ground: '#7a8a4a', hemi: 1.15, sun: '#ffe9b0', sunI: 2.6, fog: '#dfe8c0', fogNear: 50, fogFar: 340,
    skyTop: '#2568b8', skyHor: '#cfe8f0', sunDisc: '#fff2b8', sunSize: 0.0042, sat: 1.12, vig: 0.24, shadowExt: 24, aurora: 0, gain: '#fff0c8',
    waterDeep: '#1d4e5f', waterShal: '#2e7ea6', glint: '#ffe9c0' },
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

// ---------- staging ----------
export const BOARD_POS = [0, 3.1, -6];
export const PLATFORM = { x: 0, z: 6.1, w: 20, d: 3.0, top: 0.9 };   // x -10..10, z 4.6..7.6
export const HUT = { x: -7.5, z: 6.1, ry: 0 };
export const SIGNAL = { x: 9, z: 0.6 };
export const PEACOCK_HOME = { x: 0, z: 2.0, y: 0.18 };
export const GRAIN_PILE = { x: -1.0, z: 2.45 };
export const TRACK_Z = 2.0;
export const TREES = [
  [-13, -10], [-8, -12.5], [-3.5, -10.5], [2, -13], [6.5, -10.5], [11, -12], [15, -9.5],
  [-17, -5], [16, 4.5], [-14, 11.5], [14.5, 11],
];
const segMax = (f, segs) => {
  let s = 0;
  for (const [a, b, c, d, peak] of segs) if (f >= a && f <= d) s = Math.max(s, peak * (f < b ? smooth(ramp(f, a, b)) : f <= c ? 1 : 1 - smooth(ramp(f, c, d))));
  return s;
};

// ---------- the train ----------
// Nose (frontX) approaches from -40, brakes from f716, stops f872 with
// the nose at -2.0 — just short of the peacock at x=0. Loco spans
// frontX-6..frontX; goods wagon frontX-11.5..frontX-6.5.
export const trainFrontAt = (f) => {
  if (f <= 390) return lerp(-40, -16, smooth(ramp(f, 0, 390)));
  if (f <= 638) return lerp(-16, -6.5, smooth(ramp(f, 391, 638)));
  if (f <= 715) return lerp(-6.5, -4.2, smooth(ramp(f, 639, 715)));
  if (f <= 872) return lerp(-4.2, -2.0, smooth(ramp(f, 716, 872)));
  return -2.0;
};
export const trainSpeedAt = (f) => {
  // per-frame speed (units/frame) for smoke rate + wheel spin
  if (f <= 0) return 0;
  return Math.max(0, trainFrontAt(f) - trainFrontAt(f - 1));
};
export const driverAt = (f) => ({ x: trainFrontAt(f) - 4.0, y: 0.55, z: 2.0 });
// Driver rides INSIDE the cab (card z=2.0, behind the cab window opening
// at the loco south wall) — main.js builds the cab with a real window
// cutout so his head/shoulders show through and his legs stay hidden.

// ---------- the peacock ----------
export const peacockAt = (f) => {
  let x = PEACOCK_HOME.x;
  if (f >= 1026 && f <= 1055) x = lerp(0, -1.2, smooth(ramp(f, 1026, 1055)));
  else if (f > 1055) x = -1.2;
  // faces the train (-x) until the eat; turns toward the grain pile
  // (ry 0.42 = exactly the pile direction) to eat, then turns to face the
  // camera squarely for the twist ("मोर ने ट्रेन को सिखा दिया था").
  let ry = -Math.PI / 2;
  if (f >= 1055 && f < 1301) ry = lerp(-Math.PI / 2, 0.42, smooth(ramp(f, 1055, 1086)));
  else if (f >= 1301) ry = lerp(0.42, 0, smooth(ramp(f, 1301, 1330)));
  return { x, y: PEACOCK_HOME.y, z: PEACOCK_HOME.z, ry };
};
// tail fan: 0 folded/trailing, 1 fully fanned. Opens as the inspector
// sees it ("पूँछ फैलाए हुए"), holds through the brake, folds when the
// peacock walks to eat ("पूँछ समेटी" f973).
export const fanAt = (f) => {
  if (f < 560) return 0;
  if (f <= 630) return smooth(ramp(f, 560, 630));
  if (f < 973) return 1;
  if (f <= 1020) return 1 - smooth(ramp(f, 973, 1020));
  return 0;
};
// head peck: 1 while eating (f1055-1078) + soft pecks while at the pile
export const peckAt = (f) => segMax(f, [
  [1055, 1062, 1071, 1078, 1],
  [1120, 1135, 1150, 1165, 0.6],
  [1240, 1255, 1270, 1285, 0.6],
  [1330, 1345, 1360, 1375, 0.5],
]);
export const peacockMode = (f) => (f >= 1026 && f <= 1055 ? 'stroll' : 'stand');
// grain shower: falls from the goods wagon f914-966 ("अनाज" 30.46 s),
// pile grows with it and stays (eaten down a touch while pecking).
export const grainShowerAt = (f) => segMax(f, [[914, 922, 958, 966, 1]]);
export const grainPileAt = (f) => {
  let k = 0;
  if (f >= 914) k = smooth(ramp(f, 914, 966));
  if (f >= 1055) k *= 1 - 0.15 * smooth(ramp(f, 1055, 1078));
  return k;
};
// brake dust burst at the wheels: brake pull f716 + the stop f865
export const dustAt = (f) => segMax(f, [
  [716, 724, 740, 772, 1],
  [865, 872, 888, 920, 0.8],
]);
// eye-spot glints on the fanned tail (feathers + brake beats)
export const glintAt = (f) => {
  let s = 0;
  const pulse = (a, b, peak) => { if (f >= a && f <= b) s = Math.max(s, peak * Math.sin(ramp(f, a, b) * Math.PI)); };
  pulse(600, 638, 0.6); pulse(744, 805, 1); pulse(850, 920, 0.7); pulse(1310, 1396, 0.55);
  return s;
};

// ---------- hero / focus ----------
const FOCUS = {
  drone: () => [0, 1.2, 2],
  cab: () => { const d = driverAt(300); return [d.x, 1.6, d.z]; },
  inspector: () => [0, 0.9, 2],
  dialogue: () => { const d = driverAt(690); return [d.x, 1.6, d.z]; },
  feathers: () => [0, 0.9, 2],
  brake: () => [-4, 1.0, 2],
  eat: () => [-1.2, 0.7, 2.2],
  boy: () => [1, 1.1, 3.2],
  twist: () => [-1.2, 0.9, 2.2],
  hookq: () => BOARD_POS, hook: () => BOARD_POS,
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id]();

// ---------- cameras: EVERY shot is a camrig track on a subject ----------
const driverPos3 = (f) => { const d = driverAt(f); return [d.x, d.y, d.z]; };
const peacockPos3 = (f) => { const p = peacockAt(f); return [p.x, p.y, p.z]; };
const bezierCam = (P, L, a, b, fov0, fov1) => (f) => {
  const u = M.smooth(ramp(f, a, b));
  const w0 = (1 - u) ** 3, w1 = 3 * (1 - u) ** 2 * u, w2 = 3 * (1 - u) * u * u, w3 = u ** 3;
  const mix = (Q) => [0, 1, 2].map((j) => w0 * Q[0][j] + w1 * Q[1][j] + w2 * Q[2][j] + w3 * Q[3][j]);
  return { pos: mix(P), look: mix(L), fov: lerp(fov0, fov1, u), roll: 0 };
};
const RIG_BY_ID = {
  drone: { cut: 'hard', raw: bezierCam(
    [[24, 15, 28], [15, 9, 21], [11, 6.5, 18], [9, 5.5, 16.5]],
    [[0, 2.5, -6], [0, 2, 0], [0, 1.4, 2], [0, 1.3, 2.2]], 0, 228, 42, 38) },
  cab: { cut: 'hard', raw: pushInCam({ subject: driverPos3, a: 229, b: 390, d0: 5.8, d1: 4.4, h0: 1.7, h1: 1.5, lookOff: [0, 0.9, 0], fov0: 40, fov1: 34,
    dir: () => [0.5, 0.85] }) },
  inspector: { cut: 'hard', raw: keysCam({ keys: [
    { f: 391, pos: [-8.5, 2.4, 8.5], look: [-0.5, 1.0, 2.5], fov: 42 },
    { f: 638, pos: [-7.2, 2.0, 7.6], look: [0, 1.0, 2.0], fov: 38, ease: 'surge' }] }) },
  dialogue: { cut: 'hard', raw: pushInCam({ subject: driverPos3, a: 639, b: 743, d0: 3.0, d1: 2.6, h0: 1.45, h1: 1.35, lookOff: [0, 0.9, 0], fov0: 36, fov1: 32,
    dir: () => [0.44, 0.9] }) },
  feathers: { cut: 'hard', raw: staticTrackCam({ pos: [-5.0, 2.2, -3.5], subject: peacockPos3, lookOff: [0, 0.9, 0], fov: 36 }) },
  brake: { cut: 'hard', raw: keysCam({ keys: [
    { f: 806, pos: [6.5, 2.6, 9.5], look: [-4, 1.0, 2.0], fov: 40 },
    { f: 972, pos: [4.5, 2.2, 8.2], look: [-6, 1.0, 2.0], fov: 36, ease: 'surge' }] }) },
  eat: { cut: 'hard', raw: pushInCam({ subject: peacockPos3, a: 973, b: 1086, d0: 5.2, d1: 3.9, h0: 1.6, h1: 1.4, lookOff: [0, 0.7, 0], fov0: 36, fov1: 32,
    dir: () => [0.5, 0.85] }) },
  boy: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1087, pos: [7.5, 2.6, 10.5], look: [0.5, 1.1, 3.5], fov: 42 },
    { f: 1300, pos: [6.0, 2.3, 9.2], look: [-1, 1.1, 3.0], fov: 38, ease: 'surge' }] }) },
  twist: { cut: 'hard', raw: pushInCam({ subject: peacockPos3, a: 1301, b: 1396, d0: 4.4, d1: 3.1, h0: 1.6, h1: 1.45, lookOff: [0, 0.8, 0], fov0: 36, fov1: 30,
    dir: () => [0.4, 0.9] }) },
  hookq: { cut: 'blend', blend: 10, raw: keysCam({ keys: [
    { f: 1397, pos: [5.6, 3.1, 7.8], look: [0.1, 2.9, -5.9], fov: 40 },
    { f: 1497, pos: [5.1, 3.2, 7.3], look: [0.05, 3.0, -5.95], fov: 37, ease: 'surge' }] }) },
  hook: { cut: 'hard', raw: keysCam({ keys: [
    { f: 1498, pos: [5.1, 3.2, 7.3], look: [0.05, 3.0, -5.95], fov: 37 },
    { f: 1563, pos: [4.9, 3.25, 7.1], look: [0.02, 3.05, -5.97], fov: 36, ease: 'surge' }] }) },
};
const RIG = buildRig({
  total: TOTAL,
  shots: SHOTS.map((s) => ({ a: s.a, b: s.b, ...RIG_BY_ID[s.id] })),
  kicks: [{ f: 716, a: 0.03 }, { f: 872, a: 0.03 }],
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
  if (['dialogue', 'feathers', 'eat', 'twist'].includes(S.id)) cinf = 3.6;
  if (S.id === 'hook') cinf = 3.0;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f), p = peacockAt(f);
  const W = {
    boardTitle: 0, boardHook: 0,
    trainX: trainFrontAt(f), trainSpeed: trainSpeedAt(f),
    peacockX: p.x, peacockY: p.y, peacockZ: p.z, peacockRy: p.ry,
    fanK: fanAt(f), peckK: peckAt(f),
    grainShowerK: grainShowerAt(f), grainPileK: grainPileAt(f),
    dustK: dustAt(f), glintK: glintAt(f),
    signalK: S.id === 'cab' ? 1 : 0.85,
  };
  if (S.id === 'drone') W.boardTitle = smooth(ramp(f, 28, 45)) * (1 - smooth(ramp(f, 63, 80)));
  if (S.id === 'hookq') W.boardHook = smooth(ramp(f, 1500, 1524));
  if (S.id === 'hook') W.boardHook = 1;   // held at FULL opacity to the literal last frame
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return { smokeRate: clamp(trainSpeedAt(f) * 22, 0, 1.2), dustRate: dustAt(f), splashRate: 0, steamRate: 0, shimmerRate: 0.08, grey: 0 };
};
export const fxAt = (f) => {
  // No card FX here: the brake ground-ring is a flat THREE ring mesh in
  // main.js (a vertical billboard card would float). Dust + ring + kick
  // are driven by dustAt() / the rig kicks in story.
  return [];
};

// ---------- cast (single source for actors AND colliders) ----------
const TINT = { sunny: '#ffffff' };
const tintFor = () => TINT.sunny;
export const OUTFITS = {
  driver: { jacket: '#1f3a5f', pants: '#23283a', boots: '#1c1712', hat: 'cap', cap: '#1f3a5f', skin: '#c98a5a', moustache: '#241a12' },
  inspector: { jacket: '#6b5a2e', pants: '#4a4238', boots: '#1c1712', hat: 'cap', cap: '#3a2f1a', skin: '#a06a3c', moustache: '#241a12' },
  boy: { jacket: '#d8a03a', pants: '#f1e6cf', boots: '#6a4a3a', hat: 'hair', hair: '#1c1410', skin: '#8a5a34', build: 'kid' },
};
export const INSPECTOR_POS = { x: -2.5, z: 4.2 };
export const BOY_POS = { x: 3.5, z: 4.2 };
export const castAt = (f) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const std = (id, o, opts, x, y, z, extra = {}) => out.push({ id, x, y, z, r: 0.32, ground: y,
    actor: (T) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x, y, z, ground: y, tint, ...extra }) });
  const d = driverAt(f);
  const dBase = { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 21), seed: 21 };
  switch (S.id) {
    case 'drone': {
      // driver inside the cab, leaning out — the train is far away, small
      std('driver', OUTFITS.driver, { ...dBase }, d.x, d.y, d.z, { yaw: 0.3, s: 0.6 });
      break;
    }
    case 'cab': {
      std('driver', OUTFITS.driver, { ...dBase, expr: 'neutral', prop: f >= 300 ? ['point', 0.5] : null }, d.x, d.y, d.z, { yaw: 0.3, s: 0.6 });
      break;
    }
    case 'inspector': {
      std('driver', OUTFITS.driver, { ...dBase }, d.x, d.y, d.z, { yaw: 0.3, s: 0.6 });
      std('inspector', OUTFITS.inspector, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 41), seed: 41, prop: f >= 560 ? ['point', 0.7] : null }, INSPECTOR_POS.x, 0, INSPECTOR_POS.z, { yaw: -0.4 });
      break;
    }
    case 'dialogue': {
      // THE dialogue beat: the driver PERFORMS "पटरी पर भीड़ खड़ी है!"
      // — mouth driven by the stem inside f639-673, closed outside it
      // (the "ब्रेक खींच लिया" tag is narration: mouth stays closed).
      std('driver', OUTFITS.driver, { mode: 'stand', blink: blinkAt(f, 21), seed: 21, look: 0.15, ...speakFace('shock', f) }, d.x, d.y, d.z, { yaw: 0.25, s: 0.62 });
      std('inspector', OUTFITS.inspector, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, INSPECTOR_POS.x, 0, INSPECTOR_POS.z, { yaw: -0.4 });
      break;
    }
    case 'feathers': {
      std('driver', OUTFITS.driver, { ...dBase, expr: 'shock' }, d.x, d.y, d.z, { yaw: 0.3, s: 0.6 });
      std('inspector', OUTFITS.inspector, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 41), seed: 41, prop: ['point', 0.7] }, INSPECTOR_POS.x, 0, INSPECTOR_POS.z, { yaw: -0.4 });
      break;
    }
    case 'brake': {
      std('driver', OUTFITS.driver, { ...dBase, expr: 'shock' }, d.x, d.y, d.z, { yaw: 0.3, s: 0.6 });
      std('inspector', OUTFITS.inspector, { expr: f >= 865 ? 'laugh' : 'shock', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, INSPECTOR_POS.x, 0, INSPECTOR_POS.z, { yaw: -0.4 });
      break;
    }
    case 'eat': {
      std('driver', OUTFITS.driver, { ...dBase, expr: 'relief' }, d.x, d.y, d.z, { yaw: 0.3, s: 0.6 });
      std('inspector', OUTFITS.inspector, { expr: 'laugh', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, INSPECTOR_POS.x, 0, INSPECTOR_POS.z, { yaw: -0.4 });
      break;
    }
    case 'boy': {
      std('driver', OUTFITS.driver, { ...dBase, expr: 'relief' }, d.x, d.y, d.z, { yaw: 0.3, s: 0.6 });
      std('inspector', OUTFITS.inspector, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, INSPECTOR_POS.x, 0, INSPECTOR_POS.z, { yaw: -0.4 });
      std('boy', OUTFITS.boy, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.65] }, BOY_POS.x, 0, BOY_POS.z, { yaw: 0.5 });
      break;
    }
    case 'twist': {
      std('inspector', OUTFITS.inspector, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 41), seed: 41 }, INSPECTOR_POS.x, 0, INSPECTOR_POS.z, { yaw: -0.4 });
      std('boy', OUTFITS.boy, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 31), seed: 31 }, BOY_POS.x, 0, BOY_POS.z, { yaw: 0.5 });
      break;
    }
    case 'hookq': case 'hook': break;
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity: statics, dynamics, ground (LIBRARY v4 gate data) ----------
export const STATICS = [
  SOL.aabb(PLATFORM.x - 10, PLATFORM.x + 10, PLATFORM.z - 1.5, PLATFORM.z + 1.5, { h: PLATFORM.top, id: 'platform' }),
  SOL.obb(HUT.x, HUT.z, HUT.ry, 1.4, 1.1, { h: 2.8, id: 'hut' }),
  SOL.circle(SIGNAL.x, SIGNAL.z, 0.08, { h: 2.2, id: 'signal' }),
  SOL.circle(BOARD_POS[0] - 2.1, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  SOL.circle(BOARD_POS[0] + 2.1, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  SOL.circle(-9, 4.9, 0.09, { h: 2.6, id: 'lampW' }),
  SOL.circle(9, 4.9, 0.09, { h: 2.6, id: 'lampE' }),
  ...TREES.map(([x, z], i) => SOL.circle(x, z, 0.35, { h: 4.4, id: 'tree' + i })),
];
export const WORLD = SOL.makeWorld(STATICS);
export const dynamicsAt = (f) => {
  const out = [];
  const d = driverAt(f);
  // driver rides WITH the train: same group 'train' as the train OBB,
  // so the rider never reports against his own vehicle.
  out.push(SOL.circle(d.x, d.z, 0.3, { kind: 'dynamic', id: 'driver', group: 'train' }));
  out.push(SOL.obb(trainFrontAt(f) - 8.25, TRACK_Z, 0, 8.25, 0.95, { kind: 'dynamic', id: 'train', group: 'train' }));
  const p = peacockAt(f);
  out.push(SOL.circle(p.x, p.z, 0.4, { kind: 'dynamic', id: 'peacock' }));
  for (const a of castAt(f)) {
    if (a.id === 'driver') continue; // already added above (grouped)
    out.push(SOL.circle(a.x, a.z, a.r, { kind: 'dynamic', id: a.id }));
  }
  return out;
};
export const groundItemsAt = (f) => {
  const items = [];
  const p = peacockAt(f);
  // peacock stands ON the sleepers (top y=0.18) — planted, never hovering
  items.push({ id: 'peacock', y: p.y, ground: 0.18, maxHover: 0.03 });
  // grain pile rests on the sleepers once it has fallen
  if (grainPileAt(f) > 0.01) items.push({ id: 'grainpile', y: 0.18, ground: 0.18, maxHover: 0.03 });
  for (const a of castAt(f)) {
    // the driver rides in the cab (not ground-standing); everyone else
    // stands on the ground (y=0) beside the track.
    if (a.id === 'driver') continue;
    items.push({ id: a.id, y: a.y, ground: 0, maxHover: 0.06 });
  }
  return items;
};
