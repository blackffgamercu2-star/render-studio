import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import * as M4 from './materials.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, SIGN_POS, gunAt } from './story.js';
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
// mine practicals (no shadows; pools motivated by visible lanterns)
const lampA = new THREE.PointLight(0xffb45e, 30, 26, 1.8); lampA.position.set(0, 3.4, 0); scene.add(lampA);
const lampB = new THREE.PointLight(0xffa64e, 30, 28, 1.8); lampB.position.set(0, 3.4, -19); scene.add(lampB);
const veinLight = new THREE.PointLight(0xffc95e, 0, 20, 1.6); veinLight.position.set(0, 2.2, -29.5); scene.add(veinLight);
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
const goldCanvas = (() => {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#8a5a14'); gr.addColorStop(0.35, '#d9a441'); gr.addColorStop(0.52, '#ffe9a0'); gr.addColorStop(0.62, '#f6c453'); gr.addColorStop(1, '#9c6b1e');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 260; i++) {
    g.strokeStyle = `rgba(255,240,200,${0.03 + Math.random() * 0.05})`; g.lineWidth = 1;
    const y = Math.random() * 512; g.beginPath(); g.moveTo(0, y); g.lineTo(512, y + (Math.random() - 0.5) * 6); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
})();
const rockCanvas = (seed, base, band, blotch) => {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  let sd = seed; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  // wavy horizontal strata bands (painted rock, never a brick grid)
  for (let i = 0; i < 8; i++) {
    const y0 = i * 64 + rnd() * 22, h = 20 + rnd() * 30;
    g.fillStyle = band; g.globalAlpha = 0.22 + rnd() * 0.16;
    g.beginPath(); g.moveTo(0, y0);
    for (let x = 0; x <= 512; x += 64) g.lineTo(x, y0 + Math.sin(x * 0.02 + i * 2.4) * 7 + rnd() * 5);
    for (let x = 512; x >= 0; x -= 64) g.lineTo(x, y0 + h + Math.sin(x * 0.017 + i) * 6);
    g.closePath(); g.fill();
  }
  // large diagonal fold shading — crumpled rock, like the reference walls
  for (let i = 0; i < 6; i++) {
    const x0 = rnd() * 512, wdt = 60 + rnd() * 130;
    const gr2 = g.createLinearGradient(x0, 0, x0 + wdt, 512);
    const dk = rnd() > 0.5;
    gr2.addColorStop(0, 'rgba(0,0,0,0)'); gr2.addColorStop(0.5, dk ? 'rgba(46,26,10,0.20)' : 'rgba(255,214,160,0.13)'); gr2.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 1; g.fillStyle = gr2; g.fillRect(0, 0, 512, 512);
  }
  g.globalAlpha = 1;
  // soft mottling
  for (let i = 0; i < 260; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 8 + rnd() * 42;
    const gr = g.createRadialGradient(x, y, 1, x, y, r);
    gr.addColorStop(0, blotch); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.05 + rnd() * 0.08; g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  // sparse cracks
  g.strokeStyle = 'rgba(40,22,10,0.35)'; g.lineWidth = 1.6;
  for (let i = 0; i < 12; i++) {
    let x = rnd() * 512, y = rnd() * 200; g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += (rnd() - 0.5) * 36; y += 22 + rnd() * 26; g.lineTo(x, y); }
    g.stroke();
  }
  // speckle
  for (let i = 0; i < 1500; i++) { g.fillStyle = rnd() > 0.5 ? 'rgba(255,230,190,0.06)' : 'rgba(30,16,6,0.07)'; g.fillRect(rnd() * 512, rnd() * 512, 2, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
};
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
// impact-scar texture: same rock family as the tunnel walls but painted at
// close-up density (fine grain, thin strata) + jagged radial cracks and a
// scorched dent at the centre (canvas centre = crater centre)
const craterCanvas = (seed) => {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  let sd = seed; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#9a7350'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 14; i++) {
    const y0 = i * 37 + rnd() * 14, h = 10 + rnd() * 18;
    g.fillStyle = '#6e4c2c'; g.globalAlpha = 0.30 + rnd() * 0.18;
    g.beginPath(); g.moveTo(0, y0);
    for (let x = 0; x <= 512; x += 32) g.lineTo(x, y0 + Math.sin(x * 0.03 + i * 2.1) * 4 + rnd() * 3);
    for (let x = 512; x >= 0; x -= 32) g.lineTo(x, y0 + h + Math.sin(x * 0.026 + i) * 4);
    g.closePath(); g.fill();
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 5200; i++) { g.fillStyle = rnd() > 0.5 ? 'rgba(255,230,190,0.13)' : 'rgba(30,16,6,0.14)'; g.fillRect(rnd() * 512, rnd() * 512, 1.8, 1.8); }
  for (let i = 0; i < 200; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 5 + rnd() * 26;
    const gr = g.createRadialGradient(x, y, 1, x, y, r);
    gr.addColorStop(0, rnd() > 0.5 ? 'rgba(255,214,160,0.10)' : 'rgba(40,22,8,0.10)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  const cx = 256, cy = 256;
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rnd() * 0.5, len = 80 + rnd() * 105;
    let x = cx, y = cy; const steps = 5 + (rnd() * 3 | 0);
    g.strokeStyle = 'rgba(34,18,7,0.6)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y);
    for (let k = 1; k <= steps; k++) { const t = k / steps; x = cx + Math.cos(a + (rnd() - 0.5) * 0.35) * len * t; y = cy + Math.sin(a + (rnd() - 0.5) * 0.35) * len * t; g.lineTo(x, y); }
    g.stroke();
    if (rnd() > 0.35) { const bx = cx + Math.cos(a) * len * 0.55, by = cy + Math.sin(a) * len * 0.55, ba = a + (rnd() > 0.5 ? 0.7 : -0.7); g.lineWidth = 1.6; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.cos(ba) * len * 0.3, by + Math.sin(ba) * len * 0.3); g.stroke(); }
  }
  const sc = g.createRadialGradient(cx, cy, 4, cx, cy, 105);
  sc.addColorStop(0, 'rgba(24,12,4,0.62)'); sc.addColorStop(0.55, 'rgba(30,16,6,0.30)'); sc.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = sc; g.beginPath(); g.arc(cx, cy, 105, 0, 7); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
};
// radial alpha fade so a crater patch melts into the wall around it
const craterAlpha = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 40, 128, 128, 128);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, '#ffffff'); gr.addColorStop(1, '#000000');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
})();
// burlap for the gold sack: woven cross-hatch, vertical fold bands, stitched seam
const sackCanvas = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  let sd = 47; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#96793f'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 3) { g.fillStyle = (y / 3) % 2 ? 'rgba(60,40,14,0.10)' : 'rgba(255,230,180,0.07)'; g.fillRect(0, y, 256, 1.6); }
  for (let x = 0; x < 256; x += 3) { g.fillStyle = (x / 3) % 2 ? 'rgba(60,40,14,0.08)' : 'rgba(255,230,180,0.05)'; g.fillRect(x, 0, 1.6, 256); }
  for (let i = 0; i < 7; i++) {
    const x0 = i * 38 + rnd() * 12, w = 16 + rnd() * 20;
    const gr = g.createLinearGradient(x0, 0, x0 + w, 0);
    const dk = rnd() > 0.45;
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, dk ? 'rgba(52,34,10,0.20)' : 'rgba(255,226,170,0.14)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x0, 0, w, 256);
  }
  g.strokeStyle = 'rgba(46,28,8,0.55)'; g.lineWidth = 2; g.setLineDash([7, 5]);
  g.beginPath(); g.moveTo(0, 42); g.lineTo(256, 42); g.stroke(); g.setLineDash([]);
  for (let i = 0; i < 130; i++) { const x = rnd() * 256, y = rnd() * 256, r = 4 + rnd() * 18; const gr = g.createRadialGradient(x, y, 1, x, y, r); gr.addColorStop(0, 'rgba(50,32,10,0.10)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
})();
const MAT = {
  rock: toon({ map: rockCanvas(8, '#9a7350', '#6e4c2c', 'rgba(255,214,160,1)'), color: '#b98d5f' }),
  rockDk: toon({ map: rockCanvas(9, '#7d5a38', '#54381e', 'rgba(230,190,140,1)'), color: '#96754c' }),
  rockFace: toon({ map: rockCanvas(11, '#a87c50', '#77552f', 'rgba(255,220,170,1)'), color: '#dcbc92' }),
  dirt: toon({ map: dirtCanvas(191), color: '#b08e5e' }),
  floor: toon({ map: dirtCanvas(77), color: '#a07c4e' }),
  wood: texM(M4.woodV4(4), 1, 2), woodDk: texM(M4.woodV4(6), 1, 2),
  gold: toon({ map: goldCanvas }), goldDk: toon({ map: goldCanvas, color: '#c9962e' }), goldTrim: toon({ color: '#f0bc4a' }),
  steel: new THREE.MeshStandardMaterial({ color: 0x8f979e, roughness: 0.38, metalness: 0.85, envMap, envMapIntensity: 0.9 }),
  ironDk: new THREE.MeshStandardMaterial({ color: 0x2c2c30, roughness: 0.55, metalness: 0.6, envMap, envMapIntensity: 0.5 }),
  cloth: toon({ color: '#8a6f42' }),
  sack: toon({ map: sackCanvas, color: '#c9a86a' }), rope: toon({ color: '#4c3016' }),
  red: toon({ color: '#a02c22' }),
  lampGlass: new THREE.MeshBasicMaterial({ color: 0xffc36a }),
  dark: toon({ color: '#33302c' }),
  gunWood: toon({ color: '#3a2410' }),
  seam: toon({ color: '#d9c9a3' }),
};

