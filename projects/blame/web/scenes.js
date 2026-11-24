// scenes.js — the four LOCKED car-match worlds, ported 1:1 from
// Scene1Real.tsx (V8) and Scene2Real/Scene3Real/Scene4Real.tsx
// (FINAL MATCH). Builders return { group, api } — api drives the
// per-frame animation state from main.js; static transforms are the
// verified locked placements.
import * as THREE from 'three';
import {
  INK, HAIR_HERO, HAIR_GREEN, SHIRT_YELLOW, SHIRT_GREEN,
  SkyDome, Clouds, Tree, Cypress, ScannedTree, Hedge,
  StandingFigure, SeatedFigure, CharHead, Limb, ContactShadow,
  prepareCar, rescueTailRims, SuvVehicle, GrassField, House,
  HighwayWall, PowerPole, canvasTex, grassTex, concreteTex,
  makeFaceTex, glareTex, collectWheels, spinWheels, RoundedBoxGeometry,
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
  sun.shadow.camera.far = 45;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  return { hemi, sun };
}

// ---------------- Scene 1 (LOCKED V8 world) ----------------
function buildDriver() {
  const g = new THREE.Group();
  const WHEEL = [0.38, 0.92, 0.57];
  const handL = [WHEEL[0] - 0.1, WHEEL[1] + 0.14, WHEEL[2] - 0.04];
  const handR = [WHEEL[0] + 0.1, WHEEL[1] + 0.14, WHEEL[2] - 0.04];
  const torsoG = new THREE.Group();
  torsoG.position.set(0.42, 0.776, -0.02); torsoG.rotation.set(-0.06, 0, -0.07); torsoG.scale.setScalar(0.923);
  const hull = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.52, 0.28),
    new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }));
  torsoG.add(hull);
  const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.52, 0.28),
    new THREE.MeshStandardMaterial({ color: SHIRT_YELLOW, roughness: 0.7 }));
  shirt.scale.set(0.9, 0.9, 0.82); torsoG.add(shirt);
  g.add(torsoG);
  g.add(Limb([0.217, 0.914, 0.091], handL, 0.0342));
  g.add(Limb([0.568, 0.914, 0.091], handR, 0.0342));
  const handMat = new THREE.MeshStandardMaterial({ color: INK, roughness: 0.85 });
  for (const h of [handL, handR]) {
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.048, 18, 12), handMat);
    hand.position.set(...h); g.add(hand);
  }
  const headG = new THREE.Group();
  headG.position.set(0.44, 1.192, 0); headG.rotation.set(0, 0.62, 0); headG.scale.setScalar(0.895);
  const inner = new THREE.Group(); inner.rotation.set(0, 0, -0.22);
  const hullS = new THREE.Mesh(new THREE.SphereGeometry(0.5, 48, 32),
    new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }));
  hullS.scale.set(0.69, 0.58, 0.455); inner.add(hullS);
  const bean = new THREE.Mesh(new THREE.SphereGeometry(0.5, 48, 32), new THREE.MeshStandardMaterial({
    color: '#fff6ea', roughness: 0.55, emissive: '#ffe9c9', emissiveIntensity: 0.75, envMapIntensity: 0.35,
  }));
  bean.scale.set(0.655, 0.545, 0.42); inner.add(bean);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.5, 48, 24, 0, Math.PI * 2, 0, 1.56),
    new THREE.MeshStandardMaterial({ color: HAIR_HERO, roughness: 0.9, side: THREE.DoubleSide }));
  cap.scale.set(0.672, 0.562, 0.437); cap.rotation.set(-0.05, 0, -0.13); inner.add(cap);
  const face = new THREE.Mesh(
    new THREE.CylinderGeometry(0.222, 0.222, 0.4, 32, 1, true, -0.62, 1.24),
    new THREE.MeshStandardMaterial({ map: makeFaceTex('smug'), transparent: true, roughness: 0.8, alphaTest: 0.02 }));
  face.position.set(0, 0.005, 0); inner.add(face);
  const gg = new THREE.Group(); gg.position.set(0.05, 0.168, 0.175); gg.rotation.set(-0.5, 0.22, -0.05); gg.scale.setScalar(0.9);
  for (const x of [-0.112, 0.112]) {
    const lg = new THREE.Group(); lg.position.set(x, 0, 0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.007, 8, 28),
      new THREE.MeshStandardMaterial({ color: '#e8d194', metalness: 0.75, roughness: 0.3 }));
    ring.scale.set(1.35, 0.95, 1); lg.add(ring);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.066, 24),
      new THREE.MeshStandardMaterial({ color: '#d7dee2', transparent: true, opacity: 0.16, roughness: 0.12, metalness: 0.1, side: THREE.DoubleSide }));
    lens.scale.set(1.35, 0.95, 1); lg.add(lens);
    gg.add(lg);
  }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.009, 0.009),
    new THREE.MeshStandardMaterial({ color: '#e8d194', metalness: 0.75, roughness: 0.3 }));
  bridge.position.set(0, 0.01, 0); gg.add(bridge);
  inner.add(gg);
  headG.add(inner);
  g.add(headG);
  g.userData.head = headG;
  return g;
}
function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
export function buildScene1(A) {
  const scene = new THREE.Scene();
  lights(scene, { hemiI: 0.55, sunPos: [6, 9, -4], shadowI: 0.85, mapSize: 1024, ext: 12 });
  scene.add(SkyDome());
  scene.add(Clouds([
    { p: [43.7, 20.7, 54.2], s: [19, 9], o: 0.9 },
    { p: [52.3, 27.8, 37.8], s: [13, 6.5], o: 0.55 },
    { p: [58.7, 38, 60.8], s: [14, 6], o: 0.35 },
  ]));
  // road (own texture clones so the scroll offset is scene-local)
  const aMap = A.asphalt.map.clone(); const aNor = A.asphalt.normalMap.clone(); const aRgh = A.asphalt.roughnessMap.clone();
  for (const t of [aMap, aNor, aRgh]) { t.needsUpdate = true; }
  const road = new THREE.Mesh(new THREE.PlaneGeometry(22, 110), new THREE.MeshStandardMaterial({
    map: aMap, normalMap: aNor, roughnessMap: aRgh, roughness: 1, color: '#bcbcb7', envMapIntensity: 0.22,
  }));
  road.rotation.x = -Math.PI / 2; road.receiveShadow = true; scene.add(road);
  const verge = new THREE.Mesh(new THREE.PlaneGeometry(46, 130),
    new THREE.MeshStandardMaterial({ color: '#3e8f1d', roughness: 1 }));
  verge.position.set(24, -0.005, 0); verge.rotation.x = -Math.PI / 2; scene.add(verge);
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 70),
    new THREE.MeshStandardMaterial({ color: '#e8ecf0', roughness: 0.8 }));
  lane.position.set(-2.6, 0.012, 5); lane.rotation.x = -Math.PI / 2; scene.add(lane);
  // guardrail: continuous panels static; posts scroll (4 m pitch)
  const rail = new THREE.Group(); rail.position.set(6.8, 0, 0); scene.add(rail);
  const posts = new THREE.Group(); rail.add(posts);
  const postMat = new THREE.MeshStandardMaterial({ color: '#a3a89c', metalness: 0.75, roughness: 0.4 });
  for (let i = 0; i < 27; i++) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.02, 0.16), postMat);
    post.position.set(0.09, 0.51, -44 + i * 4); posts.add(post);
  }
  const upPanel = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.26, 112),
    new THREE.MeshStandardMaterial({ color: '#e3e6d4', metalness: 0.15, roughness: 0.45, envMapIntensity: 0.5 }));
  upPanel.position.set(0, 0.84, 5); upPanel.rotation.z = 0.5; rail.add(upPanel);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 112),
    new THREE.MeshStandardMaterial({ color: '#f2f6fa', metalness: 0.3, roughness: 0.25, envMapIntensity: 0.6 }));
  strip.position.set(-0.055, 0.975, 5); rail.add(strip);
  const loPanel = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.24, 112),
    new THREE.MeshStandardMaterial({ color: '#d4d8c6', metalness: 0.15, roughness: 0.5, envMapIntensity: 0.45 }));
  loPanel.position.set(0.01, 0.62, 5); loPanel.rotation.z = -0.5; rail.add(loPanel);
  // scrolling backdrop: scanned trees, card trees, cypress, hedges
  const scrollers = [];
  const addScroll = (obj, baseZ) => { obj.userData.baseZ = baseZ; scrollers.push(obj); scene.add(obj); };
  const scannedSpecs = [
    { p: [22, 0, 2], s: 2.2, r: 0.9 }, { p: [21, 0, 12], s: 2.1, r: 0.4 },
    { p: [23, 0, 24], s: 2.3, r: 2.2 }, { p: [21.5, 0, 37], s: 2.0, r: 4.0 },
    { p: [24.5, 0, 49], s: 1.8, r: 1.1 },
  ];
  for (const sp of scannedSpecs) addScroll(ScannedTree(A.tree, sp.p, sp.s, sp.r), sp.p[2]);
  const cardSpecs = [
    [[30, 0, 0], 2.15, 5], [[30, 0, 6], 2.05, 3], [[32, 0, 16], 2.2, 11],
    [[30.5, 0, 22], 1.8, 19], [[30.5, 0, 28], 1.95, 23], [[32, 0, 34], 2.15, 29],
    [[33, 0, 40], 2.35, 31], [[31, 0, 46], 1.95, 41], [[31, 0, 52], 2.05, 47],
    [[32, 0, 60], 2.2, 53], [[37, 0, 10], 2.5, 61], [[38, 0, 26], 2.55, 67],
    [[37, 0, 44], 2.5, 71], [[39, 0, 58], 2.6, 73],
  ];
  for (const [p, s, seed] of cardSpecs) addScroll(Tree(p, s, seed), p[2]);
  addScroll(Cypress([21, 0, 16], 1.15), 16);
  addScroll(Cypress([21.5, 0, 29], 1.0), 29);
  [0, 6, 12, 18, 24, 30, 36, 42, 48].forEach((z, i) => addScroll(Hedge([20 + (i % 3), 0, z], 101 + i * 7), z));
  // THE CAR (locked transform) + driver + mirror + glare + pool
  const carGroup = new THREE.Group();
  carGroup.position.set(-0.5, 0, -0.7); carGroup.rotation.set(0, Math.PI + 0.1745, 0);
  const red = A.car.clone(true); prepareCar(red, '#ff2015', 0.22);
  carGroup.add(red);
  const driver = buildDriver(); carGroup.add(driver);
  // V8 door mirror (exact prop)
  const mirror = new THREE.Group(); mirror.position.set(1.04, 1.03, 1.07); mirror.rotation.set(0, -0.25, 0);
  {
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.019, 0.085, 10),
      new THREE.MeshStandardMaterial({ color: '#17181c', roughness: 0.55 }));
    stalk.position.set(-0.082, -0.018, 0); stalk.rotation.set(0, 0, 1.15); mirror.add(stalk);
    const housing = new THREE.Mesh(new RoundedBoxGeometry(0.155, 0.098, 0.072, 4, 0.03),
      new THREE.MeshPhysicalMaterial({ color: '#ff2015', metalness: 0, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.2, envMapIntensity: 0.95 }));
    mirror.add(housing);
    const rim = new THREE.Mesh(new RoundedBoxGeometry(0.138, 0.08, 0.012, 2, 0.005),
      new THREE.MeshStandardMaterial({ color: '#101216', roughness: 0.5 }));
    rim.position.set(0, 0, -0.033); mirror.add(rim);
    const glass = new THREE.Mesh(new THREE.ShapeGeometry(roundedRectShape(0.124, 0.066, 0.02), 12),
      new THREE.MeshStandardMaterial({ color: '#b8c9d4', metalness: 0.85, roughness: 0.07, envMapIntensity: 1.7, side: THREE.DoubleSide }));
    glass.position.set(0, 0, -0.0405); glass.rotation.set(0, Math.PI, 0); mirror.add(glass);
  }
  carGroup.add(mirror);
  const gt = glareTex();
  const glare = new THREE.Group(); glare.position.set(0.88, 0.97, 0.78);
  const gs1 = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
  gs1.scale.set(2.1, 1.25, 1); glare.add(gs1);
  const gs2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  gs2.scale.set(1.15, 0.7, 1); glare.add(gs2);
  carGroup.add(glare);
  carGroup.add(ContactShadow());
  scene.add(carGroup);
  const wheels = collectWheels(red);
  // blue car sliver behind
  const blueGroup = new THREE.Group(); blueGroup.position.set(5.9, 0, 15.0); blueGroup.rotation.set(0, Math.PI, 0);
  const blue = A.car.clone(true); prepareCar(blue, '#274b8f', 0.35);
  blueGroup.add(blue); scene.add(blueGroup);
  blueGroup.userData.baseZ = 15.0; scrollers.push(blueGroup);
  const api = {
    // scroll: metres travelled; weave: lateral offset of the hero car
    drive(scroll, weave = 0, headNod = 0) {
      for (const t of [aMap, aNor, aRgh]) t.offset.set(0, (scroll / 110) * 24);
      posts.position.z = scroll % 4;
      for (const o of scrollers) {
        let z = o.userData.baseZ + scroll * (o === blueGroup ? 0.82 : 1);
        while (z > 78) z -= 148;
        while (z < -70) z += 148;
        o.position.z = z;
      }
      spinWheels(wheels, -scroll / 0.33);
      carGroup.position.x = -0.5 + weave;
      carGroup.position.y = Math.sin(scroll * 9.0) * 0.006;
      driver.userData.head.rotation.z = headNod;
    },
  };
  return { scene, api, exposure: 1.12, fog: { near: 15, far: 64, intensity: 0.8 } };
}

