import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import * as PR from './props.js';
import * as M4 from './materials.js';
import * as MO from './motion.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxProfileAt, BOARD_POS, TREES, ROCKS, GATE, STUMP, PLAT, troopAt, cart1At, merchAt, monkeyAt, banana1At, banana2At } from './story.js';
const BOWL_POS = [3.62, STUMP.top + 0.09, -1.02];   // toll bowl resting spot on the stump (mirrors story.js)
const POLE_LEN = 4.9;   // bamboo barrier: from the right post (x=2.3) across the road to x=-2.6

const W = 1080, H = 1920;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
const envMap = FX.detailEnv(renderer);
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
const setRope = (m, a, b) => {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.max(0.01, Math.hypot(...d));
  m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  m.scale.set(1, len, 1);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(d[0] / len, d[1] / len, d[2] / len));
};

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
const softGlow = (scale, color, opacity) => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 1, 32, 32, 31);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)'); grd.addColorStop(0.4, 'rgba(255,255,255,0.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(scale); s.userData.ndSkip = true; return s;
};

// ---------- materials ----------
const MAT = {
  grass: texM(M4.groundDetail(P.grass(61), 161, { dots: 3000 }), 16, 16, '#6f9a44'),
  dirt: texM(M4.groundDetail(P.dirt(35), 171), 10, 10, '#b09268'),
  rock: texM(M4.groundDetail(P.stone(78, 30, 8, 40), 181, { dots: 1800 }), 2, 2, '#9a948a'),
  wood: texM(P.beam(66, [26, 45, 32]), 1, 2), woodDk: texM(P.beam(67, [24, 40, 22]), 1, 2),
  trunk: texM(P.beam(91, [30, 42, 26]), 1, 3, '#a8845e'),
  leaf: toon({ color: '#3f7a2e' }), leaf2: toon({ color: '#55963c' }), leafDk: toon({ color: '#2e5c22' }),
  bamboo: toon({ color: '#c9a86a' }), bambooDk: toon({ color: '#a8894e' }),
  rope: toon({ color: '#8a6f42' }),
  fur: toon({ color: '#8a6242' }), furDk: toon({ color: '#6e4c30' }), face: toon({ color: '#dcb98f' }), belly: toon({ color: '#c9a678' }),
  banana: toon({ color: '#f2c531' }), bananaTip: toon({ color: '#7a5a22' }),
  horse: toon({ color: '#7a5230' }), horseDk: toon({ color: '#5d3d22' }), mane: toon({ color: '#3a2a1a' }),
  cartWood: texM(P.beam(68, [30, 48, 30]), 1, 1), wheel: toon({ color: '#6e5136' }), hub: toon({ color: '#4a3826' }),
  silk1: toon({ color: '#c22e6e' }), silk2: toon({ color: '#e8a13a' }), silk3: toon({ color: '#3a7ab5' }),
  canopy: toon({ color: '#a03a5e', side: THREE.DoubleSide }),
  white: toon({ color: '#f7f3e6' }), dark: toon({ color: '#33302c' }),
  capRed: toon({ color: '#b3392e' }), capBrim: toon({ color: '#8a2a22' }),
  parrotG: toon({ color: '#3f9e4d' }), parrotR: toon({ color: '#c23b2e' }), beak: toon({ color: '#e8a13a' }),
};

// ---------- the jungle clearing ----------
const world = new THREE.Group(); scene.add(world);
{
  const g = world;
  const grassD = flat(add(new THREE.CircleGeometry(70, 48), MAT.grass, 0, -0.03, 0, g, { cast: false }));
  // dirt road along Z (story road x in [-2.6, 2.6]) + gate apron
  const road = flat(add(new THREE.PlaneGeometry(5.2, 58), MAT.dirt, 0, 0, -7, g, { cast: false }));
  const apron = flat(add(new THREE.CircleGeometry(4.6, 28), MAT.dirt, 1.6, 0.006, 0.2, g, { cast: false })); apron.scale.set(1.25, 1, 1);
  // jungle trees (story TREES) — trunk + layered canopy
  TREES.forEach(([x, z, s], i) => {
    const tg = new THREE.Group(); tg.position.set(x, 0, z); tg.rotation.y = i * 1.37; g.add(tg);
    add(new THREE.CylinderGeometry(0.13 * s, 0.19 * s, 3.4 * s, 7), MAT.trunk, 0, 1.7 * s, 0, tg);
    add(new THREE.SphereGeometry(1.25 * s, 10, 8), MAT.leaf, 0, 3.9 * s, 0, tg).scale.y = 0.82;
    add(new THREE.SphereGeometry(0.95 * s, 9, 7), MAT.leaf2, 0.75 * s, 3.35 * s, 0.3 * s, tg).scale.y = 0.8;
    add(new THREE.SphereGeometry(0.85 * s, 9, 7), MAT.leafDk, -0.7 * s, 3.5 * s, -0.35 * s, tg).scale.y = 0.8;
    add(new THREE.SphereGeometry(0.7 * s, 8, 6), MAT.leaf2, 0.1 * s, 4.45 * s, -0.5 * s, tg).scale.y = 0.75;
  });
  ROCKS.forEach(({ x, z, s }) => {
    const r = add(new THREE.IcosahedronGeometry(0.5 * s, 0), MAT.rock, x, 0.16 * s, z, g);
    r.scale.set(1.25, 0.62, 1); r.rotation.y = x * 2.1;
  });
  // board posts + crossbar (title + hook boards share this frame)
  for (const px of [BOARD_POS[0] - 1.8, BOARD_POS[0] + 1.8]) add(new THREE.CylinderGeometry(0.06, 0.07, 3.3, 7), MAT.woodDk, px, 1.65, BOARD_POS[2], g, { cast: false });
  add(tbox(3.9, 0.12, 0.12, 2), MAT.woodDk, BOARD_POS[0], 3.86, BOARD_POS[2], g, { cast: false });
}

