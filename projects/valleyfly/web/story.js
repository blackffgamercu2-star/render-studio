// Shot plan for "The Man Who Flew Across the Valley" — valleyfly
// (SALTED MINE V3 style: painted world, round-white-head cards, word-by-
// word captions, body.js actions, speak.js dialogue performance).
// SAMPLE for Abid's NEW ACTION-CAMERA standard (Zack D Films energy):
// camera velocity is keyed to the subject — flight beats are shot AT
// FLIGHT SPEED (side-tracking that keeps pace, an over-shoulder POV
// rush down the cable, front three-quarter chases), the launch gets a
// fast eased push-in (head ~19% -> ~75%), impacts (both landings) get
// declared kicks, beat changes are whip reframes or clause cuts, and
// reaction faces are punched in FAST. NO slow drift, NO static holds.
// The trick: a steel cable runs cliff to cliff (x=2.2), hidden against
// the dawn sky; a harness + wheel under his long coat does the flying.
// Voice stem: 60.171 s, 30 fps, TOTAL 1805; timings from faster-whisper
// small full-file decode (words.json / timing.json, match 0.986). Scene
// changes ONLY at clause (script-line) boundaries:
//   L1  open     Every morning... steps off a cliff — and flies.
//   L2  bridge   The bridge below takes two hours; he crosses <1 min.
//   L3  shop     Traders asleep when his shop was already open.
//   L4  launch   Three running steps, coat like wings, hurled himself.
//   L5  flight   Wind snatched his coat wide; shot across, legs kicking.
//   L6  shadow   Children set clocks by his shadow sweeping past.
//   L7  bet      Old Marta bet a sack of flour no man could fly.
//   L8  faster   He laughed, tightened his belt, flew faster than ever.
//   L9  pine     Her grandson climbed the pine before sunrise.
//   L10 glint    Sunlight struck something thin and bright above him.
//   L11 cable    A steel cable, cliff to cliff, hidden for years.
//   L12 harness  Beneath the coat: harness + a wheel on the cable.
//   L13 shout    The boy shouted the secret from the landing rock.
//   L14 unclip   The shopkeeper unclipped himself, grinned, and said:
//   L15 dialogue "I never flew, friends. The wire did the flying…"
//   L16 hook     But tomorrow… the woman who cooked without any fire?
// GRADE: Golden Hour — one dawn arc for the whole short, warm low sun,
// boards/text NEVER graded. Grade never changes mid-clause.
// R2 FRAMING (still mandatory): hero BIG from f0 (head ~39% growing to
// ~61% in the opening track); inserts fill 85-95% (the cable glint, the
// harness/wheel close track); action beats front/front three-quarter,
// NEVER behind the cards; dialogue performed close (head ~63%);
// FINAL = character beat + hook board together (board ~84% of frame
// width, hero head ~20% in the foreground, board at full opacity
// through the literal final frame).
import { M, blinkAt, q, clamp, lerp, ramp, kf } from './motion.js';
import { buildRig, keysCam } from './camrig.js';
import { poseWindows, winkTrack } from './body.js';
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

export const FPS = 30, TOTAL = 1805, DECK = 0;
// Shot boundaries (frames) — snapped to timing.json phrase starts.
export const BND = [0, 133, 231, 338, 484, 607, 705, 819, 932, 1042, 1154, 1281, 1414, 1511, 1579, 1714, 1805];
const IDS = ['open', 'bridge', 'shop', 'launch', 'flight', 'shadow', 'bet', 'faster', 'pine', 'glint', 'cable', 'harness', 'shout', 'unclip', 'dialogue', 'hook'];
export const SHOTS = IDS.map((id, i) => ({ id, a: BND[i], b: BND[i + 1] - 1, light: 'gold' }));
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
const F = (id) => SHOTS.find((s) => s.id === id);
const B = (id) => F(id).a, E = (id) => F(id).b;

// ---------- lights / mood grade (Golden Hour, one dawn arc) ----------
export const LIGHTS = {
  gold: { az: 105, el: 26, sky: '#f6cf9a', ground: '#7a6a44', hemi: 0.85, sun: '#ffb45e', sunI: 1.6, fog: '#f2cf9e', fogNear: 60, fogFar: 320,
    skyTop: '#3f6fb4', skyHor: '#f7c98a', sunDisc: '#ffdfae', sunSize: 0.006, sat: 1.12, vig: 0.2, shadowExt: 42, aurora: 0, gain: '#ffe9c4',
    waterDeep: '#274b5c', waterShal: '#4a7d8c', glint: '#ffe9c0' },
};
export const lightFor = (S, f) => ({ ...LIGHTS.gold });

// ---------- the cable + flight model (single source of truth) ----------
export const CABLE_A = [2.2, 8.6, 10.5];    // home anchor (wheel rest)
export const CABLE_B = [2.2, 8.6, -13.5];   // far anchor
export const SAG = 1.5, HANG = 2.8;         // wheel -> dangling feet
export const cablePoint = (u) => {
  const w = 1 - Math.pow(2 * u - 1, 2);
  return [2.2, 8.6 - SAG * w, lerp(CABLE_A[2], CABLE_B[2], u)];
};
export const flyPos = (u) => { const c = cablePoint(u); return [c[0], c[1] - HANG, c[2]]; };
export const ROCK_B = { x: 1.6, z: -15.2, top: 0.55 };   // far landing rock
export const ROCK_HOME = { x: 5.8, z: 11.8, top: 0.62 }; // the boy's shout rock
export const PINE = { x: -4.5, z: 12.5, perch: 4.42 };
export const BOARD_POS = [0, 3.0, -16.8];   // stands IN FRONT of the shop front face (z=-18.9) — at z=-21 it was INSIDE the shop box and fully occluded (fix pass 2026-11-18)

