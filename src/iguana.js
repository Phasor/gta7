// Iguanas, the big lizards that sun themselves all over Florida.
// They bask in the yard bobbing their heads, wander a little, and scurry away
// when the player comes close. Each one is built in code: a long tapering body
// and whip tail with dark bands, a spiky crest down the back, a throat flap,
// the pale round cheek scale, and four sprawled legs with long toes.
import * as THREE from 'three';
import { pushOut, floorAt } from './world.js';

const LENGTH = 1.4;      // snout to tail tip, metres
const NOSE_Z = 0.6;      // the body runs from here back along -Z
const RINGS = 60, SIDES = 16;

// The body's shape from snout (0) to tail tip (1):
// [where, half-width, half-height, height of its middle above the ground].
// The head is a blunt wedge, the neck narrower, the belly broad and low.
const SHAPE = [
  [0, 0.014, 0.012, 0.207], [0.02, 0.03, 0.024, 0.212], [0.05, 0.043, 0.036, 0.218], [0.085, 0.047, 0.04, 0.214],
  [0.12, 0.038, 0.037, 0.198], [0.2, 0.066, 0.062, 0.158], [0.32, 0.092, 0.078, 0.128], [0.44, 0.07, 0.062, 0.112],
  [0.52, 0.046, 0.043, 0.088], [0.7, 0.023, 0.022, 0.034], [1, 0.004, 0.004, 0.012],
];
function shapeAt(t) {
  let i = 1;
  while (i < SHAPE.length - 1 && SHAPE[i][0] < t) i++;
  const a = SHAPE[i - 1], b = SHAPE[i], s = THREE.MathUtils.smoothstep(t, a[0], b[0]);
  return { wide: a[1] + (b[1] - a[1]) * s, tall: a[2] + (b[2] - a[2]) * s, height: a[3] + (b[3] - a[3]) * s };
}

