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
import { GANGS, POSTS } from './gangs.js';
import { sfx } from './sound.js';
import { FIGHTERS } from './boxing.js';

const FOLDER = `${import.meta.env.BASE_URL}models/people/`;

// Who is out there. `clothes` turns the colours of the outfit round the colour
// wheel (in degrees) so the same body gives several different looks.
// `home` is where they hang about: the first six live round Palm Ave, and the
// rest among the skyscrapers of Miami.
const CITY_HUES = [0, 140, 200, 250, 90];
const PEOPLE = [
  { kind: 'woman', clothes: 0, height: 1.0 },
  { kind: 'man', clothes: 0, height: 1.0 },
  { kind: 'woman', clothes: 140, height: 0.95 },
  { kind: 'man', clothes: 200, height: 1.05 },
  { kind: 'woman', clothes: 250, height: 1.03 },
  { kind: 'man', clothes: 90, height: 0.96 },
  // Fourteen more, spread along the city street.
  ...Array.from({ length: 14 }, (_, i) => ({
    kind: i % 2 ? 'man' : 'woman',
    clothes: CITY_HUES[(i * 2 + (i % 2)) % 5],
    height: 0.95 + (i * 7 % 10) * 0.012,
    home: [650 + i * 17, i % 2 ? -4 : -5],
  })),
];

const WALK_SPEED = 1.4;
const RUN_SPEED = 4.2;
const HEALTH = 100;
const DAMAGE = 34;        // three shots
const RADIUS = 0.35;      // the body counts as an upright cylinder for bullets
const HEIGHT = 1.75;
const RESPAWN_TIME = 7;
const GANG_RESPAWN = 45;   // a gang member who is shot is replaced after this long

