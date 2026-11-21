// ============================================================
// "The Truck That Climbed a Mountain on One Wheel" — CGI line
// (three.js world, HDRI daylight, PBR, ACES — the approved
// elephant-CGI recipe) + Salted Mine round-head card cast,
// painter carried verbatim from the approved preview frames.
// Physics: open differential sends all power to the free wheel;
// Ramu brakes it halfway + stones the grounded wheel for bite.
// Speaking: lip-sync + elastic skin-flex ONLY on L3 (the
// mockers' taunt, Trucker1) via SPEAK_OPEN; all other mouths
// shut; final line = narration + hook board only.
// Camera: V4 REBUILD — Zack-D action grammar (fast smooth push-ins,
// tracking, ECU inserts, cuts on word onsets) under the NO-SHAKE bar:
// smootherstep moves only, jerk-gated (see V4_CHECKLIST.md). Daylight only.
// renderFrame(f) is a pure function of f (chunk-safe).
// ============================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { WORDS } from './words.js';
import { SPEAK_OPEN, SPEAK_SEG } from './speakdata.js';
import { BND, TOTAL } from './timing.js';

const W = 1080, H = 1920, FPS = 30;
const shotIdx = (f) => { for (let i = 0; i < 16; i++) if (f < BND[i + 1]) return i; return 15; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const seg = (f, a, b) => sstep((f - a) / (b - a));
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// ---------- renderer / scene ----------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.07;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xc3d3e0, 55, 190);
const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 500);

let glbDone = false, mgrDone = false;
function tryReady() { if (glbDone && mgrDone) window.ready = true; }
THREE.DefaultLoadingManager.onLoad = () => { mgrDone = true; tryReady(); };

const pmrem = new THREE.PMREMGenerator(renderer);
new RGBELoader().load('assets/sky.hdr', (tex) => {
  tex.mapping = THREE.EquirectangularReflectionMapping;
  const env = pmrem.fromEquirectangular(tex).texture;
  scene.environment = env; scene.background = env;
  scene.environmentIntensity = 0.5; scene.backgroundIntensity = 0.95;
});
const sun = new THREE.DirectionalLight(0xfff0d6, 3.1);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 2, far: 130 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun); scene.add(sun.target);
const SUN_OFF = new THREE.Vector3(-22, 30, 26);
scene.add(new THREE.HemisphereLight(0xcfe2f2, 0x5c5a44, 0.35));

// ---------- helpers ----------
function loadTex(path, srgb, rx = 1, ry = 1) {
  const t = new THREE.TextureLoader().load(path);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4; return t;
}
function pbr(id, rx, ry, rough = 1) {
  return new THREE.MeshStandardMaterial({
    map: loadTex(`assets/${id}_diff.jpg`, true, rx, ry),
    normalMap: loadTex(`assets/${id}_nor.jpg`, false, rx, ry),
    roughnessMap: loadTex(`assets/${id}_rough.jpg`, false, rx, ry),
    roughness: rough, metalness: 0 });
}
function mulberry(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rnd = mulberry(1234);

// ---------- road path (hairpin) — from the approved preview scene ----------
const pathPts = [
  [-34, -14, 16], [-24, -11, 10], [-15, -8, 6.5], [-6, -5.5, 5],
  [2, -3.4, 5.5], [10, -1.2, 9], [16, 1.2, 15], [20, 3.6, 23], [22, 6, 32]
].map(p => new THREE.Vector3(...p));
const curve = new THREE.CatmullRomCurve3(pathPts, false, 'catmullrom', 0.35);
const SAMPLES = 240;
const pathSamples = [];
for (let i = 0; i <= SAMPLES; i++) pathSamples.push(curve.getPointAt(i / SAMPLES));
function pathInfo(x, z) {
  let best = 1e9, bh = 0;
  for (const p of pathSamples) { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < best) { best = d; bh = p.y; } }
  return { dist: Math.sqrt(best), h: bh };
}
const sstep2 = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function baseH(x, z) {
  let h = -0.30 * z - 0.16 * x;
  if (z < 3) h += (3 - z) * 0.8;
  h += Math.sin(x * 0.11 + 2.0) * Math.cos(z * 0.13) * 1.5 + Math.sin(x * 0.045 - z * 0.06) * 2.2;
  return h;
}
function terrainH(x, z) {
  const pi = pathInfo(x, z);
  const t = sstep2(2.4, 8.5, pi.dist);
  let h = pi.h * (1 - t) + baseH(x, z) * t;
  if (pi.dist > 2.4) h -= Math.min(6, Math.pow(pi.dist - 2.4, 1.6) * 0.5);
  return h;
}
function ribbonGeo(cv, width, segs, yOff = 0.06) {
  const verts = [], uvs = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, p = cv.getPointAt(t), tan = cv.getTangentAt(t);
    const px = -tan.z, pz = tan.x; const pl = Math.hypot(px, pz) || 1;
    const ox = px / pl * width / 2, oz = pz / pl * width / 2;
    verts.push(p.x - ox, p.y + yOff, p.z - oz, p.x + ox, p.y + yOff, p.z + oz);
    uvs.push(0, t * 60, 1, t * 60);
    if (i < segs) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// ---------- terrain ----------
{
  const geo = new THREE.PlaneGeometry(240, 240, 130, 130);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, terrainH(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const terr = new THREE.Mesh(geo, pbr('rock_face_03', 46, 46));
  terr.receiveShadow = true; scene.add(terr);
}
// distant peaks
{
  const rockMat = pbr('rock_face_03', 3, 2);
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xeef2f4, roughness: 0.9 });
  for (const [x, z, r, h] of [[-55, -75, 34, 46], [5, -88, 42, 55], [62, -70, 30, 40], [-95, -55, 26, 34], [100, -48, 24, 30]]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), rockMat);
    cone.position.set(x, h / 2 - 16, z); cone.rotation.y = rnd() * 3; scene.add(cone);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.36, h * 0.34, 7), snowMat);
    cap.position.set(x, h - 16 - h * 0.17 + 0.1, z); cap.rotation.y = cone.rotation.y; scene.add(cap);
  }
}
// distant valley road (atmosphere, far below)
{
  const pts = [];
  for (let i = 0; i <= 40; i++) { const t = i / 40; pts.push(new THREE.Vector3(-90 + t * 180, -25.5 - Math.sin(t * 9) * 1.2, 74 + Math.sin(t * 12.6) * 9)); }
  const c2 = new THREE.CatmullRomCurve3(pts);
  const m = new THREE.Mesh(ribbonGeo(c2, 4.2, 120), new THREE.MeshStandardMaterial({ color: 0x6f6a60, roughness: 1 }));
  scene.add(m);
}
// dirt shoulder + asphalt road + crumbled edge at the apex
{
  const shoulder = new THREE.Mesh(ribbonGeo(curve, 6.2, 200, 0.03), pbr('brown_mud_leaves_01', 3, 3));
  shoulder.receiveShadow = true; scene.add(shoulder);
  const road = new THREE.Mesh(ribbonGeo(curve, 5.0, 200, 0.07), pbr('asphalt_04', 1, 1));
  road.receiveShadow = true; scene.add(road);
  const crumble = (mesh, depth) => {
    const pos = mesh.geometry.attributes.position;
    for (let i = 1; i < pos.count; i += 2) {
      const t = Math.floor(i / 2) / 200;
      const f = Math.exp(-(((t - 0.442) / 0.016) ** 2));
      if (f < 0.02) continue;
      const p = curve.getPointAt(t);
      pos.setY(i, pos.getY(i) - depth * f);
      pos.setX(i, p.x + (pos.getX(i) - p.x) * (1 - 0.45 * f));
      pos.setZ(i, p.z + (pos.getZ(i) - p.z) * (1 - 0.45 * f));
    }
    mesh.geometry.computeVertexNormals();
  };
  crumble(road, 1.1); crumble(shoulder, 1.5);
}
// scattered rocks
const rockMat = new THREE.MeshStandardMaterial({ color: 0x8a8175, roughness: 1, flatShading: true });
function addRock(x, y, z, s, parent = scene) {
  const r = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), rockMat);
  r.position.set(x, y, z); r.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
  r.scale.y = 0.75; r.castShadow = r.receiveShadow = true; parent.add(r); return r;
}
for (let i = 0; i < 34; i++) {
  const t = rnd(), p = curve.getPointAt(t), tan = curve.getTangentAt(t);
  if (t > 0.36 && t < 0.58) continue;   // keep the hairpin insert-camera zone clear
  if (t > 0.84 && t < 0.96) continue;   // keep the crest/board zone clear
  const side = rnd() < 0.62 ? 1 : -1, off = 3.6 + rnd() * 2.6;
  const x = p.x + (-tan.z) * side * off, z = p.z + tan.x * side * off;
  const s = 0.12 + rnd() * 0.18;
  addRock(x, terrainH(x, z) - s * 0.55, z, s);
}
// ---------- detail upgrades: guard posts, pines, shrubs, milestone, prayer flags ----------
const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.95 });
const woodDarkMat = new THREE.MeshStandardMaterial({ color: 0x4a3421, roughness: 0.9 });
const paintWhiteMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.8 });
// guard posts along the drop edge (lateral -3.05 = local -X / valley side);
// two are broken off near the apex crumble — the bend earns its name
{
  const postGeo = new THREE.BoxGeometry(0.16, 1.05, 0.16);
  const capGeo = new THREE.BoxGeometry(0.19, 0.1, 0.19);
  for (let t = 0.05; t <= 0.97; t += 0.031) {
    const p = curve.getPointAt(t), tan = curve.getTangentAt(t);
    const pl = Math.hypot(tan.x, tan.z) || 1;
    const x = p.x + (-tan.z / pl) * -3.05, z = p.z + (tan.x / pl) * -3.05;
    const y = terrainH(x, z);
    const broken = (t > 0.425 && t < 0.475);
    if (t > 0.875 && t < 0.935) continue;              // gap where the hook board stands
    const post = new THREE.Mesh(postGeo, woodMat);
    post.position.set(x, y + (broken ? 0.16 : 0.5), z);
    post.rotation.y = rnd() * 0.6;
    if (broken) { post.rotation.z = 0.5 + rnd() * 0.3; post.scale.y = 0.35; }
    post.castShadow = post.receiveShadow = true; scene.add(post);
    if (!broken) {
      const cap = new THREE.Mesh(capGeo, paintWhiteMat);
      cap.position.set(x, y + 1.05, z); cap.rotation.y = post.rotation.y;
      cap.castShadow = true; scene.add(cap);
    }
  }
}
// pine trees on the slopes (never on the road: path distance > 7)
{
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4230, roughness: 1 });
  const pineMat = new THREE.MeshStandardMaterial({ color: 0x39543a, roughness: 1, flatShading: true });
  const pineMat2 = new THREE.MeshStandardMaterial({ color: 0x2f4a33, roughness: 1, flatShading: true });
  let placed = 0, guard = 0;
  while (placed < 16 && guard++ < 300) {
    const x = -70 + rnd() * 130, z = -45 + rnd() * 95;
    if (pathInfo(x, z).dist < 7.5) continue;
    const y = terrainH(x, z), s = 0.8 + rnd() * 0.9;
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * s, 0.13 * s, 1.1 * s, 6), trunkMat);
    trunk.position.y = 0.55 * s; trunk.castShadow = true; tree.add(trunk);
    for (let k = 0; k < 3; k++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry((1.15 - k * 0.3) * s, 1.5 * s, 7), k % 2 ? pineMat2 : pineMat);
      cone.position.y = (1.2 + k * 0.75) * s; cone.castShadow = true; tree.add(cone);
    }
    tree.position.set(x, y - 0.05, z); tree.rotation.y = rnd() * 3;
    scene.add(tree); placed++;
  }
  // shrubs hugging the cut
  const shrubMat = new THREE.MeshStandardMaterial({ color: 0x4a6038, roughness: 1, flatShading: true });
  for (let i = 0; i < 42; i++) {
    const t = rnd(), p = curve.getPointAt(t), tan = curve.getTangentAt(t);
    const side = rnd() < 0.5 ? 1 : -1, off = 3.4 + rnd() * 3.2;
    const x = p.x + (-tan.z) * side * off, z = p.z + tan.x * side * off;
    const s = 0.22 + rnd() * 0.3;
    const sh = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), shrubMat);
    sh.position.set(x, terrainH(x, z) + s * 0.3, z); sh.scale.y = 0.62;
    sh.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); sh.castShadow = true; scene.add(sh);
  }
}
// milestone at the apex, inner side: "DEAD HAIRPIN"
{
  const c = document.createElement('canvas'); c.width = 256; c.height = 320;
  const g = c.getContext('2d');
  g.fillStyle = '#9a917e'; g.fillRect(0, 0, 256, 320);
  g.strokeStyle = 'rgba(60,50,40,0.5)'; g.lineWidth = 6; g.strokeRect(10, 10, 236, 300);
  g.fillStyle = '#33302a'; g.textAlign = 'center'; g.font = '900 44px Arial';
  g.fillText('DEAD', 128, 110); g.fillText('HAIRPIN', 128, 165);
  g.font = '900 64px Arial'; g.fillText('↑', 128, 255);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8f8776, roughness: 1 });
  const faceMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 });
  const ms = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.15, 0.3),
    [stoneMat, stoneMat, stoneMat, stoneMat, faceMat, stoneMat]);
  const p = curve.getPointAt(0.40), tan = curve.getTangentAt(0.40);
  const pl = Math.hypot(tan.x, tan.z) || 1;
  const x = p.x + (-tan.z / pl) * 3.1, z = p.z + (tan.x / pl) * 3.1;
  ms.position.set(x, terrainH(x, z) + 0.5, z);
  ms.rotation.y = Math.atan2(tan.x, tan.z) + Math.PI; // face back down the road
  ms.rotation.z = 0.04; ms.castShadow = ms.receiveShadow = true; scene.add(ms);
}
// prayer flags: two poles + a sagging line of coloured quads (flutter in renderFrame)
const flagLines = [];
function prayerFlags(t0, lateral, sag = 0.55) {
  const grp = new THREE.Group(); scene.add(grp);
  const p = curve.getPointAt(t0), tan = curve.getTangentAt(t0);
  const pl = Math.hypot(tan.x, tan.z) || 1;
  const px = -tan.z / pl, pz = tan.x / pl;
  const ax = p.x + px * lateral, az = p.z + pz * lateral;
  const bx = ax + tan.x / pl * 7.5, bz = az + tan.z / pl * 7.5;
  const ay = terrainH(ax, az), by = terrainH(bx, bz);
  const poleGeo = new THREE.CylinderGeometry(0.045, 0.06, 3.4, 6);
  for (const [x, y, z] of [[ax, ay, az], [bx, by, bz]]) {
    const pole = new THREE.Mesh(poleGeo, woodMat);
    pole.position.set(x, y + 1.7, z); pole.castShadow = true; grp.add(pole);
  }
  const cols = [0x3a6bc4, 0xe8e4da, 0xc43a30, 0x3f8a4e, 0xe8c33a];
  const flags = [];
  const N = 11;
  for (let i = 0; i < N; i++) {
    const u = (i + 0.5) / N;
    const x = lerp(ax, bx, u), z = lerp(az, bz, u);
    const y = lerp(ay + 3.35, by + 3.35, u) - Math.sin(u * Math.PI) * sag;
    const fg = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.34),
      new THREE.MeshStandardMaterial({ color: cols[i % 5], roughness: 0.9, side: THREE.DoubleSide }));
    fg.position.set(x, y - 0.2, z);
    fg.rotation.y = Math.atan2(tan.x, tan.z) + Math.PI / 2;
    fg.castShadow = true; grp.add(fg); flags.push(fg);
  }
  flagLines.push(flags);
  return grp;
}
prayerFlags(0.36, 4.8);
prayerFlags(0.845, 5.2);


