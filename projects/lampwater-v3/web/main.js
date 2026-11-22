// lampwater-v2 main.js — FULL FILM rebuild (2026-11-22) on the
// LEARNED STANDARD + MATERIAL/COLOUR STANDARD: the proof's material
// techniques (planar-reflection water, PBR stone, physical glass,
// lathe clay diya, caustics) re-graded to the measured reference
// palette (saturated + warm), extended with the full film's set
// (cottages, office + almanac, hook board, fleet, gulls, clouds).
// Base: lampwater-proof main.js — the payoff segment rebuilt to Abid's
// NEW standard (2026-11-21):
//  MATERIALS (modern three.js technique, no painted-flat look):
//   - WATER: true planar reflection (mirrored camera + oblique
//     scene clip into an RT) sampled through animated normals —
//     fresnel, sun glint, moving sparkle; from below it becomes
//     a bright teal Snell surface. Animated caustics dance on
//     the riverbed and the wet stone.
//   - GHAT STONE: individual slabs (real grout gaps + height
//     jitter) with procedural PBR canvases — per-slab albedo
//     variation, roughness variation, bump; the waterline column
//     is a WET variant: darker, glossy, env-reflective, with an
//     algae waterline band on the quay face.
//   - GLASS BOWL: MeshPhysicalMaterial — clearcoat, roughness
//     0.05, envMap reflections from a PMREM environment built
//     from a painted sky scene; double-shell for thickness.
//   - CLAY LAMP: LatheGeometry diya with a procedural clay
//     texture — mottled terracotta, throwing rings, soot-darkened
//     rim baked at the wick band; glossy oil pool; a real
//     flickering PointLight + emissive flame body.
//  Characters stay the locked Salted Mine V3 cards (toon.js Pen),
//  post chain = the kit's ink + DOF + word captions, unchanged.
//  When the camera crosses the waterline the grade itself goes
//  underwater: fog closes in teal, gain shifts, motes drift.
import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, WATER_Y, BOARD_POS, fxProfileAt } from './story.js';
import { WORDS } from './words.js';
import { makeGrassField, makeTree, makeFlowers, leafClusterTexture } from './veg.js';

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
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// ---------- PMREM environment (painted sky scene) ----------
const DAY = { az: 205, el: 42, skyTop: '#2f6fc4', skyHor: '#8ec9ee', sunDisc: '#fff3cf' };
function skyMaterial(top, hor, sunDir, sunCol, sunSize) {
  return new THREE.ShaderMaterial({
    uniforms: { top: { value: new THREE.Color(top) }, hor: { value: new THREE.Color(hor) }, sunDir: { value: sunDir }, sunCol: { value: new THREE.Color(sunCol) }, sunSize: { value: sunSize }, aur: { value: 0 }, time: { value: 0 } },
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform vec3 top, hor, sunDir, sunCol; uniform float sunSize, aur, time; varying vec3 vP;
      void main(){ float h = clamp(vP.y,0.,1.); vec3 c = mix(hor, top, pow(h, .55)); if(vP.y<0.) c = hor*0.55;
        float s = dot(normalize(vP), normalize(sunDir)); c += sunCol * (smoothstep(1.-sunSize, 1.-sunSize*.6, s) + .35*pow(max(s,0.), 24.)*step(.001,sunSize));
        gl_FragColor = vec4(c,1.); }`,
  });
}
{
  const az = rx(DAY.az), el = rx(DAY.el);
  const sunDir = new THREE.Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
  const envScene = new THREE.Scene();
  const envSky = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), skyMaterial(DAY.skyTop, DAY.skyHor, sunDir, DAY.sunDisc, 0.010));
  envScene.add(envSky);
  const gnd = new THREE.Mesh(new THREE.CircleGeometry(48, 24), new THREE.MeshBasicMaterial({ color: 0x6b5a34 }));
  gnd.rotation.x = -Math.PI / 2; gnd.position.y = -2; envScene.add(gnd);
  const card = new THREE.Mesh(new THREE.PlaneGeometry(26, 9), new THREE.MeshBasicMaterial({ color: 0xfff6e0 }));
  card.position.set(-14, 10, -20); card.lookAt(0, 2, 0); envScene.add(card); // bright sky card -> long reflections in glass/wet stone
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(envScene, 0.04).texture;
  pmrem.dispose();
}

// ---------- sky dome (live, follows the grade) ----------
const skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunCol: { value: new THREE.Color() }, sunSize: { value: 0 }, aur: { value: 0 }, time: { value: 0 } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform vec3 top, hor, sunDir, sunCol; uniform float sunSize, aur, time; varying vec3 vP;
    float hash21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
    float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
      return mix(mix(hash21(i), hash21(i+vec2(1,0)), f.x), mix(hash21(i+vec2(0,1)), hash21(i+vec2(1,1)), f.x), f.y); }
    void main(){ float h = clamp(vP.y,0.,1.); vec3 c = mix(hor, top, pow(h, .55)); c = mix(c, hor, smoothstep(0.03, -0.10, vP.y));
      vec2 cuv = vP.xz / (0.30 + abs(vP.y));
      float cl = vnoise(cuv*2.1 + vec2(time*0.004, 0.)) * 0.62 + vnoise(cuv*5.3 - vec2(time*0.007, 0.3)) * 0.38;
      float cmask = smoothstep(0.60, 0.80, cl) * smoothstep(0.015, 0.16, vP.y) * 0.30;
      c = mix(c, vec3(1.03, 1.0, 0.95), cmask);
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

// ---------- procedural PBR canvases ----------
const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const lcg = (seed) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
function stoneCanvases(seed, wet) {
  const rnd = lcg(seed * 7919 + 13);
  const [ac, a] = mkCanvas(512, 512), [rc, r] = mkCanvas(512, 512), [bc, b] = mkCanvas(512, 512);
  const base = wet ? [146, 106, 64] : [178, 130, 76]; // v2.1: warm stone pushed deeper (LEARNED C4) — dry #b2824c S57, wet #926a40 S56 glossy
  a.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`; a.fillRect(0, 0, 512, 512);
  r.fillStyle = wet ? 'rgb(80,80,80)' : 'rgb(215,215,215)'; r.fillRect(0, 0, 512, 512);
  b.fillStyle = 'rgb(128,128,128)'; b.fillRect(0, 0, 512, 512);
  // large soft mottling (albedo + matching roughness drift)
  for (let i = 0; i < 90; i++) {
    const x = rnd() * 512, y = rnd() * 512, rad = 30 + rnd() * 130, dk = rnd() > 0.5;
    const gr = a.createRadialGradient(x, y, 1, x, y, rad);
    gr.addColorStop(0, dk ? 'rgba(74,50,26,0.28)' : 'rgba(255,226,170,0.20)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    a.fillStyle = gr; a.beginPath(); a.arc(x, y, rad, 0, 7); a.fill();
    const gr2 = r.createRadialGradient(x, y, 1, x, y, rad);
    const rv = wet ? (dk ? 120 : 45) : (dk ? 245 : 175);
    gr2.addColorStop(0, `rgba(${rv},${rv},${rv},0.5)`); gr2.addColorStop(1, 'rgba(0,0,0,0)');
    r.fillStyle = gr2; r.beginPath(); r.arc(x, y, rad, 0, 7); r.fill();
  }
  // fine grain speckle (albedo + bump)
  for (let i = 0; i < 9000; i++) {
    const x = rnd() * 512, y = rnd() * 512, v = rnd();
    a.fillStyle = v > 0.5 ? 'rgba(60,40,20,0.13)' : 'rgba(255,230,180,0.11)';
    a.fillRect(x, y, 1.6, 1.6);
    const bv = 108 + rnd() * 92 | 0;
    b.fillStyle = `rgb(${bv},${bv},${bv})`; b.fillRect(x, y, 2, 2);
  }
  // pits + hairline cracks
  for (let i = 0; i < 260; i++) {
    const x = rnd() * 512, y = rnd() * 512, rad = 1 + rnd() * 3.2;
    b.fillStyle = 'rgba(40,40,40,0.55)'; b.beginPath(); b.arc(x, y, rad, 0, 7); b.fill();
    a.fillStyle = 'rgba(66,44,22,0.20)'; a.beginPath(); a.arc(x, y, rad, 0, 7); a.fill();
  }
  a.strokeStyle = 'rgba(38,34,28,0.35)'; b.strokeStyle = 'rgba(30,30,30,0.6)';
  for (let i = 0; i < 5; i++) {
    let x = rnd() * 512, y = rnd() * 512; a.lineWidth = 1.1; b.lineWidth = 1.6;
    a.beginPath(); a.moveTo(x, y); b.beginPath(); b.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += (rnd() - 0.5) * 90; y += (rnd() - 0.5) * 90; a.lineTo(x, y); b.lineTo(x, y); }
    a.stroke(); b.stroke();
  }
  // worn edge highlight painted near borders (slab bevel feel)
  const eg = a.createLinearGradient(0, 0, 0, 512);
  eg.addColorStop(0, 'rgba(255,250,235,0.10)'); eg.addColorStop(0.06, 'rgba(0,0,0,0)'); eg.addColorStop(0.94, 'rgba(0,0,0,0)'); eg.addColorStop(1, 'rgba(20,16,10,0.16)');
  a.fillStyle = eg; a.fillRect(0, 0, 512, 512);
  const tx = (c, srgb) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; };
  return { map: tx(ac, true), rough: tx(rc, false), bump: tx(bc, false) };
}
function clayCanvases() {
  const rnd = lcg(4241);
  const [ac, a] = mkCanvas(512, 256), [rc, r] = mkCanvas(512, 256);
  a.fillStyle = '#a85f2e'; a.fillRect(0, 0, 512, 256);
  r.fillStyle = 'rgb(205,205,205)'; r.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 130; i++) { // mottled terracotta
    const x = rnd() * 512, y = rnd() * 256, rad = 12 + rnd() * 60;
    const gr = a.createRadialGradient(x, y, 1, x, y, rad);
    gr.addColorStop(0, rnd() > 0.5 ? 'rgba(196,122,61,0.28)' : 'rgba(110,58,24,0.26)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    a.fillStyle = gr; a.beginPath(); a.arc(x, y, rad, 0, 7); a.fill();
  }
  for (let i = 0; i < 5200; i++) { // clay grain
    a.fillStyle = rnd() > 0.5 ? 'rgba(60,30,12,0.14)' : 'rgba(255,205,150,0.10)';
    a.fillRect(rnd() * 512, rnd() * 256, 1.5, 1.5);
  }
  for (let y = 8; y < 256; y += 15) { // throwing rings
    a.fillStyle = 'rgba(70,38,16,0.13)'; a.fillRect(0, y, 512, 1.6);
    a.fillStyle = 'rgba(255,215,170,0.07)'; a.fillRect(0, y + 2, 512, 1.2);
  }
  // SOOT band: the lathe v runs along the profile — the rim/wick
  // zone sits around v 0.50-0.66 (canvas y ~92-128, v measured
  // from bottom of canvas in three's UV space).
  const soot = a.createLinearGradient(0, 78, 0, 140);
  soot.addColorStop(0, 'rgba(16,10,6,0)'); soot.addColorStop(0.35, 'rgba(16,10,6,0.88)');
  soot.addColorStop(0.62, 'rgba(16,10,6,0.88)'); soot.addColorStop(1, 'rgba(16,10,6,0)');
  a.fillStyle = soot; a.fillRect(0, 78, 512, 62);
  const sootR = r.createLinearGradient(0, 78, 0, 140);
  sootR.addColorStop(0, 'rgba(245,245,245,0)'); sootR.addColorStop(0.4, 'rgba(245,245,245,0.9)'); sootR.addColorStop(1, 'rgba(245,245,245,0)');
  r.fillStyle = sootR; r.fillRect(0, 78, 512, 62);
  const tx = (c, srgb) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 4; return t; };
  return { map: tx(ac, true), rough: tx(rc, false), bump: tx(ac, false) };
}

