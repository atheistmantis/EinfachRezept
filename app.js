const canvas = document.getElementById("bg");
const gl = canvas.getContext("webgl");

function setupWebGLBackground() {
  if (!gl) return;

  const vertexShaderSource = `
    attribute vec2 a_position;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fragmentShaderSource = `
    precision mediump float;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform vec2 u_pointer;

    void main() {
      vec2 uv = gl_FragCoord.xy / u_resolution.xy;
      vec2 p = uv * 2.0 - 1.0;
      p.x *= u_resolution.x / u_resolution.y;
      vec2 m = (u_pointer / u_resolution.xy) * 2.0 - 1.0;
      m.x *= u_resolution.x / u_resolution.y;

      float wave = sin((p.x + u_time * 0.2) * 6.0) * 0.07 + cos((p.y - u_time * 0.18) * 5.0) * 0.08;
      float d = length(p - m * 0.6);
      float glow = 0.25 / (d + 0.2);

      vec3 base = vec3(0.02, 0.05, 0.12);
      vec3 tint = vec3(0.0, 0.72, 0.95);
      vec3 color = base + tint * (wave + glow);
      gl_FragColor = vec4(color, 1.0);
    }
  `;

  function compileShader(type, source) {
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

  const vertexShader = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
  if (!vertexShader || !fragmentShader) return;

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("WebGL program link error:", gl.getProgramInfoLog(program));
    return;
  }
  gl.useProgram(program);

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

  const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
  const timeLocation = gl.getUniformLocation(program, "u_time");
  const pointerLocation = gl.getUniformLocation(program, "u_pointer");
  const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  let dpr = window.devicePixelRatio || 1;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function resize() {
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = "100%";
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

  let startTime = performance.now();
  function render(now) {
    const t = prefersReducedMotion ? 0 : (now - startTime) * 0.001;
    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    gl.uniform1f(timeLocation, t);
    gl.uniform2f(pointerLocation, pointer.x * dpr, pointer.y * dpr);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    if (prefersReducedMotion) return;
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

function initNavigation() {
  const startButton = document.getElementById("start-button");
  const categorySection = document.getElementById("category");
  const optionButtons = document.querySelectorAll(".option-button");

  startButton?.addEventListener("click", () => {
    categorySection?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  optionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.dataset.target;
      if (!targetId) return;

      document.querySelectorAll(".options").forEach((section) => {
        section.classList.remove("active");
      });

      const targetSection = document.getElementById(targetId);
      targetSection?.classList.add("active");
      targetSection?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

setupWebGLBackground();
initNavigation();
