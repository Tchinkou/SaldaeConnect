// Seed de démonstration : données strictement fictives (§40 du cahier des
// charges). Refuse de s'exécuter en production. Suppose que seed:base a
// déjà été exécuté (rôles, pipeline, catalogue, séquences).
import { prisma } from "./lib/client";
import { createUser } from "./lib/create-user";

const DEMO_PASSWORD = "SaldaeConnect2026!";

async function nextNumber(key: "REQUEST" | "QUOTE" | "INVOICE" | "PROJECT" | "RESERVATION" | "TRANSACTION") {
  const seq = await prisma.numberSequence.update({
    where: { key },
    data: { nextValue: { increment: 1 } },
  });
  const value = seq.nextValue - 1;
  return `${seq.prefix}-${seq.year}-${String(value).padStart(key === "PROJECT" ? 3 : 4, "0")}`;
}

async function seedUsers() {
  const admin1 = await createUser({
    email: "chakib@saldaeconnect.test",
    password: DEMO_PASSWORD,
    name: "Chakib Admin",
    userType: "STAFF",
    roleKeys: ["admin"],
  });
  const admin2 = await createUser({
    email: "admin2@saldaeconnect.test",
    password: DEMO_PASSWORD,
    name: "Admin Deux",
    userType: "STAFF",
    roleKeys: ["admin"],
  });
  const staff1 = await createUser({
    email: "yasmine@saldaeconnect.test",
    password: DEMO_PASSWORD,
    name: "Yasmine Kaci",
    userType: "STAFF",
    roleKeys: ["staff"],
  });
  const staff2 = await createUser({
    email: "sofiane@saldaeconnect.test",
    password: DEMO_PASSWORD,
    name: "Sofiane Amrani",
    userType: "STAFF",
    roleKeys: ["staff"],
  });
  return { admin1, admin2, staff1, staff2 };
}

async function seedClients(ownerId: string) {
  const clients = [
    {
      code: "CL-0001",
      kind: "INDIVIDUAL" as const,
      displayName: "Amel Boudiaf",
      email: "amel.boudiaf@example.test",
      phone: "+213555000001",
      city: "Béjaïa",
      country: "DZ",
      contact: { firstName: "Amel", lastName: "Boudiaf" },
    },
    {
      code: "CL-0002",
      kind: "COMPANY" as const,
      displayName: "Atlas Immobilier",
      legalName: "SARL Atlas Immobilier",
      email: "contact@atlas-immo.test",
      phone: "+213555000002",
      city: "Alger",
      country: "DZ",
      contact: { firstName: "Karim", lastName: "Ferhat" },
    },
    {
      code: "CL-0003",
      kind: "COMPANY" as const,
      displayName: "Numidia Trade",
      legalName: "EURL Numidia Trade",
      email: "hello@numidia-trade.test",
      phone: "+213555000003",
      city: "Oran",
      country: "DZ",
      contact: { firstName: "Lydia", lastName: "Haddad" },
    },
    {
      code: "CL-0004",
      kind: "INDIVIDUAL" as const,
      displayName: "Yanis Touati",
      email: "yanis.touati@example.test",
      phone: "+33600000004",
      city: "Paris",
      country: "FR",
      contact: { firstName: "Yanis", lastName: "Touati" },
    },
  ];

  const created = [];
  for (const c of clients) {
    const client = await prisma.client.upsert({
      where: { code: c.code },
      update: {},
      create: {
        code: c.code,
        kind: c.kind,
        displayName: c.displayName,
        legalName: "legalName" in c ? c.legalName : undefined,
        email: c.email,
        phone: c.phone,
        city: c.city,
        country: c.country,
        status: "ACTIVE",
        ownerId,
        contacts: {
          create: { firstName: c.contact.firstName, lastName: c.contact.lastName, email: c.email, isPrimary: true },
        },
      },
    });
    created.push(client);
  }
  return created;
}

