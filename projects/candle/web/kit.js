// kit.js — plain three.js port of the LOCKED car-match RealKit system
// (~/workspace/remotion-car-match/src/RealKit.tsx + Scene1Real.tsx V8).
// Same geometry, materials, colours and proportions — no redesign.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export { RoundedBoxGeometry };
export const INK = '#281818';
export const HAIR_HERO = '#452c16';
export const HAIR_GREEN = '#9e5c14';
export const SHIRT_YELLOW = '#f0b400';
export const SHIRT_GREEN = '#3f9e2c';

export function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
export const rng = (seed) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const clamp01 = (v) => Math.min(1, Math.max(0, v));

export const leafTex = () => canvasTex(256, 256, (c, w, h) => {
  const r = rng(99);
  c.clearRect(0, 0, w, h);
  for (let i = 0; i < 1500; i++) {
    const ang = r() * Math.PI * 2;
    const rad = Math.pow(r(), 0.55) * 108;
    const x = 128 + Math.cos(ang) * rad, y = 128 + Math.sin(ang) * rad * 0.94, s = 5 + r() * 9;
    const greens = ['#2c5a24', '#3a6b2c', '#3e6330', '#244f1e', '#466e30'];
    c.fillStyle = greens[Math.floor(r() * greens.length)];
    c.beginPath(); c.ellipse(x, y, s, s * 0.62, r() * 3.2, 0, Math.PI * 2); c.fill();
  }
});
export const cloudTex = () => canvasTex(256, 128, (c) => {
  c.clearRect(0, 0, 256, 128);
  const blob = (x, y, r, a) => {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  };
  blob(128, 76, 60, 0.95); blob(82, 82, 38, 0.85); blob(174, 82, 42, 0.85);
  blob(108, 62, 34, 0.9); blob(150, 64, 30, 0.9); blob(128, 92, 68, 0.5);
});
export const blobTex = () => canvasTex(256, 256, (c) => {
  c.clearRect(0, 0, 256, 256);
  const g = c.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(0,0,0,0.88)'); g.addColorStop(0.55, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.8, 'rgba(0,0,0,0.22)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(0, 0, 256, 256);
});
export const barkTex = () => canvasTex(128, 256, (c, w, h) => {
  c.fillStyle = '#6b4a2e'; c.fillRect(0, 0, w, h);
  const r = rng(7);
  for (let i = 0; i < 260; i++) {
    c.fillStyle = r() > 0.5 ? '#573b22' : '#7d5a38';
    c.fillRect(r() * w, r() * h, 2 + r() * 4, 8 + r() * 26);
  }
});
export const grassTex = () => canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#557f27'; c.fillRect(0, 0, w, h);
  const r = rng(41);
  for (let i = 0; i < 42; i++) {
    const x = r() * w, y = r() * h, rad = 26 + r() * 62;
    const g = c.createRadialGradient(x, y, 0, x, y, rad);
    const dark = r() > 0.5;
    g.addColorStop(0, dark ? 'rgba(38,66,18,0.15)' : 'rgba(168,205,105,0.13)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, rad, 0, Math.PI * 2); c.fill();
  }
  const greens = ['#6f9c38', '#4c7526', '#86b04a', '#5d8a2f', '#97bc58'];
  for (let i = 0; i < 2600; i++) {
    const x = r() * w, y = r() * h, len = 7 + r() * 13;
    c.strokeStyle = greens[Math.floor(r() * greens.length)];
    c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(x, y);
    c.quadraticCurveTo(x + (r() - 0.5) * 3, y - len * 0.6, x + (r() - 0.5) * 5, y - len);
    c.stroke();
  }
});
export const concreteTex = () => canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#ccd1d6'; c.fillRect(0, 0, w, h);
  const r = rng(23);
  for (let i = 0; i < 2400; i++) {
    c.fillStyle = r() > 0.5 ? 'rgba(90,98,106,0.10)' : 'rgba(255,255,255,0.10)';
    c.fillRect(r() * w, r() * h, 1.6, 1.6);
  }
  for (let i = 0; i < 10; i++) {
    const x = r() * w, y = r() * h, rad = 30 + r() * 70;
    const g = c.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, r() > 0.5 ? 'rgba(105,112,120,0.08)' : 'rgba(240,244,248,0.08)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, rad, 0, Math.PI * 2); c.fill();
  }
});
export const sheenTex = () => canvasTex(128, 128, (c, w, h) => {
  c.clearRect(0, 0, w, h);
  const g = c.createLinearGradient(0, 0, w * 0.75, h);
  g.addColorStop(0, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.26)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
});
export const glareTex = () => canvasTex(256, 256, (c) => {
  c.clearRect(0, 0, 256, 256);
  const g = c.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,253,246,0.95)');
  g.addColorStop(0.25, 'rgba(255,250,235,0.60)');
  g.addColorStop(0.55, 'rgba(255,246,224,0.26)');
  g.addColorStop(0.8, 'rgba(255,244,216,0.09)');
  g.addColorStop(1, 'rgba(255,244,214,0)');
  c.fillStyle = g; c.fillRect(0, 0, 256, 256);
});

// ---------------- assets ----------------
export async function loadAssets(base = 'assets/') {
  const gl = new GLTFLoader();
  const car = (await gl.loadAsync(base + 'models/generic_sedan.glb')).scene;
  let tree = null;
  try { tree = (await gl.loadAsync(base + 'models/island_tree_01/island_tree_01_2k.gltf')).scene; }
  catch (e) { console.log('TREE_ERROR ' + e.message); }
  const env = await new RGBELoader().loadAsync(base + 'env/sky.hdr');
  const tl = new THREE.TextureLoader();
  const [map, normalMap, roughnessMap] = await Promise.all([
    tl.loadAsync(base + 'tex/asphalt_diff.jpg'),
    tl.loadAsync(base + 'tex/asphalt_nor.jpg'),
    tl.loadAsync(base + 'tex/asphalt_rough.jpg'),
  ]);
  for (const t of [map, normalMap, roughnessMap]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(24, 24); t.anisotropy = 8;
  }
  map.colorSpace = THREE.SRGBColorSpace;
  let suv = null;
  try { suv = (await gl.loadAsync(base + 'models/suv_boxy.glb')).scene; }
  catch (e) { console.log('SUV_ERROR ' + e.message); }
  const buildGrass = async (url, parts) => {
    try {
      const g = await gl.loadAsync(base + url);
      const scene = g.scene;
      scene.updateMatrixWorld(true);
      const geos = []; let srcTex = null; let idx = 0;
      scene.traverse((o) => {
        if (!o.isMesh) return;
        const mat = o.material;
        if (!srcTex && mat && mat.map) srcTex = mat.map;
        if (parts && !parts.includes(idx)) { idx++; return; }
        idx++;
        const geo = o.geometry.clone(); geo.applyMatrix4(o.matrixWorld); geos.push(geo);
      });
      if (!geos.length || !srcTex) return null;
      const merged = mergeGeometries(geos, false);
      if (!merged) return null;
      const img = srcTex.image;
      const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
      const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0);
      const id = ctx.getImageData(0, 0, cv.width, cv.height); const d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255;
        const lum = (r + gg + b) / 3;
        const green = gg - Math.max(r, b);
        const a = Math.max(0, Math.min(1, (lum * 0.85 + green * 1.6 - 0.045) * 4.0));
        d[i + 3] = Math.round(a * 255);
      }
      ctx.putImageData(id, 0, 0);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      return { geo: merged, tex };
    } catch (e) { console.log('GRASS_ERROR ' + e.message); return null; }
  };
  const grassFull = await buildGrass('models/grass_medium_02/grass_medium_02_2k.gltf', null);
  const grassTuft = await buildGrass('models/grass_medium_01/grass_medium_01_2k.gltf', [3, 4, 5, 11, 12, 13, 14, 15, 16]);
  let grassGround = null;
  try {
    const [gm, gn, gr] = await Promise.all([
      tl.loadAsync(base + 'tex/grass_diff.jpg'),
      tl.loadAsync(base + 'tex/grass_nor.jpg'),
      tl.loadAsync(base + 'tex/grass_rough.jpg'),
    ]);
    for (const t of [gm, gn, gr]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
    gm.colorSpace = THREE.SRGBColorSpace;
    grassGround = { map: gm, normalMap: gn, roughnessMap: gr };
  } catch (e) { console.log('GRASSGROUND_ERROR ' + e.message); }
  return { car, tree, env, asphalt: { map, normalMap, roughnessMap }, suv, grassFull, grassTuft, grassGround };
}

