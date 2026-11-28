import * as THREE from 'three';
import { createPlayer, updatePlayer, crouchDrop, knockDown, sitPlayer, SIT_DROP, HIP_HEIGHT } from './player.js';
import { PALETTE, createSky, createComposer } from './look.js';
import { createGrass, updateGrass, daylight } from './grass.js';
import { addDirt } from './terrain.js';
import { createHouse, updateHouse, toggleFridge, nearFridge, swayPalms, nearPalm } from './house.js';
import { createIguanas, updateIguanas, findIguanaHit, killIguana, collectIguana } from './iguana.js';
import { createStore, updateStore } from './store.js';
import { createBeerShop, updateBeerShop } from './beershop.js';
import { createRoad } from './road.js';
import { createGasStation, updateGasStation } from './gasstation.js';
import { createNeighbourhood } from './neighbourhood.js';
import { createGunShop, updateGunShop } from './gunshop.js';
import { createCity, updateCity, WHEEL, REDS } from './city.js';
import { sfx, updateSound } from './sound.js';
import { createSea, updateSea, updateJetSkis, jetSkiNear, seaLanding, fishingBoatNear, castOff, leaveFishingBoat, updateFishingBoat, climbAboardSpot, onBoat } from './sea.js';
import { createTurfs, updateTurfs } from './gangs.js';
import { makeFish, rollCatch, createFishStall, SHOW_LENGTH } from './fishing.js';
import { createPoliceStation, updatePoliceStation } from './policestation.js';
import { createMiamiPD } from './miamipd.js';
import { createBoxingRing, FIGHTERS } from './boxing.js';
import { createGym, updateGym, stationNear, TRAINING } from './gym.js';
import { createLake, updateLake, boatNear, landingSpot, SEAT } from './lake.js';
import { createAlligators, updateAlligators } from './alligator.js';
import { createTruck, updateTruck, setEngine } from './truck.js';
import { createCars } from './cars.js';
import { createSeaLife, updateSeaLife } from './sealife.js';
import { createBank, setVaultDoor, VAULT_PEOPLE, portrait } from './bank.js';
import { createDogs, updateDogs, findDogHit, dogNear, hurtDog, patDog } from './dogs.js';
import { createTraffic, updateTraffic, createIslandTraffic, updateIslandTraffic } from './traffic.js';
import { createMap, updateMap, toggleMap } from './map.js';
import { createAirport, updateAirport, updatePlane, resetPlane } from './airport.js';
import { createCuba } from './cuba.js';
import { createMechanic, createBarber, HAIRCUTS, makeHair, makeHat } from './brewst.js';
import { rayToObstacle, ceilingAt, roomLimit, waterDepthAt, seaBedAt, terrainAt, wind } from './world.js';
import { createGun, updateGun, fireGun, createDisplayGun, setWeapon, emitSmoke, emitBloodMist } from './gun.js';
import { createNpcs, updateNpcs, findNpcHit, hitNpc, provokeNpc, playStrike, findGrab, neckSpot, strangle, CHOKE_TIME, floorNpc, reviveNpc, speeches, speak, findListener, replyTo, armNpc, pickMugger, dismissNpc, debug as npcDebug } from './npc.js';

const MAP_SIZE = 2800;    // playable area, metres along each side (big enough to reach the city)
const GROUND_SIZE = 3200; // the grass carries on past the edge so the horizon looks endless

// --- Renderer ---------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: false }); // the composer smooths edges instead
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// --- Scene ------------------------------------------------------------------
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(PALETTE.skyHorizon, 260, 1500); // distance fades into the horizon haze, but the city skyline still shows

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
scene.add(camera); // so that things held up in front of the camera (a fish he has caught) are drawn

// --- Light ------------------------------------------------------------------
const skyLight = new THREE.HemisphereLight(PALETTE.shade, PALETTE.bounce, 1.7);
scene.add(skyLight);

// The sun's shadow area is small and follows the player, so shadows stay sharp.
const SUN_OFFSET = new THREE.Vector3(-26, 38, 30); // afternoon sun behind the starting view, long shadows
const sun = new THREE.DirectionalLight(PALETTE.sunLight, 3.0);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -30;
sun.shadow.camera.right = 30;
sun.shadow.camera.top = 30;
sun.shadow.camera.bottom = -30;
sun.shadow.camera.far = 150;
scene.add(sun, sun.target);

const sky = createSky(SUN_OFFSET);
scene.add(sky);

// --- Grass ground -----------------------------------------------------------
// The texture is painted in code so the game needs no downloaded assets.
function makeGrassTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(0, 0, size, size);

  // Thousands of short strokes in mixed greens read as blades of grass.
  const blades = PALETTE.grassBlades;
  for (let i = 0; i < 6000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.strokeStyle = blades[(Math.random() * blades.length) | 0];
    ctx.globalAlpha = 0.5 + Math.random() * 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 3, y - 2 - Math.random() * 4);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(GROUND_SIZE / 6, GROUND_SIZE / 6);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE),
  addDirt(new THREE.MeshStandardMaterial({ map: makeGrassTexture(), roughness: 1 }))
);
ground.rotation.x = -Math.PI / 2;
// The ground stops at the water's edge (x = 962): beyond that is the sea, with its own sandy bottom far below.
ground.scale.x = (GROUND_SIZE / 2 + 962) / GROUND_SIZE;
ground.position.x = (962 - GROUND_SIZE / 2) / 2;
ground.receiveShadow = true;
scene.add(ground);

const grass = createGrass(SUN_OFFSET, scene.fog);
scene.add(grass);

// The player's house, just ahead of where the game starts.
const house = createHouse(scene, 3, -24);
const usePrompt = document.getElementById('prompt');

// The corner shop, next door to the house.
const store = createStore(scene, 24, -24);

// The street running past both, with the game starting on its far pavement.
createRoad(scene, -9, 24, -15.2);

// The petrol station, further along the street past the shop.
const gasStation = createGasStation(scene, 54, -19);

// Ten more houses along the street, all different.
createNeighbourhood(scene);

// Miami: ten buildings about half a minute's drive along the road.
const city = createCity(scene, 640);

// Cold Ones, the beer shop at the top of Brew St, the new street that crosses the main one.
const beerShop = createBeerShop(scene, 624, 41);

// The sea and its beach, past the far end of the city.
const seaParts = createSea(scene, 962, scene.fog, SUN_OFFSET);
// Fish, sharks, jellyfish and turtles in it, and rocks, coral and seaweed on the bottom.
const seaLife = createSeaLife(scene, 962);
// The sea is a mirror: the sky and the lights have to be marked as things it shows (the player is marked once he has loaded).
for (const part of [sky, skyLight, sun]) part.layers.enable(1);

// The two gangs' corners: the Vipers on Palm Ave and the Sharks in Miami.
createTurfs(scene);

// The gun shop, across the road from the petrol station.
const gunShop = createGunShop(scene, 54, 11, 0);

// The police station, at the far end of the street past the gym.
const policeStation = createPoliceStation(scene, 112, -23, -9);

// Miami's own police station, two storeys, at the bottom end of Brew St. The cells are upstairs.
const miamiPD = createMiamiPD(scene, 624, -68.2, -55);

// Gator Bank, in the gap between Hotel Tropic and Coral Sands on the far side of the main road.
const gatorBank = createBank(scene, 777.5, 12);

// Dogs: friendly ones about the streets, and guard dogs by the things they guard.
const dogs = createDogs(scene);

// --- Money and shopping ---------------------------------------------------------
// The money is called Gator Bucks (G$). He starts with some, earns wages from the
// cash machine in Sunny's Mart, and spends it at Big Al's. Progress is remembered.
const WEAPONS = {
  pistol: { name: 'Handgun', price: 400, blurb: 'Three shots to drop someone' },
  shotgun: { name: 'Pump shotgun', price: 900, blurb: 'One shot, but only up close' },
  rifle: { name: 'Hunting rifle', price: 1200, blurb: 'One shot at any distance, slow to fire' },
};
const saved = (() => { try { return JSON.parse(localStorage.getItem('gta7-save')) || {}; } catch { return {}; } })();
let money = saved.money ?? 1500;   // the cash in his pocket: he loses it if he dies
let jmoney = saved.jmoney ?? 0; // Jamaican dollars in his pocket, for spending on the island
let bank = saved.bank ?? 0;       // what he has paid in at a cash machine: that is safe
const owned = new Set(saved.owned || []);
if (new URLSearchParams(location.search).has('gun')) owned.add('pistol'); // test views start armed
owned.add('camo'); // his own special rifle: nobody sells it and nobody else has one. Press 7 to carry it.
const persist = () => { try { localStorage.setItem('gta7-save', JSON.stringify({ money, bank, jmoney, owned: [...owned], weapon: gun.kind, bag, stats, clock: hourNow, day, arrests, compDay, job, hair: hairKey, friends, ill, runs: runsDone, training })); } catch { /* no storage */ } };

const overlay = (css) => { const el = document.createElement('div'); el.style.cssText = `position:fixed;pointer-events:none;font-family:system-ui,sans-serif;${css}`; document.body.appendChild(el); return el; };
const moneyEl = overlay('right:18px;top:14px;font-weight:bold;font-size:24px;color:#d8f0c0;background:rgba(30,45,25,0.7);padding:6px 14px;border-radius:8px');
const toastEl = overlay('display:none;left:50%;top:14%;transform:translateX(-50%);font-size:18px;color:#f3e9d2;background:rgba(40,30,20,0.85);padding:10px 18px;border-radius:8px;max-width:80%;text-align:center');
const shopEl = overlay('display:none;left:50%;top:50%;transform:translate(-50%,-50%);font-size:17px;color:#f3e9d2;background:rgba(28,34,22,0.94);padding:18px 26px;border-radius:12px;border:2px solid #f3e6c0;min-width:420px');
const showMoney = () => (moneyEl.innerHTML = `G$ ${money.toLocaleString('en-US')}<span style="font-size:14px;font-weight:normal;opacity:0.85"> &nbsp;cash &nbsp;·&nbsp; bank G$ ${bank.toLocaleString('en-US')}${jmoney ? ` &nbsp;·&nbsp; J$ ${Math.round(jmoney).toLocaleString('en-US')}` : ''}</span>`);
showMoney();
let toastTimer = 0;
function toast(text) {
  toastEl.textContent = text;
  toastEl.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastEl.style.display = 'none'), 4000);
}

let shopOpen = false;
function drawShop() {
  const rows = Object.entries(WEAPONS).map(([kind, item], i) =>
    `<div style="display:flex;gap:14px;padding:7px 0;border-top:1px solid rgba(243,230,192,0.25)">
       <b style="width:26px">${i + 1}</b><span style="flex:1"><b>${item.name}</b><br><small>${item.blurb}</small></span>
       <b>${owned.has(kind) ? 'OWNED' : gun.equipped ? 'FREE' : `G$ ${item.price.toLocaleString('en-US')}`}</b></div>`).join('');
  shopEl.innerHTML = `<div style="font-size:22px;font-weight:bold;margin-bottom:4px">Big Al's Guns</div>
    <div style="margin-bottom:10px">"What'll it be?" &nbsp;·&nbsp; You have <b>G$ ${money.toLocaleString('en-US')}</b></div>${rows}
    <div style="display:flex;gap:14px;padding:7px 0;border-top:1px solid rgba(243,230,192,0.25)">
       <b style="width:26px">4</b><span style="flex:1"><b>Sell iguanas</b><br><small>G$ ${IGUANA_PRICE} each. You are carrying ${bag.iguanas}</small></span>
       <b>${bag.iguanas ? `+ G$ ${bag.iguanas * IGUANA_PRICE}` : ''}</b></div>
    <div style="display:flex;gap:14px;padding:7px 0;border-top:1px solid rgba(243,230,192,0.25)">
       <b style="width:26px">5</b><span style="flex:1"><b>Combat knife</b><br><small>Press K to draw it, left mouse to stab. Quiet, and two stabs will do it</small></span>
       <b>${bag.knife ? 'OWNED' : gun.equipped ? 'FREE' : `G$ ${KNIFE_PRICE}`}</b></div>
    <div style="margin-top:12px;opacity:0.8">Press 1, 2, 3 or 5 to buy &nbsp;·&nbsp; 4 to sell &nbsp;·&nbsp; E to leave</div>`;
}
const KNIFE_PRICE = 150;
function buyKnife() {
  if (bag.knife) return toast('You already own a knife. Press K to draw it.');
  const free = gun.equipped;
  if (!free && money < KNIFE_PRICE) return sfx('error'), toast(`Not enough Gator Bucks: the knife costs G$ ${KNIFE_PRICE}.`);
  if (!free) money -= KNIFE_PRICE;
  bag.knife = 1;
  sfx('buy');
  toast(free ? 'Big Al slides the knife across the counter for nothing. Press K to draw it.' : `You pay Big Al G$ ${KNIFE_PRICE} for the knife. Press K to draw it.`);
  showMoney(); showBag(); persist(); drawShop();
}
function setShop(open) {
  shopOpen = open;
  shopEl.style.display = open ? 'block' : 'none';
  if (open) drawShop();
}
function buy(kind) {
  const item = WEAPONS[kind];
  if (owned.has(kind)) {
    toast(`You already own the ${item.name.toLowerCase()}. Press ${Object.keys(WEAPONS).indexOf(kind) + 1} any time to carry it.`);
  } else if (!gun.equipped && money < item.price) {
    sfx('error');
    toast(`Not enough Gator Bucks: the ${item.name.toLowerCase()} costs G$ ${item.price.toLocaleString('en-US')}.`);
    return;
  } else {
    sfx('buy');
    if (!gun.equipped) money -= item.price;
    owned.add(kind);
    toast(gun.equipped ? `Big Al looks at your gun, puts his hands up, and slides the ${item.name.toLowerCase()} across for nothing.`
      : `You pay Big Al G$ ${item.price.toLocaleString('en-US')} and he hands you the ${item.name.toLowerCase()}.`);
  }
  setWeapon(gun, kind);
  gun.equipped = true;
  showMoney();
  persist();
  drawShop();
}

// --- Sunny's Mart: lighters, cigarettes, beer and snacks ---
const MART = [
  { key: 'lighter', name: 'Lighter', price: 3, amount: 1, limit: 1, blurb: 'You need one to light a cigarette' },
  { key: 'cigarettes', name: 'Pack of cigarettes', price: 12, amount: 20, blurb: '20 in a pack. Press 4 to smoke one' },
  { key: 'beer', name: 'Bottle of beer', price: 4, amount: 1, blurb: 'Press 5 to drink one. Makes you wobbly' },
  { key: 'snacks', name: 'Bag of snacks', price: 2, amount: 1, blurb: 'Press 6 to eat one. Run faster for 30 seconds' },
];
// Cold Ones in Miami only sells beer, but it is cheaper there and comes by the pack and the crate.
const BEERS = [
  { key: 'beer', name: 'Bottle of beer', price: 3, amount: 1, blurb: 'Press 5 to drink one. Makes you wobbly' },
  { key: 'beer', name: 'Six-pack', price: 15, amount: 6, blurb: 'Six bottles' },
  { key: 'beer', name: 'Crate of beer', price: 50, amount: 24, blurb: '24 bottles. Enough for a party' },
];
const TILLS = { mart: { title: "Sunny's Mart", greeting: 'Anything else?', items: MART }, beer: { title: 'Cold Ones Beer Shop', greeting: 'What are you drinking?', items: BEERS } };
let till = TILLS.mart; // the shop whose counter he is at
const bag = Object.assign({ lighter: 0, cigarettes: 0, beer: 0, snacks: 0, spray: 0, crate: 0 }, saved.bag);
const bagEl = overlay('right:18px;top:58px;font-size:15px;color:#f3e9d2;background:rgba(40,30,20,0.65);padding:5px 12px;border-radius:8px');
function showBag() {
  const parts = [];
  if (bag.crate) parts.push('CRATE OF CIGARETTES (for Benny)');
  if (bag.knife) parts.push('Knife');
  if (bag.spray) parts.push(`Bug spray ×${bag.spray}`);
  if (bag.lighter) parts.push('Lighter');
  if (bag.cigarettes) parts.push(`${bag.cigarettes} cigarette${bag.cigarettes > 1 ? 's' : ''}`);
  if (bag.beer) parts.push(`${bag.beer} beer${bag.beer > 1 ? 's' : ''}`);
  if (bag.snacks) parts.push(`${bag.snacks} snack${bag.snacks > 1 ? 's' : ''}`);
  if (bag.fish?.length) parts.push(`${bag.fish.length} fish`);
  if (bag.iguanas) parts.push(`${bag.iguanas} iguana${bag.iguanas > 1 ? 's' : ''}`);
  bagEl.textContent = parts.join(' · ');
  bagEl.style.display = parts.length ? 'block' : 'none';
}
showBag();

let martOpen = false;
function drawMart() {
  const cost = (price) => (till.jm ? jd(price) : `G$ ${price}`);
  const rows = till.items.map((item, i) =>
    `<div style="display:flex;gap:14px;padding:7px 0;border-top:1px solid rgba(243,230,192,0.25)">
       <b style="width:26px">${i + 1}</b><span style="flex:1"><b>${item.name}</b><br><small>${item.blurb}</small></span>
       <b>${item.limit && bag[item.key] >= item.limit ? 'GOT ONE' : gun.equipped ? 'FREE' : cost(item.price)}</b></div>`).join('');
  shopEl.innerHTML = `<div style="font-size:22px;font-weight:bold;margin-bottom:4px">${till.title}</div>
    <div style="margin-bottom:10px">"${till.greeting}" &nbsp;·&nbsp; You have <b>${till.jm ? jd(jmoney) : gs(money)}</b></div>${rows}
    <div style="margin-top:12px;opacity:0.8">Press 1 to ${till.items.length} to buy &nbsp;·&nbsp; E to leave${till.jm ? '<br><small>Jamaican dollars only. The cash machine on Main Street changes money.</small>' : ''}</div>`;
}
function setMart(open) {
  martOpen = !!open;
  if (open) till = TILLS[open] || till;
  shopEl.style.display = open ? 'block' : 'none';
  if (open) drawMart();
}
function buyMart(index) {
  const item = till.items[index];
  if (!item) return;
  if (item.limit && bag[item.key] >= item.limit) return toast(`You already have a ${item.name.toLowerCase()}.`);
  const free = gun.equipped; // with a gun in your hand, everything is on the house
  const cost = till.jm ? jd(item.price) : `G$ ${item.price}`;
  if (!free && (till.jm ? jmoney : money) < item.price) return sfx('error'), toast(till.jm ? `That is ${cost}, and you have ${jd(jmoney)}. The cash machine on Main Street changes Gator Bucks.` : `Not enough Gator Bucks: that costs ${cost}.`);
  sfx('buy');
  if (!free) { if (till.jm) jmoney -= item.price; else money -= item.price; }
  if (item.use) item.use(); else bag[item.key] += item.amount;
  if (!item.use) toast(free ? `"Take it! It's free, just don't shoot!" The cashier hands you the ${item.name.toLowerCase()}.` : `You pay ${cost} and the cashier hands you the ${item.name.toLowerCase()}.`);
  showMoney(); showBag(); persist(); drawMart();
}

// Using what he bought.
let smoking = 0, tipsy = 0, energy = 0;
let smokeDrag = false; // true while the cigarette is at his mouth
const puffSpot = new THREE.Vector3();
// The cigarette in his left hand: white paper, a tan filter and a glowing end.
const cigarette = new THREE.Group();
for (const [colour, length, at, glow] of [[0xf4f1e8, 0.05, 0, false], [0xc98a4a, 0.02, -0.035, false], [0xff5a1e, 0.006, 0.028, true]]) {
  const piece = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, length * 1.3, 8),
    glow ? new THREE.MeshBasicMaterial({ color: colour }) : new THREE.MeshStandardMaterial({ color: colour, roughness: 0.9 }));
  piece.rotation.x = Math.PI / 2;
  piece.position.z = at;
  cigarette.add(piece);
}
cigarette.visible = false;
scene.add(cigarette);
// The knife in his right hand: a steel blade with a point, a cross-guard and a black grip. It points along +Z.
let knifeOut = false;
const knife = new THREE.Group();
{
  const steel = new THREE.MeshStandardMaterial({ color: 0xd4d8dc, roughness: 0.2, metalness: 0.9 });
  const grip = new THREE.MeshStandardMaterial({ color: 0x141516, roughness: 0.8 });
  const part = (geometry, material, z) => { const mesh = new THREE.Mesh(geometry, material); mesh.position.z = z; mesh.castShadow = true; knife.add(mesh); return mesh; };
  part(new THREE.BoxGeometry(0.026, 0.034, 0.12), grip, 0);
  part(new THREE.BoxGeometry(0.06, 0.02, 0.014), steel, 0.066);            // cross-guard
  part(new THREE.BoxGeometry(0.004, 0.032, 0.15), steel, 0.148);           // blade
  const tip = part(new THREE.ConeGeometry(0.016, 0.05, 4), steel, 0.247);  // the point
  tip.rotation.x = Math.PI / 2;
  tip.scale.x = 0.14;
}
knife.visible = false;
scene.add(knife);
const knifeFrom = new THREE.Vector3(), knifeAlong = new THREE.Vector3(), BLADE_AXIS = new THREE.Vector3(0, 0, 1);
function toggleKnife() {
  if (!bag.knife) return toast("You don't own a knife. Big Al's Guns sells one.");
  knifeOut = !knifeOut;
  if (knifeOut) gun.equipped = false;
  sfx('click');
}
// Each frame: the knife sits in his right fist, pointing the way his forearm points.
function updateKnife() {
  if (testView.has('knife')) { bag.knife = 1; knifeOut = true; }
  if (gun.equipped) knifeOut = false;
  knife.visible = knifeOut && !!player.bones && !driving && !boating && player.group.visible;
  if (!knife.visible) return;
  player.bones.foreArmR.getWorldPosition(knifeFrom);
  player.bones.handR.getWorldPosition(knife.position);
  knifeAlong.copy(knife.position).sub(knifeFrom).normalize();
  knife.position.addScaledVector(knifeAlong, 0.09);
  knife.quaternion.setFromUnitVectors(BLADE_AXIS, knifeAlong);
}
function smoke() {
  if (!bag.cigarettes) return toast('You have no cigarettes. Sunny\'s Mart sells them.');
  if (!bag.lighter) return toast('You have cigarettes but nothing to light them with. Buy a lighter.');
  bag.cigarettes--;
  sfx('lighter');
  smoking = 12; // three drags
  toast('You light a cigarette. *cough*' + unhealthy());
  showBag(); persist();
}
function drink() {
  if (!bag.beer) return toast('You have no beer. Sunny\'s Mart sells it.');
  if (drinking > 0) return; // still on the last one
  bag.beer--;
  showBag(); persist();
  if (driving || boating || !player.bones) return swallow(); // no room for the full performance
  smoking = 0;
  drinking = DRINK_TIME;
  capOn = true;
}
// One or two beers do nothing. The third (and any after it) makes him drunk. He sobers up by one beer a minute.
let beersInHim = 0, soberTimer = 0;
function swallow() {
  sfx('drink');
  beersInHim++;
  soberTimer = 60;
  if (beersInHim >= 3) {
    tipsy = Math.min(90, tipsy + 30);
    toast(beersInHim === 3 ? 'That is your third beer. Now you are drunk: everything goes wobbly.' : 'Another beer. You are getting drunker.');
  } else {
    toast(`You drink a beer. You feel fine (${beersInHim} of 3 before you are drunk).`);
  }
}
// Drinking a beer: he lifts the bottle to his mouth, bites the cap, yanks it off with
// a jerk of his head and spits it out, then tips the bottle up and drinks.
const DRINK_TIME = 4.6, CAP_OFF = 1.15, GULP = 2.5;
let drinking = 0, drinkLift = 0, drinkTilt = 0, capOn = true, capLife = 0;
const ease = (from, to, t) => { const u = Math.min(1, Math.max(0, (t - from) / (to - from))); return u * u * (3 - 2 * u); }; // a soft start and a soft stop
const capSpeed = new THREE.Vector3();
const beerBottle = new THREE.Group();
beerBottle.rotation.order = 'YXZ';
{
  const glass = new THREE.MeshStandardMaterial({ color: 0x5a3414, roughness: 0.2 });
  const piece = (top, bottom, height, y, material = glass) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, 12), material);
    mesh.position.y = y;
    beerBottle.add(mesh);
    return mesh;
  };
  piece(0.03, 0.03, 0.13, 0);                                                              // the hand holds it round the middle
  piece(0.012, 0.03, 0.05, 0.09);
  piece(0.012, 0.012, 0.06, 0.145);
  piece(0.0305, 0.0305, 0.06, 0, new THREE.MeshStandardMaterial({ color: 0xf2e6c0, roughness: 0.8 })); // label
}
const capMaterial = new THREE.MeshStandardMaterial({ color: 0xd9a83a, roughness: 0.3, metalness: 0.7 });
const bottleCap = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.012, 12), capMaterial);
bottleCap.position.y = 0.18;
beerBottle.add(bottleCap);
beerBottle.visible = false;
beerBottle.scale.setScalar(0.85);
const flyingCap = new THREE.Mesh(bottleCap.geometry, capMaterial);
flyingCap.visible = false;
scene.add(beerBottle, flyingCap);
function updateDrinking(dt) {
  if (testView.has('drink')) drinking = DRINK_TIME - Number(testView.get('drink')); // ?drink=seconds holds him part-way through
  if (capLife > 0) { // the cap he spat out, tumbling to the ground
    capLife -= dt;
    capSpeed.y -= 9.8 * dt;
    flyingCap.position.addScaledVector(capSpeed, dt);
    flyingCap.rotation.x += dt * 14;
    const ground = player.group.position.y + 0.01;
    if (flyingCap.position.y < ground) { flyingCap.position.y = ground; capSpeed.set(0, 0, 0); flyingCap.rotation.x = 0; }
    flyingCap.visible = capLife > 0;
  }
  if (beersInHim > 0 && (soberTimer -= dt) <= 0) { beersInHim--; soberTimer = 60; } // sobering up
  if (drinking <= 0 || !player.bones) { drinkLift = 0; drinkTilt = 0; beerBottle.visible = false; return; }
  const before = DRINK_TIME - drinking;
  drinking -= dt;
  const now = DRINK_TIME - drinking, facing = player.group.rotation.y;
  const forward = (distance) => puffSpot.set(Math.sin(facing) * distance, 0, Math.cos(facing) * distance);
  // His hand glides up to his mouth, dips a little as the cap comes away, glides back up to drink, then down.
  drinkLift = ease(0, 0.75, now) - 0.4 * ease(1.25, 1.75, now) + 0.4 * ease(1.85, 2.35, now) - ease(3.85, DRINK_TIME, now);
  drinkTilt = ease(2.25, 2.85, now) * (1 - ease(3.45, 3.95, now));
  if (before < CAP_OFF && now >= CAP_OFF) { // the cap comes off in his teeth
    sfx('cap');
    player.slap = 0.32; // the tug of his head
    capLife = 2.5;
    player.bones.head.getWorldPosition(flyingCap.position);
    flyingCap.position.add(forward(0.16));
    flyingCap.position.y += 0.05;
    capSpeed.set(Math.cos(facing) * 1.6 + Math.sin(facing) * 0.9, 1.4, -Math.sin(facing) * 1.6 + Math.cos(facing) * 0.9);
  }
  if (before < GULP && now >= GULP) swallow();
  capOn = now < CAP_OFF;
  bottleCap.visible = capOn;
  beerBottle.visible = !driving && !boating;
  player.bones.handL.getWorldPosition(beerBottle.position);
  beerBottle.position.add(forward(0.06));
  beerBottle.position.y += 0.02 * player.smokeLift;
  beerBottle.rotation.set(-player.smokeLift * (1.15 + 0.75 * drinkTilt), facing, 0);
  if (drinking <= 0) beerBottle.visible = false;
}
function eat() {
  if (!bag.snacks) return toast('You have no snacks. Sunny\'s Mart sells them.');
  bag.snacks--;
  sfx('eat');
  energy = 30;
  player.boost = 1.35;
  toast('You eat the snacks. You feel quick on your feet!' + unhealthy());
  showBag(); persist();
}
// In front of the cashier in Sunny's Mart, or the one in the beer shop: says which.
const atMartCounter = () => (near(22.7, -22.2, 1.7) ? 'mart' : near(beerShop.userData.counter.x, beerShop.userData.counter.z, 1.6) ? 'beer' : islandTill());

