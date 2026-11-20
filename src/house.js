// A single-storey Florida suburban house: pastel stucco walls, a low terracotta
// tile roof, an attached garage with a concrete driveway, a small front porch,
// hedges, palm trees, a mailbox and an air-conditioning unit. All made in code.
//
// You can walk in through the front door, which swings open as you come near.
// Inside is a living room, a kitchen and dining area, and a bedroom. The garage
// is solid. The windows are not see-through: outside they reflect the sky, and
// inside they are bright panels of daylight.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { addObstacle, addFloor, addInterior } from './world.js';
import { clearings } from './grass.js';

const WALL_HEIGHT = 2.8;
const SLAB = 0.15; // the concrete base the house sits on

// --- Materials ---------------------------------------------------------------

export function canvasTexture(size, paint, repeatX, repeatY) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  paint(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Speckle a canvas so a flat colour looks like a rough surface.
export function speckle(ctx, size, count, alpha) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${alpha})` : `rgba(255,255,255,${alpha})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }
}

function makeMaterials() {
  const stucco = new THREE.MeshStandardMaterial({
    roughness: 0.95,
    map: canvasTexture(128, (ctx, size) => {
      ctx.fillStyle = '#efc9a4'; // sun-faded peach
      ctx.fillRect(0, 0, size, size);
      speckle(ctx, size, 2500, 0.05);
    }, 4, 2),
  });
  // Rows of curved clay tiles.
  const roof = new THREE.MeshStandardMaterial({
    roughness: 0.85,
    map: canvasTexture(64, (ctx, size) => {
      ctx.fillStyle = '#b9583a';
      ctx.fillRect(0, 0, size, size);
      speckle(ctx, size, 500, 0.07);
      ctx.fillStyle = 'rgba(60,20,10,0.55)';
      ctx.fillRect(0, size - 7, size, 7);           // shadow under each row
      ctx.fillStyle = 'rgba(60,20,10,0.3)';
      for (let x = 0; x < size; x += 16) ctx.fillRect(x, 0, 3, size); // gaps between tiles
      ctx.fillStyle = 'rgba(255,200,160,0.25)';
      for (let x = 7; x < size; x += 16) ctx.fillRect(x, 0, 4, size); // highlight on each curve
    }, 1.6, 3),
  });
  const garageDoor = new THREE.MeshStandardMaterial({
    roughness: 0.6,
    map: canvasTexture(128, (ctx, size) => {
      ctx.fillStyle = '#f1ece0';
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = 'rgba(90,80,60,0.55)';
      ctx.lineWidth = 2;
      for (let row = 0; row < 4; row++) {
        ctx.strokeRect(0, row * 32, size, 32); // four horizontal sections...
        for (let col = 0; col < 4; col++) ctx.strokeRect(col * 32 + 5, row * 32 + 6, 22, 20); // ...of raised panels
      }
    }, 1, 1),
  });
  const concrete = new THREE.MeshStandardMaterial({
    roughness: 1,
    map: canvasTexture(128, (ctx, size) => {
      ctx.fillStyle = '#c9c2b2';
      ctx.fillRect(0, 0, size, size);
      speckle(ctx, size, 3000, 0.06);
      ctx.fillStyle = 'rgba(70,60,50,0.35)';
      ctx.fillRect(0, 0, size, 2); // expansion joint
    }, 2, 3),
  });
  // Rough surfaces catch the light unevenly.
  stucco.bumpMap = stucco.map; stucco.bumpScale = 1.5;
  roof.bumpMap = roof.map; roof.bumpScale = 4;

  // Window glass: a dim reflection of the sky, with half-closed blinds behind it.
  const glass = new THREE.MeshStandardMaterial({
    roughness: 0.08, metalness: 0.45,
    map: canvasTexture(128, (ctx, size) => {
      const sky = ctx.createLinearGradient(0, 0, 0, size);
      sky.addColorStop(0, '#6f93ad');
      sky.addColorStop(1, '#c9c2a6');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = 'rgba(16,24,30,0.55)';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = 'rgba(235,228,210,0.16)';
      for (let y = 0; y < size * 0.7; y += 7) ctx.fillRect(0, y, size, 4); // blind slats
    }, 1, 1),
  });
  // Clipped hedge and shrubs: a mass of small leaves.
  const leafy = canvasTexture(64, (ctx, size) => {
    ctx.fillStyle = '#44702f';
    ctx.fillRect(0, 0, size, size);
    const greens = ['#2f5522', '#5b8a3a', '#6d9c44', '#3b6529'];
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = greens[(Math.random() * greens.length) | 0];
      ctx.fillRect(Math.random() * size, Math.random() * size, 3, 3);
    }
  }, 3, 2);
  // Palm trunk: grey-brown with a ring for every frond that has dropped off.
  const bark = canvasTexture(64, (ctx, size) => {
    ctx.fillStyle = '#8f8068';
    ctx.fillRect(0, 0, size, size);
    speckle(ctx, size, 700, 0.08);
    ctx.fillStyle = 'rgba(50,38,26,0.45)';
    for (let x = 0; x < size; x += 16) ctx.fillRect(x, 0, 3, size);
  }, 9, 2);

  const plain = (color, roughness = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  const frondMap = frondTexture();
  const frond = (color) => new THREE.MeshStandardMaterial({ map: frondMap, color, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.8 });
  return {
    stucco, roof, garageDoor, concrete, glass,
    trim: plain(0xf4efe3, 0.7),
    door: plain(0x2f7f86, 0.5),           // teal front door
    shutter: plain(0x3d6f73, 0.7),
    mulch: plain(0x5a3f2a, 1),
    hedge: new THREE.MeshStandardMaterial({ map: leafy, bumpMap: leafy, bumpScale: 3, roughness: 1 }),
    metal: plain(0x9a9c9c, 0.5, { metalness: 0.6 }),
    brass: plain(0xc9a24a, 0.35, { metalness: 0.9 }),
    trunk: new THREE.MeshStandardMaterial({ map: bark, bumpMap: bark, bumpScale: 3, roughness: 1 }),
    frond: frond(0xffffff),
    dryFrond: frond(0xd9b36a),            // old fronds, browning as they hang
    coconut: plain(0x6e5a34, 0.8),
    post: plain(0x6b5846, 0.9),
    dark: plain(0x2a2a2a, 0.8),
    binGreen: plain(0x2f5a3c, 0.6),
    binBlue: plain(0x2c4f7c, 0.6),
    pot: plain(0xb8643c, 0.9),
    flower: plain(0xe2507a, 0.8),
    // Indoors.
    paint: plain(0xece4d2, 0.95),
    floor: new THREE.MeshStandardMaterial({
      roughness: 0.6,
      map: canvasTexture(128, (ctx, size) => { // wooden floorboards
        for (let row = 0; row < 8; row++) {
          const shade = 150 + Math.random() * 30;
          ctx.fillStyle = `rgb(${shade},${shade * 0.72},${shade * 0.48})`;
          ctx.fillRect(0, row * 16, size, 16);
          ctx.fillStyle = 'rgba(50,30,15,0.5)';
          ctx.fillRect(0, row * 16, size, 1);
          ctx.fillRect((row * 53) % size, row * 16, 1, 16);
        }
        speckle(ctx, size, 600, 0.04);
      }, 5, 4),
    }),
    daylight: new THREE.MeshBasicMaterial({
      map: canvasTexture(64, (ctx, size) => { // bright sky and garden seen through a window
        const view = ctx.createLinearGradient(0, 0, 0, size);
        view.addColorStop(0, '#cfe6f5');
        view.addColorStop(0.62, '#f4efd9');
        view.addColorStop(0.66, '#a9c27a');
        view.addColorStop(1, '#8fae62');
        ctx.fillStyle = view;
        ctx.fillRect(0, 0, size, size);
      }, 1, 1),
    }),
    fabric: cloth('#5f7f86'),             // sofa
    cushion: cloth('#d9b77a'),
    wood: grain('#8a6240', 0.55),
    darkWood: grain('#553b28', 0.5),
    counter: stone(),
    cabinet: plain(0xf0ebe0, 0.45),
    appliance: steel(),
    rug: plain(0xa8543c, 1),
    linen: cloth('#ece7dd'),
    blanket: cloth('#3d6f73'),
    screen: plain(0x0c0d10, 0.15, { metalness: 0.5 }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xfff1d0 }),
    ceiling: plain(0xf4f1e8, 1, { emissive: 0x4a4740 }),
    mirror: plain(0xcfd6d8, 0.05, { metalness: 1 }),
    tile: new THREE.MeshStandardMaterial({
      roughness: 0.3,
      map: canvasTexture(64, (ctx, size) => { // square tiles with grey grout
        ctx.fillStyle = '#e6e1d6';
        ctx.fillRect(0, 0, size, size);
        speckle(ctx, size, 200, 0.04);
        ctx.strokeStyle = '#a9a498';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, size, size);
      }, 8, 4),
    }),
    carpet: new THREE.MeshStandardMaterial({
      roughness: 1,
      map: canvasTexture(128, (ctx, size) => { // a patterned rug with a border
        ctx.fillStyle = '#9c4a36';
        ctx.fillRect(0, 0, size, size);
        ctx.strokeStyle = '#e3cfa4';
        ctx.lineWidth = 5;
        ctx.strokeRect(8, 8, size - 16, size - 16);
        ctx.lineWidth = 2;
        ctx.strokeRect(18, 18, size - 36, size - 36);
        ctx.fillStyle = '#2f5d63';
        for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
          ctx.save();
          ctx.translate(32 + i * 16, 32 + j * 16);
          ctx.rotate(Math.PI / 4);
          ctx.fillRect(-4, -4, 8, 8);
          ctx.restore();
        }
        speckle(ctx, size, 1500, 0.05);
      }, 1, 1),
    }),
    curtain: new THREE.MeshStandardMaterial({
      roughness: 1,
      map: canvasTexture(64, (ctx, size) => { // cloth hanging in folds
        for (let x = 0; x < size; x++) {
          const fold = 205 + Math.sin(x * 0.8) * 28;
          ctx.fillStyle = `rgb(${fold},${fold * 0.95},${fold * 0.84})`;
          ctx.fillRect(x, 0, 1, size);
        }
      }, 1, 1),
    }),
    // Framed pictures: a beach at sunset, and an abstract.
    art1: new THREE.MeshStandardMaterial({
      roughness: 0.8,
      map: canvasTexture(128, (ctx, size) => {
        const sky = ctx.createLinearGradient(0, 0, 0, size);
        sky.addColorStop(0, '#f4b06a'); sky.addColorStop(0.5, '#f7d9a8'); sky.addColorStop(0.52, '#3f8f9a'); sky.addColorStop(0.75, '#5fb0b0'); sky.addColorStop(0.78, '#ead9b0'); sky.addColorStop(1, '#d9c392');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = '#fff3d0';
        ctx.beginPath(); ctx.arc(88, 50, 12, 0, 7); ctx.fill();
        ctx.fillStyle = '#2c3a2a';
        ctx.fillRect(26, 40, 3, 62);
        for (let a = 0; a < 6; a++) { ctx.save(); ctx.translate(27, 40); ctx.rotate(a * 1.05); ctx.fillRect(0, -2, 24, 4); ctx.restore(); }
      }, 1, 1),
    }),
    art2: new THREE.MeshStandardMaterial({
      roughness: 0.8,
      map: canvasTexture(64, (ctx, size) => {
        ctx.fillStyle = '#efe7d6';
        ctx.fillRect(0, 0, size, size);
        for (const [c, x, y, r] of [['#c4573a', 22, 26, 16], ['#2f7f86', 40, 36, 14], ['#d9b14a', 30, 46, 9]]) {
          ctx.fillStyle = c; ctx.globalAlpha = 0.85;
          ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
        }
      }, 1, 1),
    }),
    tvPicture: new THREE.MeshBasicMaterial({
      map: canvasTexture(64, (ctx, size) => { // something on the telly
        const g = ctx.createLinearGradient(0, 0, size, size);
        g.addColorStop(0, '#27496b'); g.addColorStop(0.6, '#4f89a8'); g.addColorStop(1, '#d9a35a');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillRect(6, 50, 30, 4);
      }, 1, 1),
    }),
    contact: new THREE.MeshBasicMaterial({
      transparent: true, depthWrite: false, color: 0x000000,
      alphaMap: canvasTexture(64, (ctx, size) => { // soft-edged dark patch
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, size, size);
        ctx.filter = 'blur(7px)';
        ctx.fillStyle = '#777';
        ctx.fillRect(12, 12, size - 24, size - 24);
      }, 1, 1),
    }),
  };
}

