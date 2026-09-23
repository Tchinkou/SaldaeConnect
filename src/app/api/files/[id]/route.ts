import { NextResponse } from "next/server";
import { prisma } from "@/server/core/db/client";
import { getCurrentUser, hasPermission } from "@/server/core/authz/session";
import { assertQuoteOwnerInScope } from "@/server/core/authz/ownership";
import { readStoredFile } from "@/server/core/storage";
import { ForbiddenError } from "@/server/core/errors";

/**
 * Téléchargement de fichiers servis en dehors des routes localisées (§H.4) —
 * pas de préfixe de langue ici, les routes API n'en ont jamais. Pour
 * l'instant, scopé strictement au PDF d'un devis (§J) : le staff (via le
 * périmètre `quote.read` habituel) ou le contact client propriétaire du
 * devis correspondant. Toute autre `FileCategory` est refusée — les autres
 * usages (livrables projet, pièces jointes…) n'ont pas encore de règle
 * d'autorisation définie et seront ajoutés phase par phase plutôt que
 * d'ouvrir un accès générique non vérifié.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const file = await prisma.file.findUnique({ where: { id } });
  if (!file || file.category !== "QUOTE_PDF" || file.status !== "ACTIVE") {
    return new NextResponse(null, { status: 404 });
  }

  const version = await prisma.quoteVersion.findFirst({
    where: { pdfFileId: file.id },
    include: { quote: { include: { client: true } } },
  });
  if (!version) {
    return new NextResponse(null, { status: 404 });
  }

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return new NextResponse(null, { status: 401 });
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

  const bytes = await readStoredFile(file.storageKey);

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `attachment; filename="${file.safeName}"`,
      "Content-Length": String(file.sizeBytes),
    },
  });
}