// --- The gym and training -----------------------------------------------------------
// Iron Gator Gym is on the near side of the road, just past the petrol station.
// Each piece of equipment raises one stat (up to 10), and the stats change the game:
//   Boxing: punches are faster.  Strength: punches hit harder.  Toughness: he gets up sooner.
const gym = createGym(scene, 73, -20, -9);
const MAX_STAT = 10, WORKOUT_TIME = 5;
const stats = Object.assign({ boxing: 0, strength: 0, toughness: 0 }, saved.stats);
const statsEl = overlay('right:18px;top:92px;font-size:14px;color:#ffd9b0;background:rgba(40,30,20,0.65);padding:5px 12px;border-radius:8px');
function showStats() {
  statsEl.textContent = `Boxing ${stats.boxing} · Strength ${stats.strength} · Toughness ${stats.toughness}`;
  statsEl.style.display = stats.boxing + stats.strength + stats.toughness ? 'block' : 'none';
}
showStats();
const gymPrompt = (station) => {
  const t = TRAINING[station.kind], level = stats[t.stat];
  return level >= MAX_STAT ? `${t.title} is at its maximum (${MAX_STAT}/${MAX_STAT})`
    : `Press E to train on ${t.thing} · ${t.title} ${level}/${MAX_STAT}: ${t.effect}`;
};
let workout = null; // { station, time } while he is training
function startWorkout(station) {
  if (stats[TRAINING[station.kind].stat] >= MAX_STAT) return toast(gymPrompt(station));
  workout = { station, time: 0 };
  gun.equipped = false;
}
function finishWorkout() {
  const { station } = workout, t = TRAINING[station.kind];
  sfx('levelup');
  stats[t.stat]++;
  toast(`${t.title} is now ${stats[t.stat]}/${MAX_STAT}: ${t.effect}.`);
  showStats();
  persist();
  // Put the equipment back and stand him beside it.
  if (station.kind === 'bench') station.barbell.position.copy(station.barbell.userData.rest).sub(gym.group.position);
  if (station.kind === 'weights') for (const dumbbell of station.dumbbells) { dumbbell.position.copy(dumbbell.userData.rest).sub(gym.group.position); dumbbell.rotation.set(0, 0, 0); }
  player.group.position.set(station.spot.x, 0, station.spot.z);
  workout = null;
}
// --- Other ways to make money ----------------------------------------------------------
// 1. Iguanas: shoot or punch one, walk over it to pick it up, and sell it to Big Al.
// 2. People you knock out or kill drop whatever cash they had: G$ 0, 1, 5 or 10.
const IGUANA_PRICE = 40;
bag.iguanas ??= 0;
function sellIguanas() {
  if (!bag.iguanas) return toast('You have no iguanas to sell. Shoot or punch some, then walk over them to pick them up.');
  const earned = bag.iguanas * IGUANA_PRICE;
  toast(`Big Al buys your ${bag.iguanas} iguana${bag.iguanas > 1 ? 's' : ''} for G$ ${earned}.`);
  sfx('coin');
  money += earned;
  bag.iguanas = 0;
  showMoney(); showBag(); persist(); drawShop();
}
const drops = []; // bundles of cash lying on the ground
const billMaterial = new THREE.MeshStandardMaterial({ color: 0x4f9a55, roughness: 0.8 });
const bandMaterial = new THREE.MeshStandardMaterial({ color: 0xeee6c8, roughness: 0.8 });
function dropCash(at, fixed) {
  const amount = fixed ?? [0, 1, 5, 10][Math.floor(Math.random() * 4)];
  if (!amount) return toast('They had no money on them.');
  const mesh = new THREE.Group();
  mesh.add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04 + amount * 0.006, 0.16), billMaterial));
  mesh.add(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.045 + amount * 0.006, 0.165), bandMaterial));
  mesh.position.set(at.x, at.y + 0.35, at.z);
  scene.add(mesh);
  drops.push({ mesh, amount, life: 90, height: at.y + 0.35 });
}
function updateDrops(dt, time) {
  for (let i = drops.length - 1; i >= 0; i--) {
    const drop = drops[i];
    drop.life -= dt;
    drop.mesh.rotation.y += dt * 2;                               // it spins and bobs so you can spot it
    drop.mesh.position.y = drop.height + Math.sin(time * 3 + i) * 0.06;
    const taken = !driving && !boating && near(drop.mesh.position.x, drop.mesh.position.z, 1.2);
    if (taken) {
      sfx('coin');
      money += drop.amount;
      showMoney(); persist();
      toast(`You pick up G$ ${drop.amount}.`);
    }
    if (taken || drop.life <= 0) {
      scene.remove(drop.mesh);
      drops.splice(i, 1);
    }
  }
}
// --- Day and night ---------------------------------------------------------------------
// A full day takes an hour of real time. The sun rises at 6:00 and sets at 18:00; at night the
// moon gives a little blue light, the stars come out, and signs and lamps stand out.
const DAY_SECONDS = 3600; // one hour of real time
let hourNow = saved.clock ?? 8;  // the hour, 0 to 24
let day = saved.day ?? 1;
const sunOffset = SUN_OFFSET.clone(); // where the sun (or moon) is, relative to the player
const clockEl = overlay('left:18px;top:14px;font-weight:bold;font-size:20px;color:#f3e9d2;background:rgba(40,30,20,0.65);padding:6px 14px;border-radius:8px');
const fadeEl = overlay('inset:0;background:#000;opacity:0;transition:opacity 1s');
const isNight = () => hourNow >= 18 || hourNow < 6; // dark: from sunset to sunrise
const SKY = {
  top: [new THREE.Color(0x04060e), new THREE.Color(PALETTE.skyTop)],
  mid: [new THREE.Color(0x0a1124), new THREE.Color(PALETTE.skyMid)],
  horizon: [new THREE.Color(0x141c33), new THREE.Color(PALETTE.skyHorizon)],
  glow: [new THREE.Color(0xcfd8ff), new THREE.Color(PALETTE.sunGlow)],
  light: [new THREE.Color(0x8fa8d8), new THREE.Color(PALETTE.sunLight)],
  dusk: new THREE.Color(0xf29a58), duskLight: new THREE.Color(0xffa060),
};
function updateDaylight(dt) {
  if (testView.has('hour')) hourNow = Number(testView.get('hour')); // ?hour=22 fixes the time
  else hourNow += dt * 24 / DAY_SECONDS;
  if (hourNow >= 24) { hourNow -= 24; day++; }
  const angle = (hourNow - 6) / 12 * Math.PI, height = Math.sin(angle);   // the sun's arc across the sky
  const bright = THREE.MathUtils.smoothstep(height, -0.12, 0.3);        // 0 at night, 1 in full day
  const dusk = bright * (1 - THREE.MathUtils.smoothstep(height, 0.15, 0.6)); // sunrise and sunset
  // The sun by day; the moon, on the opposite arc, by night.
  const up = height > -0.12 ? Math.max(height, 0.08) : Math.max(-height, 0.3);
  const across = height > -0.12 ? Math.cos(angle) : -Math.cos(angle);
  sunOffset.set(-across * 45, up * 48, 26);

  const u = sky.material.uniforms;
  u.top.value.lerpColors(SKY.top[0], SKY.top[1], bright);
  u.mid.value.lerpColors(SKY.mid[0], SKY.mid[1], bright).lerp(SKY.dusk, dusk * 0.35);
  u.horizon.value.lerpColors(SKY.horizon[0], SKY.horizon[1], bright).lerp(SKY.dusk, dusk * 0.8);
  u.glow.value.lerpColors(SKY.glow[0], SKY.glow[1], bright);
  u.sunDir.value.copy(sunOffset).normalize();
  u.night.value = 1 - bright;
  scene.fog.color.copy(u.horizon.value);
  sun.color.lerpColors(SKY.light[0], SKY.light[1], bright).lerp(SKY.duskLight, dusk * 0.7);
  sun.intensity = 0.3 + 2.7 * bright;
  skyLight.intensity = 0.28 + 1.42 * bright;
  daylight.value = 0.14 + 0.86 * bright;

  const minutes = Math.floor((hourNow % 1) * 60);
  clockEl.textContent = `Day ${day} · ${String(Math.floor(hourNow)).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// Sleeping: at night, the bed in his house skips straight to 7 in the morning.
const atBed = () => (near(9.2, -27.3, 2.1) && player.group.position.x > 7.1 && player.group.position.z < -24.1) // the old house on Palm Ave
  || (player.group.position.y > city.home.top - 1 && near(city.home.bed.x, city.home.bed.z, 1.9))            // or the penthouse
  || near(airport.home.bed.x, airport.home.bed.z, 2.0);                                                       // or his hut on Jamaica
let sleeping = false;
function trySleep() {
  if (sleeping) return;
  if (!isNight()) return toast('You are not tired yet. You can sleep once it gets dark, at 6 in the evening.');
  sfx('sleep');
  sleeping = true;
  fadeEl.style.opacity = 1;
  setTimeout(() => {
    if (hourNow >= 18) day++;
    hourNow = 7;
    fadeEl.style.opacity = 0;
    sleeping = false;
    persist();
    toast(`You slept until 7:00. Good morning: it is day ${day}.`);
  }, 1300);
}

// Unhealthy habits undo gym work: each one knocks a point off his best stat.
function unhealthy() {
  const best = Object.keys(stats).sort((a, b) => stats[b] - stats[a])[0];
  if (!stats[best]) return '';
  stats[best]--;
  showStats();
  return ` That was unhealthy: your ${best[0].toUpperCase() + best.slice(1)} drops to ${stats[best]}/${MAX_STAT}.`;
}
// --- Crime and punishment -----------------------------------------------------------------
// Hurting or killing someone is a crime. The police then chase him until they catch
// him or lose him. Caught, he pays a fine and spends a while locked in a holding cell.
const WANTED_TIME = 45, FINE = 100;
// Each arrest means longer inside: 1 minute the first time, then 2, 3, 4, and 5 minutes from the fifth arrest on.
let arrests = saved.arrests ?? 0;
const jailMinutes = () => Math.min(5, arrests);
let wanted = 0;  // seconds until the police give up, or 0 if he is not wanted
let stars = 0;   // how badly: one to five
let jailed = 0;  // seconds left in the cell
let arresting = false;
const wantedEl = overlay('display:none;left:18px;top:54px;font-weight:bold;font-size:18px;color:#fff3e0;background:rgba(160,25,15,0.85);padding:5px 14px;border-radius:8px');
// He is taken to whichever station is nearer: Palm Ave's, or Miami's (where the cells are upstairs).
let lockUp = policeStation.userData;
const nearestStation = () => (player.group.position.x > 2300 && player.group.position.z < -500 ? cuba.police : player.group.position.x > 2300 ? airport.police : player.group.position.x > 330 ? miamiPD.userData : policeStation.userData); // Kingston, Miami or Palm Ave
// level: how serious it is. An ordinary crime is one star, killing somebody two, killing an officer or cracking the vault three.
// Every further crime while he is already wanted adds a star, up to five.
let lastCrimeAt = -99;
function commitCrime(level = 1) {
  if (jailed > 0 || arresting) return;
  if (wanted <= 0) toast('That is a crime! The police are coming for you.');
  const more = wanted > 0 && gameTime - lastCrimeAt > 2 ? 1 : 0;
  lastCrimeAt = gameTime;
  stars = Math.min(5, Math.max(stars + more, level));
  wanted = WANTED_TIME + stars * 15; // the more stars, the longer they keep looking
}
// When the police have him in sight they call through the megaphone for him to stop. If he
// stands still with empty hands they walk up and arrest him. If he runs, drives off or has a
// weapon out, that is resisting arrest: they warn him once more, and then they shoot.
let resist = 0, policeWarned = false, resisting = false, copShot = 0, lastStood = null;
function updatePoliceFire(dt) {
  const here = player.group.position;
  const moved = lastStood ? Math.hypot(here.x - lastStood.x, here.z - lastStood.z) / Math.max(dt, 1e-4) : 0;
  lastStood = { x: here.x, z: here.z };
  if (downed) { wanted = 0; stars = 0; }
  if (wanted <= 0 || jailed > 0 || arresting || downed) { resist = 0; policeWarned = resisting = false; return; }
  let cop = null, range = 42;
  for (const one of npcs.officers || []) {
    const distance = Math.hypot(one.group.position.x - here.x, one.group.position.z - here.z);
    if (one.state !== 'dead' && distance < range && Math.abs(one.group.position.y - here.y) < 3) { range = distance; cop = one; }
  }
  if (!cop) { resist = Math.max(0, resist - dt); return; }
  if (!policeWarned) {
    policeWarned = true;
    sfx('megaphone');
    speak(cop, 'POLICE! STOP RIGHT THERE! HANDS WHERE I CAN SEE THEM!', 5);
    toast('Police megaphone: "STOP! Stand still with your hands empty and you will not be hurt."');
  }
  const defiant = moved > 0.8 || gun.equipped || knifeOut || driving || !!boating;
  resist = defiant ? resist + dt : Math.max(0, resist - dt * 2);
  const patience = stars >= 3 ? 1.5 : 4; // at three stars and up they do not wait long
  if (resist <= 0) resisting = false;
  if (resist < patience) return;
  if (!resisting) {
    resisting = true;
    stars = Math.max(stars, 2);
    copShot = 1.4;
    sfx('megaphone');
    speak(cop, 'YOU ARE RESISTING ARREST! STOP OR WE SHOOT!', 5);
    toast('Police megaphone: "YOU ARE RESISTING ARREST! STOP OR WE WILL SHOOT!"');
  }
  copShot -= dt;
  if (copShot > 0) return;
  copShot = Math.max(0.35, 1.1 - stars * 0.15); // more stars, faster fire
  sfx('shot');
  puffSpot.set(cop.group.position.x, cop.group.position.y + 1.4, cop.group.position.z);
  emitSmoke(gun, puffSpot, 0.5);
  const aimed = THREE.MathUtils.clamp(0.8 - range / 55, 0.12, 0.7) * (driving || boating ? 0.45 : 1) * (moved > 5 ? 0.7 : 1);
  if (Math.random() < aimed) { if (health - 9 <= 0) deathCause = 'The police shot you for resisting arrest.'; hurtPlayer(7 + stars * 2); }
}
function arrest() {
  if (arresting || jailed > 0) return;
  arresting = true;
  fadeEl.style.opacity = 1;
  setTimeout(() => {
    if (driving) { // hauled out of the truck
      driving = false;
      setEngine(truck, false);
      truck.speed = 0;
      player.group.visible = true;
    }
    gun.equipped = false;
    const fine = Math.min(money, FINE);
    money -= fine;
    showMoney();
    wanted = 0;
    stars = 0;
    arrests++;
    sfx('cell');
    jailed = jailMinutes() * 60;
    arresting = false;
    lockUp = nearestStation();
    player.group.position.copy(lockUp.cell);
    player.group.rotation.y = 0;
    cam.yaw = Math.PI;
    fadeEl.style.opacity = 0;
    persist();
    toast(`Arrested! You are fined G$ ${fine} and locked in the cells for ${jailMinutes()} minute${jailMinutes() > 1 ? 's' : ''}. This is arrest number ${arrests}.`);
  }, 1100);
}
// Bail: pay to walk out of the cells straight away.
const BAIL = 150;
function payBail() {
  // Bail comes out of whatever he has: cash first, then the bank, then Jamaican dollars. With
  // nothing at all, the sergeant lets him go anyway rather than feed him.
  let how;
  if (money >= BAIL) { money -= BAIL; how = `You pay G$ ${BAIL} bail and walk free.`; }
  else if (bank >= BAIL) { bank -= BAIL; how = `G$ ${BAIL} bail is taken from your bank account, and you walk free.`; }
  else if (jmoney >= BAIL * 150) { jmoney -= BAIL * 150; how = `You pay bail in Jamaican dollars (J$ ${(BAIL * 150).toLocaleString('en-US')}) and walk free.`; }
  else how = 'You turn out your empty pockets. The sergeant sighs. "Go on, get out. I am not feeding you." You walk free.';
  showMoney();
  sfx('buy');
  jailed = 0;
  player.group.position.copy(lockUp.release);
  cam.yaw = 0;
  persist();
  toast(how);
}
function updatePolice(dt) {
  if (testView.has('wanted') && wanted <= 0 && jailed <= 0 && !arresting && !updatePolice.done) { updatePolice.done = true; commitCrime(); } // ?wanted starts a chase
  if (testView.has('jail') && !updatePolice.done) { updatePolice.done = true; jailed = 999; lockUp = testView.get('jail') === 'kingston' ? airport.police : testView.get('jail') === 'miami' ? miamiPD.userData : policeStation.userData; player.group.position.copy(lockUp.cell); }
  if (wanted > 0) {
    // The search only winds down while no officer is close.
    const close = (npcs.officers || []).some((cop) => cop.state !== 'dead' && near(cop.group.position.x, cop.group.position.z, 25));
    if (!close) wanted -= dt;
    if (wanted <= 0) { wanted = 0; stars = 0; toast('The police have lost you.'); }
  }
  if (jailed > 0) {
    jailed -= dt;
    if (jailed <= 0) {
      jailed = 0;
      player.group.position.copy(lockUp.release);
      cam.yaw = 0;
      toast('You are released. Stay out of trouble.');
    }
  }
  wantedEl.style.display = wanted > 0 || jailed > 0 ? 'block' : 'none';
  wantedEl.innerHTML = jailed > 0 ? `IN THE CELLS · released in ${Math.floor(Math.ceil(jailed) / 60)}:${String(Math.ceil(jailed) % 60).padStart(2, '0')}  ·  press E to pay G$ ${BAIL} bail` : `<span style="color:#ffd75a;letter-spacing:2px">${'★'.repeat(stars)}</span><span style="opacity:0.35;letter-spacing:2px">${'★'.repeat(5 - stars)}</span> &nbsp;${resisting ? 'RESISTING ARREST' : 'WANTED'}`;
}
// --- Health -------------------------------------------------------------------------------
// Getting shot costs health. It comes back slowly if he stays out of trouble. At zero
// he passes out and wakes up back on Palm Ave with a doctor's bill.
let health = 100, lastHurtAt = -99, downed = false;
let deathCause = ''; // what to say killed him, when it wasn't a bullet
const healthEl = overlay('left:18px;top:94px');
function showHealth() {
  healthEl.innerHTML = `<div style="width:170px;height:14px;background:rgba(0,0,0,0.55);border-radius:7px;overflow:hidden;border:1px solid rgba(255,255,255,0.35)">
    <div style="width:${health}%;height:100%;background:${health > 35 ? '#5fc46a' : '#e0452f'}"></div></div>`;
}
showHealth();
function hurtPlayer(amount) {
  if (downed || jailed > 0 || arresting) return;
  health = Math.max(0, health - amount);
  lastHurtAt = gameTime;
  hurt = 1;
  bleed();
  showHealth();
  if (health > 0) return;
  downed = true;
  fadeEl.style.opacity = 1;
  setTimeout(() => {
    if (driving) { driving = false; setEngine(truck, false); truck.speed = 0; player.group.visible = true; }
    if (boating) { setEngine(boating, false); boating.speed = 0; boating = null; }
    const bill = money; // everything in his pockets is gone. What is in the bank is safe.
    money = 0;
    jmoney = 0;
    Object.assign(ill, { food: 0, dengue: 0, leg: false, arm: false }); // (whoever picked him up patched him up)
    showIll();
    showMoney();
    health = 100;
    showHealth();
    downed = false;
    // He comes round at whichever home is nearer: outside his hut if he was on or near Jamaica, outside Aqua Tower otherwise.
    player.group.position.copy(player.group.position.x > 2200 ? airport.home.door : city.home.street);
    fadeEl.style.opacity = 0;
    persist();
    toast((deathCause ? deathCause + ' ' : '') + (bill ? `You died and lost the G$ ${bill.toLocaleString('en-US')} you were carrying. ${bank ? `Your G$ ${bank.toLocaleString('en-US')} in the bank is safe.` : 'Next time, put your money in a cash machine first.'}` : 'You died, but you had no cash on you to lose.'));
    deathCause = '';
  }, 1300);
}
function healOverTime(dt) {
  if (health >= 100 || downed || gameTime - lastHurtAt < 6 || ill.food > 0 || ill.dengue > 0) return; // (no getting better by himself while he is ill)
  health = Math.min(100, health + 4 * dt);
  showHealth();
}
// --- Blood ----------------------------------------------------------------------------------
// Kept restrained and realistic. A bullet leaves a dark, wet stain soaking into his
// clothes at the wound, a brief fine mist at the moment of impact, and a few small
// stains on the ground. Nothing sprays and nothing covers the screen.

// A blood stain painted in code: an uneven dark clot, thinner and redder toward its
// ragged edge, with a few specks thrown off it and (on clothes) a run dripping down.
function bloodStain(withRun) {
  const size = 128, canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const blob = (x, y, r, colour) => { ctx.fillStyle = colour; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
  const lobes = 5 + Math.floor(Math.random() * 3), tilt = Math.random() * 6;
  const reach = (angle) => 20 + 9 * Math.sin(angle * lobes + tilt) + 5 * Math.sin(angle * 2 + tilt * 2); // the ragged outline
  for (let i = 0; i < 260; i++) {                    // thin outer soak
    const angle = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * reach(angle);
    blob(64 + Math.cos(angle) * r, 58 + Math.sin(angle) * r, 3 + Math.random() * 5, 'rgba(92,9,7,0.2)');
  }
  for (let i = 0; i < 120; i++) {                    // thick dark middle
    const angle = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * reach(angle) * 0.55;
    blob(64 + Math.cos(angle) * r, 58 + Math.sin(angle) * r, 2.5 + Math.random() * 4, 'rgba(30,3,3,0.3)');
  }
  for (let i = 0; i < 7; i++) {                      // specks thrown off it
    const angle = Math.random() * Math.PI * 2, r = 34 + Math.random() * 18;
    blob(64 + Math.cos(angle) * r, 58 + Math.sin(angle) * r, 0.8 + Math.random() * 1.8, 'rgba(70,6,5,0.85)');
  }
  if (withRun) {                                     // a run or two trickling down
    for (let run = 0; run < 1 + Math.floor(Math.random() * 2); run++) {
      const x = 56 + Math.random() * 16, length = 22 + Math.random() * 32, width = 2 + Math.random() * 1.6;
      ctx.fillStyle = 'rgba(52,5,4,0.85)';
      ctx.fillRect(x - width / 2, 62, width, length);
      blob(x, 62 + length, width * 0.85, 'rgba(40,4,3,0.9)');
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // Low roughness makes it catch the light like something wet.
  return new THREE.MeshStandardMaterial({ map: texture, transparent: true, depthWrite: false, roughness: 0.22, polygonOffset: true, polygonOffsetFactor: -4 });
}
const clothStains = [bloodStain(true), bloodStain(true), bloodStain(true)];
const groundStains = [bloodStain(false), bloodStain(false), bloodStain(false)];
const stainShape = new THREE.PlaneGeometry(1, 1);

// Stains on his clothes, at the wounds. They stay until he has healed.
const wounds = [];
function addWound() {
  const chest = player.bones?.spine2;
  if (!chest || wounds.length >= 5) return;
  const wound = new THREE.Mesh(stainShape, clothStains[wounds.length % clothStains.length]);
  const size = 0.1 + Math.random() * 0.05;
  wound.scale.set(size, size * 1.15, 1);
  wound.position.set((Math.random() - 0.5) * 0.2, -0.04 + Math.random() * 0.18, 0.138 + wounds.length * 0.0015);
  chest.add(wound);
  wounds.push(wound);
}
function clearWounds() {
  for (const wound of wounds) wound.parent?.remove(wound);
  wounds.length = 0;
}

// Small stains on the ground. Each dries darker and fades away after a while.
const spots = Array.from({ length: 18 }, (_, i) => {
  const spot = new THREE.Mesh(stainShape, groundStains[i % groundStains.length].clone());
  spot.rotation.x = -Math.PI / 2;
  spot.visible = false;
  spot.renderOrder = 2;
  spot.userData.life = 0;
  scene.add(spot);
  return spot;
});
let nextSpot = 0, dripTimer = 0;
function stainGround(x, y, z, size) {
  const spot = spots[nextSpot++ % spots.length];
  spot.position.set(x, y + 0.03, z);
  spot.rotation.z = Math.random() * Math.PI * 2;
  spot.scale.set(size, size, 1);
  spot.userData.life = 45;
  spot.visible = true;
}
const mistSpot = new THREE.Vector3();
function bleed() {
  const at = player.group.position;
  addWound();
  emitBloodMist(gun, mistSpot.set(at.x, at.y + 1.25, at.z));
  for (let i = 0; i < 2; i++) stainGround(at.x + (Math.random() - 0.5) * 0.7, at.y, at.z + (Math.random() - 0.5) * 0.7, 0.12 + Math.random() * 0.16);
}
function updateBlood(dt) {
  for (const spot of spots) {
    if (!spot.visible) continue;
    spot.userData.life -= dt;
    spot.material.opacity = Math.min(1, spot.userData.life / 8);
    if (spot.userData.life <= 0) spot.visible = false;
  }
  // Badly hurt: the odd drip marks where he has been. Fully healed: the stains are gone.
  dripTimer -= dt;
  if (health < 45 && !downed && dripTimer <= 0 && wounds.length && !driving && !boating) {
    dripTimer = 0.9;
    const at = player.group.position;
    stainGround(at.x + (Math.random() - 0.5) * 0.25, at.y, at.z + (Math.random() - 0.5) * 0.25, 0.05 + Math.random() * 0.05);
  }
  if (health >= 100 && wounds.length) clearWounds();
}
// --- Fishing ------------------------------------------------------------------------------
// Cast from the stern of the fishing boat while she is tied up, or from the wheel when
// she is stopped out at sea (the further out, the bigger the fish). E casts; when the
// float dips, E again hooks it. The catch goes in the hold and sells at the beach stall.
const HOLD = 20; // how many fish he can carry
bag.fish ??= [];
createFishStall(scene, 927, 67);
const fishingLine = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
  new THREE.LineBasicMaterial({ color: 0xe9e6dc, transparent: true, opacity: 0.8 })
);
fishingLine.frustumCulled = false;
const bobber = new THREE.Group(); // a red and white float
bobber.add(new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), new THREE.MeshStandardMaterial({ color: 0xe0352b, roughness: 0.4 })));
const bobberTop = new THREE.Mesh(new THREE.SphereGeometry(0.112, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf2f0e8, roughness: 0.4 }));
bobber.add(bobberTop);
fishingLine.visible = bobber.visible = false;
scene.add(fishingLine, bobber);
const catchEl = overlay('display:none;left:50%;top:62%;transform:translateX(-50%);text-align:center;font-size:19px;color:#f3e9d2;background:rgba(18,34,46,0.88);padding:10px 24px;border-radius:10px;border:1px solid rgba(243,233,210,0.5)');
let fishingState = null; // { phase: 'wait' | 'bite' | 'show', timer }
let shownFish = null;
const rodTip = new THREE.Vector3(), floatSpot = new THREE.Vector3();
const atStern = () => {
  if (!seaParts.fishing.moored || player.group.position.y < 0.5) return false;
  const stern = onBoat(seaParts.fishing, 0, -5.9);
  return near(stern.x, stern.z, 1.8);
};
const fishingSpot = () => (boating ? !!boating.fishing && Math.abs(boating.speed) < 1.5 : !driving && atStern());
const atStall = () => !driving && !boating && near(929.6, 67, 2.4);
const holdValue = () => bag.fish.reduce((sum, fish) => sum + fish.price, 0);
function castLine() {
  if (bag.fish.length >= HOLD) return toast(`Your hold is full (${HOLD} fish). Sell them at the fish stall on the beach.`);
  fishingState = { phase: 'wait', timer: 3 + Math.random() * 6 };
  sfx('whoosh');
}
function landFish(forceSize, forceIndex) {
  const caught = rollCatch(seaParts.fishing.group.position.x - seaParts.shoreX, forceSize, forceIndex);
  const weight = caught.weight < 10 ? caught.weight.toFixed(1) : Math.round(caught.weight);
  bag.fish.push({ name: caught.spec.name, size: caught.size, weight: Number(weight), price: caught.price });
  showBag(); persist();
  sfx('levelup');
  // Hold it up in front of the camera to admire.
  shownFish = makeFish(caught.spec);
  shownFish.scale.setScalar(SHOW_LENGTH[caught.size]);
  shownFish.position.set(0, 0.05, -1.25);
  camera.add(shownFish);
  catchEl.innerHTML = `<b style="font-size:24px">${caught.spec.name}</b><br>${caught.size[0].toUpperCase() + caught.size.slice(1)} fish &nbsp;·&nbsp; ${weight} kg &nbsp;·&nbsp; worth <b>G$ ${caught.price}</b>`;
  catchEl.style.display = 'block';
  fishingState = { phase: 'show', timer: testView.has('fish') ? 9999 : 4.5 };
}
function reelIn() {
  if (fishingState.phase === 'show') return;
  if (fishingState.phase === 'wait') { fishingState = null; return toast('You reel in. Nothing on the hook yet.'); }
  landFish();
}
function sellFish() {
  if (!bag.fish.length) return toast('You have no fish to sell. Cast a line from the fishing boat at the end of the pier.');
  const total = holdValue(), count = bag.fish.length, best = bag.fish.reduce((a, b) => (b.price > a.price ? b : a));
  sfx('coin');
  money += total;
  bag.fish = [];
  showMoney(); showBag(); persist();
  toast(`The fishmonger buys your ${count} fish for G$ ${total.toLocaleString('en-US')}. Best of the lot: the ${best.name} (${best.weight} kg) at G$ ${best.price}.`);
}
function updateFishing(dt, time) {
  if (testView.has('fish') && !fishingState && player.bones) landFish(testView.get('fish'), Number(testView.get('n') || 0)); // ?fish=big&n=4 shows one fish
  fishingLine.visible = bobber.visible = !!fishingState && fishingState.phase !== 'show';
  if (!fishingState) return;
  fishingState.timer -= dt;
  if (fishingState.phase === 'show') {
    shownFish.rotation.y = Math.sin(time * 0.8) * 0.9; // turning slowly to show both sides
    shownFish.rotation.z = Math.sin(time * 1.7) * 0.05;
    if (fishingState.timer <= 0) {
      camera.remove(shownFish);
      shownFish = null;
      catchEl.style.display = 'none';
      fishingState = null;
    }
    return;
  }
  if (!(boating ? !!boating.fishing && Math.abs(boating.speed) < 3 : atStern())) { fishingState = null; return; } // wandered off or got under way
  // The line runs from the tip of a stern rod to the float bobbing behind the boat.
  const boat = seaParts.fishing.group, bite = fishingState.phase === 'bite';
  boat.localToWorld(rodTip.set(0.8, 3.6, -7.3));
  boat.localToWorld(floatSpot.set(0.8, 0, -12.5));
  floatSpot.y = 0.2 + (bite ? -0.13 + Math.sin(time * 34) * 0.05 : Math.sin(time * 2.2) * 0.03);
  bobber.position.copy(floatSpot);
  const points = fishingLine.geometry.attributes.position;
  points.setXYZ(0, rodTip.x, rodTip.y, rodTip.z);
  points.setXYZ(1, floatSpot.x, floatSpot.y, floatSpot.z);
  points.needsUpdate = true;
  if (!bite && fishingState.timer <= 0) {
    fishingState = { phase: 'bite', timer: 1.8 };
    sfx('splash');
  } else if (bite && fishingState.timer <= 0) {
    fishingState = null;
    toast('Too slow: it got away!');
  }
}
// --- The automatic fishing pole -------------------------------------------------------------
// The big boom on the fishing boat fishes by itself. T switches it on and off from
// anywhere aboard. It lowers its hook into the sea, and every so often winds a fish
// up out of the water and drops it in the hold, until the hold is full.
const pole = { on: false, phase: 'down', timer: 0, hookY: seaParts.fishing.rig.stowed, catch: null, fish: null };
const aboardBoat = () => (boating ? !!boating.fishing : !driving && seaParts.fishing.moored && player.group.position.y > 0.5
  && player.group.position.x > seaParts.boatBox.minX && player.group.position.x < seaParts.boatBox.maxX
  && player.group.position.z > seaParts.boatBox.minZ && player.group.position.z < seaParts.boatBox.maxZ);
function toggleAutoPole() {
  if (!aboardBoat()) return;
  if (!pole.on && bag.fish.length >= HOLD) return toast(`Your hold is full (${HOLD} fish). Sell them at the fish stall on the beach first.`);
  pole.on = !pole.on;
  sfx('click');
  if (pole.on) { pole.phase = 'down'; pole.timer = 4 + Math.random() * 4; }
  toast(pole.on ? 'Automatic fishing pole ON. It will keep landing fish until the hold is full.' : 'Automatic fishing pole OFF.');
}
function dropPoleFish() {
  if (pole.fish) pole.fish.parent?.remove(pole.fish);
  pole.fish = pole.catch = null;
}
function updateAutoPole(dt) {
  if (testView.has('pole') && !pole.on && player.bones) { pole.on = true; pole.phase = 'down'; pole.timer = 1; } // ?pole switches it on
  const rig = seaParts.fishing.rig;
  let wantY = rig.stowed, windSpeed = 3;
  if (!pole.on) {
    if (pole.fish) dropPoleFish();
  } else if (pole.phase === 'down') {         // hook in the water, waiting
    wantY = -0.7;
    if (pole.hookY < -0.5) pole.timer -= dt;
    if (pole.timer <= 0) {
      const caught = rollCatch(seaParts.fishing.group.position.x - seaParts.shoreX);
      pole.catch = caught;
      pole.fish = makeFish(caught.spec);
      const length = SHOW_LENGTH[caught.size] * 1.25;
      pole.fish.scale.setScalar(length);
      pole.fish.rotation.z = Math.PI / 2;      // hanging by its mouth, tail down
      pole.fish.position.y = -0.2 - length / 2;
      rig.hook.add(pole.fish);
      pole.phase = 'haul';
      sfx('splash');
    }
  } else if (pole.phase === 'haul') {          // winding the fish up out of the water
    wantY = 3.0;
    windSpeed = 2.0;
    if (pole.hookY >= 2.95) {
      const caught = pole.catch, weight = caught.weight < 10 ? caught.weight.toFixed(1) : Math.round(caught.weight);
      bag.fish.push({ name: caught.spec.name, size: caught.size, weight: Number(weight), price: caught.price });
      showBag(); persist();
      sfx('coin');
      toast(`The automatic pole lands a ${caught.spec.name}: ${caught.size}, ${weight} kg, worth G$ ${caught.price}. (${bag.fish.length}/${HOLD} in the hold)`);
      pole.phase = 'hold';
      pole.timer = 1.6;
    }
  } else {                                     // showing the fish off for a moment, then back down
    wantY = 3.0;
    pole.timer -= dt;
    if (pole.fish) pole.fish.rotation.y += dt * 1.5;
    if (pole.timer <= 0) {
      dropPoleFish();
      if (bag.fish.length >= HOLD) { pole.on = false; toast('The hold is full. The automatic pole switches itself off.'); }
      pole.phase = 'down';
      pole.timer = 5 + Math.random() * 6;
    }
  }
  const move = THREE.MathUtils.clamp(wantY - pole.hookY, -windSpeed * dt, windSpeed * dt);
  pole.hookY += move;
  rig.hook.position.y = pole.hookY;
  rig.cable.scale.y = Math.max(0.05, rig.tip.y - pole.hookY);
}
// --- Home ------------------------------------------------------------------------------------
// He lives in Miami now: the penthouse on top of Aqua Tower. The lift in the lobby
// goes up to it. The game starts there, and that is where he sleeps.
const home = city.home;
const liftAt = () => {
  const p = player.group.position;
  if (driving || boating) return null;
  if (p.y < 3 && near(home.lobbyLift.x, home.lobbyLift.z, 1.7)) return 'up';
  if (p.y > home.top - 1 && near(home.homeLift.x, home.homeLift.z, 1.7)) return 'down';
  return null;
};
function rideLift() {
  const way = liftAt();
  if (!way) return;
  sfx('door');
  fadeEl.style.opacity = 1;
  setTimeout(() => {
    player.group.position.copy(way === 'up' ? home.homeLift : home.lobbyLift);
    player.group.rotation.y = home.facing;
    cam.yaw = home.facing + Math.PI;
    fadeEl.style.opacity = 0;
    toast(way === 'up' ? 'Penthouse. Welcome home.' : 'Lobby.');
  }, 900);
}
// --- Lucky Palm Casino -------------------------------------------------------------------------
// The slot machines and the roulette table take Gator Bucks and pay out Gator Bucks.
const casino = city.casino;
const SYMBOLS = ['🍒', '🍋', '🔔', '⭐', '7️⃣', '🐊'];
const SYMBOL_ODDS = [5, 5, 4, 3, 2, 1];        // out of 20: cherries come up most, the gator hardly ever
const TRIPLE = [4, 4, 10, 20, 50, 200];        // what three of a kind pays, times the bet
const SLOT_BETS = [10, 50, 100], STAKES = [10, 50, 100, 500];
const ROULETTE_BETS = [
  ['Red', (n) => REDS.has(n), 2], ['Black', (n) => n > 0 && !REDS.has(n), 2],
  ['Odd', (n) => n % 2 === 1, 2], ['Even', (n) => n > 0 && n % 2 === 0, 2],
  ['Low (1 to 18)', (n) => n >= 1 && n <= 18, 2], ['High (19 to 36)', (n) => n >= 19, 2],
  ['One number', (n) => n === luckyNumber, 36],
];
let casinoOpen = null;                          // 'slot' or 'roulette' while he is playing
let stake = 1, luckyNumber = 7, spin = null, casinoNote = '', casinoNet = 0, casinoTested = false;
let reelsShown = [4, 4, 4], lastNumber = 0, redraw = 0;
let compDay = saved.compDay ?? 0;
const rollReel = () => { let r = Math.random() * 20; for (let i = 0; i < 6; i++) { r -= SYMBOL_ODDS[i]; if (r < 0) return i; } return 0; };
const numberName = (n) => `${n} ${n === 0 ? 'green' : REDS.has(n) ? 'red' : 'black'}`;
const gs = (amount) => `G$ ${amount.toLocaleString('en-US')}`;

function casinoSpot() {
  const p = player.group.position;
  if (driving || boating || p.y > 3) return null;
  if (casino.slots.some((slot) => near(slot.x, slot.z, 0.75))) return 'slot';
  if (near(casino.table.x, casino.table.z, 2.7)) return 'roulette';
  if (near(casino.cage.x, casino.cage.z, 2.0)) return 'cage';
  return null;
}
function drawCasino() {
  const line = 'display:flex;gap:14px;padding:5px 0;border-top:1px solid rgba(243,230,192,0.25)';
  const head = (title) => `<div style="font-size:22px;font-weight:bold;margin-bottom:4px">${title}</div>
    <div style="margin-bottom:8px">You have <b>${gs(money)}</b></div>`;
  const note = `<div style="min-height:24px;margin:8px 0;font-weight:bold;color:#ffe9a0">${casinoNote}</div>`;
  if (casinoOpen === 'slot') {
    shopEl.innerHTML = `${head('Lucky Palm Slots')}
      <div style="font-size:54px;text-align:center;background:#111;border:3px solid #d9a83a;border-radius:10px;padding:6px 0;letter-spacing:14px">${reelsShown.map((s) => SYMBOLS[s]).join('')}</div>${note}
      <div style="${line}"><span style="flex:1">🍒🍒🍒 or 🍋🍋🍋 pays 4× &nbsp;·&nbsp; 🔔🔔🔔 10× &nbsp;·&nbsp; ⭐⭐⭐ 20×<br>7️⃣7️⃣7️⃣ 50× &nbsp;·&nbsp; 🐊🐊🐊 JACKPOT 200×<br>Two cherries pays 2× &nbsp;·&nbsp; any other pair gives your bet back</span></div>
      <div style="margin-top:10px;opacity:0.85">Press 1 to bet G$ 10 &nbsp;·&nbsp; 2 for G$ 50 &nbsp;·&nbsp; 3 for G$ 100 &nbsp;·&nbsp; E to leave</div>`;
  } else if (casinoOpen === 'roulette') {
    const rows = ROULETTE_BETS.map(([name, , pays], i) => `<div style="${line}"><b style="width:26px">${i + 1}</b>
      <span style="flex:1">${i === 6 ? `Number <b>${luckyNumber}</b> only <small>(0 and − change the number)</small>` : name}</span><b>pays ${pays}×</b></div>`).join('');
    const showing = spin?.kind === 'roulette' ? 'The wheel is spinning…' : casinoNote;
    shopEl.innerHTML = `${head('Roulette')}
      <div style="margin-bottom:6px">Your stake: <b>${gs(STAKES[stake])}</b> <small>(9 raises it, 8 lowers it)</small></div>${rows}
      <div style="min-height:24px;margin:8px 0;font-weight:bold;color:#ffe9a0">${showing}</div>
      <div style="opacity:0.85">Press 1 to 7 to place your bet and spin &nbsp;·&nbsp; E to leave</div>`;
  }
}
function setCasino(game) {
  casinoOpen = game;
  shopEl.style.display = game ? 'block' : 'none';
  if (game) { casinoNote = game === 'roulette' ? '"Place your bets, please."' : ''; drawCasino(); }
}
function playSlot(index) {
  const bet = SLOT_BETS[index];
  if (spin) return;
  if (money < bet) { sfx('error'); casinoNote = 'Not enough Gator Bucks for that bet.'; return drawCasino(); }
  money -= bet;
  casinoNet -= bet;
  sfx('click');
  spin = { kind: 'slot', time: 0, length: 1.8, bet, reels: [rollReel(), rollReel(), rollReel()] };
  casinoNote = '';
  showMoney();
}
function playRoulette(index) {
  const bet = STAKES[stake];
  if (spin) return;
  if (money < bet) { sfx('error'); casinoNote = 'Not enough Gator Bucks for that stake.'; return drawCasino(); }
  money -= bet;
  casinoNet -= bet;
  sfx('click');
  spin = { kind: 'roulette', time: 0, length: 5, bet, choice: index, number: Math.floor(Math.random() * 37) };
  showMoney();
  drawCasino();
}
function payOut(win, text) {
  if (win) { money += win; casinoNet += win; sfx(win >= spin.bet * 10 ? 'levelup' : 'coin'); }
  casinoNote = text;
  if (!casinoOpen) toast(text); // he walked off before it finished
  spin = null;
  showMoney();
  persist();
  if (casinoOpen) drawCasino();
}
function casinoKey(code) {
  const digit = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7'].indexOf(code);
  if (casinoOpen === 'slot') { if (digit >= 0 && digit < 3) playSlot(digit); return; }
  if (spin) return;
  if (digit >= 0) return playRoulette(digit);
  if (code === 'Digit9') stake = Math.min(STAKES.length - 1, stake + 1);
  else if (code === 'Digit8') stake = Math.max(0, stake - 1);
  else if (code === 'Digit0') luckyNumber = (luckyNumber + 1) % 37;
  else if (code === 'Minus') luckyNumber = (luckyNumber + 36) % 37;
  else return;
  drawCasino();
}
// The cashier in the cage hands out one free chip a day and keeps count of how he is doing.
function visitCage() {
  const tally = casinoNet > 0 ? `You are up ${gs(casinoNet)} so far.` : casinoNet < 0 ? `You are down ${gs(-casinoNet)} so far.` : '';
  if (compDay !== day) {
    compDay = day;
    money += 25;
    sfx('coin');
    showMoney();
    persist();
    return toast(`"Welcome to the Lucky Palm." The cashier slides you a free G$ 25 chip. ${tally}`);
  }
  toast(`"You have had today's free chip. Come back tomorrow." ${tally}`);
}
// Each frame: the wheel turns, the ball runs round it, and the reels roll.
function updateCasino(dt) {
  const step = Math.PI * 2 / 37, { turning, orbit, ball } = casino.wheel;
  if (testView.has('casino') && !casinoTested && casinoSpot() === testView.get('casino')) { // ?casino=slot or roulette plays one go
    casinoTested = true;
    setCasino(testView.get('casino'));
    if (casinoOpen === 'slot') playSlot(0); else playRoulette(0);
  }
  let pace = 0.5, lead = 0, radius = 0.34;
  if (spin) {
    spin.time += dt;
    const done = Math.min(1, spin.time / spin.length);
    if (spin.kind === 'roulette') {
      pace = 0.5 + 5 * (1 - done);
      lead = 16 * (1 - done) ** 2;              // the ball runs the other way and slows into its pocket
      radius = 0.34 + 0.07 * (1 - done) ** 2;
      lastNumber = spin.number;
      if (done >= 1) {
        const [name, wins, pays] = ROULETTE_BETS[spin.choice], won = wins(spin.number);
        const bet = spin.choice === 6 ? `number ${luckyNumber}` : name.toLowerCase();
        payOut(won ? spin.bet * pays : 0, won ? `${numberName(spin.number)}! Your bet on ${bet} wins ${gs(spin.bet * pays)}.` : `${numberName(spin.number)}. Your bet on ${bet} loses.`);
      }
    } else {
      redraw -= dt;
      reelsShown = spin.reels.map((final, i) => (done >= (i + 1) / 3 ? final : Math.floor(Math.random() * 6))); // they stop one at a time
      if (done >= 1) {
        const [a, b, c] = spin.reels, cherries = spin.reels.filter((s) => s === 0).length;
        const times = a === b && b === c ? TRIPLE[a] : cherries === 2 ? 2 : a === b || b === c || a === c ? 1 : 0;
        payOut(spin.bet * times, a === b && b === c ? (a === 5 ? `JACKPOT! Three gators pay ${gs(spin.bet * times)}!` : `Three of a kind! You win ${gs(spin.bet * times)}.`)
          : times === 2 ? `Two cherries: you win ${gs(spin.bet * 2)}.` : times === 1 ? `A pair: you get your ${gs(spin.bet)} back.` : 'Nothing this time.');
      } else if (redraw <= 0 && casinoOpen === 'slot') { redraw = 0.07; drawCasino(); }
    }
  }
  turning.rotation.y += dt * pace;
  orbit.rotation.y = turning.rotation.y - (WHEEL.indexOf(lastNumber) + 0.5) * step - lead;
  ball.position.x = radius;
}
// --- Strangling ---------------------------------------------------------------------------------
// Hold G next to someone (shop staff too, across the counter) to take them by the throat.
// Keep holding and they go limp; let go early and they get their breath back.
let grip = null;           // { victim, time, spot } while his hands are on someone
let chokeWeight = 0, chokeLean = 0, gripSpent = false, grabbable = null;
const chokeAt = new THREE.Vector3();
function updateStrangle(dt, input) {
  const holding = (keys.has('KeyG') || testView.has('choke')) && player.downTime < 0 && jailed <= 0 && !arresting && !workout && !!player.bones;
  if (!keys.has('KeyG')) gripSpent = false;
  const here = player.group.position;
  grabbable = grip || gripSpent ? null : findGrab(npcs, here, player.group.rotation.y);
  if (!grip && holding && grabbable) {
    grip = { victim: grabbable, time: 0, spot: new THREE.Vector3() };
    gun.equipped = false;
    if (!grip.victim.gang) commitCrime();
  }
  if (grip) {
    const there = grip.victim.group.position;
    const facing = Math.atan2(there.x - here.x, there.z - here.z);
    if (!holding) { // let go: they stagger back, and they are not pleased
      if (!grip.victim.cashier) provokeNpc(grip.victim);
      grip = null;
    } else {
      grip.time = testView.has('choke') ? Number(testView.get('choke')) || 1 : grip.time + dt;
      grip.spot.set(here.x + Math.sin(facing) * 0.72, 0, here.z + Math.cos(facing) * 0.72);
      player.group.rotation.y = facing;
      Object.assign(input, { x: 0, z: 0, sprint: false, jump: false, crouch: false, lockFacing: true });
      if (Math.floor(grip.time / 0.75) !== Math.floor((grip.time - dt) / 0.75) && grip.time < CHOKE_TIME * 0.8) sfx('choke');
      neckSpot(grip.victim, chokeAt);
      if (grip.time >= CHOKE_TIME) {
        const victim = grip.victim;
        if (strangle(victim, here)) dropCash(victim.group.position, victim.gang ? [10, 20, 50][Math.floor(Math.random() * 3)] : undefined);
        grip = null;
        gripSpent = true; // he has to let go of G before grabbing anyone else
      }
    }
  }
  chokeWeight += ((grip ? 1 : 0) - chokeWeight) * Math.min(1, 6 * dt); // his arms ease out and ease back
  if (grip) chokeLean = grip.victim.cashier ? 1 : 0;
  input.chokeLean = chokeLean;
  input.choke = chokeWeight;
  input.chokeAt = chokeAt;
}
// --- Miami Fight Club -----------------------------------------------------------------------------
// The open-air ring beside Club Neon. Put a stake on yourself at the bookie's booth, pick a
// fighter, and win the bout to be paid out. It is all legal: no police for what happens in the ring.
const fightClub = createBoxingRing(scene);
let boxOpen = false, boxStake = 1, bout = null, boxNote = '';
const boxEl = overlay('display:none;left:50%;top:14px;transform:translateX(-50%);font-weight:bold;font-size:16px;color:#fff3e0;background:rgba(20,22,28,0.88);padding:8px 16px;border-radius:8px;min-width:320px;text-align:center');
const inRing = (npc) => !!bout && npc === bout.npc;
const atBookie = () => !bout && player.group.position.y < 2 && near(fightClub.counter.x, fightClub.counter.z, 1.6);
function drawBox() {
  const rows = FIGHTERS.map((fighter, i) => `<div style="display:flex;gap:14px;padding:7px 0;border-top:1px solid rgba(243,230,192,0.25)">
    <b style="width:26px">${i + 1}</b><span style="flex:1"><b>${fighter.name}</b><br><small>${fighter.champion ? 'Unbeaten. Faster, stronger and far tougher than the rest' : ['An easy start', 'Hits harder than he looks', 'Quick and mean'][i]}</small></span>
    <b>pays ${fighter.odds}×</b></div>`).join('');
  shopEl.innerHTML = `<div style="font-size:22px;font-weight:bold;margin-bottom:4px">Miami Fight Club</div>
    <div style="margin-bottom:6px">"Who do you want, and what are you putting on yourself?" &nbsp;·&nbsp; You have <b>${gs(money)}</b></div>
    <div style="margin-bottom:6px">Your stake: <b>${gs(STAKES[boxStake])}</b> <small>(9 raises it, 8 lowers it)</small></div>${rows}
    <div style="min-height:22px;margin:8px 0;font-weight:bold;color:#ffe9a0">${boxNote}</div>
    <div style="opacity:0.85">Press 1 to 4 to fight &nbsp;·&nbsp; E to leave<br><small>In the ring: left mouse punches · X kicks · Z throws him down · step back to dodge</small></div>`;
}
function setBox(open) {
  boxOpen = open;
  shopEl.style.display = open ? 'block' : 'none';
  if (open) { boxNote = ''; drawBox(); }
}
function boxKey(code) {
  const pick = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(code);
  if (pick >= 0) return startBout(pick);
  if (code === 'Digit9') boxStake = Math.min(STAKES.length - 1, boxStake + 1);
  else if (code === 'Digit8') boxStake = Math.max(0, boxStake - 1);
  else return;
  drawBox();
}
function startBout(index) {
  const fighter = FIGHTERS[index], npc = npcs.find((one) => one.fighter === index), stake = STAKES[boxStake];
  if (bout) return;
  if (!npc || npc.state === 'dead') { boxNote = `${fighter.name} is not ready yet. Give him a moment.`; return drawBox(); }
  if (money < stake) { sfx('error'); boxNote = 'You do not have that much cash on you.'; return drawBox(); }
  money -= stake;
  showMoney();
  setBox(false);
  bout = { npc, fighter, stake, next: 2.2, over: 0, won: false, ending: false, ready: false };
  fadeEl.style.opacity = 1;
  setTimeout(() => {
    player.group.position.copy(fightClub.red);
    player.group.rotation.y = Math.PI / 2;
    cam.yaw = Math.PI * 1.5;
    npc.group.position.copy(fightClub.blue);
    Object.assign(npc, { health: fighter.hp, quick: fighter.quick, inBout: true, state: 'idle', timer: 99 });
    health = 100;
    showHealth();
    bout.ready = true;
    fadeEl.style.opacity = 0;
    sfx('levelup');
    toast(`Ding ding! You against ${fighter.name}, ${gs(stake)} on yourself. Left mouse punches, X kicks, Z throws him down.`);
  }, 900);
}
// Some of what he throws at a good boxer is blocked.
function ringBlow(target, damage) {
  if (!inRing(target) || Math.random() >= bout.fighter.block) return damage;
  sfx('click');
  bout.blocked = 0.9;
  return damage * 0.25;
}
// The other boxer's glove lands on him.
function boxingHit(npc) {
  if (bout.over > 0) return;
  health = Math.max(0, health - bout.fighter.power);
  lastHurtAt = gameTime;
  hurt = 1;
  player.slap = 0.7;
  cam.yaw += 0.08;
  showHealth();
  if (health <= 10) {
    knockDown(player, npc.group.position);
    if (Math.random() < 0.3) breakBone('arm');
    bout.over = 3.4;
    toast(`You are knocked out! ${bout.fighter.name} wins, and the bookie keeps your ${gs(bout.stake)}.`);
  }
}
function endBout() {
  bout.ending = true;
  fadeEl.style.opacity = 1;
  setTimeout(() => {
    player.group.position.copy(fightClub.exit);
    cam.yaw = Math.PI;
    reviveNpc(bout.npc);
    bout.npc.inBout = false;
    bout.npc.quick = 1;
    health = Math.max(health, 50);
    showHealth();
    bout = null;
    fadeEl.style.opacity = 0;
    persist();
  }, 900);
}
let ringGloves = null;
function updateBoxing(dt) {
  if (testView.has('box') && !bout && !updateBoxing.tried && npcs.some((one) => one.fighter !== undefined)) { updateBoxing.tried = true; startBout(Number(testView.get('box')) || 0); } // ?box=3 starts a bout
  if (!ringGloves && player.bones) { // his own gloves, which he only wears in the ring
    const leather = new THREE.MeshStandardMaterial({ color: 0x2456c9, roughness: 0.45 });
    ringGloves = [player.bones.handL, player.bones.handR].map((hand) => {
      const glove = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), leather);
      glove.scale.set(1, 1.3, 1.05);
      glove.position.set(0, 0.075, 0.01);
      hand.add(glove);
      return glove;
    });
  }
  if (testView.has('boxsim') && bout?.ready && !updateBoxing.sim) { // ?boxsim plays the whole bout out at once and reports how it went
    updateBoxing.sim = true;
    setTimeout(() => {
      let frames = 0;
      while (frames < 900 && bout && !bout.over) { step(1 / 30); frames++; }
      console.log(`TEST boxsim: ${frames} frames, ${bout?.won ? 'WON' : bout?.over ? 'LOST' : 'unfinished'}, his health ${Math.round(bout?.npc.health)}, mine ${Math.round(health)}, cash ${money}`);
    }, 0);
  }
  for (const glove of ringGloves || []) glove.visible = !!bout?.ready;
  boxEl.style.display = bout?.ready ? 'block' : 'none';
  if (!bout?.ready || bout.ending) return;
  const { npc, fighter } = bout;
  gun.equipped = false;
  knifeOut = false;
  bout.blocked = Math.max(0, (bout.blocked || 0) - dt);
  const left = Math.max(0, Math.round(npc.state === 'dead' && !npc.getUp ? 0 : npc.health));
  boxEl.innerHTML = `${fighter.name}${bout.blocked > 0 ? ' &nbsp;<span style="color:#ffd75a">BLOCKED!</span>' : ''}
    <div style="height:10px;margin-top:6px;background:rgba(255,255,255,0.18);border-radius:5px"><div style="height:10px;border-radius:5px;background:#e0352b;width:${(left / fighter.hp * 100).toFixed(0)}%"></div></div>`;
  if (bout.over > 0) {
    bout.over -= dt;
    if (bout.over <= 0) endBout();
    return;
  }
  if (npc.state === 'dead' && !npc.getUp) { // he is out cold: you win
    const prize = bout.stake * fighter.odds;
    money += prize;
    showMoney();
    sfx('levelup');
    bout.over = 3.4;
    bout.won = true;
    toast(fighter.champion ? `YOU BEAT THE CHAMPION! The whole place goes wild. The bookie pays you ${gs(prize)}.` : `Knockout! You beat ${fighter.name}. The bookie pays you ${gs(prize)}.`);
  } else if (npc.state === 'idle') { // he gathers himself, then comes at you again
    bout.next -= dt;
    if (bout.next <= 0) { provokeNpc(npc); bout.next = fighter.wait * (0.7 + Math.random() * 0.6); }
  }
}

// --- Kicking and throwing people down --------------------------------------------------------------
// X: a front kick that knocks them back. Z: grab someone close and throw them to the floor.
// Both work anywhere, but outside the ring they are crimes.
const KICK_TIME = 0.5, THROW_TIME = 0.75;
let kickTime = 0, kickLanded = false, throwTime = 0, thrown = false, throwTarget = null;
const canMelee = () => !driving && !boating && player.downTime < 0 && jailed <= 0 && !arresting && !grip && !workout && !!player.bones
  && !shopOpen && !martOpen && !casinoOpen && !atmOpen && !boxOpen && kickTime <= 0 && throwTime <= 0 && punchTime <= 0;
function meleeTarget(reach) {
  const at = player.group.position, facing = player.group.rotation.y;
  let target = null;
  for (const npc of targets()) {
    if (npc.state === 'dead') continue;
    const dx = npc.group.position.x - at.x, dz = npc.group.position.z - at.z, distance = Math.hypot(dx, dz);
    if (distance < reach && Math.abs(npc.group.position.y - at.y) < 1 && (dx * Math.sin(facing) + dz * Math.cos(facing)) / distance > 0.4) { reach = distance; target = npc; }
  }
  return target;
}
function startKick() {
  if (!canMelee()) return;
  kickTime = KICK_TIME;
  kickLanded = false;
  sfx('whoosh');
}
function startThrow() {
  if (!canMelee()) return;
  throwTarget = meleeTarget(1.5);
  if (!throwTarget) return toast('Nobody close enough to throw. Get right up to them.');
  throwTime = THROW_TIME;
  thrown = false;
  sfx('whoosh');
}
function landBlow(target, damage, shove) {
  const here = player.group.position, facing = player.group.rotation.y;
  const knockedOut = hitNpc(target, here, ringBlow(target, damage * (1 + 0.15 * stats.strength)));
  playStrike('punch');
  if (!knockedOut && shove) { target.group.position.x += Math.sin(facing) * shove; target.group.position.z += Math.cos(facing) * shove; }
  if (knockedOut && !inRing(target)) dropCash(target.group.position, target.gang ? [10, 20, 50][Math.floor(Math.random() * 3)] : undefined);
  if (!target.gang && !inRing(target)) commitCrime();
}
function updateMelee(dt, input) {
  if (ill.leg) { input.sprint = false; input.jump = false; }                                              // a broken leg: no running, no jumping
  if (retch > 0) Object.assign(input, { x: 0, z: 0, sprint: false, jump: false, crouch: true });            // doubled over, being sick
  if (seaTrouble || trim || raceHold) Object.assign(input, { x: 0, z: 0, sprint: false, jump: false, crouch: false, lockFacing: true }); // in trouble in the sea: he can't swim on
  if (testView.has('kick')) input.kick = 1; // ?kick holds the leg out, for checking the pose
  if (kickTime > 0) {
    kickTime -= dt;
    const t = 1 - kickTime / KICK_TIME;
    input.kick = t < 0.45 ? ease(0, 0.45, t) : 1 - ease(0.45, 1, t); // up and out, then back down
    Object.assign(input, { x: 0, z: 0, sprint: false, jump: false, crouch: false, lockFacing: true });
    if (!kickLanded && t >= 0.42) {
      kickLanded = true;
      const target = meleeTarget(2.0), mutt = target ? null : dogNear(dogs, player.group.position, 1.7);
      if (target) landBlow(target, 35, 1.0);
      else if (mutt) { hurtDog(mutt, 30); playStrike('punch'); if (!mutt.breed.hostile) commitCrime(); } // a boot for a dog that is on him
    }
  }
  if (throwTime > 0) {
    throwTime -= dt;
    const t = 1 - throwTime / THROW_TIME, here = player.group.position, there = throwTarget.group.position;
    player.group.rotation.y = Math.atan2(there.x - here.x, there.z - here.z);
    Object.assign(input, { x: 0, z: 0, sprint: false, jump: false, crouch: false, lockFacing: true });
    neckSpot(throwTarget, chokeAt); // his hands go to their collar, and follow them down
    input.choke = Math.sin(Math.PI * Math.min(1, t * 1.15));
    input.chokeAt = chokeAt;
    input.chokeLean = 0.6;
    if (!thrown && t >= 0.38) {
      thrown = true;
      const target = throwTarget;
      if (target.state === 'dead') return;
      if (inRing(target) && bout.fighter.champion && target.health > bout.fighter.hp * 0.5) {
        toast('Iron Vic shrugs you off. He is too strong to throw until you have worn him down.');
        provokeNpc(target);
      } else if (target.health <= 60) {
        landBlow(target, 9999, 0);
      } else {
        target.health -= 60;
        floorNpc(target, here, 2.2);
        playStrike('punch');
        sfx('land');
        if (target.gang) provokeNpc(target);
        else if (!inRing(target)) commitCrime();
      }
    }
  }
}
// --- Talking to people ------------------------------------------------------------------------------
// People say things as he passes. Press T facing someone to talk: type anything, press Enter,
// and they answer. What is said shows as a speech bubble over the speaker's head.
const lookWay = new THREE.Vector3(), bubbleSpot = new THREE.Vector3();
const bubbles = Array.from({ length: 6 }, () => overlay('display:none;transform:translate(-50%,-100%);font-size:14px;color:#1b1c1e;background:rgba(255,255,255,0.94);padding:5px 11px;border-radius:11px;max-width:250px;text-align:center;box-shadow:0 1px 5px rgba(0,0,0,0.45)'));
const chatBox = document.createElement('input');
chatBox.type = 'text';
chatBox.maxLength = 80;
chatBox.placeholder = 'Type what you want to say, then press Enter  (Esc to cancel)';
chatBox.style.cssText = 'display:none;position:fixed;left:50%;bottom:200px;transform:translateX(-50%);width:440px;max-width:80%;font:16px system-ui,sans-serif;padding:10px 13px;border-radius:9px;border:2px solid #f3e6c0;background:rgba(28,34,22,0.96);color:#f3e9d2;outline:none';
document.body.appendChild(chatBox);
let chatOpen = false, chatWith = null, talkable = null, me = null;
function openChat(who) {
  chatOpen = true;
  chatWith = who;
  who.talkTime = 8;
  keys.clear();
  chatBox.value = '';
  chatBox.style.display = 'block';
  chatBox.focus();
}
function closeChat() {
  if (codeEntry) { codeEntry = false; chatBox.maxLength = 80; chatBox.placeholder = 'Type what you want to say, then press Enter  (Esc to cancel)'; }
  chatOpen = false;
  chatBox.style.display = 'none';
  chatBox.blur();
}
function sayIt() {
  if (codeEntry) { const typed = chatBox.value.trim().toUpperCase(); closeChat(); return tryCode(typed); } // it was the vault's keypad he was typing into
  const text = chatBox.value.trim().slice(0, 80), who = chatWith;
  closeChat();
  if (!text || !who) return;
  me ??= { group: player.group, self: true };
  speak(me, text, 4);
  setTimeout(() => { // they take a moment, then answer
    if (who.state === 'dead' || who.dead > 0 || who.away) return;
    const answer = replyTo(who, text, friends);
    if (answer.friend) addFriend(who.name);
    speak(who, answer.text, 4.5);
    if (answer.gift) { money += answer.gift; showMoney(); sfx('coin'); persist(); }
    if (answer.angry) provokeNpc(who);
  }, 900);
}
chatBox.addEventListener('keydown', (e) => {
  e.stopPropagation(); // the game must not treat these letters as controls
  if (e.key === 'Enter') sayIt();
  else if (e.key === 'Escape') closeChat();
});
chatBox.addEventListener('keyup', (e) => e.stopPropagation());
function updateTalk(dt) {
  if (testView.has('say') && !updateTalk.said && talkable) { updateTalk.said = true; chatWith = talkable; chatBox.value = testView.get('say'); sayIt(); } // ?say=hello says it to whoever is in front of him
  if (testView.has('crowdsim') && !updateTalk.sim && npcs.length && player.bones) { // ?crowdsim runs a minute of street life at once and reports on it
    updateTalk.sim = true;
    setTimeout(() => {
      let worstStuck = 0, wallTime = 0;
      for (let frame = 0; frame < 1800; frame++) {
        step(1 / 30);
        for (const one of npcs) if (one.stream && !one.away) { worstStuck = Math.max(worstStuck, one.blocked || 0); if (one.stuck > 0.3) wallTime++; }
      }
      const crowd = npcs.filter((one) => one.stream), here = crowd.filter((one) => !one.away);
      console.log(`TEST crowdsim: ${crowd.length} people, ${here.length} near him, ${here.filter((one) => one.group.visible).length} drawn, ${crowd.length - here.length} waiting off the map; ` +
        `most turn-backs in a row ${worstStuck}, frames spent pushing at something ${wallTime}, nearest ${Math.min(...here.map((one) => Math.hypot(one.group.position.x - player.group.position.x, one.group.position.z - player.group.position.z))).toFixed(1)} m`);
    }, 0);
  }
  if (testView.has('sim') && !updateTalk.ran && npcs.cashiers?.length && player.bones) { // ?sim=600 runs that many frames at once, then reports where things stand
    updateTalk.ran = true;
    setTimeout(() => {
      for (let frame = 0; frame < Number(testView.get('sim')); frame++) step(1 / 30);
      const p = player.group.position;
      console.log(`TEST sim: cam y ${camera.position.y.toFixed(1)} at ${p.x.toFixed(0)},${p.y.toFixed(1)},${p.z.toFixed(0)} trip ${trip ? trip.time.toFixed(0) : 'no'} plane ${driving && truck.plane ? `speed ${truck.speed.toFixed(0)} alt ${truck.group.position.y.toFixed(0)}` : 'no'} liner ${airport.liner.phase} traffic ${traffic.filter((car) => car.active).length} dents ${truck.dents || 0} bites ${bites} swarm ${swarm.toFixed(0)} spray ${sprayed.toFixed(0)} boat ${boating ? `speed ${boating.speed.toFixed(0)}` : 'no'} mug ${mug ? mug.phase : "no"} laps ${training.laps} fit ${player.fit} race ${race ? `${race.phase} ${race.metres.toFixed(0)}m` : "no"} gold ${training.gold} J$${Math.round(jmoney)} storm ${storm.toFixed(2)} day ${day} ill ${JSON.stringify(ill)} slow ${player.slow} health ${Math.round(health)} stars ${stars} resisting ${resisting} cash ${money} downed ${downed} trouble ${!!seaTrouble} flag ${flagShown} | ${toastEl.textContent}`);
    }, 0);
  }
  if (chatOpen) { // while he is typing, nothing else happens, and they wait to hear it
    punchQueued = false;
    shotQueued = false;
    keys.clear();
    if (chatWith) chatWith.talkTime = 6;
  }
  talkable = !chatOpen && !driving && !boating && jailed <= 0 && player.bones ? findListener(npcs, player.group.position, player.group.rotation.y) : null;
  for (let i = speeches.length - 1; i >= 0; i--) { speeches[i].time -= dt; if (speeches[i].time <= 0) speeches.splice(i, 1); }
  bubbles.forEach((bubble, i) => {
    const speech = speeches[i], body = speech?.who.group;
    if (!speech || speech.who.away || !body.visible) return (bubble.style.display = 'none');
    bubbleSpot.set(body.position.x, body.position.y + 2.05, body.position.z);
    const distance = bubbleSpot.distanceTo(camera.position);
    bubbleSpot.project(camera);
    if (bubbleSpot.z > 1 || distance > 30 || Math.abs(bubbleSpot.x) > 1.15) return (bubble.style.display = 'none');
    bubble.style.display = 'block';
    bubble.style.left = `${(bubbleSpot.x * 0.5 + 0.5) * innerWidth}px`;
    bubble.style.top = `${(-bubbleSpot.y * 0.5 + 0.5) * innerHeight}px`;
    bubble.style.opacity = Math.min(1, speech.time * 2.5);
    bubble.style.background = speech.who.self ? 'rgba(255,240,170,0.96)' : 'rgba(255,255,255,0.94)';
    bubble.textContent = (speech.who.self ? 'You: ' : speech.who.name ? `${speech.who.name}: ` : '') + speech.text;
  });
}
// --- The beach: flags and the lifeguard -----------------------------------------------------------
// The flag on the lifeguard station changes every day. Green is safe. Under the others,
// swimming in the sea can go wrong: cramp (yellow), a huge wave (red), or something with teeth
// (purple). The lifeguard always comes for you. He is not very good: he gets to you in time about
// one time in twenty.
const FLAGS = {
  green: { colour: 0x2fae4a, name: 'Green flag', note: 'calm sea, go and swim', risk: 0 },
  yellow: { colour: 0xf2c230, name: 'Yellow flag', note: 'swim with caution', risk: 0.012, trouble: 'CRAMP! You are going under!', cause: 'You drowned with cramp before the lifeguard could reach you.' },
  red: { colour: 0xd9281e, name: 'Red flag', note: 'high waves, stay out of the water', risk: 0.1, trouble: 'A HUGE WAVE DRAGS YOU UNDER!', cause: 'The waves took you before the lifeguard could reach you.' },
  purple: { colour: 0x7a3fc0, name: 'Purple flag', note: 'dangerous sea life, stay out of the water', risk: 0.08, trouble: 'SOMETHING HAS YOU BY THE LEG!', cause: 'Something in the water got you before the lifeguard could.' },
};
const FLAG_DAYS = ['green', 'yellow', 'green', 'red', 'green', 'yellow', 'green', 'purple', 'green', 'yellow', 'red', 'green', 'green'];
const RESCUE_CHANCE = 0.05;
const troubleEl = overlay('display:none;left:50%;top:22%;transform:translateX(-50%);font-weight:bold;font-size:28px;color:#fff3e0;background:rgba(150,25,15,0.85);padding:12px 24px;border-radius:10px;text-align:center');
let splashWait = 0, splashSide = false, jawWait = 0, sharkToldAt = -99;
let seaTrouble = null, swimTime = 0, flagShown = '', flagToldDay = 0, lifeguard = null;
function updateBeach(dt) {
  // The flag changes every three hours of the game's day, and is green more often than anything else.
  const key = storm > 0.3 ? 'red' : FLAGS[testView.get('flag')] ? testView.get('flag') : // (in a hurricane the red flag flies)
    FLAG_DAYS[(day * 8 + Math.floor(hourNow / 3)) % FLAG_DAYS.length], flag = FLAGS[key];
  if (flagShown !== key) { flagShown = key; seaParts.guard.flag.color.setHex(flag.colour); airport.beachFlag.color.setHex(flag.colour); }
  lifeguard ??= (npcs.cashiers || []).find((one) => one.spot?.lifeguard) || null;
  if (lifeguard) lifeguard.flagLine = `${flag.name} today: ${flag.note}.${flag.risk ? ' If you go in anyway, I will do my best. No promises.' : ''}`;
  const here = player.group.position;
  const atIsland = here.x > 2400;
  if (((here.x > seaParts.shoreX - 38 && here.x < seaParts.shoreX + 450) || (atIsland && here.z > -20 && here.x < 2800)) && flagToldDay !== key && !driving) { // arriving at the beach, or the flag being changed while he is there
    flagToldDay = key;
    toast(`${flag.name} on the beach now: ${flag.note}.`);
  }
  const inSea = !driving && !boating && !downed && jailed <= 0 && ((here.x > seaParts.shoreX && here.x < seaParts.shoreX + 450) || atIsland) && waterDepthAt(here) > 0.9; // off the mainland beach, or anywhere round Jamaica
  if (!seaTrouble) {
    swimTime = inSea ? swimTime + dt : 0;
    if (inSea && flag.risk && (testView.has('drown') || (swimTime > 3 && Math.random() < flag.risk * dt))) { // it goes wrong
      seaTrouble = { time: 0, flag, island: atIsland };
      sfx(key === 'purple' ? 'growl' : 'splash');
      troubleEl.innerHTML = `${flag.trouble}<div style="font-size:17px;font-weight:normal;margin-top:4px">${atIsland ? 'There is no lifeguard on this beach. Fight for it!' : 'The lifeguard is coming…'}</div>`;
      troubleEl.style.display = 'block';
      if (lifeguard && !atIsland) speak(lifeguard, 'HOLD ON! I AM COMING!', 4);
    }
    if (lifeguard?.runTo && Math.hypot(lifeguard.group.position.x - lifeguard.home.x, lifeguard.group.position.z - lifeguard.home.z) < 0.9) { // back on his spot
      lifeguard.runTo = null;
      lifeguard.group.rotation.y = lifeguard.facing;
    }
    return;
  }
  // In trouble: he thrashes about while the lifeguard runs down the beach and swims out.
  seaTrouble.time += dt;
  hurt = Math.max(hurt, 0.35 + 0.25 * Math.sin(seaTrouble.time * 9));
  cam.yaw += Math.sin(seaTrouble.time * 11) * 0.5 * dt;
  if (Math.floor(seaTrouble.time / 0.9) !== Math.floor((seaTrouble.time - dt) / 0.9)) sfx('swim');
  if (seaTrouble.island) { // nobody is coming: after a few seconds he either fights his way clear, or he does not
    if (seaTrouble.time < 6) return;
    troubleEl.style.display = 'none';
    if (testView.get('rescue') === 'yes' || (testView.get('rescue') !== 'no' && Math.random() < 0.5)) {
      health = Math.max(15, health - 45);
      showHealth();
      toast('You kick and claw your way back to the surface, coughing. That was close. Mind the flag next time.');
    } else {
      deathCause = seaTrouble.flag.cause.replace(' before the lifeguard could reach you', '').replace(' before the lifeguard could', '');
      hurtPlayer(9999);
    }
    seaTrouble = null;
    swimTime = 0;
    return;
  }
  if (lifeguard && lifeguard.dead <= 0) lifeguard.runTo = here;
  const reached = lifeguard && lifeguard.dead <= 0 && Math.hypot(lifeguard.group.position.x - here.x, lifeguard.group.position.z - here.z) < 1.6;
  if (!reached && seaTrouble.time < 16) return;
  // He is there (or it has simply been too long). One time in twenty he is in time.
  const saved = reached && (testView.get('rescue') === 'yes' || (testView.get('rescue') !== 'no' && Math.random() < RESCUE_CHANCE));
  troubleEl.style.display = 'none';
  if (lifeguard) lifeguard.runTo = lifeguard.home;
  if (saved) {
    fadeEl.style.opacity = 1;
    const spot = seaParts.guard.ashore;
    setTimeout(() => {
      here.copy(spot);
      health = Math.max(25, Math.min(health, 40));
      showHealth();
      knockDown(player, lifeguard.group.position);
      fadeEl.style.opacity = 0;
      toast('The lifeguard hauls you out and pumps the water out of you. You are ALIVE. That almost never happens.');
      if (lifeguard) speak(lifeguard, 'Got one! I actually got one!', 5);
    }, 900);
  } else {
    deathCause = seaTrouble.flag.cause;
    if (lifeguard) speak(lifeguard, 'Ah. Not again.', 5);
    hurtPlayer(9999);
  }
  seaTrouble = null;
  swimTime = 0;
}
// --- Under the sea -------------------------------------------------------------------------------
// Out in deep water, hold C to dive and Space to come up. He can hold his breath for half a
// minute; when it runs out he swims up by himself. Below the surface everything turns blue-green
// and you can only see so far, the way it is under real water.
const BREATH = 30;
let breath = BREATH, wasUnder = false, mirrored = false;
const breathEl = overlay('display:none;left:18px;top:128px;width:172px;height:10px;background:rgba(0,0,0,0.45);border-radius:5px;overflow:hidden');
const breathBar = document.createElement('div');
breathBar.style.cssText = 'height:100%;background:#5fc8f0;border-radius:5px';
breathEl.appendChild(breathBar);
const underEl = overlay('inset:0;background:rgba(20,110,130,0.28);opacity:0;transition:opacity 0.25s');
const fogKeep = new THREE.Color();
// Down there, nothing further off than this can be seen, so nothing further off is drawn.
// A plain shell of water-colour round the camera stands in for the distance.
const murk = new THREE.Mesh(new THREE.SphereGeometry(70, 16, 12), new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, depthWrite: false }));
murk.renderOrder = -5;
murk.visible = false;
scene.add(murk);
function underwaterLook(dt) {
  if (!mirrored && player.bones) { mirrored = true; player.group.traverse((part) => part.layers.enable(1)); } // so the water shows his reflection
  // His breath: it runs down while his head is under, and comes back quickly at the surface.
  const headUnder = !driving && !boating && (player.dive || 0) > 0.55;
  breath = THREE.MathUtils.clamp(breath + (headUnder ? -dt : dt * 5), 0, BREATH);
  if (breath <= 0 && headUnder && !underwaterLook.told) { underwaterLook.told = true; toast('Out of breath! He heads for the surface.'); }
  if (!headUnder) underwaterLook.told = false;
  breathEl.style.display = breath < BREATH - 0.2 ? 'block' : 'none';
  breathBar.style.width = `${(breath / BREATH) * 100}%`;
  // The camera below the surface of the sea: thick blue-green water all round.
  // A hint, so he knows he can go under (and why not, when he can't).
  const swimmingNow = !driving && !boating && jailed <= 0 && waterDepthAt(player.group.position) > 0.95 && !seaTrouble;
  if (swimmingNow && usePrompt.style.display !== 'block') {
    const inSeaNow = player.group.position.x > seaParts.shoreX, deepEnough = seaBedAt(player.group.position) > 1.6;
    usePrompt.textContent = !inSeaNow ? 'The lake is too shallow and murky to dive in. Try the sea.'
      : !deepEnough ? 'Swim further out to dive: it is too shallow here'
      : headUnder ? 'Hold C to go deeper  ·  Space to come up' : 'Hold C to dive under the water';
    usePrompt.style.display = 'block';
  }
  const under = camera.position.y < 0.17 && camera.position.x > seaParts.shoreX;
  if (under) {
    if (!wasUnder) { fogKeep.copy(scene.fog.color); sfx('splash'); camera.far = 76; camera.updateProjectionMatrix(); }
    scene.fog.near = 0.5;
    scene.fog.far = 46;
    scene.fog.color.setRGB(0.07, 0.36, 0.42).multiplyScalar(0.25 + 0.75 * daylight.value);
    murk.material.color.copy(scene.fog.color);
    murk.position.copy(camera.position);
  } else if (wasUnder) {
    scene.fog.near = 260;
    scene.fog.far = 1500;
    scene.fog.color.copy(fogKeep);
    camera.far = 2000;
    camera.updateProjectionMatrix();
  }
  sky.visible = !under;
  murk.visible = under;
  underEl.style.opacity = under ? 1 : 0;
  wasUnder = under;
  if (!under) { scene.fog.near = 260 - 240 * storm; scene.fog.far = 1500 - 1330 * storm; } // in a hurricane you cannot see far through the rain
}
// --- The vault job --------------------------------------------------------------------------------
// A stranger outside Aqua Tower sends him to Lenny, beside the beer shop. Lenny hands over four
// photographs. Each is of somebody there is only one of, and each of them knows one character of
// the four-character code for the vault in Gator Bank. Type the code into the keypad by the vault
// door, and the money inside is his. It can be done again a few days later, with a new code.
const CODE_LETTERS = 'ABCDEFGHJKLMNPRSTUVWXYZ23456789', VAULT_PRIZE = 25000;
// stage: 0 not started, 1 sent to Lenny, 2 has the photographs, 3 the vault is open, 4 emptied (until the day in `until`).
const job = Object.assign({ stage: 0, code: '', known: [false, false, false, false], until: 0 }, saved.job);
const holders = VAULT_PEOPLE.holders, pictures = holders.map(portrait);
let photosOpen = false, codeEntry = false, vaultSwing = job.stage >= 3 ? 1 : 0;
const jobEl = overlay('display:none;left:18px;top:150px;font-size:13px;color:#f3e9d2;background:rgba(28,34,22,0.82);padding:6px 8px;border-radius:8px');
function drawJob() {
  jobEl.style.display = job.stage === 2 || job.stage === 3 ? 'block' : 'none';
  jobEl.innerHTML = `<div style="font-weight:bold;margin-bottom:4px">${job.stage === 3 ? 'THE VAULT IS OPEN' : 'VAULT CODE'}</div><div style="display:flex;gap:5px">` +
    holders.map((person, i) => `<div style="text-align:center"><img src="${pictures[i]}" style="width:42px;display:block;border-radius:3px;opacity:${job.known[i] ? 1 : 0.55}">
      <b style="font-size:19px;color:${job.known[i] ? '#ffe27a' : '#f3e9d2'}">${job.known[i] ? job.code[i] : '?'}</b></div>`).join('') + '</div>';
}
drawJob();
function showPhotos(open = true) {
  photosOpen = open;
  shopEl.style.display = open ? 'block' : 'none';
  if (!open) return;
  shopEl.innerHTML = `<div style="font-size:22px;font-weight:bold;margin-bottom:4px">Lenny's four photographs</div>
    <div style="margin-bottom:10px">Each of them knows one piece of the vault code. Find them and press E. There is only one of each.</div>
    <div style="display:flex;gap:12px">${holders.map((person, i) => `<div style="width:124px;text-align:center"><img src="${pictures[i]}" style="width:120px;border:2px solid #f3e6c0;border-radius:4px">
      <div style="margin-top:4px"><small>${['1st', '2nd', '3rd', '4th'][i]} piece · ${person.hint}</small></div><b style="color:#ffe27a">${job.known[i] ? `Told you: ${job.code[i]}` : ''}</b></div>`).join('')}</div>
    <div style="margin-top:12px;opacity:0.8">E to put them away. They stay in the corner of the screen.</div>`;
}
// Somebody in the job (or the keypad, or the cash) close enough to use.
function jobNear() {
  const here = player.group.position;
  if (driving || boating) return null;
  const by = (spot, reach) => Math.abs(here.y - (spot.y || 0)) < 1.6 && near(spot.x, spot.z, reach);
  if (by(VAULT_PEOPLE.stranger, 2.3)) return { who: VAULT_PEOPLE.stranger };
  if (by(VAULT_PEOPLE.lenny, 2.3)) return { who: VAULT_PEOPLE.lenny };
  const index = holders.findIndex((person) => by(person, 2.4));
  if (index >= 0) return { who: holders[index], index };
  if (by(gatorBank.userData.keypad, 1.3)) return { keypad: true };
  if (job.stage === 3 && by(gatorBank.userData.loot, 2.2)) return { loot: true };
  return null;
}
// One of them says something: a speech bubble over their head, and the words on screen as well.
function sayAs(spot, text) {
  const body = (npcs.cashiers || []).find((one) => one.spot === spot);
  if (body) speak(body, text, 7);
  toast(`${spot.name}: "${text}"`);
}
function jobUse(target) {
  if (target.keypad) {
    if (job.stage === 3) return toast('The vault is already open. Get in there.');
    if (job.stage === 4) return toast('The keypad is dead. The bank changed everything after the last robbery.');
    codeEntry = true;
    chatOpen = true;
    chatWith = null;
    keys.clear();
    chatBox.value = '';
    chatBox.maxLength = 4;
    chatBox.placeholder = 'Vault code: 4 letters or numbers, then Enter';
    chatBox.style.display = 'block';
    chatBox.focus();
    return;
  }
  if (target.loot) {
    money += VAULT_PRIZE;
    job.stage = 4;
    job.until = day + 3;
    sfx('levelup');
    commitCrime();
    showMoney(); drawJob(); persist();
    return toast(`You stuff your pockets: G$ ${VAULT_PRIZE.toLocaleString('en-US')} in cash! Now run, and get it into a cash machine before something happens to you.`);
  }
  const { who, index } = target;
  if (who === VAULT_PEOPLE.stranger) {
    if (job.stage === 0) { job.stage = 1; persist(); return sayAs(who, 'Psst. You. Want to be rich? Go and see Lenny. He stands beside the Cold Ones beer shop, top of Brew St. Tell him the stranger sent you.'); }
    return sayAs(who, job.stage === 4 ? 'Nice work. Lie low for a few days, then come and find me.' : job.stage === 1 ? 'I told you. Lenny. Beside the beer shop at the top of Brew St.' : 'You have the photographs. What are you standing here for?');
  }
  if (who === VAULT_PEOPLE.lenny) {
    if (job.stage === 0) return sayAs(who, 'Do I know you? No. Get lost.');
    if (job.stage === 3) return sayAs(who, 'It is OPEN? Then what are you doing here? Go!');
    if (job.stage === 4) return sayAs(who, 'Beautiful job. Give it a few days and we go again.');
    if (job.stage === 1) { // he hands over the photographs, and a new code is set
      job.stage = 2;
      job.code = Array.from({ length: 4 }, () => CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]).join('');
      job.known = [false, false, false, false];
      sfx('pickup');
      sayAs(who, 'The stranger sent you? Good. Four people each know one piece of the code for the vault in Gator Bank. Here are their pictures.');
    } else sayAs(who, 'Lost them already? Here. Look again.');
    drawJob(); persist();
    return showPhotos();
  }
  // One of the four in the photographs.
  if (job.stage !== 2) return sayAs(who, job.stage >= 3 ? 'Vault? What vault? I never said a word.' : ['The cards say you have money trouble.', 'What are you looking at?', 'Do not interrupt a man at the tables.', 'Shh. You will scare the fish.'][index]);
  const piece = job.code[index];
  job.known[index] = true;
  sfx('pickup');
  drawJob(); persist();
  sayAs(who, `${['The first', 'The second', 'The third', 'The fourth'][index]} one is ${/\d/.test(piece) ? 'the number' : 'the letter'} ${piece}. You did not hear it from me.`);
  if (job.known.every(Boolean)) setTimeout(() => toast(`You have the whole code: ${job.code}. Gator Bank is on the main road, between Hotel Tropic and Coral Sands. The keypad is by the vault door.`), 4200);
}
function tryCode(typed) {
  if (!typed) return;
  if (job.stage === 2 && typed === job.code) {
    job.stage = 3;
    sfx('levelup');
    sfx('cell');
    commitCrime(3);
    drawJob(); persist();
    return toast('ACCESS GRANTED. The great steel door swings open... and every alarm in the building goes off!');
  }
  sfx('error');
  toast(`ACCESS DENIED: ${typed}.${job.stage < 2 ? ' You have no idea what the code is. Somebody must know.' : ''}`);
}
function updateJob(dt) {
  if (job.stage === 4 && day >= job.until) { Object.assign(job, { stage: 0, code: '', known: [false, false, false, false] }); drawJob(); persist(); } // the bank has restocked
  const open = job.stage >= 3 ? 1 : 0;
  if (Math.abs(open - vaultSwing) > 0.001 || !updateJob.set) { // the door swings slowly: it weighs tons
    updateJob.set = true;
    vaultSwing += (open - vaultSwing) * Math.min(1, 1.6 * dt);
    setVaultDoor(gatorBank, vaultSwing);
  }
  if (photosOpen && !near(VAULT_PEOPLE.lenny.x, VAULT_PEOPLE.lenny.z, 6)) showPhotos(false);
  if (testView.has('job') && !updateJob.tested && player.bones) { // ?job=2 jumps to a stage (with the code ABCD), for checking it
    updateJob.tested = true;
    Object.assign(job, { stage: Number(testView.get('job')), code: 'AB12', known: [true, true, false, false], until: day + 3 });
    drawJob();
    if (testView.has('photos')) showPhotos();
    if (testView.has('code')) tryCode(testView.get('code'));
  }
  const target = photosOpen || chatOpen ? null : jobNear();
  if (target) {
    usePrompt.textContent = target.keypad ? 'Press E to use the vault keypad' : target.loot ? 'Press E to take the money' : `Press E to talk to ${target.who.name}`;
    usePrompt.style.display = 'block';
  }
}
// --- Traffic, dents and the garage --------------------------------------------------------------------
// Cars drive both ways along the main road. Hitting things in a car dents it, and every dent takes
// a little off its top speed; badly dented, the engine smokes. Fix-It Garage on Brew St knocks
// dents out at G$ 10 each.
const traffic = createTraffic(scene, renderer);
const garage = createMechanic(scene, 606, -44, Math.PI / 2);
const barberShop = createBarber(scene, 643, -44, -Math.PI / 2);
const DENT_PRICE = 10, MOST_DENTS = 12;
const crumple = new THREE.MeshStandardMaterial({ color: 0x151617, roughness: 1 }), scuff = new THREE.MeshStandardMaterial({ color: 0x5a5d60, roughness: 0.9, metalness: 0.4 });
function addDent(vehicle) {
  vehicle.dentAt = gameTime;
  sfx('crash');
  if ((vehicle.dents || 0) >= MOST_DENTS) return;
  vehicle.dents = (vehicle.dents || 0) + 1;
  vehicle.dentMeshes ??= [];
  const size = vehicle.size || (vehicle.own ? { hw: 1.0, hl: 2.75, deck: 1.25 } : { hw: 0.93, hl: 2.4, deck: 0.92 });
  // Most dents are on the end that hit; some are down the sides.
  const end = vehicle.speed >= 0 ? 1 : -1, onSide = vehicle.dents % 3 === 0, flank = Math.random() < 0.5 ? -1 : 1;
  const dent = new THREE.Group();
  const scrape = new THREE.Mesh(new THREE.CircleGeometry(0.3, 9), scuff), hollow = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), crumple);
  scrape.scale.set(1.2 + Math.random() * 0.6, 0.7 + Math.random() * 0.4, 1);
  hollow.scale.set(0.2 + Math.random() * 0.1, 0.13 + Math.random() * 0.08, 0.035);
  hollow.position.z = 0.004;
  dent.add(scrape, hollow);
  const height = 0.55 + Math.random() * Math.max(0.1, size.deck - 0.7);
  if (onSide) { dent.position.set(flank * (size.hw + 0.02), height, (Math.random() - 0.5) * size.hl * 1.4); dent.rotation.y = flank * Math.PI / 2; }
  else { dent.position.set((Math.random() - 0.5) * size.hw * 1.5, height, end * (size.hl + 0.03)); dent.rotation.y = end > 0 ? 0 : Math.PI; }
  dent.rotation.z = Math.random() * 3;
  vehicle.group.add(dent);
  vehicle.dentMeshes.push(dent);
  vehicle.baseTop ??= vehicle.topSpeed || 27;
  vehicle.topSpeed = vehicle.baseTop * (1 - Math.min(0.5, vehicle.dents * 0.05));
}
// A car stopped (or nearly) in the road right beside him: he pulls the driver out and it is his.
function jackTraffic() {
  const here = player.group.position;
  const index = traffic.findIndex((car) => car.active && car.speed < 3.5 && Math.hypot(car.group.position.x - here.x, car.group.position.z - here.z) < 3.4);
  if (index < 0) return;
  const [car] = traffic.splice(index, 1);
  traffic.add(); // another takes its place on the road
  Object.assign(car, { heading: car.group.rotation.y, speed: 0, steer: 0, stolen: false, traffic: false, name: car.name });
  vehicles.push(car);
  toast(`You drag the driver out of the ${car.name}!`);
}
// On Jamaica: a car or a motorbike that has stopped beside him. He pulls the driver or rider off and it is his.
function jackIsland() {
  const here = player.group.position;
  const index = islandTraffic.findIndex((one) => one.speed < 3.5 && Math.hypot(one.group.position.x - here.x, one.group.position.z - here.z) < 3.2);
  if (index < 0) return;
  const [one] = islandTraffic.splice(index, 1);
  islandTraffic.add(one, here.x, here.z); // another takes its place, coming in from the far end of the road
  if (one.rider) { one.group.remove(one.rider); one.rider = null; }
  Object.assign(one, { speed: 0, steer: 0, steerers: one.steerers || [], stolen: false, name: one.bike ? 'motorbike' : 'car', topSpeed: one.bike ? 42 : one.topSpeed || 30, reach: one.bike ? 2.6 : 3.4 });
  one.group.rotation.set(0, one.heading, 0);
  vehicles.push(one);
  toast(one.bike ? 'You shove the rider off the motorbike!' : 'You drag the driver out of the car!');
}
// The car that could be mended right now: the one he is driving (or standing beside), outside the garage.
function mechanicJob() {
  if (boating || !near(garage.bay.x, garage.bay.z, 9)) return null;
  const car = driving ? truck : nearVehicle();
  return car && Math.hypot(car.group.position.x - garage.bay.x, car.group.position.z - garage.bay.z) < 10 ? car : null;
}
function repairCar() {
  const car = mechanicJob(), dents = car.dents || 0, bill = dents * DENT_PRICE;
  if (!dents) return toast('Mick looks it over. "Not a mark on it. Come back when you have hit something."');
  if (money < bill) return sfx('error'), toast(`Mick counts ${dents} dent${dents > 1 ? 's' : ''}: G$ ${bill}. You only have G$ ${money} on you.`);
  money -= bill;
  for (const dent of car.dentMeshes || []) car.group.remove(dent);
  Object.assign(car, { dents: 0, dentMeshes: [], topSpeed: car.baseTop ?? car.topSpeed });
  sfx('wrench');
  sfx('buy');
  showMoney(); persist();
  toast(`Mick knocks out ${dents} dent${dents > 1 ? 's' : ''} for G$ ${bill}. Good as new.`);
}
let smokeTick = 0;
function updateRoads(dt) {
  if (!npcs.view) return;
  if (player.group.position.x > -400 && player.group.position.z > -300) updateAirport(airport, dt);
  if (ticketOpen && !ticketDesk()) setTickets(false);
  if (testView.has('ticket') && !updateRoads.flew && player.bones && ticketDesk()) { updateRoads.flew = true; setTickets(true); if (testView.get('ticket') !== 'menu') ticketKey(`Digit${testView.get('ticket')}`); } // ?ticket=1 buys the first one
  if (testView.has('plane') && !updateRoads.flew && player.bones) { updateRoads.flew = true; truck = airport.planes[Number(testView.get('plane')) || 0]; driving = true; player.group.visible = false; truck.heading = Number(testView.get('head') ?? 0); if (testView.has('onrunway')) truck.group.position.set(260, 0.07, 175); } // ?plane=0 starts in one
  const here = player.group.position, onFoot = !driving && !boating;
  // What traffic has to stop for: him, every other car, and anybody walking in the road.
  const blockers = onFoot ? [{ x: here.x, z: here.z, r: 0.7 }] : [];
  for (const one of vehicles) blockers.push({ x: one.group.position.x, z: one.group.position.z, r: 2.3 });
  for (const one of npcs) if (!one.away && one.state !== 'dead' && one.group.position.z > -7.6 && one.group.position.z < -1.4) blockers.push({ x: one.group.position.x, z: one.group.position.z, r: 0.5 });
  updateTraffic(traffic, dt, npcs.view, blockers, (car) => { if (Math.hypot(car.group.position.x - here.x, car.group.position.z - here.z) < 45) sfx('horn'); });
  for (const car of traffic) {
    if (!car.active) continue;
    const dx = here.x - car.group.position.x, dz = here.z - car.group.position.z;
    if (onFoot && here.y < 1.5 && Math.abs(dx) < car.size.hl + 0.4 && Math.abs(dz) < car.size.hw + 0.4) {
      // On foot he can't walk through one. If it was still moving when it reached him, he is run over.
      if (car.speed > 3.5 && dx * car.dir > 0 && player.downTime < 0 && !downed) {
        if (health - car.speed * 2.5 <= 0) deathCause = `You were run over by a ${car.name}.`;
        knockDown(player, car.group.position);
        if (car.speed > 6) breakBone('leg');
        hurtPlayer(Math.round(car.speed * 2.5));
        sfx('crash');
        car.stun = 3;
        car.speed = 0;
      }
      here.z = car.group.position.z + Math.sign(dz || 1) * (car.size.hw + 0.4);
    } else if (driving && Math.hypot(dx, dz) < 2.8) {
      // Driving into one: both stop dead, and his car takes a dent.
      const apart = Math.hypot(dx, dz) || 1;
      truck.group.position.x += dx / apart * (2.8 - apart);
      truck.group.position.z += dz / apart * (2.8 - apart);
      if (Math.abs(truck.speed) > 4 && gameTime - (truck.dentAt ?? -9) > 0.8) addDent(truck);
      truck.speed *= -0.25;
      car.stun = 3;
      car.speed = 0;
    }
  }
  if (driving) {
    if (truck.bump > 7 && gameTime - (truck.dentAt ?? -9) > 0.9) addDent(truck); // hit a wall, a lamp post, a parked car...
    if (testView.has('dents') && !updateRoads.dented) { updateRoads.dented = true; for (let i = 0; i < Number(testView.get('dents')); i++) addDent(truck); }
    smokeTick -= dt;
    if ((truck.dents || 0) >= 4 && smokeTick <= 0) { // badly knocked about: smoke from under the bonnet
      smokeTick = 0.22;
      const length = (truck.size?.hl ?? 2.5) * 0.7;
      emitSmoke(gun, puffSpot.set(truck.group.position.x + Math.sin(truck.heading) * length, truck.group.position.y + 1.15, truck.group.position.z + Math.cos(truck.heading) * length), 0.5 + truck.dents * 0.09);
    }
  }
  // Haircuts: put the saved one on once he has loaded, and carry on with a trim in progress.
  if (!hairReady && player.bones) {
    hairReady = true;
    if (testView.has('hair')) {
      hairKey = testView.get('hair');
      const head = player.bones.head, tip = player.group.getObjectByName('HeadTop_End'), size = head.getWorldScale(new THREE.Vector3());
      const at = head.getWorldPosition(new THREE.Vector3()), top = tip ? tip.getWorldPosition(new THREE.Vector3()) : at;
      const wear = player.group.getObjectByName('Wolf3D_Headwear'), skull = player.group.getObjectByName('Wolf3D_Head');
      skull?.geometry.computeBoundingBox();
      console.log(`TEST head: bone scale ${size.x.toFixed(3)} bone y ${at.y.toFixed(3)} top y ${top.y.toFixed(3)} tip local ${tip ? tip.position.toArray().map((n) => n.toFixed(3)) : 'none'} feet y ${player.group.position.y.toFixed(2)} headmesh box ${skull ? JSON.stringify(skull.geometry.boundingBox.min.toArray().map((n) => +n.toFixed(3))) + JSON.stringify(skull.geometry.boundingBox.max.toArray().map((n) => +n.toFixed(3))) : 'none'} wear ${!!wear}`);
    }
    if (hairKey !== 'own') applyHair(hairKey, !testView.has('nohat'));
  }
  if (trim) {
    trim.time += dt;
    here.set(barberShop.chair.x, here.y, barberShop.chair.z);
    player.group.rotation.y = barberShop.facing;
    if (Math.floor(trim.time / 0.32) !== Math.floor((trim.time - dt) / 0.32)) sfx('snip');
    if (trim.time > 4.5) {
      applyHair(trim.cut.key, true); // and the hat goes back on
      persist();
      toast({ Good: `Tony spins the chair round. "${trim.cut.name}. Sharp." Your hat goes back on.`, Okay: `"There. ${trim.cut.name}." It is... fine. Your hat goes back on.`, Bad: `Tony steps back and winces. "${trim.cut.name}. No refunds." You put your hat back on quickly.` }[trim.cut.grade]);
      trim = null;
    }
  }
}
function roadPrompts() {
  if (trip) { usePrompt.textContent = trip.tour ? 'Sightseeing over Miami. Sit back and look out of the window.' : `Flying to ${trip.to.name}. Sit back.`; usePrompt.style.display = 'block'; return; }
  if (atDoctor() && !chatOpen) { const fee = doctorBill(), doc = atDoctor(); usePrompt.textContent = fee ? `Press E to be treated by ${doc.name} (${doc.jm ? jd(fee * JM_RATE) : gs(fee)})` : `Press E for a check-up with ${doc.name}`; usePrompt.style.display = 'block'; return; }
  if (fxOpen && !islandAtm()) setFx(false);
  if (islandAtm() && !fxOpen) { usePrompt.textContent = 'Press E to use the cash machine (it changes money)'; usePrompt.style.display = 'block'; return; }
  if (atAltar() && !chatOpen) { usePrompt.textContent = 'Press E to kneel at the altar for a quiet moment'; usePrompt.style.display = 'block'; return; }
  if (atIrieBar() && !chatOpen) { usePrompt.textContent = `Press E to buy a round for everybody (${jd(ROUND_PRICE)})`; usePrompt.style.display = 'block'; return; }
  if (ticketDesk() && !ticketOpen && !chatOpen) { usePrompt.textContent = 'Press E to buy a plane ticket'; usePrompt.style.display = 'block'; return; }
  if (driving && truck.plane) { // how to fly, while he is doing it
    const fast = truck.speed >= truck.takeoff, up = truck.group.position.y > 1;
    usePrompt.textContent = up ? 'Shift climbs · C descends · A/D turn · S slows down (not too slow!) · land gently, then Space to brake' : fast ? 'Fast enough: hold Shift to take off' : 'Hold W for full throttle · A/D steer · Space brakes · F gets out when stopped';
    usePrompt.style.display = 'block';
    return;
  }
  if (shopOpen || martOpen || casinoOpen || atmOpen || boxOpen || barberOpen || chatOpen || trim) return;
  const car = mechanicJob();
  if (car) { usePrompt.textContent = car.dents ? `Press E: Mick fixes ${car.dents} dent${car.dents > 1 ? 's' : ''} for G$ ${car.dents * DENT_PRICE}` : 'Fix-It Garage: no dents on this one'; usePrompt.style.display = 'block'; }
  else if (atBarber()) { usePrompt.textContent = 'Press E for a haircut'; usePrompt.style.display = 'block'; }
  else if (!driving && !boating && traffic.some((one) => one.active && one.speed < 3.5 && near(one.group.position.x, one.group.position.z, 3.4))) { usePrompt.textContent = 'Press F to pull the driver out and take the car'; usePrompt.style.display = 'block'; }
}

const gameMap = createMap();
// Miami Airport, out on the grass behind the far-side towers, with two planes to fly.
const airport = createAirport(scene);
const islandTraffic = createIslandTraffic(scene, renderer, airport.islandRoad); // cars and motorbikes on Jamaica's road
// Cuba, north of Jamaica: another place the planes fly to.
const cuba = createCuba(scene, renderer);
airport.stations.push(cuba.station);
airport.tills.push(cuba.till);

// --- Plane tickets ---------------------------------------------------------------------------------
// The check-in desk at Miami Airport, and the ticket huts on Jamaica and at the Palm Ave airfield,
// sell seats on the yellow airliner. Buy one and it flies you there.
const FARES = { 'miami-key': 60, 'miami-palm': 20, 'key-palm': 70, 'miami-cuba': 70, 'key-cuba': 40, 'palm-cuba': 80 }, TOUR_FARE = 15;
const fare = (a, b) => FARES[`${a.key}-${b.key}`] ?? FARES[`${b.key}-${a.key}`];
let ticketOpen = false, trip = null;
const afterFade = (then) => (testView.has('ticket') ? then() : setTimeout(then, 900)); // (straight away when testing)
// Anywhere along the front of the check-in desks counts, and anywhere round a ticket hut (even behind it).
const ticketDesk = () => {
  if (driving || boating || trip) return null;
  const p = player.group.position;
  return airport.stations.find((one) => Math.abs(p.y - one.arrive.y) < 2 && (one.key === 'miami'
    ? p.x > one.desk.x - 6.5 && p.x < one.desk.x + 6.5 && p.z > one.desk.z - 1.5 && p.z < one.desk.z + 3.2
    : Math.abs(p.x - one.desk.x) < 3.2 && p.z > one.desk.z - 4.2 && p.z < one.desk.z + 2.2)) || null;
};
const ticketChoices = (from) => [...airport.stations.filter((one) => one !== from).map((to) => ({ to, price: fare(from, to), name: to.name })),
  ...(from.key === 'miami' ? [{ tour: true, to: from, price: TOUR_FARE, name: 'Sightseeing flight over Miami' }] : [])];
function setTickets(open) {
  ticketOpen = open;
  shopEl.style.display = open ? 'block' : 'none';
  if (!open) return;
  const from = ticketDesk(), blurbs = { cuba: 'Old pastel streets, classic cars, a domed capitol and the Sierra Maestra', key: 'The island, far out to sea. Beaches, jungle and the Blue Mountains', palm: 'The grass strip behind the houses on Palm Ave', miami: 'The big airport, by the towers' };
  shopEl.innerHTML = `<div style="font-size:22px;font-weight:bold;margin-bottom:4px">Gator Air tickets</div>
    <div style="margin-bottom:10px">"Where to?" &nbsp;·&nbsp; You are at <b>${from.name}</b> &nbsp;·&nbsp; You have <b>G$ ${money.toLocaleString('en-US')}</b></div>` +
    ticketChoices(from).map((choice, i) => `<div style="display:flex;gap:14px;padding:7px 0;border-top:1px solid rgba(243,230,192,0.25)"><b style="width:26px">${i + 1}</b>
      <span style="flex:1"><b>${choice.name}</b><br><small>${choice.tour ? 'A loop over the city and the beach, and back here' : blurbs[choice.to.key]}</small></span><b>G$ ${choice.price}</b></div>`).join('') +
    '<div style="margin-top:12px;opacity:0.8">Press a number to buy and board &nbsp;·&nbsp; E to leave</div>';
}
function ticketKey(code) {
  const from = ticketDesk(), choice = from && ticketChoices(from)[['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(code)];
  if (!choice) return;
  if (storm > 0.1 || (stormDay() && hourNow > STORM_FROM - 0.5 && hourNow < STORM_TO)) return sfx('error'), toast('All flights are cancelled until the hurricane has passed.');
  if (money < choice.price) return sfx('error'), toast(`That ticket is G$ ${choice.price}. You only have G$ ${money} on you.`);
  money -= choice.price;
  showMoney();
  sfx('buy');
  setTickets(false);
  gun.equipped = false;
  knifeOut = false;
  fadeEl.style.opacity = 1;
  afterFade(() => { // on board, doors closed
    const plane = airport.shuttle, tour = !!choice.tour;
    trip = { from, to: choice.to, tour, time: 0, length: tour ? 26 : Math.min(30, 13 + from.land.distanceTo(choice.to.land) / 85), last: from.land.clone() };
    plane.group.position.copy(from.land);
    plane.group.visible = true;
    truck = plane;
    driving = true;
    player.group.visible = false;
    setEngine(plane, true);
    fadeEl.style.opacity = 0;
    toast(tour ? 'Welcome aboard the Gator Air sightseeing flight.' : `Welcome aboard Gator Air to ${choice.to.name}.`);
  });
}
const tripSpot = new THREE.Vector3();
function flyTrip(dt) {
  const plane = airport.shuttle, { from, to } = trip;
  trip.time += dt;
  const u = Math.min(1, trip.time / trip.length), e = u * u * (3 - 2 * u);
  if (trip.tour) tripSpot.set(from.land.x + 300 + 400 * Math.sin(Math.PI * 2 * e - 0.85) , 0, from.land.z - 190 * (1 - Math.cos(Math.PI * 2 * e)));   // a big loop out over the city and the beach
  else tripSpot.lerpVectors(from.land, to.land, e);
  if (trip.tour) tripSpot.x += (from.land.x - (from.land.x + 300 + 400 * Math.sin(-0.85))) * (1 - Math.sin(Math.PI * u));                               // (starting and ending on the runway)
  tripSpot.y = from.land.y + (to.land.y - from.land.y) * e + Math.sin(Math.PI * u) ** 0.75 * (trip.tour ? 95 : 120);
  const dx = tripSpot.x - trip.last.x, dz = tripSpot.z - trip.last.z, flat = Math.hypot(dx, dz);
  if (flat > 0.01) {
    let turn = Math.atan2(dx, dz) - plane.heading;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    plane.heading += turn * Math.min(1, 5 * dt);
    plane.group.rotation.set(-Math.atan2(tripSpot.y - trip.last.y, flat) * 0.8, plane.heading, THREE.MathUtils.clamp(-turn * 6, -0.45, 0.45));
  }
  plane.speed = flat / Math.max(dt, 1e-4);
  plane.group.position.copy(tripSpot);
  trip.last.copy(tripSpot);
  if (u < 1 || trip.ending) return;
  trip.ending = true;                                        // down and stopped: off he gets
  fadeEl.style.opacity = 1;
  afterFade(() => {
    driving = false;
    setEngine(plane, false);
    plane.speed = 0;
    plane.group.visible = false;
    truck = homeTruck;
    player.group.visible = true;
    player.group.position.copy(to.arrive);
    player.group.rotation.y = to.facing;
    cam.yaw = to.facing + Math.PI;
    fadeEl.style.opacity = 0;
    toast(trip.tour ? 'Back on the ground at Miami Airport. Thank you for flying Gator Air.' : `Welcome to ${to.name}. ${to.key === 'miami' ? '' : 'The ticket hut sells flights back.'}`);
    if (!trip.tour) customsCheck(to);
    trip = null;
  });
}

// --- Jamaican dollars -----------------------------------------------------------------------------------
// On the island everything is priced in Jamaican dollars (J$). The cash machines there change
// Gator Bucks into them and back again: G$ 1 buys J$ 150.
const JM_RATE = 150;
const jd = (amount) => `J$ ${Math.round(amount).toLocaleString('en-US')}`;
function islandTill() { // which island counter he is standing at, if any
  return airport.tills.find((one) => Math.abs(player.group.position.y - 0.68) < 1.5 && near(one.x, one.z, 1.8))?.key || null;
}
const islandAtm = () => !driving && !boating && airport.islandAtms.some((one) => near(one.x, one.z, 1.4));
let fxOpen = false, fxNote = '';
function drawFx() {
  const row = (key, name, detail) => `<div style="display:flex;gap:14px;padding:7px 0;border-top:1px solid rgba(243,230,192,0.25)"><b style="width:26px">${key}</b><span style="flex:1"><b>${name}</b></span><b>${detail}</b></div>`;
  shopEl.innerHTML = `<div style="font-size:22px;font-weight:bold;margin-bottom:4px">Island Bank cash machine</div>
    <div style="margin-bottom:4px">You have <b>${gs(money)}</b> and <b>${jd(jmoney)}</b> in cash &nbsp;·&nbsp; In the bank: <b>${gs(bank)}</b></div>
    <div style="margin-bottom:10px;opacity:0.85"><small>Today's rate: G$ 1 = J$ ${JM_RATE}. Island shops and the bar only take Jamaican dollars.</small></div>
    ${row(1, 'Change G$ 10', jd(10 * JM_RATE))}${row(2, 'Change G$ 100', jd(100 * JM_RATE))}${row(3, 'Change all your G$ cash', jd(money * JM_RATE))}
    ${row(4, 'Change your J$ back to G$', gs(Math.floor(jmoney / JM_RATE)))}${row(5, 'Take G$ 100 out of your bank', '')}
    <div style="min-height:22px;margin:8px 0;font-weight:bold;color:#ffe9a0">${fxNote}</div>
    <div style="opacity:0.8">Press 1 to 5 &nbsp;·&nbsp; E to leave</div>`;
}
function setFx(open) {
  fxOpen = open;
  shopEl.style.display = open ? 'block' : 'none';
  if (open) { fxNote = ''; sfx('click'); drawFx(); }
}
function fxKey(code) {
  const choice = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].indexOf(code);
  const change = (amount) => { // G$ into J$
    if (amount <= 0 || money < amount) { sfx('error'); fxNote = 'You do not have that much in Gator Bucks.'; return; }
    money -= amount;
    jmoney += amount * JM_RATE;
    sfx('coin');
    fxNote = `${gs(amount)} becomes ${jd(amount * JM_RATE)}.`;
  };
  if (choice === 0) change(10);
  else if (choice === 1) change(100);
  else if (choice === 2) change(money);
  else if (choice === 3) {
    const back = Math.floor(jmoney / JM_RATE);
    if (!back) { sfx('error'); fxNote = 'Not enough Jamaican dollars to make one Gator Buck.'; } else { jmoney -= back * JM_RATE; money += back; sfx('coin'); fxNote = `You get ${gs(back)} back.`; }
  } else if (choice === 4) {
    const out = Math.min(100, bank);
    if (!out) { sfx('error'); fxNote = 'Your bank account is empty.'; } else { bank -= out; money += out; sfx('coin'); fxNote = `Here is your ${gs(out)}.`; }
  } else return;
  showMoney(); persist(); drawFx();
}
// The island's counters: what each sells, in Jamaican dollars. Food and coffee are eaten on the spot.
const heal = (amount, words) => () => { health = Math.min(100, health + amount); showHealth(); sfx('eat'); toast(words); riskyFood(); };
Object.assign(TILLS, {
  grocery: { title: "Miss Lou's Grocery", greeting: 'Wah yuh need, darlin?', jm: true, items: [
    { key: 'beer', name: 'Island lager', price: 450, amount: 1, blurb: 'A cold bottle. Press 5 to drink it' },
    { key: 'snacks', name: 'Plantain chips', price: 300, amount: 1, blurb: 'Press 6 to eat them. Run faster for 30 seconds' },
    { name: 'Beef patty', price: 400, blurb: 'Hot from the oven. Eaten on the spot: +25 health', use: heal(25, 'A hot beef patty. That is better.') },
    { key: 'spray', name: 'Can of bug spray', price: 500, amount: 3, blurb: 'Three sprays in a can. Press B: no mosquitoes for two minutes' },
  ] },
  coffee: { title: 'Blue Mountain Coffee', greeting: 'Best coffee inna di world. Yuh want a cup?', jm: true, items: [
    { name: 'Cup of Blue Mountain coffee', price: 350, blurb: 'Drunk on the spot: run faster for a whole minute', use: () => { energy = 60; player.boost = 1.35; sfx('drink'); toast('Strong, sweet and black. You could run up the mountain.'); } },
    { name: 'Slice of rum cake', price: 300, blurb: 'Eaten on the spot: +15 health', use: heal(15, 'Rich, dark and sticky. Lovely.') },
    { name: 'Coconut water', price: 200, blurb: 'Straight from the nut: +10 health', use: heal(10, 'Cool and sweet.') },
  ] },
  jerk: { title: 'Jerk Chicken Shack', greeting: 'Hot, hotter or hottest?', jm: true, items: [
    { name: 'Jerk chicken', price: 900, blurb: 'Smoky and fiery. Eaten on the spot: +50 health', use: heal(50, 'Your mouth is on fire. You feel wonderful.') },
    { name: 'Festival dumplings', price: 300, blurb: 'Sweet fried dough: +15 health', use: heal(15, 'Sweet and crisp.') },
    { name: 'Rice and peas', price: 500, blurb: 'A proper plateful: +30 health', use: heal(30, 'Just like somebody\'s grandmother makes it.') },
  ] },
});
// The market stalls in Kingston. Everything is eaten or drunk on the spot.
const boost = (seconds, words) => () => { energy = seconds; player.boost = 1.35; sfx('drink'); toast(words); };
Object.assign(TILLS, {
  stall0: { title: "Auntie Pearl's fruit", greeting: 'Sweet an ripe, darlin. Pick one.', jm: true, items: [
    { name: 'Julie mango', price: 150, blurb: 'Dripping with juice: +8 health', use: heal(8, 'Juice runs down your chin.') },
    { name: 'Hand of bananas', price: 100, blurb: '+6 health', use: heal(6, 'Small, sweet island bananas.') },
    { name: 'Pineapple', price: 300, blurb: 'She cuts it up for you: +15 health', use: heal(15, 'Sharp and sweet.') },
    { name: 'Soursop', price: 250, blurb: 'Creamy and strange: +12 health', use: heal(12, 'Like nothing you have tasted before.') },
  ] },
  stall1: { title: "Miss Icilda's ackee and saltfish", greeting: 'National dish, cook fresh dis mawnin.', jm: true, items: [
    { name: 'Ackee and saltfish', price: 700, blurb: "Jamaica's national dish: +40 health", use: heal(40, 'Soft yellow ackee, salty fish, onion and pepper. You see why they are proud of it.') },
    { name: 'Ackee and saltfish with fried dumpling', price: 900, blurb: 'The full breakfast: +55 health', use: heal(55, 'You mop the plate with the last dumpling.') },
    { name: 'Roast breadfruit', price: 250, blurb: 'A thick warm slice: +12 health', use: heal(12, 'Smoky outside, soft inside.') },
    { name: 'Callaloo', price: 200, blurb: 'Steamed greens: +10 health', use: heal(10, 'Good for you, and it tastes it.') },
  ] },
  stall2: { title: "Junior's cold drinks", greeting: 'Ice cold! Wah yuh a drink?', jm: true, items: [
    { name: 'Coconut water', price: 200, blurb: 'He lops the top off with a machete: +10 health', use: heal(10, 'Cool and sweet, straight from the nut.') },
    { name: 'Ginger beer', price: 250, blurb: 'Hot with ginger: run faster for 45 seconds', use: boost(45, 'It burns all the way down. You are wide awake.') },
    { name: 'Sorrel', price: 250, blurb: 'Deep red and spiced: +12 health', use: heal(12, 'Sweet, sharp and spicy.') },
    { name: 'Sky juice', price: 100, blurb: 'Shaved ice and syrup in a bag: +5 health', use: heal(5, 'Your teeth ache with the cold.') },
  ] },
  stall3: { title: "Captain Roy's fried fish", greeting: 'Caught dis mawnin. Fry it right now.', jm: true, items: [
    { name: 'Fried fish and bammy', price: 800, blurb: 'Crisp snapper with cassava bread: +45 health', use: heal(45, 'Crisp skin, sweet flesh, and vinegar that makes your eyes water.') },
    { name: 'Pepper shrimp', price: 500, blurb: 'Bright red and very hot: +25 health', use: heal(25, 'Your lips go numb.') },
    { name: 'Fish tea', price: 300, blurb: 'A cup of thin, peppery soup: +15 health', use: heal(15, 'It is soup. Nobody knows why it is called tea.') },
  ] },
  stall4: { title: "Sister Joy's sweets", greeting: 'Sumting sweet fi yuh?', jm: true, items: [
    { name: 'Gizzada', price: 200, blurb: 'A pinched tart of spiced coconut: +10 health', use: heal(10, 'Sticky and crunchy.') },
    { name: 'Coconut drops', price: 150, blurb: 'Chunks of coconut in ginger toffee: +8 health', use: heal(8, 'You will be picking that out of your teeth all day.') },
    { name: 'Tamarind balls', price: 150, blurb: 'Sweet, sour and peppery: run faster for 30 seconds', use: boost(30, 'Your whole face puckers. Then you want another.') },
    { name: 'Grater cake', price: 200, blurb: 'Pink and white coconut candy: +10 health', use: heal(10, 'Pure sugar.') },
  ] },
  stall5: { title: "Uncle Vin's patties and bun", greeting: 'Hot patty! Bun an cheese!', jm: true, items: [
    { name: 'Beef patty', price: 350, blurb: 'Flaky and fiery: +22 health', use: heal(22, 'You burn your mouth and do not care.') },
    { name: 'Patty in coco bread', price: 500, blurb: 'A patty inside a soft bun: +32 health', use: heal(32, 'Bread inside pastry. Genius.') },
    { name: 'Bun and cheese', price: 400, blurb: 'Spiced fruit bun with a slab of cheese: +25 health', use: heal(25, 'Sweet and salty at once.') },
  ] },
  rum: { title: 'Rum Shop', greeting: 'Sit down, tek a drink, slam a domino.', jm: true, items: [
    { key: 'beer', name: 'Rum punch', price: 600, amount: 1, blurb: 'Goes in your bag. Press 5 to drink it (it counts as a beer)' },
    { name: 'Ginger beer', price: 250, blurb: 'Run faster for 45 seconds', use: boost(45, 'Hot with ginger.') },
    { name: 'Peanut punch', price: 350, blurb: 'Thick and sweet: +18 health', use: heal(18, 'A meal in a cup.') },
  ] },
});
// Bar La Plaza, on Cuba. It takes ordinary Gator Bucks.
Object.assign(TILLS, { cubabar: { title: 'Bar La Plaza', greeting: '¿Qué quieres, amigo?', items: [
  { name: 'Café cubano', price: 3, blurb: 'Tiny, black and very sweet: run faster for a minute', use: boost(60, 'One sip and your heart is racing.') },
  { key: 'beer', name: 'Mojito', price: 6, amount: 1, blurb: 'Rum, lime and mint. Goes in your bag: press 5 to drink it (it counts as a beer)' },
  { name: 'Cuban sandwich', price: 8, blurb: 'Pork, ham, cheese and pickle, pressed hot: +40 health', use: heal(40, 'Hot, crisp and dripping. Perfect.') },
  { key: 'cigarettes', name: 'Box of cigars', price: 25, amount: 5, blurb: 'Five hand-rolled cigars. Press 4 to smoke one' },
] } });
// The chapel: a quiet moment at the altar puts him right, once a day.
let prayedDay = 0;
const atAltar = () => !driving && !boating && near(airport.altar.x, airport.altar.z, 2.0) && player.group.position.x > 3000;
function pray() {
  if (prayedDay === day) return toast('You have had your quiet moment today. Come back tomorrow.');
  prayedDay = day;
  health = 100;
  showHealth();
  sfx('sleep');
  toast('You kneel by the altar for a quiet moment. You get up feeling whole again. (Full health, once a day.)');
}

// --- Sickness and injury ----------------------------------------------------------------------------------
// Food poisoning: now and then, from food bought on the island. It passes by the next day.
// Dengue fever: mosquitoes bite on Jamaica, and one bite in sixty carries it. It does not pass by itself.
// Broken bones: a leg from being run over, an arm from being punched to the ground. They do not mend by themselves.
// A doctor cures all of them: Dr Rivera in Miami General Hospital, or Dr Campbell at the clinic in Kingston.
const ill = Object.assign({ food: 0, dengue: 0, leg: false, arm: false }, saved.ill);
const DENGUE_ODDS = 1 / 60;
let bites = 0, biteWait = 6, retch = 0, retchWait = 14, illDay = 0, illTested = false;
let swarm = 0, nextSwarm = 20, swarmFrom = null, sprayed = 0; // seconds a swarm has left with him; seconds until the next; and seconds of bug spray left
const sprayEl = overlay('display:none;right:18px;top:146px;font-size:13px;font-weight:bold;color:#e6f6e0;background:rgba(30,80,40,0.82);padding:4px 10px;border-radius:8px');
// B: a squirt of bug spray. No mosquitoes for two minutes.
function useSpray() {
  if (!(bag.spray > 0)) return toast("You have no bug spray. Miss Lou's Grocery in Kingston sells it.");
  if (sprayed > 60) return toast('You are still covered in the stuff.');
  bag.spray--;
  sprayed = 120;
  swarm = 0;
  sfx('spray');
  showBag(); persist();
  toast(`Psssht. You stink of citronella, and the mosquitoes want nothing to do with you for two minutes. (${bag.spray} spray${bag.spray === 1 ? '' : 's'} left.)`);
}
const illEl = overlay('display:none;right:18px;top:92px;font-size:14px;font-weight:bold;color:#fff3e0;background:rgba(120,30,20,0.82);padding:5px 12px;border-radius:8px;text-align:right');
const sickEl = overlay('inset:0;opacity:0;transition:opacity 0.6s');
const anythingWrong = () => ill.food > 0 || ill.dengue > 0 || ill.leg || ill.arm;
function showIll() {
  const list = [];
  if (ill.food > 0) list.push('Food poisoning');
  if (ill.dengue > 0) list.push('Dengue fever');
  if (ill.leg) list.push('Broken leg');
  if (ill.arm) list.push('Broken arm');
  illEl.style.display = list.length ? 'block' : 'none';
  illEl.innerHTML = list.join(' · ') + (list.length ? '<br><small style="font-weight:normal;opacity:0.85">See a doctor (Miami hospital or Kingston clinic)</small>' : '');
}
// Something he ate may have been off. It shows itself a little later.
function riskyFood() {
  if (ill.food > 0 || Math.random() >= 0.08) return;
  setTimeout(() => {
    ill.food = 240;
    showIll(); persist();
    toast('Your stomach turns over. Something you ate was off: you have food poisoning.');
  }, 14000);
}
function breakBone(which) {
  if (ill[which] || downed) return;
  ill[which] = true;
  sfx('crash');
  showIll(); persist();
  toast(which === 'leg' ? 'CRACK. Your leg is broken: you can only limp, and you cannot run or jump. See a doctor.' : 'CRACK. Your arm is broken: your punches are weak. See a doctor.');
}
// A cloud of mosquitoes that hangs round him on the island.
const midges = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(24), 3)), new THREE.PointsMaterial({ color: 0x111111, size: 0.035 }));
midges.frustumCulled = false;
midges.visible = false;
scene.add(midges);
function mosquitoBite() {
  bites++;
  sfx('mosquito');
  hurt = Math.max(hurt, 0.12);
  if (bites % 6 === 1) toast(bites === 1 ? 'A mosquito bites you. A swarm has found you: run, go indoors, or use bug spray (B).' : `Slap. That is ${bites} mosquito bites.`);
  if (!ill.dengue && Math.random() < DENGUE_ODDS) {
    ill.dengue = 1;
    showIll(); persist();
    toast('You are shivering in the heat and every joint aches. That last mosquito gave you dengue fever. Only a doctor can help.');
  }
}
function updateIllness(dt) {
  if (testView.has('spray') && !illTested) { bag.spray = 3; useSpray(); }
  if (testView.has('ill') && !illTested) { illTested = true; for (const what of testView.get('ill').split(',')) ill[what] = what === 'food' ? 240 : what === 'dengue' ? 1 : true; showIll(); }
  if (testView.has('bites') && !updateIllness.bitten) { updateIllness.bitten = true; let caught = 0; for (let i = 0; i < Number(testView.get('bites')); i++) { ill.dengue = 0; mosquitoBite(); caught += ill.dengue; } console.log(`TEST bites: ${bites} bites gave dengue ${caught} times`); }
  const here = player.group.position, onFoot = !driving && !boating && !trip;
  // Mosquitoes: on Jamaica, out of doors. More of them after dark.
  // They do not follow him about all day. Every so often a swarm finds him, hangs round for a
  // quarter of a minute or so, biting, and then loses interest. Running shakes them off sooner,
  // going indoors or into the water loses them at once, and bug spray keeps them away altogether.
  const outside = onFoot && storm < 0.3 && here.x > 2500 && jailed <= 0 && !downed && ceilingAt(here) === Infinity && waterDepthAt(here) <= 0;
  const pace = swarmFrom ? Math.hypot(here.x - swarmFrom.x, here.z - swarmFrom.z) / Math.max(dt, 1e-4) : 0;
  swarmFrom = { x: here.x, z: here.z };
  sprayed = Math.max(0, sprayed - dt);
  sprayEl.style.display = sprayed > 0 ? 'block' : 'none';
  if (sprayed > 0) sprayEl.textContent = `Bug spray: ${Math.floor(sprayed / 60)}:${String(Math.floor(sprayed % 60)).padStart(2, '0')}`;
  if (!outside || sprayed > 0) swarm = 0;
  else if (swarm > 0) {
    swarm -= dt * (pace > 5 ? 3 : 1);
    if (swarm <= 0) nextSwarm = 25 + Math.random() * 45;
  } else {
    nextSwarm -= dt * (isNight() ? 2 : 1);
    if (nextSwarm <= 0) { swarm = 9 + Math.random() * 11; biteWait = 1.5 + Math.random() * 2; }
  }
  const bitten = swarm > 0;
  midges.visible = bitten;
  if (bitten) {
    const spots = midges.geometry.attributes.position;
    for (let i = 0; i < 8; i++) spots.setXYZ(i, here.x + Math.sin(gameTime * (2.1 + i * 0.37) + i) * 0.55, here.y + 1.5 + Math.sin(gameTime * (3.3 + i * 0.5) + i * 2) * 0.3, here.z + Math.cos(gameTime * (1.7 + i * 0.41) + i * 3) * 0.55);
    spots.needsUpdate = true;
    biteWait -= dt;
    if (biteWait <= 0) { biteWait = 3 + Math.random() * 4; mosquitoBite(); }
  }
  // A new day sees off food poisoning.
  if (illDay !== day) { if (illDay && ill.food > 0) { ill.food = 0; toast('You wake up with your stomach settled. The food poisoning has passed.'); showIll(); } illDay = day; }
  let slow = 1, tint = '';
  if (ill.food > 0) {
    ill.food -= dt;
    slow *= 0.75;
    if (health > 20) { health -= 0.5 * dt; showHealth(); }
    retchWait -= dt;
    if (retchWait <= 0 && onFoot) { retchWait = 12 + Math.random() * 10; retch = 1.4; sfx('retch'); }
    tint = 'rgba(70,110,30,0.2)';
    if (ill.food <= 0) { ill.food = 0; showIll(); persist(); toast('Your stomach finally settles. The food poisoning has passed.'); }
  }
  if (ill.dengue > 0) {
    slow *= 0.7;
    if (health > 30) { health -= 0.35 * dt; showHealth(); }
    cam.yaw += Math.sin(gameTime * 31) * 0.012 * dt * 60 * 0.12; // the shivers
    tint = `rgba(190,110,20,${(0.14 + 0.1 * Math.sin(gameTime * 1.3)).toFixed(3)})`;
  }
  if (ill.leg) slow *= 0.5;
  retch = Math.max(0, retch - dt);
  player.slow = slow;
  sickEl.style.background = tint || 'transparent';
  sickEl.style.opacity = tint ? 1 : 0;
}
// --- The doctors ---
const DOCTORS = [
  { x: 500, z: 12, name: 'Dr Rivera', place: 'Miami General Hospital' },
  { x: airport.doctor.x, z: airport.doctor.z, name: 'Dr Campbell', place: 'Kingston Clinic', jm: true },
];
const FEES = { food: 30, dengue: 120, leg: 80, arm: 80 }; // in Gator Bucks; the clinic charges the same in Jamaican dollars
const atDoctor = () => (driving || boating || trip ? null : DOCTORS.find((one) => near(one.x, one.z, 2.6) && Math.abs(player.group.position.y - (one.jm ? 0.68 : 0.15)) < 1.5) || null);
function doctorBill() {
  let bill = 0;
  if (ill.food > 0) bill += FEES.food;
  if (ill.dengue > 0) bill += FEES.dengue;
  if (ill.leg) bill += FEES.leg;
  if (ill.arm) bill += FEES.arm;
  if (!bill && health < 100) bill = 10; // just patching him up
  return bill;
}
function visitDoctor() {
  const doctor = atDoctor(), bill = doctorBill(), price = doctor.jm ? bill * JM_RATE : bill, cost = doctor.jm ? jd(price) : gs(price);
  if (!bill) return toast(`${doctor.name} looks you over. "Fit as a fiddle. Nothing wrong with you at all."`);
  if ((doctor.jm ? jmoney : money) < price) return sfx('error'), toast(`${doctor.name}: "That will be ${cost}." You do not have it${doctor.jm ? ' in Jamaican dollars. The cash machine on Main Street changes money' : ''}.`);
  if (doctor.jm) jmoney -= price; else money -= price;
  const done = [];
  if (ill.food > 0) done.push('medicine for your stomach');
  if (ill.dengue > 0) done.push('fluids and rest for the dengue');
  if (ill.leg) done.push('your leg set in plaster');
  if (ill.arm) done.push('your arm set in plaster');
  if (!done.length) done.push('a few stitches and a plaster');
  Object.assign(ill, { food: 0, dengue: 0, leg: false, arm: false });
  health = 100;
  fadeEl.style.opacity = 1;
  setTimeout(() => (fadeEl.style.opacity = 0), 900);
  sfx('levelup');
  showHealth(); showMoney(); showIll(); persist();
  toast(`${doctor.name} treats you: ${done.join(', ')}. That is ${cost}. You walk out good as new.`);
}

// --- The cigarette run -------------------------------------------------------------------------------------
// Mr Biggs, by the airstrip on Jamaica, hands over a crate of cigarettes. Benny, beside the Cold Ones
// beer shop in Miami, pays G$ 500 for it. In between is the border: the customs officer at Miami
// Airport searches some of the passengers who come off the plane. (The little airfield at Palm Ave
// has no customs at all, but it is a long way from Miami.)
const RUN_PAY = 500, SEARCH_ODDS = 0.4;
const BIGGS = { x: 2844, z: -112, facing: 0, name: 'Mr Biggs', skin: 'dark', wear: 'cap', special: true, dye: 'baron', say: 'Press E if yuh want fi mek some real money.' };
const BENNY = { x: 616.2, z: 40.5, facing: Math.PI, name: 'Benny', wear: 'cap', special: true, dye: 'spike', say: 'You got something for me? Press E.' };
const CUSTOMS = { x: 419.5, z: 101.2, facing: 0, name: 'Customs Officer Diaz', uniform: true, special: true, say: 'Anything to declare?' };
let runsDone = saved.runs ?? 0;
function runSpot() {
  if (driving || boating || trip) return null;
  if (near(BIGGS.x, BIGGS.z, 2.4) && player.group.position.x > 2500) return 'biggs';
  if (near(BENNY.x, BENNY.z, 2.4) && player.group.position.y < 2) return 'benny';
  return null;
}
function runUse() {
  if (runSpot() === 'biggs') {
    if (bag.crate) return sayAs(BIGGS, 'Yuh still have di crate! Benny, by di beer shop pon Brew Street inna Miami. Go!');
    bag.crate = 1;
    sfx('pickup');
    showBag(); persist();
    return sayAs(BIGGS, `Tek dis crate a cigarette to Benny inna Miami. Him stand by di beer shop pon Brew Street, an him pay ${gs(RUN_PAY)}. Mind di customs man a di airport: if him search yuh, it done. Di likkle airfield a Palm Ave nuh have no customs.`);
  }
  if (!bag.crate) return sayAs(BENNY, 'I buy cigarettes off the boat from Jamaica. Mr Biggs, by the airstrip over there, has them. Bring me a crate.');
  bag.crate = 0;
  money += RUN_PAY;
  runsDone++;
  sfx('coin');
  sfx('levelup');
  showMoney(); showBag(); persist();
  sayAs(BENNY, `Beautiful. No tax stamps on a single pack. Here is your ${gs(RUN_PAY)}. Come back with more.`);
}
// Coming off the plane at Miami Airport with the crate.
function customsCheck(to) {
  if (to.key !== 'miami' || !bag.crate) return;
  if ((Math.random() < SEARCH_ODDS || testView.has('unlucky')) && !testView.has('lucky')) {
    bag.crate = 0;
    showBag(); persist();
    commitCrime(2);
    sfx('megaphone');
    sayAs(CUSTOMS, 'Step this way, sir. What is in the crate? ...Smuggling. You are under arrest!');
    setTimeout(() => toast('Customs found the crate and took it. You are wanted: run for it, or stand still and be arrested.'), 4200);
  } else {
    setTimeout(() => toast('You walk past the customs officer with the crate under your arm, whistling. He waves you through. Benny is by the beer shop on Brew St (see the map).'), 600);
  }
}
// Coconuts: any palm tree will give him one.
let coconutAt = -99;
const coconutPalm = () => !driving && !boating && !trip && jailed <= 0 && (nearPalm(player.group.position, 2.3) || (player.group.position.x > 2500 && airport.junglePalms.some(([x, z]) => near(x, z, 2.3))));
function eatCoconut() {
  if (gameTime - coconutAt < 15) return toast('You are still full of the last coconut. Give it a moment.');
  coconutAt = gameTime;
  sfx('land');
  setTimeout(() => sfx('eat'), 700);
  health = Math.min(100, health + 12);
  showHealth();
  toast('You shake the palm and a coconut thumps down. You crack it on a stone, drink the water and eat the flesh. +12 health.');
}
function updateSmuggle() {
  // Jamaica's traffic stops for him, and for anybody else in the road.
  const onIsland = player.group.position.x > 2300;
  const inRoad = onIsland && !driving ? [{ x: player.group.position.x, z: player.group.position.z }] : [];
  if (onIsland) for (const one of npcs) if (!one.away && one.state !== 'dead') inRoad.push({ x: one.group.position.x, z: one.group.position.z });
  updateIslandTraffic(islandTraffic, Math.min(0.05, 1 / 30), inRoad, onIsland);
  islandTraffic.forEach((one, i) => {
    if (one.bike && !one.rider && npcs.makeRider) { // somebody to ride it, once the people have loaded
      one.rider = npcs.makeRider(i);
      one.rider.position.set(0, -0.17, -0.2);
      one.group.add(one.rider);
    }
    // Anything still moving when it reaches him knocks him flying.
    const hx = player.group.position.x - one.group.position.x, hz = player.group.position.z - one.group.position.z;
    if (onIsland && !driving && !boating && !downed && player.downTime < 0 && one.speed > 3.5 && Math.hypot(hx, hz) < (one.bike ? 1.15 : 1.9) && Math.abs(player.group.position.y - one.group.position.y) < 1.5) {
      const what = one.bike ? 'motorbike' : 'car', blow = Math.round(one.speed * (one.bike ? 2 : 2.6));
      if (health - blow <= 0) deathCause = `You were run over by a ${what}.`;
      knockDown(player, one.group.position);
      if (one.speed > 6) breakBone('leg');
      sfx('crash');
      toast(`A ${what} hits you!`);
      hurtPlayer(blow);
      one.stun = 2.5;
      one.speed = 0;
    }
  });
  if (testView.has('rob') && !updateSmuggle.robbed && player.bones && islandTraffic[1]?.rider) { updateSmuggle.robbed = true; const bike = islandTraffic[1]; bike.speed = 0; player.group.position.set(bike.group.position.x + 1.5, 0.7, bike.group.position.z); toggleDriving(); console.log(`TEST rob: driving ${driving} ${truck.name} bike ${!!truck.bike} wanted ${wanted > 0} on the road ${islandTraffic.length}, bikes ${islandTraffic.filter((v) => v.bike).length}`); } // ?rob takes a motorbike
  if (testView.has('hit') && !updateSmuggle.hit && player.bones && islandTraffic[1]?.rider && gameTime > 1) { updateSmuggle.hit = true; const bike = islandTraffic[1]; bike.speed = 12; player.group.position.set(bike.group.position.x + 0.3, 0.7, bike.group.position.z + 0.3); } // ?hit puts him under one
  const stopped = onIsland && !driving && !boating ? islandTraffic.find((one) => one.speed < 3.5 && near(one.group.position.x, one.group.position.z, 3.2)) : null;
  if (stopped && !chatOpen) { usePrompt.textContent = stopped.bike ? 'Press F to shove the rider off and take the motorbike' : 'Press F to pull the driver out and take the car'; usePrompt.style.display = 'block'; }
  if (coconutPalm() && !chatOpen && usePrompt.style.display !== 'block') { usePrompt.textContent = 'Press E to knock down a coconut and eat it'; usePrompt.style.display = 'block'; }
  if (testView.has('nut') && !updateSmuggle.nut && player.bones) { updateSmuggle.nut = true; const [px, pz] = airport.junglePalms[0]; player.group.position.set(px + 1.2, 2, pz); health = 50; console.log(`TEST nut: by a palm ${coconutPalm()}`); useKey(); console.log(`TEST nut: health ${health} | ${toastEl.textContent}`); } // ?nut stands him by a palm and eats one
  if (testView.has('crate') && !updateSmuggle.set) { updateSmuggle.set = true; bag.crate = 1; showBag(); }
  if (testView.has('use') && !updateSmuggle.used && player.bones && npcs.cashiers?.length) { updateSmuggle.used = true; useKey(); console.log(`TEST use: cash ${money} crate ${bag.crate} wanted ${wanted > 0} | ${toastEl.textContent}`); }
  if (bag.crate && (jailed > 0 || downed)) { // locked up, or dead: the crate is gone
    bag.crate = 0;
    showBag(); persist();
    setTimeout(() => toast('The crate of cigarettes is gone.'), 5000);
  }
  const spot = runSpot();
  if (spot && !chatOpen && usePrompt.style.display !== 'block') {
    usePrompt.textContent = spot === 'biggs' ? 'Press E to talk to Mr Biggs' : bag.crate ? `Press E to sell Benny the crate (${gs(RUN_PAY)})` : 'Press E to talk to Benny';
    usePrompt.style.display = 'block';
  }
}

// --- Hurricanes ---------------------------------------------------------------------------------------------
// Every tenth day a hurricane comes through, from 11 in the morning until 2 in the afternoon. His phone
// warns him the day before and again that morning. While it blows: driving rain, a dark sky, thunder
// and lightning, a wind that shoves him about, things flying through the air, a deadly sea, and no
// flights. Indoors he is safe.
const STORM_FROM = 11, STORM_TO = 14;
let storm = 0, stormClock = 0, debrisWait = 8, thunderWait = 5, gustWait = 0, stormTold = '', stormTested = false;
const stormDay = () => day % 10 === 0;
const stormEl = overlay('inset:0;background:rgba(34,42,54,1);opacity:0');
const flashEl = overlay('inset:0;background:#f4f8ff;opacity:0');
const stormBanner = overlay('display:none;left:50%;top:60px;transform:translateX(-50%);font-weight:bold;font-size:17px;color:#fff3e0;background:rgba(150,25,15,0.85);padding:6px 16px;border-radius:8px');
const DROPS = 1500, rainSpots = new Float32Array(DROPS * 6), rainSeed = Array.from({ length: DROPS }, () => [Math.random() * 44 - 22, Math.random() * 22, Math.random() * 44 - 22]);
const rain = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(rainSpots, 3)), new THREE.LineBasicMaterial({ color: 0xcfd8e0, transparent: true, opacity: 0.5, fog: false }));
rain.frustumCulled = false;
rain.visible = false;
scene.add(rain);
// What the phone says about the weather.
function weatherLine() {
  const left = (10 - day % 10) % 10, box = (text, bad) => `<div style="margin-top:8px;padding:7px 8px;border-radius:10px;font-size:12.5px;${bad ? 'background:#7a1a12;color:#fff3e0;font-weight:bold' : 'background:#1b1f27;color:#cfe6f2'}">${text}</div>`;
  if (storm > 0.05) return box('⚠ HURRICANE NOW. Stay indoors. All flights cancelled.', true);
  if (stormDay() && hourNow < STORM_FROM) return box(`⚠ HURRICANE WARNING: it arrives TODAY at ${STORM_FROM}:00. Get indoors and stay there.`, true);
  if (left === 1) return box(`⚠ HURRICANE WARNING: one arrives TOMORROW at ${STORM_FROM}:00.`, true);
  return box(`Weather: fine. Next hurricane expected in ${left || 10} day${(left || 10) > 1 ? 's' : ''}.`, false);
}
function updateStorm(dt) {
  if (testView.has('day') && !stormTested) { stormTested = true; day = Number(testView.get('day')); }
  // How hard it is blowing: it builds over half an hour of the game's day, and dies away the same.
  const rise = Math.min(1, Math.max(0, (hourNow - STORM_FROM) / 0.5)), fall = Math.min(1, Math.max(0, (STORM_TO - hourNow) / 0.5));
  const want = testView.has('storm') ? 1 : stormDay() ? Math.min(rise, fall) : 0;
  storm += (want - storm) * Math.min(1, 1.5 * dt);
  if (storm < 0.002) storm = 0;
  // The phone buzzes with a warning the day before, and again on the morning itself.
  const told = stormDay() && hourNow < STORM_FROM ? `${day}-today` : (10 - day % 10) % 10 === 1 ? `${day}-tomorrow` : '';
  if (told && told !== stormTold) {
    stormTold = told;
    sfx('error');
    toast(told.endsWith('today') ? `Your phone buzzes. HURRICANE WARNING: it hits at ${STORM_FROM}:00 today. Get indoors before then. (P for your phone.)` : `Your phone buzzes. HURRICANE WARNING: one arrives tomorrow at ${STORM_FROM}:00. (P for your phone.)`);
    if (phoneOpen) drawPhone();
  }
  npcs.stormy = storm > 0.4;
  wind.strength.value = storm;       // the palm trees bend with it
  wind.time.value = stormClock;
  swayPalms(storm, stormClock, player.group.position);
  stormEl.style.opacity = 0.5 * storm;
  flashEl.style.opacity = Math.max(0, Number(flashEl.style.opacity) - dt * 5);
  const here = player.group.position, indoors = ceilingAt(here) !== Infinity, under = camera.position.y < 0.17 && here.x > seaParts.shoreX;
  stormBanner.style.display = storm > 0.3 ? 'block' : 'none';
  stormBanner.textContent = indoors ? 'HURRICANE · you are safe indoors' : 'HURRICANE · GET INDOORS';
  rain.visible = storm > 0.02 && !indoors && !under;
  if (storm <= 0) return;
  stormClock += dt;
  if (rain.visible) { // sheets of rain, driven sideways, all round the camera
    rain.material.opacity = 0.55 * storm;
    const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
    for (let i = 0; i < DROPS; i++) {
      const [sx, sy, sz] = rainSeed[i], y = ((sy - stormClock * 30) % 22 + 22) % 22, slant = (22 - y) * 0.45, n = i * 6;
      rainSpots[n] = cx + sx - slant; rainSpots[n + 1] = cy - 8 + y; rainSpots[n + 2] = cz + sz + slant * 0.5;
      rainSpots[n + 3] = rainSpots[n] + 0.45; rainSpots[n + 4] = rainSpots[n + 1] + 1.0; rainSpots[n + 5] = rainSpots[n + 2] - 0.22;
    }
    rain.geometry.attributes.position.needsUpdate = true;
  }
  gustWait -= dt;
  if (gustWait <= 0) { gustWait = 1.1; sfx('gust'); }
  thunderWait -= dt;
  if (thunderWait <= 0 && storm > 0.5) { thunderWait = 5 + Math.random() * 11; flashEl.style.opacity = indoors ? 0.25 : 0.7; setTimeout(() => sfx('thunder'), 500 + Math.random() * 900); }
  if (indoors || driving || trip || jailed > 0 || downed) return;
  // Out in it: the wind shoves him along, and now and then something flying hits him.
  const gust = storm * (0.55 + 0.45 * Math.sin(stormClock * 1.7) * Math.sin(stormClock * 0.6));
  if (!boating) { here.x -= 2.0 * gust * dt; here.z += 1.0 * gust * dt; }
  cam.yaw += Math.sin(stormClock * 7) * 0.06 * storm * dt;
  debrisWait -= dt * storm;
  if (debrisWait <= 0) {
    debrisWait = 7 + Math.random() * 9;
    if (Math.random() < 0.6) {
      const what = ['a sheet of roofing zinc', 'a flying branch', 'a coconut', 'somebody\'s garden chair', 'a road sign'][Math.floor(Math.random() * 5)];
      if (health <= 12) deathCause = `You were killed by ${what} in the hurricane.`;
      sfx('crash');
      toast(`WHACK. You are hit by ${what}. Get indoors!`);
      hurtPlayer(12);
    }
  }
}

// --- The running track, and the Olympics ---------------------------------------------------------------
// Every lap he runs round the track on Jamaica makes him one per cent faster, for good. When he is
// fast enough, Coach Miller enters him in the Olympic 200 metres against five others.
const oval = airport.track, LAP = 200, MOST_LAPS = 80;
const training = Object.assign({ laps: 0, gold: false }, saved.training);
let lapMetres = 0, lastSpot = null, race = null;
const trackEl = overlay('display:none;left:50%;top:60px;transform:translateX(-50%);font-weight:bold;font-size:16px;color:#16181c;background:rgba(254,209,0,0.92);padding:6px 16px;border-radius:8px;text-align:center');
// Where somebody is on the track: how many metres round from the start line, and how far out from the inside edge (null if not on it).
function trackSpot(x, z) {
  const lx = x - oval.x, lz = z - oval.z, R = oval.R, bend = Math.PI * R;
  let s, out;
  if (lx > 25) { out = Math.hypot(lx - 25, lz) - R; s = 50 + (Math.atan2(-lz, lx - 25) + Math.PI / 2) * R; }
  else if (lx < -25) { out = Math.hypot(lx + 25, lz) - R; s = 100 + bend + (Math.atan2(lz, -(lx + 25)) + Math.PI / 2) * R; }
  else if (lz > 0) { out = lz - R; s = lx + 25; }
  else { out = -lz - R; s = 50 + bend + (25 - lx); }
  return out > -1.2 && out < 6 * oval.lane + 1.2 ? { s: s % LAP, out } : null;
}
// The place on the track that is `s` metres round, in a given lane: [x, z].
function trackPoint(s, lane) {
  const R = oval.R, r = R + 0.6 + lane * oval.lane, bend = Math.PI * R;
  s = ((s % LAP) + LAP) % LAP;
  if (s < 50) return [oval.x - 25 + s, oval.z + r];
  if (s < 50 + bend) { const a = (s - 50) / R - Math.PI / 2; return [oval.x + 25 + Math.cos(a) * r, oval.z - Math.sin(a) * r]; }
  if (s < 100 + bend) return [oval.x + 25 - (s - 50 - bend), oval.z - r];
  const a = (s - 100 - bend) / R - Math.PI / 2;
  return [oval.x - 25 - Math.cos(a) * r, oval.z + Math.sin(a) * r];
}
const atCoach = () => !driving && !boating && !race && near(oval.coach.x, oval.coach.z, 2.6) && player.group.position.x > 2500;
function startRace() {
  const rivals = (npcs.cashiers || []).filter((one) => one.spot?.runner);
  if (rivals.length < 5) return;
  if (ill.leg) return toast('Coach Miller looks at your leg. "Yuh cyaan run wid a broken leg. See di doctor first."');
  gun.equipped = false;
  knifeOut = false;
  fadeEl.style.opacity = 1;
  (testView.has('race') ? (go) => go() : (go) => setTimeout(go, 900))(() => { // (straight away when testing)
    const [x, z] = trackPoint(0, 0);
    player.group.position.set(x, 0.72, z);
    player.group.rotation.y = Math.PI / 2;
    cam.yaw = -Math.PI / 2;
    race = { phase: 'ready', timer: 4, time: 0, metres: 0, last: 0, off: 0, rivals: rivals.map((body, i) => ({ body, lane: i + 1, metres: 0, speed: 0, top: body.spot.pace * (0.97 + Math.random() * 0.06), done: 0 })) };
    fadeEl.style.opacity = 0;
    toast('THE OLYMPIC 200 METRES. One lap. Hold Shift to sprint when the gun goes. Stay on the track!');
  });
}
function finishRace(place) {
  const names = ['GOLD', 'SILVER', 'BRONZE'], prize = [training.gold ? 30000 : 150000, 60000, 30000][place - 1] || 0;
  if (prize) { jmoney += prize; showMoney(); sfx('levelup'); }
  if (place === 1) training.gold = true;
  persist();
  toast(place === 1 ? `GOLD! You are the Olympic champion in ${race.time.toFixed(2)} seconds! The whole island goes wild. Prize: ${jd(prize)}.`
    : place <= 3 ? `${names[place - 1]}! You finish ${place === 2 ? 'second' : 'third'} in ${race.time.toFixed(2)} seconds. Prize: ${jd(prize)}. Run more laps and come back for the gold.`
    : place ? `You finish ${place}th of six in ${race.time.toFixed(2)} seconds. No medal. Every lap of training makes you 1% faster: keep running.`
    : 'DISQUALIFIED: you left the track.');
  for (const rival of race.rivals) { rival.body.running = false; rival.body.group.position.copy(rival.body.home); rival.body.group.rotation.y = 0; }
  race = null;
}
let raceHold = false;
function updateTrack(dt) {
  player.fit = 1 + 0.01 * Math.min(MOST_LAPS, training.laps); // what all that running has done for him
  const here = player.group.position, onIsland = here.x > 2500, spot = onIsland && !driving && !boating ? trackSpot(here.x, here.z) : null;
  if (testView.has('laps') && !updateTrack.set) { updateTrack.set = true; training.laps = Number(testView.get('laps')); }
  if (testView.has('race') && !updateTrack.raced && !race && player.bones && (npcs.cashiers || []).some((one) => one.spot?.runner)) { updateTrack.raced = true; startRace(); }
  if (testView.has('autorun') && player.bones && (!race || race.phase === 'run')) { // ?autorun carries him round the track at his sprinting speed
    updateTrack.ran = (updateTrack.ran || 0) + 6.5 * player.fit * dt;
    const [ax, az] = trackPoint(updateTrack.ran, 0);
    here.set(ax, 0.72, az);
  }
  const spotNow = onIsland && !driving && !boating ? trackSpot(here.x, here.z) : null;
  raceHold = false;
  if (race) {
    trackEl.style.display = 'block';
    if (race.phase === 'ready') { // on your marks...
      race.timer -= dt;
      raceHold = true;
      race.rivals.forEach((rival) => { const [x, z] = trackPoint(0, rival.lane); rival.body.group.position.set(x, 0.72, z); rival.body.group.rotation.y = Math.PI / 2; rival.body.running = false; });
      trackEl.textContent = race.timer > 3 ? 'ON YOUR MARKS' : race.timer > 0.6 ? `${Math.ceil(race.timer - 0.6)}` : 'SET...';
      if (race.timer <= 0) { race.phase = 'run'; sfx('shot'); race.last = 0; }
      return;
    }
    race.time += dt;
    // The others run their lanes.
    for (const rival of race.rivals) {
      if (rival.done) continue;
      rival.speed = Math.min(rival.top, rival.speed + 5 * dt);
      rival.metres += rival.speed * dt;
      const [x, z] = trackPoint(rival.metres, rival.lane), [nx, nz] = trackPoint(rival.metres + 1, rival.lane);
      rival.body.group.position.set(x, 0.72, z);
      rival.body.group.rotation.y = Math.atan2(nx - x, nz - z);
      rival.body.running = true;
      if (rival.metres >= LAP) { rival.done = race.time; rival.body.running = false; }
    }
    // And he runs his.
    if (spotNow) {
      let step = spotNow.s - race.last;
      if (step > LAP / 2) step -= LAP; else if (step < -LAP / 2) step += LAP;
      race.metres += step;
      race.last = spotNow.s;
      race.off = 0;
    } else if ((race.off += dt) > 2.5) return finishRace(0);
    const ahead = race.rivals.filter((rival) => rival.done || rival.metres > race.metres).length;
    trackEl.textContent = `OLYMPIC 200 m · ${Math.max(0, Math.round(LAP - race.metres))} m to go · you are ${['1st', '2nd', '3rd', '4th', '5th', '6th'][ahead]}`;
    if (race.metres >= LAP) finishRace(1 + race.rivals.filter((rival) => rival.done).length);
    else if (race.time > 90) finishRace(6);
    return;
  }
  // Training: every full lap round, in the right direction, is one per cent more speed.
  if (spotNow) {
    if (lastSpot !== null) {
      let step = spotNow.s - lastSpot;
      if (step > LAP / 2) step -= LAP; else if (step < -LAP / 2) step += LAP;
      lapMetres = Math.max(0, lapMetres + step);
    }
    lastSpot = spotNow.s;
    if (lapMetres >= LAP) {
      lapMetres -= LAP;
      if (training.laps < MOST_LAPS) {
        training.laps++;
        sfx('levelup');
        persist();
        toast(`Lap ${training.laps}! You are now ${training.laps}% faster than when you started.${training.laps === 15 ? ' Coach Miller is watching you.' : ''}`);
      } else toast('Another lap. You are as fast as a person can get.');
    }
  } else lastSpot = null;
  const nearTrack = onIsland && Math.hypot(here.x - oval.x, here.z - oval.z) < 60;
  trackEl.style.display = nearTrack ? 'block' : 'none';
  if (nearTrack) trackEl.textContent = `Laps run: ${training.laps} · speed +${Math.min(MOST_LAPS, training.laps)}%${spotNow ? ` · this lap ${Math.round(lapMetres)} of 200 m` : ''}${training.gold ? ' · OLYMPIC CHAMPION' : ''}`;
  if (atCoach() && !chatOpen) { usePrompt.textContent = 'Press E to enter the Olympic 200 metres'; usePrompt.style.display = 'block'; }
}

// --- Muggers -------------------------------------------------------------------------------------------------
// After dark, every so often, somebody in the street pulls a knife: "Your money or your life." Hand
// over everything in his pockets (E) and they run off. Refuse, run, or take too long, and they stab,
// and keep stabbing. He can fight back. Money in the bank is safe, which is what the bank is for.
let mug = null, mugWait = 50;
const mugEl = overlay('display:none;left:50%;top:26%;transform:translateX(-50%);font-weight:bold;font-size:22px;color:#fff3e0;background:rgba(120,20,15,0.9);padding:12px 22px;border-radius:10px;text-align:center');
function endMug(walkOff = true) {
  if (!mug) return;
  armNpc(mug.npc, false);
  mug.npc.mugger = false;
  if (walkOff) dismissNpc(mug.npc);
  mugEl.style.display = 'none';
  mug = null;
  mugWait = 70 + Math.random() * 80;
}
function payMugger() {
  if (testView.has('mug')) console.log(`TEST pay: cash ${money} J$ ${jmoney} at ${gameTime.toFixed(1)}`);
  const took = [];
  if (money > 0) took.push(gs(money));
  if (jmoney > 0) took.push(jd(jmoney));
  speak(mug.npc, took.length ? 'Smart. Now forget my face.' : 'Nothing?! You are not worth the trouble.', 4);
  toast(took.length ? `You hand over ${took.join(' and ')}. The mugger runs off into the dark.${bank ? ' Your money in the bank is safe.' : ' (Money in the bank cannot be taken.)'}` : 'You turn out your empty pockets. The mugger spits and walks away.');
  money = 0;
  jmoney = 0;
  sfx('error');
  showMoney(); persist();
  endMug();
}
function updateMug(dt) {
  const here = player.group.position, free = !driving && !boating && !trip && !race && jailed <= 0 && !downed && !arresting && ceilingAt(here) === Infinity && waterDepthAt(here) <= 0;
  if (!mug) {
    if (!free || !(isNight() || testView.has('mug')) || storm > 0.3) return;
    mugWait -= dt;
    if (mugWait > 0 && !(testView.has('mug') && !updateMug.tested)) return;
    const npc = pickMugger(npcs, here);
    if (!npc) { mugWait = 6; return; }
    updateMug.tested = true;
    mug = { npc, phase: 'come', timer: 0 };
    npc.state = 'mug';
    npc.mugger = true;
    armNpc(npc, true);
    return;
  }
  const npc = mug.npc, distance = Math.hypot(npc.group.position.x - here.x, npc.group.position.z - here.z);
  if (npc.state === 'dead' || npc.away) { if (npc.state === 'dead') toast('The mugger goes down. The knife skitters across the ground.'); return endMug(false); }
  if (!free && mug.phase !== 'attack') return endMug();          // he got indoors, or into a car: they slink off
  mug.timer += dt;
  if (mug.phase === 'come') {
    if (distance < 2.4) { mug.phase = 'demand'; mug.timer = 0; sfx('megaphone'); speak(npc, 'YOUR MONEY. ALL OF IT. NOW!', 6); }
    else if (mug.timer > 20) endMug();
  } else if (mug.phase === 'demand') {
    const left = Math.max(0, 7 - mug.timer);
    mugEl.style.display = 'block';
    mugEl.innerHTML = `"YOUR MONEY OR YOUR LIFE!"<div style="font-size:16px;font-weight:normal;margin-top:5px">Press <b>E</b> to hand over the cash on you · or fight · ${left.toFixed(0)} seconds</div>`;
    if (left <= 0 || distance > 5 || npc.state !== 'mug' || testView.get('mug') === 'refuse') { // too slow, or he ran, or he hit them
      mug.phase = 'attack';
      mug.timer = 0;
      mugEl.style.display = 'none';
      speak(npc, 'Wrong answer.', 3);
      if (npc.state === 'mug') provokeNpc(npc);
    } else if (testView.get('mug') === 'pay') payMugger();
  } else {
    // They come at him with the knife, again and again, until one of them is down or he gets clear away.
    if (npc.state === 'idle' || npc.state === 'walk') provokeNpc(npc);
    if (distance > 45 || mug.timer > 40) endMug();
  }
}

// --- The Irie Beach Bar on Jamaica: a round for everybody ------------------------------------------
const ROUND_PRICE = 1200; // Jamaican dollars
const atIrieBar = () => !driving && !boating && !trip && near(airport.barSpot.x, airport.barSpot.z, 2.6);
function buyRound() {
  if (jmoney < ROUND_PRICE) return sfx('error'), toast(`A round is ${jd(ROUND_PRICE)}, and you have ${jd(jmoney)}. Winston only takes Jamaican dollars: the cash machine by the airstrip changes money.`);
  if (drinking > 0) return;
  jmoney -= ROUND_PRICE;
  showMoney();
  sfx('buy');
  const cheers = ['Cheers, mon!', 'Respect, bredda!', 'Big up yuhself!', 'Nuff respect!'];
  (npcs.cashiers || []).filter((one) => one.spot?.drinker).forEach((one, i) => { // they raise their bottles and drink with him
    one.sip = 2.4;
    one.friendly = true;
    setTimeout(() => speak(one, cheers[i % cheers.length], 4), 300 + i * 500);
  });
  bag.beer++;
  drink(); // and so does he
  toast('Winston lines up cold island lagers. Everybody drinks with you. (They like you now: try asking one to be your friend.)');
}

// --- The phone, and friends ---------------------------------------------------------------------------
// Somebody is only a friend if you asked them (press T, and say something like "be my friend") and
// they said yes. Friends go in the phone. Press P to take it out, and a number to ring one.
const friends = (saved.friends || []).slice(0, 9);
let phoneOpen = false, phoneNote = '';
const giftDay = {};
const phoneEl = overlay('display:none;right:26px;bottom:150px;width:250px;min-height:330px;box-sizing:border-box;background:#101216;border:3px solid #3a3f48;border-radius:26px;padding:16px 14px;color:#e6e8ea;font-size:14px;z-index:6;box-shadow:0 6px 20px rgba(0,0,0,0.6)');
function addFriend(name) {
  if (!name || friends.includes(name)) return;
  if (friends.length >= 9) return toast('Your phone is full: nine friends is plenty.');
  friends.push(name);
  sfx('levelup');
  persist();
  toast(`${name} is now your friend. Press P for your phone to call them.`);
}
function drawPhone() {
  const list = friends.length
    ? friends.map((name, i) => `<div style="display:flex;gap:10px;padding:6px 4px;border-top:1px solid #2a2e36"><b style="width:18px;color:#5fc8f0">${i + 1}</b><span style="flex:1">${name}</span><span style="opacity:0.6">call</span></div>`).join('')
    : '<div style="opacity:0.75;padding:10px 4px">No friends yet.<br><br>Face somebody, press <b>T</b> and ask: <i>"will you be my friend?"</i><br><br>They only go in here if they say yes.</div>';
  phoneEl.innerHTML = `<div style="text-align:center;font-size:11px;opacity:0.6">Day ${day} · ${String(Math.floor(hourNow)).padStart(2, '0')}:${String(Math.floor(hourNow % 1 * 60)).padStart(2, '0')} · Bank G$ ${bank.toLocaleString('en-US')}</div>
    ${weatherLine()}
    <div style="font-size:18px;font-weight:bold;margin:8px 0 6px">Friends</div>${list}
    <div style="min-height:70px;margin-top:10px;padding:8px;background:#1b1f27;border-radius:10px;color:#ffe9a0">${phoneNote}</div>
    <div style="margin-top:8px;font-size:11px;opacity:0.6;text-align:center">${friends.length ? 'Press a number to call · ' : ''}P to put it away</div>`;
}
function setPhone(open) {
  if (open && ((driving && truck.plane) || trip || jailed > 0 || chatOpen)) return;
  phoneOpen = open;
  phoneEl.style.display = open ? 'block' : 'none';
  if (open) { phoneNote = ''; sfx('click'); drawPhone(); }
}
const PHONE_LINES = ['Hey! Good to hear from you.', 'I am at the beach. Come down some time.', 'Did you hear? Somebody cracked the vault at Gator Bank.', 'Stay away from the Sharks. Bad news.',
  'Iron Vic is still unbeaten at the Fight Club, you know.', 'The fishing off the pier is good today.', 'Check the flag before you swim. I mean it.', 'You should fly out to Jamaica some time.',
  'I am stuck at work. Call me later?', 'Lucky Palm took all my money again.', 'What are you up to? Nothing illegal, I hope.', 'Fix-It Garage did my car for ten bucks a dent. Bargain.'];
function phoneKey(code) {
  const name = friends[['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9'].indexOf(code)];
  if (!name) return;
  sfx('megaphone');
  phoneNote = `Calling ${name}…`;
  drawPhone();
  setTimeout(() => {
    if (!phoneOpen) return;
    if (Math.random() < 0.12) phoneNote = `${name} does not pick up.`;
    else if (giftDay[name] !== day && Math.random() < 0.3) { // a real friend helps out, once a day at most
      giftDay[name] = day;
      money += 20;
      showMoney(); persist();
      sfx('coin');
      phoneNote = `<b>${name}:</b> "You sound broke. I am sending you G$ 20. Do not spend it all at the casino."`;
    } else phoneNote = `<b>${name}:</b> "${PHONE_LINES[Math.floor(Math.random() * PHONE_LINES.length)]}"`;
    drawPhone();
  }, 1500);
}

// --- Sharp Cuts: haircuts ----------------------------------------------------------------------------
// His hat only comes off while his hair is being cut. A haircut replaces the long hair that came
// with the hat, so afterwards he wears the same sort of hat over the new cut.
let barberOpen = false, trim = null, hairKey = saved.hair || 'own', hairParts = null, myHat = null, hairReady = false;
const atBarber = () => !driving && !boating && near(barberShop.chair.x, barberShop.chair.z, 1.4);
function applyHair(key, hatOn) {
  const head = player.bones.head, old = player.group.getObjectByName('Wolf3D_Headwear');
  if (hairParts) head.remove(hairParts);
  if (myHat) head.remove(myHat);
  hairParts = myHat = null;
  hairKey = key;
  if (old) old.visible = key === 'own' && hatOn;
  if (key === 'own') return;
  hairParts = makeHair(key);
  myHat = makeHat();
  myHat.visible = hatOn;
  head.add(hairParts, myHat);
  for (const part of [hairParts, myHat]) part.traverse((piece) => piece.layers.enable(1)); // so they show in reflections
}
function drawBarber() {
  const rows = HAIRCUTS.map((cut, i) => `${i % 3 === 0 ? `<div style="margin-top:8px;font-weight:bold;color:#ffe27a">${cut.grade} cuts · G$ ${cut.price}</div>` : ''}
    <div style="display:flex;gap:12px;padding:4px 0;border-top:1px solid rgba(243,230,192,0.2)"><b style="width:22px">${i + 1}</b><span style="flex:1"><b>${cut.name}</b> <small>· ${cut.blurb}</small></span>
    <b>${hairKey === cut.key ? 'YOURS NOW' : ''}</b></div>`).join('');
  shopEl.innerHTML = `<div style="font-size:22px;font-weight:bold;margin-bottom:2px">Sharp Cuts</div>
    <div>"What are we doing today?" &nbsp;·&nbsp; You have <b>G$ ${money.toLocaleString('en-US')}</b></div>${rows}
    <div style="margin-top:10px;opacity:0.85">Press 1 to 9 for a cut &nbsp;·&nbsp; E to leave<br><small>Your hat comes off for the trim and goes straight back on after.</small></div>`;
}
function setBarber(open) {
  barberOpen = open;
  shopEl.style.display = open ? 'block' : 'none';
  if (open) drawBarber();
}
function barberKey(code) {
  const cut = HAIRCUTS[['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9'].indexOf(code)];
  if (!cut) return;
  if (money < cut.price) return sfx('error'), toast(`That one is G$ ${cut.price}. You only have G$ ${money} on you.`);
  money -= cut.price;
  showMoney();
  sfx('buy');
  setBarber(false);
  gun.equipped = false;
  knifeOut = false;
  trim = { time: 0, cut };
  applyHair(cut.key, false); // hat off while the scissors are out
  toast(`Your hat comes off. Tony gets to work on ${cut.name.toLowerCase().startsWith('the ') ? cut.name.toLowerCase() : `a ${cut.name.toLowerCase()}`}...`);
}
// Where he has to stand to use things.
const near = (px, pz, reach) => Math.hypot(player.group.position.x - px, player.group.position.z - pz) < reach;
const atCounter = () => near(54, 13.2, 3.2) && player.group.position.z > 6.3; // in front of Big Al
// Cash machines: the one in Sunny's Mart and three on the streets of Miami.
const ATMS = [{ x: 27.1, z: -21.25, reach: 1.5 }, ...city.atms.map((spot) => ({ ...spot, reach: 1.2 })), ...gatorBank.userData.atms.map((spot) => ({ ...spot, reach: 1.0 }))];
const atCashMachine = () => player.group.position.y < 3 && ATMS.some((atm) => near(atm.x, atm.z, atm.reach));
let atmOpen = false, atmNote = '';
function drawAtm() {
  const row = (key, name, detail) => `<div style="display:flex;gap:14px;padding:7px 0;border-top:1px solid rgba(243,230,192,0.25)"><b style="width:26px">${key}</b><span style="flex:1"><b>${name}</b></span><b>${detail}</b></div>`;
  const wait = Math.ceil(wagesAt + WAGE_WAIT - gameTime);
  shopEl.innerHTML = `<div style="font-size:22px;font-weight:bold;margin-bottom:4px">Gator Bank cash machine</div>
    <div style="margin-bottom:4px">Cash on you: <b>G$ ${money.toLocaleString('en-US')}</b> &nbsp;·&nbsp; In the bank: <b>G$ ${bank.toLocaleString('en-US')}</b></div>
    <div style="margin-bottom:10px;opacity:0.85"><small>If you die you lose the cash on you. Money in the bank is safe.</small></div>
    ${row(1, 'Pay in all your cash', `G$ ${money.toLocaleString('en-US')}`)}${row(2, 'Pay in G$ 100', '')}${row(3, 'Take out G$ 100', '')}
    ${row(4, 'Take out everything', `G$ ${bank.toLocaleString('en-US')}`)}${row(5, 'Collect your wages', wait > 0 ? `in ${wait} s` : `G$ ${WAGES}`)}
    <div style="min-height:22px;margin:8px 0;font-weight:bold;color:#ffe9a0">${atmNote}</div>
    <div style="opacity:0.8">Press 1 to 5 &nbsp;·&nbsp; E to leave</div>`;
}
function setAtm(open) {
  atmOpen = open;
  shopEl.style.display = open ? 'block' : 'none';
  if (open) { atmNote = ''; sfx('click'); drawAtm(); }
}
function atmKey(choice) {
  const move = (amount) => { // positive pays in, negative takes out
    if (amount === 0) { sfx('error'); atmNote = 'Nothing to move.'; return; }
    money -= amount;
    bank += amount;
    sfx('coin');
    atmNote = amount > 0 ? `Paid in G$ ${amount.toLocaleString('en-US')}.` : `Here is your G$ ${(-amount).toLocaleString('en-US')}.`;
  };
  if (choice === 0) move(money);
  else if (choice === 1) move(Math.min(100, money));
  else if (choice === 2) move(-Math.min(100, bank));
  else if (choice === 3) move(-bank);
  else if (choice === 4) {
    const wait = Math.ceil(wagesAt + WAGE_WAIT - gameTime);
    if (wait > 0) { sfx('error'); atmNote = `Your next wages arrive in ${wait} seconds.`; }
    else { wagesAt = gameTime; money += WAGES; sfx('coin'); atmNote = `Your wages: G$ ${WAGES} in cash.`; }
  } else return;
  showMoney();
  persist();
  drawAtm();
}
const WAGES = 250, WAGE_WAIT = 60;
let wagesAt = -WAGE_WAIT;
function useKey() {
  if (workout) return;
  if (jailed > 0) return payBail();
  if (trim || trip) return;
  if (phoneOpen) return setPhone(false);
  if (race) return;
  if (mug?.phase === 'demand') return payMugger();
  if (atCoach()) return startRace();
  if (runSpot()) return runUse();
  if (atDoctor()) return visitDoctor();
  if (fxOpen) return setFx(false);
  if (islandAtm()) return setFx(true);
  if (atAltar()) return pray();
  if (atIrieBar()) return buyRound();
  if (ticketOpen) return setTickets(false);
  if (ticketDesk()) return setTickets(true);
  if (barberOpen) return setBarber(false);
  if (atBarber()) return setBarber(true);
  if (mechanicJob()) return repairCar();
  if (boxOpen) return setBox(false);
  if (atBookie()) return setBox(true);
  if (photosOpen) return showPhotos(false);
  const jobSpot = jobNear();
  if (jobSpot) return jobUse(jobSpot);
  const pal = !driving && !boating ? dogNear(dogs, player.group.position, 1.9) : null;
  if (pal && !pal.breed.hostile && pal.state !== 'flee') { patDog(pal); return toast(`${pal.name} the ${pal.label} loves that. Good dog!`); }
  if (casinoOpen) return setCasino(null);
  const game = casinoSpot();
  if (game === 'cage') return visitCage();
  if (game) return setCasino(game);
  if (liftAt()) return rideLift();
  if (fishingState) return reelIn();
  if (fishingSpot()) return castLine();
  if (atStall()) return sellFish();
  const station = !driving && !boating ? stationNear(gym, player.group.position) : null;
  if (station) return startWorkout(station);
  if (atBed()) return trySleep();
  if (martOpen) return setMart(false);
  if (atMartCounter()) return setMart(atMartCounter());
  if (shopOpen) return setShop(false);
  if (atCounter()) return setShop(true);
  if (atmOpen) return setAtm(false);
  if (atCashMachine()) return setAtm(true);
  if (coconutPalm()) return eatCoconut();
  toggleFridge(house, player.group.position);
}

// The lake, at the left-hand end of the street, with boats to take out.
const lake = createLake(scene, -178, -98, 76, scene.fog, SUN_OFFSET, -9);
let boating = null; // the boat the player is in, if any
const alligators = createAlligators(scene);
let caught = 0; // seconds until he is pulled out after an alligator gets him
const notice = document.createElement('div');
notice.textContent = 'An alligator got you!';
notice.style.cssText = 'display:none;position:fixed;left:50%;top:22%;transform:translateX(-50%);font:bold 30px system-ui,sans-serif;color:#fff3e0;background:rgba(150,25,15,0.8);padding:12px 24px;border-radius:10px;pointer-events:none';
document.body.appendChild(notice);
if (new URLSearchParams(location.search).has('gator')) { // ?gator puts one on the road near the lake, to check how it looks
  alligators[0].state = 'show';
  alligators[0].group.position.set(-176.5, 0.05, -4.6); // on the road, where grass doesn't hide it
  alligators[0].group.rotation.y = alligators[0].heading = Number(new URLSearchParams(location.search).get('gator')) || 1.2;
  alligators[0].group.scale.setScalar(1);
}

// The pickup truck, parked on the pavement beside his building in Miami. F gets in and out.
const truckStart = (new URLSearchParams(location.search).get('truckat') || '677,-11.5,1.5708').split(',').map(Number); // ?truckat=x,z,heading
const homeTruck = Object.assign(createTruck(scene, renderer, truckStart[0], truckStart[1], truckStart[2]), { name: 'truck', own: true });
// Other people's cars, parked about the place. They drive like the truck, but taking one is theft.
const vehicles = [homeTruck, ...createCars(scene, renderer), ...airport.planes, ...cuba.cars];
// The patrol cars outside both police stations can be taken too.
for (const station of [policeStation, miamiPD]) for (const { car, block } of station.userData.cars) {
  scene.attach(car); // lift it out of the station so it can drive away
  const heading = 2 * Math.atan2(car.quaternion.y, car.quaternion.w); // which way it points (it only ever turns about the upright)
  car.rotation.order = 'YXZ';
  car.rotation.set(0, heading, 0);
  vehicles.push({ group: car, spinners: [], steerers: [], heading, speed: 0, steer: 0, engine: null, topSpeed: 38, name: 'police car', block });
}
// Everyone who can be shot, stabbed, punched or kicked: ordinary people, gangs, boxers and the police.
let targetList = [];
const targets = () => {
  const count = npcs.length + (npcs.officers?.length || 0);
  if (targetList.length !== count) targetList = [...npcs, ...(npcs.officers || [])];
  return targetList;
};
let truck = homeTruck; // whichever of them he is driving, or drove last
const nearVehicle = () => {
  let best = null, nearest = 1;
  for (const one of vehicles) {
    const distance = Math.hypot(player.group.position.x - one.group.position.x, player.group.position.z - one.group.position.z);
    if (distance / (one.reach || 3.4) < nearest) { nearest = distance / (one.reach || 3.4); best = one; } // (planes are bigger, so can be reached from further off)
  }
  return best;
};
const speedo = document.getElementById('speed');
let driving = false;
function toggleDriving() {
  const here = player.group.position;
  if (trip) return; // a passenger stays in his seat
  if (!driving && !boating) jackTraffic();
  if (!driving && !boating) jackIsland();                   // a car stopped in the road can be taken off its driver
  if (!driving && !boating) truck = nearVehicle() || truck; // the one he is standing beside
  const there = truck.group.position;
  // Boats: F gets in when next to one, and out again at the jetty or the bank.
  if (boating) {
    if (Math.abs(boating.speed) > 4) return toast('Slow down first: press Space to cut the throttle, then F.'); // too fast to get out
    // Onto the jetty or the bank if one is close; otherwise over the side into the water.
    const spot = boating.fishing ? leaveFishingBoat(seaParts) : (boating.jetSki ? seaLanding(seaParts, boating) : landingSpot(lake, boating)) || new THREE.Vector3(
      boating.group.position.x + Math.cos(boating.heading) * 1.5, 0, boating.group.position.z - Math.sin(boating.heading) * 1.5);
    boating.throttle = 0;
    setEngine(boating, false);
    boating.speed = 0;
    boating = null;
    here.copy(spot);
    return;
  }
  const climb = !driving && waterDepthAt(here) > 0 ? climbAboardSpot(seaParts, here) : null; // swimming beside the fishing boat
  if (climb) { here.copy(climb); sfx('splash'); return; }
  const boat = !driving && player.downTime < 0 ? boatNear(lake, here) || jetSkiNear(seaParts, here) || fishingBoatNear(seaParts, here) : null;
  if (boat) {
    boating = boat;
    if (boat.fishing) castOff(seaParts);
    setEngine(boat, true);
    gun.equipped = false;
    return;
  }
  if (driving) {
    if (Math.abs(truck.speed) > 2) return; // too fast to jump out
    driving = false;
    setEngine(truck, false);
    truck.speed = 0;
    // Step out of the driver's door, on the left.
    here.set(there.x + Math.cos(truck.heading) * 1.7, there.y, there.z - Math.sin(truck.heading) * 1.7);
    player.group.rotation.y = truck.heading;
    player.group.visible = true;
  } else if (player.downTime < 0 && Math.hypot(here.x - there.x, here.z - there.z) < 3.4) {
    driving = true;
    setEngine(truck, true);
    player.group.visible = false;
    gun.equipped = false;
    if (truck.block) truck.block.height = 0; // nothing is parked there any more
    if (!truck.own && !truck.stolen) { // somebody else's car
      truck.stolen = true;
      commitCrime();
      toast(`You steal the ${truck.name}! The police are on their way.`);
    }
  }
}

// Iguanas sunning themselves around the house: [x, z, facing, colour, size].
// Most are green; big males turn orange. (?calm stops them running off, for checking how they look.)
const iguanas = createIguanas(scene, [
  [2, -6, Math.PI / 2, 0x7fb246, 1.0],
  [-4.5, -12.5, 2.4, 0xe0863a, 1.0],
  [10.2, -13.2, -0.8, 0x8fbf4e, 0.8],
  [6, -31, 0.5, 0x94a15c, 0.9],
  [-9, -5, 3.6, 0x74ad48, 0.7],
  [14, -22, 1.2, 0xd9954a, 0.95],
], new URLSearchParams(location.search).has('calm'));
if (new URLSearchParams(location.search).has('fridge')) house.userData.fridgeOpen = true; // ?fridge starts with it open

// --- Player -----------------------------------------------------------------
const player = createPlayer();
scene.add(player.group);

const gun = createGun(scene, renderer);
// Start with the gun he was carrying last time, if he owns one.
setWeapon(gun, owned.size ? (saved.weapon && owned.has(saved.weapon) ? saved.weapon : [...owned][0]) : 'pistol');
const crosshair = document.getElementById('crosshair');
let aimHeld = false;   // right mouse button is down
let aimTimer = 0;      // keeps the arm up for a moment after a shot
let shotQueued = false;
let burstLeft = 0, burstWait = 0; // rounds still to come in a burst from the camo rifle
const toStaff = new THREE.Vector3();
let facingLocked = false; // V: he stops turning, so the camera can stay on his face
// Punches alternate: a quick left jab, then a hard right. Each has a duration (seconds) and a damage (out of 100).
const PUNCHES = { left: { time: 0.19, damage: 20 }, right: { time: 0.32, damage: 50 } };
let punchQueued = false, punchTime = 0, punchTotal = 1, punchLanded = false;
let punchHand = 'left', nextHand = 'left', lastPunchAt = -9;
let guardTime = 0, guardBlend = 0; // his fists stay up for a moment after a punch

// --- Input ------------------------------------------------------------------
const keys = new Set();
window.addEventListener('keydown', (e) => {
  if (chatOpen) return; // typing to somebody: the keys are words, not controls
  keys.add(e.code);
  if (e.code === 'Space') e.preventDefault(); // stop the page scrolling
  if (!e.repeat) {
    const pick = { Digit1: 'pistol', Digit2: 'shotgun', Digit3: 'rifle' }[e.code];
    const martPick = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
    if (fxOpen) fxKey(e.code);                                              // changing money on the island
    else if (phoneOpen) phoneKey(e.code);                                        // using the phone
    else if (ticketOpen) ticketKey(e.code);                                      // choosing where to fly
    else if (barberOpen) barberKey(e.code);                                      // choosing a haircut
    else if (boxOpen) boxKey(e.code);                                            // at the bookie's booth
    else if (atmOpen) atmKey(['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].indexOf(e.code));   // using a cash machine
    else if (casinoOpen) casinoKey(e.code);                                 // playing in the casino
    else if (martOpen) { if (martPick >= 0) buyMart(martPick); }                 // buying at Sunny's Mart
    else if (shopOpen && e.code === 'Digit4') sellIguanas();
    else if (!shopOpen && e.code === 'Digit4') smoke();
    else if (shopOpen && e.code === 'Digit5') buyKnife();
    else if (!shopOpen && e.code === 'Digit5') drink();
    else if (!shopOpen && e.code === 'Digit6') eat();
    else if (pick && shopOpen) buy(pick);                                       // buying at Big Al's counter
    else if (pick && owned.has(pick)) { setWeapon(gun, pick); gun.equipped = true; } // switching between guns he owns
    else if (e.code === 'Digit7') { setWeapon(gun, 'camo'); gun.equipped = true; toast('Your camo assault rifle. Ten rounds a burst, and nobody gets up again.'); }
    if (e.code === 'KeyK') toggleKnife(); // draw or put away the knife
    if (e.code === 'KeyM') toggleMap(gameMap);
    if (e.code === 'KeyP') setPhone(!phoneOpen);
    if (e.code === 'KeyB') useSpray();
    if (e.code === 'KeyX') startKick();
    if (e.code === 'KeyZ') startThrow();
    if (e.code === 'KeyQ') { // draw or put away the gun
      if (owned.size) gun.equipped = !gun.equipped;
      if (shopOpen) drawShop();
      if (martOpen) drawMart();
      else toast("You don't own a gun yet. Big Al's Guns is across the road from the petrol station.");
    }
  }
  if (e.code === 'KeyT' && !e.repeat) { // talk to whoever is in front of him; out on the fishing boat it works the automatic pole
    if (talkable) { e.preventDefault(); openChat(talkable); } else toggleAutoPole();
  }
  if (e.code === 'KeyR' && !e.repeat) { // put the view back to normal
    cam.pitch = 0.18;
    cam.distance = 3.6;
    tipsy = 0;
    facingLocked = false;
    toast('View reset.');
  }
  if (e.code === 'KeyV' && !e.repeat) { // lock or unlock which way he faces
    facingLocked = !facingLocked;
    toast(facingLocked ? 'Facing locked: he keeps facing this way while you move and punch. Press V to unlock.' : 'Facing unlocked: he turns the way he moves again.');
  }
  if (e.code === 'KeyE' && !e.repeat) { useKey(); if (chatOpen) e.preventDefault(); } // talk to Big Al, collect wages, or open the fridge
  if (e.code === 'KeyF' && !e.repeat) toggleDriving(); // get in or out of the truck
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

// Third-person camera: sits behind the character, just over the right shoulder.
const cam = { yaw: 0, pitch: 0.18, distance: 3.6, shoulder: 0.55, height: 1.6 };
const MOUSE_SENSITIVITY = 0.0025;

// Test views: add ?front to the game's address to see the character from the
// front, ?crouch to hold him in a crouch, ?walk or ?run to move him sideways,
// and ?gun, ?aim and ?fire to draw, aim and keep firing the gun.
const testView = new URLSearchParams(location.search);
// The game starts at home, in the penthouse, looking out of the front windows.
// (He lives in a hut on Jamaica now. The penthouse in Miami is still his, and so is its bed.)
player.group.position.copy(airport.home.spawn);
player.group.rotation.y = airport.home.facing;
cam.yaw = airport.home.facing + Math.PI;
if (testView.has('at')) { // ?at=x,z starts the player somewhere else
  const [x, z, y = 0] = testView.get('at').split(',').map(Number); // (a third number is the height, for upstairs)
  player.group.position.set(x, y, z);
}
if (testView.has('camh')) Object.assign(cam, { height: Number(testView.get('camh')), pitch: 0.02 }); // ?camh=1.7 puts the camera at head height
if (testView.has('face')) player.group.rotation.y = Number(testView.get('face')); // ?face=1.57 turns him
if (testView.has('yaw')) cam.yaw = Number(testView.get('yaw')); // ?yaw=1.5 turns the camera
if (testView.has('dist')) Object.assign(cam, { distance: Number(testView.get('dist')), pitch: 0.3, height: 0.9 }); // ?dist=2 moves it in close and low
if (testView.has('front')) {
  player.group.rotation.y = 0;
  cam.yaw = Number(testView.get('yaw')) || 0;
  Object.assign(cam, { distance: Number(testView.get('front')) || 3, height: Number(testView.get('camh')) || 1.2, shoulder: 0, pitch: testView.has('camh') ? 0.02 : 0.15 });
}

// Click the game to capture the mouse; Esc releases it. Holding a mouse button
// and dragging also works, for browsers that don't allow mouse capture.
const canvas = renderer.domElement;
let dragging = false;
canvas.addEventListener('click', () => {
  if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
});
canvas.addEventListener('mousedown', (e) => {
  dragging = true;
  if (e.button === 2) aimHeld = true;
  // Left click shoots, but only once the mouse is captured (the first click captures it).
  if (e.button === 0 && gun.equipped && document.pointerLockElement === canvas) shotQueued = true;
  // With no gun out, left click throws a punch.
  if (e.button === 0 && !gun.equipped && document.pointerLockElement === canvas) punchQueued = true;
});
window.addEventListener('mouseup', (e) => {
  dragging = false;
  if (e.button === 2) aimHeld = false;
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault()); // right click aims; no menu
window.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas && !dragging) return;
  cam.yaw -= e.movementX * MOUSE_SENSITIVITY;
  cam.pitch += e.movementY * MOUSE_SENSITIVITY;
  cam.pitch = THREE.MathUtils.clamp(cam.pitch, -0.35, 1.2);
});
canvas.addEventListener('wheel', (e) => {
  cam.distance = THREE.MathUtils.clamp(cam.distance + e.deltaY * 0.004, 2, 10);
  e.preventDefault();
}, { passive: false });

const lookAt = new THREE.Vector3(), camToLook = new THREE.Vector3();
function updateCamera() {
  const p = player.group.position;
  const rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw); // camera right

  // Point the camera looks at: the character's upper back, nudged sideways.
  const height = boating ? (boating.fishing ? 3.4 : 1.9) : driving ? (truck.plane ? 3.2 : 1.9) : cam.height - crouchDrop(player); // camera dips when crouching
  // Aiming pulls the camera in closer and further over the shoulder.
  const shoulder = driving || boating ? 0 : cam.shoulder + 0.2 * player.aim;
  const distance = boating ? cam.distance * (boating.fishing ? 4.4 : 1.7) : driving ? cam.distance * (truck.plane ? truck.camFar || 5.2 : 2.1) : cam.distance * (1 - 0.4 * player.aim); // further back to fit the truck in
  lookAt.set(p.x + rx * shoulder, p.y + height, p.z + rz * shoulder);

  const flat = Math.cos(cam.pitch) * distance;
  camera.position.set(
    lookAt.x + Math.sin(cam.yaw) * flat,
    Math.max((player.dive || 0) > 0.4 ? 0.6 - seaBedAt(p) : 0.3, lookAt.y + Math.sin(cam.pitch) * distance), // never below ground (or, when he dives, below the sea bed)
    lookAt.z + Math.cos(cam.yaw) * flat
  );
  // Indoors, stay under the ceiling.
  camera.position.y = Math.max(camera.position.y, terrainAt(camera.position.x, camera.position.z) + 0.5); // (on a hillside, not inside it)
  camera.position.y = Math.min(camera.position.y, ceilingAt(p) - 0.25);
  // Don't let a wall come between the camera and the character: move in closer instead.
  camToLook.copy(camera.position).sub(lookAt);
  const wanted = camToLook.length();
  camToLook.divideScalar(wanted);
  const clear = Math.min(rayToObstacle(lookAt, camToLook, wanted), roomLimit(p, lookAt, camToLook, wanted));
  if (clear < wanted) camera.position.copy(lookAt).addScaledVector(camToLook, Math.max(0.25, clear - 0.2));
  camera.lookAt(lookAt);
}

// --- Picture: vintage film grade --------------------------------------------
const { composer, vintage } = createComposer(renderer, scene, camera);

// --- Resize + loop ----------------------------------------------------------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

const aimDir = new THREE.Vector3(), aimPoint = new THREE.Vector3();
// ?npc stands one person right in front of the crosshair, for checking shooting works
// (a woman, or a man with ?npc&man).
const npcs = createNpcs(scene, MAP_SIZE / 2, testView.has('npc') ? new THREE.Vector3(0.75, 0, -5) : null, testView.has('man') ? 'man' : 'woman',
  [{ x: 20.65, z: -22.1, facing: Math.PI / 2 },   // the cashier behind the counter in Sunny's Mart
   { x: 51.0, z: -26.6, facing: Math.PI / 2 },     // the one in the Gator Gas kiosk
   gunShop.userData.cashier,
   policeStation.userData.officer,
   miamiPD.userData.officer, miamiPD.userData.guard, ...miamiPD.userData.prisoners, // Miami's desk officer, the cell guard, and the prisoners
   gatorBank.userData.teller, VAULT_PEOPLE.stranger, VAULT_PEOPLE.lenny, ...VAULT_PEOPLE.holders, // the bank teller, and the six people in the vault job
   { x: 500, z: 13.2, facing: Math.PI, name: 'Dr Rivera', special: true, dye: 'doctor', say: 'Press E and I will take a look at you.' }, // the doctor in Miami General Hospital
   ...airport.swimmers, ...[[990, -52, 'Brad'], [1002, -16, 'Kayla'], [984, 20, 'Marcus'], [1010, 44, 'Jess']].map(([x, z, name], i) => ({ x, z, facing: 0, name, woman: i % 2 === 1, swimmer: true })), // people swimming, off Jamaica and off Miami beach
   cuba.barman,                                    // the barman on the plaza in Cuba
   airport.police.officer, ...airport.police.prisoners, // Kingston's desk sergeant and the four prisoners in its cells
   airport.track.coach, ...airport.track.runners,  // the coach and the five other sprinters at the track
   BIGGS, BENNY, CUSTOMS,                          // the cigarette run: the man with the crates, the buyer, and the customs officer
   ...airport.barPeople, ...airport.shopPeople,    // (and the shopkeepers, the jerk chef and the pastor)
   //                           // the barman and the regulars at the beach bar on Jamaica
   airport.clerk, ...airport.stations.filter((one) => one.seller).map((one) => one.seller), // the people who sell plane tickets
                                    // the check-in desk at the airport
   garage.mechanic, barberShop.barber,             // the mechanic and the barber on Brew St
   seaParts.guard.post,                            // the lifeguard on the beach
   fightClub.bookie,                               // the bookie at the Fight Club
   beerShop.userData.cashier,                      // the cashier in the beer shop
   city.casino.dealer,                             // the croupier at the roulette table
   city.casino.cashier],                           // and the cashier in the casino's cage
  [...policeStation.userData.posts, ...miamiPD.userData.posts, ...airport.police.posts, ...cuba.police.posts]);                // and the officer at the police station's front desk                       // and Big Al, behind the gun shop counter
if (testView.has('npcpace')) npcDebug.pace = Number(testView.get('npcpace')); // hold NPCs in walk (1) or run (2)
let hitFlash = 0; // the crosshair turns red for a moment when a shot hits someone

// Being hit: his head snaps round, the view jolts and the screen edges flash red.
// A punch also knocks him flat on his back.
if (testView.has('stay')) player.freezeDown = Number(testView.get('stay')) || 1; // ?stay=2 freezes a knock-down 2 seconds in, to check the pose
let hurt = 0;
const hurtOverlay = document.getElementById('hurt');
function onStrike(kind, npc) {
  if (npc.mugger) { // a knife, not a fist
    if (driving || boating) return;
    if (health <= 38) deathCause = 'A mugger stabbed you to death for the money in your pockets.';
    bleed();
    sfx('whoosh');
    toast('The knife goes in. Fight back or run!');
    return hurtPlayer(38);
  }
  if (bout && npc === bout.npc) return boxingHit(npc); // in the ring it is only boxing
  if (driving || boating) return; // safe inside the truck or out on the water
  player.slap = 1;
  hurt = 1;
  cam.yaw += kind === 'punch' ? 0.2 : 0.1;
  if (kind === 'punch') { knockDown(player, npc.group.position); if (Math.random() < 0.12) breakBone('arm'); }
  if (testView.has('slap')) console.log(`TEST ${kind} landed`);
}
if (testView.has('gun')) gun.equipped = true;
if (testView.get('gun') === 'camo') setWeapon(gun, 'camo'); // ?gun=camo starts with the special rifle
if (testView.has('gunshow')) { // a big copy of the gun, side-on, for checking the model
  const display = createDisplayGun(renderer);
  display.scale.setScalar(5);
  display.position.set(0.1, 1.15, 1.2);
  display.rotation.y = Number(testView.get('gunshow')) || Math.PI / 2;
  scene.add(display);
}

const clock = new THREE.Clock();
let gameTime = 0;

// Move the whole game forward by `dt` seconds.
function step(dt) {
  gameTime += dt;
  updateTalk(dt);
  const time = gameTime;

  const input = {
    x: (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + (testView.has('walk') || testView.has('run') ? 1 : 0),
    z: (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0),
    sprint: keys.has('ShiftLeft') || keys.has('ShiftRight') || testView.has('run'),
    jump: keys.has('Space') || testView.has('jump'),
    crouch: keys.has('KeyC') || testView.has('crouch'),
    smoke: smokeDrag,
    surface: breath <= 0, // out of air: he has to come up
    lift: drinking > 0 ? drinkLift : undefined,
    tilt: drinkTilt,
    lockFacing: facingLocked,
  };

  // Punching. The fist lands part-way through the swing, on whoever is right in front of him.
  if (testView.has('punch')) punchQueued = true;
  if (punchQueued && punchTime <= 0 && !driving && !boating && player.downTime < 0 && !shopOpen && !martOpen && !casinoOpen && !atmOpen && !boxOpen && kickTime <= 0 && throwTime <= 0) {
    if (gameTime - lastPunchAt > 1.5) nextHand = 'left'; // a fresh flurry always opens with the jab
    punchHand = knifeOut ? 'right' : testView.get('punch') || nextHand; // the knife is in his right hand (?punch=right holds one hand, for checking the pose)
    nextHand = punchHand === 'left' ? 'right' : 'left';
    punchTime = punchTotal = PUNCHES[punchHand].time * (1 - 0.05 * stats.boxing); // Boxing: faster punches
    punchLanded = false;
    sfx('whoosh');
    lastPunchAt = gameTime;
    guardTime = punchTotal + 1.1;
  }
  punchQueued = false;
  guardTime -= dt;
  guardBlend += ((guardTime > 0 ? 1 : 0) - guardBlend) * Math.min(1, 12 * dt);
  const fight = { guard: guardBlend, left: 0, right: 0 };
  if (guardBlend > 0.01) input.fight = fight;
  if (punchTime > 0) {
    punchTime -= dt;
    const t = Math.min(1, 1 - punchTime / punchTotal);
    fight[punchHand] = testView.has('hold') ? 1 : t < 0.35 ? t / 0.35 : 1 - (t - 0.35) / 0.65; // out fast, back slower
    input.punch = testView.has('hold') ? 0 : 1; // he turns to face where the camera looks
    if (!punchLanded && t > 0.35) {
      punchLanded = true;
      const at = player.group.position, facing = player.group.rotation.y;
      let target = null, reach = 1.6;
      for (const npc of targets()) {
        if (npc.state === 'dead') continue;
        const dx = npc.group.position.x - at.x, dz = npc.group.position.z - at.z, distance = Math.hypot(dx, dz);
        if (distance < reach && (dx * Math.sin(facing) + dz * Math.cos(facing)) / distance > 0.4) { reach = distance; target = npc; }
      }
      // With nobody in reach, a punch can still flatten an iguana at his feet.
      const lizardInReach = target ? null : iguanas.find((i) => i.state !== 'dead' && i.state !== 'gone' && Math.hypot(i.group.position.x - at.x, i.group.position.z - at.z) < 1.3);
      if (lizardInReach) { killIguana(lizardInReach); playStrike('punch'); }
      if (target) {
        const knockedOut = hitNpc(target, at, ringBlow(target, (knifeOut ? 75 : PUNCHES[punchHand].damage) * (1 + 0.15 * stats.strength) * (ill.arm ? 0.4 : 1))); // Strength: harder punches (and stabs)
        if (knifeOut) { // a stab draws blood
          const wound = target.group.position;
          emitBloodMist(gun, mistSpot.set(wound.x, wound.y + 1.2, wound.z));
          stainGround(wound.x + (Math.random() - 0.5) * 0.5, wound.y, wound.z + (Math.random() - 0.5) * 0.5, 0.14 + Math.random() * 0.14);
        }
        playStrike('punch');
        if (knockedOut && !inRing(target)) dropCash(target.group.position, target.gang ? [10, 20, 50][Math.floor(Math.random() * 3)] : undefined);
        if (!target.gang && !inRing(target)) commitCrime(); // (a bout in the ring is legal)
        if (testView.has('npc')) console.log(knockedOut ? 'TEST punch knocked out' : 'TEST punch landed on npc');
      }
    }
  }

  player.lieScale = 1 - 0.09 * stats.toughness; // Toughness: less time on the floor after a knock-down

  // Training at the gym: he stays put at the equipment and works out for a few seconds.
  if (testView.has('train') && !workout && player.bones) { // ?train=bag, weights or bench starts a workout straight away
    workout = { station: gym.stations.find((s) => s.kind === testView.get('train')), time: 0 };
  }
  if (workout) {
    const { station } = workout, t = workout.time += dt;
    Object.assign(input, { x: 0, z: 0, sprint: false, jump: false, crouch: false, lockFacing: true });
    player.group.rotation.y = station.kind === 'bench' ? 0 : station.facing;
    if (station.kind === 'bag') {
      punchQueued = true;            // a steady stream of jabs and rights
      station.sway = 1;
    } else if (station.kind === 'weights') {
      input.fight = { guard: 0.5 - 0.5 * Math.cos(t * 4.2), left: 0, right: 0 };   // curls: fists up to the chin and down
    } else {
      input.lie = true;
      const press = 0.5 - 0.5 * Math.cos(t * 3.4);                                 // the bar goes down to his chest and back up
      input.fight = { guard: 1, left: press, right: press };
    }
    if (t >= WORKOUT_TIME && !testView.has('train')) finishWorkout();
  }

  // Where the crosshair points: the spot the camera is looking at, on the
  // ground if it's looking down, otherwise far off in the distance.
  camera.getWorldDirection(aimDir);
  let reach = 300, hitsGround = false;
  if (aimDir.y < -0.001 && -camera.position.y / aimDir.y < reach) {
    reach = -camera.position.y / aimDir.y;
    hitsGround = true;
  }
  // Bullets go straight through walls, windows and anything else that is built: only the ground stops them.
  const struck = findNpcHit(targets(), camera.position, aimDir, reach);
  if (struck) {
    reach = struck.distance;
    hitsGround = false;
  }
  const lizard = findIguanaHit(iguanas, camera.position, aimDir, reach); // an iguana in the way is hit first
  if (lizard) {
    reach = lizard.distance;
    hitsGround = false;
  }
  aimPoint.copy(camera.position).addScaledVector(aimDir, Math.max(reach, cam.distance + 2));

  // Shooting raises the arm first, then fires once it is up.
  aimTimer -= dt;
  if (shotQueued || testView.has('fire')) aimTimer = 0.9;
  input.aim = !driving && !boating && gun.equipped && (aimHeld || aimTimer > 0 || testView.has('aim'));
  input.aimPoint = aimPoint;
  input.kick = gun.kick;
  // The camo rifle fires ten rounds each time: the first here, and nine more close behind it.
  burstWait -= dt;
  const nextRound = burstLeft > 0 && burstWait <= 0 && gun.kind === 'camo' && gun.equipped;
  if (nextRound) { burstLeft--; burstWait = 0.07; gun.cooldown = 0; }
  if (gun.kind !== 'camo' || !gun.equipped) burstLeft = 0;
  if ((nextRound || ((shotQueued || testView.has('fire')) && burstLeft <= 0 && player.aim > 0.8)) && fireGun(gun, aimPoint, hitsGround)) {
    shotQueued = false;
    if (gun.kind === 'camo' && !nextRound) { burstLeft = 9; burstWait = 0.07; }
    // It also drops shop staff, guards and prisoners: whoever is nearest the line of fire.
    const staff = gun.kind === 'camo' && !(struck && struck.distance <= gun.range) ? (npcs.cashiers || []).find((one) => {
      if (one.dead > 0) return false;
      const along = toStaff.set(one.group.position.x, one.group.position.y + 1.1, one.group.position.z).sub(camera.position).dot(aimDir);
      return along > 0 && along < reach + 0.6 && toStaff.addScaledVector(aimDir, -along).length() < 0.55;
    }) : null;
    if (staff) { strangle(staff, player.group.position); hitFlash = 0.15; commitCrime(); }
    const dogStruck = findDogHit(dogs, camera.position, aimDir, Math.min(reach, gun.range));
    if (dogStruck && (!struck || dogStruck.distance < struck.distance)) { // a dog was in the way
      hurtDog(dogStruck.dog, gun.damage);
      hitFlash = 0.15;
      if (!dogStruck.dog.breed.hostile) commitCrime(); // shooting somebody's pet is a crime; a guard dog is self-defence
    } else if (lizard && lizard.distance <= gun.range) {
      killIguana(lizard.iguana);
      hitFlash = 0.15;
    } else if (struck && struck.distance <= gun.range) {
      let killed = hitNpc(struck.npc, player.group.position, gun.damage);
      // ?npc=kill makes the first hit count twice, to check the fall without waiting for a second shot.
      if (testView.get('npc') === 'kill') killed = hitNpc(struck.npc, player.group.position) || killed;
      hitFlash = 0.15;
      if (killed) dropCash(struck.npc.group.position, struck.npc.gang ? [10, 20, 50][Math.floor(Math.random() * 3)] : undefined);
      if (!struck.npc.gang) commitCrime(killed ? (struck.npc.officer ? 3 : 2) : 1); // the police don't mind what happens to gang members
      if (testView.has('npc')) console.log(killed ? 'TEST npc killed' : 'TEST npc hit');
    }
  }
  hitFlash -= dt;
  crosshair.style.background = hitFlash > 0 ? '#e0452f' : '';
  hurt = Math.max(0, hurt - dt * 1.8);
  hurtOverlay.style.opacity = hurt * hurt;
  // ?slap makes the first NPC angry straight away, to check the slap without shooting.
  if (testView.has('slap') && npcs.length && !npcs[0].provoked) {
    npcs[0].provoked = true;
    provokeNpc(npcs[0]);
  }
  if (!gun.equipped || player.downTime >= 0) shotQueued = false; // no shooting while knocked down
  crosshair.style.display = gun.equipped && !driving && !boating ? 'block' : 'none';

  if (testView.has('drive') && !driving && player.bones) toggleDriving(); // ?drive starts at the wheel with the pedal down
  if (testView.has('sail') && !boating && player.bones) { boating = lake.boats[0]; } // ?sail starts in a boat with the throttle open
  updateLake(lake, time, dt, boating, { throttle: testView.has('sail') ? 1 : input.z, steer: testView.has('sail') ? 0.25 : -input.x, cut: input.jump });
  updateJetSkis(seaParts, time, dt, boating, { throttle: testView.has('ski') ? 1 : input.z, steer: testView.has('ski') ? 0.12 : -input.x, brake: input.jump });
  updateFishingBoat(seaParts, time, dt, boating, { throttle: testView.has('trawl') ? 1 : input.z, steer: testView.has('trawl') ? 0.3 : -input.x, cut: input.jump });
  if (testView.has('anchor') && boating?.fishing && boating.group.position.x > seaParts.shoreX + 150) { // ?trawl&anchor: sail out, then leave the wheel
    boating.speed = 0;
    toggleDriving();
    step.anchored = true;
  }
  if (testView.has('trawl') && !boating && !step.anchored && player.bones) { boating = seaParts.fishing; castOff(seaParts); } // ?trawl starts at the fishing boat's wheel, under way
  if (testView.has('ski') && !boating && player.bones) boating = seaParts.skis[Number(testView.get('ski')) || 0]; // ?ski starts on a jet ski at full throttle (?ski=4 for a speed boat)
  if (boating) {
    // He stands in the boat, which carries him (and the camera) along.
    // He sits on the stern bench with a hand on the tiller.
    const at = boating.group.position;
    player.group.position.set(
      at.x + Math.sin(boating.heading) * (boating.seat ?? SEAT).back,
      at.y + (boating.seat ?? SEAT).height + 0.1 - (HIP_HEIGHT - SIT_DROP),
      at.z + Math.cos(boating.heading) * (boating.seat ?? SEAT).back
    );
    player.group.rotation.set(0, boating.heading, 0);
    sitPlayer(player, dt, !!boating.stand);
    if (Math.abs(boating.speed) > 1) {
      let turn = boating.heading + Math.PI - cam.yaw;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      cam.yaw += turn * Math.min(1, 2 * dt);
    }
  } else if (driving) {
    if (truck.autopilot) flyTrip(dt);
    else if (truck.plane) {
      // Flying: W and S work the throttle, A and D turn, Shift pulls the nose up, C pushes it down, Space brakes on the ground.
      const ended = updatePlane(truck, { throttle: testView.has('plane') ? 1 : input.z, steer: -input.x, up: input.sprint || testView.has('climb'), down: input.crouch, handbrake: input.jump }, dt, MAP_SIZE / 2);
      if (ended && !downed) {
        const wreck = truck;
        sfx('crash');
        deathCause = ended === 'ditch' ? `You put the ${wreck.name} in the water.` : `You crashed the ${wreck.name}.`;
        hurtPlayer(9999);
        setTimeout(() => resetPlane(wreck), 1400); // a new one is wheeled out
      }
    } else updateTruck(truck, { throttle: testView.has('drive') ? 1 : input.z, steer: -input.x, handbrake: input.jump }, dt, MAP_SIZE / 2);
    if (driving) player.group.position.copy(truck.group.position); // the rest of the world follows the truck (unless a flight has just let him off)
    if (driving && truck.bike) { // on a motorbike he can be seen, sitting astride it
      player.group.visible = true;
      player.group.position.x -= Math.sin(truck.heading) * 0.22;
      player.group.position.z -= Math.cos(truck.heading) * 0.22;
      player.group.position.y += 0.8 - (HIP_HEIGHT - SIT_DROP);
      player.group.rotation.set(0, truck.heading, truck.group.rotation.z);
      sitPlayer(player, dt, false);
    }
    // The camera swings round to stay behind the truck.
    if (Math.abs(truck.speed) > 1.5) {
      let turn = truck.heading + Math.PI - cam.yaw;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      cam.yaw += turn * Math.min(1, 2.5 * dt);
    }
    // Anyone in the way gets run over.
    if (Math.abs(truck.speed) > 3 && !(truck.plane && truck.group.position.y > 1.5)) {
      for (const npc of npcs) {
        if (npc.state === 'dead') continue;
        const ahead = Math.sign(truck.speed) * 1.6;
        const dx = npc.group.position.x - (truck.group.position.x + Math.sin(truck.heading) * ahead);
        const dz = npc.group.position.z - (truck.group.position.z + Math.cos(truck.heading) * ahead);
        if (Math.hypot(dx, dz) < 1.5) {
          for (let blow = 0; blow < 3; blow++) hitNpc(npc, truck.group.position);
          commitCrime();
        }
      }
    }
  } else {
    updateStrangle(dt, input);
    updateMelee(dt, input);
    updatePlayer(player, input, cam.yaw, dt, MAP_SIZE / 2);
  }
  speedo.style.display = driving || boating ? 'block' : 'none';
  if (driving || boating) speedo.textContent = `${Math.round(Math.abs((boating || truck).speed) * 2.237)} mph` + (driving && truck.plane ? ` · ${Math.round(truck.group.position.y * 3.28)} ft · throttle ${Math.round(truck.throttle * 100)}%` : '') + (driving && truck.dents ? ` · ${truck.dents} dent${truck.dents > 1 ? 's' : ''}` : '');
  updateHouse(house, player.group.position, dt);
  updateIguanas(iguanas, player.group.position, dt);
  // Walking over a dead iguana picks it up.
  if (!driving && !boating) {
    for (const iguana of iguanas) {
      if (iguana.state !== 'dead' || !near(iguana.group.position.x, iguana.group.position.z, 1.1)) continue;
      collectIguana(iguana);
      sfx('pickup');
      bag.iguanas++;
      showBag(); persist();
      toast(`You pick up the iguana. You are carrying ${bag.iguanas}. Big Al pays G$ ${IGUANA_PRICE} each.`);
    }
  }
  if (testView.has('earn') && !step.seeded && iguanas.length) { // ?earn kills an iguana and drops some cash, to check both
    step.seeded = true;
    killIguana(iguanas[0]);
    dropCash(new THREE.Vector3(0.5, 0, -2.5), 10);
  }
  updateDrops(dt, time);
  // Alligators hunt him while he is in the water. When one gets him it surfaces,
  // the screen flashes red, and a moment later he is hauled out by the jetty.
  const inWater = !boating && !driving && waterDepthAt(player.group.position) > 0.3;
  updateAlligators(alligators, player.group.position, dt, time, inWater && caught <= 0, () => {
    hurt = 1;
    sfx('growl');
    caught = 2.2;
    notice.style.display = 'block';
  });
  if (caught > 0) {
    caught -= dt;
    if (caught <= 0) {
      player.group.position.set(-178, 0, -12);
      setTimeout(() => (notice.style.display = 'none'), 2500);
    }
  }
  updateStore(store, player.group.position, dt);
  updateBeerShop(beerShop, player.group.position, dt);
  updateBeerShop(gatorBank, player.group.position, dt); // (the bank's doors slide the same way)
  updateGasStation(gasStation, player.group.position, dt);
  updateGunShop(gunShop, player.group.position, dt);
  updateCity(city, player.group.position, dt);
  updateSea(seaParts, time);
  const swimmer = !driving && !boating && !downed && jailed <= 0 && waterDepthAt(player.group.position) > 0.9 ? player.group.position : null;
  updateSeaLife(seaLife, time, dt, player.group.position, flagShown === 'purple', swimmer);
  // A shark that reaches him bites, and goes on biting.
  jawWait -= dt;
  if (swimmer) for (const shark of seaLife.sharks) {
    const jaws = shark.group.position;
    if (jawWait > 0 || Math.hypot(jaws.x - swimmer.x, jaws.z - swimmer.z) > 2.3 || Math.abs(jaws.y - swimmer.y - 0.6) > 2.2) continue;
    jawWait = 1.8;
    if (health <= 24) deathCause = 'A shark took you.';
    emitBloodMist(gun, mistSpot.set(swimmer.x, Math.max(swimmer.y + 1, 0.2), swimmer.z));
    sfx('growl');
    sfx('splash');
    toast(sharkToldAt + 20 < gameTime ? 'A SHARK HAS YOU! Get to the shallows!' : 'It bites again!');
    sharkToldAt = gameTime;
    hurtPlayer(24);
  }
  // Swimming on the surface, his hands throw up a little spray.
  if (player.swim > 0.6 && !(player.dive > 0.3) && !driving && !boating && player.bones) {
    splashWait -= dt;
    if (splashWait <= 0) {
      splashWait = 0.28;
      const hand = (splashSide = !splashSide) ? player.bones.handL : player.bones.handR;
      hand.getWorldPosition(puffSpot);
      if (puffSpot.y < 0.5) { puffSpot.y = 0.22; emitSmoke(gun, puffSpot, 0.45); }
    }
  }
  if (testView.has('shark')) { const fish = seaLife.sharks[0].group; fish.position.set(player.group.position.x + 0.4, player.group.position.y + 1.1, player.group.position.z + 3.6); fish.rotation.y = Number(testView.get('shark')) || 1.57; } // ?shark holds one in front of the camera
  updateTurfs(time);
  healOverTime(dt);
  if (testView.has('bleed') && player.bones && Math.floor(gameTime / 1.5) !== Math.floor((gameTime - dt) / 1.5)) hurtPlayer(8); // ?bleed: take a hit every so often, to check the blood
  updateBlood(dt);
  updateFishing(dt, time);
  updateAutoPole(dt);
  updatePoliceStation(policeStation, player.group.position, dt);
  updatePoliceStation(miamiPD, player.group.position, dt);
  updateGym(gym, player.group.position, dt, time);
  const besideCar = !driving ? nearVehicle() : null, byTruck = !!besideCar;
  const byFridge = !driving && !boating && nearFridge(house, player.group.position);
  const byBoat = !driving && !boating && !!(boatNear(lake, player.group.position) || jetSkiNear(seaParts, player.group.position) || fishingBoatNear(seaParts, player.group.position));
  if (boating && !boating.jetSki) speedo.textContent += ` · throttle ${Math.round((boating.throttle || 0) * 100)}%`;
  const canLand = boating && Math.abs(boating.speed) < 4;
  const byAl = !driving && !boating && atCounter(), byCash = !driving && !boating && atCashMachine();
  if (shopOpen && !byAl) setShop(false); // walking away ends the conversation
  if (atmOpen && !byCash) setAtm(false);
  if (testView.has('steal') && !driving && !updatePolice.stole && player.bones) { updatePolice.stole = true; toggleDriving(); console.log(`TEST steal: driving=${driving} ${truck.name} wanted=${wanted > 0}`); } // ?steal takes the nearest car
  if (testView.has('atm') && byCash && !atmOpen && !updatePolice.atmShown) { updatePolice.atmShown = true; setAtm(true); } // ?atm opens it straight away
  const byMart = !driving && !boating && atMartCounter();
  const byBed = !driving && !boating && atBed();
  const gymSpot = !driving && !boating && !workout ? stationNear(gym, player.group.position) : null;
  if (martOpen && !byMart) setMart(false);
  if (testView.has('mart') && byMart && !martOpen) setMart(byMart); // ?mart opens the Sunny's Mart menu straight away

  // Things he has used wear off.
  // Smoking: every four seconds he lifts the cigarette to his mouth for a drag,
  // then lowers it and breathes the smoke out. A thin wisp curls up from the tip.
  if (testView.has('smoke')) smoking = 10.9; // ?smoke holds him mid-drag, to check the pose
  updateKnife();
  cigarette.visible = smoking > 0 && !!player.bones && !driving && !boating;
  if (smoking > 0) {
    const wasDragging = smokeDrag;
    smoking -= dt;
    smokeDrag = smoking > 0 && smoking % 4 > 2.6;
    if (cigarette.visible) {
      const facing = player.group.rotation.y;
      player.bones.handL.getWorldPosition(cigarette.position);
      cigarette.position.x += Math.sin(facing) * 0.07;
      cigarette.position.z += Math.cos(facing) * 0.07;
      cigarette.position.y += player.smokeLift * 0.05;
      cigarette.rotation.y = facing;
      if (Math.floor(smoking * 3) !== Math.floor((smoking + dt) * 3)) { // the wisp from the lit end
        emitSmoke(gun, puffSpot.set(cigarette.position.x + Math.sin(facing) * 0.04, cigarette.position.y + 0.01, cigarette.position.z + Math.cos(facing) * 0.04), 0.35);
      }
      if (wasDragging && !smokeDrag) { // breathing out after the drag
        player.bones.head.getWorldPosition(puffSpot);
        puffSpot.set(puffSpot.x + Math.sin(facing) * 0.14, puffSpot.y + 0.07, puffSpot.z + Math.cos(facing) * 0.14);
        for (let i = 0; i < 3; i++) emitSmoke(gun, puffSpot, 0.8);
      }
    }
  } else {
    smokeDrag = false;
  }
  updateDrinking(dt);
  tipsy = Math.max(0, tipsy - dt);
  if (tipsy > 0) cam.yaw += Math.sin(time * 0.7) * 0.12 * Math.min(1, tipsy / 5) * dt; // the world drifts about
  if (energy > 0) { energy -= dt; if (energy <= 0) player.boost = 1; }
  if (testView.has('shop') && byAl && !shopOpen) setShop(true); // ?shop opens Big Al's menu straight away
  usePrompt.textContent = canLand ? (boating.fishing ? 'Press F to leave the wheel' : 'Press F to get out') : byBoat ? (fishingBoatNear(seaParts, player.group.position) ? 'Press F to take the wheel' : jetSkiNear(seaParts, player.group.position) ? (jetSkiNear(seaParts, player.group.position).speedboat ? 'Press F to take the speed boat' : 'Press F to ride the jet ski') : 'Press F to take the boat out') : byTruck ? (besideCar.plane ? `Press F to fly the ${besideCar.name}` : besideCar.own ? 'Press F to drive your truck' : besideCar.stolen ? `Press F to drive the ${besideCar.name}` : `Press F to steal the ${besideCar.name}`)
    : byBed ? (isNight() ? 'Press E to sleep until morning' : 'You can sleep here once it gets dark (6 in the evening)') : gymSpot ? gymPrompt(gymSpot) : byAl ? 'Press E to buy from Big Al' : byMart ? 'Press E to buy from the cashier' : byCash ? 'Press E to use the cash machine' : 'Press E to open or close the fridge';
  usePrompt.style.display = ((byTruck && !boating) || byFridge || byBoat || canLand || byCash || byAl || byMart || gymSpot || byBed) && !shopOpen && !martOpen && !atmOpen ? 'block' : 'none';
  const fishPrompt = fishingState?.phase === 'bite' ? 'A BITE! Press E now!'
    : fishingState?.phase === 'wait' ? 'Waiting for a bite… (press E to reel in)'
    : fishingState ? ''
    : fishingSpot() ? `Press E to cast your line${boating ? ' · F to leave the wheel' : ''}`
    : atStall() ? (bag.fish.length ? `Press E to sell your ${bag.fish.length} fish for G$ ${holdValue().toLocaleString('en-US')}` : 'Fish stall: bring your catch here to sell it') : '';
  // Aboard the fishing boat, the prompt always says how to work the automatic pole.
  const poleHint = aboardBoat() ? `T: automatic fishing pole (now ${pole.on ? 'ON' : 'OFF'})` : '';
  const climbHint = !boating && !driving && waterDepthAt(player.group.position) > 0 && climbAboardSpot(seaParts, player.group.position) ? 'Press F to climb aboard the fishing boat' : '';
  const boatPrompt = [climbHint, fishPrompt, poleHint].filter(Boolean).join(' · ');
  if (boatPrompt) { usePrompt.textContent = boatPrompt; usePrompt.style.display = 'block'; }
  if (grabbable && !driving && !boating && !shopOpen && !martOpen && !casinoOpen) { usePrompt.textContent = usePrompt.style.display === 'block' ? usePrompt.textContent + '  ·  Hold G to strangle' : 'Hold G to strangle'; usePrompt.style.display = 'block'; }
  if (talkable && !shopOpen && !martOpen && !casinoOpen && !atmOpen && !boxOpen) { usePrompt.textContent = usePrompt.style.display === 'block' ? usePrompt.textContent + '  ·  Press T to talk' : 'Press T to talk'; usePrompt.style.display = 'block'; }
  const game = casinoSpot();
  if (casinoOpen && casinoOpen !== game) setCasino(null); // walking away from the machine or the table
  if (game && !casinoOpen) {
    usePrompt.textContent = game === 'slot' ? 'Press E to play the slot machine' : game === 'roulette' ? 'Press E to play roulette' : 'Press E to talk to the cashier';
    usePrompt.style.display = 'block';
  } else if (casinoOpen) usePrompt.style.display = 'none';
  updateCasino(dt);
  updateBeach(dt);
  updateJob(dt);
  roadPrompts();
  updateIllness(dt);
  updateSmuggle();
  updateStorm(dt);
  updateTrack(dt);
  updateMug(dt);
  // The map: him, his truck, and whoever the vault job needs him to find next.
  if (testView.has('map') && !gameMap.open) toggleMap(gameMap);
  const marks = driving && truck === homeTruck ? [] : [{ x: homeTruck.group.position.x, z: homeTruck.group.position.z, colour: '#e0483a', name: 'Your truck' }];
  if (bag.crate) marks.push({ x: BENNY.x, z: BENNY.z, colour: '#ffe27a', name: 'Benny (take him the crate)' });
  if (job.stage === 0) marks.push({ ...VAULT_PEOPLE.stranger, colour: '#ffffff', name: 'A stranger' });
  if (job.stage === 1) marks.push({ ...VAULT_PEOPLE.lenny, colour: '#ffe27a', name: 'Lenny' });
  if (job.stage === 2) holders.forEach((person, i) => { if (!job.known[i]) marks.push({ ...person, colour: '#ffe27a', name: person.name }); });
  updateMap(gameMap, { x: player.group.position.x, z: player.group.position.z, heading: driving ? truck.heading : boating ? boating.heading : player.group.rotation.y, marks });
  if (testView.has('dog') && !updateJob.dogShown && player.bones) { // ?dog=0,9 stands those two dogs in front of the camera, for checking how they look
    updateJob.dogShown = true;
    player.group.visible = false;
    testView.get('dog').split(',').map(Number).forEach((index, n) => {
      const dog = dogs[index];
      dog.show = true;
      dog.group.position.set(player.group.position.x - 1.05 + n * 1.15, 0, player.group.position.z + 1.0);
      dog.group.rotation.y = Number(testView.get('dogturn') ?? 2.2);
    });
  }
  // Dogs. A bite hurts; a friendly dog close by can be patted.
  updateDogs(dogs, dt, time, player.group.position, { driving: driving || !!boating, wanted: stars, onBite: (dog, damage) => {
    if (downed || jailed > 0 || arresting) return;
    if (health - damage <= 0) deathCause = `${dog.name} the ${dog.label} finished you off.`;
    hurtPlayer(damage);
  } });
  const pal = !driving && !boating && !chatOpen ? dogNear(dogs, player.group.position, 1.9) : null;
  if (pal && !pal.breed.hostile && pal.state !== 'flee' && usePrompt.style.display !== 'block') { usePrompt.textContent = `Press E to pat ${pal.name} the ${pal.label}`; usePrompt.style.display = 'block'; }
  if (boxOpen && !atBookie()) setBox(false);
  if (atBookie() && !boxOpen) { usePrompt.textContent = 'Press E to talk to the bookie'; usePrompt.style.display = 'block'; } else if (boxOpen) usePrompt.style.display = 'none';
  updateBoxing(dt);
  const lift = liftAt();
  if (lift) { usePrompt.textContent = lift === 'up' ? 'Press E to take the lift up to your penthouse' : 'Press E to take the lift down to the lobby'; usePrompt.style.display = 'block'; }
  updateGun(gun, player, dt);
  if (workout && player.bones) {
    const { station } = workout;
    if (station.kind !== 'bench') player.group.position.set(station.spot.x, player.group.position.y, station.spot.z);
    else player.group.position.copy(station.feet); // lying on the bench
    // The weights go wherever his hands are.
    player.group.updateWorldMatrix(true, true);
    if (station.kind === 'weights') {
      [player.bones.handL, player.bones.handR].forEach((hand, i) => {
        hand.getWorldPosition(station.dumbbells[i].position).sub(gym.group.position);
        station.dumbbells[i].rotation.y = player.group.rotation.y;
      });
    } else if (station.kind === 'bench') {
      const left = player.bones.handL.getWorldPosition(new THREE.Vector3()), right = player.bones.handR.getWorldPosition(new THREE.Vector3());
      station.barbell.position.copy(left).add(right).multiplyScalar(0.5).sub(gym.group.position);
    }
  }
  if (driving || boating) gun.mesh.visible = false;
  updatePolice(dt);
  updatePoliceFire(dt);
  updateRoads(dt);
  // Where he is and which way the camera looks, so that only people who could be seen are worked out and drawn.
  camera.getWorldDirection(lookWay);
  const flat = Math.hypot(lookWay.x, lookWay.z);
  npcs.view = { x: player.group.position.x, z: player.group.position.z, cx: camera.position.x, cz: camera.position.z,
    fx: flat > 0.25 ? lookWay.x / flat : 0, fz: flat > 0.25 ? lookWay.z / flat : 0 };
  npcs.threat = gun.equipped && !driving && !boating; // shop staff put their hands up
  npcs.grip = grip;
  updateNpcs(npcs, player.group.position, dt, onStrike, {
    wanted: wanted > 0 && !arresting,
    canCatch: !boating && (!driving || Math.abs(truck.speed) < 3), // a moving truck or a boat can't be stopped on foot
    onArrest: arrest,
  }, {
    canTarget: !downed && jailed <= 0 && !arresting,
    onShot: (npc, hit) => { if (hit) hurtPlayer(driving ? 6 : 12); },   // the truck's bodywork takes half of it
    onAlert: (npc) => toast(`The ${npc.crew.name} open fire! Get off their turf.`),
  });
  updateCamera();
  if (tipsy > 0) camera.rotateZ(Math.sin(time * 1.3) * 0.07 * Math.min(1, tipsy / 5)); // wobbly after a beer
  updateGrass(grass, player.group.position, time);

  sun.target.position.copy(player.group.position);
  sun.position.copy(player.group.position).add(sunOffset);

  sky.position.copy(camera.position); // the sky is always centred on the viewer
  sky.material.uniforms.time.value = time;
  updateDaylight(dt);
  const here = player.group.position;
  updateSound(dt, {
    position: here,
    onFoot: !driving && !boating && player.downTime < 0 && jailed <= 0,
    onGround: player.onGround,
    swimming: (player.swim || 0) > 0.5,
    wading: inWater,
    indoors: ceilingAt(here) < Infinity,
    hardFloor: ceilingAt(here) < Infinity || (here.z > -9.2 && here.z < 0.2) || here.x > 600, // indoors, on the street, or in the city
    night: isNight(),
    wanted: wanted > 0,
    doors: [house.userData.open, house.userData.garageOpen, house.userData.fridgeAmount, store.userData.open, gasStation.userData.open,
      gunShop.userData.open, gym.open, policeStation.userData.open, ...city.doors.map((door) => door.open), beerShop.userData.open, miamiPD.userData.open, gatorBank.userData.open],
  });
  vintage.uniforms.time.value = time;

}

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05); // cap so a paused tab can't cause a huge jump
  // ?ff=20 runs the game 20 times faster, for testing things that take a while.
  const repeats = Number(testView.get('ff')) || 1;
  for (let i = 0; i < repeats; i++) step(repeats > 1 ? 0.05 : dt);
  underwaterLook(dt);
  composer.render();
});
