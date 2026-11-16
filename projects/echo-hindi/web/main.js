// ECHO-HINDI main.js — mountain-valley set + shore (batch-5 topic 3).
// Pipeline (renderer, ink/dof post, cards) identical to the soup-hindi
// template; only the SET and worldState are rebuilt for this story.
import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, splashAt, SIGNP, ROCK, ROCK_TOP, CLIFF } from './story.js';

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
  m.userData.ndSkip = true; return m;
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
  dirt: texM(P.dirt(35), 8, 8, '#a8906c'),
  cliff: toon({ color: '#8a7a68' }), cliffDk: toon({ color: '#6a5f52' }),
  rock: texM(P.stone(64, 40, 5, 58), 3, 2, '#8a8074'),
  rockDk: texM(P.stone(65, 40, 6, 46), 3, 2, '#6a6258'),
  rockFace: texM(P.stone(66, 30, 8, 52), 6, 4, '#7a6e60'),
  wood: texM(P.beam(66, [26, 45, 32]), 1, 2), woodDk: texM(P.beam(67, [24, 40, 22]), 1, 2),
  sand: texM(P.dirt(37), 8, 8, '#d9c49a'),
  sea: toon({ color: '#2c5a7d' }), seaLite: toon({ color: '#4a7a9d' }),
  leaf: toon({ color: '#3a5a2c' }), leaf2: toon({ color: '#4a7038' }),
  gold: toon({ color: '#d9a441' }), goldBright: toon({ color: '#f0bc4a' }),
  pouchCloth: toon({ color: '#c9a24d' }), pouchTie: toon({ color: '#8a6a34' }),
  white: toon({ color: '#f7f3e6' }),
  shadowSoft: new THREE.MeshBasicMaterial({ color: 0x1a2410, transparent: true, opacity: 0.32, fog: true }),
};
const world = new THREE.Group(); scene.add(world);
{
  const g = world;
  // valley floor: rocky dirt, wide enough for the valley and the shore flight
  flat(add(new THREE.PlaneGeometry(340, 240), MAT.dirt, 0, -0.03, 0, g, { cast: false }));
  flat(add(new THREE.CircleGeometry(9, 26), MAT.dirt, 0, -0.008, 0.5, g, { cast: false }));   // the valley floor
  flat(add(new THREE.CircleGeometry(7.5, 22), MAT.sand, 32, -0.008, -2, g, { cast: false }));   // the shore
  // ---- the cliff face: a tall rock wall behind the valley (z=-7), peaks on top ----
  // plain toon rock (the stone texture reads as brick wall — wrong for a cliff)
  add(tbox(7, 8.5, 1.6, 3), MAT.cliff, -5.5, 4.25, -7.5, g, { cast: false });
  add(tbox(7, 10, 1.8, 3), MAT.cliff, 0, 5.0, -8.0, g, { cast: false });
  add(tbox(7, 8.5, 1.6, 3), MAT.cliff, 5.5, 4.25, -7.5, g, { cast: false });
  for (const [px, pz, h, r] of [[-5.5, -7.5, 5.5, 4.2], [0, -8.0, 7.0, 4.6], [5.5, -7.5, 5.5, 4.2], [-11, -6.5, 4.5, 3.6], [11, -6.5, 4.5, 3.6]]) {
    const pk = add(new THREE.ConeGeometry(r, h, 5), MAT.cliffDk, px, 8.5 + h / 2 - 1.5, pz, g, { cast: false });
    pk.rotation.y = 0.4;
  }
  // side ridges closing the valley (left / right), angled back
  const rl = add(tbox(1.8, 6.5, 9, 3), MAT.cliff, -10.5, 3.25, -3.5, g, { cast: false }); rl.rotation.y = 0.5;
  const rr = add(tbox(1.8, 6.5, 9, 3), MAT.cliff, 10.5, 3.25, -3.5, g, { cast: false }); rr.rotation.y = -0.5;
  // distant peaks for depth
  for (const [px, pz, h, r] of [[-20, -18, 12, 8], [-8, -20, 15, 9], [8, -20, 14, 9], [20, -18, 11, 7], [44, -16, 12, 8], [20, -18, 10, 7]]) {
    const pk = add(new THREE.ConeGeometry(r, h, 5), MAT.cliffDk, px, h / 2 - 0.5, pz, g, { cast: false });
    pk.rotation.y = 0.3;
  }
  // pines on the valley sides
  for (const [tx, tz, s] of [[-7.5, -5.0, 1.1], [6.8, -4.8, 1.2], [-8.5, 0.8, 0.9], [7.6, 0.6, 1.0], [-4.5, -5.5, 0.9], [27.5, -5.5, 1.0], [36.5, -4.5, 1.1]]) {
    add(new THREE.CylinderGeometry(0.22 * s, 0.32 * s, 2.2 * s, 8), MAT.woodDk, tx, 1.1 * s, tz, g, { cast: false });
    const c1 = add(new THREE.ConeGeometry(1.5 * s, 2.6 * s, 8), MAT.leaf, tx, 3.2 * s, tz, g, { cast: false }); c1.userData.ndSkip = true;
    const c2 = add(new THREE.ConeGeometry(1.05 * s, 2.0 * s, 8), MAT.leaf2, tx, 4.6 * s, tz, g, { cast: false }); c2.userData.ndSkip = true;
  }
  // scattered boulders (grounded, contact shadows) — plain rock, no brick texture
  for (const [bx, bz, r] of [[-4.2, 1.8, 0.55], [4.4, 1.6, 0.7], [-3.4, -3.6, 0.45], [3.8, -3.4, 0.5], [28.5, 0.5, 0.6], [35.5, 1.0, 0.5]]) {
    const b = add(new THREE.SphereGeometry(r, 10, 8), MAT.cliffDk, bx, r * 0.55, bz, g);
    b.scale.y = 0.72;
    flat(add(new THREE.CircleGeometry(r * 1.05, 14), MAT.shadowSoft, bx, 0.012, bz, g, { cast: false }));
  }
  // ---- the flat rock: a low wide stone slab the pouch rests ON (top y = ROCK_TOP) ----
  add(new THREE.CylinderGeometry(0.7, 0.8, ROCK_TOP, 12), MAT.cliff, ROCK[0], ROCK_TOP / 2, ROCK[2], g);
  flat(add(new THREE.CircleGeometry(0.85, 16), MAT.shadowSoft, ROCK[0], 0.012, ROCK[2], g, { cast: false }));
}
// ---- the coin pouch (3D twin for the rest on the rock) ----
// Group origin = sack centre; sack bottom sits exactly on the rock top when
// the group is placed at pouchP (y = ROCK_TOP + 0.13).
let pouchG;
{
  const g = world;
  pouchG = new THREE.Group(); g.add(pouchG);
  const sack = add(new THREE.SphereGeometry(0.16, 12, 10), MAT.pouchCloth, 0, 0, 0, pouchG);
  sack.scale.set(1, 0.82, 0.95);
  add(new THREE.SphereGeometry(0.05, 8, 6), MAT.pouchTie, 0, 0.15, 0, pouchG, { cast: false });
  // three gold coins lying flat ON the rock beside the sack
  for (const [cx, cz, ry] of [[0.24, 0.08, 0.3], [0.2, -0.14, 1.1], [-0.24, 0.1, 0.7]]) {
    const c = add(new THREE.CylinderGeometry(0.055, 0.055, 0.02, 12), MAT.goldBright, cx, -0.12, cz, pouchG, { cast: false });
    c.rotation.y = ry;
  }
  flat(add(new THREE.CircleGeometry(0.24, 14), MAT.shadowSoft, 0, -0.125, 0, pouchG, { cast: false }));
  pouchG.visible = false;
}
// ================= THE SHORE (hook, x=+32) =================
{
  const g = world, cx = 32;
  // the sea: a blue plane BEHIND the shore only (x 17..47, z -25..-5 — must
  // NOT overlap the valley). Foam strip at the waterline.
  flat(add(new THREE.PlaneGeometry(30, 20), MAT.sea, cx, 0.04, -15, g, { cast: false }));
  flat(add(new THREE.PlaneGeometry(30, 1.1), MAT.seaLite, cx, 0.055, -5.6, g, { cast: false }));
  // driftwood + shells on the sand
  const log = add(new THREE.CylinderGeometry(0.14, 0.18, 2.2, 8), MAT.woodDk, cx + 2.6, 0.14, -0.6, g);
  log.rotation.z = Math.PI / 2; log.rotation.y = 0.5;
  for (const [sx, sz] of [[cx - 1.8, -0.8], [cx - 1.5, -1.1], [cx + 1.2, -4.2]]) {
    add(new THREE.SphereGeometry(0.09, 8, 6), MAT.white, sx, 0.05, sz, g, { cast: false });
  }
  // signpost for the hook board
  add(box(0.12, 3.4, 0.12), MAT.woodDk, 30.7, 1.7, -2.0, g, { cast: false });
  add(box(0.12, 3.4, 0.12), MAT.woodDk, 33.3, 1.7, -2.0, g, { cast: false });
  add(tbox(2.9, 0.14, 0.14, 2), MAT.woodDk, 32, 2.2, -2.0, g, { cast: false });
}
// ---- boards (transforms mirrored in boards.json — keep in sync) ----
const boardTitle = textBoard(['अपनी गूँज बेच दी!'], 2.6, 0.95, '#4a3a22', '#ffd76a'); boardTitle.position.set(-1.6, 3.2, -3.0); world.add(boardTitle);
const boardPayoff = textBoard(['सौ सिक्के दिए —', 'अपनी ही आवाज़ के!'], 3.0, 1.1, '#2e4a2e', '#ffe9a8'); boardPayoff.position.set(0, 4.35, -4.55); world.add(boardPayoff);
const boardHook = textBoard(['पूरा समंदर पीना?', 'सूरज डूबने तक!'], 3.0, 1.1, '#2e4a2e', '#ffe9a8'); boardHook.position.set(SIGNP[0], SIGNP[1], SIGNP[2]); world.add(boardHook);
// ND occluders behind the text boards: invisible in the colour pass (colorWrite
// off), but present in the normal-depth pass so backdrop edges behind a board
// cannot ghost through its text. Each is sized EXACTLY as its board and sits
// 0.12 behind it, so its ND silhouette projects a hair inside the board's rim
// and the ink edge it generates lands on the board's own face. Visibility is
// toggled with its board in worldState — an always-on occluder would ink a
// floating rectangle whenever its board is off.
const mkOcc = (b, w, h) => {
  const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  o.position.copy(b.position); o.position.z -= 0.12; o.visible = false; world.add(o); return o;
};
const occTitle = mkOcc(boardTitle, 2.6, 0.95);
const occPayoff = mkOcc(boardPayoff, 3.0, 1.1);
const occHook = mkOcc(boardHook, 3.0, 1.1);

