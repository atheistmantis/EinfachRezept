/**
 * @fileoverview Site configuration normalisation and DOM rendering.
 *
 * `normalizeSiteConfig` is the single point of entry for all external data
 * (remote JSON, localStorage, form input). Every value is validated and
 * clamped before use, so the rest of the application can safely assume
 * a well-formed `SiteConfig` object.
 *
 * `applySiteConfig` is the only function that writes configuration data to
 * the live DOM. It is broken into private helpers so each concern can be
 * understood and tested in isolation.
 */

import { DEFAULT_SITE_CONFIG } from "./constants.js";
import {
  clamp,
  cssUrlValue,
  deepClone,
  hexToRgb,
  sanitizeColor,
  sanitizeImageUrl,
  sanitizeString,
  slugify,
} from "./utils.js";

// ---------------------------------------------------------------------------
// Config normalisation
// ---------------------------------------------------------------------------

/**
 * Normalises an array of raw button objects into valid `ButtonConfig` records.
 * Missing or invalid fields fall back to the corresponding entry in
 * `DEFAULT_SITE_CONFIG.buttons`. Duplicate `id` values are disambiguated by
 * appending a numeric suffix.
 *
 * @param {unknown[]} rawButtons
 * @returns {import('./constants.js').ButtonConfig[]}
 */
export function normalizeButtons(rawButtons) {
  const fallback = DEFAULT_SITE_CONFIG.buttons;
  if (!Array.isArray(rawButtons) || !rawButtons.length) return deepClone(fallback);

  const usedIds = new Set();
  const normalized = [];

  rawButtons.forEach((entry, index) => {
    const fallbackSource = fallback[index % fallback.length];
    const label = sanitizeString(entry?.label, fallbackSource.label);
    const title = sanitizeString(entry?.title, `${label} Optionen`);
    const idBase = sanitizeString(entry?.id, slugify(label) || `button-${index + 1}`);

    // Ensure uniqueness — append "-2", "-3", … as needed.
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
      // Support the legacy field name "sectionBackgroundImageUrl".
      stepBackgroundImageUrl: sanitizeImageUrl(
        entry?.stepBackgroundImageUrl || entry?.sectionBackgroundImageUrl || "",
      ),
      items:
        Array.isArray(entry?.items) && entry.items.length
          ? entry.items.map((item) => sanitizeString(item, "")).filter(Boolean)
          : deepClone(fallbackSource.items),
      subcategories: _normalizeSubcategories(entry?.subcategories, fallbackSource.subcategories),
    });
  });

  return normalized.length ? normalized : deepClone(fallback);
}

/**
 * Accepts any raw object (remote JSON, localStorage cache, or form data) and
 * returns a fully-validated `SiteConfig` with every field present and within
 * acceptable bounds.
 *
 * Also handles the legacy two-button schema (`riceButtonLabel`,
 * `pastaButtonLabel`, etc.) used before the generic `buttons` array.
 *
 * @param {unknown} rawConfig
 * @returns {import('./constants.js').SiteConfig}
 */
