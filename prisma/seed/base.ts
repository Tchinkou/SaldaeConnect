// Seed de base : tout ce dont l'application a besoin pour fonctionner
// (permissions, rôles système, pipeline, séquences de numérotation,
// paramètres par défaut…). Idempotent — peut être exécuté en production.
// Voir docs/architecture.md §H.3, §E.3, §0.3.
import { prisma } from "./lib/client";

const PERMISSIONS = [
  ["lead.read", "Lire les prospects"],
  ["lead.write", "Créer/modifier les prospects"],
  ["opportunity.read", "Lire les opportunités"],
  ["opportunity.write", "Créer/modifier les opportunités"],
  ["client.read", "Lire les clients"],
  ["client.write", "Créer/modifier les clients"],
  ["quote.read", "Lire les devis"],
  ["quote.write", "Créer/modifier les devis"],
  ["quote.send", "Envoyer un devis"],
  ["project.read", "Lire les projets"],
  ["project.write", "Créer/modifier les projets"],
  ["task.read", "Lire les tâches"],
  ["task.write", "Créer/modifier les tâches"],
  ["message.read", "Lire les messages"],
  ["message.write", "Envoyer des messages"],
  ["file.read", "Lire les fichiers"],
  ["file.write", "Envoyer des fichiers"],
  ["invoice.read", "Lire les factures"],
  ["invoice.write", "Créer/modifier les factures"],
  ["invoice.issue", "Émettre une facture"],
  ["payment.read", "Lire les paiements"],
  ["payment.write", "Enregistrer un paiement"],
  ["reservation.read", "Lire les réservations"],
  ["reservation.write", "Créer/modifier les réservations"],
  ["transaction.read", "Lire les transactions"],
  ["transaction.write", "Créer/modifier les transactions"],
  ["reporting.financial.read", "Lire les statistiques financières"],
  ["cms.write", "Modifier le contenu du site (services, pages, portfolio, blog)"],
  ["team.write", "Gérer l'équipe et les rôles"],
  ["settings.write", "Modifier les paramètres globaux"],
  ["audit.read", "Consulter le journal d'audit"],
] as const;

// [clé de permission, périmètre]
const ADMIN_GRANTS = PERMISSIONS.map(([key]) => [key, "ALL"] as const);

const STAFF_GRANTS: Array<[string, "ALL" | "ASSIGNED" | "OWN"]> = [
  ["lead.read", "ASSIGNED"],
  ["lead.write", "ASSIGNED"],
  ["opportunity.read", "ASSIGNED"],
  ["opportunity.write", "ASSIGNED"],
  ["client.read", "ASSIGNED"],
  ["quote.read", "ASSIGNED"],
  ["project.read", "ASSIGNED"],
  ["project.write", "ASSIGNED"],
  ["task.read", "ASSIGNED"],
  ["task.write", "ASSIGNED"],
  ["message.read", "ASSIGNED"],
  ["message.write", "ASSIGNED"],
  ["file.read", "ASSIGNED"],
  ["file.write", "ASSIGNED"],
];

const CLIENT_GRANTS: Array<[string, "ALL" | "ASSIGNED" | "OWN"]> = [
  ["client.read", "OWN"],
  ["quote.read", "OWN"],
  ["project.read", "OWN"],
  ["task.read", "OWN"],
  ["message.read", "OWN"],
  ["message.write", "OWN"],
  ["file.read", "OWN"],
  ["file.write", "OWN"],
  ["invoice.read", "OWN"],
  ["payment.read", "OWN"],
  ["reservation.read", "OWN"],
  ["reservation.write", "OWN"],
  ["transaction.read", "OWN"],
];

const PIPELINE_STAGES = [
  ["new_lead", "OPEN", { fr: "Nouveau lead", en: "New lead", ar: "عميل محتمل جديد" }],
  ["contacted", "OPEN", { fr: "Contacté", en: "Contacted", ar: "تم التواصل" }],
  ["qualified", "OPEN", { fr: "Qualifié", en: "Qualified", ar: "مؤهل" }],
  ["quote_prepared", "OPEN", { fr: "Devis préparé", en: "Quote prepared", ar: "تم إعداد عرض السعر" }],
  ["quote_sent", "OPEN", { fr: "Devis envoyé", en: "Quote sent", ar: "تم إرسال عرض السعر" }],
  ["negotiation", "OPEN", { fr: "Négociation", en: "Negotiation", ar: "تفاوض" }],
  ["accepted", "WON", { fr: "Accepté", en: "Accepted", ar: "مقبول" }],
  ["active_client", "WON", { fr: "Client actif", en: "Active client", ar: "عميل نشط" }],
  ["completed", "WON", { fr: "Terminé", en: "Completed", ar: "مكتمل" }],
  ["lost", "LOST", { fr: "Perdu", en: "Lost", ar: "خسر" }],
] as const;

