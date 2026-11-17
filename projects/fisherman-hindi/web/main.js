import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import * as PR from './props.js';
import * as M4 from './materials.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, BOARD_POS, WATER_Y, DECK_Y, BOAT_Y, boat1Local, fishStatesAt, splashAt, FISH_TAKE } from './story.js';

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
scene.fog = new THREE.Fog('#ffffff', 40, 600);

// ---------- text-board helper (canvas texture plane; boards are in-world props) ----------
const textBoard = (lines, w, h, bg, fg, font = 900, fit = null) => {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w);
  const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = fg; g.lineWidth = 14; g.strokeRect(20, 20, c.width - 40, c.height - 40);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  let fs = Math.min(170, (c.width - 130) / Math.max(...lines.map((l) => l.length)) * 1.72);
  if (fit && fit.fsMul) fs *= fit.fsMul;
  g.font = `${font} ${fs}px 'Noto Sans Devanagari', Arial`;
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
// soft radial pool disc (brightest at source, soft falloff — never a hard circle)
const softDisc = (radius, color, opacity) => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 2, 64, 64, 63);
  grd.addColorStop(0, 'rgba(255,255,255,0.85)'); grd.addColorStop(0.45, 'rgba(255,255,255,0.28)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.CircleGeometry(radius, 24), new THREE.MeshBasicMaterial({ map: t, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.rotation.x = -Math.PI / 2; m.userData.ndSkip = true; return m;
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

// ---------- materials (v4: real painted surfaces, no flat emissive) ----------
const MAT = {
  quay: texM(M4.groundDetail(P.stone(64, 40, 5, 58), 191, { dots: 1200 }), 10, 10, '#8a93a6'),
  stone: texM(M4.stoneV4(8), 3, 2, '#7d8290'), stoneDk: texM(M4.stoneV4(9), 3, 2, '#5d6270'),
  wood: texM(M4.woodV4(4), 1, 2), woodDk: texM(M4.woodV4(6), 1, 2),
  plaster: texM(P.plaster(71, 36), 2, 2, '#6a7086'),
  weave: texM(P.weave(83, '#8a6f42'), 2, 2),
  hullBlue: texM(M4.woodV4(11, { base: '#3a5a7a', dark: '#24384e' }), 1, 2),
  hullRed: texM(M4.woodV4(12, { base: '#7a3a30', dark: '#4e241e' }), 1, 2),
  lanternGlass: M4.glassMatV4(envMap, 0.55),
  lanternMetal: new THREE.MeshStandardMaterial({ color: 0x2c2418, roughness: 0.5, metalness: 0.7, envMap, envMapIntensity: 0.8 }),
  fishMat: new THREE.MeshStandardMaterial({ color: 0x9fc4d8, roughness: 0.32, metalness: 0.65, envMap, envMapIntensity: 1.4 }),
  fishBelly: new THREE.MeshStandardMaterial({ color: 0xd8e8ee, roughness: 0.4, metalness: 0.4, envMap, envMapIntensity: 1.0 }),
  goldTrim: toon({ color: '#f0bc4a' }),
  crimson: toon({ color: '#7a1f2e' }), teal: toon({ color: '#1f4a4a' }),
  cloth: toon({ color: '#8a6f42' }), leaf: toon({ color: '#4a7a34' }),
  white: toon({ color: '#f7f3e6' }), dark: toon({ color: '#33302c' }),
  gull: toon({ color: '#eef2f4' }), gullWing: toon({ color: '#c9d4da' }),
};

// ---------- the harbour: quay, sea walls, buildings, lamps, board frame ----------
const world = new THREE.Group(); scene.add(world);
const lampGlows = [];
{
  const g = world;
  // the quay slab (top y=0) + edge trim
  add(tbox(28, 0.9, 11, 3), MAT.quay, 0, -0.45, 10.5, g, { cast: false });
  add(tbox(28, 0.12, 0.5, 3), MAT.stoneDk, 0, 0.02, 5.1, g, { cast: false });
  // sea walls flanking the slipway gap (x -4..5) where the boats moor
  add(tbox(10, 0.9, 0.8, 2), MAT.stoneDk, -9, 0.45, 4.8, g, { cast: false });
  add(tbox(9, 0.9, 0.8, 2), MAT.stoneDk, 9.5, 0.45, 4.8, g, { cast: false });
  // slipway ramp down into the water (boats slide out through the gap)
  const ramp = add(tbox(9, 0.16, 3.4, 2), MAT.stone, 0.5, -0.55, 4.2, g, { cast: false });
  ramp.rotation.x = 0.32;
  // harbour buildings (north, z~16): plaster + stone, dark windows, warm lamps
  add(tbox(6, 4.4, 1.6, 2), MAT.plaster, -9, 2.2, 15.8, g, { cast: false });
  add(tbox(7, 5.2, 1.6, 2), MAT.stone, 0, 2.6, 16, g, { cast: false });
  add(tbox(5, 4.0, 1.6, 2), MAT.plaster, 9, 2.0, 15.8, g, { cast: false });
  for (const [bx, by, bw] of [[-9, 4.6, 6.4], [0, 5.5, 7.4], [9, 4.2, 5.4]]) {
    const roof = add(new THREE.ConeGeometry(bw * 0.72, 1.4, 4), MAT.woodDk, bx, by + 0.7, 15.8, g, { cast: false });
    roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, 0.32);
  }
  for (const [wx, wy] of [[-10.5, 2.6], [-7.5, 2.6], [-2, 3.0], [2, 3.0], [7.5, 2.4], [10.5, 2.4]]) {
    const win = add(new THREE.PlaneGeometry(0.7, 0.9), MAT.dark, wx, wy, 14.95, g, { cast: false });
    win.rotation.y = Math.PI; // windows face the quay (cameras look +z; a plane's front is +z)
    const wg = softGlow(1.1, '#ffb347', 0.28); wg.position.set(wx, wy, 14.8); g.add(wg); lampGlows.push(wg);
  }
  // quay lamp posts (the warm pools on the quay) + board posts
  for (const px of [-11, 11]) {
    add(new THREE.CylinderGeometry(0.09, 0.12, 3.4, 7), MAT.woodDk, px, 1.7, 7.5, g, { cast: false });
    add(tbox(0.5, 0.4, 0.5, 1), MAT.lanternMetal, px, 3.5, 7.5, g, { cast: false });
    const lg = softGlow(2.2, '#ffb347', 0.5); lg.position.set(px, 3.4, 7.5); g.add(lg); lampGlows.push(lg);
    const pool = softDisc(1.5, 0xffb347, 0.5); pool.position.set(px, 0.03, 7.5); g.add(pool);
  }
  for (const px of [BOARD_POS[0] - 2.1, BOARD_POS[0] + 2.1]) add(new THREE.CylinderGeometry(0.06, 0.07, 3.3, 7), MAT.woodDk, px, 1.65, BOARD_POS[2], g, { cast: false });
  add(tbox(4.6, 0.12, 0.12, 2), MAT.woodDk, BOARD_POS[0], 3.9, BOARD_POS[2], g, { cast: false });
  // barrels, crate, coiled rope, draped net (quay dressing, all grounded)
  add(new THREE.CylinderGeometry(0.34, 0.38, 0.85, 10), MAT.woodDk, -8.5, 0.43, 13.5, g, { cast: false });
  add(new THREE.CylinderGeometry(0.34, 0.38, 0.85, 10), MAT.wood, -7.6, 0.43, 13.2, g, { cast: false });
  add(tbox(0.9, 0.7, 0.9, 2), MAT.wood, 8.5, 0.35, 13.8, g, { cast: false });
  const rope = add(new THREE.TorusGeometry(0.42, 0.09, 8, 20), MAT.weave, -6, 0.1, 9, g, { cast: false });
  rope.rotation.x = Math.PI / 2;
  // a draped net is double-sided (it is seen from both faces as it hangs)
  const netMat = MAT.weave.clone(); netMat.side = THREE.DoubleSide;
  const net = add(new THREE.PlaneGeometry(2.3, 1.5, 6, 4), netMat, 8.5, 0.75, 13.8, g, { cast: false });
  net.rotation.set(-0.5, 0.4, 0.15);
  // mooring post + distant masts over the dark water (each mast has a hull
  // at the waterline, so it never reads as a floating pole)
  add(new THREE.CylinderGeometry(0.14, 0.17, 1.2, 7), MAT.woodDk, -12.5, 0.6, 11, g, { cast: false });
  for (const [mx, mz] of [[-10, -14], [8, -18]]) {
    add(new THREE.CylinderGeometry(0.05, 0.06, 6, 6), MAT.woodDk, mx, 2, mz, g, { cast: false });
    add(new THREE.BoxGeometry(2.2, 0.5, 0.9), MAT.hullRed, mx, -1.0, mz, g, { cast: false });
    const mg = softGlow(1.4, '#ffd9a0', 0.3); mg.position.set(mx, 5.2, mz); g.add(mg); lampGlows.push(mg);
  }
}

