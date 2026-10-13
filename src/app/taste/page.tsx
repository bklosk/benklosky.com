import type { Metadata } from "next";
import { readJson } from "@/lib/space";
import { Ink } from "../ink";
import { EvalChart, Legend, type EvalResult } from "./eval-chart";
import { TasteSwipe } from "./taste-swipe";
import "./taste.css";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Taste swipe · Ben Klosky",
  description:
    "Swipe on films, books, or art. An interpretable model learns your taste from a few hundred LLM-answered questions and says what it learned in plain English.",
};

async function evalResult(domain: string) {
  try {
    return await readJson<EvalResult>(`taste/eval/${domain}.json`);
  } catch {
    return null;
  }
}

const fmt = (v: number) => v.toFixed(3);
const pctOf = (s: { mean: number }) => `${Math.round(100 * s.mean)}%`;

function profileSentence(p: EvalResult["profile"][string], result: EvalResult) {
  const claims = p.claims_per_user.mean.toFixed(0);
  let text =
    `At 30 swipes the profile could state ${claims} traits per user (the page shows the top ten), and ` +
    `${pctOf(p.precision!)} of them point the same way as that user\u2019s own unswiped ratings ` +
    `(${pctOf(p.strong_precision ?? p.precision!)} of the \u201cstrongly\u201d ones).`;
  text += result.prior_claims
    ? ` The prior alone would state ${result.prior_claims} trait${result.prior_claims === 1 ? "" : "s"} about everyone` +
      (result.prior_precision ? `, true for ${pctOf(result.prior_precision)} of users.` : ".")
    : " The prior alone states nothing; every claim is learned from the user\u2019s swipes.";
  return text;
}

export default async function TastePage() {
  const [movies, books] = await Promise.all([evalResult("movies"), evalResult("books")]);
  const results = [
    { title: "Movies (MovieLens)", result: movies },
    { title: "Books (Goodreads)", result: books },
  ].filter((r): r is { title: string; result: EvalResult } => r.result !== null);

  return (
    <div className="taste-page">
      <div className="intro">
        <Ink>
          <p>
            Swipe right on what you&rsquo;d want, left on what you wouldn&rsquo;t. Before you got here, an LLM answered a couple
            hundred questions about every film, book, and artwork (how slow is it, how dark, where is it set, how saturated
            are the colors), and each answer is a feature. A small Bayesian model learns how much each feature matters to
            you, picks the card that would teach it the most, and reads its weights back as plain English. It only says
            what it has actually learned, and you can correct it.
          </p>
        </Ink>
      </div>
      <TasteSwipe />
      <section className="taste-how" aria-label="How well it works">
        <h2>Does it work?</h2>
        {results.length === 0 ? (
          <p className="taste-note">The evaluation hasn&rsquo;t been run yet.</p>
        ) : (
          <>
            <p className="taste-note">
              For held-out users from the ratings datasets (never seen in training), we simulate swipes on films or books they
              rated, then score 30 of their ratings the model never saw. AUC is the chance the model ranks a random like
              above a random dislike (0.5 is chance). The baseline swaps the questions for{" "}
              {results[0].result.dense.model} embeddings of the same text, with the same model and prior.
            </p>
            <div className="taste-charts">
              {results.map((r) => (
                <EvalChart key={r.title} title={r.title} result={r.result} />
              ))}
            </div>
            <Legend />
            <ul className="taste-results">
              {results.map(({ title, result }) => {
                const at = (key: string, k: number) => result.auc[key][String(k)].mean;
                const p = result.profile["30"];
                return (
                  <li key={title}>
                    <strong>{title}.</strong> After 30 swipes, AUC {fmt(at("qa/active", 30))} with picked cards vs{" "}
                    {fmt(at("qa/random", 30))} random; embeddings {fmt(at("dense/active", 30))}; popularity alone{" "}
                    {fmt(result.popularity_auc.mean)}.{" "}
                    {p?.precision && <>{profileSentence(p, result)}</>}
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <p className="taste-note">
          Art has no public ratings dataset, so it isn&rsquo;t evaluated, and its model starts from a plain prior instead of one
          learned from other people. Its first swipes teach it less than they do for films and books.
        </p>
      </section>
      <footer className="taste-credits">
        Films: <a href="https://grouplens.org/datasets/movielens/">MovieLens 32M</a> (GroupLens), metadata from{" "}
        <a href="https://www.wikidata.org/">Wikidata</a> and <a href="https://en.wikipedia.org/">Wikipedia</a>. Books:{" "}
        <a href="https://mengtingwan.github.io/data/goodreads">UCSD Book Graph</a> (Wan &amp; McAuley, 2018), covers from{" "}
        <a href="https://openlibrary.org/">Open Library</a>. Art: <a href="https://www.artic.edu/open-access">Art Institute of Chicago</a>{" "}
        public-domain collection (CC0). Questions answered by the OpenAI Decisions API.
      </footer>
    </div>
  );
}
