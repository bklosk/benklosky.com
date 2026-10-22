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
        // Open in the browser's PDF viewer, and save under a real name.
        source: "/resume",
        headers: [{ key: "Content-Disposition", value: 'inline; filename="Klosky Resume.pdf"' }],
      },
    ];
  },
  async redirects() {
    // /map was renamed /rail.
    return [
      { source: "/map", destination: "/rail", permanent: true },
      { source: "/map/:path*", destination: "/rail/:path*", permanent: true },
    ];
  },
  async rewrites() {
    return [{ source: "/resume", destination: "/klosky-resume.pdf" }];
  },
};

const withMDX = createMDX({});

export default withMDX(nextConfig);
