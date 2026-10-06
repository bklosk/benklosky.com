import { Ink } from "./ink";

export default function Home() {
  return (
    <div id="about" className="intro">
      <Ink>
        <p>
          I create new ventures and products for Steve Levitt&apos;s{" "}
          <a href="https://risc.uchicago.edu">lab</a> (of{" "}
          <span className="italic">Freakonomics</span> fame).
        </p>
        <p>
          Right now, I'm doing <a href="https://en.wikipedia.org/wiki/Natural_language_processing">NLP</a> research for 
          foster care agencies and helping run a{" "}
          <a href="https://thelevittlab.org">radical new school</a>.
        </p>
        <p>
          I&apos;ve worked as a machine learning engineer, an econ researcher, and
          as an apprentice at a police department.
        </p>
        <p>
          I&apos;m also a{" "}
          <a href="https://en.wikipedia.org/wiki/Maker_culture">maker</a>. I love
          economics, fabricating objects, and{" "}
          <a href="https://en.wikipedia.org/wiki/Just-in-time_learning">
            just-in-time learning
          </a>
          .
        </p>
      </Ink>
    </div>
  );
}