export function applyEnv(scene, renderer, envTex, { fog = '#c9dff0', near = 15, far = 64, intensity = 0.8 } = {}) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  envTex.mapping = THREE.EquirectangularReflectionMapping;
  envTex.colorSpace = THREE.SRGBColorSpace;
  const rt = pmrem.fromEquirectangular(envTex);
  scene.environment = rt.texture;
  scene.environmentIntensity = intensity;
  scene.fog = new THREE.Fog(fog, near, far);
  scene.background = null;
}

// ---------------- car preparation (Scene1Real V8, verbatim logic) ----------------
export function prepareCar(root, paintColor, glassOpacity) {
  for (const n of ['side-mirror-l_70', 'side-mirror-r_71', 'side-mirror-trim-l_72', 'side-mirror-trim-r_73']) {
    const o = root.getObjectByName(n);
    if (o) o.visible = false;
  }
  let dashMat = null, wheelMat = null, cabinMat = null;
  root.updateMatrixWorld(true);
  const rootInv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const classifyInterior = (mesh) => {
    const g = mesh.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const rel = new THREE.Matrix4().multiplyMatrices(rootInv, mesh.matrixWorld);
    const bb = g.boundingBox.clone().applyMatrix4(rel);
    const c = bb.getCenter(new THREE.Vector3());
    const s = bb.getSize(new THREE.Vector3());
    if (s.x > 1.2 && c.z > 0.7) return 'dash';
    if (c.z > 0.55 && c.x > 0.2 && c.y < 0.85 && s.x < 0.3) return 'dash';
    if (c.y > 0.85 && s.x < 0.45 && s.z < 0.3 && c.z > 0.4) return 'wheel';
    return 'cabin';
  };
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    const mat = o.material;
    const name = (mat && mat.name) || '';
    if (name === 'Car_Paint_-_All_Colors') {
      o.material = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(paintColor), metalness: 0.0, roughness: 0.32,
        clearcoat: 1.0, clearcoatRoughness: 0.2, envMapIntensity: 1.05,
      });
    } else if (name === 'interior') {
      const kind = classifyInterior(o);
      if (kind === 'dash') {
        if (!dashMat) { const m = mat.clone(); m.color = new THREE.Color('#1a2230'); m.roughness = 1.0; m.envMapIntensity = 0.2; dashMat = m; }
        o.material = dashMat;
      } else if (kind === 'wheel') {
        if (!wheelMat) { const m = mat.clone(); m.color = new THREE.Color('#3d3d3d'); m.roughness = 0.85; m.envMapIntensity = 0.5; wheelMat = m; }
        o.material = wheelMat;
      } else {
        if (!cabinMat) { const m = mat.clone(); m.color = new THREE.Color('#333333'); m.roughness = 0.95; cabinMat = m; }
        o.material = cabinMat;
      }
    } else if (name === 'MetalStainlessSteelBrushedElongated005_2K') {
      o.material = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#2e3236'), metalness: 0.85, roughness: 0.42, envMapIntensity: 0.9,
      });
    } else if (/^Glass/.test(name) || name === 'Glass_ext') {
      o.material = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#b9d2de'), metalness: 0, roughness: 0.06,
        transparent: true, opacity: glassOpacity, envMapIntensity: 1.15,
        depthWrite: false, side: THREE.DoubleSide,
      });
      o.castShadow = false;
    }
  });
}

export function rescueTailRims(root) {
  const tailMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#b30d38'), emissive: new THREE.Color('#ff2a55'),
    emissiveIntensity: 0.55, roughness: 0.25, clearcoat: 1, envMapIntensity: 0.7,
  });
  const tailTrimMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#3a0d16'), roughness: 0.4, metalness: 0.3 });
  const tailBackMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#4a0a18'), roughness: 0.6 });
  const rimMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#3b8bff'), metalness: 0.55, roughness: 0.38, clearcoat: 0.6, envMapIntensity: 1.35,
  });
  const walk = (o, chain) => {
    if (o.isMesh) {
      const joined = chain.join('/');
      if (/taillight-trim/.test(joined)) o.material = tailTrimMat;
      else if (/taillight-back/.test(joined)) o.material = tailBackMat;
      else if (/taillight/.test(joined)) o.material = tailMat;
      else if (/Wheel\.Bk/.test(joined) && /generic-wheel/.test(joined)) o.material = rimMat;
    }
    o.children.forEach((c) => walk(c, [...chain, o.name || '']));
  };
  walk(root, []);
}

// wheel spin: DEF-Wheel.* pivot nodes of the sedan GLB
export function collectWheels(root) {
  const wheels = [];
  root.traverse((o) => {
    if (/^DEF-Wheel/.test(o.name || '')) wheels.push({ obj: o, q: o.quaternion.clone() });
  });
  return wheels;
}
const _qx = new THREE.Quaternion();
const _xAxis = new THREE.Vector3(1, 0, 0);
export function spinWheels(wheels, angle) {
  _qx.setFromAxisAngle(_xAxis, angle);
  for (const w of wheels) w.obj.quaternion.copy(w.q).multiply(_qx);
}

// ---------------- small pieces ----------------
export function Limb(from, to, r) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const len = a.distanceTo(b);
  const quat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  const m = new THREE.Mesh(
    new THREE.CapsuleGeometry(r, len, 4, 10),
    new THREE.MeshStandardMaterial({ color: INK, roughness: 0.85 }));
  m.position.copy(mid); m.quaternion.copy(quat);
  return m;
}
let _blob = null;
export function ContactShadow(size = [3.1, 6.0], opacity = 0.3, pos = [0.15, 0.015, -0.15]) {
  if (!_blob) _blob = blobTex();
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size[0], size[1]),
    new THREE.MeshBasicMaterial({ map: _blob, transparent: true, opacity, depthWrite: false }));
  m.position.set(...pos); m.rotation.x = -Math.PI / 2; m.renderOrder = 1;
  return m;
}

