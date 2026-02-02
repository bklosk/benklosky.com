import ClientPage from "@/components/ClientPage";
import { getArticles } from "@/lib/articles";

export default function Home() {
  const articles = getArticles();

  return <ClientPage articles={articles} />;
}