// Four armed members for each gang, standing on their turf.
for (const [key, gang] of Object.entries(GANGS)) {
  POSTS.forEach(([px, pz], i) => PEOPLE.push({
    kind: 'man', clothes: gang.clothes, height: 0.98 + i * 0.025, gang: key,
    post: [gang.turf[0] + px, gang.turf[1] - gang.front * pz],
  }));
}
// The boxers at the Miami Fight Club, who wait beside the ring until someone challenges them.
FIGHTERS.forEach((fighter, i) => PEOPLE.push({ kind: 'man', clothes: fighter.clothes, height: fighter.height, fighter: i, home: fighter.post }));
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
const recoloured = new Map();
function recolour(material, degrees) {
  const image = material.map?.image;
  if (!degrees || !image) return material;
  const prison = degrees === 'prison'; // a prisoner's orange overalls
  const cacheKey = material.uuid + ':' + degrees; // repainting is slow, so each outfit is only made once
  if (recoloured.has(cacheKey)) return recoloured.get(cacheKey);
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
    if (prison) colour.setHSL(0.07, 0.95, 0.3 + hsl.l * 0.35);
    else if (hsl.s >= 0.08) colour.setHSL((hsl.h + degrees / 360) % 1, hsl.s, hsl.l); // coloured cloth: new colour
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
  recoloured.set(cacheKey, copy);
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
  if (npc.post) npc.group.position.copy(npc.post); // gang members always come back to their turf
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
// officerPosts: a list of { x, z, facing }. Each gets a uniformed police officer who
// stands guard there, chases the player when he is wanted, and walks back afterwards.
export function createNpcs(scene, halfMap, testSpot, testKind, cashierSpots, officerPosts) {
  const npcs = [];
  const loader = new GLTFLoader();
  Promise.all([loadKind(loader, 'woman'), loadKind(loader, 'man')]).then(([woman, man]) => {
    const kinds = { woman, man };

    npcs.cashiers = [];
    for (const cashierSpot of cashierSpots || []) {
      const model = cloneSkinned(man.scene);
      if (cashierSpot.uniform) addUniform(model); // the police desk officer
      else model.traverse((part) => { if (part.isMesh) part.material = recolour(part.material, cashierSpot.prisoner ? 'prison' : 330); });
      const group = new THREE.Group();
      group.position.set(cashierSpot.x, cashierSpot.y ?? 0, cashierSpot.z); // (y: for people who stand upstairs)
      group.position.y = floorAt(group.position);
      group.rotation.y = cashierSpot.facing;
      group.add(model);
      scene.add(group);
      const mixer = new THREE.AnimationMixer(model);
      mixer.clipAction(man.clips[0]).play(); // standing idle
      const bones = ['Neck', 'Head', 'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm', 'Spine'].map((name) => model.getObjectByName(name));
      npcs.cashiers.push({ group, model, mixer, bones, clean: bones.map((bone) => bone.quaternion.clone()), look: 0,
        cashier: true, home: group.position.clone(), facing: cashierSpot.facing, handsUp: 0, choke: 0, chokeTime: 0, dead: 0, fall: 0,
        meek: !cashierSpot.uniform && !cashierSpot.prisoner, // shop staff put their hands up at the sight of a gun
        cb: { neck: bones[0], head: bones[1], armL: bones[2], armR: bones[3], foreL: bones[4], foreR: bones[5], spine: bones[6] } });
      addObstacle(cashierSpot.x - 0.3, cashierSpot.x + 0.3, cashierSpot.z - 0.3, cashierSpot.z + 0.3, group.position.y + 2.1, cashierSpot.y ? group.position.y - 0.3 : undefined);
    }

    npcs.officers = [];
    for (const post of officerPosts || []) {
      const model = cloneSkinned(man.scene);
      addUniform(model);
      const group = new THREE.Group();
      group.position.set(post.x, 0, post.z);
      group.rotation.y = post.facing;
      group.add(model);
      scene.add(group);
      const mixer = new THREE.AnimationMixer(model);
      const actions = {};
      for (const clip of man.clips) {
        const action = mixer.clipAction(clip);
        action.play();
        action.setEffectiveWeight(clip.name === 'Idle' ? 1 : 0);
        actions[clip.name] = action;
      }
      npcs.officers.push({ group, mixer, actions, post, pace: 0 });
    }
    const people = testKind === 'man' ? [PEOPLE[1], PEOPLE[0], ...PEOPLE.slice(2)] : PEOPLE;

    // Bullet streaks for the gangs' guns.
    const crews = {};
    npcs.crews = crews;
    npcs.tracers = Array.from({ length: 8 }, () => {
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
        new THREE.LineBasicMaterial({ color: 0xfff1c4, transparent: true, opacity: 0, fog: false })
      );
      line.frustumCulled = false;
      scene.add(line);
      return line;
    });
    npcs.nextTracer = 0;

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
        home: person.home ? new THREE.Vector3(person.home[0], 0, person.home[1]) : null,
        target: new THREE.Vector3(), pace: 0, strikeTime: 0, struck: false, still: false,
      };
      if (person.fighter !== undefined) { // a boxer: gloves on, and he stays in his corner
        npc.fighter = person.fighter;
        npc.corner = new THREE.Vector3(person.home[0], 0, person.home[1]);
        npc.still = true;
        addGloves(model, FIGHTERS[person.fighter].champion ? 0xd9a83a : 0xc0281e);
      }
      // The bones that move when someone has them by the throat (the right arm is already in the list above).
      npc.cb = { neck: bone('Neck'), head: bone('Head'), armL: bone('LeftArm'), armR: arm[0], foreL: bone('LeftForeArm'), foreR: arm[1], spine: bone('Spine') };
      for (const part of [npc.cb.neck, npc.cb.head, npc.cb.armL, npc.cb.foreL, npc.cb.spine]) npc.clean.push({ bone: part, rotation: part.quaternion.clone() });
      if (person.gang) {
        const gang = GANGS[person.gang];
        npc.gang = person.gang;
        npc.post = new THREE.Vector3(person.post[0], 0, person.post[1]);
        npc.postFacing = gang.front > 0 ? 0 : Math.PI;
        npc.crew = (crews[person.gang] ??= { name: gang.name, alert: 0 });
        npc.flash = addGangGear(model, gang.colour);
        npc.shootTimer = 1 + Math.random();
      }
      place(npc, new THREE.Vector3(person.home?.[0] ?? 0, 0, person.home?.[1] ?? 0));
      if (npc.post) npc.group.rotation.y = npc.postFacing;
      if (npc.corner) toCorner(npc);
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
// What a gang member wears and carries: a black balaclava with two holes cut
// for the eyes, a scarf in the gang's colour, and a pistol in the right hand.
// Returns the muzzle flash, so it can be lit when he fires.
let balaclavaKnit = null;
function addGangGear(model, colour) {
  if (!balaclavaKnit) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#131315';
    ctx.fillRect(0, 0, 256, 128);
    for (let y = 0; y < 128; y += 3) { ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(0, y, 256, 1); } // knitted ribs
    ctx.globalCompositeOperation = 'destination-out'; // cut the eye holes right through
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(64 + side * 11.5, 62, 8.5, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    balaclavaKnit = new THREE.CanvasTexture(canvas);
    balaclavaKnit.colorSpace = THREE.SRGBColorSpace;
  }
  const wear = (bone, geometry, material, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    model.getObjectByName(bone)?.add(mesh);
    return mesh;
  };
  const mask = wear('Head', new THREE.SphereGeometry(0.123, 24, 16), new THREE.MeshStandardMaterial({ map: balaclavaKnit, alphaTest: 0.5, roughness: 1, side: THREE.DoubleSide }), 0, 0.1, 0.006);
  mask.scale.set(1, 1.2, 1.1);
  wear('Head', new THREE.CylinderGeometry(0.088, 0.1, 0.07, 16), new THREE.MeshStandardMaterial({ color: colour, roughness: 0.9 }), 0, -0.04, 0.005); // scarf

  const metal = new THREE.MeshStandardMaterial({ color: 0x17181a, roughness: 0.4, metalness: 0.6 });
  wear('RightHand', new THREE.BoxGeometry(0.035, 0.2, 0.05), metal, 0, 0.14, 0.035);  // slide and barrel, pointing the way the hand points
  wear('RightHand', new THREE.BoxGeometry(0.034, 0.06, 0.11), metal, 0, 0.07, -0.01);  // grip
  const flash = wear('RightHand', new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd98a }), 0, 0.28, 0.035);
  flash.castShadow = false;
  flash.visible = false;
  return flash;
}