async function seedLeadsAndOpportunities(ownerId: string, numidiaClientId: string) {
  const websiteSource = await prisma.leadSource.findUniqueOrThrow({ where: { key: "website" } });
  const webDevService = await prisma.serviceTranslation
    .findFirstOrThrow({ where: { locale: "fr", slug: "developpement-web" } })
    .then((t) => prisma.service.findUniqueOrThrow({ where: { id: t.serviceId } }));
  const brandingService = await prisma.serviceTranslation
    .findFirstOrThrow({ where: { locale: "fr", slug: "identite-visuelle" } })
    .then((t) => prisma.service.findUniqueOrThrow({ where: { id: t.serviceId } }));
  const stageNew = await prisma.pipelineStage.findUniqueOrThrow({ where: { key: "new_lead" } });
  const stageQualified = await prisma.pipelineStage.findUniqueOrThrow({ where: { key: "qualified" } });

  const lead = await prisma.lead.create({
    data: {
      firstName: "Nadia",
      lastName: "Cherif",
      email: "nadia.cherif@example.test",
      phone: "+213555000099",
      city: "Béjaïa",
      country: "DZ",
      locale: "fr",
      sourceId: websiteSource.id,
      ownerId,
      status: "OPEN",
    },
  });

  const opp1 = await prisma.opportunity.create({
    data: {
      number: await nextNumber("REQUEST"),
      title: "Refonte du site vitrine",
      leadId: lead.id,
      serviceId: webDevService.id,
      stageId: stageNew.id,
      ownerId,
      sourceId: websiteSource.id,
      message: "Bonjour, je souhaiterais refaire le site de mon cabinet.",
      budgetMin: 15000000n, // 150 000 DZD en centimes
      budgetMax: 30000000n,
      budgetCurrency: "DZD",
      locale: "fr",
    },
  });

  await prisma.activity.create({
    data: {
      type: "SYSTEM",
      subject: "Demande reçue depuis le site",
      leadId: lead.id,
      opportunityId: opp1.id,
      occurredAt: opp1.createdAt,
    },
  });

  const opp2 = await prisma.opportunity.create({
    data: {
      number: await nextNumber("REQUEST"),
      title: "Identité visuelle Numidia Trade",
      clientId: numidiaClientId,
      serviceId: brandingService.id,
      stageId: stageQualified.id,
      ownerId,
      locale: "fr",
      budgetMin: 8000000n,
      budgetMax: 15000000n,
      budgetCurrency: "DZD",
    },
  });

  return { lead, opp1, opp2 };
}

async function seedQuoteProjectInvoice(params: {
  clientId: string;
  contactId?: string;
  opportunityId: string;
  ownerId: string;
  webDevServiceId: string;
}) {
  const quoteNumber = await nextNumber("QUOTE");
  const quote = await prisma.quote.create({
    data: {
      number: quoteNumber,
      clientId: params.clientId,
      opportunityId: params.opportunityId,
      title: "Refonte du site vitrine",
      currency: "DZD",
      status: "ACCEPTED",
      validUntil: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      introduction: "Merci pour votre confiance, voici notre proposition.",
      subtotal: 22000000n,
      discountTotal: 0n,
      taxTotal: 0n,
      total: 22000000n,
      currentVersion: 1,
      sentAt: new Date(),
      firstViewedAt: new Date(),
      decidedAt: new Date(),
      items: {
        create: [
          {
            position: 0,
            serviceId: params.webDevServiceId,
            title: "Conception UX/UI",
            quantity: 1,
            unitPrice: 8000000n,
            lineTotal: 8000000n,
          },
          {
            position: 1,
            serviceId: params.webDevServiceId,
            title: "Développement du site (6 pages)",
            quantity: 1,
            unitPrice: 14000000n,
            lineTotal: 14000000n,
          },
        ],
      },
    },
  });

  const version = await prisma.quoteVersion.create({
    data: {
      quoteId: quote.id,
      version: 1,
      snapshot: { total: "22000000", currency: "DZD" },
      contentHash: "seed-placeholder-hash",
      sentById: params.ownerId,
    },
  });

  await prisma.quoteDecision.create({
    data: {
      quoteId: quote.id,
      quoteVersionId: version.id,
      decision: "ACCEPTED",
      signerName: "Amel Boudiaf",
      method: "CLICK",
    },
  });

  const project = await prisma.project.create({
    data: {
      number: await nextNumber("PROJECT"),
      clientId: params.clientId,
      quoteId: quote.id,
      opportunityId: params.opportunityId,
      name: "Refonte du site vitrine",
      status: "IN_PROGRESS",
      budget: 22000000n,
      currency: "DZD",
      managerId: params.ownerId,
      startDate: new Date(),
      members: { create: { userId: params.ownerId, role: "MANAGER" } },
      milestones: {
        create: [
          { title: "Maquettes validées", weight: 1, position: 0, status: "DONE", completedAt: new Date() },
          { title: "Développement", weight: 2, position: 1, status: "IN_PROGRESS" },
          { title: "Mise en ligne", weight: 1, position: 2, status: "TODO" },
        ],
      },
    },
    include: { milestones: true },
  });

  await prisma.task.create({
    data: {
      title: "Intégrer la page d'accueil",
      status: "IN_PROGRESS",
      assigneeId: params.ownerId,
      projectId: project.id,
      milestoneId: project.milestones[1]?.id,
      priority: "HIGH",
    },
  });

  const invoice = await prisma.invoice.create({
    data: {
      number: await nextNumber("INVOICE"),
      type: "DEPOSIT",
      clientId: params.clientId,
      projectId: project.id,
      quoteId: quote.id,
      currency: "DZD",
      status: "PARTIALLY_PAID",
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 15 * 24 * 3600 * 1000),
      subtotal: 8000000n,
      total: 8000000n,
      amountPaid: 5000000n,
      balanceDue: 3000000n,
      items: {
        create: [{ position: 0, title: "Acompte 40%", quantity: 1, unitPrice: 8000000n, lineTotal: 8000000n }],
      },
    },
  });

  const bankTransfer = await prisma.paymentMethod.findUniqueOrThrow({ where: { key: "bank_transfer" } });
  await prisma.payment.create({
    data: {
      invoiceId: invoice.id,
      clientId: params.clientId,
      amount: 5000000n,
      currency: "DZD",
      methodId: bankTransfer.id,
      recordedById: params.ownerId,
      reference: "VIR-SEED-0001",
    },
  });

  return { quote, project, invoice };
}

