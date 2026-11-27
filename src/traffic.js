// Traffic on the main road. A handful of cars drive both ways, keeping to the
// right. They are only ever near the player: one that falls far behind is taken
// away and brought back somewhere ahead, out of sight. They slow down and stop
// for people, parked cars and each other, and hoot if they are held up.
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
