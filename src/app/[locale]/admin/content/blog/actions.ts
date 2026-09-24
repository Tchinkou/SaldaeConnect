"use server";
import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { defineAction } from "@/server/core/action";
import { prisma } from "@/server/core/db/client";
import { AppError, ValidationError } from "@/server/core/errors";

const blockSchema = z.object({
  type: z.enum(["heading", "paragraph"]),
  text: z.string().trim().min(1).max(4000),
});

const translationSchema = z.object({
  title: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Le slug ne peut contenir que des lettres minuscules, chiffres et tirets."),
  excerpt: z.string().trim().max(400).nullable(),
  content: z.array(blockSchema),
  seoTitle: z.string().trim().max(160).nullable(),
  seoDescription: z.string().trim().max(320).nullable(),
});

const upsertSchema = z.object({
  id: z.string().nullable(),
  categoryName: z.string().trim().max(80).nullable(),
  tagNames: z.array(z.string().trim().min(1).max(40)),
  status: z.enum(["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"]),
  publishedAt: z.string().datetime().nullable(),
  translations: z.object({ fr: translationSchema, en: translationSchema, ar: translationSchema }),
});

/**
 * Article de blog (§30) — catégorie et tags créés à la volée par nom (pas
 * d'écran de gestion séparé, comme les technologies du portfolio) : la
 * complexité d'un référentiel dédié n'est pas justifiée pour un mini-CMS.
 */
export const upsertBlogPostAction = defineAction({
  permission: "cms.write",
  schema: upsertSchema,
  handler: async (input, { user }) => {
    try {
      return await prisma.$transaction(async (tx) => {
        let category = null;
        if (input.categoryName) {
          const existingTranslation = await tx.blogCategoryTranslation.findFirst({
            where: { locale: "fr", name: input.categoryName },
          });
          category = existingTranslation
            ? await tx.blogCategory.findUnique({ where: { id: existingTranslation.parentId } })
            : await tx.blogCategory.create({
                data: {
                  translations: {
                    create: (["fr", "en", "ar"] as const).map((locale) => ({
                      locale,
                      name: input.categoryName!,
                      slug: slugify(input.categoryName!),
                    })),
                  },
                },
              });
        }

        const tags = await Promise.all(
          input.tagNames.map((name) => tx.blogTag.upsert({ where: { name }, update: {}, create: { name } })),
        );

        let post = input.id ? await tx.blogPost.findUnique({ where: { id: input.id } }) : null;
        if (input.id && !post) throw new ValidationError("Article introuvable.");

        const base = {
          categoryId: category?.id ?? null,
          status: input.status,
          publishedAt: input.status === "PUBLISHED" ? (input.publishedAt ? new Date(input.publishedAt) : new Date()) : null,
        };

        post = post
          ? await tx.blogPost.update({ where: { id: post.id }, data: { ...base, tags: { set: tags.map((tag) => ({ id: tag.id })) } } })
          : await tx.blogPost.create({ data: { ...base, authorId: user.user.id, tags: { connect: tags.map((tag) => ({ id: tag.id })) } } });

        await Promise.all(
          (["fr", "en", "ar"] as const).map((locale) =>
            tx.blogPostTranslation.upsert({
              where: { parentId_locale: { parentId: post!.id, locale } },
              update: input.translations[locale],
              create: { parentId: post!.id, locale, ...input.translations[locale] },
            }),
          ),
        );

        return { id: post.id };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new AppError("Ce slug est déjà utilisé par un autre article dans cette langue.");
      }
      throw error;
    }
  },
  audit: {
    category: "BUSINESS",
    action: "blog_post.update",
    entityType: "blog_post",
    entityId: (_input, output) => output.id,
    entityLabel: (input) => input.translations.fr.title,
  },
});

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
