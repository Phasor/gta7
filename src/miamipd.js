// Miami Police Department: a two-storey station at the bottom end of Brew St.
// Downstairs: the lobby, the front desk and the offices. A staircase along the
// right-hand wall goes up to the cell block, where the prisoners are kept.
// The front faces +Z, up the street.
import * as THREE from 'three';
import { addObstacle, addFloor, addInterior } from './world.js';
import { clearings } from './grass.js';
import { block, canvasTexture, speckle } from './house.js';
import { label } from './store.js';
import { makePatrolCar } from './policestation.js';

const SLAB = 0.3, ROOM = 3.3, BETWEEN = 0.25;       // base, the height of each floor's rooms, and the slab between the floors
const F2 = SLAB + ROOM + BETWEEN, TOP = F2 + ROOM;   // the upstairs floor, and the roof
const W = 18, D = 13;
const STEPS = 13, RISE = (F2 - SLAB) / STEPS, RUN = 0.46;
const STAIR_X = 8.02, STAIR_W = 1.55, STAIR_FOOT = 3.0, STAIR_HEAD = STAIR_FOOT - STEPS * RUN;
const NAVY = '#12305a';

export function createMiamiPD(scene, x, z, streetEndZ) {
  const station = new THREE.Group();
  station.position.set(x, 0, z);
  const H = TOP - SLAB; // how tall the walls are

  const plain = (color, roughness = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  const m = {
    wall: new THREE.MeshStandardMaterial({ roughness: 0.95, map: canvasTexture(128, (ctx, s) => { ctx.fillStyle = '#eef0ec'; ctx.fillRect(0, 0, s, s); speckle(ctx, s, 2500, 0.04); }, 4, 3) }),
    concrete: new THREE.MeshStandardMaterial({ roughness: 1, map: canvasTexture(128, (ctx, s) => { ctx.fillStyle = '#b9b3a6'; ctx.fillRect(0, 0, s, s); speckle(ctx, s, 3000, 0.06); }, 4, 3) }),
    asphalt: new THREE.MeshStandardMaterial({ roughness: 0.95, map: canvasTexture(128, (ctx, s) => { ctx.fillStyle = '#4a4a48'; ctx.fillRect(0, 0, s, s); speckle(ctx, s, 4000, 0.07); }, 4, 2) }),
    lino: new THREE.MeshStandardMaterial({ roughness: 0.4, map: canvasTexture(64, (ctx, s) => {
      ctx.fillStyle = '#c9cbc8';
      ctx.fillRect(0, 0, s, s);
      speckle(ctx, s, 600, 0.07);
      ctx.strokeStyle = 'rgba(80,85,90,0.5)';
      ctx.strokeRect(0, 0, s, s);
    }, 11, 8) }),
    navy: plain(0x12305a, 0.6),
    teal: plain(0x2fb3a8, 0.6),
    white: plain(0xf2f2ee, 0.6),
    wood: plain(0x6b4a30, 0.6),
    steel: plain(0x9ea3a7, 0.35, { metalness: 0.7 }),
    dark: plain(0x1b1c1e, 0.6),
    cabinet: plain(0x7f8a8c, 0.5, { metalness: 0.3 }),
    mattress: plain(0x8a9aa0, 1),
    glass: new THREE.MeshStandardMaterial({ color: 0xbfe0e6, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.22, depthWrite: false }),
    window: plain(0x27475a, 0.1, { metalness: 0.6 }),
    daylight: new THREE.MeshBasicMaterial({ color: 0xcfe6f2 }),
    light: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    screen: new THREE.MeshBasicMaterial({ color: 0x3fa0e0 }),
    blueLamp: new THREE.MeshBasicMaterial({ color: 0x3f7fff }),
  };
  const sign = (text, small, background, ink, w = 512, h = 128) => new THREE.MeshBasicMaterial({ map: label(text, small, background, ink, w, h) });
  // y is measured from the floor of the storey: `base` is SLAB downstairs and F2 upstairs.
  const put = (material, w, h, d, px, y, pz, base = SLAB) => block(station, material, w, h, d, px, base + y, pz);
  const up = (material, w, h, d, px, y, pz) => put(material, w, h, d, px, y, pz, F2);
  const solid = (lx, lz, w, d, height, base) => addObstacle(x + lx - w / 2, x + lx + w / 2, z + lz - d / 2, z + lz + d / 2, height, base);
  const upSolid = (lx, lz, w, d, height) => solid(lx, lz, w, d, F2 + height, F2 - 0.3); // only in the way upstairs
  const thing = (material, w, h, d, px, pz) => { solid(px, pz, w, d, SLAB + h); return put(material, w, h, d, px, h / 2, pz); };
  const upThing = (material, w, h, d, px, pz) => { upSolid(px, pz, w, d, h); return up(material, w, h, d, px, h / 2, pz); };

  // --- The shell: two storeys of white stucco with a navy and teal band ---
  const fz = D / 2 - 0.1;
  block(station, m.concrete, W + 0.4, SLAB, D + 0.4, 0, SLAB / 2, 0);
  put(m.lino, W - 0.4, 0.02, D - 0.4, 0, 0.01, 0).castShadow = false;
  put(m.wall, W, H, 0.2, 0, H / 2, -fz);
  put(m.wall, 0.2, H, D, -W / 2 + 0.1, H / 2, 0);
  put(m.wall, 0.2, H, D, W / 2 - 0.1, H / 2, 0);
  for (const [px, w] of [[-8.2, 1.6], [-1.6, 1.2], [1.6, 1.2], [8.2, 1.6]]) put(m.wall, w, 2.5, 0.2, px, 1.25, fz);
  for (const px of [-4.8, 4.8]) {
    put(m.wall, 5.2, 0.9, 0.2, px, 0.45, fz);
    put(m.glass, 5.2, 1.6, 0.04, px, 1.7, fz);
    put(m.white, 5.2, 0.07, 0.24, px, 0.92, fz);
    for (const mx of [-1.3, 0, 1.3]) put(m.white, 0.06, 1.6, 0.08, px + mx, 1.7, fz);
  }
  put(m.wall, W, H - 2.5, 0.2, 0, 2.5 + (H - 2.5) / 2, fz);                    // the front wall above the doors, right up to the roof
  put(m.white, W + 0.5, 0.25, D + 0.5, 0, H + 0.12, 0);                        // flat roof
  put(m.navy, W + 0.06, 0.55, 0.04, 0, ROOM + 0.1, D / 2 + 0.02);              // navy band between the storeys
  put(m.teal, W + 0.06, 0.12, 0.05, 0, ROOM - 0.25, D / 2 + 0.02);
  put(m.teal, W + 0.06, 0.3, 0.04, 0, H - 0.2, D / 2 + 0.02);
  put(sign('MIAMI POLICE', null, NAVY, '#f2f2ee', 512, 96), 4.6, 0.5, 0.05, 0, ROOM + 0.1, D / 2 + 0.05);
  put(sign('MIAMI POLICE DEPARTMENT', 'CENTRAL STATION', NAVY, '#f2f2ee', 1024, 192), 8.4, 1.3, 0.14, 0, H + 0.9, D / 2 - 0.1);
  for (const px of [-3.4, 3.4]) put(m.navy, 0.12, 0.5, 0.12, px, H + 0.3, D / 2 - 0.2);
  for (const px of [-1.35, 1.35]) put(m.blueLamp, 0.2, 0.3, 0.2, px, 2.2, D / 2 + 0.12);
  // Upstairs windows: dark glass with bars outside, and a pale glow where they are inside.
  for (const px of [-6.3, -2.1, 2.1, 6.3]) {
    put(m.window, 2.6, 1.3, 0.04, px, F2 - SLAB + 1.75, D / 2 + 0.02);
    put(m.white, 2.8, 0.1, 0.1, px, F2 - SLAB + 1.05, D / 2 + 0.04);
    for (let bar = -1.1; bar <= 1.11; bar += 0.44) put(m.steel, 0.04, 1.3, 0.04, px + bar, F2 - SLAB + 1.75, D / 2 + 0.06);
    up(m.daylight, 2.6, 1.3, 0.03, px, 1.75, fz - 0.12);
    for (let bar = -1.1; bar <= 1.11; bar += 0.44) up(m.steel, 0.04, 1.3, 0.04, px + bar, 1.75, fz - 0.14);
  }

  // Steps up to the door, and the glass doors that slide apart.
  block(station, m.concrete, 4.4, SLAB * 0.5, 1.4, 0, SLAB * 0.25, D / 2 + 0.9);
  addFloor(x - 2.2, x + 2.2, z + D / 2 + 0.2, z + D / 2 + 1.6, SLAB * 0.5);
  const doors = [-1, 1].map((side) => {
    const door = new THREE.Group();
    door.position.set(side * 0.5, 0, fz - 0.06);
    block(door, m.glass, 1.0, 2.45, 0.03, 0, SLAB + 1.225, 0);
    for (const [w, h, px, y] of [[1.0, 0.07, 0, 2.43], [1.0, 0.1, 0, 0.05], [0.06, 2.45, -0.47, 1.225], [0.06, 2.45, 0.47, 1.225]]) block(door, m.steel, w, h, 0.05, px, SLAB + y, 0);
    station.add(door);
    return { door, side };
  });

  // The car park in front, with two patrol cars and a flagpole.
  const gap = Math.abs(streetEndZ - (z + D / 2));
  block(station, m.asphalt, W + 4, 0.06, gap + 0.2, 0, 0.03, D / 2 + gap / 2).castShadow = false;
  block(station, m.concrete, 2.6, 0.07, gap - 1.4, 0, 0.035, D / 2 + 1.6 + (gap - 1.4) / 2).castShadow = false;
  const cars = [];
  for (const [cx, turn] of [[-6.4, 0.08], [6.4, -0.1]]) {
    const car = makePatrolCar('MIAMI P.D.  ·  UNIT 7', '7');
    car.position.set(cx, 0.04, D / 2 + gap / 2 + 0.3);
    car.rotation.y = Math.PI + turn;
    station.add(car);
    cars.push({ car, block: solid(cx, D / 2 + gap / 2 + 0.3, 2.2, 4.8, 1.7) });
    for (const edge of [-1.5, 1.5]) block(station, m.white, 0.1, 0.005, 5, cx + edge, 0.066, D / 2 + gap / 2 + 0.3).castShadow = false;
  }
  solid(-9.8, D / 2 + 1.2, 0.2, 0.2, 9);
  block(station, m.steel, 0.1, 9, 0.1, -9.8, 4.5, D / 2 + 1.2);
  block(station, new THREE.MeshBasicMaterial({ map: label('MIAMI P.D.', null, NAVY, '#f2f2ee', 256, 128), side: THREE.DoubleSide }), 1.7, 0.9, 0.02, -8.9, 8.4, D / 2 + 1.2);

  // --- The slab between the floors, with a hole for the stairs ---
  const slab = (x0, x1, z0, z1) => {
    put(m.white, x1 - x0, BETWEEN, z1 - z0, (x0 + x1) / 2, ROOM + BETWEEN / 2, (z0 + z1) / 2);
    addFloor(x + x0, x + x1, z + z0, z + z1, F2);
  };
  slab(-W / 2 + 0.2, 7.22, -D / 2 + 0.2, D / 2 - 0.2);
  slab(7.22, W / 2 - 0.2, -D / 2 + 0.2, STAIR_HEAD + 0.02);    // the landing at the top of the stairs
  slab(7.22, W / 2 - 0.2, STAIR_FOOT + 0.1, D / 2 - 0.2);
  up(m.lino, 16, 0.02, D - 0.4, -0.9, 0.01, 0).castShadow = false;

  // --- The stairs: thirteen steps up the right-hand wall, from the lobby to the cell block ---
  for (let i = 0; i < STEPS; i++) {
    const height = (i + 1) * RISE, stepZ = STAIR_FOOT - RUN * (i + 0.5);
    put(m.concrete, STAIR_W, height, RUN, STAIR_X, height / 2, stepZ);
    put(m.navy, STAIR_W, 0.02, 0.06, STAIR_X, height + 0.01, stepZ + RUN / 2 - 0.03);     // a dark edge on each step
    addFloor(x + STAIR_X - STAIR_W / 2, x + STAIR_X + STAIR_W / 2, z + stepZ - RUN / 2, z + stepZ + RUN / 2, SLAB + height);
  }
  put(m.wall, 0.15, ROOM, 6, 7.15, ROOM / 2, 0);                               // the wall beside the stairs
  solid(7.15, 0, 0.15, 6, TOP);
  put(m.steel, 0.05, 0.05, 6.4, 7.28, 1.9, 0).rotation.x = Math.atan2(F2 - SLAB, STEPS * RUN); // handrail
  up(m.steel, 0.08, 1.0, 6, 7.15, 0.5, 0);                                     // railings round the stairwell upstairs
  up(m.steel, 1.75, 1.0, 0.08, STAIR_X, 0.5, STAIR_FOOT + 0.1);
  upSolid(STAIR_X, STAIR_FOOT + 0.1, 1.75, 0.1, 1.2);
  solid(STAIR_X, STAIR_HEAD - 0.06, 1.75, 0.1, F2 - 0.45);                     // you can't walk in under the top of the stairs
  put(sign('CELLS UPSTAIRS', null, NAVY, '#f2f2ee', 512, 96), 0.03, 0.4, 2.2, 7.06, 2.3, 1.2);

  // --- Downstairs: the lobby, the front desk and the offices ---
  for (const [lx, lz] of [[-4.5, 3.5], [3, 3.5], [-4.5, -3], [3, -3]]) put(m.light, 1.4, 0.04, 0.24, lx, ROOM - 0.03, lz);
  const lobbyGlow = new THREE.PointLight(0xf4f8ff, 26, 17, 1.5);
  lobbyGlow.position.set(-1, SLAB + ROOM - 0.7, 0.5);
  station.add(lobbyGlow);
  put(m.navy, W - 0.4, 0.2, 0.05, 0, 1.0, -fz + 0.13);
  put(m.navy, 0.05, 0.2, D - 0.4, -W / 2 + 0.23, 1.0, 0);

  solid(-2.5, 1.2, 6, 0.8, SLAB + 1.15);                                       // the front desk
  put(m.wood, 6, 1.1, 0.7, -2.5, 0.55, 1.2);
  put(m.navy, 6.06, 0.06, 0.8, -2.5, 1.13, 1.2);
  put(m.navy, 6, 0.5, 0.02, -2.5, 0.6, 1.56);
  put(sign('POLICE', null, '#6b4a30', '#f2f2ee', 256, 64), 1.6, 0.36, 0.025, -2.5, 0.6, 1.575);
  put(sign('FRONT DESK', 'REPORT A CRIME HERE', NAVY, '#f2f2ee', 512, 128), 3.0, 0.7, 0.05, -2.5, ROOM - 0.55, 1.2);
  put(m.dark, 0.5, 0.36, 0.05, -3.9, 1.34, 1.1);
  put(m.screen, 0.44, 0.3, 0.01, -3.9, 1.34, 1.07);
  put(m.dark, 0.2, 0.06, 0.26, -1.0, 1.19, 1.2);
  put(m.white, 0.3, 0.02, 0.4, -2.0, 1.17, 1.25);
  thing(m.wood, 0.5, 0.45, 2.6, -8.3, 4.2);                                    // waiting bench
  put(m.wood, 0.08, 0.5, 2.6, -8.52, 0.7, 4.2);
  for (let i = 0; i < 3; i++) put(sign('WANTED', i === 1 ? 'G$ 500 REWARD' : 'CALL 911', '#f2ecd8', '#1b1c1e', 128, 160), 0.02, 0.62, 0.5, -W / 2 + 0.22, 1.9, 3.5 + i * 0.65);
  for (const dx of [-6.6, -3.9, -1.2, 1.5, 4.2]) {                             // the detectives' desks
    solid(dx, -3.2, 1.5, 0.8, SLAB + 0.78);
    put(m.wood, 1.5, 0.06, 0.8, dx, 0.75, -3.2);
    put(m.cabinet, 0.5, 0.72, 0.7, dx + 0.45, 0.36, -3.2);
    put(m.steel, 0.06, 0.72, 0.06, dx - 0.65, 0.36, -2.9);
    put(m.steel, 0.06, 0.72, 0.06, dx - 0.65, 0.36, -3.5);
    put(m.dark, 0.5, 0.36, 0.05, dx, 1.02, -3.4);
    put(m.screen, 0.44, 0.3, 0.01, dx, 1.02, -3.37);
    put(m.dark, 0.4, 0.02, 0.14, dx, 0.79, -3.05);
    put(m.dark, 0.5, 0.08, 0.5, dx, 0.46, -2.4);
    put(m.dark, 0.5, 0.55, 0.07, dx, 0.78, -2.17);
    put(m.steel, 0.07, 0.42, 0.07, dx, 0.21, -2.4);
  }
  solid(-2.4, -5.95, 11, 0.6, SLAB + 1.5);                                     // filing cabinets along the back wall
  for (let i = 0; i < 11; i++) {
    put(m.cabinet, 0.9, 1.4, 0.55, -7.4 + i * 1.0, 0.7, -5.95);
    for (let drawer = 0; drawer < 3; drawer++) put(m.steel, 0.3, 0.03, 0.02, -7.4 + i * 1.0, 0.3 + drawer * 0.45, -5.67);
  }
  solid(-8.45, -0.4, 0.5, 2.4, SLAB + 1.9);                                    // lockers
  for (let i = 0; i < 4; i++) put(i % 2 ? m.navy : m.cabinet, 0.5, 1.85, 0.56, -8.45, 0.925, -1.3 + i * 0.6);
  put(sign('MIAMI', 'PATROL MAP', '#e9e4d2', NAVY, 256, 192), 1.6, 1.1, 0.03, 4.5, 1.9, -fz + 0.13);

  // --- Upstairs: the cell block. Four barred cells along the back, and the guard's desk in front ---
  for (const [lx, lz] of [[-5, 2], [1.5, 2], [-5, -4], [1.5, -4]]) up(m.light, 1.4, 0.04, 0.24, lx, ROOM - 0.03, lz);
  up(m.white, 16.2, 0.03, D - 0.4, -0.9, ROOM - 0.01, 0);                      // ceiling
  up(m.white, 1.7, 0.03, D - 0.4, 8.0, ROOM - 0.01, 0);
  const cellGlow = new THREE.PointLight(0xf4f8ff, 26, 17, 1.5);
  cellGlow.position.set(-1.5, TOP - 0.7, 0);
  station.add(cellGlow);

  const CELL_W = 3.45, BARS_Z = -2.0, cellDepth = fz - 0.1 + BARS_Z;           // how far back the cells go
  const cellMidZ = BARS_Z - cellDepth / 2;
  for (let wallNumber = 1; wallNumber <= 4; wallNumber++) {                    // the walls between the cells, and the end wall
    const wx = -W / 2 + 0.2 + wallNumber * CELL_W;
    up(m.wall, 0.15, ROOM, cellDepth, wx, ROOM / 2, cellMidZ);
    upSolid(wx, cellMidZ, 0.15, cellDepth, ROOM);
  }
  const barsLength = 4 * CELL_W, barsMid = -W / 2 + 0.2 + barsLength / 2;
  upSolid(barsMid, BARS_Z, barsLength, 0.12, ROOM);
  for (const y of [0.08, 1.3, ROOM - 0.3]) up(m.steel, barsLength, 0.07, 0.07, barsMid, y, BARS_Z);
  const barCount = Math.floor(barsLength / 0.19);
  const bars = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.02, 0.02, ROOM - 0.3, 6), m.steel, barCount);
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < barCount; i++) bars.setMatrixAt(i, matrix.makeTranslation(-W / 2 + 0.3 + i * 0.19, F2 + (ROOM - 0.3) / 2, BARS_Z));
  station.add(bars);
  const cellX = (cell) => -W / 2 + 0.2 + (cell + 0.5) * CELL_W;
  for (let cell = 0; cell < 4; cell++) {
    const cx = cellX(cell);
    up(m.dark, 0.14, 0.2, 0.06, cx + 1.0, 1.25, BARS_Z + 0.04);                // the lock
    up(m.steel, 0.85, 0.08, 1.9, cx - 1.1, 0.45, -5.2);                        // bunk
    up(m.mattress, 0.8, 0.1, 1.85, cx - 1.1, 0.54, -5.2);
    up(m.white, 0.5, 0.08, 0.3, cx - 1.1, 0.62, -5.9);
    up(m.steel, 0.4, 0.4, 0.45, cx + 1.1, 0.2, -5.8);                          // steel toilet
    up(m.steel, 0.4, 0.5, 0.12, cx + 1.1, 0.55, -6.0);
    up(sign(`CELL ${cell + 1}`, null, NAVY, '#f2f2ee', 256, 96), 1.0, 0.36, 0.04, cx, ROOM - 0.55, BARS_Z + 0.1);
  }
  upSolid(-3.0, 3.4, 2.4, 0.9, 0.8);                                           // the guard's desk, facing the cells
  up(m.wood, 2.4, 0.06, 0.9, -3.0, 0.76, 3.4);
  up(m.cabinet, 0.6, 0.72, 0.8, -2.2, 0.36, 3.4);
  up(m.steel, 0.06, 0.72, 0.06, -4.1, 0.36, 3.1);
  up(m.steel, 0.06, 0.72, 0.06, -4.1, 0.36, 3.7);
  up(m.dark, 0.5, 0.36, 0.05, -3.3, 1.02, 3.6);
  up(m.screen, 0.44, 0.3, 0.01, -3.3, 1.02, 3.57);
  up(sign('CELL BLOCK', 'NO WEAPONS BEYOND THIS POINT', NAVY, '#f2f2ee', 512, 128), 0.03, 0.6, 2.4, -W / 2 + 0.22, 2.2, 2.5);
  upThing(m.wood, 2.6, 0.45, 0.5, 3.0, 5.6);                                   // a bench under the windows
  upThing(m.white, 0.4, 1.1, 0.4, 6.4, 5.6);                                   // water cooler
  up(new THREE.MeshStandardMaterial({ color: 0x7fc4e8, roughness: 0.1, transparent: true, opacity: 0.7 }), 0.3, 0.4, 0.3, 6.4, 1.3, 5.6);

  scene.add(station);

  // Outside walls, both storeys (the doorway is left open).
  solid(0, -fz, W, 0.2, TOP + 1);
  solid(-W / 2 + 0.1, 0, 0.2, D, TOP + 1);
  solid(W / 2 - 0.1, 0, 0.2, D, TOP + 1);
  solid(-5.5, fz, 7, 0.2, TOP + 1);
  solid(5.5, fz, 7, 0.2, TOP + 1);
  solid(0, fz, 4.2, 0.2, TOP + 1, SLAB + 2.5);                                 // the wall above the doorway
  addFloor(x - W / 2 - 0.2, x + W / 2 + 0.2, z - D / 2 - 0.2, z + D / 2 + 0.2, SLAB);
  addInterior(x - W / 2 + 0.2, x + 7.1, z - D / 2 + 0.2, z + D / 2 - 0.2, SLAB + ROOM);
  addInterior(x - W / 2 + 0.2, x + W / 2 - 0.2, z - D / 2 + 0.2, z + D / 2 - 0.2, TOP, F2);
  clearings[45].set(x - W / 2 - 2.2, z - D / 2 - 0.3, x + W / 2 + 2.2, streetEndZ + 0.1);

  station.userData = {
    cars, doors, open: 0,
    doorSpot: new THREE.Vector3(x, 0, z + fz),
    officer: { x: x - 2.5, z: z + 0.45, facing: 0, uniform: true },                 // the desk officer downstairs
    guard: { x: x - 3.0, y: F2, z: z + 4.3, facing: Math.PI, uniform: true },       // the guard upstairs, watching the cells
    // Prisoners in orange, in the first three cells. The fourth is kept free for you.
    prisoners: [0, 1, 2].map((cell) => ({ x: x + cellX(cell) + (cell - 1) * 0.5, y: F2, z: z + BARS_Z - 1.1 - cell * 0.5, facing: 0, prisoner: true })),
    posts: [{ x: x - 2.0, z: z + D / 2 + 2.6, facing: 0 }, { x: x + 2.0, z: z + D / 2 + 2.6, facing: 0 }],
    cell: new THREE.Vector3(x + cellX(3), F2, z + BARS_Z - 1.4),
    release: new THREE.Vector3(x, 0, z + D / 2 + 4.5),
    upstairs: F2,
  };
  return station;
}
