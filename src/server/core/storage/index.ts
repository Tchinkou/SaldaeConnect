import "server-only";
import { createHash } from "node:crypto";
import { env } from "@/server/core/env";
import { ValidationError } from "@/server/core/errors";
import { getStorageProvider } from "@/server/core/storage/local-provider";
import { sniffTypeExtended, type SniffedType } from "@/server/core/storage/sniff";
import { scanBuffer } from "@/server/core/storage/clamav";

/** Limites du formulaire public (§H.4.5). */
export const PUBLIC_UPLOAD_MAX_FILES = 5;
export const PUBLIC_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

/** Limites de l'espace projet, admin comme portail client (§H.4.5 : 50 Mo). */
export const PROJECT_UPLOAD_MAX_FILES = 10;
export const PROJECT_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;

/** Types acceptés pour un envoi de fichier de projet côté admin (bureautique + ZIP, réservés au staff). */
export const PROJECT_ADMIN_ALLOWED_TYPES: SniffedType[] = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

/** Types acceptés pour un envoi de fichier de projet côté portail client — pas de ZIP nu (§H.4.5 : staff/admin uniquement). */
export const PROJECT_CLIENT_ALLOWED_TYPES: SniffedType[] = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

export interface ValidatedUpload {
  storageKey: string;
  originalName: string;
  safeName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  /** Verdict antivirus : "CLEAN" si ClamAV a scanné et validé, "SKIPPED" si aucun ClamAV n'est configuré (§H.4.2). */
  scanStatus: "CLEAN" | "SKIPPED";
}

export interface ReceiveUploadsOptions {
  maxFiles: number;
  maxBytesPerFile: number;
  allowedTypes: SniffedType[];
}

const PUBLIC_UPLOAD_OPTIONS: ReceiveUploadsOptions = {
  maxFiles: PUBLIC_UPLOAD_MAX_FILES,
  maxBytesPerFile: PUBLIC_UPLOAD_MAX_BYTES,
  allowedTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
};

/**
 * Valide, scanne, sniffe et met en quarantaine chaque fichier reçu (§H.4
 * étapes 1-3) — appelé **avant** la transaction qui référence les fichiers en
 * base, puisqu'il s'agit d'E/S disque, pas de base de données. Les fichiers
 * restent en quarantaine tant que la transaction n'a pas confirmé la
 * création de l'enregistrement (voir `promoteUploads`).
 */
export async function receiveAndValidateUploads(
  files: File[],
  options: ReceiveUploadsOptions = PUBLIC_UPLOAD_OPTIONS,
): Promise<ValidatedUpload[]> {
  if (files.length === 0) return [];
  if (files.length > options.maxFiles) {
    throw new ValidationError(`Maximum ${options.maxFiles} fichiers.`);
  }

  const provider = getStorageProvider();
  const results: ValidatedUpload[] = [];

  for (const file of files) {
    if (file.size > options.maxBytesPerFile) {
      throw new ValidationError(
        `Le fichier « ${file.name} » dépasse la taille maximale (${Math.floor(options.maxBytesPerFile / 1024 / 1024)} Mo).`,
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const realType = sniffTypeExtended(bytes);
    if (!realType || !options.allowedTypes.includes(realType)) {
      throw new ValidationError(`Le fichier « ${file.name} » n'est pas d'un type accepté.`);
    }

    const scanStatus = await scanIfConfigured(bytes, file.name);

    const storageKey = await provider.writeQuarantine(bytes);
    results.push({
      storageKey,
      originalName: file.name,
      safeName: sanitizeFileName(file.name),
      mimeType: realType,
      sizeBytes: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      scanStatus,
    });
  }

  return results;
}

/** Fait passer des fichiers validés de la quarantaine à leur emplacement définitif, une fois la transaction confirmée. */
export async function promoteUploads(storageKeys: string[]): Promise<void> {
  const provider = getStorageProvider();
  for (const storageKey of storageKeys) {
    await provider.promote(storageKey);
  }
}

/** Nettoie les fichiers restés en quarantaine si la transaction échoue après leur réception. */
export async function discardUploads(storageKeys: string[]): Promise<void> {
  const provider = getStorageProvider();
  for (const storageKey of storageKeys) {
    await provider.rejectQuarantine(storageKey);
  }
}

export interface StoredGeneratedFile {
  storageKey: string;
  sha256: string;
  sizeBytes: number;
}

/** Stocke un fichier généré côté serveur (PDF de devis/facture…) — voir `StorageProvider.writeGenerated`. */
export async function storeGeneratedFile(bytes: Uint8Array): Promise<StoredGeneratedFile> {
  const provider = getStorageProvider();
  const storageKey = await provider.writeGenerated(bytes);
  return {
    storageKey,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    sizeBytes: bytes.byteLength,
  };
}

/** Relit un fichier déjà promu ou généré, pour le servir (ex. téléchargement du PDF d'un devis). */
export async function readStoredFile(storageKey: string): Promise<Buffer> {
  return getStorageProvider().read(storageKey);
}

/** Supprime définitivement un fichier déjà promu (suppression demandée par un utilisateur). */
export async function removeStoredFile(storageKey: string): Promise<void> {
  return getStorageProvider().remove(storageKey);
}

/**
 * §H.4.2 : l'antivirus tourne « s'il est configuré ». Sans `CLAMAV_HOST`,
 * aucun scan n'est tenté (statut "SKIPPED") — c'est le comportement attendu
 * en développement/sans infrastructure ClamAV. Configuré, un fichier détecté
 * infecté ou un clamd injoignable/en erreur refusent l'envoi (fail-closed) :
 * mieux vaut bloquer un envoi légitime qu'accepter un fichier non vérifié
 * alors qu'un scanner a été explicitement configuré.
 */
async function scanIfConfigured(bytes: Uint8Array, fileName: string): Promise<"CLEAN" | "SKIPPED"> {
  if (!env.CLAMAV_HOST) return "SKIPPED";

  let result;
  try {
    result = await scanBuffer(bytes, env.CLAMAV_HOST, env.CLAMAV_PORT);
  } catch (error) {
    console.error("Échec de l'analyse antivirus", error);
    throw new ValidationError(`Analyse antivirus indisponible pour « ${fileName} » — envoi refusé par prudence.`);
  }

  if (!result.clean) {
    throw new ValidationError(
      `Le fichier « ${fileName} » a été rejeté par l'antivirus${result.signature ? ` (${result.signature})` : ""}.`,
    );
  }

  return "CLEAN";
}

function sanitizeFileName(originalName: string): string {
  const base = originalName.split(/[/\\]/).pop() ?? "fichier";
  return base.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(-120);
}
