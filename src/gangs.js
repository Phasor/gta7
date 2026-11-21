// The two gangs and their turf. The members themselves are made in npc.js;
// this file says who they are and builds the corner each gang hangs out on.
import * as THREE from 'three';
import { addObstacle } from './world.js';
import { clearings } from './grass.js';
import { block, canvasTexture, speckle } from './house.js';

// turf: where they hang out. front: +1 if they face toward +Z, -1 toward -Z (always toward the road).
export const GANGS = {
  vipers: { name: 'Palm Ave Vipers', colour: 0xd9281e, clothes: 0, turf: [-86, 17], front: -1 },
  sharks: { name: 'Miami Sharks', colour: 0x2f6fe0, clothes: 200, turf: [729, -27], front: 1 },
};
// Where each of a gang's four members stands, measured from the middle of the turf.
export const POSTS = [[-2.6, 2.2], [-0.8, 0.6], [1.2, 1.8], [3.0, 0.4]];

// A wall sprayed with the gang's name.
function graffiti(name, colour) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  for (let row = 0; row < 8; row++) for (let i = -1; i < 9; i++) { // breeze blocks
    const shade = 150 + Math.random() * 25;
    ctx.fillStyle = `rgb(${shade},${shade},${shade - 6})`;
    ctx.fillRect(i * 64 + (row % 2) * 32 + 1, row * 16 + 1, 62, 14);
  }
  speckle(ctx, 512, 1500, 0.05);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'italic bold 62px Impact, Arial Black, sans-serif';
  ctx.lineWidth = 9;
  ctx.strokeStyle = '#111';
  ctx.strokeText(name, 256, 66, 480);
  ctx.fillStyle = `#${new THREE.Color(colour).getHexString()}`;
  ctx.fillText(name, 256, 66, 480);
  for (let i = 0; i < 9; i++) { ctx.fillRect(60 + Math.random() * 400, 92, 3, 8 + Math.random() * 26); } // drips
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95 });
}

export function createTurfs(scene) {
  const plain = (color, roughness = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  let clearing = 43;
  for (const gang of Object.values(GANGS)) {
    const [x, z] = gang.turf, f = gang.front;
    const turf = new THREE.Group();
    turf.position.set(x, 0, z);
    const at = (px, pz) => [px, -f * pz]; // "behind" the gang is away from the road

    // A cracked concrete pad to stand on.
    const pad = canvasTexture(128, (ctx, s) => { ctx.fillStyle = '#a8a294'; ctx.fillRect(0, 0, s, s); speckle(ctx, s, 3000, 0.08); }, 3, 3);
    block(turf, new THREE.MeshStandardMaterial({ map: pad, roughness: 1 }), 12, 0.06, 10, 0, 0.03, -f * 1).castShadow = false;
    clearings[clearing++].set(x - 6.1, z - f * 1 - 5.1, x + 6.1, z - f * 1 + 5.1);

    // The wall with their name on it, behind them.
    const [, wallZ] = at(0, 4.6);
    block(turf, graffiti(gang.name.toUpperCase(), gang.colour), 9, 2.3, 0.3, 0, 1.15, wallZ);
    addObstacle(x - 4.5, x + 4.5, z + wallZ - 0.15, z + wallZ + 0.15, 2.3);

    // Oil drums, one with a fire going; a wrecked sofa; crates; tyres.
    const drum = (px, pz, colour, lit) => {
      const [dx, dz] = at(px, pz);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 14), plain(colour, 0.6, { metalness: 0.4 }));
      barrel.position.set(dx, 0.45, dz);
      barrel.castShadow = true;
      turf.add(barrel);
      addObstacle(x + dx - 0.3, x + dx + 0.3, z + dz - 0.3, z + dz + 0.3, 0.9);
      if (!lit) return null;
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.7, 8), new THREE.MeshBasicMaterial({ color: 0xff8a1e }));
      flame.position.set(dx, 1.2, dz);
      const core = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.45, 8), new THREE.MeshBasicMaterial({ color: 0xffe14f }));
      core.position.set(dx, 1.1, dz);
      const glow = new THREE.PointLight(0xff8a30, 6, 9, 1.6);
      glow.position.set(dx, 1.5, dz);
      turf.add(flame, core, glow);
      return flame;
    };
    gang.flame = drum(-4.6, 2.6, 0x3a3d42, true);
    drum(4.4, 3.4, 0x2f5a8a, false);
    drum(5.0, 2.7, 0x8a3a2a, false);
    const [sofaX, sofaZ] = at(1.5, 3.6);
    block(turf, plain(0x5a4a3a, 1), 2.2, 0.45, 0.9, sofaX, 0.25, sofaZ);
    block(turf, plain(0x5a4a3a, 1), 2.2, 0.55, 0.25, sofaX, 0.7, sofaZ - f * 0.35);
    addObstacle(x + sofaX - 1.1, x + sofaX + 1.1, z + sofaZ - 0.5, z + sofaZ + 0.5, 0.9);
    const [crateX, crateZ] = at(-2.6, 3.8);
    block(turf, plain(0x8a6a44, 0.9), 0.9, 0.7, 0.9, crateX, 0.38, crateZ);
    block(turf, plain(0x7a5a38, 0.9), 0.7, 0.5, 0.7, crateX + 0.1, 0.98, crateZ);
    addObstacle(x + crateX - 0.45, x + crateX + 0.45, z + crateZ - 0.45, z + crateZ + 0.45, 1.2);
    for (let i = 0; i < 3; i++) {
      const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.12, 8, 16), plain(0x1b1b1c, 0.95));
      tyre.rotation.x = Math.PI / 2;
      const [tx, tz] = at(-5.0, -1.5);
      tyre.position.set(tx, 0.13 + i * 0.22, tz);
      turf.add(tyre);
    }
    scene.add(turf);
  }
}

// Each frame: the fires flicker.
export function updateTurfs(time) {
  for (const gang of Object.values(GANGS)) {
    if (gang.flame) gang.flame.scale.set(1 + Math.sin(time * 13) * 0.12, 1 + Math.sin(time * 9 + 1) * 0.2, 1 + Math.cos(time * 11) * 0.12);
  }
}
