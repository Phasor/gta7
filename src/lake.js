// A medium-sized lake with murky green-brown water, a muddy shore with reeds
// and lily pads, a wooden jetty, and three small motor boats you can take out.
// Everything is made in code.
import * as THREE from 'three';
import { water, shoreRadius, addObstacle, addFloor } from './world.js';
import { pond, clearings } from './grass.js';
import { block, canvasTexture, speckle } from './house.js';
import { label } from './store.js';

const WATER_LEVEL = 0.035;
const DECK = 0.45;            // height of the jetty's deck
const BOAT_TOP_SPEED = 50;    // metres per second at full throttle (about 110 mph)

// The lake's outline: a wobbly circle, so it doesn't look drawn with a compass.
function outline(scale, steps = 96) {
  const shape = new THREE.Shape();
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2, r = shoreRadius(angle) * scale;
    // The flat shape is laid down by turning it on its side, which flips one axis.
    const px = Math.cos(angle) * r, py = -Math.sin(angle) * r;
    if (i === 0) shape.moveTo(px, py); else shape.lineTo(px, py);
  }
  return shape;
}

function waterMaterial(fog, sunDirection) {
  return new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      time: { value: 0 },
      centre: { value: new THREE.Vector3(water.x, water.z, water.radius) },
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
      uniform float time;
      uniform vec3 centre, sunDir, hazeColor;
      uniform vec2 hazeRange;
      varying vec3 vWorld;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      // Height of the ripples at a point.
      float ripples(vec2 p) {
        return sin(p.x * 1.1 + time * 0.9) * 0.3 + sin(p.y * 1.7 - time * 1.2) * 0.25
             + noise(p * 2.2 + time * 0.35) * 0.6 + noise(p * 6.0 - time * 0.6) * 0.25;
      }

      void main() {
        vec2 p = vWorld.xz;
        float h = ripples(p);
        vec3 normal = normalize(vec3(h - ripples(p + vec2(0.2, 0.0)), 2.2, h - ripples(p + vec2(0.0, 0.2))));
        vec3 toEye = cameraPosition - vWorld;
        float dist = length(toEye);
        vec3 v = toEye / dist;

        // Murky water: dark olive in the middle, muddy brown in the shallows,
        // with drifting clouds of silt and patches of green algae on top.
        float shallows = smoothstep(0.8, 1.0, length(p - centre.xy) / centre.z);
        vec3 col = mix(vec3(0.10, 0.13, 0.07), vec3(0.30, 0.25, 0.13), shallows);
        col *= 0.8 + 0.4 * noise(p * 0.18 + time * 0.03);
        float algae = smoothstep(0.58, 0.72, noise(p * 0.45 + 7.0) * 0.7 + noise(p * 1.7) * 0.3);
        col = mix(col, vec3(0.27, 0.36, 0.10), algae * 0.6);

        // The surface reflects the sky at low angles, and glints in the sun.
        float glance = pow(1.0 - max(dot(normal, v), 0.0), 3.0);
        col = mix(col, vec3(0.60, 0.66, 0.62), glance * 0.38);
        col += vec3(1.0, 0.93, 0.75) * pow(max(dot(reflect(-sunDir, normal), v), 0.0), 90.0) * 0.7;

        col = mix(col, hazeColor, smoothstep(hazeRange.x, hazeRange.y, dist));
        gl_FragColor = vec4(col, mix(0.95, 0.72, shallows)); // you can just see the mud through the shallows
      }`,
  });
}

// Where the driver sits, measured in the boat: on the stern bench, by the tiller.
export const SEAT = { back: -1.15, height: 0.34 };

// A small open fishing skiff with an outboard motor. Faces +Z, with its waterline at height 0.
function makeBoat(hullColour, trimColour) {
  const boat = new THREE.Group();
  const V = THREE.Vector3;
  const hull = new THREE.MeshStandardMaterial({ color: hullColour, roughness: 0.45, metalness: 0.15, side: THREE.DoubleSide });
  const trim = new THREE.MeshStandardMaterial({ color: trimColour, roughness: 0.55 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a6240, roughness: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c1d1f, roughness: 0.5 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xb9bcbe, roughness: 0.35, metalness: 0.7 });
  const cushion = new THREE.MeshStandardMaterial({ color: 0xd9d2c0, roughness: 0.95 });
  const add = (mesh, px, py, pz) => { mesh.position.set(px, py, pz); mesh.castShadow = true; boat.add(mesh); return mesh; };
  // A bar between two points (rails, oars, rods).
  const bar = (material, from, to, wide, high) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(wide, high, from.distanceTo(to)), material);
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.lookAt(to);
    mesh.castShadow = true;
    boat.add(mesh);
  };

  // The hull: rounded ribs from the flat stern to the pointed, rising bow, skinned over.
  const HALF = [[1, 0.46], [0.985, 0.26], [0.9, 0.06], [0.66, -0.12], [0.34, -0.2], [0, -0.23]]; // one side of a rib, rail to keel
  const RIB = [...HALF.map(([px, py]) => [-px, py]), ...HALF.slice(0, -1).reverse()];             // the whole rib, left rail to right rail
  const RIBS = 18, N = RIB.length, positions = [], index = [], rails = [[], []];
  for (let i = 0; i <= RIBS; i++) {
    const t = i / RIBS, z = -2.1 + t * 4.4;
    const beam = 0.86 * Math.max(0.03, t < 0.5 ? 1 : Math.cos((t - 0.5) / 0.5 * Math.PI / 2) ** 0.75); // straight sides, curving in to the bow
    const lift = t > 0.5 ? ((t - 0.5) / 0.5) ** 2 * 0.36 : 0;                                          // the bow sweeps up
    RIB.forEach(([px, py], k) => {
      positions.push(px * beam, py + lift * (py > 0.3 ? 0.7 : 1), z);
      if (i < RIBS && k < N - 1) {
        const a = i * N + k;
        index.push(a, a + N, a + 1, a + 1, a + N, a + N + 1);
      }
    });
    rails[0].push(new V(-beam, 0.46 + lift * 0.7, z));
    rails[1].push(new V(beam, 0.46 + lift * 0.7, z));
  }
  for (let k = 1; k < N - 1; k++) index.push(0, k, k + 1); // close the stern
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  add(new THREE.Mesh(geometry, hull), 0, 0, 0);

  // A rail along the top edge of each side and across the stern, and a small deck over the bow.
  for (const rail of rails) for (let i = 0; i < RIBS; i++) bar(trim, rail[i], rail[i + 1], 0.07, 0.05);
  bar(trim, rails[0][0], rails[1][0], 0.07, 0.07);
  const deckPoints = [], deckIndex = [], first = Math.round(RIBS * 0.72);
  for (let i = first; i <= RIBS; i++) deckPoints.push(...rails[0][i].toArray(), ...rails[1][i].toArray());
  for (let i = 0; i < RIBS - first; i++) deckIndex.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  const deck = new THREE.BufferGeometry();
  deck.setAttribute('position', new THREE.Float32BufferAttribute(deckPoints, 3));
  deck.setIndex(deckIndex);
  deck.computeVertexNormals();
  const deckMaterial = trim.clone();
  deckMaterial.side = THREE.DoubleSide;
  add(new THREE.Mesh(deck, deckMaterial), 0, 0.012, 0);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.05), steel), 0, 0.62, 1.55);   // bow cleat
  add(new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 6, 14), new THREE.MeshStandardMaterial({ color: 0xcdbb8e, roughness: 1 })), 0.15, 0.56, 1.25).rotation.x = Math.PI / 2; // coiled rope

  // Inside: floorboards, ribs up the sides, two benches with cushions.
  block(boat, wood, 1.54, 0.04, 2.65, 0, 0.06, -0.72); // sits just above the waterline, so no water shows inside
  block(boat, wood, 1.0, 0.04, 0.85, 0, 0.06, 1.0);
  for (const rz of [-1.6, -0.6, 0.4, 1.0]) for (const side of [-1, 1]) bar(wood, new V(side * 0.6, -0.06, rz), new V(side * 0.84, 0.4, rz), 0.05, 0.03);
  for (const [bz, bw] of [[SEAT.back, 1.62], [0.25, 1.6]]) {
    block(boat, wood, bw, 0.05, 0.34, 0, 0.3, bz);
    block(boat, cushion, bw * 0.55, 0.05, 0.3, 0, 0.345, bz);
  }

  // Outboard motor: rounded cover, clamp, shaft, propeller, and the tiller you steer with.
  const cover = add(new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), dark), 0, 0.78, -2.3);
  cover.scale.set(0.17, 0.2, 0.26);
  const band = add(new THREE.Mesh(new THREE.CylinderGeometry(0.172, 0.172, 0.04, 16), trim), 0, 0.7, -2.3);
  band.scale.z = 1.5;
  block(boat, steel, 0.2, 0.3, 0.1, 0, 0.42, -2.15);
  block(boat, dark, 0.09, 0.95, 0.12, 0, 0.18, -2.3);
  block(boat, dark, 0.16, 0.03, 0.34, 0, -0.28, -2.32);                                  // fin above the propeller
  const propeller = add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 10), steel), 0, -0.2, -2.42);
  propeller.rotation.x = Math.PI / 2;
  bar(dark, new V(0.08, 0.72, -2.1), new V(0.2, 0.7, -1.45), 0.04, 0.04);
  block(boat, dark, 0.06, 0.06, 0.16, 0.21, 0.7, -1.4);                                  // rubber grip

  // Clutter: a red fuel can, a cool box, a fishing rod, and a pair of oars along the side.
  block(boat, new THREE.MeshStandardMaterial({ color: 0xb3261e, roughness: 0.5 }), 0.3, 0.26, 0.22, -0.4, 0.13, -1.65);
  block(boat, dark, 0.06, 0.05, 0.06, -0.4, 0.28, -1.65);
  block(boat, new THREE.MeshStandardMaterial({ color: 0xf2f0e8, roughness: 0.6 }), 0.5, 0.3, 0.34, 0.2, 0.15, 0.85);
  block(boat, new THREE.MeshStandardMaterial({ color: 0x2f6fb5, roughness: 0.6 }), 0.52, 0.05, 0.36, 0.2, 0.32, 0.85);
  bar(dark, new V(-0.55, 0.36, -0.2), new V(-0.75, 1.35, 1.5), 0.02, 0.02);
  for (const ox of [0.52, 0.62]) {
    bar(wood, new V(ox, 0.06, -1.5), new V(ox + 0.06, 0.1, 0.4), 0.04, 0.04);
    block(boat, wood, 0.14, 0.02, 0.5, ox + 0.07, 0.1, 0.6);
  }
  return boat;
}

// The churned-up water a moving boat leaves behind it: a pale V spreading from the stern.
function makeWake() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.filter = 'blur(3px)';
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 5;
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(32 + side * 6, 4); ctx.lineTo(32 + side * 29, 124); ctx.stroke(); }
  const churn = ctx.createLinearGradient(0, 0, 0, 128);
  churn.addColorStop(0, 'rgba(255,255,255,0.8)');
  churn.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.fillStyle = churn;
  ctx.fillRect(22, 0, 20, 128);
  const wake = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 9),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, opacity: 0, depthWrite: false })
  );
  wake.geometry.rotateX(-Math.PI / 2);
  wake.geometry.translate(0, 0, -4.5 - 2.2); // trails out behind the stern
  wake.renderOrder = 2;
  return wake;
}
// Builds the lake centred at (x, z) with the given radius.
export function createLake(scene, x, z, radius, fog, sunDirection, roadEdgeZ) {
  Object.assign(water, { active: true, x, z, radius });
  pond.set(x, z, radius, 0); // tells the grass not to grow here

  const lake = new THREE.Group();
  const mud = new THREE.MeshStandardMaterial({
    roughness: 1,
    map: canvasTexture(128, (ctx, size) => { ctx.fillStyle = '#6b5a3c'; ctx.fillRect(0, 0, size, size); speckle(ctx, size, 4000, 0.09); }, 30, 30),
  });
  const flatten = (geometry, y) => {
    const mesh = new THREE.Mesh(geometry, mud);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    lake.add(mesh);
    return mesh;
  };
  flatten(new THREE.ShapeGeometry(outline(1.07)), 0.012);                 // muddy shore
  const surface = flatten(new THREE.ShapeGeometry(outline(1.0)), WATER_LEVEL);
  surface.material = waterMaterial(fog, sunDirection);
  surface.receiveShadow = false;

  // Reeds crowding the water's edge, some with brown cattail heads.
  const REEDS = 3200;
  const reedShape = new THREE.PlaneGeometry(0.05, 1, 1, 1);
  reedShape.translate(0, 0.5, 0);
  const reeds = new THREE.InstancedMesh(reedShape, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide }), REEDS);
  const heads = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.025, 0.025, 0.16, 6), new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.9 }), REEDS / 5);
  const matrix = new THREE.Matrix4(), turn = new THREE.Quaternion(), size = new THREE.Vector3(), spot = new THREE.Vector3(), tint = new THREE.Color();
  const lean = new THREE.Euler();
  let headCount = 0;
  for (let i = 0; i < REEDS; i++) {
    // Reeds grow in clumps round the shore, leaving the jetty's stretch clear.
    const clump = Math.floor(Math.random() * 100) / 100 * Math.PI * 2;
    const angle = clump + (Math.random() - 0.5) * 0.05;
    if (Math.abs(Math.atan2(Math.sin(angle - Math.PI / 2), Math.cos(angle - Math.PI / 2))) < 0.07) { matrix.makeScale(0, 0, 0); reeds.setMatrixAt(i, matrix); continue; }
    const r = shoreRadius(angle) * (0.95 + Math.random() * 0.1);
    const tall = 0.8 + Math.random() * 1.1;
    spot.set(x + Math.cos(angle) * r, 0.02, z + Math.sin(angle) * r);
    turn.setFromEuler(lean.set((Math.random() - 0.5) * 0.3, Math.random() * Math.PI, (Math.random() - 0.5) * 0.3));
    reeds.setMatrixAt(i, matrix.compose(spot, turn, size.set(1, tall, 1)));
    reeds.setColorAt(i, tint.setHSL(0.2 + Math.random() * 0.07, 0.45, 0.28 + Math.random() * 0.14));
    if (i % 5 === 0 && headCount < REEDS / 5) {
      heads.setMatrixAt(headCount++, matrix.compose(spot.clone().add(new THREE.Vector3(0, tall, 0).applyQuaternion(turn)), turn, size.set(1, 1, 1)));
    }
  }
  heads.count = headCount;
  lake.add(reeds, heads);

  // Lily pads floating near the banks, a few with flowers.
  const padMaterial = new THREE.MeshStandardMaterial({ color: 0x4f7a35, roughness: 0.8 });
  const flowerMaterial = new THREE.MeshStandardMaterial({ color: 0xf2d6e2, roughness: 0.7 });
  for (let i = 0; i < 180; i++) {
    const angle = Math.random() * Math.PI * 2, r = shoreRadius(angle) * (0.72 + Math.random() * 0.2);
    const pad = new THREE.Mesh(new THREE.CircleGeometry(0.22 + Math.random() * 0.2, 10, 0.3, Math.PI * 2 - 0.6), padMaterial);
    pad.rotation.set(-Math.PI / 2, 0, Math.random() * 6);
    pad.position.set(x + Math.cos(angle) * r, WATER_LEVEL + 0.012, z + Math.sin(angle) * r);
    lake.add(pad);
    if (i % 6 === 0) {
      const flower = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.09, 7), flowerMaterial);
      flower.rotation.x = Math.PI;
      flower.position.copy(pad.position).y += 0.06;
      lake.add(flower);
    }
  }
  // Rocks along the shore.
  const rock = new THREE.MeshStandardMaterial({ color: 0x8a867c, roughness: 0.95, flatShading: true });
  for (let i = 0; i < 36; i++) {
    const angle = Math.random() * Math.PI * 2, r = shoreRadius(angle) * (1.0 + Math.random() * 0.07), big = 0.2 + Math.random() * 0.45;
    const stone = new THREE.Mesh(new THREE.IcosahedronGeometry(big, 0), rock);
    stone.scale.y = 0.6;
    stone.rotation.y = Math.random() * 6;
    stone.position.set(x + Math.cos(angle) * r, big * 0.2, z + Math.sin(angle) * r);
    stone.castShadow = true;
    lake.add(stone);
  }

  // --- The jetty: reaching out from the bank nearest the road ---
  const plank = new THREE.MeshStandardMaterial({
    roughness: 0.85,
    map: canvasTexture(64, (ctx, sz) => { // weathered boards with gaps
      ctx.fillStyle = '#8f7a5c';
      ctx.fillRect(0, 0, sz, sz);
      speckle(ctx, sz, 500, 0.08);
      ctx.fillStyle = 'rgba(30,22,14,0.7)';
      for (let y = 0; y < sz; y += 8) ctx.fillRect(0, y, sz, 1.5);
    }, 1, 13),
  });
  const post = new THREE.MeshStandardMaterial({ color: 0x5c4a36, roughness: 0.9 });
  const rope = new THREE.MeshStandardMaterial({ color: 0xb9a780, roughness: 1 });
  const bankZ = z + shoreRadius(Math.PI / 2);           // where the bank is, on the road side
  const startZ = bankZ + 2.5, endZ = bankZ - 19, midZ = (startZ + endZ) / 2, length = startZ - endZ;
  block(lake, plank, 2.2, 0.1, length, x, DECK - 0.05, midZ);
  block(lake, plank, 2.2, 0.08, 1.6, x, DECK / 2 - 0.02, startZ + 0.7).rotation.x = 0.28; // ramp up from the bank
  for (let pz = endZ + 0.3; pz <= startZ; pz += 2.55) for (const side of [-1, 1]) {
    block(lake, post, 0.16, 1.9, 0.16, x + side * 1.08, 0.5, pz);
    if (pz < startZ - 2) block(lake, rope, 0.03, 0.03, 2.55, x + side * 1.08, 1.25, pz + 1.27); // rope rail
  }
  block(lake, rope, 2.2, 0.03, 0.03, x, 1.25, endZ + 0.3);
  addFloor(x - 1.15, x + 1.15, endZ, startZ + 1.4, DECK);
  water.docks.push({ minX: x - 1.15, maxX: x + 1.15, minZ: endZ, maxZ: startZ + 1.5 });
  // The rails stop you stepping off the sides or the end into the water.
  addObstacle(x - 1.3, x - 1.05, endZ, bankZ - 0.3, 1.4);
  addObstacle(x + 1.05, x + 1.3, endZ, bankZ - 0.3, 1.4);
  addObstacle(x - 1.3, x + 1.3, endZ - 0.15, endZ + 0.1, 1.4);

  // A gravel path from the pavement to the jetty, and a warning sign.
  const gravel = new THREE.MeshStandardMaterial({
    roughness: 1,
    map: canvasTexture(64, (ctx, sz) => { ctx.fillStyle = '#a89c84'; ctx.fillRect(0, 0, sz, sz); speckle(ctx, sz, 1500, 0.12); }, 1, 6),
  });
  const pathEnd = startZ + 1.4;
  block(lake, gravel, 2.2, 0.04, roadEdgeZ - pathEnd, x, 0.02, (roadEdgeZ + pathEnd) / 2).castShadow = false;
  clearings[37].set(x - 1.2, pathEnd - 0.1, x + 1.2, roadEdgeZ + 0.1);
  block(lake, post, 0.1, 1.7, 0.1, x + 2.2, 0.85, startZ + 2);
  block(lake, new THREE.MeshBasicMaterial({ map: label('NO SWIMMING', 'ALLIGATORS', '#f0c020', '#1c1d1f', 256, 128) }), 1.0, 0.5, 0.04, x + 2.2, 1.5, startZ + 2.06);
  addObstacle(x + 2.1, x + 2.3, startZ + 1.9, startZ + 2.1, 1.8);

  // --- Boats: two tied up at the jetty and one adrift further out ---
  const boats = [
    [makeBoat(0x7c8a72, 0x2f3a2a), x - 2.5, endZ + 5, Math.PI],
    [makeBoat(0xb3352a, 0xf4efe3), x + 2.5, endZ + 11.5, Math.PI],
    [makeBoat(0xe9e6dc, 0x2f6fb5), x - radius * 0.45, z - radius * 0.2, 1.1],
  ].map(([model, bx, bz, heading], i) => {
    model.position.set(bx, WATER_LEVEL, bz);
    model.rotation.order = 'YXZ';
    model.rotation.y = heading;
    const wake = makeWake();
    lake.add(model, wake);
    return { group: model, wake, heading, speed: 0, steer: 0, phase: i * 2.1, engine: null };
  });

  scene.add(lake);
  return { group: lake, surface, boats, dock: { x, startZ, endZ } };
}

// input: { throttle: -1..1 (moves the throttle lever), steer: -1 (right) .. 1 (left), cut: back to idle }.
export function updateLake(lake, time, dt, riddenBoat, input) {
  lake.surface.material.uniforms.time.value = time;
  for (const boat of lake.boats) {
    const position = boat.group.position;
    if (boat === riddenBoat) {
      // The throttle is a lever: W pushes it forward, S pulls it back (past zero into
      // reverse), and it stays where you leave it. Space snaps it back to idle.
      boat.throttle = THREE.MathUtils.clamp((boat.throttle || 0) + input.throttle * 0.35 * dt, -0.12, 1);
      if (input.cut) boat.throttle = 0;
      boat.steer += (input.steer - boat.steer) * Math.min(1, 4 * dt);
      boat.heading += boat.steer * 1.3 * THREE.MathUtils.clamp(boat.speed / 4, -1, 1) * dt; // only turns while moving
    } else {
      boat.steer *= 1 - Math.min(1, 3 * dt);
    }
    const power = boat === riddenBoat ? boat.throttle : 0;
    boat.speed += (power * BOAT_TOP_SPEED - boat.speed) * Math.min(1, 0.8 * dt); // settles at the speed the throttle is set to
    position.x += Math.sin(boat.heading) * boat.speed * dt;
    position.z += Math.cos(boat.heading) * boat.speed * dt;

    // Stay on the water: stop at the bank...
    const dx = position.x - water.x, dz = position.z - water.z, dist = Math.hypot(dx, dz) || 1;
    const limit = shoreRadius(Math.atan2(dz, dx)) - 2.5;
    if (dist > limit) {
      position.x = water.x + dx / dist * limit;
      position.z = water.z + dz / dist * limit;
      boat.speed *= 1 - Math.min(1, 4 * dt);
    }
    // ...and bump off the jetty.
    const { x: dockX, endZ, startZ } = lake.dock;
    if (Math.abs(position.x - dockX) < 2.2 && position.z > endZ - 2.5 && position.z < startZ) {
      if (position.z < endZ - 1.6) position.z = endZ - 2.5;
      else position.x = dockX + (position.x < dockX ? -2.2 : 2.2);
      boat.speed *= 1 - Math.min(1, 4 * dt);
    }

    // Bob on the water, lean into turns, and lift the bow at speed.
    position.y = WATER_LEVEL + Math.sin(time * 1.6 + boat.phase) * 0.035;
    boat.group.rotation.y = boat.heading;
    boat.group.rotation.x = -Math.min(boat.speed, 14) * 0.012 + Math.sin(time * 1.3 + boat.phase) * 0.02;
    boat.group.rotation.z = Math.sin(time * 1.1 + boat.phase * 2) * 0.03 + boat.steer * Math.min(boat.speed, 10) * 0.03;
    boat.wake.position.set(position.x, WATER_LEVEL + 0.02, position.z);
    boat.wake.rotation.y = boat.heading;
    boat.wake.material.opacity = THREE.MathUtils.clamp((boat.speed - 0.8) / 6, 0, 0.75);

    if (boat.engine) { // outboard motor note
      const now = boat.engine.context.currentTime;
      boat.engine.tone.frequency.setTargetAtTime(70 + Math.abs(boat.speed) * 5, now, 0.1);
    }
  }
}

// The boat within reach of `position`, if any.
export function boatNear(lake, position) {
  return lake.boats.find((boat) => Math.hypot(boat.group.position.x - position.x, boat.group.position.z - position.z) < 3.7) || null;
}

// Where someone getting out of `boat` would step to: onto the jetty if it is
// alongside, otherwise onto the bank if that is close. Null if neither is.
export function landingSpot(lake, boat) {
  const position = boat.group.position, { x: dockX, endZ, startZ } = lake.dock;
  if (Math.abs(position.x - dockX) < 4.0 && position.z > endZ - 3.2 && position.z < startZ) {
    return new THREE.Vector3(dockX + (position.x < dockX ? -0.5 : 0.5), DECK, THREE.MathUtils.clamp(position.z, endZ + 0.6, startZ));
  }
  const dx = position.x - water.x, dz = position.z - water.z, dist = Math.hypot(dx, dz) || 1;
  const bank = shoreRadius(Math.atan2(dz, dx));
  if (bank - dist < 4.5) return new THREE.Vector3(water.x + dx / dist * (bank + 1.2), 0, water.z + dz / dist * (bank + 1.2));
  return null;
}
