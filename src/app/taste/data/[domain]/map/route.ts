import { readObject } from "@/lib/space";
import { isDomain } from "../../../domains";

/** The domain's map: UMAP positions and question-space clusters (scripts/taste/map.py). */
export async function GET(_request: Request, ctx: RouteContext<"/taste/data/[domain]/map">) {
  const { domain } = await ctx.params;
  if (!isDomain(domain)) return new Response("Not found", { status: 404 });
  try {
    const body = (await readObject(`taste/${domain}/map.json`)) as Uint8Array<ArrayBuffer>;
    return new Response(body, {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
