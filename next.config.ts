import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  async headers() {
    return [
      {
        // Model files are versioned by name, so browsers can keep them forever.
        source: "/clickbait/:file*.bin",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        // Unversioned public media. Public files default to max-age=0, which sends every view to the app
        // instance; cache for a day and revalidate in the background instead.
        source: "/:file(tennis/clip\\.mp4|tennis/clip-poster\\.webp)",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
      {
        // Open in the browser's PDF viewer, and save under a real name.
        source: "/resume",
        headers: [{ key: "Content-Disposition", value: 'inline; filename="Klosky Resume.pdf"' }],
      },
    ];
  },
  async rewrites() {
    return [{ source: "/resume", destination: "/klosky-resume.pdf" }];
  },
};

const withMDX = createMDX({});

export default withMDX(nextConfig);
