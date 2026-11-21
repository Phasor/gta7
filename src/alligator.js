// Alligators in the lake. Most cruise slowly with only their eyes, nostrils and
// the ridges of their back showing above the murky water, sweeping their tails
// from side to side; they sink out of sight if a boat comes close. A couple bask
// on the bank and slide into the water when the player walks up.
//
// Each one is built in code: a broad flat head with a long rounded snout, eyes
// and nostrils raised on top, teeth along the jaw, rows of bony plates down the
// back that merge into a crest on the tail, short sprawled legs, and dark
// olive-black scaly skin with a pale belly.
import * as THREE from 'three';
import { water, shoreRadius } from './world.js';

const WATER_LEVEL = 0.035;
const LENGTH = 3.2;        // snout to tail tip, metres, for a size of 1
const NOSE_Z = 1.5;        // the body runs from here back along -Z
const RINGS = 72, SIDES = 18;
const FLOAT = -0.2;        // how low it rides when swimming: just the top of the back and head showing
const DIVE = -0.5;         // fully under

// The body's shape from snout (0) to tail tip (1):
// [where, half-width, half-height, height of its middle above the ground].
const SHAPE = [
  [0, 0.03, 0.01, 0.118], [0.008, 0.095, 0.026, 0.12], [0.03, 0.124, 0.035, 0.122], [0.09, 0.128, 0.039, 0.126],
  [0.14, 0.138, 0.052, 0.14], [0.175, 0.158, 0.07, 0.158], [0.21, 0.162, 0.076, 0.16], [0.25, 0.145, 0.08, 0.152],
  [0.33, 0.2, 0.115, 0.146], [0.45, 0.25, 0.135, 0.15], [0.55, 0.2, 0.12, 0.14], [0.62, 0.13, 0.11, 0.125],
  [0.8, 0.052, 0.085, 0.095], [1, 0.008, 0.03, 0.04],
];
function shapeAt(t) {
  let i = 1;
  while (i < SHAPE.length - 1 && SHAPE[i][0] < t) i++;
  const a = SHAPE[i - 1], b = SHAPE[i], s = THREE.MathUtils.smoothstep(t, a[0], b[0]);
  return { wide: a[1] + (b[1] - a[1]) * s, tall: a[2] + (b[2] - a[2]) * s, height: a[3] + (b[3] - a[3]) * s };
}
const zAt = (t) => NOSE_Z - t * LENGTH;

