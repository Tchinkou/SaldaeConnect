import type { MetadataRoute } from "next";
import { prisma } from "@/server/core/db/client";
import { absoluteUrl, buildLanguageAlternates } from "@/server/core/seo";
import { routing, type AppLocale } from "@/i18n/routing";

/**
 * Sitemap unique généré depuis la base (§G.4) : une entrée par langue où le
 * contenu est réellement publié, avec les alternatives de langue de chaque
 * URL. Les pages légales non encore validées (`needsLegalReview`) restent
 * hors sitemap — cohérent avec leur balise `noindex` (§K.2).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  // Pages statiques présentes dans toutes les langues.
  for (const staticPath of ["/", "/services", "/contact", "/portfolio"]) {
    const pathByLocale = Object.fromEntries(routing.locales.map((locale) => [locale, staticPath]));
    for (const locale of routing.locales) {
      entries.push({
        url: absoluteUrl(`/${locale}${staticPath}`),
        alternates: { languages: buildLanguageAlternates(pathByLocale) },
      });
    }
  }

  // Services : une entrée par traduction publiée, alternates vers les autres langues publiées.
  const services = await prisma.service.findMany({
    where: { isActive: true },
    include: { translations: { where: { isPublished: true } } },
  });
  for (const service of services) {
    const pathByLocale: Partial<Record<AppLocale, string>> = {};
    for (const translation of service.translations) {
      pathByLocale[translation.locale as AppLocale] = `/services/${translation.slug}`;
    }
    for (const translation of service.translations) {
      entries.push({
        url: absoluteUrl(`/${translation.locale}/services/${translation.slug}`),
        lastModified: service.updatedAt,
        alternates: { languages: buildLanguageAlternates(pathByLocale) },
      });
    }
  }

  // Portfolio publié.
  const projects = await prisma.portfolioProject.findMany({
    where: { isPublished: true },
    include: { translations: true },
  });
  for (const project of projects) {
    const pathByLocale: Partial<Record<AppLocale, string>> = {};
    for (const translation of project.translations) {
      pathByLocale[translation.locale as AppLocale] = `/portfolio/${translation.slug}`;
    }
    for (const translation of project.translations) {
      entries.push({
        url: absoluteUrl(`/${translation.locale}/portfolio/${translation.slug}`),
        alternates: { languages: buildLanguageAlternates(pathByLocale) },
      });
    }
  }

  // Pages libres publiées (à propos + légales validées uniquement).
  const pages = await prisma.pageTranslation.findMany({
    where: { isPublished: true, needsLegalReview: false },
    include: { parent: { include: { translations: { where: { isPublished: true, needsLegalReview: false } } } } },
  });
  for (const translation of pages) {
    const routePrefix = translation.parent.key === "about" ? "about" : `legal/${translation.slug}`;
    const pathByLocale: Partial<Record<AppLocale, string>> = {};
    for (const sibling of translation.parent.translations) {
      pathByLocale[sibling.locale as AppLocale] =
        translation.parent.key === "about" ? "/about" : `/legal/${sibling.slug}`;
    }
    entries.push({
      url: absoluteUrl(`/${translation.locale}/${routePrefix}`),
      alternates: { languages: buildLanguageAlternates(pathByLocale) },
    });
  }

  return entries;
}
