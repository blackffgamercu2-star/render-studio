import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt } from './story.js';

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
const clamp01 = (x) => Math.max(0, Math.min(1, x));

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
  g.font = `${font} ${fs}px 'Noto Sans Devanagari', Arial`;
  lines.forEach((l, i) => g.fillText(l, c.width / 2, c.height * (lines.length === 1 ? 0.52 : (i + 0.5) / lines.length)));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, fog: true }));
  return m; // boards stay IN the ND pass: their depth occludes set geometry behind them (no ghost ink lines)
};

// ---------- the set: a rich householder's kitchen, morning light ----------
const MAT = {
  floor: texM(P.planks(61), 10, 10, '#a9805a'),
  rug: toon({ color: '#8c3a2e' }),
  plaster: texM(P.plaster(33, 36), 3, 2, '#e8d9b8'),
  plasterDk: texM(P.plaster(34, 30), 3, 2, '#c9b48c'),
  wood: texM(P.beam(66, [26, 45, 32]), 1, 2), woodDk: texM(P.beam(67, [24, 40, 22]), 1, 2),
  clay: toon({ color: '#b06a3e' }), clayDk: toon({ color: '#8a4f2c' }),
  butter: toon({ color: '#f2c94c' }), butterDk: toon({ color: '#d9a441' }),
  brass: toon({ color: '#c9a227' }), iron: toon({ color: '#4a4d55' }),
  dark: toon({ color: '#33302c' }),
  sack: toon({ color: '#a8803e' }), leaf: toon({ color: '#4a6a34' }),
  skyWin: new THREE.MeshBasicMaterial({ color: 0xbcd8f0, fog: true }),
  butterGlow: new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0, fog: true }),
};
const world = new THREE.Group(); scene.add(world);
let butterDisc, beamG, needleG, crowG, lidG;
{
  const g = world;
  // floor + rug
  flat(add(new THREE.PlaneGeometry(40, 40), MAT.floor, 0, -0.03, 0, g, { cast: false }));
  flat(add(new THREE.CircleGeometry(3.4, 24), MAT.rug, 0, -0.012, -0.6, g, { cast: false }));
  // back wall + side returns (the kitchen encloses the stage)
  add(tbox(14, 4.6, 0.4, 2), MAT.plaster, 0, 2.3, -3.5, g, { cast: false });
  add(tbox(0.4, 4.6, 7, 2), MAT.plasterDk, -6.2, 2.3, -0.5, g, { cast: false });
  add(tbox(0.4, 4.6, 7, 2), MAT.plasterDk, 6.2, 2.3, -0.5, g, { cast: false });
  add(tbox(13, 0.35, 0.5, 2), MAT.woodDk, 0, 4.6, -3.5, g, { cast: false }); // wall top beam
  // ceiling beam + hanging garlic/onion strings
  add(tbox(12.4, 0.3, 0.35, 2), MAT.woodDk, 0, 3.35, -1.6, g, { cast: false });
  for (const hx of [-2.4, -1.5]) {
    add(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 6), MAT.iron, hx, 2.95, -1.6, g, { cast: false });
    for (let i = 0; i < 3; i++) add(new THREE.SphereGeometry(0.09, 8, 6), toon({ color: i % 2 ? '#e8dcc0' : '#c9a24d' }), hx + (i - 1) * 0.12, 2.55 - i * 0.1, -1.6, g, { cast: false });
  }
  // window (east end of the back wall) with a crow on the sill
  const WX = 3.6, WY = 2.1;
  add(new THREE.PlaneGeometry(1.7, 1.9), MAT.skyWin, WX, WY, -3.28, g, { cast: false });
  for (const [bx, by, bw, bh] of [[WX, WY + 1.0, 2.0, 0.14], [WX, WY - 1.0, 2.0, 0.14], [WX - 0.92, WY, 0.14, 2.1], [WX + 0.92, WY, 0.14, 2.1], [WX, WY, 0.08, 1.9], [WX, WY, 1.7, 0.08]]) add(tbox(bw, bh, 0.12, 1), MAT.woodDk, bx, by, -3.3, g, { cast: false });
  add(tbox(2.1, 0.12, 0.5, 1), MAT.wood, WX, WY - 1.06, -3.15, g, { cast: false }); // sill
  crowG = new THREE.Group(); crowG.position.set(WX - 0.7, WY - 0.95, -3.1); g.add(crowG); // west end of the sill — clear of the hook board's plane
  const crowMat = toon({ color: '#1c1a20' });
  const cb = add(new THREE.SphereGeometry(0.16, 10, 8), crowMat, 0, 0.14, 0, crowG, { cast: false }); cb.scale.set(1, 0.85, 1.35);
  add(new THREE.SphereGeometry(0.1, 9, 7), crowMat, 0.02, 0.32, 0.1, crowG, { cast: false });
  const beak = add(new THREE.ConeGeometry(0.035, 0.14, 8), toon({ color: '#3a3a3a' }), 0.02, 0.31, 0.24, crowG, { cast: false }); beak.rotation.x = Math.PI / 2 - 0.25;
  const ctail = add(tbox(0.08, 0.04, 0.3, 1), crowMat, 0, 0.1, -0.24, crowG, { cast: false }); ctail.rotation.x = 0.35;
  add(new THREE.CylinderGeometry(0.015, 0.015, 0.12, 6), crowMat, -0.04, 0.02, 0, crowG, { cast: false });
  add(new THREE.CylinderGeometry(0.015, 0.015, 0.12, 6), crowMat, 0.06, 0.02, 0, crowG, { cast: false });
  // shelf with clay pots + jars (west end of the back wall)
  add(tbox(3.4, 0.09, 0.6, 1), MAT.wood, -3.4, 2.3, -3.2, g, { cast: false });
  for (const [px, pr, ph, col] of [[-4.6, 0.22, 0.5, '#b06a3e'], [-3.9, 0.16, 0.38, '#8a4f2c'], [-3.1, 0.19, 0.44, '#a8803e'], [-2.4, 0.14, 0.34, '#6a7a4a']]) {
    add(new THREE.CylinderGeometry(pr * 0.8, pr, ph, 10), toon({ color: col }), px, 2.35 + ph / 2, -3.2, g, { cast: false });
  }
  add(tbox(3.4, 0.09, 0.6, 1), MAT.wood, -3.4, 1.55, -3.2, g, { cast: false });
  for (const [px, pr] of [[-4.5, 0.17], [-3.7, 0.2], [-2.9, 0.15]]) add(new THREE.SphereGeometry(pr, 9, 7), MAT.clayDk, px, 1.6 + pr * 0.7, -3.2, g, { cast: false });
  // ================= THE KITCHEN TABLE (origin) =================
  add(tbox(2.8, 0.12, 1.3, 2), MAT.wood, 0, 0.95, -1.0, g, { cast: false });
  for (const [lx, lz] of [[-1.25, -0.5], [1.25, -0.5], [-1.25, 0.5], [1.25, 0.5]]) add(tbox(0.11, 0.9, 0.11, 1), MAT.woodDk, lx, 0.45, -1.0 + lz, g, { cast: false });
  // the butter pot (west end of the table) — butter disc inside sinks as it empties
  const BP = [-0.75, -1.0];
  add(new THREE.CylinderGeometry(0.3, 0.24, 0.42, 12), MAT.clay, BP[0], 1.22, BP[1], g, { cast: false });
  add(new THREE.TorusGeometry(0.3, 0.035, 8, 16), MAT.clayDk, BP[0], 1.43, BP[1], g, { cast: false }).rotation.x = Math.PI / 2;
  butterDisc = add(new THREE.CylinderGeometry(0.25, 0.25, 0.07, 12), MAT.butter, BP[0], 1.4, BP[1], g, { cast: false });
  lidG = new THREE.Group(); lidG.position.set(BP[0] + 0.55, 1.05, BP[1] + 0.15); g.add(lidG);
  const lid = add(new THREE.SphereGeometry(0.26, 12, 8), MAT.clayDk, 0, 0, 0, lidG, { cast: false }); lid.scale.y = 0.35;
  add(new THREE.SphereGeometry(0.05, 8, 6), MAT.clay, 0, 0.1, 0, lidG, { cast: false });
  // ================= THE SCALES (tarazu, east end of the table) =================
  const SX = 0.95, SZ = -1.0;
  add(tbox(0.55, 0.06, 0.4, 1), MAT.woodDk, SX, 1.04, SZ, g, { cast: false });
  add(new THREE.CylinderGeometry(0.05, 0.07, 0.6, 8), MAT.brass, SX, 1.36, SZ, g, { cast: false });
  // dial + needle on the pillar front
  add(new THREE.CylinderGeometry(0.14, 0.14, 0.03, 16), toon({ color: '#f4efe4' }), SX, 1.5, SZ + 0.08, g, { cast: false }).rotation.x = Math.PI / 2;
  needleG = new THREE.Group(); needleG.position.set(SX, 1.5, SZ + 0.1); g.add(needleG);
  add(tbox(0.02, 0.12, 0.01, 1), toon({ color: '#a02318' }), 0, 0.05, 0, needleG, { cast: false });
  beamG = new THREE.Group(); beamG.position.set(SX, 1.68, SZ); g.add(beamG);
  add(tbox(1.16, 0.05, 0.05, 1), MAT.brass, 0, 0, 0, beamG, { cast: false });
  add(new THREE.SphereGeometry(0.06, 8, 6), MAT.brass, 0, 0.06, 0, beamG, { cast: false });
  for (const side of [-1, 1]) {
    const pan = new THREE.Group(); pan.position.set(side * 0.52, -0.02, 0); beamG.add(pan);
    for (const a of [-0.5, 0.5]) add(new THREE.CylinderGeometry(0.008, 0.008, 0.26, 5), MAT.iron, a * 0.16, -0.13, 0, pan, { cast: false });
    add(new THREE.CylinderGeometry(0.27, 0.2, 0.05, 14), MAT.brass, 0, -0.28, 0, pan, { cast: false });
  }
  // stool, grain sacks, vegetable basket
  add(new THREE.CylinderGeometry(0.34, 0.34, 0.07, 12), MAT.wood, -2.2, 0.55, 0.5, g, { cast: false });
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; add(new THREE.CylinderGeometry(0.04, 0.05, 0.52, 7), MAT.woodDk, -2.2 + Math.cos(a) * 0.24, 0.26, 0.5 + Math.sin(a) * 0.24, g, { cast: false }); }
  for (const [sx, sz, s] of [[-3.3, -2.5, 1], [-2.7, -2.75, 0.85], [-3.0, -2.2, 0.9]]) {
    const sg = add(new THREE.SphereGeometry(0.42 * s, 10, 8), MAT.sack, sx, 0.3 * s, sz, g, { cast: false }); sg.scale.y = 0.78;
  }
  add(new THREE.CylinderGeometry(0.4, 0.32, 0.3, 12), MAT.woodDk, 2.4, 0.15, -2.6, g, { cast: false });
  for (const [vx, vz, col] of [[2.3, -2.6, '#d97a2e'], [2.55, -2.5, '#d97a2e'], [2.4, -2.75, '#5d8142'], [2.2, -2.75, '#c9a24d']]) add(new THREE.SphereGeometry(0.11, 8, 6), toon({ color: col }), vx, 0.36, vz, g, { cast: false });
  // warm lamp glow by the window
  const winGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 2.1), MAT.butterGlow); winGlow.position.set(3.6, 2.1, -3.26); winGlow.castShadow = false; winGlow.userData.ndSkip = true; g.add(winGlow);
}
let needleGlint;
needleGlint = FX.glint(0.4); needleGlint.position.set(0.95, 1.5, -0.88); needleGlint.userData.ndSkip = true; world.add(needleGlint);
let butterGlint;
butterGlint = FX.glint(0.45); butterGlint.position.set(-0.75, 1.45, -0.85); butterGlint.userData.ndSkip = true; world.add(butterGlint);
// ---- boards (transforms mirrored in boards.json — keep in sync) ----
function postSign(lines, w, h, bg, fg, gx, gz, ry, cy = 1.5) {
  const g = new THREE.Group(); g.position.set(gx, 0, gz); g.rotation.y = ry; world.add(g);
  add(new THREE.CylinderGeometry(0.05, 0.07, Math.max(1.2, cy + h / 2), 6), MAT.woodDk, 0, (cy + h / 2) / 2, -0.06, g, { cast: false });
  const b = textBoard(lines, w, h, bg, fg); b.position.set(0, cy, 0.05); g.add(b);
  return b;
}
const boardButter = postSign(['एक किलो मक्खन', 'ग़ायब!'], 2.2, 0.95, '#5a3a1a', '#ffe9a8', -2.0, -2.15, 0.35, 1.5);
const boardScale = postSign(['बिल्कुल एक किलो'], 2.6, 0.8, '#2e5a2e', '#ffe9a8', 2.9, -2.0, -0.3, 1.5);
const boardHook = postSign(['राज्य में', 'कितने कौवे हैं?'], 2.2, 0.9, '#2e3a5a', '#ffe9a8', 4.8, -2.6, -0.35, 1.5);

