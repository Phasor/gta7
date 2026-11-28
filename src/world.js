// The wind: how hard it is blowing (0 to 1) and a clock for its gusts. Shared by everything that bends in it.
export const wind = { strength: { value: 0 }, time: { value: 0 } };
export const WIND_WAY = [-0.89, 0.45];  // the way it blows, along x and z
export const BEND = 0.012;              // how far a tree leans: this times the wind, times the square of the height
// Make whatever is drawn with this material lean and sway in the wind: the higher up, the further over.
export function bendInWind(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.windStrength = wind.strength;
    shader.uniforms.windTime = wind.time;
    shader.vertexShader = 'uniform float windStrength;\nuniform float windTime;\n' + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        mat4 windFrame = modelMatrix * instanceMatrix;
      #else
        mat4 windFrame = modelMatrix;
      #endif
      float windHeight = max(transformed.y, 0.0);
      float windLean = windStrength * windHeight * windHeight * ${BEND} * (0.75 + 0.25 * sin(windTime * 2.0 + windFrame[3].x));
      transformed += inverse(mat3(windFrame)) * vec3(${WIND_WAY[0]}, 0.0, ${WIND_WAY[1]}) * windLean * length(windFrame[1].xyz);
      transformed.y -= windLean * 0.12;`);
  };
  material.customProgramCacheKey = () => 'bends-in-wind';
  return material;
}

// Solid things in the world (walls, tree trunks) that people can't walk
// through and bullets can't pass. Each one is an upright box.
export const obstacles = []; // { minX, maxX, minZ, maxZ, height }

// base: how high up it starts (for walls and furniture on an upper floor). Usually the ground.
export function addObstacle(minX, maxX, minZ, maxZ, height, base = -Infinity) {
  const obstacle = { minX, maxX, minZ, maxZ, height, base };
  obstacles.push(obstacle);
  return obstacle; // so a door can make itself passable later by setting its height to 0
}

// If a person of the given radius standing at `position` overlaps anything
// solid, slide them out the nearest side.
// canSwim: true for the player, who is allowed to wade and swim into the lake.
export function pushOut(position, radius, canSwim = false) {
  for (const o of obstacles) {
    if (position.y >= o.height || position.y < o.base) continue; // above it, or on a floor below it
    const left = position.x - (o.minX - radius), right = (o.maxX + radius) - position.x;
    const back = position.z - (o.minZ - radius), front = (o.maxZ + radius) - position.z;
    if (left <= 0 || right <= 0 || back <= 0 || front <= 0) continue; // not touching
    const nearest = Math.min(left, right, back, front);
    if (nearest === left) position.x = o.minX - radius;
    else if (nearest === right) position.x = o.maxX + radius;
    else if (nearest === back) position.z = o.minZ - radius;
    else position.z = o.maxZ + radius;
  }

  // NPCs, animals and the truck stay out of the lake: anything of theirs that
  // strays past the bank is put back on it. The jetty is the exception.
  // ...and out of the sea.
  // (islanders stay on their island: only people near the mainland shore are kept out of the sea)
  if (sea.active && !canSwim && position.x > sea.x - radius && position.x < sea.x + 300) position.x = sea.x - radius;

  if (water.active && !canSwim) {
    const dx = position.x - water.x, dz = position.z - water.z, dist = Math.hypot(dx, dz) || 1;
    if (dist < water.radius * 1.35) {
      const bank = shoreRadius(Math.atan2(dz, dx)) + radius * 0.5;
      const onJetty = water.docks.some((d) => position.x > d.minX && position.x < d.maxX && position.z > d.minZ && position.z < d.maxZ);
      if (dist < bank && !onJetty) {
        position.x = water.x + dx / dist * bank;
        position.z = water.z + dz / dist * bank;
      }
    }
  }
}

// How far east anyone can go: the open sea runs a long way out, to the island of Jamaica.
export const EAST_EDGE = 3440;

// The sea, if there is one: everything beyond x is water. docks are piers you can walk out on.
export const sea = { active: false, x: 0, docks: [], lands: [] }; // lands: islands out at sea, as functions giving the depth of water at a place (0 on dry land), or undefined away from them

// The lake, if there is one: its centre, rough radius, and the jetties you may walk out on.
export const water = { active: false, x: 0, z: 0, radius: 0, docks: [] };
// How far the bank is from the lake's centre in a given direction (the outline is a wobbly circle).
export function shoreRadius(angle) {
  return water.radius * (1 + 0.18 * Math.sin(3 * angle + 1) + 0.1 * Math.sin(5 * angle));
}

// How far a bullet travelling from `origin` along `direction` gets before it
// hits something solid, or `maxDistance` if nothing is in the way.
export function rayToObstacle(origin, direction, maxDistance) {
  let nearest = maxDistance;
  for (const o of obstacles) {
    let enter = 0, exit = nearest;
    const slabs = [
      [origin.x, direction.x, o.minX, o.maxX],
      [origin.y, direction.y, Math.max(0, o.base), o.height],
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
  const floor = { minX, maxX, minZ, maxZ, height };
  floors.push(floor);
  return floor;
}
// Ground that rises and falls (the hills of Jamaica): functions giving its height at a place, or -Infinity where there is none.
const terrains = [];
export function addTerrain(heightAt) {
  terrains.push(heightAt);
}
export function terrainAt(x, z) {
  let height = -Infinity;
  for (const heightAt of terrains) height = Math.max(height, heightAt(x, z));
  return height;
}
export function floorAt(position) {
  let height = Math.max(0, terrainAt(position.x, position.z));
  for (const f of floors) {
    // Only floors he could step onto from where he is: a rooftop far overhead doesn't count.
    if (f.height <= position.y + 0.7 && position.x > f.minX && position.x < f.maxX && position.z > f.minZ && position.z < f.maxZ) height = Math.max(height, f.height);
  }
  return height;
}

// Indoor spaces: while the player is in one, the camera stays under its ceiling.
const interiors = []; // { minX, maxX, minZ, maxZ, ceiling }
// floor: the height of the room's floor, for rooms that are upstairs.
export function addInterior(minX, maxX, minZ, maxZ, ceiling, floor = -Infinity) {
  const interior = { minX, maxX, minZ, maxZ, ceiling, floor };
  interiors.push(interior);
  return interior;
}
export function ceilingAt(position) {
  for (const i of interiors) {
    if (position.y < i.ceiling && position.y > i.floor - 0.6 && position.x > i.minX && position.x < i.maxX && position.z > i.minZ && position.z < i.maxZ) return i.ceiling;
  }
  return Infinity;
}

// How far a camera can back away from `origin` along `direction` before it
// would leave the room that `position` is in (so it never ends up outside
// looking in through an open doorway). Returns `maxDistance` when outdoors.
export function roomLimit(position, origin, direction, maxDistance) {
  for (const i of interiors) {
    if (!(position.y < i.ceiling && position.y > i.floor - 0.6 && position.x > i.minX && position.x < i.maxX && position.z > i.minZ && position.z < i.maxZ)) continue;
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

// How far down the sea bed is at a spot (0 on land). It shelves away from the beach to nine metres, so there is room to dive.
export function seaBedAt(position) {
  return sea.active && position.x > sea.x ? Math.min(9, (position.x - sea.x) * 0.12) : 0;
}

// How deep the lake is at a spot: 0 on land or on a jetty, getting deeper away from the bank.
export function waterDepthAt(position) {
  if (sea.active && position.x > sea.x) { // the sea shelves gently away from the beach
    for (const land of sea.lands) { const depth = land(position.x, position.z); if (depth !== undefined) return depth; }
    if (sea.docks.some((d) => position.x > d.minX && position.x < d.maxX && position.z > d.minZ && position.z < d.maxZ)) return 0;
    return Math.min(2, (position.x - sea.x) * 0.12);
  }
  if (!water.active) return 0;
  const dx = position.x - water.x, dz = position.z - water.z, dist = Math.hypot(dx, dz);
  const bank = shoreRadius(Math.atan2(dz, dx));
  if (dist >= bank) return 0;
  if (water.docks.some((d) => position.x > d.minX && position.x < d.maxX && position.z > d.minZ && position.z < d.maxZ)) return 0;
  return Math.min(2, (bank - dist) * 0.3);
}
