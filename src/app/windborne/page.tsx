import type { Metadata } from "next";
import Article from "./article.mdx";
import "./windborne.css";

export const metadata: Metadata = {
  title: "A winning Semantle strategy · Ben Klosky",
};

export default function WindbornePage() {
  return (
    <article className="windborne-page">
      <Article />
    </article>
  );
}
