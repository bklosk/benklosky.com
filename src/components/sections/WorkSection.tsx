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
    title: "Personal tooling",
    description:
      "Small experiments for writing, memory, and making software feel less like paperwork.",
    year: "2026",
  },
  {
    title: "Economic notes",
    description:
      "Short research threads on incentives, institutions, and second-order effects.",
    year: "Ongoing",
  },
  {
    title: "Machine collaboration",
    description:
      "Prototypes around creative agency, AI interfaces, and human taste as infrastructure.",
    year: "Now",
  },
];

export function WorkSection() {
  return (
    <Section id="work" title="Work" kicker="Projects and collaborations">
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
