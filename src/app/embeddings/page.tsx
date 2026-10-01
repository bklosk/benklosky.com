import type { Metadata } from "next";
import { readJson } from "@/lib/space";
import { ClusterMap, type ClusterMapData } from "./cluster-map";
import "./embeddings.css";

export const revalidate = 3600;

export default async function EmbeddingsPage() {
  const clusters = await readJson<ClusterMapData>("clusters.json");
  return <ClusterMap data={clusters} />;
}