// One palm frond painted flat: a rib with dozens of thin leaflets down each
// side. Everything else is see-through. The base of the frond is at the bottom.
function frondTexture() {
  const W = 128, H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const greens = ['#4f7f2c', '#5f9336', '#3f6b25', '#6e9f3c', '#7fa544'];
  ctx.lineCap = 'round';
  for (let s = 0.04; s < 1; s += 0.011) {
    const y = H - s * H;
    const reach = 60 * Math.sin(Math.PI * Math.min(1, 0.1 + s * 0.9)) ** 0.6;
    for (const side of [-1, 1]) {
      ctx.strokeStyle = greens[(Math.random() * greens.length) | 0];
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(W / 2, y);
      ctx.lineTo(W / 2 + side * reach * (0.85 + Math.random() * 0.15), Math.max(2, y - 22 - Math.random() * 8));
      ctx.stroke();
    }
  }
  ctx.strokeStyle = '#8a9440';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(W / 2, H);
  ctx.lineTo(W / 2, 6);
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// A frond's shape: it leaves the crown at `start` (an angle from straight up),
// arches over by `bend` along its length, and its two sides hang down from the rib.
function frondGeometry(length, start, bend, width) {
  const STEPS = 10, positions = [], uvs = [], index = [];
  let up = 0, out = 0;
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const hang = width * 0.28;
    positions.push(-width / 2, up - hang, out, 0, up, out, width / 2, up - hang, out);
    uvs.push(0, t, 0.5, t, 1, t);
    const angle = start + bend * Math.pow((i + 0.5) / STEPS, 1.5);
    up += (length / STEPS) * Math.cos(angle);
    out += (length / STEPS) * Math.sin(angle);
    if (i < STEPS) {
      const a = i * 3;
      index.push(a, a + 1, a + 4, a, a + 4, a + 3, a + 1, a + 2, a + 5, a + 1, a + 5, a + 4);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

// --- Building blocks ---------------------------------------------------------

// A box, given its size and the position of its centre.
export function block(parent, material, w, h, d, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

// A low roof that slopes down on all four sides, with its ridge along X.
function hipRoof(material, length, depth, height) {
  const L = length / 2, D = depth / 2, R = Math.max(0, L - D); // R: half the ridge's length
  const A = [-L, 0, D], B = [L, 0, D], C = [L, 0, -D], E = [-L, 0, -D], P = [-R, height, 0], Q = [R, height, 0];
  const positions = [], uvs = [];
  const add = (points, across) => {
    for (const [x, y, z] of points) {
      positions.push(x, y, z);
      // Tile rows run along the eaves and step up the slope.
      const inFromEave = across === 'x' ? D - Math.abs(z) : L - Math.abs(x);
      uvs.push(across === 'x' ? x : z, Math.hypot(y, inFromEave));
    }
  };
  add([A, B, Q, A, Q, P], 'x'); // front slope
  add([C, E, P, C, P, Q], 'x'); // back slope
  add([B, C, Q], 'z');          // right end
  add([E, A, P], 'z');          // left end
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// A window on a wall: frame, dark glass, a cross bar, and shutters either side.
// facing: 'front' (+Z), 'back' (-Z), 'right' (+X) or 'left' (-X).
function addWindow(parent, m, facing, along, width, height, sill, wallAt, shutters = true) {
  const window = new THREE.Group();
  block(window, m.trim, width + 0.16, height + 0.16, 0.08, 0, 0, 0);
  block(window, m.glass, width, height, 0.1, 0, 0, 0);
  block(window, m.trim, width, 0.05, 0.12, 0, 0, 0);
  block(window, m.trim, 0.05, height, 0.12, 0, 0, 0);
  block(window, m.trim, width + 0.3, 0.07, 0.2, 0, -height / 2 - 0.1, 0.04); // sill
  if (shutters) {
    for (const side of [-1, 1]) block(window, m.shutter, 0.42, height + 0.1, 0.05, side * (width / 2 + 0.32), 0, 0);
  }
  const y = SLAB + sill + height / 2;
  if (facing === 'front') window.position.set(along, y, wallAt);
  if (facing === 'back') { window.position.set(along, y, wallAt); window.rotation.y = Math.PI; }
  if (facing === 'right') { window.position.set(wallAt, y, along); window.rotation.y = Math.PI / 2; }
  if (facing === 'left') { window.position.set(wallAt, y, along); window.rotation.y = -Math.PI / 2; }
  parent.add(window);
}

function addPalm(parent, m, x, z, height, lean) {
  const palm = new THREE.Group();
  palm.position.set(x, 0, z);
  palm.rotation.y = Math.random() * Math.PI * 2;

  // A gently curving, ringed trunk that starts below the ground, flares out
  // smoothly at the base, narrows going up, and swells a little under the crown.
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.3, 0), new THREE.Vector3(lean * 0.2, height * 0.35, 0),
    new THREE.Vector3(lean * 0.65, height * 0.7, 0), new THREE.Vector3(lean, height, 0),
  ]);
  const RINGS = 30, SIDES = 10;
  const trunkShape = new THREE.TubeGeometry(curve, RINGS, 1, SIDES);
  const p = trunkShape.attributes.position, centre = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= RINGS; i++) {
    const t = i / RINGS;
    curve.getPointAt(t, centre);
    const radius = 0.13 + 0.13 * (1 - t) ** 5 + (i % 2) * 0.01 + Math.max(0, t - 0.92) * 0.8;
    for (let j = 0; j <= SIDES; j++) {
      const k = i * (SIDES + 1) + j;
      v.fromBufferAttribute(p, k).sub(centre).multiplyScalar(radius).add(centre);
      p.setXYZ(k, v.x, v.y, v.z);
    }
  }
  trunkShape.computeVertexNormals();
  const trunk = new THREE.Mesh(trunkShape, m.trunk);
  trunk.castShadow = true;
  palm.add(trunk);

  // The crown: young fronds stand up in the middle, mature ones arch out and
  // droop at the tips, and old browning ones hang down against the trunk.
  const crown = new THREE.Group();
  crown.position.set(lean, height - 0.1, 0);
  const COUNT = 20;
  for (let i = 0; i < COUNT; i++) {
    const start = 0.1 + 1.55 * (((i * 7) % COUNT) / COUNT) + Math.random() * 0.1;
    const length = 3.0 + Math.random() * 1.0 - (start < 0.4 ? 0.8 : 0);
    const frond = new THREE.Mesh(
      frondGeometry(length, start, 1.5 - start * 0.35, 1.25),
      start > 1.35 ? m.dryFrond : m.frond
    );
    frond.castShadow = true;
    frond.rotation.y = (i / COUNT) * Math.PI * 2 * 3 + Math.random() * 0.4;
    crown.add(frond);
  }
  for (let i = 0; i < 5; i++) { // a cluster of coconuts tucked under the fronds
    const nut = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), m.coconut);
    const a = i * 1.3;
    nut.position.set(Math.cos(a) * 0.2, -0.3 - (i % 2) * 0.12, Math.sin(a) * 0.2);
    nut.castShadow = true;
    crown.add(nut);
  }
  palm.add(crown);
  parent.add(palm);
}

