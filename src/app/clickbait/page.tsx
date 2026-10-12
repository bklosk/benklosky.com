import type { Metadata } from "next";
import { Ink } from "../ink";
import { ClickbaitTrainer } from "./clickbait-trainer";
import "./clickbait.css";

export const metadata: Metadata = {
  title: "Clickbait RLHF · Ben Klosky",
  description:
    "Teach a tiny news-headline GPT to write clickbait. Every A/B pick is a DPO step that runs on your own GPU, in your browser.",
};

export default function ClickbaitPage() {
  return (
    <div className="clickbait-page">
      <div className="intro">
        <Ink>
          <p>
            This is a 4-million-parameter GPT pretrained on a million boring ABC News headlines. Your browser just
            downloaded its 4 MB of weights, and it&rsquo;s running on your GPU. Pick the more clickbaity headline;
            each pick is a DPO step that fine-tunes your own copy. Nobody else&rsquo;s clicks touch it, and a reload
            starts you over.
          </p>
        </Ink>
      </div>
      <ClickbaitTrainer />
    </div>
  );
}
