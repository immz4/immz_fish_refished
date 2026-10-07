"use strict"

const SNOW_VARIANT = Object.seal({
  SQUARE: 0,
  ROUND: 1,
  FIH: 1.5,
})

const PARAMS = Object.seal({
  RADIUS: 20,
  PIXEL_RESOLUTION: 350,
  FLAKE_SIZE: 0.04,
  MIN_FLAKE_SIZE: 3.4,
  SPEED: 1.5,
  DEPTH_FADE: 0.25,
  FAR_PLANE: 8,
  BRIGHTNESS: 1.55,
  GAMMA: 0.4545,
  DENSITY: 0.6,
  DIRECTION: 360,
  VARIANT: SNOW_VARIANT.FIH,
  COLOR: [1, 0.47, 0]
})

const SNOW_VERTEX = `#version 300 es
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
}`

const SNOW_FRAGMENT = `#version 300 es
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
}`

const SNOW_UNIFORMS = ['uCamPos','uResolution','uFlakeSize','uMinFlakeSize','uDepthFade','uFarPlane','uDensity',
 'uTime','uColor','uBrightness','uGamma','uVariant']

const BLIT_VERTEX = `#version 300 es
const vec2 verts[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
out vec2 vUv;
void main() {
  vec2 p = verts[gl_VertexID];
  vUv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}`

const BLIT_FRAGMENT = `#version 300 es
precision mediump float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uTex;
void main() {
  fragColor = texture(uTex, vUv);
}`

const BLIT_UNIFORMS = ['uTex']

/**
 * @param {WebGL2RenderingContext} gl
 * @param {GLenum} type
 * @param {string} source
 * @returns {WebGLShader}
 */
function compile(gl, type, source) {
  const shader = gl.createShader(type)

  if (!shader) throw new Error("Shader creation error")

  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const kind = type === gl.VERTEX_SHADER ? 'Vertex' : 'Fragment'
    throw new Error(`${kind} shader compile error.\n\n${gl.getShaderInfoLog(shader)}`)
  }

  return shader
}

/**
 * @param {WebGL2RenderingContext} gl
 * @param {string} vsSrc
 * @param {string} fsSrc
 * @returns {WebGLProgram}
 */
function linkProgram(gl, vsSrc, fsSrc) {
  const vs = compile(gl, gl.VERTEX_SHADER, vsSrc)
  const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc)
  const prog = gl.createProgram()

  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)

  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`Program link error. \n\n ${gl.getProgramInfoLog(prog)}`)
  }

  return prog
}

/**
 * @param {WebGL2RenderingContext} gl
 * @param {WebGLProgram} program
 * @param {string[]} uniformArr
 * @returns {Record<string, WebGLUniformLocation>}
 */
function getUniformLocation(gl, program, uniformArr) {
  const uniforms = {}
  uniformArr.forEach(n => uniforms[n] = gl.getUniformLocation(program, n))
  return uniforms
}

/**
 * @param {WebGL2RenderingContext} gl
 * @param {number} radius
 */
function buildOffsets(gl, radius) {
  const offsets = []
  const r2 = radius ** 2

  for (let x = -radius; x <= radius; x++) {
    for (let y = -radius; y <= radius; y++) {
      for (let z = -radius; z <= radius; z++) {
        if (x * x + y * y + z * z <= r2) offsets.push(x, y, z)
      }
    }
  }

  const pointCount = offsets.length / 3
  console.log(`Candidate points: ${pointCount}`)

  const offsetBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, offsetBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(offsets), gl.STATIC_DRAW)

  return {offsetBuffer, pointCount}
}

/**
 * @param {WebGL2RenderingContext} gl
 * @param {HTMLCanvasElement} canvas
 */
function buildFBO(gl, canvas) {
  const pixelSize = Math.max(1, Math.round(canvas.width / PARAMS.PIXEL_RESOLUTION))
  const lowW = Math.max(1, Math.round(canvas.width / pixelSize))
  const lowH = Math.max(1, Math.round(canvas.height / pixelSize))

  const fboTex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, fboTex)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, lowW, lowH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

  const fbo = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fboTex, 0)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)

  console.log(`Low-resolution framebuffer: ${lowW}x${lowH}`)

  return { lowW, lowH, fboTex, fbo }
}

