-- DropIndex
DROP INDEX "client_contacts_one_primary_per_client";

-- DropIndex
DROP INDEX "clients_code_trgm_idx";

-- DropIndex
DROP INDEX "clients_display_name_trgm_idx";

-- DropIndex
DROP INDEX "clients_email_trgm_idx";

-- DropIndex
DROP INDEX "invoices_number_trgm_idx";

-- DropIndex
DROP INDEX "leads_company_name_trgm_idx";

-- DropIndex
DROP INDEX "leads_email_trgm_idx";

-- DropIndex
DROP INDEX "opportunities_number_trgm_idx";

-- DropIndex
DROP INDEX "opportunities_title_trgm_idx";

-- DropIndex
DROP INDEX "projects_name_trgm_idx";

-- DropIndex
DROP INDEX "projects_number_trgm_idx";

-- DropIndex
DROP INDEX "quotes_number_trgm_idx";

-- DropIndex
DROP INDEX "service_translations_name_trgm_idx";

-- AlterTable
ALTER TABLE "reservations" ADD COLUMN     "remindedAt" TIMESTAMP(3);