// Skin, painted in greys so each iguana can be tinted its own colour: small
// scales, a paler belly, a mouth line, and dark bands round the tail. Left to
// right is snout to tail; top to bottom is once round the body from the spine.
function skinTexture() {
  const W = 512, H = 128;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#b4b4aa';
  ctx.fillRect(0, 0, W, H);
  const belly = ctx.createLinearGradient(0, 0, 0, H);
  for (const [stop, alpha] of [[0, 0], [0.28, 0], [0.5, 0.8], [0.72, 0], [1, 0]]) belly.addColorStop(stop, `rgba(250,250,235,${alpha})`);
  ctx.fillStyle = belly;
  ctx.fillRect(0, 0, W, H);
  const back = ctx.createLinearGradient(0, 0, 0, H); // darker along the spine
  for (const [stop, alpha] of [[0, 0.3], [0.15, 0], [0.85, 0], [1, 0.3]]) back.addColorStop(stop, `rgba(30,35,25,${alpha})`);
  ctx.fillStyle = back;
  ctx.fillRect(0, 0, W, H);
  for (let u = 0.5; u < 1; u += 0.05) { // tail bands, and fainter stripes on the flanks
    ctx.fillStyle = 'rgba(28,32,22,0.8)';
    ctx.fillRect(u * W, 0, W * 0.022, H);
  }
  for (let u = 0.2; u < 0.48; u += 0.06) {
    ctx.fillStyle = 'rgba(30,40,22,0.3)';
    ctx.fillRect(u * W, 0, W * 0.014, H * 0.36);
    ctx.fillRect(u * W, H * 0.64, W * 0.014, H * 0.36);
  }
  for (let y = 0; y < H; y += 3) for (let x = (y / 3) % 2 * 2; x < W; x += 4) { // scales
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(15,20,10,0.22)' : 'rgba(255,255,240,0.16)';
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.fillStyle = 'rgba(20,22,15,0.85)'; // mouth
  ctx.fillRect(0, H * 0.31, W * 0.075, 1.5);
  ctx.fillRect(0, H * 0.69, W * 0.075, 1.5);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function bodyGeometry() {
  const positions = [], uvs = [], index = [];
  for (let i = 0; i <= RINGS; i++) {
    const t = i / RINGS, { wide, tall, height } = shapeAt(t);
    for (let j = 0; j <= SIDES; j++) {
      const a = (j / SIDES) * Math.PI * 2; // 0 is the spine
      // Flatter underneath than on top, like a real belly.
      const up = Math.cos(a), y = height + (up > 0 ? up : up * 0.8) * tall;
      positions.push(Math.sin(a) * wide, Math.max(0.003, y), NOSE_Z - t * LENGTH);
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

// The row of spines down the neck, back and start of the tail: tallest on the neck.
function crestGeometry() {
  const positions = [];
  for (let t = 0.1; t < 0.66; t += 0.009) {
    const tall = t < 0.28 ? 0.075 : Math.max(0.008, 0.075 - (t - 0.28) * 0.19);
    const a = shapeAt(t), b = shapeAt(t + 0.006);
    const z = NOSE_Z - t * LENGTH;
    positions.push(
      0, a.height + a.tall * 0.97, z,
      0, b.height + b.tall * 0.97, z - 0.006 * LENGTH,
      0, a.height + a.tall + tall, z - 0.016 * LENGTH // swept back
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

// A limb section between two points, thicker at the body end.
function limb(parent, material, from, to, thick, thin) {
  const length = from.distanceTo(to);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(thick, thin, length, 8), material);
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), to.clone().sub(from).normalize());
  mesh.castShadow = true;
  parent.add(mesh);
}

// A sprawled leg: a muscular upper part out sideways to the elbow, down to the foot, then long clawed toes.
function makeLeg(parent, material, side, front) {
  const leg = new THREE.Group();
  const high = front ? 0.135 : 0.105;
  leg.position.set(side * 0.05, high, front ? 0.32 : -0.02);
  const V = THREE.Vector3;
  const elbow = new V(side * 0.1, 0.005, front ? -0.02 : 0.035);
  const foot = new V(side * 0.118, -high + 0.012, front ? 0.03 : -0.03);
  limb(leg, material, new V(0, 0, 0), elbow, front ? 0.024 : 0.032, front ? 0.017 : 0.02);
  limb(leg, material, elbow, foot, front ? 0.016 : 0.019, 0.011);
  const joint = new THREE.Mesh(new THREE.SphereGeometry(front ? 0.018 : 0.021, 8, 6), material);
  joint.position.copy(elbow);
  leg.add(joint);
  for (let toe = 0; toe < 5; toe++) {
    const angle = ((toe - 2) * 0.33 + 0.3) * side;
    const reach = (front ? 0.055 : 0.085) * (1 - Math.abs(toe - 2.4) * 0.14);
    limb(leg, material, foot, new V(foot.x + Math.sin(angle) * reach, -high + 0.004, foot.z + Math.cos(angle) * reach), 0.006, 0.0025);
  }
  parent.add(leg);
  return leg;
}

// spots: [x, z, heading, colour, size] for each iguana.
// calm: they never move off (for checking how they look).
export function createIguanas(scene, spots, calm = false) {
  const skin = skinTexture();
  const body = bodyGeometry(), crest = crestGeometry();
  const eyeGold = new THREE.MeshStandardMaterial({ color: 0xc98a2a, roughness: 0.25 });
  const eyeBlack = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.1 });

  return spots.map(([x, z, heading, colour, size]) => {
    const tint = new THREE.Color(colour);
    const hide = new THREE.MeshStandardMaterial({ map: skin, bumpMap: skin, bumpScale: 2, color: tint, roughness: 0.7 });
    const dark = new THREE.MeshStandardMaterial({ color: tint.clone().multiplyScalar(0.5), roughness: 0.8, side: THREE.DoubleSide });
    const pale = new THREE.MeshStandardMaterial({ color: tint.clone().lerp(new THREE.Color(0xe9e6cf), 0.6), roughness: 0.8, side: THREE.DoubleSide });

    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = heading;
    group.scale.setScalar(size);

    // The body and crest bend as it walks, so each iguana needs its own copy.
    const bodyMesh = new THREE.Mesh(body.clone(), hide);
    bodyMesh.castShadow = true;
    const crestMesh = new THREE.Mesh(crest.clone(), dark);
    crestMesh.castShadow = true;
    group.add(bodyMesh, crestMesh);

    // Head details: eyes under brow ridges, nostrils, the round pale cheek
    // scale, and the flap under the throat.
    const headParts = new THREE.Group();
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0115, 12, 8), eyeGold);
      eye.position.set(side * 0.034, 0.24, 0.538);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 8, 6), eyeBlack);
      pupil.position.set(side * 0.0415, 0.241, 0.54);
      const brow = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), hide);
      brow.scale.set(0.7, 0.45, 1.5);
      brow.position.set(side * 0.03, 0.253, 0.538);
      const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.003, 6, 4), eyeBlack);
      nostril.position.set(side * 0.012, 0.222, 0.593);
      const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.018, 16), pale);
      cheek.position.set(side * 0.0475, 0.196, 0.47);
      cheek.rotation.y = side * Math.PI / 2;
      headParts.add(eye, pupil, brow, nostril, cheek);
    }
    const dewlap = new THREE.Mesh(new THREE.CircleGeometry(0.08, 16, Math.PI, Math.PI), pale);
    dewlap.rotation.y = Math.PI / 2;
    dewlap.position.set(0, 0.185, 0.455);
    headParts.add(dewlap);
    group.add(headParts);

    const legs = [makeLeg(group, hide, -1, true), makeLeg(group, hide, 1, false), makeLeg(group, hide, 1, true), makeLeg(group, hide, -1, false)];
    scene.add(group);

    return {
      group, headParts, legs, calm,
      meshes: [bodyMesh, crestMesh].map((mesh) => ({ attribute: mesh.geometry.attributes.position, rest: mesh.geometry.attributes.position.array.slice() })),
      home: new THREE.Vector3(x, 0, z), target: new THREE.Vector3(x, 0, z),
      state: 'bask', timer: 2 + Math.random() * 8, speed: 0, stride: Math.random() * 6, bobTime: Math.random() * 5,
    };
  });
}

