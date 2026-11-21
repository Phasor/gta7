// Other people in the world: men and women who wander the field.
// They can be shot. A wounded one runs up to the player and hits back: women
// slap him in the face, men punch him to the floor. One with no health left
// falls over, and a replacement appears somewhere else a few seconds later.
//
// The bodies and their standing, walking and running animations come from the
// same maker as the player's avatar (Ready Player Me), in public/models/people.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { turnBoneBy } from './player.js';
import { pushOut, floorAt, addObstacle } from './world.js';

const FOLDER = `${import.meta.env.BASE_URL}models/people/`;

// Who is out there. `clothes` turns the colours of the outfit round the colour
// wheel (in degrees) so the same body gives several different looks.
const PEOPLE = [
  { kind: 'woman', clothes: 0, height: 1.0 },
  { kind: 'man', clothes: 0, height: 1.0 },
  { kind: 'woman', clothes: 140, height: 0.95 },
  { kind: 'man', clothes: 200, height: 1.05 },
  { kind: 'woman', clothes: 250, height: 1.03 },
  { kind: 'man', clothes: 90, height: 0.96 },
];

const WALK_SPEED = 1.4;
const RUN_SPEED = 4.2;
const HEALTH = 100;
const DAMAGE = 34;        // three shots
const RADIUS = 0.35;      // the body counts as an upright cylinder for bullets
const HEIGHT = 1.75;
const RESPAWN_TIME = 7;
const STRIKE_RANGE = 0.8; // how close they get before swinging
const STRIKE_TIME = 0.55; // seconds for the whole swing

// --- Loading -----------------------------------------------------------------

// Animations are recorded moving forward; keep the character on the spot (the
// game moves it instead) by removing the steady drift from the hips.
function onTheSpot(clip, name) {
  for (const track of clip.tracks) {
    if (!track.name.endsWith('Hips.position')) continue;
    const v = track.values, last = v.length - 3, length = track.times[track.times.length - 1] || 1;
    const drift = [v[last] - v[0], v[last + 1] - v[1], v[last + 2] - v[2]];
    for (let i = 0; i < track.times.length; i++) {
      const part = track.times[i] / length;
      for (let axis = 0; axis < 3; axis++) v[i * 3 + axis] -= drift[axis] * part;
    }
  }
  clip.name = name;
  return clip;
}

// A copy of a material with the outfit's colours changed: coloured cloth is turned
// round the colour wheel and white cloth is dyed. Skin, hair and anything else in
// the brown-to-peach range is left alone.
function recolour(material, degrees) {
  const image = material.map?.image;
  if (!degrees || !image) return material;
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = pixels.data, colour = new THREE.Color(), hsl = {};
  const dye = new THREE.Color().setHSL(degrees / 360, 0.55, 0.62);
  for (let i = 0; i < d.length; i += 4) {
    colour.setRGB(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255).getHSL(hsl);
    const skinOrHair = hsl.h < 0.14 || hsl.h > 0.97;
    if (skinOrHair && hsl.s >= 0.08) continue;
    if (hsl.s >= 0.08) colour.setHSL((hsl.h + degrees / 360) % 1, hsl.s, hsl.l); // coloured cloth: new colour
    else colour.multiply(dye);                                                   // white or grey cloth: dyed
    d[i] = colour.r * 255; d[i + 1] = colour.g * 255; d[i + 2] = colour.b * 255;
  }
  ctx.putImageData(pixels, 0, 0);

  const map = new THREE.CanvasTexture(canvas);
  map.flipY = material.map.flipY;
  map.colorSpace = material.map.colorSpace;
  map.wrapS = material.map.wrapS;
  map.wrapT = material.map.wrapT;
  const copy = material.clone();
  copy.map = map;
  return copy;
}

async function loadKind(loader, kind) {
  const [body, idle, walk, run] = await Promise.all(
    ['', '_idle', '_walk', '_run'].map((part) => loader.loadAsync(`${FOLDER}${kind}${part}.glb`))
  );
  body.scene.traverse((part) => {
    if (part.isMesh) {
      part.castShadow = true;
      part.frustumCulled = false; // animated meshes can be wrongly hidden otherwise
    }
  });
  return {
    scene: body.scene,
    clips: [onTheSpot(idle.animations[0], 'Idle'), onTheSpot(walk.animations[0], 'Walk'), onTheSpot(run.animations[0], 'Run')],
  };
}

