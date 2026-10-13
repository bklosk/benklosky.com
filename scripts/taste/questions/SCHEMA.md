# Question bank format

One JSON array per domain (`movies.json`, `books.json`, `art.json`). Every
question is either a **score** (ordered levels) or a **choice** (one of a
fixed, unordered set). There are no yes/no predicates, and no choice question
may be a yes/no in disguise (two options that are "is X" / "is not X").

Each question becomes features of the item. The swipe model learns a weight
per feature, and the profile reads those weights back through the `phrase`
fields. So phrases must read naturally in these templates:

- "You prefer {phrase}." / "You tend to avoid {phrase}."
- "Not sure yet about {topic}."

## score

```json
{
  "id": "pacing",
  "type": "score",
  "group": "Pace and structure",
  "instructions": "How fast is the pacing of this film?",
  "levels": [
    {"label": "very slow", "description": "Long takes, little happens, contemplative."},
    {"label": "slow", "description": "..."},
    {"label": "moderate", "description": "..."},
    {"label": "fast", "description": "..."},
    {"label": "very fast", "description": "Relentless, constant action or cutting."}
  ],
  "low": "slow, contemplative films",
  "high": "fast-paced films",
  "topic": "pacing"
}
```

- `levels` are ordered lowest to highest, 3 to 7 of them (5 is typical).
- `low` / `high` are plural noun phrases describing items at each end.

## choice

```json
{
  "id": "setting_era",
  "type": "choice",
  "group": "Setting",
  "instructions": "When is the story mainly set?",
  "choices": [
    {"value": "prehistory_ancient", "description": "Before 500 AD.", "phrase": "stories set in the ancient world"},
    {"value": "contemporary", "description": "Within ~10 years of release.", "phrase": "stories set in the present day"},
    {"value": "future", "description": "...", "phrase": "stories set in the future"}
  ],
  "topic": "when the story is set"
}
```

- 3 to 8 choices, mutually exclusive and jointly exhaustive (add a catch-all
  like `"other"` or `"none"` when needed; its phrase can be generic).
- `value` is snake_case and unique within the question.
- `phrase` is a plural noun phrase for items with that answer.

## All questions

- `id` is snake_case and unique in the file.
- `group` is a short section name used to organize the profile.
- `instructions` is one clear question an LLM can answer from the item's
  metadata (and, for art, the image) plus general knowledge.
- `"hidden": true` (optional) keeps the question in the model but out of
  everything the page shows: traits, "not sure yet", card and
  recommendation reasons, and the trait picker. Used for author gender and
  political lean in books.
