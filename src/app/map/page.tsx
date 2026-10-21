import type { Metadata } from "next";
import { LiveMap } from "./live-map";
import "./map.css";

export const metadata: Metadata = {
  title: "Map · Ben Klosky",
  description: "Ships and freight rail around Chicago.",
};

export default function MapPage() {
  return <LiveMap />;
}
