import { NextResponse } from "next/server";
import { prisma } from "@/server/core/db/client";
import { getCurrentUser, hasPermission } from "@/server/core/authz/session";
import { assertQuoteOwnerInScope, assertProjectManagerInScope } from "@/server/core/authz/ownership";
import { readStoredFile } from "@/server/core/storage";
import { ForbiddenError } from "@/server/core/errors";

/**
 * Téléchargement de fichiers servis en dehors des routes localisées (§H.4) —
 * pas de préfixe de langue ici, les routes API n'en ont jamais. Deux usages
 * autorisés pour l'instant : le PDF d'un devis (§J) et les fichiers de projet
 * (§F.4, staff via `project.read`/`file.read`, ou le contact client du
 * projet — uniquement si `visibility` = CLIENT, jamais un fichier interne).
 * Toute autre `FileCategory`/rattachement est refusé — les autres usages
 * (réservations, transactions…) n'ont pas encore de règle d'autorisation
 * définie et seront ajoutés phase par phase plutôt que d'ouvrir un accès
 * générique non vérifié.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const file = await prisma.file.findUnique({ where: { id } });
  if (!file || file.status !== "ACTIVE") {
    return new NextResponse(null, { status: 404 });
  }

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return new NextResponse(null, { status: 401 });
  }

  if (file.category === "QUOTE_PDF") {
    const version = await prisma.quoteVersion.findFirst({
      where: { pdfFileId: file.id },
      include: { quote: { include: { client: true } } },
    });
    if (!version) {
      return new NextResponse(null, { status: 404 });
    }

    if (currentUser.user.userType === "STAFF") {
      if (!hasPermission(currentUser, "quote.read")) {
        return new NextResponse(null, { status: 403 });
      }
      try {
        assertQuoteOwnerInScope(currentUser, "quote.read", version.quote.client.ownerId);
      } catch (error) {
        if (error instanceof ForbiddenError) return new NextResponse(null, { status: 403 });
        throw error;
      }
    } else if (currentUser.user.userType === "CLIENT") {
      const contact = await prisma.clientContact.findUnique({ where: { userId: currentUser.user.id } });
      if (!contact || contact.clientId !== version.quote.clientId) {
        return new NextResponse(null, { status: 403 });
      }
    } else {
      return new NextResponse(null, { status: 403 });
    }
  } else if (file.projectId) {
    const project = await prisma.project.findUnique({
      where: { id: file.projectId },
      select: { clientId: true, managerId: true, client: { select: { ownerId: true } } },
    });
    if (!project) {
      return new NextResponse(null, { status: 404 });
    }

    if (currentUser.user.userType === "STAFF") {
      if (!hasPermission(currentUser, "file.read")) {
        return new NextResponse(null, { status: 403 });
      }
      try {
        assertProjectManagerInScope(currentUser, "file.read", project.managerId ?? project.client.ownerId);
      } catch (error) {
        if (error instanceof ForbiddenError) return new NextResponse(null, { status: 403 });
        throw error;
      }
    } else if (currentUser.user.userType === "CLIENT") {
      if (file.visibility !== "CLIENT") {
        return new NextResponse(null, { status: 403 });
      }
      const contact = await prisma.clientContact.findUnique({ where: { userId: currentUser.user.id } });
      if (!contact || contact.clientId !== project.clientId) {
        return new NextResponse(null, { status: 403 });
      }
    } else {
      return new NextResponse(null, { status: 403 });
    }
  } else {
    return new NextResponse(null, { status: 404 });
  }

  const bytes = await readStoredFile(file.storageKey);

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `attachment; filename="${file.safeName}"`,
      "Content-Length": String(file.sizeBytes),
    },
  });
}
