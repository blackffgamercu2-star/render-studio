// veg.js — vegetation module for the trick-line three.js stack (r160).
// Original implementation written for this project after studying:
//   - boona13/threejs-grass-water-shaders (MIT)  — instanced tuft grass,
//     two-octave lattice-noise wind, tip-weighted bend, base->tip gradient.
//   - dgreenheck/ez-tree (MIT)                   — recursive branch skeleton,
//     ring-swept bark tubes, leaf cards at branch ends, seeded presets.
//   - supereggbert/proctree.js (BSD-3-Clause)    — branch recursion params
//     (levels, length/radius falloff, taper, twig cards).
// No code is copied from those repos; the techniques are re-implemented
// here in our kit's idiom (canvas textures, merged BufferGeometry, GLSL1
// ShaderMaterial — matching web/lib/three.module.js r160 + SwiftShader).
//
// Drop-in: place in a project's web/ folder next to lib/three.module.js.
//   import { makeGrassField, makeTree, makeFlowers, VEG } from './veg.js';
// Palette law (LEARNED_STANDARD.md): foliage #5b793a family, S 45-60%,
// V 40-55, NEVER below V35 (no black-green). Shadows warm.

import * as THREE from './lib/three.module.js';

export const VEG = {
  foliage: 0x5b793a, // reference foliage
  grassBase: 0x4e6d2e, // blade root (shaded, but V >= 35)
  grassTip: 0x86b954, // blade tip, sunlit
  bark: 0x6a4025, // wood target
  earth: 0x6f4823,
  water: 0x6d9ec2,
  waterDeep: 0x37686f,
  sky: 0x9fc8e2,
};

// ---------- deterministic RNG (same seed -> same scene, like ez-tree) ----
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- canvas texture helpers ---------------------------------------
function canvasTex(size, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = 4;
  return t;
}

// Bark: vertical streaks + knots over the warm-brown wood target.
export function barkTexture(base = '#6a4025', dark = '#4a2c15', light = '#8a5a30') {
  return canvasTex(256, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    const rng = mulberry32(1234);
    for (let i = 0; i < 340; i++) { // vertical grain streaks
      const x = rng() * s, w = 1 + rng() * 3, l = 20 + rng() * 90;
      g.fillStyle = rng() < 0.6 ? dark : light;
      g.globalAlpha = 0.12 + rng() * 0.25;
      g.fillRect(x, rng() * s, w, l);
    }
    g.globalAlpha = 0.5;
    for (let i = 0; i < 7; i++) { // knots
      const x = rng() * s, y = rng() * s;
      g.strokeStyle = dark; g.lineWidth = 2;
      g.beginPath(); g.ellipse(x, y, 3 + rng() * 4, 6 + rng() * 7, 0, 0, 7); g.stroke();
    }
    g.globalAlpha = 1;
  }, [1, 2]);
}

// Leaf-cluster card: dozens of ellipse leaves in 3 greens on transparency.
// This is what stops canopies reading as flat blobs — real leaf shapes with
// alpha gaps, lit tips and shaded undersides baked as colour variation.
export function leafClusterTexture(greens = ['#5a8438', '#5b793a', '#74a24a', '#8fbf5a'], seed = 77) {
  return canvasTex(256, (g, s) => {
    const rng = mulberry32(seed);
    g.clearRect(0, 0, s, s);
    for (let i = 0; i < 150; i++) {
      const x = s / 2 + (rng() - 0.5) * s * 0.92;
      const y = s / 2 + (rng() - 0.5) * s * 0.92;
      const d = Math.hypot(x - s / 2, y - s / 2) / (s / 2);
      if (d > 1) continue;
      const a = rng() * Math.PI, w = 7 + rng() * 9, l = 13 + rng() * 16;
      g.save(); g.translate(x, y); g.rotate(a);
      g.fillStyle = greens[(rng() * greens.length) | 0];
      g.globalAlpha = 0.92;
      g.beginPath(); g.ellipse(0, 0, l / 2, w / 2, 0, 0, 7); g.fill();
      g.globalAlpha = 0.35; g.fillStyle = '#3a5c26'; // leaf vein shadow side
      g.beginPath(); g.ellipse(0, w / 5, l / 2, w / 5, 0, 0, 7); g.fill();
      g.restore();
    }
    g.globalAlpha = 1;
  });
}

