import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import * as PR from './props.js';
import * as M4 from './materials.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, BOARD_POS, QUAY, HOUSES, LAMP1, LAMP2, CRATE1, CRATE2, boatAt, lanternAt, lanternGlowAt, basketAt, fishAt, splashAt } from './story.js';

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
const lampLight = new THREE.PointLight('#ffc46a', 0, 13, 1.6); scene.add(lampLight);
scene.fog = new THREE.Fog('#ffffff', 40, 600);

// ---------- text-board helper (canvas texture plane; boards are in-world props) ----------
const textBoard = (lines, w, h, bg, fg, font = 900, fit = null) => {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w);
  const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = fg; g.lineWidth = 14; g.strokeRect(20, 20, c.width - 40, c.height - 40);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  let fs = Math.min(170, (c.width - 130) / Math.max(...lines.map((l) => l.length)) * 1.72);
  if (fit && fit.fsMul) fs *= fit.fsMul;
  g.font = `${font} ${fs}px Arial`;
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
const softGlow = (scale, color, opacity) => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 1, 32, 32, 31);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)'); grd.addColorStop(0.4, 'rgba(255,255,255,0.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(scale); s.userData.ndSkip = true; return s;
};

// ---------- materials ----------
const goldCanvas = (() => {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#8a5a14'); gr.addColorStop(0.35, '#d9a441'); gr.addColorStop(0.52, '#ffe9a0'); gr.addColorStop(0.62, '#f6c453'); gr.addColorStop(1, '#9c6b1e');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 260; i++) {
    g.strokeStyle = `rgba(255,240,200,${0.03 + Math.random() * 0.05})`; g.lineWidth = 1;
    const y = Math.random() * 512; g.beginPath(); g.moveTo(0, y); g.lineTo(512, y + (Math.random() - 0.5) * 6); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
})();
const foodCanvas = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#e9dcbc'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,250,235,${0.25 + Math.random() * 0.4})`; g.fillRect(Math.random() * 256, Math.random() * 256, 3, 2); }
  for (let i = 0; i < 130; i++) { g.fillStyle = i % 3 ? '#c96a28' : '#5d7a2e'; g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 3.4, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
const MAT = {
  quay: texM(M4.groundDetail(P.stone(64, 40, 5, 58), 191, { dots: 1200 }), 10, 10, '#7d8290'),
  quayEdge: texM(M4.stoneV4(8), 3, 1, '#5d6270'),
  stone: texM(M4.stoneV4(8), 3, 2, '#8a8290'), stoneDk: texM(M4.stoneV4(9), 3, 2, '#5a5460'),
  wood: texM(M4.woodV4(4), 1, 2), woodDk: texM(M4.woodV4(6), 1, 2),
  hullWood: texM(M4.woodV4(7), 2, 1, '#6a4a2c'),
  plaster: texM(P.plaster(71, 36), 2, 2),
  roof: toon({ color: '#2e2a33' }),
  brass: new THREE.MeshStandardMaterial({ color: 0xb08a3a, roughness: 0.35, metalness: 0.85, envMap, envMapIntensity: 1.1 }),
  lanternGlass: M4.glassMatV4(envMap, 0.55),
  fishSilver: new THREE.MeshStandardMaterial({ color: 0xc8d4dc, roughness: 0.32, metalness: 0.9, envMap, envMapIntensity: 1.3 }),
  wicker: texM(M4.woodV4(11), 1, 1, '#9a7a4a'),
  crimson: toon({ color: '#7a1f2e' }), teal: toon({ color: '#1f4a4a' }),
  cloth: toon({ color: '#8a6f42' }), leaf: toon({ color: '#4a7a34' }),
  white: toon({ color: '#f7f3e6' }), dark: toon({ color: '#33302c' }),
  windowWarm: new THREE.MeshBasicMaterial({ color: 0xffc46a }),
};
// ---------- the harbour at night: stone quay + dark sea ----------
// Quay deck (top y=0, z 3.5..14) meets the sea (water y=-0.25, z<3.5).
// Houses back the quay at z~14; two quay lamps; crates + a barrel; two
// moored boats idle in the dark water as background silhouettes.
const world = new THREE.Group(); scene.add(world);
const waterBase = flat(add(new THREE.CircleGeometry(60, 48), new THREE.MeshBasicMaterial({ color: '#050a14' }), 0, -1.5, -14, scene, { cast: false }));
{
  const g = world;
  const quay = add(tbox(32, 0.3, 10.5, 3), MAT.quay, 0, -0.15, 8.75, g, { cast: false });
  add(tbox(32, 0.35, 0.5, 3), MAT.quayEdge, 0, -0.1, 3.6, g, { cast: false });
  // bollards along the quay edge (the boat's mooring line ties to one)
  for (const bx of [-10, -5, 5, 10]) {
    add(new THREE.CylinderGeometry(0.09, 0.12, 0.45, 8), MAT.stoneDk, bx, 0.22, 3.9, g, { cast: false });
    add(new THREE.SphereGeometry(0.12, 8, 6), MAT.stoneDk, bx, 0.48, 3.9, g, { cast: false });
  }
  // houses (north, z~14.5): plaster walls, dark roofs, warm lit windows
  for (const [hx, hw, hh] of [[-9, 5, 3.4], [0, 6, 4.0], [9, 5, 3.4]]) {
    add(tbox(hw, hh, 2.2, 3), MAT.plaster, hx, hh / 2, 12.9, g, { cast: false });
    // gable roof: two sloped slabs meeting at a ridge along x
    for (const sd of [-1, 1]) {
      const slab = add(tbox(hw + 0.5, 0.09, 1.5, 2), MAT.roof, hx, hh + 0.39, 12.9 + sd * 0.64, g, { cast: false });
      slab.rotation.x = sd * 0.55;
    }
    add(tbox(hw + 0.5, 0.09, 0.14, 2), MAT.roof, hx, hh + 0.78, 12.9, g, { cast: false });
    // the middle house stands behind the title board: no windows there
    // (they would hide behind the board); the side houses carry the warm light
    if (hx !== 0) for (const wx of [-hw * 0.22, hw * 0.22]) {
      const win = add(new THREE.PlaneGeometry(0.55, 0.75), MAT.windowWarm, hx + wx, hh * 0.55, 11.78, g, { cast: false });
      win.rotation.y = Math.PI;
    }
  }
  // quay lamps: pole + hanging warm lamp + soft glow
  for (const LP of [LAMP1, LAMP2]) {
    add(new THREE.CylinderGeometry(0.06, 0.08, 3.1, 7), MAT.stoneDk, LP.x, 1.55, LP.z, g, { cast: false });
    const arm = add(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 6), MAT.stoneDk, LP.x + 0.3, 3.05, LP.z, g, { cast: false });
    arm.rotation.z = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.16, 0.2, 0.3, 8), MAT.brass, LP.x + 0.62, 2.85, LP.z, g, { cast: false });
    const lg = softGlow(1.6, '#ffc46a', 0.32); lg.position.set(LP.x + 0.62, 2.85, LP.z); g.add(lg);
  }
  // crates + barrel on the quay (real stacked props, resting ON the deck)
  for (const [cx, cz, cs] of [[CRATE1.x, CRATE1.z, 0.8], [CRATE2.x, CRATE2.z, 0.7]]) {
    add(tbox(cs, cs, cs, 2), MAT.wood, cx, cs / 2, cz, g, { cast: false });
    add(tbox(cs * 0.7, cs * 0.7, cs * 0.7, 2), MAT.woodDk, cx + 0.1, cs + cs * 0.35, cz, g, { cast: false });
  }
  add(new THREE.CylinderGeometry(0.42, 0.36, 0.9, 12), MAT.woodDk, -11.5, 0.45, 10.5, g, { cast: false });
  // coiled rope + a spare basket resting on the quay near the old man
  const rope = add(new THREE.TorusGeometry(0.32, 0.07, 8, 20), MAT.wicker, -3.4, 0.07, 8.6, g, { cast: false });
  rope.rotation.x = Math.PI / 2;
  // board posts (title + hook boards share this frame)
  for (const px of [BOARD_POS[0] - 2.1, BOARD_POS[0] + 2.1]) add(new THREE.CylinderGeometry(0.06, 0.07, 3.3, 7), MAT.woodDk, px, 1.65, BOARD_POS[2], g, { cast: false });
  add(tbox(4.6, 0.12, 0.12, 2), MAT.woodDk, BOARD_POS[0], 3.9, BOARD_POS[2], g, { cast: false });
  // moored background boats (dark silhouettes on the water)
  for (const [mx, mz, ry] of [[-11, -4, 0.4], [12, 0.5, -0.3]]) {
    const mb = new THREE.Group(); mb.position.set(mx, -0.1, mz); mb.rotation.y = ry; g.add(mb);
    add(tbox(0.85, 0.08, 2.5, 2), MAT.hullWood, 0, 0.06, 0, mb, { cast: false });
    for (const sx of [-1, 1]) { const sd = add(tbox(0.06, 0.4, 2.5, 2), MAT.hullWood, sx * 0.43, 0.25, 0, mb, { cast: false }); sd.rotation.z = -sx * 0.18; }
    add(tbox(0.9, 0.06, 0.3, 2), MAT.woodDk, 0, 0.32, 0.4, mb, { cast: false });
  }
}
// the sea itself: shader water (swells + moon glints + foam on crests)
const waterMesh = FX.makeWater({ size: 400, seg: 80, deep: 0x06101e, shallow: 0x0e2233, sky: 0x16324a, amp: 0.28, spark: 0.2 });
waterMesh.position.set(0, -0.25, -16); waterMesh.userData.ndSkip = true; scene.add(waterMesh);
// (mistBand removed: its 26-46-unit sprites wash the frame from a low
// sea-level camera. Living elements remain: water swells, fireflies,
// clouds, lantern flicker.)