// ---------- materials ----------
const stoneMatsDry = [], stoneMatsWet = [];
for (let i = 0; i < 5; i++) {
  const s = stoneCanvases(11 + i * 3, false);
  stoneMatsDry.push(new THREE.MeshStandardMaterial({ map: s.map, roughnessMap: s.rough, bumpMap: s.bump, bumpScale: 0.6, roughness: 1, metalness: 0, envMapIntensity: 0.22 }));
}
for (let i = 0; i < 2; i++) {
  const s = stoneCanvases(23 + i * 5, true);
  stoneMatsWet.push(new THREE.MeshStandardMaterial({ map: s.map, roughnessMap: s.rough, bumpMap: s.bump, bumpScale: 0.4, roughness: 1, metalness: 0, envMapIntensity: 1.0 }));
}
const claySet = clayCanvases();
const clayMat = new THREE.MeshStandardMaterial({ map: claySet.map, roughnessMap: claySet.rough, bumpMap: claySet.bump, bumpScale: 0.35, roughness: 1, metalness: 0, envMapIntensity: 0.5 });
const darkBaseMat = new THREE.MeshStandardMaterial({ color: 0x3a2c1c, roughness: 1 });
const woodMat = new THREE.MeshStandardMaterial({ color: 0x6a4025, roughness: 0.85, envMapIntensity: 0.3 }); // LEARNED wood #6a4025 S62
const woodDkMat = new THREE.MeshStandardMaterial({ color: 0x54341e, roughness: 0.9, envMapIntensity: 0.25 });
const ironMat = new THREE.MeshStandardMaterial({ color: 0x2e2a26, roughness: 0.55, metalness: 0.6, envMapIntensity: 0.7 });
const reedMat = new THREE.MeshStandardMaterial({ color: 0x639347, roughness: 0.95 });
const reedDkMat = new THREE.MeshStandardMaterial({ color: 0x4c7834, roughness: 0.95 });
const hullRedMat = new THREE.MeshStandardMaterial({ color: 0x8a3b2e, roughness: 0.72, envMapIntensity: 0.4 });
const hullBlueMat = new THREE.MeshStandardMaterial({ color: 0x2f4d6e, roughness: 0.72, envMapIntensity: 0.4 });
const hullGreenMat = new THREE.MeshStandardMaterial({ color: 0x2e7d4f, roughness: 0.6, envMapIntensity: 0.4 });
const chalkMat = new THREE.MeshStandardMaterial({ color: 0xf4f1e6, roughness: 0.9 });
// ---------- v2 full-film helpers (ported from the original build) ----------
const glowTexA = P.tex(P.radial('255,205,130', 0.85));
const brassMat = new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 0.9, roughness: 0.3, envMapIntensity: 1.1 }); // LEARNED gold #caa84d family
const glassSimpleMat = new THREE.MeshPhysicalMaterial({ color: 0xf2fcff, roughness: 0.06, transparent: true, opacity: 0.3, clearcoat: 1, envMapIntensity: 1.4, side: THREE.DoubleSide, depthWrite: false });
const plasterCanvas = (seed, base) => {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  let sd = seed; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 260; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 12 + rnd() * 52;
    const gr = g.createRadialGradient(x, y, 1, x, y, r);
    gr.addColorStop(0, rnd() > 0.5 ? 'rgba(120,90,50,0.13)' : 'rgba(255,250,235,0.13)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(90,70,40,${0.04 + rnd() * 0.06})`; g.fillRect(rnd() * 512, rnd() * 512, 2.2, 2.2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
};
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
const grassCanvas = (seed) => {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  let sd = seed; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#5d7d3a'; g.fillRect(0, 0, 512, 512); // foliage family, S52 V49
  for (let i = 0; i < 380; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 8 + rnd() * 40;
    const gr = g.createRadialGradient(x, y, 1, x, y, r);
    gr.addColorStop(0, rnd() > 0.5 ? 'rgba(38,58,20,0.35)' : 'rgba(168,198,110,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.08 + rnd() * 0.1; g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 5200; i++) {
    g.strokeStyle = `rgba(${40 + rnd() * 60 | 0},${90 + rnd() * 60 | 0},${30 + rnd() * 30 | 0},${0.25 + rnd() * 0.3})`;
    g.lineWidth = 1.3;
    const x = rnd() * 512, y = rnd() * 512;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 3, y - 4 - rnd() * 5); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
};
const pageCanvas = () => {
  const c = document.createElement('canvas'); c.width = 512; c.height = 384;
  const g = c.getContext('2d');
  g.fillStyle = '#e9dcba'; g.fillRect(0, 0, 512, 384);
  g.fillStyle = '#d9c69c'; g.fillRect(248, 0, 16, 384);
  g.strokeStyle = 'rgba(70,50,30,0.55)'; g.lineWidth = 2;
  for (let p2 = 0; p2 < 2; p2++) {
    const x0 = p2 * 256 + 26;
    for (let r = 0; r < 9; r++) { g.beginPath(); g.moveTo(x0, 52 + r * 34); g.lineTo(x0 + 204, 52 + r * 34); g.stroke(); }
    for (let col = 0; col < 4; col++) { g.beginPath(); g.moveTo(x0 + col * 54, 40); g.lineTo(x0 + col * 54, 356); g.stroke(); }
  }
  g.fillStyle = '#b3392e'; g.beginPath(); g.arc(128, 200, 34, 0, 7); g.fill();
  g.strokeStyle = '#b3392e'; g.lineWidth = 5;
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; g.beginPath(); g.moveTo(128 + Math.cos(a) * 44, 200 + Math.sin(a) * 44); g.lineTo(128 + Math.cos(a) * 60, 200 + Math.sin(a) * 60); g.stroke(); }
  g.fillStyle = 'rgba(40,30,20,0.8)'; g.font = '900 30px Georgia, serif'; g.textAlign = 'center';
  g.fillText('ALMANAC', 384, 200);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
};
const grassTex = grassCanvas(191); grassTex.repeat.set(14, 14);
const grassMat = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 });
const thatchMat = new THREE.MeshStandardMaterial({ map: thatchCanvas(3), color: 0xc79a52, roughness: 1 });
const wallMatWarm = new THREE.MeshStandardMaterial({ map: plasterCanvas(23, '#cfa964'), roughness: 0.95 });
const wallMatVil = new THREE.MeshStandardMaterial({ map: plasterCanvas(29, '#c9a45e'), roughness: 0.95 });
const wallMatOffice = new THREE.MeshStandardMaterial({ map: plasterCanvas(37, '#d8c096'), roughness: 0.95 });
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

const bankMat = new THREE.MeshStandardMaterial({ color: 0x63913c, roughness: 1, emissive: 0x1c2f0e, emissiveIntensity: 0.65 }); // LEARNED foliage family, lifted so shade sides stay >= V35
const treeMat = new THREE.MeshStandardMaterial({ color: 0x7cab47, roughness: 1, emissive: 0x20360f, emissiveIntensity: 0.7 }); // foliage family + emissive floor (v3: unused — blob trees replaced by veg.js; kept defined, harmless)
const treeDkMat = new THREE.MeshStandardMaterial({ color: 0x5f8f3a, roughness: 1, emissive: 0x1a2c0c, emissiveIntensity: 0.7 });

