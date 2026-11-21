import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import * as M4 from './materials.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, BOARD_POS, TUBE_POS } from './story.js';
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
const setBeam = (mesh, a, b) => {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  mesh.position.copy(a).addScaledVector(d, 0.5);
  mesh.scale.set(1, len, 1);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
};

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
  for (let i = 0; i < 5200; i++) {
    g.strokeStyle = `rgba(${40 + rnd() * 60 | 0},${90 + rnd() * 60 | 0},${30 + rnd() * 30 | 0},${0.25 + rnd() * 0.3})`;
    g.lineWidth = 1.3;
    const x = rnd() * 512, y = rnd() * 512;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 3, y - 4 - rnd() * 5); g.stroke();
  }
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
const pageCanvas = () => {
  // the harbour master's almanac: two cream pages of ruled tables
  // and one big confident sun — the book that is never wrong.
  const c = document.createElement('canvas'); c.width = 512; c.height = 384;
  const g = c.getContext('2d');
  g.fillStyle = '#e9dcba'; g.fillRect(0, 0, 512, 384);
  g.fillStyle = '#d9c69c'; g.fillRect(248, 0, 16, 384);
  g.strokeStyle = 'rgba(70,50,30,0.55)'; g.lineWidth = 2;
  for (let p = 0; p < 2; p++) {
    const x0 = p * 256 + 26;
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
const netCanvas = () => {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(38,58,44,0.9)'; g.lineWidth = 2;
  for (let i = 0; i <= 256; i += 32) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 16, 256); g.stroke();
    g.beginPath(); g.moveTo(i + 16, 0); g.lineTo(i, 256); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
};
const MAT = {
  grass: toon({ map: grassCanvas(191), color: '#8ba371' }),
  dirt: toon({ map: mudCanvas(31, '#9a7a4a'), color: '#b08e5c' }),
  stone: texM(M4.stoneV4(8), 1, 1, '#aeb6ba'),
  stoneWet: texM(M4.stoneV4(9), 1, 1, '#5f6a70'),
  thatch: toon({ map: thatchCanvas(3), color: '#a8843e' }),
  wood: texM(M4.woodV4(4), 1, 2), woodDk: texM(M4.woodV4(6), 1, 2),
  plank: texM(M4.woodV4(11), 1, 1, '#9a7c58'), plankDk: texM(M4.woodV4(13), 1, 1, '#7d6244'),
  leaf: toon({ color: '#46683c' }), leafDk: toon({ color: '#334f2e' }),
  trunk: texM(M4.woodV4(9), 1, 3, '#8a6a4a'),
  reed: toon({ color: '#557d40' }), reedDk: toon({ color: '#42632f' }),
  dark: toon({ color: '#33302c' }),
  rope: toon({ color: '#7d6242' }),
  brass: new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.9, roughness: 0.32, envMap, envMapIntensity: 1.1 }),
  iron: toon({ color: '#2e2a26' }),
  hullRed: toon({ color: '#8a3b2e' }), hullBlue: toon({ color: '#2f4d6e' }), hullGreen: toon({ color: '#38604a' }),
  chalk: toon({ color: '#f4f1e6' }),
  tubeWater: new THREE.MeshBasicMaterial({ color: 0xc23b22, fog: true }),
};
const wallMatMara = toon({ map: plasterCanvas(23, '#e6d3a3'), color: '#efe0ba' });
const wallMatVil = toon({ map: plasterCanvas(29, '#dcc49a'), color: '#e2d0a8' });
const wallMatOffice = toon({ map: plasterCanvas(37, '#cfd4cf'), color: '#d8dcd4' });
const doorMatMara = texM(M4.woodV4(15), 1, 1, '#6f9fd0');

