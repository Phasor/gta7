// Life in the sea off the beach: shoals of fish, sharks, jellyfish and turtles,
// and rocks, coral, seaweed and starfish on the sandy bottom. Everything is made
// in code. Most of it is drawn in batches, so it costs very little.
import * as THREE from 'three';

const SAND = 0.15;
// How high the sea bed is, `out` metres from the water's edge (it shelves down to nine metres deep).
const bedY = (out) => SAND - Math.min(9.12, Math.max(0, out) * 0.12);

// A simple fish: a pointed body, flat from side to side, with a tail fin. It faces +Z.
function fishShape() {
  const nose = [0, 0, 0.5], top = [0, 0.19, 0.05], bottom = [0, -0.19, 0.05], left = [-0.075, 0, 0.05], right = [0.075, 0, 0.05];
  const root = [0, 0, -0.36], tailTop = [0, 0.19, -0.62], tailBottom = [0, -0.19, -0.62];
  const faces = [
    nose, top, right, nose, right, bottom, nose, bottom, left, nose, left, top,
    root, right, top, root, bottom, right, root, left, bottom, root, top, left,
    root, tailTop, tailBottom,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(faces.flat(), 3));
  geometry.computeVertexNormals();
  return geometry;
}

// A shark about three metres long: a smooth torpedo of a body, slate grey on top and white
// underneath, with a pointed snout, a tall back fin, long swept side fins, gill slits, a
// mouth full of teeth, and a crescent tail with the top lobe longer than the bottom.
function makeShark() {
  const shark = new THREE.Group();
  // The hide: grey along the back, fading through a wavy line to a white belly.
  const hide = document.createElement('canvas');
  hide.width = 128;
  hide.height = 64;
  const pen = hide.getContext('2d');
  for (let x = 0; x < 128; x++) {
    const around = Math.abs(x / 127 - 0.5) * 2;                    // 0 along the top of the back, 1 under the belly
    for (let y = 0; y < 64; y++) {
      const edge = 0.56 + Math.sin(y * 0.4) * 0.03, mix = Math.min(1, Math.max(0, (around - edge) / 0.1));
      const shade = 0.9 + Math.sin(x * 1.7 + y * 2.3) * 0.04;
      pen.fillStyle = `rgb(${(88 + mix * 150) * shade},${(100 + mix * 142) * shade},${(112 + mix * 130) * shade})`;
      pen.fillRect(x, y, 1, 1);
    }
  }
  const skinMap = new THREE.CanvasTexture(hide);
  skinMap.colorSpace = THREE.SRGBColorSpace;
  const skin = new THREE.MeshStandardMaterial({ map: skinMap, roughness: 0.42, metalness: 0.05 });
  const grey = new THREE.MeshStandardMaterial({ color: 0x566068, roughness: 0.45, side: THREE.DoubleSide });
  const dark = new THREE.MeshBasicMaterial({ color: 0x0a0b0c });
  const add = (mesh, x, y, z, parent = shark) => { mesh.position.set(x, y, z); parent.add(mesh); return mesh; };
  // The body, turned from its outline: [distance along it, radius], snout first.
  const outline = [[1.6, 0], [1.5, 0.07], [1.3, 0.17], [1.0, 0.29], [0.6, 0.39], [0.1, 0.43], [-0.4, 0.39], [-0.9, 0.29], [-1.3, 0.17], [-1.5, 0.1]];
  const body = new THREE.LatheGeometry(outline.map(([along, radius]) => new THREE.Vector2(radius, along)), 22);
  body.rotateX(Math.PI / 2);                                       // lay it along the length of the fish
  add(new THREE.Mesh(body, skin), 0, 0, 0).scale.set(0.82, 1, 1);  // a little taller than it is wide
  // Fins: flat blades cut from an outline.
  const blade = (points, thickness = 0.035) => {
    const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1 });
    geometry.translate(0, 0, -thickness / 2);
    return new THREE.Mesh(geometry, grey);
  };
  const upright = (mesh) => { mesh.rotation.y = -Math.PI / 2; return mesh; };       // an outline drawn [along, up] stood on the fish's back
  add(upright(blade([[-0.42, 0], [0.34, 0], [-0.3, 0.62], [-0.46, 0.56], [-0.34, 0.2]])), 0, 0.36, 0.2);      // the back fin, swept and notched
  add(upright(blade([[-0.14, 0], [0.12, 0], [-0.12, 0.17]], 0.02)), 0, 0.2, -0.95);                           // the small second back fin
  add(upright(blade([[-0.12, 0], [0.12, 0], [-0.1, -0.16]], 0.02)), 0, -0.19, -0.9);                          // and the one underneath
  for (const side of [-1, 1]) {
    const fin = add(blade([[0, 0.2], [0, -0.16], [0.86, -0.42], [0.7, -0.2]]), side * 0.26, -0.2, 0.62);     // long side fins, angled down and back
    fin.rotation.set(Math.PI / 2 + 0.25, 0, side > 0 ? -0.5 : Math.PI + 0.5);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), dark), side * 0.2, 0.07, 1.16);               // flat black eyes
    for (let slit = 0; slit < 5; slit++) add(new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.2 - slit * 0.012, 0.014), dark), side * (0.315 - slit * 0.004), -0.02, 0.84 - slit * 0.075).rotation.z = side * 0.2; // gills
  }
  // The mouth, curved under the snout, with a row of teeth.
  const mouth = add(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.022, 6, 16, Math.PI), dark), 0, -0.2, 1.08);
  mouth.rotation.x = Math.PI / 2 - 0.25;
  for (let tooth = 0; tooth < 9; tooth++) {
    const angle = (tooth + 0.5) / 9 * Math.PI;
    add(new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.05, 4), new THREE.MeshBasicMaterial({ color: 0xf4f2ea })), Math.cos(angle) * 0.15, -0.225, 1.08 + Math.sin(angle) * 0.15).rotation.x = Math.PI;
  }
  // The tail swings from side to side.
  const tail = new THREE.Group();
  tail.position.set(0, 0, -1.45);
  add(upright(blade([[0.14, 0.09], [0.14, -0.09], [-0.2, -0.06], [-0.5, -0.5], [-0.34, -0.08], [-0.3, 0.1], [-0.82, 0.86], [-0.3, 0.3], [-0.06, 0.1]], 0.03)), 0, 0, 0, tail);
  shark.add(tail);
  return { group: shark, tail };
}