// Single flower head card: petals + hot centre (payoff-bright accent).
export function flowerTexture(petal = '#e2483d', centre = '#ffd23e') {
  return canvasTex(128, (g, s) => {
    g.clearRect(0, 0, s, s);
    const cx = s / 2, cy = s / 2;
    g.fillStyle = petal;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.beginPath();
      g.ellipse(cx + Math.cos(a) * 26, cy + Math.sin(a) * 26, 24, 15, a, 0, 7);
      g.fill();
    }
    g.fillStyle = centre;
    g.beginPath(); g.arc(cx, cy, 15, 0, 7); g.fill();
    g.fillStyle = 'rgba(120,60,0,0.55)';
    for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(cx + (Math.random() - 0.5) * 16, cy + (Math.random() - 0.5) * 16, 2.4, 0, 7); g.fill(); }
  });
}

// Pine-needle texture: dense short strokes in 3 greens — stops cones
// reading as flat paper cutouts.
export function needleTexture(greens = ['#3e6b2a', '#4a7a33', '#5d8f3e'], seed = 5) {
  return canvasTex(256, (g, s) => {
    const rng = mulberry32(seed);
    g.fillStyle = greens[1]; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 2600; i++) {
      g.strokeStyle = greens[(rng() * greens.length) | 0];
      g.globalAlpha = 0.35 + rng() * 0.45;
      g.lineWidth = 1.4;
      const x = rng() * s, y = rng() * s, a = Math.PI / 2 + (rng() - 0.5) * 0.9, l = 6 + rng() * 9;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    g.globalAlpha = 1;
  }, [2, 1]);
}

// ---------- geometry merge (all inputs -> non-indexed, same attrs) ------
function mergeGeoms(list) {
  let total = 0;
  const parts = list.map((geo) => { const g = geo.index ? geo.toNonIndexed() : geo; total += g.attributes.position.count; return g; });
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3),
    uv = new Float32Array(total * 2), col = new Float32Array(total * 3);
  let o = 0;
  for (const g of parts) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    if (g.attributes.color) col.set(g.attributes.color.array, o * 3);
    else col.fill(1, o * 3, (o + n) * 3);
    o += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}
function tint(geo, hex, jitter, rng) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  const f = jitter ? 1 - jitter / 2 + rng() * jitter : 1;
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r * f; arr[i * 3 + 1] = c.g * f; arr[i * 3 + 2] = c.b * f; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