// ---------- the sea (v4 shader water, night colours, sparkle glints) ----------
const water = FX.makeWater({ size: 800, seg: 72, deep: 0x081826, shallow: 0x14486b, sky: 0x1c3355, amp: 0.3, spark: 0.8 });
water.position.y = WATER_Y; world.add(water);

// ---------- the boats (rowing boats, built from real parts) ----------
const mkBoat = (len, hullMat, withPole) => {
  const g = new THREE.Group(); world.add(g);
  add(new THREE.BoxGeometry(len, 0.55, 1.05), hullMat, 0, 0.1, 0, g, { cast: false });
  const bow = add(new THREE.ConeGeometry(0.52, 1.0, 4), hullMat, len / 2 + 0.45, 0.1, 0, g, { cast: false });
  bow.rotation.z = -Math.PI / 2; bow.rotation.y = Math.PI / 4; bow.scale.set(1, 1, 0.55);
  const stern = add(new THREE.ConeGeometry(0.5, 0.7, 4), hullMat, -len / 2 - 0.3, 0.1, 0, g, { cast: false });
  stern.rotation.z = Math.PI / 2; stern.rotation.y = Math.PI / 4; stern.scale.set(1, 1, 0.55);
  add(new THREE.BoxGeometry(len - 0.3, 0.1, 0.85), MAT.woodDk, -0.05, 0.42, 0, g, { cast: false });
  for (const bx of [-len / 2 + 0.5, 0.1, len / 2 - 0.6])
    add(new THREE.BoxGeometry(0.28, 0.08, 0.9), MAT.wood, bx, 0.3, 0, g, { cast: false });
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(len, 0.09, 0.07), MAT.woodDk, 0, 0.4, s * 0.52, g, { cast: false });
  if (withPole) {
    // stern lantern pole + arm reaching over the water side (z +0.85)
    add(new THREE.CylinderGeometry(0.045, 0.05, 1.7, 7), MAT.woodDk, -1.0, 0.85, 0.35, g, { cast: false });
    const arm = add(new THREE.CylinderGeometry(0.035, 0.035, 0.55, 6), MAT.woodDk, -1.0, 1.68, 0.6, g, { cast: false });
    arm.rotation.x = Math.PI / 2;
  }
  return g;
};
const boat1G = mkBoat(2.6, MAT.hullBlue, true);
const boat2G = mkBoat(3.4, MAT.hullRed, false);

