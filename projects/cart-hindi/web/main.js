import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import * as PR from './props.js';
import * as M4 from './materials.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, BOARD_POS, TITLE_POS, ROAD_Z, BUMP } from './story.js';

const W = 1080, H = 1920;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
const envMap = FX.detailEnv(renderer);   // LIBRARY v3: PMREM env so prop sheen moves with the camera
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
const _up = new THREE.Vector3(0, 1, 0), _dir = new THREE.Vector3(), _mid = new THREE.Vector3();
const strut = (parent, a, b, r, mat) => {
  _dir.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const len = _dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 7), mat);
  _mid.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); m.position.copy(_mid);
  m.quaternion.setFromUnitVectors(_up, _dir.normalize()); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
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

// ---------- text-board helper (canvas texture plane; boards are in-world props) ----------
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

// ---------- materials ----------
const MAT = {
  ground: texM(M4.groundDetail(P.stone(64, 40, 5, 58), 191, { dots: 1400 }), 14, 14, '#c2a878'),
  road: texM(M4.groundDetail(P.stone(72, 46, 6, 61), 87, { dots: 900 }), 9, 2, '#a89a80'),
  field: texM(M4.groundDetail(P.stone(64, 40, 5, 58), 55, { dots: 700 }), 6, 3, '#cfa64a'),
  stone: texM(M4.stoneV4(8), 3, 2, '#c9bda6'), stoneDk: texM(M4.stoneV4(9), 3, 2, '#a3937a'),
  rock: texM(M4.stoneV4(21), 1, 1, '#b3a58c'),
  wood: texM(M4.woodV4(4), 1, 2), woodDk: texM(M4.woodV4(6), 1, 2),
  ballWood: texM(M4.woodV4(11), 1, 1, '#d8b083'), ballWoodNew: texM(M4.woodV4(13), 1, 1, '#e8c491'),
  ballWorn: texM(M4.woodV4(11), 1, 1, '#8a6a4c'),
  plaster: texM(P.plaster(71, 36), 2, 2), plaster2: texM(P.plaster(97, 41), 2, 2, '#e8dcc4'),
  thatch: toon({ color: '#8a6a38' }), roofDk: toon({ color: '#6e4f2a' }),
  cloth: toon({ color: '#a8894f' }), clothDk: toon({ color: '#8a6f42' }),
  leaf: toon({ color: '#4a7a34' }), leafDk: toon({ color: '#3a6329' }),
  wheat: toon({ color: '#dcb84e' }),
  dark: toon({ color: '#33302c' }), door: toon({ color: '#241a12' }),
  mud: new THREE.MeshStandardMaterial({ color: 0x3a2812, roughness: 0.95, metalness: 0.0, envMap, envMapIntensity: 0.05 }),
};

