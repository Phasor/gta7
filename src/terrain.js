// The ground under the grass: soil showing between the tufts, and bare dirt
// patches where the grass has worn away.
//
// The "where is the dirt" pattern is shared with the grass blades (grass.js),
// so blades thin out exactly where the ground turns to dirt.
import * as THREE from 'three';
import { PALETTE } from './look.js';

// Shader code shared by the ground and the grass.
export const TERRAIN_GLSL = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  // 0 = fully grassed, 1 = bare dirt. Big irregular patches with ragged edges.
  float dirtAmount(vec2 p) {
    float n = noise(p * 0.035 + 11.0) * 0.55 + noise(p * 0.11 + 3.0) * 0.3 + noise(p * 0.45) * 0.15;
    return smoothstep(0.54, 0.66, n);
  }
`;

// Teach a standard three.js material to paint soil and dirt onto the ground.
export function addDirt(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.dirtDark = { value: new THREE.Color(PALETTE.dirtDark) };
    shader.uniforms.dirtLight = { value: new THREE.Color(PALETTE.dirtLight) };
    shader.uniforms.pebble = { value: new THREE.Color(PALETTE.pebble) };

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vGroundXZ;')
      .replace('#include <begin_vertex>',
        '#include <begin_vertex>\nvGroundXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec2 vGroundXZ;
        uniform vec3 dirtDark, dirtLight, pebble;
        ${TERRAIN_GLSL}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec2 g = vGroundXZ;
          // Soil: mottled browns, fine grit, and a scattering of pale pebbles.
          float mottle = noise(g * 1.3) * 0.5 + noise(g * 5.0) * 0.3 + noise(g * 19.0) * 0.2;
          vec3 soil = mix(dirtDark, dirtLight, mottle);
          soil *= 0.85 + 0.3 * noise(g * 60.0);
          soil = mix(soil, pebble, smoothstep(0.80, 0.86, noise(g * 14.0 + 5.0)) * 0.7);

          // Bare patches, with edges broken up so they don't look drawn on.
          float bare = smoothstep(0.25, 0.75, dirtAmount(g) + (mottle - 0.5) * 0.5);
          // Everywhere else, a little soil still shows through between the tufts.
          float specks = smoothstep(0.5, 0.75, noise(g * 2.3 + 40.0)) * 0.45;

          diffuseColor.rgb = mix(diffuseColor.rgb, soil, max(bare, specks));
        }`);
  };
  return material;
}
