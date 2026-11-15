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

// ---------- the set: a rich householder's kitchen, morning light ----------
const MAT = {
  floor: texM(P.stone(61, 36, 10, 60), 14, 14, '#b3a284'),
  dirt: texM(P.dirt(63), 10, 3, '#a8895e'),
  carpet: toon({ color: '#8c2432' }),
  plaster: texM(P.plaster(33, 36), 3, 2, '#e8d9b8'),
  stone: texM(P.stone(44, 36, 12, 56), 2, 2, '#c4b294'),
  stoneDk: texM(P.stone(45, 34, 16, 44), 2, 2, '#9a8a6e'),
  wood: texM(P.beam(66, [26, 45, 32]), 1, 2), woodDk: texM(P.beam(67, [24, 40, 22]), 1, 2),
  gold: toon({ color: '#e8b93c' }), goldDk: toon({ color: '#a87f1e' }),
  brass: toon({ color: '#c9a227' }), iron: toon({ color: '#4a4d55' }),
  dark: toon({ color: '#33302c' }),
  silkRed: toon({ color: '#a02340' }), silkBlue: toon({ color: '#274a7a' }),
  sack: toon({ color: '#a8803e' }), leaf: toon({ color: '#4a6a34' }),
  thatch: texM(P.roof(69), 2, 2, '#b08d4f'),
  houseA: texM(P.plaster(71, 28), 2, 2, '#e0cba8'), houseB: texM(P.plaster(72, 200), 2, 2, '#d8c4ae'),
  coinGlow: new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0, fog: true }),
};
const world = new THREE.Group(); scene.add(world);
{
  const g = world;
  // ground: palace courtyard stone, parade street (dirt) to the south
  flat(add(new THREE.PlaneGeometry(76, 48), MAT.floor, 0, -0.03, 3, g, { cast: false }));
  flat(add(new THREE.PlaneGeometry(52, 7.6), MAT.dirt, 0, -0.014, 6.4, g, { cast: false }));
  flat(add(new THREE.PlaneGeometry(1.9, 6.6), MAT.carpet, 0, -0.006, -0.5, g, { cast: false })); // red carpet to the throne
  // ================= PALACE FACADE (z=-3.45) + THRONE =================
  add(tbox(6.9, 4.9, 0.5, 2), MAT.stoneDk, -4.6, 2.45, -3.45, g, { cast: false });
  add(tbox(6.9, 4.9, 0.5, 2), MAT.stoneDk, 4.6, 2.45, -3.45, g, { cast: false });
  add(tbox(16.1, 0.4, 0.7, 2), MAT.stone, 0, 5.05, -3.45, g, { cast: false });
  add(tbox(2.4, 2.35, 0.5, 2), MAT.stoneDk, 0, 3.72, -3.45, g, { cast: false });   // lintel over the arch
  for (const sx of [-5.9, 5.9]) {
    add(new THREE.CylinderGeometry(1.05, 1.2, 6.0, 10), MAT.stone, sx, 3.0, -3.45, g, { cast: false });
    add(new THREE.ConeGeometry(1.5, 1.3, 10), MAT.thatch, sx, 6.6, -3.45, g, { cast: false });
  }
  add(tbox(2.3, 2.6, 0.1, 2), MAT.dark, 0, 1.3, -3.55, g, { cast: false });        // warm dark arch behind the throne
  // THE THRONE at z=-2.7 (king's card at z=-2.2, every part BEHIND his plane)
  const th = new THREE.Group(); th.position.set(0, 0, -2.7); g.add(th);
  add(tbox(2.2, 0.18, 0.9, 2), MAT.stoneDk, 0, 0.09, 0, th, { cast: false });       // dais step
  add(tbox(1.7, 0.5, 0.7, 2), MAT.goldDk, 0, 0.43, 0, th, { cast: false });          // seat base
  add(tbox(1.9, 2.0, 0.18, 2), MAT.goldDk, 0, 1.5, -0.45, th, { cast: false });      // tall back
  add(new THREE.SphereGeometry(0.17, 10, 8), MAT.gold, 0, 2.62, -0.45, th, { cast: false }); // finial
  for (const sx of [-0.88, 0.88]) add(tbox(0.15, 0.55, 0.7, 2), MAT.goldDk, sx, 0.95, 0, th, { cast: false }); // armrests
  add(tbox(1.3, 0.12, 0.6, 2), MAT.carpet, 0, 0.74, 0.02, th, { cast: false });    // seat cushion
  add(tbox(1.2, 1.1, 0.08, 2), MAT.carpet, 0, 1.45, -0.34, th, { cast: false });    // back cushion
  // hall pillars (they give the loom corner its depth)
  for (const px of [-3.3, 3.3]) {
    add(new THREE.CylinderGeometry(0.26, 0.32, 3.6, 10), MAT.stone, px, 1.8, -1.1, g, { cast: false });
    add(tbox(0.8, 0.22, 0.8, 2), MAT.stoneDk, px, 3.7, -1.1, g, { cast: false });
    add(tbox(0.85, 0.25, 0.85, 2), MAT.stoneDk, px, 0.12, -1.1, g, { cast: false });
  }
  // ================= OFFERING TABLE before the throne =================
  // top surface at y=0.565; the gold and silk REST on it (flush + contact discs)
  add(tbox(2.0, 0.09, 0.85, 2), MAT.wood, 0, 0.52, -0.8, g, { cast: false });
  for (const [lx, lz] of [[-0.9, -0.32], [0.9, -0.32], [-0.9, 0.32], [0.9, 0.32]]) add(tbox(0.1, 0.48, 0.1, 1), MAT.woodDk, lx, 0.24, -0.8 + lz, g, { cast: false });
  const shadeDisc = (x, y, z, r) => { const d = flat(add(new THREE.CircleGeometry(r, 14), new THREE.MeshBasicMaterial({ color: 0x1a120a, transparent: true, opacity: 0.28, fog: true }), x, y, z, g, { cast: false })); d.userData.ndSkip = true; return d; };
  shadeDisc(-0.45, 0.568, -0.8, 0.34); shadeDisc(0.42, 0.568, -0.72, 0.3); shadeDisc(0.5, 0.568, -0.95, 0.26);
  const coinPile = add(new THREE.ConeGeometry(0.3, 0.22, 12), MAT.gold, -0.45, 0.565 + 0.11, -0.8, g, { cast: false });
  for (let i = 0; i < 6; i++) add(new THREE.CylinderGeometry(0.07, 0.07, 0.035, 10), MAT.gold, -0.62 + (i % 3) * 0.17, 0.565 + 0.018 + Math.floor(i / 3) * 0.036, -0.58, g, { cast: false });
  const silk1 = add(new THREE.CylinderGeometry(0.09, 0.09, 0.62, 10), MAT.silkRed, 0.42, 0.565 + 0.09, -0.72, g, { cast: false }); silk1.rotation.z = Math.PI / 2;
  const silk2 = add(new THREE.CylinderGeometry(0.08, 0.08, 0.55, 10), MAT.silkBlue, 0.5, 0.565 + 0.08, -0.98, g, { cast: false }); silk2.rotation.z = Math.PI / 2;
  add(new THREE.TorusGeometry(0.09, 0.016, 6, 14), MAT.gold, 0.42, 0.565 + 0.09, -0.45, g, { cast: false }).rotation.y = Math.PI / 2;
  // ================= THE LOOMS (west end of the hall) =================
  // Bare wooden frames — NO warp, NO cloth: the joke is they weave air.
  // Legs plant on the floor; the weaver's bench stands in front of each loom.
  const loomAt = (lx, lz) => {
    const L = new THREE.Group(); L.position.set(lx, 0, lz); g.add(L);
    for (const sx of [-0.58, 0.58]) {
      add(tbox(0.1, 1.3, 0.12, 1), MAT.woodDk, sx, 0.65, -0.28, L, { cast: false });  // back posts
      add(tbox(0.1, 1.05, 0.12, 1), MAT.woodDk, sx, 0.52, 0.3, L, { cast: false });   // front posts
      add(tbox(0.1, 0.1, 0.66, 1), MAT.woodDk, sx, 0.05, 0, L, { cast: false });      // ground sill (feet flush)
    }
    add(tbox(1.26, 0.1, 0.1, 1), MAT.wood, 0, 1.28, -0.28, L, { cast: false });       // top beam
    const warp = add(new THREE.CylinderGeometry(0.07, 0.07, 1.16, 10), MAT.wood, 0, 1.05, -0.28, L, { cast: false }); warp.rotation.z = Math.PI / 2; // warp roller (bare)
    const breast = add(new THREE.CylinderGeometry(0.08, 0.08, 1.16, 10), MAT.wood, 0, 0.62, 0.3, L, { cast: false }); breast.rotation.z = Math.PI / 2; // breast beam
    add(tbox(1.16, 0.07, 0.07, 1), MAT.woodDk, 0, 0.86, 0.02, L, { cast: false });    // heddle bar (empty)
    // weaver's bench: seat top y=0.46, feet on the floor in front of it
    add(tbox(1.15, 0.08, 0.36, 1), MAT.wood, 0, 0.42, 0.78, L, { cast: false });
    for (const [bx, bz] of [[-0.5, 0.66], [0.5, 0.66], [-0.5, 0.9], [0.5, 0.9]]) add(tbox(0.09, 0.38, 0.09, 1), MAT.woodDk, bx, 0.19, bz, L, { cast: false });
    shadeDisc(lx, 0.005, lz + 0.05, 0.95);
  };
  loomAt(-4.3, -1.7); loomAt(-6.2, -1.7);
  // yarn baskets beside the looms (grounded, with contact discs)
  for (const [bx, bz] of [[-3.3, -0.9], [-5.25, -2.6]]) {
    add(new THREE.CylinderGeometry(0.3, 0.24, 0.34, 12), MAT.sack, bx, 0.17, bz, g, { cast: false });
    add(new THREE.SphereGeometry(0.13, 9, 7), toon({ color: '#c9335a' }), bx - 0.08, 0.38, bz, g, { cast: false });
    add(new THREE.SphereGeometry(0.11, 9, 7), toon({ color: '#e8b93c' }), bx + 0.12, 0.36, bz + 0.05, g, { cast: false });
    shadeDisc(bx, 0.005, bz, 0.36);
  }
  // ================= THE STREET (south, z≈6.4) =================
  // house facades behind the south crowd line
  const houseAt = (hx, hz, w, h, mat, roofMat) => {
    add(tbox(w, h, 0.5, 2), mat, hx, h / 2, hz, g, { cast: false });
    const rf = add(new THREE.ConeGeometry(w * 0.72, 1.1, 4), roofMat, hx, h + 0.55, hz, g, { cast: false }); rf.rotation.y = Math.PI / 4;
    add(tbox(0.7, 1.1, 0.1, 1), MAT.woodDk, hx - w * 0.22, 0.55, hz - 0.28, g, { cast: false });
    add(tbox(0.62, 0.62, 0.08, 1), MAT.dark, hx + w * 0.24, h * 0.62, hz - 0.28, g, { cast: false });
  };
  houseAt(-6.5, 10.6, 3.6, 2.9, MAT.houseA, MAT.thatch);
  houseAt(-1.5, 10.9, 4.2, 3.4, MAT.houseB, MAT.thatch);
  houseAt(4.2, 10.6, 3.8, 3.0, MAT.houseA, MAT.thatch);
  houseAt(9.0, 10.9, 3.4, 2.7, MAT.houseB, MAT.thatch);
  // lamp posts along the street (parallax markers for the parade tracking shot)
  for (const px of [-5.5, 0.5, 6.0]) {
    add(new THREE.CylinderGeometry(0.05, 0.07, 2.6, 8), MAT.iron, px, 1.3, 3.4, g, { cast: false });
    add(tbox(0.34, 0.42, 0.34, 1), MAT.goldDk, px, 2.75, 3.4, g, { cast: false });
    shadeDisc(px, 0.005, 3.4, 0.3);
  }
  // market stalls north of the street (behind the king's route)
  for (const [sx, sz] of [[-7.5, 3.1], [7.8, 3.2]]) {
    add(tbox(1.7, 0.08, 0.9, 1), MAT.wood, sx, 0.85, sz, g, { cast: false });
    for (const [ox, oz] of [[-0.75, -0.35], [0.75, -0.35], [-0.75, 0.35], [0.75, 0.35]]) add(tbox(0.09, 0.85, 0.09, 1), MAT.woodDk, sx + ox, 0.42, sz + oz, g, { cast: false });
    for (const px of [-2.2, 2.2]) add(new THREE.CylinderGeometry(0.045, 0.045, 2.2, 7), MAT.woodDk, sx + px * 0.36, 1.1, sz - 0.3, g, { cast: false });
    const awn = add(tbox(1.9, 0.05, 1.2, 1), MAT.carpet, sx, 2.05, sz, g, { cast: false }); awn.rotation.x = 0.18;
    add(new THREE.SphereGeometry(0.13, 8, 6), toon({ color: '#d97a2e' }), sx - 0.4, 0.98, sz, g, { cast: false });
    add(new THREE.SphereGeometry(0.13, 8, 6), toon({ color: '#c9335a' }), sx + 0.1, 0.98, sz + 0.1, g, { cast: false });
    add(new THREE.SphereGeometry(0.13, 8, 6), toon({ color: '#5d8142' }), sx + 0.5, 0.98, sz - 0.08, g, { cast: false });
  }
}
let coinGlint;
coinGlint = FX.glint(0.5); coinGlint.position.set(-0.45, 0.85, -0.62); coinGlint.userData.ndSkip = true; world.add(coinGlint);
let silkGlint;
silkGlint = FX.glint(0.4); silkGlint.position.set(0.42, 0.78, -0.5); silkGlint.userData.ndSkip = true; world.add(silkGlint);
// ---- boards (transforms mirrored in boards.json — keep in sync) ----
function postSign(lines, w, h, bg, fg, gx, gz, ry, cy = 1.5) {
  const g = new THREE.Group(); g.position.set(gx, 0, gz); g.rotation.y = ry; world.add(g);
  add(new THREE.CylinderGeometry(0.05, 0.07, Math.max(1.2, cy + h / 2), 6), MAT.woodDk, 0, (cy + h / 2) / 2, -0.06, g, { cast: false });
  const b = textBoard(lines, w, h, bg, fg); b.position.set(0, cy, 0.05); g.add(b);
  return b;
}
const boardTitle = postSign(['वो कपड़ा जो सिर्फ़', 'मूर्खों को नहीं दिखता'], 2.6, 1.0, '#5a2a3a', '#ffe9a8', -2.7, -2.35, 0.3, 2.2);
const boardShout = postSign(['देखो! राजा ने कुछ', 'पहना ही नहीं है!'], 2.2, 1.0, '#7a2e1a', '#ffe9a8', 1.9, 9.6, 3.29, 1.55);
const boardHook = postSign(['एक पत्थर से', 'सूप कैसे बनेगा?'], 2.4, 1.0, '#2e3a5a', '#ffe9a8', 6.6, 7.0, 3.3, 1.55);

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
  setB(boardTitle, Ws.boardTitle || 0); setB(boardShout, Ws.boardShout || 0); setB(boardHook, Ws.boardHook || 0);
  coinGlint.material.opacity = (Ws.goldK || 0) * 0.7;
  silkGlint.material.opacity = (Ws.goldK || 0) * 0.45;
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
