import { getTranslations } from "next-intl/server";
import { prisma } from "@/server/core/db/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { getCurrentUser, hasPermission } from "@/server/core/authz/session";
import { Forbidden } from "@/components/admin/forbidden";

export default async function TestimonialsPage() {
  const currentUser = await getCurrentUser();
  if (!hasPermission(currentUser, "cms.write")) return <Forbidden />;

  const t = await getTranslations("admin.content");
  const testimonials = await prisma.testimonial.findMany({ orderBy: { order: "asc" } });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t("testimonials.title")}</h1>
          <p className="mt-1 text-sm text-foreground/70">{t("testimonials.subtitle")}</p>
        </div>
        <Link href="/admin/content/testimonials/new" className="text-sm font-medium text-brand-600 hover:underline">
          {t("new")}
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("testimonials.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {testimonials.length === 0 ? (
            <p className="text-sm text-foreground/70">{t("empty")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {testimonials.map((testimonial) => (
                <li key={testimonial.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {testimonial.authorName}
                      {testimonial.company ? ` — ${testimonial.company}` : ""}
                    </p>
                    <div className="mt-1 flex gap-2">
                      <Badge tone={testimonial.isActive ? "success" : "neutral"}>
                        {t(testimonial.isActive ? "active" : "inactive")}
                      </Badge>
                      {!testimonial.publicationConsent ? (
                        <Badge tone="warning">{t("testimonials.noConsent")}</Badge>
                      ) : null}
                    </div>
                  </div>
                  <Link
                    href={`/admin/content/testimonials/${testimonial.id}`}
                    className="text-sm font-medium text-brand-600 hover:underline"
                  >
                    {t("edit")}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
