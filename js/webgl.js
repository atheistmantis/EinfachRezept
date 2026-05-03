/**
 * @fileoverview Animated WebGL background rendered on the full-screen `#bg` canvas.
 *
 * The effect is a smooth value-noise wave with a pointer-tracking glow.
 * Visual parameters (speed, wave strength, glow strength) are read lazily
 * each frame via the `getVisualSettings` callback, so they always reflect
 * the live site configuration without requiring a re-initialisation.
 *
 * The animation is completely frozen when the user prefers reduced motion.
 * WebGL unavailability degrades gracefully (the canvas stays blank).
 */

// ---------------------------------------------------------------------------
// GLSL shader sources
// ---------------------------------------------------------------------------

const VERTEX_SHADER_SOURCE = /* glsl */ `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER_SOURCE = /* glsl */ `
  precision mediump float;

  uniform vec2  u_resolution;
  uniform float u_time;
  uniform vec2  u_pointer;
  uniform float u_waveStrength;
  uniform float u_glowStrength;

  float random2(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = random2(i);
    float b = random2(i + vec2(1.0, 0.0));
    float c = random2(i + vec2(0.0, 1.0));
    float d = random2(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 p  = uv * 2.0 - 1.0;
    p.x    *= u_resolution.x / u_resolution.y;

    vec2 m  = (u_pointer / u_resolution.xy) * 2.0 - 1.0;
    m.x    *= u_resolution.x / u_resolution.y;

    float n    = noise(p * 3.2 + vec2(u_time * 0.35, -u_time * 0.27));
    float wave = sin((p.x + n * 0.6 + u_time * 0.7)  * 6.5) * 0.17;
    wave      += cos((p.y - n * 0.8 - u_time * 0.55) * 7.0) * 0.15;
    wave      *= u_waveStrength;

    float pointerDist = length(p - m * 0.55);
    float pointerGlow = u_glowStrength / (pointerDist + 0.25);
    float centerGlow  = (u_glowStrength * 0.8) / (length(p) + 0.45);

    vec3 base   = vec3(0.015, 0.04,  0.1);
    vec3 teal   = vec3(0.0,   0.76,  0.95);
    vec3 purple = vec3(0.39,  0.27,  0.98);

    vec3 color  = base;
    color      += teal   * (wave + pointerGlow * 0.65);
    color      += purple * (n * 0.22 + centerGlow * 0.25);

    gl_FragColor = vec4(color, 1.0);
  }
`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} VisualSettings
 * @property {number} animationSpeed
 * @property {number} waveStrength
 * @property {number} glowStrength
 */

/**
 * Initialises the WebGL background animation on the `#bg` canvas element.
 * Does nothing when WebGL is unavailable.
 *
 * @param {() => VisualSettings} getVisualSettings
 *   Called each frame to read the current animation parameters from the live
 *   site configuration.
 */
export function setupWebGLBackground(getVisualSettings) {
  const canvas = document.getElementById("bg");
  const gl = canvas?.getContext("webgl");
  if (!gl) return;

  const program = _createShaderProgram(gl);
  if (!program) return;

  gl.useProgram(program);

  // Upload a full-screen quad (two triangles covering the entire clip space).
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );

  const positionLocation = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  const uniforms = {
    resolution:   gl.getUniformLocation(program, "u_resolution"),
    time:         gl.getUniformLocation(program, "u_time"),
    pointer:      gl.getUniformLocation(program, "u_pointer"),
    waveStrength: gl.getUniformLocation(program, "u_waveStrength"),
    glowStrength: gl.getUniformLocation(program, "u_glowStrength"),
  };

  const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  let dpr = window.devicePixelRatio || 1;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function resize() {
    dpr = window.devicePixelRatio || 1;
    canvas.width  = Math.floor(window.innerWidth  * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width  = "100%";
    canvas.style.height = "100%";
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  window.addEventListener("resize", resize);

  if (!prefersReducedMotion) {
    window.addEventListener("pointermove", (event) => {
      pointer.x = event.clientX;
      pointer.y = window.innerHeight - event.clientY;
    });
  }

  resize();

  const startTime = performance.now();

  function render(now) {
    const { animationSpeed, waveStrength, glowStrength } = getVisualSettings();
    const speed = prefersReducedMotion ? 0 : animationSpeed;
    const t = (now - startTime) * 0.001 * speed;

    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    gl.uniform1f(uniforms.time, t);
    gl.uniform2f(uniforms.pointer, pointer.x * dpr, pointer.y * dpr);
    gl.uniform1f(uniforms.waveStrength, waveStrength);
    gl.uniform1f(uniforms.glowStrength, glowStrength);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    if (!prefersReducedMotion) requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Compiles a shader of the given `type` from `source`.
 * Logs a detailed error and returns `null` on failure.
 *
 * @param {WebGLRenderingContext} gl
 * @param {number} type   - `gl.VERTEX_SHADER` or `gl.FRAGMENT_SHADER`
 * @param {string} source
 * @returns {WebGLShader|null}
 */
function _compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("WebGL shader compile error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/**
 * Compiles and links the full vertex + fragment shader program.
 * Returns `null` when compilation or linking fails.
 *
 * @param {WebGLRenderingContext} gl
 * @returns {WebGLProgram|null}
 */
function _createShaderProgram(gl) {
  const vertexShader   = _compileShader(gl, gl.VERTEX_SHADER,   VERTEX_SHADER_SOURCE);
  const fragmentShader = _compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
  if (!vertexShader || !fragmentShader) return null;

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("WebGL program link error:", gl.getProgramInfoLog(program));
    return null;
  }

  return program;
}
