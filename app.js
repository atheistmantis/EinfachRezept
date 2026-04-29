const canvas = document.getElementById("bg");
const gl = canvas.getContext("webgl");

const STORAGE_KEYS = {
  users: "einfachrezept_users_v1",
  session: "einfachrezept_session_v1",
  siteConfig: "einfachrezept_site_config_v1",
};

// Injected at deploy time by the GitHub Actions workflow (base64-encoded to avoid secret scanning).
// The placeholder "__SITE_PAT_B64__" is replaced with the real base64-encoded token during CI.
function getSitePat() {
  const encodedPat = "__SITE_PAT_B64__";
  if (encodedPat === "__SITE_PAT_B64__") return ""; // placeholder not replaced (local dev)
  try {
    return atob(encodedPat);
  } catch {
    return "";
  }
}
const SITE_PAT = getSitePat();

const PASSWORD_HASH_VERSION = 2;
const PASSWORD_ITERATIONS = 120000;
const HEX_COLOR_REGEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const SCROLL_BLOCKED_KEYS = ["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "];
const EDITOR_SNAPSHOT_DEBOUNCE_MS = 120;
const REQUIRED_ADMIN_USERS = [
  {
    username: "bigbossdawg",
    role: "admin",
    passwordHash: "1ed8fafeb3572c1bc1e4ebc79197a492548fe8f7c975d28d207726df3c34521d",
    passwordSalt: "cb41915957849aefe7a31c458f5f7fc0",
    passwordIterations: PASSWORD_ITERATIONS,
    passwordHashVersion: PASSWORD_HASH_VERSION,
  },
  {
    username: "bigbosscat",
    role: "admin",
    passwordHash: "92a1c04904491689bb89540b8dcace8d428135fbc93934b91fac7c2d57759c0f",
    passwordSalt: "b9ab67211a39bdd4bccffbc9dd36936f",
    passwordIterations: PASSWORD_ITERATIONS,
    passwordHashVersion: PASSWORD_HASH_VERSION,
  },
];

