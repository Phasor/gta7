// The handgun: a big, heavy, steel pistol in the style of a Desert Eagle.
// The model, the muzzle flash, the smoke, the bullet streak, the dust where a
// shot lands and the gunshot sound are all made in code.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const FIRE_INTERVAL = 0.32;   // seconds between shots
const MUZZLE = new THREE.Vector3(0, 0.099, 0.186); // where the bullet leaves, measured from the grip
const SMOKE_COLOR = 0xd9d4c8, DUST_COLOR = 0xa08a66;

// --- The model ---------------------------------------------------------------
// Built around the grip. The barrel points along +Z, up is +Y, and the gun's
// right-hand side faces -X. Sizes are in metres.

function box(material, w, h, d, x, y, z, tilt = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.rotation.x = tilt;
  mesh.castShadow = true;
  return mesh;
}

function rod(material, radius, length, x, y, z, axis = 'x') {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 14), material);
  if (axis === 'x') mesh.rotation.z = Math.PI / 2;
  if (axis === 'z') mesh.rotation.x = Math.PI / 2;
  mesh.position.set(x, y, z);
  return mesh;
}

// A part cut from a side-on outline (points are [z, y]) and given thickness.
function sideCut(material, outline, width, hole) {
  const shape = new THREE.Shape(outline.map(([z, y]) => new THREE.Vector2(z, y)));
  if (hole) shape.holes.push(new THREE.Path(hole.map(([z, y]) => new THREE.Vector2(z, y))));
  const bevel = Math.min(0.0025, width / 4);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 2,
  });
  geometry.rotateY(-Math.PI / 2);          // outline's across-axis becomes the gun's length
  geometry.translate(width / 2 - bevel, 0, 0);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  return mesh;
}

// Stippled black rubber for the grip: rows of small raised dots.
function gripTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#121214';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#34343a';
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      ctx.beginPath();
      ctx.arc(col * 8 + (row % 2 ? 6 : 2), row * 8 + 4, 1.9, 0, 7);
      ctx.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(70, 70); // the grip is only a few centimetres across
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// A length of the gun's upper half with a constant cross-section (points are
// [x, y]), running from z = `from` to z = `to`. `slant` leans the front face.
function lengthCut(material, section, from, to, slant = 0) {
  const shape = new THREE.Shape(section.map(([x, y]) => new THREE.Vector2(x, y)));
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: to - from, bevelEnabled: false });
  geometry.translate(0, 0, from);
  if (slant) {
    const p = geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      if (p.getZ(i) > to - 0.0005) p.setZ(i, p.getZ(i) + (p.getY(i) - 0.079) * slant);
    }
    geometry.computeVertexNormals();
  }
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  return mesh;
}

