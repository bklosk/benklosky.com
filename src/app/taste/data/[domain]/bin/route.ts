import { readObject } from "@/lib/space";
import { isDomain } from "../../../domains";

/** The domain's matrices (features, correlations, prior factors); layout is in model.json. */
export async function GET(_request: Request, ctx: RouteContext<"/taste/data/[domain]/bin">) {
  const { domain } = await ctx.params;
  if (!isDomain(domain)) return new Response("Not found", { status: 404 });
  try {
    const body = (await readObject(`taste/${domain}/model.bin`)) as Uint8Array<ArrayBuffer>;
    return new Response(body, {
      headers: { "Content-Type": "application/octet-stream", "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
