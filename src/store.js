// A small corner shop: "Sunny's Mart". Glass front with sliding doors that open
// as you walk up, a striped awning and a sign on the roof. Inside: a counter
// with a till, two aisles of shelves, a wall of drinks fridges, a slushie and
// coffee corner, an ATM and a magazine rack. Everything is made in code.
import * as THREE from 'three';
import { addObstacle, addFloor, addInterior } from './world.js';
import { clearings } from './grass.js';
import { block, canvasTexture, speckle } from './house.js';

const SLAB = 0.15;   // concrete base
const HEIGHT = 3.2;  // floor to ceiling

// A sign: text painted on a coloured board.
export function label(text, small, background, ink, width = 512, height = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${height * (small ? 0.5 : 0.62)}px Arial, sans-serif`;
  ctx.fillText(text, width / 2, height * (small ? 0.4 : 0.54), width * 0.92);
  if (small) {
    ctx.font = `bold ${height * 0.2}px Arial, sans-serif`;
    ctx.fillText(small, width / 2, height * 0.82, width * 0.92);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const PACKAGING = [0xd9382b, 0xf2b632, 0x2f7fc4, 0x3f9b4b, 0xe8742c, 0x8a4fb0, 0xf2f0e6, 0xd94f8a, 0x25a6a0, 0x7a4a2a];

// Builds the shop with its centre at (x, z). The front faces +Z.
export function createStore(scene, x, z) {
  const store = new THREE.Group();
  store.position.set(x, 0, z);
  const top = SLAB + HEIGHT, mid = SLAB + HEIGHT / 2;

  const plain = (color, roughness = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  const m = {
    wall: new THREE.MeshStandardMaterial({
      roughness: 0.95,
      map: canvasTexture(128, (ctx, size) => { ctx.fillStyle = '#f1e9d6'; ctx.fillRect(0, 0, size, size); speckle(ctx, size, 2500, 0.045); }, 3, 2),
    }),
    concrete: new THREE.MeshStandardMaterial({
      roughness: 1,
      map: canvasTexture(128, (ctx, size) => { ctx.fillStyle = '#bdb7a9'; ctx.fillRect(0, 0, size, size); speckle(ctx, size, 3000, 0.06); }, 3, 2),
    }),
    tiles: new THREE.MeshStandardMaterial({
      roughness: 0.35,
      map: canvasTexture(64, (ctx, size) => { // worn checkerboard lino
        for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
          ctx.fillStyle = (i + j) % 2 ? '#e9e4d6' : '#9fb4ae';
          ctx.fillRect(i * 32, j * 32, 32, 32);
        }
        speckle(ctx, size, 500, 0.05);
      }, 7, 6),
    }),
    awning: new THREE.MeshStandardMaterial({
      roughness: 0.9, side: THREE.DoubleSide,
      map: canvasTexture(64, (ctx, size) => { // red and white stripes
        for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? '#f3eee2' : '#c23a2e'; ctx.fillRect(i * 8, 0, 8, size); }
      }, 3, 1),
    }),
    red: plain(0xc23a2e, 0.7),
    dark: plain(0x25272a, 0.6),
    metal: plain(0xb9bcbe, 0.4, { metalness: 0.5 }),
    shelf: plain(0xe3e4e2, 0.5),
    white: plain(0xf4f3ee, 0.5),
    counter: plain(0x8a6a4a, 0.5),
    yellow: plain(0xf0c020, 0.6),
    blue: plain(0x2f6fb5, 0.5),
    glass: new THREE.MeshStandardMaterial({ color: 0xbfe0e6, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.22, depthWrite: false }),
    light: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    fridgeGlow: new THREE.MeshBasicMaterial({ color: 0xeaf6ff }),
    screen: new THREE.MeshBasicMaterial({ color: 0x3fa0e0 }),
  };
  const sign = (text, small, background, ink, w, h) => new THREE.MeshBasicMaterial({ map: label(text, small, background, ink, w, h) });

  const solid = (cx, cz, w, d, height) => addObstacle(x + cx - w / 2, x + cx + w / 2, z + cz - d / 2, z + cz + d / 2, height);
  const put = (material, w, h, d, px, y, pz, parent = store) => block(parent, material, w, h, d, px, SLAB + y, pz); // y: centre height above the floor
  // Something standing on the floor (or `lift` above it) that you can't walk through.
  const thing = (material, w, h, d, px, pz, lift = 0) => {
    solid(px, pz, w, d, SLAB + lift + h);
    return put(material, w, h, d, px, lift + h / 2, pz);
  };

  // Stock on the shelves: hundreds of small boxes, drawn all at once.
  const stock = [];
  const product = (px, y, pz, w, h, d, color) => stock.push({ px, y: SLAB + y + h / 2, pz, w, h, d, color });

  // --- The building ---
  block(store, m.concrete, 8.3, SLAB, 7.3, 0, SLAB / 2, 0);
  put(m.tiles, 7.6, 0.02, 6.6, 0, 0.01, 0);
  put(m.wall, 8, HEIGHT, 0.2, 0, HEIGHT / 2, -3.4);              // back
  put(m.wall, 0.2, HEIGHT, 6.6, -3.9, HEIGHT / 2, 0);            // sides
  put(m.wall, 0.2, HEIGHT, 6.6, 3.9, HEIGHT / 2, 0);
  // Front: pillars, low walls under the windows, and a band above the glass.
  for (const [px, w] of [[-3.75, 0.5], [-1.1, 0.4], [1.1, 0.4], [3.75, 0.5]]) put(m.wall, w, 2.5, 0.2, px, 1.25, 3.4);
  put(m.wall, 2.2, 0.7, 0.2, -2.4, 0.35, 3.4);
  put(m.wall, 2.2, 0.7, 0.2, 2.4, 0.35, 3.4);
  put(m.wall, 8, HEIGHT - 2.5, 0.2, 0, 2.5 + (HEIGHT - 2.5) / 2, 3.4);
  put(m.glass, 2.2, 1.8, 0.04, -2.4, 1.6, 3.4);                  // shop windows
  put(m.glass, 2.2, 1.8, 0.04, 2.4, 1.6, 3.4);
  for (const px of [-2.4, 2.4]) { put(m.metal, 2.2, 0.05, 0.08, px, 0.72, 3.4); put(m.metal, 0.05, 1.8, 0.08, px, 1.6, 3.4); }
  // Flat roof, a red stripe round the top of the walls, and the awning.
  put(m.white, 8.4, 0.2, 7.4, 0, HEIGHT + 0.1, 0);
  put(m.red, 8.06, 0.3, 0.03, 0, HEIGHT - 0.25, 3.51);
  put(m.red, 8.06, 0.3, 0.03, 0, HEIGHT - 0.25, -3.51);
  put(m.red, 0.03, 0.3, 7.06, -4.01, HEIGHT - 0.25, 0);
  put(m.red, 0.03, 0.3, 7.06, 4.01, HEIGHT - 0.25, 0);
  const awning = put(m.awning, 8.2, 0.05, 1.4, 0, 2.62, 4.1);
  awning.rotation.x = 0.32;
  // The sign, standing on the front edge of the roof.
  put(sign("SUNNY'S MART", 'GROCERIES · COLD DRINKS · OPEN 24 HOURS', '#c23a2e', '#fff6dc', 1024, 192), 5.6, 1.05, 0.12, 0, HEIGHT + 0.75, 3.55);
  put(m.dark, 0.1, 0.5, 0.1, -2.4, HEIGHT + 0.3, 3.45);
  put(m.dark, 0.1, 0.5, 0.1, 2.4, HEIGHT + 0.3, 3.45);
  // Posters in the windows.
  put(sign('ICE', null, '#2f6fb5', '#ffffff', 256, 128), 0.7, 0.35, 0.02, -3.0, 1.0, 3.43);
  put(sign('LOTTO', null, '#f0c020', '#25272a', 256, 128), 0.7, 0.35, 0.02, -1.9, 2.2, 3.43);
  put(sign('ATM INSIDE', null, '#25272a', '#7fe08a', 256, 96), 0.8, 0.3, 0.02, 2.9, 2.25, 3.43);
  put(sign('COLD BEER', null, '#c23a2e', '#fff6dc', 256, 96), 0.8, 0.3, 0.02, 1.9, 1.0, 3.43);

  // Sliding glass doors.
  const doors = [-1, 1].map((side) => {
    const door = new THREE.Group();
    door.position.set(side * 0.45, 0, 3.32);
    put(m.glass, 0.9, 2.45, 0.03, 0, 1.225, 0, door);
    put(m.metal, 0.9, 0.06, 0.05, 0, 2.42, 0, door);
    put(m.metal, 0.9, 0.08, 0.05, 0, 0.04, 0, door);
    put(m.metal, 0.05, 2.45, 0.05, side * 0.425, 1.225, 0, door);
    put(m.metal, 0.05, 2.45, 0.05, -side * 0.425, 1.225, 0, door);
    put(sign(side < 0 ? 'PUSH' : 'OPEN', null, '#f3eee2', '#c23a2e', 128, 64), 0.3, 0.15, 0.035, 0, 1.4, 0, door);
    store.add(door);
    return { door, side };
  });

  // Forecourt: concrete with parking lines, yellow posts, an ice freezer and a bin.
  block(store, m.concrete, 10, 0.06, 5.2, 0, 0.03, 6.2);
  for (const px of [-3.6, -1.2, 1.2, 3.6]) block(store, m.white, 0.1, 0.005, 2.6, px, 0.064, 7.3);
  for (const px of [-2.4, 0, 2.4]) { solid(px, 5.6, 0.16, 0.16, 0.95); block(store, m.yellow, 0.14, 0.9, 0.14, px, 0.45, 5.6); }
  solid(2.7, 3.9, 1.5, 0.7, 1.1);
  block(store, m.white, 1.5, 1.05, 0.7, 2.7, 0.58, 3.9);
  block(store, sign('ICE', null, '#f4f3ee', '#2f6fb5', 256, 128), 1.0, 0.5, 0.02, 2.7, 0.62, 4.26);
  block(store, m.metal, 1.5, 0.05, 0.72, 2.7, 1.13, 3.9);
  solid(-1.6, 3.85, 0.45, 0.45, 0.9);
  block(store, m.dark, 0.45, 0.85, 0.45, -1.6, 0.48, 3.85);
  block(store, m.metal, 0.5, 0.06, 0.5, -1.6, 0.93, 3.85);

  // --- Inside ---
  // Strip lights on the ceiling.
  for (const [lx, lz] of [[-1.8, 1.4], [1.8, 1.4], [-1.8, -1.6], [1.8, -1.6]]) put(m.light, 1.3, 0.04, 0.22, lx, HEIGHT - 0.03, lz);
  for (const lz of [1.4, -1.6]) {
    const glow = new THREE.PointLight(0xf4f8ff, 16, 11, 1.5);
    glow.position.set(0, top - 0.6, lz);
    store.add(glow);
  }

  // Counter by the door, with the till, a card reader and boxes of sweets.
  thing(m.white, 0.7, 0.95, 2.2, -2.6, 1.7);
  put(m.counter, 0.78, 0.05, 2.28, -2.6, 0.975, 1.7);
  put(m.red, 0.02, 0.3, 2.2, -2.24, 0.6, 1.7);
  put(m.dark, 0.38, 0.14, 0.4, -2.65, 1.07, 2.2);                  // till
  put(m.screen, 0.02, 0.2, 0.28, -2.82, 1.28, 2.2);
  put(m.dark, 0.04, 0.24, 0.32, -2.84, 1.28, 2.2);
  put(m.dark, 0.1, 0.05, 0.16, -2.4, 1.03, 1.75);                  // card reader
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) product(-2.42 + j * 0.0, 1.0, 0.85 + i * 0.16, 0.14, 0.05 + j * 0.0, 0.13, PACKAGING[(i * 3 + j) % 10]);
  put(sign('SCRATCH & WIN', null, '#f0c020', '#c23a2e', 256, 96), 0.02, 0.22, 0.5, -2.3, 1.2, 1.25);
  // Shelves of cigarettes and bottles on the wall behind the counter.
  for (let level = 0; level < 4; level++) {
    put(m.shelf, 0.22, 0.025, 2.2, -3.69, 1.15 + level * 0.38, 1.7);
    for (let i = 0; i < 16; i++) product(-3.7, 1.165 + level * 0.38, 0.68 + i * 0.136, 0.14, level < 2 ? 0.11 : 0.24, 0.1, PACKAGING[(level * 3 + (i >> 2)) % 10]);
  }

  // Two aisles of shelving down the middle, stocked on both sides.
  for (const gx of [0.7, 2.5]) {
    solid(gx, 0, 0.7, 3.0, SLAB + 1.6);
    put(m.shelf, 0.7, 0.14, 3.0, gx, 0.07, 0);
    put(m.shelf, 0.05, 1.55, 3.0, gx, 0.775, 0);
    put(m.red, 0.72, 0.06, 3.02, gx, 1.58, 0);
    for (let level = 0; level < 4; level++) {
      const y = 0.14 + level * 0.36;
      if (level) put(m.shelf, 0.7, 0.02, 3.0, gx, y, 0);
      for (const side of [-1, 1]) for (let i = 0; i < 17; i++) {
        const kind = (((i / 3) | 0) + level * 2 + (side > 0 ? 5 : 0) + (gx > 1 ? 3 : 0)) % 10;
        const tall = 0.13 + ((kind * 7) % 5) * 0.035;
        product(gx + side * 0.19, y + 0.02, -1.38 + i * 0.1725, 0.26, tall, 0.14, PACKAGING[kind]);
      }
    }
  }

  // A wall of drinks fridges along the back: lit inside, glass doors, rows of bottles.
  solid(0, -2.95, 6.1, 0.7, SLAB + 2.3);
  put(m.dark, 6.1, 0.18, 0.7, 0, 0.09, -2.95);
  put(m.dark, 6.1, 0.22, 0.7, 0, 2.19, -2.95);
  put(sign('ICE COLD DRINKS', null, '#2f6fb5', '#ffffff', 1024, 64), 6.0, 0.18, 0.02, 0, 2.19, -2.59);
  put(m.fridgeGlow, 6.0, 1.9, 0.03, 0, 1.13, -3.27);
  for (let unit = 0; unit <= 5; unit++) put(m.dark, 0.07, 1.9, 0.7, -3.0 + unit * 1.2, 1.13, -2.95);
  for (let unit = 0; unit < 5; unit++) {
    const fx = -2.4 + unit * 1.2;
    put(m.glass, 1.12, 1.88, 0.03, fx, 1.13, -2.61);
    put(m.metal, 0.03, 0.5, 0.04, fx + 0.48, 1.15, -2.58);
    for (let level = 0; level < 5; level++) {
      const y = 0.2 + level * 0.37;
      put(m.white, 1.12, 0.015, 0.55, fx, y, -2.95);
      for (let i = 0; i < 9; i++) for (let row = 0; row < 3; row++) {
        const kind = (unit * 2 + level + ((i / 3) | 0)) % 10;
        product(fx - 0.46 + i * 0.115, y + 0.01, -2.74 - row * 0.15, 0.075, level % 2 ? 0.2 : 0.14, 0.075, PACKAGING[kind]);
      }
    }
  }

  // Slushies and coffee along the left wall.
  thing(m.white, 0.6, 0.9, 1.7, -3.45, -1.5);
  put(m.counter, 0.64, 0.04, 1.74, -3.45, 0.92, -1.5);
  put(m.dark, 0.42, 0.25, 0.7, -3.5, 1.07, -1.95);                 // slushie machine
  for (const [tz, hex] of [[-2.12, 0xe0352b], [-1.78, 0x2f8fe0]]) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.32, 16), plain(hex, 0.15, { transparent: true, opacity: 0.8 }));
    tank.position.set(-3.5, SLAB + 1.36, tz);
    store.add(tank);
    put(m.dark, 0.3, 0.04, 0.3, -3.5, 1.54, tz);
  }
  put(sign('SLUSH', null, '#2f6fb5', '#ffffff', 256, 96), 0.02, 0.16, 0.6, -3.27, 1.07, -1.95);
  put(m.dark, 0.3, 0.35, 0.3, -3.5, 1.12, -1.2);                   // coffee machine
  put(m.metal, 0.14, 0.16, 0.14, -3.3, 1.02, -1.2);
  for (let cup = 0; cup < 3; cup++) put(m.white, 0.08, 0.2, 0.08, -3.5, 1.04, -0.9 + cup * 0.1);

  // ATM, a magazine rack under the window, and a wet-floor sign someone forgot.
  thing(m.dark, 0.5, 1.5, 0.45, 3.5, 2.75);
  put(m.screen, 0.02, 0.26, 0.3, 3.24, 1.2, 2.75);
  put(m.metal, 0.02, 0.1, 0.3, 3.24, 0.92, 2.75);
  put(sign('ATM', null, '#25272a', '#7fe08a', 128, 64), 0.02, 0.14, 0.3, 3.24, 1.42, 2.75);
  thing(m.shelf, 1.5, 0.95, 0.28, 2.1, 3.12);
  for (let level = 0; level < 3; level++) for (let i = 0; i < 6; i++) product(1.48 + i * 0.25, 0.1 + level * 0.3, 2.96, 0.2, 0.27, 0.02, PACKAGING[(i + level * 4) % 10]);
  const caution = put(m.yellow, 0.3, 0.6, 0.03, -0.9, 0.3, -0.6);
  caution.rotation.x = 0.25;
  const cautionBack = put(m.yellow, 0.3, 0.6, 0.03, -0.9, 0.3, -0.42);
  cautionBack.rotation.x = -0.25;

  // Put all the stock on the shelves in one go.
  const boxes = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.55 }), stock.length);
  const matrix = new THREE.Matrix4(), tint = new THREE.Color();
  stock.forEach((item, i) => {
    matrix.makeScale(item.w, item.h, item.d).setPosition(item.px, item.y, item.pz);
    boxes.setMatrixAt(i, matrix);
    boxes.setColorAt(i, tint.set(item.color));
  });
  store.add(boxes);
  scene.add(store);

  // Walls you can't walk or shoot through (the doorway is left open).
  solid(0, -3.4, 8, 0.2, top + 1);
  solid(-3.9, 0, 0.2, 7, top + 1);
  solid(3.9, 0, 0.2, 7, top + 1);
  solid(-2.45, 3.4, 3.1, 0.2, top + 1);
  solid(2.45, 3.4, 3.1, 0.2, top + 1);
  addFloor(x - 4.15, x + 4.15, z - 3.65, z + 3.65, SLAB);
  addInterior(x - 3.8, x + 3.8, z - 3.3, z + 3.3, top);
  clearings[4].set(x - 5.1, z - 3.8, x + 5.1, z + 15.2); // no grass under the shop or its forecourt

  store.userData = { doors, doorSpot: new THREE.Vector3(x, 0, z + 3.4), open: 0 };
  return store;
}

// Each frame: the glass doors slide apart when the player is near.
export function updateStore(store, playerPosition, dt) {
  const state = store.userData;
  const near = Math.hypot(playerPosition.x - state.doorSpot.x, playerPosition.z - state.doorSpot.z) < 2.6;
  state.open += ((near ? 1 : 0) - state.open) * Math.min(1, 6 * dt);
  for (const { door, side } of state.doors) door.position.x = side * (0.45 + 0.86 * state.open);
}
