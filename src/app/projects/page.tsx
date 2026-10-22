import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Ink } from "../ink";
import tennisPoster from "../../../public/tennis/clip-poster.webp";
import makingStage from "./making-stage.webp";
import { ProjectVideo } from "./project-video";
import railStage from "./rail-stage.webp";
import shelfStage from "./shelf-stage.jpg";
import tasteStage from "./taste-stage.jpg";
import "./projects.css";

export const metadata: Metadata = {
  title: "Projects · Ben Klosky",
};

export default function ProjectsPage() {
  return (
    <div className="projects-content">
      <p className="intro">
        <Ink>
          <Link href="/rail">Inferring train positions from radio comms</Link>
        </Ink>
      </p>
      <Link href="/rail" className="project-shot" aria-label="Rail map">
        <ProjectVideo
          src="/rail/preview.v1.mp4"
          poster={railStage}
          alt="Radio events on the Metra Electric and the CN Chicago line by the lakefront"
          sizes="16rem"
          eager
        />
      </Link>
      <p className="intro">
        <Ink>
          <Link href="/taste">Understand your own taste in movies and art</Link>
        </Ink>
      </p>
      <Link href="/taste" className="project-shot">
        <Image src={tasteStage} alt="Claude Monet, Poppy Field" sizes="16rem" placeholder="blur" />
      </Link>
      <p className="intro">
        <Ink>
          <Link href="/making">The things we make</Link>
        </Ink>
      </p>
      <Link href="/making" className="project-shot project-shot--wide">
        <Image src={makingStage} alt="An espresso machine in pieces on my desk" sizes="22rem" placeholder="blur" />
      </Link>
      <p className="intro">
        <Ink>
          <Link href="/tennis">Turning tennis broadcast video into data with VLMs</Link>
        </Ink>
      </p>
      <Link href="/tennis" className="project-shot" aria-label="Tennis">
        <ProjectVideo src="/tennis/clip.mp4" poster={tennisPoster} alt="A tennis rally from a broadcast" sizes="16rem" />
      </Link>
      <p className="intro">
        <Ink>
          <Link href="/shelf">An interactive model of my friend's kallax</Link>
        </Ink>
      </p>
      <Link href="/shelf" className="project-shot">
        <Image src={shelfStage} alt="The game shelf in 3D" sizes="16rem" placeholder="blur" />
      </Link>
    </div>
  );
}
