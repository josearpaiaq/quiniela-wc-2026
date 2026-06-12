import { describe, expect, it } from "vitest";
import {
  generateInviteCode,
  INVITE_ALPHABET,
  INVITE_CODE_LENGTH,
  inviteCodeSchema,
  normalizeInviteCode,
} from "./groups";

describe("generateInviteCode", () => {
  it("produces codes of the right length from the safe alphabet", () => {
    for (let i = 0; i < 100; i++) {
      const code = generateInviteCode();
      expect(code).toHaveLength(INVITE_CODE_LENGTH);
      for (const char of code) expect(INVITE_ALPHABET).toContain(char);
    }
  });

  it("never emits ambiguous characters", () => {
    expect(INVITE_ALPHABET).not.toMatch(/[0O1IL]/);
  });
});

describe("normalizeInviteCode", () => {
  it("trims and uppercases", () => {
    expect(normalizeInviteCode("  ab3xyz ")).toBe("AB3XYZ");
  });
});

describe("inviteCodeSchema", () => {
  it("accepts a normalized 6-char code regardless of case", () => {
    expect(inviteCodeSchema.parse(" ab3xyz ")).toBe("AB3XYZ");
  });

  it("rejects wrong lengths and invalid characters", () => {
    expect(inviteCodeSchema.safeParse("ABC").success).toBe(false);
    expect(inviteCodeSchema.safeParse("ABCDEFG").success).toBe(false);
    expect(inviteCodeSchema.safeParse("AB-XYZ").success).toBe(false);
  });
});