// =====================================================================
// GRASS — instanced tufts, vertex-shader wind (learned from boona13).
// One draw call. Blade = 3-segment tapered strip; 3 blades per tuft.
// Wind = 2-octave value noise scrolled by time; displacement weighted
// by uv.y^2 so roots stay planted and tips arc. Per-instance colour
// jitter comes through instanceColor-style attribute (aColor).
// =====================================================================
function bladeGeometry(segments = 3, width = 0.055, height = 1) {
  // One blade in local space: base at origin, +Y up, tapering to a point,
  // slight forward (+Z) curve baked in so bend reads 3D.
  const pos = [], uvs = [], idx = [];
  for (let i = 0; i <= segments; i++) {
    const v = i / segments, w = width * (1 - v * 0.92);
    pos.push(-w, v * height, v * v * 0.16 * height, w, v * height, v * v * 0.16 * height);
    uvs.push(0, v, 1, v);
    if (i < segments) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
function tuftGeometry(width = 0.055) {
  // 3 blades rotated 60° apart, merged — one instance = one tuft.
  const parts = [];
  for (let i = 0; i < 3; i++) {
    const b = bladeGeometry(3, width);
    b.applyMatrix4(new THREE.Matrix4().makeRotationY((i / 3) * Math.PI + 0.4));
    parts.push(b);
  }
  return mergeGeoms(parts);
}

const GRASS_VERT = /* glsl */ `
  attribute vec3 aOffset;
  attribute vec3 aColor;
  attribute float aScale;
  attribute float aRot;
  attribute float aPhase;
  uniform float uTime;
  uniform float uWindStrength;
  uniform vec2 uWindDir;
  varying vec3 vColor;
  varying float vGrad;
  varying float vShade;
  float hash21(vec2 p){ p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
  float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 s = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1, 0)), s.x),
               mix(hash21(i + vec2(0, 1)), hash21(i + 1.0), s.x), s.y);
  }
  void main() {
    vGrad = uv.y;
    vColor = aColor;
    float c = cos(aRot), s = sin(aRot);
    vec3 p = position * aScale;
    p = vec3(p.x * c - p.z * s, p.y, p.x * s + p.z * c);
    vec3 world = p + aOffset;
    // two-octave wind: slow gust field + faster rustle (boona13's recipe)
    float n1 = vnoise(world.xz * 0.16 + uWindDir * uTime * 0.55);
    float n2 = vnoise(world.xz * 0.55 - uWindDir * uTime * 1.15 + aPhase);
    float wind = (n1 * 0.75 + n2 * 0.25) - 0.42;
    float tipW = uv.y * uv.y;
    vec2 bend = uWindDir * wind * uWindStrength * tipW;
    world.xz += bend;
    world.y -= length(bend) * 0.35 * uv.y;      // arc droop as tips bend
    vShade = 0.82 + 0.30 * n1 + 0.10 * uv.y;    // gusts read as light waves
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }
`;
const GRASS_FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vColor;
  varying float vGrad;
  varying float vShade;
  void main() {
    vec3 col = vColor * (0.78 + 0.34 * vGrad) * vShade; // root shade -> lit tip
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function makeGrassField(opts = {}) {
  const {
    count = 9000, area = 34, height = 0.62, seed = 7, bladeWidth = 0.055,
    base = VEG.grassBase, tip = VEG.grassTip,
    windStrength = 0.34, windDir = [1, 0.35],
    keep = null, // (x, z) => bool — path/water exclusion, density control
  } = opts;
  const rng = mulberry32(seed);
  const geo = new THREE.InstancedBufferGeometry();
  const tuft = tuftGeometry(bladeWidth);
  geo.index = tuft.index;
  geo.attributes.position = tuft.attributes.position;
  geo.attributes.uv = tuft.attributes.uv;
  geo.attributes.normal = tuft.attributes.normal;

  const offs = new Float32Array(count * 3), cols = new Float32Array(count * 3),
    sc = new Float32Array(count), rt = new Float32Array(count), ph = new Float32Array(count);
  const cBase = new THREE.Color(base), cTip = new THREE.Color(tip), tmp = new THREE.Color();
  let placed = 0, guard = 0;
  while (placed < count && guard++ < count * 30) {
    const x = (rng() - 0.5) * area, z = (rng() - 0.5) * area;
    if (keep && !keep(x, z)) continue;
    offs.set([x, 0, z], placed * 3);
    tmp.copy(cBase).lerp(cTip, 0.25 + rng() * 0.55); // per-tuft colour spread
    tmp.offsetHSL((rng() - 0.5) * 0.02, 0, (rng() - 0.5) * 0.05);
    cols.set([tmp.r, tmp.g, tmp.b], placed * 3);
    sc[placed] = height * (0.75 + rng() * 0.6);
    rt[placed] = rng() * Math.PI * 2;
    ph[placed] = rng() * 6.28;
    placed++;
  }
  geo.instanceCount = placed;
  geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offs, 3));
  geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(cols, 3));
  geo.setAttribute('aScale', new THREE.InstancedBufferAttribute(sc, 1));
  geo.setAttribute('aRot', new THREE.InstancedBufferAttribute(rt, 1));
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(ph, 1));

  const mat = new THREE.ShaderMaterial({
    vertexShader: GRASS_VERT, fragmentShader: GRASS_FRAG,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uWindStrength: { value: windStrength },
      uWindDir: { value: new THREE.Vector2(windDir[0], windDir[1]).normalize() },
    },
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.name = 'veg-grass';
  mesh.userData.vegUpdate = (t) => { mat.uniforms.uTime.value = t; };
  mesh.userData.blades = placed * 3;
  return mesh;
}