// Skin: big squarish scales, near-black along the back, olive on the flanks, a
// cream belly, mottled blotches, faint pale bands on the tail, and the line of
// the mouth. Left to right is snout to tail; top to bottom is once round the body.
function skinTexture() {
  const W = 1024, H = 256;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3c4230';
  ctx.fillRect(0, 0, W, H);
  const around = ctx.createLinearGradient(0, 0, 0, H);
  for (const [stop, colour] of [[0, 'rgba(18,20,14,0.9)'], [0.2, 'rgba(18,20,14,0.25)'], [0.34, 'rgba(210,200,150,0)'],
    [0.5, 'rgba(214,206,160,0.95)'], [0.66, 'rgba(210,200,150,0)'], [0.8, 'rgba(18,20,14,0.25)'], [1, 'rgba(18,20,14,0.9)']]) around.addColorStop(stop, colour);
  ctx.fillStyle = around;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) { // mottling
    ctx.fillStyle = Math.random() < 0.6 ? 'rgba(12,14,9,0.22)' : 'rgba(120,125,80,0.16)';
    ctx.beginPath();
    ctx.ellipse(Math.random() * W, Math.random() * H, 6 + Math.random() * 16, 4 + Math.random() * 9, 0, 0, 7);
    ctx.fill();
  }
  for (let u = 0.6; u < 1; u += 0.055) { // pale bands on the tail
    ctx.fillStyle = 'rgba(190,180,110,0.22)';
    ctx.fillRect(u * W, 0, W * 0.014, H);
  }
  ctx.strokeStyle = 'rgba(8,9,6,0.55)';   // scales: a grid of grooves, offset row by row
  ctx.lineWidth = 1;
  for (let y = 0; y < H; y += 8) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    for (let x = (y / 8) % 2 * 5; x < W; x += 10) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 8); ctx.stroke(); }
  }
  for (let i = 0; i < 9000; i++) { // a highlight on some scales
    ctx.fillStyle = 'rgba(200,205,160,0.08)';
    ctx.fillRect(Math.random() * W, Math.random() * H, 3, 2);
  }
  ctx.fillStyle = 'rgba(8,8,6,0.9)'; // mouth line, curving up toward the back of the jaw
  for (const side of [0.335, 0.665]) for (let px = 0; px < W * 0.215; px++) {
    const along = px / (W * 0.215);
    ctx.fillRect(px, H * (side + (side < 0.5 ? -1 : 1) * 0.03 * Math.sin(along * 5) * along), 1.5, 2.2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// The body: a tube with a boxy, flat-bottomed cross-section.
function bodyGeometry() {
  const positions = [], uvs = [], index = [];
  const squarish = (v) => Math.sign(v) * Math.abs(v) ** 0.72;
  for (let i = 0; i <= RINGS; i++) {
    const t = i / RINGS, { wide, tall, height } = shapeAt(t);
    for (let j = 0; j <= SIDES; j++) {
      const a = (j / SIDES) * Math.PI * 2, up = squarish(Math.cos(a));
      positions.push(squarish(Math.sin(a)) * wide, Math.max(0.004, height + (up > 0 ? up : up * 0.85) * tall), zAt(t));
      uvs.push(t, j / SIDES);
    }
  }
  for (let i = 0; i < RINGS; i++) for (let j = 0; j < SIDES; j++) {
    const a = i * (SIDES + 1) + j, b = a + SIDES + 1;
    index.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

// The bony plates: six rows of low ridges across the back, narrowing to two
// taller rows on the tail, which join into a single upright crest to the tip.
function platesGeometry() {
  const positions = [];
  const plate = (px, py, pz, across, along, tall) => { // a little four-sided ridge, steeper at the back
    const corners = [[-across, 0, along], [across, 0, along], [across, 0, -along], [-across, 0, -along]];
    const peak = [px, py + tall, pz - along * 0.4];
    for (let k = 0; k < 4; k++) {
      const a = corners[k], b = corners[(k + 1) % 4];
      positions.push(px + a[0], py + a[1], pz + a[2], px + b[0], py + b[1], pz + b[2], ...peak);
    }
  };
  for (let t = 0.26; t < 0.62; t += 0.0165) {
    const s = shapeAt(t);
    for (const row of [-0.62, -0.37, -0.12, 0.12, 0.37, 0.62]) {
      const edge = Math.abs(row);
      plate(row * s.wide, s.height + s.tall * (1 - edge * edge * 0.45) - 0.004, zAt(t), s.wide * 0.11, 0.022, 0.022 + (1 - edge) * 0.012);
    }
  }
  for (let t = 0.62; t < 0.8; t += 0.017) {
    const s = shapeAt(t);
    for (const row of [-0.5, 0.5]) plate(row * s.wide, s.height + s.tall * 0.9, zAt(t), 0.014, 0.024, 0.05);
  }
  for (let t = 0.8; t < 0.985; t += 0.016) {
    const s = shapeAt(t);
    plate(0, s.height + s.tall * 0.95, zAt(t), 0.008, 0.024, 0.055 * (1.1 - (t - 0.8) * 3));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function limb(parent, material, from, to, thick, thin) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(thick, thin, from.distanceTo(to), 8), material);
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), to.clone().sub(from).normalize());
  mesh.castShadow = true;
  parent.add(mesh);
}

// A short, thick, sprawled leg ending in a flat webbed foot with clawed toes.
function makeLeg(parent, material, clawMaterial, side, front) {
  const leg = new THREE.Group();
  const high = front ? 0.13 : 0.12, V = THREE.Vector3;
  leg.position.set(side * (front ? 0.17 : 0.17), high, front ? zAt(0.34) : zAt(0.57));
  const elbow = new V(side * 0.15, -0.02, front ? -0.03 : 0.05);
  const foot = new V(side * 0.2, -high + 0.02, front ? 0.07 : -0.03);
  limb(leg, material, new V(0, 0, 0), elbow, front ? 0.055 : 0.07, front ? 0.042 : 0.05);
  limb(leg, material, elbow, foot, front ? 0.04 : 0.048, 0.03);
  const knee = new THREE.Mesh(new THREE.SphereGeometry(front ? 0.045 : 0.053, 8, 6), material);
  knee.position.copy(elbow);
  leg.add(knee);
  const pad = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), material);
  pad.scale.set(1.1, 0.35, 1.3);
  pad.position.set(foot.x, -high + 0.018, foot.z + 0.03);
  leg.add(pad);
  for (let toe = 0; toe < (front ? 5 : 4); toe++) {
    const angle = ((toe - 1.8) * 0.36 + 0.25) * side, reach = front ? 0.09 : 0.12;
    const tip = new V(foot.x + Math.sin(angle) * reach, -high + 0.008, foot.z + 0.03 + Math.cos(angle) * reach);
    limb(leg, material, new V(foot.x, -high + 0.02, foot.z + 0.03), tip, 0.013, 0.007);
    limb(leg, clawMaterial, tip, new V(tip.x + Math.sin(angle) * 0.03, -high + 0.004, tip.z + Math.cos(angle) * 0.03), 0.006, 0.001);
  }
  parent.add(leg);
  return leg;
}