// A gang member fires at the player.
function gangShot(npcs, npc, playerPosition, playerDistance, gangs) {
  const hit = Math.random() < (playerDistance < 12 ? 0.55 : 0.3);
  const miss = hit ? 0 : 1;
  npc.arm[2].getWorldPosition(from);
  to.set(playerPosition.x + (Math.random() - 0.5) * 3 * miss, playerPosition.y + 1.2 + Math.random() * 1.5 * miss, playerPosition.z + (Math.random() - 0.5) * 3 * miss);
  const line = npcs.tracers[npcs.nextTracer++ % npcs.tracers.length];
  const points = line.geometry.attributes.position;
  points.setXYZ(0, from.x, from.y, from.z);
  points.setXYZ(1, to.x, to.y, to.z);
  points.needsUpdate = true;
  line.material.opacity = 0.9;
  npc.flash.visible = true;
  npc.flashTime = 0.07;
  sfx('shot');
  gangs?.onShot?.(npc, hit);
}

// Hold the gun arm straight out at the player.
function poseAim(npc, playerPosition) {
  face.copy(playerPosition).setY(playerPosition.y + 1.3);
  for (let i = 0; i < 2; i++) {
    npc.arm[i].getWorldPosition(from);
    npc.arm[i + 1].getWorldPosition(to);
    limb.copy(to).sub(from).normalize();
    reach.copy(face).sub(from).normalize();
    turnBoneBy(npc.arm[i], swing.setFromUnitVectors(limb, reach));
  }
}

