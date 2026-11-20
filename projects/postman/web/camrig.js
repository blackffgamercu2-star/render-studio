// camrig.js — LIBRARY v3 smooth tracking camera rig: mode generators that follow a
// subject analytically every frame, a Gaussian smoothing pass that never crosses a
// hard cut, and a jerk meter that proves the track is smooth (v1's camFromKeys was
// piecewise eased keyframe lerp — velocity jumped at every key, hence "hichak-hichak").
// Pure math: no THREE, no DOM — runs in plain Node (gate scripts) and in the browser.
// Import in story.js:  import { buildRig, followCam, jerkReport } from './camrig.js';
//
// Usage:
//   const rig = buildRig({ total, shots: [
//     { a: 0,   b: 89,  raw: followCam({ subject, frame, dist: 4 }) },
//     { a: 90,  b: 179, raw: chaseCam({ subject, frame }), cut: 'hard' },
//     { a: 180, b: 269, raw: frontCam({ subject, frame }), cut: 'whip', blend: 12 },
//   ], kicks: [{ f: 120, a: 0.6 }] });
//   const cam = rig.camAt(f);            // { pos, look, fov, roll, flash: 0 }
//   const rep = jerkReport(rig.samples, rig.declared);  // rep.pass must be true
import { clamp, lerp, lerp3, ramp, M } from './motion.js';

// ---------------------------------------------------------------------------
// Gaussian smoothing
// ---------------------------------------------------------------------------
/** Gaussian kernel: Float array of length 2*radius+1, normalised to sum 1. */
export const gaussKernel = (sigma, radius) => {
  const s = Math.max(1e-6, sigma), r = Math.max(0, Math.floor(radius));
  const out = new Array(2 * r + 1);
  let sum = 0;
  for (let i = -r; i <= r; i++) { const w = Math.exp(-(i * i) / (2 * s * s)); out[i + r] = w; sum += w; }
  for (let i = 0; i < out.length; i++) out[i] /= sum;
  return out;
};

/** Gaussian-smooth a series of equal-length number arrays, frame by frame.
 *  breaks: Set of frame indices f where smoothing must NOT cross — a break at
 *  index b means frames < b and frames >= b are smoothed separately (sample b
 *  belongs to the segment AFTER the break). Weights are renormalised over the
 *  available in-segment neighbours (edge clamping), so ends and cut-adjacent
 *  frames stay correct instead of darkening toward zero. Returns a new array
 *  of the same shape; the input is never mutated. */
export const smoothSeries = (samples, sigma, breaks, radius) => {
  const n = samples.length;
  if (!n) return [];
  const dim = samples[0].length;
  const R = radius == null ? Math.max(1, Math.ceil(Math.max(1e-6, sigma) * 3)) : Math.max(0, Math.floor(radius));
  const kern = gaussKernel(sigma, R);
  const brk = breaks || new Set();
  // Segment id per frame: increments at every break index.
  const seg = new Int32Array(n);
  let s = 0;
  for (let i = 0; i < n; i++) { if (i > 0 && brk.has(i)) s++; seg[i] = s; }
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const acc = new Array(dim).fill(0);
    let wsum = 0;
    for (let d = -R; d <= R; d++) {
      const j = i + d;
      if (j < 0 || j >= n || seg[j] !== seg[i]) continue;
      const w = kern[d + R];
      wsum += w;
      for (let k = 0; k < dim; k++) acc[k] += samples[j][k] * w;
    }
    const inv = wsum > 0 ? 1 / wsum : 1;
    for (let k = 0; k < dim; k++) acc[k] *= inv;
    out[i] = acc;
  }
  return out;
};

// ---------------------------------------------------------------------------
// Helpers shared by the mode generators
// ---------------------------------------------------------------------------
const asPoint = (v, f) => (typeof v === 'function' ? v(f) : v);            // array | (f)=>array
const asPlan = (v, f) => (typeof v === 'function' ? v(f) : v);             // [x,z] | (f)=>[x,z]
const rollAt = (roll, f) => (typeof roll === 'function' ? roll(f) : (roll || 0));