// ---------- THE MINE ----------
// Tunnel axis = -Z. Entrance mouth at z=+8; deep end wall at z=-32.
const world = new THREE.Group(); scene.add(world);
const lanternGlows = [];
{
  const g = world;
  MAT.dirt.map.repeat.set(14, 14); const ground = flat(add(new THREE.CircleGeometry(60, 40), MAT.dirt, 0, -0.02, 16, g, { cast: false }));
  ground.scale.set(1.3, 1, 1);
  MAT.floor.map.repeat.set(2, 12); flat(add(new THREE.PlaneGeometry(7.4, 42), MAT.floor, 0, 0, -11, g, { cast: false }));
  // ROUND 4: tunnel walls use the lighter, high-detail rock face — the old
  // rock read flat brown at story distance; the reference walls are bright
  // tan with strong strata and folds.
  add(tbox(1.6, 5.4, 42, 6), MAT.rockFace, -4.3, 2.7, -11, g, { cast: false });
  add(tbox(1.6, 5.4, 42, 6), MAT.rockFace, 4.3, 2.7, -11, g, { cast: false });
  add(tbox(10.2, 1.6, 42, 6), MAT.rockDk, 0, 5.4, -11, g, { cast: false });
  add(tbox(10.2, 6.2, 1.6, 3), MAT.rock, 0, 3.1, -33.2, g, { cast: false });
  for (const fz of [5, -1, -7, -13, -19, -25]) {
    add(tbox(0.3, 4.6, 0.3, 2), MAT.woodDk, -3.2, 2.3, fz, g, { cast: false });
    add(tbox(0.3, 4.6, 0.3, 2), MAT.woodDk, 3.2, 2.3, fz, g, { cast: false });
    add(tbox(6.9, 0.34, 0.36, 2), MAT.wood, 0, 4.55, fz, g, { cast: false });
    add(tbox(6.9, 0.2, 0.2, 2), MAT.woodDk, 0, 4.28, fz, g, { cast: false });
  }
  for (const sx of [-0.75, 0.75]) add(box(0.09, 0.13, 39), MAT.steel, sx, 0.16, -10.5, g, { cast: false });
  for (let sz = 8.5; sz > -29; sz -= 0.95) add(tbox(2.0, 0.09, 0.26, 2), MAT.woodDk, 0, 0.045, sz, g, { cast: false });
  const cart = new THREE.Group(); cart.position.set(0, 0, -5); g.add(cart);
  add(tbox(1.5, 0.75, 2.1, 2), MAT.ironDk, 0, 0.72, 0, cart, { cast: false });
  add(tbox(1.6, 0.14, 2.2, 2), MAT.steel, 0, 1.12, 0, cart, { cast: false });
  for (const [wx, wz] of [[-0.62, -0.8], [0.62, -0.8], [-0.62, 0.8], [0.62, 0.8]]) {
    const wh = add(new THREE.CylinderGeometry(0.21, 0.21, 0.08, 12), MAT.ironDk, wx, 0.21, wz, cart, { cast: false });
    wh.rotation.z = Math.PI / 2;
  }
  const cartRock = add(new THREE.SphereGeometry(0.5, 9, 7), MAT.rockDk, -0.2, 1.2, 0.2, cart, { cast: false }); cartRock.scale.set(1.2, 0.6, 1.4);
  const cartRock2 = add(new THREE.SphereGeometry(0.36, 9, 7), MAT.rock, 0.35, 1.18, -0.4, cart, { cast: false }); cartRock2.scale.set(1.1, 0.6, 1.2);
  // ROUND 4: every hanging lantern throws a visible POOL of warm light on
  // the tunnel floor (the reference's light is motivated and pooled; V3's
  // tunnel had glow sprites but a flat dark floor).
  const poolTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const gg = c.getContext('2d'); const gr = gg.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(255,205,130,0.85)'); gr.addColorStop(1, 'rgba(255,205,130,0)'); gg.fillStyle = gr; gg.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  for (const lz of [3.5, -4, -11.5, -16, -23]) {
    add(new THREE.CylinderGeometry(0.015, 0.015, 0.8, 4), MAT.dark, 0, 4.15, lz, g, { cast: false });
    add(box(0.16, 0.05, 0.16), MAT.ironDk, 0, 3.72, lz, g, { cast: false });
    add(box(0.13, 0.2, 0.13), MAT.lampGlass, 0, 3.58, lz, g, { cast: false });
    add(box(0.17, 0.04, 0.17), MAT.ironDk, 0, 3.45, lz, g, { cast: false });
    const gl = softGlow(1.5, '#ffb45e', 0.5); gl.position.set(0, 3.58, lz); g.add(gl); lanternGlows.push(gl);
    const lp = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    lp.rotation.x = -Math.PI / 2; lp.position.set(0, 0.025, lz); lp.userData.ndSkip = true; g.add(lp);
  }
  // ROUND 4 set dressing where the action lives (reference tunnel is dense
  // with working props; V3's was bare): crates/barrel/sacks/planks near the
  // load crate and around the buddy's glitter spot, clear of actor paths.
  add(tbox(0.85, 0.85, 0.85, 2), MAT.wood, 3.3, 0.43, -1.8, g, { cast: false });
  add(tbox(0.7, 0.7, 0.7, 2), MAT.woodDk, 3.25, 1.2, -1.75, g, { cast: false });
  add(new THREE.CylinderGeometry(0.33, 0.29, 0.92, 12), MAT.wood, -3.35, 0.46, 0.35, g, { cast: false });
  add(new THREE.CylinderGeometry(0.31, 0.28, 0.88, 12), MAT.woodDk, -3.15, 0.44, -7.7, g, { cast: false });
  add(tbox(0.8, 0.8, 0.8, 2), MAT.wood, 3.25, 0.4, -6.9, g, { cast: false });
  const sk1 = add(new THREE.SphereGeometry(0.3, 9, 7), MAT.sack, -2.95, 0.2, -5.6, g, { cast: false }); sk1.scale.set(1, 0.72, 1);
  const sk2 = add(new THREE.SphereGeometry(0.24, 9, 7), MAT.sack, -2.6, 0.16, -5.95, g, { cast: false }); sk2.scale.set(1, 0.7, 1);
  const plank = add(tbox(0.34, 2.6, 0.06, 2), MAT.wood, -3.3, 1.15, -1.05, g, { cast: false }); plank.rotation.z = 0.38;
  const plank2 = add(tbox(0.3, 2.2, 0.06, 2), MAT.woodDk, 3.35, 1.0, -13.2, g, { cast: false }); plank2.rotation.z = -0.34;
  const coneMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 1.25, 4.3, 16, 1, true), coneMat);
  cone.position.set(0.9, 2.35, 1.9); cone.userData.ndSkip = true; g.add(cone);
  g.userData.lampCone = cone;
  coneMat.alphaMap = (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 128; const gg = c.getContext('2d'); const gr = gg.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.55, '#8a8a8a'); gr.addColorStop(1, '#000000'); gg.fillStyle = gr; gg.fillRect(0, 0, 4, 128); const t = new THREE.CanvasTexture(c); t.wrapT = THREE.RepeatWrapping; t.repeat.y = -1; return t; })();
  add(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 5), MAT.dark, 0.9, 4.85, 1.9, g, { cast: false });
  add(new THREE.CylinderGeometry(0.30, 0.42, 0.22, 12), MAT.ironDk, 0.9, 4.55, 1.9, g, { cast: false });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.4), new THREE.MeshBasicMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const gg = c.getContext('2d'); const gr = gg.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(255,215,150,0.9)'); gr.addColorStop(1, 'rgba(255,215,150,0)'); gg.fillStyle = gr; gg.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(0.9, 0.03, 1.9); pool.userData.ndSkip = true; g.add(pool);
  g.userData.lampPool = pool;
  add(tbox(11, 12, 3.4, 3), MAT.rockFace, -9.2, 6, 8.7, g, { cast: false });
  add(tbox(11, 12, 3.4, 3), MAT.rockFace, 9.2, 6, 8.7, g, { cast: false });
  add(tbox(7.4, 6.4, 3.4, 3), MAT.rockFace, 0, 9.4, 8.7, g, { cast: false });
  const h1 = add(new THREE.SphereGeometry(16, 12, 9), MAT.rockFace, -20, -2, -6, g, { cast: false }); h1.scale.set(1, 0.55, 1);
  const h2 = add(new THREE.SphereGeometry(18, 12, 9), MAT.rockFace, 22, -3, -10, g, { cast: false }); h2.scale.set(1, 0.5, 1);
  const h3 = add(new THREE.SphereGeometry(22, 12, 9), MAT.rockDk, 0, -4, -34, g, { cast: false }); h3.scale.set(1.2, 0.5, 1);
  add(tbox(0.34, 5.2, 0.34, 2), MAT.wood, -3.4, 2.6, 8.2, g, { cast: false });
  add(tbox(0.34, 5.2, 0.34, 2), MAT.wood, 3.4, 2.6, 8.2, g, { cast: false });
  add(tbox(7.4, 0.4, 0.4, 2), MAT.wood, 0, 5.15, 8.2, g, { cast: false });
  add(tbox(0.9, 0.9, 0.9, 2), MAT.wood, -4.6, 0.45, 11.5, g, { cast: false });
  add(tbox(0.8, 0.8, 0.8, 2), MAT.woodDk, -4.5, 1.3, 11.4, g, { cast: false });
  add(new THREE.CylinderGeometry(0.34, 0.3, 0.95, 12), MAT.wood, 4.8, 0.48, 11.8, g, { cast: false });
  add(new THREE.TorusGeometry(0.33, 0.03, 6, 16), MAT.ironDk, 4.8, 0.75, 11.8, g, { cast: false }).rotation.x = Math.PI / 2;
  add(new THREE.TorusGeometry(0.32, 0.03, 6, 16), MAT.ironDk, 4.8, 0.25, 11.8, g, { cast: false }).rotation.x = Math.PI / 2;
  add(tbox(1.7, 0.09, 1.0, 2), MAT.wood, 3.6, 0.74, 13.2, g, { cast: false });
  for (const [lx, lz] of [[-0.75, -0.4], [0.75, -0.4], [-0.75, 0.4], [0.75, 0.4]])
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.74, 6), MAT.woodDk, 3.6 + lx, 0.37, 13.2 + lz, g, { cast: false });
  const crate = new THREE.Group(); crate.position.set(2.95, 0, -30.6); crate.rotation.y = -0.3; g.add(crate);
  add(tbox(0.95, 0.55, 0.7, 2), MAT.wood, 0, 0.28, 0, crate, { cast: false });
  for (let i = 0; i < 3; i++) {
    add(new THREE.CylinderGeometry(0.055, 0.055, 0.42, 8), MAT.red, -0.25 + i * 0.25, 0.72, 0, crate, { cast: false });
    add(new THREE.CylinderGeometry(0.02, 0.02, 0.07, 5), MAT.cloth, -0.25 + i * 0.25, 0.96, 0, crate, { cast: false });
  }
  // SALTED-60: the low cross-beam the buyer bangs his head on (z=3.2,
  // underside y~2.31 — just above a standing card's hat line)
  add(tbox(6.9, 0.34, 0.36, 2), MAT.wood, 0, 2.48, 3.2, g, { cast: false });
  add(tbox(6.9, 0.2, 0.2, 2), MAT.woodDk, 0, 2.22, 3.2, g, { cast: false });
}

