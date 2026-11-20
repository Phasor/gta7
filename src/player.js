import * as THREE from 'three';

const WALK_SPEED = 4;
const SPRINT_SPEED = 8.5;
const CROUCH_SPEED = 1.8;
const JUMP_SPEED = 7;
const GRAVITY = 20;
const TURN_RATE = 12;

// Body measurements (metres).
const HIP_Y = 0.8;
const THIGH = 0.4;
const SHIN = 0.4;

// Crouch pose: thighs swing forward, knees bend back, torso leans in.
const CROUCH_THIGH = 1.0;
const CROUCH_KNEE = 1.7;
const CROUCH_LEAN = 0.4;
// How far the hips sink in that pose, so the feet stay on the ground.
const CROUCH_DROP =
  THIGH * (1 - Math.cos(CROUCH_THIGH)) + SHIN * (1 - Math.cos(CROUCH_KNEE - CROUCH_THIGH));

function box(w, h, d, color) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.85 })
  );
  mesh.castShadow = true;
  return mesh;
}

// An arm hangs from a shoulder pivot so it can swing.
function makeArm(parent, x, y, color, handColor) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, 0);
  const sleeve = box(0.14, 0.54, 0.16, color);
  sleeve.position.y = -0.27;
  const hand = box(0.13, 0.12, 0.15, handColor);
  hand.position.y = -0.6;
  pivot.add(sleeve, hand);
  parent.add(pivot);
  return pivot;
}

// A leg has two pivots: the hip and the knee.
function makeLeg(parent, x, color, shoeColor) {
  const hip = new THREE.Group();
  hip.position.set(x, HIP_Y, 0);
  const thigh = box(0.19, THIGH, 0.21, color);
  thigh.position.y = -THIGH / 2;
  hip.add(thigh);

  const knee = new THREE.Group();
  knee.position.y = -THIGH;
  const shin = box(0.18, SHIN - 0.08, 0.2, color);
  shin.position.y = -(SHIN - 0.08) / 2;
  const shoe = box(0.2, 0.1, 0.3, shoeColor);
  shoe.position.set(0, -SHIN + 0.05, 0.04);
  knee.add(shin, shoe);
  hip.add(knee);

  parent.add(hip);
  return { hip, knee };
}

// Low-poly character built from boxes. Faces +Z. About 1.8 m tall.
export function createPlayer() {
  const SKIN = 0xc98f65, JACKET = 0xd9482b, JEANS = 0x2f4a78, SHOES = 0xf2f2f2, HAIR = 0x2a1b12;

  const group = new THREE.Group(); // position on the map (at the feet)
  const body = new THREE.Group();  // sinks when crouching
  group.add(body);

  // Everything above the hips leans forward together when crouching.
  const upper = new THREE.Group();
  upper.position.y = HIP_Y;
  body.add(upper);

  const hips = box(0.48, 0.16, 0.27, JEANS);
  hips.position.y = 0.04;
  const torso = box(0.52, 0.62, 0.28, JACKET);
  torso.position.y = 0.37;
  const neck = box(0.14, 0.08, 0.14, SKIN);
  neck.position.y = 0.72;
  const head = box(0.26, 0.28, 0.27, SKIN);
  head.position.y = 0.89;
  const hair = box(0.28, 0.1, 0.29, HAIR);
  hair.position.set(0, 1.02, -0.01);
  upper.add(hips, torso, neck, head, hair);

  const armL = makeArm(upper, -0.34, 0.65, JACKET, SKIN);
  const armR = makeArm(upper, 0.34, 0.65, JACKET, SKIN);
  const legL = makeLeg(body, -0.13, JEANS, SHOES);
  const legR = makeLeg(body, 0.13, JEANS, SHOES);

  return {
    group, body, upper,
    limbs: { legL, legR, armL, armR },
    velocityY: 0,
    onGround: true,
    stride: 0,   // walk-cycle phase
    motion: 0,   // 0 = standing, 1 = moving (blended for smooth start/stop)
    crouch: 0,   // 0 = standing, 1 = fully crouched (blended)
  };
}

// input: { x, z, sprint, jump, crouch } where x/z are -1..1 relative to the camera.
// cameraYaw: the direction the camera faces, so "forward" means away from it.
export function updatePlayer(player, input, cameraYaw, dt, halfMap) {
  const { group, body, upper, limbs } = player;

  const crouching = input.crouch && player.onGround;
  const sprinting = input.sprint && !crouching;
  const speed = crouching ? CROUCH_SPEED : sprinting ? SPRINT_SPEED : WALK_SPEED;

  const fx = -Math.sin(cameraYaw), fz = -Math.cos(cameraYaw); // camera forward
  const rx = Math.cos(cameraYaw), rz = -Math.sin(cameraYaw);  // camera right

  let dx = fx * input.z + rx * input.x;
  let dz = fz * input.z + rz * input.x;
  const len = Math.hypot(dx, dz);
  const moving = len > 0.001;

  if (moving) {
    dx /= len; dz /= len;
    group.position.x += dx * speed * dt;
    group.position.z += dz * speed * dt;

    // Turn to face the way we're walking, taking the short way round.
    const target = Math.atan2(dx, dz);
    let diff = target - group.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    group.rotation.y += diff * Math.min(1, TURN_RATE * dt);
  }

  // Stay on the map.
  const limit = halfMap - 1;
  group.position.x = THREE.MathUtils.clamp(group.position.x, -limit, limit);
  group.position.z = THREE.MathUtils.clamp(group.position.z, -limit, limit);

  // Jump + gravity. Jumping from a crouch stands the character up.
  if (input.jump && player.onGround) {
    player.velocityY = JUMP_SPEED;
    player.onGround = false;
  }
  if (!player.onGround) {
    player.velocityY -= GRAVITY * dt;
    group.position.y += player.velocityY * dt;
    if (group.position.y <= 0) {
      group.position.y = 0;
      player.velocityY = 0;
      player.onGround = true;
    }
  }

  // Blend smoothly into and out of the crouch and walk poses.
  player.crouch += ((crouching ? 1 : 0) - player.crouch) * Math.min(1, 12 * dt);
  player.motion += ((moving ? 1 : 0) - player.motion) * Math.min(1, 10 * dt);
  if (moving) player.stride += speed * dt * (crouching ? 3.2 : 2.3);

  const c = player.crouch;
  body.position.y = -CROUCH_DROP * c;
  upper.rotation.x = CROUCH_LEAN * c;

  // Walk animation: arms and legs swing in opposite pairs, knees bend on the back-swing.
  const amount = (sprinting ? 0.95 : crouching ? 0.35 : 0.6) * player.motion;
  const s = Math.sin(player.stride);
  const swing = s * amount;
  limbs.legL.hip.rotation.x = swing - CROUCH_THIGH * c;
  limbs.legR.hip.rotation.x = -swing - CROUCH_THIGH * c;
  limbs.legL.knee.rotation.x = Math.max(0, s) * amount * 0.9 + CROUCH_KNEE * c;
  limbs.legR.knee.rotation.x = Math.max(0, -s) * amount * 0.9 + CROUCH_KNEE * c;
  limbs.armL.rotation.x = -swing * 0.8 - CROUCH_LEAN * c;
  limbs.armR.rotation.x = swing * 0.8 - CROUCH_LEAN * c;
}

// How much lower the character's head is right now (used by the camera).
export function crouchDrop(player) {
  return CROUCH_DROP * 1.3 * player.crouch;
}
