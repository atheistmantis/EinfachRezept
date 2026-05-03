/**
 * @fileoverview Application-wide constants and default configuration values.
 *
 * This module is the single source of truth for:
 *  - localStorage key names
 *  - Password-hashing parameters
 *  - Hardened admin user records
 *  - Validation regexes
 *  - The default site configuration shape (which doubles as the schema reference)
 *  - GitHub API coordinates
 */

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

/**
 * Keys used to read/write data in localStorage.
 * Versioned names prevent collisions if the storage schema changes.
 *
 * @type {{ users: string, session: string, siteConfig: string }}
 */
export const STORAGE_KEYS = {
  users: "einfachrezept_users_v1",
  session: "einfachrezept_session_v1",
  siteConfig: "einfachrezept_site_config_v1",
};

// ---------------------------------------------------------------------------
// Password / authentication
// ---------------------------------------------------------------------------

/** Current password-hash algorithm version. V2 = salted PBKDF2-SHA-256. */
export const PASSWORD_HASH_VERSION = 2;

/** PBKDF2 iteration count for V2 hashes. */
export const PASSWORD_ITERATIONS = 120_000;

/**
 * Pre-seeded admin accounts embedded at build time.
 * If any field (role, hash, salt, iterations, version) drifts from these
 * values the record is silently corrected on the next page load.
 *
 * @type {Array<{
 *   username: string,
 *   role: string,
 *   passwordHash: string,
 *   passwordSalt: string,
 *   passwordIterations: number,
 *   passwordHashVersion: number
 * }>}
 */
export const REQUIRED_ADMIN_USERS = [
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

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Matches a valid 3- or 6-digit CSS hex colour string, e.g. `#f0a` or `#ff00aa`. */
export const HEX_COLOR_REGEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Keys that scroll the page and must be suppressed on the landing screen. */
export const SCROLL_BLOCKED_KEYS = ["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "];

// ---------------------------------------------------------------------------
// GitHub API
// ---------------------------------------------------------------------------

export const GITHUB_REPO = "atheistmantis/EinfachRezept";
export const GITHUB_CONFIG_PATH = "site-config.json";
export const GITHUB_API_BASE = "https://api.github.com";

// ---------------------------------------------------------------------------
// Default site configuration  (also serves as the schema reference)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ButtonConfig
 * @property {string}   id
 * @property {string}   label
 * @property {string}   title
 * @property {string}   backgroundColor   - CSS hex colour or empty string
 * @property {string}   textColor          - CSS hex colour or empty string
 * @property {string}   imageUrl
 * @property {string}   stepBackgroundImageUrl
 * @property {string[]} items
 */

/**
 * @typedef {Object} ThemeConfig
 * @property {string} accentColor
 * @property {string} textColor
 * @property {string} backgroundColor
 * @property {string} overlayColor
 * @property {number} overlayOpacity        - 0–1
 * @property {string} landingBackgroundImageUrl
 * @property {string} categoryBackgroundImageUrl
 * @property {string} buttonFontFamily
 * @property {number} buttonFontWeight      - 100–900
 * @property {number} buttonBorderRadius    - rem, 0–3
 * @property {number} buttonFontSize        - rem, 0.8–3
 */

/**
 * @typedef {Object} WebGLConfig
 * @property {number} animationSpeed   - 0.05–1.5
 * @property {number} waveStrength     - 0.1–1.8
 * @property {number} glowStrength     - 0.05–1
 */

/**
 * @typedef {Object} SiteConfig
 * @property {string}        title
 * @property {string}        subtitle
 * @property {string}        startLabel
 * @property {string}        categoryLabel
 * @property {ButtonConfig[]} buttons
 * @property {ThemeConfig}   theme
 * @property {WebGLConfig}   webgl
 */

/** @type {SiteConfig} */
export const DEFAULT_SITE_CONFIG = {
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