// ---------- THE BOAT (hero prop, built from real parts) ----------
// Wooden rowing boat: half-cylinder hull with per-plank wood, gunwale rails,
// two thwarts, a stern pole with a side arm. The LANTERN hangs from the arm
// on a real line (never floats); the BASKET rides in the old man's lap;
// five silver fish leap on ballistic arcs and land in boat / basket.
const boatG = new THREE.Group(); world.add(boatG);
{
  // hull trough: floor plank + flared side planks + bow/stern boards
  add(tbox(0.9, 0.08, 2.8, 2), MAT.hullWood, 0, 0.06, 0, boatG, { cast: false });
  for (const sx of [-1, 1]) {
    const side = add(tbox(0.06, 0.42, 2.8, 2), MAT.hullWood, sx * 0.46, 0.26, 0, boatG, { cast: false });
    side.rotation.z = -sx * 0.18;
    const rail = add(tbox(0.07, 0.07, 3.0, 2), MAT.woodDk, sx * 0.52, 0.46, 0, boatG, { cast: false });
  }
  for (const sz of [-1, 1]) {
    const end = add(tbox(0.9, 0.4, 0.08, 2), MAT.hullWood, 0, 0.3, sz * 1.4, boatG, { cast: false });
    end.rotation.x = sz * 0.1;
  }
  for (const tz of [-0.7, 0.5]) add(tbox(1.0, 0.06, 0.32, 2), MAT.wood, 0, 0.3, tz, boatG, { cast: false });
  add(tbox(0.5, 0.05, 2.6, 2), MAT.woodDk, 0, 0.02, 0, boatG, { cast: false });
  // stern pole + side arm the lantern hangs from
  add(new THREE.CylinderGeometry(0.045, 0.06, 1.6, 7), MAT.woodDk, 0.85, 0.95, 0.3, boatG, { cast: false });
  const arm = add(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 6), MAT.woodDk, 0.95, 1.72, 0.3, boatG, { cast: false });
  arm.rotation.z = Math.PI / 2; arm.position.set(0.95, 1.72, 0.3);
  // NOTE: arm spans local x 0.7..1.2 at (y 1.72, z 0.3); lantern hangs below it.
}
// the lantern: brass frame + glass with reflection streaks + warm core
const lanternG = new THREE.Group(); boatG.add(lanternG);
add(new THREE.CylinderGeometry(0.13, 0.16, 0.34, 10), MAT.lanternGlass, 0, 0, 0, lanternG, { cast: false });
add(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 10), MAT.brass, 0, 0.19, 0, lanternG, { cast: false });
add(new THREE.CylinderGeometry(0.17, 0.14, 0.05, 10), MAT.brass, 0, -0.19, 0, lanternG, { cast: false });
add(new THREE.TorusGeometry(0.07, 0.015, 6, 12), MAT.brass, 0, 0.24, 0, lanternG, { cast: false });
const lanternGlow = softGlow(1.1, '#ffc46a', 0); lanternGlow.position.set(0, 0, 0); lanternG.add(lanternGlow);
const lanternLine = add(new THREE.CylinderGeometry(0.012, 0.012, 1, 4), MAT.dark, 0, 0, 0, boatG, { cast: false });
// warm pool of lantern light shimmering on the water below
const waterGlow = softGlow(1.4, '#ffb85e', 0); waterGlow.position.set(0, -0.2, 0); scene.add(waterGlow);
// the basket: woven wicker, rim ring, rests in the lap / on the quay
const basketG = new THREE.Group(); world.add(basketG);
add(new THREE.CylinderGeometry(0.3, 0.24, 0.35, 12), MAT.wicker, 0, 0.175, 0, basketG, { cast: false });
add(new THREE.TorusGeometry(0.3, 0.03, 6, 18), MAT.woodDk, 0, 0.35, 0, basketG, { cast: false }).rotation.x = Math.PI / 2;
// the oar: rests across the thwarts; dips in a rowing cycle while rowing
const oarG = new THREE.Group(); boatG.add(oarG);
add(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 6), MAT.wood, 0, 0, 0, oarG, { cast: false }).rotation.x = Math.PI / 2;
add(tbox(0.16, 0.02, 0.55, 2), MAT.woodDk, 0, 0, -1.4, oarG, { cast: false });
// five silver fish (metallic, env sheen): leap, land, stay
const fishMeshes = [];
for (let i = 0; i < 5; i++) {
  const fg = new THREE.Group(); world.add(fg);
  const body = add(new THREE.SphereGeometry(0.16, 12, 8), MAT.fishSilver, 0, 0, 0, fg, { cast: false });
  body.scale.set(1.7, 0.55, 0.6);
  const tail = add(new THREE.ConeGeometry(0.09, 0.22, 6), MAT.fishSilver, -0.32, 0, 0, fg, { cast: false });
  tail.rotation.z = Math.PI / 2;
  fg.visible = false; fishMeshes.push(fg);
}
// splash ripple rings on the water (takeoff + landing of each leap)
const rings = [];
for (let i = 0; i < 6; i++) {
  const rm = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.0, 26), new THREE.MeshBasicMaterial({ color: 0xeaf7ff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  rm.rotation.x = -Math.PI / 2; rm.position.y = -0.22; rm.visible = false; rm.userData.ndSkip = true; scene.add(rm); rings.push(rm);
}

// ---------- boards (transforms mirrored in boards.json — keep in sync) ----------
const boardTitle = textBoard([' THE FISHERMAN WHO ', ' CAUGHT FISH ', ' WITHOUT A NET '], 4.6, 1.5, '#0e1a2e', '#ffe9a8');
boardTitle.position.set(...BOARD_POS); boardTitle.rotation.y = Math.PI; world.add(boardTitle); addBoardOccluder(boardTitle, 4.6, 1.5, 'boardTitle');
const boardHook = textBoard(['     BUT TOMORROW...     ', '    HOW DOES ONE BAKER    ', '   BAKE BREAD WITH NO   ', '    OVEN AT ALL?    '], 4.6, 1.5, '#2e1a3a', '#ffd76a', 900, { pitch: 0.165, dy: 0.01 });
boardHook.position.set(...BOARD_POS); boardHook.rotation.y = Math.PI; world.add(boardHook); addBoardOccluder(boardHook, 4.6, 1.5, 'boardHook');

// ---------- FX: harbour night — fireflies/motes over the water, mist, clouds ----------
// Fireflies cluster where the lantern burns (they ride the shimmer rate);
// a faint cool dust drifts over the quay. Clouds slide with parallax.
const smoke = new FX.Smoke(scene, 160); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const fireflyEmit = smoke.addEmitter(0, 0.9, -8, { rate: 0, color: 0xffd9a0, opacity: 0.5, scale: 0.28, grow: 1.1, life: 2.2, vy: 0.12, wind: 0.1 });
const quayDustEmit = smoke.addEmitter(0, 1.2, 8, { rate: 0.15, color: 0xaebfe0, opacity: 0.07, scale: 0.5, grow: 1.2, life: 2.4, vy: 0.1, wind: 0.12 });
const fxClouds = new FX.Clouds(scene, { count: 6, y: 46, opacity: 0.16, color: 0x2a3a5e, drift: 0.5 });
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
    fireflyEmit.rate = pr.shimmerRate * 2.2;
    quayDustEmit.rate = 0.15;
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
const _va = new THREE.Vector3(), _vb = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
function worldState(Ws, f) {
  fxStepTo(f);
  skyU.time.value = f / 30;
  const setB = (mesh, v) => { mesh.material.opacity = v; mesh.visible = v > 0.01; };
  setB(boardTitle, Ws.boardTitle || 0); setB(boardHook, Ws.boardHook || 0);
  scene.traverse((o) => { if (o.userData.isOccluder) { o.userData.boardVisible = o.userData.boardKey === 'always' || (Ws[o.userData.boardKey] || 0) > 0.01; o.visible = false; } });
  // THE BOAT rides the story: moored at the quay, then rowed to dark water.
  // Tiny bob only on the hull mesh — the seated old man and basket ride the
  // story positions exactly, so nothing visually detaches from its surface.
  const bob = Math.sin(f * 0.08) * 0.012;
  boatG.position.set(Ws.boatX, Ws.boatY + bob, Ws.boatZ);
  // THE LANTERN hangs from the pole arm on a real line: the line is rescaled
  // every frame from the arm tip (local 0.95, 1.72, 0.3) to the lantern top,
  // so it never floats and never detaches.
  const L = lanternAt(f);
  lanternG.position.set(L.x - Ws.boatX, L.y - Ws.boatY, L.z - Ws.boatZ);
  const lineTop = 1.72, lineBot = (L.y - Ws.boatY) + 0.19;
  lanternLine.position.set(0.95, (lineTop + lineBot) / 2, 0.3);
  lanternLine.scale.y = Math.max(0.05, lineTop - lineBot);
  lanternGlow.material.opacity = Ws.lanternGlow * 0.85;
  lanternGlow.visible = Ws.lanternGlow > 0.02;
  lampLight.position.set(L.x, L.y + 0.1, L.z);
  lampLight.intensity = Ws.lanternGlow * 7;
  waterGlow.position.set(L.x, -0.2, L.z);
  waterGlow.material.opacity = Ws.lanternGlow * 0.3;
  waterGlow.visible = Ws.lanternGlow > 0.02;
  // THE BASKET: rests on the quay, rides in the lap, lifts with effort.
  basketG.position.set(Ws.basketX, Ws.basketY, Ws.basketZ);
  // THE FISH: ballistic leaps, land IN the boat / basket and stay.
  const fishes = fishAt(f);
  fishes.forEach((fi, i) => {
    const m = fishMeshes[i];
    m.visible = fi.visible > 0.5;
    if (!m.visible) return;
    m.position.set(fi.x, fi.y, fi.z);
    m.rotation.z = fi.rot;
    m.rotation.y = i % 2 ? 0.4 : -0.3;
  });
  // splash ripple rings at each leap takeoff / landing
  const sps = splashAt(f);
  rings.forEach((r, i) => {
    const sp = sps[i];
    if (!sp || sp.k <= 0.02) { r.visible = false; return; }
    r.visible = true;
    r.position.set(sp.x, -0.22, sp.z);
    const sc = 0.4 + (1 - sp.k) * 2.0;
    r.scale.set(sc, sc, 1);
    r.material.opacity = sp.k * 0.5;
  });
  // the oar dips in a rowing cycle while the boat rows, rests across the
  // thwarts otherwise
  if (Ws.boatRow) { oarG.rotation.z = 0.35 * Math.sin(f * 0.3); oarG.position.set(0.5, 0.35, 0); }
  else { oarG.rotation.z = 0; oarG.position.set(0, 0.32, 0.2); }
  // the sea itself moves every frame (swells + glints + foam)
  waterMesh.userData.update(f / 30);
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
      if (o.userData.isOccluder) { o.userData.vis0 = o.visible; o.visible = !!o.userData.boardVisible; return; }
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
