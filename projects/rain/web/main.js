import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, bagPosAt, bagDipAt, BAGT, ANTS, RAIN, MOUND, RIVERP, POTP } from './story.js';

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
const textBoard = (lines, w, h, bg, fg, font = 900, fsScale = 1) => {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w);
  const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = fg; g.lineWidth = 14; g.strokeRect(20, 20, c.width - 40, c.height - 40);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  const fs = Math.min(170, (c.width - 130) / Math.max(...lines.map((l) => l.length)) * 1.72) * fsScale;
  g.font = `${font} ${fs}px Arial`;
  lines.forEach((l, i) => g.fillText(l, c.width / 2, c.height * (lines.length === 1 ? 0.52 : (i + 0.5) / lines.length)));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, fog: true }));
  m.userData.ndSkip = true; return m;
};
// the forged order: parchment letter WITH the king's red wax seal
const letterBoard = (lines, w, h) => {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w);
  const g = c.getContext('2d'); g.fillStyle = '#e8d9ae'; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = '#4a2c14'; g.lineWidth = 12; g.strokeRect(18, 18, c.width - 36, c.height - 36);
  g.fillStyle = '#4a2c14'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const fs = Math.min(170, (c.width - 130) / Math.max(...lines.map((l) => l.length)) * 1.72);
  g.font = `900 ${fs}px Arial`;
  lines.forEach((l, i) => g.fillText(l, c.width / 2, c.height * (i + 0.5) / lines.length));
  const sx = c.width * 0.87, sy = c.height * 0.115, sr = c.height * 0.065;   // wax seal, top-right clear of the text
  g.fillStyle = '#b3392e'; g.beginPath(); g.arc(sx, sy, sr, 0, 7); g.fill();
  g.strokeStyle = '#7e271e'; g.lineWidth = 6; g.beginPath(); g.arc(sx, sy, sr * 0.62, 0, 7); g.stroke();
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
  grass: texM(P.grass(61), 16, 16, '#b0a05e'),
  dirt: texM(P.dirt(35), 8, 8, '#b49a72'),
  stone: texM(P.stone(64, 40, 5, 58), 3, 2, '#c9c2b2'), stoneDk: texM(P.stone(65, 40, 6, 46), 3, 2, '#a89f8d'),
  wood: texM(P.beam(66, [26, 45, 32]), 1, 2), woodDk: texM(P.beam(67, [24, 40, 22]), 1, 2),
  plaster: texM(P.plaster(71, 36), 2, 2),
  thatch: toon({ color: '#b08d4f' }), leaf: toon({ color: '#4a6a34' }), leaf2: toon({ color: '#5d8142' }),
  gold: toon({ color: '#d9a441' }), goldBright: toon({ color: '#f0bc4a' }),
  sack: toon({ color: '#c9a24d' }), sackDk: toon({ color: '#a37f36' }),
  steel: toon({ color: '#565d66' }), steelDk: toon({ color: '#33373d' }),
  white: toon({ color: '#f7f3e6' }),
  cushion: toon({ color: '#8c2432' }),
  dark: toon({ color: '#33302c' }),
  donkey: toon({ color: '#8a7a68' }), donkeyDk: toon({ color: '#6e5f4e' }), donkeyBelly: toon({ color: '#a89880' }),
  mane: toon({ color: '#4a3a2a' }), saddleRed: toon({ color: '#8c2432' }), blanket: toon({ color: '#c9a24d' }),
  awnA: toon({ color: '#b3392e' }), awnB: toon({ color: '#f3e3bb' }),
  fruitO: toon({ color: '#d88a2e' }), fruitR: toon({ color: '#b3392e' }), fruitG: toon({ color: '#5d8142' }),
  catOrange: toon({ color: '#c98a4a' }), catCream: toon({ color: '#e8d9ae' }), catDk: toon({ color: '#8a5a2e' }),
  brass: toon({ color: '#c9a227' }),
  sand: toon({ color: '#dcbd7f' }), sandLt: toon({ color: '#eeda9f' }), clay: toon({ color: '#a8643c' }),
  ele: toon({ color: '#8d9299' }), eleDk: toon({ color: '#74797f' }),
  crack: toon({ color: '#8a6a44' }), hillDry: toon({ color: '#6a5a3a' }), hillDry2: toon({ color: '#5a4a34' }),
  river: toon({ color: '#46688c' }), riverLt: toon({ color: '#5a7a9c' }),
  potClay: toon({ color: '#9a5a34' }), potDk: toon({ color: '#6e4026' }),
};
const world = new THREE.Group(); scene.add(world);
{
  const g = world;
  flat(add(new THREE.PlaneGeometry(300, 240), MAT.grass, 8, -0.03, 0, g, { cast: false }));
  flat(add(new THREE.PlaneGeometry(64, 7), MAT.dirt, 10, -0.012, 3.4, g, { cast: false }));       // the road (east)
  flat(add(new THREE.PlaneGeometry(16, 5), MAT.dirt, -10, -0.011, -1.5, g, { cast: false }));     // court approach (west)
  flat(add(new THREE.CircleGeometry(8.5, 22), MAT.dirt, 0, -0.008, 0.5, g, { cast: false }));      // market square
  // distant huts + trees
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
}
// ---------- cracked-earth texture (drought field, drawn, seeded) ----------
const crackedTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#b89a68'; g.fillRect(0, 0, 512, 512);
  let seed = 987654321;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let i = 0; i < 260; i++) { // dry patches
    g.fillStyle = `rgba(${140 + rnd() * 60 | 0},${105 + rnd() * 40 | 0},${55 + rnd() * 30 | 0},${0.10 + rnd() * 0.16})`;
    g.beginPath(); g.ellipse(rnd() * 512, rnd() * 512, 12 + rnd() * 42, 8 + rnd() * 26, rnd() * 3, 0, 7); g.fill();
  }
  g.strokeStyle = '#5a4026'; g.lineCap = 'round';
  for (let i = 0; i < 46; i++) { // the cracks: branching dark polylines
    let x = rnd() * 512, y = rnd() * 512, a = rnd() * Math.PI * 2;
    g.lineWidth = 1.5 + rnd() * 2.5; g.beginPath(); g.moveTo(x, y);
    const segs = 3 + (rnd() * 5 | 0);
    for (let s = 0; s < segs; s++) { a += (rnd() - 0.5) * 1.5; const len = 14 + rnd() * 34; x += Math.cos(a) * len; y += Math.sin(a) * len; g.lineTo(x, y); }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2); return t;
})();
// ================= DROUGHT FIELD + HILLS =================
{
  const g = world;
  // the cracked dry field (east/centre) — the drought the voice names
  const field = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), new THREE.MeshToonMaterial({ gradientMap: grad, map: crackedTex }));
  field.rotation.x = -Math.PI / 2; field.position.set(2, -0.02, -2); field.receiveShadow = true; g.add(field);
  // withered crop tufts, standing dead in the cracked field — LOW dry-grass
  // clumps (3 short fanned blades, 0.30 tall), NEVER a single tall thin cone:
  // a lone 0.55-tall spike read as an unexplained cone sticking out of the
  // ground in the frame-0 / rain foregrounds (fix 2026-11-16). Same RNG
  // consumption per tuft (4 calls) so seeded positions are unchanged.
  let seed = 424242;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let i = 0; i < 14; i++) {
    const tx = -4 + rnd() * 16, tz = -3 + rnd() * 10;
    const rz = (rnd() - 0.5) * 0.5, rx = (rnd() - 0.5) * 0.4;
    for (const [dx, tilt] of [[-0.09, -0.32], [0, 0.05], [0.09, 0.32]]) {
      const blade = add(new THREE.ConeGeometry(0.11, 0.30, 5), MAT.crack, tx + dx, 0.15, tz, g, { cast: false });
      blade.rotation.z = tilt + rz * 0.4; blade.rotation.x = rx * 0.4;
    }
  }
  // the hills behind the field — the clouds gather dark over THESE
  const hill = (x, z, r, h, mat) => {
    const m = add(new THREE.SphereGeometry(r, 18, 12), mat, x, -0.4, z, g, { cast: false });
    m.scale.y = h / r; m.userData.ndSkip = true; return m;
  };
  hill(-14, -30, 13, 4.2, MAT.hillDry);
  hill(2, -33, 16, 5.0, MAT.hillDry2);
  hill(18, -30, 12, 3.6, MAT.hillDry);
  hill(-26, -26, 10, 3.0, MAT.hillDry2);
  // the ants' hillock in the field (base flush on the field plane y=-0.02, apex 0.48)
  const mound = add(new THREE.ConeGeometry(0.55, 0.5, 16), MAT.dirt, MOUND[0], 0.23, MOUND[2], g, { cast: false });
  // the river strip in the field — dry bed at first, fills when the rain comes
  // (built below as riverMesh; here only the dry bed depression)
  flat(add(new THREE.PlaneGeometry(14, 1.6), MAT.dirt, RIVERP[0], 0.008, RIVERP[2], g, { cast: false }));
}
// (palace planters removed — their DOF-blurred boxes/fruit read as white
// wireframe cubes and rings in the hook frames, behind the pot set)