// ---------- THE LANTERN (hero prop: metal cap + v4 glass + warm flame) ----------
const lanternG = new THREE.Group(); world.add(lanternG);
add(new THREE.ConeGeometry(0.16, 0.14, 8), MAT.lanternMetal, 0, 0.3, 0, lanternG);
add(new THREE.CylinderGeometry(0.13, 0.15, 0.34, 10), MAT.lanternGlass, 0, 0.08, 0, lanternG);
add(new THREE.CylinderGeometry(0.16, 0.14, 0.06, 10), MAT.lanternMetal, 0, -0.12, 0, lanternG);
add(new THREE.TorusGeometry(0.1, 0.02, 6, 12), MAT.lanternMetal, 0, 0.42, 0, lanternG).rotation.x = Math.PI / 2;
const lanternGlow = softGlow(1.7, '#ffb347', 0.7); lanternG.add(lanternGlow);
const lanternLine = add(new THREE.CylinderGeometry(0.012, 0.012, 1, 4), MAT.dark, 0, 0, 0, world, { cast: false });
// warm pool the lantern throws on the water (brightest at the source)
const lanternPool = softDisc(1.7, 0xffb347, 0.3); lanternPool.position.set(0, WATER_Y + 0.06, 0); world.add(lanternPool);

// ---------- THE BASKET (woven, with rim + handles; the fish land IN it) ----------
// the basket gets its own LIGHT weave material + a warm lantern kiss, so it
// never reads as a black pot in the Night Lamp grade.
const basketMat = texM(P.weave(83, '#a8824e'), 2, 2, '#e8d8b0');
const basketG = new THREE.Group(); world.add(basketG);
// open-ended: the top cap would face the dark night sky and read as a
// black hole; the woven floor below is the visible bottom instead.
add(new THREE.CylinderGeometry(0.32, 0.24, 0.4, 12, 1, true), basketMat, 0, 0.2, 0, basketG);
// woven floor inside the basket (without it the open cylinder reads as a black hole from above)
// unlit warm weave: the night hemi lights an upward face with the dark sky colour,
// so a lit floor would still read black — the basic material keeps it straw-warm.
const basketFloor = add(new THREE.CircleGeometry(0.3, 12), new THREE.MeshBasicMaterial({ map: P.tex(P.weave(83, '#a8824e'), 2, 2), color: '#e8d8b0' }), 0, 0.36, 0, basketG);
basketFloor.rotation.x = -Math.PI / 2;
add(new THREE.TorusGeometry(0.32, 0.035, 8, 20), MAT.woodDk, 0, 0.4, 0, basketG).rotation.x = Math.PI / 2;
for (const s of [-1, 1]) {
  const hd = add(new THREE.TorusGeometry(0.12, 0.025, 6, 12, Math.PI), MAT.woodDk, s * 0.3, 0.42, 0, basketG);
  hd.rotation.z = s * Math.PI / 2;
}
const basketGlow = softGlow(1.0, '#ffb347', 0.3); basketGlow.position.set(0, 0.5, 0); basketG.add(basketGlow);

