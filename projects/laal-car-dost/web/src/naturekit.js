import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvasTex, rng, hash12, fbm, windPatch } from './common.js';
import { terrainH, terrainSlope, riverX } from './nature.js';

// ============================================================================
// NATURE KIT v3 — built on the Abid-approved dashcam scene3.html technique
// (~/workspace/your_files/dashcam-3d-frame/scene3.html):
//  * canopy = canvas-painted LEAF-CLUSTER alpha cards (470 painted leaves per
//    cluster texture, alphaTest 0.42, DoubleSide, 3 crossed planes per top,
//    several tops per tree) over a bark-PBR tapered trunk + real branches
//  * bark = Poly Haven PBR set (CC0) reused from the dashcam project assets
//  * ground = textured surface, never a flat colour sheet
// Grass follows the same card logic: canvas-painted multi-blade alpha cards
// on crossed quads, instanced, per-instance tint, AAA-cookbook wind patch
// (v2 common.js). NO single-colour spike geometry anywhere.
// ============================================================================

// ---------- canvas: leaf cluster (dashcam scene3 leafClusterTexture, adapted) ----------
export function leafClusterTexture(seed = 1234, hueBase = 96) {
  return canvasTex(512, 512, (g) => {
    let sd = seed; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 470; i++) {
      const ang = rnd() * Math.PI * 2, rr = Math.pow(rnd(), 0.6) * 212;
      const x = 256 + Math.cos(ang) * rr, y = 256 + Math.sin(ang) * rr * 0.92;
      const L = 15 + rnd() * 20, Wd = L * 0.42, rot = rnd() * Math.PI;
      const hue = hueBase + rnd() * 22, li = 17 + rnd() * 15;
      g.save(); g.translate(x, y); g.rotate(rot);
      const gr = g.createLinearGradient(-L / 2, 0, L / 2, 0);
      gr.addColorStop(0, 'hsl(' + hue + ',42%,' + li + '%)');
      gr.addColorStop(1, 'hsl(' + (hue + 16) + ',48%,' + (li + 9) + '%)');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(-L / 2, 0); g.quadraticCurveTo(0, -Wd, L / 2, 0); g.quadraticCurveTo(0, Wd, -L / 2, 0); g.fill();
      g.strokeStyle = 'rgba(18,38,14,0.35)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(-L / 2, 0); g.lineTo(L / 2, 0); g.stroke();
      g.restore();
    }
  });
}

// ---------- canvas: grass card — many tapered blades, root dark -> tip light ----------
export function grassCardTexture(seed = 77) {
  return canvasTex(256, 256, (g, w, h) => {
    let sd = seed; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 110; i++) {
      const bx = 8 + rnd() * (w - 16);
      const bh = h * (0.45 + rnd() * 0.55);
      const bw = 3.2 + rnd() * 3.6;
      const lean = (rnd() - 0.5) * 34;
      const hue = 92 + rnd() * 26, sat = 42 + rnd() * 18;
      const gr = g.createLinearGradient(0, h, 0, h - bh);
      gr.addColorStop(0, 'hsl(' + hue + ',' + sat + '%,15%)');
      gr.addColorStop(0.55, 'hsl(' + hue + ',' + sat + '%,27%)');
      gr.addColorStop(1, 'hsl(' + (hue + 10) + ',' + (sat + 8) + '%,44%)');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(bx - bw / 2, h);
      g.quadraticCurveTo(bx - bw * 0.28 + lean * 0.4, h - bh * 0.6, bx + lean, h - bh);
      g.quadraticCurveTo(bx + bw * 0.28 + lean * 0.4, h - bh * 0.6, bx + bw / 2, h);
      g.closePath(); g.fill();
    }
  });
}

