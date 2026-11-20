import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const WALK_SPEED = 2.4;
const SPRINT_SPEED = 6.5;
const CROUCH_SPEED = 1.3;
const JUMP_SPEED = 6.5;
const GRAVITY = 20;
const TURN_RATE = 12;

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

// The angle every bone sits at in the pose the model's skin was attached in
// (arms straight out to the sides). Both models were made in this same pose,
// which makes it the common starting point for copying movement across.
function restingRotations(root) {
  const rest = new Map();
  const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), scale = new THREE.Vector3();
  root.traverse((mesh) => {
    if (!mesh.isSkinnedMesh) return;
    mesh.skeleton.bones.forEach((bone, i) => {
      if (rest.has(bone)) return;
      const rotation = new THREE.Quaternion();
      matrix.copy(mesh.skeleton.boneInverses[i]).invert().decompose(position, rotation, scale);
      // That angle is measured inside the skeleton's container, which may itself
      // be turned (this is how a model made "Z-up" is stood upright).
      let container = bone;
      while (container.parent && container.parent.isBone) container = container.parent;
      rest.set(bone, container.parent.getWorldQuaternion(new THREE.Quaternion()).multiply(rotation));
    });
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
function borrowAnimations(soldier, model, names) {
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
    const arm = model.getObjectByName(`${hand}Arm`);
    const foreArm = model.getObjectByName(`${hand}ForeArm`);
    const wrist = model.getObjectByName(`${hand}Hand`);
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
    const from = source.getObjectByName(`mixamorig${bone.name}`);
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

  const hips = byBone.get(model.getObjectByName('Hips'));
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
    tracks.push(new THREE.VectorKeyframeTrack('Hips.position', times, hipSpots));
    return new THREE.AnimationClip(name, clip.duration, tracks);
  });
}
// A relaxed standing pose made in code: arms hanging at his sides, hands loose,
// with slow breathing. (The soldier's own idle is a combat stance with the
// hands held up for a rifle, which looks wrong on a civilian.)
function makeIdle(model) {
  model.updateWorldMatrix(true, true);
  const bones = [];
  model.traverse((part) => { if (part.isBone) bones.push(part); });
  const rest = bones.map((bone) => bone.quaternion.clone());
  const forward = new THREE.Vector3(0, 0, 1), side = new THREE.Vector3(1, 0, 0);
  const turn = (name, axis, angle) => {
    const bone = model.getObjectByName(name);
    if (bone) turnBone(bone, axis, angle);
  };

  // The model is built with its arms angled down and away from the body.
  // Bring them in a little further so they hang naturally at his sides.
  for (const [hand, sign] of [['Left', 1], ['Right', -1]]) {
    turn(`${hand}Arm`, forward, -0.3 * sign);
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
  const hips = model.getObjectByName('Hips').position;
  tracks.push(new THREE.VectorKeyframeTrack('Hips.position', times, [...hips.toArray(), ...hips.toArray(), ...hips.toArray()]));
  return new THREE.AnimationClip('Idle', 4, tracks);
}

// The main character. `group` is his position on the map (at his feet).
// The model loads in the background and appears a moment after the game starts.
export function createPlayer() {
  const group = new THREE.Group();
  group.rotation.y = Math.PI; // start facing away from the camera

  const player = {
    group,
    velocityY: 0,
    onGround: true,
    motion: 0,   // 0 = standing, 1 = walking, 2 = running (blended)
    crouch: 0,   // 0 = standing, 1 = fully crouched (blended)
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
    player.cleanPose = [b.spine, b.thighL, b.thighR, b.shinL, b.shinR, b.footL, b.footR]
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

const sideways = new THREE.Vector3();
const parentTurn = new THREE.Quaternion(), worldTurn = new THREE.Quaternion();

// Turn a bone by `angle` around an axis given in world space.
function turnBone(bone, axis, angle) {
  bone.parent.getWorldQuaternion(parentTurn);
  worldTurn.setFromAxisAngle(axis, angle);
  // Convert the world-space turn into the bone's parent's space, then apply it.
  worldTurn.premultiply(parentTurn.clone().invert()).multiply(parentTurn);
  bone.quaternion.premultiply(worldTurn);
}

// input: { x, z, sprint, jump, crouch } where x/z are -1..1 relative to the camera.
// cameraYaw: the direction the camera faces, so "forward" means away from it.
export function updatePlayer(player, input, cameraYaw, dt, halfMap) {
  const { group } = player;

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

  // Crouch: bend the legs and lean forward on top of the animation.
  const c = player.crouch;
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
    const lift = lowestFoot - group.position.y - player.ankleHeight;
    const parent = b.hips.parent;
    const from = parent.worldToLocal(b.hips.getWorldPosition(scratch).clone());
    const to = parent.worldToLocal(b.hips.getWorldPosition(scratch).clone().setY(scratch.y - lift));
    b.hips.position.add(to.sub(from));
  }
}

// How much lower the character's head is right now (used by the camera).
export function crouchDrop(player) {
  return 0.45 * player.crouch;
}