export function SkyDome(zen = '#a8c6f2', mid = '#c2dcf8', hor = '#e2f1fd') {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {
      cZen: { value: new THREE.Color(zen) },
      cMid: { value: new THREE.Color(mid) },
      cHor: { value: new THREE.Color(hor) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform vec3 cZen; uniform vec3 cMid; uniform vec3 cHor;
      varying vec3 vDir;
      void main() {
        float h = normalize(vDir).y;
        vec3 col = mix(cHor, cMid, smoothstep(0.0, 0.20, h));
        col = mix(col, cZen, smoothstep(0.16, 0.65, h));
        col = mix(cHor, col, smoothstep(-0.10, 0.004, h));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(170, 24, 16), mat);
  m.renderOrder = -10;
  return m;
}
export function Clouds(items) {
  const tex = cloudTex();
  const g = new THREE.Group();
  for (const it of items) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: it.o, depthWrite: false, fog: false }));
    sp.position.set(...it.p); sp.scale.set(it.s[0], it.s[1], 1);
    g.add(sp);
  }
  return g;
}

export function Tree(p, s = 1, seed = 7) {
  const leaf = leafTex(); const bark = barkTex();
  const rnd = rng(seed * 131 + 17);
  const tops = []; const arr = [];
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + rnd() * 0.8;
    const tilt = 0.5 + rnd() * 0.45;
    const len = 0.95 + rnd() * 0.5;
    const dir = new THREE.Vector3(Math.cos(ang) * Math.sin(tilt), Math.cos(tilt), Math.sin(ang) * Math.sin(tilt));
    arr.push({ dir, len });
    tops.push({ pos: [dir.x * len, 1.32 + dir.y * len, dir.z * len], rot: rnd() * 0.6 });
  }
  tops.push({ pos: [0, 2.15, 0], rot: rnd() * 0.6 });
  const up = new THREE.Vector3(0, 1, 0);
  const g = new THREE.Group();
  g.position.set(...p); g.scale.setScalar(s);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.21, 1.6, 7),
    new THREE.MeshStandardMaterial({ map: bark, roughness: 1 }));
  trunk.position.set(0, 0.8, 0); trunk.castShadow = true; g.add(trunk);
  for (const b of arr) {
    const mid = b.dir.clone().multiplyScalar(b.len / 2).add(new THREE.Vector3(0, 1.32, 0));
    const q = new THREE.Quaternion().setFromUnitVectors(up, b.dir.clone().normalize());
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.065, b.len, 5),
      new THREE.MeshStandardMaterial({ map: bark, roughness: 1 }));
    br.position.set(mid.x, mid.y, mid.z); br.quaternion.copy(q); g.add(br);
  }
  for (const t of tops) {
    const tg = new THREE.Group(); tg.position.set(...t.pos);
    for (let k = 0; k < 3; k++) {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(2.05, 2.05),
        new THREE.MeshStandardMaterial({
          map: leaf, color: '#e4efcc', emissive: '#31451f', emissiveIntensity: 0.55,
          alphaTest: 0.42, side: THREE.DoubleSide, roughness: 1,
        }));
      pl.rotation.set(0, (k * Math.PI) / 3 + t.rot, 0);
      tg.add(pl);
    }
    g.add(tg);
  }
  return g;
}
export function Cypress(p, s = 1) {
  const g = new THREE.Group(); g.position.set(...p); g.scale.setScalar(s);
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.8, 6),
    new THREE.MeshStandardMaterial({ color: '#4c3620', roughness: 1 }));
  t.position.set(0, 0.4, 0); g.add(t);
  const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.4, 3.0, 9),
    new THREE.MeshStandardMaterial({ color: '#1c5a28', roughness: 1 }));
  c1.position.set(0, 1.9, 0); g.add(c1);
  const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.27, 1.9, 9),
    new THREE.MeshStandardMaterial({ color: '#22702f', roughness: 1 }));
  c2.position.set(0, 3.1, 0); g.add(c2);
  return g;
}
export function ScannedTree(tree, p, s = 1, rotY = 0) {
  if (!tree) return new THREE.Group();
  const c = tree.clone(true);
  c.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = false; o.receiveShadow = false;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const mm of mats) {
        if (mm && mm.name === 'island_tree_01_leaves') {
          mm.emissive = new THREE.Color('#2e3d24'); mm.emissiveIntensity = 1.0;
        }
      }
    }
  });
  c.position.set(...p);
  const sc = Array.isArray(s) ? s : [s, s, s];
  c.scale.set(...sc); c.rotation.y = rotY;
  return c;
}
export function Hedge(p, seed = 3) {
  const leaf = leafTex();
  const rnd = rng(seed * 57 + 11);
  const rots = [rnd() * 0.7, rnd() * 0.7, rnd() * 0.7];
  const g = new THREE.Group(); g.position.set(...p);
  rots.forEach((r, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.7),
      new THREE.MeshStandardMaterial({
        map: leaf, color: '#e4efcc', emissive: '#31451f', emissiveIntensity: 0.55,
        alphaTest: 0.42, side: THREE.DoubleSide, roughness: 1,
      }));
    m.position.set(0, 0.85, 0); m.rotation.set(0, (k * Math.PI) / 3 + r, 0);
    g.add(m);
  });
  return g;
}

