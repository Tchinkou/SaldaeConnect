import { createNavigation } from "next-intl/navigation";
import { routing } from "@/i18n/routing";

/**
 * Équivalents localisés de `Link`, `redirect`, `usePathname` et `useRouter` :
 * ils préfixent automatiquement les chemins par la langue courante et
 * conduisent, au changement de langue, vers la page équivalente (§G.1).
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
