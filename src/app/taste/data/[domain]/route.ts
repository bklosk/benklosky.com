import { readObject } from "@/lib/space";
import { isDomain } from "../../domains";

/** The domain's model: items, features, prior, and readout settings. */
export async function GET(_request: Request, ctx: RouteContext<"/taste/data/[domain]">) {
  const { domain } = await ctx.params;
  if (!isDomain(domain)) return new Response("Not found", { status: 404 });
  try {
    const body = (await readObject(`taste/${domain}/model.json`)) as Uint8Array<ArrayBuffer>;
    return new Response(body, {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
