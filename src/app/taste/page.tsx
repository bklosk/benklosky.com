import type { Metadata } from "next";
import { Ink } from "../ink";
import { TasteSwipe } from "./taste-swipe";
import "./taste.css";

export const metadata: Metadata = {
  title: "Taste swipe · Ben Klosky",
  description:
    "Swipe on films, books, or art. An interpretable model learns your taste from a few hundred LLM-answered questions and says what it learned in plain English.",
};

export default function TastePage() {
  return (
    <div className="taste-page">
      <div className="intro">
        <Ink>
          <p>
What if you could understand Netflix's recommendation algorithm?
            
            I used the OpenAI decisions API to generate human-readable embeddings for every movie in the dataset, and a small bayesian model tries to predict your preferences across those vectors. </p>
        </Ink>
      </div>
      <TasteSwipe />
    </div>
  );
}