// ---------- THE HARBOUR: sea WEST, quay, cottages EAST ----------
// One continuous set. The quay runs along z (-19..19) at x -3.4..3.6
// (top y=0); the sea fills x < -3.4; grass and the cottage row stand
// east of x 3.6. Mara's cottage (z ~9.5) holds the barometer in its
// west window; the harbour office stands at z -4.6; the hook board
// waits at the quay's north end (z -12.8).
const world = new THREE.Group(); scene.add(world);
const reeds = [];
const windowGlows = [];   // sprites: warm window light, driven by lampK
const windowPanes = [];   // panes: opacity driven by lampK
{
  const g = world;
  // ---- the land east of the quay
  MAT.grass.map.repeat.set(14, 14);
  flat(add(new THREE.PlaneGeometry(38, 46), MAT.grass, 22.5, -0.06, 0, g, { cast: false }));
  MAT.dirt.map.repeat.set(1, 12);
  flat(add(new THREE.PlaneGeometry(1.6, 40), MAT.dirt, 4.4, -0.02, 0, g, { cast: false }));
  // ---- the quay: stone top + a wet west face down to the water
  add(tbox(7.0, 0.3, 38, 2), MAT.stone, 0.1, -0.15, 0, g, { cast: false });
  add(tbox(0.5, 1.5, 38, 2), MAT.stoneWet, -3.62, -0.85, 0, g, { cast: false });
  add(tbox(7.0, 0.18, 1.1, 2), MAT.stoneWet, 0.1, -0.32, 19.2, g, { cast: false });
  add(tbox(7.0, 0.18, 1.1, 2), MAT.stoneWet, 0.1, -0.32, -19.2, g, { cast: false });
  // scattered stones + crates + a barrel (set dressing, clear of actors)
  let sd2 = 91; const rnd2 = () => (sd2 = (sd2 * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 22; i++) {
    const sx = -3 + rnd2() * 6.2, sz = -18 + rnd2() * 36;
    if (Math.abs(sz) < 3 && sx > -1) continue;
    const st = add(new THREE.SphereGeometry(0.07 + rnd2() * 0.11, 7, 5), MAT.stoneWet, sx, 0.03, sz, g, { cast: false }); st.scale.set(1, 0.55, 1);
  }
  const crate1 = FX.crate(0.95); crate1.position.set(3.0, 0.48, -8.7); g.add(crate1);
  const crate2 = FX.crate(0.8); crate2.position.set(2.2, 0.4, -9.3); crate2.rotation.y = 0.4; g.add(crate2);
  const barrel1 = FX.barrel(0.34, 0.95); barrel1.position.set(-3.0, 0.48, 8.9); g.add(barrel1);
  crate1.traverse((m) => { m.castShadow = false; }); crate2.traverse((m) => { m.castShadow = false; }); barrel1.traverse((m) => { m.castShadow = false; });
  // ---- trees behind the cottages
  const tree = (x, z, s = 1) => {
    const trunk = add(new THREE.CylinderGeometry(0.26 * s, 0.42 * s, 3.2 * s, 9), MAT.trunk, x, 1.6 * s, z, g, { cast: false }); trunk.rotation.z = 0.05;
    for (const [fx, fy, fz, fr, dk] of [[0.2, 4.6, -0.1, 2.1, 0], [-1.3, 4.1, 0.3, 1.6, 1], [1.6, 4.2, -0.4, 1.7, 1], [0, 5.3, 0.8, 1.5, 0]]) {
      const fol = add(new THREE.SphereGeometry(fr * s, 10, 8), dk ? MAT.leafDk : MAT.leaf, x + fx * s, fy * s, z + fz * s, g, { cast: false }); fol.scale.set(1.15, 0.72, 1.15);
    }
  };
  tree(13.5, 13.5, 1.1); tree(14.5, 3.5, 0.95); tree(13.8, -9.5, 1.05); tree(16, -3, 0.85);
  // ---- reed tufts along the land edge (they sway in the one wind)
  for (let z = -17; z <= 17; z += 2.6) {
    const tuft = new THREE.Group(); tuft.position.set(5.6 + rnd2() * 1.4, 0, z + (rnd2() - 0.5) * 0.9); g.add(tuft);
    for (let k = 0; k < 4; k++) {
      const blade = add(new THREE.ConeGeometry(0.045, 0.8 + rnd2() * 0.5, 5), k % 2 ? MAT.reed : MAT.reedDk, (rnd2() - 0.5) * 0.3, 0.4, (rnd2() - 0.5) * 0.3, tuft, { cast: false });
      blade.rotation.z = (rnd2() - 0.5) * 0.24; blade.rotation.x = (rnd2() - 0.5) * 0.2;
    }
    reeds.push({ g: tuft, ph: rnd2() * 6.28 });
  }
  // ---- bollards (the fleet's mooring points)
  for (const bz of [6, -0.5, -7]) {
    add(new THREE.CylinderGeometry(0.11, 0.13, 0.6, 10), MAT.iron, -2.95, 0.3, bz, g, { cast: false });
    add(new THREE.TorusGeometry(0.115, 0.028, 6, 14), MAT.iron, -2.95, 0.52, bz, g, { cast: false }).rotation.x = Math.PI / 2;
  }
  // ---- the harbour lamp (lampK drives its glow)
  add(new THREE.CylinderGeometry(0.06, 0.09, 2.6, 8), MAT.iron, -2.8, 1.3, -4.2, g, { cast: false });
  add(tbox(0.3, 0.38, 0.3, 2), MAT.iron, -2.8, 2.72, -4.2, g, { cast: false });
  add(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: true }), -2.8, 2.72, -4.2, g, { cast: false });
}
// ---------- cottage builder ----------
// Walls with a thatched roof, a west door and one west window whose
// warm pane + glow sprite answer to lampK. Chimney position is
// returned for the smoke emitters.
const glowTexW = P.tex(P.radial('255,205,130', 0.85));
const buildCottage = ({ x, z, w, d, h = 3.0, wallMat, doorMat = null, winZ = null, chimney = true }) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
  add(tbox(w, h, d, 2), wallMat, w / 2, h / 2, d / 2, g, { cast: false });
  const r1 = add(tbox(w + 0.7, 0.12, d / 2 + 0.55, 2), MAT.thatch, w / 2, h + 0.62, d / 4 - 0.1, g, { cast: false }); r1.rotation.x = 0.62;
  const r2 = add(tbox(w + 0.7, 0.12, d / 2 + 0.55, 2), MAT.thatch, w / 2, h + 0.62, d * 0.75 + 0.1, g, { cast: false }); r2.rotation.x = -0.62;
  add(tbox(w + 0.8, 0.14, 0.3, 2), MAT.woodDk, w / 2, h + 1.18, d / 2, g, { cast: false });
  // door on the west face
  add(tbox(0.07, 2.05, 0.95, 2), doorMat || MAT.woodDk, -0.02, 1.02, d * 0.22, g, { cast: false });
  add(new THREE.SphereGeometry(0.045, 8, 6), MAT.brass, -0.08, 1.02, d * 0.22 + 0.32, g, { cast: false });
  // window on the west face: frame, warm pane, glow sprite
  const wz = winZ !== null ? winZ : d / 2;
  add(tbox(0.09, 1.5, 1.14, 2), MAT.woodDk, -0.02, 1.55, wz, g, { cast: false });
  const pane = add(new THREE.PlaneGeometry(0.94, 1.3), new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.3, fog: true }), -0.075, 1.55, wz, g, { cast: false });
  pane.rotation.y = -Math.PI / 2; pane.userData.ndSkip = true; windowPanes.push(pane);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexW, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  spr.position.set(x - 0.25, 1.55, z + wz); spr.scale.set(1.7, 1.7, 1); spr.userData.ndSkip = true; spr.renderOrder = 3; world.add(spr);
  windowGlows.push(spr);
  let chim = null;
  if (chimney) { chim = [x + w * 0.62, h + 1.05, z + d * 0.68]; add(tbox(0.55, 1.5, 0.55, 2), MAT.stoneWet, w * 0.62, h + 0.55, d * 0.68, g, { cast: false }); }
  return { g, chim };
};
const cotMara = buildCottage({ x: 4.6, z: 6.9, w: 4.2, d: 5.2, h: 3.0, wallMat: wallMatMara, doorMat: doorMatMara, winZ: 2.6 });
const cotVilA = buildCottage({ x: 5.4, z: 1.9, w: 5.0, d: 4.6, h: 3.0, wallMat: wallMatVil, winZ: 2.3 });
const cotVilB = buildCottage({ x: 5.6, z: -1.2, w: 5.4, d: 3.0, h: 3.0, wallMat: wallMatVil, winZ: 1.5 });
const CHIMNEYS = [cotMara.chim, cotVilA.chim, cotVilB.chim].filter(Boolean);
// Mara's porch: a lean-to slab on the cottage post + her net frame
{
  const g = world;
  const slab = add(tbox(1.5, 0.07, 3.4, 2), MAT.thatch, 3.95, 2.52, 9.6, g, { cast: false }); slab.rotation.z = 0.18;
  add(tbox(0.09, 2.4, 0.09, 2), MAT.woodDk, 4.35, 1.2, 10.55, g, { cast: false });
  // net-mending A-frame with a draped fishing net, by her door
  const nf = new THREE.Group(); nf.position.set(3.15, 0, 10.9); nf.rotation.y = 0.5; g.add(nf);
  const p1 = add(new THREE.CylinderGeometry(0.035, 0.035, 1.6, 7), MAT.wood, -0.55, 0.75, 0, nf, { cast: false }); p1.rotation.z = 0.35;
  const p2 = add(new THREE.CylinderGeometry(0.035, 0.035, 1.6, 7), MAT.wood, 0.55, 0.75, 0, nf, { cast: false }); p2.rotation.z = -0.35;
  const net = add(new THREE.PlaneGeometry(1.15, 1.05, 1, 1), new THREE.MeshBasicMaterial({ map: (() => { const t = netCanvas(); t.repeat.set(3, 3); return t; })(), transparent: true, side: THREE.DoubleSide, fog: true }), 0, 0.78, 0.02, nf, { cast: false });
  net.userData.ndSkip = true;
}
// ---------- THE LAMP + BOWL RIG (on the ghat slab) ----------
// A flat stone slab at the water's edge; on it a clay lamp (dish,
// oil pool, cotton wick) and the flame: core + halo sprites and a
// warm PointLight — brightest at the source, soft falloff, so the
// flame lights the slab, the glass and the water around it. The
// big glass bowl rests beside the lamp, is lifted over it, then
// the whole unit travels down through the waterline (the story's
// tracks drive lampGroup + bowlGroup every frame). Bubbles leak
// and rise past the bowl as it settles; a ripple band rings the
// bowl at the waterline crossing.
const lampGroup = new THREE.Group(); scene.add(lampGroup);
const bowlGroup = new THREE.Group(); scene.add(bowlGroup);
let flameCore, flameHalo, flameLight, bandMesh;
const bubblePool = [];
const boatLampGlows = [];
{
  add(tbox(1.5, 0.16, 1.5, 2), MAT.stone, -2.55, 0.08, 3.9, world, { cast: false }); // the ghat slab
  add(new THREE.CylinderGeometry(0.17, 0.1, 0.07, 12), toon({ color: '#a85f2e' }), 0, 0.035, 0, lampGroup, { cast: false }); // clay dish
  add(new THREE.CylinderGeometry(0.13, 0.13, 0.015, 12), toon({ color: '#5d3c14' }), 0, 0.075, 0, lampGroup, { cast: false }); // oil pool
  add(new THREE.SphereGeometry(0.028, 6, 5), MAT.chalk, 0, 0.095, 0, lampGroup, { cast: false }); // cotton wick
  flameCore = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexW, color: 0xffe9a8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  flameCore.position.set(0, 0.24, 0); flameCore.scale.set(0.22, 0.34, 1); flameCore.userData.ndSkip = true; flameCore.renderOrder = 4; lampGroup.add(flameCore);
  flameHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexW, color: 0xff9a3c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  flameHalo.position.set(0, 0.22, 0); flameHalo.scale.set(0.85, 0.85, 1); flameHalo.userData.ndSkip = true; flameHalo.renderOrder = 3; lampGroup.add(flameHalo);
  flameLight = new THREE.PointLight(0xffa845, 0, 7, 1.6); flameLight.position.set(0, 0.3, 0); lampGroup.add(flameLight);
  const glass = FX.glassMat(0xcfeef5, 0.4);
  const dome = add(new THREE.SphereGeometry(0.46, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), glass, 0, 0, 0, bowlGroup, { cast: false });
  dome.userData.ndSkip = true;
  const rim = add(new THREE.TorusGeometry(0.46, 0.022, 8, 24), glass, 0, 0, 0, bowlGroup, { cast: false });
  rim.rotation.x = Math.PI / 2; rim.userData.ndSkip = true;
  // the insert's small things, resting on the slab beside the lamp
  const spoon = add(new THREE.SphereGeometry(0.055, 8, 6), MAT.brass, -2.12, 0.19, 4.32, world, { cast: false }); spoon.scale.set(1, 0.35, 1.5);
  add(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 8), MAT.brass, -2.06, 0.19, 4.44, world, { cast: false }).rotation.z = Math.PI / 2;
  const wickRoll = add(new THREE.CylinderGeometry(0.045, 0.045, 0.07, 10), MAT.chalk, -2.86, 0.2, 4.35, world, { cast: false }); wickRoll.rotation.x = 0.4;
  // the waterline band (ripple ring at the crossing)
  bandMesh = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.028, 8, 28), new THREE.MeshBasicMaterial({ color: 0xdff4ff, transparent: true, opacity: 0, fog: true }));
  bandMesh.rotation.x = Math.PI / 2; bandMesh.userData.ndSkip = true; bandMesh.renderOrder = 2; scene.add(bandMesh);
  // bubbles: pale sprites that leak and rise past the bowl
  const bubTex = P.tex(P.radial('210,235,255', 0.8));
  let sd = 13; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 16; i++) {
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubTex, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    spr.userData.ndSkip = true; spr.renderOrder = 3; scene.add(spr);
    bubblePool.push({ s: spr, ph: rnd(), off: (rnd() - 0.5) * 0.7 });
  }
}
// ---------- the harbour office + awning + the almanac lectern ----------
{
  const g = world;
  add(tbox(6.9, 3.4, 6.0, 2), wallMatOffice, 8.05, 1.7, -4.6, g, { cast: false });
  const r1 = add(tbox(7.6, 0.12, 3.6, 2), MAT.thatch, 8.05, 3.95, -6.05, g, { cast: false }); r1.rotation.x = 0.6;
  const r2 = add(tbox(7.6, 0.12, 3.6, 2), MAT.thatch, 8.05, 3.95, -3.15, g, { cast: false }); r2.rotation.x = -0.6;
  add(tbox(0.07, 2.2, 1.0, 2), MAT.woodDk, 4.58, 1.1, -4.6, g, { cast: false }); // door, west face
  add(tbox(0.09, 1.3, 1.0, 2), MAT.woodDk, 4.58, 1.85, -2.9, g, { cast: false }); // window frame
  const pane = add(new THREE.PlaneGeometry(0.84, 1.14), new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.3, fog: true }), 4.52, 1.85, -2.9, g, { cast: false });
  pane.rotation.y = -Math.PI / 2; pane.userData.ndSkip = true; windowPanes.push(pane);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexW, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  spr.position.set(4.35, 1.85, -2.9); spr.scale.set(1.5, 1.5, 1); spr.userData.ndSkip = true; spr.renderOrder = 3; g.add(spr);
  windowGlows.push(spr);
  // the awning the watchers shelter under in the storm
  const awn = add(tbox(2.2, 0.06, 4.4, 2), MAT.thatch, 3.6, 2.62, -4.5, g, { cast: false }); awn.rotation.z = 0.16;
  add(tbox(0.08, 2.45, 0.08, 2), MAT.woodDk, 2.7, 1.22, -2.6, g, { cast: false });
  add(tbox(0.08, 2.45, 0.08, 2), MAT.woodDk, 2.7, 1.22, -6.6, g, { cast: false });
  // the lectern with the great almanac, outside the office door
  const lg = new THREE.Group(); lg.position.set(2.55, 0, -3.3); lg.rotation.y = 0.35; g.add(lg);
  add(tbox(0.12, 1.02, 0.12, 2), MAT.woodDk, 0, 0.51, 0, lg, { cast: false });
  add(tbox(0.7, 0.05, 0.55, 2), MAT.wood, 0, 1.0, 0, lg, { cast: false });
  const book = new THREE.Group(); book.position.set(0, 1.06, 0); book.rotation.z = -0.38; lg.add(book);
  add(tbox(0.66, 0.07, 0.5, 2), MAT.hullRed, 0, 0, 0, book, { cast: false });
  const pages = add(new THREE.PlaneGeometry(0.6, 0.44), new THREE.MeshBasicMaterial({ map: pageCanvas(), fog: true }), 0, 0.045, 0, book, { cast: false });
  pages.rotation.x = -Math.PI / 2; pages.userData.ndSkip = true;
}
// ---------- boards ----------
// The hook board at the quay's north end: next story's question.
// Transform mirrored in boards.json — keep in sync. It rises at the
// start of the final shot and HOLDS at full opacity to the literal
// final frame. English text — no fit regime needed.
const boardHook = textBoard(['But tomorrow…', 'the boy who boiled water', 'in a paper cup?'], 3.9, 1.75, '#2a1a0c', '#ffe9a8', 900);
boardHook.position.set(...BOARD_POS); world.add(boardHook); addBoardOccluder(boardHook, 3.9, 1.75, 'hookK');
add(tbox(0.09, 2.6, 0.09, 2), MAT.woodDk, -0.75, 1.0, -12.9, world, { cast: false });
add(tbox(0.09, 2.6, 0.09, 2), MAT.woodDk, 1.15, 1.0, -12.9, world, { cast: false });