// ---------- ground detail: near-neutral luminance grain so the v2 vertex-colour
// splat gains close-range texture without hue shift (multiplies in three.js) ----------
export function groundDetailTexture() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#cfcfcf'; g.fillRect(0, 0, w, h);
    const r = rng(41);
    for (let i = 0; i < 9000; i++) { // short grass strokes
      const x = r() * w, y = r() * h, l = 3 + r() * 6, a = (r() - 0.5) * 0.9;
      const v = 150 + r() * 80;
      g.strokeStyle = `rgba(${v * 0.92},${v},${v * 0.78},${0.25 + r() * 0.3})`;
      g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(a) * l, y - Math.cos(a) * l); g.stroke();
    }
    for (let i = 0; i < 260; i++) { // dirt speckle
      const v = 120 + r() * 50;
      g.fillStyle = `rgba(${v},${v * 0.9},${v * 0.66},${0.18 + r() * 0.2})`;
      g.beginPath(); g.ellipse(r() * w, r() * h, 2 + r() * 6, 1.5 + r() * 4, r() * 3, 0, 7); g.fill();
    }
  }, { repeat: [120, 120] });
}

export function dirtTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#8a6f47'; g.fillRect(0, 0, w, h);
    const r = rng(23);
    for (let i = 0; i < 2400; i++) {
      const v = 96 + r() * 70;
      g.fillStyle = `rgba(${v + 30},${v + 8},${v * 0.62},${0.3 + r() * 0.35})`;
      g.fillRect(r() * w, r() * h, 1.5 + r() * 2.5, 1.5 + r() * 2);
    }
    for (let i = 0; i < 60; i++) { // small stones on the path
      const v = 130 + r() * 60;
      g.fillStyle = `rgb(${v},${v},${v * 0.95})`;
      g.beginPath(); g.ellipse(r() * w, r() * h, 1.5 + r() * 3, 1 + r() * 2, r() * 3, 0, 7); g.fill();
    }
  }, { repeat: [1, 26] });
}

// ---------- GRASS: instanced crossed alpha cards ----------
export function buildGrassCards({ x0 = -16, x1 = 18, z0 = -48, z1 = 42, spacing = 0.55, seed = 7, avoid = null, thin = null } = {}) {
  const texA = grassCardTexture(77), texB = grassCardTexture(171);
  function crossGeo() {
    const p1 = new THREE.PlaneGeometry(0.78, 0.54); p1.translate(0, 0.27, 0);
    const p2 = p1.clone(); p2.rotateY(Math.PI / 2);
    return mergeGeometries([p1, p2]);
  }
  const geo = crossGeo();
  const spots = [];
  const rand = rng(seed);
  for (let gx = x0; gx < x1; gx += spacing) for (let gz = z0; gz < z1; gz += spacing) {
    let keep = THREE.MathUtils.clamp(0.10 + 0.66 * fbm(gx * 0.026 + 5, gz * 0.026, 3) + 0.48 * fbm(gx * 0.11 + 21, gz * 0.11, 2), 0.04, 0.88);
    if (thin) keep *= thin(gx, gz);
    if (hash12(Math.round(gx * 31), Math.round(gz * 37)) > keep) continue;
    const x = gx + rand() * spacing, z = gz + rand() * spacing;
    if (Math.abs(x - riverX(z)) < 2.0) continue;
    const h = terrainH(x, z); if (h < -0.08) continue;
    if (terrainSlope(x, z) > 0.45) continue;
    if (avoid && avoid(x, z)) continue;
    spots.push([x, h - 0.02, z]);
  }
  const winds = [];
  const groups = [];
  [texA, texB].forEach((tex, gi) => {
    const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.32, side: THREE.DoubleSide, roughness: 1, metalness: 0 });
    winds.push(windPatch(mat, { amp: 0.16, freq: 1.7, key: 'grasscard-wind-' + gi }));
    const mine = spots.filter((_, i) => i % 2 === gi);
    const mesh = new THREE.InstancedMesh(geo, mat, mine.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    const tint = new THREE.Color();
    mine.forEach(([x, y, z], i) => {
      e.set(0, hash12(i * 3 + gi, 17) * Math.PI, 0); q.setFromEuler(e);
      const s = 0.8 + hash12(i, 29 + gi) * 0.65;
      m4.compose(v.set(x, y, z), q, sc.set(s, s * (0.85 + hash12(i, 43) * 0.45), s));
      mesh.setMatrixAt(i, m4);
      tint.setHSL(0.24 + hash12(i, 91) * 0.05, 0.48, 0.40 + hash12(i, 57) * 0.14);
      mesh.setColorAt(i, tint);
    });
    mesh.receiveShadow = true;
    groups.push(mesh);
  });
  return { meshes: groups, count: spots.length, update(t) { winds.forEach(w => w.update(t)); } };
}

