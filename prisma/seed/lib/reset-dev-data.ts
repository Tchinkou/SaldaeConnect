// Nettoyage ciblé des données de démonstration (pas un reset de base de
// données — on ne touche qu'aux lignes créées par seed:dev, dans l'ordre
// qui respecte les contraintes de clé étrangère). Utile pour relancer
// seed:dev sur une base qui l'a déjà exécuté une fois pendant le
// développement.
import { prisma } from "./client";

async function main() {
  await prisma.payment.deleteMany({});
  await prisma.invoiceItem.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.milestone.deleteMany({});
  await prisma.projectMember.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.quoteDecision.deleteMany({});
  await prisma.quoteVersion.deleteMany({});
  await prisma.quoteItem.deleteMany({});
  await prisma.quote.deleteMany({});
  await prisma.activity.deleteMany({});
  await prisma.opportunity.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.testimonial.deleteMany({});
  await prisma.portfolioProjectTranslation.deleteMany({});
  await prisma.portfolioProject.deleteMany({});
  await prisma.sectorTranslation.deleteMany({});
  await prisma.sector.deleteMany({});
  await prisma.clientContact.deleteMany({});
  await prisma.client.deleteMany({});
  await prisma.user.deleteMany({
    where: { email: { endsWith: "@saldaeconnect.test" } },
  });
  console.info("✅ Données de démonstration nettoyées.");
}

main()
  .catch((error) => {
    console.error("❌", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