// ---------------------------------------------------------------------------
// Mode generators — each returns raw(f) -> { pos, look, fov, roll }.
// Every raw tolerates f outside its shot's [a,b] (ramps clamp internally).
// Conventions: subject: (f)=>[x,y,z]; frame: (f)=>{ fwd:[x,z], side:[x,z] }
// (unit plan vectors). Heights h / local[1] are offsets ABOVE the subject;
// lookH is an ABSOLUTE height for the look target's y.
// ---------------------------------------------------------------------------
/** Side tracking shot: camera rides beside the subject at a fixed distance. */
export const followCam = ({ subject, frame, dist, side = 1, h = 1.5, lookAhead = 0, lookH = 0.9, fov = 40, roll = 0 }) => (f) => {
  const s = subject(f), fr = frame(f);
  return {
    pos: [s[0] + fr.side[0] * dist * side, s[1] + h, s[2] + fr.side[1] * dist * side],
    look: [s[0] + fr.fwd[0] * lookAhead, lookH, s[2] + fr.fwd[1] * lookAhead],
    fov, roll: rollAt(roll, f),
  };
};

/** Chase shot: camera trails behind the subject, looking ahead of it. */
export const chaseCam = ({ subject, frame, back = 5.5, h = 1.8, lookAhead = 3, lookH = 0.9, fov = 42, roll = 0 }) => (f) => {
  const s = subject(f), fr = frame(f);
  return {
    pos: [s[0] - fr.fwd[0] * back, s[1] + h, s[2] - fr.fwd[1] * back],
    look: [s[0] + fr.fwd[0] * lookAhead, lookH, s[2] + fr.fwd[1] * lookAhead],
    fov, roll: rollAt(roll, f),
  };
};

/** Front shot: camera ahead of the subject, facing it (subject walks toward us). */
export const frontCam = ({ subject, frame, ahead = 5.4, h = 1.1, sideOff = 0, lookH = 0.95, fov = 41, roll = 0 }) => (f) => {
  const s = subject(f), fr = frame(f);
  return {
    pos: [s[0] + fr.fwd[0] * ahead + fr.side[0] * sideOff, s[1] + h, s[2] + fr.fwd[1] * ahead + fr.side[1] * sideOff],
    look: [s[0], lookH, s[2]],
    fov, roll: rollAt(roll, f),
  };
};

/** Orbit: camera sweeps an arc around a centre (array or (f)=>array).
 *  angle = lerp(a0, a1, M.smooth(ramp(f, a, b))) — angles in radians. */
export const orbitCam = ({ centre, r = 6, h = 1.5, a0 = 0, a1 = 0, a = 0, b = 1, lookOff = [0, 0, 0], fov = 37, roll = 0 }) => (f) => {
  const c = asPoint(centre, f);
  const ang = lerp(a0, a1, M.smooth(ramp(f, a, b)));
  return {
    pos: [c[0] + Math.cos(ang) * r, c[1] + h, c[2] + Math.sin(ang) * r],
    look: [c[0] + lookOff[0], c[1] + lookOff[1], c[2] + lookOff[2]],
    fov, roll: rollAt(roll, f),
  };
};

/** Push-in: camera glides from distance d0 to d1 (and height h0 to h1) along dir,
 *  a (f)=>unit plan [x,z] pointing from the subject toward the camera. */
export const pushInCam = ({ subject, dir, d0 = 8, d1 = 4, h0 = 1.5, h1 = 1.2, a = 0, b = 1, lookOff = [0, 0, 0], fov0, fov1, roll = 0 }) => (f) => {
  const s = asPoint(subject, f), d = asPlan(dir, f);
  const u = M.smooth(ramp(f, a, b)), dist = lerp(d0, d1, u), hh = lerp(h0, h1, u);
  return {
    pos: [s[0] + d[0] * dist, s[1] + hh, s[2] + d[1] * dist],
    look: [s[0] + lookOff[0], s[1] + lookOff[1], s[2] + lookOff[2]],
    fov: (fov0 && fov1) ? lerp(fov0, fov1, u) : (fov0 || 40),
    roll: rollAt(roll, f),
  };
};

