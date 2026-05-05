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
 * @property {string}   [displayType]   - Optional display mode (e.g. "recipe")
 * @property {string}   [recipeName]    - Optional recipe name shown inside the recipe card
 * @property {string[]} [steps]         - Optional preparation steps for recipe display
 * @property {SubcategoryConfig[] | null} [subcategories]
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
 * @property {string}   displayType        - Optional display mode (e.g. "recipe")
 * @property {string}   recipeName         - Optional recipe name shown inside the recipe card
 * @property {string[]} items
 * @property {string[]} steps              - Optional preparation steps for recipe display
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
        {
          id: "huhn",
          label: "Huhn",
          title: "Huhn Optionen",
          items: [],
          subcategories: [
            {
              id: "reis",
              label: "Reis",
              title: "Riz Casimir",
              displayType: "recipe",
              recipeName: "Riz Casimir (6 Personen)",
              items: [
                "375 g Langkornreis",
                "750 g Pouletbrust",
                "Salz",
                "Pfeffer",
                "1.5 EL Bratbutter",
                "1-2 Früchte-Konservedosen",
                "1.5 EL Curry",
                "3 dl Halbrahm",
              ],
              steps: [],
            },
            {
              id: "nudeln",
              label: "Nudeln",
              title: "Nudeln Optionen",
              displayType: "recipe",
              recipeName: "Poulet-Pilz-Teigwaren",
              items: [
                "3 EL Olivenöl",
                "600 g geschnetzeltes Pouletfleisch",
                "Salz",
                "Pfeffer",
                "3 Zwiebeln",
                "750 g Champignons",
                "450 g Shiitake-Pilz",
                "3 TL Mehl",
                "6 EL Weisswein",
                "4.5 dl Fleischbouillon",
                "1.5 dl Halbrahm",
                "6 EL Schnittlauch",
                "360 g Teigwaren",
              ],
              steps: [],
            },
          ],
        },
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
      items: ["Riz Casimir", "Risotto", "Gebratener Reis"],
      subcategories: [
        {
          id: "risotto",
          label: "Risotto",
          title: "Risotto Optionen",
          items: [],
          subcategories: [
            {
              id: "safranrisotto",
              label: "Safranrisotto",
              title: "Safranrisotto",
              displayType: "recipe",
              recipeName: "Safranrisotto",
              items: [
                "1.5 EL Butter",
                "1.5 Zwiebel, fein gehackt",
                "3 Knoblauchzehen, gepresst",
                "450 g Risottoreis (zB. Carnaroli)",
                "3 dl Weisswein",
                "3 Briefchen Safran",
                "13.5 dl Gemüsebouillon",
                "120 g Parmesan am Stück, gerieben",
                "30 g Butter",
              ],
              steps: [],
            },
            {
              id: "pilzrisotto",
              label: "Pilzrisotto",
              title: "Pilzrisotto Optionen",
              items: [],
            },
            {
              id: "tomatenrisotto",
              label: "Tomatenrisotto",
              title: "Tomatenrisotto Optionen",
              items: [],
            },
          ],
        },
        {
          id: "jasminreis",
          label: "Jasminreis",
          title: "Jasminreis Optionen",
          items: [],
        },
      ],
    },
    {
      id: "nudeln",
      label: "Nudeln",
      title: "Nudeln Optionen",
      backgroundColor: "",
      textColor: "",
      imageUrl: "",
      stepBackgroundImageUrl: "",
      items: ["Poulet-Pilz-Teigwaren", "Pasta Bolognese", "Nudelsuppe"],
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
