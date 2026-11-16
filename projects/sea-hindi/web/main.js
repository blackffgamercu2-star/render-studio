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

// ---------- the set: palace court (x=0) + offering table, shore (x=-24), rivers + farm (x=+18) ----------
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
  sand: toon({ color: '#cbb27f' }), wetSand: toon({ color: '#a8895e' }),
  waterDeep: toon({ color: '#14425e' }), river: toon({ color: '#2e7ea6' }), riverDk: toon({ color: '#22708f' }),
  cupBlue: toon({ color: '#2e6e9e' }), cupWater: toon({ color: '#7fc4e0' }),
  rainCloud: toon({ color: '#4a5566' }), rainCloudDk: toon({ color: '#3a4454' }),
  hedge: toon({ color: '#3f6030' }),
};
const world = new THREE.Group(); scene.add(world);
let goldBagG, cupG, seaWater, riverSea;
const worldGroup = world;
{
  const g = world;
  const gr = flat(add(new THREE.PlaneGeometry(300, 240), MAT.grass, 8, -0.03, 0, g, { cast: false })); gr.receiveShadow = true;
  flat(add(new THREE.CircleGeometry(9.5, 24), MAT.dirt, 0, -0.012, 0.5, g, { cast: false }));   // court yard
  flat(add(new THREE.PlaneGeometry(24, 3.0), MAT.dirt, -13, -0.014, 1.0, g, { cast: false }));  // road west to the shore
  flat(add(new THREE.PlaneGeometry(20, 3.0), MAT.dirt, 10, -0.014, 1.0, g, { cast: false }));   // road east to the rivers/farm
  flat(add(new THREE.PlaneGeometry(1.7, 5.2), MAT.crimson, 0, -0.006, 0.4, g, { cast: false })); // red carpet, throne to court
  // distant huts + trees (depth)
  for (const [hx, hz, ry] of [[-7, -13, 0.2], [8, -14, -0.3], [26, -13, -0.2]]) {
    const h = new THREE.Group(); h.position.set(hx, 0, hz); h.rotation.y = ry; g.add(h);
    add(tbox(2.6, 1.7, 2.2, 2), MAT.stone, 0, 0.85, 0, h, { cast: false });
    add(new THREE.ConeGeometry(2.2, 1.2, 4), MAT.thatch, 0, 2.3, 0, h, { cast: false }).rotation.y = Math.PI / 4;
  }
  for (const [tx, tz, s] of [[-11, -9, 1], [11, -11, 1.2], [23, -9, 0.9]]) {
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
  // ================= OFFERING TABLE (court) — gold pouch rests on it =================
  // Table top surface at y=0.78; the pouch's base sits ON it (group origin at
  // the pouch base, sphere bottom ~0.02 below origin = flush contact).
  const tbl = new THREE.Group(); tbl.position.set(1.15, 0, -0.7); g.add(tbl);
  add(tbox(0.9, 0.07, 0.7, 2), MAT.wood, 0, 0.745, 0, tbl);                          // table top (surface 0.78)
  for (const [lx, lz] of [[-0.38, -0.28], [0.38, -0.28], [-0.38, 0.28], [0.38, 0.28]])
    add(tbox(0.07, 0.71, 0.07, 2), MAT.woodDk, lx, 0.355, lz, tbl);                  // legs, feet on the floor
  add(tbox(0.7, 0.05, 0.55, 2), MAT.woodDk, 0, 0.08, 0, tbl);                        // low shelf
  // the bag of gold — rests on the offering table until the handover
  goldBagG = new THREE.Group(); goldBagG.position.set(1.15, 0.78, -0.7); g.add(goldBagG);
  const gb = add(new THREE.SphereGeometry(0.17, 10, 8), MAT.sack, 0, 0.11, 0, goldBagG); gb.scale.y = 0.78;
  add(new THREE.CylinderGeometry(0.045, 0.07, 0.09, 8), MAT.woodDk, 0, 0.26, 0, goldBagG);
  add(new THREE.ConeGeometry(0.13, 0.1, 10), MAT.gold, 0.16, 0.05, 0.08, goldBagG);
  // ================= THE CUP — 3D prop driven by story.js (cupPos/cupTilt) =================
  // Group origin = cup BASE, so y = surface it rests on: sand y=0, hand/mouth
  // heights from story.js. Cup body + water disc inside; base stays flush.
  cupG = new THREE.Group(); cupG.position.set(-23.62, 1.02, 1.0); cupG.visible = false; g.add(cupG);
  add(new THREE.CylinderGeometry(0.11, 0.085, 0.22, 12), MAT.cupBlue, 0, 0.11, 0, cupG);
  add(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 12), MAT.cupWater, 0, 0.19, 0, cupG, { cast: false });
  add(new THREE.TorusGeometry(0.11, 0.012, 6, 14), MAT.goldDk, 0, 0.21, 0, cupG, { cast: false }).rotation.x = Math.PI / 2;
  // ================= SHORE (x = -24): sand + sea =================
  flat(add(new THREE.CircleGeometry(7.5, 24), MAT.sand, -24, -0.008, 0.5, g, { cast: false }));   // dry sand
  flat(add(new THREE.PlaneGeometry(14, 2.4), MAT.wetSand, -24, -0.006, -1.4, g, { cast: false })); // wet sand at the waterline
  flat(add(new THREE.PlaneGeometry(34, 34), MAT.waterDeep, -24, -0.5, -16, g, { cast: false }));  // deep base under the sea (no void at edges)
  seaWater = FX.makeWater({ size: 30, seg: 60, amp: 0.3 }); seaWater.position.set(-24, 0.02, -16); g.add(seaWater);
  // beached rowboat — hull sits ON the sand (bottom at y=0)
  const boat = new THREE.Group(); boat.position.set(-27.5, 0, 3.5); boat.rotation.y = 0.6; g.add(boat);
  add(tbox(2.2, 0.45, 0.9, 2), MAT.wood, 0, 0.225, 0, boat);
  add(tbox(2.0, 0.1, 0.7, 2), MAT.woodDk, 0, 0.5, 0, boat, { cast: false });
  const mast = add(new THREE.CylinderGeometry(0.04, 0.05, 2.2, 7), MAT.woodDk, 0, 1.4, 0, boat, { cast: false }); mast.rotation.z = 0.08;
  // shells + rocks half-buried in the sand
  for (const [sx, sz, s, col] of [[-21.5, 2.6, 0.09, '#e8dcc8'], [-26.2, -0.4, 0.12, '#d9c491'], [-22.0, -2.8, 0.15, '#a89f8d']]) {
    const r = add(new THREE.SphereGeometry(s, 8, 6), toon({ color: col }), sx, s * 0.4, sz, g, { cast: false }); r.scale.y = 0.55;
  }
  // ================= RIVERS (x = +18): seven ribbons into a sea strip =================
  flat(add(new THREE.PlaneGeometry(30, 12), MAT.waterDeep, 18, -0.5, -11.5, g, { cast: false })); // deep base under the river-sea
  riverSea = FX.makeWater({ size: 16, seg: 48, amp: 0.25 }); riverSea.position.set(18, 0.02, -11.5); g.add(riverSea);
  for (let i = 0; i < 7; i++) {   // seven ribbons, x 13.5..22.5, z -14..-6.5, tops at y=0.06
    const x = 13.5 + i * 1.5;
    add(tbox(0.55, 0.06, 7.5, 2), i % 2 ? MAT.river : MAT.riverDk, x, 0.03, -10.25, g, { cast: false });
  }
  // rolling hills behind the rivers (squashed spheres — soft, never pyramids)
  for (const [hx, hz, s] of [[12, -19, 3.4], [18, -21, 4.2], [24, -19, 3.0]]) {
    const hill = add(new THREE.SphereGeometry(s, 12, 9), MAT.leaf2, hx, 0, hz, g, { cast: false });
    hill.scale.y = 0.42;
  }
  // (FIX 2026-11-16, parent eye-check f1133/f1921): the broken dam was REMOVED.
  // Its two tilted blocks + loose beam read as floating boxes hovering above
  // the water with bottoms touching nothing — no convincing grounding, so out.
  // ================= FARM (x = +18 foreground): the rain hook =================
  flat(add(new THREE.CircleGeometry(5.2, 18), MAT.grass, 18, -0.006, 0.8, g, { cast: false }));
  flat(add(new THREE.CircleGeometry(3.0, 16), MAT.dirt, 17, -0.004, 0.5, g, { cast: false }));    // wet patch under the rain clouds
  for (let i = 0; i < 5; i++) add(tbox(1.15, 0.75, 0.5, 2), MAT.hedge, 14.6 + i * 1.18, 0.37, -3.6, g, { cast: false }); // hedge row
  const fh = new THREE.Group(); fh.position.set(21.5, 0, -3.5); fh.rotation.y = -0.3; g.add(fh); // farm hut
  add(tbox(2.6, 1.7, 2.2, 2), MAT.stone, 0, 0.85, 0, fh, { cast: false });
  add(new THREE.ConeGeometry(2.2, 1.2, 4), MAT.thatch, 0, 2.3, 0, fh, { cast: false }).rotation.y = Math.PI / 4;
  add(new THREE.CylinderGeometry(0.34, 0.5, 3.4, 8), MAT.woodDk, 22.6, 1.7, -4.6, g, { cast: false });
  const can2 = add(new THREE.SphereGeometry(2.3, 10, 8), MAT.leaf, 22.6, 4.2, -4.6, g, { cast: false }); can2.scale.y = 0.7; can2.userData.ndSkip = true;
  // rain clouds — dark shaded spheres clustered LOW over the farm (y ~7-8)
  // so they read in the hook frames (the farmer sold the rain itself)
  const rc = new THREE.Group(); g.add(rc);
  for (const [cx, cy, cz, s, m] of [[15.5, 7.6, -1.5, 1.6, 0], [17.5, 8.2, -0.5, 2.0, 1], [19.5, 7.8, -1.8, 1.7, 0], [17.0, 7.1, 0.8, 1.3, 1]]) {
    const c = add(new THREE.SphereGeometry(s, 12, 9), m ? MAT.rainCloudDk : MAT.rainCloud, cx, cy, cz, rc, { cast: false });
    c.scale.set(1.5, 0.55, 1);
  }
}
// ---- boards (transforms mirrored in boards.json — keep in sync) ----
const boardTitle = textBoard(['पूरा समंदर…', 'पी जाऊँगा?'], 3.0, 1.2, '#4a2c14', '#ffd76a'); boardTitle.position.set(0, 4.3, -3.12); world.add(boardTitle);
const boardBet = textBoard(['सौ सोने के सिक्के', 'या एक साल काल-कोठरी!'], 2.9, 1.15, '#4a2c14', '#ffd76a'); boardBet.position.set(0, 3.6, -3.12); world.add(boardBet);
const boardCup = textBoard(['एक ही प्याला…', 'फिर रुक गया?'], 2.6, 1.15, '#14425e', '#dfeef7'); boardCup.position.set(-24, 2.6, -2.9); world.add(boardCup);
const boardRivers = textBoard(['पहले नदियाँ रोकिए!'], 2.9, 0.7, '#1d2f4a', '#dfe8ff'); boardRivers.position.set(18, 3.2, -5.5); world.add(boardRivers);
const boardSeven = textBoard(['सात नदियाँ —', 'बेकाबू!'], 2.9, 1.15, '#1d2f4a', '#dfe8ff'); boardSeven.position.set(18, 3.6, -9.0); world.add(boardSeven);
const boardPay = textBoard(['सौ सिक्के —', 'दाँव जीता!'], 2.9, 1.15, '#4a2c14', '#ffd76a'); boardPay.position.set(0, 3.6, -3.12); world.add(boardPay);
const boardHook = textBoard(['बारिश ही बेच दी?', 'कैसे बिकती है?'], 2.9, 1.0, '#1d2f4a', '#dfe8ff'); boardHook.position.set(17.6, 3.45, -3.3); world.add(boardHook);
// FIX 2026-11-16 (parent eye-check f1921): hook-board signposts. The other
// boards sit against the palace wall; this one hangs in open farm air, so it
// gets two wooden posts: feet sunk 0.02 into the grass (y -0.02..2.98), tops
// tucked 0.03 into the board's bottom edge (board bottom y=2.95) — the board
// is HELD UP, not floating. Posts at x = centre ±1.15 (16.45 / 18.75), inside
// the board's edges and clear of the text band (±0.98). Visibility follows
// the board (toggled in worldState) so no stray poles show in other shots.
const hookPosts = new THREE.Group(); world.add(hookPosts);
for (const px of [16.45, 18.75]) add(tbox(0.12, 3.0, 0.12, 2), MAT.woodDk, px, 1.48, -3.3, hookPosts);
hookPosts.visible = false;

