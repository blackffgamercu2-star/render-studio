import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, BOARD_POS, BOARD_RY, fishAt, SCALE_POS, BELL_POS, INN_TABLE, BAK_TABLE } from './story.js';
import { warpF } from './timewarp.js';
import { WORDS } from './words.js';

const W = 1080, H = 1920;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
const envMap = FX.detailEnv(renderer);
scene.environment = envMap;
const camera = new THREE.PerspectiveCamera(40, W / H, 0.08, 1500);
const rx = (a) => a * Math.PI / 180;

// ---------- materials ----------
const grad = (() => { const d = new Uint8Array([90, 90, 90, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 2, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const toon = (opts) => new THREE.MeshToonMaterial({ gradientMap: grad, ...opts });
const texM = (c, rx_ = 1, ry_ = 1, color = '#ffffff') => toon({ map: P.tex(c, rx_, ry_), color });

// ---------- ink / normal-depth contract ----------
const ndMat = new THREE.ShaderMaterial({
  vertexShader: `varying vec3 vN; varying float vD; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); vD = -mv.z; gl_Position = projectionMatrix*mv; }`,
  fragmentShader: `varying vec3 vN; varying float vD; void main(){ vec3 n = normalize(vN); if(!gl_FrontFacing) n = -n; gl_FragColor = vec4(n*.5+.5, vD); }`,
  side: THREE.DoubleSide,
});
const cardNd = (map) => new THREE.ShaderMaterial({
  uniforms: { map: { value: map } },
  vertexShader: `varying vec2 vUv; varying float vD; void main(){ vUv=uv; vec4 mv = modelViewMatrix*vec4(position,1.); vD=-mv.z; gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `uniform sampler2D map; varying vec2 vUv; varying float vD; void main(){ if(texture2D(map,vUv).a<.5) discard; gl_FragColor=vec4(0.,0.,0.,vD); }`,
  side: THREE.DoubleSide,
});

// ---------- helpers ----------
const add = (geo, mat, x = 0, y = 0, z = 0, parent = scene, opts = {}) => {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = opts.cast ?? true; m.receiveShadow = true; parent.add(m); return m;
};
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const tbox = (w, h, d, t = 2) => {
  const g = box(w, h, d), uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / t, uv.getY(i) * dims[f][1] / t); }
  return g;
};
const flat = (mesh) => { mesh.rotation.x = -Math.PI / 2; return mesh; };
const mergeGeos = (parts) => {
  const pos = [], nor = [], uv = [];
  const v = new THREE.Vector3(), w = new THREE.Vector3();
  for (const { geo, m } of parts) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m); pos.push(v.x, v.y, v.z);
      w.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); nor.push(w.x, w.y, w.z);
      uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0);
    }
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return out;
};
const M4 = (x = 0, y = 0, z = 0, rx2 = 0, ry2 = 0, rz2 = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(
  new THREE.Vector3(x, y, z),
  new THREE.Quaternion().setFromEuler(new THREE.Euler(rx2, ry2, rz2)),
  new THREE.Vector3(sx, sy, sz));
const sph = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
const cyl = (rt, rb, hh, n = 8) => new THREE.CylinderGeometry(rt, rb, hh, n);

// ---------- sky ----------
const skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunCol: { value: new THREE.Color() }, sunSize: { value: 0 }, aur: { value: 0 }, time: { value: 0 } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform vec3 top, hor, sunDir, sunCol; uniform float sunSize, aur, time; varying vec3 vP;
    void main(){ float h = clamp(vP.y,0.,1.); vec3 c = mix(hor, top, pow(h, .55)); if(vP.y<0.) c = hor;
      float s = dot(normalize(vP), normalize(sunDir)); c += sunCol * (smoothstep(1.-sunSize, 1.-sunSize*.6, s) + .35*pow(max(s,0.), 24.)*step(.001,sunSize));
      gl_FragColor = vec4(c,1.); }`,
}));
sky.userData.sky = true; scene.add(sky);

// ---------- lights ----------
const hemi = new THREE.HemisphereLight('#ffffff', '#ffffff', 1); scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffffff', 2); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; sun.shadow.radius = 2;
scene.add(sun); scene.add(sun.target);
scene.fog = new THREE.Fog('#ffffff', 40, 600);

// ---------- text-board helper ----------
const textBoard = (lines, w, h, bg, fg, font = 900, fit = null) => {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w);
  const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = fg; g.lineWidth = 14; g.strokeRect(20, 20, c.width - 40, c.height - 40);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  let fs = Math.min(170, (c.width - 130) / Math.max(...lines.map((l) => l.length)) * 1.72);
  if (fit && fit.fsMul) fs *= fit.fsMul;
  g.font = `${font} ${fs}px Arial`;
  lines.forEach((l, i) => {
    let fy;
    if (fit && fit.pitch && lines.length > 1) fy = 0.5 + (i - (lines.length - 1) / 2) * fit.pitch;
    else fy = lines.length === 1 ? 0.52 : (i + 0.5) / lines.length;
    if (fit && fit.dy) fy += fit.dy;
    g.fillText(l, c.width / 2, c.height * fy);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, fog: true }));
  m.userData.ndSkip = true; return m;
};
const addBoardOccluder = (board, w, h, key) => {
  const occ = new THREE.Mesh(new THREE.PlaneGeometry(w, h), ndMat);
  occ.position.copy(board.position); occ.rotation.copy(board.rotation);
  occ.userData.isOccluder = true; occ.userData.boardKey = key; board.parent.add(occ); return occ;
};

// ---------- canvas textures (procedural, from paint.js) ----------
const MAT = {
  stone: texM(P.stone(8), 9, 7),
  stoneDark: texM(P.stone(11), 3, 3, '#b8ab94'),
  wood: texM(P.planks(4), 2, 2),
  woodDark: texM(P.planks(6), 2, 2, '#9a7a58'),
  plaster: texM(P.plaster(8, 42), 6, 2),
  clothRed: texM(P.weave(21, [352, 62, 30]), 2, 6),
  clothCream: texM(P.weave(23, [40, 30, 80]), 1, 4),
  copper: new THREE.MeshStandardMaterial({ color: '#b0662f', roughness: 0.34, metalness: 0.78, envMapIntensity: 1.5 }),
  brass: new THREE.MeshStandardMaterial({ color: '#c9a24e', roughness: 0.32, metalness: 0.85, envMapIntensity: 1.6 }),
  iron: toon({ color: '#2e2c30', roughness: 0.6, metalness: 0.4 }),
  cream: toon({ color: '#efe3c8', roughness: 1 }),
  leaf: toon({ color: '#4d7a35', roughness: 1 }),
  leaf2: toon({ color: '#639347', roughness: 1 }),
  grass: texM(P.grass(6), 26, 26),
  dirt: texM(P.dirt(7), 10, 10),
  roofTex: texM(P.roof(9), 2, 2),
  rope: toon({ color: '#a98f5f', roughness: 1 }),
  leather: toon({ color: '#7a4a21', roughness: 0.9 }),
  gold: new THREE.MeshStandardMaterial({ color: '#e8b93c', roughness: 0.25, metalness: 0.9, envMapIntensity: 2.0 }),
  flesh: toon({ color: '#e8a7a0', roughness: 0.7 }),
  fleshDark: toon({ color: '#c97a72', roughness: 0.7 }),
  chalk: toon({ color: '#ffffff', roughness: 0.9 }),
  bread: toon({ color: '#d9a45c', roughness: 0.9 }),
  dishWhite: toon({ color: '#f6f1e2', roughness: 0.55 }),
  fin: new THREE.MeshStandardMaterial({ color: '#4e7186', roughness: 0.5, metalness: 0.2, envMapIntensity: 1.0 }),
  eyeDark: new THREE.MeshStandardMaterial({ color: '#141c24', roughness: 0.25, metalness: 0.3, envMapIntensity: 1.4 }),
};
// the giant fish's skin: silver-blue with painted scale arcs and a
// pale belly band (canvas v runs pole-to-pole over the body sphere)
const fishSkinTex = (() => {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#46687e'); grd.addColorStop(0.45, '#7496ab'); grd.addColorStop(0.75, '#a9c3d2'); grd.addColorStop(1, '#dfe9ec');
  g.fillStyle = grd; g.fillRect(0, 0, 512, 256);
  g.strokeStyle = 'rgba(26,44,58,0.68)'; g.lineWidth = 3;
  for (let r = 0; r < 7; r++) for (let col = 0; col < 13; col++) {
    const cx = col * 42 + (r % 2) * 21, cy = 22 + r * 30;
    g.beginPath(); g.arc(cx, cy, 19, 0.25, Math.PI - 0.25); g.stroke();
    g.beginPath(); g.arc(cx + 3, cy - 3, 19, 0.4, Math.PI - 0.6); g.strokeStyle = 'rgba(255,255,255,0.34)'; g.stroke(); g.strokeStyle = 'rgba(26,44,58,0.68)';
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
})();
MAT.fishSkin = new THREE.MeshStandardMaterial({ map: fishSkinTex, roughness: 0.46, metalness: 0.22, envMapIntensity: 1.1 });

// ---------- the giant fish (real parts: scaled body, forked tail,
// dorsal + pectoral fins, gill arc, eye, chalk mark band) ----------
const makeFishWhole = (simple = false) => {
  const g = new THREE.Group();
  const body = new THREE.Mesh(sph(1, 22, 16), MAT.fishSkin);
  body.scale.set(1.38, 0.34, 0.30); body.castShadow = true; body.receiveShadow = true; g.add(body);
  const tailG = new THREE.Group(); tailG.position.set(-1.32, 0, 0); g.add(tailG);
  const tail = new THREE.Mesh(mergeGeos([
    { geo: new THREE.ConeGeometry(0.30, 0.62, 4), m: M4(-0.28, 0.16, 0, 0, 0, 2.25, 1, 1, 0.16) },
    { geo: new THREE.ConeGeometry(0.30, 0.62, 4), m: M4(-0.28, -0.16, 0, 0, 0, -2.25 + Math.PI, 1, 1, 0.16) },
  ]), MAT.fin);
  tail.castShadow = true; tailG.add(tail);
  if (!simple) {
    const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.30, 0.52, 4), MAT.fin);
    dorsal.scale.set(1.15, 1, 0.14); dorsal.position.set(-0.12, 0.38, 0); dorsal.rotation.z = -0.35; dorsal.castShadow = true; g.add(dorsal);
  }
  for (const s of [-1, 1]) {
    if (!simple) {
      const pec = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 4), MAT.fin);
      pec.scale.set(1, 1, 0.16); pec.position.set(0.62, -0.20, s * 0.26); pec.rotation.set(s * 0.7, 0, 2.5); g.add(pec);
    }
    const eye = new THREE.Mesh(sph(0.048, 10, 8), MAT.eyeDark);
    eye.position.set(1.06, 0.09, s * 0.235); g.add(eye);
    const glint = new THREE.Mesh(sph(0.016, 6, 5), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    glint.position.set(1.09, 0.13, s * 0.27); glint.userData.ndSkip = true; g.add(glint);
  }
  const gill = new THREE.Mesh(new THREE.TorusGeometry(0.315, 0.013, 6, 24, Math.PI * 1.25), MAT.fin);
  gill.position.set(0.78, 0, 0); gill.rotation.set(0, Math.PI / 2, Math.PI * 0.87); if (!simple) g.add(gill);
  const mark = new THREE.Mesh(new THREE.TorusGeometry(0.322, 0.02, 6, 28), new THREE.MeshToonMaterial({ gradientMap: grad, color: '#ffffff', transparent: true, opacity: 0 }));
  mark.position.set(0, 0, 0); mark.rotation.y = Math.PI / 2; mark.castShadow = false; g.add(mark);
  g.userData = { tailG, mark };
  return g;
};
const makeFishHalf = (headHalf) => {
  const g = new THREE.Group();
  const body = new THREE.Mesh(sph(1, 20, 14), MAT.fishSkin);
  body.scale.set(0.64, 0.34, 0.30); body.position.set(headHalf ? 0.66 : -0.66, 0, 0);
  body.castShadow = true; body.receiveShadow = true; g.add(body);
  const capDir = headHalf ? -1 : 1;
  const cap = new THREE.Mesh(new THREE.CircleGeometry(0.315, 20), MAT.flesh);
  cap.scale.set(1, 1.06, 0.94); cap.position.set(0, 0, 0); cap.rotation.y = headHalf ? -Math.PI / 2 : Math.PI / 2; g.add(cap);
  const muscle = new THREE.Mesh(new THREE.CircleGeometry(0.205, 18), MAT.fleshDark);
  muscle.scale.set(1, 1.05, 0.95); muscle.position.set(capDir * 0.004, 0, 0); muscle.rotation.y = headHalf ? -Math.PI / 2 : Math.PI / 2; g.add(muscle);
  const spine = new THREE.Mesh(new THREE.CircleGeometry(0.055, 10), MAT.cream);
  spine.position.set(capDir * 0.008, 0.01, 0); spine.rotation.y = headHalf ? -Math.PI / 2 : Math.PI / 2; g.add(spine);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.315, 0.016, 6, 24), MAT.fleshDark);
  rim.rotation.y = Math.PI / 2; g.add(rim);
  if (headHalf) {
    for (const s of [-1, 1]) {
      const pec = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 4), MAT.fin);
      pec.scale.set(1, 1, 0.16); pec.position.set(0.88, -0.20, s * 0.26); pec.rotation.set(s * 0.7, 0, 2.5); g.add(pec);
      const eye = new THREE.Mesh(sph(0.048, 10, 8), MAT.eyeDark);
      eye.position.set(1.24, 0.09, s * 0.235); g.add(eye);
    }
    const gill = new THREE.Mesh(new THREE.TorusGeometry(0.315, 0.013, 6, 24, Math.PI * 1.25), MAT.fin);
    gill.position.set(1.02, 0, 0); gill.rotation.set(0, Math.PI / 2, Math.PI * 0.87); g.add(gill);
    const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.46, 4), MAT.fin);
    dorsal.scale.set(1.15, 1, 0.14); dorsal.position.set(0.45, 0.37, 0); dorsal.rotation.z = -0.35; g.add(dorsal);
  } else {
    const tail = new THREE.Mesh(mergeGeos([
      { geo: new THREE.ConeGeometry(0.30, 0.62, 4), m: M4(-1.54, 0.16, 0, 0, 0, 2.25, 1, 1, 0.16) },
      { geo: new THREE.ConeGeometry(0.30, 0.62, 4), m: M4(-1.54, -0.16, 0, 0, 0, -2.25 + Math.PI, 1, 1, 0.16) },
    ]), MAT.fin);
    tail.castShadow = true; g.add(tail);
    const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.42, 4), MAT.fin);
    dorsal.scale.set(1.15, 1, 0.14); dorsal.position.set(-0.55, 0.36, 0); dorsal.rotation.z = -0.35; g.add(dorsal);
  }
  return g;
};