// Put an NPC somewhere new near `around`, alive and standing.
function place(npc, around) {
  const angle = Math.random() * Math.PI * 2, distance = 12 + Math.random() * 35;
  const limit = npc.halfMap - 2;
  npc.group.position.set(
    THREE.MathUtils.clamp(around.x + Math.cos(angle) * distance, -limit, limit), 0,
    THREE.MathUtils.clamp(around.z + Math.sin(angle) * distance, -limit, limit)
  );
  pushOut(npc.group.position, 0.6); // not inside a building
  npc.group.rotation.y = Math.random() * Math.PI * 2;
  npc.tilt.rotation.set(0, 0, 0);
  npc.tilt.position.y = 0;
  if (npc.deathPose) { // straighten out the limbs from the last fall
    for (const { bone, from } of npc.deathPose) bone.quaternion.copy(from);
    npc.deathPose = null;
  }
  Object.assign(npc, { health: HEALTH, state: 'idle', timer: 1 + Math.random() * 4, fall: 0 });
}

// Choose somewhere to stroll to, `near`..`far` metres away.
function wander(npc, near, far) {
  const position = npc.group.position;
  const angle = Math.random() * Math.PI * 2, distance = near + Math.random() * (far - near);
  const limit = npc.halfMap - 2;
  npc.target.set(
    THREE.MathUtils.clamp(position.x + Math.cos(angle) * distance, -limit, limit), 0,
    THREE.MathUtils.clamp(position.z + Math.sin(angle) * distance, -limit, limit)
  );
  npc.state = 'walk';
  npc.timer = 15; // give up if something is in the way
}

// testSpot: if given, the first NPC stands still there (used for checking things work).
// testKind: 'man' or 'woman', which of them that first NPC should be.
// cashierSpots: a list of { x, z, facing }, each of which gets a shopkeeper. They
// never leave their spot; they just stand at the till and turn their head to watch the player.
export function createNpcs(scene, halfMap, testSpot, testKind, cashierSpots) {
  const npcs = [];
  const loader = new GLTFLoader();
  Promise.all([loadKind(loader, 'woman'), loadKind(loader, 'man')]).then(([woman, man]) => {
    const kinds = { woman, man };

    npcs.cashiers = [];
    for (const cashierSpot of cashierSpots || []) {
      const model = cloneSkinned(man.scene);
      model.traverse((part) => { if (part.isMesh) part.material = recolour(part.material, 330); });
      const group = new THREE.Group();
      group.position.set(cashierSpot.x, 0, cashierSpot.z);
      group.position.y = floorAt(group.position);
      group.rotation.y = cashierSpot.facing;
      group.add(model);
      scene.add(group);
      const mixer = new THREE.AnimationMixer(model);
      mixer.clipAction(man.clips[0]).play(); // standing idle
      const bones = [model.getObjectByName('Neck'), model.getObjectByName('Head')];
      npcs.cashiers.push({ group, mixer, bones, clean: bones.map((bone) => bone.quaternion.clone()), look: 0 });
      addObstacle(cashierSpot.x - 0.3, cashierSpot.x + 0.3, cashierSpot.z - 0.3, cashierSpot.z + 0.3, 2.1);
    }
    const people = testKind === 'man' ? [PEOPLE[1], PEOPLE[0], ...PEOPLE.slice(2)] : PEOPLE;

    people.forEach((person, i) => {
      const { scene: body, clips } = kinds[person.kind];
      const model = cloneSkinned(body);
      model.scale.setScalar(person.height);
      model.traverse((part) => { if (part.isMesh) part.material = recolour(part.material, person.clothes); });

      const tilt = new THREE.Group();   // tips over when they fall
      tilt.add(model);
      const group = new THREE.Group();  // position on the map and the way they face
      group.add(tilt);
      scene.add(group);

      const mixer = new THREE.AnimationMixer(model);
      const actions = {};
      for (const clip of clips) {
        const action = mixer.clipAction(clip);
        action.play();
        action.setEffectiveWeight(clip.name === 'Idle' ? 1 : 0);
        actions[clip.name] = action;
      }

      const bone = (name) => model.getObjectByName(name);
      const arm = [bone('RightArm'), bone('RightForeArm'), bone('RightHand')];
      const npc = {
        kind: person.kind, group, tilt, model, mixer, actions, halfMap, arm,
        // The striking arm's animated pose, saved so the swing can be undone each frame.
        clean: arm.slice(0, 2).map((part) => ({ bone: part, rotation: part.quaternion.clone() })),
        target: new THREE.Vector3(), pace: 0, strikeTime: 0, struck: false, still: false,
      };
      place(npc, new THREE.Vector3());
      if (i === 0 && testSpot) {
        npc.group.position.copy(testSpot);
        npc.group.rotation.y = 0;
        npc.still = true;
      }
      npcs.push(npc);
    });
  });
  return npcs;
}

