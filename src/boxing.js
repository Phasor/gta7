// Miami Fight Club: an open-air boxing ring in the gap beside Club Neon. A
// bookie's booth takes legal bets, the fighters wait in their corner by the
// ring, and the bouts happen up on the canvas. The front faces +Z, the street.
import * as THREE from 'three';
import { addObstacle, addFloor } from './world.js';
import { block, canvasTexture, speckle } from './house.js';
import { label } from './store.js';

export const RING = { x: 830.5, z: -21.5, top: 0.55, half: 3.3 }; // the middle of the ring, the height of the canvas, and how far out the ropes are

// The fighters, easiest first. hp: how much punishment they take. power: how hard they hit.
// wait: seconds between their attacks. quick: how fast they swing. block: how often they block a blow.
// odds: what a winning bet on yourself pays, times the stake.
export const FIGHTERS = [
  { name: 'Slim Eddie', hp: 160, power: 8, wait: 2.2, quick: 1, block: 0, odds: 2, clothes: 140, height: 0.98 },
  { name: 'Rico "The Hammer" Diaz', hp: 230, power: 11, wait: 1.7, quick: 1.15, block: 0.1, odds: 3, clothes: 200, height: 1.04 },
  { name: 'Mad Mike', hp: 320, power: 14, wait: 1.3, quick: 1.3, block: 0.2, odds: 4, clothes: 90, height: 1.08 },
  { name: 'Iron Vic, the Champion', hp: 520, power: 18, wait: 0.75, quick: 1.75, block: 0.45, odds: 8, clothes: 0, height: 1.16, champion: true },
];
// Where each one waits beside the ring.
FIGHTERS.forEach((fighter, i) => { fighter.post = [RING.x + 7.6, RING.z + 3 - i * 2]; });