// ---------- truck rig ----------
let truckProto = null;
const rig = {};   // filled by buildWorld() once the GLB lands
new GLTFLoader().load('assets/truck_quaternius.glb', (gltf) => {
  truckProto = gltf.scene;
  truckProto.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  buildWorld();
  glbDone = true; tryReady();
});
function makeTruck(tint) {
  const g = new THREE.Group();
  const model = truckProto.clone(true);
  if (tint) model.traverse(o => { if (o.isMesh && o.material && o.material.map) { o.material = o.material.clone(); o.material.color = new THREE.Color(tint); } });
  g.add(model);
  return g;
}
function placeOnRoad(obj, t, lateral = 0) {
  const p = curve.getPointAt(t), tan = curve.getTangentAt(t);
  const yaw = Math.atan2(tan.x, tan.z);
  obj.position.set(p.x + (-tan.z) * lateral, p.y + 0.07, p.z + tan.x * lateral);
  obj.rotation.set(0, yaw, 0);
  return { yaw, pos: obj.position.clone() };
}
// hero truck with roll pivot at the grounded-side wheels (preview rig, verbatim geometry)
function heroTruck() {
  const outer = new THREE.Group(); scene.add(outer);
  const pitchG = new THREE.Group(); outer.add(pitchG);
  const pivot = new THREE.Group(); pivot.position.set(0.94, 0, 0); pitchG.add(pivot);
  const truck = makeTruck(); truck.position.set(-0.94, 0, 0); pivot.add(truck);
  return { outer, pitchG, pivot, truck };
}
function poseHero(h, t, lateral, rollDeg) {
  const p = curve.getPointAt(t), tan = curve.getTangentAt(t);
  const yaw = Math.atan2(tan.x, tan.z);
  const pitch = -Math.asin(clamp(tan.y, -1, 1));
  h.outer.position.set(p.x + (-tan.z) * lateral, p.y + 0.07, p.z + tan.x * lateral);
  h.outer.rotation.set(0, yaw, 0);
  h.pitchG.rotation.x = pitch;
  h.pivot.rotation.z = THREE.MathUtils.degToRad(rollDeg);
  return { yaw, pitch };
}
// wrap a wheel mesh in a pivot sitting on its axle line so it can spin in place
function wrapWheel(truckGroup, mesh, centerLocal) {
  const pivot = new THREE.Group();
  pivot.position.copy(centerLocal);
  truckGroup.add(pivot);
  pivot.attach(mesh);
  return pivot;
}