// ================= JUDGE'S COURT (x=-16) =================
{
  const g = world, cx = -16;
  flat(add(new THREE.PlaneGeometry(11, 9), MAT.stone, cx, -0.005, -5.4, g, { cast: false }));
  add(tbox(10.5, 4.2, 0.4, 2), MAT.stoneDk, cx, 2.1, -8.7, g, { cast: false });
  add(tbox(0.4, 4.2, 5.4, 2), MAT.stoneDk, cx - 5.2, 2.1, -6.0, g, { cast: false });
  add(tbox(0.4, 4.2, 5.4, 2), MAT.stoneDk, cx + 5.2, 2.1, -6.0, g, { cast: false });
  add(tbox(11, 0.35, 6.4, 2), MAT.woodDk, cx, 4.35, -6.2, g, { cast: false });
  const lampGlow = softGlow(1.9, 0xffc98a, 0.16); lampGlow.position.set(cx - 3.4, 2.3, -8.3); g.add(lampGlow);
  // THE THRONE (the king stands before it) + dais steps
  add(tbox(4.6, 0.18, 2.6, 2), MAT.stoneDk, cx, 0.09, -7.3, g, { cast: false });
  add(tbox(3.8, 0.18, 2.0, 2), MAT.stoneDk, cx, 0.27, -7.5, g, { cast: false });
  add(tbox(1.5, 0.22, 1.1, 2), MAT.woodDk, cx, 0.47, -7.6, g, { cast: false });
  add(tbox(1.3, 0.1, 0.9, 2), MAT.cushion, cx, 0.63, -7.6, g, { cast: false });
  add(tbox(1.5, 2.0, 0.22, 2), MAT.woodDk, cx, 1.36, -8.05, g, { cast: false });
  add(tbox(1.1, 1.5, 0.1, 2), MAT.cushion, cx, 1.25, -7.92, g, { cast: false });
  for (const sx of [-0.85, 0.85]) {
    add(new THREE.CylinderGeometry(0.07, 0.07, 1.5, 8), MAT.woodDk, cx + sx, 1.1, -7.6, g, { cast: false });
    add(new THREE.SphereGeometry(0.11, 9, 7), MAT.goldBright, cx + sx, 1.92, -7.6, g, { cast: false });
    add(tbox(0.34, 0.09, 0.8, 2), MAT.woodDk, cx + sx, 0.78, -7.6, g, { cast: false });
  }
  // the king's side table (the gold bag rests ON it, top y = 0.78)
  add(tbox(1.1, 0.08, 0.8, 2), MAT.wood, -14.6, 0.74, -4.6, g, { cast: false });
  for (const [lx, lz] of [[-0.45, -0.3], [0.45, -0.3], [-0.45, 0.3], [0.45, 0.3]]) add(box(0.09, 0.72, 0.09), MAT.woodDk, -14.6 + lx, 0.36, -4.6 + lz, g, { cast: false });
}
// (no work table here — the farmer owns nothing but his field)
// ================= SIGNPOSTS (title board in the field, hook board west) =================
{
  const g = world;
  // title board posts — OUTSIDE the 3.4-wide panel (panel spans -3.7..-0.3)
  // with a clear gap, so no post ever overlaps the board text (fix 2026-11-16:
  // the old posts at -3.55/-0.45 stood inside the panel and covered the T/S)
  for (const px of [-3.95, -0.05]) add(new THREE.CylinderGeometry(0.07, 0.08, 2.9, 8), MAT.woodDk, px, 1.45, -6, g, { cast: false });
  add(tbox(4.1, 0.12, 0.12, 2), MAT.woodDk, -2, 2.88, -6, g, { cast: false });
  // hook board posts (board 3.4 wide, centre (-17.6, 2.75, -3.4), top 3.30)
  for (const px of [-19.3, -15.9]) add(new THREE.CylinderGeometry(0.07, 0.08, 3.35, 8), MAT.woodDk, px, 1.67, -3.4, g, { cast: false });
  add(tbox(3.4, 0.12, 0.12, 2), MAT.woodDk, -17.6, 3.32, -3.4, g, { cast: false });
}
// ================= THE RAIN (drops with real gravity) =================
// 650 drops, fully analytic per frame (seek-safe): each drop spawns at a
// cloud height (y0 18-30), falls with y = y0 - g t^2 / 2 (g = 9.8, so it
// ACCELERATES — spacing grows as it falls), LANDS on the ground and STOPS
// (a 3-frame splash dot at y = 0.02), then respawns at the top. No slow
// drift, no hanging, nothing passes through the ground.
const rainTex = (() => {
  const c = document.createElement('canvas'); c.width = 16; c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 64);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.85)');
  gr.addColorStop(0.65, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(6, 0, 4, 64);
  return new THREE.CanvasTexture(c);
})();
const RAIN_N = RAIN.count;
const rainGeo = new THREE.BufferGeometry();
const rainPos = new Float32Array(RAIN_N * 3);
const rainDat = [];
{
  let seed = 24681357;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let i = 0; i < RAIN_N; i++) {
    const y0 = 12 + rnd() * 10;
    rainDat.push({
      x: -10 + rnd() * 16, z: -6 + rnd() * 16, y0,
      s: RAIN.f0 + Math.floor(rnd() * 80),                       // staggered spawn
      tf: Math.sqrt(2 * y0 / 9.8) * 30,                          // fall duration, frames
      gap: 18 + Math.floor(rnd() * 14),                         // rest at top before respawn
      drift: (rnd() - 0.5) * 1.6,                               // slight wind slant (m over the fall)
    });
  }
}
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rainMat = new THREE.PointsMaterial({ size: 0.65, map: rainTex, transparent: true, depthWrite: false, color: 0xb8c8dc, opacity: 0 });
const rainPts = new THREE.Points(rainGeo, rainMat);
rainPts.userData.ndSkip = true; rainPts.frustumCulled = false; rainPts.visible = false; world.add(rainPts);
const rainStep = (f, amt) => {
  rainPts.visible = amt > 0.01;
  if (!rainPts.visible) return;
  rainMat.opacity = 0.95 * amt;
  const cx = camera.position.x, cz = camera.position.z;
  for (let i = 0; i < RAIN_N; i++) {
    const D = rainDat[i], o = i * 3;
    // drops within 3m of the camera would render as giant blurred bars —
    // hide them (they are out of focus in real rain too)
    const dx = D.x - cx, dz = D.z - cz;
    if (dx * dx + dz * dz < 9) { rainPos[o] = D.x; rainPos[o + 1] = -5; rainPos[o + 2] = D.z; continue; }
    const cyc = D.tf + D.gap;
    let age = (f - D.s) % cyc; if (age < 0) age += cyc;
    if (age < D.tf) {
      const t = age / 30;
      rainPos[o] = D.x + D.drift * (t / (D.tf / 30));
      rainPos[o + 1] = Math.max(0.02, D.y0 - 0.5 * 9.8 * t * t);
      rainPos[o + 2] = D.z;
    } else if (age < D.tf + 3) { // landed: STOPPED on the ground, a brief splash dot
      rainPos[o] = D.x + D.drift; rainPos[o + 1] = 0.02; rainPos[o + 2] = D.z;
    } else { rainPos[o] = D.x; rainPos[o + 1] = -5; rainPos[o + 2] = D.z; } // hidden, waiting to respawn
  }
  rainGeo.attributes.position.needsUpdate = true;
};

