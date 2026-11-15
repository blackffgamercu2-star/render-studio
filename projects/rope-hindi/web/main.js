import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, kingAt, bagAt, SAND_EMIT, PILE_POS } from './story.js';

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
const MW = {
  dark: toon({ color: '#3c3a38' }),
  gold: toon({ color: '#c9a227' }),
};

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
const blobShadow = (w, d, opacity = 0.55) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: P.tex(P.radial('18,12,26', 0.62)), transparent: true, opacity, depthWrite: false, fog: true }));
  m.rotation.x = -Math.PI / 2; m.userData.ndSkip = true; m.renderOrder = 1; return m;
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
const textBoard = (lines, w, h, bg, fg, font = 900) => {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w);
  const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = fg; g.lineWidth = 14; g.strokeRect(20, 20, c.width - 40, c.height - 40);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  const fs = Math.min(170, (c.width - 130) / Math.max(...lines.map((l) => l.length)) * 1.72);
  g.font = `${font} ${fs}px 'Noto Sans Devanagari', Arial`;
  lines.forEach((l, i) => g.fillText(l, c.width / 2, c.height * (lines.length === 1 ? 0.52 : (i + 0.5) / lines.length)));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, fog: true }));
  m.userData.nd = ndMat; return m;
};
// soft radial glow sprite (NO hard cross — lamp light, not a sparkle)
const softGlow = (scale, color, opacity) => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 1, 32, 32, 31);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)'); grad.addColorStop(0.4, 'rgba(255,255,255,0.35)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(scale); s.userData.ndSkip = true; return s;
};

