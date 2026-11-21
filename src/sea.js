// The sea: past the far end of Palm City the road runs out onto a sandy beach
// and turquoise water that goes on to the horizon. It is beyond the last
// buildings, so nothing in the city is in its way.
// On the beach: palm trees, umbrellas and sun loungers, a lifeguard tower, a
// volleyball net and a wooden pier. You can wade in and swim; sailing boats
// bob further out.
import * as THREE from 'three';
import { sea, addObstacle, addFloor } from './world.js';
import { clearings, daylight } from './grass.js';
import { block, canvasTexture, speckle, makeMaterials, addPalm } from './house.js';
import { label } from './store.js';

const SAND = 0.15;         // the beach stands a little above the grass
const WATER = 0.17;
const PIER = 0.8;          // height of the pier's deck

function seaMaterial(shoreX, fog, sunDirection) {
  return new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      time: { value: 0 },
      daylight,
      shoreX: { value: shoreX },
      sunDir: { value: sunDirection.clone().normalize() },
      hazeColor: { value: fog.color },
      hazeRange: { value: new THREE.Vector2(fog.near, fog.far) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: /* glsl */ `
      uniform float time, daylight, shoreX;
      uniform vec3 sunDir, hazeColor;
      uniform vec2 hazeRange;
      varying vec3 vWorld;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      // Waves: long swells rolling in toward the beach, with smaller chop on top.
      float waves(vec2 p) {
        return sin(p.x * 0.33 + time * 1.3) * 0.45 + sin(p.x * 0.8 + p.y * 0.25 + time * 1.9) * 0.2
             + noise(p * 0.5 + time * 0.25) * 0.5 + noise(p * 2.3 - time * 0.5) * 0.2;
      }

      void main() {
        vec2 p = vWorld.xz;
        float out_ = p.x - shoreX;                       // metres out from the water's edge
        float h = waves(p);
        vec3 normal = normalize(vec3(h - waves(p + vec2(0.25, 0.0)), 1.8, h - waves(p + vec2(0.0, 0.25))));
        vec3 toEye = cameraPosition - vWorld;
        float dist = length(toEye);
        vec3 v = toEye / dist;

        // Clear turquoise in the shallows, deepening to blue further out.
        vec3 col = mix(vec3(0.20, 0.78, 0.74), vec3(0.03, 0.30, 0.52), smoothstep(0.0, 70.0, out_));
        col = mix(col, vec3(0.02, 0.16, 0.36), smoothstep(60.0, 400.0, out_));
        col *= 0.88 + 0.24 * noise(p * 0.12 + time * 0.02);

        // Sky reflected at low angles, and the sun sparkling on the waves.
        float glance = pow(1.0 - max(dot(normal, v), 0.0), 3.0);
        col = mix(col, vec3(0.72, 0.86, 0.95), glance * 0.55);
        col += vec3(1.0, 0.95, 0.8) * pow(max(dot(reflect(-sunDir, normal), v), 0.0), 120.0) * 0.9;

        // White foam: a wobbly line at the water's edge and lines of surf rolling in behind it.
        float edge = 1.0 - smoothstep(0.0, 1.4 + sin(p.y * 0.5 + time) * 0.6, out_);
        float surf = smoothstep(0.62, 0.8, noise(vec2(p.y * 0.35, out_ * 0.7 + time * 0.9))) * (1.0 - smoothstep(2.0, 14.0, out_));
        col = mix(col, vec3(1.0), clamp(edge + surf * 0.8, 0.0, 1.0) * 0.85);

        col *= daylight;
        col = mix(col, hazeColor, smoothstep(hazeRange.x, hazeRange.y, dist));
        gl_FragColor = vec4(col, mix(0.55, 0.96, smoothstep(0.0, 22.0, out_))); // you can see the sand through the shallows
      }`,
  });
}

