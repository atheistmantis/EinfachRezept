/**
 * @fileoverview GitHub Contents API integration.
 *
 * Provides read and write access to `site-config.json` in the repository.
 * Authenticated writes use a Personal Access Token (PAT) that is injected
 * at build time by the GitHub Actions workflow (see deploy.yml).
 */

import { GITHUB_API_BASE, GITHUB_CONFIG_PATH, GITHUB_REPO } from "./constants.js";
import { configToBase64 } from "./utils.js";

// ---------------------------------------------------------------------------
// PAT bootstrap
// ---------------------------------------------------------------------------

/**
 * Returns the site PAT decoded from its base-64 representation.
 *
 * The literal string `__SITE_PAT_B64__` is replaced with the real
 * base-64-encoded token by the CI `sed` step (see deploy.yml). When the
 * placeholder has not been replaced (local development), the function
 * returns an empty string so the rest of the app degrades gracefully.
 *
 * @returns {string}
 */
function _getSitePat() {
  const encodedPat = "__SITE_PAT_B64__";
  if (encodedPat === "__SITE_PAT_B64__") return ""; // not replaced — local dev
  try {
    return atob(encodedPat);
  } catch {
    return "";
  }
}

/**
 * The decoded PAT for the current deployment.
 * Empty string when running locally or when CI injection is absent.
 *
 * @type {string}
 */
export const SITE_PAT = _getSitePat();

// ---------------------------------------------------------------------------
// Remote config I/O
// ---------------------------------------------------------------------------

/**
 * Fetches `site-config.json` from the same origin (the deployed repo root).
 * Returns `null` on any network error or non-OK HTTP status.
 *
 * @returns {Promise<object|null>}
 */
export async function fetchRepoConfig() {
  try {
    const response = await fetch(`./${GITHUB_CONFIG_PATH}`, { cache: "no-store" });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Writes `config` to `site-config.json` in the GitHub repository via the
 * Contents API. Handles both creating a new file (404 before the PUT) and
 * updating an existing one (supplies the current SHA in the PUT body).
 *
 * @param {object} config - Normalised `SiteConfig` to persist.
 * @param {string} pat    - PAT with `contents:write` permission on the repo.
 * @throws {Error} If the GitHub API responds with a non-OK status.
 */
export async function saveConfigToGitHub(config, pat) {
  const apiUrl = `${GITHUB_API_BASE}/repos/${GITHUB_REPO}/contents/${GITHUB_CONFIG_PATH}`;
  const headers = {
    Authorization: `Bearer ${pat}`,
    "Content-Type": "application/json",
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  // Retrieve the current file SHA (required for updates; absent for new files).
  let currentSha;
  const getResponse = await fetch(apiUrl, { headers });
  if (getResponse.ok) {
    const data = await getResponse.json();
    currentSha = data.sha;
  } else if (getResponse.status !== 404) {
    const err = await getResponse.json().catch(() => ({}));
    throw new Error(`GitHub API Fehler ${getResponse.status}: ${err.message || "Unbekannter Fehler"}`);
  }

  const body = {
    message: "Update site config via EinfachRezept editor",
    content: configToBase64(config),
  };
  if (currentSha) body.sha = currentSha;

  const putResponse = await fetch(apiUrl, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });

  if (!putResponse.ok) {
    const err = await putResponse.json().catch(() => ({}));
    throw new Error(`GitHub API Fehler ${putResponse.status}: ${err.message || "Unbekannter Fehler"}`);
  }
}