// ================= THE ANTS (marching uphill, f748-809) =================
// 48 dark dots in two long lines, marching UP the mound along the ANTS path.
// Analytic per frame (seek-safe): each ant's path position advances with
// the beat; feet stay ON the mound surface (y from the path).
const antGeo = new THREE.BufferGeometry();
const antPos = new Float32Array(ANTS.count * 3);
const antDat = [];
{
  const P = ANTS.path;
  const segLen = [Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1], P[1][2] - P[0][2]),
    Math.hypot(P[2][0] - P[1][0], P[2][1] - P[1][1], P[2][2] - P[1][2])];
  const total = segLen[0] + segLen[1];
  for (let i = 0; i < ANTS.count; i++) {
    antDat.push({ off: (i % 24) / 24, lane: i < 24 ? -0.07 : 0.07, segLen, total });
  }
}
antGeo.setAttribute('position', new THREE.BufferAttribute(antPos, 3));
const antTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(16, 16, 1, 16, 16, 15);
  gr.addColorStop(0, 'rgba(30,20,14,1)'); gr.addColorStop(0.7, 'rgba(30,20,14,1)'); gr.addColorStop(1, 'rgba(30,20,14,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
})();
const antMat = new THREE.PointsMaterial({ size: 0.09, map: antTex, transparent: true, depthWrite: false, color: 0x241a12, opacity: 0 });
const ants = new THREE.Points(antGeo, antMat);
ants.userData.ndSkip = true; ants.frustumCulled = false; ants.visible = false; world.add(ants);
const antsStep = (f, amt) => {
  ants.visible = amt > 0.01;
  if (!ants.visible) return;
  antMat.opacity = amt;
  const P = ANTS.path;
  const span = (ANTS.f1 - ANTS.f0) * 0.8; // the line flows 0.8 of the way up the path during the beat
  for (let i = 0; i < ANTS.count; i++) {
    const A = antDat[i], o = i * 3;
    let u = ((f - ANTS.f0) / span + A.off) % 1; if (u < 0) u += 1;
    const d = u * A.total;
    let px, py, pz;
    if (d < A.segLen[0]) { const t = d / A.segLen[0]; px = P[0][0] + (P[1][0] - P[0][0]) * t; py = P[0][1] + (P[1][1] - P[0][1]) * t; pz = P[0][2] + (P[1][2] - P[0][2]) * t; }
    else { const t = (d - A.segLen[0]) / A.segLen[1]; px = P[1][0] + (P[2][0] - P[1][0]) * t; py = P[1][1] + (P[2][1] - P[1][1]) * t; pz = P[1][2] + (P[2][2] - P[1][2]) * t; }
    antPos[o] = px; antPos[o + 1] = py + 0.03; antPos[o + 2] = pz + A.lane;
  }
  antGeo.attributes.position.needsUpdate = true;
};

