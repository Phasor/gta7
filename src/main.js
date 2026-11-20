import * as THREE from 'three';
import { createPlayer, updatePlayer, crouchDrop, knockDown, sitPlayer, SIT_DROP, HIP_HEIGHT } from './player.js';
import { PALETTE, createSky, createComposer } from './look.js';
import { createGrass, updateGrass } from './grass.js';
import { addDirt } from './terrain.js';
import { createHouse, updateHouse, toggleFridge, nearFridge } from './house.js';
import { createIguanas, updateIguanas } from './iguana.js';
import { createStore, updateStore } from './store.js';
import { createRoad } from './road.js';
import { createGasStation, updateGasStation } from './gasstation.js';
import { createNeighbourhood } from './neighbourhood.js';
import { createLake, updateLake, boatNear, landingSpot, SEAT } from './lake.js';
import { createTruck, updateTruck, setEngine } from './truck.js';
import { rayToObstacle, ceilingAt, roomLimit } from './world.js';
import { createGun, updateGun, fireGun, createDisplayGun } from './gun.js';
import { createNpcs, updateNpcs, findNpcHit, hitNpc, provokeNpc, debug as npcDebug } from './npc.js';

const MAP_SIZE = 600;     // playable area, metres along each side
const GROUND_SIZE = 2400; // the grass carries on past the edge so the horizon looks endless

// --- Renderer ---------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: false }); // the composer smooths edges instead
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// --- Scene ------------------------------------------------------------------
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(PALETTE.skyHorizon, 120, 700); // distance fades into the horizon haze

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);

// --- Light ------------------------------------------------------------------
scene.add(new THREE.HemisphereLight(PALETTE.shade, PALETTE.bounce, 1.7));

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

// The lake, at the left-hand end of the street, with boats to take out.
const lake = createLake(scene, -178, -98, 76, scene.fog, SUN_OFFSET, -9);
let boating = null; // the boat the player is in, if any

// The pickup truck, parked in the garage facing the door. F gets in and out.
const truckStart = (new URLSearchParams(location.search).get('truckat') || '-4,-22.6,0').split(',').map(Number); // ?truckat=x,z,heading
const truck = createTruck(scene, renderer, truckStart[0], truckStart[1], truckStart[2]);
const speedo = document.getElementById('speed');
let driving = false;
function toggleDriving() {
  const here = player.group.position, there = truck.group.position;
  // Boats: F gets in when next to one, and out again at the jetty or the bank.
  if (boating) {
    const spot = Math.abs(boating.speed) < 2 ? landingSpot(lake, boating) : null;
    if (!spot) return;
    setEngine(boating, false);
    boating.speed = 0;
    boating = null;
    here.copy(spot);
    return;
  }
  const boat = !driving && player.downTime < 0 ? boatNear(lake, here) : null;
  if (boat) {
    boating = boat;
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
const crosshair = document.getElementById('crosshair');
let aimHeld = false;   // right mouse button is down
let aimTimer = 0;      // keeps the arm up for a moment after a shot
let shotQueued = false;

// --- Input ------------------------------------------------------------------
const keys = new Set();
window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'Space') e.preventDefault(); // stop the page scrolling
  if (e.code === 'KeyQ' && !e.repeat) gun.equipped = !gun.equipped; // draw or put away the gun
  if (e.code === 'KeyE' && !e.repeat) toggleFridge(house, player.group.position); // open or shut the fridge
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
if (testView.has('at')) { // ?at=x,z starts the player somewhere else
  const [x, z] = testView.get('at').split(',').map(Number);
  player.group.position.set(x, 0, z);
}
if (testView.has('yaw')) cam.yaw = Number(testView.get('yaw')); // ?yaw=1.5 turns the camera
if (testView.has('dist')) Object.assign(cam, { distance: Number(testView.get('dist')), pitch: 0.3, height: 0.9 }); // ?dist=2 moves it in close and low
if (testView.has('front')) {
  player.group.rotation.y = 0;
  Object.assign(cam, { distance: Number(testView.get('front')) || 3, height: 1.2, shoulder: 0, pitch: 0.15 });
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
  const height = boating ? 1.9 : driving ? 1.9 : cam.height - crouchDrop(player); // camera dips when crouching
  // Aiming pulls the camera in closer and further over the shoulder.
  const shoulder = driving || boating ? 0 : cam.shoulder + 0.2 * player.aim;
  const distance = boating ? cam.distance * 1.7 : driving ? cam.distance * 2.1 : cam.distance * (1 - 0.4 * player.aim); // further back to fit the truck in
  lookAt.set(p.x + rx * shoulder, p.y + height, p.z + rz * shoulder);

  const flat = Math.cos(cam.pitch) * distance;
  camera.position.set(
    lookAt.x + Math.sin(cam.yaw) * flat,
    Math.max(0.3, lookAt.y + Math.sin(cam.pitch) * distance), // never below ground
    lookAt.z + Math.cos(cam.yaw) * flat
  );
  // Indoors, stay under the ceiling.
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
   { x: 51.0, z: -26.6, facing: Math.PI / 2 }]);   // and the one in the Gator Gas kiosk