// Bend the body from side to side in a wave that grows toward the tail, and nod the head.
function pose(iguana, bob) {
  for (const { attribute, rest } of iguana.meshes) {
    const p = attribute.array;
    for (let i = 0; i < p.length; i += 3) {
      const z = rest[i + 2];
      const behind = Math.max(0, 0.35 - z);                 // 0 at the shoulders, growing to the tail tip
      p[i] = rest[i] + Math.sin(iguana.stride + z * 6.5) * behind * behind * 0.11;
      p[i + 1] = rest[i + 1] + bob * Math.max(0, z - 0.2) * 0.5;
    }
    attribute.needsUpdate = true;
  }
  iguana.headParts.position.y = bob * 0.15;
}

export function updateIguanas(iguanas, playerPosition, dt) {
  for (const iguana of iguanas) {
    if (iguana.state === 'dead') continue;      // lying where it fell until someone picks it up
    if (iguana.state === 'gone') {              // picked up: a new one turns up here after a while
      iguana.gone -= dt;
      if (iguana.gone <= 0) {
        iguana.group.visible = true;
        iguana.group.rotation.z = 0;
        iguana.group.position.copy(iguana.home);
        iguana.state = 'bask';
        iguana.timer = 3 + Math.random() * 6;
      }
      continue;
    }
    const position = iguana.group.position;
    iguana.timer -= dt;
    const fromPlayerX = position.x - playerPosition.x, fromPlayerZ = position.z - playerPosition.z;
    const playerDistance = Math.hypot(fromPlayerX, fromPlayerZ);

    // Startled: bolt directly away from the player.
    if (playerDistance < 3.5 && iguana.state !== 'flee' && !iguana.calm) {
      iguana.state = 'flee';
      iguana.timer = 4;
    }

    let wantSpeed = 0, headingX = 0, headingZ = 0;
    if (iguana.state === 'flee') {
      if (playerDistance > 10 || iguana.timer <= 0) {
        iguana.state = 'bask';
        iguana.timer = 4 + Math.random() * 8;
        iguana.home.copy(position);
      } else {
        wantSpeed = 3.4;
        headingX = fromPlayerX; headingZ = fromPlayerZ;
      }
    } else if (iguana.state === 'bask') {
      if (iguana.timer <= 0 && !iguana.calm) { // amble somewhere nearby
        const angle = Math.random() * Math.PI * 2, distance = 1.5 + Math.random() * 4;
        iguana.target.set(iguana.home.x + Math.cos(angle) * distance, 0, iguana.home.z + Math.sin(angle) * distance);
        iguana.state = 'walk';
        iguana.timer = 12;
      }
    } else {
      headingX = iguana.target.x - position.x; headingZ = iguana.target.z - position.z;
      if (Math.hypot(headingX, headingZ) < 0.3 || iguana.timer <= 0) {
        iguana.state = 'bask';
        iguana.timer = 5 + Math.random() * 12;
      } else {
        wantSpeed = 0.45;
      }
    }

    iguana.speed += (wantSpeed - iguana.speed) * Math.min(1, 8 * dt);
    if (wantSpeed > 0) {
      let turn = Math.atan2(headingX, headingZ) - iguana.group.rotation.y;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      iguana.group.rotation.y += turn * Math.min(1, 7 * dt);
    }
    if (iguana.speed > 0.01) {
      position.x += Math.sin(iguana.group.rotation.y) * iguana.speed * dt;
      position.z += Math.cos(iguana.group.rotation.y) * iguana.speed * dt;
      pushOut(position, 0.2);
      iguana.stride += iguana.speed * dt * 9 + dt * 3;
    }
    position.y = floorAt(position);

    // Legs step in diagonal pairs.
    const swing = Math.sin(iguana.stride) * 0.55 * Math.min(1, iguana.speed * 3);
    iguana.legs[0].rotation.y = swing;  iguana.legs[1].rotation.y = swing;
    iguana.legs[2].rotation.y = -swing; iguana.legs[3].rotation.y = -swing;

    // While basking, every so often it does a few quick head bobs.
    iguana.bobTime += dt;
    const cycle = iguana.bobTime % 7;
    const bob = iguana.state === 'bask' && cycle < 1.2 ? Math.max(0, Math.sin(cycle * 16)) * 0.09 : 0;
    pose(iguana, bob);
  }
}

