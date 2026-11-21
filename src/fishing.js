// Fishing: thirty kinds of fish (ten small, ten medium, ten big), each built in
// code with its own body shape, fins, colours and markings, plus the fish stall
// on the beach that buys the catch. The casting and reeling is handled in main.js.
import * as THREE from 'three';
import { addObstacle } from './world.js';
import { block } from './house.js';
import { label } from './store.js';

// Every fish is described by its looks and its size:
//   kg: [lightest, heaviest]   price: G$ per kg
//   depth: how deep the body is compared with its length   thick: how wide compared with deep
//   nose: lower numbers give a blunter, deeper head   tail / dorsal: fin shapes
//   back, side, belly, fin: colours   mark: the pattern on its sides, in colour `ink`
const S = (name, kg, price, look) => ({ name, kg, price, depth: 0.15, thick: 0.45, nose: 0.62, tail: 'fork', dorsal: 'spiny', mark: 'plain', ink: 0x222222, fin: 0x6a6f66, ...look });
export const FISH = {
  small: [
    S('Pinfish', [0.1, 0.4], 14, { depth: 0.2, back: 0x6f8a5a, side: 0xc9d2b0, belly: 0xf0eee0, mark: 'bars', ink: 0x4a5a3a, fin: 0xc9b23a }),
    S('Scaled Sardine', [0.05, 0.15], 20, { depth: 0.12, back: 0x3f6f7a, side: 0xd5dde0, belly: 0xf6f6f2, dorsal: 'small' }),
    S('Striped Mullet', [0.4, 1.4], 8, { depth: 0.12, thick: 0.7, nose: 0.5, back: 0x55606a, side: 0xb9c2c6, belly: 0xeeeeea, mark: 'lines', ink: 0x3a444c, dorsal: 'double' }),
    S('White Grunt', [0.2, 0.8], 12, { depth: 0.18, back: 0x8f9aa0, side: 0xcfd6d8, belly: 0xf0f0ea, mark: 'lines', ink: 0x3f7fb0, fin: 0xb9b08a }),
    S('Blue Runner', [0.3, 1.2], 10, { depth: 0.14, back: 0x3f6a6a, side: 0xb9c9c4, belly: 0xeef0e6, tail: 'lunate', dorsal: 'double', fin: 0x4a5a56 }),
    S('Ballyhoo', [0.08, 0.25], 18, { depth: 0.07, thick: 0.7, back: 0x4a7a5a, side: 0xcfd9d6, belly: 0xf6f6f2, special: 'beak', dorsal: 'small', fin: 0xd9783a }),
    S('Pigfish', [0.15, 0.6], 12, { depth: 0.18, back: 0x7a8fa6, side: 0xc9d2da, belly: 0xf0eee6, mark: 'spots', ink: 0xc98a3a, fin: 0xc9b060 }),
    S('Spot Croaker', [0.15, 0.5], 12, { depth: 0.17, back: 0x7a8088, side: 0xcfd2d0, belly: 0xf2efe2, mark: 'bars', ink: 0x6a6a60, fin: 0xd9c66a, tail: 'round' }),
    S('Lane Snapper', [0.2, 0.9], 16, { depth: 0.17, back: 0xc9646a, side: 0xf0b0b0, belly: 0xf6eee6, mark: 'lines', ink: 0xe0c040, fin: 0xd9483a }),
    S('Sergeant Major', [0.1, 0.3], 14, { depth: 0.24, nose: 0.5, back: 0xb9b23a, side: 0xd9dcc0, belly: 0xf0f0e6, mark: 'bars', ink: 0x1c1d1f, fin: 0x3a3d42 }),
  ],
  medium: [
    S('Red Snapper', [1.5, 6], 22, { depth: 0.18, back: 0xb9382b, side: 0xe0685a, belly: 0xf4c9bd, fin: 0xc23a2e }),
    S('Spanish Mackerel', [1, 4], 16, { depth: 0.1, back: 0x2f6f6a, side: 0xcfd9d9, belly: 0xf6f6f2, mark: 'spots', ink: 0xd9a82a, tail: 'lunate', dorsal: 'double', fin: 0x3a4a4a }),
    S('Sheepshead', [1.2, 5], 18, { depth: 0.22, nose: 0.5, back: 0x6a6f6a, side: 0xcfd2cc, belly: 0xeeeee6, mark: 'bars', ink: 0x1c1d1f, fin: 0x3a3d3a }),
    S('Florida Pompano', [0.8, 3], 30, { depth: 0.22, nose: 0.5, back: 0x6a8a90, side: 0xdce2e0, belly: 0xf2e6a0, tail: 'lunate', dorsal: 'long', fin: 0xd9c040 }),
    S('Common Snook', [2, 9], 24, { depth: 0.11, thick: 0.6, nose: 0.75, back: 0x7a7f4a, side: 0xd9d9c0, belly: 0xf4f2e6, mark: 'stripe', ink: 0x141516, dorsal: 'double', fin: 0xc9b23a }),
    S('Redfish', [2, 10], 20, { depth: 0.14, thick: 0.6, back: 0xa8603a, side: 0xd99a6a, belly: 0xf4ead9, mark: 'tailspot', ink: 0x141516, fin: 0x9a5a3a, tail: 'round' }),
    S('Spotted Seatrout', [0.8, 4], 18, { depth: 0.11, back: 0x6a7a80, side: 0xcfd6d6, belly: 0xf6f6f0, mark: 'spots', ink: 0x1c1d1f, fin: 0xb9b060 }),
    S('Yellowtail Snapper', [0.8, 3.5], 26, { depth: 0.14, back: 0x6a8fa8, side: 0xd9dce0, belly: 0xf6f0f0, mark: 'stripe', ink: 0xf0c020, fin: 0xf0c020 }),
    S('Jack Crevalle', [2, 12], 10, { depth: 0.2, nose: 0.45, back: 0x5a6f4a, side: 0xc9d2b9, belly: 0xf0e6a0, tail: 'lunate', dorsal: 'double', fin: 0xc9b23a }),
    S('Mangrove Snapper', [0.8, 4], 22, { depth: 0.17, back: 0x7a5a4a, side: 0xb98a6a, belly: 0xe6c9b0, fin: 0x8a4a3a }),
  ],
  big: [
    S('Tarpon', [25, 90], 6, { depth: 0.13, thick: 0.5, nose: 0.6, back: 0x4a6a6a, side: 0xdfe6e6, belly: 0xf6f6f6, dorsal: 'small', fin: 0x4a5a5a, scales: 2.2 }),
    S('Mahi-Mahi', [6, 25], 20, { depth: 0.16, thick: 0.4, nose: 0.3, back: 0x1f8a6a, side: 0xd9d040, belly: 0xf0e68a, mark: 'spots', ink: 0x1f6a8a, dorsal: 'long', fin: 0x1f6aa8, special: 'bluntHead' }),
    S('King Mackerel', [8, 30], 14, { depth: 0.09, back: 0x2f5a5a, side: 0xcfd9d9, belly: 0xf6f6f2, tail: 'lunate', dorsal: 'double', fin: 0x3a4a4a }),
    S('Goliath Grouper', [60, 220], 3, { depth: 0.2, thick: 0.75, nose: 0.45, back: 0x6a5a3a, side: 0x9a8a5a, belly: 0xc9b98a, mark: 'spots', ink: 0x3a2f1c, tail: 'round', dorsal: 'long', fin: 0x5a4a2f }),
    S('Sailfish', [20, 60], 16, { depth: 0.09, back: 0x1f3a6a, side: 0xb9c2c9, belly: 0xf0f0f0, mark: 'bars', ink: 0x6a9ad0, tail: 'lunate', dorsal: 'sail', fin: 0x1f2f6a, special: 'bill' }),
    S('Blue Marlin', [80, 300], 5, { depth: 0.11, back: 0x16306a, side: 0xa8b9c9, belly: 0xf2f2f2, mark: 'bars', ink: 0x5a8ad0, tail: 'lunate', dorsal: 'marlin', fin: 0x16255a, special: 'bill' }),
    S('Swordfish', [50, 200], 7, { depth: 0.11, back: 0x3a3550, side: 0x8a8a9a, belly: 0xe6e6e6, tail: 'lunate', dorsal: 'shark', fin: 0x2f2a40, special: 'sword', scales: 0 }),
    S('Yellowfin Tuna', [20, 90], 12, { depth: 0.15, thick: 0.75, nose: 0.55, back: 0x1c2f4a, side: 0xb9c2c9, belly: 0xf2f2f2, mark: 'stripe', ink: 0xf0c020, tail: 'lunate', dorsal: 'double', fin: 0xf0c020 }),
    S('Great Barracuda', [6, 25], 9, { depth: 0.065, thick: 0.7, nose: 0.85, back: 0x4a5a5a, side: 0xcfd6d6, belly: 0xf6f6f6, mark: 'tailspot', ink: 0x1c1d1f, dorsal: 'double', fin: 0x3a4444 }),
    S('Bull Shark', [90, 230], 4, { depth: 0.12, thick: 0.9, nose: 0.5, back: 0x5a6068, side: 0x8a9096, belly: 0xf0f0ee, tail: 'shark', dorsal: 'shark', fin: 0x50565e, scales: 0 }),
  ],
};
// How long each size of fish is drawn when held up to look at, in metres.
export const SHOW_LENGTH = { small: 0.42, medium: 0.7, big: 1.05 };

