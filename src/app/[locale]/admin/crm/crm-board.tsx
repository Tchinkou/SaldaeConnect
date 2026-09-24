"use client";

import { useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { moveOpportunityAction } from "@/app/[locale]/admin/crm/actions";

export type BoardStage = { id: string; key: string; kind: "OPEN" | "WON" | "LOST"; color: string | null; name: string };
export type BoardOpportunity = {
  id: string;
  number: string;
  title: string;
  stageId: string;
  position: number;
  contactName: string;
  companyName: string | null;
  serviceName: string;
  ownerName: string | null;
  budgetMin: string | null;
  budgetMax: string | null;
  budgetCurrency: string | null;
  createdAt: string;
};

function groupByStage(stages: BoardStage[], opportunities: BoardOpportunity[]): Record<string, BoardOpportunity[]> {
  const map: Record<string, BoardOpportunity[]> = {};
  for (const stage of stages) map[stage.id] = [];
  for (const opportunity of opportunities) {
    (map[opportunity.stageId] ??= []).push(opportunity);
  }
  return map;
}

export function CrmBoard({
  stages,
  opportunities,
  lostReasons,
  canWrite,
}: {
  stages: BoardStage[];
  opportunities: BoardOpportunity[];
  lostReasons: Array<{ id: string; label: string }>;
  canWrite: boolean;
}) {
  const t = useTranslations("admin.crm.board");
  const router = useRouter();

  const [columns, setColumns] = useState<Record<string, BoardOpportunity[]>>(() => groupByStage(stages, opportunities));
  const columnsRef = useRef(columns);
  const [activeCard, setActiveCard] = useState<BoardOpportunity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingLostMove, setPendingLostMove] = useState<{
    opportunityId: string;
    toStageId: string;
    orderedIds: string[];
  } | null>(null);
  const dragStartSnapshot = useRef<Record<string, BoardOpportunity[]> | null>(null);

  function update(updater: (prev: Record<string, BoardOpportunity[]>) => Record<string, BoardOpportunity[]>) {
    setColumns((prev) => {
      const next = updater(prev);
      columnsRef.current = next;
      return next;
    });
  }

  function columnOf(id: string): string | undefined {
    return Object.keys(columnsRef.current).find((stageId) => columnsRef.current[stageId]!.some((o) => o.id === id));
  }

  // `sortableKeyboardCoordinates` (le comportement par défaut de dnd-kit)
  // ne sait réordonner qu'à l'intérieur du `SortableContext` courant : au
  // clavier, Gauche/Droite ne franchissaient donc jamais une colonne (chaque
  // étape a son propre `SortableContext`). On délègue Haut/Bas à ce
  // comportement par défaut, et on calcule nous-mêmes Gauche/Droite en visant
  // la colonne voisine dans `stages` (elle est aussi un droppable via
  // `useDroppable({ id: stage.id })` sur `BoardColumn`).
  const crossColumnCoordinateGetter: KeyboardCoordinateGetter = (event, args) => {
    if (event.code !== "ArrowLeft" && event.code !== "ArrowRight") {
      return sortableKeyboardCoordinates(event, args);
    }
    const currentStageId = columnOf(String(args.active));
    if (!currentStageId) return undefined;
    const index = stages.findIndex((s) => s.id === currentStageId);
    const targetStage = stages[event.code === "ArrowRight" ? index + 1 : index - 1];
    if (!targetStage) return undefined;
    const rect = args.context.droppableRects.get(targetStage.id);
    if (!rect) return undefined;
    event.preventDefault();
    return { x: rect.left, y: rect.top };
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: crossColumnCoordinateGetter }),
  );

  function handleDragStart(event: DragStartEvent) {
    dragStartSnapshot.current = columnsRef.current;
    const id = event.active.id as string;
    const column = columnOf(id);
    setActiveCard(column ? (columnsRef.current[column]!.find((o) => o.id === id) ?? null) : null);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    const fromColumn = columnOf(activeId);
    const toColumn = stages.some((s) => s.id === overId) ? overId : columnOf(overId);
    if (!fromColumn || !toColumn || fromColumn === toColumn) return;

    update((prev) => {
      const fromItems = prev[fromColumn]!;
      const item = fromItems.find((o) => o.id === activeId);
      if (!item) return prev;
      const toItems = prev[toColumn]!;
      const overIndex = toItems.findIndex((o) => o.id === overId);
      const nextToItems = [...toItems];
      nextToItems.splice(overIndex >= 0 ? overIndex : toItems.length, 0, { ...item, stageId: toColumn });
      return {
        ...prev,
        [fromColumn]: fromItems.filter((o) => o.id !== activeId),
        [toColumn]: nextToItems,
      };
    });
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveCard(null);
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const column = columnOf(activeId);
    if (!column) return;

    if (overId !== column && !stages.some((s) => s.id === overId)) {
      // Réordonner dans la même colonne : `over` est une autre carte.
      const items = columnsRef.current[column]!;
      const oldIndex = items.findIndex((o) => o.id === activeId);
      const newIndex = items.findIndex((o) => o.id === overId);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const reordered = [...items];
        const [moved] = reordered.splice(oldIndex, 1);
        reordered.splice(newIndex, 0, moved!);
        update((prev) => ({ ...prev, [column]: reordered }));
      }
    }

    if (!canWrite) return;

    const originalStageId = opportunities.find((o) => o.id === activeId)?.stageId;
    const finalItems = columnsRef.current[column]!;
    const targetStage = stages.find((s) => s.id === column);

    if (targetStage?.kind === "LOST" && column !== originalStageId) {
      setPendingLostMove({ opportunityId: activeId, toStageId: column, orderedIds: finalItems.map((o) => o.id) });
      return;
    }

    await commitMove(activeId, column, finalItems.map((o) => o.id), null);
  }

  async function commitMove(opportunityId: string, toStageId: string, orderedIds: string[], lostReasonId: string | null) {
    setError(null);
    const result = await moveOpportunityAction({ opportunityId, toStageId, orderedIdsInTargetStage: orderedIds, lostReasonId });
    if (!result.ok) {
      setError(result.error);
      if (dragStartSnapshot.current) update(() => dragStartSnapshot.current!);
    } else {
      router.refresh();
    }
  }

  function cancelPendingMove() {
    if (dragStartSnapshot.current) update(() => dragStartSnapshot.current!);
    setPendingLostMove(null);
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? <p className="text-sm text-danger-600">{error}</p> : null}
      <DndContext
        id="crm-board"
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => (
            <BoardColumn key={stage.id} stage={stage} items={columns[stage.id] ?? []} />
          ))}
        </div>
        <DragOverlay>{activeCard ? <OpportunityCard opportunity={activeCard} dragging /> : null}</DragOverlay>
      </DndContext>

      {pendingLostMove ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-5 shadow-lg">
            <h2 className="text-sm font-semibold text-foreground">{t("lostReasonTitle")}</h2>
            <p className="mt-1 text-xs text-foreground/70">{t("lostReasonSubtitle")}</p>
            <div className="mt-4 flex flex-col gap-2">
              {lostReasons.map((reason) => (
                <button
                  key={reason.id}
                  type="button"
                  className="rounded-md border border-border px-3 py-2 text-start text-sm hover:bg-surface-muted"
                  onClick={async () => {
                    const move = pendingLostMove;
                    setPendingLostMove(null);
                    if (move) await commitMove(move.opportunityId, move.toStageId, move.orderedIds, reason.id);
                  }}
                >
                  {reason.label}
                </button>
              ))}
              {lostReasons.length === 0 ? <p className="text-xs text-foreground/70">{t("noLostReasons")}</p> : null}
            </div>
            <div className="mt-4 flex justify-end">
              <Button type="button" variant="secondary" onClick={cancelPendingMove}>
                {t("cancel")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BoardColumn({ stage, items }: { stage: BoardStage; items: BoardOpportunity[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-lg border border-border bg-surface-muted p-2",
        isOver && "ring-2 ring-brand-400",
      )}
    >
      <div className="flex items-center justify-between px-2 py-1.5">
        <span className="text-sm font-semibold text-foreground">{stage.name}</span>
        <Badge tone="neutral">{items.length}</Badge>
      </div>
      <SortableContext items={items.map((o) => o.id)} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-16 flex-col gap-2 p-1">
          {items.map((opportunity) => (
            <SortableCard key={opportunity.id} opportunity={opportunity} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableCard({ opportunity }: { opportunity: BoardOpportunity }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: opportunity.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  return (
    <div ref={setNodeRef} style={style}>
      <OpportunityCard opportunity={opportunity} dragHandleProps={{ attributes, listeners }} />
    </div>
  );
}

function OpportunityCard({
  opportunity,
  dragging,
  dragHandleProps,
}: {
  opportunity: BoardOpportunity;
  dragging?: boolean;
  dragHandleProps?: { attributes: ReturnType<typeof useSortable>["attributes"]; listeners: ReturnType<typeof useSortable>["listeners"] };
}) {
  const t = useTranslations("admin.crm.board");
  const budget =
    opportunity.budgetMin || opportunity.budgetMax
      ? `${opportunity.budgetMin ?? "?"}–${opportunity.budgetMax ?? "?"} ${opportunity.budgetCurrency ?? ""}`
      : null;

  return (
    <div
      className={cn(
        "relative flex flex-col gap-1 rounded-md border border-border bg-surface p-3 shadow-sm hover:border-brand-300",
        dragging && "rotate-2 shadow-lg",
      )}
    >
      {dragHandleProps ? (
        <button
          type="button"
          {...dragHandleProps.attributes}
          {...dragHandleProps.listeners}
          aria-label={t("dragHandle")}
          className="absolute end-2 top-2 flex h-5 w-5 items-center justify-center rounded text-foreground/50 hover:bg-surface-muted hover:text-foreground/70"
        >
          <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true">
            <circle cx="5" cy="3" r="1.3" />
            <circle cx="11" cy="3" r="1.3" />
            <circle cx="5" cy="8" r="1.3" />
            <circle cx="11" cy="8" r="1.3" />
            <circle cx="5" cy="13" r="1.3" />
            <circle cx="11" cy="13" r="1.3" />
          </svg>
        </button>
      ) : null}
      <Link href={`/admin/crm/opportunities/${opportunity.id}`} className="flex flex-col gap-1 text-start">
        <span className="text-xs font-medium text-brand-600">{opportunity.number}</span>
        <span className="text-sm font-medium text-foreground">{opportunity.contactName}</span>
        {opportunity.companyName ? <span className="text-xs text-foreground/60">{opportunity.companyName}</span> : null}
        <span className="text-xs text-foreground/70">{opportunity.serviceName}</span>
        {budget ? <span className="text-xs text-foreground/60" dir="ltr">{budget}</span> : null}
        {opportunity.ownerName ? (
          <span className="mt-1 text-xs text-foreground/70">{t("owner", { name: opportunity.ownerName })}</span>
        ) : (
          <span className="mt-1 text-xs text-warning-600">{t("unassigned")}</span>
        )}
      </Link>
    </div>
  );
}