/** POV: camera sits at the subject's head (local = [fwd, height, side] offsets);
 *  look comes from lookFn(f). roll may be a number or (f)=>number. */
export const povCam = ({ subject, frame, local = [0.75, 1.42, 0], lookFn, fov = 46, roll = 0 }) => (f) => {
  const s = subject(f), fr = frame(f);
  const pos = [s[0] + fr.fwd[0] * local[0] + fr.side[0] * local[2], s[1] + local[1], s[2] + fr.fwd[1] * local[0] + fr.side[1] * local[2]];
  const look = lookFn ? lookFn(f) : [s[0] + fr.fwd[0] * 5, s[1] + local[1], s[2] + fr.fwd[1] * 5];
  return { pos, look: [...look], fov, roll: rollAt(roll, f) };
};

/** Static track: camera bolted at pos, panning to keep the subject in frame. */
export const staticTrackCam = ({ pos, subject, lookOff = [0, 0, 0], fov = 40, roll = 0 }) => (f) => {
  const s = asPoint(subject, f);
  return {
    pos: [...pos],
    look: [s[0] + lookOff[0], s[1] + lookOff[1], s[2] + lookOff[2]],
    fov, roll: rollAt(roll, f),
  };
};

/** Keyframed camera, v3 edition: pos AND look use Catmull-Rom across the four
 *  neighbouring keys (uniform CR, same math as motion.spline but per-segment),
 *  so direction changes are rounded instead of cornered. Local t is eased by
 *  M[keys[i+1].ease || 'smooth']; fov/roll lerp on the same eased t. Outside the
 *  key range the end keys hold. CR can overshoot slightly — fine/desired. */
export const keysCam = ({ keys }) => {
  const K = keys;
  const cr = (p0, p1, p2, p3, t) => 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
  const cr3 = (a, b, c, d, t) => [cr(a[0], b[0], c[0], d[0], t), cr(a[1], b[1], c[1], d[1], t), cr(a[2], b[2], c[2], d[2], t)];
  const hold = (k) => ({ pos: [...k.pos], look: [...k.look], fov: k.fov ?? 40, roll: k.roll || 0 });
  return (f) => {
    if (!K.length) return { pos: [0, 0, 0], look: [0, 0, 0], fov: 40, roll: 0 };
    if (f <= K[0].f) return hold(K[0]);
    if (f >= K[K.length - 1].f) return hold(K[K.length - 1]);
    let i = 0;
    while (i < K.length - 2 && f >= K[i + 1].f) i++;
    const a = K[i], b = K[i + 1];
    const span = (b.f - a.f) || 1;
    const ease = M[b.ease || 'smooth'] || M.smooth;
    const t = ease(clamp((f - a.f) / span));
    const p0 = K[Math.max(0, i - 1)], p3 = K[Math.min(K.length - 1, i + 2)];
    return {
      pos: cr3(p0.pos, a.pos, b.pos, p3.pos, t),
      look: cr3(p0.look, a.look, b.look, p3.look, t),
      fov: lerp(a.fov ?? 40, b.fov ?? 40, t),
      roll: lerp(a.roll || 0, b.roll || 0, t),
    };
  };
};

// ---------------------------------------------------------------------------
// Rig builder
// ---------------------------------------------------------------------------
/** Build a full smoothed camera track.
 *  shots: [{ a, b, raw, cut = 'hard', blend = 0 }] tiling [0, total-1]
 *  contiguously (shot[i].a = shot[i-1].b + 1). `cut` is how THIS shot is
 *  entered from the previous one: 'hard' (instant switch at a; smoothing break
 *  at a), 'blend' (crossfade over `blend` frames centred at a, smootherstep),
 *  'whip' (same crossfade, easeInOut, and the zone is declared for the meter).
 *  kicks stay OUT of the smoothed tables; camAt applies them live as
 *  smooth damped push-in bumps (KIT-REBUILD: the v1 sign-flip formula
 *  read as camera shake and is removed).
 *  Returns { camAt, samples, declared }. */
