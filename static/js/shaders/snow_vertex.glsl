#version 300 es
precision highp float;

in vec3 aOffset;

uniform vec3 uCamPos;
uniform vec2 uResolution;
uniform float uFlakeSize;
uniform float uMinFlakeSize;
uniform float uDepthFade;
uniform float uFarPlane;
uniform float uDensity;
uniform float uTime;

#define M1 1597334677U
#define M2 3812015801U
#define M3 3299493293U
#define F0 2.3283064e-10
#define hash(n) (n * (n ^ (n >> 15)))
#define coord3(p) (uvec3(p).x * M1 ^ uvec3(p).y * M2 ^ uvec3(p).z * M3)

const vec3 camK = vec3(0.57735027, 0.57735027, 0.57735027);
const vec3 camI = vec3(0.70710678, 0.0, -0.70710678);
const vec3 camJ = vec3(-0.40824829, 0.81649658, -0.40824829);

vec3 hash3(uint n) {
  uvec3 hashed = hash(n) * uvec3(1U, 511U, 262143U);
  return vec3(hashed) * F0;
}

out float vIntensity;
out float vVariantDummy;

void main() {
  vec3 fpos = floor(uCamPos) + aOffset;
  uint cellCoord = coord3(fpos);
  float cellHash = hash3(cellCoord).x;

  // cull cells with no flake
  if (cellHash >= uDensity) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0); // push outside clip volume
    gl_PointSize = 0.0;
    vIntensity = 0.0;
    return;
  }

  vec3 h = hash3(cellCoord);
  vec3 timeAnim = uTime * 0.1 * vec3(7.0, 8.0, 5.0);
  vec3 sinArg1 = fpos.yzx * 0.073;
  vec3 sinArg2 = fpos.zxy * 0.27;
  vec3 flakePos = 0.5 - 0.5 * cos(4.0 * sin(sinArg1) + 4.0 * sin(sinArg2) + 2.0 * h + timeAnim);
  flakePos = flakePos * 0.8 + 0.1 + fpos;

  vec3 rel = flakePos - uCamPos;
  float depth = dot(rel, camK);
  float viewX = dot(rel, camI);
  float viewY = dot(rel, camJ);

  if (depth <= 0.01 || depth > uFarPlane) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vIntensity = 0.0;
    return;
  }

  float halfInvResX = 0.5 / uResolution.x;
  float flakeSize = max(uFlakeSize, uMinFlakeSize * depth * halfInvResX);
  float flakeSizeRatio = uFlakeSize / flakeSize;

  vIntensity = exp2(-depth * (1.0 / uDepthFade)) * min(1.0, flakeSizeRatio * flakeSizeRatio);

  float ndcX = viewX / depth;
  float ndcY = viewY / depth;
  float aspect = uResolution.x / uResolution.y;
  gl_Position = vec4(ndcX * 2.0, ndcY * 2.0 * aspect, 0.0, 1.0) * depth;
  gl_Position.w = depth;
  gl_Position.z = 0.0;

  gl_PointSize = max(uMinFlakeSize, 2.0 * uFlakeSize * uResolution.x / depth);
}
