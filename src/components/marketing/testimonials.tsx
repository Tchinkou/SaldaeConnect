import { getTranslations } from "next-intl/server";
import { prisma } from "@/server/core/db/client";
import { Card, CardContent } from "@/components/ui/card";

/** Masqué tant qu'aucun témoignage avec consentement de publication n'est saisi (§K.2). */
export async function Testimonials() {
  const testimonials = await prisma.testimonial.findMany({
    where: { isActive: true, publicationConsent: true },
    orderBy: { order: "asc" },
    take: 6,
  });

  if (testimonials.length === 0) return null;

  const t = await getTranslations("public.home.testimonials");

  return (
    <section className="border-t border-border bg-surface-muted">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-2xl font-bold tracking-tight text-foreground">
          {t("title")}
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((testimonial) => (
            <Card key={testimonial.id}>
              <CardContent className="pt-6">
                <p className="text-sm text-foreground">“{testimonial.content}”</p>
                <p className="mt-4 text-sm font-semibold text-foreground">{testimonial.authorName}</p>
                {testimonial.company ? (
                  <p className="text-xs text-ink-500">{testimonial.company}</p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
