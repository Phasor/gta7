// Two businesses on Brew St, between the main road and the police station:
// Fix-It Garage, where dents are knocked out, and Sharp Cuts, the barber.
// Also here: the haircuts themselves, and the hat that goes back on afterwards.
import * as THREE from 'three';
import { addObstacle, addFloor, addInterior } from './world.js';
import { block, canvasTexture, speckle } from './house.js';
import { label } from './store.js';

const SLAB = 0.15;
const plain = (color, roughness = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
const sign = (text, small, background, ink, w = 512, h = 128) => new THREE.MeshBasicMaterial({ map: label(text, small, background, ink, w, h) });

// A building laid out facing +Z and then turned to face the street. `solid` and `spot`
// take the building's own measurements and work out where that is on the map.
function site(scene, x, z, turn) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = turn;
  scene.add(group);
  const c = Math.round(Math.cos(turn)), s = Math.round(Math.sin(turn));
  const place = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  return {
    group,
    spot: (lx, lz, extra = {}) => { const [wx, wz] = place(lx, lz); return { x: wx, z: wz, ...extra }; },
    solid: (lx, lz, w, d, height, base) => {
      const [wx, wz] = place(lx, lz), [ww, wd] = s ? [d, w] : [w, d];
      return addObstacle(wx - ww / 2, wx + ww / 2, wz - wd / 2, wz + wd / 2, height, base);
    },
    put: (material, w, h, d, px, y, pz) => block(group, material, w, h, d, px, SLAB + y, pz),
  };
}

// --- Fix-It Garage ----------------------------------------------------------------------------------
export function createMechanic(scene, x, z, turn) {
  const { group, spot, solid, put } = site(scene, x, z, turn);
  const W = 11, D = 8, H = 4.2;
  const wall = new THREE.MeshStandardMaterial({ roughness: 0.9, map: canvasTexture(64, (ctx, s) => { ctx.fillStyle = '#c9ccd0'; ctx.fillRect(0, 0, s, s); speckle(ctx, s, 600, 0.06); ctx.fillStyle = 'rgba(60,65,70,0.4)'; for (let i = 0; i < 8; i++) ctx.fillRect(i * 8, 0, 1, s); }, 6, 1) }); // corrugated steel
  const red = plain(0xc0281e, 0.6), dark = plain(0x1b1c1e, 0.7), steel = plain(0x8f9396, 0.4, { metalness: 0.6 }), yellow = plain(0xe3b21e, 0.6), rubber = plain(0x17181a, 0.95);
  block(group, plain(0x8f9089, 1), W + 0.4, SLAB, D + 9, 0, SLAB / 2, 4.3).castShadow = false;                   // concrete floor and apron, out to the street
  put(wall, W, H, 0.2, 0, H / 2, -D / 2 + 0.1);
  put(wall, 0.2, H, D, -W / 2 + 0.1, H / 2, 0);
  put(wall, 0.2, H, D, W / 2 - 0.1, H / 2, 0);
  put(wall, 3.2, H, 0.2, -3.9, H / 2, D / 2 - 0.1);                                                             // the office end of the front; the rest is the open bay
  put(wall, W, H - 3.2, 0.2, 0, 3.2 + (H - 3.2) / 2, D / 2 - 0.1);
  put(plain(0xe6e8ea, 0.7), W + 0.5, 0.2, D + 0.5, 0, H + 0.1, 0);
  put(red, W + 0.1, 0.5, 0.06, 0, H - 0.3, D / 2 + 0.03);
  put(sign('FIX-IT GARAGE', 'DENTS KNOCKED OUT · G$ 10 EACH', '#c0281e', '#fff6dc', 1024, 256), 7.6, 1.5, 0.12, 0, H + 0.95, D / 2 - 0.1);
  put(sign('OFFICE', null, '#1b1c1e', '#fff6dc', 256, 64), 1.6, 0.36, 0.03, -3.9, 2.6, D / 2 + 0.02);
  for (const px of [-2.2, 5.3]) put(yellow, 0.16, 3.2, 0.3, px, 1.6, D / 2 - 0.1);                               // yellow posts either side of the bay
  // Inside the bay: a car lift, a tool chest, a workbench, stacks of tyres and an oil stain.
  for (const px of [0.2, 3.0]) { put(steel, 0.3, 2.6, 0.3, px, 1.3, -1.6); put(yellow, 0.5, 0.08, 4.2, px, 0.06, 0.3); }
  put(red, 1.4, 1.1, 0.6, 4.4, 0.55, -3.4); put(dark, 1.44, 0.05, 0.64, 4.4, 1.12, -3.4);                        // tool chest
  for (let drawer = 0; drawer < 4; drawer++) put(steel, 1.2, 0.03, 0.02, 4.4, 0.25 + drawer * 0.22, -3.09);
  put(plain(0x6b4a30, 0.7), 3.0, 0.08, 0.8, 0.6, 0.9, -3.4); for (const px of [-0.8, 2.0]) put(steel, 0.08, 0.9, 0.08, px, 0.45, -3.4); // workbench
  put(steel, 0.5, 0.25, 0.3, 0.2, 1.07, -3.4);                                                                  // vice
  for (const [px, pz, high] of [[5.0, 2.6, 4], [4.9, 1.5, 2], [-1.6, -3.3, 3]]) for (let i = 0; i < high; i++) {
    const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.13, 8, 16), rubber);
    tyre.rotation.x = Math.PI / 2;
    tyre.position.set(px, SLAB + 0.13 + i * 0.26, pz);
    group.add(tyre);
  }
  put(plain(0x101010, 0.3), 1.6, 0.004, 1.1, 1.6, 0.004, 0.6);
  for (const px of [1.6]) put(new THREE.MeshBasicMaterial({ color: 0xffffff }), 2.6, 0.05, 0.3, px, H - 0.04, 0);
  const glow = new THREE.PointLight(0xf4f8ff, 22, 13, 1.5);
  glow.position.set(1.5, SLAB + H - 0.8, 0);
  group.add(glow);
  solid(0, -D / 2 + 0.1, W, 0.2, H + 1);
  solid(-W / 2 + 0.1, 0, 0.2, D, H + 1);
  solid(W / 2 - 0.1, 0, 0.2, D, H + 1);
  solid(-3.9, D / 2 - 0.1, 3.2, 0.2, H + 1);
  solid(4.4, -3.4, 1.4, 0.6, 1.3);
  solid(0.6, -3.4, 3.0, 0.8, 1.2);
  return { bay: spot(1.6, 5.5), mechanic: spot(-1.4, 4.6, { facing: turn, name: 'Mick the mechanic', special: true, wear: 'cap', dye: 'joe', say: 'Bring it round the front. Ten bucks a dent.' }) };
}

