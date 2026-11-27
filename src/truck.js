// A pickup truck you can drive: a big American-style pickup with a long
// bonnet, a two-door cab, an open load bed, chrome bumpers and chunky tyres.
// The model, the driving and the engine sound are all made in code.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { pushOut, floorAt } from './world.js';

const WHEEL_RADIUS = 0.42;
const WHEELBASE = 3.4;        // distance between the front and back axles
const TOP_SPEED = 27;         // metres per second, about 60 mph
const REVERSE_SPEED = 7;

// Builds the truck at (x, z) pointing along `heading` (0 faces +Z).
export function createTruck(scene, renderer, x, z, heading) {
  // Shiny paint and chrome need surroundings to reflect.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const reflections = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  const shiny = (color, roughness, metalness, intensity = 0.7) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, envMap: reflections, envMapIntensity: intensity });

  const paint = shiny(0xa8231c, 0.28, 0.35);           // deep red
  const chrome = shiny(0xdfe2e4, 0.12, 1, 1.1);
  const glass = shiny(0x10161a, 0.05, 0.6, 1.2);
  const black = new THREE.MeshStandardMaterial({ color: 0x151617, roughness: 0.85 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x1b1b1c, roughness: 0.95 });
  const lamp = new THREE.MeshBasicMaterial({ color: 0xfff6d8 });
  const tail = new THREE.MeshBasicMaterial({ color: 0xd0201a });
  const plate = new THREE.MeshBasicMaterial({ color: 0xf2f0e6 });

  const group = new THREE.Group();
  group.rotation.order = 'YXZ';
  const part = (material, w, h, d, px, py, pz, round = 0.05, parent = group) => {
    const geometry = round ? new RoundedBoxGeometry(w, h, d, 3, Math.min(round, Math.min(w, h, d) * 0.45)) : new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(px, py, pz);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // Chassis and wheel wells.
  part(black, 1.7, 0.28, 5.2, 0, 0.52, 0, 0);
  for (const wz of [1.75, -1.65]) part(black, 2.0, 0.62, 1.12, 0, 0.66, wz, 0.12);

  // Bonnet, front wings, grille, headlights and bumper.
  part(paint, 1.98, 0.42, 1.6, 0, 0.8, 1.9, 0.08);
  part(paint, 1.9, 0.36, 1.58, 0, 1.08, 1.88, 0.12);
  part(paint, 0.7, 0.06, 1.2, 0, 1.27, 1.8, 0.03);          // raised centre of the bonnet
  part(chrome, 1.5, 0.44, 0.08, 0, 0.98, 2.68, 0.03);
  part(black, 1.36, 0.32, 0.09, 0, 0.98, 2.685, 0.02);
  for (const gy of [0.9, 0.98, 1.06]) part(chrome, 1.36, 0.025, 0.1, 0, gy, 2.69, 0);
  for (const side of [-1, 1]) {
    part(lamp, 0.26, 0.2, 0.06, side * 0.83, 1.02, 2.67, 0.03);
    part(chrome, 0.3, 0.24, 0.05, side * 0.83, 1.02, 2.655, 0.03);
    part(new THREE.MeshBasicMaterial({ color: 0xf0a020 }), 0.26, 0.07, 0.06, side * 0.83, 0.85, 2.67, 0.02); // indicators
  }
  part(chrome, 2.06, 0.2, 0.26, 0, 0.55, 2.74, 0.06);
  part(black, 0.5, 0.1, 0.05, 0, 0.55, 2.88, 0);

  // Cab: doors, roof, windows, mirrors and handles.
  part(paint, 1.98, 0.78, 1.95, 0, 0.94, 0.15, 0.08);
  part(paint, 1.78, 0.62, 1.5, 0, 1.6, 0.0, 0.14);
  const windscreen = part(glass, 1.58, 0.52, 0.05, 0, 1.58, 0.76, 0.02);
  windscreen.rotation.x = -0.3;
  part(glass, 1.5, 0.4, 0.04, 0, 1.62, -0.745, 0.02);
  for (const side of [-1, 1]) {
    part(glass, 0.04, 0.4, 1.12, side * 0.885, 1.62, 0.0, 0.02);
    part(paint, 0.1, 0.14, 0.2, side * 1.06, 1.38, 0.72, 0.04);     // mirror
    part(chrome, 0.03, 0.04, 0.16, side * 0.995, 1.2, -0.25, 0);    // door handle
    part(black, 0.012, 0.74, 0.012, side * 0.992, 0.95, -0.72, 0);  // door edges
    part(black, 0.012, 0.74, 0.012, side * 0.992, 0.95, 1.0, 0);
    part(chrome, 0.02, 0.03, 4.9, side * 0.995, 0.78, -0.1, 0);     // chrome strip along the side
    part(black, 0.3, 0.06, 1.7, side * 0.95, 0.42, 0.15, 0.02);     // step under the door
  }

  // Load bed: sides, tailgate, dark liner, tail lights, rear bumper and number plate.
  part(paint, 1.98, 0.36, 2.02, 0, 0.71, -1.8, 0.06);
  for (const side of [-1, 1]) {
    part(paint, 0.12, 0.46, 2.02, side * 0.93, 1.1, -1.8, 0.04);
    part(tail, 0.14, 0.3, 0.06, side * 0.9, 1.08, -2.82, 0.02);
  }
  part(paint, 1.98, 0.46, 0.1, 0, 1.1, -2.77, 0.04);
  part(paint, 1.74, 0.46, 0.08, 0, 1.1, -0.84, 0.03);
  part(black, 1.74, 0.03, 1.86, 0, 0.9, -1.8, 0);
  part(chrome, 0.5, 0.05, 0.02, 0, 1.2, -2.825, 0);          // tailgate handle
  part(chrome, 2.06, 0.18, 0.24, 0, 0.55, -2.86, 0.06);
  part(plate, 0.32, 0.16, 0.02, 0, 0.56, -2.99, 0);
  part(black, 0.08, 0.08, 0.5, 0.6, 0.38, -2.7, 0.03);       // exhaust

  // Wheels: tyre, chrome hub and five spokes. The front pair turn to steer.
  const spinners = [], steerers = [];
  for (const [wx, wz, front] of [[0.92, 1.75, true], [-0.92, 1.75, true], [0.92, -1.65, false], [-0.92, -1.65, false]]) {
    const pivot = new THREE.Group();
    pivot.position.set(wx, WHEEL_RADIUS, wz);
    const wheel = new THREE.Group();
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.3, 24), rubber);
    tyre.rotation.z = Math.PI / 2;
    tyre.castShadow = true;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.31, 20), chrome);
    hub.rotation.z = Math.PI / 2;
    wheel.add(tyre, hub);
    for (let spoke = 0; spoke < 5; spoke++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.44), black);
      bar.rotation.x = spoke * Math.PI / 5;
      wheel.add(bar);
    }
    pivot.add(wheel);
    group.add(pivot);
    spinners.push(wheel);
    if (front) steerers.push(pivot);
  }

  group.position.set(x, floorAt(new THREE.Vector3(x, 0, z)), z);
  group.rotation.y = heading;
  scene.add(group);
  return { group, spinners, steerers, heading, speed: 0, steer: 0, engine: null };
}

