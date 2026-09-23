/**
 * Détection du type réel d'un fichier par ses premiers octets (§H.4) —
 * l'extension et le `Content-Type` déclarés par le navigateur ne sont jamais
 * fiables. Volontairement limité aux types acceptés sur le formulaire public
 * (PDF, JPEG, PNG, WebP) ; les autres types du H.4 (bureautique, ZIP) sont
 * réservés à l'espace staff/admin, pas encore construit.
 */
export type SniffedType = "application/pdf" | "image/jpeg" | "image/png" | "image/webp";

const SIGNATURES: Array<{ mimeType: SniffedType; matches: (bytes: Uint8Array) => boolean }> = [
  {
    mimeType: "application/pdf",
    matches: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46, // %PDF
  },
  {
    mimeType: "image/jpeg",
    matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mimeType: "image/png",
    matches: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  {
    mimeType: "image/webp",
    matches: (b) =>
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 && // "RIFF"
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50, // "WEBP"
  },
];

/** Renvoie le type réel détecté, ou `null` si aucune signature connue ne correspond. */
export function sniffType(bytes: Uint8Array): SniffedType | null {
  return SIGNATURES.find((signature) => signature.matches(bytes))?.mimeType ?? null;
}