// ---------------- Scene 2 (FINAL MATCH world) ----------------
export function buildScene2(A) {
  const scene = new THREE.Scene();
  lights(scene, { hemiI: 0.55, sunPos: [-6, 9, 4], shadowI: 0.85, mapSize: 1024, ext: 14 });
  scene.add(SkyDome('#1466e6', '#3f96f0', '#cfe8fb'));
  scene.add(Clouds([
    { p: [-13, 6.2, -42], s: [16, 6.5], o: 0.95 },
    { p: [7, 7.0, -46], s: [19, 7.5], o: 1.0 },
    { p: [22, 6.0, -42], s: [14, 6], o: 0.9 },
    { p: [-25, 9.0, -48], s: [17, 7], o: 0.6 },
  ]));
  const grass = grassTex(); grass.wrapS = grass.wrapT = THREE.RepeatWrapping; grass.repeat.set(80, 80);
  const lawnMat = (() => {
    if (!A.grassGround) return null;
    const g = A.grassGround;
    const map = g.map.clone(); map.repeat.set(30, 23); map.needsUpdate = true;
    const nrm = g.normalMap.clone(); nrm.repeat.set(30, 23); nrm.needsUpdate = true;
    const rgh = g.roughnessMap.clone(); rgh.repeat.set(30, 23); rgh.needsUpdate = true;
    return new THREE.MeshStandardMaterial({
      map, normalMap: nrm, roughnessMap: rgh, color: new THREE.Color(0.38, 0.72, 0.58), roughness: 1,
    });
  })();
  const bankMat = (() => {
    if (!A.grassGround) return null;
    const g = A.grassGround;
    const map = g.map.clone(); map.repeat.set(26, 4); map.needsUpdate = true;
    const nrm = g.normalMap.clone(); nrm.repeat.set(26, 4); nrm.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map, normalMap: nrm, color: new THREE.Color(0.39, 0.71, 0.58), roughness: 1 });
  })();
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(90, 70),
    lawnMat || new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }));
  lawn.position.set(0, -0.01, -6); lawn.rotation.x = -Math.PI / 2; lawn.receiveShadow = true; scene.add(lawn);
  const concrete = concreteTex(); concrete.wrapS = concrete.wrapT = THREE.RepeatWrapping; concrete.repeat.set(12, 1);
  const driveG = new THREE.Group(); driveG.rotation.y = -0.1; scene.add(driveG);
  const slab = new THREE.Mesh(new THREE.PlaneGeometry(90, 7.5),
    new THREE.MeshStandardMaterial({ map: concrete, roughness: 0.95 }));
  slab.position.set(0, 0.006, -2.6); slab.rotation.x = -Math.PI / 2; slab.receiveShadow = true; driveG.add(slab);
  const seam = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 7.5),
    new THREE.MeshStandardMaterial({ color: '#a9aeb4', roughness: 1 }));
  seam.position.set(3.4, 0.012, -2.6); seam.rotation.x = -Math.PI / 2; driveG.add(seam);
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(30, 8), new THREE.MeshBasicMaterial({
    map: canvasTex(64, 256, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, 'rgba(14,22,7,0)'); gr.addColorStop(1, 'rgba(14,22,7,0.40)');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
    }), transparent: true, depthWrite: false,
  }));
  shade.position.set(0, 0.012, 5.4); shade.rotation.x = -Math.PI / 2; scene.add(shade);
  const bank = new THREE.Mesh(new THREE.BoxGeometry(80, 0.5, 12.4),
    bankMat || new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }));
  bank.position.set(0, 0.25, -12.8); bank.receiveShadow = true; scene.add(bank);
  if (A.grassFull) scene.add(GrassField(A.grassFull, {
    area: [-9, 9, 0.95, 5.2], count: 340, scale: [1.0, 1.8], seed: 11, tint: ['#4d8a2f', '#7cb54a'], bright: 0.9,
  }));
  if (A.grassTuft) {
    scene.add(GrassField(A.grassTuft, { area: [-10, 10, 3.8, 6.9], count: 850, scale: [1.3, 2.1], seed: 29, tint: ['#4d8a2f', '#7cb54a'], bright: 0.82 }));
    scene.add(GrassField(A.grassTuft, { area: [-10, 10, 0.95, 4.2], count: 1500, scale: [0.95, 1.45], seed: 23, tint: ['#558c31', '#9ec763'], bright: 1.35 }));
    scene.add(GrassField(A.grassTuft, { area: [-9.5, 9.5, 1.0, 1.4], count: 180, scale: [0.65, 1.0], seed: 37, tint: ['#558c31', '#8cba52'], bright: 0.9 }));
    scene.add(GrassField(A.grassTuft, { area: [-10, 10.5, -13.5, -7], count: 100, scale: [1.2, 2.0], seed: 41, y: 0.5, tint: ['#7cab52', '#b9d284'], bright: 1.1 }));
  }
  scene.add(House({ p: [-8.8, 0, -12.5], w: 7.4, h: 4.4, d: 4.8, wall: '#eef0ee', roof: '#7d8288', rotY: 0.55 }));
  scene.add(House({ p: [-4.6, 0, -16.5], w: 5.4, h: 2.9, d: 4.2, wall: '#e8e2d4', roof: '#8a6a4e', rotY: 0.1 }));
  scene.add(House({ p: [3.4, 0, -17], w: 4.6, h: 2.7, d: 4.0, wall: '#f2f2ee', roof: '#9aa0a4', rotY: -0.15 }));
  scene.add(House({ p: [9.5, 0, -17.5], w: 5.4, h: 3.0, d: 4.2, wall: '#e9ebe6', roof: '#7d8288', rotY: -0.3 }));
  scene.add(ScannedTree(A.tree, [2.44, 0.5, -12], [0.75, 1.5, 0.75], 0.7));
  scene.add(ScannedTree(A.tree, [3.86, 0.5, -13], [0.62, 1.2, 0.62], 2.1));
  scene.add(Tree([-13.5, 0, -10], 1.9, 23));
  // THE CAR (locked transform)
  const carGroup = new THREE.Group();
  carGroup.position.set(-2.6, 0, -5.35); carGroup.rotation.set(0, -2.28, 0); carGroup.scale.setScalar(1.62);
  const red = A.car.clone(true); prepareCar(red, '#ff2015', 0.22); rescueTailRims(red);
  carGroup.add(red);
  carGroup.add(ContactShadow([4.4, 7.2], 0.44, [0.5, 0.015, -0.1]));
  scene.add(carGroup);
  // THE HERO (locked transform)
  const heroGroup = new THREE.Group(); heroGroup.position.set(-1.43, 0, 0);
  const hero = StandingFigure({
    u: 0.78, shirt: SHIRT_YELLOW, expr: 'smugGlasses', hair: HAIR_HERO,
    glasses: 'dark', pose: 'crossed', hairTheta: 1.12, footSpread: 0.22,
  });
  heroGroup.add(hero); scene.add(heroGroup);
  const api = {
    // headDown: 0..1 (1 = chin down, fed up), stepK: 0..1 step toward car
    setHero(headDown, stepK, breathe = 0) {
      hero.userData.head.rotation.x = 0.34 * headDown;
      hero.userData.head.rotation.z = 0.05 * headDown;
      heroGroup.position.z = -0.22 * stepK;
      heroGroup.position.y = breathe;
    },
  };
  return { scene, api, exposure: 1.12, fog: { near: 25, far: 95, intensity: 0.8 } };
}