// ---------- the toll gate: posts, pivoting bamboo barrier, platform, ropes ----------
const gatePivot = new THREE.Group(); gatePivot.position.set(GATE.postR[0], GATE.pivotY, GATE.postR[1]); world.add(gatePivot);
let platGroup, rope1, rope2;
const PULLEY = [2.35, 1.45, 1.05];
{
  const g = world;
  for (const [px, pz] of [GATE.postL, GATE.postR]) {
    add(new THREE.CylinderGeometry(0.12, 0.14, 2.6, 8), MAT.wood, px, 1.3, pz, g);
    add(new THREE.SphereGeometry(0.16, 8, 6), MAT.woodDk, px, 2.66, pz, g);
  }
  // barrier pole (extends -x from the right post) + stripes + counterweight
  const pole = add(new THREE.CylinderGeometry(0.055, 0.065, POLE_LEN, 8), MAT.bamboo, -POLE_LEN / 2, 0, 0, gatePivot);
  pole.rotation.z = Math.PI / 2;
  for (let i = 0; i < 4; i++) {
    const band = add(new THREE.CylinderGeometry(0.068, 0.068, 0.16, 8), MAT.capRed, -0.8 - i * 1.1, 0, 0, gatePivot);
    band.rotation.z = Math.PI / 2;
  }
  add(box(0.34, 0.3, 0.3), MAT.rock, 0.42, -0.1, 0, gatePivot);
  add(new THREE.SphereGeometry(0.09, 8, 6), MAT.bambooDk, 0, 0, 0, gatePivot);   // pivot cap
  // the keeper's stump + toll bowl
  add(new THREE.CylinderGeometry(0.34, 0.4, STUMP.top, 10), MAT.trunk, STUMP.x, STUMP.top / 2, STUMP.z, g);
  add(new THREE.CylinderGeometry(0.35, 0.35, 0.045, 10), MAT.woodDk, STUMP.x, STUMP.top + 0.02, STUMP.z, g);
  const bowl = new THREE.Group(); bowl.position.set(...BOWL_POS); g.add(bowl);
  add(new THREE.CylinderGeometry(0.17, 0.1, 0.1, 9), MAT.woodDk, 0, 0, 0, bowl);
  // platform: legs + deck; group origin at ground, deck top at local 0.34
  platGroup = new THREE.Group(); platGroup.position.set(PLAT.x, 0, PLAT.z); g.add(platGroup);
  for (const [lx, lz] of [[-0.62, -0.5], [0.62, -0.5], [-0.62, 0.5], [0.62, 0.5]])
    add(box(0.11, 0.3, 0.11), MAT.woodDk, lx, 0.15, lz, platGroup);
  add(tbox(1.5, 0.09, 1.3, 2), MAT.wood, 0, 0.295, 0, platGroup);
  add(box(1.56, 0.05, 0.1), MAT.woodDk, 0, 0.26, 0.62, platGroup);
  add(box(1.56, 0.05, 0.1), MAT.woodDk, 0, 0.26, -0.62, platGroup);
  // pulley post + wheel beside the platform
  add(new THREE.CylinderGeometry(0.06, 0.07, 1.5, 7), MAT.wood, PULLEY[0], 0.75, PULLEY[2], g);
  const pw = add(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 10), MAT.woodDk, PULLEY[0], PULLEY[1], PULLEY[2], g);
  pw.rotation.x = Math.PI / 2;
  const ropeGeo = new THREE.CylinderGeometry(0.022, 0.022, 1, 5); ropeGeo.translate(0, 0.5, 0);
  rope1 = new THREE.Mesh(ropeGeo, MAT.rope); rope1.castShadow = true; world.add(rope1);
  rope2 = new THREE.Mesh(ropeGeo.clone(), MAT.rope); rope2.castShadow = true; world.add(rope2);
}