export const buildRig = ({ total, shots, kicks = [], sigma = 3.0, smoothRadius = 9, fovSigma = 1.8 }) => {
  const N = Math.max(0, Math.floor(total));
  const blendZone = (shot) => {
    const bl = shot.blend || 0;
    return { a: shot.a - Math.floor(bl / 2), b: shot.a + Math.ceil(bl / 2), len: bl };
  };
  const shotAt = (f) => {
    for (const s of shots) if (f >= s.a && f <= s.b) return s;
    return f < shots[0].a ? shots[0] : shots[shots.length - 1];
  };

  // (i) Raw track, with blend/whip crossfades centred on the entry frame.
  const rawPos = [], rawLook = [], rawFov = [], rawRoll = [];
  for (let f = 0; f < N; f++) {
    let cur = shotAt(f).raw(f);
    let pos = [...cur.pos], look = [...cur.look], fov = cur.fov ?? 40, roll = cur.roll || 0;
    for (let i = 1; i < shots.length; i++) {
      const s = shots[i];
      if ((s.cut !== 'blend' && s.cut !== 'whip') || !(s.blend > 0)) continue;
      const z = blendZone(s);
      if (f < z.a || f > z.b) continue;
      const prev = shots[i - 1].raw(f);
      const uRaw = clamp((f - z.a) / z.len);
      const u = s.cut === 'whip' ? M.easeInOut(uRaw) : M.smooth(uRaw);
      pos = lerp3(prev.pos, cur.pos, u);
      look = lerp3(prev.look, cur.look, u);
      fov = lerp(prev.fov ?? 40, cur.fov ?? 40, u);
      roll = lerp(prev.roll || 0, cur.roll || 0, u);
    }
    rawPos.push(pos); rawLook.push(look); rawFov.push([fov]); rawRoll.push([roll]);
  }

  // (ii) Gaussian smoothing; hard cuts are segment breaks (never smoothed across).
  const breaks = new Set();
  const hardCuts = [], whips = [];
  shots.forEach((s, i) => {
    if (i === 0) return;
    if (s.cut === 'blend' || s.cut === 'whip') { if (s.cut === 'whip' && s.blend > 0) whips.push(blendZone(s)); }
    else { breaks.add(s.a); hardCuts.push(s.a); }
  });
  const pos = smoothSeries(rawPos, sigma, breaks, smoothRadius);
  const look = smoothSeries(rawLook, sigma, breaks, smoothRadius);
  const fovS = smoothSeries(rawFov, fovSigma, breaks);
  const rollS = smoothSeries(rawRoll, fovSigma, breaks);
  const samples = {
    pos, look,
    fov: fovS.map((v) => v[0]),
    roll: rollS.map((v) => v[0]),
  };
  const declared = { kicks, whips, hardCuts };

  // (iii) camAt reads the smoothed tables (linear between frames for float f)
  // and applies kicks live — identical formula to motion.camFromKeys.
  const camAt = (f) => {
    if (!N) return { pos: [0, 0, 0], look: [0, 0, 0], fov: 40, roll: 0, flash: 0 };
    const fc = clamp(f, 0, N - 1);
    const i0 = Math.floor(fc), i1 = Math.min(N - 1, i0 + 1), t = fc - i0;
    const out = {
      pos: lerp3(samples.pos[i0], samples.pos[i1], t),
      look: lerp3(samples.look[i0], samples.look[i1], t),
      fov: lerp(samples.fov[i0], samples.fov[i1], t),
      roll: lerp(samples.roll[i0], samples.roll[i1], t),
      flash: 0,
    };
    // KIT-REBUILD CAMERA (Abid: "camera sheke karta hai" — shake BANNED):
    // kicks are no longer the v1 sign-flipping jitter. A kick is now a
    // smooth damped PUSH-IN: a sin^2 bump over ~12 frames (ease-in-out,
    // zero velocity at both ends) that dollies pos a few % toward the
    // look target and dips fov ~2 degrees, then releases. No frame-
    // random terms, no roll, no sign flips anywhere in this rig.
    for (const k of kicks) {
      const d = f - k.f;
      if (d >= 0 && d < 12) {
        const u = d / 12, bump = Math.sin(Math.PI * u) * Math.sin(Math.PI * u);
        const push = (k.a || 0.05) * bump;
        out.pos = lerp3(out.pos, out.look, push * 0.9);
        out.fov -= push * 36;
        out.look = [out.look[0], out.look[1] + push * 1.1, out.look[2]];
      }
    }
    return out;
  };
  return { camAt, samples, declared };
};