// --- The house ---------------------------------------------------------------

// Builds the house with its centre at (x, z). The front faces +Z.
export function createHouse(scene, x, z) {
  const m = makeMaterials();
  const house = new THREE.Group();
  house.position.set(x, 0, z);
  const top = SLAB + WALL_HEIGHT;

  // Main part of the house, and the garage wing that sticks out at the front left.
  block(house, m.concrete, 12.3, SLAB, 9.3, 2, SLAB / 2, 0);
  // The main part is hollow: four outside walls (the garage forms the left one),
  // with a gap in the front wall for the door.
  const mid = SLAB + WALL_HEIGHT / 2, overDoor = WALL_HEIGHT - 2.15;
  block(house, m.stucco, 12, WALL_HEIGHT, 0.2, 2, mid, -4.4);            // back
  block(house, m.stucco, 0.2, WALL_HEIGHT, 8.6, 7.9, mid, 0);            // right
  block(house, m.stucco, 4.95, WALL_HEIGHT, 0.2, -1.525, mid, 4.4);      // front, left of the door
  block(house, m.stucco, 5.95, WALL_HEIGHT, 0.2, 5.025, mid, 4.4);       // front, right of the door
  block(house, m.stucco, 1.1, overDoor, 0.2, 1.5, top - overDoor / 2, 4.4); // above the door
  // Painted inside faces of those walls, and the wooden floor.
  block(house, m.paint, 11.8, WALL_HEIGHT, 0.04, 1.9, mid, -4.28);
  block(house, m.paint, 0.04, WALL_HEIGHT, 8.6, 7.78, mid, 0);
  block(house, m.paint, 0.04, WALL_HEIGHT, 8.6, -3.98, mid, 0);
  block(house, m.paint, 4.95, WALL_HEIGHT, 0.04, -1.525, mid, 4.28);
  block(house, m.paint, 5.75, WALL_HEIGHT, 0.04, 4.925, mid, 4.28);
  block(house, m.paint, 1.1, overDoor, 0.04, 1.5, top - overDoor / 2, 4.28);
  block(house, m.floor, 11.8, 0.02, 8.6, 1.9, SLAB + 0.01, 0);  block(house, m.concrete, 6.3, SLAB, 9.8, -7, SLAB / 2, 1.25);
  // The garage is hollow too, with a wide opening at the front for its door.
  const overGarageDoor = WALL_HEIGHT - 2.3;
  block(house, m.stucco, 0.2, WALL_HEIGHT, 9.5, -9.9, mid, 1.25);     // left
  block(house, m.stucco, 5.6, WALL_HEIGHT, 0.2, -7, mid, -3.4);       // back
  block(house, m.stucco, 0.2, WALL_HEIGHT, 10.5, -4.1, mid, 0.75);    // right (shared with the house)
  block(house, m.stucco, 0.5, WALL_HEIGHT, 0.2, -9.55, mid, 5.9);     // front, either side of the door
  block(house, m.stucco, 0.5, WALL_HEIGHT, 0.2, -4.45, mid, 5.9);
  block(house, m.stucco, 4.6, overGarageDoor, 0.2, -7, top - overGarageDoor / 2, 5.9);
  // Roofs, each with a white board round the edge.
  const mainRoof = hipRoof(m.roof, 13.4, 10.4, 1.7);
  mainRoof.position.set(2, top, 0);
  const garageRoof = hipRoof(m.roof, 10.9, 7.4, 1.35);
  garageRoof.rotation.y = Math.PI / 2; // ridge runs front to back
  garageRoof.position.set(-7, top, 1.25);
  house.add(mainRoof, garageRoof);
  block(house, m.trim, 13.4, 0.16, 10.4, 2, top - 0.08, 0);
  block(house, m.trim, 7.4, 0.16, 10.9, -7, top - 0.08, 1.25);

  // Garage door, with a light above it.
  block(house, m.trim, 0.1, 2.3, 0.26, -9.3, SLAB + 1.15, 5.9);      // door frame
  block(house, m.trim, 0.1, 2.3, 0.26, -4.7, SLAB + 1.15, 5.9);
  block(house, m.trim, 4.7, 0.1, 0.26, -7, SLAB + 2.35, 5.9);
  const garageDoor = new THREE.Group(); // hinged along its top edge: it swings up and in under the ceiling
  garageDoor.position.set(-7, SLAB + 2.3, 5.9);
  block(garageDoor, m.garageDoor, 4.5, 2.3, 0.08, 0, -1.15, 0);
  house.add(garageDoor);
  block(house, m.brass, 0.18, 0.26, 0.14, -7, SLAB + 2.58, 6.05);

  // Front door: teal, with a frame, a handle, a step and a small porch on two posts.
  block(house, m.trim, 0.08, 2.2, 0.26, 0.93, SLAB + 1.1, 4.4);   // door frame
  block(house, m.trim, 0.08, 2.2, 0.26, 2.07, SLAB + 1.1, 4.4);
  block(house, m.trim, 1.22, 0.08, 0.26, 1.5, SLAB + 2.19, 4.4);
  const door = new THREE.Group(); // hinged on its left edge, so it can swing inward
  door.position.set(1.0, 0, 4.42);
  block(door, m.door, 1.0, 2.1, 0.06, 0.5, SLAB + 1.07, 0);
  block(door, m.glass, 0.5, 0.5, 0.08, 0.5, SLAB + 1.65, 0);
  block(door, m.brass, 0.06, 0.16, 0.16, 0.88, SLAB + 1.0, 0);
  house.add(door);
  block(house, m.concrete, 3.4, SLAB, 2.0, 1.5, SLAB / 2, 5.5);
  block(house, m.trim, 3.6, 0.2, 2.1, 1.5, top - 0.26, 5.5);
  for (const side of [-1, 1]) block(house, m.trim, 0.2, WALL_HEIGHT - 0.36, 0.2, 1.5 + side * 1.55, SLAB + (WALL_HEIGHT - 0.36) / 2, 6.35);
  block(house, m.brass, 0.14, 0.22, 0.12, 0.62, SLAB + 1.9, 4.56); // porch light

  // Windows.
  addWindow(house, m, 'front', 5.4, 2.6, 1.5, 0.85, 4.5);          // big living-room window
  addWindow(house, m, 'front', -1.6, 1.3, 1.3, 1.0, 4.5);
  addWindow(house, m, 'right', 2.2, 1.4, 1.3, 1.0, 8.0);
  addWindow(house, m, 'right', -2.2, 1.4, 1.3, 1.0, 8.0);
  addWindow(house, m, 'back', 5.6, 1.4, 1.3, 1.0, -4.5);
  addWindow(house, m, 'back', -1.5, 1.0, 0.8, 1.5, -4.5, false);   // small bathroom window
  addWindow(house, m, 'back', 2.2, 2.4, 2.1, 0.02, -4.5, false);   // sliding patio doors
  addWindow(house, m, 'left', 2.5, 1.2, 0.9, 1.4, -10.0, false);   // garage side window
  block(house, m.concrete, 5, 0.1, 3.2, 2.4, 0.05, -6.2);          // back patio

  // Driveway, and a path from it to the porch.
  block(house, m.concrete, 5.4, 0.06, 10, -7, 0.03, 11);
  block(house, m.concrete, 5.4, 0.05, 1.2, -1.6, 0.025, 8.1);
  block(house, m.concrete, 1.3, 0.05, 1.7, 1.5, 0.025, 7.35);

  // A planting bed along the front wall with clipped hedges under the windows.
  block(house, m.mulch, 12, 0.05, 1.9, 2, 0.025, 5.4);
  block(house, m.hedge, 3.4, 0.75, 0.9, 5.4, 0.42, 5.25);
  block(house, m.hedge, 2.6, 0.75, 0.9, -2.0, 0.42, 5.25);

  // Air-conditioning unit on the side wall, and a mailbox by the road end of the drive.
  block(house, m.metal, 0.9, 0.85, 0.9, 8.75, 0.5, -0.4);
  block(house, m.concrete, 1.1, 0.08, 1.1, 8.75, 0.04, -0.4);
  block(house, m.post, 0.1, 1.05, 0.1, -3.7, 0.52, 15.4);
  block(house, m.metal, 0.22, 0.24, 0.5, -3.7, 1.15, 15.4);
  block(house, m.door, 0.03, 0.14, 0.03, -3.57, 1.3, 15.5); // its little flag

  // --- Inside ---
  const solid = (cx, cz, w, d, height) => addObstacle(x + cx - w / 2, x + cx + w / 2, z + cz - d / 2, z + cz + d / 2, height);
  // A piece of furniture standing on the floor (or `lift` above it). Solid unless told otherwise.
  const piece = (material, w, h, d, px, pz, lift = 0, isSolid = true) => {
    if (isSolid) solid(px, pz, w, d, SLAB + lift + h);
    if (isSolid && lift < 0.8) shadowUnder(px, pz, w, d);
    const mesh = block(house, material, w, h, d, px, SLAB + lift + h / 2, pz);
    // Upholstery and bedding have soft, rounded edges.
    if (soft.has(material)) mesh.geometry = new RoundedBoxGeometry(w, h, d, 3, Math.min(w, h, d) * 0.3);
    // Everything else has its sharp corners taken off, as real furniture does.
    else if (Math.min(w, h, d) > 0.03) mesh.geometry = new RoundedBoxGeometry(w, h, d, 2, Math.min(0.015, Math.min(w, h, d) * 0.25));
    return mesh;
  };
  const soft = new Set([m.fabric, m.cushion, m.linen, m.blanket]);
  // The lamps indoors cast no shadows, so furniture gets a soft dark patch
  // on the floor beneath it to stop it looking as if it floats.
  let shadowLayer = 0;
  const shadowUnder = (px, pz, w, d) => {
    const patch = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.5, d + 0.5), m.contact);
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(px, SLAB + 0.045 + (shadowLayer++) * 0.0004, pz);
    patch.renderOrder = 1;
    house.add(patch);
  };

  // Daylight in the windows, on the inside faces of the walls.
  const inside = { ...m, glass: m.daylight };
  addWindow(house, inside, 'back', 5.4, 2.6, 1.5, 0.85, 4.25, false);
  addWindow(house, inside, 'back', -1.6, 1.3, 1.3, 1.0, 4.25, false);
  addWindow(house, inside, 'left', 2.2, 1.4, 1.3, 1.0, 7.75, false);
  addWindow(house, inside, 'left', -2.2, 1.4, 1.3, 1.0, 7.75, false);
  addWindow(house, inside, 'front', 5.6, 1.4, 1.3, 1.0, -4.25, false);
  addWindow(house, inside, 'front', -1.5, 1.0, 0.8, 1.5, -4.25, false);
  addWindow(house, inside, 'front', 2.2, 2.4, 2.1, 0.02, -4.25, false);

  // Bedroom walls (back right corner), with a doorway.
  block(house, m.paint, 0.12, WALL_HEIGHT, 3.2, 4, mid, -2.9);
  block(house, m.paint, 3.8, WALL_HEIGHT, 0.12, 5.9, mid, 0);
  block(house, m.paint, 0.12, WALL_HEIGHT - 2.1, 1.36, 4, top - (WALL_HEIGHT - 2.1) / 2, -0.62);
  solid(4, -2.9, 0.12, 3.2, top);
  solid(5.9, 0, 3.8, 0.12, top);

  // Ceiling lamps: a glowing shade and a warm light in each room.
  for (const [lx, lz] of [[0.3, 0.4], [5.6, 2.2], [6.0, -2.3]]) {
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.12, 16), m.lamp);
    shade.position.set(lx, top - 0.23, lz);
    const glow = new THREE.PointLight(0xfff0dc, 9, 9, 1.6);
    if (lx > 5 && lz > 0) { // the living-room lamp casts real shadows
      glow.castShadow = true;
      glow.shadow.mapSize.set(512, 512);
      glow.shadow.bias = -0.004;
      glow.shadow.camera.near = 0.2;
      glow.shadow.camera.far = 9;
    }
    glow.position.set(lx, top - 0.5, lz);
    house.add(shade, glow);
  }

  // Living room: sofa against the bedroom wall, facing a TV; rug, coffee table, armchair.
  piece(m.carpet, 3.0, 0.02, 2.2, 3.9, 2.2, 0, false);
  piece(m.fabric, 2.4, 0.45, 0.95, 3.9, 0.6);              // sofa seat
  piece(m.fabric, 2.4, 0.5, 0.25, 3.9, 0.25, 0.45, false); // back
  piece(m.fabric, 0.22, 0.25, 0.95, 2.81, 0.6, 0.45, false); // arms
  piece(m.fabric, 0.22, 0.25, 0.95, 4.99, 0.6, 0.45, false);
  piece(m.cushion, 0.5, 0.35, 0.15, 3.2, 0.45, 0.45, false);
  piece(m.cushion, 0.5, 0.35, 0.15, 4.5, 0.45, 0.45, false);
  piece(m.wood, 1.2, 0.06, 0.6, 3.9, 2.0, 0.36);           // coffee table top
  piece(m.darkWood, 1.0, 0.36, 0.45, 3.9, 2.0, 0, false);
  piece(m.darkWood, 1.5, 0.5, 0.42, 3.1, 4.02);            // TV stand
  piece(m.screen, 1.25, 0.72, 0.05, 3.1, 4.05, 0.58, false); // TV
  piece(m.fabric, 0.85, 0.42, 0.85, 6.9, 2.9);             // armchair
  piece(m.fabric, 0.2, 0.5, 0.85, 7.23, 2.9, 0.42, false);
  piece(m.metal, 0.05, 1.5, 0.05, 7.4, 0.5, 0, false);     // floor lamp
  piece(m.lamp, 0.32, 0.26, 0.32, 7.4, 0.5, 1.45, false).geometry = new THREE.CylinderGeometry(0.12, 0.19, 0.26, 18); // lamp shade

  // Kitchen along the back wall: fridge, worktop with a hob and sink, wall cupboards.
  // Fridge: a real cabinet with shelves of food inside, and a door that opens (press E nearby).
  const at = (material, w, h, d, px, y, pz, parent = house) => block(parent, material, w, h, d, px, SLAB + y, pz); // y: centre height above the floor
  const round = (material, radius, h, px, y, pz, parent = house) => { // an upright bottle, can or jar standing at height y
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, h, 12), material);
    mesh.position.set(px, SLAB + y + h / 2, pz);
    parent.add(mesh);
  };
  const ball = (hex, radius, px, y, pz) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 10), colour(hex));
    mesh.position.set(px, SLAB + y + radius, pz);
    house.add(mesh);
  };
  const colour = (hex, roughness = 0.6) => new THREE.MeshStandardMaterial({ color: hex, roughness });
  solid(-3.55, -3.9, 0.75, 0.72, SLAB + 1.85);
  shadowUnder(-3.55, -3.9, 0.75, 0.72);
  at(m.appliance, 0.75, 1.85, 0.03, -3.55, 0.925, -4.245);   // back
  at(m.appliance, 0.03, 1.85, 0.66, -3.91, 0.925, -3.93);    // sides
  at(m.appliance, 0.03, 1.85, 0.66, -3.19, 0.925, -3.93);
  at(m.appliance, 0.75, 0.03, 0.66, -3.55, 1.835, -3.93);    // top
  at(m.appliance, 0.75, 0.57, 0.72, -3.55, 0.285, -3.9);     // freezer drawer at the bottom
  at(m.dark, 0.75, 0.012, 0.012, -3.55, 0.573, -3.542);
  at(m.metal, 0.4, 0.025, 0.04, -3.55, 0.46, -3.525);
  at(m.cabinet, 0.69, 1.25, 0.01, -3.55, 1.195, -4.225);     // white lining
  at(m.cabinet, 0.01, 1.25, 0.6, -3.89, 1.195, -3.92);
  at(m.cabinet, 0.01, 1.25, 0.6, -3.21, 1.195, -3.92);
  at(m.cabinet, 0.69, 0.01, 0.6, -3.55, 0.575, -3.92);
  const shelfGlass = new THREE.MeshStandardMaterial({ color: 0xd5ecee, roughness: 0.1, transparent: true, opacity: 0.45 });
  for (const y of [0.9, 1.22, 1.52]) at(shelfGlass, 0.68, 0.012, 0.5, -3.55, y, -3.96);

  // Bottom: lettuce, tomatoes and carrots.
  ball(0x7fb04a, 0.09, -3.74, 0.58, -3.98);
  for (const [fx, fz] of [[-3.52, -3.9], [-3.43, -3.98], [-3.5, -4.06]]) ball(0xd63a2a, 0.045, fx, 0.58, fz);
  at(colour(0xe8892b), 0.16, 0.035, 0.035, -3.34, 0.6, -3.85);
  at(colour(0xe8892b), 0.15, 0.035, 0.035, -3.33, 0.6, -3.79);
  // First shelf: milk, orange juice, a box of eggs.
  at(colour(0xf7f7f2), 0.09, 0.22, 0.09, -3.8, 1.016, -4.0);
  at(colour(0x2f6fb5), 0.092, 0.035, 0.092, -3.8, 1.14, -4.0);
  round(colour(0xf09a1e, 0.3), 0.04, 0.24, -3.66, 0.906, -4.02);
  round(colour(0xffffff), 0.02, 0.03, -3.66, 1.146, -4.02);
  at(colour(0xb9b3a4, 0.9), 0.26, 0.07, 0.11, -3.4, 0.941, -3.92);
  // Second shelf: cheese, a jar of sauce, a tub of leftovers.
  at(colour(0xf0c330), 0.14, 0.07, 0.1, -3.78, 1.261, -3.95);
  round(colour(0xa8281e, 0.2), 0.04, 0.11, -3.58, 1.226, -4.0);
  round(colour(0xf2efe6), 0.042, 0.015, -3.58, 1.336, -4.0);
  at(colour(0xe9eef0, 0.3), 0.2, 0.08, 0.14, -3.38, 1.266, -3.95);
  at(colour(0x3a7fb0), 0.21, 0.012, 0.15, -3.38, 1.312, -3.95);
  // Top shelf: cans of drink and last night's pizza.
  for (const [hex, fx, fz] of [[0xc8261e, -3.82, -3.9], [0x2e8b4a, -3.74, -3.9], [0x2a5fb0, -3.82, -3.99], [0xc8261e, -3.74, -3.99]]) round(colour(hex, 0.3), 0.033, 0.12, fx, 1.526, fz);
  at(colour(0xc9a678, 0.9), 0.32, 0.045, 0.32, -3.42, 1.549, -3.96);

  const fridgeLight = new THREE.PointLight(0xeaf5ff, 0, 3, 1.5); // comes on when the door opens
  fridgeLight.position.set(-3.55, SLAB + 1.75, -3.75);
  house.add(fridgeLight);

  const fridgeDoor = new THREE.Group(); // hinged on its left edge
  fridgeDoor.position.set(-3.925, 0, -3.6);
  at(m.appliance, 0.75, 1.27, 0.06, 0.375, 1.215, 0.03, fridgeDoor);
  at(m.metal, 0.03, 0.7, 0.04, 0.68, 1.2, 0.08, fridgeDoor);            // handle
  at(m.cabinet, 0.66, 1.18, 0.012, 0.375, 1.215, -0.005, fridgeDoor);   // white lining
  for (const y of [0.72, 1.12, 1.45]) {                                 // shelves in the door
    at(m.cabinet, 0.6, 0.015, 0.1, 0.375, y, -0.06, fridgeDoor);
    at(shelfGlass, 0.6, 0.07, 0.01, 0.375, y + 0.04, -0.11, fridgeDoor);
  }
  round(colour(0x2e7d3a, 0.3), 0.035, 0.26, 0.2, 0.728, -0.06, fridgeDoor);  // bottles
  round(colour(0xf2f2ee, 0.3), 0.04, 0.24, 0.36, 0.728, -0.06, fridgeDoor);
  round(colour(0xc8261e), 0.03, 0.18, 0.5, 1.128, -0.06, fridgeDoor);        // ketchup
  round(colour(0xe2c22e), 0.03, 0.16, 0.3, 1.128, -0.06, fridgeDoor);        // mustard
  at(colour(0xf3e08a), 0.12, 0.04, 0.07, 0.4, 1.478, -0.06, fridgeDoor);     // butter
  house.add(fridgeDoor);
  piece(m.cabinet, 3.7, 0.86, 0.62, -1.3, -3.95);          // base units
  piece(m.counter, 3.76, 0.05, 0.68, -1.3, -3.93, 0.86, false);
  piece(m.screen, 0.6, 0.02, 0.5, -2.5, -3.95, 0.91, false); // hob
  piece(m.appliance, 0.6, 0.02, 0.42, -1.5, -3.95, 0.91, false); // sink
  piece(m.appliance, 0.04, 0.25, 0.04, -1.5, -4.18, 0.91, false); // tap
  piece(m.cabinet, 0.8, 0.7, 0.36, -2.6, -4.1, 1.5, false); // wall cupboards
  piece(m.cabinet, 1.3, 0.7, 0.36, -0.1, -4.1, 1.5, false);

  // Dining table and four chairs.
  piece(m.wood, 1.7, 0.06, 0.95, -1.6, -1.4, 0.72);
  for (const [lx, lz] of [[-2.35, -1.8], [-0.85, -1.8], [-2.35, -1.0], [-0.85, -1.0]]) piece(m.darkWood, 0.07, 0.72, 0.07, lx, lz, 0, false);
  for (const [cx, cz, back] of [[-2.0, -2.2, -1], [-1.2, -2.2, -1], [-2.0, -0.6, 1], [-1.2, -0.6, 1]]) {
    piece(m.darkWood, 0.42, 0.05, 0.42, cx, cz, 0.42, false);
    piece(m.darkWood, 0.42, 0.5, 0.05, cx, cz + back * 0.2, 0.45, false);
    for (const [lx, lz] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) piece(m.darkWood, 0.04, 0.42, 0.04, cx + lx, cz + lz, 0, false); // legs
  }

  // By the front window: a bookcase and a side table with a plant.
  piece(m.darkWood, 0.36, 1.9, 1.5, -3.76, 2.6);
  for (let shelf = 0; shelf < 4; shelf++) piece(shelf % 2 ? m.blanket : m.rug, 0.05, 0.3, 1.3, -3.56, 2.6, 0.2 + shelf * 0.45, false); // rows of books
  piece(m.wood, 0.5, 0.55, 0.5, -3.6, 0.6);
  piece(m.pot, 0.24, 0.22, 0.24, -3.6, 0.6, 0.55, false);
  piece(m.hedge, 0.4, 0.4, 0.4, -3.6, 0.6, 0.77, false);

  // Bedroom: bed with its head against the back wall, bedside table, wardrobe.
  piece(m.darkWood, 1.7, 0.3, 2.05, 6.2, -3.2);            // bed base
  piece(m.linen, 1.6, 0.22, 2.0, 6.2, -3.2, 0.3, false);   // mattress
  piece(m.blanket, 1.64, 0.06, 1.3, 6.2, -2.83, 0.5, false);
  piece(m.linen, 0.6, 0.12, 0.38, 5.8, -3.9, 0.52, false); // pillows
  piece(m.linen, 0.6, 0.12, 0.38, 6.6, -3.9, 0.52, false);
  piece(m.darkWood, 1.7, 1.0, 0.08, 6.2, -4.22, 0, false); // headboard
  piece(m.wood, 0.45, 0.5, 0.4, 7.5, -4.0);                // bedside table
  piece(m.lamp, 0.18, 0.2, 0.18, 7.5, -4.0, 0.6, false).geometry = new THREE.CylinderGeometry(0.07, 0.11, 0.2, 16);
  piece(m.cabinet, 1.8, 2.1, 0.55, 6.6, -0.4);             // wardrobe
  piece(m.dark, 0.02, 2.0, 0.02, 6.6, -0.69, 0.05, false);

  // --- Finishing touches indoors ---
  const put = (material, w, h, d, px, y, pz) => block(house, material, w, h, d, px, SLAB + y, pz); // y: height of its centre above the floor

  // White ceiling, skirting boards round the walls, and a frame round the bedroom doorway.
  put(m.ceiling, 11.8, 0.02, 8.6, 1.9, WALL_HEIGHT - 0.18, 0);
  put(m.trim, 11.8, 0.1, 0.03, 1.9, 0.05, -4.25);
  put(m.trim, 4.95, 0.1, 0.03, -1.525, 0.05, 4.25);
  put(m.trim, 5.75, 0.1, 0.03, 4.925, 0.05, 4.25);
  put(m.trim, 0.03, 0.1, 8.6, -3.95, 0.05, 0);
  put(m.trim, 0.03, 0.1, 8.6, 7.75, 0.05, 0);
  put(m.trim, 3.8, 0.1, 0.16, 5.9, 0.05, 0);
  put(m.trim, 0.16, 0.1, 3.2, 4, 0.05, -2.9);
  put(m.trim, 0.18, 2.1, 0.07, 4, 1.05, -1.3);
  put(m.trim, 0.18, 2.1, 0.07, 4, 1.05, -0.06);
  put(m.trim, 0.18, 0.07, 1.3, 4, 2.12, -0.68);
  put(m.cabinet, 0.85, 2.02, 0.04, 4.5, 1.02, -1.32); // the bedroom door, standing open

  // A ceiling fan turning over the living room, with its light in the middle.
  const fan = new THREE.Group();
  fan.position.set(5.6, top - 0.26, 2.2);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    arm.rotation.y = i * Math.PI / 2;
    block(arm, m.darkWood, 0.62, 0.015, 0.15, 0.6, 0, 0).rotation.x = 0.2;
    fan.add(arm);
  }
  house.add(fan);

  // Curtains at the windows, hanging from rods.
  const curtainsAlongX = (cx, width, cz) => { // window on the front or back wall
    for (const side of [-1, 1]) put(m.curtain, 0.45, 2.15, 0.06, cx + side * (width / 2 + 0.2), 1.33, cz);
    put(m.darkWood, width + 1.1, 0.03, 0.03, cx, 2.43, cz);
  };
  const curtainsAlongZ = (cz, width, cx) => { // window on the right-hand wall
    for (const side of [-1, 1]) put(m.curtain, 0.06, 2.15, 0.45, cx, 1.33, cz + side * (width / 2 + 0.2));
    put(m.darkWood, 0.03, 0.03, width + 1.1, cx, 2.43, cz);
  };
  curtainsAlongX(5.4, 2.6, 4.17);
  curtainsAlongX(-1.6, 1.3, 4.17);
  curtainsAlongX(2.2, 2.4, -4.17);
  curtainsAlongZ(2.2, 1.4, 7.67);
  curtainsAlongZ(-2.2, 1.4, 7.67);

  // Pictures on the walls, a mirror in the bedroom, and the TV switched on.
  put(m.darkWood, 1.3, 0.8, 0.03, 6.3, 1.6, 0.08);
  put(m.art1, 1.2, 0.7, 0.04, 6.3, 1.6, 0.085);
  put(m.darkWood, 0.03, 0.6, 0.6, -3.94, 1.55, 0.6);
  put(m.art2, 0.04, 0.52, 0.52, -3.935, 1.55, 0.6);
  put(m.darkWood, 0.03, 1.4, 0.55, 4.08, 1.2, -3.3);
  put(m.mirror, 0.04, 1.3, 0.45, 4.085, 1.2, -3.3);
  put(m.tvPicture, 1.17, 0.64, 0.01, 3.1, 0.94, 4.02);

  // Kitchen: tiled floor and splashback, an oven under the hob, cupboard doors
  // and handles, a microwave, a kettle and a bowl of fruit.
  put(m.tile, 4.7, 0.012, 2.25, -1.6, 0.026, -3.17);
  put(m.tile, 3.7, 0.55, 0.02, -1.3, 1.19, -4.25);
  put(m.screen, 0.56, 0.55, 0.02, -2.5, 0.45, -3.63);
  put(m.metal, 0.44, 0.025, 0.04, -2.5, 0.77, -3.61);
  for (const cx of [-1.9, -1.3, -0.7, -0.1]) {
    put(m.dark, 0.012, 0.8, 0.012, cx - 0.3, 0.43, -3.636);
    put(m.metal, 0.02, 0.14, 0.03, cx + 0.2, 0.68, -3.62);
  }
  put(m.appliance, 0.5, 0.28, 0.36, 0.1, 1.05, -4.05);          // microwave
  put(m.screen, 0.34, 0.2, 0.01, 0.04, 1.05, -3.865);
  put(m.metal, 0.16, 0.22, 0.16, -0.75, 1.02, -4.05);           // kettle
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.1, 0.1, 16), m.cabinet);
  bowl.position.set(-1.6, SLAB + 0.83, -1.4);
  house.add(bowl);
  for (const [fx, fz, colour] of [[-1.66, -1.43, 0xd9482b], [-1.54, -1.44, 0xe0a030], [-1.6, -1.34, 0x7aa53c]]) {
    const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), new THREE.MeshStandardMaterial({ color: colour, roughness: 0.6 }));
    fruit.position.set(fx, SLAB + 0.9, fz);
    house.add(fruit);
  }
  shadowUnder(-1.6, -1.4, 1.5, 0.8); // under the dining table
  shadowUnder(3.9, 2.0, 1.0, 0.45);  // under the coffee table

  // Living room clutter: books, a mug and the remote on the coffee table, a
  // throw over the sofa arm, and a big plant in the corner.
  put(m.blanket, 0.26, 0.04, 0.19, 3.6, 0.44, 2.05);
  put(m.rug, 0.24, 0.03, 0.17, 3.61, 0.475, 2.04);
  put(m.dark, 0.05, 0.02, 0.16, 4.2, 0.43, 1.9);
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.09, 12), m.cabinet);
  mug.position.set(4.05, SLAB + 0.465, 2.15);
  house.add(mug);
  put(m.cushion, 0.3, 0.3, 0.9, 5.02, 0.6, 0.6).geometry = new RoundedBoxGeometry(0.3, 0.3, 0.9, 3, 0.09);
  const tub = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.45, 14), m.pot);
  tub.position.set(7.3, SLAB + 0.225, 3.85);
  const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), m.hedge);
  leaves.position.set(7.3, SLAB + 1.0, 3.85);
  leaves.scale.y = 1.3;
  house.add(tub, leaves);
  shadowUnder(7.3, 3.85, 0.3, 0.3);

  // Bedroom: a rug beside the bed and a book on the bedside table.
  put(m.blanket, 1.0, 0.015, 1.6, 4.9, 0.03, -3.0);
  put(m.rug, 0.2, 0.03, 0.14, 7.42, 0.52, -3.9);

  // --- The small things that make a house look lived in ---

  // Caps along the roof ridges, and vent pipes poking through the tiles.
  block(house, m.roof, 3.2, 0.1, 0.3, 2, top + 1.7, 0);
  block(house, m.roof, 0.3, 0.1, 3.7, -7, top + 1.35, 1.25);
  block(house, m.metal, 0.12, 0.5, 0.12, 5.2, top + 1.0, -2.2);
  block(house, m.metal, 0.12, 0.45, 0.12, -0.5, top + 0.9, -2.6);

  // Gutter downpipes at the corners.
  for (const [dx, dz] of [[8.06, 4.56], [-4.06, 4.56], [-10.06, 6.06], [8.06, -4.56]]) {
    block(house, m.trim, 0.09, WALL_HEIGHT, 0.09, dx, SLAB + WALL_HEIGHT / 2, dz);
  }

  // Doormat, house number, and a potted plant on the porch.
  block(house, m.dark, 0.85, 0.02, 0.5, 1.5, SLAB + 0.01, 4.95);
  block(house, m.dark, 0.3, 0.14, 0.03, 2.5, SLAB + 1.75, 4.52);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.14, 0.34, 12), m.pot);
  pot.position.set(2.75, SLAB + 0.17, 4.9);
  pot.castShadow = true;
  house.add(pot);

  // Rounded shrubs and a few flowers in the bed, between and beside the hedges.
  const shrub = (sx, sz, size, material = m.hedge) => {
    const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(size, 1), material);
    bush.scale.y = 0.8;
    bush.position.set(sx, size * 0.7, sz);
    bush.rotation.y = sx * 3;
    bush.castShadow = true;
    house.add(bush);
  };
  shrub(2.75, 4.9, 0.3); // the plant in the pot
  house.children[house.children.length - 1].position.y = SLAB + 0.5;
  for (const [sx, sz, size] of [[-3.7, 5.3, 0.5], [-0.3, 5.3, 0.45], [3.3, 5.5, 0.4], [7.5, 5.4, 0.5], [7.9, 6.0, 0.3]]) shrub(sx, sz, size);
  for (const [sx, sz] of [[-0.9, 6.0], [-0.4, 6.1], [3.6, 6.1], [4.2, 6.05], [6.6, 6.1], [7.1, 6.0]]) shrub(sx, sz, 0.14, m.flower);

  // Two wheelie bins beside the garage.
  for (const [material, bz] of [[m.binGreen, 2.4], [m.binBlue, 3.25]]) {
    block(house, material, 0.6, 0.95, 0.7, -10.45, 0.5, bz);
    block(house, m.dark, 0.66, 0.07, 0.76, -10.45, 1.0, bz);
  }

  // Palm trees.
  const palms = [[7.6, 9.5, 6.2, 0.9], [-0.6, 13.5, 7.4, -1.2], [10.6, -3.0, 6.8, 0.7]];
  for (const [px, pz, height, lean] of palms) addPalm(house, m, px, pz, height, lean);

  scene.add(house);

  // What can't be walked or shot through: the two halves of the house, the
  // porch posts, the hedges, the AC unit, the mailbox and the palm trunks.
  solid(2, -4.4, 12, 0.2, top + 1);       // back wall
  solid(7.9, 0, 0.2, 9, top + 1);         // right wall
  solid(-1.525, 4.4, 4.95, 0.2, top + 1); // front wall, either side of the door
  solid(5.025, 4.4, 5.95, 0.2, top + 1);
  // Raised floors to stand on, and the indoor space where the camera stays under the ceiling.
  addFloor(x - 4, x + 8, z - 4.5, z + 4.5, SLAB);
  addFloor(x - 0.2, x + 3.2, z + 4.4, z + 6.5, SLAB);
  addInterior(x - 4, x + 7.8, z - 4.3, z + 4.3, top - 0.16);
  house.userData = {
    door, fan, doorSpot: new THREE.Vector3(x + 1.5, 0, z + 4.4), open: 0,
    fridgeDoor, fridgeLight, fridgeSpot: new THREE.Vector3(x - 3.4, 0, z - 2.9), fridgeOpen: false, fridgeAmount: 0,
    garageDoor, garageSpot: new THREE.Vector3(x - 7, 0, z + 5.9), garageOpen: 0, garageHeight: top + 1,
  };
  solid(-9.9, 1.25, 0.2, 9.5, top + 1);   // garage walls
  solid(-7, -3.4, 6, 0.2, top + 1);
  solid(-4.1, 0.75, 0.2, 10.5, top + 1);
  solid(-9.6, 5.9, 0.6, 0.2, top + 1);
  solid(-4.4, 5.9, 0.6, 0.2, top + 1);
  house.userData.garageBlock = addObstacle(x - 9.3, x - 4.7, z + 5.8, z + 6.0, top + 1); // the garage door, while it is shut
  addFloor(x - 10, x - 4, z - 3.5, z + 6, SLAB);
  addInterior(x - 9.8, x - 4.2, z - 3.3, z + 5.8, top - 0.16);

  // In the garage: a workbench with a toolbox, shelves of boxes, and a light.
  piece(m.wood, 2.2, 0.06, 0.6, -8.5, -2.95, 0.84);
  piece(m.darkWood, 2.1, 0.84, 0.5, -8.5, -2.95, 0, false);
  piece(m.dark, 0.5, 0.24, 0.26, -8.9, -2.95, 0.9, false);
  piece(m.metal, 0.3, 0.03, 0.05, -8.1, -2.9, 0.9, false);
  piece(m.cabinet, 0.4, 1.9, 1.8, -9.58, 0.4);
  for (let level = 0; level < 3; level++) for (let i = 0; i < 3; i++) {
    piece(m.cushion, 0.34, 0.3, 0.44, -9.55, -0.15 + i * 0.56, 0.25 + level * 0.62, false);
  }
  const garageLight = new THREE.PointLight(0xfff0dc, 10, 10, 1.6);
  garageLight.position.set(-7, top - 0.5, 1.2);
  house.add(garageLight);  solid(-0.05, 6.35, 0.2, 0.2, top);
  solid(3.05, 6.35, 0.2, 0.2, top);
  solid(5.4, 5.25, 3.4, 0.9, 0.8);
  solid(-2.0, 5.25, 2.6, 0.9, 0.8);
  solid(8.75, -0.4, 0.9, 0.9, 0.9);
  solid(-3.7, 15.4, 0.25, 0.5, 1.3);
  solid(-10.45, 2.83, 0.6, 1.6, 1.05); // the bins
  for (const [px, pz, height] of palms) solid(px, pz, 0.45, 0.45, height * 0.5);

  // Where no grass should grow: under the house and front bed, the patio,
  // the driveway and the path. Each is (min x, min z, max x, max z).
  clearings[0].set(x - 10.2, z - 4.8, x + 8.3, z + 6.6);
  clearings[1].set(x - 9.8, z + 6.0, x - 4.2, z + 16.1);
  clearings[2].set(x - 4.4, z + 6.4, x + 2.3, z + 8.8);
  clearings[3].set(x - 0.2, z - 7.9, x + 5.0, z - 4.6);
  return house;
}