const probe = new THREE.Vector3(), pushed = new THREE.Vector3();

// input: { throttle: -1..1, steer: -1 (right) .. 1 (left), handbrake }
export function updateTruck(truck, input, dt, halfMap) {
  // Speed up, slow down, or coast to a stop.
  const speed = truck.speed, top = truck.topSpeed || TOP_SPEED; // (the cars each have their own top speed)
  if (input.throttle > 0) truck.speed += (speed < -0.2 ? 18 : 9 * (1 - speed / top)) * dt;
  else if (input.throttle < 0) truck.speed -= (speed > 0.5 ? 18 : 5 * (1 + speed / REVERSE_SPEED)) * dt;
  else truck.speed -= Math.sign(speed) * Math.min(Math.abs(speed), (1.5 + Math.abs(speed) * 0.25) * dt);
  if (input.handbrake) truck.speed -= Math.sign(truck.speed) * Math.min(Math.abs(truck.speed), 26 * dt);
  truck.speed = THREE.MathUtils.clamp(truck.speed, -REVERSE_SPEED, top);

  // Steering: the faster it goes, the less the wheels can turn.
  const fullLock = 0.6 / (1 + Math.abs(truck.speed) * 0.09);
  truck.steer += (input.steer * fullLock - truck.steer) * Math.min(1, 6 * dt);
  truck.heading += (truck.speed / WHEELBASE) * Math.tan(truck.steer) * dt;

  const position = truck.group.position;
  const forwardX = Math.sin(truck.heading), forwardZ = Math.cos(truck.heading);
  position.x += forwardX * truck.speed * dt;
  position.z += forwardZ * truck.speed * dt;

  // Bumping into things: check the front, middle and back of the truck, and
  // shove it out of anything solid. Hitting something kills most of the speed.
  let hit = false;
  for (const along of [1.9, 0, -1.9]) {
    probe.set(position.x + forwardX * along, position.y, position.z + forwardZ * along);
    pushed.copy(probe);
    pushOut(pushed, 1.0);
    if (pushed.x !== probe.x || pushed.z !== probe.z) {
      position.x += pushed.x - probe.x;
      position.z += pushed.z - probe.z;
      hit = true;
    }
  }
  if (hit) truck.speed *= Math.max(0, 1 - 7 * dt);
  truck.bump = hit ? Math.abs(speed) : 0; // how fast it was going when it hit something (for dents)

  const limit = halfMap - 3;
  position.x = THREE.MathUtils.clamp(position.x, -limit, limit);
  position.z = THREE.MathUtils.clamp(position.z, -limit, limit);
  position.y += (floorAt(position) - position.y) * Math.min(1, 12 * dt); // up and down kerbs

  truck.group.rotation.y = truck.heading;
  truck.group.rotation.z = -truck.steer * truck.speed * 0.006;          // leans in corners
  for (const pivot of truck.steerers) pivot.rotation.y = truck.steer;
  for (const wheel of truck.spinners) wheel.rotation.x += truck.speed * dt / WHEEL_RADIUS;

  if (truck.engine) { // the engine note rises with speed
    const now = truck.engine.context.currentTime;
    truck.engine.tone.frequency.setTargetAtTime(48 + Math.abs(truck.speed) * 5 + (input.throttle ? 14 : 0), now, 0.1);
    truck.engine.volume.gain.setTargetAtTime(input.throttle ? 0.09 : 0.055, now, 0.15);
  }
}

// Start or stop the engine sound: a low rumbling tone.
export function setEngine(truck, running) {
  try {
    if (running && !truck.engine) {
      const context = new AudioContext();
      const tone = context.createOscillator();
      tone.type = 'sawtooth';
      tone.frequency.value = 48;
      const muffle = context.createBiquadFilter();
      muffle.type = 'lowpass';
      muffle.frequency.value = 320;
      const volume = context.createGain();
      volume.gain.value = 0.055;
      tone.connect(muffle).connect(volume).connect(context.destination);
      tone.start();
      truck.engine = { context, tone, volume };
    } else if (!running && truck.engine) {
      truck.engine.tone.stop();
      truck.engine.context.close();
      truck.engine = null;
    }
  } catch {
    // No sound available: the truck still drives.
  }
}