// Pick what took the bait. Further out to sea the fish run bigger.
// (forceSize and forceIndex are for testing a particular fish.)
export function rollCatch(metresOut, forceSize, forceIndex) {
  const far = THREE.MathUtils.clamp((metresOut - 80) / 260, 0, 1);
  const bigChance = 0.05 + 0.3 * far, smallChance = 0.7 - 0.45 * far, roll = Math.random();
  const size = forceSize || (roll < bigChance ? 'big' : roll < bigChance + smallChance ? 'small' : 'medium');
  const kinds = FISH[size], spec = kinds[forceIndex ?? Math.floor(Math.random() * kinds.length)];
  const weight = spec.kg[0] + (spec.kg[1] - spec.kg[0]) * Math.random() ** 1.8; // most are on the light side; monsters are rare
  return { spec, size, weight, price: Math.max(1, Math.round(weight * spec.price)) };
}

// --- Building a fish ---------------------------------------------------------------
// The fish is one unit long, nose toward +X, and is scaled to size by whoever uses it.

const NOSE_X = 0.5, TAIL_X = -0.38;

// Half the body's height at a point along it: t = 0 at the nose, 1 where the tail fin joins.
function bodyHalfHeight(spec, t) {
  const blunt = spec.special === 'bluntHead' ? Math.max(0, 1 - t * 4) * 0.5 * Math.min(1, Math.sqrt(t * 9)) : 0; // the mahi-mahi's tall forehead
  return spec.depth * (0.13 * t + (Math.sin(Math.PI * Math.pow(t, spec.nose)) ** 0.8) * 0.87 + blunt * (1 - t));
}
const xAt = (t) => NOSE_X + (TAIL_X - NOSE_X) * t;
const tAt = (x) => (NOSE_X - x) / (NOSE_X - TAIL_X);