// ================= THE GOLD BAG =================
// Built with its base at y=0 so story.js bagPosAt gives the SURFACE it
// rests on / the hand height it is carried at. Blob shadow follows it:
// crisp on the side table while it rests, soft on the ground while held.
let bagGroup, bagBlob;
{
  bagGroup = new THREE.Group(); world.add(bagGroup);
  const body = add(new THREE.SphereGeometry(0.21, 12, 10), MAT.sack, 0, 0.17, 0, bagGroup);
  body.scale.set(1, 0.88, 1);
  add(new THREE.CylinderGeometry(0.075, 0.11, 0.12, 10), MAT.sackDk, 0, 0.36, 0, bagGroup);
  add(new THREE.SphereGeometry(0.055, 8, 6), MAT.sackDk, 0, 0.44, 0, bagGroup);
  add(new THREE.CylinderGeometry(0.05, 0.05, 0.015, 10), MAT.goldBright, 0.03, 0.415, 0.02, bagGroup, { cast: false });
  bagBlob = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshBasicMaterial({ map: P.tex(P.radial('20,14,30', 0.6)), transparent: true, opacity: 0.55, depthWrite: false, fog: true }));
  bagBlob.rotation.x = -Math.PI / 2; bagBlob.userData.ndSkip = true; bagBlob.renderOrder = 1; world.add(bagBlob);
}

