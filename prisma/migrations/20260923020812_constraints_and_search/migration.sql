-- Contraintes et index que Prisma n'exprime pas nativement dans le schéma
-- (voir docs/database.md §B.4-B.5). SQL versionné à la main, comme documenté.

-- ---------------------------------------------------------------------------
-- CHECK : cohérence métier
-- ---------------------------------------------------------------------------

-- Une opportunité vient toujours d'un lead ou d'un client (jamais aucun des deux).
ALTER TABLE "opportunities"
  ADD CONSTRAINT "opportunities_lead_or_client_check"
  CHECK ("leadId" IS NOT NULL OR "clientId" IS NOT NULL);

-- Un fichier a au plus un parent métier (aucune ambiguïté sur sa provenance).
ALTER TABLE "files"
  ADD CONSTRAINT "files_single_parent_check"
  CHECK (
    (CASE WHEN "clientId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "opportunityId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "projectId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "taskId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "messageId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "reservationId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "transactionOrderId" IS NOT NULL THEN 1 ELSE 0 END)
    <= 1
  );

-- Montants et quantités toujours positifs.
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quantity_positive_check" CHECK ("quantity" > 0);
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_unit_price_nonneg_check" CHECK ("unitPrice" >= 0);
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_quantity_positive_check" CHECK ("quantity" > 0);
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_unit_price_nonneg_check" CHECK ("unitPrice" >= 0);
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_positive_check" CHECK ("amount" > 0);
ALTER TABLE "transaction_payments" ADD CONSTRAINT "transaction_payments_amount_positive_check" CHECK ("amount" > 0);
ALTER TABLE "transaction_order_items" ADD CONSTRAINT "transaction_order_items_quantity_positive_check" CHECK ("quantity" > 0);

-- Cohérence des dates (fin >= début) quand les deux sont renseignées.
ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_dates_order_check"
  CHECK ("endsAt" IS NULL OR "startsAt" IS NULL OR "endsAt" >= "startsAt");

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_dates_order_check"
  CHECK ("dueDate" IS NULL OR "startDate" IS NULL OR "dueDate" >= "startDate");

-- ---------------------------------------------------------------------------
-- Unicité partielle : un seul contact principal actif par client
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX "client_contacts_one_primary_per_client"
  ON "client_contacts" ("clientId")
  WHERE "isPrimary" = true;

-- ---------------------------------------------------------------------------
-- Recherche plein texte : pg_trgm + index GIN (voir docs/architecture.md §I.6)
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "clients_display_name_trgm_idx" ON "clients" USING GIN ("displayName" gin_trgm_ops);
CREATE INDEX "clients_email_trgm_idx" ON "clients" USING GIN ("email" gin_trgm_ops);
CREATE INDEX "clients_code_trgm_idx" ON "clients" USING GIN ("code" gin_trgm_ops);

CREATE INDEX "leads_full_name_trgm_idx" ON "leads" USING GIN (("firstName" || ' ' || "lastName") gin_trgm_ops);
CREATE INDEX "leads_email_trgm_idx" ON "leads" USING GIN ("email" gin_trgm_ops);
CREATE INDEX "leads_company_name_trgm_idx" ON "leads" USING GIN ("companyName" gin_trgm_ops);

CREATE INDEX "opportunities_number_trgm_idx" ON "opportunities" USING GIN ("number" gin_trgm_ops);
CREATE INDEX "opportunities_title_trgm_idx" ON "opportunities" USING GIN ("title" gin_trgm_ops);

CREATE INDEX "quotes_number_trgm_idx" ON "quotes" USING GIN ("number" gin_trgm_ops);
CREATE INDEX "invoices_number_trgm_idx" ON "invoices" USING GIN ("number" gin_trgm_ops);
CREATE INDEX "projects_number_trgm_idx" ON "projects" USING GIN ("number" gin_trgm_ops);
CREATE INDEX "projects_name_trgm_idx" ON "projects" USING GIN ("name" gin_trgm_ops);

CREATE INDEX "service_translations_name_trgm_idx" ON "service_translations" USING GIN ("name" gin_trgm_ops);
