import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import * as M4 from './materials.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, BOARD_POS, potStateAt, lidStateAt, ropeK, turbanStateAt, kidPotsAt, POP, SLAM_LID } from './story.js';
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
const MAT = {
  grass: toon({ map: grassCanvas(191), color: '#96b47c' }),
  mud: toon({ map: mudCanvas(5, '#a97e4e'), color: '#b28a58' }),
  path: toon({ map: mudCanvas(31, '#9a7a4a'), color: '#c2a068' }),
  thatch: toon({ map: thatchCanvas(3), color: '#a8843e' }),
  hutWall: toon({ map: mudCanvas(23, '#9a7a52'), color: '#c8a878' }),
  wood: texM(M4.woodV4(4), 1, 2), woodDk: texM(M4.woodV4(6), 1, 2),
  plank: texM(M4.woodV4(11), 1, 1, '#9a7c58'), plankDk: texM(M4.woodV4(13), 1, 1, '#7d6244'),
  leaf: toon({ color: '#46683c' }), leafDk: toon({ color: '#334f2e' }),
  trunk: texM(M4.woodV4(9), 1, 3, '#8a6a4a'),
  stone: toon({ color: '#7d8a80' }), stoneDk: toon({ color: '#5d6a62' }),
  reed: toon({ color: '#557d40' }), reedDk: toon({ color: '#42632f' }),
  dark: toon({ color: '#33302c' }),
  rope: toon({ color: '#7d6242' }),
  jute: toon({ map: juteCanvas(17), color: '#c8ab76' }),
  clay: toon({ map: mudCanvas(7, '#a86436'), color: '#e59a5c' }),
  clayDk: toon({ map: mudCanvas(8, '#8a4f2a'), color: '#bd7c46' }),
  saffron: toon({ color: '#e8912d' }),
  saffronDk: toon({ color: '#c4741e' }),
  paper: toon({ color: '#f3ead2', side: THREE.DoubleSide }),
  clothRed: toon({ color: '#b3392e' }), clothBlue: toon({ color: '#2f5d8a' }), clothGold: toon({ color: '#d9a441' }),
  clothGreen: toon({ color: '#3d7a44' }), clothPink: toon({ color: '#c96a8a' }),
};

// ---------- shared set builders ----------
const bendTrees = [], tufts = [], flags = [], shutters = [];
let sd2 = 47; const rnd2 = () => (sd2 = (sd2 * 16807) % 2147483647) / 2147483647;
function buildTree(g, x, z, s = 1) {
  const tg = new THREE.Group(); tg.position.set(x, 0, z); g.add(tg);
  const trunk = add(new THREE.CylinderGeometry(0.3 * s, 0.48 * s, 3.4 * s, 9), MAT.trunk, 0, 1.7 * s, 0, tg, { cast: false }); trunk.rotation.z = 0.05;
  for (const [bx, by, bz, rz, ln] of [[0.6, 3.9, 0.2, -0.7, 1.6], [-0.7, 4.0, -0.3, 0.8, 1.5], [0.1, 4.1, 0.9, 0.2, 1.3]]) {
    const br = add(new THREE.CylinderGeometry(0.09 * s, 0.14 * s, ln * s, 6), MAT.trunk, bx * s, by * s, bz * s, tg, { cast: false }); br.rotation.z = rz;
  }
  for (const [fx, fy, fz, fr, dk] of [[0.2, 4.9, -0.1, 2.3, 0], [-1.4, 4.4, 0.3, 1.7, 1], [1.7, 4.5, -0.4, 1.8, 1], [0, 5.6, 0.8, 1.6, 0], [-0.9, 5.2, -1.1, 1.5, 0]]) {
    const fol = add(new THREE.SphereGeometry(fr * s, 10, 8), dk ? MAT.leafDk : MAT.leaf, fx * s, fy * s, fz * s, tg, { cast: false }); fol.scale.set(1.15, 0.72, 1.15);
  }
  bendTrees.push({ g: tg, ph: rnd2() * 6.28 });
  return tg;
}
function buildTufts(g, cx, cz) {
  for (let i = 0; i < 16; i++) {
    const a = rnd2() * Math.PI * 2, rr = 5.5 + rnd2() * 9;
    const tx = cx + Math.cos(a) * rr, tz = cz + Math.sin(a) * rr * 1.4;
    if (Math.abs(tx - cx) < 2.4 && tz > cz - 8 && tz < cz + 9) continue;
    const tuft = new THREE.Group(); tuft.position.set(tx, 0, tz); g.add(tuft);
    for (let k = 0; k < 4; k++) {
      const blade = add(new THREE.ConeGeometry(0.045, 0.6 + rnd2() * 0.45, 5), k % 2 ? MAT.reed : MAT.reedDk, (rnd2() - 0.5) * 0.3, 0.3, (rnd2() - 0.5) * 0.3, tuft, { cast: false });
      blade.rotation.z = (rnd2() - 0.5) * 0.24; blade.rotation.x = (rnd2() - 0.5) * 0.2;
    }
    tufts.push({ g: tuft, ph: rnd2() * 6.28 });
  }
}