// ---------- THE FISH (silver-blue, built from real parts: body + tail + fin) ----------
const fishGs = [];
for (let i = 0; i < 6; i++) {
  const fg = new THREE.Group(); fg.rotation.order = 'YXZ'; world.add(fg);
  const body = add(new THREE.SphereGeometry(0.14, 16, 10), MAT.fishMat, 0, 0, 0, fg);
  body.scale.set(1.6, 0.55, 0.42);
  const belly = add(new THREE.SphereGeometry(0.13, 14, 8), MAT.fishBelly, 0.01, -0.025, 0, fg);
  belly.scale.set(1.5, 0.4, 0.36);
  const tail = add(new THREE.ConeGeometry(0.065, 0.14, 4), MAT.fishMat, -0.26, 0, 0, fg);
  tail.rotation.z = Math.PI / 2; tail.scale.set(1, 1, 0.4);
  const fin = add(new THREE.ConeGeometry(0.035, 0.08, 4), MAT.fishMat, 0.02, 0.085, 0, fg);
  fin.scale.set(1, 1, 0.35);
  for (const s of [-1, 1]) add(new THREE.SphereGeometry(0.012, 6, 5), MAT.dark, 0.18, 0.025, s * 0.035, fg);
  fg.visible = false; fishGs.push(fg);
}
// splash rings where fish leave the water + landing glows where they fall
const splashRings = FISH_TAKE.map(([tx, tz]) => {
  const r = flat(add(new THREE.RingGeometry(0.3, 0.42, 24), new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }), tx, WATER_Y + 0.08, tz, world, { cast: false }));
  r.userData.ndSkip = true; return r;
});
const landGlows = fishGs.map(() => {
  const s = softGlow(0.9, '#dff2ff', 0); world.add(s); return s;
});

