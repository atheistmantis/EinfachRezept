/**
 * @fileoverview GitHub repository integration.
 *
 * Provides read access to `site-config.json` from the deployed site root.
 */

import { GITHUB_CONFIG_PATH } from "./constants.js";

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
