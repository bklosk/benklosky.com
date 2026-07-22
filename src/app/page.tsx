import { PhysicsLinks } from "@/components/PhysicsLinks";

export default function Home() {
  return (
    <main className="site-shell">
      <aside id="about" className="intro">
        <p>
          I’m Ben Klosky, a{" "}
          <a href="https://en.wikipedia.org/wiki/Maker_culture">maker</a>. I
          design products for a <a href="https://risc.uchicago.edu"> lab </a>{" "}
          founded by Steve Levitt. (of{" "}
          <span className="italic"> Freakonomics </span> fame).
          <br />
          <br />
          Right now, I work on the foster care system and education reform.
          I&apos;ve worked as a machine learning engineer, a math teacher, an
          researcher at a think tank, and as an apprentice at a police
          department. <br />
          <br />I love reading about the history of technology and medicine. I
          also love jazz, causal inference, and well designed products. I&apos;m
          unusually resourceful, and love to make things.
        </p>
      </aside>
      <PhysicsLinks />
    </main>
  );
}
