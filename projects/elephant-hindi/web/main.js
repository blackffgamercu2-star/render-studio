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

// ---------- the set: palace court (x=0), crow grove (x=-16), river + boat (x=+16) ----------
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
  water: new THREE.MeshBasicMaterial({ color: 0x2e5f7e, fog: true }), // river water (opaque)
  ele: toon({ color: '#8d9299' }), eleDk: toon({ color: '#74797f' }),
  white: toon({ color: '#f7f3e6' }),
  sand: toon({ color: '#dcbd7f' }),
  goldGlow: new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0, fog: true }),
  moonGlowMat: new THREE.MeshBasicMaterial({ color: 0xdfe8ff, transparent: true, opacity: 0, fog: true }),
  moonFragMat: new THREE.MeshBasicMaterial({ color: 0xdfe8ff, transparent: true, opacity: 0, fog: true }),
  rippleMat: new THREE.MeshBasicMaterial({ color: 0xcfe0ff, transparent: true, opacity: 0, fog: true, side: THREE.DoubleSide }),
  woodDS: toon({ color: '#6e5136', side: THREE.DoubleSide }),
};
const world = new THREE.Group(); scene.add(world);
let boatG, chalkG, eleBoat, eleBank, scaleG;
const boatStones = [], ripples = [];
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
  // ================= RIVER + BOAT (x = +16) =================
  // The river: a wide blue channel; the south bank is sand/dirt where the
  // boy, the king and the soldiers stand. Water surface y = -0.02.
  flat(add(new THREE.PlaneGeometry(15, 9.5), MAT.water, 16, -0.02, -2.9, g, { cast: false }));
  flat(add(new THREE.PlaneGeometry(9, 3.4), MAT.dirt, 16, -0.006, 1.3, g, { cast: false }));    // sandy south bank (rect: its north edge z=-0.4 stops short of the boat, so the boat floats on WATER, not dirt)
  flat(add(new THREE.PlaneGeometry(20, 3.0), MAT.dirt, 10, -0.014, 1.0, g, { cast: false }));    // road east to the river
  // THE BOAT — big wooden rowboat, hull along X so the camera (from +Z)
  // sees its long side. Deck local y = 0, hull bottom -0.55. boatY is
  // driven by worldAt: 0.55 empty (hull bottom just kisses the water),
  // 0.18 loaded (deep draft; the waterline then sits at local y -0.20,
  // exactly where the chalk mark is painted).
  boatG = new THREE.Group(); boatG.position.set(16, 0.55, -1.6); g.add(boatG);
  add(tbox(4.6, 0.55, 1.7, 2), MAT.wood, 0, -0.275, 0, boatG, { cast: false });                 // hull
  add(tbox(4.4, 0.06, 1.5, 2), MAT.woodDk, 0, 0.03, 0, boatG, { cast: false });                  // deck
  for (const bx of [-1.9, 1.9]) { const bw = add(tbox(0.5, 0.5, 1.5, 2), MAT.wood, bx, -0.05, 0, boatG, { cast: false }); bw.rotation.z = bx < 0 ? 0.5 : -0.5; } // bow/stern rise
  for (const bx of [-1.1, 1.1]) add(tbox(0.18, 0.08, 1.4, 2), MAT.woodDk, bx, 0.12, 0, boatG, { cast: false }); // benches (rest ON the deck)
  // the chalk mark: a white line painted on the hull's south face at
  // local y -0.20 — exactly the waterline when the elephant is aboard.
  chalkG = new THREE.Group(); boatG.add(chalkG);
  add(tbox(0.62, 0.07, 0.03, 1), MAT.white, 0.35, -0.20, 0.86, chalkG, { cast: false });
  add(tbox(0.07, 0.24, 0.03, 1), MAT.white, 0.04, -0.20, 0.86, chalkG, { cast: false });
  chalkG.visible = false;
  // ripples on the WATER around the hull (driven by worldAt.rippleK while
  // the boat sinks) — parented to the world at the water surface, NOT to
  // the boat: riding with the boat made them stripe across the hull.
  for (let i = 0; i < 3; i++) {
    const rm = flat(add(new THREE.RingGeometry(0.44, 0.5, 26), MAT.rippleMat.clone(), 16, 0.0, -1.6, g, { cast: false }));
    rm.userData.ndSkip = true; rm.scale.set(1.4 + i * 0.4, 1.4 + i * 0.4, 1.4 + i * 0.4); ripples.push(rm);
  }
  // ---- the elephant (mesh, adapted from rope's proven hook set) ----
  // Feet at local y = 0: legs are 1.15 tall, centred at 0.575.
  const makeElephant = () => {
    const el = new THREE.Group();
    const bodyE = add(new THREE.SphereGeometry(1.05, 16, 12), MAT.ele, 0, 1.62, 0, el); bodyE.scale.set(1.45, 1.0, 0.92);
    add(new THREE.SphereGeometry(0.60, 14, 10), MAT.ele, 1.52, 1.86, 0, el);
    const ear = add(new THREE.SphereGeometry(0.52, 12, 10), MAT.eleDk, 1.30, 1.95, 0.40, el, { cast: false }); ear.scale.set(0.95, 1.05, 0.22);
    const t1 = add(new THREE.CylinderGeometry(0.13, 0.16, 0.62, 8), MAT.ele, 1.97, 1.62, 0, el); t1.rotation.z = 0.5;
    const t2 = add(new THREE.CylinderGeometry(0.10, 0.13, 0.60, 8), MAT.ele, 2.16, 1.14, 0, el); t2.rotation.z = 0.15;
    const t3 = add(new THREE.CylinderGeometry(0.07, 0.10, 0.50, 8), MAT.ele, 2.24, 0.68, 0, el); t3.rotation.z = -0.25;
    for (const sd of [-1, 1]) { const tk = add(new THREE.ConeGeometry(0.045, 0.42, 6), MAT.white, 2.0, 1.40, sd * 0.22, el, { cast: false }); tk.rotation.z = 2.2; }
    for (const [lx, lz] of [[0.85, 0.5], [0.85, -0.5], [-0.85, 0.5], [-0.85, -0.5]]) add(new THREE.CylinderGeometry(0.17, 0.19, 1.15, 8), MAT.ele, lx, 0.575, lz, el);
    const tl = add(new THREE.CylinderGeometry(0.035, 0.025, 0.8, 6), MAT.eleDk, -1.55, 1.5, 0, el, { cast: false }); tl.rotation.z = 0.35;
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.2), new THREE.MeshBasicMaterial({ map: P.tex(P.radial('20,14,30', 0.6)), transparent: true, depthWrite: false, fog: true }));
    blob.rotation.x = -Math.PI / 2; blob.position.set(0, 0.02, 0); blob.userData.ndSkip = true; el.add(blob);
    return el;
  };
  // elephant ABOARD the boat (child of boatG: it sinks WITH the boat,
  // feet always ON the deck). Elephant ASHORE is a second instance.
  eleBoat = makeElephant(); eleBoat.position.set(0, 0.06, 0); eleBoat.rotation.y = 0; boatG.add(eleBoat);
  eleBank = makeElephant(); eleBank.position.set(13.8, 0, -0.8); eleBank.rotation.y = 0; g.add(eleBank);
  eleBoat.visible = false; eleBank.visible = true;
  // ---- stones: 8 in the boat (dropped in one by one, story.js drives
  // each stone's drop: it falls with gravity from just above the deck and
  // LANDS on the deck / the layer below and stays) ----
  const BOAT_STONES = [[-1.6, -0.42, 0.20], [-0.8, -0.42, 0.18], [0, -0.42, 0.21], [0.8, -0.42, 0.17], [1.6, -0.42, 0.19], [-1.2, 0.42, 0.18], [0, 0.42, 0.20], [1.2, 0.42, 0.17]];
  for (const [sx, sz, sr] of BOAT_STONES) {
    const st = add(new THREE.SphereGeometry(sr, 10, 8), MAT.stoneDk, sx, 0.06 + sr, sz, boatG, { cast: false });
    st.userData.homeY = 0.06 + sr; st.visible = false; boatStones.push(st);
  }
  // ---- the pile on the bank: every stone resting ON the ground / the layer below ----
  const PILE = [[12.9, 0.17, 0.9, 0.17], [13.3, 0.15, 0.75, 0.15], [13.0, 0.14, 1.15, 0.14], [13.55, 0.13, 1.05, 0.13], [13.35, 0.13, 1.3, 0.13], [13.12, 0.30, 0.95, 0.14], [13.42, 0.28, 1.0, 0.12], [13.25, 0.42, 1.08, 0.11]];
  for (const [sx, sy, sz, sr] of PILE) add(new THREE.SphereGeometry(sr, 10, 8), MAT.stoneDk, sx, sy, sz, g, { cast: false });
  // ---- the balance scale on the bank (payoff visual: stones get weighed) ----
  scaleG = new THREE.Group(); scaleG.position.set(14.9, 0, 0.9); g.add(scaleG);
  add(new THREE.CylinderGeometry(0.06, 0.09, 1.7, 8), MAT.woodDk, 0, 0.85, 0, scaleG, { cast: false });
  add(tbox(1.5, 0.07, 0.07, 1), MAT.woodDk, 0, 1.68, 0, scaleG, { cast: false });
  for (const px of [-0.68, 0.68]) {
    add(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 5), MAT.dark, px, 1.42, 0, scaleG, { cast: false });
    add(new THREE.CylinderGeometry(0.26, 0.05, 0.08, 12), MAT.iron, px, 1.15, 0, scaleG, { cast: false });
  }
  for (let i = 0; i < 3; i++) add(new THREE.SphereGeometry(0.11, 8, 6), MAT.stoneDk, -0.68 + (i % 2) * 0.16 - 0.08, 1.22, -0.05 + Math.floor(i / 2) * 0.12, scaleG, { cast: false });
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
// All three boards share one anchor above the river so every board-shot
// camera frames whichever board is up.
const boardTitle = textBoard(['वो लड़का जिसने', 'हाथी को तौल दिया'], 3.4, 1.15, '#1d2f4a', '#dfe8ff'); boardTitle.position.set(16, 3.55, -3.3); world.add(boardTitle);
const boardWeight = textBoard(['दो हज़ार', 'किलो!'], 2.6, 1.15, '#4a2c14', '#ffd76a'); boardWeight.position.set(16, 3.55, -3.3); world.add(boardWeight);
const boardHook = textBoard(['एक बकरी दो बार', 'कैसे बिकती है?'], 3.4, 1.15, '#2e1a4a', '#ffe9a8'); boardHook.position.set(16, 3.55, -3.3); world.add(boardHook);

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
  setB(boardTitle, Ws.boardTitle || 0); setB(boardWeight, Ws.boardWeight || 0);
  setB(boardHook, Ws.boardHook || 0);
  // the boat: sinks with weight (elephant aboard / stones loaded), floats
  // back up empty. The elephant aboard is a CHILD of the boat, so it
  // sinks with it, feet always on the deck.
  boatG.position.y = Ws.boatY ?? 0.55;
  chalkG.visible = (Ws.chalkK || 0) > 0.01;
  eleBoat.visible = (Ws.eleBoat || 0) > 0.01;
  eleBank.visible = (Ws.eleBank || 0) > 0.01;
  scaleG.visible = (Ws.scaleK || 0) > 0.01;   // the scale only stands on the bank for the weighing
  // stones in the boat: each drops with gravity from just above the deck
  // (story.js easeIn) and lands ON the deck, then stays.
  const sd = Ws.stoneDrop || [];
  boatStones.forEach((st, i) => {
    const k = sd[i] || 0;
    st.visible = k > 0.01;
    st.position.y = st.userData.homeY + (1 - k) * 0.5;
  });
  // ripples around the hull while the boat sinks
  const rk = Ws.rippleK || 0;
  ripples.forEach((rm, i) => {
    rm.material.opacity = rk * 0.45 * (1 - i * 0.22);
    rm.visible = rk > 0.01;
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
