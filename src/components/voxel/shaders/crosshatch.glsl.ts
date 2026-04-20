import { pageTextureVert } from "./page-texture.glsl";

export const crosshatchVert = pageTextureVert;

export const crosshatchFrag = /* glsl */`
uniform vec3 uColor;
uniform float uSpacing;
uniform float uWidth;
varying vec3 vLocalPos;
varying vec3 vNormal;

float stripe(vec2 uv, float angle) {
  float s = dot(uv, vec2(cos(angle), sin(angle)));
  float f = fract(s / uSpacing);
  return smoothstep(uWidth, uWidth + 0.05, abs(f - 0.5));
}

void main() {
  vec3 n = abs(vNormal);
  vec2 uv;
  if (n.x > n.y && n.x > n.z) uv = vLocalPos.zy;
  else if (n.y > n.z)          uv = vLocalPos.xz;
  else                          uv = vLocalPos.xy;
  float a = stripe(uv, 0.9);
  float b = stripe(uv, -0.9);
  float m = min(a, b);
  vec3 col = mix(uColor, uColor * 0.45, 1.0 - m);
  gl_FragColor = vec4(col, 1.0);
}
`;
