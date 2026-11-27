// Dogs. Labradors in three colours, a golden retriever, a dalmatian, a husky,
// a beagle, a corgi and a collie are friendly: they trot over, wag their tails
// and like to be patted. Dobermans, German shepherds and rottweilers are guard
// dogs: come too close and they warn you off, then go for you.
// Every dog is built in code from its breed's own measurements, coat and markings.
import * as THREE from 'three';
import { pushOut, floorAt, waterDepthAt } from './world.js';
import { sfx } from './sound.js';

// h: height at the shoulder. long: body length. girth: how deep the chest is. leg: leg thickness.
// muzzle: [length, thickness]. ears: flop / erect / crop / rose. tail: otter / plume / bushy / dock / curl / none.
// coat: what the body's markings are. The colours are: body, underside, the "points" (legs, muzzle, brows), ears, and tail tip.
const BREEDS = {
  labrador: { name: 'labrador', h: 0.58, long: 0.66, girth: 0.165, leg: 0.046, muzzle: [0.115, 0.058], ears: 'flop', tail: 'otter', coat: 'solid', voice: 1.0 },
  golden: { name: 'golden retriever', h: 0.58, long: 0.68, girth: 0.17, leg: 0.048, muzzle: [0.115, 0.058], ears: 'flop', tail: 'plume', coat: 'solid', ruff: true, voice: 0.95,
    colours: [0xd9a04a, 0xe8c079, 0xd9a04a, 0xc98a3a, 0xe8c079] },
  dalmatian: { name: 'dalmatian', h: 0.6, long: 0.64, girth: 0.15, leg: 0.04, muzzle: [0.12, 0.052], ears: 'flop', tail: 'otter', coat: 'spots', voice: 1.1,
    colours: [0xf4f2ec, 0xf4f2ec, 0xf4f2ec, 0x1b1b1c, 0xf4f2ec] },
  husky: { name: 'husky', h: 0.57, long: 0.62, girth: 0.165, leg: 0.045, muzzle: [0.1, 0.055], ears: 'erect', tail: 'curl', coat: 'mask', ruff: true, voice: 0.9, blueEyes: true,
    colours: [0x6f747a, 0xf2f0ea, 0xf2f0ea, 0x55595e, 0xf2f0ea] },
  beagle: { name: 'beagle', h: 0.38, long: 0.46, girth: 0.125, leg: 0.036, muzzle: [0.085, 0.048], ears: 'longflop', tail: 'otter', coat: 'tricolour', voice: 1.5,
    colours: [0xb9783a, 0xf4f0e6, 0xf4f0e6, 0x8a5226, 0xf4f0e6] },
  corgi: { name: 'corgi', h: 0.29, long: 0.5, girth: 0.13, leg: 0.04, muzzle: [0.09, 0.046], ears: 'erect', tail: 'none', coat: 'bib', voice: 1.7,
    colours: [0xd98a3a, 0xf4f0e6, 0xf4f0e6, 0xc97a2e, 0xf4f0e6] },
  collie: { name: 'border collie', h: 0.52, long: 0.6, girth: 0.15, leg: 0.04, muzzle: [0.11, 0.05], ears: 'rose', tail: 'plume', coat: 'bib', ruff: true, voice: 1.15,
    colours: [0x1b1b1c, 0xf4f2ec, 0xf4f2ec, 0x1b1b1c, 0xf4f2ec] },
  doberman: { name: 'doberman', hostile: true, h: 0.7, long: 0.68, girth: 0.15, leg: 0.038, muzzle: [0.15, 0.05], ears: 'crop', tail: 'dock', coat: 'blacktan', voice: 0.8, bite: 10, speed: 6.2,
    colours: [0x151516, 0x151516, 0xa8602a, 0x151516, 0x151516] },
  shepherd: { name: 'German shepherd', hostile: true, h: 0.63, long: 0.72, girth: 0.165, leg: 0.045, muzzle: [0.14, 0.054], ears: 'erect', tail: 'bushy', coat: 'saddle', ruff: true, voice: 0.75, bite: 9, speed: 6.0,
    colours: [0xb9843f, 0xc99a55, 0xb9843f, 0x2a2420, 0x1b1b1c] },
  rottweiler: { name: 'rottweiler', hostile: true, h: 0.64, long: 0.68, girth: 0.2, leg: 0.056, muzzle: [0.1, 0.07], ears: 'flop', tail: 'dock', coat: 'blacktan', voice: 0.6, bite: 12, speed: 5.6, broad: true,
    colours: [0x151516, 0x151516, 0x9a5a28, 0x151516, 0x151516] },
};
const LAB_COLOURS = { yellow: [0xe2c078, 0xecd49a, 0xe2c078, 0xd2aa60, 0xe2c078], black: [0x17171a, 0x1c1c20, 0x17171a, 0x141416, 0x17171a], chocolate: [0x5a3620, 0x66402a, 0x5a3620, 0x4e2e1a, 0x5a3620] };

