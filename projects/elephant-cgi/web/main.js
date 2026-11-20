// ============================================================
// "The Boy Who Weighed an Elephant" — CGI line (approved graphics:
// three.js world, HDRI light, PBR textures, mirror water) with the
// Salted Mine round-head cast (toon.js painter) as cards.
// Elephant: Poly Pizza ele_3AfO8NwcxD (CC-BY 3.0) — weld + smooth
// normals + richer hide (the flat-faceted as-authored look was
// rejected by Abid 2026-11-21; subdivision explodes this mesh —
// verified — so smoothing is normals-only).
// Speaking: lip-sync ONLY on L4 (strongman), L6 (boy), L15 (king)
// via speakdata tracks; while speaking the face SKIN flexes
// elastically (cheeks/jaw) — see toon.js flex + speak.js applySpeak.
// Camera: smooth damped moves only. Daylight only (L16-17 golden).
// ============================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import * as BGU from 'three/addons/utils/BufferGeometryUtils.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as SPK from './speak.js';
import { SPEAK_DATA } from './speakdata.js';
import { WORDS } from './words.js';

const W = 1080, H = 1920, FPS = 30, TOTAL = 1799;
const BND = [0, 97, 183, 290, 421, 524, 639, 736, 823, 947, 1083, 1189, 1279, 1373, 1478, 1583, 1696, 1799];
const shotIdx = (f) => { for (let i = 0; i < 17; i++) if (f < BND[i + 1]) return i; return 16; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const seg = (f, a, b) => sstep((f - a) / (b - a));
// deterministic RNG (chunk renders run in separate sessions — the
// world must be identical in every session)
let _s = 1234567;
const rnd = () => ((_s = (_s * 1664525 + 1013904223) >>> 0) / 4294967296);

// ---------- renderer / scene ----------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.06;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xbccfdd, 30, 85);
const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 300);

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
const sun = new THREE.DirectionalLight(0xfff0d6, 3.2);
sun.position.set(-10, 14, 8); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -15; sun.shadow.camera.right = 15;
sun.shadow.camera.top = 15; sun.shadow.camera.bottom = -11;
sun.shadow.camera.near = 2; sun.shadow.camera.far = 48;
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun); scene.add(sun.target); sun.target.position.set(0, 1, 2);
const hemi = new THREE.HemisphereLight(0xcfe2f2, 0x5c5a44, 0.35); scene.add(hemi);

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
    roughness: rough, metalness: 0 });
}
function box(w, h, d, mat, x, y, z, parent = scene) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
const groundAt = (x, z) => z < 2.55 ? 1.1 : z < 3.15 ? 0.56 : z < 3.75 ? 0.24 : 0;

// ---------- environment (approved frame's world) ----------
const grass = new THREE.Mesh(new THREE.PlaneGeometry(70, 34), pbr('grass', 12, 6));
grass.rotation.x = -Math.PI / 2; grass.position.set(0, 1.1, -15); grass.receiveShadow = true; scene.add(grass);
const mud = new THREE.Mesh(new THREE.CircleGeometry(2.0, 36), pbr('brown_mud_leaves_01', 2, 2));
mud.rotation.x = -Math.PI / 2; mud.position.set(-3.2, 1.115, 0.2); mud.receiveShadow = true; scene.add(mud);
const stone = pbr('large_sandstone_blocks', 5, 1);
const stoneDark = pbr('large_sandstone_blocks', 5, 1); stoneDark.color.set(0x9a8f80); stoneDark.roughness = 0.55;
box(15, 0.9, 3.6, stone, 0, 0.65, 0.2);
box(15, 0.28, 0.6, stone, 0, 0.96, 2.25);
box(15, 0.56, 0.6, stone, 0, 0.68, 2.25);
box(15, 0.30, 0.62, stone, 0, 0.41, 2.85);
box(15, 0.16, 0.62, stoneDark, 0, 0.155, 3.45);
box(30, 3.4, 0.8, pbr('large_sandstone_blocks', 8, 1), 0, 2.8, -12.5);
box(30, 0.35, 1.1, stone, 0, 4.65, -12.5);
for (let i = -2; i <= 2; i++) {
  const a = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.5), new THREE.MeshStandardMaterial({ color: 0x2e2118, roughness: 1 }));
  a.position.set(i * 5.2, 2.35, -12.08); scene.add(a);
  const archTop = new THREE.Mesh(new THREE.CircleGeometry(0.85, 24, 0, Math.PI), a.material);
  archTop.position.set(i * 5.2, 3.6, -12.08); scene.add(archTop);
}
// water: mirror + ripple overlay
const mirror = new Reflector(new THREE.PlaneGeometry(80, 46), {
  clipBias: 0.003, textureWidth: 1024, textureHeight: 1024, color: 0x93a8a4 });
mirror.rotation.x = -Math.PI / 2; mirror.position.set(0, 0, 25); scene.add(mirror);
function waterNormalTex() {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'); const img = g.createImageData(S, S);
  const hv = (x, y) => Math.sin(x * 0.11 + Math.sin(y * 0.07) * 2.0) * 0.5 + Math.sin(y * 0.16 + Math.sin(x * 0.05) * 1.6) * 0.35 + Math.sin((x + y) * 0.045) * 0.4 + Math.sin(Math.hypot(x - S / 2, y - S / 2) * 0.14) * 0.25;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = hv(x + 1, y) - hv(x - 1, y), dy = hv(x, y + 1) - hv(x, y - 1);
    const inv = 1 / Math.hypot(dx * 1.4, dy * 1.4, 1), i = (y * S + x) * 4;
    img.data[i] = (-dx * 1.4 * inv * 0.5 + 0.5) * 255; img.data[i + 1] = (dy * 1.4 * inv * 0.5 + 0.5) * 255;
    img.data[i + 2] = inv * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(20, 12); return t;
}
const rippleNrm = waterNormalTex();
const ripple = new THREE.Mesh(new THREE.PlaneGeometry(80, 46),
  new THREE.MeshStandardMaterial({ color: 0x2a5258, transparent: true, opacity: 0.42,
    roughness: 0.1, metalness: 0, normalMap: rippleNrm, normalScale: new THREE.Vector2(0.7, 0.7), depthWrite: false }));
