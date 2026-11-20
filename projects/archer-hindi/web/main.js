import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import * as M4 from './materials.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, BOARD_POS, bowStateAt, arrowStateAt, bellStateAt, IMP1, IMP2, IMP3, IMP4 } from './story.js';
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
const juteCanvas = (seed) => {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  let sd = seed; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#b59a68'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 256; i += 4) {
    g.fillStyle = `rgba(90,66,32,${0.10 + rnd() * 0.12})`; g.fillRect(0, i, 256, 1.6);
    g.fillStyle = `rgba(240,220,170,${0.08 + rnd() * 0.1})`; g.fillRect(i, 0, 1.6, 256);
  }
  for (let i = 0; i < 500; i++) { g.fillStyle = rnd() > 0.5 ? 'rgba(70,50,22,0.12)' : 'rgba(250,235,190,0.1)'; g.fillRect(rnd() * 256, rnd() * 256, 2, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
};
// the target face: painted rings on straw — white, black, red, and a
// gold heart where the tiny bell hangs
const ringsCanvas = () => {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  let sd = 97; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#c9a86a'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 1500; i++) {
    g.strokeStyle = `rgba(${150 + rnd() * 70 | 0},${115 + rnd() * 50 | 0},${50 + rnd() * 30 | 0},${0.15 + rnd() * 0.2})`;
    g.lineWidth = 1.4;
    const x = rnd() * 512, y = rnd() * 512, a = rnd() * 3.14;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9); g.stroke();
  }
  const ring = (r, col) => { g.fillStyle = col; g.beginPath(); g.arc(256, 256, r, 0, 7); g.fill(); };
  ring(238, '#e8e2d2'); ring(188, '#2c2c30'); ring(138, '#b3392e'); ring(88, '#e3b93c'); ring(30, '#c9922e');
  g.strokeStyle = 'rgba(60,40,16,0.5)'; g.lineWidth = 5; g.beginPath(); g.arc(256, 256, 246, 0, 7); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
};
const MAT = {
  grass: toon({ map: grassCanvas(191), color: '#96b47c' }),
  mud: toon({ map: mudCanvas(5, '#a97e4e'), color: '#b28a58' }),
  mudDk: toon({ map: mudCanvas(6, '#8a6538'), color: '#a37c4e' }),
  path: toon({ map: mudCanvas(31, '#9a7a4a'), color: '#c2a068' }),
  thatch: toon({ map: thatchCanvas(3), color: '#a8843e' }),
  wood: texM(M4.woodV4(4), 1, 2), woodDk: texM(M4.woodV4(6), 1, 2),
  plank: texM(M4.woodV4(11), 1, 1, '#9a7c58'), plankDk: texM(M4.woodV4(13), 1, 1, '#7d6244'),
  leaf: toon({ color: '#46683c' }), leafDk: toon({ color: '#334f2e' }),
  trunk: texM(M4.woodV4(9), 1, 3, '#8a6a4a'),
  stone: toon({ color: '#7d8a80' }), stoneDk: toon({ color: '#5d6a62' }),
  reed: toon({ color: '#557d40' }), reedDk: toon({ color: '#42632f' }),
  dark: toon({ color: '#33302c' }),
  rope: toon({ color: '#7d6242' }),
  jute: toon({ map: juteCanvas(17), color: '#c8ab76' }),
  rings: toon({ map: ringsCanvas(), color: '#ffffff' }),
  brass: new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.9, roughness: 0.32, envMap, envMapIntensity: 1.1 }),
  iron: toon({ color: '#2e2a26' }),
  clothRed: toon({ color: '#b3392e' }), clothBlue: toon({ color: '#2f5d8a' }), clothGold: toon({ color: '#d9a441' }),
  clothGreen: toon({ color: '#3d7a44' }), clothPink: toon({ color: '#c96a8a' }),
  shaft: toon({ color: '#8a6844' }), fletch: toon({ color: '#c2452d', side: THREE.DoubleSide }), fletch2: toon({ color: '#e8e2d2', side: THREE.DoubleSide }),
};