// ---------------- shared highway backdrop (S3/S4) ----------------
export function HighwayBackdrop(A, { dashX = 0.6, yellowX = -1.9 } = {}) {
  const g = new THREE.Group();
  const farCols = ['#c8ccd0', '#7d848c', '#aeb6bd', '#8d949c'];
  const farScales = [1.0, 0.95, 0.9, 0.85];
  const asphaltMat = (() => {
    const map = A.asphalt.map.clone();
    const normalMap = A.asphalt.normalMap.clone();
    const roughnessMap = A.asphalt.roughnessMap.clone();
    for (const t of [map, normalMap, roughnessMap]) {
      t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 40);
    }
    return new THREE.MeshStandardMaterial({
      map, normalMap, roughnessMap, roughness: 0.96, color: new THREE.Color('#c8c8d0'),
    });
  })();
  const vergeMat = (() => {
    if (!A.grassGround) return null;
    const gr = A.grassGround;
    const map = gr.map.clone(); map.repeat.set(8, 44); map.needsUpdate = true;
    const nrm = gr.normalMap.clone(); nrm.repeat.set(8, 44); nrm.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map, normalMap: nrm, color: new THREE.Color(0.44, 0.76, 0.9), roughness: 1 });
  })();
  const bankMatH = (() => {
    if (!A.grassGround) return null;
    const gr = A.grassGround;
    const map = gr.map.clone(); map.repeat.set(8, 26); map.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map, color: new THREE.Color(0.44, 0.76, 0.9), roughness: 1 });
  })();
  const road = new THREE.Mesh(new THREE.PlaneGeometry(46, 160), asphaltMat);
  road.rotation.x = -Math.PI / 2; road.position.set(0.5, 0, -35); road.receiveShadow = true; g.add(road);
  for (const [x, w] of [[33, 24], [-26, 18]]) {
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(w, 160),
      vergeMat || new THREE.MeshStandardMaterial({ color: '#6d8a3c', roughness: 1 }));
    apron.rotation.x = -Math.PI / 2; apron.position.set(x, -0.02, -35); apron.receiveShadow = true; g.add(apron);
  }
  if (A.grassTuft) {
    g.add(GrassField(A.grassTuft, { area: [9, 17, -34, -6], count: 46, scale: [1.4, 2.4], seed: 53, y: 1.2, tint: ['#7cab52', '#b9d284'], bright: 1.0 }));
    g.add(GrassField(A.grassTuft, { area: [-20, -9, -14, 2], count: 30, scale: [1.2, 2.0], seed: 59, tint: ['#7cab52', '#b9d284'], bright: 1.0 }));
  }
  const lineMat = new THREE.MeshStandardMaterial({ color: '#e8e6da', roughness: 0.8 });
  for (const x of [-4.4, 5.6]) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 130), lineMat);
    line.rotation.x = -Math.PI / 2; line.position.set(x, 0.012, -30); g.add(line);
  }
  const yelMat = new THREE.MeshStandardMaterial({ color: '#e8c832', roughness: 0.8 });
  for (let i = 0; i < 12; i++) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 3), yelMat);
    dash.rotation.x = -Math.PI / 2; dash.position.set(yellowX, 0.011, 2 - i * 7); g.add(dash);
    const wd = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 3), lineMat);
    wd.rotation.x = -Math.PI / 2; wd.position.set(dashX, 0.012, 4 - i * 7); g.add(wd);
  }
  const bank = new THREE.Mesh(new THREE.BoxGeometry(24, 1.2, 85),
    bankMatH || new THREE.MeshStandardMaterial({ color: '#77913f', roughness: 1 }));
  bank.position.set(18, 0.6, -32); bank.receiveShadow = true; g.add(bank);
  const wall1 = new THREE.Group(); wall1.position.set(7.2, 1.2, -24); wall1.rotation.y = Math.PI / 2;
  wall1.add(HighwayWall({ p: [0, 0, 0], len: 58, h: 2.2 })); g.add(wall1);
  g.add(PowerPole([8.2, 1.2, -10])); g.add(PowerPole([8.2, 1.2, -24])); g.add(PowerPole([8.2, 1.2, -40]));
  const wall2 = new THREE.Group(); wall2.position.set(0, 1.2, -40);
  wall2.add(HighwayWall({ p: [0, 0, 0], len: 36, h: 2.2 })); g.add(wall2);
  g.add(ScannedTree(A.tree, [13, 1.2, -10], 2.0, 0.7));
  g.add(ScannedTree(A.tree, [15.5, 1.2, -20], 2.3, 2.0));
  g.add(ScannedTree(A.tree, [12.5, 1.2, -34], 2.1, 3.6));
  g.add(Cypress([11.5, 1.2, -26], 1.5));
  g.add(Cypress([14, 1.2, -44], 1.7));
  g.add(ScannedTree(A.tree, [-20, 0, -52], 2.3, 2.8));
  g.add(ScannedTree(A.tree, [-4, 0, -42], 2.0, 4.4));
  g.add(Tree([-16, 0, -38], 1.5, 71));
  g.add(Tree([5, 0, -46], 1.5, 97));
  const farPos = [[-2.6, 0, -24, Math.PI], [-3.4, 0, -48, Math.PI + 0.06], [-4.4, 0, -33, Math.PI - 0.04], [-5.8, 0, -60, Math.PI + 0.03]];
  farPos.forEach(([x, y, z, ry], i) => {
    const c = A.car.clone(true); prepareCar(c, farCols[i], i < 2 ? 0.45 : 0.5);
    const grp = new THREE.Group(); grp.position.set(x, y, z); grp.rotation.y = ry; grp.scale.setScalar(farScales[i]);
    grp.add(c); g.add(grp);
  });
  return g;
}