// Where each dog lives: [breed, x, z, extra]. Guard dogs stay by what they guard.
const HOMES = [
  ['labrador', 6, -12, { lab: 'yellow', name: 'Sunny' }], ['labrador', 696, -11.2, { lab: 'black', name: 'Shadow' }], ['labrador', 948, -6, { lab: 'chocolate', name: 'Coco' }],
  ['golden', 622.5, 29, { name: 'Honey' }], ['dalmatian', 838, -11.5, { name: 'Domino' }], ['husky', 765, 2.6, { name: 'Blizzard' }],
  ['beagle', 24, -16.5, { name: 'Biscuit' }], ['corgi', 546, 2.6, { name: 'Nugget' }], ['collie', -181, -13.5, { name: 'Scout' }],
  ['doberman', -80.5, 13.5, { name: 'Fang' }], ['doberman', 734.5, -24.5, { name: 'Razor' }],
  ['shepherd', 121.5, -15, { name: 'Sarge', police: true }], ['shepherd', 612.5, -58, { name: 'Major', police: true }],
  ['rottweiler', 66, -31.5, { name: 'Brutus' }], ['rottweiler', 880, -30, { name: 'Tank' }],
];

// --- Coats ---------------------------------------------------------------------------------------
// Fur is painted as thousands of fine hairs lying along the body, with a matching bump map so the
// light catches them. `markings` paints the breed's pattern underneath first.
const hex = (colour) => `#${new THREE.Color(colour).getHexString()}`;
function furTexture(base, markings, hairs = 9000) {
  const size = 256, canvas = document.createElement('canvas'), bump = document.createElement('canvas');
  canvas.width = canvas.height = bump.width = bump.height = size;
  const ctx = canvas.getContext('2d'), relief = bump.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  markings?.(ctx, size);
  relief.fillStyle = '#808080';
  relief.fillRect(0, 0, size, size);
  for (let i = 0; i < hairs; i++) { // one hair: a short stroke, a little lighter or darker than what is under it
    const x = Math.random() * size, y = Math.random() * size, length = 5 + Math.random() * 12, lean = (Math.random() - 0.5) * 3, light = Math.random() < 0.5;
    for (const [pen, style] of [[ctx, light ? `rgba(255,255,255,${0.035 + Math.random() * 0.06})` : `rgba(0,0,0,${0.05 + Math.random() * 0.1})`],
      [relief, light ? `rgba(255,255,255,${0.2 + Math.random() * 0.3})` : `rgba(0,0,0,${0.2 + Math.random() * 0.3})`]]) {
      pen.strokeStyle = style;
      pen.lineWidth = 0.8;
      pen.beginPath(); pen.moveTo(x, y); pen.lineTo(x + lean, y + length); pen.stroke();
    }
  }
  const map = new THREE.CanvasTexture(canvas), bumpMap = new THREE.CanvasTexture(bump);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  return { map, bumpMap };
}
const fur = (texture, extra = {}) => new THREE.MeshPhysicalMaterial({ map: texture.map, bumpMap: texture.bumpMap, bumpScale: 2.2, roughness: 0.78, sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color(0.55, 0.5, 0.42), ...extra });
// The body's texture runs from the top of the back (left and right edges) round to the belly (the middle),
// and from the rump (top of the picture) to the chest (bottom).
const MARKINGS = {
  solid: null,
  blacktan: (c) => (ctx, s) => { ctx.fillStyle = hex(c[2]); ctx.beginPath(); ctx.ellipse(s / 2, s, s * 0.2, s * 0.16, 0, 0, Math.PI * 2); ctx.fill(); },   // a tan patch on the chest
  saddle: () => (ctx, s) => {                                                                                                                         // a black saddle over the back
    const shade = ctx.createLinearGradient(0, 0, s, 0);
    for (const [at, alpha] of [[0, 0.96], [0.2, 0.9], [0.33, 0], [0.67, 0], [0.8, 0.9], [1, 0.96]]) shade.addColorStop(at, `rgba(24,20,18,${alpha})`);
    ctx.fillStyle = shade;
    ctx.fillRect(0, s * 0.04, s, s * 0.8);
  },
  spots: () => (ctx, s) => { ctx.fillStyle = '#17171a'; for (let i = 0; i < 46; i++) { ctx.beginPath(); ctx.ellipse(Math.random() * s, Math.random() * s, 4 + Math.random() * 9, 4 + Math.random() * 8, Math.random() * 3, 0, Math.PI * 2); ctx.fill(); } },
  mask: (c) => (ctx, s) => { ctx.fillStyle = hex(c[1]); ctx.fillRect(s * 0.3, 0, s * 0.4, s); ctx.fillRect(0, s * 0.9, s, s * 0.1); },                    // white underneath and on the chest
  tricolour: (c) => (ctx, s) => {
    ctx.fillStyle = hex(c[1]); ctx.fillRect(s * 0.3, 0, s * 0.4, s); ctx.fillRect(0, s * 0.86, s, s * 0.14);
    ctx.fillStyle = '#1b1b1c'; ctx.fillRect(0, s * 0.1, s * 0.24, s * 0.56); ctx.fillRect(s * 0.76, s * 0.1, s * 0.24, s * 0.56);
  },
  bib: (c) => (ctx, s) => { ctx.fillStyle = hex(c[1]); ctx.fillRect(s * 0.32, 0, s * 0.36, s); ctx.fillRect(0, s * 0.8, s, s * 0.2); },                   // white chest, collar and belly
};

