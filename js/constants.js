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
  subtitle: "",
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
          displayType: "recipe",
          recipeName: "Randensalat (für 6 Personen)",
          items: [
            "1 kg Randen, gekocht, in kleinen Würfeln",
            "4 EL Baumnüsse, gehackt",
            "1 Fetakäse (Bei Bedarf)",
            "Salz",
            "Pfeffer",
            "Sauce:",
            "6 EL Apfelessig",
            "8 EL Rapsöl",
            "2 TL Honig",
            "2 TL Senf"
          ],
          steps: [],
        },
        {
          id: "rueeblisalat",
          label: "Rüeblisalat",
          title: "Rüeblisalat",
          imageUrl: "https://github.com/user-attachments/assets/1d59975d-9526-4499-b4e5-624216981f9f",
          displayType: "recipe",
          recipeName: "Rüeblisalat (für 6 Personen)",
          items: [
            "1 kg Randen, gekocht, in kleinen Würfeln",
            "4 EL Baumnüsse, gehackt",
            "1 Fetakäse (Bei Bedarf)",
            "Salz",
            "Pfeffer",
            "Sauce:",
            "6 EL Apfelessig",
            "8 EL Rapsöl",
            "2 TL Honig",
            "2 TL Senf"
          ],
          steps: [],
        },
        {
          id: "maissalat",
          label: "Maissalat",
          title: "Maissalat",
          imageUrl: "https://github.com/user-attachments/assets/1c16f242-3a35-46f0-9be2-ed9a008961d3",
          displayType: "recipe",
          recipeName: "Maissalat (für 6 Personen)",
          items: [
            "3 Dosen Mais (je ca. 340 g)",
            "1.5 rote Chilis",
            "0.75 Bund Koriander",
            "Sauce:",
            "1.5 Limette",
            "4.5 EL Rapsöl",
            "150 g saurer Halbrahm",
            "Salz",
            "Pfeffer"
          ],
          steps: [],
        },
        {
          id: "gurkensalat",
          label: "Gurkensalat",
          title: "Gurkensalat",
          imageUrl: "https://github.com/user-attachments/assets/ee5b998d-ccdf-445e-be81-79380ae79675",
          displayType: "recipe",
          recipeName: "Gurkensalat (für 6 Personen)",
          items: [
            "3 Salatgurken",
            "Sauce:",
            "6 EL Joghurt nature",
            "1.5 TL Honig",
            "2.5 EL Essig",
            "0.75 TL Senf",
            "Salz",
            "Pfeffer",
          ],
          steps: [],
        },
        {
          id: "gruener-salat",
          label: "Grüner Salat",
          title: "Grüner Salat",
          imageUrl: "https://github.com/user-attachments/assets/f6605d76-2d0a-49a3-941f-1202e13ff5c3",
          displayType: "recipe",
          recipeName: "Grüner Salat (für 6 Personen)",
          items: [
            "1 Eisberg- oder Kopfsalat",
            "Französische Sauce:",
            "1 Zwiebel",
            "1 Bund Petersilie",
            "4 EL Weissweinessig",
            "2 TL Senf",
            "2 EL Mayonnaise",
            "8 EL Sonnenblumen- oder Rapsöl",
            "Salz",
            "Pfeffer"
          ],
        },
        {
          id: "gemischter-salat",
          label: "Gemischter Salat",
          title: "Gemischter Salat",
          imageUrl: "https://github.com/user-attachments/assets/68ddc70e-27c1-461c-b861-33ff3ccb6f77",
          displayType: "recipe",
          recipeName: "Gemischter Salat (für 6 Personen)",
          items: [
            "300 g Grüner Salat",
            "1 Salatgurke",
            "230 g Kirschtomaten",
            "12 Radiesschen",
            "1-2 rote Zwiebeln",
            "120 g Mais",
            "120 g Feta",
            "1.5 Beet Kresse",
            "Italienische Sauce:",
            "¼ Bund Oregano",
            "¼ Bund Basilikum",
            "2 EL Aceto balsamico",
            "1 Knoblauchzehe",
            "4 EL Olivenöl",
            "Salz",
            "Pfeffer"
          ],
          steps: [],
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
      items: [],
      subcategories: [
        {
          id: "kartoffel",
          label: "Kartoffel",
          title: "Kartoffel Optionen",
          imageUrl: "https://github.com/user-attachments/assets/b619f538-e840-4699-9692-b06a4531dec2",
          items: [],
          subcategories: [
            {
              id: "kartoffel-karotten-pfanne",
              label: "Kartoffel-Karotten-Pfanne",
              title: "Kartoffel-Karotten-Pfanne",
              imageUrl: "https://github.com/user-attachments/assets/3b6b1dbb-45e6-4bd4-9211-ced557461f9b",
              displayType: "recipe",
              recipeName: "Kartoffel-Karotten-Pfanne (für 6 Personen)",
              items: [
                "1500 g Kartoffeln (festkochend)",
                "Prise Salz",
                "7-8 Karotten",
                "3 Zwiebeln, gelb",
                "30 g Petersilie, frisch",
                "6 EL Öl",
                "Prise Pfeffer, schwarz gemahlen",
                "Prise Muskatnuss, gemahlen",
                "300 ml Sahne"
              ],
              steps: [],
            },
            {
              id: "kartoffelgratin",
              label: "Kartoffelgratin",
              title: "Kartoffelgratin",
              imageUrl: "https://github.com/user-attachments/assets/899c378e-9948-456c-9dbe-0783f74681c4",
              displayType: "recipe",
              recipeName: "Kartoffelgratin (für 6 Personen)",
              items: [
                "1200 g Kartoffeln (festkochend)",
                "300 ml Kochsahne",
                "150 g Französischer Kräuterfrischkäse",
                "150 g Geriebener Emmentaler (oder Comté/Gruyère)",
                "30 g Butter (in Flöckchen)",
                "1½ TL Butter für die Form",
                "1½ TL Salz",
                "¾ TL Frisch geriebene Muskatnuss",
                "¾ TL Schwarzer Pfeffer, gemahlen"
              ],
              steps: [],
            }
          ],
        },
        {
          id: "gemischtes-gemuese",
          label: "Gemischtes Gemüse",
          title: "Gemischtes Gemüse Optionen",
          imageUrl: "https://github.com/user-attachments/assets/f1a40308-8789-4cc3-a13d-839bfd6e612c",
          items: [],
          subcategories: [
            {
              id: "gemuesereis",
              label: "Gemüsereis",
              title: "Gemüsereis",
              imageUrl: "https://github.com/user-attachments/assets/546a289b-6b6f-493e-b09c-b15f736c0e61",
              items: [],
            },
            {
              id: "ofengemuese",
              label: "Ofengemüse",
              title: "Ofengemüse",
              imageUrl: "https://github.com/user-attachments/assets/e4fe735a-54c7-42c0-ab4d-55f0c921388d",
              items: [],
            },
            {
              id: "gemuesewaehe",
              label: "Gemüsewähe",
              title: "Gemüsewähe",
              imageUrl: "https://github.com/user-attachments/assets/893ea990-3ae7-474f-a985-0fb8b6c1f3ce",
              items: [],
            },
          ],
        },
      ],
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
          imageUrl: "https://github.com/user-attachments/assets/6bc7c632-2e85-44d5-afff-e1652e2f980c",
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
      items: [],
      subcategories: [
        {
          id: "huhn",
          label: "Huhn",
          title: "Huhn Optionen",
          imageUrl: "https://huehnerhaltung.org/wp-content/uploads/vorstellung_sussex_huhn_steckbrief-678x509.png",
          backgroundSize: "contain",
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
                "360 g Teigwaren"
              ],
              steps: [],
            },
          ],
        },
        {
          id: "schwein",
          label: "Schwein",
          title: "Schwein Optionen",
          imageUrl: "https://wholestonefarms.com/wp-content/uploads/2021/09/LWD-Pig-1024x723.png",
          backgroundSize: "contain",
          items: [],
          subcategories: [
            {
              id: "flammkuchen",
              label: "Flammkuchen",
              title: "Flammkuchen",
              imageUrl: "https://github.com/user-attachments/assets/fcb7e5a1-4b04-4c42-b78f-0a6d7b14538b",
              displayType: "recipe",
              recipeName: "Flammkuchen mit Speck (für 6 Personen)",
              items: [
                "2 Pkg. Flammkuchenteig",
                "250 g Crème fraiche",
                "180 g Speckwürfel",
                "1-2 Zwiebel(n)",
                "Salz und Pfeffer",
              ],
              steps: [],
            },
            {
              id: "wienerli-im-teig",
              label: "Wienerli im Teig",
              title: "Wienerli im Teig",
              imageUrl: "https://github.com/user-attachments/assets/6bc7c632-2e85-44d5-afff-e1652e2f980c",
              displayType: "recipe",
              recipeName: "Wienerli im Teig (für 6 Personen)",
              items: [
                "2-3 rechteckig ausgewallter Butterblätterteig à ca. 320 g",
                "10-12 Wienerli",
                "1 Ei zum Bestreichen",
              ],
              steps: [],
            },
          ],
        },
        {
          id: "kuh",
          label: "Kuh",
          title: "Kuh Optionen",
          imageUrl: "https://static.vecteezy.com/system/resources/thumbnails/058/087/798/small/black-and-white-dairy-cow-isolated-png.png",
          backgroundSize: "contain",
          items: [],
          subcategories: [
            { id: "chili-con-carne",    label: "Chili con Carne",    title: "Chili con Carne",    imageUrl: "https://github.com/user-attachments/assets/99bd11f1-02d2-4f20-9b9e-7cc316d20be7", items: [] },
          ],
        },
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
      items: [],
      subcategories: [
        {
          id: "risotto",
          label: "Risotto",
          title: "Risotto Optionen",
          imageUrl: "https://images.pexels.com/photos/6406460/pexels-photo-6406460.jpeg?auto=compress&cs=tinysrgb&w=800",
          backgroundSize: "cover",
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
          backgroundSize: "cover",
          items: [],
        },
        {
          id: "milchreis",
          label: "Milchreis",
          title: "Milchreis Optionen",
          imageUrl: "https://github.com/user-attachments/assets/55401d56-f083-4a2d-bda5-12317c88234b",
          backgroundSize: "cover",
          items: [],
          subcategories: [
            {
              id: "milchreis-klassisch",
              label: "Milchreis",
              title: "Milchreis",
              imageUrl: "https://github.com/user-attachments/assets/55401d56-f083-4a2d-bda5-12317c88234b",
              displayType: "recipe",
              recipeName: "Milchreis (für 6 Personen)",
              items: [
                "1.5 L Milch",
                "1.5 EL Zucker",
                "1.5 TL Vanilleextrakt",
                "1.5 Prisen Salz",
                "375 g Milchreis",
                "Topping:",
                "6 EL Zucker",
                "3 TL Zimt",
              ],
              steps: [],
            },
          ],
        },
      ],
    },
    {
      id: "nudeln",
      label: "Nudeln",
      title: "Nudeln Optionen",
      backgroundColor: "",
      textColor: "",
      imageUrl: "https://github.com/user-attachments/assets/25a7b9c6-5bcb-4f63-a5ea-026ef306369b",
      stepBackgroundImageUrl: "",
      items: [],
      subcategories: [
        {
          id: "nudeln",
          label: "Nudeln",
          title: "Pouletgeschnetzeltes mit Nudeln",
          imageUrl: "https://github.com/user-attachments/assets/1b31372b-861b-419f-97f8-6b45fe6f60d6",
          displayType: "recipe",
          recipeName: "Pouletgeschnetzeltes mit Nudeln (für 6 Personen)",
          items: [
            "3 EL Olivenöl",
            "600 g geschnetzeltes Pouletfleisch",
            "Salz",
            "Pfeffer",
            "3 Zwiebeln",
            "750 g Champignons",
            "450 g Shiitake-Pilze",
            "3 TL Mehl",
            "6 EL Weisswein",
            "4.5 dl Fleischbouillon",
            "1.5 dl Halbrahm",
            "6 EL Schnittlauch",
            "360 g Teigwaren"
          ],
          steps: [],
        },
        {
          id: "penne",
          label: "Penne",
          title: "Penne Optionen",
          imageUrl: "https://github.com/user-attachments/assets/00adeb2d-7bb6-4067-aec9-341559638eaf",
          items: ["Pasta Pesto", "Cinque P", "Pasta Tomatensauce"],
          subcategories: [
            {
              id: "pasta-pesto",
              label: "Pasta Pesto",
              title: "Pasta Pesto",
              imageUrl: "https://github.com/user-attachments/assets/b1ccecb9-5768-41f1-9d47-29b0afbb59db",
              displayType: "recipe",
              recipeName: "Pasta Pesto (für 6 Personen)",
              items: ["1 kg Pasta", "1 grünes Pesto oder rotes Pesto", "1 Pack geriebener Käse"],
              steps: [],
            },
            {
              id: "cinque-p",
              label: "Cinque P",
              title: "Cinque P",
              imageUrl: "https://github.com/user-attachments/assets/ab9fcd80-1220-4915-9600-f4dec73765dc",
              displayType: "recipe",
              recipeName: "Cinque P (für 6 Personen)",
              items: [
                "1 kg Teigwaren, z.B. Penne",
                "6 dl Halbrahm",
                "3 - 4½ EL Tomatenpüree",
                "6 EL geriebener Sbrinz AOP",
                "3 EL glattblättriger Peterli, gehackt",
                "1½ Prise Muskatnuss",
                "Salz, Pfeffer",
              ],
              steps: [],
            },
            {
              id: "pasta-tomatensauce",
              label: "Pasta Tomatensauce",
              title: "Pasta Tomatensauce",
              imageUrl: "https://github.com/user-attachments/assets/e5e06eae-d767-4648-a39d-0e481988dfd2",
              displayType: "recipe",
              recipeName: "Pasta Tomatensauce (für 6 Personen)",
              items: [
                "1 kg Teigwaren, z.B. Penne",
                "1½ Zwiebel, fein gehackt",
                "Butter zum Dünsten",
                "1,2 kg gehackte Pelati aus der Dose, inkl. Saft",
                "3 EL Tomatenpüree",
                "1,5 - 2,25 dl Bouillon",
                "wenig Salz",
                "Pfeffer",
                "Paprika",
                "⅜ TL Zucker",
              ],
              steps: [],
            },
          ],
        },
        {
          id: "spaghetti",
          label: "Spaghetti",
          title: "Spaghetti Optionen",
          imageUrl: "https://github.com/user-attachments/assets/5d23b67e-c065-40c7-83c8-3b6a6881fe62",
          items: [],
          subcategories: [
            {
              id: "spaghetti-carbonara",
              label: "Spaghetti Carbonara",
              title: "Spaghetti Carbonara",
              imageUrl: "https://github.com/user-attachments/assets/39e82983-8cba-4ecc-8a9f-e5f3ec73a27a",
              displayType: "recipe",
              recipeName: "Spaghetti Carbonara (für 6 Personen)",
              items: [
                "800 g Spaghetti",
                "150 g Speck- oder Schinkenwürfeli",
                "5 Eier",
                "3dl Rahm",
                "120 g Sbrinz AOP oder Parmino*, gerieben",
              ],
              steps: [],
            },
            {
              id: "spaghetti-bolognese",
              label: "Spaghetti Bolognese",
              title: "Spaghetti Bolognese",
              imageUrl: "https://github.com/user-attachments/assets/9ac66ca4-7746-4694-97d4-f2946c23bb8d",
              displayType: "recipe",
              recipeName: "Spaghetti Bolognese (für 6 Personen)",
              items: [
                "600 g gemischtes Hackfleisch (Rind und Schwein)",
                "Bratbutter oder Bratcrème",
                "100 g Knollensellerie, an der Bircherraffel gerieben",
                "1 Rüebli, gerüstet, fein gewürfelt",
                "3 EL Tomatenpüree",
                "750 g Pelati oder Tomatensauce aus dem Glas",
                "2,25 dl Fleischbouillon",
                "Salz, Pfeffer",
                "3 EL Peterli, gehackt",
                "800 g Spaghetti",
              ],
              steps: [],
            },
          ],
        },
      ],
    },
  ],
  theme: {
    accentColor: "#00d4ff",
    textColor: "#ffffff",
    backgroundColor: "#02040a",
    overlayColor: "#080c14",
    overlayOpacity: 0.75,
    landingBackgroundImageUrl: "https://github.com/user-attachments/assets/390abba1-d128-4f7e-8db1-001a9bd607b7",
    categoryBackgroundImageUrl: "https://github.com/user-attachments/assets/390abba1-d128-4f7e-8db1-001a9bd607b7",
    buttonFontFamily: "Arial, Helvetica, sans-serif",
    buttonFontWeight: 700,
    buttonBorderRadius: 1,
    buttonFontSize: 1.8,
  },
  webgl: {
    animationSpeed: 0.55,
    waveStrength: 0.8,
    glowStrength: 0.28,
  },
};
