/**
 * @fileoverview Client-side authentication and password management.
 *
 * Passwords are hashed with PBKDF2-SHA-256 and stored in localStorage.
 * A legacy unsalted-SHA-256 path is retained for backwards compatibility
 * and is transparently upgraded to V2 on first successful login.
 *
 * **Security note:** This app uses client-side localStorage for auth state.
 * Only PBKDF2-derived hashes (never raw passwords) are written to storage.
 * This is an intentional architectural trade-off for a fully static site with
 * no server-side session management.
 */

import { PASSWORD_HASH_VERSION, PASSWORD_ITERATIONS, REQUIRED_ADMIN_USERS } from "./constants.js";
import { fromHex, toHex } from "./utils.js";

// ---------------------------------------------------------------------------
// Low-level crypto helpers
// ---------------------------------------------------------------------------

/**
 * Derives a 256-bit PBKDF2-SHA-256 hash from `password` and the given
 * `saltHex`, returning the result as a hex string.
 *
 * @param {string} password
 * @param {string} saltHex      - 32-character hex-encoded 16-byte salt.
 * @param {number} [iterations] - Defaults to `PASSWORD_ITERATIONS`.
 * @returns {Promise<string>}
 */
export async function derivePbkdf2Hash(password, saltHex, iterations = PASSWORD_ITERATIONS) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: fromHex(saltHex), iterations, hash: "SHA-256" },
    keyMaterial,
    256,
  );
  return toHex(bits);
}

/**
 * Generates a cryptographically random 16-byte salt and returns it as a
 * 32-character lowercase hex string.
 *
 * @returns {string}
 */
export function createSalt() {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return toHex(salt);
}

// ---------------------------------------------------------------------------
// Password record management
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} PasswordRecord
 * @property {string} passwordHash
 * @property {string} passwordSalt
 * @property {number} passwordIterations
 * @property {number} passwordHashVersion
 */

/**
 * Creates a fresh V2 password record for `password`:
 * a newly-salted PBKDF2-SHA-256 hash at the current iteration count.
 *
 * @param {string} password
 * @returns {Promise<PasswordRecord>}
 */
export async function createPasswordRecord(password) {
  const salt = createSalt();
  const hash = await derivePbkdf2Hash(password, salt);
  return {
    passwordHash: hash,
    passwordSalt: salt,
    passwordIterations: PASSWORD_ITERATIONS,
    passwordHashVersion: PASSWORD_HASH_VERSION,
  };
}

/**
 * Verifies `password` against the hash stored in `user`.
 *
 * - **V2** (salted PBKDF2): derives and compares via `derivePbkdf2Hash`.
 * - **Legacy** (unsalted SHA-256): uses `crypto.subtle.digest` directly.
 *   This path exists purely for backwards compatibility; it is never used
 *   for new passwords.
 *
 * @param {{ passwordHash: string, passwordSalt?: string, passwordIterations?: number, passwordHashVersion?: number }} user
 * @param {string} password
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(user, password) {
  if (user.passwordHashVersion === PASSWORD_HASH_VERSION && user.passwordSalt) {
    const computed = await derivePbkdf2Hash(
      password,
      user.passwordSalt,
      user.passwordIterations || PASSWORD_ITERATIONS,
    );
    return user.passwordHash === computed;
  }

  // Legacy path: unsalted SHA-256 (no salt field present).
  if (user.passwordHash && !user.passwordSalt) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
    return user.passwordHash === toHex(digest);
  }

  return false;
}

// ---------------------------------------------------------------------------
// User-list management
// ---------------------------------------------------------------------------

/**
 * Ensures every entry in `REQUIRED_ADMIN_USERS` is present in
 * `existingUsers` with the correct role, hash, and salt.
 *
 * - Existing records are updated in-place when any credential field differs.
 * - Missing records are appended.
 *
 * @param {unknown[]} existingUsers
 * @returns {{ users: object[], hasChanges: boolean }}
 */
export function ensureRequiredAdminUsers(existingUsers) {
  const users = Array.isArray(existingUsers) ? [...existingUsers] : [];
  let hasChanges = false;

  for (const requiredAdmin of REQUIRED_ADMIN_USERS) {
    const userIndex = users.findIndex((entry) => entry.username === requiredAdmin.username);
    const existingUser = userIndex >= 0 ? users[userIndex] : null;

    const isOutOfSync =
      !existingUser ||
      existingUser.role !== requiredAdmin.role ||
      existingUser.passwordHash !== requiredAdmin.passwordHash ||
      existingUser.passwordSalt !== requiredAdmin.passwordSalt ||
      existingUser.passwordIterations !== requiredAdmin.passwordIterations ||
      existingUser.passwordHashVersion !== requiredAdmin.passwordHashVersion;

    if (!isOutOfSync) continue;

    const updatedUser = { ...(existingUser ?? {}), ...requiredAdmin };
    if (existingUser) {
      users[userIndex] = updatedUser;
    } else {
      users.push(updatedUser);
    }

    hasChanges = true;
  }

  return { users, hasChanges };
}