// ---------- bananas ----------
const mkBanana = (s = 1) => {
  const g = new THREE.Group();
  const b = add(new THREE.TorusGeometry(0.085, 0.034, 6, 9, 2.3), MAT.banana, 0, 0, 0, g, { cast: false });
  b.rotation.z = 2.2; b.rotation.y = 0.5;
  add(new THREE.SphereGeometry(0.03, 6, 5), MAT.bananaTip, 0.07, 0.075, 0, g, { cast: false });
  g.scale.setScalar(s); return g;
};
const banana1 = mkBanana(1); world.add(banana1);
const banana2 = new THREE.Group(); world.add(banana2);
const b2a = mkBanana(1); b2a.position.set(-0.07, 0, 0); banana2.add(b2a);
const b2b = mkBanana(1); b2b.position.set(0.08, 0.01, 0.03); b2b.rotation.y = 2.4; banana2.add(b2b);
// (no static bowl banana: banana1 itself comes to rest in the bowl from f412)

// ---------- the monkey (3D hero) + troop ----------
const mkMonkey = (s = 1, hero = false) => {
  const g = new THREE.Group();
  const body = add(new THREE.SphereGeometry(0.30, 12, 10), MAT.fur, 0, 0.34, 0, g); body.scale.set(1, 1.08, 0.92);
  add(new THREE.SphereGeometry(0.21, 10, 8), MAT.belly, 0, 0.30, 0.13, g, { cast: false }).scale.set(1, 1.1, 0.6);
  const headG = new THREE.Group(); headG.position.set(0, 0.78, 0.02); g.add(headG);
  add(new THREE.SphereGeometry(0.235, 12, 10), MAT.fur, 0, 0, 0, headG);
  add(new THREE.SphereGeometry(0.155, 10, 8), MAT.face, 0, -0.045, 0.115, headG, { cast: false }).scale.set(1.05, 0.82, 0.8);
  add(new THREE.SphereGeometry(0.075, 8, 6), MAT.face, -0.235, 0.05, 0, headG, { cast: false });
  add(new THREE.SphereGeometry(0.075, 8, 6), MAT.face, 0.235, 0.05, 0, headG, { cast: false });
  add(new THREE.SphereGeometry(0.045, 7, 6), MAT.furDk, -0.235, 0.05, 0.045, headG, { cast: false });
  add(new THREE.SphereGeometry(0.045, 7, 6), MAT.furDk, 0.235, 0.05, 0.045, headG, { cast: false });
  const jaw = add(box(0.13, 0.05, 0.09), MAT.face, 0, -0.155, 0.13, headG, { cast: false });
  const armL = new THREE.Group(); armL.position.set(-0.27, 0.52, 0.03); g.add(armL);
  const aL = add(new THREE.CylinderGeometry(0.055, 0.045, 0.34, 7), MAT.fur, 0, -0.15, 0, armL); aL.rotation.z = 0.25;
  add(new THREE.SphereGeometry(0.06, 7, 6), MAT.face, 0.05, -0.33, 0.02, armL, { cast: false });
  const armR = new THREE.Group(); armR.position.set(0.27, 0.52, 0.03); g.add(armR);
  const aR = add(new THREE.CylinderGeometry(0.055, 0.045, 0.34, 7), MAT.fur, 0, -0.15, 0, armR); aR.rotation.z = -0.25;
  add(new THREE.SphereGeometry(0.06, 7, 6), MAT.face, -0.05, -0.33, 0.02, armR, { cast: false });
  add(new THREE.SphereGeometry(0.085, 8, 6), MAT.fur, -0.16, 0.06, -0.05, g).scale.set(1, 0.7, 1.25);
  add(new THREE.SphereGeometry(0.085, 8, 6), MAT.fur, 0.16, 0.06, -0.05, g).scale.set(1, 0.7, 1.25);
  const tail = add(new THREE.TorusGeometry(0.30, 0.035, 6, 10, 1.9), MAT.furDk, 0, 0.22, -0.26, g, { cast: false });
  tail.rotation.set(0.4, 0.3, 1.9);
  let capG = null;
  if (hero) {
    capG = new THREE.Group(); capG.position.set(0, 0.155, 0.01); capG.rotation.z = 0.1; headG.add(capG);
    add(new THREE.CylinderGeometry(0.20, 0.215, 0.10, 12), MAT.capRed, 0, 0.03, 0, capG, { cast: false });
    add(new THREE.SphereGeometry(0.20, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), MAT.capRed, 0, 0.07, 0, capG, { cast: false }).scale.y = 0.55;
    const brim = add(box(0.24, 0.025, 0.16), MAT.capBrim, 0, 0.005, 0.24, capG, { cast: false });
    add(new THREE.SphereGeometry(0.035, 7, 6), MAT.banana, 0, 0.135, 0, capG, { cast: false });
    capG.visible = false;
  }
  g.scale.setScalar(s);
  return { g, headG, jaw, armL, armR, tail, capG };
};
const monkey = mkMonkey(1.12, true); world.add(monkey.g);
const monkeyGlow = softGlow(2.6, '#ffd76a', 0); monkeyGlow.position.set(0, 1, 0); world.add(monkeyGlow);
const troop = Array.from({ length: 6 }, () => { const m = mkMonkey(0.94); world.add(m.g); return m; });

