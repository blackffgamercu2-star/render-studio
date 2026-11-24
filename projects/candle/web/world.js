// world.js — "He Filled a Warehouse With One Candle"
// ONE continuous world (road -> houses -> warehouse with a real interior)
// built from the LOCKED car-match kit (kit.js) so the camera can fly
// road -> door -> candle in a single uncut journey. All animation is a
// pure function of time t (deterministic per frame) via api.setState().
import * as THREE from 'three';
import {
  INK, HAIR_HERO, HAIR_GREEN, SHIRT_YELLOW, SHIRT_GREEN,
  SkyDome, Clouds, Tree, ScannedTree, Hedge,
  StandingFigure, CharHead, ContactShadow, SuvVehicle, GrassField, House,
  canvasTex, concreteTex, glareTex, blobTex, rng, RoundedBoxGeometry,
} from './kit.js';

export function lights(scene, { hemiI = 0.55, sunPos = [6, 9, -4], sunI = 2.55, shadowI = 0.85, mapSize = 1024, ext = 12, ambI = 0 } = {}) {
  const hemi = new THREE.HemisphereLight('#d3e4f4', '#46503c', hemiI);
  scene.add(hemi);
  if (ambI) scene.add(new THREE.AmbientLight(0xffffff, ambI));
  const sun = new THREE.DirectionalLight('#ffedd0', sunI);
  sun.position.set(...sunPos);
  sun.castShadow = true;
  sun.shadow.intensity = shadowI;
  sun.shadow.mapSize.set(mapSize, mapSize);
  sun.shadow.camera.left = -ext; sun.shadow.camera.right = ext;
  sun.shadow.camera.top = ext; sun.shadow.camera.bottom = -ext;
  sun.shadow.camera.far = 95;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  return { hemi, sun };
}

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;

// ---------------- coded textures for the new set ----------------
const cladTex = () => {
  const t = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#a3adb4'; c.fillRect(0, 0, w, h);
    const r = rng(17);
    for (let x = 0; x < w; x += 32) {
      const v = (r() - 0.5) * 14;
      c.fillStyle = `rgba(${v > 0 ? '255,255,255' : '20,28,34'},${Math.abs(v) / 255})`;
      c.fillRect(x, 0, 32, h);
      c.fillStyle = 'rgba(30,38,44,0.55)'; c.fillRect(x, 0, 2, h);
      c.fillStyle = 'rgba(255,255,255,0.20)'; c.fillRect(x + 2, 0, 1, h);
      for (let y = 20; y < h; y += 52) { c.fillStyle = 'rgba(40,48,54,0.5)'; c.beginPath(); c.arc(x + 16, y, 2.2, 0, 7); c.fill(); }
    }
    const g = c.createLinearGradient(0, h * 0.8, 0, h);
    g.addColorStop(0, 'rgba(60,52,36,0)'); g.addColorStop(1, 'rgba(60,52,36,0.28)');
    c.fillStyle = g; c.fillRect(0, h * 0.8, w, h * 0.2);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 1.6);
  return t;
};
const roofTex = () => {
  const t = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#757d84'; c.fillRect(0, 0, w, h);
    for (let y = 0, row = 0; y < h; y += 22, row++) {
      c.fillStyle = 'rgba(28,32,36,0.30)'; c.fillRect(0, y, w, 3);
      c.fillStyle = 'rgba(255,255,255,0.10)'; c.fillRect(0, y + 3, w, 2);
      c.fillStyle = 'rgba(28,32,36,0.16)';
      for (let x = (row % 2) * 32; x < w; x += 64) c.fillRect(x, y, 2, 22);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(8, 3);
  return t;
};
const hayTex = () => {
  const t = canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = '#d9a83c'; c.fillRect(0, 0, w, h);
    const r = rng(31);
    for (let i = 0; i < 340; i++) {
      c.strokeStyle = r() > 0.5 ? 'rgba(185,135,39,0.55)' : 'rgba(240,199,94,0.5)';
      c.lineWidth = 1.4;
      const y = r() * h, x = r() * w;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + 8 + r() * 18, y + (r() - 0.5) * 3); c.stroke();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};
const woodTex = () => {
  const t = canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = '#9a7648'; c.fillRect(0, 0, w, h);
    const r = rng(43);
    for (let y = 0; y < h; y += 32) {
      c.fillStyle = 'rgba(52,36,18,0.6)'; c.fillRect(0, y, w, 2.5);
      for (let i = 0; i < 22; i++) {
        c.strokeStyle = `rgba(80,58,28,${0.12 + r() * 0.2})`; c.lineWidth = 1.2;
        const yy = y + 4 + r() * 26;
        c.beginPath(); c.moveTo(0, yy); c.bezierCurveTo(w * 0.3, yy + 2, w * 0.6, yy - 2, w, yy + 1); c.stroke();
      }
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};
const smokePuffTex = () => canvasTex(128, 128, (c) => {
  const g = c.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.38)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 128, 128);
});
const glowGradTex = () => canvasTex(256, 256, (c, w, h) => {
  const g = c.createRadialGradient(128, 128, 8, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,196,110,0.95)');
  g.addColorStop(0.45, 'rgba(255,166,66,0.42)');
  g.addColorStop(1, 'rgba(255,150,50,0)');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
});