// ---------- the set ----------
const MAT = {
  grass: texM(P.grass(61), 16, 16, '#7fae4c'),
  dirt: texM(P.dirt(35), 8, 8, '#b49a72'),
  sand: texM(P.dirt(37), 3, 3, '#e3c98f'),
  stone: texM(P.stone(64, 40, 5, 58), 3, 2, '#c9c2b2'), stoneDk: texM(P.stone(65, 40, 6, 46), 3, 2, '#a89f8d'),
  wood: texM(P.beam(66, [26, 45, 32]), 1, 2), woodDk: texM(P.beam(67, [24, 40, 22]), 1, 2),
  plaster: texM(P.plaster(71, 36), 2, 2),
  thatch: toon({ color: '#b08d4f' }), leaf: toon({ color: '#4a6a34' }), leaf2: toon({ color: '#5d8142' }),
  gold: toon({ color: '#d9a441' }), goldBright: toon({ color: '#f0bc4a' }), goldDk: toon({ color: '#a87c28' }),
  sack: toon({ color: '#c9a24d' }), sackDk: toon({ color: '#a37f36' }),
  white: toon({ color: '#f7f3e6' }),
  cushion: toon({ color: '#8c2432' }), cushionB: toon({ color: '#2e3a6e' }),
  dark: toon({ color: '#33302c' }),
  flowerR: toon({ color: '#c94f6d' }), flowerY: toon({ color: '#e8c33a' }), flowerW: toon({ color: '#f3ead2' }),
};
const world = new THREE.Group(); scene.add(world);
{
  const g = world;
  flat(add(new THREE.PlaneGeometry(300, 240), MAT.grass, 8, -0.03, 0, g, { cast: false }));
  flat(add(new THREE.PlaneGeometry(64, 7), MAT.dirt, 10, -0.012, 3.4, g, { cast: false }));       // the road (east)
  flat(add(new THREE.PlaneGeometry(16, 5), MAT.dirt, -10, -0.011, -1.5, g, { cast: false }));     // court approach (west)
  flat(add(new THREE.CircleGeometry(7.5, 22), MAT.dirt, 1.0, -0.008, 0.2, g, { cast: false }));    // garden yard
  // distant huts + trees
  for (const [hx, hz, ry] of [[-7, -13, 0.2], [8, -14, -0.3], [20, -12, 0.4], [26, -13, -0.2]]) {
    const h = new THREE.Group(); h.position.set(hx, 0, hz); h.rotation.y = ry; g.add(h);
    add(tbox(2.6, 1.7, 2.2, 2), MAT.stone, 0, 0.85, 0, h, { cast: false });
    add(new THREE.ConeGeometry(2.2, 1.2, 4), MAT.thatch, 0, 2.3, 0, h, { cast: false }).rotation.y = Math.PI / 4;
  }
  for (const [tx, tz, s] of [[-11, -9, 1], [12.5, -10, 1.2], [23, -9, 0.9], [5.2, -5.5, 1.1]]) {
    add(new THREE.CylinderGeometry(0.3 * s, 0.44 * s, 2.8 * s, 8), MAT.woodDk, tx, 1.4 * s, tz, g, { cast: false });
    const can = add(new THREE.SphereGeometry(2.1 * s, 10, 8), MAT.leaf, tx, 3.6 * s, tz, g, { cast: false });
    can.scale.y = 0.72; can.userData.ndSkip = true;
  }
}
// ================= THE GARDEN (x≈0) =================
let sandPile;
{
  const g = world;
  // flower beds: low soil boxes with flower dots sitting ON the soil
  const bed = (x, z, cols) => {
    add(tbox(2.6, 0.22, 0.9, 2), MAT.dirt, x, 0.11, z, g, { cast: false });
    for (let i = 0; i < 7; i++) {
      add(new THREE.CylinderGeometry(0.02, 0.03, 0.3, 5), MAT.leaf2, x - 1.05 + i * 0.35, 0.36, z + ((i % 2) ? 0.18 : -0.18), g, { cast: false });
      add(new THREE.SphereGeometry(0.085, 8, 6), cols[i % cols.length], x - 1.05 + i * 0.35, 0.55, z + ((i % 2) ? 0.18 : -0.18), g, { cast: false });
    }
  };
  bed(-1.6, -2.6, [MAT.flowerR, MAT.flowerY, MAT.flowerW]);
  bed(3.6, 1.9, [MAT.flowerY, MAT.flowerR, MAT.flowerW]);
  // THE SAND PILE — a cone resting flush on the ground, contact shadow beneath
  const sh = blobShadow(1.7, 1.7, 0.5); sh.position.set(PILE_POS[0], 0.012, PILE_POS[2]); g.add(sh);
  sandPile = add(new THREE.ConeGeometry(0.58, 0.44, 18), MAT.sand, PILE_POS[0], 0.22, PILE_POS[2], g, { cast: false });
  // a small sand sack resting on the ground beside the pile
  const sackB = blobShadow(0.8, 0.8, 0.45); sackB.position.set(PILE_POS[0] + 0.85, 0.012, PILE_POS[2] + 0.3); g.add(sackB);
  const sack = add(new THREE.SphereGeometry(0.26, 10, 8), MAT.sackDk, PILE_POS[0] + 0.85, 0.2, PILE_POS[2] + 0.3, g, { cast: false });
  sack.scale.set(1, 0.78, 1);
}
// ================= TITLE SIGNPOST (garden, board at [0.6,2.2,-3.6]) =================
{
  const g = world;
  for (const px of [-0.9, 2.1]) add(new THREE.CylinderGeometry(0.07, 0.08, 3.0, 8), MAT.woodDk, px, 1.5, -3.6, g, { cast: false });
  add(tbox(3.5, 0.12, 0.12, 2), MAT.woodDk, 0.6, 2.75, -3.6, g, { cast: false });
}
// ================= ROYAL COURT / DARBAR (x=-16) =================
{
  const g = world, cx = -16;
  flat(add(new THREE.PlaneGeometry(11, 9), MAT.stone, cx, -0.005, -5.4, g, { cast: false }));
  add(tbox(10.5, 4.2, 0.4, 2), MAT.stoneDk, cx, 2.1, -8.7, g, { cast: false });
  add(tbox(0.4, 4.2, 5.4, 2), MAT.stoneDk, cx - 5.2, 2.1, -6.0, g, { cast: false });
  add(tbox(0.4, 4.2, 5.4, 2), MAT.stoneDk, cx + 5.2, 2.1, -6.0, g, { cast: false });
  add(tbox(11, 0.35, 6.4, 2), MAT.woodDk, cx, 4.35, -6.2, g, { cast: false });
  // the dais (top y=0.3, z -6.7..-4.5)
  add(tbox(4.4, 0.3, 2.2, 2), MAT.stoneDk, cx, 0.15, -5.6, g, { cast: false });
  add(tbox(4.8, 0.08, 2.6, 2), MAT.cushion, cx, 0.32, -5.6, g, { cast: false });
  // THE THRONE behind the king: high back + gold finials, standing on the dais
  add(tbox(1.5, 0.18, 0.9, 2), MAT.woodDk, cx, 0.39, -6.35, g, { cast: false });
  add(tbox(1.3, 1.9, 0.16, 2), MAT.wood, cx, 1.35, -6.75, g, { cast: false });
  add(tbox(1.06, 1.5, 0.06, 2), MAT.cushion, cx, 1.3, -6.65, g, { cast: false });
  for (const fx of [-0.62, 0.62]) {
    add(new THREE.SphereGeometry(0.11, 9, 7), MAT.goldBright, cx + fx, 2.38, -6.75, g, { cast: false });
    add(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 6), MAT.gold, cx + fx, 2.1, -6.75, g, { cast: false });
  }
  add(new THREE.SphereGeometry(0.14, 9, 7), MAT.goldBright, cx, 2.5, -6.75, g, { cast: false });
  // lamp stands flanking the dais (warm evening glow)
  for (const lx of [cx - 3.1, cx + 3.1]) {
    add(new THREE.CylinderGeometry(0.05, 0.09, 1.5, 8), MAT.dark, lx, 0.75, -6.4, g, { cast: false });
    add(new THREE.SphereGeometry(0.13, 9, 7), MAT.goldBright, lx, 1.58, -6.4, g, { cast: false });
    const gl = softGlow(1.7, 0xffc98a, 0.22); gl.position.set(lx, 1.6, -6.4); g.add(gl);
  }
  // a low table before the dais with a scroll resting ON it
  add(tbox(1.6, 0.1, 0.7, 2), MAT.wood, cx + 1.9, 0.62, -4.3, g, { cast: false });
  for (const [lx, lz] of [[-0.7, -0.25], [0.7, -0.25], [-0.7, 0.25], [0.7, 0.25]]) add(box(0.09, 0.6, 0.09), MAT.woodDk, cx + 1.9 + lx, 0.3, -4.3 + lz, g, { cast: false });
  const scroll = add(new THREE.CylinderGeometry(0.07, 0.07, 0.8, 9), MAT.white, cx + 1.9, 0.74, -4.3, g, { cast: false });
  scroll.rotation.z = Math.PI / 2; scroll.rotation.y = 0.3;
}
// ================= HOOK SIGNPOST (garden east, board at [4.4,2.3,-3.2]) =================
{
  const g = world;
  for (const px of [2.9, 5.9]) add(new THREE.CylinderGeometry(0.07, 0.08, 2.9, 8), MAT.woodDk, px, 1.45, -3.2, g, { cast: false });
  add(tbox(3.4, 0.12, 0.12, 2), MAT.woodDk, 4.4, 2.85, -3.2, g, { cast: false });
}
// ================= SAND POUR — grains that FALL and LAND on the pile =================
const GRAINS = 130;
const grainMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.014, 5, 4), toon({ color: '#e8d096' }), GRAINS);
grainMesh.userData.ndSkip = true; grainMesh.castShadow = false; grainMesh.frustumCulled = false; world.add(grainMesh);
const grainSeed = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
const dummy = new THREE.Object3D();
const updateSand = (Ws) => {
  const t = Ws.sandT ?? -1; // seconds since pour start; <0 = no pour
  const [ex, ey, ez] = SAND_EMIT;
  const grow = 1 + 0.13 * (Ws.pileGrow || 0);
  sandPile.scale.set(grow, 1 + 0.22 * (Ws.pileGrow || 0), grow);
  const pileTop = (x, z) => {
    const dx = (x - PILE_POS[0]) / grow, dz = (z - PILE_POS[2]) / grow;
    const r = Math.hypot(dx, dz);
    return r >= 0.58 ? 0.0 : 0.44 * (1 + 0.22 * (Ws.pileGrow || 0)) * (1 - r / 0.58);
  };
  for (let i = 0; i < GRAINS; i++) {
    let px = ex, py = -10, pz = ez, sc = 0.001;
    if (t >= 0) {
      const si = grainSeed(i, 1) * 2.1;            // spawn spread over the pour
      const lt = t - si;                            // grain age
      if (lt >= 0) {
        const vx = (grainSeed(i, 2) - 0.5) * 0.14, vz = (grainSeed(i, 3) - 0.5) * 0.14;
        const lx = ex + vx * Math.min(lt, 3), lz = ez + vz * Math.min(lt, 3);
        const landY = pileTop(lx, lz) + 0.012;
        const fallY = ey - 5.9 * lt * lt;           // gravity: accelerating fall
        if (fallY > landY) { px = lx; py = fallY; pz = lz; sc = 1; }
        else {
          // LANDED: rests on the pile surface; sinks away only after the pour ends
          px = lx; pz = lz; py = landY;
          const sink = (Ws.sandT ?? 0) - 3.4;
          if (sink > 0) { py = landY - sink * 0.1; sc = Math.max(0.001, 1 - sink * 1.4); }
          else sc = 1;
        }
      }
    }
    dummy.position.set(px, py, pz); dummy.scale.setScalar(sc); dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix(); grainMesh.setMatrixAt(i, dummy.matrix);
  }
  grainMesh.instanceMatrix.needsUpdate = true;
  grainMesh.visible = t >= 0;
};
// ================= THE KING'S CROWN — sits ON his head, slips when he laughs =================
let crownG;
{
  crownG = new THREE.Group(); world.add(crownG);
  const band = add(new THREE.TorusGeometry(0.205, 0.05, 8, 18), MAT.goldBright, 0, 0, 0, crownG, { cast: false });
  band.rotation.x = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.19, 0.215, 0.09, 14, 1, true), MAT.gold, 0, 0.03, 0, crownG, { cast: false });
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    const spike = add(new THREE.ConeGeometry(0.045, 0.17, 6), MAT.goldBright, Math.cos(a) * 0.19, 0.15, Math.sin(a) * 0.19, crownG, { cast: false });
    spike.rotation.z = -Math.cos(a) * 0.18; spike.rotation.x = Math.sin(a) * 0.18;
  }
  add(new THREE.SphereGeometry(0.05, 8, 6), MAT.cushion, 0, 0.05, 0.21, crownG, { cast: false }); // front jewel
  add(new THREE.SphereGeometry(0.055, 8, 6), MAT.goldBright, 0, 0.26, 0, crownG, { cast: false });
  crownG.rotation.order = 'YXZ';
}
// ================= THE GOLD BAG — handed hand-to-hand, carried with weight =================
let bagG, bagBlob;
{
  bagG = new THREE.Group(); world.add(bagG);
  const body = add(new THREE.SphereGeometry(0.21, 12, 10), MAT.sack, 0, 0, 0, bagG, { cast: false });
  body.scale.set(1, 0.88, 1);
  add(new THREE.CylinderGeometry(0.055, 0.1, 0.12, 9), MAT.sackDk, 0, 0.2, 0, bagG, { cast: false });
  const tie = add(new THREE.TorusGeometry(0.075, 0.022, 6, 12), MAT.goldDk, 0, 0.15, 0, bagG, { cast: false });
  tie.rotation.x = Math.PI / 2;
  for (let i = 0; i < 3; i++) {
    const coin = add(new THREE.CylinderGeometry(0.045, 0.045, 0.016, 10), MAT.goldBright, -0.07 + i * 0.07, 0.24, 0.02, bagG, { cast: false });
    coin.rotation.x = 0.5; coin.rotation.z = i * 0.4;
  }
  bagBlob = blobShadow(0.62, 0.62, 0.5); world.add(bagBlob);
}

