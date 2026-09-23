import "server-only";
import { createHash } from "node:crypto";
import { env } from "@/server/core/env";
import { ValidationError } from "@/server/core/errors";
import { getStorageProvider } from "@/server/core/storage/local-provider";
import { sniffType } from "@/server/core/storage/sniff";

/** Limites du formulaire public (§H.4.5) ; l'admin/le portail auront des limites plus larges plus tard. */
export const PUBLIC_UPLOAD_MAX_FILES = 5;
export const PUBLIC_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

export interface ValidatedUpload {
  storageKey: string;
  originalName: string;
  safeName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
}

/**
 * Valide, sniffe et met en quarantaine chaque fichier reçu du formulaire
 * public (§H.4 étapes 1-3) — appelé **avant** la transaction qui crée le
 * Lead/l'Opportunité, puisqu'il s'agit d'E/S disque, pas de base de données.
 * Les fichiers restent en quarantaine tant que la transaction n'a pas
 * confirmé la création de l'Opportunité (voir `promoteUploads`).
 */
export async function receiveAndValidateUploads(files: File[]): Promise<ValidatedUpload[]> {
  if (files.length === 0) return [];
  if (files.length > PUBLIC_UPLOAD_MAX_FILES) {
    throw new ValidationError(`Maximum ${PUBLIC_UPLOAD_MAX_FILES} fichiers.`);
  }

  await assertAvScanAvailable();

  const provider = getStorageProvider();
  const results: ValidatedUpload[] = [];

  for (const file of files) {
    if (file.size > PUBLIC_UPLOAD_MAX_BYTES) {
      throw new ValidationError(
        `Le fichier « ${file.name} » dépasse la taille maximale (${Math.floor(PUBLIC_UPLOAD_MAX_BYTES / 1024 / 1024)} Mo).`,
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const realType = sniffType(bytes);
    if (!realType) {
      throw new ValidationError(
        `Le fichier « ${file.name} » n'est pas d'un type accepté (PDF, JPEG, PNG, WebP).`,
      );
    }

    const storageKey = await provider.writeQuarantine(bytes);
    results.push({
      storageKey,
      originalName: file.name,
      safeName: sanitizeFileName(file.name),
      mimeType: realType,
      sizeBytes: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
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

/**
 * §H.4 : l'antivirus tourne « s'il est configuré ». Ici, `CLAMAV_HOST` n'a
 * pas encore de client ClamAV implémenté ; plutôt que de marquer les
 * fichiers "propres" sans les avoir réellement scannés, on refuse l'envoi
 * tant que l'intégration n'existe pas — voir le rapport de phase.
 */
async function assertAvScanAvailable(): Promise<void> {
  if (env.CLAMAV_HOST) {
    throw new Error(
      "CLAMAV_HOST est configuré mais le client ClamAV n'est pas encore implémenté (server/core/storage).",
    );
  }
}

function sanitizeFileName(originalName: string): string {
  const base = originalName.split(/[/\\]/).pop() ?? "fichier";
  return base.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(-120);
}
