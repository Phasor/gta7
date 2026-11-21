// Palm City: the Miami-style downtown at the end of the road. Ten buildings,
// all different: pastel art-deco hotels with neon signs and fins, white condo
// blocks with balconies, and glass towers. Their windows glow at night.
//
// Every building has a ground-floor lobby you can walk into through sliding
// glass doors: hotel and office receptions with lifts and seating, a bank with
// tellers and a vault, and a nightclub with a bar and a lit dance floor. The
// floors above are a shell.
import * as THREE from 'three';
import { addObstacle, addFloor, addInterior } from './world.js';
import { clearings } from './grass.js';
import { block, canvasTexture, speckle, makeMaterials, addPalm } from './house.js';
import { label } from './store.js';

const FLOOR = 3.3;       // height of one storey
const LOBBY = 4.6;       // height of the ground floor
const BAY = 3;           // width of one window bay
const BASE = 0.15;       // the lobby floor is a small step up from the pavement
const NEAR_EDGE = -9, FAR_EDGE = 0; // the outer edges of the street's pavements
const css = (hex) => `#${new THREE.Color(hex).getHexString()}`;

// A facade: an 8 x 8 grid of windows, plus a matching picture of which are lit at night.
function facade(style, wallHex, glassCss) {
  const cell = 64, size = cell * 8;
  const windows = [];
  const map = canvasTexture(size, (ctx) => {
    ctx.fillStyle = css(wallHex);
    ctx.fillRect(0, 0, size, size);
    speckle(ctx, size, 6000, 0.035);
    for (let i = 0; i < 14; i++) { // rain streaks and weathering
      ctx.fillStyle = `rgba(60,50,40,${0.03 + Math.random() * 0.05})`;
      ctx.fillRect(Math.random() * size, 0, 2 + Math.random() * 5, size);
    }
    for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
      const x = col * cell, y = row * cell;
      if (style === 'glass') {
        // Curtain wall: glass from edge to edge, a darker band at each floor, thin metal frames.
        const sky = ctx.createLinearGradient(0, y, 0, y + cell);
        sky.addColorStop(0, 'rgba(255,255,255,0.32)');
        sky.addColorStop(0.5, 'rgba(255,255,255,0.05)');
        sky.addColorStop(1, 'rgba(0,0,0,0.25)');
        ctx.fillStyle = glassCss;
        ctx.fillRect(x, y, cell, cell);
        ctx.fillStyle = sky;
        ctx.fillRect(x, y, cell, cell);
        ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.14})`;
        ctx.fillRect(x, y, cell, cell);
        ctx.fillStyle = 'rgba(15,25,35,0.6)';
        ctx.fillRect(x, y + cell - 13, cell, 13);
        ctx.fillStyle = 'rgba(210,220,225,0.8)';
        ctx.fillRect(x, y, 2, cell);
        ctx.fillRect(x, y + cell - 14, cell, 1.5);
        windows.push([x + 2, y, cell - 2, cell - 14]);
        continue;
      }
      const wide = style === 'condo';
      const wx = x + (wide ? 7 : 17), wy = y + 12, ww = wide ? 50 : 30, wh = wide ? 40 : 38;
      ctx.fillStyle = 'rgba(0,0,0,0.22)';             // shadow under the lintel and sill
      ctx.fillRect(wx - 3, wy + wh, ww + 6, 4);
      ctx.fillStyle = '#f2efe6';                      // frame
      ctx.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
      const pane = ctx.createLinearGradient(0, wy, 0, wy + wh);
      pane.addColorStop(0, '#6f8b98');
      pane.addColorStop(1, glassCss);
      ctx.fillStyle = pane;
      ctx.fillRect(wx, wy, ww, wh);
      if (Math.random() < 0.55) {                     // blinds or curtains, drawn part-way
        ctx.fillStyle = ['rgba(240,235,220,0.75)', 'rgba(215,200,170,0.7)', 'rgba(190,205,215,0.7)'][(Math.random() * 3) | 0];
        ctx.fillRect(wx, wy, ww, wh * (0.25 + Math.random() * 0.55));
      }
      ctx.fillStyle = '#f2efe6';                      // glazing bars
      ctx.fillRect(wx + ww / 2 - 1, wy, 2, wh);
      if (!wide) ctx.fillRect(wx, wy + wh / 2 - 1, ww, 2);
      windows.push([wx, wy, ww, wh]);
    }
  }, 1, 1);
  const lit = canvasTexture(size, (ctx) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, size, size);
    for (const [wx, wy, ww, wh] of windows) {
      if (Math.random() > 0.42) continue;
      ctx.fillStyle = ['#ffd98a', '#ffe9b8', '#bfe4ff', '#ffc070'][(Math.random() * 4) | 0];
      ctx.globalAlpha = 0.6 + Math.random() * 0.4;
      ctx.fillRect(wx, wy, ww, wh);
    }
  }, 1, 1);
  map.anisotropy = 4;
  return new THREE.MeshStandardMaterial({
    map, emissiveMap: lit, emissive: 0xffffff, emissiveIntensity: 0.6,
    roughness: style === 'glass' ? 0.12 : 0.85, metalness: style === 'glass' ? 0.55 : 0,
  });
}

// A box whose sides are covered in windows, one bay wide and one storey high each.
function storeys(w, floors, d) {
  const geometry = new THREE.BoxGeometry(w, floors * FLOOR, d);
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const face = Math.floor(i / 4); // 0,1: the +x and -x sides; 2,3: top and bottom; 4,5: front and back
    if (face === 2 || face === 3) uv.setXY(i, 0.002, 0.002); // roofs are plain wall
    else uv.setXY(i, uv.getX(i) * ((face < 2 ? d : w) / BAY) / 8, uv.getY(i) * floors / 8);
  }
  return geometry;
}

// Letters stacked down a strip, for neon signs on fins.
function verticalSign(text, ink) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64 * text.length;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#16121c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = ink;
  ctx.font = 'bold 54px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  [...text].forEach((letter, i) => ctx.fillText(letter, 32, 34 + i * 64));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: texture });
}

// Indoor surfaces glow a little by themselves, so lobbies look lit without needing lamps.
const glowing = (color, strength = 0.35, roughness = 0.6, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: strength, roughness, ...extra });

// --- The lobby inside each building ---------------------------------------------------
// Measurements are from the middle of the building with its front toward +Z.
function furnishLobby(tower, spec, solid) {
  const { w, d, kind } = spec;
  const inW = w - 0.7, inD = d - 0.7;
  const accent = glowing(spec.accent, 0.3), dark = glowing(0x2a2622, 0.15, 0.5), steel = glowing(0xb9bcbe, 0.2, 0.3, { metalness: 0.6 });
  const gold = glowing(0xc9a24a, 0.3, 0.3, { metalness: 0.7 }), cream = glowing(0xf2ecdf, 0.4), leaf = glowing(0x4f7a35, 0.25, 1);
  const fabric = glowing(new THREE.Color(spec.accent).lerp(new THREE.Color(0x30303a), 0.45), 0.25, 1);
  const neon = new THREE.MeshBasicMaterial({ color: spec.neon });
  const put = (material, bw, bh, bd, px, y, pz) => block(tower, material, bw, bh, bd, px, BASE + y, pz); // y: centre height above the lobby floor
  const thing = (material, bw, bh, bd, px, pz) => { solid(px, pz, bw, bd, BASE + bh); return put(material, bw, bh, bd, px, bh / 2, pz); };
  const round = (material, radius, height, px, y, pz) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 18), material);
    mesh.position.set(px, BASE + y, pz);
    tower.add(mesh);
    return mesh;
  };

  // Polished floor in two tones, glowing walls with a coloured band, and a lit ceiling.
  const tiles = canvasTexture(128, (ctx, s) => {
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      ctx.fillStyle = (i + j) % 2 ? '#f1ebdd' : css(new THREE.Color(spec.accent).lerp(new THREE.Color(0xf1ebdd), 0.55));
      ctx.fillRect(i * 64, j * 64, 64, 64);
    }
    speckle(ctx, s, 900, 0.04);
    ctx.strokeStyle = 'rgba(90,80,60,0.35)';
    ctx.strokeRect(0, 0, 64, 64); ctx.strokeRect(64, 64, 64, 64);
  }, inW / 3, inD / 3);
  put(new THREE.MeshStandardMaterial({ map: tiles, emissiveMap: tiles, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.25 }), inW, 0.04, inD, 0, 0, 0).castShadow = false;
  const wallTone = glowing(new THREE.Color(spec.wall).lerp(new THREE.Color(0xffffff), 0.55), 0.4, 0.9);
  put(wallTone, inW, LOBBY - BASE, 0.06, 0, (LOBBY - BASE) / 2, -d / 2 + 0.36);
  put(wallTone, 0.06, LOBBY - BASE, inD, -w / 2 + 0.36, (LOBBY - BASE) / 2, 0);
  put(wallTone, 0.06, LOBBY - BASE, inD, w / 2 - 0.36, (LOBBY - BASE) / 2, 0);
  put(accent, inW, 0.9, 0.08, 0, 0.45, -d / 2 + 0.38);
  put(accent, 0.08, 0.9, inD, -w / 2 + 0.38, 0.45, 0);
  put(accent, 0.08, 0.9, inD, w / 2 - 0.38, 0.45, 0);
  put(cream, inW, 0.06, inD, 0, LOBBY - BASE - 0.12, 0).castShadow = false;
  const lightPanel = new THREE.MeshBasicMaterial({ color: 0xfff6e0 });
  for (let px = -inW / 2 + 2.5; px < inW / 2 - 1; px += 5) for (let pz = -inD / 2 + 2.5; pz < inD / 2 - 1; pz += 5) put(lightPanel, 1.3, 0.03, 1.3, px, LOBBY - BASE - 0.16, pz);

  // Four columns holding up the tower above.
  for (const [cx, cz] of [[-w / 4, -d / 5], [w / 4, -d / 5], [-w / 4, d / 5], [w / 4, d / 5]]) {
    if (kind === 'club' && cz < 0) continue; // the club keeps its dance floor clear
    round(kind === 'bank' ? cream : gold, 0.34, LOBBY - BASE, cx, (LOBBY - BASE) / 2, cz);
    round(dark, 0.42, 0.25, cx, 0.125, cz);
    solid(cx, cz, 0.7, 0.7, LOBBY);
  }
  // Big potted plants just inside the doors.
  for (const side of [-1, 1]) {
    round(glowing(0xb8643c, 0.2, 0.9), 0.36, 0.7, side * 3.0, 0.35, d / 2 - 1.4);
    const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 1), leaf);
    bush.position.set(side * 3.0, BASE + 1.45, d / 2 - 1.4);
    bush.scale.y = 1.4;
    tower.add(bush);
    solid(side * 3.0, d / 2 - 1.4, 0.7, 0.7, 2.2);
  }
  const back = -d / 2 + 0.4; // the inside face of the back wall

  if (kind === 'club') {
    // Nightclub: a lit dance floor, a mirror ball, a DJ booth, and a long bar with stools and bottles.
    const colours = [0xff3fd0, 0x3fe0ff, 0xffe14f, 0x7a4fff, 0x3fff9a, 0xff6a3f];
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
      put(new THREE.MeshBasicMaterial({ color: colours[(i * 5 + j * 3) % 6] }), 0.95, 0.03, 0.95, -2.5 + i, 0.04, -d / 5 - 2.5 + j);
    }
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.15, flatShading: true, emissive: 0x888888 }));
    ball.position.set(0, LOBBY - 1.0, -d / 5);
    tower.add(ball);
    put(steel, 0.03, 0.5, 0.03, 0, LOBBY - BASE - 0.4, -d / 5);
    thing(dark, 3.2, 1.1, 0.9, 0, back + 0.9);                                   // DJ booth
    put(neon, 3.2, 0.06, 0.04, 0, 0.8, back + 1.37);
    for (const side of [-1, 1]) { thing(dark, 0.9, 1.9, 0.8, side * 2.6, back + 0.8); round(steel, 0.3, 0.05, side * 2.6, 1.3, back + 1.21).rotation.x = Math.PI / 2; }
    const barX = -w / 2 + 1.5, barLength = d * 0.55;
    thing(dark, 0.9, 1.1, barLength, barX, 0);
    put(accent, 1.0, 0.06, barLength + 0.1, barX, 1.13, 0);
    put(neon, 0.04, 0.06, barLength, barX + 0.47, 0.25, 0);
    for (let s = -barLength / 2 + 0.6; s < barLength / 2; s += 1.1) { round(steel, 0.05, 0.75, barX + 1.0, 0.375, s); round(fabric, 0.2, 0.08, barX + 1.0, 0.78, s); }
    for (let level = 0; level < 3; level++) {
      put(steel, 0.25, 0.03, barLength, -w / 2 + 0.52, 1.5 + level * 0.45, 0);
      for (let b = -barLength / 2 + 0.2; b < barLength / 2; b += 0.28) put(glowing(colours[Math.floor(Math.abs(b * 7 + level)) % 6], 0.5, 0.2), 0.09, 0.3, 0.09, -w / 2 + 0.52, 1.67 + level * 0.45, b);
    }
    for (const side of [-1, 1]) put(neon, 0.05, LOBBY - BASE - 0.4, 0.05, side * (w / 2 - 0.42), (LOBBY - BASE) / 2, back + 0.1);
    return;
  }

  if (kind === 'bank') {
    // Bank: a long teller counter behind glass, rope barriers for the queue, cash machines, and the vault.
    const counter = w * 0.5;
    thing(dark, counter, 1.15, 0.9, -w / 8, back + 1.6);
    put(gold, counter + 0.1, 0.05, 1.0, -w / 8, 1.18, back + 1.6);
    put(new THREE.MeshStandardMaterial({ color: 0xbfe0e6, roughness: 0.05, transparent: true, opacity: 0.25, depthWrite: false }), counter, 1.2, 0.05, -w / 8, 1.8, back + 1.85);
    for (let t = 0; t < 4; t++) {
      const tx = -w / 8 - counter / 2 + (t + 0.5) * counter / 4;
      put(new THREE.MeshBasicMaterial({ map: label(`TELLER ${t + 1}`, null, '#1c2f52', '#f2f0e6', 256, 64) }), 1.2, 0.3, 0.04, tx, 2.65, back + 1.85);
      put(dark, 0.4, 0.3, 0.05, tx, 1.36, back + 1.3);
    }
    for (let q = 0; q < 4; q++) {                                                // queue barriers
      for (const side of [-1.2, 1.2]) { round(gold, 0.04, 1.0, -w / 8 + side, 0.5, back + 3.2 + q * 1.4); solid(-w / 8 + side, back + 3.2 + q * 1.4, 0.2, 0.2, 1.1); }
      if (q < 3) for (const side of [-1.2, 1.2]) put(glowing(0x8a1f1a, 0.3), 0.05, 0.05, 1.4, -w / 8 + side, 0.9, back + 3.9 + q * 1.4);
    }
    const vaultX = w / 2 - 3.2;                                                  // the vault door, on the back wall
    const vault = round(steel, 1.5, 0.3, vaultX, 1.75, back + 0.2);
    vault.rotation.x = Math.PI / 2;
    round(dark, 1.62, 0.2, vaultX, 1.75, back + 0.12).rotation.x = Math.PI / 2;
    for (let spoke = 0; spoke < 3; spoke++) put(gold, 1.3, 0.07, 0.07, vaultX, 1.75, back + 0.4).rotation.z = spoke * Math.PI / 3;
    round(gold, 0.16, 0.12, vaultX, 1.75, back + 0.42).rotation.x = Math.PI / 2;
    put(new THREE.MeshBasicMaterial({ map: label('VAULT', 'STAFF ONLY', '#1c2f52', '#ffd23a', 256, 128) }), 1.6, 0.6, 0.04, vaultX, 3.75, back + 0.06);
    for (let a = 0; a < 2; a++) {                                                // cash machines
      thing(dark, 0.5, 1.6, 0.8, -w / 2 + 0.7, d / 6 + a * 1.2);
      put(new THREE.MeshBasicMaterial({ color: 0x3fa0e0 }), 0.02, 0.3, 0.4, -w / 2 + 0.96, 1.25, d / 6 + a * 1.2);
    }
    return;
  }

  // Hotels, offices and condos: a reception desk under the building's name, lifts, and a seating area.
  thing(dark, 5.2, 1.1, 0.95, 0, back + 2.0);
  put(accent, 5.4, 0.06, 1.1, 0, 1.13, back + 2.0);
  put(neon, 5.2, 0.05, 0.04, 0, 0.2, back + 2.5);
  put(dark, 0.5, 0.36, 0.05, -1.2, 1.36, back + 1.8);
  round(gold, 0.07, 0.06, 1.4, 1.19, back + 2.2);                                // the bell
  put(new THREE.MeshBasicMaterial({ map: label(spec.name, kind === 'hotel' ? 'RECEPTION' : kind === 'condo' ? 'RESIDENTS & GUESTS' : 'RECEPTION · ALL VISITORS SIGN IN', '#16121c', css(spec.neon), 1024, 256) }), 5.2, 1.3, 0.06, 0, 3.0, back + 0.05);
  // Two lifts in the back wall.
  for (const lx of [w / 2 - 3.2, w / 2 - 5.6]) {
    put(steel, 1.9, 2.5, 0.06, lx, 1.25, back + 0.04);
    put(dark, 0.03, 2.5, 0.07, lx, 1.25, back + 0.06);                           // the gap between the doors
    put(gold, 2.1, 0.1, 0.1, lx, 2.56, back + 0.05);
    put(new THREE.MeshBasicMaterial({ color: 0xff9a30 }), 0.14, 0.14, 0.03, lx + 1.15, 1.3, back + 0.06); // call button
    put(new THREE.MeshBasicMaterial({ map: label(lx > w / 2 - 4 ? 'L' : '7', null, '#111', '#ff5a30', 64, 64) }), 0.3, 0.3, 0.03, lx, 2.85, back + 0.06);
  }
  put(new THREE.MeshBasicMaterial({ map: label('LIFTS', null, '#16121c', '#f2f0e6', 256, 64) }), 1.4, 0.35, 0.04, w / 2 - 4.4, 3.4, back + 0.06);
  // Sofas round a low table on a rug.
  const sx = -w / 4 - 0.5, sz = d / 5 + 0.2;
  put(glowing(new THREE.Color(spec.accent).lerp(new THREE.Color(0x7a2f3a), 0.5), 0.25, 1), 4.4, 0.02, 3.4, sx, 0.03, sz - 2.6).castShadow = false;
  for (const turn of [-1, 1]) {
    thing(fabric, 2.4, 0.48, 0.95, sx, sz - 2.6 + turn * 1.35);
    put(fabric, 2.4, 0.5, 0.25, sx, 0.73, sz - 2.6 + turn * 1.72);
  }
  thing(dark, 1.3, 0.4, 0.7, sx, sz - 2.6);
  put(gold, 1.4, 0.04, 0.8, sx, 0.42, sz - 2.6);

  if (kind === 'hotel') {       // a brass luggage trolley with suitcases
    const tx = w / 4 + 1.5, tz = d / 5 - 2.5;
    solid(tx, tz, 1.3, 0.7, 1.9);
    put(dark, 1.3, 0.08, 0.7, tx, 0.25, tz);
    for (const side of [-0.6, 0.6]) round(gold, 0.03, 1.6, tx + side, 1.05, tz);
    put(gold, 1.26, 0.05, 0.05, tx, 1.85, tz);
    put(glowing(0x7a4a2a, 0.2), 0.7, 0.45, 0.45, tx - 0.2, 0.52, tz);
    put(glowing(0x2f5a6a, 0.2), 0.5, 0.35, 0.4, tx + 0.3, 0.47, tz);
  } else if (kind === 'condo') { // a wall of letterboxes
    for (let row = 0; row < 4; row++) for (let col = 0; col < 8; col++) put(steel, 0.04, 0.3, 0.42, w / 2 - 0.42, 1.0 + row * 0.34, -1.6 + col * 0.46);
    put(new THREE.MeshBasicMaterial({ map: label('MAIL', null, '#16121c', '#f2f0e6', 128, 64) }), 0.04, 0.3, 0.8, w / 2 - 0.42, 2.6, 0);
  } else {                       // office: security gates before the lifts, and a directory of companies
    for (let g = 0; g < 3; g++) thing(steel, 0.25, 1.0, 1.3, w / 2 - 6.8 + g * 2.2, back + 3.4);
    put(new THREE.MeshBasicMaterial({ map: label('DIRECTORY', 'FLOORS 2 TO 30', '#16121c', css(spec.neon), 256, 128) }), 0.04, 1.2, 2.0, -w / 2 + 0.42, 2.2, back + 3);
  }
}

function build(scene, kit, spec, doors) {
  const far = spec.side === 'far', sign = far ? -1 : 1;
  const { x, w, d } = spec;
  const z = far ? FAR_EDGE + 5 + d / 2 : NEAR_EDGE - 5 - d / 2;
  const tower = new THREE.Group();
  tower.position.set(x, 0, z);
  tower.rotation.y = far ? Math.PI : 0; // built facing +Z, then turned to face the street

  const plain = (color, roughness = 0.7, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  const wall = plain(spec.wall, 0.85), accent = plain(spec.accent, 0.7), grey = plain(0x8f9396, 0.6);
  const neon = new THREE.MeshBasicMaterial({ color: spec.neon });
  const clear = new THREE.MeshStandardMaterial({ color: 0xbfe0e6, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.2, depthWrite: false });
  const skin = facade(spec.style, spec.wall, spec.glass);
  const add = (mesh, px, y, pz) => { mesh.position.set(px, y, pz); mesh.castShadow = true; tower.add(mesh); return mesh; };
  // Solid things are given in the building's own measurements and turned into map positions here.
  const solid = (lx, lz, bw, bd, height) => addObstacle(x + sign * lx - bw / 2, x + sign * lx + bw / 2, z + sign * lz - bd / 2, z + sign * lz + bd / 2, height);

  // --- Ground floor: a real room behind a glass front, with sliding doors in the middle ---
  block(tower, plain(0xb9b3a6, 1), w + 0.2, BASE, d + 0.2, 0, BASE / 2, 0);
  block(tower, wall, w, LOBBY, 0.3, 0, LOBBY / 2, -d / 2 + 0.15);
  block(tower, wall, 0.3, LOBBY, d, -w / 2 + 0.15, LOBBY / 2, 0);
  block(tower, wall, 0.3, LOBBY, d, w / 2 - 0.15, LOBBY / 2, 0);
  const frontZ = d / 2 - 0.15, glassHeight = LOBBY - 1.2, sideWidth = w / 2 - 1.7;
  for (const side of [-1, 1]) {
    const cx = side * (1.7 + sideWidth / 2);
    block(tower, clear, sideWidth, glassHeight, 0.06, cx, BASE + glassHeight / 2, frontZ);
    block(tower, accent, sideWidth, 0.25, 0.3, cx, BASE + 0.12, frontZ);                      // kick plate
    for (let px = 1.7; px <= w / 2 + 0.01; px += sideWidth / Math.max(1, Math.round(sideWidth / 3.2))) {
      block(tower, accent, 0.22, LOBBY, 0.34, side * Math.min(px, w / 2 - 0.11), LOBBY / 2, frontZ);     // pillars between the panes
    }
    solid(cx, frontZ, sideWidth, 0.3, LOBBY + 2);
  }
  block(tower, wall, w, 1.2, 0.3, 0, LOBBY - 0.6, frontZ);                                    // the wall above the glass
  solid(0, -d / 2 + 0.15, w, 0.3, LOBBY + 2);
  solid(-w / 2 + 0.15, 0, 0.3, d, LOBBY + 2);
  solid(w / 2 - 0.15, 0, 0.3, d, LOBBY + 2);
  const leaves = [-1, 1].map((side) => {
    const leaf = new THREE.Group();
    leaf.position.set(side * 0.85, 0, frontZ);
    block(leaf, clear, 1.7, glassHeight, 0.04, 0, BASE + glassHeight / 2, 0);
    for (const [bw, bh, px, y] of [[1.7, 0.08, 0, glassHeight - 0.04], [1.7, 0.1, 0, 0.05], [0.07, glassHeight, -0.815, glassHeight / 2], [0.07, glassHeight, 0.815, glassHeight / 2]]) block(leaf, grey, bw, bh, 0.06, px, BASE + y, 0);
    tower.add(leaf);
    return { leaf, side };
  });
  doors.push({ leaves, spot: new THREE.Vector3(x, 0, z + sign * frontZ), open: 0 });
  addFloor(x - w / 2 - 0.1, x + w / 2 + 0.1, z - d / 2 - 0.1, z + d / 2 + 0.1, BASE);
  addInterior(x - w / 2 + 0.3, x + w / 2 - 0.3, z - d / 2 + 0.3, z + d / 2 - 0.3, LOBBY - 0.15);
  furnishLobby(tower, spec, solid);

  // Canopy over the entrance, with the name and a line of neon.
  block(tower, accent, w * 0.5, 0.3, 3.2, 0, LOBBY - 1.0, d / 2 + 1.6);
  block(tower, neon, w * 0.5 + 0.1, 0.08, 0.08, 0, LOBBY - 0.82, d / 2 + 3.2);
  block(tower, new THREE.MeshBasicMaterial({ map: label(spec.name, null, '#16121c', css(spec.neon), 512, 96) }),
    Math.min(w * 0.6, 12), Math.min(w * 0.6, 12) * 0.19, 0.12, 0, LOBBY - 0.35, d / 2 + 0.1);
  block(tower, accent, w + 0.5, 0.3, d + 0.5, 0, LOBBY + 0.02, 0);

  // --- The storeys above, in one or more tiers that step in as they go up ---
  let y = LOBBY, tw = w, td = d;
  for (const tier of spec.tiers) {
    tw = w - tier.inset * 2; td = d - tier.inset * 2;
    const h = tier.floors * FLOOR;
    add(new THREE.Mesh(storeys(tw, tier.floors, td), skin), 0, y + h / 2, 0).receiveShadow = true;
    if (spec.style !== 'glass') { // corner piers and, on deco buildings, raised stripes up the front
      for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) block(tower, wall, 0.5, h, 0.5, cx * (tw / 2 - 0.1), y + h / 2, cz * (td / 2 - 0.1));
      if (spec.ledges) for (const px of [-tw / 4 - 0.5, -tw / 4, -tw / 4 + 0.5, tw / 4 - 0.5, tw / 4, tw / 4 + 0.5]) block(tower, accent, 0.16, h, 0.12, px, y + h / 2, td / 2 + 0.06);
    } else {                      // steel fins up the corners of glass towers
      for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) block(tower, grey, 0.3, h, 0.3, cx * tw / 2, y + h / 2, cz * td / 2);
    }
    for (let floor = 1; floor <= tier.floors; floor++) {
      const fy = y + floor * FLOOR;
      if (spec.ledges) block(tower, accent, tw + 0.9, 0.16, td + 0.9, 0, fy - 0.08, 0);        // art-deco "eyebrows"
      if (spec.balconies && floor < tier.floors) {
        block(tower, wall, tw * 0.84, 0.16, 1.5, 0, fy, td / 2 + 0.75);
        block(tower, plain(spec.balconies, 0.1, { transparent: true, opacity: 0.45 }), tw * 0.84, 1.0, 0.06, 0, fy + 0.58, td / 2 + 1.47);
        block(tower, grey, tw * 0.84, 0.05, 0.08, 0, fy + 1.1, td / 2 + 1.47);                   // handrail
        for (let px = -tw * 0.42; px <= tw * 0.42 + 0.01; px += tw * 0.84 / Math.round(tw * 0.84 / BAY / 2)) block(tower, wall, 0.12, FLOOR - 0.2, 1.4, px, fy + FLOOR / 2, td / 2 + 0.75); // dividers between flats
      }
    }
    y += h;
    block(tower, accent, tw + 0.5, 0.5, td + 0.5, 0, y + 0.25, 0); // parapet round the top of the tier
  }
  const top = y + 0.5;

  // Rooftop plant: air-conditioning units, a stair housing, and a water tank or aerial.
  if (!spec.helipad) {
    const rx = tw / 2 - 2.6, rz = -td / 2 + 2.4;
    block(tower, grey, 2.2, 1.3, 1.6, rx, top + 0.65, rz);
    block(tower, plain(0x3a3d42), 1.9, 0.08, 1.3, rx, top + 1.34, rz);
    block(tower, grey, 1.5, 1.1, 1.5, rx - 2.6, top + 0.55, rz);
    block(tower, wall, 2.4, 2.4, 2.8, -tw / 2 + 2.2, top + 1.2, rz + 0.2);
    block(tower, plain(0x3a3d42), 0.9, 1.9, 0.06, -tw / 2 + 2.2, top + 0.95, rz + 1.62);
    if (spec.style === 'deco') {
      for (const [lx, lz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) block(tower, grey, 0.1, 1.6, 0.1, rx - 5.5 + lx, top + 0.8, rz + lz);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.6, 14), plain(0x8a6a4a, 0.9)), rx - 5.5, top + 2.4, rz);
      add(new THREE.Mesh(new THREE.ConeGeometry(1.0, 0.6, 14), grey), rx - 5.5, top + 3.5, rz);
    } else if (!spec.spire) {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 6, 6), grey), rx - 5, top + 3, rz);
    }
  }

  // The details that make each one different.
  if (spec.corner) { // a rounded corner tower with dark bands of window
    const round = add(new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, top - LOBBY + 2, 24), wall), -w / 2 + 1.2, LOBBY + (top - LOBBY + 2) / 2, d / 2 - 1.2);
    round.receiveShadow = true;
    for (let fy = LOBBY + 1.2; fy < top; fy += FLOOR) add(new THREE.Mesh(new THREE.CylinderGeometry(3.45, 3.45, 1.4, 24), plain(0x1c2a33, 0.1, { metalness: 0.6 })), -w / 2 + 1.2, fy + 0.6, d / 2 - 1.2);
    add(new THREE.Mesh(new THREE.CylinderGeometry(3.7, 3.7, 0.3, 24), accent), -w / 2 + 1.2, top + 2.1, d / 2 - 1.2);
  }
  if (spec.fin) { // a tall fin up the front with the name in neon
    const finHeight = top - LOBBY + 6, signHeight = Math.min(finHeight - 2, spec.fin.length * 1.5);
    block(tower, accent, 1.5, finHeight, 2.8, 0, LOBBY + finHeight / 2, d / 2 + 0.9);
    block(tower, verticalSign(spec.fin, css(spec.neon)), 1.2, signHeight, 0.1, 0, LOBBY + finHeight - 1 - signHeight / 2, d / 2 + 2.32);
    for (const side of [-1, 1]) block(tower, neon, 0.08, finHeight - 0.4, 0.08, side * 0.78, LOBBY + finHeight / 2, d / 2 + 2.3);
  }
  if (spec.steps) { // a little ziggurat on the roof
    for (let i = 0; i < 3; i++) block(tower, i % 2 ? accent : wall, tw * (0.6 - i * 0.16), 1.3, td * (0.6 - i * 0.16), 0, top + 0.65 + i * 1.3, 0);
  }
  if (spec.roofSign) {
    block(tower, new THREE.MeshBasicMaterial({ map: label(spec.roofSign, null, '#16121c', css(spec.neon), 1024, 160) }), tw * 0.8, tw * 0.125, 0.3, 0, top + tw * 0.07 + 0.6, td / 2 - 0.6);
    for (const side of [-1, 1]) block(tower, plain(0x2a2a2e), 0.25, 1.2, 0.25, side * tw * 0.3, top + 0.4, td / 2 - 0.9);
  }
  if (spec.spire) {
    block(tower, accent, tw * 0.45, 3, td * 0.45, 0, top + 1.5, 0);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.5, spec.spire, 8), plain(0xd9dde0, 0.3, { metalness: 0.8 })), 0, top + 3 + spec.spire / 2, 0);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3030 })), 0, top + 3 + spec.spire, 0); // aircraft warning light
  }
  if (spec.crown) { // two tall blades framing the top
    for (const side of [-1, 1]) {
      block(tower, accent, 1.0, 9, td * 0.9, side * (tw / 2 - 0.5), top + 4.5, 0);
      block(tower, neon, 0.12, 9, 0.12, side * (tw / 2 - 0.5), top + 4.5, td * 0.45 + 0.06);
    }
    block(tower, neon, tw - 1, 0.14, 0.14, 0, top + 8.9, td * 0.45 + 0.06);
  }
  if (spec.penthouse) {
    block(tower, plain(0x1c2a33, 0.1, { metalness: 0.6 }), tw * 0.6, 3.2, td * 0.6, 0, top + 1.6, 0);
    block(tower, wall, tw * 0.7, 0.3, td * 0.7, 0, top + 3.35, 0);
  }
  if (spec.helipad) {
    const pad = add(new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 0.3, 28), plain(0x3a3d42, 0.9)), 0, top + 0.6, 0);
    pad.receiveShadow = true;
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), new THREE.MeshBasicMaterial({ map: label('H', null, '#3a3d42', '#f2f0e6', 128, 128) }));
    mark.rotation.x = -Math.PI / 2;
    add(mark, 0, top + 0.76, 0);
  }

  scene.add(tower);

  // On the pavement outside: palm trees, a street lamp, a bench, a planter and a bin.
  const kerbZ = far ? FAR_EDGE + 2.4 : NEAR_EDGE - 2.4;
  for (const side of [-1, 1]) {
    const px = x + side * (w / 2 - 1.5), height = 7 + Math.random() * 2.5;
    addPalm(scene, kit, px, kerbZ, height, (Math.random() - 0.5) * 2);
    addObstacle(px - 0.25, px + 0.25, kerbZ - 0.25, kerbZ + 0.25, height * 0.5);
  }
  const street = (material, bw, bh, bd, px, py, pz) => block(scene, material, bw, bh, bd, x + px, py, kerbZ + sign * pz);
  street(grey, 0.16, 5.5, 0.16, -w / 4, 2.75, -0.6);                                            // lamp post
  street(grey, 0.1, 0.1, 1.6, -w / 4, 5.45, -1.3);
  street(new THREE.MeshBasicMaterial({ color: 0xfff3cf }), 0.34, 0.12, 0.6, -w / 4, 5.36, -1.9);
  addObstacle(x - w / 4 - 0.15, x - w / 4 + 0.15, kerbZ - sign * 0.6 - 0.15, kerbZ - sign * 0.6 + 0.15, 5.6);
  street(plain(0x6b4a30, 0.7), 1.9, 0.08, 0.5, w / 5, 0.5, 0.4);                                // bench
  street(plain(0x6b4a30, 0.7), 1.9, 0.5, 0.06, w / 5, 0.8, 0.66);
  for (const side of [-0.8, 0.8]) street(grey, 0.08, 0.5, 0.45, w / 5 + side, 0.25, 0.4);
  addObstacle(x + w / 5 - 1, x + w / 5 + 1, kerbZ + sign * 0.4 - 0.35, kerbZ + sign * 0.4 + 0.35, 0.9);
  street(plain(0xc9c1b0, 0.9), 2.4, 0.6, 0.9, w / 5 + 3.4, 0.3, 0.3);                           // planter
  street(kit.hedge, 2.2, 0.5, 0.7, w / 5 + 3.4, 0.82, 0.3);
  addObstacle(x + w / 5 + 2.2, x + w / 5 + 4.6, kerbZ + sign * 0.3 - 0.45, kerbZ + sign * 0.3 + 0.45, 1.1);
  street(plain(0x2a2d30, 0.6), 0.5, 0.95, 0.5, -w / 4 + 1.2, 0.48, -0.5);                       // bin
  addObstacle(x - w / 4 + 0.95, x - w / 4 + 1.45, kerbZ - sign * 0.5 - 0.25, kerbZ - sign * 0.5 + 0.25, 1);
}

// Builds the city, starting at `startX` along the road.
export function createCity(scene, startX) {
  const kit = makeMaterials();
  const paving = new THREE.MeshStandardMaterial({ roughness: 1, map: canvasTexture(128, (ctx, s) => {
    ctx.fillStyle = '#c9c1b0';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, 2500, 0.05);
    ctx.strokeStyle = 'rgba(90,80,65,0.45)';
    ctx.strokeRect(0, 0, s, s);
  }, 80, 14) });
  const length = 270, middle = startX + length / 2 - 10;
  block(scene, paving, length, 0.05, 46, middle, 0.025, NEAR_EDGE - 23).castShadow = false;
  block(scene, paving, length, 0.05, 46, middle, 0.025, FAR_EDGE + 23).castShadow = false;
  clearings[41].set(middle - length / 2, NEAR_EDGE - 46.2, middle + length / 2, FAR_EDGE + 46.2);

  // The welcome sign as you drive in.
  for (const pz of [-12.2, -17.8]) { block(scene, kit.metal, 0.3, 5.2, 0.3, startX - 22, 2.6, pz); addObstacle(startX - 22.2, startX - 21.8, pz - 0.2, pz + 0.2, 5.5); }
  block(scene, new THREE.MeshBasicMaterial({ map: label('WELCOME TO PALM CITY', 'THE SUNSHINE CAPITAL', '#f2659a', '#fff8e8', 1024, 256) }), 0.2, 2.2, 7.4, startX - 22, 4.3, -15);

  const X = (i) => startX + 10 + i * 52; // five plots down each side of the street
  const buildings = [
    // Far side of the street.
    { side: 'far', x: X(0), w: 30, d: 18, style: 'deco', kind: 'hotel', wall: 0xf4a6b8, accent: 0x8fe0cf, glass: '#2d4a55', neon: 0xff4f9a, name: 'THE FLAMINGO',
      tiers: [{ floors: 5, inset: 0 }], ledges: true, fin: 'FLAMINGO', steps: true },
    { side: 'far', x: X(1), w: 24, d: 24, style: 'glass', kind: 'office', wall: 0x2f6f86, accent: 0xd9eef0, glass: '#3fa7b5', neon: 0x5fe8ff, name: 'BAYFRONT ONE',
      tiers: [{ floors: 18, inset: 0 }, { floors: 8, inset: 3 }], spire: 14 },
    { side: 'far', x: X(2), w: 24, d: 17, style: 'deco', kind: 'hotel', wall: 0xf7dc7a, accent: 0x38b6c4, glass: '#2d4a55', neon: 0x38e0f0, name: 'HOTEL TROPIC',
      tiers: [{ floors: 5, inset: 0 }, { floors: 2, inset: 2.5 }], ledges: true, fin: 'TROPIC', steps: true },
    { side: 'far', x: X(3), w: 34, d: 17, style: 'condo', kind: 'condo', wall: 0xf7c9a8, accent: 0xf2f0ea, glass: '#3a5f6e', neon: 0xff8a5a, name: 'CORAL SANDS',
      tiers: [{ floors: 14, inset: 0 }], balconies: 0xff9a8a, penthouse: true, roofSign: 'CORAL SANDS' },
    { side: 'far', x: X(4), w: 28, d: 22, style: 'glass', kind: 'bank', wall: 0x1c2f52, accent: 0xc9ccd0, glass: '#27477a', neon: 0xffd23a, name: 'PALM CITY BANK',
      tiers: [{ floors: 22, inset: 0 }], helipad: true, roofSign: 'PALM CITY BANK' },
    // Near side.
    { side: 'near', x: X(0), w: 30, d: 18, style: 'deco', kind: 'hotel', wall: 0xa8e6cf, accent: 0xf7e08a, glass: '#2d4a55', neon: 0xffe14f, name: 'OCEAN BREEZE HOTEL',
      tiers: [{ floors: 4, inset: 0 }], ledges: true, corner: true, roofSign: 'OCEAN BREEZE' },
    { side: 'near', x: X(1), w: 26, d: 19, style: 'condo', kind: 'condo', wall: 0xf6f4ee, accent: 0x49c5d6, glass: '#35596b', neon: 0x49e5ff, name: 'AQUA TOWER',
      tiers: [{ floors: 18, inset: 0 }], balconies: 0x7fe0f0, penthouse: true },
    { side: 'near', x: X(2), w: 22, d: 22, style: 'glass', kind: 'office', wall: 0x7a4a52, accent: 0xf2c9a0, glass: '#b5746a', neon: 0xff7ad0, name: 'SUNSET PLAZA',
      tiers: [{ floors: 20, inset: 0 }, { floors: 12, inset: 2.5 }], crown: true },
    { side: 'near', x: X(3), w: 26, d: 17, style: 'deco', kind: 'club', wall: 0xc9b4f0, accent: 0xff8ac4, glass: '#2d2a4a', neon: 0xff3fd0, name: 'CLUB NEON',
      tiers: [{ floors: 6, inset: 0 }], ledges: true, fin: 'NEON', corner: true },
    { side: 'near', x: X(4), w: 32, d: 22, style: 'condo', kind: 'hotel', wall: 0xfdfbf5, accent: 0x2fb3a8, glass: '#2f5560', neon: 0x3ff0d8, name: 'MIRAMAR SUITES',
      tiers: [{ floors: 4, inset: 0 }, { floors: 3, inset: 3 }, { floors: 3, inset: 6 }], ledges: true, steps: true, roofSign: 'MIRAMAR' },
  ];
  const doors = [];
  for (const spec of buildings) build(scene, kit, spec, doors);
  return { doors };
}

// Each frame: a building's glass doors slide apart when the player walks up.
export function updateCity(city, playerPosition, dt) {
  for (const door of city.doors) {
    const near = Math.abs(playerPosition.x - door.spot.x) < 3.2 && Math.abs(playerPosition.z - door.spot.z) < 3.2;
    door.open += ((near ? 1 : 0) - door.open) * Math.min(1, 6 * dt);
    for (const { leaf, side } of door.leaves) leaf.position.x = side * (0.85 + 1.6 * door.open);
  }
}
