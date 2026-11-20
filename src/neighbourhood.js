// The rest of the street: ten more houses along Palm Ave, each a different size
// and look (bungalows, a cottage, two-storey family homes, a modern flat-roofed
// one), built from one adjustable recipe. They are solid: you can't go inside.
import * as THREE from 'three';
import { addObstacle } from './world.js';
import { clearings } from './grass.js';
import { block, canvasTexture, speckle, makeMaterials, hipRoof, addWindow, addPalm } from './house.js';

const SLAB = 0.15;     // concrete base
const STOREY = 2.8;    // height of one floor
const YARD = 7;        // from the pavement to the front wall
const NEAR_EDGE = -9, FAR_EDGE = 0; // the two outer edges of the street's pavements
let nextClearing = 7;  // grass clearings 0-6 belong to the first house, the shop, the street and the petrol station

// --- Wall and roof finishes ---------------------------------------------------

function stucco(css) {
  const map = canvasTexture(128, (ctx, size) => { ctx.fillStyle = css; ctx.fillRect(0, 0, size, size); speckle(ctx, size, 2500, 0.05); }, 4, 2);
  return new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: 1.5, roughness: 0.95 });
}
// Overlapping horizontal boards.
function siding(css, storeys) {
  const map = canvasTexture(64, (ctx, size) => {
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 8) {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(0, y, size, 1.5);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(0, y + 1.5, size, 1.5);
    }
    speckle(ctx, size, 300, 0.03);
  }, 1, storeys * 1.6);
  return new THREE.MeshStandardMaterial({ map, roughness: 0.8 });
}
function brick(css, storeys) {
  const map = canvasTexture(64, (ctx, size) => {
    ctx.fillStyle = '#b9b0a2'; // mortar
    ctx.fillRect(0, 0, size, size);
    for (let row = 0; row < 4; row++) for (let i = -1; i < 2; i++) {
      ctx.fillStyle = css;
      ctx.globalAlpha = 0.8 + Math.random() * 0.2;
      ctx.fillRect(i * 32 + (row % 2) * 16 + 1, row * 16 + 1, 30, 14);
    }
    ctx.globalAlpha = 1;
    speckle(ctx, size, 500, 0.06);
  }, 7, storeys * 5);
  return new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: 2, roughness: 0.9 });
}
// Rows of roof tiles or shingles.
function roofing(css, tiles) {
  const map = canvasTexture(64, (ctx, size) => {
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, size, size);
    speckle(ctx, size, 500, 0.07);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, size - 6, size, 6);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    for (let x = 0; x < size; x += tiles ? 16 : 21) ctx.fillRect(x, 0, tiles ? 3 : 1.5, size);
  }, 1.6, 3);
  return new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: 3, roughness: 0.85, side: THREE.DoubleSide });
}
const flat = (color, roughness = 0.75) => new THREE.MeshStandardMaterial({ color, roughness });

// --- Roof shapes -----------------------------------------------------------------

// A pitched roof with two slopes; the ridge runs along X and the eaves sit at height 0.
function gableRoof(material, length, depth, rise) {
  const L = length / 2, D = depth / 2;
  const A = [-L, 0, D], B = [L, 0, D], C = [L, 0, -D], E = [-L, 0, -D], P = [-L, rise, 0], Q = [L, rise, 0];
  const positions = [], uvs = [];
  for (const [px, py, pz] of [A, B, Q, A, Q, P, C, E, P, C, P, Q]) {
    positions.push(px, py, pz);
    uvs.push(px, Math.hypot(py, D - Math.abs(pz)));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// The triangle of wall that fills each end of a gable roof.
function gableEnd(material, halfWidth, rise, atX) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([atX, 0, -halfWidth, atX, 0, halfWidth, atX, rise, 0], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 0.5], 2));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  return mesh;
}

