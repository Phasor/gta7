// Other people's cars, parked around Miami and Palm Ave, that can be stolen and
// driven: a taxi, saloons, a sports car, a muscle car and a big 4x4. They drive
// with the same code as the pickup truck (see truck.js), so each one has the
// same parts: group, spinners, steerers, heading, speed, steer, engine.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { floorAt } from './world.js';

// length, width: the body. body: how tall the lower body is. cabin: [height, length, how far back it sits].
// ride: how far the body is off the road. wheel: tyre radius. top: top speed in metres a second.
const STYLES = {
  saloon: { length: 4.6, width: 1.84, body: 0.52, cabin: [0.5, 2.3, -0.2], ride: 0.3, wheel: 0.33, top: 30 },
  taxi: { length: 4.7, width: 1.86, body: 0.54, cabin: [0.52, 2.5, -0.15], ride: 0.3, wheel: 0.33, top: 29 },
  sports: { length: 4.4, width: 1.92, body: 0.4, cabin: [0.38, 1.7, -0.35], ride: 0.2, wheel: 0.34, top: 44 },
  muscle: { length: 4.9, width: 1.94, body: 0.5, cabin: [0.42, 1.9, -0.5], ride: 0.28, wheel: 0.36, top: 38 },
  jeep: { length: 4.8, width: 1.98, body: 0.62, cabin: [0.66, 2.9, -0.45], ride: 0.46, wheel: 0.44, top: 26 },
};
// Where they are parked: [style, name, paint colour, x, z, heading]. (A heading of half a turn of pi faces along the road.)
const PARKED = [
  ['taxi', 'taxi', 0xf2c21e, 640, -11.6, Math.PI / 2],
  ['saloon', 'blue saloon', 0x2a5fb0, 735, 2.7, -Math.PI / 2],
  ['sports', 'sports car', 0xe0c020, 790, -11.7, Math.PI / 2],
  ['jeep', 'black 4x4', 0x17181a, 560, -11.6, Math.PI / 2],
  ['muscle', 'muscle car', 0xe0601e, 470, 2.7, -Math.PI / 2],
  ['saloon', 'white saloon', 0xeeeeea, 880, 2.7, -Math.PI / 2],
  ['sports', 'red sports car', 0xc41f1f, 520, 2.7, -Math.PI / 2],
  ['saloon', 'green saloon', 0x3f7a4a, 14, 2.1, Math.PI / 2],
  ['muscle', 'purple muscle car', 0x5a2f8a, -42, 2.1, -Math.PI / 2],
];

let reflections = null;

