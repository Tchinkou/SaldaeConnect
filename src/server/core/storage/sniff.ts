/**
 * Détection du type réel d'un fichier par ses premiers octets (§H.4) —
 * l'extension et le `Content-Type` déclarés par le navigateur ne sont jamais
 * fiables. Les documents bureautiques modernes (docx/xlsx/pptx) sont des ZIP
 * contenant `[Content_Types].xml` ; on distingue leur sous-type en cherchant
 * les répertoires internes caractéristiques (`word/`, `xl/`, `ppt/`) dans les
 * premiers octets du fichier, sans dépendre d'une bibliothèque ZIP complète.
 * ZIP/bureautique réservés à l'espace staff/admin (§H.4.5), jamais au
 * formulaire public.
 */
export type SniffedType =
  | "application/pdf"
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "application/zip"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  | "application/vnd.openxmlformats-officedocument.presentationml.presentation";

const PUBLIC_SIGNATURES: Array<{ mimeType: SniffedType; matches: (bytes: Uint8Array) => boolean }> = [
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

const ZIP_MAGIC = (b: Uint8Array) => b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07);

/** Renvoie le type réel détecté parmi PDF/JPEG/PNG/WebP — types acceptés sur le formulaire public. */
export function sniffType(bytes: Uint8Array): SniffedType | null {
  return PUBLIC_SIGNATURES.find((signature) => signature.matches(bytes))?.mimeType ?? null;
}

/** Comme `sniffType`, mais reconnaît aussi ZIP et les documents bureautiques modernes (staff/admin uniquement). */
export function sniffTypeExtended(bytes: Uint8Array): SniffedType | null {
  const publicType = sniffType(bytes);
  if (publicType) return publicType;

  if (!ZIP_MAGIC(bytes)) return null;

  // Les formats OOXML sont des ZIP dont les entrées internes commencent par
  // ces préfixes ; on les cherche dans un extrait suffisant sans décompresser.
  const haystack = Buffer.from(bytes.subarray(0, Math.min(bytes.length, 4096))).toString("latin1");
  if (haystack.includes("word/")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (haystack.includes("xl/")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (haystack.includes("ppt/")) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  return "application/zip";
}
