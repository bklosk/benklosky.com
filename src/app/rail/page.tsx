import type { Metadata } from "next";
import { LiveMap } from "./live-map";
import { RailHistory } from "./rail-history";
import "./map.css";

export const metadata: Metadata = {
  title: "Rail · Ben Klosky",
  description: "Freight rail, railroad radio, and ships around Chicago.",
};

export default function MapPage() {
  // The radio layer and log appear once the rail hub answers; the page itself stays static.
  return (
    <div className="map-page">
      <LiveMap />
      <RailHistory />
    </div>
  );
}
