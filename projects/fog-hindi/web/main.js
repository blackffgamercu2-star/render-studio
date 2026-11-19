import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import * as M4 from './materials.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, BOARD_POS, ROPE_MARKS, ROPE_X, deckY, cartAAt, cartBState } from './story.js';
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
  grass: toon({ map: grassCanvas(191), color: '#8ba371' }),
  mud: toon({ map: mudCanvas(5, '#a97e4e'), color: '#b28a58' }),
  mudDk: toon({ map: mudCanvas(6, '#8a6538'), color: '#a37c4e' }),
  path: toon({ map: mudCanvas(31, '#9a7a4a'), color: '#b08e5c' }),
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
  brass: new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.9, roughness: 0.32, envMap, envMapIntensity: 1.1 }),
  iron: toon({ color: '#2e2a26' }),
  clothRed: toon({ color: '#b3392e' }), clothBlue: toon({ color: '#2f5d8a' }), clothGold: toon({ color: '#d9a441' }),
};

// ---------- THE FOG VALLEY: gate (S) -> bridge -> mandi (N) ----------
// One continuous set on a single axis. Fields either side, a dirt
// path down the middle, the river cut across at z -0.9..-5.3 with
// the plank bridge over it (deck y 0.55, z 1.6..-5.6), village huts
// behind the gate, the mandi stalls at the north end. The guide rope
// runs at x=-0.5 from the gate post to the mandi post.
const world = new THREE.Group(); scene.add(world);
const reeds = [];
{
  const g = world;
  MAT.grass.map.repeat.set(18, 18);
  // fields: two big planes leaving the river trench open
  flat(add(new THREE.PlaneGeometry(150, 50), MAT.grass, 0, -0.05, 24.1, g, { cast: false }));
  flat(add(new THREE.PlaneGeometry(150, 50), MAT.grass, 0, -0.05, -30.3, g, { cast: false }));
  // river banks: mud slopes down to the water
  const bankS = add(box(150, 0.08, 2.4), MAT.mudDk, 0, -0.6, -1.5, g, { cast: false }); bankS.rotation.x = -0.5;
  const bankN = add(box(150, 0.08, 2.4), MAT.mudDk, 0, -0.6, -4.7, g, { cast: false }); bankN.rotation.x = 0.5;
  // the dirt path, in two pieces (the bridge carries it over)
  MAT.path.map.repeat.set(1.5, 10);
  flat(add(new THREE.PlaneGeometry(3.4, 17.3), MAT.path, 0, 0.006, 7.85, g, { cast: false }));
  flat(add(new THREE.PlaneGeometry(3.4, 8.2), MAT.path, 0, 0.006, -9.3, g, { cast: false }));
  // mandi plaza: packed earth at the north end
  const plazaMat = toon({ map: mudCanvas(41, '#a97e4e'), color: '#bb955e' });
  plazaMat.map.repeat.set(4, 4);
  const plaza = flat(add(new THREE.CircleGeometry(5.6, 30), plazaMat, 0, 0.004, -14.6, g, { cast: false }));
  plaza.scale.set(1.3, 1, 1);
  // scattered stones
  let sd2 = 47; const rnd2 = () => (sd2 = (sd2 * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 34; i++) {
    const sx = -18 + rnd2() * 36, sz = -18 + rnd2() * 36;
    if (Math.abs(sx) < 2.6 || (sz > -6 && sz < 0)) continue;
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
  tree(-13, 6, 1.15); tree(12, -2, 1.05); tree(-9, -14, 0.9); tree(13.5, 10.5, 1.0); tree(-14, -8, 0.95);
  // ---- village huts behind the gate
  const hut = (x, z, ry, s = 1) => {
    const hg = new THREE.Group(); hg.position.set(x, 0, z); hg.rotation.y = ry; hg.scale.setScalar(s); g.add(hg);
    add(tbox(4.2, 2.9, 3.4, 2), MAT.mud, 0, 1.45, 0, hg, { cast: false });
    const r1 = add(tbox(4.8, 0.12, 2.4, 2), MAT.thatch, -1.15, 3.35, 0, hg, { cast: false }); r1.rotation.z = 0.5;
    const r2 = add(tbox(4.8, 0.12, 2.4, 2), MAT.thatch, 1.15, 3.35, 0, hg, { cast: false }); r2.rotation.z = -0.5;
    add(box(0.8, 1.6, 0.06), MAT.woodDk, 0.6, 0.8, 1.72, hg, { cast: false });
  };
  hut(-8.5, 17.8, 0.4, 0.95); hut(8.2, 18.2, -0.35, 0.95); hut(-13.5, 16.5, 0.7, 0.85);
  // ---- THE GATE: two posts + a crossbeam the rope post stands by
  add(tbox(0.16, 2.3, 0.16, 2), MAT.woodDk, -1.3, 1.15, 13.2, g, { cast: false });
  add(tbox(0.16, 2.3, 0.16, 2), MAT.woodDk, 1.5, 1.15, 13.2, g, { cast: false });
  const beam = add(tbox(3.3, 0.14, 0.14, 2), MAT.woodDk, 0.1, 2.32, 13.2, g, { cast: false }); beam.rotation.z = 0.02;
  // ---- reed tufts along both banks (they sway in the one wind)
  for (let x = -16; x <= 16; x += 2.2) {
    if (Math.abs(x) < 2.4) continue;
    for (const bz of [-1.55, -4.75]) {
      const tuft = new THREE.Group(); tuft.position.set(x + (rnd2() - 0.5) * 0.8, bz === -1.55 ? -0.75 : -0.75, bz + (rnd2() - 0.5) * 0.3); g.add(tuft);
      for (let k = 0; k < 4; k++) {
        const blade = add(new THREE.ConeGeometry(0.045, 0.85 + rnd2() * 0.5, 5), k % 2 ? MAT.reed : MAT.reedDk, (rnd2() - 0.5) * 0.3, 0.42, (rnd2() - 0.5) * 0.3, tuft, { cast: false });
        blade.rotation.z = (rnd2() - 0.5) * 0.24; blade.rotation.x = (rnd2() - 0.5) * 0.2;
      }
      reeds.push({ g: tuft, ph: rnd2() * 6.28 });
    }
  }
}
// ---------- the river ----------
const water = FX.makeWater({ size: 76, seg: 60, deep: 0x2c4a55, shallow: 0x5d7d84, sky: 0xc3ced2, amp: 0.05, spark: 0 });
water.scale.set(1, 0.042, 1); water.position.set(0, -1.25, -3.1); water.userData.ndSkip = true; scene.add(water);
add(new THREE.PlaneGeometry(76, 4.4), toon({ color: '#1d3038' }), 0, -1.48, -3.1, scene, { cast: false }).rotation.x = -Math.PI / 2;
// ---------- THE BRIDGE: planks, rails, piles ----------
// Deck y 0.55, z 1.6..-5.6. One east plank at z=-3.45 sits DROPPED
// by 0.10 — the gap that catches cart A's wheel.
{
  const g = world;
  add(tbox(2.0, 0.1, 7.6, 2), MAT.woodDk, 0, 0.44, -2.0, g, { cast: false }); // stringer bed
  for (let i = 0; i < 13; i++) {
    const z = 1.45 - i * 0.575;
    add(tbox(0.95, 0.09, 0.5, 2), i % 2 ? MAT.plank : MAT.plankDk, -0.45, 0.545, z, g, { cast: false });
    const dropped = Math.abs(z + 3.45) < 0.3;
    add(tbox(0.9, 0.09, 0.5, 2), i % 2 ? MAT.plankDk : MAT.plank, 0.5, dropped ? 0.445 : 0.545, z, g, { cast: false });
  }
  const rampS = add(tbox(2.0, 0.09, 2.0, 2), MAT.plank, 0, 0.27, 2.45, g, { cast: false }); rampS.rotation.x = 0.33;
  const rampN = add(tbox(2.0, 0.09, 2.0, 2), MAT.plank, 0, 0.27, -6.45, g, { cast: false }); rampN.rotation.x = -0.33;
  for (const px of [-0.85, 0.85]) for (const pz of [0.6, -2.0, -4.6]) {
    add(new THREE.CylinderGeometry(0.09, 0.11, 1.9, 7), MAT.woodDk, px, -0.35, pz, g, { cast: false });
  }
  // side posts + rope rails
  for (const px of [-1.15, 1.35]) for (const pz of [1.6, -2.0, -5.6]) {
    add(tbox(0.09, 1.05, 0.09, 2), MAT.woodDk, px, 1.05, pz, g, { cast: false });
  }
  for (const px of [-1.15, 1.35]) for (const [z0, z1] of [[1.6, -2.0], [-2.0, -5.6]]) {
    const len = Math.abs(z1 - z0);
    const rail = add(new THREE.CylinderGeometry(0.028, 0.028, len, 6), MAT.rope, px, 1.52, (z0 + z1) / 2, g, { cast: false });
    rail.rotation.x = Math.PI / 2;
  }
}
// ---------- THE GUIDE ROPE: posts, sag, bells, knot codes ----------
// Post tops follow the ground/deck so the rope rides ~1.12 m above
// whatever the walkers stand on; each span sags a little between
// posts. Bells hang from straps and SWING with story.bellK; the
// knot codes are lumps tied into the rope itself.
const ROPE_POSTS = [[13.2, 1.12], [8, 1.12], [3.4, 1.12], [1.6, 1.67], [-5.6, 1.67], [-7.4, 1.12], [-11.5, 1.12]];
const ropeY = (z) => {
  for (let i = 1; i < ROPE_POSTS.length; i++) {
    const [z0, y0] = ROPE_POSTS[i - 1], [z1, y1] = ROPE_POSTS[i];
    if (z <= z0 && z >= z1) {
      const u = (z0 - z) / (z0 - z1);
      return y0 + (y1 - y0) * u - Math.sin(Math.PI * u) * 0.09;
    }
  }
  return 1.12;
};
const ropeG = new THREE.Group(); scene.add(ropeG);
const bells = [];
{
  for (const [pz, top] of ROPE_POSTS) {
    const base = deckY(pz);
    add(tbox(0.09, top - base + 0.25, 0.09, 2), MAT.woodDk, ROPE_X, (top + base) / 2 - 0.02, pz, ropeG, { cast: false });
  }
  const pts = [];
  for (let z = 13.2; z >= -11.5; z -= 0.6) pts.push(new THREE.Vector3(ROPE_X, ropeY(z), z));
  pts.push(new THREE.Vector3(ROPE_X, ropeY(-11.5), -11.5));
  const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.026, 6), MAT.rope);
  tube.castShadow = false; ropeG.add(tube);
  ROPE_MARKS.forEach((mk, i) => {
    const y = ropeY(mk.z);
    if (mk.type === 'knot1' || mk.type === 'knot2') {
      const n = mk.type === 'knot1' ? 1 : 2;
      for (let k = 0; k < n; k++) {
        const lump = add(new THREE.SphereGeometry(0.058, 8, 6), MAT.rope, ROPE_X, y, mk.z + (k - (n - 1) / 2) * 0.13, ropeG, { cast: false });
        lump.scale.set(1, 0.85, 1.25);
      }
      return;
    }
    const n = mk.type === 'bells3' ? 3 : 1;
    for (let k = 0; k < n; k++) {
      const bg = new THREE.Group(); bg.position.set(ROPE_X, y, mk.z + (k - (n - 1) / 2) * 0.17); ropeG.add(bg);
      add(box(0.03, 0.09, 0.03), MAT.rope, 0, -0.045, 0, bg, { cast: false });
      add(new THREE.CylinderGeometry(0.034, 0.078, 0.115, 10, 1, true), MAT.brass, 0, -0.15, 0, bg, { cast: true });
      add(new THREE.SphereGeometry(0.036, 8, 6), MAT.brass, 0, -0.095, 0, bg, { cast: false });
      add(new THREE.TorusGeometry(0.078, 0.013, 5, 12), MAT.brass, 0, -0.205, 0, bg, { cast: false }).rotation.x = Math.PI / 2;
      add(new THREE.SphereGeometry(0.02, 6, 5), MAT.iron, 0, -0.21, 0, bg, { cast: false });
      bells.push({ g: bg, ph: i * 1.7 + k * 0.9 });
    }
  });
}
// ---------- THE MANDI: stalls, sacks, lanterns ----------
const lanternGlows = [];
{
  const g = world;
  const stall = (x, z, awning) => {
    const sg = new THREE.Group(); sg.position.set(x, 0, z); g.add(sg);
    for (const [px, pz] of [[-1.6, -0.9], [1.6, -0.9], [-1.6, 0.9], [1.6, 0.9]]) {
      add(tbox(0.09, 2.3, 0.09, 2), MAT.woodDk, px, 1.15, pz, sg, { cast: false });
    }
    const awn = add(tbox(3.8, 0.07, 2.4, 2), awning, 0, 2.42, 0, sg, { cast: false }); awn.rotation.x = 0.16;
    add(tbox(3.2, 0.75, 0.9, 2), MAT.wood, 0, 0.38, 0.55, sg, { cast: false }); // counter
    for (let k = 0; k < 3; k++) {
      const sack = add(new THREE.SphereGeometry(0.3 - k * 0.03, 9, 7), MAT.jute, -0.9 + k * 0.75, 0.88, 0.5, sg, { cast: false });
      sack.scale.set(1, 0.78, 1);
    }
    return sg;
  };
  stall(-3.9, -15.9, MAT.clothRed); stall(3.9, -15.9, MAT.clothBlue);
  // loose grain sacks waiting by the rope post
  for (const [sx, sz, ss] of [[-1.9, -12.3, 0.36], [-1.45, -12.75, 0.3], [2.2, -13.4, 0.33]]) {
    const sack = add(new THREE.SphereGeometry(ss, 9, 7), MAT.jute, sx, ss * 0.72, sz, g, { cast: false });
    sack.scale.set(1, 0.78, 1);
    add(new THREE.ConeGeometry(0.09, 0.14, 7), MAT.jute, sx, ss * 1.5, sz, g, { cast: false });
  }
  // lanterns: gate + both stalls — lit all morning, reading warm
  // through the fog, then glowing openly once it lifts (lampK).
  const glowTexL = P.tex(P.radial('255,205,130', 0.85));
  for (const [lx, ly, lz] of [[1.5, 2.05, 13.2], [-3.9, 2.1, -15.2], [3.9, 2.1, -15.2]]) {
    add(new THREE.SphereGeometry(0.075, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: true }), lx, ly, lz, g, { cast: false });
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexL, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    spr.position.set(lx, ly, lz); spr.scale.set(1.1, 1.1, 1); spr.userData.ndSkip = true; spr.renderOrder = 3; g.add(spr);
    lanternGlows.push(spr);
  }
}
// a sun-glint sprite on the bridge-edge bell cluster (reveal only)
const bellGlint = new THREE.Sprite(new THREE.SpriteMaterial({ map: P.tex(P.radial('255,240,200', 0.9)), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
bellGlint.position.set(ROPE_X, 1.62, -6.3); bellGlint.scale.set(0.8, 0.8, 1); bellGlint.userData.ndSkip = true; bellGlint.renderOrder = 3; scene.add(bellGlint);
// ---------- boards ----------
// The hook board: next story's question, standing at the mandi
// edge facing south (toward the arriving queue and the camera).
// Its transform is mirrored in boards.json — keep in sync. It rises
// at the start of the final shot and HOLDS at full opacity to the
// literal final frame. Painted in the proven safe regime for
// Devanagari conjuncts (fit fsMul 0.76 -> fs ~53 px).
const boardHook = textBoard(['लेकिन कल...', 'वह लड़का जो बिना नाव के', 'नदी पार कर जाता था?'], 3.9, 1.75, '#2a1a0c', '#ffe9a8', 900, { pitch: 0.22, dy: 0.03, fsMul: 0.76 });
boardHook.position.set(...BOARD_POS); world.add(boardHook); addBoardOccluder(boardHook, 3.9, 1.75, 'hookK');
add(tbox(0.09, 2.6, 0.09, 2), MAT.woodDk, -0.75, 1.0, -12.7, world, { cast: false });
add(tbox(0.09, 2.6, 0.09, 2), MAT.woodDk, 0.95, 1.0, -12.7, world, { cast: false });
// ---------- THE GRAIN CARTS (custom build — wheels must spin) ----------
// Plank bed on side rails, ONE axle pair of big spoked wheels,
// pull handles at the front (north) end, three jute grain sacks.
// The east wheel of cart A is the one that drops into the gap.
const buildCart = () => {
  const g = new THREE.Group(); scene.add(g);
  add(tbox(1.15, 0.1, 1.8, 2), MAT.plank, 0, 0.66, 0, g, { cast: true });
  add(tbox(1.15, 0.2, 0.07, 2), MAT.woodDk, 0, 0.8, 0.87, g, { cast: false });
  add(tbox(1.15, 0.2, 0.07, 2), MAT.woodDk, 0, 0.8, -0.87, g, { cast: false });
  add(tbox(0.07, 0.2, 1.8, 2), MAT.woodDk, -0.54, 0.8, 0, g, { cast: false });
  add(tbox(0.07, 0.2, 1.8, 2), MAT.woodDk, 0.54, 0.8, 0, g, { cast: false });
  const axle = add(new THREE.CylinderGeometry(0.05, 0.05, 1.45, 8), MAT.woodDk, 0, 0.44, 0, g, { cast: false });
  axle.rotation.z = Math.PI / 2;
  const mkWheel = (side) => {
    const wg = new THREE.Group(); wg.position.set(0.68 * side, 0.44, 0); g.add(wg);
    const spin = new THREE.Group(); wg.add(spin);
    add(new THREE.TorusGeometry(0.44, 0.05, 8, 20), MAT.woodDk, 0, 0, 0, spin, { cast: true }).rotation.y = Math.PI / 2;
    for (let k = 0; k < 6; k++) {
      const sp = add(box(0.05, 0.8, 0.05), MAT.wood, 0, 0, 0, spin, { cast: false });
      sp.rotation.x = k * Math.PI / 6 * 2;
    }
    const hub = add(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 10), MAT.iron, 0, 0, 0, spin, { cast: false });
    hub.rotation.z = Math.PI / 2;
    return { wg, spin };
  };
  const wheelL = mkWheel(-1), wheelR = mkWheel(1);
  for (const hx of [-0.4, 0.4]) {
    const pole = add(new THREE.CylinderGeometry(0.035, 0.04, 0.95, 7), MAT.wood, hx, 0.72, -1.18, g, { cast: false });
    pole.rotation.x = 0.5;
  }
  const sacks = [];
  for (const [sx, sz, ss] of [[-0.26, -0.42, 0.34], [0.27, 0.12, 0.31], [0.0, 0.55, 0.29]]) {
    const sack = add(new THREE.SphereGeometry(ss, 10, 8), MAT.jute, sx, 0.71 + ss * 0.72, sz, g, { cast: true });
    sack.scale.set(1, 0.78, 1); sacks.push(sack);
    add(new THREE.ConeGeometry(0.085, 0.13, 7), MAT.jute, sx, 0.71 + ss * 1.48, sz, g, { cast: false });
  }
  return { g, wheelL, wheelR, sacks };
};
const cartA = buildCart(), cartB = buildCart();
// ---------- FX: layered fog, sky clouds, dust ----------
// THE FOG is built in layers, all drifting on ONE wind (+x):
// (1) scene.fog reach from lightFor, (2) big soft Smoke banks at
// seven points along the set, (3) two mistBand sprite layers,
// (4) three vertical fog SHEETS the queue walks through. At the
// reveal every layer thins with fogK and the warm grade takes over.
const smoke = new FX.Smoke(scene, 300); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const fogEmitOpts = { color: 0xe6edf2, opacity: 0.08, scale: 2.6, grow: 1.15, life: 4.4, vy: 0.06, wind: 0.22, vx: 0.05 };
const fogEmitters = [
  smoke.addEmitter(-7, -0.4, -3.1, { ...fogEmitOpts }), smoke.addEmitter(0, -0.4, -3.1, { ...fogEmitOpts }), smoke.addEmitter(7, -0.4, -3.1, { ...fogEmitOpts }),
  smoke.addEmitter(-2.5, 0.5, 6, { ...fogEmitOpts, scale: 2.9 }), smoke.addEmitter(2.5, 0.5, 6, { ...fogEmitOpts, scale: 2.9 }),
  smoke.addEmitter(0, 0.6, 12.3, { ...fogEmitOpts }), smoke.addEmitter(3.5, 0.9, -2, { ...fogEmitOpts }),
  smoke.addEmitter(0, 0.5, -12.5, { ...fogEmitOpts, scale: 2.9 }),
];
const mist1 = FX.mistBand(scene, { count: 9, y: 1.5, opacity: 0.12 });
const mist2 = FX.mistBand(scene, { count: 7, y: 2.2, opacity: 0.09 });
for (const mb of [mist1, mist2]) {
  mb.position.z = 7;
  mb.traverse((m) => { m.userData.ndSkip = true; if (m.isSprite) m.userData.baseOp = m.material.opacity; });
}
const fogSheets = [];
{
  const sheetTex = P.tex(P.radial('226,233,238', 0.5));
  for (const sz of [9.5, 0.5, -6.8]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(30, 6.5), new THREE.MeshBasicMaterial({ map: sheetTex, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    m.position.set(0, 2.1, sz); m.userData.ndSkip = true; m.renderOrder = 1; scene.add(m); fogSheets.push(m);
  }
}
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
    fxF++; const t = fxF / 30, dt = 1 / 30, Ws = worldAt(fxF);
    const fk = Ws.fogK ?? 0.9;
    // dust puffs: the wheel DROPS (f1415) and POPS free (f1506)
    if (fxF === 1415) smoke.burst(0.73, deckY(-3.4) + 0.18, -3.4, { n: 10, color: 0xa08b6a, opacity: 0.32, scale: 0.42, grow: 1.5, life: 0.9, vy: 0.5, wind: 0.2 });
    if (fxF === 1506) smoke.burst(0.73, deckY(-3.4) + 0.18, -3.4, { n: 13, color: 0xa08b6a, opacity: 0.34, scale: 0.46, grow: 1.6, life: 1.0, vy: 0.65, wind: 0.2 });
    for (const e of fogEmitters) e.rate = 1.35 * fk + 0.12;
    smoke.update(t, dt); fxClouds.update(t, dt);
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
const applyCart = (cart, st) => {
  cart.g.position.set(st.x, st.y, st.z);
  cart.g.rotation.z = -0.075 * (st.drop || 0) + (st.wob || 0) * 0.02;
  cart.g.rotation.x = (st.wob || 0) * 0.012;
  cart.wheelL.spin.rotation.x = st.spin; cart.wheelR.spin.rotation.x = st.spin;
  cart.wheelR.wg.position.y = 0.44 - 0.1 * (st.drop || 0);
  cart.sacks.forEach((s) => { s.rotation.z = (st.wob || 0) * 0.25; });
};
function worldState(Ws, f) {
  fxStepTo(f);
  const t = f / 30;
  skyU.time.value = t;
  scene.traverse((o) => { if (o.userData.isOccluder) o.visible = o.userData.boardKey === 'always' || (Ws[o.userData.boardKey] ?? 1) > 0.01; });
  boardHook.material.opacity = Ws.hookK ?? 1; boardHook.visible = (Ws.hookK ?? 1) > 0.01;
  // the carts: position, wheel spin, the stuck drop and the settle
  applyCart(cartA, cartAAt(f));
  applyCart(cartB, cartBState(f));
  // the bells swing with the rope's energy; at the great clang the
  // whole rope shudders on its posts
  const bk = Ws.bellK ?? 0.08;
  for (const b of bells) b.g.rotation.x = Math.sin(t * 2.6 + b.ph) * (0.05 + bk * 0.42);
  ropeG.position.y = bk > 0.5 ? Math.sin(t * 41) * 0.008 * bk : 0;
  // fog layers thin with fogK; the mist drifts on the one wind
  const fk = Ws.fogK ?? 0.9;
  for (const s of fogSheets) s.material.opacity = 0.03 + 0.14 * fk;
  for (const mb of [mist1, mist2]) mb.traverse((m) => { if (m.isSprite && m.userData.baseOp !== undefined) m.material.opacity = m.userData.baseOp * (0.25 + 0.75 * fk); });
  mist1.position.x = Math.sin(t * 0.045) * 2.2; mist2.position.x = Math.sin(t * 0.032 + 2) * 2.8;
  // lanterns: a warm breath in the fog, open glow once it lifts
  const lk = Ws.lampK ?? 0;
  lanternGlows.forEach((spr, i) => { spr.material.opacity = 0.26 + lk * 0.5 + Math.sin(t * 7 + i * 2.1) * 0.03; });
  // sun glints wake on the bridge-edge bells as the light returns
  const pr = fxProfileAt(f);
  bellGlint.material.opacity = (pr.sparkRate || 0) * (0.45 + 0.4 * Math.sin(t * 6.3));
  // the river takes the grade's water colours (never the boards')
  const L = lightFor(shotAt(f), f);
  water.material.uniforms.uDeep.value.set(L.waterDeep);
  water.material.uniforms.uShallow.value.set(L.waterShal);
  water.material.uniforms.uSky.value.set(L.fog);
  water.material.uniforms.uSpark.value = (Ws.clearK ?? 0) * 0.8;
  // reeds sway in gusts — never a uniform wave
  for (const r of reeds) r.g.rotation.z = Math.sin(t * 1.25 + r.ph) * 0.055 + Math.sin(t * 0.37 + r.ph * 2) * 0.03;
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
