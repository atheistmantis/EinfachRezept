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
 * @property {string}   [imageUrl]        - Optional background image URL for the button
 * @property {string}   [backgroundSize]  - Optional CSS background-size override (e.g. "contain")
 * @property {string}   [displayType]     - Optional display mode (e.g. "recipe")
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
 * @property {string}   [backgroundSize]   - Optional CSS background-size override (e.g. "contain")
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
      id: "salat",
      label: "Salat",
      title: "Salat Optionen",
      backgroundColor: "",
      textColor: "",
      imageUrl: "https://github.com/user-attachments/assets/72d03205-cb73-432e-bbb8-eb425851e00d",
      stepBackgroundImageUrl: "",
      items: [],
      subcategories: [
        {
          id: "randensalat",
          label: "Randensalat",
          title: "Randensalat",
          imageUrl: "https://github.com/user-attachments/assets/ae7da173-4742-43c9-ba32-9434c5bcbb2e",
          items: [],
        },
        {
          id: "rueeblisalat",
          label: "Rüeblisalat",
          title: "Rüeblisalat",
          imageUrl: "https://github.com/user-attachments/assets/1d59975d-9526-4499-b4e5-624216981f9f",
          items: [],
        },
        {
          id: "maissalat",
          label: "Maissalat",
          title: "Maissalat",
          imageUrl: "https://github.com/user-attachments/assets/1c16f242-3a35-46f0-9be2-ed9a008961d3",
          items: [],
        },
        {
          id: "gurkensalat",
          label: "Gurkensalat",
          title: "Gurkensalat",
          imageUrl: "https://github.com/user-attachments/assets/ee5b998d-ccdf-445e-be81-79380ae79675",
          items: [],
        },
        {
          id: "gruener-salat",
          label: "Grüner Salat",
          title: "Grüner Salat",
          imageUrl: "https://github.com/user-attachments/assets/f6605d76-2d0a-49a3-941f-1202e13ff5c3",
          items: [],
        },
        {
          id: "gemischter-salat",
          label: "Gemischter Salat",
          title: "Gemischter Salat",
          imageUrl: "https://github.com/user-attachments/assets/68ddc70e-27c1-461c-b861-33ff3ccb6f77",
          items: [],
        },
      ],
    },
    {
      id: "gemuese",
      label: "Gemüse",
      title: "Gemüse Optionen",
      backgroundColor: "",
      textColor: "",
      imageUrl: "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=800",
      stepBackgroundImageUrl: "",
      items: ["Gemüsepfanne", "Gemüsesuppe", "Geröstetes Gemüse"],
    },
    {
      id: "getreide",
      label: "Getreide",
      title: "Getreide Optionen",
      backgroundColor: "",
      textColor: "",
      imageUrl: "https://github.com/user-attachments/assets/f0a8d06e-cbd2-4c26-ad4e-e75cbae3ed21",
      stepBackgroundImageUrl: "",
      items: [],
      subcategories: [
        {
          id: "cafe-complet",
          label: "Cafe Complet",
          title: "Cafe Complet Optionen",
          imageUrl: "https://github.com/user-attachments/assets/275164ce-0d4a-4d94-84c6-ce370b34a273",
          displayType: "recipe",
          recipeName: "Cafe Complet (für 6 Personen)",
          items: [
            "Je nach Gusto:",
            "1 Brot",
            "1 Butter",
            "Konfitüre",
            "Nutella",
            "Aufschnitt",
            "Käse",
            "Eier",
            "Früchte",
            "Joghurt",
          ],
          steps: [],
        },
        {
          id: "wienerli-im-teig",
          label: "Wienerli im Teig",
          title: "Wienerli im Teig Optionen",
          imageUrl: "https://github.com/user-attachments/assets/5b149579-c760-4c07-bf05-a78674d01f38",
          items: [],
        },
        {
          id: "waehe",
          label: "Wähe",
          title: "Wähe Optionen",
          imageUrl: "https://github.com/user-attachments/assets/7ff6f371-4789-4e19-8631-96ef8b2caed6",
          items: [],
        },
        {
          id: "flammkuchen",
          label: "Flammkuchen",
          title: "Flammkuchen Optionen",
          imageUrl: "https://github.com/user-attachments/assets/e3673bb1-4499-4aad-a0dd-b54d9c88a684",
          items: [],
        },
      ],
    },
    {
      id: "fleisch",
      label: "Fleisch",
      title: "Fleisch Optionen",
      backgroundColor: "",
      textColor: "",
      imageUrl: "https://images.pexels.com/photos/769289/pexels-photo-769289.jpeg?auto=compress&cs=tinysrgb&w=800",
      stepBackgroundImageUrl: "",
      items: ["Hähnchenpfanne", "Rindersteak", "Schweinefilet"],
      subcategories: [
        {
          id: "huhn",
          label: "Huhn",
          title: "Huhn Optionen",
          imageUrl: "https://huehnerhaltung.org/wp-content/uploads/vorstellung_sussex_huhn_steckbrief-678x509.png",
          items: [],
          subcategories: [
            {
              id: "reis",
              label: "Reis",
              imageUrl: "https://images.pexels.com/photos/4187615/pexels-photo-4187615.jpeg?auto=compress&cs=tinysrgb&w=800",
              title: "Riz Casimir",
              displayType: "recipe",
              recipeName: "Riz Casimir (6 Personen)",
              items: [
                "375 g Langkornreis",
                "750 g Pouletbrust",
                "Salz",
                "Pfeffer",
                "1.5 EL Bratbutter",
                "1-2 Früchtekonserven-Dosen",
                "1.5 EL Curry",
                "3.75 dl Gemüsebouillon",
                "3 dl Halbrahm",
              ],
              steps: [],
            },
            {
              id: "nudeln",
              label: "Nudeln",
              imageUrl: "https://images.pexels.com/photos/3887985/pexels-photo-3887985.jpeg?auto=compress&cs=tinysrgb&w=800",
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
        { id: "schwein", label: "Schwein", title: "Schwein Optionen", imageUrl: "https://schweinehaltung.org/wp-content/uploads/vorstellung_duroc_schwein_steckbrief-678x509.png", items: ["Schweinefilet", "Schnitzel", "Spareribs"] },
        { id: "kuh",    label: "Kuh",    title: "Kuh Optionen",    imageUrl: "https://rinderhaltung.org/wp-content/uploads/vorstellung_fleckvieh_kuh_steckbrief-678x509.png", items: ["Rindersteak", "Hamburger", "Rindergulasch"] },
      ],
    },
    {
      id: "reis",
      label: "Reis",
      title: "Reis Optionen",
      backgroundColor: "",
      textColor: "",
      imageUrl: "https://images.pexels.com/photos/4187615/pexels-photo-4187615.jpeg?auto=compress&cs=tinysrgb&w=800",
      stepBackgroundImageUrl: "",
      items: ["Riz Casimir", "Risotto", "Gebratener Reis"],
      subcategories: [
        {
          id: "risotto",
          label: "Risotto",
          title: "Risotto Optionen",
          imageUrl: "https://images.pexels.com/photos/6406460/pexels-photo-6406460.jpeg?auto=compress&cs=tinysrgb&w=800",
          items: [],
          subcategories: [
            {
              id: "safranrisotto",
              label: "Safranrisotto",
              title: "Safranrisotto",
              imageUrl: "https://images.pexels.com/photos/4518803/pexels-photo-4518803.jpeg?auto=compress&cs=tinysrgb&w=800",
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
              title: "Pilzrisotto",
              imageUrl: "https://images.pexels.com/photos/3848159/pexels-photo-3848159.jpeg?auto=compress&cs=tinysrgb&w=800",
              items: [],
            },
            {
              id: "tomatenrisotto",
              label: "Tomatenrisotto",
              title: "Tomatenrisotto",
              imageUrl: "https://images.pexels.com/photos/4519023/pexels-photo-4519023.jpeg?auto=compress&cs=tinysrgb&w=800",
              items: [],
            },
          ],
        },
        {
          id: "jasminreis",
          label: "Jasminreis",
          title: "Jasminreis Optionen",
          imageUrl: "https://images.pexels.com/photos/723198/pexels-photo-723198.jpeg?auto=compress&cs=tinysrgb&w=800",
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
      imageUrl: "https://images.pexels.com/photos/2703468/pexels-photo-2703468.jpeg?auto=compress&cs=tinysrgb&w=800",
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