// ---------- THE VILLAGE (storm day) ----------
const villageG = new THREE.Group(); scene.add(villageG);
{
  const g = villageG;
  // dirt street running north-south, grass either side
  MAT.path.map.repeat.set(2, 12);
  flat(add(new THREE.PlaneGeometry(7.5, 46), MAT.path, 0, 0.004, 2, g, { cast: false }));
  for (let i = 0; i < 22; i++) {
    const sx = -16 + rnd2() * 32, sz = -16 + rnd2() * 34;
    if (Math.abs(sx) < 3) continue;
    const st = add(new THREE.SphereGeometry(0.09 + rnd2() * 0.15, 7, 5), MAT.stoneDk, sx, 0.04, sz, g, { cast: false }); st.scale.set(1, 0.55, 1);
  }
  // huts: mud walls, thatch roofs, a door and a SHUTTERED window
  // facing the street. The shutters slam shut when the storm hits
  // and rattle in every gust (story worldAt.shutK / windK).
  const hut = (x, z, ry) => {
    const hg = new THREE.Group(); hg.position.set(x, 0, z); hg.rotation.y = ry; g.add(hg);
    add(tbox(2.6, 2.2, 2.4, 2), MAT.hutWall, 0, 1.1, 0, hg, { cast: true });
    const roof = add(new THREE.CylinderGeometry(0.15, 2.35, 1.15, 4), MAT.thatch, 0, 2.78, 0, hg, { cast: true }); roof.rotation.y = Math.PI / 4;
    add(box(0.7, 1.5, 0.06), MAT.dark, -0.55, 0.75, 1.21, hg, { cast: false });
    // window + twin shutters on the street face
    add(box(0.66, 0.72, 0.05), MAT.woodDk, 0.5, 1.45, 1.21, hg, { cast: false });
    add(box(0.54, 0.6, 0.04), MAT.dark, 0.5, 1.45, 1.22, hg, { cast: false });
    for (const sgn of [-1, 1]) {
      const hinge = new THREE.Group(); hinge.position.set(0.5 + sgn * 0.3, 1.45, 1.26); hg.add(hinge);
      const sh = add(tbox(0.3, 0.64, 0.04, 1), MAT.plankDk, -sgn * 0.15, 0, 0, hinge, { cast: false });
      shutters.push({ hinge, ph: rnd2() * 6.28, sgn });
    }
    return hg;
  };
  hut(-5.9, 0.3, Math.PI / 2); hut(5.9, 0.3, -Math.PI / 2);
  hut(-5.9, 7.7, Math.PI / 2); hut(5.9, 7.7, -Math.PI / 2);
  hut(-5.9, -6.5, Math.PI / 2); hut(5.9, -6.8, -Math.PI / 2);
  buildTree(g, -8.5, -6, 1.1); buildTree(g, 8.5, -7, 1.0); buildTree(g, -9.5, 12, 0.9); buildTree(g, 9.5, 13, 0.95);
  // one tree right behind the hero's run line — in the narrow
  // portrait close-up it is the storm made visible: bent double
  // by the same wind that drives the dust and the boy's clothes.
  buildTree(g, -1.6, 10.8, 1.05); buildTree(g, 2.8, 12.6, 0.9);
  buildTufts(g, 0, 0.8);
}