ripple.rotation.x = -Math.PI / 2; ripple.position.set(0, 0.02, 25); scene.add(ripple);
// expanding ripple rings around the boat (boarding / loading beats)
const rings = [];
for (let i = 0; i < 3; i++) {
  const r = new THREE.Mesh(new THREE.RingGeometry(0.92, 1.0, 48),
    new THREE.MeshBasicMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
  r.rotation.x = -Math.PI / 2; r.position.set(2.4, 0.03, 5.6); scene.add(r); rings.push(r);
}

// ---------- trees ----------
function leafTexture() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'); g.clearRect(0, 0, S, S);
  for (let i = 0; i < 340; i++) {
    const x = S / 2 + (rnd() - 0.5) * S * 0.92, y = S / 2 + (rnd() - 0.5) * S * 0.92;
    if (Math.hypot(x - S / 2, y - S / 2) > S * 0.46) continue;
    g.fillStyle = ['#4d7031', '#5d8439', '#3e5f27', '#6d9a44', '#557c33'][(rnd() * 5) | 0];
    g.save(); g.translate(x, y); g.rotate(rnd() * 3.2);
    g.beginPath(); g.ellipse(0, 0, 5 + rnd() * 8, 3 + rnd() * 4.5, 0, 0, 7); g.fill(); g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const leafTex = leafTexture();
function tree(x, z, s) {
  const grp = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({
    map: loadTex('assets/bark_diff.jpg', true, 1, 2), normalMap: loadTex('assets/bark_nor.jpg', false, 1, 2), roughness: 1 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13 * s, 0.24 * s, 2.8 * s, 10), trunkMat);
  trunk.position.y = 1.4 * s; trunk.castShadow = true; grp.add(trunk);
  const leafMat = new THREE.MeshStandardMaterial({ map: leafTex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1 });
  for (let i = 0; i < 9; i++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(2.3 * s, 2.3 * s), leafMat);
    const a = i / 9 * Math.PI * 2, r = 0.75 * s;
    p.position.set(Math.cos(a) * r, (2.9 + rnd() * 0.9) * s, Math.sin(a) * r);
    p.rotation.set(rnd() * 0.7 - 0.35, rnd() * Math.PI, rnd() * 0.5 - 0.25);
    p.castShadow = true; grp.add(p);
  }
  const top = new THREE.Mesh(new THREE.PlaneGeometry(2.5 * s, 2.5 * s), leafMat);
  top.position.y = 3.9 * s; top.rotation.x = -0.4; grp.add(top);
  grp.position.set(x, 1.1, z); scene.add(grp);
}
tree(-9.5, -5.5, 1.25); tree(10.8, -4.5, 1.05); tree(7.6, -8.5, 1.4); tree(-13, -2, 0.9);

// ---------- boat (lofted hull, plank wood) + painted waterline strip ----------
const BOAT_POS = { x: 2.4, y: 0.10, z: 5.6 }, SINK_MAX = 0.48;
function buildBoat() {
  const grp = new THREE.Group();
  const wood = pbr('brown_planks_05', 3, 1);
  const woodDark = pbr('brown_planks_05', 2, 1); woodDark.color.set(0xa89880);
  const L = 7.4, SEG = 16, PTS = 9;
  const positions = [], uvs = [], indices = [];
  for (let i = 0; i <= SEG; i++) {
    const t = i / SEG;
    const beam = 1.12 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.85)), 0.62) + 0.02;
    const sheer = 0.86 + 0.30 * Math.pow(Math.abs(2 * t - 1), 2.4);
    const depth = 1.02 * (0.72 + 0.28 * Math.sin(Math.PI * t));
    for (let j = 0; j <= PTS; j++) {
      const a = j / PTS * Math.PI;
      positions.push((t - 0.5) * L, sheer - Math.pow(Math.sin(a), 0.75) * depth, -Math.cos(a) * beam);
      uvs.push(t * 4, j / PTS);
    }
  }
  for (let i = 0; i < SEG; i++) for (let j = 0; j < PTS; j++) {
    const a = i * (PTS + 1) + j, b = a + PTS + 1;
    indices.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const hullGeo = new THREE.BufferGeometry();
  hullGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  hullGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  hullGeo.setIndex(indices); hullGeo.computeVertexNormals();
  const hullMat = wood.clone(); hullMat.side = THREE.DoubleSide;
  const hull = new THREE.Mesh(hullGeo, hullMat);
  hull.castShadow = true; hull.receiveShadow = true; grp.add(hull);
  for (const sgn of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= SEG; i++) {
      const t = i / SEG;
      const beam = 1.12 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.85)), 0.62) + 0.02;
      const sheer = 0.86 + 0.30 * Math.pow(Math.abs(2 * t - 1), 2.4);
      pts.push(new THREE.Vector3((t - 0.5) * L, sheer + 0.02, sgn * beam));
    }
    const rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.055, 8), woodDark);
    rail.castShadow = true; grp.add(rail);
  }
  const floor = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.07, 1.5), woodDark);
  floor.position.y = 0.10; floor.receiveShadow = true; grp.add(floor);
  for (const bx of [-1.9, 0.1, 2.0]) {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 1.95), wood);
    bench.position.set(bx, 0.52, 0); bench.castShadow = true; grp.add(bench);
  }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 1.7), wood);
  deck.position.set(-3.0, 0.72, 0); grp.add(deck);
  const rope = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.07, 10, 24),
    new THREE.MeshStandardMaterial({ color: 0xa68d5f, roughness: 1 }));
  rope.rotation.x = Math.PI / 2; rope.position.set(2.6, 0.60, 0.3); rope.castShadow = true; grp.add(rope);
  return grp;
}
const boat = buildBoat();
boat.position.set(BOAT_POS.x, BOAT_POS.y, BOAT_POS.z); boat.rotation.y = 0.06;
scene.add(boat);
// the painted line: sits exactly at water level (y=0) when the boat is
// fully sunk (group y = BOAT_POS.y - SINK_MAX) -> local y = SINK_MAX - BOAT_POS.y
const stripMat = new THREE.MeshStandardMaterial({ color: 0xffd23e, emissive: 0xcf8f00, emissiveIntensity: 0.35, roughness: 0.6, transparent: true, opacity: 0 });
const strip = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.11, 0.04), stripMat);
strip.position.set(0.1, SINK_MAX - BOAT_POS.y, 1.03); boat.add(strip);
const stripEdge = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.03, 0.045),
  new THREE.MeshStandardMaterial({ color: 0xd23c1e, roughness: 0.6, transparent: true, opacity: 0 }));
stripEdge.position.set(0.1, SINK_MAX - BOAT_POS.y - 0.07, 1.03); boat.add(stripEdge);

// gangplank: platform edge -> boat gunwale
const plankGrp = new THREE.Group(); plankGrp.position.set(0.85, 1.09, 2.55); scene.add(plankGrp);
const plank = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.07, 2.9), pbr('brown_planks_05', 1, 2));
plank.position.set(0.55, -0.18, 1.28); plank.rotation.x = 0.13; plank.castShadow = true; plank.receiveShadow = true; plankGrp.add(plank);

// ---------- stones: boat load + platform pile + baskets ----------
const rockMat = new THREE.MeshStandardMaterial({ color: 0x8d867c, roughness: 0.95, flatShading: true });
function makeRocks(n, spread, parent) {
  const arr = [];
  for (let i = 0; i < n; i++) {
    const r = 0.10 + rnd() * 0.12;
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), rockMat);
    rock.position.set((rnd() - 0.5) * spread.x, r * 0.7 + (i > n * 0.6 ? 0.16 : 0), (rnd() - 0.5) * spread.z);
    rock.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    rock.castShadow = true; rock.receiveShadow = true; rock.visible = false;
    parent.add(rock); arr.push(rock);
  }
  return arr;
}
const boatRocks = makeRocks(26, { x: 3.4, z: 1.1 }, boat); boatRocks.forEach(r => { r.position.y += 0.16; });
const pileGrp = new THREE.Group(); pileGrp.position.set(-0.9, 1.1, 2.0); scene.add(pileGrp);
const pileRocks = makeRocks(20, { x: 1.1, z: 0.7 }, pileGrp);
function basketProp(scale = 1) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xa87f46, roughness: 1 });
  const bodyB = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.22, 0.34, 12, 1, true), mat);
  bodyB.material = mat; bodyB.castShadow = true; g.add(bodyB);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.035, 8, 20), mat);
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.17; g.add(rim);
  const bot = new THREE.Mesh(new THREE.CircleGeometry(0.22, 12), mat);
  bot.rotation.x = Math.PI / 2; bot.position.y = -0.17; g.add(bot);
  const fill = new THREE.Mesh(new THREE.IcosahedronGeometry(0.20, 0), rockMat);
  fill.position.y = 0.16; fill.scale.y = 0.55; g.add(fill);
  g.scale.setScalar(scale); return g;
}
const basketsFloor = [];
for (const [bx, bz] of [[0.3, 1.9], [2.8, 1.85], [-1.7, 2.3]]) {
  const b = basketProp(1); b.position.set(bx, 1.28, bz); b.rotation.y = rnd() * 3; scene.add(b); basketsFloor.push(b);
}

// ---------- elephant (improved: welded + smooth normals, richer hide) ----------
function makeSkinMaps() {
  const S = 1024;
  const col = document.createElement('canvas'); col.width = col.height = S;
  const g = col.getContext('2d');
  g.fillStyle = '#5d544b'; g.fillRect(0, 0, S, S); // darker, richer base than the rejected frame
  for (let i = 0; i < 1300; i++) {
    const x = rnd() * S, y = rnd() * S, r = 26 + rnd() * 160;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const tones = ['112,100,86', '78,70,62', '108,94,78', '96,86,76', '70,62,56', '122,110,96'];
    const t = tones[(rnd() * tones.length) | 0];
    gr.addColorStop(0, `rgba(${t},${0.07 + rnd() * 0.11})`); gr.addColorStop(1, `rgba(${t},0)`);
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  const cImg = g.getImageData(0, 0, S, S);
  let seed = 999;
  const prand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < cImg.data.length; i += 4) {
    const n = (prand() - 0.5) * 10;
    cImg.data[i] += n; cImg.data[i + 1] += n; cImg.data[i + 2] += n;
  }
  g.putImageData(cImg, 0, 0);
  // bump: fine isotropic grain only (directional crease patterns stripe
  // on this model's strip UVs — verified in close-up tests)
  const bSmall = document.createElement('canvas'); bSmall.width = bSmall.height = 256;
  const bs = bSmall.getContext('2d');
  bs.fillStyle = '#808080'; bs.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 12000; i++) {
    bs.fillStyle = prand() < 0.5 ? 'rgba(38,38,38,0.30)' : 'rgba(218,218,218,0.26)';
    bs.beginPath(); bs.arc(prand() * 256, prand() * 256, 0.6 + prand() * 1.9, 0, 7); bs.fill();
  }
  const bump = document.createElement('canvas'); bump.width = bump.height = S;
  const bg2 = bump.getContext('2d'); bg2.imageSmoothingEnabled = true;
  bg2.drawImage(bSmall, 0, 0, S, S); bg2.drawImage(bSmall, 0, 0, S, S);
  const rgh = document.createElement('canvas'); rgh.width = rgh.height = S;
  const r2 = rgh.getContext('2d'); r2.fillStyle = '#e2e2e2'; r2.fillRect(0, 0, S, S);
  for (let i = 0; i < 260; i++) {
    const x = rnd() * S, y = rnd() * S, r = 30 + rnd() * 130;
    const gr = r2.createRadialGradient(x, y, 0, x, y, r);
    const v = rnd() < 0.5 ? '188,188,188' : '246,246,246';
    gr.addColorStop(0, `rgba(${v},${0.10 + rnd() * 0.12})`); gr.addColorStop(1, `rgba(${v},0)`);
    r2.fillStyle = gr; r2.beginPath(); r2.arc(x, y, r, 0, 7); r2.fill();
  }
  const mk = (cv, srgb, rx = 2.5, ry = 1.8) => { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  return { map: mk(col, true), bumpMap: mk(bump, false, 3.5, 2.6), roughnessMap: mk(rgh, false) };
}
const skinMaps = makeSkinMaps();
const skinMat = new THREE.MeshStandardMaterial({
  map: skinMaps.map, bumpMap: skinMaps.bumpMap, bumpScale: 0.55, roughnessMap: skinMaps.roughnessMap,
  roughness: 1.0, metalness: 0, envMapIntensity: 0.55 });