// count: how many swim; the two extra ones start out basking on the bank.
export function createAlligators(scene, count = 6) {
  const skin = skinTexture();
  const body = bodyGeometry(), plates = platesGeometry();
  const hide = new THREE.MeshStandardMaterial({ map: skin, bumpMap: skin, bumpScale: 3.5, roughness: 0.5 });
  const armour = new THREE.MeshStandardMaterial({ color: 0x23271c, roughness: 0.55, flatShading: true });
  const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x9aa33a, roughness: 0.15 });
  const black = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.2 });
  const tooth = new THREE.MeshStandardMaterial({ color: 0xe9e4cf, roughness: 0.4 });
  const claw = new THREE.MeshStandardMaterial({ color: 0x1a1a14, roughness: 0.5 });

  const alligators = [];
  for (let i = 0; i < count + 2; i++) {
    const group = new THREE.Group();
    group.rotation.order = 'YXZ';
    group.scale.setScalar(0.8 + Math.random() * 0.4);

    // The body and plates bend as the tail sweeps, so each alligator needs its own copy.
    const bodyMesh = new THREE.Mesh(body.clone(), hide);
    bodyMesh.castShadow = true;
    const plateMesh = new THREE.Mesh(plates.clone(), armour);
    plateMesh.castShadow = true;
    group.add(bodyMesh, plateMesh);

    // Head details. The head doesn't bend, so these are simply fixed in place.
    const eyes = shapeAt(0.185), snout = shapeAt(0.02);
    for (const side of [-1, 1]) {
      const socket = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), hide); // bony ridge the eye sits in
      socket.scale.set(0.8, 0.62, 1.25);
      socket.position.set(side * 0.09, eyes.height + eyes.tall * 0.88, zAt(0.188));
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 8), eyeMaterial);
      eye.position.set(side * 0.112, eyes.height + eyes.tall * 0.98, zAt(0.183));
      const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.034, 0.012), black);   // a vertical slit
      pupil.position.set(side * 0.1345, eyes.height + eyes.tall * 0.98, zAt(0.183));
      const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 4), black);
      nostril.position.set(side * 0.018, snout.height + snout.tall + 0.02, zAt(0.018));
      group.add(socket, eye, pupil, nostril);
      // Teeth showing along the upper jaw.
      for (let k = 0; k < 15; k++) {
        const t = 0.012 + k * 0.0128, s = shapeAt(t);
        const fang = new THREE.Mesh(new THREE.ConeGeometry(0.0055 + (k % 4 === 1 ? 0.003 : 0), 0.018 + (k % 4 === 1 ? 0.012 : 0), 5), tooth);
        fang.rotation.x = Math.PI;
        fang.position.set(side * s.wide * 0.97, s.height - 0.012, zAt(t));
        group.add(fang);
      }
    }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 8), hide); // the raised bump the nostrils sit on
    nose.scale.set(1, 0.55, 1);
    nose.position.set(0, snout.height + snout.tall + 0.004, zAt(0.02));
    group.add(nose);

    const legs = [makeLeg(group, hide, claw, -1, true), makeLeg(group, hide, claw, 1, false), makeLeg(group, hide, claw, 1, true), makeLeg(group, hide, claw, -1, false)];
    scene.add(group);

    const basking = i >= count;
    const angle = basking ? Math.PI / 2 + (i === count ? -0.42 : 0.5) : Math.random() * Math.PI * 2;
    const r = basking ? shoreRadius(angle) * 1.035 : shoreRadius(angle) * (0.2 + Math.random() * 0.55);
    group.position.set(water.x + Math.cos(angle) * r, basking ? 0.012 : WATER_LEVEL + FLOAT, water.z + Math.sin(angle) * r);
    const heading = basking ? Math.atan2(-Math.sin(angle), Math.cos(angle)) + 0.25 : Math.random() * Math.PI * 2; // baskers lie along the bank
    group.rotation.y = heading;

    alligators.push({
      group, legs, heading,
      meshes: [bodyMesh, plateMesh].map((mesh) => ({ attribute: mesh.geometry.attributes.position, rest: mesh.geometry.attributes.position.array.slice() })),
      state: basking ? 'bask' : 'swim', target: new THREE.Vector3(), timer: 0, speed: 0, depth: basking ? 0 : FLOAT,
      stride: Math.random() * 6, phase: Math.random() * 6,
    });
  }
  return alligators;
}