const uLin = (f, f0, f1, u0, u1) => lerp(u0, u1, clamp((f - f0) / (f1 - f0), 0, 1));
// The shopkeeper's physical state at frame f (used by cast, the wheel
// rig in main.js, the shadow blob and the DOF focus).
export const flyAt = (f) => {
  const S = shotAt(f), id = S.id;
  const air = (u, extra = {}) => ({ air: true, u, pos: flyPos(u), ...extra });
  switch (id) {
    case 'open': return air(uLin(f, B('open'), E('open'), 0.30, 0.78));
    case 'bridge': return f < 202 ? air(clamp((f - 140) / 62, 0, 1)) : { air: false, gone: true, pos: [1.6, ROCK_B.top, ROCK_B.z] };
    case 'shop': {
      if (f < 243) { const k = smooth(ramp(f, 231, 243)); const p = flyPos(1); return { air: true, u: 1, land: k, pos: [lerp(p[0], ROCK_B.x, k), lerp(p[1], ROCK_B.top, k), lerp(p[2], ROCK_B.z, k)] }; }
      if (f < 262) return { air: false, sub: 'unclip', pos: [ROCK_B.x, ROCK_B.top, ROCK_B.z] };
      if (f < 300) { const k = (f - 262) / 38; return { air: false, sub: 'walk', phase: k * 3.4, pos: [lerp(ROCK_B.x, 0.6, k), ROCK_B.top * (1 - k), lerp(ROCK_B.z, -17.6, k)] }; }
      return { air: false, sub: 'door', pos: [0.6, 0, -17.6] };
    }
    case 'launch': {
      if (f < 453) { const k = (f - 338) / 115; return { air: false, sub: 'run', phase: k * k * 9 + k * 2, pos: [2.2, 0, lerp(21, 10.8, k * k * 0.35 + k * 0.65)] }; }
      const k = smooth(ramp(f, 453, 483)); const p = flyPos(0.045);
      return { air: true, u: 0.045 * k, leap: k, pos: [2.2, lerp(0, p[1], k) + Math.sin(k * Math.PI) * 0.45, lerp(10.8, p[2], k)] };
    }
    case 'flight': return air(uLin(f, B('flight'), E('flight'), 0.06, 0.92));
    case 'shadow': {
      if (f < 668) return air(uLin(f, 612, 668, 0.55, 1.0));
      return { air: false, sub: 'stand', pos: [ROCK_B.x, ROCK_B.top, ROCK_B.z] };
    }
    case 'faster': {
      if (f < 873) return { air: false, sub: 'belt', pos: [2.2, 0, 13.5] };
      if (f < 896) { const k = (f - 873) / 23; return { air: false, sub: 'run', phase: k * 5.5, pos: [2.2, 0, lerp(13.5, 10.8, k)] }; }
      const k = smooth(ramp(f, 896, 931)); const p = flyPos(0.30);
      return { air: true, u: 0.30 * k, leap: k, pos: [2.2, lerp(0, p[1], k) + Math.sin(k * Math.PI) * 0.4, lerp(10.8, p[2], k)] };
    }
    case 'glint': return air(uLin(f, 1048, 1140, 0.20, 0.85));
    case 'cable': return air(uLin(f, B('cable'), E('cable'), 0.12, 0.88));
    case 'harness': return air(uLin(f, B('harness'), E('harness'), 0.30, 0.82));
    case 'unclip': {
      if (f < 1531) return air(uLin(f, 1511, 1531, 0.82, 1.0));
      if (f < 1536) { const k = smooth(ramp(f, 1531, 1536)); const p = flyPos(1); return { air: true, u: 1, land: k, pos: [lerp(p[0], ROCK_B.x, k), lerp(p[1], ROCK_B.top, k), lerp(p[2], ROCK_B.z, k)] }; }
      return { air: false, sub: 'unclip', pos: [ROCK_B.x, ROCK_B.top, ROCK_B.z] };
    }
    case 'dialogue': return { air: false, sub: 'stand', pos: [ROCK_B.x, ROCK_B.top, -15.0] };
    case 'hook': return { air: false, sub: 'stand', pos: [1.9, 0, -11.2] };
    default: return { air: false, gone: true, pos: [2.2, 0, 14] };
  }
};
// wheel state for main.js: rides the cable while he flies; after the
// unclip landing he takes it down and hangs it on the far post hook.
export const wheelAt = (f) => {
  const S = shotAt(f), fl = flyAt(f);
  if (S.id === 'unclip' && f >= 1536) {
    if (f < 1562) { const k = smooth(ramp(f, 1536, 1562)); return { mode: 'held', pos: [lerp(fl.pos[0] + 0.3, 3.35, k), lerp(fl.pos[1] + 2.2, 1.78, k), lerp(fl.pos[2], -14.05, k)] }; }
    return { mode: 'hook', pos: [3.35, 1.78, -14.05] };
  }
  if (S.id === 'dialogue' || S.id === 'hook') return { mode: 'hook', pos: [3.35, 1.78, -14.05] };
  if (fl.air) return { mode: 'cable', pos: cablePoint(fl.u || 0), u: fl.u || 0 };
  if (S.id === 'shop' && f >= 243) return { mode: 'hook', pos: [3.35, 1.78, -14.05] };
  if (S.id === 'launch' && f < 453) return { mode: 'cable', pos: [...CABLE_A], u: 0 };
  if (S.id === 'faster' && f < 896) return { mode: 'cable', pos: [...CABLE_A], u: 0 };
  return { mode: 'cable', pos: [...CABLE_B], u: 1 };
};

