import { bodyTextClass, Section } from "./Section";

export function Bio() {
  return (
    <Section id="work" title="Bio">
      <div className="grid gap-[clamp(1rem,3vw,1.65rem)]">
        <p className={`${bodyTextClass} m-0`}>
          I work at the Center for RISC at the University of Chicago. We search for radical ideas to make the world a better place. Right now, I work on the foster care system and education reform.
          I've worked as a machine learning engineer, a math teacher, an economics researcher, and as an apprentice at a police department.

          <br /> <br /> I love reading about the history of commerce, technology, and medicine. I also love jazz, causal inference, and well designed products. I'm unusually resourceful, and love to make things.
        </p>
      </div>
    </Section>
  );
}
