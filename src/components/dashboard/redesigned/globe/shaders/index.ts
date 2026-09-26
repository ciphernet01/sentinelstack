export const earthVertexShader = /* glsl */ `
attribute float aSize;
attribute float aSeed;

uniform float uTime;
uniform float uPixelRatio;

varying float vSeed;
varying float vDepth;

void main() {
  vSeed = aSeed;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  float depthScale = clamp(1.0 / max(0.35, -mvPosition.z), 0.0, 2.2);
  gl_PointSize = aSize * (5.2 + sin(uTime * 0.55 + aSeed * 8.0) * 0.25) * uPixelRatio * depthScale;
  gl_Position = projectionMatrix * mvPosition;
  vDepth = depthScale;
}
`;

export const earthFragmentShader = /* glsl */ `
uniform float uTime;
uniform vec3 uBaseColor;
uniform vec3 uHighlightColor;

varying float vSeed;
varying float vDepth;

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float distanceToCenter = length(uv);
  if (distanceToCenter > 0.5) discard;

  float core = smoothstep(0.48, 0.02, distanceToCenter);
  float halo = smoothstep(0.50, 0.20, distanceToCenter);
  float shimmer = 0.93 + 0.07 * sin(uTime * 0.65 + vSeed * 20.0);
  vec3 color = mix(uBaseColor, uHighlightColor, core);
  float alpha = (core * 0.92 + halo * 0.16) * shimmer;
  alpha *= clamp(0.50 + vDepth * 0.32, 0.44, 1.0);
  gl_FragColor = vec4(color, alpha);
}
`;

export const atmosphereVertexShader = /* glsl */ `
varying vec3 vNormal;
varying vec3 vWorldPosition;
void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

export const atmosphereFragmentShader = /* glsl */ `
uniform vec3 uCameraPosition;
uniform vec3 uColor;
uniform float uIntensity;
varying vec3 vNormal;
varying vec3 vWorldPosition;
void main() {
  vec3 viewDirection = normalize(uCameraPosition - vWorldPosition);
  float fresnel = pow(1.0 - max(dot(normalize(vNormal), viewDirection), 0.0), 3.2);
  float alpha = fresnel * uIntensity;
  gl_FragColor = vec4(uColor, alpha);
}
`;

export const nodeFragmentShader = /* glsl */ `
uniform vec3 uColor;
void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float d = length(uv);
  if (d > 0.5) discard;
  float core = smoothstep(0.32, 0.02, d);
  float halo = smoothstep(0.5, 0.18, d);
  gl_FragColor = vec4(uColor, core * 0.95 + halo * 0.18);
}
`;