// ================= THE SECOND POUCH (the king pays DOUBLE anyway) =================
// Rests ON the side table next to where the first pouch sat; fades in as the
// king sets it down (f1555-1575), then sits flush with its contact shadow.
let bag2Group, bag2Blob;
{
  bag2Group = new THREE.Group(); bag2Group.position.set(BAGT[0] + 0.35, 0.78, BAGT[2] + 0.15); world.add(bag2Group);
  const mats = [];
  const body = add(new THREE.SphereGeometry(0.21, 12, 10), MAT.sack.clone(), 0, 0.17, 0, bag2Group);
  body.scale.set(1, 0.88, 1); mats.push(body.material);
  const neck = add(new THREE.CylinderGeometry(0.075, 0.11, 0.12, 10), MAT.sackDk.clone(), 0, 0.36, 0, bag2Group);
  mats.push(neck.material);
  const knot = add(new THREE.SphereGeometry(0.055, 8, 6), MAT.sackDk.clone(), 0, 0.44, 0, bag2Group);
  mats.push(knot.material);
  const coin = add(new THREE.CylinderGeometry(0.05, 0.05, 0.015, 10), MAT.goldBright.clone(), 0.03, 0.415, 0.02, bag2Group, { cast: false });
  mats.push(coin.material);
  mats.forEach((m) => { m.transparent = true; m.opacity = 0; });
  bag2Group.userData.mats = mats;
  bag2Blob = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshBasicMaterial({ map: P.tex(P.radial('20,14,30', 0.6)), transparent: true, opacity: 0, depthWrite: false, fog: true }));
  bag2Blob.rotation.x = -Math.PI / 2; bag2Blob.position.set(BAGT[0] + 0.35, 0.785, BAGT[2] + 0.15); bag2Blob.userData.ndSkip = true; bag2Blob.renderOrder = 1; world.add(bag2Blob);
  bag2Group.visible = false; bag2Blob.visible = false;
}