// Puts a roof of the chosen kind over a box of the given size.
function addRoof(parent, kind, roofMaterial, wallMaterial, trim, cx, cz, w, d, baseY, rise) {
  const roof = new THREE.Group();
  const turned = d > w;                       // the ridge always runs along the longer side
  const length = turned ? d : w, depth = turned ? w : d;
  if (kind === 'hip') {
    roof.add(hipRoof(roofMaterial, length + 1.2, depth + 1.2, rise));
    block(roof, trim, length + 1.2, 0.14, depth + 1.2, 0, -0.07, 0);
  } else if (kind === 'gable') {
    roof.add(gableRoof(roofMaterial, length + 0.8, depth + 1.2, rise));
    const endWall = wallMaterial.clone();
    endWall.side = THREE.DoubleSide;
    roof.add(gableEnd(endWall, depth / 2, rise * (depth / (depth + 1.2)), -length / 2), gableEnd(endWall, depth / 2, rise * (depth / (depth + 1.2)), length / 2));
    block(roof, trim, length + 0.8, 0.12, 0.2, 0, rise, 0); // ridge board
  } else {
    block(roof, trim, length + 0.5, 0.3, depth + 0.5, 0, 0.15, 0);       // flat roof with a raised edge
    block(roof, roofMaterial, length + 0.1, 0.06, depth + 0.1, 0, 0.31, 0);
  }
  if (turned) roof.rotation.y = Math.PI / 2;
  roof.position.set(cx, baseY, cz);
  parent.add(roof);
}

// --- One house -------------------------------------------------------------------