// A police uniform, added to a copy of the man: peaked cap with a badge, a gold
// badge on the chest, a shoulder radio, and a duty belt with a holster.
function addUniform(model) {
  const navy = new THREE.MeshStandardMaterial({ color: 0x18233f, roughness: 0.7 });
  const black = new THREE.MeshStandardMaterial({ color: 0x0e0f11, roughness: 0.5 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd9b23a, roughness: 0.3, metalness: 0.8 });
  const wear = (bone, geometry, material, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    model.getObjectByName(bone)?.add(mesh);
    return mesh;
  };
  wear('Head', new THREE.CylinderGeometry(0.112, 0.104, 0.06, 18), navy, 0, 0.185, 0.005);    // cap band
  wear('Head', new THREE.CylinderGeometry(0.135, 0.114, 0.045, 18), navy, 0, 0.235, 0.0);     // flared crown
  wear('Head', new THREE.CylinderGeometry(0.115, 0.115, 0.012, 18, 1, false, -1.0, 2.0), black, 0, 0.16, 0.04); // peak
  wear('Head', new THREE.BoxGeometry(0.04, 0.045, 0.012), gold, 0, 0.2, 0.108);               // cap badge
  wear('Spine2', new THREE.BoxGeometry(0.05, 0.06, 0.014), gold, 0.085, 0.07, 0.118);         // chest badge
  wear('Spine2', new THREE.BoxGeometry(0.05, 0.08, 0.035), black, -0.13, 0.13, 0.085);        // shoulder radio
  wear('Hips', new THREE.BoxGeometry(0.36, 0.06, 0.245), black, 0, 0.07, 0.005);              // duty belt
  wear('Hips', new THREE.BoxGeometry(0.05, 0.05, 0.012), gold, 0, 0.07, 0.13);                // buckle
  wear('Hips', new THREE.BoxGeometry(0.06, 0.16, 0.09), black, -0.2, -0.01, 0.01);            // holster
  wear('Hips', new THREE.BoxGeometry(0.05, 0.07, 0.06), black, 0.19, 0.03, 0.05);             // handcuff pouch
}

const OFFICER_RUN = 5.6, OFFICER_WALK = 1.5;

