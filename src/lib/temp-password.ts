import { randomBytes } from "node:crypto";

// Temporary passwords get dictated over chat/voice after an admin reset,
// so no ambiguous characters (0/O, 1/I/L) and lowercase only besides digits.
export const TEMP_PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const TEMP_PASSWORD_LENGTH = 10;

export function generateTempPassword(): string {
  const bytes = randomBytes(TEMP_PASSWORD_LENGTH);
  let password = "";
  for (let i = 0; i < TEMP_PASSWORD_LENGTH; i++) {
    password += TEMP_PASSWORD_ALPHABET[bytes[i] % TEMP_PASSWORD_ALPHABET.length];
  }
  return password;
}
