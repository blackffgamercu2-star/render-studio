import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, dynAt, SPLASHES, ROCKC, ROCKTOP, SIGNP, CLIFF, SAILOR } from './story.js';

const W = 1080, H = 1920;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
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
const textBoard = (lines, w, h, bg, fg, font = 900) => {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w);
  const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = fg; g.lineWidth = 14; g.strokeRect(20, 20, c.width - 40, c.height - 40);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  const fs = Math.min(170, (c.width - 130) / Math.max(...lines.map((l) => l.length)) * 1.72);
  g.font = `${font} ${fs}px Arial`;
  lines.forEach((l, i) => g.fillText(l, c.width / 2, c.height * (lines.length === 1 ? 0.52 : (i + 0.5) / lines.length)));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, fog: true }));
  m.userData.ndSkip = true; return m;
};
const softGlow = (scale, color, opacity) => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad2 = g.createRadialGradient(32, 32, 1, 32, 32, 31);
  grad2.addColorStop(0, 'rgba(255,255,255,0.9)'); grad2.addColorStop(0.4, 'rgba(255,255,255,0.35)'); grad2.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad2; g.fillRect(0, 0, 64, 64);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(scale); s.userData.ndSkip = true; return s;
};

// ---------- the set ----------
const MAT = {
  grass: texM(P.grass(61), 16, 16, '#7fae4c'),
  dirt: texM(P.dirt(35), 8, 8, '#b49a72'),
  sand: texM(P.dirt(35), 8, 8, '#d9c49a'),
  stone: texM(P.stone(64, 40, 5, 58), 3, 2, '#c9c2b2'), stoneDk: texM(P.stone(65, 40, 6, 46), 3, 2, '#a89f8d'),
  wood: texM(P.beam(66, [26, 45, 32]), 1, 2), woodDk: texM(P.beam(67, [24, 40, 22]), 1, 2),
  plaster: texM(P.plaster(71, 36), 2, 2),
  thatch: toon({ color: '#b08d4f' }), leaf: toon({ color: '#4a6a34' }), leaf2: toon({ color: '#5d8142' }),
  gold: toon({ color: '#d9a441' }), goldBright: toon({ color: '#f0bc4a' }),
  iron: toon({ color: '#4a4a50' }), ironDk: toon({ color: '#2e2e33' }),
  sack: toon({ color: '#c9a24d' }), sackDk: toon({ color: '#a37f36' }),
  white: toon({ color: '#f7f3e6' }),
  dark: toon({ color: '#33302c' }),
  stoneGrey: toon({ color: '#8f8a80' }),
  rockFace: toon({ color: '#7a7268' }),
  shadowSoft: new THREE.MeshBasicMaterial({ color: 0x1a2410, transparent: true, opacity: 0.34, fog: true }),
};
const world = new THREE.Group(); scene.add(world);
{
  const g = world;
  flat(add(new THREE.PlaneGeometry(340, 240), MAT.grass, 0, -0.03, 0, g, { cast: false }));
  flat(add(new THREE.CircleGeometry(9.5, 24), MAT.dirt, 0, -0.008, 0.2, g, { cast: false }));   // the valley floor
  // distant mountain cones behind the cliff wall
  for (const [mx, mz, s] of [[0, -15, 1], [-13, -13, 0.85], [13, -14, 0.9], [24, -16, 1.1]]) {
    const m = add(new THREE.ConeGeometry(7 * s, 11 * s, 4), MAT.rockFace, mx, 5.5 * s, mz, g, { cast: false });
    m.rotation.y = Math.PI / 4;
  }
  // pines at the valley sides
  for (const [tx, tz, s] of [[-8.5, -6.5, 1], [8.5, -6, 1.15], [-11, -2, 0.9]]) {
    add(new THREE.CylinderGeometry(0.3 * s, 0.44 * s, 2.8 * s, 8), MAT.woodDk, tx, 1.4 * s, tz, g, { cast: false });
    const can = add(new THREE.ConeGeometry(1.9 * s, 3.4 * s, 8), MAT.leaf, tx, 4.2 * s, tz, g, { cast: false });
    can.userData.ndSkip = true;
  }
}
// ================= MOUNTAIN VALLEY (x=0, cliff face z=-6.75) =================
{
  const g = world;
  // cliff wall: three staggered rock blocks, front face at z=-6.75
  // (big stone slabs, not brick courses), centre block tallest
  const cliffH = [6.2, 7.2, 6.5];
  [-6, 0, 6].forEach((cx, i) => add(tbox(6, cliffH[i], 1.5, 10), MAT.stone, cx, cliffH[i] / 2, -7.5, g, { cast: false }));
  // jutting boulders at the wall base break the flat plane
  for (const [bx, bz, s] of [[-3.4, -6.1, 1.3], [2.8, -6.2, 1.1], [6.4, -6.0, 0.9]]) {
    const b = add(new THREE.SphereGeometry(0.6 * s, 10, 8), MAT.stoneDk, bx, 0.3 * s, bz, g);
    b.scale.y = 0.75;
  }
  // jutting rock slabs on the wall face (kept clear of the board zone x -2..2, y 3..4.8)
  for (const [sx, sy, sz, w, h, d, ry] of [[-4.2, 1.6, -6.35, 2.2, 3.2, 0.7, 0.15], [4.6, 1.0, -6.4, 1.8, 2.4, 0.6, -0.12], [-7.6, 2.4, -6.35, 2.0, 3.0, 0.7, 0.1]]) {
    const sl = add(tbox(w, h, d, 6), MAT.stoneDk, sx, sy, sz, g, { cast: false });
    sl.rotation.y = ry;
  }
  // side cliffs closing the valley
  for (const sx of [-9.5, 9.5]) add(tbox(1.5, 6, 8, 2), MAT.stone, sx, 3, -3, g, { cast: false });
  // the poor man's hut (stone + thatch), door facing the camera
  add(tbox(2.4, 1.6, 2.0, 2), MAT.stone, -3.8, 0.8, -3.6, g, { cast: false });
  add(new THREE.ConeGeometry(2.0, 1.1, 4), MAT.thatch, -3.8, 2.15, -3.6, g, { cast: false }).rotation.y = Math.PI / 4;
  add(tbox(0.9, 1.4, 0.1, 2), MAT.dark, -3.8, 0.7, -2.58, g, { cast: false });
  // crate + barrel by the hut, both resting ON the ground, clear of the hut walls
  const c1 = FX.crate(1.0); c1.position.set(-6.0, 0.5, -1.6); g.add(c1);
  const b1 = FX.barrel(0.45, 1.1); b1.position.set(-5.2, 0.55, -1.2); g.add(b1);
  // THE PAYMENT ROCK — flat-topped stone; pouch rests ON its top (y=0.32)
  add(tbox(0.7, 0.32, 0.5, 2), MAT.stone, ROCKC[0], 0.16, ROCKC[2], g, { cast: false });
  flat(add(new THREE.CircleGeometry(0.55, 14), MAT.shadowSoft, ROCKC[0], 0.015, ROCKC[2], g, { cast: false }));
  // scattered boulders, all grounded
  for (const [bx, bz, s] of [[-6.2, 1.2, 0.8], [5.8, 0.6, 1.0], [4.4, -4.4, 0.7], [-5.6, -5.0, 0.9]]) {
    const b = add(new THREE.SphereGeometry(0.5 * s, 10, 8), MAT.stoneDk, bx, 0.22 * s, bz, g);
    b.scale.y = 0.6;
  }
}
// ---- dynamic props (positions from story dynAt) ----
const mkDyn = (build) => { const grp = new THREE.Group(); build(grp); grp.visible = false; world.add(grp); return grp; };
// THE COIN POUCH — tied sack with gold coins peeking out
const dynPouch = mkDyn((g) => {
  const b = add(new THREE.SphereGeometry(0.15, 10, 8), MAT.sack, 0, 0, 0, g); b.scale.y = 0.85;
  add(new THREE.CylinderGeometry(0.05, 0.07, 0.08, 8), MAT.sackDk, 0, 0.12, 0, g);
  const coin = add(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 10), MAT.goldBright, 0.06, 0.14, 0.03, g); coin.rotation.x = 0.4;
});
// contact shadow that lives ON the rock top, only while the pouch rests
const pouchShadow = flat(add(new THREE.CircleGeometry(0.22, 12), MAT.shadowSoft, ROCKC[0], ROCKTOP + 0.005, ROCKC[2], world, { cast: false }));
pouchShadow.visible = false;
// ---- echo rings — expanding from the cliff face on every echo answer ----
const echoRingMat = () => new THREE.MeshBasicMaterial({ color: '#ffe9a8', transparent: true, opacity: 0, depthWrite: false, fog: true });
const echoRing1 = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 8, 40), echoRingMat());
echoRing1.position.set(0, 2.4, -6.5); echoRing1.userData.ndSkip = true; echoRing1.visible = false; world.add(echoRing1);
const echoRing2 = new THREE.Mesh(new THREE.TorusGeometry(1, 0.04, 8, 40), echoRingMat());
echoRing2.position.set(0, 2.4, -6.5); echoRing2.userData.ndSkip = true; echoRing2.visible = false; world.add(echoRing2);
// ================= THE SEA (x=+28) =================
const water = FX.makeWater({ size: 40, amp: 0.08 });
water.position.set(30, 0.02, -10); world.add(water);
{
  const g = world;
  // sand beach the sailor stands on (y=0.16, above the wave crests)
  flat(add(new THREE.CircleGeometry(7, 24), MAT.sand, 28, 0.16, -0.5, g, { cast: false }));
  // the merchant's ship at anchor, hull clear of the waves
  const boat = new THREE.Group(); boat.position.set(33.5, 0.3, -9); boat.rotation.y = 0.4; g.add(boat);
  add(tbox(2.6, 0.5, 1.0, 2), MAT.wood, 0, 0, 0, boat);
  add(new THREE.ConeGeometry(0.5, 0.9, 4), MAT.woodDk, 1.45, 0.3, 0, boat).rotation.z = -Math.PI / 2;
  add(new THREE.CylinderGeometry(0.07, 0.09, 2.6, 8), MAT.woodDk, 0, 1.5, 0, boat);
  const sail = add(new THREE.PlaneGeometry(1.5, 1.9), new THREE.MeshBasicMaterial({ color: '#f7f3e6', side: THREE.DoubleSide, fog: true }), 0, 1.7, 0, boat, { cast: false });
  sail.userData.ndSkip = true;
  // signpost for the hook board
  add(box(0.12, 4.1, 0.12), MAT.woodDk, 27.32, 2.05, -2.0, g, { cast: false });
  add(box(0.12, 4.1, 0.12), MAT.woodDk, 29.48, 2.05, -2.0, g, { cast: false });
}
// ---- boards (transforms mirrored in boards.json — keep in sync) ----
const boardTitle = textBoard(['HE SOLD HIM HIS OWN ECHO!'], 3.0, 0.95, '#5a2a3a', '#ffd76a'); boardTitle.position.set(0, 4.3, -6.68); world.add(boardTitle);
const boardRich = textBoard(['RICH... RICH...'], 3.0, 0.82, '#2e4a6a', '#ffe9a8'); boardRich.position.set(0, 3.6, -6.68); world.add(boardRich);
const boardHome = textBoard(['HOME... HOME...'], 3.0, 0.82, '#2e4a6a', '#ffe9a8'); boardHome.position.set(0, 3.6, -6.68); world.add(boardHome);
const boardGold = textBoard(['GOLD... GOLD...'], 3.0, 0.82, '#5a3a1a', '#ffd76a'); boardGold.position.set(0, 3.6, -6.68); world.add(boardGold);
const boardName = textBoard(['NAME... NAME...'], 3.0, 0.82, '#3a2a4a', '#ffe9a8'); boardName.position.set(0, 3.6, -6.68); world.add(boardName);
const boardPunch = textBoard(['YOU PAID FOR', 'YOUR OWN VOICE!'], 3.6, 1.1, '#7a1f2b', '#ffd76a'); boardPunch.position.set(0, 3.4, -6.68); world.add(boardPunch);
const boardHook = textBoard(['DRINK THE WHOLE SEA DRY?', 'HOW DO YOU DRINK', 'AN ENTIRE SEA?'], 1.9, 0.98, '#14425e', '#ffe9a8'); boardHook.position.set(SIGNP[0], SIGNP[1], SIGNP[2]); world.add(boardHook);
// ND occluder behind the hook board (same trick as the soup project:
// sized exactly as the board, 0.12 behind it, so court edges behind the
// board cannot ghost through it in the normal-depth pass).
const hookOcc = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.98), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
hookOcc.position.set(SIGNP[0], SIGNP[1], SIGNP[2] - 0.12); world.add(hookOcc);