// ---------------- faces & heads ----------------
export function makeFaceTex(expr) {
  return canvasTex(512, 400, (c) => {
    c.clearRect(0, 0, 512, 400);
    c.strokeStyle = INK; c.fillStyle = INK; c.lineCap = 'round';
    const brow = (x0, y0, x1, y1, w = 30, bend = 7) => {
      c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0);
      c.quadraticCurveTo((x0 + x1) / 2, Math.min(y0, y1) - bend, x1, y1); c.stroke();
    };
    const nose = (x = 260, y = 214, s = 1) => {
      c.lineWidth = 13 * s; c.beginPath(); c.moveTo(x, y);
      c.quadraticCurveTo(x + 18 * s, y + 23 * s, x - 6 * s, y + 35 * s); c.stroke();
    };
    const ringEye = (ex, ey, r, px = 0, py = 0) => {
      c.lineWidth = 11; c.beginPath(); c.arc(ex, ey, r, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.arc(ex + px, ey + py, r * 0.30, 0, Math.PI * 2); c.fill();
    };
    if (expr === 'smug' || expr === 'smugTired') {
      brow(112, 108, 228, 126); brow(284, 126, 400, 108);
      for (const ex of [170, 342]) {
        c.beginPath();
        c.ellipse(ex - 15, expr === 'smugTired' ? 204 : 198, 36, expr === 'smugTired' ? 12 : 16, 0, 0, Math.PI * 2);
        c.fill();
        c.lineWidth = expr === 'smugTired' ? 24 : 18;
        c.beginPath(); c.moveTo(ex - 52, 179);
        c.quadraticCurveTo(ex, 166, ex + 52, 175); c.stroke();
      }
      nose();
      c.lineWidth = 23; c.beginPath();
      if (expr === 'smug') {
        c.moveTo(192, 292); c.quadraticCurveTo(262, 306, 330, 262); c.stroke();
        c.lineWidth = 19; c.beginPath(); c.moveTo(330, 262); c.lineTo(346, 246); c.stroke();
      } else {
        c.moveTo(216, 296); c.quadraticCurveTo(262, 304, 308, 278); c.stroke();
      }
    } else if (expr === 'smugGlasses') {
      brow(116, 96, 224, 110, 26, 10); brow(288, 110, 396, 96, 26, 10);
      nose(258, 222);
      c.lineWidth = 22; c.beginPath();
      c.moveTo(198, 296); c.quadraticCurveTo(262, 308, 322, 268); c.stroke();
      c.lineWidth = 18; c.beginPath(); c.moveTo(322, 268); c.lineTo(336, 254); c.stroke();
    } else if (expr === 'shocked') {
      brow(118, 62, 222, 52, 26, 30); brow(290, 52, 394, 62, 26, 30);
      ringEye(168, 184, 41, -6, -8); ringEye(344, 184, 41, -6, -8);
      nose(258, 226, 0.8);
      c.lineWidth = 12; c.fillStyle = '#ffffff';
      c.beginPath(); c.roundRect(196, 260, 124, 58, 12); c.fill();
      c.strokeStyle = INK; c.stroke();
      c.lineWidth = 7;
      for (const gx of [227, 258, 289]) { c.beginPath(); c.moveTo(gx, 262); c.lineTo(gx, 316); c.stroke(); }
      c.beginPath(); c.moveTo(198, 289); c.lineTo(318, 289); c.stroke();
      c.fillStyle = INK;
    } else if (expr === 'worried') {
      brow(116, 100, 224, 64, 27, 24); brow(288, 64, 396, 100, 27, 24);
      ringEye(170, 190, 37, 0, -2); ringEye(342, 190, 37, 0, -2);
      nose(258, 230, 0.8);
      c.lineWidth = 13; c.beginPath();
      c.moveTo(228, 300); c.quadraticCurveTo(242, 292, 256, 300);
      c.quadraticCurveTo(270, 308, 284, 300); c.stroke();
    } else if (expr === 'laughCry') {
      brow(120, 84, 224, 74, 24, 18); brow(288, 74, 392, 84, 24, 18);
      c.lineWidth = 24;
      c.beginPath(); c.moveTo(124, 164); c.lineTo(190, 194); c.lineTo(124, 224); c.stroke();
      c.beginPath(); c.moveTo(388, 164); c.lineTo(322, 194); c.lineTo(388, 224); c.stroke();
      nose(258, 228, 0.85);
      c.fillStyle = '#6e2434';
      c.beginPath(); c.ellipse(256, 296, 64, 54, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#c25b6e';
      c.beginPath(); c.ellipse(256, 324, 40, 20, 0, 0, Math.PI); c.fill();
      c.fillStyle = '#ffffff'; c.fillRect(202, 250, 108, 16);
      c.fillStyle = INK;
    } else { // angry
      brow(114, 84, 228, 130, 36, 2); brow(284, 130, 398, 84, 36, 2);
      for (const ex of [170, 342]) {
        c.beginPath(); c.ellipse(ex, 198, 31, 16, 0, 0, Math.PI * 2); c.fill();
        c.lineWidth = 15; c.beginPath(); c.moveTo(ex - 36, 184); c.lineTo(ex + 36, 188); c.stroke();
      }
      nose(258, 228, 0.85);
      c.lineWidth = 19; c.beginPath();
      c.moveTo(218, 300); c.quadraticCurveTo(256, 284, 294, 300); c.stroke();
    }
  });
}
function SweatDrop(side) {
  const g = new THREE.Group();
  g.position.set(0.40 * side, 0.30, 0.16); g.rotation.set(0, 0, -0.25 * side);
  const inkMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  const dropMat = new THREE.MeshStandardMaterial({ color: '#a9d9f2', roughness: 0.25, emissive: '#7fb8dd', emissiveIntensity: 0.35 });
  const s1 = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), inkMat); s1.scale.set(0.055, 0.091, 0.034); g.add(s1);
  const s2 = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), dropMat); s2.scale.set(0.045, 0.075, 0.028); g.add(s2);
  const s3 = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), inkMat); s3.position.set(0, 0.062, 0); s3.scale.set(0.034, 0.055, 0.024); g.add(s3);
  const s4 = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), dropMat); s4.position.set(0, 0.062, 0); s4.scale.set(0.028, 0.045, 0.02); g.add(s4);
  return g;
}
function hairCapGeometry(theta0, dip) {
  const NX = 56, NY = 16;
  const pos = [], col = [], idx = [];
  for (let iy = 0; iy <= NY; iy++) {
    const t = iy / NY;
    for (let ix = 0; ix <= NX; ix++) {
      const phi = (ix / NX) * Math.PI * 2;
      const thE = theta0 + dip * (0.5 - 0.5 * Math.cos(phi));
      const th = t * thE;
      const s = Math.sin(th);
      pos.push(0.5 * s * Math.sin(phi), 0.5 * Math.cos(th), 0.5 * s * Math.cos(phi));
      const band = Math.exp(-Math.pow((th - 0.55) / 0.4, 2));
      const front = 0.35 + 0.65 * Math.pow(Math.max(0, Math.cos(phi)), 1.5);
      const shade = 1 + 0.3 * band * front - 0.1 * clamp01((t - 0.82) / 0.18);
      col.push(shade, shade, shade);
    }
  }
  for (let iy = 0; iy < NY; iy++) for (let ix = 0; ix < NX; ix++) {
    const a = iy * (NX + 1) + ix, b = a + 1, c = a + NX + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function torsoGeometry(w, h) {
  const N = 48; const pts = [];
  const E = 2 / 2.6;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const c = Math.cos(a), s = Math.sin(a);
    const px = Math.sign(c) * Math.pow(Math.abs(c), E);
    const py = Math.sign(s) * Math.pow(Math.abs(s), E);
    const taper = 0.84 + 0.16 * (0.5 - 0.5 * py);
    pts.push(new THREE.Vector2(px * (w / 2 - 0.05) * taper, py * (h / 2 - 0.05)));
  }
  const shape = new THREE.Shape(pts);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.24, bevelEnabled: true, bevelThickness: 0.055, bevelSize: 0.05, bevelSegments: 3, steps: 1,
  });
  geo.translate(0, 0, -0.12);
  const p = geo.attributes.position;
  const colors = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const t = y / (h / 2);
    const shade = 1 - 0.14 * clamp01((-t - 0.05) / 0.95) - 0.07 * clamp01((Math.abs(x) / (w / 2) - 0.55) / 0.45);
    colors[i * 3] = shade; colors[i * 3 + 1] = shade; colors[i * 3 + 2] = shade;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}
