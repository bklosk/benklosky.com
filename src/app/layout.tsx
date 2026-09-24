import type { Metadata } from "next";
import { SiteShell } from "./site-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "benklosky.com",
  description: "benklosky.com",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
