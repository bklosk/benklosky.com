import { readObject } from "@/lib/space";
import { isDomain } from "../../../domains";

/** Posters, covers, and artworks, served from the private Space. */
export async function GET(_request: Request, ctx: RouteContext<"/taste/image/[domain]/[id]">) {
  const { domain, id } = await ctx.params;
  if (!isDomain(domain) || !/^(ml|gr|aic)\d+$/.test(id)) return new Response("Not found", { status: 404 });
  try {
    const body = (await readObject(`taste/${domain}/images/${id}.jpg`)) as Uint8Array<ArrayBuffer>;
    return new Response(body, {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=604800, s-maxage=2592000, immutable" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
