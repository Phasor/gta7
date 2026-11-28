// Traffic on the main road. A handful of cars drive both ways, keeping to the
// right. They are only ever near the player: one that falls far behind is taken
// away and brought back somewhere ahead, out of sight. They slow down and stop
// for people, parked cars and each other, and hoot if they are held up.
import * as THREE from 'three';
import { buildCar } from './cars.js';

const LANES = { 1: -3.0, [-1]: -6.0 };            // heading +X keeps to the far lane, heading -X to the near one
const ROAD_FROM = -330, ROAD_TO = 915;            // the stretch of road they use
const KINDS = [['saloon', 'grey saloon', 0x8f9396], ['saloon', 'red saloon', 0xa8281e], ['taxi', 'taxi', 0xf2c21e], ['jeep', 'green 4x4', 0x2f5a3a], ['saloon', 'black saloon', 0x1b1c1e],
  ['muscle', 'blue muscle car', 0x2456c9], ['saloon', 'silver saloon', 0xc9ccd0], ['sports', 'white sports car', 0xf2f0ea], ['taxi', 'taxi', 0xf2c21e], ['jeep', 'white 4x4', 0xeeeeea]];

export function createTraffic(scene, renderer, count = 8) {
  const traffic = [];
  let made = 0;
  // One more car for the pool (also used to replace one the player has stolen).
  traffic.add = () => {
    const [style, name, colour] = KINDS[made++ % KINDS.length];
    const car = Object.assign(buildCar(renderer, style, colour), { name, active: false, retry: Math.random() * 3, dir: 1, wait: 0, stun: 0, cruise: 10, traffic: true });
    car.group.visible = false;
    scene.add(car.group);
    traffic.push(car);
    return car;
  };
  for (let i = 0; i < count; i++) traffic.add();
  return traffic;
}

// view: where the player is and which way the camera looks { x, z, cx, cz, fx, fz }.
// blockers: things in the road to stop for: [{ x, z, r }].
// onHoot(car): called when a held-up driver sounds the horn.
export function updateTraffic(traffic, dt, view, blockers, onHoot) {
  const nearRoad = Math.abs(view.z + 4.5) < 130;
  for (const car of traffic) {
    const position = car.group.position;
    if (!car.active) {
      // Waiting to be put on the road: somewhere 100 m or more off, behind the camera or a speck ahead.
      car.retry -= dt;
      if (car.retry > 0 || !nearRoad) continue;
      car.retry = 0.8 + Math.random() * 1.5;
      const dir = Math.random() < 0.5 ? 1 : -1, x = view.x + (Math.random() < 0.5 ? -1 : 1) * (105 + Math.random() * 35);
      if (x < ROAD_FROM || x > ROAD_TO) continue;
      if (traffic.some((other) => other.active && other.dir === dir && Math.abs(other.group.position.x - x) < 16)) continue;
      const dx = x - view.cx, dz = LANES[dir] - view.cz, distance = Math.hypot(dx, dz);
      if ((dx * view.fx + dz * view.fz) / distance > 0.25 && distance < 118) continue; // he would see it appear
      Object.assign(car, { active: true, dir, speed: 9, cruise: 9 + Math.random() * 4, wait: 0, stun: 0 });
      position.set(x, 0, LANES[dir]);
      car.group.rotation.set(0, dir > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
      car.group.visible = true;
      continue;
    }
    // Left far behind, or at the end of the road: off it goes.
    if (Math.abs(position.x - view.x) > 160 || position.x < ROAD_FROM - 5 || position.x > ROAD_TO + 5) {
      car.active = false;
      car.group.visible = false;
      car.retry = 1 + Math.random() * 2;
      continue;
    }
    // How much clear road is ahead in this lane?
    let gap = 60;
    const ahead = (x, z, radius) => {
      const along = (x - position.x) * car.dir;
      if (along > 0.5 && along < gap + radius && Math.abs(z - position.z) < 1.25 + radius) gap = Math.max(0, along - radius);
    };
    for (const blocker of blockers) ahead(blocker.x, blocker.z, blocker.r);
    for (const other of traffic) if (other !== car && other.active && other.dir === car.dir) ahead(other.group.position.x, other.group.position.z, 2.3);
    car.stun = Math.max(0, car.stun - dt);
    const want = car.stun > 0 ? 0 : gap < 4.5 ? 0 : Math.min(car.cruise, (gap - 4.5) * 1.1);
    car.speed += Math.max(-16 * dt, Math.min(4.5 * dt, want - car.speed));
    car.speed = Math.max(0, car.speed);
    position.x += car.dir * car.speed * dt;
    for (const wheel of car.spinners) wheel.rotation.x += car.speed * dt / 0.34;
    // Held up for a while: the horn.
    car.wait = car.speed < 0.5 && car.stun <= 0 ? car.wait + dt : 0;
    if (car.wait > 2.2) { car.wait = -2.5 - Math.random() * 3; onHoot?.(car); }
  }
}

// --- Jamaica's road ---------------------------------------------------------------------------------------
// Cars and motorbikes drive back and forth along the island's one road, from Kingston out to the
// airstrip, keeping to the right and turning round at each end. They stop for anybody in the way.

// A motorbike with its rider. Faces +Z.
function buildBike(colour) {
  const group = new THREE.Group();
  const mat = (color, roughness = 0.5, metalness = 0.3) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const paint = mat(colour, 0.35), black = mat(0x151617, 0.8, 0), chrome = mat(0xc9ccd0, 0.2, 0.9), skin = mat(0x6a4630, 0.8, 0), cloth = mat(0xf2f0e6, 0.9, 0), jeans = mat(0x2f4a6a, 0.9, 0);
  const part = (geometry, material, x, y, z, rx = 0, rz = 0) => { const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.rotation.set(rx, 0, rz); mesh.castShadow = true; group.add(mesh); return mesh; };
  const spinners = [0.68, -0.62].map((z) => {
    const wheel = new THREE.Group();
    wheel.position.set(0, 0.31, z);
    const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.07, 8, 18), black);
    tyre.rotation.y = Math.PI / 2;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 10), chrome);
    hub.rotation.z = Math.PI / 2;
    wheel.add(tyre, hub);
    group.add(wheel);
    return wheel;
  });
  part(new THREE.BoxGeometry(0.16, 0.2, 0.75), black, 0, 0.5, 0.02);                      // engine and frame
  part(new THREE.BoxGeometry(0.24, 0.2, 0.42), paint, 0, 0.76, 0.2);                      // tank
  part(new THREE.BoxGeometry(0.22, 0.09, 0.55), black, 0, 0.74, -0.3);                    // seat
  part(new THREE.BoxGeometry(0.2, 0.06, 0.3), paint, 0, 0.62, -0.62, 0.2);                // rear mudguard
  part(new THREE.CylinderGeometry(0.025, 0.025, 0.6, 6), chrome, 0, 0.6, 0.62, -0.42);    // front forks
  part(new THREE.CylinderGeometry(0.02, 0.02, 0.56, 6), chrome, 0, 0.95, 0.5, 0, Math.PI / 2); // handlebars
  part(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff6d8 }), 0, 0.84, 0.66); // headlamp
  part(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), chrome, 0.12, 0.38, -0.4, Math.PI / 2); // exhaust
  return { group, spinners, wheel: 0.31 };
}

