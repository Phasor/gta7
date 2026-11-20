import * as THREE from 'three';
import { createPlayer, updatePlayer, crouchDrop } from './player.js';
import { PALETTE, createSky, createComposer } from './look.js';
import { createGrass, updateGrass } from './grass.js';
import { addDirt } from './terrain.js';

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

// --- Input ------------------------------------------------------------------
const keys = new Set();
window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'Space') e.preventDefault(); // stop the page scrolling
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

// Third-person camera: sits behind the character, just over the right shoulder.
const cam = { yaw: 0, pitch: 0.18, distance: 3.6, shoulder: 0.55, height: 1.55 };
const MOUSE_SENSITIVITY = 0.0025;

// Click the game to capture the mouse; Esc releases it. Holding a mouse button
// and dragging also works, for browsers that don't allow mouse capture.
const canvas = renderer.domElement;
let dragging = false;
canvas.addEventListener('click', () => {
  if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
});
canvas.addEventListener('mousedown', () => (dragging = true));
window.addEventListener('mouseup', () => (dragging = false));
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
  lookAt.set(p.x + rx * cam.shoulder, p.y + height, p.z + rz * cam.shoulder);

  const flat = Math.cos(cam.pitch) * cam.distance;
  camera.position.set(
    lookAt.x + Math.sin(cam.yaw) * flat,
    Math.max(0.3, lookAt.y + Math.sin(cam.pitch) * cam.distance), // never below ground
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

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05); // cap so a paused tab can't cause a huge jump
  const time = clock.elapsedTime;

  const input = {
    x: (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0),
    z: (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0),
    sprint: keys.has('ShiftLeft') || keys.has('ShiftRight'),
    jump: keys.has('Space'),
    crouch: keys.has('KeyC'),
  };
  updatePlayer(player, input, cam.yaw, dt, MAP_SIZE / 2);
  updateCamera();
  updateGrass(grass, player.group.position, time);

  sun.target.position.copy(player.group.position);
  sun.position.copy(player.group.position).add(SUN_OFFSET);

  sky.position.copy(camera.position); // the sky is always centred on the viewer
  sky.material.uniforms.time.value = time;
  vintage.uniforms.time.value = time;

  composer.render();
});