export function buildCar(renderer, style, colour) {
  if (!reflections) { // shiny paint needs surroundings to reflect: made once and shared by every car
    const pmrem = new THREE.PMREMGenerator(renderer);
    reflections = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
  }
  const s = STYLES[style];
  const shiny = (color, roughness, metalness, intensity = 0.7) => new THREE.MeshStandardMaterial({ color, roughness, metalness, envMap: reflections, envMapIntensity: intensity });
  const paint = shiny(colour, 0.25, 0.4), chrome = shiny(0xdfe2e4, 0.12, 1, 1.1), glass = shiny(0x10161a, 0.05, 0.6, 1.2);
  const black = new THREE.MeshStandardMaterial({ color: 0x151617, roughness: 0.85 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x1b1b1c, roughness: 0.95 });
  const lamp = new THREE.MeshBasicMaterial({ color: 0xfff6d8 }), tail = new THREE.MeshBasicMaterial({ color: 0xd0201a });

  const group = new THREE.Group();
  group.rotation.order = 'YXZ';
  const part = (material, w, h, d, px, py, pz, round = 0.05) => {
    const geometry = round ? new RoundedBoxGeometry(w, h, d, 3, Math.min(round, Math.min(w, h, d) * 0.45)) : new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(px, py, pz);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };
  const L = s.length, W = s.width, half = L / 2;
  const deck = s.ride + s.body; // the top of the bonnet and boot
  const [cabinH, cabinL, cabinZ] = s.cabin;
  const axle = L * 0.31;        // how far each axle is from the middle

  // The body: one long rounded shell, a black sill underneath, and dark wheel arches.
  part(paint, W, s.body, L, 0, s.ride + s.body / 2, 0, 0.14);
  part(black, W - 0.12, 0.16, L - 0.5, 0, s.ride + 0.02, 0, 0.04);
  for (const wz of [axle, -axle]) part(black, W + 0.02, s.wheel * 1.5, s.wheel * 2.5, 0, s.wheel * 0.95, wz, 0.12);

  // The cabin: roof and pillars in the body colour, glass all round.
  part(paint, W - 0.24, cabinH, cabinL, 0, deck + cabinH / 2 - 0.04, cabinZ, 0.16);
  const screen = part(glass, W - 0.42, cabinH * 0.9, 0.05, 0, deck + cabinH / 2 - 0.02, cabinZ + cabinL / 2 - 0.05, 0.02);
  screen.rotation.x = -0.45;
  const rear = part(glass, W - 0.42, cabinH * 0.85, 0.05, 0, deck + cabinH / 2 - 0.02, cabinZ - cabinL / 2 + 0.05, 0.02);
  rear.rotation.x = 0.5;
  for (const side of [-1, 1]) {
    part(glass, 0.04, cabinH * 0.62, cabinL * 0.78, side * (W / 2 - 0.115), deck + cabinH / 2, cabinZ, 0.02);
    part(paint, 0.05, cabinH * 0.7, 0.07, side * (W / 2 - 0.11), deck + cabinH / 2 - 0.02, cabinZ - 0.05, 0);   // the pillar between the doors
    part(paint, 0.1, 0.1, 0.18, side * (W / 2 + 0.05), deck + 0.1, cabinZ + cabinL / 2 - 0.15, 0.03);            // wing mirror
    part(chrome, 0.03, 0.03, 0.14, side * (W / 2 + 0.005), deck - 0.12, cabinZ + 0.35, 0);                       // door handles
    part(chrome, 0.03, 0.03, 0.14, side * (W / 2 + 0.005), deck - 0.12, cabinZ - 0.55, 0);
    part(black, 0.012, s.body * 0.8, 0.012, side * (W / 2 + 0.002), s.ride + s.body / 2, cabinZ - 0.05, 0);      // the gap between the doors
    part(lamp, 0.34, 0.13, 0.06, side * (W / 2 - 0.3), deck - 0.16, half - 0.01, 0.03);                          // headlights
    part(tail, 0.36, 0.11, 0.06, side * (W / 2 - 0.3), deck - 0.14, -half + 0.01, 0.03);                         // tail lights
  }
  // Grille, bumpers, number plates and the exhaust.
  part(black, W * 0.5, 0.16, 0.05, 0, deck - 0.2, half, 0.02);
  part(style === 'jeep' || style === 'muscle' ? chrome : black, W + 0.04, 0.16, 0.2, 0, s.ride + 0.1, half - 0.02, 0.06);
  part(style === 'jeep' || style === 'muscle' ? chrome : black, W + 0.04, 0.16, 0.2, 0, s.ride + 0.1, -half + 0.02, 0.06);
  part(new THREE.MeshBasicMaterial({ color: 0xf2f0e6 }), 0.34, 0.15, 0.02, 0, s.ride + 0.12, half + 0.09, 0);
  part(new THREE.MeshBasicMaterial({ color: 0xf2f0e6 }), 0.34, 0.15, 0.02, 0, s.ride + 0.12, -half - 0.09, 0);
  part(chrome, 0.08, 0.08, 0.3, W / 2 - 0.4, s.ride, -half + 0.1, 0.03);

  // What makes each kind different.
  if (style === 'taxi') {
    part(new THREE.MeshBasicMaterial({ color: 0xfff3a0 }), 0.5, 0.16, 0.2, 0, deck + cabinH + 0.04, cabinZ + 0.2, 0.04); // the light on the roof
    for (const side of [-1, 1]) for (let i = 0; i < 9; i++) part(i % 2 ? black : new THREE.MeshBasicMaterial({ color: 0xf2f0e6 }), 0.012, 0.09, 0.2, side * (W / 2 + 0.004), s.ride + s.body * 0.62, -0.8 + i * 0.2, 0);
  } else if (style === 'sports') {
    part(black, W - 0.2, 0.04, 0.3, 0, deck + 0.2, -half + 0.2, 0.01);                                          // spoiler
    for (const side of [-1, 1]) part(black, 0.05, 0.2, 0.05, side * (W / 2 - 0.3), deck + 0.1, -half + 0.2, 0);
    part(black, 0.5, 0.05, 0.6, 0, deck + 0.01, half - 0.8, 0.02);                                              // air scoop
  } else if (style === 'muscle') {
    for (const side of [-0.28, 0.28]) part(black, 0.26, 0.012, L - 0.1, side, deck + 0.003, 0, 0);              // racing stripes
    part(chrome, 0.5, 0.14, 0.5, 0, deck + 0.06, half - 0.9, 0.04);                                             // the blower through the bonnet
  } else if (style === 'jeep') {
    for (const side of [-1, 1]) part(black, 0.05, 0.05, cabinL - 0.3, side * (W / 2 - 0.3), deck + cabinH + 0.02, cabinZ, 0); // roof rails
    const spare = new THREE.Mesh(new THREE.CylinderGeometry(s.wheel, s.wheel, 0.26, 20), rubber);                 // the spare wheel on the back
    spare.rotation.x = Math.PI / 2;
    spare.position.set(0, deck + 0.05, -half - 0.14);
    group.add(spare);
    for (const side of [-0.4, 0.4]) part(black, 0.06, 0.5, 0.06, side, s.ride + 0.3, half + 0.12, 0.02);        // bull bar
    part(black, 0.9, 0.06, 0.06, 0, s.ride + 0.5, half + 0.12, 0.02);
  }

  // Wheels: the front pair turn to steer.
  const spinners = [], steerers = [];
  for (const [wx, wz, front] of [[1, axle, true], [-1, axle, true], [1, -axle, false], [-1, -axle, false]]) {
    const pivot = new THREE.Group();
    pivot.position.set(wx * (W / 2 - 0.12), s.wheel, wz);
    const wheel = new THREE.Group();
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(s.wheel, s.wheel, 0.26, 22), rubber);
    tyre.rotation.z = Math.PI / 2;
    tyre.castShadow = true;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(s.wheel * 0.6, s.wheel * 0.6, 0.27, 18), chrome);
    hub.rotation.z = Math.PI / 2;
    wheel.add(tyre, hub);
    for (let spoke = 0; spoke < 5; spoke++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.045, s.wheel * 1.1), black);
      bar.rotation.x = spoke * Math.PI / 5;
      wheel.add(bar);
    }
    pivot.add(wheel);
    group.add(pivot);
    spinners.push(wheel);
    if (front) steerers.push(pivot);
  }
  return { group, spinners, steerers, speed: 0, steer: 0, engine: null, topSpeed: s.top, size: { hw: W / 2, hl: L / 2, deck } };
}

// Builds every parked car. Each can be driven exactly like the truck.
export function createCars(scene, renderer) {
  return PARKED.map(([style, name, colour, x, z, heading]) => {
    const car = buildCar(renderer, style, colour);
    car.group.position.set(x, floorAt(new THREE.Vector3(x, 0, z)), z);
    car.group.rotation.y = heading;
    scene.add(car.group);
    return Object.assign(car, { heading, name, stolen: false });
  });
}
