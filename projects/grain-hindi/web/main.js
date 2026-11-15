import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt } from './story.js';

const W = 1080, H = 1920;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
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
const clamp01 = (x) => Math.max(0, Math.min(1, x));

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
const textBoard = (lines, w, h, bg, fg, font = 900, fsScale = 1, dy = 0) => {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w);
  const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = fg; g.lineWidth = 14; g.strokeRect(20, 20, c.width - 40, c.height - 40);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  const fs = Math.min(170, (c.width - 130) / Math.max(...lines.map((l) => l.length)) * 1.72) * fsScale;
  g.font = `${font} ${fs}px 'Noto Sans Devanagari', Arial`;
  lines.forEach((l, i) => g.fillText(l, c.width / 2, c.height * (lines.length === 1 ? 0.52 : (i + 0.5) / lines.length) + dy));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, fog: true }));
  return m; // boards stay IN the ND pass: their depth occludes set geometry behind them (no ghost ink lines)
};
// ---------- chessboard texture (8x8, drawn once) ----------
const chessTex = () => {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#5a3a1e'; g.fillRect(0, 0, 512, 512);
  const m = 26, sq = (512 - 2 * m) / 8;
  for (let r = 0; r < 8; r++) for (let col = 0; col < 8; col++) {
    g.fillStyle = (r + col) % 2 ? '#8a5f33' : '#e8d9b0';
    g.fillRect(m + col * sq, m + r * sq, sq, sq);
  }
  g.strokeStyle = '#ffd76a'; g.lineWidth = 6; g.strokeRect(8, 8, 496, 496);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
};

