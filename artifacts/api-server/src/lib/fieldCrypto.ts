import { decryptSecret, encryptSecret } from "./crypto";

// A-0 (AMMINISTRAZIONE-PLAN §6.5): at-rest encryption for sensitive fiscal
// fields that must still be readable by the app — today `business_profiles.iban`,
// in A-1 the SDI delegation credentials. Same AES-256-GCM key as the OAuth
// tokens (`TOKEN_ENCRYPTION_KEY`, rotated by scripts/rotate-token-key.ts).
//
// Values carry a `enc1:` prefix so a column can hold plaintext rows written
// before A-0 and encrypted rows side by side: reads are transparent, writes
// always encrypt, and `ops:encrypt-fiscal-fields` converts the backlog once.

export const ENCRYPTED_FIELD_PREFIX = "enc1:";

export function isEncryptedField(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(ENCRYPTED_FIELD_PREFIX);
}

/** Encrypts a non-empty value; null/empty stays null so "no IBAN" is still a plain NULL in the DB. */
export function encryptField(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (isEncryptedField(value)) return value;
  return ENCRYPTED_FIELD_PREFIX + encryptSecret(value);
}

/** Decrypts an `enc1:` value; anything else is returned as-is (legacy plaintext row). */
export function decryptField(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (!isEncryptedField(value)) return value;
  return decryptSecret(value.slice(ENCRYPTED_FIELD_PREFIX.length));
}
