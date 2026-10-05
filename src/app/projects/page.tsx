import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Projects · Ben Klosky",
};

export default function ProjectsPage() {
  return (
    <div className="intro projects-content">
      <p>
        <Link href="/shelf">The game shelf</Link>
      </p>
      <p>
        <Link href="/shipped">Shipped</Link>
      </p>
    </div>
  );
}
