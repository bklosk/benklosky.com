# benklosky.com

A small personal site built with Next.js, Bun, Tailwind CSS, and Velite.

## Getting Started

Install dependencies and run the development server:

```bash
bun install
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Writing

Articles are Markdown files in `src/content/articles`. Each file needs
frontmatter like this:

```md
---
title: "My essay"
date: "2026-05-01"
slug: "my-essay"
visible: true
---

Essay body goes here.
```

Set `visible: false` to hide a draft. If `slug` is omitted, Velite derives it
from the file path. Markdown is transformed to HTML during `bun dev` and
`bun run build`.
