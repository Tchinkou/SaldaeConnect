"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { globalSearchAction, type SearchResult } from "@/app/[locale]/admin/search-actions";

export function GlobalSearch() {
  const t = useTranslations("admin.search");
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function close() {
    setIsOpen(false);
    setQuery("");
    setResults([]);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsOpen(true);
      }
      if (event.key === "Escape") close();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const timeout = setTimeout(() => {
      setIsLoading(true);
      globalSearchAction(query).then((found) => {
        setResults(found);
        setIsLoading(false);
      });
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  const visibleResults = query.trim().length < 2 ? [] : results;

  function go(href: string) {
    close();
    router.push(href as Parameters<typeof router.push>[0]);
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground/60 hover:text-foreground"
      >
        <span>{t("placeholder")}</span>
        <kbd className="rounded border border-border px-1.5 py-0.5 text-xs" dir="ltr">
          ⌘K
        </kbd>
      </button>
    );
  }

  const grouped = visibleResults.reduce<Record<string, SearchResult[]>>((acc, result) => {
    (acc[result.category] ??= []).push(result);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24" onClick={close}>
      <div
        className="w-full max-w-lg rounded-lg border border-border bg-surface shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("placeholder")}
          className="w-full border-b border-border bg-transparent px-4 py-3 text-sm outline-none"
        />
        <div className="max-h-96 overflow-y-auto p-2">
          {isLoading ? <p className="px-2 py-2 text-sm text-foreground/50">{t("loading")}</p> : null}
          {!isLoading && query.trim().length >= 2 && visibleResults.length === 0 ? (
            <p className="px-2 py-2 text-sm text-foreground/50">{t("empty")}</p>
          ) : null}
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="mb-2">
              <p className="px-2 py-1 text-xs font-medium uppercase text-foreground/40">{t(`categories.${category}`)}</p>
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => go(item.href)}
                  className="flex w-full flex-col items-start rounded-md px-2 py-2 text-start text-sm hover:bg-surface-subtle"
                >
                  <span className="text-foreground">{item.label}</span>
                  {item.sublabel ? <span className="text-xs text-foreground/50">{item.sublabel}</span> : null}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