// ---------- dust puffs + spinning-wheel blur disc (from the preview scene) ----------
function puffTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  gr.addColorStop(0, 'rgba(216,204,182,0.85)'); gr.addColorStop(0.6, 'rgba(205,192,168,0.38)'); gr.addColorStop(1, 'rgba(200,188,165,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
const puffTex = puffTexture();
const puffs = [];
for (let i = 0; i < 14; i++) {
  const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, opacity: 0, depthWrite: false }));
  m.visible = false; scene.add(m); puffs.push(m);
}
function setPuff(i, x, y, z, s, op) {
  const m = puffs[i]; if (!m) return;
  m.position.set(x, y, z); m.scale.set(s, s, 1);
  m.material.opacity = op; m.visible = op > 0.02;
}
function blurDisc() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.translate(128, 128);
  for (let i = 0; i < 46; i++) {
    g.rotate((Math.PI * 2) / 46);
    g.fillStyle = `rgba(38,34,30,${0.24 + rnd() * 0.2})`;
    g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 124, -0.05, 0.05); g.fill();
  }
  const gr = g.createRadialGradient(0, 0, 90, 0, 0, 126);
  gr.addColorStop(0, 'rgba(30,28,26,0)'); gr.addColorStop(1, 'rgba(30,28,26,0.35)');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 126, 0, 7); g.fill();
  const t = new THREE.CanvasTexture(c);
  return new THREE.Mesh(new THREE.CircleGeometry(0.53, 28),
    new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.95, depthWrite: false }));
}

// ---------- world build (runs once the truck GLB is in) ----------
function buildWorld() {
  // waiting trucks on the lower leg (visible in shots 2, 3, 15)
  rig.waiting = [];
  for (const [t, tint, lat] of [[0.30, 0xdad2c4, 0.35], [0.185, 0xc4d2da, -0.35]]) {
    const tr = makeTruck(tint); scene.add(tr); placeOnRoad(tr, t, lat); rig.waiting.push(tr);
  }
  // hero
  const h = heroTruck(); rig.hero = h;
  poseHero(h, 0.47, -2.2, 11);
  scene.updateMatrixWorld(true);
  // wheel spin pivots (centres measured from the loaded model, truck-local)
  const findMesh = (name) => { let m = null; h.truck.traverse(o => { if (o.isMesh && o.name === name) m = o; }); return m; };
  const centreOf = (mesh) => {
    const c = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
    return h.truck.worldToLocal(c.clone());
  };
  rig.wheelFL = wrapWheel(h.truck, findMesh('FrontWheel_L'), null || centreOf(findMesh('FrontWheel_L')));
  rig.wheelFR = wrapWheel(h.truck, findMesh('FrontWheel_R'), centreOf(findMesh('FrontWheel_R')));
  rig.wheelRear = wrapWheel(h.truck, findMesh('BackWheels'), centreOf(findMesh('BackWheels')));
  scene.updateMatrixWorld(true);
  // anchors in truck-local space (hairpin pose)
  rig.anchors = {
    cab: new THREE.Vector3(-1.22, 1.5, 1.15),          // outside the valley-side cab window
    gwheel: new THREE.Vector3(0.94, 0.5, -2.15),       // grounded rear wheel centre
    fwheel: new THREE.Vector3(-0.97, 0.62, -2.15),     // lifted rear wheel centre (hangs higher when rolled)
    diff: new THREE.Vector3(0, 0.5, -2.15),            // differential housing
    lever: new THREE.Vector3(-1.18, 1.02, 1.32),       // handbrake lever base, cab side
  };
  // differential assembly under the truck (axle + housing + propshaft), dark oiled metal
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x2e2c2a, roughness: 0.55, metalness: 0.65 });
  const diffGrp = new THREE.Group(); h.truck.add(diffGrp);
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.95, 10), metalMat);
  axle.rotation.z = Math.PI / 2; axle.position.copy(rig.anchors.diff); axle.castShadow = true; diffGrp.add(axle);
  const housing = new THREE.Mesh(new THREE.SphereGeometry(0.30, 14, 12), metalMat);
  housing.scale.set(1, 0.92, 1.15); housing.position.copy(rig.anchors.diff); housing.castShadow = true; diffGrp.add(housing);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 3.1, 8), metalMat);
  shaft.rotation.x = Math.PI / 2; shaft.position.set(0, 0.52, -0.55); shaft.castShadow = true; diffGrp.add(shaft);
  // handbrake lever at the cab side (rotates to "half" in shot 10 and stays)
  const leverGrp = new THREE.Group(); leverGrp.position.set(-1.18, 1.02, 1.32); h.truck.add(leverGrp);
  const lbase = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.42), metalMat); leverGrp.add(lbase);
  const lstick = new THREE.Group(); leverGrp.add(lstick);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.042, 0.6, 8), metalMat);
  stick.position.y = 0.3; lstick.add(stick);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xa33327, roughness: 0.5 }));
  knob.position.y = 0.62; lstick.add(knob);
  lstick.rotation.x = 0.55; // parked, pointing back-down
  rig.lever = lstick;
  rig.leverGrp = leverGrp;
  // blur disc on the lifted wheel, on a spin group sitting on the axle axis
  // (child of the roll pivot, as in the preview)
  const discSpin = new THREE.Group(); discSpin.position.set(-1.97, 0.44, -2.15); h.pivot.add(discSpin);
  const disc = blurDisc(); disc.rotation.y = -Math.PI / 2; discSpin.add(disc);
  rig.disc = disc; rig.discSpin = discSpin;
  // stone heap at the grounded wheel (grows during shot 13) — WORLD-anchored:
  // the truck climbs away and leaves the heap behind. Bed stones ride along.
  rig.heap = [];
  {
    const gwW = h.truck.localToWorld(rig.anchors.gwheel.clone());
    const yawH = Math.atan2(curve.getTangentAt(0.47).x, curve.getTangentAt(0.47).z);
    const side = new THREE.Vector3(Math.cos(yawH), 0, -Math.sin(yawH));
    const back = new THREE.Vector3(-Math.sin(yawH), 0, -Math.cos(yawH));
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 0.9 - 0.4;
      const px = gwW.x + side.x * (0.55 + Math.cos(a) * 0.3) + back.x * (Math.sin(a) * 0.55);
      const pz = gwW.z + side.z * (0.55 + Math.cos(a) * 0.3) + back.z * (Math.sin(a) * 0.55);
      const r = addRock(px, gwW.y - 0.5 + 0.12 + (i % 3) * 0.16, pz, 0.2 + ((i * 37) % 10) / 10 * 0.14);
      r.visible = false; rig.heap.push(r);
    }
    rig.bedStones = [];
    for (let i = 0; i < 4; i++) {
      const r = addRock(0, 0, 0, 0.24 + (i % 3) * 0.07, h.truck);
      r.position.set(-0.45 + (i % 2) * 0.8, 1.62, -1.7 - Math.floor(i / 2) * 0.55);
      r.visible = false; rig.bedStones.push(r);
    }
  }
  // loose stones that roll off the edge in shot 9 (world-space, animated per frame)
  rig.loose = [];
  for (let i = 0; i < 4; i++) {
    const r = addRock(0, -50, 0, 0.09 + i * 0.02);
    r.visible = false; rig.loose.push(r);
  }
  buildActors();
  buildBoard();
  computeCameras();
}

