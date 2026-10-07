<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

- Install dependencies with Bun, not npm. The lockfile is `bun.lock`. Put `bun` on the default PATH (`/usr/local/bin`) because login shells do not load `~/.bashrc`.
- Dev server: `bun run dev` (Next.js 16). It listens on `0.0.0.0:3000`.
- `bun x tsc --noEmit` passes after Next generates `next-env.d.ts`. `bun run lint` currently fails on existing issues in `src/app/page.tsx`, `src/app/projects/page.tsx`, and `src/app/shelf/shelf-model.tsx`.
- `/`, `/projects`, `/shelf`, and `/tennis` run without extra credentials. `/embeddings` and `bun run build` read a private DigitalOcean Space and need `SPACES_ENDPOINT`, `SPACES_BUCKET`, `SPACES_KEY`, and `SPACES_SECRET`. PostHog stays off unless `NEXT_PUBLIC_POSTHOG_KEY` is set.
