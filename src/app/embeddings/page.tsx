import type { Metadata } from "next";
import { readJson } from "@/lib/space";
import { ClusterMap, type ClusterMapData } from "./cluster-map";
import "./embeddings.css";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Embeddings · Ben Klosky",
  description: "A UMAP of 1,268 patients, colored by five groups in their chart scores.",
};

export default async function EmbeddingsPage() {
  const clusters = await readJson<ClusterMapData>("clusters.json");
  return <ClusterMap data={clusters} />;
}
