import {
  bodyTextClass,
  cardPaddingClass,
  panelClass,
  Section,
} from "./Section";

const notes = [
  "Based in Chicago and usually thinking about dsyfunctional systems and how groups make decisions.",
  "Interested in products that reward patience and make complicated systems legible.",
  "Currently rebuilding this site as a lighter home for essays, projects, and field notes.",
];

export function NotesSection() {
  return (
    <Section id="notes" title="More info">
      <div className="grid gap-3 min-[901px]:grid-cols-3">
        {notes.map((note) => (
          <article
            className={`${panelClass} ${cardPaddingClass} rounded-md`}
            key={note}
          >
            <p className={`${bodyTextClass} m-0`}>{note}</p>
          </article>
        ))}
      </div>
    </Section>
  );
}
