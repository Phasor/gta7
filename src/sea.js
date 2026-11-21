// The sea: past the far end of Miami the road runs out onto a sandy beach
// and turquoise water that goes on to the horizon. It is beyond the last
// buildings, so nothing in the city is in its way.
// On the beach: palm trees, umbrellas and sun loungers, a lifeguard tower, a
// volleyball net and a wooden pier. You can wade in and swim; sailing boats
// bob further out.
import * as THREE from 'three';
import { sea, addObstacle, addFloor, addInterior } from './world.js';
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

  // The fishing boat, tied up across the end of the pier. Walk off the end of the pier onto it.
  const fishing = addFishingBoat(group, pierTo + 2.7, pierZ);
  const boatBox = fishing.box;

  // Jet skis moored along the pier. Walk out, stand beside one and press F to ride it.
  const skis = [[26, -1, 0xf2c230, 0x1c1d1f], [36, 1, 0xe0483a, 0xf2f0e6], [46, -1, 0x2f8fd0, 0xf2f0e6], [56, 1, 0xf2f0e6, 0x8a4fd0]].map(([out, side, hull, trim], i) => {
    const ski = makeJetSki(hull, trim);
    ski.position.set(shoreX + out, WATER, pierZ + side * 3.4);
    ski.rotation.order = 'YXZ';
    const heading = Math.PI / 2; // pointing out to sea
    ski.rotation.y = heading;
    const wake = makeSpray();
    group.add(ski, wake);
    return { group: ski, wake, heading, speed: 0, steer: 0, phase: i * 1.7, engine: null, jetSki: true, seat: { back: -0.25, height: 0.62 } };
  });

  scene.add(group);
  return { water, floats, skis, shoreX, boatBox, fishing, pier: { z: pierZ, from: pierFrom, to: pierTo } };
}

// Each frame: the waves move, and anything floating bobs on them.
export function updateSea(seaParts, time) {
  seaParts.water.material.uniforms.time.value = time;
  for (const float of seaParts.floats) {
    float.object.position.y = float.height + Math.sin(time * 1.2 + float.phase) * 0.12;
    float.object.rotation.z = Math.sin(time * 0.9 + float.phase) * float.lean;
  }
}

// --- Jet skis --------------------------------------------------------------------------

const SKI_TOP_SPEED = 32; // metres per second, about 70 mph

// A jet ski. Faces +Z, with its waterline at height 0.
function makeJetSki(hullColour, trimColour) {
  const ski = new THREE.Group();
  const paint = (color, roughness = 0.35) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.2 });
  const hull = paint(hullColour), trim = paint(trimColour), black = paint(0x151617, 0.7);
  // Hull: a long shape, pointed at the bow and rising toward it.
  const outline = new THREE.Shape();
  outline.moveTo(-0.55, -1.5); outline.lineTo(0.55, -1.5); outline.lineTo(0.6, 0.4);
  outline.quadraticCurveTo(0.45, 1.5, 0, 1.75); outline.quadraticCurveTo(-0.45, 1.5, -0.6, 0.4); outline.lineTo(-0.55, -1.5);
  const hullMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(outline, { depth: 0.42, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 3 }), hull);
  hullMesh.rotation.x = Math.PI / 2;   // lay the outline flat: its length runs along Z
  hullMesh.position.y = 0.36;
  hullMesh.castShadow = true;
  ski.add(hullMesh);
  block(ski, black, 1.3, 0.1, 3.0, 0, 0.0, -0.1);                 // dark underside
  block(ski, trim, 0.62, 0.2, 1.5, 0, 0.48, 0.75);                // raised bonnet
  block(ski, black, 0.42, 0.14, 1.25, 0, 0.56, -0.55);            // saddle
  block(ski, black, 0.5, 0.12, 0.3, 0, 0.5, -1.25);               // back of the seat
  block(ski, trim, 0.16, 0.36, 0.2, 0, 0.72, 0.42).rotation.x = -0.35; // steering column
  block(ski, black, 0.82, 0.05, 0.06, 0, 0.9, 0.36);              // handlebars
  for (const side of [-1, 1]) block(ski, black, 0.14, 0.07, 0.07, side * 0.4, 0.9, 0.36);
  block(ski, new THREE.MeshStandardMaterial({ color: 0x0d1318, roughness: 0.1, metalness: 0.6 }), 0.4, 0.16, 0.04, 0, 0.84, 0.62).rotation.x = -0.6; // little windscreen
  for (const side of [-1, 1]) block(ski, trim, 0.03, 0.16, 2.2, side * 0.66, 0.3, -0.2);          // stripe along each side
  block(ski, black, 0.2, 0.14, 0.2, 0, 0.12, -1.6);               // jet nozzle
  return ski;
}