// ---------- v3 VEGETATION (learned veg.js — no hand-made blob trees) ----------
// Registry: every veg object's vegUpdate(t) is driven from worldState()
// with t = f/30 — a pure function of frame number, so chunk renders
// stay seamless.
const VEG_UPDATERS = [];
const vegLeafTex = leafClusterTexture(); // one shared leaf-cluster texture for all veg trees
const vegifyTree = (tree, parent) => {
  // Leaf cards get an alpha-discarding ND material (the character-card
  // contract, cardNd): the ink pass then treats the canopy like a card
  // (no normal-edge speckle from the alpha quads) while depth still
  // registers for DOF. Bark tubes keep the plain ndMat.
  tree.traverse((o) => { if (o.isMesh && o.name === 'veg-canopy') o.userData.nd = cardNd(vegLeafTex); });
  parent.add(tree); VEG_UPDATERS.push(tree.userData.vegUpdate); return tree;
};
const vegGrassMeshes = [];
const addVegGrass = (mesh, parent) => {
  // Grass is hidden from the ND pass (ndSkip, like the water sheet):
  // DOF/ink read the ground behind the blades instead of a tuft blob.
  mesh.userData.ndSkip = true;
  parent.add(mesh); vegGrassMeshes.push(mesh); VEG_UPDATERS.push(mesh.userData.vegUpdate); return mesh;
};

// ---------- helpers ----------
const add = (geo, mat, x = 0, y = 0, z = 0, parent = scene, opts = {}) => {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = opts.cast ?? true; m.receiveShadow = true; parent.add(m); return m;
};
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const flat = (mesh) => { mesh.rotation.x = -Math.PI / 2; return mesh; };

// ---------- THE GHAT: individual PBR stone slabs ----------
// Quay top y=0, water WEST (surface y=WATER_Y), the action slab
// row runs z -1..9. Slabs are separate boxes: real grout gaps,
// millimetre height jitter, per-slab material variants. The
// column nearest the water is the WET variant (dark, glossy).
const world = new THREE.Group(); scene.add(world);
{
  const g = world;
  // dark grout base under the quay ONLY (a full-size sheet here
  // once stretched over the river and blacked out the descent)
  flat(add(new THREE.PlaneGeometry(9.5, 42), darkBaseMat, 0, -0.34, 0, g, { cast: false }));
  // slab field near the action
  const rndS = lcg(97);
  const cols = [-3.02, -1.82, -0.62, 0.58], rows = [];
  for (let z = -0.9; z <= 9.3; z += 1.2) rows.push(z);
  for (const cx of cols) for (const cz of rows) {
    const wet = cx < -2.4 || (cx < -1.2 && rndS() > 0.72);
    const mat = wet ? stoneMatsWet[(rndS() * stoneMatsWet.length) | 0] : stoneMatsDry[(rndS() * stoneMatsDry.length) | 0];
    const s = add(box(1.13, 0.3, 1.13), mat, cx, -0.15 + (rndS() - 0.5) * 0.008, cz, g, { cast: false });
    s.rotation.y = (rndS() - 0.5) * 0.01;
  }
  // the far quay continues as one textured slab plane (context)
  const far = add(box(7.2, 0.28, 30), stoneMatsDry[1], 0.1, -0.155, -14.5, g, { cast: false });
  const far2 = add(box(7.2, 0.28, 12), stoneMatsDry[2], 0.1, -0.155, 15.5, g, { cast: false });
  const east = add(box(26, 0.26, 44), grassMat, 16.5, -0.17, 0, g, { cast: false });
  // quay west face: wet stone down into the water + algae band.
  // West surface at x=-3.8 so the lowered bowl (centre -3.85,
  // r 0.46) hangs CLEAR of the wall; texture repeats along the
  // 40 m run instead of stretching one slab across it.
  {
    const src = stoneMatsWet[0];
    const rep = (t) => { const c = t.clone(); c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(3, 1); c.needsUpdate = true; return c; };
    const faceMat = new THREE.MeshStandardMaterial({ map: rep(src.map), roughnessMap: rep(src.roughnessMap), bumpMap: rep(src.bumpMap), bumpScale: src.bumpScale, roughness: 1, envMapIntensity: 1.1 });
    add(box(0.5, 2.0, 40), faceMat, -3.55, -1.0, 0, g, { cast: false });
  }
  const algae = add(box(0.1, 0.42, 40), new THREE.MeshStandardMaterial({ color: 0x2a5c26, roughness: 0.18, envMapIntensity: 0.5 }), -3.81, -0.78, 0, g, { cast: false });
  // THE ghat slab the lamp stands on (hero stone, proud of the quay)
  add(box(1.5, 0.16, 1.5), stoneMatsDry[3], -2.55, 0.08, 3.9, g, { cast: false });
  add(box(1.42, 0.035, 1.42), stoneMatsDry[0], -2.55, 0.175, 3.9, g, { cast: false });
  // bollards
  for (const bz of [6, -0.5, -7]) {
    add(new THREE.CylinderGeometry(0.11, 0.13, 0.6, 12), ironMat, -2.95, 0.3, bz, g, { cast: false });
    add(new THREE.TorusGeometry(0.115, 0.028, 8, 18), ironMat, -2.95, 0.52, bz, g, { cast: false }).rotation.x = Math.PI / 2;
  }
  // a crate + barrel for quay dressing (clear of the actors)
  add(box(0.9, 0.9, 0.9), woodMat, 2.6, 0.45, 7.6, g, { cast: false }).rotation.y = 0.3;
  add(new THREE.CylinderGeometry(0.33, 0.33, 0.92, 14), woodDkMat, -3.0, 0.46, 8.9, g, { cast: false });
  // reed tufts at the water edge, south of the action
  window.__reeds = [];
  for (let i = 0; i < 6; i++) {
    const tuft = new THREE.Group(); tuft.position.set(-3.55 + (rndS() - 0.5) * 0.2, -0.5, 6.8 + i * 0.85); g.add(tuft);
    for (let k = 0; k < 5; k++) {
      const blade = add(new THREE.ConeGeometry(0.04, 0.9 + rndS() * 0.6, 5), k % 2 ? reedMat : reedDkMat, (rndS() - 0.5) * 0.34, 0.42, (rndS() - 0.5) * 0.34, tuft, { cast: false });
      blade.rotation.z = (rndS() - 0.5) * 0.26; blade.rotation.x = (rndS() - 0.5) * 0.2;
    }
    window.__reeds.push({ g: tuft, ph: rndS() * 6.28 });
  }
  // far bank across the river: a tree-lined silhouette strip the
  // reflection can pick up
  add(box(2.5, 1.1, 90), bankMat, -38, -0.6, 0, g, { cast: false });
  const rndT = lcg(1234);
  const farTypes = ['round', 'tall', 'round', 'bush'];
  for (let i = 0; i < 16; i++) {
    const tz = -40 + i * 5.2 + rndT() * 2, ts = 1.6 + rndT() * 1.6;
    const tx = -38 + (rndT() - 0.5) * 2; // same lcg draw order as the v2 blob loop — positions/scales unchanged
    // v3: recursive-branch tree with leaf-card canopy (was: sphere blob + stick)
    const tree = makeTree({ type: farTypes[i % 4], height: 1.15 + 1.25 * ts, seed: 100 + i, leafTex: vegLeafTex });
    tree.position.set(tx, -0.02, tz);
    vegifyTree(tree, g);
  }
}