// ---------- Salted Mine-style card characters (painter verbatim from the approved previews) ----------
const blobTexC = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(20,14,30,0.55)'); gr.addColorStop(1, 'rgba(20,14,30,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
function makeCard(drawFn, h = 2.0) {
  const c = document.createElement('canvas'); c.width = 600; c.height = 1000;
  const g = c.getContext('2d'); drawFn(g, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const geo = new THREE.PlaneGeometry(h * 0.6, h); geo.translate(0, h / 2, 0);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.02, side: THREE.DoubleSide }));
  mesh.castShadow = true;
  mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: t, alphaTest: 0.5 });
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTexC, transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.renderOrder = 1;
  scene.add(mesh); scene.add(blob);
  return { mesh, blob, canvas: c, ctx: g, tex: t, drawFn, lastOpen: -1,
    redraw(open) { if (Math.abs(open - this.lastOpen) < 0.02 && this.lastOpen >= 0) return; this.lastOpen = open; const gg = this.ctx; gg.clearRect(0, 0, 600, 1000); this.drawFn(gg, open); this.tex.needsUpdate = true; },
    set(x, y, z, ry = 0, s = 1, blobY = null) { mesh.position.set(x, y, z); mesh.rotation.y = ry; mesh.scale.setScalar(s);
      blob.position.set(x, (blobY ?? y) + 0.03, z); blob.scale.set(0.95 * s, 0.6 * s, 1); } };
}
const INK = '#2b211b';
function head(g, cx, cy, r, o) { // ball-shaded round head, Salted Mine language
  const skin = o.skin || '#ffe2c2';
  const gr = g.createRadialGradient(cx - r * 0.38, cy - r * 0.42, r * 0.15, cx, cy, r * 1.05);
  gr.addColorStop(0, '#fff6e8'); gr.addColorStop(0.45, skin); gr.addColorStop(1, '#e8b98d');
  g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
  g.lineWidth = 7; g.strokeStyle = INK; g.stroke();
  // cheeks — while speaking the skin flexes: cheeks lift and warm slightly (elastic skin, shape unchanged)
  const flex = o.open || 0;
  g.fillStyle = `rgba(214,120,80,${0.35 + flex * 0.25})`;
  g.beginPath(); g.arc(cx - r * 0.52, cy + r * 0.28 - flex * r * 0.05, r * (0.17 + flex * 0.03), 0, 7); g.fill();
  g.beginPath(); g.arc(cx + r * 0.52, cy + r * 0.28 - flex * r * 0.05, r * (0.17 + flex * 0.03), 0, 7); g.fill();
  if (flex > 0.02) { // soft jaw shadow deepening with the mouth — skin reacting, not shape
    g.fillStyle = `rgba(160,95,60,${flex * 0.20})`;
    g.beginPath(); g.ellipse(cx, cy + r * 0.78, r * 0.42, r * 0.16, 0, 0, 7); g.fill();
  }
  const ey = cy + r * 0.02, ex = r * 0.36;
  for (const s of [-1, 1]) { // eyes
    if (o.expr === 'laugh') { g.lineWidth = 6; g.strokeStyle = INK; g.beginPath(); g.arc(cx + s * ex, ey, r * 0.13, Math.PI * 1.08, Math.PI * 1.92); g.stroke(); }
    else { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(cx + s * ex, ey, r * 0.14, r * 0.17, 0, 0, 7); g.fill(); g.lineWidth = 4; g.strokeStyle = INK; g.stroke();
      g.fillStyle = INK; g.beginPath(); g.arc(cx + s * ex + (o.lookX || 0) * r * 0.05, ey + (o.lookY || 0) * r * 0.05, r * 0.065, 0, 7); g.fill(); }
    g.lineWidth = 6; g.strokeStyle = INK; g.beginPath(); // brows
    const b = o.expr === 'worried' ? -0.16 : o.expr === 'angry' ? 0.14 : -0.05;
    g.moveTo(cx + s * ex - r * 0.15, cy - r * 0.34 + (s > 0 ? b : -b * 0.4) * r * -1);
    g.lineTo(cx + s * ex + r * 0.15, cy - r * 0.34 + (s > 0 ? -b * 0.4 : b) * r * -1); g.stroke();
  }
  g.lineWidth = 6.5; g.strokeStyle = INK; g.beginPath(); // mouth
  if (o.speak) { // dialogue card: mouth follows the voice — shut in the pauses
    if (flex > 0.02) { g.fillStyle = '#7c3524'; g.beginPath(); g.ellipse(cx, cy + r * 0.52, r * (0.09 + flex * 0.06), r * (0.03 + flex * 0.16), 0, 0, 7); g.fill(); g.stroke(); }
    else { g.moveTo(cx - r * 0.13, cy + r * 0.53); g.lineTo(cx + r * 0.13, cy + r * 0.53); g.stroke(); }
  }
  else if (flex > 0.02) { // speaking: mouth opens with the voice envelope (small — jaw ≈ open × 0.22)
    g.fillStyle = '#7c3524';
    g.beginPath(); g.ellipse(cx, cy + r * 0.5, r * (0.10 + flex * 0.05), r * (0.03 + flex * 0.15), 0, 0, 7); g.fill(); g.stroke();
  }
  else if (o.expr === 'shout') { g.fillStyle = '#7c3524'; g.beginPath(); g.ellipse(cx, cy + r * 0.52, r * 0.17, r * 0.21, 0, 0, 7); g.fill(); g.stroke(); }
  else if (o.expr === 'grin' || o.expr === 'laugh') { g.arc(cx, cy + r * 0.34, r * 0.3, Math.PI * 0.15, Math.PI * 0.85); g.stroke(); }
  else if (o.expr === 'worried') { g.arc(cx, cy + r * 0.62, r * 0.16, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
  else if (o.expr === 'smile') { g.arc(cx, cy + r * 0.36, r * 0.24, Math.PI * 0.2, Math.PI * 0.8); g.stroke(); }
  else { g.moveTo(cx - r * 0.16, cy + r * 0.5); g.lineTo(cx + r * 0.16, cy + r * 0.5); g.stroke(); }
  if (o.moustache) { g.fillStyle = o.moustache; g.beginPath(); g.ellipse(cx, cy + r * 0.4, r * 0.3, r * 0.1, 0, 0, 7); g.fill(); }
  if (o.hat === 'cap') { g.fillStyle = o.capCol || '#54682c'; g.beginPath(); g.arc(cx, cy - r * 0.32, r * 0.99, Math.PI, Math.PI * 2); g.fill(); g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
    g.fillStyle = o.capCol || '#54682c'; g.fillRect(cx - r * 0.4, cy - r * 0.38, r * 1.5, r * 0.14); g.strokeRect(cx - r * 0.4, cy - r * 0.38, r * 1.5, r * 0.14); }
  else if (o.hat === 'hair') { g.fillStyle = o.hairCol || '#241a12'; g.beginPath(); g.arc(cx, cy - r * 0.3, r * 0.98, Math.PI * 1.02, Math.PI * 1.98); g.fill(); }
}
function torso(g, cx, topY, w, col, o = {}) {
  const gr = g.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
  gr.addColorStop(0, col); gr.addColorStop(0.75, col); gr.addColorStop(1, 'rgba(0,0,0,0.28)');
  g.fillStyle = gr;
  g.beginPath(); g.moveTo(cx - w * 0.32, topY); g.lineTo(cx + w * 0.32, topY);
  g.lineTo(cx + w * 0.5, topY + 330); g.lineTo(cx - w * 0.5, topY + 330); g.closePath(); g.fill();
  g.lineWidth = 7; g.strokeStyle = INK; g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.75)';
  for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(cx, topY + 70 + i * 80, 9, 0, 7); g.fill(); }
}
function arm(g, x1, y1, x2, y2, x3, y3, col, skin) {
  g.lineCap = 'round'; g.lineWidth = 34; g.strokeStyle = col;
  g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo(x2, y2, x3, y3); g.stroke();
  g.fillStyle = skin || '#ffe2c2'; g.beginPath(); g.arc(x3, y3, 20, 0, 7); g.fill();
  g.lineWidth = 5; g.strokeStyle = INK; g.stroke();
}
function legs(g, cx, topY, pants, spread = 52) {
  g.lineWidth = 40; g.strokeStyle = pants; g.lineCap = 'round';
  g.beginPath(); g.moveTo(cx - 26, topY); g.lineTo(cx - spread, 950); g.stroke();
  g.beginPath(); g.moveTo(cx + 26, topY); g.lineTo(cx + spread, 950); g.stroke();
  g.fillStyle = '#33241a';
  g.fillRect(cx - spread - 34, 938, 72, 26); g.fillRect(cx + spread - 38, 938, 72, 26);
}
// character painters (600x1000 canvas units) — verbatim from the previews
const paintStand = (o) => (g) => { legs(g, 300, 640, o.pants); torso(g, 300, 330, 250, o.jacket); arm(g, 205, 380, 140, 520, 128, 660, o.jacket, o.skin); arm(g, 395, 380, 462, 520, 474, 660, o.jacket, o.skin); head(g, 300, 205, 118, o); };
const paintLookUp = (o) => (g) => { legs(g, 300, 640, o.pants); torso(g, 300, 330, 250, o.jacket); arm(g, 205, 380, 138, 500, 126, 640, o.jacket, o.skin); arm(g, 395, 380, 470, 470, 520, 560, o.jacket, o.skin); head(g, 300, 195, 118, { ...o, lookY: -1 }); };
const paintShout = (o) => (g, open = 0) => { legs(g, 300, 640, o.pants); torso(g, 300, 330, 250, o.jacket); arm(g, 205, 380, 120, 300, 96, 180, o.jacket, o.skin); arm(g, 395, 380, 480, 300, 506, 180, o.jacket, o.skin); head(g, 300, 205, 118, { ...o, speak: true, open }); };
const paintLaugh = (o) => (g) => { legs(g, 300, 640, o.pants); torso(g, 300, 330, 250, o.jacket); arm(g, 205, 380, 150, 480, 210, 560, o.jacket, o.skin); arm(g, 395, 380, 460, 500, 420, 620, o.jacket, o.skin); head(g, 300, 205, 118, { ...o, expr: 'laugh' }); };
const paintLean = (o) => (g) => { torso(g, 300, 430, 270, o.jacket); arm(g, 190, 480, 120, 640, 110, 830, o.jacket, o.skin); arm(g, 410, 480, 500, 620, 520, 800, o.jacket, o.skin); head(g, 300, 265, 128, o); };
const paintWave = (o) => (g) => { torso(g, 300, 430, 270, o.jacket); arm(g, 190, 480, 130, 620, 120, 800, o.jacket, o.skin); arm(g, 410, 470, 520, 330, 545, 130, o.jacket, o.skin); head(g, 300, 265, 128, { ...o, expr: 'grin' }); };
const paintCrouch = (o) => (g) => {
  g.lineWidth = 42; g.strokeStyle = o.pants; g.lineCap = 'round';
  g.beginPath(); g.moveTo(255, 700); g.lineTo(180, 880); g.lineTo(215, 955); g.stroke();
  g.beginPath(); g.moveTo(345, 700); g.lineTo(430, 860); g.lineTo(415, 955); g.stroke();
  g.fillStyle = '#33241a'; g.fillRect(168, 940, 76, 26); g.fillRect(378, 940, 76, 26);
  torso(g, 300, 470, 260, o.jacket);
  arm(g, 200, 520, 190, 700, 235, 845, o.jacket, o.skin); arm(g, 400, 520, 415, 700, 380, 845, o.jacket, o.skin);
  head(g, 315, 330, 118, { ...o, expr: o.expr || 'worried', lookY: 1 });
};
const RAMU = { jacket: '#2f7d8c', pants: '#5a4632', skin: '#ffe2c2', hat: 'cap', capCol: '#b3543a' };
const TRUCKER1 = { jacket: '#b3543a', pants: '#33302c', skin: '#f5c9a0', hat: 'hair', hairCol: '#1e1714', moustache: '#2a201a' };
const TRUCKER2 = { jacket: '#3f7d4e', pants: '#2c3038', skin: '#ffe2c2', hat: 'hair', hairCol: '#2b211c' };