// ---------- FX: dusk haze, gate dust, clouds ----------
const smoke = new FX.Smoke(scene, 130); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const hazeEmit = smoke.addEmitter(0, 2.6, -2, { rate: 0.3, color: 0xffe2b0, opacity: 0.045, scale: 2.4, grow: 1.3, life: 2.8, vy: 0.1, wind: -0.4 });
const dustEmit = smoke.addEmitter(0, 0.7, 0.5, { rate: 0.1, color: 0xe8d9b0, opacity: 0.16, scale: 0.5, grow: 1.6, life: 1.1, vy: 0.5, wind: 0.3 });
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
  setB(boardButter, Ws.boardButter || 0); setB(boardScale, Ws.boardScale || 0); setB(boardHook, Ws.boardHook || 0);
  const bk = Ws.butterK ?? 1;
  butterDisc.visible = bk > 0.02;
  butterDisc.scale.set(1, Math.max(0.05, bk), 1);
  butterDisc.position.y = 1.4 - (1 - bk) * 0.18;
  beamG.rotation.z = Ws.scaleTilt || 0;
  needleG.rotation.z = -(Ws.needleK || 0) * 0.9; // sweeps up -> 2 o'clock at exactly 1 kg
  lidG.rotation.z = (Ws.lidK || 0) * 0.5;
  lidG.position.y = 1.05 + (Ws.lidK || 0) * 0.12;
  crowG.visible = (Ws.crowK ?? 1) > 0.02;
  MAT.butterGlow.opacity = (Ws.butterK || 0) * 0.12;
  butterGlint.material.opacity = (Ws.butterK || 0) * 0.5;
  needleGlint.material.opacity = (Ws.needleK || 0) * 0.8;
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
