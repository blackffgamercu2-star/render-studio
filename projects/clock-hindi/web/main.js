import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import * as PR from './props.js';
import * as M4 from './materials.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, BOARD_POS, TOWER, SUNDIAL, WATER, LEDGE } from './story.js';
import { WORDS } from './words.js';

const W = 1080, H = 1920;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
const envMap = FX.detailEnv(renderer);
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
const softGlow = (scale, color, opacity) => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 1, 32, 32, 31);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)'); grd.addColorStop(0.4, 'rgba(255,255,255,0.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(scale); s.userData.ndSkip = true; return s;
};

// ---------- canvas-painted dial: numerals + PAINTED hands (brush strokes) ----------
const dialCanvas = (() => {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), cx = S / 2, cy = S / 2;
  // aged wooden board planks under the paint
  g.fillStyle = '#c9b489'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 7; i++) { g.fillStyle = i % 2 ? 'rgba(120,90,50,0.10)' : 'rgba(255,240,200,0.08)'; g.fillRect(0, i * S / 7, S, S / 7); g.fillStyle = 'rgba(80,60,30,0.35)'; g.fillRect(0, i * S / 7, S, 3); }
  // dial face
  g.beginPath(); g.arc(cx, cy, 470, 0, 7); g.fillStyle = '#e8dfc8'; g.fill();
  g.lineWidth = 16; g.strokeStyle = '#4a3826'; g.stroke();
  g.beginPath(); g.arc(cx, cy, 408, 0, 7); g.lineWidth = 5; g.strokeStyle = 'rgba(74,56,38,0.7)'; g.stroke();
  // minute ticks
  for (let i = 0; i < 60; i++) {
    const a = i / 60 * Math.PI * 2, big = i % 5 === 0;
    const r0 = big ? 356 : 378, r1 = 402;
    g.beginPath(); g.moveTo(cx + Math.sin(a) * r0, cy - Math.cos(a) * r0); g.lineTo(cx + Math.sin(a) * r1, cy - Math.cos(a) * r1);
    g.lineWidth = big ? 11 : 4; g.strokeStyle = '#3a2c1c'; g.stroke();
  }
  // Devanagari numerals at 12 / 3 / 6 / 9
  g.fillStyle = '#33261a'; g.font = `900 118px 'Noto Sans Devanagari', Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('१२', cx, cy - 268); g.fillText('३', cx + 272, cy + 6); g.fillText('६', cx, cy + 282); g.fillText('९', cx - 272, cy + 6);
  // PAINTED hands, both at 12 — rough brush strokes, flat paint, one drip
  const hand = (len, wdt) => {
    g.save(); g.translate(cx, cy); g.fillStyle = '#2c2016';
    g.beginPath();
    const j = () => (Math.random() - 0.5) * 7;
    g.moveTo(-wdt / 2 + j(), 26); g.lineTo(-wdt * 0.22 + j(), -len); g.lineTo(0 + j(), -len - 26); g.lineTo(wdt * 0.22 + j(), -len); g.lineTo(wdt / 2 + j(), 26); g.closePath(); g.fill();
    g.restore();
  };
  hand(238, 44);           // hour hand (short, fat)
  hand(330, 30);           // minute hand (long) — also straight up: 12:00 forever
  // a paint drip frozen under the minute hand + brush bristle streaks
  g.fillStyle = 'rgba(44,32,22,0.85)'; g.fillRect(cx - 5, cy - 330, 10, 44);
  g.beginPath(); g.arc(cx, cy - 282, 9, 0, 7); g.fill();
  for (let i = 0; i < 26; i++) { g.strokeStyle = `rgba(255,252,240,${0.05 + Math.random() * 0.06})`; g.lineWidth = 2; const y = cy - 330 + Math.random() * 300; g.beginPath(); g.moveTo(cx - 16 + Math.random() * 8, y); g.lineTo(cx + 12, y + 14); g.stroke(); }
  // centre boss (painted too)
  g.beginPath(); g.arc(cx, cy, 34, 0, 7); g.fillStyle = '#2c2016'; g.fill();
  g.beginPath(); g.arc(cx, cy, 34, 0, 7); g.lineWidth = 5; g.strokeStyle = '#6a4a26'; g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
})();
// sundial slab top: hour lines + numerals + the gold BELL mark
const sundialCanvas = (() => {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 384;
  const g = c.getContext('2d');
  g.fillStyle = '#b7ab93'; g.fillRect(0, 0, 1024, 384);
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(70,60,45,${Math.random() * 0.08})`; g.fillRect(Math.random() * 1024, Math.random() * 384, 3, 2); }
  g.strokeStyle = '#4c4132'; g.lineWidth = 5; g.strokeRect(14, 14, 996, 356);
  const nums = ['६', '७', '८', '९', '१०', '११', '१२'];
  g.fillStyle = '#3c3226'; g.font = `900 64px 'Noto Sans Devanagari', Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < 7; i++) {
    const x = 110 + i * 134;
    g.beginPath(); g.moveTo(x, 60); g.lineTo(x, 300); g.lineWidth = i === 3 ? 8 : 4; g.strokeStyle = '#4c4132'; g.stroke();
    g.fillText(nums[i], x, 338);
  }
  // the BELL mark (the 6-o'clock line the keeper watches) in gold
  g.beginPath(); g.moveTo(110, 52); g.lineTo(110, 308); g.lineWidth = 13; g.strokeStyle = '#c8922a'; g.stroke();
  g.beginPath(); g.arc(110, 46, 15, 0, 7); g.fillStyle = '#c8922a'; g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
})();

const MAT = {
  plaza: texM(M4.groundDetail(P.stone(64, 40, 5, 58), 191, { dots: 1400 }), 11, 11, '#c6bda6'),
  stone: texM(M4.stoneV4(8), 3, 2, '#bfb298'), stoneDk: texM(M4.stoneV4(9), 3, 2, '#9a8f7a'),
  towerStone: texM(M4.stoneV4(11), 2.2, 3.4, '#b5a78d'),
  wood: texM(M4.woodV4(4), 1, 2), woodDk: texM(M4.woodV4(6), 1, 2), woodOld: texM(M4.woodV4(9), 1, 2, '#9a8a76'),
  plaster: texM(P.plaster(71, 36), 2, 2, '#a89a82'), plasterPink: texM(P.plaster(73, 36), 2, 2, '#a88a72'),
  brass: new THREE.MeshStandardMaterial({ color: 0xa87f2e, roughness: 0.38, metalness: 0.85, envMap, envMapIntensity: 1.1 }),
  iron: new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.55, metalness: 0.7, envMap, envMapIntensity: 0.7 }),
  clay: toon({ color: '#9a5f3d' }), clayDk: toon({ color: '#7c4a2e' }),
  copper: new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.42, metalness: 0.8, envMap, envMapIntensity: 0.9 }),
  water: new THREE.MeshStandardMaterial({ color: 0x5d7d84, roughness: 0.15, metalness: 0.1, envMap, envMapIntensity: 1.2 }),
  dial: new THREE.MeshBasicMaterial({ map: dialCanvas, fog: true }),
  slab: toon({ map: sundialCanvas }),
  shadowBlade: new THREE.MeshBasicMaterial({ color: 0x14161c, transparent: true, opacity: 0.42, depthWrite: false, fog: false }),
  dark: toon({ color: '#2e2a26' }), hollow: new THREE.MeshBasicMaterial({ color: 0x0d0b09, fog: false }),
  leaf: toon({ color: '#5d7355' }), leafDk: toon({ color: '#4c6047' }),
  roof: toon({ color: '#6e4a38' }), roofTeal: toon({ color: '#3f5a58' }),
  cloth: toon({ color: '#7d6a4c' }), rope: new THREE.MeshBasicMaterial({ color: 0xbfa678, fog: true }), white: toon({ color: '#e9e4d6' }),
  newClock: new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.22, metalness: 0.9, envMap, envMapIntensity: 1.4 }),
};

// ---------- the village square ----------
const world = new THREE.Group(); scene.add(world);
{
  const g = world;
  const plaza = flat(add(new THREE.CircleGeometry(32, 48), MAT.plaza, 0, 0, 2, g, { cast: false }));
  plaza.scale.set(1.15, 1, 1);
  // damp darker ring paths (monsoon-wet stone)
  const path = flat(add(new THREE.RingGeometry(2.2, 3.4, 40), MAT.stoneDk, 0, 0.008, 0, g, { cast: false })); path.material = MAT.stoneDk;

  // ===== THE CLOCK TOWER (north, front faces +z) =====
  const T = TOWER; // {x:0, z:-10}
  add(tbox(5.6, 6.2, 5.6, 3), MAT.towerStone, T.x, 3.1, T.z, g, { cast: false });
  add(tbox(5.0, 3.0, 5.0, 3), MAT.towerStone, T.x, 7.7, T.z, g, { cast: false });
  add(tbox(6.1, 0.42, 6.1, 3), MAT.stoneDk, T.x, 6.35, T.z, g, { cast: false });
  add(tbox(5.5, 0.4, 5.5, 3), MAT.stoneDk, T.x, 9.35, T.z, g, { cast: false });
  // plinth + base door (keeper's little door)
  add(tbox(6.4, 0.5, 6.4, 3), MAT.stoneDk, T.x, 0.25, T.z, g, { cast: false });
  add(tbox(1.1, 2.1, 0.12, 2), MAT.woodDk, T.x + 1.3, 1.05, T.z + 2.83, g, { cast: false });
  add(new THREE.SphereGeometry(0.06, 8, 6), MAT.brass, T.x + 1.62, 1.05, T.z + 2.92, g, { cast: false });
  // bell chamber: 4 posts + pyramid roof; bell inside, open to the south
  for (const [px, pz] of [[-1.9, -1.9], [1.9, -1.9], [-1.9, 1.9], [1.9, 1.9]])
    add(tbox(0.42, 1.9, 0.42, 2), MAT.towerStone, T.x + px, 10.5, T.z + pz, g, { cast: false });
  const roof = add(new THREE.ConeGeometry(4.1, 2.0, 4), MAT.roof, T.x, 12.45, T.z, g, { cast: false });
  roof.rotation.y = Math.PI / 4;
  add(new THREE.SphereGeometry(0.17, 8, 6), MAT.brass, T.x, 13.6, T.z, g, { cast: false });
  add(tbox(4.2, 0.3, 0.3, 2), MAT.woodDk, T.x, 11.32, T.z, g, { cast: false }); // bell beam
  // the hollow behind the face: a dark empty cavity (no gears, ever)
  add(box(3.3, 3.3, 0.5), MAT.hollow, T.x, 7.55, T.z + 2.28, g, { cast: false });
  add(tbox(2.6, 0.09, 0.4, 2), MAT.woodOld, T.x - 0.2, 6.6, T.z + 2.45, g, { cast: false }); // one dusty shelf
  // ledge the clockmaker stands on + brackets
  add(tbox(LEDGE.w, 0.14, LEDGE.d, 2), MAT.wood, LEDGE.x, LEDGE.y - 0.07, LEDGE.z, g, { cast: false });
  for (const bx of [-1.3, 1.3]) { const br = add(tbox(0.14, 1.1, 0.14, 2), MAT.woodDk, LEDGE.x + bx, LEDGE.y - 0.6, LEDGE.z + 0.3, g, { cast: false }); br.rotation.x = 0.5; }
  // ladder leaning to the ledge
  const lad = new THREE.Group(); lad.position.set(0.9, 0, -5.15); lad.rotation.x = -0.185; g.add(lad);
  for (const lx of [-0.32, 0.32]) add(new THREE.CylinderGeometry(0.045, 0.045, 6.6, 6), MAT.woodDk, lx, 3.3, 0, lad, { cast: false });
  for (let i = 0; i < 9; i++) { const r = add(new THREE.CylinderGeometry(0.035, 0.035, 0.64, 6), MAT.wood, 0, 0.55 + i * 0.68, 0, lad, { cast: false }); r.rotation.z = Math.PI / 2; }

  // ===== village houses (extruded pentagon profiles) =====
  const house = (x, z, ry, w, hWall, hRoof, wallMat, roofMat) => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, hWall); s.lineTo(0, hWall + hRoof); s.lineTo(-w / 2, hWall); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: w * 0.82, bevelEnabled: false });
    const m = add(geo, wallMat, x, 0, z, g, { cast: false }); m.rotation.y = ry;
    const rf = add(tbox(w * 1.12, 0.14, w * 0.55, 2), roofMat, 0, 0, 0, g, { cast: false });
    rf.position.set(x, hWall + hRoof * 0.52, z); rf.rotation.y = ry; rf.rotation.x = 0; rf.visible = false; // profile already includes roof mass; skip slab
    add(tbox(0.9, 1.7, 0.1, 2), MAT.woodDk, x, 0.85, z + (w * 0.82) / 2 + 0.36, g, { cast: false }).rotation.y = ry;
    return m;
  };
  house(-11.5, -6.5, 0.5, 4.6, 2.6, 1.5, MAT.plaster, MAT.roof);
  house(11.8, -7.5, -0.45, 5.2, 2.8, 1.6, MAT.plasterPink, MAT.roofTeal);
  house(-12.5, 3.5, 1.15, 4.2, 2.4, 1.4, MAT.plasterPink, MAT.roof);
  house(12.6, 4.5, -1.2, 4.4, 2.5, 1.5, MAT.plaster, MAT.roof);
  // the shop (west): counter + awning + crates + hanging scale
  const shop = new THREE.Group(); shop.position.set(-8.6, 0, 5.2); shop.rotation.y = 0.85; g.add(shop);
  add(tbox(3.4, 0.95, 1.1, 2), MAT.wood, 0, 0.48, 0, shop, { cast: false });
  for (const px of [-1.55, 1.55]) add(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 6), MAT.woodDk, px, 1.25, 0.4, shop, { cast: false });
  const awn = add(tbox(3.7, 0.07, 1.7, 2), MAT.cloth, 0, 2.5, 0.45, shop, { cast: false }); awn.rotation.x = 0.18;
  for (const [cx, cz, s] of [[-1.1, 0.75, 0.5], [-0.45, 0.8, 0.42], [1.2, 0.7, 0.55]])
    add(tbox(s, s, s, 2), MAT.wood, cx, s / 2, cz, shop, { cast: false });
  add(new THREE.SphereGeometry(0.3, 9, 7), MAT.clay, 0.5, 1.12, 0.1, shop, { cast: false });
  // big tree (east) — villagers gather in its shade
  add(new THREE.CylinderGeometry(0.34, 0.5, 2.6, 9), MAT.woodDk, 9.2, 1.3, -2.6, g, { cast: false });
  const can1 = add(new THREE.SphereGeometry(2.3, 11, 9), MAT.leaf, 9.2, 4.1, -2.6, g, { cast: false }); can1.scale.y = 0.78;
  const can2 = add(new THREE.SphereGeometry(1.6, 10, 8), MAT.leafDk, 7.9, 3.4, -2.2, g, { cast: false }); can2.scale.y = 0.8;
  const can3 = add(new THREE.SphereGeometry(1.5, 10, 8), MAT.leafDk, 10.6, 3.5, -3.1, g, { cast: false }); can3.scale.y = 0.8;
  // a low stone bench + scattered pots (square dressing, all resting)
  add(tbox(2.2, 0.42, 0.6, 2), MAT.stoneDk, -4.4, 0.21, 3.4, g, { cast: false });
  add(new THREE.SphereGeometry(0.26, 9, 7), MAT.clay, -5.6, 0.22, 3.1, g, { cast: false });
  add(new THREE.SphereGeometry(0.2, 9, 7), MAT.clayDk, -5.25, 0.17, 3.45, g, { cast: false });
  // board posts (title + hook boards share this frame)
  for (const px of [BOARD_POS[0] - 2.1, BOARD_POS[0] + 2.1]) add(new THREE.CylinderGeometry(0.06, 0.07, 3.3, 7), MAT.woodDk, px, 1.65, BOARD_POS[2], g, { cast: false });
  add(tbox(4.6, 0.12, 0.12, 2), MAT.woodDk, BOARD_POS[0], 3.9, BOARD_POS[2], g, { cast: false });
}

// ===== THE CLOCK FACE — a painted wooden board on a hinge =====
// Swings open (faceOpen) to show the hollow tower: no gears, no parts.
const faceG = new THREE.Group();
faceG.position.set(TOWER.x - 1.78, 7.55, TOWER.z + 2.62); world.add(faceG);
{
  const disc = add(new THREE.CircleGeometry(1.78, 40), MAT.dial, 1.78, 0, 0, faceG, { cast: false });
  const rim = add(new THREE.TorusGeometry(1.78, 0.09, 9, 40), MAT.woodDk, 1.78, 0, 0, faceG, { cast: false });
  const back = add(new THREE.CylinderGeometry(1.78, 1.78, 0.1, 40), MAT.woodOld, 1.78, 0, -0.07, faceG, { cast: false });
  back.rotation.x = Math.PI / 2;
  for (const hy of [-1.1, 1.1]) add(tbox(0.1, 0.34, 0.16, 2), MAT.iron, 0.02, hy, -0.02, faceG, { cast: false });
  const glow = softGlow(1.4, '#d8dee2', 0); glow.position.set(1.2, 0.9, 0.25); faceG.add(glow); faceG.userData.glow = glow;
}

// ===== THE BELL + rope =====
const bellG = new THREE.Group(); bellG.position.set(TOWER.x, 11.32, TOWER.z); world.add(bellG);
{
  const pts = [];
  pts.push(new THREE.Vector2(0.02, 0)); pts.push(new THREE.Vector2(0.16, -0.04)); pts.push(new THREE.Vector2(0.2, -0.18));
  pts.push(new THREE.Vector2(0.3, -0.42)); pts.push(new THREE.Vector2(0.46, -0.62)); pts.push(new THREE.Vector2(0.55, -0.68));
  pts.push(new THREE.Vector2(0.5, -0.74)); pts.push(new THREE.Vector2(0.34, -0.76));
  const bell = add(new THREE.LatheGeometry(pts, 22), MAT.brass, 0, 0, 0, bellG, { cast: false });
  add(new THREE.SphereGeometry(0.09, 8, 6), MAT.iron, 0, -0.82, 0, bellG, { cast: false });
  const gl = softGlow(1.1, '#e8ddba', 0); gl.position.set(0.3, -0.4, 0.3); bellG.add(gl); bellG.userData.glow = gl;
}
// rope: bell chamber down the tower face to the keeper's hands
const ropeUp = add(new THREE.CylinderGeometry(0.055, 0.055, 6.6, 8), MAT.rope, TOWER.x + 2.05, 7.6, TOWER.z + 2.75, world, { cast: false });
const ropeLo = add(new THREE.CylinderGeometry(0.055, 0.055, 3.4, 8), MAT.rope, TOWER.x + 2.05, 2.6, TOWER.z + 2.75, world, { cast: false });

// ===== THE SUNDIAL — long marked stone, gnomon, moving shadow =====
{
  const S = SUNDIAL; // {x, z, ry}
  const sg = new THREE.Group(); sg.position.set(S.x, 0, S.z); sg.rotation.y = S.ry; world.add(sg);
  add(tbox(4.9, 0.34, 1.6, 2), MAT.stoneDk, 0, 0.17, 0, sg, { cast: false });
  const top = add(new THREE.PlaneGeometry(4.7, 1.45), MAT.slab, 0, 0.345, 0, sg, { cast: false });
  top.rotation.x = -Math.PI / 2;
  // gnomon: a stone triangle standing at the west end, edge along the slab
  const tri = new THREE.Shape(); tri.moveTo(0, 0); tri.lineTo(1.15, 0); tri.lineTo(0, 0.85); tri.closePath();
  const gn = add(new THREE.ExtrudeGeometry(tri, { depth: 0.14, bevelEnabled: false }), MAT.stone, -1.95, 0.34, -0.07, sg, { cast: false });
  sg.userData.top = top;
  world.userData.sundial = sg;
}
const shadowG = new THREE.Group();
{
  const S = SUNDIAL;
  shadowG.position.set(S.x, 0, S.z); shadowG.rotation.y = S.ry; world.add(shadowG);
  // blade pivots at the gnomon tip's ground point (-1.95+0?, on the slab)
  const blade = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.34), MAT.shadowBlade);
  blade.rotation.x = -Math.PI / 2; blade.position.set(1.7, 0, 0);
  const pivot = new THREE.Group(); pivot.position.set(-1.9, 0.352, 0); pivot.add(blade); shadowG.add(pivot);
  shadowG.userData.pivot = pivot;
}

// ===== THE WATER CLOCK — pot drips into a marked bowl =====
const dripDrops = [], ripple = { mesh: null };
{
  const Wp = WATER; // {x, z}
  const wg = new THREE.Group(); wg.position.set(Wp.x, 0, Wp.z); wg.rotation.y = 0.5; world.add(wg);
  add(tbox(1.0, 0.08, 0.7, 2), MAT.wood, 0, 0.82, 0, wg, { cast: false });
  for (const [lx, lz] of [[-0.42, -0.28], [0.42, -0.28], [-0.42, 0.28], [0.42, 0.28]])
    add(new THREE.CylinderGeometry(0.04, 0.04, 0.82, 6), MAT.woodDk, lx, 0.41, lz, wg, { cast: false });
  const pot = add(new THREE.SphereGeometry(0.34, 14, 11), MAT.clay, 0, 1.08, 0, wg, { cast: false }); pot.scale.y = 0.88;
  add(new THREE.TorusGeometry(0.2, 0.035, 7, 16), MAT.clayDk, 0, 1.34, 0, wg, { cast: false }).rotation.x = Math.PI / 2;
  add(tbox(0.7, 0.3, 0.7, 2), MAT.woodDk, 0, 0.15, 0, wg, { cast: false });
  const bowl = add(new THREE.CylinderGeometry(0.42, 0.3, 0.3, 16, 1, true), MAT.copper, 0, 0.45, 0, wg, { cast: false });
  bowl.material = MAT.copper;
  const wtr = add(new THREE.CircleGeometry(0.38, 16), MAT.water, 0, 0.56, 0, wg, { cast: false }); wtr.rotation.x = -Math.PI / 2;
  // level marks on a little stick in the bowl
  add(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 5), MAT.woodDk, 0.24, 0.6, 0, wg, { cast: false });
  for (let i = 0; i < 3; i++) add(tbox(0.12, 0.02, 0.02, 1), MAT.white, 0.24, 0.48 + i * 0.13, 0.03, wg, { cast: false });
  for (let i = 0; i < 3; i++) {
    const d = add(new THREE.SphereGeometry(0.028, 7, 6), MAT.water, 0, 0.8, 0, wg, { cast: false });
    d.scale.y = 1.5; dripDrops.push(d);
  }
  const rip = add(new THREE.TorusGeometry(0.1, 0.012, 6, 20), new THREE.MeshBasicMaterial({ color: 0xcfe2e6, transparent: true, opacity: 0, fog: false }), 0, 0.565, 0, wg, { cast: false });
  rip.rotation.x = Math.PI / 2; rip.userData.ndSkip = true; ripple.mesh = rip;
  world.userData.water = wg;
}

// ===== the clockmaker's crate with the NEW clock (refused at the end) =====
const crateG = new THREE.Group(); crateG.position.set(3.1, 0, 5.6); crateG.rotation.y = -0.4; world.add(crateG);
{
  add(tbox(1.15, 1.0, 1.15, 2), MAT.wood, 0, 0.5, 0, crateG, { cast: false });
  add(tbox(1.25, 0.1, 1.25, 2), MAT.woodDk, 0, 1.03, 0, crateG, { cast: false });
  const nc = add(new THREE.CylinderGeometry(0.42, 0.42, 0.14, 24), MAT.newClock, 0.15, 1.32, 0.1, crateG, { cast: false });
  nc.rotation.x = Math.PI / 2 - 0.35;
  const ncf = add(new THREE.CircleGeometry(0.36, 24), new THREE.MeshBasicMaterial({ map: dialCanvas, fog: true }), 0.15, 1.345, 0.16, crateG, { cast: false });
  ncf.rotation.x = -0.35;
  const gl = softGlow(0.8, '#eef2f4', 0.5); gl.position.set(0.15, 1.4, 0.3); crateG.add(gl); crateG.userData.glow = gl;
}

// ---------- boards (transforms mirrored in boards.json — keep in sync) ----------
const boardTitle = textBoard(['हमेशा सही बताने', 'वाली घड़ी'], 4.6, 1.2, '#26303a', '#ffe9a8', 900, { fsMul: 0.85, pitch: 0.40, dy: 0.04 });
boardTitle.position.set(...BOARD_POS); world.add(boardTitle); addBoardOccluder(boardTitle, 4.6, 1.2, 'boardTitle');
const boardHook = textBoard(['लेकिन कल... एक गाड़ी', 'बिना पहियों के पूरे गाँव में', 'कैसे दौड़ती थी?'], 4.6, 1.5, '#2e1a3a', '#ffd76a', 900, { pitch: 0.20, dy: 0.01 });
boardHook.position.set(...BOARD_POS); world.add(boardHook); addBoardOccluder(boardHook, 4.6, 1.5, 'boardHook');

// ---------- FX: monsoon dust/drizzle motes + heavy grey clouds ----------
const smoke = new FX.Smoke(scene, 140); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const dustEmit = smoke.addEmitter(0, 1.2, 2, { rate: 0.1, color: 0xcfd6da, opacity: 0.06, scale: 0.5, grow: 1.2, life: 2.6, vy: 0.1, wind: 0.3 });
const fxClouds = new FX.Clouds(scene, { count: 8, y: 44, opacity: 0.55, color: 0x9aa4ab, drift: 0.8 });
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
    dustEmit.rate = pr.smokeRate * 3;
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

// ---------- word-by-word captions (Salted Mine V3 signature) ----------
const capCanvas = document.createElement('canvas'); capCanvas.width = W; capCanvas.height = H;
const capG = capCanvas.getContext('2d');
const capTex = new THREE.CanvasTexture(capCanvas); capTex.colorSpace = THREE.SRGBColorSpace;
const capScene = fs(new THREE.MeshBasicMaterial({ map: capTex, transparent: true, toneMapped: false }));
let capKey = null;
const drawCaption = (f) => {
  const t = f / 30;
  let i = -1;
  for (let k = 0; k < WORDS.length; k++) { if (t >= WORDS[k].s) i = k; else break; }
  let word = '';
  if (i >= 0) word = WORDS[i].w;
  if (word === capKey) return;
  capKey = word;
  capG.clearRect(0, 0, W, H);
  if (word) {
    capG.font = '900 74px "Noto Sans Devanagari", Arial, sans-serif';
    capG.textAlign = 'center'; capG.textBaseline = 'middle'; capG.lineJoin = 'round';
    capG.lineWidth = 17; capG.strokeStyle = '#000000';
    const y = Math.round(H * 0.76);
    capG.strokeText(word, W / 2, y);
    capG.fillStyle = '#ffffff';
    capG.fillText(word, W / 2, y);
  }
  capTex.needsUpdate = true;
};

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
  scene.traverse((o) => { if (o.userData.isOccluder) o.visible = o.userData.boardKey === 'always' || (Ws[o.userData.boardKey] || 0) > 0.01; });
  // the painted face swings open on its hinge -> the hollow tower
  faceG.rotation.y = -(Ws.faceOpen || 0) * 1.02;
  faceG.userData.glow.material.opacity = (Ws.faceOpen || 0) * 0.22;
  // the bell swings when tolled
  const bs = Ws.bellSwing || 0;
  bellG.rotation.x = bs * Math.sin(f * 0.31) * 0.5;
  bellG.userData.glow.material.opacity = Math.abs(bs) * 0.35;
  // the rope's lower run rides the keeper's pull
  const pull = Ws.ropePull || 0;
  ropeLo.position.y = 2.6 - pull * 0.38;
  ropeLo.scale.y = 1 + pull * 0.1;
  // the sundial shadow creeps across the hour marks
  const sk = Ws.shadowK || 0;
  shadowG.userData.pivot.rotation.y = -0.62 + sk * 1.05;
  shadowG.visible = (Ws.shadowVis ?? 1) > 0.02;
  MAT.shadowBlade.opacity = 0.42 * (Ws.shadowVis ?? 1);
  // the water clock drips (visible mainly on the cloudy beat)
  const wk = Ws.waterK || 0, wg = world.userData.water;
  wg.visible = wk > 0.01;
  if (wg.visible) {
    const ph = (f % 26) / 26;
    dripDrops.forEach((d, i) => {
      const u = (ph + i / 3) % 1;
      d.position.y = 0.78 - u * 0.24;
      d.visible = u < 0.92;
      d.scale.set(1, 1 + u * 1.6, 1);
    });
    const ru = ph;
    ripple.mesh.scale.setScalar(0.5 + ru * 2.6);
    ripple.mesh.material.opacity = (1 - ru) * 0.55 * wk;
  }
  crateG.visible = (Ws.crateK || 0) > 0.01;
  if (crateG.visible) crateG.userData.glow.material.opacity = 0.3 + 0.2 * Math.sin(f * 0.07);
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
      if (o.userData.isOccluder) { o.userData.vis0 = o.visible; return; }
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
  drawCaption(f);
  renderer.autoClear = false; renderer.render(capScene, fsCam); renderer.autoClear = true;
  return true;
};
window.TOTAL = TOTAL;
window.ready = true;