export function CharHead({ expr, hair = HAIR_HERO, glasses = null, sweat = null, hairTheta = 1.56, hairDip = 0.34 } = {}) {
  const g = new THREE.Group();
  const face = makeFaceTex(expr);
  const beanGeo = new THREE.SphereGeometry(0.5, 48, 32);
  {
    const p = beanGeo.attributes.position;
    const colors = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) / 0.5, y = p.getY(i) / 0.5;
      const shade = 1 - 0.06 * clamp01((-y - 0.3) / 0.7) - 0.04 * clamp01((Math.abs(x) - 0.78) / 0.22);
      colors[i * 3] = shade; colors[i * 3 + 1] = shade; colors[i * 3 + 2] = shade;
    }
    beanGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
  const hull = new THREE.Mesh(new THREE.SphereGeometry(0.5, 48, 32),
    new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }));
  hull.scale.set(1.065, 0.938, 0.7); g.add(hull);
  const bean = new THREE.Mesh(beanGeo, new THREE.MeshStandardMaterial({
    color: '#fff6ea', roughness: 0.55, emissive: '#ffe9c9', emissiveIntensity: 0.75, envMapIntensity: 0.35, vertexColors: true,
  }));
  bean.scale.set(1.0, 0.877, 0.641); g.add(bean);
  const cap = new THREE.Mesh(hairCapGeometry(hairTheta, hairDip), new THREE.MeshStandardMaterial({
    color: hair, roughness: 0.62, side: THREE.DoubleSide, vertexColors: true,
  }));
  cap.scale.set(1.028, 0.905, 0.669); cap.rotation.set(-0.05, 0, -0.13); g.add(cap);
  const faceMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.339, 0.339, 0.61, 32, 1, true, -0.62, 1.24),
    new THREE.MeshStandardMaterial({ map: face, transparent: true, roughness: 0.8, alphaTest: 0.02 }));
  faceMesh.position.set(0, 0.008, 0); g.add(faceMesh);
  if (glasses === 'dark') {
    const gg = new THREE.Group(); gg.position.set(0, 0.03, 0); gg.rotation.set(-0.05, 0, 0);
    for (const x of [-0.165, 0.165]) {
      const lg = new THREE.Group(); lg.position.set(x, 0, 0);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.02, 24),
        new THREE.MeshStandardMaterial({ color: INK, roughness: 0.6 }));
      rim.position.set(0, 0, 0.298); rim.rotation.set(Math.PI / 2, 0, 0); rim.scale.set(1.45, 1, 0.95); lg.add(rim);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.02, 24),
        new THREE.MeshStandardMaterial({ color: '#9aa7b1', roughness: 0.18, metalness: 0.3, transparent: true, opacity: 0.82 }));
      lens.position.set(0, 0, 0.312); lens.rotation.set(Math.PI / 2, 0, 0); lens.scale.set(1.42, 1, 0.92); lg.add(lens);
      gg.add(lg);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.026, 0.026),
      new THREE.MeshStandardMaterial({ color: INK, roughness: 0.6 }));
    bridge.position.set(0, 0.02, 0.306); gg.add(bridge);
    g.add(gg);
  }
  if (glasses === 'gold') {
    const gg = new THREE.Group(); gg.position.set(0, 0.27, 0.26); gg.rotation.set(-0.5, 0, -0.04); gg.scale.setScalar(1.15);
    for (const x of [-0.15, 0.15]) {
      const lg = new THREE.Group(); lg.position.set(x, 0, 0);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.093, 0.009, 8, 28),
        new THREE.MeshStandardMaterial({ color: '#e8d194', metalness: 0.75, roughness: 0.3 }));
      ring.scale.set(1.35, 0.95, 1); lg.add(ring);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.088, 24),
        new THREE.MeshStandardMaterial({ color: '#d7dee2', transparent: true, opacity: 0.16, roughness: 0.12, metalness: 0.1, side: THREE.DoubleSide }));
      lens.scale.set(1.35, 0.95, 1); lg.add(lens);
      gg.add(lg);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.012, 0.012),
      new THREE.MeshStandardMaterial({ color: '#e8d194', metalness: 0.75, roughness: 0.3 }));
    bridge.position.set(0, 0.01, 0); gg.add(bridge);
    g.add(gg);
  }
  if (sweat) g.add(SweatDrop(sweat));
  return g;
}
export function Torso({ shirt, w = 0.651, h = 0.712, buttons = false } = {}) {
  const W = w * 1.05, H = h * 1.04;
  const geo = torsoGeometry(W, H);
  const g = new THREE.Group();
  const hull = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }));
  hull.scale.set(1.05, 1.045, 1.09); g.add(hull);
  const body = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.7, vertexColors: true }));
  g.add(body);
  if (buttons) for (const fy of [0.16, 0.02]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.016, 12),
      new THREE.MeshStandardMaterial({ color: INK, roughness: 0.7 }));
    b.position.set(0, fy * H, 0.174); b.rotation.set(Math.PI / 2, 0, 0); g.add(b);
  }
  return g;
}
export function RedPanel(w = 1.08, h = 0.62) {
  const geo = new RoundedBoxGeometry(w, h, 0.07, 3, 0.03);
  const g = new THREE.Group();
  const body = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({
    color: '#7d130c', metalness: 0, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.25, envMapIntensity: 0.9,
  }));
  g.add(body);
  const s1 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.55, 0.035, 0.012),
    new THREE.MeshStandardMaterial({ color: '#7d0f0a', roughness: 0.5 }));
  s1.position.set(0, h * 0.22, 0.045); g.add(s1);
  const s2 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, 0.028, 0.012),
    new THREE.MeshStandardMaterial({ color: '#8f130c', roughness: 0.5 }));
  s2.position.set(0, -h * 0.30, 0.045); g.add(s2);
  return g;
}

