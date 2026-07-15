import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;

function encryptionKey(): Buffer {
  const secret = process.env.FIELD_ENCRYPTION_KEY?.trim();
  if (!secret || secret.length < 16) {
    throw new Error(
      "FIELD_ENCRYPTION_KEY must be set (min 16 characters) — used to encrypt sensitive fields at rest",
    );
  }
  return createHash("sha256").update(secret).digest();
}

/** Encrypt plaintext for DB storage. Format: `iv.tag.ciphertext` (base64url). */
export function encryptField(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

/** Decrypt a value produced by `encryptField`. */
export function decryptField(payload: string): string {
  const parts = payload.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted field payload");
  }
  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  const data = Buffer.from(dataB64, "base64url");
  const decipher = createDecipheriv(ALGO, encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