// ---------- body.js performance tracks ----------
const shopWink = winkTrack([{ a: 1511 + 58, b: 1511 + 73 }]);
const micro = (f, seed) => 1.1 * Math.sin((f + seed * 5) * 0.037 + 1);
const head = (f, seed, tilt, look, lookY, facing = 0, squash = 0) => ({
  headTilt: q(tilt + micro(f, seed), 1), look: q(look, 2), lookY: q(lookY, 2), facing: q(facing, 2), squash: q(squash, 2),
});

// ---------- hero / focus ----------
const FOCUS = {
  open: (f) => { const p = flyAt(f).pos; return [p[0], p[1] + 1.8, p[2]]; },
  bridge: (f) => f < 205 ? [2.2, 5.5, -1] : [-11, -22.6, -1.2],
  shop: () => [1.2, 1.4, -16.6],
  launch: (f) => { const p = flyAt(f).pos; return [p[0], p[1] + 1.6, p[2]]; },
  flight: (f) => { const p = flyAt(f).pos; return [p[0], p[1] + 1.8, p[2]]; },
  shadow: () => [-4.4, 1.5, -19.2],
  bet: () => [-1.2, 1.55, 14.5],
  faster: (f) => { const p = flyAt(f).pos; return [p[0], p[1] + 1.6, p[2]]; },
  pine: (f) => [-4.12, boyY(f) + 1.05, 12.5],
  glint: (f) => { const p = flyAt(f).pos; return [p[0], p[1] + 1.9, p[2]]; },
  cable: () => [2.2, 7.1, -1.5],
  harness: (f) => { const p = flyAt(f).pos; return [p[0], p[1] + 2.2, p[2]]; },
  shout: () => [ROCK_HOME.x, ROCK_HOME.top + 1.1, ROCK_HOME.z],
  unclip: () => [ROCK_B.x, ROCK_B.top + 1.5, -15.1],
  dialogue: () => [ROCK_B.x, ROCK_B.top + 1.62, -15.0],
  hook: () => BOARD_POS,
};
export const heroPosAt = (f) => FOCUS[shotAt(f).id](f);
// the grandson's climb (pine shot): feet height on the trunk
export const boyY = (f) => {
  if (shotAt(f).id !== 'pine') return 0;
  const k = smooth(ramp(f, 940, 1008));
  return PINE.perch * k;
};

