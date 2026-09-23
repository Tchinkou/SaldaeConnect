import "server-only";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { env } from "@/server/core/env";
import type { PdfRenderer } from "@/server/core/pdf";

const PW_BROWSERS_DIR = "/opt/pw-browsers";

export class ChromiumPdfRenderer implements PdfRenderer {
  async render(html: string): Promise<Uint8Array> {
    const browser = await puppeteer.launch({
      executablePath: resolveExecutablePath(),
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    try {
      const page = await browser.newPage();
      // Le gabarit est un document HTML autonome (styles en ligne, pas de
      // ressource externe à charger) : "load" suffit, "networkidle0" n'existe
      // plus dans cette version de Puppeteer.
      await page.setContent(html, { waitUntil: "load" });
      const pdf = await page.pdf({
        format: "a4",
        printBackground: true,
        margin: { top: "18mm", right: "16mm", bottom: "18mm", left: "16mm" },
      });
      return pdf;
    } finally {
      await browser.close();
    }
  }
}

function resolveExecutablePath(): string {
  if (env.CHROMIUM_PATH) return env.CHROMIUM_PATH;

  if (env.APP_ENV === "development") {
    const devPath = findDevContainerChromium();
    if (devPath) return devPath;
  }

  throw new Error(
    "CHROMIUM_PATH n'est pas configuré — requis en dehors du conteneur de développement (voir .env.example).",
  );
}

/**
 * En développement, réutilise le Chromium déjà installé par Playwright dans
 * ce conteneur (`/opt/pw-browsers`) plutôt que d'exiger une seconde
 * installation de navigateur. Le numéro de build change avec les mises à
 * jour de l'image, donc on le découvre au lieu de le figer.
 */
function findDevContainerChromium(): string | null {
  let entries: string[];
  try {
    entries = readdirSync(PW_BROWSERS_DIR);
  } catch {
    return null;
  }
  const dir = entries.find((entry) => entry.startsWith("chromium-"));
  if (!dir) return null;
  const chromePath = path.join(PW_BROWSERS_DIR, dir, "chrome-linux", "chrome");
  return existsSync(chromePath) ? chromePath : null;
}
