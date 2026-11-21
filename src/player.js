import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { pushOut, floorAt, waterDepthAt } from './world.js';

const WALK_SPEED = 2.4;
const SPRINT_SPEED = 6.5;
const CROUCH_SPEED = 1.3;
const JUMP_SPEED = 6.5;
const GRAVITY = 20;
const TURN_RATE = 12;
const JUMP_WINDUP = 0.11; // seconds of knee-dip before leaving the ground

// How fast the model's feet travel in its walk and run animations (metres per
// second). Playing an animation faster or slower to match the real speed keeps
// the feet from sliding over the ground.
const WALK_ANIM_SPEED = 1.9;
const RUN_ANIM_SPEED = 4.6;

// Crouch pose, added on top of whatever animation is playing.
const CROUCH = { thigh: 0.85, knee: 1.5, spine: 0.4 };
const scratch = new THREE.Vector3();

// The character is a ready-made 3D human model (public/models/human.glb). It has
// no animations of its own, so it borrows the idle, walk and run animations from
// a second model (public/models/soldier.glb) that has the same skeleton.
const MODEL_URL = `${import.meta.env.BASE_URL}models/human.glb`;
const ANIMATIONS_URL = `${import.meta.env.BASE_URL}models/soldier.glb`;

// The angle every bone is at right now, as seen from outside the model. Taken
// while a model stands in its resting pose (arms out to the sides), this is the
// common starting point for copying movement from one skeleton to another.
function restingRotations(root) {
  root.updateWorldMatrix(true, true);
  const rest = new Map();
  root.traverse((bone) => {
    if (bone.isBone) rest.set(bone, bone.getWorldQuaternion(new THREE.Quaternion()));
  });
  return rest;
}
// Convert the soldier's animations so they drive the human's skeleton.
//
// The two skeletons have the same bones (the soldier's are prefixed "mixamorig")
// but each bone is set up at a different angle, so the numbers can't be copied
// across. Instead we pose the soldier at each moment of an animation, work out
// how far every bone has turned from its resting position, and turn the human's
// matching bone by the same amount.
// prefix: text in front of every bone name in model (some models have one).
export function borrowAnimations(soldier, model, names, prefix = '') {
  const source = soldier.scene;
  source.rotation.y = Math.PI; // the soldier is built facing backwards; face him the same way as the human
  model.updateWorldMatrix(true, true);

  // Stand the soldier in his "T-pose" (arms out, the same resting pose the human
  // model is built in) so the two skeletons start from a matching position.
  const mixer = new THREE.AnimationMixer(source);
  const tPose = mixer.clipAction(THREE.AnimationClip.findByName(soldier.animations, 'TPose'));
  tPose.play();
  mixer.update(0);
  source.updateWorldMatrix(true, true);

  const Q = THREE.Quaternion;
  const pairs = [], byBone = new Map();
  const restOfSoldier = restingRotations(source), restOfHuman = restingRotations(model);
  if (!restOfSoldier.size || !restOfHuman.size) console.warn('No skeleton found on a character model');

  // The soldier is built with arms straight out to the sides; the human with
  // arms angled down. Work out the turn that would raise the human's arms level
  // and straighten the elbows, so both skeletons start from the same pose.
  // Without this every arm movement lands about 60 degrees too low.
  const at = (bone) => bone.getWorldPosition(new THREE.Vector3());
  for (const [hand, sign] of [['Left', 1], ['Right', -1]]) {
    const arm = model.getObjectByName(`${prefix}${hand}Arm`);
    const foreArm = model.getObjectByName(`${prefix}${hand}ForeArm`);
    const wrist = model.getObjectByName(`${prefix}${hand}Hand`);
    if (!arm || !foreArm || !wrist) continue;
    const level = new THREE.Vector3(sign, 0, 0);
    const raise = new Q().setFromUnitVectors(at(foreArm).sub(at(arm)).normalize(), level);
    const lower = at(wrist).sub(at(foreArm)).normalize().applyQuaternion(raise);
    const straighten = new Q().setFromUnitVectors(lower, level).multiply(raise);
    if (restOfHuman.has(arm)) restOfHuman.get(arm).premultiply(raise);
    foreArm.traverse((part) => { if (restOfHuman.has(part)) restOfHuman.get(part).premultiply(straighten); });
  }
  model.traverse((bone) => { // parents are visited before their children
    if (!bone.isBone) return;
    const from = source.getObjectByName(`mixamorig${bone.name.slice(prefix.length)}`);
    if (!from || !restOfSoldier.has(from) || !restOfHuman.has(bone)) return;
    const pair = {
      to: bone, from,
      restFrom: restOfSoldier.get(from).clone().invert(),
      restTo: restOfHuman.get(bone),
      world: new Q(), values: [],
    };
    pairs.push(pair);
    byBone.set(bone, pair);
  });

  const hips = byBone.get(model.getObjectByName(`${prefix}Hips`));
  const hipsParentRotation = hips.to.parent.getWorldQuaternion(new Q());
  const sizeRatio = hips.to.getWorldPosition(new THREE.Vector3()).y / hips.from.getWorldPosition(new THREE.Vector3()).y;

  tPose.stop();
  const turn = new Q(), local = new Q(), parentWorld = new Q(), spot = new THREE.Vector3();
  const FPS = 30;

  return names.map((name) => {
    const clip = THREE.AnimationClip.findByName(soldier.animations, name);
    const action = mixer.clipAction(clip);
    action.play();

    const times = [], hipSpots = [];
    for (const pair of pairs) pair.values = [];
    const frames = Math.ceil(clip.duration * FPS);
    for (let i = 0; i <= frames; i++) {
      const time = Math.min(clip.duration, i / FPS);
      times.push(time);
      action.time = time === clip.duration ? 0 : time; // the last frame matches the first, for a seamless loop
      mixer.update(0);
      source.updateWorldMatrix(true, true);

      for (const pair of pairs) {
        // How far the soldier's bone has turned from rest, applied to the human's bone.
        turn.copy(pair.from.getWorldQuaternion(local)).multiply(pair.restFrom);
        pair.world.copy(turn).multiply(pair.restTo);
        // Bones store their angle relative to their parent bone.
        const parent = byBone.get(pair.to.parent);
        parentWorld.copy(parent ? parent.world : hipsParentRotation).invert();
        local.copy(parentWorld).multiply(pair.world);
        // Keep each frame on the same "side" as the last so blending takes the short way round.
        const v = pair.values, n = v.length;
        const flip = n && v[n - 4] * local.x + v[n - 3] * local.y + v[n - 2] * local.z + v[n - 1] * local.w < 0 ? -1 : 1;
        v.push(local.x * flip, local.y * flip, local.z * flip, local.w * flip);
      }
      hips.to.parent.worldToLocal(hips.from.getWorldPosition(spot).multiplyScalar(sizeRatio));
      hipSpots.push(spot.x, spot.y, spot.z);
    }
    action.stop();

    const tracks = pairs.map((pair) => new THREE.QuaternionKeyframeTrack(`${pair.to.name}.quaternion`, times, pair.values));
    tracks.push(new THREE.VectorKeyframeTrack(`${prefix}Hips.position`, times, hipSpots));
    return new THREE.AnimationClip(name, clip.duration, tracks);
  });
}
// A relaxed standing pose made in code: arms hanging at his sides, hands loose,
// with slow breathing. (The soldier's own idle is a combat stance with the
// hands held up for a rifle, which looks wrong on a civilian.)
export function makeIdle(model, prefix = '') {
  model.updateWorldMatrix(true, true);
  const bones = [];
  model.traverse((part) => { if (part.isBone) bones.push(part); });
  const rest = bones.map((bone) => bone.quaternion.clone());
  const forward = new THREE.Vector3(0, 0, 1), side = new THREE.Vector3(1, 0, 0);
  const turn = (name, axis, angle) => {
    const bone = model.getObjectByName(prefix + name);
    if (bone) turnBone(bone, axis, angle);
  };

  // Models are built with their arms held out from the body. Swing each arm
  // down until it hangs naturally at the side.
  for (const [hand, sign] of [['Left', 1], ['Right', -1]]) {
    const arm = model.getObjectByName(`${prefix}${hand}Arm`);
    const foreArm = model.getObjectByName(`${prefix}${hand}ForeArm`);
    if (!arm || !foreArm) continue;
    const now = foreArm.getWorldPosition(new THREE.Vector3()).sub(arm.getWorldPosition(new THREE.Vector3())).normalize();
    const hanging = new THREE.Vector3(sign * 0.25, -0.97, 0).normalize();
    turnBoneBy(arm, new THREE.Quaternion().setFromUnitVectors(now, hanging));
  }
  const relaxed = bones.map((bone) => bone.quaternion.clone());

  turn('Spine1', side, -0.02); // chest rises as he breathes in
  turn('LeftShoulder', forward, 0.02);
  turn('RightShoulder', forward, -0.02);
  const breathIn = bones.map((bone) => bone.quaternion.clone());

  bones.forEach((bone, i) => bone.quaternion.copy(rest[i]));

  const times = [0, 2, 4];
  const tracks = bones.map((bone, i) => new THREE.QuaternionKeyframeTrack(
    `${bone.name}.quaternion`, times,
    [...relaxed[i].toArray(), ...breathIn[i].toArray(), ...relaxed[i].toArray()]
  ));
  const hips = model.getObjectByName(`${prefix}Hips`).position;
  tracks.push(new THREE.VectorKeyframeTrack(`${prefix}Hips.position`, times, [...hips.toArray(), ...hips.toArray(), ...hips.toArray()]));
  return new THREE.AnimationClip('Idle', 4, tracks);
}