// ---------------------------------------------------------------------------
// Jerk meter
// ---------------------------------------------------------------------------
/** Prove a track is smooth. For each frame f in [2, N-2]: vel[f] = p[f]-p[f-1]
 *  (vector), acc[f] = vel[f]-vel[f-1] (vector), jerk[f] = |acc[f]-acc[f-1]|
 *  (Euclidean magnitude) — computed on pos and look separately. Frames near a
 *  declared disturbance are excluded: [kick.f, kick.f+padKick] after any kick,
 *  whip zones widened by padWhip, hard cuts widened by padCut. */
export const jerkReport = (samples, declared, { posMax = 0.015, lookMax = 0.02, padKick = 7, padWhip = 2, padCut = 1 } = {}) => {
  const pos = samples.pos || [], look = samples.look || [];
  const N = Math.min(pos.length, look.length);
  const kicks = (declared && declared.kicks) || [];
  const whips = (declared && declared.whips) || [];
  const hardCuts = (declared && declared.hardCuts) || [];
  const excluded = (f) => {
    for (const k of kicks) if (f >= k.f && f <= k.f + padKick) return true;
    for (const w of whips) if (f >= w.a - padWhip && f <= w.b + padWhip) return true;
    for (const c of hardCuts) if (Math.abs(f - c) <= padCut) return true;
    return false;
  };
  const jerkSeries = (p) => {
    // vel[0] replicates vel[1] (no p[-1] exists): a constant-velocity track
    // must read jerk 0 from the very first checked frame, not a startup spike.
    const vel = new Array(N);
    vel[0] = [0, 0, 0];
    for (let f = 1; f < N; f++) vel[f] = [p[f][0] - p[f - 1][0], p[f][1] - p[f - 1][1], p[f][2] - p[f - 1][2]];
    if (N > 1) vel[0] = [...vel[1]];
    const acc = new Array(N);
    acc[0] = [0, 0, 0];
    for (let f = 1; f < N; f++) acc[f] = [vel[f][0] - vel[f - 1][0], vel[f][1] - vel[f - 1][1], vel[f][2] - vel[f - 1][2]];
    const jerk = new Array(N).fill(0);
    for (let f = 2; f < N; f++) {
      const dx = acc[f][0] - acc[f - 1][0], dy = acc[f][1] - acc[f - 1][1], dz = acc[f][2] - acc[f - 1][2];
      jerk[f] = Math.hypot(dx, dy, dz);
    }
    return jerk;
  };
  const posJerk = jerkSeries(pos), lookJerk = jerkSeries(look);
  let maxPosJerk = 0, maxPosJerkAt = -1, maxLookJerk = 0, maxLookJerkAt = -1, checked = 0;
  const rows = [];
  for (let f = 2; f <= N - 2; f++) {
    if (excluded(f)) continue;
    checked++;
    if (posJerk[f] > maxPosJerk) { maxPosJerk = posJerk[f]; maxPosJerkAt = f; }
    if (lookJerk[f] > maxLookJerk) { maxLookJerk = lookJerk[f]; maxLookJerkAt = f; }
    rows.push({ f, posJerk: posJerk[f], lookJerk: lookJerk[f] });
  }
  rows.sort((x, y) => Math.max(y.posJerk / posMax, y.lookJerk / lookMax) - Math.max(x.posJerk / posMax, x.lookJerk / lookMax));
  return {
    maxPosJerk, maxPosJerkAt, maxLookJerk, maxLookJerkAt,
    worst: rows.slice(0, 8),
    pass: maxPosJerk <= posMax && maxLookJerk <= lookMax,
    checked,
  };
};
