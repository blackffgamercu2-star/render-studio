import * as THREE from 'three';
import { fbm, ridged, warp, hash12, rng, canvasTex, windPatch, GLSL_SNOISE } from './common.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ============================================================================
// TERRAIN — structure learned from threejs-worldgen WORLDGEN.md (Apache-2.0):
// climate fields (domain-warped fBm) -> height = spline(continentalness) +
// ridged-multifractal mountains masked by a ridges field - rivers. Height is a
// CPU function shared by mesh, placement and characters. Re-implemented in JS.
// Colouring follows worldgen's ground-splat rules + proceduralterrains'
// computeTerrainAlbedo inputs (MIT): rock by slope, snow above a snowline,
// wet sand at the water line, micro-noise grain.
// ============================================================================
export function riverX(z) { return Math.sin(z * 0.045) * 4.5 - 6.5; } // v3: swing narrowed/shifted west so the channel never crosses the road corridor (v2 swing flooded the road at z>20)
const ss = THREE.MathUtils.smoothstep, lerp = THREE.MathUtils.lerp;

export function terrainH(x, z) {
  const [wx, wz] = warp(x, z, 16, 0.010);
  const cont = fbm(wx * 0.0075 + 3, wz * 0.0075 + 8, 4);            // continentalness
  let base = (cont - 0.45) * 8.0;                                    // spline-ish base
  const detail = (fbm(wx * 0.07, wz * 0.07, 3) - 0.5) * 0.7;
  const dist = Math.hypot(x, z);
  const flat = 0.22 + 0.78 * ss(dist, 3, 20);                         // calm valley floor
  let h = (base + detail) * flat;
  const ridgeField = fbm(wx * 0.0045 + 90, wz * 0.0045 + 40, 3);     // where ranges sit
  const mMask = ss(ridgeField, 0.52, 0.75) * ss(dist, 30, 66);
  const rg = ridged(wx * 0.013 + 7, wz * 0.013 + 19, 4);
  h += rg * rg * 25 * mMask;                                         // ridged mountains
  const dRiver = Math.abs(x - riverX(z));
  h = lerp(-0.55, h, ss(dRiver, 1.2, 6.5));                          // carve channel
  return h;
}
export function terrainSlope(x, z) {
  const e = 0.6, h = terrainH(x, z);
  const dx = terrainH(x + e, z) - h, dz = terrainH(x, z + e) - h;
  return Math.min(1, Math.hypot(dx, dz) / e * 0.5); // ~0 flat .. 1 steep
}

export function buildTerrain(size = 180, seg = 130) {
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cGrass = new THREE.Color(0x35701f), cDry = new THREE.Color(0x6f8f36),
    cDirt = new THREE.Color(0x77653f), cSand = new THREE.Color(0xb3a06b),
    cWet = new THREE.Color(0x6d5b3a), cRock = new THREE.Color(0x707a80),
    cRockHi = new THREE.Color(0x8b959c), cSnow = new THREE.Color(0xf2f6fa);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = terrainH(x, z);
    pos.setY(i, h);
    const moist = fbm(x * 0.012 + 50, z * 0.012 + 23, 3);
    tmp.copy(cDry).lerp(cGrass, ss(moist, 0.30, 0.58));                       // moisture band
    const grain = 0.90 + hash12(Math.round(x * 3.1), Math.round(z * 3.1)) * 0.20; // micro grain (PT)
    const e = 0.7, ny = 1 / Math.hypot((terrainH(x + e, z) - h) / e, 1, (terrainH(x, z + e) - h) / e);
    const slope = 1 - ny;
    tmp.lerp(cDirt, ss(slope, 0.18, 0.34) * 0.5);
    tmp.lerp(hash12(i, 7) > 0.5 ? cRock : cRockHi, ss(slope, 0.30, 0.52));    // rock by slope
    const dRiver = Math.abs(x - riverX(z));
    if (dRiver < 3.0 && h < 0.75) tmp.lerp(cSand, ss(3.0 - dRiver, 0, 1.6) * 0.8);  // shore sand
    if (h < 0.12 && dRiver < 3.4) tmp.lerp(cWet, 0.55);                       // wet band
    const snowline = 13.0 + (fbm(x * 0.03 + 77, z * 0.03, 2) - 0.5) * 3.5;
    if (h > snowline) tmp.lerp(cSnow, ss(h - snowline, 0, 2.2) * ss(0.42 - slope, 0, 0.20)); // snowline, flatter faces only
    colors[i * 3] = tmp.r * grain; colors[i * 3 + 1] = tmp.g * grain; colors[i * 3 + 2] = tmp.b * grain;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
  mesh.receiveShadow = true;
  return mesh;
}

