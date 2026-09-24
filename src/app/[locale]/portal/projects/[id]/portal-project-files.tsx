"use client";

import { useRef, useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { uploadPortalProjectFileAction } from "@/server/core/projects/file-actions";

export type PortalProjectFileRow = {
  id: string;
  originalName: string;
  sizeBytes: string;
  createdAt: string;
};

function formatBytes(bytes: string): string {
  const n = Number(bytes);
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

export function PortalProjectFiles({ projectId, files }: { projectId: string; files: PortalProjectFileRow[] }) {
  const t = useTranslations("portal.projects.detail.file");
  const format = useFormatter();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
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
              <a href={`/api/files/${file.id}`} className="font-medium text-brand-600 hover:underline">
                {file.originalName}
              </a>
              <div className="flex items-center gap-2 text-xs text-foreground/70">
                <span>{formatBytes(file.sizeBytes)}</span>
                <span>{format.dateTime(new Date(file.createdAt), { dateStyle: "medium" })}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form
        className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const files = fileInputRef.current?.files;
          if (!files || files.length === 0) return;
          setSubmitting(true);
          setError(null);
          const result = await uploadPortalProjectFileAction({ projectId, files: Array.from(files) });
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
        <Button type="submit" size="sm" isLoading={submitting}>
          {t("add")}
        </Button>
        {error ? <p className="w-full text-xs text-danger-600">{error}</p> : null}
      </form>
    </div>
  );
}
