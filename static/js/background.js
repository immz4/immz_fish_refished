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

// Shaders are minified using https://github.com/laurentlb/shader-minifier with `--preserve-externals` flag
// TODO: consider adding minification to the build process

const SNOW_VERTEX = `#version 300 es
precision highp float;in vec3 aOffset;uniform vec3 uCamPos;uniform vec2 uResolution;uniform float uFlakeSize,uMinFlakeSize,uDepthFade,uFarPlane,uDensity,uTime;
#define M1 1597334677U
#define M2 3812015801U
#define M3 3299493293U
#define F0 2.3283064e-10
#define hash(n)(n*(n^(n>>15)))
#define coord3(p)(uvec3(p).x*M1^uvec3(p).y*M2^uvec3(p).z*M3)
const vec3 u=vec3(.57735027),e=vec3(.70710678,0,-.70710678),y=vec3(-.40824829,.81649658,-.40824829);vec3 v(uint u){uvec3 e=hash(u)*uvec3(1U,511U,262143U);return vec3(e)*F0;}out float vIntensity,vVariantDummy;void main(){vec3 n=floor(uCamPos)+aOffset;uint p=coord3(n);float M=v(p).x;if(M>=uDensity){gl_Position=vec4(2,2,2,1);gl_PointSize=0.;vIntensity=0.;return;}vec3 f=v(p);n=(.5-.5*cos(4.*sin(n.yzx*.073)+4.*sin(n.zxy*.27)+2.*f+uTime*.1*vec3(7,8,5)))*.8+.1+n-uCamPos;M=dot(n,u);if(M<=.01||M>uFarPlane){gl_Position=vec4(2,2,2,1);gl_PointSize=0.;vIntensity=0.;return;}float s=uFlakeSize/max(uFlakeSize,uMinFlakeSize*M*(.5/uResolution.x));vIntensity=exp2(-M*(1./uDepthFade))*min(1.,s*s);gl_Position=vec4(dot(n,e)/M*2.,dot(n,y)/M*2.*(uResolution.x/uResolution.y),0,1)*M;gl_Position.w=M;gl_Position.z=0.;gl_PointSize=max(uMinFlakeSize,2.*uFlakeSize*uResolution.x/M);}`

const SNOW_FRAGMENT = `#version 300 es
precision mediump float;in float vIntensity;out vec4 fragColor;uniform vec3 uColor;uniform float uBrightness,uGamma,uVariant;float v(vec2 v){vec4 m=vec4(0,9.5,9.5,0);m.xy=v.x>0.?m.xy:m.zw;m.x=v.y>0.?m.x:m.y;v=abs(v)-vec2(9.5,9.75)+m.x;return min(max(v.x,v.y),0.)+length(max(v,0.))-m.x;}float m(vec2 v){v=abs(v)-vec2(6,5.5);return min(max(v.x,v.y),0.)+length(max(v,0.));}float x(vec2 u){float x=abs(u.y-19.5);return max(min(length(vec2(u.x-clamp(u.x,19.5,26.),u.y-19.5))-19.5,min(v(vec2(u.x-62.5,x-9.75)),max(m(vec2(u.x-47.,x-5.5)),-length(vec2(u.x-53.,x-11.))+10.5))),-length(u-vec2(18.5,19.5))+5.5);}void main(){if(vIntensity<=0.)discard;vec2 v=gl_PointCoord*2.-1.;if((uVariant<.5?max(abs(v.x),abs(v.y)):uVariant<1.5?length(v):x(vec2(36.+v.x*36.,19.5+v.y*36.))>0.?2.:0.)>1.)discard;fragColor=vec4(uColor*pow(vIntensity*uBrightness,uGamma),1);}`

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
