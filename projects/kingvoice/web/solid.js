// solid.js — LIBRARY v3 physics/solidity: plan-view colliders + ground checks, so
// nothing in a coded scene ever clips through a wall, floats off its surface, or
// sinks into the ground (v1 had no colliders at all — objects passed through each
// other and the eye caught it). Pure math: no imports, no THREE, no DOM — runs in
// plain Node (gate scripts) and in the browser.
// Import in story.js:  import { circle, aabb, makeWorld, checkGround } from './solid.js';
//
// Usage:
//   const world = makeWorld([aabb(-1, 1, -1, 1, { id: 'hut' }), circle(5, 0, 1, { id: 'tree' })]);
//   world.check(actors);            // -> [{ a: 'hero', b: 'hut' }, ...]
//   world.overlapsFor(hero);        // -> ['hut', ...]
//   checkGround([{ id: 'hero', y: 0, ground: 0 }]);  // -> [] when clean
//
// Conventions: colliders live in the plan (XZ) plane; h / y0 describe the vertical
// extent for reference (overlap tests are plan-view only). Every collider may carry
// `margin` (shrink this shape by that much before testing — a skin width) and
// `group` (colliders sharing a non-empty group never report against each other:
// a rider and the animal carrying them, an occupant and their vehicle).

const EPS = 1e-9;
const shrink = (v, m) => Math.max(0, v - (m || 0));

// ---------------------------------------------------------------------------
// Collider constructors
// ---------------------------------------------------------------------------
/** Circle collider in plan view, centred at (x, z) with radius r. */
export const circle = (x, z, r, o = {}) => ({
  type: 'circle', x, z, r,
  h: o.h ?? 2, y0: o.y0 ?? 0, kind: o.kind ?? 'static', id: o.id ?? '',
  margin: o.margin ?? 0, group: o.group ?? '',
});

/** Axis-aligned box collider in plan view: x in [minX, maxX], z in [minZ, maxZ]. */
export const aabb = (minX, maxX, minZ, maxZ, o = {}) => ({
  type: 'aabb', minX, maxX, minZ, maxZ,
  h: o.h ?? 2, y0: o.y0 ?? 0, kind: o.kind ?? 'static', id: o.id ?? '',
  margin: o.margin ?? 0, group: o.group ?? '',
});

/** Oriented box collider in plan view: centre (x, z), half-extents hx / hz, yaw
 *  around Y. Project convention: local +x maps to world [cos(yaw), -sin(yaw)],
 *  i.e. local [lx, lz] -> world [lx*cos(yaw) + lz*sin(yaw), -lx*sin(yaw) + lz*cos(yaw)]. */
export const obb = (x, z, yaw, hx, hz, o = {}) => ({
  type: 'obb', x, z, yaw, hx, hz,
  h: o.h ?? 2, y0: o.y0 ?? 0, kind: o.kind ?? 'static', id: o.id ?? '',
  margin: o.margin ?? 0, group: o.group ?? '',
});

// ---------------------------------------------------------------------------
// Effective (margin-shrunk) geometry
// ---------------------------------------------------------------------------
// Each shape is shrunk by its OWN margin before testing (margin acts as a skin:
// two shapes whose skins just touch are not overlapping). Touching itself is
// never overlap anywhere below: all comparisons are strict.
const effCircle = (c) => ({ x: c.x, z: c.z, r: shrink(c.r, c.margin) });
const effAabb = (b) => {
  const m = b.margin || 0;
  return { minX: b.minX + m, maxX: b.maxX - m, minZ: b.minZ + m, maxZ: b.maxZ - m };
};
const effObb = (b) => ({ x: b.x, z: b.z, yaw: b.yaw, hx: shrink(b.hx, b.margin), hz: shrink(b.hz, b.margin) });

// Generic box form for SAT: centre, half-extents, and its two plan axes (unit).
const asBox = (s) => {
  if (s.type === 'aabb') {
    const e = effAabb(s);
    return { cx: (e.minX + e.maxX) / 2, cz: (e.minZ + e.maxZ) / 2, hx: Math.max(0, (e.maxX - e.minX) / 2), hz: Math.max(0, (e.maxZ - e.minZ) / 2), ax: [1, 0], az: [0, 1] };
  }
  const e = effObb(s), c = Math.cos(e.yaw), sn = Math.sin(e.yaw);
  // Local +x -> world [cos, -sin]; local +z -> world [sin, cos] (see obb()).
  return { cx: e.x, cz: e.z, hx: e.hx, hz: e.hz, ax: [c, -sn], az: [sn, c] };
};

// World offset -> obb local frame (inverse of the mapping documented on obb()).
const toLocal = (b, wx, wz) => {
  const c = Math.cos(b.yaw), sn = Math.sin(b.yaw);
  const dx = wx - b.x, dz = wz - b.z;
  return [c * dx - sn * dz, sn * dx + c * dz];
};

// ---------------------------------------------------------------------------
// Pairwise overlap (plan view, XZ)
// ---------------------------------------------------------------------------
const circleCircle = (a, b) => {
  const ea = effCircle(a), eb = effCircle(b);
  return Math.hypot(ea.x - eb.x, ea.z - eb.z) < ea.r + eb.r - EPS;
};