if (testView.has('npcpace')) npcDebug.pace = Number(testView.get('npcpace')); // hold NPCs in walk (1) or run (2)
let hitFlash = 0; // the crosshair turns red for a moment when a shot hits someone

// Being hit: his head snaps round, the view jolts and the screen edges flash red.
// A punch also knocks him flat on his back.
if (testView.has('stay')) player.freezeDown = Number(testView.get('stay')) || 1; // ?stay=2 freezes a knock-down 2 seconds in, to check the pose
let hurt = 0;
const hurtOverlay = document.getElementById('hurt');
function onStrike(kind, npc) {
  if (driving || boating) return; // safe inside the truck or out on the water
  player.slap = 1;
  hurt = 1;
  cam.yaw += kind === 'punch' ? 0.2 : 0.1;
  if (kind === 'punch') knockDown(player, npc.group.position);
  if (testView.has('slap')) console.log(`TEST ${kind} landed`);
}
if (testView.has('gun')) gun.equipped = true;
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
  const time = gameTime;

  const input = {
    x: (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + (testView.has('walk') || testView.has('run') ? 1 : 0),
    z: (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0),
    sprint: keys.has('ShiftLeft') || keys.has('ShiftRight') || testView.has('run'),
    jump: keys.has('Space') || testView.has('jump'),
    crouch: keys.has('KeyC') || testView.has('crouch'),
  };

  // Where the crosshair points: the spot the camera is looking at, on the
  // ground if it's looking down, otherwise far off in the distance.
  camera.getWorldDirection(aimDir);
  let reach = 300, hitsGround = false;
  if (aimDir.y < -0.001 && -camera.position.y / aimDir.y < reach) {
    reach = -camera.position.y / aimDir.y;
    hitsGround = true;
  }
  const wall = rayToObstacle(camera.position, aimDir, reach); // bullets stop at walls
  if (wall < reach) {
    reach = wall;
    hitsGround = false;
  }
  const struck = findNpcHit(npcs, camera.position, aimDir, reach);
  if (struck) {
    reach = struck.distance;
    hitsGround = false;
  }
  aimPoint.copy(camera.position).addScaledVector(aimDir, Math.max(reach, cam.distance + 2));

  // Shooting raises the arm first, then fires once it is up.
  aimTimer -= dt;
  if (shotQueued || testView.has('fire')) aimTimer = 0.9;
  input.aim = !driving && !boating && gun.equipped && (aimHeld || aimTimer > 0 || testView.has('aim'));
  input.aimPoint = aimPoint;
  input.kick = gun.kick;
  if ((shotQueued || testView.has('fire')) && player.aim > 0.8 && fireGun(gun, aimPoint, hitsGround)) {
    shotQueued = false;
    if (struck) {
      let killed = hitNpc(struck.npc, player.group.position);
      // ?npc=kill makes the first hit count twice, to check the fall without waiting for a second shot.
      if (testView.get('npc') === 'kill') killed = hitNpc(struck.npc, player.group.position) || killed;
      hitFlash = 0.15;
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
  updateLake(lake, time, dt, boating, { throttle: testView.has('sail') ? 1 : input.z, steer: testView.has('sail') ? 0.25 : -input.x });
  if (boating) {
    // He stands in the boat, which carries him (and the camera) along.
    // He sits on the stern bench with a hand on the tiller.
    const at = boating.group.position;
    player.group.position.set(
      at.x + Math.sin(boating.heading) * SEAT.back,
      at.y + SEAT.height + 0.1 - (HIP_HEIGHT - SIT_DROP),
      at.z + Math.cos(boating.heading) * SEAT.back
    );
    player.group.rotation.set(0, boating.heading, 0);
    sitPlayer(player, dt);
    if (Math.abs(boating.speed) > 1) {
      let turn = boating.heading + Math.PI - cam.yaw;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      cam.yaw += turn * Math.min(1, 2 * dt);
    }
  } else if (driving) {
    updateTruck(truck, { throttle: testView.has('drive') ? 1 : input.z, steer: -input.x, handbrake: input.jump }, dt, MAP_SIZE / 2);
    player.group.position.copy(truck.group.position); // the rest of the world follows the truck
    // The camera swings round to stay behind the truck.
    if (Math.abs(truck.speed) > 1.5) {
      let turn = truck.heading + Math.PI - cam.yaw;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      cam.yaw += turn * Math.min(1, 2.5 * dt);
    }
    // Anyone in the way gets run over.
    if (Math.abs(truck.speed) > 3) {
      for (const npc of npcs) {
        if (npc.state === 'dead') continue;
        const ahead = Math.sign(truck.speed) * 1.6;
        const dx = npc.group.position.x - (truck.group.position.x + Math.sin(truck.heading) * ahead);
        const dz = npc.group.position.z - (truck.group.position.z + Math.cos(truck.heading) * ahead);
        if (Math.hypot(dx, dz) < 1.5) for (let blow = 0; blow < 3; blow++) hitNpc(npc, truck.group.position);
      }
    }
  } else {
    updatePlayer(player, input, cam.yaw, dt, MAP_SIZE / 2);
  }
  speedo.style.display = driving || boating ? 'block' : 'none';
  if (driving || boating) speedo.textContent = `${Math.round(Math.abs((boating || truck).speed) * 2.237)} mph`;
  updateHouse(house, player.group.position, dt);
  updateIguanas(iguanas, player.group.position, dt);
  updateStore(store, player.group.position, dt);
  updateGasStation(gasStation, player.group.position, dt);
  const byTruck = !driving && Math.hypot(player.group.position.x - truck.group.position.x, player.group.position.z - truck.group.position.z) < 3.4;
  const byFridge = !driving && !boating && nearFridge(house, player.group.position);
  const byBoat = !driving && !boating && !!boatNear(lake, player.group.position);
  const canLand = boating && Math.abs(boating.speed) < 2 && !!landingSpot(lake, boating);
  usePrompt.textContent = canLand ? 'Press F to get out' : byBoat ? 'Press F to take the boat out' : byTruck ? 'Press F to drive the truck' : 'Press E to open or close the fridge';
  usePrompt.style.display = (byTruck && !boating) || byFridge || byBoat || canLand ? 'block' : 'none';
  updateGun(gun, player, dt);
  if (driving || boating) gun.mesh.visible = false;
  updateNpcs(npcs, player.group.position, dt, onStrike);
  updateCamera();
  updateGrass(grass, player.group.position, time);

  sun.target.position.copy(player.group.position);
  sun.position.copy(player.group.position).add(SUN_OFFSET);

  sky.position.copy(camera.position); // the sky is always centred on the viewer
  sky.material.uniforms.time.value = time;
  vintage.uniforms.time.value = time;

}

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05); // cap so a paused tab can't cause a huge jump
  // ?ff=20 runs the game 20 times faster, for testing things that take a while.
  const repeats = Number(testView.get('ff')) || 1;
  for (let i = 0; i < repeats; i++) step(repeats > 1 ? 0.05 : dt);
  composer.render();
});
