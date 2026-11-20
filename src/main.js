import * as THREE from 'three';
import { createPlayer, updatePlayer, crouchDrop } from './player.js';

const MAP_SIZE = 600; // metres along each side
const SKY_COLOR = 0x9fd3ff;

// --- Renderer ---------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// --- Scene ------------------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY_COLOR);
scene.fog = new THREE.Fog(SKY_COLOR, 250, 700);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);

// --- Light ------------------------------------------------------------------
scene.add(new THREE.HemisphereLight(0xcfe9ff, 0x4a7a3a, 1.1));

// The sun's shadow area is small and follows the player, so shadows stay sharp.
const SUN_OFFSET = new THREE.Vector3(30, 50, 20);
const sun = new THREE.DirectionalLight(0xfff2d6, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -30;
sun.shadow.camera.right = 30;
sun.shadow.camera.top = 30;
sun.shadow.camera.bottom = -30;
sun.shadow.camera.far = 150;
scene.add(sun, sun.target);

// --- Grass ground -----------------------------------------------------------
// The texture is painted in code so the game needs no downloaded assets.
function makeGrassTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#4f9a3c';
  ctx.fillRect(0, 0, size, size);

  // Thousands of short strokes in mixed greens read as blades of grass.
  const greens = ['#3f8431', '#5aa845', '#68b850', '#47903a', '#79c25c'];
  for (let i = 0; i < 6000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.strokeStyle = greens[(Math.random() * greens.length) | 0];
    ctx.globalAlpha = 0.5 + Math.random() * 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 3, y - 2 - Math.random() * 4);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(MAP_SIZE / 6, MAP_SIZE / 6);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE),
  new THREE.MeshStandardMaterial({ map: makeGrassTexture(), roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

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

// --- Resize + loop ----------------------------------------------------------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05); // cap so a paused tab can't cause a huge jump

  const input = {
    x: (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0),
    z: (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0),
    sprint: keys.has('ShiftLeft') || keys.has('ShiftRight'),
    jump: keys.has('Space'),
    crouch: keys.has('KeyC'),
  };
  updatePlayer(player, input, cam.yaw, dt, MAP_SIZE / 2);
  updateCamera();

  sun.target.position.copy(player.group.position);
  sun.position.copy(player.group.position).add(SUN_OFFSET);

  renderer.render(scene, camera);
});
