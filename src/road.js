// The street that runs past the house and the corner shop: two lanes of
// asphalt with painted lines, kerbs and pavements on both sides, a zebra
// crossing by the shop, street lamps, a fire hydrant and a street sign.
import * as THREE from 'three';
import { addObstacle, addFloor } from './world.js';
import { clearings } from './grass.js';
import { block, canvasTexture, speckle } from './house.js';

const LENGTH = 1200;   // the street runs the whole way across the map, along X
const KERB = 0.13;     // how high the pavement stands above the road

// nearZ: the edge of the street nearest the buildings. The street is 9 m wide in
// all: 1.5 m of pavement, 6 m of road, 1.5 m of pavement.
// shopX: where the corner shop is, for the crossing and the shop's entrance.
export function createRoad(scene, nearZ, shopX, shopForecourtZ) {
  const street = new THREE.Group();
  const roadNear = nearZ + 1.5, roadFar = nearZ + 7.5, farZ = nearZ + 9, middle = nearZ + 4.5;

  const asphalt = new THREE.MeshStandardMaterial({
    roughness: 0.95,
    map: canvasTexture(256, (ctx, size) => {
      ctx.fillStyle = '#4a4a48';
      ctx.fillRect(0, 0, size, size);
      speckle(ctx, size, 9000, 0.07);
      ctx.strokeStyle = 'rgba(20,20,20,0.5)'; // cracks
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        let cx = Math.random() * size, cy = Math.random() * size;
        ctx.moveTo(cx, cy);
        for (let step = 0; step < 6; step++) { cx += Math.random() * 40 - 20; cy += Math.random() * 40 - 20; ctx.lineTo(cx, cy); }
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(30,30,30,0.25)';  // darker strips where the tyres run
      ctx.fillRect(0, size * 0.18, size, size * 0.1);
      ctx.fillRect(0, size * 0.72, size, size * 0.1);
    }, LENGTH / 6, 1),
  });
  const paving = new THREE.MeshStandardMaterial({
    roughness: 1,
    map: canvasTexture(128, (ctx, size) => { // square slabs with a joint between each
      ctx.fillStyle = '#c4beb0';
      ctx.fillRect(0, 0, size, size);
      speckle(ctx, size, 2500, 0.06);
      ctx.fillStyle = 'rgba(70,65,55,0.5)';
      ctx.fillRect(0, 0, 2, size);
    }, LENGTH / 1.5, 1),
  });
  const plain = (color, roughness = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  const kerbStone = plain(0xd3cec2, 0.9), white = plain(0xeeeae0, 0.7), yellow = plain(0xe3b21e, 0.7);
  const steel = plain(0x6f7376, 0.5, { metalness: 0.5 }), dark = plain(0x2a2b2c, 0.8), red = plain(0xc0281e, 0.5);

  // Road surface, pavements and kerbs.
  block(street, asphalt, LENGTH, 0.04, 6, 0, 0.02, middle).castShadow = false;
  for (const [z0, kerbZ] of [[nearZ, roadNear - 0.08], [roadFar, roadFar + 0.08]]) {
    block(street, paving, LENGTH, KERB, 1.5, 0, KERB / 2, z0 + 0.75).castShadow = false;
    block(street, kerbStone, LENGTH, KERB + 0.01, 0.16, 0, (KERB + 0.01) / 2, kerbZ).castShadow = false;
    addFloor(-LENGTH / 2, LENGTH / 2, z0, z0 + 1.5, KERB);
  }

  // Painted lines: a white line along each edge and yellow dashes down the middle.
  for (const lineZ of [roadNear + 0.35, roadFar - 0.35]) block(street, white, LENGTH, 0.004, 0.11, 0, 0.042, lineZ).castShadow = false;
  const dashCount = Math.floor(LENGTH / 9);
  const dashes = new THREE.InstancedMesh(new THREE.BoxGeometry(3, 0.004, 0.12), yellow, dashCount);
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < dashCount; i++) dashes.setMatrixAt(i, matrix.makeTranslation(-LENGTH / 2 + 4.5 + i * 9, 0.042, middle));
  street.add(dashes);

  // Zebra crossing in front of the shop, and a manhole cover or two.
  for (let stripe = 0; stripe < 7; stripe++) block(street, white, 2.6, 0.005, 0.45, shopX, 0.043, roadNear + 0.5 + stripe * 0.85).castShadow = false;
  for (const [mx, mz] of [[shopX - 14, middle - 1.4], [shopX - 40, middle + 1.2], [shopX + 22, middle - 1.1]]) {
    const cover = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.006, 20), dark);
    cover.position.set(mx, 0.043, mz);
    street.add(cover);
  }

  // The shop's forecourt carries on down to the street.
  const gap = nearZ - shopForecourtZ;
  if (gap > 0) block(street, paving, 10, 0.06, gap + 0.2, shopX, 0.03, shopForecourtZ + gap / 2).castShadow = false;

  // Street lamps along the near pavement, leaning out over the road.
  for (let lampX = shopX - 99; lampX <= shopX + 81; lampX += 30) {
    const lamp = new THREE.Group();
    lamp.position.set(lampX, KERB, nearZ + 0.35);
    block(lamp, steel, 0.24, 0.3, 0.24, 0, 0.15, 0);
    block(lamp, steel, 0.11, 6, 0.11, 0, 3, 0);
    block(lamp, steel, 0.08, 0.08, 2.2, 0, 5.95, 1.05);
    block(lamp, dark, 0.3, 0.1, 0.7, 0, 5.9, 2.1);
    block(lamp, new THREE.MeshBasicMaterial({ color: 0xfff3cf }), 0.22, 0.03, 0.5, 0, 5.84, 2.1);
    street.add(lamp);
    addObstacle(lampX - 0.13, lampX + 0.13, nearZ + 0.22, nearZ + 0.48, 6);
  }

  // A fire hydrant and the street-name sign near the shop.
  const hydrantX = shopX - 6.5, hydrantZ = nearZ + 0.45;
  const hydrant = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.55, 12), red);
  hydrant.position.set(hydrantX, KERB + 0.275, hydrantZ);
  hydrant.castShadow = true;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 8), red);
  cap.position.set(hydrantX, KERB + 0.56, hydrantZ);
  street.add(hydrant, cap);
  block(street, red, 0.4, 0.1, 0.1, hydrantX, KERB + 0.36, hydrantZ);
  addObstacle(hydrantX - 0.15, hydrantX + 0.15, hydrantZ - 0.15, hydrantZ + 0.15, 0.8);

  const signX = shopX + 6.5, signZ = nearZ + 0.4;
  block(street, steel, 0.07, 2.9, 0.07, signX, KERB + 1.45, signZ);
  const nameCanvas = document.createElement('canvas');
  nameCanvas.width = 256;
  nameCanvas.height = 64;
  const ctx = nameCanvas.getContext('2d');
  ctx.fillStyle = '#1f6b3a';
  ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 248, 56);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 38px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PALM AVE', 128, 34);
  const nameTexture = new THREE.CanvasTexture(nameCanvas);
  nameTexture.colorSpace = THREE.SRGBColorSpace;
  block(street, new THREE.MeshBasicMaterial({ map: nameTexture }), 0.9, 0.22, 0.03, signX, KERB + 2.75, signZ);
  addObstacle(signX - 0.1, signX + 0.1, signZ - 0.1, signZ + 0.1, 3);

  // A small green road sign on the far pavement, facing along the road: "CITY 2 MILES".
  const cityX = shopX + 16, cityZ = farZ - 0.55;
  const cityCanvas = document.createElement('canvas');
  cityCanvas.width = 256;
  cityCanvas.height = 128;
  const sign = cityCanvas.getContext('2d');
  sign.fillStyle = '#1f6b3a';
  sign.fillRect(0, 0, 256, 128);
  sign.strokeStyle = '#ffffff';
  sign.lineWidth = 5;
  sign.strokeRect(6, 6, 244, 116);
  sign.fillStyle = '#ffffff';
  sign.textAlign = 'center';
  sign.textBaseline = 'middle';
  sign.font = 'bold 52px Arial, sans-serif';
  sign.fillText('CITY', 128, 44);
  sign.font = 'bold 36px Arial, sans-serif';
  sign.fillText('2 MILES', 128, 92);
  const cityTexture = new THREE.CanvasTexture(cityCanvas);
  cityTexture.colorSpace = THREE.SRGBColorSpace;
  block(street, new THREE.MeshBasicMaterial({ map: cityTexture }), 0.03, 0.55, 1.1, cityX, KERB + 1.75, cityZ);
  block(street, steel, 0.05, 0.6, 1.14, cityX + 0.03, KERB + 1.75, cityZ); // metal backing
  for (const postZ of [cityZ - 0.4, cityZ + 0.4]) block(street, steel, 0.06, 2.05, 0.06, cityX + 0.04, KERB + 1.02, postZ);
  addObstacle(cityX - 0.1, cityX + 0.15, cityZ - 0.5, cityZ + 0.5, 2.2);

  scene.add(street);
  clearings[5].set(-LENGTH / 2, nearZ - 0.05, LENGTH / 2, farZ + 0.05); // no grass on the street
  return street;
}
