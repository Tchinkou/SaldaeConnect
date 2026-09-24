"use client";

/**
 * Rendu d'une question de `RequestForm.schema` (§C : questionnaire
 * administrable par service). Limité aux types de champ de base ; les
 * `conditions` du schéma ne sont pas encore évaluées (aucune n'est créée
 * pour l'instant, faute d'éditeur admin — voir le rapport de phase).
 */
export interface QuestionField {
  key: string;
  type: "text" | "textarea" | "select" | "radio" | "checkbox";
  label: Partial<Record<"fr" | "en" | "ar", string>>;
  options?: Array<{ value: string; label: Partial<Record<"fr" | "en" | "ar", string>> }>;
  required?: boolean;
}

export function DynamicQuestion({
  field,
  locale,
  value,
  onChange,
}: {
  field: QuestionField;
  locale: "fr" | "en" | "ar";
  value: string | boolean | undefined;
  onChange: (value: string | boolean) => void;
}) {
  const label = field.label[locale] ?? field.label.fr ?? field.key;

  if (field.type === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
          required={field.required}
          className="h-4 w-4 rounded border-border"
        />
        {label}
      </label>
    );
  }

  if (field.type === "textarea") {
    return (
      <div>
        <label htmlFor={field.key} className="block text-sm font-medium text-foreground">
          {label}
        </label>
        <textarea
          id={field.key}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          required={field.required}
          rows={4}
          className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
        />
      </div>
    );
  }

  if ((field.type === "select" || field.type === "radio") && field.options) {
    if (field.type === "select") {
      return (
        <div>
          <label htmlFor={field.key} className="block text-sm font-medium text-foreground">
            {label}
          </label>
          <select
            id={field.key}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => onChange(event.target.value)}
            required={field.required}
            className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          >
            <option value="" disabled>
              —
            </option>
            {field.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label[locale] ?? option.label.fr ?? option.value}
              </option>
            ))}
          </select>
        </div>
      );
    }
    return (
      <fieldset>
        <legend className="text-sm font-medium text-foreground">{label}</legend>
        <div className="mt-2 space-y-2">
          {field.options.map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="radio"
                name={field.key}
                value={option.value}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
                required={field.required}
                className="h-4 w-4 border-border"
              />
              {option.label[locale] ?? option.label.fr ?? option.value}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  return (
    <div>
      <label htmlFor={field.key} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={field.key}
        type="text"
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        required={field.required}
        className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
      />
    </div>
  );
}
