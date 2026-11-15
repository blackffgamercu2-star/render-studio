import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, POT, SCALES, SCALE_TOP } from './story.js';

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
const MW = {
  dark: toon({ color: '#3c3a38' }),
  gold: toon({ color: '#c9a227' }),
};

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

// ---------- text-board helper (canvas texture plane; boards are in-world props) ----------
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
// the scales' dial face: 0..2 kg, red mark at 1 — needle angles in worldState
// must match these tick angles (0 -> 115 deg, 1 -> 40 deg, 2 -> -35 deg,
// clockwise from 12 o'clock).
const dialTexture = () => {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#f7f3e6'; g.beginPath(); g.arc(128, 128, 126, 0, 7); g.fill();
  g.strokeStyle = '#4a2c14'; g.lineWidth = 8; g.beginPath(); g.arc(128, 128, 120, 0, 7); g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let v = 0; v <= 2.0001; v += 0.5) {
    const a = (115 - (v / 2) * 150) * Math.PI / 180; // clockwise from 12 o'clock
    const isOne = Math.abs(v - 1) < 0.01;
    g.strokeStyle = isOne ? '#b3392e' : '#4a2c14'; g.lineWidth = isOne ? 9 : 5;
    g.beginPath();
    g.moveTo(128 + Math.sin(a) * 92, 128 - Math.cos(a) * 92);
    g.lineTo(128 + Math.sin(a) * 108, 128 - Math.cos(a) * 108);
    g.stroke();
    if (Number.isInteger(v)) {
      g.fillStyle = isOne ? '#b3392e' : '#4a2c14'; g.font = `900 ${isOne ? 44 : 38}px Arial`;
      g.fillText(String(v), 128 + Math.sin(a) * 66, 128 - Math.cos(a) * 66);
    }
  }
  g.fillStyle = '#4a2c14'; g.font = '900 30px Arial'; g.fillText('KG', 128, 178);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
};
// soft radial glow sprite (NO hard cross — lamp light, not a sparkle)
const softGlow = (scale, color, opacity) => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 1, 32, 32, 31);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)'); grad.addColorStop(0.4, 'rgba(255,255,255,0.35)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(scale); s.userData.ndSkip = true; return s;
};

