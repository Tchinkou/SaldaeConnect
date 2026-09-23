import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/server/core/db/client";
import { getCurrentUser, hasPermission } from "@/server/core/authz/session";
import { projectWhereClause } from "@/server/core/authz/ownership";
import { Forbidden } from "@/components/admin/forbidden";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/server/core/money";
import { computeProjectProgress } from "@/server/core/projects/progress";
import { ProjectFilters } from "@/app/[locale]/admin/projects/project-filters";
import type { ProjectStatus } from "@/generated/prisma/client";

const STATUS_TONE: Record<ProjectStatus, "neutral" | "brand" | "success" | "warning" | "danger" | "info"> = {
  PLANNING: "neutral",
  IN_PROGRESS: "info",
  WAITING_CLIENT: "warning",
  REVIEW: "brand",
  COMPLETED: "success",
  ARCHIVED: "neutral",
};

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasPermission(currentUser, "project.read")) {
    return <Forbidden />;
  }

  const t = await getTranslations("admin.projects");
  const locale = await getLocale();
  const params = await searchParams;

  const where: Record<string, unknown> = { ...projectWhereClause(currentUser, "project.read") };
  if (params.status) where.status = params.status;
  if (params.q) {
    where.OR = [
      { name: { contains: params.q, mode: "insensitive" } },
      { number: { contains: params.q, mode: "insensitive" } },
      { client: { displayName: { contains: params.q, mode: "insensitive" } } },
    ];
  }

  const projects = await prisma.project.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      client: true,
      tasks: { select: { status: true } },
      milestones: { select: { status: true, weight: true } },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-foreground/70">{t("subtitle")}</p>
      </div>

      <ProjectFilters currentParams={params} />

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-xs font-medium uppercase tracking-wide text-foreground/60">
                <tr>
                  <th className="px-3 py-2 text-start">{t("number")}</th>
                  <th className="px-3 py-2 text-start">{t("client")}</th>
                  <th className="px-3 py-2 text-start">{t("status")}</th>
                  <th className="px-3 py-2 text-start">{t("progress")}</th>
                  <th className="px-3 py-2 text-start">{t("budget")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {projects.map((project) => {
                  const progress = computeProjectProgress(project.progressMode, {
                    progressManual: project.progressManual,
                    tasks: project.tasks,
                    milestones: project.milestones,
                  });
                  return (
                    <tr key={project.id} className="hover:bg-surface-muted">
                      <td className="px-3 py-2">
                        <Link href={`/admin/projects/${project.id}`} className="font-medium text-brand-600 hover:underline">
                          {project.number}
                        </Link>
                        <p className="text-xs text-foreground/50">{project.name}</p>
                      </td>
                      <td className="px-3 py-2 text-foreground/70">{project.client.displayName}</td>
                      <td className="px-3 py-2">
                        <Badge tone={STATUS_TONE[project.status]}>{t(`statusValue.${project.status}`)}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2" dir="ltr">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-muted">
                            <div className="h-full rounded-full bg-brand-500" style={{ width: `${progress}%` }} />
                          </div>
                          <span className="text-xs text-foreground/60">{progress}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-foreground/70" dir="ltr">
                        {project.budget != null ? formatMoney(project.budget, project.currency ?? "DZD", locale) : "—"}
                      </td>
                    </tr>
                  );
                })}
                {projects.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-foreground/50">
                      {t("empty")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
