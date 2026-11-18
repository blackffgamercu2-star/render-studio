import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import * as PR from './props.js';
import * as M4 from './materials.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, BOARD_POS, BOX, BAG, PAN } from './story.js';
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

const MAT = {
  grass: texM(M4.groundDetail(P.grass(6), 191, { dots: 1500, blades: 900 }), 34, 34, '#a8c46e'),
  dirt: texM(M4.groundDetail(P.dirt(7), 77, { dots: 900 }), 3, 3, '#c09a68'),
  wood: texM(M4.woodV4(4), 1, 2), woodDk: texM(M4.woodV4(6), 1, 2),
  leaf: texM(M4.groundDetail(P.grass(11), 55, { dots: 700 }), 2, 2, '#5d8f3e'), leafDk: texM(M4.groundDetail(P.grass(13), 56, { dots: 700 }), 2, 2, '#4c7a34'),
  stoneW: toon({ color: '#efe9dc' }), stoneW2: toon({ color: '#e2dac6' }),
  iron: toon({ color: '#3c4046' }), ironLt: toon({ color: '#6d7278' }),
  potMetal: toon({ color: '#4a423c' }), potRim: toon({ color: '#6e6259' }),
  stew: toon({ color: '#c96a2e' }), stewLt: toon({ color: '#e08a3e' }),
  sack: toon({ color: '#d8c49a' }), gold: toon({ color: '#e9b13c' }),
  terra: toon({ color: '#b26a35' }), terraDk: toon({ color: '#96562a' }),
  water: toon({ color: '#5b9ab2' }),
  dark: toon({ color: '#2e2622' }),
};
const stripeTex = (c1, c2) => {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
  const g = cv.getContext('2d');
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? c1 : c2; g.fillRect(i * 32, 0, 32, 64); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
};
const canopyMat = (c1, c2) => new THREE.MeshToonMaterial({ gradientMap: grad, map: stripeTex(c1, c2) });

