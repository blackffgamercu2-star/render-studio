import * as THREE from 'three';
import { canvasTex, rng } from './common.js';

// ============================================================================
// CAR v2 — body LOFTED through superellipse cross-sections, learned from
// threejs-worldgen packages/vehicles/src/body.ts (Apache-2.0): profile keys
// (belt line, bottom line, plan width, roof line, tumblehome, pillars) drive
// a loft; wheel arches are raised in the bottom profile around the axles.
// Re-implemented in plain three.js (worldgen is TS/WebGPU).
// Paint follows wolffe paint skill (MIT): layered surface = colour +
// clearcoat + subtle roughness variation (canvas roughness map) + dirt low
// on the body (vertex-colour darkening near the sills).
// Wheels are LATHE profiles (open-3d-skills kit.js lathe pattern, MIT).
// ============================================================================
function prof(keys) { // piecewise-linear profile sampler over u in 0..1
  return (u) => {
    for (let i = 1; i < keys.length; i++) {
      if (u <= keys[i][0]) {
        const [u0, v0] = keys[i - 1], [u1, v1] = keys[i];
        const f = (u - u0) / (u1 - u0);
        return v0 + (v1 - v0) * (f * f * (3 - 2 * f));
      }
    }
    return keys[keys.length - 1][1];
  };
}
const belt = prof([[0, 0.76], [0.12, 0.83], [0.30, 0.86], [0.55, 0.86], [0.78, 0.83], [0.93, 0.70], [1, 0.57]]);
const bottomBase = prof([[0, 0.30], [0.08, 0.17], [0.5, 0.15], [0.92, 0.17], [1, 0.28]]);
const plan = prof([[0, 0.60], [0.06, 0.79], [0.20, 0.855], [0.5, 0.865], [0.80, 0.855], [0.95, 0.79], [1, 0.64]]);
const roof = prof([[0.26, 1.04], [0.38, 1.30], [0.55, 1.345], [0.72, 1.30], [0.84, 1.06]]);
const AXLES_U = [0.191, 0.809]; // x = -1.42, +1.42 on L = 4.6
function bottom(u) {
  let b = bottomBase(u);
  for (const a of AXLES_U) { const d = (u - a) / 0.052; b += 0.335 * Math.exp(-d * d); } // arch lift
  return b;
}
function section(u, top, bot, hw, e, tumble = 0) {
  const pts = [], N = 20, cyC = (top + bot) / 2, halfH = (top - bot) / 2;
  for (let k = 0; k < N; k++) {
    const a = (k / N) * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    const cx = Math.sign(ca) * Math.pow(Math.abs(ca), 2 / e);
    let cy = Math.sign(sa) * Math.pow(Math.abs(sa), 2 / e);
    if (cy > 0) cy *= 0.94; // slightly flattened crown so the top line reads
    const wScale = 1 - tumble * Math.max(0, cy); // tumblehome: top narrower
    pts.push([cyC + cy * halfH, cx * hw * wScale]);
  }
  return pts;
}
function loft(nStations, sectionFn, mat, capScale = 0.06) {
  const verts = [], cols = [], idx = [];
  const stations = [];
  for (let i = 0; i <= nStations; i++) stations.push(i / nStations);
  const ringPts = sectionFn(0).length;
  stations.forEach((u, si) => {
    const pts = sectionFn(u);
    const shrink = (si === 0 || si === stations.length - 1) ? capScale : 1;
    pts.forEach(([y, z]) => {
      verts.push(-2.3 + u * 4.6, y, z * shrink);
      cols.push(1, 1, 1);
    });
  });
  for (let si = 0; si < nStations; si++) for (let k = 0; k < ringPts; k++) {
    const a = si * ringPts + k, b = si * ringPts + (k + 1) % ringPts, c = a + ringPts, d = b + ringPts;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.castShadow = true;
  return { mesh: m, geometry: g };
}

export function buildCar(color = 0xb02020) {
  const roughTex = canvasTex(256, 256, (g, w, h) => { // subtle roughness variation (paint skill)
    g.fillStyle = '#4d4d4d'; g.fillRect(0, 0, w, h);
    const r = rng(9);
    for (let i = 0; i < 5200; i++) { const v = 60 + r() * 50; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(r() * w, r() * h, 2.5, 2.5); }
  }, { srgb: false, repeat: [2, 1] });
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.25, roughness: 0.62, roughnessMap: roughTex, clearcoat: 1.0, clearcoatRoughness: 0.08, vertexColors: true });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x11161d, metalness: 0.4, roughness: 0.08, vertexColors: true });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd8dde2, metalness: 1, roughness: 0.18 });
  const black = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.85 });
  const tyreM = new THREE.MeshStandardMaterial({ color: 0x17181a, roughness: 0.95 });
  const rimM = new THREE.MeshStandardMaterial({ color: 0xd2d7dd, metalness: 1, roughness: 0.22 });

  const car = new THREE.Group();

  // ---- lower body loft + dirt darkening low on the body ----
  const body = loft(26, (u) => section(u, belt(u), bottom(u), plan(u) * 0.94, 3.9), paint);
  {
    const p = body.geometry.attributes.position, c = body.geometry.attributes.color;
    const r = rng(4);
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      let f = y < 0.36 ? 0.80 + r() * 0.08 : 0.97 + r() * 0.05; // dirt band near sills
      c.setXYZ(i, f, f, f);
    }
    c.needsUpdate = true;
  }
  car.add(body.mesh);

  // ---- glasshouse loft with tumblehome; painted roof panel + B-pillars ----
  const gh = loft(18, (u) => {
    const uu = 0.26 + u * 0.58;
    return section(uu, roof(uu), belt(uu) - 0.02, plan(uu) * 0.94 * 0.82, 4.2, 0.30);
  }, glass, 0.05);
  // remap glasshouse x: loft() spans the full length, but the glasshouse only
  // covers u 0.28..0.82 — vertices are emitted ring by ring, so remap per ring.
  {
    const p = gh.geometry.attributes.position;
    const ringPts = p.count / 19; // 18 stations + 1
    for (let i = 0; i < p.count; i++) {
      const u = Math.floor(i / ringPts) / 18;
      p.setX(i, -2.3 + (0.26 + u * 0.58) * 4.6);
    }
    p.needsUpdate = true; gh.geometry.computeVertexNormals();
  }
  car.add(gh.mesh);
  // roof panel: strip across the top between u 0.40..0.70
  {
    const verts = [], idx = [];
    const NU = 8, NV = 6;
    for (let i = 0; i <= NU; i++) {
      const u = 0.38 + (i / NU) * 0.34, x = -2.3 + u * 4.6, top = roof(u) + 0.004, hw = plan(u) * 0.94 * 0.82 * (1 - 0.30);
      for (let j = 0; j <= NV; j++) {
        const f = j / NV, z = (f * 2 - 1) * hw;
        verts.push(x, top + (1 - Math.pow(f * 2 - 1, 2)) * 0.018, z);
      }
    }
    for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
      const a = i * (NV + 1) + j, b = a + NV + 1; idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setIndex(idx); g.computeVertexNormals();
    const roofMesh = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ color, metalness: 0.25, roughness: 0.3, clearcoat: 1 }));
    roofMesh.castShadow = true; car.add(roofMesh);
  }
  // B-pillars at u=0.55, following the tumblehome
  for (const side of [-1, 1]) {
    const u = 0.55, x = -2.3 + u * 4.6;
    const pil = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.52, 0.03), black);
    pil.position.set(x, (belt(u) + roof(u)) / 2, side * plan(u) * 0.94 * 0.82 * 0.86);
    pil.rotation.x = -side * 0.30; car.add(pil);
  }
  // dark arch liners behind wheels
  for (const xu of AXLES_U) for (const side of [-1, 1]) {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.40, 20), black);
    disc.position.set(-2.3 + xu * 4.6, 0.36, side * plan(xu) * 0.90);
    if (side < 0) disc.rotation.y = Math.PI;
    car.add(disc);
  }
  // ---- wheels: lathe tyre+rim profile, spokes, hub ----
  function wheel() {
    const g = new THREE.Group();
    const pts = [ // tyre band ONLY — centre left open so rim + spokes show
      [0.205, -0.105], [0.29, -0.10], [0.338, -0.055], [0.355, 0.0],
      [0.338, 0.055], [0.29, 0.10], [0.205, 0.105]
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const tyre = new THREE.Mesh(new THREE.LatheGeometry(pts, 26), tyreM);
    tyre.geometry.rotateX(Math.PI / 2); tyre.castShadow = true; g.add(tyre);
    const spin = new THREE.Group(); g.add(spin);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.215, 20), rimM);
    rim.rotation.x = Math.PI / 2; spin.add(rim);
    for (let i = 0; i < 5; i++) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.36, 0.205), rimM);
      sp.rotation.z = (i / 5) * Math.PI * 2; spin.add(sp);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.215, 12), chrome);
    hub.rotation.x = Math.PI / 2; spin.add(hub);
    g.userData.spin = spin;
    return g;
  }
  const wheels = [];
  for (const xu of AXLES_U) for (const side of [-1, 1]) {
    const w = wheel();
    w.position.set(-2.3 + xu * 4.6, 0.355, side * 0.80);
    car.add(w); wheels.push(w);
  }
  // ---- details: lights, grille, mirrors, plates, exhaust ----
  const headM = new THREE.MeshStandardMaterial({ color: 0xf4f7e8, emissive: 0xffedb5, emissiveIntensity: 0.85, roughness: 0.25 });
  const tailM = new THREE.MeshStandardMaterial({ color: 0xa01218, emissive: 0x8f0f14, emissiveIntensity: 0.7, roughness: 0.3 });
  for (const side of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.30), headM);
    hl.position.set(2.17, 0.60, side * 0.44); hl.rotation.y = -side * 0.18; car.add(hl);
    const mir = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.15), paint);
    mir.position.set(0.62, 0.98, side * 0.90); car.add(mir);
  }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 1.05), tailM); tail.position.set(-2.28, 0.66, 0); car.add(tail);
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.60), black); grille.position.set(2.235, 0.42, 0); car.add(grille);
  const plateM = new THREE.MeshStandardMaterial({ color: 0xe8e8e2, roughness: 0.6 });
  const pf = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.11, 0.44), plateM); pf.position.set(2.26, 0.30, 0); car.add(pf);
  const pb = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.11, 0.44), plateM); pb.position.set(-2.31, 0.42, 0); car.add(pb);
  const exh = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.12, 10), chrome);
  exh.rotation.z = Math.PI / 2; exh.position.set(-2.32, 0.20, -0.45); car.add(exh);

  function update(t) {
    const ang = (t * 3.2) / 0.355;
    wheels.forEach(w => { w.userData.spin.rotation.z = -ang; });
  }
  update(0);
  return { group: car, update };
}

export function buildRoad(length = 120) {
  const tex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#33363a'; g.fillRect(0, 0, w, h);
    const r = rng(15);
    for (let i = 0; i < 3200; i++) { const v = 42 + r() * 30; g.fillStyle = `rgb(${v},${v},${v + 4})`; g.fillRect(r() * w, r() * h, 1.6, 1.6); }
  }, { repeat: [24, 1] });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(length, 7.6), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.94 }));
  road.rotation.x = -Math.PI / 2; road.position.y = 0.001; road.receiveShadow = true;
  const grp = new THREE.Group(); grp.add(road);
  const dashM = new THREE.MeshStandardMaterial({ color: 0xd8d8ce, roughness: 0.7 });
  for (let x = -length / 2 + 2; x < length / 2; x += 4) {
    const d = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.012, 0.14), dashM);
    d.position.set(x, 0.008, 0); grp.add(d);
  }
  const edgeM = new THREE.MeshStandardMaterial({ color: 0xcacabf, roughness: 0.8 });
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.BoxGeometry(length, 0.012, 0.1), edgeM);
    e.position.set(0, 0.008, s * 3.55); grp.add(e);
  }
  return grp;
}
