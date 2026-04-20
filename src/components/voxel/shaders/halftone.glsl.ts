import { pageTextureVert } from "./page-texture.glsl";

export const halftoneVert = pageTextureVert;

export const halftoneFrag = /* glsl */`
uniform vec3 uColor;
uniform vec3 uLightDir;
uniform float uDotSpacing;
varying vec3 vLocalPos;
varying vec3 vNormal;

void main() {
  vec3 n = abs(vNormal);
  vec2 uv;
  if (n.x > n.y && n.x > n.z) uv = vLocalPos.zy;
  else if (n.y > n.z)          uv = vLocalPos.xz;
  else                          uv = vLocalPos.xy;

  vec2 g = fract(uv / uDotSpacing) - 0.5;
  float dist = length(g);

  float shade = clamp(dot(normalize(vNormal), normalize(uLightDir)) * 0.5 + 0.5, 0.0, 1.0);
  float radius = mix(0.1, 0.45, shade);

  float m = smoothstep(radius, radius + 0.05, dist);
  vec3 col = mix(uColor, uColor * 0.3, 1.0 - m);
  gl_FragColor = vec4(col, 1.0);
}
`;
