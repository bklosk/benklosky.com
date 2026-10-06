import type { Metadata } from "next";
import { Ink } from "../ink";

export const metadata: Metadata = {
  title: "Shipped · Ben Klosky",
};

export default function ShippedPage() {
  return (
    <div className="intro">
      <Ink>
        <p>Shipped — coming soon.</p>
      </Ink>
    </div>
  );
}