// Each frame: the front door swings open when the player is near, and closes behind him.
export function updateHouse(house, playerPosition, dt) {
  const state = house.userData;
  const near = Math.hypot(playerPosition.x - state.doorSpot.x, playerPosition.z - state.doorSpot.z) < 2.3;
  state.open += ((near ? 1 : 0) - state.open) * Math.min(1, 5 * dt);
  state.door.rotation.y = 1.75 * state.open; // swings into the house
  state.fan.rotation.y += dt * 5;
  state.fridgeAmount += ((state.fridgeOpen ? 1 : 0) - state.fridgeAmount) * Math.min(1, 6 * dt);
  state.fridgeDoor.rotation.y = -1.5 * state.fridgeAmount; // swings out into the kitchen
  state.fridgeLight.intensity = 2.5 * state.fridgeAmount;

  // The garage door lifts when the player (on foot or in the truck) comes near it.
  const atGarage = Math.hypot(playerPosition.x - state.garageSpot.x, playerPosition.z - state.garageSpot.z) < 6.5;
  state.garageOpen += ((atGarage ? 1 : 0) - state.garageOpen) * Math.min(1, 3 * dt);
  state.garageDoor.rotation.x = 1.52 * state.garageOpen;
  state.garageBlock.height = state.garageOpen > 0.7 ? 0 : state.garageHeight; // passable once it is up
}

