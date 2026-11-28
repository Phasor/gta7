// The map. A small one sits in the corner of the screen, centred on the player.
// M opens the big one: Palm Ave on top, Miami and the beach underneath, with
// every place named. East (toward the sea) is to the right.

// Places worth marking: [x, z, name, colour, letter for the small map].
const PLACES = [
  [702, -23, 'HOME · Aqua Tower', '#49e5ff', 'H'],
  [416, 96, 'Airport · tickets · planes', '#dfeaff', 'A'],
  [-20, 70, 'Palm Ave airfield', '#dfeaff', 'A'],
  [777.5, 12, 'Gator Bank', '#3fb04a', '$'],
  [546, 16, 'Lucky Palm Casino', '#ffd23a', 'C'],
  [494, 15, 'Hospital · doctor', '#ff5a4a', '+'],
  [830.5, -21.5, 'Fight Club', '#e0352b', 'F'],
  [624, 41, 'Cold Ones beer', '#e0a82a', 'B'],
  [643, -44, 'Sharp Cuts barber', '#c9b4f0', 'S'],
  [606, -44, 'Fix-It Garage', '#ff8a3a', 'G'],
  [624, -68, 'Miami Police', '#5f8fff', 'P'],
  [945, -34, 'Lifeguard', '#ff5a4a', 'L'],
  [1000, 70, 'Pier · boats · jet skis', '#d9b24a', 'J'],
  [927, 67, 'Fish stall', '#8fd0c0', 'f'],
  [24, -24, "Sunny's Mart", '#e0483a', 'M'],
  [3, -24, 'Old house', '#c9c1b0', 'o'],
  [54, -19, 'Gas station', '#f2c230', 'g'],
  [54, 11, "Big Al's Guns", '#b9783a', 'A'],
  [73, -20, 'Gym', '#8fb04a', 'Y'],
  [112, -23, 'Palm Ave Police', '#5f8fff', 'P'],
  [-178, -98, 'Lake · boats', '#4f9ad0', 'K'],
  [-86, 17, 'Vipers gang', '#d9281e', '!'],
  [729, -27, 'Sharks gang', '#2f6fe0', '!'],
];
// The towers along the main road in Miami: twenty plots, 52 m apart.
const TOWERS = [];
for (let i = -5; i <= 4; i++) for (const far of [true, false]) TOWERS.push([650 + i * 52, far ? 15 : -23]);