// The main character. `group` is his position on the map (at his feet).
// The model loads in the background and appears a moment after the game starts.
export function createPlayer() {
  const group = new THREE.Group();
  group.rotation.order = 'YXZ'; // turn to face a direction first, then tip over (for being knocked down)
  group.rotation.y = Math.PI; // start facing away from the camera

  const player = {
    group,
    velocityY: 0,
    onGround: true,
    motion: 0,   // 0 = standing, 1 = walking, 2 = running (blended)
    crouch: 0,   // 0 = standing, 1 = fully crouched (blended)
    aim: 0,      // 0 = arm relaxed, 1 = arm raised and aiming (blended)
    slap: 0,     // 1 right after being slapped, fading to 0
    windUp: 0,   // seconds left of the dip before a jump leaves the ground
    land: 0,     // 1 right after a hard landing, fading to 0 (knees absorb it)
    air: 0,      // 0 = on the ground, 1 = in the air (blended)
    downTime: -1, // seconds since being knocked down, or -1 when on his feet
    down: 0,     // 0 = upright, 1 = flat on his back
    mixer: null, actions: null, bones: null, ankleHeight: 0,
    cleanPose: [], cleanHips: new THREE.Vector3(), // the animated pose before crouch adjustments
  };

  const loader = new GLTFLoader();
  Promise.all([loader.loadAsync(MODEL_URL), loader.loadAsync(ANIMATIONS_URL)]).then(([human, soldier]) => {
    const model = human.scene;
    model.traverse((part) => {
      if (part.isMesh) {
        part.castShadow = true;
        part.frustumCulled = false; // animated meshes can be wrongly hidden otherwise
      }
    });
    const clips = [makeIdle(model), ...borrowAnimations(soldier, model, ['Walk', 'Run'])];
    group.add(model);

    const bone = (name) => model.getObjectByName(name);
    player.bones = {
      hips: bone('Hips'), spine: bone('Spine'),
      thighL: bone('LeftUpLeg'), thighR: bone('RightUpLeg'),
      shinL: bone('LeftLeg'), shinR: bone('RightLeg'),
      footL: bone('LeftFoot'), footR: bone('RightFoot'),
      armR: bone('RightArm'), foreArmR: bone('RightForeArm'), handR: bone('RightHand'),
      armL: bone('LeftArm'), foreArmL: bone('LeftForeArm'), handL: bone('LeftHand'), spine1: bone('Spine1'), spine2: bone('Spine2'),
      head: bone('Head'),
    };

    player.mixer = new THREE.AnimationMixer(model);
    player.actions = {};
    for (const clip of clips) {
      const name = clip.name;
      const action = player.mixer.clipAction(clip);
      action.play();
      action.setEffectiveWeight(name === 'Idle' ? 1 : 0);
      player.actions[name] = action;
    }

    // Measure how high the ankles sit above the ground when standing.
    player.mixer.update(0);
    const b = player.bones;
    // Finger bones, for making fists: four fingers of three joints on each hand.
    const fingersOf = (hand) => ['Index', 'Middle', 'Ring', 'Pinky'].map((finger) => [1, 2, 3].map((joint) => bone(`${hand}Hand${finger}${joint}`)).filter(Boolean));
    player.fingersL = fingersOf('Left');
    player.fingersR = fingersOf('Right');
    player.cleanPose = [...player.fingersL.flat(), ...player.fingersR.flat(), b.spine, b.thighL, b.thighR, b.shinL, b.shinR, b.footL, b.footR, b.armR, b.foreArmR, b.head, b.armL, b.foreArmL, b.spine1, b.spine2]
      .map((part) => ({ bone: part, rotation: part.quaternion.clone() }));
    player.cleanHips.copy(b.hips.position);
    group.updateWorldMatrix(true, true);
    player.ankleHeight = Math.min(
      player.bones.footL.getWorldPosition(scratch).y,
      player.bones.footR.getWorldPosition(scratch).y
    ) - group.position.y;
  });

  return player;
}