// ============================================================================
// GRASS — placement/shading learned from wolffe three.js-skills card-grass
// (MIT): JITTERED GRID (one blade per cell, jitter over the WHOLE cell),
// thinned by a TWO-OCTAVE DENSITY FIELD (38 m + 9 m, keep-share 0.2..1),
// fixed yaw from a position hash, ROOT SHADING rising to full at 45% height.
// Geometry blades (not photo cards — no atlas exists here). Material is
// MeshStandardMaterial (PBR, receives light/shadow — v1 was unlit) with the
// AAA-cookbook onBeforeCompile wind patch (see common.js).
// ============================================================================
export function buildGrass(area = 36, seed = 7, dark = false) {
  const spacing = 0.62;
  const cells = Math.floor((area * 2) / spacing);
  const mats4 = [];
  const tint = new THREE.Color();
  const rand = rng(seed);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const spots = [];
  for (let ci = 0; ci < cells; ci++) for (let cj = 0; cj < cells; cj++) {
    const gx = -area + ci * spacing, gz = -area + cj * spacing;
    const keep = THREE.MathUtils.clamp(0.12 + 0.62 * fbm(gx * 0.026 + 5, gz * 0.026, 3) + 0.45 * fbm(gx * 0.11 + 21, gz * 0.11, 2), 0.05, 1);
    if (hash12(ci * 3 + seed, cj * 7) > keep) continue;                       // density field thinning
    const x = gx + rand() * spacing, z = gz + rand() * spacing;              // whole-cell jitter
    if (Math.abs(x - riverX(z)) < 1.9) continue;
    const h = terrainH(x, z); if (h < -0.1) continue;
    if (terrainSlope(x, z) > 0.42) continue;
    spots.push([x, h - 0.03, z]);
  }
  const blade = new THREE.PlaneGeometry(0.13, 0.52, 1, 3);
  blade.translate(0, 0.26, 0);
  const bp = blade.attributes.position, bc = new Float32Array(bp.count * 3);
  for (let i = 0; i < bp.count; i++) {
    const y = bp.getY(i), f = y / 0.52;
    bp.setX(i, bp.getX(i) * (1 - f * 0.85));
    const shade = f < 0.45 ? 0.55 + (f / 0.45) * 0.45 : 1.0 + (f - 0.45) * 0.08; // root shade rule
    bc[i * 3] = shade * 0.82; bc[i * 3 + 1] = shade; bc[i * 3 + 2] = shade * 0.78;
  }
  blade.setAttribute('color', new THREE.BufferAttribute(bc, 3));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 1, metalness: 0, color: dark ? 0x5c6b58 : 0xffffff });
  const wind = windPatch(mat, { amp: 0.30, freq: 1.6, key: 'grass-wind-v2' });
  const mesh = new THREE.InstancedMesh(blade, mat, spots.length);
  spots.forEach(([x, y, z], i) => {
    const yaw = hash12(Math.round(x * 13), Math.round(z * 17)) * Math.PI;    // fixed yaw from hash
    e.set(0, yaw, 0); q.setFromEuler(e);
    const s = 0.75 + hash12(i, 31) * 0.6;
    m4.compose(v.set(x, y, z), q, sc.set(s, s * (0.85 + hash12(i, 47) * 0.4), s));
    mesh.setMatrixAt(i, m4);
    tint.setHSL(0.26 + hash12(i, 91) * 0.04, 0.55, dark ? 0.24 : 0.30 + hash12(i, 57) * 0.10); // per-instance tint (open-3d Kit pattern)
    mesh.setColorAt(i, tint);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  return { mesh, count: spots.length, update(t) { wind.update(t); } };
}

// ============================================================================
// TREES — learned from threejs-worldgen trees (Apache-2.0): skeleton grown
// toward attractor points (their space-colonization, simplified), branches as
// tapered tube segments, leaves as CARDS. Bark + leaf textures drawn on canvas
// (open-3d-skills canvasTex pattern, MIT). Trunks and leaves are each merged
// into ONE geometry for the whole forest (open-3d Kit instancing logic,
// merged-static variant).
// ============================================================================
function leafTexture() {
  return canvasTex(256, 256, (g) => {
    g.clearRect(0, 0, 256, 256);
    const r = rng(1234);
    for (let i = 0; i < 110; i++) {
      const x = 28 + r() * 200, y = 28 + r() * 200, a = r() * 6.28, l = 13 + r() * 15;
      g.save(); g.translate(x, y); g.rotate(a);
      g.fillStyle = `hsl(${95 + r() * 40}, ${42 + r() * 25}%, ${20 + r() * 20}%)`;
      g.beginPath(); g.ellipse(0, 0, l, l * 0.42, 0, 0, 6.29); g.fill(); g.restore();
    }
  });
}
function barkTexture() {
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#5a4230'; g.fillRect(0, 0, w, h);
    const r = rng(77);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(${20 + r() * 40},${14 + r() * 26},${8 + r() * 16},${0.25 + r() * 0.4})`;
      g.fillRect(r() * w, r() * h, 2 + r() * 3, 8 + r() * 30);
    }
  }, { repeat: [1, 2] });
}
function growTree(rand, dark = false) {
  const trunkGeos = [], leafGeos = [];
  const barkM = new THREE.Matrix4();
  // attractors: points in a crown ellipsoid (space-colonization targets)
  const attractors = [];
  for (let i = 0; i < 26; i++) {
    const a = rand() * Math.PI * 2, b = Math.acos(2 * rand() - 1), rr = 0.9 + rand() * 0.7;
    attractors.push(new THREE.Vector3(Math.sin(b) * Math.cos(a) * rr * 1.15, 2.6 + Math.cos(b) * rr * 0.8, Math.sin(b) * Math.sin(a) * rr * 1.15));
  }
  const reached = new Set();
  function seg(from, to, r0, r1) {
    const dir = to.clone().sub(from), len = dir.length();
    const g = new THREE.CylinderGeometry(r1, r0, len, 6, 1);
    g.translate(0, len / 2, 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    barkM.compose(from, quat, new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(barkM);
    trunkGeos.push(g);
  }
  function leafCluster(p, s) {
    for (let k = 0; k < 3; k++) {
      const g = new THREE.PlaneGeometry(1.35 * s, 1.35 * s);
      const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, k * Math.PI / 3 + rand() * 0.4, 0));
      m.setPosition(p.x + (rand() - 0.5) * 0.3, p.y + (rand() - 0.5) * 0.25, p.z + (rand() - 0.5) * 0.3);
      g.applyMatrix4(m); leafGeos.push(g);
    }
  }
  // growth: tips chase the nearest unreached attractor (colonization-lite)
  let tips = [{ p: new THREE.Vector3(0, 0, 0), d: new THREE.Vector3(0, 1, 0), r: 0.15, depth: 0 }];
  seg(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1.15, 0), 0.17, 0.13);
  tips = [{ p: new THREE.Vector3(0, 1.15, 0), d: new THREE.Vector3((rand() - 0.5) * 0.3, 1, (rand() - 0.5) * 0.3).normalize(), r: 0.125, depth: 1 }];
  let guard = 0;
  while (tips.length && guard++ < 90) {
    const next = [];
    for (const tip of tips) {
      let best = null, bd = 1e9;
      attractors.forEach((a, i) => { if (!reached.has(i)) { const d = a.distanceTo(tip.p); if (d < bd) { bd = d; best = i; } } });
      const target = best !== null ? attractors[best].clone().sub(tip.p).normalize() : new THREE.Vector3(0, 1, 0);
      const dir = tip.d.clone().lerp(target, 0.55).add(new THREE.Vector3((rand() - 0.5) * 0.24, 0.06, (rand() - 0.5) * 0.24)).normalize();
      const step = 0.55 + rand() * 0.3;
      const to = tip.p.clone().add(dir.clone().multiplyScalar(step));
      seg(tip.p, to, tip.r, tip.r * 0.78);
      if (best !== null && bd < 0.62) { reached.add(best); leafCluster(attractors[best], 0.9 + rand() * 0.5); }
      if (tip.depth >= 5 || tip.r < 0.02) { leafCluster(to, 0.75 + rand() * 0.45); continue; }
      const kids = tip.depth < 2 ? 2 : (rand() > 0.45 ? 2 : 1);
      for (let k = 0; k < kids; k++) {
        const nd = dir.clone();
        nd.x += (rand() - 0.5) * 0.85; nd.z += (rand() - 0.5) * 0.85; nd.y += (rand() - 0.35) * 0.3;
        next.push({ p: to, d: nd.normalize(), r: tip.r * 0.74, depth: tip.depth + 1 });
      }
    }
    tips = next;
  }
  return { trunkGeos, leafGeos };
}
export function scatterTrees(n = 30, seed = 11, dark = false, area = 54, avoidFn = null) {
  const rand = rng(seed);
  const allTrunk = [], allLeaf = [];
  let placed = 0, guard = 0;
  while (placed < n && guard++ < n * 30) {
    const x = (rand() * 2 - 1) * area, z = (rand() * 2 - 1) * area;
    if (Math.abs(x - riverX(z)) < 3.6 || Math.hypot(x, z) < 5.5) continue;
    if (avoidFn && avoidFn(x, z)) continue;
    const h = terrainH(x, z); if (h > 8 || terrainSlope(x, z) > 0.4) continue;
    const { trunkGeos, leafGeos } = growTree(rand, dark);
    const s = 0.85 + rand() * 0.8;
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, h - 0.06, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6.28),
      new THREE.Vector3(s, s * (0.9 + rand() * 0.25), s));
    trunkGeos.forEach(g => { g.applyMatrix4(m); allTrunk.push(g); });
    leafGeos.forEach(g => { g.applyMatrix4(m); allLeaf.push(g); });
    placed++;
  }
  const group = new THREE.Group();
  const trunkMesh = new THREE.Mesh(mergeGeometries(allTrunk), new THREE.MeshStandardMaterial({ map: barkTexture(), roughness: 1, color: dark ? 0x8a8078 : 0xffffff }));
  trunkMesh.castShadow = true; trunkMesh.receiveShadow = true; group.add(trunkMesh);
  const leafMat = new THREE.MeshStandardMaterial({ map: leafTexture(), alphaTest: 0.42, side: THREE.DoubleSide, roughness: 1, color: dark ? 0x5f705f : 0xffffff });
  const leafWind = windPatch(leafMat, { amp: 0.05, freq: 1.3, key: 'leaf-wind-v2', phaseFrom: 'position', flatH: true });
  const leafMesh = new THREE.Mesh(mergeGeometries(allLeaf), leafMat);
  leafMesh.castShadow = true; group.add(leafMesh);
  return { group, update(t) { leafWind.update(t); } };
}

// Clouds: v1 puff clusters + an FBM alpha canvas (BoS ch.13 fbm structure,
// drawn on canvas) so edges break up instead of reading as hard spheres.
export function buildClouds(n = 9, seed = 3, dark = false, yBase = 21) {
  const rand = rng(seed); const group = new THREE.Group(); const clouds = [];
  const alphaTex = canvasTex(256, 256, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = (x / w - 0.5) * 2, dy = (y / h - 0.5) * 2;
      const fall = Math.max(0, 1 - Math.hypot(dx, dy));
      const nse = fbm(x * 0.045 + 9, y * 0.045, 4);
      const a = THREE.MathUtils.clamp((fall * 1.25 + nse * 0.55 - 0.55), 0, 1);
      const idx = (y * w + x) * 4; img.data[idx + 3] = a * 255;
    }
    g.putImageData(img, 0, 0);
  }, { srgb: false });
  const mat = new THREE.MeshStandardMaterial({ color: dark ? 0x49525f : 0xffffff, roughness: 1, transparent: true, opacity: dark ? 0.92 : 0.95, alphaMap: alphaTex, depthWrite: false, flatShading: true });
  for (let i = 0; i < n; i++) {
    const c = new THREE.Group();
    const puffs = 4 + Math.floor(rand() * 4);
    for (let j = 0; j < puffs; j++) {
      const r = 1.7 + rand() * 2.7;
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat);
      s.position.set(j * 1.8 - puffs * 0.85 + rand(), rand() * 0.8, (rand() - 0.5) * 2.6);
      s.scale.y = 0.45; c.add(s);
    }
    c.position.set((rand() * 2 - 1) * 95, yBase + rand() * 11, (rand() * 2 - 1) * 95);
    c.userData.speed = 0.5 + rand() * 0.8;
    group.add(c); clouds.push(c);
  }
  return { group, update(t) { clouds.forEach((c, i) => { c.position.x = ((c.userData.speed * t + i * 37) % 210) - 105; }); } };
}

// ============================================================================
// RIVER — Gerstner waves learned from threejs-worldgen water/src/waves.ts
// (Apache-2.0): dispersion omega = sqrt(g*k), amplitude scales with
// wavelength (constant steepness), choppiness = horizontal displacement.
// Shading follows wolffe water skill: layered scales, Fresnel, depth colour —
// plus BoS-style simplex sparkle. Re-implemented as a WebGL ShaderMaterial.
// ============================================================================
export function buildRiver(length = 185) {
  const geo = new THREE.PlaneGeometry(6.2, length, 8, 150);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const z = pos.getZ(i); pos.setX(i, pos.getX(i) + riverX(z)); pos.setY(i, 0.02); }
  geo.computeVertexNormals();
  const uniforms = { uTime: { value: 0 }, uSun: { value: new THREE.Vector3(0.45, 0.62, 0.28).normalize() } };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true,
    vertexShader: `
      uniform float uTime; varying vec3 vW; varying vec3 vN; varying vec2 vUv;
      vec3 gerstner(vec2 p, vec2 dir, float lambda, float chop, inout vec3 tang, inout vec3 binorm){
        float k = 6.28318 / lambda;
        float amp = 0.052 * pow(lambda / 7.0, 0.8);            // constant-steepness scaling
        float omega = sqrt(9.81 * k);                          // deep-water dispersion
        float ph = k * dot(dir, p) - omega * uTime;
        float s = sin(ph), c = cos(ph);
        float wa = k * amp;
        tang += vec3(-dir.x * dir.x * wa * s, dir.x * wa * c, -dir.x * dir.y * wa * s);
        binorm += vec3(-dir.x * dir.y * wa * s, dir.y * wa * c, -dir.y * dir.y * wa * s);
        return vec3(dir.x * chop * amp * c, amp * s, dir.y * chop * amp * c);
      }
      void main(){
        vUv = uv;
        vec3 p = position;
        vec3 tang = vec3(1.0, 0.0, 0.0), binorm = vec3(0.0, 0.0, 1.0);
        vec2 xz = p.xz;
        p += gerstner(xz, normalize(vec2(0.12, 1.0)), 7.0, 0.55, tang, binorm);
        p += gerstner(xz, normalize(vec2(-0.20, 1.0)), 3.7, 0.55, tang, binorm);
        p += gerstner(xz, normalize(vec2(0.80, 0.30)), 1.9, 0.4, tang, binorm);
        p += gerstner(xz, normalize(vec2(-0.60, 0.50)), 0.95, 0.3, tang, binorm);
        vN = normalize(cross(binorm, tang));
        vec4 wp = modelMatrix * vec4(p, 1.0); vW = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uSun; varying vec3 vW; varying vec3 vN; varying vec2 vUv;
      ${GLSL_SNOISE}
      void main(){
        vec3 V = normalize(cameraPosition - vW);
        float fres = pow(1.0 - max(dot(normalize(vN), V), 0.0), 3.0);
        vec3 deep = vec3(0.035, 0.15, 0.24); vec3 skyRef = vec3(0.52, 0.70, 0.88);
        vec3 c = mix(deep, skyRef, 0.18 + fres * 0.65);
        vec3 R = reflect(-V, normalize(vN));
        float spec = pow(max(dot(R, uSun), 0.0), 190.0) * 1.3;
        float sparkle = smoothstep(0.75, 1.0, snoise(vW.xz * 2.6 + vec2(0.0, -uTime * 1.7)) * 0.5 + 0.5) * 0.25;
        c += (spec + sparkle) * vec3(1.0, 0.97, 0.86);
        float foamN = snoise(vW.xz * 3.4 + vec2(0.0, -uTime * 1.2)) * 0.5 + 0.5;
        float foam = smoothstep(0.40, 0.485, abs(vUv.x - 0.5)) * smoothstep(0.45, 0.8, foamN);
        c = mix(c, vec3(0.92, 0.96, 0.98), foam * 0.55);
        float edge = smoothstep(0.0, 0.10, vUv.x) * smoothstep(1.0, 0.90, vUv.x);
        gl_FragColor = vec4(c, 0.94 * edge + 0.05);
      }`
  });
  const mesh = new THREE.Mesh(geo, mat);
  return { mesh, update(t) { uniforms.uTime.value = t; } };
}