// ---------- SALTED-60 set pieces: pan test station, final-reveal props, flying dynamite ----------
// The expert's pan station: a low crate by the right wall (z=-6.3) with a
// steel pan; the fleck group swirls (worldAt panSwirl) then settles.
const panG = new THREE.Group(); panG.position.set(2.7, 0, -6.3); world.add(panG);
let panFlecks = null;
{
  add(tbox(0.85, 0.8, 0.85, 2), MAT.wood, 0, 0.4, 0, panG, { cast: false });
  const pan = add(new THREE.CylinderGeometry(0.36, 0.28, 0.09, 18), MAT.ironDk, 0, 0.85, 0, panG, { cast: false });
  const water = add(new THREE.CylinderGeometry(0.32, 0.32, 0.02, 18), MAT.goldDk, 0, 0.885, 0, panG, { cast: false });
  water.material = toon({ color: '#6a5136' });
  panFlecks = new THREE.Group(); panFlecks.position.set(0, 0.9, 0); panG.add(panFlecks);
  let sd = 31; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 7; i++) {
    const a = rnd() * 6.28, rr = 0.08 + rnd() * 0.18;
    const fl = add(new THREE.SphereGeometry(0.028 + rnd() * 0.02, 7, 5), i % 2 ? MAT.gold : MAT.goldDk, Math.cos(a) * rr, 0, Math.sin(a) * rr, panFlecks, { cast: false });
    fl.scale.y = 0.4;
  }
  panG.visible = false;
}
// Final-reveal props (shot 25, errata composition): yellow tape measure on
// the floor centre, pickaxe + the miner's hat at the right foreground.
const tapeM = (() => {
  const m = add(box(0.1, 0.015, 3.4), toon({ color: '#e8c33a' }), 0.1, 0.025, -27.9, world, { cast: false });
  m.rotation.y = 0.06; m.visible = false; return m;
})();
const finalG = new THREE.Group(); finalG.position.set(1.12, 0, -28.8); finalG.rotation.y = -0.5; world.add(finalG);
{
  const handle = add(new THREE.CylinderGeometry(0.035, 0.04, 1.2, 8), MAT.wood, 0, 0.52, 0, finalG, { cast: false });
  handle.rotation.z = 0.42;
  const headBar = add(box(0.78, 0.07, 0.07), MAT.steel, 0.24, 1.06, 0, finalG, { cast: false });
  headBar.rotation.z = 0.42;
  const tipL = add(box(0.2, 0.06, 0.06), MAT.steel, -0.08, 1.13, 0, finalG, { cast: false }); tipL.rotation.z = 1.05;
  const tipR = add(box(0.2, 0.06, 0.06), MAT.steel, 0.56, 0.97, 0, finalG, { cast: false }); tipR.rotation.z = -0.25;
  const brim = add(new THREE.CylinderGeometry(0.31, 0.33, 0.035, 14), toon({ color: '#7a5a30' }), 0.26, 1.17, 0, finalG, { cast: false });
  const dome = add(new THREE.SphereGeometry(0.17, 12, 8), toon({ color: '#7a5a30' }), 0.26, 1.19, 0, finalG, { cast: false });
  dome.scale.y = 0.75;
  finalG.visible = false;
}
// The flying dynamite stick (shots 22-23): posed per-frame by worldAt dyn*.
const dynG = new THREE.Group(); world.add(dynG);
const dynFuse = softGlow(0.34, '#ffd27a', 0);
{
  const stick = add(new THREE.CylinderGeometry(0.055, 0.055, 0.44, 10), MAT.red, 0, 0, 0, dynG, { cast: false });
  stick.rotation.x = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.057, 0.057, 0.07, 10), MAT.seam, 0, 0, 0.1, dynG, { cast: false }).rotation.x = Math.PI / 2;
  dynFuse.position.set(0, 0.05, -0.26); dynG.add(dynFuse);
  dynG.visible = false;
}

