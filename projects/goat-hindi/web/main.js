import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, ropeAt } from './story.js';

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
  return m; // boards stay IN the ND pass: their depth occludes set geometry behind them (no ghost ink lines)
};

// ---------- the set: village market square, inn to the north, river to the south ----------
const MAT = {
  floor: texM(P.stone(61, 36, 10, 60), 14, 14, '#b3a284'),
  dirt: texM(P.dirt(63), 10, 3, '#a8895e'),
  sand: texM(P.dirt(64), 8, 2, '#c9b078'),
  carpet: toon({ color: '#8c2432' }),
  plaster: texM(P.plaster(33, 36), 3, 2, '#e8d9b8'),
  stone: texM(P.stone(44, 36, 12, 56), 2, 2, '#c4b294'),
  stoneDk: texM(P.stone(45, 34, 16, 44), 2, 2, '#9a8a6e'),
  wood: texM(P.beam(66, [26, 45, 32]), 1, 2), woodDk: texM(P.beam(67, [24, 40, 22]), 1, 2),
  gold: toon({ color: '#e8b93c' }), goldDk: toon({ color: '#a87f1e' }),
  brass: toon({ color: '#c9a227' }), iron: toon({ color: '#4a4d55' }),
  dark: toon({ color: '#33302c' }),
  clay: toon({ color: '#6e4a2e' }), clayDk: toon({ color: '#4a2e1a' }), dyeBlack: toon({ color: '#14100c' }),
  sack: toon({ color: '#a8803e' }), leaf: toon({ color: '#4a6a34' }),
  reed: toon({ color: '#5d7a3a' }),
  thatch: texM(P.roof(69), 2, 2, '#b08d4f'),
  houseA: texM(P.plaster(71, 28), 2, 2, '#e0cba8'), houseB: texM(P.plaster(72, 200), 2, 2, '#d8c4ae'),
  coinGlow: new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0, fog: true }),
};
const world = new THREE.Group(); scene.add(world);
const shadeDisc = (x, y, z, r, parent = world) => { const d = flat(add(new THREE.CircleGeometry(r, 14), new THREE.MeshBasicMaterial({ color: 0x1a120a, transparent: true, opacity: 0.28, fog: true }), x, y, z, parent, { cast: false })); d.userData.ndSkip = true; return d; };
{
  const g = world;
  // ground: market stone square; dirt road running south to the river; sand bank
  flat(add(new THREE.PlaneGeometry(76, 29), MAT.floor, 0, -0.03, -6.75, g, { cast: false })); // ends at the river bank so the water shows
  flat(add(new THREE.PlaneGeometry(10, 7), MAT.dirt, 0.6, -0.014, 4.45, g, { cast: false })); // dirt road ends at the bank
  flat(add(new THREE.PlaneGeometry(44, 2.6), MAT.sand, 0, -0.008, 7.4, g, { cast: false })); // river bank
  // ================= INN FACADE (z=-3.5), door at x=2.2 =================
  // ONE continuous wall (no gaps, no floating gable) + door/windows/sign on it.
  add(tbox(16.1, 4.9, 0.5, 2), MAT.houseA, 0, 2.45, -3.5, g, { cast: false });
  add(tbox(16.1, 0.4, 0.7, 2), MAT.stone, 0, 5.05, -3.5, g, { cast: false });
  // inn door (wood) + step stone, flush on the ground
  add(tbox(1.1, 2.1, 0.12, 1), MAT.woodDk, 2.2, 1.05, -3.22, g, { cast: false });
  add(tbox(1.3, 0.14, 0.5, 1), MAT.stoneDk, 2.2, 0.07, -3.0, g, { cast: false });
  add(new THREE.SphereGeometry(0.05, 8, 6), MAT.brass, 2.55, 1.05, -3.14, g, { cast: false });
  // windows with shutters
  for (const wx of [-4.2, -1.5, 5.6]) {
    add(tbox(0.7, 0.9, 0.1, 1), MAT.dark, wx, 1.9, -3.22, g, { cast: false });
    add(tbox(0.14, 0.9, 0.06, 1), MAT.wood, wx - 0.42, 1.9, -3.2, g, { cast: false });
    add(tbox(0.14, 0.9, 0.06, 1), MAT.wood, wx + 0.42, 1.9, -3.2, g, { cast: false });
  }
  // hanging inn sign (painted round sign on a bracket, no text)
  add(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 7), MAT.iron, 1.1, 2.9, -3.1, g, { cast: false }).rotation.z = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.34, 0.34, 0.06, 14), MAT.goldDk, 0.62, 2.45, -3.1, g, { cast: false }).rotation.x = Math.PI / 2;
  add(new THREE.SphereGeometry(0.1, 8, 6), MAT.dark, 0.62, 2.45, -3.05, g, { cast: false });
  // wall lantern beside the door + clay pot at the wall base (grounded)
  add(tbox(0.3, 0.4, 0.3, 1), MAT.goldDk, 3.6, 2.4, -3.2, g, { cast: false });
  add(new THREE.CylinderGeometry(0.28, 0.22, 0.4, 12), MAT.clay, -0.6, 0.2, -3.1, g, { cast: false });
  shadeDisc(-0.6, 0.005, -3.1, 0.36);
  // ================= TYING POST beside the inn door =================
  // Post plants ON the ground; ring at the top where the rope ties.
  add(new THREE.CylinderGeometry(0.09, 0.12, 1.5, 8), MAT.woodDk, 3.05, 0.75, -1.75, g, { cast: false });
  add(new THREE.TorusGeometry(0.11, 0.025, 6, 12), MAT.iron, 3.05, 1.45, -1.75, g, { cast: false });
  shadeDisc(3.05, 0.005, -1.75, 0.3);
  // ================= PAYMENT TABLE (market centre) =================
  // top surface at y=0.565; the coin pile RESTS on it (flush + contact discs)
  add(tbox(1.6, 0.09, 0.85, 2), MAT.wood, 0.2, 0.52, -0.4, g, { cast: false });
  for (const [lx, lz] of [[-0.5, -0.32], [0.9, -0.32], [-0.5, 0.32], [0.9, 0.32]]) add(tbox(0.1, 0.48, 0.1, 1), MAT.woodDk, lx, 0.24, -0.4 + lz, g, { cast: false });
  shadeDisc(-0.1, 0.568, -0.4, 0.32); shadeDisc(0.55, 0.568, -0.35, 0.24);
  add(new THREE.ConeGeometry(0.28, 0.22, 12), MAT.gold, -0.1, 0.565 + 0.11, -0.4, g, { cast: false });
  for (let i = 0; i < 6; i++) add(new THREE.CylinderGeometry(0.07, 0.07, 0.035, 10), MAT.gold, -0.28 + (i % 3) * 0.17, 0.565 + 0.018 + Math.floor(i / 3) * 0.036, -0.18, g, { cast: false });
  add(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 10), MAT.goldDk, 0.55, 0.565 + 0.09, -0.35, g, { cast: false }).rotation.z = Math.PI / 2; // coin roll
  // ================= DYE CORNER (west) — low wall + clay pots =================
  add(tbox(0.5, 1.1, 3.4, 2), MAT.stoneDk, -5.7, 0.55, 1.2, g, { cast: false });
  add(tbox(0.6, 0.18, 3.6, 2), MAT.stone, -5.7, 1.18, 1.2, g, { cast: false });
  for (const [bx, bz, br] of [[-5.1, 2.9, 0.3], [-5.2, -0.4, 0.26]]) {
    add(new THREE.CylinderGeometry(br, br * 0.8, br * 1.5, 12), MAT.clay, bx, br * 0.75, bz, g, { cast: false });
    shadeDisc(bx, 0.005, bz, br + 0.08);
  }
  // hay bales (grounded, contact discs) — dull straw, not bright yellow
  for (const [hx, hz] of [[-5.0, 0.2], [-4.7, 2.4]]) {
    const bale = add(new THREE.CylinderGeometry(0.26, 0.26, 0.7, 10), toon({ color: '#9a7a45' }), hx, 0.26, hz, g, { cast: false }); bale.rotation.z = Math.PI / 2;
    shadeDisc(hx, 0.005, hz, 0.45);
  }
  // ================= MARKET STALLS =================
  for (const [sx, sz] of [[-7.5, 3.1], [7.8, 3.2]]) {
    add(tbox(1.7, 0.08, 0.9, 1), MAT.wood, sx, 0.85, sz, g, { cast: false });
    for (const [ox, oz] of [[-0.75, -0.35], [0.75, -0.35], [-0.75, 0.35], [0.75, 0.35]]) add(tbox(0.09, 0.85, 0.09, 1), MAT.woodDk, sx + ox, 0.42, sz + oz, g, { cast: false });
    for (const px of [-2.2, 2.2]) add(new THREE.CylinderGeometry(0.045, 0.045, 2.2, 7), MAT.woodDk, sx + px * 0.36, 1.1, sz - 0.3, g, { cast: false });
    const awn = add(tbox(1.9, 0.05, 1.2, 1), MAT.carpet, sx, 2.05, sz, g, { cast: false }); awn.rotation.x = 0.18;
    add(new THREE.SphereGeometry(0.13, 8, 6), toon({ color: '#d97a2e' }), sx - 0.4, 0.98, sz, g, { cast: false });
    add(new THREE.SphereGeometry(0.13, 8, 6), toon({ color: '#c9335a' }), sx + 0.1, 0.98, sz + 0.1, g, { cast: false });
    add(new THREE.SphereGeometry(0.13, 8, 6), toon({ color: '#5d8142' }), sx + 0.5, 0.98, sz - 0.08, g, { cast: false });
  }
  // ================= HOUSES flanking the square (east/west depth) =================
  const houseAt = (hx, hz, w, h, mat, ry = 0) => {
    const H = new THREE.Group(); H.position.set(hx, 0, hz); H.rotation.y = ry; g.add(H);
    add(tbox(w, h, 0.5, 2), mat, 0, h / 2, 0, H, { cast: false });
    const rf = add(new THREE.ConeGeometry(w * 0.72, 1.1, 4), MAT.thatch, 0, h + 0.55, 0, H, { cast: false }); rf.rotation.y = Math.PI / 4;
    add(tbox(0.7, 1.1, 0.1, 1), MAT.woodDk, -w * 0.22, 0.55, -0.28, H, { cast: false });
    add(tbox(0.62, 0.62, 0.08, 1), MAT.dark, w * 0.24, h * 0.62, -0.28, H, { cast: false });
  };
  houseAt(-8.6, -0.6, 3.6, 2.9, MAT.houseA, Math.PI / 2);
  houseAt(8.8, -0.4, 3.8, 3.0, MAT.houseB, -Math.PI / 2);
  houseAt(8.6, 5.6, 3.4, 2.7, MAT.houseA, -Math.PI / 2);
  // lamp posts along the market (parallax markers) — kept clear of camera paths
  for (const px of [-5.5, 7.6]) {
    add(new THREE.CylinderGeometry(0.05, 0.07, 2.6, 8), MAT.iron, px, 1.3, 3.4, g, { cast: false });
    add(tbox(0.34, 0.42, 0.34, 1), MAT.goldDk, px, 2.75, 3.4, g, { cast: false });
    shadeDisc(px, 0.005, 3.4, 0.3);
  }
  // trees (trunk planted, canopy above) — east/west edges
  for (const [tx, tz] of [[-8.2, 6.4], [8.4, 6.2]]) {
    add(new THREE.CylinderGeometry(0.16, 0.24, 2.2, 8), MAT.woodDk, tx, 1.1, tz, g, { cast: false });
    add(new THREE.SphereGeometry(1.15, 10, 8), MAT.leaf, tx, 2.9, tz, g, { cast: false });
    add(new THREE.SphereGeometry(0.8, 10, 8), MAT.leaf, tx + 0.7, 2.4, tz + 0.3, g, { cast: false });
    shadeDisc(tx, 0.005, tz, 1.1);
  }
  // ================= RIVER (south): reeds + stones on the bank =================
  for (let i = 0; i < 14; i++) {
    if (i === 7 || i === 11) continue; // keep the river + hookout sightlines clear
    const rx = -6.5 + i * 1.0 + (i % 3) * 0.2, rz = 7.7 + (i % 2) * 0.25;
    add(new THREE.CylinderGeometry(0.02, 0.035, 1.1 + (i % 3) * 0.2, 5), MAT.reed, rx, 0.55, rz, g, { cast: false });
  }
  for (const [sx, sz, sr] of [[-2.2, 7.5, 0.3], [3.4, 7.6, 0.24], [5.8, 7.4, 0.36]]) {
    add(new THREE.SphereGeometry(sr, 8, 6), MAT.stoneDk, sx, sr * 0.55, sz, g, { cast: false });
    shadeDisc(sx, 0.005, sz, sr + 0.1);
  }
}
// ---- the river itself (animated shader water, south of the bank) ----
// Narrow strip only: z 7.8..16.8, low amp, sunk below the bank so the waves
// NEVER poke through the market ground plane.
const water = FX.makeWater({ size: 60, seg: 80, deep: 0x14425e, shallow: 0x2e7ea6, amp: 0.15 });
water.position.set(0, -0.25, 12.3); water.scale.set(1, 0.15, 1); water.userData.ndSkip = true; scene.add(water);
// ---- the dye pot (set prop): sits ON the ground at the dye corner ----
// Visible only while worldAt.dyePot = 1 (before the lift, after the set-down).
// Its base is flush on the ground + contact disc: NEVER floats.
const dyePotGroup = new THREE.Group(); dyePotGroup.position.set(-4.3, 0, 0.6); world.add(dyePotGroup);
{
  const dp = dyePotGroup;
  add(new THREE.CylinderGeometry(0.3, 0.24, 0.42, 12), MAT.clay, 0, 0.21, 0, dp, { cast: false });
  add(new THREE.CylinderGeometry(0.26, 0.26, 0.03, 12), MAT.dyeBlack, 0, 0.42, 0, dp, { cast: false }); // black dye surface
  add(new THREE.TorusGeometry(0.3, 0.03, 6, 14), MAT.clayDk, 0, 0.4, 0, dp, { cast: false }).rotation.x = Math.PI / 2;
  shadeDisc(0, 0.005, 0, 0.38, dp);
}
// ---- the tying rope: a thin cylinder, re-aimed every frame by renderFrame ----
const ropeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1, 6), new THREE.MeshBasicMaterial({ color: 0x8a6d3b }));
ropeMesh.visible = false; ropeMesh.userData.ndSkip = true; scene.add(ropeMesh);
const ropeUp = new THREE.Vector3(0, 1, 0);
function updateRope(f, camPos) {
  const r = ropeAt(f, camPos);
  if (!r) { ropeMesh.visible = false; return; }
  ropeMesh.visible = true;
  const a = new THREE.Vector3(...r.a), b = new THREE.Vector3(...r.b);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const dir = b.clone().sub(a), len = dir.length();
  ropeMesh.position.copy(mid);
  ropeMesh.scale.set(1, len, 1);
  ropeMesh.quaternion.setFromUnitVectors(ropeUp, dir.normalize());
}
let coinGlint;
coinGlint = FX.glint(0.5); coinGlint.position.set(0.0, 0.85, -0.4); coinGlint.userData.ndSkip = true; world.add(coinGlint);
// ---- boards (transforms mirrored in boards.json — keep in sync) ----
function postSign(lines, w, h, bg, fg, gx, gz, ry, cy = 1.5) {
  const g = new THREE.Group(); g.position.set(gx, 0, gz); g.rotation.y = ry; world.add(g);
  add(new THREE.CylinderGeometry(0.05, 0.07, Math.max(1.2, cy + h / 2), 6), MAT.woodDk, 0, (cy + h / 2) / 2, -0.06, g, { cast: false });
  const b = textBoard(lines, w, h, bg, fg); b.position.set(0, cy, 0.05); g.add(b);
  return b;
}
const boardTitle = postSign(['एक ही बकरी', 'दो बार बेच दी'], 2.6, 1.0, '#5a2a3a', '#ffe9a8', -3.4, -1.2, 0.5, 2.2);
const boardPunch = postSign(['धुली बकरी के पैसे', 'वापस नहीं मिलते।'], 2.6, 1.0, '#7a2e1a', '#ffe9a8', 3.2, 1.6, 0.0, 1.6);
const boardHook = postSign(['उसने अमीर व्यापारी को', 'उसकी अपनी गूँज बेच दी'], 2.8, 1.0, '#2e3a5a', '#ffe9a8', 4.8, 5.4, 0.0, 1.55);

// ---------- FX: dusk haze, gate dust, clouds ----------
const smoke = new FX.Smoke(scene, 130); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const hazeEmit = smoke.addEmitter(0, 2.6, -2, { rate: 0.3, color: 0xffe2b0, opacity: 0.045, scale: 2.4, grow: 1.3, life: 2.8, vy: 0.1, wind: -0.4 });
const dustEmit = smoke.addEmitter(0, 0.7, 5.6, { rate: 0.1, color: 0xe8d9b0, opacity: 0.16, scale: 0.5, grow: 1.6, life: 1.1, vy: 0.5, wind: 0.3 });
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
  setB(boardTitle, Ws.boardTitle || 0); setB(boardPunch, Ws.boardPunch || 0); setB(boardHook, Ws.boardHook || 0);
  coinGlint.material.opacity = (Ws.goldK || 0) * 0.7;
  dyePotGroup.visible = (Ws.dyePot || 0) > 0.5;
  if (water.userData.update) water.userData.update(f / 30);
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
  updateRope(f, C.pos);
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