function buildModel(renderer) {
  // Polished metal needs surroundings to reflect, so give it a simple studio to mirror.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const reflections = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  // Satin stainless steel, a brighter polished steel, black steel, and rubber.
  const steel = new THREE.MeshStandardMaterial({ color: 0xd2d4d8, metalness: 1, roughness: 0.4, envMap: reflections, envMapIntensity: 1.1 });
  const polished = new THREE.MeshStandardMaterial({ color: 0xe2e4e8, metalness: 1, roughness: 0.22, envMap: reflections, envMapIntensity: 1.2 });
  const black = new THREE.MeshStandardMaterial({ color: 0x141416, metalness: 0.6, roughness: 0.45, envMap: reflections, envMapIntensity: 0.6 });
  const rubber = new THREE.MeshStandardMaterial({ map: gripTexture(), roughness: 0.85 });
  const hollow = new THREE.MeshBasicMaterial({ color: 0x050505 });

  const model = new THREE.Group();

  // Frame: the dust cover under the barrel, the grip's steel core flaring out at
  // the bottom, and the long tail that sweeps back and up over the hand.
  model.add(sideCut(steel, [
    [-0.074, 0.079], [0.112, 0.079], [0.112, 0.058], [0.094, 0.05], [0.028, 0.05],
    [0.022, 0.03], [0.008, -0.05], [0.012, -0.06], [-0.058, -0.06], [-0.045, 0.018],
    [-0.052, 0.042], [-0.072, 0.05], [-0.098, 0.066], [-0.098, 0.072], [-0.082, 0.07],
  ], 0.031));

  // Rubber grip wrapped around the sides and back, leaving the steel front strap bare.
  model.add(sideCut(rubber, [
    [0.014, 0.04], [0.0, -0.05], [-0.056, -0.05], [-0.047, 0.018], [-0.053, 0.04], [-0.03, 0.047],
  ], 0.037));
  model.add(box(black, 0.034, 0.008, 0.074, 0, -0.064, -0.022)); // magazine base plate

  // Slide (the rear part that moves): flat sides sloping in to a narrow top.
  const slideSection = [[-0.0185, 0.079], [0.0185, 0.079], [0.0185, 0.103], [0.011, 0.123], [-0.011, 0.123], [-0.0185, 0.103]];
  model.add(lengthCut(steel, slideSection, -0.084, 0.04));

  // Barrel (the fixed front part): the same slope, a little slimmer, ending in a
  // muzzle whose face leans forward at the top.
  const barrelSection = [[-0.018, 0.079], [0.018, 0.079], [0.018, 0.1], [0.0105, 0.119], [-0.0105, 0.119], [-0.018, 0.1]];
  model.add(lengthCut(steel, barrelSection, 0.04, 0.176, 0.3));
  // Long polished flats down each side of the barrel.
  model.add(box(polished, 0.0366, 0.013, 0.092, 0, 0.0905, 0.112));
  // The round chamber showing where the slide meets the barrel.
  model.add(rod(polished, 0.0128, 0.05, 0, 0.1045, 0.04, 'z'));

  // Trigger guard: a big squared-off loop.
  model.add(sideCut(steel,
    [[0.02, 0.052], [0.094, 0.052], [0.094, 0.026], [0.091, 0.012], [0.082, 0.005], [0.07, 0.002], [0.012, 0.002]],
    0.012,
    [[0.03, 0.045], [0.086, 0.045], [0.086, 0.027], [0.084, 0.017], [0.077, 0.011], [0.069, 0.009], [0.024, 0.009]]
  ));

  model.add(
    // Muzzle: the bore in the slanted face.
    rod(hollow, 0.0068, 0.003, 0, 0.099, 0.1835, 'z'),
    rod(black, 0.0092, 0.002, 0, 0.099, 0.1828, 'z'),

    // Ejection port on the right side.
    box(hollow, 0.002, 0.014, 0.036, -0.0186, 0.094, 0.012),

    // Sights.
    box(black, 0.021, 0.008, 0.013, 0, 0.127, -0.068),
    box(hollow, 0.005, 0.0082, 0.0135, 0, 0.128, -0.068),
    box(black, 0.005, 0.009, 0.014, 0, 0.1245, 0.178, -0.5),

    // Hammer and trigger.
    box(black, 0.008, 0.022, 0.011, 0, 0.097, -0.088, -0.45),
    box(black, 0.0065, 0.026, 0.007, 0, 0.03, 0.052, -0.28),

    // Safety catch: a large black lever on each side of the slide.
    rod(black, 0.0085, 0.041, 0, 0.108, -0.058, 'x'),
    box(black, 0.041, 0.007, 0.024, 0, 0.11, -0.042, 0.25),

    // Pins through the frame, the slide catch, and the magazine release.
    rod(black, 0.0042, 0.0335, 0, 0.066, 0.05, 'x'),
    rod(black, 0.0036, 0.0335, 0, 0.058, 0.03, 'x'),
    rod(black, 0.0036, 0.0335, 0, 0.056, -0.012, 'x'),
    box(black, 0.0025, 0.006, 0.04, 0.0165, 0.073, 0.012),
    rod(black, 0.004, 0.039, 0, 0.034, -0.008, 'x'),
    rod(steel, 0.0026, 0.0385, 0, -0.03, -0.03, 'x')   // grip screw
  );

  // Wide grip grooves cut into the slide, leaning back like the grip.
  for (let i = 0; i < 9; i++) model.add(box(black, 0.0376, 0.021, 0.0028, 0, 0.0915, -0.066 + i * 0.0085, 0.22));
  // Toothed rail along the top of the barrel...
  for (let i = 0; i < 11; i++) model.add(box(steel, 0.019, 0.005, 0.0052, 0, 0.1205, 0.05 + i * 0.0105));
  // ...and a shorter one underneath the frame.
  for (let i = 0; i < 6; i++) model.add(box(steel, 0.02, 0.005, 0.005, 0, 0.0485, 0.05 + i * 0.0098));
  // Vent slots in the sloping sides near the muzzle.
  for (let i = 0; i < 4; i++) model.add(box(hollow, 0.0325, 0.011, 0.0042, 0, 0.1085, 0.146 + i * 0.0085, 0.3));

  return model;
}
// A large copy of the gun to look at, for checking the model.
export function createDisplayGun(renderer) {
  return buildModel(renderer);
}

