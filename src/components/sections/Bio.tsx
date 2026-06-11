import { bodyTextClass, Section } from "./Section";

const paragraphs = [
  "I work at the Center for RISC at the University of Chicago. We search for radical ideas to make the world a better place. Right now, I work on the foster care system and education reform.",
  "I've worked as a machine learning engineer, a math teacher, an economics researcher, and as an apprentice at a police department.",
  "I love reading about the history of commerce, technology, and medicine. I also love jazz, causal inference, and well designed products. I'm unusually resourceful, and love to make things.",
];

export function Bio() {
  return (
    <Section id="bio" title="Bio">
      <div className="grid gap-5">
        {paragraphs.map((text) => (
          <p className={`${bodyTextClass} m-0`} key={text}>
            {text}
          </p>
        ))}
      </div>
    </Section>
  );
}
