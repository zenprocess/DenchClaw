/**
 * Password hashing and verification using argon2id.
 *
 * Uses @node-rs/argon2 (native binding, no WASM). Parameters follow OWASP
 * recommendations for interactive logins.
 */
import { hash, verify } from "@node-rs/argon2";

const ARGON2_OPTIONS = {
  memoryCost: 65536, // 64 MiB
  timeCost: 3,
  parallelism: 1,
  algorithm: 2, // argon2id = 2
} as const;

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_OPTIONS);
}

export async function verifyPassword(
  storedHash: string,
  plain: string,
): Promise<boolean> {
  try {
    return await verify(storedHash, plain);
  } catch {
    return false;
  }
}
