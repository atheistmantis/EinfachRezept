const canvas = document.getElementById("bg");
const gl = canvas.getContext("webgl");

const STORAGE_KEYS = {
  users: "einfachrezept_users_v1",
  session: "einfachrezept_session_v1",
  siteConfig: "einfachrezept_site_config_v1",
};

const PASSWORD_HASH_VERSION = 2;
const PASSWORD_ITERATIONS = 120000;
const MIN_PASSWORD_LENGTH = 10;

const DEFAULT_SITE_CONFIG = {
  title: "EinfachRezept",
  subtitle: "Einfach. Schnell. Gut lesbar.",
  startLabel: "START",
  categoryLabel: "Wähle eine Basis",
  riceButtonLabel: "Reis",
  pastaButtonLabel: "Nudeln",
  riceTitle: "Reis Optionen",
  pastaTitle: "Nudeln Optionen",
  riceItems: ["Mildes Curry", "Gemüsepfanne", "Reissuppe"],
  pastaItems: ["Tomatensauce", "Pesto", "Gemüse-Nudeln"],
  theme: {
    accentColor: "#00d4ff",
    textColor: "#ffffff",
    backgroundColor: "#02040a",
    overlayColor: "#080c14",
    overlayOpacity: 0.75,
  },
  webgl: {
    animationSpeed: 0.55,
    waveStrength: 0.8,
    glowStrength: 0.28,
  },
};

function getStoredJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.error("Storage parse failed:", error);
    return fallback;
  }
}

function saveStoredJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sanitizeString(value, fallback) {
  const cleaned = String(value ?? "").trim();
  return cleaned.length ? cleaned : fallback;
}

function sanitizeItems(multilineValue, fallbackItems) {
  const items = String(multilineValue ?? "")
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return items.length ? items : fallbackItems;
}