// StandingFigure — returns group; userData.head / userData.body for animation.
export function StandingFigure(o) {
  const {
    u, shirt, expr, hair, glasses = null, sweat = null,
    pose = 'crossed', holdY = 1.16, footSpread = 0.07, headTiltZ = 0,
    hairTheta, hairDip, panelW = 1.08, panelH = 0.62, panelDx = 0, stretchY = 1,
  } = o;
  const s = (v) => v * u;
  const P = (p) => [p[0] * u, p[1] * u, p[2] * u];
  const dip = hairDip ?? ((expr === 'shocked' || expr === 'worried') ? 0.45 : 0.3);
  const g = new THREE.Group();
  const body = new THREE.Group(); body.scale.set(1, stretchY, 1); g.add(body);
  body.add(Limb(P([-0.103, 1.0, 0]), P([-footSpread, 0.07, 0.01]), s(0.0275)));
  body.add(Limb(P([0.103, 1.0, 0]), P([footSpread, 0.07, 0.01]), s(0.0275)));
  for (const sx of [1, -1]) {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(s(0.103), s(0.031), s(0.048)),
      new THREE.MeshStandardMaterial({ color: INK, roughness: 0.85 }));
    foot.position.set(...P([sx * footSpread + sx * 0.03, 0.03, 0.05]));
    foot.rotation.set(0, sx * 0.5, 0); body.add(foot);
  }
  const torsoG = new THREE.Group(); torsoG.position.set(...P([0, 1.308, 0])); torsoG.scale.setScalar(u);
  torsoG.add(Torso({ shirt, buttons: pose === 'crossed' }));
  body.add(torsoG);
  const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, s(0.085), 24),
    new THREE.MeshStandardMaterial({ color: pose === 'crossed' ? '#e8e4da' : '#503018', roughness: 0.85 }));
  waist.position.set(...P([0, 0.972, 0])); waist.scale.set(s(0.54), 1, s(0.37)); body.add(waist);
  if (pose === 'crossed') {
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(s(0.075), s(0.048), s(0.02)),
      new THREE.MeshStandardMaterial({ color: '#3a3a3a', roughness: 0.6 }));
    buckle.position.set(...P([0, 0.972, 0.183])); body.add(buckle);
    const mk = (x0, y0, x1, y1, zc) => new THREE.TubeGeometry(
      new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(x0 * u, y0 * u, 0.15 * u),
        new THREE.Vector3(0, ((y0 + y1) / 2 - 0.035) * u, zc * u),
        new THREE.Vector3(x1 * u, y1 * u, 0.155 * u)), 20, 0.043 * u, 10);
    const bandMat = new THREE.MeshStandardMaterial({ color: INK, roughness: 0.85 });
    body.add(new THREE.Mesh(mk(-0.295, 1.415, 0.285, 1.275, 0.235), bandMat));
    body.add(new THREE.Mesh(mk(0.295, 1.445, -0.285, 1.305, 0.215), bandMat));
    for (const [hx, hy] of [[-0.295, 1.415], [0.285, 1.275], [0.295, 1.445], [-0.285, 1.305]]) {
      const hand = new THREE.Mesh(new THREE.SphereGeometry(s(0.06), 18, 12), bandMat);
      hand.position.set(...P([hx, hy, 0.15])); body.add(hand);
    }
  } else if (pose === 'holdSide') {
    body.add(Limb(P([-0.27, 1.47, 0.02]), P([-0.44, holdY + 0.14, 0.16]), s(0.029)));
    body.add(Limb(P([-0.44, holdY + 0.14, 0.16]), P([-0.60, holdY + 0.03, 0.28]), s(0.029)));
    body.add(Limb(P([0.27, 1.47, 0.02]), P([-0.30, holdY + 0.02, 0.18]), s(0.029)));
    body.add(Limb(P([-0.30, holdY + 0.02, 0.18]), P([-0.63, holdY - 0.20, 0.28]), s(0.029)));
    const handMat = new THREE.MeshStandardMaterial({ color: INK, roughness: 0.85 });
    for (const h of [P([-0.61, holdY + 0.04, 0.30]), P([-0.64, holdY - 0.21, 0.30])]) {
      const hand = new THREE.Mesh(new THREE.SphereGeometry(s(0.062), 18, 12), handMat);
      hand.position.set(...h); body.add(hand);
    }
    const pg = new THREE.Group();
    pg.position.set(...P([-0.63 - panelW / 2 + 0.06 + panelDx, holdY - 0.08, 0.27]));
    pg.rotation.set(0, 0.38, -0.05);
    pg.add(RedPanel(s(panelW), s(panelH)));
    body.add(pg);
    g.userData.panel = pg;
  } else { // hold
    body.add(Limb(P([-0.27, 1.47, 0.02]), P([-0.37, (1.47 + holdY) / 2, 0.22]), s(0.029)));
    body.add(Limb(P([-0.37, (1.47 + holdY) / 2, 0.22]), P([-0.33, holdY, 0.44]), s(0.029)));
    body.add(Limb(P([0.27, 1.47, 0.02]), P([0.37, (1.47 + holdY) / 2, 0.22]), s(0.029)));
    body.add(Limb(P([0.37, (1.47 + holdY) / 2, 0.22]), P([0.33, holdY, 0.44]), s(0.029)));
    const handMat = new THREE.MeshStandardMaterial({ color: INK, roughness: 0.85 });
    for (const h of [P([-0.33, holdY, 0.46]), P([0.33, holdY, 0.46])]) {
      const hand = new THREE.Mesh(new THREE.SphereGeometry(s(0.062), 18, 12), handMat);
      hand.position.set(...h); body.add(hand);
    }
    const pg = new THREE.Group();
    pg.position.set(...P([0, holdY - panelH / 2 - 0.02, 0.47]));
    pg.add(RedPanel(s(panelW), s(panelH)));
    body.add(pg);
    g.userData.panel = pg;
  }
  const headG = new THREE.Group();
  headG.position.set(...P([0, 2.058 * stretchY, 0]));
  headG.rotation.set(0, 0, headTiltZ);
  headG.scale.setScalar(u);
  headG.add(CharHead({ expr, hair, glasses, sweat, hairTheta, hairDip: dip }));
  g.add(headG);
  g.add(ContactShadow([s(1.7), s(1.7)], 0.32, [0, 0.012, 0.05]));
  g.userData.head = headG;
  g.userData.body = body;
  return g;
}

// SeatedFigure — userData.head for animation.
export function SeatedFigure(o) {
  const {
    u, expr, hair, sweat = null, recline = 0.52, legSpread = 0.16, legLen = 1.0,
    torsoH = 0.88, hairTheta, headYaw = 0, torsoLong = 1, bodyShiftZ = 0, headDx = 0, headDy = 0,
  } = o;
  const s = (v) => v * u;
  const P = (p) => [p[0] * u, p[1] * u, p[2] * u];
  const tLen = 0.92;
  const shY = 0.16 + tLen * Math.cos(recline);
  const shZ = -tLen * Math.sin(recline);
  const g = new THREE.Group();
  g.add(Limb(P([-0.09, 0.10, 0.06 + bodyShiftZ]), P([-legSpread, 0.05, 1.02 * legLen + bodyShiftZ]), s(0.0275)));
  g.add(Limb(P([0.09, 0.10, 0.06 + bodyShiftZ]), P([legSpread + 0.05, 0.05, 0.94 * legLen + bodyShiftZ]), s(0.0275)));
  const footMat = new THREE.MeshStandardMaterial({ color: INK, roughness: 0.85 });
  const f1 = new THREE.Mesh(new THREE.BoxGeometry(s(0.103), s(0.031), s(0.048)), footMat);
  f1.position.set(...P([-legSpread - 0.02, 0.035, 1.10 * legLen + bodyShiftZ])); f1.rotation.set(0, 0.35, 0); g.add(f1);
  const f2 = new THREE.Mesh(new THREE.BoxGeometry(s(0.103), s(0.031), s(0.048)), footMat);
  f2.position.set(...P([legSpread + 0.07, 0.035, 1.01 * legLen + bodyShiftZ])); f2.rotation.set(0, -0.3, 0); g.add(f2);
  const t1 = new THREE.Mesh(new THREE.BoxGeometry(s(0.03), s(0.028), s(0.085)), footMat);
  t1.position.set(...P([-legSpread - 0.03, 0.055, 1.155 * legLen + bodyShiftZ])); t1.rotation.set(-0.7, 0.35, 0); g.add(t1);
  const t2 = new THREE.Mesh(new THREE.BoxGeometry(s(0.03), s(0.028), s(0.085)), footMat);
  t2.position.set(...P([legSpread + 0.08, 0.055, 1.065 * legLen + bodyShiftZ])); t2.rotation.set(-0.7, -0.3, 0); g.add(t2);
  const torsoG = new THREE.Group();
  torsoG.position.set(...P([0, 0.16 + (tLen / 2) * Math.cos(recline), -(tLen / 2) * Math.sin(recline) + bodyShiftZ]));
  torsoG.rotation.set(recline, 0, 0); torsoG.scale.setScalar(u);
  const inner = new THREE.Group(); inner.scale.set(1 / Math.sqrt(torsoLong), torsoLong, 1);
  inner.add(Torso({ shirt: SHIRT_YELLOW, w: 0.72, h: torsoH, buttons: true }));
  torsoG.add(inner); g.add(torsoG);
  g.add(Limb(P([-0.28, shY, shZ + bodyShiftZ]), P([-0.55, 0.05, shZ + bodyShiftZ - 0.28]), s(0.029)));
  const handMat = new THREE.MeshStandardMaterial({ color: INK, roughness: 0.85 });
  const h1 = new THREE.Mesh(new THREE.SphereGeometry(s(0.062), 18, 12), handMat);
  h1.position.set(...P([-0.56, 0.045, shZ + bodyShiftZ - 0.30])); g.add(h1);
  g.add(Limb(P([0.28, shY, shZ + bodyShiftZ]), P([0.50, 0.30, -0.10 + bodyShiftZ]), s(0.029)));
  const h2 = new THREE.Mesh(new THREE.SphereGeometry(s(0.062), 18, 12), handMat);
  h2.position.set(...P([0.51, 0.28, -0.11 + bodyShiftZ])); g.add(h2);
  const headG = new THREE.Group();
  headG.position.set(...P([headDx, shY + 0.58 + headDy, shZ + 0.26]));
  headG.rotation.set(0.18, headYaw, 0.06); headG.scale.setScalar(u);
  headG.add(CharHead({ expr, hair, sweat, hairTheta, hairDip: 0.38 }));
  g.add(headG);
  g.add(ContactShadow([s(1.9), s(2.6)], 0.34, [0, 0.012, s(0.35 + bodyShiftZ * 0.6)]));
  g.userData.head = headG;
  return g;
}