// --- Sharp Cuts, the barber ---------------------------------------------------------------------------
export function createBarber(scene, x, z, turn) {
  const { group, spot, solid, put } = site(scene, x, z, turn);
  const W = 8, D = 6.4, H = 3.2;
  const wall = plain(0xf4f1e8, 0.9), navy = plain(0x1c2f52, 0.6), red = plain(0xc0281e, 0.5), chrome = plain(0xc9ccd0, 0.2, { metalness: 0.9 }), leather = plain(0x7a1f1a, 0.5), dark = plain(0x1b1c1e, 0.6);
  const glass = new THREE.MeshStandardMaterial({ color: 0xbfe0e6, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.22, depthWrite: false });
  const tiles = new THREE.MeshStandardMaterial({ roughness: 0.3, map: canvasTexture(64, (ctx, s) => { for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { ctx.fillStyle = (i + j) % 2 ? '#f2f0ea' : '#17181a'; ctx.fillRect(i * 32, j * 32, 32, 32); } }, 8, 6) });
  block(group, plain(0xb9b3a6, 1), W + 0.3, SLAB, D + 0.3, 0, SLAB / 2, 0);
  put(tiles, W - 0.4, 0.02, D - 0.4, 0, 0.01, 0).castShadow = false;
  put(wall, W, H, 0.2, 0, H / 2, -D / 2 + 0.1);
  put(wall, 0.2, H, D, -W / 2 + 0.1, H / 2, 0);
  put(wall, 0.2, H, D, W / 2 - 0.1, H / 2, 0);
  const fz = D / 2 - 0.1;
  put(wall, 0.5, H, 0.2, -3.75, H / 2, fz); put(wall, 0.5, H, 0.2, 3.75, H / 2, fz); put(wall, 0.4, H, 0.2, -0.9, H / 2, fz);
  put(wall, 2.5, 0.8, 0.2, -2.3, 0.4, fz); put(glass, 2.5, 1.7, 0.05, -2.3, 1.65, fz);                           // the window
  put(wall, 2.6, 0.8, 0.2, 2.2, 0.4, fz); put(glass, 2.6, 1.7, 0.05, 2.2, 1.65, fz);
  put(wall, W, H - 2.5, 0.2, 0, 2.5 + (H - 2.5) / 2, fz);                                                       // (the doorway, between the windows, is left open)
  put(plain(0xf4f3ee, 0.6), W + 0.4, 0.2, D + 0.4, 0, H + 0.1, 0);
  put(navy, W + 0.06, 0.4, 0.04, 0, H - 0.25, D / 2 + 0.02);
  put(sign('SHARP CUTS', 'BARBER · FADES · TRIMS · WALK IN', '#1c2f52', '#fff6dc', 1024, 224), 5.6, 1.2, 0.12, 0, H + 0.8, D / 2 - 0.1);
  put(sign('CUTS', 'G$ 5 · 3 · 1', '#c0281e', '#fff6dc', 256, 128), 1.0, 0.5, 0.02, 2.2, 1.1, fz + 0.12);
  // The barber's pole by the door: red, white and blue stripes.
  const stripes = canvasTexture(64, (ctx, s) => { ctx.fillStyle = '#f4f2ea'; ctx.fillRect(0, 0, s, s); for (let i = -2; i < 6; i++) { ctx.fillStyle = i % 2 ? '#c0281e' : '#1c4fb0'; ctx.beginPath(); ctx.moveTo(i * 16, 0); ctx.lineTo(i * 16 + 8, 0); ctx.lineTo(i * 16 + 40, s); ctx.lineTo(i * 16 + 32, s); ctx.fill(); } }, 2, 2);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.9, 16), new THREE.MeshBasicMaterial({ map: stripes }));
  pole.position.set(-0.55, SLAB + 1.7, fz + 0.3);
  group.add(pole);
  for (const y of [1.2, 2.2]) put(chrome, 0.28, 0.1, 0.28, -0.55, y, fz + 0.3);
  // Inside: two barber's chairs facing a long mirror on the left wall, a shelf of bottles, and a waiting bench.
  put(new THREE.MeshStandardMaterial({ color: 0xcfe6f2, roughness: 0.05, metalness: 0.9 }), 0.04, 1.3, 4.4, -W / 2 + 0.22, 1.7, -0.3);
  put(navy, 0.06, 1.4, 4.5, -W / 2 + 0.2, 1.7, -0.3);
  put(plain(0x6b4a30, 0.6), 0.45, 0.06, 4.4, -W / 2 + 0.45, 0.95, -0.3);
  for (let i = 0; i < 9; i++) put([red, navy, chrome][i % 3], 0.07, 0.18, 0.07, -W / 2 + 0.42, 1.07, -2.2 + i * 0.47);
  const chairs = [-1.5, 1.0].map((cz) => {
    put(chrome, 0.5, 0.06, 0.5, -2.2, 0.03, cz); put(chrome, 0.12, 0.42, 0.12, -2.2, 0.26, cz);
    put(leather, 0.62, 0.14, 0.62, -2.2, 0.55, cz); put(leather, 0.14, 0.75, 0.62, -1.86, 0.95, cz);              // seat and back
    for (const side of [-1, 1]) put(chrome, 0.5, 0.05, 0.07, -2.2, 0.8, cz + side * 0.34);                       // arm rests
    put(leather, 0.1, 0.2, 0.3, -1.84, 1.42, cz);                                                                // head rest
    solid(-2.2, cz, 0.7, 0.7, 1.0);
    return spot(-1.25, cz);
  });
  put(plain(0x6b4a30, 0.6), 0.5, 0.45, 2.4, W / 2 - 0.5, 0.23, -1.2); solid(W / 2 - 0.5, -1.2, 0.5, 2.4, 0.6);   // bench
  put(plain(0x6b4a30, 0.6), 1.4, 1.0, 0.6, 2.4, 0.5, -2.6); put(dark, 0.36, 0.14, 0.4, 2.4, 1.07, -2.6); solid(2.4, -2.6, 1.4, 0.6, 1.2); // the till
  for (const px of [-1.5, 1.8]) put(new THREE.MeshBasicMaterial({ color: 0xffffff }), 1.3, 0.04, 0.22, px, H - 0.03, -0.3);
  const glow = new THREE.PointLight(0xfff4e0, 18, 11, 1.5);
  glow.position.set(0, SLAB + H - 0.6, 0);
  group.add(glow);
  solid(0, -D / 2 + 0.1, W, 0.2, H + 1);
  solid(-W / 2 + 0.1, 0, 0.2, D, H + 1);
  solid(W / 2 - 0.1, 0, 0.2, D, H + 1);
  solid(-2.35, fz, 3.3, 0.2, H + 1);
  solid(2.45, fz, 3.1, 0.2, H + 1);
  const corner = spot(-W / 2 - 0.15, -D / 2 - 0.15), far = spot(W / 2 + 0.15, D / 2 + 0.15);
  addFloor(Math.min(corner.x, far.x), Math.max(corner.x, far.x), Math.min(corner.z, far.z), Math.max(corner.z, far.z), SLAB);
  addInterior(Math.min(corner.x, far.x) + 0.3, Math.max(corner.x, far.x) - 0.3, Math.min(corner.z, far.z) + 0.3, Math.max(corner.z, far.z) - 0.3, SLAB + H);
  return { chair: chairs[0], facing: turn - Math.PI / 2, // standing by the first chair, facing the mirror
    barber: spot(-1.2, -0.3, { facing: turn + Math.PI, name: 'Tony the barber', special: true, say: 'Take a seat. What are we doing today?' }) };
}

