// 3D grass: hundreds of thousands of individual blades that sway in the wind.
//
// Drawing every blade on the whole map at full detail would be millions of
// blades and far too slow. So the grass is drawn in three rings around the
// player: fine blades up close, then wider and sparser blades further out.
// From a distance a wide blade looks the same as a clump of fine ones.
// As the player walks, blades that fall behind are reused in front.
import * as THREE from 'three';
import { PALETTE } from './look.js';
import { TERRAIN_GLSL } from './terrain.js';

const LAYERS = [
  // size: width of the square this ring covers (metres).
  // fade: [in from, in to, out from, out to] distances in metres. Blades of one
  // ring thin out one by one over the same stretch where the next ring's blades
  // appear, so the rings blend together with no visible band.
  { size: 60,  blades: 180000, width: 0.05, height: 1.0,  fade: [0, 0, 9, 29] },
  { size: 170, blades: 220000, width: 0.14, height: 1.1,  fade: [7, 29, 38, 83] },
  { size: 640, blades: 300000, width: 0.5,  height: 1.3,  fade: [36, 83, 190, 310] },
];

// Rectangles where no grass grows (under buildings, driveways and paths).
// Each is (min x, min z, max x, max z); whoever builds something fills one in.
export const clearings = [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()];

const SEGMENTS = 4; // pieces per blade: more pieces give a smoother curve

// One blade: a strip that narrows to a point. y runs 0 (root) to 1 (tip).
function bladeShape(width) {
  const positions = [], index = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const t = i / SEGMENTS;
    const half = (width / 2) * (1 - t * t * 0.55);
    positions.push(-half, t, 0, half, t, 0);
  }
  positions.push(0, 1, 0);
  for (let i = 0; i < SEGMENTS - 1; i++) {
    const a = i * 2;
    index.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
  }
  const last = (SEGMENTS - 1) * 2;
  index.push(last, last + 1, last + 2);
  return { positions, index };
}