// ---------- cameras: ACTION RIG — every move keyed to the subject ----------
// Offsets are flown WITH the subject on the flight beats; push-ins are
// fast eased dives (keysCam Catmull-Rom + 'io' ease), reframes between
// phases are declared whips, landings get declared kicks. The rig runs
// a tight smoothing pass (sigma 1.7 / radius 5, vs shepherd's 3.2 / 10)
// so authored speed survives to the screen.
const RIG_SHOTS = [
  // OPENING: front three-quarter chase, head ~39% -> ~61% while he flies.
  { id: 'open', cut: 'hard', raw: keysCam({ keys: [
    { f: B('open'), pos: [3.75, 5.29, 0.55], look: [2.2, 6.34, 3.3], fov: 41 },
    { f: B('open') + 66, pos: [3.55, 4.96, -4.81], look: [2.2, 6.11, -2.46], fov: 39, ease: 'io' },
    { f: E('open'), pos: [3.35, 5.32, -10.17], look: [2.2, 6.57, -8.22], fov: 37, ease: 'io' }] }) },
  // BRIDGE: high wide, the camera whips WITH him across, then dives its
  // look down to the tiny bridge walker still trudging.
  { id: 'bridge', cut: 'hard', raw: keysCam({ keys: [
    { f: B('bridge'), pos: [10.5, 10.5, 16], look: [0, -4, -2], fov: 44 },
    { f: B('bridge') + 37, pos: [7.5, 9.0, 2], look: [2.2, 6.1, -1.1], fov: 42, ease: 'io' },
    { f: B('bridge') + 72, pos: [4.5, 6.0, -4], look: [-11, -22.4, -1.5], fov: 42, ease: 'io' },
    { f: E('bridge'), pos: [4.2, 5.6, -4.6], look: [-10.6, -22.5, -1.4], fov: 41, ease: 'io' }] }) },
  { id: 'shop', cut: 'hard', raw: keysCam({ keys: [
    { f: B('shop'), pos: [4.6, 2.4, -8.8], look: [1.6, 2.2, -15.4], fov: 40 },
    { f: B('shop') + 49, pos: [4.3, 2.25, -9.7], look: [1.2, 1.5, -16.8], fov: 38, ease: 'io' },
    { f: E('shop'), pos: [3.9, 2.1, -10.6], look: [0.9, 1.45, -17.6], fov: 36, ease: 'io' }] }) },
  // LAUNCH: low front three-quarter tracking the run, then a FAST dive
  // at the leap — head ~31% (f465) -> ~61% (f483) in 18 frames.
  { id: 'launch', cut: 'hard', raw: keysCam({ keys: [
    { f: B('launch'), pos: [5.4, 1.6, 15.5], look: [2.2, 1.35, 20.4], fov: 42 },
    { f: B('launch') + 92, pos: [4.9, 1.45, 8.8], look: [2.2, 1.4, 13.9], fov: 40, ease: 'io' },
    { f: B('launch') + 127, pos: [4.3, 2.4, 7.0], look: [2.2, 1.5, 10.84], fov: 38, ease: 'io' },
    { f: E('launch'), pos: [2.92, 5.3, 8.32], look: [2.2, 7.05, 9.42], fov: 35, ease: 'io' }] }) },
  // FLIGHT: side-track at flight speed -> over-shoulder POV rush down
  // the cable -> front three-quarter chase for the far approach.
  { id: 'flight', cut: 'hard', raw: keysCam({ keys: [
    { f: B('flight'), pos: [7.2, 6.36, 9.66], look: [2.2, 7.26, 9.06], fov: 40 },
    { f: B('flight') + 46, pos: [6.6, 6.0, 0.9], look: [2.2, 6.18, 1.28], fov: 38, ease: 'io' },
    { f: B('flight') + 68, pos: [2.75, 7.06, -0.89], look: [2.2, 7.9, -11.0], fov: 46, ease: 'io' },
    { f: B('flight') + 88, pos: [2.75, 7.24, -4.27], look: [2.2, 7.9, -11.5], fov: 46, ease: 'io' },
    { f: B('flight') + 104, pos: [5.1, 5.51, -11.93], look: [2.2, 6.61, -8.53], fov: 38, ease: 'io' },
    { f: E('flight'), pos: [4.5, 5.96, -14.28], look: [2.2, 7.16, -11.58], fov: 36, ease: 'io' }] }) },
  { id: 'shadow', cut: 'hard', raw: keysCam({ keys: [
    { f: B('shadow'), pos: [-8.6, 1.5, -11.8], look: [-3.4, 1.6, -18.6], fov: 42 },
    { f: B('shadow') + 53, pos: [-8.2, 1.48, -12.3], look: [-3.5, 1.58, -18.5], fov: 40, ease: 'io' },
    { f: E('shadow'), pos: [-7.7, 1.45, -12.9], look: [-3.6, 1.55, -18.4], fov: 38, ease: 'io' }] }) },
  // BET: reaction punch-in — Marta's face 22% -> ~52% in 14 frames,
  // settling to ~72% as she shakes her fist at the sky.
  { id: 'bet', cut: 'hard', raw: keysCam({ keys: [
    { f: B('bet'), pos: [1.9, 1.7, 19.8], look: [-1.15, 1.5, 14.6], fov: 40 },
    { f: B('bet') + 14, pos: [0.35, 1.62, 16.9], look: [-1.18, 1.52, 14.55], fov: 36, ease: 'io' },
    { f: B('bet') + 55, pos: [-0.15, 1.6, 16.35], look: [-1.19, 1.53, 14.52], fov: 34, ease: 'io' },
    { f: E('bet'), pos: [-0.05, 1.58, 16.5], look: [-1.19, 1.53, 14.52], fov: 34, ease: 'io' }] }) },
  { id: 'fasterA', a: B('faster'), b: 872, cut: 'hard', raw: keysCam({ keys: [
    { f: B('faster'), pos: [3.9, 1.6, 16.3], look: [2.2, 1.5, 13.6], fov: 38 },
    { f: 872, pos: [3.65, 1.58, 15.8], look: [2.2, 1.52, 13.55], fov: 37, ease: 'io' }] }) },
  // WHIP reframe from the belt close-up to the run/leap track.
  { id: 'fasterB', a: 873, b: E('faster'), cut: 'whip', blend: 8, raw: keysCam({ keys: [
    { f: 873, pos: [5.2, 1.5, 16.8], look: [2.2, 1.3, 13.2], fov: 40 },
    { f: 900, pos: [4.6, 2.2, 12.2], look: [2.2, 2.6, 10.9], fov: 38, ease: 'io' },
    { f: E('faster'), pos: [6.4, 5.6, 4.6], look: [2.2, 6.34, 3.3], fov: 40, ease: 'io' }] }) },
  // PINE: low angle at the trunk, cranes UP fast with the climbing boy.
  { id: 'pine', cut: 'hard', raw: keysCam({ keys: [
    { f: B('pine'), pos: [-0.9, 0.8, 17.2], look: [-4.15, 1.1, 12.55], fov: 42 },
    { f: B('pine') + 73, pos: [-2.2, 3.2, 15.6], look: [-4.13, 4.7, 12.52], fov: 40, ease: 'io' },
    { f: E('pine'), pos: [-2.6, 4.9, 14.6], look: [-4.12, 5.25, 12.5], fov: 38, ease: 'io' }] }) },
  // GLINT: the boy's POV from the pine — snap in (whip), the cable runs
  // diagonal across frame, micro-push toward the glint point.
  { id: 'glint', cut: 'whip', blend: 6, raw: keysCam({ keys: [
    { f: B('glint'), pos: [-4.05, 5.35, 12.45], look: [2.2, 7.3, 1.5], fov: 44 },
    { f: B('glint') + 53, pos: [-3.95, 5.33, 12.35], look: [2.2, 7.05, -0.7], fov: 44, ease: 'io' },
    { f: E('glint'), pos: [-3.8, 5.3, 12.2], look: [2.2, 6.5, -6.5], fov: 43, ease: 'io' }] }) },
  // CABLE REVEAL: tight on the mid-span cable, a FAST pull-back (18
  // frames) to the whole cliff-to-cliff line against the sky, then a
  // long PUSH-IN along the gorge that chases the flyer down the cable
  // (hero ~7% at the wide -> ~20% by shot end; fix pass 2026-11-18 —
  // the original held the dead wide for ~89 frames).
  { id: 'cable', cut: 'hard', raw: keysCam({ keys: [
    { f: B('cable'), pos: [6.9, 8.9, 3.4], look: [2.2, 7.1, -1.5], fov: 34 },
    { f: B('cable') + 18, pos: [13.5, 7.6, 12.5], look: [0.5, 3.4, -2.0], fov: 44, ease: 'io' },
    { f: B('cable') + 62, pos: [10.5, 7.3, 3.5], look: [2.2, 6.0, -1.4], fov: 42, ease: 'io' },
    { f: E('cable'), pos: [7.4, 6.9, -5.6], look: [2.2, 6.3, -10.5], fov: 40, ease: 'io' }] }) },
  // HARNESS INSERT: rides at his shoulder — wheel top, cable diagonal,
  // the X harness across his chest, coat flapping at frame edge.
  { id: 'harness', cut: 'hard', raw: keysCam({ keys: [
    { f: B('harness'), pos: [4.5, 6.89, 1.4], look: [2.2, 6.69, 3.3], fov: 37 },
    { f: B('harness') + 66, pos: [4.5, 6.67, -4.84], look: [2.2, 6.47, -2.94], fov: 37, ease: 'io' },
    { f: E('harness'), pos: [4.5, 7.26, -11.08], look: [2.2, 7.06, -9.18], fov: 37, ease: 'io' }] }) },
  { id: 'shout', cut: 'hard', raw: keysCam({ keys: [
    { f: B('shout'), pos: [3.4, 1.15, 16.9], look: [5.7, 1.75, 11.9], fov: 40 },
    { f: E('shout'), pos: [4.6, 1.4, 14.3], look: [5.75, 1.85, 11.85], fov: 36, ease: 'io' }] }) },
  { id: 'unclip', cut: 'hard', raw: keysCam({ keys: [
    { f: B('unclip'), pos: [5.3, 2.2, -10.2], look: [2.2, 5.6, -11.5], fov: 40 },
    { f: B('unclip') + 20, pos: [4.6, 1.9, -11.3], look: [1.8, 2.2, -15.0], fov: 38, ease: 'io' },
    { f: E('unclip'), pos: [3.6, 1.75, -12.6], look: [1.68, 1.95, -15.1], fov: 36, ease: 'io' }] }) },
  // DIALOGUE: fast punch-in (11 frames) to the speaking face ~63%,
  // then the camera HOLDS on the speaker (micro-push only).
  { id: 'dialogue', cut: 'hard', raw: keysCam({ keys: [
    { f: B('dialogue'), pos: [3.6, 1.75, -12.6], look: [1.62, 2.1, -15.05], fov: 36 },
    { f: B('dialogue') + 11, pos: [3.05, 1.82, -13.15], look: [1.6, 2.14, -15.02], fov: 35, ease: 'io' },
    { f: E('dialogue'), pos: [2.95, 1.8, -13.3], look: [1.6, 2.14, -15.02], fov: 35, ease: 'io' }] }) },
  // FINAL: board ~81-85% of frame width centred upper (board stands in
  // front of the shop at z=-16.8); the shopkeeper stands in the lower
  // foreground at the cliff edge pointing up at tomorrow's tease.
  { id: 'hook', cut: 'hard', raw: keysCam({ keys: [
    { f: B('hook'), pos: [3.5, 2.6, -3.0], look: [-0.15, 2.95, -16.8], fov: 38 },
    { f: E('hook'), pos: [3.35, 2.55, -3.35], look: [-0.15, 2.95, -16.8], fov: 37.5, ease: 'io' }] }) },
];
const rigShots = RIG_SHOTS.map((s) => s.a !== undefined ? s : { a: B(s.id), b: E(s.id), cut: s.cut, blend: s.blend || 0, raw: s.raw });
const RIG = buildRig({
  total: TOTAL,
  shots: rigShots,
  kicks: [{ f: 243, a: 0.12 }, { f: 742, a: 0.05 }, { f: 1531, a: 0.13 }],
  sigma: 1.7, smoothRadius: 5, fovSigma: 1.1,
});
export const camAt = (f) => RIG.camAt(f);
export const RIG_META = {
  kicks: RIG.declared.kicks, hardCuts: RIG.declared.hardCuts,
  blends: [],
  whips: RIG.declared.whips,
  samples: RIG.samples,
};
const CINF = { open: 1.6, bridge: 1.0, shop: 2.2, launch: 2.0, flight: 1.8, shadow: 2.2, bet: 2.8, faster: 2.2, pine: 2.4, glint: 1.1, cable: 0.55, harness: 3.0, shout: 2.4, unclip: 2.6, dialogue: 3.6, hook: 0.45 };
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), hp = heroPosAt(f);
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf: CINF[S.id] ?? 2.0 };
};

