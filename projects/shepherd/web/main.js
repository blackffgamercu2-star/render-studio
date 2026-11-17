import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import * as PR from './props.js';
import * as M4 from './materials.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, BOARD_POS, ROCK, BUSH, STICK3D, sheepAt, gateAt } from './story.js';
import { WORDS } from './words.js';

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

// ---------- painted wool canvas (curly speckle) ----------
const woolCanvas = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#f0e7d2'; g.fillRect(0, 0, 256, 256);
  const cols = ['#ddd0ae', '#fff8ea', '#c9b995', '#e6dcc2'];
  for (let i = 0; i < 2600; i++) {
    g.strokeStyle = cols[(Math.random() * cols.length) | 0]; g.globalAlpha = 0.25 + Math.random() * 0.4; g.lineWidth = 1.6;
    const x = Math.random() * 256, y = Math.random() * 256, r = 2.5 + Math.random() * 4;
    g.beginPath(); g.arc(x, y, r, Math.random() * 3, Math.random() * 3 + 3.6); g.stroke();
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
})();

const MAT = {
  grass: texM(M4.groundDetail(P.grass(6), 191, { dots: 1500, blades: 900 }), 34, 34, '#93b25e'),
  dirt: texM(M4.groundDetail(P.dirt(7), 77, { dots: 900 }), 2, 26, '#b08c5a'),
  stone: texM(M4.stoneV4(21), 3, 2, '#8d929c'), stoneDk: texM(M4.stoneV4(23), 2, 2, '#6d7278'),
  rock: texM(M4.groundDetail(P.stone(31, 38, 6, 60), 193, { dots: 900 }), 2, 2, '#9aa0a6'),
  wood: texM(M4.woodV4(4), 1, 2), woodDk: texM(M4.woodV4(6), 1, 2),
  leaf: texM(M4.groundDetail(P.grass(11), 55, { dots: 700 }), 2, 2, '#5d8f3e'), leafDk: texM(M4.groundDetail(P.grass(13), 56, { dots: 700 }), 2, 2, '#4c7a34'),
  hill: toon({ color: '#6d9a4e' }), hillFar: toon({ color: '#7fae62' }),
  wool: toon({ map: woolCanvas }), headDk: toon({ color: '#38302c' }), muzzle: toon({ color: '#4d4238' }),
  legDk: toon({ color: '#2e2622' }), brass: toon({ color: '#d8a83c' }), notch: toon({ color: '#4a2f16' }),
};