// ---------- TREES: bark PBR trunk + branches + leaf-cluster cards + dark core ----------
let barkMats = null;
function loadBark() {
  if (barkMats) return barkMats;
  const tl = new THREE.TextureLoader();
  const mk = (p, srgb, rx, ry) => { const t = tl.load(p); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  // Poly Haven bark set (CC0), reused from the Abid-approved dashcam project.
  barkMats = new THREE.MeshStandardMaterial({
    map: mk('assets/bark_diff.jpg', true, 1, 2), roughnessMap: mk('assets/bark_rough.jpg', false, 1, 2),
    normalMap: mk('assets/bark_nor.jpg', false, 1, 2), normalScale: new THREE.Vector2(0.7, 0.7), roughness: 1
  });
  barkMats.envMapIntensity = 0.3;
  return barkMats;
}
const leafMats = [];
function leafMat(seed, hue) {
  const m = new THREE.MeshStandardMaterial({ map: leafClusterTexture(seed, hue), alphaTest: 0.42, side: THREE.DoubleSide, roughness: 1 });
  m.envMapIntensity = 0.35; leafMats.push(m); return m;
}
const coreMat = new THREE.MeshStandardMaterial({ color: 0x24451a, roughness: 1 });

export function makeTree(seed = 1, s = 1) {
  let sd = seed * 7919 + 13; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const bark = loadBark();
  const tree = new THREE.Group();
  const trunkH = 1.7 * s;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.10 * s, 0.22 * s, trunkH, 7), bark);
  trunk.position.y = trunkH / 2; trunk.castShadow = true; tree.add(trunk);
  const lm = leafMat(seed * 31 + 5, 92 + Math.floor(rnd() * 14));
  const clusterGeo = new THREE.PlaneGeometry(2.5 * s, 2.5 * s);
  const tops = [];
  const nb = 3 + Math.floor(rnd() * 2);
  for (let i = 0; i < nb; i++) {
    const ang = (i / nb) * Math.PI * 2 + rnd() * 0.9;
    const tilt = 0.5 + rnd() * 0.45;
    const bl = (0.95 + rnd() * 0.55) * s;
    const dir = new THREE.Vector3(Math.cos(ang) * Math.sin(tilt), Math.cos(tilt), Math.sin(ang) * Math.sin(tilt));
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.035 * s, 0.07 * s, bl, 5), bark);
    br.position.copy(dir.clone().multiplyScalar(bl / 2)).add(new THREE.Vector3(0, trunkH * 0.8, 0));
    br.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    br.castShadow = true; tree.add(br);
    tops.push(dir.clone().multiplyScalar(bl).add(new THREE.Vector3(0, trunkH * 0.8, 0)));
  }
  tops.push(new THREE.Vector3(0, trunkH + 0.6 * s, 0));
  // dark inner volume so the canopy has depth, not see-through cards
  const core = new THREE.Mesh(new THREE.SphereGeometry(1.02 * s, 10, 8), coreMat);
  core.position.set(0, trunkH + 0.55 * s, 0); core.scale.y = 0.82; tree.add(core);
  const cards = new THREE.Group();
  for (const p of tops) for (let k = 0; k < 3; k++) {
    const pl = new THREE.Mesh(clusterGeo, lm);
    pl.position.copy(p); pl.rotation.y = k * Math.PI / 3 + rnd() * 0.4;
    pl.castShadow = true; cards.add(pl);
  }
  tree.add(cards);
  tree.userData.cards = cards;
  return tree;
}