// ---------- world state ----------
const pulse = (f, c, w) => Math.exp(-Math.pow((f - c) / w, 2));
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { boardHook: 0, dustK: 0.04, glintK: 0, windK: 0.2 };
  if (S.id === 'hook') W.boardHook = f < B('hook') + 20 ? smooth(ramp(f, B('hook') + 2, B('hook') + 20)) : 1;  // held at FULL opacity to the literal last frame
  W.dustK = Math.max(pulse(f, 248, 7), pulse(f, 458, 6), pulse(f, 901, 6), pulse(f, 1536, 7));
  if (S.id === 'glint') W.glintK = pulse(f, 1097, 7);
  const fl = flyAt(f);
  if (fl.air) W.windK = 1;
  return W;
};
export const fxProfileAt = (f) => {
  const W = worldAt(f);
  return {
    moteRate: 0.25 + W.windK * 1.1,   // wind-borne specks rush past on the flight beats
    sprayRate: 0,
    smokeRate: 0.02, dustRate: 0.05,
  };
};
export const fxAt = () => [];

// ---------- cast (single source for actors AND colliders) ----------
const TINT = { gold: '#ffe9c9' };
export const OUTFITS = {
  shopkeeper: { jacket: '#7a4a21', pants: '#3c3630', boots: '#241a12', hat: 'cap', cap: '#4a3421', skin: '#fbf7ef' },
  marta: { jacket: '#5d4a68', pants: '#3a3542', boots: '#241d18', hat: 'hair', hair: '#c9ced4', skin: '#fbf7ef' },
  boy: { jacket: '#3f6d8e', pants: '#4a3a28', boots: '#2e2015', hat: 'cap', cap: '#b3392e', skin: '#fbf7ef' },
  traderA: { jacket: '#4a3b63', pants: '#2c3038', boots: '#1c1712', hat: 'bowler', hatCol: '#2e2a26', skin: '#fbf7ef' },
  traderB: { jacket: '#6b543a', pants: '#33302c', boots: '#201812', hat: 'cap', cap: '#44586b', skin: '#fbf7ef' },
  traderC: { jacket: '#7a3a4a', pants: '#33302c', boots: '#201812', hat: 'hair', hair: '#241a12', skin: '#fbf7ef' },
  kid1: { jacket: '#a03d2e', pants: '#3a4a5d', boots: '#241a12', hat: 'cap', cap: '#d8a83c', skin: '#fbf7ef' },
  kid2: { jacket: '#3e7a4f', pants: '#4a3a28', boots: '#2e2015', hat: 'hair', hair: '#171008', skin: '#fbf7ef' },
  walker: { jacket: '#5a5148', pants: '#3a3630', boots: '#241a12', hat: 'cap', cap: '#5d5348', skin: '#fbf7ef' },
};
// Card-space overlays (adult 600x1000 card; head centre ~(300,310),
// shoulders ~445, waist ~640, sole 975 — see toon.js bodyFront math).
const drawCoat = (p, spread, flap, col) => {
  const s = spread, fl = flap;
  p.poly([[222, 452], [296, 470], [292, 652], [268 - 150 * s, 692 + fl], [196 - 118 * s, 542 + fl * 0.4]], col);
  p.poly([[378, 452], [304, 470], [308, 652], [332 + 150 * s, 692 - fl], [404 + 118 * s, 542 - fl * 0.4]], col);
};
const drawHarness = (p) => {
  p.band([[262, 462], [338, 606]], '#3a2a18', 13, 2, 'round');
  p.band([[338, 462], [262, 606]], '#3a2a18', 13, 2, 'round');
  p.ell(300, 534, 11, 9, '#c8a24a', 2);
};
const drawVStraps = (p) => {
  p.band([[96, 300], [296, 24]], '#4a3826', 10, 2, 'round');
  p.band([[504, 300], [304, 24]], '#4a3826', 10, 2, 'round');
};
const drawBelt = (p, k) => {
  p.band([[240, 626], [360, 626]], '#3a2a18', 15 + 3 * k, 2, 'round');
  p.poly([[288, 616], [312, 616], [312, 636], [288, 636]], '#c8a24a');
  p.dot(246, 620, 9); p.dot(354, 620, 9);
};
const drawShout = (p, ph) => {
  p.dot(252, 358, 12); p.dot(348, 358, 12);
  for (const r0 of [46, 78]) {
    const r = r0 + ph * 26, pts = [];
    for (let i = 0; i <= 10; i++) { const a = -0.7 + (i / 10) * 1.4; pts.push([300 + Math.sin(a) * r * 1.7, 356 - Math.cos(a) * r * 0.4 - (r - 46) * 0.35]); }
    p.band(pts, '#fff3c8', 3.5, 1, 'round');
  }
};
export const castAt = (f) => {
  const S = shotAt(f), tint = TINT.gold, out = [];
  const std = (id, o, opts, x, z, extra = {}) => out.push({ id, x, y: extra.y ?? 0, z, r: 0.32, ground: extra.ground ?? 0, air: !!extra.air, gone: !!extra.gone, group: extra.group || '',
    actor: (T) => {
      const { ov, ...actorExtra } = extra;
      return { key: 'shx' + JSON.stringify(o) + JSON.stringify(opts) + (extra.y ?? 0) + (ov ? '|ov' + ov : ''),
        draw: (p) => { T.bodyFront(p, o, opts); if (extra.drawOv) extra.drawOv(p); },
        x, y: extra.y ?? 0, z, ground: extra.ground ?? 0, tint, s: extra.s ?? 1, ...actorExtra };
    } });
  const flap = q(Math.sin(f * 0.55) * 14, 1);
  // the shopkeeper in flight: coat spread + harness + V-straps to the wheel
  const flyer = (expr, mode, coat, extra = {}) => {
    const fl = flyAt(f); if (fl.gone) return;
    std('shopkeeper', OUTFITS.shopkeeper, { expr, mode, airY: 28, blink: blinkAt(f, 31), seed: 31,
      phase: q((f * 0.23) % 1, 2), ...head(f, 31, -1, 0.1, -0.05, 0.05) },
      fl.pos[0], fl.pos[2], { y: fl.pos[1], air: true, yaw: 0.12, ov: `c${q(coat, 2)}f${flap}`,
        drawOv: (p) => { drawCoat(p, coat, flap, '#5d3a1a'); drawHarness(p); drawVStraps(p); }, ...extra });
  };
  switch (S.id) {
    case 'open': flyer('grin', 'fall', 0.9); break;
    case 'bridge': {
      if (f < 202) flyer('grin', 'fall', 0.9);
      // the bridge walker: tiny, slow — two hours in one trudging figure
      const wx = -13.5 + (f - B('bridge')) * 0.011;
      std('walker', OUTFITS.walker, { expr: 'neutral', mode: 'march', phase: q((f * 0.045) % 1, 2), blink: blinkAt(f, 91), seed: 91,
        ...head(f, 91, 0, 0, 0.1, 0) }, wx, -1.2, { y: -23.22, ground: -23.22, yaw: 0.2 });
      break;
    }
    case 'shop': {
      const fl = flyAt(f);
      if (fl.air) flyer('grin', 'fall', 0.7);
      else if (fl.sub === 'unclip') std('shopkeeper', OUTFITS.shopkeeper, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, 2, 0, 0.32, 0) }, fl.pos[0], fl.pos[2], { y: fl.pos[1], ground: ROCK_B.top, yaw: 0.2 });
      else if (fl.sub === 'walk') std('shopkeeper', OUTFITS.shopkeeper, { expr: 'smile', mode: 'march', phase: q(fl.phase || 0, 2), blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, -1, 0.1, 0.05, 0.05) }, fl.pos[0], fl.pos[2], { y: fl.pos[1], ground: fl.pos[1], yaw: 0.1 });
      else std('shopkeeper', OUTFITS.shopkeeper, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.62],
        ...head(f, 31, -1.5, -0.2, -0.1, -0.1) }, fl.pos[0], fl.pos[2], { y: 0, ground: 0, yaw: -0.15 });
      // traders fast asleep on their crates, oblivious, as the shop opens
      std('traderC', OUTFITS.traderC, { expr: 'smile_closed', mode: 'sit', blink: true, seed: 63,
        ...head(f, 63, 7, 0, 0.3, 0) }, 5.6, -17.6, { y: 0.42, ground: 0.42, yaw: -0.4 });
      std('traderA', OUTFITS.traderA, { expr: 'smile_closed', mode: 'sit', blink: true, seed: 61,
        ...head(f, 61, 8, 0, 0.32, 0) }, 6.5, -19.3, { y: 0.42, ground: 0.42, yaw: -0.55 });
      break;
    }
    case 'launch': {
      const fl = flyAt(f);
      if (fl.air) flyer('grin', 'fall', q(clamp(0.3 + (fl.leap || 0) * 0.7, 0, 1), 2));
      else {
        const crouch = f > 444 ? Math.sin(clamp((f - 444) / 9, 0, 1) * Math.PI) * 0.13 : 0;
        std('shopkeeper', OUTFITS.shopkeeper, { expr: f > 430 ? 'grin' : 'stern', mode: 'march', phase: q(fl.phase || 0, 2), blink: blinkAt(f, 31), seed: 31,
          ...head(f, 31, -1, 0.15, -0.05, 0.05, crouch) }, fl.pos[0], fl.pos[2], { y: 0, ground: 0, yaw: 0.1,
          ov: `run${q(clamp((f - 415) / 40, 0, 1), 2)}`, drawOv: (p) => drawCoat(p, clamp((f - 415) / 40, 0, 1) * 0.55, flap * 0.4, '#5d3a1a') });
      }
      break;
    }
    case 'flight': flyer('laugh', 'march', 1.0); break;
    case 'shadow': {
      const fl = flyAt(f);
      if (fl.air) flyer('grin', 'fall', 0.9);
      else std('shopkeeper', OUTFITS.shopkeeper, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, -1, -0.3, 0.05, -0.15) }, fl.pos[0], fl.pos[2], { y: fl.pos[1], ground: ROCK_B.top, yaw: -0.2 });
      std('kid1', OUTFITS.kid1, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 41), seed: 41, prop: ['point', 0.85],
        ...head(f, 41, -2, 0.2, -0.42, 0.1) }, -5.9, -16.9, { y: 0, ground: 0, s: 0.62, yaw: 0.3 });
      std('kid2', OUTFITS.kid2, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 42), seed: 42,
        ...head(f, 42, -1.5, -0.25, -0.4, -0.05) }, -3.6, -16.4, { y: 0, ground: 0, s: 0.58, yaw: -0.25 });
      break;
    }
    case 'bet': {
      std('marta', OUTFITS.marta, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 51), seed: 51, prop: ['point', 0.78],
        ...head(f, 51, -2.5, kf([[705, 0.1], [760, -0.25], [818, 0.05]], f), -0.32, 0.1) }, -1.2, 14.5, { yaw: 0.2 });
      std('traderA', OUTFITS.traderA, { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 61), seed: 61,
        ...head(f, 61, -1, 0.3, -0.3, 0.2) }, -2.6, 15.5, { yaw: 0.3 });
      std('traderB', OUTFITS.traderB, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 62), seed: 62,
        ...head(f, 62, -0.5, -0.35, -0.28, -0.15) }, 0.4, 15.8, { yaw: -0.3 });
      break;
    }
    case 'faster': {
      const fl = flyAt(f);
      if (fl.air) flyer('laugh', 'fall', 1.0);
      else if (fl.sub === 'run') std('shopkeeper', OUTFITS.shopkeeper, { expr: 'grin', mode: 'march', phase: q(fl.phase || 0, 2), blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, -1, 0.1, -0.05, 0.05) }, fl.pos[0], fl.pos[2], { y: 0, ground: 0, yaw: 0.1 });
      else std('shopkeeper', OUTFITS.shopkeeper, { expr: f < 850 ? 'laugh' : 'grin', mode: 'stand', blink: blinkAt(f, 31), seed: 31,
        ...head(f, 31, f < 850 ? -3.5 : -1, 0.05, 0.02, 0) }, fl.pos[0], fl.pos[2], { y: 0, ground: 0, yaw: 0.12,
        ov: `belt${q(smooth(ramp(f, 830, 845)) * (1 - smooth(ramp(f, 862, 872))), 2)}`,
        drawOv: (p) => { const k = smooth(ramp(f, 830, 845)) * (1 - smooth(ramp(f, 862, 872))); if (k > 0.02) drawBelt(p, k); } });
      break;
    }
    case 'pine': {
      const by = boyY(f), climbing = f < 1009;
      std('boy', OUTFITS.boy, { expr: 'stern', mode: climbing ? 'march' : 'stand', phase: q((f * 0.05) % 1, 2), blink: blinkAt(f, 43), seed: 43,
        ...head(f, 43, -1.5, 0.5, -0.18, 0.15) }, -4.12, 12.5, { y: by, ground: by, s: 0.72, yaw: 0.35, group: 'pine' });
      break;
    }
    case 'glint': flyer('grin', 'fall', 0.9); break;
    case 'cable': flyer('smile', 'fall', 0.85); break;
    case 'harness': flyer('grin', 'fall', 1.0); break;
    case 'shout': {
      const ph = q(((f - B('shout')) % 24) / 24, 2);
      std('boy', OUTFITS.boy, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 43), seed: 43,
        ...head(f, 43, -2.5, 0.05, -0.2, 0.05) }, ROCK_HOME.x, ROCK_HOME.z, { y: ROCK_HOME.top, ground: ROCK_HOME.top, s: 0.72, yaw: 0.1,
        ov: `sh${ph}`, drawOv: (p) => drawShout(p, ph) });
      std('traderB', OUTFITS.traderB, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 62), seed: 62, prop: ['point', 0.8],
        ...head(f, 62, -2, 0.2, -0.45, 0.15) }, 3.2, 14.8, { yaw: 0.25 });
      std('traderA', OUTFITS.traderA, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 61), seed: 61,
        ...head(f, 61, -1.5, -0.3, -0.42, -0.1) }, 7.6, 15.6, { yaw: -0.3 });
      std('marta', OUTFITS.marta, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 51), seed: 51,
        ...head(f, 51, -2, 0.35, -0.4, 0.2) }, -0.6, 16.8, { yaw: 0.35 });
      break;
    }
    case 'unclip': {
      const fl = flyAt(f);
      if (fl.air) flyer('grin', 'fall', 0.8);
      else {
        let FP = T.faceP('grin', 31);
        const wk = shopWink(f);
        if (wk > 0) FP = T.blendFaceP(FP, T.faceP('wink', 31), wk);
        std('shopkeeper', OUTFITS.shopkeeper, { expr: 'grin', exprP: { ...FP, blush: 0 }, mode: 'stand', blink: blinkAt(f, 31), seed: 31,
          prop: f < 1562 ? ['point', 0.55] : null,
          ...head(f, 31, -1.5, 0.1, f < 1562 ? -0.25 : 0.02, -0.05) }, fl.pos[0], fl.pos[2], { y: fl.pos[1], ground: ROCK_B.top, yaw: 0.18 });
      }
      break;
    }
    case 'dialogue': {
      // THE dialogue beat: full speaker close-up — the shopkeeper
      // PERFORMS his line, mouth driven by the stem inside the speak
      // segment, firmly closed outside it.
      std('shopkeeper', OUTFITS.shopkeeper, { mode: 'stand', blink: blinkAt(f, 31), seed: 31, look: 0.25, ...speakFace('smile', f) },
        ROCK_B.x, -15.0, { y: ROCK_B.top, ground: ROCK_B.top, yaw: 0.28 });
      break;
    }
    case 'hook': {
      // FINAL: the shopkeeper in the lower foreground, grinning and
      // pointing up at the hook board — character beat + board together.
      const fl = flyAt(f);
      std('shopkeeper', OUTFITS.shopkeeper, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 31), seed: 31, prop: ['point', 0.8],
        ...head(f, 31, -1.5, 0.15, -0.35, -0.1) }, fl.pos[0], fl.pos[2], { y: 0, ground: 0, yaw: -0.15, s: 1.24 });
      break;
    }
  }
  return out;
};
export const actorsAt = (f, T) => castAt(f).map((c) => c.actor(T));

