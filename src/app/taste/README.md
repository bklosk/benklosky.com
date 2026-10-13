# /taste

Swipe on films, books, or art. The page learns your taste, says what it
learned in plain English, and lets you correct it.

## Approach: QA embeddings

1. **Question bank.** Each domain has ~220 questions about items
   (`scripts/taste/questions/*.json`): 229 for films, 230 for books, 220 for
   art. Only *score* questions (ordered levels: "How fast is the pacing?")
   and *choice* questions (one of a fixed set: "Where is it mainly set?").
   There are no yes/no predicates. Each question carries the English the
   profile uses to talk about it ("slow, contemplative films" / "fast-paced
   films"). Two book questions (author gender, political lean) are marked
   `hidden`. They feed the model but are never shown: not as traits, "not
   sure yet", card or recommendation reasons, or in the trait picker. A test
   (`model.test.ts`) checks this. They barely matter: books' validation
   log-likelihood moved from −0.53153 to −0.53155.
2. **Answers.** The OpenAI Decisions API answers every question for every
   item: 1500 films, 1500 books, and 985 artworks, which it reads from the
   image. It returns a probability for each option. A score becomes one
   feature (its expected level, 0–1); a choice becomes one feature per option.
   Features that barely vary are dropped, leaving 656 / 710 / 649.
3. **Model.** Bayesian logistic regression on the standardized features. A
   swipe right is a like. The weights' prior, N(μ, UUᵀ + diag d), is learned by
   EM from 4000 training users per domain (MovieLens, Goodreads), so the
   population's taste correlations do most of the work early on. The rank of U
   is picked on validation users. Art has no ratings dataset, so it starts from
   an independent prior. Inference is a Laplace approximation in observation
   space, so the browser refits on every swipe in a few milliseconds
   (`model.ts`, a line-for-line port of `scripts/taste/model.py`, checked by
   `model.test.ts`).
4. **Readout.** A trait is t_j = (C w)_j, where C is the catalog correlation
   matrix of the features. It is the slope of the model's own scores against
   question j across the whole catalog: "films one sd slower score this much
   higher for you". It is linear in w, so its posterior mean and sd are exact.
   The profile states a trait only when its 90% interval excludes zero and it
   passes a size threshold set from validation users. Traits the population
   prior would claim for anyone are tagged "like most people". Correlated traits
   are deduplicated. "Not sure yet" lists the traits with the widest posterior.
5. **Edits.** Setting a trait adds a Gaussian observation of that same t_j
   (sd 0.05). The edit moves correlated traits and recommendations through
   the learned prior, and the profile then reads it back like any other trait.
6. **Next card.** The unseen item with the highest BALD score (mutual
   information between the swipe and the weights). "Why this card" splits
   that item's predictive variance exactly into per-feature parts, xⱼ(Sx)ⱼ, and
   names the largest. Recommendation reasons split the item's score the same
   way (xⱼmⱼ).
7. **Letterboxd.** On the Movies tab you can load a `ratings.csv` export. It is
   parsed in the browser and matched to the catalog by title and year: 3.5★
   and up is a like, 2.5★ and down a dislike. Nothing is uploaded. Letterboxd is
   never scraped.

## Provider and cost

The pilot (25 items per domain) compared answers against facts the model
didn't produce:

- **Films:** release era 25/25; genre scores against MovieLens tags, AUC 0.86–1.0.
- **Books:** publication era 25/25.
- **Art:** era 23/25; medium against museum records, AUC 1.0; saturation
  against AIC's own image-derived colorfulness score, Spearman 0.87. That last
  check shows the model reads the image.

Provider options considered:

- **Decisions API (chosen):** $0.10 per 1M input tokens and no output charge.
  It returns calibrated per-option probabilities and takes images.
- **TypeSafe Jev:** cheaper ($0.042/M) but text-only. It was not run (no key),
  and it would have saved at most ~$5 on films and books.
- **Responses API with prompt caching:** could be cheaper, since the question
  bank is a repeated prefix, but it would need logprobs, which `gpt-6-luna`
  doesn't document.

Actual spend for everything, including the pilot: **$15.38**.

| | Requests | Input tokens | Cost |
|---|---|---|---|
| Films | 5,997 | 56.5M | $5.65 |
| Books | 7,500 | 60.4M | $6.04 |
| Art (with images) | 3,940 | 36.1M | $3.61 |
| Embeddings (baseline) | 48 | 0.7M | $0.09 |

About 37k tokens per item, almost all of it the question definitions, which
are billed again for every item. Three film requests failed (HTTP 403) and
weren't retried. Their 0.05% of answers are filled with the question's
catalog average.

## Evaluation

`scripts/taste/eval.py`, 800 held-out users per domain, none of them seen in
training:

- **Setup.** Each user keeps 30 ratings hidden. Swipes are simulated on up to
  200 of their other ratings, and the model then scores the hidden 30.
- **Metric.** AUC on the hidden 30. 0.5 is chance. The standard error per
  cell is about ±0.005.
- **Dense baseline.** It swaps the questions for `text-embedding-3-large`
  embeddings of the same item text, PCA'd to the same number of dimensions,
  with the same prior learning and card selection.

**Films (MovieLens 32M)**

| swipes | 0 | 5 | 10 | 20 | 30 | 50 |
|---|---|---|---|---|---|---|
| QA, picked cards (the demo) | 0.681 | 0.695 | 0.705 | 0.717 | **0.726** | **0.734** |
| QA, random cards | 0.681 | 0.688 | 0.697 | 0.713 | 0.720 | 0.731 |
| Embeddings, picked cards | 0.682 | 0.700 | 0.708 | 0.718 | 0.723 | 0.732 |
| Embeddings, random cards | 0.682 | 0.689 | 0.698 | 0.712 | 0.720 | 0.731 |
| Popularity (no personalization) | 0.694 | | | | | |

**Books (Goodreads)**

| swipes | 0 | 5 | 10 | 20 | 30 | 50 |
|---|---|---|---|---|---|---|
| QA, picked cards (the demo) | 0.644 | 0.678 | 0.689 | 0.702 | **0.713** | **0.721** |
| QA, random cards | 0.644 | 0.668 | 0.677 | 0.688 | 0.698 | 0.716 |
| Embeddings, picked cards | 0.649 | 0.675 | 0.687 | 0.697 | 0.701 | 0.707 |
| Embeddings, random cards | 0.649 | 0.658 | 0.667 | 0.675 | 0.685 | 0.700 |
| Popularity (no personalization) | 0.671 | | | | | |

What this says:

- **Picking cards helps.** BALD beats random cards at every point. For books it
  is worth about 10 swipes: 30 picked swipes ≈ 0.713, which random cards only
  reach somewhere between 40 and 50. For films the gain is small (+0.006 at 30), about one
  standard error.
- **QA features match or beat dense embeddings.** For books they are clearly
  better (0.713 vs 0.701 at 30; 0.721 vs 0.707 at 50). For films they are a
  wash, with QA ahead on log loss at every k (0.543 vs 0.547 at 30) but level
  on AUC.
- **Zero swipes is worse than popularity.** With no swipes, the population
  prior ranks items worse than their raw like rate (films 0.681 vs 0.694;
  books 0.644 vs 0.671). It passes popularity after about 5 swipes.
- **Absolute numbers are modest.** Ranking someone's next rating at ~0.72
  AUC from 30 swipes is useful, not magic.

**Is the profile true?** This is checked without trusting the model. After
30 picked swipes, each trait the readout would state is compared with the
user's own unswiped ratings: did they like items higher on that feature more
than they disliked them?

| | traits it could state per user* | direction matches user's other ratings | for "strongly" traits |
|---|---|---|---|
| Films, 20 swipes | 40 | 90% | 94% |
| Films, 30 swipes | 51 | 90% | 94% |
| Books, 20 swipes | 9 | 83% | 88% |
| Books, 30 swipes | 14 | 82% | 86% |

\* Before deduplication; the page shows at most ten.

- **Almost all of these are personal.** The population prior alone would
  state one trait about films for everyone (true for 91% of users) and none
  about books.
- **The book claims are less reliable.** About one in five book traits points
  the wrong way.
- **The gap between the two columns matters.** "Strongly" claims are more
  reliable, so the strength words carry real information.

## Limitations

- **Popularity.** With no swipes the model ranks films worse than plain
  popularity, because the features don't fully capture each film's overall
  likeability. An item-level popularity term would fix that, but it would
  be a feature with no question behind it, so it was left out.
- **Accuracy.** QA features beat dense embeddings on books but only tie them on
  films. The win you can count on is the readout, not accuracy.
- **Proxies.** Traits describe what the model predicts, which includes proxies.
  A fantasy reader who dislikes romance may be told they avoid books with female
  protagonists, because the two correlate in Goodreads ratings. The statement
  is true of the model, not a claim about cause.
- **Phrasing.** The English comes from the question bank and is sometimes
  stiff ("you steer clear of films without awards attention").
- **Confident answers.** The answerer is very confident (often 1.0 on one
  option), so features are close to one-hot rather than graded.
- **Art.** It is unevaluated and has no learned prior, so its first swipes teach
  it less than they do for films and books.
- **Eval caveats.** Evaluation users are heavy raters (80+ ratings in the
  catalog). Their swipes are simulated from cards they had already rated, at
  most 200 per user. "Like" means 4★ or more.
- **Licenses.**
  - MovieLens: research use; the raw data is never served.
  - Goodreads (UCSD Book Graph): academic use.
  - Wikipedia text: CC BY-SA. Wikidata and AIC metadata/images: CC0.
  - Film posters are Wikipedia's (non-free, low-resolution). Book covers come
    from Open Library, falling back to Goodreads.

## Data and reproduction

Everything lives under `taste/` in the private `benklosky-data` Space:

- `raw/`: the datasets as downloaded.
- `<domain>/`: catalogs, ratings samples, images, and the artifacts the page
  loads.
- `cache/answers.db`: every LLM answer and embedding, keyed by hashes of the
  question spec and the item input.
- `eval/`: evaluation results.

The page reads the Space through route handlers, so credentials never reach
the browser.

Rebuild from scratch:

```bash
scripts/taste/run_all.sh   # needs SPACES_* and OPENAI_API_KEY; MAX_DOLLARS caps answer spend
```

Every step is cached or resumable. A rerun pays only for answers whose
question or item text changed.

- `answer.py` refuses to continue once total recorded spend passes
  `--max-dollars`.
- `scripts/taste/simulate.ts` plays a synthetic user against a running dev
  server.
- `scripts/taste/parity.py` + `bun test src/app/taste` checks that the browser
  model matches Python.