// ---------- the set ----------
const MAT = {
  floor: texM(P.stone(64, 40, 5, 58), 6, 6, '#b9ac96'),
  plaster: texM(P.plaster(71, 36), 4, 2, '#d8c9a8'),
  plasterDk: texM(P.plaster(71, 36), 4, 2, '#b3a284'),
  wood: texM(P.beam(66, [26, 45, 32]), 1, 2), woodDk: texM(P.beam(67, [24, 40, 22]), 1, 2),
  terra: toon({ color: '#b06a3e' }), terraDk: toon({ color: '#8a4f2c' }),
  cream: toon({ color: '#f2e8cf' }), butter: toon({ color: '#f2c94c' }), butterDk: toon({ color: '#d9a441' }),
  steel: toon({ color: '#565d66' }), steelDk: toon({ color: '#33373d' }),
  leaf: toon({ color: '#4a6a34' }), leaf2: toon({ color: '#5d8142' }),
  jarGreen: toon({ color: '#5d7a4a' }), jarBlue: toon({ color: '#5a6e8a' }),
  sack: toon({ color: '#c9a24d' }),
  dark: toon({ color: '#33302c' }),
  rug: toon({ color: '#8c4a3a' }),
  milk: toon({ color: '#f7f3e6' }),
};
const world = new THREE.Group(); scene.add(world);
{
  const g = world;
  // floor + rug under the table
  flat(add(new THREE.PlaneGeometry(80, 60), MAT.floor, 0, -0.03, 2, g, { cast: false }));
  flat(add(new THREE.CircleGeometry(3.4, 24), MAT.rug, 0, -0.012, -0.4, g, { cast: false }));
  // back wall + side walls (kitchen interior)
  add(tbox(18, 5.6, 0.4, 4), MAT.plaster, 0, 2.8, -3.45, g, { cast: false });
  add(tbox(0.4, 5.6, 14, 4), MAT.plasterDk, -9, 2.8, 2, g, { cast: false });
  add(tbox(0.4, 5.6, 14, 4), MAT.plasterDk, 9, 2.8, 2, g, { cast: false });
  // skirting board along the back wall
  add(tbox(18, 0.3, 0.08, 4), MAT.woodDk, 0, 0.15, -3.22, g, { cast: false });
  // window (lit, warm) on the back wall, left side
  const winGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.1), new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: true }));
  winGlow.position.set(-3.4, 2.9, -3.22); winGlow.userData.ndSkip = true; g.add(winGlow);
  add(tbox(1.9, 0.14, 0.1, 2), MAT.woodDk, -3.4, 4.0, -3.18, g, { cast: false });
  add(tbox(1.9, 0.14, 0.1, 2), MAT.woodDk, -3.4, 1.8, -3.18, g, { cast: false });
  add(tbox(0.14, 2.3, 0.1, 2), MAT.woodDk, -4.3, 2.9, -3.18, g, { cast: false });
  add(tbox(0.14, 2.3, 0.1, 2), MAT.woodDk, -2.5, 2.9, -3.18, g, { cast: false });
  add(tbox(0.08, 2.1, 0.06, 2), MAT.woodDk, -3.4, 2.9, -3.18, g, { cast: false });
  add(tbox(1.7, 0.08, 0.06, 2), MAT.woodDk, -3.4, 2.9, -3.18, g, { cast: false });
  const winGlowS = softGlow(2.6, 0xffc98a, 0.14); winGlowS.position.set(-3.4, 2.9, -2.9); g.add(winGlowS);
  // shelves with jars, right of the window
  for (const sy of [2.3, 3.1]) add(tbox(3.5, 0.09, 0.55, 2), MAT.wood, -3.75, sy, -3.1, g, { cast: false });
  const jar = (x, y, r, h, mat) => { add(new THREE.CylinderGeometry(r, r * 1.05, h, 12), mat, x, y + h / 2, -3.1, g, { cast: false }); add(new THREE.CylinderGeometry(r * 0.7, r * 0.7, 0.06, 12), MAT.woodDk, x, y + h + 0.03, -3.1, g, { cast: false }); };
  jar(-5.1, 2.35, 0.17, 0.42, MAT.terra); jar(-4.55, 2.35, 0.15, 0.36, MAT.jarGreen); jar(-4.05, 2.35, 0.18, 0.46, MAT.cream);
  jar(-3.5, 2.35, 0.14, 0.34, MAT.jarBlue); jar(-3.0, 2.35, 0.16, 0.4, MAT.terraDk);
  jar(-5.0, 3.15, 0.16, 0.4, MAT.jarBlue); jar(-4.4, 3.15, 0.18, 0.44, MAT.cream); jar(-3.8, 3.15, 0.15, 0.36, MAT.jarGreen);
  const sack = add(new THREE.SphereGeometry(0.3, 9, 7), MAT.sack, -2.6, 3.35, -3.1, g, { cast: false }); sack.scale.y = 0.72;
  // firewood stack, right wall
  for (let i = 0; i < 5; i++) {
    const log = add(new THREE.CylinderGeometry(0.14, 0.14, 1.1, 8), MAT.woodDk, 4.6 + (i % 2) * 0.3, 0.14 + Math.floor(i / 2) * 0.28, -2.8 + (i % 2) * 0.1, g, { cast: false });
    log.rotation.z = Math.PI / 2; log.rotation.y = (i % 2) * 0.12;
  }
  // stool near the servant's side
  add(new THREE.CylinderGeometry(0.35, 0.35, 0.08, 12), MAT.wood, -2.6, 0.45, 1.4, g, { cast: false });
  for (const [lx, lz] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) add(new THREE.CylinderGeometry(0.035, 0.04, 0.42, 7), MAT.woodDk, -2.6 + lx, 0.21, 1.4 + lz, g, { cast: false });
  // the cat's milk bowl on the floor (no milk disc — its flat cap fan read
  // as a starburst in the ink pass)
  add(new THREE.CylinderGeometry(0.28, 0.2, 0.1, 14), MAT.terra, -1.7, 0.05, 0.5, g, { cast: false });
}
// ================= THE TABLE =================
let butterMound, needle, dialGlint;
{
  const g = world;
  add(tbox(3.4, 0.12, 1.5, 2), MAT.wood, 0, 0.78, -1.2, g, { cast: false });
  for (const [lx, lz] of [[-1.55, -0.6], [1.55, -0.6], [-1.55, 0.6], [1.55, 0.6]]) add(box(0.12, 0.72, 0.12), MAT.woodDk, lx, 0.36, -1.2 + lz, g, { cast: false });
  add(tbox(3.0, 0.06, 1.1, 2), MAT.woodDk, 0, 0.22, -1.2, g, { cast: false });
  // THE BUTTER POT (terracotta) + butter mound inside (scaled by butterK)
  add(new THREE.CylinderGeometry(0.34, 0.28, 0.5, 16), MAT.terra, POT[0], POT[1] + 0.25, POT[2], g, { cast: false });
  add(new THREE.CylinderGeometry(0.36, 0.36, 0.06, 16), MAT.terraDk, POT[0], POT[1] + 0.52, POT[2], g, { cast: false });
  butterMound = add(new THREE.SphereGeometry(0.3, 12, 9), MAT.butter, POT[0], POT[1] + 0.55, POT[2], g, { cast: false });
  butterMound.scale.y = 0.5;
  // small butter dish with a block beside the pot (reads "butter" at a glance)
  add(new THREE.CylinderGeometry(0.22, 0.18, 0.05, 12), MAT.cream, POT[0] + 0.55, POT[1] + 0.03, POT[2] - 0.45, g, { cast: false });
  // ================= THE DIAL SCALES =================
  add(tbox(0.9, 0.14, 0.7, 2), MAT.steelDk, SCALES[0], SCALES[1] + 0.07, SCALES[2], g, { cast: false });
  add(new THREE.CylinderGeometry(0.42, 0.46, 0.06, 18), MAT.steel, SCALES[0], SCALE_TOP - 0.03, SCALES[2], g, { cast: false });
  add(box(0.08, 0.62, 0.08), MAT.steelDk, SCALES[0], SCALES[1] + 0.45, SCALES[2] - 0.3, g, { cast: false });
  // the dial face (canvas texture on a PLANE — CircleGeometry's triangle
  // fan reads as a cross in the ink pass) + needle, tilted toward camera
  const dial = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshBasicMaterial({ map: dialTexture(), transparent: true, fog: true }));
  dial.position.set(SCALES[0], SCALES[1] + 0.78, SCALES[2] - 0.32); dial.rotation.x = -0.28; dial.userData.ndSkip = true; g.add(dial);
  const dialRim = add(new THREE.TorusGeometry(0.3, 0.025, 8, 24), MAT.steelDk, SCALES[0], SCALES[1] + 0.78, SCALES[2] - 0.32, g, { cast: false });
  dialRim.rotation.x = -0.28;
  const needleGrp = new THREE.Group(); needleGrp.position.set(SCALES[0], SCALES[1] + 0.78, SCALES[2] - 0.30); needleGrp.rotation.x = -0.28; g.add(needleGrp);
  // pivot group at the dial centre — rotation.z swings the needle about the
  // centre (rotating the box mesh itself spun it about its own middle).
  needle = new THREE.Group(); needleGrp.add(needle);
  const needleMesh = add(box(0.025, 0.26, 0.012), new THREE.MeshBasicMaterial({ color: 0xb3392e, fog: true }), 0, 0.11, 0, needle, { cast: false });
  needleMesh.userData.ndSkip = true;
  const hub = add(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 12), MAT.steelDk, 0, 0, 0.012, needleGrp, { cast: false });
  hub.rotation.x = Math.PI / 2; hub.userData.ndSkip = true;
  dialGlint = FX.glint(0.3); dialGlint.position.set(SCALES[0] + 0.12, SCALES[1] + 0.9, SCALES[2] - 0.28); dialGlint.userData.ndSkip = true; g.add(dialGlint);
}
// ---- boards (transforms mirrored in boards.json — keep in sync) ----
const boardTitle = textBoard(["THE CAT THAT ATE THE BUTTER"], 3.6, 0.85, '#4a2c14', '#ffd76a'); boardTitle.position.set(0, 4.3, -3.12); world.add(boardTitle);
const boardKilo = textBoard(['EXACTLY ONE KILO'], 2.4, 0.75, '#2e5a2e', '#ffe9a8'); boardKilo.position.set(0, 2.35, -3.12); world.add(boardKilo);
const boardHook = textBoard(['HOW MANY CROWS', 'LIVE IN THE KINGDOM?'], 2.2, 0.85, '#1f2a44', '#ffd76a'); boardHook.position.set(0, 3.3, -3.12); world.add(boardHook);