// ---------- the set: palace court (x=0) + table/board, granary (x=-16), garden (x=+16) ----------
const MAT = {
  grass: texM(P.grass(61), 16, 16, '#7fae4c'),
  dirt: texM(P.dirt(35), 8, 8, '#b49a72'),
  stone: texM(P.stone(64, 40, 5, 58), 3, 2, '#c9c2b2'), stoneDk: texM(P.stone(65, 40, 6, 46), 3, 2, '#a89f8d'),
  wood: texM(P.beam(66, [26, 45, 32]), 1, 2), woodDk: texM(P.beam(67, [24, 40, 22]), 1, 2),
  thatch: toon({ color: '#b08d4f' }), leaf: toon({ color: '#4a6a34' }), leaf2: toon({ color: '#5d8142' }),
  gold: toon({ color: '#d9a441' }), goldDk: toon({ color: '#a87c24' }),
  dark: toon({ color: '#33302c' }), iron: toon({ color: '#4a4d55' }),
  sack: toon({ color: '#a8803e' }), sackDk: toon({ color: '#8a6a30' }),
  crimson: toon({ color: '#8c2432' }),
  rice: toon({ color: '#ece1c2' }), riceDk: toon({ color: '#d9c491' }),
  sand: toon({ color: '#cbb27f' }),
  hedge: toon({ color: '#3f6030' }),
};
const world = new THREE.Group(); scene.add(world);
let goldBagG;
const piles = [];        // 16 grain piles on the chessboard (rows 1-2)
const heapMounds = [];   // growing heaps (court floor + granary spill)
const granSacks = [];    // sacks inside the granary
const granSackMeta = []; // per-sack {lvl, key} — stack compression when sacks sag
const cartSacks = [];    // sacks loaded on the cart
let doorL, doorR;
const BOARD_TOP = 0.88, BOARD_C = [0.8, -1.0], SQ = 0.0825; // board centre (x,z), square size
{
  const g = world;
  const gr = flat(add(new THREE.PlaneGeometry(300, 240), MAT.grass, 8, -0.03, 0, g, { cast: false })); gr.receiveShadow = true;
  flat(add(new THREE.CircleGeometry(9.5, 24), MAT.dirt, 0, -0.012, 0.5, g, { cast: false }));   // court yard
  flat(add(new THREE.PlaneGeometry(40, 3.0), MAT.dirt, -2, -0.014, 1.0, g, { cast: false }));    // road west to the granary
  flat(add(new THREE.PlaneGeometry(20, 3.0), MAT.dirt, 10, -0.014, 1.0, g, { cast: false }));    // road east to the garden
  flat(add(new THREE.PlaneGeometry(1.7, 5.2), MAT.crimson, 0, -0.006, 0.4, g, { cast: false })); // red carpet, throne to court
  // distant huts + trees (depth)
  for (const [hx, hz, ry] of [[-7, -13, 0.2], [8, -14, -0.3], [20, -12, 0.4], [26, -13, -0.2]]) {
    const h = new THREE.Group(); h.position.set(hx, 0, hz); h.rotation.y = ry; g.add(h);
    add(tbox(2.6, 1.7, 2.2, 2), MAT.stone, 0, 0.85, 0, h, { cast: false });
    add(new THREE.ConeGeometry(2.2, 1.2, 4), MAT.thatch, 0, 2.3, 0, h, { cast: false }).rotation.y = Math.PI / 4;
  }
  for (const [tx, tz, s] of [[-11, -9, 1], [12.5, -10, 1.2], [23, -9, 0.9]]) {
    add(new THREE.CylinderGeometry(0.3 * s, 0.44 * s, 2.8 * s, 8), MAT.woodDk, tx, 1.4 * s, tz, g, { cast: false });
    const can = add(new THREE.SphereGeometry(2.1 * s, 10, 8), MAT.leaf, tx, 3.6 * s, tz, g, { cast: false });
    can.scale.y = 0.72; can.userData.ndSkip = true;
  }
  // ================= PALACE FACADE (z = -3.2) + THRONE =================
  add(tbox(6.9, 4.9, 0.5, 2), MAT.stoneDk, -4.6, 2.45, -3.45, g, { cast: false });
  add(tbox(6.9, 4.9, 0.5, 2), MAT.stoneDk, 4.6, 2.45, -3.45, g, { cast: false });
  add(tbox(16.1, 0.4, 0.7, 2), MAT.stone, 0, 5.05, -3.45, g, { cast: false });
  add(tbox(2.4, 2.35, 0.5, 2), MAT.stoneDk, 0, 3.72, -3.45, g, { cast: false });   // lintel over the arch
  for (const sx of [-5.9, 5.9]) {
    add(new THREE.CylinderGeometry(1.05, 1.2, 6.0, 10), MAT.stone, sx, 3.0, -3.45, g, { cast: false });
    add(new THREE.ConeGeometry(1.5, 1.3, 10), MAT.thatch, sx, 6.6, -3.45, g, { cast: false });
  }
  add(tbox(2.3, 2.6, 0.1, 2), MAT.dark, 0, 1.3, -3.55, g, { cast: false });        // warm dark arch behind the throne
  const th = new THREE.Group(); th.position.set(0, 0, -2.7); g.add(th);
  add(tbox(2.2, 0.18, 0.9, 2), MAT.stoneDk, 0, 0.09, 0, th, { cast: false });       // dais step
  add(tbox(1.7, 0.5, 0.7, 2), MAT.goldDk, 0, 0.43, 0, th, { cast: false });          // seat base
  add(tbox(1.9, 2.0, 0.18, 2), MAT.goldDk, 0, 1.5, -0.45, th, { cast: false });      // tall back
  add(new THREE.SphereGeometry(0.17, 10, 8), MAT.gold, 0, 2.62, -0.45, th, { cast: false }); // finial
  for (const sx of [-0.88, 0.88]) add(tbox(0.15, 0.55, 0.7, 2), MAT.goldDk, sx, 0.95, 0, th, { cast: false }); // armrests
  add(tbox(1.3, 0.12, 0.6, 2), MAT.crimson, 0, 0.74, 0.02, th, { cast: false });    // seat cushion
  add(tbox(1.2, 1.1, 0.08, 2), MAT.crimson, 0, 1.45, -0.34, th, { cast: false });    // back cushion
  for (const sx of [-2.0, 2.0]) {   // guards' spears planted at their posts
    add(new THREE.CylinderGeometry(0.03, 0.035, 2.7, 7), MAT.woodDk, sx, 1.35, -1.9, g, { cast: false });
    add(new THREE.ConeGeometry(0.07, 0.34, 8), MAT.iron, sx, 2.85, -1.9, g, { cast: false });
  }
  // ================= TABLE + CHESSBOARD (court, between king and farmer) =================
  // Table top surface at y=0.83; the board's base sits FLUSH on it (board box
  // centre 0.855, top face BOARD_TOP=0.88) — no gap, real shadow contact.
  const tbl = new THREE.Group(); tbl.position.set(BOARD_C[0], 0, BOARD_C[1]); g.add(tbl);
  add(tbox(1.35, 0.07, 1.15, 2), MAT.wood, 0, 0.795, 0, tbl);                        // table top (surface 0.83)
  for (const [lx, lz] of [[-0.58, -0.46], [0.58, -0.46], [-0.58, 0.46], [0.58, 0.46]])
    add(tbox(0.09, 0.76, 0.09, 2), MAT.woodDk, lx, 0.38, lz, tbl);                   // legs, feet on the floor
  add(tbox(1.1, 0.05, 0.9, 2), MAT.woodDk, 0, 0.06, 0, tbl);                         // low stretcher shelf
  const boardMesh = new THREE.Mesh(new THREE.BoxGeometry(0.77, 0.05, 0.77),
    [MAT.woodDk, MAT.woodDk, new THREE.MeshToonMaterial({ gradientMap: grad, map: chessTex() }), MAT.woodDk, MAT.woodDk, MAT.woodDk]);
  boardMesh.position.set(0, 0.855, 0); boardMesh.castShadow = true; boardMesh.receiveShadow = true; tbl.add(boardMesh);
  // grain piles: squares 1..16 (rows 1-2). Pile i base sits ON the board top.
  for (let i = 0; i < 16; i++) {
    const col = i % 8, row = Math.floor(i / 8);
    const grp = new THREE.Group();
    grp.position.set(BOARD_C[0] + (col - 3.5) * SQ, BOARD_TOP, BOARD_C[1] + (row - 3.5) * SQ);
    const cone = add(new THREE.SphereGeometry(0.036, 8, 6), i % 2 ? MAT.rice : MAT.riceDk, 0, 0.012, 0, grp);
    cone.scale.set(1, 0.55, 1);
    grp.visible = false; g.add(grp); piles.push(grp);
  }
  // growing heaps on the court floor EAST of the table (the count outgrows
  // the board) — clear of the farmer's standing spot (1.7,-0.3) and the king's
  for (let i = 0; i < 3; i++) {
    const grp = new THREE.Group(); grp.position.set([2.75, 3.35, 3.0][i], 0, [0.55, -0.2, 1.25][i]); g.add(grp);
    const m = add(new THREE.SphereGeometry(0.3, 10, 8), i % 2 ? MAT.riceDk : MAT.rice, 0, 0.02, 0, grp);
    m.scale.set(1, 0.5, 1); grp.visible = false; heapMounds.push(grp);
  }
  // the bag of gold — rests on the table's near corner until the handover
  goldBagG = new THREE.Group(); goldBagG.position.set(0.28, 0.83, -0.5); g.add(goldBagG);
  const gb = add(new THREE.SphereGeometry(0.17, 10, 8), MAT.sack, 0, 0.11, 0, goldBagG); gb.scale.y = 0.78;
  add(new THREE.CylinderGeometry(0.045, 0.07, 0.09, 8), MAT.woodDk, 0, 0.26, 0, goldBagG);
  add(new THREE.ConeGeometry(0.13, 0.1, 10), MAT.gold, 0.16, 0.05, 0.08, goldBagG);
  // ================= GRANARY (x = -16): open-front storehouse =================
  flat(add(new THREE.CircleGeometry(7.5, 20), MAT.dirt, -16, -0.008, -3, g, { cast: false }));
  const gr2 = new THREE.Group(); gr2.position.set(-16, 0, -4.6); g.add(gr2);
  add(tbox(7.6, 3.4, 0.35, 2), MAT.stoneDk, 0, 1.7, -1.55, gr2, { cast: false });     // back wall
  add(tbox(0.35, 3.4, 3.4, 2), MAT.stoneDk, -3.62, 1.7, 0, gr2, { cast: false });     // side walls
  add(tbox(0.35, 3.4, 3.4, 2), MAT.stoneDk, 3.62, 1.7, 0, gr2, { cast: false });
  add(tbox(8.4, 0.3, 4.4, 2), MAT.woodDk, 0, 3.55, 0, gr2, { cast: false });          // roof slab
  add(new THREE.ConeGeometry(5.6, 1.5, 4), MAT.thatch, 0, 4.45, 0, gr2, { cast: false }).rotation.y = Math.PI / 4;
  add(tbox(7.6, 0.5, 0.35, 2), MAT.stone, 0, 3.15, 1.55, gr2, { cast: false });       // lintel over the open front
  for (const px of [-3.62, 3.62]) add(tbox(0.4, 3.4, 0.4, 2), MAT.woodDk, px, 1.7, 1.55, gr2, { cast: false }); // front posts
  flat(add(new THREE.PlaneGeometry(7.2, 3.2), MAT.dirt, 0, 0.005, 0, gr2, { cast: false })); // granary floor
  // doors — hinged at the front posts, driven by worldAt.doorK
  const mkDoor = (side) => {
    const hinge = new THREE.Group(); hinge.position.set(side * 3.42, 0, 1.5); gr2.add(hinge);
    add(tbox(3.3, 3.0, 0.09, 2), MAT.wood, -side * 1.65, 1.5, 0, hinge, { cast: false });
    add(tbox(3.3, 0.16, 0.11, 2), MAT.woodDk, -side * 1.65, 2.2, 0, hinge, { cast: false });
    add(tbox(3.3, 0.16, 0.11, 2), MAT.woodDk, -side * 1.65, 0.8, 0, hinge, { cast: false });
    return hinge;
  };
  doorL = mkDoor(-1); doorR = mkDoor(1);
  // sacks inside: back row 3 stacks x 3 high, mid row 3 x 2, front 2 — each sack
  // SITS on the floor or on the sack below (centre y = 0.26 + lvl*0.47).
  const sackAt = (x, lvl, z, seed) => {
    const grp = new THREE.Group(); grp.position.set(-16 + x, 0, -4.6 + z); g.add(grp);
    // body sub-group anchored at THIS sack's base (lvl*0.47): worldState scales
    // body.y to sag — the base stays planted on the sack/floor below
    const body = new THREE.Group(); body.position.y = lvl * 0.47; grp.add(body); grp.userData.body = body;
    const s = add(new THREE.SphereGeometry(0.42, 10, 8), seed % 2 ? MAT.sack : MAT.sackDk, 0, 0.26, 0, body);
    s.scale.set(1, 0.62, 0.82);
    add(new THREE.CylinderGeometry(0.09, 0.13, 0.12, 7), MAT.woodDk, 0.1, 0.55, 0.05, body, { cast: false });
    granSacks.push(grp); granSackMeta.push({ lvl, key: x + '|' + z }); return grp;
  };
  for (let i = 0; i < 3; i++) for (let l = 0; l < 3; l++) sackAt(-1.9 + i * 1.85, l, -0.75, i + l);
  for (let i = 0; i < 3; i++) for (let l = 0; l < 2; l++) sackAt(-1.9 + i * 1.85, l, 0.35, i + l + 5);
  for (let i = 0; i < 2; i++) sackAt(-0.95 + i * 1.85, 0, 1.3, i + 9);
  // a spilled grain heap on the granary floor (grows as sacks empty)
  const gHeap = new THREE.Group(); gHeap.position.set(-13.9, 0, -3.1); g.add(gHeap);
  const gh = add(new THREE.SphereGeometry(0.55, 10, 8), MAT.rice, 0, 0.02, 0, gHeap); gh.scale.set(1, 0.42, 1);
  gHeap.userData.isHeap = true; heapMounds.push(gHeap);
  // ================= CART (in front of the granary) =================
  const cart = new THREE.Group(); cart.position.set(-12.6, 0, 0.9); cart.rotation.y = 0.5; g.add(cart);
  add(tbox(1.7, 0.1, 1.05, 2), MAT.wood, 0, 0.62, 0, cart);                            // bed (top 0.67)
  for (const sx of [-0.82, 0.82]) add(tbox(0.07, 0.42, 1.0, 2), MAT.woodDk, sx, 0.86, 0, cart, { cast: false }); // side rails
  add(tbox(1.7, 0.42, 0.07, 2), MAT.woodDk, 0, 0.86, -0.5, cart, { cast: false });      // back rail
  for (const wx of [-0.95, 0.95]) {
    const wheel = add(new THREE.CylinderGeometry(0.52, 0.52, 0.09, 14), MAT.woodDk, wx, 0.52, 0, cart);
    wheel.rotation.z = Math.PI / 2;
    const hub = add(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 8), MAT.dark, wx, 0.52, 0, cart, { cast: false }); hub.rotation.z = Math.PI / 2;
  }
  for (const hx of [-0.3, 0.3]) { const hnd = add(tbox(0.07, 0.07, 1.5, 2), MAT.woodDk, hx, 0.45, 1.2, cart, { cast: false }); hnd.rotation.x = 0.18; } // handles toward the ground
  for (let i = 0; i < 4; i++) {   // sacks ON the cart bed (base flush on bed top 0.67)
    const grp = new THREE.Group(); grp.position.set(-0.42 + (i % 2) * 0.84, 0, -0.24 + Math.floor(i / 2) * 0.5); cart.add(grp);
    const s = add(new THREE.SphereGeometry(0.4, 10, 8), i % 2 ? MAT.sackDk : MAT.sack, 0, 0.67 + 0.24, 0, grp);
    s.scale.set(1, 0.6, 0.85); grp.visible = false; cartSacks.push(grp);
  }
  // ================= GARDEN (x = +16): the gardener's corner =================
  flat(add(new THREE.CircleGeometry(5.2, 18), MAT.grass, 16, -0.006, -1.2, g, { cast: false }));
  for (let i = 0; i < 5; i++) add(tbox(1.15, 0.75, 0.5, 2), MAT.hedge, 12.6 + i * 1.18, 0.37, -3.6, g, { cast: false }); // hedge row
  add(new THREE.CylinderGeometry(0.34, 0.5, 3.4, 8), MAT.woodDk, 19.6, 1.7, -4.6, g, { cast: false });
  const can2 = add(new THREE.SphereGeometry(2.3, 10, 8), MAT.leaf, 19.6, 4.2, -4.6, g, { cast: false }); can2.scale.y = 0.7; can2.userData.ndSkip = true;
  // the sand pile — cone SITTING on the ground (base at y=0) + a dirt contact disc
  const sand = new THREE.Group(); sand.position.set(16.4, 0, 0.5); g.add(sand);
  flat(add(new THREE.CircleGeometry(0.85, 16), MAT.dirt, 0, 0.006, 0, sand, { cast: false }));
  add(new THREE.ConeGeometry(0.78, 0.85, 14), MAT.sand, 0, 0.425, 0, sand);
  add(new THREE.CylinderGeometry(0.3, 0.24, 0.42, 10), MAT.woodDk, -0.95, 0.21, 0.25, sand); // bucket standing beside it
  // flower beds
  for (const [fx2, fz2] of [[13.6, -1.6], [14.6, -2.2], [18.9, -1.4]]) {
    add(tbox(0.8, 0.22, 0.5, 2), MAT.woodDk, fx2, 0.11, fz2, g, { cast: false });
    for (let i = 0; i < 4; i++) add(new THREE.SphereGeometry(0.09, 6, 5), MAT.crimson, fx2 - 0.3 + i * 0.2, 0.3, fz2, g, { cast: false });
  }
}
// ---- boards (transforms mirrored in boards.json — keep in sync) ----
const boardTitle = textBoard(['एक दाना…', 'पूरा राज्य?'], 3.0, 1.2, '#4a2c14', '#ffd76a'); boardTitle.position.set(0, 4.3, -3.12); world.add(boardTitle);
const boardCount = textBoard(['१ · २ · ४ · ८', 'हर ख़ाना — दोगुना!'], 1.5, 1.15, '#2e1a4a', '#ffe9a8'); boardCount.position.set(0.85, 2.95, -3.0); world.add(boardCount);
const boardSacks = textBoard(['ख़ाना २०', 'बोरियाँ ख़ाली होने लगीं'], 2.9, 1.15, '#4a2c14', '#ffd76a'); boardSacks.position.set(-16, 2.3, -2.9); world.add(boardSacks);
const boardBare = textBoard(['ख़ाना ४०', 'सारे भंडार ख़ाली!'], 2.9, 1.15, '#5a1f1f', '#ffe9a8'); boardBare.position.set(-16, 2.3, -2.9); world.add(boardBare);
const boardMath = textBoard(['पूरी दुनिया के चावल', 'से भी ज़्यादा!'], 2.9, 1.15, '#2e1a4a', '#ffe9a8'); boardMath.position.set(-1.5, 2.6, -2.9); world.add(boardMath);
const boardHook = textBoard(['रेत से रस्सी', 'कैसे बंधती है?'], 2.9, 1.0, '#1d2f4a', '#dfe8ff', 900, 0.85, 14); boardHook.position.set(15.6, 3.45, -3.3); world.add(boardHook);