// --- Sounds ------------------------------------------------------------------

// A slap is a very short burst of bright noise; a punch is a duller, heavier thud.
let audio = null;
export function playStrike(kind) {
  try {
    audio ??= new AudioContext();
    const punch = kind === 'punch';
    const now = audio.currentTime, length = Math.floor(audio.sampleRate * 0.2);
    const buffer = audio.createBuffer(1, length, audio.sampleRate);
    const data = buffer.getChannelData(0);
    const fade = audio.sampleRate * (punch ? 0.04 : 0.018);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / fade);
    const noise = audio.createBufferSource();
    noise.buffer = buffer;
    const tone = audio.createBiquadFilter();
    tone.type = punch ? 'lowpass' : 'bandpass';
    tone.frequency.value = punch ? 320 : 1900;
    tone.Q.value = 0.7;
    const volume = audio.createGain();
    volume.gain.value = punch ? 2.4 : 1.4;
    noise.connect(tone).connect(volume).connect(audio.destination);
    noise.start(now);
  } catch {
    // No sound available.
  }
}

// --- Behaviour ---------------------------------------------------------------

// For testing: set debug.pace to 1 or 2 to hold every NPC in the walk or run animation.
export const debug = { pace: null };

const UP = new THREE.Vector3(0, 1, 0), NO_TURN = new THREE.Quaternion();
const swing = new THREE.Quaternion();
const face = new THREE.Vector3(), reach = new THREE.Vector3(), from = new THREE.Vector3(), to = new THREE.Vector3(), limb = new THREE.Vector3();

// Swing the right arm at the player's face. `t` runs 0..1 through the strike.
function poseStrike(npc, playerPosition, t) {
  let strength, angle;
  if (npc.kind === 'woman') {
    // Slap: the arm lifts wound back on her right, then sweeps across past his face.
    strength = Math.min(1, t * 5) * Math.min(1, (1 - t) * 3.5);
    angle = -1.3 + THREE.MathUtils.smoothstep(t, 0.25, 0.6) * 2.1;
  } else {
    // Punch: the arm shoots straight out at his face and snaps back.
    strength = THREE.MathUtils.smoothstep(t, 0.15, 0.45) * Math.min(1, (1 - t) * 4);
    angle = 0;
  }

  face.copy(playerPosition).setY(playerPosition.y + 1.6);
  npc.arm[0].getWorldPosition(from);
  reach.copy(face).sub(from).normalize().applyAxisAngle(UP, angle);
  for (let i = 0; i < 2; i++) {
    npc.arm[i].getWorldPosition(from);
    npc.arm[i + 1].getWorldPosition(to);
    limb.copy(to).sub(from).normalize();
    swing.setFromUnitVectors(limb, reach);
    turnBoneBy(npc.arm[i], swing.slerpQuaternions(NO_TURN, swing.clone(), strength));
  }
}

