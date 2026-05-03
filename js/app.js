/**
 * @fileoverview Application entry point.
 *
 * Orchestrates the boot sequence:
 *  1. Sync required admin users into localStorage.
 *  2. Load and normalise site configuration (repo file → localStorage cache → defaults).
 *  3. Apply configuration to the DOM and start the WebGL background.
 *  4. Initialise scroll-lock navigation.
 *  5. Initialise the Spider Map editor and session management.
 */

import { DEFAULT_SITE_CONFIG, PASSWORD_HASH_VERSION, SCROLL_BLOCKED_KEYS, STORAGE_KEYS } from "./constants.js";
import { deepClone, getStoredJSON, sanitizeString, saveStoredJSON } from "./utils.js";
import { applySiteConfig, normalizeSiteConfig } from "./config.js";
import { fetchRepoConfig, saveConfigToGitHub, SITE_PAT } from "./github.js";
import { createPasswordRecord, ensureRequiredAdminUsers, verifyPassword } from "./auth.js";
import { setupWebGLBackground } from "./webgl.js";
import { SpiderMapEditor } from "./spider-map.js";

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
  // ── 1. Sync required admin users ──────────────────────────────────────────
  let users = getStoredJSON(STORAGE_KEYS.users, []);
  if (!Array.isArray(users)) users = [];
  const { users: syncedUsers, hasChanges } = ensureRequiredAdminUsers(users);
  users = syncedUsers;
  if (hasChanges) saveStoredJSON(STORAGE_KEYS.users, users);

  // ── 2. Load and apply site configuration ──────────────────────────────────
  // Priority: remote repo file → localStorage cache → hard-coded defaults.
  const repoConfig   = await fetchRepoConfig();
  const storedConfig = getStoredJSON(STORAGE_KEYS.siteConfig, null);
  let currentConfig  = normalizeSiteConfig(repoConfig ?? storedConfig ?? deepClone(DEFAULT_SITE_CONFIG));
  if (repoConfig) saveStoredJSON(STORAGE_KEYS.siteConfig, currentConfig);

  applySiteConfig(currentConfig);
  setupWebGLBackground(() => currentConfig.webgl);
  initNavigation();

  // ── 3. DOM references ─────────────────────────────────────────────────────
  const controlDock     = document.getElementById("control-dock");
  const loginToggle     = document.getElementById("login-toggle");
  const spiderMapToggle = document.getElementById("spider-map-toggle");
  const loginForm       = document.getElementById("login-form");
  const logoutButton    = document.getElementById("logout-button");
  const sessionStatus   = document.getElementById("session-status");
  const closeDockButton = document.getElementById("close-dock-button");
  const smSaveStatus    = document.getElementById("sm-save-status");

  // ── 4. Editor history ─────────────────────────────────────────────────────
  /** @type {import('./constants.js').SiteConfig[]} */
  let editorHistory      = [deepClone(currentConfig)];
  let editorHistoryIndex = 0;

  // ── 5. Session state ──────────────────────────────────────────────────────
  let activeSession = _readSessionUser(users);

  // ── 6. Spider Map editor ──────────────────────────────────────────────────
  // `spiderMap` is declared before `pushEditorHistory` is defined, but
  // `pushEditorHistory` is only ever called via the callbacks below —
  // all of which execute after construction completes.
  const spiderMap = new SpiderMapEditor({
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
      await _persistToGitHub(currentConfig, smSaveStatus);
    },

    onUndo: () => {
      if (!activeSession || editorHistoryIndex <= 0) return;
      editorHistoryIndex -= 1;
      currentConfig = normalizeSiteConfig(editorHistory[editorHistoryIndex]);
      applySiteConfig(currentConfig);
      spiderMap.refresh();
    },

    onRedo: () => {
      if (!activeSession || editorHistoryIndex >= editorHistory.length - 1) return;
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
      editorHistory      = [deepClone(currentConfig)];
      editorHistoryIndex = 0;
      spiderMap.refresh();
      await _persistToGitHub(currentConfig, smSaveStatus, true);
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

  // ── 7. Undo-history helper ────────────────────────────────────────────────

  /**
   * Appends a snapshot of `config` to the undo history unless it is identical
   * to the current top entry (prevents no-op duplicates).
   *
   * @param {import('./constants.js').SiteConfig} config
   */
  function pushEditorHistory(config) {
    const snapshot = normalizeSiteConfig(config);
    const current  = editorHistory[editorHistoryIndex];
    if (current && JSON.stringify(current) === JSON.stringify(snapshot)) {
      spiderMap.updateHistoryButtons();
      return;
    }
    editorHistory = editorHistory.slice(0, editorHistoryIndex + 1);
    editorHistory.push(deepClone(snapshot));
    editorHistoryIndex = editorHistory.length - 1;
    spiderMap.updateHistoryButtons();
  }

  // ── 8. Visibility helpers ─────────────────────────────────────────────────

  /**
   * Toggles an element's visibility by setting the `hidden` class and
   * `aria-hidden` attribute in sync.
   *
   * @param {Element|null} element
   * @param {boolean} isVisible
   */
  function setVisibility(element, isVisible) {
    if (!element) return;
    element.classList.toggle("hidden", !isVisible);
    element.setAttribute("aria-hidden", String(!isVisible));
  }

  /**
   * Shows or hides the control dock and updates the `dock-open` body class
   * that triggers the content-shift layout.
   *
   * @param {boolean} isVisible
   */
  function setDockVisibility(isVisible) {
    setVisibility(controlDock, isVisible);
    document.body.classList.toggle("dock-open", isVisible);
  }

  // ── 9. Session state rendering ────────────────────────────────────────────

  /**
   * Updates all session-dependent UI elements to reflect `activeSession`.
   * Must be called whenever `activeSession` changes.
   */
  function renderSessionState() {
    if (!sessionStatus) return;
    const hasUsers = users.length > 0;

    if (!hasUsers) {
      activeSession = null;
      localStorage.removeItem(STORAGE_KEYS.session);
      sessionStatus.textContent =
        "Keine gespeicherten Nutzer gefunden. Bitte dieses Gerät mit vorhandenen Logins verwenden.";
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
    editorHistory      = [deepClone(currentConfig)];
    editorHistoryIndex = 0;
    spiderMap.open();
  }

  // ── 10. Event listeners ───────────────────────────────────────────────────

  loginToggle?.addEventListener("click", () => {
    setDockVisibility(true);
    setVisibility(loginToggle, false);
  });

  spiderMapToggle?.addEventListener("click", () => spiderMap.open());

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
      if (sessionStatus) sessionStatus.textContent = "Keine Nutzer vorhanden.";
      return;
    }

    const formData = new FormData(loginForm);
    const username = sanitizeString(formData.get("username"), "");
    const password = String(formData.get("password") ?? "");
    const user     = users.find((u) => u.username === username);

    if (!user) {
      if (sessionStatus) sessionStatus.textContent = "Login fehlgeschlagen.";
      return;
    }

    const isValid = await verifyPassword(user, password);
    if (!isValid) {
      if (sessionStatus) sessionStatus.textContent = "Login fehlgeschlagen.";
      return;
    }

    // Transparently upgrade legacy unsalted SHA-256 hashes to V2 PBKDF2.
    if (user.passwordHashVersion !== PASSWORD_HASH_VERSION || !user.passwordSalt) {
      const upgraded = await createPasswordRecord(password);
      users = users.map((u) => (u.username === user.username ? { ...u, ...upgraded } : u));
      saveStoredJSON(STORAGE_KEYS.users, users);
    }

    activeSession = { username: user.username, role: user.role };
    saveStoredJSON(STORAGE_KEYS.session, activeSession);
    loginForm.reset();
    setDockVisibility(false);
    renderSessionState();
  });

  // Initial render
  renderSessionState();
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

  const isInsideControlDock = (target) =>
    target instanceof Element && Boolean(target.closest("#control-dock"));

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

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Reads the persisted session from localStorage and validates it against
 * the current user list.
 *
 * @param {object[]} users
 * @returns {{ username: string, role: string }|null}
 */
