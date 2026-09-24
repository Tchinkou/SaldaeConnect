import { runDbCommand } from "./db";

export type TestClientContact = {
  email: string;
  password: string;
  clientId: string;
  contactId: string;
  userId: string;
  cleanup: () => Promise<void>;
};

/**
 * Crée un client + contact + compte de connexion directement en base
 * (argon2id), en contournant le flux d'invitation par navigateur — celui-ci
 * appelle le plugin `haveIBeenPwned` de Better Auth à la création du mot de
 * passe, bloqué par la politique réseau sortante de ce bac à sable (limite
 * déjà documentée en Phase 5/6, voir mémoire projet). Jamais fait ainsi
 * dans le code applicatif — seulement pour préparer un scénario E2E.
 */
export async function createTestClientContact(label: string): Promise<TestClientContact> {
  const result = await runDbCommand<{
    email: string;
    password: string;
    clientId: string;
    contactId: string;
    userId: string;
  }>({ op: "createTestClient", label });

  return {
    ...result,
    async cleanup() {
      await runDbCommand({ op: "cleanupTestClient", userId: result.userId, clientId: result.clientId });
    },
  };
}
