-- Ajoute la relation Invitation -> Role (voir 10-identity.prisma). Les
-- instructions DROP INDEX générées automatiquement ont été retirées : elles
-- visaient les index de recherche pg_trgm et l'index partiel écrits à la
-- main dans 20260923020812_constraints_and_search, que le moteur de diff de
-- Prisma ne connaît pas puisqu'ils n'existent pas dans le schéma déclaratif
-- (voir docs/database.md). Ne jamais accepter tel quel un DROP INDEX généré
-- sur ces index-là.
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
