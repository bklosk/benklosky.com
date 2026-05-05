import { articles } from "#site/content";
import { HoverCircleText } from "@/components/HoverCircleText";
import { formatArticleDate } from "@/lib/formatArticleDate";
import Link from "next/link";
import { notFound } from "next/navigation";

type ArticlePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return articles
    .filter((article) => article.visible)
    .map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = articles.find((item) => item.visible && item.slug === slug);

  if (!article) {
    return {};
  }

  return {
    title: `${article.title} | Ben Klosky`,
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = articles.find((item) => item.visible && item.slug === slug);

  if (!article) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-4xl px-[clamp(1.25rem,5vw,4rem)] py-[clamp(2rem,7vw,5rem)] max-[560px]:px-4">
      <Link
        className="text-sm text-muted hover:text-accent-strong"
        href="/#writing"
      >
        Back to homepage
      </Link>

      <article className="mt-12">
        <p className="m-0 text-[0.72rem] leading-[1.2] tracking-[0.03em] text-muted">
          {formatArticleDate(article.date)}
        </p>
        <h1
          className="mb-8 mt-3 font-serif text-[clamp(2.4rem,8vw,5rem)] font-normal leading-[0.92] tracking-[-0.055em]"
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