// ---------- the gold vein (behind two rock slabs at the deep wall) ----------
const veinG = new THREE.Group(); veinG.position.set(0, 0, -32.2); world.add(veinG);
const slabL = add(tbox(3.4, 5.6, 0.5, 2), MAT.rock, -1.72, 2.8, 0.35, veinG);
const slabR = add(tbox(3.4, 5.6, 0.5, 2), MAT.rock, 1.72, 2.8, 0.35, veinG);
{
  // dark rock recess behind the gold, so the vein reads as a seam IN rock
  add(tbox(2.3, 6.0, 0.3, 3), MAT.rockDk, 0, 2.9, -0.22, veinG, { cast: false });
  // ROUND 4: the vein is a continuous MOLTEN RIBBON (metallic gold gradient)
  // running down the crack, with smaller chunky lumps on top — V3's pale
  // seam backing + big smooth ellipses read as eggs glued to the wall.
  add(tbox(0.7, 6.0, 0.14, 2), MAT.gold, 0, 2.9, -0.10, veinG, { cast: false });
  add(tbox(0.38, 6.0, 0.15, 2), MAT.goldDk, 0.1, 2.9, -0.09, veinG, { cast: false });
  // lumps carry NO ink outline (ndSkip) — outlined, they read as separate
  // balloons; unoutlined and smaller, they melt into the ribbon.
  const lump = (x, y, z, s, rz, dk) => { const m = add(new THREE.SphereGeometry(s, 9, 7), dk ? MAT.goldDk : MAT.gold, x, y, z, veinG, { cast: false }); m.scale.set(0.85, 1.15, 0.3); m.rotation.z = rz || 0; m.userData.ndSkip = true; return m; };
  // a dense wavy river of chunky gold lumps + connecting streaks, floor to ceiling
  const path = [[0.05, 0.4], [-0.2, 0.95], [0.16, 1.5], [-0.06, 2.05], [0.24, 2.6], [-0.18, 3.15], [0.06, 3.7], [0.28, 4.2], [-0.1, 4.75], [0.08, 5.3]];
  path.forEach(([x, y], i) => {
    lump(x, y, 0, 0.145 + (i % 3) * 0.025, (i % 2 ? -1 : 1) * 0.18, i % 3 === 2);
    lump(x * 0.4, y + 0.26, -0.04, 0.095, 0.3, i % 2 === 0);
    if (i < path.length - 1) {
      const [nx, ny] = path[i + 1];
      const st = add(box(0.1, Math.hypot(nx - x, ny - y) + 0.15, 0.05), i % 2 ? MAT.goldDk : MAT.gold, (x + nx) / 2, (y + ny) / 2, -0.02, veinG, { cast: false });
      st.rotation.z = Math.atan2(nx - x, ny - y) * -1 + (i % 2 ? 0.06 : -0.05);
    }
  });
}
const veinGlow = softGlow(4.2, '#ffbf4e', 0); veinGlow.position.set(0, 2.8, -31.2); world.add(veinGlow);
const veinGlints = [];
for (let i = 0; i < 5; i++) {
  const gl = softGlow(0.55, '#fff3cf', 0); gl.position.set((i % 3 - 1) * 0.3, 1 + i * 0.95, -31.55); world.add(gl); veinGlints.push(gl);
}
// salt glitter flecks in the tunnel walls
const sparkTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); g.translate(32, 32);
  g.fillStyle = 'rgba(255,225,150,1)';
  g.beginPath(); g.moveTo(0, -15); g.quadraticCurveTo(2.5, -2.5, 15, 0); g.quadraticCurveTo(2.5, 2.5, 0, 15); g.quadraticCurveTo(-2.5, 2.5, -15, 0); g.quadraticCurveTo(-2.5, -2.5, 0, -15); g.fill();
  g.fillStyle = 'rgba(255,255,240,0.95)'; g.beginPath(); g.arc(0, 0, 3.4, 0, 7); g.fill();
  return new THREE.CanvasTexture(c);
})();
const saltFlecks = [];
{
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 46; i++) {
    const side = i % 2 ? -1 : 1;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16),
      new THREE.MeshBasicMaterial({ map: sparkTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    m.position.set(side * 3.47, 0.5 + rnd() * 3.6, 3 - rnd() * 31);
    m.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    m.userData.phase = rnd() * 6.28; m.userData.ndSkip = true;
    world.add(m); saltFlecks.push(m);
  }
}
// gold IMPACT CRATERS on the exact spots the shots hit (one per shot): a
// scarred rock patch (close-up grain + painted radial cracks, edges faded
// into the wall), a dented crater bowl with a jagged broken lip of rock
// shards, and chunky 3D gold nuggets embedded in and around the hole —
// everything shaded geometry, faded in per-patch (saltP). Local frame:
// +Z out of the wall, X along the tunnel, Y up.
const splatMats = [];
{
  const craterTex = craterCanvas(23);
  let seed = 97; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const spots = [[3.49, 1.8, 0.6, -1], [-3.49, 2.0, -3.0, 1], [3.49, 1.6, -5.0, -1]];
  for (const [sx, sy, sz, dir] of spots) {
    const mats = [];
    const reg = (mat, base) => { mat.transparent = true; mat.opacity = 0; mats.push({ mat, base }); return mat; };
    const smat = new THREE.MeshBasicMaterial({ map: sparkTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    splatMats.push({ mats, smat });
    const grp = new THREE.Group(); grp.position.set(sx, sy, sz); grp.rotation.y = dir < 0 ? -Math.PI / 2 : Math.PI / 2; grp.rotateZ(rnd() * 6.28); world.add(grp);
    // scarred rock patch (alpha-faded edges melt it into the tunnel wall)
    const patchMat = reg(toon({ map: craterTex, color: '#ad8456' }), 1);
    patchMat.alphaMap = craterAlpha; patchMat.depthWrite = false;
    const patch = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), patchMat);
    patch.userData.ndSkip = true; grp.add(patch);
    // dented crater bowl: lathe profile — recessed centre, raised lip
    const prof = [[0.001, -0.052], [0.05, -0.05], [0.10, -0.04], [0.14, -0.022], [0.175, 0.0], [0.205, 0.014]].map(([x, y]) => new THREE.Vector2(x, y));
    const bowlMat = reg(MAT.rockDk.clone(), 1); bowlMat.color.set('#7d5f3a'); bowlMat.side = THREE.DoubleSide;
    const bowlGeo = new THREE.LatheGeometry(prof, 20); bowlGeo.rotateX(Math.PI / 2);
    const bowl = new THREE.Mesh(bowlGeo, bowlMat); bowl.position.z = 0.004; bowl.userData.ndSkip = true; grp.add(bowl);
    // dark core at the bottom of the dent
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.06, 14), reg(toon({ color: '#201105' }), 1));
    hole.position.z = -0.04; hole.userData.ndSkip = true; grp.add(hole);
    // broken lip: flat rock chunks half-buried around the rim (rubble, not spikes)
    const chunkMat = reg(MAT.rockDk.clone(), 1); chunkMat.color.set('#755631');
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + rnd() * 0.5, rr = 0.155 + rnd() * 0.055;
      const ch = new THREE.Mesh(new THREE.IcosahedronGeometry(0.034 + rnd() * 0.026, 0), chunkMat);
      ch.position.set(Math.cos(a) * rr, Math.sin(a) * rr, 0.002 + rnd() * 0.012);
      ch.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); ch.scale.set(1, 0.85, 0.5);
      ch.userData.ndSkip = true; grp.add(ch);
    }
    // embedded gold: smooth chunky nuggets in the bowl + on the lip, flecks
    // beyond (spheres like the vein/pile gold — no facet ink, they read gold)
    const goldA = reg(MAT.gold.clone(), 1), goldB = reg(MAT.goldDk.clone(), 1);
    const nug = (x, y, z, r, mat) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 5), mat); m.position.set(x, y, z); m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); m.scale.set(0.85 + rnd() * 0.4, 0.75 + rnd() * 0.35, 0.55 + rnd() * 0.25); m.userData.ndSkip = true; grp.add(m); };
    nug(0.01, 0.0, -0.012, 0.062, goldA); nug(-0.06, 0.05, -0.016, 0.048, goldA); nug(0.065, -0.045, -0.014, 0.043, goldA);
    for (let i = 0; i < 5; i++) { const a = rnd() * 6.28, rr = 0.13 + rnd() * 0.09; nug(Math.cos(a) * rr, Math.sin(a) * rr, 0.014 + rnd() * 0.014, 0.03 + rnd() * 0.022, goldA); }
    for (let i = 0; i < 5; i++) { const a = rnd() * 6.28, rr = 0.28 + rnd() * 0.24; nug(Math.cos(a) * rr, Math.sin(a) * rr, 0.004, 0.014 + rnd() * 0.01, rnd() > 0.4 ? goldA : goldB); }
    // two small glints only — the flat dot/star splat look is gone
    for (let i = 0; i < 2; i++) {
      const st = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.13), smat);
      st.position.set((rnd() - 0.5) * 0.2, (rnd() - 0.5) * 0.2, 0.045); st.userData.ndSkip = true; grp.add(st);
    }
  }
}
const pileGlints = [];
{
  let seed = 13; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pile = (x, z, s, flat) => {
    const pg = new THREE.Group(); pg.position.set(x, 0, z); world.add(pg);
    for (let i = 0; i < 13; i++) {
      const a = rnd() * 6.28, rr = rnd() * 0.4 * s, sz = 0.09 + rnd() * 0.1;
      const m = add(new THREE.SphereGeometry(sz, 8, 6), rnd() > 0.4 ? MAT.gold : MAT.goldDk, Math.cos(a) * rr, sz * 0.5 + (rr < 0.16 * s ? sz * 0.7 : 0), Math.sin(a) * rr, pg, { cast: false });
      m.scale.set(1, flat ? 0.45 : 0.75, 1);
    }
    for (let i = 0; i < 2; i++) {
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshBasicMaterial({ map: sparkTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide }));
      gl.position.set(x + (rnd() - 0.5) * 0.5, 0.32 + rnd() * 0.2, z + (rnd() - 0.5) * 0.5);
      gl.userData.phase = rnd() * 6.28; gl.userData.ndSkip = true;
      world.add(gl); pileGlints.push(gl);
    }
  };
  pile(3.3, 14.9, 1, false);
  pile(-2.7, -6.5, 1.1, false);
  pile(0.85, 0.7, 0.8, true);
}
const fuseSpark = softGlow(0.3, '#ffd27a', 0); fuseSpark.position.set(2.95, 1.02, -30.6); world.add(fuseSpark);

