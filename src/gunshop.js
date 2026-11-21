// A medium-sized gun shop across the road from the other shops: "Big Al's Guns".
// Inside it is split down the middle. One half is tactical and self-defence
// (black rifles and shotguns on a slat wall, pistols, body armour, ammo, a gun
// safe); the other half is hunting (wooden rifles with scopes, bows, camouflage
// clothing, a mounted deer head and fish, duck decoys). A counter with glass
// display cases runs along the back. The guns are for looking at, not taking.
import * as THREE from 'three';
import { addObstacle, addFloor, addInterior } from './world.js';
import { clearings } from './grass.js';
import { block, canvasTexture, speckle } from './house.js';
import { label } from './store.js';

const SLAB = 0.15, HEIGHT = 3.4;
const W = 14, D = 10; // the building is 14 m wide and 10 m deep

// Builds the shop with its centre at (x, z). It faces -Z, toward the road.
export function createGunShop(scene, x, z, roadEdgeZ) {
  const shop = new THREE.Group();
  shop.position.set(x, 0, z);
  shop.rotation.y = Math.PI; // built with its front toward +Z, then turned to face the street
  const top = SLAB + HEIGHT;

  const plain = (color, roughness = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  const planks = (css, gap, repeatX, repeatY, upright) => new THREE.MeshStandardMaterial({
    roughness: 0.8,
    map: canvasTexture(64, (ctx, size) => {
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, size, size);
      speckle(ctx, size, 500, 0.06);
      ctx.fillStyle = gap;
      for (let i = 0; i < size; i += 16) upright ? ctx.fillRect(i, 0, 2, size) : ctx.fillRect(0, i, size, 2);
    }, repeatX, repeatY),
  });
  const m = {
    outside: planks('#3d4a30', 'rgba(0,0,0,0.35)', 1, 4, false),   // dark green boards
    concrete: new THREE.MeshStandardMaterial({ roughness: 1, map: canvasTexture(128, (ctx, s) => { ctx.fillStyle = '#b9b3a6'; ctx.fillRect(0, 0, s, s); speckle(ctx, s, 3000, 0.06); }, 3, 2) }),
    darkFloor: new THREE.MeshStandardMaterial({ roughness: 0.6, map: canvasTexture(128, (ctx, s) => { ctx.fillStyle = '#4a4c4f'; ctx.fillRect(0, 0, s, s); speckle(ctx, s, 3000, 0.07); }, 3, 4) }),
    woodFloor: planks('#9a7448', 'rgba(50,30,15,0.5)', 5, 1, true),
    slatWall: planks('#2a2c2f', 'rgba(0,0,0,0.6)', 1, 8, false),    // black slat wall for hanging guns
    woodWall: planks('#8a6240', 'rgba(40,24,12,0.5)', 8, 1, true),  // cabin-style panelling
    paint: plain(0xe6dfcd, 0.95),
    ceiling: plain(0xf0ede4, 1, { emissive: 0x403d36 }),
    black: plain(0x161718, 0.45, { metalness: 0.4 }),
    steel: plain(0x8f9396, 0.35, { metalness: 0.7 }),
    wood: plain(0x7a4f2c, 0.6),
    darkWood: plain(0x4a3424, 0.7),
    tan: plain(0xb59a6a, 0.9),
    orange: plain(0xf07a1c, 0.8),
    hide: plain(0x8a5f3a, 0.95),
    bone: plain(0xe6dcc0, 0.7),
    glass: new THREE.MeshStandardMaterial({ color: 0xbfe0e6, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.22, depthWrite: false }),
    light: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    camo: new THREE.MeshStandardMaterial({
      roughness: 1,
      map: canvasTexture(64, (ctx, s) => {
        ctx.fillStyle = '#5a6238';
        ctx.fillRect(0, 0, s, s);
        const colours = ['#3a4226', '#7a6a44', '#2b2f1e', '#8a8f5a'];
        for (let i = 0; i < 40; i++) {
          ctx.fillStyle = colours[i % 4];
          ctx.beginPath();
          ctx.ellipse(Math.random() * s, Math.random() * s, 4 + Math.random() * 9, 3 + Math.random() * 6, Math.random() * 3, 0, 7);
          ctx.fill();
        }
      }, 1, 1),
    }),
    target: new THREE.MeshBasicMaterial({
      map: canvasTexture(128, (ctx, s) => { // paper bullseye
        ctx.fillStyle = '#f2ecd8';
        ctx.fillRect(0, 0, s, s);
        for (let ring = 5; ring > 0; ring--) {
          ctx.fillStyle = ring === 1 ? '#c23a2e' : ring % 2 ? '#f2ecd8' : '#1c1d1f';
          ctx.beginPath();
          ctx.arc(s / 2, s / 2, ring * 11, 0, 7);
          ctx.fill();
        }
      }, 1, 1),
    }),
  };
  const sign = (text, small, background, ink, w = 512, h = 128) => new THREE.MeshBasicMaterial({ map: label(text, small, background, ink, w, h) });

  // Measurements are from the middle of the shop with its front toward +Z; `y` is height above the floor.
  const put = (material, w, h, d, px, y, pz, parent = shop) => block(parent, material, w, h, d, px, SLAB + y, pz);
  const solid = (lx, lz, w, d, height) => addObstacle(x - lx - w / 2, x - lx + w / 2, z - lz - d / 2, z - lz + d / 2, height);
  const thing = (material, w, h, d, px, pz) => { solid(px, pz, w, d, SLAB + h); return put(material, w, h, d, px, h / 2, pz); };
  const bar = (material, from, to, thick, parent = shop) => { // a rod between two points
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(thick, thick, from.distanceTo(to)), material);
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.lookAt(to);
    parent.add(mesh);
  };

  // --- Guns and bows, built from simple parts. Each lies along X with the muzzle toward +X. ---
  const part = (group, material, w, h, d, px, py, tilt = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(px, py, 0);
    mesh.rotation.z = tilt;
    group.add(mesh);
  };
  const makeGun = (kind) => {
    const g = new THREE.Group();
    if (kind === 'tactical') {            // black rifle with a magazine and pistol grip
      part(g, m.black, 0.3, 0.09, 0.045, 0, 0);
      part(g, m.black, 0.32, 0.06, 0.05, 0.3, 0.005);
      part(g, m.black, 0.2, 0.024, 0.024, 0.55, 0.01);
      part(g, m.black, 0.26, 0.1, 0.04, -0.28, -0.015);
      part(g, m.black, 0.045, 0.12, 0.04, -0.1, -0.09, 0.25);
      part(g, m.black, 0.055, 0.17, 0.035, 0.04, -0.12, -0.15);
      part(g, m.black, 0.14, 0.035, 0.03, 0.02, 0.065);
    } else if (kind === 'pump') {         // black pump-action shotgun
      part(g, m.black, 0.3, 0.08, 0.045, -0.05, 0);
      part(g, m.steel, 0.55, 0.028, 0.028, 0.37, 0.022);
      part(g, m.black, 0.42, 0.028, 0.028, 0.3, -0.012);
      part(g, m.black, 0.18, 0.05, 0.05, 0.3, -0.012);
      part(g, m.black, 0.3, 0.1, 0.04, -0.35, -0.03, 0.12);
    } else if (kind === 'hunting') {      // wooden bolt-action rifle with a scope
      part(g, m.wood, 0.62, 0.06, 0.045, 0, -0.01);
      part(g, m.wood, 0.3, 0.12, 0.045, -0.42, -0.045, 0.14);
      part(g, m.steel, 0.62, 0.024, 0.024, 0.38, 0.03);
      part(g, m.black, 0.28, 0.042, 0.042, 0.02, 0.085);
      part(g, m.black, 0.03, 0.03, 0.03, -0.06, 0.055);
      part(g, m.black, 0.03, 0.03, 0.03, 0.1, 0.055);
      part(g, m.steel, 0.05, 0.02, 0.05, -0.12, 0.035);
    } else if (kind === 'double') {       // side-by-side wooden shotgun
      part(g, m.wood, 0.34, 0.11, 0.045, -0.4, -0.04, 0.14);
      part(g, m.wood, 0.26, 0.05, 0.05, 0.02, -0.015);
      part(g, m.steel, 0.14, 0.07, 0.05, -0.16, 0);
      for (const side of [-0.014, 0.014]) {
        const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.026, 0.026), m.steel);
        barrel.position.set(0.25, 0.022, side);
        g.add(barrel);
      }
    } else if (kind === 'pistol') {
      part(g, m.black, 0.18, 0.038, 0.03, 0, 0);
      part(g, m.black, 0.045, 0.11, 0.03, -0.06, -0.065, 0.2);
      part(g, m.black, 0.05, 0.03, 0.012, -0.01, -0.035);
    } else {                              // compound bow: curved limbs, string, and a grip
      const limbs = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.014, 6, 18, Math.PI * 0.9), m.camo);
      limbs.rotation.z = -Math.PI * 0.45;
      g.add(limbs);
      part(g, m.bone, 0.006, 0.78, 0.006, 0.065, 0);
      part(g, m.black, 0.05, 0.16, 0.035, 0.4, 0);
      for (const end of [-0.39, 0.39]) {
        const cam = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.016, 10), m.steel);
        cam.rotation.x = Math.PI / 2;
        cam.position.set(0.065, end, 0);
        g.add(cam);
      }
    }
    return g;
  };
  const hang = (kind, px, y, pz, turn) => {
    const gun = makeGun(kind);
    gun.position.set(px, SLAB + y, pz);
    gun.rotation.y = turn;
    shop.add(gun);
    return gun;
  };

  // --- The building ---
  block(shop, m.concrete, W + 0.3, SLAB, D + 0.3, 0, SLAB / 2, 0);
  put(m.outside, W, HEIGHT, 0.2, 0, HEIGHT / 2, -D / 2 + 0.1);          // back
  put(m.outside, 0.2, HEIGHT, D, -W / 2 + 0.1, HEIGHT / 2, 0);          // sides
  put(m.outside, 0.2, HEIGHT, D, W / 2 - 0.1, HEIGHT / 2, 0);
  // Front: a doorway in the middle and a barred window either side.
  const fz = D / 2 - 0.1;
  for (const [px, w] of [[-6.4, 1.2], [-1.4, 1.2], [1.4, 1.2], [6.4, 1.2]]) put(m.outside, w, 2.4, 0.2, px, 1.2, fz);
  for (const px of [-3.9, 3.9]) {
    put(m.outside, 3.8, 0.9, 0.2, px, 0.45, fz);
    put(m.glass, 3.8, 1.5, 0.04, px, 1.65, fz);
    put(m.steel, 3.8, 0.06, 0.1, px, 0.93, fz + 0.1);
    put(m.steel, 3.8, 0.06, 0.1, px, 2.37, fz + 0.1);
    for (let i = 0; i < 9; i++) put(m.steel, 0.045, 1.5, 0.045, px - 1.7 + i * 0.425, 1.65, fz + 0.1); // security bars
  }
  put(m.outside, W, HEIGHT - 2.4, 0.2, 0, 2.4 + (HEIGHT - 2.4) / 2, fz);
  put(m.darkWood, W + 0.5, 0.22, D + 0.5, 0, HEIGHT + 0.11, 0);         // flat roof
  put(m.tan, W + 0.1, 0.5, 0.06, 0, HEIGHT - 0.3, D / 2 + 0.02);        // pale band above the windows
  put(sign("BIG AL'S GUNS", 'TACTICAL · HUNTING · AMMO · LICENSES', '#2c3a22', '#f3e6c0', 1024, 192), 7.2, 1.3, 0.14, 0, HEIGHT + 0.9, D / 2 - 0.1);
  put(m.darkWood, 0.12, 0.6, 0.12, -3, HEIGHT + 0.3, D / 2 - 0.2);
  put(m.darkWood, 0.12, 0.6, 0.12, 3, HEIGHT + 0.3, D / 2 - 0.2);
  put(sign('TACTICAL', null, '#1c1d1f', '#f2f0e6', 256, 64), 2.2, 0.36, 0.03, -3.9, HEIGHT - 0.3, D / 2 + 0.06);
  put(sign('HUNTING', null, '#5a3a22', '#f3e6c0', 256, 64), 2.2, 0.36, 0.03, 3.9, HEIGHT - 0.3, D / 2 + 0.06);
  put(sign('AMMO SALE', null, '#c23a2e', '#fff6dc', 256, 96), 0.9, 0.34, 0.02, -5.2, 1.2, fz - 0.04);
  put(sign('BAIT & LICENSES', null, '#f0c020', '#1c1d1f', 256, 96), 1.1, 0.34, 0.02, 5.1, 1.2, fz - 0.04);

  // Steel-framed glass door that slides aside as you walk up.
  const door = new THREE.Group();
  door.position.set(0, 0, fz - 0.06);
  put(m.glass, 1.6, 2.35, 0.03, 0, 1.18, 0, door);
  for (const [w, h, px, y] of [[1.6, 0.07, 0, 2.33], [1.6, 0.1, 0, 0.05], [0.07, 2.35, -0.765, 1.18], [0.07, 2.35, 0.765, 1.18], [1.6, 0.06, 0, 1.1]]) put(m.steel, w, h, 0.05, px, y, 0, door);
  put(sign('OPEN', null, '#2c3a22', '#f3e6c0', 128, 64), 0.4, 0.2, 0.035, 0, 1.6, 0, door);
  shop.add(door);

  // Forecourt down to the pavement, with parking lines and a pair of posts by the door.
  const gap = Math.abs(roadEdgeZ - (z - D / 2));
  block(shop, m.concrete, W + 2, 0.06, gap + 0.2, 0, 0.03, D / 2 + gap / 2).castShadow = false;
  for (const px of [-5.4, -2.7, 2.7, 5.4]) block(shop, plain(0xeeeae0, 0.7), 0.1, 0.005, 3, px, 0.064, D / 2 + gap - 2).castShadow = false;
  for (const px of [-1.5, 1.5]) { solid(px, D / 2 + 1.3, 0.2, 0.2, 1); block(shop, plain(0xf0c020, 0.6), 0.16, 0.95, 0.16, px, 0.48, D / 2 + 1.3); }

  // --- Inside: floors, wall finishes, ceiling and lights ---
  put(m.darkFloor, W / 2 - 0.1, 0.02, D - 0.4, -W / 4 - 0.05, 0.01, 0).castShadow = false;   // tactical half
  put(m.woodFloor, W / 2 - 0.1, 0.02, D - 0.4, W / 4 + 0.05, 0.01, 0).castShadow = false;    // hunting half
  put(m.steel, 0.06, 0.022, D - 0.4, 0, 0.011, 0);                                           // strip where they meet
  put(m.slatWall, 0.04, HEIGHT, D - 0.4, -W / 2 + 0.22, HEIGHT / 2, 0);
  put(m.woodWall, 0.04, HEIGHT, D - 0.4, W / 2 - 0.22, HEIGHT / 2, 0);
  put(m.slatWall, W / 2 - 0.2, HEIGHT, 0.04, -W / 4, HEIGHT / 2, -D / 2 + 0.22);
  put(m.woodWall, W / 2 - 0.2, HEIGHT, 0.04, W / 4, HEIGHT / 2, -D / 2 + 0.22);
  put(m.ceiling, W - 0.4, 0.02, D - 0.4, 0, HEIGHT - 0.01, 0);
  for (const [lx, colour] of [[-3.5, 0xf2f6ff], [3.5, 0xffe8c4]]) {
    for (const lz of [-1.8, 2]) put(m.light, 1.4, 0.04, 0.24, lx, HEIGHT - 0.04, lz);
    const glow = new THREE.PointLight(colour, 16, 12, 1.5);
    glow.position.set(lx, top - 0.7, 0);
    shop.add(glow);
  }
  // Hanging signs that name each half.
  for (const [px, text, back, ink] of [[-3.5, 'TACTICAL & DEFENSE', '#1c1d1f', '#f2f0e6'], [3.5, 'HUNTING & OUTDOORS', '#5a3a22', '#f3e6c0']]) {
    put(sign(text, null, back, ink, 512, 96), 3.2, 0.6, 0.05, px, HEIGHT - 0.7, 1.2);
    for (const side of [-1.4, 1.4]) put(m.steel, 0.02, 0.4, 0.02, px + side, HEIGHT - 0.2, 1.2);
  }

  // --- The counter along the back, with glass display cases and a till ---
  solid(0, -3.3, 11, 0.8, SLAB + 1.0);
  put(m.darkWood, 11, 0.62, 0.8, 0, 0.31, -3.3);
  put(m.glass, 11, 0.32, 0.8, 0, 0.78, -3.3);
  put(m.steel, 11.04, 0.03, 0.84, 0, 0.955, -3.3);
  put(m.tan, 10.9, 0.02, 0.72, 0, 0.63, -3.3);                         // felt lining
  for (let i = 0; i < 7; i++) {                                         // pistols in the tactical end of the case
    const pistol = makeGun('pistol');
    pistol.position.set(-5 + i * 0.62, SLAB + 0.66, -3.3);
    pistol.rotation.x = -Math.PI / 2;
    shop.add(pistol);
  }
  for (let i = 0; i < 6; i++) {                                         // hunting knives and scopes in the other end
    put(m.steel, 0.2, 0.012, 0.035, 1.1 + i * 0.7, 0.65, -3.2);
    put(m.wood, 0.11, 0.022, 0.03, 0.95 + i * 0.7, 0.65, -3.2);
    put(m.black, 0.24, 0.045, 0.045, 1.05 + i * 0.7, 0.67, -3.45);
  }
  put(m.black, 0.4, 0.16, 0.4, -0.7, 1.05, -3.3);                       // till
  put(m.black, 0.32, 0.24, 0.04, -0.7, 1.28, -3.15);

  // --- Tactical half (the left as you walk in) ---
  // Three rows of black rifles and shotguns on the side wall.
  for (let row = 0; row < 3; row++) for (let i = 0; i < 5; i++) {
    hang((row + i) % 3 === 2 ? 'pump' : 'tactical', -W / 2 + 0.3, 1.15 + row * 0.5, -2.2 + i * 1.3, Math.PI / 2);
  }
  // A board of pistols behind the counter.
  for (let row = 0; row < 3; row++) for (let i = 0; i < 9; i++) hang('pistol', -6 + i * 0.6, 1.5 + row * 0.36, -D / 2 + 0.28, 0);
  put(m.target, 0.6, 0.6, 0.02, -0.75, 2.2, -D / 2 + 0.26);
  // Ammunition shelves down the middle.
  const stock = [];
  const shelves = (px, pz, colours) => {
    solid(px, pz, 0.7, 3.2, SLAB + 1.6);
    put(m.black, 0.7, 0.12, 3.2, px, 0.06, pz);
    put(m.black, 0.05, 1.55, 3.2, px, 0.775, pz);
    for (let level = 0; level < 4; level++) {
      const y = 0.12 + level * 0.37;
      if (level) put(m.steel, 0.7, 0.02, 3.2, px, y, pz);
      for (const side of [-1, 1]) for (let i = 0; i < 16; i++) {
        stock.push({ px: px + side * 0.19, y: SLAB + y + 0.02 + 0.06, pz: pz - 1.45 + i * 0.193, color: colours[(Math.floor(i / 3) + level + (side > 0 ? 2 : 0)) % colours.length] });
      }
    }
  };
  shelves(-2.6, 0.2, [0x1c1d1f, 0xb3261e, 0xf0c020, 0x2f4f8a]);
  // Body armour on two stands, a gun safe, and stacked ammunition crates by the window.
  for (const px of [-5.6, -4.6]) {
    solid(px, 3.6, 0.5, 0.4, SLAB + 1.7);
    put(m.steel, 0.05, 1.1, 0.05, px, 0.55, 3.6);
    put(m.steel, 0.4, 0.04, 0.4, px, 0.02, 3.6);
    put(px < -5 ? m.black : m.tan, 0.48, 0.6, 0.28, px, 1.35, 3.6);
    put(px < -5 ? m.black : m.tan, 0.14, 0.14, 0.2, px - 0.2, 1.7, 3.6);
    put(px < -5 ? m.black : m.tan, 0.14, 0.14, 0.2, px + 0.2, 1.7, 3.6);
    for (let pouch = 0; pouch < 3; pouch++) put(m.black, 0.11, 0.16, 0.05, px - 0.14 + pouch * 0.14, 1.2, 3.77);
  }
  thing(m.black, 0.9, 1.7, 0.7, -6.25, -1.9 + 3.9);
  put(m.steel, 0.02, 0.12, 0.12, -5.79, 1.0, 2.0);                       // the safe's handle
  for (const [cx, cz, level] of [[-3.3, 4.2, 0], [-2.5, 4.2, 0], [-2.9, 4.2, 1]]) put(plain(0x4a5236, 0.9), 0.7, 0.36, 0.45, cx, 0.18 + level * 0.36, cz);
  solid(-2.9, 4.2, 1.6, 0.5, SLAB + 0.75);

  // --- Hunting half (the right as you walk in) ---
  // Wooden rifles and shotguns on the side wall.
  for (let row = 0; row < 3; row++) for (let i = 0; i < 5; i++) {
    hang((row + i) % 3 === 1 ? 'double' : 'hunting', W / 2 - 0.3, 1.15 + row * 0.5, -2.2 + i * 1.3, -Math.PI / 2);
  }
  // Bows on the back wall, either side of a mounted deer head, with a prize fish above the counter.
  for (const px of [1.4, 2.5, 5.6]) hang('bow', px, 1.85, -D / 2 + 0.3, 0);
  const V = THREE.Vector3;
  const deer = new THREE.Group();
  deer.position.set(4.05, SLAB + 2.15, -D / 2 + 0.26);
  block(deer, m.darkWood, 0.5, 0.62, 0.05, 0, 0, 0);
  block(deer, m.hide, 0.2, 0.3, 0.34, 0, 0, 0.18).rotation.x = -0.5;     // neck
  block(deer, m.hide, 0.17, 0.17, 0.34, 0, 0.16, 0.42).rotation.x = 0.25; // head
  block(deer, m.black, 0.09, 0.07, 0.06, 0, 0.1, 0.6);                   // nose
  for (const side of [-1, 1]) {
    block(deer, m.hide, 0.1, 0.05, 0.14, side * 0.14, 0.27, 0.3).rotation.z = side * 0.5; // ears
    block(deer, m.black, 0.03, 0.03, 0.03, side * 0.09, 0.2, 0.45);                       // eyes
    const base = new V(side * 0.06, 0.26, 0.34), beam = new V(side * 0.34, 0.6, 0.3);
    bar(m.bone, base, beam, 0.03, deer);                                                   // antlers
    bar(m.bone, beam, new V(side * 0.42, 0.85, 0.36), 0.025, deer);
    bar(m.bone, base.clone().lerp(beam, 0.4), new V(side * 0.14, 0.62, 0.46), 0.022, deer);
    bar(m.bone, base.clone().lerp(beam, 0.75), new V(side * 0.26, 0.86, 0.42), 0.022, deer);
  }
  shop.add(deer);
  put(m.darkWood, 1.0, 0.36, 0.04, 2.0, 2.75, -D / 2 + 0.26);
  const fish = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), plain(0x6f8a5a, 0.4));
  fish.scale.set(2.7, 0.9, 0.5);
  fish.position.set(1.95, SLAB + 2.75, -D / 2 + 0.33);
  shop.add(fish);
  put(plain(0x6f8a5a, 0.4), 0.02, 0.22, 0.03, 2.42, 2.75, -D / 2 + 0.33);
  // Shelves of shells and cartridges, a rail of camouflage jackets with an orange vest, boots and decoys.
  shelves(2.6, 0.2, [0x3f6a35, 0xe8742c, 0x7a4a2a, 0xc9a24a]);
  solid(5.3, 3.3, 2.4, 0.5, SLAB + 1.7);
  put(m.steel, 2.4, 0.04, 0.04, 5.3, 1.62, 3.3);
  for (const px of [4.15, 6.45]) put(m.steel, 0.05, 1.62, 0.05, px, 0.81, 3.3);
  for (let i = 0; i < 6; i++) {
    const jacket = put(i === 4 ? m.orange : m.camo, 0.14, 0.72, 0.46, 4.4 + i * 0.36, 1.22, 3.3);
    put(i === 4 ? m.orange : m.camo, 0.12, 0.5, 0.12, 4.4 + i * 0.36, 1.2, 3.02);
    put(i === 4 ? m.orange : m.camo, 0.12, 0.5, 0.12, 4.4 + i * 0.36, 1.2, 3.58);
    jacket.rotation.y = 0.05;
  }
  for (let i = 0; i < 3; i++) put(m.darkWood, 0.14, 0.3, 0.3, 4.3 + i * 0.4, 0.15, 4.3); // boots
  for (const [dx, dz] of [[1.2, 4.2], [1.65, 4.35], [2.1, 4.15]]) {                       // duck decoys
    const duck = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), plain(0x6a5a3a, 0.8));
    duck.scale.set(0.8, 0.6, 1.3);
    duck.position.set(dx, SLAB + 0.08, dz);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), plain(0x2f5a3c, 0.6));
    head.position.set(dx, SLAB + 0.2, dz + 0.12);
    shop.add(duck, head);
  }
  put(m.camo, 1.6, 0.9, 0.03, 6.82 - 3.4, 2.6, D / 2 - 0.24);                             // camo netting above the window

  // All the boxes of ammunition, drawn in one go.
  const boxes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.26, 0.12, 0.15), new THREE.MeshStandardMaterial({ roughness: 0.6 }), stock.length);
  const matrix = new THREE.Matrix4(), tint = new THREE.Color();
  stock.forEach((item, i) => {
    boxes.setMatrixAt(i, matrix.makeTranslation(item.px, item.y, item.pz));
    boxes.setColorAt(i, tint.set(item.color));
  });
  shop.add(boxes);
  scene.add(shop);

  // Walls you can't walk or shoot through (the doorway is left open).
  solid(0, -D / 2 + 0.1, W, 0.2, top + 1);
  solid(-W / 2 + 0.1, 0, 0.2, D, top + 1);
  solid(W / 2 - 0.1, 0, 0.2, D, top + 1);
  solid(-3.9, fz, 6.2, 0.2, top + 1);
  solid(3.9, fz, 6.2, 0.2, top + 1);
  addFloor(x - W / 2 - 0.15, x + W / 2 + 0.15, z - D / 2 - 0.15, z + D / 2 + 0.15, SLAB);
  addInterior(x - W / 2 + 0.2, x + W / 2 - 0.2, z - D / 2 + 0.2, z + D / 2 - 0.2, top);
  clearings[38].set(x - W / 2 - 1.1, Math.min(roadEdgeZ, z - D / 2) - 0.1, x + W / 2 + 1.1, z + D / 2 + 0.3); // no grass under the shop or forecourt

  shop.userData = { door, doorSpot: new THREE.Vector3(x, 0, z - fz), open: 0 };
  // Where the shopkeeper stands: behind the middle of the counter, facing the door.
  shop.userData.cashier = { x: x - 0.4, z: z + 4.2, facing: Math.PI };
  return shop;
}

// Each frame: the glass door slides aside when the player is near.
export function updateGunShop(shop, playerPosition, dt) {
  const state = shop.userData;
  const near = Math.hypot(playerPosition.x - state.doorSpot.x, playerPosition.z - state.doorSpot.z) < 2.6;
  state.open += ((near ? 1 : 0) - state.open) * Math.min(1, 6 * dt);
  state.door.position.x = 1.62 * state.open;
}
