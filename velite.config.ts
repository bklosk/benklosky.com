import { defineConfig, s } from "velite";

export default defineConfig({
  root: "src/content",
  output: {
    data: ".velite",
    assets: "public/static",
    base: "/static/",
    name: "[name]-[hash:6].[ext]",
    clean: true,
  },
  collections: {
    articles: {
      name: "Article",
      pattern: "articles/**/*.md",
      schema: s
        .object({
          title: s.string(),
          date: s.isodate(),
          path: s.path(),
          slug: s.slug("articles").optional(),
          visible: s.boolean().default(true),
          content: s.markdown(),
        })
        .transform((article) => ({
          title: article.title,
          date: article.date,
          slug: article.slug || article.path.replace(/^articles\//, ""),
          visible: article.visible,
          content: article.content,
        })),
    },
  },
});