const ivoryMat = new THREE.MeshStandardMaterial({ color: 0xe9e0cc, roughness: 0.42, metalness: 0 });
const eleHolder = new THREE.Group(); scene.add(eleHolder);
function smoothGeo(geoIn) {
  const geo = BGU.mergeVertices(geoIn, 1e-4);
  geo.deleteAttribute('normal'); geo.computeVertexNormals();
  return geo;
}
new GLTFLoader().load('assets/ele_3AfO8NwcxD.glb', (gltf) => {
  const obj = gltf.scene;
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x191411, roughness: 0.25, metalness: 0 });
  const bodyMeshes = [];
  obj.traverse(o => {
    if (o.isMesh) {
      const isIvory = o.material && /ivory/i.test(o.material.name || '');
      o.geometry = smoothGeo(o.geometry); // THE fix: smooth shading, no faceted planes
      o.material = isIvory ? ivoryMat : skinMat;
      o.castShadow = true; o.receiveShadow = true;
      if (!isIvory) bodyMeshes.push(o);
    }
  });
  for (const m of bodyMeshes) for (const sgn of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 12), eyeMat);
    eye.position.set(1.74, 0.30, sgn * 0.53); m.add(eye);
  }
  const box0 = new THREE.Box3().setFromObject(obj);
  const size = box0.getSize(new THREE.Vector3());
  obj.scale.setScalar(3.2 / size.y);
  eleHolder.add(obj);
  const box1 = new THREE.Box3().setFromObject(eleHolder);
  obj.position.x -= (box1.min.x + box1.max.x) / 2;
  obj.position.z -= (box1.min.z + box1.max.z) / 2;
  obj.position.y -= box1.min.y;
  glbDone = true; tryReady();
}, undefined, (e) => { window.err = String(e); });
// elephant path keys: [frame, x, y, z, rotY] — y is ground under its feet
const ELE_KEYS = [
  [0, -2.2, 1.1, 1.4, -0.63], [183, -2.2, 1.1, 1.4, -0.63],
  [215, -2.8, 1.1, 0.8, -1.5], [290, -2.8, 1.1, 0.8, -1.5],           // L3: steps to the balance
  [421, -2.9, 1.1, 1.2, -0.9], [639, -2.2, 1.1, 1.4, -0.63],          // drift back home
  [665, -0.7, 1.1, 1.75, -0.15], [690, 0.7, 1.06, 2.7, 0.45],         // L7: walk to the plank
  [712, 1.45, 0.82, 3.95, 0.35], [735, 2.35, 0.24, 5.35, 0.05],       // over the plank, onto the boat
  [823, 2.35, 0.24, 5.35, 0.05],                                       // stands aboard through L8
  [862, 1.45, 0.82, 3.95, 0.35], [888, 0.7, 1.06, 2.7, 0.45],          // L9: steps off (reverse)
  [915, -0.7, 1.1, 1.75, -0.15], [946, -2.2, 1.1, 1.4, -0.63],
  [1798, -2.2, 1.1, 1.4, -0.63],
];
function eleAt(f) {
  let a = ELE_KEYS[0], b = ELE_KEYS[ELE_KEYS.length - 1];
  for (let i = 0; i < ELE_KEYS.length - 1; i++) if (f >= ELE_KEYS[i][0] && f <= ELE_KEYS[i + 1][0]) { a = ELE_KEYS[i]; b = ELE_KEYS[i + 1]; break; }
  const t = b[0] > a[0] ? sstep((f - a[0]) / (b[0] - a[0])) : 0;
  return { x: lerp(a[1], b[1], t), y: lerp(a[2], b[2], t), z: lerp(a[3], b[3], t), ry: lerp(a[4], b[4], t),
           moving: (f > a[0] && f < b[0] && (a[1] !== b[1] || a[3] !== b[3])) ? 1 : 0, segT: t };
}
// boat sink: driven by elephant aboard (L7-L9) and stone load (L10+)
function sinkAt(f) {
  if (f < 639) return 0;
  if (f < 736) return seg(f, 700, 736);                    // elephant's weight settles
  if (f < 823) return 1;
  if (f < 947) return 1 - seg(f, 855, 935);                // elephant off -> rises
  if (f < 1083) return seg(f, 955, 1075) * 0.97;           // stones load in
  if (f < 1583) return 0.97;
  if (f < 1696) return lerp(0.97, 0.30, seg(f, 1590, 1690)); // mockers unload
  return 0.30;
}
const boatRockCountUnused = 0; // (stone counts live in renderFrame via ROCK_STEPS)

// ---------- big palace balance (L3: dragged out, beam snaps) ----------
const bigBal = new THREE.Group(); scene.add(bigBal);
const woodDarkMat = new THREE.MeshStandardMaterial({ color: 0x5a4026, roughness: 0.9 });
const woodMidMat = new THREE.MeshStandardMaterial({ color: 0x7a5a34, roughness: 0.85 });
{
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.22, 1.6), stoneDark); base.position.y = 0.11; bigBal.add(base);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 2.6, 10), woodDarkMat);
  post.position.y = 1.5; post.castShadow = true; bigBal.add(post);
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), ivoryMat); finial.position.y = 2.9; bigBal.add(finial);
}
const beamGrp = new THREE.Group(); beamGrp.position.set(0, 2.78, 0); bigBal.add(beamGrp);
const beamL = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.11, 0.13), woodMidMat);
beamL.position.x = -1.12; beamL.castShadow = true;
const beamLPiv = new THREE.Group(); beamLPiv.add(beamL); beamGrp.add(beamLPiv);
const beamR = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.11, 0.13), woodMidMat);
beamR.position.x = 1.12; beamR.castShadow = true;
const beamRPiv = new THREE.Group(); beamRPiv.add(beamR); beamGrp.add(beamRPiv);
function makePan(side) {
  const g = new THREE.Group();
  for (const dz of [-0.28, 0.28]) {
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.15, 6),
      new THREE.MeshStandardMaterial({ color: 0xa68d5f, roughness: 1 }));
    rope.position.set(0, -0.58, dz); g.add(rope);
  }
  const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.30, 0.16, 18), woodDarkMat);
  pan.position.y = -1.22; pan.castShadow = true; g.add(pan);
  g.position.set(side * 2.2, 0, 0); beamGrp.add(g); return g;
}
const panL = makePan(-1), panR = makePan(1);
const SNAP_F = (() => { const w = WORDS.find(w => /snapped/i.test(w.w)); return w ? Math.round(w.s * FPS) : 252; })();

