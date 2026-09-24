import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isDev = process.env.NODE_ENV === "development";

/**
 * CSP statique plutôt qu'à base de nonce (§H.2, Phase 11) : un nonce par
 * requête force le rendu dynamique de toute page (voir le guide Next.js sur
 * la CSP), ce qui casserait le rendu statique du site public choisi en
 * Phase 3 pour son score Lighthouse. `script-src`/`style-src` gardent donc
 * `'unsafe-inline'` (nécessaire aux scripts d'hydratation et à Tailwind sans
 * nonce) ; le reste de la politique est strict. `img-src` inclut `https:`
 * en attendant que le domaine de stockage de production (`STORAGE_PUBLIC_URL`)
 * soit connu, à restreindre ensuite à ce domaine précis.
 */
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https:;
  font-src 'self';
  connect-src 'self'${isDev ? " ws:" : ""};
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`
  .replace(/\s{2,}/g, " ")
  .trim();

const nextConfig: NextConfig = {
  typedRoutes: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: cspHeader },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