// ---------- the sea ----------
const water = FX.makeWater({ size: 96, seg: 72, deep: 0x14506e, shallow: 0x3d9db4, sky: 0xc3d5dd, amp: 0.16, spark: 0 });
water.position.set(-51.6, -0.85, 0); water.userData.ndSkip = true; scene.add(water);
add(new THREE.PlaneGeometry(96, 96), toon({ color: '#16242e' }), -51.6, -1.7, 0, scene, { cast: false }).rotation.x = -Math.PI / 2;
// the SAME wave the water shader draws (world xz, t, amp) — boats
// ride it, so hull and surface never disagree.
const waveH = (x, z, t, amp) => (Math.sin(x * 0.11 + t * 1.15) * 0.45 + Math.sin(z * 0.16 - t * 0.85) * 0.32 + Math.sin((x + z) * 0.055 + t * 0.5) * 0.55) * amp;
// ---------- THE FLEET: three moored fishing boats ----------
// Hull, gunwale rails, benches, a mast with a furled sail, nets and
// crates aboard. Each boat is tied to its bollard by a rope that is
// re-strung every frame between bollard top and boat cleat.
const buildBoat = (hullMat) => {
  const g = new THREE.Group(); scene.add(g);
  add(tbox(1.5, 0.52, 3.9, 2), hullMat, 0, 0.1, 0, g, { cast: true });
  const bow = add(new THREE.CylinderGeometry(0.02, 0.75, 1.1, 4, 1), hullMat, 0, 0.12, -2.35, g, { cast: false });
  bow.rotation.x = Math.PI / 2; bow.rotation.y = Math.PI / 4; bow.scale.set(1, 1, 0.62);
  add(tbox(1.62, 0.09, 4.0, 2), MAT.woodDk, 0, 0.4, 0, g, { cast: false });
  add(tbox(1.3, 0.07, 0.3, 2), MAT.plank, 0, 0.32, -1.1, g, { cast: false });
  add(tbox(1.3, 0.07, 0.3, 2), MAT.plank, 0, 0.32, 0.9, g, { cast: false });
  add(new THREE.CylinderGeometry(0.05, 0.07, 2.6, 8), MAT.wood, 0, 1.6, -0.4, g, { cast: false });
  const sail = add(new THREE.ConeGeometry(0.3, 1.9, 7), MAT.chalk, 0.12, 1.35, -0.4, g, { cast: false }); sail.scale.set(0.55, 1, 1);
  const netB = add(new THREE.SphereGeometry(0.42, 8, 6), MAT.reedDk, -0.3, 0.5, 1.35, g, { cast: false }); netB.scale.set(1, 0.6, 1);
  add(tbox(0.55, 0.4, 0.55, 2), MAT.plankDk, 0.35, 0.55, 1.5, g, { cast: false });
  // the evening passenger: a little lamp under a small glass bowl
  // on the aft deck — its glow answers to boatLampK (story).
  add(new THREE.CylinderGeometry(0.09, 0.06, 0.05, 10), toon({ color: '#a85f2e' }), 0.25, 0.42, 0.9, g, { cast: false });
  const bdome = add(new THREE.SphereGeometry(0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), FX.glassMat(0xcfeef5, 0.4), 0.25, 0.44, 0.9, g, { cast: false });
  bdome.userData.ndSkip = true;
  const bglow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexW, color: 0xffb45e, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  bglow.position.set(0.25, 0.55, 0.9); bglow.scale.set(0.65, 0.65, 1); bglow.userData.ndSkip = true; bglow.renderOrder = 3; g.add(bglow);
  boatLampGlows.push(bglow);
  return g;
};
const boats = [
  { g: buildBoat(MAT.hullRed), x: -6.8, z: 6.4, bollard: [-2.95, 0.62, 6] },
  { g: buildBoat(MAT.hullBlue), x: -5.6, z: 0.6, bollard: [-2.95, 0.62, -0.5] },
  { g: buildBoat(MAT.hullGreen), x: -6.8, z: -6.4, bollard: [-2.95, 0.62, -7] },
];
const boatRopes = boats.map(() => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 1, 6), MAT.rope);
  m.castShadow = false; scene.add(m); return m;
});
// ---------- the gulls (L8): one inland stream ----------
// Body, head, beak and two flapping wings; the flock follows
// story.gullK across the sky and is gone outside its window.
const gulls = [];
{
  const gullMat = toon({ color: '#eef2f0' }), gullDk = toon({ color: '#9aa5a8' });
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group(); scene.add(g);
    const body = add(new THREE.SphereGeometry(0.16, 8, 6), gullMat, 0, 0, 0, g, { cast: false }); body.scale.set(1.9, 0.8, 0.85);
    add(new THREE.SphereGeometry(0.09, 8, 6), gullMat, 0.3, 0.05, 0, g, { cast: false });
    const beak = add(new THREE.ConeGeometry(0.035, 0.16, 6), MAT.clothGold ?? toon({ color: '#d9a441' }), 0.44, 0.04, 0, g, { cast: false }); beak.rotation.z = -Math.PI / 2;
    const wL = new THREE.Group(); wL.position.set(-0.05, 0.06, 0.1); g.add(wL);
    const wR = new THREE.Group(); wR.position.set(-0.05, 0.06, -0.1); g.add(wR);
    const pL = add(new THREE.PlaneGeometry(0.55, 0.95), gullDk, -0.05, 0, 0.48, wL, { cast: false }); pL.rotation.x = -Math.PI / 2;
    const pR = add(new THREE.PlaneGeometry(0.55, 0.95), gullDk, -0.05, 0, -0.48, wR, { cast: false }); pR.rotation.x = -Math.PI / 2;
    pL.material.side = THREE.DoubleSide; pR.material.side = THREE.DoubleSide;
    pL.userData.ndSkip = true; pR.userData.ndSkip = true;
    g.visible = false;
    gulls.push({ g, wL, wR, i });
  }
}
// ---------- the storm cloud wall ----------
// Dark sprite banks OFF the sea (x ~-52). worldAt.wallK slides the
// whole wall 34 m toward the harbour and thickens it as it swallows
// the sun through L15, holds through the storm, gone by the payoff.
const wallG = new THREE.Group(); scene.add(wallG);
const wallSprites = [];
{
  let sd = 7; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 12; i++) {
    const tex = FX.cloudTexture(i % 3);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0x39434e, transparent: true, opacity: 0.3, depthWrite: false, fog: false }));
    spr.position.set(-52 + (rnd() - 0.5) * 10, 5.5 + rnd() * 11, -27 + rnd() * 54);
    spr.scale.set(20 + rnd() * 14, 8 + rnd() * 5, 1);
    spr.userData.ndSkip = true; spr.renderOrder = 1;
    wallG.add(spr); wallSprites.push(spr);
  }
}
const fxClouds = new FX.Clouds(scene, { count: 6, y: 58, opacity: 0.32, color: 0xffffff, drift: 0.3 });
fxClouds.items.forEach((cl) => { cl.userData.x0 = cl.position.x; cl.traverse((m) => { m.userData.ndSkip = true; if (m.isSprite) m.userData.baseOp = m.material.opacity; }); });
// ---------- chimney smoke: risers + the sinking layer ----------
// ONE wind (+x) takes every wisp. Until L10 the smoke rises
// honestly (riser emitters); as sinkK grows the risers die and the
// sinkers + two flat sheets press it down onto the roofs.
const smoke = new FX.Smoke(scene, 280); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const riserOpts = { color: 0xdcdcdc, opacity: 0.3, scale: 0.85, grow: 1.9, life: 2.8, vy: 1.15, wind: 0.5, vx: 0.12 };
const sinkerOpts = { color: 0xcfcfcf, opacity: 0.26, scale: 1.15, grow: 2.3, life: 3.4, vy: -0.32, wind: 1.0, vx: 0.3 };
const risers = CHIMNEYS.map(([cx, cy, cz]) => smoke.addEmitter(cx, cy + 0.35, cz, { ...riserOpts }));
const sinkers = CHIMNEYS.map(([cx, cy, cz]) => smoke.addEmitter(cx, cy + 0.3, cz, { ...sinkerOpts }));
const sinkSheets = [];
{
  const sheetTex = P.tex(P.radial('215,215,215', 0.5));
  for (const [sx, sz] of [[7.6, 4.3], [7.9, 0.5]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 3.6), new THREE.MeshBasicMaterial({ map: sheetTex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(sx, 3.35, sz); m.userData.ndSkip = true; m.renderOrder = 1; scene.add(m); sinkSheets.push(m);
  }
}
// ---------- rain, lightning, spray, flag, coin glint ----------
const rain = new FX.Rain(scene, { count: 1100, area: 55, height: 26, cx: -2, cz: 0, y: 0, slant: -0.42, opacity: 0.75, color: 0xaebfd8 });
rain.points.userData.ndSkip = true; rain.points.visible = false;
const bolt = new FX.Lightning({ scene, from: new THREE.Vector3(-40, 30, -16), to: new THREE.Vector3(-33, 0, -12) });
if (bolt.bolt) bolt.bolt.userData.ndSkip = true;
const splashes = new FX.Splashes(scene, 240); splashes.points.userData.ndSkip = true;
let flagMesh;
{
  const pole = add(new THREE.CylinderGeometry(0.045, 0.06, 4.4, 8), MAT.woodDk, -3.05, 2.2, 12.5, world, { cast: false });
  const fc = document.createElement('canvas'); fc.width = 128; fc.height = 84;
  const fg2 = fc.getContext('2d'); fg2.fillStyle = '#a33327'; fg2.fillRect(0, 0, 128, 84);
  fg2.fillStyle = '#e8c96a'; fg2.beginPath(); fg2.arc(38, 42, 15, 0, 7); fg2.fill();
  const ftex = new THREE.CanvasTexture(fc); ftex.colorSpace = THREE.SRGBColorSpace;
  flagMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.75, 12, 6), new THREE.MeshBasicMaterial({ map: ftex, side: THREE.DoubleSide, fog: true }));
  flagMesh.geometry.translate(0.575, 0, 0);
  flagMesh.position.set(-3.05, 3.95, 12.5);
  flagMesh.userData.ndSkip = true; world.add(flagMesh);
  FX.clothInit(flagMesh, { amp: 0.16, freq: 3.2, speed: 7 });
}
const coinGlint = FX.glint(0.95);
coinGlint.position.set(-0.72, 1.02, 3.95); coinGlint.userData.ndSkip = true; coinGlint.renderOrder = 3; scene.add(coinGlint);
// ---------- FX stepping (frame-exact, reset-safe) ----------
let fxF = -1;
const fxReset = () => {
  smoke.pool.forEach((p) => { p.life = -1; p.s.visible = false; }); smoke.emitters.forEach((e) => { e.acc = 0; });
  splashes.life.fill(-1);
  fxClouds.items.forEach((cl) => { cl.position.x = cl.userData.x0; });
};
const fxStepTo = (f) => {
  if (f === fxF) return;
  if (f < fxF || f > fxF + 240) { fxReset(); fxF = -1; }
  while (fxF < f) {
    fxF++; const t = fxF / 30, dt = 1 / 30, Ws = worldAt(fxF);
    bolt.update(t);
    // chimney smoke: risers fade as the air grows heavy; the storm
    // wind tears what is left; after the storm it rises clean again.
    const riserRate = (1 - Ws.sinkK) * 3.2 * (1 - Ws.rainK * 0.85) + 0.25;
    for (const e of risers) e.rate = riserRate;
    for (const e of sinkers) e.rate = Ws.sinkK * 3.4 * (1 - Ws.rainK * 0.6);
    smoke.update(t, dt);
    // spray bursts at the boat bows while the storm swell runs
    if (Ws.rainK > 0.5 && fxF % 7 === 0) {
      const b = boats[(fxF / 7 | 0) % 3], by = waveH(b.x, b.z, t, Ws.seaK);
      splashes.burst(b.x - 0.6, by - 0.7, b.z - 1.8, { n: 9, power: 3.0 });
    }
    if (Ws.rainK > 0.5 && fxF % 11 === 0) splashes.burst(-3.3, 0.1, -6 + (fxF % 13), { n: 7, power: 2.4 });
    splashes.update(t, dt);
    fxClouds.update(t, dt);
    water.userData.update(t);
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
const wallColWarm = new THREE.Color('#efe0ba'), wallColBlue = new THREE.Color('#7d9cc4'), tmpCol = new THREE.Color();
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
  const t = f / 30;
  skyU.time.value = t;
  scene.traverse((o) => { if (o.userData.isOccluder) o.visible = o.userData.boardKey === 'always' || (Ws[o.userData.boardKey] ?? 1) > 0.01; });
  boardHook.material.opacity = Ws.hookK ?? 1; boardHook.visible = (Ws.hookK ?? 1) > 0.01;
  // the lamp + bowl rig: the story's tracks place both units;
  // the flame flickers (two crossed sines) and its light dances
  // on the slab, the glass and the water — brightest at source.
  lampGroup.position.set(Ws.lampX ?? -2.55, Ws.lampY ?? 0.17, Ws.lampZ ?? 3.9);
  bowlGroup.position.set(Ws.bowlX ?? -2.0, Ws.bowlY ?? 0.17, Ws.bowlZ ?? 4.5);
  const fk = Ws.flameK ?? 0;
  const flick = 0.82 + 0.13 * Math.sin(t * 23.7) + 0.05 * Math.sin(t * 41.3 + 1.7);
  flameCore.material.opacity = fk * 0.95 * flick;
  flameCore.scale.set(0.2 + 0.03 * Math.sin(t * 31), 0.3 * flick + 0.1, 1);
  flameHalo.material.opacity = fk * 0.5 * flick;
  flameLight.intensity = fk * (1.35 + 0.45 * Math.sin(t * 23.7));
  // the waterline band rings the bowl as it crosses the surface
  bandMesh.position.set(Ws.bowlX ?? -3.85, -0.845, Ws.bowlZ ?? 3.9);
  bandMesh.material.opacity = (Ws.bandK ?? 0) * 0.55;
  bandMesh.scale.setScalar(1 + 0.1 * Math.sin(t * 6.2));
  // bubbles leak from the rim zone and rise past the bowl
  const bk = Ws.bubbleK ?? 0;
  for (const b of bubblePool) {
    const u = (t * 0.14 + b.ph) % 1;
    b.s.visible = bk > 0.02;
    b.s.position.set((Ws.bowlX ?? -3.85) + 0.52 + Math.sin(u * 9 + b.ph * 20) * 0.07, -1.7 + u * 0.83, (Ws.bowlZ ?? 3.9) + b.off);
    b.s.material.opacity = bk * 0.5 * Math.sin(u * Math.PI);
    const sc = 0.05 + u * 0.05; b.s.scale.set(sc, sc, 1);
  }
  // evening: every boat carries a lamp now (boatLampK)
  boatLampGlows.forEach((spr, i) => { spr.material.opacity = (Ws.boatLampK ?? 0) * (0.55 + 0.15 * Math.sin(t * 19 + i * 2.4)); });
  // the sea takes the grade's colours and the beat's swell
  const L = lightFor(shotAt(f), f);
  water.material.uniforms.uDeep.value.set(L.waterDeep);
  water.material.uniforms.uShallow.value.set(L.waterShal);
  water.material.uniforms.uSky.value.set(L.fog);
  water.material.uniforms.uAmp.value = Ws.seaK ?? 0.16;
  water.material.uniforms.uSpark.value = (Ws.glintK ?? 0) * 0.8 + (Ws.seaK < 0.3 ? 0.18 : 0);
  // boats ride the same wave the shader draws; ropes re-strung
  boats.forEach((b, i) => {
    const wy = waveH(b.x, b.z, t, Ws.seaK ?? 0.16);
    b.g.position.set(b.x, wy - 0.89, b.z);
    const sx = (waveH(b.x + 1.2, b.z, t, Ws.seaK ?? 0.16) - waveH(b.x - 1.2, b.z, t, Ws.seaK ?? 0.16)) / 2.4;
    const sz = (waveH(b.x, b.z + 1.6, t, Ws.seaK ?? 0.16) - waveH(b.x, b.z - 1.6, t, Ws.seaK ?? 0.16)) / 3.2;
    b.g.rotation.z = -sx * 0.75; b.g.rotation.x = sz * 0.6;
    setBeam(boatRopes[i], new THREE.Vector3(b.bollard[0], b.bollard[1], b.bollard[2]),
      new THREE.Vector3(b.x + 1.15, wy - 0.44, b.z + (b.bollard[2] - b.z) * 0.72));
  });
  // gulls: one inland stream on gullK, wings beating
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
  // the wall comes in off the sea and thickens as it arrives
  const wk = Ws.wallK ?? 0;
  wallG.position.x = wk * 34;
  for (const spr of wallSprites) spr.material.opacity = 0.1 + wk * 0.62;
  fxClouds.items.forEach((cl) => cl.traverse((m) => { if (m.isSprite && m.userData.baseOp !== undefined) m.material.opacity = m.userData.baseOp * (1 - wk * 0.75); }));
  // the sinking smoke lies flat on the roofs
  for (const s of sinkSheets) s.material.opacity = (Ws.sinkK ?? 0) * 0.15 * (1 - (Ws.rainK ?? 0) * 0.7);
  // rain: present only while rainK runs; slant rides the one wind
  rain.points.visible = (Ws.rainK ?? 0) > 0.02;
  rain.uniforms.uOpacity.value = 0.78 * (Ws.rainK ?? 0);
  rain.uniforms.uSlant.value = -0.14 - 0.3 * (Ws.windK ?? 0.3);
  rain.update(t);
  // windows + the harbour lamp breathe with lampK
  const lk = Ws.lampK ?? 0;
  windowGlows.forEach((spr, i) => { spr.material.opacity = 0.1 + lk * 0.5 + Math.sin(t * 7 + i * 2.1) * 0.03; });
  windowPanes.forEach((p) => { p.material.opacity = 0.16 + lk * 0.55; });
  // the morning after: her cottage stands BLUE (blueK)
  tmpCol.lerpColors(wallColWarm, wallColBlue, Ws.blueK ?? 0);
  wallMatMara.color.copy(tmpCol);
  // the flag streams on the one wind; reeds sway in gusts
  FX.clothWave2(flagMesh, t, () => (Ws.windK ?? 0.3) * 0.5);
  for (const r of reeds) r.g.rotation.z = Math.sin(t * 1.25 + r.ph) * 0.04 * (1 + (Ws.windK ?? 0.3)) + Math.sin(t * 0.37 + r.ph * 2) * 0.025;
  // a coin of sun glints between their hands at the payoff
  const pr = fxProfileAt(f);
  coinGlint.material.opacity = (pr.sparkRate || 0) * (0.5 + 0.4 * Math.sin(t * 9));
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
    if (a.blob !== false && (a.y - (a.ground ?? 0)) < 0.5) { c.blob.visible = true; c.blob.position.set(a.x, (a.ground ?? 0) + 0.02, a.z); c.blob.scale.set(0.95 * s, 0.6 * s, 1); }
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
