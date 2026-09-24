import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Projects · Ben Klosky",
};

export default function ProjectsPage() {
  return (
    <div className="intro projects-content">
      <Link href="/shelf">The game shelf</Link>
    </div>
  );
}