const LEAD_SOURCES = [
  ["website", { fr: "Site web", en: "Website", ar: "الموقع الإلكتروني" }],
  ["whatsapp", { fr: "WhatsApp", en: "WhatsApp", ar: "واتساب" }],
  ["facebook", { fr: "Facebook", en: "Facebook", ar: "فيسبوك" }],
  ["instagram", { fr: "Instagram", en: "Instagram", ar: "إنستغرام" }],
  ["phone", { fr: "Téléphone", en: "Phone", ar: "الهاتف" }],
  ["walk_in", { fr: "Visite en agence", en: "Walk-in", ar: "زيارة الوكالة" }],
  ["referral", { fr: "Recommandation", en: "Referral", ar: "توصية" }],
  ["other", { fr: "Autre", en: "Other", ar: "أخرى" }],
] as const;

const LOST_REASONS = [
  { fr: "Budget insuffisant", en: "Budget too low", ar: "ميزانية غير كافية" },
  { fr: "Délai trop long", en: "Timeline too long", ar: "مدة طويلة جدًا" },
  { fr: "A choisi un concurrent", en: "Chose a competitor", ar: "اختار منافسًا" },
  { fr: "Ne répond plus", en: "Went silent", ar: "لم يعد يستجيب" },
  { fr: "Projet abandonné", en: "Project abandoned", ar: "تم التخلي عن المشروع" },
] as const;

const PAYMENT_METHODS = [
  ["bank_transfer", { fr: "Virement bancaire", en: "Bank transfer", ar: "تحويل بنكي" }],
  ["cash", { fr: "Espèces", en: "Cash", ar: "نقدًا" }],
  ["card", { fr: "Carte", en: "Card", ar: "بطاقة" }],
  ["check", { fr: "Chèque", en: "Check", ar: "شيك" }],
] as const;

async function seedPermissionsAndRoles() {
  for (const [key, description] of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      update: { description },
      create: { key, description },
    });
  }

  const roles = [
    { key: "admin", name: "Administrateur", isSystem: true, grants: ADMIN_GRANTS },
    { key: "staff", name: "Équipe", isSystem: true, grants: STAFF_GRANTS },
    { key: "client", name: "Client", isSystem: true, grants: CLIENT_GRANTS },
  ] as const;

  for (const { key, name, isSystem, grants } of roles) {
    const role = await prisma.role.upsert({
      where: { key },
      update: { name, isSystem },
      create: { key, name, isSystem },
    });

    for (const [permKey, scope] of grants) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { key: permKey } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: { scope },
        create: { roleId: role.id, permissionId: permission.id, scope },
      });
    }
  }
}

async function seedPipeline() {
  for (const [key, kind, labels] of PIPELINE_STAGES) {
    const stage = await prisma.pipelineStage.upsert({
      where: { key },
      update: { kind, order: PIPELINE_STAGES.findIndex((s) => s[0] === key) },
      create: {
        key,
        kind,
        order: PIPELINE_STAGES.findIndex((s) => s[0] === key),
        isSystem: true,
      },
    });
    for (const [locale, name] of Object.entries(labels)) {
      await prisma.pipelineStageTranslation.upsert({
        where: { parentId_locale: { parentId: stage.id, locale } },
        update: { name },
        create: { parentId: stage.id, locale, name },
      });
    }
  }
}

async function seedLeadSources() {
  for (const [key, labels] of LEAD_SOURCES) {
    const source = await prisma.leadSource.upsert({
      where: { key },
      update: {},
      create: { key },
    });
    for (const [locale, name] of Object.entries(labels)) {
      await prisma.leadSourceTranslation.upsert({
        where: { parentId_locale: { parentId: source.id, locale } },
        update: { name },
        create: { parentId: source.id, locale, name },
      });
    }
  }
}

