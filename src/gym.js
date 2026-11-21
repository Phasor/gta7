// A gym: "Iron Gator Gym". Inside are punching bags, free weights and bench
// presses. Each one trains a different stat, and a sign on the wall by each says
// which. The training itself (and what the stats do) is handled in main.js.
import * as THREE from 'three';
import { addObstacle, addFloor, addInterior } from './world.js';
import { clearings } from './grass.js';
import { block, canvasTexture, speckle } from './house.js';
import { label } from './store.js';

const SLAB = 0.15, HEIGHT = 3.4;
const W = 11, D = 10;
export const BENCH_TOP = SLAB + 0.52; // height of the bench pad

// What each piece of equipment trains. `stat` is the name used in the save file.
export const TRAINING = {
  bag: { stat: 'boxing', title: 'Boxing', thing: 'the punching bag', effect: 'faster punches' },
  weights: { stat: 'strength', title: 'Strength', thing: 'the weights', effect: 'harder punches' },
  bench: { stat: 'toughness', title: 'Toughness', thing: 'the bench press', effect: 'back on your feet sooner after a knock-down' },
};

// Builds the gym with its centre at (x, z). The front faces +Z, toward the road.
export function createGym(scene, x, z, roadEdgeZ) {
  const gym = new THREE.Group();
  gym.position.set(x, 0, z);
  const top = SLAB + HEIGHT;

  const plain = (color, roughness = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  const m = {
    wall: new THREE.MeshStandardMaterial({ roughness: 0.95, map: canvasTexture(128, (ctx, s) => { ctx.fillStyle = '#5c6066'; ctx.fillRect(0, 0, s, s); speckle(ctx, s, 2500, 0.05); }, 3, 2) }),
    concrete: new THREE.MeshStandardMaterial({ roughness: 1, map: canvasTexture(128, (ctx, s) => { ctx.fillStyle = '#b9b3a6'; ctx.fillRect(0, 0, s, s); speckle(ctx, s, 3000, 0.06); }, 3, 2) }),
    rubber: new THREE.MeshStandardMaterial({ roughness: 0.9, map: canvasTexture(128, (ctx, s) => { // black rubber tiles with coloured flecks
      ctx.fillStyle = '#26282b';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 500; i++) { ctx.fillStyle = ['#5a7fa8', '#b0b4b8', '#c96a3a'][i % 3]; ctx.fillRect(Math.random() * s, Math.random() * s, 1.5, 1.5); }
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.strokeRect(0, 0, s, s);
    }, 6, 5) }),
    paint: plain(0xe9e6df, 0.95),
    ceiling: plain(0x2e3033, 1),
    orange: plain(0xf07a1c, 0.6),
    black: plain(0x17181a, 0.6),
    steel: plain(0xa9adb0, 0.3, { metalness: 0.8 }),
    iron: plain(0x2b2d30, 0.5, { metalness: 0.6 }),
    pad: plain(0x8a1f1a, 0.7),          // red vinyl
    leather: plain(0x6a2a1c, 0.6),      // the punching bags
    mirror: plain(0xbfd0d6, 0.06, { metalness: 0.85 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xbfe0e6, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.22, depthWrite: false }),
    light: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };
  const sign = (text, small, background, ink, w = 512, h = 128) => new THREE.MeshBasicMaterial({ map: label(text, small, background, ink, w, h) });
  const put = (material, w, h, d, px, y, pz, parent = gym) => block(parent, material, w, h, d, px, SLAB + y, pz);
  const solid = (lx, lz, w, d, height) => addObstacle(x + lx - w / 2, x + lx + w / 2, z + lz - d / 2, z + lz + d / 2, height);
  const round = (material, radius, length, px, y, pz, axis = 'y', parent = gym) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 18), material);
    if (axis === 'x') mesh.rotation.z = Math.PI / 2;
    if (axis === 'z') mesh.rotation.x = Math.PI / 2;
    mesh.position.set(px, parent === gym ? SLAB + y : y, pz);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // --- The building ---
  block(gym, m.concrete, W + 0.3, SLAB, D + 0.3, 0, SLAB / 2, 0);
  put(m.rubber, W - 0.4, 0.02, D - 0.4, 0, 0.01, 0).castShadow = false;
  put(m.wall, W, HEIGHT, 0.2, 0, HEIGHT / 2, -D / 2 + 0.1);
  put(m.wall, 0.2, HEIGHT, D, -W / 2 + 0.1, HEIGHT / 2, 0);
  put(m.wall, 0.2, HEIGHT, D, W / 2 - 0.1, HEIGHT / 2, 0);
  const fz = D / 2 - 0.1;
  for (const [px, w] of [[-5.1, 0.8], [-1.2, 0.8], [1.2, 0.8], [5.1, 0.8]]) put(m.wall, w, 2.5, 0.2, px, 1.25, fz);
  for (const px of [-3.15, 3.15]) {
    put(m.wall, 3.1, 0.5, 0.2, px, 0.25, fz);
    put(m.glass, 3.1, 2.0, 0.04, px, 1.5, fz);
    put(m.steel, 3.1, 0.05, 0.08, px, 0.52, fz);
    put(m.steel, 0.05, 2.0, 0.08, px, 1.5, fz);
  }
  put(m.wall, W, HEIGHT - 2.5, 0.2, 0, 2.5 + (HEIGHT - 2.5) / 2, fz);
  put(m.black, W + 0.4, 0.22, D + 0.4, 0, HEIGHT + 0.11, 0);
  put(m.orange, W + 0.06, 0.3, 0.03, 0, HEIGHT - 0.28, D / 2 + 0.02);
  put(sign('IRON GATOR GYM', 'BOXING · WEIGHTS · OPEN 24 HOURS', '#17181a', '#f07a1c', 1024, 192), 6.6, 1.2, 0.14, 0, HEIGHT + 0.85, D / 2 - 0.1);
  for (const px of [-2.6, 2.6]) put(m.black, 0.12, 0.5, 0.12, px, HEIGHT + 0.3, D / 2 - 0.2);

  // Glass door that slides aside.
  const door = new THREE.Group();
  door.position.set(0, 0, fz - 0.06);
  put(m.glass, 1.6, 2.4, 0.03, 0, 1.2, 0, door);
  for (const [w, h, px, y] of [[1.6, 0.07, 0, 2.38], [1.6, 0.1, 0, 0.05], [0.07, 2.4, -0.765, 1.2], [0.07, 2.4, 0.765, 1.2]]) put(m.steel, w, h, 0.05, px, y, 0, door);
  put(sign('OPEN', null, '#f07a1c', '#17181a', 128, 64), 0.4, 0.2, 0.035, 0, 1.5, 0, door);
  gym.add(door);

  // Forecourt down to the pavement.
  const gap = Math.abs(roadEdgeZ - (z + D / 2));
  block(gym, m.concrete, W + 1, 0.06, gap + 0.2, 0, 0.03, D / 2 + gap / 2).castShadow = false;

  // --- Inside: mirrors along the back wall, a dark ceiling and bright lights ---
  put(m.paint, W - 0.4, HEIGHT, 0.04, 0, HEIGHT / 2, -D / 2 + 0.22);
  put(m.paint, 0.04, HEIGHT, D - 0.4, -W / 2 + 0.22, HEIGHT / 2, 0);
  put(m.paint, 0.04, HEIGHT, D - 0.4, W / 2 - 0.22, HEIGHT / 2, 0);
  put(m.orange, W - 0.4, 0.25, 0.05, 0, 2.75, -D / 2 + 0.23);
  put(m.mirror, 5.2, 2.0, 0.03, 0.4, 1.25, -D / 2 + 0.25);
  for (const px of [-0.9, 0.4, 1.7]) put(m.steel, 0.03, 2.0, 0.04, px, 1.25, -D / 2 + 0.26);
  put(m.ceiling, W - 0.4, 0.02, D - 0.4, 0, HEIGHT - 0.01, 0);
  for (const lx of [-2.8, 2.8]) for (const lz of [-2.2, 2.2]) put(m.light, 1.4, 0.04, 0.24, lx, HEIGHT - 0.04, lz);
  for (const lz of [-2.2, 2.2]) {
    const glow = new THREE.PointLight(0xf6f8ff, 18, 12, 1.5);
    glow.position.set(0, top - 0.7, lz);
    gym.add(glow);
  }

  // Signs saying what each area trains.
  const info = (kind, w, px, y, pz, alongZ) => {
    const t = TRAINING[kind];
    const board = sign(t.title.toUpperCase(), `${t.thing.replace('the ', '').toUpperCase()} · ${t.effect.toUpperCase()}`, '#17181a', '#f07a1c', 512, 128);
    return alongZ ? put(board, 0.04, w / 4, w, px, y, pz) : put(board, w, w / 4, 0.04, px, y, pz);
  };
  info('bag', 2.6, -W / 2 + 0.26, 2.3, -1.2, true);
  info('weights', 2.6, 0.4, 2.62, -D / 2 + 0.27, false);
  info('bench', 3.0, W / 2 - 0.26, 2.3, -1.0, true);

  // --- Punching bags, hanging from the ceiling on chains ---
  const bags = [[-3.7, -2.7], [-3.7, 0.3]].map(([bx, bz]) => {
    const swing = new THREE.Group(); // pivots at the ceiling so the bag can swing
    swing.position.set(bx, top - 0.02, bz);
    round(m.steel, 0.012, 1.25, 0, -0.62, 0, 'y', swing);
    round(m.leather, 0.23, 1.15, 0, -1.8, 0, 'y', swing);
    round(m.black, 0.235, 0.08, 0, -1.25, 0, 'y', swing);
    round(m.black, 0.235, 0.08, 0, -2.34, 0, 'y', swing);
    gym.add(swing);
    solid(bx, bz, 0.4, 0.4, top);
    return { swing, spot: new THREE.Vector3(x + bx + 0.86, 0, z + bz), facing: -Math.PI / 2, kind: 'bag', sway: 0 };
  });
  put(m.black, 0.1, 0.1, 4.2, -3.7, HEIGHT - 0.08, -1.2); // the beam they hang from

  // --- Free weights: a rack of dumbbells in front of the mirror, with a mat to stand on ---
  solid(0.4, -4.3, 3.4, 0.6, SLAB + 1.0);
  for (const y of [0.35, 0.8]) {
    put(m.iron, 3.4, 0.05, 0.5, 0.4, y, -4.3);
    for (let i = 0; i < 7; i++) {
      const size = 0.07 + i * 0.012 + (y > 0.5 ? 0 : 0.03);
      for (const end of [-0.11, 0.11]) round(m.iron, size, 0.07, -1.0 + i * 0.47, y + 0.03 + size, -4.3 + end, 'z');
      round(m.steel, 0.016, 0.2, -1.0 + i * 0.47, y + 0.03 + size, -4.3, 'z');
    }
  }
  for (const px of [-1.25, 2.05]) put(m.iron, 0.06, 1.0, 0.5, px, 0.5, -4.3);
  put(m.pad, 2.0, 0.025, 1.4, 0.4, 0.03, -3.0).castShadow = false; // mat
  // The pair he trains with, waiting on the mat.
  const dumbbells = [-1, 1].map((side) => {
    const dumbbell = new THREE.Group();
    round(m.steel, 0.016, 0.22, 0, 0, 0, 'x', dumbbell);
    for (const end of [-0.1, 0.1]) round(m.iron, 0.075, 0.07, end, 0, 0, 'x', dumbbell);
    dumbbell.userData.rest = new THREE.Vector3(x + 0.4 + side * 0.5, SLAB + 0.11, z - 2.55);
    dumbbell.position.copy(dumbbell.userData.rest).sub(gym.position);
    gym.add(dumbbell);
    return dumbbell;
  });
  // Kettlebells and a tree of weight plates.
  for (let i = 0; i < 4; i++) {
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.11 + i * 0.012, 12, 10), m.iron);
    bell.position.set(-2.2 + i * 0.36, SLAB + 0.12 + i * 0.01, -4.5);
    gym.add(bell);
    put(m.iron, 0.14, 0.03, 0.04, -2.2 + i * 0.36, 0.28 + i * 0.02, -4.5);
  }

  // --- Bench presses: a padded bench, uprights, and a barbell ---
  const benches = [-2.3, 1.0].map((bz, index) => {
    const bx = 3.6;
    solid(bx, bz, 0.5, 1.7, BENCH_TOP - 0.08);
    put(m.pad, 0.46, 0.12, 1.7, bx, BENCH_TOP - SLAB - 0.06, bz);
    put(m.iron, 0.1, BENCH_TOP - SLAB - 0.12, 1.3, bx, (BENCH_TOP - SLAB - 0.12) / 2, bz);
    for (const side of [-1, 1]) {
      put(m.iron, 0.07, 1.25, 0.07, bx + side * 0.6, 0.625, bz - 0.55); // uprights
      put(m.iron, 0.07, 0.07, 0.5, bx + side * 0.6, 0.035, bz - 0.55);
      put(m.steel, 0.1, 0.03, 0.12, bx + side * 0.6, 1.13, bz - 0.5);   // hooks the bar rests on
      solid(bx + side * 0.6, bz - 0.55, 0.12, 0.12, SLAB + 1.3);
    }
    const barbell = new THREE.Group();
    round(m.steel, 0.016, 2.0, 0, 0, 0, 'x', barbell);
    for (const side of [-1, 1]) for (const [at, size] of [[0.78, 0.2], [0.85, 0.2], [0.91, 0.14]]) round(m.iron, size, 0.05, side * at, 0, 0, 'x', barbell);
    barbell.userData.rest = new THREE.Vector3(x + bx, SLAB + 1.18, z + bz - 0.5);
    barbell.position.copy(barbell.userData.rest).sub(gym.position);
    gym.add(barbell);
    // He lies with his feet at the near end of the bench and his head under the bar.
    return { barbell, kind: 'bench', spot: new THREE.Vector3(x + bx - 0.9, 0, z + bz + 0.2), facing: Math.PI / 2,
      feet: new THREE.Vector3(x + bx, BENCH_TOP, z + bz + 0.95), index };
  });

  // Lockers and a water cooler by the front wall, and a motivational poster.
  solid(4.6, 4.0, 1.4, 0.6, SLAB + 1.9);
  for (let i = 0; i < 3; i++) {
    put(i % 2 ? m.orange : m.iron, 0.44, 1.85, 0.55, 4.14 + i * 0.46, 0.925, 4.0);
    put(m.steel, 0.03, 0.12, 0.02, 4.3 + i * 0.46, 1.1, 3.71);
  }
  solid(-4.7, 4.1, 0.4, 0.4, SLAB + 1.3);
  put(m.paint, 0.36, 0.95, 0.36, -4.7, 0.475, 4.1);
  round(new THREE.MeshStandardMaterial({ color: 0x8fc4e8, roughness: 0.1, transparent: true, opacity: 0.6 }), 0.15, 0.4, -4.7, 1.17, 4.1);
  put(sign('NO PAIN', 'NO GAIN', '#f07a1c', '#17181a', 256, 128), 0.04, 0.7, 1.4, W / 2 - 0.26, 1.5, 2.6);

  scene.add(gym);

  solid(0, -D / 2 + 0.1, W, 0.2, top + 1);
  solid(-W / 2 + 0.1, 0, 0.2, D, top + 1);
  solid(W / 2 - 0.1, 0, 0.2, D, top + 1);
  solid(-3.15, fz, 4.7, 0.2, top + 1);
  solid(3.15, fz, 4.7, 0.2, top + 1);
  addFloor(x - W / 2 - 0.15, x + W / 2 + 0.15, z - D / 2 - 0.15, z + D / 2 + 0.15, SLAB);
  addInterior(x - W / 2 + 0.2, x + W / 2 - 0.2, z - D / 2 + 0.2, z + D / 2 - 0.2, top);
  clearings[39].set(x - W / 2 - 0.6, z - D / 2 - 0.3, x + W / 2 + 0.6, Math.max(roadEdgeZ, z + D / 2) + 0.1);

  const weights = { kind: 'weights', spot: new THREE.Vector3(x + 0.4, 0, z - 3.0), facing: Math.PI, dumbbells };
  return { group: gym, door, doorSpot: new THREE.Vector3(x, 0, z + fz), open: 0, bags, benches, weights, stations: [...bags, weights, ...benches] };
}

// Each frame: the door slides, and the punching bags swing and settle.
export function updateGym(gym, playerPosition, dt, time) {
  const near = Math.hypot(playerPosition.x - gym.doorSpot.x, playerPosition.z - gym.doorSpot.z) < 2.6;
  gym.open += ((near ? 1 : 0) - gym.open) * Math.min(1, 6 * dt);
  gym.door.position.x = 1.62 * gym.open;
  for (const bag of gym.bags) {
    bag.sway *= Math.exp(-dt * 1.2);
    bag.swing.rotation.z = Math.sin(time * 5) * 0.16 * bag.sway;
  }
}

// The piece of equipment the player is standing at, if any.
export function stationNear(gym, position) {
  return gym.stations.find((station) => Math.hypot(station.spot.x - position.x, station.spot.z - position.z) < 0.9) || null;
}