// ============================================================
//  THE PASTURE — one set: path, pass + split gate, rock, bush,
//  pen, trees, hills, the hook board
// ============================================================
const setG = new THREE.Group(); scene.add(setG);
let leafL = null, leafR = null;
const fenceRun = (x0, z0, x1, z1, h = 0.95) => {
  const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz), ang = Math.atan2(dx, dz);
  const n = Math.max(2, Math.round(len / 1.7));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    add(new THREE.CylinderGeometry(0.05, 0.06, h, 6), MAT.woodDk, x0 + dx * t, h / 2, z0 + dz * t, setG, { cast: false });
  }
  for (const ry of [h - 0.12, h * 0.52]) {
    const rail = add(box(0.055, 0.075, len), MAT.wood, (x0 + x1) / 2, ry, (z0 + z1) / 2, setG, { cast: false });
    rail.rotation.y = ang;
  }
};
{
  const g = setG;
  // ground + dirt path (the path runs through the gate, z -43..+35)
  flat(add(new THREE.CircleGeometry(230, 40), MAT.grass, 0, 0, -10, g, { cast: false }));
  const path = flat(add(new THREE.PlaneGeometry(3.6, 78), MAT.dirt, 0, 0.012, -4, g, { cast: false }));
  path.receiveShadow = true;
  // backdrop hills
  const hill1 = add(new THREE.SphereGeometry(1, 24, 16), MAT.hillFar, 0, -2.5, -62, g, { cast: false }); hill1.scale.set(58, 13, 18);
  const hill2 = add(new THREE.SphereGeometry(1, 20, 14), MAT.hill, -42, -2, -46, g, { cast: false }); hill2.scale.set(36, 9.5, 14);
  const hill3 = add(new THREE.SphereGeometry(1, 20, 14), MAT.hill, 44, -2, -48, g, { cast: false }); hill3.scale.set(38, 10.5, 15);
  const hill4 = add(new THREE.SphereGeometry(1, 20, 14), MAT.hillFar, -30, -2, 52, g, { cast: false }); hill4.scale.set(44, 8, 16);
  const hill5 = add(new THREE.SphereGeometry(1, 20, 14), MAT.hillFar, 36, -2, 55, g, { cast: false }); hill5.scale.set(46, 9, 16);
  // ---- the pass: two boulders + the split wooden gate ----
  for (const s of [-1, 1]) {
    const b = add(new THREE.IcosahedronGeometry(1.6, 1), MAT.rock, s * 2.3, 0.55, 0, g);
    b.scale.set(1.18, 0.88, 1.02); b.rotation.set(s * 0.4, s * 1.1, 0.2);
    const b2 = add(new THREE.IcosahedronGeometry(0.8, 1), MAT.rock, s * 3.4, 0.28, 0.7, g);
    b2.scale.set(1.1, 0.75, 0.9); b2.rotation.set(0.3, s * 2.0, 0.4);
    add(new THREE.CylinderGeometry(0.07, 0.085, 1.32, 7), MAT.woodDk, s * 1.06, 0.66, 0, g);   // gate post
    add(new THREE.SphereGeometry(0.1, 8, 6), MAT.woodDk, s * 1.06, 1.36, 0, g, { cast: false });
  }
  const makeLeaf = (side) => {   // side -1: hinge at -1.06, leaf extends +x; +1 mirrored
    const grp = new THREE.Group(); grp.position.set(side * 1.06, 0, 0); g.add(grp);
    const ex = -side;            // extension direction in local x
    for (const ry of [1.04, 0.34]) add(box(1.0, 0.1, 0.055), MAT.wood, ex * 0.53, ry, 0, grp, { cast: false });
    for (const lx of [0.2, 0.53, 0.86]) add(box(0.075, 0.82, 0.045), MAT.wood, ex * lx, 0.69, 0, grp, { cast: false });
    const diag = add(box(1.06, 0.08, 0.04), MAT.woodDk, ex * 0.53, 0.69, 0, grp, { cast: false });
    diag.rotation.z = side * 0.62;
    add(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 6), MAT.notch, ex * 0.12, 1.18, 0, grp, { cast: false });  // hinge pin caps
    add(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 6), MAT.notch, ex * 0.12, 0.2, 0, grp, { cast: false });
    return grp;
  };
  leafL = makeLeaf(-1); leafR = makeLeaf(1);
  // funnel fences + pen fences
  fenceRun(-1.9, -0.3, -8.5, -4.5); fenceRun(1.9, -0.3, 8.5, -4.5);
  fenceRun(-1.9, 0.3, -7.5, 3.5); fenceRun(1.9, 0.3, 7.5, 3.5);
  fenceRun(-6.5, 7, -1.7, 7); fenceRun(1.7, 7, 6.5, 7);
  fenceRun(-6.5, 7, -6.5, 21); fenceRun(6.5, 7, 6.5, 21); fenceRun(-6.5, 21, 6.5, 21);
  // ---- the shepherd's sitting rock ----
  add(new THREE.CylinderGeometry(0.82, 1.06, ROCK.h, 9), MAT.rock, ROCK.x, ROCK.h / 2, ROCK.z, g);
  const rk2 = add(new THREE.IcosahedronGeometry(0.42, 1), MAT.rock, ROCK.x - 0.95, 0.16, ROCK.z + 0.5, g); rk2.scale.y = 0.7;
  const rk3 = add(new THREE.IcosahedronGeometry(0.3, 1), MAT.rock, ROCK.x + 0.85, 0.12, ROCK.z - 0.55, g); rk3.scale.y = 0.65;
  // ---- the notched tally stick (insert prop): planted by the rock ----
  const stickG = new THREE.Group(); stickG.position.set(STICK3D.x, 0, STICK3D.z); stickG.rotation.z = 0.1; stickG.rotation.x = -0.05; g.add(stickG);
  add(new THREE.CylinderGeometry(0.034, 0.046, 1.7, 8), MAT.wood, 0, 0.85, 0, stickG);
  for (let i = 0; i < 9; i++) {
    const ring = add(new THREE.TorusGeometry(0.047, 0.011, 6, 14), MAT.notch, 0, 0.28 + i * 0.155, 0, stickG, { cast: false });
    ring.rotation.x = Math.PI / 2;
  }
  add(new THREE.SphereGeometry(0.055, 8, 6), MAT.woodDk, 0, 1.73, 0, stickG, { cast: false });
  const sb = add(new THREE.IcosahedronGeometry(0.22, 1), MAT.rock, STICK3D.x, 0.08, STICK3D.z, g); sb.scale.y = 0.6;
  // ---- the hiding bush + scattered bushes ----
  const bushAt = (x, z, s, mat) => {
    const bg = new THREE.Group(); bg.position.set(x, 0, z); bg.scale.setScalar(s); g.add(bg);
    const blobs = [[0, 0.55, 0, 0.78], [-0.55, 0.42, 0.15, 0.55], [0.55, 0.45, -0.1, 0.6], [0.1, 0.85, 0.25, 0.5], [-0.2, 0.35, -0.45, 0.48]];
    for (const [bx, by, bz, br] of blobs) {
      const m = add(new THREE.IcosahedronGeometry(br, 1), mat, bx, by, bz, bg);
      m.scale.y = 0.82;
    }
    return bg;
  };
  bushAt(BUSH.x, BUSH.z, 1.25, MAT.leaf);
  bushAt(6.5, -3, 0.9, MAT.leafDk); bushAt(-7, -6, 1.0, MAT.leaf); bushAt(8, 8, 0.85, MAT.leafDk);
  bushAt(-9, 14, 1.05, MAT.leaf); bushAt(11, -9, 0.8, MAT.leafDk); bushAt(-11, -13, 0.95, MAT.leaf);
  // ---- trees ----
  const treeAt = (x, z, s) => {
    const tg = new THREE.Group(); tg.position.set(x, 0, z); tg.scale.setScalar(s); g.add(tg);
    add(new THREE.CylinderGeometry(0.14, 0.2, 1.6, 7), MAT.woodDk, 0, 0.8, 0, tg);
    const c1 = add(new THREE.IcosahedronGeometry(1.25, 1), MAT.leaf, 0, 2.3, 0, tg); c1.scale.y = 0.85;
    const c2 = add(new THREE.IcosahedronGeometry(0.85, 1), MAT.leafDk, 0.7, 1.8, 0.3, tg); c2.scale.y = 0.85;
    const c3 = add(new THREE.IcosahedronGeometry(0.7, 1), MAT.leaf, -0.75, 1.9, -0.2, tg); c3.scale.y = 0.85;
  };
  treeAt(-10, -8, 1.15); treeAt(11, -14, 1.3); treeAt(-13, 6, 1.0); treeAt(10.5, 16, 1.2); treeAt(14, -4, 0.95); treeAt(-16, -18, 1.25); treeAt(17, 6, 1.05);
  // uphill peeking rocks (rivals' cover)
  const pr1 = add(new THREE.IcosahedronGeometry(1.15, 1), MAT.rock, -3.0, 0.4, -8.3, g); pr1.scale.set(1.15, 0.8, 0.95);
  const pr2 = add(new THREE.IcosahedronGeometry(0.95, 1), MAT.rock, 2.6, 0.33, -9.2, g); pr2.scale.set(1.1, 0.78, 0.9);
  // scattered small stones
  for (const [sx, sz, ss] of [[-2.8, -4, 0.16], [3.4, -5.5, 0.2], [-4.2, 2.2, 0.14], [5.2, 4.6, 0.18], [-1.8, 12, 0.15], [2.6, 18, 0.17]]) {
    const st = add(new THREE.IcosahedronGeometry(ss, 0), MAT.stoneDk, sx, ss * 0.4, sz, g, { cast: false }); st.scale.y = 0.65;
  }
  // board posts + crossbar (OUTSIDE the panel span; transform mirrored in boards.json)
  for (const px of [BOARD_POS[0] - 2.55, BOARD_POS[0] + 2.55]) add(new THREE.CylinderGeometry(0.06, 0.07, 3.3, 7), MAT.woodDk, px, 1.65, BOARD_POS[2], g, { cast: false });
  add(tbox(5.4, 0.12, 0.12, 2), MAT.woodDk, BOARD_POS[0], 3.92, BOARD_POS[2], g, { cast: false });
}

