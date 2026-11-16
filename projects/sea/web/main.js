import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, flyCrowsAt, THRONE, CUPREST, POUCHREST, cupAt, pouchAt } from './story.js';

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
const textBoard = (lines, w, h, bg, fg, font = 900, fit = null) => {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w);
  const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = fg; g.lineWidth = 14; g.strokeRect(20, 20, c.width - 40, c.height - 40);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  let fs = Math.min(170, (c.width - 130) / Math.max(...lines.map((l) => l.length)) * 1.72);
  g.font = `${font} ${fs}px Arial`;
  const maxW = Math.max(...lines.map((l) => g.measureText(l).width));   // wide letters (W/O) overflow the char-count fit — measure and clamp
  if (maxW > c.width - 120) { fs *= (c.width - 120) / maxW; g.font = `${font} ${fs}px Arial`; }
  if (fit && fit.fsMul) { fs *= fit.fsMul; g.font = `${font} ${fs}px Arial`; }   // optional per-board shrink (fit fix)
  lines.forEach((l, i) => {
    const y = (fit && fit.pitch)
      ? c.height * (0.5 + (i - (lines.length - 1) / 2) * fit.pitch) + (fit.dy || 0) * c.height
      : c.height * (lines.length === 1 ? 0.52 : (i + 0.5) / lines.length);
    g.fillText(l, c.width / 2, y);
  });
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
  sand: texM(P.dirt(35), 8, 8, '#d9c08a'),
  river: toon({ color: '#2a6a8e' }), riverLight: toon({ color: '#7cc0dd' }),
  cup: toon({ color: '#e8e2d2' }), seaInCup: toon({ color: '#2e7ea6' }),
  sack: toon({ color: '#c9a24d' }), sackDk: toon({ color: '#a37f36' }),
  steel: toon({ color: '#565d66' }), steelDk: toon({ color: '#33373d' }),
  crimson: toon({ color: '#7a1f2e' }), crimsonDk: toon({ color: '#5d1622' }),
  royal: toon({ color: '#3a2a5e' }),
  crow: toon({ color: '#17161c' }), crowBeak: toon({ color: '#3a3a40' }),
  rice: toon({ color: '#ece0c4' }), riceDk: toon({ color: '#d9c69c' }),
  darkIn: new THREE.MeshBasicMaterial({ color: 0x17110b, fog: true }),
  white: toon({ color: '#f7f3e6' }), wax: toon({ color: '#e8ddc4' }),
  cushion: toon({ color: '#8c2432' }),
  dark: toon({ color: '#33302c' }),
  moonDisc: new THREE.MeshBasicMaterial({ color: 0xf4f0ff, transparent: true, opacity: 0, fog: true }),
  glowWarm: new THREE.MeshBasicMaterial({ color: 0xffc37a, transparent: true, opacity: 0, fog: true }),
  goldGlow: new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0, fog: true }),
};
const world = new THREE.Group(); scene.add(world);
{
  const g = world;
  flat(add(new THREE.PlaneGeometry(300, 240), MAT.grass, 8, -0.03, 0, g, { cast: false }));
  flat(add(new THREE.PlaneGeometry(64, 7), MAT.dirt, 10, -0.012, 3.4, g, { cast: false }));       // the road
  flat(add(new THREE.CircleGeometry(8.5, 22), MAT.dirt, 0, -0.008, 0.5, g, { cast: false }));      // palace courtyard
  flat(add(new THREE.CircleGeometry(7, 20), MAT.dirt, 26, -0.006, 7, g, { cast: false }));       // dirt clearing, south-east of the beach
  flat(add(new THREE.CircleGeometry(9, 20), MAT.dirt, -16, -0.006, -5, g, { cast: false }));      // grove clearing
  // distant huts + trees (depth for the eastward flight)
  for (const [hx, hz, ry] of [[-7, 9, 0.2], [8, 10, -0.3], [20, 8, 0.4], [26, 9, -0.2]]) {
    const h = new THREE.Group(); h.position.set(hx, 0, hz); h.rotation.y = ry; g.add(h);
    add(tbox(2.6, 1.7, 2.2, 2), MAT.stone, 0, 0.85, 0, h, { cast: false });
    add(new THREE.ConeGeometry(2.2, 1.2, 4), MAT.thatch, 0, 2.3, 0, h, { cast: false }).rotation.y = Math.PI / 4;
  }
  for (const [tx, tz, s] of [[-11, 8, 1], [12.5, 9, 1.2], [23, 7, 0.9], [-24, 8, 1.1], [30, 9, 1]]) {
    add(new THREE.CylinderGeometry(0.3 * s, 0.44 * s, 2.8 * s, 8), MAT.woodDk, tx, 1.4 * s, tz, g, { cast: false });
    const can = add(new THREE.SphereGeometry(2.1 * s, 10, 8), MAT.leaf, tx, 3.6 * s, tz, g, { cast: false });
    can.scale.y = 0.72; can.userData.ndSkip = true;
  }
}
// ================= THE PALACE COURT (facade z=-3.2, throne z=-2.2) =================
{
  const g = world;
  add(tbox(6.9, 4.9, 0.5, 2), MAT.stoneDk, -4.6, 2.45, -3.45, g, { cast: false });
  add(tbox(6.9, 4.9, 0.5, 2), MAT.stoneDk, 4.6, 2.45, -3.45, g, { cast: false });
  add(tbox(16.1, 0.4, 0.7, 2), MAT.stone, 0, 5.05, -3.45, g, { cast: false });
  add(tbox(2.4, 2.35, 0.5, 2), MAT.stoneDk, 0, 3.72, -3.45, g, { cast: false });   // lintel over the doorway (no sky-hole)
  for (const sx of [-5.9, 5.9]) {   // palace towers
    add(new THREE.CylinderGeometry(1.05, 1.2, 6.0, 10), MAT.stone, sx, 3.0, -3.45, g, { cast: false });
    add(new THREE.ConeGeometry(1.5, 1.3, 10), MAT.crimson, sx, 6.6, -3.45, g, { cast: false });
    add(new THREE.SphereGeometry(0.18, 8, 6), MAT.goldBright, sx, 7.45, -3.45, g, { cast: false });
  }
  // the great doorway: dark recess + closed double doors with gold trim
  add(tbox(2.3, 2.6, 0.1, 2), MAT.dark, 0, 1.3, -3.85, g, { cast: false });
  add(tbox(1.1, 2.5, 0.08, 2), MAT.woodDk, -0.56, 1.25, -3.78, g, { cast: false });
  add(tbox(1.1, 2.5, 0.08, 2), MAT.woodDk, 0.56, 1.25, -3.78, g, { cast: false });
  add(tbox(0.08, 2.5, 0.04, 2), MAT.gold, 0, 1.25, -3.72, g, { cast: false });
  for (const dy of [0.6, 1.25, 1.9]) for (const dx of [-0.56, 0.56]) add(new THREE.SphereGeometry(0.05, 8, 6), MAT.goldBright, dx, dy, -3.7, g, { cast: false });
  // red carpet from the doorway to the courtyard
  flat(add(new THREE.PlaneGeometry(2.2, 5.4), MAT.crimson, 0, -0.004, -0.6, g, { cast: false }));
  add(tbox(2.2, 0.06, 0.3, 2), MAT.gold, 0, 0.03, 2.05, g, { cast: false });
  // ---- THE THRONE (dais behind the king's card; seat + tall back + arms) ----
  add(tbox(3.4, 0.14, 1.1, 2), MAT.stoneDk, 0, 0.07, -2.75, g, { cast: false });
  add(tbox(2.8, 0.14, 0.9, 2), MAT.stone, 0, 0.21, -2.7, g, { cast: false });
  add(tbox(1.0, 0.3, 0.7, 2), MAT.royal, 0, 0.45, -2.6, g, { cast: false });          // seat
  add(tbox(1.0, 1.7, 0.18, 2), MAT.royal, 0, 1.35, -2.92, g, { cast: false });         // tall back
  add(tbox(1.06, 0.14, 0.2, 2), MAT.gold, 0, 2.22, -2.92, g, { cast: false });         // gold crest rail
  add(new THREE.SphereGeometry(0.12, 8, 6), MAT.goldBright, 0, 2.36, -2.92, g, { cast: false });
  for (const ax of [-0.58, 0.58]) {
    add(tbox(0.14, 0.5, 0.6, 2), MAT.royal, ax, 0.85, -2.6, g, { cast: false });       // armrests
    add(new THREE.SphereGeometry(0.09, 8, 6), MAT.goldBright, ax, 1.14, -2.6, g, { cast: false });
  }
  add(tbox(0.9, 0.1, 0.55, 2), MAT.cushion, 0, 0.64, -2.6, g, { cast: false });        // red cushion
  // guards' spears planted at their posts
  for (const sx of [-2.62, 2.62]) {
    add(new THREE.CylinderGeometry(0.03, 0.035, 2.7, 7), MAT.woodDk, sx, 1.35, -1.9, g, { cast: false });
    add(new THREE.ConeGeometry(0.07, 0.34, 8), MAT.steel, sx, 2.85, -1.9, g, { cast: false });
  }
  // banners flanking the throne
  for (const bx of [-1.6, 1.6]) {
    add(new THREE.CylinderGeometry(0.035, 0.035, 2.6, 7), MAT.gold, bx, 1.3, -3.1, g, { cast: false });
    const ban = add(tbox(0.55, 1.3, 0.04, 2), MAT.crimson, bx, 1.85, -3.08, g, { cast: false });
    add(new THREE.ConeGeometry(0.28, 0.3, 4), MAT.goldBright, bx, 2.68, -3.1, g, { cast: false }).rotation.y = Math.PI / 4;
  }
}
// cylinder strut between two points (pour stream, cart rails)
const strut = (a, b, r, mat, parent = world) => {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.3, len, 6), mat);
  m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(d[0] / len, d[1] / len, d[2] / len));
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
};
// soft contact-blob (guaranteed grounding shadow under props)
const blobShadow = (x, y, z, sx, sz, op = 0.55) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: P.tex(P.radial('16,12,20', 0.65)), transparent: true, opacity: op, depthWrite: false, fog: true }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.scale.set(sx, sz, 1); m.renderOrder = 1; m.userData.ndSkip = true; world.add(m); return m;
};
const mkSack = (s = 1) => {
  const g = new THREE.Group();
  const body = add(new THREE.SphereGeometry(0.34, 10, 8), MAT.sack, 0, 0.26, 0, g, { cast: true }); body.scale.y = 0.82;
  add(new THREE.CylinderGeometry(0.1, 0.17, 0.2, 8), MAT.sackDk, 0, 0.56, 0, g, { cast: true });
  g.scale.setScalar(s); return g;
};
// ================= THE SHORE (x=+16) — sand, sea, seven rivers =================
// PHYSICS: sand sits ON the ground; the sea is a live water shader north of
// the beach (z<-6); seven river strips run north (z +3.5 -> -6) into the sea,
// each resting ON the sand (y=0.035) with a pale centre streak.
let seaWater;
{
  const g = world, gx = 16;
  flat(add(new THREE.CircleGeometry(9.5, 24), MAT.sand, gx, -0.008, -1, g, { cast: false }));   // the beach
  flat(add(new THREE.PlaneGeometry(13, 5), MAT.sand, gx, -0.006, 3.5, g, { cast: false }));     // sand apron to the south
  seaWater = FX.makeWater({ size: 70, seg: 50, deep: 0x14425e, shallow: 0x2e7ea6 });
  seaWater.position.set(gx, 0.02, -41); g.add(seaWater);
  // the SEVEN rivers: tapered strips (narrow at the source, wide where they
  // meet the sea) flowing north into the sea. They end at z=-3.0 — SOUTH of
  // them is dry sand where the actors stand; the crowd never stands in water.
  const riverGeo = (() => {
    const s = new THREE.Shape();
    s.moveTo(-0.08, 0); s.lineTo(0.08, 0); s.lineTo(0.3, 3.2); s.lineTo(-0.3, 3.2); s.closePath();
    const g = new THREE.ShapeGeometry(s); g.rotateX(-Math.PI / 2);   // shape y -> -z: narrow end south, wide end at the sea
    return g;
  })();
  for (let i = 0; i < 7; i++) {
    const rx = 13 + i * 1.0;
    add(riverGeo, MAT.river, rx, 0.035, -3.0, g, { cast: false });
    blobShadow(rx, 0.032, -2.9, 0.7, 0.45, 0.35);   // damp sand where each river starts
  }
  // driftwood log lying ON the sand (group yaw, cylinder roll — both ends touch)
  const logG = new THREE.Group(); logG.position.set(gx + 3.4, 0, 2.6); logG.rotation.y = 0.35; g.add(logG);
  add(new THREE.CylinderGeometry(0.16, 0.2, 2.6, 8), MAT.woodDk, 0, 0.16, 0, logG, { cast: true }).rotation.z = Math.PI / 2;
  blobShadow(gx + 3.4, 0.012, 2.6, 2.9, 0.7, 0.5);
  // hook-board posts at the shore (holds boardSeven + boardHook). Posts sit
  // in the SAND GAPS between rivers (13.5 and 18.5), never in the water.
  for (const px of [-2.5, 2.5]) add(new THREE.CylinderGeometry(0.06, 0.07, 4.6, 7), MAT.woodDk, gx + px, 2.3, -4.25, g, { cast: false });
  add(tbox(5.4, 0.12, 0.12, 2), MAT.woodDk, gx, 4.5, -4.25, g, { cast: false });
}
// ================= THE CUP + THE GOLD POUCH (shore props) =================
// PHYSICS: the cup is a small 3D prop driven by cupAt() — it rests ON the
// sand (base y=0), rises with the hand, tips at the mouth, lands back on its
// exact spot and stays. The pouch is driven by pouchAt() — king's hand ->
// sailor's hands (weight dip) -> set down ON the sand and stays. Both get a
// contact blob at their resting spot.
let cupMesh, pouchMesh;
{
  const g = world;
  // --- the cup (body + seawater disc + handle), pivot at its BASE so it
  // never sinks into or floats above the sand.
  cupMesh = new THREE.Group(); world.add(cupMesh);
  add(new THREE.CylinderGeometry(0.085, 0.065, 0.17, 12), MAT.cup, 0, 0.085, 0, cupMesh, { cast: true });
  add(new THREE.CylinderGeometry(0.072, 0.072, 0.012, 12), MAT.seaInCup, 0, 0.155, 0, cupMesh, { cast: false });
  const handle = add(new THREE.TorusGeometry(0.055, 0.014, 6, 12, Math.PI), MAT.cup, 0.085, 0.09, 0, cupMesh, { cast: false });
  handle.rotation.z = -Math.PI / 2;
  blobShadow(CUPREST[0], 0.012, CUPREST[2], 0.42, 0.36, 0.55);
  // --- the gold pouch (sack + coins peeking from the mouth). Sack pivot: the
  // sphere's bottom sits exactly at local y=0 so the pouch rests FLUSH on
  // the sand, never sunk into it.
  pouchMesh = new THREE.Group(); pouchMesh.position.set(0, -10, 0); world.add(pouchMesh);
  const sack = add(new THREE.SphereGeometry(0.34, 10, 8), MAT.sack, 0, 0.27, 0, pouchMesh, { cast: false }); sack.scale.y = 0.78;
  add(new THREE.CylinderGeometry(0.1, 0.16, 0.18, 8), MAT.sackDk, 0, 0.55, 0, pouchMesh, { cast: false });
  const cinch = add(new THREE.TorusGeometry(0.13, 0.03, 6, 12), MAT.sackDk, 0, 0.5, 0, pouchMesh, { cast: false });
  cinch.rotation.x = Math.PI / 2;
  for (let i = 0; i < 3; i++) {   // coins peeking ABOVE the bag's mouth
    const a = i / 3 * Math.PI * 2 + 0.5;
    const coin = add(new THREE.CylinderGeometry(0.075, 0.075, 0.035, 10), MAT.goldBright, Math.cos(a) * 0.05, 0.65, Math.sin(a) * 0.05, pouchMesh, { cast: false });
    coin.rotation.z = 0.25; coin.rotation.x = -0.2;
  }
  pouchMesh.scale.setScalar(0.001);
  blobShadow(POUCHREST[0], 0.012, POUCHREST[2], 0.9, 0.75, 0.5);
}
// ================= SHORE TREES (south of the beach, on dry land) =================
{
  const g = world;
  for (const [tx, tz, s] of [[22, 7, 1.3], [26, 5, 1.1], [10, 8, 1.2], [-2, 7, 1.0]]) {
    add(new THREE.CylinderGeometry(0.3 * s, 0.44 * s, 2.8 * s, 8), MAT.woodDk, tx, 1.4 * s, tz, g, { cast: false });
    const can = add(new THREE.SphereGeometry(2.1 * s, 10, 8), MAT.leaf, tx, 3.6 * s, tz, g, { cast: false });
    can.scale.y = 0.72; can.userData.ndSkip = true;
  }
}
// (the gold pouch lives in the cup/pouch block above, driven by pouchAt)
// ---- boards (transforms mirrored in boards.json — keep in sync) ----
const boardTitle = textBoard(['DRINK THE', 'WHOLE SEA'], 3.2, 1.1, '#1a3a5e', '#ffd76a'); boardTitle.position.set(0, 4.3, -3.12); world.add(boardTitle);
const boardSeven = textBoard(['SEVEN RIVERS', 'FLOW TO THE SEA'], 3.4, 1.05, '#1f2a44', '#ffd76a'); boardSeven.position.set(16, 3.85, -4.25); world.add(boardSeven);
// hook board fit fix (as grain): shrink text 12% and tighten line pitch so
// both lines get clear padding inside the border stroke.
const boardHook = textBoard(['HE SOLD THE KING', 'THE RAIN ITSELF?'], 3.4, 1.05, '#1a2340', '#ffe9a8', 900, { fsMul: 0.88, pitch: 0.42 }); boardHook.position.set(16, 3.85, -4.25); world.add(boardHook);
// ---------- crows (3D birds: black body, head, beak, tail, flapping wings) ----------
const crowMat = MAT.crow, beakMat = MAT.crowBeak;
const mkCrow = (withWings) => {
  const grp = new THREE.Group();
  const body = add(new THREE.SphereGeometry(0.16, 10, 8), crowMat, 0, 0, 0, grp, { cast: false }); body.scale.set(1, 0.85, 1.5);
  add(new THREE.SphereGeometry(0.09, 8, 6), crowMat, 0, 0.1, 0.2, grp, { cast: false });
  const beak = add(new THREE.ConeGeometry(0.035, 0.13, 6), beakMat, 0, 0.09, 0.32, grp, { cast: false }); beak.rotation.x = Math.PI / 2;
  const tail = add(box(0.09, 0.02, 0.24), crowMat, 0, 0.03, -0.26, grp, { cast: false }); tail.rotation.x = -0.18;
  let wingL = null, wingR = null;
  if (withWings) {
    wingL = new THREE.Group(); wingL.position.set(-0.1, 0.05, 0); grp.add(wingL);
    const wl = add(box(0.34, 0.015, 0.16), crowMat, -0.17, 0, 0, wingL, { cast: false });
    wingR = new THREE.Group(); wingR.position.set(0.1, 0.05, 0); grp.add(wingR);
    const wr = add(box(0.34, 0.015, 0.16), crowMat, 0.17, 0, 0, wingR, { cast: false });
  }
  return { grp, wingL, wingR };
};
const flyingCrows = Array.from({ length: 7 }, () => {
  const c = mkCrow(true); c.grp.scale.setScalar(1.35); world.add(c.grp); return c;
});

