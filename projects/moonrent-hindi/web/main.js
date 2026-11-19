import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import * as M4 from './materials.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, BOARD_POS } from './story.js';
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
// sun = the moon (pale directional). Practicals: lampA the stall lantern,
// lampB the hut-door lantern, hutLight the table lantern inside the hut.
const hemi = new THREE.HemisphereLight('#ffffff', '#ffffff', 1); scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffffff', 2); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; sun.shadow.radius = 2;
scene.add(sun); scene.add(sun.target);
scene.fog = new THREE.Fog('#ffffff', 40, 600);
const lampA = new THREE.PointLight(0xffb45e, 30, 26, 1.8); lampA.position.set(3.9, 2.3, -2.6); scene.add(lampA);
const lampB = new THREE.PointLight(0xffa64e, 26, 24, 1.8); lampB.position.set(1.35, 2.25, -9.55); scene.add(lampB);
const hutLight = new THREE.PointLight(0xffc95e, 20, 16, 1.7); hutLight.position.set(0.05, 1.5, -13.1); scene.add(hutLight);
const lampSpot = new THREE.SpotLight(0xffd9a0, 0, 30, 0.36, 0.65, 1.2); lampSpot.position.set(0.9, 4.4, 1.9); scene.add(lampSpot); scene.add(lampSpot.target);
lampSpot.target.position.set(0.9, 0, 1.9);

// ---------- text-board helper ----------
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