function makeTurtle() {
  const turtle = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({ color: 0x4f6a35, roughness: 0.7 }), skin = new THREE.MeshStandardMaterial({ color: 0x8a9a5a, roughness: 0.8 });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), shell);
  dome.scale.set(0.8, 0.36, 1);
  const under = new THREE.Mesh(new THREE.SphereGeometry(0.46, 10, 6), new THREE.MeshStandardMaterial({ color: 0xd9c98a, roughness: 0.8 }));
  under.scale.set(0.76, 0.18, 0.95);
  under.position.y = -0.06;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), skin);
  head.position.set(0, 0.02, 0.6);
  turtle.add(dome, under, head);
  const flippers = [[1, 0.3, 0.5], [-1, 0.3, 0.5], [1, -0.36, 0.3], [-1, -0.36, 0.3]].map(([side, z, length]) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.36, -0.03, z);
    const paddle = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), skin);
    paddle.scale.set(length, 0.05, 0.22);
    paddle.position.x = side * length * 0.45;
    pivot.add(paddle);
    turtle.add(pivot);
    return { pivot, side, front: z > 0 };
  });
  return { group: turtle, flippers };
}

export function createSeaLife(scene, shoreX) {
  const life = new THREE.Group();
  const random = (low, high) => low + Math.random() * (high - low);
  const matrix = new THREE.Matrix4(), tint = new THREE.Color();

  // --- On the bottom: rocks, coral, seaweed and starfish ---
  const scatter = (geometry, material, count, place) => {
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    const position = new THREE.Vector3(), turn = new THREE.Quaternion(), size = new THREE.Vector3(), euler = new THREE.Euler();
    for (let i = 0; i < count; i++) {
      const out = random(10, 130), z = random(-170, 170);
      const { scale, lift = 0, tiltX = 0, tiltZ = 0, colour } = place(i, Math.max(0.3, out * 0.12 - 0.35)); // (told how deep the water is there, so nothing sticks out of it)
      position.set(shoreX + out, bedY(out) + lift, z);
      turn.setFromEuler(euler.set(tiltX, random(0, 6.28), tiltZ));
      mesh.setMatrixAt(i, matrix.compose(position, turn, size.set(...scale)));
      if (colour !== undefined) mesh.setColorAt(i, tint.set(colour));
    }
    mesh.castShadow = false;
    life.add(mesh);
    return mesh;
  };
  scatter(new THREE.DodecahedronGeometry(0.6, 0), new THREE.MeshStandardMaterial({ roughness: 0.95 }), 60, () => {
    const s = random(0.4, 1.7);
    return { scale: [s, s * random(0.45, 0.8), s * random(0.7, 1.2)], lift: 0.05, colour: [0x6f7068, 0x857f70, 0x5c6460][(Math.random() * 3) | 0] };
  });
  const CORAL = [0xf0764a, 0xf2a0b4, 0xf2c94a, 0xc85ad0, 0xff8a6a, 0xe8e2d0];
  scatter(new THREE.ConeGeometry(0.16, 1, 6), new THREE.MeshStandardMaterial({ roughness: 0.8 }), 150, (i, room) => {
    const s = Math.min(random(0.5, 1.5), room * 0.6);
    return { scale: [s, s * random(0.6, 1.4), s], lift: 0.3 * s, tiltX: random(-0.5, 0.5), tiltZ: random(-0.5, 0.5), colour: CORAL[(i >> 2) % CORAL.length] }; // (in clumps of one colour)
  });
  scatter(new THREE.BoxGeometry(0.07, 1, 0.02), new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide }), 220, (i, room) => {
    const tall = Math.min(random(0.6, 2.4), room * 0.85);
    return { scale: [random(0.8, 1.8), tall, 1], lift: tall / 2, tiltX: random(-0.2, 0.2), tiltZ: random(-0.2, 0.2), colour: [0x2f7a3a, 0x3f9a4a, 0x256a4a, 0x5a8a2f][(Math.random() * 4) | 0] };
  });
  scatter(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 5), new THREE.MeshStandardMaterial({ roughness: 0.8 }), 40, () => ({ scale: [1, 1, 1], lift: 0.04, colour: [0xe0562a, 0xf29a3a, 0xc23a5a][(Math.random() * 3) | 0] }));

  // --- Shoals of fish. Each shoal circles slowly, and every fish in it keeps its own place ---
  const SHOALS = 9, EACH = 18;
  const fish = new THREE.InstancedMesh(fishShape(), new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.3, side: THREE.DoubleSide }), SHOALS * EACH);
  const FISH_COLOURS = [0xf2a03a, 0xdfe6ea, 0x3fa0e0, 0xf2d24a, 0xe05a4a, 0x8fd0c0];
  const shoals = Array.from({ length: SHOALS }, (_, s) => {
    const out = random(14, 110), deep = -bedY(out);
    for (let i = 0; i < EACH; i++) fish.setColorAt(s * EACH + i, tint.set(FISH_COLOURS[s % FISH_COLOURS.length]).offsetHSL(0, 0, random(-0.06, 0.06)));
    return {
      x: shoreX + out, z: random(-130, 130), radius: random(4, 9), y: -random(0.5, Math.max(0.7, deep - 0.6)), speed: random(0.25, 0.5) * (Math.random() < 0.5 ? -1 : 1),
      phase: random(0, 6.28), size: random(0.55, 1.2),
      places: Array.from({ length: EACH }, () => [random(-1.4, 1.4), random(-0.5, 0.5), random(-0.5, 0.5), random(0, 6.28)]), // along, up, across, wiggle
    };
  });
  fish.frustumCulled = false; // they move, so the first box worked out for them would be wrong
  life.add(fish);

  // --- Jellyfish: a see-through bell that pulses, trailing tentacles ---
  const JELLIES = 16;
  const bells = new THREE.InstancedMesh(new THREE.SphereGeometry(0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshStandardMaterial({ color: 0xf2a8e0, roughness: 0.2, transparent: true, opacity: 0.62, emissive: 0x7a2f8a, emissiveIntensity: 0.35, side: THREE.DoubleSide, depthWrite: false }), JELLIES);
  const trails = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.03, 0.9, 7, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xe6c0f2, roughness: 0.3, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }), JELLIES);
  const jellies = Array.from({ length: JELLIES }, () => {
    const out = random(55, 170); // out in the deep water, well past where people paddle
    return { x: shoreX + out, z: random(-140, 140), y: -random(2.6, Math.min(7.6, -bedY(out) - 0.8)), phase: random(0, 6.28), size: random(0.7, 1.5) };
  });
  bells.frustumCulled = trails.frustumCulled = false;
  life.add(bells, trails);

  // --- Sharks and turtles ---
  const sharks = [[70, -60, 26], [95, 40, 32], [60, 110, 22]].map(([out, z, radius], i) => {
    const shark = makeShark();
    life.add(shark.group);
    return { ...shark, x: shoreX + out, z, homeX: shoreX + out, homeZ: z, radius, phase: i * 2.1, speed: 0.16 + i * 0.03 };
  });
  const turtles = [[34, 20, 9], [52, -80, 12]].map(([out, z, radius], i) => {
    const turtle = makeTurtle();
    life.add(turtle.group);
    return { ...turtle, x: shoreX + out, z, radius, phase: i * 3, y: -1.6 - i * 0.8 };
  });

  scene.add(life);
  return { life, fish, shoals, EACH, bells, trails, jellies, sharks, turtles, shoreX };
}

