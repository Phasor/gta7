// Gator Bank: a small stone bank in the gap between Hotel Tropic and Coral Sands.
// Inside: two cash machines, a teller behind a counter, and at the back a round
// steel vault door with a keypad. Behind the door is the vault, full of gold and
// cash. The front faces -Z, onto the main road.
import * as THREE from 'three';
import { addObstacle, addFloor, addInterior } from './world.js';
import { block, canvasTexture, speckle } from './house.js';
import { label } from './store.js';

const SLAB = 0.15, HEIGHT = 4.2;
const W = 14, D = 14;

// The people in the vault job. Each of them exists exactly once.
// wear: what is on their head. dye: the colour of their clothes. hint: what the photograph says.
export const VAULT_PEOPLE = {
  stranger: { name: 'The stranger', x: 709, z: -12.3, facing: 0, wear: 'hood', special: true },
  lenny: { name: 'Lenny', x: 631.6, z: 40, facing: Math.PI, wear: 'cap', special: true },
  holders: [
    { name: 'Madame Zora', x: 1000, y: 0.8, z: 68.7, facing: 0, woman: true, wear: 'scarf', dye: 'zora', special: true, hint: 'tells fortunes out on the pier', colour: '#8a3fc0' },
    { name: 'Spike', x: 826.5, z: -13.6, facing: 0, wear: 'mohawk', dye: 'spike', special: true, hint: 'hangs around the Fight Club', colour: '#3fb04a' },
    { name: 'The Baron', x: 552, z: 9, facing: Math.PI, wear: 'tophat', dye: 'baron', special: true, hint: 'never leaves the Lucky Palm Casino', colour: '#c0281e' },
    { name: 'Gator Joe', x: -175.4, z: -14.5, facing: 0, wear: 'straw', dye: 'joe', special: true, hint: 'fishes by the lake on Palm Ave', colour: '#d9b24a' },
  ],
};