// ---------- boards (transforms mirrored in boards.json — keep in sync) ----------
// the boards face SOUTH (-z, ry=PI): every camera looks at them from the
// quay/sea side, and a plane's front face is +z — at ry=0 the cameras see
// the culled back face and the board is invisible (the lavender rect was
// only the ND occluder showing through).
const boardTitle = textBoard(['वो मछुआरा जिसने', 'बिना जाल के मछली पकड़ी'], 4.6, 1.2, '#12203a', '#ffd76a', 900, { fsMul: 0.85, pitch: 0.40, dy: 0.02 });
boardTitle.position.set(...BOARD_POS); boardTitle.rotation.y = Math.PI; world.add(boardTitle); addBoardOccluder(boardTitle, 4.6, 1.2, 'boardTitle');
const boardHook = textBoard(['पर एक नानबाई ने', 'पूरे गाँव के लिए ताज़ी रोटी', 'सेंकी — बिना भट्ठी के।', 'रोटी कैसे सेंकी जाती है?'], 4.6, 1.5, '#2e1a3a', '#ffd76a', 900, { pitch: 0.21, fsMul: 0.93 });
boardHook.position.set(...BOARD_POS); boardHook.rotation.y = Math.PI; world.add(boardHook); addBoardOccluder(boardHook, 4.6, 1.5, 'boardHook');