// ---------------- the world ----------------
export function buildWorld(A) {
  const scene = new THREE.Scene();
  const L = lights(scene, { hemiI: 0.5, sunPos: [16, 24, 13], sunI: 2.5, shadowI: 0.9, mapSize: 2048, ext: 30 });
  scene.add(SkyDome());
  scene.add(Clouds([
    { p: [-30, 22, -55], s: [22, 8], o: 0.9 },
    { p: [14, 26, -62], s: [26, 9], o: 0.95 },
    { p: [38, 20, -48], s: [16, 6.5], o: 0.8 },
    { p: [-6, 30, -70], s: [15, 5.5], o: 0.6 },
  ]));

  // ---------- ground / road / houses ----------
  const lawnMat = (() => {
    if (!A.grassGround) return null;
    const g = A.grassGround;
    const map = g.map.clone(); map.repeat.set(42, 42); map.needsUpdate = true;
    const nrm = g.normalMap.clone(); nrm.repeat.set(42, 42); nrm.needsUpdate = true;
    const rgh = g.roughnessMap.clone(); rgh.repeat.set(42, 42); rgh.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map, normalMap: nrm, roughnessMap: rgh, color: new THREE.Color(0.40, 0.74, 0.60), roughness: 1 });
  })();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(150, 150),
    lawnMat || new THREE.MeshStandardMaterial({ color: '#55803a', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.02, -6); ground.receiveShadow = true; scene.add(ground);

  const aMap = A.asphalt.map.clone(); const aNor = A.asphalt.normalMap.clone(); const aRgh = A.asphalt.roughnessMap.clone();
  for (const t of [aMap, aNor, aRgh]) { t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(30, 2.4); }
  const road = new THREE.Mesh(new THREE.PlaneGeometry(120, 7.4), new THREE.MeshStandardMaterial({
    map: aMap, normalMap: aNor, roughnessMap: aRgh, roughness: 1, color: '#bcbcb7', envMapIntensity: 0.22,
  }));
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0.0, 16.4); road.receiveShadow = true; scene.add(road);
  const dashMat = new THREE.MeshStandardMaterial({ color: '#e8e6da', roughness: 0.8 });
  for (let i = 0; i < 16; i++) {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.16), dashMat);
    d.rotation.x = -Math.PI / 2; d.position.set(-52 + i * 7, 0.012, 16.4); scene.add(d);
  }
  const conc = concreteTex(); conc.wrapS = conc.wrapT = THREE.RepeatWrapping; conc.repeat.set(10, 2);
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(34, 6.4), new THREE.MeshStandardMaterial({ map: conc, roughness: 0.95, color: '#8f959b' }));
  apron.rotation.x = -Math.PI / 2; apron.position.set(0, 0.004, -6.2); apron.receiveShadow = true; scene.add(apron);

  scene.add(House({ p: [-13, 0, 28.5], w: 6.4, h: 3.6, d: 4.6, wall: '#eef0ee', roof: '#7d8288', rotY: Math.PI + 0.12 }));
  scene.add(House({ p: [-3.5, 0, 29.5], w: 5.2, h: 2.9, d: 4.2, wall: '#e8e2d4', roof: '#8a6a4e', rotY: Math.PI - 0.08 }));
  scene.add(House({ p: [6.5, 0, 29], w: 5.6, h: 3.1, d: 4.3, wall: '#f2f2ee', roof: '#9aa0a4', rotY: Math.PI + 0.2 }));
  scene.add(House({ p: [15.5, 0, 28.5], w: 6.0, h: 3.3, d: 4.4, wall: '#e9ebe6', roof: '#7d8288', rotY: Math.PI - 0.18 }));
  scene.add(ScannedTree(A.tree, [-19, 0, -14], 2.2, 0.7));
  scene.add(ScannedTree(A.tree, [18.5, 0, -20], 2.4, 2.2));
  scene.add(ScannedTree(A.tree, [-17, 0, 22], 2.0, 4.0));
  scene.add(ScannedTree(A.tree, [21, 0, 24], 2.1, 1.2));
  scene.add(Tree([-24, 0, 2], 2.0, 23));
  scene.add(Tree([25, 0, -4], 2.1, 47));
  scene.add(Hedge([-15.5, 0, -8], 5));
  scene.add(Hedge([16.5, 0, -6], 9));
  if (A.grassFull) scene.add(GrassField(A.grassFull, { area: [-16, 16, -2.9, -0.6], count: 260, scale: [1.0, 1.8], seed: 61, tint: ['#4d8a2f', '#7cb54a'], bright: 0.95 }));
  if (A.grassTuft) {
    scene.add(GrassField(A.grassTuft, { area: [-17, 17, 10.6, 12.2], count: 420, scale: [1.1, 1.9], seed: 67, tint: ['#558c31', '#9ec763'], bright: 1.1 }));
    scene.add(GrassField(A.grassTuft, { area: [-17, 17, 20.6, 22.4], count: 380, scale: [1.1, 1.9], seed: 71, tint: ['#558c31', '#9ec763'], bright: 1.05 }));
  }

  // ---------- warehouse shell ----------
  const wh = new THREE.Group(); scene.add(wh);
  const clad = new THREE.MeshStandardMaterial({ map: cladTex(), roughness: 0.72, metalness: 0.28, envMapIntensity: 0.6 });
  const cladIn = new THREE.MeshStandardMaterial({ map: cladTex(), roughness: 0.9, metalness: 0.1, color: '#8f979e', envMapIntensity: 0.25 });
  const mkWall = (w, h, d, x, y, z, mat = clad) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; wh.add(m); return m;
  };
  // front wall (z=-10.25), door opening x[-3.2,3.2], h 5.2
  mkWall(9.8, 7, 0.5, -8.1, 3.5, -10.25);
  mkWall(9.8, 7, 0.5, 8.1, 3.5, -10.25);
  mkWall(6.4, 1.8, 0.5, 0, 6.1, -10.25);
  // back + sides
  mkWall(26, 7, 0.5, 0, 3.5, -21.75, cladIn);
  mkWall(0.5, 7, 12, -12.75, 3.5, -16, cladIn);
  mkWall(0.5, 7, 12, 12.75, 3.5, -16, cladIn);
  // gable roof (prism, ridge along z)
  {
    const shape = new THREE.Shape();
    shape.moveTo(-13.6, 0); shape.lineTo(13.6, 0); shape.lineTo(0, 2.7); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 13, bevelEnabled: false });
    geo.translate(0, 0, -6.5);
    const roof = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: roofTex(), roughness: 0.85, metalness: 0.2 }));
    roof.position.set(0, 7, -16); roof.castShadow = true; roof.receiveShadow = true; wh.add(roof);
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 13.2), new THREE.MeshStandardMaterial({ color: '#596066', roughness: 0.8 }));
    ridge.position.set(0, 9.72, -16); wh.add(ridge);
  }
  // sliding doors, opened outward
  const doorMat = new THREE.MeshStandardMaterial({ map: cladTex(), roughness: 0.7, metalness: 0.3, color: '#c8ccd0', envMapIntensity: 0.6 });
  for (const s of [-1, 1]) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(3.3, 5.2, 0.14), doorMat);
    door.position.set(s * 4.6, 2.6, -9.55); door.rotation.y = s * 0.5;
    door.castShadow = true; door.receiveShadow = true; wh.add(door);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 12), new THREE.MeshStandardMaterial({ color: '#2c2f33', roughness: 0.7 }));
    wheel.rotation.x = Math.PI / 2; wheel.position.set(s * 3.4, 0.16, -9.5); wh.add(wheel);
  }
  // interior floor
  const iconc = concreteTex(); iconc.wrapS = iconc.wrapT = THREE.RepeatWrapping; iconc.repeat.set(9, 4);
  const ifloor = new THREE.Mesh(new THREE.PlaneGeometry(25.4, 11.4), new THREE.MeshStandardMaterial({ map: iconc, roughness: 0.95, color: '#a3a8ad' }));
  ifloor.rotation.x = -Math.PI / 2; ifloor.position.set(0, 0.012, -16); ifloor.receiveShadow = true; wh.add(ifloor);
  // trusses + hanging lamps (off — the interior starts dim)
  const beamMat = new THREE.MeshStandardMaterial({ color: '#4c3a26', roughness: 1 });
  for (const z of [-12.8, -16, -19.2]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(25, 0.32, 0.24), beamMat);
    beam.position.set(0, 6.55, z); wh.add(beam);
  }
  const lampBulbs = [];
  for (const z of [-13.5, -18.5]) {
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 6), beamMat);
    cord.position.set(0, 6.0, z); wh.add(cord);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.26, 14, 1, true), new THREE.MeshStandardMaterial({ color: '#37414a', roughness: 0.6, metalness: 0.4, side: THREE.DoubleSide }));
    shade.position.set(0, 5.42, z); wh.add(shade);
    const bulbMat = new THREE.MeshStandardMaterial({ color: '#5a5148', roughness: 0.4, emissive: '#ffb45e', emissiveIntensity: 0 });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), bulbMat);
    bulb.position.set(0, 5.3, z); wh.add(bulb); lampBulbs.push(bulbMat);
  }
  // interior props: crates + barrels along the walls
  const wood = new THREE.MeshStandardMaterial({ map: woodTex(), roughness: 0.9 });
  const crateAt = (x, y, z, s, ry) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.15, 1.15), wood);
    m.position.set(x, y, z); m.scale.setScalar(s); m.rotation.y = ry;
    m.castShadow = true; m.receiveShadow = true; wh.add(m);
  };
  // right wall stack: two on the floor, one on top spanning them
  crateAt(11.2, 0.575, -19.8, 1, 0.2); crateAt(11.2, 0.575, -18.5, 1, -0.1);
  crateAt(11.2, 1.15 + 0.53, -19.15, 0.92, 0.4);
  // left wall stack: one on the floor, one on top
  crateAt(-11.3, 0.575, -12.6, 1, 0.3);
  crateAt(-11.3, 1.15 + 0.52, -12.6, 0.9, -0.2);
  const barrelMat = new THREE.MeshStandardMaterial({ color: '#4a6a8a', roughness: 0.55, metalness: 0.35 });
  for (const [x, z] of [[11.4, -14.6], [11.5, -13.7], [-11.5, -20.3]]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.95, 14), barrelMat);
    b.position.set(x, 0.475, z); b.castShadow = true; b.receiveShadow = true; wh.add(b);
  }

  // ---------- hay: cart outside + corner pile inside ----------
  const hayMat = new THREE.MeshStandardMaterial({ map: hayTex(), roughness: 1 });
  const baleGeo = new RoundedBoxGeometry(1.05, 0.52, 0.58, 2, 0.06);
  const mkBale = () => { const m = new THREE.Mesh(baleGeo, hayMat); m.castShadow = true; m.receiveShadow = true; return m; };
  // flatbed cart at (-7.6, 0, -3.6)
  const cart = new THREE.Group(); cart.position.set(-7.6, 0, -3.6); cart.rotation.y = 0.35; scene.add(cart);
  {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.14, 1.7), wood);
    bed.position.y = 0.62; bed.castShadow = true; cart.add(bed);
    const wheelMat = new THREE.MeshStandardMaterial({ color: '#24262a', roughness: 0.8 });
    for (const [x, z] of [[-1.3, 0.8], [1.3, 0.8], [-1.3, -0.8], [1.3, -0.8]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 14), wheelMat);
      w.rotation.x = Math.PI / 2; w.position.set(x, 0.3, z); cart.add(w);
    }
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.6, 8), beamMat);
    handle.rotation.z = 1.1; handle.position.set(2.2, 0.35, 0); cart.add(handle);
  }
  const cartBales = [];
  {
    const spots = [];
    for (let r = 0; r < 3; r++) for (let cx = 0; cx < 3 - (r === 2 ? 1 : 0); cx++) spots.push([cx, r]);
    spots.forEach(([cx, r], i) => {
      const b = mkBale();
      b.position.set(-1.05 + cx * 1.05 + (r === 2 ? 0.5 : 0), 0.95 + r * 0.53, (i % 2 ? 0.26 : -0.26));
      b.rotation.y = (i % 3 - 1) * 0.09;
      cart.add(b); cartBales.push(b);
    });
  }
  cart.add(ContactShadow([4.0, 2.6], 0.3, [0, 0.012, 0]));
  // interior corner pile at (-9.2, 0, -19.2), grows with hayK
  const pile = new THREE.Group(); pile.position.set(-9.2, 0, -19.2); pile.rotation.y = 0.3; wh.add(pile);
  const pileBales = [];
  {
    const spots = [];
    for (let r = 0; r < 3; r++) for (let cx = 0; cx < 4 - r; cx++) spots.push([cx, r]);
    spots.forEach(([cx, r], i) => {
      const b = mkBale();
      b.position.set(-1.6 + cx * 1.06 + r * 0.4, 0.27 + r * 0.53, (i % 2 ? 0.3 : -0.3) + (r % 2) * 0.14);
      b.rotation.y = (i % 4 - 1.5) * 0.1;
      pile.add(b); pileBales.push(b);
    });
  }

  // ---------- smoking pot (just inside the door) ----------
  const potGroup = new THREE.Group(); potGroup.position.set(1.6, 0, -12.6); wh.add(potGroup);
  {
    const clay = new THREE.MeshStandardMaterial({ color: '#8a4a2c', roughness: 0.85 });
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.20, 0.52, 14), clay);
    pot.position.y = 0.26; pot.castShadow = true; potGroup.add(pot);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.045, 8, 18), clay);
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.52; potGroup.add(rim);
    const coalMat = new THREE.MeshStandardMaterial({ color: '#2c1c10', emissive: '#ff5a1e', emissiveIntensity: 1.6, roughness: 1 });
    const coal = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.05, 12), coalMat);
    coal.position.y = 0.53; potGroup.add(coal);
    potGroup.userData.coalMat = coalMat;
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.1, 14), new THREE.MeshStandardMaterial({ color: '#3c3f44', roughness: 0.7, metalness: 0.4 }));
    stand.position.y = 0.05; potGroup.add(stand);
  }
  potGroup.add(ContactShadow([1.3, 1.3], 0.32, [0, 0.012, 0]));
  // smoke: 64 deterministic sprites + 5 interior haze blobs
  const smokeTex = smokePuffTex();
  const smokeMat = () => new THREE.SpriteMaterial({ map: smokeTex, color: '#aeb6bd', transparent: true, opacity: 0, depthWrite: false });
  const smoke = [];
  const srnd = rng(1234);
  for (let i = 0; i < 64; i++) {
    const sp = new THREE.Sprite(smokeMat());
    sp.userData = {
      ph: srnd(), rise: 2.6 + srnd() * 1.6, lat: (srnd() - 0.5) * 2, latZ: (srnd() - 0.5) * 2,
      sz: 0.8 + srnd() * 1.4, drift: 0.6 + srnd() * 0.8,
    };
    scene.add(sp); smoke.push(sp);
  }
  const haze = [];
  for (let i = 0; i < 5; i++) {
    const sp = new THREE.Sprite(smokeMat());
    sp.position.set(-6 + i * 3.1, 4.6 + (i % 2) * 0.7, -18.5 + (i % 3) * 2.6);
    sp.scale.set(8.5, 5.2, 1);
    scene.add(sp); haze.push(sp);
  }

  // ---------- candle table + candle + light rig ----------
  const table = new THREE.Group(); table.position.set(0, 0, -16); wh.add(table);
  {
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.09, 1.15), wood);
    top.position.y = 0.52; top.castShadow = true; top.receiveShadow = true; table.add(top);
    for (const [x, z] of [[-0.48, -0.48], [0.48, -0.48], [-0.48, 0.48], [0.48, 0.48]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.52, 0.09), beamMat);
      leg.position.set(x, 0.26, z); table.add(leg);
    }
  }
  table.add(ContactShadow([1.7, 1.7], 0.3, [0, 0.012, 0]));
  const candleGroup = new THREE.Group(); candleGroup.position.set(0, 0.565, -16); wh.add(candleGroup);
  {
    const brass = new THREE.MeshStandardMaterial({ color: '#c9a227', metalness: 0.8, roughness: 0.3 });
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.035, 16), brass);
    dish.position.y = 0.018; candleGroup.add(dish);
    const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.062, 0.3, 12),
      new THREE.MeshStandardMaterial({ color: '#f6efdd', roughness: 0.45, emissive: '#ffdf9e', emissiveIntensity: 0 }));
    wax.position.y = 0.185; candleGroup.add(wax);
    candleGroup.userData.waxMat = wax.material;
  }
  candleGroup.visible = false;
  const gt = glareTex();
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, color: '#ffc46a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  flame.position.set(0, 1.0, -15.96); scene.add(flame);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, color: '#ffb45e', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.position.set(0, 1.05, -16); scene.add(glow);
  const candleLight = new THREE.PointLight('#ffb45e', 0, 30, 1.6);
  candleLight.position.set(0, 1.25, -16); scene.add(candleLight);
  const fillLight = new THREE.PointLight('#ffc98a', 0, 34, 1.4);
  fillLight.position.set(0, 4.6, -16); scene.add(fillLight);
  const washTex = glowGradTex();
  const washes = [];
  const mkWash = (w, h, x, y, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: washTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.y = ry; m.renderOrder = 2; scene.add(m); washes.push(m);
  };
  mkWash(17, 8.5, 0, 3.1, -21.4, 0);
  mkWash(15, 8, -12.4, 3.0, -16, Math.PI / 2);
  mkWash(15, 8, 12.4, 3.0, -16, -Math.PI / 2);
  const floorGlow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: washTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  floorGlow.rotation.x = -Math.PI / 2; floorGlow.position.set(0, 0.03, -16); floorGlow.renderOrder = 2; scene.add(floorGlow);

  // ---------- white SUV (rich man's, arrives on the road) ----------
  const suvGroup = new THREE.Group(); scene.add(suvGroup);
  if (A.suv) suvGroup.add(SuvVehicle(A.suv, { paint: '#f2f4f5', variant: 'white' }));
  suvGroup.rotation.y = -Math.PI / 2; // front -> +x
  suvGroup.position.set(-25, 0, 16.4);

  // ---------- characters ----------
  // RICH MAN (blue) — smug, later angry; stands front-right of the door
  const richGroup = new THREE.Group(); richGroup.position.set(5.6, 0, -5.6); richGroup.rotation.y = -0.45; scene.add(richGroup);
  const rich = StandingFigure({ u: 0.78, shirt: '#2e6fd8', expr: 'smug', hair: '#26262b', pose: 'crossed', hairTheta: 1.3, footSpread: 0.16 });
  richGroup.add(rich);
  const richAngryHead = CharHead({ expr: 'angry', hair: '#26262b', hairTheta: 1.3 });
  richAngryHead.visible = false;
  rich.userData.head.add(richAngryHead);
  // CHALLENGER 1 (yellow) — carries hay bales from the cart
  const yelGroup = new THREE.Group(); yelGroup.position.set(-6.1, 0, -3.2); yelGroup.rotation.y = 2.6; scene.add(yelGroup);
  const yel = StandingFigure({ u: 0.72, shirt: SHIRT_YELLOW, expr: 'smug', hair: '#6a4a20', pose: 'hold', holdY: 1.16, hairTheta: 1.25, footSpread: 0.14 });
  if (yel.userData.panel) yel.userData.panel.visible = false;
  const yelBale = mkBale(); yelBale.position.set(0, 0.98, 0.42); yelBale.scale.setScalar(0.92);
  yelGroup.add(yelBale);
  yelGroup.add(yel);
  // CHALLENGER 2 (green) — stands by his smoking pot
  const grnGroup = new THREE.Group(); grnGroup.position.set(2.35, 0, -11.4); grnGroup.rotation.y = 0.9; scene.add(grnGroup);
  const grn = StandingFigure({ u: 0.72, shirt: SHIRT_GREEN, expr: 'smug', hair: HAIR_GREEN, pose: 'crossed', hairTheta: 1.25, footSpread: 0.14 });
  grnGroup.add(grn);
  // HERO (cream shirt, brown hair) — worried, later quiet-smug
  const heroGroup = new THREE.Group(); heroGroup.position.set(-3.6, 0, 1.5); heroGroup.rotation.y = 0.3; scene.add(heroGroup);
  const hero = StandingFigure({ u: 0.74, shirt: '#f2ede2', expr: 'worried', hair: HAIR_HERO, pose: 'crossed', hairTheta: 1.3, footSpread: 0.13 });
  heroGroup.add(hero);
  const heroSmugHead = CharHead({ expr: 'smug', hair: HAIR_HERO, hairTheta: 1.3 });
  heroSmugHead.visible = false;
  hero.userData.head.add(heroSmugHead);
  // hero's small bag (world prop: hand -> floor by the table)
  const bag = new THREE.Group();
  {
    const sack = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10), new THREE.MeshStandardMaterial({ color: '#7a5c38', roughness: 1 }));
    sack.scale.set(1, 0.82, 1); bag.add(sack);
    const knot = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.12, 8), new THREE.MeshStandardMaterial({ color: '#5f4629', roughness: 1 }));
    knot.position.y = 0.18; bag.add(knot);
  }
  bag.position.set(-3.3, 0.85, 1.35); scene.add(bag);
  // keys prop (world space, rich hand -> hero hand during L12)
  const keys = new THREE.Group();
  {
    const gold = new THREE.MeshStandardMaterial({ color: '#d8a920', metalness: 0.85, roughness: 0.28 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 8, 20), gold); keys.add(ring);
    for (const dx of [-0.03, 0.035]) {
      const k = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.11, 0.008), gold);
      k.position.set(dx, -0.1, 0); keys.add(k);
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.008), gold);
      tooth.position.set(dx + 0.02, -0.14, 0); keys.add(tooth);
    }
  }
  keys.visible = false; scene.add(keys);
  // CROWD — 9 watchers in a loose arc
  const crowd = [];
  const crowdSpecs = [
    { p: [-6.4, 0, 0.6], s: '#c23b2e', e: 'laughCry', h: '#3a2415' },
    { p: [-5.0, 0, 2.6], s: '#3a9e8f', e: 'smug', h: '#191410' },
    { p: [-1.8, 0, 3.4], s: '#7a4a9e', e: 'laughCry', h: '#54331e' },
    { p: [-0.4, 0, 2.2], s: '#d86a2e', e: 'shocked', h: '#6a4a20' },
    { p: [1.2, 0, 3.6], s: '#8a8f96', e: 'laughCry', h: '#26262b' },
    { p: [2.8, 0, 1.8], s: '#c23b7a', e: 'smug', h: '#452c16' },
    { p: [4.3, 0, 3.2], s: '#3f9e2c', e: 'laughCry', h: '#9e5c14' },
    { p: [6.9, 0, 0.8], s: '#f0b400', e: 'smug', h: '#191410' },
    { p: [7.6, 0, -2.2], s: '#2e6fd8', e: 'shocked', h: '#54331e' },
  ];
  for (const cs of crowdSpecs) {
    const g = new THREE.Group(); g.position.set(...cs.p);
    g.rotation.y = (rng(crowd.length * 7 + 3)() - 0.5) * 0.8 + cs.p[0] * -0.03;
    const f = StandingFigure({ u: 0.68 + (crowd.length % 3) * 0.03, shirt: cs.s, expr: cs.e, hair: cs.h, pose: 'crossed', hairTheta: 1.28, footSpread: 0.13 });
    g.add(f); scene.add(g);
    crowd.push({ g, f, ph: crowd.length * 1.37 });
  }
  // two helpers by the cart
  for (const [x, z, ry] of [[-9.3, -2.2, 2.2], [-8.9, -5.4, 1.4]]) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
    g.add(StandingFigure({ u: 0.7, shirt: '#8a8f96', expr: 'smug', hair: '#3a2415', pose: 'crossed', hairTheta: 1.28, footSpread: 0.13 }));
  }

  const api = {
    setState(o) {
      const t = o.t || 0;
      // SUV arrival
      const sk = clamp(o.suvK || 0);
      const se = 1 - Math.pow(1 - sk, 2);
      suvGroup.position.x = lerp(-25, -6.5, se);
      // RICH: walk to doorway during L9 + face swap at L10
      const rk = clamp(o.richWalkK || 0);
      const re = rk * rk * (3 - 2 * rk);
      richGroup.position.set(lerp(5.6, 2.9, re), 0, lerp(-5.6, -9.2, re));
      richGroup.position.y = (rk > 0 && rk < 1) ? Math.abs(Math.sin(rk * 22)) * 0.04 : 0;
      richGroup.rotation.y = lerp(-0.45, 2.75, re);
      {
        const angry = (o.richFace || 0) > 0.5;
        rich.userData.head.children[0].visible = !angry;
        richAngryHead.visible = angry;
      }
      rich.userData.head.rotation.z = Math.sin(t * 1.7) * 0.02;
      // YELLOW: carry walk cart -> door -> corner (path param), bale toggle
      const yk = clamp(o.yellowK || 0);
      const yPath = [[-6.1, -3.2], [-3.4, -5.6], [-0.6, -8.8], [-3.4, -13.5], [-7.9, -18.2]];
      const seg = Math.min(3, Math.floor(yk * 4));
      const su = yk * 4 - seg;
      const sx = lerp(yPath[seg][0], yPath[seg + 1][0], su);
      const sz = lerp(yPath[seg][1], yPath[seg + 1][1], su);
      yelGroup.position.set(sx, (yk > 0 && yk < 1) ? Math.abs(Math.sin(yk * 46)) * 0.045 : 0, sz);
      const dx = yPath[seg + 1][0] - yPath[seg][0], dz = yPath[seg + 1][1] - yPath[seg][1];
      if (yk > 0 && yk < 1) yelGroup.rotation.y = Math.atan2(dx, dz);
      else if (yk >= 1) yelGroup.rotation.y = 2.4;
      yelBale.visible = !!o.yellowBale;
      // hay pile + cart stack
      const hk = clamp(o.hayK || 0);
      pileBales.forEach((b, i) => { b.visible = hk * pileBales.length > i + 0.5; });
      const ck = clamp(o.cartK === undefined ? 1 : o.cartK);
      cartBales.forEach((b, i) => { b.visible = ck * cartBales.length > i + 0.5; });
      // GREEN by the pot: idle sway; worried glance after the smoke fails
      grn.userData.head.rotation.y = Math.sin(t * 0.9) * 0.14;
      grnGroup.rotation.y = 0.9 + Math.sin(t * 0.5) * 0.03;
      // CROWD laugh / idle
      const laugh = clamp(o.crowdLaugh || 0);
      for (const c of crowd) {
        const bob = laugh * Math.abs(Math.sin(t * 7 + c.ph)) * 0.16 + Math.sin(t * 1.4 + c.ph) * 0.015;
        c.f.userData.head.rotation.x = bob;
        c.g.position.y = laugh * Math.abs(Math.sin(t * 7 + c.ph)) * 0.03;
      }
      // HERO path: crowd -> door -> table (heroK), then table -> door (heroK2)
      const hkA = clamp(o.heroK || 0);
      const hPath = [[-3.6, 1.5], [-1.7, -4.2], [-0.2, -9.6], [-0.95, -14.9]];
      const hseg = Math.min(2, Math.floor(hkA * 3));
      const hu = hkA * 3 - hseg;
      let hx = lerp(hPath[hseg][0], hPath[hseg + 1][0], hu);
      let hz = lerp(hPath[hseg][1], hPath[hseg + 1][1], hu);
      const hkB = clamp(o.heroK2 || 0);
      if (hkB > 0) { hx = lerp(-0.95, 1.75, hkB); hz = lerp(-14.9, -11.3, hkB); }
      const walking = (hkA > 0 && hkA < 1) || (hkB > 0 && hkB < 1);
      heroGroup.position.set(hx, walking ? Math.abs(Math.sin(t * 8.5)) * 0.045 : 0, hz);
      if (hkA > 0 && hkA < 1) {
        const ddx = hPath[hseg + 1][0] - hPath[hseg][0], ddz = hPath[hseg + 1][1] - hPath[hseg][1];
        heroGroup.rotation.y = Math.atan2(ddx, ddz);
      } else if (hkB > 0 && hkB < 1) {
        heroGroup.rotation.y = Math.atan2(1.75 + 0.95, -11.3 + 14.9);
      } else if (hkB >= 1) {
        heroGroup.rotation.y = 0.9; // face the rich man at the door
      } else if (hkA >= 1) {
        heroGroup.rotation.y = 2.43; // face the candle table
      }
      // hero bend at the table (figure-local tilt, feet stay planted) + face swap
      const bend = clamp(o.heroBend || 0);
      hero.rotation.x = 0.20 * bend;
      if (hero.userData.head) hero.userData.head.rotation.x = -0.09 * bend; // head stays near-upright
      hero.userData.head.rotation.x = -0.18 * bend + Math.sin(t * 1.8) * 0.015;
      {
        const smug = (o.heroFace || 0) > 0.5;
        hero.userData.head.children[0].visible = !smug;
        heroSmugHead.visible = smug;
      }
      // bag: hero hand -> floor beside the table
      const bk = clamp(o.bagK || 0);
      if (bk <= 0) bag.position.set(hx + 0.32, 0.85 + heroGroup.position.y, hz + (hkA >= 1 ? 0.3 : -0.15));
      else {
        const be = bk * bk * (3 - 2 * bk);
        bag.position.set(lerp(-0.63, -0.95, be), lerp(0.85, 0.17, be * be), lerp(-14.6, -15.3, be));
      }
      // candle + flame + light spread
      candleGroup.visible = (o.candleK || 0) > 0.5;
      const fk = clamp(o.flameK || 0);
      const flick = 0.9 + 0.1 * Math.sin(t * 23) + 0.05 * Math.sin(t * 41 + 1.7);
      flame.material.opacity = 0.92 * fk;
      const fs = 0.34 * fk * flick;
      flame.scale.set(fs * 0.62, fs, 1);
      flame.position.y = 1.0 + 0.008 * Math.sin(t * 29);
      const lk = clamp(o.lightK || 0);
      const le = lk * lk * (3 - 2 * lk);
      candleLight.intensity = le * 38 * flick + fk * 2.2;
      fillLight.intensity = le * 12;
      glow.material.opacity = le * 0.30 + fk * 0.10;
      const gs = 2 + le * 6.5;
      glow.scale.set(gs, gs * 0.8, 1);
      for (const w of washes) w.material.opacity = le * 0.42;
      floorGlow.material.opacity = le * 0.30;
      const fg = 3 + le * 13;
      floorGlow.scale.set(fg, fg, 1);
      for (const bm of lampBulbs) bm.emissiveIntensity = le * 0.55;
      candleGroup.userData.waxMat.emissiveIntensity = fk * 0.35 + le * 0.3;
      potGroup.userData.coalMat.emissiveIntensity = 1.6 - 0.9 * clamp(o.smokeVent || 0);
      // pot only appears when the second challenger brings it in (L4)
      potGroup.visible = t >= 11.5;
      // SMOKE — fill then vent out of the door
      const st = o.smokeT === undefined ? -1 : o.smokeT;
      const vent = clamp(o.smokeVent || 0);
      for (const sp of smoke) {
        const u = sp.userData;
        if (st < 0) { sp.material.opacity = 0; continue; }
        const cyc = ((st / u.rise) + u.ph) % 1;
        const age = cyc;
        let px = 1.6 + u.lat * age * 1.8 - age * age * 0.8;
        let pz = -12.6 + u.latZ * age * 1.2 - age * age * 2.6;
        let py = 0.6 + (age * age * 0.7 + age * 0.3) * (3.6 + u.lat * 0.4);
        // vent: drift to the door (+z) and out, rising outside
        px = lerp(px, 0.4 + u.lat * 1.4, vent * age);
        pz = lerp(pz, -6 + age * 7, vent * age);
        py = lerp(py, 1 + age * 4.5, vent * age);
        sp.position.set(px, py, pz);
        const s = u.sz * (0.45 + age * 1.6);
        sp.scale.set(s, s * 0.78, 1);
        const env = Math.min(1, age / 0.15) * (1 - clamp((age - 0.75) / 0.25));
        sp.material.opacity = 0.30 * env * clamp(st / 1.6) * (1 - vent * 0.82);
      }
      for (const hz of haze) hz.material.opacity = 0.11 * clamp(st < 0 ? 0 : st / 2.5) * (1 - vent);
      // KEYS handover (L12): rich hand -> hero hand
      const kk = clamp(o.keysK || 0);
      keys.visible = kk > 0;
      if (kk > 0) {
        const ke = kk * kk * (3 - 2 * kk);
        keys.position.set(lerp(2.62, 2.02, ke), 1.02 - Math.sin(ke * Math.PI) * 0.06, lerp(-9.35, -10.95, ke));
        keys.rotation.z = Math.sin(t * 2.2) * 0.15;
        keys.rotation.y = t * 0.6;
      }
    },
  };
  api.setState({ t: 0 });
  return { scene, api, exposure: 1.1, fog: { near: 34, far: 125, intensity: 0.8 } };
}