// ---------- FX: haze ----------
const smoke = new FX.Smoke(scene, 130); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const hazeEmit = smoke.addEmitter(0, 2.4, 0, { rate: 0.35, color: 0xffffff, opacity: 0.04, scale: 2.2, grow: 1.3, life: 2.6, vy: 0.1, wind: -0.5 });
const dustEmit = smoke.addEmitter(16, 1.6, -2, { rate: 0, color: 0xffe2b8, opacity: 0.1, scale: 0.5, grow: 1.2, life: 2.2, vy: 0.16, wind: 0.15 });
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
  if (seaWater) seaWater.userData.update(f / 30);   // live sea waves
  const setB = (mesh, v) => { mesh.material.opacity = v; mesh.visible = v > 0.01; };
  setB(boardTitle, Ws.boardTitle || 0); setB(boardSeven, Ws.boardSeven || 0); setB(boardHook, Ws.boardHook || 0);
  // THE CUP: driven by cupAt() — rests ON the sand, rises with the hand,
  // tips at the mouth, lands back on its exact spot and stays.
  const cup = cupAt(f);
  cupMesh.position.set(cup.p[0], cup.p[1], cup.p[2]);
  cupMesh.rotation.x = -cup.tilt;   // tip toward the sailor's mouth (north)
  cupMesh.scale.setScalar(cup.s);
  // THE GOLD POUCH: driven by pouchAt() — king's hand -> sailor's hands
  // (weight dip) -> set down ON the sand and stays.
  const pouch = pouchAt(f);
  pouchMesh.visible = !!pouch;
  if (pouch) { pouchMesh.position.set(pouch.p[0], pouch.p[1], pouch.p[2]); pouchMesh.scale.setScalar(pouch.s); }
  // flying crows from the story's flight plan
  const flies = flyCrowsAt(f);
  flies.forEach((c, i) => {
    const m = flyingCrows[i];
    m.grp.position.set(c.p[0], c.p[1], c.p[2]);
    m.grp.rotation.y = c.yaw;
    const flap = 0.2 + 0.6 * (0.5 + 0.5 * Math.sin(c.flap));
    if (m.wingL) m.wingL.rotation.z = flap;
    if (m.wingR) m.wingR.rotation.z = -flap;
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
