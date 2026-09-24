import type { Metadata } from "next";
import games from "./data/games.json";
import { ShelfExplorer } from "./shelf-explorer";
import "./shelf.css";

export const metadata: Metadata = {
  title: "The game shelf · Ben Klosky",
  description:
    "Explore a real board-game collection, one box at a time. An interactive 3D IKEA KALLAX shelf with game details from BoardGameGeek.",
};

export default function ShelfPage() {
  return <ShelfExplorer games={games} />;
}
