import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import * as M4 from './materials.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, BOARD_POS, PATH_Z, SPLASH_F, boyAt, swimAt, boatAt, rowK } from './story.js';
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

// ---------- painted canvases ----------
const grassCanvas = (seed) => {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  let sd = seed; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#5d7d3a'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 380; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 8 + rnd() * 40;
    const gr = g.createRadialGradient(x, y, 1, x, y, r);
    gr.addColorStop(0, rnd() > 0.5 ? 'rgba(38,58,20,0.35)' : 'rgba(168,198,110,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.08 + rnd() * 0.1; g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 5200; i++) { // grass blades
    g.strokeStyle = `rgba(${40 + rnd() * 60 | 0},${90 + rnd() * 60 | 0},${30 + rnd() * 30 | 0},${0.25 + rnd() * 0.3})`;
    g.lineWidth = 1.3;
    const x = rnd() * 512, y = rnd() * 512;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 3, y - 4 - rnd() * 5); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
};
const sandCanvas = (seed) => {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  let sd = seed; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#c2a878'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 300; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 6 + rnd() * 34;
    const gr = g.createRadialGradient(x, y, 1, x, y, r);
    gr.addColorStop(0, rnd() > 0.45 ? 'rgba(120,92,52,0.4)' : 'rgba(238,220,170,0.4)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.07 + rnd() * 0.09; g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 3000; i++) { g.fillStyle = rnd() > 0.5 ? 'rgba(255,240,200,0.08)' : 'rgba(80,58,28,0.09)'; g.fillRect(rnd() * 512, rnd() * 512, 2.2, 2.2); }
  // damp banding near the waterline
  for (let i = 0; i < 7; i++) { g.fillStyle = `rgba(96,74,44,${0.05 + rnd() * 0.05})`; g.fillRect(0, rnd() * 512, 512, 3 + rnd() * 7); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
};
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
  for (let i = 0; i < 900; i++) {
    g.strokeStyle = `rgba(226,192,120,${0.10 + rnd() * 0.14})`; g.lineWidth = 1.4;
    const x = rnd() * 512, y = rnd() * 512, a = rnd() * 3.14;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 7, y + Math.sin(a) * 7); g.stroke();
  }
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
// cracked dry pond bed: polygonal crack network over baked mud
const crackCanvas = (seed) => {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  let sd = seed; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#a3804f'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 240; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 8 + rnd() * 38;
    const gr = g.createRadialGradient(x, y, 1, x, y, r);
    gr.addColorStop(0, rnd() > 0.5 ? 'rgba(80,54,24,0.25)' : 'rgba(240,214,160,0.2)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.1 + rnd() * 0.1; g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  g.strokeStyle = 'rgba(52,34,14,0.75)'; g.lineWidth = 2.2;
  for (let i = 0; i < 46; i++) { // crack polylines wandering cell to cell
    let x = rnd() * 512, y = rnd() * 512, a = rnd() * 6.28;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 5; k++) { a += (rnd() - 0.5) * 1.1; x += Math.cos(a) * (18 + rnd() * 22); y += Math.sin(a) * (18 + rnd() * 22); g.lineTo(x, y); }
    g.stroke();
  }
  g.strokeStyle = 'rgba(52,34,14,0.4)'; g.lineWidth = 1.1;
  for (let i = 0; i < 60; i++) {
    let x = rnd() * 512, y = rnd() * 512, a = rnd() * 6.28;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 3; k++) { a += (rnd() - 0.5) * 1.2; x += Math.cos(a) * 12; y += Math.sin(a) * 12; g.lineTo(x, y); }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
};
const MAT = {
  grass: toon({ map: grassCanvas(191), color: '#9db87a' }),
  sand: toon({ map: sandCanvas(77), color: '#d9c491' }),
  mud: toon({ map: mudCanvas(5, '#a97e4e'), color: '#b28a58' }),
  mudDk: toon({ map: mudCanvas(6, '#8a6538'), color: '#a37c4e' }),
  thatch: toon({ map: thatchCanvas(3), color: '#a8843e' }),
  crack: toon({ map: crackCanvas(9), color: '#c2a06a' }),
  wood: texM(M4.woodV4(4), 1, 2), woodDk: texM(M4.woodV4(6), 1, 2),
  leaf: toon({ color: '#3d6b35' }), leafDk: toon({ color: '#2c5227' }),
  trunk: texM(M4.woodV4(9), 1, 3, '#8a6a4a'),
  stone: toon({ color: '#7d8a80' }),
  stoneDk: toon({ color: '#5d6a62' }),
  reed: toon({ color: '#4a7d3a' }),
  dark: toon({ color: '#33302c' }),
  clothRed: toon({ color: '#b3392e' }),
};

// ---------- THE POND AT DAWN ----------
// Water x[-12.5,12.5] z[-17.7,7.3]; the stone path runs at z=-2 from
// x=-11.5 to 11.5, tops a finger under the surface. South bank: the
// ghat steps + sand (z 4.6..8.6), then grass and the village. North,
// west and east banks are mud strips with huts and trees.
const world = new THREE.Group(); scene.add(world);
{
  const g = world;
  MAT.grass.map.repeat.set(16, 16);
  const ground = flat(add(new THREE.CircleGeometry(90, 40), MAT.grass, 0, -0.06, 0, g, { cast: false }));
  ground.scale.set(1.25, 1, 1);
  // south shore: sand apron + ghat steps down to the water
  MAT.sand.map.repeat.set(7, 2);
  flat(add(new THREE.PlaneGeometry(34, 4.4), MAT.sand, 0, 0.005, 6.6, g, { cast: false }));
  for (let i = 0; i < 3; i++)
    add(tbox(6.8, 0.16 - i * 0.05, 0.62, 2), MAT.stoneDk, 0, 0.1 - i * 0.055, 5.15 + i * 0.55, g, { cast: false });
  // west / east mud shores + north bank strip
  flat(add(new THREE.PlaneGeometry(5.4, 34), MAT.sand, -14.9, 0.005, -5, g, { cast: false }));
  flat(add(new THREE.PlaneGeometry(5.4, 34), MAT.sand, 14.9, 0.005, -5, g, { cast: false }));
  flat(add(new THREE.PlaneGeometry(36, 5.6), MAT.sand, 0, 0.005, -16.9, g, { cast: false }));
  // reed beds along the water edges
  let sd2 = 47; const rnd2 = () => (sd2 = (sd2 * 16807) % 2147483647) / 2147483647;
  const reedAt = (x, z) => {
    const n = 3 + (rnd2() * 3 | 0);
    for (let i = 0; i < n; i++) {
      const r = add(new THREE.ConeGeometry(0.045, 0.9 + rnd2() * 0.7, 5), MAT.reed, x + (rnd2() - 0.5) * 0.5, 0.45, z + (rnd2() - 0.5) * 0.4, g, { cast: false });
      r.rotation.z = (rnd2() - 0.5) * 0.24;
    }
  };
  for (let x = -11.8; x <= 11.8; x += 1.7) { if (Math.abs(x) > 3.6) reedAt(x + rnd2() * 0.5, 4.55); }
  for (let z = -13; z <= 2; z += 2.3) { reedAt(-12.35, z + rnd2()); reedAt(12.35, z + rnd2() * 0.7); }
  for (let x = -11; x <= 11; x += 2.9) reedAt(x + rnd2(), -14.6);
  // scattered bank stones + grass tufts (kept off the crowd's ghat)
  for (let i = 0; i < 30; i++) {
    const sx = -16 + rnd2() * 32, sz = 5 + rnd2() * 12;
    if (Math.abs(sx) < 6 && sz < 9) continue;
    const st = add(new THREE.SphereGeometry(0.09 + rnd2() * 0.14, 7, 5), MAT.stoneDk, sx, 0.04, sz, g, { cast: false }); st.scale.set(1, 0.55, 1);
  }
  // ---- trees: the west banyan, the east peepal, two on the north bank
  const tree = (x, z, s = 1) => {
    const trunk = add(new THREE.CylinderGeometry(0.3 * s, 0.48 * s, 3.4 * s, 9), MAT.trunk, x, 1.7 * s, z, g, { cast: false }); trunk.rotation.z = 0.05;
    for (const [bx, by, bz, rz, ln] of [[0.6, 3.9, 0.2, -0.7, 1.6], [-0.7, 4.0, -0.3, 0.8, 1.5], [0.1, 4.1, 0.9, 0.2, 1.3]]) {
      const br = add(new THREE.CylinderGeometry(0.09 * s, 0.14 * s, ln * s, 6), MAT.trunk, x + bx * s, by * s, z + bz * s, g, { cast: false }); br.rotation.z = rz;
    }
    for (const [fx, fy, fz, fr, dk] of [[0.2, 4.9, -0.1, 2.3, 0], [-1.4, 4.4, 0.3, 1.7, 1], [1.7, 4.5, -0.4, 1.8, 1], [0, 5.6, 0.8, 1.6, 0], [-0.9, 5.2, -1.1, 1.5, 0]]) {
      const fol = add(new THREE.SphereGeometry(fr * s, 10, 8), dk ? MAT.leafDk : MAT.leaf, x + fx * s, fy * s, z + fz * s, g, { cast: false }); fol.scale.set(1.15, 0.72, 1.15);
    }
  };
  tree(-16.5, -2, 1.15); tree(16.5, -3, 1.05); tree(-7, -16.6, 0.85); tree(8.5, -16.9, 0.8);
  // ---- huts: two on the north bank, two behind the south village edge
  const hut = (x, z, ry, s = 1) => {
    const hg = new THREE.Group(); hg.position.set(x, 0, z); hg.rotation.y = ry; hg.scale.setScalar(s); g.add(hg);
    add(tbox(4.2, 2.9, 3.4, 2), MAT.mud, 0, 1.45, 0, hg, { cast: false });
    const r1 = add(tbox(4.8, 0.12, 2.4, 2), MAT.thatch, -1.15, 3.35, 0, hg, { cast: false }); r1.rotation.z = 0.5;
    const r2 = add(tbox(4.8, 0.12, 2.4, 2), MAT.thatch, 1.15, 3.35, 0, hg, { cast: false }); r2.rotation.z = -0.5;
    add(box(0.8, 1.6, 0.06), MAT.woodDk, 0.6, 0.8, 1.72, hg, { cast: false });
  };
  hut(-8.75, -17.75, 0.15); hut(7.75, -17.75, -0.1); hut(-11.25, 17.5, 0.5, 0.95); hut(11.25, 17.5, -0.45, 0.95);
}
// ---------- the water: shader pond + a clear twin for the reveal ----------
const waterMain = FX.makeWater({ size: 25, seg: 56, deep: 0x175d7a, shallow: 0x2f96b4, sky: 0xbfe3f2, amp: 0.035, spark: 0.8 });
waterMain.position.set(0, 0, -5.2); waterMain.material.uniforms.uSun.value.set(-0.47, 0.45, 0.76).normalize();
scene.add(waterMain);
const waterClear = new THREE.Mesh(new THREE.PlaneGeometry(25, 25), new THREE.MeshPhongMaterial({ color: 0x49b6cf, transparent: true, opacity: 0.4, shininess: 140, specular: 0xbfe8ff }));
waterClear.rotation.x = -Math.PI / 2; waterClear.position.set(0, 0.005, -5.2); waterClear.visible = false; waterClear.userData.ndSkip = true;
scene.add(waterClear);
// ---------- the pond bed: light sand under the water (seen through
// the clear twin in the reveal); in the flashback it wears the crack
// texture and IS the dry bed. Always visible — the opaque pond hides
// it the rest of the time. ----------
const bedMat = toon({ map: sandCanvas(78), color: '#c9b586' });
bedMat.map.repeat.set(8, 8);
const dryBed = flat(add(new THREE.PlaneGeometry(25, 25), bedMat, 0, -0.055, -5.2, world, { cast: false }));
bedMat.polygonOffset = true; bedMat.polygonOffsetFactor = -2; bedMat.polygonOffsetUnits = -2;
MAT.crack.polygonOffset = true; MAT.crack.polygonOffsetFactor = -2; MAT.crack.polygonOffsetUnits = -2;
MAT.crack.map.repeat.set(6, 5);
// ---------- THE STONE PATH — flat stones, tops a finger under ----------
const stoneMat = toon({ color: '#27586e' });
const stonesG = new THREE.Group(); scene.add(stonesG);
{
  let sd = 123; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  for (let x = PATH_X0_F(); x <= 11.51; x += 0.58) {
    const st = add(new THREE.BoxGeometry(0.52, 0.09, 0.62), stoneMat, x + (rnd() - 0.5) * 0.05, -0.09, PATH_Z + (rnd() - 0.5) * 0.07, stonesG, { cast: false });
    st.rotation.y = (rnd() - 0.5) * 0.3;
  }
}
function PATH_X0_F() { return -11.5; }
// the flashback's stone pile + bucket on the dry bed
const pileG = new THREE.Group(); pileG.position.set(-3.5, -0.055, -2.45); scene.add(pileG);
{
  for (let i = 0; i < 5; i++) {
    const st = add(new THREE.BoxGeometry(0.52, 0.09, 0.62), MAT.stone, (i % 2) * 0.3 - 0.15, 0.05 + Math.floor(i / 2) * 0.1, (i % 3) * 0.2 - 0.2, pileG, { cast: false });
    st.rotation.y = i * 0.4;
  }
  const bk = add(new THREE.CylinderGeometry(0.21, 0.16, 0.3, 10), MAT.woodDk, 0.75, 0.15, 0.3, pileG, { cast: false });
}
pileG.visible = false;
// the stone in the boy's hands settles into the row during the flashback
const handStone = add(new THREE.BoxGeometry(0.52, 0.09, 0.62), MAT.stone, -1.35, 0.35, PATH_Z, scene, { cast: false });
handStone.visible = false;
// ---------- the ferry boat + its oar ----------
const boatG = new THREE.Group(); scene.add(boatG);
const oarPivot = new THREE.Group();
{
  add(tbox(3.4, 0.5, 1.3, 2), MAT.wood, 0, 0, 0, boatG, { cast: true });
  const bow = add(tbox(0.9, 0.46, 1.2, 2), MAT.wood, 1.85, 0.12, 0, boatG, { cast: true }); bow.rotation.z = 0.38;
  const stern = add(tbox(0.8, 0.44, 1.2, 2), MAT.wood, -1.8, 0.11, 0, boatG, { cast: true }); stern.rotation.z = -0.34;
  add(tbox(3.55, 0.08, 1.42, 2), MAT.woodDk, 0, 0.29, 0, boatG, { cast: false });
  add(tbox(3.4, 0.34, 0.08, 2), MAT.wood, 0, 0.42, 0.61, boatG, { cast: true });
  add(tbox(3.4, 0.34, 0.08, 2), MAT.wood, 0, 0.42, -0.61, boatG, { cast: true });
  add(tbox(1.1, 0.07, 0.95, 2), MAT.woodDk, -0.6, 0.36, 0, boatG, { cast: false });
  add(tbox(1.1, 0.07, 0.95, 2), MAT.woodDk, 0.75, 0.36, 0, boatG, { cast: false });
  oarPivot.position.set(0.3, 0.42, 0.68); boatG.add(oarPivot);
  const shaft = add(new THREE.CylinderGeometry(0.035, 0.035, 2.3, 6), MAT.woodDk, 0, -0.25, 0.72, oarPivot, { cast: false });
  shaft.rotation.x = 1.05;
  const blade = add(box(0.12, 0.62, 0.05), MAT.wood, 0, -0.8, 1.65, oarPivot, { cast: false }); blade.rotation.x = 1.05;
}
// ---------- boards ----------
// The hook board: next story's question, standing on the south bank.
// Its transform is mirrored in boards.json — keep in sync. It rises at
// the start of the final shot and HOLDS at full opacity to the end.
const boardHook = textBoard(['लेकिन कल...', 'वह औरत जो बिना आग', 'के खाना पका देती थी?'], 3.9, 1.75, '#2a1a0c', '#ffe9a8', 900, { pitch: 0.24, dy: 0.02 });
boardHook.position.set(...BOARD_POS); world.add(boardHook); addBoardOccluder(boardHook, 3.9, 1.75, 'hookK');
add(tbox(0.09, 2.0, 0.09, 2), MAT.woodDk, -0.85, 0.6, 10.58, world, { cast: false });
add(tbox(0.09, 2.0, 0.09, 2), MAT.woodDk, 2.45, 0.6, 10.58, world, { cast: false });
// ---------- FX: splashes, wake rings, drifting clouds, dust motes ----------
const splashes = new FX.Splashes(scene, 420); splashes.points.userData.ndSkip = true;
const wake = new FX.Wake(scene, 60); wake.pool.forEach((p) => { p.m.userData.ndSkip = true; });
const smoke = new FX.Smoke(scene, 120); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const moteEmit = smoke.addEmitter(0, 1.6, 6.8, { rate: 0.25, color: 0xffe9b0, opacity: 0.06, scale: 0.4, grow: 1.2, life: 3.6, vy: 0.03, wind: 0.06 });
const sparkEmit = smoke.addEmitter(-7.2, 0.3, PATH_Z, { rate: 0, color: 0xbff0ff, opacity: 0.5, scale: 0.28, grow: 0.7, life: 0.9, vy: 0.45, wind: 0.03 });
const fxClouds = new FX.Clouds(scene, { count: 5, y: 58, opacity: 0.32, color: 0xffffff, drift: 0.35 });
fxClouds.items.forEach((cl) => { cl.userData.x0 = cl.position.x; cl.traverse((m) => { m.userData.ndSkip = true; }); });
let fxF = -1, prevBoyPh = 0, prevSwimPh = 0, prevRowK = 0;
const fxReset = () => {
  splashes.life.fill(-1); splashes.pos.fill(-999);
  wake.pool.forEach((p) => { p.life = -1; p.m.visible = false; });
  smoke.pool.forEach((p) => { p.life = -1; p.s.visible = false; }); smoke.emitters.forEach((e) => { e.acc = 0; });
  fxClouds.items.forEach((cl) => { cl.position.x = cl.userData.x0; });
  prevBoyPh = 0; prevSwimPh = 0; prevRowK = 0;
};
const footfall = (x, z, big) => {
  wake.drop(x, z, big ? 0.85 : 0.7);
  splashes.burst(x, 0.04, z, { n: big ? 8 : 6, power: big ? 1.9 : 1.5 });
};
const fxStepTo = (f) => {
  if (f === fxF) return;
  if (f < fxF || f > fxF + 240) { fxReset(); fxF = -1; }
  while (fxF < f) {
    fxF++; const t = fxF / 30, dt = 1 / 30, pr = fxProfileAt(fxF), Ws = worldAt(fxF);
    const b = boyAt(fxF), s = swimAt(fxF), bt = boatAt(fxF);
    // footfalls: a phase wrap = a planted step on the stones
    if (b.mode === 'run' || b.mode === 'walk') { if (b.ph < prevBoyPh - 0.4) footfall(b.x, b.z, b.mode === 'run'); prevBoyPh = b.ph; }
    if (s.mode === 'run') { if (s.ph < prevSwimPh - 0.4) footfall(s.x, s.z, false); prevSwimPh = s.ph; }
    // the leap landing + THE SPLASH + the rescue churn
    if (fxF === 696) { splashes.burst(s.x, 0.04, s.z, { n: 26, power: 3.2 }); wake.drop(s.x, s.z, 1.1); }
    if (fxF === SPLASH_F) { splashes.burst(s.x, 0.05, s.z, { n: 110, power: 6.0 }); wake.drop(s.x, s.z, 1.7); }
    if (fxF === SPLASH_F + 4 || fxF === SPLASH_F + 9) wake.drop(s.x, s.z, 1.4);
    if (fxF >= 905 && fxF <= 935 && fxF % 6 === 0) splashes.burst(s.x, 0.04, s.z, { n: 8, power: 2.0 });
    if (fxF === 955) splashes.burst(b.x, 0.04, b.z, { n: 7, power: 1.6 });
    // the ferry: a foam trail at the stern + the oar's drip-splash
    if (bt.rowing) {
      wake.trail(bt.x - 1.35, bt.z, dt, 1.15);
      const rk = rowK(fxF);
      if (prevRowK < 0.55 && rk >= 0.55) splashes.burst(bt.x + 0.25, 0.03, bt.z + 0.8, { n: 5, power: 1.1 });
      prevRowK = rk;
    }
    moteEmit.rate = pr.moteRate * 3;
    sparkEmit.rate = pr.sparkRate * 3;
    splashes.update(t, dt); wake.update(t, dt); smoke.update(t, dt); fxClouds.update(t, dt);
    waterMain.userData.update(t);
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
const stoneColA = new THREE.Color('#27586e'), stoneColB = new THREE.Color('#9aa08e'), stoneColTmp = new THREE.Color();
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
  // the reveal: swap the opaque pond for its clear twin as stonesK rises
  const sk = Ws.stonesK ?? 0;
  waterMain.visible = sk < 0.5 && (Ws.dryK ?? 0) < 0.5;
  waterClear.visible = sk >= 0.5 && (Ws.dryK ?? 0) < 0.5;
  waterClear.material.opacity = 0.34 + 0.13 * sk;
  stoneMat.color.copy(stoneColTmp.copy(stoneColA).lerp(stoneColB, sk));
  // the flashback: dry bed, the pile, and the stone settling into the row
  const dry = (Ws.dryK ?? 0) > 0.5;
  if (dry) { waterMain.visible = false; waterClear.visible = false; }
  dryBed.visible = sk >= 0.5 || dry; dryBed.material = dry ? MAT.crack : bedMat; pileG.visible = dry;
  handStone.visible = dry;
  if (dry) {
    const u = Math.min(1, Math.max(0, (f - 1160) / 40));
    handStone.position.set(-1.35, 0.35 - u * 0.35, PATH_Z);
    handStone.rotation.y = 0.15 * (1 - u);
  }
  // the ferry rides its lane, oar sweeping with the stroke cycle
  const bt = boatAt(f);
  boatG.position.set(bt.x, 0.03 * Math.sin(f * 0.13) + 0.01, bt.z);
  boatG.rotation.set(0, bt.ry, bt.rowing ? 0.02 * Math.sin(f * 0.11) : 0);
  oarPivot.rotation.x = (Ws.rowA ?? 0) * 0.45;
  oarPivot.rotation.z = -0.12 + 0.1 * Math.sin(rowK(f) * Math.PI * 2);
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
  drawCaption(f);
  renderer.autoClear = false; renderer.render(capScene, fsCam); renderer.autoClear = true;
  return true;
};
window.TOTAL = TOTAL;
window.ready = true;
