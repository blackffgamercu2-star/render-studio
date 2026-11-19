import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import * as PR from './props.js';
import * as M4 from './materials.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, BOARD_POS, FIRE, LECTERN, TABLE, CHEST, ROAD } from './story.js';
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

// ---------- text-board helper (canvas texture plane; boards are in-world props) ----------
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
// warm window glow: lit interior panes (real warm gradient, not flat yellow)
const windowCanvas = (() => {
  const c = document.createElement('canvas'); c.width = 128; c.height = 160;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 160);
  gr.addColorStop(0, '#ffb84d'); gr.addColorStop(0.5, '#ff9a2e'); gr.addColorStop(1, '#e07a1a');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 160);
  g.fillStyle = 'rgba(120,50,10,0.55)';
  g.fillRect(60, 0, 8, 160); g.fillRect(0, 76, 128, 8);
  g.fillStyle = 'rgba(60,25,5,0.5)';
  g.beginPath(); g.moveTo(20, 160); g.lineTo(46, 90); g.lineTo(58, 160); g.fill();
  g.beginPath(); g.moveTo(84, 160); g.lineTo(104, 110); g.lineTo(116, 160); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
// book pages: cream paper with real ruled text lines (never blank)
const pagesCanvas = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 320;
  const g = c.getContext('2d');
  g.fillStyle = '#f2e8c8'; g.fillRect(0, 0, 256, 320);
  g.fillStyle = '#3a2a18';
  for (let y = 26; y < 300; y += 16) {
    let x = 18;
    while (x < 232) { const w = 14 + Math.random() * 34; g.fillRect(x, y, Math.min(w, 238 - x), 3); x += w + 9; }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
const MAT = {
  yard: texM(M4.groundDetail(P.stone(64, 40, 5, 58), 191, { dots: 1200 }), 10, 10, '#b8a684'),
  road: texM(M4.groundDetail(P.dirt(71, 30), 192, { dots: 900 }), 8, 2, '#a98f68'),
  stone: texM(M4.stoneV4(8), 3, 2, '#c9bda6'), stoneDk: texM(M4.stoneV4(9), 3, 2, '#a3937a'),
  wood: texM(M4.woodV4(4), 1, 2), woodDk: texM(M4.woodV4(6), 1, 2),
  plaster: texM(P.plaster(71, 36), 2, 2),
  roof: texM(P.roof(72, 20), 4, 2, '#8a5a34'),
  gold: toon({ map: goldCanvas }), goldTrim: toon({ color: '#f0bc4a' }),
  leather: new THREE.MeshStandardMaterial({ color: 0x4a2410, roughness: 0.62, metalness: 0.05, envMap, envMapIntensity: 0.5 }),
  leatherDk: new THREE.MeshStandardMaterial({ color: 0x2e1608, roughness: 0.7, metalness: 0.05, envMap, envMapIntensity: 0.4 }),
  pages: toon({ map: pagesCanvas }),
  brass: new THREE.MeshStandardMaterial({ color: 0xc8a03a, roughness: 0.35, metalness: 0.85, envMap, envMapIntensity: 1.1 }),
  windowGlow: new THREE.MeshBasicMaterial({ map: windowCanvas, fog: true }),
  fireGlow: new THREE.MeshBasicMaterial({ color: 0xff9a2e, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
  stew: toon({ color: '#8a4a1e' }), bread: toon({ color: '#c98a3a' }),
  crimson: toon({ color: '#7a1f2e' }), teal: toon({ color: '#1f4a4a' }),
  cloth: toon({ color: '#8a6f42' }), leaf: toon({ color: '#4a7a34' }),
  white: toon({ color: '#f7f3e6' }), dark: toon({ color: '#33302c' }),
};

// ---------- the inn yard (ONE set) ----------
const world = new THREE.Group(); scene.add(world);
const flames = []; const lanternGlows = [];
{
  const g = world;
  // cobbled yard
  const yard = flat(add(new THREE.CircleGeometry(30, 48), MAT.yard, 0, 0, 2, g, { cast: false }));
  yard.scale.set(1.15, 1, 1);
  // the busiest road: a dirt strip across the foreground (z 10..13)
  const road = flat(add(new THREE.PlaneGeometry(46, 3.2), MAT.road, 0, 0.02, ROAD.z, g, { cast: false }));
  // wheel ruts along the road
  for (const rz of [ROAD.z - 0.85, ROAD.z + 0.85]) {
    const rut = flat(add(new THREE.PlaneGeometry(46, 0.22), MAT.dark, 0, 0.03, rz, g, { cast: false }));
    rut.material = toon({ color: '#6a5232' });
  }
  // inn facade (north, z=-14): plaster + timber frame, arched door, lit windows
  add(tbox(30, 6.4, 1.6, 3), MAT.plaster, 0, 3.2, -14.6, g, { cast: false });
  // timber framing beams on the facade
  for (const bx of [-13, -9, -5, -1, 3, 7, 11]) add(tbox(0.28, 6.4, 0.12, 2), MAT.woodDk, bx, 3.2, -13.75, g, { cast: false });
  add(tbox(30, 0.3, 0.14, 2), MAT.woodDk, 0, 6.2, -13.75, g, { cast: false });
  add(tbox(30, 0.3, 0.14, 2), MAT.woodDk, 0, 0.4, -13.75, g, { cast: false });
  // pitched roof (two sloped planes meeting at a ridge) + chimney
  const roofF = add(tbox(31, 0.18, 3.9, 2), MAT.roof, 0, 7.75, -13.35, g, { cast: false }); roofF.rotation.x = 0.88;
  const roofB = add(tbox(31, 0.18, 3.9, 2), MAT.roof, 0, 7.75, -15.85, g, { cast: false }); roofB.rotation.x = -0.88;
  add(tbox(31, 0.22, 0.3, 2), MAT.woodDk, 0, 9.25, -14.6, g, { cast: false });
  add(tbox(1.1, 3.2, 1.1, 2), MAT.stoneDk, 9, 9.6, -14.6, g, { cast: false });
  add(tbox(1.4, 0.3, 1.4, 2), MAT.stone, 9, 11.3, -14.6, g, { cast: false });
  // arched door (centre) with step
  add(tbox(2.2, 3.4, 0.2, 2), MAT.woodDk, 0, 1.7, -13.7, g, { cast: false });
  const archT = add(new THREE.TorusGeometry(1.15, 0.16, 8, 20, Math.PI), MAT.stoneDk, 0, 3.4, -13.7, g, { cast: false });
  add(new THREE.SphereGeometry(0.07, 8, 6), MAT.brass, 0.75, 1.7, -13.55, g, { cast: false });
  add(tbox(3.2, 0.24, 1.4, 2), MAT.stoneDk, 0, 0.12, -12.9, g, { cast: false });
  // lit windows (warm interior glow, real panes)
  for (const wx of [-6.5, 6.5]) {
    add(tbox(1.9, 2.3, 0.14, 2), MAT.woodDk, wx, 3.1, -13.72, g, { cast: false });
    const win = add(new THREE.PlaneGeometry(1.6, 2.0), MAT.windowGlow, wx, 3.1, -13.63, g, { cast: false });
    win.userData.ndSkip = true;
    add(tbox(2.2, 0.14, 0.3, 2), MAT.stoneDk, wx, 1.9, -13.65, g, { cast: false });
  }
  // hanging inn sign (a painted mug board) by the door
  const signPole = add(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6), MAT.woodDk, 2.6, 4.6, -13.5, g, { cast: false });
  signPole.rotation.z = Math.PI / 2;
  const sign = add(tbox(1.1, 0.8, 0.06, 2), MAT.wood, 3.2, 4.1, -13.5, g, { cast: false });
  const signMug = add(new THREE.CylinderGeometry(0.16, 0.13, 0.22, 10), MAT.cloth, 3.2, 4.1, -13.44, g, { cast: false });
  // side walls (low stone) + shrubs
  add(tbox(1.4, 2.4, 24, 3), MAT.stone, -15.5, 1.2, -2, g, { cast: false });
  add(tbox(1.4, 2.4, 24, 3), MAT.stone, 15.5, 1.2, -2, g, { cast: false });
  for (const [px, pz] of [[-13.5, 8], [13.5, 8], [-13.5, -8], [13.5, -8]]) {
    add(tbox(1.2, 0.55, 1.2, 2), MAT.stoneDk, px, 0.28, pz, g, { cast: false });
    const bush = add(new THREE.SphereGeometry(0.6, 10, 8), MAT.leaf, px, 0.9, pz, g, { cast: false }); bush.scale.y = 0.8;
  }
  // trees flanking the yard
  for (const [tx, tz] of [[-12.5, 9.5], [12.5, 10]]) {
    add(new THREE.CylinderGeometry(0.22, 0.3, 3.4, 8), MAT.woodDk, tx, 1.7, tz, g, { cast: false });
    const top = add(new THREE.SphereGeometry(1.9, 12, 10), MAT.leaf, tx, 4.6, tz, g, { cast: false }); top.scale.y = 1.15;
    const top2 = add(new THREE.SphereGeometry(1.3, 10, 8), MAT.leaf, tx + 0.9, 3.9, tz + 0.4, g, { cast: false });
  }
  // signpost by the road (west)
  add(new THREE.CylinderGeometry(0.07, 0.09, 3.0, 7), MAT.woodDk, -9, 1.5, 10.6, g, { cast: false });
  const sp1 = add(tbox(1.5, 0.34, 0.06, 2), MAT.wood, -9, 2.7, 10.6, g, { cast: false }); sp1.rotation.y = 0.5;
  const sp2 = add(tbox(1.3, 0.34, 0.06, 2), MAT.wood, -9, 2.25, 10.6, g, { cast: false }); sp2.rotation.y = -0.35;
  // lantern posts (warm Memory Warm lamps) flanking the yard
  for (const lx of [-4.2, 4.2]) {
    add(new THREE.CylinderGeometry(0.06, 0.08, 2.6, 7), MAT.woodDk, lx, 1.3, 8.2, g, { cast: false });
    const lamp = add(tbox(0.34, 0.44, 0.34, 2), MAT.woodDk, lx, 2.75, 8.2, g, { cast: false });
    const lampGlow = add(new THREE.PlaneGeometry(0.26, 0.36), MAT.windowGlow, lx, 2.75, 8.38, g, { cast: false });
    lampGlow.userData.ndSkip = true;
    const lg = softGlow(1.6, '#ffb84d', 0.5); lg.position.set(lx, 2.75, 8.2); g.add(lg); lanternGlows.push(lg);
  }
  // ---- fire pit (the story fire) ----
  const fireRing = [];
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2;
    const st = add(new THREE.SphereGeometry(0.22, 8, 6), MAT.stoneDk, FIRE.x + Math.cos(a) * 1.05, 0.14, FIRE.z + Math.sin(a) * 1.05, g, { cast: false });
    st.scale.y = 0.62; fireRing.push(st);
  }
  for (const [lx, lz, ry] of [[-0.35, 0, 0.5], [0.35, 0.1, -0.4], [0, -0.3, 1.2]]) {
    const log = add(new THREE.CylinderGeometry(0.09, 0.09, 0.9, 7), MAT.woodDk, FIRE.x + lx, 0.18, FIRE.z + lz, g, { cast: false });
    log.rotation.z = Math.PI / 2; log.rotation.y = ry;
  }
  // benches around the fire
  for (const [bx, bz, ry] of [[-2.6, 3.5, 0.5], [2.6, 3.5, -0.5], [0, 6.3, 0]]) {
    const bench = new THREE.Group(); bench.position.set(bx, 0, bz); bench.rotation.y = ry; g.add(bench);
    add(tbox(2.0, 0.09, 0.5, 2), MAT.wood, 0, 0.46, 0, bench, { cast: false });
    for (const [lx, lz] of [[-0.85, 0], [0.85, 0]]) add(tbox(0.12, 0.46, 0.4, 2), MAT.woodDk, lx, 0.23, lz, bench, { cast: false });
  }
  // ---- long guest table (east) with stew, bread, mugs ----
  const tbl = new THREE.Group(); tbl.position.set(TABLE.x, 0, TABLE.z); tbl.rotation.y = TABLE.ry; g.add(tbl);
  add(tbox(3.6, 0.1, 1.3, 2), MAT.wood, 0, 0.76, 0, tbl, { cast: false });
  for (const [lx, lz] of [[-1.65, -0.5], [1.65, -0.5], [-1.65, 0.5], [1.65, 0.5]])
    add(new THREE.CylinderGeometry(0.06, 0.06, 0.76, 6), MAT.woodDk, lx, 0.38, lz, tbl, { cast: false });
  for (const [bx, bz] of [[-1.1, 0], [1.1, 0]]) {
    add(tbox(1.5, 0.09, 0.4, 2), MAT.wood, bx, 0.44, bz + 0.95, tbl, { cast: false });
    for (const lx of [-0.6, 0.6]) add(tbox(0.1, 0.44, 0.32, 2), MAT.woodDk, bx + lx, 0.22, bz + 0.95, tbl, { cast: false });
  }
  // stew bowls + bread + mugs on the table
  for (const [sx, sz] of [[-1.2, -0.25], [-0.3, 0.2], [0.6, -0.2], [1.3, 0.25]]) {
    add(new THREE.CylinderGeometry(0.17, 0.13, 0.12, 10), MAT.woodDk, sx, 0.87, sz, tbl, { cast: false });
    const stew = add(new THREE.CylinderGeometry(0.14, 0.14, 0.03, 10), MAT.stew, sx, 0.93, sz, tbl, { cast: false });
  }
  for (const [bx, bz] of [[-0.8, 0.3], [0.9, -0.3]]) {
    const loaf = add(new THREE.SphereGeometry(0.16, 10, 8), MAT.bread, bx, 0.87, bz, tbl, { cast: false }); loaf.scale.set(1.4, 0.7, 0.9);
  }
  for (const [mx, mz] of [[-1.5, 0.3], [0.2, -0.35], [1.5, -0.3]])
    add(new THREE.CylinderGeometry(0.09, 0.07, 0.16, 8), MAT.cloth, mx, 0.89, mz, tbl, { cast: false });
  // board posts (title + hook boards share this frame)
  for (const px of [BOARD_POS[0] - 2.1, BOARD_POS[0] + 2.1]) add(new THREE.CylinderGeometry(0.06, 0.07, 3.3, 7), MAT.woodDk, px, 1.65, BOARD_POS[2], g, { cast: false });
  add(tbox(4.6, 0.12, 0.12, 2), MAT.woodDk, BOARD_POS[0], 3.9, BOARD_POS[2], g, { cast: false });
}

// ---------- THE GREAT LEATHER BOOK (hero prop, built from real parts) ----------
// Dark leather cover, brass corners + clasp, cream pages with real text
// lines, a spine, a bookmark ribbon. It sits OPEN on the lectern; the
// right page lifts (bookOpen) when the keeper reads the sailor's story back.
const bookG = new THREE.Group(); bookG.position.set(LECTERN.x, LECTERN.top, LECTERN.z); bookG.rotation.y = LECTERN.ry; world.add(bookG);
const lecternG = new THREE.Group(); lecternG.position.set(LECTERN.x, 0, LECTERN.z); lecternG.rotation.y = LECTERN.ry; world.add(lecternG);
add(tbox(0.5, 1.0, 0.4, 2), MAT.woodDk, 0, 0.5, 0, lecternG, { cast: false });
add(tbox(1.3, 0.08, 0.95, 2), MAT.wood, 0, 1.02, 0, lecternG, { cast: false }).rotation.x = -0.28;
const bookBase = new THREE.Group(); bookBase.position.set(0, 0.0, 0); bookBase.rotation.x = -0.28; bookG.add(bookBase);
add(tbox(1.05, 0.06, 0.75, 2), MAT.leather, 0, 0, 0, bookBase, { cast: false });
const pageL = add(tbox(0.48, 0.05, 0.68, 2), MAT.pages, -0.25, 0.05, 0, bookBase, { cast: false });
const pageR = new THREE.Group(); pageR.position.set(0.48, 0.05, 0); bookBase.add(pageR);
const pageRMesh = add(tbox(0.48, 0.05, 0.68, 2), MAT.pages, -0.24, 0, 0, pageR, { cast: false });
add(tbox(0.1, 0.07, 0.72, 2), MAT.leatherDk, 0, 0.03, 0, bookBase, { cast: false });
for (const [cx, cz] of [[-0.5, -0.34], [0.5, -0.34], [-0.5, 0.34], [0.5, 0.34]])
  add(tbox(0.09, 0.02, 0.09, 2), MAT.brass, cx, 0.06, cz, bookBase, { cast: false });
add(tbox(0.05, 0.02, 0.3, 2), MAT.brass, 0.52, 0.06, 0, bookBase, { cast: false });
const ribbon = add(tbox(0.05, 0.02, 0.5, 2), MAT.crimson, 0.18, 0.06, 0.32, bookBase, { cast: false });

// ---------- THE CHEST OF GOLD (payoff prop) ----------
// Wooden chest with brass bands; the lid opens (chestOpen) and inside:
// real gold ingots — trapezoids with bevel, stamp, metallic gradient and
// a moving sheen band (Detail Standard: flat yellow emissive BANNED).
const chestG = new THREE.Group(); chestG.position.set(CHEST.x, 0, CHEST.z); chestG.rotation.y = CHEST.ry; world.add(chestG);
add(tbox(1.5, 0.62, 0.9, 2), MAT.woodDk, 0, 0.31, 0, chestG, { cast: false });
add(tbox(1.56, 0.1, 0.96, 2), MAT.wood, 0, 0.62, 0, chestG, { cast: false });
for (const bx of [-0.55, 0.55]) add(tbox(0.1, 0.64, 0.92, 2), MAT.brass, bx, 0.31, 0, chestG, { cast: false });
const chestLid = new THREE.Group(); chestLid.position.set(0, 0.66, -0.45); chestG.add(chestLid);
add(tbox(1.5, 0.1, 0.9, 2), MAT.woodDk, 0, 0.05, 0.45, chestLid, { cast: false });
const lidRound = add(new THREE.CylinderGeometry(0.45, 0.45, 1.5, 12), MAT.wood, 0, 0.12, 0.45, chestLid, { cast: false });
lidRound.rotation.z = Math.PI / 2; lidRound.scale.x = 0.55; // local X maps to world Y after the Z-rotation: flattens the lid dome
const ingots = [];
for (let i = 0; i < 7; i++) {
  const ing = new THREE.Group();
  const body = add(new THREE.CylinderGeometry(0.09, 0.14, 0.3, 4), MAT.gold, 0, 0, 0, ing, { cast: false });
  body.rotation.y = Math.PI / 4; body.scale.set(1, 1, 0.62);
  const stamp = add(tbox(0.07, 0.012, 0.07, 1), MAT.goldTrim, 0, 0.155, 0, ing, { cast: false });
  ing.position.set(-0.45 + (i % 3) * 0.42, 0.68 + Math.floor(i / 3) * 0.2, -0.2 + Math.floor(i / 3) * 0.3);
  ing.rotation.y = (i * 0.7) % 1.2;
  chestG.add(ing); ingots.push(ing);
}
const goldSheen = softGlow(1.4, '#ffe9a8', 0); goldSheen.position.set(CHEST.x, 1.1, CHEST.z); world.add(goldSheen);

// ---------- merchant's purse of gold (offered, refused) ----------
const purseG = new THREE.Group(); world.add(purseG);
const purseBody = add(new THREE.SphereGeometry(0.19, 10, 8), MAT.cloth, 0, 0, 0, purseG); purseBody.scale.y = 0.85;
add(new THREE.CylinderGeometry(0.05, 0.08, 0.12, 7), MAT.cloth, 0, 0.18, 0, purseG);
for (let i = 0; i < 3; i++) {
  const c = add(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 10), MAT.goldTrim, -0.08 + i * 0.08, 0.24, 0.05, purseG, { cast: false });
}

