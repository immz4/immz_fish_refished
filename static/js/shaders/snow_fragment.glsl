#version 300 es
precision mediump float;

in float vIntensity;
out vec4 fragColor;

uniform vec3 uColor;
uniform float uBrightness;
uniform float uGamma;
uniform float uVariant;

float sdRoundBox(vec2 p, vec2 b, vec4 r) {
  r.xy = (p.x > 0.0) ? r.xy : r.zw;
  r.x  = (p.y > 0.0) ? r.x  : r.y;
  vec2 q = abs(p) - b + r.x;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r.x;
}

float sdBox(vec2 p, vec2 b) {
  vec2 q = abs(p) - b;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0));
}

float fishSDF(vec2 p) {
  float d = abs(p.y - 19.5); // mirror top/bottom

  float body = length(vec2(p.x - clamp(p.x, 19.5, 26.0), p.y - 19.5)) - 19.5;

  float lobe = sdRoundBox(vec2(p.x - 62.5, d - 9.75), vec2(9.5, 9.75), vec4(0.0, 9.5, 9.5, 0.0));

  float neckBox = sdBox(vec2(p.x - 47.0, d - 5.5), vec2(6.0, 5.5));
  float neckCut = length(vec2(p.x - 53.0, d - 11.0)) - 10.5;
  float neck = max(neckBox, -neckCut);

  float fish = min(body, min(lobe, neck));

  float eye = length(p - vec2(18.5, 19.5)) - 5.5;
  return max(fish, -eye);
}

float fishDist(vec2 uv) {
  vec2 p = vec2(36.0 + uv.x * 36.0, 19.5 + uv.y * 36.0);
  return fishSDF(p) > 0.0 ? 2.0 : 0.0;
}

void main() {
  if (vIntensity <= 0.0) discard;

  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float dist;
  if (uVariant < 0.5) {
    dist = max(abs(uv.x), abs(uv.y));
  } else if (uVariant < 1.5) {
    dist = length(uv);
  } else {
    dist = fishDist(uv);
  }
  if (dist > 1.0) discard;

  float intensity = vIntensity * uBrightness;
  fragColor = vec4(uColor * pow(intensity, uGamma), 1.0);
}