// ---------- THE FAIR (next day) ----------
const fairG = new THREE.Group(); fairG.position.set(80, 0, 0); scene.add(fairG);
{
  const g = fairG;
  const plazaMat = toon({ map: mudCanvas(41, '#a97e4e'), color: '#cfa96e' });
  plazaMat.map.repeat.set(4, 4);
  const plaza = flat(add(new THREE.CircleGeometry(6, 30), plazaMat, 0, 0.002, 0.8, g, { cast: false }));
  plaza.scale.set(1.2, 1.6, 1);
  for (let i = 0; i < 22; i++) {
    const sx = -18 + rnd2() * 36, sz = -18 + rnd2() * 36;
    if (Math.abs(sx) < 2.6) continue;
    const st = add(new THREE.SphereGeometry(0.09 + rnd2() * 0.15, 7, 5), MAT.stoneDk, sx, 0.04, sz, g, { cast: false }); st.scale.set(1, 0.55, 1);
  }
  buildTree(g, -9, -6, 1.15); buildTree(g, 9.5, -7, 1.05); buildTree(g, -10, 4, 0.9); buildTree(g, 10.5, 5, 1.0);
  // THE turban tree: bigger, with a low branch reaching over the
  // plaza — the branch the pagdi snags on.
  const tt = buildTree(g, 8.5, -5.5, 1.35);
  const branch = add(new THREE.CylinderGeometry(0.09, 0.13, 2.4, 6), MAT.trunk, -1.1, 2.78, 0.1, tt, { cast: false }); branch.rotation.z = 1.15;
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
  const tent = (x, z, mat) => {
    const tg = new THREE.Group(); tg.position.set(x, 0, z); g.add(tg);
    add(new THREE.CylinderGeometry(1.7, 1.8, 1.6, 12), MAT.jute, 0, 0.8, 0, tg, { cast: false });
    add(new THREE.ConeGeometry(2.1, 1.3, 12), mat, 0, 2.25, 0, tg, { cast: false });
    add(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 6), MAT.woodDk, 0, 3.2, 0, tg, { cast: false });
  };
  tent(-10.4, 2, MAT.clothGreen); tent(10.4, 2, MAT.clothPink);
  buildTufts(g, 0, 0.8);
  // bunting on two lines — the fair stays alive in the breeze,
  // and the trapped gust will tear through both lines.
  const lineY = (x) => 2.3 + 0.25 * (x / 3.8) * (x / 3.8);
  for (const pz of [7.5, -13.4]) {
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
// one shared grass sea under both sets
{
  MAT.grass.map.repeat.set(60, 60);
  flat(add(new THREE.PlaneGeometry(560, 500), MAT.grass, 40, -0.03, 0, scene, { cast: false }));
}

// ---------- THE CLAY POT (hero prop) ----------
// A true ghada profile on the lathe: foot, swelling belly, a
// pinched neck and a flared mouth — terracotta with a darker band.
const potProfile = [[0, 0], [0.2, 0.01], [0.31, 0.1], [0.35, 0.24], [0.33, 0.38], [0.24, 0.5], [0.19, 0.55], [0.2, 0.6], [0.25, 0.64], [0.26, 0.66]].map((p) => new THREE.Vector2(p[0], p[1]));
const potG = new THREE.Group(); scene.add(potG);
{
  const body = add(new THREE.LatheGeometry(potProfile, 22), MAT.clay, 0, 0, 0, potG, { cast: true });
  body.material.side = THREE.DoubleSide;
  add(new THREE.TorusGeometry(0.245, 0.02, 6, 20), MAT.clayDk, 0, 0.63, 0, potG, { cast: false }).rotation.x = Math.PI / 2;
  add(new THREE.TorusGeometry(0.345, 0.016, 6, 22), MAT.clayDk, 0, 0.26, 0, potG, { cast: false }).rotation.x = Math.PI / 2;
}
// the lid: a shallow clay dome with a knob
const lidG = new THREE.Group(); scene.add(lidG);
{
  const dome = add(new THREE.SphereGeometry(0.25, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), MAT.clayDk, 0, 0, 0, lidG, { cast: true });
  dome.scale.set(1, 0.55, 1);
  add(new THREE.SphereGeometry(0.06, 8, 6), MAT.clay, 0, 0.13, 0, lidG, { cast: false });
}
// the rope: three wraps around the neck + a hanging tail; the
// wraps appear one by one as ropeK climbs (and vanish as it falls)
const ropeG = new THREE.Group(); scene.add(ropeG);
const ropeWraps = [];
{
  for (let i = 0; i < 3; i++) {
    const w = add(new THREE.TorusGeometry(0.225, 0.024, 6, 18), MAT.rope, 0, 0.5 + i * 0.045, 0, ropeG, { cast: false });
    w.rotation.x = Math.PI / 2; ropeWraps.push(w);
  }
  const tail = add(new THREE.CylinderGeometry(0.02, 0.016, 0.34, 5), MAT.rope, 0.2, 0.36, 0.1, ropeG, { cast: false });
  tail.rotation.z = 0.25; ropeWraps.push(tail);
}
// ---------- THE TURBAN (the mukhiya's pagdi) ----------
// A wrapped band + dome + a hanging tail that flutters in the
// wind. It lives on his head, flies, hangs in the tree, and is
// fetched back down — one prop, four modes (story.turbanStateAt).
const turbanG = new THREE.Group(); scene.add(turbanG);
const turbanTail = new THREE.Group();
{
  add(new THREE.TorusGeometry(0.155, 0.072, 8, 16), MAT.saffron, 0, 0, 0, turbanG, { cast: true }).rotation.x = Math.PI / 2;
  const dome = add(new THREE.SphereGeometry(0.15, 12, 8), MAT.saffron, 0, 0.045, 0, turbanG, { cast: true }); dome.scale.set(1, 0.72, 1);
  add(new THREE.TorusGeometry(0.15, 0.03, 6, 14), MAT.saffronDk, 0, -0.045, 0, turbanG, { cast: false }).rotation.x = Math.PI / 2;
  turbanTail.position.set(0.15, 0.02, 0.05); turbanG.add(turbanTail);
  const tail = add(new THREE.PlaneGeometry(0.15, 0.44), MAT.saffron, 0, -0.22, 0, turbanTail, { cast: false });
  tail.material = tail.material.clone(); tail.material.side = THREE.DoubleSide;
}
// the kids' little pots
const kidPotGs = [];
for (let i = 0; i < 3; i++) {
  const kg = new THREE.Group(); kg.scale.setScalar(0.55); scene.add(kg);
  const b = add(new THREE.LatheGeometry(potProfile, 16), i === 1 ? MAT.clayDk : MAT.clay, 0, 0, 0, kg, { cast: true });
  b.material = b.material; kidPotGs.push(kg);
}
// ---------- FOREGROUND PARALLAX: the cart edge ----------
// A bullock-cart's wheel + side plank sweeps close past the lens
// during the run shot (f136-180) — pure foreground parallax.
const cartG = new THREE.Group(); scene.add(cartG);
{
  const wheel = new THREE.Group(); cartG.add(wheel); wheel.name = 'wheel';
  add(new THREE.TorusGeometry(0.55, 0.055, 8, 20), MAT.woodDk, 0, 0.55, 0, wheel, { cast: false });
  add(new THREE.CylinderGeometry(0.09, 0.09, 0.1, 8), MAT.wood, 0, 0.55, 0, wheel, { cast: false }).rotation.x = Math.PI / 2;
  for (let i = 0; i < 4; i++) { const sp = add(box(0.07, 1.0, 0.05), MAT.wood, 0, 0.55, 0, wheel, { cast: false }); sp.rotation.z = i * Math.PI / 4; }
  add(tbox(2.4, 0.55, 0.07, 2), MAT.plankDk, 0.4, 1.05, 0, cartG, { cast: false });
  add(tbox(2.4, 0.1, 0.5, 2), MAT.plank, 0.4, 1.32, 0.2, cartG, { cast: false });
  cartG.visible = false;
}
// ---------- FLYING PAPERS (the laugh beat) ----------
const paperGs = [];
for (let i = 0; i < 5; i++) {
  const pg = new THREE.Group(); scene.add(pg);
  add(new THREE.PlaneGeometry(0.24, 0.32), MAT.paper, 0, 0, 0, pg, { cast: false });
  pg.visible = false; paperGs.push(pg);
}
// ---------- boards ----------
// The hook board beyond the fair tree line, facing the finale
// camera. Transform mirrored in boards.json — keep in sync.
// Painted in the proven safe regime for Devanagari conjuncts
// (fsMul tuned by measure_boards to land ~51-54 px).
const boardHook = textBoard(['लेकिन कल...', 'वह नाई जो बिना कैंची के', 'बाल काट देता था?'], 3.9, 1.75, '#2a1a0c', '#ffe9a8', 900, { pitch: 0.22, dy: 0.03, fsMul: 0.78 });
boardHook.position.set(...BOARD_POS); scene.add(boardHook); addBoardOccluder(boardHook, 3.9, 1.75, 'hookK');
add(tbox(0.09, 2.8, 0.09, 2), MAT.woodDk, BOARD_POS[0] - 0.9, 1.3, -11.3, scene, { cast: false });
add(tbox(0.09, 2.8, 0.09, 2), MAT.woodDk, BOARD_POS[0] + 0.9, 1.3, -11.3, scene, { cast: false });

// ---------- FX: dust, storm clouds, fair clouds ----------
// The storm is a living system: dust sheets sweep the street on
// the one wind (toward +z), the pot throws a dust ring as it
// fills, the lid SLAM puffs, and the trapped gust bursts along
// its path — pot -> mukhiya -> mid-air -> tree — at the pop.
const smoke = new FX.Smoke(scene, 170); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const stormClouds = new FX.Clouds(scene, { count: 9, y: 46, opacity: 0.5, color: 0x59687c, drift: 1.5, rim: false });
const fairClouds = new FX.Clouds(scene, { count: 6, y: 58, opacity: 0.3, color: 0xffffff, drift: 0.35 });
for (const cs of [stormClouds, fairClouds]) cs.items.forEach((cl) => { cl.userData.x0 = cl.position.x; cl.traverse((m) => { m.userData.ndSkip = true; if (m.isSprite) m.userData.baseOp = m.material.opacity; }); });
let fxF = -1;
const fxReset = () => {
  smoke.pool.forEach((p) => { p.life = -1; p.s.visible = false; }); smoke.emitters.forEach((e) => { e.acc = 0; });
  for (const cs of [stormClouds, fairClouds]) cs.items.forEach((cl) => { cl.position.x = cl.userData.x0; });
};
const fxStepTo = (f) => {
  if (f === fxF) return;
  if (f < fxF || f > fxF + 240) { fxReset(); fxF = -1; }
  while (fxF < f) {
    fxF++; const t = fxF / 30, dt = 1 / 30;
    const Ws = worldAt(fxF), S = shotAt(fxF);
    if (S.light === 'storm') {
      // dust sheets sweeping the street on the wind
      if (fxF % 13 === 0) smoke.burst(-5 + Math.random() * 10, 0.3, -7 + Math.random() * 9, { n: 2, color: 0x9a8a70, opacity: 0.15, scale: 1.7, grow: 2.4, life: 1.7, vy: 0.22, vz: 2.6, wind: 0 });
      // the pot drinks the wind: a dust ring at its mouth
      if (fxF >= 312 && fxF <= 420 && fxF % 17 === 0) smoke.burst(0, 1.0, 2.1, { n: 3, color: 0xbfae8f, opacity: 0.22, scale: 0.5, grow: 1.6, life: 0.8, vy: 0.5, vz: -0.6, wind: 0 });
      if (fxF === SLAM_LID) smoke.burst(0, 0.72, 2.3, { n: 6, color: 0xbfae8f, opacity: 0.3, scale: 0.45, grow: 1.6, life: 0.8, vy: 0.6, wind: 0.3 });
    } else {
      if (fxF === POP) {
        smoke.burst(80, 0.85, 1.5, { n: 16, color: 0xbfae8f, opacity: 0.4, scale: 0.7, grow: 2.2, life: 1.1, vy: 1.3, vz: -0.4, wind: 0.4 });
        smoke.burst(80, 0.4, 1.5, { n: 8, color: 0x9a8a70, opacity: 0.3, scale: 1.1, grow: 2.4, life: 1.3, vy: 0.3, vz: 0.8, wind: 0.3 });
      }
      if (fxF === 932) smoke.burst(81.3, 1.5, 2.7, { n: 8, color: 0xbfae8f, opacity: 0.32, scale: 0.6, grow: 1.8, life: 0.9, vy: 0.7, wind: 0.5 });
      if (fxF === 968) smoke.burst(84.5, 2.3, -1, { n: 6, color: 0xbfae8f, opacity: 0.26, scale: 0.6, grow: 1.8, life: 0.9, vy: 0.4, wind: 0.3 });
      if (fxF === 1010) smoke.burst(87.4, 2.6, -4.4, { n: 7, color: 0x5d7d3a, opacity: 0.3, scale: 0.55, grow: 1.7, life: 1.0, vy: 0.3, wind: 0.2 });
    }
    smoke.update(t, dt);
    stormClouds.update(t, dt * (0.35 + (Ws.windK || 0) * 2.4));
    fairClouds.update(t, dt);
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
  stormClouds.group.visible = (Ws.stormK ?? 0) > 0.5;
  fairClouds.group.visible = !stormClouds.group.visible;
  const wind = Ws.windK ?? 0.1;
  // THE POT: follows its state; the shake is the trapped wind
  // straining — rotation jitter scaled by potShake.
  const ps = potStateAt(f);
  potG.position.set(ps.x, ps.y, ps.z);
  const shake = Ws.potShake ?? 0;
  potG.rotation.z = Math.sin(t * 38) * 0.05 * shake;
  potG.rotation.x = (ps.mode === 'hands' ? -0.3 : ps.mode === 'held' ? -0.42 : 0) + Math.sin(t * 31) * 0.035 * shake;
  // THE LID
  const ls = lidStateAt(f);
  lidG.position.set(ls.x, ls.y, ls.z);
  lidG.rotation.set(ls.mode === 'ground' ? 1.15 : 0, (ls.spin || 0) * 1.7, (ls.spin || 0) * 0.6);
  // THE ROPE: wraps ride on the pot's neck
  const rk = ropeK(f);
  ropeG.visible = rk > 0.02;
  ropeG.position.set(ps.x, ps.mode === 'held' ? ps.y : 0, ps.z);
  ropeWraps.forEach((w, i) => { w.visible = rk * 3 > i + 0.4; });
  // THE TURBAN
  const ts = turbanStateAt(f);
  turbanG.position.set(ts.x, ts.y, ts.z);
  turbanG.rotation.set(0, (ts.spin || 0) * 1.3, Math.sin(t * 2.2) * 0.13 * (ts.sway || 0) + (ts.mode === 'tree' ? 0.35 : 0));
  turbanTail.rotation.x = Math.sin(t * 7.3) * 0.32 * (0.25 + wind) + Math.sin(t * 2.1) * 0.1;
  turbanTail.rotation.z = Math.sin(t * 5.1 + 1) * 0.18 * (0.25 + wind);
  // kids' pots
  const kps = kidPotsAt(f);
  kidPotGs.forEach((kg, i) => {
    const kp = kps[i];
    kg.visible = !!kp;
    if (kp) { kg.position.set(kp.x, kp.y, kp.z); kg.rotation.x = -0.25; }
  });
  // window shutters: slammed shut on the storm day, rattling in
  // every gust; open on the fair day (the village sleeps then)
  for (const sh of shutters) {
    sh.hinge.rotation.y = sh.sgn * ((1 - (Ws.shutK ?? 0)) * 0.85 + Math.sin(t * 9 + sh.ph) * 0.055 * wind * (Ws.shutK ?? 0));
  }
  // trees bend in the ONE wind (toward +z), never uniformly
  for (const bt of bendTrees) bt.g.rotation.x = wind * 0.06 * (0.7 + 0.3 * Math.sin(t * 1.4 + bt.ph));
  // bunting: breeze ripple, tearing flap when the gust spikes
  for (const fg of flags) {
    fg.rotation.y = Math.sin(t * (2.4 + wind * 4.5) + fg.userData.ph) * (0.28 + 0.55 * wind) + Math.sin(t * 0.53 + fg.userData.ph * 2) * 0.12;
    fg.rotation.x = Math.sin(t * (3.1 + wind * 3) + fg.userData.ph * 2) * (0.08 + 0.14 * wind);
  }
  for (const r of tufts) r.g.rotation.z = Math.sin(t * (1.25 + wind * 2.2) + r.ph) * (0.05 + 0.17 * wind) + Math.sin(t * 0.37 + r.ph * 2) * 0.03;
  // the cart edge: foreground parallax across the run shot
  if (f >= 136 && f <= 182) {
    cartG.visible = true;
    const u = (f - 136) / 46;
    cartG.position.set(-7.5 + 15 * u, 0, 1.05);
    const wheel = cartG.getObjectByName('wheel');
    if (wheel) wheel.rotation.z = -(-7.5 + 15 * u) / 0.55;
  } else cartG.visible = false;
  // flying papers on the laugh beat: five sheets tumble across
  // the fair on the gust's dying breath
  paperGs.forEach((pg, i) => {
    if (f >= 1256 && f <= 1360) {
      pg.visible = true;
      const u = ((f - 1256) / 104 + i * 0.21) % 1;
      pg.position.set(80 - 1 + u * 7.5, 1.1 + Math.sin(u * Math.PI) * (0.9 + i * 0.22), 2.3 - u * 2.6 + Math.sin(i * 7) * 0.5);
      pg.rotation.set(u * 9 + i, u * 7, u * 5 + i * 2);
    } else pg.visible = false;
  });
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