// ---------- painted canvases ----------
const dirtCanvas = (seed) => {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  let sd = seed; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#8a6a44'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 420; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 6 + rnd() * 36;
    const gr = g.createRadialGradient(x, y, 1, x, y, r);
    const dark = rnd() > 0.45;
    gr.addColorStop(0, dark ? 'rgba(52,34,16,0.5)' : 'rgba(214,178,128,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.06 + rnd() * 0.09; g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 2600; i++) { g.fillStyle = rnd() > 0.5 ? 'rgba(255,232,190,0.07)' : 'rgba(28,16,6,0.09)'; g.fillRect(rnd() * 512, rnd() * 512, 2.4, 2.4); }
  for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(60,40,20,0.25)'; g.beginPath(); g.arc(rnd() * 512, rnd() * 512, 2 + rnd() * 3.4, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
};
// mud plaster: warm tan, straw flecks, soft hand-troweled shading bands
const mudCanvas = (seed, base) => {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  let sd = seed; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 300; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 10 + rnd() * 46;
    const gr = g.createRadialGradient(x, y, 1, x, y, r);
    gr.addColorStop(0, rnd() > 0.5 ? 'rgba(70,44,20,0.20)' : 'rgba(255,226,170,0.16)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  for (let i = 0; i < 900; i++) { // straw flecks
    g.strokeStyle = `rgba(226,192,120,${0.10 + rnd() * 0.14})`; g.lineWidth = 1.4;
    const x = rnd() * 512, y = rnd() * 512, a = rnd() * 3.14;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 7, y + Math.sin(a) * 7); g.stroke();
  }
  for (let i = 0; i < 700; i++) { g.fillStyle = rnd() > 0.5 ? 'rgba(255,230,190,0.05)' : 'rgba(30,18,8,0.06)'; g.fillRect(rnd() * 512, rnd() * 512, 2, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
};
// thatch: dense vertical straw strokes over a dark base
const thatchCanvas = (seed) => {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  let sd = seed; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#4a3418'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2400; i++) {
    const x = rnd() * 512, y = rnd() * 512, l = 14 + rnd() * 30;
    g.strokeStyle = `rgba(${190 + rnd() * 50 | 0},${140 + rnd() * 40 | 0},${60 + rnd() * 30 | 0},${0.16 + rnd() * 0.2})`;
    g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 4, y + l); g.stroke();
  }
  for (let r = 0; r < 4; r++) { g.fillStyle = 'rgba(30,18,6,0.35)'; g.fillRect(0, r * 128 + 118, 512, 10); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
};
// the moon: pale painted disc, soft limb, crater mottling (alpha edge)
const moonBase = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  let sd = 99; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const gr = g.createRadialGradient(256, 246, 60, 256, 256, 252);
  gr.addColorStop(0, '#fdfdff'); gr.addColorStop(0.75, '#e6ecf7'); gr.addColorStop(0.96, '#c9d4ea'); gr.addColorStop(1, 'rgba(190,202,228,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(256, 256, 252, 0, 7); g.fill();
  for (let i = 0; i < 46; i++) { // craters / maria
    const a = rnd() * 6.28, rr = rnd() * 190, x = 256 + Math.cos(a) * rr, y = 256 + Math.sin(a) * rr, r = 12 + rnd() * 44;
    const cg = g.createRadialGradient(x, y, 1, x, y, r);
    cg.addColorStop(0, `rgba(148,164,196,${0.10 + rnd() * 0.13})`); cg.addColorStop(1, 'rgba(148,164,196,0)');
    g.fillStyle = cg; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  return c;
})();
// The eclipse bite is ERASED from the moon texture itself (destination-out):
// a separate shadow disc renders as a stray black circle wherever it drifts
// off the moon's face; an erased bite can only ever appear ON the moon.
const moonCanvasEl = document.createElement('canvas'); moonCanvasEl.width = moonCanvasEl.height = 512;
const moonCanvas = new THREE.CanvasTexture(moonCanvasEl); moonCanvas.colorSpace = THREE.SRGBColorSpace; moonCanvas.anisotropy = 4;
let moonBiteDrawn = -1;
const drawMoonBite = (cover) => {
  if (Math.abs(cover - moonBiteDrawn) < 0.004) return; moonBiteDrawn = cover;
  const g = moonCanvasEl.getContext('2d');
  g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, 512, 512); g.drawImage(moonBase, 0, 0);
  if (cover > 0.003) {
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.arc(256 + (1 - cover) * 520, 256, 258, 0, 7); g.fill();
    g.globalCompositeOperation = 'source-over';
  }
  moonCanvas.needsUpdate = true;
};
drawMoonBite(0);
// a panchang page: aged paper, ruled columns, a row of moon-phase circles
// per line — the calendar that runs the whole trick (prop texture, drawn
// abstractly; the only measured text in the film is the hook board)
const pageCanvas = (seed) => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 384;
  const g = c.getContext('2d');
  let sd = seed; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#e3d7b8'; g.fillRect(0, 0, 256, 384);
  for (let i = 0; i < 200; i++) { g.fillStyle = `rgba(150,110,50,${0.04 + rnd() * 0.05})`; g.fillRect(rnd() * 256, rnd() * 384, 3, 3); }
  g.strokeStyle = 'rgba(120,60,30,0.55)'; g.lineWidth = 2; g.strokeRect(10, 10, 236, 364);
  g.strokeStyle = 'rgba(90,50,30,0.4)'; g.lineWidth = 1;
  for (let r = 0; r < 9; r++) {
    const y = 44 + r * 38;
    g.beginPath(); g.moveTo(16, y + 24); g.lineTo(240, y + 24); g.stroke();
    // moon phase for this row: cycles dark -> crescent -> full
    const ph = (r % 5) / 4, cx = 42, cy = y + 10;
    g.fillStyle = '#8a6a30'; g.beginPath(); g.arc(cx, cy, 9, 0, 7); g.fill();
    if (ph < 0.98) { g.fillStyle = '#e8d9ae'; g.beginPath(); g.arc(cx + (1 - ph) * 13 - 2, cy, 8.4, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(60,35,20,0.75)'; g.lineWidth = 1.2; g.beginPath(); g.arc(cx, cy, 9, 0, 7); g.stroke();
    // date ticks + a column of small hand marks
    for (let k = 0; k < 4; k++) { const x = 74 + k * 42; g.strokeStyle = 'rgba(60,35,20,0.5)'; g.beginPath(); g.moveTo(x, y + 2); g.lineTo(x + 16 + rnd() * 8, y + 2); g.moveTo(x, y + 10); g.lineTo(x + 10 + rnd() * 10, y + 10); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
};
const MAT = {
  dirt: toon({ map: dirtCanvas(191), color: '#8b9bb8' }),
  dirtLight: toon({ map: dirtCanvas(77), color: '#a9b7d2' }),
  mud: toon({ map: mudCanvas(5, '#a97e4e'), color: '#b28a58' }),
  mudDk: toon({ map: mudCanvas(6, '#8a6538'), color: '#a37c4e' }),
  mudIn: toon({ map: mudCanvas(7, '#9a7444'), color: '#966f42' }),
  thatch: toon({ map: thatchCanvas(3), color: '#a8843e' }),
  wood: texM(M4.woodV4(4), 1, 2), woodDk: texM(M4.woodV4(6), 1, 2),
  leaf: toon({ color: '#2c4a3e' }), leafDk: toon({ color: '#1f382e' }),
  trunk: texM(M4.woodV4(9), 1, 3, '#8a6a4a'),
  ironDk: new THREE.MeshStandardMaterial({ color: 0x2c2c30, roughness: 0.55, metalness: 0.6, envMap, envMapIntensity: 0.5 }),
  lampGlass: new THREE.MeshBasicMaterial({ color: 0xffc36a }),
  dark: toon({ color: '#33302c' }),
  clothRed: toon({ color: '#8e2323' }), clothTeal: toon({ color: '#174f46' }),
  paper: toon({ color: '#efe6cc' }),
  brass: new THREE.MeshStandardMaterial({ color: 0xc9962e, roughness: 0.35, metalness: 0.85, envMap, envMapIntensity: 0.9 }),
  clay: toon({ color: '#9a5a34' }),
  pageL: toon({ map: pageCanvas(21), color: '#e6ddc8', side: THREE.DoubleSide }),
  pageR: toon({ map: pageCanvas(34), color: '#e6ddc8', side: THREE.DoubleSide }),
  bookCover: toon({ color: '#6a2a1e' }),
  moon: new THREE.MeshBasicMaterial({ map: moonCanvas, transparent: true, fog: false }),
  moonShadow: new THREE.MeshBasicMaterial({ color: 0x0b1322, fog: false }),
};

// ---------- THE VILLAGE SQUARE AT NIGHT ----------
// Hero hut front wall at z=-11 (door gap x -0.62..1.12), interior to
// z=-16.5. Stall at (3.1,-3.9), platform at (0.6,-3.2), neem tree at
// (-5.8,-5.5), the moon high over the rooftops at (10.5,23.5,-58).
const world = new THREE.Group(); scene.add(world);
const lanternGlows = [];
const lanternPools = [];
const poolTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const gg = c.getContext('2d'); const gr = gg.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(255,205,130,0.85)'); gr.addColorStop(1, 'rgba(255,205,130,0)'); gg.fillStyle = gr; gg.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
const makeLantern = (parent, x, y, z, s = 1) => {
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); parent.add(g);
  add(box(0.2, 0.05, 0.2), MAT.ironDk, 0, 0.14, 0, g, { cast: false });
  add(box(0.15, 0.24, 0.15), MAT.lampGlass, 0, 0, 0, g, { cast: false });
  add(box(0.21, 0.04, 0.21), MAT.ironDk, 0, -0.14, 0, g, { cast: false });
  const gl = softGlow(1.6, '#ffb45e', 0.4); g.add(gl); lanternGlows.push(gl);
  return g;
};
const lanternPost = (x, z) => {
  add(new THREE.CylinderGeometry(0.05, 0.07, 2.6, 7), MAT.woodDk, x, 1.3, z, world, { cast: false });
  add(box(0.5, 0.05, 0.05), MAT.woodDk, x + 0.2, 2.56, z, world, { cast: false });
  makeLantern(world, x + 0.38, 2.32, z);
  const lp = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.4), new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0.15, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  lp.rotation.x = -Math.PI / 2; lp.position.set(x + 0.3, 0.025, z); lp.userData.ndSkip = true; world.add(lp); lanternPools.push(lp);
};
{
  const g = world;
  MAT.dirt.map.repeat.set(18, 18);
  const ground = flat(add(new THREE.CircleGeometry(80, 40), MAT.dirt, 0, -0.02, 0, g, { cast: false }));
  ground.scale.set(1.25, 1, 1);
  MAT.dirtLight.map.repeat.set(5, 5);
  flat(add(new THREE.PlaneGeometry(17, 15), MAT.dirtLight, 0, 0.005, -4.5, g, { cast: false }));
  // ---- hero hut: front wall with a wide doorway, side/back walls, thatch roof
  add(tbox(3.98, 3.4, 0.3, 2), MAT.mud, -2.61, 1.7, -11, g, { cast: false });
  add(tbox(3.48, 3.4, 0.3, 2), MAT.mud, 2.86, 1.7, -11, g, { cast: false });
  add(tbox(1.74, 0.95, 0.3, 2), MAT.mud, 0.25, 2.93, -11, g, { cast: false });
  add(tbox(0.3, 3.4, 5.5, 2), MAT.mud, -4.6, 1.7, -13.75, g, { cast: false });
  add(tbox(0.3, 3.4, 5.5, 2), MAT.mud, 4.6, 1.7, -13.75, g, { cast: false });
  add(tbox(9.5, 3.4, 0.3, 2), MAT.mudDk, 0, 1.7, -16.5, g, { cast: false });
  const roofL = add(tbox(5.2, 0.14, 6.6, 2), MAT.thatch, -2.3, 4.0, -13.75, g, { cast: false }); roofL.rotation.z = 0.46;
  const roofR = add(tbox(5.2, 0.14, 6.6, 2), MAT.thatch, 2.3, 4.0, -13.75, g, { cast: false }); roofR.rotation.z = -0.46;
  const ceil = add(new THREE.PlaneGeometry(8.8, 5.4), MAT.mudDk, 0, 3.32, -13.75, g, { cast: false }); ceil.rotation.x = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.09, 0.09, 6.6, 6), MAT.woodDk, 0, 4.62, -13.75, g, { cast: false }).rotation.x = Math.PI / 2;
  // a lit window on the front wall (warm plane + frame)
  add(box(0.86, 0.96, 0.05), MAT.woodDk, 2.6, 1.68, -10.82, g, { cast: false });
  const winGlow = add(box(0.7, 0.8, 0.03), MAT.lampGlass, 2.6, 1.68, -10.8, g, { cast: false }); winGlow.userData.ndSkip = true;
  add(box(0.05, 0.8, 0.04), MAT.woodDk, 2.6, 1.68, -10.78, g, { cast: false });
  // interior: floor mat, the table with the panchang, charpai, clay pots
  flat(add(new THREE.PlaneGeometry(8.8, 5.2), MAT.mudIn, 0, 0.02, -13.8, g, { cast: false }));
  add(tbox(1.15, 0.06, 0.72, 2), MAT.woodDk, 0.55, 0.75, -12.9, g, { cast: false });
  for (const [lx, lz] of [[-0.48, -0.28], [0.48, -0.28], [-0.48, 0.28], [0.48, 0.28]])
    add(new THREE.CylinderGeometry(0.04, 0.04, 0.75, 6), MAT.woodDk, 0.55 + lx, 0.37, -12.9 + lz, g, { cast: false });
  makeLantern(g, 0.02, 1.06, -13.25, 0.8);
  add(tbox(1.9, 0.16, 0.8, 2), MAT.wood, -2.6, 0.3, -14.7, g, { cast: false });
  for (const [lx, lz] of [[-0.85, -0.32], [0.85, -0.32], [-0.85, 0.32], [0.85, 0.32]])
    add(new THREE.CylinderGeometry(0.04, 0.04, 0.24, 6), MAT.woodDk, -2.6 + lx, 0.12, -14.7 + lz, g, { cast: false });
  add(tbox(1.7, 0.05, 0.66, 2), MAT.clothRed, -2.6, 0.41, -14.7, g, { cast: false });
  const pot1 = add(new THREE.SphereGeometry(0.34, 10, 8), MAT.clay, -3.6, 0.26, -12.3, g, { cast: false }); pot1.scale.set(1, 0.82, 1);
  const pot2 = add(new THREE.SphereGeometry(0.26, 10, 8), MAT.clay, -3.25, 0.2, -15.7, g, { cast: false }); pot2.scale.set(1, 0.82, 1);
  add(tbox(1.6, 0.05, 0.4, 2), MAT.wood, -1.4, 1.9, -16.28, g, { cast: false });
  add(new THREE.SphereGeometry(0.16, 8, 6), MAT.clay, -1.7, 2.02, -16.28, g, { cast: false });
  add(new THREE.SphereGeometry(0.13, 8, 6), MAT.clay, -1.15, 1.99, -16.28, g, { cast: false });
  // the door lantern, hanging by the doorway
  add(box(0.05, 0.05, 0.55), MAT.woodDk, 1.3, 2.62, -10.75, g, { cast: false });
  makeLantern(g, 1.35, 2.32, -10.5, 0.95);
  // ---- the ticket stall: table, canopy, ticket stack, coin bowl
  add(tbox(1.7, 0.07, 0.9, 2), MAT.wood, 3.1, 0.75, -3.9, g, { cast: false });
  for (const [lx, lz] of [[-0.75, -0.35], [0.75, -0.35], [-0.75, 0.35], [0.75, 0.35]])
    add(new THREE.CylinderGeometry(0.045, 0.045, 0.75, 6), MAT.woodDk, 3.1 + lx, 0.37, -3.9 + lz, g, { cast: false });
  for (const [px, pz] of [[2.3, -4.35], [3.9, -4.35], [2.3, -3.45], [3.9, -3.45]])
    add(new THREE.CylinderGeometry(0.04, 0.04, 2.35, 6), MAT.woodDk, px, 1.17, pz, g, { cast: false });
  const canopy = add(tbox(2.1, 0.05, 1.3, 2), MAT.clothTeal, 3.1, 2.42, -3.9, g, { cast: false }); canopy.rotation.z = 0.07;
  for (let i = 0; i < 4; i++) add(box(0.34, 0.015, 0.24), MAT.paper, 2.72 + (i % 2) * 0.03, 0.8 + i * 0.016, -4.12 + (i % 3) * 0.02, g, { cast: false });
  const bowl = add(new THREE.CylinderGeometry(0.17, 0.11, 0.09, 12), MAT.brass, 3.5, 0.83, -3.7, g, { cast: false });
  for (let i = 0; i < 3; i++) { const cn = add(new THREE.CylinderGeometry(0.045, 0.045, 0.012, 10), MAT.brass, 3.44 + i * 0.06, 0.885, -3.72 + (i % 2) * 0.05, g, { cast: false }); }
  makeLantern(g, 3.62, 1.05, -4.28, 0.8);
  // a bench beside the stall
  const bench = new THREE.Group(); bench.position.set(4.95, 0, -5.3); bench.rotation.y = 0.4; g.add(bench);
  add(tbox(1.7, 0.13, 0.62, 2), MAT.wood, 0, 0.32, 0, bench, { cast: false });
  for (const [lx, lz] of [[-0.75, -0.22], [0.75, -0.22], [-0.75, 0.22], [0.75, 0.22]])
    add(new THREE.CylinderGeometry(0.04, 0.04, 0.28, 6), MAT.woodDk, lx, 0.14, lz, bench, { cast: false });
  // ---- the announcement platform (a grain crate he stands on)
  add(new THREE.CylinderGeometry(0.58, 0.62, 0.5, 14), MAT.wood, 1.1, 0.25, -3.5, g, { cast: false });
  add(new THREE.TorusGeometry(0.6, 0.025, 6, 20), MAT.ironDk, 1.1, 0.42, -3.5, g, { cast: false }).rotation.x = Math.PI / 2;
  // ---- the neem tree with a hanging lantern
  const trunk = add(new THREE.CylinderGeometry(0.3, 0.46, 3.4, 9), MAT.trunk, -5.8, 1.7, -5.5, g, { cast: false }); trunk.rotation.z = 0.06;
  for (const [bx, by, bz, rz, ln] of [[-5.2, 3.9, -5.3, -0.7, 1.6], [-6.5, 4.0, -5.8, 0.8, 1.5], [-5.7, 4.1, -4.6, 0.2, 1.3]]) {
    const br = add(new THREE.CylinderGeometry(0.09, 0.14, ln, 6), MAT.trunk, bx, by, bz, g, { cast: false }); br.rotation.z = rz;
  }
  for (const [fx, fy, fz, fr, dk] of [[-5.6, 4.9, -5.6, 2.3, 0], [-7.3, 4.4, -5.2, 1.7, 1], [-4.1, 4.5, -5.9, 1.8, 1], [-5.9, 5.6, -4.7, 1.6, 0], [-6.8, 5.2, -6.6, 1.5, 0]]) {
    const fol = add(new THREE.SphereGeometry(fr, 10, 8), dk ? MAT.leafDk : MAT.leaf, fx, fy, fz, g, { cast: false }); fol.scale.set(1.15, 0.72, 1.15);
  }
  add(new THREE.CylinderGeometry(0.015, 0.015, 0.85, 4), MAT.dark, -4.75, 3.6, -4.85, g, { cast: false });
  makeLantern(g, -4.75, 3.05, -4.85, 0.9);
  // ---- lantern posts around the square
  lanternPost(3.9, -2.6); lanternPost(-3.4, 1.8); lanternPost(-3.1, -8.6);
  // ---- neighbour huts (silhouette dressing with lit windows)
  const hut = (x, z, ry, s = 1) => {
    const hg = new THREE.Group(); hg.position.set(x, 0, z); hg.rotation.y = ry; hg.scale.setScalar(s); g.add(hg);
    add(tbox(4.2, 2.9, 3.4, 2), MAT.mudDk, 0, 1.45, 0, hg, { cast: false });
    const r1 = add(tbox(4.8, 0.12, 2.4, 2), MAT.thatch, -1.15, 3.35, 0, hg, { cast: false }); r1.rotation.z = 0.5;
    const r2 = add(tbox(4.8, 0.12, 2.4, 2), MAT.thatch, 1.15, 3.35, 0, hg, { cast: false }); r2.rotation.z = -0.5;
    const wg = add(box(0.55, 0.65, 0.04), MAT.lampGlass, -0.9, 1.5, 1.72, hg, { cast: false }); wg.userData.ndSkip = true;
  };
  hut(-10.5, -12, 0.4); hut(10.5, -11, -0.35); hut(-9, 3, 0.9, 0.9); hut(9.5, 4, -0.8, 0.9);
  // scattered stones + dry grass tufts (kept off the actor paths)
  let sd2 = 31; const rnd2 = () => (sd2 = (sd2 * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 26; i++) {
    const sx = -13 + rnd2() * 26, sz = -16 + rnd2() * 22;
    if (Math.hypot(sx - 1, sz + 4) < 5.5 || Math.hypot(sx - 3.1, sz + 3.9) < 2.2) continue;
    const st = add(new THREE.SphereGeometry(0.09 + rnd2() * 0.13, 7, 5), MAT.mudDk, sx, 0.04, sz, g, { cast: false }); st.scale.set(1, 0.55, 1);
  }
  for (let i = 0; i < 34; i++) {
    const sx = -13 + rnd2() * 26, sz = -16 + rnd2() * 22;
    if (Math.hypot(sx - 1, sz + 4) < 5 || Math.hypot(sx - 3.1, sz + 3.9) < 2) continue;
    const tu = add(new THREE.ConeGeometry(0.09, 0.34 + rnd2() * 0.2, 5), MAT.leafDk, sx, 0.17, sz, g, { cast: false }); tu.rotation.z = (rnd2() - 0.5) * 0.3;
  }
}
// ---------- THE MOON + its shadow + stars ----------
// The moon hangs fixed over the rooftops; a dark shadow disc slides
// across it (coverK): a half bite on no-ticket nights, total at the
// eclipse, gone again when the book's hour comes.
const MOON_POS = [10.5, 23.5, -58];
const moonG = new THREE.Group(); moonG.position.set(...MOON_POS); scene.add(moonG);
const moonDisc = new THREE.Mesh(new THREE.CircleGeometry(6.2, 40), MAT.moon);
moonDisc.userData.ndSkip = true; moonG.add(moonDisc);
const moonGlow = softGlow(30, '#aebfff', 0.3); moonGlow.position.set(0, 0, -3); moonG.add(moonGlow); // 3 m BEHIND the disc: a billboard through the disc centre plane seam-splits the moon face