export function normalizeSiteConfig(rawConfig) {
  const defaults = deepClone(DEFAULT_SITE_CONFIG);
  if (!rawConfig || typeof rawConfig !== "object") return defaults;

  // ── Legacy schema migration ───────────────────────────────────────────────
  // Configs created before the generic `buttons` array was introduced stored
  // exactly two buttons under the field names below.
  const legacyButtons = [
    {
      id: slugify(rawConfig.riceButtonLabel || "reis") || "reis",
      label: sanitizeString(rawConfig.riceButtonLabel, defaults.buttons[0].label),
      title: sanitizeString(rawConfig.riceTitle, defaults.buttons[0].title),
      backgroundColor: "",
      textColor: "",
      imageUrl: "",
      stepBackgroundImageUrl: "",
      items:
        Array.isArray(rawConfig.riceItems) && rawConfig.riceItems.length
          ? rawConfig.riceItems
          : defaults.buttons[0].items,
    },
    {
      id: slugify(rawConfig.pastaButtonLabel || "nudeln") || "nudeln",
      label: sanitizeString(rawConfig.pastaButtonLabel, defaults.buttons[1].label),
      title: sanitizeString(rawConfig.pastaTitle, defaults.buttons[1].title),
      backgroundColor: "",
      textColor: "",
      imageUrl: "",
      stepBackgroundImageUrl: "",
      items:
        Array.isArray(rawConfig.pastaItems) && rawConfig.pastaItems.length
          ? rawConfig.pastaItems
          : defaults.buttons[1].items,
    },
  ];

  return {
    title: sanitizeString(rawConfig.title, defaults.title),
    subtitle: sanitizeString(rawConfig.subtitle, defaults.subtitle),
    startLabel: sanitizeString(rawConfig.startLabel, defaults.startLabel),
    categoryLabel: sanitizeString(rawConfig.categoryLabel, defaults.categoryLabel),
    buttons: normalizeButtons(
      Array.isArray(rawConfig.buttons) ? rawConfig.buttons : legacyButtons,
    ),
    theme: {
      accentColor: sanitizeString(rawConfig.theme?.accentColor, defaults.theme.accentColor),
      textColor: sanitizeString(rawConfig.theme?.textColor, defaults.theme.textColor),
      backgroundColor: sanitizeString(rawConfig.theme?.backgroundColor, defaults.theme.backgroundColor),
      overlayColor: sanitizeString(rawConfig.theme?.overlayColor, defaults.theme.overlayColor),
      overlayOpacity: clamp(rawConfig.theme?.overlayOpacity, 0, 1, defaults.theme.overlayOpacity),
      // Support legacy field names for the background image URL.
      landingBackgroundImageUrl: sanitizeImageUrl(
        rawConfig.theme?.landingBackgroundImageUrl ||
          rawConfig.theme?.backgroundImageUrl ||
          rawConfig.backgroundImageUrl ||
          "",
      ),
      categoryBackgroundImageUrl: sanitizeImageUrl(
        rawConfig.theme?.categoryBackgroundImageUrl ||
          rawConfig.theme?.landingBackgroundImageUrl ||
          rawConfig.theme?.backgroundImageUrl ||
          rawConfig.backgroundImageUrl ||
          "",
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

// ---------------------------------------------------------------------------
// DOM rendering
// ---------------------------------------------------------------------------

/**
 * Applies `config` to the live DOM in full:
 *  1. Updates text content (title, subtitle, button labels).
 *  2. Sets per-section background images.
 *  3. Rebuilds the category button list and option sections.
 *  4. Updates CSS custom properties for theme colours and button styles.
 *
 * This is the only function permitted to write configuration data to the DOM.
 *
 * @param {import('./constants.js').SiteConfig} config
 */
export function applySiteConfig(config) {
  _applyTextContent(config);
  _applyBackgroundImages(config);
  _rebuildCategoryButtons(config);
  _rebuildOptionSections(config);
  _applyCssVariables(config);
}

// ── Private helpers ──────────────────────────────────────────────────────────

/**
 * Normalises a raw subcategories array into valid `SubcategoryConfig` records.
 * Returns `null` when no valid subcategories are provided.
 *
 * @param {unknown} rawSubcategories
 * @param {import('./constants.js').SubcategoryConfig[] | null} [fallback]
 * @returns {import('./constants.js').SubcategoryConfig[] | null}
 */
function _normalizeSubcategories(rawSubcategories, fallback) {
  if (!Array.isArray(rawSubcategories) || !rawSubcategories.length) {
    return fallback ? deepClone(fallback) : null;
  }

  const usedIds = new Set();
  const normalized = rawSubcategories.map((entry, index) => {
    const label = sanitizeString(entry?.label, `Unterkategorie ${index + 1}`);
    const title = sanitizeString(entry?.title, `${label} Optionen`);
    const idBase = sanitizeString(entry?.id, slugify(label) || `sub-${index + 1}`);

    let id = idBase;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${idBase}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);

    return {
      id,
      label,
      title,
      items:
        Array.isArray(entry?.items) && entry.items.length
          ? entry.items.map((item) => sanitizeString(item, "")).filter(Boolean)
          : [],
    };
  });

  return normalized.length ? normalized : null;
}

/**
 * Updates the text content of the title, subtitle, start-button,
 * and category-heading elements.
 *
 * @param {import('./constants.js').SiteConfig} config
 */
function _applyTextContent(config) {
  const title = document.getElementById("site-title");
  const subtitle = document.getElementById("subtitle");
  const startButton = document.getElementById("start-button");
  const categoryTitle = document.getElementById("category-title");

  if (title) title.textContent = config.title;
  if (subtitle) subtitle.textContent = config.subtitle;
  if (startButton) startButton.textContent = config.startLabel;
  if (categoryTitle) categoryTitle.textContent = config.categoryLabel;
}

/**
 * Sets the `--section-bg-image` CSS variable on the hero and category sections.
 *
 * @param {import('./constants.js').SiteConfig} config
 */
function _applyBackgroundImages(config) {
  const heroSection = document.getElementById("top");
  const categorySection = document.getElementById("category");

  if (heroSection) {
    heroSection.style.setProperty(
      "--section-bg-image",
      config.theme.landingBackgroundImageUrl
        ? cssUrlValue(config.theme.landingBackgroundImageUrl)
        : "none",
    );
  }

  if (categorySection) {
    categorySection.style.setProperty(
      "--section-bg-image",
      config.theme.categoryBackgroundImageUrl
        ? cssUrlValue(config.theme.categoryBackgroundImageUrl)
        : "none",
    );
  }
}

/**
 * Clears and rebuilds the `#category-buttons` container from `config.buttons`.
 *
 * @param {import('./constants.js').SiteConfig} config
 */
function _rebuildCategoryButtons(config) {
  const container = document.getElementById("category-buttons");
  if (!container) return;

  container.replaceChildren(
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

/**
 * Clears and rebuilds the `#options-container` from `config.buttons`.
 * Each button gets a corresponding `<section>` containing the option list.
 *
 * @param {import('./constants.js').SiteConfig} config
 */
function _rebuildOptionSections(config) {
  const container = document.getElementById("options-container");
  if (!container) return;

  container.replaceChildren(
    ...config.buttons.flatMap((buttonConfig, index) => {
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

      if (buttonConfig.subcategories && buttonConfig.subcategories.length) {
        // Render subcategory buttons instead of a flat item list.
        const subcatGrid = document.createElement("div");
        subcatGrid.className = "button-grid button-row";

        buttonConfig.subcategories.forEach((subcat) => {
          const subButton = document.createElement("button");
          subButton.type = "button";
          subButton.className = "action-button option-button";
          subButton.dataset.target = `suboptions-${buttonConfig.id}-${subcat.id}`;
          const subLabel = document.createElement("span");
          subLabel.textContent = subcat.label;
          subButton.append(subLabel);
          subcatGrid.append(subButton);
        });

        section.append(heading, subcatGrid);

        // Build a sub-option section for each subcategory.
        const subSections = buttonConfig.subcategories.map((subcat) => {
          const subSection = document.createElement("section");
          subSection.className = "panel options sub-options";
          subSection.id = `suboptions-${buttonConfig.id}-${subcat.id}`;
          subSection.style.setProperty(
            "--section-bg-image",
            buttonConfig.stepBackgroundImageUrl
              ? cssUrlValue(buttonConfig.stepBackgroundImageUrl)
              : config.theme.categoryBackgroundImageUrl
                ? cssUrlValue(config.theme.categoryBackgroundImageUrl)
                : "none",
          );

          const subHeading = document.createElement("h3");
          subHeading.textContent = subcat.title;

          const list = document.createElement("ul");
          list.replaceChildren(
            ...subcat.items.map((itemText) => {
              const item = document.createElement("li");
              item.textContent = itemText;
              return item;
            }),
          );

          subSection.append(subHeading, list);
          return subSection;
        });

        return [section, ...subSections];
      }

      // Default: flat item list.
      const list = document.createElement("ul");
      list.replaceChildren(
        ...buttonConfig.items.map((itemText) => {
          const item = document.createElement("li");
          item.textContent = itemText;
          return item;
        }),
      );

      section.append(heading, list);
      return [section];
    }),
  );
}

/**
 * Updates all CSS custom properties on `<html>` that correspond to theme
 * and button-style settings.
 *
 * @param {import('./constants.js').SiteConfig} config
 */
function _applyCssVariables(config) {
  const root = document.documentElement;
  const { theme } = config;

  root.style.setProperty("--accent", theme.accentColor);
  root.style.setProperty("--text", theme.textColor);
  root.style.setProperty("--background", theme.backgroundColor);

  const { r, g, b } = hexToRgb(theme.overlayColor);
  root.style.setProperty("--bg-overlay", `rgba(${r}, ${g}, ${b}, ${theme.overlayOpacity})`);

  root.style.setProperty(
    "--panel-bg-image",
    theme.landingBackgroundImageUrl ? cssUrlValue(theme.landingBackgroundImageUrl) : "none",
  );

  root.style.setProperty("--btn-font-family", theme.buttonFontFamily);
  root.style.setProperty("--btn-font-weight", String(theme.buttonFontWeight));
  root.style.setProperty("--btn-border-radius", `${theme.buttonBorderRadius}rem`);
  root.style.setProperty("--btn-font-size", `${theme.buttonFontSize}rem`);
}