// --- Shapes ----------------------------------------------------------------------------------------
// A body made of oval rings along its length: [z, half-width, half-height, y] at each station.
function ringBody(stations, around = 18) {
  const positions = [], uvs = [], index = [];
  stations.forEach(([z, rx, ry, y], i) => {
    for (let j = 0; j <= around; j++) {
      const a = (j / around) * Math.PI * 2;
      positions.push(Math.sin(a) * rx, y + Math.cos(a) * ry, z);
      uvs.push(j / around, i / (stations.length - 1));
    }
  });
  for (let i = 0; i < stations.length - 1; i++) for (let j = 0; j < around; j++) {
    const a = i * (around + 1) + j, b = a + around + 1;
    index.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}
// A limb section hanging down from its top end, so it can swing from there.
function limb(top, bottom, length) {
  const geometry = new THREE.CylinderGeometry(top, bottom, length, 10);
  geometry.translate(0, -length / 2, 0);
  return geometry;
}

function makeDog(breed, colours) {
  const [bodyColour, underColour, pointColour, earColour, tipColour] = colours;
  const marking = MARKINGS[breed.coat];
  const coat = fur(furTexture(hex(bodyColour), marking ? marking(colours) : null));
  const plainFur = furTexture('#ffffff', null, 5000);
  const tinted = (colour) => fur(plainFur, { color: colour });
  const top = tinted(bodyColour), under = tinted(underColour), point = tinted(pointColour), ear = tinted(earColour), tip = tinted(tipColour);
  const dark = new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.35 }), pink = new THREE.MeshStandardMaterial({ color: 0xe07a8a, roughness: 0.5 });
  const { h, long, girth: g, leg } = breed, legLength = h - g * 1.25, wide = breed.broad ? 1.0 : 0.86;
  const dog = new THREE.Group(), body = new THREE.Group(); // `body` carries everything, so the whole dog can bob and lean
  dog.add(body);
  const add = (geometry, material, x, y, z, parent = body) => { const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh); return mesh; };
  const spineY = legLength + g;                              // height of the middle of the body

  // The body: rump, a tucked-up waist, a deep rib cage and the chest.
  const half = long / 2;
  add(ringBody([
    [-half * 1.04, g * 0.05, g * 0.06, spineY + g * 0.3], [-half * 1.0, g * 0.42 * wide, g * 0.5, spineY + g * 0.16], [-half * 0.86, g * 0.74 * wide, g * 0.84, spineY + g * 0.04],
    [-half * 0.6, g * 0.88 * wide, g * 0.94, spineY - g * 0.02], [-half * 0.25, g * 0.76 * wide, g * 0.74, spineY + g * 0.16], [half * 0.1, g * 0.84 * wide, g * 0.9, spineY + g * 0.04],
    [half * 0.45, g * 0.98 * wide, g * 1.08, spineY - g * 0.08], [half * 0.75, g * 0.96 * wide, g * 1.1, spineY - g * 0.08], [half * 0.95, g * 0.74 * wide, g * 0.9, spineY + g * 0.04],
    [half * 1.06, g * 0.4 * wide, g * 0.5, spineY + g * 0.12], [half * 1.1, g * 0.05, g * 0.06, spineY + g * 0.14],
  ], 20), coat, 0, 0, 0);
  if (breed.ruff) { const ruff = add(new THREE.SphereGeometry(g * 0.92, 14, 10), breed.coat === 'saddle' ? top : under, 0, spineY + g * 0.02, half * 0.86); ruff.scale.set(wide * 1.02, 1.12, 0.62); } // a thick mane of fur round the chest

  // Neck and head. The head turns and lifts from the top of the neck.
  const neckLength = h * 0.3, neckLean = 0.85;
  const neck = add(limb(g * 0.5, g * 0.7, neckLength), top, 0, spineY + g * 0.62 + Math.cos(neckLean) * neckLength, half * 0.84 + Math.sin(neckLean) * neckLength);
  neck.rotation.x = neckLean;
  const head = new THREE.Group();
  head.position.set(0, neck.position.y + g * 0.1, neck.position.z + g * 0.06);
  body.add(head);
  const skullSize = g * (breed.broad ? 0.7 : 0.58);
  const skull = add(new THREE.SphereGeometry(skullSize, 16, 12), top, 0, 0, 0, head);
  skull.scale.set(breed.broad ? 1.12 : 0.92, 0.9, 1.18);
  const [muzzleLength, muzzleWide] = breed.muzzle;
  const mask = breed.coat === 'solid' || breed.coat === 'spots' ? top : breed.coat === 'saddle' ? ear : point; // the colour of the face
  const muzzle = add(new THREE.CylinderGeometry(muzzleWide * 0.78, muzzleWide * 1.0, muzzleLength, 12), mask, 0, -skullSize * 0.3, skullSize * 0.78 + muzzleLength / 2, head);
  muzzle.rotation.x = Math.PI / 2;
  muzzle.scale.set(1, 1, 0.8);
  add(new THREE.SphereGeometry(muzzleWide * 0.8, 10, 8), mask, 0, -skullSize * 0.3, skullSize * 0.78 + muzzleLength, head).scale.set(1, 0.8, 0.8);
  add(new THREE.SphereGeometry(skullSize * 0.5, 10, 8), top, 0, skullSize * 0.02, skullSize * 0.62, head).scale.set(1.05, 0.7, 1); // the brow, stepping down to the muzzle
  add(new THREE.SphereGeometry(muzzleWide * 0.4, 10, 8), dark, 0, -skullSize * 0.22, skullSize * 0.78 + muzzleLength + muzzleWide * 0.5, head); // nose
  const jaw = new THREE.Group();                             // the lower jaw drops open to bark and pant
  jaw.position.set(0, -skullSize * 0.56, skullSize * 0.6);
  add(new THREE.BoxGeometry(muzzleWide * 1.3, muzzleWide * 0.34, muzzleLength * 0.98), mask, 0, 0, muzzleLength * 0.5, jaw);
  const tongue = add(new THREE.BoxGeometry(muzzleWide * 0.8, 0.008, muzzleLength * 0.8), pink, 0, muzzleWide * 0.2, muzzleLength * 0.62, jaw);
  head.add(jaw);
  for (const side of [-1, 1]) {
    const eye = add(new THREE.SphereGeometry(skullSize * 0.115, 10, 8), breed.blueEyes ? new THREE.MeshStandardMaterial({ color: 0x8fc8f0, roughness: 0.2 }) : new THREE.MeshStandardMaterial({ color: 0x2a1a0c, roughness: 0.2 }),
      side * skullSize * 0.5, skullSize * 0.2, skullSize * 0.82, head);
    add(new THREE.SphereGeometry(skullSize * 0.07, 6, 6), dark, side * skullSize * 0.02, 0, skullSize * 0.06, eye);                    // pupil
    add(new THREE.SphereGeometry(skullSize * 0.022, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), skullSize * 0.03, skullSize * 0.04, skullSize * 0.11, eye); // the glint
    if (breed.coat === 'blacktan') add(new THREE.SphereGeometry(skullSize * 0.11, 8, 6), point, side * skullSize * 0.42, skullSize * 0.46, skullSize * 0.74, head); // tan eyebrow spots
  }
  const ears = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * skullSize * 0.66, skullSize * 0.56, -skullSize * 0.12);
    head.add(pivot);
    if (breed.ears === 'erect' || breed.ears === 'crop') {     // pricked ears: tall triangles
      const tall = skullSize * (breed.ears === 'crop' ? 1.5 : 1.15);
      const flap = add(new THREE.ConeGeometry(skullSize * (breed.ears === 'crop' ? 0.3 : 0.42), tall, 4), ear, 0, tall * 0.42, 0, pivot);
      flap.scale.z = 0.4;
      flap.rotation.y = Math.PI / 4;
      pivot.rotation.z = -side * 0.18;
    } else {                                                   // ears that hang down beside the face
      const drop = skullSize * (breed.ears === 'longflop' ? 1.9 : breed.ears === 'rose' ? 0.9 : 1.25);
      const flap = add(new THREE.SphereGeometry(skullSize * 0.5, 10, 8), ear, side * skullSize * 0.3, -drop * 0.5, skullSize * 0.1, pivot);
      flap.scale.set(0.26, drop / skullSize * 1.1, 1.0);
      pivot.rotation.z = -side * (breed.ears === 'rose' ? 0.9 : 0.22);
    }
    return pivot;
  });

  // Four legs, jointed the way a dog's really are. A front leg has a short upper arm sloping back
  // to the elbow, a long straight forearm, and a short pastern down to the paw. A back leg has a
  // big thigh sloping forward to the knee, a shin sloping back to the hock, and then a straight
  // drop to the paw: the bent "dog leg" shape. Each joint turns, so the legs fold as they step.
  const legs = [[1, 1], [-1, 1], [1, -1], [-1, -1]].map(([side, end]) => {
    const front = end > 0, pawHigh = leg * 0.62;
    const topY = legLength + g * (front ? 0.3 : 0.38), drop = topY - pawHigh;           // how far it is from the top joint to the ground
    const rests = front ? [0.36, -0.36, -0.16] : [-0.52, 1.14, -0.62];                 // how each joint sits when standing (turning backward is positive)
    const share = front ? [0.3, 0.52, 0.18] : [0.38, 0.34, 0.28];                      // how much of the height each section covers
    const lean = [rests[0], rests[0] + rests[1], rests[0] + rests[1] + rests[2]];       // each section's slope from upright
    const lengths = share.map((part, i) => drop * part / Math.cos(lean[i]));
    const thick = front ? [[1.5, 1.12], [1.12, 0.76], [0.76, 0.7]] : [[2.1, 1.3], [1.3, 0.8], [0.8, 0.7]];
    const sock = breed.coat === 'bib' || breed.coat === 'tricolour' || breed.coat === 'mask' ? under : null; // white legs
    const skins = [sock && front ? under : top, sock || point, sock || point];
    const hip = new THREE.Group();
    hip.position.set(side * g * 0.6 * wide, topY, end * half * (front ? 0.66 : 0.74));
    body.add(hip);
    const joints = [hip];
    let parent = hip;
    lengths.forEach((length, i) => {
      if (i) { const joint = new THREE.Group(); joint.position.y = -lengths[i - 1]; parent.add(joint); joints.push(joint); parent = joint; }
      const muscle = add(limb(leg * thick[i][0], leg * thick[i][1], length), skins[i], 0, 0, 0, parent);
      if (i === 0) muscle.scale.set(0.72, 1, front ? 1 : 1.25);                           // the thigh and upper arm are flat slabs of muscle
      add(new THREE.SphereGeometry(leg * thick[i][0] * (i ? 0.9 : 0.86), 10, 8), skins[i], 0, 0, 0, parent).scale.set(i ? 1 : 0.72, 1, i ? 1 : front ? 1 : 1.25); // rounds off the joint
    });
    // The paw: a pad with four toes, each with a dark claw.
    const paw = new THREE.Group();
    paw.position.y = -lengths[2];
    parent.add(paw);
    add(new THREE.SphereGeometry(leg * 1.05, 10, 8), skins[2], 0, pawHigh * 0.2, leg * 0.35, paw).scale.set(1.1, 0.72, 1.35);
    for (let toe = 0; toe < 4; toe++) {
      const across = (toe - 1.5) * leg * 0.52, out = leg * (1.25 - Math.abs(toe - 1.5) * 0.22);
      add(new THREE.SphereGeometry(leg * 0.36, 8, 6), skins[2], across, pawHigh * 0.02, out, paw).scale.set(1, 0.85, 1.35);
      add(new THREE.ConeGeometry(leg * 0.1, leg * 0.3, 5), dark, across, -pawHigh * 0.1, out + leg * 0.48, paw).rotation.x = 1.9;
    }
    add(new THREE.SphereGeometry(leg * (front ? 1.5 : 1.9), 12, 10), top, -side * g * 0.12, g * 0.1, front ? g * 0.05 : -g * 0.05, hip).scale.set(0.5, 1.4, front ? 1.05 : 1.35); // shoulder blade or haunch, flat against the body
    return { joints, paw, rests, front, phase: (side > 0) === front ? 0 : Math.PI };
  });

  // The tail.
  const tail = new THREE.Group();
  tail.position.set(0, spineY + g * 0.45, -half * 0.96);
  body.add(tail);
  let tailRest = 0.9; // how it hangs: straight down is 0, straight out behind is pi/2
  if (breed.tail === 'dock') { add(limb(leg * 0.8, leg * 0.6, 0.06), top, 0, 0, 0, tail); tailRest = 1.9; }
  else if (breed.tail === 'curl') {                           // carried up and over the back
    const curl = add(new THREE.TorusGeometry(g * 0.62, leg * 1.5, 8, 14, Math.PI * 1.1), top, 0, g * 0.62, 0, tail);
    curl.rotation.y = Math.PI / 2;
    curl.rotation.x = 0.2;
    add(new THREE.SphereGeometry(leg * 1.7, 8, 6), tip, 0, g * 1.2, g * 0.3, tail);
    tailRest = 0;
  } else if (breed.tail !== 'none') {
    const length = h * (breed.tail === 'otter' ? 0.52 : 0.6), thick = leg * (breed.tail === 'bushy' ? 1.7 : breed.tail === 'plume' ? 1.2 : 1.0);
    add(limb(thick, thick * 0.35, length), breed.coat === 'saddle' ? ear : top, 0, 0, 0, tail);
    if (breed.tail !== 'otter') add(new THREE.SphereGeometry(thick * 1.5, 8, 6), breed.tail === 'bushy' ? ear : tip, 0, -length * 0.6, 0, tail).scale.set(0.5, length * 0.42 / (thick * 1.5), 1.25); // the long fur under it
    add(new THREE.SphereGeometry(thick * 0.5, 6, 6), tip, 0, -length, 0, tail);
    tailRest = breed.tail === 'bushy' ? 0.45 : 1.0;
  }
  tail.rotation.x = tailRest;
  return { group: dog, body, head, jaw, tongue, ears, legs, tail, tailRest };
}

