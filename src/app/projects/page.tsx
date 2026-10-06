import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Ink } from "../ink";
import shelfStage from "./shelf-stage.jpg";
import { ShippedChart } from "./shipped-chart";
import "./projects.css";

export const metadata: Metadata = {
  title: "Projects · Ben Klosky",
};

export default function ProjectsPage() {
  return (
    <div className="projects-content">
          <p className="intro">
        <Ink>
          <Link href="/shipped">Shipped</Link>
        </Ink>
      </p>
      <ShippedChart />
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
