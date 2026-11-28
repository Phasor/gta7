// Miami Airport, on the grass behind the far-side towers. A road runs out to
// it from the main road. There is a terminal you can walk through, a control
// tower, a hangar, an apron and a 600-metre runway. Two planes on the apron can
// be flown: a propeller plane and a private jet. Airliners land and take off
// by themselves.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { addObstacle, addFloor, addInterior, addTerrain, pushOut, floorAt, waterDepthAt, sea, EAST_EDGE, bendInWind } from './world.js';
import { clearings, daylight } from './grass.js';
import { block, canvasTexture, speckle, makeMaterials, addPalm } from './house.js';
import { label } from './store.js';
import { addAtm } from './city.js';

const RUNWAY_Z = 175, RUNWAY_FROM = 200, RUNWAY_TO = 800, GROUND = 0.07;
const plain = (color, roughness = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
const sign = (text, small, background, ink, w = 512, h = 128) => new THREE.MeshBasicMaterial({ map: label(text, small, background, ink, w, h) });

// --- Building planes ---------------------------------------------------------------------------------
// Every plane faces +Z and stands on its wheels at height 0.

// The body: turned from an outline [distance along, radius], nose first, and painted with a
// stripe, a grey belly and a row of windows down each side.
function fuselage(outline, { stripe, windows, squash = 1 }) {
  const paint = document.createElement('canvas');
  paint.width = 256;
  paint.height = 512;
  const ctx = paint.getContext('2d');
  ctx.fillStyle = '#f4f4f0';
  ctx.fillRect(0, 0, 256, 512);
  ctx.fillStyle = '#b9bcc0';                                    // belly (the bottom is at both edges of the picture)
  ctx.fillRect(0, 0, 26, 512); ctx.fillRect(230, 0, 26, 512);
  ctx.fillStyle = stripe;
  for (const x of [52, 190]) ctx.fillRect(x, 0, 14, 512);       // a stripe along each side
  if (windows) {
    ctx.fillStyle = '#1b2a38';
    const [from, to, count] = windows;                           // as fractions of the length, tail to nose
    for (let i = 0; i < count; i++) for (const x of [76, 170]) ctx.fillRect(x, 512 - (from + (to - from) * i / (count - 1)) * 512 - 4, 10, 8);
  }
  const map = new THREE.CanvasTexture(paint);
  map.colorSpace = THREE.SRGBColorSpace;
  const geometry = new THREE.LatheGeometry(outline.map(([along, radius]) => new THREE.Vector2(radius, along)), 24);
  geometry.rotateX(Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map, roughness: 0.35, metalness: 0.25 }));
  mesh.scale.x = squash;
  mesh.castShadow = true;
  return mesh;
}
// A wing or tailplane, seen from above: points are [out along the span, forward]. It is made for one side and mirrored.
function wingPair(points, thickness, material) {
  const pair = new THREE.Group();
  for (const side of [-1, 1]) {
    const shape = new THREE.Shape(points.map(([span, forward]) => new THREE.Vector2(span * side, forward)));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelThickness: thickness * 0.4, bevelSize: thickness * 0.4, bevelSegments: 2 });
    geometry.rotateX(Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    pair.add(mesh);
  }
  return pair;
}
// The tail fin, seen from the side: points are [forward, up].
function fin(points, thickness, material) {
  const geometry = new THREE.ExtrudeGeometry(new THREE.Shape(points.map(([forward, up]) => new THREE.Vector2(forward, up))), { depth: thickness, bevelEnabled: false });
  geometry.rotateY(-Math.PI / 2);
  geometry.translate(thickness / 2, 0, 0);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  return mesh;
}
function wheelLeg(plane, x, z, height, size) {
  const steel = plain(0x9ea3a7, 0.4, { metalness: 0.7 }), rubber = plain(0x17181a, 0.95);
  const strut = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.16, size * 0.16, height, 8), steel);
  strut.position.set(x, height / 2 + size * 0.5, z);
  for (const side of size > 0.5 ? [-1, 1] : [0]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(size, size, size * 0.55, 16), rubber);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x + side * size * 0.45, size, z);
    plane.add(wheel);
  }
  plane.add(strut);
}
function jetEngine(plane, x, y, z, radius, length, colour) {
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.82, length, 18), plain(colour, 0.35, { metalness: 0.4 }));
  shell.rotation.x = Math.PI / 2;
  shell.position.set(x, y, z);
  shell.castShadow = true;
  const mouth = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.86, radius * 0.86, 0.06, 18), plain(0x17181a, 0.5));
  mouth.rotation.x = Math.PI / 2;
  mouth.position.set(x, y, z + length / 2 + 0.01);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.94, radius * 0.09, 8, 20), plain(0xc9ccd0, 0.2, { metalness: 0.9 }));
  lip.position.set(x, y, z + length / 2);
  plane.add(shell, mouth, lip);
}
const glass = () => plain(0x16222e, 0.08, { metalness: 0.7 });

// A four-seat propeller plane with the wing on top, held up by struts.
function makePropPlane(colour) {
  const plane = new THREE.Group(), white = plain(0xf4f4f0, 0.4), trim = plain(colour, 0.4);
  const body = fuselage([[3.6, 0], [3.5, 0.28], [3.0, 0.52], [1.6, 0.66], [0.2, 0.66], [-1.2, 0.5], [-3.0, 0.24], [-4.1, 0.1], [-4.2, 0]], { stripe: `#${new THREE.Color(colour).getHexString()}`, windows: null });
  body.position.y = 1.35;
  plane.add(body);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.5, 1.5), glass());                      // the cabin windows, all round
  screen.position.set(0, 1.86, 0.95);
  plane.add(screen);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 1.9), white);
  roof.position.set(0, 2.14, 0.8);
  plane.add(roof);
  const wing = wingPair([[0, 0.8], [5.4, 0.62], [5.4, -0.55], [0, -0.75]], 0.14, white);
  wing.position.set(0, 2.3, 0.75);
  plane.add(wing);
  for (const side of [-1, 1]) {                                                                       // struts from the body up to the wing
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.6, 0.14), white);
    strut.position.set(side * 1.25, 1.62, 0.85);
    strut.rotation.z = -side * 1.05;
    plane.add(strut);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 1.2), trim);                          // coloured wing tips
    tip.position.set(side * 5.2, 2.24, 0.78);
    plane.add(tip);
  }
  const tailplane = wingPair([[0, 0.5], [1.7, 0.3], [1.7, -0.35], [0, -0.45]], 0.09, white);
  tailplane.position.set(0, 1.5, -3.75);
  plane.add(tailplane);
  const tail = fin([[0.9, 0], [-0.55, 0], [-0.75, 1.55], [-0.2, 1.55]], 0.1, trim);
  tail.position.set(0, 1.5, -3.6);
  plane.add(tail);
  const prop = new THREE.Group();
  prop.position.set(0, 1.35, 3.68);
  prop.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.1, 0.05), plain(0x17181a, 0.5)));
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.4, 12), plain(0xc9ccd0, 0.2, { metalness: 0.9 }));
  spinner.rotation.x = Math.PI / 2;
  spinner.position.z = 0.12;
  prop.add(spinner);
  plane.add(prop);
  wheelLeg(plane, 0, 2.6, 0.5, 0.2);
  wheelLeg(plane, -1.1, 0.3, 0.5, 0.24);
  wheelLeg(plane, 1.1, 0.3, 0.5, 0.24);
  return { group: plane, props: [prop] };
}
// A small private jet: swept wings low on the body, two engines at the back, and a T-shaped tail.
function makeJet(colour) {
  const plane = new THREE.Group(), white = plain(0xf4f4f0, 0.3, { metalness: 0.3 }), trim = plain(colour, 0.35, { metalness: 0.3 });
  const body = fuselage([[7.2, 0], [6.9, 0.2], [6.0, 0.6], [4.6, 0.88], [-2.0, 0.88], [-4.6, 0.62], [-6.6, 0.26], [-7.2, 0.08], [-7.25, 0]], { stripe: `#${new THREE.Color(colour).getHexString()}`, windows: [0.42, 0.74, 6] });
  body.position.y = 1.75;
  plane.add(body);
  for (const side of [-1, 1]) {                                                                       // cockpit windows
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.34, 0.9), glass());
    pane.position.set(side * 0.62, 2.2, 5.5);
    pane.rotation.y = -side * 0.42;
    plane.add(pane);
  }
  const front = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.34, 0.06), glass());
  front.position.set(0, 2.25, 5.98);
  front.rotation.x = -0.9;
  plane.add(front);
  const wing = wingPair([[0, 1.6], [6.6, -1.6], [6.6, -2.4], [0, -1.3]], 0.16, white);
  wing.position.set(0, 1.35, 0.3);
  plane.add(wing);
  for (const side of [-1, 1]) {
    const winglet = fin([[0.4, 0], [-0.4, 0], [-0.7, 0.9], [-0.35, 0.9]], 0.06, trim);              // turned-up wing tips
    winglet.position.set(side * 6.6, 1.3, -1.7);
    plane.add(winglet);
    jetEngine(plane, side * 1.45, 2.3, -3.6, 0.42, 2.2, 0xf4f4f0);
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 1.2), white);
    pylon.position.set(side * 1.0, 2.25, -3.6);
    plane.add(pylon);
  }
  const tail = fin([[1.6, 0], [-0.9, 0], [-2.1, 2.5], [-0.9, 2.5]], 0.14, trim);
  tail.position.set(0, 2.2, -5.6);
  plane.add(tail);
  const tailplane = wingPair([[0, 0.7], [2.5, -0.5], [2.5, -1.1], [0, -0.6]], 0.1, white);
  tailplane.position.set(0, 4.72, -7.0);
  plane.add(tailplane);
  wheelLeg(plane, 0, 5.2, 0.6, 0.22);
  wheelLeg(plane, -1.5, -0.4, 0.6, 0.28);
  wheelLeg(plane, 1.5, -0.4, 0.6, 0.28);
  return { group: plane, props: [] };
}
// A twin-engined airliner, 36 metres long.
function makeAirliner(colour) {
  const plane = new THREE.Group(), white = plain(0xf4f4f0, 0.35, { metalness: 0.2 }), trim = plain(colour, 0.4);
  const body = fuselage([[18, 0], [17.6, 0.5], [16.4, 1.3], [14, 1.9], [-8, 1.9], [-13, 1.4], [-17, 0.6], [-18, 0.2], [-18.1, 0]], { stripe: `#${new THREE.Color(colour).getHexString()}`, windows: [0.2, 0.86, 34] });
  body.position.y = 3.6;
  plane.add(body);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.6, 0.1), glass());
  screen.position.set(0, 4.5, 16.0);
  screen.rotation.x = -0.75;
  plane.add(screen);
  const wing = wingPair([[0, 4.2], [16, -4.6], [16, -6.2], [5, -3.0], [0, -3.2]], 0.4, white);
  wing.position.set(0, 3.0, 1.5);
  plane.add(wing);
  for (const side of [-1, 1]) {
    jetEngine(plane, side * 5.4, 1.9, 2.2, 1.0, 3.6, 0xdfe2e4);
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.9, 2.4), white);
    pylon.position.set(side * 5.4, 2.7, 1.6);
    plane.add(pylon);
    const winglet = fin([[0.6, 0], [-0.7, 0], [-1.4, 1.9], [-0.8, 1.9]], 0.12, trim);
    winglet.position.set(side * 16, 2.9, -3.9);
    plane.add(winglet);
    wheelLeg(plane, side * 2.6, -1.0, 1.1, 0.55);
  }
  wheelLeg(plane, 0, 13.5, 1.1, 0.45);
  const tail = fin([[4.2, 0], [-1.4, 0], [-4.4, 6.4], [-2.2, 6.4]], 0.3, trim);
  tail.position.set(0, 4.9, -13.5);
  plane.add(tail);
  const tailplane = wingPair([[0, 1.8], [5.6, -1.6], [5.6, -2.8], [0, -1.6]], 0.24, white);
  tailplane.position.set(0, 4.4, -15.2);
  plane.add(tailplane);
  return plane;
}

// --- Jamaica's outline ---
// The island is centred on (JX, JZ) and is 2 x JS metres long. COAST is its shoreline, going round.
const JX = 3000, JZ = -100, JS = 420;
const COAST = [[-1.0, 0.05], [-0.93, -0.12], [-0.8, -0.24], [-0.6, -0.3], [-0.3, -0.33], [0, -0.3], [0.3, -0.27], [0.6, -0.2], [0.85, -0.1], [1.0, 0.02],
  [0.88, 0.15], [0.62, 0.18], [0.45, 0.25], [0.27, 0.2], [0.1, 0.31], [-0.1, 0.24], [-0.35, 0.2], [-0.55, 0.29], [-0.75, 0.22], [-0.9, 0.15]].map(([x, z]) => [x * JS, z * JS]);