// ---------- FX: night mist over the water + quay dust motes + clouds + gulls ----------
// (living elements in every shot: mist drifts, water shimmers, gulls circle)
const smoke = new FX.Smoke(scene, 160); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const mistEmit = smoke.addEmitter(-1, -0.8, -6, { rate: 0, color: 0x8fa8c8, opacity: 0.10, scale: 1.4, grow: 1.6, life: 3.2, vy: 0.06, wind: 0.15 });
const dustEmit = smoke.addEmitter(0, 1.1, 10, { rate: 0.15, color: 0xffe2b8, opacity: 0.06, scale: 0.5, grow: 1.2, life: 2.4, vy: 0.12, wind: 0.12 });
const fxClouds = new FX.Clouds(scene, { count: 6, y: 46, opacity: 0.3, color: 0x2a3a55, drift: 0.5 });
fxClouds.items.forEach((cl) => { cl.userData.x0 = cl.position.x; cl.traverse((m) => { m.userData.ndSkip = true; }); });
const gulls = [];
const gullWingMat = MAT.gullWing.clone(); gullWingMat.side = THREE.DoubleSide; // wings are seen from below as the gulls circle
for (let i = 0; i < 2; i++) {
  const grp = new THREE.Group(); scene.add(grp);
  const body = add(new THREE.ConeGeometry(0.09, 0.5, 6), MAT.gull, 0, 0, 0, grp, { cast: false });
  body.rotation.x = Math.PI / 2;
  const wingL = add(new THREE.PlaneGeometry(0.55, 0.2), gullWingMat, -0.3, 0, 0, grp, { cast: false });
  const wingR = add(new THREE.PlaneGeometry(0.55, 0.2), gullWingMat, 0.3, 0, 0, grp, { cast: false });
  wingL.userData.ndSkip = true; wingR.userData.ndSkip = true;
  gulls.push({ grp, wingL, wingR });
}
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
    mistEmit.rate = pr.smokeRate * 3;
    dustEmit.rate = pr.dustRate * 3;
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
  // THE BOATS ride the story: moored at the quay, then rowed out to the
  // dark water; gentle bob + roll once at sea, never on the quay.
  boat1G.position.set(Ws.boat1X, Ws.boat1Y, Ws.boat1Z);
  boat1G.rotation.set(0, Ws.boat1Yaw, f >= 478 ? Math.sin(f * 0.017) * 0.02 : 0);
  boat2G.position.set(Ws.boat2X, Ws.boat2Y, Ws.boat2Z);
  boat2G.rotation.set(0, Ws.boat2Yaw, f >= 478 ? Math.sin(f * 0.015 + 1.7) * 0.02 : 0);
  // THE LANTERN hangs from its pole arm on a real line: the line is drawn
  // from the arm tip to the lantern every frame, so it never floats.
  lanternG.position.set(Ws.lanternX, Ws.lanternY, Ws.lanternZ);
  lanternG.rotation.z = Ws.lanternSwing || 0;
  const flick = 0.86 + 0.09 * Math.sin(f * 0.13) + 0.05 * Math.sin(f * 0.31);
  lanternGlow.material.opacity = 0.7 * (Ws.lanternGlow || 0) * flick;
  const [ptx, ptz] = boat1Local(f, -1.0, 0.85);
  const poleTop = _va.set(ptx, Ws.boat1Y + 1.68, ptz);
  const lampPos = _vb.set(Ws.lanternX, Ws.lanternY + 0.42, Ws.lanternZ);
  const lineLen = poleTop.distanceTo(lampPos);
  lanternLine.position.copy(poleTop).add(lampPos).multiplyScalar(0.5);
  lanternLine.scale.set(1, Math.max(0.01, lineLen), 1);
  lanternLine.quaternion.setFromUnitVectors(_up, lampPos.clone().sub(poleTop).normalize());
  lanternLine.visible = lineLen > 0.03;
  // warm pool on the water under the lantern (brightest at the source)
  lanternPool.position.set(Ws.lanternX, WATER_Y + 0.06, Ws.lanternZ);
  lanternPool.material.opacity = 0.3 * (Ws.lanternGlow || 0) * flick;
  // THE BASKET rides the story: quay -> carried aboard -> rests in the
  // boat -> lifted with effort and held through the payoff line.
  basketG.position.set(Ws.basketX, Ws.basketY, Ws.basketZ);
  basketG.rotation.y = f < 348 ? 0 : Ws.boat1Yaw;
  // THE FISH: ballistic arcs, then landed and staying where they fell
  const states = fishStatesAt(f);
  for (let i = 0; i < 6; i++) {
    const st = states[i], fg = fishGs[i];
    fg.visible = st.vis === 1;
    if (!fg.visible) continue;
    fg.position.set(st.x, st.y, st.z);
    fg.rotation.y = st.yaw || 0; fg.rotation.z = st.pitch || 0;
  }
  // splash rings where fish leave the water; landing glows where they fall
  for (let i = 0; i < 6; i++) {
    const rk = (Ws.splashRings || [])[i] || 0;
    const ring = splashRings[i];
    ring.visible = rk > 0.01;
    if (ring.visible) { ring.scale.setScalar(0.6 + rk * 2.4); ring.material.opacity = (1 - rk) * 0.65; }
    const lk = (Ws.splashLands || [])[i] || 0;
    const lg = landGlows[i], st = states[i];
    lg.material.opacity = lk * 0.7;
    lg.visible = lk > 0.02 && st.vis === 1;
    if (lg.visible) lg.position.set(st.x, st.y + 0.1, st.z);
  }
  // gulls circle the harbour (living sky in every wide shot)
  gulls.forEach((gl, i) => {
    const a = f * 0.0075 * (i % 2 ? -1 : 1) + i * 1.93;
    gl.grp.position.set(Math.cos(a) * 9.5, 11 + Math.sin(f * 0.013 + i * 2.4) * 0.7, 8 + Math.sin(a) * 9.5);
    gl.grp.rotation.y = Math.atan2(Math.cos(a) * (i % 2 ? -1 : 1), -Math.sin(a) * (i % 2 ? -1 : 1)) + (i % 2 ? Math.PI : 0);
    const flap = 0.25 + 0.55 * Math.sin(f * 0.32 + i * 1.3);
    gl.wingL.rotation.z = flap; gl.wingR.rotation.z = -flap;
  });
  // quay lamps breathe almost imperceptibly (never a dead frame)
  lampGlows.forEach((lg, i) => { lg.material.opacity = lg.userData.base ?? (lg.userData.base = lg.material.opacity); lg.material.opacity = lg.userData.base * (0.94 + 0.06 * Math.sin(f * 0.05 + i * 1.7)); });
  water.userData.update(f / 30);
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