// ---------- FX: court haze, granary dust, clouds ----------
const smoke = new FX.Smoke(scene, 130); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const hazeEmit = smoke.addEmitter(0, 2.6, -2, { rate: 0.3, color: 0xffe2b0, opacity: 0.045, scale: 2.4, grow: 1.3, life: 2.8, vy: 0.1, wind: -0.4 });
const dustEmit = smoke.addEmitter(-16, 1.6, -4, { rate: 0.1, color: 0xe8d9b0, opacity: 0.16, scale: 0.5, grow: 1.6, life: 1.1, vy: 0.5, wind: 0.3 });
const fxClouds = new FX.Clouds(scene, { count: 6, y: 42, opacity: 0.2, color: 0xf4f6fa, drift: 0.5 });
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
    hazeEmit.rate = pr.smokeRate; dustEmit.rate = pr.dustRate;
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
function worldState(Ws, f) {
  fxStepTo(f);
  skyU.time.value = f / 30;
  const setB = (mesh, v) => { mesh.material.opacity = v; mesh.visible = v > 0.01; };
  setB(boardTitle, Ws.boardTitle || 0); setB(boardCount, Ws.boardCount || 0);
  setB(boardSacks, Ws.boardSacks || 0); setB(boardBare, Ws.boardBare || 0);
  setB(boardMath, Ws.boardMath || 0); setB(boardHook, Ws.boardHook || 0);
  // grain piles on the board: pile i appears at Ws.pileAt[i]; it DROPS the last
  // 0.16 world-units with gravity (t^2) and then rests ON its square forever.
  // Width stays within the square (max r 0.052 < 0.0825); growth reads via
  // HEIGHT. The sphere's bottom is kept exactly ON the square at all times:
  // child y = r * scaleY, so the base never sinks into or floats off the board.
  const pa = Ws.pileAt || [];
  const PILE_W = [0.35, 0.47, 0.60, 0.72, 0.85, 0.97, 1.10, 1.22, 1.35, 1.47, 1.60, 1.72, 1.85, 1.97, 2.10, 2.20];
  const PILE_Y = [0.20, 0.28, 0.35, 0.43, 0.51, 0.58, 0.66, 0.74, 0.81, 0.89, 0.97, 1.04, 1.12, 1.20, 1.27, 1.35];
  piles.forEach((grp, i) => {
    const a = pa[i];
    if (a === undefined || f < a) { grp.visible = false; return; }
    grp.visible = true;
    const t = Math.min(1, (f - a) / 5);
    const drop = (1 - t * t) * 0.08;
    const grow = 0.55 + 0.45 * t;
    const sy = (PILE_Y[i] || 1) * grow;
    grp.children[0].scale.set((PILE_W[i] || 1) * grow, sy, (PILE_W[i] || 1) * grow);
    grp.children[0].position.y = 0.036 * sy;
    grp.position.y = BOARD_TOP + drop;
  });
  // floor heaps grow from their base ON the floor (base never lifts): the
  // court mounds follow heapK, the granary spill heap follows spillK
  const hk = Ws.heapK || 0, sk = Ws.spillK || 0;
  heapMounds.forEach((grp, i) => {
    const isHeap = !!grp.userData.isHeap;
    const local = isHeap ? clamp01(sk * 1.15) : clamp01(hk * 3.2 - i * 0.75);
    grp.visible = local > 0.02;
    const s = 0.3 + 0.9 * local;
    const w = isHeap ? 1.4 : 1;
    grp.children[0].scale.set(s * w, 0.45 * s, s * w);
  });
  // granary sacks: fullness per sack from Ws.sackFull[i] (1 = full, ~0.2 =
  // emptied flat). Sag is BOTTOM-anchored (body.y scale) AND each stack
  // compresses: a sack drops by the flattening of every sack below it, so
  // no layer ever floats above a sagged one.
  const sf = Ws.sackFull || [];
  let curKey = null, dropAcc = 0;
  granSacks.forEach((grp, i) => {
    const full = sf[i] ?? 1;
    const meta = granSackMeta[i] || { lvl: 0, key: '?' };
    if (meta.key !== curKey) { curKey = meta.key; dropAcc = 0; }
    const k = 0.3 + 0.7 * full;
    grp.position.y = -dropAcc;
    const body = grp.userData.body;
    if (body) {
      body.scale.y = k;
      const s = body.children[0];
      s.scale.set(0.7 + 0.3 * full, 0.62, 0.82 * (0.75 + 0.25 * full));
      body.children[1].visible = full > 0.35;
    }
    dropAcc += (1 - k) * 0.52;
  });
  // granary doors swing open with doorK
  const dk = Ws.doorK || 0;
  doorL.rotation.y = -dk * 1.9; doorR.rotation.y = dk * 1.9;
  // cart sacks: placed one by one, visible count from cartK (never floating)
  const ck = Ws.cartK || 0;
  cartSacks.forEach((grp, i) => { grp.visible = ck * cartSacks.length > i + 0.5; });
  // gold bag: position driven by story (rests on the table, then hand-to-hand)
  const gp = Ws.goldPos;
  if (gp) { goldBagG.visible = true; goldBagG.position.set(gp[0], gp[1], gp[2]); }
  else goldBagG.visible = false;
  // the spilled-gold cone only exists while the bag RESTS on the table —
  // once the king lifts it (f1412) there is no spill hanging in the air
  if (goldBagG.children[2]) goldBagG.children[2].visible = f < 1412;
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
