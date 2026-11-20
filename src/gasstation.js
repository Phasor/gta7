// A petrol station: "Gator Gas". A big canopy over two pump islands with four
// pumps, a small pay kiosk behind, a tall price sign by the road, and the usual
// clutter (ice box, air machine, bins, a dumpster). Everything is made in code.
// The kiosk is a tiny shop you can walk into, with its own counter and fridges.
import * as THREE from 'three';
import { addObstacle, addFloor, addInterior } from './world.js';
import { clearings } from './grass.js';
import { block, canvasTexture, speckle } from './house.js';
import { label } from './store.js';

const GREEN = '#1f7a45', ORANGE = '#f08a1c', CREAM = '#fff6dc';

// The price board: station name on top, three fuel prices underneath.
function priceBoard() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 384;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = GREEN;
  ctx.fillRect(0, 0, 256, 384);
  ctx.fillStyle = ORANGE;
  ctx.fillRect(0, 96, 256, 10);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = CREAM;
  ctx.font = 'bold 54px Arial, sans-serif';
  ctx.fillText('GATOR', 128, 34);
  ctx.fillText('GAS', 128, 76);
  [['REGULAR', '3.19'], ['PLUS', '3.49'], ['DIESEL', '3.79']].forEach(([grade, price], i) => {
    const y = 150 + i * 86;
    ctx.fillStyle = '#101512';
    ctx.fillRect(14, y - 34, 228, 70);
    ctx.fillStyle = CREAM;
    ctx.font = 'bold 20px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(grade, 24, y - 18);
    ctx.fillStyle = '#ffd23a';
    ctx.font = 'bold 46px Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(price, 232, y + 10);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Builds the station with its centre at (x, z). The front faces +Z, toward the road.
export function createGasStation(scene, x, z) {
  const station = new THREE.Group();
  station.position.set(x, 0, z);

  const plain = (color, roughness = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  const m = {
    concrete: new THREE.MeshStandardMaterial({
      roughness: 1,
      map: canvasTexture(256, (ctx, size) => { // stained forecourt concrete
        ctx.fillStyle = '#b9b3a6';
        ctx.fillRect(0, 0, size, size);
        speckle(ctx, size, 6000, 0.06);
        for (let i = 0; i < 7; i++) { // oil and tyre stains
          const sx = Math.random() * size, sy = Math.random() * size, r = 10 + Math.random() * 22;
          const stain = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
          stain.addColorStop(0, 'rgba(40,36,30,0.45)');
          stain.addColorStop(1, 'rgba(40,36,30,0)');
          ctx.fillStyle = stain;
          ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
        }
        ctx.fillStyle = 'rgba(70,65,55,0.4)';
        ctx.fillRect(0, 0, size, 2);
        ctx.fillRect(0, 0, 2, size);
      }, 4, 4),
    }),
    wall: new THREE.MeshStandardMaterial({
      roughness: 0.95,
      map: canvasTexture(128, (ctx, size) => { ctx.fillStyle = '#efe8d8'; ctx.fillRect(0, 0, size, size); speckle(ctx, size, 2500, 0.045); }, 3, 2),
    }),
    glass: new THREE.MeshStandardMaterial({
      roughness: 0.08, metalness: 0.45,
      map: canvasTexture(128, (ctx, size) => { // dim reflection of the sky, shelves faintly visible inside
        const sky = ctx.createLinearGradient(0, 0, 0, size);
        sky.addColorStop(0, '#6f93ad');
        sky.addColorStop(1, '#c9c2a6');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = 'rgba(16,24,30,0.6)';
        ctx.fillRect(0, 0, size, size);
        const colours = ['#d9382b', '#f2b632', '#2f7fc4', '#3f9b4b', '#e8742c'];
        for (let row = 0; row < 3; row++) for (let i = 0; i < 16; i++) {
          ctx.fillStyle = colours[(i + row) % 5];
          ctx.globalAlpha = 0.28;
          ctx.fillRect(i * 8, 60 + row * 20, 6, 12);
        }
      }, 1, 1),
    }),
    white: plain(0xf4f3ee, 0.5),
    green: plain(0x1f7a45, 0.55),
    orange: plain(0xf08a1c, 0.55),
    steel: plain(0xb4b8ba, 0.4, { metalness: 0.5 }),
    dark: plain(0x232527, 0.7),
    yellow: plain(0xf0c020, 0.6),
    kerb: plain(0xd3cec2, 0.9),
    light: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    screen: new THREE.MeshBasicMaterial({ color: 0x9fe0b0 }),
    dumpster: plain(0x2f5a3c, 0.7),
  };
  const sign = (text, small, background, ink, w, h) => new THREE.MeshBasicMaterial({ map: label(text, small, background, ink, w, h) });
  const put = (material, w, h, d, px, y, pz) => block(station, material, w, h, d, px, y, pz);
  const solid = (cx, cz, w, d, height) => addObstacle(x + cx - w / 2, x + cx + w / 2, z + cz - d / 2, z + cz + d / 2, height);
  // Something standing on the ground that you can't walk or drive through.
  const thing = (material, w, h, d, px, pz) => { solid(px, pz, w, d, h); return put(material, w, h, d, px, h / 2, pz); };

  // Forecourt, running down to the pavement.
  put(m.concrete, 22, 0.06, 20, 0, 0.03, 0).castShadow = false;

  // --- Canopy over the pumps ---
  const CANOPY = 4.7; // underside height
  put(m.white, 13.4, 0.55, 7.4, 0, CANOPY + 0.275, 3);
  put(m.green, 13.46, 0.2, 7.46, 0, CANOPY + 0.12, 3);     // green band round the bottom edge
  put(m.orange, 13.48, 0.07, 7.48, 0, CANOPY + 0.27, 3);   // thin orange line above it
  put(sign('GATOR GAS', null, GREEN, CREAM, 512, 96), 4.2, 0.42, 0.03, 0, CANOPY + 0.33, 6.72);
  put(sign('GATOR GAS', null, GREEN, CREAM, 512, 96), 0.03, 0.42, 3.4, 6.72, CANOPY + 0.33, 3);
  put(sign('GATOR GAS', null, GREEN, CREAM, 512, 96), 0.03, 0.42, 3.4, -6.72, CANOPY + 0.33, 3);
  for (const lx of [-4.4, 0, 4.4]) for (const lz of [1.4, 4.6]) put(m.light, 1.1, 0.03, 0.5, lx, CANOPY - 0.015, lz); // lights underneath

  // --- Two pump islands, each with two pumps and a column at either end ---
  for (const ix of [-3.5, 3.5]) {
    put(m.kerb, 1.1, 0.16, 5.2, ix, 0.08, 3);
    addFloor(x + ix - 0.55, x + ix + 0.55, z + 0.4, z + 5.6, 0.16);
    for (const cz of [0.9, 5.1]) {
      solid(ix, cz, 0.4, 0.4, CANOPY);
      put(m.white, 0.34, CANOPY, 0.34, ix, CANOPY / 2, cz);
      put(m.green, 0.38, 0.9, 0.38, ix, 0.6, cz);          // painted lower part
      put(m.yellow, 0.2, 0.8, 0.2, ix, 0.4, cz + (cz < 3 ? -0.75 : 0.75)); // bollard guarding the end
      solid(ix, cz + (cz < 3 ? -0.75 : 0.75), 0.24, 0.24, 0.8);
    }
    for (const [pz, number] of [[2.3, ix < 0 ? 1 : 3], [3.7, ix < 0 ? 2 : 4]]) {
      solid(ix, pz, 0.6, 0.5, 1.9);
      put(m.white, 0.56, 1.0, 0.46, ix, 0.66, pz);          // pump body
      put(m.green, 0.6, 0.55, 0.5, ix, 1.43, pz);           // head
      put(m.orange, 0.62, 0.06, 0.52, ix, 1.14, pz);
      put(m.dark, 0.5, 0.1, 0.4, ix, 0.2, pz);              // base
      put(sign(String(number), null, CREAM, GREEN, 64, 64), 0.5, 0.3, 0.3, ix, 1.86, pz); // pump number on top
      for (const side of [-1, 1]) {
        put(m.screen, 0.02, 0.2, 0.3, ix + side * 0.305, 1.48, pz);                 // display
        put(m.dark, 0.02, 0.14, 0.3, ix + side * 0.305, 1.28, pz);                  // keypad
        put(m.dark, 0.05, 0.3, 0.07, ix + side * 0.31, 0.95, pz + 0.12);            // nozzle in its holster
        put(m.dark, 0.03, 0.75, 0.03, ix + side * 0.33, 0.6, pz - 0.14);            // hose hanging down
        put(m.dark, 0.03, 0.03, 0.26, ix + side * 0.33, 0.24, pz - 0.01);
      }
    }
    thing(m.dark, 0.35, 0.75, 0.35, ix, 3.0);               // bin between the pumps
  }

  // --- Pay kiosk at the back: a tiny shop you can walk into ---
  const KIOSK = 3.1;
  const clear = new THREE.MeshStandardMaterial({ color: 0xbfe0e6, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.22, depthWrite: false });
  const tiles = new THREE.MeshStandardMaterial({
    roughness: 0.35,
    map: canvasTexture(64, (ctx, size) => { // checkerboard lino
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        ctx.fillStyle = (i + j) % 2 ? '#e9e4d6' : '#a9c2a4';
        ctx.fillRect(i * 32, j * 32, 32, 32);
      }
      speckle(ctx, size, 500, 0.05);
    }, 7, 4),
  });
  const shelving = plain(0xe3e4e2, 0.5), worktop = plain(0x8a6a4a, 0.5);
  const PACKAGING = [0xd9382b, 0xf2b632, 0x2f7fc4, 0x3f9b4b, 0xe8742c, 0x8a4fb0, 0xf2f0e6, 0xd94f8a, 0x25a6a0, 0x7a4a2a];
  const stock = []; // small boxes of stock, all drawn at once at the end
  const product = (px, y, pz, w, h, d, color) => stock.push({ px, y: y + h / 2, pz, w, h, d, color });

  // Walls: back, sides, and a front with a doorway and two real windows.
  put(tiles, 7.6, 0.02, 4.0, 0, 0.07, -7).castShadow = false;
  put(m.wall, 8, KIOSK, 0.2, 0, KIOSK / 2, -9.1);
  put(m.wall, 0.2, KIOSK, 4.0, -3.9, KIOSK / 2, -7);
  put(m.wall, 0.2, KIOSK, 4.0, 3.9, KIOSK / 2, -7);
  for (const [px, w] of [[-3.85, 0.3], [-0.85, 0.5], [0.85, 0.5], [3.85, 0.3]]) put(m.wall, w, 2.3, 0.2, px, 1.15, -4.9);
  put(m.wall, 2.6, 0.8, 0.2, -2.4, 0.4, -4.9);
  put(m.wall, 2.6, 0.8, 0.2, 2.4, 0.4, -4.9);
  put(m.wall, 8, KIOSK - 2.3, 0.2, 0, 2.3 + (KIOSK - 2.3) / 2, -4.9);
  solid(0, -9.1, 8, 0.2, KIOSK + 1);
  solid(-3.9, -7, 0.2, 4.4, KIOSK + 1);
  solid(3.9, -7, 0.2, 4.4, KIOSK + 1);
  solid(-2.3, -4.9, 3.4, 0.2, KIOSK + 1);
  solid(2.3, -4.9, 3.4, 0.2, KIOSK + 1);
  addInterior(x - 3.8, x + 3.8, z - 9.0, z - 5.0, KIOSK);
  put(m.white, 8.4, 0.18, 4.9, 0, KIOSK + 0.09, -7);
  put(m.green, 8.06, 0.35, 0.03, 0, KIOSK - 0.3, -4.785);
  put(m.orange, 8.06, 0.06, 0.035, 0, KIOSK - 0.52, -4.783);
  put(sign('GATOR GAS', 'PAY INSIDE · SNACKS · COLD DRINKS', GREEN, CREAM, 1024, 192), 4.6, 0.86, 0.1, 0, KIOSK + 0.65, -4.85);
  for (const px of [-2.4, 2.4]) {
    put(clear, 2.6, 1.5, 0.04, px, 1.55, -4.9);
    put(m.steel, 2.6, 0.06, 0.24, px, 0.82, -4.9);
    put(m.steel, 0.05, 1.5, 0.08, px, 1.55, -4.9);
  }
  put(m.steel, 1.0, 0.5, 0.8, 2.4, KIOSK + 0.43, -7.6);     // air-conditioning unit on the roof

  // Glass door that slides aside as you walk up.
  const door = new THREE.Group();
  door.position.set(0, 0, -4.86);
  block(door, clear, 1.2, 2.25, 0.03, 0, 1.13, 0);
  block(door, m.steel, 1.2, 0.06, 0.05, 0, 2.24, 0);
  block(door, m.steel, 1.2, 0.08, 0.05, 0, 0.04, 0);
  block(door, m.steel, 0.05, 2.25, 0.05, -0.575, 1.13, 0);
  block(door, m.steel, 0.05, 2.25, 0.05, 0.575, 1.13, 0);
  block(door, sign('OPEN', null, '#c23a2e', CREAM, 128, 64), 0.4, 0.2, 0.035, 0, 1.6, 0);
  station.add(door);

  // Inside: strip lights.
  for (const lx of [-1.9, 1.9]) put(m.light, 1.2, 0.04, 0.22, lx, KIOSK - 0.02, -7);
  const glow = new THREE.PointLight(0xf4f8ff, 12, 9, 1.5);
  glow.position.set(0, KIOSK - 0.6, -7);
  station.add(glow);

  // Counter on the left with a till and a hot-dog roller; cigarettes on the wall behind.
  thing(m.white, 0.7, 0.95, 2.0, -1.9, -7.6);
  put(worktop, 0.78, 0.05, 2.08, -1.9, 0.975, -7.6);
  put(m.green, 0.02, 0.3, 2.0, -1.54, 0.6, -7.6);
  put(m.dark, 0.38, 0.14, 0.4, -1.95, 1.07, -7.15);          // till
  put(m.dark, 0.04, 0.24, 0.32, -2.14, 1.28, -7.15);
  put(m.screen, 0.02, 0.2, 0.28, -2.115, 1.28, -7.15);
  put(m.steel, 0.4, 0.16, 0.5, -1.9, 1.08, -8.2);            // hot-dog roller
  for (let i = 0; i < 4; i++) put(plain(0xa8492e, 0.5), 0.3, 0.04, 0.04, -1.9, 1.18, -8.38 + i * 0.12);
  for (let level = 0; level < 4; level++) {
    put(shelving, 0.2, 0.025, 2.0, -3.7, 1.15 + level * 0.38, -7.6);
    for (let i = 0; i < 14; i++) product(-3.7, 1.165 + level * 0.38, -8.5 + i * 0.138, 0.14, level < 2 ? 0.11 : 0.24, 0.1, PACKAGING[(level * 3 + (i >> 2)) % 10]);
  }

  // Drinks fridges along the back wall.
  solid(2.0, -8.65, 3.5, 0.65, 2.3);
  put(m.dark, 3.5, 0.18, 0.65, 2.0, 0.15, -8.65);
  put(m.dark, 3.5, 0.22, 0.65, 2.0, 2.19, -8.65);
  put(sign('ICE COLD DRINKS', null, GREEN, CREAM, 512, 48), 3.4, 0.18, 0.02, 2.0, 2.19, -8.31);
  put(new THREE.MeshBasicMaterial({ color: 0xeaf6ff }), 3.4, 1.85, 0.03, 2.0, 1.15, -8.96);
  for (let edge = 0; edge <= 3; edge++) put(m.dark, 0.07, 1.85, 0.65, 0.3 + edge * 1.133, 1.15, -8.65);
  for (let unit = 0; unit < 3; unit++) {
    const fx = 0.867 + unit * 1.133;
    put(clear, 1.06, 1.83, 0.03, fx, 1.15, -8.33);
    put(m.steel, 0.03, 0.5, 0.04, fx + 0.45, 1.15, -8.3);
    for (let level = 0; level < 5; level++) {
      const y = 0.26 + level * 0.36;
      put(m.white, 1.06, 0.015, 0.5, fx, y, -8.65);
      for (let i = 0; i < 8; i++) for (let row = 0; row < 3; row++) {
        product(fx - 0.42 + i * 0.12, y + 0.01, -8.45 - row * 0.15, 0.075, level % 2 ? 0.2 : 0.14, 0.075, PACKAGING[(unit * 3 + level + (i >> 1)) % 10]);
      }
    }
  }

  // A short rack of snacks in the middle, and a coffee counter on the right.
  solid(1.6, -6.65, 0.6, 1.5, 1.5);
  put(shelving, 0.6, 0.14, 1.5, 1.6, 0.13, -6.65);
  put(shelving, 0.05, 1.4, 1.5, 1.6, 0.76, -6.65);
  put(m.green, 0.62, 0.06, 1.52, 1.6, 1.47, -6.65);
  for (let level = 0; level < 4; level++) {
    const y = 0.2 + level * 0.32;
    if (level) put(shelving, 0.6, 0.02, 1.5, 1.6, y, -6.65);
    for (const side of [-1, 1]) for (let i = 0; i < 8; i++) {
      const kind = ((i >> 1) + level * 3 + (side > 0 ? 4 : 0)) % 10;
      product(1.6 + side * 0.16, y + 0.02, -7.3 + i * 0.185, 0.22, 0.12 + (kind % 4) * 0.035, 0.15, PACKAGING[kind]);
    }
  }
  thing(m.white, 0.55, 0.9, 1.4, 3.5, -6.4);
  put(worktop, 0.6, 0.04, 1.44, 3.5, 0.92, -6.4);
  put(m.dark, 0.3, 0.38, 0.32, 3.55, 1.13, -6.75);           // coffee machine
  put(m.steel, 0.14, 0.16, 0.14, 3.35, 1.02, -6.75);
  for (let cup = 0; cup < 3; cup++) put(m.white, 0.08, 0.2, 0.08, 3.55, 1.04, -6.2 + cup * 0.1);
  put(sign('COFFEE', null, '#232527', '#ffd23a', 256, 64), 0.02, 0.18, 0.7, 3.78, 1.9, -6.4);

  const boxes = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.55 }), stock.length);
  const matrix = new THREE.Matrix4(), tint = new THREE.Color();
  stock.forEach((item, i) => {
    matrix.makeScale(item.w, item.h, item.d).setPosition(item.px, item.y, item.pz);
    boxes.setMatrixAt(i, matrix);
    boxes.setColorAt(i, tint.set(item.color));
  });
  station.add(boxes);
  station.userData = { door, doorSpot: new THREE.Vector3(x, 0, z - 4.9), open: 0 };
  // Outside the kiosk: ice box, propane cage, air machine, newspaper box.
  thing(m.white, 1.5, 1.05, 0.7, -2.9, -4.4);
  put(sign('ICE', null, '#f4f3ee', '#2f6fb5', 256, 128), 1.0, 0.5, 0.02, -2.9, 0.58, -4.04);
  thing(m.steel, 1.1, 1.3, 0.55, 2.9, -4.45);
  for (let i = 0; i < 3; i++) put(m.white, 0.26, 0.5, 0.26, 2.56 + i * 0.34, 0.4, -4.4);
  put(sign('PROPANE', null, '#c23a2e', CREAM, 256, 64), 1.0, 0.2, 0.02, 2.9, 1.12, -4.17);
  thing(m.orange, 0.5, 1.3, 0.4, 5.2, -5.2);
  put(sign('AIR', 'WATER', '#232527', '#ffd23a', 128, 128), 0.36, 0.36, 0.02, 5.2, 1.0, -4.99);
  put(m.dark, 0.04, 0.6, 0.04, 5.5, 0.5, -5.1);
  thing(plain(0x2f6fb5, 0.6), 0.45, 0.95, 0.4, -4.3, -4.55);
  // Parking lines in front of the kiosk, and a dumpster round the side.
  for (const px of [-3.6, -1.2, 1.2, 3.6]) put(m.white, 0.1, 0.005, 2.2, px, 0.064, -2.9).castShadow = false;
  thing(m.dumpster, 2.0, 1.25, 1.2, -8.6, -8.2);
  put(m.dark, 2.06, 0.08, 1.26, -8.6, 1.29, -8.2);

  // --- The tall price sign by the road ---
  for (const px of [-10.2, -8.4]) { solid(px, 8.6, 0.24, 0.24, 6.5); put(m.steel, 0.2, 6.4, 0.2, px, 3.2, 8.6); }
  put(new THREE.MeshBasicMaterial({ map: priceBoard() }), 2.3, 3.4, 0.16, -9.3, 4.9, 8.6);
  put(m.steel, 2.4, 3.5, 0.1, -9.3, 4.9, 8.6);

  scene.add(station);
  clearings[6].set(x - 11.1, z - 10.1, x + 11.1, z + 10.1); // no grass on the forecourt
  return station;
}

// Each frame: the kiosk's glass door slides aside when the player is near.
export function updateGasStation(station, playerPosition, dt) {
  const state = station.userData;
  const near = Math.hypot(playerPosition.x - state.doorSpot.x, playerPosition.z - state.doorSpot.z) < 2.4;
  state.open += ((near ? 1 : 0) - state.open) * Math.min(1, 6 * dt);
  state.door.position.x = 1.18 * state.open;
}