// A small sailing boat, as scenery out on the water.
function makeSailboat(hullColour, sailColour) {
  const boat = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({ color: hullColour, roughness: 0.5 });
  const sail = new THREE.MeshStandardMaterial({ color: sailColour, roughness: 0.9, side: THREE.DoubleSide });
  block(boat, hull, 2.2, 0.9, 6.5, 0, 0.35, 0);
  block(boat, hull, 1.5, 0.8, 1.6, 0, 0.4, 3.6);
  block(boat, new THREE.MeshStandardMaterial({ color: 0xf2f0e6, roughness: 0.6 }), 1.6, 0.6, 2.2, 0, 1.1, -0.8); // cabin
  block(boat, new THREE.MeshStandardMaterial({ color: 0x8a6240, roughness: 0.7 }), 0.12, 9, 0.12, 0, 5.2, 0.6);   // mast
  const shape = (points) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, sail);
    mesh.castShadow = true;
    boat.add(mesh);
  };
  shape([0, 1.6, 0.5, 0, 9.4, 0.6, 0, 1.6, -3.2]);  // mainsail
  shape([0, 1.4, 0.8, 0, 8.6, 0.7, 0, 1.4, 3.9]);   // jib
  return boat;
}

// Builds the beach and sea. The water's edge is at x = shoreX; the beach lies before it.
export function createSea(scene, shoreX, fog, sunDirection) {
  Object.assign(sea, { active: true, x: shoreX });
  const kit = makeMaterials();
  const group = new THREE.Group();
  const plain = (color, roughness = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  const beachStart = shoreX - 40, beachLength = 700;

  // Sand, running under the water's edge, and no grass anywhere from the beach onward.
  const sand = new THREE.MeshStandardMaterial({ roughness: 1, map: canvasTexture(128, (ctx, s) => {
    ctx.fillStyle = '#e9d6a4';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, 5000, 0.06);
    for (let i = 0; i < 12; i++) { // ripples left by the wind
      ctx.strokeStyle = 'rgba(160,130,80,0.18)';
      ctx.beginPath();
      const y = Math.random() * s;
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(s * 0.3, y + 6, s * 0.6, y - 6, s, y);
      ctx.stroke();
    }
  }, 14, 120) });
  block(group, sand, 62, SAND, beachLength, beachStart + 31, SAND / 2, 0).castShadow = false;
  addFloor(beachStart, shoreX + 22, -beachLength / 2, beachLength / 2, SAND);
  clearings[42].set(beachStart - 0.5, -5000, 9000, 5000);

  // The water.
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2600, 4200), seaMaterial(shoreX, fog, sunDirection));
  water.rotation.x = -Math.PI / 2;
  water.position.set(shoreX + 1300, WATER, 0);
  group.add(water);

  // A promenade wall along the back of the beach, with a gap where the road arrives, and a sign.
  const stone = plain(0xd9d2c0, 0.9);
  for (const [from, to] of [[-beachLength / 2, -13], [4, beachLength / 2]]) {
    block(group, stone, 0.6, 0.75, to - from, beachStart - 0.3, 0.375, (from + to) / 2);
    addObstacle(beachStart - 0.6, beachStart, from, to, 0.75);
  }
  for (const pz of [-13.5, 4.5]) block(group, plain(0x3fb6c4, 0.6), 0.9, 1.3, 0.9, beachStart - 0.3, 0.65, pz);
  const boardZ = 9;
  for (const pz of [boardZ - 2.2, boardZ + 2.2]) { block(group, plain(0x8a6240, 0.7), 0.25, 3.2, 0.25, beachStart + 3, 1.6, pz); addObstacle(beachStart + 2.8, beachStart + 3.2, pz - 0.2, pz + 0.2, 3.3); }
  block(group, new THREE.MeshBasicMaterial({ map: label('PALM BEACH', 'SWIM AT YOUR OWN RISK · NO LIFEGUARD AFTER DARK', '#2f9bb5', '#fff8e8', 1024, 256) }), 0.14, 1.3, 5.2, beachStart + 3, 2.7, boardZ);

  // Palm trees along the top of the beach.
  for (let pz = -beachLength / 2 + 14; pz < beachLength / 2; pz += 26) {
    if (pz > -22 && pz < 14) continue; // keep the road's end clear
    const px = beachStart + 4 + Math.random() * 6, height = 7 + Math.random() * 3;
    addPalm(group, kit, px, pz, height, (Math.random() - 0.3) * 2.4);
    addObstacle(px - 0.25, px + 0.25, pz - 0.25, pz + 0.25, height * 0.5);
  }

  // Umbrellas with a pair of sun loungers under each, and towels on the sand.
  const colours = [0xe0483a, 0x2f8fd0, 0xf2c230, 0xf07a1c, 0x8a4fd0, 0xf2f0e6];
  let n = 0;
  for (let pz = -150; pz <= 150; pz += 15) {
    if (pz > -24 && pz < 20) continue;
    const px = shoreX - 13 - (n % 3) * 7, colour = colours[n++ % colours.length];
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 8), plain(0xf2f0e6, 0.5));
    pole.position.set(px, SAND + 1.2, pz);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.6, 12), plain(colour, 0.8, { side: THREE.DoubleSide }));
    shade.position.set(px, SAND + 2.45, pz);
    shade.castShadow = true;
    group.add(pole, shade);
    for (const side of [-1, 1]) {
      block(group, plain(0xf2f0e6, 0.6), 0.65, 0.1, 1.9, px + 0.4, SAND + 0.32, pz + side * 0.75);       // lounger
      block(group, plain(colour, 0.9), 0.6, 0.06, 1.2, px + 0.4, SAND + 0.4, pz + side * 0.75 + 0.2);    // its cushion
      const back = block(group, plain(0xf2f0e6, 0.6), 0.65, 0.1, 0.75, px + 0.4, SAND + 0.55, pz + side * 0.75 - 0.95);
      back.rotation.x = -0.7;
    }
    block(group, plain(colours[(n + 2) % colours.length], 1), 1.0, 0.02, 1.9, px + 3.2, SAND + 0.012, pz + 0.6).rotation.y = 0.4; // towel
  }

  // Lifeguard tower: a hut on stilts with a ramp and a flag.
  const tx = shoreX - 16, tz = -34;
  const wood = plain(0xf2efe6, 0.8), trimPaint = plain(0xe0483a, 0.7);
  for (const [lx, lz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) block(group, wood, 0.2, 2.2, 0.2, tx + lx, SAND + 1.1, tz + lz);
  block(group, wood, 3.4, 0.16, 3.4, tx, SAND + 2.2, tz);
  block(group, wood, 2.4, 1.8, 2.4, tx - 0.3, SAND + 3.18, tz);
  block(group, trimPaint, 3.0, 0.16, 3.0, tx - 0.3, SAND + 4.16, tz);
  block(group, plain(0x26343c, 0.2), 0.05, 0.8, 1.5, tx + 0.92, SAND + 3.3, tz);                      // window facing the sea
  const ramp = block(group, wood, 3.2, 0.12, 1.0, tx - 2.9, SAND + 1.1, tz + 1.1);
  ramp.rotation.z = 0.72;
  block(group, plain(0x8f9396, 0.5), 0.06, 2.6, 0.06, tx + 1.2, SAND + 5.5, tz + 1.2);
  block(group, plain(0xf2c230, 0.8), 0.9, 0.55, 0.03, tx + 1.68, SAND + 6.45, tz + 1.2);              // flag
  block(group, new THREE.MeshBasicMaterial({ map: label('LIFEGUARD', null, '#e0483a', '#fff8e8', 256, 64) }), 2.2, 0.45, 0.05, tx - 0.3, SAND + 3.75, tz + 1.24);
  addObstacle(tx - 1.7, tx + 1.7, tz - 1.7, tz + 1.7, SAND + 4.3);

  // Volleyball net.
  const vx = shoreX - 22, vz = 42;
  for (const side of [-1, 1]) { block(group, plain(0x8f9396, 0.5), 0.1, 2.5, 0.1, vx, SAND + 1.25, vz + side * 4.6); addObstacle(vx - 0.1, vx + 0.1, vz + side * 4.6 - 0.1, vz + side * 4.6 + 0.1, 2.6); }
  block(group, new THREE.MeshStandardMaterial({ color: 0xf2f0e6, roughness: 1, transparent: true, opacity: 0.55, side: THREE.DoubleSide }), 0.03, 1.0, 9.2, vx, SAND + 1.95, vz);
  block(group, plain(0xf2f0e6, 0.8), 0.05, 0.07, 9.2, vx, SAND + 2.45, vz);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), plain(0xf2f0e6, 0.7));
  ball.position.set(vx + 2.5, SAND + 0.16, vz - 1.4);
  group.add(ball);

  // A wooden pier out over the water. You can walk along it and jump off.
  const pierZ = 70, pierFrom = shoreX - 12, pierTo = shoreX + 75, pierLength = pierTo - pierFrom;
  const plank = new THREE.MeshStandardMaterial({ roughness: 0.85, map: canvasTexture(64, (ctx, s) => {
    ctx.fillStyle = '#9a8262';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, 500, 0.08);
    ctx.fillStyle = 'rgba(30,22,14,0.7)';
    for (let x = 0; x < s; x += 8) ctx.fillRect(x, 0, 1.5, s);
  }, 40, 1) });
  const post = plain(0x5c4a36, 0.9);
  block(group, plank, pierLength, 0.14, 4, pierFrom + pierLength / 2, PIER - 0.07, pierZ);
  const pierRamp = block(group, plank, 4.2, 0.12, 4, pierFrom - 1.9, (PIER + SAND) / 2, pierZ);
  pierRamp.rotation.z = 0.16;
  for (let px = pierFrom + 1; px <= pierTo; px += 6) for (const side of [-1, 1]) {
    block(group, post, 0.28, 3.4, 0.28, px, 0.1, pierZ + side * 1.9);
    block(group, post, 0.14, 1.1, 0.14, px, PIER + 0.55, pierZ + side * 1.9);                       // rail posts
  }
  for (const side of [-1, 1]) block(group, post, pierLength - 5, 0.08, 0.1, pierFrom + pierLength / 2 - 2.5, PIER + 1.05, pierZ + side * 1.9); // handrails, open at the far end
  addFloor(pierFrom, pierTo, pierZ - 2, pierZ + 2, PIER);
  sea.docks.push({ minX: pierFrom - 4, maxX: pierTo, minZ: pierZ - 2, maxZ: pierZ + 2 });
  for (const px of [pierFrom + 20, pierFrom + 50]) {                                                  // lamp posts along it
    block(group, post, 0.12, 3, 0.12, px, PIER + 1.5, pierZ - 1.9);
    block(group, new THREE.MeshBasicMaterial({ color: 0xfff3cf }), 0.3, 0.3, 0.3, px, PIER + 3.1, pierZ - 1.9);
  }

  // Marker buoys, and sailing boats further out.
  const floats = [];
  for (let pz = -120; pz <= 120; pz += 40) {
    const buoy = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), plain(pz % 80 ? 0xf07a1c : 0xe0483a, 0.5));
    buoy.position.set(shoreX + 85, WATER + 0.1, pz + 20);
    group.add(buoy);
    floats.push({ object: buoy, height: WATER + 0.1, phase: pz, lean: 0 });
  }
  for (const [bx, bz, turn, hull, sail] of [[150, -90, 0.6, 0xf2f0e6, 0xf2f0e6], [230, 60, -1.1, 0x2f5a8a, 0xf2e6c8], [330, -20, 2.2, 0xc23a2e, 0xf2f0e6], [190, 210, 0.2, 0xf2f0e6, 0x3fb6c4]]) {
    const boat = makeSailboat(hull, sail);
    boat.position.set(shoreX + bx, WATER, bz);
    boat.rotation.y = turn;
    group.add(boat);
    floats.push({ object: boat, height: WATER, phase: bx, lean: 0.05 });
  }

  scene.add(group);
  return { water, floats };
}

// Each frame: the waves move, and anything floating bobs on them.
export function updateSea(seaParts, time) {
  seaParts.water.material.uniforms.time.value = time;
  for (const float of seaParts.floats) {
    float.object.position.y = float.height + Math.sin(time * 1.2 + float.phase) * 0.12;
    float.object.rotation.z = Math.sin(time * 0.9 + float.phase) * float.lean;
  }
}