// ---------- actors ----------
let A = null;
function buildActors() {
  // truckers stand ON the road beside their trucks, turned 3/4 toward the
  // down-road camera (they shout up at Ramu, faces readable from below)
  const spot = (t, lat) => {
    const p = curve.getPointAt(t), tan = curve.getTangentAt(t);
    const pl = Math.hypot(tan.x, tan.z) || 1;
    return { pos: new THREE.Vector3(p.x + (-tan.z / pl) * lat, p.y + 0.07, p.z + (tan.x / pl) * lat),
             yaw: Math.atan2(tan.x, tan.z) };
  };
  const s1 = spot(0.252, -1.35), s2 = spot(0.256, 0.5);
  const ry1 = s1.yaw + Math.PI - 0.6, ry2 = s2.yaw + Math.PI - 0.9;
  A = {
    ramuLean: makeCard(paintLean({ ...RAMU, expr: 'worried', lookX: -1, lookY: 1 }), 1.85),
    ramuCalm: makeCard(paintLean({ ...RAMU, expr: 'smile', lookX: -1, lookY: 0 }), 1.85),
    ramuCrouch: makeCard(paintCrouch(RAMU), 1.95),
    ramuWave: makeCard(paintWave(RAMU), 1.85),
    t1Shout: makeCard(paintShout(TRUCKER1)),
    t1Stand: makeCard(paintStand(TRUCKER1)),
    t2Look: makeCard(paintLookUp(TRUCKER2)),
    t2Laugh: makeCard(paintLaugh(TRUCKER2)),
    t2Stand: makeCard(paintStand({ ...TRUCKER2, expr: 'worried' })),
    t1Pos: s1.pos, t2Pos: s2.pos,
    t1Face: new THREE.Vector3(Math.sin(ry1), 0, Math.cos(ry1)),
  };
  A.t1Shout.set(s1.pos.x, s1.pos.y, s1.pos.z, ry1, 0.95);
  A.t1Stand.set(s1.pos.x, s1.pos.y, s1.pos.z, ry1, 0.95);
  A.t2Look.set(s2.pos.x, s2.pos.y, s2.pos.z, ry2, 0.95);
  A.t2Laugh.set(s2.pos.x, s2.pos.y, s2.pos.z, ry2, 0.95);
  A.t2Stand.set(s2.pos.x, s2.pos.y, s2.pos.z, ry2, 0.95);
  for (const k of ['ramuLean', 'ramuCalm', 'ramuCrouch', 'ramuWave']) A[k].blob.visible = false;
}
// world position of a truck-local anchor in the hero's CURRENT pose
function anchorWorld(local) {
  return rig.hero.truck.localToWorld(local.clone());
}
function placeCabCard(card, rotY) {
  const cw = anchorWorld(rig.anchors.cab);
  card.set(cw.x, cw.y - 0.66, cw.z, rotY, 1);
}

// ---------- hook board (grows out of the final scene at the crest) ----------
let hookBoard = null;
function buildBoard() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 342;
  const g = c.getContext('2d');
  g.fillStyle = '#14202f'; g.fillRect(0, 0, 1024, 342);
  g.strokeStyle = '#ffd9a0'; g.lineWidth = 7; g.strokeRect(14, 14, 996, 314);
  g.fillStyle = '#ffd9a0'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '900 66px Arial'; g.fillText('BUT TOMORROW…', 512, 72);
  g.font = '900 57px Arial'; g.fillText('THE BOATMAN WHO CROSSED', 512, 168);
  g.fillText('THE RIVER WITHOUT A BOAT?', 512, 262);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  hookBoard = new THREE.Group();
  const bd = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.88, 0.09),
    [woodDarkMat, woodDarkMat, woodDarkMat, woodDarkMat,
     new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }), woodDarkMat]);
  bd.position.y = 1.15; bd.castShadow = true; hookBoard.add(bd);
  rig.boardMesh = bd;
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.1), woodDarkMat);
    leg.position.set(s * 1.05, 0.4, 0); hookBoard.add(leg);
  }
  const p = curve.getPointAt(0.945), tan = curve.getTangentAt(0.945);
  const pl = Math.hypot(tan.x, tan.z) || 1;
  const x = p.x + (-tan.z / pl) * -0.9, z = p.z + (tan.x / pl) * -0.9; // on the road past the crest, truck behind it from the end camera
  hookBoard.position.set(x, terrainH(x, z), z);
  hookBoard.visible = false;
  scene.add(hookBoard);
  rig.boardPos = hookBoard.position.clone();
}

