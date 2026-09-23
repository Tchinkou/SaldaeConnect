import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/server/core/env";

/**
 * Fournisseur de stockage local (disque), utilisé en développement et par
 * défaut (`STORAGE_PROVIDER=local`) — voir `.env.example`. Un fournisseur S3
 * (`STORAGE_PROVIDER=s3`) est prévu par le schéma d'environnement mais son
 * implémentation est repoussée à quand un hébergement réel avec un bucket
 * sera configuré (§K.2) ; `getStorageProvider()` refuse de démarrer si `s3`
 * est sélectionné pour l'instant plutôt que d'écrire silencieusement en
 * local sous un nom trompeur.
 */
const baseDir = env.STORAGE_LOCAL_DIR ?? path.join(process.cwd(), "var", "storage");
const quarantineDir = path.join(baseDir, "quarantine");
const filesDir = path.join(baseDir, "files");

export interface StorageProvider {
  /** Écrit un fichier reçu dans la zone de quarantaine et renvoie sa clé. */
  writeQuarantine(bytes: Uint8Array): Promise<string>;
  /** Relit un fichier en quarantaine (pour le contrôle de type réel, etc.). */
  readQuarantine(storageKey: string): Promise<Buffer>;
  /** Déplace un fichier validé de la quarantaine vers son emplacement définitif. */
  promote(storageKey: string): Promise<void>;
  /** Supprime un fichier en quarantaine rejeté. */
  rejectQuarantine(storageKey: string): Promise<void>;
}

class LocalStorageProvider implements StorageProvider {
  async writeQuarantine(bytes: Uint8Array): Promise<string> {
    await mkdir(quarantineDir, { recursive: true });
    const storageKey = randomUUID();
    await writeFile(path.join(quarantineDir, storageKey), bytes);
    return storageKey;
  }

  async readQuarantine(storageKey: string): Promise<Buffer> {
    return readFile(path.join(quarantineDir, safeSegment(storageKey)));
  }

  async promote(storageKey: string): Promise<void> {
    await mkdir(filesDir, { recursive: true });
    await rename(path.join(quarantineDir, safeSegment(storageKey)), path.join(filesDir, safeSegment(storageKey)));
  }

  async rejectQuarantine(storageKey: string): Promise<void> {
    await unlink(path.join(quarantineDir, safeSegment(storageKey))).catch(() => undefined);
  }
}

/** `storageKey` est toujours généré côté serveur (`randomUUID`) : cette vérification n'est qu'une garde de défense en profondeur. */
function safeSegment(storageKey: string): string {
  if (!/^[a-f0-9-]{36}$/.test(storageKey)) {
    throw new Error("Clé de stockage invalide.");
  }
  return storageKey;
}

let cachedProvider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (cachedProvider) return cachedProvider;

  if (env.STORAGE_PROVIDER === "s3") {
    throw new Error(
      "STORAGE_PROVIDER=s3 n'est pas encore implémenté — voir server/core/storage/local-provider.ts.",
    );
  }
  cachedProvider = new LocalStorageProvider();
  return cachedProvider;
}