// ---------- v2 FULL-FILM SET: cottages, office, board, gulls, clouds ----------
const windowGlows = [], windowPanes = [];
const buildCottage2 = ({ x, z, w, d, h = 3.0, wallMat, winZ = null }) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
  add(box(w, h, d), wallMat, w / 2, h / 2, d / 2, g, { cast: false });
  const r1 = add(box(w + 0.7, 0.12, d / 2 + 0.55), thatchMat, w / 2, h + 0.62, d / 4 - 0.1, g, { cast: false }); r1.rotation.x = 0.62;
  const r2 = add(box(w + 0.7, 0.12, d / 2 + 0.55), thatchMat, w / 2, h + 0.62, d * 0.75 + 0.1, g, { cast: false }); r2.rotation.x = -0.62;
  add(box(w + 0.8, 0.14, 0.3), woodDkMat, w / 2, h + 1.18, d / 2, g, { cast: false });
  add(box(0.07, 2.05, 0.95), woodDkMat, -0.02, 1.02, d * 0.22, g, { cast: false });
  add(new THREE.SphereGeometry(0.045, 8, 6), brassMat, -0.08, 1.02, d * 0.22 + 0.32, g, { cast: false });
  const wz = winZ !== null ? winZ : d / 2;
  add(box(0.09, 1.5, 1.14), woodDkMat, -0.02, 1.55, wz, g, { cast: false });
  const pane = add(new THREE.PlaneGeometry(0.94, 1.3), new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.3, fog: true }), -0.075, 1.55, wz, g, { cast: false });
  pane.rotation.y = -Math.PI / 2; pane.userData.ndSkip = true; windowPanes.push(pane);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexA, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  spr.position.set(x - 0.25, 1.55, z + wz); spr.scale.set(1.7, 1.7, 1); spr.userData.ndSkip = true; spr.renderOrder = 3; world.add(spr);
  windowGlows.push(spr);
  add(box(0.55, 1.5, 0.55), stoneMatsWet[0], w * 0.62, h + 0.55, d * 0.68, g, { cast: false });
  return g;
};
buildCottage2({ x: 4.6, z: 6.9, w: 4.2, d: 5.2, wallMat: wallMatWarm, winZ: 2.6 });
buildCottage2({ x: 5.4, z: 1.9, w: 5.0, d: 4.6, wallMat: wallMatVil, winZ: 2.3 });
buildCottage2({ x: 5.6, z: -1.2, w: 5.4, d: 3.0, wallMat: wallMatVil, winZ: 1.5 });
// east trees behind the cottages — v3: veg recursive-branch trees at
// the same positions/scales (was: trunk cylinder + 4 sphere blobs each)
const eastTypes = ['round', 'tall', 'round', 'tall'];
[[13.5, 13.5, 1.1], [14.5, 3.5, 0.95], [13.8, -9.5, 1.05], [16, -3, 0.85]].forEach(([tx2, tz2, ts2], i) => {
  const tree = makeTree({ type: eastTypes[i], height: 6.2 * ts2, seed: 201 + i, leafTex: vegLeafTex });
  tree.position.set(tx2, -0.02, tz2);
  vegifyTree(tree, world);
});
// v3 bushes beside the cottages/office (where the painted greenery sat)
for (const [bx, bz, bh, bsd] of [[9.9, 10.2, 1.9, 301], [12.3, 4.6, 1.7, 302], [12.6, -4.4, 2.0, 303], [7.2, 14.6, 1.6, 304]]) {
  const bush = makeTree({ type: 'bush', height: bh, seed: bsd, leafTex: vegLeafTex });
  bush.position.set(bx, -0.04, bz);
  vegifyTree(bush, world);
}
// v3 flower patches on the east ground (saturated accents only)
{
  const vegFlowers = makeFlowers({ patches: [[6.8, 14.8], [13.2, 8.6], [11.8, -8.6], [15.5, 1.5]], perPatch: 22, seed: 401 });
  vegFlowers.traverse((o) => { if (o.isMesh) o.userData.ndSkip = true; });
  world.add(vegFlowers);
}
// v3 grass — instanced wind-blown tufts (makeGrassField). NOTE: the
// veg grass shader builds world position from the aOffset attribute
// ALONE (projection * view * world) — the mesh transform is ignored,
// so each field's origin is BAKED into its aOffsets and keep() always
// works in field-local coords.
const bakeGrassOrigin = (mesh, ox, oy, oz) => {
  const a = mesh.geometry.getAttribute('aOffset');
  for (let i = 0; i < a.count; i++) a.setXYZ(i, a.getX(i) + ox, a.getY(i) + oy, a.getZ(i) + oz);
  a.needsUpdate = true;
  return mesh;
};
{
  // east open ground: keep() in world coords (field origin = world
  // origin). Excludes the quay/water (x < 3.75), the far edges, and
  // every building footprint + margin. Actors never enter this
  // ground (castAt x <= 1.3 across all 1800 frames).
  const footprints = [[4.6, 8.8, 6.9, 12.1], [5.4, 10.4, 1.9, 6.5], [5.6, 11.0, -1.2, 1.8], [4.6, 11.5, -7.6, -1.6]];
  const inFoot = (x, z, m) => footprints.some(([x0, x1, z0, z1]) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m);
  const eastGrass = makeGrassField({ count: 7000, area: 64, height: 0.6, seed: 501, windStrength: 0.34,
    keep: (x, z) => x > 3.75 && x < 29.3 && Math.abs(z) < 21.8 && !inFoot(x, z, 0.55) });
  addVegGrass(bakeGrassOrigin(eastGrass, 0, -0.03, 0), world);
  // far-bank water edge: a reed-like tuft line along the tree strip
  for (const fz of [-28, 0, 28]) {
    const fg = makeGrassField({ count: 700, area: 30, height: 0.78, seed: 510 + fz, windStrength: 0.3,
      keep: (x, z) => Math.abs(x) < 1.15 && Math.abs(z) < 14.5 });
    addVegGrass(bakeGrassOrigin(fg, -37.9, -0.03, fz), world);
  }
  // quay water edge: taller tufts rooted below the waterline, clear
  // of the action (reeds already dress z 6.8..11; these take the
  // stretches beyond, south z 10..19 and north z -20..-11)
  for (const [wz, wsd] of [[14.5, 601], [-15.5, 602]]) {
    const wg = makeGrassField({ count: 260, area: 10, height: 0.95, seed: wsd, windStrength: 0.42,
      keep: (x, z) => Math.abs(x) < 0.55 && Math.abs(z) < 4.5 });
    addVegGrass(bakeGrassOrigin(wg, -4.05, WATER_Y - 0.30, wz), world);
  }
}
// the harbour office + the almanac lectern
{
  const g = world;
  add(box(6.9, 3.4, 6.0), wallMatOffice, 8.05, 1.7, -4.6, g, { cast: false });
  const r1 = add(box(7.6, 0.12, 3.6), thatchMat, 8.05, 3.95, -6.05, g, { cast: false }); r1.rotation.x = 0.6;
  const r2 = add(box(7.6, 0.12, 3.6), thatchMat, 8.05, 3.95, -3.15, g, { cast: false }); r2.rotation.x = -0.6;
  add(box(0.07, 2.2, 1.0), woodDkMat, 4.58, 1.1, -4.6, g, { cast: false });
  add(box(0.09, 1.3, 1.0), woodDkMat, 4.58, 1.85, -2.9, g, { cast: false });
  const pane = add(new THREE.PlaneGeometry(0.84, 1.14), new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.3, fog: true }), 4.52, 1.85, -2.9, g, { cast: false });
  pane.rotation.y = -Math.PI / 2; pane.userData.ndSkip = true; windowPanes.push(pane);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexA, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  spr.position.set(4.35, 1.85, -2.9); spr.scale.set(1.5, 1.5, 1); spr.userData.ndSkip = true; spr.renderOrder = 3; g.add(spr);
  windowGlows.push(spr);
  const lg = new THREE.Group(); lg.position.set(2.55, 0, -3.3); lg.rotation.y = 0.35; g.add(lg);
  add(box(0.12, 1.02, 0.12), woodDkMat, 0, 0.51, 0, lg, { cast: false });
  add(box(0.7, 0.05, 0.55), woodMat, 0, 1.0, 0, lg, { cast: false });
  const book = new THREE.Group(); book.position.set(0, 1.06, 0); book.rotation.z = -0.38; lg.add(book);
  add(box(0.66, 0.07, 0.5), hullRedMat, 0, 0, 0, book, { cast: false });
  const pages = add(new THREE.PlaneGeometry(0.6, 0.44), new THREE.MeshBasicMaterial({ map: pageCanvas(), fog: true }), 0, 0.045, 0, book, { cast: false });
  pages.rotation.x = -Math.PI / 2; pages.userData.ndSkip = true;
}
// the hook board (transform mirrored in boards.json — keep in sync)
const boardHook = textBoard(['But tomorrow\u2026', 'the boy who boiled water', 'in a paper cup?'], 3.9, 1.75, '#4a2c10', '#ffe9a8', 900);
boardHook.position.set(...BOARD_POS); world.add(boardHook); addBoardOccluder(boardHook, 3.9, 1.75, 'hookK');
add(box(0.09, 2.6, 0.09), woodDkMat, -0.75, 1.0, -12.9, world, { cast: false });
add(box(0.09, 2.6, 0.09), woodDkMat, 1.15, 1.0, -12.9, world, { cast: false });
// the insert's small things on the slab beside the lamp
const spoon = add(new THREE.SphereGeometry(0.055, 8, 6), brassMat, -2.12, 0.19, 4.32, world, { cast: false }); spoon.scale.set(1, 0.35, 1.5);
add(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 8), brassMat, -2.06, 0.19, 4.44, world, { cast: false }).rotation.z = Math.PI / 2;
const wickRoll = add(new THREE.CylinderGeometry(0.045, 0.045, 0.07, 10), chalkMat, -2.86, 0.2, 4.35, world, { cast: false }); wickRoll.rotation.x = 0.4;
// drifting cloud puffs (the sky shader carries its own layer too)
const cloudSprites = [];
{
  const rndC = lcg(777);
  for (let i = 0; i < 7; i++) {
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexA, color: 0xffffff, transparent: true, opacity: 0.08 + rndC() * 0.08, depthWrite: false, fog: false }));
    spr.position.set(-34 + rndC() * 58, 24 + rndC() * 18, -26 + rndC() * 40);
    spr.scale.set(16 + rndC() * 14, 5 + rndC() * 3.5, 1);
    spr.userData.ndSkip = true; scene.add(spr);
    cloudSprites.push({ spr, sp: 0.05 + rndC() * 0.08 });
  }
}
// the gulls: one inland stream on gullK
const gulls = [];
{
  const gullMat = new THREE.MeshStandardMaterial({ color: 0xf2f5f2, roughness: 0.9 });
  const gullDk = new THREE.MeshStandardMaterial({ color: 0x9aa5a8, roughness: 0.9, side: THREE.DoubleSide });
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group(); scene.add(g);
    const body = add(new THREE.SphereGeometry(0.16, 8, 6), gullMat, 0, 0, 0, g, { cast: false }); body.scale.set(1.9, 0.8, 0.85);
    add(new THREE.SphereGeometry(0.09, 8, 6), gullMat, 0.3, 0.05, 0, g, { cast: false });
    const beak = add(new THREE.ConeGeometry(0.035, 0.16, 6), brassMat, 0.44, 0.04, 0, g, { cast: false }); beak.rotation.z = -Math.PI / 2;
    const wL = new THREE.Group(); wL.position.set(-0.05, 0.06, 0.1); g.add(wL);
    const wR = new THREE.Group(); wR.position.set(-0.05, 0.06, -0.1); g.add(wR);
    const pL = add(new THREE.PlaneGeometry(0.55, 0.95), gullDk, -0.05, 0, 0.48, wL, { cast: false }); pL.rotation.x = -Math.PI / 2;
    const pR = add(new THREE.PlaneGeometry(0.55, 0.95), gullDk, -0.05, 0, -0.48, wR, { cast: false }); pR.rotation.x = -Math.PI / 2;
    pL.userData.ndSkip = true; pR.userData.ndSkip = true;
    g.visible = false;
    gulls.push({ g, wL, wR, i });
  }
}
// the coin glint at the payoff (driven by fxProfileAt sparkRate)
const coinGlint = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexA, color: 0xffe9a8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
coinGlint.position.set(-0.72, 1.02, 3.95); coinGlint.scale.set(0.95, 0.95, 1); coinGlint.userData.ndSkip = true; coinGlint.renderOrder = 3; scene.add(coinGlint);
const boatLampGlows = [];