// ---------------- props ----------------
export function House({ p, w = 5, h = 2.8, d = 4.2, wall = '#eef0ee', roof = '#8a6a4e', rotY = 0 }) {
  const g = new THREE.Group(); g.position.set(...p); g.rotation.y = rotY;
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 - 0.25, 0); shape.lineTo(w / 2 + 0.25, 0); shape.lineTo(0, h * 0.52); shape.closePath();
  const roofGeo = new THREE.ExtrudeGeometry(shape, { depth: d + 0.4, bevelEnabled: false });
  roofGeo.translate(0, 0, -(d + 0.4) / 2);
  const wallMat = (() => {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256;
    const c2 = cv.getContext('2d');
    c2.fillStyle = wall; c2.fillRect(0, 0, 256, 256);
    c2.fillStyle = 'rgba(90,100,110,0.32)';
    for (let y = 24; y < 256; y += 26) c2.fillRect(0, y, 256, 3);
    c2.fillStyle = 'rgba(255,255,255,0.18)';
    for (let y = 27; y < 256; y += 26) c2.fillRect(0, y, 256, 2);
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1.2); t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 });
  })();
  const roofMat = (() => {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256;
    const c2 = cv.getContext('2d');
    c2.fillStyle = roof; c2.fillRect(0, 0, 256, 256);
    for (let y = 0, row = 0; y < 256; y += 22, row++) {
      c2.fillStyle = 'rgba(40,26,16,0.28)'; c2.fillRect(0, y, 256, 3);
      c2.fillStyle = 'rgba(255,255,255,0.10)'; c2.fillRect(0, y + 3, 256, 2);
      c2.fillStyle = 'rgba(40,26,16,0.16)';
      for (let x = (row % 2) * 32; x < 256; x += 64) c2.fillRect(x, y, 2, 22);
    }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 1.6); t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.92 });
  })();
  const bodyM = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
  bodyM.position.set(0, h / 2, 0); bodyM.castShadow = true; bodyM.receiveShadow = true; g.add(bodyM);
  const roofM = new THREE.Mesh(roofGeo, roofMat);
  roofM.position.set(0, h, 0); roofM.castShadow = true; roofM.receiveShadow = true; g.add(roofM);
  for (const [x, y] of [[-w * 0.28, h * 0.52], [w * 0.26, h * 0.52]]) {
    const wg = new THREE.Group(); wg.position.set(x, y, d / 2 + 0.012);
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.17, h * 0.30),
      new THREE.MeshStandardMaterial({ color: '#f4f6f8', roughness: 0.8 }));
    wg.add(frame);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.15, h * 0.26),
      new THREE.MeshPhysicalMaterial({ color: '#9fb6c4', roughness: 0.08, metalness: 0.1, envMapIntensity: 1.25 }));
    pane.position.z = 0.012; wg.add(pane);
    const mull1 = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.15, 0.022),
      new THREE.MeshStandardMaterial({ color: '#f4f6f8', roughness: 0.8 }));
    mull1.position.z = 0.02; wg.add(mull1);
    const mull2 = new THREE.Mesh(new THREE.PlaneGeometry(0.022, h * 0.26),
      new THREE.MeshStandardMaterial({ color: '#f4f6f8', roughness: 0.8 }));
    mull2.position.z = 0.02; wg.add(mull2);
    g.add(wg);
  }
  const door = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.13, h * 0.58),
    new THREE.MeshStandardMaterial({ color: '#5a4632', roughness: 0.85 }));
  door.position.set(w * 0.02, h * 0.30, d / 2 + 0.012); g.add(door);
  return g;
}
export function HighwayWall({ p, len = 90, h = 2.6, rotY = 0 }) {
  const g = new THREE.Group(); g.position.set(...p); g.rotation.y = rotY;
  const wallMat = (() => {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
    const c2 = cv.getContext('2d');
    c2.fillStyle = '#ddd6c2'; c2.fillRect(0, 0, 512, 128);
    for (let px = 0; px < 4; px++) {
      c2.fillStyle = px % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(80,70,50,0.04)';
      c2.fillRect(px * 128, 0, 128, 128);
      c2.fillStyle = 'rgba(110,100,78,0.55)'; c2.fillRect(px * 128, 0, 3, 128);
      c2.fillStyle = 'rgba(255,255,255,0.35)'; c2.fillRect(px * 128 + 3, 0, 1, 128);
    }
    c2.fillStyle = 'rgba(110,100,78,0.30)'; c2.fillRect(0, 62, 512, 2);
    const grad = c2.createLinearGradient(0, 100, 0, 128);
    grad.addColorStop(0, 'rgba(105,95,70,0)'); grad.addColorStop(1, 'rgba(105,95,70,0.20)');
    c2.fillStyle = grad; c2.fillRect(0, 100, 512, 28);
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(Math.max(1, Math.round(len / 18)), 1); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 });
  })();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(len, h, 0.18), wallMat);
  wall.position.set(0, h / 2 + 0.15, 0); wall.receiveShadow = true; g.add(wall);
  const capM = new THREE.Mesh(new THREE.BoxGeometry(len, 0.14, 0.24),
    new THREE.MeshStandardMaterial({ color: '#c9c0aa', roughness: 0.95 }));
  capM.position.set(0, h + 0.32, 0); g.add(capM);
  for (let i = 0; i <= Math.floor(len / 4.5); i++) {
    const x = -len / 2 + i * 4.5;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, h + 0.3, 0.12),
      new THREE.MeshStandardMaterial({ color: '#b7ae97', roughness: 0.95 }));
    post.position.set(x, (h + 0.3) / 2, -0.14); g.add(post);
  }
  return g;
}
export function PowerPole(p, s = 1) {
  const g = new THREE.Group(); g.position.set(...p); g.scale.setScalar(s);
  const mat = new THREE.MeshStandardMaterial({ color: '#4c3a26', roughness: 1 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.10, 6.8, 7), mat);
  pole.position.set(0, 3.4, 0); g.add(pole);
  const b1 = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 0.12), mat);
  b1.position.set(0, 6.2, 0); g.add(b1);
  const b2 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.10, 0.10), mat);
  b2.position.set(0, 5.6, 0); g.add(b2);
  return g;
}