// =====================================================================
// TREES — recursive branch skeleton + swept bark tubes + leaf cards
// (ez-tree / proctree recipe). Types: 'round' | 'tall' | 'pine' | 'bush'.
// Deterministic per seed. Canopy sways gently via vegUpdate(t).
// =====================================================================
const _up = new THREE.Vector3(0, 1, 0);
function tube(from, dir, len, r0, r1, radial = 6) {
  const g = new THREE.CylinderGeometry(r1, r0, len, radial, 1, true);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(_up, dir.clone().normalize());
  g.applyQuaternion(q);
  g.translate(from.x, from.y, from.z);
  return g;
}

export function makeTree(opts = {}) {
  const {
    type = 'round', seed = 3, height = 7,
    barkTex = null, leafTex = null,
    leafColor = 0xffffff, trunkColor = 0xffffff,
  } = opts;
  const rng = mulberry32(seed);
  const group = new THREE.Group();
  const barkParts = [], leafParts = [], anchors = [];

  const P = {
    round: { trunk: 0.34, levels: 3, spread: 0.62, climb: 0.34, lenFall: 0.74, leaf: 2.6, trunkLen: 0.30 },
    tall: { trunk: 0.46, levels: 3, spread: 0.42, climb: 0.55, lenFall: 0.78, leaf: 2.1, trunkLen: 0.52 },
    bush: { trunk: 0.10, levels: 2, spread: 0.85, climb: 0.15, lenFall: 0.72, leaf: 1.5, trunkLen: 0.06 },
  }[type === 'pine' ? 'round' : type];

  function grow(pos, dir, len, rad, level) {
    const end = pos.clone().addScaledVector(dir, len);
    barkParts.push(tint(tube(pos, dir, len, rad, rad * 0.64), trunkColor, 0.15, rng));
    if (level === 0 || len < 0.3) {
      anchors.push({ p: end, s: P.leaf * (0.8 + rng() * 0.5) });
      if (rng() < 0.75) anchors.push({ p: pos.clone().lerp(end, 0.6), s: P.leaf * 0.8 });
      return;
    }
    const kids = level === P.levels ? 3 : 2 + (rng() < 0.55 ? 1 : 0);
    for (let i = 0; i < kids; i++) {
      const axis = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize();
      const nd = dir.clone().applyAxisAngle(axis, P.spread * (0.5 + rng() * 0.7));
      nd.lerp(_up, P.climb * rng()).normalize(); // branches climb toward light
      grow(end, nd, len * P.lenFall * (0.85 + rng() * 0.3), rad * 0.58, level - 1);
    }
    if (rng() < 0.5) anchors.push({ p: end, s: P.leaf * 0.7 }); // inner canopy fill
  }

  if (type === 'pine') {
    // Conifer: straight trunk + stacked foliage cones (needle-green, jittered).
    const trunkH = height * 0.92;
    barkParts.push(tint(tube(new THREE.Vector3(), _up, trunkH, 0.30, 0.10), trunkColor, 0.1, rng));
    const layers = 5;
    for (let i = 0; i < layers; i++) {
      const f = i / (layers - 1);
      const r = (1 - f * 0.78) * height * 0.30 * (0.92 + rng() * 0.16), h = height * 0.30;
      const cone = new THREE.ConeGeometry(r, h, 9);
      cone.translate((rng() - 0.5) * 0.22, height * 0.22 + f * height * 0.62, (rng() - 0.5) * 0.22);
      cone.applyMatrix4(new THREE.Matrix4().makeRotationY(rng() * 3));
      leafParts.push(tint(cone, 0xffffff, 0.3, rng)); // texture carries the green
    }
  } else if (type === 'bush') {
    const stems = 4 + (rng() * 3 | 0);
    for (let i = 0; i < stems; i++) {
      const dir = new THREE.Vector3((rng() - 0.5) * 1.2, 1, (rng() - 0.5) * 1.2).normalize();
      grow(new THREE.Vector3((rng() - 0.5) * 0.5, 0, (rng() - 0.5) * 0.5), dir, height * 0.34, 0.09, P.levels);
    }
  } else {
    grow(new THREE.Vector3(), _up.clone(), height * P.trunkLen, P.trunk * height * 0.09 + 0.14, P.levels);
    // root flare so the trunk sits IN the ground, never floating
    const flare = new THREE.CylinderGeometry(0.20, 0.34, 0.5, 7);
    flare.translate(0, 0.22, 0);
    barkParts.push(tint(flare, trunkColor, 0.1, rng));
  }

  const barkMat = new THREE.MeshLambertMaterial({ map: barkTex || barkTexture(), vertexColors: true });
  const barkMesh = new THREE.Mesh(mergeGeoms(barkParts), barkMat);
  barkMesh.name = 'veg-bark';
  group.add(barkMesh);

  let leafMesh;
  if (type === 'pine') {
    leafMesh = new THREE.Mesh(mergeGeoms(leafParts),
      new THREE.MeshLambertMaterial({ map: needleTexture(), vertexColors: true }));
  } else {
    // Leaf cards: 2 crossed planes per anchor with the cluster texture.
    const tex = leafTex || leafClusterTexture();
    for (const a of anchors) {
      for (let k = 0; k < 2; k++) {
        const card = new THREE.PlaneGeometry(a.s, a.s * 0.82);
        card.translate(0, a.s * 0.18, 0);
        const m = new THREE.Matrix4()
          .makeRotationFromEuler(new THREE.Euler((rng() - 0.5) * 0.7, rng() * Math.PI, (rng() - 0.5) * 0.7))
          .setPosition(a.p.x + (rng() - 0.5) * 0.5, a.p.y + (rng() - 0.5) * 0.4, a.p.z + (rng() - 0.5) * 0.5);
        card.applyMatrix4(m);
        leafParts.push(tint(card, leafColor, 0.25, rng));
      }
    }
    leafMesh = new THREE.Mesh(mergeGeoms(leafParts),
      new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.42, side: THREE.DoubleSide, vertexColors: true }));
  }
  leafMesh.name = 'veg-canopy';
  group.add(leafMesh);

  const phase = rng() * 6.28;
  group.userData.vegUpdate = (t) => { // gentle whole-canopy sway
    leafMesh.rotation.z = Math.sin(t * 0.8 + phase) * 0.010;
    leafMesh.rotation.x = Math.cos(t * 0.63 + phase) * 0.007;
  };
  group.userData.anchors = anchors.length;
  return group;
}

