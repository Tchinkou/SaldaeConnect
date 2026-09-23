import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/server/core/db/client";
import { getCurrentUser, hasPermission } from "@/server/core/authz/session";
import { Forbidden } from "@/components/admin/forbidden";
import { TestimonialForm } from "@/app/[locale]/admin/content/testimonials/testimonial-form";

export default async function TestimonialEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const currentUser = await getCurrentUser();
  if (!hasPermission(currentUser, "cms.write")) return <Forbidden />;

  const { id } = await params;
  const t = await getTranslations("admin.content");
  const isNew = id === "new";

  if (isNew) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-xl font-semibold text-foreground">{t("testimonials.new")}</h1>
        <TestimonialForm
          id={null}
          initial={{
            authorName: "",
            company: "",
            jobTitle: "",
            content: "",
            rating: null,
            publicationConsent: false,
            isActive: false,
            order: 0,
          }}
        />
      </div>
    );
  }

  const testimonial = await prisma.testimonial.findUnique({ where: { id } });
  if (!testimonial) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">{t("testimonials.edit")}</h1>
      <TestimonialForm
        id={testimonial.id}
        initial={{
          authorName: testimonial.authorName,
          company: testimonial.company ?? "",
          jobTitle: testimonial.jobTitle ?? "",
          content: testimonial.content,
          rating: testimonial.rating,
          publicationConsent: testimonial.publicationConsent,
          isActive: testimonial.isActive,
          order: testimonial.order,
        }}
      />
    </div>
  );
}
