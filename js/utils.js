/**
 * @fileoverview Shared utility functions.
 *
 * Covers: localStorage wrappers, input sanitisers, colour helpers,
 * string helpers, DOM/CSS helpers, and binary/crypto helpers.
 * None of these functions have side-effects on global state.
 */

import { HEX_COLOR_REGEX } from "./constants.js";

// ---------------------------------------------------------------------------
// Local storage
// ---------------------------------------------------------------------------

/**
 * Reads and JSON-parses a value from localStorage.
 * Returns `fallback` when the key is absent or the stored value is not valid JSON.
 *
 * @template T
 * @param {string} key
 * @param {T} fallback
 * @returns {T}
 */
export function getStoredJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.error("Storage parse failed:", error);
    return fallback;
  }
}

/**
 * JSON-serialises `value` and writes it to localStorage under `key`.
 *
 * @param {string} key
 * @param {unknown} value
 */
export function saveStoredJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ---------------------------------------------------------------------------
// Object helpers
// ---------------------------------------------------------------------------

/**
 * Returns a deep clone of `value` using JSON round-trip serialisation.
 * Suitable for plain JSON-serialisable objects only (no functions, Dates,
 * circular references).
 *
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

// ---------------------------------------------------------------------------
// Input sanitisers
// ---------------------------------------------------------------------------

/**
 * Trims `value` and returns it when non-empty, otherwise returns `fallback`.
 *
 * @param {unknown} value
 * @param {string} fallback
 * @returns {string}
 */
export function sanitizeString(value, fallback) {
  const cleaned = String(value ?? "").trim();
  return cleaned.length ? cleaned : fallback;
}

/**
 * Validates that `colorValue` is a 3- or 6-digit hex colour string.
 * Falls back to `fallback` (itself validated), then to `""`.
 *
 * @param {unknown} colorValue
 * @param {string} [fallback=""]
 * @returns {string}
 */
export function sanitizeColor(colorValue, fallback = "") {
  const cleaned = String(colorValue ?? "").trim();
  const fallbackColor = String(fallback ?? "").trim();
  const safeFallback = HEX_COLOR_REGEX.test(fallbackColor) ? fallbackColor : "";
  if (!cleaned) return safeFallback;
  return HEX_COLOR_REGEX.test(cleaned) ? cleaned : safeFallback;
}

/**
 * Clamps a numeric value to the `[min, max]` range.
 * Returns `fallback` when the parsed value is not a finite number.
 *
 * @param {unknown} value
 * @param {number} min
 * @param {number} max
 * @param {number} fallback
 * @returns {number}
 */
export function clamp(value, min, max, fallback) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

/**
 * Sanitises a URL for use as an image source.
 *
 * Allowed schemes / formats:
 * - Relative paths: `/`, `./`, `../`
 * - `http:` and `https:` URLs
 * - `blob:` URLs
 * - `data:image/…` data URIs
 *
 * Everything else is rejected and an empty string is returned.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function sanitizeImageUrl(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";

  if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("../")
  ) {
    return trimmed;
  }

  const schemeMatch = trimmed.match(/^([a-zA-Z][a-zA-Z\d+.-]*):/);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    if (scheme === "data") {
      return /^data:image\//i.test(trimmed) ? trimmed : "";
    }
    if (scheme === "blob") return trimmed;
    if (!["http", "https"].includes(scheme)) return "";
  }

  try {
    const parsed = new URL(trimmed, window.location.href);
    if (["http:", "https:"].includes(parsed.protocol)) return trimmed;
  } catch {
    // Malformed URL — fall through to rejection.
  }

  return "";
}

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

/**
 * Converts a 3- or 6-digit CSS hex colour to an `{ r, g, b }` object.
 * Channel values are integers in the 0–255 range.
 *
 * @param {string} hex  e.g. `"#00d4ff"` or `"#0df"`
 * @returns {{ r: number, g: number, b: number }}
 */
export function hexToRgb(hex) {
  const cleaned = String(hex ?? "").replace(/^#/, "");
  const expanded =
    cleaned.length === 3
      ? cleaned.split("").map((ch) => ch + ch).join("")
      : cleaned;
  const parsed = Number.parseInt(expanded, 16);
  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
}

// ---------------------------------------------------------------------------
// String helpers
// ---------------------------------------------------------------------------

/**
 * Converts a string to a URL-safe slug: lower-case ASCII, diacritics
 * stripped, non-alphanumeric runs collapsed to hyphens, leading/trailing
 * hyphens removed.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ---------------------------------------------------------------------------
// DOM / CSS helpers
// ---------------------------------------------------------------------------

/**
 * Wraps a URL in a CSS `url("…")` token, escaping characters that would
 * break the CSS string (`"`, `\`, and newline variants).
 *
 * @param {string} url
 * @returns {string}  e.g. `url("https://example.com/photo.jpg")`
 */
export function cssUrlValue(url) {
  return `url("${String(url).replace(/["\\\n\r\f]/g, "\\$&")}")`;
}