// =====================================================================
// FLOWERS / accent plants — crossed cards with a drawn flower head on
// a stem card, scattered in patches. Cheap, saturated, phone-readable.
// =====================================================================
export function makeFlowers(opts = {}) {
  const { patches = [[0, 0]], perPatch = 26, seed = 11, colors = ['#e2483d', '#ffd23e', '#b678e8'] } = opts;
  const rng = mulberry32(seed);
  const byColor = new Map();
  for (const [px, pz] of patches) {
    for (let i = 0; i < perPatch; i++) {
      const col = colors[(rng() * colors.length) | 0];
      if (!byColor.has(col)) byColor.set(col, []);
      const x = px + (rng() - 0.5) * 2.6, z = pz + (rng() - 0.5) * 2.6;
      const s = 0.30 + rng() * 0.16, h = 0.34 + rng() * 0.22;
      for (let k = 0; k < 2; k++) {
        const card = new THREE.PlaneGeometry(s, s);
        card.translate(0, h, 0);
        card.applyMatrix4(new THREE.Matrix4().makeRotationY(rng() * Math.PI).setPosition(x, 0, z));
        byColor.get(col).push(tint(card, 0xffffff, 0.15, rng));
      }
      // stem
      const stem = new THREE.PlaneGeometry(0.045, h);
      stem.translate(0, h / 2, 0);
      stem.applyMatrix4(new THREE.Matrix4().makeRotationY(rng() * Math.PI).setPosition(x, 0, z));
      if (!byColor.has('__stem')) byColor.set('__stem', []);
      byColor.get('__stem').push(tint(stem, 0x4a7030, 0.1, rng));
    }
  }
  const group = new THREE.Group();
  for (const [col, parts] of byColor) {
    if (col === '__stem') {
      group.add(new THREE.Mesh(mergeGeoms(parts), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
    } else {
      group.add(new THREE.Mesh(mergeGeoms(parts),
        new THREE.MeshLambertMaterial({ map: flowerTexture(col), alphaTest: 0.4, side: THREE.DoubleSide, vertexColors: true })));
    }
  }
  group.name = 'veg-flowers';
  return group;
}