// ---------- WORLD: the harbour quay + market (ONE set) ----------
const world = new THREE.Group(); scene.add(world);
let waterMesh, deepBase;
{ // base ground, the stone quay, the harbour wall, the SEA
  flat(add(new THREE.PlaneGeometry(130, 56), MAT.grass, 0, -0.03, 21.6, world, { cast: false }));
  flat(add(new THREE.PlaneGeometry(38, 22.4), MAT.stone, 0, 0.001, 5.3, world, { cast: false }));
  add(box(38, 0.55, 0.62), MAT.stoneDark, 0, 0.24, -6.2, world, { cast: false });       // the quay edge wall
  for (let bx = -16; bx <= 16; bx += 4) add(cyl(0.09, 0.11, 0.62, 8), MAT.woodDark, bx, 0.31, -5.68, world, { cast: false }); // bollards on the quay, clear of the wall face
  deepBase = flat(add(new THREE.PlaneGeometry(80, 80), new THREE.MeshBasicMaterial({ color: '#062a36', fog: true }), 0, -1.7, -46, world, { cast: false }));
  deepBase.userData.ndSkip = true;
  waterMesh = FX.makeWaterCine({ size: 76, seg: 88, spark: 1.0, deep: 0x04344a, shallow: 0x0e5d7a, sky: 0xa8d4e6 });
  waterMesh.position.set(0, -0.25, -44.4); waterMesh.castShadow = false; waterMesh.receiveShadow = false;
  world.add(waterMesh);
}
// --- boats on the water + gulls over the sea ---
let boatA, boatB; const gulls = [];
{
  const boatAt = (x, z, s, hullCol) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = 0.5; world.add(g);
    const hull = add(box(2.6 * s, 0.5 * s, 0.9 * s), toon({ color: hullCol, roughness: 0.9 }), 0, 0.1 * s, 0, g);
    const bow = add(box(0.8 * s, 0.42 * s, 0.7 * s), toon({ color: hullCol, roughness: 0.9 }), 1.55 * s, 0.14 * s, 0, g); bow.rotation.z = 0.35;
    add(cyl(0.05 * s, 0.06 * s, 2.6 * s, 6), MAT.woodDark, -0.2 * s, 1.5 * s, 0, g, { cast: false });
    const sail = add(new THREE.ConeGeometry(0.55 * s, 1.5 * s, 4), MAT.cream, -0.2 * s, 1.15 * s, 0, g, { cast: false }); sail.scale.z = 0.3;
    return g;
  };
  boatA = boatAt(-4.4, -8.4, 1, '#8a5a34'); boatB = boatAt(11.5, -10.5, 0.8, '#5d7a8a');
  const gullAt = (cx, cz, r, h, ph) => {
    const g = new THREE.Group(); world.add(g);
    const wmat = new THREE.MeshBasicMaterial({ color: '#f4f7f5', fog: true, side: THREE.DoubleSide });
    const wl = add(new THREE.PlaneGeometry(0.62, 0.16), wmat, -0.31, 0, 0, g, { cast: false });
    const wr = add(new THREE.PlaneGeometry(0.62, 0.16), wmat, 0.31, 0, 0, g, { cast: false });
    wl.userData.ndSkip = wr.userData.ndSkip = true;
    g.userData = { cx, cz, r, h, ph, wl, wr };
    gulls.push(g); return g;
  };
  gullAt(-3, -12, 6, 4.6, 0); gullAt(6, -14, 8, 5.4, 2.2); gullAt(0, -10, 4.5, 3.9, 4.4);
}
// --- the fish board: the long plank table the giant lies on ---
{
  const g = new THREE.Group(); g.position.set(0, 0, -2.2); world.add(g);
  add(box(3.5, 0.12, 1.05), MAT.wood, 0, 0.72, 0, g);
  for (const [lx, lz] of [[-1.6, -0.4], [1.6, -0.4], [-1.6, 0.4], [1.6, 0.4]]) add(box(0.12, 0.66, 0.12), MAT.woodDark, lx, 0.33, lz, g);
  add(box(3.5, 0.07, 0.07), MAT.woodDark, 0, 0.4, -0.44, g, { cast: false });
  add(box(3.5, 0.07, 0.07), MAT.woodDark, 0, 0.4, 0.44, g, { cast: false });
  // a fishmonger's knife block + a coil of rope at the west end
  add(box(0.34, 0.16, 0.24), MAT.woodDark, -1.45, 0.86, 0.28, g, { cast: false });
  const coil = add(new THREE.TorusGeometry(0.17, 0.05, 6, 18), MAT.rope, 1.5, 0.81, 0.3, g, { cast: false }); coil.rotation.x = Math.PI / 2;
}
// --- the boss's market stall, behind the board ---
{
  const g = new THREE.Group(); g.position.set(-0.5, 0, 1.0); world.add(g);
  for (const [px, pz] of [[-1.8, -0.65], [1.8, -0.65], [-1.8, 0.65], [1.8, 0.65]]) add(cyl(0.055, 0.065, 2.3, 7), MAT.woodDark, px, 1.15, pz, g);
  const awn = add(box(4.1, 0.07, 1.8), MAT.clothRed, 0, 2.36, 0, g, { cast: false }); awn.rotation.x = 0.13;
  add(box(3.6, 0.1, 1.15), MAT.wood, 0, 0.82, 0, g);
  for (const [lx, lz] of [[-1.65, -0.45], [1.65, -0.45], [-1.65, 0.45], [1.65, 0.45]]) add(box(0.11, 0.78, 0.11), MAT.woodDark, lx, 0.39, lz, g);
  // crates of ordinary fish on the stall table — the day's small catch
  for (const cx of [-1.15, 0.05, 1.2]) {
    add(box(0.85, 0.2, 0.55), MAT.woodDark, cx, 0.97, 0, g, { cast: false });
    for (let k = 0; k < 3; k++) {
      const sf = makeFishWhole(true); sf.scale.setScalar(0.21); sf.position.set(cx - 0.22 + k * 0.22, 1.10, (k % 2 ? 0.09 : -0.09)); sf.rotation.y = (k % 2 ? 0.25 : -0.2); g.add(sf);
    }
  }
}
// --- crates, barrels, the purse stool ---
let purse1, purse2, smallFishMesh;
{
  const crateAt = (x, z, s = 1) => { const c = add(box(0.72 * s, 0.72 * s, 0.72 * s), MAT.wood, x, 0.36 * s, z, world); add(box(0.76 * s, 0.09 * s, 0.76 * s), MAT.woodDark, x, 0.68 * s, z, world, { cast: false }); return c; };
  crateAt(-3.25, -0.55); crateAt(-3.2, 0.28, 0.8);
  add(cyl(0.34, 0.3, 0.95, 10), MAT.woodDark, -3.3, 0.475, 1.35, world);
  add(cyl(0.34, 0.3, 0.95, 10), MAT.woodDark, 3.1, 0.475, 0.95, world);
  add(box(0.55, 0.55, 0.55), MAT.wood, -2.15, 0.275, -2.2, world); // the purse stool
  const purseAt = (x, z) => {
    const g = new THREE.Group(); g.position.set(x, 0.55, z); world.add(g);
    const sack = add(sph(0.16, 10, 8), MAT.leather, 0, 0.10, 0, g); sack.scale.set(1, 0.88, 1);
    add(new THREE.TorusGeometry(0.07, 0.022, 5, 10), MAT.gold, 0, 0.235, 0, g, { cast: false }).rotation.x = Math.PI / 2;
    add(cyl(0.035, 0.05, 0.07, 7), MAT.leather, 0, 0.27, 0, g, { cast: false });
    return g;
  };
  purse1 = purseAt(-2.28, -2.32); purse2 = purseAt(-2.0, -2.05);
  smallFishMesh = makeFishWhole(); smallFishMesh.scale.setScalar(0.32);
  smallFishMesh.position.set(1.15, 0.115, -1.0); smallFishMesh.rotation.y = 0.5; world.add(smallFishMesh);
}
// --- the steelyard scale: post, tipping beam, sling + the giant ---
let beamG, scaleFish;
{
  const g = new THREE.Group(); g.position.set(SCALE_POS.x, 0, SCALE_POS.z); world.add(g);
  add(cyl(0.09, 0.13, 2.4, 8), MAT.woodDark, 0, 1.2, 0, g);
  add(box(0.7, 0.12, 0.7), MAT.woodDark, 0, 0.06, 0, g, { cast: false });
  add(box(0.5, 0.08, 0.08), MAT.woodDark, 0, 2.28, 0.3, g, { cast: false });
  beamG = new THREE.Group(); beamG.position.set(0, 2.38, 0); g.add(beamG);
  add(box(3.7, 0.09, 0.09), MAT.wood, 0.15, 0, 0, beamG);
  add(sph(0.075, 8, 6), MAT.iron, 0, 0, 0, beamG, { cast: false });
  // the sling: two ropes down to the fish at the west arm
  const rope = (x0, y0, x1, y1) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const r = add(cyl(0.016, 0.016, len, 5), MAT.rope, (x0 + x1) / 2, (y0 + y1) / 2, 0, beamG, { cast: false });
    r.rotation.z = Math.atan2(y1 - y0, x1 - x0) + Math.PI / 2; return r;
  };
  rope(-1.5, 0, -2.0, -0.8); rope(-1.5, 0, -1.0, -0.8);
  scaleFish = makeFishWhole(); scaleFish.scale.setScalar(0.92);
  scaleFish.position.set(-1.5, -1.12, 0); beamG.add(scaleFish);
  // the brass counterweight on the long east arm
  const cw = new THREE.Group(); cw.position.set(1.72, -0.06, 0); beamG.add(cw);
  add(cyl(0.014, 0.014, 0.34, 5), MAT.rope, 0, -0.17, 0, cw, { cast: false });
  add(box(0.3, 0.34, 0.3), MAT.brass, 0, -0.52, 0, cw);
  add(box(0.36, 0.07, 0.36), MAT.brass, 0, -0.33, 0, cw, { cast: false });
}
// --- the bell post at the quay edge ---
let bellG;
{
  const g = new THREE.Group(); g.position.set(BELL_POS.x, 0, BELL_POS.z); world.add(g);
  add(cyl(0.07, 0.1, 2.6, 8), MAT.woodDark, 0, 1.3, 0, g);
  add(box(0.9, 0.09, 0.09), MAT.woodDark, 0, 2.52, 0, g, { cast: false });
  bellG = new THREE.Group(); bellG.position.set(0, 2.5, 0); g.add(bellG);
  const bell = add(new THREE.CylinderGeometry(0.10, 0.21, 0.30, 12), MAT.brass, 0, -0.22, 0, bellG);
  add(sph(0.10, 8, 6), MAT.brass, 0, -0.05, 0, bellG, { cast: false });
  add(sph(0.045, 7, 5), MAT.iron, 0, -0.40, 0, bellG, { cast: false });
}
// --- the two feast tables, dressed and ready ---
{
  const feastAt = (T2, kind) => {
    const g = new THREE.Group(); g.position.set(T2.x, 0, T2.z); world.add(g);
    add(box(3.7, 0.09, 1.2), MAT.wood, 0, 0.86, 0, g);
    for (const [lx, lz] of [[-1.7, -0.48], [1.7, -0.48], [-1.7, 0.48], [1.7, 0.48]]) add(box(0.12, 0.82, 0.12), MAT.woodDark, lx, 0.41, lz, g);
    const cloth = add(box(3.85, 0.05, 1.34), kind === 'inn' ? MAT.cream : MAT.clothCream, 0, 0.93, 0, g, { cast: false });
    add(box(3.4, 0.07, 0.16), MAT.woodDark, 0, 0.3, -0.85, g, { cast: false });  // benches
    add(box(3.4, 0.07, 0.16), MAT.woodDark, 0, 0.3, 0.85, g, { cast: false });
    if (kind === 'inn') {
      for (let k = 0; k < 5; k++) {
        const px = -1.45 + k * 0.72;
        add(cyl(0.16, 0.13, 0.03, 12), MAT.dishWhite, px, 0.975, -0.3, g, { cast: false });
        add(cyl(0.16, 0.13, 0.03, 12), MAT.dishWhite, px, 0.975, 0.32, g, { cast: false });
        add(cyl(0.035, 0.05, 0.14, 7), MAT.brass, px + 0.18, 1.02, 0, g, { cast: false });
      }
      const roast = add(sph(0.3, 12, 9), toon({ color: '#a8642e', roughness: 0.8 }), 0, 1.06, 0, g); roast.scale.set(1.25, 0.72, 0.9);
    } else {
      for (let k = 0; k < 6; k++) {
        const loaf = add(sph(0.17, 10, 8), MAT.bread, -1.5 + k * 0.6, 1.0, (k % 2 ? 0.24 : -0.22), g, { cast: false });
        loaf.scale.set(1.35, 0.72, 0.85); loaf.rotation.y = k * 0.7;
      }
      add(cyl(0.3, 0.22, 0.24, 10), MAT.woodDark, 1.55, 1.05, 0.25, g, { cast: false }); // basket
    }
    return g;
  };
  feastAt(INN_TABLE, 'inn'); feastAt(BAK_TABLE, 'bakery');
}
// --- harbour houses along the south edge (backdrop) ---
{
  const houseAt = (x, z, ry, w = 3.4) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; world.add(g);
    add(tbox(w, 2.5, 2.6, 2), MAT.plaster, 0, 1.25, 0, g, { cast: false });
    const roof = add(new THREE.ConeGeometry(w * 0.72, 1.3, 4), MAT.roofTex, 0, 3.15, 0, g, { cast: false }); roof.rotation.y = Math.PI / 4;
    add(box(0.7, 1.3, 0.07), MAT.woodDark, -0.6, 0.65, 1.32, g, { cast: false });
    const win = add(new THREE.PlaneGeometry(0.55, 0.55), new THREE.MeshBasicMaterial({ color: '#ffe9bd', fog: true }), 0.75, 1.5, 1.32, g, { cast: false }); win.userData.ndSkip = true;
  };
  houseAt(-9.5, 12, 0.15); houseAt(-2.5, 13, -0.1, 4.2); houseAt(5, 12.6, 0.08); houseAt(11.5, 11.6, -0.2, 3.1);
  const treeAt = (x, z, s = 1) => {
    add(cyl(0.16 * s, 0.24 * s, 1.6 * s, 8), MAT.woodDark, x, 0.8 * s, z, world, { cast: false });
    const c1 = add(sph(1.15 * s, 12, 9), MAT.leaf, x, 2.3 * s, z, world, { cast: false }); c1.scale.y = 0.85;
    const c2 = add(sph(0.85 * s, 11, 8), MAT.leaf2, x + 0.7 * s, 1.9 * s, z + 0.3, world, { cast: false }); c2.scale.y = 0.85;
  };
  treeAt(-13.5, 3.5, 1.1); treeAt(14.2, 5.5); treeAt(-14.5, -3, 0.95);
}
// --- the giant fish + its halves, posed per frame by the story ---
const fishWhole = makeFishWhole(); world.add(fishWhole);
const fishHeadHalf = makeFishHalf(true); world.add(fishHeadHalf);
const fishTailHalf = makeFishHalf(false); world.add(fishTailHalf);
// --- the final hook board on its easel ---
const boardPlane = textBoard(['ONE FISH', 'SOLD TWICE'], 2.2, 0.78, '#f3e9d2', '#3a2a18', 900, { fsMul: 0.60 });
{
  const [bx, by, bz] = BOARD_POS;
  const eg = new THREE.Group(); eg.position.set(bx, 0, bz); eg.rotation.y = BOARD_RY; world.add(eg);
  for (const s of [-1, 1]) {
    const leg = add(box(0.07, 1.5, 0.07), MAT.woodDark, s * 0.72, 0.7, 0.1, eg); leg.rotation.x = 0.18;
    const leg2 = add(box(0.07, 1.5, 0.07), MAT.woodDark, s * 0.72, 0.7, -0.28, eg); leg2.rotation.x = -0.3;
  }
  add(box(1.7, 0.06, 0.06), MAT.woodDark, 0, 0.52, 0.16, eg);
  boardPlane.position.set(bx, by, bz); boardPlane.rotation.y = BOARD_RY; boardPlane.rotation.x = -0.05;
  world.add(boardPlane); addBoardOccluder(boardPlane, 2.2, 0.78, 'boardK');
}