// The plume of spray a jet ski throws up behind it.
function makeSpray() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const fade = ctx.createLinearGradient(0, 0, 0, 128);
  fade.addColorStop(0, 'rgba(255,255,255,0.95)');
  fade.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = fade;
  ctx.beginPath();
  ctx.moveTo(26, 0); ctx.lineTo(38, 0); ctx.lineTo(64, 128); ctx.lineTo(0, 128);
  ctx.fill();
  const spray = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 10),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, opacity: 0, depthWrite: false }));
  spray.geometry.rotateX(-Math.PI / 2);
  spray.geometry.translate(0, 0, -6.6); // trails out behind
  spray.renderOrder = 2;
  return spray;
}

// input: { throttle: -1..1, steer: -1 (right) .. 1 (left), brake }. Hold W to go, like the truck.
export function updateJetSkis(seaParts, time, dt, ridden, input) {
  const { shoreX, pier } = seaParts;
  for (const ski of seaParts.skis) {
    const position = ski.group.position;
    if (ski === ridden) {
      if (input.throttle > 0) ski.speed += 15 * (1 - ski.speed / SKI_TOP_SPEED) * dt;
      else if (input.throttle < 0) ski.speed -= (ski.speed > 0.5 ? 16 : 4) * dt;
      if (input.brake) ski.speed -= ski.speed * Math.min(1, 3 * dt);
      ski.steer += (input.steer - ski.steer) * Math.min(1, 5 * dt);
      ski.heading += ski.steer * 1.7 * THREE.MathUtils.clamp(ski.speed / 6, -1, 1) * dt; // only turns while moving
    } else {
      ski.steer *= 1 - Math.min(1, 3 * dt);
    }
    ski.speed -= ski.speed * 0.5 * dt; // the water slows it down
    ski.speed = Math.max(ski.speed, -3);
    position.x += Math.sin(ski.heading) * ski.speed * dt;
    position.z += Math.cos(ski.heading) * ski.speed * dt;

    // Stay on the water: it runs aground on the beach, stops at the edge of the map, and bumps off the pier.
    if (position.x < shoreX + 3) { position.x = shoreX + 3; ski.speed *= 1 - Math.min(1, 5 * dt); }
    position.x = Math.min(position.x, shoreX + 420);
    position.z = THREE.MathUtils.clamp(position.z, -1100, 1100);
    if (position.x < pier.to + 1.8 && Math.abs(position.z - pier.z) < 3.0) {
      if (position.x > pier.to + 0.8) position.x = pier.to + 1.8;
      else position.z = pier.z + (position.z < pier.z ? -3.0 : 3.0);
      ski.speed *= 1 - Math.min(1, 4 * dt);
    }

    const hull = seaParts.boatBox; // ...and off the fishing boat
    if (seaParts.fishing.moored && position.x > hull.minX - 0.8 && position.x < hull.maxX + 0.8 && position.z > hull.minZ - 0.8 && position.z < hull.maxZ + 0.8) {
      position.x = hull.maxX + 0.8;
      ski.speed *= 1 - Math.min(1, 4 * dt);
    }

    // Bobbing, leaning into turns, and the bow lifting at speed.
    position.y = WATER + Math.sin(time * 1.8 + ski.phase) * 0.04 + Math.min(ski.speed, 25) * 0.004;
    ski.group.rotation.y = ski.heading;
    ski.group.rotation.x = -Math.min(Math.max(ski.speed, 0), 22) * 0.008 + Math.sin(time * 1.4 + ski.phase) * 0.02;
    ski.group.rotation.z = -ski.steer * Math.min(ski.speed, 20) * 0.022 + Math.sin(time * 1.1 + ski.phase) * 0.03;
    ski.wake.position.set(position.x, WATER + 0.03, position.z);
    ski.wake.rotation.y = ski.heading;
    ski.wake.material.opacity = THREE.MathUtils.clamp((ski.speed - 1.5) / 14, 0, 0.85);
    if (ski.engine) ski.engine.tone.frequency.setTargetAtTime(95 + Math.abs(ski.speed) * 7, ski.engine.context.currentTime, 0.08); // a higher whine than the truck
  }
}