// ---------- fire: additive flames + glow (brightest at source, soft falloff) ----------
const fireGlow = softGlow(2.6, '#ff8a2e', 0.75); fireGlow.position.set(FIRE.x, 0.7, FIRE.z); world.add(fireGlow);
const flameMat = new THREE.MeshBasicMaterial({ color: 0xffb84d, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
for (const [fx, fz, fs] of [[0, 0, 1], [0.18, 0.12, 0.7], [-0.16, 0.1, 0.75]]) {
  const fl = new THREE.Mesh(new THREE.ConeGeometry(0.22 * fs, 0.85 * fs, 8), flameMat);
  fl.position.set(FIRE.x + fx, 0.55, FIRE.z + fz); fl.userData.ndSkip = true; fl.userData.ph = fx * 7 + fz * 5;
  world.add(fl); flames.push(fl);
}

// ---------- boards (transforms mirrored in boards.json — keep in sync) ----------
const boardTitle = textBoard([' THE INN WHERE ', ' NOBODY EVER PAID '], 4.6, 1.2, '#4a2c10', '#ffe9a8');
boardTitle.position.set(...BOARD_POS); world.add(boardTitle); addBoardOccluder(boardTitle, 4.6, 1.2, 'boardTitle');
const boardHook = textBoard(['     BUT TOMORROW...     ', '  WHO LEFT THE GIANT   ', '  FOOTPRINTS THAT   ', ' TERRIFIED THE WHOLE ', '     VILLAGE?     '], 4.6, 1.5, '#2e1a3a', '#ffd76a', 900, { pitch: 0.165, dy: 0.01 });
boardHook.position.set(...BOARD_POS); world.add(boardHook); addBoardOccluder(boardHook, 4.6, 1.5, 'boardHook');

// ---------- FX: yard dust motes + fire embers + chimney smoke + clouds ----------
const smoke = new FX.Smoke(scene, 160); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const dustEmit = smoke.addEmitter(0, 1.1, 3, { rate: 0.15, color: 0xffe2b8, opacity: 0.07, scale: 0.5, grow: 1.2, life: 2.4, vy: 0.12, wind: 0.12 });
const emberEmit = smoke.addEmitter(FIRE.x, 0.9, FIRE.z, { rate: 0, color: 0xff8a2e, opacity: 0.5, scale: 0.22, grow: 0.8, life: 1.2, vy: 1.6, wind: 0.1 });
const chimneyEmit = smoke.addEmitter(9, 11.5, -14.6, { rate: 0.4, color: 0xcfc8bc, opacity: 0.14, scale: 0.9, grow: 1.6, life: 3.2, vy: 1.1, wind: 0.25 });
const fxClouds = new FX.Clouds(scene, { count: 6, y: 46, opacity: 0.22, color: 0xf4e2c8, drift: 0.5 });
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
    fxF++; const t = fxF / 30, dt = 1 / 30, pr = fxProfileAt(fxF);
    dustEmit.rate = pr.smokeRate * 3;
    emberEmit.rate = pr.emberRate * 2.6;
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
  void main(){
    float c0 = coc(vUv);
    if (cinf < .5 || c0 < .6) { gl_FragColor = linearToOutputTexel(vec4(texture2D(src, vUv).rgb, 1.)); return; }
    vec3 acc = vec3(0.); float wsum = 0.;
    for (int i=0;i<48;i++){ float fi = float(i); float r = sqrt((fi+.5)/48.); float a = fi*2.39996;
      vec2 o = vec2(cos(a), sin(a))*r*c0/res; float cs = coc(vUv+o);
      float w = smoothstep(r*c0-1.5, r*c0+.5, cs + .5);
      acc += texture2D(src, vUv+o).rgb*w; wsum += w; }
    gl_FragColor = linearToOutputTexel(vec4(acc/max(wsum,1e-3), 1.)); }` }));
dofScene.children[0].material.toneMapped = false;

// ---------- V3 word-by-word captions ----------
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
  if (i >= 0) {
    const gap = t - WORDS[i].e;
    const next = WORDS[i + 1];
    if (!(gap > 0.34 && (!next || next.s - t > 0.05))) word = WORDS[i].w;
  }
  if (word === capKey) return;
  capKey = word;
  capG.clearRect(0, 0, W, H);
  if (word) {
    capG.font = '900 74px Arial, Helvetica, sans-serif';
    capG.textAlign = 'center'; capG.textBaseline = 'middle'; capG.lineJoin = 'round';
    capG.lineWidth = 17; capG.strokeStyle = '#000000';
    const y = Math.round(H * 0.76);
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
const _va = new THREE.Vector3(), _vb = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
function worldState(Ws, f) {
  fxStepTo(f);
  skyU.time.value = f / 30;
  const setB = (mesh, v) => { mesh.material.opacity = v; mesh.visible = v > 0.01; };
  setB(boardTitle, Ws.boardTitle || 0); setB(boardHook, Ws.boardHook || 0);
  scene.traverse((o) => { if (o.userData.isOccluder) { o.userData.boardVisible = o.userData.boardKey === 'always' || (Ws[o.userData.boardKey] || 0) > 0.01; o.visible = false; } });
  // the book opens when the keeper reads the sailor's story back
  const bk = Ws.bookOpen || 0;
  pageR.rotation.y = -bk * 1.9;
  pageR.position.x = 0.48 - bk * 0.1;
  // the chest lid opens at the payoff; gold sheen sweeps while it is open
  const ck = Ws.chestOpen || 0;
  chestLid.rotation.x = -ck * 1.85;
  goldSheen.material.opacity = ck * (0.35 + 0.3 * Math.sin(f * 0.09));
  goldSheen.visible = ck > 0.02;
  ingots.forEach((ing, i) => { ing.visible = ck > 0.02 || i < 2; });
  // the merchant's purse: carried in his hand, then set on the table when refused
  purseG.visible = (Ws.purseK || 0) > 0.01;
  if (purseG.visible) purseG.position.set(Ws.purseX, Ws.purseY, Ws.purseZ);
  // fire flicker: flames breathe, glow pulses — never a frozen flame
  const fl = 0.85 + 0.15 * Math.sin(f * 0.31) * Math.sin(f * 0.13 + 1.2);
  flames.forEach((m) => { m.scale.y = fl * (1 + 0.08 * Math.sin(f * 0.53 + m.userData.ph)); m.material.opacity = 0.75 + 0.15 * Math.sin(f * 0.47 + m.userData.ph); });
  fireGlow.material.opacity = 0.65 + 0.18 * Math.sin(f * 0.29 + 0.7);
  lanternGlows.forEach((lg, i) => { lg.material.opacity = 0.42 + 0.1 * Math.sin(f * 0.21 + i * 2.1); });
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
      if (o.userData.isOccluder) { o.userData.vis0 = o.visible; o.visible = !!o.userData.boardVisible; return; }
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