function createLayer({ size, blades, width, height, fade }, sunDirection, fog) {
  const shape = bladeShape(width);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(shape.positions, 3));
  geometry.setIndex(shape.index);
  geometry.instanceCount = blades;

  const spots = new Float32Array(blades * 2); // where each blade grows
  const rnd = new Float32Array(blades * 4);   // per-blade randomness
  for (let i = 0; i < blades; i++) {
    spots[i * 2] = Math.random() * size;
    spots[i * 2 + 1] = Math.random() * size;
    rnd[i * 4] = Math.random();     // facing
    rnd[i * 4 + 1] = Math.random(); // height
    rnd[i * 4 + 2] = Math.random(); // lean direction
    rnd[i * 4 + 3] = Math.random(); // colour
  }
  geometry.setAttribute('spot', new THREE.InstancedBufferAttribute(spots, 2));
  geometry.setAttribute('rnd', new THREE.InstancedBufferAttribute(rnd, 4));

  const material = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      center: { value: new THREE.Vector3() },
      areaSize: { value: size },
      fadeRange: { value: new THREE.Vector4(...fade) },
      tallness: { value: height },
      time: { value: 0 },
      clearings: { value: clearings },
      sunDir: { value: sunDirection.clone().normalize() },
      sunColor: { value: new THREE.Color(PALETTE.sunLight) },
      rootColor: { value: new THREE.Color(PALETTE.grassRoot) },
      lushColor: { value: new THREE.Color(PALETTE.grassLush) },
      tipColor: { value: new THREE.Color(PALETTE.grassTip) },
      dryColor: { value: new THREE.Color(PALETTE.grassDry) },
      hazeColor: { value: fog.color },
      hazeRange: { value: new THREE.Vector2(fog.near, fog.far) },
    },
    vertexShader: /* glsl */ `
      uniform vec3 center;
      uniform vec4 fadeRange;
      uniform float areaSize, tallness, time;
      uniform vec4 clearings[4];
      attribute vec2 spot;
      attribute vec4 rnd;
      varying float vHeight;   // 0 at the root, 1 at the tip
      varying float vDry;      // 0 lush green, 1 dry straw
      varying float vGust;     // how hard the wind is pushing this blade
      varying vec3 vNormal;
      varying vec3 vWorld;

      ${TERRAIN_GLSL}

      void main() {
        // Wrap each blade into the square around the player.
        vec2 rel = mod(spot - center.xz + areaSize * 0.5, areaSize) - areaSize * 0.5;
        vec2 ground = center.xz + rel;
        float dist = length(rel);

        // Every blade has its own distance at which it appears and disappears.
        // It stays full height in between, so a ring never shows as a band of short grass.
        float pick = fract(rnd.x * 91.7 + rnd.y * 37.3);
        float outAt = mix(fadeRange.z, fadeRange.w, pick);
        float fade = 1.0 - smoothstep(outAt - 3.0, outAt, dist);
        if (fadeRange.y > 0.0) {
          float inAt = mix(fadeRange.x, fadeRange.y, fract(pick * 7.13 + 0.31));
          fade *= smoothstep(inAt - 3.0, inAt, dist);
        }

        // Natural patches: big soft areas of lush grass and of shorter, drier grass,
        // with smaller tufts inside them. Irregular, like a real field.
        float patches = noise(ground * 0.045) * 0.65 + noise(ground * 0.16 + 31.0) * 0.35;
        float tuft = noise(ground * 1.1 + 7.0);
        float lush = smoothstep(0.25, 0.75, patches);
        // Every blade gets its own length and width, from short thin wisps to
        // long broad blades, plus the odd extra-tall stalk poking above the rest.
        float sizeA = fract(rnd.y * 53.7 + rnd.w * 17.1);
        float sizeB = fract(rnd.z * 71.3 + rnd.x * 29.9);
        float bladeLength = 0.07 + pow(rnd.y, 1.6) * 0.62 + step(0.94, sizeB) * 0.35;
        float bladeWidth = mix(0.4, 2.0, sizeA * sizeA);
        float tall = (bladeLength + lush * 0.18 + tuft * 0.1) * tallness * fade;

        // On bare dirt only a few stunted, dried-out blades survive.
        float dirt = dirtAmount(ground);
        tall *= 1.0 - dirt * mix(0.8, 1.0, sizeB);

        // Nothing grows where something has been built.
        for (int i = 0; i < 4; i++) {
          vec4 c = clearings[i];
          if (ground.x > c.x && ground.x < c.z && ground.y > c.y && ground.y < c.w) tall = 0.0;
        }

        float t = position.y;
        float facing = rnd.x * 6.2832;
        vec2 face = vec2(cos(facing), sin(facing));
        float across = position.x * bladeWidth;
        vec3 p = vec3(across * face.x, t * tall, across * face.y);

        // Each blade droops its own way, and gusts of wind roll across the field.
        float lean = rnd.z * 6.2832;
        float gust = sin(time * 1.3 + ground.x * 0.22 + ground.y * 0.16) * 0.55
                   + sin(time * 2.6 + ground.x * 0.7 - ground.y * 0.5) * 0.25
                   + noise(ground * 0.3 + time * 0.6) * 0.4 - 0.2;
        vec2 bend = vec2(cos(lean), sin(lean)) * (0.2 + rnd.w * 0.3) + vec2(0.9, 0.35) * gust * 0.35;
        float curve = t * t; // straight at the root, curling over toward the tip
        p.xz += bend * curve * tall;
        p.y -= dot(bend, bend) * curve * tall * 0.35; // a bent blade is also a little lower

        // Shade the field as a soft surface: mostly "up", partly each blade's own face.
        vec3 flat_ = vec3(-face.y, 0.0, face.x);
        vNormal = normalize(mix(flat_, vec3(bend.x * curve, 1.0, bend.y * curve), 0.55));

        vHeight = t;
        vDry = clamp(1.0 - lush + (rnd.w - 0.5) * 0.5 + dirt * 0.8, 0.0, 1.0);
        vGust = gust;
        vWorld = vec3(ground.x + p.x, p.y, ground.y + p.z);
        gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 sunDir, sunColor, rootColor, lushColor, tipColor, dryColor, hazeColor;
      uniform vec2 hazeRange;
      varying float vHeight;
      varying float vDry;
      varying float vGust;
      varying vec3 vNormal;
      varying vec3 vWorld;

      void main() {
        vec3 toEye = cameraPosition - vWorld;
        float dist = length(toEye);
        vec3 v = toEye / dist;
        vec3 n = normalize(vNormal);
        if (dot(n.xz, v.xz) < 0.0) n.xz = -n.xz; // blades look the same from both sides

        // Colour: dark at the soil, rich green up the blade, paler at the tip.
        vec3 body = mix(lushColor, dryColor, vDry * 0.3);
        vec3 tip = mix(tipColor, dryColor, vDry * 0.4);
        vec3 col = mix(rootColor, body, smoothstep(0.0, 0.45, vHeight));
        col = mix(col, tip, smoothstep(0.45, 1.0, vHeight));

        // Light: soft sun shading, with little light reaching down between the blades.
        float sun = dot(n, sunDir) * 0.5 + 0.5;
        float depth = mix(0.38, 1.0, smoothstep(0.0, 0.7, vHeight));
        vec3 lit = col * depth * (0.45 + 0.6 * sun);

        // Sunlight glows through thin blades when you look toward the sun...
        float through = pow(max(dot(-v, sunDir), 0.0), 2.5) * vHeight;
        lit += tip * sunColor * through * 0.5;
        // ...and glints off them, shimmering as the wind moves across the field.
        float glint = pow(max(dot(n, normalize(sunDir + v)), 0.0), 28.0);
        lit += sunColor * glint * vHeight * (0.05 + max(vGust, 0.0) * 0.1);

        // Distance haze, matching the rest of the world.
        lit = mix(lit, hazeColor, smoothstep(hazeRange.x, hazeRange.y, dist));

        gl_FragColor = vec4(lit, 1.0);
      }`,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false; // blades are placed by the shader, so three.js can't tell where they are
  return mesh;
}

// sunDirection: where the sun is. fog: the scene's fog, so far grass hazes out the same way.
export function createGrass(sunDirection, fog) {
  const group = new THREE.Group();
  for (const layer of LAYERS) group.add(createLayer(layer, sunDirection, fog));
  return group;
}

export function updateGrass(grass, playerPosition, time) {
  for (const layer of grass.children) {
    layer.material.uniforms.center.value.copy(playerPosition);
    layer.material.uniforms.time.value = time;
  }
}
