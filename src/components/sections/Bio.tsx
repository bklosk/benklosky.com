import {
  articleTitleClass,
  bodyTextClass,
  cardPaddingClass,
  Eyebrow,
  panelClass,
  Section,
} from "./Section";

const projects = [
  {
    title: "placeholder",
    description: "placeholder.",
    year: "2026",
  },
];

export function Bio() {
  return (
    <Section id="work" title="Bio">
      <div className="grid gap-[clamp(1rem,3vw,1.65rem)]">
        {projects.map((project) => (
          <article
            className={`${panelClass} ${cardPaddingClass} rounded-lg`}
            key={project.title}
          >
            <Eyebrow>{project.year}</Eyebrow>
            <h2 className={articleTitleClass}>{project.title}</h2>
            <p className={bodyTextClass}>{project.description}</p>
          </article>
        ))}
      </div>
    </Section>
  );
}