export function createIslandTraffic(scene, renderer, path) {
  const legs = [];
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const [x0, z0] = path[i], [x1, z1] = path[i + 1], length = Math.hypot(x1 - x0, z1 - z0);
    legs.push({ x0, z0, dx: (x1 - x0) / length, dz: (z1 - z0) / length, from: total, length });
    total += length;
  }
  const MAKES = [['saloon', 0xf2c230], ['bike', 0xd9281e], ['jeep', 0x2fa85a], ['bike', 0x111111], ['taxi', 0xf2f0e6], ['bike', 0x3fa0e0], ['saloon', 0xa8281e]];
  const make = ([style, colour], i) => {
    const made = style === 'bike' ? buildBike(colour) : buildCar(renderer, style, colour);
    made.group.visible = false;
    scene.add(made.group);
    return { ...made, style, colour, bike: style === 'bike', s: (i + 0.5) / MAKES.length * total, dir: i % 2 ? 1 : -1, speed: 0, cruise: style === 'bike' ? 13 : 9 + (i % 3), heading: 0 };
  };
  const list = MAKES.map(make);
  let made = MAKES.length;
  // When one is stolen, another just like it drives in from whichever end of the road is further from (x, z).
  list.add = (like, x, z) => {
    const one = make([like.style, like.colour], made++), last = legs[legs.length - 1];
    const fromStart = Math.hypot(legs[0].x0 - x, legs[0].z0 - z) > Math.hypot(last.x0 + last.dx * last.length - x, last.z0 + last.dz * last.length - z);
    Object.assign(one, { s: fromStart ? 4 : total - 4, dir: fromStart ? 1 : -1 });
    list.push(one);
    return one;
  };
  return Object.assign(list, { legs, total });
}

// blockers: people in the road to stop for: [{ x, z }]. active: only worked out while the player is on or near Jamaica.
export function updateIslandTraffic(list, dt, blockers, active) {
  for (const one of list) {
    one.group.visible = active;
    if (!active) continue;
    const leg = list.legs.findLast((part) => one.s >= part.from) || list.legs[0];
    const along = Math.min(leg.length, one.s - leg.from), dx = leg.dx * one.dir, dz = leg.dz * one.dir;
    const x = leg.x0 + leg.dx * along - dz * 1.7, z = leg.z0 + leg.dz * along + dx * 1.7; // keeping to the right
    // Anything ahead in this lane?
    let gap = 40;
    for (const blocker of blockers) {
      const bx = blocker.x - x, bz = blocker.z - z, ahead = bx * dx + bz * dz;
      if (ahead > 0.3 && ahead < Math.min(gap, 11) && Math.abs(bx * dz - bz * dx) < 1.5) gap = ahead; // (they only see what is close: step out late and they cannot stop)
    }
    for (const other of list) if (other !== one && other.dir === one.dir) { const ahead = (other.s - one.s) * one.dir; if (ahead > 0 && ahead < gap) gap = ahead - 2.5; }
    const nearCorner = Math.min(along, leg.length - along) < 7 ? 0.5 : 1;        // slow for the bends
    one.stun = Math.max(0, (one.stun || 0) - dt);                                  // (stopped for a moment after hitting somebody)
    const want = gap < 4.5 || one.stun > 0 ? 0 : Math.min(one.cruise * nearCorner, (gap - 4.5) * 1.2);
    one.speed = Math.max(0, one.speed + Math.max(-18 * dt, Math.min(5 * dt, want - one.speed)));
    one.s += one.dir * one.speed * dt;
    if (one.s >= list.total - 3 || one.s <= 3) { one.dir = -one.dir; one.s = Math.min(list.total - 3.01, Math.max(3.01, one.s)); } // the end of the road: round it turns
    let turn = Math.atan2(dx, dz) - one.heading;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    one.heading += turn * Math.min(1, 4 * dt);
    one.group.position.set(x, 0.72, z);
    one.group.rotation.set(0, one.heading, one.bike ? -turn * 0.6 : 0);          // a bike leans into the bend
    for (const wheel of one.spinners) wheel.rotation.x += one.speed * dt / (one.wheel || 0.34);
  }
}
