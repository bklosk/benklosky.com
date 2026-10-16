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
What if recommendation algorithms were purely interpretable? <br /><br />
            
            I used the OpenAI decisions API to generate a few hundred of questions about each movie/book/painting. 
A local model tries to predict your preference for each of those questions from your answers. </p>
        </Ink>
      </div>
      <TasteSwipe />
    </div>
  );
}