// ---------- carts + horses ----------
const mkCart = (rich) => {
  const g = new THREE.Group(); world.add(g);
  // horse (local +z front, body centre z=+1.95)
  const horse = new THREE.Group(); horse.position.set(0, 0, 1.95); g.add(horse);
  const hb = add(new THREE.CylinderGeometry(0.30, 0.30, 1.15, 10), MAT.horse, 0, 1.02, 0, horse); hb.rotation.x = Math.PI / 2; hb.scale.set(1, 1, 0.82);
  add(new THREE.SphereGeometry(0.30, 10, 8), MAT.horse, 0, 1.02, 0.55, horse, { cast: false }).scale.set(0.95, 0.95, 0.7);
  const neck = add(box(0.24, 0.62, 0.3), MAT.horse, 0, 1.32, 0.72, horse); neck.rotation.x = 0.6;
  const head = add(box(0.22, 0.26, 0.52), MAT.horse, 0, 1.52, 1.02, horse); head.rotation.x = 0.25;
  add(box(0.24, 0.34, 0.06), MAT.mane, 0, 1.42, 0.58, horse, { cast: false }).rotation.x = 0.6;
  add(new THREE.ConeGeometry(0.07, 0.2, 6), MAT.horseDk, -0.08, 1.72, 0.88, horse, { cast: false });
  add(new THREE.ConeGeometry(0.07, 0.2, 6), MAT.horseDk, 0.08, 1.72, 0.88, horse, { cast: false });
  const tailH = add(new THREE.CylinderGeometry(0.05, 0.02, 0.6, 6), MAT.mane, 0, 1.05, -0.66, horse, { cast: false }); tailH.rotation.x = 0.5;
  const legs = [];
  for (const [lx, lz] of [[-0.17, 0.42], [0.17, 0.42], [-0.17, -0.42], [0.17, -0.42]]) {
    const lg = new THREE.Group(); lg.position.set(lx, 0.78, lz); horse.add(lg);
    add(new THREE.CylinderGeometry(0.055, 0.04, 0.78, 6), MAT.horseDk, 0, -0.39, 0, lg);
    legs.push(lg);
  }
  add(box(1.06, 0.07, 0.5), MAT.silk3, 0, 1.33, 0.1, horse, { cast: false });   // saddle blanket
  // shafts
  for (const sx of [-0.42, 0.42]) { const sh = add(new THREE.CylinderGeometry(0.035, 0.035, 1.6, 6), MAT.woodDk, sx, 0.82, 0.95, g); sh.rotation.x = Math.PI / 2 - 0.06; }
  // cart bed + rails + load
  add(tbox(1.5, 0.12, 1.9, 2), MAT.cartWood, 0, 0.78, 0, g);
  for (const sx of [-0.72, 0.72]) add(tbox(0.07, 0.42, 1.9, 2), MAT.cartWood, sx, 1.05, 0, g);
  add(tbox(1.5, 0.42, 0.07, 2), MAT.cartWood, 0, 1.05, -0.92, g);
  add(tbox(1.5, 0.3, 0.07, 2), MAT.cartWood, 0, 0.99, 0.92, g);
  add(box(0.9, 0.16, 0.5), MAT.woodDk, 0, 0.92, 1.02, g, { cast: false });   // driver seat board
  if (rich) {
    add(box(0.95, 0.4, 0.7), MAT.silk1, -0.1, 1.06, -0.35, g, { cast: false });
    add(box(0.8, 0.34, 0.6), MAT.silk2, 0.08, 1.4, -0.4, g, { cast: false });
    add(box(0.6, 0.3, 0.5), MAT.silk3, -0.15, 1.06, 0.38, g, { cast: false });
  } else {
    add(new THREE.CylinderGeometry(0.3, 0.26, 0.55, 9), MAT.woodDk, -0.3, 1.12, -0.4, g, { cast: false });
    add(new THREE.CylinderGeometry(0.26, 0.22, 0.45, 9), MAT.wood, 0.32, 1.07, -0.5, g, { cast: false });
    const sack = add(new THREE.SphereGeometry(0.34, 9, 7), MAT.bamboo, 0.05, 1.05, 0.35, g, { cast: false }); sack.scale.set(1, 0.78, 1);
  }
  // wheels (axle along x at z=0)
  const mkWheel = (sx) => {
    const wg = new THREE.Group(); wg.position.set(sx, 0.55, 0); g.add(wg);
    const tyre = add(new THREE.CylinderGeometry(0.55, 0.55, 0.07, 14), MAT.wheel, 0, 0, 0, wg); tyre.rotation.z = Math.PI / 2;
    for (let i = 0; i < 4; i++) { const sp = add(box(0.05, 1.0, 0.05), MAT.woodDk, 0, 0, 0, wg, { cast: false }); sp.rotation.x = i * Math.PI / 4; }
    add(new THREE.SphereGeometry(0.1, 8, 6), MAT.hub, 0, 0, 0, wg, { cast: false });
    return wg;
  };
  const wheels = [mkWheel(-0.82), mkWheel(0.82)];
  let canopy = null, canopyMesh = null;
  if (rich) {
    canopy = new THREE.Group(); g.add(canopy);
    for (const [px, pz] of [[-0.68, 0.75], [0.68, 0.75], [-0.68, -0.75], [0.68, -0.75]])
      add(new THREE.CylinderGeometry(0.03, 0.03, 1.05, 6), MAT.woodDk, px, 1.35, pz, canopy, { cast: false });
    const cg = new THREE.PlaneGeometry(1.7, 2.0, 8, 8); cg.rotateX(-Math.PI / 2);
    canopyMesh = new THREE.Mesh(cg, MAT.canopy); canopyMesh.position.set(0, 1.92, 0); canopyMesh.castShadow = true; canopy.add(canopyMesh);
    FX.clothInit(canopyMesh, { amp: 0.05, freq: 2.2 });
  }
  return { g, wheels, legs, canopyMesh };
};
const cart1 = mkCart(false);
const cart2 = mkCart(true);