// ---- boards (transforms mirrored in boards.json — keep in sync) ----
const boardTitle = textBoard(['रेत की रस्सी'], 3.0, 0.79, '#4a2c14', '#ffd76a'); boardTitle.position.set(0.6, 2.2, -3.6); world.add(boardTitle);
const boardHook = textBoard(['बिना तराज़ू के हाथी', 'कैसे तौला जाता है?'], 3.2, 0.95, '#2e3a5a', '#ffe9a8'); boardHook.position.set(4.4, 2.3, -3.2); world.add(boardHook);

// ---------- FX: haze ----------
const smoke = new FX.Smoke(scene, 130); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const hazeEmit = smoke.addEmitter(0, 2.4, 0, { rate: 0.35, color: 0xffffff, opacity: 0.04, scale: 2.2, grow: 1.3, life: 2.6, vy: 0.1, wind: -0.5 });
const dustEmit = smoke.addEmitter(-16, 1.6, -5, { rate: 0, color: 0xffe2b8, opacity: 0.1, scale: 0.5, grow: 1.2, life: 2.2, vy: 0.16, wind: 0.15 });
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
  setB(boardTitle, Ws.boardTitle || 0); setB(boardHook, Ws.boardHook || 0);
  updateSand(Ws);
  // crown: glued to the king's head; slip = tilt + slide + settle, always in contact
  const K = kingAt(f), C = camAt(f);
  crownG.visible = (Ws.crown || 0) > 0.01;
  if (crownG.visible) {
    const slip = Ws.crownSlip || 0;
    crownG.position.set(K.pos[0] + 0.09 * slip * K.s, K.pos[1] + (1.8 - 0.05 * slip) * K.s, K.pos[2]);
    crownG.rotation.set(0.1 * slip, Math.atan2(C.pos[0] - K.pos[0], C.pos[2] - K.pos[2]) + (K.yaw || 0), -0.42 * slip);
    crownG.scale.setScalar(K.s);
  }
  // gold bag: position/squash from story; blob shadow tracks it on the ground below
  const B = bagAt(f);
  bagG.visible = !!B; bagBlob.visible = !!B;
  if (B) {
    bagG.position.set(B.p[0], B.p[1], B.p[2]);
    bagG.scale.set(2 - (B.sq || 1), B.sq || 1, 2 - (B.sq || 1));
    bagG.rotation.z = B.tilt || 0;
    const gy = (B.p[0] > -18.4 && B.p[0] < -13.6 && B.p[2] > -6.9 && B.p[2] < -4.4) ? 0.315 : 0.015;
    bagBlob.position.set(B.p[0], gy, B.p[2]);
    bagBlob.material.opacity = 0.5 * Math.max(0.25, 1 - (B.p[1] - gy) * 0.35);
  }
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