// --- Smoke -------------------------------------------------------------------

// A soft, lumpy blob of smoke with see-through edges.
function smokeTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * 26;
    const x = size / 2 + Math.cos(a) * r, y = size / 2 + Math.sin(a) * r, blob = 16 + Math.random() * 22;
    const g = ctx.createRadialGradient(x, y, 0, x, y, blob);
    g.addColorStop(0, 'rgba(255,255,255,0.3)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  return new THREE.CanvasTexture(canvas);
}

function createSmoke(scene, count) {
  const map = smokeTexture();
  const puffs = [];
  for (let i = 0; i < count; i++) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, opacity: 0, depthWrite: false }));
    sprite.visible = false;
    sprite.velocity = new THREE.Vector3();
    sprite.age = 0;
    scene.add(sprite);
    puffs.push(sprite);
  }
  return { puffs, next: 0 };
}

// One puff: where it starts, how it moves, how big it starts and ends, how long it lasts.
function puff(smoke, position, velocity, startSize, endSize, life, color, strength) {
  const sprite = smoke.puffs[smoke.next];
  smoke.next = (smoke.next + 1) % smoke.puffs.length;
  sprite.position.copy(position);
  sprite.velocity.copy(velocity);
  sprite.material.color.set(color);
  sprite.material.rotation = Math.random() * Math.PI * 2;
  Object.assign(sprite, { age: 0, life, startSize, endSize, strength, spin: (Math.random() - 0.5) * 1.5, visible: true });
}

function updateSmoke(smoke, dt) {
  const slow = Math.exp(-dt * 3.2);
  for (const sprite of smoke.puffs) {
    if (!sprite.visible) continue;
    sprite.age += dt;
    const t = sprite.age / sprite.life;
    if (t >= 1) { sprite.visible = false; continue; }
    sprite.velocity.multiplyScalar(slow);  // smoke shoots out, then hangs
    sprite.velocity.y += dt * 0.25;        // ...and drifts upward
    sprite.position.addScaledVector(sprite.velocity, dt);
    sprite.position.x += dt * 0.25;        // carried on the same breeze as the grass
    sprite.scale.setScalar(sprite.startSize + (sprite.endSize - sprite.startSize) * (1 - (1 - t) ** 2));
    sprite.material.rotation += sprite.spin * dt;
    sprite.material.opacity = sprite.strength * Math.min(1, t * 40) * (1 - t) ** 1.3;
  }
}

// --- The gun in the game -----------------------------------------------------

export function createGun(scene, renderer) {
  const mesh = buildModel(renderer);
  mesh.visible = false;
  scene.add(mesh);

  // Muzzle flash: a bright burst and a brief light at the end of the barrel.
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
  );
  flash.position.copy(MUZZLE).z += 0.05;
  const flashLight = new THREE.PointLight(0xffc266, 0, 9);
  flashLight.position.copy(MUZZLE);
  mesh.add(flash, flashLight);

  // Bullet streak: a line from the barrel to where the shot lands.
  const streak = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineBasicMaterial({ color: 0xfff1c4, transparent: true, opacity: 0, fog: false })
  );
  streak.frustumCulled = false;
  scene.add(streak);

  return {
    mesh, flash, flashLight, streak,
    smoke: createSmoke(scene, 280),
    equipped: false,
    cooldown: 0,
    kick: 0,         // recoil, 1 right after a shot, fading to 0
    flashTime: 0,
    smoulder: 0,     // seconds the barrel keeps trailing smoke after a shot
    wispTimer: 0,
    audio: null,
  };
}

// The bang: a sharp crack of noise over a deep thump.
function playShot(gun) {
  try {
    gun.audio ??= new AudioContext();
    const ctx = gun.audio, now = ctx.currentTime;

    const length = Math.floor(ctx.sampleRate * 0.35);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.05));
    const crack = ctx.createBufferSource();
    crack.buffer = buffer;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.setValueAtTime(5200, now);
    tone.frequency.exponentialRampToValueAtTime(500, now + 0.3);
    const crackVolume = ctx.createGain();
    crackVolume.gain.value = 0.7;
    crack.connect(tone).connect(crackVolume).connect(ctx.destination);
    crack.start(now);

    const thump = ctx.createOscillator();
    thump.frequency.setValueAtTime(150, now);
    thump.frequency.exponentialRampToValueAtTime(38, now + 0.18);
    const thumpVolume = ctx.createGain();
    thumpVolume.gain.setValueAtTime(0.9, now);
    thumpVolume.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    thump.connect(thumpVolume).connect(ctx.destination);
    thump.start(now);
    thump.stop(now + 0.25);
  } catch {
    // No sound available: the gun still works silently.
  }
}