// ---------- FX: haze + mist + clouds ----------
const smoke = new FX.Smoke(scene, 160); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const hazeEmit = smoke.addEmitter(0, 2.4, 0, { rate: 0.25, color: 0xffffff, opacity: 0.03, scale: 1.6, grow: 1.2, life: 2.6, vy: 0.1, wind: -0.5 });
const mist = FX.mistBand(scene, { count: 9, y: 1.6, opacity: 0.14 });
mist.traverse((o) => { o.userData.ndSkip = true; });
const fxClouds = new FX.Clouds(scene, { count: 6, y: 42, opacity: 0.2, color: 0xf4f6fa, drift: 0.5 });
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
    hazeEmit.rate = pr.smokeRate;
    for (const s of SPLASHES) if (s.f === fxF) { /* none in this story */ }
    smoke.update(t, dt);
    fxClouds.update(t, dt);
    if (water.userData.update) water.userData.update(t);
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
function worldState(Ws, f) {
  fxStepTo(f);
  skyU.time.value = f / 30;
  const setB = (mesh, v) => { mesh.material.opacity = v; mesh.visible = v > 0.01; };
  setB(boardTitle, Ws.boardTitle || 0); setB(boardRich, Ws.boardRich || 0); setB(boardHome, Ws.boardHome || 0);
  setB(boardGold, Ws.boardGold || 0); setB(boardName, Ws.boardName || 0); setB(boardPunch, Ws.boardPunch || 0); setB(boardHook, Ws.boardHook || 0);
  const D = dynAt(f);
  // the coin pouch: rests on the rock (with its contact shadow), or lifts to the hand
  dynPouch.visible = !!D.pouch.vis;
  if (D.pouch.vis) dynPouch.position.set(D.pouch.pos[0], D.pouch.pos[1], D.pouch.pos[2]);
  pouchShadow.visible = D.pouch.mode === 'rest';
  // echo rings: expand from the cliff face and fade out
  const eu = D.echoU;
  if (eu >= 0) {
    echoRing1.visible = true; echoRing1.scale.setScalar(1 + eu * 3.2); echoRing1.material.opacity = (1 - eu) * 0.5;
    const u2 = Math.max(0, Math.min(1, eu * 1.5 - 0.3));
    echoRing2.visible = u2 > 0; echoRing2.scale.setScalar(1 + u2 * 3.2); echoRing2.material.opacity = (1 - u2) * 0.4;
  } else { echoRing1.visible = false; echoRing2.visible = false; }
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
