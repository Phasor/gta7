// Cuba: a long, curved island north of Jamaica, in the shape of the real one (the western hook,
// the bays along the south coast, the broad east end). The same green ground as Jamaica. In the
// west is a town of tall pastel houses with arcades and balconies, a domed capitol, a plaza
// with the flag, classic cars at the kerb and an open-air bar. A road runs east to the airstrip.
// Beyond that are cane fields and royal palms, and in the far south-east the Sierra Maestra.
import * as THREE from 'three';
import { addObstacle, addInterior, addTerrain, sea } from './world.js';
import { daylight } from './grass.js';
import { block, canvasTexture, speckle, makeMaterials, addPalm } from './house.js';
import { label } from './store.js';
import { buildCar } from './cars.js';
import { otherIslands } from './airport.js';

const CX = 2950, CZ = -820, SX = 420, SZ = 714, KEY = 0.68; // its middle, how far it runs east-west and north-south, and the height of its flat ground
// The shoreline, going round: the north coast from the western tip to the eastern, then back along the south.
const COAST = [[-1.0, -0.1], [-0.85, -0.2], [-0.65, -0.24], [-0.45, -0.2], [-0.2, -0.12], [0.05, -0.04], [0.3, 0.04], [0.55, 0.1], [0.8, 0.14], [1.0, 0.22],
  [0.85, 0.3], [0.6, 0.3], [0.45, 0.24], [0.35, 0.14], [0.25, 0.2], [0.05, 0.1], [-0.15, 0.04], [-0.3, 0.0], [-0.42, -0.04], [-0.55, -0.02], [-0.7, -0.08], [-0.85, -0.04], [-0.95, -0.02]].map(([x, z]) => [x * SX, z * SZ]);
const SHORE = new THREE.SplineCurve(COAST.concat([COAST[0]]).map(([x, z]) => new THREE.Vector2(x, z))).getPoints(220).map((point) => [point.x, point.y]);
// Is this spot (measured from the middle of the island) on land?
function onLand(x, z) {
  if (Math.abs(x) > SX * 1.08 || z < -200 || z > 250) return false;
  let within = false;
  for (let i = 0, j = SHORE.length - 1; i < SHORE.length; j = i++) {
    const [xi, zi] = SHORE[i], [xj, zj] = SHORE[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) within = !within;
  }
  return within;
}
otherIslands.push((x, z, shrink = 0.86) => onLand((x - CX) / shrink, (z - CZ) / shrink)); // (so people can live and wander here too)

// Flat ground: the town, the road east from it, and the airstrip. [west, east, north, south]
const ZONES = [[-350, -210, -130, -66], [-222, -176, -108, -32], [-190, 12, -55, -25]];
const PEAKS = [[292, 150, 84, 50], [222, 122, 62, 28], [330, 176, 50, 26], [-40, 8, 44, 15], [90, 60, 50, 12], [-120, -90, 40, 9]]; // the Sierra Maestra, and lower hills
const ease = (from, to, t) => { const u = Math.min(1, Math.max(0, (t - from) / (to - from))); return u * u * (3 - 2 * u); };
function hillHeight(x, z) {
  let height = 0;
  for (const [px, pz, spread, tall] of PEAKS) { const t = Math.hypot(x - px, z - pz) / spread; if (t < 1) height += tall * (1 - t * t) ** 2; }
  height += Math.sin(x * 0.09 + Math.sin(z * 0.05) * 2) * Math.cos(z * 0.11 + Math.sin(x * 0.04) * 2) * Math.min(4.5, height * 0.14);
  height += (Math.sin(x * 0.04 + 2) * Math.cos(z * 0.05) + 1) * 0.9 + (Math.sin(x * 0.12) * Math.sin(z * 0.15) + 1) * 0.3;
  let level = 1;
  for (const [x0, x1, z0, z1] of ZONES) level = Math.min(level, ease(1, 18, Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1))));
  let shore = 0;
  for (const scale of [0.96, 0.91, 0.86, 0.8]) if (onLand(x / scale, z / scale)) shore += 0.25;
  return Math.max(0, height * level * shore);
}

