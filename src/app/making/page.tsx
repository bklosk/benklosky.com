import type { Metadata } from "next";
import Article from "./article.mdx";
import "./making.css";

export const metadata: Metadata = {
  title: "Making · Ben Klosky",
};

export default function MakingPage() {
  return (
    <article className="making-page">
      <Article />
    </article>
  );
}