// ---------- solidity: statics, dynamics, ground ----------
export const STATICS = [
  SOL.circle(3.1, 10.5, 0.38, { h: 9, id: 'anchorpost' }),
  SOL.circle(3.1, -13.5, 0.38, { h: 9, id: 'anchorpost' }),
  SOL.aabb(-1.6, 2.6, -21.5, -18.6, { id: 'shop' }),
  SOL.aabb(-7.6, -1.4, -20.6, -18.0, { id: 'cottage' }),
  SOL.circle(PINE.x, PINE.z, 0.3, { h: 7.5, id: 'pine', group: 'pine' }),
  SOL.circle(-0.5, 13.9, 0.3, { h: 0.95, id: 'sack' }),
  SOL.circle(BOARD_POS[0] - 2.55, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  SOL.circle(BOARD_POS[0] + 2.55, BOARD_POS[2], 0.09, { h: 3.3, id: 'boardpost' }),
  SOL.aabb(-9.5, -4.5, 25.5, 30.5, { id: 'cottagehome' }),
];
export const WORLD = SOL.makeWorld(STATICS);
export const dynamicsAt = (f) => {
  const out = [];
  for (const a of castAt(f)) {
    if (a.gone) continue;
    out.push(SOL.circle(a.x, a.z, a.r, { kind: a.air ? 'ghost' : 'dynamic', id: a.id, group: a.group || '' }));
  }
  return out;
};
export const groundItemsAt = (f) => {
  const items = [];
  for (const a of castAt(f)) {
    if (a.air || a.gone) continue;
    items.push({ id: a.id, y: a.y, ground: a.ground ?? 0, maxHover: 0.06 });
  }
  return items;
};