// The skin, painted as a strip: left to right is nose to tail; top to bottom goes
// once round the body from the back, down one side to the belly, and up the other.
function skinTexture(spec) {
  const W = 512, H = 128, canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const css = (hex) => `#${new THREE.Color(hex).getHexString()}`;
  const round = ctx.createLinearGradient(0, 0, 0, H);
  for (const [stop, colour] of [[0, spec.back], [0.16, spec.back], [0.3, spec.side], [0.44, spec.belly], [0.56, spec.belly], [0.7, spec.side], [0.84, spec.back], [1, spec.back]]) round.addColorStop(stop, css(colour));
  ctx.fillStyle = round;
  ctx.fillRect(0, 0, W, H);
  const bothSides = (draw) => { draw((v) => v * H); draw((v) => (1 - v) * H); }; // v: 0 at the back, 0.5 at the belly
  const ink = css(spec.ink);

  if (spec.mark === 'bars') bothSides((y) => {            // dark bars down the sides
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 7; i++) ctx.fillRect(W * (0.2 + i * 0.105), Math.min(y(0.06), y(0.36)), W * 0.035, Math.abs(y(0.36) - y(0.06)));
  });
  if (spec.mark === 'stripe') bothSides((y) => {          // one bold stripe from gill to tail
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(W * 0.2, y(0.27) - 3, W * 0.8, 6);
  });
  if (spec.mark === 'lines') bothSides((y) => {           // several thin lines along the body
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < 5; i++) ctx.fillRect(W * 0.16, y(0.14 + i * 0.05) - 1, W * 0.84, 2);
  });
  if (spec.mark === 'spots') bothSides((y) => {           // scattered spots on the upper sides
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.75;
    for (let i = 0; i < 46; i++) {
      ctx.beginPath();
      ctx.arc(W * (0.2 + Math.random() * 0.78), y(0.08 + Math.random() * 0.26), 1.6 + Math.random() * 2.4, 0, 7);
      ctx.fill();
    }
  });
  if (spec.mark === 'tailspot') bothSides((y) => {        // one black spot by the tail
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(W * 0.9, y(0.24), 7, 0, 7);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // Scales: rows of small overlapping arcs, each catching a little light.
  const scale = spec.scales ?? 1;
  if (scale > 0) {
    const step = 7 * scale;
    for (let y = 0; y < H; y += step * 0.8) for (let x = W * 0.18 + ((y / (step * 0.8)) % 2) * step / 2; x < W; x += step) {
      ctx.strokeStyle = 'rgba(0,0,0,0.16)';
      ctx.beginPath();
      ctx.arc(x, y, step * 0.55, -1.2, 1.2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.beginPath();
      ctx.arc(x - 1, y, step * 0.55, -1.0, 1.0);
      ctx.stroke();
    }
  }
  // Head: smooth and a shade darker, with the curved edge of the gill cover and the line of the mouth.
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.fillRect(0, 0, W * 0.18, H);
  bothSides((y) => {
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W * 0.2, y(0.1));
    ctx.quadraticCurveTo(W * 0.245, y(0.28), W * 0.2, y(0.44));
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, y(0.33));
    ctx.lineTo(W * 0.07, y(0.34));
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';               // the faint line along each side
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W * 0.2, y(0.23));
    ctx.lineTo(W, y(0.26));
    ctx.stroke();
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// A flat fin cut from an outline of [x, y] points.
function fin(points, material) {
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)))), material);
  mesh.castShadow = true;
  return mesh;
}