// ================= THE RIVER (rises when the rain comes) =================
// A water strip in the field bed; it WIDENS (scale.z) as riverAmt ramps
// f1113-1129 — the river rising after the rain.
let riverMesh;
{
  riverMesh = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.6), MAT.river);
  riverMesh.rotation.x = -Math.PI / 2; riverMesh.position.set(RIVERP[0], 0.03, RIVERP[2]);
  riverMesh.receiveShadow = true; riverMesh.scale.set(1, 0.35, 1); riverMesh.visible = false; world.add(riverMesh);
  const glint = new THREE.Mesh(new THREE.PlaneGeometry(13.4, 0.28), MAT.riverLt);
  glint.rotation.x = -Math.PI / 2; glint.position.set(RIVERP[0], 0.035, RIVERP[2]); glint.receiveShadow = false;
  glint.userData.ndSkip = true; riverMesh.userData.glint = glint; world.add(glint); glint.visible = false;
}

// ================= HOOK SET: THE WOMAN + THE SELF-COOKING POT =================
// Tomorrow's teaser — visible only in the hook shot (worldAt hookSet).
// The pot sits ON its stool (top y = 0.50), flush, with a contact shadow;
// it steams though there is NO fire under it — that is the whole hook.
let hookSetGroup;
{
  hookSetGroup = new THREE.Group(); world.add(hookSetGroup);
  const g = hookSetGroup;
  // the stool (top y = 0.50)
  add(tbox(0.9, 0.07, 0.7, 2), MAT.wood, POTP[0], 0.465, POTP[2], g, { cast: false });
  for (const [lx, lz] of [[-0.38, -0.28], [0.38, -0.28], [-0.38, 0.28], [0.38, 0.28]]) add(box(0.07, 0.45, 0.07), MAT.woodDk, POTP[0] + lx, 0.225, POTP[2] + lz, g, { cast: false });
  // the clay pot: squashed sphere body + rim + lid, base flush on the stool
  const pot = add(new THREE.SphereGeometry(0.34, 16, 12), MAT.potClay, POTP[0], 0.78, POTP[2], g);
  pot.scale.set(1, 0.82, 1);
  add(new THREE.CylinderGeometry(0.20, 0.16, 0.10, 14), MAT.potDk, POTP[0], 1.03, POTP[2], g, { cast: false });
  add(new THREE.SphereGeometry(0.17, 12, 8), MAT.potClay, POTP[0], 1.10, POTP[2], g, { cast: false }).scale.y = 0.45;
  // contact shadows: one under the stool on the ground, one under the pot on the stool
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.4), new THREE.MeshBasicMaterial({ map: P.tex(P.radial('20,14,30', 0.6)), transparent: true, depthWrite: false, fog: true }));
  blob.rotation.x = -Math.PI / 2; blob.position.set(POTP[0], 0.02, POTP[2]); blob.userData.ndSkip = true; g.add(blob);
  const blob2 = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshBasicMaterial({ map: P.tex(P.radial('20,14,30', 0.6)), transparent: true, depthWrite: false, fog: true }));
  blob2.rotation.x = -Math.PI / 2; blob2.position.set(POTP[0], 0.505, POTP[2]); blob2.userData.ndSkip = true; g.add(blob2);
  hookSetGroup.visible = false;
}