// The jet ski within reach of `position`, if any.
export function jetSkiNear(seaParts, position) {
  return seaParts.skis.find((ski) => Math.hypot(ski.group.position.x - position.x, ski.group.position.z - position.z) < 3.8) || null;
}

// Where someone getting off `ski` would step to: onto the pier if alongside, or the beach if close. Null out at sea.
export function seaLanding(seaParts, ski) {
  const position = ski.group.position, { pier, shoreX } = seaParts;
  if (Math.abs(position.z - pier.z) < 5 && position.x > pier.from && position.x < pier.to + 3) {
    return new THREE.Vector3(THREE.MathUtils.clamp(position.x, pier.from + 1, pier.to - 1), PIER, pier.z + (position.z < pier.z ? -0.8 : 0.8));
  }
  if (position.x < shoreX + 9) return new THREE.Vector3(shoreX - 1.5, SAND, position.z);
  return null;
}

// --- The fishing boat ----------------------------------------------------------------------

const DECK = 0.9; // height of the boat's deck, just above the pier

// A working fishing boat, "Lucky Catch", moored with its side against the end of the
// pier. You can walk all over the deck and into the wheelhouse, and take the wheel
// to sail her (see the functions after this one).
// (bx, bz) is the middle of the boat; the bow points toward +Z.
function addFishingBoat(group, bx, bz) {
  const boat = new THREE.Group();
  boat.position.set(bx, 0, bz);
  const plain = (color, roughness = 0.7, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  const white = plain(0xf2f0e8, 0.6), blue = plain(0x1f5a8a, 0.6), rust = plain(0x8a4a2a, 0.9), dark = plain(0x26282b, 0.7);
  const steel = plain(0x9ea3a7, 0.4, { metalness: 0.6 }), rope = plain(0xcdbb8e, 1);
  const glass = new THREE.MeshStandardMaterial({ color: 0xbfe0e6, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.25, depthWrite: false });
  const planks = new THREE.MeshStandardMaterial({ roughness: 0.85, map: canvasTexture(64, (ctx, s) => {
    ctx.fillStyle = '#a58a62';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, 500, 0.08);
    ctx.fillStyle = 'rgba(40,28,16,0.7)';
    for (let x = 0; x < s; x += 8) ctx.fillRect(x, 0, 1.5, s);
  }, 0.5, 0.2) });
  const put = (material, w, h, d, x, y, z) => block(boat, material, w, h, d, x, DECK + y, z); // y: height above the deck
  const solids = []; // everything solid aboard, so it can all be switched off while she is under way
  // Each is remembered by where it sits on the boat, so it can be put back wherever she comes to rest.
  const solid = (x, z, w, d, height) => solids.push({ x, z, w, d, height: DECK + height, box: addObstacle(bx + x - w / 2, bx + x + w / 2, bz + z - d / 2, bz + z + d / 2, DECK + height) });
  const thing = (material, w, h, d, x, z) => { solid(x, z, w, d, h); return put(material, w, h, d, x, h / 2, z); };

  // Hull: flat stern, straight sides, and a pointed bow. White above a blue waterline.
  const outline = new THREE.Shape([[-2.5, -7], [2.5, -7], [2.5, 3], [0, 7.5], [-2.5, 3]].map(([x, z]) => new THREE.Vector2(x, z)));
  const flat = (material, depth, y, scale = 1) => { // the outline laid flat, `depth` thick, with its top at height y
    const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(outline, { depth, bevelEnabled: false }), material);
    mesh.rotation.x = Math.PI / 2;
    mesh.scale.set(scale, scale, 1);
    mesh.position.y = y;
    mesh.castShadow = true;
    boat.add(mesh);
  };
  flat(white, 0.75, DECK);
  flat(blue, 0.9, DECK - 0.75, 0.99);
  flat(planks, 0.03, DECK + 0.03, 0.96); // the deck

  // Bulwarks (the low walls round the deck), with a gap where the gangway comes aboard.
  const wall = (x, z, w, d) => { thing(white, w, 0.75, d, x, z); put(blue, w + 0.08, 0.07, d + 0.08, x, 0.78, z); };
  wall(0, -6.9, 5, 0.2);              // stern
  wall(2.4, -2, 0.2, 10);             // right side
  wall(-2.4, -4.1, 0.2, 5.8);         // left side, aft of the gangway
  wall(-2.4, 1.8, 0.2, 2.4);          // left side, forward of it
  for (const side of [-1, 1]) {       // the two sides of the bow, running in to the point
    const length = Math.hypot(2.4, 4.4);
    const bowWall = put(white, 0.2, 0.75, length, side * 1.2, 0.375, 5.2);
    bowWall.rotation.y = -side * Math.atan2(2.4, 4.4);
    const cap = put(blue, 0.28, 0.07, length, side * 1.2, 0.78, 5.2);
    cap.rotation.y = bowWall.rotation.y;
    for (let i = 0; i <= 6; i++) solid(side * (2.4 - i * 0.4), 3 + i * 0.73, 0.45, 0.75, 0.75);
  }
  put(planks, 1.5, 0.06, 1.7, -3.0, -0.07, -0.3); // gangway plank from the pier
  for (const z of [-1.3, 0.7]) put(steel, 0.06, 1.0, 0.06, -2.4, 0.5, z);

  // Wheelhouse: four walls with windows all round, a doorway at the back, and a roof.
  const H = 2.2, x0 = 1.5, zBack = 1.5, zFront = 4.6, zMid = (zBack + zFront) / 2, depth = zFront - zBack;
  const panel = (w, d, x, z, windowed) => {
    put(white, w, 0.95, d, x, 0.475, z);                       // lower wall
    put(white, w, H - 1.85, d, x, 1.85 + (H - 1.85) / 2, z);   // above the windows
    if (windowed) put(glass, Math.max(0.04, w - 0.1), 0.9, Math.max(0.04, d - 0.1), x, 1.4, z);
    else put(white, w, 0.9, d, x, 1.4, z);
    solid(x, z, w, d, H);
  };
  panel(0.12, depth, -x0, zMid, true);
  panel(0.12, depth, x0, zMid, true);
  panel(x0 * 2, 0.12, 0, zFront, true);
  panel(0.95, 0.12, -1.02, zBack, false);                      // back wall, either side of the door
  panel(0.95, 0.12, 1.02, zBack, false);
  put(white, 1.1, H - 1.95, 0.12, 0, 1.95 + (H - 1.95) / 2, zBack);
  for (const [px, pz] of [[-x0, zBack], [x0, zBack], [-x0, zFront], [x0, zFront]]) put(blue, 0.16, H, 0.16, px, H / 2, pz); // corner posts
  put(blue, x0 * 2 + 0.5, 0.12, depth + 0.6, 0, H + 0.06, zMid); // roof
  const interior = addInterior(bx - x0 + 0.1, bx + x0 - 0.1, bz + zBack + 0.1, bz + zFront - 0.1, DECK + H);
  put(new THREE.MeshBasicMaterial({ map: label('LUCKY CATCH', null, '#1f5a8a', '#f2f0e8', 512, 96) }), 2.2, 0.36, 0.03, 0, 2.05, zBack - 0.08);

  // Inside: the console with the wheel, a screen and throttle, the skipper's stool, and a bench.
  thing(dark, 2.6, 1.0, 0.6, 0, zFront - 0.45);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.03, 8, 20), plain(0x8a6240, 0.5));
  wheel.position.set(-0.4, DECK + 1.2, zFront - 0.82);
  boat.add(wheel);
  for (let spoke = 0; spoke < 3; spoke++) put(plain(0x8a6240, 0.5), 0.5, 0.03, 0.03, -0.4, 1.2, zFront - 0.82).rotation.z = spoke * Math.PI / 3;
  put(new THREE.MeshBasicMaterial({ color: 0x2fa0c0 }), 0.5, 0.32, 0.03, 0.55, 1.2, zFront - 0.72); // fish finder
  put(steel, 0.05, 0.22, 0.05, 1.05, 1.1, zFront - 0.6);                                              // throttle lever
  thing(dark, 0.4, 0.7, 0.4, -0.4, zFront - 1.5);
  thing(plain(0x8a6240, 0.6), 0.5, 0.45, 1.4, 1.15, zBack + 0.95);
  put(plain(0xe0483a, 0.9), 0.5, 0.06, 1.4, 1.15, 0.48, zBack + 0.95);

  // On the roof: a mast with a light, a radar bar, and a boom reaching back over the working deck.
  put(steel, 0.1, 3.0, 0.1, 0, H + 1.6, zBack + 0.5);
  put(new THREE.MeshBasicMaterial({ color: 0xfff3cf }), 0.16, 0.16, 0.16, 0, H + 3.15, zBack + 0.5);
  put(white, 1.3, 0.1, 0.16, 0, H + 0.45, zFront - 0.8);
  // The big automatic fishing pole: a long boom reaching out past the stern, with a
  // cable and hook that it lowers into the sea and winds back up by itself.
  const boomLength = 9.6, boomTilt = 0.22;
  const boom = put(steel, 0.12, 0.12, boomLength, 0, H + 1.9, zBack - 4.4);
  boom.rotation.x = boomTilt;
  put(steel, 0.07, 1.5, 0.07, 0, H + 1.15, zBack - 1.2).rotation.x = -0.5;   // strut holding it up
  const tip = new THREE.Vector3(0, DECK + H + 1.9 + Math.sin(boomTilt) * boomLength / 2, zBack - 4.4 - Math.cos(boomTilt) * boomLength / 2);
  const pulley = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.08, 14), rust);
  pulley.rotation.z = Math.PI / 2;
  pulley.position.copy(tip);
  const cableShape = new THREE.BoxGeometry(0.03, 1, 0.03);
  cableShape.translate(0, -0.5, 0); // hangs down from its top end
  const cable = new THREE.Mesh(cableShape, dark);
  cable.position.copy(tip);
  const hook = new THREE.Group();
  hook.position.copy(tip);
  block(hook, rust, 0.16, 0.22, 0.16, 0, 0, 0);
  const curl = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.022, 6, 12, Math.PI * 1.4), steel);
  curl.position.y = -0.17;
  hook.add(curl);
  boat.add(pulley, cable, hook);
  const rig = { tip, cable, hook, stowed: DECK + H + 0.9 };

  // Working deck: a heap of net with floats, crates of fish, a winch, a cool box, rods and rope.
  const net = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 1), plain(0x3f7a5a, 1, { flatShading: true }));
  net.scale.set(1.2, 0.45, 1.1);
  net.position.set(1.1, DECK + 0.35, -5.3);
  boat.add(net);
  solid(1.1, -5.3, 1.9, 1.7, 0.7);
  for (const [fx, fz] of [[0.5, -4.8], [1.5, -5.0], [1.1, -5.9], [1.9, -5.6]]) {
    const float = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), plain(0xf07a1c, 0.6));
    float.position.set(fx, DECK + 0.72, fz);
    boat.add(float);
  }
  for (const [cx, cz, level] of [[-1.5, -5.6, 0], [-1.5, -4.7, 0], [-1.5, -5.15, 1]]) {
    put(plain(0x2f8fd0, 0.7), 0.85, 0.34, 0.6, cx, 0.17 + level * 0.36, cz);
    for (let fish = 0; fish < 4; fish++) {                     // silver fish packed in ice
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), plain(0xc9d2d8, 0.25, { metalness: 0.7 }));
      body.scale.set(2.3, 0.5, 0.8);
      body.position.set(cx - 0.18 + (fish % 2) * 0.36, DECK + 0.37 + level * 0.36, cz - 0.14 + (fish >> 1) * 0.28);
      boat.add(body);
    }
  }
  solid(-1.5, -5.15, 0.9, 1.6, 0.75);
  thing(rust, 0.8, 0.6, 0.6, 0, -2.6);                          // winch
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.7, 14), rope);
  drum.rotation.z = Math.PI / 2;
  drum.position.set(0, DECK + 0.75, -2.6);
  boat.add(drum);
  thing(white, 0.7, 0.45, 0.45, 1.8, -1.0);                     // cool box
  put(blue, 0.72, 0.06, 0.47, 1.8, 0.48, -1.0);
  for (const rx of [-1.6, -0.8, 0.8, 1.6]) {                    // fishing rods in holders along the stern
    const rod = put(dark, 0.025, 2.6, 0.025, rx, 1.6, -6.75);
    rod.rotation.x = -0.35;
  }
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 6, 16), rope);
  coil.rotation.x = Math.PI / 2;
  coil.position.set(-1.7, DECK + 0.1, -1.6);
  boat.add(coil);
  for (const side of [-1, 1]) {                                 // lifebuoys on the wheelhouse
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.07, 8, 18), plain(0xe0483a, 0.6));
    ring.rotation.y = Math.PI / 2;
    ring.position.set(side * (x0 + 0.1), DECK + 1.15 - 0.6, zMid);
    boat.add(ring);
  }
  // Her name on the stern, and mooring ropes to the pier.
  put(new THREE.MeshBasicMaterial({ map: label('LUCKY CATCH', 'MIAMI', '#f2f0e8', '#1f5a8a', 512, 128) }), 2.6, 0.5, 0.03, 0, -0.3, -7.03);
  for (const z of [-5, 2.2]) {
    const line = put(rope, 1.6, 0.04, 0.04, -3.1, 0.35, z);
    line.rotation.z = 0.35;
  }

  group.add(boat);
  // You can stand anywhere on the boat (and on the plank across to it) instead of being in the water.
  const box = { minX: bx - 2.5, maxX: bx + 2.5, minZ: bz - 7, maxZ: bz + 7.5 };
  const floor = addFloor(box.minX - 0.4, box.maxX, box.minZ, box.maxZ, DECK);
  const dock = { minX: box.minX - 0.6, maxX: box.maxX, minZ: box.minZ, maxZ: box.maxZ };
  sea.docks.push(dock);
  const wake = makeSpray();
  wake.scale.set(2.4, 1, 2.2);
  group.add(wake);
  return {
    box, group: boat, wake, rig, solids, floor, dock, interior, berth: { x: bx, z: bz }, helm: { x: 0, z: zFront - 1.5 },
    // The same areas measured on the boat herself: [min x, max x, min z, max z].
    hullArea: [-2.5, 2.5, -7, 7.5], floorArea: [-2.9, 2.5, -7, 7.5], dockArea: [-3.1, 2.5, -7, 7.5],
    cabinArea: [-x0 + 0.1, x0 - 0.1, zBack + 0.1, zFront - 0.1],
    moored: true, heading: 0, speed: 0, steer: 0, throttle: 0, phase: 0, engine: null,
    fishing: true, stand: true, seat: { back: zFront - 1.5, height: DECK + 0.4 }, // he stands at the wheel
  };
}

