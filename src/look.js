// The game's look: a sun-faded, vintage-film colour palette.
// Everything visual that sets the mood lives here so it's easy to tweak.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const PALETTE = {
  skyTop: 0x2c5d94,      // deep afternoon blue
  skyMid: 0x8fbcd6,      // soft powder blue
  skyHorizon: 0xecdcb8,  // warm cream haze
  sunGlow: 0xffd9a0,
  sunLight: 0xffdfae,    // golden sunlight
  shade: 0xb9cfe0,       // cool light from the sky
  bounce: 0x8c7a4e,      // warm light bounced off the ground
  grass: '#8b9a50',      // sun-dried olive (the ground under the blades)
  grassRoot: 0x5d7236,   // shaded base of each blade
  dirtDark: 0x5a4630,    // damp soil
  dirtLight: 0x92784f,   // dry, sun-baked dirt
  pebble: 0xb0a690,      // small pale stones
  grassLush: 0x6f8c3c,   // healthy green body of a blade
  grassTip: 0xa8b85e,    // sunlit blade tips
  grassDry: 0xc9b76a,    // straw-coloured dry blades
  grassBlades: ['#7a8c45', '#96a558', '#a3ae60', '#80934a', '#b5b068'],
  jacket: 0xc4573a,      // terracotta
  jeans: 0x4f7482,       // faded teal denim
  shoes: 0xefe6d0,       // cream
  skin: 0xc98f65,
  hair: 0x2a1b12,
};

// --- Sky: gradient dome with a soft sun and drifting clouds -----------------
export function createSky(sunDirection) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(PALETTE.skyTop) },
      mid: { value: new THREE.Color(PALETTE.skyMid) },
      horizon: { value: new THREE.Color(PALETTE.skyHorizon) },
      glow: { value: new THREE.Color(PALETTE.sunGlow) },
      sunDir: { value: sunDirection.clone().normalize() },
      time: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top, mid, horizon, glow, sunDir;
      uniform float time;
      varying vec3 vDir;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
                   mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
        return v;
      }

      void main() {
        vec3 d = normalize(vDir);
        float h = max(d.y, 0.0);

        // Cream haze at the horizon rising into deep blue overhead.
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.16, h));
        col = mix(col, top, smoothstep(0.08, 0.85, h));

        // Soft sun disc with a wide warm glow.
        float s = max(dot(d, sunDir), 0.0);
        col += glow * (pow(s, 600.0) * 3.0 + pow(s, 12.0) * 0.25);

        // Puffy clouds, fading out toward the horizon.
        vec2 uv = d.xz / (d.y + 0.25) * 1.4 + time * 0.004;
        float c = smoothstep(0.52, 0.78, fbm(uv));
        vec3 cloud = mix(vec3(1.0, 0.97, 0.9), vec3(0.82, 0.8, 0.82), fbm(uv * 2.0 + 7.0) * 0.6);
        col = mix(col, cloud, c * smoothstep(0.02, 0.3, d.y) * 0.9);

        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), material);
  sky.frustumCulled = false;
  return sky;
}

// --- Vintage film grade, applied to the finished picture --------------------
const VintageShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float time;
    varying vec2 vUv;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float luma = dot(c, vec3(0.299, 0.587, 0.114));

      c = mix(vec3(luma), c, 0.84);                       // slightly faded colour
      vec3 coolShadows = vec3(0.90, 1.00, 1.07);          // teal in the shadows
      vec3 warmHighlights = vec3(1.09, 1.03, 0.88);       // gold in the highlights
      c *= mix(coolShadows, warmHighlights, smoothstep(0.0, 0.9, luma));
      c = c * 0.93 + 0.05;                                // lifted, milky blacks

      vec2 d = vUv - 0.5;
      c *= 1.0 - dot(d, d) * 0.6;                         // darkened corners
      c += (hash(vUv * 900.0 + fract(time) * 50.0) - 0.5) * 0.04; // film grain

      gl_FragColor = vec4(c, 1.0);
    }`,
};

export function createComposer(renderer, scene, camera) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, {
    type: THREE.HalfFloatType,
    samples: 4, // smooth edges
  });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new OutputPass());
  const vintage = new ShaderPass(VintageShader);
  composer.addPass(vintage);
  return { composer, vintage };
}
