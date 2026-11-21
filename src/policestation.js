// The police station: a brick building with a blue band and a flag outside, two
// patrol cars parked in front, and inside a lobby with a front desk, an office
// with desks and filing cabinets, and two holding cells with barred fronts.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { addObstacle, addFloor, addInterior } from './world.js';
import { clearings } from './grass.js';
import { block, canvasTexture, speckle } from './house.js';
import { label } from './store.js';

const SLAB = 0.3, HEIGHT = 3.4; // it stands a step higher than the shops
const W = 16, D = 12;
const NAVY = '#1c2f52';

// A parked patrol car: a black-and-white saloon with a light bar, push bar,
// spotlight and markings. Faces +Z.
function makePatrolCar() {
  const car = new THREE.Group();
  const paint = (color, roughness = 0.3, metalness = 0.3) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const white = paint(0xf4f4f0), black = paint(0x111214), glass = paint(0x0d1318, 0.08, 0.6), tyre = paint(0x1b1b1c, 0.95, 0);
  const chrome = paint(0xc9ccd0, 0.2, 0.9), dark = paint(0x1b1c1e, 0.7, 0);
  const part = (material, w, h, d, x, y, z, round = 0.08, tiltX = 0) => {
    const mesh = new THREE.Mesh(round ? new RoundedBoxGeometry(w, h, d, 3, Math.min(round, Math.min(w, h, d) * 0.45)) : new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.rotation.x = tiltX;
    mesh.castShadow = true;
    car.add(mesh);
    return mesh;
  };
  // Body: black at the front and back, white doors in the middle, in the classic pattern.
  part(black, 1.86, 0.5, 4.75, 0, 0.6, 0, 0.14);              // lower body
  part(black, 1.8, 0.2, 1.45, 0, 0.9, 1.6, 0.08);             // bonnet
  part(black, 1.8, 0.22, 1.05, 0, 0.9, -1.82, 0.08);          // boot
  part(white, 1.88, 0.46, 2.15, 0, 0.64, -0.15, 0.06);        // doors
  part(white, 1.62, 0.5, 2.2, 0, 1.2, -0.3, 0.16);            // cabin and roof
  // Windows: sloped windscreen and rear window, side glass with a pillar between the doors.
  part(glass, 1.5, 0.5, 0.06, 0, 1.17, 0.83, 0.02, -0.5);
  part(glass, 1.5, 0.46, 0.06, 0, 1.18, -1.4, 0.02, 0.55);
  for (const side of [-1, 1]) {
    part(glass, 0.03, 0.32, 0.86, side * 0.815, 1.22, 0.14, 0);
    part(glass, 0.03, 0.32, 0.8, side * 0.815, 1.22, -0.78, 0);
    part(black, 0.012, 0.44, 0.012, side * 0.945, 0.64, -0.3, 0);   // the gap between the doors
    part(chrome, 0.03, 0.03, 0.14, side * 0.95, 0.82, 0.05, 0);     // door handles
    part(chrome, 0.03, 0.03, 0.14, side * 0.95, 0.82, -0.85, 0);
    part(black, 0.14, 0.1, 0.16, side * 0.99, 1.02, 0.62, 0.04);    // wing mirrors
    part(chrome, 0.07, 0.07, 0.09, side * 0.86, 1.1, 0.7, 0.03);    // spotlight by the windscreen
    part(new THREE.MeshBasicMaterial({ color: 0xfff6d8 }), 0.34, 0.15, 0.05, side * 0.66, 0.74, 2.37, 0.03); // headlights
    part(new THREE.MeshBasicMaterial({ color: 0xc2231c }), 0.36, 0.13, 0.05, side * 0.66, 0.78, -2.37, 0.03); // tail lights
  }
  // Grille, bumpers, and the push bar on the nose.
  part(dark, 1.0, 0.2, 0.05, 0, 0.72, 2.37, 0.02);
  part(dark, 1.9, 0.18, 0.22, 0, 0.4, 2.33, 0.07);
  part(dark, 1.9, 0.18, 0.22, 0, 0.4, -2.33, 0.07);
  for (const side of [-0.32, 0.32]) part(dark, 0.07, 0.6, 0.07, side, 0.62, 2.52, 0.02);
  part(dark, 0.8, 0.07, 0.07, 0, 0.84, 2.52, 0.02);
  part(dark, 0.8, 0.07, 0.07, 0, 0.5, 2.52, 0.02);
  part(new THREE.MeshBasicMaterial({ color: 0xf2f0e6 }), 0.34, 0.16, 0.02, 0, 0.5, -2.45, 0); // number plate
  // Light bar: red on the driver's side, blue on the other, clear in the middle.
  part(dark, 1.3, 0.05, 0.34, 0, 1.47, -0.25, 0.02);
  part(new THREE.MeshBasicMaterial({ color: 0xe0241c }), 0.5, 0.12, 0.3, -0.38, 1.55, -0.25, 0.05);
  part(new THREE.MeshBasicMaterial({ color: 0x2456e0 }), 0.5, 0.12, 0.3, 0.38, 1.55, -0.25, 0.05);
  part(new THREE.MeshBasicMaterial({ color: 0xf4f4f0 }), 0.24, 0.11, 0.28, 0, 1.55, -0.25, 0.04);
  part(dark, 0.012, 0.5, 0.012, 0.5, 1.7, -1.25, 0);                                           // aerial
  // Markings: POLICE and the unit number on each door, and a blue stripe.
  const badge = new THREE.MeshBasicMaterial({ map: label('POLICE', 'PALM AVE P.D.  ·  UNIT 12', '#f4f4f0', NAVY, 512, 128) });
  for (const side of [-1, 1]) {
    part(badge, 0.012, 0.3, 1.2, side * 0.946, 0.68, -0.15, 0);
    part(new THREE.MeshBasicMaterial({ color: 0x1c2f52 }), 0.012, 0.045, 2.1, side * 0.946, 0.47, -0.15, 0);
  }
  part(new THREE.MeshBasicMaterial({ map: label('12', null, '#f4f4f0', NAVY, 128, 128) }), 0.6, 0.012, 0.6, 0, 1.456, -0.95, 0); // number on the roof
  // Wheels with steel hubs.
  for (const [wx, wz] of [[0.86, 1.5], [-0.86, 1.5], [0.86, -1.5], [-0.86, -1.5]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.26, 20), tyre);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.35, wz);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.27, 16), chrome);
    hub.rotation.z = Math.PI / 2;
    hub.position.copy(wheel.position);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.29, 12), dark);
    cap.rotation.z = Math.PI / 2;
    cap.position.copy(wheel.position);
    car.add(wheel, hub, cap);
    part(black, 0.3, 0.14, 0.9, wx, 0.72, wz, 0.07); // wheel arch
  }
  return car;
}
// Builds the station with its centre at (x, z). The front faces +Z, toward the road.
export function createPoliceStation(scene, x, z, roadEdgeZ) {
  const station = new THREE.Group();
  station.position.set(x, 0, z);
  const top = SLAB + HEIGHT;

  const plain = (color, roughness = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  const m = {
    brick: new THREE.MeshStandardMaterial({ roughness: 0.9, map: canvasTexture(64, (ctx, s) => {
      ctx.fillStyle = '#b9b0a2';
      ctx.fillRect(0, 0, s, s);
      for (let row = 0; row < 4; row++) for (let i = -1; i < 2; i++) {
        ctx.fillStyle = '#c9b48c';
        ctx.globalAlpha = 0.8 + Math.random() * 0.2;
        ctx.fillRect(i * 32 + (row % 2) * 16 + 1, row * 16 + 1, 30, 14);
      }
      ctx.globalAlpha = 1;
      speckle(ctx, s, 500, 0.06);
    }, 8, 5) }),
    concrete: new THREE.MeshStandardMaterial({ roughness: 1, map: canvasTexture(128, (ctx, s) => { ctx.fillStyle = '#b9b3a6'; ctx.fillRect(0, 0, s, s); speckle(ctx, s, 3000, 0.06); }, 4, 3) }),
    asphalt: new THREE.MeshStandardMaterial({ roughness: 0.95, map: canvasTexture(128, (ctx, s) => { ctx.fillStyle = '#4a4a48'; ctx.fillRect(0, 0, s, s); speckle(ctx, s, 4000, 0.07); }, 4, 2) }),
    lino: new THREE.MeshStandardMaterial({ roughness: 0.4, map: canvasTexture(64, (ctx, s) => { // speckled grey floor tiles
      ctx.fillStyle = '#c9cbc8';
      ctx.fillRect(0, 0, s, s);
      speckle(ctx, s, 600, 0.07);
      ctx.strokeStyle = 'rgba(80,85,90,0.5)';
      ctx.strokeRect(0, 0, s, s);
    }, 10, 8) }),
    paint: plain(0xdfe3e6, 0.95),
    navy: plain(0x1c2f52, 0.6),
    white: plain(0xf2f2ee, 0.6),
    wood: plain(0x6b4a30, 0.6),
    steel: plain(0x9ea3a7, 0.35, { metalness: 0.7 }),
    dark: plain(0x1b1c1e, 0.6),
    cabinet: plain(0x7f8a8c, 0.5, { metalness: 0.3 }),
    mattress: plain(0x8a9aa0, 1),
    glass: new THREE.MeshStandardMaterial({ color: 0xbfe0e6, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.22, depthWrite: false }),
    light: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    screen: new THREE.MeshBasicMaterial({ color: 0x3fa0e0 }),
    blueLamp: new THREE.MeshBasicMaterial({ color: 0x3f7fff }),
  };
  const sign = (text, small, background, ink, w = 512, h = 128) => new THREE.MeshBasicMaterial({ map: label(text, small, background, ink, w, h) });
  const put = (material, w, h, d, px, y, pz, parent = station) => block(parent, material, w, h, d, px, SLAB + y, pz);
  const solid = (lx, lz, w, d, height) => addObstacle(x + lx - w / 2, x + lx + w / 2, z + lz - d / 2, z + lz + d / 2, height);
  const thing = (material, w, h, d, px, pz) => { solid(px, pz, w, d, SLAB + h); return put(material, w, h, d, px, h / 2, pz); };

  // --- The building ---
  block(station, m.concrete, W + 0.4, SLAB, D + 0.4, 0, SLAB / 2, 0);
  put(m.lino, W - 0.4, 0.02, D - 0.4, 0, 0.01, 0).castShadow = false;
  put(m.brick, W, HEIGHT, 0.2, 0, HEIGHT / 2, -D / 2 + 0.1);
  put(m.brick, 0.2, HEIGHT, D, -W / 2 + 0.1, HEIGHT / 2, 0);
  put(m.brick, 0.2, HEIGHT, D, W / 2 - 0.1, HEIGHT / 2, 0);
  const fz = D / 2 - 0.1;
  for (const [px, w] of [[-7.2, 1.6], [-1.6, 1.2], [1.6, 1.2], [7.2, 1.6]]) put(m.brick, w, 2.5, 0.2, px, 1.25, fz);
  for (const px of [-4.3, 4.3]) {
    put(m.brick, 4.2, 0.9, 0.2, px, 0.45, fz);
    put(m.glass, 4.2, 1.6, 0.04, px, 1.7, fz);
    put(m.white, 4.2, 0.07, 0.24, px, 0.92, fz);
    for (const mx of [-1.05, 0, 1.05]) put(m.white, 0.06, 1.6, 0.08, px + mx, 1.7, fz);
  }
  put(m.brick, W, HEIGHT - 2.5, 0.2, 0, 2.5 + (HEIGHT - 2.5) / 2, fz);
  put(m.white, W + 0.5, 0.25, D + 0.5, 0, HEIGHT + 0.12, 0);                 // flat roof
  put(m.navy, W + 0.06, 0.5, 0.04, 0, HEIGHT - 0.3, D / 2 + 0.02);            // blue band along the front
  put(sign('POLICE', null, NAVY, '#f2f2ee', 512, 128), 3.4, 0.46, 0.05, 0, HEIGHT - 0.3, D / 2 + 0.05);
  put(sign('PALM AVENUE POLICE DEPARTMENT', 'TO PROTECT AND SERVE', NAVY, '#f2f2ee', 1024, 192), 7.6, 1.2, 0.14, 0, HEIGHT + 0.86, D / 2 - 0.1);
  for (const px of [-3, 3]) put(m.navy, 0.12, 0.5, 0.12, px, HEIGHT + 0.3, D / 2 - 0.2);
  for (const px of [-1.35, 1.35]) put(m.blueLamp, 0.2, 0.3, 0.2, px, 2.2, D / 2 + 0.12); // blue lamps either side of the door

  // Steps up to the door, and the glass doors that slide apart.
  block(station, m.concrete, 4.4, SLAB * 0.5, 1.4, 0, SLAB * 0.25, D / 2 + 0.9);
  addFloor(x - 2.2, x + 2.2, z + D / 2 + 0.2, z + D / 2 + 1.6, SLAB * 0.5);
  const doors = [-1, 1].map((side) => {
    const door = new THREE.Group();
    door.position.set(side * 0.5, 0, fz - 0.06);
    put(m.glass, 1.0, 2.45, 0.03, 0, 1.225, 0, door);
    for (const [w, h, px, y] of [[1.0, 0.07, 0, 2.43], [1.0, 0.1, 0, 0.05], [0.06, 2.45, -0.47, 1.225], [0.06, 2.45, 0.47, 1.225]]) put(m.steel, w, h, 0.05, px, y, 0, door);
    station.add(door);
    return { door, side };
  });

  // Car park in front with two patrol cars, a flagpole, and a path to the pavement.
  const gap = Math.abs(roadEdgeZ - (z + D / 2));
  block(station, m.asphalt, W + 4, 0.05, gap + 0.2, 0, 0.025, D / 2 + gap / 2).castShadow = false;
  block(station, m.concrete, 2.6, 0.06, gap - 1.4, 0, 0.03, D / 2 + 1.6 + (gap - 1.4) / 2).castShadow = false;
  for (const [cx, turn] of [[-5.6, 0.12], [5.4, -0.1]]) {
    const car = makePatrolCar();
    car.position.set(cx, 0.03, D / 2 + gap / 2 + 0.2);
    car.rotation.y = Math.PI + turn; // parked nose-in, facing the building
    station.add(car);
    solid(cx, D / 2 + gap / 2 + 0.2, 2.2, 4.8, 1.7);
    block(station, m.white, 0.1, 0.005, 5, cx - 1.5, 0.056, D / 2 + gap / 2 + 0.2).castShadow = false;
    block(station, m.white, 0.1, 0.005, 5, cx + 1.5, 0.056, D / 2 + gap / 2 + 0.2).castShadow = false;
  }
  solid(-8.6, D / 2 + 1.2, 0.2, 0.2, 8);
  block(station, m.steel, 0.1, 8, 0.1, -8.6, 4, D / 2 + 1.2);
  const flagPicture = canvasTexture(128, (ctx, s) => { // red and white stripes with a blue corner of stars
    for (let i = 0; i < 13; i++) { ctx.fillStyle = i % 2 ? '#f2f2ee' : '#b3261e'; ctx.fillRect(0, i * s / 13, s, s / 13 + 1); }
    ctx.fillStyle = NAVY;
    ctx.fillRect(0, 0, s * 0.42, s * 0.54);
    ctx.fillStyle = '#f2f2ee';
    for (let row = 0; row < 5; row++) for (let col = 0; col < 6; col++) ctx.fillRect(4 + col * 8.5 + (row % 2) * 4, 5 + row * 13, 2.5, 2.5);
  }, 1, 1);
  block(station, new THREE.MeshBasicMaterial({ map: flagPicture, side: THREE.DoubleSide }), 1.7, 1.0, 0.02, -7.7, 7.4, D / 2 + 1.2);

  // --- Inside ---
  put(m.paint, W - 0.4, HEIGHT, 0.04, 0, HEIGHT / 2, -D / 2 + 0.22);
  put(m.paint, 0.04, HEIGHT, D - 0.4, -W / 2 + 0.22, HEIGHT / 2, 0);
  put(m.paint, 0.04, HEIGHT, D - 0.4, W / 2 - 0.22, HEIGHT / 2, 0);
  put(m.navy, W - 0.4, 0.2, 0.05, 0, 1.0, -D / 2 + 0.23);                    // blue stripe round the walls
  put(m.navy, 0.05, 0.2, D - 0.4, -W / 2 + 0.23, 1.0, 0);
  put(m.navy, 0.05, 0.2, D - 0.4, W / 2 - 0.23, 1.0, 0);
  put(m.white, W - 0.4, 0.02, D - 0.4, 0, HEIGHT - 0.01, 0);
  for (const [lx, lz] of [[-3.5, 3], [3.5, 3], [-3.5, -2.5], [3.5, -2.5]]) put(m.light, 1.4, 0.04, 0.24, lx, HEIGHT - 0.04, lz);
  for (const lz of [3, -2.5]) {
    const glow = new THREE.PointLight(0xf4f8ff, 20, 14, 1.5);
    glow.position.set(0, top - 0.7, lz);
    station.add(glow);
  }

  // Lobby: the front desk with a sign above it, a waiting bench, a notice board and a plant.
  solid(-1.0, 1.0, 7, 0.8, SLAB + 1.15);
  put(m.wood, 7, 1.1, 0.7, -1.0, 0.55, 1.0);
  put(m.navy, 7.06, 0.06, 0.8, -1.0, 1.13, 1.0);
  put(m.navy, 7, 0.5, 0.02, -1.0, 0.6, 1.36);
  put(sign('POLICE', null, '#6b4a30', '#f2f2ee', 256, 64), 1.6, 0.36, 0.025, -1.0, 0.6, 1.375);
  put(sign('FRONT DESK', 'REPORT A CRIME HERE', NAVY, '#f2f2ee', 512, 128), 3.0, 0.7, 0.05, -1.0, HEIGHT - 0.6, 1.0);
  put(m.dark, 0.5, 0.36, 0.05, -2.2, 1.34, 0.9);                              // desk monitor
  put(m.screen, 0.44, 0.3, 0.01, -2.2, 1.34, 0.87);
  put(m.dark, 0.2, 0.06, 0.26, 0.6, 1.19, 1.0);                               // phone
  put(m.white, 0.3, 0.02, 0.4, -0.4, 1.17, 1.05);                             // paperwork
  thing(m.wood, 0.5, 0.45, 2.4, -7.3, 3.6);                                   // waiting bench
  put(m.wood, 0.08, 0.5, 2.4, -7.52, 0.7, 3.6);
  put(m.wood, 0.03, 1.1, 2.0, -W / 2 + 0.26, 1.9, 3.6);                       // notice board
  for (let i = 0; i < 3; i++) put(sign('WANTED', i === 1 ? 'G$ 500 REWARD' : 'CALL 911', '#f2ecd8', '#1b1c1e', 128, 160), 0.02, 0.62, 0.5, -W / 2 + 0.285, 1.9, 2.95 + i * 0.65);
  thing(plain(0xb8643c, 0.9), 0.5, 0.5, 0.5, 7.1, 5.0);
  const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), plain(0x4f7a35, 1));
  leaves.position.set(7.1, SLAB + 1.15, 5.0);
  leaves.scale.y = 1.3;
  station.add(leaves);

  // Office behind the desk: two desks with computers and chairs, filing cabinets and lockers.
  for (const dx of [3.6, 6.2]) {
    solid(dx, -3.2, 1.5, 0.8, SLAB + 0.78);
    put(m.wood, 1.5, 0.06, 0.8, dx, 0.75, -3.2);
    put(m.cabinet, 0.5, 0.72, 0.7, dx + 0.45, 0.36, -3.2);
    put(m.steel, 0.06, 0.72, 0.06, dx - 0.65, 0.36, -2.9);
    put(m.steel, 0.06, 0.72, 0.06, dx - 0.65, 0.36, -3.5);
    put(m.dark, 0.5, 0.36, 0.05, dx, 1.02, -3.4);
    put(m.screen, 0.44, 0.3, 0.01, dx, 1.02, -3.37);
    put(m.dark, 0.4, 0.02, 0.14, dx, 0.79, -3.05);                            // keyboard
    put(m.dark, 0.5, 0.08, 0.5, dx, 0.46, -2.4);                              // chair
    put(m.dark, 0.5, 0.55, 0.07, dx, 0.78, -2.17);
    put(m.steel, 0.07, 0.42, 0.07, dx, 0.21, -2.4);
  }
  solid(4.9, -5.45, 5, 0.6, SLAB + 1.5);
  for (let i = 0; i < 5; i++) {
    put(m.cabinet, 0.9, 1.4, 0.55, 2.9 + i * 1.0, 0.7, -5.45);
    for (let drawer = 0; drawer < 3; drawer++) put(m.steel, 0.3, 0.03, 0.02, 2.9 + i * 1.0, 0.3 + drawer * 0.45, -5.17);
  }
  solid(7.45, 0, 0.5, 2.4, SLAB + 1.9);
  for (let i = 0; i < 4; i++) put(i % 2 ? m.navy : m.cabinet, 0.5, 1.85, 0.56, 7.45, 0.925, -0.9 + i * 0.6); // lockers
  put(sign('PALM AVE', 'PATROL MAP', '#e9e4d2', NAVY, 256, 192), 0.03, 1.1, 1.5, W / 2 - 0.26, 1.9, -3.0);

  // Two holding cells in the back left corner: barred fronts, a bunk and a toilet in each.
  put(m.paint, 0.15, HEIGHT, 3.6, -2.0, HEIGHT / 2, -4.0);                    // end wall of the cells
  put(m.paint, 0.15, HEIGHT, 3.6, -4.9, HEIGHT / 2, -4.0);                    // wall between them
  solid(-2.0, -4.0, 0.15, 3.6, top);
  solid(-4.9, -4.0, 0.15, 3.6, top);
  solid(-4.9, -2.2, 5.9, 0.12, top);                                          // the bars
  put(m.steel, 5.9, 0.08, 0.08, -4.9, HEIGHT - 0.3, -2.2);
  put(m.steel, 5.9, 0.08, 0.08, -4.9, 0.08, -2.2);
  put(m.steel, 5.9, 0.06, 0.06, -4.9, 1.3, -2.2);
  for (let bx = -7.75; bx <= -2.05; bx += 0.19) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, HEIGHT - 0.3, 6), m.steel);
    bar.position.set(bx, SLAB + (HEIGHT - 0.3) / 2, -2.2);
    station.add(bar);
  }
  for (const cx of [-6.35, -3.45]) {
    put(m.dark, 0.14, 0.2, 0.06, cx + 1.0, 1.25, -2.16);                      // lock on the cell door
    put(m.steel, 0.85, 0.08, 1.9, cx - 0.7, 0.45, -4.6);                      // bunk
    put(m.mattress, 0.8, 0.1, 1.85, cx - 0.7, 0.54, -4.6);
    put(m.white, 0.5, 0.08, 0.3, cx - 0.7, 0.62, -5.3);                       // pillow
    put(m.steel, 0.4, 0.4, 0.45, cx + 0.9, 0.2, -5.4);                        // steel toilet
    put(m.steel, 0.4, 0.5, 0.12, cx + 0.9, 0.55, -5.6);
  }
  put(sign('HOLDING CELLS', null, NAVY, '#f2f2ee', 512, 96), 2.6, 0.45, 0.04, -4.9, HEIGHT - 0.75, -2.1);

  scene.add(station);

  solid(0, -D / 2 + 0.1, W, 0.2, top + 1);
  solid(-W / 2 + 0.1, 0, 0.2, D, top + 1);
  solid(W / 2 - 0.1, 0, 0.2, D, top + 1);
  solid(-4.5, fz, 7, 0.2, top + 1);
  solid(4.5, fz, 7, 0.2, top + 1);
  addFloor(x - W / 2 - 0.2, x + W / 2 + 0.2, z - D / 2 - 0.2, z + D / 2 + 0.2, SLAB);
  addInterior(x - W / 2 + 0.2, x + W / 2 - 0.2, z - D / 2 + 0.2, z + D / 2 - 0.2, top);
  clearings[40].set(x - W / 2 - 2.1, z - D / 2 - 0.3, x + W / 2 + 2.1, Math.max(roadEdgeZ, z + D / 2) + 0.1);

  station.userData = { doors, doorSpot: new THREE.Vector3(x, 0, z + fz), open: 0,
    officer: { x: x - 1.0, z: z + 0.25, facing: 0, uniform: true },   // the desk officer, behind the front desk
    // Two patrol officers stand guard outside, either side of the path to the door.
    posts: [{ x: x - 2.0, z: z + D / 2 + 2.6, facing: 0 }, { x: x + 2.0, z: z + D / 2 + 2.6, facing: 0 }],
    cell: new THREE.Vector3(x - 6.0, SLAB, z - 3.1),                   // where someone locked up stands
    release: new THREE.Vector3(x, 0, z + D / 2 + 4.5) };               // where they are let out
  return station;
}

// Each frame: the glass doors slide apart when the player is near.
export function updatePoliceStation(station, playerPosition, dt) {
  const state = station.userData;
  const near = Math.hypot(playerPosition.x - state.doorSpot.x, playerPosition.z - state.doorSpot.z) < 2.8;
  state.open += ((near ? 1 : 0) - state.open) * Math.min(1, 6 * dt);
  for (const { door, side } of state.doors) door.position.x = side * (0.5 + 0.95 * state.open);
}