// --- The dogs in the world -------------------------------------------------------------------------
export function createDogs(scene) {
  return HOMES.map(([kind, x, z, extra]) => {
    const breed = BREEDS[kind];
    const parts = makeDog(breed, extra.lab ? LAB_COLOURS[extra.lab] : breed.colours);
    parts.group.position.set(x, 0, z);
    parts.group.rotation.y = Math.random() * 6.28;
    scene.add(parts.group);
    return { ...parts, breed, name: extra.name, police: !!extra.police, label: extra.lab ? `${extra.lab} labrador` : breed.name,
      home: new THREE.Vector3(x, 0, z), target: new THREE.Vector3(x, 0, z), state: 'idle', timer: Math.random() * 3, gait: Math.random() * 6, pace: 0,
      health: 70, bark: 0, barkGap: 1 + Math.random() * 3, biteGap: 0, mood: 0, fall: 0, stuck: 0, pat: 0 };
  });
}

const WALK = 1.5, TROT = 4.4;
const aim = new THREE.Vector3();
function woof(dog, playerDistance, kind = dog.breed.hostile ? 'bark' : 'woof') {
  dog.bark = 1;
  if (playerDistance < 34) sfx(dog.breed.voice > 1.35 ? 'yap' : kind);
}

// world: { driving, wanted (stars), onBite(dog, damage) }.
export function updateDogs(dogs, dt, time, playerPosition, world) {
  for (const dog of dogs) {
    const position = dog.group.position, breed = dog.breed;
    const dx = playerPosition.x - position.x, dz = playerPosition.z - position.z, distance = Math.hypot(dx, dz);
    if (distance > 130) continue;                             // too far off to matter: nothing is worked out for it
    dog.timer -= dt;
    dog.biteGap -= dt;
    dog.barkGap -= dt;
    dog.pat = Math.max(0, dog.pat - dt);

    if (dog.state === 'dead') {                               // it lies on its side; another dog turns up later, when nobody is looking
      dog.fall = Math.min(1, dog.fall + dt * 2.5);
      dog.body.rotation.z = dog.fall * dog.fall * 1.5;
      dog.body.position.y = -dog.fall * breed.h * 0.38;
      if (dog.timer <= 0 && distance > 50) { Object.assign(dog, { state: 'idle', health: 70, fall: 0, mood: 0 }); position.copy(dog.home); dog.body.rotation.z = 0; dog.body.position.y = 0; }
      continue;
    }

    const fromHome = Math.hypot(position.x - dog.home.x, position.z - dog.home.z), playerFromHome = Math.hypot(playerPosition.x - dog.home.x, playerPosition.z - dog.home.z);
    const sameLevel = Math.abs(playerPosition.y - position.y) < 2.5;
    let speed = 0, heading = null, happy = 0, angry = 0, panting = 0;

    if (dog.show) {
      // (standing still to have its picture taken)
    } else if (breed.hostile) {
      // Guard dogs: a warning first, then they go for you. Police dogs also come after anyone the police want badly.
      const hunted = dog.police && world.wanted >= 2 && distance < 70;
      if (dog.state !== 'attack' && dog.state !== 'return' && sameLevel && (distance < 4.6 || hunted || (dog.state === 'warn' && dog.timer <= 0 && distance < 9.5))) dog.state = 'attack';
      else if (dog.state === 'idle' && sameLevel && distance < 9.5) { dog.state = 'warn'; dog.timer = 3.5; if (distance < 34) sfx('growl'); }
      else if (dog.state === 'warn' && distance > 12) dog.state = 'idle';
      if (dog.state === 'attack') {
        angry = 1;
        heading = Math.atan2(dx, dz);
        if (!hunted && (playerFromHome > 34 || fromHome > 46 || !sameLevel)) dog.state = 'return';
        else if (distance > 1.15) speed = Math.min(breed.speed, (distance - 1.0) / dt);
        else if (dog.biteGap <= 0 && !world.driving) { dog.biteGap = 1.3; dog.bark = 1; world.onBite(dog, breed.bite); }
        if (dog.barkGap <= 0) { dog.barkGap = 0.7 + Math.random() * 0.7; woof(dog, distance); }
      } else if (dog.state === 'warn') {
        angry = 0.7;
        heading = Math.atan2(dx, dz);
        if (dog.barkGap <= 0) { dog.barkGap = 0.55 + Math.random() * 0.5; woof(dog, distance); }
      } else if (dog.state === 'return' || fromHome > 2.5) {
        const hx = dog.home.x - position.x, hz = dog.home.z - position.z;
        heading = Math.atan2(hx, hz);
        speed = fromHome > 0.6 ? TROT : 0;
        if (fromHome <= 0.6) dog.state = 'idle';
      }
    } else {
      // Friendly dogs: they potter about near home, and come over to anyone who walks up.
      if (dog.state === 'flee') {
        heading = Math.atan2(-dx, -dz);
        speed = 7;
        if (dog.timer <= 0 || distance > 40) dog.state = 'idle';
      } else if (sameLevel && distance < 7 && fromHome < 22 && !world.driving) {
        dog.state = 'greet';
        happy = 1;
        panting = 1;
        heading = Math.atan2(dx, dz);
        if (distance > 1.7) speed = Math.min(TROT, (distance - 1.6) * 3);
        if (dog.barkGap <= 0) { dog.barkGap = 4 + Math.random() * 6; woof(dog, distance); }
      } else {
        if (dog.state === 'greet') { dog.state = 'idle'; dog.timer = 1; }
        const tx = dog.target.x - position.x, tz = dog.target.z - position.z, left = Math.hypot(tx, tz);
        if (dog.state === 'walk' && left > 0.4 && dog.timer > 0) { heading = Math.atan2(tx, tz); speed = WALK; }
        else if (dog.state === 'walk') { dog.state = 'idle'; dog.timer = 2 + Math.random() * 6; }
        else if (dog.timer <= 0) { // somewhere new to sniff, never far from home
          const angle = Math.random() * 6.28, far = 2 + Math.random() * 6;
          dog.target.set(dog.home.x + Math.cos(angle) * far, 0, dog.home.z + Math.sin(angle) * far);
          dog.state = 'walk';
          dog.timer = 9;
        }
        happy = 0.25;
      }
    }

    // Moving, and not through walls or into deep water.
    if (speed > 0 && heading !== null) {
      const beforeX = position.x, beforeZ = position.z;
      position.x += Math.sin(heading) * speed * dt;
      position.z += Math.cos(heading) * speed * dt;
      pushOut(position, 0.3);
      if (waterDepthAt(position) > 0.5) { position.x = beforeX; position.z = beforeZ; }
      const made = Math.hypot(position.x - beforeX, position.z - beforeZ);
      dog.stuck = made < speed * dt * 0.4 ? dog.stuck + dt : 0;
      if (dog.stuck > 0.6 && dog.state === 'walk') { dog.state = 'idle'; dog.timer = 0.5; dog.stuck = 0; }
      speed = made / Math.max(dt, 1e-4);
    }
    position.y = floorAt(position);
    if (heading !== null) {
      let turn = heading - dog.group.rotation.y;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      dog.group.rotation.y += turn * Math.min(1, 9 * dt);
    }

    // --- How it moves its body ---
    dog.pace += (speed - dog.pace) * Math.min(1, 8 * dt);
    dog.mood += (angry - dog.mood) * Math.min(1, 5 * dt);
    const run = Math.min(1, dog.pace / 5), stride = Math.min(1, dog.pace / 1.2);
    dog.gait += dt * (4 + dog.pace * 2.2) * (0.5 / Math.max(0.25, breed.h));
    for (const leg of dog.legs) {
      const beat = dog.gait + leg.phase + (leg.front ? 0 : run * 0.9);                  // (at a run the back legs come through together, a little late)
      const swing = Math.sin(beat), lift = Math.max(0, Math.cos(beat)) * stride;        // lift: the foot is off the ground, coming forward
      const [top, middle, low] = leg.joints, reach = (0.4 + 0.42 * run) * stride;
      top.rotation.x = leg.rests[0] + swing * reach - dog.mood * (leg.front ? 0.06 : -0.08);
      if (leg.front) {                                                                   // the elbow closes and the wrist folds back under
        middle.rotation.x = leg.rests[1] - lift * (0.55 + 0.3 * run);
        low.rotation.x = leg.rests[2] + lift * (1.1 + 0.4 * run);
      } else {                                                                           // the knee and hock fold up, tucking the foot
        middle.rotation.x = leg.rests[1] + lift * (0.6 + 0.35 * run);
        low.rotation.x = leg.rests[2] - lift * (0.35 + 0.2 * run);
      }
      leg.paw.rotation.x = -(top.rotation.x + middle.rotation.x + low.rotation.x) * (1 - lift) + lift * 0.5; // flat on the ground when down, toes hanging when lifted
    }
    dog.body.position.y = Math.abs(Math.sin(dog.gait)) * 0.025 * stride + Math.sin(time * 2.2 + dog.gait) * 0.004; // the bounce of the trot, and breathing
    dog.body.rotation.x = -run * 0.06 - dog.mood * 0.05;
    dog.body.rotation.z = 0;
    // Tail: a wag for friends, stiff and high for strangers.
    const wag = Math.max(happy, dog.pat > 0 ? 1 : 0);
    dog.tail.rotation.x = dog.tailRest + (dog.tailRest > 0 ? dog.mood * 0.9 + wag * 0.35 : 0);
    dog.tail.rotation.z = Math.sin(time * (9 + wag * 5)) * 0.65 * wag;
    // Head: watching the player when he is near, dropping to sniff on a walk, thrown up with each bark.
    dog.bark = Math.max(0, dog.bark - dt * 4.5);
    const watching = distance < 12 && !dog.show ? 1 : 0;
    aim.set(dx, 0, dz).normalize();
    const side = Math.atan2(Math.sin(Math.atan2(dx, dz) - dog.group.rotation.y), Math.cos(Math.atan2(dx, dz) - dog.group.rotation.y));
    dog.head.rotation.y += (THREE.MathUtils.clamp(side, -1, 1) * watching - dog.head.rotation.y) * Math.min(1, 6 * dt);
    dog.head.rotation.x += ((dog.state === 'walk' ? 0.5 : -0.1 * watching) - dog.bark * 0.35 - dog.mood * -0.15 - dog.head.rotation.x) * Math.min(1, 7 * dt);
    dog.jaw.rotation.x = Math.max(dog.bark * 0.6, panting * (0.2 + Math.sin(time * 9) * 0.06), dog.mood * 0.22);
    dog.tongue.visible = panting > 0 && dog.bark < 0.2;
    for (const [i, ear] of dog.ears.entries()) ear.rotation.x = -dog.mood * 0.35 + Math.sin(time * 1.3 + i) * 0.03;
  }
}