// --- Haircuts -------------------------------------------------------------------------------------------
export const HAIRCUTS = [
  { key: 'edgar', name: 'The Edgar', price: 5, grade: 'Good', blurb: 'Dead-straight fringe, faded sides' },
  { key: 'fade', name: 'Skin fade', price: 5, grade: 'Good', blurb: 'Tight on top, down to the skin at the sides' },
  { key: 'classic', name: 'The normal', price: 5, grade: 'Good', blurb: 'Short, neat, nothing to complain about' },
  { key: 'flat', name: 'Flat top', price: 3, grade: 'Okay', blurb: 'You could stand a drink on it' },
  { key: 'curtains', name: 'Curtains', price: 3, grade: 'Okay', blurb: 'Parted down the middle' },
  { key: 'bowl', name: 'Bowl cut', price: 3, grade: 'Okay', blurb: 'He really does use a bowl' },
  { key: 'mullet', name: 'Mullet', price: 1, grade: 'Bad', blurb: 'Business at the front, party at the back' },
  { key: 'monk', name: 'The monk', price: 1, grade: 'Bad', blurb: 'Bald on top, hair all round' },
  { key: 'lopsided', name: 'The slip', price: 1, grade: 'Bad', blurb: 'His hand slipped. One side only' },
];

// Where the skull is, measured from the head bone, and how big.
const CY = 0.086, CZ = 0.012, R = 0.117;
export function makeHair(key, colour = 0x2a1d14) {
  const hair = new THREE.Group();
  const thick = plain(colour, 0.85, { side: THREE.DoubleSide });
  const stubble = plain(0x5f4a3c, 0.95);                                   // clipped so short the skin shows through: a shadow of hair
  const add = (mesh, x = 0, y = 0, z = 0, parent = hair) => { mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh); return mesh; };
  // A cap of hair over the skull, from the crown down to `to` (0 is the very top, 0.5 is level with the ears).
  // It is tipped back so the hairline sits above the forehead at the front and low on the neck behind.
  const cap = (to, { from = 0, material = thick, out = 0.007, tip = -0.3, half = false, squash = [1, 1, 1.04] } = {}) => {
    const holder = new THREE.Group();
    holder.position.set(0, CY, CZ);
    holder.rotation.x = tip;
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(R + out, 22, 14, half ? Math.PI / 2 : 0, half ? Math.PI : Math.PI * 2, from * Math.PI, (to - from) * Math.PI), material);
    mesh.scale.set(...squash);
    mesh.castShadow = true;
    holder.add(mesh);
    hair.add(holder);
    return holder;
  };
  const shortSides = () => cap(0.62, { material: stubble, out: 0.0015, tip: -0.55 });   // clipped right down: skin shows through
  if (key === 'classic') {
    cap(0.62, { tip: -0.55 });
    cap(0.3, { out: 0.018, tip: -0.2, squash: [0.92, 1, 1.08] });         // a little longer on top, brushed forward
  } else if (key === 'fade') {
    shortSides();
    cap(0.3, { out: 0.016, tip: -0.15, squash: [0.84, 1, 1.1] });
  } else if (key === 'edgar') {
    shortSides();
    cap(0.38, { out: 0.016, tip: 0.05, squash: [0.95, 1, 1.05] });
    for (const [px, turn] of [[-0.055, 0.42], [0, 0], [0.055, -0.42]]) add(new THREE.Mesh(new THREE.BoxGeometry(0.066, 0.04, 0.024), thick), px, CY + 0.076, CZ + 0.098 - Math.abs(px) * 0.3).rotation.y = turn; // the fringe: one straight line across
  } else if (key === 'flat') {
    cap(0.55, { material: plain(colour, 0.9, { side: THREE.DoubleSide, transparent: true, opacity: 0.6 }), out: 0.003 });
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.098, 0.108, 0.06, 20), thick), 0, CY + R + 0.005, CZ - 0.012);
  } else if (key === 'curtains') {
    cap(0.62, { tip: -0.55 });
    for (const side of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.12, 0.02), thick), side * 0.068, CY + 0.05, CZ + 0.1).rotation.set(0.1, -side * 0.5, side * 0.3);
  } else if (key === 'bowl') {
    cap(0.44, { out: 0.02, tip: -0.12 });
    const rim = new THREE.Mesh(new THREE.TorusGeometry((R + 0.02) * Math.sin(0.44 * Math.PI), 0.014, 8, 26), thick);
    rim.rotation.x = Math.PI / 2 - 0.12;
    add(rim, 0, CY + (R + 0.02) * Math.cos(0.44 * Math.PI), CZ - 0.004);
  } else if (key === 'mullet') {
    cap(0.6, { tip: -0.5 });
    add(new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.25, 0.035), thick), 0, CY - 0.11, CZ - 0.105).rotation.x = 0.2;  // the party at the back
    add(new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.1, 0.03), thick), 0, CY - 0.25, CZ - 0.125).rotation.x = 0.35;
  } else if (key === 'monk') {
    cap(0.66, { from: 0.3, out: 0.012, tip: -0.5 });
  } else if (key === 'lopsided') {
    cap(0.62, { half: true, out: 0.012, tip: -0.55 });
    for (let tuft = 0; tuft < 4; tuft++) add(new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.05, 5), thick), -0.05 - tuft * 0.012, CY + 0.1 - tuft * 0.02, CZ - 0.04 + tuft * 0.03).rotation.z = 0.6 + tuft * 0.3; // what he missed on the other side
  }
  return hair;
}
// His hat, made again in code so that it sits over a new haircut.
export function makeHat() {
  const hat = new THREE.Group();
  const felt = plain(0x33382a, 0.85), band = plain(0x17181a, 0.6);
  const add = (geometry, material, y, z = 0) => { const mesh = new THREE.Mesh(geometry, material); mesh.position.set(0, y, z); mesh.castShadow = true; hat.add(mesh); return mesh; };
  add(new THREE.CylinderGeometry(0.2, 0.205, 0.012, 26), felt, 0.07).scale.z = 1.12;      // brim
  add(new THREE.CylinderGeometry(0.106, 0.122, 0.11, 24), felt, 0.13).scale.z = 1.1;     // crown
  add(new THREE.CylinderGeometry(0.124, 0.124, 0.03, 24), band, 0.09).scale.z = 1.1;     // band
  add(new THREE.SphereGeometry(0.106, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), felt, 0.185).scale.set(1, 0.22, 1.1); // the rounded top
  hat.position.set(0, CY + 0.002, CZ - 0.004);
  hat.rotation.x = -0.14;
  return hat;
}