const sideways = new THREE.Vector3(), forwards = new THREE.Vector3();
const parentTurn = new THREE.Quaternion(), worldTurn = new THREE.Quaternion();

// Turn a bone by `angle` around an axis given in world space.
function turnBone(bone, axis, angle) {
  turnBoneBy(bone, worldTurn.setFromAxisAngle(axis, angle));
}

// Turn a bone by a rotation given in world space. (Changes `turn`.)
export function turnBoneBy(bone, turn) {
  bone.parent.getWorldQuaternion(parentTurn);
  // Convert the world-space turn into the bone's parent's space, then apply it.
  turn.premultiply(parentTurn.clone().invert()).multiply(parentTurn);
  bone.quaternion.premultiply(turn);
}

const NO_TURN = new THREE.Quaternion();
const fistTarget = new THREE.Vector3();
const FIST_CURL = 1.25 * (Number(new URLSearchParams(location.search).get('curl')) || 1); // how far each finger joint bends in a fist

// Swing a limb section (from `bone` to `child`) toward a direction, by `weight` (0 = leave it, 1 = all the way).
function pointLimb(bone, child, direction, weight) {
  bone.getWorldPosition(shoulderSpot);
  child.getWorldPosition(jointSpot);
  limbDirection.copy(jointSpot).sub(shoulderSpot).normalize();
  aimTurn.setFromUnitVectors(limbDirection, direction);
  turnBoneBy(bone, aimTurn.slerpQuaternions(NO_TURN, aimTurn.clone(), weight));
}
const aimTurn = new THREE.Quaternion();
const shoulderSpot = new THREE.Vector3(), jointSpot = new THREE.Vector3();
const limbDirection = new THREE.Vector3(), aimDirection = new THREE.Vector3();