function drawWorld(ctx, toX, toY, scale, labels, from = -1e9, to = 1e9) {
  const box = (x0, z0, x1, z1, colour) => { ctx.fillStyle = colour; ctx.fillRect(toX(x0), toY(z0), (x1 - x0) * scale, (z1 - z0) * scale); };
  box(-2000, -2000, 3000, 2000, '#6f8a4a');                    // grass
  box(360, -55, 900, 46, '#b9b3a6');                           // Miami's paving
  box(922, -400, 962, 400, '#e9d6a4');                         // the beach
  box(962, -2000, 3000, 2000, '#3f9ab5');                      // the sea
  ctx.fillStyle = '#4f8a9a';                                   // the lake
  ctx.beginPath(); ctx.arc(toX(-178), toY(-98), 76 * scale, 0, Math.PI * 2); ctx.fill();
  box(-950, -9, 950, 0, '#c4beb0');                            // the main road and its pavements
  box(-950, -7.5, 950, -1.5, '#4a4a48');
  box(619.5, -55, 628.5, 34, '#c4beb0');                       // Brew St
  box(621, -55, 627, 34, '#4a4a48');
  box(950, 68, 1037, 72, '#8a6240');                           // the pier
  box(-145, 61, 105, 95, '#7a9a52'); box(-135, 75, 95, 89, '#4a4a48'); // Jamaica and the Palm Ave airfield
  box(200, 84, 800, 192, '#7a9a52'); box(200, 160, 800, 190, '#3f4042'); box(360, 104, 560, 150, '#b3aea2'); box(398, 88, 434, 104, '#e9edf0'); box(412.5, 0, 419.5, 88, '#4a4a48'); // the airport: field, runway, apron, terminal, road
  ctx.fillStyle = '#8f8a80';
  for (const [x, z] of TOWERS) ctx.fillRect(toX(x - 13), toY(z - 9), 26 * scale, 18 * scale);
  for (let x = -260; x <= 190; x += 30) for (const z of [-24, 14]) { if (Math.abs(x) < 20 && z < 0) continue; ctx.fillRect(toX(x - 5), toY(z - 4), 10 * scale, 8 * scale); } // houses on Palm Ave
  ctx.textBaseline = 'middle';
  PLACES.forEach(([x, z, name, colour, letter], i) => {
    if (x < from || x > to) return; // not on this strip of the map
    const px = toX(x), py = toY(z), r = labels ? 7 : 7;
    ctx.fillStyle = '#16181c';
    ctx.beginPath(); ctx.arc(px, py, r + 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = colour;
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#16181c';
    ctx.font = `bold ${labels ? 9 : 10}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(letter, px, py + 0.5);
    if (!labels) return;
    // The name beside it, on a dark strip so it can be read over anything. Alternate above and below so neighbours don't collide.
    ctx.font = 'bold 13px system-ui, sans-serif';
    const wide = ctx.measureText(name).width + 8, ly = py + (z < -4.5 ? -1 : 1) * (17 + (i % 2) * 15), lx = Math.max(toX(from) + wide / 2 + 2, Math.min(toX(to) - wide / 2 - 2, px));
    ctx.fillStyle = 'rgba(20,22,28,0.82)';
    ctx.fillRect(lx - wide / 2, ly - 9, wide, 18);
    ctx.fillStyle = colour;
    ctx.fillText(name, lx, ly + 0.5);
  });
}
function drawExtras(ctx, toX, toY, state, big) {
  for (const mark of state.marks || []) { // things that move or come and go: his truck, people to find
    const px = toX(mark.x), py = toY(mark.z);
    ctx.fillStyle = '#16181c';
    ctx.fillRect(px - 6, py - 6, 12, 12);
    ctx.fillStyle = mark.colour;
    ctx.fillRect(px - 4.5, py - 4.5, 9, 9);
    if (big && mark.name) { ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#16181c'; ctx.lineWidth = 3; ctx.strokeText(mark.name, px + 9, py); ctx.fillText(mark.name, px + 9, py); }
  }
  // Him: a white arrow pointing the way he faces.
  ctx.save();
  ctx.translate(toX(state.x), toY(state.z));
  ctx.rotate(Math.atan2(Math.cos(state.heading), Math.sin(state.heading)));
  ctx.fillStyle = '#16181c';
  ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(-8, 8); ctx.lineTo(-4, 0); ctx.lineTo(-8, -8); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(8.5, 0); ctx.lineTo(-6, 5.5); ctx.lineTo(-2.5, 0); ctx.lineTo(-6, -5.5); ctx.fill();
  ctx.restore();
}

export function createMap() {
  const mini = document.createElement('canvas');
  mini.width = mini.height = 190;
  mini.style.cssText = 'position:fixed;right:18px;top:96px;width:190px;height:190px;border-radius:10px;border:2px solid rgba(243,230,192,0.85);box-shadow:0 2px 8px rgba(0,0,0,0.5);pointer-events:none';
  const hintLine = document.createElement('div');
  hintLine.textContent = 'M: big map';
  hintLine.style.cssText = 'position:fixed;right:18px;top:292px;width:194px;text-align:center;font:12px system-ui,sans-serif;color:#f3e9d2;background:rgba(40,30,20,0.6);border-radius:6px;padding:2px 0;pointer-events:none';
  const panel = document.createElement('div');
  panel.style.cssText = 'display:none;position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:rgba(20,24,18,0.96);border:2px solid #f3e6c0;border-radius:12px;padding:12px 14px;z-index:8;pointer-events:none;font:14px system-ui,sans-serif;color:#f3e9d2;width:min(1090px,94vw);box-sizing:border-box';
  panel.innerHTML = '<div style="font-size:20px;font-weight:bold">Map</div><div style="opacity:0.8;margin-bottom:6px">The white arrow is you. Palm Ave is on top, Miami and the beach below; the same road joins them, about half a minute apart by car. M to close.<br>Jamaica is far out to sea, off the right-hand edge: buy a ticket at the airport to get there.</div>';
  const big = document.createElement('canvas');
  big.width = 1060;
  big.height = 700;
  big.style.cssText = 'display:block;max-width:100%;max-height:78vh;margin:0 auto;border-radius:6px';
  panel.appendChild(big);
  document.body.append(panel); // (no map in the corner: it only shows when M is pressed)
  return { mini, big, panel, open: false, tick: 0 };
}

export function toggleMap(map) {
  map.open = !map.open;
  map.panel.style.display = map.open ? 'block' : 'none';
  map.tick = 0;
}

// state: { x, z, heading, marks: [{ x, z, colour, name }] }
export function updateMap(map, state) {
  if (!map.open || map.tick++ % 3) return; // only drawn while it is open, a few times a second
  // The small map: 150 m across, centred on him.
  const ctx = map.mini.getContext('2d'), scale = 190 / 150;
  drawWorld(ctx, (x) => (x - state.x) * scale + 95, (z) => (z - state.z) * scale + 95, scale, false);
  drawExtras(ctx, (x) => (x - state.x) * scale + 95, (z) => (z - state.z) * scale + 95, state, false);
  if (!map.open) return;
  // The big map: two strips, each drawn to its own scale.
  const pen = map.big.getContext('2d');
  pen.fillStyle = '#16181c';
  pen.fillRect(0, 0, 1060, 700);
  for (const [title, x0, x1, z0, z1, top, height] of [['PALM AVE', -330, 225, -185, 100, 0, 290], ['MIAMI, THE AIRPORT AND THE BEACH', 190, 1085, -100, 200, 306, 394]]) {
    const s = Math.min(1060 / (x1 - x0), height / (z1 - z0)), left = (1060 - (x1 - x0) * s) / 2, toX = (x) => left + (x - x0) * s, toY = (z) => top + (z - z0) * s;
    pen.save();
    pen.beginPath(); pen.rect(left, top, (x1 - x0) * s, height); pen.clip();
    drawWorld(pen, toX, toY, s, true, x0, x1);
    drawExtras(pen, toX, toY, state, true);
    pen.restore();
    pen.font = 'bold 15px system-ui, sans-serif';
    pen.textAlign = 'left';
    pen.fillStyle = 'rgba(20,22,28,0.85)';
    pen.fillRect(6, top + 6, pen.measureText(title).width + 14, 22);
    pen.fillStyle = '#f3e6c0';
    pen.fillText(title, 13, top + 18);
  }
}
