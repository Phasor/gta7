// Solid things in the world (walls, tree trunks) that people can't walk
// through and bullets can't pass. Each one is an upright box.
export const obstacles = []; // { minX, maxX, minZ, maxZ, height }

export function addObstacle(minX, maxX, minZ, maxZ, height) {
  const obstacle = { minX, maxX, minZ, maxZ, height };
  obstacles.push(obstacle);
  return obstacle; // so a door can make itself passable later by setting its height to 0
}

// If a person of the given radius standing at `position` overlaps anything
// solid, slide them out the nearest side.
export function pushOut(position, radius) {
  for (const o of obstacles) {
    if (position.y >= o.height) continue;
    const left = position.x - (o.minX - radius), right = (o.maxX + radius) - position.x;
    const back = position.z - (o.minZ - radius), front = (o.maxZ + radius) - position.z;
    if (left <= 0 || right <= 0 || back <= 0 || front <= 0) continue; // not touching
    const nearest = Math.min(left, right, back, front);
    if (nearest === left) position.x = o.minX - radius;
    else if (nearest === right) position.x = o.maxX + radius;
    else if (nearest === back) position.z = o.minZ - radius;
    else position.z = o.maxZ + radius;
  }
}

// How far a bullet travelling from `origin` along `direction` gets before it
// hits something solid, or `maxDistance` if nothing is in the way.
export function rayToObstacle(origin, direction, maxDistance) {
  let nearest = maxDistance;
  for (const o of obstacles) {
    let enter = 0, exit = nearest;
    const slabs = [
      [origin.x, direction.x, o.minX, o.maxX],
      [origin.y, direction.y, 0, o.height],
      [origin.z, direction.z, o.minZ, o.maxZ],
    ];
    for (const [start, speed, low, high] of slabs) {
      if (Math.abs(speed) < 1e-8) {
        if (start < low || start > high) { enter = Infinity; break; }
        continue;
      }
      const a = (low - start) / speed, b = (high - start) / speed;
      enter = Math.max(enter, Math.min(a, b));
      exit = Math.min(exit, Math.max(a, b));
    }
    if (enter <= exit && enter > 0 && enter < nearest) nearest = enter;
  }
  return nearest;
}

// Raised floors (a house's concrete base, a porch): people stand on these
// instead of on the ground.
const floors = []; // { minX, maxX, minZ, maxZ, height }
export function addFloor(minX, maxX, minZ, maxZ, height) {
  floors.push({ minX, maxX, minZ, maxZ, height });
}
export function floorAt(position) {
  let height = 0;
  for (const f of floors) {
    if (position.x > f.minX && position.x < f.maxX && position.z > f.minZ && position.z < f.maxZ) height = Math.max(height, f.height);
  }
  return height;
}

// Indoor spaces: while the player is in one, the camera stays under its ceiling.
const interiors = []; // { minX, maxX, minZ, maxZ, ceiling }
export function addInterior(minX, maxX, minZ, maxZ, ceiling) {
  interiors.push({ minX, maxX, minZ, maxZ, ceiling });
}
export function ceilingAt(position) {
  for (const i of interiors) {
    if (position.x > i.minX && position.x < i.maxX && position.z > i.minZ && position.z < i.maxZ) return i.ceiling;
  }
  return Infinity;
}

// How far a camera can back away from `origin` along `direction` before it
// would leave the room that `position` is in (so it never ends up outside
// looking in through an open doorway). Returns `maxDistance` when outdoors.
export function roomLimit(position, origin, direction, maxDistance) {
  for (const i of interiors) {
    if (!(position.x > i.minX && position.x < i.maxX && position.z > i.minZ && position.z < i.maxZ)) continue;
    const margin = 0.2;
    let limit = maxDistance;
    for (const [start, speed, low, high] of [[origin.x, direction.x, i.minX, i.maxX], [origin.z, direction.z, i.minZ, i.maxZ]]) {
      if (speed > 1e-6) limit = Math.min(limit, (high - margin - start) / speed);
      if (speed < -1e-6) limit = Math.min(limit, (low + margin - start) / speed);
    }
    return Math.max(0, limit);
  }
  return maxDistance;
}