// ---------- the village set ----------
const world = new THREE.Group(); scene.add(world);
const wheatHeads = [];
{
  const g = world;
  const ground = flat(add(new THREE.CircleGeometry(80, 48), MAT.ground, 0, 0, 0, g, { cast: false }));
  // the stony road (east-west) + a dirt apron in front of the workshop
  flat(add(new THREE.PlaneGeometry(34, 3.6), MAT.road, 0, 0.012, ROAD_Z, g, { cast: false }));
  flat(add(new THREE.PlaneGeometry(7.5, 5.5), MAT.road, -8.2, 0.01, 0.4, g, { cast: false }));
  // the mud patch (harvest-day trap for wheeled carts)
  const mud = flat(add(new THREE.CircleGeometry(1.45, 20), MAT.mud, -2.4, 0.018, ROAD_Z + 0.25, g, { cast: false })); mud.scale.set(1.25, 1, 1);
  // the golden grain field (south-east)
  flat(add(new THREE.PlaneGeometry(13, 6.5), MAT.field, 8.5, 0.008, 10.2, g, { cast: false }));
  for (let i = 0; i < 64; i++) {
    const wx = 2.6 + (i % 16) * 0.78 + ((i * 37) % 10) * 0.05, wz = 7.6 + Math.floor(i / 16) * 1.35 + ((i * 53) % 10) * 0.07;
    const stalk = add(new THREE.ConeGeometry(0.09, 0.62, 5), MAT.wheat, wx, 0.31, wz, g, { cast: false });
    wheatHeads.push(stalk);
  }
  // scattered road stones + THE bump stone the ball hops over
  const stoneSpots = [[-5.2, 2.6, 0.09], [-2.8, 4.3, 0.07], [1.9, 2.5, 0.08], [5.6, 4.4, 0.1], [7.8, 2.7, 0.07], [-9.6, 4.2, 0.08], [11.4, 4.3, 0.09], [-6.8, 4.35, 0.06]];
  for (const [sx, sz, sr] of stoneSpots) { const st = add(new THREE.DodecahedronGeometry(sr, 0), MAT.rock, sx, sr * 0.4, sz, g, { cast: false }); st.rotation.set(sx, sz, sx * 2); }
  const bumpStone = add(new THREE.DodecahedronGeometry(BUMP.r, 0), MAT.rock, BUMP.x, BUMP.r * 0.45, BUMP.z, g, { cast: false }); bumpStone.rotation.set(0.7, 1.9, 0.4);
  // ---- the carpenter's workshop (west, open to the south) ----
  const ws = new THREE.Group(); ws.position.set(-8.5, 0, -3.1); g.add(ws);
  add(tbox(5.6, 2.5, 0.35, 3), MAT.plaster, 0, 1.25, -1.9, ws, { cast: false });
  add(tbox(0.35, 2.5, 3.6, 3), MAT.plaster, -2.7, 1.25, 0, ws, { cast: false });
  add(tbox(0.35, 2.5, 3.6, 3), MAT.plaster, 2.7, 1.25, 0, ws, { cast: false });
  const wsRoof = add(tbox(6.4, 0.14, 4.8, 2), MAT.thatch, 0, 2.85, -0.2, ws, { cast: false }); wsRoof.rotation.x = 0.1;
  for (const [px, pz] of [[-2.55, 1.65], [2.55, 1.65]]) add(new THREE.CylinderGeometry(0.07, 0.08, 2.6, 7), MAT.woodDk, px, 1.3, pz, ws, { cast: false });
  // workbench + a half-built cart frame + log pile + spare balls
  add(tbox(2.4, 0.09, 0.9, 2), MAT.wood, -0.7, 0.76, -1.1, ws, { cast: false });
  for (const [lx, lz] of [[-1.8, -1.45], [0.4, -1.45], [-1.8, -0.75], [0.4, -0.75]]) add(new THREE.CylinderGeometry(0.05, 0.05, 0.76, 6), MAT.woodDk, lx, 0.38, lz, ws, { cast: false });
  const frame = new THREE.Group(); frame.position.set(1.55, 0, 0.9); frame.rotation.y = 0.5; ws.add(frame);
  add(tbox(1.9, 0.07, 1.1, 2), MAT.wood, 0, 0.48, 0, frame, { cast: false });
  for (const s of [-1, 1]) add(tbox(1.9, 0.09, 0.07, 2), MAT.woodDk, 0, 0.4, s * 0.5, frame, { cast: false });
  for (let i = 0; i < 4; i++) { const log = add(new THREE.CylinderGeometry(0.14, 0.14, 1.7, 8), MAT.woodDk, -2.1 + (i % 2) * 0.3, 0.14 + Math.floor(i / 2) * 0.27, 1.15, ws, { cast: false }); log.rotation.z = Math.PI / 2; }
  for (const [bx, bz] of [[1.9, 1.5], [2.25, 1.62], [2.05, 1.2]]) add(new THREE.SphereGeometry(0.17, 12, 10), MAT.ballWood, bx, 0.17, bz, ws, { cast: false });
  add(new THREE.SphereGeometry(0.17, 12, 10), MAT.ballWoodNew, -1.15, 0.975, -1.1, ws, { cast: false });
  // ---- two village huts (north side) ----
  for (const [hx, hz, pm] of [[-2.5, -7.6, MAT.plaster], [4.6, -8.1, MAT.plaster2]]) {
    add(tbox(3.4, 2.1, 2.8, 3), pm, hx, 1.05, hz, g, { cast: false });
    const roof = add(new THREE.ConeGeometry(2.9, 1.3, 4), MAT.thatch, hx, 2.75, hz, g, { cast: false }); roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, 0.85);
    add(tbox(0.8, 1.4, 0.08, 1), MAT.door, hx + 0.7, 0.7, hz + 1.42, g, { cast: false });
    add(tbox(0.6, 0.6, 0.08, 1), MAT.door, hx - 0.9, 1.3, hz + 1.42, g, { cast: false });
  }
  // ---- the godown (east): big stone storehouse, wide dark doorway ----
  add(tbox(5.4, 3.1, 3.4, 3), MAT.stone, 10.2, 1.55, -3.4, g, { cast: false });
  const gRoof = add(tbox(6.0, 0.16, 4.1, 2), MAT.roofDk, 10.2, 3.3, -3.4, g, { cast: false }); gRoof.rotation.z = 0.03;
  add(tbox(1.9, 2.2, 0.1, 1), MAT.door, 9.4, 1.1, -1.66, g, { cast: false });
  add(tbox(0.7, 0.7, 0.1, 1), MAT.door, 11.6, 1.9, -1.66, g, { cast: false });
  // ---- trees ----
  for (const [tx, tz, s] of [[-12.6, -0.8, 1.15], [13.6, -6.6, 1.3], [-4.2, -11, 1.0], [14.8, 1.8, 0.9]]) {
    add(new THREE.CylinderGeometry(0.14 * s, 0.2 * s, 1.9 * s, 7), MAT.woodDk, tx, 0.95 * s, tz, g, { cast: false });
    const c1 = add(new THREE.SphereGeometry(1.15 * s, 10, 8), MAT.leaf, tx, 2.35 * s, tz, g, { cast: false }); c1.scale.y = 0.85;
    const c2 = add(new THREE.SphereGeometry(0.8 * s, 9, 7), MAT.leafDk, tx + 0.7 * s, 1.95 * s, tz + 0.3, g, { cast: false }); c2.scale.y = 0.85;
  }
  // ---- fence posts along the road's north edge ----
  for (let fx = -13; fx <= 13.5; fx += 1.9) { if (fx > -11.5 && fx < -5.4) continue; if (fx > 7.2 && fx < 13.2) continue; add(new THREE.CylinderGeometry(0.045, 0.055, 0.85, 6), MAT.woodDk, fx, 0.42, 1.55, g, { cast: false }); }
  // board gantries (title and hook have their own frames — see story.js)
  for (const px of [TITLE_POS[0] - 2.1, TITLE_POS[0] + 2.1]) add(new THREE.CylinderGeometry(0.06, 0.07, 3.3, 7), MAT.woodDk, px, 1.65, TITLE_POS[2], g, { cast: false });
  add(tbox(4.6, 0.12, 0.12, 2), MAT.woodDk, TITLE_POS[0], 3.9, TITLE_POS[2], g, { cast: false });
  for (const px of [BOARD_POS[0] - 2.1, BOARD_POS[0] + 2.1]) add(new THREE.CylinderGeometry(0.06, 0.07, 4.5, 7), MAT.woodDk, px, 2.25, BOARD_POS[2], g, { cast: false });
  add(tbox(4.6, 0.12, 0.12, 2), MAT.woodDk, BOARD_POS[0], 4.42, BOARD_POS[2], g, { cast: false });
}

