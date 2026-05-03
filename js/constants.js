/**
 * @fileoverview Application-wide constants and default configuration values.
 *
 * This module is the single source of truth for:
 *  - localStorage key names
 *  - Validation regexes
 *  - The default site configuration shape (which doubles as the schema reference)
 *  - GitHub config path
 */

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

/**
 * Keys used to read/write data in localStorage.
 * Versioned names prevent collisions if the storage schema changes.
 *
 * @type {{ siteConfig: string }}
 */
export const STORAGE_KEYS = {
  siteConfig: "einfachrezept_site_config_v1",
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Matches a valid 3- or 6-digit CSS hex colour string, e.g. `#f0a` or `#ff00aa`. */
export const HEX_COLOR_REGEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Keys that scroll the page and must be suppressed on the landing screen. */
export const SCROLL_BLOCKED_KEYS = ["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "];

// ---------------------------------------------------------------------------
// GitHub config path
// ---------------------------------------------------------------------------

export const GITHUB_CONFIG_PATH = "site-config.json";

// ---------------------------------------------------------------------------
// Default site configuration  (also serves as the schema reference)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} SubcategoryConfig
 * @property {string}   id
 * @property {string}   label
 * @property {string}   title
 * @property {string[]} items
 */

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
 * @property {SubcategoryConfig[] | null} subcategories
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
      id: "gemuese",
      label: "Gemüse",
      title: "Gemüse Optionen",
      backgroundColor: "",
      textColor: "",
      imageUrl: "",
      stepBackgroundImageUrl: "",
      items: ["Gemüsepfanne", "Gemüsesuppe", "Geröstetes Gemüse"],
    },
    {
      id: "fleisch",
      label: "Fleisch",
      title: "Fleisch Optionen",
      backgroundColor: "",
      textColor: "",
      imageUrl: "",
      stepBackgroundImageUrl: "",
      items: ["Hähnchenpfanne", "Rindersteak", "Schweinefilet"],
      subcategories: [
        { id: "huhn",   label: "Huhn",   title: "Huhn Optionen",   items: ["Hähnchenpfanne", "Hähnchensuppe", "Grillhähnchen"] },
        { id: "schwein", label: "Schwein", title: "Schwein Optionen", items: ["Schweinefilet", "Schnitzel", "Spareribs"] },
        { id: "kuh",    label: "Kuh",    title: "Kuh Optionen",    items: ["Rindersteak", "Hamburger", "Rindergulasch"] },
      ],
    },
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
