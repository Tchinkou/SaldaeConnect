import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/server/core/authz/session";
import { prisma } from "@/server/core/db/client";
import { computeProjectProgress } from "@/server/core/projects/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";

const STATUS_TONE = {
  PLANNING: "neutral",
  IN_PROGRESS: "info",
  WAITING_CLIENT: "warning",
  REVIEW: "brand",
  COMPLETED: "success",
  ARCHIVED: "neutral",
} as const;

/** Liste des projets du client (§F.4, §J). */
export default async function PortalProjectsPage() {
  const currentUser = await getCurrentUser();
  const t = await getTranslations("portal.projects");

  const contact = await prisma.clientContact.findUnique({ where: { userId: currentUser!.user.id } });
  const projects = contact
    ? await prisma.project.findMany({
        where: { clientId: contact.clientId },
        orderBy: { createdAt: "desc" },
        include: {
          tasks: { select: { status: true } },
          milestones: { select: { status: true, weight: true } },
        },
      })
    : [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>

      {projects.length === 0 ? (
        <p className="text-sm text-foreground/60">{t("empty")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {projects.map((project) => {
            const progress = computeProjectProgress(project.progressMode, {
              progressManual: project.progressManual,
              tasks: project.tasks,
              milestones: project.milestones,
            });
            return (
              <Link key={project.id} href={`/portal/projects/${project.id}`}>
                <Card className="transition-colors hover:border-brand-400">
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div>
                      <p className="text-xs font-medium text-brand-600">{project.number}</p>
                      <p className="text-sm font-semibold text-foreground">{project.name}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium text-foreground" dir="ltr">
                        {progress}%
                      </span>
                      <Badge tone={STATUS_TONE[project.status]}>{t(`statusValue.${project.status}`)}</Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
