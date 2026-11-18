import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import * as M4 from './materials.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, BOARD_POS, THALI_POS, kamlaAt, sarpanchAt, thaliTiltAt } from './story.js';
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

// ---------- THE VILLAGE CHOWK AT MIDDAY ----------
// A packed-dirt plaza (r ~7.5) in a grass field: huts north and
// south, trees, a well west. At the centre the black degchi stands
// on its iron stand; around it a ring of 8 polished thalis on stands
// (THALI_POS, r=1.7), each disc tilted up toward the sun and aimed
// at the pot — Kamla's mirror kitchen. The crowd watches from the
// south arc. The hook board stands on the south edge at z=10.5.
const world = new THREE.Group(); scene.add(world);
{
  const g = world;
  MAT.grass.map.repeat.set(16, 16);
  const ground = flat(add(new THREE.CircleGeometry(90, 40), MAT.grass, 0, -0.06, 0, g, { cast: false }));
  ground.scale.set(1.25, 1, 1);
  // the plaza: packed earth with a worn ring around the cooking spot
  const plazaMat = toon({ map: mudCanvas(31, '#a97e4e'), color: '#bb955e' });
  plazaMat.map.repeat.set(5, 5);
  flat(add(new THREE.CircleGeometry(7.6, 36), plazaMat, 0, 0.002, 0.8, g, { cast: false }));
  const apronMat = toon({ map: sandCanvas(77), color: '#d9c491' });
  apronMat.map.repeat.set(7, 2);
  flat(add(new THREE.PlaneGeometry(30, 4.2), apronMat, 0, 0.004, 6.9, g, { cast: false }));
  // scattered stones + grass tufts outside the plaza
  let sd2 = 47; const rnd2 = () => (sd2 = (sd2 * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 30; i++) {
    const sx = -16 + rnd2() * 32, sz = -14 + rnd2() * 28;
    if (Math.hypot(sx, sz - 0.8) < 8.2) continue;
    const st = add(new THREE.SphereGeometry(0.09 + rnd2() * 0.14, 7, 5), MAT.stoneDk, sx, 0.04, sz, g, { cast: false }); st.scale.set(1, 0.55, 1);
  }
  // ---- trees: west, east, one on the north edge
  const tree = (x, z, s = 1) => {
    const trunk = add(new THREE.CylinderGeometry(0.3 * s, 0.48 * s, 3.4 * s, 9), MAT.trunk, x, 1.7 * s, z, g, { cast: false }); trunk.rotation.z = 0.05;
    for (const [bx, by, bz, rz, ln] of [[0.6, 3.9, 0.2, -0.7, 1.6], [-0.7, 4.0, -0.3, 0.8, 1.5], [0.1, 4.1, 0.9, 0.2, 1.3]]) {
      const br = add(new THREE.CylinderGeometry(0.09 * s, 0.14 * s, ln * s, 6), MAT.trunk, x + bx * s, by * s, z + bz * s, g, { cast: false }); br.rotation.z = rz;
    }
    for (const [fx, fy, fz, fr, dk] of [[0.2, 4.9, -0.1, 2.3, 0], [-1.4, 4.4, 0.3, 1.7, 1], [1.7, 4.5, -0.4, 1.8, 1], [0, 5.6, 0.8, 1.6, 0], [-0.9, 5.2, -1.1, 1.5, 0]]) {
      const fol = add(new THREE.SphereGeometry(fr * s, 10, 8), dk ? MAT.leafDk : MAT.leaf, x + fx * s, fy * s, z + fz * s, g, { cast: false }); fol.scale.set(1.15, 0.72, 1.15);
    }
  };
  tree(-13, -4, 1.15); tree(13, -5, 1.05); tree(-8, -15.5, 0.85);
  // ---- huts: two on the north bank, two behind the south edge
  const hut = (x, z, ry, s = 1) => {
    const hg = new THREE.Group(); hg.position.set(x, 0, z); hg.rotation.y = ry; hg.scale.setScalar(s); g.add(hg);
    add(tbox(4.2, 2.9, 3.4, 2), MAT.mud, 0, 1.45, 0, hg, { cast: false });
    const r1 = add(tbox(4.8, 0.12, 2.4, 2), MAT.thatch, -1.15, 3.35, 0, hg, { cast: false }); r1.rotation.z = 0.5;
    const r2 = add(tbox(4.8, 0.12, 2.4, 2), MAT.thatch, 1.15, 3.35, 0, hg, { cast: false }); r2.rotation.z = -0.5;
    add(box(0.8, 1.6, 0.06), MAT.woodDk, 0.6, 0.8, 1.72, hg, { cast: false });
  };
  hut(-8.9, -17.4, 0.15); hut(7.6, -17.4, -0.1); hut(-11.4, 17.5, 0.5, 0.95); hut(11.1, 17.5, -0.45, 0.95);
  // ---- the well (west): stone ring, two posts, a little roof, bucket
  const well = new THREE.Group(); well.position.set(-6.5, 0, -6); g.add(well);
  add(new THREE.CylinderGeometry(0.85, 0.95, 1.05, 12, 1, true), MAT.stoneDk, 0, 0.52, 0, well, { cast: false });
  add(new THREE.TorusGeometry(0.87, 0.06, 6, 14), MAT.stone, 0, 1.06, 0, well, { cast: false }).rotation.x = Math.PI / 2;
  const wellDark = add(new THREE.CircleGeometry(0.82, 12), MAT.dark, 0, 0.98, 0, well, { cast: false }); wellDark.rotation.x = -Math.PI / 2;
  add(tbox(0.09, 1.9, 0.09, 2), MAT.woodDk, -0.8, 0.95, 0, well, { cast: false });
  add(tbox(0.09, 1.9, 0.09, 2), MAT.woodDk, 0.8, 0.95, 0, well, { cast: false });
  const wr = add(tbox(2.2, 0.08, 1.3, 2), MAT.thatch, 0, 2.0, 0, well, { cast: false }); wr.rotation.z = 0.1;
  add(new THREE.CylinderGeometry(0.14, 0.11, 0.24, 8), MAT.woodDk, 0.45, 0.82, 0.45, well, { cast: false });
}
// ---------- the degchi stand + THE DEGCHI ----------
// A low iron stand (three legs + ring) at the centre. The degchi
// itself: a black rounded pot — belly, rim, lid, knob — built from
// its real parts. It appears on the stand when Kamla's hands finish
// setting it down (worldAt.degchiK); before that she carries it.
const degchiG = new THREE.Group(); scene.add(degchiG);
{
  const iron = toon({ color: '#2e2a26' });
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2 + 0.5;
    const legM = add(new THREE.CylinderGeometry(0.035, 0.045, 0.46, 6), iron, Math.sin(a) * 0.3, 0.22, Math.cos(a) * 0.3, degchiG, { cast: false });
    legM.rotation.z = Math.sin(a) * 0.18; legM.rotation.x = -Math.cos(a) * 0.18;
  }
  add(new THREE.TorusGeometry(0.31, 0.035, 6, 18), iron, 0, 0.44, 0, degchiG, { cast: false }).rotation.x = Math.PI / 2;
}
const potG = new THREE.Group(); potG.position.set(0, 0.44, 0); scene.add(potG);
{
  const blackMetal = new THREE.MeshStandardMaterial({ color: 0x232019, metalness: 0.35, roughness: 0.62, envMap, envMapIntensity: 0.5 });
  const belly = add(new THREE.SphereGeometry(0.34, 18, 12), blackMetal, 0, 0.16, 0, potG, { cast: true }); belly.scale.set(1, 0.82, 1);
  add(new THREE.TorusGeometry(0.27, 0.032, 6, 18), blackMetal, 0, 0.4, 0, potG, { cast: false }).rotation.x = Math.PI / 2;
  const lid = add(new THREE.SphereGeometry(0.27, 16, 8), blackMetal, 0, 0.4, 0, potG, { cast: true }); lid.scale.set(1, 0.38, 1);
  add(new THREE.SphereGeometry(0.05, 8, 6), blackMetal, 0, 0.53, 0, potG, { cast: false });
}
// ---------- THE THALI RING — 8 polished mirrors on stands ----------
// Each thali: a tripod stand + a pivot at its top carrying the steel
// disc (rim ring + shallow dish + a bright centre). The pivot's
// quaternion slerps between SLACK (near-flat, catches nothing) and
// WORKING (tipped up toward the sun, face aimed at the pot) by
// story.thaliTiltAt — and the tilt only ever changes under a hand.
const steel = new THREE.MeshStandardMaterial({ color: 0xdfe7ea, metalness: 1.0, roughness: 0.24, envMap, envMapIntensity: 1.25 });
const steelDish = new THREE.MeshStandardMaterial({ color: 0xf2f7f9, metalness: 1.0, roughness: 0.2, envMap, envMapIntensity: 1.1 });
const thalis = [];
{
  const up = new THREE.Vector3(0, 1, 0);
  THALI_POS.forEach(([tx, tz], i) => {
    const grp = new THREE.Group(); grp.position.set(tx, 0, tz); scene.add(grp);
    add(new THREE.CylinderGeometry(0.035, 0.05, 0.5, 6), MAT.woodDk, 0, 0.25, 0, grp, { cast: false });
    add(new THREE.CylinderGeometry(0.16, 0.2, 0.05, 8), MAT.woodDk, 0, 0.03, 0, grp, { cast: false });
    const pivot = new THREE.Group(); pivot.position.set(0, 0.52, 0); grp.add(pivot);
    const disc = add(new THREE.CylinderGeometry(0.31, 0.31, 0.028, 22), steel, 0, 0, 0, pivot, { cast: true });
    const dish = add(new THREE.CylinderGeometry(0.24, 0.2, 0.02, 22), steelDish, 0, 0.02, 0, pivot, { cast: false });
    const inward = new THREE.Vector3(-tx, 0, -tz).normalize();
    const qFor = (tilt) => {
      const n = up.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(inward, Math.sin(tilt)).normalize();
      return new THREE.Quaternion().setFromUnitVectors(up, n);
    };
    thalis.push({ pivot, qSlack: qFor(0.14), qWork: qFor(0.68) });
  });
}
// the pagdi, draped: a soft cream cloth lump riding thali #1's pivot
// (so it follows the sag) — scale driven by worldAt.pagdiK.
const pagdiMesh = (() => {
  const cloth = toon({ color: '#e2543e' });
  const m = add(new THREE.SphereGeometry(0.3, 12, 8), cloth, 0, 0.045, 0, thalis[1].pivot, { cast: true });
  m.scale.set(1, 0.001, 1); m.visible = false;
  const band = add(new THREE.TorusGeometry(0.24, 0.028, 5, 14), toon({ color: '#b23a26' }), 0, 0.05, 0, thalis[1].pivot, { cast: false });
  band.rotation.x = Math.PI / 2; band.scale.set(1, 1, 0.001); band.visible = false;
  return { m, band };
})();
// ---------- sun beams: thali -> degchi ----------
// One additive quad per thali along its reflection line to the pot,
// opacity from worldAt.beamK (never graded, brightest at the pot).
// The covered thali's beam dies with pagdiK.
const beamTex = (() => {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const g = c.getContext('2d'); const img = g.createImageData(64, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 64; x++) {
    const u = x / 63, v = y / 255;
    const across = Math.pow(Math.sin(Math.PI * u), 1.6);
    const along = (0.35 + 0.65 * Math.pow(v, 1.4)) * Math.min(1, (1 - v) * 6 + 0.25);
    const i = (y * 64 + x) * 4;
    img.data[i] = 255; img.data[i + 1] = 237; img.data[i + 2] = 181;
    img.data[i + 3] = Math.round(255 * across * along);
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const beamMat = new THREE.MeshBasicMaterial({ map: beamTex, color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
const beams = [];
{
  const up = new THREE.Vector3(0, 1, 0);
  THALI_POS.forEach(([tx, tz]) => {
    const a = new THREE.Vector3(tx, 0.56, tz), b = new THREE.Vector3(0, 0.74, 0);
    const dir = b.clone().sub(a), len = dir.length();
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.17, len), beamMat.clone());
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(up, dir.normalize());
    m.userData.ndSkip = true; m.renderOrder = 3; scene.add(m); beams.push(m);
  });
}
// the heat glow where all the suns land on the pot
const glowTex = P.tex(P.radial('255,224,160', 0.9));
const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
glow.position.set(0, 0.72, 0); glow.scale.set(1.35, 1.35, 1); glow.userData.ndSkip = true; glow.renderOrder = 3; scene.add(glow);
// ---------- boards ----------
// The hook board: next story's question, standing on the south bank.
// Its transform is mirrored in boards.json — keep in sync. It rises at
// the start of the final shot and HOLDS at full opacity to the end.
const boardHook = textBoard(['लेकिन कल...', 'वह लड़की जो अंधेरे में', 'सिलाई कर लेती थी?'], 3.9, 1.75, '#2a1a0c', '#ffe9a8', 900, { pitch: 0.24, dy: 0.02 });
boardHook.position.set(...BOARD_POS); world.add(boardHook); addBoardOccluder(boardHook, 3.9, 1.75, 'hookK');
add(tbox(0.09, 2.0, 0.09, 2), MAT.woodDk, -0.85, 0.6, 10.58, world, { cast: false });
add(tbox(0.09, 2.0, 0.09, 2), MAT.woodDk, 2.45, 0.6, 10.58, world, { cast: false });
// ---------- FX: steam, sun glints, dust motes, sky clouds ----------
// Steam is the film's second actor: a Smoke emitter over the degchi
// whose rate follows story.steamK (dense white puffs at the boil,
// nothing under the clouds). Glints sparkle where the beams land.
// The cloud layer thickens with story.cloudK for the grey beat.
const splashes = new FX.Splashes(scene, 200); splashes.points.userData.ndSkip = true;
const smoke = new FX.Smoke(scene, 260); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const steamEmit = smoke.addEmitter(0, 0.92, 0, { rate: 0, color: 0xffffff, opacity: 0.24, scale: 0.24, grow: 0.4, life: 1.5, vy: 0.62, wind: 0.05 });
const glintEmit = smoke.addEmitter(0, 0.78, 0, { rate: 0, color: 0xfff2c0, opacity: 0.5, scale: 0.18, grow: 0.35, life: 0.7, vy: 0.25, wind: 0.02 });
const moteEmit = smoke.addEmitter(0, 1.6, 3.2, { rate: 0.2, color: 0xffe9b0, opacity: 0.06, scale: 0.35, grow: 0.5, life: 3.6, vy: 0.03, wind: 0.06 });
const fxClouds = new FX.Clouds(scene, { count: 7, y: 58, opacity: 0.3, color: 0xffffff, drift: 0.35 });
fxClouds.items.forEach((cl) => { cl.userData.x0 = cl.position.x; cl.traverse((m) => { m.userData.ndSkip = true; if (m.isSprite) m.userData.baseOp = m.material.opacity; }); });
let fxF = -1;
const fxReset = () => {
  splashes.life.fill(-1); splashes.pos.fill(-999);
  smoke.pool.forEach((p) => { p.life = -1; p.s.visible = false; }); smoke.emitters.forEach((e) => { e.acc = 0; });
  fxClouds.items.forEach((cl) => { cl.position.x = cl.userData.x0; });
};
const fxStepTo = (f) => {
  if (f === fxF) return;
  if (f < fxF || f > fxF + 240) { fxReset(); fxF = -1; }
  while (fxF < f) {
    fxF++; const t = fxF / 30, dt = 1 / 30, pr = fxProfileAt(fxF), Ws = worldAt(fxF);
    // THE STEAM BURST as the sun returns, and the surge at the lift-off
    if (fxF === 748) splashes.burst(0, 0.9, 0, { n: 42, power: 3.2 });
    if (fxF === 1268) splashes.burst(0, 0.9, 0, { n: 30, power: 2.6 });
    // at a full boil the dal bubbles up through the steam
    if ((Ws.steamK ?? 0) > 0.8 && fxF % 7 === 0) splashes.burst(0, 0.86, 0, { n: 3, power: 0.8 });
    steamEmit.rate = pr.steamRate * 3.6 * (Ws.degchiK ?? 0);
    glintEmit.rate = pr.sparkRate * 3 * (Ws.degchiK ?? 0);
    moteEmit.rate = pr.moteRate * 3;
    splashes.update(t, dt); smoke.update(t, dt); fxClouds.update(t, dt);
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
  // the degchi: in her hands before f58, on its stand from f58
  potG.visible = (Ws.degchiK ?? 0) > 0.5;
  // the thali ring: each disc slerps slack -> working by its tilt
  // track (tilts change only under a hand — see story.thaliTiltAt)
  const tilts = thaliTiltAt(f);
  thalis.forEach((th, i) => { th.pivot.quaternion.slerpQuaternions(th.qSlack, th.qWork, tilts[i]); });
  // the pagdi lump settles onto thali #1 and lifts away with pagdiK
  const pk = Ws.pagdiK ?? 0;
  pagdiMesh.m.visible = pk > 0.01; pagdiMesh.band.visible = pk > 0.01;
  pagdiMesh.m.scale.set(1, Math.max(0.001, pk * 0.38), 1);
  pagdiMesh.band.scale.set(1, 1, Math.max(0.001, pk));
  // sun beams + the heat glow on the pot (thali #1's beam dies
  // while the pagdi smothers it)
  const bk = Ws.beamK ?? 0;
  beams.forEach((b, i) => { b.material.opacity = bk * 0.22 * (i === 1 ? 1 - pk : 1); });
  glow.material.opacity = bk * 0.34;
  // the cloud layer thickens and greys as cloudK rises
  const ck = Ws.cloudK ?? 0;
  fxClouds.items.forEach((cl) => { cl.traverse((m) => { if (m.isSprite && m.userData.baseOp !== undefined) m.material.opacity = m.userData.baseOp * (0.55 + 1.15 * ck); }); });
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