// Which living iguana, if any, a bullet from `origin` along `direction` reaches
// first within `maxDistance`. Returns { iguana, distance } or null.
export function findIguanaHit(iguanas, origin, direction, maxDistance) {
  let best = null;
  for (const iguana of iguanas) {
    if (iguana.state === 'dead' || iguana.state === 'gone') continue;
    const p = iguana.group.position, size = iguana.group.scale.x;
    const ox = origin.x - p.x, oy = origin.y - (p.y + 0.15 * size), oz = origin.z - p.z;
    const along = ox * direction.x + oy * direction.y + oz * direction.z;
    const inside = along * along - (ox * ox + oy * oy + oz * oz - (0.45 * size) ** 2);
    if (inside < 0) continue;
    const distance = -along - Math.sqrt(inside);
    if (distance > 0 && distance < maxDistance && (!best || distance < best.distance)) best = { iguana, distance };
  }
  return best;
}

// Kill an iguana: it rolls onto its back and lies still.
export function killIguana(iguana) {
  if (iguana.state === 'dead' || iguana.state === 'gone') return;
  iguana.state = 'dead';
  iguana.speed = 0;
  iguana.group.rotation.z = Math.PI;
  iguana.group.position.y += 0.26 * iguana.group.scale.x;
}

// Pick a dead iguana up: it disappears, and another appears in its place later.
export function collectIguana(iguana) {
  iguana.state = 'gone';
  iguana.gone = 40;
  iguana.group.visible = false;
}
