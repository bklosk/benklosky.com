import Link from "next/link";
import type { Article } from "#site/content";
import { formatArticleDate } from "@/lib/formatArticleDate";
import { articleTitleClass, Eyebrow, Section } from "./Section";

const articleRowClass =
  "border-b border-line pb-[clamp(1rem,3vw,1.65rem)] last:border-b-0";

export function WritingSection({ articles }: { articles: Article[] }) {
  return (
    <Section id="writing" title="Writing">
      <div className="grid gap-[clamp(1rem,3vw,1.65rem)]">
        {articles.length > 0 ? (
          articles.map((article) => (
            <article className={articleRowClass} key={article.slug}>
              <div>
                <Eyebrow>{formatArticleDate(article.date)}</Eyebrow>
                <h2 className={articleTitleClass}>
                  <Link className="hover:text-accent" href={`/${article.slug}`}>
                    {article.title}
                  </Link>
                </h2>
              </div>
            </article>
          ))
        ) : (
          <p className="m-0 rounded-lg border border-line p-[clamp(1.1rem,3vw,1.6rem)] text-muted">
            Add Markdown files to src/content/articles to show writing here.
          </p>
        )}
      </div>
    </Section>
  );
}