export function makeFish(spec) {
  const fish = new THREE.Group();
  const skin = skinTexture(spec);
  // A little shine for wet scales, and a faint glow of its own so it can be seen at night.
  const body = new THREE.MeshStandardMaterial({ map: skin, roughness: 0.28, metalness: 0.3, emissiveMap: skin, emissive: 0xffffff, emissiveIntensity: 0.12 });
  const finSkin = new THREE.MeshStandardMaterial({ color: spec.fin, roughness: 0.5, side: THREE.DoubleSide, transparent: true, opacity: 0.9, emissive: spec.fin, emissiveIntensity: 0.1 });
  const top = (x) => bodyHalfHeight(spec, tAt(x));            // height of the back above the middle
  const under = (x) => -bodyHalfHeight(spec, tAt(x)) * 0.86;  // the belly is a little flatter

  // Body: rings from nose to tail, taller than they are wide.
  const RINGS = 34, SIDES = 16, positions = [], uvs = [], index = [];
  for (let i = 0; i <= RINGS; i++) {
    const t = i / RINGS, h = Math.max(0.0015, bodyHalfHeight(spec, t)), w = h * spec.thick;
    for (let j = 0; j <= SIDES; j++) {
      const a = (j / SIDES) * Math.PI * 2, up = Math.cos(a);
      positions.push(xAt(t), (up > 0 ? up : up * 0.86) * h, Math.sin(a) * w);
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
  const bodyMesh = new THREE.Mesh(geometry, body);
  bodyMesh.castShadow = true;
  fish.add(bodyMesh);

  // Tail fin.
  const d = spec.depth, base = top(TAIL_X) * 0.9;
  const tails = {
    fork: [[TAIL_X + 0.02, base], [-0.5, d * 1.15], [-0.445, 0], [-0.5, -d * 1.15], [TAIL_X + 0.02, -base]],
    lunate: [[TAIL_X + 0.02, base], [-0.47, d * 1.1], [-0.52, d * 1.7], [-0.43, 0], [-0.52, -d * 1.7], [-0.47, -d * 1.1], [TAIL_X + 0.02, -base]],
    round: [[TAIL_X + 0.02, base], [-0.46, d * 0.85], [-0.5, d * 0.5], [-0.51, 0], [-0.5, -d * 0.5], [-0.46, -d * 0.85], [TAIL_X + 0.02, -base]],
    shark: [[TAIL_X + 0.02, base], [-0.47, d * 1.2], [-0.54, d * 2.1], [-0.46, d * 0.3], [-0.5, -d * 1.0], [-0.44, -d * 0.4], [TAIL_X + 0.02, -base]],
  };
  fish.add(fin(tails[spec.tail], finSkin));

  // Fins along the back: `shape` gives each fin's height along its length, as a fraction of body depth.
  const backFin = (from, to, shape, lean = 0.03) => {
    const points = [[from, top(from) * 0.9]], n = shape.length;
    shape.forEach((height, i) => { const x = from + (to - from) * (i + 0.5) / n; points.push([x - lean * height, top(x) + d * height]); });
    points.push([to, top(to) * 0.9]);
    fish.add(fin(points, finSkin));
  };
  const spines = [0.5, 0.95, 0.6, 0.9, 0.55, 0.8, 0.5, 0.65, 0.4, 0.45]; // the jagged edge of a spiny fin
  if (spec.dorsal === 'spiny') backFin(0.16, -0.26, spines);
  if (spec.dorsal === 'small') backFin(0.02, -0.14, [0.85, 0.6, 0.3], 0.06);
  if (spec.dorsal === 'long') backFin(0.3, -0.33, [0.75, 0.8, 0.72, 0.66, 0.6, 0.54, 0.48, 0.42, 0.36, 0.3]);
  if (spec.dorsal === 'shark') backFin(0.1, -0.08, [0.6, 1.5, 1.1], 0.08);
  if (spec.dorsal === 'sail') backFin(0.3, -0.24, [1.6, 2.5, 2.9, 2.7, 3.0, 2.6, 2.8, 2.3, 1.9, 1.2, 0.6]);  // the sailfish's huge sail
  if (spec.dorsal === 'marlin') { backFin(0.3, 0.12, [1.5, 1.2, 0.5], 0.1); backFin(0.12, -0.25, [0.3, 0.26, 0.24, 0.2]); }
  if (spec.dorsal === 'double') {                              // a spiny fin, a soft one, and a row of finlets
    backFin(0.2, 0.02, [0.5, 0.85, 0.5, 0.25]);
    backFin(-0.04, -0.2, [1.0, 0.55, 0.25], 0.1);
    for (let i = 0; i < 4; i++) { const x = -0.22 - i * 0.035; fish.add(fin([[x, top(x)], [x - 0.02, top(x) + d * 0.2], [x - 0.025, top(x)]], finSkin)); }
    for (let i = 0; i < 4; i++) { const x = -0.22 - i * 0.035; fish.add(fin([[x, under(x)], [x - 0.02, under(x) - d * 0.2], [x - 0.025, under(x)]], finSkin)); }
  }
  // Fin under the tail, the pair under the belly, and the pair behind the gills.
  fish.add(fin([[-0.1, under(-0.1) * 0.9], [-0.17, under(-0.15) - d * (spec.tail === 'lunate' ? 0.9 : 0.5)], [-0.28, under(-0.28) * 0.9]], finSkin));
  for (const side of [-1, 1]) {
    const belly = fin([[0.12, 0], [0.02, -d * 0.55], [0.0, 0]], finSkin);
    belly.position.set(0, under(0.1) * 0.9, side * d * spec.thick * 0.35);
    belly.rotation.x = -side * 0.5;
    const pectoral = fin([[0, 0], [-0.13, d * 0.16], [-0.15, -d * 0.3], [-0.03, -d * 0.2]], finSkin);
    pectoral.position.set(0.24, -d * 0.2, side * bodyHalfHeight(spec, tAt(0.24)) * spec.thick * 0.96);
    pectoral.rotation.y = -side * 0.55;
    // Eyes: a pale iris with a black pupil, just behind the mouth.
    const ex = 0.385, eh = bodyHalfHeight(spec, tAt(ex)), size = Math.max(0.006, Math.min(0.014, eh * 0.15));
    const eye = new THREE.Mesh(new THREE.SphereGeometry(size, 12, 10), new THREE.MeshStandardMaterial({ color: 0xe9e2b0, roughness: 0.15, emissive: 0x555040 }));
    eye.scale.z = 0.45; // set into the head, not bulging out of it
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(size * 0.55, 10, 8), new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.05 }));
    pupil.scale.z = 0.4;
    fish.add(belly, pectoral, eye, pupil);
  }
  // A long bill, sword or beak on the fish that have one.
  const spike = { bill: [0.2, 0.011], sword: [0.34, 0.014], beak: [0.16, 0.006] }[spec.special];
  if (spike) {
    const bill = new THREE.Mesh(new THREE.ConeGeometry(spike[1], spike[0], 8), new THREE.MeshStandardMaterial({ color: spec.back, roughness: 0.4 }));
    bill.rotation.z = -Math.PI / 2;
    if (spec.special === 'sword') bill.scale.z = 2.2; // a swordfish's sword is flat
    bill.position.set(NOSE_X - 0.015 + spike[0] / 2, spec.special === 'beak' ? -0.006 : 0.004, 0);
    fish.add(bill);
  }
  return fish;
}