// ---------- small brass balance + tally board (L12-L14) ----------
const smallBal = new THREE.Group(); smallBal.position.set(4.9, 1.1, 1.7); smallBal.rotation.y = -0.5; scene.add(smallBal);
const brass = new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.9, roughness: 0.32 });
{
  const table = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.9), woodDarkMat);
  table.position.y = 0.52; table.castShadow = true; smallBal.add(table);
  for (const [lx, lz] of [[-0.75, -0.35], [0.75, -0.35], [-0.75, 0.35], [0.75, 0.35]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.52, 0.09), woodDarkMat);
    leg.position.set(lx, 0.26, lz); smallBal.add(leg);
  }
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.62, 10), brass);
  post.position.y = 0.87; smallBal.add(post);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), brass); knob.position.y = 1.2; smallBal.add(knob);
}
const sBeam = new THREE.Group(); sBeam.position.set(0, 1.16, 0); smallBal.add(sBeam);
{
  const bm = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.035, 0.045), brass); bm.castShadow = true; sBeam.add(bm);
  for (const s of [-1, 1]) {
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.30, 5), brass);
    chain.position.set(s * 0.56, -0.15, 0); sBeam.add(chain);
    const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.10, 0.05, 14), brass);
    pan.position.set(s * 0.56, -0.32, 0); pan.castShadow = true; sBeam.add(pan);
    const load = new THREE.Mesh(new THREE.IcosahedronGeometry(0.085, 0), rockMat);
    load.position.set(s * 0.56, -0.26, 0); load.visible = false; sBeam.add(load);
    if (s < 0) sBeam.userData.loadL = load; else sBeam.userData.loadR = load;
  }
}
// tally board: chalk loads, redrawn when the count changes
const tallyCanvas = document.createElement('canvas'); tallyCanvas.width = 256; tallyCanvas.height = 340;
const tallyTex = new THREE.CanvasTexture(tallyCanvas); tallyTex.colorSpace = THREE.SRGBColorSpace;
function drawTally(n) {
  const g = tallyCanvas.getContext('2d');
  g.fillStyle = '#1d2b22'; g.fillRect(0, 0, 256, 340);
  g.strokeStyle = '#c9a86a'; g.lineWidth = 8; g.strokeRect(6, 6, 244, 328);
  g.fillStyle = '#e8f2e4'; g.font = '900 40px Arial'; g.textAlign = 'center'; g.fillText('LOADS', 128, 58);
  g.strokeStyle = '#e8f2e4'; g.lineWidth = 6; g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const grp = Math.floor(i / 5), k = i % 5, gx = 48 + grp * 84, gy = 108 + (grp > 1 ? 96 : 0), yy = gy + ((grp > 1) ? -96 : 0);
    const row = Math.floor(grp / 2), colI = grp % 2;
    const x0 = 52 + colI * 92, y0 = 108 + row * 100;
    if (k < 4) { g.beginPath(); g.moveTo(x0 + k * 17, y0); g.lineTo(x0 + k * 17, y0 + 52); g.stroke(); }
    else { g.beginPath(); g.moveTo(x0 - 6, y0 + 40); g.lineTo(x0 + 56, y0 + 8); g.stroke(); }
  }
  tallyTex.needsUpdate = true;
}
drawTally(0);
const tallyBoard = new THREE.Group(); tallyBoard.position.set(4.6, 1.1, 3.05); tallyBoard.rotation.y = 0.35; scene.add(tallyBoard);
{
  const bd = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.25, 0.05),
    new THREE.MeshStandardMaterial({ map: tallyTex, roughness: 0.9 }));
  bd.position.y = 1.05; bd.castShadow = true; tallyBoard.add(bd);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.55, 0.07), woodDarkMat);
    leg.position.set(s * 0.36, 0.27, 0); tallyBoard.add(leg);
  }
}
// load completions (frames) for the small balance / tally
const LOAD_DONE = [1208, 1240, 1288, 1322, 1358, 1405];
const loadCountAt = (f) => LOAD_DONE.filter(d => f >= d).length;

// ---------- final hook board (boards.json spec) ----------
const hookCanvas = document.createElement('canvas'); hookCanvas.width = 1024; hookCanvas.height = 342;
{
  const g = hookCanvas.getContext('2d');
  g.fillStyle = '#14202f'; g.fillRect(0, 0, 1024, 342);
  g.strokeStyle = '#ffd9a0'; g.lineWidth = 7; g.strokeRect(14, 14, 996, 314);
  g.fillStyle = '#ffd9a0'; g.font = '900 70px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('But tomorrow… the', 512, 74);
  g.fillText('fisherman who caught the', 512, 171);
  g.fillText('moon in his own net?', 512, 268);
}
const hookTex = new THREE.CanvasTexture(hookCanvas); hookTex.colorSpace = THREE.SRGBColorSpace;
const hookBoard = new THREE.Group(); hookBoard.position.set(-1.3, 0.42, 3.15); hookBoard.rotation.y = 0.06; scene.add(hookBoard);
{
  const bd = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.54, 0.09),
    [woodDarkMat, woodDarkMat, woodDarkMat, woodDarkMat,
     new THREE.MeshStandardMaterial({ map: hookTex, roughness: 0.85 }), woodDarkMat]);
  bd.position.y = 1.15; bd.castShadow = true; hookBoard.add(bd);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), woodDarkMat);
    leg.position.set(s * 1.9, 0.2, 0); hookBoard.add(leg);
  }
  hookBoard.visible = false;
}

// ---------- dust puffs (sprites, deterministic by frame) ----------
const puffTex = P.tex(P.radial('216,196,160', 0.55));
const puffs = [];
for (let i = 0; i < 10; i++) {
  const sm = new THREE.SpriteMaterial({ map: puffTex, transparent: true, opacity: 0, depthWrite: false });
  const sp = new THREE.Sprite(sm); sp.scale.set(0.6, 0.6, 1); scene.add(sp); puffs.push(sp);
}
function setPuff(i, x, y, z, k, scale) {
  const p = puffs[i]; if (!p) return;
  p.position.set(x, y, z); p.material.opacity = 0.34 * k; const s = scale * (0.6 + 0.7 * (1 - k)); p.scale.set(s, s, 1);
  p.visible = k > 0.02;
}

// ---------- cards (Salted Mine painter, ported card system) ----------
const CW = 1200, CH = 2000, CM = 2.25;
const cardGeo = new THREE.PlaneGeometry(CM * 0.6, CM); cardGeo.translate(0, CM / 2 - CM * 0.025, 0);
const blobTex = P.tex(P.radial('20,14,30', 0.6));
class Card {
  constructor() {
    const c = document.createElement('canvas'); c.width = CW; c.height = CH;
    this.c = c; this.g = c.getContext('2d');
    this.t = new THREE.CanvasTexture(this.c); this.t.colorSpace = THREE.SRGBColorSpace; this.t.anisotropy = 4;
    this.mat = new THREE.MeshBasicMaterial({ map: this.t, transparent: true, alphaTest: 0.02, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(cardGeo, this.mat);
    this.mesh.castShadow = true;
    this.mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: this.t, alphaTest: 0.5 });
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
    this.blob.rotation.x = -Math.PI / 2; this.blob.renderOrder = 1;
    scene.add(this.mesh); scene.add(this.blob);
    this.key = ''; this.mesh.visible = this.blob.visible = false;
  }
  draw(key, fn) {
    if (key === this.key) return; this.key = key;
    const g = this.g; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, CW, CH); g.setTransform(CW / 600, 0, 0, CH / 1000, 0, 0);
    const p = new T.Pen(g); fn(p); this.t.needsUpdate = true;
  }
}
const cards = []; const getCard = (i) => cards[i] || (cards[i] = new Card());
function drawActors(list) {
  cards.forEach((c) => { c.mesh.visible = c.blob.visible = false; });
  list.forEach((a, i) => {
    const c = getCard(i);
    c.draw(a.key, a.draw);
    c.mesh.visible = true; c.mesh.position.set(a.x, a.y, a.z);
    const s = a.s || 1; c.mesh.scale.set(s * (a.flip ? -1 : 1), s, s);
    c.mesh.rotation.set(0, Math.atan2(camera.position.x - a.x, camera.position.z - a.z) + (a.yaw || 0), a.roll || 0);
    c.mat.opacity = a.alpha ?? 1; c.mat.transparent = true;
    c.mesh.renderOrder = a.order || 2;
    if (a.blob !== false) { c.blob.visible = true; c.blob.position.set(a.x, (a.ground ?? a.y) + 0.02, a.z); c.blob.scale.set(0.95 * s, 0.6 * s, 1); }
  });
}