function suvDriverHead() {
  const g = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.6, 0.27),
    new THREE.MeshStandardMaterial({ color: '#2e4256', roughness: 0.9 }));
  torso.position.set(-0.137, 0.841, 0.109); g.add(torso);
  const headG = new THREE.Group();
  headG.position.set(-0.137, 1.477, 0.274); headG.scale.set(0.564, 0.645, 0.645);
  headG.add(CharHead({ expr: 'angry', hair: '#120d0a', glasses: null, sweat: null, hairTheta: 1.45 }));
  g.add(headG);
  return g;
}

// ---------------- Scene 3 (FINAL MATCH world) ----------------
export function buildScene3(A) {
  const scene = new THREE.Scene();
  lights(scene, { hemiI: 0.35, sunPos: [7, 10, 3], shadowI: 1.0, mapSize: 2048, ext: 17, ambI: 0.14 });
  scene.add(SkyDome('#2273e6', '#5ea9f2', '#e8f3fc'));
  scene.add(Clouds([
    { p: [-16, 11, -58], s: [20, 7], o: 0.9 },
    { p: [6, 13, -64], s: [24, 8], o: 0.95 },
    { p: [22, 10, -52], s: [15, 6], o: 0.8 },
    { p: [-30, 14, -68], s: [18, 7], o: 0.6 },
    { p: [-6, 15.5, -70], s: [11, 4], o: 0.85 },
    { p: [16, 16.5, -74], s: [13, 4.5], o: 0.8 },
    { p: [-24, 17, -76], s: [10, 3.6], o: 0.7 },
  ]));
  scene.add(HighwayBackdrop(A, { dashX: 2.1, yellowX: -3.2 }));
  // BLUE SUV (locked transform) — wrapped so braking pitch pivots at ground
  const blueWrap = new THREE.Group(); scene.add(blueWrap);
  const blueGroup = new THREE.Group();
  blueGroup.position.set(-2.72, 0, -4.6); blueGroup.rotation.set(0, 0.12, 0); blueGroup.scale.setScalar(1.75);
  if (A.suv) blueGroup.add(SuvVehicle(A.suv, { paint: '#83c2f7', variant: 'blue' }));
  blueGroup.add(suvDriverHead());
  blueWrap.add(blueGroup);
  // WHITE SUV (locked, static)
  const whiteGroup = new THREE.Group();
  whiteGroup.position.set(1.25, 0, -23.77); whiteGroup.rotation.set(0, 0.508, 0); whiteGroup.scale.setScalar(2.516);
  if (A.suv) whiteGroup.add(SuvVehicle(A.suv, { paint: '#f2f4f5', variant: 'white' }));
  scene.add(whiteGroup);
  // RED car (locked transform) — animated in from off-frame during beat 3
  const redGroup = new THREE.Group();
  redGroup.position.set(4.75, 0, 1.75); redGroup.rotation.set(0, 1.92, 0); redGroup.scale.setScalar(1.3);
  const red = A.car.clone(true); prepareCar(red, '#ff2015', 0.22); rescueTailRims(red);
  redGroup.add(red);
  redGroup.add(ContactShadow([3.1, 6.0], 0.3, [0.15, 0.015, -0.15]));
  scene.add(redGroup);
  // GREEN (locked transform)
  const greenGroup = new THREE.Group(); greenGroup.position.set(0.14, 0, 3.58); scene.add(greenGroup);
  const green = StandingFigure({
    u: 0.705, shirt: SHIRT_GREEN, expr: 'shocked', hair: HAIR_GREEN, sweat: 1,
    pose: 'holdSide', holdY: 1.38, panelW: 1.0, panelH: 0.29, panelDx: 0.7,
    footSpread: 0.46, hairTheta: 1.2, stretchY: 1.1,
  });
  greenGroup.add(green);
  // YELLOW seated (locked transform — the landing pose)
  const yellowSeatGroup = new THREE.Group();
  yellowSeatGroup.position.set(1.09, 0, 5.0); yellowSeatGroup.rotation.set(0, -0.62, 0);
  const yellowSeat = SeatedFigure({
    u: 0.59, expr: 'smugTired', sweat: -1, recline: 0.52, legLen: 1.15, torsoH: 0.8,
    hairTheta: 1.18, headYaw: 0.35, torsoLong: 1.22, bodyShiftZ: -0.06,
  });
  yellowSeatGroup.add(yellowSeat); scene.add(yellowSeatGroup);
  // YELLOW standing (the dive start) — panel hidden, arms reaching (holdSide)
  const yellowStandGroup = new THREE.Group();
  yellowStandGroup.position.set(2.7, 0, 3.3); yellowStandGroup.rotation.set(0, -1.15, 0);
  const yellowStand = StandingFigure({
    u: 0.59, shirt: SHIRT_YELLOW, expr: 'smugTired', hair: HAIR_HERO, sweat: -1,
    pose: 'holdSide', holdY: 1.3, panelW: 1.0, panelH: 0.29, footSpread: 0.3, hairTheta: 1.18,
  });
  if (yellowStand.userData.panel) yellowStand.userData.panel.visible = false;
  yellowStandGroup.add(yellowStand); scene.add(yellowStandGroup);
  const RED_LOCK = { p: new THREE.Vector3(4.75, 0, 1.75), ry: 1.92 };
  const RED_START = { p: new THREE.Vector3(12.5, 0, 10.5), ry: 2.65 };
  const BLUE_LOCK = { p: new THREE.Vector3(-2.72, 0, -4.6) };
  const BLUE_START = { p: new THREE.Vector3(-3.9, 0, -19.5) };
  const api = {
    // redK: red car dart-in 0..1; blueK: SUV approach 0..1; brakeK: nose dip;
    // stumbleK: green stumble; diveK: yellow dive 0..1 (swap at 0.72); pullK: green pulled clear
    setState({ redK = 1, blueK = 1, brakeK = 0, stumbleK = 0, diveK = 1, pullK = 0 }) {
      redGroup.position.lerpVectors(RED_START.p, RED_LOCK.p, redK);
      redGroup.rotation.y = RED_START.ry + (RED_LOCK.ry - RED_START.ry) * redK;
      blueGroup.position.lerpVectors(BLUE_START.p, BLUE_LOCK.p, blueK);
      blueWrap.position.copy(blueGroup.position);
      blueWrap.rotation.x = 0.045 * brakeK;
      blueGroup.position.set(0, -0.05 * brakeK, 0);
      blueWrap.position.y = 0;
      const wob = Math.sin(Math.min(1, stumbleK) * Math.PI);
      greenGroup.position.set(0.14 + 0.30 * pullK, 0, 3.58 + 0.34 * stumbleK - 0.18 * pullK);
      greenGroup.rotation.x = 0.13 * wob * (1 - pullK);
      greenGroup.rotation.z = 0.05 * wob;
      if (diveK < 0.72) {
        yellowStandGroup.visible = true; yellowSeatGroup.visible = false;
        const k = diveK / 0.72;
        yellowStandGroup.position.set(2.7 - 1.45 * k, 0, 3.3 + 1.35 * k);
        yellowStandGroup.rotation.x = 0.5 * k * k;
        yellowStandGroup.rotation.y = -1.15 + 0.5 * k;
      } else {
        yellowStandGroup.visible = false; yellowSeatGroup.visible = true;
      }
    },
  };
  api.setState({});
  return { scene, api, exposure: 1.06, fog: { near: 16, far: 72, intensity: 0.8 } };
}