// --- The fish stall ---------------------------------------------------------------------

// A stall on the beach that buys fish: a counter of crushed ice with fish laid out
// on it, under a striped awning. Its front faces +X, toward the sea.
export function createFishStall(scene, x, z) {
  const stall = new THREE.Group();
  stall.position.set(x, 0.15, z); // standing on the sand
  const plain = (color, roughness = 0.8) => new THREE.MeshStandardMaterial({ color, roughness });
  const wood = plain(0x8a6240, 0.8), white = plain(0xf2f0e8, 0.7);
  block(stall, wood, 1.2, 0.9, 3.2, 0, 0.45, 0);
  block(stall, plain(0xdfeef2, 0.35), 1.1, 0.1, 3.0, 0, 0.94, 0);          // crushed ice
  for (const pz of [-1.55, 1.55]) for (const px of [-0.55, 0.55]) block(stall, wood, 0.1, 2.5, 0.1, px, 1.25, pz);
  const awning = block(stall, new THREE.MeshStandardMaterial({ color: 0x2f8fb5, roughness: 0.9, side: THREE.DoubleSide }), 2.2, 0.06, 3.5, 0.3, 2.5, 0);
  awning.rotation.z = -0.18;
  for (let i = 0; i < 4; i++) block(stall, white, 2.22, 0.065, 0.42, 0.3, 2.5, -1.3 + i * 0.87).rotation.z = -0.18; // white stripes
  block(stall, new THREE.MeshBasicMaterial({ map: label('FRESH FISH', 'WE BUY YOUR CATCH · BEST PRICES FOR BIG ONES', '#1f5a8a', '#f2f0e8', 512, 128) }), 0.06, 0.7, 2.8, 0.62, 0.42, 0);
  [[FISH.medium[0], 0.55, -1.0], [FISH.medium[3], 0.5, -0.2], [FISH.small[8], 0.36, 0.5], [FISH.medium[7], 0.5, 1.1]].forEach(([spec, length, pz], i) => {
    const fish = makeFish(spec);
    fish.scale.setScalar(length);
    fish.rotation.set(Math.PI / 2, 0, 0.3 + i * 0.25); // lying on its side on the ice
    fish.position.set(0, 1.03, pz);
    stall.add(fish);
  });
  block(stall, plain(0x9ea3a7, 0.4), 0.5, 0.06, 0.5, -0.1, 1.02, -1.3 + 2.75); // weighing scales
  block(stall, white, 0.3, 0.3, 0.05, -0.1, 1.2, 1.7);
  scene.add(stall);
  addObstacle(x - 0.6, x + 0.6, z - 1.6, z + 1.6, 2.6);
}