// ---------- boards (transforms mirrored in boards.json — keep in sync) ----------
const boardTitle = textBoard([' THE MONKEY WHO ', 'COLLECTED THE TOLL'], 3.9, 1.2, '#173a2e', '#ffe9a8');
boardTitle.position.set(...BOARD_POS); world.add(boardTitle); addBoardOccluder(boardTitle, 3.9, 1.2, 'boardTitle');
const boardHook = textBoard([' HOW DID AN UMBRELLA OPEN ', ' ALL BY ITSELF — BEFORE ', ' THE RAIN ARRIVED? '], 4.3, 1.6, '#2e1a3a', '#ffd76a');
boardHook.position.set(...BOARD_POS); world.add(boardHook); addBoardOccluder(boardHook, 4.3, 1.6, 'boardHook');

// ---------- signature VFX: dappled leaf light ----------
const dappleTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d'); g.clearRect(0, 0, 512, 512);
  for (let i = 0; i < 240; i++) {
    const x = Math.random() * 512, y = Math.random() * 512, r = 6 + Math.random() * 22;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,246,200,0.55)'); grd.addColorStop(1, 'rgba(255,246,200,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2);
  return t;
})();
const dappleMat = new THREE.MeshBasicMaterial({ map: dappleTex, transparent: true, opacity: 0.16, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
const dapple = flat(new THREE.Mesh(new THREE.PlaneGeometry(17, 20), dappleMat));
dapple.position.set(0.4, 0.035, -1); dapple.userData.ndSkip = true; dapple.renderOrder = 1; world.add(dapple);

// ---------- bunting between the gate posts and the trees ----------
const buntFlags = [];
{
  const cols = ['#e8912d', '#c22e6e', '#3a7ab5', '#f2c531', '#3f9e4d'];
  const spans = [[[-2.3, 2.62, 0], [-6.0, 3.6, 1.8]], [[2.3, 2.62, 0], [6.3, 3.4, 2.6]]];
  spans.forEach(([A, B], si) => {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const u = i / 16;
      pts.push(new THREE.Vector3(
        A[0] + (B[0] - A[0]) * u,
        A[1] + (B[1] - A[1]) * u - Math.sin(u * Math.PI) * 0.35,
        A[2] + (B[2] - A[2]) * u));
    }
    const line = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.012, 4), MAT.rope);
    line.castShadow = false; world.add(line);
    for (let i = 1; i < 8; i++) {
      const u = i / 8, p = pts[Math.round(u * 16)];
      const sh = new THREE.Shape(); sh.moveTo(-0.11, 0); sh.lineTo(0.11, 0); sh.lineTo(0, -0.26); sh.lineTo(-0.11, 0);
      const fm = new THREE.Mesh(new THREE.ShapeGeometry(sh), toon({ color: cols[(i + si * 2) % 5], side: THREE.DoubleSide }));
      fm.position.copy(p); fm.userData.ph = i * 1.31 + si * 2.2; fm.castShadow = false;
      world.add(fm); buntFlags.push(fm);
    }
  });
}

