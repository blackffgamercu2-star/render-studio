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
// Practicals: lampA = THE screen lamp behind the cloth (the key light of
// the whole film), lampB = the audience-side lantern post, hutLight = the
// puppeteer's corner lantern. lampSpot throws the lamp's cone onto the
// screen platform so the light spill is real geometry light.
const hemi = new THREE.HemisphereLight('#ffffff', '#ffffff', 1); scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffffff', 2); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; sun.shadow.radius = 2;
scene.add(sun); scene.add(sun.target);
scene.fog = new THREE.Fog('#ffffff', 40, 600);
const lampA = new THREE.PointLight(0xffb45e, 30, 30, 1.8); lampA.position.set(0, 1.8, -10.8); scene.add(lampA);
const lampB = new THREE.PointLight(0xffa64e, 26, 24, 1.8); lampB.position.set(-4.55, 2.3, -3.3); scene.add(lampB);
const hutLight = new THREE.PointLight(0xffc95e, 20, 18, 1.7); hutLight.position.set(4.35, 1.6, -8.15); scene.add(hutLight);
const lampSpot = new THREE.SpotLight(0xffd9a0, 0, 30, 0.62, 0.7, 1.1); lampSpot.position.set(0, 1.8, -10.9); scene.add(lampSpot); scene.add(lampSpot.target);
lampSpot.target.position.set(0, 1.1, -8.6);

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
// woven cotton screen cloth: warm off-white, visible weave + seam lines —
// the lamp behind it is faked by modulating this material's colour.
const clothCanvas = (seed) => {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  let sd = seed; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#f3e7cd'; g.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 3) { g.fillStyle = `rgba(160,128,84,${0.05 + rnd() * 0.05})`; g.fillRect(0, y, 512, 1); }
  for (let x = 0; x < 512; x += 3) { g.fillStyle = `rgba(160,128,84,${0.04 + rnd() * 0.04})`; g.fillRect(x, 0, 1, 512); }
  for (let i = 0; i < 130; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 8 + rnd() * 40;
    const gr = g.createRadialGradient(x, y, 1, x, y, r);
    gr.addColorStop(0, rnd() > 0.5 ? 'rgba(146,110,58,0.10)' : 'rgba(255,250,232,0.10)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  g.fillStyle = 'rgba(120,88,44,0.35)'; g.fillRect(254, 0, 3, 512); // centre seam
  g.strokeStyle = 'rgba(120,88,44,0.5)'; g.lineWidth = 5; g.strokeRect(4, 4, 504, 504); // hem
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
};
// a striped dari mat for the audience rows
const dariCanvas = (seed, base, stripe) => {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  let sd = seed; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 32) { g.fillStyle = stripe; g.fillRect(x, 0, 9, 256); }
  for (let i = 0; i < 1600; i++) { g.fillStyle = rnd() > 0.5 ? 'rgba(255,240,210,0.06)' : 'rgba(20,10,4,0.08)'; g.fillRect(rnd() * 256, rnd() * 256, 2, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
};
// bunting: a strip of triangle flags on a string (alpha canvas)
const buntCanvas = (() => {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 128;
  const g = c.getContext('2d');
  const cols = ['#d9483b', '#e8a13a', '#3f9e63', '#3a6fd8', '#c94f8e', '#e8dcc0'];
  g.strokeStyle = 'rgba(30,20,12,0.9)'; g.lineWidth = 5;
  g.beginPath(); g.moveTo(0, 14); g.quadraticCurveTo(512, 44, 1024, 14); g.stroke();
  for (let i = 0; i < 12; i++) {
    const x = 26 + i * 84, y = 16 + Math.sin(i / 11 * Math.PI) * 16;
    g.fillStyle = cols[i % cols.length];
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + 56, y + 2); g.lineTo(x + 28, y + 74); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(30,20,12,0.55)'; g.lineWidth = 3; g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
})();
// the moon: pale painted disc (no eclipse in this film)
const moonBase = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  let sd = 99; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const gr = g.createRadialGradient(256, 246, 60, 256, 256, 252);
  gr.addColorStop(0, '#fdfdff'); gr.addColorStop(0.75, '#e6ecf7'); gr.addColorStop(0.96, '#c9d4ea'); gr.addColorStop(1, 'rgba(190,202,228,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(256, 256, 252, 0, 7); g.fill();
  for (let i = 0; i < 46; i++) {
    const a = rnd() * 6.28, rr = rnd() * 190, x = 256 + Math.cos(a) * rr, y = 256 + Math.sin(a) * rr, r = 12 + rnd() * 44;
    const cg = g.createRadialGradient(x, y, 1, x, y, r);
    cg.addColorStop(0, `rgba(148,164,196,${0.10 + rnd() * 0.13})`); cg.addColorStop(1, 'rgba(148,164,196,0)');
    g.fillStyle = cg; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
})();
const MAT = {
  dirt: toon({ map: dirtCanvas(191), color: '#8b9bb8' }),
  dirtLight: toon({ map: dirtCanvas(77), color: '#a9b7d2' }),
  wood: texM(M4.woodV4(4), 1, 2), woodDk: texM(M4.woodV4(6), 1, 2),
  bamboo: texM(M4.woodV4(11), 1, 3, '#c9a86a'),
  leaf: toon({ color: '#2c4a3e' }), leafDk: toon({ color: '#1f382e' }),
  trunk: texM(M4.woodV4(9), 1, 3, '#8a6a4a'),
  ironDk: new THREE.MeshStandardMaterial({ color: 0x2c2c30, roughness: 0.55, metalness: 0.6, envMap, envMapIntensity: 0.5 }),
  lampGlass: new THREE.MeshBasicMaterial({ color: 0xffc36a }),
  dark: toon({ color: '#33302c' }),
  clothRed: toon({ color: '#8e2323' }), clothTeal: toon({ color: '#174f46' }),
  brass: new THREE.MeshStandardMaterial({ color: 0xc9962e, roughness: 0.35, metalness: 0.85, envMap, envMapIntensity: 0.9 }),
  clay: toon({ color: '#9a5a34' }),
  screenCloth: new THREE.MeshBasicMaterial({ map: clothCanvas(17), side: THREE.DoubleSide, fog: true }),
  dariA: toon({ map: dariCanvas(3, '#7a2e35', '#c9a86a'), color: '#b09aa8' }),
  dariB: toon({ map: dariCanvas(8, '#274b63', '#c9542e'), color: '#a8b4c4' }),
  bunt: new THREE.MeshBasicMaterial({ map: buntCanvas, transparent: true, side: THREE.DoubleSide, fog: true }),
  moon: new THREE.MeshBasicMaterial({ map: moonBase, transparent: true, fog: false }),
};

// ---------- THE OPEN-AIR THEATRE GROUND AT NIGHT ----------
// The screen stands at z=-9 (cloth 5.4 x 3.3, centre y 2.35) on a low
// platform; the big lamp burns behind it at z=-10.8; the audience sits
// on dari mats at z=-4.6..-6.8 facing it; the puppeteer's corner is at
// (3.9,-8.3); the hook board waits by the entrance at BOARD_POS.
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
// the screen cloth hangs from the top beam: the cloth group pivots AT
// the beam (y 4.02) so wind flap swings it and the gust can tear the
// whole cloth away (flyK) while the frame stays standing.
const clothG = new THREE.Group(); clothG.position.set(0, 4.02, -9); world.add(clothG);
let screenGlowSprite = null;
const buntL = new THREE.Group(), buntR = new THREE.Group();
{
  const g = world;
  MAT.dirt.map.repeat.set(18, 18);
  const ground = flat(add(new THREE.CircleGeometry(80, 40), MAT.dirt, 0, -0.02, 0, g, { cast: false }));
  ground.scale.set(1.25, 1, 1);
  MAT.dirtLight.map.repeat.set(5, 5);
  flat(add(new THREE.PlaneGeometry(19, 13), MAT.dirtLight, 0, 0.005, -5.5, g, { cast: false }));
  // ---- the stage platform + screen frame
  add(tbox(6.8, 0.5, 1.9, 2), MAT.wood, 0, 0.25, -9.15, g, { cast: false });
  add(tbox(7.3, 0.09, 2.3, 2), MAT.woodDk, 0, 0.545, -9.15, g, { cast: false });
  for (const sx of [-2.95, 2.95]) {
    add(new THREE.CylinderGeometry(0.055, 0.07, 4.7, 7), MAT.bamboo, sx, 2.35, -9, g, { cast: false });
    add(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 4), MAT.dark, sx * 1.06, 0.3, -8.2, g, { cast: false }).rotation.z = sx > 0 ? 0.5 : -0.5; // guy rope peg
  }
  const beam = add(new THREE.CylinderGeometry(0.05, 0.05, 6.3, 7), MAT.bamboo, 0, 4.06, -9, g, { cast: false }); beam.rotation.z = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.045, 0.045, 6.3, 7), MAT.bamboo, 0, 0.62, -9, g, { cast: false }).rotation.z = Math.PI / 2;
  // the cloth itself (child of clothG, hangs below the beam pivot)
  const cloth = add(new THREE.PlaneGeometry(5.5, 3.36), MAT.screenCloth, 0, -1.7, 0, clothG, { cast: false });
  cloth.userData.ndSkip = true;
  screenGlowSprite = softGlow(9.5, '#ffb45e', 0.0); screenGlowSprite.position.set(0, -1.7, 0.25); clothG.add(screenGlowSprite);
  // ---- THE lamp behind the screen: tripod stand + big lantern + flame glow
  for (const [lx, lz, rz] of [[-0.34, -0.1, 0.42], [0.34, -0.1, -0.42], [0, 0.36, 0]]) {
    const leg = add(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 5), MAT.woodDk, lx * 0.6, 0.72, -10.8 + lz * 0.6, g, { cast: false }); leg.rotation.z = rz;
  }
  add(new THREE.CylinderGeometry(0.3, 0.36, 0.1, 10), MAT.ironDk, 0, 1.42, -10.8, g, { cast: false });
  makeLantern(g, 0, 1.68, -10.8, 1.7);
  const lampFlameGlow = softGlow(3.4, '#ffc36a', 0.5); lampFlameGlow.position.set(0, 1.72, -10.75); g.add(lampFlameGlow); lanternGlows.push(lampFlameGlow);
  const lp2 = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 5), new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  lp2.rotation.x = -Math.PI / 2; lp2.position.set(0, 0.56, -9.9); lp2.userData.ndSkip = true; g.add(lp2); lanternPools.push(lp2);
  // ---- audience dari mats (3 rows)
  flat(add(new THREE.PlaneGeometry(7.6, 1.15), MAT.dariA, -0.4, 0.012, -4.7, g, { cast: false }));
  flat(add(new THREE.PlaneGeometry(8.4, 1.15), MAT.dariB, 0.3, 0.012, -6.0, g, { cast: false }));
  flat(add(new THREE.PlaneGeometry(7.2, 1.05), MAT.dariA, -0.2, 0.012, -7.25, g, { cast: false }));
  // ---- the puppeteer's corner: crate, prop basket, spare puppets on a pole
  add(tbox(0.95, 0.62, 0.7, 2), MAT.wood, 3.95, 0.31, -8.35, g, { cast: false });
  add(new THREE.CylinderGeometry(0.3, 0.24, 0.42, 9), MAT.clay, 4.65, 0.21, -7.6, g, { cast: false });
  add(new THREE.CylinderGeometry(0.035, 0.035, 2.5, 6), MAT.bamboo, 4.7, 1.25, -8.8, g, { cast: false });
  add(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 5), MAT.bamboo, 4.7, 2.42, -8.8, g, { cast: false }).rotation.z = Math.PI / 2;
  for (const [hx, tone] of [[4.35, MAT.clothRed], [4.72, MAT.clothTeal], [5.06, MAT.dark]]) {
    add(new THREE.SphereGeometry(0.11, 8, 6), tone, hx, 2.14, -8.8, g, { cast: false });
    add(tbox(0.2, 0.34, 0.05, 2), tone, hx, 1.9, -8.8, g, { cast: false });
  }
  const bowl = add(new THREE.CylinderGeometry(0.19, 0.12, 0.1, 12), MAT.brass, 3.8, 0.68, -8.2, g, { cast: false });
  for (let i = 0; i < 3; i++) add(new THREE.CylinderGeometry(0.048, 0.048, 0.014, 10), MAT.brass, 3.74 + i * 0.07, 0.745, -8.22 + (i % 2) * 0.05, g, { cast: false });
  makeLantern(g, 4.42, 1.02, -8.62, 0.85);
  // ---- entrance side: ticket post + a bench
  add(new THREE.CylinderGeometry(0.05, 0.07, 2.3, 7), MAT.woodDk, -4.6, 1.15, -3.4, g, { cast: false });
  makeLantern(g, -4.55, 2.32, -3.3, 0.95);
  const bench = new THREE.Group(); bench.position.set(-4.9, 0, -6.4); bench.rotation.y = 0.5; g.add(bench);
  add(tbox(1.8, 0.13, 0.6, 2), MAT.wood, 0, 0.34, 0, bench, { cast: false });
  for (const [lx, lz] of [[-0.78, -0.2], [0.78, -0.2], [-0.78, 0.2], [0.78, 0.2]])
    add(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 6), MAT.woodDk, lx, 0.15, lz, bench, { cast: false });
  // ---- bunting strings: screen top corners out to side poles
  const buntGeo = new THREE.PlaneGeometry(6.4, 0.85);
  const bL = new THREE.Mesh(buntGeo, MAT.bunt); bL.position.set(-4.35, 4.0, -7.6); bL.rotation.y = 0.42; bL.userData.ndSkip = true; buntL.add(bL); g.add(buntL);
  const bR = new THREE.Mesh(buntGeo, MAT.bunt); bR.position.set(4.35, 4.0, -7.6); bR.rotation.y = -0.42; bR.userData.ndSkip = true; buntR.add(bR); g.add(buntR);
  add(new THREE.CylinderGeometry(0.05, 0.06, 3.6, 6), MAT.bamboo, -7.3, 1.8, -6.2, g, { cast: false });
  add(new THREE.CylinderGeometry(0.05, 0.06, 3.6, 6), MAT.bamboo, 7.3, 1.8, -6.2, g, { cast: false });
  // ---- trees + far huts (silhouette dressing, lit windows)
  const tree = (x, z, s = 1) => {
    const trunk = add(new THREE.CylinderGeometry(0.26 * s, 0.42 * s, 3.2 * s, 8), MAT.trunk, x, 1.6 * s, z, g, { cast: false }); trunk.rotation.z = 0.05;
    for (const [fx, fy, fz, fr, dk] of [[-0.4, 4.6, 0, 2.1, 0], [1.2, 4.1, -0.4, 1.6, 1], [-1.4, 4.2, 0.3, 1.7, 1], [0.2, 5.3, 0.4, 1.5, 0]]) {
      const fol = add(new THREE.SphereGeometry(fr * s, 9, 7), dk ? MAT.leafDk : MAT.leaf, x + fx * s, fy * s, z + fz * s, g, { cast: false }); fol.scale.set(1.15, 0.7, 1.15);
    }
  };
  tree(-8.6, -10.5, 1.15); tree(9.2, -11.5, 1.3); tree(-10.5, -3.5, 0.9);
  const hut = (x, z, ry, s = 1) => {
    const hg = new THREE.Group(); hg.position.set(x, 0, z); hg.rotation.y = ry; hg.scale.setScalar(s); g.add(hg);
    add(tbox(4.2, 2.9, 3.4, 2), MAT.dark, 0, 1.45, 0, hg, { cast: false });
    const r1 = add(tbox(4.8, 0.12, 2.4, 2), MAT.dark, -1.15, 3.35, 0, hg, { cast: false }); r1.rotation.z = 0.5;
    const r2 = add(tbox(4.8, 0.12, 2.4, 2), MAT.dark, 1.15, 3.35, 0, hg, { cast: false }); r2.rotation.z = -0.5;
    const wg = add(box(0.55, 0.65, 0.04), MAT.lampGlass, -0.9, 1.5, 1.72, hg, { cast: false }); wg.userData.ndSkip = true;
  };
  hut(-12.5, -14, 0.4); hut(12.5, -13, -0.35); hut(11.5, 2, -0.9, 0.9);
  lanternPost(-3.1, -11.8); lanternPost(7.3, -3.2);
  // scattered stones + dry grass tufts (kept off the mats and stage)
  let sd2 = 31; const rnd2 = () => (sd2 = (sd2 * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 26; i++) {
    const sx = -13 + rnd2() * 26, sz = -15 + rnd2() * 20;
    if (Math.abs(sx) < 5.2 && sz < -3.4 && sz > -8.4) continue;
    if (Math.hypot(sx, sz + 9.2) < 4.4) continue;
    const st = add(new THREE.SphereGeometry(0.09 + rnd2() * 0.13, 7, 5), MAT.dark, sx, 0.04, sz, g, { cast: false }); st.scale.set(1, 0.55, 1);
  }
  for (let i = 0; i < 30; i++) {
    const sx = -13 + rnd2() * 26, sz = -15 + rnd2() * 20;
    if (Math.abs(sx) < 5.2 && sz < -3.4 && sz > -8.4) continue;
    const tu = add(new THREE.ConeGeometry(0.09, 0.34 + rnd2() * 0.2, 5), MAT.leafDk, sx, 0.17, sz, g, { cast: false }); tu.rotation.z = (rnd2() - 0.5) * 0.3;
  }
}
// ---------- the moon + stars ----------
const MOON_POS = [-11.5, 24.5, -58];
const moonG = new THREE.Group(); moonG.position.set(...MOON_POS); scene.add(moonG);
const moonDisc = new THREE.Mesh(new THREE.CircleGeometry(5.6, 40), MAT.moon);
moonDisc.userData.ndSkip = true; moonG.add(moonDisc);
const moonGlow = softGlow(27, '#aebfff', 0.28); moonGlow.position.set(0, 0, -3); moonG.add(moonGlow);
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
// ---------- boards ----------
// The hook board stands by the entrance; its transform is mirrored in
// boards.json — keep in sync. It rises at the start of the final shot
// and HOLDS at full opacity to the last frame.
const boardHook = textBoard(['लेकिन कल...', 'वह मोमबत्ती जो', 'कभी बुझती ही', 'नहीं थी?'], 3.9, 1.75, '#2a1a0c', '#ffe9a8', 900, { pitch: 0.22, dy: 0.032, fsMul: 0.74 });
boardHook.position.set(...BOARD_POS); world.add(boardHook); addBoardOccluder(boardHook, 3.9, 1.75, 'hookK');
add(tbox(0.09, 2.0, 0.09, 2), MAT.woodDk, BOARD_POS[0] - 2.2, 0.6, BOARD_POS[2] - 0.08, world, { cast: false });
add(tbox(0.09, 2.0, 0.09, 2), MAT.woodDk, BOARD_POS[0] + 2.2, 0.6, BOARD_POS[2] - 0.08, world, { cast: false });
// ---------- FX: lamp-beam dust + wind gust dust ----------
const smoke = new FX.Smoke(scene, 220); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const moteEmit = smoke.addEmitter(0, 1.8, -10.6, { rate: 0.4, color: 0xffd9a0, opacity: 0.07, scale: 0.4, grow: 1.2, life: 3.4, vy: 0.05, wind: 0.06 });
const blastEmit = smoke.addEmitter(0, 1.6, -30, { rate: 0, color: 0xcbb59a, opacity: 0.3, scale: 1.0, grow: 2.0, life: 2.2, vy: 0.4, wind: 0.2 });
const sparkEmit = smoke.addEmitter(0, 1.9, -10.8, { rate: 0, color: 0xffe9a8, opacity: 0.55, scale: 0.3, grow: 0.7, life: 1.0, vy: 0.5, wind: 0.05 });
const fxClouds = new FX.Clouds(scene, { count: 5, y: 60, opacity: 0.0, color: 0x93a7d4, drift: 0.4 });
fxClouds.items.forEach((cl) => { cl.visible = false; });
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
// height, timed from the char-mapped script words (web/words.js).
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
  const gust = Ws.gustK ?? 0; // wind: the lamp flame leans and gutters
  const gFlick = flick * (1 - 0.35 * gust * (0.5 + 0.5 * Math.sin(f * 0.9)));
  lampA.intensity = 30 * (Ws.screenK ?? 1) * gFlick;
  lampSpot.intensity = 55 * (Ws.screenK ?? 1) * gFlick;
  lampB.intensity = 8 * (Ws.lampK ?? 1) * (2 - flick) * 0.55 + 3.5 * (Ws.lampK ?? 1);
  hutLight.intensity = 10 * (Ws.lampK ?? 1) * (0.9 + 0.1 * Math.sin(f * 0.31 + 2.2));
  lanternGlows.forEach((gl, i) => { gl.material.opacity = 0.36 * (Ws.lampK ?? 1) * (0.9 + 0.1 * Math.sin(f * 0.3 + i * 2.1)); });
  lanternPools.forEach((lp) => { lp.material.opacity = 0.15 * (Ws.lampK ?? 1) * flick; });
  // the screen cloth: lit from behind by the lamp — brightest at the
  // lamp's height, and it FLAPS in the wind, then tears away (flyK).
  const sk = Ws.screenK ?? 1;
  MAT.screenCloth.color.setRGB(0.34 + 0.66 * sk, 0.30 + 0.62 * sk, 0.22 + 0.5 * sk);
  if (screenGlowSprite) screenGlowSprite.material.opacity = 0.34 * sk * gFlick;
  const flap = (Ws.flapK ?? 0) * (Math.sin(f * 0.55) * 0.06 + Math.sin(f * 1.31 + 1) * 0.035);
  const fly = Ws.flyK ?? 0;
  clothG.position.set(fly * 8.5, 4.02 + fly * 2.6 - fly * fly * 2.2, -9 + fly * 2.4);
  clothG.rotation.set(-0.03 - flap - fly * 0.7, fly * 0.5, fly * 1.85 + flap * 0.4);
  clothG.visible = fly < 0.999;
  buntL.rotation.z = 0.02 * Math.sin(f * 0.4) + (Ws.flapK ?? 0) * 0.1 * Math.sin(f * 0.95);
  buntR.rotation.z = -0.02 * Math.sin(f * 0.43 + 1) - (Ws.flapK ?? 0) * 0.1 * Math.sin(f * 1.05 + 2);
  starPts.material.opacity = Ws.starK ?? 0.35;
}
function drawActors(list, cam) {
  cards.forEach((c) => { c.mesh.visible = c.blob.visible = false; });
  list.forEach((a, i) => {
    const c = getCard(i);
    c.draw(a.key, a.draw);
    c.mesh.visible = true; c.mesh.position.set(a.x, a.y, a.z);
    const s = a.s || 1; c.mesh.scale.set(s * (a.flip ? -1 : 1), s, s);
    // flat actors (the shadow ON the screen, audience backs) keep the
    // stage's facing instead of billboarding toward the camera.
    c.mesh.rotation.set(a.flat ? (a.pitch || 0) : 0, a.flat ? (a.yaw || 0) : Math.atan2(cam.position.x - a.x, cam.position.z - a.z) + (a.yaw || 0), a.roll || 0);
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
  drawCaption(f);
  renderer.autoClear = false; renderer.render(capScene, fsCam); renderer.autoClear = true;
  return true;
};
window.TOTAL = TOTAL;
window.ready = true;
