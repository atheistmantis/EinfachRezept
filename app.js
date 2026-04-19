const canvas = document.getElementById("bg");
const gl = canvas.getContext("webgl");

const STORAGE_KEYS = {
  users: "einfachrezept_users_v1",
  session: "einfachrezept_session_v1",
  siteConfig: "einfachrezept_site_config_v1",
};

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

async function initApp() {
  let users = getStoredJSON(STORAGE_KEYS.users, []);
  if (!Array.isArray(users)) users = [];
  const ensuredAdmins = ensureRequiredAdminUsers(users);
  users = ensuredAdmins.users;
  if (ensuredAdmins.hasChanges) {
    saveStoredJSON(STORAGE_KEYS.users, users);
  }

  let currentConfig = normalizeSiteConfig(getStoredJSON(STORAGE_KEYS.siteConfig, deepClone(DEFAULT_SITE_CONFIG)));
  applySiteConfig(currentConfig);
  populateEditorForm(currentConfig);
  setupWebGLBackground(() => currentConfig.webgl);
  initNavigation();

  const controlDock = document.getElementById("control-dock");
  const loginToggle = document.getElementById("login-toggle");
  const loginForm = document.getElementById("login-form");
  const logoutButton = document.getElementById("logout-button");
  const sessionStatus = document.getElementById("session-status");
  const editorPanel = document.getElementById("editor-panel");
  const editorForm = document.getElementById("editor-form");
  const resetButton = document.getElementById("reset-button");
  const closeDockButton = document.getElementById("close-dock-button");
  const addCategoryButton = document.getElementById("add-category-button");
  const buttonEditList = document.getElementById("button-edit-list");
  const landingBackgroundImageFileInput = document.getElementById("background-image-file-input");
  const clearLandingBackgroundImageButton = document.getElementById("clear-background-image");
  const landingBackgroundImageStatus = document.getElementById("background-image-status");
  const categoryBackgroundImageFileInput = document.getElementById("category-background-image-file-input");
  const clearCategoryBackgroundImageButton = document.getElementById("clear-category-background-image");
  const categoryBackgroundImageStatus = document.getElementById("category-background-image-status");
  const undoButton = document.getElementById("undo-button");
  const redoButton = document.getElementById("redo-button");
  let editorHistory = [deepClone(currentConfig)];
  let editorHistoryIndex = 0;
  let snapshotCaptureTimer = null;

  function setVisibility(element, isVisible) {
    if (!element) return;
    element.classList.toggle("hidden", !isVisible);
    element.setAttribute("aria-hidden", String(!isVisible));
  }

  function setDockVisibility(isVisible) {
    setVisibility(controlDock, isVisible);
    setVisibility(loginToggle, !isVisible);
    loginToggle?.setAttribute("aria-expanded", String(isVisible));
    document.body.classList.toggle("dock-open", isVisible);
  }

  function updateHistoryButtons() {
    if (undoButton instanceof HTMLButtonElement) undoButton.disabled = editorHistoryIndex <= 0;
    if (redoButton instanceof HTMLButtonElement) redoButton.disabled = editorHistoryIndex >= editorHistory.length - 1;
  }

  function applyEditorSnapshot(snapshot) {
    currentConfig = normalizeSiteConfig(snapshot);
    applySiteConfig(currentConfig);
    populateEditorForm(currentConfig);
    hideAllOptionSections();
  }

  function pushEditorHistory(snapshot) {
    const normalizedSnapshot = normalizeSiteConfig(snapshot);
    const currentSnapshot = editorHistory[editorHistoryIndex];
    if (currentSnapshot && JSON.stringify(currentSnapshot) === JSON.stringify(normalizedSnapshot)) {
      updateHistoryButtons();
      return;
    }
    editorHistory = editorHistory.slice(0, editorHistoryIndex + 1);
    editorHistory.push(deepClone(normalizedSnapshot));
    editorHistoryIndex = editorHistory.length - 1;
    updateHistoryButtons();
  }

  function captureEditorSnapshot() {
    if (!activeSession) return;
    pushEditorHistory(readEditorForm(currentConfig));
  }

  function scheduleEditorSnapshot() {
    if (!activeSession) return;
    if (snapshotCaptureTimer) window.clearTimeout(snapshotCaptureTimer);
    snapshotCaptureTimer = window.setTimeout(() => {
      snapshotCaptureTimer = null;
      captureEditorSnapshot();
    }, EDITOR_SNAPSHOT_DEBOUNCE_MS);
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

    if (!hasUsers) {
      activeSession = null;
      localStorage.removeItem(STORAGE_KEYS.session);
      sessionStatus.textContent = "Keine gespeicherten Nutzer gefunden. Bitte dieses Gerät mit vorhandenen Logins verwenden.";
      setVisibility(editorPanel, false);
      setVisibility(loginForm, false);
      setVisibility(logoutButton, false);
      setDockVisibility(false);
      return;
    }

    if (!activeSession) {
      sessionStatus.textContent = "Nicht angemeldet.";
      setVisibility(editorPanel, false);
      setVisibility(loginForm, true);
      setVisibility(logoutButton, false);
      setDockVisibility(false);
      return;
    }

    sessionStatus.textContent = `Angemeldet als ${activeSession.username}.`;
    setVisibility(editorPanel, true);
    setVisibility(loginForm, false);
    setVisibility(logoutButton, true);
    setDockVisibility(true);
    editorHistory = [deepClone(currentConfig)];
    editorHistoryIndex = 0;
    updateHistoryButtons();
  }

  loginToggle?.addEventListener("click", () => {
    setDockVisibility(true);
  });

  closeDockButton?.addEventListener("click", () => {
    setDockVisibility(false);
  });

  buttonEditList?.addEventListener("click", (event) => {
    const removeButton = event.target.closest(".remove-button-item");
    if (!removeButton) return;
    const allItems = buttonEditList.querySelectorAll(".button-edit-item");
    if (allItems.length <= 1) return;
    const item = removeButton.closest(".button-edit-item");
    item?.remove();
    captureEditorSnapshot();
  });

  addCategoryButton?.addEventListener("click", () => {
    if (!buttonEditList) return;
    buttonEditList.append(
      createButtonEditorItem({
        id: crypto.randomUUID(),
        label: "Neuer Button",
        title: "Neue Optionen",
        backgroundColor: sanitizeColor(currentConfig.theme.accentColor, "#00d4ff"),
        textColor: sanitizeColor(currentConfig.theme.textColor, "#ffffff"),
        imageUrl: "",
        stepBackgroundImageUrl: "",
        items: ["Option 1"],
      }),
    );
    captureEditorSnapshot();
  });

  landingBackgroundImageFileInput?.addEventListener("change", async () => {
    if (!(editorForm instanceof HTMLFormElement)) return;
    const file = landingBackgroundImageFileInput.files?.[0];
    if (!file) return;
    try {
      const fileDataUrl = await readImageFileAsDataUrl(file);
      editorForm.backgroundImageUrl.value = sanitizeImageUrl(fileDataUrl);
      if (landingBackgroundImageStatus) {
        landingBackgroundImageStatus.textContent = editorForm.backgroundImageUrl.value
          ? `Bild "${file.name}" geladen.`
          : "Ungültiges Bild.";
      }
      captureEditorSnapshot();
    } catch {
      editorForm.backgroundImageUrl.value = "";
      if (landingBackgroundImageStatus) landingBackgroundImageStatus.textContent = "Bild konnte nicht geladen werden.";
    }
  });

  clearLandingBackgroundImageButton?.addEventListener("click", () => {
    if (!(editorForm instanceof HTMLFormElement)) return;
    editorForm.backgroundImageUrl.value = "";
    if (landingBackgroundImageFileInput instanceof HTMLInputElement) {
      landingBackgroundImageFileInput.value = "";
    }
    if (landingBackgroundImageStatus) landingBackgroundImageStatus.textContent = "Kein Bild gewählt.";
    captureEditorSnapshot();
  });

  categoryBackgroundImageFileInput?.addEventListener("change", async () => {
    if (!(editorForm instanceof HTMLFormElement)) return;
    const file = categoryBackgroundImageFileInput.files?.[0];
    if (!file) return;
    try {
      const fileDataUrl = await readImageFileAsDataUrl(file);
      editorForm.categoryBackgroundImageUrl.value = sanitizeImageUrl(fileDataUrl);
      if (categoryBackgroundImageStatus) {
        categoryBackgroundImageStatus.textContent = editorForm.categoryBackgroundImageUrl.value
          ? `Bild "${file.name}" geladen.`
          : "Ungültiges Bild.";
      }
      captureEditorSnapshot();
    } catch {
      editorForm.categoryBackgroundImageUrl.value = "";
      if (categoryBackgroundImageStatus) categoryBackgroundImageStatus.textContent = "Bild konnte nicht geladen werden.";
    }
  });

  clearCategoryBackgroundImageButton?.addEventListener("click", () => {
    if (!(editorForm instanceof HTMLFormElement)) return;
    editorForm.categoryBackgroundImageUrl.value = "";
    if (categoryBackgroundImageFileInput instanceof HTMLInputElement) {
      categoryBackgroundImageFileInput.value = "";
    }
    if (categoryBackgroundImageStatus) categoryBackgroundImageStatus.textContent = "Kein Bild gewählt.";
    captureEditorSnapshot();
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
    renderSessionState();
  });

  logoutButton?.addEventListener("click", () => {
    activeSession = null;
    localStorage.removeItem(STORAGE_KEYS.session);
    renderSessionState();
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
    hideAllOptionSections();
    pushEditorHistory(currentConfig);
    sessionStatus.textContent = "Änderungen gespeichert.";
  });

  editorForm?.addEventListener("input", (event) => {
    if (event.target instanceof HTMLInputElement && event.target.type === "file") return;
    scheduleEditorSnapshot();
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
    hideAllOptionSections();
    pushEditorHistory(currentConfig);
    sessionStatus.textContent = "Standardwerte wiederhergestellt.";
  });

  undoButton?.addEventListener("click", () => {
    if (!activeSession) {
      sessionStatus.textContent = "Bitte zuerst anmelden.";
      return;
    }
    if (editorHistoryIndex <= 0) return;
    editorHistoryIndex -= 1;
    applyEditorSnapshot(editorHistory[editorHistoryIndex]);
    updateHistoryButtons();
    sessionStatus.textContent = "Änderung rückgängig gemacht.";
  });

  redoButton?.addEventListener("click", () => {
    if (!activeSession) {
      sessionStatus.textContent = "Bitte zuerst anmelden.";
      return;
    }
    if (editorHistoryIndex >= editorHistory.length - 1) return;
    editorHistoryIndex += 1;
    applyEditorSnapshot(editorHistory[editorHistoryIndex]);
    updateHistoryButtons();
    sessionStatus.textContent = "Änderung wiederhergestellt.";
  });

  renderSessionState();
}

initApp();
