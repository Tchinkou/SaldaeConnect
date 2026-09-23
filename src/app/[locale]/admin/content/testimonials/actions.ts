"use server";
import "server-only";
import { z } from "zod";
import { defineAction } from "@/server/core/action";
import { prisma } from "@/server/core/db/client";

const schema = z.object({
  id: z.string().nullable(),
  authorName: z.string().trim().min(1).max(160),
  company: z.string().trim().max(160).nullable(),
  jobTitle: z.string().trim().max(160).nullable(),
  content: z.string().trim().min(1).max(2000),
  rating: z.coerce.number().int().min(1).max(5).nullable(),
  publicationConsent: z.boolean(),
  isActive: z.boolean(),
  order: z.coerce.number().int().min(0),
});

export const upsertTestimonialAction = defineAction({
  permission: "cms.write",
  schema,
  handler: async (input) => {
    const data = {
      authorName: input.authorName,
      company: input.company,
      jobTitle: input.jobTitle,
      content: input.content,
      rating: input.rating,
      publicationConsent: input.publicationConsent,
      publicationConsentAt: input.publicationConsent ? new Date() : null,
      isActive: input.isActive,
      order: input.order,
    };

    const testimonial = input.id
      ? await prisma.testimonial.update({ where: { id: input.id }, data })
      : await prisma.testimonial.create({ data });

    return { id: testimonial.id };
  },
  audit: {
    category: "BUSINESS",
    action: "testimonial.update",
    entityType: "testimonial",
    entityId: (_input, output) => output.id,
    entityLabel: (input) => input.authorName,
  },
});