async function seedTestimonialsAndPortfolio(clientId: string) {
  await prisma.testimonial.create({
    data: {
      authorName: "Amel Boudiaf",
      company: "Cabinet Boudiaf",
      content:
        "Une équipe réactive qui a bien compris nos besoins. Le nouveau site a nettement amélioré nos demandes de contact.",
      originalLocale: "fr",
      rating: 5,
      publicationConsent: true,
      publicationConsentAt: new Date(),
      clientId,
      isActive: true,
    },
  });

  const sector = await prisma.sector.create({
    data: { translations: { create: { locale: "fr", name: "Immobilier" } } },
  });

  await prisma.portfolioProject.create({
    data: {
      clientName: "Atlas Immobilier",
      sectorId: sector.id,
      isPublished: true,
      isFeatured: true,
      translations: {
        create: {
          locale: "fr",
          title: "Plateforme de gestion pour Atlas Immobilier",
          slug: "atlas-immobilier",
          summary: "Une plateforme sur mesure pour la gestion des biens et des visites.",
          problem: "Le suivi des biens et des visites se faisait sur des tableurs partagés.",
          solution: "Une plateforme web centralisant les biens, les clients et les visites.",
          execution: "Développement en 8 semaines, formation de l'équipe à la livraison.",
          result: "Un suivi plus fiable des biens et des visites pour toute l'équipe.",
        },
      },
    },
  });
}

export async function seedDev() {
  if (process.env.APP_ENV === "production") {
    throw new Error("seed:dev refuse de s'exécuter en production (APP_ENV=production).");
  }

  const { admin1, staff1 } = await seedUsers();
  const [clientAmel, clientAtlas, clientNumidia] = await seedClients(staff1.id);
  const { opp1 } = await seedLeadsAndOpportunities(admin1.id, clientNumidia.id);

  const webDevService = await prisma.serviceTranslation
    .findFirstOrThrow({ where: { locale: "fr", slug: "developpement-web" } })
    .then((t) => t.serviceId);

  await seedQuoteProjectInvoice({
    clientId: clientAmel.id,
    opportunityId: opp1.id,
    ownerId: staff1.id,
    webDevServiceId: webDevService,
  });

  await seedTestimonialsAndPortfolio(clientAtlas.id);

  console.info("✅ seed:dev terminé");
  console.info(`   Comptes de démonstration (mot de passe : ${DEMO_PASSWORD})`);
  console.info("   - chakib@saldaeconnect.test (admin)");
  console.info("   - yasmine@saldaeconnect.test (staff)");
}