// --- Sailing the fishing boat -----------------------------------------------------------------
// Tied up, she is a solid place to walk about on. Under way she is a vehicle, steered
// from the wheel, and nobody can walk on her until she is tied up again.

const BOAT_TOP_SPEED = 14; // metres per second, about 30 mph

// A spot on the boat (measured from her middle, bow toward +z) as a place on the map.
export function onBoat(f, x, z, y = DECK) {
  const c = Math.cos(f.heading), s = Math.sin(f.heading), at = f.group.position;
  return new THREE.Vector3(at.x + x * c + z * s, y, at.z - x * s + z * c);
}

// Make the boat solid where she lies: put her walls, deck and cabin back in the world
// at her present position. (She is always square to the map when at rest.)
function settle(f) {
  const area = ([x0, x1, z0, z1]) => {
    const a = onBoat(f, x0, z0), b = onBoat(f, x1, z1);
    return { minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x), minZ: Math.min(a.z, b.z), maxZ: Math.max(a.z, b.z) };
  };
  for (const o of f.solids) Object.assign(o.box, area([o.x - o.w / 2, o.x + o.w / 2, o.z - o.d / 2, o.z + o.d / 2]), { height: o.height });
  Object.assign(f.box, area(f.hullArea));
  Object.assign(f.floor, area(f.floorArea), { height: DECK });
  Object.assign(f.dock, area(f.dockArea));
  Object.assign(f.interior, area(f.cabinArea));
}