// ---------- the loading-insert rig: work crate + break-action shotgun ----------
// The crate is permanent set dressing near the entrance; the rig (shotgun
// broken open on the crate top, spare shells, the gold pouch) appears only
// for the `insert` shot, posed per-frame by worldAt's load keys.
{
  const crateG = new THREE.Group(); crateG.position.set(2.02, 0, 2.32); crateG.rotation.y = -0.35; world.add(crateG);
  add(tbox(0.95, 0.75, 0.7, 2), MAT.wood, 0, 0.375, 0, crateG, { cast: false });
  add(tbox(1.0, 0.05, 0.75, 2), MAT.woodDk, 0, 0.775, 0, crateG, { cast: false });
}
const loadG = new THREE.Group(); loadG.position.set(2.02, 0.8, 2.32); loadG.rotation.y = -0.5; world.add(loadG);
const loadParts = { fills: [] };
{
  const g = loadG;
  // THE INSERT SUBJECT: two open shells standing on the crate, mouths up.
  // Gold pours from the pouch (resting on a wooden block behind them) into
  // shell A; a nugget drops into shell B; the opened shotgun lies behind.
  // A shell = brass base + red tube + dark mouth + gold fill disc (fillK).
  const mkShell = (sx, sz, tipped) => {
    const sg = new THREE.Group(); sg.position.set(sx, tipped ? 0.03 : 0, sz); if (tipped) sg.rotation.z = Math.PI / 2; g.add(sg);
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.022, 10), MAT.goldDk, 0, 0.011, 0, sg, { cast: false });
    add(new THREE.CylinderGeometry(0.028, 0.028, 0.06, 10), MAT.red, 0, 0.052, 0, sg, { cast: false });
    if (!tipped) {
      const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.024, 10), MAT.dark);
      mouth.position.set(0, 0.0835, 0); mouth.rotation.x = -Math.PI / 2; sg.add(mouth);
      const fillMat = MAT.gold.clone(); fillMat.transparent = true; fillMat.opacity = 0;
      const fill = new THREE.Mesh(new THREE.SphereGeometry(0.0235, 10, 6), fillMat);
      fill.scale.y = 0.38; fill.position.set(0, 0.0825, 0); fill.userData.ndSkip = true; sg.add(fill); loadParts.fills.push(fillMat);
    }
    return sg;
  };
  loadParts.shellA = mkShell(-0.02, 0.20, false);
  loadParts.shellB = mkShell(0.13, 0.24, false);
  mkShell(0.235, 0.10, true);
  // (the insert stays tight on shells + gold; in `loadgun` shells A and B
  // are picked up from this crate — crateA/crateB hide them at the pickup
  // frames — and travel into the open gun, see travShells below)
  // the gold pouch rests on a low wooden block, neck tipped over shell A —
  // a CLOTH SACK: lumpy woven body, gathered fold neck, rope tie (not a rock)
  add(tbox(0.24, 0.16, 0.26, 2), MAT.wood, -0.06, 0.08, -0.02, g, { cast: false });
  const pouch = new THREE.Group(); pouch.position.set(-0.06, 0.235, -0.02); g.add(pouch); loadParts.pouch = pouch;
  {
    let sd = 53; const srnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    const bodyGeo = new THREE.SphereGeometry(0.098, 14, 11);
    const bp = bodyGeo.attributes.position;
    for (let i = 0; i < bp.count; i++) { const vx = bp.getX(i), vy = bp.getY(i), vz = bp.getZ(i); const n = 1 + (srnd() - 0.5) * 0.10; const pinch = vy > 0.03 ? 1 - 0.38 * Math.min(1, (vy - 0.03) / 0.068) : 1; bp.setXYZ(i, vx * n * pinch, vy * (vy < -0.04 ? 0.82 : n), vz * n * pinch); }
    bodyGeo.computeVertexNormals();
    const pb = add(bodyGeo, MAT.sack, 0, 0, 0, pouch, { cast: false }); pb.scale.set(1.07, 0.8, 1.0); pb.rotation.z = 0.07;
    // gathered neck: radial cloth folds, leaning toward shell A
    const neckGeo = new THREE.CylinderGeometry(0.024, 0.042, 0.042, 12, 1);
    const np = neckGeo.attributes.position;
    for (let i = 0; i < np.count; i++) { const vx = np.getX(i), vz = np.getZ(i); const s = 1 + 0.11 * Math.sin(Math.atan2(vz, vx) * 6 + 0.7); np.setX(i, vx * s); np.setZ(i, vz * s); }
    neckGeo.computeVertexNormals();
    const neck = add(neckGeo, MAT.sack, 0, 0.066, 0.012, pouch, { cast: false }); neck.rotation.x = 0.6;
    // rope tie hugging the neck base + two short hanging ends
    const rope = add(new THREE.TorusGeometry(0.040, 0.0105, 6, 14), MAT.rope, 0, 0.052, 0.006, pouch, { cast: false });
    rope.rotation.x = Math.PI / 2 + 0.6;
    const re1 = add(new THREE.CylinderGeometry(0.006, 0.005, 0.04, 5), MAT.rope, 0.026, 0.028, 0.034, pouch, { cast: false }); re1.rotation.z = 0.35; re1.rotation.x = -0.2;
    const re2 = add(new THREE.CylinderGeometry(0.006, 0.005, 0.032, 5), MAT.rope, 0.037, 0.031, 0.026, pouch, { cast: false }); re2.rotation.z = 0.6;
  }
  // the pour stream (sack mouth -> shell A mouth), aligned to the FULL-POUR
  // pose — it is only visible while pourK > 0, when the sack tips forward
  const streamMat = new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0, depthWrite: false });
  const sFrom = new THREE.Vector3(-0.06, 0.296, 0.041), sTo = new THREE.Vector3(-0.02, 0.088, 0.20);
  const sDir = sTo.clone().sub(sFrom);
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0065, sDir.length(), 6), streamMat);
  stream.position.copy(sFrom).addScaledVector(sDir, 0.5);
  stream.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), sDir.clone().normalize().negate());
  stream.userData.ndSkip = true; g.add(stream);
  loadParts.streamMat = streamMat;
  const nug = add(new THREE.SphereGeometry(0.03, 8, 6), MAT.gold, -0.02, 0.36, 0.06, g, { cast: false });
  nug.scale.set(1, 0.8, 1); nug.visible = false; loadParts.nugget = nug;
  for (const [hx, hz] of [[0.25, 0.27], [0.28, 0.21], [0.22, 0.29]]) {
    const hn = add(new THREE.SphereGeometry(0.016, 7, 5), MAT.gold, hx, 0.012, hz, g, { cast: false }); hn.scale.y = 0.7;
  }
  const gl = softGlow(0.26, '#ffe9a8', 0); gl.position.set(0.13, 0.15, 0.26); g.add(gl); loadParts.glint = gl;
  loadG.visible = false;
}