// ---------- THE FAIR GROUND ----------
// One set: grass all round, a packed-earth arena under the lane,
// stalls and tents behind the shooting line, trees at the edges,
// bunting strung across the lane on four poles. The sun is ONE
// (story.lightFor) and every shadow agrees with it.
const world = new THREE.Group(); scene.add(world);
const tufts = [];
{
  const g = world;
  MAT.grass.map.repeat.set(48, 48);
  flat(add(new THREE.PlaneGeometry(500, 500), MAT.grass, 0, -0.03, 0, g, { cast: false }));
  // packed-earth arena under the lane and crowd rows
  const plazaMat = toon({ map: mudCanvas(41, '#a97e4e'), color: '#cfa96e' });
  plazaMat.map.repeat.set(4, 4);
  const plaza = flat(add(new THREE.CircleGeometry(6, 30), plazaMat, 0, 0.002, 0.8, g, { cast: false }));
  plaza.scale.set(1.2, 1.6, 1);
  // the shooting lane: lighter packed earth, line to target
  MAT.path.map.repeat.set(1.5, 10);
  flat(add(new THREE.PlaneGeometry(3.2, 16.5), MAT.path, 0, 0.006, 0, g, { cast: false }));
  // scattered stones (kept off the lane)
  let sd2 = 47; const rnd2 = () => (sd2 = (sd2 * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 30; i++) {
    const sx = -18 + rnd2() * 36, sz = -18 + rnd2() * 36;
    if (Math.abs(sx) < 2.6) continue;
    const st = add(new THREE.SphereGeometry(0.09 + rnd2() * 0.15, 7, 5), MAT.stoneDk, sx, 0.04, sz, g, { cast: false }); st.scale.set(1, 0.55, 1);
  }
  // ---- trees
  const tree = (x, z, s = 1) => {
    const trunk = add(new THREE.CylinderGeometry(0.3 * s, 0.48 * s, 3.4 * s, 9), MAT.trunk, x, 1.7 * s, z, g, { cast: false }); trunk.rotation.z = 0.05;
    for (const [bx, by, bz, rz, ln] of [[0.6, 3.9, 0.2, -0.7, 1.6], [-0.7, 4.0, -0.3, 0.8, 1.5], [0.1, 4.1, 0.9, 0.2, 1.3]]) {
      const br = add(new THREE.CylinderGeometry(0.09 * s, 0.14 * s, ln * s, 6), MAT.trunk, x + bx * s, by * s, z + bz * s, g, { cast: false }); br.rotation.z = rz;
    }
    for (const [fx, fy, fz, fr, dk] of [[0.2, 4.9, -0.1, 2.3, 0], [-1.4, 4.4, 0.3, 1.7, 1], [1.7, 4.5, -0.4, 1.8, 1], [0, 5.6, 0.8, 1.6, 0], [-0.9, 5.2, -1.1, 1.5, 0]]) {
      const fol = add(new THREE.SphereGeometry(fr * s, 10, 8), dk ? MAT.leafDk : MAT.leaf, x + fx * s, fy * s, z + fz * s, g, { cast: false }); fol.scale.set(1.15, 0.72, 1.15);
    }
  };
  tree(-9, -6, 1.15); tree(9.5, -7, 1.05); tree(-10, 4, 0.9); tree(10.5, 5, 1.0); tree(-13.5, 12, 1.0); tree(13, 13.5, 0.95);
  // ---- stalls behind the line, facing the lane
  const stall = (x, z, awning) => {
    const sg = new THREE.Group(); sg.position.set(x, 0, z); sg.rotation.y = Math.PI; g.add(sg);
    for (const [px, pz] of [[-1.6, -0.9], [1.6, -0.9], [-1.6, 0.9], [1.6, 0.9]]) {
      add(tbox(0.09, 2.3, 0.09, 2), MAT.woodDk, px, 1.15, pz, sg, { cast: false });
    }
    const awn = add(tbox(3.8, 0.07, 2.4, 2), awning, 0, 2.42, 0, sg, { cast: false }); awn.rotation.x = 0.16;
    add(tbox(3.2, 0.75, 0.9, 2), MAT.wood, 0, 0.38, 0.55, sg, { cast: false });
    for (let k = 0; k < 3; k++) {
      const sack = add(new THREE.SphereGeometry(0.3 - k * 0.03, 9, 7), MAT.jute, -0.9 + k * 0.75, 0.88, 0.5, sg, { cast: false });
      sack.scale.set(1, 0.78, 1);
    }
    return sg;
  };
  stall(-8.6, 10.5, MAT.clothRed); stall(8.6, 10.5, MAT.clothBlue); stall(0, 13.8, MAT.clothGold);
  // ---- tents at the sides
  const tent = (x, z, mat) => {
    const tg = new THREE.Group(); tg.position.set(x, 0, z); g.add(tg);
    add(new THREE.CylinderGeometry(1.7, 1.8, 1.6, 12), MAT.jute, 0, 0.8, 0, tg, { cast: false });
    add(new THREE.ConeGeometry(2.1, 1.3, 12), mat, 0, 2.25, 0, tg, { cast: false });
    add(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 6), MAT.woodDk, 0, 3.2, 0, tg, { cast: false });
  };
  tent(-10.4, 2, MAT.clothGreen); tent(10.4, 2, MAT.clothPink);
  // ---- grass tufts at the arena edge (they sway in the one wind)
  for (let i = 0; i < 30; i++) {
    const a = rnd2() * Math.PI * 2, rr = 5.5 + rnd2() * 9;
    const tx = Math.cos(a) * rr, tz = 0.8 + Math.sin(a) * rr * 1.4;
    if (Math.abs(tx) < 2.2 && tz > -8 && tz < 9) continue;
    const tuft = new THREE.Group(); tuft.position.set(tx, 0, tz); g.add(tuft);
    for (let k = 0; k < 4; k++) {
      const blade = add(new THREE.ConeGeometry(0.045, 0.6 + rnd2() * 0.45, 5), k % 2 ? MAT.reed : MAT.reedDk, (rnd2() - 0.5) * 0.3, 0.3, (rnd2() - 0.5) * 0.3, tuft, { cast: false });
      blade.rotation.z = (rnd2() - 0.5) * 0.24; blade.rotation.x = (rnd2() - 0.5) * 0.2;
    }
    tufts.push({ g: tuft, ph: rnd2() * 6.28 });
  }
}
// ---------- BUNTING: poles, sagging lines, pennant flags ----------
// The flags wave on the same breeze that rings the tiny bell.
const flags = [];
{
  const g = world;
  const lineY = (x) => 2.3 + 0.25 * (x / 3.8) * (x / 3.8);
  for (const pz of [7.5]) {
    for (const px of [-3.8, 3.8]) add(new THREE.CylinderGeometry(0.05, 0.07, 2.6, 7), MAT.woodDk, px, 1.3, pz, g, { cast: false });
    const pts = [];
    for (let x = -3.8; x <= 3.81; x += 0.475) pts.push(new THREE.Vector3(x, lineY(x), pz));
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.016, 5), MAT.rope);
    tube.castShadow = false; g.add(tube);
    const cols = [MAT.clothRed, MAT.clothGold, MAT.clothBlue, MAT.clothGreen, MAT.clothPink];
    let fi = 0;
    for (let x = -3.3; x <= 3.31; x += 0.83) {
      const fg = new THREE.Group(); fg.position.set(x, lineY(x) - 0.02, pz); g.add(fg);
      const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(0.3, -0.05); shape.lineTo(0.03, -0.36); shape.lineTo(0, 0);
      const flag = new THREE.Mesh(new THREE.ShapeGeometry(shape), cols[fi % cols.length]);
      flag.material = flag.material.clone(); flag.material.side = THREE.DoubleSide;
      fg.add(flag); fg.userData.ph = fi * 1.37 + pz; flags.push(fg); fi++;
    }
  }
}
// ---------- THE TARGET: stand, straw boss, painted rings ----------
// The boss group wobbles on its stand when an arrow strikes home
// (story.targetWob via worldAt.wobK). The bell hangs at its centre.
const targetG = new THREE.Group(); targetG.position.set(0, 0, -6); scene.add(targetG);
const bossG = new THREE.Group(); bossG.position.set(0, 1.27, 0); targetG.add(bossG);
{
  const legL = add(tbox(0.09, 1.5, 0.09, 2), MAT.woodDk, -0.48, 0.62, 0.18, targetG, { cast: true }); legL.rotation.x = 0.25;
  const legR = add(tbox(0.09, 1.5, 0.09, 2), MAT.woodDk, 0.48, 0.62, 0.18, targetG, { cast: true }); legR.rotation.x = 0.25;
  const legB = add(tbox(0.09, 1.5, 0.09, 2), MAT.woodDk, 0, 0.62, -0.42, targetG, { cast: true }); legB.rotation.x = -0.4;
  add(tbox(1.2, 0.08, 0.08, 2), MAT.woodDk, 0, 0.55, 0.22, targetG, { cast: false });
  const boss = add(new THREE.CylinderGeometry(0.62, 0.62, 0.16, 24), MAT.jute, 0, 0, 0, bossG, { cast: true });
  boss.rotation.x = Math.PI / 2;
  add(new THREE.CircleGeometry(0.615, 24), MAT.rings, 0, 0, 0.085, bossG, { cast: false });
  const rim = add(new THREE.TorusGeometry(0.62, 0.045, 8, 24), MAT.jute, 0, 0, 0.05, bossG, { cast: false });
}
// ---------- THE TINY BELL (brass, at the boss centre) ----------
const bellG = new THREE.Group(); scene.add(bellG);
{
  add(box(0.035, 0.07, 0.035), MAT.rope, 0, -0.03, 0, bellG, { cast: false });
  add(new THREE.SphereGeometry(0.032, 8, 6), MAT.brass, 0, -0.075, 0, bellG, { cast: false });
  add(new THREE.CylinderGeometry(0.036, 0.085, 0.125, 10, 1, true), MAT.brass, 0, -0.155, 0, bellG, { cast: true });
  add(new THREE.TorusGeometry(0.085, 0.014, 5, 12), MAT.brass, 0, -0.215, 0, bellG, { cast: false }).rotation.x = Math.PI / 2;
  add(new THREE.SphereGeometry(0.021, 6, 5), MAT.iron, 0, -0.22, 0, bellG, { cast: false });
  bellG.scale.setScalar(1.15);
}
// a sun-glint sprite on the bell — it wakes when the bell rings hard
const bellGlint = new THREE.Sprite(new THREE.SpriteMaterial({ map: P.tex(P.radial('255,240,200', 0.9)), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
bellGlint.position.set(0, 1.27, -5.8); bellGlint.scale.set(0.7, 0.7, 1); bellGlint.userData.ndSkip = true; bellGlint.renderOrder = 3; scene.add(bellGlint);
// ---------- THE BOW (3D prop): curved stave + a string that DRAWS ----------
// Stave built in bow-local space: belly toward local +z (the target
// side once the group yaws PI), tips at y ±0.477, string on the
// archer side (local -z); the nock point pulls back with drawK.
const bowG = new THREE.Group(); scene.add(bowG);
const stringMat = toon({ color: '#e8e2d2' });
const mkString = () => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 1, 5), stringMat); m.castShadow = false; bowG.add(m); return m; };
const strT = mkString(), strB = mkString();
{
  const staveGeo = new THREE.TorusGeometry(0.55, 0.028, 6, 24, 2.1);
  staveGeo.rotateZ(-1.05);
  const stave = new THREE.Mesh(staveGeo, MAT.woodDk);
  stave.rotation.y = -Math.PI / 2; stave.position.set(0, 0, -0.43);
  stave.castShadow = true; bowG.add(stave);
  add(new THREE.CylinderGeometry(0.036, 0.036, 0.17, 7), MAT.rope, 0, 0, 0.12, bowG, { cast: false });
  for (const sy of [1, -1]) add(new THREE.SphereGeometry(0.034, 7, 6), MAT.woodDk, 0, sy * 0.477, -0.157, bowG, { cast: false });
}
const _va = new THREE.Vector3(), _vb = new THREE.Vector3(), _vd = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const setBeam = (m, a, b) => {
  _va.set(...a); _vb.set(...b); _vd.subVectors(_vb, _va);
  const len = _vd.length();
  m.position.copy(_va).addScaledVector(_vd, 0.5);
  m.scale.set(1, len, 1);
  m.quaternion.setFromUnitVectors(_up, _vd.normalize());
};
// ---------- THE ARROWS (x4): shaft, iron head, twin fletching ----------
// Modelled pointing local +z; story yaw PI turns the head toward
// the target. Pitch is applied negated (see worldState).
const arrowGs = [];
{
  for (let i = 0; i < 4; i++) {
    const ag = new THREE.Group(); ag.rotation.order = 'YXZ'; scene.add(ag);
    const shaft = add(new THREE.CylinderGeometry(0.013, 0.013, 0.8, 6), MAT.shaft, 0, 0, 0, ag, { cast: true });
    shaft.rotation.x = Math.PI / 2;
    const head = add(new THREE.ConeGeometry(0.026, 0.1, 7), MAT.iron, 0, 0, 0.45, ag, { cast: false });
    head.rotation.x = Math.PI / 2;
    for (const [rz, mm] of [[0, MAT.fletch], [Math.PI / 2, MAT.fletch2]]) {
      const finGeo = new THREE.PlaneGeometry(0.13, 0.1);
      finGeo.rotateY(Math.PI / 2); finGeo.translate(0, 0.062, -0.33); if (rz) finGeo.rotateZ(rz);
      add(finGeo, mm, 0, 0, 0, ag, { cast: false });
    }
    arrowGs.push(ag);
  }
}
// ---------- boards ----------
// The hook board: next story's question, standing beyond the target
// facing south (toward the lane and the finale camera). Its
// transform is mirrored in boards.json — keep in sync. It fades in
// at the start of the final shot and HOLDS at full opacity to the
// literal final frame. Painted in the proven safe regime for
// Devanagari conjuncts (fit fsMul 1.0 -> fs 51.3 px; line 2 is the
// long one, so the base size comes from it).
const boardHook = textBoard(['लेकिन कल...', 'वह लड़का जो मिट्टी के घड़े में', 'तूफ़ान बंद कर देता था?'], 3.9, 1.75, '#2a1a0c', '#ffe9a8', 900, { pitch: 0.22, dy: 0.03, fsMul: 1.0 });
boardHook.position.set(...BOARD_POS); world.add(boardHook); addBoardOccluder(boardHook, 3.9, 1.75, 'hookK');
add(tbox(0.09, 2.8, 0.09, 2), MAT.woodDk, -2.25, 1.3, -11.3, world, { cast: false });
add(tbox(0.09, 2.8, 0.09, 2), MAT.woodDk, -0.45, 1.3, -11.3, world, { cast: false });
// ---------- FX: sky clouds + impact dust ----------
// Dust bursts only, at the four impact frames (straw dust at the
// boss, a mud puff where the third arrow falls short).
const smoke = new FX.Smoke(scene, 130); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const fxClouds = new FX.Clouds(scene, { count: 7, y: 58, opacity: 0.3, color: 0xffffff, drift: 0.35 });
fxClouds.items.forEach((cl) => { cl.userData.x0 = cl.position.x; cl.traverse((m) => { m.userData.ndSkip = true; if (m.isSprite) m.userData.baseOp = m.material.opacity; }); });
let fxF = -1;
const fxReset = () => {
  smoke.pool.forEach((p) => { p.life = -1; p.s.visible = false; }); smoke.emitters.forEach((e) => { e.acc = 0; });
  fxClouds.items.forEach((cl) => { cl.position.x = cl.userData.x0; });
};
const fxStepTo = (f) => {
  if (f === fxF) return;
  if (f < fxF || f > fxF + 240) { fxReset(); fxF = -1; }
  while (fxF < f) {
    fxF++; const t = fxF / 30, dt = 1 / 30;
    if (fxF === IMP1) smoke.burst(0.03, 1.3, -5.7, { n: 8, color: 0xd8c9a0, opacity: 0.3, scale: 0.4, grow: 1.5, life: 0.9, vy: 0.45, wind: 0.2 });
    if (fxF === IMP2) smoke.burst(0.52, 1.52, -5.7, { n: 6, color: 0xd8c9a0, opacity: 0.28, scale: 0.36, grow: 1.5, life: 0.8, vy: 0.4, wind: 0.2 });
    if (fxF === IMP3) smoke.burst(0.85, 0.14, -2.3, { n: 11, color: 0x8a6b4a, opacity: 0.34, scale: 0.44, grow: 1.6, life: 1.0, vy: 0.55, wind: 0.2 });
    if (fxF === IMP4) smoke.burst(-0.1, 1.24, -5.7, { n: 9, color: 0xd8c9a0, opacity: 0.3, scale: 0.42, grow: 1.5, life: 0.9, vy: 0.5, wind: 0.2 });
    smoke.update(t, dt); fxClouds.update(t, dt);
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
  // the bow: follows the boy; the string's nock pulls back with drawK
  const bs = bowStateAt(f);
  bowG.visible = bs.visible;
  bowG.position.set(bs.x, bs.y, bs.z);
  bowG.rotation.set((1 - bs.aim) * 0.5, bs.yaw, 0);
  const nockZ = -0.157 - 0.42 * bs.draw;
  setBeam(strT, [0, 0.477, -0.157], [0, 0, nockZ]);
  setBeam(strB, [0, -0.477, -0.157], [0, 0, nockZ]);
  // the arrows: nock, flight (real arc), stuck, mud
  arrowStateAt(f).forEach((a, i) => {
    const ag = arrowGs[i];
    if (a.mode === 'hide') { ag.visible = false; return; }
    ag.visible = true;
    ag.position.set(a.x, a.y, a.z);
    ag.rotation.set(-a.pitch, a.yaw, (a.vib || 0) * 0.06);
  });
  // the tiny bell: at the centre / in the youth's hand / pocketed
  const bl = bellStateAt(f);
  if (bl.mode === 'pocket') bellG.visible = false;
  else {
    bellG.visible = true;
    if (bl.mode === 'target') bellG.position.set(0, 1.34, -5.86);
    else bellG.position.set(bl.x, bl.y + 0.22, bl.z);
    bellG.rotation.x = Math.sin(t * 3.2) * (0.05 + 0.5 * bl.swing);
    bellG.rotation.z = Math.sin(t * 2.3 + 1) * (0.03 + 0.3 * bl.swing);
  }
  bellGlint.material.opacity = Math.max(0, (Ws.bellK ?? 0) - 0.35) * (0.4 + 0.3 * Math.sin(t * 6.3));
  // the boss wobbles on its stand when an arrow strikes home
  bossG.rotation.z = (Ws.wobK || 0) * 0.05;
  bossG.rotation.x = (Ws.wobK || 0) * 0.03;
  // bunting flags + grass tufts ride the one breeze — gusts, never
  // a uniform wave
  for (const fg of flags) {
    fg.rotation.y = Math.sin(t * 2.4 + fg.userData.ph) * 0.45 + Math.sin(t * 0.53 + fg.userData.ph * 2) * 0.15;
    fg.rotation.x = Math.sin(t * 3.1 + fg.userData.ph * 2) * 0.1;
  }
  for (const r of tufts) r.g.rotation.z = Math.sin(t * 1.25 + r.ph) * 0.055 + Math.sin(t * 0.37 + r.ph * 2) * 0.03;
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