async function seedLostReasons() {
  for (const labels of LOST_REASONS) {
    const existing = await prisma.lostReasonTranslation.findFirst({
      where: { locale: "fr", label: labels.fr },
    });
    const reason = existing
      ? { id: existing.parentId }
      : await prisma.lostReason.create({ data: {} });
    for (const [locale, label] of Object.entries(labels)) {
      await prisma.lostReasonTranslation.upsert({
        where: { parentId_locale: { parentId: reason.id, locale } },
        update: { label },
        create: { parentId: reason.id, locale, label },
      });
    }
  }
}

async function seedPaymentMethods() {
  for (const [key, labels] of PAYMENT_METHODS) {
    const method = await prisma.paymentMethod.upsert({
      where: { key },
      update: {},
      create: { key },
    });
    for (const [locale, name] of Object.entries(labels)) {
      await prisma.paymentMethodTranslation.upsert({
        where: { parentId_locale: { parentId: method.id, locale } },
        update: { name },
        create: { parentId: method.id, locale, name },
      });
    }
  }
}

async function seedNumberSequences() {
  const sequences: Array<{
    key: "REQUEST" | "QUOTE" | "INVOICE" | "CREDIT_NOTE" | "PROJECT" | "RESERVATION" | "TRANSACTION";
    prefix: string;
  }> = [
    { key: "REQUEST", prefix: "SC" },
    { key: "QUOTE", prefix: "DEV" },
    { key: "INVOICE", prefix: "FAC" },
    { key: "CREDIT_NOTE", prefix: "AV" },
    { key: "PROJECT", prefix: "PRJ" },
    { key: "RESERVATION", prefix: "RDV" },
    { key: "TRANSACTION", prefix: "TRX" },
  ];
  const year = new Date().getFullYear();
  for (const { key, prefix } of sequences) {
    await prisma.numberSequence.upsert({
      where: { key },
      update: {},
      create: { key, prefix, year, nextValue: 1, resetPolicy: "YEARLY" },
    });
  }
}

async function seedSettings() {
  const settings: Array<{ key: string; value: object }> = [
    {
      key: "brand",
      value: {
        name: "SaldaeConnect",
        slogan: {
          fr: "L'agence numérique qui fait avancer vos projets.",
          en: "The digital agency that moves your projects forward.",
          ar: "الوكالة الرقمية التي تدفع مشاريعك إلى الأمام.",
        },
        logoFileId: null,
        faviconFileId: null,
      },
    },
    {
      key: "theme",
      value: {
        colors: {
          ink: "#0B1220",
          brand: "#1D4ED8",
          accent: "#D08C4A",
        },
      },
    },
    {
      key: "contact",
      value: {
        email: "contact@saldaeconnect.test",
        phone: "+213000000000",
        whatsapp: "+213000000000",
        address: null,
        city: "Béjaïa",
        country: "DZ",
        timezone: "Africa/Algiers",
        hours: null,
      },
    },
    { key: "social", value: {} },
    {
      key: "invoicing",
      value: {
        legalReviewCompleted: false,
        defaultCurrency: "DZD",
        secondaryCurrencies: ["EUR"],
        roundingMode: "HALF_UP",
        note: "Taux de taxe et mentions légales à valider avec le comptable avant la première facture réelle (§K).",
      },
    },
    {
      key: "modules",
      value: {
        blog: true,
        bookings: true,
        transactions: true,
        transactionsPublic: false,
      },
    },
    {
      key: "seo",
      value: {
        defaultTitle: { fr: "SaldaeConnect", en: "SaldaeConnect", ar: "SaldaeConnect" },
        defaultDescription: {
          fr: "Agence de services numériques : développement, design et marketing digital.",
          en: "Digital services agency: development, design and digital marketing.",
          ar: "وكالة خدمات رقمية: تطوير وتصميم وتسويق رقمي.",
        },
      },
    },
  ];

  for (const { key, value } of settings) {
    await prisma.setting.upsert({
      where: { key },
      update: {}, // ne jamais écraser une valeur déjà personnalisée par l'admin
      create: { key, value },
    });
  }
}

