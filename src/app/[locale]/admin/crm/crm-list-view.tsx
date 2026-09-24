import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import type { BoardOpportunity, BoardStage } from "@/app/[locale]/admin/crm/crm-board";

/**
 * Vue liste équivalente au Kanban (§E.3) — pour mobile et l'export, sans
 * glisser-déposer.
 */
export function CrmListView({ stages, opportunities }: { stages: BoardStage[]; opportunities: BoardOpportunity[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <TableHead />
        <tbody className="divide-y divide-border">
          {opportunities.map((opportunity) => {
            const stage = stages.find((s) => s.id === opportunity.stageId);
            return (
              <tr key={opportunity.id} className="hover:bg-surface-muted">
                <td className="px-3 py-2 text-xs font-medium text-brand-600">
                  <Link href={`/admin/crm/opportunities/${opportunity.id}`} className="hover:underline">
                    {opportunity.number}
                  </Link>
                </td>
                <td className="px-3 py-2">{opportunity.contactName}</td>
                <td className="px-3 py-2 text-foreground/70">{opportunity.serviceName}</td>
                <td className="px-3 py-2">
                  <Badge tone={stage?.kind === "WON" ? "success" : stage?.kind === "LOST" ? "danger" : "brand"}>
                    {stage?.name ?? "—"}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-foreground/70">{opportunity.ownerName ?? "—"}</td>
                <td className="px-3 py-2 text-foreground/60" dir="ltr">
                  {opportunity.budgetMin || opportunity.budgetMax
                    ? `${opportunity.budgetMin ?? "?"}–${opportunity.budgetMax ?? "?"} ${opportunity.budgetCurrency ?? ""}`
                    : "—"}
                </td>
              </tr>
            );
          })}
          {opportunities.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-3 py-6 text-center text-sm text-foreground/70">
                <EmptyLabel />
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function TableHead() {
  const t = useTranslations("admin.crm.list");
  return (
    <thead className="bg-surface-muted text-start text-xs font-medium uppercase tracking-wide text-foreground/60">
      <tr>
        <th className="px-3 py-2 text-start">{t("number")}</th>
        <th className="px-3 py-2 text-start">{t("contact")}</th>
        <th className="px-3 py-2 text-start">{t("service")}</th>
        <th className="px-3 py-2 text-start">{t("stage")}</th>
        <th className="px-3 py-2 text-start">{t("owner")}</th>
        <th className="px-3 py-2 text-start">{t("budget")}</th>
      </tr>
    </thead>
  );
}

function EmptyLabel() {
  const t = useTranslations("admin.crm.list");
  return <>{t("empty")}</>;
}
