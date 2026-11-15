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

// ---------- the set: palace court (x=0), crow grove (x=-16), moon well (x=+16) ----------
const MAT = {
  grass: texM(P.grass(61), 16, 16, '#7fae4c'),
  dirt: texM(P.dirt(35), 8, 8, '#b49a72'),
  stone: texM(P.stone(64, 40, 5, 58), 3, 2, '#c9c2b2'), stoneDk: texM(P.stone(65, 40, 6, 46), 3, 2, '#a89f8d'),
  wood: texM(P.beam(66, [26, 45, 32]), 1, 2), woodDk: texM(P.beam(67, [24, 40, 22]), 1, 2),
  thatch: toon({ color: '#b08d4f' }), leaf: toon({ color: '#4a6a34' }), leaf2: toon({ color: '#5d8142' }),
  gold: toon({ color: '#d9a441' }), goldDk: toon({ color: '#a87c24' }),
  plaster: texM(P.plaster(33, 36), 2, 2),
  dark: toon({ color: '#33302c' }), darkDS: toon({ color: '#2a2723', side: THREE.DoubleSide }), iron: toon({ color: '#4a4d55' }),
  sack: toon({ color: '#a8803e' }),
  crimson: toon({ color: '#8c2432' }),
  crow: toon({ color: '#1c1c22' }), crowWing: toon({ color: '#2a2a33' }),
  beak: toon({ color: '#4a4a4a' }),
  water: new THREE.MeshBasicMaterial({ color: 0x24405e, fog: true }), // OPAQUE on purpose: a transparent water disc renders after the moon-glow and covers it (92% dark navy over the pale glow)
  goldGlow: new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0, fog: true }),
  moonGlowMat: new THREE.MeshBasicMaterial({ color: 0xdfe8ff, transparent: true, opacity: 0, fog: true }),
  moonFragMat: new THREE.MeshBasicMaterial({ color: 0xdfe8ff, transparent: true, opacity: 0, fog: true }),
  rippleMat: new THREE.MeshBasicMaterial({ color: 0xcfe0ff, transparent: true, opacity: 0, fog: true, side: THREE.DoubleSide }),
  woodDS: toon({ color: '#6e5136', side: THREE.DoubleSide }),
};
const world = new THREE.Group(); scene.add(world);
let moonGroup, moonDisc, goldBagG, paperG, bucketG, bucketWater, ropeMesh;
const moonFrags = [], ripples = [];
const crowsFly = [], crowsPerch = [];
{
  const g = world;
  const gr = flat(add(new THREE.PlaneGeometry(300, 240), MAT.grass, 8, -0.03, 0, g, { cast: false })); gr.receiveShadow = true;
  flat(add(new THREE.CircleGeometry(9.5, 24), MAT.dirt, 0, -0.012, 0.5, g, { cast: false }));   // court yard
  flat(add(new THREE.PlaneGeometry(40, 3.0), MAT.dirt, -2, -0.014, 1.0, g, { cast: false }));    // road west to the grove
  flat(add(new THREE.PlaneGeometry(20, 3.0), MAT.dirt, 10, -0.014, 1.0, g, { cast: false }));    // road east to the well
  flat(add(new THREE.PlaneGeometry(1.7, 5.2), MAT.crimson, 0, -0.006, 0.4, g, { cast: false })); // red carpet, throne to court
  // distant huts + trees (depth for the eastward flight)
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
  add(tbox(2.4, 2.35, 0.5, 2), MAT.stoneDk, 0, 3.72, -3.45, g, { cast: false });   // lintel over the arch (no sky-hole)
  for (const sx of [-5.9, 5.9]) {   // facade towers
    add(new THREE.CylinderGeometry(1.05, 1.2, 6.0, 10), MAT.stone, sx, 3.0, -3.45, g, { cast: false });
    add(new THREE.ConeGeometry(1.5, 1.3, 10), MAT.thatch, sx, 6.6, -3.45, g, { cast: false });
  }
  add(tbox(2.3, 2.6, 0.1, 2), MAT.dark, 0, 1.3, -3.55, g, { cast: false });        // warm dark arch behind the throne
  // THE THRONE — wider than the king's card (1.35) so it reads around him; z=-2.7 with slim depths
  // so every part stays BEHIND the king's card plane at z=-2.2 (seat base used to jut to -2.0 and hide his body)
  const th = new THREE.Group(); th.position.set(0, 0, -2.7); g.add(th);
  add(tbox(2.2, 0.18, 0.9, 2), MAT.stoneDk, 0, 0.09, 0, th, { cast: false });       // dais step
  add(tbox(1.7, 0.5, 0.7, 2), MAT.goldDk, 0, 0.43, 0, th, { cast: false });          // seat base
  add(tbox(1.9, 2.0, 0.18, 2), MAT.goldDk, 0, 1.5, -0.45, th, { cast: false });      // tall back
  add(new THREE.SphereGeometry(0.17, 10, 8), MAT.gold, 0, 2.62, -0.45, th, { cast: false }); // finial (peeks above the card)
  for (const sx of [-0.88, 0.88]) add(tbox(0.15, 0.55, 0.7, 2), MAT.goldDk, sx, 0.95, 0, th, { cast: false }); // armrests
  add(tbox(1.3, 0.12, 0.6, 2), MAT.crimson, 0, 0.74, 0.02, th, { cast: false });    // seat cushion
  add(tbox(1.2, 1.1, 0.08, 2), MAT.crimson, 0, 1.45, -0.34, th, { cast: false });    // back cushion
  // guards' spears planted at their posts
  for (const sx of [-2.0, 2.0]) {
    add(new THREE.CylinderGeometry(0.03, 0.035, 2.7, 7), MAT.woodDk, sx, 1.35, -1.9, g, { cast: false });
    add(new THREE.ConeGeometry(0.07, 0.34, 8), MAT.iron, sx, 2.85, -1.9, g, { cast: false });
  }
  // ================= CROW GROVE (x = -16) =================
  flat(add(new THREE.CircleGeometry(7.5, 20), MAT.dirt, -16, -0.008, -5, g, { cast: false }));
  const treeAt = (tx, tz, s) => {
    add(new THREE.CylinderGeometry(0.34 * s, 0.5 * s, 3.4 * s, 8), MAT.woodDk, tx, 1.7 * s, tz, g, { cast: false });
    const c1 = add(new THREE.SphereGeometry(2.3 * s, 10, 8), MAT.leaf, tx, 4.2 * s, tz, g, { cast: false }); c1.scale.y = 0.7; c1.userData.ndSkip = true;
    const c2 = add(new THREE.SphereGeometry(1.6 * s, 10, 8), MAT.leaf2, tx + 1.2 * s, 3.4 * s, tz + 0.4, g, { cast: false }); c2.scale.y = 0.7; c2.userData.ndSkip = true;
    const br = add(new THREE.CylinderGeometry(0.09 * s, 0.12 * s, 2.2 * s, 6), MAT.woodDk, tx + 1.4 * s, 3.1 * s, tz + 0.6, g, { cast: false });
    br.rotation.z = Math.PI / 2 - 0.35;
  };
  treeAt(-16, -6.5, 1.15); treeAt(-19.5, -4.2, 0.95); treeAt(-13.2, -7.8, 1.0); treeAt(-18.6, -8.6, 0.85);
  // ================= MOON WELL (x = +16) =================
  flat(add(new THREE.CircleGeometry(4.8, 18), MAT.dirt, 16, -0.006, -1.2, g, { cast: false }));
  const well = new THREE.Group(); well.position.set(16, 0, -1.6); g.add(well);
  add(new THREE.CylinderGeometry(1.15, 1.25, 1.0, 14, 1, true), MAT.stoneDk, 0, 0.5, 0, well, { cast: false });   // outer wall (OPEN-ENDED too: its top cap at y=1.0 was the brick disc hiding the water)
  add(new THREE.CylinderGeometry(1.14, 1.14, 1.02, 14, 1, true), MAT.darkDS, 0, 0.51, 0, well, { cast: false }); // inner shaft (dark, OPEN-ENDED, DoubleSide, r 1.14 fills the opening: FrontSide walls let the ground show through as dirt/grass)
  flat(add(new THREE.CircleGeometry(1.15, 14), MAT.dark, 0, 0.68, 0, well, { cast: false })); // dark floor sealing the well interior (else the ground shows through the open walls as dirt/grass)
  flat(add(new THREE.CircleGeometry(0.86, 14), MAT.water, 0, 0.72, 0, well, { cast: false }));           // water surface (r 0.86 seals the open shaft)
  add(new THREE.TorusGeometry(1.18, 0.12, 8, 18), MAT.stone, 0, 1.0, 0, well, { cast: false }).rotation.x = Math.PI / 2; // rim
  for (const px of [-1.05, 1.05]) add(new THREE.CylinderGeometry(0.09, 0.11, 2.3, 7), MAT.woodDk, px, 1.15, 0, well, { cast: false }); // posts
  add(new THREE.CylinderGeometry(0.08, 0.08, 2.5, 7), MAT.woodDk, 0, 2.3, 0, well, { cast: false }).rotation.z = Math.PI / 2; // crossbeam
  // the bucket on its rope (driven by worldAt.bucketY / bucketWet): hangs
  // from the crossbeam, lowers until its bottom MEETS the water, lifts wet.
  bucketG = new THREE.Group(); bucketG.position.set(0.45, 1.85, 0); well.add(bucketG);
  add(new THREE.CylinderGeometry(0.22, 0.18, 0.3, 10, 1, true), MAT.woodDS, 0, 0, 0, bucketG, { cast: false });
  add(new THREE.TorusGeometry(0.21, 0.022, 6, 14), MAT.iron, 0, 0.15, 0, bucketG, { cast: false }).rotation.x = Math.PI / 2;
  flat(add(new THREE.CircleGeometry(0.185, 10), MAT.dark, 0, -0.145, 0, bucketG, { cast: false }));
  bucketWater = flat(add(new THREE.CircleGeometry(0.185, 10), MAT.water, 0, 0.09, 0, bucketG, { cast: false }));
  bucketWater.visible = false;
  ropeMesh = add(new THREE.CylinderGeometry(0.015, 0.015, 1, 5), MAT.dark, 0.45, 2.15, 0, well, { cast: false });
  // moon reflection in the water (driven by worldAt.moonK / shatterK /
  // splashK / rippleK): one whole disc that BREAKS into fragments.
  moonGroup = new THREE.Group(); moonGroup.position.set(16, 0.755, -1.6); g.add(moonGroup);
  moonDisc = flat(add(new THREE.CircleGeometry(0.5, 18), MAT.moonGlowMat, 0, 0, 0, moonGroup, { cast: false }));
  moonDisc.userData.ndSkip = true;
  const FRAG_HOME = [[0, 0, 0.20], [0.24, 0.10, 0.13], [-0.22, 0.14, 0.12], [0.10, -0.24, 0.13], [-0.14, -0.22, 0.11], [0.30, -0.16, 0.10], [-0.32, -0.06, 0.10], [0.02, 0.30, 0.11], [-0.05, -0.34, 0.09]];
  for (const [fx, fz, fr] of FRAG_HOME) {
    const fm = flat(add(new THREE.CircleGeometry(fr, 10), MAT.moonFragMat, fx, 0.004, fz, moonGroup, { cast: false }));
    fm.userData.ndSkip = true; fm.userData.home = [fx, fz];
    const ang = Math.atan2(fz, fx) + 0.35, rad = Math.min(0.72, Math.hypot(fx, fz) * 2.1 + 0.18);
    fm.userData.away = [Math.cos(ang) * rad, Math.sin(ang) * rad];
    moonFrags.push(fm);
  }
  for (let i = 0; i < 3; i++) {
    const rm = flat(add(new THREE.RingGeometry(0.44, 0.5, 26), MAT.rippleMat.clone(), 0, 0.006 + i * 0.002, 0, moonGroup, { cast: false }));
    rm.userData.ndSkip = true; ripples.push(rm);
  }
  // stone ledge south of the well: the flat surface the coin bag and the
  // signed paper REST on (bottoms flush on the slab top, real shadows).
  const slab = new THREE.Group(); slab.position.set(16.1, 0, -0.05); g.add(slab);
  add(tbox(1.8, 0.09, 0.74, 2), MAT.stone, 0, 0.70, 0, slab, { cast: false });
  for (const sx of [-0.72, 0.72]) add(tbox(0.18, 0.66, 0.62, 2), MAT.stoneDk, sx, 0.33, 0, slab, { cast: false });
  // the bag of gold ON the slab (worldAt.goldK toggles it at shot cuts only)
  goldBagG = new THREE.Group(); goldBagG.position.set(15.72, 0.745, -0.05); g.add(goldBagG);
  const gb = add(new THREE.SphereGeometry(0.30, 10, 8), MAT.sack, 0, 0.20, 0, goldBagG, { cast: false }); gb.scale.y = 0.75;
  add(new THREE.CylinderGeometry(0.07, 0.11, 0.12, 8), MAT.woodDk, 0, 0.42, 0, goldBagG, { cast: false });
  for (let i = 0; i < 5; i++) add(new THREE.CylinderGeometry(0.065, 0.065, 0.035, 8), MAT.gold, 0.30 + (i % 3) * 0.14, 0.018, -0.14 + Math.floor(i / 3) * 0.15, goldBagG, { cast: false });
  // the signed paper ON the slab (worldAt.paperK): cream sheet, ink lines, red seal
  paperG = new THREE.Group(); paperG.position.set(16.52, 0.745, -0.02); paperG.rotation.y = -0.28; g.add(paperG);
  add(tbox(0.54, 0.016, 0.38, 1), toon({ color: '#f3e9c8' }), 0, 0.008, 0, paperG, { cast: false });
  const pc = document.createElement('canvas'); pc.width = 256; pc.height = 180;
  const pg2 = pc.getContext('2d'); pg2.fillStyle = '#f3e9c8'; pg2.fillRect(0, 0, 256, 180);
  pg2.strokeStyle = '#4a3a28'; pg2.lineWidth = 5;
  for (let r = 0; r < 4; r++) { pg2.beginPath(); pg2.moveTo(28, 36 + r * 26); pg2.lineTo(228 - (r % 2) * 40, 36 + r * 26); pg2.stroke(); }
  pg2.fillStyle = '#b3392e'; pg2.beginPath(); pg2.arc(200, 138, 24, 0, Math.PI * 2); pg2.fill();
  pg2.strokeStyle = '#7a1f16'; pg2.lineWidth = 4; pg2.beginPath(); pg2.moveTo(30, 150); pg2.bezierCurveTo(70, 120, 100, 165, 140, 138); pg2.stroke();
  const ptex = new THREE.CanvasTexture(pc); ptex.colorSpace = THREE.SRGBColorSpace;
  const ptop = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.38), new THREE.MeshBasicMaterial({ map: ptex, fog: true }));
  ptop.rotation.x = -Math.PI / 2; ptop.position.y = 0.017; ptop.userData.ndSkip = true; paperG.add(ptop);
}
// ---------- crows: 3D mesh birds (body, head, beak, tail, flapping wings) ----------
function makeCrow() {
  const grp = new THREE.Group();
  const body = add(new THREE.SphereGeometry(0.3, 10, 8), MAT.crow, 0, 0, 0, grp); body.scale.set(0.85, 0.8, 1.5);
  const head = add(new THREE.SphereGeometry(0.17, 10, 8), MAT.crow, 0, 0.2, 0.38, grp);
  const beak = add(new THREE.ConeGeometry(0.06, 0.26, 6), MAT.beak, 0, 0.18, 0.6, grp); beak.rotation.x = Math.PI / 2;
  const tail = add(box(0.2, 0.04, 0.5), MAT.crow, 0, 0.08, -0.55, grp); tail.rotation.x = -0.35;
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  add(new THREE.SphereGeometry(0.028, 6, 5), eyeMat, 0.1, 0.26, 0.48, grp, { cast: false });
  add(new THREE.SphereGeometry(0.028, 6, 5), eyeMat, -0.1, 0.26, 0.48, grp, { cast: false });
  const wingL = new THREE.Group(); wingL.position.set(-0.2, 0.08, 0); grp.add(wingL);
  add(box(0.75, 0.04, 0.34), MAT.crowWing, -0.38, 0, 0, wingL);
  const wingR = new THREE.Group(); wingR.position.set(0.2, 0.08, 0); grp.add(wingR);
  add(box(0.75, 0.04, 0.34), MAT.crowWing, 0.38, 0, 0, wingR);
  grp.userData.wingL = wingL; grp.userData.wingR = wingR;
  scene.add(grp);
  return grp;
}
for (let i = 0; i < 7; i++) crowsFly.push(makeCrow());
// crows on the ground under the grove trees — wings folded, idle bob only.
// NOTE: perched IN the trees does not work here — the 4 canopies overlap so
// tightly that any branch-end spot sits inside a neighbouring canopy sphere,
// and a crow inside a canopy renders as a GREEN bird (only its ink outline
// shows against the leaves). Ground crows stay black and clearly readable.
const PERCH = [
  [-14.5, 0.3, -5.2, 0.5], [-17.8, 0.3, -3.8, -0.4], [-12.3, 0.3, -6.8, 0.9], [-18.2, 0.3, -7.8, 2.6], [-15.0, 0.3, -8.2, 1.8],
];
for (const [px, py, pz, yaw] of PERCH) {
  const grp = makeCrow();
  grp.position.set(px, py, pz); grp.rotation.y = yaw;
  grp.userData.wingL.rotation.z = 0.12; grp.userData.wingR.rotation.z = -0.12;
  crowsPerch.push({ grp, y: py });
}
// moon-hindi: no crows in this story — hide the kit birds for good.
crowsFly.forEach((c) => { c.visible = false; });
crowsPerch.forEach((c) => { c.grp.visible = false; });
// ---- boards (transforms mirrored in boards.json — keep in sync) ----
// All five boards share one anchor above the well so every board-shot
// camera frames whichever board is up.
const boardTitle = textBoard(['राजा को चाँद', 'बेच दिया!'], 3.2, 1.15, '#1d2f4a', '#dfe8ff'); boardTitle.position.set(16, 3.55, -3.3); world.add(boardTitle);
const boardPrice = textBoard(['५० सोने के', 'सिक्के'], 2.6, 1.15, '#4a2c14', '#ffd76a'); boardPrice.position.set(16, 3.55, -3.3); world.add(boardPrice);
const boardShatter = textBoard(['चाँद सौ टुकड़ों में', 'बिखर गया!'], 3.2, 1.15, '#1d2f4a', '#dfe8ff'); boardShatter.position.set(16, 3.55, -3.3); world.add(boardShatter);
const boardVerdict = textBoard(['टूटी चीज़ के पैसे', 'वापस नहीं मिलते।'], 3.2, 1.15, '#4a2c14', '#ffd76a'); boardVerdict.position.set(16, 3.55, -3.3); world.add(boardVerdict);
const boardHook = textBoard(['जो कपड़ा है ही नहीं,', 'वह बिकता कैसे है?'], 3.4, 1.15, '#2e1a4a', '#ffe9a8'); boardHook.position.set(16, 3.55, -3.3); world.add(boardHook);

