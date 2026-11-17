import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import * as PR from './props.js';
import * as M4 from './materials.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, BOARD_POS, CRACK_POS, HOLE_POS, BOWL_REST, PALMS, HUTS, TREE, WELL } from './story.js';

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
const flat = (mesh) => { mesh.rotation.x = -Math.PI / 2; return mesh; };
const strut = (a, b, r, mat, parent = scene) => {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.3, len, 6), mat);
  m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(d[0] / len, d[1] / len, d[2] / len));
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
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
const brassCanvas = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#8a5a14'); gr.addColorStop(0.35, '#d9a441'); gr.addColorStop(0.52, '#ffe9a0'); gr.addColorStop(0.62, '#f6c453'); gr.addColorStop(1, '#9c6b1e');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 130; i++) { g.strokeStyle = `rgba(255,240,200,${0.03 + Math.random() * 0.05})`; g.lineWidth = 1; const y = Math.random() * 256; g.beginPath(); g.moveTo(0, y); g.lineTo(256, y + (Math.random() - 0.5) * 5); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
})();
const MAT = {
  dirt: texM(M4.groundDetail(P.dirt(35), 171), 10, 10, '#b49a72'),
  plaza: texM(M4.stoneV4(64, {}), 6, 6, '#c9bda6'),
  stone: texM(M4.stoneV4(11, {}), 2, 2, '#b8ab98'),
  stoneDk: texM(M4.stoneV4(12, {}), 2, 2, '#978a76'),
  plat: texM(M4.groundDetail(P.stone(64, 40, 5, 58), 191, { dots: 1200 }), 3, 2, '#c9c2b2'),
  wood: texM(P.beam(66, [26, 45, 32]), 1, 2), woodDk: texM(P.beam(67, [24, 40, 22]), 1, 2),
  brass: toon({ map: brassCanvas }),
  milk: new THREE.MeshBasicMaterial({ color: 0xfdf6e3, fog: true }),
  grain: toon({ color: '#d9a441' }),
  dark: toon({ color: '#17130e' }),
  birdBody: toon({ color: '#8a6a4a' }), birdWing: toon({ color: '#6a5136' }), birdBelly: toon({ color: '#d8c8a8' }),
  orange: toon({ color: '#e8912d' }),
  leaf: toon({ color: '#7a8a3a' }), leafDk: toon({ color: '#5d7030' }),
  goldTrim: toon({ color: '#d9a441' }),
};
const world = new THREE.Group(); scene.add(world);

