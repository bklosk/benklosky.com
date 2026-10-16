import type { Metadata } from "next";
import { Ink } from "../ink";

export const metadata: Metadata = {
  title: "WindBorne · Ben Klosky",
};

export default function WindbornePage() {
  return (
    <div className="intro">
      <Ink>
        <p>WindBorne — coming soon.</p>
      </Ink>
    </div>
  );
}
