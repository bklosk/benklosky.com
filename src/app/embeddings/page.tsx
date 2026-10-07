import type { Metadata } from "next";
import { readJson } from "@/lib/space";
import Article from "./article.mdx";
import { ClusterProvider, type ClusterMapData } from "./cluster-map";
import "./embeddings.css";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Charts by presentation",
};

export default async function EmbeddingsPage() {
  const [data, openai] = await Promise.all([
    readJson<ClusterMapData>("symptom_clusters.json"),
    readJson<ClusterMapData>("openai_clusters.json"),
  ]);
  return (
    <article className="embeddings-page">
      <ClusterProvider data={data} openai={openai}>
        <Article />
      </ClusterProvider>
    </article>
  );
}