function isStrongPassword(password) {
  return (
    password.length >= MIN_PASSWORD_LENGTH &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

function hexToRgb(hex) {
  const cleaned = hex.replace("#", "");
  const normalized = cleaned.length === 3 ? cleaned.split("").map((char) => char + char).join("") : cleaned;
  const parsed = Number.parseInt(normalized, 16);
  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
}

function setListItems(listId, items) {
  const list = document.getElementById(listId);
  if (!list) return;
  list.replaceChildren(
    ...items.map((itemText) => {
      const item = document.createElement("li");
      item.textContent = itemText;
      return item;
    }),
  );
}

function applySiteConfig(config) {
  const title = document.getElementById("site-title");
  const subtitle = document.getElementById("subtitle");
  const startButton = document.getElementById("start-button");
  const categoryTitle = document.getElementById("category-title");
  const riceButton = document.getElementById("rice-button");
  const pastaButton = document.getElementById("pasta-button");
  const riceTitle = document.getElementById("reis-title");
  const pastaTitle = document.getElementById("nudeln-title");

  if (title) title.textContent = config.title;
  if (subtitle) subtitle.textContent = config.subtitle;
  if (startButton) startButton.textContent = config.startLabel;
  if (categoryTitle) categoryTitle.textContent = config.categoryLabel;
  if (riceButton) riceButton.textContent = config.riceButtonLabel;
  if (pastaButton) pastaButton.textContent = config.pastaButtonLabel;
  if (riceTitle) riceTitle.textContent = config.riceTitle;
  if (pastaTitle) pastaTitle.textContent = config.pastaTitle;

  setListItems("rice-list", config.riceItems);
  setListItems("pasta-list", config.pastaItems);

  document.documentElement.style.setProperty("--accent", config.theme.accentColor);
  document.documentElement.style.setProperty("--text", config.theme.textColor);
  document.documentElement.style.setProperty("--background", config.theme.backgroundColor);
  const rgb = hexToRgb(config.theme.overlayColor);
  document.documentElement.style.setProperty(
    "--bg-overlay",
    `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${config.theme.overlayOpacity})`,
  );
}

function setupWebGLBackground(getVisualSettings) {
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
      vec2 p = uv * 2.0 - 1.0;
      p.x *= u_resolution.x / u_resolution.y;

      vec2 m = (u_pointer / u_resolution.xy) * 2.0 - 1.0;
      m.x *= u_resolution.x / u_resolution.y;

      float n = noise(p * 3.2 + vec2(u_time * 0.35, -u_time * 0.27));
      float wave = sin((p.x + n * 0.6 + u_time * 0.7) * 6.5) * 0.17;
      wave += cos((p.y - n * 0.8 - u_time * 0.55) * 7.0) * 0.15;
      wave *= u_waveStrength;

      float pointerDistance = length(p - m * 0.55);
      float pointerGlow = (u_glowStrength / (pointerDistance + 0.25));
      float centerGlow = (u_glowStrength * 0.8) / (length(p) + 0.45);

      vec3 base = vec3(0.015, 0.04, 0.1);
      vec3 teal = vec3(0.0, 0.76, 0.95);
      vec3 purple = vec3(0.39, 0.27, 0.98);

      vec3 color = base;
      color += teal * (wave + pointerGlow * 0.65);
      color += purple * (n * 0.22 + centerGlow * 0.25);

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
  const waveStrengthLocation = gl.getUniformLocation(program, "u_waveStrength");
  const glowStrengthLocation = gl.getUniformLocation(program, "u_glowStrength");

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

  const startTime = performance.now();

  function render(now) {
    const visualSettings = getVisualSettings();
    const speed = prefersReducedMotion ? 0 : visualSettings.animationSpeed;
    const t = (now - startTime) * 0.001 * speed;

    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    gl.uniform1f(timeLocation, t);
    gl.uniform2f(pointerLocation, pointer.x * dpr, pointer.y * dpr);
    gl.uniform1f(waveStrengthLocation, visualSettings.waveStrength);
    gl.uniform1f(glowStrengthLocation, visualSettings.glowStrength);
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

function populateEditorForm(config) {
  const form = document.getElementById("editor-form");
  if (!form) return;
  form.title.value = config.title;
  form.subtitle.value = config.subtitle;
  form.startLabel.value = config.startLabel;
  form.categoryLabel.value = config.categoryLabel;
  form.riceButtonLabel.value = config.riceButtonLabel;
  form.pastaButtonLabel.value = config.pastaButtonLabel;
  form.riceTitle.value = config.riceTitle;
  form.pastaTitle.value = config.pastaTitle;
  form.accentColor.value = config.theme.accentColor;
  form.textColor.value = config.theme.textColor;
  form.backgroundColor.value = config.theme.backgroundColor;
  form.overlayColor.value = config.theme.overlayColor;
  form.overlayOpacity.value = config.theme.overlayOpacity;
  form.animationSpeed.value = config.webgl.animationSpeed;
  form.waveStrength.value = config.webgl.waveStrength;
  form.glowStrength.value = config.webgl.glowStrength;
  form.riceItems.value = config.riceItems.join("\n");
  form.pastaItems.value = config.pastaItems.join("\n");
}

function readEditorForm(currentConfig) {
  const form = document.getElementById("editor-form");
  if (!form) return currentConfig;

  return {
    ...currentConfig,
    title: sanitizeString(form.title.value, DEFAULT_SITE_CONFIG.title),
    subtitle: sanitizeString(form.subtitle.value, DEFAULT_SITE_CONFIG.subtitle),
    startLabel: sanitizeString(form.startLabel.value, DEFAULT_SITE_CONFIG.startLabel),
    categoryLabel: sanitizeString(form.categoryLabel.value, DEFAULT_SITE_CONFIG.categoryLabel),
    riceButtonLabel: sanitizeString(form.riceButtonLabel.value, DEFAULT_SITE_CONFIG.riceButtonLabel),
    pastaButtonLabel: sanitizeString(form.pastaButtonLabel.value, DEFAULT_SITE_CONFIG.pastaButtonLabel),
    riceTitle: sanitizeString(form.riceTitle.value, DEFAULT_SITE_CONFIG.riceTitle),
    pastaTitle: sanitizeString(form.pastaTitle.value, DEFAULT_SITE_CONFIG.pastaTitle),
    riceItems: sanitizeItems(form.riceItems.value, DEFAULT_SITE_CONFIG.riceItems),
    pastaItems: sanitizeItems(form.pastaItems.value, DEFAULT_SITE_CONFIG.pastaItems),
    theme: {
      accentColor: form.accentColor.value || DEFAULT_SITE_CONFIG.theme.accentColor,
      textColor: form.textColor.value || DEFAULT_SITE_CONFIG.theme.textColor,
      backgroundColor: form.backgroundColor.value || DEFAULT_SITE_CONFIG.theme.backgroundColor,
      overlayColor: form.overlayColor.value || DEFAULT_SITE_CONFIG.theme.overlayColor,
      overlayOpacity: Number.parseFloat(form.overlayOpacity.value) || DEFAULT_SITE_CONFIG.theme.overlayOpacity,
    },
    webgl: {
      animationSpeed: Number.parseFloat(form.animationSpeed.value) || DEFAULT_SITE_CONFIG.webgl.animationSpeed,
      waveStrength: Number.parseFloat(form.waveStrength.value) || DEFAULT_SITE_CONFIG.webgl.waveStrength,
      glowStrength: Number.parseFloat(form.glowStrength.value) || DEFAULT_SITE_CONFIG.webgl.glowStrength,
    },
  };
}

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hexString) {
  const pairs = hexString.match(/.{1,2}/g) ?? [];
  return new Uint8Array(pairs.map((pair) => Number.parseInt(pair, 16)));
}

function createSalt() {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return toHex(salt);
}

async function derivePbkdf2Hash(password, saltHex, iterations = PASSWORD_ITERATIONS) {
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: fromHex(saltHex),
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );
  return toHex(bits);
}

async function createPasswordRecord(password) {
  const salt = createSalt();
  const hash = await derivePbkdf2Hash(password, salt);
  return {
    passwordHash: hash,
    passwordSalt: salt,
    passwordIterations: PASSWORD_ITERATIONS,
    passwordHashVersion: PASSWORD_HASH_VERSION,
  };
}

async function verifyPassword(user, password) {
  if (user.passwordHashVersion === PASSWORD_HASH_VERSION && user.passwordSalt) {
    const computedHash = await derivePbkdf2Hash(password, user.passwordSalt, user.passwordIterations || PASSWORD_ITERATIONS);
    return user.passwordHash === computedHash;
  }

  if (user.passwordHash && !user.passwordSalt) {
    const legacyDigest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
    return user.passwordHash === toHex(legacyDigest);
  }

  return false;
}

async function initApp() {
  let users = getStoredJSON(STORAGE_KEYS.users, []);
  let currentConfig = getStoredJSON(STORAGE_KEYS.siteConfig, deepClone(DEFAULT_SITE_CONFIG));
  if (!currentConfig || typeof currentConfig !== "object") {
    currentConfig = deepClone(DEFAULT_SITE_CONFIG);
  }
  applySiteConfig(currentConfig);
  populateEditorForm(currentConfig);
  setupWebGLBackground(() => currentConfig.webgl);
  initNavigation();

  const loginForm = document.getElementById("login-form");
  const setupPanel = document.getElementById("setup-panel");
  const firstAdminForm = document.getElementById("first-admin-form");
  const logoutButton = document.getElementById("logout-button");
  const sessionStatus = document.getElementById("session-status");
  const editorPanel = document.getElementById("editor-panel");
  const userAdminPanel = document.getElementById("user-admin-panel");
  const editorForm = document.getElementById("editor-form");
  const createUserForm = document.getElementById("create-user-form");
  const resetButton = document.getElementById("reset-button");

  function setVisibility(element, isVisible) {
    if (!element) return;
    element.classList.toggle("hidden", !isVisible);
    element.setAttribute("aria-hidden", String(!isVisible));
  }

  function findUserByName(username) {
    return users.find((user) => user.username === username);
  }

  function readSessionUser() {
    const session = getStoredJSON(STORAGE_KEYS.session, null);
    if (!session?.username) return null;
    const user = findUserByName(session.username);
    return user ? { username: user.username, role: user.role } : null;
  }

  let activeSession = readSessionUser();

  function renderSessionState() {
    if (!sessionStatus) return;
    const hasUsers = users.length > 0;
    setVisibility(setupPanel, !hasUsers);
    setVisibility(loginForm, hasUsers);

    if (!hasUsers) {
      activeSession = null;
      localStorage.removeItem(STORAGE_KEYS.session);
      sessionStatus.textContent = "Erstelle zuerst einen Admin-Login.";
      setVisibility(editorPanel, false);
      setVisibility(userAdminPanel, false);
      setVisibility(logoutButton, false);
      return;
    }

    if (!activeSession) {
      sessionStatus.textContent = "Nicht angemeldet.";
      setVisibility(editorPanel, false);
      setVisibility(userAdminPanel, false);
      setVisibility(logoutButton, false);
      return;
    }

    sessionStatus.textContent = `Angemeldet als ${activeSession.username} (${activeSession.role}).`;
    setVisibility(editorPanel, true);
    setVisibility(logoutButton, true);
    if (activeSession.role === "admin") {
      setVisibility(userAdminPanel, true);
    } else {
      setVisibility(userAdminPanel, false);
    }
  }

  firstAdminForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (users.length > 0) return;

    const formData = new FormData(firstAdminForm);
    const username = sanitizeString(formData.get("first-admin-username"), "");
    const password = String(formData.get("first-admin-password") ?? "");
    const passwordConfirm = String(formData.get("first-admin-password-confirm") ?? "");

    if (!username) {
      sessionStatus.textContent = "Admin konnte nicht erstellt werden. Benutzername fehlt.";
      return;
    }
    if (!password || !passwordConfirm || password !== passwordConfirm) {
      sessionStatus.textContent = "Admin konnte nicht erstellt werden. Passwörter stimmen nicht überein.";
      return;
    }
    if (!isStrongPassword(password)) {
      sessionStatus.textContent =
        "Admin konnte nicht erstellt werden. Nutze ein starkes Passwort (Groß/Klein/Zahl/Sonderzeichen, min. 10).";
      return;
    }

    const passwordRecord = await createPasswordRecord(password);
    users = [{ username, role: "admin", ...passwordRecord }];
    saveStoredJSON(STORAGE_KEYS.users, users);
    firstAdminForm.reset();
    sessionStatus.textContent = `Admin "${username}" erstellt. Bitte einloggen.`;
    renderSessionState();
  });

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!users.length) {
      sessionStatus.textContent = "Bitte zuerst einen Admin anlegen.";
      return;
    }

    const formData = new FormData(loginForm);
    const username = sanitizeString(formData.get("username"), "");
    const password = String(formData.get("password") ?? "");
    const user = findUserByName(username);

    if (!user) {
      sessionStatus.textContent = "Login fehlgeschlagen.";
      return;
    }

    const isValidPassword = await verifyPassword(user, password);
    if (!isValidPassword) {
      sessionStatus.textContent = "Login fehlgeschlagen.";
      return;
    }

    if (user.passwordHashVersion !== PASSWORD_HASH_VERSION || !user.passwordSalt) {
      const upgradedRecord = await createPasswordRecord(password);
      users = users.map((entry) => (entry.username === user.username ? { ...entry, ...upgradedRecord } : entry));
      saveStoredJSON(STORAGE_KEYS.users, users);
    }

    activeSession = { username: user.username, role: user.role };
    saveStoredJSON(STORAGE_KEYS.session, activeSession);
    loginForm.reset();
    renderSessionState();
  });

  logoutButton?.addEventListener("click", () => {
    activeSession = null;
    localStorage.removeItem(STORAGE_KEYS.session);
    renderSessionState();
  });

  createUserForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!activeSession || activeSession.role !== "admin") return;

    const formData = new FormData(createUserForm);
    const username = sanitizeString(formData.get("new-username"), "");
    const password = String(formData.get("new-password") ?? "");
    const role = formData.get("new-role") === "admin" ? "admin" : "editor";

    if (!username) {
      sessionStatus.textContent = "Benutzer konnte nicht erstellt werden. Benutzername fehlt.";
      return;
    }
    if (!isStrongPassword(password)) {
      sessionStatus.textContent = "Benutzer konnte nicht erstellt werden. Passwort ist zu schwach.";
      return;
    }
    if (findUserByName(username)) {
      sessionStatus.textContent = "Benutzername existiert bereits.";
      return;
    }

    const passwordRecord = await createPasswordRecord(password);
    users = [...users, { username, role, ...passwordRecord }];
    saveStoredJSON(STORAGE_KEYS.users, users);
    createUserForm.reset();
    sessionStatus.textContent = `Benutzer "${username}" erstellt.`;
  });

  editorForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!activeSession) {
      sessionStatus.textContent = "Bitte zuerst anmelden.";
      return;
    }

    currentConfig = readEditorForm(currentConfig);
    applySiteConfig(currentConfig);
    saveStoredJSON(STORAGE_KEYS.siteConfig, currentConfig);
    sessionStatus.textContent = "Änderungen gespeichert.";
  });

  resetButton?.addEventListener("click", () => {
    if (!activeSession) {
      sessionStatus.textContent = "Bitte zuerst anmelden.";
      return;
    }
    currentConfig = deepClone(DEFAULT_SITE_CONFIG);
    applySiteConfig(currentConfig);
    populateEditorForm(currentConfig);
    saveStoredJSON(STORAGE_KEYS.siteConfig, currentConfig);
    sessionStatus.textContent = "Standardwerte wiederhergestellt.";
  });

  renderSessionState();
}

initApp();