// ---------- THE CART (hero prop): a plank cart with NO wheels ----------
// It rides on eight hard wooden balls seated in grooved rails under the
// bed. The balls ROTATE with travel (a dark peg on each ball makes the
// spin readable), the body settles on them, and the whole cart carries a
// real contact shadow. The south-front ball is the one that wears out
// and gets swapped mid-journey.
const BALL_R = 0.17, BALL_XS = [-0.63, -0.21, 0.21, 0.63], BALL_ZS = [-0.40, 0.40];
const cartG = new THREE.Group(); world.add(cartG);
const balls = [];
{
  const cs = FX.contactShadow(2.7, 1.9, { opacity: 0.55 }); cs.position.set(0, 0.013, 0); cartG.add(cs);
  for (const bz of BALL_ZS) for (const bx of BALL_XS) {
    const bg = new THREE.Group(); bg.position.set(bx, BALL_R, bz); cartG.add(bg);
    const isSlot = bx === 0.63 && bz === 0.40;
    const sph = add(new THREE.SphereGeometry(BALL_R, 14, 11), isSlot ? MAT.ballWood.clone() : MAT.ballWood, 0, 0, 0, bg);
    add(new THREE.SphereGeometry(0.045, 6, 5), MAT.dark, BALL_R - 0.015, 0, 0, bg, { cast: false });
    balls.push({ g: bg, sph, slot: isSlot });
  }
  // grooved rails the balls sit in (dark channel strip under each rail)
  for (const bz of BALL_ZS) {
    add(tbox(1.85, 0.11, 0.24, 2), MAT.woodDk, 0, 0.315, bz, cartG);
    add(box(1.85, 0.05, 0.11), MAT.dark, 0, 0.252, bz, cartG, { cast: false });
  }
  for (const bz of [-0.52, 0.52]) add(tbox(1.98, 0.11, 0.09, 2), MAT.woodDk, 0, 0.415, bz, cartG);   // chassis beams
  add(tbox(2.0, 0.07, 1.14, 2), MAT.wood, 0, 0.5, 0, cartG);                                       // plank bed
  for (const sx of [-0.95, 0.95]) for (const sz of [-0.53, 0.53]) add(tbox(0.07, 0.45, 0.07, 1), MAT.woodDk, sx, 0.75, sz, cartG); // corner posts
  for (const bz of [-0.53, 0.53]) { add(tbox(2.0, 0.055, 0.05, 1), MAT.wood, 0, 0.97, bz, cartG); add(tbox(2.0, 0.045, 0.04, 1), MAT.wood, 0, 0.72, bz, cartG); }
  for (const bx of [-0.95, 0.95]) add(tbox(0.05, 0.055, 1.1, 1), MAT.wood, bx, 0.97, 0, cartG);
  for (const mx of [-0.32, 0.32]) for (const bz of [-0.53, 0.53]) add(tbox(0.05, 0.42, 0.04, 1), MAT.woodDk, mx, 0.74, bz, cartG, { cast: false }); // side slats
  // pull handles (front, +x) + crossbar
  strut(cartG, [0.95, 0.46, -0.38], [1.82, 0.64, -0.44], 0.032, MAT.wood);
  strut(cartG, [0.95, 0.46, 0.38], [1.82, 0.64, 0.44], 0.032, MAT.wood);
  const cross = add(new THREE.CylinderGeometry(0.032, 0.032, 0.95, 7), MAT.wood, 1.82, 0.64, 0, cartG); cross.rotation.x = Math.PI / 2;
}
// the fresh ball that gets swapped in (starts hidden)
const freshBall = new THREE.Group(); world.add(freshBall);
add(new THREE.SphereGeometry(BALL_R, 14, 11), MAT.ballWoodNew, 0, 0, 0, freshBall);
add(new THREE.SphereGeometry(0.045, 6, 5), MAT.dark, BALL_R - 0.015, 0, 0, freshBall, { cast: false });
freshBall.visible = false;
// grain sacks that ride the bed on harvest trips
const sacks = [];
for (const [sx, sz, sy] of [[-0.55, 0.05, 0], [0.12, -0.14, 0], [0.58, 0.12, 0], [-0.05, 0.02, 1]]) {
  const sg = new THREE.Group(); sg.position.set(sx, 0.535, sz); cartG.add(sg);
  const sm = add(new THREE.SphereGeometry(0.31, 11, 9), MAT.cloth, 0, 0.22, 0, sg); sm.scale.y = 0.72;
  add(new THREE.CylinderGeometry(0.05, 0.075, 0.1, 7), MAT.clothDk, 0, 0.46, 0, sg, { cast: false });
  if (sy) sg.position.y = 0.95;
  sacks.push(sg); sg.visible = false;
}
// the godown sack stack (grows as trips land — set by story stackK)
const stackG = new THREE.Group(); stackG.position.set(8.35, 0, -1.15); world.add(stackG);
const stackSacks = [];
for (const [sx, sz, sy] of [[0, 0, 0], [0.55, 0.1, 0], [0.28, -0.05, 1], [-0.25, 0.15, 0]]) {
  const sm = add(new THREE.SphereGeometry(0.31, 11, 9), MAT.cloth, sx, 0.22 + sy * 0.42, sz, stackG); sm.scale.y = 0.72; sm.visible = false; stackSacks.push(sm);
}