// A photograph of one of the four: a simple drawn portrait showing the thing nobody else wears.
export function portrait(person) {
  const canvas = document.createElement('canvas');
  canvas.width = 120;
  canvas.height = 150;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f4efe2';
  ctx.fillRect(0, 0, 120, 150);
  ctx.fillStyle = '#9fb4c4';
  ctx.fillRect(8, 8, 104, 104);
  const disc = (x, y, r, colour) => { ctx.fillStyle = colour; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
  ctx.fillStyle = person.colour;                                   // shoulders, in the colour they dress in
  ctx.beginPath(); ctx.ellipse(60, 118, 40, 24, 0, Math.PI, 0); ctx.fill();
  disc(60, 62, 24, person.woman ? '#e8b894' : '#d9a47a');          // face
  disc(52, 58, 2.6, '#1b1c1e'); disc(68, 58, 2.6, '#1b1c1e');      // eyes
  ctx.strokeStyle = '#7a3a2a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(60, 68, 8, 0.2, Math.PI - 0.2); ctx.stroke();
  if (person.wear === 'tophat') {
    ctx.fillStyle = '#c0281e'; ctx.fillRect(40, 10, 40, 32); ctx.fillRect(28, 40, 64, 6);
    ctx.fillStyle = '#16181c'; ctx.fillRect(40, 34, 40, 6);
  } else if (person.wear === 'mohawk') {
    ctx.fillStyle = '#3fd04a';
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(44 + i * 8, 44); ctx.lineTo(48 + i * 8, 12 + Math.abs(i - 2) * 5); ctx.lineTo(52 + i * 8, 44); ctx.fill(); }
  } else if (person.wear === 'straw') {
    ctx.fillStyle = '#e6c86a'; ctx.beginPath(); ctx.ellipse(60, 44, 46, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(42, 26, 36, 18);
    ctx.fillStyle = '#7a5a2a'; ctx.fillRect(42, 38, 36, 4);
  } else if (person.wear === 'scarf') {
    ctx.fillStyle = '#8a3fc0'; ctx.beginPath(); ctx.arc(60, 56, 27, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
    ctx.strokeStyle = '#e6b83a'; ctx.lineWidth = 3;
    for (const x of [35, 85]) { ctx.beginPath(); ctx.arc(x, 74, 6, 0, Math.PI * 2); ctx.stroke(); }
  }
  ctx.fillStyle = '#16181c';
  ctx.font = 'bold 14px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(person.name, 60, 134);
  return canvas.toDataURL();
}

// Builds the bank with its centre at (x, z). It is laid out facing +Z and then turned round.
export function createBank(scene, x, z) {
  const bank = new THREE.Group();
  bank.position.set(x, 0, z);
  bank.rotation.y = Math.PI;
  const top = SLAB + HEIGHT;
  const plain = (color, roughness = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  const m = {
    stone: new THREE.MeshStandardMaterial({ roughness: 0.9, map: canvasTexture(128, (ctx, s) => {
      ctx.fillStyle = '#d9d2c0'; ctx.fillRect(0, 0, s, s);
      speckle(ctx, s, 2500, 0.05);
      ctx.strokeStyle = 'rgba(90,80,60,0.35)';
      for (let row = 0; row < 4; row++) for (let i = -1; i < 3; i++) ctx.strokeRect(i * 64 + (row % 2) * 32, row * 32, 64, 32);
    }, 4, 3) }),
    marble: new THREE.MeshStandardMaterial({ roughness: 0.25, map: canvasTexture(128, (ctx, s) => {
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { ctx.fillStyle = (i + j) % 2 ? '#efece4' : '#3f4a52'; ctx.fillRect(i * 64, j * 64, 64, 64); }
      speckle(ctx, s, 800, 0.05);
    }, 5, 5) }),
    cream: plain(0xf1ecdf, 0.9), green: plain(0x1f5a3c, 0.6), gold: plain(0xd9a83a, 0.3, { metalness: 0.8 }), wood: plain(0x5a3a22, 0.5),
    steel: plain(0xaab0b4, 0.3, { metalness: 0.85 }), dark: plain(0x17181a, 0.6), cash: plain(0x6f9a5a, 0.8),
    glass: new THREE.MeshStandardMaterial({ color: 0xbfe0e6, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.22, depthWrite: false }),
    light: new THREE.MeshBasicMaterial({ color: 0xffffff }), screen: new THREE.MeshBasicMaterial({ color: 0x3fa0e0 }),
    redLamp: new THREE.MeshBasicMaterial({ color: 0xe0352b }), greenLamp: new THREE.MeshBasicMaterial({ color: 0x4fe07a }),
  };
  const sign = (text, small, background, ink, w = 512, h = 128) => new THREE.MeshBasicMaterial({ map: label(text, small, background, ink, w, h) });
  // The bank is turned round, so its own left and right, front and back are flipped on the map.
  const solid = (cx, cz, w, d, height) => addObstacle(x - cx - w / 2, x - cx + w / 2, z - cz - d / 2, z - cz + d / 2, height);
  const put = (material, w, h, d, px, y, pz, parent = bank) => block(parent, material, w, h, d, px, SLAB + y, pz);
  const thing = (material, w, h, d, px, pz) => { solid(px, pz, w, d, SLAB + h); return put(material, w, h, d, px, h / 2, pz); };
  const spot = (lx, lz, extra = {}) => ({ x: x - lx, z: z - lz, ...extra });
  const hw = W / 2 - 0.1, hd = D / 2 - 0.1;

  // --- The building: stone walls, four columns and a sign across the front ---
  block(bank, m.stone, W + 0.4, SLAB, D + 2.4, 0, SLAB / 2, 1.0);
  put(m.marble, W - 0.4, 0.02, D - 0.4, 0, 0.01, 0).castShadow = false;
  put(m.stone, W, HEIGHT, 0.2, 0, HEIGHT / 2, -hd);
  put(m.stone, 0.2, HEIGHT, D, -hw, HEIGHT / 2, 0);
  put(m.stone, 0.2, HEIGHT, D, hw, HEIGHT / 2, 0);
  for (const side of [-1, 1]) {
    put(m.stone, 1.3, HEIGHT, 0.2, side * 6.25, HEIGHT / 2, hd);
    put(m.stone, 0.5, HEIGHT, 0.2, side * 1.25, HEIGHT / 2, hd);
    put(m.stone, 4.1, 0.9, 0.2, side * 3.55, 0.45, hd);
    put(m.glass, 4.1, 2.0, 0.05, side * 3.55, 1.9, hd);
    for (let bar = -1.8; bar <= 1.81; bar += 0.6) put(m.gold, 0.04, 2.0, 0.04, side * 3.55 + bar, 1.9, hd + 0.04); // bars on the windows
  }
  put(m.stone, W, HEIGHT - 2.9, 0.2, 0, 2.9 + (HEIGHT - 2.9) / 2, hd);
  put(m.cream, W + 0.6, 0.3, D + 0.6, 0, HEIGHT + 0.15, 0);
  for (const px of [-5.4, -1.9, 1.9, 5.4]) {
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, HEIGHT, 14), m.cream);
    column.position.set(px, SLAB + HEIGHT / 2, hd + 1.0);
    column.castShadow = true;
    bank.add(column);
    solid(px, hd + 1.0, 0.6, 0.6, top);
  }
  put(m.cream, W + 0.6, 0.5, 1.9, 0, HEIGHT + 0.25, hd + 0.75);
  put(m.green, W + 0.2, 1.3, 0.2, 0, HEIGHT + 1.15, hd + 1.4);
  put(sign('GATOR BANK', 'SAFE AS HOUSES SINCE 1926', '#1f5a3c', '#f2d98a', 1024, 224), 9.6, 1.1, 0.06, 0, HEIGHT + 1.15, hd + 1.52);
  addFloor(x - W / 2 - 0.2, x + W / 2 + 0.2, z - D / 2 - 2.2, z + D / 2 + 0.2, SLAB);

  // Sliding glass doors.
  const doors = [-1, 1].map((side) => {
    const door = new THREE.Group();
    door.position.set(side * 0.45, 0, hd - 0.08);
    put(m.glass, 0.9, 2.85, 0.03, 0, 1.425, 0, door);
    put(m.gold, 0.9, 0.07, 0.05, 0, 2.82, 0, door);
    put(m.gold, 0.9, 0.08, 0.05, 0, 0.04, 0, door);
    put(m.gold, 0.05, 2.85, 0.05, side * 0.425, 1.425, 0, door);
    bank.add(door);
    return { door, side };
  });

  // --- The banking hall ---
  for (const [lx, lz] of [[-3.5, 3.5], [3.5, 3.5], [0, 0.5]]) put(m.light, 1.6, 0.05, 0.3, lx, HEIGHT - 0.04, lz);
  const hallGlow = new THREE.PointLight(0xfff4dc, 26, 15, 1.5);
  hallGlow.position.set(0, top - 0.8, 2.5);
  bank.add(hallGlow);
  put(m.green, W - 0.4, 0.5, 0.05, 0, 1.1, -1.38);                                           // a green band along the back of the hall
  put(sign('GATOR BANK', null, '#1f5a3c', '#f2d98a', 512, 96), 3.0, 0.55, 0.04, 3.6, 3.3, -1.38);
  // The teller's counter, on the right, with a brass rail and a glass screen.
  solid(3.6, 1.0, 5.4, 0.8, SLAB + 1.2);
  put(m.wood, 5.4, 1.1, 0.8, 3.6, 0.55, 1.0);
  put(m.gold, 5.5, 0.06, 0.9, 3.6, 1.13, 1.0);
  put(m.glass, 5.4, 1.1, 0.04, 3.6, 1.7, 1.2);
  put(sign('TELLER', null, '#5a3a22', '#f2d98a', 256, 64), 1.6, 0.34, 0.03, 3.6, 0.6, 1.42);
  put(m.dark, 0.5, 0.36, 0.05, 2.4, 1.34, 0.85);
  put(m.screen, 0.44, 0.3, 0.01, 2.4, 1.34, 0.88);
  // A table with pens on chains that nobody can ever get to write, and two chairs.
  thing(m.wood, 1.6, 0.95, 0.7, 0.6, 4.6);
  for (const px of [-2.2, -1.2]) thing(m.green, 0.6, 0.5, 0.6, px, 5.6);
  // Two cash machines on the left-hand wall.
  const atms = [4.4, 2.6].map((az) => {
    solid(-6.35, az, 0.7, 0.9, SLAB + 2.1);
    put(plain(0x1c3f6e, 0.45, { metalness: 0.3 }), 0.7, 1.9, 0.9, -6.35, 0.95, az);
    put(m.screen, 0.03, 0.34, 0.5, -5.98, 1.45, az);
    put(m.steel, 0.2, 0.04, 0.56, -5.92, 1.08, az);
    put(m.dark, 0.03, 0.05, 0.44, -5.98, 0.82, az);
    put(sign('ATM', null, '#1c3f6e', '#ffd75a', 128, 64), 0.03, 0.22, 0.6, -5.98, 1.78, az);
    return spot(-5.3, az);
  });

  // --- The vault ---
  // A thick wall across the back of the hall with a round steel door in it. The keypad is beside the door.
  const wallZ = -1.5, doorX = -3.0;
  put(m.stone, 2.6, HEIGHT, 0.3, -5.5, HEIGHT / 2, wallZ);
  put(m.stone, 8.5, HEIGHT, 0.3, 2.55, HEIGHT / 2, wallZ);
  put(m.stone, 2.6, HEIGHT - 2.7, 0.3, doorX, 2.7 + (HEIGHT - 2.7) / 2, wallZ);
  solid(-5.5, wallZ, 2.6, 0.3, top);
  solid(2.55, wallZ, 8.5, 0.3, top);
  const frame = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.13, 10, 28), m.steel);
  frame.position.set(doorX, SLAB + 1.35, wallZ + 0.17);
  bank.add(frame);
  const vaultDoor = new THREE.Group();                                                        // hinged on its left edge
  vaultDoor.position.set(doorX - 1.3, SLAB + 1.35, wallZ + 0.22);
  const slab = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.34, 32), m.steel);
  slab.rotation.x = Math.PI / 2;
  slab.position.x = 1.3;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.5, 16), m.gold);
  hub.rotation.x = Math.PI / 2;
  hub.position.set(1.3, 0, 0.1);
  vaultDoor.add(slab, hub);
  const wheel = new THREE.Group();                                                            // the big spoked handle
  wheel.position.set(1.3, 0, 0.36);
  for (let spoke = 0; spoke < 4; spoke++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.07, 0.07), m.gold);
    bar.rotation.z = spoke * Math.PI / 4;
    wheel.add(bar);
  }
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.045, 8, 24), m.gold));
  vaultDoor.add(wheel);
  for (let bolt = 0; bolt < 10; bolt++) {
    const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 8), m.dark);
    stud.rotation.x = Math.PI / 2;
    stud.position.set(1.3 + Math.cos(bolt * 0.628) * 1.1, Math.sin(bolt * 0.628) * 1.1, 0.19);
    vaultDoor.add(stud);
  }
  bank.add(vaultDoor);
  const vaultBlock = solid(doorX, wallZ, 2.6, 0.3, top);                                      // the closed door: nobody gets through
  put(m.dark, 0.4, 0.6, 0.1, -1.25, 1.35, wallZ + 0.2);                                       // the keypad
  put(m.screen, 0.3, 0.14, 0.02, -1.25, 1.52, wallZ + 0.26);
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) put(m.steel, 0.07, 0.07, 0.02, -1.35 + col * 0.1, 1.36 - row * 0.1, wallZ + 0.26);
  const lamp = put(m.redLamp, 0.1, 0.1, 0.04, -1.25, 1.72, wallZ + 0.26);                     // red while it is locked
  put(sign('VAULT', 'AUTHORISED STAFF ONLY', '#16181c', '#f2d98a', 512, 128), 2.2, 0.5, 0.04, doorX, 3.3, wallZ + 0.18);
  // Inside: shelves of gold bars along the back, strongboxes down one side, and pallets of cash.
  const vaultGlow = new THREE.PointLight(0xfff0c0, 22, 12, 1.5);
  vaultGlow.position.set(0, top - 0.8, -4.2);
  bank.add(vaultGlow);
  solid(0, -6.4, 12, 0.7, SLAB + 2.4);
  for (let level = 0; level < 4; level++) {
    put(m.steel, 12, 0.05, 0.7, 0, 0.4 + level * 0.6, -6.4);
    for (let i = 0; i < 22; i++) if ((i + level) % 5) put(m.gold, 0.42, 0.14, 0.2, -5.5 + i * 0.52, 0.5 + level * 0.6, -6.4 + (i % 2) * 0.12);
  }
  solid(6.3, -4.2, 0.7, 4.4, SLAB + 2.4);
  for (let row = 0; row < 5; row++) for (let i = 0; i < 9; i++) put(i % 3 ? m.steel : m.dark, 0.05, 0.36, 0.42, 5.93, 0.35 + row * 0.42, -6.1 + i * 0.47);
  for (const [px, pz, high] of [[-0.6, -4.3, 4], [1.4, -4.0, 3], [-2.6, -4.6, 2], [3.4, -4.8, 3]]) {
    put(m.wood, 1.2, 0.12, 1.0, px, 0.06, pz);
    for (let level = 0; level < high; level++) for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) put(m.cash, 0.34, 0.16, 0.42, px - 0.38 + i * 0.38, 0.2 + level * 0.17, pz - 0.23 + j * 0.46);
    solid(px, pz, 1.2, 1.0, SLAB + 0.2 + high * 0.17);
  }

  scene.add(bank);
  // Outside walls (the doorway is left open).
  solid(0, -hd, W, 0.2, top + 1);
  solid(-hw, 0, 0.2, D, top + 1);
  solid(hw, 0, 0.2, D, top + 1);
  solid(-3.95, hd, 5.9, 0.2, top + 1);
  solid(3.95, hd, 5.9, 0.2, top + 1);
  addInterior(x - W / 2 + 0.2, x + W / 2 - 0.2, z - D / 2 + 0.2, z + D / 2 - 0.2, top);

  bank.userData = {
    doors, open: 0,
    doorSpot: new THREE.Vector3(x, 0, z - hd),
    front: spot(0, hd + 3.2),                                  // on the pavement outside the doors
    teller: spot(3.6, 0.2, { facing: Math.PI }),               // behind the counter
    atms,                                                       // where to stand at each cash machine
    keypad: spot(-1.7, -0.5),                                  // in front of the vault's keypad
    loot: spot(0.2, -3.1),                                     // in among the cash, inside the vault
    vaultDoor, vaultBlock, lamp, lampLocked: m.redLamp, lampOpen: m.greenLamp, blockHeight: top,
  };
  return bank;
}

// Swing the vault door open (1) or shut (0). `amount` eases between the two.
export function setVaultDoor(bank, amount) {
  const state = bank.userData;
  state.vaultDoor.rotation.y = -2.0 * amount; // it swings out into the hall
  state.vaultBlock.height = amount > 0.5 ? 0 : state.blockHeight;
  state.lamp.material = amount > 0.5 ? state.lampOpen : state.lampLocked;
}
