// "Cold Ones": a small beer shop at the top of Brew St in Miami. A wall of lit
// fridges full of bottles, stacks of crates, kegs, and a counter with a
// cashier. The front faces -Z, down the street toward the main road.
import * as THREE from 'three';
import { addObstacle, addFloor, addInterior } from './world.js';
import { block, canvasTexture, speckle } from './house.js';
import { label } from './store.js';

const SLAB = 0.15;   // concrete base
const HEIGHT = 3.2;  // floor to ceiling
const CRATES = [0xc23a2e, 0x2f7f4a, 0xe0a82a, 0x2f5fa8];
const GLASS = [0x5a3414, 0x2f6a34, 0x8a5a1e, 0x3a2a12];

// Builds the shop with its centre at (x, z). It is laid out facing +Z and then turned round.
export function createBeerShop(scene, x, z) {
  const shop = new THREE.Group();
  shop.position.set(x, 0, z);
  shop.rotation.y = Math.PI;
  const top = SLAB + HEIGHT;

  const plain = (color, roughness = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  const m = {
    wall: new THREE.MeshStandardMaterial({ roughness: 0.95, map: canvasTexture(128, (ctx, s) => { ctx.fillStyle = '#1f4f4c'; ctx.fillRect(0, 0, s, s); speckle(ctx, s, 2500, 0.05); }, 3, 2) }),
    inside: plain(0xe9dfc8, 0.95),
    concrete: plain(0xb5afa2, 1),
    floor: new THREE.MeshStandardMaterial({ roughness: 0.6, map: canvasTexture(64, (ctx, s) => { // wooden boards
      ctx.fillStyle = '#8a6238'; ctx.fillRect(0, 0, s, s);
      speckle(ctx, s, 600, 0.06);
      ctx.fillStyle = 'rgba(40,25,10,0.5)';
      for (let i = 0; i < 4; i++) ctx.fillRect(i * 16, 0, 1, s);
    }, 8, 3) }),
    awning: new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide, map: canvasTexture(64, (ctx, s) => {
      for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? '#f3eee2' : '#e0a82a'; ctx.fillRect(i * 8, 0, 8, s); }
    }, 3, 1) }),
    trim: plain(0xe0a82a, 0.6),
    dark: plain(0x25272a, 0.6),
    metal: plain(0xb9bcbe, 0.35, { metalness: 0.6 }),
    white: plain(0xf4f3ee, 0.5),
    wood: plain(0x6b4a2c, 0.6),
    glass: new THREE.MeshStandardMaterial({ color: 0xbfe0e6, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.22, depthWrite: false }),
    light: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    fridgeGlow: new THREE.MeshBasicMaterial({ color: 0xeaf6ff }),
    screen: new THREE.MeshBasicMaterial({ color: 0x3fa0e0 }),
    gold: plain(0xd9a83a, 0.3, { metalness: 0.7 }),
    brown: plain(0x5a3414, 0.25),
  };
  const sign = (text, small, background, ink, w, h) => new THREE.MeshBasicMaterial({ map: label(text, small, background, ink, w, h) });
  // The shop is turned round, so its own left and right, front and back are flipped on the map.
  const solid = (cx, cz, w, d, height) => addObstacle(x - cx - w / 2, x - cx + w / 2, z - cz - d / 2, z - cz + d / 2, height);
  const put = (material, w, h, d, px, y, pz, parent = shop) => block(parent, material, w, h, d, px, SLAB + y, pz);
  const thing = (material, w, h, d, px, pz) => { solid(px, pz, w, d, SLAB + h); return put(material, w, h, d, px, h / 2, pz); };
  const tube = (material, radius, height, px, y, pz) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 16), material);
    mesh.position.set(px, SLAB + y, pz);
    mesh.castShadow = true;
    shop.add(mesh);
    return mesh;
  };
  const boxes = [], bottles = [];
  const crate = (px, y, pz, color) => boxes.push({ px, y: SLAB + y + 0.14, pz, w: 0.42, h: 0.28, d: 0.32, color });
  const bottle = (px, y, pz, color) => bottles.push({ px, y: SLAB + y, pz, color });

  // --- The building ---
  block(shop, m.concrete, 9.3, SLAB, 7.3, 0, SLAB / 2, 0);
  put(m.floor, 8.6, 0.02, 6.6, 0, 0.01, 0);
  put(m.wall, 9, HEIGHT, 0.2, 0, HEIGHT / 2, -3.4);
  put(m.wall, 0.2, HEIGHT, 6.6, -4.4, HEIGHT / 2, 0);
  put(m.wall, 0.2, HEIGHT, 6.6, 4.4, HEIGHT / 2, 0);
  put(m.inside, 8.6, HEIGHT, 0.02, 0, HEIGHT / 2, -3.29);          // cream paint on the inside of the walls
  put(m.inside, 0.02, HEIGHT, 6.6, -4.29, HEIGHT / 2, 0);
  put(m.inside, 0.02, HEIGHT, 6.6, 4.29, HEIGHT / 2, 0);
  for (const [px, w] of [[-4.25, 0.5], [-1.1, 0.4], [1.1, 0.4], [4.25, 0.5]]) put(m.wall, w, 2.5, 0.2, px, 1.25, 3.4);
  for (const side of [-1, 1]) {
    put(m.wall, 2.7, 0.7, 0.2, side * 2.65, 0.35, 3.4);
    put(m.glass, 2.7, 1.8, 0.04, side * 2.65, 1.6, 3.4);
    put(m.metal, 2.7, 0.05, 0.08, side * 2.65, 0.72, 3.4);
  }
  put(m.wall, 9, HEIGHT - 2.5, 0.2, 0, 2.5 + (HEIGHT - 2.5) / 2, 3.4);
  put(m.white, 9.4, 0.2, 7.4, 0, HEIGHT + 0.1, 0);                 // flat roof
  put(m.trim, 9.06, 0.3, 0.03, 0, HEIGHT - 0.25, 3.51);
  const awning = put(m.awning, 9.2, 0.05, 1.4, 0, 2.62, 4.1);
  awning.rotation.x = 0.32;
  put(sign('COLD ONES', 'BEER SHOP · ICE COLD · OPEN LATE', '#16302e', '#ffd75a', 1024, 256), 5.6, 1.4, 0.12, 0, HEIGHT + 0.92, 3.55);
  put(sign('BEER', null, '#e0a82a', '#16302e', 256, 128), 0.9, 0.45, 0.02, -3.2, 2.1, 3.43);
  put(sign('6 PACKS', null, '#c23a2e', '#fff6dc', 256, 96), 0.9, 0.34, 0.02, 2.2, 1.0, 3.43);
  put(sign('CRATES', null, '#16302e', '#ffd75a', 256, 96), 0.9, 0.34, 0.02, 3.2, 2.2, 3.43);
  // A giant beer bottle standing on the roof.
  tube(m.brown, 0.42, 1.5, -3.4, HEIGHT + 0.95, 1.6);
  tube(m.white, 0.425, 0.55, -3.4, HEIGHT + 0.9, 1.6);
  const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.42, 0.45, 16), m.brown);
  shoulder.position.set(-3.4, SLAB + HEIGHT + 1.92, 1.6);
  shop.add(shoulder);
  tube(m.brown, 0.14, 0.6, -3.4, HEIGHT + 2.45, 1.6);
  tube(m.gold, 0.17, 0.1, -3.4, HEIGHT + 2.8, 1.6);

  // Sliding glass doors.
  const doors = [-1, 1].map((side) => {
    const door = new THREE.Group();
    door.position.set(side * 0.45, 0, 3.32);
    put(m.glass, 0.9, 2.45, 0.03, 0, 1.225, 0, door);
    put(m.metal, 0.9, 0.06, 0.05, 0, 2.42, 0, door);
    put(m.metal, 0.9, 0.08, 0.05, 0, 0.04, 0, door);
    put(m.metal, 0.05, 2.45, 0.05, side * 0.425, 1.225, 0, door);
    shop.add(door);
    return { door, side };
  });

  // Outside the door: two kegs and a board on the pavement.
  for (const [kx, kz] of [[3.0, 4.2], [3.6, 4.3]]) { tube(m.metal, 0.22, 0.6, kx, 0.15, kz); solid(kx, kz, 0.44, 0.44, 0.8); }
  const board = block(shop, sign('COLD BEER', 'G$ 3 A BOTTLE', '#16302e', '#ffd75a', 256, 256), 0.7, 0.9, 0.04, -2.6, 0.5, 4.6);
  board.rotation.x = -0.2;
  solid(-2.6, 4.6, 0.7, 0.3, 1.0);

  // --- Inside ---
  for (const [lx, lz] of [[-2, 1.2], [2, 1.2], [-2, -1.6], [2, -1.6]]) put(m.light, 1.3, 0.04, 0.22, lx, HEIGHT - 0.03, lz);
  const glow = new THREE.PointLight(0xfff0d0, 22, 13, 1.5);
  glow.position.set(0, top - 0.6, 0);
  shop.add(glow);

  // The counter, with the till and an open box of bottle openers nobody buys.
  thing(m.wood, 0.7, 0.95, 2.2, -3.1, 1.6);
  put(m.trim, 0.78, 0.05, 2.28, -3.1, 0.975, 1.6);
  put(m.dark, 0.38, 0.14, 0.4, -3.15, 1.07, 2.1);
  put(m.screen, 0.02, 0.2, 0.28, -3.32, 1.28, 2.1);
  put(m.dark, 0.3, 0.06, 0.2, -3.0, 1.03, 1.2);
  for (let i = 0; i < 3; i++) bottle(-3.05, 1.0, 1.55 + i * 0.12, GLASS[i]);
  put(sign('BEER', 'COLD ONES', '#16302e', '#ffd75a', 256, 128), 0.02, 0.6, 1.3, -4.26, 2.3, 1.6);

  // A wall of fridges along the back, lit from inside and full of bottles.
  solid(0, -2.95, 8.4, 0.7, SLAB + 2.3);
  put(m.dark, 8.4, 0.18, 0.7, 0, 0.09, -2.95);
  put(m.dark, 8.4, 0.22, 0.7, 0, 2.19, -2.95);
  put(sign('ICE COLD BEER', null, '#e0a82a', '#16302e', 1024, 64), 8.3, 0.18, 0.02, 0, 2.19, -2.59);
  put(m.fridgeGlow, 8.3, 1.9, 0.03, 0, 1.13, -3.25);
  for (let unit = 0; unit <= 7; unit++) put(m.dark, 0.07, 1.9, 0.7, -4.2 + unit * 1.2, 1.13, -2.95);
  for (let unit = 0; unit < 7; unit++) {
    const fx = -3.6 + unit * 1.2;
    put(m.glass, 1.12, 1.88, 0.03, fx, 1.13, -2.61);
    put(m.metal, 0.03, 0.5, 0.04, fx + 0.48, 1.15, -2.58);
    for (let level = 0; level < 5; level++) {
      const y = 0.2 + level * 0.37;
      put(m.white, 1.12, 0.015, 0.55, fx, y, -2.95);
      for (let i = 0; i < 9; i++) for (let row = 0; row < 2; row++) bottle(fx - 0.46 + i * 0.115, y + 0.01, -2.78 - row * 0.17, GLASS[(unit + level) % 4]);
    }
  }

  // Stacks of crates in the middle of the floor.
  for (const [sx, sz, high] of [[0.3, 0.3, 4], [2.3, 0.6, 3], [1.3, -1.2, 2]]) {
    solid(sx, sz, 1.34, 0.7, SLAB + high * 0.3);
    for (let level = 0; level < high; level++) for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
      crate(sx - 0.45 + i * 0.45, level * 0.3, sz - 0.17 + j * 0.34, CRATES[(i + level + Math.round(sx)) % 4]);
    }
  }
  // Kegs along the right-hand wall.
  for (let i = 0; i < 4; i++) {
    tube(m.metal, 0.24, 0.62, 3.85, 0.31, -1.6 + i * 0.6);
    tube(m.dark, 0.25, 0.04, 3.85, 0.5, -1.6 + i * 0.6);
  }
  solid(3.85, -0.7, 0.5, 2.4, SLAB + 0.7);

  // Put all the crates and bottles in place in one go each.
  const matrix = new THREE.Matrix4(), tint = new THREE.Color();
  const crateMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.6 }), boxes.length);
  boxes.forEach((item, i) => {
    crateMesh.setMatrixAt(i, matrix.makeScale(item.w, item.h, item.d).setPosition(item.px, item.y, item.pz));
    crateMesh.setColorAt(i, tint.set(item.color));
  });
  const shape = new THREE.LatheGeometry([[0, 0], [0.032, 0], [0.032, 0.13], [0.013, 0.18], [0.013, 0.24], [0, 0.24]].map(([r, h]) => new THREE.Vector2(r, h)), 8);
  const bottleMesh = new THREE.InstancedMesh(shape, new THREE.MeshStandardMaterial({ roughness: 0.2 }), bottles.length);
  bottles.forEach((item, i) => {
    bottleMesh.setMatrixAt(i, matrix.makeTranslation(item.px, item.y, item.pz));
    bottleMesh.setColorAt(i, tint.set(item.color));
  });
  shop.add(crateMesh, bottleMesh);
  scene.add(shop);

  // Walls you can't walk or shoot through (the doorway is left open).
  solid(0, -3.4, 9, 0.2, top + 1);
  solid(-4.4, 0, 0.2, 7, top + 1);
  solid(4.4, 0, 0.2, 7, top + 1);
  solid(-2.7, 3.4, 3.6, 0.2, top + 1);
  solid(2.7, 3.4, 3.6, 0.2, top + 1);
  addFloor(x - 4.65, x + 4.65, z - 3.65, z + 3.65, SLAB);
  addInterior(x - 4.3, x + 4.3, z - 3.3, z + 3.3, top);

  shop.userData = {
    doors, open: 0,
    doorSpot: new THREE.Vector3(x, 0, z - 3.4),
    cashier: { x: x + 3.85, z: z - 1.6, facing: -Math.PI / 2 },   // behind the counter
    counter: { x: x + 2.2, z: z - 1.6 },                           // where the customer stands
  };
  return shop;
}

// Each frame: the glass doors slide apart when the player is near.
export function updateBeerShop(shop, playerPosition, dt) {
  const state = shop.userData;
  const near = Math.hypot(playerPosition.x - state.doorSpot.x, playerPosition.z - state.doorSpot.z) < 2.6;
  state.open += ((near ? 1 : 0) - state.open) * Math.min(1, 6 * dt);
  for (const { door, side } of state.doors) door.position.x = side * (0.45 + 0.86 * state.open);
}
