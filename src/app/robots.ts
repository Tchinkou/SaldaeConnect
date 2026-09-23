import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/server/core/seo";
import { routing } from "@/i18n/routing";

const PRIVATE_SEGMENTS = ["admin", "portal", "login", "forgot-password", "reset-password", "accept-invitation"];

export default function robots(): MetadataRoute.Robots {
  const disallow = [
    "/api",
    ...routing.locales.flatMap((locale) => PRIVATE_SEGMENTS.map((segment) => `/${locale}/${segment}`)),
  ];

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow,
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
