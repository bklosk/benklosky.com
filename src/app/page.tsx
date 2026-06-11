import { articles } from "#site/content";
import { Footer } from "@/components/Footer";
import { Bio } from "@/components/sections/Bio";
import { HeroSection } from "@/components/sections/HeroSection";
import { WritingSection } from "@/components/sections/WritingSection";

export const revalidate = 60;

export default function Home() {
  const visibleArticles = articles
    .filter((article) => article.visible)
    .toSorted(
      (first, second) =>
        new Date(second.date).getTime() - new Date(first.date).getTime(),
    );

  return (
    <main className="mx-auto max-w-5xl px-5 sm:px-8 lg:px-12">
      <HeroSection />
      {visibleArticles.length > 0 && (
        <WritingSection articles={visibleArticles} />
      )}
      <Bio />
      <Footer />
    </main>
  );
}