export function createCuba(scene, renderer) {
  const kit = makeMaterials();
  const plain = (color, roughness = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  const sign = (text, small, background, ink, w = 512, h = 128) => new THREE.MeshBasicMaterial({ map: label(text, small, background, ink, w, h) });
  const put = (material, w, h, d, x, y, z) => block(scene, material, w, h, d, CX + x, KEY + y, CZ + z);  // measured from the island's middle
  const solid = (x, z, w, d, height) => addObstacle(CX + x - w / 2, CX + x + w / 2, CZ + z - d / 2, CZ + z + d / 2, KEY + height);
  const flat = (material, w, d, x, z, y = 0.02) => { put(material, w, 0.03, d, x, y, z).castShadow = false; };
  const white = plain(0xf7f4ea, 0.8), stone = plain(0xcfc6b0, 0.9), dark = plain(0x24343c, 0.3), wood = plain(0x6b4a30, 0.7), steel = plain(0x8f9396, 0.4, { metalness: 0.6 });

  // --- The land: sand under the water, a beach all round, and one sheet of green ground over it ---
  const slab = (scale, top, depth, material) => {
    const outline = new THREE.Shape();
    outline.setFromPoints(SHORE.map(([x, z]) => new THREE.Vector2(x * scale, z * scale)));
    const geometry = new THREE.ExtrudeGeometry(outline, { depth, bevelEnabled: false });
    geometry.rotateX(Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(CX, top, CZ);
    mesh.receiveShadow = true;
    scene.add(mesh);
  };
  const ground = (base, dots) => new THREE.MeshStandardMaterial({ roughness: 1, map: canvasTexture(128, (ctx, s) => { ctx.fillStyle = base; ctx.fillRect(0, 0, s, s); speckle(ctx, s, dots, 0.08); }, 0.14, 0.14) });
  slab(1.06, -0.5, 9, ground('#d9c690', 4000));
  slab(1.0, 0.6, 10, ground('#f0deaa', 5000));
  {
    const STEP = 4, across = Math.round(2 * 444 / STEP) + 1, down = Math.round(440 / STEP) + 1;
    const spots = new Float32Array(across * down * 3), tints = new Float32Array(across * down * 3), looks = new Float32Array(across * down * 2), corners = [];
    const green = new THREE.Color(0x3f7a34), deep = new THREE.Color(0x2f5f3a), rock = new THREE.Color(0x7a7466), shade = new THREE.Color();
    for (let j = 0; j < down; j++) for (let i = 0; i < across; i++) {
      const x = -444 + i * STEP, z = -196 + j * STEP, h = hillHeight(x, z), n = (j * across + i) * 3, grassy = onLand(x / 0.93, z / 0.93);
      spots[n] = CX + x; spots[n + 1] = onLand(x, z) ? KEY + h + 0.012 : -3; spots[n + 2] = CZ + z;
      const steep = Math.min(1, Math.hypot(hillHeight(x + 2, z) - h, hillHeight(x, z + 2) - h) / 2.2);
      shade.copy(green).lerp(deep, Math.min(1, h / 22)).lerp(rock, Math.max(0, steep - 0.8) * 1.2);
      shade.multiplyScalar(0.88 + 0.24 * Math.sin(x * 0.7 + z * 1.3) * Math.sin(x * 0.31 - z * 0.53));
      if (!grassy) shade.setRGB(1.19, 1.1, 0.85);
      tints[n] = shade.r; tints[n + 1] = shade.g; tints[n + 2] = shade.b;
      looks[(j * across + i) * 2] = x / 7; looks[(j * across + i) * 2 + 1] = z / 7;
      if (i && j) { const a = (j - 1) * across + i - 1, b = a + 1, c = a + across, d = c + 1; corners.push(a, c, b, b, c, d); }
    }
    const land = new THREE.BufferGeometry();
    land.setAttribute('position', new THREE.BufferAttribute(spots, 3));
    land.setAttribute('color', new THREE.BufferAttribute(tints, 3));
    land.setAttribute('uv', new THREE.BufferAttribute(looks, 2));
    land.setIndex(corners);
    land.computeVertexNormals();
    const hills = new THREE.Mesh(land, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, map: canvasTexture(128, (ctx, s) => { ctx.fillStyle = '#c9c9c9'; ctx.fillRect(0, 0, s, s); speckle(ctx, s, 6000, 0.14); }, 1, 1) }));
    hills.receiveShadow = true;
    scene.add(hills);
    addTerrain((x, z) => (onLand(x - CX, z - CZ) ? KEY + hillHeight(x - CX, z - CZ) : -Infinity));
  }
  // Dry land, a strip to wade through, a turquoise lagoon to swim in, and the deep sea beyond.
  sea.lands.push((x, z) => {
    const lx = x - CX, lz = z - CZ;
    if (Math.abs(lx) > SX * 1.35 || lz < -260 || lz > 310) return undefined;
    if (onLand(lx, lz)) return 0;
    if (onLand(lx / 1.06, lz / 1.06)) return 0.55;
    if (onLand(lx / 1.24, lz / 1.24)) return 1.5;
    return undefined;
  });
  {
    const points = [], shades = [], faces = [];
    SHORE.forEach(([x, z], i) => {
      points.push(CX + x * 0.995, 0.2, CZ + z * 0.995, CX + x * 1.13, 0.2, CZ + z * 1.13, CX + x * 1.3, 0.2, CZ + z * 1.3);
      shades.push(0.45, 0.95, 0.86, 0.62, 0.2, 0.82, 0.8, 0.5, 0.1, 0.6, 0.72, 0);
      if (i) { const p = (i - 1) * 3; faces.push(p, p + 1, p + 3, p + 3, p + 1, p + 4, p + 1, p + 2, p + 4, p + 4, p + 2, p + 5); }
    });
    const ring = new THREE.BufferGeometry();
    ring.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    ring.setAttribute('color', new THREE.Float32BufferAttribute(shades, 4));
    ring.setIndex(faces);
    const lagoon = new THREE.Mesh(ring, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    lagoon.renderOrder = 3;
    lagoon.onBeforeRender = () => lagoon.material.color.setScalar(0.2 + 0.8 * daylight.value);
    scene.add(lagoon);
  }
  // Palms: along the beaches, and royal palms standing about the countryside.
  const inZone = (x, z, margin = 3) => ZONES.some(([x0, x1, z0, z1]) => x > x0 - margin && x < x1 + margin && z > z0 - margin && z < z1 + margin);
  const palm = (x, z, tall, lean) => {
    const holder = new THREE.Group();
    holder.position.y = KEY + hillHeight(x, z);
    addPalm(holder, kit, CX + x, CZ + z, tall, lean);
    scene.add(holder);
    addObstacle(CX + x - 0.25, CX + x + 0.25, CZ + z - 0.25, CZ + z + 0.25, holder.position.y + tall * 0.5, holder.position.y - 1);
  };
  COAST.forEach(([x, z], i) => { const [nx, nz] = COAST[(i + 1) % COAST.length]; for (const along of [0.15, 0.6]) palm((x + (nx - x) * along) * 0.95, (z + (nz - z) * along) * 0.95, 7 + (i * 5 + along * 7) % 4, (i % 3) - 1); });
  for (let tries = 0, made = 0; tries < 900 && made < 55; tries++) {
    const x = (Math.random() * 2 - 1) * SX * 0.92, z = -180 + Math.random() * 400;
    if (!onLand(x / 0.86, z / 0.86) || inZone(x, z, 6) || hillHeight(x, z) > 30) continue;
    palm(x, z, 10 + Math.random() * 5, (Math.random() - 0.5) * 0.8); // tall and straight
    made++;
  }
  // Fields of sugar cane and tobacco, in neat rows, east of the airstrip road.
  {
    const rows = [];
    for (const [fx, fz, colour, tall] of [[-140, -92, 0x7fae3a, 1.9], [-70, -84, 0x4f8a2a, 0.8], [60, 0, 0x7fae3a, 1.9], [130, 62, 0x4f8a2a, 0.8]]) {
      for (let row = 0; row < 9; row++) for (let i = 0; i < 16; i++) { const x = fx + i * 2.2, z = fz + row * 2.6; if (onLand(x / 0.9, z / 0.9) && !inZone(x, z)) rows.push([x, z, colour, tall]); }
    }
    const crop = new THREE.InstancedMesh(new THREE.ConeGeometry(0.5, 1, 5), new THREE.MeshStandardMaterial({ roughness: 0.9 }), rows.length);
    const at = new THREE.Matrix4(), tint = new THREE.Color();
    rows.forEach(([x, z, colour, tall], i) => { crop.setMatrixAt(i, at.makeScale(1, tall, 1).setPosition(CX + x, KEY + hillHeight(x, z) + tall / 2, CZ + z)); crop.setColorAt(i, tint.set(colour)); });
    crop.frustumCulled = false;
    scene.add(crop);
  }

  // --- La Habana: one long street of tall pastel houses, with a plaza and a domed capitol ---
  const road = plain(0x8f8a80, 1);                                             // old cobbles
  flat(road, 138, 7, -280, -98);
  flat(road, 7, 62, -199, -69);                                                // the road on to the airstrip
  flat(road, 22, 7, -206.5, -98);
  flat(plain(0x4a4a48, 0.95), 184, 12, -90, -40);                              // the airstrip
  for (let i = 0; i < 9; i++) flat(white, 8, 0.4, -170 + i * 20, -40, 0.04);
  const PASTEL = [0xf2b8a0, 0xf7dc7a, 0x9fd0e6, 0xf4a6b8, 0xb8e0b0, 0xe8c9f0, 0xffd0a0, 0xa8d8d0, 0xf2e6c0];
  // A town house: two or three floors, an arcade of columns at street level, tall shuttered windows with
  // little balconies, and a white cornice round a flat roof. face: +1 if it looks south onto the street, -1 if north.
  const casa = (x, z, w, d, h, colour, face) => {
    const paint = plain(colour, 0.9), front = z + face * d / 2;
    put(paint, w, h, d, x, h / 2, z);
    put(white, w + 0.5, 0.35, d + 0.5, x, h + 0.17, z);                        // cornice
    put(white, w + 0.2, 0.25, 2.4, x, 3.2, front + face * 1.2);                // the arcade's roof, over the pavement
    for (let column = 0; column < 5; column++) put(white, 0.34, 3.1, 0.34, x - w / 2 + 0.3 + column * (w - 0.6) / 4, 1.55, front + face * 2.2);
    put(plain(0x4a3220, 0.8), 1.3, 2.5, 0.1, x, 1.25, front + face * 0.06);    // the door
    for (let floor = 0; floor * 3.1 + 6.4 <= h + 0.3; floor++) for (const side of [-1, 1]) {
      const wx = x + side * w * 0.26, wy = 4.9 + floor * 3.1;
      put(dark, 1.1, 1.9, 0.1, wx, wy, front + face * 0.06);
      for (const half of [-1, 1]) put(plain(PASTEL[(floor + 4) % 9], 0.8), 0.42, 1.9, 0.07, wx + half * 0.8, wy, front + face * 0.1); // shutters, folded back
      put(white, 1.9, 0.08, 0.7, wx, wy - 1.0, front + face * 0.35);           // balcony
      put(steel, 1.9, 0.5, 0.04, wx, wy - 0.7, front + face * 0.68);
    }
    solid(x, z, w, d, h + 1);
  };
  for (let i = 0; i < 9; i++) {
    if (i !== 4) casa(-335 + i * 13.5, -111, 11.5, 9, [9.4, 6.4, 12.5][i % 3], PASTEL[i], 1);            // north side of the street
    if (i !== 4 && i !== 5 && i !== 8) casa(-335 + i * 13.5, -85, 11.5, 9, [6.4, 12.5, 9.4][i % 3], PASTEL[(i + 4) % 9], -1); // south side, with a gap for the plaza
  }
  // The capitol, on the north side opposite the plaza: steps, a row of columns and a great dome.
  {
    const x = -281, z = -113;
    put(white, 12.5, 8, 10, x, 4, z);
    put(stone, 13.5, 0.6, 3.4, x, 0.3, z + 6.6);
    for (let column = 0; column < 6; column++) put(white, 0.6, 6.4, 0.6, x - 5 + column * 2, 3.8, z + 6);
    put(white, 13, 1.0, 2.6, x, 7.5, z + 5.6);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 3, 20), white);
    drum.position.set(CX + x, KEY + 9.5, CZ + z);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(3.5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), plain(0xd9c27a, 0.5, { metalness: 0.5 }));
    dome.position.set(CX + x, KEY + 11, CZ + z);
    dome.scale.y = 1.25;
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 1.6, 10), white);
    lantern.position.set(CX + x, KEY + 16, CZ + z);
    scene.add(drum, dome, lantern);
    solid(x, z, 12.5, 10, 10);
  }
  // The plaza: paving, a statue on a plinth, benches, and the flag.
  flat(stone, 26, 18, -274, -84, 0.022);
  put(stone, 1.6, 1.8, 1.6, -274, 0.9, -84);
  put(plain(0x4a5a4a, 0.5, { metalness: 0.6 }), 0.5, 1.9, 0.4, -274, 2.75, -84);
  solid(-274, -84, 1.6, 1.6, 3.8);
  for (const bx of [-281, -267]) { put(wood, 2.2, 0.42, 0.5, bx, 0.21, -78); solid(bx, -78, 2.2, 0.5, 0.5); }
  {
    const canvas = document.createElement('canvas');
    canvas.width = 150; canvas.height = 75;
    const ink = canvas.getContext('2d');
    for (let stripe = 0; stripe < 5; stripe++) { ink.fillStyle = stripe % 2 ? '#ffffff' : '#0a2a8a'; ink.fillRect(0, stripe * 15, 150, 15); }
    ink.fillStyle = '#cf142b'; ink.beginPath(); ink.moveTo(0, 0); ink.lineTo(64, 37.5); ink.lineTo(0, 75); ink.fill();
    ink.fillStyle = '#ffffff'; ink.beginPath();
    for (let point = 0; point < 10; point++) { const a = -Math.PI / 2 + point * Math.PI / 5, r = point % 2 ? 5 : 12; ink.lineTo(22 + Math.cos(a) * r, 37.5 + Math.sin(a) * r); }
    ink.fill();
    const picture = new THREE.CanvasTexture(canvas);
    picture.colorSpace = THREE.SRGBColorSpace;
    put(steel, 0.12, 9, 0.12, -262, 4.5, -90);
    put(new THREE.MeshBasicMaterial({ map: picture, side: THREE.DoubleSide }), 2.6, 1.3, 0.03, -260.6, 8.2, -90);
    solid(-262, -90, 0.3, 0.3, 9);
  }
  put(sign('LA HABANA', 'BIENVENIDOS A CUBA', '#0a2a8a', '#ffffff', 512, 160), 4.2, 1.3, 0.12, -212, 2.8, -102.6);
  for (const side of [-1, 1]) put(wood, 0.16, 2.8, 0.16, -212 + side * 1.9, 1.4, -102.6);
  // A lighthouse on the headland north of the town.
  {
    const x = -300, z = -142, base = hillHeight(x, z);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.2, 15, 14), white);
    tower.position.set(CX + x, KEY + base + 7.5, CZ + z);
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 1.6, 12), new THREE.MeshBasicMaterial({ color: 0xfff3a0 }));
    lamp.position.set(CX + x, KEY + base + 15.8, CZ + z);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(1.7, 1.6, 12), plain(0xc0281e, 0.6));
    cap.position.set(CX + x, KEY + base + 17.4, CZ + z);
    scene.add(tower, lamp, cap);
    addObstacle(CX + x - 2, CX + x + 2, CZ + z - 2, CZ + z + 2, KEY + base + 17);
  }
  // The bar on the plaza: an open counter under a tiled roof.
  const barX = -266, barZ = -76;
  put(wood, 5, 1.05, 0.9, barX, 0.53, barZ);
  put(plain(0x0a2a8a, 0.5), 5.1, 0.06, 1.0, barX, 1.09, barZ);
  for (const [px, pz] of [[-2.6, -0.8], [2.6, -0.8], [-2.6, 1.9], [2.6, 1.9]]) put(wood, 0.16, 2.9, 0.16, barX + px, 1.45, barZ + pz);
  put(plain(0xb5523a, 0.8), 6, 0.16, 3.6, barX, 2.98, barZ + 0.55);
  put(sign('BAR LA PLAZA', 'CAFÉ · MOJITOS · BOCADITOS', '#0a2a8a', '#ffffff', 512, 128), 3.6, 0.7, 0.06, barX, 2.45, barZ - 0.86);
  solid(barX, barZ, 5, 0.9, 1.2);
  // The police post, at the east end of the street: one locked room.
  const jailX = -227, jailZ = -85;
  put(plain(0xe9f0f6, 0.85), 7, 3.4, 6, jailX, 1.7, jailZ).visible = false;                                  // (the walls are made below, so that the inside can be seen)
  for (const [wx, wz, ww, wd] of [[0, -3, 7, 0.2], [0, 3, 7, 0.2], [-3.5, 0, 0.2, 6], [3.5, 0, 0.2, 6]]) { put(plain(0xe9f0f6, 0.85), ww, 3.4, wd, jailX + wx, 1.7, jailZ + wz); solid(jailX + wx, jailZ + wz, ww, wd, 4.5); }
  put(plain(0x9aa0a6, 0.6), 7.6, 0.2, 6.6, jailX, 3.5, jailZ);
  put(plain(0x0a2a8a, 0.6), 1.3, 2.3, 0.1, jailX, 1.15, jailZ - 3.12);                                      // the door, bolted from outside
  put(sign('POLICÍA', 'LA HABANA', '#0a2a8a', '#ffffff', 512, 160), 3.4, 0.9, 0.08, jailX, 2.9, jailZ - 3.16);
  put(plain(0x8a9aa0, 1), 0.9, 0.4, 1.9, jailX + 2.8, 0.4, jailZ + 1.6);                                    // a bunk
  addInterior(CX + jailX - 3.3, CX + jailX + 3.3, CZ + jailZ - 2.8, CZ + jailZ + 2.8, KEY + 3.4, KEY);

  // Classic cars from the 1950s, parked along the street: big, finned and bright. They can be driven off.
  const cars = [[-322, 0x3fc0c0], [-296, 0xf2658a], [-262, 0xf2c230], [-240, 0x6fd06a], [-309, 0xf4f0e6]].map(([x, colour], i) => {
    const car = buildCar(renderer, 'muscle', colour), z = i === 4 ? -94.6 : -101.4, heading = i === 4 ? -Math.PI / 2 : Math.PI / 2;
    for (const side of [-1, 1]) {                                                                           // tail fins and a chrome strip
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 1.1), car.group.children[0].material);
      fin.position.set(side * 0.9, 1.0, -1.9);
      fin.rotation.x = -0.25;
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 4.4), new THREE.MeshStandardMaterial({ color: 0xdfe2e4, roughness: 0.15, metalness: 1 }));
      strip.position.set(side * 0.98, 0.62, 0);
      car.group.add(fin, strip);
    }
    car.group.position.set(CX + x, KEY + 0.03, CZ + z);
    car.group.rotation.y = heading;
    scene.add(car.group);
    return Object.assign(car, { heading, name: 'classic car', stolen: false, topSpeed: 28 });
  });

  // The ticket hut, where the road meets the airstrip.
  const hutX = -207, hutZ = -52;
  put(wood, 2.6, 1.05, 0.7, hutX, 0.53, hutZ);
  put(plain(0x1f5fa8, 0.5), 2.7, 0.06, 0.8, hutX, 1.09, hutZ);
  for (const [px, pz] of [[-1.5, -1.6], [1.5, -1.6], [-1.5, 0.5], [1.5, 0.5]]) put(wood, 0.14, 2.7, 0.14, hutX + px, 1.35, hutZ + pz);
  const thatch = new THREE.Mesh(new THREE.ConeGeometry(2.9, 1.3, 4), plain(0xc9a85a, 1));
  thatch.rotation.y = Math.PI / 4;
  thatch.position.set(CX + hutX, KEY + 3.3, CZ + hutZ - 0.55);
  scene.add(thatch);
  put(sign('BOLETOS', 'TICKETS · GATOR AIR', '#1f5fa8', '#ffffff', 512, 160), 2.5, 0.75, 0.06, hutX, 2.3, hutZ + 0.56);
  solid(hutX, hutZ, 2.6, 0.7, 1.2);

  const at = (x, z, extra = {}) => ({ x: CX + x, z: CZ + z, ...extra });
  return {
    cars,
    station: { key: 'cuba', name: 'Cuba', land: new THREE.Vector3(CX - 90, KEY, CZ - 40), arrive: new THREE.Vector3(CX + hutX + 4, KEY, CZ + hutZ + 6), desk: at(hutX, hutZ + 1.2),
      seller: at(hutX, hutZ - 1.0, { facing: 0, special: true, name: 'Señora Reyes', woman: true, skin: 'tan', say: 'Press E for a ticket, mi amor.' }), facing: Math.PI },
    barman: at(barX, barZ + 1.15, { facing: Math.PI, special: true, name: 'Ernesto the barman', skin: 'tan', dye: 'doctor', say: 'Press E. Café, mojito, or something to eat?' }),
    till: { key: 'cubabar', ...at(barX, barZ - 1.5) },
    police: {
      posts: [at(jailX - 2.2, jailZ - 5.2, { facing: Math.PI }), at(jailX + 2.2, jailZ - 5.2, { facing: Math.PI })],
      cell: new THREE.Vector3(CX + jailX, KEY, CZ + jailZ),
      release: new THREE.Vector3(CX + jailX, KEY, CZ + jailZ - 7.5),
    },
  };
}