const muzzleSpot = new THREE.Vector3(), forward = new THREE.Vector3(), drift = new THREE.Vector3();
const scatter = new THREE.Vector3();
const spread = (amount) => scatter.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(amount * 2);

function findMuzzle(gun) {
  gun.mesh.updateWorldMatrix(true, false);
  gun.mesh.localToWorld(muzzleSpot.copy(gun.muzzle));
  forward.set(0, 0, 1).applyQuaternion(gun.mesh.quaternion);
}

// Fire one shot toward `target`. Returns false if the gun isn't ready yet.
export function fireGun(gun, target, hitsGround) {
  if (!gun.equipped || gun.cooldown > 0) return false;
  gun.cooldown = gun.interval;
  gun.kick = 1;
  gun.flashTime = 0.06;
  gun.smoulder = 1.6;
  gun.flash.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
  gun.flash.scale.setScalar(0.8 + Math.random() * 0.6);

  findMuzzle(gun);
  const points = gun.streak.geometry.attributes.position;
  points.setXYZ(0, muzzleSpot.x, muzzleSpot.y, muzzleSpot.z);
  points.setXYZ(1, target.x, target.y, target.z);
  points.needsUpdate = true;
  gun.streak.material.opacity = 0.9;

  // A jet of smoke blasts forward out of the barrel and billows...
  for (let i = 0; i < 18; i++) {
    const speed = 1 + Math.random() * 7;
    drift.copy(forward).multiplyScalar(speed).add(spread(0.8)).setY(drift.y + 0.3);
    puff(gun.smoke, muzzleSpot, drift, 0.14, 0.5 + Math.random() * 0.7, 1.6 + Math.random() * 1.8, SMOKE_COLOR, 0.85);
  }
  // ...with a little escaping sideways from the ejection port.
  for (let i = 0; i < 3; i++) {
    drift.set(-1, 0.6, -0.2).applyQuaternion(gun.mesh.quaternion).multiplyScalar(0.8 + Math.random()).add(spread(0.3));
    puff(gun.smoke, gun.mesh.position, drift, 0.06, 0.3, 1.0, SMOKE_COLOR, 0.5);
  }
  // Dirt thrown up where the bullet hits the ground.
  if (hitsGround) {
    for (let i = 0; i < 7; i++) {
      drift.set(0, 0.8 + Math.random() * 1.8, 0).add(spread(1.1));
      puff(gun.smoke, target, drift, 0.15, 0.6 + Math.random() * 0.6, 1.0 + Math.random() * 1.0, DUST_COLOR, 0.75);
    }
  }
  playShot(gun);
  return true;
}

const hand = new THREE.Vector3(), elbow = new THREE.Vector3();
const barrel = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3(), across = new THREE.Vector3();
const basis = new THREE.Matrix4();

// Each frame: keep the gun in the character's right hand and fade the effects.
export function updateGun(gun, player, dt) {
  gun.cooldown -= dt;
  gun.kick *= Math.exp(-dt * 9);
  gun.flashTime -= dt;
  gun.flash.visible = gun.flashTime > 0;
  gun.flashLight.intensity = gun.flashTime > 0 ? 40 : 0;
  gun.streak.material.opacity = Math.max(0, gun.streak.material.opacity - dt * 9);
  updateSmoke(gun.smoke, dt);

  const bones = player.bones;
  gun.mesh.visible = gun.equipped && !!bones;
  if (!gun.mesh.visible) return;

  // The barrel follows the line of the forearm, so the gun points at the ground
  // when the arm hangs down and at the target when the arm is raised to aim.
  bones.handR.getWorldPosition(hand);
  bones.foreArmR.getWorldPosition(elbow);
  barrel.copy(hand).sub(elbow).normalize();
  right.set(-1, 0, 0).applyQuaternion(player.group.quaternion);
  up.crossVectors(right, barrel).normalize();   // the top of the gun
  across.crossVectors(up, barrel);
  basis.makeBasis(across, up, barrel);
  gun.mesh.quaternion.setFromRotationMatrix(basis);
  gun.mesh.position.copy(hand).addScaledVector(barrel, 0.09).addScaledVector(up, -0.015);

  // After a shot, a thin trail of smoke keeps curling up from the barrel.
  gun.smoulder -= dt;
  gun.wispTimer -= dt;
  if (gun.smoulder > 0 && gun.wispTimer <= 0) {
    gun.wispTimer = 0.05;
    findMuzzle(gun);
    drift.set(0, 0.35 + Math.random() * 0.25, 0).add(spread(0.08));
    puff(gun.smoke, muzzleSpot, drift, 0.03, 0.16 + Math.random() * 0.12, 1.0 + Math.random() * 0.7, SMOKE_COLOR, 0.45 * Math.min(1, gun.smoulder));
  }
}