// onStrike(kind, npc) is called at the moment a slap or punch lands on the player.
export function updateNpcs(npcs, playerPosition, dt, onStrike) {
  // The cashier: stands still, and his head follows the player round the shop.
  for (const cashier of npcs.cashiers || []) {
    cashier.bones.forEach((bone, i) => bone.quaternion.copy(cashier.clean[i])); // undo last frame's head turn
    cashier.mixer.update(dt);
    cashier.bones.forEach((bone, i) => cashier.clean[i].copy(bone.quaternion));
    const dx = playerPosition.x - cashier.group.position.x, dz = playerPosition.z - cashier.group.position.z;
    let want = Math.atan2(dx, dz) - cashier.group.rotation.y;
    want = Math.atan2(Math.sin(want), Math.cos(want));
    if (Math.hypot(dx, dz) > 9) want = 0;                 // nobody about: looks straight ahead
    want = THREE.MathUtils.clamp(want, -1.3, 1.3);        // a neck only turns so far
    cashier.look += (want - cashier.look) * Math.min(1, 4 * dt);
    turnBoneBy(cashier.bones[0], swing.setFromAxisAngle(UP, cashier.look * 0.35));
    turnBoneBy(cashier.bones[1], swing.setFromAxisAngle(UP, cashier.look * 0.65));
  }

  for (const npc of npcs) {
    const position = npc.group.position;
    npc.timer -= dt;

    if (npc.state === 'dead') {
      // Topple over (backwards, forwards or to one side) with limbs going
      // limp, then lie there until it's time to be replaced.
      npc.fall = Math.min(1, npc.fall + dt * 2.2);
      const tipped = npc.fall * npc.fall; // slow at first, then faster, like a real fall
      npc.tilt.rotation[npc.fallWay[0]] = npc.fallWay[1] * Math.PI / 2 * tipped;
      npc.tilt.position.y = 0.12 * tipped;
      for (const { bone, from, to: limp } of npc.deathPose) bone.quaternion.slerpQuaternions(from, limp, tipped);
      if (npc.timer <= 0 && !npc.still) place(npc, playerPosition);
      continue;
    }

    const toPlayerX = playerPosition.x - position.x, toPlayerZ = playerPosition.z - position.z;
    const playerDistance = Math.hypot(toPlayerX, toPlayerZ);
    let pace = 0;       // 0 standing, 1 walking, 2 running
    let heading = null; // the way they want to face

    if (npc.state === 'idle') {
      if (npc.timer <= 0 && !npc.still) wander(npc, 6, 18);
    } else if (npc.state === 'walk') {
      const dx = npc.target.x - position.x, dz = npc.target.z - position.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 0.5 || npc.timer <= 0) {
        npc.state = 'idle';
        npc.timer = 1.5 + Math.random() * 4;
      } else {
        position.x += dx / distance * WALK_SPEED * dt;
        position.z += dz / distance * WALK_SPEED * dt;
        heading = Math.atan2(dx, dz);
        pace = 1;
      }
    } else if (npc.state === 'chase') {
      // Angry: run straight at the player.
      heading = Math.atan2(toPlayerX, toPlayerZ);
      if (playerDistance <= STRIKE_RANGE) {
        npc.state = 'strike';
        npc.strikeTime = 0;
        npc.struck = false;
      } else if (npc.timer <= 0) {
        npc.state = 'idle'; // gave up
        npc.timer = 2;
      } else {
        const stride = Math.min(RUN_SPEED * dt, playerDistance - STRIKE_RANGE + 0.05);
        position.x += toPlayerX / playerDistance * stride;
        position.z += toPlayerZ / playerDistance * stride;
        pace = 2;
      }
    } else if (npc.state === 'strike') {
      heading = Math.atan2(toPlayerX, toPlayerZ);
      npc.strikeTime += dt / STRIKE_TIME;
      if (!npc.struck && npc.strikeTime >= 0.45) {
        npc.struck = true;
        if (playerDistance < STRIKE_RANGE + 0.6) { // he may have dodged
          const kind = npc.kind === 'man' ? 'punch' : 'slap';
          playStrike(kind);
          onStrike?.(kind, npc);
        }
      }
      if (npc.strikeTime >= 1) {
        if (npc.still) { npc.state = 'idle'; npc.timer = 99; } else wander(npc, 10, 18); // point made; they walk off
      }
    }

    pushOut(position, 0.35); // can't walk through walls
    position.y = floorAt(position);

    if (heading !== null) {
      // Turn to face that way, taking the short way round.
      let turn = heading - npc.group.rotation.y;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      npc.group.rotation.y += turn * Math.min(1, 10 * dt);
    }

    if (debug.pace !== null) pace = debug.pace;
    npc.pace += (pace - npc.pace) * Math.min(1, 6 * dt);
    const p = npc.pace;
    npc.actions.Idle.setEffectiveWeight(Math.max(0, 1 - p));
    npc.actions.Walk.setEffectiveWeight(p <= 1 ? p : 2 - p);
    npc.actions.Run.setEffectiveWeight(Math.max(0, p - 1));

    // Undo last frame's arm swing before animating (the animation system only
    // rewrites a bone when its animated value changes), then remember the clean pose.
    for (const { bone, rotation } of npc.clean) bone.quaternion.copy(rotation);
    npc.mixer.update(dt);
    for (const entry of npc.clean) entry.rotation.copy(entry.bone.quaternion);
    if (npc.state === 'strike') poseStrike(npc, playerPosition, Math.min(1, npc.strikeTime));
  }
}

