import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, POTBIG, POTBABY, VESSELP, WED, BENCH, DONKEY, SIGNP } from './story.js';

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
  g.font = `${font} ${fs}px Arial`;
  lines.forEach((l, i) => g.fillText(l, c.width / 2, c.height * (lines.length === 1 ? 0.52 : (i + 0.5) / lines.length)));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, fog: true }));
  m.userData.ndSkip = true; return m;
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
  stone: texM(P.stone(64, 40, 5, 58), 3, 2, '#c9c2b2'), stoneDk: texM(P.stone(65, 40, 6, 46), 3, 2, '#a89f8d'),
  wood: texM(P.beam(66, [26, 45, 32]), 1, 2), woodDk: texM(P.beam(67, [24, 40, 22]), 1, 2),
  plaster: texM(P.plaster(71, 36), 2, 2),
  thatch: toon({ color: '#b08d4f' }), leaf: toon({ color: '#4a6a34' }), leaf2: toon({ color: '#5d8142' }),
  gold: toon({ color: '#d9a441' }), goldBright: toon({ color: '#f0bc4a' }),
  copper: toon({ color: '#b87333' }), copperDk: toon({ color: '#8a5a24' }), copperBright: toon({ color: '#d99a55' }),
  sack: toon({ color: '#c9a24d' }), sackDk: toon({ color: '#a37f36' }),
  steel: toon({ color: '#565d66' }), steelDk: toon({ color: '#33373d' }),
  white: toon({ color: '#f7f3e6' }),
  cushion: toon({ color: '#8c2432' }),
  canopy: toon({ color: '#b03a5a' }), canopyGold: toon({ color: '#e8c45a' }),
  marigold: toon({ color: '#e8862a' }),
  dark: toon({ color: '#33302c' }),
  shadowSoft: new THREE.MeshBasicMaterial({ color: 0x1a2410, transparent: true, opacity: 0.32, fog: true }),
};
const world = new THREE.Group(); scene.add(world);
{
  const g = world;
  flat(add(new THREE.PlaneGeometry(340, 240), MAT.grass, 0, -0.03, 0, g, { cast: false }));
  flat(add(new THREE.PlaneGeometry(90, 7), MAT.dirt, 0, -0.012, 3.4, g, { cast: false }));       // the village road
  flat(add(new THREE.CircleGeometry(8.5, 22), MAT.dirt, 0, -0.008, 0.5, g, { cast: false }));      // neighbour's courtyard
  flat(add(new THREE.CircleGeometry(5.5, 18), MAT.dirt, -16, -0.008, -2, g, { cast: false }));     // wedding ground
  flat(add(new THREE.CircleGeometry(6, 18), MAT.dirt, 32, -0.008, -2, g, { cast: false }));        // court ground
  flat(add(new THREE.CircleGeometry(5, 18), MAT.dirt, -32, -0.008, -2, g, { cast: false }));       // roadside ground
  // distant huts + trees (depth for the east/west flights)
  for (const [hx, hz, ry] of [[-7, -13, 0.2], [8, -14, -0.3], [20, -12, 0.4], [26, -13, -0.2], [-24, -13, 0.1], [-40, -12, -0.4]]) {
    const h = new THREE.Group(); h.position.set(hx, 0, hz); h.rotation.y = ry; g.add(h);
    add(tbox(2.6, 1.7, 2.2, 2), MAT.stone, 0, 0.85, 0, h, { cast: false });
    add(new THREE.ConeGeometry(2.2, 1.2, 4), MAT.thatch, 0, 2.3, 0, h, { cast: false }).rotation.y = Math.PI / 4;
  }
  for (const [tx, tz, s] of [[-11, -9, 1], [12.5, -10, 1.2], [23, -9, 0.9], [-24, -10, 1.1]]) {
    add(new THREE.CylinderGeometry(0.3 * s, 0.44 * s, 2.8 * s, 8), MAT.woodDk, tx, 1.4 * s, tz, g, { cast: false });
    const can = add(new THREE.SphereGeometry(2.1 * s, 10, 8), MAT.leaf, tx, 3.6 * s, tz, g, { cast: false });
    can.scale.y = 0.72; can.userData.ndSkip = true;
  }
}
// ---- pot builder: squashed sphere body + neck + rim + side handles ----
const makePot = (r, mat, matDk) => {
  const g = new THREE.Group();
  const body = add(new THREE.SphereGeometry(r, 18, 12), mat, 0, r * 0.72, 0, g); body.scale.y = 0.82;
  add(new THREE.CylinderGeometry(r * 0.52, r * 0.68, r * 0.3, 14), mat, 0, r * 1.42, 0, g);
  const rim = add(new THREE.TorusGeometry(r * 0.54, r * 0.07, 8, 18), matDk, 0, r * 1.56, 0, g); rim.rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) {
    const h = add(new THREE.TorusGeometry(r * 0.26, r * 0.05, 8, 14, Math.PI), matDk, s * r * 0.92, r * 0.9, 0, g);
    h.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2;
  }
  return g;
};
// ================= NEIGHBOUR'S COURTYARD (house facade z=-3.2) =================
let bigPot, babyPot, vesselMesh, potGlint, vesselGlint;
{
  const g = world;
  add(tbox(7.5, 4.9, 0.35, 2), MAT.plaster, 0, 2.45, -3.7, g, { cast: false });
  const roof = add(tbox(8.2, 0.14, 3.0, 2), MAT.thatch, 0, 4.95, -2.5, g, { cast: false }); roof.rotation.x = 0.1;
  add(tbox(1.2, 2.0, 0.1, 2), MAT.dark, -2.2, 1.0, -3.5, g, { cast: false });   // door
  add(tbox(0.9, 0.9, 0.1, 2), MAT.dark, 2.2, 1.8, -3.5, g, { cast: false });    // window
  add(tbox(0.9, 0.08, 0.5, 2), MAT.woodDk, 2.2, 1.32, -3.4, g, { cast: false }); // window sill
  // pot shelf on the facade (the golden vessel lives here)
  add(tbox(2.6, 0.1, 0.5, 2), MAT.wood, -0.9, 1.0, -2.85, g, { cast: false });
  add(box(0.08, 0.3, 0.08), MAT.woodDk, -2.0, 0.82, -2.85, g, { cast: false });
  add(box(0.08, 0.3, 0.08), MAT.woodDk, 0.2, 0.82, -2.85, g, { cast: false });
  const shelfPot1 = makePot(0.16, MAT.copper, MAT.copperDk); shelfPot1.position.set(-1.55, 1.05, -2.85); g.add(shelfPot1);
  const shelfPot2 = makePot(0.14, MAT.copper, MAT.copperDk); shelfPot2.position.set(-0.25, 1.05, -2.85); g.add(shelfPot2);
  // THE big copper pot (hero) + the baby pot, on the ground between the men
  bigPot = makePot(0.55, MAT.copper, MAT.copperDk); bigPot.position.set(POTBIG[0], 0, POTBIG[2]); g.add(bigPot);
  babyPot = makePot(0.28, MAT.copperBright, MAT.copperDk); babyPot.position.set(POTBABY[0], 0, POTBABY[2]); g.add(babyPot);
  // THE golden vessel, ornate: gold pot + lid + knob, on the shelf
  vesselMesh = makePot(0.32, MAT.goldBright, MAT.gold); vesselMesh.position.set(VESSELP[0], VESSELP[1], VESSELP[2]); g.add(vesselMesh);
  const lid = add(new THREE.ConeGeometry(0.2, 0.16, 12), MAT.gold, VESSELP[0], VESSELP[1] + 0.52, VESSELP[2], g, { cast: false });
  add(new THREE.SphereGeometry(0.05, 8, 6), MAT.goldBright, VESSELP[0], VESSELP[1] + 0.62, VESSELP[2], g, { cast: false });
  vesselMesh.userData.lid = lid;
  potGlint = FX.glint(0.5); potGlint.position.set(POTBIG[0], 1.15, POTBIG[2] + 0.2); potGlint.userData.ndSkip = true; g.add(potGlint);
  vesselGlint = FX.glint(0.45); vesselGlint.position.set(VESSELP[0], VESSELP[1] + 0.55, VESSELP[2] + 0.15); vesselGlint.userData.ndSkip = true; g.add(vesselGlint);
  // crates + barrel west of the courtyard
  const c1 = FX.crate(1.15); c1.position.set(-5.5, 0.55, 0.55); g.add(c1);
  const c2 = FX.crate(0.95); c2.position.set(-5.35, 1.55, 0.6); c2.rotation.y = 0.4; g.add(c2);
  const b1 = FX.barrel(0.52, 1.25); b1.position.set(-4.35, 0.62, 0.35); g.add(b1);
}
// ================= WEDDING PAVILION (x=-16) =================
{
  const g = world, wx = -16;
  for (const [px, pz] of [[-18.5, -5.5], [-13.5, -5.5], [-18.5, -1.5], [-13.5, -1.5]])
    add(new THREE.CylinderGeometry(0.09, 0.11, 2.8, 8), MAT.woodDk, px, 1.4, pz, g, { cast: false });
  add(tbox(5.6, 0.12, 4.6, 2), MAT.canopy, wx, 2.9, -3.5, g, { cast: false });
  add(tbox(5.7, 0.08, 0.18, 2), MAT.canopyGold, wx, 2.98, -1.25, g, { cast: false });
  // marigold garland along the canopy front edge
  for (let i = 0; i < 9; i++) {
    const gx = wx - 2.4 + i * 0.6;
    add(new THREE.SphereGeometry(0.09, 8, 6), i % 2 ? MAT.marigold : MAT.canopyGold, gx, 2.78 - 0.06 * Math.sin(i * 1.2), -1.28, g, { cast: false });
  }
  // THE finest pot on its stone pedestal
  add(tbox(1.0, 0.5, 1.0, 2), MAT.stone, wx, 0.25, -3.5, g, { cast: false });
  const fine = makePot(0.5, MAT.copper, MAT.copperDk); fine.position.set(WED[0], 0.5, WED[2]); g.add(fine);
  const fineGlint = FX.glint(0.5); fineGlint.position.set(WED[0], 1.35, WED[2] + 0.2); fineGlint.userData.ndSkip = true; g.add(fineGlint);
  // wedding lamps + marigold pots
  for (const lx of [-18, -14]) {
    add(new THREE.CylinderGeometry(0.09, 0.12, 0.5, 8), MAT.gold, lx, 0.25, -2.0, g, { cast: false });
    const lg = softGlow(1.2, 0xffc98a, 0.2); lg.position.set(lx, 0.62, -2.0); g.add(lg);
  }
  for (const [mx, mz] of [[-14.5, -4.5], [-17.5, -4.5]]) {
    add(new THREE.CylinderGeometry(0.18, 0.14, 0.3, 8), MAT.copperDk, mx, 0.15, mz, g, { cast: false });
    add(new THREE.SphereGeometry(0.16, 8, 6), MAT.marigold, mx, 0.38, mz, g, { cast: false });
  }
}
// ================= BORROWER'S HUT (x=+16) =================
{
  const g = world, hx = 16;
  flat(add(new THREE.CircleGeometry(4.6, 18), MAT.dirt, hx, -0.006, -1.2, g, { cast: false }));
  add(tbox(7.5, 3.4, 0.35, 2), MAT.plaster, hx, 1.7, -3.7, g, { cast: false });
  add(tbox(0.35, 3.4, 4.4, 2), MAT.plaster, hx + 3.7, 1.7, -1.6, g, { cast: false });
  const roof = add(tbox(8.2, 0.14, 3.0, 2), MAT.thatch, hx, 3.35, -2.5, g, { cast: false }); roof.rotation.x = 0.1;
  add(tbox(1.1, 1.9, 0.1, 2), MAT.dark, hx - 1.2, 0.95, -3.5, g, { cast: false });
  const hp = makePot(0.3, MAT.copper, MAT.copperDk); hp.position.set(hx + 1.8, 0, -0.6); g.add(hp);
}
// ================= JUDGE'S COURT (x=+32) =================
{
  const g = world, cx = 32;
  add(tbox(9, 4.5, 0.4, 2), MAT.stoneDk, cx, 2.25, -7.0, g, { cast: false });
  add(tbox(9.8, 0.5, 1.1, 2), MAT.stone, cx, 4.7, -7.0, g, { cast: false });
  for (const px of [28.5, 35.5]) add(new THREE.CylinderGeometry(0.32, 0.38, 6.4, 10), MAT.stoneDk, px, 3.2, -5.5, g, { cast: false });
  add(tbox(6, 0.15, 3.5, 2), MAT.canopy, cx, 3.6, -5.0, g, { cast: false });
  for (const px of [29.5, 34.5]) add(new THREE.CylinderGeometry(0.09, 0.11, 3.6, 8), MAT.woodDk, px, 1.8, -4.0, g, { cast: false });
  // the bench: seat + back + red cushion
  add(tbox(3.2, 0.5, 1.0, 2), MAT.woodDk, BENCH[0], 0.9, BENCH[2], g, { cast: false });
  add(tbox(3.2, 1.0, 0.15, 2), MAT.woodDk, BENCH[0], 1.6, BENCH[2] - 0.45, g, { cast: false });
  add(tbox(3.2, 0.65, 0.1, 2), MAT.woodDk, BENCH[0], 0.32, BENCH[2] + 0.52, g, { cast: false });   // modesty panel: hides the judge's robe below the seat
  add(tbox(3.0, 0.12, 0.9, 2), MAT.cushion, BENCH[0], 1.2, BENCH[2], g, { cast: false });
  add(tbox(4.6, 0.22, 1.4, 2), MAT.stone, cx, 0.11, -4.2, g, { cast: false });   // dais step
  add(tbox(5.4, 0.22, 1.4, 2), MAT.stoneDk, cx, 0.11, -2.9, g, { cast: false }); // lower step
  // brass scales of justice on a side table
  add(tbox(1.2, 0.1, 0.7, 2), MAT.wood, cx - 3.6, 0.75, -5.2, g, { cast: false });
  for (const [lx, lz] of [[-0.5, -0.25], [0.5, -0.25], [-0.5, 0.25], [0.5, 0.25]]) add(box(0.09, 0.72, 0.09), MAT.woodDk, cx - 3.6 + lx, 0.36, -5.2 + lz, g, { cast: false });
  add(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 8), MAT.gold, cx - 3.6, 1.15, -5.2, g, { cast: false });
  add(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 12), MAT.gold, cx - 3.95, 0.82, -5.2, g, { cast: false });
  add(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 12), MAT.gold, cx - 3.25, 0.82, -5.2, g, { cast: false });
}
// ================= DONKEY ROADSIDE (x=-32) =================
{
  const g = world, rx0 = -32;
  // the big shade tree whose shadow the traveller sits in — moved WEST 3.5
  // units (fix 2026-11-15, mirrors pot-hindi): its canopy used to poke in
  // front of the hook board and eat the "H" of "HOW" (EN f1718 defect).
  // Shadow disc stays where it was. Board/camera untouched.
  add(new THREE.CylinderGeometry(0.34, 0.5, 3.4, 8), MAT.woodDk, -41.0, 1.7, -6.0, g, { cast: false });
  const can1 = add(new THREE.SphereGeometry(2.6, 10, 8), MAT.leaf, -41.0, 4.4, -6.0, g, { cast: false }); can1.scale.y = 0.72;
  const can2 = add(new THREE.SphereGeometry(1.8, 10, 8), MAT.leaf2, -39.7, 3.8, -5.1, g, { cast: false }); can2.scale.y = 0.7;
  // the donkey's shadow on the ground (the traveller sits inside it)
  const sh = flat(add(new THREE.CircleGeometry(1.9, 18), MAT.shadowSoft, -31.5, 0.012, -2.0, g, { cast: false }));
  sh.scale.set(1.3, 1, 1);
  // signpost for the hook board — two tall posts flanking the board
  // (no crossbar: it read as a random beam across the frame).
  add(box(0.12, 4.1, 0.12), MAT.woodDk, -35.8, 2.05, -2.0, g, { cast: false });
  add(box(0.12, 4.1, 0.12), MAT.woodDk, -33.2, 2.05, -2.0, g, { cast: false });
}
// ---- boards (transforms mirrored in boards.json — keep in sync) ----
const boardBirth = textBoard(['A POT GAVE BIRTH!'], 3.0, 0.85, '#7a3b12', '#ffd76a'); boardBirth.position.set(0, 4.3, -3.12); world.add(boardBirth);
const boardVessel = textBoard(['THE GOLDEN VESSEL'], 2.6, 0.8, '#4a2c14', '#ffd76a'); boardVessel.position.set(0, 3.6, -3.12); world.add(boardVessel);
const boardDied = textBoard(['IT DIED'], 2.0, 0.8, '#3a1a1a', '#ff9a7a'); boardDied.position.set(0, 3.6, -3.12); world.add(boardDied);
const boardHook = textBoard(['HOW DO YOU', 'PAY FOR', 'A SHADOW?'], 2.2, 1.25, '#2e4a2e', '#ffe9a8'); boardHook.position.set(SIGNP[0], SIGNP[1], SIGNP[2]); world.add(boardHook);

// ---------- FX: haze ----------
const smoke = new FX.Smoke(scene, 130); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const hazeEmit = smoke.addEmitter(0, 2.4, 0, { rate: 0.35, color: 0xffffff, opacity: 0.04, scale: 2.2, grow: 1.3, life: 2.6, vy: 0.1, wind: -0.5 });
const dustEmit = smoke.addEmitter(-16, 1.6, -3.5, { rate: 0, color: 0xffe2b8, opacity: 0.1, scale: 0.5, grow: 1.2, life: 2.2, vy: 0.16, wind: 0.15 });
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
  setB(boardBirth, Ws.boardBirth || 0); setB(boardVessel, Ws.boardVessel || 0); setB(boardDied, Ws.boardDied || 0); setB(boardHook, Ws.boardHook || 0);
  const bk = Ws.potBabyK ?? 1; babyPot.visible = bk > 0.02; babyPot.scale.setScalar(Math.max(bk, 0.001));
  const vk = Ws.vesselK ?? 1; vesselMesh.visible = vk > 0.02; vesselMesh.userData.lid.visible = vk > 0.02;
  potGlint.material.opacity = 0.3;
  vesselGlint.material.opacity = vk * 0.4;
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