// ---------- cameras — V4 REBUILD (2026-11-21) ----------
// Grammar: Zack-D action camera reconciled with Abid's NO-SHAKE bar.
// 27 sub-shots; every cut lands on a word onset where the voice names a
// new subject (checklist: ~/workspace/shorts/truck-mountain/V4_CHECKLIST.md).
// Each sub-shot is a smootherstep keyframe pair (zero velocity at both
// ends) or a dynamic pose (follow / slip / live truck-local inserts).
// Anchors are measured in the hairpin pose; the crest pose is measured
// once (and restored) for the final shot's composition.
let SUBS = [];
let CAMLOOK = [0, 0, 0];
const smoother = (u) => { u = clamp(u, 0, 1); return u * u * u * (u * (u * 6 - 15) + 10); };
function v3(v) { return [v.x, v.y, v.z]; }
function computeCameras() {
  const h = rig.hero;
  const H0 = h.outer.position.clone();
  const yawH = h.outer.rotation.y;
  const CABW = anchorWorld(rig.anchors.cab);
  const GW = anchorWorld(rig.anchors.gwheel);
  const FW = anchorWorld(rig.anchors.fwheel);
  const LEVERW = anchorWorld(rig.anchors.lever);
  const T1 = A.t1Pos;
  const T1H = T1.clone().add(new THREE.Vector3(0, 1.6, 0));
  const T2H = A.t2Pos.clone().add(new THREE.Vector3(0, 1.6, 0));
  const t1Face = A.t1Face;
  const t1Side = new THREE.Vector3(t1Face.z, 0, -t1Face.x);
  // lean-card facing normal (Ramu's cab cards) — close cameras sit on it
  const leanN = new THREE.Vector3(Math.sin(yawH - Math.PI / 2 - 0.5), 0, Math.cos(yawH - Math.PI / 2 - 0.5));
  const side = new THREE.Vector3(Math.cos(yawH), 0, -Math.sin(yawH));
  const back = new THREE.Vector3(-Math.sin(yawH), 0, -Math.cos(yawH));
  // Ramu's crouch spot for shot 13 (preview staging): beside the grounded wheel
  const RP = GW.clone().add(side.clone().multiplyScalar(1.05)).add(back.clone().multiplyScalar(0.55));
  RP.y = GW.y - 0.48;
  A.ramuCrouch.set(RP.x, RP.y, RP.z, yawH + 2.2, 1);
  rig.crouchPos = RP;
  const crest = curve.getPointAt(0.88), tanC = curve.getTangentAt(0.88);
  const yawC = Math.atan2(tanC.x, tanC.z);
  const C0 = crest.clone().add(new THREE.Vector3(0, 0.07, 0));
  const fwdC = new THREE.Vector3(Math.sin(yawC), 0, Math.cos(yawC));
  const valC = new THREE.Vector3(-Math.cos(yawC), 0, Math.sin(yawC));
  const BP = rig.boardPos;
  // board camera direction: past the road's end, looking back at the board
  const cB = curve.getPointAt(1.0), tanB = curve.getTangentAt(1.0);
  const plB = Math.hypot(tanB.x, tanB.z) || 1;
  const perpB = new THREE.Vector3(-tanB.z / plB, 0, tanB.x / plB);
  const CAMB = cB.clone().add(tanB.clone().multiplyScalar(3.5)).add(perpB.clone().multiplyScalar(-1.0)).add(new THREE.Vector3(0, 1.8, 0));
  const bDir = CAMB.clone().sub(BP).setY(0).normalize();
  const bSide = new THREE.Vector3(bDir.z, 0, -bDir.x);
  const off = (v, dx, dy, dz) => [v.x + dx, v.y + dy, v.z + dz];
  // truck-local point -> world (hairpin pose): the wheel/diff inserts are
  // framed in the truck's own space, world offsets mis-aim them
  const LW = (x, y, z) => v3(h.truck.localToWorld(new THREE.Vector3(x, y, z)));
  const FWl = [-0.97, 0.62, -2.15], GWl = [0.94, 0.45, -2.15], DIFl = [0, 0.45, -2.15];
  const pairMid = v3(T1.clone().lerp(A.t2Pos, 0.5).add(new THREE.Vector3(0, 1.3, 0)));
  const pairMid2 = v3(T1.clone().lerp(A.t2Pos, 0.5).add(new THREE.Vector3(0, 1.35, 0)));
  const t1Look = v3(T1H.clone().lerp(T2H, 0.42));
  // stone-shot camera helper (grounded-wheel world anchor g, hairpin pose)
  const gW = h.truck.localToWorld(new THREE.Vector3(0.94, 0, -2.15));
  const stoneCam = (sm, bm, dy) => {
    const cx = gW.x + side.x * sm + back.x * bm, cz = gW.z + side.z * sm + back.z * bm;
    return [cx, Math.max(gW.y + dy, terrainH(cx, cz) + dy - 0.7), cz];
  };
  const stoneLook = v3(new THREE.Vector3(gW.x + side.x * 0.15 + back.x * 0.15, gW.y + 0.45, gW.z + side.z * 0.15 + back.z * 0.15));
  // crest pose, measured once for the final shot (Ramu fully in frame
  // alongside the board), then the hairpin pose is restored
  poseHero(h, 0.88, 0, 0); scene.updateMatrixWorld(true);
  const CABW_CR = anchorWorld(rig.anchors.cab);
  poseHero(h, 0.47, -2.2, 11); scene.updateMatrixWorld(true);
  const boardLook = v3(new THREE.Vector3(BP.x, BP.y + 1.15, BP.z).lerp(CABW_CR, 0.40));
  const S16p0 = v3(BP.clone().add(bDir.clone().multiplyScalar(13.6)).add(bSide.clone().multiplyScalar(-3.35)).add(new THREE.Vector3(0, 1.7, 0)));
  const S16p1 = v3(BP.clone().add(bDir.clone().multiplyScalar(13.3)).add(bSide.clone().multiplyScalar(-3.25)).add(new THREE.Vector3(0, 1.62, 0)));
  hookBoard.rotation.y = Math.atan2(S16p0[0] - BP.x, S16p0[2] - BP.z);
  const cabCam = (d0, d1, y0, y1, look) => ({
    p0: v3(CABW.clone().add(leanN.clone().multiplyScalar(d0)).add(new THREE.Vector3(0, y0, 0))),
    p1: v3(CABW.clone().add(leanN.clone().multiplyScalar(d1)).add(new THREE.Vector3(0, y1, 0))),
    l0: look, l1: look });
  const faceCam = (T, d0, d1, sd0, sd1, y0, y1, look) => ({
    p0: v3(T.clone().add(t1Face.clone().multiplyScalar(d0)).add(t1Side.clone().multiplyScalar(sd0)).add(new THREE.Vector3(0, y0, 0))),
    p1: v3(T.clone().add(t1Face.clone().multiplyScalar(d1)).add(t1Side.clone().multiplyScalar(sd1)).add(new THREE.Vector3(0, y1, 0))),
    l0: look, l1: look });
  SUBS = [
    // L1 hook: wide push, then the spinning wheel over the drop ("one"@68)
    { f0: 0, f1: 68, p0: off(H0, 4.5, 4.4, 15.5), p1: off(H0, 3.1, 3.2, 11.0), l0: off(H0, -0.4, 0.4, -0.4), l1: off(H0, -0.4, 0.4, -0.4) },
    { f0: 68, f1: 166, p0: LW(-3.2, 1.3, -3.6), p1: LW(-3.45, 1.1, -2.3), l0: LW(...FWl), l1: LW(...FWl) },
    // L2 truckers: push-in, look LOCKED on the pair (no drift to the hero —
    // the old look-lerp pushed Trucker2 out of the frame's right edge)
    { f0: 166, f1: 252, ...faceCam(T1H, 9.2, 7.4, 1.2, 1.05, 1.5, 1.6, pairMid) },
    // L3 dialogue: two-shot, then the speaker close ("No"@299)
    { f0: 252, f1: 299, ...faceCam(T1H, 6.0, 5.5, 0.7, 0.62, 0.25, 0.2, t1Look) },
    { f0: 299, f1: 372, ...faceCam(T1H, 3.1, 2.7, 0.35, 0.3, 0.15, 0.12, v3(T1H.clone().add(new THREE.Vector3(0, 0.05, 0)))) },
    // L4 Ramu close: punch-in
    { f0: 372, f1: 440, ...cabCam(3.6, 2.95, 0.55, 0.5, off(CABW, 0, 0.3, 0)) },
    // L5 differential: lateral track along the axle, look locked on the diff
    { f0: 440, f1: 528, p0: LW(-3.1, 0.45, -4.4), p1: LW(-1.2, 0.45, -4.4), l0: LW(...DIFl), l1: LW(...DIFl) },
    // L6 power split: diff + wheels, then the free wheel ("feeds"@626)
    { f0: 528, f1: 626, p0: LW(-2.9, 0.5, -4.6), p1: LW(-2.55, 0.48, -4.15), l0: LW(-0.5, 0.5, -2.15), l1: LW(-0.5, 0.5, -2.15) },
    { f0: 626, f1: 668, p0: LW(-3.3, 1.0, -3.4), p1: LW(-3.45, 0.95, -2.6), l0: LW(...FWl), l1: LW(...FWl) },
    // L7 power pours into the air wheel: medium, then ECU ("into"@726)
    { f0: 668, f1: 726, p0: LW(-3.6, 1.3, -3.8), p1: LW(-3.5, 1.2, -3.0), l0: LW(...FWl), l1: LW(...FWl) },
    { f0: 726, f1: 766, p0: LW(-3.0, 1.05, -2.9), p1: LW(-2.88, 1.0, -2.45), l0: LW(...FWl), l1: LW(...FWl) },
    // L8 grounded wheel got nothing: micro-push (never a dead hold)
    { f0: 766, f1: 852, p0: LW(3.4, 0.85, -3.9), p1: LW(3.2, 0.8, -3.6), l0: LW(...GWl), l1: LW(...GWl) },
    // L9 floored it: cab push, wheel-scream ECU ("screamed"@913),
    // then the side-profile slip track ("slid"@945)
    { f0: 852, f1: 913, ...cabCam(4.2, 3.7, 0.5, 0.45, off(CABW, 0, 0.25, 0)) },
    { f0: 913, f1: 945, p0: LW(-3.2, 1.2, -3.4), p1: LW(-3.3, 1.1, -2.7), l0: LW(...FWl), l1: LW(...FWl) },
    { f0: 945, f1: 984, dyn: 'slip', o0: [-8.0, 2.3, 5.0], o1: [-7.4, 2.15, 4.6] },
    // L10 handbrake insert — REFRAMED: camera higher + farther, look raised
    // toward the face so Ramu's cap stays inside the top of the frame
    { f0: 984, f1: 1062, ...cabCam(3.9, 3.55, 0.66, 0.60, v3(LEVERW.clone().lerp(CABW, 0.38).add(new THREE.Vector3(0, 0.16, 0)))) },
    // L11 the brake chokes the spin: wheel ECU, then the diff ("nowhere"@1149)
    { f0: 1062, f1: 1149, p0: LW(-3.0, 0.7, -3.6), p1: LW(-2.7, 0.65, -3.3), l0: LW(...FWl), l1: LW(...FWl) },
    { f0: 1149, f1: 1191, p0: LW(-2.6, 0.55, -4.3), p1: LW(-2.2, 0.5, -3.8), l0: LW(...DIFl), l1: LW(-0.45, 0.48, -2.15) },
    // L12 power rushes into the grounded wheel: low push-in
    { f0: 1191, f1: 1296, p0: LW(3.3, 0.62, -3.9), p1: LW(3.0, 0.55, -3.5), l0: LW(...GWl), l1: LW(...GWl) },
    // L13 stones for bite: wide, crouch arc ("piled"@1344), cab calm ("and"@1417)
    { f0: 1296, f1: 1344, p0: stoneCam(3.6, 3.4, 2.0), p1: stoneCam(3.45, 3.65, 2.05), l0: stoneLook, l1: stoneLook },
    { f0: 1344, f1: 1417, p0: stoneCam(3.45, 3.65, 2.05), p1: stoneCam(3.15, 4.1, 2.15), l0: stoneLook, l1: stoneLook },
    { f0: 1417, f1: 1449, ...cabCam(3.3, 2.95, 0.5, 0.47, off(CABW, 0, 0.28, 0)) },
    // L14 the wheel bit: live-anchored ECU, then the follow-tracking climb ("And"@1480)
    { f0: 1449, f1: 1480, dyn: 'lw', p0: [3.2, 0.7, -3.7], p1: [3.05, 0.65, -3.4], l0: GWl, l1: GWl },
    { f0: 1480, f1: 1581, dyn: 'follow' },
    // L15 payoff: crane-up / pull-back over the crest, then the two men
    // still waiting below ("waiting"@1645)
    { f0: 1581, f1: 1645, p0: v3(C0.clone().add(fwdC.clone().multiplyScalar(5.5)).add(valC.clone().multiplyScalar(11.0)).add(new THREE.Vector3(0, 3.6, 0))),
      p1: v3(C0.clone().add(fwdC.clone().multiplyScalar(6.5)).add(valC.clone().multiplyScalar(13.5)).add(new THREE.Vector3(0, 5.6, 0))),
      l0: v3(C0.clone().add(fwdC.clone().multiplyScalar(-1)).add(new THREE.Vector3(0, 0.7, 0))), l1: v3(C0.clone().add(fwdC.clone().multiplyScalar(-1)).add(new THREE.Vector3(0, 0.7, 0))) },
    { f0: 1645, f1: 1693, ...faceCam(T1H, 6.4, 5.9, 1.1, 1.0, 0.9, 0.95, pairMid2) },
    // L16 final: board AND Ramu fully in frame — pulled back, look blended
    // 30% toward the crested cab so both hold their margins
    { f0: 1693, f1: 1799, p0: S16p0, p1: S16p1, l0: boardLook, l1: boardLook },
  ];
  // follow-shot path, Hann-smoothed (\u00b18f) at build time: the camera
  // inherits the climb's motion without its raw second differences, so
  // the jerk gate passes while the tracking stays tight and lag-free
  const tPosAt = (g) => {
    const i2 = shotIdx(g), tt2 = clamp((g - BND[i2]) / (BND[i2 + 1] - BND[i2]), 0, 1);
    let tPos = 0.47, lat = -2.2;
    if (i2 === 8) lat = lerp(-2.2, -2.34, seg(g, BND[8] + 8, BND[9] - 6));
    if (i2 === 13) { const s = sstep(tt2); tPos = lerp(0.47, 0.615, s); lat = lerp(-2.2, -0.5, s); }
    if (i2 >= 14) { tPos = 0.88; lat = 0; }
    return { tPos, lat };
  };
  const heroPosAt = (g) => { const { tPos, lat } = tPosAt(g); const p = curve.getPointAt(tPos), tan = curve.getTangentAt(tPos);
    return new THREE.Vector3(p.x + (-tan.z) * lat, p.y + 0.07, p.z + tan.x * lat); };
  const heroYawAt = (g) => { const tan = curve.getTangentAt(tPosAt(g).tPos); return Math.atan2(tan.x, tan.z); };
  for (const s of SUBS) if (s.dyn === 'follow') {
    const raw = [];
    for (let g = s.f0 - 8; g < s.f1 + 8; g++) {
      const gg = clamp(g, s.f0, s.f1 - 1), hp = heroPosAt(gg); // hold the climb's end pose past the cut (L15 teleports the truck to the crest — a new shot, not camera motion)
      const sc = lerp(1.0, 0.92, smoother(clamp((gg - s.f0) / (s.f1 - s.f0), 0, 1)));
      const o = new THREE.Vector3(-9.5 * sc, 2.6 * sc, 5.5 * sc).applyEuler(new THREE.Euler(0, heroYawAt(gg), 0));
      raw.push({ p: [hp.x + o.x, hp.y + o.y, hp.z + o.z], l: [hp.x, hp.y + 1.0, hp.z] });
    }
    s.path = [];
    for (let f = s.f0; f < s.f1; f++) {
      const acc = [0, 0, 0], accl = [0, 0, 0]; let wsum = 0;
      for (let k = -8; k <= 8; k++) {
        const wgt = Math.cos(Math.PI * k / 18) ** 2, r = raw[f + k - (s.f0 - 8)];
        for (let a = 0; a < 3; a++) { acc[a] += r.p[a] * wgt; accl[a] += r.l[a] * wgt; }
        wsum += wgt;
      }
      s.path.push({ p: acc.map(v => v / wsum), l: accl.map(v => v / wsum) });
    }
  }
  rig.H0 = H0; rig.yawH = yawH; rig.crestPos = C0; rig.yawC = yawC;
  window.__subs = SUBS.map(s => [s.f0, s.f1]);
}
// camera pose for frame f (pure in f; hero must already be posed)
function camPose(f) {
  let S = SUBS[SUBS.length - 1];
  for (const s of SUBS) { if (f < s.f1) { S = s; break; } }
  const u = smoother((f - S.f0) / (S.f1 - S.f0));
  const h = rig.hero;
  if (S.dyn === 'follow') {
    if (S.path) { const e = S.path[clamp(f - S.f0, 0, S.path.length - 1)]; return { p: e.p.slice(), l: e.l.slice() }; }
    const tp = h.outer.position, sc = lerp(1.0, 0.92, u);
    const offv = new THREE.Vector3(-9.5 * sc, 2.6 * sc, 5.5 * sc).applyEuler(new THREE.Euler(0, h.outer.rotation.y, 0));
    return { p: [tp.x + offv.x, tp.y + offv.y, tp.z + offv.z], l: [tp.x, tp.y + 1.0, tp.z] };
  }
  if (S.dyn === 'slip') {
    const tp = h.outer.position, o = lerp3(S.o0, S.o1, u);
    const offv = new THREE.Vector3(o[0], o[1], o[2]).applyEuler(new THREE.Euler(0, h.outer.rotation.y, 0));
    return { p: [tp.x + offv.x, tp.y + offv.y, tp.z + offv.z], l: [tp.x, tp.y + 1.0, tp.z] };
  }
  if (S.dyn === 'lw') {
    const L = (a) => v3(h.truck.localToWorld(new THREE.Vector3(a[0], a[1], a[2])));
    return { p: lerp3(L(S.p0), L(S.p1), u), l: lerp3(L(S.l0), L(S.l1), u) };
  }
  return { p: lerp3(S.p0, S.p1, u), l: lerp3(S.l0, S.l1, u) };
}