// Which living NPC, if any, a bullet travelling from `origin` along `direction`
// reaches first within `maxDistance`. Returns { npc, distance } or null.
export function findNpcHit(npcs, origin, direction, maxDistance) {
  let best = null;
  const a = direction.x * direction.x + direction.z * direction.z;
  if (a < 1e-8) return null;
  for (const npc of npcs) {
    if (npc.state === 'dead') continue;
    const p = npc.group.position;
    const ox = origin.x - p.x, oz = origin.z - p.z;
    const b = 2 * (ox * direction.x + oz * direction.z);
    const c = ox * ox + oz * oz - RADIUS * RADIUS;
    const inside = b * b - 4 * a * c;
    if (inside < 0) continue;
    const distance = (-b - Math.sqrt(inside)) / (2 * a);
    if (distance <= 0 || distance >= maxDistance || (best && distance >= best.distance)) continue;
    const height = origin.y + direction.y * distance - p.y;
    if (height >= 0 && height <= HEIGHT) best = { npc, distance };
  }
  return best;
}

// The ways a body can go down: [axis to tip around, direction].
const FALL_WAYS = [['x', -1], ['x', -1], ['x', 1], ['z', 1], ['z', -1]]; // back (most often), front, either side

// Work out a random limp pose for a falling body: where each limb ends up.
// Every death gets different arm, leg, back and head angles.
function makeDeathPose(npc) {
  const side = new THREE.Vector3(1, 0, 0).applyQuaternion(npc.group.quaternion);
  const front = new THREE.Vector3(0, 0, 1).applyQuaternion(npc.group.quaternion);
  const any = (low, high) => low + Math.random() * (high - low);
  const turns = [
    ['Spine', front, any(-0.25, 0.25)], ['Spine', UP, any(-0.4, 0.4)], ['Head', UP, any(-0.7, 0.7)],
    ['LeftArm', front, any(0.2, 1.4)], ['LeftArm', side, any(-0.9, 0.9)],
    ['RightArm', front, -any(0.2, 1.4)], ['RightArm', side, any(-0.9, 0.9)],
    ['LeftForeArm', side, -any(0, 1.3)], ['RightForeArm', side, -any(0, 1.3)],
    ['LeftUpLeg', side, -any(0, 0.8)], ['LeftUpLeg', front, any(0, 0.3)],
    ['RightUpLeg', side, -any(0, 0.8)], ['RightUpLeg', front, -any(0, 0.3)],
    ['LeftLeg', side, any(0, 1.2)], ['RightLeg', side, any(0, 1.2)],
  ];
  const before = new Map();
  for (const [name, axis, angle] of turns) {
    const bone = npc.model.getObjectByName(name);
    if (!bone) continue;
    if (!before.has(bone)) before.set(bone, bone.quaternion.clone());
    turnBoneBy(bone, swing.setFromAxisAngle(axis, angle));
  }
  const pose = [...before].map(([bone, from]) => ({ bone, from, to: bone.quaternion.clone() }));
  for (const { bone, from } of pose) bone.quaternion.copy(from); // the fall eases into the pose
  return pose;
}

// Make an NPC angry: they run at the player to hit him.
export function provokeNpc(npc) {
  if (npc.state === 'dead' || npc.state === 'strike') return;
  npc.state = 'chase';
  npc.timer = 12; // seconds before they give up the chase
}

// A bullet fired from `shooterPosition` has hit this NPC. Returns true if it killed them.
export function hitNpc(npc, shooterPosition, damage = DAMAGE) {
  if (npc.state === 'dead') return false;
  npc.health -= damage;
  if (npc.health <= 0) {
    const position = npc.group.position;
    npc.state = 'dead';
    npc.fall = 0;
    npc.timer = RESPAWN_TIME;
    // Face the shooter, then fall a random way in a random heap.
    npc.group.rotation.y = Math.atan2(shooterPosition.x - position.x, shooterPosition.z - position.z);
    npc.fallWay = FALL_WAYS[(Math.random() * FALL_WAYS.length) | 0];
    npc.deathPose = makeDeathPose(npc);
    return true;
  }
  provokeNpc(npc);
  return false;
}