// input: { x, z, sprint, jump, crouch, aim, aimPoint, kick } where x/z are -1..1 relative to the camera.
// cameraYaw: the direction the camera faces, so "forward" means away from it.
export function updatePlayer(player, input, cameraYaw, dt, halfMap) {
  const { group } = player;

  // Knocked down: he falls flat on his back and lies sprawled, then sits up,
  // pushes off his hands, rolls forward into a squat and stands. No control meanwhile.
  let sprawl = 0, sit = 0, armsBack = 0, squat = 0, dip = 0;
  if (player.downTime >= 0) {
    player.downTime += dt;
    if (player.freezeDown !== undefined) player.downTime = Math.min(player.downTime, player.freezeDown); // test switch
    const step = THREE.MathUtils.smoothstep;
    const falling = Math.min(1, player.downTime / KNOCK.fall) ** 2;
    const up = player.downTime - KNOCK.fall - KNOCK.lie * (player.lieScale ?? 1); // lieScale: tougher people get up sooner
    void 0; // seconds into getting up
    player.down = up < 0 ? falling : 1 - step(up, 0.45, 0.95);
    sprawl = up < 0 ? falling : 1 - step(up, 0, 0.3);
    sit = step(up, 0, 0.5) * (1 - step(up, 0.5, 0.95));
    armsBack = step(up, 0.05, 0.4) * (1 - step(up, 0.55, 0.9));
    squat = step(up, 0.25, 0.9) * (1 - step(up, 1.0, KNOCK.rise));
    if (up >= KNOCK.rise) player.downTime = -1;
    input = { ...input, x: 0, z: 0, sprint: false, jump: false, crouch: false, aim: false };
  } else {
    player.down = input.lie ? 1 : 0; // lying on a gym bench
  }
  group.rotation.x = -Math.PI / 2 * player.down;
  if (group.children[0]) group.children[0].position.z = 0.12 * player.down; // rest on the ground, not in it
  const crouching = input.crouch && player.onGround;
  const sprinting = input.sprint && !crouching;
  // In the lake: wading slows him down, and once it is deep enough he swims.
  const depth = waterDepthAt(group.position);
  player.swim = (player.swim || 0) + ((depth > 0.95 ? 1 : 0) - (player.swim || 0)) * Math.min(1, 4 * dt);
  const swimming = player.swim > 0.5;
  const speed = swimming ? (input.sprint ? 3.2 : 2.0) : depth > 0.3 ? 2.0 : crouching ? CROUCH_SPEED : sprinting ? SPRINT_SPEED : WALK_SPEED;

  const fx = -Math.sin(cameraYaw), fz = -Math.cos(cameraYaw); // camera forward
  const rx = Math.cos(cameraYaw), rz = -Math.sin(cameraYaw);  // camera right

  let dx = fx * input.z + rx * input.x;
  let dz = fz * input.z + rz * input.x;
  const len = Math.hypot(dx, dz);
  const moving = len > 0.001;

  if (moving) {
    dx /= len; dz /= len;
    group.position.x += dx * speed * (player.boost || 1) * dt; // boost: a burst of energy after a snack
    group.position.z += dz * speed * (player.boost || 1) * dt;
  }

  // Turn to face the way we're walking (or, when aiming, the way the camera
  // looks), taking the short way round.
  // Aiming a gun always faces where the camera looks. Otherwise he turns to face the way he
  // walks or punches, unless his facing is locked (so you can watch him from the front).
  const squareUp = input.aim || (input.punch > 0 && !input.lockFacing);
  if (input.aim || ((moving || squareUp) && !input.lockFacing)) {
    const target = squareUp ? Math.atan2(fx, fz) : Math.atan2(dx, dz);
    let diff = target - group.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    group.rotation.y += diff * Math.min(1, TURN_RATE * dt);
  }

  // Stay on the map.
  const limit = halfMap - 1;
  group.position.x = THREE.MathUtils.clamp(group.position.x, -limit, limit);
  group.position.z = THREE.MathUtils.clamp(group.position.z, -limit, limit);
  pushOut(group.position, 0.35, true); // can't walk through walls (but can go in the lake)

  // Jump: a quick dip of the knees to push off, then up. On the way down the
  // knees bend again to absorb the landing.
  if (input.jump && player.onGround && player.windUp <= 0 && !swimming) player.windUp = JUMP_WINDUP;
  if (player.windUp > 0) {
    player.windUp -= dt;
    dip = 0.55 * Math.sin(Math.PI * Math.min(1, 1 - player.windUp / JUMP_WINDUP) * 0.6);
    if (player.windUp <= 0) {
      player.velocityY = JUMP_SPEED;
      player.onGround = false;
    }
  }
  // Swimming: he leans forward into a crawl when moving and treads water upright when still.
  player.swimTilt = (player.swimTilt || 0) + (player.swim * (moving ? 1 : 0.15) - (player.swimTilt || 0)) * Math.min(1, 3 * dt);
  group.rotation.x += 1.15 * player.swimTilt;
  // The ground, a raised floor such as inside the house, or the lake bed (he floats in deep water).
  const floor = depth > 0 ? -Math.min(depth, 1.25) + player.swimTilt : floorAt(group.position);
  if (player.onGround) {
    group.position.y += (floor - group.position.y) * Math.min(1, 18 * dt); // step up or down
  } else {
    player.velocityY -= GRAVITY * dt;
    group.position.y += player.velocityY * dt;
    if (group.position.y <= floor) {
      player.land = Math.min(1, -player.velocityY / JUMP_SPEED);
      group.position.y = floor;
      player.velocityY = 0;
      player.onGround = true;
    }
  }
  player.land = Math.max(0, player.land - dt * 3);
  player.air += ((player.onGround ? 0 : 1) - player.air) * Math.min(1, 14 * dt);

  // Blend smoothly between standing, walking, running and crouching.
  const targetMotion = !moving ? 0 : sprinting ? 2 : 1;
  player.motion += (targetMotion - player.motion) * Math.min(1, 8 * dt);
  player.crouch += ((crouching ? 1 : 0) - player.crouch) * Math.min(1, 12 * dt);

  if (!player.mixer) return; // model still loading

  const m = player.motion;
  const { Idle, Walk, Run } = player.actions;
  Idle.setEffectiveWeight(Math.max(0, 1 - m));
  Walk.setEffectiveWeight(m <= 1 ? m : 2 - m);
  Run.setEffectiveWeight(Math.max(0, m - 1));
  Walk.setEffectiveTimeScale(speed / WALK_ANIM_SPEED < 0.4 ? 0.4 : Math.min(1.6, speed / WALK_ANIM_SPEED));
  Run.setEffectiveTimeScale(SPRINT_SPEED / RUN_ANIM_SPEED);
  // Put back the bones the crouch moved last frame. The animation system only
  // rewrites a bone when its animated value changes, so without this the crouch
  // adjustments would pile up frame after frame.
  const b = player.bones;
  for (const { bone, rotation } of player.cleanPose) bone.quaternion.copy(rotation);
  b.hips.position.copy(player.cleanHips);

  player.mixer.update(dt);

  for (const entry of player.cleanPose) entry.rotation.copy(entry.bone.quaternion);
  player.cleanHips.copy(b.hips.position);

  // Crouch: bend the legs and lean forward on top of the animation. The same
  // pose is used for the dip before a jump, absorbing a landing, and the squat
  // he passes through when getting up off the floor.
  const c = Math.max(player.crouch, squat, dip, 0.6 * player.land * player.land);
  if (c > 0.001) {
    // Bones in this model each point their own way, so turn them about the
    // character's sideways axis as seen from outside, not about their own axes.
    sideways.set(1, 0, 0).applyQuaternion(group.quaternion);
    turnBone(b.spine, sideways, CROUCH.spine * c);
    for (const [thigh, shin, foot] of [[b.thighL, b.shinL, b.footL], [b.thighR, b.shinR, b.footR]]) {
      turnBone(thigh, sideways, -CROUCH.thigh * c);
      turnBone(shin, sideways, CROUCH.knee * c);
      turnBone(foot, sideways, -(CROUCH.knee - CROUCH.thigh) * c); // keep the feet flat
    }
    // Bending the legs lifts the feet off the ground, so lower the hips by
    // exactly as much as it takes to put the lowest foot back down.
    b.hips.updateWorldMatrix(true, true);
    const lowestFoot = Math.min(b.footL.getWorldPosition(scratch).y, b.footR.getWorldPosition(scratch).y);
    const lift = (lowestFoot - group.position.y - player.ankleHeight) * (1 - player.down) ** 2; // not while lying down
    const parent = b.hips.parent;
    const from = parent.worldToLocal(b.hips.getWorldPosition(scratch).clone());
    const to = parent.worldToLocal(b.hips.getWorldPosition(scratch).clone().setY(scratch.y - lift));
    b.hips.position.add(to.sub(from));
  }

  // In the air: his arms swing up for lift as he leaves the ground, his knees
  // tuck up at the top of the jump, then his legs reach down and his arms spread
  // for balance as he comes in to land.
  if (player.air > 0.01) {
    const phase = THREE.MathUtils.clamp((1 - player.velocityY / JUMP_SPEED) / 2, 0, 1); // 0 taking off, 1 landing
    const tuck = player.air * Math.sin(Math.PI * phase);
    const lift = player.air * (1 - phase), spread = player.air * phase;
    sideways.set(1, 0, 0).applyQuaternion(group.quaternion);
    forwards.set(0, 0, 1).applyQuaternion(group.quaternion);
    turnBone(b.spine, sideways, 0.15 * tuck);
    turnBone(b.thighL, sideways, -0.95 * tuck);
    turnBone(b.shinL, sideways, 1.35 * tuck);
    turnBone(b.thighR, sideways, -0.45 * tuck);
    turnBone(b.shinR, sideways, 0.9 * tuck);
    turnBone(b.armL, sideways, -1.1 * lift);
    turnBone(b.armR, sideways, -1.1 * lift);
    turnBone(b.armL, forwards, 0.55 * spread);
    turnBone(b.armR, forwards, -0.55 * spread);
  }

  // Swimming strokes: arms reach forward and pull back in turn.
  if (player.swim > 0.01) {
    player.swimTime = (player.swimTime || 0) + dt * (moving ? 5 : 2);
    sideways.set(1, 0, 0).applyQuaternion(group.quaternion);
    const reach = player.swim * (0.5 + 2.0 * player.swimTilt);
    turnBone(b.armL, sideways, -reach + Math.sin(player.swimTime) * 0.8 * player.swim);
    turnBone(b.armR, sideways, -reach - Math.sin(player.swimTime) * 0.8 * player.swim);
  }

  // On the floor and getting up.
  if (sprawl > 0.001 || sit > 0.001 || armsBack > 0.001) {
    sideways.set(1, 0, 0).applyQuaternion(group.quaternion);
    forwards.set(0, 0, 1).applyQuaternion(group.quaternion);
    // Sprawled on his back: arms flung out, one knee up.
    turnBone(b.armL, forwards, 0.9 * sprawl);
    turnBone(b.armR, forwards, -0.65 * sprawl);
    turnBone(b.thighR, sideways, -0.5 * sprawl);
    turnBone(b.shinR, sideways, 0.9 * sprawl);
    // Sitting up: his back curls forward, a little at each joint of the spine...
    for (const part of [b.spine, b.spine1, b.spine2]) turnBone(part, sideways, 0.42 * sit);
    // ...while his arms reach back to push off the ground.
    turnBone(b.armL, sideways, 0.9 * armsBack);
    turnBone(b.armR, sideways, 0.9 * armsBack);
  }

  // Aim: straighten the right arm and point it at what the camera is looking at.
  player.aim += ((input.aim ? 1 : 0) - player.aim) * Math.min(1, 14 * dt);
  if (player.aim > 0.001 && input.aimPoint) {
    b.armR.getWorldPosition(shoulderSpot);
    aimDirection.copy(input.aimPoint).sub(shoulderSpot).normalize();
    aimDirection.y += (input.kick || 0) * 0.16; // recoil kicks the arm up
    aimDirection.normalize();
    for (const [upper, lower] of [[b.armR, b.foreArmR], [b.foreArmR, b.handR]]) {
      upper.getWorldPosition(shoulderSpot);
      lower.getWorldPosition(jointSpot);
      limbDirection.copy(jointSpot).sub(shoulderSpot).normalize();
      aimTurn.setFromUnitVectors(limbDirection, aimDirection);
      turnBoneBy(upper, aimTurn.slerpQuaternions(NO_TURN, aimTurn.clone(), player.aim));
    }
  }

  // Fighting. He brings both fists up into a boxer's guard, then throws either a
  // quick left jab or a hard right punch that he twists his whole body into.
  // input.fight = { guard, left, right }, each from 0 to 1.
  if (input.fight) {
    const { guard, left, right } = input.fight;
    turnBone(b.spine, forwards.set(0, 1, 0), 0.55 * right - 0.2 * left); // shoulders turn into the punch
    sideways.set(1, 0, 0).applyQuaternion(group.quaternion);
    turnBone(b.spine, sideways, 0.1 * guard + 0.12 * right);             // hunched forward a little
    for (const [upper, fore, hand, side, hit, fingers] of [
      [b.armL, b.foreArmL, b.handL, 1, left, player.fingersL], [b.armR, b.foreArmR, b.handR, -1, right, player.fingersR]]) {
      // Guard: elbow down by the ribs, fist up by the chin. Punch: the whole arm straight out in front.
      aimDirection.set(side * 0.3, -0.8, 0.5).lerp(fistTarget.set(-side * 0.12, 0.12, 1), hit).normalize().applyQuaternion(group.quaternion);
      pointLimb(upper, fore, aimDirection, guard);
      aimDirection.set(-side * 0.38, 0.8, 0.45).lerp(fistTarget.set(-side * 0.12, 0.12, 1), hit).normalize().applyQuaternion(group.quaternion);
      pointLimb(fore, hand, aimDirection, guard);
      // Make a fist: every finger joint curls round the line of the knuckles.
      fingers[0][0].getWorldPosition(shoulderSpot);
      fingers[3][0].getWorldPosition(jointSpot);
      limbDirection.copy(jointSpot).sub(shoulderSpot).normalize();
      for (const finger of fingers) for (const joint of finger) turnBone(joint, limbDirection, side * FIST_CURL * guard);
    }
  }
  // Smoking: his left hand lifts the cigarette to his mouth for a drag, then drops again.
  player.smokeLift = (player.smokeLift || 0) + ((input.smoke ? 1 : 0) - (player.smokeLift || 0)) * Math.min(1, 5 * dt);
  if (player.smokeLift > 0.01) {
    const s = player.smokeLift;
    // Point the upper arm forward and a little down, then fold the forearm so the
    // hand ends up just in front of his mouth.
    b.armL.getWorldPosition(shoulderSpot);
    b.foreArmL.getWorldPosition(jointSpot);
    limbDirection.copy(jointSpot).sub(shoulderSpot).normalize();
    const inward = Math.sign(group.worldToLocal(shoulderSpot.clone()).x) * -1; // toward the middle of his body
    aimDirection.set(0.05 * inward, -0.45, 0.9).normalize().applyQuaternion(group.quaternion);
    aimTurn.setFromUnitVectors(limbDirection, aimDirection);
    turnBoneBy(b.armL, aimTurn.slerpQuaternions(NO_TURN, aimTurn.clone(), s));

    b.foreArmL.getWorldPosition(shoulderSpot);  // the elbow, now it has moved
    b.handL.getWorldPosition(jointSpot);
    limbDirection.copy(jointSpot).sub(shoulderSpot).normalize();
    b.head.getWorldPosition(aimDirection);       // his mouth: a little above and in front of the base of the head
    aimDirection.y -= 0.05;
    aimDirection.add(forwards.set(0, 0, 0.14).applyQuaternion(group.quaternion)).sub(shoulderSpot).normalize();
    aimTurn.setFromUnitVectors(limbDirection, aimDirection);
    turnBoneBy(b.foreArmL, aimTurn.slerpQuaternions(NO_TURN, aimTurn.clone(), s));
  }

  // Slapped: his head snaps round to the side, then eases back.
  if (player.slap > 0) {
    player.slap = Math.max(0, player.slap - dt * 2.2);
    turnBone(b.head, sideways.set(0, 1, 0), 0.9 * player.slap * player.slap);
  }
}