// ---------- FX: dusk haze, gate dust, clouds ----------
const smoke = new FX.Smoke(scene, 130); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const hazeEmit = smoke.addEmitter(0, 2.6, -2, { rate: 0.3, color: 0xffe2b0, opacity: 0.045, scale: 2.4, grow: 1.3, life: 2.8, vy: 0.1, wind: -0.4 });
const dustEmit = smoke.addEmitter(-16, 1.6, -5, { rate: 0.1, color: 0xe8d9b0, opacity: 0.16, scale: 0.5, grow: 1.6, life: 1.1, vy: 0.5, wind: 0.3 });
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
  setB(boardTitle, Ws.boardTitle || 0); setB(boardPrice, Ws.boardPrice || 0); setB(boardShatter, Ws.boardShatter || 0);
  setB(boardVerdict, Ws.boardVerdict || 0); setB(boardHook, Ws.boardHook || 0);
  goldBagG.visible = (Ws.goldK || 0) > 0.01;
  paperG.visible = (Ws.paperK || 0) > 0.01;
  // bucket: hangs from the crossbeam (y 2.3); the rope stretches as it lowers
  const by = Ws.bucketY ?? 1.85;
  bucketG.position.y = by;
  const ropeLen = Math.max(0.05, 2.3 - (by + 0.15));
  ropeMesh.scale.y = ropeLen; ropeMesh.position.y = 2.3 - ropeLen / 2;
  bucketWater.visible = (Ws.bucketWet || 0) > 0.5;
  // moon reflection: the whole disc fades as the fragments take over (shatter)
  const mk = Ws.moonK || 0, sk = Ws.shatterK || 0;
  MAT.moonGlowMat.opacity = mk * (1 - sk * 0.92);
  MAT.moonFragMat.opacity = mk * sk * 0.95;
  moonFrags.forEach((fm, i) => {
    const h = fm.userData.home, a = fm.userData.away;
    const bob = sk * Math.sin(f * 0.11 + i * 1.7) * 0.012;
    fm.position.x = h[0] + (a[0] - h[0]) * sk;
    fm.position.z = h[1] + (a[1] - h[1]) * sk + bob;
    fm.visible = sk > 0.01;
  });
  // splash ripples on the water surface
  const rk = Ws.rippleK || 0, sa = Ws.splashK || 0;
  ripples.forEach((rm, i) => {
    const loc = Math.max(0, Math.min(1, rk * 1.5 - i * 0.22));
    const sc = 0.2 + loc * 0.62;
    rm.scale.set(sc, sc, sc);
    rm.material.opacity = sa * (1 - loc) * 0.8;
    rm.visible = sa > 0.01 && loc < 1;
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