// ============================================================
//  THE FAIR — heroine's stall + counter centre stage, rival's stall
//  left, stalls/tents/bunting dressing, the board at the back.
// ============================================================
const setG = new THREE.Group(); scene.add(setG);
let boxGrp, potGrp, lidGrp, stewGrp, spillGrp, bagGrp, jugRest, panStones, panWater, bubbleMeshes = [];
{
  const g = setG;
  // ---- ground: grass + the fair's dirt clearing ----
  flat(add(new THREE.PlaneGeometry(90, 70), MAT.grass, 0, 0.004, -6, g, { cast: false }));
  const dirt = flat(add(new THREE.CircleGeometry(9.5, 26), MAT.dirt, 0.3, 0.012, -3.4, g, { cast: false })); dirt.scale.set(1.25, 0.85, 1);
  flat(add(new THREE.PlaneGeometry(3.4, 16), MAT.dirt, 0.4, 0.014, 4.5, g, { cast: false }));
  // ---- a stall builder ----
  const stall = (cx, cz, w, colA, colB, backCol) => {
    for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.07, 0.09, 3.1, 7), MAT.woodDk, cx + s * w / 2, 1.55, cz + 0.55, g, { cast: false });
    for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.07, 0.09, 3.1, 7), MAT.woodDk, cx + s * w / 2, 1.55, cz - 0.75, g, { cast: false });
    const can = add(box(w + 0.9, 0.09, 2.1), canopyMat(colA, colB), cx, 3.18, cz - 0.1, g);
    can.rotation.x = 0.16;
    add(box(w + 0.4, 1.9, 0.08), toon({ color: backCol }), cx, 0.95, cz - 0.78, g, { cast: false });
    return can;
  };
  stall(0.35, -5.9, 5.2, '#e8ddc4', '#c9552e', '#a34a28');          // heroine's stall
  stall(-5.6, -6.1, 3.4, '#dfe8ee', '#3f6a8a', '#33566e');          // rival's stall
  stall(5.6, -5.6, 3.2, '#eef3d0', '#7a9a4a', '#5f7a3a');           // side stall
  // ---- the counter (her stage) ----
  add(tbox(4.5, 0.74, 0.8, 2), MAT.wood, 0.35, 0.37, -4.5, g);
  add(box(4.7, 0.07, 0.95), MAT.woodDk, 0.35, 0.775, -4.5, g);
  for (const px of [-1.5, 0.35, 2.2]) add(box(0.09, 0.6, 0.05), MAT.woodDk, px, 0.4, -4.08, g, { cast: false });
  // goods on the counter: bowls + a small stack of flatbreads
  for (const [bx, bz] of [[-1.55, -4.62], [2.25, -4.4]]) {
    add(new THREE.CylinderGeometry(0.19, 0.12, 0.13, 10), MAT.terra, bx, 0.88, bz, g, { cast: false });
    add(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 10), MAT.stewLt, bx, 0.95, bz, g, { cast: false });
  }
  add(new THREE.CylinderGeometry(0.21, 0.21, 0.05, 10), MAT.sack, 1.85, 0.84, -4.66, g, { cast: false });
  add(new THREE.CylinderGeometry(0.19, 0.19, 0.05, 10), MAT.sack, 1.86, 0.89, -4.65, g, { cast: false });
  // ---- THE LIME BOX (dynamic: tips toward the crowd) ----
  boxGrp = new THREE.Group(); boxGrp.position.set(BOX.x, 0.8, BOX.z + 0.4); scene.add(boxGrp);
  {
    const bg = new THREE.Group(); bg.position.set(0, 0, -0.4); boxGrp.add(bg);
    add(tbox(1.15, 0.58, 0.8, 2), MAT.woodDk, 0, 0.29, 0, bg);
    for (const by of [0.1, 0.48]) { const band = add(box(1.19, 0.07, 0.84), MAT.iron, 0, by, 0, bg, { cast: false }); }
    add(box(0.3, 0.1, 0.06), MAT.ironLt, 0.62, 0.34, 0.1, bg, { cast: false });       // the side channel mouth
    add(box(0.06, 0.34, 0.3), MAT.iron, 0.6, 0.3, 0, bg, { cast: false });            // channel housing on +x face
    for (let i = 0; i < 5; i++) { const st = add(new THREE.IcosahedronGeometry(0.1 + (i % 3) * 0.025, 0), i % 2 ? MAT.stoneW : MAT.stoneW2, -0.36 + i * 0.18, 0.6, -0.12 + (i % 2) * 0.2, bg, { cast: false }); st.scale.y = 0.7; }  // lime stones inside the rim
  }
  // ---- THE POT (dynamic: carried aside / back; lid lifts) ----
  potGrp = new THREE.Group(); scene.add(potGrp);
  {
    add(new THREE.CylinderGeometry(0.44, 0.36, 0.5, 14), MAT.potMetal, 0, 0.25, 0, potGrp);
    add(new THREE.TorusGeometry(0.44, 0.035, 8, 18), MAT.potRim, 0, 0.5, 0, potGrp, { cast: false }).rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) { const hnd = add(new THREE.TorusGeometry(0.09, 0.025, 6, 10), MAT.iron, s * 0.47, 0.34, 0, potGrp, { cast: false }); hnd.rotation.y = Math.PI / 2; }
    stewGrp = new THREE.Group(); stewGrp.position.set(0, 0.47, 0); potGrp.add(stewGrp);
    add(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 14), MAT.stew, 0, 0, 0, stewGrp, { cast: false });
    for (let i = 0; i < 6; i++) { const b = add(new THREE.SphereGeometry(0.055 + (i % 3) * 0.02, 8, 6), MAT.stewLt, Math.cos(i * 2.4) * 0.22, 0.03, Math.sin(i * 2.4) * 0.22, stewGrp, { cast: false }); bubbleMeshes.push(b); }
    lidGrp = new THREE.Group(); lidGrp.position.set(0, 0.52, 0); potGrp.add(lidGrp);
    add(new THREE.CylinderGeometry(0.47, 0.44, 0.07, 14), MAT.potRim, 0, 0.02, 0, lidGrp);
    add(new THREE.SphereGeometry(0.07, 8, 6), MAT.iron, 0, 0.1, 0, lidGrp, { cast: false });
  }
  // ---- spilled stones (appear when the box tips) ----
  spillGrp = new THREE.Group(); scene.add(spillGrp);
  {
    const spots = [];
    for (let i = 0; i < 8; i++) spots.push([BOX.x - 0.4 + (i % 4) * 0.27, 0.86, BOX.z + 0.28 + Math.floor(i / 4) * 0.22]);
    for (let i = 0; i < 8; i++) spots.push([BOX.x - 0.35 + (i % 4) * 0.3, 0.09, BOX.z + 0.95 + Math.floor(i / 4) * 0.3]);
    spots.forEach(([sx, sy, sz], i) => { const st = add(new THREE.IcosahedronGeometry(0.09 + (i % 3) * 0.03, 0), i % 2 ? MAT.stoneW : MAT.stoneW2, sx, sy, sz, spillGrp, { cast: false }); st.scale.y = 0.72; });
  }
  // ---- the coin bag (lands f362) ----
  bagGrp = new THREE.Group(); bagGrp.position.set(BAG.x, 0.8, BAG.z); scene.add(bagGrp);
  {
    const sk = add(new THREE.SphereGeometry(0.21, 10, 8), MAT.sack, 0, 0.13, 0, bagGrp); sk.scale.set(0.9, 0.78, 0.9);
    add(new THREE.TorusGeometry(0.08, 0.025, 6, 10), MAT.woodDk, 0, 0.3, 0, bagGrp, { cast: false }).rotation.x = Math.PI / 2;
    for (let i = 0; i < 4; i++) add(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 8), MAT.gold, -0.14 + i * 0.09, 0.02, 0.24, bagGrp, { cast: false });
  }
  // ---- the resting jug on the counter (hidden while she pours) ----
  jugRest = new THREE.Group(); jugRest.position.set(-0.15, 0.8, -4.32); scene.add(jugRest);
  {
    add(new THREE.CylinderGeometry(0.13, 0.17, 0.34, 10), MAT.terra, 0, 0.17, 0, jugRest, { cast: false });
    add(new THREE.CylinderGeometry(0.07, 0.09, 0.1, 8), MAT.terraDk, 0, 0.38, 0, jugRest, { cast: false });
  }
  // ---- the rival's pan station ----
  add(new THREE.CylinderGeometry(0.34, 0.4, 0.45, 9), MAT.woodDk, PAN.x, 0.225, -4.35, g);
  add(new THREE.CylinderGeometry(0.46, 0.46, 0.05, 12), MAT.iron, PAN.x, 0.5, -4.35, g, { cast: false });
  const panGrp = new THREE.Group(); panGrp.position.set(PAN.x, 0.53, -4.35); scene.add(panGrp);
  add(new THREE.CylinderGeometry(0.4, 0.3, 0.14, 12), MAT.potMetal, 0, 0.05, 0, panGrp);
  panStones = new THREE.Group(); panGrp.add(panStones);
  for (let i = 0; i < 5; i++) { const st = add(new THREE.IcosahedronGeometry(0.085, 0), i % 2 ? MAT.stoneW : MAT.stoneW2, -0.18 + (i % 3) * 0.17, 0.13, -0.08 + Math.floor(i / 3) * 0.16, panStones, { cast: false }); st.scale.y = 0.7; }
  panWater = add(new THREE.CylinderGeometry(0.34, 0.34, 0.02, 12), MAT.water, 0, 0.145, 0, panGrp, { cast: false });
  const stoneSack = add(new THREE.SphereGeometry(0.3, 10, 8), MAT.sack, -3.15, 0.17, -4.15, g); stoneSack.scale.set(0.95, 0.62, 0.95);
  for (let i = 0; i < 3; i++) { const st = add(new THREE.IcosahedronGeometry(0.08, 0), MAT.stoneW, -3.22 + i * 0.11, 0.36, -4.12, g, { cast: false }); st.scale.y = 0.7; }
  // ---- backdrop: the big fair tent + board posts ----
  add(tbox(13, 5.2, 0.3, 3), toon({ color: '#e5d3ac' }), 0.55, 2.6, -10.4, g, { cast: false });
  const tentRoof = add(box(13.6, 0.16, 2.6), canopyMat('#e8ddc4', '#b8502e'), 0.55, 5.35, -10.2, g, { cast: false }); tentRoof.rotation.x = 0.1;
  for (const px of [BOARD_POS[0] - 2.55, BOARD_POS[0] + 2.55]) add(new THREE.CylinderGeometry(0.06, 0.07, 5.0, 7), MAT.woodDk, px, 2.5, BOARD_POS[2], g, { cast: false });
  add(tbox(5.4, 0.12, 0.12, 2), MAT.woodDk, BOARD_POS[0], BOARD_POS[1] + 1.05, BOARD_POS[2], g, { cast: false });
  // ---- bunting between poles ----
  const bunt = (x0, y0, z0, x1, y1, z1) => {
    const cols = ['#c9552e', '#e9b13c', '#3f6a8a', '#7a9a4a'];
    const N = 9;
    for (let i = 0; i < N; i++) {
      const t0 = i / N, t1 = (i + 0.82) / N, sag = (t) => -Math.sin(t * Math.PI) * 0.4;
      const p0 = [x0 + (x1 - x0) * t0, y0 + (y1 - y0) * t0 + sag(t0), z0 + (z1 - z0) * t0];
      const p1 = [x0 + (x1 - x0) * t1, y0 + (y1 - y0) * t1 + sag(t1), z0 + (z1 - z0) * t1];
      const flag = add(new THREE.CylinderGeometry(0.001, 0.09, 0.3, 3), toon({ color: cols[i % 4] }), (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2 - 0.13, (p0[2] + p1[2]) / 2, g, { cast: false });
      flag.rotation.z = Math.PI; flag.rotation.y = Math.atan2(x1 - x0, z1 - z0);
    }
    const line = add(new THREE.CylinderGeometry(0.012, 0.012, Math.hypot(x1 - x0, z1 - z0), 4), MAT.dark, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, g, { cast: false });
    line.rotation.z = Math.PI / 2; line.rotation.y = Math.atan2(x1 - x0, z1 - z0);
  };
  for (const [px, pz] of [[-4.6, -1.8], [5.2, -1.8]]) add(new THREE.CylinderGeometry(0.06, 0.08, 3.6, 7), MAT.woodDk, px, 1.8, pz, g, { cast: false });
  bunt(-4.6, 3.55, -1.8, -1.9, 3.2, -5.35); bunt(2.6, 3.2, -5.35, 5.2, 3.55, -1.8); /* front string removed: its line cylinder mis-rotated into a spike across the hook board */
  // ---- dressing: crates, barrels, hay, tree, distant tents ----
  const crate1 = FX.crate(0.85); crate1.position.set(3.6, 0.43, -3.4); g.add(crate1);
  const crate2 = FX.crate(0.6); crate2.position.set(3.55, 1.16, -3.42); g.add(crate2);
  const barrel1 = FX.barrel(0.5, 1.05); barrel1.position.set(-3.9, 0.53, -5.2); g.add(barrel1);
  const barrel2 = FX.barrel(0.44, 0.9); barrel2.position.set(4.6, 0.45, -5.9); g.add(barrel2);
  for (const [hx, hz] of [[-4.4, -3.2], [5.9, -3.1]]) { const hay = add(new THREE.CylinderGeometry(0.42, 0.42, 0.8, 9), MAT.sack, hx, 0.42, hz, g, { cast: false }); hay.rotation.z = Math.PI / 2; }
  add(new THREE.CylinderGeometry(0.16, 0.26, 3.4, 7), MAT.woodDk, 6.8, 1.7, -6.5, g);
  for (const [bx, by, bz, br, bm] of [[6.8, 3.9, -6.5, 1.5, MAT.leaf], [6.0, 3.1, -6.2, 1.0, MAT.leafDk], [7.6, 3.2, -6.8, 0.95, MAT.leaf]]) { const blob = add(new THREE.IcosahedronGeometry(br, 1), bm, bx, by, bz, g); blob.scale.y = 0.82; }
  for (const [tx, tz, tc] of [[-11, -13, '#3f6a8a'], [12.5, -12, '#b8502e'], [-8, -17, '#7a9a4a']]) {
    add(new THREE.CylinderGeometry(1.5, 1.7, 1.6, 9), toon({ color: '#e5d3ac' }), tx, 0.8, tz, g, { cast: false });
    add(new THREE.CylinderGeometry(0.05, 1.8, 1.7, 9), toon({ color: tc }), tx, 2.4, tz, g, { cast: false });
  }
}