// ---------- the shotgun (3D prop, posed by story gunAt) ----------
// ROUND 3: a real BREAK-ACTION — barrel + forend pivot on a hinge group at
// z=0.10, so in `loadgun` the breech visibly OPENS (worldAt gunOpenK), the
// two filled shells slide into the chambers, and the barrel SNAPS shut.
const gunG = new THREE.Group(); world.add(gunG);
const gunParts = {};
{
  const stock = add(tbox(0.08, 0.11, 0.62, 2), MAT.gunWood, 0, -0.03, -0.28, gunG, { cast: false });
  stock.rotation.x = 0.1;
  const bg = new THREE.Group(); bg.position.set(0, 0.03, 0.10); gunG.add(bg); gunParts.barrelG = bg;
  const barrel = add(new THREE.CylinderGeometry(0.028, 0.028, 0.78, 8), MAT.ironDk, 0, 0.02, 0.32, bg, { cast: false });
  barrel.rotation.x = Math.PI / 2;
  add(tbox(0.05, 0.07, 0.3, 2), MAT.gunWood, 0, -0.03, 0.08, bg, { cast: false });
  const pin = add(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 8), MAT.ironDk, 0, 0, 0, bg, { cast: false });
  pin.rotation.z = Math.PI / 2;
  add(tbox(0.07, 0.09, 0.03, 1), MAT.ironDk, 0, 0.02, -0.02, bg, { cast: false });
  // the loaded shells seated in the chambers: brass rim at the breech face,
  // red tube forward into the barrel — visible while the breech is open
  const mkChamber = (dx) => {
    const cg = new THREE.Group(); cg.position.set(dx, 0.05, 0.115); gunG.add(cg);
    const base = add(new THREE.CylinderGeometry(0.026, 0.026, 0.02, 10), MAT.goldDk, 0, 0, -0.05, cg, { cast: false });
    base.rotation.x = Math.PI / 2;
    const tube = add(new THREE.CylinderGeometry(0.024, 0.024, 0.09, 10), MAT.red, 0, 0, 0, cg, { cast: false });
    tube.rotation.x = Math.PI / 2;
    cg.visible = false;
    return cg;
  };
  gunParts.chamA = mkChamber(-0.016);
  gunParts.chamB = mkChamber(0.016);
}
// the two filled shells IN FLIGHT: crate top -> open chamber (loadgun).
// Same build as the crate shells (brass base, red tube, domed gold fill).
const travShells = {};
{
  const mkTrav = () => {
    const sg = new THREE.Group(); world.add(sg);
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.022, 10), MAT.goldDk, 0, -0.035, 0, sg, { cast: false });
    add(new THREE.CylinderGeometry(0.028, 0.028, 0.06, 10), MAT.red, 0, 0.005, 0, sg, { cast: false });
    const fillMat = MAT.gold.clone(); fillMat.transparent = true; fillMat.opacity = 0.95;
    const fill = new THREE.Mesh(new THREE.SphereGeometry(0.0235, 10, 6), fillMat);
    fill.scale.y = 0.38; fill.position.set(0, 0.037, 0); fill.userData.ndSkip = true; sg.add(fill);
    sg.visible = false;
    return sg;
  };
  travShells.A = mkTrav();
  travShells.B = mkTrav();
}
const muzzle = softGlow(0.9, '#ffdf9e', 0); world.add(muzzle);

