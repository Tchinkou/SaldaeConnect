/** Injecte des données structurées (§G.4). `data` doit venir du serveur, jamais de saisie utilisateur non échappée. */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