// ---------- cards ----------
const CW = 1200, CH = 2000, CM = 2.25;
const cardGeo = new THREE.PlaneGeometry(CM * 0.6, CM); cardGeo.translate(0, CM / 2 - CM * 0.025, 0);
const blobTex = P.tex(P.radial('20,14,30', 0.6));
class Card {
  constructor(scale = 1) {
    [this.c, this.g] = (() => { const c = document.createElement('canvas'); c.width = CW; c.height = CH; return [c, c.getContext('2d')]; })();
    this.t = new THREE.CanvasTexture(this.c); this.t.colorSpace = THREE.SRGBColorSpace; this.t.anisotropy = 4;
    this.mat = new THREE.MeshBasicMaterial({ map: this.t, transparent: true, alphaTest: 0.02, side: THREE.DoubleSide, fog: true });
    this.mesh = new THREE.Mesh(cardGeo, this.mat); this.mesh.userData.nd = cardNd(this.t); this.mesh.castShadow = true;
    this.mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: this.t, alphaTest: 0.5 });
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, fog: true }));
    this.blob.rotation.x = -Math.PI / 2; this.blob.userData.ndSkip = true; this.blob.renderOrder = 1;
    scene.add(this.mesh); scene.add(this.blob); this.key = ''; this.mesh.visible = this.blob.visible = false;
  }
  draw(key, fn) {
    if (key === this.key) return; this.key = key;
    const g = this.g; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, CW, CH); g.setTransform(CW / 600, 0, 0, CH / 1000, 0, 0);
    const p = new T.Pen(g); fn(p); this.t.needsUpdate = true;
  }
}
const cards = []; const getCard = (i) => cards[i] || (cards[i] = new Card());