// Is this spot (measured from the middle of the island) on land?
// (The shoreline smoothed into a curve: this is the exact edge of the sand that is drawn.)
const SHORE = new THREE.SplineCurve(COAST.concat([COAST[0]]).map(([x, z]) => new THREE.Vector2(x, z))).getPoints(170).map((point) => [point.x, point.y]);
function onLand(x, z) {
  if (Math.abs(x) > JS * 1.06 || Math.abs(z) > 165) return false;
  let within = false;
  for (let i = 0, j = SHORE.length - 1; i < SHORE.length; j = i++) {
    const [xi, zi] = SHORE[i], [xj, zj] = SHORE[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) within = !within;
  }
  return within;
}
// Flat ground, kept clear of hills and jungle: the airstrip and its houses, the town, the bar, and his hut. [west, east, north, south]
const ZONES = [[-315, -45, -62, 14], [-197, -83, 11, 77], [-68, -2, 39, 51], [-66, -54, 2, 51], [-4, 262, 20, 98], [-322, -278, 54, 88], [-268, -236, 62, 98]];
// The Blue Mountains and the hills west of them: [x, z, how far each spreads, how high].
const PEAKS = [[300, -8, 92, 62], [256, 10, 72, 40], [348, 4, 56, 34], [206, -28, 66, 30], [150, -66, 60, 24], [62, -78, 56, 17], [-30, -84, 50, 13], [-130, -96, 44, 9], [-60, 70, 46, 10], [-190, 60, 40, 8]];
const ease = (from, to, t) => { const u = Math.min(1, Math.max(0, (t - from) / (to - from))); return u * u * (3 - 2 * u); };
// How high the ground stands above the level of the town, at a spot measured from the middle of the island.
function hillHeight(x, z) {
  let height = 0;
  for (const [px, pz, spread, tall] of PEAKS) {
    const t = Math.hypot(x - px, z - pz) / spread;
    if (t < 1) height += tall * (1 - t * t) ** 2;
  }
  // Ridges and gullies down the mountainsides, and gently rolling ground everywhere else.
  height += Math.sin(x * 0.09 + Math.sin(z * 0.05) * 2) * Math.cos(z * 0.11 + Math.sin(x * 0.04) * 2) * Math.min(4.5, height * 0.14);
  height += (Math.sin(x * 0.045 + 1) * Math.cos(z * 0.06) + 1) * 1.1 + (Math.sin(x * 0.13) * Math.sin(z * 0.17) + 1) * 0.35;
  // ...but level round the buildings, and sinking to nothing toward the beach.
  let level = 1;
  for (const [x0, x1, z0, z1] of ZONES) level = Math.min(level, ease(1, 20, Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1))));
  let shore = 0;
  for (const scale of [0.96, 0.91, 0.86, 0.8]) if (onLand(x / scale, z / scale)) shore += 0.25;
  return Math.max(0, height * level * shore);
}
// Is this place on the map on Jamaica, and not too near the water's edge?
export function onJamaica(x, z, shrink = 0.86) {
  return onLand((x - JX) / shrink, (z - JZ) / shrink);
}