// ---------- the OTHER cart (wheeled — the one that keeps breaking) ----------
const wcartG = new THREE.Group(); world.add(wcartG);
let wWheelPivot = null;
{
  const cs = FX.contactShadow(2.6, 1.8, { opacity: 0.5 }); cs.position.set(0, 0.013, 0); wcartG.add(cs);
  add(tbox(1.9, 0.08, 1.1, 2), MAT.wood, 0, 0.66, 0, wcartG);
  for (const bz of [-0.52, 0.52]) add(tbox(1.9, 0.3, 0.05, 1), MAT.woodDk, 0, 0.85, bz, wcartG);
  for (const bx of [-0.92, 0.92]) add(tbox(0.05, 0.3, 1.1, 1), MAT.woodDk, bx, 0.85, 0, wcartG);
  const axle = add(new THREE.CylinderGeometry(0.045, 0.045, 1.3, 8), MAT.woodDk, 0, 0.44, 0, wcartG); axle.rotation.x = Math.PI / 2;
  const wheelMat = texM(M4.woodV4(9, { planks: 3 }), 1, 1, '#a8875e');
  const hubMat = new THREE.MeshStandardMaterial({ color: 0x9a7c34, roughness: 0.4, metalness: 0.8, envMap, envMapIntensity: 0.8 });
  const wL = FX.spokedWheel(0.44, { mat: wheelMat, hubMat, spokes: 6, envMap }); wL.position.set(0, 0.44, -0.62); wcartG.add(wL);
  wWheelPivot = new THREE.Group(); wWheelPivot.position.set(0, 0.44, 0.62); wcartG.add(wWheelPivot);
  const wR = FX.spokedWheel(0.44, { mat: wheelMat, hubMat, spokes: 6, envMap }); wWheelPivot.add(wR);
  strut(wcartG, [0.92, 0.6, -0.36], [1.7, 0.5, -0.42], 0.03, MAT.wood);
  strut(wcartG, [0.92, 0.6, 0.36], [1.7, 0.5, 0.42], 0.03, MAT.wood);
  const sk = add(new THREE.SphereGeometry(0.3, 11, 9), MAT.clothDk, -0.4, 0.92, 0.1, wcartG); sk.scale.y = 0.72;
  const sk2 = add(new THREE.SphereGeometry(0.3, 11, 9), MAT.clothDk, 0.35, 0.92, -0.12, wcartG); sk2.scale.y = 0.72;
}