export function createBoxingRing(scene) {
  const { x, z, top, half } = RING;
  const club = new THREE.Group();
  club.position.set(x, 0, z);
  const plain = (color, roughness = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  const m = {
    canvas: new THREE.MeshStandardMaterial({ roughness: 0.9, map: canvasTexture(256, (ctx, s) => {
      ctx.fillStyle = '#2f6fb5';
      ctx.fillRect(0, 0, s, s);
      speckle(ctx, s, 3000, 0.04);
      ctx.strokeStyle = '#f2f2ee';
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.2, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#f2f2ee';
      ctx.font = 'bold 30px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('MFC', s / 2, s / 2);
    }, 1, 1) }),
    apron: plain(0x16181c, 0.8),
    red: plain(0xc0281e, 0.5), blue: plain(0x2456c9, 0.5), white: plain(0xf2f2ee, 0.6),
    steel: plain(0x8f9396, 0.4, { metalness: 0.6 }),
    wood: plain(0x6b4a30, 0.7),
    dark: plain(0x1b1c1e, 0.7),
    lamp: new THREE.MeshBasicMaterial({ color: 0xfff3cf }),
  };
  const sign = (text, small, background, ink, w = 512, h = 128) => new THREE.MeshBasicMaterial({ map: label(text, small, background, ink, w, h) });
  const solid = (lx, lz, w, d, height) => addObstacle(x + lx - w / 2, x + lx + w / 2, z + lz - d / 2, z + lz + d / 2, height);

  // The ring: a raised platform with a blue canvas, corner posts and three ropes a side.
  const size = half * 2 + 0.8;
  block(club, m.apron, size, top, size, 0, top / 2, 0);
  block(club, m.canvas, half * 2 + 0.3, 0.02, half * 2 + 0.3, 0, top + 0.01, 0).castShadow = false;
  for (const side of [-1, 1]) {
    block(club, sign('MIAMI FIGHT CLUB', null, '#c0281e', '#f2f2ee', 1024, 96), size - 0.4, top - 0.12, 0.02, 0, top / 2, side * (size / 2 + 0.011));
    block(club, sign('MIAMI FIGHT CLUB', null, '#c0281e', '#f2f2ee', 1024, 96), 0.02, top - 0.12, size - 0.4, side * (size / 2 + 0.011), top / 2, 0);
  }
  addFloor(x - size / 2, x + size / 2, z - size / 2, z + size / 2, top);
  for (const [cx, cz, pad] of [[-1, -1, m.red], [1, 1, m.blue], [-1, 1, m.white], [1, -1, m.white]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.5, 10), m.steel);
    post.position.set(cx * half, top + 0.75, cz * half);
    post.castShadow = true;
    club.add(post);
    block(club, pad, 0.3, 1.0, 0.3, cx * (half - 0.12), top + 0.85, cz * (half - 0.12)); // the padded corner
  }
  for (const [height, rope] of [[0.45, m.red], [0.85, m.white], [1.25, m.blue]]) {
    for (const side of [-1, 1]) {
      block(club, rope, half * 2, 0.045, 0.045, 0, top + height, side * half);
      block(club, rope, 0.045, 0.045, half * 2, side * half, top + height, 0);
    }
  }
  for (const side of [-1, 1]) { // nobody gets through the ropes
    solid(0, side * half, half * 2 + 0.2, 0.12, top + 1.5);
    solid(side * half, 0, 0.12, half * 2 + 0.2, top + 1.5);
  }

  // The lighting rig over the ring, and the big sign behind it.
  for (const [px, pz] of [[-4.4, -4.4], [4.4, -4.4], [-4.4, 4.4], [4.4, 4.4]]) {
    block(club, m.steel, 0.18, 5.4, 0.18, px, 2.7, pz);
    solid(px, pz, 0.3, 0.3, 5.4);
  }
  for (const side of [-1, 1]) {
    block(club, m.steel, 9, 0.14, 0.14, 0, 5.4, side * 4.4);
    block(club, m.steel, 0.14, 0.14, 9, side * 4.4, 5.4, 0);
  }
  for (const [lx, lz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
    block(club, m.steel, 0.1, 0.1, 4.4, lx, 5.4, Math.sign(lz) * 2.2);
    block(club, m.dark, 0.5, 0.3, 0.5, lx, 5.2, lz);
    block(club, m.lamp, 0.4, 0.04, 0.4, lx, 5.04, lz);
  }
  const glow = new THREE.PointLight(0xfff0d0, 40, 16, 1.4);
  glow.position.set(0, 4.6, 0);
  club.add(glow);
  block(club, sign('MIAMI FIGHT CLUB', 'LEGAL BOUTS  ·  PLACE YOUR BETS  ·  BEAT THE CHAMPION', '#16181c', '#ffd75a', 1024, 256), 8.6, 2.0, 0.12, 0, 6.6, -4.4);

  // The bookie's booth, front left: a counter under a little roof.
  const bx = -7.6, bz = 6.2;
  block(club, m.wood, 2.4, 1.1, 0.7, bx, 0.55, bz);
  block(club, m.red, 2.5, 0.06, 0.8, bx, 1.13, bz);
  solid(bx, bz, 2.4, 0.7, 1.15);
  for (const side of [-1, 1]) { block(club, m.wood, 0.12, 2.7, 0.12, bx + side * 1.2, 1.35, bz - 1.1); solid(bx + side * 1.2, bz - 1.1, 0.14, 0.14, 2.7); }
  for (const side of [-1, 1]) block(club, m.wood, 0.1, 1.6, 0.1, bx + side * 1.2, 1.9, bz + 0.3);
  block(club, m.red, 2.9, 0.1, 2.0, bx, 2.74, bz - 0.4);
  block(club, sign('BETS', 'FIGHT CLUB BOOKMAKER  ·  LICENSED', '#16181c', '#ffd75a', 512, 160), 2.6, 0.7, 0.06, bx, 2.35, bz + 0.36);
  block(club, sign('SIGN UP TO FIGHT', 'BET ON YOURSELF', '#f2ecd8', '#16181c', 256, 128), 1.4, 0.6, 0.02, bx, 0.6, bz + 0.36);

  // The fighters' corner on the right: a bench and a board with tonight's card.
  block(club, m.wood, 0.5, 0.45, 7, 8.5, 0.23, 0);
  solid(8.5, 0, 0.5, 7, 0.5);
  block(club, m.steel, 0.08, 2.4, 0.08, 6.4, 1.2, 5.2);
  block(club, sign('THE FIGHTERS', 'CHALLENGE ONE AT THE BOOTH', '#2456c9', '#f2f2ee', 512, 160), 2.4, 0.75, 0.05, 6.4, 2.3, 5.2);
  solid(6.4, 5.2, 0.2, 0.2, 2.4);
  // Benches for the crowd, in front of the ring.
  for (const lx of [-2.6, 2.6]) { block(club, m.wood, 2.6, 0.42, 0.5, lx, 0.21, 6.0); solid(lx, 6.0, 2.6, 0.5, 0.45); }

  scene.add(club);
  return {
    bookie: { x: x + bx, z: z + bz - 0.75, facing: 0 },            // behind the counter
    counter: { x: x + bx, z: z + bz + 1.05 },                       // where the customer stands
    red: new THREE.Vector3(x - 1.9, top, z),                        // the player's side of the ring
    blue: new THREE.Vector3(x + 1.9, top, z),                       // and his opponent's
    exit: new THREE.Vector3(x, 0, z + 8.2),                         // where he is put down after a bout
  };
}