// ---------- FX: haze ----------
const smoke = new FX.Smoke(scene, 130); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const hazeEmit = smoke.addEmitter(0, 2.4, 0, { rate: 0.12, color: 0xffffff, opacity: 0.04, scale: 2.2, grow: 1.3, life: 2.6, vy: 0.1, wind: -0.5 });
const dustEmit = smoke.addEmitter(-3.4, 2.6, -2.6, { rate: 0, color: 0xffe2b8, opacity: 0.1, scale: 0.5, grow: 1.2, life: 2.2, vy: 0.16, wind: 0.15 });
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
    hazeEmit.rate = pr.smokeRate; dustEmit.rate = pr.dustRate;
    smoke.update(t, dt);
    fxClouds.update(t, dt);
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
  setB(boardTitle, Ws.boardTitle || 0); setB(boardKilo, Ws.boardKilo || 0); setB(boardHook, Ws.boardHook || 0);
  // butter mound: visible amount follows butterK (0 = empty pot)
  const bk = Ws.butterK || 0;
  butterMound.visible = bk > 0.02;
  butterMound.scale.set(Math.max(bk, 0.05), 0.5 * Math.max(bk, 0.05), Math.max(bk, 0.05));
  // dial needle: 0 kg -> 115 deg, 1 kg -> 40 deg (clockwise from 12 o'clock)
  const ang = (115 - 75 * (Ws.needleK || 0)) * Math.PI / 180;
  needle.rotation.z = -ang;
  dialGlint.material.opacity = 0.3;
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