// ---------- boats (bob on the same wave the eye reads) ----------
const waveH = (x, z, t, amp) => (Math.sin(x * 0.11 + t * 1.15) * 0.45 + Math.sin(z * 0.16 - t * 0.85) * 0.32 + Math.sin((x + z) * 0.055 + t * 0.5) * 0.55) * amp;
const buildBoat = (hullMat) => {
  const g = new THREE.Group(); scene.add(g);
  add(box(1.5, 0.52, 3.9), hullMat, 0, 0.1, 0, g, { cast: true });
  const bow = add(new THREE.CylinderGeometry(0.02, 0.75, 1.1, 4, 1), hullMat, 0, 0.12, -2.35, g, { cast: false });
  bow.rotation.x = Math.PI / 2; bow.rotation.y = Math.PI / 4; bow.scale.set(1, 1, 0.62);
  add(box(1.62, 0.09, 4.0), woodDkMat, 0, 0.4, 0, g, { cast: false });
  add(box(1.3, 0.07, 0.3), woodMat, 0, 0.32, -1.1, g, { cast: false });
  add(box(1.3, 0.07, 0.3), woodMat, 0, 0.32, 0.9, g, { cast: false });
  add(new THREE.CylinderGeometry(0.05, 0.07, 2.6, 8), woodMat, 0, 1.6, -0.4, g, { cast: false });
  const sail = add(new THREE.ConeGeometry(0.3, 1.9, 7), chalkMat, 0.12, 1.35, -0.4, g, { cast: false }); sail.scale.set(0.55, 1, 1);
  const netB = add(new THREE.SphereGeometry(0.42, 8, 6), reedDkMat, -0.3, 0.5, 1.35, g, { cast: false }); netB.scale.set(1, 0.6, 1);
  add(box(0.55, 0.4, 0.55), woodMat, 0.35, 0.55, 1.5, g, { cast: false });
  // the evening passenger: a little lamp under a small glass bowl
  add(new THREE.CylinderGeometry(0.09, 0.06, 0.05, 10), clayMat, 0.25, 0.42, 0.9, g, { cast: false });
  const bdome = add(new THREE.SphereGeometry(0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), glassSimpleMat, 0.25, 0.44, 0.9, g, { cast: false });
  bdome.userData.ndSkip = true;
  const bglow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexA, color: 0xffb45e, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  bglow.position.set(0.25, 0.55, 0.9); bglow.scale.set(0.65, 0.65, 1); bglow.userData.ndSkip = true; bglow.renderOrder = 3; g.add(bglow);
  boatLampGlows.push(bglow);
  return g;
};
const boats = [
  { g: buildBoat(hullRedMat), x: -6.8, z: 6.4, bollard: [-2.95, 0.62, 6] },
  { g: buildBoat(hullBlueMat), x: -5.6, z: 0.6, bollard: [-2.95, 0.62, -0.5] },
  { g: buildBoat(hullGreenMat), x: -6.8, z: -6.4, bollard: [-2.95, 0.62, -7] },
];
const boatRopes = boats.map(() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 1, 6), woodDkMat); m.castShadow = false; scene.add(m); return m; });
const setBeam = (mesh, a, b) => { const d = new THREE.Vector3().subVectors(b, a); const len = Math.max(d.length(), 0.001); mesh.position.copy(a).addScaledVector(d, 0.5); mesh.scale.set(1, len, 1); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); };

// ---------- WATER: true planar reflection + animated normals ----------
const reflRT = new THREE.WebGLRenderTarget(512, 1024); // plain byte RT (the Reflector's own choice) — HalfFloat+no-MSAA reads back black on SwiftShader
const waterUniforms = {
  uRefl: { value: reflRT.texture },
  uTexMatrix: { value: new THREE.Matrix4() },
  uTexMatrixW: { value: new THREE.Matrix4() },
  uTime: { value: 0 },
  uDeep: { value: new THREE.Color('#14506e') },
  uShallow: { value: new THREE.Color('#3d9db4') },
  uSky: { value: new THREE.Color('#bfe0ea') },
  uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.45) },
  uSunCol: { value: new THREE.Color('#ffe9b0') },
  uFogColor: { value: new THREE.Color('#c3d5dd') },
  uFogNear: { value: 55 }, uFogFar: { value: 230 },
  uWaterY: { value: WATER_Y },
};
const waterMat = new THREE.ShaderMaterial({
  uniforms: waterUniforms, side: THREE.DoubleSide, fog: false, transparent: true, depthWrite: false,
  vertexShader: `
    uniform mat4 uTexMatrix; uniform float uTime;
    varying vec4 vRefl; varying vec3 vWp;
    void main(){
      vec4 wp = modelMatrix * vec4(position, 1.0);
      wp.y += sin(wp.x * 0.11 + uTime * 1.15) * 0.45 * 0.05 + sin(wp.z * 0.16 - uTime * 0.85) * 0.32 * 0.05;
      vWp = wp.xyz;
      vRefl = uTexMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`,
  fragmentShader: `
    uniform sampler2D uRefl; uniform mat4 uTexMatrixW; uniform float uTime, uFogNear, uFogFar, uWaterY;
    uniform vec3 uDeep, uShallow, uSky, uSunDir, uSunCol, uFogColor;
    varying vec4 vRefl; varying vec3 vWp;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
      return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
    float wheight(vec2 p, float t){
      return noise(p*1.4 + t*0.55) * 0.62 + noise(p*3.9 - t*0.85) * 0.38;
    }
    vec3 wnormal(vec2 p, float t){
      float e = 0.35;
      float h0 = wheight(p, t);
      float hx = wheight(p + vec2(e, 0.), t);
      float hz = wheight(p + vec2(0., e), t);
      return normalize(vec3(-(hx-h0)/e * 0.14, 1.0, -(hz-h0)/e * 0.14));
    }
    void main(){
      vec3 V = normalize(cameraPosition - vWp);
      float t = uTime;
      bool below = cameraPosition.y < uWaterY;
      vec3 n = wnormal(vWp.xz, t);
      if (!gl_FrontFacing) n = -n;
      float graz = pow(1.0 - max(dot(V, vec3(0.,1.,0.)), 0.0), 3.0);
      vec2 duv = n.xz * (below ? 0.05 : 0.11 + 0.30 * graz);
      vec4 rp = uTexMatrixW * vec4(vWp, 1.0);
      vec2 puv = rp.xy / max(rp.w, 0.001) + duv;
      vec3 refl = mix(texture2D(uRefl, puv).rgb, uSky * 0.8, 0.08);
      refl = mix(refl, uShallow, 0.52); // tint the mirror hard with the saturated shallow body so sky glare can't wash it grey
      float fres = 0.03 + 0.36 * graz;
      float waveK = 0.5 + 0.5 * sin(vWp.x * 0.11 + t * 1.15) * sin(vWp.z * 0.16 - t * 0.85);
      vec3 base = mix(uDeep, uShallow, clamp(waveK * 0.7 + 0.12, 0., 1.));
      vec3 col;
      if (!below) {
        col = mix(base, refl, clamp(fres, 0., 1.));
        vec3 R = reflect(-normalize(uSunDir), n);
        float spec = pow(max(dot(R, V), 0.0), 260.0) * 2.4 + pow(max(dot(R, V), 0.0), 48.0) * 0.30;
        float sparkle = step(0.992, hash(floor(vWp.xz * 9.0) + floor(t * 3.0))) * 0.7;
        col += (spec + sparkle * max(dot(R, V), 0.0)) * uSunCol;
        float foamBand = smoothstep(0.55, 0.12, abs(vWp.x + 3.82)) * (0.45 + 0.55 * noise(vWp.xz * 6.0 + t * 0.7));
        col = mix(col, vec3(0.93, 0.97, 0.98), foamBand * 0.35);
      } else {
        // from below: teal volume + the world above shining
        // through a Snell-like window (brightest overhead)
        float snell = pow(abs(V.y), 2.0);
        vec3 uwBase = mix(uDeep, uShallow, 0.48); // finisher trim: lifts the underwater sheet body so its edge against the bright Snell/dome zone lands under the banding gate
        refl = mix(refl, uwBase, 0.45); // finisher fix: compress the reflection's contrast from below — its hard horizon line was printing through as a strata band
        col = mix(uwBase, refl, 0.06 + 0.15 * snell);
        col += uSunCol * snell * 0.05; // finisher trim: softens the Snell glow edge against the teal band (banding)
      }
      float dist = length(cameraPosition - vWp);
      if (!below) col = mix(col, uDeep * 1.25, smoothstep(6.0, 26.0, dist) * 0.34); // deepen far water so a bright bank reflection can't wash the whole frame cream
      col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, dist));
      // translucent sheet from below: a submerged camera still sees the flame in its air pocket through the surface.
      // Finisher fix 2026-11-22: at grazing view angles (the horizon band) the sheet thins out,
      // so the waterline/Snell edge lands as a gradient instead of a hard luminance step (banding).
      float alpha = 0.97;
      if (below) { float grazUw = pow(1.0 - abs(V.y), 2.0); alpha = mix(0.55, 0.28, grazUw); }
      gl_FragColor = vec4(col, alpha);
    }`,
});
if ((window.location.hash || '').includes('xuv')) {
  waterMat.fragmentShader = `
    varying vec4 vRefl; varying vec3 vWp;
    void main(){
      vec2 puv = vRefl.xy / max(vRefl.w, 0.001);
      gl_FragColor = vec4(puv.x, puv.y, vRefl.w < 0.0 ? 1.0 : 0.0, 1.0);
    }`;
  waterMat.needsUpdate = true;
}
const waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), waterMat);
waterMesh.rotation.x = -Math.PI / 2; waterMesh.position.set(-40, WATER_Y, 0);
waterMesh.userData.ndSkip = true; waterMesh.renderOrder = 2; scene.add(waterMesh);
// deep base far below (never a void at the edges)
flat(add(new THREE.PlaneGeometry(160, 160), new THREE.MeshBasicMaterial({ color: 0x113028, fog: true }), -40, -2.6, 0, scene, { cast: false })).userData.ndSkip = true;
// textured riverbed: saturated teal-sand with speckle + soft patches
// (a flat dark plane + straight slab edges were the banding source)
{
  const [bc2, bg2] = mkCanvas(512, 512);
  const rndBed = lcg(31);
  bg2.fillStyle = '#2e6b5e'; bg2.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 240; i++) {
    const x = rndBed() * 512, y = rndBed() * 512, r = 8 + rndBed() * 44;
    const gr = bg2.createRadialGradient(x, y, 1, x, y, r);
    gr.addColorStop(0, rndBed() > 0.5 ? 'rgba(20,52,44,0.25)' : 'rgba(122,160,110,0.20)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    bg2.fillStyle = gr; bg2.beginPath(); bg2.arc(x, y, r, 0, 7); bg2.fill();
  }
  for (let i = 0; i < 7000; i++) { bg2.fillStyle = rndBed() > 0.5 ? 'rgba(16,40,34,0.16)' : 'rgba(190,200,150,0.10)'; bg2.fillRect(rndBed() * 512, rndBed() * 512, 1.7, 1.7); }
  const bedTex = new THREE.CanvasTexture(bc2); bedTex.colorSpace = THREE.SRGBColorSpace; bedTex.wrapS = bedTex.wrapT = THREE.RepeatWrapping; bedTex.repeat.set(6, 6); bedTex.anisotropy = 4;
  const bed = new THREE.Mesh(new THREE.PlaneGeometry(46, 46), new THREE.MeshStandardMaterial({ map: bedTex, roughness: 1 }));
  bed.rotation.x = -Math.PI / 2; bed.position.set(-24, -1.78, 2); bed.receiveShadow = true; scene.add(bed);
  const rndSt = lcg(87);
  for (let i = 0; i < 26; i++) {
    const st = add(new THREE.SphereGeometry(0.09 + rndSt() * 0.22, 7, 5), rndSt() > 0.4 ? stoneMatsWet[1] : woodDkMat, -9.5 + rndSt() * 9, -1.7, -2 + rndSt() * 11, scene, { cast: false });
    st.scale.set(1, 0.55, 1);
  }
  for (let i = 0; i < 7; i++) { // drowned reed clumps break the bed's lines
    const tuft = new THREE.Group(); tuft.position.set(-6.5 + rndSt() * 4.5, -1.78, 0.5 + rndSt() * 7); scene.add(tuft);
    for (let k = 0; k < 4; k++) {
      const blade = add(new THREE.ConeGeometry(0.035, 0.7 + rndSt() * 0.5, 5), k % 2 ? reedMat : reedDkMat, (rndSt() - 0.5) * 0.3, 0.35, (rndSt() - 0.5) * 0.3, tuft, { cast: false });
      blade.rotation.z = (rndSt() - 0.5) * 0.3;
    }
  }
}
// god-ray shafts: soft additive wedges slanting from the surface
const shaftTex = (() => {
  const [c, g] = mkCanvas(64, 256);
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, 'rgba(255,244,205,0.9)'); gr.addColorStop(1, 'rgba(255,244,205,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
  g.globalCompositeOperation = 'destination-in';
  const gr2 = g.createLinearGradient(0, 0, 64, 0);
  gr2.addColorStop(0, 'rgba(0,0,0,0)'); gr2.addColorStop(0.5, 'rgba(0,0,0,1)'); gr2.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr2; g.fillRect(0, 0, 64, 256);
  return new THREE.CanvasTexture(c);
})();
const shafts = [];
for (let i = 0; i < 3; i++) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9 + i * 0.35, 2.8), new THREE.MeshBasicMaterial({ map: shaftTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  m.position.set(-4.6 + i * 0.85, -1.8, 3.55 + i * 0.4); m.rotation.z = 0.42; m.userData.ndSkip = true; m.renderOrder = 2; scene.add(m); shafts.push(m);
}
// ---------- caustics on the riverbed ----------
const causticUniforms = { uTime: { value: 0 }, uCol: { value: new THREE.Color('#ffe9b0') }, uK: { value: 0.2 } };
const causticMat = new THREE.ShaderMaterial({
  uniforms: causticUniforms, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `
    uniform float uTime, uK; uniform vec3 uCol; varying vec2 vP;
    float caust(vec2 p, float t){
      vec2 i = p; float c = 1.0; float inten = 0.005;
      for (int n = 0; n < 3; n++) {
        float tt = t * (1.0 - (3.5 / float(n + 1)));
        i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
        c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
      }
      c /= 3.0; c = 1.17 - pow(c, 1.4); return min(pow(abs(c), 8.0), 1.8); // capped: at this UV scale the raw pattern explodes to INF in the HalfFloat pass -> NaN -> black wedges
    }
    void main(){
      float c = caust(vP * 0.85, uTime * 0.6);
      gl_FragColor = vec4(uCol * c * uK, 1.0);
    }`,
});
const causticBed = new THREE.Mesh(new THREE.PlaneGeometry(46, 46), causticMat);
causticBed.rotation.x = -Math.PI / 2; causticBed.position.set(-24, -1.72, 2);
causticBed.userData.ndSkip = true; causticBed.renderOrder = 1; scene.add(causticBed);
const causticSlab = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), causticMat.clone());
causticSlab.material.uniforms.uTime = causticUniforms.uTime;
causticSlab.material.uniforms.uK.value = 0.16;
causticSlab.rotation.x = -Math.PI / 2; causticSlab.position.set(-3.0, 0.012, 3.9);
causticSlab.userData.ndSkip = true; causticSlab.renderOrder = 1; scene.add(causticSlab);

