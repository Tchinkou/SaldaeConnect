// Seed de base : tout ce dont l'application a besoin pour fonctionner
// (permissions, rôles système, pipeline, séquences de numérotation,
// paramètres par défaut…). Idempotent — peut être exécuté en production.
// Voir docs/architecture.md §H.3, §E.3, §0.3.
import { prisma } from "./lib/client";
import { PERMISSIONS } from "@/lib/permissions";

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
        autoDraftDepositInvoice: true,
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
    {
      // Identité légale de l'agence : nécessaire pour les mentions légales et
      // la facturation réelle (§K.2) — laissée vide tant qu'elle n'a pas été
      // fournie ; la page /legal/mentions-legales affiche « à compléter ».
      key: "legal",
      value: {
        legalName: null,
        legalForm: null,
        registrationNumber: null,
        taxId: null,
        shareCapital: null,
        registeredAddress: null,
        publicationDirector: null,
        hostingProvider: null,
      },
    },
    {
      // Attribution par défaut des nouveaux leads/opportunités (§E.2) : tour
      // de rôle entre le staff actif habilité, ou un responsable fixe.
      key: "crm",
      value: {
        attributionMode: "round_robin",
        fixedOwnerId: null,
        lastAssignedOwnerId: null,
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

// Pages statiques (§C, §G.9) : "à propos" et les quatre pages légales.
// Le FR est publié immédiatement ; EN/AR sont écrits mais marqués "à
// relire" (non publiés) tant qu'un locuteur natif ne les a pas validés
// (§K.2). Les pages légales portent en plus `needsLegalReview: true` tant
// que Chakib n'a pas confirmé le texte (bandeau visible admin + public).
type PageBlock = { type: "heading" | "paragraph"; text: string };

const PAGES: Array<{
  key: string;
  isSystem: boolean;
  needsLegalReview: boolean;
  translations: Record<
    "fr" | "en" | "ar",
    { title: string; slug: string; blocks: PageBlock[] }
  >;
}> = [
  {
    key: "about",
    isSystem: true,
    needsLegalReview: false,
    translations: {
      fr: {
        title: "À propos de SaldaeConnect",
        slug: "a-propos",
        blocks: [
          { type: "heading", text: "Une agence numérique basée à Béjaïa" },
          {
            type: "paragraph",
            text: "SaldaeConnect accompagne les entreprises et porteurs de projet dans leur transformation numérique : développement web et mobile, identité de marque, marketing digital et démarches en ligne. Nous privilégions des projets pensés pour durer plutôt que des solutions jetables.",
          },
          {
            type: "paragraph",
            text: "Notre équipe travaille en français, en anglais et en arabe, pour accompagner aussi bien des clients locaux qu'internationaux.",
          },
        ],
      },
      en: {
        title: "About SaldaeConnect",
        slug: "about",
        blocks: [
          { type: "heading", text: "A digital agency based in Béjaïa" },
          {
            type: "paragraph",
            text: "SaldaeConnect helps businesses and founders through their digital transformation: web and mobile development, brand identity, digital marketing and online processes. We favour projects built to last over disposable solutions.",
          },
          {
            type: "paragraph",
            text: "Our team works in French, English and Arabic, supporting both local and international clients.",
          },
        ],
      },
      ar: {
        title: "عن SaldaeConnect",
        slug: "a-propos",
        blocks: [
          { type: "heading", text: "وكالة رقمية مقرها بجاية" },
          {
            type: "paragraph",
            text: "ترافق SaldaeConnect الشركات وأصحاب المشاريع في تحولهم الرقمي: تطوير الويب والجوال، الهوية البصرية، التسويق الرقمي والإجراءات عبر الإنترنت. نفضل المشاريع المصممة لتدوم بدلاً من الحلول المؤقتة.",
          },
          {
            type: "paragraph",
            text: "يعمل فريقنا بالفرنسية والإنجليزية والعربية لمرافقة العملاء المحليين والدوليين على حد سواء.",
          },
        ],
      },
    },
  },
  {
    key: "legal-notice",
    isSystem: true,
    needsLegalReview: true,
    translations: {
      fr: {
        title: "Mentions légales",
        slug: "mentions-legales",
        blocks: [
          {
            type: "paragraph",
            text: "Ce texte est provisoire et en attente de validation juridique (raison sociale, forme juridique, numéro d'identification et siège social à compléter — voir les paramètres légaux dans l'administration).",
          },
          { type: "heading", text: "Éditeur du site" },
          {
            type: "paragraph",
            text: "Les informations d'identification de l'éditeur (raison sociale, forme juridique, adresse du siège, numéro d'immatriculation) seront publiées ici une fois validées.",
          },
          { type: "heading", text: "Hébergement" },
          {
            type: "paragraph",
            text: "Les informations relatives à l'hébergeur du site seront publiées ici une fois l'hébergement de production choisi.",
          },
        ],
      },
      en: {
        title: "Legal notice",
        slug: "legal-notice",
        blocks: [
          {
            type: "paragraph",
            text: "This text is provisional and pending legal validation (company name, legal form, registration number and registered address to be completed — see legal settings in the admin).",
          },
          { type: "heading", text: "Publisher" },
          {
            type: "paragraph",
            text: "The publisher's identification details (company name, legal form, registered address, registration number) will be published here once validated.",
          },
          { type: "heading", text: "Hosting" },
          {
            type: "paragraph",
            text: "Hosting provider details will be published here once production hosting is chosen.",
          },
        ],
      },
      ar: {
        title: "الإشعار القانوني",
        slug: "mentions-legales",
        blocks: [
          {
            type: "paragraph",
            text: "هذا النص مؤقت وينتظر المصادقة القانونية (الاسم التجاري، الشكل القانوني، رقم التسجيل والعنوان القانوني سيتم استكمالها).",
          },
          { type: "heading", text: "ناشر الموقع" },
          {
            type: "paragraph",
            text: "سيتم نشر معلومات تعريف الناشر هنا بعد المصادقة عليها.",
          },
        ],
      },
    },
  },
  {
    key: "privacy",
    isSystem: true,
    needsLegalReview: true,
    translations: {
      fr: {
        title: "Politique de confidentialité",
        slug: "confidentialite",
        blocks: [
          {
            type: "paragraph",
            text: "Ce texte est provisoire et en attente de validation juridique.",
          },
          { type: "heading", text: "Données collectées" },
          {
            type: "paragraph",
            text: "Lorsque vous utilisez notre formulaire de demande ou notre formulaire de contact, nous collectons les informations que vous fournissez volontairement (nom, coordonnées, message et pièces jointes éventuelles) afin de répondre à votre demande.",
          },
          { type: "heading", text: "Utilisation et conservation" },
          {
            type: "paragraph",
            text: "Ces données sont utilisées uniquement pour traiter votre demande et, si vous devenez client, pour la gestion de la relation commerciale. Elles ne sont ni vendues ni partagées avec des tiers en dehors des prestataires nécessaires au fonctionnement du service (hébergement, envoi d'emails).",
          },
          { type: "heading", text: "Vos droits" },
          {
            type: "paragraph",
            text: "Vous pouvez demander l'accès, la rectification ou la suppression de vos données en nous contactant via la page contact.",
          },
        ],
      },
      en: {
        title: "Privacy policy",
        slug: "privacy-policy",
        blocks: [
          {
            type: "paragraph",
            text: "This text is provisional and pending legal validation.",
          },
          { type: "heading", text: "Data we collect" },
          {
            type: "paragraph",
            text: "When you use our request form or contact form, we collect the information you provide (name, contact details, message and any attachments) in order to respond to your request.",
          },
          { type: "heading", text: "Use and retention" },
          {
            type: "paragraph",
            text: "This data is used only to process your request and, should you become a client, to manage that relationship. It is never sold and is shared only with the providers necessary to operate the service (hosting, email delivery).",
          },
          { type: "heading", text: "Your rights" },
          {
            type: "paragraph",
            text: "You may request access to, correction of, or deletion of your data by contacting us through the contact page.",
          },
        ],
      },
      ar: {
        title: "سياسة الخصوصية",
        slug: "confidentialite",
        blocks: [
          {
            type: "paragraph",
            text: "هذا النص مؤقت وينتظر المصادقة القانونية.",
          },
          { type: "heading", text: "البيانات التي نجمعها" },
          {
            type: "paragraph",
            text: "عند استخدامك لنموذج الطلب أو نموذج الاتصال، نقوم بجمع المعلومات التي تقدمها طواعية (الاسم، بيانات الاتصال، الرسالة والمرفقات) للرد على طلبك.",
          },
          { type: "heading", text: "حقوقك" },
          {
            type: "paragraph",
            text: "يمكنك طلب الوصول إلى بياناتك أو تصحيحها أو حذفها عبر صفحة الاتصال.",
          },
        ],
      },
    },
  },
  {
    key: "terms",
    isSystem: true,
    needsLegalReview: true,
    translations: {
      fr: {
        title: "Conditions générales de vente",
        slug: "cgv",
        blocks: [
          {
            type: "paragraph",
            text: "Ce texte est provisoire et en attente de validation juridique, notamment sur les règles fiscales applicables (§K.2).",
          },
          { type: "heading", text: "Objet" },
          {
            type: "paragraph",
            text: "Les présentes conditions régissent la fourniture des prestations proposées par SaldaeConnect, telles que détaillées dans le devis accepté par le client.",
          },
          { type: "heading", text: "Devis et acceptation" },
          {
            type: "paragraph",
            text: "Toute prestation fait l'objet d'un devis préalable. La prestation ne démarre qu'après acceptation explicite du devis par le client depuis son espace personnel.",
          },
        ],
      },
      en: {
        title: "Terms of service",
        slug: "terms-of-service",
        blocks: [
          {
            type: "paragraph",
            text: "This text is provisional and pending legal validation, notably regarding applicable tax rules.",
          },
          { type: "heading", text: "Purpose" },
          {
            type: "paragraph",
            text: "These terms govern the services provided by SaldaeConnect, as detailed in the quote accepted by the client.",
          },
          { type: "heading", text: "Quotes and acceptance" },
          {
            type: "paragraph",
            text: "Every engagement is preceded by a quote. Work begins only once the client has explicitly accepted the quote from their client portal.",
          },
        ],
      },
      ar: {
        title: "الشروط العامة للبيع",
        slug: "cgv",
        blocks: [
          {
            type: "paragraph",
            text: "هذا النص مؤقت وينتظر المصادقة القانونية.",
          },
          { type: "heading", text: "الموضوع" },
          {
            type: "paragraph",
            text: "تحكم هذه الشروط تقديم الخدمات التي تقترحها SaldaeConnect، كما هو مفصل في عرض السعر الذي يقبله العميل.",
          },
        ],
      },
    },
  },
  {
    key: "cookies",
    isSystem: true,
    needsLegalReview: true,
    translations: {
      fr: {
        title: "Politique de cookies",
        slug: "cookies",
        blocks: [
          {
            type: "paragraph",
            text: "Ce texte est provisoire et en attente de validation juridique.",
          },
          { type: "heading", text: "Cookies utilisés" },
          {
            type: "paragraph",
            text: "Le site utilise uniquement des cookies strictement nécessaires à son fonctionnement : préférence de langue et session de connexion pour les espaces client et administration. Aucun cookie publicitaire ou de suivi tiers n'est déposé à ce jour.",
          },
        ],
      },
      en: {
        title: "Cookie policy",
        slug: "cookies",
        blocks: [
          {
            type: "paragraph",
            text: "This text is provisional and pending legal validation.",
          },
          { type: "heading", text: "Cookies we use" },
          {
            type: "paragraph",
            text: "The site only uses cookies strictly necessary for it to function: language preference and login session for the client and admin areas. No advertising or third-party tracking cookies are set at this time.",
          },
        ],
      },
      ar: {
        title: "سياسة ملفات تعريف الارتباط",
        slug: "cookies",
        blocks: [
          {
            type: "paragraph",
            text: "هذا النص مؤقت وينتظر المصادقة القانونية.",
          },
          { type: "heading", text: "ملفات تعريف الارتباط المستخدمة" },
          {
            type: "paragraph",
            text: "يستخدم الموقع فقط ملفات تعريف الارتباط الضرورية لعمله: تفضيل اللغة وجلسة الدخول لمساحتي العميل والإدارة.",
          },
        ],
      },
    },
  },
];

async function seedPages() {
  for (const page of PAGES) {
    const parent = await prisma.page.upsert({
      where: { key: page.key },
      update: { isSystem: page.isSystem },
      create: { key: page.key, isSystem: page.isSystem },
    });

    for (const [locale, { title, slug, blocks }] of Object.entries(page.translations)) {
      await prisma.pageTranslation.upsert({
        where: { parentId_locale: { parentId: parent.id, locale } },
        update: {}, // ne jamais écraser un texte déjà personnalisé par l'admin
        create: {
          parentId: parent.id,
          locale,
          title,
          slug,
          blocks,
          isPublished: locale === "fr", // EN/AR publiés une fois relus (§K.2)
          needsLegalReview: page.needsLegalReview,
        },
      });
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
  await seedPages();
  console.info("✅ seed:base terminé");
}
