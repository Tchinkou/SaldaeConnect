"use client";

import { useRef, useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { uploadProjectFileAction, deleteProjectFileAction } from "@/server/core/projects/file-actions";

export type ProjectFileRow = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: string;
  category: "BRIEF" | "LOGO" | "DOCUMENT" | "DELIVERABLE" | "QUOTE_PDF" | "INVOICE_PDF" | "MEDIA" | "ATTACHMENT";
  visibility: "INTERNAL" | "CLIENT" | "PUBLIC";
  createdAt: string;
  uploaderName: string | null;
};

const CATEGORY_TONE = { DELIVERABLE: "success", DOCUMENT: "info", MEDIA: "neutral", ATTACHMENT: "neutral" } as const;

function formatBytes(bytes: string): string {
  const n = Number(bytes);
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

export function ProjectFiles({ projectId, files, canWrite }: { projectId: string; files: ProjectFileRow[]; canWrite: boolean }) {
  const t = useTranslations("admin.projects.detail.file");
  const format = useFormatter();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<"DOCUMENT" | "DELIVERABLE" | "MEDIA" | "ATTACHMENT">("DOCUMENT");
  const [visibility, setVisibility] = useState<"INTERNAL" | "CLIENT">("INTERNAL");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      {files.length === 0 ? (
        <p className="text-sm text-foreground/70">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {files.map((file) => (
            <li key={file.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="flex-1">
                <a href={`/api/files/${file.id}`} className="font-medium text-brand-600 hover:underline">
                  {file.originalName}
                </a>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-foreground/70">
                  <Badge tone={CATEGORY_TONE[file.category as keyof typeof CATEGORY_TONE] ?? "neutral"}>{t(`category.${file.category}`)}</Badge>
                  {file.visibility === "CLIENT" ? <Badge tone="info">{t("visibleToClient")}</Badge> : null}
                  <span>{formatBytes(file.sizeBytes)}</span>
                  <span>{format.dateTime(new Date(file.createdAt), { dateStyle: "medium" })}</span>
                  {file.uploaderName ? <span>{t("uploadedBy", { name: file.uploaderName })}</span> : null}
                </div>
              </div>
              {canWrite ? (
                <button
                  type="button"
                  onClick={async () => {
                    await deleteProjectFileAction({ fileId: file.id });
                    router.refresh();
                  }}
                  className="text-xs font-medium text-danger-600 hover:underline"
                >
                  {t("remove")}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canWrite ? (
        <form
          className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3"
          onSubmit={async (event) => {
            event.preventDefault();
            const files = fileInputRef.current?.files;
            if (!files || files.length === 0) return;
            setSubmitting(true);
            setError(null);
            const result = await uploadProjectFileAction({ projectId, files: Array.from(files), category, visibility });
            setSubmitting(false);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            if (fileInputRef.current) fileInputRef.current.value = "";
            router.refresh();
          }}
        >
          <input ref={fileInputRef} type="file" multiple required className="text-xs" />
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as typeof category)}
            className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
          >
            {(["DOCUMENT", "DELIVERABLE", "MEDIA", "ATTACHMENT"] as const).map((option) => (
              <option key={option} value={option}>
                {t(`category.${option}`)}
              </option>
            ))}
          </select>
          <select
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as typeof visibility)}
            className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
          >
            <option value="INTERNAL">{t("visibility.INTERNAL")}</option>
            <option value="CLIENT">{t("visibility.CLIENT")}</option>
          </select>
          <Button type="submit" size="sm" isLoading={submitting}>
            {t("add")}
          </Button>
          {error ? <p className="w-full text-xs text-danger-600">{error}</p> : null}
        </form>
      ) : null}
    </div>
  );
}
