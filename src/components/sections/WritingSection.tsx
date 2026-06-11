import Link from "next/link";
import type { Article } from "#site/content";
import { formatArticleDate } from "@/lib/formatArticleDate";
import { articleTitleClass, Eyebrow, Section } from "./Section";

export function WritingSection({ articles }: { articles: Article[] }) {
  return (
    <Section id="writing" title="Writing">
      <div className="grid gap-6">
        {articles.map((article) => (
          <article
            className="border-b border-line pb-6 last:border-b-0 last:pb-0"
            key={article.slug}
          >
            <Eyebrow>{formatArticleDate(article.date)}</Eyebrow>
            <h3 className={articleTitleClass}>
              <Link
                className="hover:text-accent-strong"
                href={`/${article.slug}`}
              >
                {article.title}
              </Link>
            </h3>
          </article>
        ))}
      </div>
    </Section>
  );
}