// The fishing boat, if he is standing at her wheel (while she is at rest), ready to take it.
export function fishingBoatNear(seaParts, position) {
  const f = seaParts.fishing;
  if (!f.moored || position.y < 0.5) return null;
  const wheel = onBoat(f, f.helm.x, f.helm.z);
  return Math.hypot(position.x - wheel.x, position.z - wheel.z) < 1.5 ? f : null;
}

// Where someone swimming beside the boat would climb aboard, or null if he isn't beside her.
export function climbAboardSpot(seaParts, position) {
  const f = seaParts.fishing, box = f.box;
  if (!f.moored || position.y > 0.4) return null;
  if (position.x < box.minX - 3.5 || position.x > box.maxX + 3.5 || position.z < box.minZ - 3.5 || position.z > box.maxZ + 3.5) return null;
  return onBoat(f, 0, -4.1);
}

// Let go: everything aboard stops being solid so she can move.
export function castOff(seaParts) {
  const f = seaParts.fishing;
  if (!f.moored) return;
  f.moored = false;
  for (const o of f.solids) o.box.height = -Infinity;
  f.floor.height = 0;
  for (const area of [f.dock, f.interior]) area.maxX = area.minX - 1;
}

// He lets go of the wheel. Close to the pier she goes back into her berth. Anywhere
// else she drops anchor on the spot, swinging round to lie square, so he can walk
// about on deck out at sea. Returns where he ends up standing.
export function leaveFishingBoat(seaParts) {
  const f = seaParts.fishing, at = f.group.position;
  f.throttle = 0;
  f.speed = 0;
  if (Math.hypot(at.x - f.berth.x, at.z - f.berth.z) < 16) {
    at.set(f.berth.x, 0, f.berth.z);
    f.heading = 0;
  } else {
    at.y = 0;
    f.heading = Math.round(f.heading / (Math.PI / 2)) * (Math.PI / 2);
  }
  f.group.rotation.set(0, f.heading, 0);
  f.moored = true;
  settle(f);
  return onBoat(f, f.helm.x, f.helm.z - 0.9);
}
// input: { throttle: -1..1 (moves the throttle lever), steer: -1 (right) .. 1 (left), cut: back to idle }.
export function updateFishingBoat(seaParts, time, dt, ridden, input) {
  const f = seaParts.fishing, position = f.group.position, { shoreX, pier } = seaParts;
  if (f.moored) { f.wake.material.opacity = 0; return; }
  if (f === ridden) {
    f.throttle = THREE.MathUtils.clamp(f.throttle + input.throttle * 0.4 * dt, -0.2, 1);
    if (input.cut) f.throttle = 0;
    f.steer += (input.steer - f.steer) * Math.min(1, 2 * dt);
    f.heading += f.steer * 0.55 * THREE.MathUtils.clamp(f.speed / 5, -1, 1) * dt; // a heavy boat turns slowly
  } else {
    f.throttle = 0;
    f.steer *= 1 - Math.min(1, 2 * dt);
  }
  f.speed += (f.throttle * BOAT_TOP_SPEED - f.speed) * Math.min(1, 0.5 * dt);
  position.x += Math.sin(f.heading) * f.speed * dt;
  position.z += Math.cos(f.heading) * f.speed * dt;

  // She needs deep water, stays on the map, and can't go through the pier.
  if (position.x < shoreX + 14) { position.x = shoreX + 14; f.speed *= 1 - Math.min(1, 3 * dt); }
  position.x = Math.min(position.x, shoreX + 420);
  position.z = THREE.MathUtils.clamp(position.z, -1100, 1100);
  if (position.x < pier.to + 2.7 && Math.abs(position.z - pier.z) < 5.5) {
    if (position.x > pier.to - 1) position.x = pier.to + 2.7;
    else position.z = pier.z + (position.z < pier.z ? -5.5 : 5.5);
    f.speed *= 1 - Math.min(1, 3 * dt);
  }

  // Rolling on the swell, heeling a little in turns.
  position.y = Math.sin(time * 1.1) * 0.06;
  f.group.rotation.set(Math.sin(time * 0.9) * 0.015 - Math.max(f.speed, 0) * 0.002, f.heading, Math.sin(time * 1.3) * 0.025 - f.steer * f.speed * 0.006, 'YXZ');
  f.wake.position.set(position.x, WATER + 0.03, position.z);
  f.wake.rotation.y = f.heading;
  f.wake.material.opacity = THREE.MathUtils.clamp((f.speed - 0.8) / 8, 0, 0.8);
  if (f.engine) f.engine.tone.frequency.setTargetAtTime(52 + Math.abs(f.speed) * 4, f.engine.context.currentTime, 0.15); // a slow diesel thud
}