const starPts = (() => {
  const n = 340, pos = new Float32Array(n * 3);
  let sd = 7; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, e = 0.12 + rnd() * 1.35, r = 420;
    pos[i * 3] = Math.cos(a) * Math.cos(e) * r; pos[i * 3 + 1] = Math.sin(e) * r; pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r - 60;
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color: 0xcdd9ff, size: 1.7, sizeAttenuation: false, transparent: true, opacity: 0.35, fog: false, depthWrite: false });
  const p = new THREE.Points(geo, m); p.userData.ndSkip = true; scene.add(p); return p;
})();
// ---------- the panchang book on the hut table ----------
const bookG = new THREE.Group(); bookG.position.set(0.55, 0.79, -12.9); bookG.rotation.y = -0.35; world.add(bookG);
{
  add(tbox(0.68, 0.045, 0.5, 2), MAT.bookCover, 0, 0.01, 0, bookG, { cast: false });
  const pageGeoL = new THREE.PlaneGeometry(0.31, 0.45); pageGeoL.rotateX(-Math.PI / 2);
  const pl = new THREE.Mesh(pageGeoL, MAT.pageL); pl.position.set(-0.163, 0.038, 0); pl.rotation.z = 0.1; pl.userData.nd = ndMat; bookG.add(pl);
  const pageGeoR = new THREE.PlaneGeometry(0.31, 0.45); pageGeoR.rotateX(-Math.PI / 2);
  const pr = new THREE.Mesh(pageGeoR, MAT.pageR); pr.position.set(0.163, 0.038, 0); pr.rotation.z = -0.1; pr.userData.nd = ndMat; bookG.add(pr);
}
const flipPivot = new THREE.Group(); flipPivot.position.set(0, 0.045, 0); bookG.add(flipPivot);
const flipPage = (() => {
  const geo = new THREE.PlaneGeometry(0.31, 0.45); geo.translate(0.155, 0, 0); geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, MAT.pageR); m.userData.nd = ndMat; flipPivot.add(m); return m;
})();
// ---------- boards ----------
// The hook board: next story's question, standing in the square. Its
// transform is mirrored in boards.json — keep in sync. It rises at the
// start of the final shot and HOLDS at full opacity to the last frame.
const boardHook = textBoard(['लेकिन कल...', 'वह हलवाई जिसकी मिठाई', 'की थाली कभी खाली', 'नहीं होती थी?'], 3.9, 1.75, '#2a1a0c', '#ffe9a8', 900, { pitch: 0.185, dy: 0.01, fsMul: 0.65 });
boardHook.position.set(...BOARD_POS); world.add(boardHook); addBoardOccluder(boardHook, 3.9, 1.75, 'hookK');
add(tbox(0.09, 2.0, 0.09, 2), MAT.woodDk, -1.7, 0.6, -8.28, world, { cast: false });
add(tbox(0.09, 2.0, 0.09, 2), MAT.woodDk, 1.7, 0.6, -8.28, world, { cast: false });
// ---------- FX: lantern dust / fireflies + the book glint ----------
const smoke = new FX.Smoke(scene, 220); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const moteEmit = smoke.addEmitter(3.9, 2.3, -2.6, { rate: 0.4, color: 0xffd9a0, opacity: 0.07, scale: 0.4, grow: 1.2, life: 3.4, vy: 0.04, wind: 0.05 });
const blastEmit = smoke.addEmitter(0, 1.6, -30, { rate: 0, color: 0xcbb59a, opacity: 0.3, scale: 1.0, grow: 2.0, life: 2.2, vy: 0.4, wind: 0.2 });
const sparkEmit = smoke.addEmitter(0.55, 1.2, -12.9, { rate: 0, color: 0xffe9a8, opacity: 0.55, scale: 0.3, grow: 0.7, life: 1.0, vy: 0.5, wind: 0.05 });
const fxClouds = new FX.Clouds(scene, { count: 5, y: 60, opacity: 0.0, color: 0x93a7d4, drift: 0.4 });
fxClouds.items.forEach((cl) => { cl.visible = false; }); // night sky stays clean: clouds veiled the moon with quad-edge seams
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
    fxF++; const t = fxF / 30, dt = 1 / 30, pr = fxProfileAt(fxF), Ws = worldAt(fxF);
    moteEmit.rate = pr.moteRate * 3;
    blastEmit.rate = pr.blastRate * 3; blastEmit.x = Ws.blastX; blastEmit.y = Ws.blastY; blastEmit.z = Ws.blastZ;
    sparkEmit.rate = pr.sparkRate * 3; sparkEmit.x = Ws.blastX; sparkEmit.y = Ws.blastY; sparkEmit.z = Ws.blastZ;
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

