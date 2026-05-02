import {
  bodyTextClass,
  cardPaddingClass,
  panelClass,
  Section,
} from "./Section";

const notes = [
  "Based in Brooklyn and usually thinking about cities, software, music, and crime.",
  "Interested in products that reward patience and make complicated systems legible.",
  "Currently rebuilding this site as a lighter home for essays, projects, and field notes.",
];

export function NotesSection() {
  return (
    <Section id="notes" title="More info" kicker="Loose coordinates">
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