// --- The different guns he can carry ------------------------------------------

// interval: seconds between shots. damage: out of 100. range: metres. muzzle: where the bullet leaves.
const WEAPON_STATS = {
  pistol: { interval: 0.32, damage: 34, range: 300, muzzle: [0, 0.099, 0.186] },
  shotgun: { interval: 0.9, damage: 100, range: 25, muzzle: [0, 0.09, 0.82] },   // one shot, but only up close
  rifle: { interval: 1.2, damage: 100, range: 300, muzzle: [0, 0.09, 0.95] },    // one shot at any distance
};

// A long gun held by its grip: the barrel points along +Z.
function makeLongGun(kind) {
  const group = new THREE.Group();
  const black = new THREE.MeshStandardMaterial({ color: 0x161718, roughness: 0.45, metalness: 0.4 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x8f9396, roughness: 0.35, metalness: 0.7 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a4f2c, roughness: 0.6 });
  const part = (material, w, h, d, y, z, tilt = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(0, y, z);
    mesh.rotation.x = tilt;
    mesh.castShadow = true;
    group.add(mesh);
  };
  if (kind === 'shotgun') {
    part(black, 0.045, 0.08, 0.3, 0.07, 0.05);       // receiver
    part(steel, 0.028, 0.028, 0.62, 0.09, 0.5);      // barrel
    part(black, 0.028, 0.028, 0.46, 0.055, 0.42);    // magazine tube
    part(black, 0.05, 0.05, 0.18, 0.055, 0.4);       // pump grip
    part(black, 0.04, 0.1, 0.3, 0.035, -0.24, 0.12); // stock
    part(black, 0.04, 0.1, 0.045, 0, 0, -0.2);       // pistol grip
  } else {
    part(wood, 0.045, 0.06, 0.62, 0.06, 0.1);        // wooden fore-end
    part(wood, 0.045, 0.12, 0.3, 0.03, -0.3, 0.14);  // butt
    part(steel, 0.024, 0.024, 0.66, 0.09, 0.61);     // barrel
    part(black, 0.042, 0.042, 0.28, 0.145, 0.1);     // scope
    part(black, 0.03, 0.03, 0.03, 0.115, 0.02);
    part(black, 0.03, 0.03, 0.03, 0.115, 0.18);
  }
  return group;
}

// Switch which gun is in his hand.
export function setWeapon(gun, kind) {
  if (!gun.models) {
    gun.models = {
      pistol: gun.mesh.children.filter((part) => part !== gun.flash && part !== gun.flashLight),
      shotgun: [makeLongGun('shotgun')],
      rifle: [makeLongGun('rifle')],
    };
    gun.mesh.add(gun.models.shotgun[0], gun.models.rifle[0]);
  }
  for (const [name, parts] of Object.entries(gun.models)) for (const part of parts) part.visible = name === kind;
  const stats = WEAPON_STATS[kind];
  Object.assign(gun, { kind, interval: stats.interval, damage: stats.damage, range: stats.range, muzzle: new THREE.Vector3(...stats.muzzle) });
  gun.flash.position.copy(gun.muzzle).z += 0.05;
  gun.flashLight.position.copy(gun.muzzle);
}

// A wisp of smoke drifting up from a spot (used for cigarettes).
export function emitSmoke(gun, position, size = 1) {
  drift.set((Math.random() - 0.5) * 0.2, 0.35, (Math.random() - 0.5) * 0.2);
  puff(gun.smoke, position, drift, 0.04 * size, 0.3 * size, 1.8, SMOKE_COLOR, 0.4);
}

// A brief, fine red mist where a bullet strikes someone.
export function emitBloodMist(gun, position) {
  for (let i = 0; i < 3; i++) {
    drift.set((Math.random() - 0.5) * 0.9, 0.2 + Math.random() * 0.4, (Math.random() - 0.5) * 0.9);
    puff(gun.smoke, position, drift, 0.03, 0.14 + Math.random() * 0.1, 0.35, 0x4a0605, 0.45);
  }
}