// Which living dog a bullet reaches first, if any: { dog, distance }.
export function findDogHit(dogs, origin, direction, maxDistance) {
  let best = null;
  for (const dog of dogs) {
    if (dog.state === 'dead') continue;
    aim.set(dog.group.position.x, dog.group.position.y + dog.breed.h * 0.75, dog.group.position.z).sub(origin);
    const along = aim.dot(direction);
    if (along <= 0 || along >= maxDistance || (best && along >= best.distance)) continue;
    if (aim.addScaledVector(direction, -along).length() < dog.breed.h * 0.62) best = { dog, distance: along };
  }
  return best;
}
// The nearest living dog within reach of a spot.
export function dogNear(dogs, position, reach) {
  let best = null;
  for (const dog of dogs) {
    if (dog.state === 'dead') continue;
    const distance = Math.hypot(dog.group.position.x - position.x, dog.group.position.z - position.z);
    if (distance < reach && Math.abs(dog.group.position.y - position.y) < 1.5) { reach = distance; best = dog; }
  }
  return best;
}
// Hurt a dog. A friendly one yelps and bolts; a guard dog comes at you. Returns true if that killed it.
export function hurtDog(dog, damage) {
  if (dog.state === 'dead') return false;
  dog.health -= damage;
  sfx('yelp');
  if (dog.health <= 0) { Object.assign(dog, { state: 'dead', timer: 60, fall: 0 }); return true; }
  if (dog.breed.hostile) dog.state = 'attack'; else { dog.state = 'flee'; dog.timer = 6; }
  return false;
}
// A pat on the head.
export function patDog(dog) {
  dog.pat = 3;
  dog.bark = 1;
  dog.barkGap = 5;
  sfx(dog.breed.voice > 1.35 ? 'yap' : 'woof');
}