// ---------- captions (Salted Mine style: one word, low-centre — elephant pattern) ----------
const capCanvas = document.createElement('canvas'); capCanvas.width = W; capCanvas.height = H;
const capG = capCanvas.getContext('2d');
const capTex = new THREE.CanvasTexture(capCanvas); capTex.colorSpace = THREE.SRGBColorSpace;
const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const capScene = new THREE.Scene();
capScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2),
  new THREE.MeshBasicMaterial({ map: capTex, transparent: true, toneMapped: false })));
let capKey = null;
function drawCaption(f) {
  const t = f / FPS;
  let i = -1;
  for (let k = 0; k < WORDS.length; k++) { if (t >= WORDS[k].s) i = k; else break; }
  const word = i >= 0 ? WORDS[i].w : '';
  if (word === capKey) return;
  capKey = word;
  capG.clearRect(0, 0, W, H);
  if (word) {
    capG.font = '900 74px Arial, Helvetica, sans-serif';
    capG.textAlign = 'center'; capG.textBaseline = 'middle'; capG.lineJoin = 'round';
    capG.lineWidth = 17; capG.strokeStyle = '#000000';
    const y = Math.round(H * 0.79);
    capG.strokeText(word, W / 2, y);
    capG.fillStyle = '#ffffff';
    capG.fillText(word, W / 2, y);
  }
  capTex.needsUpdate = true;
}