// ============================================================
//  THE FLOCK — simple readable sheep: wool body, dark head, four
//  planted legs with a gait cycle, neck bells on some
// ============================================================
const SHEEP_N = 24;
const sheep = [];
const blobTexS = P.tex(P.radial('20,14,30', 0.6));
for (let i = 0; i < SHEEP_N; i++) {
  const grp = new THREE.Group(); scene.add(grp);
  const body = add(new THREE.SphereGeometry(0.5, 16, 12), MAT.wool, 0, 0.58, 0, grp);
  body.scale.set(0.62, 0.88, 1.22);
  const headG = new THREE.Group(); headG.position.set(0, 0.68, 0.52); grp.add(headG);
  const head = add(new THREE.SphereGeometry(0.5, 12, 10), MAT.headDk, 0, 0, 0.05, headG, { cast: false });
  head.scale.set(0.32, 0.34, 0.4);
  const muz = add(new THREE.SphereGeometry(0.5, 10, 8), MAT.muzzle, 0, -0.07, 0.2, headG, { cast: false });
  muz.scale.set(0.17, 0.13, 0.15);
  for (const s of [-1, 1]) {
    const ear = add(new THREE.SphereGeometry(0.5, 8, 6), MAT.headDk, s * 0.19, 0.07, -0.02, headG, { cast: false });
    ear.scale.set(0.17, 0.06, 0.1); ear.rotation.z = s * 0.5;
  }
  const tail = add(new THREE.SphereGeometry(0.1, 8, 6), MAT.wool, 0, 0.7, -0.62, grp, { cast: false });
  const legs = [];
  for (const [lx, lz] of [[-0.15, 0.3], [0.15, 0.3], [-0.15, -0.3], [0.15, -0.3]]) {
    const hip = new THREE.Group(); hip.position.set(lx, 0.42, lz); grp.add(hip);
    add(new THREE.CylinderGeometry(0.036, 0.03, 0.42, 6), MAT.legDk, 0, -0.21, 0, hip, { cast: false });
    legs.push(hip);
  }
  let bell = null;
  if (i % 3 === 0) bell = add(new THREE.SphereGeometry(0.05, 8, 6), MAT.brass, 0, 0.42, 0.5, grp, { cast: false });
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTexS, transparent: true, depthWrite: false, fog: true }));
  blob.rotation.x = -Math.PI / 2; blob.userData.ndSkip = true; blob.renderOrder = 1; scene.add(blob);
  grp.visible = blob.visible = false;
  sheep.push({ grp, headG, legs, blob });
}
function drawSheep(f) {
  const states = sheepAt(f);
  for (let i = 0; i < SHEEP_N; i++) {
    const S = sheep[i], st = states[i];
    if (!st) { S.grp.visible = S.blob.visible = false; continue; }
    S.grp.visible = S.blob.visible = true;
    const ph = st.phase * Math.PI * 2;
    const bob = st.walk ? Math.abs(Math.cos(ph)) * 0.035 : 0;
    S.grp.position.set(st.x, bob, st.z);
    S.grp.rotation.y = st.yaw || 0;
    S.grp.scale.setScalar(st.s || 1);
    const sw = Math.sin(ph) * 0.6, sw2 = Math.sin(ph + Math.PI) * 0.6;   // phase freezes at neutral when a sheep stops — legs settle planted
    S.legs[0].rotation.x = sw; S.legs[3].rotation.x = sw;
    S.legs[1].rotation.x = sw2; S.legs[2].rotation.x = sw2;
    S.headG.rotation.x = (st.dip || 0) * 0.8 + (st.walk ? Math.sin(ph * 2) * 0.04 : 0);
    S.headG.position.y = 0.68 - (st.dip || 0) * 0.22;
    S.blob.position.set(st.x, 0.02, st.z);
    const bs = 1.25 * (st.s || 1); S.blob.scale.set(bs, bs * 0.72, 1);
  }
}