// ---------- parrots circling the clearing ----------
const mkParrot = (mat) => {
  const grp = new THREE.Group();
  const bd = add(new THREE.ConeGeometry(0.09, 0.5, 7), mat, 0, 0, 0, grp, { cast: false }); bd.rotation.x = Math.PI / 2;
  add(new THREE.SphereGeometry(0.1, 8, 6), mat, 0, 0.05, 0.28, grp, { cast: false });
  const bk = add(new THREE.ConeGeometry(0.045, 0.16, 6), MAT.beak, 0, 0.03, 0.42, grp, { cast: false }); bk.rotation.x = Math.PI / 2;
  const wingL = new THREE.Group(); wingL.position.set(-0.06, 0.03, 0); grp.add(wingL);
  add(box(0.42, 0.014, 0.16), mat, -0.21, 0, 0, wingL, { cast: false });
  const wingR = new THREE.Group(); wingR.position.set(0.06, 0.03, 0); grp.add(wingR);
  add(box(0.42, 0.014, 0.16), mat, 0.21, 0, 0, wingR, { cast: false });
  const tailP = add(box(0.09, 0.014, 0.34), MAT.parrotG, 0, -0.02, -0.36, grp, { cast: false });
  grp.scale.setScalar(1.35); world.add(grp);
  return { grp, wingL, wingR };
};
const parrots = [mkParrot(MAT.parrotG), mkParrot(MAT.parrotR)];

// ---------- FX: light-shaft motes + leaf drift + clouds + dust bursts ----------
const smoke = new FX.Smoke(scene, 120); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const moteEmit = smoke.addEmitter(0.5, 2.4, -1.2, { rate: 0, color: 0xffe9b0, opacity: 0.10, scale: 0.32, grow: 1.15, life: 3.2, vy: 0.05, wind: 0.22 });
const leafEmit = smoke.addEmitter(-3.4, 3.4, -3.4, { rate: 0, color: 0x9ec46a, opacity: 0.13, scale: 0.3, grow: 1.0, life: 3.6, vy: -0.16, wind: 0.3 });
const fxClouds = new FX.Clouds(scene, { count: 5, y: 48, opacity: 0.2, color: 0xf6f8fa, drift: 0.5 });
fxClouds.items.forEach((cl) => { cl.userData.x0 = cl.position.x; cl.traverse((m) => { m.userData.ndSkip = true; }); });
let fxF = -1;
const fxReset = () => {
  smoke.pool.forEach((p) => { p.life = -1; p.s.visible = false; }); smoke.emitters.forEach((e) => { e.acc = 0; });
  fxClouds.items.forEach((cl) => { cl.position.x = cl.userData.x0; });
};
const fxStepTo = (f) => {
  if (f === fxF) return;
  if (f < fxF || f > fxF + 240) { fxReset(); fxF = -1; }
  while (fxF < f) {
    fxF++; const t = fxF / 30, dt = 1 / 30, pr = fxProfileAt(fxF);
    moteEmit.rate = pr.smokeRate * 2.4; leafEmit.rate = pr.dustRate * 1.6;
    smoke.update(t, dt);
    fxClouds.update(t, dt);
  }
};
// dust bursts (parametric arcs, land and stop) at wheels / landings / hops
const puffTex = P.tex(P.radial('216,196,160', 0.55));
const mkBurst = (key) => {
  const mat = new THREE.MeshBasicMaterial({ map: puffTex, transparent: true, opacity: 0, depthWrite: false, fog: true });
  const parts = [];
  for (let i = 0; i < 10; i++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.4), mat);
    p.userData = { a: (i / 10) * Math.PI * 2 + key.length, r: 0.4 + (i % 4) * 0.22, h: 0.5 + (i % 3) * 0.3 };
    p.visible = false; p.userData.ndSkip = true; p.renderOrder = 3; scene.add(p); parts.push(p);
  }
  return { key, mat, parts };
};
const bursts = [mkBurst('dustCart'), mkBurst('dustMerch'), mkBurst('dustTroop'), mkBurst('dustMonkey')];
const BURST_POS = {
  dustCart: () => { const c = cart1At(curF); return [0, 0.14, c.z - 0.8]; },
  dustMerch: () => { const c = merchAt(curF); return [0, 0.14, c.z - 0.8]; },
  dustTroop: () => [0, 0.14, -1.35],
  dustMonkey: () => { const m = monkeyAt(curF); return [m.x, 0.14, m.z]; },
};
let curF = 0;

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
  sat: { value: 1.08 }, lift: { value: new THREE.Color(0, 0, 0) }, gain: { value: new THREE.Color(1, 1, 1) }, vig: { value: 0.22 }, flash: { value: 0 } };
