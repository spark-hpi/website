export const pageTextureVert = /* glsl */`
varying vec3 vLocalPos;
varying vec3 vNormal;
void main() {
  vLocalPos = position;
  vNormal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
}
`;

export const pageTextureFrag = /* glsl */`
uniform vec3 uColor;
uniform float uLineSpacing;
uniform float uLineWidth;
varying vec3 vLocalPos;
varying vec3 vNormal;

float verticalLines(vec2 uv) {
  float s = fract(uv.x / uLineSpacing);
  float d = abs(s - 0.5);
  return smoothstep(uLineWidth, uLineWidth + 0.03, d);
}

void main() {
  vec3 n = abs(vNormal);
  vec2 uv;
  if (n.x > n.y && n.x > n.z) uv = vLocalPos.zy;
  else if (n.y > n.z)          uv = vLocalPos.xz;
  else                          uv = vLocalPos.xy;
  float m = verticalLines(uv);
  vec3 col = mix(uColor, uColor * 0.55, 1.0 - m);
  gl_FragColor = vec4(col, 1.0);
}
`;