// --- The airport ------------------------------------------------------------------------------------
export function createAirport(scene) {
  const flat = (material, w, d, x, z, y = GROUND) => { const mesh = block(scene, material, w, 0.03, d, x, y, z); mesh.castShadow = false; return mesh; };
  const asphalt = new THREE.MeshStandardMaterial({ roughness: 0.95, map: canvasTexture(128, (ctx, s) => { ctx.fillStyle = '#3f4042'; ctx.fillRect(0, 0, s, s); speckle(ctx, s, 5000, 0.07); }, 60, 4) });
  const concrete = new THREE.MeshStandardMaterial({ roughness: 1, map: canvasTexture(128, (ctx, s) => { ctx.fillStyle = '#b3aea2'; ctx.fillRect(0, 0, s, s); speckle(ctx, s, 3000, 0.05); ctx.strokeStyle = 'rgba(70,65,55,0.45)'; ctx.strokeRect(0, 0, s, s); }, 30, 8) });
  const white = plain(0xeeeae0, 0.7), yellow = plain(0xe3b21e, 0.7), wall = plain(0xe9edf0, 0.85), blue = plain(0x1f5fa8, 0.5), dark = plain(0x1b1c1e, 0.6), steel = plain(0x8f9396, 0.4, { metalness: 0.6 });
  const windowGlass = new THREE.MeshStandardMaterial({ color: 0x9fd0e6, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.3, depthWrite: false });

  // Mown grass over the whole field, the runway, the apron, and the taxiway joining them.
  flat(plain(0x7a9a52, 1), 600, 108, 500, 138, 0.025);
  flat(asphalt, RUNWAY_TO - RUNWAY_FROM, 30, 500, RUNWAY_Z, 0.05);
  flat(concrete, 200, 46, 460, 127, 0.045);
  flat(concrete, 60, 12, 450, 155, 0.045);
  addFloor(200, 800, 84, 192, GROUND);
  clearings[46].set(199, 83, 801, 193);
  // Runway markings: a dashed centre line, edge lines, the stripes at each end, and its numbers.
  const dashes = new THREE.InstancedMesh(new THREE.BoxGeometry(14, 0.01, 0.6), white, 20);
  const lamps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.25, 0.3), new THREE.MeshBasicMaterial({ color: 0xfff3a0 }), 62);
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < 20; i++) dashes.setMatrixAt(i, matrix.makeTranslation(232 + i * 28, GROUND + 0.012, RUNWAY_Z));
  for (let i = 0; i < 31; i++) for (const side of [-1, 1]) lamps.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), matrix.makeTranslation(RUNWAY_FROM + i * 20, GROUND + 0.12, RUNWAY_Z + side * 15.6));
  scene.add(dashes, lamps);
  for (const side of [-1, 1]) flat(white, RUNWAY_TO - RUNWAY_FROM, 0.4, 500, RUNWAY_Z + side * 14, GROUND + 0.006);
  for (const [x, text, turn] of [[RUNWAY_FROM + 8, '09', -Math.PI / 2], [RUNWAY_TO - 8, '27', Math.PI / 2]]) {
    for (let stripe = 0; stripe < 8; stripe++) flat(white, 12, 1.6, x, RUNWAY_Z - 11.6 + stripe * 3.3, GROUND + 0.006);
    const number = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: label(text, null, '#3f4042', '#eeeae0', 128, 128) }));
    number.rotation.set(-Math.PI / 2, 0, turn);
    number.position.set(x + (x < 500 ? 16 : -16), GROUND + 0.022, RUNWAY_Z);
    scene.add(number);
  }
  flat(yellow, 0.3, 26, 450, 150, GROUND + 0.004);                                                    // the yellow taxi line out to the runway

  // The road out from the main road, between Horizon Tower and Seabreeze Condos.
  flat(asphalt, 7, 88, 416, 44, 0.055).material = plain(0x464648, 0.95);
  for (let z = 6; z < 84; z += 9) flat(yellow, 0.14, 3.2, 416, z, 0.075);
  clearings[47].set(411.5, 45, 420.5, 85);
  for (const side of [-1, 1]) { block(scene, steel, 0.25, 4.6, 0.25, 416 + side * 6.5, 2.3, 56); addObstacle(416 + side * 6.5 - 0.2, 416 + side * 6.5 + 0.2, 55.8, 56.2, 4.6); }
  block(scene, sign('MIAMI AIRPORT', 'DEPARTURES · FLYING CLUB', '#1f5fa8', '#ffffff', 1024, 192), 13.2, 1.9, 0.2, 416, 5.3, 56);

  // --- The terminal: a long glass-fronted hall you walk through from the road side to the apron ---
  const tx = 416, tz = 96, W = 36, D = 16, H = 5.2, SLAB = 0.15;
  const put = (material, w, h, d, px, y, pz) => block(scene, material, w, h, d, tx + px, SLAB + y, tz + pz);
  const solid = (px, pz, w, d, height) => addObstacle(tx + px - w / 2, tx + px + w / 2, tz + pz - d / 2, tz + pz + d / 2, height);
  block(scene, plain(0xb9b3a6, 1), W + 0.4, SLAB, D + 0.4, tx, SLAB / 2, tz);
  put(new THREE.MeshStandardMaterial({ roughness: 0.25, map: canvasTexture(64, (ctx, s) => { ctx.fillStyle = '#dfe2e0'; ctx.fillRect(0, 0, s, s); speckle(ctx, s, 400, 0.05); ctx.strokeStyle = 'rgba(90,95,100,0.5)'; ctx.strokeRect(0, 0, s, s); }, 18, 8) }), W - 0.4, 0.02, D - 0.4, 0, 0.01, 0).castShadow = false;
  for (const end of [-1, 1]) { put(wall, 0.3, H, D, end * (W / 2 - 0.15), H / 2, 0); solid(end * (W / 2 - 0.15), 0, 0.3, D, H + 1); }
  for (const face of [-1, 1]) {                                                                       // both long walls: glass above a low wall, with a doorway in the middle
    const z = face * (D / 2 - 0.15);
    for (const side of [-1, 1]) {
      put(wall, 15.7, 0.9, 0.3, side * 10.15, 0.45, z);
      put(windowGlass, 15.7, 2.6, 0.06, side * 10.15, 2.2, z);
      for (let post = 0; post < 5; post++) put(blue, 0.18, H, 0.34, side * (2.3 + post * 3.9), H / 2, z);
      solid(side * 10.15, z, 15.7, 0.3, H + 1);
    }
    put(wall, W, H - 3.5, 0.3, 0, 3.5 + (H - 3.5) / 2, z);
    put(sign(face < 0 ? 'DEPARTURES' : 'TO THE PLANES', null, '#1f5fa8', '#ffffff', 512, 96), 5, 0.8, 0.08, 0, 4.1, z + face * 0.2);
  }
  put(plain(0xf4f3ee, 0.6), W + 1.6, 0.3, D + 1.6, 0, H + 0.15, 0);
  put(sign('MIAMI AIRPORT', null, '#f4f3ee', '#1f5fa8', 1024, 128), 16, 1.8, 0.2, 0, H + 1.3, -D / 2 + 0.2);
  addFloor(tx - W / 2 - 0.2, tx + W / 2 + 0.2, tz - D / 2 - 0.2, tz + D / 2 + 0.2, SLAB);
  addInterior(tx - W / 2 + 0.3, tx + W / 2 - 0.3, tz - D / 2 + 0.3, tz + D / 2 - 0.3, SLAB + H);
  // Inside: check-in desks along one end, rows of seats, and the departures board.
  for (let desk = 0; desk < 4; desk++) {
    put(plain(0x2a3a52, 0.5), 2.2, 1.05, 0.8, -15 + desk * 2.9, 0.53, -1);
    put(blue, 2.26, 0.06, 0.86, -15 + desk * 2.9, 1.09, -1);
    put(dark, 0.4, 0.3, 0.06, -15 + desk * 2.9 - 0.5, 1.3, -1.2);
  }
  solid(-10.65, -1, 11, 0.8, 1.3);
  put(sign('CHECK-IN', 'FLYING CLUB DESK', '#1f5fa8', '#ffffff', 512, 128), 4.6, 1.0, 0.06, -10.65, 3.6, -1);
  for (let row = 0; row < 3; row++) {
    for (let seat = 0; seat < 6; seat++) { put(plain(0x3f6f9a, 0.7), 0.6, 0.1, 0.55, 6 + seat * 0.7, 0.45, -3.5 + row * 3.2); put(plain(0x3f6f9a, 0.7), 0.6, 0.55, 0.08, 6 + seat * 0.7, 0.75, -3.76 + row * 3.2); }
    put(steel, 4.2, 0.4, 0.08, 7.75, 0.2, -3.5 + row * 3.2);
    solid(7.75, -3.5 + row * 3.2, 4.3, 0.6, 1.0);
  }
  const board = document.createElement('canvas');
  board.width = 512;
  board.height = 256;
  const pen = board.getContext('2d');
  pen.fillStyle = '#0c0e12';
  pen.fillRect(0, 0, 512, 256);
  pen.font = 'bold 26px monospace';
  pen.fillStyle = '#ffd75a';
  pen.fillText('DEPARTURES', 16, 34);
  pen.font = '22px monospace';
  [['GA101', 'TAMPA', 'BOARDING'], ['GA215', 'NEW YORK', 'ON TIME'], ['GA330', 'HAVANA', 'DELAYED'], ['GA404', 'NOWHERE', 'CANCELLED'], ['CLUB', 'YOU FLY IT', 'ANY TIME']].forEach(([flight, to, state], i) => {
    pen.fillStyle = '#e6e8ea'; pen.fillText(flight, 16, 76 + i * 38); pen.fillText(to, 120, 76 + i * 38);
    pen.fillStyle = state === 'BOARDING' || state === 'ANY TIME' ? '#5fe07a' : state === 'ON TIME' ? '#e6e8ea' : '#ff6a5a'; pen.fillText(state, 330, 76 + i * 38);
  });
  const boardPicture = new THREE.CanvasTexture(board);
  boardPicture.colorSpace = THREE.SRGBColorSpace;
  put(new THREE.MeshBasicMaterial({ map: boardPicture }), 0.08, 2.4, 4.8, W / 2 - 0.36, 3.0, 0);
  for (const px of [-10, 0, 10]) put(new THREE.MeshBasicMaterial({ color: 0xffffff }), 3, 0.05, 0.4, px, H - 0.04, 0);
  const glow = new THREE.PointLight(0xf4f8ff, 30, 26, 1.4);
  glow.position.set(tx, SLAB + H - 0.8, tz);
  scene.add(glow);

  // The control tower: a concrete shaft with a glass room on top.
  const towerX = 372, towerZ = 112;
  block(scene, plain(0xd9d6cc, 0.9), 4.4, 20, 4.4, towerX, 10, towerZ);
  block(scene, wall, 7.6, 0.5, 7.6, towerX, 20.25, towerZ);
  block(scene, new THREE.MeshStandardMaterial({ color: 0x2f5a6e, roughness: 0.1, metalness: 0.6 }), 6.6, 2.8, 6.6, towerX, 21.9, towerZ);
  block(scene, wall, 8, 0.4, 8, towerX, 23.5, towerZ);
  block(scene, steel, 0.12, 4, 0.12, towerX, 25.7, towerZ);
  block(scene, new THREE.MeshBasicMaterial({ color: 0xff3a2a }), 0.3, 0.3, 0.3, towerX, 27.8, towerZ);
  addObstacle(towerX - 2.2, towerX + 2.2, towerZ - 2.2, towerZ + 2.2, 24);

  // A hangar at the far end of the apron, open toward the runway, and a windsock.
  const hx = 535, hz = 120;
  const shed = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.2, map: canvasTexture(64, (ctx, s) => { ctx.fillStyle = '#aab0b4'; ctx.fillRect(0, 0, s, s); ctx.fillStyle = 'rgba(50,55,60,0.35)'; for (let i = 0; i < 8; i++) ctx.fillRect(i * 8, 0, 1, s); }, 8, 1) });
  block(scene, shed, 30, 9, 0.4, hx, 4.5, hz - 13);
  for (const side of [-1, 1]) { block(scene, shed, 0.4, 9, 26, hx + side * 15, 4.5, hz); addObstacle(hx + side * 15 - 0.2, hx + side * 15 + 0.2, hz - 13, hz + 13, 9.5); }
  addObstacle(hx - 15, hx + 15, hz - 13.2, hz - 12.8, 9.5);
  const roofArch = new THREE.Mesh(new THREE.CylinderGeometry(15.4, 15.4, 26.4, 24, 1, true, -Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ color: 0x9aa0a4, roughness: 0.7, metalness: 0.3, side: THREE.DoubleSide }));
  roofArch.rotation.x = Math.PI / 2;
  roofArch.scale.y = 1;
  roofArch.scale.x = 1;
  roofArch.position.set(hx, 9, hz);
  roofArch.scale.set(1, 1, 0.28);
  scene.add(roofArch);
  block(scene, sign('HANGAR 1', null, '#1f5fa8', '#ffffff', 512, 128), 8, 1.6, 0.2, hx, 10.5, hz + 13.2);
  block(scene, steel, 0.12, 6, 0.12, 300, 3, 152);
  const sock = new THREE.Mesh(new THREE.ConeGeometry(0.45, 2.4, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0xff7a1e, roughness: 0.8, side: THREE.DoubleSide }));
  sock.rotation.z = Math.PI / 2;
  sock.position.set(301.2, 5.8, 152);
  scene.add(sock);

  // An airliner parked at the terminal (scenery), and one that comes and goes by itself.
  const parked = makeAirliner(0xd9281e);
  parked.position.set(482, GROUND, 128);
  parked.rotation.y = Math.PI;
  scene.add(parked);
  addObstacle(480, 484, 110, 146, 6);
  addObstacle(466, 498, 124, 131, 4);
  const liner = makeAirliner(0x1f5fa8);
  liner.rotation.order = 'YXZ';
  liner.visible = false;
  scene.add(liner);

  // The two planes you can fly, parked on the apron pointing at the runway.
  const planes = [
    [makePropPlane(0xd9281e), 'propeller plane', 392, 126, { top: 62, takeoff: 25, turn: 0.85, climb: 0.3 }],
    [makeJet(0x1f5fa8), 'private jet', 428, 130, { top: 125, takeoff: 46, turn: 0.6, climb: 0.34 }],
  ].map(([model, name, x, z, flight]) => {
    model.group.rotation.order = 'YXZ';
    model.group.position.set(x, GROUND, z);
    scene.add(model.group);
    return { ...model, ...flight, name, plane: true, own: true, reach: 5.5, home: new THREE.Vector3(x, GROUND, z), heading: 0, speed: 0, steer: 0, throttle: 0, vy: 0, pitch: 0, roll: 0, engine: null, spinners: [], steerers: [] };
  });
  // The airliner that carries passengers who have bought a ticket.
  const shuttle = makeAirliner(0xe0a82a);
  shuttle.rotation.order = 'YXZ';
  shuttle.visible = false;
  scene.add(shuttle);

  // --- The places it flies to ---
  // A ticket hut: a counter under a thatched roof. Returns where the seller and the customer stand.
  const hut = (x, z, floor, title) => {
    const wood = plain(0x8a6240, 0.8), thatch = plain(0xc9a85a, 1);
    block(scene, wood, 2.6, 1.05, 0.7, x, floor + 0.53, z);
    block(scene, plain(0x1f5fa8, 0.5), 2.7, 0.06, 0.8, x, floor + 1.09, z);
    for (const [px, pz] of [[-1.5, -1.6], [1.5, -1.6], [-1.5, 0.5], [1.5, 0.5]]) block(scene, wood, 0.14, 2.7, 0.14, x + px, floor + 1.35, z + pz);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.9, 1.3, 4), thatch);
    roof.rotation.y = Math.PI / 4;
    roof.position.set(x, floor + 3.3, z - 0.55);
    roof.castShadow = true;
    scene.add(roof);
    block(scene, sign('TICKETS', title, '#1f5fa8', '#ffffff', 512, 160), 2.5, 0.75, 0.06, x, floor + 2.3, z + 0.56);
    addObstacle(x - 1.3, x + 1.3, z - 0.35, z + 0.35, floor + 1.2);
    return { seller: { x, z: z - 1.0, facing: 0, special: true, say: 'Press E for a ticket.' }, desk: { x, z: z + 1.2 } };
  };
  // Jamaica: far out to sea, well out of sight of the mainland. It is shaped like the real island:
  // long from west to east (840 metres), with the Blue Mountains at the east end, jungle in the
  // middle, beaches and palms all round, the airstrip in the north-west, a beach bar in the west,
  // and the town of Kingston on the south side.
  const kit = makeMaterials(), KEY = 0.68, kx = JX, kz = JZ, S = JS, inside = onLand;
  const slab = (scale, top, depth, material) => { // the island's outline, a little bigger or smaller, as a thick slab
    const outline = new THREE.Shape();
    outline.setFromPoints(SHORE.map(([x, z]) => new THREE.Vector2(x * scale, z * scale)));
    const geometry = new THREE.ExtrudeGeometry(outline, { depth, bevelEnabled: false });
    geometry.rotateX(Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(kx, top, kz);
    mesh.receiveShadow = true;
    scene.add(mesh);
  };
  const ground = (base, dots) => new THREE.MeshStandardMaterial({ roughness: 1, map: canvasTexture(128, (ctx, s) => { ctx.fillStyle = base; ctx.fillRect(0, 0, s, s); speckle(ctx, s, dots, 0.08); }, 0.14, 0.14) });
  slab(1.06, -0.5, 9, ground('#d9c690', 4000));                // sand shelving away under the water
  slab(1.0, 0.6, 10, ground('#f0deaa', 5000));                 // white beaches all the way round
  slab(0.93, KEY - 0.12, 0.3, ground('#3f7a34', 7000)); // (hidden under the sheet of ground made below)               // green inside
  // Dry land and shallows, for walking, wading and swimming. The beach is dry right out to its
  // edge; then there is a strip to wade through, then a lagoon to swim in, and the deep sea beyond.
  sea.lands.push((x, z) => {
    const lx = x - kx, lz = z - kz;
    if (Math.abs(lx) > S * 1.3 || Math.abs(lz) > 210) return undefined;
    if (onLand(lx, lz)) return 0;
    if (onLand(lx / 1.06, lz / 1.06)) return 0.55;
    if (onLand(lx / 1.24, lz / 1.24)) return 1.5;
    return undefined;
  });
  // The lagoon: clear turquoise water in a band round the whole island, fading out into the deep blue.
  {
    const points = [], shades = [], faces = [];
    SHORE.forEach(([x, z], i) => {
      points.push(kx + x * 0.995, 0.2, kz + z * 0.995, kx + x * 1.13, 0.2, kz + z * 1.13, kx + x * 1.3, 0.2, kz + z * 1.3);
      shades.push(0.45, 0.95, 0.86, 0.62, 0.2, 0.82, 0.8, 0.5, 0.1, 0.6, 0.72, 0);
      if (i) { const p = (i - 1) * 3; faces.push(p, p + 1, p + 3, p + 3, p + 1, p + 4, p + 1, p + 2, p + 4, p + 4, p + 2, p + 5); }
    });
    const ring = new THREE.BufferGeometry();
    ring.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    ring.setAttribute('color', new THREE.Float32BufferAttribute(shades, 4));
    ring.setIndex(faces);
    const lagoon = new THREE.Mesh(ring, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    lagoon.renderOrder = 3;                                                  // over the sea's own surface
    lagoon.onBeforeRender = () => lagoon.material.color.setScalar(0.2 + 0.8 * daylight.value); // (darker at night, like everything else)
    scene.add(lagoon);
  }
  // --- The land itself: the Blue Mountains, the hills, and the rolling ground under the jungle ---
  // One sheet of ground that follows hillHeight() (below, at the top of this file). You walk on it.
  {
    const STEP = 4, across = Math.round(2 * 432 / STEP) + 1, down = Math.round(2 * 148 / STEP) + 1;
    const spots = new Float32Array(across * down * 3), tints = new Float32Array(across * down * 3), looks = new Float32Array(across * down * 2), corners = [];
    const jungleGreen = new THREE.Color(0x3f7a34), deepGreen = new THREE.Color(0x2f5f3a), rock = new THREE.Color(0x7a7466), haze = new THREE.Color(0x8fa4a8), shade = new THREE.Color();
    for (let j = 0; j < down; j++) for (let i = 0; i < across; i++) {
      const x = -432 + i * STEP, z = -148 + j * STEP, h = hillHeight(x, z), n = (j * across + i) * 3;
      spots[n] = kx + x; const grassy = inside(x / 0.93, z / 0.93); spots[n + 1] = inside(x, z) ? KEY + h + 0.012 : -3; spots[n + 2] = kz + z; // (it lies just over the flat ground too, so the whole island is one green; off the edge it dips under the sand)
      const steep = Math.min(1, Math.hypot(hillHeight(x + 2, z) - h, hillHeight(x, z + 2) - h) / 2.2); // bare rock shows where it is steep
      shade.copy(jungleGreen).lerp(deepGreen, Math.min(1, h / 22)).lerp(rock, Math.max(0, steep - 0.8) * 1.2); // green all the way up; bare rock only on the very steepest faces
      shade.multiplyScalar(0.88 + 0.24 * Math.sin(x * 0.7 + z * 1.3) * Math.sin(x * 0.31 - z * 0.53));
      if (!grassy) shade.setRGB(1.19, 1.1, 0.85); // out on the beach it is sand, so the grass fades into it
      tints[n] = shade.r; tints[n + 1] = shade.g; tints[n + 2] = shade.b;
      looks[(j * across + i) * 2] = x / 7; looks[(j * across + i) * 2 + 1] = z / 7;
      if (i && j) { const a = (j - 1) * across + i - 1, b = a + 1, c = a + across, d = c + 1; corners.push(a, c, b, b, c, d); }
    }
    const land = new THREE.BufferGeometry();
    land.setAttribute('position', new THREE.BufferAttribute(spots, 3));
    land.setAttribute('color', new THREE.BufferAttribute(tints, 3));
    land.setAttribute('uv', new THREE.BufferAttribute(looks, 2));
    land.setIndex(corners);
    land.computeVertexNormals();
    const hills = new THREE.Mesh(land, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, map: canvasTexture(128, (ctx, s) => {
      ctx.fillStyle = '#c9c9c9'; ctx.fillRect(0, 0, s, s);
      speckle(ctx, s, 6000, 0.14);
      for (let i = 0; i < 60; i++) { ctx.fillStyle = `rgba(${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},0.07)`; ctx.beginPath(); ctx.ellipse(Math.random() * s, Math.random() * s, 4 + Math.random() * 9, 3 + Math.random() * 6, Math.random() * 3, 0, 7); ctx.fill(); }
    }, 1, 1) }));
    hills.receiveShadow = true;
    scene.add(hills);
    addTerrain((x, z) => (Math.abs(x - kx) < 432 && Math.abs(z - kz) < 148 && inside(x - kx, z - kz) ? KEY + hillHeight(x - kx, z - kz) : -Infinity)); // (only on the island itself, not the sea round it)
  }
  const cleared = (x, z) => ZONES.some(([x0, x1, z0, z1]) => x > x0 && x < x1 && z > z0 && z < z1);

  const junglePalms = [];
  // --- The jungle ---
  // Drawn from a handful of plants, each repeated hundreds of times in one go: tall rainforest trees
  // with a spreading leafy crown, banana plants, clumps of bamboo, and ferns covering the ground.
  {
    const rnd = (low, high) => low + Math.random() * (high - low);
    const picture = (w, h, draw) => { const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h; draw(canvas.getContext('2d'), w, h); const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture; };
    // Leaves, painted: a mass of overlapping leaves for the crowns...
    const canopyLeaves = picture(256, 256, (ctx, w) => {
      ctx.fillStyle = '#24481f'; ctx.fillRect(0, 0, w, w);
      for (let i = 0; i < 900; i++) {
        const light = Math.random();
        ctx.fillStyle = `rgb(${30 + light * 70},${70 + light * 110},${24 + light * 40})`;
        ctx.beginPath(); ctx.ellipse(Math.random() * w, Math.random() * w, 3 + Math.random() * 7, 1.5 + Math.random() * 3, Math.random() * 3.14, 0, 7); ctx.fill();
      }
    });
    canopyLeaves.wrapS = canopyLeaves.wrapT = THREE.RepeatWrapping;
    canopyLeaves.repeat.set(3, 2);
    // ...a fan of fern fronds, see-through between them...
    const fernLeaves = picture(256, 256, (ctx, w) => {
      for (let frond = 0; frond < 7; frond++) {
        const lean = (frond - 3) * 0.36, long = 190 + Math.random() * 50;
        ctx.save(); ctx.translate(w / 2, w - 4); ctx.rotate(lean);
        for (let k = 0; k < 26; k++) {
          const along = k / 26, y = -along * long, reach = (1 - along) * 34 + 5;
          ctx.strokeStyle = `rgb(${40 + along * 50},${110 + along * 70},${36 + along * 30})`; ctx.lineWidth = 4.2 - along * 2.2;
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(-reach, y - 9); ctx.moveTo(0, y); ctx.lineTo(reach, y - 9); ctx.stroke();
        }
        ctx.strokeStyle = '#3a5a22'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -long); ctx.stroke();
        ctx.restore();
      }
    });
    // ...and one great banana leaf, with its rib and veins.
    const bananaLeaf = picture(128, 512, (ctx, w, h) => {
      const blade = ctx.createLinearGradient(0, 0, w, 0);
      blade.addColorStop(0, '#3f8a2a'); blade.addColorStop(0.5, '#62b23a'); blade.addColorStop(1, '#3f8a2a');
      ctx.fillStyle = blade;
      ctx.beginPath(); ctx.moveTo(w / 2, 6); ctx.bezierCurveTo(w * 1.02, h * 0.2, w * 1.0, h * 0.8, w / 2, h - 4); ctx.bezierCurveTo(0, h * 0.8, -w * 0.02, h * 0.2, w / 2, 6); ctx.fill();
      ctx.strokeStyle = 'rgba(30,70,20,0.45)'; ctx.lineWidth = 1.2;
      for (let y = 20; y < h - 10; y += 9) { ctx.beginPath(); ctx.moveTo(w / 2, y); ctx.lineTo(4, y - 14); ctx.moveTo(w / 2, y); ctx.lineTo(w - 4, y - 14); ctx.stroke(); }
      ctx.strokeStyle = '#b9d98a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(w / 2, 4); ctx.lineTo(w / 2, h); ctx.stroke();
    });
    const cutOut = (map, extra = {}) => new THREE.MeshStandardMaterial({ map, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85, ...extra });

    // Where everything goes: anywhere on the island that is not beach, town, airstrip or bare mountain top.
    const scatter = (count, tries, ok) => {
      const found = [];
      for (let attempt = 0; attempt < tries && found.length < count; attempt++) {
        const x = rnd(-0.94, 0.94) * S, z = rnd(-135, 135);
        if (!inside(x / 0.9, z / 0.9) || cleared(x, z)) continue;
        const h = hillHeight(x, z);
        if (ok(h, x, z)) found.push([x, z, h]);
      }
      return found;
    };
    const at = new THREE.Matrix4(), turn = new THREE.Quaternion(), size = new THREE.Vector3(), where = new THREE.Vector3(), lean = new THREE.Euler(), tint = new THREE.Color();
    const stand = (mesh, i, x, y, z, sx, sy, sz, spin = 0, tiltX = 0, tiltZ = 0) => mesh.setMatrixAt(i, at.compose(where.set(kx + x, y, kz + z), turn.setFromEuler(lean.set(tiltX, spin, tiltZ)), size.set(sx, sy, sz)));

    // Rainforest trees: a tall trunk flaring at the foot, and a crown of three or four leafy masses.
    const trees = scatter(430, 9000, (h) => h < 44);
    const trunkShape = new THREE.CylinderGeometry(0.32, 0.5, 1, 8, 4);
    { const p = trunkShape.attributes.position; for (let i = 0; i < p.count; i++) { const low = Math.max(0, -p.getY(i) - 0.3) * 4; p.setX(i, p.getX(i) * (1 + low * 0.9)); p.setZ(i, p.getZ(i) * (1 + low * 0.9)); } } // buttress roots
    trunkShape.translate(0, 0.5, 0);
    const bark = new THREE.MeshStandardMaterial({ roughness: 0.95, map: canvasTexture(64, (ctx, s) => { ctx.fillStyle = '#5a4a3a'; ctx.fillRect(0, 0, s, s); for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(${i % 2 ? 20 : 150},${i % 2 ? 15 : 130},${i % 2 ? 10 : 100},0.25)`; ctx.fillRect(Math.random() * s, 0, 1 + Math.random() * 2, s); } ctx.fillStyle = 'rgba(70,110,50,0.3)'; for (let i = 0; i < 12; i++) ctx.fillRect(Math.random() * s, Math.random() * s, 6, 4); }, 2, 3) });
    const trunks = new THREE.InstancedMesh(trunkShape, bark, trees.length);
    let crownShape = new THREE.IcosahedronGeometry(1, 2);
    crownShape.deleteAttribute('normal');
    crownShape = mergeVertices(crownShape);
    { const p = crownShape.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), puff = 1 + 0.2 * Math.sin(x * 6.1 + y * 4.3) * Math.cos(z * 5.7 + x * 2.9) + 0.1 * Math.sin(y * 11 + z * 9); p.setXYZ(i, x * puff, y * puff * 0.62, z * puff); } }
    crownShape.computeVertexNormals();
    const crowns = new THREE.InstancedMesh(crownShape, new THREE.MeshStandardMaterial({ map: canopyLeaves, roughness: 0.9 }), trees.length * 4);
    trees.forEach(([x, z, h], i) => {
      // A rainforest tree, not an oak: a tall, straight, slender trunk with no low branches, and far
      // overhead a wide, flat umbrella of leaves in spreading layers.
      const tall = rnd(12, 20), thick = rnd(0.55, 0.95), y = KEY + h - 0.2;
      trees[i][3] = tall;
      stand(trunks, i, x, y, z, thick, tall, thick, rnd(0, 6));
      addObstacle(kx + x - 0.4 * thick, kx + x + 0.4 * thick, kz + z - 0.4 * thick, kz + z + 0.4 * thick, y + tall, y - 1);
      for (let part = 0; part < 4; part++) {
        const wide = part ? rnd(2.6, 4.2) : rnd(5, 7.5), off = part ? rnd(3, 5.5) : 0, angle = part * 2.1 + i;
        stand(crowns, i * 4 + part, x + Math.cos(angle) * off, y + tall + (part ? rnd(-2.4, -0.8) : 0.3), z + Math.sin(angle) * off, wide, wide * (part ? 0.42 : 0.36), wide, rnd(0, 6));
        crowns.setColorAt(i * 4 + part, tint.setHSL(rnd(0.26, 0.34), rnd(0.45, 0.65), rnd(0.42, 0.7)));
      }
    });
    trunks.castShadow = crowns.castShadow = true;
    scene.add(trunks, crowns);

    // Banana plants: a thick green stem and seven great arching leaves.
    const ribbon = (width, steps, path) => { // a strip following a path: [out, up] at each step
      const points = [], looks = [], faces = [];
      for (let k = 0; k <= steps; k++) { const [out, up] = path(k / steps), half = width * 0.5 * Math.sin(Math.PI * (0.12 + 0.88 * k / steps) * 0.98 + 0.05); points.push(-half, up, out, half, up, out); looks.push(0, k / steps, 1, k / steps); if (k) { const a = (k - 1) * 2; faces.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
      const strip = new THREE.BufferGeometry();
      strip.setAttribute('position', new THREE.Float32BufferAttribute(points, 3)); strip.setAttribute('uv', new THREE.Float32BufferAttribute(looks, 2)); strip.setIndex(faces); strip.computeVertexNormals();
      return strip;
    };
    const leafSet = mergeGeometries(Array.from({ length: 7 }, (_, n) => {
      const droop = 0.5 + (n % 3) * 0.25, leaf = ribbon(0.62, 6, (t) => [t * 1.9, 1.5 + Math.sin(t * Math.PI * 0.85) * (1.1 - droop * 0.4) - t * t * droop * 1.6]);
      leaf.rotateY(n * (Math.PI * 2 / 7) + (n % 2) * 0.2);
      return leaf;
    }));
    const bananas = scatter(190, 5000, (h) => h < 20);
    const bananaLeaves = new THREE.InstancedMesh(leafSet, cutOut(bananaLeaf), bananas.length);
    const bananaStems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.13, 1.7, 7).translate(0, 0.85, 0), new THREE.MeshStandardMaterial({ color: 0x7a9a4a, roughness: 0.8 }), bananas.length);
    bananas.forEach(([x, z, h], i) => { const big = rnd(0.8, 1.5), spin = rnd(0, 6); stand(bananaLeaves, i, x, KEY + h - 0.15, z, big, big, big, spin); stand(bananaStems, i, x, KEY + h - 0.15, z, big, big, big, spin); });
    bananaLeaves.castShadow = true;
    scene.add(bananaLeaves, bananaStems);

    // Bamboo: clumps of tall jointed canes, leaning outward, with a feathery top.
    const clump = mergeGeometries(Array.from({ length: 9 }, (_, n) => {
      const cane = new THREE.CylinderGeometry(0.035, 0.05, 6.5, 5).translate(0, 3.25, 0);
      cane.rotateZ(0.05 + (n % 4) * 0.045); cane.rotateY(n * 0.7); cane.translate(Math.cos(n * 0.7) * 0.28, 0, Math.sin(n * 0.7) * 0.28);
      return cane;
    }));
    const bamboos = scatter(70, 3000, (h) => h < 14);
    const canes = new THREE.InstancedMesh(clump, new THREE.MeshStandardMaterial({ roughness: 0.6, map: canvasTexture(32, (ctx, s) => { ctx.fillStyle = '#9ab04a'; ctx.fillRect(0, 0, s, s); ctx.fillStyle = '#5f7a2a'; for (let y = 0; y < s; y += 6) ctx.fillRect(0, y, s, 1.4); }, 1, 5) }), bamboos.length);
    const plumes = new THREE.InstancedMesh(new THREE.PlaneGeometry(2.6, 2.6).translate(0, 1.3, 0), cutOut(fernLeaves, { color: 0xb9d06a }), bamboos.length * 2);
    bamboos.forEach(([x, z, h], i) => { const big = rnd(0.8, 1.3), spin = rnd(0, 6); stand(canes, i, x, KEY + h - 0.1, z, big, big, big, spin); for (let k = 0; k < 2; k++) stand(plumes, i * 2 + k, x, KEY + h + 5.2 * big, z, big, big, big, spin + k * 1.57); });
    canes.castShadow = true;
    scene.add(canes, plumes);

    // Ferns and undergrowth, thick on the ground everywhere under the trees.
    const fan = mergeGeometries([0, 1, 2].map((k) => new THREE.PlaneGeometry(1.5, 1.3).translate(0, 0.62, 0).rotateY(k * Math.PI / 3)));
    const ferns = scatter(1500, 16000, (h) => h < 40);
    const undergrowth = new THREE.InstancedMesh(fan, cutOut(fernLeaves), ferns.length);
    ferns.forEach(([x, z, h], i) => { const big = rnd(0.7, 1.7); stand(undergrowth, i, x, KEY + h - 0.12, z, big, big * rnd(0.7, 1.2), big, rnd(0, 6)); undergrowth.setColorAt(i, tint.setHSL(rnd(0.24, 0.36), 0.5, rnd(0.55, 0.9))); });
    scene.add(undergrowth);
    // Coconut palms all through the forest: a leaning, ringed trunk, a burst of long fronds, and a cluster of nuts.
    const frondLeaf = picture(128, 512, (ctx, w, h) => {
      for (let y = 8; y < h - 6; y += 7) {
        const reach = (w / 2 - 4) * Math.sin(Math.PI * (0.1 + 0.9 * y / h)), light = 90 + (y % 21) * 3;
        ctx.strokeStyle = `rgb(${40 + light * 0.3},${light + 50},${34})`; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(w / 2, y); ctx.lineTo(w / 2 - reach, y - 22); ctx.moveTo(w / 2, y); ctx.lineTo(w / 2 + reach, y - 22); ctx.stroke();
      }
      ctx.strokeStyle = '#c9c070'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
    });
    const palmTrunk = new THREE.CylinderGeometry(0.11, 0.19, 8, 7, 8).translate(0, 4, 0);
    { const p = palmTrunk.attributes.position; for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + (p.getY(i) / 8) ** 2 * 1.3); } // it curves as it climbs
    palmTrunk.computeVertexNormals();
    const palmCrown = mergeGeometries(Array.from({ length: 11 }, (_, n) => {
      const sag = 1.6 + (n % 3) * 0.5, frond = ribbon(1.15, 7, (t) => [t * 3.4, Math.sin(t * Math.PI * 0.8) * 1.0 - t * t * sag]);
      return frond.rotateY(n * (Math.PI * 2 / 11)).translate(1.3, 8, 0);
    }));
    const nuts = mergeGeometries([0, 1, 2, 3].map((n) => new THREE.SphereGeometry(0.15, 7, 6).translate(1.3 + Math.cos(n * 1.6) * 0.2, 7.75, Math.sin(n * 1.6) * 0.2)));
    const palmSpots = scatter(170, 5000, (h) => h < 26);
    const palms = new THREE.InstancedMesh(mergeGeometries([palmTrunk, palmCrown, nuts], true), [
      new THREE.MeshStandardMaterial({ roughness: 0.9, map: canvasTexture(32, (ctx, s) => { ctx.fillStyle = '#8a7a62'; ctx.fillRect(0, 0, s, s); ctx.fillStyle = '#5c4f3e'; for (let y = 0; y < s; y += 4) ctx.fillRect(0, y, s, 1.3); }, 1, 6) }),
      cutOut(frondLeaf), new THREE.MeshStandardMaterial({ color: 0x5a4020, roughness: 0.8 })], palmSpots.length);
    for (const material of palms.material) bendInWind(material); // they lean over in a hurricane
    for (const [x, z] of palmSpots) junglePalms.push([kx + x, kz + z]);
    palmSpots.forEach(([x, z, h], i) => { const big = rnd(0.85, 1.6); stand(palms, i, x, KEY + h - 0.2, z, big, big, big, rnd(0, 6)); });
    palms.castShadow = true;
    scene.add(palms);
    palms.frustumCulled = false;
    for (const mesh of [trunks, crowns, bananaLeaves, bananaStems, canes, plumes, undergrowth]) mesh.frustumCulled = false; // (each is spread over the whole island)
  }
  // Palms along the beaches.
  COAST.forEach(([x, z], i) => {
    for (const along of [0, 0.5]) {
      const [nx, nz] = COAST[(i + 1) % COAST.length], px = (x + (nx - x) * along) * 0.95, pz = (z + (nz - z) * along) * 0.95, tall = 7 + (i * 7 + along * 5) % 4;
      addPalm(scene, kit, kx + px, kz + pz, tall + KEY, (i % 3) - 1);
      addObstacle(kx + px - 0.25, kx + px + 0.25, kz + pz - 0.25, kz + pz + 0.25, tall * 0.5);
    }
  });
  // The airstrip, in the north-west.
  const sx = -180, sz = -40;
  block(scene, plain(0x4a4a48, 0.95), 230, 0.03, 14, kx + sx, KEY + 0.02, kz + sz).castShadow = false;
  for (let i = 0; i < 11; i++) block(scene, white, 8, 0.01, 0.4, kx + sx - 100 + i * 20, KEY + 0.04, kz + sz).castShadow = false;
  // The flag: green and black, with a gold cross from corner to corner.
  const flag = document.createElement('canvas');
  flag.width = 128;
  flag.height = 64;
  const ink = flag.getContext('2d');
  ink.fillStyle = '#009b3a'; ink.fillRect(0, 0, 128, 64);
  ink.fillStyle = '#111111';
  ink.beginPath(); ink.moveTo(0, 0); ink.lineTo(64, 32); ink.lineTo(0, 64); ink.fill();
  ink.beginPath(); ink.moveTo(128, 0); ink.lineTo(64, 32); ink.lineTo(128, 64); ink.fill();
  ink.strokeStyle = '#fed100'; ink.lineWidth = 11;
  ink.beginPath(); ink.moveTo(0, 0); ink.lineTo(128, 64); ink.moveTo(128, 0); ink.lineTo(0, 64); ink.stroke();
  const flagPicture = new THREE.CanvasTexture(flag);
  flagPicture.colorSpace = THREE.SRGBColorSpace;
  const flagCloth = new THREE.MeshBasicMaterial({ map: flagPicture, side: THREE.DoubleSide });
  for (const [px, pz] of [[-150, -18], [156, 70], [-296, 62]]) {
    block(scene, steel, 0.12, 8, 0.12, kx + px, KEY + 4, kz + pz);
    block(scene, flagCloth, 2.4, 1.2, 0.03, kx + px + 1.26, KEY + 7.3, kz + pz);
    addObstacle(kx + px - 0.15, kx + px + 0.15, kz + pz - 0.15, kz + pz + 0.15, 8);
  }
  block(scene, sign('WELCOME TO JAMAICA', 'ONE LOVE', '#009b3a', '#fed100', 1024, 224), 7, 1.5, 0.14, kx - 195, KEY + 3.0, kz - 18);
  for (const side of [-1, 1]) { block(scene, plain(0x8a6240, 0.8), 0.18, 3, 0.18, kx - 195 + side * 3, KEY + 1.5, kz - 18); addObstacle(kx - 195 + side * 3 - 0.15, kx - 195 + side * 3 + 0.15, kz - 18.15, kz - 17.85, 3.2); }
  // --- Island buildings ---
  // Corrugated zinc for the roofs (grey, or painted red), and a few shared paints.
  const zinc = [0x9aa0a6, 0xa8483a].map((colour) => new THREE.MeshStandardMaterial({ color: colour, roughness: 0.5, metalness: 0.4, map: canvasTexture(64, (ctx, s) => {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i < 8; i++) ctx.fillRect(i * 8, 0, 3, s);
    speckle(ctx, s, 300, 0.08);
  }, 7, 1) }));
  const trim = plain(0xf7f4ea, 0.8), darkWood = plain(0x4a3220, 0.8), pane = plain(0x24343c, 0.3), lampGlow = new THREE.MeshBasicMaterial({ color: 0xfff0c0 });
  const PAINT = [0xf2c230, 0x2fa85a, 0xe0483a, 0x3fa0e0, 0xf07a9a, 0xf2f0e6, 0xff9a3a, 0x8a5fd0];
  const tills = [], shopPeople = [], islandAtms = [];
  // Four walls with a doorway in one of them. face: +1 if the door is on the south side, -1 if on the north.
  const shell = (x, z, w, d, H, paint, face, doorW = 1.3) => {
    const wallPiece = (cx, cz, ww, dd, tall = H, lift = 0) => {
      block(scene, paint, ww, tall, dd, cx, KEY + lift + tall / 2, cz);
      if (!lift) addObstacle(cx - ww / 2, cx + ww / 2, cz - dd / 2, cz + dd / 2, KEY + H + 1);
    };
    const front = z + face * (d / 2 - 0.1), back = z - face * (d / 2 - 0.1), side = (w - doorW) / 2;
    wallPiece(x, back, w, 0.2);
    wallPiece(x - w / 2 + 0.1, z, 0.2, d);
    wallPiece(x + w / 2 - 0.1, z, 0.2, d);
    wallPiece(x - doorW / 2 - side / 2, front, side, 0.2);
    wallPiece(x + doorW / 2 + side / 2, front, side, 0.2);
    wallPiece(x, front, doorW, 0.2, H - 2.15, 2.15);                                                    // over the doorway
    block(scene, trim, doorW + 0.24, 0.12, 0.26, x, KEY + 2.21, front);                                 // lintel
    addInterior(x - w / 2 + 0.2, x + w / 2 - 0.2, z - d / 2 + 0.2, z + d / 2 - 0.2, KEY + H, KEY);
    return front;
  };
  // A pitched roof: a long triangle. Its ridge runs east-west unless alongZ is set.
  const gable = (x, z, span, length, baseY, rise, material, alongZ = false) => {
    const r = span / 1.732, roof = new THREE.Mesh(new THREE.CylinderGeometry(r, r, length, 3, 1, false, alongZ ? Math.PI : Math.PI / 2), material);
    if (alongZ) { roof.rotation.x = Math.PI / 2; roof.scale.z = rise / (1.5 * r); } else { roof.rotation.z = Math.PI / 2; roof.scale.x = rise / (1.5 * r); }
    roof.position.set(x, baseY + rise / 3, z);
    roof.castShadow = true;
    scene.add(roof);
  };
  // A window: a white frame, dark glass, and a painted shutter folded back on each side. onSide: it is in an east or west wall.
  const windowAt = (x, y, z, onSide, colour) => {
    const shutter = plain(colour, 0.75);
    if (onSide) {
      block(scene, trim, 0.1, 1.15, 1.15, x, y, z); block(scene, pane, 0.13, 0.95, 0.95, x, y, z);
      for (const end of [-1, 1]) block(scene, shutter, 0.08, 1.05, 0.5, x, y, z + end * 0.85);
    } else {
      block(scene, trim, 1.15, 1.15, 0.1, x, y, z); block(scene, pane, 0.95, 0.95, 0.13, x, y, z);
      for (const end of [-1, 1]) block(scene, shutter, 0.5, 1.05, 0.08, x + end * 0.85, y, z);
    }
  };
  // A house you can walk into: painted board walls on a block base, a zinc roof, shuttered windows,
  // a door standing open, and a verandah. Inside: a bed, a table and chair, a lamp and a picture.
  const cottage = (x, z, w, d, i, face, colour) => {
    const H = 2.8, wallPaint = plain(colour ?? PAINT[i % 8], 0.85), wood = plain(0x6b4a30, 0.7), accent = PAINT[(i + 3) % 8];
    const front = shell(x, z, w, d, H, wallPaint, face);
    gable(x, z, d + 1.3, w + 1.0, KEY + H, 1.5, zinc[i % 2]);
    block(scene, plain(0x8f8a80, 1), w + 0.14, 0.4, d + 0.14, x, KEY + 0.2, z);                         // concrete block base showing round the bottom
    block(scene, plain(0xb9966a, 0.9), w - 0.4, 0.04, d - 0.4, x, KEY + 0.42, z).castShadow = false;    // board floor (just above the base)
    for (const end of [-1, 1]) block(scene, trim, 0.16, H, 0.16, x + end * (w / 2 - 0.02), KEY + H / 2, front + face * 0.06); // white corner boards
    windowAt(x + w / 2 - 1.5, KEY + 1.65, front + face * 0.1, false, accent);
    windowAt(x - w / 2 - 0.02, KEY + 1.65, z, true, accent);
    const door = block(scene, plain(accent, 0.7), 0.06, 2.05, 1.1, x - 0.62, KEY + 1.05, front - face * 0.62); // the door, standing open inwards
    door.rotation.y = face * 0.25;
    // The verandah: a deck, two posts, a rail and a lean-to roof.
    const deckZ = front + face * 1.0;
    block(scene, plain(0x9a7a52, 0.9), w, 0.14, 1.9, x, KEY + 0.07, deckZ).castShadow = false;
    for (const end of [-1, 1]) block(scene, trim, 0.12, 2.3, 0.12, x + end * (w / 2 - 0.15), KEY + 1.15, front + face * 1.85);
    block(scene, trim, w / 2 - 1.1, 0.08, 0.08, x + w / 4 + 0.4, KEY + 0.95, front + face * 1.85);     // rail (on one side of the steps)
    const lean = block(scene, zinc[i % 2], w + 0.5, 0.06, 2.2, x, KEY + 2.42, deckZ);
    lean.rotation.x = face * 0.16;
    // Inside.
    const bedZ = z - face * (d / 2 - 1.35), bedX = x - w / 2 + 0.85;
    block(scene, wood, 1.05, 0.35, 2.05, bedX, KEY + 0.6, bedZ);
    block(scene, plain(PAINT[(i + 5) % 8], 0.9), 1.0, 0.14, 2.0, bedX, KEY + 0.84, bedZ);
    block(scene, plain(0xf4f2ea, 0.9), 0.7, 0.12, 0.4, bedX, KEY + 0.94, bedZ - face * 0.7);
    addObstacle(bedX - 0.55, bedX + 0.55, bedZ - 1.05, bedZ + 1.05, KEY + 1.0);
    const tableX = x + w / 2 - 1.0, tableZ = z - face * (d / 2 - 1.0);
    block(scene, wood, 0.9, 0.06, 0.9, tableX, KEY + 1.15, tableZ);
    block(scene, wood, 0.12, 0.72, 0.12, tableX, KEY + 0.78, tableZ);
    block(scene, plain(0x5a3414, 0.25), 0.07, 0.24, 0.07, tableX + 0.15, KEY + 1.3, tableZ);
    block(scene, wood, 0.45, 0.45, 0.45, tableX - 0.95, KEY + 0.65, tableZ);
    addObstacle(tableX - 0.45, tableX + 0.45, tableZ - 0.45, tableZ + 0.45, KEY + 1.2);
    block(scene, plain(PAINT[(i + 2) % 8], 1), 1.6, 0.02, 1.1, x + 0.3, KEY + 0.455, z).castShadow = false; // a rug
    block(scene, lampGlow, 0.14, 0.14, 0.14, x, KEY + H - 0.3, z);                                           // a bare bulb
    block(scene, plain(PAINT[(i + 6) % 8], 0.8), 0.7, 0.5, 0.04, x, KEY + 1.8, z - face * (d / 2 - 0.22)); // a picture on the back wall
    addFloor(x - w / 2, x + w / 2, Math.min(z - d / 2, deckZ - 0.95), Math.max(z + d / 2, deckZ + 0.95), KEY + 0.42); // a step up onto the verandah and in
  };
  // A shop you can walk into: a painted front with a big sign and an awning, shelves of goods down
  // both sides, and a counter at the back with somebody behind it. The door faces south, onto the street.
  const shop = (x, z, name, small, colour, key, keeper, goodsColours) => {
    const w = 9, d = 7.5, H = 3.3, paint = plain(colour, 0.85), wood = plain(0x6b4a30, 0.7);
    const front = shell(x, z, w, d, H, paint, 1, 1.6);
    gable(x, z, d + 1.2, w + 0.8, KEY + H, 1.7, zinc[1]);
    block(scene, plain(0xc9b48a, 0.9), w - 0.4, 0.04, d - 0.4, x, KEY + 0.02, z).castShadow = false;
    block(scene, sign(name, small, '#111111', '#fed100', 1024, 224), w - 1.2, 1.2, 0.1, x, KEY + H + 0.5, front + 0.16);
    const awning = block(scene, plain(0x009b3a, 0.9), w, 0.07, 1.8, x, KEY + 2.75, front + 0.95);
    awning.rotation.x = 0.2;
    for (const end of [-1, 1]) { block(scene, trim, 0.1, 2.6, 0.1, x + end * (w / 2 - 0.2), KEY + 1.3, front + 1.75); windowAt(x + end * 2.7, KEY + 1.55, front + 0.1, false, 0xfed100); }
    // Shelves down both side walls, stacked with goods (all drawn at once).
    const goods = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.6 }), 96);
    const at = new THREE.Matrix4(), tint = new THREE.Color();
    let n = 0;
    for (const end of [-1, 1]) {
      const shelfX = x + end * (w / 2 - 0.55);
      block(scene, wood, 0.5, 2.0, d - 2.6, shelfX, KEY + 1.0, z - 0.2);
      addObstacle(shelfX - 0.3, shelfX + 0.3, z - 0.2 - (d - 2.6) / 2, z - 0.2 + (d - 2.6) / 2, KEY + 2.1);
      for (let level = 0; level < 4; level++) for (let item = 0; item < 12; item++) {
        const tall = 0.2 + ((item * 7 + level * 3) % 4) * 0.05;
        goods.setMatrixAt(n, at.makeScale(0.22, tall, 0.26).setPosition(shelfX - end * 0.3, KEY + 0.3 + level * 0.5 + tall / 2, z - 0.2 - (d - 2.6) / 2 + 0.25 + item * 0.38));
        goods.setColorAt(n++, tint.set(goodsColours[(item + level * 2) % goodsColours.length]));
      }
    }
    scene.add(goods);
    // The counter at the back, with a till.
    const counterZ = z - d / 2 + 1.6;
    block(scene, wood, 4.4, 1.0, 0.8, x, KEY + 0.5, counterZ);
    block(scene, plain(0xfed100, 0.6), 4.5, 0.06, 0.9, x, KEY + 1.03, counterZ);
    block(scene, plain(0x17181a, 0.6), 0.4, 0.24, 0.4, x + 1.4, KEY + 1.18, counterZ);
    addObstacle(x - 2.2, x + 2.2, counterZ - 0.4, counterZ + 0.4, KEY + 1.2);
    block(scene, lampGlow, 2.4, 0.06, 0.3, x, KEY + H - 0.05, z);                                            // strip light
    shopPeople.push({ x, z: counterZ - 0.85, facing: 0, name: keeper, skin: 'dark', special: true, dye: key === 'coffee' ? 'baron' : 'joe', say: 'Press E a di counter fi see wah mi have.' });
    tills.push({ key, x, z: counterZ + 1.2 });
  };
  // --- Kingston: the town. Two streets of houses, a market square, a church and a jerk shack ---
  const road = plain(0xc9b48a, 1);                                                                     // packed sandy earth
  block(scene, road, 226, 0.03, 8, kx + 123, KEY + 0.02, kz + 45).castShadow = false;                  // Main Street
  // The road on from Kingston: west out of town, north through the trees, then west again past the houses by the airstrip.
  block(scene, road, 64, 0.03, 8, kx - 28, KEY + 0.02, kz + 45).castShadow = false;
  block(scene, road, 8, 0.03, 45, kx - 60, KEY + 0.021, kz + 26.5).castShadow = false;
  block(scene, road, 244, 0.03, 7, kx - 178, KEY + 0.02, kz + 8).castShadow = false;
  const islandRoad = [[kx + 234, kz + 45], [kx - 60, kz + 45], [kx - 60, kz + 8], [kx - 298, kz + 8]];
  block(scene, road, 8, 0.03, 44, kx + 148, KEY + 0.021, kz + 71).castShadow = false;                  // Market Street, running south from it
  block(scene, road, 34, 0.03, 24, kx + 180, KEY + 0.02, kz + 78).castShadow = false;                  // the market square
  for (let i = 0; i < 8; i++) {
    cottage(kx + 68 + i * 20 + (i > 3 ? 12 : 0), kz + 37.9, 7 + (i % 3), 6, i, 1);                      // north side of Main Street
    if (i !== 3 && i !== 4) cottage(kx + 68 + i * 20 + (i > 3 ? 12 : 0), kz + 52.1, 7 + ((i + 1) % 3), 6, i + 3, -1); // south side (with a gap for Market Street)
  }
  for (let i = 0; i < 3; i++) cottage(kx + 136.9, kz + 62 + i * 9, 6, 6, i + 5, 1);                    // down the west side of Market Street
  block(scene, sign('KINGSTON', 'MAIN STREET', '#009b3a', '#fed100', 512, 160), 3.6, 1.1, 0.12, kx - 3, KEY + 2.6, kz + 51);
  for (const side of [-1, 1]) block(scene, plain(0x8a6240, 0.8), 0.16, 2.6, 0.16, kx - 3 + side * 1.6, KEY + 1.3, kz + 51);
  // Two shops at the west end of Main Street, and a cash machine between them and the houses.
  shop(kx + 24, kz + 37.2, "MISS LOU'S GROCERY", 'PATTIES · COLD DRINKS · EVERYTHING', 0xf2c230, 'grocery', 'Miss Lou', [0xe0483a, 0xf2c230, 0x2fa85a, 0x3fa0e0, 0xf2f0e6, 0xff9a3a]);
  shop(kx + 40, kz + 37.2, 'BLUE MOUNTAIN COFFEE', 'FRESH ROASTED · RUM CAKE', 0x3f7a8a, 'coffee', 'Mr Clarke', [0x4a3220, 0x6b4a30, 0xf2f0e6, 0x8a5a2e, 0x2f2018]);
  islandAtms.push(addAtm(scene, kx + 51, kz + 40.3, 0, KEY), addAtm(scene, kx - 163.5, kz - 21, 0, KEY));
  // The clinic, at the very end of the street: white, with a red cross, and the doctor behind the desk.
  shop(kx + 9, kz + 37.2, 'KINGSTON CLINIC', 'DOCTOR · NO APPOINTMENT NEEDED', 0xf4f6f6, 'clinic', 'Dr Campbell', [0xf4f6f6, 0xd9382b, 0x9fd0e6, 0xf4f6f6, 0x3fa0e0]);
  const doctor = tills.pop();                                                                          // (he is seen, not shopped at)
  Object.assign(shopPeople[shopPeople.length - 1], { dye: 'doctor', say: 'Press E an mek mi look pon yuh.' });
  for (const [bw, bh] of [[1.2, 0.36], [0.36, 1.2]]) block(scene, new THREE.MeshBasicMaterial({ color: 0xe0352b }), bw, bh, 0.06, kx + 9 - 3.6, KEY + 4.5, kz + 37.2 + 3.84);
  // Market stalls: a table of fruit under a striped awning.
  const FRUIT = [0xf2c230, 0xe0483a, 0x3fa85a, 0xff9a3a, 0x8a3fc0, 0xf2e04a];
  for (let i = 0; i < 6; i++) {
    const stallX = kx + 168 + (i % 3) * 11, stallZ = kz + 71 + Math.floor(i / 3) * 12;
    block(scene, plain(0x8a6240, 0.8), 3.2, 0.9, 1.3, stallX, KEY + 0.45, stallZ);
    for (const [px, pz] of [[-1.6, -0.7], [1.6, -0.7], [-1.6, 0.7], [1.6, 0.7]]) block(scene, plain(0x6b4a30, 0.8), 0.1, 2.5, 0.1, stallX + px, KEY + 1.25, stallZ + pz);
    block(scene, plain([0x009b3a, 0xfed100, 0xd9281e][i % 3], 0.9), 3.7, 0.08, 1.9, stallX, KEY + 2.5, stallZ).rotation.x = 0.12;
    for (let pile = 0; pile < 8; pile++) {
      const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.13 + (pile % 3) * 0.03, 8, 6), plain(FRUIT[(i + pile) % 6], 0.6));
      fruit.position.set(stallX - 1.3 + pile * 0.37, KEY + 1.03, stallZ + ((pile % 2) - 0.5) * 0.5);
      scene.add(fruit);
    }
    addObstacle(stallX - 1.6, stallX + 1.6, stallZ - 0.65, stallZ + 0.65, KEY + 1.0);
    const [stallName, vendor, woman] = [['FRESH FRUIT', 'Auntie Pearl', true], ['ACKEE & SALTFISH', 'Miss Icilda', true], ['COLD DRINKS', 'Junior', false], ['FRIED FISH', 'Captain Roy', false], ['SWEETS', 'Sister Joy', true], ['PATTIES & BUN', 'Uncle Vin', false]][i];
    block(scene, sign(stallName, null, '#111111', '#fed100', 512, 96), 3.0, 0.5, 0.05, stallX, KEY + 2.15, stallZ + 0.74);
    shopPeople.push({ x: stallX, z: stallZ - 1.15, facing: 0, name: vendor, woman, skin: i % 2 ? 'dark' : 'tan', special: true, dye: ['zora', 'joe', 'spike', 'baron'][i % 4], say: 'Press E fi see wah mi a sell.' });
    tills.push({ key: `stall${i}`, x: stallX, z: stallZ + 1.35 });
  }
  // The church: whitewashed walls, a red zinc roof with a little bell tower, and coloured windows.
  // You can walk in: there are pews either side of the aisle, an altar, and the pastor.
  const churchX = kx + 232, churchZ = kz + 74, CW = 9, CD = 16, CH = 5, whiteWash = plain(0xf7f4ea, 0.9);
  const churchDoor = shell(churchX, churchZ, CW, CD, CH, whiteWash, -1, 1.8);
  gable(churchX, churchZ, CW + 1.4, CD + 1.0, KEY + CH, 2.6, zinc[1], true);
  block(scene, plain(0xb9966a, 0.9), CW - 0.4, 0.04, CD - 0.4, churchX, KEY + 0.02, churchZ).castShadow = false;
  block(scene, whiteWash, 2.2, 3.2, 2.2, churchX, KEY + CH + 2.6, churchZ - CD / 2 + 1.4);              // the bell tower, over the door
  const spire = new THREE.Mesh(new THREE.ConeGeometry(1.9, 2.6, 4), zinc[1]);
  spire.rotation.y = Math.PI / 4;
  spire.position.set(churchX, KEY + CH + 5.5, churchZ - CD / 2 + 1.4);
  scene.add(spire);
  const gold = new THREE.MeshBasicMaterial({ color: 0xf2c84a });
  block(scene, gold, 0.12, 1.2, 0.12, churchX, KEY + CH + 7.3, churchZ - CD / 2 + 1.4);                 // the cross on top
  block(scene, gold, 0.7, 0.12, 0.12, churchX, KEY + CH + 7.5, churchZ - CD / 2 + 1.4);
  block(scene, plain(0x17181a, 0.5), 0.9, 0.9, 0.05, churchX, KEY + CH + 2.9, churchZ - CD / 2 + 0.27); // the bell's opening
  for (let i = 0; i < 4; i++) for (const side of [-1, 1]) {                                             // coloured glass down both sides
    const glassX = churchX + side * (CW / 2 - 0.02), glassZ = churchZ - 4.5 + i * 3.2;
    block(scene, new THREE.MeshBasicMaterial({ color: [0xe0483a, 0x3fa0e0, 0xfed100, 0x2fa85a][(i + (side > 0 ? 1 : 0)) % 4] }), 0.26, 1.9, 0.8, glassX, KEY + 2.6, glassZ);
    block(scene, trim, 0.28, 0.1, 1.0, glassX, KEY + 1.6, glassZ);
  }
  for (let row = 0; row < 5; row++) for (const side of [-1, 1]) {                                       // pews
    const pewX = churchX + side * 2.5, pewZ = churchZ - 3.6 + row * 1.9;
    block(scene, darkWood, 3.2, 0.1, 0.5, pewX, KEY + 0.45, pewZ);
    block(scene, darkWood, 3.2, 0.6, 0.08, pewX, KEY + 0.75, pewZ - 0.26);
    addObstacle(pewX - 1.6, pewX + 1.6, pewZ - 0.3, pewZ + 0.3, KEY + 1.0);
  }
  const altarZ = churchZ + CD / 2 - 2.2;
  block(scene, plain(0xf2f0e6, 0.8), 2.6, 1.0, 0.9, churchX, KEY + 0.5, altarZ);                         // the altar, under a white cloth
  block(scene, plain(0x8a3fc0, 0.8), 0.9, 1.02, 0.92, churchX, KEY + 0.51, altarZ);
  addObstacle(churchX - 1.3, churchX + 1.3, altarZ - 0.45, altarZ + 0.45, KEY + 1.1);
  block(scene, gold, 0.16, 1.9, 0.08, churchX, KEY + 3.0, churchZ + CD / 2 - 0.24);                      // the cross on the wall behind it
  block(scene, gold, 1.0, 0.16, 0.08, churchX, KEY + 3.4, churchZ + CD / 2 - 0.24);
  block(scene, lampGlow, 0.5, 0.06, CD - 4, churchX, KEY + CH - 0.05, churchZ);
  block(scene, sign('KINGSTON CHAPEL', 'ALL ARE WELCOME', '#f7f4ea', '#111111', 512, 128), 3.4, 0.8, 0.08, churchX + 3.0, KEY + 1.6, churchDoor - 0.16);
  shopPeople.push({ x: churchX, z: altarZ + 1.0, facing: Math.PI, name: 'Pastor Brown', skin: 'dark', special: true, dye: 'baron', say: 'Welcome, my child. Kneel a while by di altar (press E) an be at peace.' });
  const altar = { x: churchX, z: altarZ - 1.3 };
  // The jerk shack, smoking away at the corner of the square.
  const shackX = kx + 204, shackZ = kz + 84;
  block(scene, plain(0xd9281e, 0.8), 4, 1.0, 1.0, shackX, KEY + 0.5, shackZ);
  block(scene, plain(0x17181a, 0.7), 1.2, 0.5, 0.7, shackX + 1.1, KEY + 1.25, shackZ);                  // the oil-drum grill
  for (const [px, pz] of [[-2, -1.6], [2, -1.6], [-2, 0.6], [2, 0.6]]) block(scene, plain(0x6b4a30, 0.8), 0.12, 2.8, 0.12, shackX + px, KEY + 1.4, shackZ + pz);
  block(scene, plain(0x6f7a80, 0.6, { metalness: 0.3 }), 4.8, 0.12, 3, shackX, KEY + 2.85, shackZ - 0.5);
  block(scene, sign('JERK CHICKEN', 'HOT · HOTTER · HOTTEST', '#111111', '#fed100', 512, 128), 3.4, 0.7, 0.06, shackX, KEY + 2.4, shackZ + 0.66);
  addObstacle(shackX - 2, shackX + 2, shackZ - 0.5, shackZ + 0.5, KEY + 1.6);
  shopPeople.push({ x: shackX - 0.6, z: shackZ - 1.0, facing: 0, name: 'Chef Leroy', skin: 'dark', special: true, dye: 'spike', say: 'Press E fi di best jerk pon di island.' });
  tills.push({ key: 'jerk', x: shackX - 0.4, z: shackZ + 1.4 });
  // A row of houses by the airstrip.
  for (let i = 0; i < 6; i++) cottage(kx - 142 + i * 14, kz - 2, 7, 6, i + 2, -1);
  // The Irie Beach Bar, on the south-west shore, and loungers on the sand beyond it.
  const bar = [-300, 70];
  for (const [colour, i] of [[0x009b3a, 0], [0xfed100, 1], [0xd9281e, 2]]) block(scene, plain(colour, 0.8), 5, 0.36, 0.9, kx + bar[0], KEY + 0.2 + i * 0.36, kz + bar[1]); // the bar, in three stripes
  addObstacle(kx + bar[0] - 2.5, kx + bar[0] + 2.5, kz + bar[1] - 0.45, kz + bar[1] + 0.45, 1.6);
  for (const [px, pz] of [[-2.6, -1.8], [2.6, -1.8], [-2.6, 0.9], [2.6, 0.9]]) block(scene, plain(0x8a6240, 0.8), 0.14, 2.8, 0.14, kx + bar[0] + px, KEY + 1.4, kz + bar[1] + pz);
  const thatch = new THREE.Mesh(new THREE.ConeGeometry(4.6, 1.5, 4), plain(0xc9a85a, 1));
  thatch.rotation.y = Math.PI / 4;
  thatch.position.set(kx + bar[0], KEY + 3.5, kz + bar[1] - 0.4);
  scene.add(thatch);
  block(scene, sign('IRIE BEACH BAR', null, '#111111', '#fed100', 512, 96), 3.6, 0.6, 0.06, kx + bar[0], KEY + 2.5, kz + bar[1] + 1.0);
  for (const [px, colour] of [[-288, 0x009b3a], [-282, 0xfed100], [-312, 0xd9281e], [-318, 0x009b3a]]) {
    block(scene, plain(0xf2f0e6, 0.6), 0.65, 0.1, 1.9, kx + px, KEY + 0.3, kz + 84);
    block(scene, plain(0xf2f0e6, 0.5), 0.07, 2.3, 0.07, kx + px + 0.7, KEY + 1.15, kz + 84);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.5, 10), plain(colour, 0.8, { side: THREE.DoubleSide }));
    shade.position.set(kx + px + 0.7, KEY + 2.4, kz + 84);
    scene.add(shade);
  }
  const keyHut = hut(kx - 170, kz - 20, KEY, 'BACK TO THE MAINLAND');
  // --- The running track: a 200-metre oval with six lanes, between the airstrip and the south shore ---
  const TR = 100 / (2 * Math.PI), trackX = kx - 140, trackZ = kz + 46, LANE = 1.2, trackOut = TR + 6 * LANE + 0.2;
  {
    const oval = (radius) => { const path = new THREE.Path(); path.moveTo(-25, -radius); path.lineTo(25, -radius); path.absarc(25, 0, radius, -Math.PI / 2, Math.PI / 2, false); path.lineTo(-25, radius); path.absarc(-25, 0, radius, Math.PI / 2, Math.PI * 1.5, false); return path; };
    const surface = new THREE.Shape(oval(trackOut).getPoints(40));
    surface.holes.push(new THREE.Path(oval(TR - 0.2).getPoints(40)));
    const track = new THREE.Mesh(new THREE.ShapeGeometry(surface), new THREE.MeshStandardMaterial({ color: 0xb5523a, roughness: 0.95 }));
    track.rotation.x = -Math.PI / 2;
    track.position.set(trackX, KEY + 0.03, trackZ);
    track.receiveShadow = true;
    scene.add(track);
    const paint = new THREE.LineBasicMaterial({ color: 0xf7f4ea });
    for (let lane = 0; lane <= 6; lane++) {                                                               // the white lines between the lanes
      const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(oval(TR + lane * LANE).getPoints(48).map((p) => new THREE.Vector3(p.x, 0, p.y))), paint);
      line.position.set(trackX, KEY + 0.05, trackZ);
      scene.add(line);
    }
    block(scene, white, 0.3, 0.01, 6 * LANE, trackX - 25, KEY + 0.05, trackZ + TR + 3 * LANE).castShadow = false; // start and finish line
    // A stand along the north side, a podium on the grass in the middle, and the sign.
    for (let step = 0; step < 4; step++) block(scene, plain(0x9aa0a6, 0.8), 40, 0.5, 1.2, trackX, KEY + 0.25 + step * 0.5, trackZ - trackOut - 2.4 - step * 1.2);
    addObstacle(trackX - 20, trackX + 20, trackZ - trackOut - 6.6, trackZ - trackOut - 1.8, KEY + 2.2);
    for (const [px, tall, colour] of [[0, 1.0, 0xf2c84a], [-1.5, 0.7, 0xc9ccd0], [1.5, 0.45, 0xb9783a]]) block(scene, plain(colour, 0.5, { metalness: 0.4 }), 1.4, tall, 1.4, trackX + px, KEY + tall / 2, trackZ);
    addObstacle(trackX - 2.2, trackX + 2.2, trackZ - 0.7, trackZ + 0.7, KEY + 1.1);
    block(scene, sign('NATIONAL STADIUM', 'RUN LAPS: EVERY LAP MAKES YOU 1% FASTER', '#009b3a', '#fed100', 1024, 224), 9, 1.9, 0.14, trackX, KEY + 4.4, trackZ - trackOut - 7);
    for (const side of [-1, 1]) block(scene, plain(0x8a6240, 0.8), 0.2, 4.4, 0.2, trackX + side * 4, KEY + 2.2, trackZ - trackOut - 7);
    block(scene, sign('RUN THIS WAY  →', null, '#111111', '#fed100', 512, 96), 3, 0.55, 0.06, trackX - 18, KEY + 1.5, trackZ + trackOut + 1.2);
    block(scene, plain(0x8a6240, 0.8), 0.12, 1.5, 0.12, trackX - 18, KEY + 0.75, trackZ + trackOut + 1.2);
  }
  const track = {
    x: trackX, z: trackZ, R: TR, lane: LANE,
    coach: { x: trackX - 27.5, z: trackZ + TR - 2.2, facing: 0, name: 'Coach Miller', skin: 'dark', wear: 'cap', special: true, dye: 'joe', say: 'Run laps, get fast. When yuh ready fi di Olympics, press E.' },
    runners: [['Dash Okoro', 'zora', 6.9], ['Flynn Carter', 'baron', 7.2], ['Kenji Mori', 'doctor', 7.5], ['Luca Rossi', 'spike', 7.8], ['Tariq Bello', 'joe', 8.1]].map(([name, dye, pace], i) => (
      { x: trackX - 20 + i * 1.6, z: trackZ + TR - 2.6, facing: 0, name, dye, pace, skin: i % 2 ? 'dark' : 'tan', runner: true })),
  };
  // The beach flag, on the sand by the bar: the same colours as on the mainland, and a board saying what they mean.
  const beachFlag = new THREE.MeshBasicMaterial({ color: 0x2fae4a, side: THREE.DoubleSide });
  for (const fx of [-292, -244]) {
    block(scene, steel, 0.1, 8, 0.1, kx + fx, KEY + 4, kz + 93);
    block(scene, beachFlag, 2.0, 1.2, 0.04, kx + fx + 1.05, KEY + 7.3, kz + 93);
    addObstacle(kx + fx - 0.12, kx + fx + 0.12, kz + 92.88, kz + 93.12, 8);
  }
  block(scene, sign('BEACH FLAGS', 'GREEN SWIM · YELLOW CARE · RED WAVES · PURPLE SHARKS', '#1f6fb5', '#fff8e8', 1024, 192), 4.2, 0.8, 0.08, kx - 289, KEY + 1.9, kz + 93);
  // People swimming off the beach there.
  const swimmers = [[-296, 108, 'Kemar'], [-284, 114, 'Tanya'], [-262, 112, 'Devon'], [-246, 118, 'Shanice']].map(([sx2, sz2, name], i) => ({ x: kx + sx2, z: kz + sz2, facing: 0, name, woman: i % 2 === 1, skin: i % 3 ? 'dark' : 'tan', swimmer: true }));
  // His own hut, on the south-west shore a little way along from the bar: plank walls, a thatched
  // roof, a porch looking out to sea, a hammock, and inside a bed to sleep in.
  const myX = kx - 252, myZ = kz + 78;
  cottage(myX, myZ, 8, 7, 4, 1, 0x9a7448);
  const homeThatch = new THREE.Mesh(new THREE.ConeGeometry(7.4, 3, 4), plain(0xc9a85a, 1));
  homeThatch.rotation.y = Math.PI / 4;
  homeThatch.position.set(myX, KEY + 4.5, myZ + 0.6);
  homeThatch.castShadow = true;
  scene.add(homeThatch);
  block(scene, plain(0x8a6240, 0.85), 8, 0.12, 2.6, myX, KEY + 0.06, myZ + 4.8);                         // the porch
  for (const side of [-1, 1]) { block(scene, plain(0x6b4a30, 0.8), 0.16, 2.9, 0.16, myX + side * 3.8, KEY + 1.45, myZ + 5.9); addObstacle(myX + side * 3.8 - 0.1, myX + side * 3.8 + 0.1, myZ + 5.8, myZ + 6.0, 3); }
  block(scene, sign('HOME', 'YOUR HUT', '#009b3a', '#fed100', 256, 128), 1.6, 0.7, 0.06, myX - 2.2, KEY + 2.3, myZ + 3.55);
  block(scene, plain(0x6b4a30, 0.8), 0.5, 0.45, 1.6, myX + 2.9, KEY + 0.23, myZ + 4.9);                  // a bench on the porch
  for (const px of [-7, -3.4]) { block(scene, plain(0x6b4a30, 0.8), 0.16, 1.8, 0.16, myX + px, KEY + 0.9, myZ + 9); addObstacle(myX + px - 0.1, myX + px + 0.1, myZ + 8.9, myZ + 9.1, 1.9); } // two posts...
  const hammock = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 3.4, 12, 1, true, Math.PI * 0.72, Math.PI * 0.56), new THREE.MeshStandardMaterial({ color: 0xf2e6c0, roughness: 0.95, side: THREE.DoubleSide }));
  hammock.rotation.z = Math.PI / 2;                                                                     // ...and a hammock slung between them
  hammock.position.set(myX - 5.2, KEY + 1.75, myZ + 9);
  scene.add(hammock);
  const home = { bed: { x: myX - 3.15, z: myZ - 2.15 }, spawn: new THREE.Vector3(myX + 0.6, KEY, myZ + 0.6), door: new THREE.Vector3(myX, KEY, myZ + 7.5), facing: 0 };
  // Palm Ave airfield: a short strip in the field behind the houses.
  const px0 = -20, pz0 = 78;
  block(scene, plain(0x7a9a52, 1), 250, 0.03, 34, px0, 0.025, pz0).castShadow = false;
  block(scene, plain(0x4a4a48, 0.95), 230, 0.03, 14, px0, 0.05, pz0 + 4).castShadow = false;
  for (let i = 0; i < 11; i++) block(scene, white, 8, 0.01, 0.4, px0 - 100 + i * 20, 0.07, pz0 + 4).castShadow = false;
  clearings[48].set(px0 - 125.5, pz0 - 17.5, px0 + 125.5, pz0 + 17.5);
  block(scene, steel, 0.12, 5, 0.12, px0 + 30, 2.5, pz0 - 12);
  const sock2 = sock.clone();
  sock2.position.set(px0 + 31.2, 4.8, pz0 - 12);
  scene.add(sock2);
  const palmHut = hut(px0, pz0 - 12, 0, 'PALM AVE AIRFIELD');

  // Every place a ticket can take him: where the plane puts down, where he ends up standing, and the ticket desk.
  const stations = [
    { key: 'miami', name: 'Miami Airport', land: new THREE.Vector3(330, GROUND, RUNWAY_Z), arrive: new THREE.Vector3(416, 0.15, 108), desk: { x: tx - 10.65, z: tz + 0.7 }, facing: Math.PI },
    { key: 'key', name: 'Jamaica', land: new THREE.Vector3(kx - 180, KEY, kz - 40), arrive: new THREE.Vector3(kx - 166, KEY, kz - 13), desk: keyHut.desk, seller: { ...keyHut.seller, name: 'Coconut Pete', skin: 'dark' }, facing: Math.PI },
    { key: 'palm', name: 'Palm Ave airfield', land: new THREE.Vector3(px0, 0.05, pz0 + 4), arrive: new THREE.Vector3(px0, 0, pz0 - 8), desk: palmHut.desk, seller: { ...palmHut.seller, name: 'Old Walt' }, facing: Math.PI },
  ];
  // The people at the Irie Beach Bar: the barman, and three regulars with a bottle each.
  const barPeople = [
    { x: kx + bar[0], z: kz + bar[1] - 1.15, facing: 0, name: 'Winston the barman', skin: 'dark', special: true, dye: 'spike', say: 'Press E and I will pour a round for everybody.' },
    { x: kx + bar[0] - 1.7, z: kz + bar[1] + 1.25, facing: Math.PI, name: 'Marcia', woman: true, skin: 'dark', drinker: true },
    { x: kx + bar[0] - 0.5, z: kz + bar[1] + 1.3, facing: Math.PI, name: 'Desmond', skin: 'tan', drinker: true },
    { x: kx + bar[0] + 2.4, z: kz + bar[1] + 1.25, facing: Math.PI + 0.5, name: 'Delroy', skin: 'dark', drinker: true },
  ];
  return { planes, stations, barPeople, home, doctor, track, beachFlag, swimmers, islandRoad, junglePalms, tills, shopPeople, islandAtms, altar, barSpot: { x: kx + bar[0] + 0.9, z: kz + bar[1] + 1.6 }, liner: { group: liner, phase: 'away', timer: 8, speed: 0 },
    shuttle: { group: shuttle, plane: true, own: true, autopilot: true, camFar: 13, name: 'airliner', speed: 0, heading: 0, throttle: 1, takeoff: 0, engine: null, spinners: [], steerers: [] },
    clerk: { x: tx - 10.65, z: tz - 2.3, facing: 0, name: 'Gloria at check-in', special: true, say: 'Press E for a ticket. Or the red propeller plane and the blue jet are out on the apron, if you want to fly yourself.' } };
}

// Put a plane back where it is kept, as new.
export function resetPlane(plane) {
  plane.group.position.copy(plane.home);
  plane.group.rotation.set(0, 0, 0);
  Object.assign(plane, { heading: 0, speed: 0, steer: 0, throttle: 0, vy: 0, pitch: 0, roll: 0 });
}

const probe = new THREE.Vector3(), pushed = new THREE.Vector3();
// Flying. input: { throttle: -1..1 (W and S), steer: 1 left .. -1 right, up, down, handbrake }.
// Returns 'crash' or 'ditch' if that was the end of the flight.
export function updatePlane(plane, input, dt, halfMap) {
  const position = plane.group.position, wet = waterDepthAt(position) > 0.3;
  const ground = wet ? -0.3 : Math.max(floorAt(position), 0);
  const airborne = position.y > ground + 0.06;
  plane.throttle = THREE.MathUtils.clamp(plane.throttle + input.throttle * 0.5 * dt, 0, 1);
  const want = plane.throttle * plane.top;
  plane.speed += THREE.MathUtils.clamp(want - plane.speed, -(airborne ? 5 : 8) * dt, (10 + plane.top * 0.06) * dt);
  if (!airborne && input.handbrake) plane.speed = Math.max(0, plane.speed - 30 * dt);
  plane.steer += (input.steer - plane.steer) * Math.min(1, 4 * dt);
  plane.heading += plane.steer * (airborne ? plane.turn : Math.min(1, plane.speed / 9) * 0.9) * dt;
  // Lift: fast enough, and the nose can come up. Too slow in the air, and it sinks.
  const canFly = plane.speed >= plane.takeoff, pull = (input.up ? 1 : 0) - (input.down ? 1 : 0);
  let rise = 0;
  if (canFly) rise = pull * plane.speed * plane.climb;
  else if (airborne) rise = -(5 + (plane.takeoff - plane.speed) * 0.45);
  plane.vy += (rise - plane.vy) * Math.min(1, 2.2 * dt);
  if (!airborne && plane.vy < 0) plane.vy = 0;
  const sinking = plane.vy;
  position.x += Math.sin(plane.heading) * plane.speed * dt;
  position.z += Math.cos(plane.heading) * plane.speed * dt;
  position.y = Math.min(450, position.y + plane.vy * dt);
  let ended = null;
  if (position.y <= ground) {
    if (wet) ended = 'ditch';
    else if (airborne && (sinking < -11 || (ground > 4 && plane.speed > 30 && plane.pitch < 0.05))) ended = 'crash'; // came down far too hard, or flew into a hillside
    position.y = ground;
    plane.vy = 0;
  }
  // Buildings, towers, lamp posts: flying into one is the end; nudging one on the ground just stops it.
  probe.set(position.x + Math.sin(plane.heading) * 2.5, position.y + 0.8, position.z + Math.cos(plane.heading) * 2.5);
  pushed.copy(probe);
  pushOut(pushed, 1.6, true);
  if (pushed.x !== probe.x || pushed.z !== probe.z) {
    if (plane.speed > 14) ended = 'crash';
    position.x += pushed.x - probe.x;
    position.z += pushed.z - probe.z;
    plane.speed *= 0.4;
    plane.throttle = 0;
  }
  const limit = halfMap - 5;
  if (position.x < -limit || position.x > EAST_EDGE || Math.abs(position.z) > limit) plane.heading += 1.2 * dt; // the edge of the world: it turns back by itself
  position.x = THREE.MathUtils.clamp(position.x, -limit, EAST_EDGE); // (the sea goes on a long way east, out to Jamaica)
  position.z = THREE.MathUtils.clamp(position.z, -limit, limit);
  // How it sits in the air: nose up or down with the climb, banking into the turn.
  const nowAirborne = position.y > ground + 0.06;
  plane.pitch += ((nowAirborne ? THREE.MathUtils.clamp(Math.atan2(plane.vy, Math.max(plane.speed, 8)), -0.5, 0.5) : canFly && pull > 0 ? 0.14 : 0) - plane.pitch) * Math.min(1, 4 * dt);
  plane.roll += ((nowAirborne ? -plane.steer * 0.6 : 0) - plane.roll) * Math.min(1, 4 * dt);
  plane.group.rotation.set(-plane.pitch, plane.heading, plane.roll);
  for (const prop of plane.props) prop.rotation.z += (6 + plane.throttle * 50) * dt;
  if (plane.engine) {
    const now = plane.engine.context.currentTime;
    plane.engine.tone.frequency.setTargetAtTime(70 + plane.throttle * 110 + plane.speed * 0.6, now, 0.15);
    plane.engine.volume.gain.setTargetAtTime(0.06 + plane.throttle * 0.06, now, 0.15);
  }
  return ended;
}

// Each frame: the airliner that flies itself. It comes in from the west, lands, rolls to the far
// end, turns round, takes off back the way it came, and is gone for a while.
export function updateAirport(airport, dt) {
  const liner = airport.liner, plane = liner.group, position = plane.position;
  liner.timer -= dt;
  if (liner.phase === 'away') {
    if (liner.timer > 0) return;
    liner.phase = 'approach';
    liner.speed = 72;
    position.set(-760, 150, RUNWAY_Z);
    plane.rotation.set(0.05, Math.PI / 2, 0);
    plane.visible = true;
  } else if (liner.phase === 'approach') {
    position.x += liner.speed * dt;
    position.y = Math.max(GROUND, 150 * (250 - position.x) / 1010);
    if (position.y <= GROUND) { liner.phase = 'roll'; plane.rotation.x = 0; }
  } else if (liner.phase === 'roll') {
    liner.speed = Math.max(0, liner.speed - 5.6 * dt);
    position.x += liner.speed * dt;
    if (liner.speed <= 0) { liner.phase = 'turn'; liner.timer = 14; }
  } else if (liner.phase === 'turn') {
    plane.rotation.y = Math.PI / 2 + Math.PI * Math.min(1, (14 - liner.timer) / 8);       // swings round on the spot, then waits
    if (liner.timer <= 0) liner.phase = 'takeoff';
  } else if (liner.phase === 'takeoff') {
    liner.speed = Math.min(95, liner.speed + 4.4 * dt);
    position.x -= liner.speed * dt;
    if (liner.speed > 66) { position.y += (liner.speed - 60) * 0.32 * dt; plane.rotation.x += (-0.2 - plane.rotation.x) * Math.min(1, dt); }
    if (position.x < -1100) { liner.phase = 'away'; liner.timer = 45; plane.visible = false; }
  }
}