const inkScene = fs(new THREE.ShaderMaterial({ uniforms: inkU, vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: `uniform sampler2D col, nd; uniform vec2 res; uniform float px, sat, vig, flash; uniform vec3 fogCol, lift, gain; varying vec2 vUv;
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
    vec2 q = vUv-.5; c *= 1. - vig*dot(q*vec2(1.,.75), q*vec2(1.,.75))*2.2;
    c = mix(c, flash < 0. ? vec3(0.) : vec3(1.), clamp(abs(flash), 0., 1.));
    gl_FragColor = vec4(c,1.); }` }));
const dofU = { src: { value: rtInk.texture }, nd: { value: rtNd.texture }, res: { value: new THREE.Vector2(W, H) }, focus: { value: 5 }, cinf: { value: 0 }, near: { value: 1 } };
const dofScene = fs(new THREE.ShaderMaterial({ uniforms: dofU, vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: `uniform sampler2D src, nd; uniform vec2 res; uniform float focus, cinf, near; varying vec2 vUv;
  float coc(vec2 uv){ float d = texture2D(nd, uv).a; if (d <= 0.) d = 2000.; float k = 1. - focus/d; return k > 0. ? cinf*k : min(-k*cinf*near, cinf*1.4); }
  void main(){
    float c0 = coc(vUv);
    if (cinf < .5 || c0 < .6) { gl_FragColor = linearToOutputTexel(vec4(texture2D(src, vUv).rgb, 1.)); return; }
    vec3 acc = vec3(0.); float wsum = 0.;
    for (int i=0;i<48;i++){ float fi = float(i); float r = sqrt((fi+.5)/48.); float a = fi*2.39996;
      vec2 o = vec2(cos(a), sin(a))*r*c0/res; float cs = coc(vUv+o);
      float w = smoothstep(r*c0-1.5, r*c0+.5, cs + .5);
      acc += texture2D(src, vUv+o).rgb*w; wsum += w; }
    gl_FragColor = linearToOutputTexel(vec4(acc/max(wsum,1e-3), 1.)); }` }));
