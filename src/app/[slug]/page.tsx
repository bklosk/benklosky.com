import Link from "next/link";
import { notFound } from "next/navigation";
import { articles } from "#site/content";
import { HoverCircleText } from "@/components/HoverCircleText";
import { Eyebrow } from "@/components/sections/Section";
import { formatArticleDate } from "@/lib/formatArticleDate";

type ArticlePageProps = {
  params: Promise<{ slug: string }>;
};

function findArticle(slug: string) {
  return articles.find((article) => article.visible && article.slug === slug);
}

export function generateStaticParams() {
  return articles
    .filter((article) => article.visible)
    .map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = findArticle(slug);

  if (!article) {
    return {};
  }

  return {
    title: `${article.title} | Ben Klosky`,
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = findArticle(slug);

  if (!article) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8 md:py-20">
      <Link
        className="text-sm text-muted transition-colors hover:text-accent-strong"
        href="/#writing"
      >
        ← Back to homepage
      </Link>

      <article className="mt-10 md:mt-14">
        <Eyebrow>{formatArticleDate(article.date)}</Eyebrow>
        <h1
          className="mb-8 mt-3 font-serif text-4xl font-normal leading-[1.02] tracking-[-0.04em] md:text-6xl"
          aria-label={article.title}
        >
          <HoverCircleText>{article.title}</HoverCircleText>
        </h1>
        <div
          className="article-content"
          dangerouslySetInnerHTML={{ __html: article.content }}
        />
      </article>
    </main>
  );
}