// ---------- render targets & post (ink/dof contract) ----------
const rtColor = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType });
const rtNd = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
const rtInk = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), fsGeo = new THREE.PlaneGeometry(2, 2);
const fs = (mat) => { const s = new THREE.Scene(); s.add(new THREE.Mesh(fsGeo, mat)); return s; };
const inkU = { col: { value: rtColor.texture }, nd: { value: rtNd.texture }, res: { value: new THREE.Vector2(W, H) }, px: { value: 1.6 }, fogCol: { value: new THREE.Color() },
  sat: { value: 1.08 }, lift: { value: new THREE.Color(0, 0, 0) }, gain: { value: new THREE.Color(1, 1, 1) }, vig: { value: 0.22 }, flash: { value: 0 },
  gradeAmt: { value: 0.85 }, gradeExp: { value: 1.0 } }; // CINEMATIC GRADE (charfix r2): ACES filmic + split tone
const inkScene = fs(new THREE.ShaderMaterial({ uniforms: inkU, vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: `uniform sampler2D col, nd; uniform vec2 res; uniform float px, sat, vig, flash, gradeAmt, gradeExp; uniform vec3 fogCol, lift, gain; varying vec2 vUv;
  vec3 acesFit(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0., 1.); }
  float edgeAt(vec2 uv, float r){
    vec4 c = texture2D(nd, uv); if (dot(c.rgb,c.rgb) < .01) return 0.; float d = c.a; vec3 n = c.rgb*2.-1.;
    float e = 0.; float rr = r * clamp(7./d, .62, 1.25);
    for (int i=0;i<16;i++){ float a = float(i)*.785398 + (i>7 ? .39 : 0.); float k = i>7 ? .5 : 1.;
      vec2 o = vec2(cos(a), sin(a))*rr*k/res; vec4 s = texture2D(nd, uv+o);
      float ds = s.a; bool card = dot(s.rgb,s.rgb) < .01;
      if (card && ds > 0.) continue;
      if (card) ds = 1e4;
      vec3 ns = s.rgb*2.-1.;
      e = max(e, smoothstep(.006, .02, (ds - d)/d));
      if (!card && abs(ds-d)/d < .06) e = max(e, smoothstep(.88, .72, dot(n, ns)) * .9);
    }
    return e * (1. - smoothstep(140., 520., d)*.8);
  }
  void main(){
    vec3 c = texture2D(col, vUv).rgb;
    float e = edgeAt(vUv, px);
    c = mix(c, vec3(.012,.01,.014), e);
    if (flash < -0.5) c = vec3(e);
    float l = dot(c, vec3(.299,.587,.114)); c = mix(vec3(l), c, sat);
    c = c*gain + lift;
    // CINEMATIC GRADE (charfix round 2): ACES-fit filmic S-curve, then
    // SPLIT TONE — teal into the shadows, warm gold into the highlights.
    // Captions are composited AFTER this pass and are never graded.
    vec3 gc = acesFit(c * gradeExp);
    float gl2 = dot(gc, vec3(.299,.587,.114));
    gc += vec3(-.014,.010,.018) * (1. - smoothstep(0., .5, gl2));
    gc *= mix(vec3(1.), vec3(1.07, 1.0, .90), smoothstep(.5, 1., gl2));
    c = mix(c, gc, gradeAmt);
    vec2 q = vUv-.5; c *= 1. - vig*dot(q*vec2(1.,.75), q*vec2(1.,.75))*2.2;
    c = mix(c, flash < 0. ? vec3(0.) : vec3(1.), clamp(abs(flash), 0., 1.));
    gl_FragColor = vec4(c,1.); }` }));
