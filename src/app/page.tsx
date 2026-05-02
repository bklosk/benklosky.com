import { articles } from "#site/content";
import { HeroSection } from "../components/sections/HeroSection";
import { NotesSection } from "../components/sections/NotesSection";
import { WorkSection } from "../components/sections/WorkSection";
import { WritingSection } from "../components/sections/WritingSection";

export const revalidate = 60;

export default async function Home() {
  const visibleArticles = articles
    .filter((article) => article.visible)
    .toSorted(
      (first, second) =>
        new Date(second.date).getTime() - new Date(first.date).getTime(),
    );

  return (
    <main className="mx-auto max-w-6xl px-[clamp(1.25rem,5vw,4rem)] pb-32 max-[560px]:px-4">
      <HeroSection />
      <WritingSection articles={visibleArticles} />
      <WorkSection />
      <NotesSection />
    </main>
  );
}