// ---------- per-frame director (pure in f) ----------
const HEAP_STEPS = [0.05, 0.2, 0.35, 0.5, 0.62, 0.74, 0.84, 0.92, 1.0];
function spinAngle(f) { // lifted-wheel blur spin: fast, then choked by the brake in L11
  if (f < BND[10]) return f * 0.9;
  const x = f - BND[10];
  return BND[10] * 0.9 + 34 * (1 - Math.exp(-x / 26)) + Math.sin(x * 0.55) * Math.exp(-x / 30) * 2.2;
}
function poseFrame(f) {
  if (!rig.hero) return;
  const i = shotIdx(f), tt = clamp((f - BND[i]) / (BND[i + 1] - BND[i]), 0, 1);
  const h = rig.hero;
  // ---- hero pose ----
  let roll = 11, lat = -2.2, tPos = 0.47, shudder = 0;
  if (i === 8) { const s = seg(f, BND[8] + 8, BND[9] - 6); lat = lerp(-2.2, -2.34, s); roll = lerp(11, 12.3, s); shudder = Math.sin(f * 2.3) * 0.0035 * Math.sin(Math.PI * tt); }
  if (i === 13) { const s = sstep(tt); tPos = lerp(0.47, 0.615, s); lat = lerp(-2.2, -0.5, s); roll = lerp(11, 2.5, s); }
  if (i >= 14) { tPos = 0.88; lat = 0; roll = 0; }
  const { yaw } = poseHero(h, tPos, lat, roll);
  h.pitchG.rotation.x += shudder;
  scene.updateMatrixWorld(true);
  // ---- wheels ----
  const spinning = i <= 10 && !(i === 3) && i !== 2;
  rig.disc.visible = spinning || i === 10;
  rig.discSpin.rotation.x = spinAngle(f);
  rig.disc.material.opacity = i === 10 ? 0.95 * (1 - seg(f, BND[10], BND[11])) + 0.0 : 0.95;
  if (i === 10) rig.disc.visible = f < BND[11];
  let rearAng = 0, frontAng = 0;
  if (i === 11) { rearAng = seg(f, 1258, BND[12]) * 1.3; } // first turn starts 2f before "rushed"@1260
  if (i === 12) { rearAng = 1.3; } // hold the turned angle while Ramu stones the wheel (no snap-back)
  if (i === 13) { rearAng = 1.3 + (f - BND[13]) * 0.105; frontAng = (f - BND[13]) * 0.105; }
  if (i > 13) { rearAng = 1.3 + (BND[14] - BND[13]) * 0.105; frontAng = rearAng; }
  rig.wheelRear.rotation.x = rearAng;
  rig.wheelFL.rotation.x = frontAng; rig.wheelFR.rotation.x = frontAng;
  // ---- handbrake: pulled to half in shot 10, stays ----
  rig.lever.rotation.x = f < 1007 ? 0.55 : lerp(0.55, 0.05, seg(f, 1007, 1048)); // pull starts 2f before "pulled"@1009, half by "halfway"@1048
  if (rig.leverGrp) rig.leverGrp.visible = (i === 9 || i === 10); // exterior lever = close-up shorthand for its beat only
  // ---- stones ----
  rig.heap.forEach((r, k) => { r.visible = f >= BND[12] + HEAP_STEPS[k] * (BND[13] - BND[12]); });
  rig.bedStones.forEach((r, k) => { r.visible = f >= BND[12] + (k < 2 ? 0.55 : 0.8) * (BND[13] - BND[12]); });
  // ---- dust + falling debris ----
  const FW = anchorWorld(rig.anchors.fwheel), GW = anchorWorld(rig.anchors.gwheel);
  for (let k = 0; k < 7; k++) { // dust shaking off the spinning wheel, falling into the drop
    if (i === 0 || i === 5 || i === 6) {
      const cyc = ((f * 1.4 + k * 23) % 80) / 80;
      setPuff(k, FW.x - 0.35, FW.y - 0.2 - cyc * 2.6, FW.z + (k % 3 - 1) * 0.3, 0.7 + cyc * 0.9, 0.5 * (1 - cyc));
    } else setPuff(k, 0, -60, 0, 0.1, 0);
  }
  for (let k = 0; k < 4; k++) { // climb dust at the grounded wheel
    if (i === 13) {
      const cyc = ((f * 1.1 + k * 19) % 60) / 60;
      setPuff(7 + k, GW.x - Math.sin(yaw) * cyc * 1.6, GW.y - 0.35 + cyc * 0.3, GW.z - Math.cos(yaw) * cyc * 1.6, 0.6 + cyc * 0.8, 0.42 * (1 - cyc));
    } else setPuff(7 + k, 0, -60, 0, 0.1, 0);
  }
  for (let k = 0; k < 3; k++) { // stone-drop dust puffs in the trick shot
    const sf = BND[12] + HEAP_STEPS[k * 3] * (BND[13] - BND[12]);
    const age = f - sf;
    if (i === 12 && age >= 0 && age < 16) setPuff(11 + k, GW.x + 0.6, GW.y - 0.2, GW.z + (k - 1) * 0.4, 0.5 + age * 0.03, 0.4 * (1 - age / 16));
    else setPuff(11 + k, 0, -60, 0, 0.1, 0);
  }
  // loose stones roll off the edge as the truck slips (shot 9)
  rig.loose.forEach((r, k) => {
    const sf = BND[8] + 10 + k * 7, age = f - sf;
    if (i === 8 && age >= 0 && age < 75) {
      const p0 = curve.getPointAt(0.47), tan0 = curve.getTangentAt(0.47);
      const pl = Math.hypot(tan0.x, tan0.z) || 1;
      const ex = (-tan0.z / pl) * -3.0, ez = (tan0.x / pl) * -3.0; // drop-edge offset
      r.visible = true;
      r.position.set(p0.x + ex + (ex / 3) * age * 0.05, p0.y - 0.1 - age * age * 0.0035, p0.z + ez + (ez / 3) * age * 0.05 - k * 0.7);
      r.rotation.x = age * 0.2; r.rotation.z = age * 0.13;
    } else r.visible = false;
  });
  // ---- prayer flags flutter ----
  for (const flags of flagLines) flags.forEach((fg, k) => { fg.rotation.x = Math.sin(f * 0.25 + k * 0.7) * 0.25; });
  // ---- actors ----
  const vis = { ramuLean: f < 68 || (f >= BND[8] && f < BND[10]),
    ramuCalm: (f >= BND[3] && f < BND[4]) || (f >= 1417 && f < 1449) || (f >= 1480 && f < BND[14]),
    ramuCrouch: f >= BND[12] && f < 1417, ramuWave: f >= BND[14],
    t1Shout: f >= BND[2] && f < BND[3], t1Stand: (f >= BND[1] && f < BND[2]) || (f >= 1645 && f < BND[15]),
    t2Look: f >= BND[1] && f < BND[2], t2Laugh: f >= BND[2] && f < BND[3], t2Stand: f >= 1645 && f < BND[15] };
  for (const k in vis) { A[k].mesh.visible = vis[k]; A[k].blob.visible = vis[k] && (k.startsWith('t1') || k.startsWith('t2')); }
  if (vis.ramuLean) placeCabCard(A.ramuLean, yaw - Math.PI / 2 - 0.5);
  if (vis.ramuCalm) placeCabCard(A.ramuCalm, yaw - Math.PI / 2 - 0.5);
  if (vis.ramuWave) placeCabCard(A.ramuWave, yaw - 1.20);
  if (vis.t1Shout) A.t1Shout.redraw(clamp(SPEAK_OPEN[f] || 0, 0, 1));
  // ---- hook board grows out of the final scene ----
  hookBoard.visible = f >= BND[15];
  if (hookBoard.visible) {
    const g = seg(f, BND[15], BND[15] + 56);
    hookBoard.scale.setScalar(lerp(0.6, 1.0, g));
  }
  // ---- camera (v4 sub-shots; cuts on word onsets, smootherstep moves) ----
  const { p: cp, l: cl } = camPose(f);
  CAMLOOK = cl;
  camera.position.set(cp[0], cp[1], cp[2]);
  camera.lookAt(cl[0], cl[1], cl[2]);
  camera.updateMatrixWorld();
  // sun follows the subject so shadows stay crisp at both ends of the pass
  const subj = i >= 14 ? rig.crestPos : (i === 13 ? h.outer.position : rig.H0);
  sun.target.position.copy(subj);
  sun.position.copy(subj).add(SUN_OFF);
}
window.renderFrame = (f) => {
  if (!rig.hero) return false;
  poseFrame(f);
  // ---- render + caption overlay ----
  renderer.render(scene, camera);
  drawCaption(f);
  renderer.autoClear = false;
  renderer.render(capScene, fsCam);
  renderer.autoClear = true;
  return true;
};
window.TOTAL = TOTAL;

// ---------- QC debug API (placement + jerk gates; not used by the render) ----------
// Figure boxes per painter in canvas fractions [u0, u1, vBot, vTop]
// (v measured from the card's base). Cab cards sit behind the cab door by
// design, so their vBot is the drawn figure's lowest point, not the card's.
const FIGBOX = {
  ramuLean: [0.15, 0.90, 0.15, 0.903], ramuCalm: [0.15, 0.90, 0.15, 0.903],
  ramuWave: [0.15, 0.94, 0.15, 0.89], ramuCrouch: [0.26, 0.77, 0.03, 0.825],
  t1Shout: [0.12, 0.88, 0.03, 0.95], t1Stand: [0.16, 0.84, 0.03, 0.95],
  t2Look: [0.18, 0.90, 0.03, 0.955], t2Laugh: [0.22, 0.80, 0.03, 0.95],
  t2Stand: [0.16, 0.84, 0.03, 0.95],
};
// Head boxes [u0, u1, vChin, vTop] — for close/cab shots the head (incl.
// cap/hat and, for the wave, the raised hand) must be fully in frame;
// the body may overflow the bottom, as in any honest close-up.
const HEADBOX = {
  ramuLean: [0.287, 0.713, 0.607, 0.903], ramuCalm: [0.287, 0.713, 0.607, 0.903],
  ramuWave: [0.24, 0.94, 0.60, 0.91], ramuCrouch: [0.303, 0.697, 0.552, 0.825],
  t1Shout: [0.303, 0.697, 0.677, 0.95], t1Stand: [0.303, 0.697, 0.677, 0.95],
  t2Look: [0.303, 0.697, 0.687, 0.955], t2Laugh: [0.303, 0.697, 0.677, 0.95],
  t2Stand: [0.303, 0.697, 0.677, 0.95],
};
function evalPts(pts, mx, my) {
  const dir = camera.getWorldDirection(new THREE.Vector3());
  const cs = pts.map(p => {
    const behind = p.clone().sub(camera.position).dot(dir) <= 0.01;
    const q = p.clone().project(camera);
    return { x: q.x, y: q.y, behind };
  });
  const inAll = cs.every(c => !c.behind && Math.abs(c.x) <= mx && Math.abs(c.y) <= my);
  const outAll = cs.every(c => c.behind)
    || cs.every(c => !c.behind && c.x > 1.05) || cs.every(c => !c.behind && c.x < -1.05)
    || cs.every(c => !c.behind && c.y > 1.05) || cs.every(c => !c.behind && c.y < -1.05);
  return { state: inAll ? 'IN' : outAll ? 'OUT' : 'STRADDLE',
    ndc: cs.map(c => [+c.x.toFixed(2), +c.y.toFixed(2), c.behind ? 1 : 0]) };
}
window.__gate = (f) => {
  if (!rig.hero) return null;
  poseFrame(f);
  scene.updateMatrixWorld(true);
  const out = { f, actors: {}, board: null };
  for (const k in FIGBOX) {
    const card = A[k];
    if (!card || !card.mesh.visible) continue;
    const box = FIGBOX[k], w = card.mesh.geometry.parameters.width, hh = card.mesh.geometry.parameters.height;
    const toPts = (b) => [[b[0], b[2]], [b[1], b[2]], [b[0], b[3]], [b[1], b[3]]]
      .map(([u, v]) => card.mesh.localToWorld(new THREE.Vector3((u - 0.5) * w, v * hh, 0)));
    out.actors[k] = evalPts(toPts(box), 0.95, 0.97);
    out.actors[k].head = evalPts(toPts(HEADBOX[k]), 0.95, 0.97);
  }
  if (hookBoard && hookBoard.visible && rig.boardMesh) {
    const bm = rig.boardMesh, bw = bm.geometry.parameters.width, bh = bm.geometry.parameters.height, bd2 = bm.geometry.parameters.depth;
    const pts = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1])
      pts.push(bm.localToWorld(new THREE.Vector3(sx * bw / 2, sy * bh / 2, sz * bd2 / 2)));
    out.board = evalPts(pts, 0.93, 0.95);
  }
  return out;
};
window.camAt = (f) => {
  if (!rig.hero) return null;
  poseFrame(f);
  return { p: [camera.position.x, camera.position.y, camera.position.z], l: CAMLOOK.slice() };
};
window.__dbg = { scene, camera, rig, get A() { return A; }, get board() { return hookBoard; } };