// ---------- reflection machinery (mirrored camera + clip) ----------
const virtualCamera = new THREE.PerspectiveCamera();
const clipAbove = new THREE.Plane(new THREE.Vector3(0, -1, 0), WATER_Y); // negated: the mirrored view transform flips the plane — as first written it clipped the whole above-water world out of the reflection
const _rwPos = new THREE.Vector3(), _camPos = new THREE.Vector3(), _rot = new THREE.Matrix4(),
  _look = new THREE.Vector3(), _view = new THREE.Vector3(), _target = new THREE.Vector3();
function renderReflection() {
  _rwPos.set(0, WATER_Y, 0);
  _camPos.setFromMatrixPosition(camera.matrixWorld);
  _view.subVectors(_rwPos, _camPos);
  _view.reflect(new THREE.Vector3(0, 1, 0)).negate();
  _view.add(_rwPos);
  _rot.extractRotation(camera.matrixWorld);
  _look.set(0, 0, -1).applyMatrix4(_rot).add(_camPos);
  _target.subVectors(_rwPos, _look);
  _target.reflect(new THREE.Vector3(0, 1, 0)).negate();
  _target.add(_rwPos);
  virtualCamera.position.copy(_view);
  virtualCamera.up.set(0, 1, 0).applyMatrix4(_rot).reflect(new THREE.Vector3(0, 1, 0));
  virtualCamera.lookAt(_target);
  virtualCamera.fov = camera.fov; virtualCamera.aspect = camera.aspect;
  virtualCamera.near = camera.near; virtualCamera.far = camera.far;
  virtualCamera.updateProjectionMatrix(); virtualCamera.updateMatrixWorld();
  const tm = waterUniforms.uTexMatrix.value;
  tm.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  tm.multiply(virtualCamera.projectionMatrix);
  tm.multiply(virtualCamera.matrixWorldInverse);
  waterUniforms.uTexMatrixW.value.copy(tm); // world-space version (no model matrix) for per-fragment reprojection
  tm.multiply(waterMesh.matrixWorld);
  waterMesh.visible = false;
  causticBed.visible = false; causticSlab.visible = false;
  const prevRT = renderer.getRenderTarget();
  renderer.clippingPlanes = [clipAbove];
  renderer.setRenderTarget(reflRT);
  renderer.setClearColor(0x0a1a24, 1); renderer.clear();
  renderer.render(scene, virtualCamera);
  renderer.clippingPlanes = [];
  renderer.setRenderTarget(prevRT);
  waterMesh.visible = true;
  causticBed.visible = true; causticSlab.visible = true;
}

