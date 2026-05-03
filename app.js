/**
 * This file has been superseded by the modular rewrite in js/.
 *
 * Entry point: js/app.js  (loaded via <script type="module"> in index.html)
 *
 * Module layout:
 *   js/constants.js   — STORAGE_KEYS, DEFAULT_SITE_CONFIG, type definitions
 *   js/utils.js       — sanitisers, storage helpers, crypto helpers
 *   js/config.js      — normalizeSiteConfig, applySiteConfig
 *   js/github.js      — fetchRepoConfig, saveConfigToGitHub, SITE_PAT
 *   js/auth.js        — PBKDF2 password hashing, session management
 *   js/webgl.js       — setupWebGLBackground
 *   js/spider-map.js  — SpiderMapEditor class
 *   js/app.js         — initApp, initNavigation (entry point)
 */