// Sitting down (in a boat): thighs forward, shins down, one hand back on the
// tiller. Call this each frame instead of updatePlayer while he is seated.
export function sitPlayer(player, dt) {
  if (!player.mixer) return;
  const b = player.bones;
  for (const { bone, rotation } of player.cleanPose) bone.quaternion.copy(rotation);
  b.hips.position.copy(player.cleanHips);
  player.actions.Idle.setEffectiveWeight(1);
  player.actions.Walk.setEffectiveWeight(0);
  player.actions.Run.setEffectiveWeight(0);
  player.motion = 0;
  player.mixer.update(dt);
  for (const entry of player.cleanPose) entry.rotation.copy(entry.bone.quaternion);
  player.cleanHips.copy(b.hips.position);

  sideways.set(1, 0, 0).applyQuaternion(player.group.quaternion);
  forwards.set(0, 0, 1).applyQuaternion(player.group.quaternion);
  for (const [thigh, shin] of [[b.thighL, b.shinL], [b.thighR, b.shinR]]) {
    turnBone(thigh, sideways, -1.42);
    turnBone(shin, sideways, 1.5);
  }
  turnBone(b.thighL, forwards, -0.12);  // knees a little apart
  turnBone(b.thighR, forwards, 0.12);
  turnBone(b.spine, sideways, 0.12);    // leaning forward slightly
  turnBone(b.armL, sideways, -0.55);    // left hand resting on his knee
  turnBone(b.armR, sideways, 0.75);     // right hand back on the tiller
  turnBone(b.armR, forwards, 0.25);
  b.hips.position.y -= SIT_DROP;
}
export const SIT_DROP = 0.44;          // how far his hips come down when he sits
export const HIP_HEIGHT = 0.94;        // how high his hips are when standing

const KNOCK = { fall: 0.35, lie: 1.1, rise: 1.7 }; // seconds

// Knock the player flat. He falls away from `fromPosition` (whoever hit him).
export function knockDown(player, fromPosition) {
  if (player.downTime >= 0) return;
  const position = player.group.position;
  player.group.rotation.y = Math.atan2(fromPosition.x - position.x, fromPosition.z - position.z);
  player.downTime = 0;
}

// How much lower the character's head is right now (used by the camera).
export function crouchDrop(player) {
  return 0.45 * player.crouch + 0.9 * player.down;
}