export function scatterTreesKit(positions) {
  const grp = new THREE.Group();
  const trees = [];
  positions.forEach(([x, z, s], i) => {
    const tr = makeTree(100 + i * 7, s);
    tr.position.set(x, terrainH(x, z) - 0.04, z);
    tr.rotation.y = hash12(i, 3) * Math.PI * 2;
    grp.add(tr); trees.push(tr);
  });
  return { group: grp, update(t) { trees.forEach((tr, i) => { tr.userData.cards.rotation.y = Math.sin(t * 0.7 + i * 1.7) * 0.03; tr.userData.cards.position.x = Math.sin(t * 1.1 + i) * 0.02; }); } };
}

export function makeBush(seed = 3, s = 1) {
  const lm = leafMat(seed * 17 + 2, 98);
  const grp = new THREE.Group();
  const geo = new THREE.PlaneGeometry(1.45 * s, 0.95 * s);
  for (let k = 0; k < 2; k++) {
    const pl = new THREE.Mesh(geo, lm);
    pl.position.y = 0.42 * s; pl.rotation.y = k * Math.PI / 2 + seed;
    pl.castShadow = true; grp.add(pl);
  }
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.42 * s, 8, 6), coreMat);
  core.position.y = 0.36 * s; core.scale.y = 0.75; grp.add(core);
  return grp;
}

// ---------- scattered stones + flower dots (instanced) ----------
export function scatterDetail(avoid) {
  const grp = new THREE.Group();
  const rand = rng(97);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const col = new THREE.Color();
  const stones = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.09, 0), new THREE.MeshStandardMaterial({ roughness: 1 }), 130);
  let si = 0;
  for (let i = 0; i < 500 && si < 130; i++) {
    const x = -16 + rand() * 34, z = -48 + rand() * 90;
    if (Math.abs(x - riverX(z)) < 2.2 || (avoid && avoid(x, z))) continue;
    const h = terrainH(x, z); if (h < -0.05) continue;
    e.set(rand() * 3, rand() * 3, rand() * 3); q.setFromEuler(e);
    const s = 0.5 + rand() * 1.5;
    m4.compose(v.set(x, h + 0.01, z), q, sc.set(s, s * 0.6, s));
    stones.setMatrixAt(si, m4);
    const g = 0.42 + rand() * 0.25; col.setRGB(g, g, g * 0.96); stones.setColorAt(si, col);
    si++;
  }
  stones.count = si; stones.castShadow = true; grp.add(stones);
  // flowers: stems + coloured heads in meadow patches
  const N = 170;
  const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.008, 0.011, 0.3, 5), new THREE.MeshStandardMaterial({ color: 0x2e5c1e, roughness: 1 }), N);
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshStandardMaterial({ roughness: 0.6 }), N);
  const palette = [0xffffff, 0xffd94a, 0xff8fb3, 0xffa03c].map(c => new THREE.Color(c));
  let fi = 0;
  for (let i = 0; i < 900 && fi < N; i++) {
    const x = -15 + rand() * 33, z = -48 + rand() * 90;
    if (Math.abs(x - riverX(z)) < 2.4 || (avoid && avoid(x, z))) continue;
    const h = terrainH(x, z); if (h < 0 || terrainSlope(x, z) > 0.4) continue;
    if (fbm(x * 0.05 + 9, z * 0.05, 2) < 0.52) continue; // patches only
    q.identity();
    m4.compose(v.set(x, h + 0.15, z), q, sc.set(1, 1, 1)); stems.setMatrixAt(fi, m4);
    m4.compose(v.set(x, h + 0.32, z), q, sc.set(1, 0.8, 1)); heads.setMatrixAt(fi, m4);
    heads.setColorAt(fi, palette[Math.floor(rand() * palette.length)]);
    fi++;
  }
  stems.count = heads.count = fi; grp.add(stems); grp.add(heads);
  return grp;
}