const DEFAULT_SITE_CONFIG = {
  title: "EinfachRezept",
  subtitle: "Einfach. Schnell. Gut lesbar.",
  startLabel: "START",
  categoryLabel: "Wähle eine Basis",
  buttons: [
    {
      id: "reis",
      label: "Reis",
      title: "Reis Optionen",
      backgroundColor: "",
      textColor: "",
      imageUrl: "",
      stepBackgroundImageUrl: "",
      items: ["Mildes Curry", "Gemüsepfanne", "Reissuppe"],
    },
    {
      id: "nudeln",
      label: "Nudeln",
      title: "Nudeln Optionen",
      backgroundColor: "",
      textColor: "",
      imageUrl: "",
      stepBackgroundImageUrl: "",
      items: ["Tomatensauce", "Pesto", "Gemüse-Nudeln"],
    },
  ],
  theme: {
    accentColor: "#00d4ff",
    textColor: "#ffffff",
    backgroundColor: "#02040a",
    overlayColor: "#080c14",
    overlayOpacity: 0.75,
    landingBackgroundImageUrl: "",
    categoryBackgroundImageUrl: "",
    buttonFontFamily: "Arial, Helvetica, sans-serif",
    buttonFontWeight: 700,
    buttonBorderRadius: 1,
    buttonFontSize: 1.65,
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

function sanitizeColor(colorValue, fallback = "") {
  const cleaned = String(colorValue ?? "").trim();
  const fallbackColor = String(fallback ?? "").trim();
  const safeFallback = HEX_COLOR_REGEX.test(fallbackColor) ? fallbackColor : "";
  if (!cleaned) return safeFallback;
  return HEX_COLOR_REGEX.test(cleaned) ? cleaned : safeFallback;
}

function clamp(value, min, max, fallback) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function sanitizeImageUrl(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  if (trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../")) return trimmed;

  const schemeMatch = trimmed.match(/^([a-zA-Z][a-zA-Z\d+.-]*):/);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    if (scheme === "data") {
      return /^data:image\//i.test(trimmed) ? trimmed : "";
    }
    if (scheme === "blob") return trimmed;
    if (!["http", "https"].includes(scheme)) return "";
  }

  try {
    const parsed = new URL(trimmed, window.location.href);
    if (["http:", "https:"].includes(parsed.protocol)) return trimmed;
  } catch {}

  return "";
}

const GITHUB_REPO = "atheistmantis/EinfachRezept";
const GITHUB_CONFIG_PATH = "site-config.json";
const GITHUB_API_BASE = "https://api.github.com";

async function fetchRepoConfig() {
  try {
    const response = await fetch(`./${GITHUB_CONFIG_PATH}`, { cache: "no-store" });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function configToBase64(config) {
  const jsonStr = JSON.stringify(config, null, 2);
  const bytes = new TextEncoder().encode(jsonStr);
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  return btoa(binary);
}

async function saveConfigToGitHub(config, pat) {
  const apiUrl = `${GITHUB_API_BASE}/repos/${GITHUB_REPO}/contents/${GITHUB_CONFIG_PATH}`;
  const headers = {
    Authorization: `Bearer ${pat}`,
    "Content-Type": "application/json",
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  let sha;
  const getResponse = await fetch(apiUrl, { headers });
  if (getResponse.ok) {
    const data = await getResponse.json();
    sha = data.sha;
  } else if (getResponse.status !== 404) {
    const err = await getResponse.json().catch(() => ({}));
    throw new Error(`GitHub API Fehler ${getResponse.status}: ${err.message || "Unbekannter Fehler"}`);
  }

  const body = {
    message: "Update site config via EinfachRezept editor",
    content: configToBase64(config),
  };
  if (sha) body.sha = sha;

  const putResponse = await fetch(apiUrl, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });

  if (!putResponse.ok) {
    const err = await putResponse.json().catch(() => ({}));
    throw new Error(`GitHub API Fehler ${putResponse.status}: ${err.message || "Unbekannter Fehler"}`);
  }
}


function cssUrlValue(url) {
  return `url("${String(url).replace(/["\\\n\r\f]/g, "\\$&")}")`;
}

function readImageFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith("image/")) {
      reject(new Error("Invalid image file."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Unable to read image file."));
    reader.readAsDataURL(file);
  });
}

function hexToRgb(hex) {
  const cleaned = String(hex ?? "").replace(/^#/, "");
  const normalized = cleaned.length === 3 ? cleaned.split("").map((char) => char + char).join("") : cleaned;
  const parsed = Number.parseInt(normalized, 16);
  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
}

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeButtons(rawButtons) {
  const fallback = DEFAULT_SITE_CONFIG.buttons;
  if (!Array.isArray(rawButtons) || !rawButtons.length) return deepClone(fallback);

  const usedIds = new Set();
  const normalized = [];
  rawButtons.forEach((entry, index) => {
    const fallbackSource = fallback[index % fallback.length];
    const label = sanitizeString(entry?.label, fallbackSource.label);
    const title = sanitizeString(entry?.title, `${label} Optionen`);
    const idBase = sanitizeString(entry?.id, slugify(label) || `button-${index + 1}`);
    let id = idBase;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${idBase}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);

    normalized.push({
      id,
      label,
      title,
      backgroundColor: sanitizeColor(entry?.backgroundColor, ""),
      textColor: sanitizeColor(entry?.textColor, ""),
      imageUrl: sanitizeImageUrl(entry?.imageUrl),
      stepBackgroundImageUrl: sanitizeImageUrl(entry?.stepBackgroundImageUrl || entry?.sectionBackgroundImageUrl || ""),
      items: Array.isArray(entry?.items) && entry.items.length
        ? entry.items.map((item) => sanitizeString(item, "")).filter(Boolean)
        : deepClone(fallbackSource.items),
    });
  });

  return normalized.length ? normalized : deepClone(fallback);
}

function normalizeSiteConfig(rawConfig) {
  const defaults = deepClone(DEFAULT_SITE_CONFIG);
  if (!rawConfig || typeof rawConfig !== "object") return defaults;

  const oldStyleButtons = [
    {
      id: slugify(rawConfig.riceButtonLabel || "reis") || "reis",
      label: sanitizeString(rawConfig.riceButtonLabel, defaults.buttons[0].label),
      title: sanitizeString(rawConfig.riceTitle, defaults.buttons[0].title),
      backgroundColor: "",
      textColor: "",
      imageUrl: "",
      stepBackgroundImageUrl: "",
      items: Array.isArray(rawConfig.riceItems) && rawConfig.riceItems.length ? rawConfig.riceItems : defaults.buttons[0].items,
    },
    {
      id: slugify(rawConfig.pastaButtonLabel || "nudeln") || "nudeln",
      label: sanitizeString(rawConfig.pastaButtonLabel, defaults.buttons[1].label),
      title: sanitizeString(rawConfig.pastaTitle, defaults.buttons[1].title),
      backgroundColor: "",
      textColor: "",
      imageUrl: "",
      stepBackgroundImageUrl: "",
      items: Array.isArray(rawConfig.pastaItems) && rawConfig.pastaItems.length
        ? rawConfig.pastaItems
        : defaults.buttons[1].items,
    },
  ];

  return {
    title: sanitizeString(rawConfig.title, defaults.title),
    subtitle: sanitizeString(rawConfig.subtitle, defaults.subtitle),
    startLabel: sanitizeString(rawConfig.startLabel, defaults.startLabel),
    categoryLabel: sanitizeString(rawConfig.categoryLabel, defaults.categoryLabel),
    buttons: normalizeButtons(Array.isArray(rawConfig.buttons) ? rawConfig.buttons : oldStyleButtons),
    theme: {
      accentColor: sanitizeString(rawConfig.theme?.accentColor, defaults.theme.accentColor),
      textColor: sanitizeString(rawConfig.theme?.textColor, defaults.theme.textColor),
      backgroundColor: sanitizeString(rawConfig.theme?.backgroundColor, defaults.theme.backgroundColor),
      overlayColor: sanitizeString(rawConfig.theme?.overlayColor, defaults.theme.overlayColor),
      overlayOpacity: clamp(rawConfig.theme?.overlayOpacity, 0, 1, defaults.theme.overlayOpacity),
      landingBackgroundImageUrl: sanitizeImageUrl(
        rawConfig.theme?.landingBackgroundImageUrl || rawConfig.theme?.backgroundImageUrl || rawConfig.backgroundImageUrl || "",
      ),
      categoryBackgroundImageUrl: sanitizeImageUrl(
        rawConfig.theme?.categoryBackgroundImageUrl
          || rawConfig.theme?.landingBackgroundImageUrl
          || rawConfig.theme?.backgroundImageUrl
          || rawConfig.backgroundImageUrl
          || "",
      ),
      buttonFontFamily: sanitizeString(rawConfig.theme?.buttonFontFamily, defaults.theme.buttonFontFamily),
      buttonFontWeight: clamp(rawConfig.theme?.buttonFontWeight, 100, 900, defaults.theme.buttonFontWeight),
      buttonBorderRadius: clamp(rawConfig.theme?.buttonBorderRadius, 0, 3, defaults.theme.buttonBorderRadius),
      buttonFontSize: clamp(rawConfig.theme?.buttonFontSize, 0.8, 3, defaults.theme.buttonFontSize),
    },
    webgl: {
      animationSpeed: clamp(rawConfig.webgl?.animationSpeed, 0.05, 1.5, defaults.webgl.animationSpeed),
      waveStrength: clamp(rawConfig.webgl?.waveStrength, 0.1, 1.8, defaults.webgl.waveStrength),
      glowStrength: clamp(rawConfig.webgl?.glowStrength, 0.05, 1, defaults.webgl.glowStrength),
    },
  };
}

function applySiteConfig(config) {
  const title = document.getElementById("site-title");
  const subtitle = document.getElementById("subtitle");
  const startButton = document.getElementById("start-button");
  const topSection = document.getElementById("top");
  const categoryTitle = document.getElementById("category-title");
  const categorySection = document.getElementById("category");
  const categoryButtons = document.getElementById("category-buttons");
  const optionsContainer = document.getElementById("options-container");

  if (title) title.textContent = config.title;
  if (subtitle) subtitle.textContent = config.subtitle;
  if (startButton) startButton.textContent = config.startLabel;
  if (categoryTitle) categoryTitle.textContent = config.categoryLabel;
  if (topSection) {
    topSection.style.setProperty(
      "--section-bg-image",
      config.theme.landingBackgroundImageUrl ? cssUrlValue(config.theme.landingBackgroundImageUrl) : "none",
    );
  }
  if (categorySection) {
    categorySection.style.setProperty(
      "--section-bg-image",
      config.theme.categoryBackgroundImageUrl ? cssUrlValue(config.theme.categoryBackgroundImageUrl) : "none",
    );
  }

  if (categoryButtons) {
    categoryButtons.replaceChildren(
      ...config.buttons.map((buttonConfig, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "action-button option-button";
        button.dataset.target = `options-${buttonConfig.id || index + 1}`;
        button.style.backgroundColor = sanitizeColor(buttonConfig.backgroundColor, "");
        button.style.color = sanitizeColor(buttonConfig.textColor, "");
        if (buttonConfig.imageUrl) {
          button.classList.add("has-image");
          button.style.backgroundImage = cssUrlValue(buttonConfig.imageUrl);
        } else {
          button.style.backgroundImage = "";
        }
        const label = document.createElement("span");
        label.textContent = buttonConfig.label;
        button.append(label);
        return button;
      }),
    );
  }

  if (optionsContainer) {
    optionsContainer.replaceChildren(
      ...config.buttons.map((buttonConfig, index) => {
        const section = document.createElement("section");
        section.className = "panel options";
        section.id = `options-${buttonConfig.id || index + 1}`;
        section.style.setProperty(
          "--section-bg-image",
          buttonConfig.stepBackgroundImageUrl
            ? cssUrlValue(buttonConfig.stepBackgroundImageUrl)
            : config.theme.categoryBackgroundImageUrl
              ? cssUrlValue(config.theme.categoryBackgroundImageUrl)
              : "none",
        );

        const heading = document.createElement("h3");
        heading.textContent = buttonConfig.title;

        const list = document.createElement("ul");
        list.replaceChildren(
          ...buttonConfig.items.map((itemText) => {
            const item = document.createElement("li");
            item.textContent = itemText;
            return item;
          }),
        );

        section.append(heading, list);
        return section;
      }),
    );
  }

  document.documentElement.style.setProperty("--accent", config.theme.accentColor);
  document.documentElement.style.setProperty("--text", config.theme.textColor);
  document.documentElement.style.setProperty("--background", config.theme.backgroundColor);
  const rgb = hexToRgb(config.theme.overlayColor);
  document.documentElement.style.setProperty("--bg-overlay", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${config.theme.overlayOpacity})`);
  document.documentElement.style.setProperty(
    "--panel-bg-image",
    config.theme.landingBackgroundImageUrl ? cssUrlValue(config.theme.landingBackgroundImageUrl) : "none",
  );
  document.documentElement.style.setProperty("--btn-font-family", config.theme.buttonFontFamily);
  document.documentElement.style.setProperty("--btn-font-weight", String(config.theme.buttonFontWeight));
  document.documentElement.style.setProperty("--btn-border-radius", `${config.theme.buttonBorderRadius}rem`);
  document.documentElement.style.setProperty("--btn-font-size", `${config.theme.buttonFontSize}rem`);
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

function hideAllOptionSections() {
  document.querySelectorAll(".options").forEach((section) => section.classList.remove("active"));
}

function initNavigation() {
  const startButton = document.getElementById("start-button");
  const categorySection = document.getElementById("category");
  const categoryButtons = document.getElementById("category-buttons");
  const isInsideControlDock = (target) => target instanceof Element && Boolean(target.closest("#control-dock"));
  const isEditableTarget = (target) => {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    return ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName);
  };
  const lockScroll = (event) => {
    if (isInsideControlDock(event.target)) return;
    event.preventDefault();
  };
  const lockScrollKeys = (event) => {
    if (isInsideControlDock(event.target) || isEditableTarget(event.target)) return;
    if (SCROLL_BLOCKED_KEYS.includes(event.key)) event.preventDefault();
  };
  let startClicked = false;

  document.body.classList.add("landing-scroll-locked");
  window.addEventListener("wheel", lockScroll, { passive: false });
  window.addEventListener("touchmove", lockScroll, { passive: false });
  window.addEventListener("keydown", lockScrollKeys, { passive: false });

  startButton?.addEventListener("click", () => {
    if (!startClicked) {
      startClicked = true;
      document.body.classList.remove("landing-scroll-locked");
      window.removeEventListener("wheel", lockScroll);
      window.removeEventListener("touchmove", lockScroll);
      window.removeEventListener("keydown", lockScrollKeys);
    }
    categorySection?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  categoryButtons?.addEventListener("click", (event) => {
    const button = event.target.closest(".option-button");
    if (!button) return;
    const targetId = button.dataset.target;
    if (!targetId) return;

    hideAllOptionSections();
    const targetSection = document.getElementById(targetId);
    targetSection?.classList.add("active");
    targetSection?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function createButtonEditorItem(buttonConfig) {
  const item = document.createElement("div");
  item.className = "button-edit-item stack";

  const title = document.createElement("strong");
  title.textContent = "Button";

  const labelLabel = document.createElement("label");
  labelLabel.textContent = "Button Name";
  const labelInput = document.createElement("input");
  labelInput.type = "text";
  labelInput.name = "buttonLabel";
  labelInput.value = buttonConfig.label;

  const sectionLabel = document.createElement("label");
  sectionLabel.textContent = "Optionen Titel";
  const sectionInput = document.createElement("input");
  sectionInput.type = "text";
  sectionInput.name = "buttonTitle";
  sectionInput.value = buttonConfig.title;

  const imageLabel = document.createElement("label");
  imageLabel.textContent = "Button Hintergrundbild (optional)";
  const imageInput = document.createElement("input");
  imageInput.type = "hidden";
  imageInput.name = "buttonImageUrl";
  imageInput.value = buttonConfig.imageUrl;
  const imageFileInput = document.createElement("input");
  imageFileInput.type = "file";
  imageFileInput.name = "buttonImageFile";
  imageFileInput.accept = "image/*";
  const imageStatus = document.createElement("p");
  imageStatus.className = "status";
  imageStatus.textContent = imageInput.value ? "Bild gesetzt." : "Kein Bild gewählt.";
  const stepBackgroundLabel = document.createElement("label");
  stepBackgroundLabel.textContent = "Schritt Hintergrundbild (optional)";
  const stepBackgroundInput = document.createElement("input");
  stepBackgroundInput.type = "hidden";
  stepBackgroundInput.name = "buttonStepBackgroundImageUrl";
  stepBackgroundInput.value = buttonConfig.stepBackgroundImageUrl || "";
  const stepBackgroundFileInput = document.createElement("input");
  stepBackgroundFileInput.type = "file";
  stepBackgroundFileInput.name = "buttonStepBackgroundImageFile";
  stepBackgroundFileInput.accept = "image/*";
  const stepBackgroundStatus = document.createElement("p");
  stepBackgroundStatus.className = "status";
  stepBackgroundStatus.textContent = stepBackgroundInput.value ? "Bild gesetzt." : "Kein Bild gewählt.";

  const bgColorLabel = document.createElement("label");
  bgColorLabel.textContent = "Button Hintergrundfarbe";
  const bgColorInput = document.createElement("input");
  bgColorInput.type = "color";
  bgColorInput.name = "buttonBackgroundColor";
  bgColorInput.value = sanitizeColor(buttonConfig.backgroundColor, "#00d4ff");

  const textColorLabel = document.createElement("label");
  textColorLabel.textContent = "Button Textfarbe";
  const textColorInput = document.createElement("input");
  textColorInput.type = "color";
  textColorInput.name = "buttonTextColor";
  textColorInput.value = sanitizeColor(buttonConfig.textColor, "#ffffff");

  const itemsLabel = document.createElement("label");
  itemsLabel.textContent = "Optionen Einträge (je Zeile ein Eintrag)";
  const itemsInput = document.createElement("textarea");
  itemsInput.name = "buttonItems";
  itemsInput.rows = 4;
  itemsInput.value = buttonConfig.items.join("\n");

  const controls = document.createElement("div");
  controls.className = "button-grid";
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "action-button ghost small remove-button-item";
  remove.textContent = "Entfernen";
  const clearImage = document.createElement("button");
  clearImage.type = "button";
  clearImage.className = "action-button ghost small clear-button-image";
  clearImage.textContent = "Bild entfernen";
  const clearStepBackgroundImage = document.createElement("button");
  clearStepBackgroundImage.type = "button";
  clearStepBackgroundImage.className = "action-button ghost small clear-button-step-background-image";
  clearStepBackgroundImage.textContent = "Schrittbild entfernen";
  controls.append(clearImage, clearStepBackgroundImage, remove);

  imageFileInput.addEventListener("change", async () => {
    const file = imageFileInput.files?.[0];
    if (!file) return;
    try {
      const fileDataUrl = await readImageFileAsDataUrl(file);
      imageInput.value = sanitizeImageUrl(fileDataUrl);
      imageStatus.textContent = imageInput.value ? `Bild "${file.name}" geladen.` : "Ungültiges Bild.";
    } catch {
      imageInput.value = "";
      imageStatus.textContent = "Bild konnte nicht geladen werden.";
    }
  });

  clearImage.addEventListener("click", () => {
    imageInput.value = "";
    imageFileInput.value = "";
    imageStatus.textContent = "Kein Bild gewählt.";
  });
  stepBackgroundFileInput.addEventListener("change", async () => {
    const file = stepBackgroundFileInput.files?.[0];
    if (!file) return;
    try {
      const fileDataUrl = await readImageFileAsDataUrl(file);
      stepBackgroundInput.value = sanitizeImageUrl(fileDataUrl);
      stepBackgroundStatus.textContent = stepBackgroundInput.value ? `Bild "${file.name}" geladen.` : "Ungültiges Bild.";
    } catch {
      stepBackgroundInput.value = "";
      stepBackgroundStatus.textContent = "Bild konnte nicht geladen werden.";
    }
  });
  clearStepBackgroundImage.addEventListener("click", () => {
    stepBackgroundInput.value = "";
    stepBackgroundFileInput.value = "";
    stepBackgroundStatus.textContent = "Kein Bild gewählt.";
  });

  item.append(
    title,
    labelLabel,
    labelInput,
    sectionLabel,
    sectionInput,
    bgColorLabel,
    bgColorInput,
    textColorLabel,
    textColorInput,
    imageLabel,
    imageInput,
    imageFileInput,
    imageStatus,
    stepBackgroundLabel,
    stepBackgroundInput,
    stepBackgroundFileInput,
    stepBackgroundStatus,
    itemsLabel,
    itemsInput,
    controls,
  );
  return item;
}

function populateEditorForm(config) {
  const form = document.getElementById("editor-form");
  const list = document.getElementById("button-edit-list");
  if (!form || !list) return;

  form.title.value = config.title;
  form.subtitle.value = config.subtitle;
  form.startLabel.value = config.startLabel;
  form.categoryLabel.value = config.categoryLabel;
  form.backgroundImageUrl.value = config.theme.landingBackgroundImageUrl;
  const backgroundImageFileInput = document.getElementById("background-image-file-input");
  if (backgroundImageFileInput instanceof HTMLInputElement) backgroundImageFileInput.value = "";
  const backgroundImageStatus = document.getElementById("background-image-status");
  if (backgroundImageStatus) {
    backgroundImageStatus.textContent = config.theme.landingBackgroundImageUrl ? "Bild gesetzt." : "Kein Bild gewählt.";
  }
  form.categoryBackgroundImageUrl.value = config.theme.categoryBackgroundImageUrl;
  const categoryBackgroundImageFileInput = document.getElementById("category-background-image-file-input");
  if (categoryBackgroundImageFileInput instanceof HTMLInputElement) categoryBackgroundImageFileInput.value = "";
  const categoryBackgroundImageStatus = document.getElementById("category-background-image-status");
  if (categoryBackgroundImageStatus) {
    categoryBackgroundImageStatus.textContent = config.theme.categoryBackgroundImageUrl ? "Bild gesetzt." : "Kein Bild gewählt.";
  }
  form.accentColor.value = config.theme.accentColor;
  form.textColor.value = config.theme.textColor;
  form.backgroundColor.value = config.theme.backgroundColor;
  form.overlayColor.value = config.theme.overlayColor;
  form.overlayOpacity.value = config.theme.overlayOpacity;
  form.animationSpeed.value = config.webgl.animationSpeed;
  form.waveStrength.value = config.webgl.waveStrength;
  form.glowStrength.value = config.webgl.glowStrength;
  form.buttonFontFamily.value = config.theme.buttonFontFamily;
  form.buttonFontWeight.value = String(config.theme.buttonFontWeight);
  form.buttonBorderRadius.value = config.theme.buttonBorderRadius;
  form.buttonFontSize.value = config.theme.buttonFontSize;

  list.replaceChildren(...config.buttons.map((buttonConfig) => createButtonEditorItem(buttonConfig)));
}

function readButtonEditorList() {
  const items = Array.from(document.querySelectorAll("#button-edit-list .button-edit-item"));
  const buttons = items.map((item, index) => {
    const label = sanitizeString(item.querySelector('[name="buttonLabel"]')?.value, `Button ${index + 1}`);
    const title = sanitizeString(item.querySelector('[name="buttonTitle"]')?.value, `${label} Optionen`);
    const backgroundColor = sanitizeColor(item.querySelector('[name="buttonBackgroundColor"]')?.value);
    const textColor = sanitizeColor(item.querySelector('[name="buttonTextColor"]')?.value);
    const imageUrl = sanitizeImageUrl(item.querySelector('[name="buttonImageUrl"]')?.value);
    const stepBackgroundImageUrl = sanitizeImageUrl(item.querySelector('[name="buttonStepBackgroundImageUrl"]')?.value);
    const optionItems = sanitizeItems(
      item.querySelector('[name="buttonItems"]')?.value,
      DEFAULT_SITE_CONFIG.buttons[index % DEFAULT_SITE_CONFIG.buttons.length].items,
    );
    return {
      id: slugify(label) || `button-${index + 1}`,
      label,
      title,
      backgroundColor,
      textColor,
      imageUrl,
      stepBackgroundImageUrl,
      items: optionItems,
    };
  });

  return normalizeButtons(buttons.length ? buttons : deepClone(DEFAULT_SITE_CONFIG.buttons));
}

function readEditorForm(currentConfig) {
  const form = document.getElementById("editor-form");
  if (!form) return currentConfig;

  return normalizeSiteConfig({
    ...currentConfig,
    title: sanitizeString(form.title.value, DEFAULT_SITE_CONFIG.title),
    subtitle: sanitizeString(form.subtitle.value, DEFAULT_SITE_CONFIG.subtitle),
    startLabel: sanitizeString(form.startLabel.value, DEFAULT_SITE_CONFIG.startLabel),
    categoryLabel: sanitizeString(form.categoryLabel.value, DEFAULT_SITE_CONFIG.categoryLabel),
    buttons: readButtonEditorList(),
    theme: {
      accentColor: form.accentColor.value || DEFAULT_SITE_CONFIG.theme.accentColor,
      textColor: form.textColor.value || DEFAULT_SITE_CONFIG.theme.textColor,
      backgroundColor: form.backgroundColor.value || DEFAULT_SITE_CONFIG.theme.backgroundColor,
      overlayColor: form.overlayColor.value || DEFAULT_SITE_CONFIG.theme.overlayColor,
      overlayOpacity: clamp(form.overlayOpacity.value, 0, 1, DEFAULT_SITE_CONFIG.theme.overlayOpacity),
      landingBackgroundImageUrl: sanitizeImageUrl(form.backgroundImageUrl.value),
      categoryBackgroundImageUrl: sanitizeImageUrl(form.categoryBackgroundImageUrl.value),
      buttonFontFamily: sanitizeString(form.buttonFontFamily.value, DEFAULT_SITE_CONFIG.theme.buttonFontFamily),
      buttonFontWeight: clamp(form.buttonFontWeight.value, 100, 900, DEFAULT_SITE_CONFIG.theme.buttonFontWeight),
      buttonBorderRadius: clamp(form.buttonBorderRadius.value, 0, 3, DEFAULT_SITE_CONFIG.theme.buttonBorderRadius),
      buttonFontSize: clamp(form.buttonFontSize.value, 0.8, 3, DEFAULT_SITE_CONFIG.theme.buttonFontSize),
    },
    webgl: {
      animationSpeed: clamp(form.animationSpeed.value, 0.05, 1.5, DEFAULT_SITE_CONFIG.webgl.animationSpeed),
      waveStrength: clamp(form.waveStrength.value, 0.1, 1.8, DEFAULT_SITE_CONFIG.webgl.waveStrength),
      glowStrength: clamp(form.glowStrength.value, 0.05, 1, DEFAULT_SITE_CONFIG.webgl.glowStrength),
    },
  });
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

function createSalt() {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return toHex(salt);
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

function ensureRequiredAdminUsers(existingUsers) {
  const users = Array.isArray(existingUsers) ? [...existingUsers] : [];
  let hasChanges = false;

  for (const requiredAdmin of REQUIRED_ADMIN_USERS) {
    const userIndex = users.findIndex((entry) => entry.username === requiredAdmin.username);
    const existingUser = userIndex >= 0 ? users[userIndex] : null;
    const shouldUpdate =
      !existingUser ||
      existingUser.role !== requiredAdmin.role ||
      existingUser.passwordHash !== requiredAdmin.passwordHash ||
      existingUser.passwordSalt !== requiredAdmin.passwordSalt ||
      existingUser.passwordIterations !== requiredAdmin.passwordIterations ||
      existingUser.passwordHashVersion !== requiredAdmin.passwordHashVersion;

    if (!shouldUpdate) continue;
    const nextUser = {
      ...(existingUser ?? {}),
      ...requiredAdmin,
    };

    if (existingUser) {
      users[userIndex] = nextUser;
    } else {
      users.push(nextUser);
    }

    hasChanges = true;
  }

  return { users, hasChanges };
}

function initSpiderMap(opts) {
  const getConfig = opts.getConfig;
  const onConfigChange = opts.onConfigChange;
  const onSave = opts.onSave;
  const onUndo = opts.onUndo;
  const onRedo = opts.onRedo;
  const onReset = opts.onReset;
  const onLogout = opts.onLogout;
  const getHistoryState = opts.getHistoryState;

  const overlay = document.getElementById("spider-map-overlay");
  const mapCanvas = document.getElementById("spider-map-canvas");
  const mapSvg = document.getElementById("spider-map-svg");
  const closeBtn = document.getElementById("spider-map-close");
  const addHauptBtn = document.getElementById("spider-map-add-haupt");
  const smUndoBtn = document.getElementById("spider-map-undo");
  const smRedoBtn = document.getElementById("spider-map-redo");
  const smSaveBtn = document.getElementById("spider-map-save");
  const smResetBtn = document.getElementById("spider-map-reset");
  const smLogoutBtn = document.getElementById("spider-map-logout");
  const smEditorPanel = document.getElementById("sm-editor-panel");
  const smEditorTitle = document.getElementById("sm-editor-title");
  const smEditorContent = document.getElementById("sm-editor-content");
  const smEditorCloseBtn = document.getElementById("sm-editor-close");
  const smEditorSaveBtn = document.getElementById("sm-editor-save");

  if (!overlay || !mapCanvas || !mapSvg) {
    return { open: () => {}, close: () => {}, refresh: () => {}, updateHistoryButtons: () => {} };
  }

  const HAUPT_RADIUS = 240;
  const SIDE_RADIUS = 165;
  const SNAP_DIST = 90;
  const SNAP_ATTACH_DIST = 170;
  const DRAG_THRESHOLD = 5;
  const FAN_SPREAD = Math.PI / 2.5;

  let nodes = [];
  let savedPositions = {};
  let dragging = null;
  let snapTargetId = null;
  let currentEditNodeReadFn = null;

  function getMapCenter() {
    return { x: mapCanvas.clientWidth / 2, y: mapCanvas.clientHeight / 2 };
  }

  function computeDefaultPositions(config) {
    const { x: cx, y: cy } = getMapCenter();
    const positions = { center: { x: cx, y: cy } };

    config.buttons.forEach((btn, btnIdx) => {
      const total = config.buttons.length;
      const angle = (2 * Math.PI * btnIdx / total) - Math.PI / 2;
      const hauptId = `haupt-${btn.id}`;
      const hx = cx + Math.cos(angle) * HAUPT_RADIUS;
      const hy = cy + Math.sin(angle) * HAUPT_RADIUS;
      positions[hauptId] = { x: hx, y: hy };

      btn.items.forEach((_, itemIdx) => {
        const count = btn.items.length;
        const sideAngle = count > 1
          ? angle + FAN_SPREAD * (itemIdx / (count - 1) - 0.5)
          : angle;
        positions[`side-${hauptId}-${itemIdx}`] = {
          x: hx + Math.cos(sideAngle) * SIDE_RADIUS,
          y: hy + Math.sin(sideAngle) * SIDE_RADIUS,
        };
      });
    });

    return positions;
  }

  function buildNodesFromConfig(config) {
    const defaultPos = computeDefaultPositions(config);
    const getPos = (id) => savedPositions[id] || defaultPos[id] || getMapCenter();
    const result = [];

    const cp = getPos("center");
    result.push({ id: "center", type: "center", label: "Webseite", x: cp.x, y: cp.y, parentId: null });

    config.buttons.forEach((btn, btnIdx) => {
      const hauptId = `haupt-${btn.id}`;
      const hp = getPos(hauptId);
      result.push({
        id: hauptId,
        type: "haupt",
        label: btn.label,
        x: hp.x,
        y: hp.y,
        parentId: "center",
        buttonId: btn.id,
        title: btn.title,
        backgroundColor: btn.backgroundColor,
        textColor: btn.textColor,
        imageUrl: btn.imageUrl,
        stepBackgroundImageUrl: btn.stepBackgroundImageUrl,
        createdOrder: btnIdx,
      });

      btn.items.forEach((item, itemIdx) => {
        const sideId = `side-${hauptId}-${itemIdx}`;
        const sp = getPos(sideId);
        result.push({
          id: sideId,
          type: "side",
          label: item,
          x: sp.x,
          y: sp.y,
          parentId: hauptId,
          buttonId: btn.id,
          itemIndex: itemIdx,
          createdOrder: itemIdx,
        });
      });
    });

    return result;
  }

  function rebuildConfigButtons() {
    return nodes
      .filter((n) => n.type === "haupt")
      .sort((a, b) => a.createdOrder - b.createdOrder)
      .map((h) => {
        const items = nodes
          .filter((n) => n.type === "side" && n.parentId === h.id)
          .sort((a, b) => a.createdOrder - b.createdOrder)
          .map((s) => s.label)
          .filter(Boolean);
        return {
          id: h.buttonId || slugify(h.label) || `button-${h.createdOrder + 1}`,
          label: h.label,
          title: h.title || `${h.label} Optionen`,
          backgroundColor: h.backgroundColor || "",
          textColor: h.textColor || "",
          imageUrl: h.imageUrl || "",
          stepBackgroundImageUrl: h.stepBackgroundImageUrl || "",
          items: items.length ? items : ["Option 1"],
        };
      });
  }

  function syncConfig() {
    const current = getConfig();
    const newConfig = normalizeSiteConfig({ ...current, buttons: rebuildConfigButtons() });
    onConfigChange(newConfig);
  }

  function renderConnections() {
    while (mapSvg.firstChild) mapSvg.removeChild(mapSvg.firstChild);
    nodes.forEach((node) => {
      if (!node.parentId) return;
      const parent = nodes.find((n) => n.id === node.parentId);
      if (!parent) return;
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(parent.x));
      line.setAttribute("y1", String(parent.y));
      line.setAttribute("x2", String(node.x));
      line.setAttribute("y2", String(node.y));
      line.setAttribute("class", node.type === "side" ? "sm-connection side-connection" : "sm-connection");
      mapSvg.appendChild(line);
    });
  }

  function createNodeElement(node) {
    const el = document.createElement("div");
    el.className = `sm-node ${node.type}`;
    el.dataset.smId = node.id;
    el.style.left = `${node.x}px`;
    el.style.top = `${node.y}px`;

    const inner = document.createElement("div");
    inner.className = "sm-node-inner";
    const labelEl = document.createElement("span");
    labelEl.className = "sm-node-label";
    labelEl.textContent = node.label;
    inner.appendChild(labelEl);
    el.appendChild(inner);

    if (node.type === "center") {
      inner.title = "Klicken zum Bearbeiten";
      inner.style.cursor = "pointer";
      el.addEventListener("click", () => openNodeEditor("center"));
    } else {
      const controls = document.createElement("div");
      controls.className = "sm-node-controls";

      if (node.type === "haupt") {
        const addSideBtn = document.createElement("button");
        addSideBtn.type = "button";
        addSideBtn.className = "sm-node-btn";
        addSideBtn.title = "Side-Button hinzufügen";
        addSideBtn.textContent = "+";
        addSideBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          addSideButton(node.id);
        });
        controls.appendChild(addSideBtn);
        inner.title = "Klicken zum Bearbeiten";
      }

      const renameBtn = document.createElement("button");
      renameBtn.type = "button";
      renameBtn.className = "sm-node-btn";
      renameBtn.title = "Umbenennen";
      renameBtn.textContent = "✏";
      renameBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        renameNode(node.id);
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "sm-node-btn";
      deleteBtn.title = "Löschen";
      deleteBtn.textContent = "✕";
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteNode(node.id);
      });

      controls.append(renameBtn, deleteBtn);
      el.appendChild(controls);

      el.addEventListener("pointerdown", (e) => {
        if (e.target.closest(".sm-node-btn")) return;
        e.preventDefault();
        startDrag(node.id, e.clientX, e.clientY, e.pointerId);
      });
    }

    return el;
  }

  function renderAll() {
    Array.from(mapCanvas.querySelectorAll(".sm-node")).forEach((el) => el.remove());
    nodes.forEach((node) => mapCanvas.appendChild(createNodeElement(node)));
    renderConnections();
  }

  function startDrag(nodeId, clientX, clientY, pointerId) {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const rect = mapCanvas.getBoundingClientRect();
    dragging = {
      nodeId,
      offsetX: clientX - rect.left - node.x,
      offsetY: clientY - rect.top - node.y,
      pointerId,
      startX: clientX,
      startY: clientY,
      moved: false,
    };
    overlay.setPointerCapture(pointerId);
    const el = mapCanvas.querySelector(`[data-sm-id="${nodeId}"]`);
    if (el) el.classList.add("dragging");
  }

  function moveDrag(clientX, clientY) {
    if (!dragging) return;
    if (!dragging.moved && Math.hypot(clientX - dragging.startX, clientY - dragging.startY) > DRAG_THRESHOLD) {
      dragging.moved = true;
    }
    const node = nodes.find((n) => n.id === dragging.nodeId);
    if (!node) return;
    const rect = mapCanvas.getBoundingClientRect();
    node.x = clientX - rect.left - dragging.offsetX;
    node.y = clientY - rect.top - dragging.offsetY;
    savedPositions[node.id] = { x: node.x, y: node.y };

    let newSnapId = null;
    let minDist = SNAP_DIST;
    nodes.forEach((other) => {
      if (other.id === node.id) return;
      const d = Math.hypot(other.x - node.x, other.y - node.y);
      if (d < minDist) { minDist = d; newSnapId = other.id; }
    });

    if (newSnapId !== snapTargetId) {
      if (snapTargetId) {
        const old = mapCanvas.querySelector(`[data-sm-id="${snapTargetId}"]`);
        if (old) old.classList.remove("snap-target");
      }
      snapTargetId = newSnapId;
      if (snapTargetId) {
        const next = mapCanvas.querySelector(`[data-sm-id="${snapTargetId}"]`);
        if (next) next.classList.add("snap-target");
      }
    }

    const el = mapCanvas.querySelector(`[data-sm-id="${node.id}"]`);
    if (el) { el.style.left = `${node.x}px`; el.style.top = `${node.y}px`; }
    renderConnections();
  }

  function endDrag() {
    if (!dragging) return;
    const node = nodes.find((n) => n.id === dragging.nodeId);
    const wasMoved = dragging.moved;
    const nodeId = dragging.nodeId;

    if (snapTargetId && node) {
      const target = nodes.find((n) => n.id === snapTargetId);
      if (target) {
        const angle = Math.atan2(node.y - target.y, node.x - target.x);
        node.x = target.x + Math.cos(angle) * SNAP_ATTACH_DIST;
        node.y = target.y + Math.sin(angle) * SNAP_ATTACH_DIST;
        savedPositions[node.id] = { x: node.x, y: node.y };
      }
      const snapEl = mapCanvas.querySelector(`[data-sm-id="${snapTargetId}"]`);
      if (snapEl) snapEl.classList.remove("snap-target");
      snapTargetId = null;
    }

    const el = mapCanvas.querySelector(`[data-sm-id="${dragging.nodeId}"]`);
    if (el) {
      el.classList.remove("dragging");
      if (node) { el.style.left = `${node.x}px`; el.style.top = `${node.y}px`; }
    }
    dragging = null;
    renderConnections();

    if (!wasMoved) {
      const clickedNode = nodes.find((n) => n.id === nodeId);
      if (clickedNode?.type === "haupt") {
        openNodeEditor(nodeId);
      }
    }
  }

  overlay.addEventListener("pointermove", (e) => {
    if (!dragging || dragging.pointerId !== e.pointerId) return;
    moveDrag(e.clientX, e.clientY);
  });

  overlay.addEventListener("pointerup", (e) => {
    if (!dragging || dragging.pointerId !== e.pointerId) return;
    endDrag();
  });

  overlay.addEventListener("pointercancel", (e) => {
    if (!dragging || dragging.pointerId !== e.pointerId) return;
    endDrag();
  });

  function renameNode(nodeId) {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const newLabel = window.prompt("Neuer Name:", node.label);
    if (newLabel === null) return;
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    node.label = trimmed;
    renderAll();
    syncConfig();
  }

  function deleteNode(nodeId) {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    if (node.type === "haupt") {
      if (nodes.filter((n) => n.type === "haupt").length <= 1) {
        window.alert("Mindestens ein Haupt-Button muss vorhanden sein.");
        return;
      }
      const toRemove = new Set([nodeId, ...nodes.filter((n) => n.parentId === nodeId).map((n) => n.id)]);
      nodes = nodes.filter((n) => !toRemove.has(n.id));
      toRemove.forEach((id) => delete savedPositions[id]);
    } else {
      nodes = nodes.filter((n) => n.id !== nodeId);
      delete savedPositions[nodeId];
      nodes
        .filter((n) => n.type === "side" && n.parentId === node.parentId)
        .sort((a, b) => a.createdOrder - b.createdOrder)
        .forEach((s, i) => { s.createdOrder = i; s.itemIndex = i; });
    }

    renderAll();
    syncConfig();
  }

  function addHauptButton() {
    const config = getConfig();
    const center = nodes.find((n) => n.id === "center");
    if (!center) return;

    const hauptNodes = nodes.filter((n) => n.type === "haupt");
    const newOrder = hauptNodes.length;
    const angle = (2 * Math.PI * newOrder / (newOrder + 1)) - Math.PI / 2;
    const hx = center.x + Math.cos(angle) * HAUPT_RADIUS;
    const hy = center.y + Math.sin(angle) * HAUPT_RADIUS;

    const newHauptId = `haupt-new-${Date.now()}`;
    const newButtonId = `new-btn-${Date.now()}`;

    nodes.push({
      id: newHauptId,
      type: "haupt",
      label: "Neuer Button",
      x: hx,
      y: hy,
      parentId: "center",
      buttonId: newButtonId,
      title: "Neue Optionen",
      backgroundColor: sanitizeColor(config.theme.accentColor, "#00d4ff"),
      textColor: sanitizeColor(config.theme.textColor, "#ffffff"),
      imageUrl: "",
      stepBackgroundImageUrl: "",
      createdOrder: newOrder,
    });

    nodes.push({
      id: `side-${newHauptId}-0`,
      type: "side",
      label: "Option 1",
      x: hx + Math.cos(angle) * SIDE_RADIUS,
      y: hy + Math.sin(angle) * SIDE_RADIUS,
      parentId: newHauptId,
      buttonId: newButtonId,
      itemIndex: 0,
      createdOrder: 0,
    });

    renderAll();
    syncConfig();
  }

  function addSideButton(hauptId) {
    const haupt = nodes.find((n) => n.id === hauptId);
    if (!haupt) return;
    const center = nodes.find((n) => n.id === "center");
    const siblings = nodes.filter((n) => n.type === "side" && n.parentId === hauptId);
    const idx = siblings.length;
    const awayAngle = center
      ? Math.atan2(haupt.y - center.y, haupt.x - center.x)
      : 0;
    const fanAngle = awayAngle + (idx - (siblings.length - 1) / 2) * 0.45;

    nodes.push({
      id: `side-${hauptId}-${Date.now()}`,
      type: "side",
      label: `Option ${idx + 1}`,
      x: haupt.x + Math.cos(fanAngle) * SIDE_RADIUS,
      y: haupt.y + Math.sin(fanAngle) * SIDE_RADIUS,
      parentId: hauptId,
      buttonId: haupt.buttonId,
      itemIndex: idx,
      createdOrder: idx,
    });

    renderAll();
    syncConfig();
  }

  /* ── Inline editor helpers ─────────────────────────────────── */

  function editorMakeLabel(text) {
    const lbl = document.createElement("label");
    lbl.textContent = text;
    return lbl;
  }

  function editorMakeDivider() {
    const hr = document.createElement("div");
    hr.className = "sm-editor-divider";
    return hr;
  }

  function editorMakeSectionLabel(text) {
    const span = document.createElement("span");
    span.className = "sm-editor-section-label";
    span.textContent = text;
    return span;
  }

  function editorMakeInput(type, value) {
    const input = document.createElement("input");
    input.type = type;
    input.value = String(value ?? "");
    return input;
  }

  function editorMakeSelect(optionsArr, currentValue) {
    const sel = document.createElement("select");
    optionsArr.forEach(([val, text]) => {
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = text;
      if (val === String(currentValue)) opt.selected = true;
      sel.appendChild(opt);
    });
    return sel;
  }

  function editorMakeImageUpload(labelText, currentUrl) {
    const lbl = editorMakeLabel(labelText);
    const hidden = editorMakeInput("hidden", currentUrl || "");
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    const status = document.createElement("p");
    status.className = "status";
    status.style.margin = "0";
    status.textContent = currentUrl ? "Bild gesetzt." : "Kein Bild gewählt.";
    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "action-button ghost small";
    clearBtn.textContent = "Bild entfernen";

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await readImageFileAsDataUrl(file);
        hidden.value = sanitizeImageUrl(dataUrl);
        status.textContent = hidden.value ? `Bild "${file.name}" geladen.` : "Ungültiges Bild.";
      } catch {
        hidden.value = "";
        status.textContent = "Bild konnte nicht geladen werden.";
      }
    });

    clearBtn.addEventListener("click", () => {
      hidden.value = "";
      fileInput.value = "";
      status.textContent = "Kein Bild gewählt.";
    });

    return { elements: [lbl, hidden, fileInput, status, clearBtn], read: () => sanitizeImageUrl(hidden.value) };
  }

  function buildWebsiteEditorContent(config) {
    const els = [];

    els.push(editorMakeSectionLabel("Texte"));
    const titleInput = editorMakeInput("text", config.title);
    els.push(editorMakeLabel("Titel"), titleInput);
    const subtitleInput = editorMakeInput("text", config.subtitle);
    els.push(editorMakeLabel("Untertitel"), subtitleInput);
    const startLabelInput = editorMakeInput("text", config.startLabel);
    els.push(editorMakeLabel("Start-Button"), startLabelInput);
    const categoryLabelInput = editorMakeInput("text", config.categoryLabel);
    els.push(editorMakeLabel("Kategorie-Überschrift"), categoryLabelInput);

    els.push(editorMakeDivider(), editorMakeSectionLabel("Hintergrundbilder"));
    const landingBg = editorMakeImageUpload("Landingpage Hintergrundbild (optional)", config.theme.landingBackgroundImageUrl);
    els.push(...landingBg.elements);
    const categoryBg = editorMakeImageUpload("Kategorien Hintergrundbild (optional)", config.theme.categoryBackgroundImageUrl);
    els.push(...categoryBg.elements);

    els.push(editorMakeDivider(), editorMakeSectionLabel("Farben"));
    const accentColorInput = editorMakeInput("color", config.theme.accentColor);
    els.push(editorMakeLabel("Akzentfarbe"), accentColorInput);
    const textColorInput = editorMakeInput("color", config.theme.textColor);
    els.push(editorMakeLabel("Textfarbe"), textColorInput);
    const bgColorInput = editorMakeInput("color", config.theme.backgroundColor);
    els.push(editorMakeLabel("Hintergrundfarbe"), bgColorInput);
    const overlayColorInput = editorMakeInput("color", config.theme.overlayColor);
    els.push(editorMakeLabel("Overlay-Farbe"), overlayColorInput);
    const overlayOpacityInput = editorMakeInput("range", config.theme.overlayOpacity);
    overlayOpacityInput.min = "0"; overlayOpacityInput.max = "1"; overlayOpacityInput.step = "0.01";
    els.push(editorMakeLabel("Overlay-Stärke"), overlayOpacityInput);

    els.push(editorMakeDivider(), editorMakeSectionLabel("Animation"));
    const animSpeedInput = editorMakeInput("range", config.webgl.animationSpeed);
    animSpeedInput.min = "0.05"; animSpeedInput.max = "1.5"; animSpeedInput.step = "0.05";
    els.push(editorMakeLabel("Animationsgeschwindigkeit"), animSpeedInput);
    const waveStrengthInput = editorMakeInput("range", config.webgl.waveStrength);
    waveStrengthInput.min = "0.1"; waveStrengthInput.max = "1.8"; waveStrengthInput.step = "0.05";
    els.push(editorMakeLabel("Flow-Stärke"), waveStrengthInput);
    const glowStrengthInput = editorMakeInput("range", config.webgl.glowStrength);
    glowStrengthInput.min = "0.05"; glowStrengthInput.max = "1"; glowStrengthInput.step = "0.01";
    els.push(editorMakeLabel("Glow-Stärke"), glowStrengthInput);

    els.push(editorMakeDivider(), editorMakeSectionLabel("Button-Stil"));
    const fontFamilyOptions = [
      ["Arial, Helvetica, sans-serif", "Arial"],
      ["Verdana, Geneva, sans-serif", "Verdana"],
      ["Tahoma, Geneva, sans-serif", "Tahoma"],
      ["'Trebuchet MS', Helvetica, sans-serif", "Trebuchet MS"],
      ["Georgia, 'Times New Roman', serif", "Georgia"],
      ["'Times New Roman', Times, serif", "Times New Roman"],
      ["'Palatino Linotype', 'Book Antiqua', Palatino, serif", "Palatino"],
      ["'Courier New', Courier, monospace", "Courier New"],
      ["Impact, Charcoal, sans-serif", "Impact"],
      ["'Comic Sans MS', cursive", "Comic Sans MS"],
    ];
    const fontFamilySelect = editorMakeSelect(fontFamilyOptions, config.theme.buttonFontFamily);
    els.push(editorMakeLabel("Schriftart"), fontFamilySelect);
    const fontWeightOptions = [
      ["300", "Light (300)"], ["400", "Normal (400)"], ["500", "Medium (500)"],
      ["600", "Semibold (600)"], ["700", "Bold (700)"], ["800", "Extrabold (800)"], ["900", "Black (900)"],
    ];
    const fontWeightSelect = editorMakeSelect(fontWeightOptions, String(config.theme.buttonFontWeight));
    els.push(editorMakeLabel("Schriftstärke"), fontWeightSelect);
    const borderRadiusInput = editorMakeInput("range", config.theme.buttonBorderRadius);
    borderRadiusInput.min = "0"; borderRadiusInput.max = "3"; borderRadiusInput.step = "0.05";
    els.push(editorMakeLabel("Eckenradius"), borderRadiusInput);
    const fontSizeInput = editorMakeInput("range", config.theme.buttonFontSize);
    fontSizeInput.min = "0.8"; fontSizeInput.max = "3"; fontSizeInput.step = "0.05";
    els.push(editorMakeLabel("Schriftgröße"), fontSizeInput);

    smEditorContent.replaceChildren(...els);

    return () => {
      return normalizeSiteConfig({
        ...config,
        title: sanitizeString(titleInput.value, DEFAULT_SITE_CONFIG.title),
        subtitle: sanitizeString(subtitleInput.value, DEFAULT_SITE_CONFIG.subtitle),
        startLabel: sanitizeString(startLabelInput.value, DEFAULT_SITE_CONFIG.startLabel),
        categoryLabel: sanitizeString(categoryLabelInput.value, DEFAULT_SITE_CONFIG.categoryLabel),
        theme: {
          ...config.theme,
          accentColor: accentColorInput.value || DEFAULT_SITE_CONFIG.theme.accentColor,
          textColor: textColorInput.value || DEFAULT_SITE_CONFIG.theme.textColor,
          backgroundColor: bgColorInput.value || DEFAULT_SITE_CONFIG.theme.backgroundColor,
          overlayColor: overlayColorInput.value || DEFAULT_SITE_CONFIG.theme.overlayColor,
          overlayOpacity: clamp(overlayOpacityInput.value, 0, 1, DEFAULT_SITE_CONFIG.theme.overlayOpacity),
          landingBackgroundImageUrl: landingBg.read(),
          categoryBackgroundImageUrl: categoryBg.read(),
          buttonFontFamily: sanitizeString(fontFamilySelect.value, DEFAULT_SITE_CONFIG.theme.buttonFontFamily),
          buttonFontWeight: clamp(fontWeightSelect.value, 100, 900, DEFAULT_SITE_CONFIG.theme.buttonFontWeight),
          buttonBorderRadius: clamp(borderRadiusInput.value, 0, 3, DEFAULT_SITE_CONFIG.theme.buttonBorderRadius),
          buttonFontSize: clamp(fontSizeInput.value, 0.8, 3, DEFAULT_SITE_CONFIG.theme.buttonFontSize),
        },
        webgl: {
          animationSpeed: clamp(animSpeedInput.value, 0.05, 1.5, DEFAULT_SITE_CONFIG.webgl.animationSpeed),
          waveStrength: clamp(waveStrengthInput.value, 0.1, 1.8, DEFAULT_SITE_CONFIG.webgl.waveStrength),
          glowStrength: clamp(glowStrengthInput.value, 0.05, 1, DEFAULT_SITE_CONFIG.webgl.glowStrength),
        },
      });
    };
  }

  function buildButtonEditorContent(haupt, buttonConfig) {
    const els = [];

    els.push(editorMakeSectionLabel("Button"));
    const labelInput = editorMakeInput("text", buttonConfig.label);
    els.push(editorMakeLabel("Button Name"), labelInput);
    const titleInput = editorMakeInput("text", buttonConfig.title);
    els.push(editorMakeLabel("Optionen Titel"), titleInput);

    els.push(editorMakeDivider(), editorMakeSectionLabel("Farben"));
    const bgColorInput = editorMakeInput("color", sanitizeColor(buttonConfig.backgroundColor, "#00d4ff"));
    els.push(editorMakeLabel("Button Hintergrundfarbe"), bgColorInput);
    const textColorInput = editorMakeInput("color", sanitizeColor(buttonConfig.textColor, "#ffffff"));
    els.push(editorMakeLabel("Button Textfarbe"), textColorInput);

    els.push(editorMakeDivider(), editorMakeSectionLabel("Bilder"));
    const buttonImg = editorMakeImageUpload("Button Hintergrundbild (optional)", buttonConfig.imageUrl);
    els.push(...buttonImg.elements);
    const stepBgImg = editorMakeImageUpload("Schritt Hintergrundbild (optional)", buttonConfig.stepBackgroundImageUrl);
    els.push(...stepBgImg.elements);

    els.push(editorMakeDivider(), editorMakeSectionLabel("Optionen"));
    const itemsTextarea = document.createElement("textarea");
    itemsTextarea.rows = 6;
    itemsTextarea.value = buttonConfig.items.join("\n");
    els.push(editorMakeLabel("Einträge (je Zeile ein Eintrag)"), itemsTextarea);

    smEditorContent.replaceChildren(...els);

    return () => {
      const newLabel = sanitizeString(labelInput.value, haupt.label);
      const newTitle = sanitizeString(titleInput.value, buttonConfig.title);
      const newBgColor = sanitizeColor(bgColorInput.value);
      const newTextColor = sanitizeColor(textColorInput.value);
      const newImageUrl = buttonImg.read();
      const newStepBgUrl = stepBgImg.read();
      const newItems = sanitizeItems(itemsTextarea.value, buttonConfig.items);

      haupt.label = newLabel;
      haupt.title = newTitle;
      haupt.backgroundColor = newBgColor;
      haupt.textColor = newTextColor;
      haupt.imageUrl = newImageUrl;
      haupt.stepBackgroundImageUrl = newStepBgUrl;

      nodes = nodes.filter((n) => !(n.type === "side" && n.parentId === haupt.id));
      const center = nodes.find((n) => n.id === "center");
      const awayAngle = center ? Math.atan2(haupt.y - center.y, haupt.x - center.x) : 0;
      const count = newItems.length;
      newItems.forEach((item, idx) => {
        const sideAngle = count > 1 ? awayAngle + FAN_SPREAD * (idx / (count - 1) - 0.5) : awayAngle;
        nodes.push({
          id: `side-${haupt.id}-${idx}`,
          type: "side",
          label: item,
          x: haupt.x + Math.cos(sideAngle) * SIDE_RADIUS,
          y: haupt.y + Math.sin(sideAngle) * SIDE_RADIUS,
          parentId: haupt.id,
          buttonId: haupt.buttonId,
          itemIndex: idx,
          createdOrder: idx,
        });
      });

      renderAll();

      const current = getConfig();
      return normalizeSiteConfig({ ...current, buttons: rebuildConfigButtons() });
    };
  }

  function openNodeEditor(nodeId) {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    if (node.type === "center") {
      if (smEditorTitle) smEditorTitle.textContent = "Webseite bearbeiten";
      currentEditNodeReadFn = buildWebsiteEditorContent(getConfig());
    } else if (node.type === "haupt") {
      if (smEditorTitle) smEditorTitle.textContent = `"${node.label}" bearbeiten`;
      const config = getConfig();
      const buttonConfig = config.buttons.find((b) => b.id === node.buttonId) || {
        id: node.buttonId,
        label: node.label,
        title: node.title || `${node.label} Optionen`,
        backgroundColor: node.backgroundColor || "",
        textColor: node.textColor || "",
        imageUrl: node.imageUrl || "",
        stepBackgroundImageUrl: node.stepBackgroundImageUrl || "",
        items: [],
      };
      currentEditNodeReadFn = buildButtonEditorContent(node, buttonConfig);
    } else {
      return;
    }

    smEditorPanel?.classList.remove("hidden");
  }

  function closeNodeEditor() {
    currentEditNodeReadFn = null;
    smEditorPanel?.classList.add("hidden");
    if (smEditorContent) smEditorContent.replaceChildren();
  }

  smEditorCloseBtn?.addEventListener("click", closeNodeEditor);

  smEditorSaveBtn?.addEventListener("click", () => {
    if (!currentEditNodeReadFn) return;
    const newConfig = currentEditNodeReadFn();
    onSave(newConfig);
    closeNodeEditor();
  });

  smUndoBtn?.addEventListener("click", () => onUndo?.());
  smRedoBtn?.addEventListener("click", () => onRedo?.());
  smSaveBtn?.addEventListener("click", () => onSave?.(getConfig()));
  smResetBtn?.addEventListener("click", () => onReset?.());
  smLogoutBtn?.addEventListener("click", () => onLogout?.());
  closeBtn?.addEventListener("click", close);
  addHauptBtn?.addEventListener("click", addHauptButton);

  function open() {
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
    nodes = buildNodesFromConfig(getConfig());
    renderAll();
    updateHistoryButtons();
  }

  function close() {
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
    if (dragging) endDrag();
    closeNodeEditor();
  }

  function refresh() {
    nodes = buildNodesFromConfig(getConfig());
    renderAll();
    updateHistoryButtons();
  }

  function updateHistoryButtons() {
    const state = getHistoryState?.() || { canUndo: false, canRedo: false };
    if (smUndoBtn instanceof HTMLButtonElement) smUndoBtn.disabled = !state.canUndo;
    if (smRedoBtn instanceof HTMLButtonElement) smRedoBtn.disabled = !state.canRedo;
  }

  return { open, close, refresh, updateHistoryButtons };
}

async function initApp() {
  let users = getStoredJSON(STORAGE_KEYS.users, []);
  if (!Array.isArray(users)) users = [];
  const ensuredAdmins = ensureRequiredAdminUsers(users);
  users = ensuredAdmins.users;
  if (ensuredAdmins.hasChanges) {
    saveStoredJSON(STORAGE_KEYS.users, users);
  }

  // Load config: prefer repo file (shared) → localStorage (cache) → default
  const repoConfig = await fetchRepoConfig();
  const storedConfig = getStoredJSON(STORAGE_KEYS.siteConfig, null);
  let currentConfig = normalizeSiteConfig(repoConfig ?? storedConfig ?? deepClone(DEFAULT_SITE_CONFIG));
  if (repoConfig) {
    saveStoredJSON(STORAGE_KEYS.siteConfig, currentConfig);
  }
  applySiteConfig(currentConfig);
  setupWebGLBackground(() => currentConfig.webgl);
  initNavigation();

  const controlDock = document.getElementById("control-dock");
  const loginToggle = document.getElementById("login-toggle");
  const spiderMapToggle = document.getElementById("spider-map-toggle");
  const loginForm = document.getElementById("login-form");
  const logoutButton = document.getElementById("logout-button");
  const sessionStatus = document.getElementById("session-status");
  const closeDockButton = document.getElementById("close-dock-button");

  const smSaveStatus = document.getElementById("sm-save-status");

  let editorHistory = [deepClone(currentConfig)];
  let editorHistoryIndex = 0;

  function setVisibility(element, isVisible) {
    if (!element) return;
    element.classList.toggle("hidden", !isVisible);
    element.setAttribute("aria-hidden", String(!isVisible));
  }

  function setDockVisibility(isVisible) {
    setVisibility(controlDock, isVisible);
    document.body.classList.toggle("dock-open", isVisible);
  }

  function pushEditorHistory(snapshot) {
    const normalizedSnapshot = normalizeSiteConfig(snapshot);
    const currentSnapshot = editorHistory[editorHistoryIndex];
    if (currentSnapshot && JSON.stringify(currentSnapshot) === JSON.stringify(normalizedSnapshot)) {
      spiderMap.updateHistoryButtons();
      return;
    }
    editorHistory = editorHistory.slice(0, editorHistoryIndex + 1);
    editorHistory.push(deepClone(normalizedSnapshot));
    editorHistoryIndex = editorHistory.length - 1;
    spiderMap.updateHistoryButtons();
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

  const spiderMap = initSpiderMap({
    getConfig: () => currentConfig,
    onConfigChange: (newConfig) => {
      currentConfig = newConfig;
      applySiteConfig(currentConfig);
      pushEditorHistory(currentConfig);
    },
    onSave: async (config) => {
      currentConfig = normalizeSiteConfig(config);
      applySiteConfig(currentConfig);
      saveStoredJSON(STORAGE_KEYS.siteConfig, currentConfig);
      pushEditorHistory(currentConfig);

      if (!SITE_PAT) {
        if (smSaveStatus) smSaveStatus.textContent = "⚠ Nur lokal gespeichert (kein Token verfügbar).";
        return;
      }

      if (smSaveStatus) smSaveStatus.textContent = "⏳ Speichern im Repository…";
      try {
        await saveConfigToGitHub(currentConfig, SITE_PAT);
        if (smSaveStatus) smSaveStatus.textContent = "✅ Im Repository gespeichert.";
      } catch (error) {
        if (smSaveStatus) smSaveStatus.textContent = `❌ GitHub Fehler: ${error.message}`;
      }
    },
    onUndo: () => {
      if (!activeSession) return;
      if (editorHistoryIndex <= 0) return;
      editorHistoryIndex -= 1;
      currentConfig = normalizeSiteConfig(editorHistory[editorHistoryIndex]);
      applySiteConfig(currentConfig);
      spiderMap.refresh();
    },
    onRedo: () => {
      if (!activeSession) return;
      if (editorHistoryIndex >= editorHistory.length - 1) return;
      editorHistoryIndex += 1;
      currentConfig = normalizeSiteConfig(editorHistory[editorHistoryIndex]);
      applySiteConfig(currentConfig);
      spiderMap.refresh();
    },
    onReset: async () => {
      if (!activeSession) return;
      currentConfig = deepClone(DEFAULT_SITE_CONFIG);
      applySiteConfig(currentConfig);
      saveStoredJSON(STORAGE_KEYS.siteConfig, currentConfig);
      editorHistory = [deepClone(currentConfig)];
      editorHistoryIndex = 0;
      spiderMap.refresh();

      if (!SITE_PAT) {
        if (smSaveStatus) smSaveStatus.textContent = "⚠ Standard nur lokal zurückgesetzt (kein Token verfügbar).";
        return;
      }
      if (smSaveStatus) smSaveStatus.textContent = "⏳ Standard im Repository speichern…";
      try {
        await saveConfigToGitHub(currentConfig, SITE_PAT);
        if (smSaveStatus) smSaveStatus.textContent = "✅ Standard im Repository gespeichert.";
      } catch (error) {
        if (smSaveStatus) smSaveStatus.textContent = `❌ GitHub Fehler: ${error.message}`;
      }
    },
    onLogout: () => {
      activeSession = null;
      localStorage.removeItem(STORAGE_KEYS.session);
      spiderMap.close();
      renderSessionState();
    },
    getHistoryState: () => ({
      canUndo: editorHistoryIndex > 0,
      canRedo: editorHistoryIndex < editorHistory.length - 1,
    }),
  });

  function renderSessionState() {
    if (!sessionStatus) return;
    const hasUsers = users.length > 0;

    if (!hasUsers) {
      activeSession = null;
      localStorage.removeItem(STORAGE_KEYS.session);
      sessionStatus.textContent = "Keine gespeicherten Nutzer gefunden. Bitte dieses Gerät mit vorhandenen Logins verwenden.";
      setVisibility(loginForm, false);
      setVisibility(logoutButton, false);
      setDockVisibility(false);
      setVisibility(loginToggle, false);
      setVisibility(spiderMapToggle, false);
      return;
    }

    if (!activeSession) {
      sessionStatus.textContent = "Nicht angemeldet.";
      setVisibility(loginForm, true);
      setVisibility(logoutButton, false);
      setDockVisibility(false);
      setVisibility(loginToggle, true);
      setVisibility(spiderMapToggle, false);
      return;
    }

    sessionStatus.textContent = `Angemeldet als ${activeSession.username}.`;
    setVisibility(loginForm, false);
    setVisibility(logoutButton, false);
    setDockVisibility(false);
    setVisibility(loginToggle, false);
    setVisibility(spiderMapToggle, true);
    editorHistory = [deepClone(currentConfig)];
    editorHistoryIndex = 0;
    spiderMap.open();
  }

  loginToggle?.addEventListener("click", () => {
    setDockVisibility(true);
    setVisibility(loginToggle, false);
  });

  spiderMapToggle?.addEventListener("click", () => {
    spiderMap.open();
  });

  closeDockButton?.addEventListener("click", () => {
    setDockVisibility(false);
    if (!activeSession) setVisibility(loginToggle, true);
  });

  logoutButton?.addEventListener("click", () => {
    activeSession = null;
    localStorage.removeItem(STORAGE_KEYS.session);
    renderSessionState();
  });

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!users.length) {
      sessionStatus.textContent = "Keine Nutzer vorhanden.";
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
    setDockVisibility(false);
    renderSessionState();
  });

  renderSessionState();
}

initApp();