// ---------- FX: haze + dust + clouds (no fire/steam in this story) ----------
const smoke = new FX.Smoke(scene, 130); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const hazeEmit = smoke.addEmitter(0, 2.4, 0, { rate: 0.35, color: 0xffffff, opacity: 0.04, scale: 2.2, grow: 1.3, life: 2.6, vy: 0.1, wind: -0.5 });
const dustEmit = smoke.addEmitter(0, 1.6, -3.5, { rate: 0, color: 0xffe2b8, opacity: 0.1, scale: 0.5, grow: 1.2, life: 2.2, vy: 0.16, wind: 0.15 });
const fire = new FX.Fire(scene, { x: 0, y: 0.16, z: -2, scale: 0.55, rate: 0 });
fire.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const splashes = new FX.Splashes(scene, 300); splashes.points.userData.ndSkip = true;
const fxClouds = new FX.Clouds(scene, { count: 6, y: 42, opacity: 0.2, color: 0xf4f6fa, drift: 0.5 });
fxClouds.items.forEach((cl) => { cl.userData.x0 = cl.position.x; cl.traverse((m) => { m.userData.ndSkip = true; }); });
let fxF = -1;
const fxReset = () => {
  smoke.pool.forEach((p) => { p.life = -1; p.s.visible = false; }); smoke.emitters.forEach((e) => { e.acc = 0; });
  fire.pool.forEach((p) => { p.life = -1; p.s.visible = false; }); fire.acc = 0;
  splashes.life.fill(-1);
  fxClouds.items.forEach((cl) => { cl.position.x = cl.userData.x0; });
};
const fxStepTo = (f) => {
  if (f === fxF) return;
  if (f < fxF || f > fxF + 240) { fxReset(); fxF = -1; }
  while (fxF < f) {
    fxF++; const t = fxF / 30, dt = 1 / 30, pr = fxProfileAt(fxF);
    hazeEmit.rate = pr.smokeRate; dustEmit.rate = pr.dustRate;
    fire.rate = pr.fireRate || 0;
    for (const s of splashAt(fxF)) splashes.burst(s[0], s[1], s[2], { n: s[3] || 26, power: s[4] || 4 });
    smoke.update(t, dt);
    fire.update(t, dt);
    splashes.update(t, dt);
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
  setB(boardTitle, Ws.boardTitle || 0); setB(boardPayoff, Ws.boardPayoff || 0); setB(boardHook, Ws.boardHook || 0);
  occTitle.visible = boardTitle.visible; occPayoff.visible = boardPayoff.visible; occHook.visible = boardHook.visible;
  // the coin pouch: rests ON the flat rock (group origin = sack centre)
  pouchG.visible = !!Ws.pouchV;
  if (Ws.pouchV) pouchG.position.set(Ws.pouchP[0], Ws.pouchP[1], Ws.pouchP[2]);
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
