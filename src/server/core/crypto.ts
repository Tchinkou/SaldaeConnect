import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "@/server/core/env";

/**
 * Chiffrement au repos des champs individuels sensibles (§B.3 : réponses de
 * réservation contenant un n° de passeport, `identityData` des commandes de
 * transaction — §H.7). AES-256-GCM, une clé dérivée par SHA-256 de
 * `DATA_ENCRYPTION_KEY` (accepte n'importe quelle longueur de secret en
 * entrée, produit toujours 32 octets), IV aléatoire par valeur — jamais
 * réutilisé, donc pas besoin d'IV déterministe. Format de sortie :
 * `<iv base64url>.<tag base64url>.<ciphertext base64url>`, une chaîne
 * opaque stockée directement dans les colonnes `Json`.
 */
const key = createHash("sha256").update(env.DATA_ENCRYPTION_KEY).digest();

export function encryptField(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((buffer) => buffer.toString("base64url")).join(".");
}

export function decryptField(encoded: string): string {
  const [ivPart, tagPart, ciphertextPart] = encoded.split(".");
  if (!ivPart || !tagPart || !ciphertextPart) {
    throw new Error("Valeur chiffrée malformée.");
  }
  const iv = Buffer.from(ivPart, "base64url");
  const tag = Buffer.from(tagPart, "base64url");
  const ciphertext = Buffer.from(ciphertextPart, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/**
 * Chiffre récursivement les clés listées de `fields` dans un objet JSON
 * arbitraire (réponses de formulaire dynamique) ; les autres clés sont
 * laissées en clair. Utilisé pour `Reservation.answers` et
 * `TransactionOrder.identityData`, dont les champs sensibles sont
 * configurables sans code (§B.3).
 */
export function encryptSensitiveFields(data: Record<string, unknown>, sensitiveKeys: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = { ...data };
  for (const fieldKey of sensitiveKeys) {
    const value = result[fieldKey];
    if (typeof value === "string" && value.length > 0) {
      result[fieldKey] = encryptField(value);
    }
  }
  return result;
}

export function decryptSensitiveFields(data: Record<string, unknown>, sensitiveKeys: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = { ...data };
  for (const fieldKey of sensitiveKeys) {
    const value = result[fieldKey];
    if (typeof value === "string" && value.includes(".")) {
      try {
        result[fieldKey] = decryptField(value);
      } catch {
        // Valeur non chiffrée (donnée pré-existante ou champ non concerné) : laissée telle quelle.
      }
    }
  }
  return result;
}