// Sweep the tail from side to side: the bend grows from the shoulders to the tip.
function pose(gator, sweep) {
  for (const { attribute, rest } of gator.meshes) {
    const p = attribute.array;
    for (let i = 0; i < p.length; i += 3) {
      const behind = Math.max(0, 0.3 - rest[i + 2]);
      p[i] = rest[i] + Math.sin(gator.stride + rest[i + 2] * 2.4) * behind * behind * sweep;
    }
    attribute.needsUpdate = true;
  }
}

// prey: true while the player is in the water (wading or swimming, not in a boat).
// onCatch(gator) is called at the moment one reaches him.
export function updateAlligators(alligators, playerPosition, dt, time, prey = false, onCatch = null) {
  for (const gator of alligators) {
    const position = gator.group.position;
    gator.timer -= dt;
    gator.rest = Math.max(0, (gator.rest || 0) - dt);
    const dx = position.x - water.x, dz = position.z - water.z, fromCentre = Math.hypot(dx, dz) || 1;
    const bank = shoreRadius(Math.atan2(dz, dx));
    const playerDistance = Math.hypot(position.x - playerPosition.x, position.z - playerPosition.z);
    let wantSpeed = 0, wantHeading = gator.heading, wantDepth = 0, sweep = 0.012, turnRate = 0.6;

    if (gator.state === 'show') { // test view: lies still on land
      pose(gator, 0.012);
      continue;
    }
    if (gator.state === 'bask') {
      // Lying on the bank until someone gets too close.
      if (playerDistance < 7) gator.state = 'enter';
    } else if (gator.state === 'enter') {
      // Turn for the water and slide in.
      wantHeading = Math.atan2(-dx, -dz);
      wantSpeed = 2.4; turnRate = 3; sweep = 0.03;
      wantDepth = fromCentre < bank - 0.5 ? FLOAT : 0;
      if (fromCentre < bank - 6) { gator.state = 'swim'; gator.timer = 0; }
    } else if (gator.state === 'stalk') {
      // Hunting: fully under the murky water, closing in slowly and silently.
      if (!prey) { gator.state = 'swim'; gator.timer = 0; }
      wantHeading = Math.atan2(playerPosition.x - position.x, playerPosition.z - position.z);
      wantSpeed = fromCentre > bank - 2.5 ? 0 : 1.5;   // a little slower than he swims
      wantDepth = DIVE; turnRate = 1.6; sweep = 0.06;
      if (prey && playerDistance < 2.3) {               // got him: it bursts up out of the water
        gator.state = 'attack';
        gator.timer = 4.5;
        onCatch?.(gator);
      }
    } else if (gator.state === 'attack') {
      // Showing itself: head and back right out of the water, facing him.
      wantHeading = Math.atan2(playerPosition.x - position.x, playerPosition.z - position.z);
      wantDepth = -0.03; sweep = 0.09; turnRate = 3;
      gator.depth += (wantDepth - gator.depth) * Math.min(1, 6 * dt); // surfaces fast
      if (gator.timer <= 0) { gator.state = 'swim'; gator.timer = 0; gator.rest = 10; }
    } else {
      if (prey && gator.rest <= 0 && playerDistance < 90) gator.state = 'stalk';
      // Cruising. If the player comes close it sinks out of sight and moves off.
      const startled = playerDistance < 9;
      if (startled) gator.diveTime = 7;
      gator.diveTime = Math.max(0, (gator.diveTime || 0) - dt);
      if (gator.timer <= 0 || Math.hypot(gator.target.x - position.x, gator.target.z - position.z) < 4) {
        const angle = Math.random() * Math.PI * 2, r = shoreRadius(angle) * (0.1 + Math.random() * 0.72);
        gator.target.set(water.x + Math.cos(angle) * r, 0, water.z + Math.sin(angle) * r);
        gator.timer = 25 + Math.random() * 30;
        gator.cruise = Math.random() < 0.3 ? 0 : 0.45 + Math.random() * 0.5; // sometimes it just hangs in the water
      }
      wantHeading = startled
        ? Math.atan2(position.x - playerPosition.x, position.z - playerPosition.z)
        : Math.atan2(gator.target.x - position.x, gator.target.z - position.z);
      if (fromCentre > bank - 5) wantHeading = Math.atan2(-dx, -dz); // keep off the bank
      wantSpeed = gator.diveTime > 0 ? 1.7 : gator.cruise;
      wantDepth = gator.diveTime > 0 ? DIVE : FLOAT;
      sweep = 0.035 + wantSpeed * 0.035;
    }

    gator.speed += (wantSpeed - gator.speed) * Math.min(1, 1.5 * dt);
    let turn = wantHeading - gator.heading;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    if (gator.speed > 0.05) gator.heading += THREE.MathUtils.clamp(turn, -turnRate * dt, turnRate * dt);
    position.x += Math.sin(gator.heading) * gator.speed * dt;
    position.z += Math.cos(gator.heading) * gator.speed * dt;
    gator.depth += (wantDepth - gator.depth) * Math.min(1, 1.2 * dt);
    const afloat = gator.state !== 'bask' && gator.depth < -0.02;
    position.y = (afloat ? WATER_LEVEL + Math.sin(time * 1.2 + gator.phase) * 0.012 : 0.012) + gator.depth;

    gator.group.rotation.y = gator.heading;
    gator.group.rotation.x = gator.state === 'attack' ? -0.2 : afloat ? -0.035 : 0; // snout tipped up a touch; reared up when attacking
    gator.stride += dt * (1.2 + gator.speed * 3.2);
    pose(gator, sweep);

    // On land the legs step in diagonal pairs; in the water they trail back along the body.
    const walking = gator.state === 'enter' && !afloat ? Math.sin(gator.stride * 2.4) * 0.5 : 0;
    const tucked = afloat ? 1 : 0;
    gator.legs.forEach((leg, k) => {
      const side = k === 0 || k === 3 ? -1 : 1, diagonal = k < 2 ? 1 : -1;
      const want = walking * diagonal + tucked * side * 0.9;
      leg.rotation.y += (want - leg.rotation.y) * Math.min(1, 6 * dt);
    });
  }
}