// ---------- cast (Salted Mine outfits, dressed per role) ----------
const OUTFITS = {
  king:   { jacket: '#7c2233', pants: '#3a2a3a', boots: '#241a12', hat: 'crown', skin: '#ffe2c2' },
  boy:    { jacket: '#2f7d8c', pants: '#5a4632', boots: '#4a3220', hat: 'hair', hair: '#241a12', skin: '#ffe2c2', build: 'kid' },
  strong: { jacket: '#b3543a', pants: '#33302c', boots: '#201812', hat: 'turban', turban: '#f3e3bb', skin: '#f5c9a0', build: 'stout', moustache: '#2a201a' },
  strong2:{ jacket: '#8c5a2e', pants: '#2c3038', boots: '#1c1712', hat: 'turban', turban: '#e8dcc0', skin: '#ffe2c2', build: 'stout', moustache: '#2a201a' },
  court1: { jacket: '#3f7d4e', pants: '#33302c', boots: '#201812', hat: 'hair', hair: '#1e1714', skin: '#ffe2c2' },
  court2: { jacket: '#7b5ac9', pants: '#2c3038', boots: '#1c1712', hat: 'cap', cap: '#54682c', skin: '#f5c9a0' },
  court3: { jacket: '#c99635', pants: '#33302c', boots: '#201812', hat: 'turban', turban: '#f3e3bb', skin: '#f5c9a0' },
  court4: { jacket: '#4a6a9e', pants: '#2c3038', boots: '#201812', hat: 'hair', hair: '#2b211c', skin: '#ffe2c2' },
};
const SEEDS = { king: 41, boy: 61, strong: 51, strong2: 55, court1: 52, court2: 53, court3: 54, court4: 56 };
const BLINKS = {}; for (const k in SEEDS) BLINKS[k] = new T.Blink(SEEDS[k]);
const CHEEK = { neutral: 0.45, stern: 0.42, determined: 0.5, smile: 0.55, grin: 0.65, laugh: 0.85, shock: 0.22, wonder: 0.32, angry: 0.72, proud: 0.6, smug: 0.62, wink: 0.6, nervous: 0.3, scared: 0.25, sad: 0.35, thinking: 0.45, confused: 0.4, stubborn: 0.5, squint: 0.45, relief: 0.6 };
const faceP2 = (name) => ({ ...T.faceP(name), cheek: CHEEK[name] ?? 0.45 });
function exprAt(keys, f) { // [[frame, expr], ...] -> {P, tag}
  let cur = keys[0], prev = null;
  for (const k of keys) { if (f >= k[0]) { prev = cur === k ? prev : cur; cur = k; } else break; }
  if (!prev || prev === cur || f >= cur[0] + 8) return { P: faceP2(cur[1]), tag: cur[1] };
  const t = sstep((f - cur[0]) / 8);
  return { P: T.blendFaceP(faceP2(prev[1]), faceP2(cur[1]), t), tag: prev[1] + '>' + cur[1] + '@' + Math.round(t * 4) };
}
// speak: baked tracks (L4 strongman, L6 boy, L15 king) + elastic skin-flex
// track — a spring simulated over the envelope once at load (deterministic,
// so GitHub chunk sessions agree frame-for-frame).
const SPEAK = SPK.makeSpeakPlayer(SPEAK_DATA);
const flexT = new Float32Array(TOTAL);
{
  let cur = 0, vel = 0;
  for (let f = 0; f < TOTAL; f++) {
    const s = SPEAK.at(f);
    const target = !s.active ? 0 : (s.open < 0.06 ? 0.03 : Math.min(0.6, 0.10 + s.open * 0.65));
    vel = (vel + (target - cur) * 0.38) * 0.60;
    cur = clamp(cur + vel, 0, 0.72);
    flexT[f] = cur;
  }
}
function speakP(baseP, f) {
  const P = SPK.applySpeak(baseP, SPEAK.at(f));
  P.flex = flexT[f];
  P.cheek = Math.max(P.cheek || 0, 0.4);
  return P;
}
const nodAt = (f) => (SPEAK.at(f).nod || 0) * 0.022;