// ---------------- Scene 4 (FINAL MATCH world) ----------------
export function buildScene4(A) {
  const scene = new THREE.Scene();
  lights(scene, { hemiI: 0.35, sunPos: [7, 10, 3], shadowI: 1.0, mapSize: 2048, ext: 17, ambI: 0.14 });
  scene.add(SkyDome('#2b7de6', '#67adf2', '#e8f3fc'));
  scene.add(Clouds([
    { p: [-14, 10, -55], s: [18, 6.5], o: 0.9 },
    { p: [8, 12, -60], s: [22, 7.5], o: 0.95 },
    { p: [24, 9, -50], s: [14, 5.5], o: 0.8 },
  ]));
  scene.add(HighwayBackdrop(A, { dashX: -1.2, yellowX: -7 }));
  // WHITE SUV (locked) + dashcam prop for the reveal beat
  const whiteGroup = new THREE.Group();
  whiteGroup.position.set(-0.9, 0, -4.42); whiteGroup.rotation.set(0, 0.505, 0); whiteGroup.scale.setScalar(1.155);
  if (A.suv) whiteGroup.add(SuvVehicle(A.suv, { paint: '#f2f4f5', variant: 'white' }));
  const dashcam = new THREE.Group();
  const dcBody = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.1, 0.05),
    new THREE.MeshStandardMaterial({ color: '#101216', roughness: 0.5 }));
  dashcam.add(dcBody);
  const dcLens = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.02, 12),
    new THREE.MeshStandardMaterial({ color: '#28405e', roughness: 0.2, metalness: 0.4 }));
  dcLens.rotation.x = Math.PI / 2; dcLens.position.set(0, 0, 0.035); dashcam.add(dcLens);
  const dcLedMat = new THREE.MeshStandardMaterial({ color: '#3a0d0d', emissive: '#ff2222', emissiveIntensity: 0.4 });
  const dcLed = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 8), dcLedMat);
  dcLed.position.set(0.06, 0.03, 0.03); dashcam.add(dcLed);
  dashcam.position.set(0.25, 1.8, 1.02); dashcam.rotation.x = 0.35;
  whiteGroup.add(dashcam);
  scene.add(whiteGroup);
  // RED car (locked)
  const redGroup = new THREE.Group();
  redGroup.position.set(3.75, 0, 2.3); redGroup.rotation.set(0, 1.6, 0); redGroup.scale.setScalar(1.28);
  const red = A.car.clone(true); prepareCar(red, '#ff2015', 0.22); rescueTailRims(red);
  redGroup.add(red);
  redGroup.add(ContactShadow([3.1, 6.0], 0.3, [0.15, 0.015, -0.15]));
  scene.add(redGroup);
  // GREEN worried (locked)
  const greenGroup = new THREE.Group(); greenGroup.position.set(-0.51, 0, 3.35); scene.add(greenGroup);
  const green = StandingFigure({
    u: 0.717, shirt: SHIRT_GREEN, expr: 'worried', hair: HAIR_GREEN, sweat: 1,
    pose: 'hold', holdY: 1.38, panelW: 0.86, panelH: 0.25, footSpread: 0.18,
    hairTheta: 1.24, stretchY: 1.03,
  });
  greenGroup.add(green);
  // YELLOW laugh-cry seated (locked)
  const yellowGroup = new THREE.Group();
  yellowGroup.position.set(0.57, 0, 4.36); yellowGroup.rotation.set(0, -0.95, 0);
  const yellow = SeatedFigure({
    u: 0.65, expr: 'laughCry', sweat: -1, recline: 0.76, legLen: 1.35, torsoH: 0.82,
    hairTheta: 1.18, headYaw: 0.3, torsoLong: 1.12, bodyShiftZ: 0.26, headDx: -0.09, headDy: 0.1,
  });
  yellowGroup.add(yellow); scene.add(yellowGroup);
  const api = {
    // greenHeadYaw: radians; yellowLaugh: 0..1 shake amount; ledI: dashcam LED intensity
    setState({ greenHeadYaw = 0, yellowLaugh = 0, ledI = 0.4 }) {
      green.userData.head.rotation.y = greenHeadYaw;
      yellow.userData.head.rotation.z = 0.06 + Math.sin(yellowLaugh * Math.PI * 6) * 0.05 * yellowLaugh;
      yellow.userData.head.rotation.x = 0.18 + Math.sin(yellowLaugh * Math.PI * 3) * 0.04 * yellowLaugh;
      dcLedMat.emissiveIntensity = ledI;
    },
  };
  api.setState({});
  return { scene, api, exposure: 1.06, fog: { near: 14, far: 65, intensity: 0.8 } };
}
