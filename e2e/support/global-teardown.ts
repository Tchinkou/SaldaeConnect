import { resetStaffTwoFactor } from "./staff";

/**
 * Remet le compte STAFF de seed à son état de départ (2FA désactivée) une
 * seule fois, après toute la suite — chaque spec ne le fait plus
 * individuellement (voir `staff.ts`) pour éviter de ré-enrôler le 2FA en
 * entier (mot de passe + génération + vérification TOTP) à chaque fichier,
 * ce qui déclenchait le limiteur de débit anti-brute-force de Better Auth
 * (§H.2) quand toute la suite s'exécute d'affilée.
 */
export default async function globalTeardown() {
  await resetStaffTwoFactor();
}