function _readSessionUser(users) {
  const session = getStoredJSON(STORAGE_KEYS.session, null);
  if (!session?.username) return null;
  const user = users.find((u) => u.username === session.username);
  return user ? { username: user.username, role: user.role } : null;
}

/**
 * Saves `config` to GitHub and updates `statusElement` with progress,
 * success, or error feedback.
 *
 * @param {object}       config
 * @param {Element|null} statusElement
 * @param {boolean}      [isReset=false] - Adjusts the status messages for a reset operation.
 * @returns {Promise<void>}
 */
async function _persistToGitHub(config, statusElement, isReset = false) {
  if (!SITE_PAT) {
    if (statusElement) {
      statusElement.textContent = isReset
        ? "⚠ Standard nur lokal zurückgesetzt (kein Token verfügbar)."
        : "⚠ Nur lokal gespeichert (kein Token verfügbar).";
    }
    return;
  }

  if (statusElement) {
    statusElement.textContent = isReset
      ? "⏳ Standard im Repository speichern…"
      : "⏳ Speichern im Repository…";
  }

  try {
    await saveConfigToGitHub(config, SITE_PAT);
    if (statusElement) {
      statusElement.textContent = isReset
        ? "✅ Standard im Repository gespeichert."
        : "✅ Im Repository gespeichert.";
    }
  } catch (error) {
    if (statusElement) {
      statusElement.textContent = `❌ GitHub Fehler: ${error.message}`;
    }
  }
}
