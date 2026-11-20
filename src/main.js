import * as THREE from 'three';
import { createPlayer, updatePlayer, crouchDrop, knockDown } from './player.js';
import { PALETTE, createSky, createComposer } from './look.js';
import { createGrass, updateGrass } from './grass.js';
import { addDirt } from './terrain.js';
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

const lookAt = new THREE.Vector3();
function updateCamera() {
  const p = player.group.position;
  const rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw); // camera right

  // Point the camera looks at: the character's upper back, nudged sideways.
  const height = cam.height - crouchDrop(player); // camera dips when crouching
  // Aiming pulls the camera in closer and further over the shoulder.
  const shoulder = cam.shoulder + 0.2 * player.aim;
  const distance = cam.distance * (1 - 0.4 * player.aim);
  lookAt.set(p.x + rx * shoulder, p.y + height, p.z + rz * shoulder);

  const flat = Math.cos(cam.pitch) * distance;
  camera.position.set(
    lookAt.x + Math.sin(cam.yaw) * flat,
    Math.max(0.3, lookAt.y + Math.sin(cam.pitch) * distance), // never below ground
    lookAt.z + Math.cos(cam.yaw) * flat
  );
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
const npcs = createNpcs(scene, MAP_SIZE / 2, testView.has('npc') ? new THREE.Vector3(0.75, 0, -5) : null, testView.has('man') ? 'man' : 'woman');
if (testView.has('npcpace')) npcDebug.pace = Number(testView.get('npcpace')); // hold NPCs in walk (1) or run (2)
let hitFlash = 0; // the crosshair turns red for a moment when a shot hits someone

// Being hit: his head snaps round, the view jolts and the screen edges flash red.
// A punch also knocks him flat on his back.
if (testView.has('stay')) player.freezeDown = Number(testView.get('stay')) || 1; // ?stay=2 freezes a knock-down 2 seconds in, to check the pose
let hurt = 0;
const hurtOverlay = document.getElementById('hurt');
function onStrike(kind, npc) {
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
  const struck = findNpcHit(npcs, camera.position, aimDir, reach);
  if (struck) {
    reach = struck.distance;
    hitsGround = false;
  }
  aimPoint.copy(camera.position).addScaledVector(aimDir, Math.max(reach, cam.distance + 2));

  // Shooting raises the arm first, then fires once it is up.
  aimTimer -= dt;
  if (shotQueued || testView.has('fire')) aimTimer = 0.9;
  input.aim = gun.equipped && (aimHeld || aimTimer > 0 || testView.has('aim'));
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
  crosshair.style.display = gun.equipped ? 'block' : 'none';

  updatePlayer(player, input, cam.yaw, dt, MAP_SIZE / 2);
  updateGun(gun, player, dt);
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
