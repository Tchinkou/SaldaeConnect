import "server-only";
import { env } from "@/server/core/env";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Utilisé pour le classement dans les journaux (EmailLog), pas envoyé au destinataire. */
  tag?: string;
}

export interface EmailProvider {
  send(input: SendEmailInput): Promise<{ providerMessageId: string | null }>;
}

/**
 * Fournisseur qui journalise dans la console au lieu d'envoyer un vrai email.
 * Utilisé en développement (EMAIL_PROVIDER=console) quand aucune clé API
 * n'est configurée, pour ne jamais bloquer un parcours faute de secret.
 */
class ConsoleEmailProvider implements EmailProvider {
  async send(input: SendEmailInput) {
    console.info(
      `\n✉️  [email:console] → ${input.to}\n   Sujet : ${input.subject}\n${input.text}\n`,
    );
    return { providerMessageId: null };
  }
}

class ResendEmailProvider implements EmailProvider {
  constructor(private readonly apiKey: string) {}

  async send(input: SendEmailInput) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        tags: input.tag ? [{ name: "type", value: input.tag }] : undefined,
      }),
    });
    if (!response.ok) {
      throw new Error(`Resend a refusé l'envoi (${response.status}) : ${await response.text()}`);
    }
    const body = (await response.json()) as { id?: string };
    return { providerMessageId: body.id ?? null };
  }
}

class PostmarkEmailProvider implements EmailProvider {
  constructor(private readonly serverToken: string) {}

  async send(input: SendEmailInput) {
    const response = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "X-Postmark-Server-Token": this.serverToken,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        From: env.EMAIL_FROM,
        To: input.to,
        Subject: input.subject,
        HtmlBody: input.html,
        TextBody: input.text,
        MessageStream: "outbound",
      }),
    });
    if (!response.ok) {
      throw new Error(`Postmark a refusé l'envoi (${response.status}) : ${await response.text()}`);
    }
    const body = (await response.json()) as { MessageID?: string };
    return { providerMessageId: body.MessageID ?? null };
  }
}

let cachedProvider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (cachedProvider) return cachedProvider;

  if (env.EMAIL_PROVIDER === "resend" && env.RESEND_API_KEY) {
    cachedProvider = new ResendEmailProvider(env.RESEND_API_KEY);
  } else if (env.EMAIL_PROVIDER === "postmark" && env.POSTMARK_SERVER_TOKEN) {
    cachedProvider = new PostmarkEmailProvider(env.POSTMARK_SERVER_TOKEN);
  } else {
    cachedProvider = new ConsoleEmailProvider();
  }
  return cachedProvider;
}
