import type { Metadata } from "next";
import { Ink } from "../ink";

export const metadata: Metadata = {
  title: "Tennis · Ben Klosky",
};

export default function TennisPage() {
  return (
    <div className="intro">
      <Ink>
        <p>Tennis — coming soon.</p>
      </Ink>
    </div>
  );
}