const circleAabb = (c, b) => {
  const ec = effCircle(c), eb = effAabb(b);
  if (eb.minX > eb.maxX || eb.minZ > eb.maxZ) return false;
  const nx = Math.max(eb.minX, Math.min(ec.x, eb.maxX));
  const nz = Math.max(eb.minZ, Math.min(ec.z, eb.maxZ));
  return Math.hypot(ec.x - nx, ec.z - nz) < ec.r - EPS;
};

const circleObb = (c, b) => {
  const ec = effCircle(c), eb = effObb(b);
  const [lx, lz] = toLocal(eb, ec.x, ec.z);
  const nx = Math.max(-eb.hx, Math.min(lx, eb.hx));
  const nz = Math.max(-eb.hz, Math.min(lz, eb.hz));
  return Math.hypot(lx - nx, lz - nz) < ec.r - EPS;
};

const aabbAabb = (a, b) => {
  const ea = effAabb(a), eb = effAabb(b);
  return ea.minX < eb.maxX && eb.minX < ea.maxX && ea.minZ < eb.maxZ && eb.minZ < ea.maxZ;
};

// Separating Axis Test for two boxes (any aabb/obb mix): project both boxes on
// both boxes' axes (4 axes); a gap on any axis means no overlap. Touching
// (projection ends exactly meeting) is NOT overlap.
const boxBoxSAT = (a, b) => {
  const A = asBox(a), B = asBox(b);
  const axes = [A.ax, A.az, B.ax, B.az];
  const dx = B.cx - A.cx, dz = B.cz - A.cz;
  for (const [ax, az] of axes) {
    const dist = Math.abs(dx * ax + dz * az);
    const ra = A.hx * Math.abs(A.ax[0] * ax + A.ax[1] * az) + A.hz * Math.abs(A.az[0] * ax + A.az[1] * az);
    const rb = B.hx * Math.abs(B.ax[0] * ax + B.ax[1] * az) + B.hz * Math.abs(B.az[0] * ax + B.az[1] * az);
    if (dist >= ra + rb - EPS) return false;
  }
  return A.hx > 0 && A.hz > 0 && B.hx > 0 && B.hz > 0;
};

/** Plan-view (XZ) overlap test for any pair of colliders. Touching is NOT
 *  overlap (strict tests throughout). Each shape is first shrunk by its own
 *  `margin` property (default 0) — see the header note. */
export const pairOverlap = (a, b) => {
  if (!a || !b) return false;
  const ta = a.type, tb = b.type;
  if (ta === 'circle' && tb === 'circle') return circleCircle(a, b);
  if (ta === 'circle' && tb === 'aabb') return circleAabb(a, b);
  if (ta === 'aabb' && tb === 'circle') return circleAabb(b, a);
  if (ta === 'circle' && tb === 'obb') return circleObb(a, b);
  if (ta === 'obb' && tb === 'circle') return circleObb(b, a);
  if (ta === 'aabb' && tb === 'aabb') return aabbAabb(a, b);
  // aabb-obb and obb-obb both go through SAT on both boxes' axes.
  return boxBoxSAT(a, b);
};

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------
const skippable = (a, b) => a.kind === 'ghost' || b.kind === 'ghost' || (!!a.group && a.group === b.group);

/** A world of static colliders, checked against moving (dynamic) colliders.
 *  check(dynamics) reports every overlapping dynamics x statics and
 *  dynamics x dynamics pair as { a: idA, b: idB } (each pair once). Pairs are
 *  skipped when either collider has kind 'ghost' or both share the same
 *  non-empty `group` string (riders/occupants ride inside their carrier). */
export const makeWorld = (statics) => {
  const S = statics || [];
  return {
    statics: S,
    check(dynamics) {
      const D = dynamics || [], out = [];
      for (const d of D) {
        for (const s of S) {
          if (d === s || skippable(d, s)) continue;
          if (pairOverlap(d, s)) out.push({ a: d.id, b: s.id });
        }
      }
      for (let i = 0; i < D.length; i++) {
        for (let j = i + 1; j < D.length; j++) {
          if (skippable(D[i], D[j])) continue;
          if (pairOverlap(D[i], D[j])) out.push({ a: D[i].id, b: D[j].id });
        }
      }
      return out;
    },
    /** Ids of the statics that this one dynamic collider overlaps. */
    overlapsFor(dyn) {
      const out = [];
      for (const s of S) {
        if (dyn === s || skippable(dyn, s)) continue;
        if (pairOverlap(dyn, s)) out.push(s.id);
      }
      return out;
    },
  };
};

// ---------------------------------------------------------------------------
// Ground check
// ---------------------------------------------------------------------------
/** Ground-contact gate: every item must rest ON its ground, not in it or above
 *  it. items: [{ id, y, ground, maxHover = 0.05 }]. y < ground - tol is 'sunk';
 *  y - ground > maxHover is 'hover'. Returns violations [{ id, y, ground, kind }]
 *  — an empty array when everything is planted clean. */
export const checkGround = (items, tol = 0.03) => {
  const out = [];
  for (const it of items || []) {
    const maxHover = it.maxHover ?? 0.05;
    if (it.y < it.ground - tol) out.push({ id: it.id, y: it.y, ground: it.ground, kind: 'sunk' });
    else if (it.y - it.ground > maxHover) out.push({ id: it.id, y: it.y, ground: it.ground, kind: 'hover' });
  }
  return out;
};