// ---------- actor list builders ----------
function stand(list, who, P, tag, x, z, o = {}) {
  const f = o.f;
  const opts = { exprP: P, blink: BLINKS[who].at(f), seed: SEEDS[who], mode: o.mode || 'stand',
    phase: o.phase || 0, facing: o.facing || 0, look: o.look || 0, lookY: o.lookY || 0,
    breath: Math.floor(f / 5) * 5, prop: o.prop || null, squash: o.squash || 0, headTilt: o.headTilt || 0, tilt: o.tilt || 0 };
  const key = [who, 'F', tag, opts.mode, o.prop ? o.prop[0] + Math.round((o.prop[1] || 0) * 8) : '-', Math.round(opts.blink * 12),
    Math.round((P.flex || 0) * 16), Math.round((P.mOpen || 0) * 16), Math.round((o.squash || 0) * 30), Math.floor(f / 5), o.ov || ''].join('|');
  list.push({ key, draw: (p) => { T.bodyFront(p, OUTFITS[who], opts); if (o.overlay) o.overlay(p); },
    x, y: o.y ?? groundAt(x, z), z, s: o.s ?? (who === 'boy' ? 0.95 : 1.0), yaw: o.yaw || 0, flip: o.flip, roll: o.roll || 0,
    ground: o.y ?? groundAt(x, z), blob: o.blob });
}
const SIDE_EXPR = { determined: 'stern', thinking: 'squint', sad: 'pained', angry: 'stern', proud: 'smile', smug: 'smile', scared: 'nervous', confused: 'nervous' };
function side(list, who, expr, x, z, o = {}) {
  const f = o.f;
  expr = SIDE_EXPR[expr] || expr; // bodySide reads the v1 FACE table, not FACEP names
  const opts = { expr, blink: BLINKS[who].at(f), seed: SEEDS[who], mode: o.mode || 'march',
    phase: o.phase || 0, stomp: o.stomp ?? 1, stride: o.stride ?? 1, pose: o.pose || 0 };
  const key = [who, 'S', expr, opts.mode, Math.round((o.phase || 0) * 24), Math.round(opts.blink * 12), o.ov || ''].join('|');
  list.push({ key, draw: (p) => { T.bodySide(p, OUTFITS[who], opts); if (o.overlay) o.overlay(p); },
    x, y: o.y ?? groundAt(x, z), z, s: o.s ?? (who === 'boy' ? 0.95 : 1.0), yaw: o.yaw || 0, flip: o.flip, roll: o.roll || 0,
    ground: o.y ?? groundAt(x, z), blob: o.blob });
}
// generic keyframed walker: keys [[f, x, z], ...] -> pos + phase + moving
function walkAt(keys, f) {
  let a = keys[0], b = keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i++) if (f >= keys[i][0] && f <= keys[i + 1][0]) { a = keys[i]; b = keys[i + 1]; break; }
  if (f < keys[0][0]) { a = b = keys[0]; }
  const t = b[0] > a[0] ? clamp((f - a[0]) / (b[0] - a[0]), 0, 1) : 0;
  const x = lerp(a[1], b[1], t), z = lerp(a[2], b[2], t);
  // phase from distance actually travelled (feet stay planted, no glide)
  let dist = 0;
  for (let i = 0; i < keys.length - 1; i++) {
    const k0 = keys[i], k1 = keys[i + 1], segLen = Math.hypot(k1[1] - k0[1], k1[2] - k0[2]);
    if (f >= k1[0]) dist += segLen;
    else if (f > k0[0]) { dist += segLen * clamp((f - k0[0]) / (k1[0] - k0[0]), 0, 1); break; }
    else break;
  }
  const moving = (f > a[0] && f < b[0] && (a[1] !== b[1] || a[2] !== b[2])) ? 1 : 0;
  return { x, z, phase: dist * 1.45, moving, dirX: Math.sign(b[1] - a[1]) || 1 };
}
const basketOv = (tip = 0) => (p) => {
  const cx = 372, cy = 618, c = Math.cos(tip), s = Math.sin(tip);
  const rot = ([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c];
  const pts = [[332, 578], [412, 578], [396, 662], [348, 662]].map(rot);
  p.poly(pts, '#a87f46', 5);
  p.poly([[332, 578], [412, 578], [408, 596], [336, 596]].map(rot), '#8a6535', 4);
  for (const [sx, sy] of [[352, 570], [376, 562], [398, 572]]) {
    const [rx, ry] = rot([sx, sy]); p.ell(rx, ry, 13, 10, '#8d867c', 3);
  }
};
const sweetsOv = (p) => {
  p.poly([[262, 690], [338, 690], [326, 724], [274, 724]], '#c9552e', 4);
  for (const [sx, sy, col] of [[282, 684, '#f2a03c'], [300, 678, '#f7e8c8'], [318, 684, '#e86e78']]) p.ell(sx, sy, 10, 8, col, 2.5);
};

// ---------- per-shot actors ----------
function actorsAt(f) {
  const L = []; const i = shotIdx(f);
  const E = (keys) => exprAt(keys, f);
  if (i === 0) { // L1 hook: elephant hero (3D), court small behind
    let e = E([[0, 'wonder']]); stand(L, 'boy', e.P, e.tag, 1.35, 2.35, { f, facing: -0.5, lookY: -0.3 });
  } else if (i === 1) { // L2 court gathered around the beast
    let e = E([[0, 'stern']]); stand(L, 'king', e.P, e.tag, 2.6, 1.7, { f, s: 1.02, facing: -0.2 });
    e = E([[0, 'neutral']]); stand(L, 'boy', e.P, e.tag, 3.2, 2.3, { f, facing: -0.4 });
    e = E([[0, 'wonder']]); stand(L, 'court1', e.P, e.tag, -0.5, 2.2, { f, facing: 0.3 });
    e = E([[0, 'wonder']]); stand(L, 'court2', e.P, e.tag, 0.6, 2.35, { f, facing: 0.2 });
    e = E([[0, 'neutral']]); stand(L, 'court3', e.P, e.tag, 5.6, 2.2, { f, facing: -0.4 });
    e = E([[0, 'smug']]); stand(L, 'strong', e.P, e.tag, -4.3, 1.0, { f, facing: 0.3 });
    e = E([[0, 'smug']]); stand(L, 'strong2', e.P, e.tag, -5.7, 1.4, { f, facing: 0.35 });
  } else if (i === 2) { // L3 balance dragged out, beam snaps
    const dragA = walkAt([[183, -8.6, 0.7], [228, -5.7, 0.7], [290, -5.7, 0.7]], f);
    const dragB = walkAt([[183, -6.4, 1.1], [228, -3.5, 1.1], [290, -3.5, 1.1]], f);
    if (f < 232) {
      side(L, 'strong', 'determined', dragA.x, dragA.z, { f, phase: dragA.phase, mode: dragA.moving ? 'march' : 'stand' });
      side(L, 'strong2', 'determined', dragB.x, dragB.z, { f, phase: dragB.phase, mode: dragB.moving ? 'march' : 'stand' });
    } else {
      let e = E([[232, 'determined'], [SNAP_F, 'shock']]); stand(L, 'strong', e.P, e.tag, -5.7, 0.9, { f, facing: 0.4 });
      e = E([[232, 'determined'], [SNAP_F, 'shock']]); stand(L, 'strong2', e.P, e.tag, -3.3, 2.0, { f, facing: -0.3 });
    }
    let e = E([[0, 'stern']]); stand(L, 'king', e.P, e.tag, 2.9, 1.9, { f, s: 1.02, facing: -0.5 });
    e = E([[0, 'wonder']]); stand(L, 'boy', e.P, e.tag, 1.6, 2.3, { f, facing: -0.5 });
  } else if (i === 3) { // L4 head strongman speaks (dialogue)
    const base = E([[290, 'angry']]);
    stand(L, 'strong', speakP(base.P, f), 'spk' + base.tag, -1.9, 2.8, { f, s: 1.06, facing: 0.25, roll: nodAt(f) });
    let e = E([[0, 'smug']]); stand(L, 'strong2', e.P, e.tag, -4.1, 1.85, { f, facing: 0.4 });
    e = E([[0, 'nervous']]); stand(L, 'boy', e.P, e.tag, 0.5, 3.0, { f, facing: -0.6, y: 0.56 });
    e = E([[0, 'stern']]); stand(L, 'king', e.P, e.tag, 3.3, 1.8, { f, s: 1.02, facing: -0.5 });
  } else if (i === 4) { // L5 court laughs; boy walks to the water
    const laughSq = 0.028 * Math.max(0, Math.sin(f * 0.55));
    let e = E([[0, 'laugh']]); stand(L, 'court1', e.P, e.tag, -0.5, 2.1, { f, squash: laughSq, facing: 0.3 });
    e = E([[0, 'laugh']]); stand(L, 'court2', e.P, e.tag, 1.3, 2.2, { f, squash: laughSq * 0.8, facing: 0.1 });
    e = E([[0, 'laugh']]); stand(L, 'court3', e.P, e.tag, 4.9, 1.9, { f, squash: laughSq, facing: -0.3 });
    e = E([[0, 'smug']]); stand(L, 'strong', e.P, e.tag, -3.4, 1.6, { f, facing: 0.4 });
    e = E([[0, 'laugh']]); stand(L, 'king', e.P, e.tag, 3.0, 1.7, { f, s: 1.02, squash: laughSq * 0.7, facing: -0.3 });
    const bw = walkAt([[421, 3.6, 2.2], [478, 2.1, 2.5], [523, 2.1, 2.5]], f);
    if (bw.moving) side(L, 'boy', 'thinking', bw.x, bw.z, { f, phase: bw.phase, flip: bw.dirX < 0 });
    else { e = E([[0, 'thinking']]); stand(L, 'boy', e.P, e.tag, 2.1, 2.5, { f, facing: 0.4, lookY: 0.2 }); }
  } else if (i === 5) { // L6 boy speaks (dialogue)
    const base = E([[524, 'determined']]);
    stand(L, 'boy', speakP(base.P, f), 'spk' + base.tag, 2.1, 2.5, { f, s: 1.0, facing: 0.3, roll: nodAt(f) });
    let e = E([[0, 'stern']]); stand(L, 'king', e.P, e.tag, 3.1, 1.9, { f, s: 1.02, facing: -0.5 });
    e = E([[0, 'stern']]); stand(L, 'strong', e.P, e.tag, -2.6, 1.8, { f, facing: 0.5 });
    e = E([[0, 'neutral']]); stand(L, 'court1', e.P, e.tag, -0.7, 2.2, { f, facing: 0.4 });
    e = E([[0, 'neutral']]); stand(L, 'court3', e.P, e.tag, 5.1, 2.1, { f, facing: -0.5 });
  } else if (i === 6) { // L7 elephant boards; strongman leads, boy watches
    const lead = walkAt([[639, -0.9, 1.5], [665, 0.5, 2.2], [690, 1.7, 3.0], [712, 2.9, 3.35], [735, 2.9, 3.35]], f);
    if (lead.moving) side(L, 'strong', 'determined', lead.x, lead.z, { f, phase: lead.phase, flip: lead.dirX < 0 });
    else { const e = E([[0, 'determined']]); stand(L, 'strong', e.P, e.tag, 2.9, 3.35, { f, facing: -0.4 }); }
    let e = E([[0, 'wonder']]); stand(L, 'boy', e.P, e.tag, -1.2, 2.35, { f, facing: 0.5 });
    e = E([[0, 'wonder']]); stand(L, 'king', e.P, e.tag, 3.1, 1.8, { f, s: 1.02, facing: -0.4 });
  } else if (i === 7) { // L8 boy paints the line
    let e = E([[0, 'determined']]);
    stand(L, 'boy', e.P, e.tag, 1.55, 4.3, { f, mode: 'kneel1', y: 0.80, yaw: 0.5, prop: ['carve', 0.45], facing: 0.3 });
    e = E([[0, 'neutral']]); stand(L, 'strong', e.P, e.tag, 3.2, 3.5, { f, facing: -0.4 });
    e = E([[0, 'neutral']]); stand(L, 'king', e.P, e.tag, 3.2, 1.8, { f, s: 1.02, facing: -0.3 });
  } else if (i === 8) { // L9 elephant steps off; boat rises
    let e = E([[0, 'smile']]); stand(L, 'boy', e.P, e.tag, -1.7, 2.6, { f, facing: 0.5 });
    e = E([[0, 'determined']]); stand(L, 'strong2', e.P, e.tag, 3.3, 3.45, { f, facing: -0.5 });
    e = E([[0, 'smile']]); stand(L, 'king', e.P, e.tag, 3.2, 1.8, { f, s: 1.02, facing: -0.4 });
    e = E([[0, 'neutral']]); stand(L, 'court2', e.P, e.tag, 4.6, 2.1, { f, facing: -0.5 });
  } else if (i === 9) { // L10 stones loaded, basket after basket
    // carrier trips: strong A out 950-975, B 978-1003, A 1006-1031, B 1034-1059, A 1062-1082
    const trips = [
      ['strong', 950, 975], ['strong2', 978, 1003], ['strong', 1006, 1031],
      ['strong2', 1034, 1059], ['strong', 1062, 1082]];
    for (const [who, t0, t1] of trips) {
      if (f < t0 - 22 || f > t1 + 22) continue;
      const mid = (t0 + t1) / 2;
      const wk = f <= mid
        ? walkAt([[t0 - 22, -0.9, 2.0], [t0, 0.1, 2.3], [mid, 0.95, 2.75]], f)
        : walkAt([[mid, 0.95, 2.75], [t1, 0.1, 2.3], [t1 + 22, -0.9, 2.0]], f);
      const tipping = f > mid - 3 && f < mid + 6;
      side(L, who, 'determined', wk.x, wk.z, { f, phase: wk.phase, mode: wk.moving ? 'march' : 'stand',
        flip: f <= mid ? false : true, overlay: basketOv(tipping ? 0.55 : 0), ov: 'b' + (tipping ? 't' : '') });
    }
    let e = E([[0, 'thinking'], [1030, 'wonder']]); stand(L, 'king', e.P, e.tag, 3.2, 1.8, { f, s: 1.02, facing: -0.4 });
    e = E([[0, 'neutral']]); stand(L, 'boy', e.P, e.tag, 1.9, 2.45, { f, facing: 0.4 });
    e = E([[0, 'neutral']]); stand(L, 'court1', e.P, e.tag, -1.8, 2.2, { f, facing: 0.5 });
  } else if (i === 10) { // L11 POV waterline — no characters, the proof is the hull
  } else if (i === 11 || i === 12) { // L12-13 weighing the stones, load by load
    let e = E([[0, 'determined']]); stand(L, 'strong', e.P, e.tag, 5.9, 2.3, { f, facing: -0.5 });
    const shuttle = walkAt([[1189, -0.9, 2.0], [1233, 3.3, 2.15], [1277, -0.9, 2.0], [1321, 3.3, 2.15], [1365, -0.9, 2.0], [1372, -0.9, 2.0]], f);
    if (i === 11) side(L, 'strong2', 'determined', shuttle.x, shuttle.z, { f, phase: shuttle.phase, mode: shuttle.moving ? 'march' : 'stand', flip: shuttle.dirX < 0, overlay: basketOv(0), ov: 'b' });
    else { e = E([[0, 'sad']]); stand(L, 'strong2', e.P, e.tag, -1.6, 2.1, { f, facing: 0.5 }); }
    e = E([[0, 'proud']]); stand(L, 'boy', e.P, e.tag, 3.2, 2.55, { f, facing: 0.3, prop: ['count', (f % 48) / 48] });
    e = E([[0, 'wonder']]); stand(L, 'king', e.P, e.tag, 2.2, 1.5, { f, s: 1.02, facing: 0.4 });
    e = E([[0, 'wonder']]); stand(L, 'court3', e.P, e.tag, 7.4, 2.0, { f, facing: -0.5 });
  } else if (i === 13) { // L14 the last load settles it
    let e = E([[0, 'determined'], [1405, 'relief']]); stand(L, 'strong', e.P, e.tag, 5.9, 2.3, { f, facing: -0.5 });
    e = E([[0, 'proud']]); stand(L, 'boy', e.P, e.tag, 2.7, 2.6, { f, facing: 0.3 });
    e = E([[0, 'proud'], [1420, 'smile']]); stand(L, 'king', e.P, e.tag, 2.6, 1.9, { f, s: 1.02, facing: -0.2 });
    e = E([[0, 'shock']]); stand(L, 'strong2', e.P, e.tag, -1.6, 2.1, { f, facing: 0.5 });
    e = E([[0, 'wonder']]); stand(L, 'court1', e.P, e.tag, 6.6, 1.7, { f, facing: -0.5 });
  } else if (i === 14) { // L15 king speaks (dialogue)
    const base = E([[1478, 'smile'], [1518, 'stern']]);
    stand(L, 'king', speakP(base.P, f), 'spk' + base.tag, 2.7, 2.5, { f, s: 1.06, facing: -0.15, roll: nodAt(f) });
    let e = E([[0, 'smile']]); stand(L, 'boy', e.P, e.tag, 3.9, 2.6, { f, facing: -0.4 });
    e = E([[1478, 'neutral'], [1525, 'shock'], [1560, 'sad']]); stand(L, 'strong', e.P, e.tag, -1.9, 2.2, { f, facing: 0.5 });
    e = E([[1478, 'neutral'], [1525, 'shock'], [1560, 'sad']]); stand(L, 'strong2', e.P, e.tag, -3.1, 1.9, { f, facing: 0.5 });
  } else if (i === 15) { // L16 mockers carry stones back; boy eats sweets
    const trips = [['strong', 1595, 1645], ['strong2', 1610, 1660], ['strong', 1648, 1695]];
    for (const [who, t0, t1] of trips) {
      if (f < t0 || f > t1) continue;
      const mid = (t0 + t1) / 2;
      const wk = f <= mid
        ? walkAt([[t0, 0.95, 2.75], [mid, -0.9, 2.0]], f)
        : walkAt([[mid, -0.9, 2.0], [t1, 0.95, 2.75]], f);
      side(L, who, 'sad', wk.x, wk.z, { f, phase: wk.phase * 0.8, mode: wk.moving ? 'march' : 'stand',
        flip: f <= mid ? true : false, overlay: f <= mid ? basketOv(0) : undefined, ov: f <= mid ? 'b' : '', stomp: 0.8 });
    }
    let e = E([[0, 'smile']]); stand(L, 'boy', e.P, e.tag, 1.9, 3.1, { f, mode: 'sit', y: 0.56, overlay: sweetsOv, ov: 'sw', facing: 0.2 });
    e = E([[0, 'smile_closed']]); stand(L, 'king', e.P, e.tag, 3.1, 1.7, { f, s: 1.02, facing: -0.3 });
    e = E([[0, 'smile']]); stand(L, 'court2', e.P, e.tag, 4.4, 2.0, { f, facing: -0.4 });
  } else { // L17 hook board grows out of the scene; cast watches, nobody speaks
    let e = E([[0, 'smile']]); stand(L, 'boy', e.P, e.tag, 2.6, 2.5, { f, facing: -0.2 });
    e = E([[0, 'proud']]); stand(L, 'king', e.P, e.tag, 3.6, 1.6, { f, s: 1.02, facing: -0.3 });
    e = E([[0, 'sad']]); stand(L, 'strong', e.P, e.tag, -3.9, 2.2, { f, facing: 0.4 });
    e = E([[0, 'neutral']]); stand(L, 'court1', e.P, e.tag, 5.2, 2.0, { f, facing: -0.4 });
  }
  return L;
}

// ---------- cameras: one smooth move per voice line, cuts on clauses ----------
const CAMS = [
  { p: [[5.4, 3.3, 11.6], [4.8, 3.05, 10.5]], l: [[-1.2, 1.8, 1.2], [-1.2, 1.8, 1.2]] },     // L1 hook
  { p: [[7.8, 4.2, 15.5], [7.2, 3.9, 14.4]], l: [[-0.6, 1.3, 0.8], [-0.6, 1.3, 0.8]] },   // L2
  { p: [[3.0, 3.0, 11.0], [2.6, 2.8, 10.2]], l: [[-4.2, 2.2, 1.0], [-4.2, 2.2, 1.0]] },     // L3
  { p: [[-0.6, 2.4, 7.0], [-0.9, 2.3, 6.4]], l: [[-2.1, 2.0, 2.7], [-2.1, 2.0, 2.7]] },// L4
  { p: [[5.8, 2.7, 10.2], [4.7, 2.5, 9.0]], l: [[2.8, 1.8, 2.4], [2.4, 1.8, 2.45]] },    // L5
  { p: [[4.4, 2.9, 8.8], [4.0, 2.75, 8.0]], l: [[2.0, 1.85, 2.5], [2.0, 1.85, 2.5]] },  // L6
  { p: [[8.6, 2.6, 11.8], [7.9, 2.4, 10.9]], l: [[1.7, 1.2, 4.3], [1.9, 1.2, 4.5]] },    // L7
  { p: [[5.7, 1.8, 10.7], [5.2, 1.65, 10.0]], l: [[2.1, 0.6, 5.6], [2.1, 0.6, 5.6]] },   // L8
  { p: [[-3.9, 2.6, 11.6], [-3.3, 2.4, 10.8]], l: [[1.5, 1.1, 4.4], [1.5, 1.1, 4.4]] },  // L9
  { p: [[7.7, 3.0, 12.7], [7.0, 2.8, 11.8]], l: [[2.1, 1.2, 4.5], [2.1, 1.2, 4.5]] },    // L10
  { p: [[5.3, 0.8, 10.0], [4.95, 0.72, 9.4]], l: [[2.3, 0.1, 6.2], [2.3, 0.1, 6.2]] }, // L11 POV
  { p: [[7.5, 2.6, 7.5], [7.0, 2.45, 6.9]], l: [[4.85, 1.95, 1.7], [4.85, 1.95, 1.7]] }, // L12
  { p: [[1.0, 2.9, 10.4], [0.3, 2.7, 9.6]], l: [[4.0, 1.65, 2.3], [4.0, 1.65, 2.3]] },     // L13
  { p: [[6.9, 2.7, 8.7], [6.3, 2.55, 8.0]], l: [[4.0, 1.8, 2.0], [4.0, 1.8, 2.0]] },   // L14
  { p: [[4.7, 2.4, 6.9], [4.3, 2.3, 6.3]], l: [[2.7, 2.3, 2.5], [2.7, 2.3, 2.5]] },      // L15
  { p: [[8.8, 3.2, 13.8], [8.1, 3.0, 12.9]], l: [[0.4, 1.3, 2.9], [0.4, 1.3, 2.9]] },    // L16
  { p: [[6.0, 3.4, 16.4], [5.3, 3.2, 15.4]], l: [[-0.9, 1.6, 2.9], [-0.9, 1.6, 2.9]] },    // L17
];
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// ---------- captions (Salted Mine style: one word, low-centre) ----------
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

// ---------- per-frame world state ----------
const SUN_A = new THREE.Color(0xfff0d6), SUN_B = new THREE.Color(0xffbe78);
let tallyDrawn = -1;
const ROCK_STEPS = [[947, 0], [960, 4], [985, 8], [1010, 13], [1035, 17], [1060, 22], [1075, 26], [1618, 20], [1648, 14], [1678, 8]];
const boatRockCountAt = (f) => { let n = 0; for (const [ff, cc] of ROCK_STEPS) if (f >= ff) n = cc; return n; };
const pileCountAt = (f) => {
  if (f < 947) return 8;
  if (f < 1083) return Math.max(0, 8 - Math.floor(boatRockCountAt(f) / 3.2));
  if (f < 1583) return 12;
  return Math.min(20, 12 + Math.round((26 - boatRockCountAt(f)) * 0.4));
};
function rocking(f) {
  let r = 0;
  if (f > 935 && f < 1180) r += Math.sin((f - 935) * 0.10) * 0.028 * Math.exp(-(f - 935) / 110);
  if (f >= 947 && f < 1189) r += Math.sin(f * 0.07) * 0.006;
  return r;
}
window.renderFrame = (f) => {
  const i = shotIdx(f);
  // light: daylight all through; L16-17 settle into golden late-day
  const warm = seg(f, 1583, 1700);
  sun.color.copy(SUN_A).lerp(SUN_B, warm);
  sun.intensity = lerp(3.2, 2.75, warm);
  hemi.intensity = lerp(0.35, 0.30, warm);
  scene.backgroundIntensity = lerp(0.95, 0.86, warm);
  scene.environmentIntensity = lerp(0.5, 0.45, warm);
  // elephant
  const E = eleAt(f);
  const gait = E.moving ? Math.abs(Math.sin(f * 0.30)) * 0.045 : 0;
  eleHolder.position.set(E.x, E.y + gait, E.z);
  eleHolder.rotation.set(
    E.moving ? Math.sin(f * 0.30 + 1.2) * 0.008 : 0,
    E.ry,
    E.moving ? Math.sin(f * 0.30) * 0.018 : Math.sin(f * 0.045) * 0.004);
  eleHolder.scale.set(1, E.moving ? 1 : 1 + Math.sin(f * 0.05) * 0.004, 1);
  // boat + painted line + stone load
  const sk = sinkAt(f);
  boat.position.y = BOAT_POS.y - SINK_MAX * sk;
  boat.rotation.z = 0.02 * Math.sin(f * 0.05) * (0.4 + sk) + rocking(f);
  boat.rotation.x = 0.012 * Math.sin(f * 0.037 + 2);
  const stripK = f < 736 ? 0 : seg(f, 745, 795);
  stripMat.opacity = stripK; stripEdge.material.opacity = stripK;
  const brc = boatRockCountAt(f);
  boatRocks.forEach((r, j) => { r.visible = j < brc; });
  const plc = pileCountAt(f);
  pileRocks.forEach((r, j) => { r.visible = j < plc; });
  // plank dips under the elephant's weight mid-crossing
  const onPlank = (f > 688 && f < 714) || (f > 860 && f < 890);
  plankGrp.rotation.x = onPlank ? 0.045 * Math.sin(clamp((f - (f < 800 ? 688 : 860)) / 26, 0, 1) * Math.PI) : 0;
  // big balance: dragged in, tilts under the elephant, beam snaps
  bigBal.visible = f >= 183;
  bigBal.position.set(lerp(-7.5, -4.6, seg(f, 183, 228)), 1.1, 0.6);
  if (f < SNAP_F) {
    beamGrp.rotation.z = -0.30 * seg(f, 222, SNAP_F - 4);
    beamLPiv.rotation.z = 0; beamRPiv.rotation.z = 0; panL.position.y = 0; panR.position.y = 0;
  } else {
    const k = clamp((f - SNAP_F) / 16, 0, 1), ks = sstep(k);
    const bounce = Math.sin(k * Math.PI * 2.2) * (1 - k) * 0.08;
    beamGrp.rotation.z = lerp(-0.30, 0.05, ks);
    beamLPiv.rotation.z = -1.05 * ks + bounce;
    beamRPiv.rotation.z = 0.95 * ks - bounce;
    panL.position.y = -1.55 * sstep(clamp((f - SNAP_F) / 14, 0, 1));
    panR.position.y = -1.35 * sstep(clamp((f - SNAP_F) / 14, 0, 1));
  }
  // small balance: each load tips the beam, weights settle it level
  let tiltS = Math.sin(f * 0.05) * 0.008;
  for (let j = 0; j < LOAD_DONE.length; j++) {
    const D = LOAD_DONE[j], Pj = D - 16;
    tiltS += -0.20 * (seg(f, Pj, Pj + 6) - seg(f, D - 8, D));
  }
  sBeam.rotation.z = tiltS;
  sBeam.userData.loadL.visible = f > LOAD_DONE[0] - 16;
  sBeam.userData.loadR.visible = f > LOAD_DONE[0] - 6;
  const lc = loadCountAt(f);
  if (lc !== tallyDrawn) { drawTally(lc); tallyDrawn = lc; }
  // hook board grows out of the final scene
  hookBoard.visible = f >= 1690;
  if (hookBoard.visible) {
    const g = seg(f, 1696, 1752);
    hookBoard.scale.setScalar(lerp(0.6, 1.0, g));
    hookBoard.position.y = lerp(0.02, 0.42, g);
  }
  // water life + ripple rings on the busy beats
  rippleNrm.offset.set(f * 0.0016, f * 0.0011);
  const ringAct = (f > 660 && f < 745) || (f > 850 && f < 945) || (f > 950 && f < 1085) ? 1 : 0;
  rings.forEach((r, j) => {
    const ph = ((f * 0.9 + j * 30) % 90) / 90;
    const s = 1.2 + ph * 3.4;
    r.scale.set(s, s, 1);
    r.material.opacity = ringAct * (1 - ph) * 0.30;
    r.position.y = 0.03 + boat.position.y * 0.15;
  });
  // dust: elephant's feet while walking; burst when the beam snaps
  for (let j = 0; j < 4; j++) {
    if (E.moving) setPuff(j, E.x + Math.sin(j * 2.4) * 1.1, E.y + 0.18, E.z + Math.cos(j * 1.9) * 0.8,
      0.35 + 0.3 * Math.sin(f * 0.3 + j * 1.7), 0.8);
    else setPuff(j, 0, -5, 0, 0, 0.8);
  }
  for (let j = 0; j < 6; j++) {
    const age = f - SNAP_F;
    if (age >= 0 && age < 24) setPuff(4 + j, -4.6 + Math.cos(j * 1.13) * (0.3 + age * 0.05), 1.35 + (j % 3) * 0.22, 0.6 + Math.sin(j * 1.13) * 0.5,
      1 - age / 24, 1.15);
    else setPuff(4 + j, 0, -5, 0, 0, 1);
  }
  // camera
  const C = CAMS[i], tt = clamp((f - BND[i]) / (BND[i + 1] - BND[i]), 0, 1);
  const cp = lerp3(C.p[0], C.p[1], tt), cl = lerp3(C.l[0], C.l[1], tt);
  camera.position.set(cp[0], cp[1], cp[2]);
  camera.lookAt(cl[0], cl[1], cl[2]);
  camera.updateMatrixWorld();
  // actors (Salted Mine cards)
  drawActors(actorsAt(f));
  // render + caption overlay
  renderer.render(scene, camera);
  drawCaption(f);
  renderer.autoClear = false;
  renderer.render(capScene, fsCam);
  renderer.autoClear = true;
  return true;
};
window.TOTAL = TOTAL;