// ---------- the ancient stone slab on balls (old-times beat) ----------
const slabG = new THREE.Group(); world.add(slabG);
const slabBalls = [];
{
  const cs = FX.contactShadow(3.0, 2.0, { opacity: 0.5 }); cs.position.set(0, 0.013, 0); slabG.add(cs);
  for (const bz of [-0.36, 0.36]) for (const bx of [-0.8, 0, 0.8]) {
    const bg = new THREE.Group(); bg.position.set(bx, 0.22, bz); slabG.add(bg);
    add(new THREE.SphereGeometry(0.22, 13, 10), MAT.ballWood, 0, 0, 0, bg);
    add(new THREE.SphereGeometry(0.055, 6, 5), MAT.dark, 0.205, 0, 0, bg, { cast: false });
    slabBalls.push(bg);
  }
  add(tbox(2.4, 0.5, 1.3, 3), MAT.stone, 0, 0.66, 0, slabG);
  add(tbox(2.5, 0.09, 1.4, 3), MAT.stoneDk, 0, 0.45, 0, slabG);
}

// ---------- the palm ball (dialogue beat: placed on the young man's palm) ----------
const palmBall = add(new THREE.SphereGeometry(0.13, 13, 10), MAT.ballWoodNew, 0, -5, 0, world);
palmBall.visible = false;

