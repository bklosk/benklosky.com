import type { Metadata } from "next";
import { LiveMap } from "./live-map";
import { RailHistory } from "./rail-history";
import "./map.css";

export const metadata: Metadata = {
  title: "Map · Ben Klosky",
  description: "Ships and freight rail around Chicago.",
};

export default function MapPage() {
  // The radio layer and log appear only for a signed-in session (/map/radio); the page itself stays static.
  return (
    <div className="map-page">
      <LiveMap />
      <RailHistory />
    </div>
  );
}
