import "server-only";
import { env } from "@/server/core/env";
import { ChromiumPdfRenderer } from "@/server/core/pdf/chromium-renderer";

/**
 * Rendu HTML → PDF (§A.5, §G.8) — l'arabe (liaison des lettres, RTL) n'est
 * rendu correctement que par un vrai moteur de navigateur, d'où le choix
 * de Chromium plutôt qu'une bibliothèque de génération de PDF pure JS.
 * `html` doit être un document complet (`<!doctype html>…`), avec
 * `dir="rtl"` posé sur `<html>` pour les devis en arabe.
 */
export interface PdfRenderer {
  render(html: string): Promise<Uint8Array>;
}

let cachedRenderer: PdfRenderer | null = null;

export function getPdfRenderer(): PdfRenderer {
  if (cachedRenderer) return cachedRenderer;

  if (env.PDF_RENDERER === "gotenberg") {
    // Alternative de déploiement VPS prévue par le schéma d'environnement
    // (§A.5) mais non implémentée en V1 : refuse plutôt que de se rabattre
    // silencieusement sur Chromium sous un nom trompeur.
    throw new Error(
      "PDF_RENDERER=gotenberg n'est pas encore implémenté — voir server/core/pdf/index.ts.",
    );
  }
  cachedRenderer = new ChromiumPdfRenderer();
  return cachedRenderer;
}