// Is the player close enough to the fridge to use it?
export function nearFridge(house, playerPosition) {
  const spot = house.userData.fridgeSpot;
  return Math.hypot(playerPosition.x - spot.x, playerPosition.z - spot.z) < 1.6;
}

// Open the fridge if it's shut, or shut it if it's open.
export function toggleFridge(house, playerPosition) {
  if (nearFridge(house, playerPosition)) house.userData.fridgeOpen = !house.userData.fridgeOpen;
}

// --- Indoor materials with a surface you can see ------------------------------

// Woven cloth, for upholstery and bedding.
function cloth(css) {
  const map = canvasTexture(64, (ctx, size) => {
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 2) for (let x = 0; x < size; x += 2) {
      ctx.fillStyle = (x + y) % 4 ? 'rgba(0,0,0,0.09)' : 'rgba(255,255,255,0.09)';
      ctx.fillRect(x, y, 1, 1);
    }
    speckle(ctx, size, 300, 0.04);
  }, 5, 5);
  return new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: 2, roughness: 1 });
}

// Wood, with the grain running along it and the odd knot.
function grain(css, roughness) {
  const map = canvasTexture(128, (ctx, size) => {
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 90; i++) {
      const y = Math.random() * size;
      ctx.strokeStyle = Math.random() < 0.6 ? 'rgba(40,22,10,0.16)' : 'rgba(255,225,180,0.1)';
      ctx.lineWidth = 0.5 + Math.random() * 1.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(size * 0.3, y + Math.random() * 6 - 3, size * 0.7, y + Math.random() * 6 - 3, size, y + Math.random() * 4 - 2);
      ctx.stroke();
    }
    for (let i = 0; i < 2; i++) {
      ctx.strokeStyle = 'rgba(40,22,10,0.3)';
      ctx.beginPath();
      ctx.ellipse(Math.random() * size, Math.random() * size, 7, 3, 0, 0, 7);
      ctx.stroke();
    }
  }, 1, 1);
  return new THREE.MeshStandardMaterial({ map, roughness });
}

// Brushed stainless steel, for the fridge and other appliances.
function steel() {
  const map = canvasTexture(64, (ctx, size) => {
    ctx.fillStyle = '#c9cccf';
    ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y++) {
      ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
      ctx.fillRect(0, y, size, 1);
    }
  }, 1, 2);
  return new THREE.MeshStandardMaterial({ map, roughness: 0.38, metalness: 0.35 });
}

// Dark speckled stone, for the kitchen worktop.
function stone() {
  const map = canvasTexture(64, (ctx, size) => {
    ctx.fillStyle = '#2f3134';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 700; i++) {
      ctx.fillStyle = ['rgba(255,255,255,0.25)', 'rgba(150,140,120,0.3)', 'rgba(0,0,0,0.4)'][(Math.random() * 3) | 0];
      ctx.fillRect(Math.random() * size, Math.random() * size, 1.5, 1.5);
    }
  }, 4, 1);
  return new THREE.MeshStandardMaterial({ map, roughness: 0.25 });
}