// ---------------- SUV (HARD PASS GLB + furniture) ----------------
export function prepareSUV(root, paintColor, glassColor, glassOpacity, interiorColor = '#22262c') {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    const mat = o.material;
    const name = (mat && mat.name) || '';
    if (/^paint/.test(name)) {
      o.material = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(paintColor), metalness: 0, roughness: 0.32,
        clearcoat: 1, clearcoatRoughness: 0.2, envMapIntensity: 1.05,
      });
    } else if (name === 'glass') {
      o.userData.isGlass = true;
      o.material = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(glassColor), metalness: 0, roughness: 0.3,
        transparent: true, opacity: glassOpacity, envMapIntensity: 0.5,
        depthWrite: false, side: THREE.DoubleSide,
      });
      o.castShadow = false;
    } else if (name === 'interior') {
      o.material = new THREE.MeshStandardMaterial({ color: new THREE.Color(interiorColor), roughness: 1, envMapIntensity: 0.25 });
    } else if (name === 'trim') {
      o.material = new THREE.MeshStandardMaterial({ color: new THREE.Color('#2e3238'), roughness: 0.7, envMapIntensity: 0.5 });
    } else if (name === 'steel') {
      o.material = new THREE.MeshStandardMaterial({ color: new THREE.Color('#6a7076'), metalness: 0.6, roughness: 0.55 });
    } else if (name === 'lightWhite') {
      o.material = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#f4f7fa'), emissive: new THREE.Color('#eef2ff'), emissiveIntensity: 1.5, roughness: 0.25,
      });
    }
  });
}
export function cutSuvWindows(root) {
  root.updateMatrixWorld(true);
  const v = new THREE.Vector3(); const c = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const matName = (o.material && o.material.name) || '';
    if (!/^paint/.test(matName)) return;
    const geo = o.geometry;
    const pos = geo.attributes.position;
    if (!pos) return;
    const idx = geo.index;
    const triCount = idx ? idx.count / 3 : pos.count / 3;
    const keep = []; let cut = 0;
    for (let t = 0; t < triCount; t++) {
      const a = idx ? idx.getX(t * 3) : t * 3;
      const b = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
      const d = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
      c.set(0, 0, 0);
      for (const vi of [a, b, d]) {
        v.fromBufferAttribute(pos, vi).applyMatrix4(o.matrixWorld);
        c.add(v);
      }
      c.divideScalar(3);
      const inShield = Math.abs(c.x) < 0.88 && c.y > 1.06 && c.y < 2.0 && c.z > 0.3 && c.z < 1.32;
      const inSide = Math.abs(c.x) > 0.8 && Math.abs(c.x) < 1.12 && c.y > 1.12 && c.y < 1.98 && c.z > -1.55 && c.z < 1.05;
      if (inShield || inSide) cut++; else keep.push(a, b, d);
    }
    if (cut > 0) geo.setIndex(keep);
  });
}
export function SuvVehicle(suv, { paint = '#f2f4f5', variant = 'white', glassOff = false } = {}) {
  const c = suv.clone(true);
  cutSuvWindows(c);
  if (variant === 'blue') prepareSUV(c, paint, '#5d82b8', 0.33);
  else prepareSUV(c, paint, '#54749f', 0.48, '#46586c');
  if (glassOff) c.traverse((o) => { if (o.isMesh && o.userData.isGlass) o.visible = false; });
  const g = new THREE.Group();
  g.add(c);
  const blue = variant === 'blue';
  const GY = blue ? 0.6 : 0.585, GH = blue ? 0.26 : 0.34;
  const IY = blue ? 0.21 : 0.245, IH = blue ? 0.4 : 0.25;
  const navy = '#0a1730';
  const brow = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.18, 0.03), new THREE.MeshPhysicalMaterial({
    color: paint, metalness: 0, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.2, envMapIntensity: 1.05,
  }));
  brow.position.set(0, 0.95, 2.37); g.add(brow);
  const band = new THREE.Mesh(new THREE.BoxGeometry(1.52, GH, 0.035),
    new THREE.MeshStandardMaterial({ color: navy, roughness: 0.45, metalness: 0.25 }));
  band.position.set(0, GY, 2.385); g.add(band);
  for (const dy of [-0.09, 0, 0.09]) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.018, 0.01),
      new THREE.MeshStandardMaterial({ color: '#6a7686', metalness: 0.7, roughness: 0.4 }));
    slat.position.set(0, GY + dy, 2.406); g.add(slat);
  }
  const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.015, 20),
    new THREE.MeshStandardMaterial({ color: '#c8ccd2', metalness: 0.75, roughness: 0.3 }));
  badge.rotation.x = Math.PI / 2; badge.position.set(0, GY, 2.408); g.add(badge);
  for (const s of [-1, 1]) {
    const wrap = new THREE.Mesh(new THREE.BoxGeometry(0.34, GH, 0.03),
      new THREE.MeshStandardMaterial({ color: navy, roughness: 0.45, metalness: 0.25 }));
    wrap.position.set(s * 0.9, GY, 2.335); wrap.rotation.set(0, -s * 0.55, 0); g.add(wrap);
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.065, 0.03), new THREE.MeshStandardMaterial({
      color: '#eef2ff', emissive: '#dfe9ff', emissiveIntensity: 2.6, roughness: 0.3,
    }));
    led.position.set(s * 0.8, GY + GH / 2 - 0.09, 2.388); g.add(led);
  }
  const intake = new THREE.Mesh(new THREE.BoxGeometry(1.7, IH, 0.03),
    new THREE.MeshStandardMaterial({ color: '#0b0e13', roughness: 0.85 }));
  intake.position.set(0, IY, 2.372); g.add(intake);
  g.add(ContactShadow([2.7, 5.5], 0.36, [0.1, 0.015, -0.1]));
  return g;
}

// ---------------- grass ----------------
export function GrassField(src, { area, count, scale, seed = 7, y = 0, tint = ['#8fae56', '#b9cf7d'], bright = 1 }) {
  const mat = new THREE.MeshStandardMaterial({
    map: src.tex, alphaTest: 0.34, side: THREE.DoubleSide, roughness: 1, metalness: 0,
  });
  const im = new THREE.InstancedMesh(src.geo, mat, count);
  const rand = rng(seed);
  const m = new THREE.Matrix4(); const q = new THREE.Quaternion();
  const e = new THREE.Euler(); const v = new THREE.Vector3(); const sc = new THREE.Vector3();
  const cA = new THREE.Color(tint[0]); const cB = new THREE.Color(tint[1]); const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const x = area[0] + rand() * (area[1] - area[0]);
    const z = area[2] + rand() * (area[3] - area[2]);
    const s = scale[0] + rand() * (scale[1] - scale[0]);
    e.set(0, rand() * Math.PI * 2, 0); q.setFromEuler(e);
    v.set(x, y, z); sc.set(s, s * (0.85 + rand() * 0.4), s);
    m.compose(v, q, sc); im.setMatrixAt(i, m);
    c.copy(cA).lerp(cB, rand()).multiplyScalar(bright);
    im.setColorAt(i, c);
  }
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.receiveShadow = true; im.frustumCulled = false;
  return im;
}