// ---------- word-by-word captions (the reference's signature) ----------
// Screen-space overlay rendered AFTER the dof pass: one word at a time,
// bold white with a thick black stroke, centred, baseline ~79% of frame
// height, timed from the char-mapped script words (web/words.js). The
// word holds until the next word starts.
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
  fxStepTo(f);
  skyU.time.value = f / 30;
  scene.traverse((o) => { if (o.userData.isOccluder) o.visible = o.userData.boardKey === 'always' || (Ws[o.userData.boardKey] ?? 1) > 0.01; });
  boardHook.material.opacity = Ws.hookK ?? 1; boardHook.visible = (Ws.hookK ?? 1) > 0.01;
  const flick = 0.92 + 0.08 * Math.sin(f * 0.35) * Math.sin(f * 0.13 + 1.7);
  lampA.intensity = 11 * (Ws.lampK ?? 1) * flick;
  lampB.intensity = 8 * (Ws.lampK ?? 1) * (2 - flick) * 0.55 + 3.5 * (Ws.lampK ?? 1);
  hutLight.intensity = 9 * (Ws.hutK ?? 0) * (0.9 + 0.1 * Math.sin(f * 0.31 + 2.2));
  lampSpot.intensity = 0;
  lanternGlows.forEach((gl, i) => { gl.material.opacity = 0.36 * (Ws.lampK ?? 1) * (0.9 + 0.1 * Math.sin(f * 0.3 + i * 2.1)); });
  lanternPools.forEach((lp) => { lp.material.opacity = 0.15 * (Ws.lampK ?? 1) * flick; });
  // the moon + its shadow: coverK slides the dark disc across the face
  const mk = Ws.moonK ?? 1;
  MAT.moon.color.setRGB(0.3 + 0.7 * mk, 0.32 + 0.7 * mk, 0.38 + 0.68 * mk);
  moonGlow.material.opacity = 0.3 * mk;
  drawMoonBite(Ws.coverK || 0);
  starPts.material.opacity = Ws.starK ?? 0.35;
  // the panchang page turns (bookK 0..1 inside a flip window)
  const bk = Ws.bookK || 0;
  flipPivot.visible = bk > 0.001 && bk < 0.999;
  flipPivot.rotation.z = bk * 2.85;
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
  placeSun(L, new THREE.Vector3(...(C.shadowAt || C.look)) );
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
  drawCaption(f);
  renderer.autoClear = false; renderer.render(capScene, fsCam); renderer.autoClear = true;
  return true;
};
window.TOTAL = TOTAL;
window.ready = true;
