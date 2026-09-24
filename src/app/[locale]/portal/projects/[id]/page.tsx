import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/server/core/db/client";
import { getCurrentUser } from "@/server/core/authz/session";
import { formatMoney } from "@/server/core/money";
import { computeProjectProgress } from "@/server/core/projects/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { PortalProjectMessages } from "@/app/[locale]/portal/projects/[id]/portal-project-messages";
import { PortalProjectFiles } from "@/app/[locale]/portal/projects/[id]/portal-project-files";

const STATUS_TONE = {
  PLANNING: "neutral",
  IN_PROGRESS: "info",
  WAITING_CLIENT: "warning",
  REVIEW: "brand",
  COMPLETED: "success",
  ARCHIVED: "neutral",
} as const;

const MILESTONE_STATUS_TONE = { TODO: "neutral", IN_PROGRESS: "info", DONE: "success", CANCELLED: "danger" } as const;

/** Vue projet minimale du portail client (§F.4) : progression, jalons, tâches visibles, fichiers, messagerie. */
export default async function PortalProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  const { id } = await params;
  const locale = await getLocale();
  const t = await getTranslations("portal.projects.detail");

  const contact = await prisma.clientContact.findUnique({ where: { userId: currentUser!.user.id } });
  if (!contact) notFound();

  // §H.2 : le périmètre client est dans le `where` (pas une vérification a
  // posteriori) — un id d'un autre client ne correspond simplement à rien.
  const project = await prisma.project.findFirst({
    where: { id, clientId: contact.clientId },
    include: {
      milestones: { orderBy: { position: "asc" } },
      tasks: { where: { visibleToClient: true }, orderBy: { dueAt: "asc" } },
      files: { where: { status: "ACTIVE", visibility: "CLIENT", projectId: id }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!project) notFound();

  const progress = computeProjectProgress(project.progressMode, {
    progressManual: project.progressManual,
    tasks: project.tasks,
    milestones: project.milestones,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium text-brand-600">{project.number}</p>
        <h1 className="text-xl font-semibold text-foreground">{project.name}</h1>
        <div className="mt-1 flex items-center gap-2">
          <Badge tone={STATUS_TONE[project.status]}>{t(`statusValue.${project.status}`)}</Badge>
          {project.budget != null ? (
            <span className="text-sm text-foreground/60" dir="ltr">
              {formatMoney(project.budget, project.currency ?? "DZD", locale)}
            </span>
          ) : null}
        </div>
        <Link href="/portal/projects" className="mt-2 inline-block text-sm font-medium text-brand-600 hover:underline">
          {t("backToProjects")}
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("progress")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-background">
              <div className="h-full rounded-full bg-brand-600" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-sm font-medium text-foreground" dir="ltr">
              {progress}%
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("milestones")}</CardTitle>
        </CardHeader>
        <CardContent>
          {project.milestones.length === 0 ? (
            <p className="text-sm text-foreground/70">{t("noMilestones")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {project.milestones.map((milestone) => (
                <li key={milestone.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="font-medium text-foreground">{milestone.title}</span>
                  <Badge tone={MILESTONE_STATUS_TONE[milestone.status]}>{t(`milestoneStatusValue.${milestone.status}`)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("tasks")}</CardTitle>
        </CardHeader>
        <CardContent>
          {project.tasks.length === 0 ? (
            <p className="text-sm text-foreground/70">{t("noTasks")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {project.tasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className={task.status === "DONE" ? "text-foreground/40 line-through" : "text-foreground"}>{task.title}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("files")}</CardTitle>
        </CardHeader>
        <CardContent>
          <PortalProjectFiles
            projectId={project.id}
            files={project.files.map((file) => ({
              id: file.id,
              originalName: file.originalName,
              sizeBytes: file.sizeBytes.toString(),
              createdAt: file.createdAt.toISOString(),
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("messages")}</CardTitle>
        </CardHeader>
        <CardContent>
          <PortalProjectMessages projectId={project.id} />
        </CardContent>
      </Card>
    </div>
  );
}
