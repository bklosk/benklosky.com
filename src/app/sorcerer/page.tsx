import type { Metadata } from "next";
import Article from "./article.mdx";
import "./sorcerer.css";

export const metadata: Metadata = {
  title: "Ideas for Sorcerer · Ben Klosky",
};

export default function SorcererPage() {
  return (
    <article className="sorcerer-page">
      <Article />
    </article>
  );
}