function buildHouse(scene, kit, spec) {
  const { x, w, d, storeys = 1, garage, porch = 'small', doorX = 0, roof } = spec;
  const far = spec.side === 'far';
  const sign = far ? -1 : 1;                                  // far-side houses are turned to face the street
  const z = far ? FAR_EDGE + YARD + d / 2 : NEAR_EDGE - YARD - d / 2;
  const house = new THREE.Group();
  house.position.set(x, 0, z);
  house.rotation.y = far ? Math.PI : 0;

  const height = storeys * STOREY, top = SLAB + height;
  const trim = flat(spec.trim ?? 0xf4efe3, 0.7);
  const windowKit = { trim, glass: kit.glass, shutter: flat(spec.shutters ?? 0x333333, 0.7) };
  const roadZ = d / 2 + YARD; // where the front yard meets the pavement

  // Measurements below are from the middle of the house, with its front toward +Z.
  const rect = (cx, cz, rw, rd) => [x + sign * cx - rw / 2, z + sign * cz - rd / 2, x + sign * cx + rw / 2, z + sign * cz + rd / 2];
  const solid = (cx, cz, rw, rd, h) => { const r = rect(cx, cz, rw, rd); addObstacle(r[0], r[2], r[1], r[3], h); };
  const noGrass = (cx, cz, rw, rd) => { const r = rect(cx, cz, rw, rd); clearings[nextClearing++].set(r[0], r[1], r[2], r[3]); };

  // Main body.
  block(house, kit.concrete, w + 0.3, SLAB, d + 0.3, 0, SLAB / 2, 0);
  block(house, spec.wall, w, height, d, 0, SLAB + height / 2, 0);
  solid(0, 0, w, d, top + 4);
  addRoof(house, roof.kind, roof.material, spec.wall, trim, 0, 0, w, d, top, roof.rise);
  if (storeys > 1) block(house, trim, w + 0.04, 0.14, d + 0.04, 0, SLAB + STOREY, 0); // band between the floors

  // Garage wing on one side, with its own roof and a driveway to the street.
  let minX = -w / 2, maxX = w / 2, driveX, driveWidth, driveStart;
  const garageSide = garage ? garage.dir * sign : 0; // which side, measured in the house's own left/right
  if (garage) {
    const gw = garage.width, gd = Math.min(d, 6.4), gx = garageSide * (w / 2 + gw / 2), gz = d / 2 - gd / 2 + 0.8;
    block(house, kit.concrete, gw + 0.2, SLAB, gd + 0.3, gx, SLAB / 2, gz);
    block(house, spec.wall, gw, STOREY, gd, gx, SLAB + STOREY / 2, gz);
    solid(gx, gz, gw, gd, SLAB + STOREY + 3);
    addRoof(house, roof.kind, roof.material, spec.wall, trim, gx, gz, gw, gd, SLAB + STOREY, roof.rise * 0.7);
    block(house, trim, gw - 0.7, 2.35, 0.06, gx, SLAB + 1.17, gz + gd / 2 + 0.01);
    block(house, kit.garageDoor, gw - 1.0, 2.2, 0.08, gx, SLAB + 1.1, gz + gd / 2 + 0.03);
    minX = Math.min(minX, gx - gw / 2); maxX = Math.max(maxX, gx + gw / 2);
    driveX = gx; driveWidth = gw - 0.8; driveStart = gz + gd / 2;
  } else {
    // No garage: a parking strip beside the house, under a carport if it has one.
    const dir = (spec.driveDir ?? 1) * sign;
    driveX = dir * (w / 2 + 2); driveWidth = 3; driveStart = d / 2 - 4.5;
    if (spec.carport) {
      block(house, trim, 3.6, 0.16, 5.2, driveX, SLAB + 2.5, d / 2 - 2.2);
      for (const [px, pz] of [[1.6, 0.2], [1.6, -4.6], [-1.6, 0.2], [-1.6, -4.6]]) {
        block(house, trim, 0.14, 2.5, 0.14, driveX + px, 1.25, d / 2 + pz);
        solid(driveX + px, d / 2 + pz, 0.2, 0.2, 2.6);
      }
    }
  }
  block(house, kit.concrete, driveWidth, 0.06, roadZ - driveStart, driveX, 0.03, (driveStart + roadZ) / 2).castShadow = false;
  noGrass(driveX, (driveStart + roadZ) / 2, driveWidth + 0.2, roadZ - driveStart + 0.2);

  // Front door, with a step, and either a small porch or one running the width of the house.
  block(house, trim, 1.2, 2.2, 0.06, doorX, SLAB + 1.1, d / 2 + 0.01);
  block(house, flat(spec.door ?? 0x7a3b2a, 0.5), 0.95, 2.05, 0.08, doorX, SLAB + 1.03, d / 2 + 0.03);
  block(house, flat(0xc9a24a, 0.35), 0.06, 0.14, 0.08, doorX + 0.36, SLAB + 1.0, d / 2 + 0.08);
  let porchDepth = 1.1;
  if (porch === 'full') {
    porchDepth = 2.3;
    block(house, kit.concrete, w, SLAB, 2.2, 0, SLAB / 2, d / 2 + 1.1);
    block(house, trim, w + 0.3, 0.16, 2.5, 0, SLAB + 2.55, d / 2 + 1.15);
    for (let px = -w / 2 + 0.2; px <= w / 2 - 0.1; px += (w - 0.4) / Math.max(2, Math.round(w / 3))) {
      block(house, trim, 0.16, 2.5, 0.16, px, SLAB + 1.25, d / 2 + 2.1);
      solid(px, d / 2 + 2.1, 0.2, 0.2, 2.7);
    }
    block(house, trim, w, 0.08, 0.06, 0, SLAB + 0.85, d / 2 + 2.1); // handrail, with a gap for the steps
  } else if (porch === 'small') {
    porchDepth = 1.9;
    block(house, kit.concrete, 2.6, SLAB, 1.8, doorX, SLAB / 2, d / 2 + 0.9);
    block(house, trim, 2.8, 0.15, 2.0, doorX, SLAB + 2.5, d / 2 + 0.95);
    for (const side of [-1, 1]) {
      block(house, trim, 0.16, 2.45, 0.16, doorX + side * 1.2, SLAB + 1.22, d / 2 + 1.7);
      solid(doorX + side * 1.2, d / 2 + 1.7, 0.2, 0.2, 2.7);
    }
  } else {
    block(house, kit.concrete, 1.6, SLAB, 1.0, doorX, SLAB / 2, d / 2 + 0.5);
  }
  block(house, kit.concrete, 1.1, 0.05, roadZ - d / 2 - porchDepth, doorX, 0.025, (d / 2 + porchDepth + roadZ) / 2).castShadow = false;
  noGrass(doorX, (d / 2 + porchDepth + roadZ) / 2, 1.3, roadZ - d / 2 - porchDepth + 0.2);
  noGrass((minX + maxX) / 2, porchDepth / 2, maxX - minX + 0.8, d + porchDepth + 0.8);

  // Windows on every side and every floor.
  const big = spec.bigWindows, wide = big ? 2.2 : 1.3, tall = big ? 1.6 : 1.3;
  const across = Math.max(2, Math.floor(w / 3.2));
  for (let level = 0; level < storeys; level++) {
    const sill = (big ? 0.7 : 0.9) + level * STOREY;
    for (let i = 0; i < across; i++) {
      const wx = -w / 2 + (i + 0.5) * w / across;
      if (!(level === 0 && Math.abs(wx - doorX) < 1.5)) addWindow(house, windowKit, 'front', wx, wide, tall, sill, d / 2, !!spec.shutters);
      addWindow(house, windowKit, 'back', wx, 1.2, 1.2, 0.9 + level * STOREY, -d / 2, false);
    }
    for (const [facing, wallAt, dir] of [['right', w / 2, 1], ['left', -w / 2, -1]]) {
      if (level === 0 && garageSide === dir) continue; // the garage is in the way
      for (const along of [-d / 4, d / 4]) addWindow(house, windowKit, facing, along, 1.2, 1.2, 0.9 + level * STOREY, wallAt, false);
    }
  }

  // Extras: chimney, hedges under the front windows, a mailbox, bins, and maybe a palm.
  if (spec.chimney) block(house, spec.chimney, 0.9, roof.rise + 1.6, 0.9, w / 4, top + (roof.rise + 1.6) / 2 - 0.4, -d / 6);
  if (porch !== 'full') {
    for (const side of [-1, 1]) {
      const from = side < 0 ? -w / 2 + 0.3 : doorX + 1.6, to = side < 0 ? doorX - 1.6 : w / 2 - 0.3;
      if (to - from < 1.2) continue;
      block(house, kit.hedge, to - from, 0.7, 0.8, (from + to) / 2, 0.37, d / 2 + 0.55);
      solid((from + to) / 2, d / 2 + 0.55, to - from, 0.8, 0.75);
    }
  }
  const boxX = driveX + (driveX > doorX ? 1 : -1) * (driveWidth / 2 + 0.5);
  block(house, flat(0x6b5846, 0.9), 0.1, 1.05, 0.1, boxX, 0.52, roadZ - 0.5);
  block(house, flat(spec.door ?? 0x7a3b2a, 0.5), 0.22, 0.24, 0.5, boxX, 1.15, roadZ - 0.5);
  solid(boxX, roadZ - 0.5, 0.25, 0.5, 1.3);
  const binX = driveX + (driveX > 0 ? 1 : -1) * (driveWidth / 2 + 0.6);
  block(house, flat(0x2f5a3c, 0.6), 0.6, 0.95, 0.7, binX, 0.5, driveStart + 0.6);
  block(house, flat(0x2a2a2a, 0.8), 0.66, 0.07, 0.76, binX, 1.0, driveStart + 0.6);
  solid(binX, driveStart + 0.6, 0.6, 0.7, 1.05);
  if (spec.palm) {
    const [px, pz, palmHeight, lean] = spec.palm;
    addPalm(house, kit, px, pz, palmHeight, lean);
    solid(px, pz, 0.45, 0.45, palmHeight * 0.5);
  }

  scene.add(house);
}

