/**
 * @fileoverview Application entry point.
 *
 * Orchestrates the boot sequence:
 *  1. Load and normalise site configuration (repo file → localStorage cache → defaults).
 *  2. Apply configuration to the DOM and start the WebGL background.
 *  3. Initialise scroll-lock navigation.
 */

import { DEFAULT_SITE_CONFIG, SCROLL_BLOCKED_KEYS, STORAGE_KEYS } from "./constants.js";
import { deepClone, getStoredJSON, saveStoredJSON } from "./utils.js";
import { applySiteConfig, normalizeSiteConfig } from "./config.js";
import { fetchRepoConfig } from "./github.js";
import { setupWebGLBackground } from "./webgl.js";

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

initApp();

// ---------------------------------------------------------------------------
// App initialisation
// ---------------------------------------------------------------------------

/**
 * Bootstraps the entire application. Called once on page load.
 *
 * @returns {Promise<void>}
 */
async function initApp() {
  // ── 1. Load and apply site configuration ──────────────────────────────────
  // Priority: remote repo file → localStorage cache → hard-coded defaults.
  const repoConfig   = await fetchRepoConfig();
  const storedConfig = getStoredJSON(STORAGE_KEYS.siteConfig, null);
  const currentConfig = normalizeSiteConfig(repoConfig ?? storedConfig ?? deepClone(DEFAULT_SITE_CONFIG));
  if (repoConfig) saveStoredJSON(STORAGE_KEYS.siteConfig, currentConfig);

  applySiteConfig(currentConfig);
  setupWebGLBackground(() => currentConfig.webgl);
  initNavigation();
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

/**
 * Hides all `.options` sections by removing the `active` class.
 * Called before activating a newly selected section.
 */
function hideAllOptionSections() {
  document.querySelectorAll(".options").forEach((section) => section.classList.remove("active"));
}

/**
 * Attaches navigation event listeners:
 * - Locks page scroll until the START button is clicked.
 * - Scrolls to the selected option section when a category button is clicked.
 */
function initNavigation() {
  const startButton     = document.getElementById("start-button");
  const categorySection = document.getElementById("category");
  const categoryButtons = document.getElementById("category-buttons");

  const isEditableTarget = (target) => {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    return ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName);
  };

  const lockScroll = (event) => {
    event.preventDefault();
  };

  const lockScrollKeys = (event) => {
    if (isEditableTarget(event.target)) return;
    if (SCROLL_BLOCKED_KEYS.includes(event.key)) event.preventDefault();
  };

  let startClicked = false;
  document.body.classList.add("landing-scroll-locked");
  window.addEventListener("wheel",    lockScroll,     { passive: false });
  window.addEventListener("touchmove", lockScroll,    { passive: false });
  window.addEventListener("keydown",  lockScrollKeys, { passive: false });

  startButton?.addEventListener("click", () => {
    if (!startClicked) {
      startClicked = true;
      document.body.classList.remove("landing-scroll-locked");
      window.removeEventListener("wheel",    lockScroll);
      window.removeEventListener("touchmove", lockScroll);
      window.removeEventListener("keydown",  lockScrollKeys);
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
