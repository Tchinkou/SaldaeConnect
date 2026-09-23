"use client";

import { createAuthClient } from "better-auth/react";
import { twoFactorClient, magicLinkClient, inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "@/server/core/auth/auth";

/**
 * Client d'authentification côté navigateur. `inferAdditionalFields<typeof
 * auth>()` récupère les types des champs ajoutés dans `auth.ts`
 * (`userType`, `locale`…) sans dupliquer leur définition ici.
 */
export const authClient = createAuthClient({
  plugins: [
    twoFactorClient({
      // Pas de locale ambiante ici (module partagé) : on la lit dans l'URL
      // courante, toujours préfixée (`localePrefix: "always"`, voir routing.ts).
      onTwoFactorRedirect: () => {
        if (typeof window === "undefined") return;
        const locale = window.location.pathname.split("/")[1] || "fr";
        window.location.href = `/${locale}/login/two-factor`;
      },
    }),
    magicLinkClient(),
    inferAdditionalFields<typeof auth>(),
  ],
});

export const { useSession, signIn, signOut } = authClient;