// --- The ten houses ----------------------------------------------------------------

export function createNeighbourhood(scene) {
  const kit = makeMaterials(); // shared glass, concrete, garage doors, hedges and palm materials
  const tiles = (css) => roofing(css, true), shingles = (css) => roofing(css, false);
  const redBrick = brick('#9c4a36', 1);

  const houses = [
    // Far side of the street, from one end to the other.
    { side: 'far', x: -58, w: 9, d: 7, wall: siding('#bcd3e0', 1), roof: { kind: 'gable', material: shingles('#5a5f66'), rise: 2.2 },
      porch: 'full', door: 0xb3352a, shutters: 0x2f4f6a, palm: [-3.5, 8.5, 6.5, 0.8] },
    { side: 'far', x: -38, w: 12, d: 9, storeys: 2, wall: brick('#9c4a36', 2), roof: { kind: 'hip', material: shingles('#3c3f44'), rise: 2.4 },
      garage: { width: 6, dir: -1 }, door: 0x1f3a2a, shutters: 0x1f3a2a, chimney: redBrick, doorX: 1.5 },
    { side: 'far', x: -14, w: 14, d: 8, wall: stucco('#ecd58a'), roof: { kind: 'hip', material: tiles('#b9583a'), rise: 1.7 },
      garage: { width: 4, dir: 1 }, door: 0x2f6f86, shutters: 0x7a5a2a, doorX: -2.2, palm: [4.5, 8.8, 7.2, -1.0] },
    { side: 'far', x: 8, w: 7, d: 6, wall: siding('#b9dcc4', 1), roof: { kind: 'gable', material: shingles('#6b4a34'), rise: 2.5 },
      door: 0xe0a030, shutters: 0xf4efe3, chimney: redBrick, driveDir: -1 },
    { side: 'far', x: 28, w: 12, d: 9, storeys: 2, wall: stucco('#f3f1ec'), roof: { kind: 'flat', material: flat(0x55585c, 0.9), rise: 0 },
      garage: { width: 6, dir: 1 }, door: 0x202326, trim: 0x2c2f33, bigWindows: true, porch: 'none', doorX: -3 },
    { side: 'far', x: 54, w: 10, d: 8, storeys: 2, wall: siding('#8fa3b3', 2), roof: { kind: 'gable', material: shingles('#33363b'), rise: 2.6 },
      garage: { width: 4, dir: -1 }, door: 0xf4efe3, shutters: 0x24303c, doorX: 1.2 },
    { side: 'far', x: 76, w: 13, d: 8, wall: stucco('#f0b8b0'), roof: { kind: 'hip', material: tiles('#a84a30'), rise: 1.8 },
      garage: { width: 6, dir: 1 }, door: 0x3d6f73, shutters: 0xf4efe3, doorX: -2, palm: [-5, 9, 6.8, 0.9] },
    // The same side as the first house.
    { side: 'near', x: -28, w: 11, d: 8, wall: brick('#b99a72', 1), roof: { kind: 'gable', material: shingles('#3f3a36'), rise: 2.1 },
      garage: { width: 4, dir: 1 }, door: 0x7a2a22, shutters: 0x3f3a36, chimney: brick('#b99a72', 1), doorX: -1.5 },
    { side: 'near', x: -56, w: 15, d: 10, storeys: 2, wall: stucco('#f6f0e2'), roof: { kind: 'hip', material: tiles('#b04a34'), rise: 2.6 },
      garage: { width: 6, dir: -1 }, door: 0x4a3424, shutters: 0x6b4a34, porch: 'full', doorX: 0, palm: [6.5, 12.5, 7.5, 1.1] },
    { side: 'near', x: 84, w: 8, d: 7, wall: siding('#f0dc8c', 1), roof: { kind: 'gable', material: shingles('#5a4636'), rise: 2.0 },
      door: 0x2f6f86, shutters: 0xf4efe3, carport: true },
  ];
  for (const spec of houses) buildHouse(scene, kit, spec);
}