// ---------- THE LAMP + BOWL RIG ----------
// Clay diya on a lathe profile; oil pool like a dark mirror;
// cotton wick; the flame = emissive teardrop body + core/halo
// sprites + a real flickering PointLight. The bowl = physical
// glass, double shell, with the trapped-air surface disc inside.
const lampGroup = new THREE.Group(); scene.add(lampGroup);
const bowlGroup = new THREE.Group(); scene.add(bowlGroup);
let flameCore, flameHalo, flameLight, flameBody, flameInner, flameCoreMesh, bandMesh;
const bubblePool = [];
const rippleRings = [];
const glowTexW = P.tex(P.radial('255,205,130', 0.85));
{
  // KATORA (MATERIAL STANDARD): a real clay bowl — foot, swelling
  // belly, THICK rim, inner wall down to an inner floor — so the
  // side angle reads bowl, never a flat disc.
  const profileRaw = [
    [0.0, 0.0], [0.10, 0.0], [0.165, 0.014], [0.198, 0.05], [0.208, 0.088],
    [0.20, 0.108], [0.178, 0.112], [0.168, 0.09], [0.138, 0.066], [0.10, 0.056], [0.0, 0.052],
  ];
  // Finisher fix 2026-11-22: Chaikin-smooth the profile (2 cuts). The raw
  // 11-point lathe lit as 4-5 flat frustum bands — horizontal strata
  // across the bowl. Uniform subdivision keeps the v-parameterisation
  // (and with it the clay canvas's soot-band placement) intact while
  // the normals — and the silhouette — go smooth and rounded.
  const chaikin = (pts) => {
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      out.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
    }
    out.push(pts[pts.length - 1]);
    return out;
  };
  const profile = chaikin(chaikin(profileRaw)).map(([x, y]) => new THREE.Vector2(x, y));
  // HERO clay (finisher fix 2026-11-22): underwater the shared clayMat's
  // rim mirrored the sky (envMap 0.5) + the surface sheet's teal wash
  // turned the diya grey-blue glass. The hero lathe gets its own
  // material: env reflection nearly off, warm multiplier — the rim
  // reads terracotta clay even submerged. All other clay users keep
  // the shared clayMat.
  const clayMatHero = clayMat.clone();
  clayMatHero.envMapIntensity = 0.12;
  clayMatHero.color.setRGB(1.18, 0.92, 0.64);
  clayMatHero.emissive.set(0x2e1506); // the flame's own warm kiss on the clay — keeps the terracotta reading through the glass + teal wash
  add(new THREE.LatheGeometry(profile, 30), clayMatHero, 0, 0, 0, lampGroup, { cast: true });
  const oil = add(new THREE.CircleGeometry(0.13, 20), new THREE.MeshStandardMaterial({ color: 0x4a2a06, roughness: 0.05, metalness: 0, envMapIntensity: 1.1 }), 0, 0.062, 0, lampGroup, { cast: false });
  oil.rotation.x = -Math.PI / 2;
  const wick = add(new THREE.CylinderGeometry(0.011, 0.014, 0.045, 8), chalkMat, 0, 0.075, 0, lampGroup, { cast: false });
  wick.rotation.z = 0.16;
  flameBody = add(new THREE.SphereGeometry(0.045, 10, 12), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff9a2e, emissiveIntensity: 3.2, roughness: 1 }), 0, 0.175, 0, lampGroup, { cast: false });
  flameBody.scale.set(0.60, 1.9, 0.60); flameBody.userData.ndSkip = true;
  flameInner = add(new THREE.SphereGeometry(0.024, 8, 10), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffe9a8, emissiveIntensity: 4.5, roughness: 1 }), 0, 0.155, 0, lampGroup, { cast: false });
  flameCoreMesh = add(new THREE.SphereGeometry(0.013, 8, 8), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xfff6da, emissiveIntensity: 5.0, roughness: 1 }), 0, 0.148, 0, lampGroup, { cast: false });
  flameCoreMesh.scale.set(0.75, 1.5, 0.75); flameCoreMesh.userData.ndSkip = true;
  flameInner.scale.set(0.7, 1.5, 0.7); flameInner.userData.ndSkip = true;
  flameCore = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexW, color: 0xffe9a8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  flameCore.position.set(0, 0.19, 0); flameCore.scale.set(0.22, 0.34, 1); flameCore.userData.ndSkip = true; flameCore.renderOrder = 6; lampGroup.add(flameCore);
  flameHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexW, color: 0xff9a3c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  flameHalo.position.set(0, 0.17, 0); flameHalo.scale.set(0.85, 0.85, 1); flameHalo.userData.ndSkip = true; flameHalo.renderOrder = 5; lampGroup.add(flameHalo);
  flameLight = new THREE.PointLight(0xffa845, 0, 8, 1.7); flameLight.position.set(0, 0.26, 0); lampGroup.add(flameLight);
  // the glass bowl: physical material, clearcoat + env reflections
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xd8f0f8, metalness: 0, roughness: 0.05, transparent: true, opacity: 0.085,
    clearcoat: 1, clearcoatRoughness: 0.15, envMapIntensity: 0.30,
    side: THREE.FrontSide, depthWrite: false, specularIntensity: 1.2,
  });
  const dome = add(new THREE.SphereGeometry(0.46, 36, 20, 0, Math.PI * 2, 0, Math.PI / 2), glassMat, 0, 0, 0, bowlGroup, { cast: false });
  dome.userData.ndSkip = true; dome.renderOrder = 5;
  const inner = add(new THREE.SphereGeometry(0.445, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), glassMat.clone(), 0, 0, 0, bowlGroup, { cast: false });
  inner.material.opacity = 0.045; inner.userData.ndSkip = true; inner.renderOrder = 5;
  const rim = add(new THREE.TorusGeometry(0.46, 0.02, 10, 40), glassMat.clone(), 0, 0, 0, bowlGroup, { cast: false });
  rim.material.opacity = 0.20; rim.rotation.x = Math.PI / 2; rim.userData.ndSkip = true; rim.renderOrder = 5;
  // the trapped air's inner surface — a living meniscus disc
  const airDisc = add(new THREE.CircleGeometry(0.42, 28), new THREE.MeshPhysicalMaterial({
    color: 0xbfe6ef, metalness: 0, roughness: 0.12, transparent: true, opacity: 0.24,
    envMapIntensity: 1.3, side: THREE.DoubleSide, depthWrite: false,
  }), 0, 0.05, 0, bowlGroup, { cast: false });
  airDisc.rotation.x = -Math.PI / 2; airDisc.userData.ndSkip = true; airDisc.renderOrder = 4;
  // waterline band + expanding ripple rings at the crossing
  bandMesh = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.028, 8, 36), new THREE.MeshBasicMaterial({ color: 0xdff4ff, transparent: true, opacity: 0, fog: true }));
  bandMesh.rotation.x = Math.PI / 2; bandMesh.userData.ndSkip = true; bandMesh.renderOrder = 2; scene.add(bandMesh);
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 1.0, 40), new THREE.MeshBasicMaterial({ color: 0xeaf7ff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, fog: true }));
    ring.rotation.x = -Math.PI / 2; ring.userData.ndSkip = true; ring.renderOrder = 2; scene.add(ring);
    rippleRings.push(ring);
  }
  // bubbles leaking from the rim, rising past the bowl
  const bubTex = P.tex(P.radial('210,235,255', 0.8));
  const rndB = lcg(13);
  for (let i = 0; i < 16; i++) {
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubTex, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    spr.userData.ndSkip = true; spr.renderOrder = 3; scene.add(spr);
    bubblePool.push({ s: spr, ph: rndB(), off: (rndB() - 0.5) * 0.7 });
  }
}
// underwater motes: dust of the river itself, drifting
const moteGeo = new THREE.BufferGeometry();
{
  const rndM = lcg(555); const pts = [];
  for (let i = 0; i < 150; i++) pts.push(-7 + rndM() * 6.5, -1.85 + rndM() * 1.75, 1.2 + rndM() * 5.6);
  moteGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
}
const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ color: 0xcfe8dd, size: 0.022, transparent: true, opacity: 0, depthWrite: false, fog: false }));
motes.userData.ndSkip = true; motes.renderOrder = 3; scene.add(motes);

// ---------- cards (locked V3 character system) ----------
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
    if (a.blob !== false && (a.y - (a.ground ?? 0)) < 0.5) { c.blob.visible = true; c.blob.position.set(a.x, (a.ground ?? 0) + 0.02, a.z); c.blob.scale.set(0.95 * s, 0.6 * s, 1); }
  });
}

// ---------- render targets & post (ink/dof contract, as the kit) ----------
const rtColor = new THREE.WebGLRenderTarget(W, H, { samples: 2, type: THREE.HalfFloatType });
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