// ---- boards (transforms mirrored in boards.json — keep in sync) ----
const boardTitle = textBoard(['THE FARMER WHO', 'SOLD THE RAIN'], 3.4, 1.1, '#5a3a1a', '#ffd98a', 900, 0.85); boardTitle.position.set(-2, 2.3, -6); world.add(boardTitle);
const boardHook = textBoard(['HOW DOES A POT COOK', 'WITH NO FIRE AT ALL?'], 3.4, 1.1, '#2e3a5a', '#ffe9a8', 900, 0.8); boardHook.position.set(-17.6, 2.75, -3.4); world.add(boardHook);

// ---------- FX: haze ----------
const smoke = new FX.Smoke(scene, 130); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const hazeEmit = smoke.addEmitter(0, 2.4, 0, { rate: 0.35, color: 0xffffff, opacity: 0.04, scale: 2.2, grow: 1.3, life: 2.6, vy: 0.1, wind: -0.5 });
const dustEmit = smoke.addEmitter(-16, 1.6, -5, { rate: 0, color: 0xffe2b8, opacity: 0.1, scale: 0.5, grow: 1.2, life: 2.2, vy: 0.16, wind: 0.15 });
const fxClouds = new FX.Clouds(scene, { count: 6, y: 42, opacity: 0.2, color: 0xf4f6fa, drift: 0.5 });
fxClouds.items.forEach((cl) => { cl.userData.x0 = cl.position.x; cl.traverse((m) => { m.userData.ndSkip = true; }); });
// the DARK clouds gathering over the hills (P18) — placed deterministically
// over the hill line, faded in by worldAt cloudAmt
const darkClouds = new FX.Clouds(scene, { count: 8, y: 16, opacity: 0.75, color: 0x3a3f4a, drift: 0.8, rim: 0x6a7080 });
darkClouds.items.forEach((cl, i) => {
  cl.position.set(-26 + i * 7 + (i % 2) * 2, 14 + (i % 3) * 2.5, -27 - (i % 3) * 4);
  cl.userData.x0 = cl.position.x;
  cl.traverse((m) => { m.userData.ndSkip = true; if (m.isSprite) { m.userData.baseOp = m.material.opacity; m.material.opacity = 0; } });
});
// steam from the self-cooking pot — white, rising, NO fire under the pot
const steamEmit = smoke.addEmitter(POTP[0], 1.25, POTP[2], { rate: 0, color: 0xffffff, opacity: 0.22, scale: 0.35, grow: 1.4, life: 1.8, vy: 0.55, wind: 0.1 });
let fxF = -1;
const fxReset = () => {
  smoke.pool.forEach((p) => { p.life = -1; p.s.visible = false; }); smoke.emitters.forEach((e) => { e.acc = 0; });
  fxClouds.items.forEach((cl) => { cl.position.x = cl.userData.x0; });
  darkClouds.items.forEach((cl) => { cl.position.x = cl.userData.x0; cl.traverse((m) => { if (m.isSprite) m.material.opacity = 0; }); });
};
const fxStepTo = (f) => {
  if (f === fxF) return;
  if (f < fxF || f > fxF + 240) { fxReset(); fxF = -1; }
  while (fxF < f) {
    fxF++; const t = fxF / 30, dt = 1 / 30, pr = fxProfileAt(fxF), Wd = worldAt(fxF);
    hazeEmit.rate = pr.smokeRate; dustEmit.rate = pr.dustRate;
    steamEmit.rate = (Wd.steamAmt || 0) * 4;
    darkClouds.items.forEach((cl) => { cl.traverse((m) => { if (m.isSprite) m.material.opacity = m.userData.baseOp * (Wd.cloudAmt || 0); }); });
    smoke.update(t, dt);
    fxClouds.update(t, dt);
    darkClouds.update(t, dt);
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
      e = max(e, smoothstep(.03, .08, (ds - d)/d));
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
  setB(boardTitle, Ws.boardTitle || 0);
  setB(boardHook, Ws.boardHook || 0);
  // rain + ants are analytic in f (gravity / path); the river widens as it rises
  rainStep(f, Ws.rainAmt || 0);
  antsStep(f, Ws.antsAmt || 0);
  const rv = Ws.riverAmt || 0;
  riverMesh.visible = rv > 0.01;
  riverMesh.userData.glint.visible = rv > 0.01;
  riverMesh.scale.set(1, 0.3 + 0.7 * rv, 1);
  riverMesh.userData.glint.scale.set(1, 0.3 + 0.7 * rv, 1);
  // gold bag: position + handover dip + carry bob; blob = contact shadow
  const bp = bagPosAt(f);
  const carryBob = (f >= 672 && f < 690) ? Math.abs(Math.sin((f - 672) * 0.42)) * 0.022 : 0;
  bagGroup.position.set(bp[0], bp[1] + bagDipAt(f) + carryBob, bp[2]);
  if (f < 662) { bagBlob.position.set(bp[0], 0.785, bp[2]); bagBlob.material.opacity = 0.55; bagBlob.scale.setScalar(1); }
  else { bagBlob.position.set(bp[0], 0.02, bp[2]); bagBlob.material.opacity = 0.35; bagBlob.scale.setScalar(1.25); }
  // the second pouch (king pays double): fades in on the side table
  const b2 = Ws.bag2 || 0;
  bag2Group.visible = b2 > 0.01;
  bag2Blob.visible = b2 > 0.01;
  if (b2 > 0.01) {
    bag2Group.userData.mats.forEach((m) => { m.opacity = b2; });
    bag2Blob.material.opacity = 0.55 * b2;
  }
  hookSetGroup.visible = (Ws.hookSet || 0) > 0.01;
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