// ---------- boards (transform mirrored in boards.json — keep in sync) ----------
const boardHook = textBoard(['But tomorrow… the man', 'who won every bet', 'he ever made?'], 4.6, 1.5, '#274a26', '#ffe9a8', 900, { pitch: 0.21, dy: 0.01, fsMul: 0.95 });
boardHook.position.set(...BOARD_POS); scene.add(boardHook); addBoardOccluder(boardHook, 4.6, 1.5, 'boardHook');

// ---------- FX: pollen motes in the sunlight + day clouds ----------
const smoke = new FX.Smoke(scene, 200); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const moteEmit = smoke.addEmitter(0, 1.4, 2, { rate: 0, color: 0xfff2b0, opacity: 0.16, scale: 0.28, grow: 1.1, life: 2.8, vy: 0.1, wind: 0.05 });
const fxClouds = new FX.Clouds(scene, { count: 6, y: 58, opacity: 0.5, color: 0xffffff, drift: 0.5 });
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
    moteEmit.rate = pr.moteRate * 3;
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

// ---------- V3 word-by-word captions (the reference's signature) ----------
// Screen-space overlay rendered AFTER the dof pass: one word at a time,
// bold white with a thick black stroke, centred, baseline ~76% of frame
// height, timed from words.js (faster-whisper timings, script-verbatim
// text). The word holds until the next word starts and blanks in the gaps
// between phrases.
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
    // blank in real pauses (>0.34 s after the word ends, before the next)
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
function worldState(Ws, f) {
  fxStepTo(f);
  skyU.time.value = f / 30;
  scene.traverse((o) => { if (o.userData.isOccluder) o.visible = o.userData.boardKey === 'always' || (Ws[o.userData.boardKey] || 0) > 0.01; });
  boardHook.material.opacity = Ws.boardHook || 0; boardHook.visible = (Ws.boardHook || 0) > 0.01;
  // the split gate swings for every counted group
  const G = gateAt(f);
  if (leafL) leafL.rotation.y = -G.open * 1.85;   // leaves fold right back against the fences — the gap reads clean
  if (leafR) leafR.rotation.y = G.open * 1.85;
  drawSheep(f);
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
