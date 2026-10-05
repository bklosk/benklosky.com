import type { Metadata } from "next";
import { ShippedChart } from "./chart";
import { loadWordSeries } from "./load";
import { monthDate, partialMonth } from "./months";
import "./shipped.css";

export const metadata: Metadata = {
  title: "Shipped · Ben Klosky",
  description: "How often Hacker News comments and story titles contain ship, shipped, and shipping, beside a set of control words.",
};

function monthLabel(month: string) {
  return monthDate(month).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default async function ShippedPage() {
  const series = await loadWordSeries();
  const comments = series.find((entry) => entry.source === "comment");
  const first = comments?.months[0];
  const last = comments?.months[comments.months.length - 1];
  const partial = comments ? partialMonth(comments.months, comments.items) : null;

  return (
    <article className="shipped-page">
      <h1>Shipped</h1>
      <p>
        How often Hacker News uses the words around shipping, and a set of control words, each month. A comment or
        story title counts once when the word appears. Whole-word matches keep shipped, shipping, ships, and ship
        separate.
      </p>
      <ShippedChart series={series} />
      <p className="shipped-note">
        Counts from the{" "}
        <a href="https://huggingface.co/datasets/open-index/hacker-news">open-index Hacker News archive</a>
        {first && last ? `, ${monthLabel(first)} through ${monthLabel(last)}` : ""}. Titles are story titles. A month
        appears once it has at least 100 posts.
        {partial ? ` ${monthLabel(partial)} is a partial month in this snapshot.` : ""}
      </p>
    </article>
  );
}
