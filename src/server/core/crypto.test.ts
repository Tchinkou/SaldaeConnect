import { describe, expect, it } from "vitest";
import { decryptField, decryptSensitiveFields, encryptField, encryptSensitiveFields } from "@/server/core/crypto";

describe("crypto", () => {
  it("round-trips a plaintext value", () => {
    const encrypted = encryptField("AB1234567");
    expect(encrypted).not.toBe("AB1234567");
    expect(decryptField(encrypted)).toBe("AB1234567");
  });

  it("produces a different ciphertext each time (random IV)", () => {
    expect(encryptField("same value")).not.toBe(encryptField("same value"));
  });

  it("rejects a malformed encoded value", () => {
    expect(() => decryptField("not-a-valid-encoded-value")).toThrow();
  });

  it("encrypts only the listed sensitive keys, leaves the rest in clear", () => {
    const encrypted = encryptSensitiveFields({ passportNumber: "X1234567", fullName: "Amel Boudiaf" }, ["passportNumber"]);
    expect(encrypted.fullName).toBe("Amel Boudiaf");
    expect(encrypted.passportNumber).not.toBe("X1234567");

    const decrypted = decryptSensitiveFields(encrypted, ["passportNumber"]);
    expect(decrypted.passportNumber).toBe("X1234567");
    expect(decrypted.fullName).toBe("Amel Boudiaf");
  });

  it("leaves an unencrypted value untouched when decrypting defensively", () => {
    const decrypted = decryptSensitiveFields({ passportNumber: "plain-value" }, ["passportNumber"]);
    expect(decrypted.passportNumber).toBe("plain-value");
  });
});