// police: { wanted, canCatch, onArrest(officer) }. While `wanted` is true the officers run the player down.
// gangs: { canTarget, onShot(npc, hit), onAlert(npc) }. Gang members shoot at the player when he
// trespasses on their turf or attacks one of them.
export function updateNpcs(npcs, playerPosition, dt, onStrike, police, gangs) {
  for (const crew of Object.values(npcs.crews || {})) crew.alert = Math.max(0, crew.alert - dt);
  for (const line of npcs.tracers || []) line.material.opacity = Math.max(0, line.material.opacity - dt * 7);
  for (const cop of npcs.officers || []) {
    const position = cop.group.position;
    let pace = 0, heading = cop.post.facing;
    if (police?.wanted) {
      const dx = playerPosition.x - position.x, dz = playerPosition.z - position.z, distance = Math.hypot(dx, dz) || 1;
      heading = Math.atan2(dx, dz);
      if (distance < 1.4 && police.canCatch) police.onArrest(cop);
      else if (distance > 1.1) {
        const stride = Math.min(OFFICER_RUN * dt, distance - 1.0);
        position.x += dx / distance * stride;
        position.z += dz / distance * stride;
        pace = 2;
      }
    } else {
      const dx = cop.post.x - position.x, dz = cop.post.z - position.z, distance = Math.hypot(dx, dz);
      if (distance > 0.3) { // walking back to his post
        position.x += dx / distance * OFFICER_WALK * dt;
        position.z += dz / distance * OFFICER_WALK * dt;
        heading = Math.atan2(dx, dz);
        pace = 1;
      }
    }
    pushOut(position, 0.35);
    position.y = floorAt(position);
    let turn = heading - cop.group.rotation.y;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    cop.group.rotation.y += turn * Math.min(1, 10 * dt);
    cop.pace += (pace - cop.pace) * Math.min(1, 6 * dt);
    cop.actions.Idle.setEffectiveWeight(Math.max(0, 1 - cop.pace));
    cop.actions.Walk.setEffectiveWeight(cop.pace <= 1 ? cop.pace : 2 - cop.pace);
    cop.actions.Run.setEffectiveWeight(Math.max(0, cop.pace - 1));
    cop.mixer.update(dt);
  }
  // The cashier: stands still, and his head follows the player round the shop.
  for (const cashier of npcs.cashiers || []) {
    cashier.bones.forEach((bone, i) => bone.quaternion.copy(cashier.clean[i])); // undo last frame's head turn
    if (cashier.dead <= 0) cashier.mixer.update(dt);
    cashier.bones.forEach((bone, i) => cashier.clean[i].copy(bone.quaternion));
    // Strangled: he drops behind the counter, and someone new takes over the till after a while.
    if (cashier.dead > 0) {
      cashier.dead -= dt;
      cashier.fall = Math.min(1, cashier.fall + dt * 2);
      if (cashier.dead <= 0) { cashier.fall = 0; cashier.choke = 0; cashier.bend = 0; cashier.group.position.copy(cashier.home); cashier.group.rotation.y = cashier.facing; }
    }
    cashier.model.rotation.x = -Math.PI / 2 * cashier.fall * cashier.fall;
    cashier.model.position.y = 0.12 * cashier.fall;
    const held = npcs.grip?.victim === cashier;
    cashier.choke += ((held ? 1 : 0) - cashier.choke) * Math.min(1, 5 * dt);
    if (held) cashier.chokeTime = npcs.grip.time;
    // Held by the throat he is pulled a step forward and bent over the counter toward the
    // player (he stays on his own side of it); let go, he straightens up and steps back.
    let standX = cashier.home.x, standZ = cashier.home.z, bend = 0;
    if (held) {
      const hx = playerPosition.x - cashier.home.x, hz = playerPosition.z - cashier.home.z, apart = Math.hypot(hx, hz) || 1;
      standX += hx / apart * 0.55;
      standZ += hz / apart * 0.55;
      bend = Math.min(1.0, Math.max(0, apart - 1.0) / 0.45); // the further away he is, the further over he is hauled
      cashier.group.rotation.y = Math.atan2(hx, hz);
    }
    cashier.bend = (cashier.bend || 0) + (bend - (cashier.bend || 0)) * Math.min(1, 5 * dt);
    if (cashier.dead <= 0) {
      cashier.group.position.x += (standX - cashier.group.position.x) * Math.min(1, 5 * dt);
      cashier.group.position.z += (standZ - cashier.group.position.z) * Math.min(1, 5 * dt);
    }
    if (cashier.bend > 0.01) {
      const side = axis.set(1, 0, 0).applyQuaternion(cashier.group.quaternion);
      turnBoneBy(cashier.cb.spine, swing.setFromAxisAngle(side, cashier.bend));
      turnBoneBy(cashier.cb.head, swing.setFromAxisAngle(side, -0.6 * cashier.bend)); // his face stays up, toward the player
    }
    if (cashier.choke > 0.01) poseChoked(cashier, cashier.choke, cashier.chokeTime / CHOKE_TIME);
    if (cashier.dead > 0) continue;
    const dx = playerPosition.x - cashier.group.position.x, dz = playerPosition.z - cashier.group.position.z;
    // A gun in the shop: his hands go up.
    const scared = npcs.threat && cashier.meek && !held && Math.hypot(dx, dz) < 7 && Math.abs(playerPosition.y - cashier.group.position.y) < 2;
    cashier.handsUp += ((scared ? 1 : 0) - cashier.handsUp) * Math.min(1, 4 * dt);
    if (cashier.handsUp > 0.01) {
      const front = axis.set(0, 0, 1).applyQuaternion(cashier.group.quaternion), h = cashier.handsUp;
      turnBoneBy(cashier.cb.armL, swing.setFromAxisAngle(front, 1.9 * h));
      turnBoneBy(cashier.cb.armR, swing.setFromAxisAngle(front, -1.9 * h));
      turnBoneBy(cashier.cb.foreL, swing.setFromAxisAngle(front, 1.0 * h));
      turnBoneBy(cashier.cb.foreR, swing.setFromAxisAngle(front, -1.0 * h));
    }
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
      const rising = npc.getUp && npc.timer <= 0; // only thrown to the floor: he gets back up
      npc.fall = rising ? npc.fall - dt * 2.2 : Math.min(1, npc.fall + dt * 2.2);
      if (rising && npc.fall <= 0) {
        npc.tilt.rotation.set(0, 0, 0);
        npc.tilt.position.y = 0;
        for (const { bone, from } of npc.deathPose) bone.quaternion.copy(from);
        Object.assign(npc, { deathPose: null, state: 'idle', timer: 0.4, fall: 0, getUp: false });
        continue;
      }
      const tipped = npc.fall * npc.fall; // slow at first, then faster, like a real fall
      npc.tilt.rotation[npc.fallWay[0]] = npc.fallWay[1] * Math.PI / 2 * tipped;
      npc.tilt.position.y = 0.12 * tipped;
      for (const { bone, from, to: limp } of npc.deathPose) bone.quaternion.slerpQuaternions(from, limp, tipped);
      if (npc.timer <= 0 && !npc.still) place(npc, npc.home ?? playerPosition); // city people come back in the city
      else if (npc.timer <= 0 && npc.corner && !npc.getUp && !npc.inBout) reviveNpc(npc); // a boxer is back on his feet in his corner
      continue;
    }

    const toPlayerX = playerPosition.x - position.x, toPlayerZ = playerPosition.z - position.z;
    const playerDistance = Math.hypot(toPlayerX, toPlayerZ);
    let pace = 0;       // 0 standing, 1 walking, 2 running
    let heading = null; // the way they want to face
    const held = npcs.grip?.victim === npc;
    npc.choke = (npc.choke || 0) + ((held ? 1 : 0) - (npc.choke || 0)) * Math.min(1, 5 * dt);
    if (held) npc.chokeTime = npcs.grip.time;

    if (held) {
      // Held by the throat: pulled in close, face to face, and going nowhere.
      position.x += (npcs.grip.spot.x - position.x) * Math.min(1, 6 * dt);
      position.z += (npcs.grip.spot.z - position.z) * Math.min(1, 6 * dt);
      heading = Math.atan2(toPlayerX, toPlayerZ);
      npc.aiming = false;
    } else if (npc.gang) {
      // Gang members guard their turf. Come too close, or hurt one, and the whole gang opens fire.
      npc.flashTime = (npc.flashTime || 0) - dt;
      if (npc.flashTime <= 0) npc.flash.visible = false;
      const canTarget = gangs?.canTarget ?? true;
      if (npc.crew.alert <= 0 && playerDistance < 9 && canTarget) {
        npc.crew.alert = 20;
        gangs?.onAlert?.(npc);
      }
      if (npc.crew.alert > 0 && canTarget) {
        if (playerDistance < 32) npc.crew.alert = Math.max(npc.crew.alert, 12); // stays angry while he is near
        heading = Math.atan2(toPlayerX, toPlayerZ);
        if (playerDistance > 11 && playerDistance < 60) { // closes in to shooting range
          position.x += toPlayerX / playerDistance * RUN_SPEED * 0.7 * dt;
          position.z += toPlayerZ / playerDistance * RUN_SPEED * 0.7 * dt;
          pace = 2;
        }
        npc.shootTimer -= dt;
        if (npc.shootTimer <= 0 && playerDistance < 38) {
          npc.shootTimer = 0.9 + Math.random() * 1.1;
          gangShot(npcs, npc, playerPosition, playerDistance, gangs);
        }
        npc.aiming = true;
      } else {
        npc.aiming = false;
        const dx = npc.post.x - position.x, dz = npc.post.z - position.z, distance = Math.hypot(dx, dz);
        if (distance > 0.4) { // strolls back to his spot
          position.x += dx / distance * WALK_SPEED * dt;
          position.z += dz / distance * WALK_SPEED * dt;
          heading = Math.atan2(dx, dz);
          pace = 1;
        } else {
          heading = npc.postFacing;
        }
      }
    } else if (npc.state === 'idle') {
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
      npc.strikeTime += dt / STRIKE_TIME * (npc.quick || 1); // (boxers swing faster)
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
    if (npc.gang && npc.aiming) poseAim(npc, playerPosition);
    if (npc.choke > 0.01) poseChoked(npc, npc.choke, (npc.chokeTime || 0) / CHOKE_TIME);
  }
}