// ---------- word-by-word captions ----------
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
const fogDay = new THREE.Color('#9fc8e2'), fogUw = new THREE.Color('#0e4a5e');
const gainDay = new THREE.Color('#fdf6e8'), gainUw = new THREE.Color('#4fbfa8') // finisher: was pale mint #a9dccf (sat 0.23) — it grey-washed every submerged frame; saturated teal keeps the cast AND the chroma;
function applyLight(L, f, sub) {
  hemi.color.set(L.sky); hemi.groundColor.set(L.ground); hemi.intensity = L.hemi * (1 - 0.22 * sub);
  sun.color.set(L.sun); sun.intensity = L.sunI * (1 - 0.30 * sub);
  fogDay.set(L.fog); scene.fog.color.copy(fogDay).lerp(fogUw, sub);
  scene.fog.near = L.fogNear + (3 - L.fogNear) * sub;
  scene.fog.far = L.fogFar + (30 - L.fogFar) * sub;
  skyU.top.value.set(L.skyTop); skyU.hor.value.set(L.skyHor); skyU.sunCol.value.set(L.sunDisc || '#000'); skyU.sunSize.value = L.sunSize || 0;
  skyU.aur.value = L.aurora || 0;
  inkU.sat.value = L.sat + 0.30 * sub; // finisher: water washes chroma out — submerged frames get MORE grade saturation, not less (palette gate)
  inkU.gain.value.copy(gainDay).lerp(gainUw, sub);
  inkU.lift.value.set(L.lift || '#000000');
  waterUniforms.uFogColor.value.copy(scene.fog.color);
  waterUniforms.uFogNear.value = 60; waterUniforms.uFogFar.value = 300; // decoupled: distant water keeps its saturated body instead of washing to fog colour
  waterUniforms.uDeep.value.set(L.waterDeep); waterUniforms.uShallow.value.set(L.waterShal);
  waterUniforms.uSky.value.set(L.fog);
}
function placeSun(L, focus) {
  const az = rx(L.az), el = rx(L.el); tmpV.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
  skyU.sunDir.value.copy(tmpV);
  waterUniforms.uSunDir.value.copy(tmpV);
  sun.position.copy(focus).addScaledVector(tmpV, 80); sun.target.position.copy(focus);
  const ext = 15, sc = sun.shadow.camera; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 200; sc.updateProjectionMatrix();
}
function worldState(Ws, f) {
  const t = f / 30;
  skyU.time.value = t;
  waterUniforms.uTime.value = t;
  causticUniforms.uTime.value = t;
  lampGroup.position.set(Ws.lampX ?? -2.55, Ws.lampY ?? 0.17, Ws.lampZ ?? 3.9);
  bowlGroup.position.set(Ws.bowlX ?? -2.0, Ws.bowlY ?? 0.17, Ws.bowlZ ?? 4.5);
  const fk = Ws.flameK ?? 0;
  const flick = 0.82 + 0.13 * Math.sin(t * 23.7) + 0.05 * Math.sin(t * 41.3 + 1.7);
  flameCore.material.opacity = fk * 0.95 * flick;
  flameCore.scale.set(0.2 + 0.03 * Math.sin(t * 31), 0.3 * flick + 0.1, 1);
  flameHalo.material.opacity = fk * 0.38 * flick;
  flameBody.material.emissiveIntensity = fk * (2.6 + 1.1 * flick);
  if (flameInner) { flameInner.material.emissiveIntensity = fk * (4.5 + 1.4 * flick); flameInner.scale.set(0.7, 1.5 * (0.92 + 0.14 * flick), 0.7); }
  if (flameCoreMesh) { flameCoreMesh.material.emissiveIntensity = fk * (5.0 + 1.2 * flick); }
  flameBody.scale.set(0.60 + 0.04 * Math.sin(t * 27.3), 1.9 * (0.92 + 0.14 * flick), 0.60);
  flameLight.intensity = fk * (3.4 + 1.2 * Math.sin(t * 23.7) + 0.4 * Math.sin(t * 41.3));
  // waterline band + ripple rings while the bowl is at the surface
  bandMesh.position.set(Ws.bowlX ?? -3.85, WATER_Y + 0.006, Ws.bowlZ ?? 3.9);
  bandMesh.material.opacity = (Ws.bandK ?? 0) * 0.55;
  bandMesh.scale.setScalar(1 + 0.1 * Math.sin(t * 6.2));
  const rippleK = Math.max(Ws.bandK ?? 0, (Ws.bubbleK ?? 0) * 0.5);
  rippleRings.forEach((ring, i) => {
    const u = (t * 0.45 + i / 3) % 1;
    ring.position.set(Ws.bowlX ?? -3.85, WATER_Y + 0.008 + i * 0.002, Ws.bowlZ ?? 3.9);
    const s = 0.55 + u * 1.5; ring.scale.set(s, s, 1);
    ring.material.opacity = rippleK * (1 - u) * 0.32;
  });
  // bubbles leak from the rim zone and rise past the bowl
  const bk = Ws.bubbleK ?? 0;
  for (const b of bubblePool) {
    const u = (t * 0.14 + b.ph) % 1;
    b.s.visible = bk > 0.02;
    b.s.position.set((Ws.bowlX ?? -3.85) + 0.52 + Math.sin(u * 9 + b.ph * 20) * 0.07, -1.7 + u * 0.83, (Ws.bowlZ ?? 3.9) + b.off);
    b.s.material.opacity = bk * 0.5 * Math.sin(u * Math.PI);
    const sc = 0.05 + u * 0.05; b.s.scale.set(sc, sc, 1);
  }
  // boats ride the wave; reeds sway in the one wind
  boats.forEach((b) => {
    const wy = waveH(b.x, b.z, t, Ws.seaK ?? 0.14);
    b.g.position.set(b.x, wy - 0.89, b.z);
    const sx = (waveH(b.x + 1.2, b.z, t, Ws.seaK ?? 0.14) - waveH(b.x - 1.2, b.z, t, Ws.seaK ?? 0.14)) / 2.4;
    const sz = (waveH(b.x, b.z + 1.6, t, Ws.seaK ?? 0.14) - waveH(b.x, b.z - 1.6, t, Ws.seaK ?? 0.14)) / 3.2;
    b.g.rotation.z = -sx * 0.75; b.g.rotation.x = sz * 0.6;
  });
  for (const r of (window.__reeds || [])) r.g.rotation.z = Math.sin(t * 1.25 + r.ph) * 0.05 + Math.sin(t * 0.37 + r.ph * 2) * 0.03;
  // v3 vegetation: wind + canopy sway, a pure function of frame number
  for (const u of VEG_UPDATERS) u(t);
  // underwater motes fade in with the camera's submersion
  const sub = clamp01((WATER_Y + 0.10 - (Ws.camY ?? 2)) / 0.32);
  motes.material.opacity = sub * 0.5;
  motes.position.y = Math.sin(t * 0.23) * 0.05;
  motes.position.x = Math.sin(t * 0.11) * 0.12;
  causticUniforms.uK.value = 0.55 + 0.35 * sub;
  // v2 full-film set drivers: board, boat lamps, windows, ropes,
  // gulls, clouds, coin glint, god-ray shafts
  scene.traverse((o) => { if (o.userData.isOccluder) o.visible = o.userData.boardKey === 'always' || (Ws[o.userData.boardKey] ?? 1) > 0.01; });
  boardHook.material.opacity = Ws.hookK ?? 1; boardHook.visible = (Ws.hookK ?? 1) > 0.01;
  boatLampGlows.forEach((spr, i) => { spr.material.opacity = (Ws.boatLampK ?? 0) * (0.55 + 0.15 * Math.sin(t * 19 + i * 2.4)); });
  const lk = Ws.lampK ?? 0;
  windowGlows.forEach((spr, i) => { spr.material.opacity = 0.1 + lk * 0.5 + Math.sin(t * 7 + i * 2.1) * 0.03; });
  windowPanes.forEach((pn) => { pn.material.opacity = 0.16 + lk * 0.55; });
  boats.forEach((b, i) => {
    if (!b.bollard) return;
    const wy = waveH(b.x, b.z, t, Ws.seaK ?? 0.14);
    setBeam(boatRopes[i], new THREE.Vector3(b.bollard[0], b.bollard[1], b.bollard[2]),
      new THREE.Vector3(b.x + 1.15, wy - 0.44, b.z + (b.bollard[2] - b.z) * 0.72));
  });
  const gk = Ws.gullK ?? 0;
  for (const gu of gulls) {
    gu.g.visible = gk > 0;
    if (gk > 0) {
      const u = Math.min(1, Math.max(0, gk * 1.06 - gu.i * 0.012));
      gu.g.position.set(-17 + 32 * u + Math.sin(gu.i * 7.3) * 0.8, 6.6 - u * 1.3 + Math.sin(t * 2.1 + gu.i * 1.7) * 0.22, 5.2 + (gu.i - 3) * 1.25 + Math.sin(t * 0.9 + gu.i) * 0.4);
      const flap = Math.sin(t * 9.5 + gu.i * 1.31) * 0.62;
      gu.wL.rotation.x = flap; gu.wR.rotation.x = -flap;
      gu.g.rotation.y = -0.06 * Math.sin(t * 0.9 + gu.i);
    }
  }
  for (const c of cloudSprites) { c.spr.position.x += c.sp * 0.016; if (c.spr.position.x > 42) c.spr.position.x = -42; }
  const pr = fxProfileAt(f);
  coinGlint.material.opacity = (pr.sparkRate || 0) * (0.5 + 0.4 * Math.sin(t * 9));
  shafts.forEach((m, i) => { m.material.opacity = sub * (0.10 + 0.03 * Math.sin(t * 0.7 + i * 1.9)); m.rotation.z = 0.42 + 0.03 * Math.sin(t * 0.4 + i); });
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
  const S = shotAt(f), C = camAt(f);
  const sub = clamp01((WATER_Y + 0.10 - C.pos[1]) / 0.32);
  const L = lightFor(S, f);
  applyLight(L, f, sub);
  camera.position.set(...C.pos); camera.up.set(0, 1, 0); camera.lookAt(...C.look); camera.rotateZ(rx(C.roll || 0));
  camera.fov = C.fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  const Ws = worldAt(f); worldState(Ws, f);
  placeSun(L, new THREE.Vector3(...(C.shadowAt || C.look)));
  drawActors([...actorsAt(f, T), ...fxAt(f, T)], camera);
  sky.position.copy(camera.position);
  const HASH = window.location.hash || '';
  if (HASH.includes('xw')) waterMesh.visible = false;
  if (HASH.includes('xc')) { causticBed.visible = false; causticSlab.visible = false; }
  if (HASH.includes('xg')) world.visible = false;
  if (HASH.includes('xk')) { lampGroup.visible = false; bowlGroup.visible = false; }
  renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true; // one shadow render per frame, reused by every pass
  if (!HASH.includes('xr')) renderReflection();
  renderer.setRenderTarget(rtColor); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(scene, camera);
  const fog = scene.fog; scene.fog = null; const sm = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false; renderer.shadowMap.autoUpdate = false;
  swapForNd(true); renderer.setRenderTarget(rtNd); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, camera); swapForNd(false);
  scene.fog = fog; renderer.shadowMap.enabled = sm; renderer.shadowMap.autoUpdate = true;
  if (window.DEBUG_ND) { const dm = new THREE.MeshBasicMaterial({ map: rtNd.texture }); const ds = fs(dm); renderer.setRenderTarget(null); renderer.render(ds, fsCam); return true; }
  if ((window.location.hash || '').includes('xcolor')) { const dm = new THREE.MeshBasicMaterial({ map: rtColor.texture }); const ds = fs(dm); renderer.setRenderTarget(null); renderer.render(ds, fsCam); return true; }
  if ((window.location.hash || '').includes('zrt')) { const dm = new THREE.MeshBasicMaterial({ map: reflRT.texture }); const ds = fs(dm); renderer.setRenderTarget(null); renderer.render(ds, fsCam); return true; }
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
window.__dbg = { scene, camera, renderer, lampGroup, bowlGroup, waterMesh, virtualCamera, reflRT, THREE };
window.ready = true;