dofScene.children[0].material.toneMapped = false;

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
  curF = f;
  fxStepTo(f);
  skyU.time.value = f / 30;
  const setB = (mesh, v) => { mesh.material.opacity = v; mesh.visible = v > 0.01; };
  setB(boardTitle, Ws.boardTitle || 0); setB(boardHook, Ws.boardHook || 0);
  scene.traverse((o) => { if (o.userData.isOccluder) o.visible = o.userData.boardKey === 'always' || (Ws[o.userData.boardKey] || 0) > 0.01; });
  // gate + platform + ropes: ONE physics driver (story kAt)
  gatePivot.rotation.z = -Ws.barrierAng;
  platGroup.position.y = Ws.deckTop - PLAT.top;
  const deckY = Ws.deckTop;
  setRope(rope1, [PLAT.x - 0.62, deckY, 1.0], [PULLEY[0], PULLEY[1] - 0.08, PULLEY[2]]);
  const ca = Math.cos(Ws.barrierAng), sa = Math.sin(Ws.barrierAng);
  setRope(rope2, [PULLEY[0], PULLEY[1] + 0.02, PULLEY[2]], [GATE.postR[0] - 3.3 * ca, GATE.pivotY + 3.3 * sa, 0.35]);
  // the monkey (3D hero)
  const mk = monkeyAt(f);
  monkey.g.position.set(mk.x, mk.y, mk.z);
  monkey.g.rotation.y = mk.yaw;
  monkey.jaw.rotation.x = (Ws.screechK || 0) * 0.6;
  monkey.headG.rotation.x = (Ws.napK || 0) * 0.34 + (Ws.screechK || 0) * -0.12;
  monkey.headG.rotation.y = Math.sin(f * 0.021) * 0.08;
  monkey.tail.rotation.z = 1.9 + Math.sin(f * 0.05) * 0.1;
  if (monkey.capG) { const ck = Ws.capK || 0; monkey.capG.visible = ck > 0.01; monkey.capG.scale.setScalar(Math.max(ck, 0.001)); }
  monkeyGlow.material.opacity = (Ws.glowK || 0) * 0.30;
  monkeyGlow.position.set(mk.x, mk.y + 0.75, mk.z);
  // the troop
  for (let i = 0; i < 6; i++) {
    const tp = troopAt(i, f), m = troop[i];
    m.g.position.set(tp.x, tp.y, tp.z);
    m.g.rotation.y = tp.x < 0 ? Math.PI / 2 - 0.25 : -Math.PI / 2 + 0.25;
    m.g.rotation.x = tp.state === 'fall' ? -0.35 : tp.state === 'climb' ? 0.3 : 0;
    m.jaw.rotation.x = (Ws.screechK || 0) * 0.45;
    m.tail.rotation.z = 1.9 + Math.sin(f * 0.06 + i * 1.7) * 0.12;
  }
  // carts (wheels roll with the story's accumulated rotation; legs trot)
  const c1 = cart1At(f), c2 = merchAt(f);
  cart1.g.position.set(0, 0, c1.z); cart2.g.position.set(0, 0, c2.z);
  const trot1 = Math.min(1, (Ws.dustCart || 0) * 4), trot2 = Math.min(1, (Ws.dustMerch || 0) * 4);
  for (const [cart, wr, trot] of [[cart1, Ws.cartWheel || 0, trot1], [cart2, Ws.merchWheel || 0, trot2]]) {
    cart.wheels.forEach((w) => { w.rotation.x = wr; });
    cart.legs.forEach((lg, li) => { lg.rotation.x = Math.sin(f * 0.42 + (li % 2) * Math.PI + (li > 1 ? 0.6 : 0)) * 0.30 * trot; });
  }
  if (cart2.canopyMesh) FX.clothWave(cart2.canopyMesh, f / 30);
  // bananas ride their story tracks
  const b1 = banana1At(f); banana1.position.set(...b1.p); banana1.visible = b1.vis > 0; banana1.rotation.y = f * 0.02;
  const b2 = banana2At(f); banana2.position.set(...b2.p); banana2.visible = b2.vis > 0; banana2.rotation.y = -f * 0.015;
  // dappled leaf light drifts; bunting sways in gusts
  dappleTex.offset.set(f * 0.00055, f * 0.00032);
  dappleMat.opacity = 0.13 + 0.045 * Math.sin(f * 0.017);
  const gst = MO.gust(f / 30, 3);
  buntFlags.forEach((fm) => { fm.rotation.z = Math.sin(f * 0.09 + fm.userData.ph) * 0.28 * gst; fm.rotation.x = Math.cos(f * 0.07 + fm.userData.ph) * 0.12 * gst; });
  // dust bursts
  for (const b of bursts) {
    const kk = Ws[b.key] || 0, on = kk > 0.01 && kk < 0.99, bp = BURST_POS[b.key]();
    b.mat.opacity = on ? (1 - kk) * 0.5 : 0;
    for (const p of b.parts) {
      p.visible = on;
      if (!on) continue;
      const rr = 0.15 + p.userData.r * kk * 1.6;
      p.position.set(bp[0] + Math.cos(p.userData.a) * rr, bp[1] + 1.35 * kk * (1 - kk) * p.userData.h + 0.03, bp[2] + Math.sin(p.userData.a) * rr);
      p.rotation.y = Math.atan2(camera.position.x - p.position.x, camera.position.z - p.position.z);
    }
  }
  // parrots circle the clearing
  parrots.forEach((gl, i) => {
    const cx = i ? -4 : 1, cz = i ? 5 : -3, cr = i ? 8 : 10.5, cy = i ? 10.5 : 12.5;
    const a = f * 0.008 * (i ? -1 : 1) + i * 2.4;
    gl.grp.position.set(cx + Math.cos(a) * cr, cy + Math.sin(f * 0.014 + i * 2.1) * 0.6, cz + Math.sin(a) * cr);
    gl.grp.rotation.y = Math.atan2(Math.cos(a) * (i ? -1 : 1), -Math.sin(a) * (i ? -1 : 1)) + (i ? Math.PI : 0);
    const flap = 0.25 + 0.55 * Math.sin(f * 0.34 + i * 1.4);
    gl.wingL.rotation.z = flap; gl.wingR.rotation.z = -flap;
  });
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
window.renderFrame = (f) => {
  const S = shotAt(f), L = lightFor(S, f), C = camAt(f);
  applyLight(L, f);
  camera.position.set(...C.pos); camera.up.set(0, 1, 0); camera.lookAt(...C.look); camera.rotateZ(rx(C.roll || 0));
  camera.fov = C.fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  const Ws = worldAt(f); worldState(Ws, f);
  placeSun(L, new THREE.Vector3(...(C.shadowAt || C.look)));
  drawActors(actorsAt(f, T), camera);
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
  return true;
};
window.TOTAL = TOTAL;
window.ready = true;
