"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Folder, Linkedin, Mail, Twitter, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { BubbleCanvas } from "./bubble-canvas";
// A static import gets a content-hashed URL, so browsers and Cloudflare can cache the portrait forever.
import portrait from "../../public/ben.jpg";

const linkIconProps = {
  size: 15,
  strokeWidth: 2,
  "aria-hidden": true as const,
};

const links: { label: string; href: string; icon: LucideIcon; external?: boolean }[] = [
  { label: "Email", href: "mailto:benklosky@uchicago.edu", icon: Mail },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/ben-klosky", icon: Linkedin, external: true },
  { label: "Twitter", href: "https://x.com/benklosky", icon: Twitter, external: true },
  { label: "Projects", href: "/projects", icon: Folder },
];

export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const shelf = pathname === "/shelf";
  const article = pathname === "/embeddings" || pathname === "/windborne" || pathname === "/making" || pathname === "/sorcerer";
  const home = pathname === "/";

  return (
    <BubbleCanvas enabled={home}>
      {!home && (
        <header className="mobile-header">
          <Link href="/">
            <ArrowLeft aria-hidden="true" />
            <span>home</span>
          </Link>
        </header>
      )}
      <div
        className={`composition${shelf ? " composition--shelf" : ""}${article ? " composition--article" : ""}`}
      >
        <div className={`link-column${home ? " is-home" : ""}`}>
          <Link href="/" aria-label="Home" className="portrait-link">
            <Image className="portrait" src={portrait} alt="" width={80} height={80} preload />
          </Link>
          <nav className="link-wall" aria-label="Links">
            {links.map((link) => {
              const Icon = link.icon;
              return link.external || link.href.startsWith("mailto:") ? (
                <a key={link.label} href={link.href} target={link.external ? "_blank" : undefined} rel={link.external ? "noreferrer" : undefined}>
                  <Icon {...linkIconProps} />
                  <span>{link.label}</span>
                </a>
              ) : (
                <Link key={link.label} href={link.href} aria-current={pathname === link.href ? "page" : undefined}>
                  <Icon {...linkIconProps} />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="page-content">
          {/* No route fade: the old page used to fade out before the new one faded in, so text popped in late. */}
          {children}
        </div>
      </div>
    </BubbleCanvas>
  );
}
