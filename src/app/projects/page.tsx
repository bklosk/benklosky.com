import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Ink } from "../ink";
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
          <Link href="/taste">Understand your own taste in movies and art</Link>
        </Ink>
      </p>
      <Link href="/taste" className="project-shot">
        <Image src={tasteStage} alt="Claude Monet, Poppy Field" sizes="16rem" />
      </Link>
      <p className="intro">
        <Ink>
          <Link href="/tennis">Turning tennis broadcast video into data with VLMs</Link>
        </Ink>
      </p>
      <Link href="/tennis" className="project-shot" aria-label="Tennis">
        <video
          src="/tennis/clip.mp4"
          poster="/tennis/clip-poster.webp"
          width={640}
          height={360}
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          aria-hidden
        />
      </Link>
      <p className="intro">
        <Ink>
          <Link href="/shelf">An interactive model of my friend's kallax</Link>
        </Ink>
      </p>
      <Link href="/shelf" className="project-shot">
        <Image src={shelfStage} alt="The game shelf in 3D" sizes="16rem" />
      </Link>
    </div>
  );
}