// --- Boxers -------------------------------------------------------------------------------------
// Boxing gloves on both hands.
function addGloves(model, colour) {
  const leather = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.45 });
  for (const hand of ['LeftHand', 'RightHand']) {
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), leather);
    glove.scale.set(1, 1.3, 1.05);
    glove.position.set(0, 0.075, 0.01);
    glove.castShadow = true;
    model.getObjectByName(hand)?.add(glove);
  }
}
function toCorner(npc) {
  npc.group.position.copy(npc.corner);
  npc.group.rotation.y = -Math.PI / 2; // facing the ring
}
// Put a boxer back in his corner, on his feet and fresh.
export function reviveNpc(npc) {
  place(npc, npc.corner);
  toCorner(npc);
  npc.timer = 99;
  npc.getUp = false;
}
// Thrown to the floor: he lies there for `seconds`, then gets up again.
export function floorNpc(npc, byPosition, seconds) {
  if (npc.state === 'dead') return;
  const position = npc.group.position;
  npc.group.rotation.y = Math.atan2(byPosition.x - position.x, byPosition.z - position.z);
  Object.assign(npc, { state: 'dead', fall: 0, timer: seconds, getUp: true, fallWay: FALL_WAYS[0], aiming: false });
  npc.deathPose = makeDeathPose(npc);
}