// ---------- FX: court haze, shore spray, farm rain mist, clouds ----------
const smoke = new FX.Smoke(scene, 130); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const hazeEmit = smoke.addEmitter(0, 2.6, -2, { rate: 0.3, color: 0xffe2b0, opacity: 0.045, scale: 2.4, grow: 1.3, life: 2.8, vy: 0.1, wind: -0.4 });
const sprayEmit = smoke.addEmitter(-24, 1.0, -2, { rate: 0.05, color: 0xe8f4f8, opacity: 0.12, scale: 0.8, grow: 1.6, life: 1.1, vy: 0.5, wind: 0.3 });
const rainEmit = smoke.addEmitter(17, 2.0, -1, { rate: 0.08, color: 0x9aa8b8, opacity: 0.14, scale: 1.2, grow: 1.6, life: 1.1, vy: 0.3, wind: 0.2 });
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
    hazeEmit.rate = pr.smokeRate; sprayEmit.rate = pr.sprayRate; rainEmit.rate = pr.dustRate;
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
  setB(boardTitle, Ws.boardTitle || 0); setB(boardBet, Ws.boardBet || 0);
  setB(boardCup, Ws.boardCup || 0); setB(boardRivers, Ws.boardRivers || 0);
  setB(boardSeven, Ws.boardSeven || 0); setB(boardPay, Ws.boardPay || 0);
  setB(boardHook, Ws.boardHook || 0);
  if (typeof hookPosts !== 'undefined') hookPosts.visible = (Ws.boardHook || 0) > 0.01;
  // the cup: position + tilt driven by story.js; group origin = cup base,
  // so it sits flush on sand / in the hand / at the mouth with no gap.
  // Tilt leans the rim toward the sailor's mouth (he stands at -x of the cup).
  if (cupG) {
    cupG.visible = (Ws.cupVis || 0) > 0.5;
    const cp = Ws.cupPos;
    if (cp) cupG.position.set(cp[0], cp[1], cp[2]);
    cupG.rotation.z = (Ws.cupTilt || 0);
  }
  // gold pouch: position driven by story (rests on the offering table, then hand-to-hand)
  const gp = Ws.goldPos;
  if (gp) { goldBagG.visible = true; goldBagG.position.set(gp[0], gp[1], gp[2]); }
  else goldBagG.visible = false;
  // water: shader time advance (waves move every frame)
  const t = f / 30;
  if (seaWater) seaWater.userData.update(t);
  if (riverSea) riverSea.userData.update(t);
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