const position = new THREE.Vector3(), turn = new THREE.Quaternion(), size = new THREE.Vector3(), matrix = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);

// Each frame: everything swims. `near`: only worked out while the player is at the beach or out at sea.
// danger: true on a purple-flag day, when the sharks come in close to where people swim.
export function updateSeaLife(sea, time, dt, playerPosition, danger) {
  const near = playerPosition.x > sea.shoreX - 120;
  sea.life.visible = near;
  if (!near) return;

  sea.shoals.forEach((shoal, s) => {
    const angle = shoal.phase + time * shoal.speed, heading = angle + Math.sign(shoal.speed) * Math.PI / 2;
    const cx = shoal.x + Math.cos(angle) * shoal.radius, cz = shoal.z + Math.sin(angle) * shoal.radius;
    const forwardX = Math.cos(heading), forwardZ = Math.sin(heading);
    shoal.places.forEach(([along, up, across, wiggle], i) => {
      const sway = Math.sin(time * 5 + wiggle) * 0.12;
      position.set(cx + forwardX * along - forwardZ * (across + sway * 0.3), shoal.y + up + Math.sin(time * 0.7 + wiggle) * 0.1, cz + forwardZ * along + forwardX * (across + sway * 0.3));
      turn.setFromAxisAngle(UP, Math.atan2(forwardX, forwardZ) + sway * 1.6);
      sea.fish.setMatrixAt(s * sea.EACH + i, matrix.compose(position, turn, size.setScalar(shoal.size)));
    });
  });
  sea.fish.instanceMatrix.needsUpdate = true;

  sea.jellies.forEach((jelly, i) => {
    const pulse = Math.sin(time * 1.6 + jelly.phase);
    position.set(jelly.x + Math.sin(time * 0.11 + jelly.phase) * 3, jelly.y + Math.sin(time * 0.4 + jelly.phase) * 0.35, jelly.z + Math.cos(time * 0.09 + jelly.phase) * 3);
    turn.identity();
    sea.bells.setMatrixAt(i, matrix.compose(position, turn, size.set(jelly.size * (1 + pulse * 0.12), jelly.size * (1 - pulse * 0.16), jelly.size * (1 + pulse * 0.12))));
    position.y -= 0.42 * jelly.size;
    sea.trails.setMatrixAt(i, matrix.compose(position, turn, size.set(jelly.size * (1 - pulse * 0.1), jelly.size * (1 + pulse * 0.1), jelly.size * (1 - pulse * 0.1))));
  });
  sea.bells.instanceMatrix.needsUpdate = sea.trails.instanceMatrix.needsUpdate = true;

  for (const shark of sea.sharks) {
    // On a dangerous day they leave deep water and patrol just off the beach, level with the swimmer.
    const wantX = danger ? sea.shoreX + 26 : shark.homeX, wantZ = danger ? THREE.MathUtils.clamp(playerPosition.z, -120, 120) + (shark.homeZ > 0 ? 10 : -10) : shark.homeZ;
    shark.x += (wantX - shark.x) * Math.min(1, 0.25 * dt);
    shark.z += (wantZ - shark.z) * Math.min(1, 0.25 * dt);
    const round = danger ? Math.min(shark.radius, 14) : shark.radius;
    const angle = shark.phase + time * shark.speed * (danger ? 1.6 : 1);
    shark.group.position.set(shark.x + Math.cos(angle) * round, -0.82 + Math.sin(time * 0.35 + shark.phase) * 0.12, shark.z + Math.sin(angle) * round); // just deep enough that the fin cuts the surface
    shark.group.rotation.y = Math.atan2(-Math.sin(angle), Math.cos(angle));
    shark.tail.rotation.y = Math.sin(time * 3.4 + shark.phase) * 0.45;
    shark.group.rotation.y += Math.sin(time * 3.4 + shark.phase + 1.2) * 0.07; // the whole body snakes a little as it swims
  }
  for (const turtle of sea.turtles) {
    const angle = turtle.phase + time * 0.12;
    turtle.group.position.set(turtle.x + Math.cos(angle) * turtle.radius, turtle.y + Math.sin(time * 0.3 + turtle.phase) * 0.3, turtle.z + Math.sin(angle) * turtle.radius);
    turtle.group.rotation.y = Math.atan2(-Math.sin(angle), Math.cos(angle));
    for (const { pivot, side, front } of turtle.flippers) pivot.rotation.z = side * Math.sin(time * (front ? 1.8 : 1.2) + turtle.phase) * (front ? 0.55 : 0.25);
  }
}