// ---------- ground: dry earth + stone plaza ----------
{
  const g = world;
  const earth = flat(add(new THREE.CircleGeometry(48, 40), MAT.dirt, 0, 0, 0, g, { cast: false })); earth.receiveShadow = true;
  const plaza = flat(add(new THREE.PlaneGeometry(17, 15), MAT.plaza, 0, 0.02, -1.5, g, { cast: false })); plaza.receiveShadow = true;
  // scattered pebbles + dry tufts around the plaza edge
  for (let i = 0; i < 14; i++) {
    const a = i * 2.39, r = 9.5 + (i % 4) * 1.3;
    add(box(0.22 + (i % 3) * 0.08, 0.1, 0.18), MAT.stoneDk, Math.cos(a) * r, 0.05, -1.5 + Math.sin(a) * r * 0.8, g, { cast: false });
  }
}
const tufts = [];
for (let i = 0; i < 10; i++) {
  const a = i * 1.93 + 0.4, r = 8.6 + (i % 3) * 1.1;
  const t = new THREE.Group(); t.position.set(Math.cos(a) * r, 0, -1.5 + Math.sin(a) * r * 0.75); world.add(t);
  for (let k = 0; k < 5; k++) {
    const blade = add(new THREE.ConeGeometry(0.035, 0.42, 5), k % 2 ? MAT.leaf : MAT.leafDk, (k - 2) * 0.07, 0.2, (k % 2) * 0.06, t, { cast: false });
    blade.rotation.z = (k - 2) * 0.16;
  }
  tufts.push(t);
}
// ---------- huts & palms (kit props) ----------
PALMS.forEach(([x, z, ps], i) => {
  const b = PR.buildPalm({ h: 4.1 * ps, seed: 100 + i * 7, lean: 0.1 + ((x * 7 + z * 13) % 5) * 0.03, envMap });
  b.group.position.set(x, 0, z); b.group.rotation.y = x * 1.7 + z; world.add(b.group);
});
HUTS.forEach((h) => {
  const b = PR.buildHut({ w: 2.9 * h.s, d: 2.4 * h.s, h: 1.8 * h.s, seed: 40 + Math.round(h.x * 3 + h.z), wall: h.wall, envMap });
  b.group.position.set(h.x, 0, h.z); b.group.rotation.y = h.ry; world.add(b.group);
});
// ---------- the well ----------
{
  const g = new THREE.Group(); g.position.set(WELL[0], 0, WELL[1]); world.add(g);
  const ring = add(new THREE.CylinderGeometry(0.95, 1.0, 1.0, 14, 1, true), MAT.stone, 0, 0.5, 0, g, { cast: false });
  ring.material = MAT.stone;
  add(new THREE.CylinderGeometry(1.02, 1.02, 0.12, 14), MAT.stoneDk, 0, 1.02, 0, g, { cast: false });
  const waterD = flat(add(new THREE.CircleGeometry(0.88, 14), MAT.dark, 0, 0.55, 0, g, { cast: false }));
  for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.06, 0.07, 2.0, 7), MAT.woodDk, s * 0.85, 1.0, 0, g, { cast: false });
  const roof = add(box(2.1, 0.09, 1.25), MAT.wood, 0, 2.08, 0, g, { cast: false }); roof.rotation.z = 0.06;
  add(new THREE.CylinderGeometry(0.09, 0.11, 0.34, 8), MAT.woodDk, 0, 1.45, 0.3, g, { cast: false });
}
// ---------- bare tree (the sparrow's home) ----------
{
  const g = new THREE.Group(); g.position.set(TREE[0], 0, TREE[1]); world.add(g);
  const trunk = add(new THREE.CylinderGeometry(0.13, 0.24, 3.4, 8), MAT.woodDk, 0, 1.7, 0, g, { cast: false }); trunk.rotation.z = 0.05;
  strut([0, 2.5, 0], [-0.25, 3.32, 0], 0.055, MAT.woodDk, g);
  strut([0.05, 2.9, 0], [0.75, 3.6, 0.3], 0.045, MAT.woodDk, g);
  strut([0, 2.2, 0], [-0.8, 2.8, -0.4], 0.04, MAT.woodDk, g);
}
// ---------- THE STATUE (stone v4, real parts) ----------
const statueG = new THREE.Group(); statueG.position.set(0, 0, -6); world.add(statueG);
let crackPanel;
{
  const g = statueG;
  add(box(4.0, 0.25, 4.0), MAT.plat, 0, 0.125, 0, g, { cast: false });                    // step
  add(box(3.4, 0.75, 3.4), MAT.plat, 0, 0.625, 0, g, { cast: false });                    // platform (top y=1.0)
  add(new THREE.CylinderGeometry(0.8, 0.98, 0.4, 12), MAT.stoneDk, 0, 1.2, 0, g);          // base
  add(box(0.95, 0.8, 0.72), MAT.stone, 0, 1.8, 0, g);                                       // pillar legs
  add(box(1.18, 0.95, 0.78), MAT.stone, 0, 2.67, 0, g);                                    // torso
  const armR = add(box(0.78, 0.2, 0.26), MAT.stone, 0.74, 3.0, 0, g); armR.rotation.z = -0.1;   // raised arm (perch)
  const armL = add(box(0.24, 0.72, 0.26), MAT.stone, -0.68, 2.55, 0, g); armL.rotation.z = 0.15; // lowered arm
  add(new THREE.SphereGeometry(0.34, 14, 12), MAT.stone, 0, 3.52, 0, g);                   // head
  add(box(0.52, 0.09, 0.1), MAT.stoneDk, 0, 3.63, 0.3, g, { cast: false });                 // brow
  add(box(0.09, 0.22, 0.1), MAT.stoneDk, 0, 3.47, 0.35, g, { cast: false });               // nose
  for (const s of [-1, 1]) add(new THREE.SphereGeometry(0.036, 8, 6), MAT.dark, s * 0.12, 3.57, 0.315, g, { cast: false }); // eyes
  const crown = add(new THREE.ConeGeometry(0.3, 0.36, 10), MAT.stoneDk, 0, 3.98, 0, g);    // crown
  add(new THREE.CylinderGeometry(0.35, 0.35, 0.07, 12), MAT.goldTrim, 0, 3.82, 0, g, { cast: false }); // crown band
  // the crack in its back: dark inset + a stone panel that swings on a hinge
  add(box(0.44, 0.74, 0.04), MAT.dark, CRACK_POS[0], CRACK_POS[1], CRACK_POS[2] + 6 - 0.03, g, { cast: false });
  const hinge = new THREE.Group(); hinge.position.set(CRACK_POS[0] - 0.19, CRACK_POS[1], CRACK_POS[2] + 6); g.add(hinge);
  crackPanel = add(box(0.38, 0.68, 0.045), MAT.stoneDk, 0.19, 0, 0, hinge);
  hinge.userData.isCrack = true; statueG.userData.hinge = hinge;
}
// ---------- bowl stand + bowls ----------
const standG = new THREE.Group(); standG.position.set(0, 0, -4.62); world.add(standG);
{
  add(box(0.55, 0.34, 0.55), MAT.stoneDk, 0, 1.17, 0, standG);
  const hole = flat(add(new THREE.CircleGeometry(0.055, 10), MAT.dark, 0, 1.17, 0.285, standG, { cast: false }));
  hole.rotation.x = 0; hole.position.set(0, 1.17, 0.283);
}
const mkBowl = (withMilk) => {
  const g = new THREE.Group(); world.add(g);
  const bowl = add(new THREE.CylinderGeometry(0.30, 0.16, 0.17, 18, 1, true), MAT.brass, 0, 0.1, 0, g, { cast: false });
  bowl.material.side = THREE.DoubleSide;
  add(new THREE.CylinderGeometry(0.16, 0.13, 0.03, 14), MAT.brass, 0, 0.015, 0, g, { cast: false });
  const milk = flat(add(new THREE.CircleGeometry(0.26, 18), MAT.milk, 0, 0.155, 0, g, { cast: false }));
  milk.visible = withMilk; g.userData.milk = milk;
  return g;
};
const bowlG = mkBowl(true), grainG = mkBowl(false), bowl2G = mkBowl(true);
{
  const heap = add(new THREE.ConeGeometry(0.2, 0.14, 12), MAT.grain, 0, 0.16, 0, grainG, { cast: false });
  heap.position.y = 0.17;
}
const bowlGlow = softGlow(0.5, '#ffe9a8', 0); bowlGlow.position.set(BOWL_REST[0], BOWL_REST[1] + 0.3, BOWL_REST[2]); world.add(bowlGlow);
const statueGlow = softGlow(2.1, '#ffcf8a', 0); statueGlow.position.set(0, 2.7, -5.0); world.add(statueGlow);
// the sparrow's beak, slipping out of the stand hole to sip
const beakG = new THREE.Group(); world.add(beakG);
{
  add(new THREE.SphereGeometry(0.075, 9, 8), MAT.birdBody, 0, 0, 0, beakG, { cast: false });
  const bk = add(new THREE.ConeGeometry(0.026, 0.11, 6), MAT.orange, 0, -0.012, 0.1, beakG, { cast: false }); bk.rotation.x = Math.PI / 2 + 0.25;
  beakG.visible = false;
}
// ---------- birds ----------
const mkBird = (scale = 1, tint = 0) => {
  const g = new THREE.Group(); world.add(g);
  const bodyM = tint ? toon({ color: tint }) : MAT.birdBody;
  const body = add(new THREE.SphereGeometry(0.11, 10, 8), bodyM, 0, 0.1, 0, g, { cast: false }); body.scale.set(1, 0.9, 1.35);
  add(new THREE.SphereGeometry(0.075, 8, 7), bodyM, 0, 0.17, 0.12, g, { cast: false });
  const bk = add(new THREE.ConeGeometry(0.028, 0.1, 6), MAT.orange, 0, 0.16, 0.23, g, { cast: false }); bk.rotation.x = Math.PI / 2;
  const tail = add(box(0.07, 0.014, 0.17), MAT.birdWing, 0, 0.12, -0.18, g, { cast: false }); tail.rotation.x = -0.45;
  const wL = new THREE.Group(); wL.position.set(-0.08, 0.14, 0); g.add(wL);
  add(box(0.19, 0.012, 0.12), MAT.birdWing, -0.095, 0, 0, wL, { cast: false });
  const wR = new THREE.Group(); wR.position.set(0.08, 0.14, 0); g.add(wR);
  add(box(0.19, 0.012, 0.12), MAT.birdWing, 0.095, 0, 0, wR, { cast: false });
  g.scale.setScalar(scale);
  return { g, wL, wR };
};
const sparrow = mkBird(1.3);
const groundBirds = [mkBird(0.92, '#7a5c3e'), mkBird(1.05, '#96785a'), mkBird(0.88, '#6a5136'), mkBird(1.0, '#a08050')];
const BIRD_SPOTS = [[0.75, -1.65], [1.95, -2.65], [1.05, -2.95], [2.35, -1.75]];
groundBirds.forEach((b, i) => { b.g.position.set(BIRD_SPOTS[i][0], 0, BIRD_SPOTS[i][1]); b.g.rotation.y = Math.atan2(1.3 - BIRD_SPOTS[i][0], -2.2 - BIRD_SPOTS[i][1]); b.g.visible = false; });
// ---------- boards ----------
for (const px of [BOARD_POS[0] - 1.8, BOARD_POS[0] + 1.8]) add(new THREE.CylinderGeometry(0.06, 0.07, 3.3, 7), MAT.woodDk, px, 1.65, BOARD_POS[2], world, { cast: false });
add(box(3.9, 0.12, 0.12), MAT.woodDk, BOARD_POS[0], 3.82, BOARD_POS[2], world, { cast: false });
const boardTitle = textBoard([' दूध पीने वाली मूर्ति '], 3.9, 1.2, '#3a1a10', '#ffd76a');
boardTitle.position.set(...BOARD_POS); world.add(boardTitle); addBoardOccluder(boardTitle, 3.9, 1.2, 'boardTitle');
const boardHook = textBoard([' लेकिन कल... पुराने किले में ', ' आधी रात को बड़ा ढोल कौन बजाता है, ', ' जब किला सालों से खाली है? '], 3.9, 1.2, '#1c2447', '#ffd76a', 900, { pitch: 0.20, dy: 0.01 });   // HI fix: default 3-line layout put line-1 ink at canvas y~18, overlapping the top border — pitch/dy compresses the block inside the panel (same pattern as monkey-hindi)
boardHook.position.set(...BOARD_POS); world.add(boardHook); addBoardOccluder(boardHook, 3.9, 1.2, 'boardHook');
// ---------- heat shimmer (day beats) ----------
const shimmers = [];
for (let i = 0; i < 3; i++) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.55), new THREE.MeshBasicMaterial({ color: 0xfff2cf, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  m.position.set([-2.5, 0, 2.5][i], 0.32, [-0.5, -3, 0.8][i]); m.userData.ndSkip = true; world.add(m); shimmers.push(m);
}
// ---------- FX: dust motes + clouds ----------
const smoke = new FX.Smoke(scene, 130); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const moteEmit = smoke.addEmitter(0, 1.9, -4.4, { rate: 0.1, color: 0xffe2b8, opacity: 0.13, scale: 0.32, grow: 1.1, life: 2.6, vy: 0.1, wind: 0.12 });
const dustEmit = smoke.addEmitter(0, 0.7, -1, { rate: 0.03, color: 0xe8d0a0, opacity: 0.05, scale: 1.6, grow: 1.4, life: 3.4, vy: 0.05, wind: 0.2 });
const fxClouds = new FX.Clouds(scene, { count: 5, y: 46, opacity: 0.2, color: 0xf4f6fa, drift: 0.5 });
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
    moteEmit.rate = pr.dustRate; dustEmit.rate = pr.smokeRate;
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
let prevSparrow = null;
function worldState(Ws, f) {
  fxStepTo(f);
  skyU.time.value = f / 30;
  const setB = (mesh, v) => { mesh.material.opacity = v; mesh.visible = v > 0.01; };
  setB(boardTitle, Ws.boardTitle || 0); setB(boardHook, Ws.boardHook || 0);
  scene.traverse((o) => { if (o.userData.isOccluder) o.visible = o.userData.boardKey === 'always' || (Ws[o.userData.boardKey] || 0) > 0.01; });
  // the statue's crack panel swings on its hinge
  statueG.userData.hinge.rotation.y = -(Ws.crackK || 0) * 1.9;
  // bowls (contact-animated: carried, poured, set down, resting)
  bowlG.position.set(Ws.bowlX, Ws.bowlY, Ws.bowlZ); bowlG.rotation.z = Ws.bowlTilt || 0;
  bowlG.userData.milk.visible = (Ws.milkK || 0) > 0.03;
  bowlG.userData.milk.scale.setScalar(Math.max(0.05, Ws.milkK || 0));
  grainG.visible = (Ws.grainOn || 0) > 0.01; grainG.position.set(Ws.grainX, Ws.grainY, Ws.grainZ);
  bowl2G.visible = (Ws.bowl2On || 0) > 0.01; bowl2G.position.set(Ws.bowl2X, Ws.bowl2Y, Ws.bowl2Z);
  bowlGlow.material.opacity = (Ws.sparkK || 0) * 0.28;
  statueGlow.material.opacity = (Ws.glowK || 0) * 0.15;
  // the sparrow: flight, perch bob, wing flap; hidden while inside the statue
  const sp = sparrow.g;
  sp.visible = (Ws.sparrowOn || 0) > 0.01;
  if (sp.visible) {
    const bob = Ws.sparrowFlap ? 0 : Math.sin(f * 0.09) * 0.008;
    sp.position.set(Ws.sparrowX, Ws.sparrowY + bob, Ws.sparrowZ);
    if (prevSparrow) {
      const dx = Ws.sparrowX - prevSparrow[0], dz = Ws.sparrowZ - prevSparrow[2];
      if (Math.hypot(dx, dz) > 0.004) sp.rotation.y = Math.atan2(dx, dz);
    }
    const flapA = Ws.sparrowFlap ? Math.sin(f * 2.3) * 0.95 : 0.12 + Math.sin(f * 0.07) * 0.03;
    sparrow.wL.rotation.z = flapA; sparrow.wR.rotation.z = -flapA;
  }
  prevSparrow = [Ws.sparrowX, Ws.sparrowY, Ws.sparrowZ];
  // the beak sipping through the stand hole (tiny bob as it drinks)
  const bk = Ws.beakK || 0;
  beakG.visible = bk > 0.02;
  if (beakG.visible) beakG.position.set(HOLE_POS[0], HOLE_POS[1] + Math.sin(f * 0.55) * 0.008 * bk, HOLE_POS[2] - 0.05 + bk * 0.17);
  // ground birds join openly from the 'open' shot onward
  const birdsOn = f >= 1313;
  groundBirds.forEach((b, i) => {
    b.g.visible = birdsOn;
    if (!birdsOn) return;
    const peck = Math.max(0, Math.sin(f * 0.32 + i * 1.7)) ** 3;
    b.g.rotation.x = peck * 0.42;
    b.g.position.y = Math.abs(Math.sin(f * 0.16 + i * 2.3)) * 0.012;
    b.wL.rotation.z = 0.1; b.wR.rotation.z = -0.1;
  });
  // dry tufts sway in gusts (never a uniform wave)
  tufts.forEach((t, i) => { t.rotation.z = Math.sin(f * 0.045 + i * 1.93) * 0.05 + Math.sin(f * 0.013 + i * 0.7) * 0.03; });
  // heat shimmer over the dry ground (day beats)
  shimmers.forEach((m, i) => {
    m.material.opacity = (Ws.shimmerK || 0) * (0.05 + 0.028 * Math.sin(f * 0.33 + i * 2.1));
    m.scale.x = 1 + 0.07 * Math.sin(f * 0.21 + i * 1.4);
    m.rotation.z = 0.02 * Math.sin(f * 0.17 + i);
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
  return true;
};
window.TOTAL = TOTAL;
window.ready = true;