const dofU = { src: { value: rtInk.texture }, nd: { value: rtNd.texture }, res: { value: new THREE.Vector2(W, H) }, focus: { value: 5 }, cinf: { value: 0 }, near: { value: 1 } };
const dofScene = fs(new THREE.ShaderMaterial({ uniforms: dofU, vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: `uniform sampler2D src, nd; uniform vec2 res; uniform float focus, cinf, near; varying vec2 vUv;
  float coc(vec2 uv){ float d = texture2D(nd, uv).a; if (d <= 0.) d = 2000.; float k = 1. - focus/d; return k > 0. ? cinf*k : min(-k*cinf*near, cinf*1.4); }
  float vigf(vec2 uv){ vec2 q = uv - vec2(.5); return 1. - .34 * smoothstep(.38, 1.02, length(q) * 1.42); }
  void main(){
    float c0 = coc(vUv);
    if (cinf < .5 || c0 < .6) { gl_FragColor = linearToOutputTexel(vec4(texture2D(src, vUv).rgb * vigf(vUv), 1.)); return; }
    vec3 acc = vec3(0.); float wsum = 0.;
    for (int i=0;i<48;i++){ float fi = float(i); float r = sqrt((fi+.5)/48.); float a = fi*2.39996;
      vec2 o = vec2(cos(a), sin(a))*r*c0/res; float cs = coc(vUv+o);
      float w = smoothstep(r*c0-1.5, r*c0+.5, cs + .5);
      acc += texture2D(src, vUv+o).rgb*w; wsum += w; }
    gl_FragColor = linearToOutputTexel(vec4(acc/max(wsum,1e-3) * vigf(vUv), 1.)); }` }));