function main() {
  /** @type {HTMLCanvasElement?} */
  const canvas = document.getElementById("background")

  if (!canvas) throw new Error("Background canvas not found")

  /** @type {WebGL2RenderingContext?} */
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, premultipliedAlpha: false })

  if (!gl) throw new Error("No WebGL2 support")

  const snowProgram = linkProgram(gl, SNOW_VERTEX, SNOW_FRAGMENT)
  gl.useProgram(snowProgram)
  const snowUnis = getUniformLocation(gl, snowProgram, SNOW_UNIFORMS)

  const blitProgram = linkProgram(gl, BLIT_VERTEX, BLIT_FRAGMENT)
  gl.useProgram(blitProgram)
  const blitUnis = getUniformLocation(gl, blitProgram, BLIT_UNIFORMS)

  const {offsetBuffer, pointCount} = buildOffsets(gl, PARAMS.RADIUS)

  let fbo, fboTex, lowW = 1, lowH = 1
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = Math.floor(window.innerWidth * dpr)
    const h = Math.floor(window.innerHeight * dpr)

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h

      if (fboTex) gl.deleteTexture(fboTex)
      if (fbo) gl.deleteFramebuffer(fbo)

      const buildRes = buildFBO(gl, canvas)

      fboTex = buildRes.fboTex
      fbo = buildRes.fbo
      lowW = buildRes.lowW
      lowH = buildRes.lowH
    }
  }

  window.addEventListener("resize", resize)
  resize()

  gl.enable(gl.BLEND)
  gl.blendFunc(gl.ONE, gl.ONE) // Additive blending
  gl.disable(gl.DEPTH_TEST)

  const start = performance.now()
  let lastFpsT = start, frames = 0, aOffsetLoc = -1

  const frame = () => {
    requestAnimationFrame(frame)
    if (!snowProgram) return
    if (aOffsetLoc < 0) aOffsetLoc = gl.getAttribLocation(snowProgram, 'aOffset')

    const t = (performance.now() - start) * 0.001
    const timeSpeed = t * PARAMS.SPEED
    const dirRad = PARAMS.DIRECTION * Math.PI / 180
    const windX = Math.cos(dirRad) * 0.4
    const windY = Math.sin(dirRad) * 0.4
    const camI = [0.70710678, 0.0, -0.70710678]
    const camJ = [-0.40824829, 0.81649658, -0.40824829]
    const camK = [0.57735027, 0.57735027, 0.57735027]
    const camPos = [0, 0, 0].map((_, i) =>
      (windX * camI[i] + windY * camJ[i] + 0.1 * camK[i]) * timeSpeed
    )

    // 1st pass - drawing in the low-res buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.viewport(0, 0, lowW, lowH)
    gl.useProgram(snowProgram)
    gl.bindBuffer(gl.ARRAY_BUFFER, offsetBuffer)
    gl.enableVertexAttribArray(aOffsetLoc)
    gl.vertexAttribPointer(aOffsetLoc, 3, gl.FLOAT, false, 0, 0)

    gl.uniform3f(snowUnis.uCamPos, camPos[0], camPos[1], camPos[2])
    gl.uniform2f(snowUnis.uResolution, lowW, lowH)
    gl.uniform1f(snowUnis.uFlakeSize, PARAMS.FLAKE_SIZE)
    gl.uniform1f(snowUnis.uMinFlakeSize, PARAMS.MIN_FLAKE_SIZE)
    gl.uniform1f(snowUnis.uDepthFade, PARAMS.DEPTH_FADE)
    gl.uniform1f(snowUnis.uFarPlane, PARAMS.FAR_PLANE)
    gl.uniform1f(snowUnis.uDensity, PARAMS.DENSITY)
    gl.uniform1f(snowUnis.uTime, timeSpeed)
    gl.uniform3f(snowUnis.uColor, PARAMS.COLOR[0], PARAMS.COLOR[1], PARAMS.COLOR[2])
    gl.uniform1f(snowUnis.uBrightness, PARAMS.BRIGHTNESS)
    gl.uniform1f(snowUnis.uGamma, PARAMS.GAMMA)
    gl.uniform1f(snowUnis.uVariant, PARAMS.VARIANT)

    gl.clearColor(0.02, 0.03, 0.05, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawArrays(gl.POINTS, 0, pointCount)

    // 2nd pass - blitting low-res buffer to the full canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.disable(gl.BLEND)
    gl.useProgram(blitProgram)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, fboTex)
    gl.uniform1i(blitUnis.uTex, 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    gl.disableVertexAttribArray(aOffsetLoc)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    gl.enable(gl.BLEND)

    frames++
    const now = performance.now()
    if (now - lastFpsT > 1500) {
      console.log(`Animation FPS: ${(frames * 1000 / (now - lastFpsT)).toFixed(1)}`)
      frames = 0
      lastFpsT = now
    }
  }

  requestAnimationFrame(frame)
}

main()