// Catalogue initial (§2 du cahier des charges) : contenu réel de l'agence,
// marqué comme "à relire" jusqu'à validation (les textes FR sont
// commerciaux, EN et AR sont des premières versions à faire relire par un
// locuteur natif — voir §K du document d'architecture).
const CATALOG: Array<{
  categoryKey: string;
  categoryLabels: Record<"fr" | "en" | "ar", string>;
  services: Array<{
    slug: string;
    fulfillmentType: "QUOTE" | "RECURRING" | "BOOKING" | "TRANSACTION";
    labels: Record<"fr" | "en" | "ar", { name: string; shortDescription: string }>;
  }>;
}> = [
  {
    categoryKey: "development",
    categoryLabels: { fr: "Développement", en: "Development", ar: "التطوير" },
    services: [
      {
        slug: "developpement-web",
        fulfillmentType: "QUOTE",
        labels: {
          fr: { name: "Développement web", shortDescription: "Sites vitrines, plateformes et applications web sur mesure." },
          en: { name: "Web development", shortDescription: "Custom websites, platforms and web applications." },
          ar: { name: "تطوير الويب", shortDescription: "مواقع وتطبيقات ويب مخصصة." },
        },
      },
      {
        slug: "developpement-mobile",
        fulfillmentType: "QUOTE",
        labels: {
          fr: { name: "Développement mobile", shortDescription: "Applications iOS et Android natives ou multiplateformes." },
          en: { name: "Mobile development", shortDescription: "Native or cross-platform iOS and Android apps." },
          ar: { name: "تطوير تطبيقات الجوال", shortDescription: "تطبيقات iOS و Android." },
        },
      },
      {
        slug: "developpement-logiciel",
        fulfillmentType: "QUOTE",
        labels: {
          fr: { name: "Développement logiciel", shortDescription: "Logiciels métier et outils internes sur mesure." },
          en: { name: "Software development", shortDescription: "Custom business software and internal tools." },
          ar: { name: "تطوير البرمجيات", shortDescription: "برمجيات وأدوات داخلية مخصصة." },
        },
      },
      {
        slug: "portfolio",
        fulfillmentType: "QUOTE",
        labels: {
          fr: { name: "Création de portfolio", shortDescription: "Un site pour présenter votre travail avec impact." },
          en: { name: "Portfolio creation", shortDescription: "A site that showcases your work with impact." },
          ar: { name: "إنشاء معرض أعمال", shortDescription: "موقع لعرض أعمالك بشكل احترافي." },
        },
      },
    ],
  },
  {
    categoryKey: "branding",
    categoryLabels: { fr: "Branding / Design", en: "Branding / Design", ar: "الهوية والتصميم" },
    services: [
      {
        slug: "creation-de-logo",
        fulfillmentType: "QUOTE",
        labels: {
          fr: { name: "Création de logo", shortDescription: "Un logo distinctif qui vous représente." },
          en: { name: "Logo creation", shortDescription: "A distinctive logo that represents you." },
          ar: { name: "تصميم الشعار", shortDescription: "شعار مميز يعبر عنك." },
        },
      },
      {
        slug: "identite-visuelle",
        fulfillmentType: "QUOTE",
        labels: {
          fr: { name: "Identité visuelle", shortDescription: "Une image de marque cohérente sur tous vos supports." },
          en: { name: "Visual identity", shortDescription: "A consistent brand image across all your materials." },
          ar: { name: "الهوية البصرية", shortDescription: "صورة علامة تجارية متناسقة." },
        },
      },
      {
        slug: "cartes-de-visite",
        fulfillmentType: "QUOTE",
        labels: {
          fr: { name: "Cartes de visite", shortDescription: "Des cartes de visite professionnelles et mémorables." },
          en: { name: "Business cards", shortDescription: "Professional, memorable business cards." },
          ar: { name: "بطاقات العمل", shortDescription: "بطاقات عمل احترافية." },
        },
      },
    ],
  },
  {
    categoryKey: "marketing",
    categoryLabels: { fr: "Marketing digital", en: "Digital marketing", ar: "التسويق الرقمي" },
    services: [
      {
        slug: "reseaux-sociaux",
        fulfillmentType: "RECURRING",
        labels: {
          fr: { name: "Gestion des réseaux sociaux", shortDescription: "Création de contenu et animation de vos comptes." },
          en: { name: "Social media management", shortDescription: "Content creation and account management." },
          ar: { name: "إدارة وسائل التواصل الاجتماعي", shortDescription: "إنشاء محتوى وإدارة حساباتك." },
        },
      },
      {
        slug: "publicite-digitale",
        fulfillmentType: "RECURRING",
        labels: {
          fr: { name: "Publicité digitale", shortDescription: "Campagnes Meta, Google et Snapchat Ads." },
          en: { name: "Digital advertising", shortDescription: "Meta, Google and Snapchat Ads campaigns." },
          ar: { name: "الإعلانات الرقمية", shortDescription: "حملات إعلانية على ميتا وجوجل وسناب شات." },
        },
      },
    ],
  },
  {
    categoryKey: "transactional",
    categoryLabels: { fr: "Services transactionnels", en: "Transactional services", ar: "الخدمات المالية" },
    services: [
      {
        slug: "change-devises",
        fulfillmentType: "TRANSACTION",
        labels: {
          fr: { name: "Vente de devises", shortDescription: "Service en cours de configuration." },
          en: { name: "Currency exchange", shortDescription: "Service being configured." },
          ar: { name: "صرف العملات", shortDescription: "الخدمة قيد الإعداد." },
        },
      },
      {
        slug: "cartes-prepayees",
        fulfillmentType: "TRANSACTION",
        labels: {
          fr: { name: "Cartes prépayées", shortDescription: "Service en cours de configuration." },
          en: { name: "Prepaid cards", shortDescription: "Service being configured." },
          ar: { name: "بطاقات مدفوعة مسبقًا", shortDescription: "الخدمة قيد الإعداد." },
        },
      },
    ],
  },
  {
    categoryKey: "appointments",
    categoryLabels: { fr: "Rendez-vous et démarches", en: "Appointments", ar: "المواعيد والإجراءات" },
    services: [
      {
        slug: "rendez-vous-visa",
        fulfillmentType: "BOOKING",
        labels: {
          fr: { name: "Prise de rendez-vous visa", shortDescription: "Accompagnement pour l'obtention de votre rendez-vous." },
          en: { name: "Visa appointment", shortDescription: "Support to secure your visa appointment." },
          ar: { name: "حجز موعد التأشيرة", shortDescription: "مساعدة للحصول على موعد التأشيرة." },
        },
      },
      {
        slug: "rendez-vous-tcf",
        fulfillmentType: "BOOKING",
        labels: {
          fr: { name: "Prise de rendez-vous TCF", shortDescription: "Accompagnement pour l'inscription à l'examen." },
          en: { name: "TCF exam appointment", shortDescription: "Support to register for the exam." },
          ar: { name: "حجز موعد اختبار TCF", shortDescription: "مساعدة للتسجيل في الاختبار." },
        },
      },
    ],
  },
];