// ---------- boards ----------
const boardHook = textBoard(['But tomorrow… the old woman', 'who lifted a cart', 'with one hand?'], 4.6, 1.5, '#274a26', '#ffe9a8', 900, { pitch: 0.21, dy: 0.01, fsMul: 0.95 });
boardHook.position.set(...BOARD_POS); scene.add(boardHook); addBoardOccluder(boardHook, 4.6, 1.5, 'boardHook');

// ---------- FX: steam system (pot / burst / spill wisps / fizz) + dust ----------
const smoke = new FX.Smoke(scene, 260); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const potSteam = smoke.addEmitter(BOX.x, 2.0, BOX.z, { rate: 0, color: 0xf4f6f2, opacity: 0.34, scale: 0.5, grow: 2.0, life: 1.9, vy: 0.85, wind: 0.22 });
const burstSteam = smoke.addEmitter(BOX.x + 0.72, 1.5, BOX.z + 0.3, { rate: 0, color: 0xffffff, opacity: 0.5, scale: 0.65, grow: 2.6, life: 1.5, vy: 1.7, wind: 0.3 });
const spillSteam = smoke.addEmitter(BOX.x + 0.2, 1.0, BOX.z + 0.8, { rate: 0, color: 0xf4f6f2, opacity: 0.3, scale: 0.42, grow: 1.8, life: 1.7, vy: 0.6, wind: 0.2 });
const fizzSteam = smoke.addEmitter(0.6, 1.0, -4.9, { rate: 0, color: 0xffffff, opacity: 0.42, scale: 0.3, grow: 1.7, life: 1.1, vy: 0.8, wind: 0.15 });
const dustBag = smoke.addEmitter(BAG.x, 0.95, BAG.z + 0.3, { rate: 0, color: 0xd8c49a, opacity: 0.3, scale: 0.45, grow: 1.8, life: 1.0, vy: 0.45, wind: 0.1 });
const dustBox = smoke.addEmitter(BOX.x, 0.95, BOX.z + 0.6, { rate: 0, color: 0xd8c49a, opacity: 0.26, scale: 0.5, grow: 1.9, life: 1.1, vy: 0.4, wind: 0.1 });
const fxClouds = new FX.Clouds(scene, { count: 6, y: 46, opacity: 0.5, color: 0xffffff, drift: 0.5 });
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
    fxF++; const t = fxF / 30, dt = 1 / 30, Wd = worldAt(fxF);
    potSteam.x = BOX.x + 1.45 * Wd.potOff; potSteam.y = (Wd.potOff > 0.5 ? 1.35 : 2.0); potSteam.z = BOX.z;
    potSteam.rate = Wd.steamK * 20;
    burstSteam.rate = Wd.burstK * 44;
    spillSteam.rate = Wd.wispK * 9;
    fizzSteam.rate = Wd.fizzK * 15;
    dustBag.rate = Wd.dustK * 22; dustBox.rate = Wd.dustK * 15;
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
const lerpN = (a, b, t) => a + (b - a) * t;
function worldState(Ws, f) {
  fxStepTo(f);
  skyU.time.value = f / 30;
  scene.traverse((o) => { if (o.userData.isOccluder) o.visible = o.userData.boardKey === 'always' || (Ws[o.userData.boardKey] || 0) > 0.01; });
  boardHook.material.opacity = Ws.boardHook || 0; boardHook.visible = (Ws.boardHook || 0) > 0.01;
  // the lime box tips toward the crowd, then she rights it in 'heat'
  boxGrp.rotation.x = Ws.boxTipK * 1.82;
  // the pot: on the box / carried aside to the counter's right end / back
  const po = Ws.potOff;
  potGrp.position.set(BOX.x + 1.45 * po, lerpN(1.38, 0.8, po) + 0.56 * po * (1 - po), BOX.z);
  lidGrp.position.set(-Ws.lidK * 0.3, 0.52 + Ws.lidK * 0.5, 0);
  lidGrp.rotation.z = Ws.lidK * 0.55;
  stewGrp.visible = Ws.lidK > 0.25;
  bubbleMeshes.forEach((b, i) => { const s = (0.7 + 0.45 * Ws.bubbleK * (0.5 + 0.5 * Math.sin(f * 0.42 + i * 1.7))) * (Ws.bubbleK > 0.05 ? 1 : 0.55); b.scale.set(s, s * 0.7, s); });
  spillGrp.visible = Ws.spillK > 0.02; spillGrp.scale.setScalar(0.55 + 0.45 * Ws.spillK);
  bagGrp.visible = Ws.bagK > 0;
  bagGrp.scale.set(1 + 0.12 * Ws.dustK, 1 - 0.18 * Ws.dustK, 1 + 0.12 * Ws.dustK);
  jugRest.visible = shotAt(f).id !== 'pour';
  panStones.visible = f >= 1138;
  panWater.visible = f >= 1166;
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