// --- Strangling -------------------------------------------------------------------------------
export const CHOKE_TIME = 4.5; // seconds of squeezing before they go limp
const axis = new THREE.Vector3();
const smooth = (from, to, t) => { const u = Math.min(1, Math.max(0, (t - from) / (to - from))); return u * u * (3 - 2 * u); };

// Someone with hands round their throat: head forced back, their own hands come up to
// pull at the wrists, and they twist and struggle. As `progress` nears 1 the fight goes
// out of them: the arms sink and the head lolls forward.
function poseChoked(victim, weight, progress) {
  const cb = victim.cb, side = axis.set(1, 0, 0).applyQuaternion(victim.group.quaternion);
  const fight = 1 - smooth(0.68, 1, progress);
  const now = performance.now() * 0.001;
  const shake = (Math.sin(now * 13) * 0.6 + Math.sin(now * 21.7) * 0.4) * 0.07 * weight * fight;
  turnBoneBy(cb.head, swing.setFromAxisAngle(side, weight * (-0.45 * fight + 0.5 * (1 - fight))));
  turnBoneBy(cb.spine, swing.setFromAxisAngle(side, -0.14 * weight * fight));
  turnBoneBy(cb.spine, swing.setFromAxisAngle(UP, shake * 1.6));
  for (const [upper, fore, way] of [[cb.armL, cb.foreL, 1], [cb.armR, cb.foreR, -1]]) {
    turnBoneBy(upper, swing.setFromAxisAngle(side, (-1.15 + shake * way) * weight * fight));
    turnBoneBy(fore, swing.setFromAxisAngle(side, -1.25 * weight * fight));
  }
}

// Who he could get his hands on: the nearest living person in front of him. Shop staff
// can be reached across their counter. Returns an NPC or a cashier, or null.
export function findGrab(npcs, position, facing) {
  let best = null, nearest = Infinity;
  const consider = (who, reach) => {
    const dx = who.group.position.x - position.x, dz = who.group.position.z - position.z, distance = Math.hypot(dx, dz);
    if (distance > reach || distance >= nearest || Math.abs(who.group.position.y - position.y) > 1) return;
    if (distance > 0.2 && (dx * Math.sin(facing) + dz * Math.cos(facing)) / distance < 0.3) return; // behind him
    best = who;
    nearest = distance;
  };
  for (const npc of npcs) if (npc.state !== 'dead') consider(npc, 1.6);
  for (const cashier of npcs.cashiers || []) if (cashier.dead <= 0) consider(cashier, 2.5);
  return best;
}
// Where their neck is, for his hands to go to.
export function neckSpot(victim, out) {
  return victim.cb.neck.getWorldPosition(out);
}
// The squeezing has done its work. Returns true if it was an NPC who can drop cash.
export function strangle(victim, byPosition) {
  if (victim.cashier) { victim.dead = 120; victim.fall = 0; return false; }
  hitNpc(victim, byPosition, 1e6);
  return true;
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
  if (npc.gang) { npc.crew.alert = 25; return; } // hurt one and the whole gang turns on you
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
    npc.timer = npc.gang ? GANG_RESPAWN : RESPAWN_TIME;
    if (npc.gang) { npc.crew.alert = 25; npc.aiming = false; npc.flash.visible = false; }
    // Face the shooter, then fall a random way in a random heap.
    npc.group.rotation.y = Math.atan2(shooterPosition.x - position.x, shooterPosition.z - position.z);
    npc.fallWay = FALL_WAYS[(Math.random() * FALL_WAYS.length) | 0];
    npc.deathPose = makeDeathPose(npc);
    return true;
  }
  provokeNpc(npc);
  return false;
}
