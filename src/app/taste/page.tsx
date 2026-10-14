import type { Metadata } from "next";
import { Ink } from "../ink";
import { TasteSwipe } from "./taste-swipe";
import "./taste.css";

export const metadata: Metadata = {
  title: "Taste by Ben Klosky",
  description:
    "Swipe on films, books, or art. An interpretable model learns your taste from a few hundred LLM-answered questions and says what it learned in plain English.",
};

export default function TastePage() {
  return (
    <div className="taste-page">
      <div className="intro">
        <Ink>
          <p>
What if recommendation algorithms could explain their predictions? <br /><br />
            
            I used the OpenAI decisions API to generate hundreds of questions about each item. 
A local bayesian model tries to predict your location in question-space as you swipe! </p>
        </Ink>
      </div>
      <TasteSwipe />
    </div>
  );
}