// ---------- the paid coin sacks ----------
const sackG = new THREE.Group(); world.add(sackG);
{
  const s1 = add(new THREE.SphereGeometry(0.23, 10, 8), MAT.cloth, -0.16, 0, 0, sackG); s1.scale.y = 0.85;
  const s2 = add(new THREE.SphereGeometry(0.2, 10, 8), MAT.cloth, 0.2, -0.02, 0.08, sackG); s2.scale.y = 0.85;
  add(new THREE.CylinderGeometry(0.05, 0.08, 0.12, 7), MAT.cloth, -0.16, 0.21, 0, sackG);
  add(new THREE.CylinderGeometry(0.05, 0.08, 0.11, 7), MAT.cloth, 0.2, 0.18, 0.08, sackG);
}
const sackGlint = softGlow(0.6, '#ffe9a8', 0); sackGlint.position.set(0, 0.2, 0.1); sackG.add(sackGlint);

// ---------- boards ----------
// The mine sign: a physical board over the entrance (transform mirrored in
// boards.json — keep in sync). Always present; eye-checked like any board.
const boardSign = textBoard([' SURE THING MINE ', ' EST. 1899 '], 5.4, 1.35, '#3a2410', '#ffe9a8');
boardSign.position.set(...SIGN_POS); world.add(boardSign); addBoardOccluder(boardSign, 5.4, 1.35, 'signK');
// SALTED-60 final board: '10 FT' painted on the foreground rock in front of
// the vein (transform mirrored in boards.json — keep in sync). Only visible
// in the final reveal (worldAt tenK); the rock itself is permanent dressing.
add(tbox(1.9, 0.75, 0.8, 2), MAT.rock, 0.17, 0.375, -28.9, world, { cast: false });
const tenBoard = textBoard(['10 FT'], 1.7, 0.58, '#4a3220', '#ffe9a8');
tenBoard.position.set(0.17, 0.58, -28.47); world.add(tenBoard); addBoardOccluder(tenBoard, 1.7, 0.58, 'tenK');

// ---------- FX: tunnel dust motes + blast dust + gold spark burst ----------
const smoke = new FX.Smoke(scene, 220); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const moteEmit = smoke.addEmitter(0, 2.2, -8, { rate: 0.4, color: 0xffe2b8, opacity: 0.06, scale: 0.5, grow: 1.2, life: 3.2, vy: 0.05, wind: 0.05 });
const blastEmit = smoke.addEmitter(0, 1.6, -30, { rate: 0, color: 0xcbb59a, opacity: 0.34, scale: 1.15, grow: 2.0, life: 2.6, vy: 0.5, wind: 0.3 });
const sparkEmit = smoke.addEmitter(0, 1.8, -30, { rate: 0, color: 0xffd76a, opacity: 0.5, scale: 0.34, grow: 0.7, life: 1.1, vy: 0.7, wind: 0.1 });
const fxClouds = new FX.Clouds(scene, { count: 5, y: 52, opacity: 0.2, color: 0xf4f6fa, drift: 0.5 });
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