dofScene.children[0].material.toneMapped = false;

// ---------- word-by-word captions (the template's signature) ----------
const capCanvas = document.createElement('canvas'); capCanvas.width = W; capCanvas.height = H;
const capG = capCanvas.getContext('2d');
const capTex = new THREE.CanvasTexture(capCanvas); capTex.colorSpace = THREE.SRGBColorSpace;
const capScene = fs(new THREE.MeshBasicMaterial({ map: capTex, transparent: true, toneMapped: false }));
let capKey = null;
const drawCaption = (f) => {
  const t = f / 30;
  let i = -1;
  for (let k = 0; k < WORDS.length; k++) { if (t >= WORDS[k].s) i = k; else break; }
  let word = '';
  if (i >= 0) word = WORDS[i].w;
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
};

// ---------- per-frame state ----------
const tmpV = new THREE.Vector3();
function applyLight(L, f) {
  hemi.color.set(L.sky); hemi.groundColor.set(L.ground); hemi.intensity = L.hemi;
  sun.color.set(L.sun); sun.intensity = L.sunI;
  scene.fog.color.set(L.fog); scene.fog.near = L.fogNear; scene.fog.far = L.fogFar;
  skyU.top.value.set(L.skyTop); skyU.hor.value.set(L.skyHor); skyU.sunCol.value.set(L.sunDisc || '#000'); skyU.sunSize.value = L.sunSize || 0;
  skyU.aur.value = L.aurora || 0;
  inkU.sat.value = L.sat; inkU.gain.value.set(L.gain || '#ffffff'); inkU.lift.value.set(L.lift || '#000000');
}
function placeSun(L, focus) {
  const az = rx(L.az), el = rx(L.el); tmpV.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
  skyU.sunDir.value.copy(tmpV);
  sun.position.copy(focus).addScaledVector(tmpV, 80); sun.target.position.copy(focus);
  const ext = L.shadowExt || 30, sc = sun.shadow.camera; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 200; sc.updateProjectionMatrix();
}
function worldState(Ws, f) {
  skyU.time.value = f / 30;
  scene.traverse((o) => { if (o.userData.isOccluder) o.visible = o.userData.boardKey === 'always' || (Ws[o.userData.boardKey] ?? 1) > 0.01; });
  boardPlane.material.opacity = Ws.boardK ?? 0; boardPlane.visible = (Ws.boardK ?? 0) > 0.01;
  if (waterMesh) waterMesh.userData.update(f / 30);
  // boats bob, gulls circle the harbour
  boatA.position.y = Math.sin(f * 0.045) * 0.05 - 0.18; boatA.rotation.z = Math.sin(f * 0.038) * 0.02;
  boatB.position.y = Math.sin(f * 0.05 + 2) * 0.05 - 0.18; boatB.rotation.z = Math.sin(f * 0.041 + 1) * 0.02;
  for (const g of gulls) {
    const u = g.userData, a = f * 0.006 + u.ph;
    g.position.set(u.cx + Math.cos(a) * u.r, u.h + Math.sin(f * 0.03 + u.ph) * 0.2, u.cz + Math.sin(a) * u.r * 0.5);
    g.rotation.y = -a - Math.PI / 2;
    const flap = Math.sin(f * 0.55 + u.ph * 3) * 0.55;
    u.wl.rotation.y = flap; u.wr.rotation.y = -flap;
  }
  // the bell + the steelyard beam
  bellG.rotation.z = (Ws.bellSwing || 0) * 0.55;
  beamG.rotation.z = 0.34 * (Ws.scaleTip || 0);
  // the giant fish, posed by the story's model
  const FA = fishAt(f);
  const onBoardHalves = FA.mode === 'board' && FA.cut > 0.02;
  fishWhole.visible = FA.mode === 'board' && !onBoardHalves;
  scaleFish.visible = FA.mode === 'scale';
  fishWhole.position.set(FA.x, FA.y, FA.z); fishWhole.rotation.y = FA.ry;
  fishWhole.userData.tailG.rotation.y = Math.sin(f * 1.35) * (FA.wag || 0);
  fishWhole.userData.mark.material.opacity = FA.mark || 0;
  fishWhole.userData.mark.visible = (FA.mark || 0) > 0.02;
  const halvesVisible = onBoardHalves || FA.mode === 'halves';
  fishHeadHalf.visible = fishTailHalf.visible = halvesVisible;
  if (halvesVisible) {
    if (FA.halvesOnTables) {
      fishHeadHalf.position.set(INN_TABLE.x - 0.2, 1.29, INN_TABLE.z); fishHeadHalf.rotation.y = -0.12;
      fishTailHalf.position.set(BAK_TABLE.x + 0.2, 1.29, BAK_TABLE.z); fishTailHalf.rotation.y = Math.PI + 0.12;
    } else {
      const sep = 0.10 + FA.cut * 0.38;
      fishHeadHalf.position.set(sep, 1.10, -2.2); fishHeadHalf.rotation.y = 0;
      fishTailHalf.position.set(-sep, 1.10, -2.2); fishTailHalf.rotation.y = 0;
    }
  }
  purse1.visible = FA.purses >= 1; purse2.visible = FA.purses >= 2;
  smallFishMesh.visible = FA.smallFish > 0;
}
function drawActors(list, cam) {
  cards.forEach((c) => { c.mesh.visible = c.blob.visible = false; });
  list.forEach((a, i) => {
    const c = getCard(i);
    c.draw(a.key, a.draw);
    c.mesh.visible = true; c.mesh.position.set(a.x, a.y, a.z);
    const s = a.s || 1; c.mesh.scale.set(s * (a.flip ? -1 : 1), s, s);
    c.mesh.rotation.set(0, Math.atan2(cam.position.x - a.x, cam.position.z - a.z) + (a.yaw || 0), a.roll || 0);
    c.mat.color.set(a.tint || '#ffffff'); c.mat.opacity = a.alpha ?? 1;
    c.mesh.castShadow = a.shadow !== false;
    c.mesh.renderOrder = a.order || 2;
    if (a.blob !== false && a.y < 0.5) { c.blob.visible = true; c.blob.position.set(a.x, (a.ground ?? 0) + 0.02, a.z); c.blob.scale.set(0.95 * s, 0.6 * s, 1); }
  });
}
const swapForNd = (on) => {
  scene.traverse((o) => {
    if (on) {
      if (o.userData.isOccluder) { o.userData.vis0 = o.visible; return; }
      if (o.userData.ndSkip || o === sky || o.userData.sky) { o.userData.vis0 = o.visible; o.visible = false; return; }
      if (!o.isMesh) return;
      o.userData.mat0 = o.material;
      o.material = o.userData.nd || ndMat;
    } else {
      if (o.userData.vis0 !== undefined) { o.visible = o.userData.vis0; delete o.userData.vis0; }
      if (o.isMesh && o.userData.mat0 !== undefined) { o.material = o.userData.mat0; delete o.userData.mat0; }
    }
  });
};
window.renderFrame = (fNew) => {
  // identity warp: this film is built natively on its own stem, so
  // picture frames == stem frames (timewarp.js is the identity map).
  const f = warpF(fNew);
  const S = shotAt(f), L = lightFor(S, f), C = camAt(f);
  applyLight(L, f);
  camera.position.set(...C.pos); camera.up.set(0, 1, 0); camera.lookAt(...C.look); camera.rotateZ(rx(C.roll || 0));
  camera.fov = C.fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  const Ws = worldAt(f); worldState(Ws, f);
  placeSun(L, new THREE.Vector3(...(C.shadowAt || C.look)));
  drawActors([...actorsAt(f, T), ...fxAt(f, T)], camera);
  sky.position.copy(camera.position);
  renderer.setRenderTarget(rtColor); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(scene, camera);
  const fog = scene.fog; scene.fog = null; const sm = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false; renderer.shadowMap.autoUpdate = false;
  swapForNd(true); renderer.setRenderTarget(rtNd); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, camera); swapForNd(false);
  scene.fog = fog; renderer.shadowMap.enabled = sm; renderer.shadowMap.autoUpdate = true;
  if (window.DEBUG_ND) { const dm = new THREE.MeshBasicMaterial({ map: rtNd.texture }); const ds = fs(dm); renderer.setRenderTarget(null); renderer.render(ds, fsCam); return true; }
  const D = dofAt(f);
  inkU.px.value = 2.5; inkU.flash.value = window.DEBUG_E ? -1 : (C.flash || 0); inkU.vig.value = L.vig ?? 0.22;
  renderer.setRenderTarget(rtInk); renderer.render(inkScene, fsCam);
  dofU.focus.value = D.focus; dofU.cinf.value = D.cinf; dofU.near.value = D.near ?? 1;
  renderer.setRenderTarget(null); renderer.render(dofScene, fsCam);
  drawCaption(fNew);
  renderer.autoClear = false; renderer.render(capScene, fsCam); renderer.autoClear = true;
  return true;
};
window.TOTAL = TOTAL;
window.ready = true;
