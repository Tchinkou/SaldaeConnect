import { getFormatter, getTranslations } from "next-intl/server";
import { prisma } from "@/server/core/db/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { getCurrentUser, hasPermission } from "@/server/core/authz/session";
import { Forbidden } from "@/components/admin/forbidden";
import type { BlogStatus } from "@/generated/prisma/client";

const STATUS_TONE: Record<BlogStatus, "neutral" | "brand" | "success" | "warning" | "danger" | "info"> = {
  DRAFT: "neutral",
  SCHEDULED: "info",
  PUBLISHED: "success",
  ARCHIVED: "neutral",
};

export default async function BlogListPage() {
  const currentUser = await getCurrentUser();
  if (!hasPermission(currentUser, "cms.write")) return <Forbidden />;

  const t = await getTranslations("admin.content");
  const format = await getFormatter();
  const posts = await prisma.blogPost.findMany({
    orderBy: { createdAt: "desc" },
    include: { translations: { where: { locale: "fr" } }, category: { include: { translations: { where: { locale: "fr" } } } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t("blog.title")}</h1>
          <p className="mt-1 text-sm text-foreground/70">{t("blog.subtitle")}</p>
        </div>
        <Link href="/admin/content/blog/new" className="text-sm font-medium text-brand-600 hover:underline">
          {t("new")}
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("blog.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {posts.length === 0 ? (
            <p className="text-sm text-foreground/70">{t("empty")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {posts.map((post) => (
                <li key={post.id} className="flex items-center justify-between py-3">
                  <div>
                    <Link href={`/admin/content/blog/${post.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                      {post.translations[0]?.title ?? post.id}
                    </Link>
                    <div className="mt-1 flex items-center gap-2 text-xs text-foreground/50">
                      {post.category?.translations[0]?.name ? <span>{post.category.translations[0].name}</span> : null}
                      {post.publishedAt ? <span>{format.dateTime(post.publishedAt, { dateStyle: "medium" })}</span> : null}
                    </div>
                  </div>
                  <Badge tone={STATUS_TONE[post.status]}>{t(`blog.statusValue.${post.status}`)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