// ---------- boards (transforms mirrored in boards.json — keep in sync) ----------
const boardTitle = textBoard(['बिना पहिये', 'वाली गाड़ी'], 4.6, 1.2, '#3a2410', '#ffe9a8', 900, { fsMul: 0.50, pitch: 0.36, dy: 0.04 });
boardTitle.position.set(...TITLE_POS); world.add(boardTitle); addBoardOccluder(boardTitle, 4.6, 1.2, 'boardTitle');
const boardHook = textBoard(['लेकिन कल...', 'मंदिर की घंटी बिना किसी के छुए', 'रोज़ ठीक दोपहर को कैसे', 'बज उठती थी?'], 4.6, 1.6, '#2e1a3a', '#ffd76a', 900, { pitch: 0.20, dy: 0.01, fsMul: 0.95 });
boardHook.position.set(...BOARD_POS); world.add(boardHook); addBoardOccluder(boardHook, 4.6, 1.6, 'boardHook');

// ---------- FX: road dust (follows the cart) + ambient dust + clouds ----------
const smoke = new FX.Smoke(scene, 170); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const dustEmit = smoke.addEmitter(0, 0.25, ROAD_Z, { rate: 0, color: 0xe8d3a8, opacity: 0.16, scale: 0.55, grow: 1.5, life: 1.6, vy: 0.35, wind: 0.3 });
const ambEmit = smoke.addEmitter(-2, 1.0, 4, { rate: 0.35, color: 0xffe2b8, opacity: 0.06, scale: 0.5, grow: 1.2, life: 2.6, vy: 0.1, wind: 0.14 });
const fxClouds = new FX.Clouds(scene, { count: 6, y: 46, opacity: 0.22, color: 0xf4f6fa, drift: 0.5 });
fxClouds.items.forEach((cl) => { cl.userData.x0 = cl.position.x; cl.traverse((m) => { m.userData.ndSkip = true; }); });
const stormClouds = new FX.Clouds(scene, { count: 5, y: 40, opacity: 0.0, color: 0x565e68, drift: 0.8 });
stormClouds.items.forEach((cl) => { cl.userData.x0 = cl.position.x; cl.traverse((m) => { m.userData.ndSkip = true; if (m.material) { m.material = m.material.clone(); m.material.transparent = true; } }); });
let fxF = -1;
const fxReset = () => {
  smoke.pool.forEach((p) => { p.life = -1; p.s.visible = false; }); smoke.emitters.forEach((e) => { e.acc = 0; });
  fxClouds.items.forEach((cl) => { cl.position.x = cl.userData.x0; });
  stormClouds.items.forEach((cl) => { cl.position.x = cl.userData.x0; });
};
const fxStepTo = (f) => {
  if (f === fxF) return;
  if (f < fxF || f > fxF + 240) { fxReset(); fxF = -1; }
  while (fxF < f) {
    fxF++; const t = fxF / 30, dt = 1 / 30, pr = fxProfileAt(fxF), Ws = worldAt(fxF);
    dustEmit.rate = (pr.cartDust || 0) * 6;
    dustEmit.x = Ws.cartX - Math.cos(Ws.cartYaw || 0) * 0.9; dustEmit.z = Ws.cartZ + Math.sin(Ws.cartYaw || 0) * 0.9; dustEmit.y = 0.22;
    smoke.update(t, dt);
    fxClouds.update(t, dt); stormClouds.update(t, dt);
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
const lerpN = (a, b, t) => a + (b - a) * t;
function worldState(Ws, f) {
  fxStepTo(f);
  skyU.time.value = f / 30;
  const setB = (mesh, v) => { mesh.material.opacity = v; mesh.visible = v > 0.01; };
  setB(boardTitle, Ws.boardTitle || 0); setB(boardHook, Ws.boardHook || 0);
  scene.traverse((o) => { if (o.userData.isOccluder) o.visible = o.userData.boardKey === 'always' || (Ws[o.userData.boardKey] || 0) > 0.01; });
  // ---- THE CART rides the story ----
  const yaw = Ws.cartYaw || 0, cy = Math.cos(yaw), sy = Math.sin(yaw);
  cartG.visible = (Ws.cartK ?? 1) > 0.01;
  cartG.position.set(Ws.cartX || 0, Ws.cartY || 0, Ws.cartZ || 0);
  cartG.rotation.set(Ws.cartRoll || 0, yaw, Ws.cartPitch || 0);
  const ang = Ws.ballAng || 0, so = Ws.swapOut || 0, si = Ws.swapIn || 0;
  for (const b of balls) {
    if (b.slot) {
      // the wearing ball: flattens/darkens with wornK, rolls OUT to the
      // south side during swapOut, then hides once the fresh ball is in
      const wk = Ws.wornK || 0;
      b.sph.material.color.setScalar(1 - wk * 0.25);
      b.g.scale.y = 1 - wk * 0.16;
      b.g.position.set(0.63, BALL_R * (1 - wk * 0.16) + (Ws.cartY ? 0 : 0), lerpN(0.40, 1.22, so));
      b.g.position.y = lerpN(BALL_R * (1 - wk * 0.16), 0.145, so);
      b.g.rotation.z = -ang * (1 - so);
      b.g.visible = si < 1;
    } else {
      b.g.rotation.z = -ang;
    }
  }
  // the fresh ball rolls in from the carpenter's side into the empty slot
  freshBall.visible = si > 0 && si <= 1 && so >= 1;
  if (freshBall.visible) {
    const lx = lerpN(1.05, 0.63, si), lz = lerpN(1.30, 0.40, si);
    freshBall.position.set(Ws.cartX + lx * cy + lz * sy, BALL_R, Ws.cartZ - lx * sy + lz * cy);
    freshBall.rotation.z = -ang - si * 2.2;
  }
  // grain sacks settle onto the bed as loadK climbs (never pop)
  sacks.forEach((sg, i) => {
    const s = Math.max(0.001, Math.min(1, (Ws.loadK || 0) - i));
    sg.visible = s > 0.02; sg.scale.set(s, s, s);
  });
  stackSacks.forEach((sm, i) => { sm.visible = (Ws.stackK || 0) > i + 0.4; });
  // ---- the wheeled cart + its breaking wheel ----
  wcartG.visible = (Ws.wcartK || 0) > 0.01;
  if (wcartG.visible) {
    const bk = Ws.wbreak || 0;
    wcartG.position.set(Ws.wcartX || 0, -(bk * 0.09), Ws.wcartZ || 0);
    wcartG.rotation.set(bk * 0.09, Ws.wcartYaw || 0, 0);
    if (wWheelPivot) { wWheelPivot.rotation.x = bk * 0.5; wWheelPivot.position.y = 0.44 - bk * 0.13; }
  }
  // ---- the ancient slab glides on its balls ----
  slabG.visible = (Ws.slabK || 0) > 0.01;
  if (slabG.visible) {
    slabG.position.set(Ws.slabX || 0, 0, Ws.slabZ ?? -1.2);
    for (const bg of slabBalls) bg.rotation.z = -(Ws.slabAng || 0);
  }
  // ---- the palm ball ----
  palmBall.visible = (Ws.palmK || 0) > 0.01;
  if (palmBall.visible) palmBall.position.set(Ws.palmX || 0, Ws.palmY || 0, Ws.palmZ || 0);
  // ---- storm clouds gather for the harvest threat ----
  const ck = Ws.cloudK || 0;
  stormClouds.items.forEach((cl) => cl.traverse((m) => { if (m.material && 'opacity' in m.material) m.material.opacity = ck * 0.5; }));
  // ---- wheat sways in gusts (never a uniform wave) ----
  wheatHeads.forEach((wth, i) => { wth.rotation.z = Math.sin(f * 0.03 + i * 1.37 + Math.sin(f * 0.007 + i) * 1.6) * 0.07; });
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