async function seedCatalog() {
  for (const category of CATALOG) {
    const existingCategoryTranslation = await prisma.serviceCategoryTranslation.findFirst({
      where: { locale: "fr", slug: category.categoryKey },
    });
    const cat = existingCategoryTranslation
      ? await prisma.serviceCategory.findUniqueOrThrow({
          where: { id: existingCategoryTranslation.parentId },
        })
      : await prisma.serviceCategory.create({ data: {} });

    for (const [locale, name] of Object.entries(category.categoryLabels)) {
      await prisma.serviceCategoryTranslation.upsert({
        where: { parentId_locale: { parentId: cat.id, locale } },
        update: { name },
        create: { parentId: cat.id, locale, name, slug: category.categoryKey, description: null },
      });
    }

    for (const service of category.services) {
      const existingTranslation = await prisma.serviceTranslation.findFirst({
        where: { locale: "fr", slug: service.slug },
      });
      const svc = existingTranslation
        ? await prisma.service.findUniqueOrThrow({ where: { id: existingTranslation.serviceId } })
        : await prisma.service.create({
            data: { categoryId: cat.id, fulfillmentType: service.fulfillmentType, priceDisplay: "HIDDEN" },
          });

      for (const [locale, { name, shortDescription }] of Object.entries(service.labels)) {
        await prisma.serviceTranslation.upsert({
          where: { serviceId_locale: { serviceId: svc.id, locale } },
          update: { name, shortDescription },
          create: {
            serviceId: svc.id,
            locale,
            name,
            slug: service.slug,
            shortDescription,
            isPublished: locale === "fr", // EN/AR publiés une fois relus (§K)
          },
        });
      }
    }
  }
}

export async function seedBase() {
  await seedPermissionsAndRoles();
  await seedPipeline();
  await seedLeadSources();
  await seedLostReasons();
  await seedPaymentMethods();
  await seedNumberSequences();
  await seedSettings();
  await seedCatalog();
  console.info("✅ seed:base terminé");
}