// ---------- ROUND 4: word-by-word captions (the reference's signature) ----------
// Screen-space overlay rendered AFTER the dof pass: one word at a time,
// bold white with a thick black stroke, centred, baseline ~79% of frame
// height, timed from words.json (web/words.js). The word holds until the
// next word starts inside a phrase and blanks in the gaps between phrases.
// V3 shipped with NO captions at all — a first-order style element missing.
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
  // The reference's word simply HOLDS until the next word starts (this stem
  // has no narration gap longer than 0.27 s, so holding never lingers).
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
  boardSign.material.opacity = Ws.signK ?? 1; boardSign.visible = (Ws.signK ?? 1) > 0.01;
  const flick = 0.92 + 0.08 * Math.sin(f * 0.35) * Math.sin(f * 0.13 + 1.7);
  lampA.intensity = 30 * (Ws.lampK ?? 1) * flick;
  lampB.intensity = 26 * (Ws.lampK ?? 1) * (2 - flick) * 0.55 + 12 * (Ws.lampK ?? 1);
  lanternGlows.forEach((gl, i) => { gl.material.opacity = 0.34 * (Ws.lampK ?? 1) * (0.9 + 0.1 * Math.sin(f * 0.3 + i * 2.1)); });
  world.userData.lampCone.material.opacity = 0; world.userData.lampCone.visible = false;
  world.userData.lampPool.material.opacity = (Ws.coneK || 0) * 0.42;
  pileGlints.forEach((gl) => { gl.material.opacity = 0.25 + 0.55 * Math.abs(Math.sin(f * 0.09 + gl.userData.phase)); });
  lampSpot.intensity = (Ws.coneK || 0) * 60;
  const vk = Ws.veinK || 0;
  slabL.position.x = -1.72 - vk * 1.55; slabR.position.x = 1.72 + vk * 1.55;
  slabL.rotation.z = vk * 0.05; slabR.rotation.z = -vk * 0.05;
  veinLight.intensity = vk * 55 * (0.94 + 0.06 * Math.sin(f * 0.4));
  veinGlow.material.opacity = vk * 0.32;
  veinGlints.forEach((gl, i) => { gl.material.opacity = vk * (0.35 + 0.4 * Math.abs(Math.sin(f * 0.11 + i * 1.9))); });
  saltFlecks.forEach((m) => { m.material.opacity = (Ws.saltK || 0) * (0.35 + 0.65 * Math.abs(Math.sin(f * 0.07 + m.userData.phase))); });
  splatMats.forEach((s, i) => { const k = (Ws.saltP || [])[i] || 0; for (const e of s.mats) e.mat.opacity = k * e.base; s.smat.opacity = k * (0.3 + 0.5 * Math.abs(Math.sin(f * 0.11 + i * 2.1))); });
  fuseSpark.material.opacity = (Ws.fuseK || 0) * (0.5 + 0.5 * Math.abs(Math.sin(f * 0.9)));
  fuseSpark.position.set(Ws.fuseX ?? 2.95, Ws.fuseY ?? 1.02, Ws.fuseZ ?? -30.6);
  // SALTED-60 set pieces
  panG.visible = (Ws.panK || 0) > 0.01;
  if (panG.visible && panFlecks) panFlecks.rotation.y = Ws.panSwirl || 0;
  tapeM.visible = (Ws.tapeK || 0) > 0.01;
  finalG.visible = (Ws.finalK || 0) > 0.01;
  tenBoard.material.opacity = Ws.tenK ?? 0; tenBoard.visible = (Ws.tenK ?? 0) > 0.01;
  dynG.visible = (Ws.dynK || 0) > 0.01;
  if (dynG.visible) {
    dynG.position.set(Ws.dynX || 0, Ws.dynY || 0, Ws.dynZ || 0);
    dynG.rotation.set(Ws.dynRx || 0, 0, Ws.dynRz || 0);
    dynFuse.material.opacity = (Ws.fuseK || 0) * (0.5 + 0.5 * Math.abs(Math.sin(f * 0.9)));
  }
  const G = gunAt(f);
  gunG.visible = G.k > 0.01; gunG.scale.setScalar(0.85);
  if (gunG.visible) {
    gunG.position.set(G.x, G.y, G.z);
    gunG.rotation.set(G.rx || 0, G.ry || 0, G.rz || 0);
    // break-action: the barrel group tips DOWN-forward as the breech opens
    gunParts.barrelG.rotation.x = (Ws.gunOpenK || 0) * 0.52;
    const tip = new THREE.Vector3(0, 0.05, 0.85).applyEuler(gunG.rotation).add(gunG.position);
    muzzle.position.copy(tip);
    muzzle.material.opacity = (Ws.muzzleK || 0) * 0.55;
    muzzle.visible = (Ws.muzzleK || 0) > 0.02;
  } else muzzle.visible = false;
  sackG.visible = (Ws.sackK || 0) > 0.01;
  if (sackG.visible) {
    sackG.position.set(Ws.sackX, Ws.sackY, Ws.sackZ);
    sackGlint.material.opacity = (Ws.sackK || 0) * 0.7 * Math.abs(Math.sin(f * 0.09));
  }
  loadG.visible = (Ws.loadK || 0) > 0.01;
  if (loadG.visible) {
    for (const fm of loadParts.fills) fm.opacity = (Ws.fillK || 0) * 0.95;
    loadParts.streamMat.opacity = (Ws.pourK || 0) * 0.85;
    loadParts.pouch.rotation.x = 0.15 + 0.35 * (Ws.pourK || 0);
    const nt = Ws.nugT ?? -1;
    loadParts.nugget.visible = nt >= 0;
    if (nt >= 0) loadParts.nugget.position.set(-0.02 + 0.15 * nt, 0.36 - 0.265 * nt * nt, 0.06 + 0.18 * nt);
    loadParts.glint.material.opacity = (Ws.fillK || 0) * (0.14 + 0.18 * Math.abs(Math.sin(f * 0.3)));
    // shells leave the crate as the miner picks them up for the gun
    loadParts.shellA.visible = (Ws.crateA ?? 1) > 0.5;
    loadParts.shellB.visible = (Ws.crateB ?? 1) > 0.5;
  }
  // shells in flight into the open gun + seated chambers (loadgun beat)
  {
    const open = Ws.gunOpenK || 0;
    gunG.updateMatrixWorld();
    const fly = (sg, t, from, dx) => {
      const on = t > 0.001 && t < 0.999 && gunG.visible;
      sg.visible = on;
      if (!on) return;
      const tgt = gunG.localToWorld(new THREE.Vector3(dx, 0.05, 0.17));
      sg.position.set(
        from[0] + (tgt.x - from[0]) * t,
        from[1] + (tgt.y - from[1]) * t + Math.sin(t * Math.PI) * 0.34,
        from[2] + (tgt.z - from[2]) * t);
      sg.rotation.set(t * 1.25, t * 0.95, 0);
    };
    fly(travShells.A, Ws.shellAT || 0, [1.91, 0.90, 2.49], -0.016);
    fly(travShells.B, Ws.shellBT || 0, [2.02, 0.90, 2.59], 0.016);
    gunParts.chamA.visible = gunG.visible && (Ws.shellAT || 0) >= 1 && open > 0.02;
    gunParts.chamB.visible = gunG.visible && (Ws.shellBT || 0) >= 1 && open > 0.02;
  }
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
  // RUN 3: the renderer calls us in NEW-stem frames; the whole picture
  // (shots, cast, rig, light, world, fx) lives in OLD story frames, so
  // warp the frame and drive the body on it. Captions stay in NEW space
  // (drawCaption below reads words.js = new timings).
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
