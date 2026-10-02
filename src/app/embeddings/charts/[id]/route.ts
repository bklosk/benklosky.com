import { readObject } from "@/lib/space";

export async function GET(_request: Request, ctx: RouteContext<"/embeddings/charts/[id]">) {
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) return new Response("Not found", { status: 404 });

  try {
    const body = new TextDecoder().decode(await readObject(`symptom_charts/${id}.json`));
    return new Response(body, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
