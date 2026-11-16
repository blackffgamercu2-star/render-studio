import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import * as PR from './props.js';
import * as M4 from './materials.js';
import { M, gust } from './motion.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, fxBurstsAt, BOARD_POS, UMB, STALLS, HEROSTALL, RIVALSTALL, CARTP, STOCKB, LAMPS } from './story.js';

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
  fragmentShader: `uniform sampler2D map; varying vec2 vUv; varying float vD; void main(){ if(texture2D(map,vUv).a<.5) discard; gl_FragColor = vec4(0.,0.,0.,vD); }`,
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

// ---------- text-board helper (canvas texture plane; boards are in-world props) ----------
const textBoard = (lines, w, h, bg, fg, font = 900, fit = null) => {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w);
  const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = fg; g.lineWidth = 14; g.strokeRect(20, 20, c.width - 40, c.height - 40);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  let fs = Math.min(170, (c.width - 130) / Math.max(...lines.map((l) => l.length)) * 1.72);
  if (fit && fit.fsMul) fs *= fit.fsMul;
  g.font = `${font} ${fs}px 'Noto Sans Devanagari', Arial`;
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
const canopyCanvas = (() => {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#7e2f28' : '#a03a30'; g.fillRect(i * 32, 0, 32, 128); }
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(30,16,14,${Math.random() * 0.08})`; g.fillRect(Math.random() * 512, Math.random() * 128, 3, 3); }
  g.fillStyle = 'rgba(255,220,190,0.10)'; g.fillRect(0, 0, 512, 10);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping;
  return t;
})();
const MAT = {
  ground: texM(M4.groundDetail(P.dirt(35), 171, { dots: 2600 }), 14, 10, '#8d8272'),
  stone: texM(M4.groundDetail(P.stone(64, 40, 5, 58), 191, { dots: 1200 }), 3, 2, '#b0a894'),
  wood: texM(M4.woodV4(66), 1, 2), woodDk: texM(M4.woodV4(67), 1, 2),
  plaster: texM(P.plaster(71, 36), 2, 2),
  canopy: toon({ map: canopyCanvas }),
  brass: new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.85, roughness: 0.35, envMap, envMapIntensity: 1.1 }),
  iron: toon({ color: '#3a3f45' }),
  hair: toon({ color: '#191410' }),
  lampGlass: new THREE.MeshBasicMaterial({ color: 0xffca7a, transparent: true, opacity: 0, fog: true }),
  white: toon({ color: '#e9e6da' }),
  sack: toon({ color: '#8a6f42' }), sack2: toon({ color: '#6d7a3a' }),
  pot: toon({ color: '#7a4a34' }), pot2: toon({ color: '#4a5a68' }),
};
const wetMat = new THREE.MeshStandardMaterial({ color: 0x2c343a, roughness: 0.18, metalness: 0.05, transparent: true, opacity: 0, envMap, envMapIntensity: 0.9 });

// ---------- the market ----------
const world = new THREE.Group(); scene.add(world);
let wetPlane;
const awnings = [];
const mkAwning = (parent, w, d, colSeed, x, y, z, ry, slope = 0.42) => {
  const cols = ['#7d8a94', '#8a6f5e', '#5f7263', '#77686e'];
  const geo = new THREE.PlaneGeometry(w, d, 12, 6);
  const m = new THREE.Mesh(geo, toon({ color: cols[colSeed % 4], side: THREE.DoubleSide }));
  m.position.set(x, y, z); m.rotation.set(-Math.PI / 2 + slope, 0, 0);
  const holder = new THREE.Group(); holder.position.set(x, y, z); holder.rotation.y = ry;
  m.position.set(0, 0, 0); holder.add(m); parent.add(holder);
  FX.clothInit(m, { amp: 0.05, freq: 2.4, speed: 3.0 });
  m.castShadow = true; m.receiveShadow = true;
  awnings.push({ mesh: m, seed: colSeed + 3 });
  return holder;
};
const mkStall = (x, z, ry, seed, withGoods = true) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; world.add(g);
  for (const sx of [-1.7, 1.7]) for (const sz of [-0.55, 0.55])
    add(new THREE.CylinderGeometry(0.055, 0.065, 2.6, 7), MAT.woodDk, sx, 1.3, sz, g, { cast: false });
  add(tbox(3.8, 0.09, 1.5, 2), MAT.wood, 0, 1.02, 0.1, g, { cast: false });          // counter top
  add(tbox(3.6, 0.85, 1.1, 2), MAT.woodDk, 0, 0.5, 0.1, g, { cast: false });        // counter body
  add(tbox(3.8, 0.08, 0.7, 2), MAT.wood, 0, 1.95, -0.5, g, { cast: false });        // back shelf
  mkAwning(g, 4.3, 2.2, seed, 0, 2.78, 0.15, 0);
  if (withGoods) {
    add(new THREE.SphereGeometry(0.34, 9, 7), MAT.sack, -1.1, 1.28, 0.15, g, { cast: false }).scale.set(1, 0.78, 1);
    add(new THREE.SphereGeometry(0.28, 9, 7), MAT.sack2, -0.5, 1.24, 0.3, g, { cast: false }).scale.set(1, 0.8, 1);
    add(new THREE.CylinderGeometry(0.2, 0.26, 0.5, 9), MAT.pot, 0.7, 1.3, 0.1, g, { cast: false });
    add(new THREE.CylinderGeometry(0.16, 0.22, 0.42, 9), MAT.pot2, 1.25, 1.26, 0.25, g, { cast: false });
  }
  return g;
};
{
  const g = world;
  const ground = flat(add(new THREE.CircleGeometry(1, 48), MAT.ground, 0, 0, 0, g, { cast: false })); ground.scale.set(46, 34, 1);
  wetPlane = flat(add(new THREE.CircleGeometry(1, 48), wetMat, 0, 0.006, 0, g, { cast: false })); wetPlane.scale.set(46, 34, 1); wetPlane.userData.ndSkip = true;
  // the river along the west edge (fog source) — dark water strip + far bank
  const river = FX.makeWater({ size: 90, seg: 40, deep: 0x24333c, shallow: 0x3d5a68, sky: 0x9fb2bc, amp: 0.12, spark: 0.25 });
  river.rotation.z = Math.PI / 2; river.position.set(-26, -0.25, 0); river.scale.set(1, 0.24, 1); g.add(river);
  g.userData.river = river;
  flat(add(new THREE.PlaneGeometry(10, 68), MAT.stone, -19.5, 0.01, 0, g, { cast: false }));   // stone bank strip
  // stalls: hero + rival + back row
  mkStall(HEROSTALL.x, HEROSTALL.z, HEROSTALL.ry, 1);
  mkStall(RIVALSTALL.x, RIVALSTALL.z, RIVALSTALL.ry, 2);
  STALLS.forEach((s, i) => mkStall(s.x, s.z, s.ry, i + 3));
  // hero-stall sign
  const sign = textBoard(['UMBRELLAS'], 1.9, 0.55, '#26333c', '#ffd76a');
  sign.position.set(HEROSTALL.x, 2.35, HEROSTALL.z + 0.95); sign.rotation.y = 0.06; g.add(sign);
  addBoardOccluder(sign, 1.9, 0.55, 'always');
  // crates + stock barrel + cart
  add(tbox(0.75, 0.75, 0.75, 2), MAT.wood, -6.25, 0.38, -1.45, g, { cast: false });
  add(tbox(0.62, 0.62, 0.62, 2), MAT.woodDk, -6.2, 1.06, -1.4, g, { cast: false });
  add(new THREE.CylinderGeometry(0.4, 0.44, 0.95, 11), MAT.woodDk, STOCKB[0], 0.48, STOCKB[1], g, { cast: false });
  const cartB = PR.buildCart({ envMap, seed: 19 });
  cartB.group.position.set(CARTP[0], 0, CARTP[1]); cartB.group.rotation.y = 0.7; g.add(cartB.group);
  // lamp posts (practical lights for the fog evening)
  for (const [lx, lz] of LAMPS) {
    add(new THREE.CylinderGeometry(0.07, 0.09, 3.4, 8), MAT.iron, lx, 1.7, lz, g, { cast: false });
    add(box(0.34, 0.44, 0.34), MAT.iron, lx, 3.55, lz, g, { cast: false });
    const glass = add(box(0.26, 0.34, 0.26), MAT.lampGlass, lx, 3.55, lz, g, { cast: false });
    glass.userData.ndSkip = true; glass.userData.isLampGlass = true;
    const glow = softGlow(2.6, '#ffb45e', 0); glow.position.set(lx, 3.55, lz); g.add(glow);
    glow.userData.isLampGlow = true;
  }
  // bunting between the hero stall and the rival stall (gust sway)
  const bunt = new THREE.Group(); g.add(bunt); g.userData.bunting = bunt;
  const cols = ['#a03a30', '#c9a24a', '#44607a', '#6d7a3a'];
  for (let i = 0; i < 14; i++) {
    const u = i / 13, bx = -3.2 + u * 8.2, bz = -1.4 + Math.sin(u * Math.PI) * 0.5, by = 3.05 - Math.sin(u * Math.PI) * 0.35;
    const flag = add(new THREE.PlaneGeometry(0.3, 0.4), toon({ color: cols[i % 4], side: THREE.DoubleSide }), bx, by, bz, bunt, { cast: false });
    flag.userData.phase = i * 0.7;
  }
  // board posts (title + hook boards share this frame)
  for (const px of [BOARD_POS[0] - 1.8, BOARD_POS[0] + 1.8]) add(new THREE.CylinderGeometry(0.06, 0.07, 3.3, 7), MAT.woodDk, px, 1.65, BOARD_POS[2], g, { cast: false });
  add(tbox(3.9, 0.12, 0.12, 2), MAT.woodDk, BOARD_POS[0], 3.82, BOARD_POS[2], g, { cast: false });
}
// ---------- THE HERO UMBRELLA (stand + shaft + latch + spring canopy) ----------
const umbG = new THREE.Group(); umbG.position.set(UMB[0], 0, UMB[1]); world.add(umbG);
let canopy, canopyHub, runner, strand, latchBox;
const ribs = [];
{
  add(new THREE.CylinderGeometry(0.3, 0.38, 0.1, 10), MAT.iron, 0, 0.05, 0, umbG, { cast: false });       // stand base
  add(new THREE.CylinderGeometry(0.035, 0.045, 2.5, 8), MAT.woodDk, 0, 1.25, 0, umbG, { cast: false });    // shaft
  add(new THREE.SphereGeometry(0.06, 8, 7), MAT.brass, 0, 2.52, 0, umbG, { cast: false });                 // finial
  latchBox = add(box(0.13, 0.17, 0.13), MAT.brass, 0, 1.45, 0.06, umbG, { cast: false });                  // the spring latch
  strand = add(new THREE.CylinderGeometry(0.008, 0.008, 1, 4), MAT.hair, 0, 1.45, 0.1, umbG, { cast: false });
  strand.geometry.translate(0, 0.5, 0);                                                                    // pivot at latch
  runner = add(new THREE.CylinderGeometry(0.075, 0.075, 0.14, 9), MAT.iron, 0, 1.3, 0, umbG, { cast: false });
  canopyHub = new THREE.Group(); canopyHub.position.set(0, 2.48, 0); umbG.add(canopyHub);
  canopy = add(new THREE.ConeGeometry(1.2, 0.55, 24, 1, true), MAT.canopy, 0, -0.2, 0, canopyHub, { cast: false });
  canopy.material.side = THREE.DoubleSide;
  for (let i = 0; i < 8; i++) {
    const pivot = new THREE.Group(); pivot.rotation.y = i / 8 * Math.PI * 2; canopyHub.add(pivot);
    const rib = add(new THREE.CylinderGeometry(0.016, 0.02, 1.3, 5), MAT.woodDk, 0, 0, 0, pivot, { cast: false });
    rib.geometry.translate(0, -0.65, 0);
    ribs.push(pivot);
  }
}
// stock umbrellas in the barrel (closed minis; count from the story)
const stockMinis = [];
for (let i = 0; i < 6; i++) {
  const mg = new THREE.Group();
  const a = i / 6 * Math.PI * 2;
  mg.position.set(STOCKB[0] + Math.cos(a) * 0.16, 0.85, STOCKB[1] + Math.sin(a) * 0.16);
  mg.rotation.z = Math.cos(a) * 0.16; mg.rotation.x = Math.sin(a) * 0.16;
  world.add(mg);
  add(new THREE.CylinderGeometry(0.02, 0.025, 1.15, 6), MAT.woodDk, 0, 0.4, 0, mg, { cast: false });
  const cc = add(new THREE.ConeGeometry(0.13, 0.85, 10, 1, true), MAT.canopy, 0, 0.55, 0, mg, { cast: false });
  cc.material = MAT.canopy;
  stockMinis.push(mg);
}
// ---------- boards ----------
const boardTitle = textBoard(['बारिश को पहचानने', 'वाली छतरी'], 3.9, 1.2, '#26333c', '#e8f0f2');
boardTitle.position.set(...BOARD_POS); world.add(boardTitle); addBoardOccluder(boardTitle, 3.9, 1.2, 'boardTitle');
const boardHook = textBoard(['लेकिन कल...', 'पत्थर की मूर्ति ने', 'पूरे गाँव के सामने दूध का', 'पूरा कटोरा कैसे पी लिया?'], 3.9, 1.35, '#2c3242', '#ffd76a', 900, { pitch: 0.21, dy: 0.02 });
boardHook.position.set(...BOARD_POS); world.add(boardHook); addBoardOccluder(boardHook, 3.9, 1.35, 'boardHook');

// ---------- FX: fog smoke + dust motes + clouds + rain + splashes ----------
const smoke = new FX.Smoke(scene, 130); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const fogEmit = smoke.addEmitter(-15, 0.7, 2, { rate: 0, color: 0xdfe7ea, opacity: 0.10, scale: 3.4, grow: 1.5, life: 4.5, vy: 0.05, wind: 1.1 });
const dustEmit = smoke.addEmitter(0, 1.4, 0, { rate: 0, color: 0xd8cfb8, opacity: 0.07, scale: 0.5, grow: 1.2, life: 2.4, vy: 0.1, wind: 0.2 });
const fxClouds = new FX.Clouds(scene, { count: 6, y: 46, opacity: 0.3, color: 0xb9c4ca, drift: 0.5 });
fxClouds.items.forEach((cl) => { cl.userData.x0 = cl.position.x; cl.traverse((m) => { m.userData.ndSkip = true; }); });
const rain = new FX.Rain(scene, { count: 700, area: 46, height: 30, cx: 0, cz: 0, y: 0, opacity: 0.92, color: 0xd4e2ec });
rain.points.userData.ndSkip = true; rain.points.visible = false;
const splash = new FX.Splashes(scene, 300);
splash.points.userData.ndSkip = true;
let fxF = -1;
const fxReset = () => {
  smoke.pool.forEach((p) => { p.life = -1; p.s.visible = false; }); smoke.emitters.forEach((e) => { e.acc = 0; });
  fxClouds.items.forEach((cl) => { cl.position.x = cl.userData.x0; });
  splash.life.fill(-1);
};
const fxStepTo = (f) => {
  if (f === fxF) return;
  if (f < fxF || f > fxF + 240) { fxReset(); fxF = -1; }
  while (fxF < f) {
    fxF++; const t = fxF / 30, dt = 1 / 30, pr = fxProfileAt(fxF);
    fogEmit.rate = pr.smokeRate; dustEmit.rate = pr.dustRate;
    smoke.update(t, dt);
    fxClouds.update(t, dt);
    rain.update(t);
    for (const aw of awnings) FX.clothWave2(aw.mesh, t, (tt) => gust(tt, aw.seed));
    const bursts = fxBurstsAt(fxF);
    for (const s of bursts.splash) splash.burst(s[0], s[1], s[2], { power: s[3] });
    splash.update(t, dt);
  }
};

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
const lerpN = (a, b, t) => a + (b - a) * t;
function worldState(Ws, f) {
  fxStepTo(f);
  skyU.time.value = f / 30;
  const setB = (mesh, v) => { mesh.material.opacity = v; mesh.visible = v > 0.01; };
  setB(boardTitle, Ws.boardTitle || 0); setB(boardHook, Ws.boardHook || 0);
  scene.traverse((o) => { if (o.userData.isOccluder) o.visible = o.userData.boardKey === 'always' || (Ws[o.userData.boardKey] || 0) > 0.01; });
  // THE UMBRELLA: spring canopy (overshoot comes from story's snap curve),
  // runner slides up the shaft, the hair strand stretches before each pop.
  const k = Ws.umbOpen || 0;
  canopy.scale.set(lerpN(0.15, 1, Math.min(k, 1.12)), lerpN(1.65, 0.62, Math.min(k, 1)), lerpN(0.15, 1, Math.min(k, 1.12)));
  canopy.position.y = lerpN(-0.62, -0.16, Math.min(k, 1));
  ribs.forEach((piv) => { const rib = piv.children[0]; rib.rotation.x = lerpN(0.1, 1.29, Math.min(k, 1.05)); rib.scale.y = lerpN(0.82, 1, Math.min(k, 1)); });
  runner.position.y = lerpN(1.28, 2.02, Math.min(k, 1));
  strand.scale.y = 0.32 + (Ws.latchK || 0) * 0.5 + Math.min(k, 1) * 0.3;
  strand.position.y = 1.45;
  latchBox.position.y = 1.45 + (Ws.latchK || 0) * 0.012;
  umbG.rotation.y = Math.sin(f * 0.011) * 0.02;
  // stock barrel empties as the umbrellas sell out
  stockMinis.forEach((mg, i) => { mg.visible = i < (Ws.stockN ?? 6); });
  // rain + wet ground sheen
  rain.points.visible = (Ws.rainK || 0) > 0.01;
  if (rain.points.visible) rain.uniforms.uOpacity.value = 0.92 * Ws.rainK;
  wetMat.opacity = (Ws.wetK || 0) * 0.5;
  // lamps wake up in the fog evening / dusk
  scene.traverse((o) => {
    if (o.userData.isLampGlass) o.material.opacity = (Ws.lampK || 0) * 0.92;
    if (o.userData.isLampGlow) o.material.opacity = (Ws.lampK || 0) * (0.5 + 0.07 * Math.sin(f * 0.4 + o.position.x));
  });
  // bunting sways in gusts (never a uniform wave)
  const bunt = world.userData.bunting;
  if (bunt) bunt.children.forEach((flag, i) => { flag.rotation.x = Math.sin(f * 0.09 + flag.userData.phase) * 0.32 * gust(f / 30, i + 2); flag.rotation.y = Math.sin(f * 0.05 + i) * 0.2; });
  const river = world.userData.river;
  if (river) river.userData.update(f / 30);
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
  return true;
};
window.TOTAL = TOTAL;
window.ready = true;
