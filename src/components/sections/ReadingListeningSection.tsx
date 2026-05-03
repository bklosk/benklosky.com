import {
  bodyTextClass,
  cardPaddingClass,
  panelClass,
  Section,
} from "./Section";

const items = [
  "Based in Chicago and usually thinking about dsyfunctional systems and how groups make decisions.",
  "Interested in products that reward patience and make complicated systems legible.",
  "Currently rebuilding this site as a lighter home for essays, projects, and field notes.",
];

export function ReadingListeningSection() {
  return (
    <Section id="reading-listening" title="Reading & Listening">
      <div className="grid gap-3 min-[901px]:grid-cols-3">
        {items.map((item) => (
          <article
            className={`${panelClass} ${cardPaddingClass} rounded-md`}
            key={item}
          >
            <p className={`${bodyTextClass} m-0`}>{item}</p>
          </article>
        ))}
      </div>
    </Section>
  );
}
