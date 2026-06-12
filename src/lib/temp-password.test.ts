import { describe, expect, it } from "vitest";
import {
  generateTempPassword,
  TEMP_PASSWORD_ALPHABET,
  TEMP_PASSWORD_LENGTH,
} from "./temp-password";

describe("generateTempPassword", () => {
  it("produces passwords of the right length from the safe alphabet", () => {
    for (let i = 0; i < 100; i++) {
      const password = generateTempPassword();
      expect(password).toHaveLength(TEMP_PASSWORD_LENGTH);
      for (const char of password) expect(TEMP_PASSWORD_ALPHABET).toContain(char);
    }
  });

  it("never emits ambiguous characters", () => {
    expect(TEMP_PASSWORD_ALPHABET).not.toMatch(/[0O1IL]/i);
  });

  it("meets the minimum password length required at login", () => {
    expect(TEMP_PASSWORD_LENGTH).toBeGreaterThanOrEqual(8);
  });
});
